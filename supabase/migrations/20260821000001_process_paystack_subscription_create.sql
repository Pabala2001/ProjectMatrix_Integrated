-- ============================================================================
-- Migration: 20260821000001_process_paystack_subscription_create.sql
-- Description: Creates the atomic public.process_paystack_subscription_create RPC
--              for linking verified Paystack subscription.create webhook events
--              to internal subscription, payment and payment method records.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_paystack_subscription_create(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_id pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_id pg_catalog.text DEFAULT NULL,
    p_customer_email pg_catalog.text DEFAULT NULL,
    p_provider_plan_code pg_catalog.text DEFAULT NULL,
    p_amount_minor pg_catalog.int4 DEFAULT NULL,
    p_currency pg_catalog.text DEFAULT NULL,
    p_authorization_code pg_catalog.text DEFAULT NULL,
    p_authorization_signature pg_catalog.text DEFAULT NULL,
    p_email_token pg_catalog.text DEFAULT NULL,
    p_provider_status pg_catalog.text DEFAULT NULL,
    p_next_payment_at pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    payment_id pg_catalog.uuid,
    provider_subscription_code pg_catalog.text,
    provider_status pg_catalog.text,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_subscription_create$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_subscription_code pg_catalog.text;
    v_provider_subscription_id pg_catalog.text;
    v_provider_customer_code pg_catalog.text;
    v_provider_customer_id pg_catalog.text;
    v_normalized_email pg_catalog.text;
    v_provider_plan_code pg_catalog.text;
    v_currency pg_catalog.text;
    v_authorization_code pg_catalog.text;
    v_authorization_signature pg_catalog.text;
    v_email_token pg_catalog.text;
    v_provider_status pg_catalog.text;
    v_provider_event_id pg_catalog.text;

    v_existing_prov_sub public.billing_provider_subscriptions%ROWTYPE;
    v_existing_current_sub public.billing_provider_subscriptions%ROWTYPE;
    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_prov_plan public.billing_provider_plans%ROWTYPE;
    v_pm public.billing_payment_methods%ROWTYPE;

    v_match_count pg_catalog.int4 := 0;
    v_match_record RECORD;
    v_payment_method_id pg_catalog.uuid;
    v_company_id pg_catalog.uuid;
    v_payment_id pg_catalog.uuid;
    v_subscription_id pg_catalog.uuid;
    v_plan_id pg_catalog.uuid;
    v_provider_plan_mapping_id pg_catalog.uuid;

    v_subscription public.billing_subscriptions%ROWTYPE;
    v_payment public.billing_payments%ROWTYPE;
    v_payment_method public.billing_payment_methods%ROWTYPE;

    v_new_provider_subscription_id pg_catalog.uuid;
    v_webhook_event_id pg_catalog.uuid;
    v_ledger_dedup_key pg_catalog.text;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL OR p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 lowercase hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := p_payload_sha256;

    IF p_provider_subscription_code IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_subscription_code)) = 0
       OR p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_subscription_code := pg_catalog.btrim(p_provider_subscription_code);

    IF p_provider_subscription_id IS NOT NULL THEN
        IF pg_catalog.char_length(pg_catalog.btrim(p_provider_subscription_id)) = 0
           OR p_provider_subscription_id !~ '^[0-9]+$'
        THEN
            RAISE EXCEPTION 'Invalid provider subscription ID "%". Must be decimal digits string.', p_provider_subscription_id
                USING ERRCODE = '22023';
        END IF;
        v_provider_subscription_id := pg_catalog.btrim(p_provider_subscription_id);
    ELSE
        v_provider_subscription_id := NULL;
    END IF;

    IF p_provider_customer_code IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_customer_code)) = 0
       OR p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_customer_code := pg_catalog.btrim(p_provider_customer_code);

    IF p_provider_customer_id IS NOT NULL THEN
        IF pg_catalog.char_length(pg_catalog.btrim(p_provider_customer_id)) = 0
           OR p_provider_customer_id !~ '^[0-9]+$'
        THEN
            RAISE EXCEPTION 'Invalid provider customer ID "%". Must be decimal digits string.', p_provider_customer_id
                USING ERRCODE = '22023';
        END IF;
        v_provider_customer_id := pg_catalog.btrim(p_provider_customer_id);
    ELSE
        v_provider_customer_id := NULL;
    END IF;

    IF p_customer_email IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_customer_email)) = 0
       OR p_customer_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    THEN
        RAISE EXCEPTION 'Invalid customer email format.'
            USING ERRCODE = '22023';
    END IF;
    v_normalized_email := pg_catalog.lower(pg_catalog.btrim(p_customer_email));

    IF p_provider_plan_code IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_plan_code)) = 0
       OR p_provider_plan_code !~ '^PLN_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid provider plan code format "%".', p_provider_plan_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_plan_code := pg_catalog.btrim(p_provider_plan_code);

    IF p_amount_minor IS NULL OR p_amount_minor <= 0 OR p_amount_minor > 2147483647 THEN
        RAISE EXCEPTION 'Invalid amount % minor units.', p_amount_minor
            USING ERRCODE = '22023';
    END IF;

    IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Invalid currency "%". Must be 3 uppercase letters.', p_currency
            USING ERRCODE = '22023';
    END IF;
    v_currency := p_currency;

    IF p_authorization_code IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_authorization_code)) = 0
       OR p_authorization_code !~ '^AUTH_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid authorization code format.'
            USING ERRCODE = '22023';
    END IF;
    v_authorization_code := pg_catalog.btrim(p_authorization_code);

    IF p_authorization_signature IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_authorization_signature)) = 0
       OR p_authorization_signature !~ '^SIG_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid authorization signature format.'
            USING ERRCODE = '22023';
    END IF;
    v_authorization_signature := pg_catalog.btrim(p_authorization_signature);

    IF p_email_token IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_email_token)) = 0
    THEN
        RAISE EXCEPTION 'Email token must not be empty.'
            USING ERRCODE = '22023';
    END IF;
    v_email_token := pg_catalog.btrim(p_email_token);

    IF p_provider_status IS NULL OR pg_catalog.btrim(p_provider_status) <> 'active' THEN
        RAISE EXCEPTION 'Invalid provider status "%". Must be "active".', p_provider_status
            USING ERRCODE = '22023';
    END IF;
    v_provider_status := pg_catalog.btrim(p_provider_status);

    IF p_next_payment_at IS NULL THEN
        RAISE EXCEPTION 'p_next_payment_at timestamp is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_event_id IS NOT NULL THEN
        IF pg_catalog.char_length(pg_catalog.btrim(p_provider_event_id)) = 0 THEN
            RAISE EXCEPTION 'p_provider_event_id must not be empty when provided.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_event_id := pg_catalog.btrim(p_provider_event_id);
    ELSE
        v_provider_event_id := NULL;
    END IF;

    -- 2. Check for Exact Replay of Existing Provider Subscription
    SELECT *
    INTO v_existing_prov_sub
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.provider_subscription_code = v_provider_subscription_code
    FOR UPDATE;

    IF FOUND THEN
        -- Verify that all immutable identity and commercial fields match exactly
        IF v_existing_prov_sub.provider_customer_code <> v_provider_customer_code
           OR pg_catalog.lower(pg_catalog.btrim(v_existing_prov_sub.customer_email)) <> v_normalized_email
           OR v_existing_prov_sub.email_token <> v_email_token
           OR (v_provider_subscription_id IS NOT NULL AND v_existing_prov_sub.provider_subscription_id IS NOT NULL AND v_existing_prov_sub.provider_subscription_id <> v_provider_subscription_id)
           OR (v_provider_customer_id IS NOT NULL AND v_existing_prov_sub.provider_customer_id IS NOT NULL AND v_existing_prov_sub.provider_customer_id <> v_provider_customer_id)
        THEN
            RAISE EXCEPTION 'Conflicting reuse for provider subscription code %.', v_provider_subscription_code
                USING ERRCODE = '23505';
        END IF;

        -- Verify linked provider plan commercial snapshot
        SELECT *
        INTO v_prov_plan
        FROM public.billing_provider_plans AS bpp
        WHERE bpp.id = v_existing_prov_sub.provider_plan_mapping_id;

        IF NOT FOUND
           OR v_prov_plan.provider_plan_code <> v_provider_plan_code
           OR v_prov_plan.amount_minor <> p_amount_minor
           OR v_prov_plan.currency <> v_currency
        THEN
            RAISE EXCEPTION 'Conflicting commercial snapshot for provider subscription %.', v_provider_subscription_code
                USING ERRCODE = '23505';
        END IF;

        -- Verify linked payment method authorization details
        SELECT *
        INTO v_pm
        FROM public.billing_payment_methods AS bpm
        WHERE bpm.id = v_existing_prov_sub.payment_method_id;

        IF NOT FOUND
           OR v_pm.authorization_code <> v_authorization_code
           OR v_pm.authorization_signature <> v_authorization_signature
        THEN
            RAISE EXCEPTION 'Conflicting payment method for provider subscription %.', v_provider_subscription_code
                USING ERRCODE = '23505';
        END IF;

        -- Deduplicate webhook event inbox
        SELECT *
        INTO v_existing_webhook
        FROM public.billing_webhook_events AS bwe
        WHERE bwe.provider = 'paystack'
          AND bwe.environment = v_environment
          AND (
              bwe.payload_sha256 = v_payload_sha256
              OR (v_provider_event_id IS NOT NULL AND bwe.provider_event_id = v_provider_event_id)
          )
        FOR UPDATE;

        IF FOUND THEN
            IF v_existing_webhook.event_type <> 'subscription.create'
               OR v_existing_webhook.provider_object_id <> v_provider_subscription_code
               OR (v_provider_event_id IS NOT NULL AND v_existing_webhook.provider_event_id IS NOT NULL AND v_existing_webhook.provider_event_id <> v_provider_event_id)
               OR v_existing_webhook.payload_sha256 <> v_payload_sha256
            THEN
                RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_webhook.processing_status <> 'processed' THEN
                UPDATE public.billing_webhook_events AS bwe_upd
                SET processing_status = 'processed',
                    processed_at = v_now,
                    updated_at = v_now
                WHERE bwe_upd.id = v_existing_webhook.id;
            END IF;
        ELSE
            INSERT INTO public.billing_webhook_events (
                provider,
                environment,
                event_type,
                provider_event_id,
                provider_object_id,
                payload_sha256,
                raw_payload,
                signature_verified,
                processing_status,
                processing_attempts,
                received_at,
                processing_started_at,
                processed_at,
                updated_at
            ) VALUES (
                'paystack',
                v_environment,
                'subscription.create',
                v_provider_event_id,
                v_provider_subscription_code,
                v_payload_sha256,
                pg_catalog.jsonb_build_object(
                    'provider', 'paystack',
                    'environment', v_environment,
                    'event_type', 'subscription.create',
                    'provider_subscription_code', v_provider_subscription_code,
                    'provider_subscription_id', v_provider_subscription_id,
                    'provider_customer_code', v_provider_customer_code,
                    'provider_customer_id', v_provider_customer_id,
                    'provider_plan_code', v_provider_plan_code,
                    'amount_minor', p_amount_minor,
                    'currency', v_currency,
                    'provider_status', v_provider_status,
                    'next_payment_at', p_next_payment_at
                ),
                TRUE,
                'processed',
                1,
                p_occurred_at,
                v_now,
                v_now,
                v_now
            );
        END IF;

        -- Return existing provider subscription record safely
        RETURN QUERY
        SELECT
            v_existing_prov_sub.id,
            v_existing_prov_sub.subscription_id,
            v_pm.source_payment_id,
            v_existing_prov_sub.provider_subscription_code,
            v_existing_prov_sub.provider_status,
            TRUE AS is_reused;
        RETURN;
    END IF;

    -- 3. Check for Webhook Hash / Event-ID Collision Prior to Insert
    SELECT *
    INTO v_existing_webhook
    FROM public.billing_webhook_events AS bwe
    WHERE bwe.provider = 'paystack'
      AND bwe.environment = v_environment
      AND (
          bwe.payload_sha256 = v_payload_sha256
          OR (v_provider_event_id IS NOT NULL AND bwe.provider_event_id = v_provider_event_id)
      )
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_webhook.event_type <> 'subscription.create'
           OR v_existing_webhook.provider_object_id <> v_provider_subscription_code
           OR (v_provider_event_id IS NOT NULL AND v_existing_webhook.provider_event_id IS NOT NULL AND v_existing_webhook.provider_event_id <> v_provider_event_id)
           OR v_existing_webhook.payload_sha256 <> v_payload_sha256
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        IF v_existing_webhook.processing_status = 'processed' THEN
            RAISE EXCEPTION 'Webhook event already processed but provider subscription not found.'
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 4. Secure Internal Resolution: Resolve 5-Table Relationship
    FOR v_match_record IN
        SELECT
            pm.id AS payment_method_id,
            pm.company_id AS company_id,
            pm.source_payment_id AS payment_id,
            p.subscription_id AS subscription_id,
            p.plan_id AS plan_id,
            pp.id AS provider_plan_mapping_id
        FROM public.billing_payment_methods AS pm
        JOIN public.billing_payments AS p
            ON p.id = pm.source_payment_id
           AND p.company_id = pm.company_id
           AND p.provider = pm.provider
           AND p.environment = pm.environment
        JOIN public.billing_provider_plans AS pp
            ON pp.id = p.provider_plan_mapping_id
           AND pp.plan_id = p.plan_id
           AND pp.provider = p.provider
           AND pp.environment = p.environment
        JOIN public.billing_subscriptions AS s
            ON s.id = p.subscription_id
           AND s.company_id = p.company_id
           AND s.plan_id = p.plan_id
        WHERE pm.provider = 'paystack'
          AND pm.environment = v_environment
          AND pm.provider_customer_code = v_provider_customer_code
          AND pg_catalog.lower(pg_catalog.btrim(pm.customer_email)) = v_normalized_email
          AND pm.authorization_code = v_authorization_code
          AND pm.authorization_signature = v_authorization_signature
          AND pm.is_active IS TRUE
          AND pm.reusable IS TRUE
          AND p.status = 'succeeded'
          AND p.purpose = 'activation'
          AND pg_catalog.lower(pg_catalog.btrim(p.customer_email)) = v_normalized_email
          AND p.amount_minor = p_amount_minor
          AND p.currency = v_currency
          AND pp.provider_plan_code = v_provider_plan_code
          AND pp.amount_minor = p_amount_minor
          AND pp.currency = v_currency
          AND pp.is_active IS TRUE
        LIMIT 2
    LOOP
        v_match_count := v_match_count + 1;
        v_payment_method_id := v_match_record.payment_method_id;
        v_company_id := v_match_record.company_id;
        v_payment_id := v_match_record.payment_id;
        v_subscription_id := v_match_record.subscription_id;
        v_plan_id := v_match_record.plan_id;
        v_provider_plan_mapping_id := v_match_record.provider_plan_mapping_id;
    END LOOP;

    IF v_match_count = 0 THEN
        RAISE EXCEPTION 'No matching successful activation payment method found for provider subscription in % environment.', v_environment
            USING ERRCODE = 'P0002';
    ELSIF v_match_count > 1 THEN
        RAISE EXCEPTION 'Ambiguous matching relationships (% matches) found for provider subscription.', v_match_count
            USING ERRCODE = '23505';
    END IF;

    -- 5. Lock Resolved Subscription, Payment and Payment Method
    SELECT *
    INTO v_subscription
    FROM public.billing_subscriptions AS s
    WHERE s.id = v_subscription_id
      AND s.company_id = v_company_id
    FOR UPDATE;

    SELECT *
    INTO v_payment
    FROM public.billing_payments AS p
    WHERE p.id = v_payment_id
      AND p.company_id = v_company_id
    FOR UPDATE;

    SELECT *
    INTO v_payment_method
    FROM public.billing_payment_methods AS pm
    WHERE pm.id = v_payment_method_id
      AND pm.company_id = v_company_id
    FOR UPDATE;

    -- 6. Verify No Conflicting Active Provider Subscription Already Exists
    SELECT *
    INTO v_existing_current_sub
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.subscription_id = v_subscription.id
      AND bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.is_current IS TRUE
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_current_sub.provider_subscription_code <> v_provider_subscription_code THEN
            RAISE EXCEPTION 'A different active provider subscription "%" already exists for subscription %.',
                v_existing_current_sub.provider_subscription_code, v_subscription.id
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 7. Insert Immutable Provider Subscription Row
    INSERT INTO public.billing_provider_subscriptions (
        company_id,
        subscription_id,
        plan_id,
        provider_plan_mapping_id,
        provider,
        environment,
        provider_subscription_code,
        provider_subscription_id,
        provider_customer_code,
        provider_customer_id,
        email_token,
        customer_email,
        provider_status,
        next_payment_at,
        is_current,
        payment_method_id,
        last_synced_at,
        created_at,
        updated_at
    ) VALUES (
        v_subscription.company_id,
        v_subscription.id,
        v_subscription.plan_id,
        v_provider_plan_mapping_id,
        'paystack',
        v_environment,
        v_provider_subscription_code,
        v_provider_subscription_id,
        v_provider_customer_code,
        v_provider_customer_id,
        v_email_token,
        v_normalized_email,
        v_provider_status,
        p_next_payment_at,
        TRUE,
        v_payment_method.id,
        v_now,
        v_now,
        v_now
    )
    RETURNING id INTO v_new_provider_subscription_id;

    -- 8. Record / Update Webhook Event in Inbox
    IF v_existing_webhook.id IS NOT NULL THEN
        UPDATE public.billing_webhook_events AS bwe_upd
        SET processing_status = 'processed',
            processed_at = v_now,
            processing_attempts = processing_attempts + 1,
            updated_at = v_now
        WHERE bwe_upd.id = v_existing_webhook.id;
        v_webhook_event_id := v_existing_webhook.id;
    ELSE
        INSERT INTO public.billing_webhook_events (
            provider,
            environment,
            event_type,
            provider_event_id,
            provider_object_id,
            payload_sha256,
            raw_payload,
            signature_verified,
            processing_status,
            processing_attempts,
            received_at,
            processing_started_at,
            processed_at,
            updated_at
        ) VALUES (
            'paystack',
            v_environment,
            'subscription.create',
            v_provider_event_id,
            v_provider_subscription_code,
            v_payload_sha256,
            pg_catalog.jsonb_build_object(
                'provider', 'paystack',
                'environment', v_environment,
                'event_type', 'subscription.create',
                'provider_subscription_code', v_provider_subscription_code,
                'provider_subscription_id', v_provider_subscription_id,
                'provider_customer_code', v_provider_customer_code,
                'provider_customer_id', v_provider_customer_id,
                'provider_plan_code', v_provider_plan_code,
                'amount_minor', p_amount_minor,
                'currency', v_currency,
                'provider_status', v_provider_status,
                'next_payment_at', p_next_payment_at
            ),
            TRUE,
            'processed',
            1,
            p_occurred_at,
            v_now,
            v_now,
            v_now
        )
        RETURNING id INTO v_webhook_event_id;
    END IF;

    -- 9. Append Immutable Ledger Entry
    v_ledger_dedup_key := 'provider_subscription_linked:paystack:' || v_environment || ':' || v_subscription.id::pg_catalog.text || ':' || v_provider_subscription_code;

    IF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
          AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
          AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
          AND event.event_type = 'provider_subscription_linked'
          AND event.event_source = 'paystack_webhook'
    ) THEN
        NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
    ) THEN
        RAISE EXCEPTION 'Ledger deduplication key collision for subscription %.', v_subscription.id
            USING ERRCODE = '23505';
    ELSE
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
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            v_payment.id,
            'provider_subscription_linked',
            'paystack_webhook',
            p_occurred_at,
            v_now,
            NULL,
            v_ledger_dedup_key,
            pg_catalog.jsonb_build_object(
                'subscription_id', v_subscription.id,
                'payment_id', v_payment.id,
                'company_id', v_subscription.company_id,
                'plan_id', v_subscription.plan_id,
                'provider', 'paystack',
                'environment', v_environment,
                'provider_subscription_code', v_provider_subscription_code,
                'provider_subscription_id', v_provider_subscription_id,
                'provider_customer_code', v_provider_customer_code,
                'provider_customer_id', v_provider_customer_id,
                'provider_plan_code', v_provider_plan_code,
                'amount_minor', p_amount_minor,
                'currency', v_currency,
                'provider_status', v_provider_status,
                'next_payment_at', p_next_payment_at,
                'linked_payment_method_id', v_payment_method.id
            )
        );
    END IF;

    -- 10. Return Strict Safe Return Contract
    RETURN QUERY
    SELECT
        v_new_provider_subscription_id,
        v_subscription.id,
        v_payment.id,
        v_provider_subscription_code,
        v_provider_status,
        FALSE AS is_reused;

    RETURN;
END;
$process_paystack_subscription_create$;

REVOKE ALL
ON FUNCTION public.process_paystack_subscription_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_subscription_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_subscription_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified Paystack subscription.create webhook event, linking provider subscription state without extending billing periods.';

COMMIT;
