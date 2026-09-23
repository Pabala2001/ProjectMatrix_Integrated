-- =============================================================================
-- Migration: 20260830000001_reconcile_paystack_checkout_initialization.sql
-- Module: Billing Engine / Paystack Payment Recovery
-- Purpose: Atomically reconcile lost or ambiguous checkout initialization
--          attempts, serialize concurrent recovery, preserve ledger uniqueness,
--          prevent duplicate subscription grants, guard immediate lookup misses,
--          and permit terminal progression so subsequent attempts can proceed.
-- Status: ADDITIVE SQL FOR REVIEW ONLY (Do not execute live without sign-off)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_paystack_checkout_initialization(
    p_payment_id pg_catalog.uuid,
    p_provider_reference pg_catalog.text,
    p_target_status pg_catalog.text,
    p_provider_transaction_id pg_catalog.text DEFAULT NULL,
    p_error_code pg_catalog.text DEFAULT NULL,
    p_error_message pg_catalog.text DEFAULT NULL,
    p_allow_lookup_miss_after_seconds pg_catalog.int4 DEFAULT 900
)
RETURNS TABLE (
    payment_id pg_catalog.uuid,
    provider_reference pg_catalog.text,
    payment_status pg_catalog.text,
    checkout_url pg_catalog.text,
    is_reused pg_catalog.bool,
    is_resolved pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment public.billing_payments%ROWTYPE;
    v_now pg_catalog.timestamptz := pg_catalog.now();
    v_ledger_dedup pg_catalog.text;
BEGIN
    -- 1. Input parameter validation
    IF p_payment_id IS NULL THEN
        RAISE EXCEPTION 'p_payment_id cannot be null.'
            USING ERRCODE = '23502';
    END IF;

    IF p_provider_reference IS NULL OR p_provider_reference !~ '^PAY-[0-9]{8}-[0-9A-F]{32}$' THEN
        RAISE EXCEPTION 'p_provider_reference is invalid: %.', p_provider_reference
            USING ERRCODE = '23514';
    END IF;

    IF p_target_status IS NULL OR p_target_status NOT IN ('failed', 'cancelled') THEN
        RAISE EXCEPTION 'p_target_status must be either failed or cancelled.'
            USING ERRCODE = '23514';
    END IF;

    -- 2. Lock the target payment row to serialize concurrent recovery
    SELECT *
    INTO v_payment
    FROM public.billing_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found for reconciliation.', p_payment_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 3. Strict provider and reference verification
    IF v_payment.provider IS DISTINCT FROM 'paystack' THEN
        RAISE EXCEPTION 'Payment % is not a Paystack payment.', v_payment.id
            USING ERRCODE = '23514';
    END IF;

    IF v_payment.provider_reference IS DISTINCT FROM p_provider_reference THEN
        RAISE EXCEPTION 'Provider reference mismatch: expected %, got %.', v_payment.provider_reference, p_provider_reference
            USING ERRCODE = '23514';
    END IF;

    -- 4. If payment is already terminal (succeeded, failed, cancelled), return idempotent snapshot
    IF v_payment.status IN ('succeeded', 'failed', 'cancelled') THEN
        RETURN QUERY
        SELECT
            v_payment.id,
            v_payment.provider_reference,
            v_payment.status,
            v_payment.checkout_url,
            TRUE,  -- is_reused
            TRUE;  -- is_resolved
        RETURN;
    END IF;

    -- 5. Rule 6 Guard: Do not treat an immediate provider lookup miss as conclusive proof
    IF p_error_code = 'PAYSTACK_REFERENCE_NOT_FOUND_TERMINAL' OR p_error_code = 'PAYSTACK_LOOKUP_MISS' THEN
        IF v_payment.created_at >= (v_now - (COALESCE(p_allow_lookup_miss_after_seconds, 900) || ' seconds')::pg_catalog.interval) THEN
            -- Within immediate grace window: remain initialized/pending, unresolved
            RETURN QUERY
            SELECT
                v_payment.id,
                v_payment.provider_reference,
                v_payment.status,
                v_payment.checkout_url,
                TRUE,   -- is_reused
                FALSE;  -- is_resolved (still pending/recovery-required)
            RETURN;
        END IF;
    END IF;

    -- 6. Transition to definitive terminal state (failed or cancelled)
    UPDATE public.billing_payments
    SET
        status = p_target_status,
        failed_at = CASE WHEN p_target_status = 'failed' THEN v_now ELSE failed_at END,
        cancelled_at = CASE WHEN p_target_status = 'cancelled' THEN v_now ELSE cancelled_at END,
        error_code = COALESCE(p_error_code, 'PAYSTACK_TERMINAL_RECOVERY'),
        error_message = p_error_message,
        provider_transaction_id = COALESCE(p_provider_transaction_id, provider_transaction_id),
        updated_at = v_now
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    -- 7. Record immutable ledger event with deduplication key
    v_ledger_dedup := 'payment_' || p_target_status || ':' || v_payment.id::pg_catalog.text;

    INSERT INTO public.billing_ledger_events (
        company_id,
        subscription_id,
        payment_id,
        event_type,
        deduplication_key,
        amount_minor,
        currency,
        description,
        metadata
    ) VALUES (
        v_payment.company_id,
        v_payment.subscription_id,
        v_payment.id,
        CASE WHEN p_target_status = 'failed' THEN 'payment_failed' ELSE 'payment_cancelled' END,
        v_ledger_dedup,
        v_payment.amount_minor,
        v_payment.currency,
        COALESCE(p_error_message, 'Paystack checkout attempt marked ' || p_target_status || ' via recovery reconciliation.'),
        jsonb_build_object(
            'provider', 'paystack',
            'provider_reference', v_payment.provider_reference,
            'reconciled_at', v_now,
            'error_code', p_error_code
        )
    )
    ON CONFLICT (deduplication_key) DO NOTHING;

    -- 8. Return finalized terminal state
    RETURN QUERY
    SELECT
        v_payment.id,
        v_payment.provider_reference,
        v_payment.status,
        v_payment.checkout_url,
        FALSE, -- is_reused (first state transition)
        TRUE;  -- is_resolved
END;
$$;

COMMENT ON FUNCTION public.reconcile_paystack_checkout_initialization IS
'Atomically reconciles an ambiguous or lost Paystack checkout initialization attempt. Locks the payment row, enforces provider reference integrity, rejects premature lookup-miss termination within the grace window, updates terminal state, writes an immutable ledger event, and unblocks subsequent subscription attempts.';

REVOKE ALL ON FUNCTION public.reconcile_paystack_checkout_initialization(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reconcile_paystack_checkout_initialization(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4
) TO authenticated, service_role;
