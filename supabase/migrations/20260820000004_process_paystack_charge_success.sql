-- ============================================================================
-- Migration: 20260820000004_process_paystack_charge_success.sql
-- Description: Creates the atomic public.process_paystack_charge_success RPC
--              for finalizing verified Paystack charge.success webhook events.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_paystack_charge_success(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_reference pg_catalog.text,
    p_provider_transaction_id pg_catalog.text,
    p_amount_minor pg_catalog.int4,
    p_currency pg_catalog.text,
    p_paid_at pg_catalog.timestamptz,
    p_provider_plan_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_customer_email pg_catalog.text DEFAULT NULL,
    p_authorization_code pg_catalog.text DEFAULT NULL,
    p_card_type pg_catalog.text DEFAULT NULL,
    p_last4 pg_catalog.text DEFAULT NULL,
    p_exp_month pg_catalog.text DEFAULT NULL,
    p_exp_year pg_catalog.text DEFAULT NULL,
    p_bank pg_catalog.text DEFAULT NULL,
    p_channel pg_catalog.text DEFAULT NULL,
    p_reusable pg_catalog.bool DEFAULT FALSE
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    payment_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    payment_status pg_catalog.text,
    subscription_status pg_catalog.text,
    payment_method_id pg_catalog.uuid,
    processing_status pg_catalog.text,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_charge_success$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_reference pg_catalog.text;
    v_provider_transaction_id pg_catalog.text;
    v_currency pg_catalog.text;
    v_reusable pg_catalog.bool;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_webhook_event_id pg_catalog.uuid;
    v_is_reused pg_catalog.bool := FALSE;

    v_payment public.billing_payments%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;
    v_provider_plan public.billing_provider_plans%ROWTYPE;

    v_period_start pg_catalog.timestamptz;
    v_period_end pg_catalog.timestamptz;
    v_next_renewal pg_catalog.timestamptz;
    v_final_subscription_status pg_catalog.text;

    v_payment_method_id pg_catalog.uuid := NULL;
    v_existing_pm public.billing_payment_methods%ROWTYPE;

    v_payment_ledger_key pg_catalog.text;
    v_subscription_ledger_key pg_catalog.text;
    v_exp_month_int pg_catalog.int2;
    v_exp_year_int pg_catalog.int2;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL OR p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-fA-F]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := pg_catalog.lower(p_payload_sha256);

    IF p_provider_reference IS NULL OR p_provider_reference !~ '^PAY-[0-9]{8}-[0-9A-F]{32}$' THEN
        RAISE EXCEPTION 'Invalid provider reference format "%".', p_provider_reference
            USING ERRCODE = '22023';
    END IF;
    v_provider_reference := p_provider_reference;

    IF p_provider_transaction_id IS NULL OR p_provider_transaction_id !~ '^[0-9]{1,20}$' THEN
        RAISE EXCEPTION 'Invalid provider transaction ID "%".', p_provider_transaction_id
            USING ERRCODE = '22023';
    END IF;

    IF pg_catalog.char_length(p_provider_transaction_id) = 20 AND p_provider_transaction_id > '18446744073709551615' THEN
        RAISE EXCEPTION 'Provider transaction ID "%" exceeds unsigned 64-bit integer limit.', p_provider_transaction_id
            USING ERRCODE = '22023';
    END IF;
    v_provider_transaction_id := p_provider_transaction_id;

    IF p_amount_minor IS NULL OR p_amount_minor <= 0 OR p_amount_minor > 2147483647 THEN
        RAISE EXCEPTION 'Invalid amount % minor units.', p_amount_minor
            USING ERRCODE = '22023';
    END IF;

    IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Invalid currency "%". Must be 3 uppercase letters.', p_currency
            USING ERRCODE = '22023';
    END IF;
    v_currency := p_currency;

    IF p_paid_at IS NULL THEN
        RAISE EXCEPTION 'p_paid_at timestamp is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_plan_code IS NOT NULL AND (
        p_provider_plan_code ~ '[[:cntrl:][:space:]]' OR p_provider_plan_code !~ '^PLN_[A-Za-z0-9]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid provider plan code format "%".', p_provider_plan_code
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_customer_code IS NOT NULL AND (
        p_provider_customer_code ~ '[[:cntrl:][:space:]]' OR p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;

    IF p_customer_email IS NOT NULL AND (
        p_customer_email ~ '[[:cntrl:][:space:]]' OR p_customer_email !~ '^[^@]+@[^@]+\.[^@]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid customer email.'
            USING ERRCODE = '22023';
    END IF;

    IF p_authorization_code IS NOT NULL AND (
        p_authorization_code ~ '[[:cntrl:][:space:]]' OR p_authorization_code !~ '^AUTH_[A-Za-z0-9]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid authorization code format.'
            USING ERRCODE = '22023';
    END IF;

    IF p_last4 IS NOT NULL AND p_last4 !~ '^[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid last4 digits.'
            USING ERRCODE = '22023';
    END IF;

    IF p_exp_month IS NOT NULL AND p_exp_month !~ '^(0[1-9]|1[0-2]|[1-9])$' THEN
        RAISE EXCEPTION 'Invalid expiry month.'
            USING ERRCODE = '22023';
    END IF;

    IF p_exp_year IS NOT NULL AND p_exp_year !~ '^(20[2-9][0-9]|[0-9]{2})$' THEN
        RAISE EXCEPTION 'Invalid expiry year.'
            USING ERRCODE = '22023';
    END IF;

    v_reusable := COALESCE(p_reusable, FALSE);

    -- 2. Webhook Inbox Lookup & Locking (Deterministic Order)
    SELECT *
    INTO v_existing_webhook
    FROM public.billing_webhook_events
    WHERE provider = 'paystack'
      AND environment = v_environment
      AND payload_sha256 = v_payload_sha256
    FOR UPDATE;

    IF FOUND THEN
        -- Check for payload hash collision with conflicting identifiers
        IF v_existing_webhook.event_type <> 'charge.success'
           OR (v_existing_webhook.raw_payload->>'provider_reference') IS DISTINCT FROM v_provider_reference
           OR (v_existing_webhook.raw_payload->>'provider_transaction_id') IS DISTINCT FROM v_provider_transaction_id
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        v_webhook_event_id := v_existing_webhook.id;
        IF v_existing_webhook.processing_status = 'processed' THEN
            v_is_reused := TRUE;
        ELSE
            UPDATE public.billing_webhook_events
            SET processing_status = 'processing',
                processing_attempts = processing_attempts + 1,
                updated_at = v_now
            WHERE id = v_webhook_event_id;
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
            updated_at
        ) VALUES (
            'paystack',
            v_environment,
            'charge.success',
            'txn_' || v_provider_transaction_id,
            v_provider_reference,
            v_payload_sha256,
            pg_catalog.jsonb_build_object(
                'event_type', 'charge.success',
                'provider_reference', v_provider_reference,
                'provider_transaction_id', v_provider_transaction_id
            ),
            TRUE,
            'processing',
            1,
            v_now,
            v_now,
            v_now
        )
        RETURNING id INTO v_webhook_event_id;
    END IF;

    -- 3. Lock & Correlate Authoritative Payment Record
    SELECT *
    INTO v_payment
    FROM public.billing_payments
    WHERE provider = 'paystack'
      AND environment = v_environment
      AND provider_reference = v_provider_reference
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment with provider reference "%" not found in % environment.',
            v_provider_reference, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    -- 4. Lock Matched Subscription
    SELECT *
    INTO v_subscription
    FROM public.billing_subscriptions
    WHERE id = v_payment.subscription_id
      AND company_id = v_payment.company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription % not found for payment %.',
            v_payment.subscription_id, v_payment.id
            USING ERRCODE = 'P0002';
    END IF;

    -- 5. Commercial Verification Against Database Snapshot
    IF v_payment.amount_minor <> p_amount_minor THEN
        RAISE EXCEPTION 'Commercial mismatch: amount % does not match expected payment amount %.',
            p_amount_minor, v_payment.amount_minor
            USING ERRCODE = '23514';
    END IF;

    IF v_payment.currency <> v_currency THEN
        RAISE EXCEPTION 'Commercial mismatch: currency % does not match expected payment currency %.',
            v_currency, v_payment.currency
            USING ERRCODE = '23514';
    END IF;

    IF p_customer_email IS NOT NULL AND
       pg_catalog.lower(pg_catalog.btrim(p_customer_email)) <> pg_catalog.lower(pg_catalog.btrim(v_payment.customer_email))
    THEN
        RAISE EXCEPTION 'Commercial mismatch: customer email does not match payment scope.'
            USING ERRCODE = '23514';
    END IF;

    -- Verify Provider Plan Mapping
    SELECT *
    INTO v_provider_plan
    FROM public.billing_provider_plans
    WHERE id = v_payment.provider_plan_mapping_id
      AND plan_id = v_payment.plan_id
      AND provider = 'paystack'
      AND environment = v_environment;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider plan mapping % not found for payment %.',
            v_payment.provider_plan_mapping_id, v_payment.id
            USING ERRCODE = 'P0002';
    END IF;

    IF p_provider_plan_code IS NOT NULL AND v_provider_plan.provider_plan_code IS DISTINCT FROM p_provider_plan_code THEN
        RAISE EXCEPTION 'Provider plan code "%" does not match mapping "%".',
            p_provider_plan_code, v_provider_plan.provider_plan_code
            USING ERRCODE = '23514';
    END IF;

    -- 6. Payment State Handling
    IF v_payment.status = 'succeeded' THEN
        -- If already succeeded, treat as replay
        v_is_reused := TRUE;
    ELSE
        -- Update payment to succeeded
        UPDATE public.billing_payments
        SET status = 'succeeded',
            provider_transaction_id = v_provider_transaction_id,
            paid_at = p_paid_at,
            failed_at = NULL,
            cancelled_at = NULL,
            error_code = NULL,
            error_message = NULL,
            updated_at = v_now
        WHERE id = v_payment.id;
    END IF;

    -- 7. Subscription Transition
    v_final_subscription_status := v_subscription.status;

    IF v_payment.purpose = 'activation' THEN
        IF v_payment.status <> 'succeeded' OR v_subscription.status IN ('pending_activation', 'trialing', 'expired') THEN
            v_period_start := p_paid_at;
            v_period_end := p_paid_at + INTERVAL '1 month';
            v_next_renewal := v_period_end;
            v_final_subscription_status := 'active';

            UPDATE public.billing_subscriptions
            SET status = 'active',
                current_period_start = v_period_start,
                current_period_end = v_period_end,
                next_renewal_at = v_next_renewal,
                auto_renew_enabled = TRUE,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
    ELSIF v_payment.purpose = 'renewal' THEN
        IF v_payment.status <> 'succeeded' OR v_subscription.status IN ('past_due', 'non_renewing', 'active', 'expired') THEN
            IF v_subscription.current_period_end IS NOT NULL AND v_subscription.current_period_end > p_paid_at THEN
                v_period_start := v_subscription.current_period_end;
                v_period_end := v_subscription.current_period_end + INTERVAL '1 month';
            ELSE
                v_period_start := p_paid_at;
                v_period_end := p_paid_at + INTERVAL '1 month';
            END IF;
            v_next_renewal := v_period_end;
            v_final_subscription_status := 'active';

            UPDATE public.billing_subscriptions
            SET status = 'active',
                current_period_start = v_period_start,
                current_period_end = v_period_end,
                next_renewal_at = v_next_renewal,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unrecognized payment purpose "%".', v_payment.purpose
            USING ERRCODE = '23514';
    END IF;

    -- 8. Payment Method Handling
    IF v_reusable AND p_authorization_code IS NOT NULL AND pg_catalog.char_length(pg_catalog.btrim(p_authorization_code)) > 0 THEN
        IF p_card_type IS NULL OR p_last4 IS NULL OR p_exp_month IS NULL OR p_exp_year IS NULL THEN
            RAISE EXCEPTION 'Missing required card authorization details for reusable payment method.'
                USING ERRCODE = '22023';
        END IF;

        v_exp_month_int := p_exp_month::pg_catalog.int2;
        IF pg_catalog.char_length(p_exp_year) = 2 THEN
            v_exp_year_int := (2000 + p_exp_year::pg_catalog.int2)::pg_catalog.int2;
        ELSE
            v_exp_year_int := p_exp_year::pg_catalog.int2;
        END IF;

        -- Check if authorization_code already exists for provider & environment
        SELECT *
        INTO v_existing_pm
        FROM public.billing_payment_methods
        WHERE provider = 'paystack'
          AND environment = v_environment
          AND authorization_code = p_authorization_code
        FOR UPDATE;

        IF FOUND THEN
            IF v_existing_pm.company_id <> v_payment.company_id THEN
                RAISE EXCEPTION 'Payment method authorization code is already registered to another company.'
                    USING ERRCODE = '23505';
            END IF;

            UPDATE public.billing_payment_methods
            SET provider_customer_code = COALESCE(p_provider_customer_code, v_existing_pm.provider_customer_code),
                customer_email = v_payment.customer_email,
                card_type = p_card_type,
                brand = p_card_type,
                last4 = p_last4,
                expiry_month = v_exp_month_int,
                expiry_year = v_exp_year_int,
                bank = p_bank,
                channel = COALESCE(p_channel, 'card'),
                reusable = TRUE,
                is_active = TRUE,
                updated_at = v_now
            WHERE id = v_existing_pm.id;

            v_payment_method_id := v_existing_pm.id;
        ELSE
            INSERT INTO public.billing_payment_methods (
                company_id,
                source_payment_id,
                provider,
                environment,
                provider_customer_code,
                customer_email,
                authorization_code,
                authorization_signature,
                channel,
                card_type,
                brand,
                bank,
                last4,
                expiry_month,
                expiry_year,
                country_code,
                reusable,
                is_default,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                v_payment.company_id,
                v_payment.id,
                'paystack',
                v_environment,
                COALESCE(p_provider_customer_code, 'CUS_' || v_payment.company_id::pg_catalog.text),
                v_payment.customer_email,
                p_authorization_code,
                'SIG_' || p_authorization_code,
                COALESCE(p_channel, 'card'),
                p_card_type,
                p_card_type,
                p_bank,
                p_last4,
                v_exp_month_int,
                v_exp_year_int,
                'ZA',
                TRUE,
                TRUE,
                TRUE,
                v_now,
                v_now
            )
            RETURNING id INTO v_payment_method_id;
        END IF;
    END IF;

    -- 9. Immutable Ledger Linkage
    v_payment_ledger_key := 'payment_succeeded:' || v_payment.id::pg_catalog.text;

    IF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_payment_ledger_key
          AND event.payment_id IS NOT DISTINCT FROM v_payment.id
          AND event.company_id IS NOT DISTINCT FROM v_payment.company_id
          AND event.subscription_id IS NOT DISTINCT FROM v_payment.subscription_id
          AND event.event_type = 'payment_succeeded'
          AND event.event_source = 'paystack_webhook'
    ) THEN
        NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_payment_ledger_key
    ) THEN
        RAISE EXCEPTION 'Ledger deduplication key collision for payment %.', v_payment.id
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
            v_payment.company_id,
            v_payment.subscription_id,
            v_payment.id,
            'payment_succeeded',
            'paystack_webhook',
            p_paid_at,
            v_now,
            v_payment.initiated_by_profile_id,
            v_payment_ledger_key,
            pg_catalog.jsonb_build_object(
                'payment_id', v_payment.id,
                'provider_reference', v_payment.provider_reference,
                'provider_transaction_id', v_provider_transaction_id,
                'provider', v_payment.provider,
                'environment', v_payment.environment,
                'purpose', v_payment.purpose,
                'status', 'succeeded',
                'amount_minor', v_payment.amount_minor,
                'currency', v_payment.currency
            )
        );
    END IF;

    -- Subscription Ledger Event
    IF v_payment.purpose = 'activation' THEN
        v_subscription_ledger_key := 'subscription_activated:' || v_subscription.id::pg_catalog.text || ':' || v_payment.id::pg_catalog.text;

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_subscription_ledger_key
              AND event.payment_id IS NOT DISTINCT FROM v_payment.id
              AND event.company_id IS NOT DISTINCT FROM v_payment.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = 'subscription_activated'
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_subscription_ledger_key
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
                v_payment.company_id,
                v_subscription.id,
                v_payment.id,
                'subscription_activated',
                'paystack_webhook',
                p_paid_at,
                v_now,
                v_payment.initiated_by_profile_id,
                v_subscription_ledger_key,
                pg_catalog.jsonb_build_object(
                    'subscription_id', v_subscription.id,
                    'payment_id', v_payment.id,
                    'plan_id', v_payment.plan_id,
                    'company_id', v_payment.company_id,
                    'status', 'active',
                    'current_period_start', v_period_start,
                    'current_period_end', v_period_end,
                    'next_renewal_at', v_next_renewal
                )
            );
        END IF;
    ELSIF v_payment.purpose = 'renewal' THEN
        v_subscription_ledger_key := 'subscription_renewed:' || v_subscription.id::pg_catalog.text || ':' || v_payment.id::pg_catalog.text;

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_subscription_ledger_key
              AND event.payment_id IS NOT DISTINCT FROM v_payment.id
              AND event.company_id IS NOT DISTINCT FROM v_payment.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = 'subscription_renewed'
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_subscription_ledger_key
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
                v_payment.company_id,
                v_subscription.id,
                v_payment.id,
                'subscription_renewed',
                'paystack_webhook',
                p_paid_at,
                v_now,
                v_payment.initiated_by_profile_id,
                v_subscription_ledger_key,
                pg_catalog.jsonb_build_object(
                    'subscription_id', v_subscription.id,
                    'payment_id', v_payment.id,
                    'plan_id', v_payment.plan_id,
                    'company_id', v_payment.company_id,
                    'status', 'active',
                    'current_period_start', v_period_start,
                    'current_period_end', v_period_end,
                    'next_renewal_at', v_next_renewal
                )
            );
        END IF;
    END IF;

    -- 10. Mark Webhook Event as Processed
    UPDATE public.billing_webhook_events
    SET processing_status = 'processed',
        processed_at = v_now,
        updated_at = v_now
    WHERE id = v_webhook_event_id;

    -- 11. Return Strict Safe Return Contract
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_payment.id,
        v_subscription.id,
        'succeeded'::pg_catalog.text,
        v_final_subscription_status,
        v_payment_method_id,
        'processed'::pg_catalog.text,
        v_is_reused;

    RETURN;
END;
$process_paystack_charge_success$;

REVOKE ALL
ON FUNCTION public.process_paystack_charge_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_charge_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_charge_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool
) IS
'Atomically processes an authenticated and signature-verified Paystack charge.success webhook event, finalising payment and subscription state.';

COMMIT;
