-- ============================================================================
-- ProjectMatrix: expired-subscription recovery (corrected replacement)
-- File: 20260830000003_recover_expired_subscriptions.sql
--
-- Replace the complete contents of the pending migration with this file.
-- Prerequisites: the billing foundation, recurring-invoice foundation and
-- entitlement migrations dated before 20260830000003.
--
-- Public RPC signatures and result columns are retained. Billing RBAC and
-- existing idempotency keys remain authoritative. Opening checkout never
-- updates paid-period dates, starts another trial, or grants operational access.
--
-- Server integration contract:
-- * Call the two provider-reconciliation helpers with the service-role client
--   only, after authenticating the user and checking company Billing access.
-- * Match company, provider code, customer and environment against the verified
--   Paystack response. A provider code that is ambiguous across environments
--   is rejected, never selected with LIMIT 1.
-- * Verify the provider lifecycle and open/most-recent invoices before recording
--   terminal provider status. A database flag or an elapsed date is not proof.
-- * For PROVIDER_RECONCILIATION_REQUIRED, reconcile and retry the SAME key.
--   Only the Edge Function's authoritative provider check should return
--   SCHEDULED_RENEWAL_PENDING. Paystack non-renewing does not schedule a charge.
-- * PAID_PERIOD_RECONCILIATION_REQUIRED and PAYSTACK_INVOICE_RECONCILIATION_REQUIRED
--   block new charges until verified payment/invoice processing resolves them.
-- * Honour auto_renew_enabled in the actual Paystack request. A one-off recovery
--   must not attach a recurring plan. This SQL does not construct that request
--   or replace process_paystack_charge_success / its replay protection.
--
-- Locking: checkout takes the company and internal subscription locks, but never
-- locks or changes a provider row. Provider reconciliation takes company,
-- provider, then internal subscription locks. Provider->subscription matches the
-- existing disable-webhook order; checkout has no inverse provider lock.
-- ============================================================================

BEGIN;

DO $recovery_prerequisites$
BEGIN
    IF pg_catalog.to_regclass('public.billing_invoices') IS NULL THEN
        RAISE EXCEPTION 'Apply 20260825000001_paystack_recurring_invoice_foundation.sql before this migration.'
            USING ERRCODE = '42P01';
    END IF;
END;
$recovery_prerequisites$;

-- A user-initiated recovery checkout is not an automatically generated recurring
-- invoice payment. Keep recurring payments invoice-bound, while allowing the
-- existing authenticated checkout RPC to create an identified manual renewal.
-- No invoice is fabricated, and table write privileges are not widened.
ALTER TABLE public.billing_payments
    DROP CONSTRAINT IF EXISTS chk_billing_payments_purpose_invoice;
ALTER TABLE public.billing_payments
    ADD CONSTRAINT chk_billing_payments_purpose_invoice CHECK (
        purpose <> 'renewal'
        OR billing_invoice_id IS NOT NULL
        OR (
            initiated_by_profile_id IS NOT NULL
            AND idempotency_key IS NOT NULL
            AND provider_reference ~ '^PAY-[0-9]{8}-[0-9A-F]{32}$'
        )
    );

-- 1. Update public.get_company_billing_entitlement to treat expired 'active'
--    subscriptions as read_only (period_expired) based on current_period_end evidence.
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
            IF v_sub.current_period_end IS NULL THEN
                -- Missing period evidence: keep read-only; checkout requires reconciliation.
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
            ELSE
                -- At or after period end: raw active status is stale; entitlement is period_expired
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
                -- Missing period evidence: keep read-only; checkout requires reconciliation.
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
'Evaluates and returns the real-time billing entitlement and access mode (full, grace-period, or read-only) for an authorized company member at statement_timestamp(). Treats expired active subscriptions as read-only.';


