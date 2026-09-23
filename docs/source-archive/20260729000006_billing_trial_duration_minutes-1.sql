-- ProjectMatrix Billing: express plan trial duration in minutes.
--
-- Purpose:
--   * Preserve the duration of every existing plan while changing the storage
--     unit from days to minutes.
--   * Configure business-monthly as a five-minute trial for end-to-end testing.
--   * Update start_billing_trial() to calculate the trial end in minutes.
--
-- Production follow-up:
--   Create a NEW migration that changes business-monthly from 5 to 10080
--   minutes (7 days). Do not edit this migration after it has been applied.

BEGIN;

-- 1. Change the plan catalogue from day precision to minute precision.
--    Renaming the column preserves its NOT NULL property and DEFAULT 0.
ALTER TABLE public.billing_plans
    RENAME COLUMN trial_days TO trial_duration_minutes;

ALTER TABLE public.billing_plans
    RENAME CONSTRAINT chk_billing_plans_trial_days_non_negative
    TO chk_billing_plans_trial_duration_minutes_non_negative;

-- 2. Preserve the effective duration of every existing plan.
--    Example: 7 days becomes 10080 minutes.
UPDATE public.billing_plans
SET trial_duration_minutes = trial_duration_minutes * 1440,
    updated_at = pg_catalog.now();

-- 3. Temporarily use a five-minute trial for the Business plan.
UPDATE public.billing_plans
SET trial_duration_minutes = 5,
    updated_at = pg_catalog.now()
WHERE code = 'business-monthly';

-- Fail the migration if the required plan is missing instead of silently
-- deploying a function with no usable default plan.
DO $verify_business_plan$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.billing_plans
        WHERE code = 'business-monthly'
          AND trial_duration_minutes = 5
    ) THEN
        RAISE EXCEPTION
            'Required billing plan business-monthly was not found or was not set to five minutes.';
    END IF;
END;
$verify_business_plan$;

-- 4. Replace the trial-start RPC while preserving its hardened search path,
--    RBAC, company locking, idempotency, one-trial rule, commercial snapshot,
--    and atomic ledger insertion.
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
    -- Require an authenticated caller.
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to start a billing trial.'
            USING ERRCODE = '28000';
    END IF;

    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'Company ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- Authorize against the active-company Billing roles.
    IF public.verify_billing_access(p_company_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Access denied. You do not have permission to manage billing for this company.'
            USING ERRCODE = '42501';
    END IF;

    -- Serialize concurrent requests for the same company and verify existence.
    PERFORM 1
    FROM public.companies
    WHERE id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Company with ID % not found.', p_company_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Return an existing current subscription without resetting its dates or
    -- appending a duplicate ledger event.
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

    -- Prevent a second free trial after cancellation or expiry.
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

    -- Resolve the active server-controlled Billing plan.
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

    -- Snapshot timestamps and calculate the configured minute-based trial.
    v_now := pg_catalog.now();
    v_trial_ends := v_now
        + pg_catalog.make_interval(
            mins => v_plan.trial_duration_minutes
        );

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

    -- Insert the subscription using the server-controlled plan snapshot.
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

    -- Append the immutable trial-start event in the same transaction.
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
            'trial_duration_minutes', v_plan.trial_duration_minutes,
            'trial_started_at', v_now,
            'trial_ends_at', v_trial_ends
        )
    );

    RETURN v_new_sub;
END;
$start_billing_trial$;

-- Preserve the existing RPC privilege boundary.
REVOKE ALL ON FUNCTION public.start_billing_trial(
    pg_catalog.uuid,
    pg_catalog.text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_billing_trial(
    pg_catalog.uuid,
    pg_catalog.text
) TO authenticated;

COMMIT;
