-- ============================================================================
-- ProjectMatrix Billing Phase 3A.2 — Step 3A
-- Migration: 20260820000003_record_paystack_checkout_session.sql
-- Description: Creates an atomic, idempotent Paystack checkout session
--              recording RPC.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.record_paystack_checkout_session(
    p_payment_id pg_catalog.uuid,
    p_provider_reference pg_catalog.text,
    p_checkout_url pg_catalog.text,
    p_access_code pg_catalog.text
)
RETURNS TABLE (
    payment_id pg_catalog.uuid,
    provider_reference pg_catalog.text,
    payment_status pg_catalog.text,
    checkout_url pg_catalog.text,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $record_paystack_checkout_session$
DECLARE
    v_payment public.billing_payments%ROWTYPE;
    v_now pg_catalog.timestamptz;
    v_deduplication_key pg_catalog.text;
BEGIN
    -- 1. Reject null parameters.
    IF p_payment_id IS NULL THEN
        RAISE EXCEPTION
            'Payment ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    IF p_provider_reference IS NULL THEN
        RAISE EXCEPTION
            'Provider reference cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    IF p_checkout_url IS NULL THEN
        RAISE EXCEPTION
            'Checkout URL cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    IF p_access_code IS NULL THEN
        RAISE EXCEPTION
            'Access code cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- 2. Reject empty values and surrounding whitespace. Values received from
    --    Paystack must be stored exactly; this function never normalizes them.
    IF pg_catalog.char_length(p_provider_reference) = 0
       OR p_provider_reference IS DISTINCT FROM
            pg_catalog.btrim(p_provider_reference)
    THEN
        RAISE EXCEPTION
            'Provider reference cannot be empty or contain surrounding whitespace.'
            USING ERRCODE = '22000';
    END IF;

    IF pg_catalog.char_length(p_checkout_url) = 0
       OR p_checkout_url IS DISTINCT FROM
            pg_catalog.btrim(p_checkout_url)
    THEN
        RAISE EXCEPTION
            'Checkout URL cannot be empty or contain surrounding whitespace.'
            USING ERRCODE = '22000';
    END IF;

    IF pg_catalog.char_length(p_access_code) = 0
       OR p_access_code IS DISTINCT FROM
            pg_catalog.btrim(p_access_code)
    THEN
        RAISE EXCEPTION
            'Access code cannot be empty or contain surrounding whitespace.'
            USING ERRCODE = '22000';
    END IF;

    -- 3. Reject embedded whitespace and control characters in provider values.
    IF p_checkout_url ~ '[[:space:][:cntrl:]]' THEN
        RAISE EXCEPTION
            'Checkout URL cannot contain whitespace or control characters.'
            USING ERRCODE = '22000';
    END IF;

    IF p_access_code ~ '[[:space:][:cntrl:]]' THEN
        RAISE EXCEPTION
            'Access code cannot contain whitespace or control characters.'
            USING ERRCODE = '22000';
    END IF;

    -- 4. Enforce expected formats and reasonable storage bounds.
    IF p_provider_reference !~ '^PAY-[0-9]{8}-[0-9A-F]{32}$' THEN
        RAISE EXCEPTION
            'Invalid provider reference format: %.',
            p_provider_reference
            USING ERRCODE = '22000';
    END IF;

    IF p_checkout_url !~ '^https://checkout[.]paystack[.]com/' THEN
        RAISE EXCEPTION
            'Checkout URL must begin with "https://checkout.paystack.com/".'
            USING ERRCODE = '22000';
    END IF;

    IF pg_catalog.char_length(p_checkout_url) > 2048 THEN
        RAISE EXCEPTION
            'Checkout URL exceeds the maximum length of 2048 characters.'
            USING ERRCODE = '22000';
    END IF;

    IF pg_catalog.char_length(p_access_code) > 255 THEN
        RAISE EXCEPTION
            'Access code exceeds the maximum length of 255 characters.'
            USING ERRCODE = '22000';
    END IF;

    -- 5. Lock the target payment for the complete state evaluation, update and
    --    ledger append transaction.
    SELECT payment.*
    INTO v_payment
    FROM public.billing_payments AS payment
    WHERE payment.id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Billing payment with ID % was not found.',
            p_payment_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 6. Confirm that the response belongs to this Paystack payment.
    IF v_payment.provider IS DISTINCT FROM 'paystack' THEN
        RAISE EXCEPTION
            'Payment % uses provider "%"; only "paystack" is supported.',
            p_payment_id,
            v_payment.provider
            USING ERRCODE = '22023';
    END IF;

    IF v_payment.provider_reference IS DISTINCT FROM
        p_provider_reference
    THEN
        RAISE EXCEPTION
            'Provider reference "%" does not match payment %.',
            p_provider_reference,
            p_payment_id
            USING ERRCODE = '23514';
    END IF;

    v_deduplication_key :=
        'payment_pending:' || v_payment.id::pg_catalog.text;

    -- 7. An exact replay of an already-recorded session is a no-op.
    IF v_payment.status = 'pending' THEN
        IF v_payment.checkout_url IS DISTINCT FROM p_checkout_url
           OR v_payment.access_code IS DISTINCT FROM p_access_code
        THEN
            RAISE EXCEPTION
                'Conflicting checkout session details for pending payment %.',
                p_payment_id
                USING ERRCODE = '23505';
        END IF;

        -- A replay is valid only if the deduplication key identifies the exact
        -- ledger event expected for this payment and tenant scope.
        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_deduplication_key
              AND event.payment_id IS NOT DISTINCT FROM v_payment.id
              AND event.company_id IS NOT DISTINCT FROM
                    v_payment.company_id
              AND event.subscription_id IS NOT DISTINCT FROM
                    v_payment.subscription_id
              AND event.event_type = 'payment_pending'
              AND event.event_source = 'system'
        ) THEN
            NULL;

        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_deduplication_key
        ) THEN
            RAISE EXCEPTION
                'Ledger deduplication key collision for payment %.',
                p_payment_id
                USING ERRCODE = '23505';

        ELSE
            -- Repair a genuinely missing event. If a concurrent or malformed
            -- row claims the key, the unique index raises and this call rolls
            -- back instead of silently accepting the collision.
            v_now := pg_catalog.now();

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
                'payment_pending',
                'system',
                v_now,
                v_now,
                v_payment.initiated_by_profile_id,
                v_deduplication_key,
                pg_catalog.jsonb_build_object(
                    'payment_id',
                    v_payment.id,
                    'provider_reference',
                    v_payment.provider_reference,
                    'provider',
                    v_payment.provider,
                    'environment',
                    v_payment.environment,
                    'purpose',
                    v_payment.purpose,
                    'status',
                    'pending'
                )
            );
        END IF;

        RETURN QUERY
        SELECT
            v_payment.id,
            v_payment.provider_reference,
            v_payment.status,
            v_payment.checkout_url,
            TRUE;

        RETURN;
    END IF;

    -- 8. Only an initialized payment may create a checkout session.
    IF v_payment.status IN ('succeeded', 'failed', 'cancelled') THEN
        RAISE EXCEPTION
            'Payment % is in terminal state "%".',
            p_payment_id,
            v_payment.status
            USING ERRCODE = '23514';

    ELSIF v_payment.status <> 'initialized' THEN
        RAISE EXCEPTION
            'Payment % is in invalid checkout state "%".',
            p_payment_id,
            v_payment.status
            USING ERRCODE = '23514';
    END IF;

    IF v_payment.checkout_url IS NOT NULL
       OR v_payment.access_code IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Initialized payment % already contains checkout details.',
            p_payment_id
            USING ERRCODE = '23514';
    END IF;

    -- 9. Persist the Paystack session and append the linked ledger event in
    --    this single database transaction.
    v_now := pg_catalog.now();

    UPDATE public.billing_payments AS payment
    SET
        status = 'pending',
        checkout_url = p_checkout_url,
        access_code = p_access_code
    WHERE payment.id = v_payment.id
      AND payment.status = 'initialized'
    RETURNING payment.*
    INTO v_payment;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Payment % could not transition from initialized to pending.',
            p_payment_id
            USING ERRCODE = '40001';
    END IF;

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
        'payment_pending',
        'system',
        v_now,
        v_now,
        v_payment.initiated_by_profile_id,
        v_deduplication_key,
        pg_catalog.jsonb_build_object(
            'payment_id',
            v_payment.id,
            'provider_reference',
            v_payment.provider_reference,
            'provider',
            v_payment.provider,
            'environment',
            v_payment.environment,
            'purpose',
            v_payment.purpose,
            'status',
            v_payment.status
        )
    );

    -- 10. Return only the Edge Function contract. access_code is deliberately
    --     stored but never returned by this RPC.
    RETURN QUERY
    SELECT
        v_payment.id,
        v_payment.provider_reference,
        v_payment.status,
        v_payment.checkout_url,
        FALSE;

    RETURN;
END;
$record_paystack_checkout_session$;

REVOKE ALL
ON FUNCTION public.record_paystack_checkout_session(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.record_paystack_checkout_session(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text
)
TO service_role;

COMMENT ON FUNCTION public.record_paystack_checkout_session(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text
) IS
'Atomically records an active Paystack checkout session and transitions an initialized payment to pending.';

COMMIT;