-- 2. Update public.initialize_billing_checkout to allow recovery of expired
--    active and non_renewing subscriptions when authoritative paid-period has expired.
CREATE OR REPLACE FUNCTION public.initialize_billing_checkout(
    p_company_id pg_catalog.uuid,
    p_idempotency_key pg_catalog.uuid
)
RETURNS TABLE (
    payment_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_plan_mapping_id pg_catalog.uuid,
    provider_plan_code pg_catalog.text,
    provider pg_catalog.text,
    environment pg_catalog.text,
    purpose pg_catalog.text,
    provider_reference pg_catalog.text,
    amount_minor pg_catalog.int4,
    currency pg_catalog.varchar(3),
    customer_email pg_catalog.text,
    payment_status pg_catalog.text,
    checkout_url pg_catalog.text,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $initialize_billing_checkout$
DECLARE
    v_caller_id pg_catalog.uuid;
    v_caller_email pg_catalog.text;

    v_subscription public.billing_subscriptions%ROWTYPE;
    v_plan public.billing_plans%ROWTYPE;
    v_provider_plan public.billing_provider_plans%ROWTYPE;
    v_existing_provider_plan public.billing_provider_plans%ROWTYPE;

    v_existing_payment public.billing_payments%ROWTYPE;
    v_new_payment public.billing_payments%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;

    v_payment_id pg_catalog.uuid;
    v_purpose pg_catalog.text;
    v_now pg_catalog.timestamptz;
    v_provider_reference pg_catalog.text;
BEGIN
    -- 1. Require an authenticated caller.
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION
            'Authentication required to initialize billing checkout.'
            USING ERRCODE = '28000';
    END IF;

    -- 2. Validate required parameters.
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION
            'Company ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION
            'Idempotency key cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- 3. Verify company-scoped Billing access before exposing any payment data.
    IF public.verify_billing_access(p_company_id) IS NOT TRUE THEN
        RAISE EXCEPTION
            'Access denied. You do not have permission to manage billing for this company.'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Lock the company to serialize checkout initialization.
    PERFORM 1
    FROM public.companies AS company
    WHERE company.id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Company with ID % was not found.',
            p_company_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 5. Check idempotency before resolving current subscription state.
    --    A valid retry must still work after the subscription or plan changes.
    SELECT payment.*
    INTO v_existing_payment
    FROM public.billing_payments AS payment
    WHERE payment.idempotency_key = p_idempotency_key
    FOR SHARE;

    IF FOUND THEN
        IF v_existing_payment.company_id IS DISTINCT FROM p_company_id THEN
            RAISE EXCEPTION
                'Idempotency key is already assigned to another company.'
                USING ERRCODE = '23505';
        END IF;

        IF v_existing_payment.initiated_by_profile_id
            IS DISTINCT FROM v_caller_id
        THEN
            RAISE EXCEPTION
                'Idempotency key is already assigned to another caller.'
                USING ERRCODE = '23505';
        END IF;

        SELECT mapping.*
        INTO v_existing_provider_plan
        FROM public.billing_provider_plans AS mapping
        WHERE mapping.id = v_existing_payment.provider_plan_mapping_id;

        RETURN QUERY
        SELECT
            v_existing_payment.id,
            v_existing_payment.subscription_id,
            v_existing_payment.provider_plan_mapping_id,
            v_existing_provider_plan.provider_plan_code,
            v_existing_payment.provider,
            v_existing_payment.environment,
            v_existing_payment.purpose,
            v_existing_payment.provider_reference,
            v_existing_payment.amount_minor,
            v_existing_payment.currency,
            v_existing_payment.customer_email,
            v_existing_payment.status,
            v_existing_payment.checkout_url,
            TRUE;

        RETURN;
    END IF;

    -- 6. Require and resolve a confirmed caller email strictly from auth.users.
    --    public.profiles is not used as an email-verification fallback.
    SELECT
        pg_catalog.lower(
            pg_catalog.btrim(auth_user.email::pg_catalog.text)
        )
    INTO v_caller_email
    FROM auth.users AS auth_user
    WHERE auth_user.id = v_caller_id
      AND auth_user.email IS NOT NULL
      AND auth_user.email_confirmed_at IS NOT NULL;

    IF v_caller_email IS NULL
       OR v_caller_email = ''
       OR v_caller_email !~*
            '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    THEN
        RAISE EXCEPTION
            'A confirmed caller email address is required to initialize billing checkout.'
            USING ERRCODE = '22000';
    END IF;

    -- 7. Select and lock the current subscription deterministically.
    --    Prefer the single nonterminal subscription when one exists.
    SELECT subscription.*
    INTO v_subscription
    FROM public.billing_subscriptions AS subscription
    WHERE subscription.company_id = p_company_id
      AND subscription.status IN (
          'pending_activation',
          'trialing',
          'active',
          'non_renewing',
          'past_due'
      )
    ORDER BY
        subscription.created_at DESC,
        subscription.id DESC
    LIMIT 1
    FOR UPDATE;

    -- If no nonterminal subscription exists, use the latest terminal record.
    IF NOT FOUND THEN
        SELECT subscription.*
        INTO v_subscription
        FROM public.billing_subscriptions AS subscription
        WHERE subscription.company_id = p_company_id
          AND subscription.status IN (
              'expired',
              'cancelled'
          )
        ORDER BY
            subscription.created_at DESC,
            subscription.id DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_subscription.id IS NULL THEN
        RAISE EXCEPTION
            'No billing subscription was found for company %.',
            p_company_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Pending payments win over a new checkout or provider-retirement request.
    -- No payment row lock is needed here: the company lock serializes checkout
    -- creation. Avoid a subscription->payment lock inversion with success RPCs.
    IF EXISTS (
        SELECT 1
        FROM public.billing_payments AS payment
        WHERE payment.company_id = p_company_id
          AND payment.subscription_id = v_subscription.id
          AND payment.status IN ('initialized', 'pending')
    ) THEN
        RAISE EXCEPTION 'An active billing checkout session already exists for this subscription.'
            USING ERRCODE = '23505';
    END IF;

    -- 8. Validate subscription state and derive payment purpose.
    v_now := pg_catalog.statement_timestamp();

    IF v_subscription.status IN (
        'pending_activation',
        'trialing',
        'expired'
    ) THEN
        v_purpose := 'activation';

    ELSIF v_subscription.status = 'past_due' THEN
        v_purpose := 'renewal';

    ELSIF v_subscription.status IN ('active', 'non_renewing') THEN
        -- NULL is unknown, not evidence of an expired paid period. A trusted
        -- payment/invoice reconciliation must restore the projection first.
        IF v_subscription.current_period_end IS NULL THEN
            RAISE EXCEPTION 'PAID_PERIOD_RECONCILIATION_REQUIRED: The paid-period end is missing; reconcile verified payment evidence before a new charge.'
                USING ERRCODE = '23514';
        END IF;

        IF v_subscription.current_period_end > v_now THEN
            RAISE EXCEPTION
                'Billing checkout cannot be initialized for a subscription in "%" status with an active paid period.',
                v_subscription.status
                USING ERRCODE = '23514';
        END IF;

        v_purpose := 'renewal';

    ELSE
        RAISE EXCEPTION
            'Billing checkout cannot be initialized for a subscription in "%" status.',
            v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    -- 10. Fetch and validate the internal plan referenced by the subscription.
    SELECT plan.*
    INTO v_plan
    FROM public.billing_plans AS plan
    WHERE plan.id = v_subscription.plan_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Billing plan with ID % was not found.',
            v_subscription.plan_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_plan.is_active IS NOT TRUE THEN
        RAISE EXCEPTION
            'Billing plan "%" is currently inactive.',
            v_plan.code
            USING ERRCODE = '22023';
    END IF;

    -- 11. Require exactly one active Paystack mapping.
    BEGIN
        SELECT mapping.*
        INTO STRICT v_provider_plan
        FROM public.billing_provider_plans AS mapping
        WHERE mapping.plan_id = v_plan.id
          AND mapping.provider = 'paystack'
          AND mapping.is_active IS TRUE
        ORDER BY
            mapping.environment ASC,
            mapping.id ASC
        FOR SHARE;

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE EXCEPTION
                'No active Paystack mapping was found for plan "%".',
                v_plan.code
                USING ERRCODE = 'P0002';

        WHEN TOO_MANY_ROWS THEN
            RAISE EXCEPTION
                'Multiple active Paystack mappings were found for plan "%".',
                v_plan.code
                USING ERRCODE = '23505';
    END;

    -- 12. Validate commercial snapshot values strictly against internal plan.
    IF v_provider_plan.amount_minor
            IS DISTINCT FROM v_plan.amount_minor
       OR v_provider_plan.currency
            IS DISTINCT FROM v_plan.currency
       OR v_provider_plan.billing_interval
            IS DISTINCT FROM v_plan.billing_interval
    THEN
        RAISE EXCEPTION
            'Provider-plan commercial values do not match internal plan "%".',
            v_plan.code
            USING ERRCODE = '23514';
    END IF;

    -- 13. Check provider invoice/payment evidence in the selected environment.
    -- These are real billing tables, not a fixture or an assumed provider state.
    IF EXISTS (
        SELECT 1
        FROM public.billing_invoices AS invoice
        WHERE invoice.company_id = p_company_id
          AND invoice.subscription_id = v_subscription.id
          AND invoice.provider = 'paystack'
          AND invoice.environment = v_provider_plan.environment
          AND invoice.status = 'pending'
    ) THEN
        RAISE EXCEPTION 'PAYSTACK_INVOICE_RECONCILIATION_REQUIRED: An unresolved provider invoice must be reconciled before another checkout.'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.billing_invoices AS invoice
        WHERE invoice.company_id = p_company_id
          AND invoice.subscription_id = v_subscription.id
          AND invoice.provider = 'paystack'
          AND invoice.environment = v_provider_plan.environment
          AND invoice.status = 'paid'
          AND (v_subscription.current_period_end IS NULL
               OR invoice.period_end > v_subscription.current_period_end)
    ) OR EXISTS (
        SELECT 1
        FROM public.billing_payments AS payment
        WHERE payment.company_id = p_company_id
          AND payment.subscription_id = v_subscription.id
          AND payment.provider = 'paystack'
          AND payment.environment = v_provider_plan.environment
          AND payment.status = 'succeeded'
          AND (v_subscription.current_period_end IS NULL
               OR payment.paid_at >= v_subscription.current_period_end)
    ) THEN
        RAISE EXCEPTION 'PAID_PERIOD_RECONCILIATION_REQUIRED: Verified payment evidence is not reflected in the subscription period.'
            USING ERRCODE = '23514';
    END IF;

    -- Every unsettled provider record must be reconciled. A closed historical
    -- record cannot hide a different renewable record. Scope to the exact
    -- environment chosen above; never mix test and live records.
    -- This applies to activation too, so a stale expired label is no bypass.
    SELECT bps.*
    INTO v_provider_subscription
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.company_id = p_company_id
      AND bps.subscription_id = v_subscription.id
      AND bps.provider = 'paystack'
      AND bps.environment = v_provider_plan.environment
      AND (
          bps.provider_status NOT IN ('cancelled', 'completed')
          OR bps.is_current IS TRUE
          OR bps.disabled_at IS NULL
      )
    ORDER BY bps.is_current DESC, bps.created_at, bps.id
    LIMIT 1;

    IF FOUND THEN
        -- No provider UPDATE or provider row lock in checkout. Even a locally
        -- terminal but unclosed row goes through trusted reconciliation.
        -- Dates and the local consent flag cannot prove a charge is scheduled.
        RAISE EXCEPTION
            'PROVIDER_RECONCILIATION_REQUIRED: Provider subscription % requires authoritative status and invoice reconciliation before checkout.',
            v_provider_subscription.provider_subscription_code
            USING ERRCODE = '23514';
    END IF;

    -- 14. Generate a full-UUID payment ID and Paystack-compatible reference.
    v_payment_id := pg_catalog.gen_random_uuid();

    v_provider_reference :=
        'PAY-'
        || pg_catalog.to_char(
            v_now,
            'YYYYMMDD'
        )
        || '-'
        || pg_catalog.upper(
            pg_catalog.replace(
                v_payment_id::pg_catalog.text,
                '-',
                ''
            )
        );

    -- 15. Insert the initialized payment before any Paystack API call.
    INSERT INTO public.billing_payments (
        id,
        company_id,
        subscription_id,
        plan_id,
        provider_plan_mapping_id,
        provider,
        environment,
        purpose,
        idempotency_key,
        provider_reference,
        amount_minor,
        currency,
        customer_email,
        status,
        initiated_by_profile_id,
        created_at,
        updated_at
    )
    VALUES (
        v_payment_id,
        p_company_id,
        v_subscription.id,
        v_plan.id,
        v_provider_plan.id,
        v_provider_plan.provider,
        v_provider_plan.environment,
        v_purpose,
        p_idempotency_key,
        v_provider_reference,
        v_provider_plan.amount_minor,
        v_provider_plan.currency,
        v_caller_email,
        'initialized',
        v_caller_id,
        v_now,
        v_now
    )
    RETURNING * INTO v_new_payment;

    -- 16. Record immutable payment_initiated ledger event.
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
    )
    VALUES (
        p_company_id,
        v_subscription.id,
        'payment_initiated',
        'user',
        v_now,
        v_now,
        v_caller_id,
        'payment_initiated:' || v_payment_id::pg_catalog.text,
        jsonb_build_object(
            'payment_id', v_payment_id,
            'provider_reference', v_provider_reference,
            'provider', v_provider_plan.provider,
            'environment', v_provider_plan.environment,
            'purpose', v_purpose,
            'plan_id', v_plan.id,
            'plan_code', v_plan.code,
            'amount_minor', v_provider_plan.amount_minor,
            'currency', v_provider_plan.currency,
            'billing_interval', v_provider_plan.billing_interval,
            'provider_plan_mapping_id', v_provider_plan.id,
            'provider_plan_code', v_provider_plan.provider_plan_code,
            'prior_subscription_status', v_subscription.status
        )
    );

    -- 17. Return contract row to the caller.
    RETURN QUERY
    SELECT
        v_new_payment.id,
        v_new_payment.subscription_id,
        v_new_payment.provider_plan_mapping_id,
        v_provider_plan.provider_plan_code,
        v_new_payment.provider,
        v_new_payment.environment,
        v_new_payment.purpose,
        v_new_payment.provider_reference,
        v_new_payment.amount_minor,
        v_new_payment.currency,
        v_new_payment.customer_email,
        v_new_payment.status,
        v_new_payment.checkout_url,
        FALSE;

    RETURN;
