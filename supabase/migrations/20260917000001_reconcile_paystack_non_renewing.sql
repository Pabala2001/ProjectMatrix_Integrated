BEGIN;

-- Service-only recovery after a fresh authenticated Paystack GET confirms
-- non-renewing. This is a reconciliation, not a signed webhook replay.
CREATE OR REPLACE FUNCTION public.reconcile_paystack_non_renewing(
    p_company_id uuid,
    p_provider_record_id uuid,
    p_environment text,
    p_provider_subscription_code text,
    p_provider_subscription_id text,
    p_provider_customer_code text,
    p_snapshot_started_at timestamptz,
    p_next_payment_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_provider public.billing_provider_subscriptions%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;
    v_now timestamptz := clock_timestamp();
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Only the billing service may reconcile provider state.' USING ERRCODE = '42501';
    END IF;
    IF p_company_id IS NULL OR p_provider_record_id IS NULL
       OR p_environment IS NULL OR p_environment NOT IN ('test', 'live')
       OR p_provider_subscription_code IS NULL OR p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$'
       OR p_provider_subscription_id IS NULL OR p_provider_subscription_id !~ '^[0-9]+$'
       OR p_provider_customer_code IS NULL OR p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
       OR p_snapshot_started_at IS NULL
       OR p_snapshot_started_at < v_now - interval '2 minutes'
       OR p_snapshot_started_at > v_now + interval '5 seconds' THEN
        RAISE EXCEPTION 'Invalid or stale provider verification.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_provider FROM public.billing_provider_subscriptions
    WHERE id = p_provider_record_id AND company_id = p_company_id
      AND provider = 'paystack' AND environment = p_environment
      AND provider_subscription_code = p_provider_subscription_code
      AND provider_customer_code = p_provider_customer_code
      AND is_current AND disabled_at IS NULL
    FOR UPDATE;
    IF NOT FOUND OR v_provider.provider_subscription_id IS DISTINCT FROM p_provider_subscription_id THEN
        RAISE EXCEPTION 'Current provider subscription identity mismatch.' USING ERRCODE = '23514';
    END IF;
    IF v_provider.provider_status NOT IN ('active', 'attention', 'non-renewing') THEN
        RAISE EXCEPTION 'Provider lifecycle changed; verify again.' USING ERRCODE = '40001';
    END IF;
    IF v_provider.updated_at > p_snapshot_started_at THEN
        RAISE EXCEPTION 'Provider record changed during verification; retry.' USING ERRCODE = '40001';
    END IF;

    SELECT * INTO v_subscription FROM public.billing_subscriptions
    WHERE id = v_provider.subscription_id AND company_id = p_company_id
      AND plan_id = v_provider.plan_id FOR UPDATE;
    IF NOT FOUND OR v_subscription.status NOT IN ('active', 'non_renewing', 'past_due') THEN
        RAISE EXCEPTION 'Subscription lifecycle cannot be reconciled by this operation.' USING ERRCODE = '23514';
    END IF;
    IF v_subscription.updated_at > p_snapshot_started_at THEN
        RAISE EXCEPTION 'Subscription changed during verification; retry.' USING ERRCODE = '40001';
    END IF;
    IF v_provider.provider_status = 'non-renewing'
       AND NOT v_subscription.auto_renew_enabled
       AND v_subscription.status IN ('non_renewing', 'past_due') THEN
        RETURN jsonb_build_object('ok', true, 'changed', false, 'auto_renew_enabled', false);
    END IF;

    -- Preserve all payment records, paid-period boundaries and entitlements.
    UPDATE public.billing_subscriptions
    SET auto_renew_enabled = false,
        status = CASE WHEN status = 'active' THEN 'non_renewing' ELSE status END,
        updated_at = v_now
    WHERE id = v_subscription.id;
    UPDATE public.billing_provider_subscriptions
    SET provider_status = 'non-renewing', next_payment_at = p_next_payment_at,
        last_synced_at = v_now, updated_at = v_now
    WHERE id = v_provider.id;

    INSERT INTO public.billing_ledger_events (
        company_id, subscription_id, event_type, event_source, occurred_at, event_data
    ) VALUES (
        p_company_id, v_subscription.id, 'provider_subscription_non_renewing_reconciled',
        'reconciliation', v_now,
        jsonb_build_object(
            'provider', 'paystack', 'environment', p_environment,
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', 'non-renewing', 'auto_renew_enabled', false,
            'verification_source', 'authenticated_provider_get',
            'snapshot_started_at', p_snapshot_started_at,
            'timestamp_basis', 'server_observation',
            'previous_subscription_status', v_subscription.status,
            'previous_provider_status', v_provider.provider_status
        )
    );
    RETURN jsonb_build_object('ok', true, 'changed', true, 'auto_renew_enabled', false);
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_paystack_non_renewing(uuid, uuid, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_paystack_non_renewing(uuid, uuid, text, text, text, text, timestamptz, timestamptz) TO service_role;
COMMIT;
