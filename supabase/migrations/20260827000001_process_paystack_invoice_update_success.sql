-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4E-3A
-- Migration: Paystack invoice.update Success Database RPC
-- Filename: 20260827000001_process_paystack_invoice_update_success.sql
-- Description: Creates the atomic public.process_paystack_invoice_update_success RPC
--              for handling verified successful Paystack invoice.update webhook events,
--              materializing or transitioning invoices to paid, recording/reconciling
--              renewal payments, advancing subscription billing periods, recovering
--              past_due subscriptions without re-enabling disabled renewal, and
--              appending immutable ledger events.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_paystack_invoice_update_success(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_invoice_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_plan_code pg_catalog.text DEFAULT NULL,
    p_provider_invoice_status pg_catalog.text DEFAULT NULL,
    p_provider_paid pg_catalog.bool DEFAULT NULL,
    p_provider_transaction_status pg_catalog.text DEFAULT NULL,
    p_provider_transaction_id pg_catalog.text DEFAULT NULL,
    p_provider_reference pg_catalog.text DEFAULT NULL,
    p_amount_minor pg_catalog.int8 DEFAULT NULL,
    p_currency pg_catalog.text DEFAULT NULL,
    p_period_start pg_catalog.timestamptz DEFAULT NULL,
    p_period_end pg_catalog.timestamptz DEFAULT NULL,
    p_paid_at pg_catalog.timestamptz DEFAULT NULL,
    p_next_payment_date pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    invoice_id pg_catalog.uuid,
    payment_id pg_catalog.uuid,
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_invoice_code pg_catalog.text,
    invoice_status pg_catalog.text,
    payment_status pg_catalog.text,
    subscription_status pg_catalog.text,
    amount_minor pg_catalog.int8,
    currency pg_catalog.text,
    current_period_start pg_catalog.timestamptz,
    current_period_end pg_catalog.timestamptz,
    next_renewal_at pg_catalog.timestamptz,
    past_due_since pg_catalog.timestamptz,
    is_reused pg_catalog.bool,
    is_ignored pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_invoice_update_success$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_event_id pg_catalog.text;
    v_provider_invoice_code pg_catalog.text;
    v_provider_subscription_code pg_catalog.text;
    v_provider_customer_code pg_catalog.text;
    v_provider_plan_code pg_catalog.text;
    v_provider_invoice_status pg_catalog.text;
    v_provider_transaction_status pg_catalog.text;
    v_provider_transaction_id pg_catalog.text;
    v_provider_reference pg_catalog.text;
    v_currency pg_catalog.text;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;
    v_provider_plan public.billing_provider_plans%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;
    v_existing_invoice public.billing_invoices%ROWTYPE;
    v_existing_payment public.billing_payments%ROWTYPE;
    v_existing_invoice_success_payment public.billing_payments%ROWTYPE;

    v_webhook_event_id pg_catalog.uuid;
    v_invoice_id pg_catalog.uuid;
    v_payment_id pg_catalog.uuid;
    v_payment_ref pg_catalog.text;
    v_payment_idempotency_key pg_catalog.uuid;

    v_invoice_status pg_catalog.text;
    v_payment_status pg_catalog.text;
    v_final_subscription_status pg_catalog.text;
    v_final_past_due_since pg_catalog.timestamptz;
    v_final_current_period_start pg_catalog.timestamptz;
    v_final_current_period_end pg_catalog.timestamptz;
    v_final_next_renewal_at pg_catalog.timestamptz;

    v_is_reused pg_catalog.bool := FALSE;
    v_is_ignored pg_catalog.bool := FALSE;
    v_should_advance_period pg_catalog.bool := FALSE;
    v_record_invoice_paid_ledger pg_catalog.bool := FALSE;
    v_record_payment_succeeded_ledger pg_catalog.bool := FALSE;
    v_record_subscription_recovered_ledger pg_catalog.bool := FALSE;

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

    IF p_provider_plan_code IS NOT NULL THEN
        IF p_provider_plan_code !~ '^PLN_[A-Za-z0-9]+$'
           OR p_provider_plan_code <> pg_catalog.btrim(p_provider_plan_code)
           OR pg_catalog.char_length(p_provider_plan_code) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider plan code format "%".', p_provider_plan_code
                USING ERRCODE = '22023';
        END IF;
        v_provider_plan_code := p_provider_plan_code;
    ELSE
        v_provider_plan_code := NULL;
    END IF;

    IF p_provider_invoice_status IS NULL THEN
        RAISE EXCEPTION 'p_provider_invoice_status is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_invoice_status <> 'success' THEN
        RAISE EXCEPTION 'Invalid provider invoice status "%". Must be "success".', p_provider_invoice_status
            USING ERRCODE = '22023';
    END IF;
    v_provider_invoice_status := p_provider_invoice_status;

    IF p_provider_paid IS NULL THEN
        RAISE EXCEPTION 'p_provider_paid is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_paid IS NOT TRUE THEN
        RAISE EXCEPTION 'p_provider_paid must be true for successful invoice.update.'
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_transaction_status IS NOT NULL THEN
        IF p_provider_transaction_status <> 'success' THEN
            RAISE EXCEPTION 'Invalid provider transaction status "%". Must be "success".', p_provider_transaction_status
                USING ERRCODE = '22023';
        END IF;
        v_provider_transaction_status := p_provider_transaction_status;
    ELSE
        v_provider_transaction_status := NULL;
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

    IF p_period_start IS NULL THEN
        RAISE EXCEPTION 'p_period_start is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_period_end IS NULL THEN
        RAISE EXCEPTION 'p_period_end is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_period_end <= p_period_start THEN
        RAISE EXCEPTION 'p_period_end must be strictly greater than p_period_start.'
            USING ERRCODE = '22023';
    END IF;

    IF p_paid_at IS NULL THEN
        RAISE EXCEPTION 'p_paid_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_next_payment_date IS NOT NULL THEN
        IF p_next_payment_date < p_period_end THEN
            RAISE EXCEPTION 'p_next_payment_date cannot be earlier than p_period_end.'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_provider_transaction_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_transaction_id) = 0
           OR p_provider_transaction_id ~ '[[:cntrl:]]'
           OR p_provider_transaction_id <> pg_catalog.btrim(p_provider_transaction_id)
           OR pg_catalog.char_length(p_provider_transaction_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider transaction ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_transaction_id := p_provider_transaction_id;
    ELSE
        v_provider_transaction_id := NULL;
    END IF;

    IF p_provider_reference IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_reference) = 0
           OR p_provider_reference ~ '[[:cntrl:]]'
           OR p_provider_reference <> pg_catalog.btrim(p_provider_reference)
           OR pg_catalog.char_length(p_provider_reference) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider reference.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_reference := p_provider_reference;
    ELSE
        v_provider_reference := NULL;
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
        'invoice.update',
        v_provider_event_id,
        v_provider_invoice_code,
        v_payload_sha256,
        pg_catalog.jsonb_build_object(
            'provider', 'paystack',
            'environment', v_environment,
            'event_type', 'invoice.update',
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_plan_code', v_provider_plan_code,
            'provider_invoice_status', v_provider_invoice_status,
            'provider_paid', p_provider_paid,
            'provider_transaction_status', v_provider_transaction_status,
            'provider_transaction_id', v_provider_transaction_id,
            'provider_reference', v_provider_reference,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'paid_at', p_paid_at,
            'next_payment_date', p_next_payment_date,
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
        IF v_existing_webhook.event_type <> 'invoice.update'
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

    IF v_provider_plan_code IS NOT NULL THEN
        SELECT bpp.*
        INTO v_provider_plan
        FROM public.billing_provider_plans AS bpp
        WHERE bpp.id = v_provider_subscription.provider_plan_mapping_id;

        IF NOT FOUND OR v_provider_plan.provider_plan_code <> v_provider_plan_code THEN
            RAISE EXCEPTION 'Provider plan code % does not match provider subscription %.',
                v_provider_plan_code, v_provider_subscription_code
                USING ERRCODE = '23514';
        END IF;
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

    -- 5. Resolve Existing Invoice & Existing Payment (if any)
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
        IF (v_existing_invoice.period_start IS NOT NULL AND v_existing_invoice.period_start IS DISTINCT FROM p_period_start)
           OR (v_existing_invoice.period_end IS NOT NULL AND v_existing_invoice.period_end IS DISTINCT FROM p_period_end)
        THEN
            RAISE EXCEPTION 'Conflicting period dates for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF v_provider_transaction_id IS NOT NULL OR v_provider_reference IS NOT NULL THEN
        SELECT bp.*
        INTO v_existing_payment
        FROM public.billing_payments AS bp
        WHERE bp.provider = 'paystack'
          AND bp.environment = v_environment
          AND (
            (v_provider_transaction_id IS NOT NULL AND bp.provider_transaction_id = v_provider_transaction_id)
            OR (v_provider_reference IS NOT NULL AND bp.provider_reference = v_provider_reference)
          )
        FOR UPDATE;

        IF v_existing_payment.id IS NOT NULL THEN
            IF v_provider_transaction_id IS NOT NULL
               AND v_existing_payment.provider_transaction_id IS NOT NULL
               AND v_existing_payment.provider_transaction_id <> v_provider_transaction_id
            THEN
                RAISE EXCEPTION 'Provider reference % is already associated with a different transaction ID.',
                    v_provider_reference
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_payment.company_id <> v_subscription.company_id
               OR v_existing_payment.subscription_id <> v_subscription.id
               OR v_existing_payment.plan_id <> v_subscription.plan_id
               OR v_existing_payment.provider_plan_mapping_id <> v_provider_subscription.provider_plan_mapping_id
            THEN
                RAISE EXCEPTION 'Conflicting payment identity for company, subscription, or plan.'
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_payment.amount_minor <> p_amount_minor
               OR v_existing_payment.currency <> v_currency
               OR v_existing_payment.purpose <> 'renewal'
            THEN
                RAISE EXCEPTION 'Conflicting commercial snapshot or purpose for payment.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_existing_payment.billing_invoice_id IS NOT NULL
               AND (
                   v_existing_invoice.id IS NULL
                   OR v_existing_payment.billing_invoice_id <> v_existing_invoice.id
               )
            THEN
                RAISE EXCEPTION 'Payment already linked to a different billing invoice.'
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_payment.status IN ('failed', 'cancelled') THEN
                RAISE EXCEPTION 'A terminal % payment attempt cannot be rewritten as succeeded. A distinct successful provider reference is required.',
                    v_existing_payment.status
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        IF v_provider_transaction_id IS NOT NULL
           AND EXISTS (
               SELECT 1
               FROM public.billing_payments AS bp
               WHERE bp.provider = 'paystack'
                 AND bp.environment = v_environment
                 AND bp.provider_transaction_id = v_provider_transaction_id
                 AND (
                     v_existing_payment.id IS NULL
                     OR bp.id <> v_existing_payment.id
                 )
           )
        THEN
            RAISE EXCEPTION 'Provider transaction ID % is already associated with a different payment.',
                v_provider_transaction_id
                USING ERRCODE = '23505';
        END IF;

        IF v_existing_payment.status = 'succeeded'
           AND v_existing_payment.paid_at IS DISTINCT FROM p_paid_at
        THEN
            RAISE EXCEPTION 'Conflicting paid timestamp for provider reference %.', v_provider_reference
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF v_existing_invoice.id IS NOT NULL THEN
        SELECT bp.*
        INTO v_existing_invoice_success_payment
        FROM public.billing_payments AS bp
        WHERE bp.billing_invoice_id = v_existing_invoice.id
          AND bp.company_id = v_subscription.company_id
          AND bp.subscription_id = v_subscription.id
          AND bp.provider = 'paystack'
          AND bp.environment = v_environment
          AND bp.status = 'succeeded'
        ORDER BY bp.created_at ASC, bp.id ASC
        LIMIT 1
        FOR UPDATE;

        IF v_existing_invoice_success_payment.id IS NOT NULL
           AND (
               v_existing_payment.id IS NULL
               OR v_existing_invoice_success_payment.id <> v_existing_payment.id
           )
        THEN
            RAISE EXCEPTION 'Billing invoice % already has a different succeeded payment.', v_provider_invoice_code
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 6. Exact Replay Handling: Return early without mutations or duplicate ledger insertions
    IF v_is_reused THEN
        RETURN QUERY
        SELECT
            v_webhook_event_id,
            v_existing_invoice.id,
            v_existing_payment.id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_invoice_code,
            v_existing_invoice.status,
            v_existing_payment.status,
            v_subscription.status,
            p_amount_minor,
            v_currency,
            v_subscription.current_period_start,
            v_subscription.current_period_end,
            v_subscription.next_renewal_at,
            v_subscription.past_due_since,
            TRUE AS is_reused,
            v_is_ignored AS is_ignored;
        RETURN;
    END IF;

    -- 7. Subscription Lifecycle Validation
    IF v_subscription.status IN ('pending_activation', 'trialing') THEN
        RAISE EXCEPTION 'Cannot process invoice.update for subscription % in % state.',
            v_subscription.id, v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    -- A paid invoice/payment may still need reconciliation, but entitlement periods
    -- advance only when the provider-confirmed period is strictly newer.
    v_should_advance_period := (
        v_subscription.current_period_end IS NULL
        OR p_period_end > v_subscription.current_period_end
    );

    -- 8. Invoice Materialization / Transition to 'paid'
    IF v_existing_invoice.id IS NULL THEN
        -- Materialize new invoice directly as paid
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
            'paid',
            v_provider_invoice_status,
            p_amount_minor::pg_catalog.int4,
            v_currency,
            p_period_start,
            p_period_end,
            NULL,
            p_paid_at,
            v_now,
            v_now
        )
        RETURNING id INTO v_invoice_id;

        v_invoice_status := 'paid';
        v_record_invoice_paid_ledger := TRUE;
    ELSIF v_existing_invoice.status IN ('pending', 'failed') THEN
        -- Transition existing pending or failed invoice to paid
        UPDATE public.billing_invoices
        SET status = 'paid',
            provider_status = v_provider_invoice_status,
            paid_at = p_paid_at,
            period_start = COALESCE(period_start, p_period_start),
            period_end = COALESCE(period_end, p_period_end),
            updated_at = v_now
        WHERE id = v_existing_invoice.id;

        v_invoice_id := v_existing_invoice.id;
        v_invoice_status := 'paid';
        v_record_invoice_paid_ledger := TRUE;
    ELSE
        -- Existing invoice is already paid
        v_invoice_id := v_existing_invoice.id;
        v_invoice_status := v_existing_invoice.status;
        v_record_invoice_paid_ledger := FALSE;
    END IF;

    -- 9. Renewal Payment Recording / Reconciliation
    IF v_existing_payment.id IS NOT NULL THEN
        v_payment_ref := v_existing_payment.provider_reference;

        IF v_existing_payment.status IN ('initialized', 'pending') THEN
            UPDATE public.billing_payments
            SET status = 'succeeded',
                paid_at = p_paid_at,
                failed_at = NULL,
                cancelled_at = NULL,
                error_code = NULL,
                error_message = NULL,
                billing_invoice_id = COALESCE(billing_invoice_id, v_invoice_id),
                provider_transaction_id = COALESCE(provider_transaction_id, v_provider_transaction_id),
                updated_at = v_now
            WHERE id = v_existing_payment.id;

            v_payment_id := v_existing_payment.id;
            v_payment_status := 'succeeded';
            v_record_payment_succeeded_ledger := TRUE;
        ELSIF v_existing_payment.status = 'succeeded' THEN
            -- Already succeeded
            v_payment_id := v_existing_payment.id;
            v_payment_status := 'succeeded';
            v_record_payment_succeeded_ledger := FALSE;
        ELSE
            RAISE EXCEPTION 'Unsupported existing payment status "%" for successful invoice reconciliation.',
                v_existing_payment.status
                USING ERRCODE = '23514';
        END IF;
    ELSIF v_provider_transaction_id IS NOT NULL OR v_provider_reference IS NOT NULL THEN
        v_payment_ref := COALESCE(v_provider_reference, 'txn_' || v_provider_transaction_id);
        v_payment_idempotency_key := pg_catalog.md5('paystack:' || v_environment || ':payment:' || COALESCE(v_provider_transaction_id, v_provider_reference) || ':succeeded')::pg_catalog.uuid;

        INSERT INTO public.billing_payments (
            company_id,
            subscription_id,
            plan_id,
            provider_plan_mapping_id,
            provider,
            environment,
            purpose,
            idempotency_key,
            provider_reference,
            provider_transaction_id,
            amount_minor,
            currency,
            customer_email,
            status,
            paid_at,
            billing_invoice_id,
            created_at,
            updated_at
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            v_subscription.plan_id,
            v_provider_subscription.provider_plan_mapping_id,
            'paystack',
            v_environment,
            'renewal',
            v_payment_idempotency_key,
            v_payment_ref,
            v_provider_transaction_id,
            p_amount_minor::pg_catalog.int4,
            v_currency,
            v_provider_subscription.customer_email,
            'succeeded',
            p_paid_at,
            v_invoice_id,
            v_now,
            v_now
        )
        RETURNING id INTO v_payment_id;

        v_payment_status := 'succeeded';
        v_record_payment_succeeded_ledger := TRUE;
    ELSE
        v_payment_id := NULL;
        v_payment_status := NULL;
        v_record_payment_succeeded_ledger := FALSE;
    END IF;

    -- 10. Advance Subscription Period & Lifecycle State Transitions
    v_final_subscription_status := v_subscription.status;
    v_final_past_due_since := v_subscription.past_due_since;
    v_final_current_period_start := v_subscription.current_period_start;
    v_final_current_period_end := v_subscription.current_period_end;
    v_final_next_renewal_at := v_subscription.next_renewal_at;

    IF v_subscription.status = 'active' THEN
        v_final_subscription_status := 'active';
        v_final_past_due_since := NULL;
        IF v_should_advance_period THEN
            v_final_current_period_start := p_period_start;
            v_final_current_period_end := p_period_end;
            v_final_next_renewal_at := CASE
                WHEN v_subscription.auto_renew_enabled IS TRUE
                    THEN COALESCE(p_next_payment_date, p_period_end)
                ELSE NULL
            END;

            UPDATE public.billing_subscriptions
            SET current_period_start = v_final_current_period_start,
                current_period_end = v_final_current_period_end,
                next_renewal_at = v_final_next_renewal_at,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
    ELSIF v_subscription.status = 'past_due' THEN
        IF v_should_advance_period THEN
            -- Recover access without re-enabling renewal that the customer disabled.
            v_final_subscription_status := CASE
                WHEN v_subscription.auto_renew_enabled IS TRUE THEN 'active'
                ELSE 'non_renewing'
            END;
            v_final_past_due_since := NULL;
            v_final_current_period_start := p_period_start;
            v_final_current_period_end := p_period_end;
            v_final_next_renewal_at := CASE
                WHEN v_subscription.auto_renew_enabled IS TRUE
                    THEN COALESCE(p_next_payment_date, p_period_end)
                ELSE NULL
            END;
            v_record_subscription_recovered_ledger := TRUE;

            UPDATE public.billing_subscriptions
            SET status = v_final_subscription_status,
                past_due_since = NULL,
                current_period_start = v_final_current_period_start,
                current_period_end = v_final_current_period_end,
                next_renewal_at = v_final_next_renewal_at,
                updated_at = v_now
            WHERE id = v_subscription.id;
        ELSE
            -- Historical invoice payment, subscription remains past_due
            v_final_subscription_status := 'past_due';
            v_final_past_due_since := v_subscription.past_due_since;
        END IF;
    ELSIF v_subscription.status = 'non_renewing' THEN
        v_final_subscription_status := 'non_renewing';
        v_final_past_due_since := NULL;
        IF v_should_advance_period THEN
            v_final_current_period_start := p_period_start;
            v_final_current_period_end := p_period_end;
            v_final_next_renewal_at := NULL;

            UPDATE public.billing_subscriptions
            SET current_period_start = v_final_current_period_start,
                current_period_end = v_final_current_period_end,
                next_renewal_at = NULL,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
    ELSIF v_subscription.status IN ('expired', 'cancelled') THEN
        v_final_subscription_status := v_subscription.status;
        v_final_past_due_since := NULL;
    END IF;

    -- Update provider subscription mapping
    UPDATE public.billing_provider_subscriptions
    SET next_payment_at = CASE
            WHEN v_subscription.auto_renew_enabled IS FALSE THEN NULL
            WHEN p_next_payment_date IS NOT NULL
                 AND (
                     next_payment_at IS NULL
                     OR p_next_payment_date > next_payment_at
                 )
                THEN p_next_payment_date
            ELSE next_payment_at
        END,
        last_synced_at = v_now,
        updated_at = v_now
    WHERE id = v_provider_subscription.id;

    -- 11. Mark Webhook Processed
    UPDATE public.billing_webhook_events
    SET processing_status = 'processed',
        processed_at = v_now,
        updated_at = v_now
    WHERE id = v_webhook_event_id;

    -- 12. Append Immutable Ledger Entries
    IF v_record_invoice_paid_ledger THEN
        v_ledger_event_type := 'billing_invoice_paid';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':paid';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'payment_id', v_payment_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_invoice_status,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'paid_at', p_paid_at,
            'occurred_at', p_occurred_at,
            'invoice_status', 'paid',
            'subscription_status', v_final_subscription_status
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
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    IF v_record_payment_succeeded_ledger AND v_payment_id IS NOT NULL THEN
        v_ledger_event_type := 'renewal_payment_succeeded';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':payment:' || COALESCE(v_provider_transaction_id, v_provider_reference) || ':succeeded';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'payment_id', v_payment_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_reference', v_payment_ref,
            'provider_transaction_id', v_provider_transaction_id,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'paid_at', p_paid_at,
            'purpose', 'renewal'
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
            RAISE EXCEPTION 'Ledger deduplication key collision for payment %.', COALESCE(v_provider_transaction_id, v_provider_reference)
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
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    IF v_record_subscription_recovered_ledger THEN
        v_ledger_event_type := CASE
            WHEN v_final_subscription_status = 'active'
                THEN 'subscription_recovered_to_active'
            ELSE 'subscription_recovered_to_non_renewing'
        END;
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':subscription_recovered';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'payment_id', v_payment_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'occurred_at', p_occurred_at,
            'previous_status', 'past_due',
            'current_status', v_final_subscription_status,
            'cleared_past_due_since', v_subscription.past_due_since,
            'current_period_start', v_final_current_period_start,
            'current_period_end', v_final_current_period_end,
            'next_renewal_at', v_final_next_renewal_at
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
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    -- 13. Return Single Row Result
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_invoice_id,
        v_payment_id,
        v_provider_subscription.id,
        v_subscription.id,
        v_provider_invoice_code,
        v_invoice_status,
        v_payment_status,
        v_final_subscription_status,
        p_amount_minor,
        v_currency,
        v_final_current_period_start,
        v_final_current_period_end,
        v_final_next_renewal_at,
        v_final_past_due_since,
        v_is_reused AS is_reused,
        v_is_ignored AS is_ignored;

    RETURN;
END;
$process_paystack_invoice_update_success$;

REVOKE ALL
ON FUNCTION public.process_paystack_invoice_update_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_invoice_update_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_invoice_update_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified successful Paystack invoice.update webhook event, materializing or transitioning invoices to paid, recording or reconciling renewal payments, advancing only newer subscription billing periods, recovering past_due subscriptions without re-enabling disabled renewal, and appending immutable ledger events.';

COMMIT;