END;
$initialize_billing_checkout$;

REVOKE ALL
ON FUNCTION public.initialize_billing_checkout(
    pg_catalog.uuid,
    pg_catalog.uuid
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.initialize_billing_checkout(
    pg_catalog.uuid,
    pg_catalog.uuid
)
TO authenticated;

COMMENT ON FUNCTION public.initialize_billing_checkout(
    pg_catalog.uuid,
    pg_catalog.uuid
) IS
'Atomically creates or returns an idempotent Paystack checkout intent for an authorized company billing member, supporting recovery of expired active or non_renewing subscriptions.';

-- ============================================================================
-- 3. Provider Subscription Reconciliation Support RPCs
-- ============================================================================

-- Server-only read helper. The legacy signature has no environment argument:
-- an exact code must resolve to ONE row across environments or the call fails.
-- The Edge Function must compare the returned environment with its server config.
CREATE OR REPLACE FUNCTION public.get_provider_subscription_for_reconciliation(
    p_company_id pg_catalog.uuid,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL
)
RETURNS TABLE (
    id pg_catalog.uuid,
    company_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    plan_id pg_catalog.uuid,
    provider pg_catalog.text,
    environment pg_catalog.text,
    provider_subscription_code pg_catalog.text,
    provider_subscription_id pg_catalog.text,
    provider_customer_code pg_catalog.text,
    email_token pg_catalog.text,
    customer_email pg_catalog.text,
    provider_status pg_catalog.text,
    next_payment_at pg_catalog.timestamptz,
    is_current pg_catalog.bool,
    disabled_at pg_catalog.timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $get_prov_sub$
DECLARE
    v_prov_sub public.billing_provider_subscriptions%ROWTYPE;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Only the billing service may read provider reconciliation data.'
            USING ERRCODE = '42501';
    END IF;

    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'p_company_id is required.' USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code IS NOT NULL
       AND p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$' THEN
        RAISE EXCEPTION 'Invalid provider subscription code.' USING ERRCODE = '22023';
    END IF;

    BEGIN
        SELECT bps.*
        INTO STRICT v_prov_sub
        FROM public.billing_provider_subscriptions AS bps
        WHERE bps.company_id = p_company_id
          AND bps.provider = 'paystack'
          AND bps.environment IN ('test', 'live')
          AND (
              (p_provider_subscription_code IS NOT NULL
               AND bps.provider_subscription_code = p_provider_subscription_code)
              OR (p_provider_subscription_code IS NULL
                  AND (bps.is_current IS TRUE
                       OR bps.provider_status NOT IN ('cancelled', 'completed')
                       OR bps.disabled_at IS NULL))
          );
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN;
        WHEN TOO_MANY_ROWS THEN
            RAISE EXCEPTION 'PROVIDER_SUBSCRIPTION_AMBIGUOUS: The provider record must be uniquely identified within the company and payment environment.'
                USING ERRCODE = '23505';
    END;

    RETURN QUERY SELECT
        v_prov_sub.id, v_prov_sub.company_id, v_prov_sub.subscription_id,
        v_prov_sub.plan_id, v_prov_sub.provider, v_prov_sub.environment,
        v_prov_sub.provider_subscription_code, v_prov_sub.provider_subscription_id,
        v_prov_sub.provider_customer_code, v_prov_sub.email_token,
        v_prov_sub.customer_email, v_prov_sub.provider_status,
        v_prov_sub.next_payment_at, v_prov_sub.is_current, v_prov_sub.disabled_at;
END;
$get_prov_sub$;

REVOKE ALL ON FUNCTION public.get_provider_subscription_for_reconciliation(pg_catalog.uuid, pg_catalog.text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_subscription_for_reconciliation(pg_catalog.uuid, pg_catalog.text)
    TO service_role;

COMMENT ON FUNCTION public.get_provider_subscription_for_reconciliation(pg_catalog.uuid, pg_catalog.text) IS
'Internal service-only provider read. Rejects ambiguous records across test/live; provider tokens must never be returned to the browser.';

-- Records an already verified terminal provider result. This function cannot
-- call Paystack: the trusted Edge caller must verify provider/customer/environment
-- identity and resolve open/most-recent invoices before calling it.
CREATE OR REPLACE FUNCTION public.reconcile_paystack_provider_subscription(
    p_company_id pg_catalog.uuid,
    p_provider_subscription_code pg_catalog.text,
    p_target_status pg_catalog.text,
    p_disabled_at pg_catalog.timestamptz DEFAULT NULL,
    p_reason pg_catalog.text DEFAULT NULL
)
RETURNS TABLE (
    provider_subscription_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_subscription_code pg_catalog.text,
    provider_status pg_catalog.text,
    is_current pg_catalog.bool,
    disabled_at pg_catalog.timestamptz,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $reconcile_sub$
DECLARE
    v_now pg_catalog.timestamptz := pg_catalog.statement_timestamp();
    v_prov_sub public.billing_provider_subscriptions%ROWTYPE;
    v_sub public.billing_subscriptions%ROWTYPE;
    v_disabled_at pg_catalog.timestamptz;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Only the billing service may reconcile provider state.'
            USING ERRCODE = '42501';
    END IF;
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'p_company_id is required.' USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code IS NULL
       OR p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$' THEN
        RAISE EXCEPTION 'Invalid provider subscription code.' USING ERRCODE = '22023';
    END IF;
    IF p_target_status IS NULL OR p_target_status NOT IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Target provider status must be completed or cancelled.'
            USING ERRCODE = '22023';
    END IF;
    IF p_disabled_at IS NOT NULL AND p_disabled_at > v_now THEN
        RAISE EXCEPTION 'A future date cannot establish confirmed provider closure.'
            USING ERRCODE = '22023';
    END IF;
    v_disabled_at := COALESCE(p_disabled_at, v_now);

    -- Serialize with checkout for this company. Provider->subscription below
    -- matches the existing provider-disable webhook; checkout never locks bps.
    PERFORM 1 FROM public.companies AS company
    WHERE company.id = p_company_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Company not found.' USING ERRCODE = 'P0002';
    END IF;

    BEGIN
        SELECT bps.*
        INTO STRICT v_prov_sub
        FROM public.billing_provider_subscriptions AS bps
        WHERE bps.company_id = p_company_id
          AND bps.provider = 'paystack'
          AND bps.environment IN ('test', 'live')
          AND bps.provider_subscription_code = p_provider_subscription_code
        FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE EXCEPTION 'Provider subscription not found in this company.'
                USING ERRCODE = 'P0002';
        WHEN TOO_MANY_ROWS THEN
            RAISE EXCEPTION 'PROVIDER_SUBSCRIPTION_AMBIGUOUS: The provider code is not unique across this company and its payment environments.'
                USING ERRCODE = '23505';
    END;

    SELECT bs.* INTO v_sub
    FROM public.billing_subscriptions AS bs
    WHERE bs.id = v_prov_sub.subscription_id
      AND bs.company_id = p_company_id
      AND bs.plan_id = v_prov_sub.plan_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked subscription does not match the provider record.'
            USING ERRCODE = '23514';
    END IF;

    -- Exact replay returns the established result without changing dates,
    -- customer consent, an active checkout, or the immutable ledger.
    IF v_prov_sub.is_current IS FALSE
       AND v_prov_sub.disabled_at IS NOT NULL
       AND v_prov_sub.provider_status IN ('cancelled', 'completed') THEN
        IF v_prov_sub.provider_status IS DISTINCT FROM p_target_status THEN
            RAISE EXCEPTION 'PROVIDER_TERMINAL_STATE_CONFLICT: The supplied result conflicts with the recorded terminal status.'
                USING ERRCODE = '23514';
        END IF;
        RETURN QUERY SELECT
            v_prov_sub.id, v_prov_sub.subscription_id,
            v_prov_sub.provider_subscription_code, v_prov_sub.provider_status,
            v_prov_sub.is_current, v_prov_sub.disabled_at, TRUE;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.billing_payments AS payment
        WHERE payment.company_id = p_company_id
          AND payment.subscription_id = v_prov_sub.subscription_id
          AND payment.status IN ('initialized', 'pending')
    ) THEN
        RAISE EXCEPTION 'An active checkout attempt must be reconciled before provider retirement.'
            USING ERRCODE = '23505';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.billing_invoices AS invoice
        WHERE invoice.company_id = p_company_id
          AND invoice.provider_subscription_record_id = v_prov_sub.id
          AND invoice.provider = v_prov_sub.provider
          AND invoice.environment = v_prov_sub.environment
          AND invoice.status = 'pending'
    ) THEN
        RAISE EXCEPTION 'PAYSTACK_INVOICE_RECONCILIATION_REQUIRED: Resolve the existing provider invoice before recording closure for recovery.'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.billing_provider_subscriptions AS bps
    SET is_current = FALSE,
        provider_status = p_target_status,
        disabled_at = v_disabled_at,
        last_synced_at = v_now,
        updated_at = v_now
    WHERE bps.id = v_prov_sub.id
      AND bps.company_id = p_company_id
      AND bps.provider = v_prov_sub.provider
      AND bps.environment = v_prov_sub.environment;

    -- Preserve the customer's stored auto-renewal choice. Provider lifecycle
    -- reconciliation is not a new opt-in or opt-out, nor a paid-period grant.
    INSERT INTO public.billing_ledger_events (
        company_id, subscription_id, event_type, event_source,
        occurred_at, recorded_at, deduplication_key, event_data
    ) VALUES (
        p_company_id, v_prov_sub.subscription_id,
        'provider_subscription.reconciled', 'reconciliation',
        v_disabled_at, v_now,
        'reconcile:paystack:' || v_prov_sub.environment || ':'
            || p_company_id::pg_catalog.text || ':'
            || v_prov_sub.id::pg_catalog.text || ':' || p_target_status,
        pg_catalog.jsonb_build_object(
            'provider', v_prov_sub.provider,
            'environment', v_prov_sub.environment,
            'provider_subscription_record_id', v_prov_sub.id,
            'provider_subscription_code', v_prov_sub.provider_subscription_code,
            'previous_status', v_prov_sub.provider_status,
            'reconciled_status', p_target_status,
            'disabled_at', v_disabled_at,
            'reason', COALESCE(NULLIF(pg_catalog.btrim(p_reason), ''),
                               'authoritative_paystack_reconciliation')
        )
    )
    ON CONFLICT (deduplication_key)
    WHERE deduplication_key IS NOT NULL
    DO NOTHING;

    RETURN QUERY SELECT
        v_prov_sub.id, v_prov_sub.subscription_id,
        v_prov_sub.provider_subscription_code, p_target_status,
        FALSE, v_disabled_at, FALSE;
END;
$reconcile_sub$;

REVOKE ALL ON FUNCTION public.reconcile_paystack_provider_subscription(pg_catalog.uuid, pg_catalog.text, pg_catalog.text, pg_catalog.timestamptz, pg_catalog.text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_paystack_provider_subscription(pg_catalog.uuid, pg_catalog.text, pg_catalog.text, pg_catalog.timestamptz, pg_catalog.text)
    TO service_role;

COMMENT ON FUNCTION public.reconcile_paystack_provider_subscription(pg_catalog.uuid, pg_catalog.text, pg_catalog.text, pg_catalog.timestamptz, pg_catalog.text) IS
'Service-only recording of a verified terminal provider result. Requires prior Edge verification of provider identity/environment and invoice resolution. Preserves consent and paid periods; rejects ambiguous provider codes.';

COMMIT;

