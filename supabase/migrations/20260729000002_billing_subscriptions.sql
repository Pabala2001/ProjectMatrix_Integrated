-- ============================================================================
-- Migration: Billing Subscriptions Table
-- Filename: 20260729000002_billing_subscriptions.sql
-- Description: Creates public.billing_subscriptions table for tracking company-level
--              subscription lifecycles, commercial snapshots, and trial/period boundaries.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE RESTRICT,
    subscription_reference TEXT NOT NULL,
    status TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    billing_interval TEXT NOT NULL,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    next_renewal_at TIMESTAMPTZ,
    auto_renew_enabled BOOLEAN NOT NULL DEFAULT false,
    notice_message TEXT,
    cancelled_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Integrity Constraints
    CONSTRAINT uq_billing_subscriptions_reference UNIQUE (subscription_reference),
    CONSTRAINT chk_billing_subscriptions_ref_non_empty CHECK (char_length(btrim(subscription_reference)) > 0),
    CONSTRAINT chk_billing_subscriptions_status CHECK (
        status IN (
            'pending_activation',
            'trialing',
            'active',
            'non_renewing',
            'past_due',
            'expired',
            'cancelled'
        )
    ),
    CONSTRAINT chk_billing_subscriptions_amount_minor_positive CHECK (amount_minor > 0),
    CONSTRAINT chk_billing_subscriptions_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_billing_subscriptions_billing_interval CHECK (billing_interval IN ('monthly')),
    CONSTRAINT chk_billing_subscriptions_trial_dates CHECK (
        trial_ends_at IS NULL 
        OR trial_started_at IS NULL 
        OR trial_ends_at >= trial_started_at
    ),
    CONSTRAINT chk_billing_subscriptions_period_dates CHECK (
        current_period_end IS NULL 
        OR current_period_start IS NULL 
        OR current_period_end >= current_period_start
    )
);

-- Partial unique index ensuring at most ONE current subscription per company
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_subscriptions_active_company
    ON public.billing_subscriptions (company_id)
    WHERE status IN ('pending_activation', 'trialing', 'active', 'non_renewing', 'past_due');

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_company_id ON public.billing_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_plan_id ON public.billing_subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_reference ON public.billing_subscriptions (subscription_reference);

-- Enable Row Level Security (RLS)
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can view company subscriptions only if authorized by verify_billing_access
CREATE POLICY "Allow members with billing access to view company subscription"
    ON public.billing_subscriptions
    FOR SELECT
    TO authenticated
    USING (public.verify_billing_access(company_id) IS TRUE);

-- Restrict mutations from client roles
REVOKE ALL ON public.billing_subscriptions FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.billing_subscriptions FROM authenticated;
GRANT SELECT ON public.billing_subscriptions TO authenticated;

COMMENT ON TABLE public.billing_subscriptions IS 
'Stores commercial subscription lifecycles per company, scoped to public.verify_billing_access authorization.';
