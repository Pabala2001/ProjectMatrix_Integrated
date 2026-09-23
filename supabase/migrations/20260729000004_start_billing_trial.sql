-- ============================================================================
-- Migration: Atomic Trial-Start Database Function
-- Filename: 20260729000004_start_billing_trial.sql
-- Description: Creates public.start_billing_trial(p_company_id UUID, p_plan_code TEXT)
--              to atomically provision a company's 7-day trial subscription and
--              record an immutable ledger event with strict authorization and idempotency.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.start_billing_trial(
    p_company_id UUID,
    p_plan_code TEXT DEFAULT 'business-monthly'
)
RETURNS public.billing_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_plan public.billing_plans%ROWTYPE;
    v_existing_sub public.billing_subscriptions%ROWTYPE;
    v_has_historical_trial BOOLEAN;
    v_now TIMESTAMPTZ;
    v_trial_ends TIMESTAMPTZ;
    v_sub_ref TEXT;
    v_new_sub public.billing_subscriptions%ROWTYPE;
BEGIN
    -- 1. Require authenticated caller
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to start a billing trial.'
            USING ERRCODE = '28000';
    END IF;

    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'Company ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- 2. Verify Billing Access using RBAC helper
    IF public.verify_billing_access(p_company_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Access denied. You do not have permission to manage billing for this company.'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Lock company row for transaction concurrency control and verify existence
    PERFORM 1
    FROM public.companies
    WHERE id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Company with ID % not found.', p_company_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 4. Idempotency Check: If company already has an active or current subscription, return it
    SELECT *
    INTO v_existing_sub
    FROM public.billing_subscriptions
    WHERE company_id = p_company_id
      AND status IN ('pending_activation', 'trialing', 'active', 'non_renewing', 'past_due')
    LIMIT 1;

    IF FOUND THEN
        RETURN v_existing_sub;
    END IF;

    -- 5. Historical Trial Check: Prevent multiple free trials after cancellation or expiry
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
    ) INTO v_has_historical_trial;

    IF v_has_historical_trial IS TRUE THEN
        RAISE EXCEPTION 'A free trial has already been used for this company.'
            USING ERRCODE = '23505';
    END IF;

    -- 6. Resolve and validate billing plan
    SELECT *
    INTO v_plan
    FROM public.billing_plans
    WHERE code = COALESCE(p_plan_code, 'business-monthly');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Billing plan "%" not found.', p_plan_code
            USING ERRCODE = 'P0002';
    END IF;

    IF v_plan.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Billing plan "%" is currently inactive.', p_plan_code
            USING ERRCODE = '22023';
    END IF;

    -- 7. Snapshot commercial timestamps and generate reference
    v_now := timezone('utc'::text, now());
    v_trial_ends := v_now + ((v_plan.trial_days)::text || ' days')::interval;
    v_sub_ref := 'SUB-' || to_char(v_now, 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    -- 8. Insert new billing subscription record
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

    -- 9. Append immutable ledger event in the same transaction
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
        'trial_started:' || p_company_id::text,
        jsonb_build_object(
            'plan_code', v_plan.code,
            'amount_minor', v_plan.amount_minor,
            'currency', v_plan.currency,
            'trial_days', v_plan.trial_days,
            'trial_started_at', v_now,
            'trial_ends_at', v_trial_ends
        )
    );

    -- 10. Return the newly created subscription row
    RETURN v_new_sub;
END;
$$;

-- Revoke permissions from public/anon, grant only to authenticated
REVOKE ALL ON FUNCTION public.start_billing_trial(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_billing_trial(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.start_billing_trial(UUID, TEXT) IS
'Atomically initializes a 7-day trial subscription and ledger audit record for authorized company billing administrators.';
