-- ============================================================================
-- Migration: Immutable Billing Ledger Events
-- Filename: 20260729000003_billing_ledger_events.sql
-- Description: Creates public.billing_ledger_events table for recording append-only,
--              cryptographically sequenced, immutable subscription and billing audit events.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_ledger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_number BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL,
    event_source TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    deduplication_key TEXT,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Constraints
    CONSTRAINT uq_billing_ledger_events_seq UNIQUE (sequence_number),
    CONSTRAINT chk_billing_ledger_events_event_type_non_empty CHECK (char_length(btrim(event_type)) > 0),
    CONSTRAINT chk_billing_ledger_events_event_source CHECK (
        event_source IN ('user', 'system', 'paystack_webhook', 'reconciliation')
    ),
    CONSTRAINT chk_billing_ledger_events_data_is_object CHECK (jsonb_typeof(event_data) = 'object'),
    CONSTRAINT chk_billing_ledger_events_dedup_non_empty CHECK (
        deduplication_key IS NULL OR char_length(btrim(deduplication_key)) > 0
    )
);

-- Unique non-null deduplication index
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_ledger_events_dedup_key
    ON public.billing_ledger_events (deduplication_key)
    WHERE deduplication_key IS NOT NULL;

-- Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_billing_ledger_company_recorded
    ON public.billing_ledger_events (company_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_ledger_sub_recorded
    ON public.billing_ledger_events (subscription_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_ledger_event_type
    ON public.billing_ledger_events (event_type);

-- ----------------------------------------------------------------------------
-- Immutability Enforcement (Triggers)
-- ----------------------------------------------------------------------------

-- 1. Prevent UPDATE or DELETE on ledger rows
CREATE OR REPLACE FUNCTION public.prevent_billing_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'billing_ledger_events rows are immutable and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_ledger_events_immutable ON public.billing_ledger_events;
CREATE TRIGGER trg_billing_ledger_events_immutable
    BEFORE UPDATE OR DELETE ON public.billing_ledger_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_billing_ledger_mutation();

-- 2. Prevent TRUNCATE on the entire table
CREATE OR REPLACE FUNCTION public.prevent_billing_ledger_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'billing_ledger_events table is append-only and cannot be truncated.';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_ledger_events_prevent_truncate ON public.billing_ledger_events;
CREATE TRIGGER trg_billing_ledger_events_prevent_truncate
    BEFORE TRUNCATE ON public.billing_ledger_events
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_billing_ledger_truncate();

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) & Permissions
-- ----------------------------------------------------------------------------

ALTER TABLE public.billing_ledger_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members with billing access to view billing ledger events"
    ON public.billing_ledger_events
    FOR SELECT
    TO authenticated
    USING (public.verify_billing_access(company_id) IS TRUE);

REVOKE ALL ON public.billing_ledger_events FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.billing_ledger_events FROM authenticated;
GRANT SELECT ON public.billing_ledger_events TO authenticated;

COMMENT ON TABLE public.billing_ledger_events IS 
'Immutable append-only ledger for all billing, subscription lifecycle, and reconciliation events.';
