-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1A
-- Migration: Seven-Day Billing Entitlement Foundation
-- Filename: 20260827000002_company_billing_entitlement_foundation.sql
-- Description:
--   Creates public.get_company_billing_entitlement(p_company_id UUID) and
--   public.company_billing_allows_operational_write(p_company_id UUID) to evaluate
--   authoritative real-time commercial entitlement (full, grace-period, read-only)
--   with strict tenant isolation, server-side statement_timestamp() evaluation,
--   safe read-only fallbacks, and zero data mutations.
-- ============================================================================

BEGIN;

-- 1. Main Entitlement Evaluation Function
CREATE OR REPLACE FUNCTION public.get_company_billing_entitlement(
    p_company_id pg_catalog.uuid
)
RETURNS TABLE (
    company_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    subscription_status pg_catalog.text,
    entitlement_state pg_catalog.text,
    access_mode pg_catalog.text,
    can_read pg_catalog.bool,
    can_write pg_catalog.bool,
    can_access_billing pg_catalog.bool,
    can_export pg_catalog.bool,
    can_access_settings pg_catalog.bool,
    grace_started_at pg_catalog.timestamptz,
    grace_ends_at pg_catalog.timestamptz,
    read_only_since pg_catalog.timestamptz,
    reason_code pg_catalog.text,
    evaluated_at pg_catalog.timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $get_company_billing_entitlement$
DECLARE
    v_caller_id pg_catalog.uuid;
    v_now pg_catalog.timestamptz;
    v_current_subs public.billing_subscriptions[];
    v_current_count pg_catalog.int4;
    v_sub public.billing_subscriptions%ROWTYPE;
    v_terminal_subs public.billing_subscriptions[];
    v_terminal_count pg_catalog.int4;
    v_grace_end pg_catalog.timestamptz;
BEGIN
    -- 1. Evaluated at single point in time using statement_timestamp()
    v_now := pg_catalog.statement_timestamp();

    -- 2. Validate input parameters
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'Company ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- 3. Require authenticated user
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '28000';
    END IF;

    -- 4. Enforce tenant isolation via active company membership
    IF NOT EXISTS (
        SELECT 1
        FROM public.company_members AS cm
        WHERE cm.company_id = p_company_id
          AND cm.profile_id = v_caller_id
          AND cm.is_active IS TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. You do not have active membership in this company.'
            USING ERRCODE = '42501';
    END IF;

    -- 5. Query current subscriptions for the company
    -- Current statuses: pending_activation, trialing, active, non_renewing, past_due
    SELECT pg_catalog.array_agg(bs ORDER BY bs.created_at DESC, bs.id DESC), pg_catalog.count(*)
    INTO v_current_subs, v_current_count
    FROM public.billing_subscriptions AS bs
    WHERE bs.company_id = p_company_id
      AND bs.status IN (
          'pending_activation',
          'trialing',
          'active',
          'non_renewing',
          'past_due'
      );

    -- 6. Check for conflicting current subscriptions
    IF v_current_count > 1 THEN
        -- Conflicting current subscriptions exist; fail safely to read-only without choosing arbitrarily
        RETURN QUERY
        SELECT
            p_company_id,
            NULL::pg_catalog.uuid,
            NULL::pg_catalog.text,
            'conflict'::pg_catalog.text,
            'read_only'::pg_catalog.text,
            TRUE,
            FALSE,
            TRUE,
            TRUE,
            TRUE,
            NULL::pg_catalog.timestamptz,
            NULL::pg_catalog.timestamptz,
            NULL::pg_catalog.timestamptz,
            'SUBSCRIPTION_CONFLICT'::pg_catalog.text,
            v_now;
        RETURN;
    END IF;

    -- 7. If exactly one current subscription exists, evaluate it
    IF v_current_count = 1 THEN
        v_sub := v_current_subs[1];

        IF v_sub.status = 'active' THEN
            RETURN QUERY
            SELECT
                p_company_id,
                v_sub.id,
                v_sub.status,
                'active'::pg_catalog.text,
                'full'::pg_catalog.text,
                TRUE,
                TRUE,
                TRUE,
                TRUE,
                TRUE,
                NULL::pg_catalog.timestamptz,
                NULL::pg_catalog.timestamptz,
                NULL::pg_catalog.timestamptz,
                'ACTIVE_SUBSCRIPTION'::pg_catalog.text,
                v_now;
            RETURN;

        ELSIF v_sub.status IN ('trialing', 'pending_activation') THEN
            IF v_sub.trial_ends_at IS NULL THEN
                -- Missing required trial_ends_at; fail safely to read-only
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'trial_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_now,
                    'MISSING_TRIAL_END_DATE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSIF v_now < v_sub.trial_ends_at THEN
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    v_sub.status::pg_catalog.text,
                    'full'::pg_catalog.text,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    'TRIAL_ACTIVE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSE
                -- At or after trial_ends_at
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'trial_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_sub.trial_ends_at,
                    'TRIAL_EXPIRED'::pg_catalog.text,
                    v_now;
                RETURN;
            END IF;

        ELSIF v_sub.status = 'past_due' THEN
            IF v_sub.past_due_since IS NULL THEN
                -- Missing required past_due_since; fail safely to read-only
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'grace_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_now,
                    'MISSING_PAST_DUE_DATE'::pg_catalog.text,
                    v_now;
                RETURN;
            END IF;

            v_grace_end := v_sub.past_due_since + pg_catalog.interval '7 days';

            IF v_now < v_grace_end THEN
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'grace_period'::pg_catalog.text,
                    'grace_period'::pg_catalog.text,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    v_sub.past_due_since,
                    v_grace_end,
                    NULL::pg_catalog.timestamptz,
                    'PAST_DUE_GRACE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSE
                -- At or after 7-day deadline
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'grace_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    v_sub.past_due_since,
                    v_grace_end,
                    v_grace_end,
                    'PAST_DUE_EXPIRED'::pg_catalog.text,
                    v_now;
                RETURN;
            END IF;

        ELSIF v_sub.status = 'non_renewing' THEN
            IF v_sub.current_period_end IS NULL THEN
                -- Missing required current_period_end; fail safely to read-only
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'period_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_now,
                    'MISSING_PERIOD_END_DATE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSIF v_now < v_sub.current_period_end THEN
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'non_renewing'::pg_catalog.text,
                    'full'::pg_catalog.text,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    'NON_RENEWING_ACTIVE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSE
                -- At or after period end
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'period_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_sub.current_period_end,
                    'PERIOD_EXPIRED'::pg_catalog.text,
                    v_now;
                RETURN;
            END IF;
        END IF;
    END IF;

    -- 8. If no current subscription, check for terminal subscriptions (expired, cancelled)
    SELECT pg_catalog.array_agg(bs ORDER BY COALESCE(bs.cancelled_at, bs.expired_at, bs.updated_at, bs.created_at) DESC, bs.id DESC), pg_catalog.count(*)
    INTO v_terminal_subs, v_terminal_count
    FROM public.billing_subscriptions AS bs
    WHERE bs.company_id = p_company_id
      AND bs.status IN ('expired', 'cancelled');

    IF v_terminal_count > 0 THEN
        v_sub := v_terminal_subs[1];

        IF v_sub.status = 'cancelled' THEN
            RETURN QUERY
            SELECT
                p_company_id,
                v_sub.id,
                v_sub.status,
                'cancelled'::pg_catalog.text,
                'read_only'::pg_catalog.text,
                TRUE,
                FALSE,
                TRUE,
                TRUE,
                TRUE,
                NULL::pg_catalog.timestamptz,
                NULL::pg_catalog.timestamptz,
                COALESCE(v_sub.cancelled_at, v_sub.updated_at),
                'SUBSCRIPTION_CANCELLED'::pg_catalog.text,
                v_now;
            RETURN;
        ELSE -- 'expired'
            RETURN QUERY
            SELECT
                p_company_id,
                v_sub.id,
                v_sub.status,
                'expired'::pg_catalog.text,
                'read_only'::pg_catalog.text,
                TRUE,
                FALSE,
                TRUE,
                TRUE,
                TRUE,
                NULL::pg_catalog.timestamptz,
                NULL::pg_catalog.timestamptz,
                COALESCE(v_sub.expired_at, v_sub.current_period_end, v_sub.trial_ends_at, v_sub.updated_at),
                'SUBSCRIPTION_EXPIRED'::pg_catalog.text,
                v_now;
            RETURN;
        END IF;
    END IF;

    -- 9. No subscription exists for the company (Unconfigured)
    RETURN QUERY
    SELECT
        p_company_id,
        NULL::pg_catalog.uuid,
        NULL::pg_catalog.text,
        'unconfigured'::pg_catalog.text,
        'read_only'::pg_catalog.text,
        TRUE,
        FALSE,
        TRUE,
        TRUE,
        TRUE,
        NULL::pg_catalog.timestamptz,
        NULL::pg_catalog.timestamptz,
        NULL::pg_catalog.timestamptz,
        'NO_SUBSCRIPTION'::pg_catalog.text,
        v_now;
    RETURN;
END;
$get_company_billing_entitlement$;

REVOKE ALL ON FUNCTION public.get_company_billing_entitlement(pg_catalog.uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_billing_entitlement(pg_catalog.uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_company_billing_entitlement(pg_catalog.uuid) IS
'Evaluates and returns the real-time billing entitlement and access mode (full, grace-period, or read-only) for an authorized company member at statement_timestamp().';


-- 2. Boolean Helper for Operational Write Allowance
CREATE OR REPLACE FUNCTION public.company_billing_allows_operational_write(
    p_company_id pg_catalog.uuid
)
RETURNS pg_catalog.bool
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $company_billing_allows_operational_write$
DECLARE
    v_can_write pg_catalog.bool;
BEGIN
    SELECT e.can_write
    INTO v_can_write
    FROM public.get_company_billing_entitlement(p_company_id) AS e;

    RETURN COALESCE(v_can_write, false);
END;
$company_billing_allows_operational_write$;

REVOKE ALL ON FUNCTION public.company_billing_allows_operational_write(pg_catalog.uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_billing_allows_operational_write(pg_catalog.uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.company_billing_allows_operational_write(pg_catalog.uuid) IS
'Helper function returning true if the company billing entitlement allows operational write access (full or grace_period access mode).';

COMMIT;
