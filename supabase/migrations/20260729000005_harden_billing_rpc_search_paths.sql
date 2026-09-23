-- ProjectMatrix Billing RPC search-path hardening.
--
-- This migration preserves the existing Billing authorization and trial-start
-- behaviour while removing mutable schemas from the SECURITY DEFINER search
-- path. COALESCE is intentionally left unqualified because it is a PostgreSQL
-- conditional expression, not a schema-qualified function.

BEGIN;

CREATE OR REPLACE FUNCTION public.verify_billing_access(
    p_company_id pg_catalog.uuid
)
RETURNS pg_catalog.bool
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $verify_billing_access$
    SELECT (
        auth.uid() IS NOT NULL
        AND p_company_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.company_members AS cm
            WHERE cm.company_id = p_company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_active IS TRUE
              AND (
                  pg_catalog.regexp_replace(
                      pg_catalog.lower(
                          pg_catalog.btrim(
                              COALESCE(cm.designation, ''::pg_catalog.text)
                          )
                      ),
                      '[\s\-_]+'::pg_catalog.text,
                      '_'::pg_catalog.text,
                      'g'::pg_catalog.text
                  ) IN (
                      'ceo',
                      'coo',
                      'cfo',
                      'director',
                      'project_manager',
                      'company_administrator',
                      'company_admin'
                  )
                  OR
                  pg_catalog.regexp_replace(
                      pg_catalog.lower(
                          pg_catalog.btrim(
                              COALESCE(cm.role, ''::pg_catalog.text)
                          )
                      ),
                      '[\s\-_]+'::pg_catalog.text,
                      '_'::pg_catalog.text,
                      'g'::pg_catalog.text
                  ) IN (
                      'ceo',
                      'coo',
                      'cfo',
                      'director',
                      'project_manager',
                      'company_administrator',
                      'company_admin'
                  )
              )
        )
    );
$verify_billing_access$;

REVOKE ALL ON FUNCTION public.verify_billing_access(pg_catalog.uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_billing_access(pg_catalog.uuid)
    TO authenticated;

CREATE OR REPLACE FUNCTION public.start_billing_trial(
    p_company_id pg_catalog.uuid,
    p_plan_code pg_catalog.text DEFAULT 'business-monthly'::pg_catalog.text
)
RETURNS public.billing_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $start_billing_trial$
DECLARE
    v_caller_id pg_catalog.uuid;
    v_plan public.billing_plans%ROWTYPE;
    v_existing_sub public.billing_subscriptions%ROWTYPE;
    v_has_historical_trial pg_catalog.bool;
    v_now pg_catalog.timestamptz;
    v_trial_ends pg_catalog.timestamptz;
    v_sub_ref pg_catalog.text;
    v_new_sub public.billing_subscriptions%ROWTYPE;
BEGIN
    -- 1. Require an authenticated caller.
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to start a billing trial.'
            USING ERRCODE = '28000';
    END IF;

    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'Company ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- 2. Verify Billing access using the hardened RBAC helper.
    IF public.verify_billing_access(p_company_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Access denied. You do not have permission to manage billing for this company.'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Serialize concurrent requests for the same company and verify that it exists.
    PERFORM 1
    FROM public.companies
    WHERE id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Company with ID % not found.', p_company_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 4. Return the existing current subscription without changing its dates.
    SELECT *
    INTO v_existing_sub
    FROM public.billing_subscriptions
    WHERE company_id = p_company_id
      AND status IN (
          'pending_activation',
          'trialing',
          'active',
          'non_renewing',
          'past_due'
      )
    LIMIT 1;

    IF FOUND THEN
        RETURN v_existing_sub;
    END IF;

    -- 5. Prevent a second free trial after cancellation or expiry.
    SELECT (
        EXISTS (
            SELECT 1
            FROM public.billing_ledger_events
            WHERE company_id = p_company_id
              AND event_type = 'trial_started'
        )
        OR EXISTS (
            SELECT 1
            FROM public.billing_subscriptions
            WHERE company_id = p_company_id
              AND trial_started_at IS NOT NULL
        )
    )
    INTO v_has_historical_trial;

    IF v_has_historical_trial IS TRUE THEN
        RAISE EXCEPTION 'A free trial has already been used for this company.'
            USING ERRCODE = '23505';
    END IF;

    -- 6. Resolve the active server-controlled Billing plan.
    SELECT *
    INTO v_plan
    FROM public.billing_plans
    WHERE code = COALESCE(
        p_plan_code,
        'business-monthly'::pg_catalog.text
    );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Billing plan "%" not found.', p_plan_code
            USING ERRCODE = 'P0002';
    END IF;

    IF v_plan.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Billing plan "%" is currently inactive.', p_plan_code
            USING ERRCODE = '22023';
    END IF;

    -- 7. Snapshot the transaction timestamp and generate a subscription reference.
    v_now := pg_catalog.now();
    v_trial_ends := v_now
        + pg_catalog.make_interval(days => v_plan.trial_days);
    v_sub_ref :=
        'SUB-'::pg_catalog.text
        || pg_catalog.to_char(v_now, 'YYYYMMDD'::pg_catalog.text)
        || '-'::pg_catalog.text
        || pg_catalog.upper(
            pg_catalog.substring(
                pg_catalog.replace(
                    pg_catalog.gen_random_uuid()::pg_catalog.text,
                    '-'::pg_catalog.text,
                    ''::pg_catalog.text
                ),
                1,
                8
            )
        );

    -- 8. Insert the company subscription using the server-side plan snapshot.
    INSERT INTO public.billing_subscriptions (
        company_id,
        plan_id,
        subscription_reference,
        status,
        amount_minor,
        currency,
        billing_interval,
        trial_started_at,
        trial_ends_at,
        current_period_start,
        current_period_end,
        next_renewal_at,
        auto_renew_enabled,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        p_company_id,
        v_plan.id,
        v_sub_ref,
        'trialing',
        v_plan.amount_minor,
        v_plan.currency,
        v_plan.billing_interval,
        v_now,
        v_trial_ends,
        v_now,
        v_trial_ends,
        v_trial_ends,
        false,
        v_caller_id,
        v_now,
        v_now
    )
    RETURNING * INTO v_new_sub;

    -- 9. Append the immutable ledger event in the same transaction.
    INSERT INTO public.billing_ledger_events (
        company_id,
        subscription_id,
        event_type,
        event_source,
        occurred_at,
        recorded_at,
        actor_profile_id,
        deduplication_key,
        event_data
    ) VALUES (
        p_company_id,
        v_new_sub.id,
        'trial_started',
        'user',
        v_now,
        v_now,
        v_caller_id,
        'trial_started:'::pg_catalog.text || p_company_id::pg_catalog.text,
        pg_catalog.jsonb_build_object(
            'plan_code', v_plan.code,
            'amount_minor', v_plan.amount_minor,
            'currency', v_plan.currency,
            'trial_days', v_plan.trial_days,
            'trial_started_at', v_now,
            'trial_ends_at', v_trial_ends
        )
    );

    -- 10. Return the newly created subscription.
    RETURN v_new_sub;
END;
$start_billing_trial$;

REVOKE ALL ON FUNCTION public.start_billing_trial(
    pg_catalog.uuid,
    pg_catalog.text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_billing_trial(
    pg_catalog.uuid,
    pg_catalog.text
) TO authenticated;

COMMIT;