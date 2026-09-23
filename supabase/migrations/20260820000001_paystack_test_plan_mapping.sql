-- ============================================================================
-- ProjectMatrix Billing Phase 3A.1
-- Migration: Map active internal plan 'business-monthly' to Paystack Test Plan
-- Filename: 20260820000001_paystack_test_plan_mapping.sql
-- ============================================================================

DO $$
DECLARE
    v_plan RECORD;
    v_existing RECORD;
    c_target_plan_code CONSTANT TEXT := 'business-monthly';
    c_provider CONSTANT TEXT := 'paystack';
    c_environment CONSTANT TEXT := 'test';
    c_provider_plan_code CONSTANT TEXT := 'PLN_os65zcdsrs9yyes';
    c_provider_plan_id CONSTANT TEXT := '3994459';
    c_amount_minor CONSTANT INTEGER := 500000;
    c_currency CONSTANT VARCHAR(3) := 'ZAR';
    c_billing_interval CONSTANT TEXT := 'monthly';
BEGIN
    -- 1. Verify internal plan exists
    SELECT
        id,
        code,
        amount_minor,
        currency,
        billing_interval,
        is_active
    INTO v_plan
    FROM public.billing_plans
    WHERE code = c_target_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = pg_catalog.format('Internal plan %s not found in public.billing_plans', c_target_plan_code);
    END IF;

    -- 2. Verify internal plan is active
    IF v_plan.is_active IS NOT TRUE THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format('Internal plan %s is not active in public.billing_plans', c_target_plan_code);
    END IF;

    -- 3. Verify matching commercial values
    IF v_plan.amount_minor <> c_amount_minor THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Internal plan %s amount_minor %s does not match expected mapping amount_minor %s',
                c_target_plan_code,
                v_plan.amount_minor,
                c_amount_minor
            );
    END IF;

    IF v_plan.currency <> c_currency THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Internal plan %s currency %s does not match expected mapping currency %s',
                c_target_plan_code,
                v_plan.currency,
                c_currency
            );
    END IF;

    IF v_plan.billing_interval <> c_billing_interval THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Internal plan %s billing_interval %s does not match expected mapping billing_interval %s',
                c_target_plan_code,
                v_plan.billing_interval,
                c_billing_interval
            );
    END IF;

    -- 4. Check for active mapping for this plan, provider, and environment
    SELECT
        id,
        plan_id,
        provider,
        environment,
        provider_plan_code,
        provider_plan_id,
        amount_minor,
        currency,
        billing_interval,
        is_active
    INTO v_existing
    FROM public.billing_provider_plans
    WHERE plan_id = v_plan.id
      AND provider = c_provider
      AND environment = c_environment
      AND is_active IS TRUE;

    IF FOUND THEN
        -- If identical existing mapping: No-Op
        IF v_existing.provider_plan_code = c_provider_plan_code
           AND (v_existing.provider_plan_id = c_provider_plan_id OR (v_existing.provider_plan_id IS NULL AND c_provider_plan_id IS NULL))
           AND v_existing.amount_minor = c_amount_minor
           AND v_existing.currency = c_currency
           AND v_existing.billing_interval = c_billing_interval
           AND v_existing.is_active IS TRUE
        THEN
            RAISE NOTICE 'Identical active provider-plan mapping already exists for plan % on % (%) with id %. No-op.',
                c_target_plan_code, c_provider, c_environment, v_existing.id;
            RETURN;
        ELSE
            -- Conflicting active mapping exists: Raise Exception
            RAISE EXCEPTION USING
                ERRCODE = '23505',
                MESSAGE = pg_catalog.format(
                    'Conflicting active mapping exists for plan %s on %s (%s): existing (code=%s, id=%s, amount=%s, curr=%s, intv=%s) vs requested (code=%s, id=%s, amount=%s, curr=%s, intv=%s)',
                    c_target_plan_code,
                    c_provider,
                    c_environment,
                    v_existing.provider_plan_code,
                    v_existing.provider_plan_id,
                    v_existing.amount_minor,
                    v_existing.currency,
                    v_existing.billing_interval,
                    c_provider_plan_code,
                    c_provider_plan_id,
                    c_amount_minor,
                    c_currency,
                    c_billing_interval
                );
        END IF;
    END IF;

    -- 5. Verify provider_plan_code is not already in use in the same provider/environment
    IF EXISTS (
        SELECT 1
        FROM public.billing_provider_plans
        WHERE provider = c_provider
          AND environment = c_environment
          AND provider_plan_code = c_provider_plan_code
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23505',
            MESSAGE = pg_catalog.format(
                'Provider plan code %s is already in use in %s (%s)',
                c_provider_plan_code,
                c_provider,
                c_environment
            );
    END IF;

    -- 6. Insert new active provider plan mapping
    INSERT INTO public.billing_provider_plans (
        plan_id,
        provider,
        environment,
        provider_plan_code,
        provider_plan_id,
        amount_minor,
        currency,
        billing_interval,
        is_active
    ) VALUES (
        v_plan.id,
        c_provider,
        c_environment,
        c_provider_plan_code,
        c_provider_plan_id,
        c_amount_minor,
        c_currency,
        c_billing_interval,
        true
    );

    RAISE NOTICE 'Successfully mapped plan % to % (%) provider_plan_code %',
        c_target_plan_code, c_provider, c_environment, c_provider_plan_code;
END $$;
