-- ============================================================================
-- ProjectMatrix Billing Phase 3A.2 — Step 2
-- Migration: 20260820000002_initialize_billing_checkout.sql
-- Description: Creates an atomic, idempotent checkout-intent RPC.
-- ============================================================================

BEGIN;

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
    v_active_payment public.billing_payments%ROWTYPE;
    v_new_payment public.billing_payments%ROWTYPE;

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
        WHERE mapping.id =
            v_existing_payment.provider_plan_mapping_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Provider-plan mapping for existing payment % was not found.',
                v_existing_payment.id
                USING ERRCODE = '23503';
        END IF;

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

    -- 6. Resolve the confirmed email from the authenticated identity.
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

    -- 8. Validate subscription state and derive payment purpose.
    IF v_subscription.status IN (
        'pending_activation',
        'trialing',
        'expired'
    ) THEN
        v_purpose := 'activation';

    ELSIF v_subscription.status = 'past_due' THEN
        v_purpose := 'renewal';

    ELSE
        RAISE EXCEPTION
            'Billing checkout cannot be initialized for a subscription in "%" status.',
            v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    -- 9. Reject a different logical attempt while another checkout is open.
    SELECT payment.*
    INTO v_active_payment
    FROM public.billing_payments AS payment
    WHERE payment.company_id = p_company_id
      AND payment.subscription_id = v_subscription.id
      AND payment.status IN (
          'initialized',
          'pending'
      )
    ORDER BY
        payment.created_at DESC,
        payment.id DESC
    LIMIT 1
    FOR SHARE;

    IF FOUND THEN
        RAISE EXCEPTION
            'A payment attempt (%) is already open for this subscription with reference %.',
            v_active_payment.status,
            v_active_payment.provider_reference
            USING ERRCODE = '23505';
    END IF;

    -- 10. Resolve and lock the internal plan.
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

    -- 12. Verify commercial snapshot alignment.
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

    -- 13. Generate a full-UUID payment ID and Paystack-compatible reference.
    v_now := pg_catalog.now();
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

    -- 14. Insert the initialized payment before any Paystack API call.
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
    RETURNING *
    INTO v_new_payment;

    -- 15. Append exactly one immutable linked ledger event.
    INSERT INTO public.billing_ledger_events (
        company_id,
        subscription_id,
        payment_id,
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
        v_new_payment.id,
        'payment_initiated',
        'user',
        v_now,
        v_now,
        v_caller_id,
        'payment_initiated:' || v_new_payment.id::pg_catalog.text,
        pg_catalog.jsonb_build_object(
            'payment_id',
            v_new_payment.id,
            'provider_reference',
            v_provider_reference,
            'provider',
            v_provider_plan.provider,
            'environment',
            v_provider_plan.environment,
            'purpose',
            v_purpose,
            'plan_code',
            v_plan.code,
            'amount_minor',
            v_provider_plan.amount_minor,
            'currency',
            v_provider_plan.currency,
            'provider_plan_code',
            v_provider_plan.provider_plan_code,
            'subscription_status_prior',
            v_subscription.status
        )
    );

    -- 16. Return only the fields required by the Edge Function.
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
'Atomically creates or returns an idempotent Paystack checkout intent for an authorized company billing member.';

COMMIT;