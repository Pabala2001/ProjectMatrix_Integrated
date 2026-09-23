-- ============================================================================
-- Migration: 20260824000002_process_paystack_subscription_disable.sql
-- Description: Creates the atomic public.process_paystack_subscription_disable RPC
--              for handling verified Paystack subscription.disable webhook events,
--              transitioning subscriptions to terminal expired or cancelled states.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_paystack_subscription_disable(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_id pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_status pg_catalog.text DEFAULT NULL,
    p_disabled_at pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_subscription_code pg_catalog.text,
    provider_status pg_catalog.text,
    subscription_status pg_catalog.text,
    auto_renew_enabled pg_catalog.bool,
    is_reused pg_catalog.bool,
    is_ignored pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_subscription_disable$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_event_id pg_catalog.text;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;

    v_webhook_event_id pg_catalog.uuid;
    v_is_reused pg_catalog.bool := FALSE;
    v_is_ignored pg_catalog.bool := FALSE;

    v_resulting_provider_status pg_catalog.text;
    v_resulting_subscription_status pg_catalog.text;
    v_resulting_auto_renew pg_catalog.bool;

    v_ledger_dedup_key pg_catalog.text;
    v_ledger_event_type pg_catalog.text;
    v_ledger_event_data pg_catalog.jsonb;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL THEN
        RAISE EXCEPTION 'p_environment is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL THEN
        RAISE EXCEPTION 'p_payload_sha256 is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 lowercase hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := p_payload_sha256;

    IF p_provider_event_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_event_id) = 0
           OR p_provider_event_id ~ '[[:cntrl:]]'
           OR p_provider_event_id <> pg_catalog.btrim(p_provider_event_id)
           OR pg_catalog.char_length(p_provider_event_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider event ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_event_id := p_provider_event_id;
    ELSE
        v_provider_event_id := NULL;
    END IF;

    IF p_provider_subscription_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_subscription_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$' THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_subscription_id IS NOT NULL THEN
        IF p_provider_subscription_id !~ '^[0-9]+$'
           OR pg_catalog.char_length(p_provider_subscription_id) = 0
           OR pg_catalog.char_length(p_provider_subscription_id) > 20
           OR (pg_catalog.char_length(p_provider_subscription_id) = 20 AND p_provider_subscription_id > '18446744073709551615')
        THEN
            RAISE EXCEPTION 'Invalid provider subscription ID "%". Must be decimal digits string.', p_provider_subscription_id
                USING ERRCODE = '22023';
        END IF;
    END IF;

    IF p_provider_customer_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_customer_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$' THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_status IS NULL THEN
        RAISE EXCEPTION 'p_provider_status is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_status NOT IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid provider status "%". Must be "completed" or "cancelled".', p_provider_status
            USING ERRCODE = '22023';
    END IF;

    IF p_disabled_at IS NULL THEN
        RAISE EXCEPTION 'p_disabled_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_disabled_at <> p_occurred_at THEN
        RAISE EXCEPTION 'p_disabled_at and p_occurred_at must represent the same verified timestamp.'
            USING ERRCODE = '22023';
    END IF;

    -- 2. Webhook Claim & Inbox Insertion (Insertion-First Pattern)
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
        'subscription.disable',
        v_provider_event_id,
        p_provider_subscription_code,
        v_payload_sha256,
        pg_catalog.jsonb_build_object(
            'provider', 'paystack',
            'environment', v_environment,
            'event_type', 'subscription.disable',
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', p_provider_status,
            'disabled_at', p_disabled_at,
            'occurred_at', p_occurred_at
        ),
        TRUE,
        'processing',
        1,
        p_occurred_at,
        v_now,
        v_now
    )
    ON CONFLICT (provider, environment, payload_sha256)
    DO NOTHING
    RETURNING id INTO v_webhook_event_id;

    IF v_webhook_event_id IS NULL THEN
        -- Conflicting transaction already claimed or processed this payload
        SELECT bwe.*
        INTO v_existing_webhook
        FROM public.billing_webhook_events AS bwe
        WHERE bwe.provider = 'paystack'
          AND bwe.environment = v_environment
          AND bwe.payload_sha256 = v_payload_sha256
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Concurrent transaction rolled back while claiming webhook payload. Please retry.'
                USING ERRCODE = '40001';
        END IF;

        -- Check for payload hash collision with conflicting identifiers
        IF v_existing_webhook.event_type <> 'subscription.disable'
           OR v_existing_webhook.provider_object_id IS DISTINCT FROM p_provider_subscription_code
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        v_webhook_event_id := v_existing_webhook.id;

        IF v_existing_webhook.processing_status IN ('processed', 'ignored') THEN
            v_is_reused := TRUE;
            v_is_ignored := (v_existing_webhook.processing_status = 'ignored');
        ELSIF v_existing_webhook.processing_status IN ('received', 'processing') THEN
            RAISE EXCEPTION 'Webhook payload is currently being processed by a concurrent transaction. Please retry.'
                USING ERRCODE = '40001';
        ELSIF v_existing_webhook.processing_status = 'failed' THEN
            RAISE EXCEPTION 'Webhook payload processing previously failed. Manual inspection or retry required.'
                USING ERRCODE = '40001';
        ELSE
            RAISE EXCEPTION 'Unknown webhook processing status "%".', v_existing_webhook.processing_status
                USING ERRCODE = 'XX000';
        END IF;
    END IF;

    -- 3. Resolve & Lock Provider Subscription
    SELECT bps.*
    INTO v_provider_subscription
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.provider_subscription_code = p_provider_subscription_code
      AND bps.provider_customer_code = p_provider_customer_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider subscription not found for code % and customer % in % environment.',
            p_provider_subscription_code, p_provider_customer_code, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    IF p_provider_subscription_id IS NOT NULL
       AND v_provider_subscription.provider_subscription_id IS NOT NULL
       AND v_provider_subscription.provider_subscription_id <> p_provider_subscription_id
    THEN
        RAISE EXCEPTION 'Provider subscription ID mismatch.'
            USING ERRCODE = '23514';
    END IF;

    -- 4. Resolve & Lock Linked Internal Subscription
    SELECT bs.*
    INTO v_subscription
    FROM public.billing_subscriptions AS bs
    WHERE bs.id = v_provider_subscription.subscription_id
      AND bs.company_id = v_provider_subscription.company_id
      AND bs.plan_id = v_provider_subscription.plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked billing subscription % not found for company % and plan %.',
            v_provider_subscription.subscription_id,
            v_provider_subscription.company_id,
            v_provider_subscription.plan_id
            USING ERRCODE = '23514';
    END IF;

    -- 5. Exact Replay Handling: Return early without mutations or ledger insertions
    IF v_is_reused THEN
        RETURN QUERY
        SELECT
            v_webhook_event_id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_subscription.provider_subscription_code,
            v_provider_subscription.provider_status,
            v_subscription.status,
            v_subscription.auto_renew_enabled,
            TRUE AS is_reused,
            v_is_ignored AS is_ignored;
        RETURN;
    END IF;

    -- 6. Lifecycle Validation & State Application
    IF v_subscription.status IN ('pending_activation', 'trialing') THEN
        RAISE EXCEPTION 'Cannot process subscription.disable for subscription % in % state.',
            v_subscription.id, v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    IF v_subscription.status IN ('expired', 'cancelled') THEN
        -- Check for contradictory terminal state
        IF (v_subscription.status = 'expired' AND p_provider_status <> 'completed')
           OR (v_subscription.status = 'cancelled' AND p_provider_status <> 'cancelled')
        THEN
            RAISE EXCEPTION 'Contradictory terminal state transition for subscription % in % state with provider status %.',
                v_subscription.id, v_subscription.status, p_provider_status
                USING ERRCODE = '23514';
        END IF;

        -- Same-outcome fresh stale event: preserve state without regression
        v_is_ignored := TRUE;
        v_ledger_event_type := 'provider_subscription_disable_ignored';
        v_resulting_provider_status := v_provider_subscription.provider_status;
        v_resulting_subscription_status := v_subscription.status;
        v_resulting_auto_renew := v_subscription.auto_renew_enabled;

        UPDATE public.billing_webhook_events AS bwe_ign
        SET processing_status = 'ignored',
            processed_at = v_now,
            updated_at = v_now
        WHERE bwe_ign.id = v_webhook_event_id;

        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', v_provider_subscription.provider_status,
            'subscription_status', v_subscription.status,
            'reason', 'terminal_state_ignored',
            'auto_renew_enabled', v_subscription.auto_renew_enabled,
            'disabled_at', p_disabled_at
        );
    ELSE
        -- Non-terminal states (active, non_renewing, past_due)
        v_is_ignored := FALSE;
        v_resulting_provider_status := p_provider_status;
        v_resulting_auto_renew := FALSE;

        IF p_provider_status = 'completed' THEN
            v_resulting_subscription_status := 'expired';
            v_ledger_event_type := 'provider_subscription_completed';

            UPDATE public.billing_subscriptions AS bs_exp
            SET status = 'expired',
                auto_renew_enabled = FALSE,
                next_renewal_at = NULL,
                expired_at = p_disabled_at,
                updated_at = v_now
            WHERE bs_exp.id = v_subscription.id;
        ELSIF p_provider_status = 'cancelled' THEN
            v_resulting_subscription_status := 'cancelled';
            v_ledger_event_type := 'provider_subscription_cancelled';

            UPDATE public.billing_subscriptions AS bs_cnc
            SET status = 'cancelled',
                auto_renew_enabled = FALSE,
                next_renewal_at = NULL,
                cancelled_at = p_disabled_at,
                updated_at = v_now
            WHERE bs_cnc.id = v_subscription.id;
        END IF;

        UPDATE public.billing_provider_subscriptions AS bps_upd
        SET provider_status = p_provider_status,
            disabled_at = p_disabled_at,
            next_payment_at = NULL,
            is_current = FALSE,
            last_synced_at = v_now,
            updated_at = v_now
        WHERE bps_upd.id = v_provider_subscription.id;

        UPDATE public.billing_webhook_events AS bwe_proc
        SET processing_status = 'processed',
            processed_at = v_now,
            updated_at = v_now
        WHERE bwe_proc.id = v_webhook_event_id;

        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', p_provider_status,
            'previous_provider_status', v_provider_subscription.provider_status,
            'previous_subscription_status', v_subscription.status,
            'resulting_subscription_status', v_resulting_subscription_status,
            'auto_renew_enabled', FALSE,
            'disabled_at', p_disabled_at
        );
    END IF;

    -- 7. Append Immutable Ledger Entry
    v_ledger_dedup_key := 'provider_subscription_disable:paystack:' || v_environment || ':' || v_subscription.id::pg_catalog.text || ':' || p_provider_subscription_code || ':' || v_payload_sha256;

    IF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
          AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
          AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
          AND event.event_type = v_ledger_event_type
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
            NULL,
            v_ledger_event_type,
            'paystack_webhook',
            p_occurred_at,
            v_now,
            NULL,
            v_ledger_dedup_key,
            v_ledger_event_data
        );
    END IF;

    -- 8. Return Safe Return Contract
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_provider_subscription.id,
        v_subscription.id,
        p_provider_subscription_code,
        v_resulting_provider_status,
        v_resulting_subscription_status,
        v_resulting_auto_renew,
        FALSE AS is_reused,
        v_is_ignored AS is_ignored;

    RETURN;
END;
$process_paystack_subscription_disable$;

REVOKE ALL
ON FUNCTION public.process_paystack_subscription_disable(
    pg_catalog.text,
    pg_catalog.text,
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
ON FUNCTION public.process_paystack_subscription_disable(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_subscription_disable(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified Paystack subscription.disable webhook event, transitioning subscriptions to terminal expired or cancelled states with full idempotency and ledger audit logging.';

COMMIT;
