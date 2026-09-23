-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4E-1B
-- Migration: Paystack invoice.create Database RPC
-- Filename: 20260826000001_process_paystack_invoice_create.sql
-- Description: Creates the atomic public.process_paystack_invoice_create RPC
--              for handling verified Paystack invoice.create webhook events,
--              creating pending invoice projections for active or past_due subscriptions.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_paystack_invoice_create(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_invoice_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_status pg_catalog.text DEFAULT NULL,
    p_amount_minor pg_catalog.int8 DEFAULT NULL,
    p_currency pg_catalog.text DEFAULT NULL,
    p_period_start pg_catalog.timestamptz DEFAULT NULL,
    p_period_end pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    invoice_id pg_catalog.uuid,
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_invoice_code pg_catalog.text,
    invoice_status pg_catalog.text,
    provider_status pg_catalog.text,
    amount_minor pg_catalog.int8,
    currency pg_catalog.text,
    is_reused pg_catalog.bool,
    is_ignored pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_invoice_create$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_event_id pg_catalog.text;
    v_provider_invoice_code pg_catalog.text;
    v_provider_subscription_code pg_catalog.text;
    v_provider_customer_code pg_catalog.text;
    v_provider_status pg_catalog.text;
    v_currency pg_catalog.text;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;
    v_existing_invoice public.billing_invoices%ROWTYPE;

    v_webhook_event_id pg_catalog.uuid;
    v_new_invoice_id pg_catalog.uuid;
    v_is_reused pg_catalog.bool := FALSE;
    v_is_ignored pg_catalog.bool := FALSE;

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

    IF p_provider_invoice_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_invoice_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_invoice_code !~ '^INV_[a-zA-Z0-9_\-]+$'
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_invoice_code)) < 5
       OR p_provider_invoice_code <> pg_catalog.btrim(p_provider_invoice_code)
       OR pg_catalog.char_length(p_provider_invoice_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider invoice code format "%".', p_provider_invoice_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_invoice_code := p_provider_invoice_code;

    IF p_provider_subscription_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_subscription_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$'
       OR p_provider_subscription_code <> pg_catalog.btrim(p_provider_subscription_code)
       OR pg_catalog.char_length(p_provider_subscription_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_subscription_code := p_provider_subscription_code;

    IF p_provider_customer_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_customer_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
       OR p_provider_customer_code <> pg_catalog.btrim(p_provider_customer_code)
       OR pg_catalog.char_length(p_provider_customer_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_customer_code := p_provider_customer_code;

    IF p_provider_status IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_status) = 0
           OR p_provider_status ~ '[[:cntrl:]]'
           OR p_provider_status <> pg_catalog.btrim(p_provider_status)
           OR pg_catalog.char_length(p_provider_status) > 50
        THEN
            RAISE EXCEPTION 'Invalid provider status "%".', p_provider_status
                USING ERRCODE = '22023';
        END IF;
        v_provider_status := p_provider_status;
    ELSE
        v_provider_status := NULL;
    END IF;

    IF p_amount_minor IS NULL THEN
        RAISE EXCEPTION 'p_amount_minor is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_amount_minor <= 0 OR p_amount_minor > 2147483647 THEN
        RAISE EXCEPTION 'Invalid amount % minor units.', p_amount_minor
            USING ERRCODE = '22023';
    END IF;

    IF p_currency IS NULL THEN
        RAISE EXCEPTION 'p_currency is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Invalid currency "%". Must be 3 uppercase letters.', p_currency
            USING ERRCODE = '22023';
    END IF;
    v_currency := p_currency;

    IF (p_period_start IS NULL AND p_period_end IS NOT NULL)
       OR (p_period_start IS NOT NULL AND p_period_end IS NULL)
    THEN
        RAISE EXCEPTION 'Period boundaries must be either both null or both specified.'
            USING ERRCODE = '22023';
    END IF;

    IF p_period_start IS NOT NULL AND p_period_end <= p_period_start THEN
        RAISE EXCEPTION 'p_period_end must be strictly greater than p_period_start.'
            USING ERRCODE = '22023';
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22004';
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
        'invoice.create',
        v_provider_event_id,
        v_provider_invoice_code,
        v_payload_sha256,
        pg_catalog.jsonb_build_object(
            'provider', 'paystack',
            'environment', v_environment,
            'event_type', 'invoice.create',
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_status,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
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
        -- Conflicting transaction already claimed or processed this exact payload hash
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
        IF v_existing_webhook.event_type <> 'invoice.create'
           OR v_existing_webhook.provider_object_id IS DISTINCT FROM v_provider_invoice_code
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
      AND bps.provider_subscription_code = v_provider_subscription_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider subscription not found for code % in % environment.',
            v_provider_subscription_code, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    IF v_provider_subscription.provider_customer_code <> v_provider_customer_code THEN
        RAISE EXCEPTION 'Provider customer code % does not match customer % on provider subscription %.',
            v_provider_customer_code, v_provider_subscription.provider_customer_code, v_provider_subscription_code
            USING ERRCODE = 'P0002';
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
            USING ERRCODE = 'P0002';
    END IF;

    -- Commercial snapshot verification
    IF v_subscription.amount_minor <> p_amount_minor
       OR v_subscription.currency <> v_currency
    THEN
        RAISE EXCEPTION 'Commercial snapshot mismatch for subscription %: expected % %, received % %.',
            v_subscription.id, v_subscription.amount_minor, v_subscription.currency, p_amount_minor, v_currency
            USING ERRCODE = '23514';
    END IF;

    -- 5. Exact Replay Handling: Return early without mutations or ledger insertions
    IF v_is_reused THEN
        SELECT bi.*
        INTO v_existing_invoice
        FROM public.billing_invoices AS bi
        WHERE bi.provider = 'paystack'
          AND bi.environment = v_environment
          AND bi.provider_invoice_code = v_provider_invoice_code
        FOR UPDATE;

        IF v_existing_invoice.id IS NOT NULL THEN
            RETURN QUERY
            SELECT
                v_webhook_event_id,
                v_existing_invoice.id,
                v_provider_subscription.id,
                v_subscription.id,
                v_provider_invoice_code,
                v_existing_invoice.status,
                v_existing_invoice.provider_status,
                v_existing_invoice.amount_minor::pg_catalog.int8,
                v_existing_invoice.currency::pg_catalog.text,
                TRUE AS is_reused,
                v_is_ignored AS is_ignored;
            RETURN;
        ELSE
            -- Stale ignored event with no invoice created
            RETURN QUERY
            SELECT
                v_webhook_event_id,
                NULL::pg_catalog.uuid AS invoice_id,
                v_provider_subscription.id,
                v_subscription.id,
                v_provider_invoice_code,
                NULL::pg_catalog.text AS invoice_status,
                v_provider_status,
                p_amount_minor,
                v_currency,
                TRUE AS is_reused,
                TRUE AS is_ignored;
            RETURN;
        END IF;
    END IF;

    -- 6. Check Semantic Invoice Existence (Different payload hash referencing existing invoice code)
    SELECT bi.*
    INTO v_existing_invoice
    FROM public.billing_invoices AS bi
    WHERE bi.provider = 'paystack'
      AND bi.environment = v_environment
      AND bi.provider_invoice_code = v_provider_invoice_code
    FOR UPDATE;

    IF v_existing_invoice.id IS NOT NULL THEN
        -- Verify that identity matches exactly
        IF v_existing_invoice.company_id <> v_subscription.company_id
           OR v_existing_invoice.subscription_id <> v_subscription.id
           OR v_existing_invoice.provider_subscription_record_id <> v_provider_subscription.id
        THEN
            RAISE EXCEPTION 'Conflicting invoice identity for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        END IF;

        -- Verify commercial snapshot matches
        IF v_existing_invoice.amount_minor <> p_amount_minor
           OR v_existing_invoice.currency <> v_currency
        THEN
            RAISE EXCEPTION 'Conflicting commercial snapshot for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;

        -- Verify period dates match
        IF v_existing_invoice.period_start IS DISTINCT FROM p_period_start
           OR v_existing_invoice.period_end IS DISTINCT FROM p_period_end
        THEN
            RAISE EXCEPTION 'Conflicting period dates for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;

        IF v_existing_invoice.status = 'pending' THEN
            -- Reused existing pending invoice
            UPDATE public.billing_webhook_events AS bwe_proc
            SET processing_status = 'processed',
                processed_at = v_now,
                updated_at = v_now
            WHERE bwe_proc.id = v_webhook_event_id;

            RETURN QUERY
            SELECT
                v_webhook_event_id,
                v_existing_invoice.id,
                v_provider_subscription.id,
                v_subscription.id,
                v_provider_invoice_code,
                v_existing_invoice.status,
                v_existing_invoice.provider_status,
                v_existing_invoice.amount_minor::pg_catalog.int8,
                v_existing_invoice.currency::pg_catalog.text,
                TRUE AS is_reused,
                FALSE AS is_ignored;
            RETURN;
        ELSE
            -- Invoice has already advanced to failed or paid; treat new invoice.create event as stale ignored
            UPDATE public.billing_webhook_events AS bwe_ign
            SET processing_status = 'ignored',
                processed_at = v_now,
                updated_at = v_now
            WHERE bwe_ign.id = v_webhook_event_id;

            RETURN QUERY
            SELECT
                v_webhook_event_id,
                v_existing_invoice.id,
                v_provider_subscription.id,
                v_subscription.id,
                v_provider_invoice_code,
                v_existing_invoice.status,
                v_existing_invoice.provider_status,
                v_existing_invoice.amount_minor::pg_catalog.int8,
                v_existing_invoice.currency::pg_catalog.text,
                TRUE AS is_reused,
                TRUE AS is_ignored;
            RETURN;
        END IF;
    END IF;

    -- 7. Subscription Lifecycle Validation & Invoice Creation
    IF v_subscription.status IN ('pending_activation', 'trialing') THEN
        RAISE EXCEPTION 'Cannot process invoice.create for subscription % in % state.',
            v_subscription.id, v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    IF v_subscription.status IN ('non_renewing', 'expired', 'cancelled') THEN
        -- Stale event on non-renewing / terminal subscription: ignore without creating an invoice
        v_is_ignored := TRUE;
        v_ledger_event_type := 'billing_invoice_create_ignored';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':create_ignored:' || v_payload_sha256;

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
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_status,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'occurred_at', p_occurred_at,
            'reason', 'stale_subscription_status',
            'subscription_status', v_subscription.status,
            'is_ignored', TRUE
        );

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
            RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
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

        RETURN QUERY
        SELECT
            v_webhook_event_id,
            NULL::pg_catalog.uuid AS invoice_id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_invoice_code,
            NULL::pg_catalog.text AS invoice_status,
            v_provider_status,
            p_amount_minor,
            v_currency,
            FALSE AS is_reused,
            TRUE AS is_ignored;
        RETURN;
    END IF;

    -- Subscription is 'active' or 'past_due': Create pending billing_invoices record
    INSERT INTO public.billing_invoices (
        company_id,
        subscription_id,
        provider_subscription_record_id,
        provider,
        environment,
        provider_invoice_code,
        status,
        provider_status,
        amount_minor,
        currency,
        period_start,
        period_end,
        first_failed_at,
        paid_at,
        created_at,
        updated_at
    ) VALUES (
        v_subscription.company_id,
        v_subscription.id,
        v_provider_subscription.id,
        'paystack',
        v_environment,
        v_provider_invoice_code,
        'pending',
        v_provider_status,
        p_amount_minor::pg_catalog.int4,
        v_currency,
        p_period_start,
        p_period_end,
        NULL,
        NULL,
        v_now,
        v_now
    )
    RETURNING id INTO v_new_invoice_id;

    UPDATE public.billing_webhook_events AS bwe_proc
    SET processing_status = 'processed',
        processed_at = v_now,
        updated_at = v_now
    WHERE bwe_proc.id = v_webhook_event_id;

    -- 8. Append Immutable Ledger Entry
    v_ledger_event_type := 'billing_invoice_created';
    v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':created';

    v_ledger_event_data := pg_catalog.jsonb_build_object(
        'company_id', v_subscription.company_id,
        'subscription_id', v_subscription.id,
        'invoice_id', v_new_invoice_id,
        'provider', 'paystack',
        'environment', v_environment,
        'provider_invoice_code', v_provider_invoice_code,
        'provider_subscription_code', v_provider_subscription_code,
        'provider_customer_code', v_provider_customer_code,
        'provider_status', v_provider_status,
        'amount_minor', p_amount_minor,
        'currency', v_currency,
        'period_start', p_period_start,
        'period_end', p_period_end,
        'occurred_at', p_occurred_at,
        'invoice_status', 'pending',
        'subscription_status', v_subscription.status,
        'is_ignored', FALSE
    );

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
        RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
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

    -- 9. Return Single Row Result
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_new_invoice_id,
        v_provider_subscription.id,
        v_subscription.id,
        v_provider_invoice_code,
        'pending'::pg_catalog.text,
        v_provider_status,
        p_amount_minor,
        v_currency,
        FALSE AS is_reused,
        FALSE AS is_ignored;

    RETURN;
END;
$process_paystack_invoice_create$;

REVOKE ALL
ON FUNCTION public.process_paystack_invoice_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_invoice_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_invoice_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified Paystack invoice.create webhook event, creating pending invoice lifecycle projections for active or past-due subscriptions with strict idempotency and audit logging.';

COMMIT;
