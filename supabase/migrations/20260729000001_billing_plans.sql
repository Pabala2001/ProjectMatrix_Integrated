-- ============================================================================
-- Migration: Billing Plans Table
-- Filename: 20260729000001_billing_plans.sql
-- Description: Creates public.billing_plans table for storing subscription catalogue plans.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    billing_interval TEXT NOT NULL,
    trial_days INTEGER NOT NULL DEFAULT 0,
    cancel_anytime BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    paystack_plan_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraints
    CONSTRAINT uq_billing_plans_code UNIQUE (code),
    CONSTRAINT chk_billing_plans_code_non_empty CHECK (char_length(btrim(code)) > 0),
    CONSTRAINT chk_billing_plans_name_non_empty CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT chk_billing_plans_amount_minor_positive CHECK (amount_minor > 0),
    CONSTRAINT chk_billing_plans_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_billing_plans_billing_interval CHECK (billing_interval IN ('monthly')),
    CONSTRAINT chk_billing_plans_trial_days_non_negative CHECK (trial_days >= 0)
);

-- Index for lookup by code and active status
CREATE INDEX IF NOT EXISTS idx_billing_plans_code ON public.billing_plans (code);
CREATE INDEX IF NOT EXISTS idx_billing_plans_is_active ON public.billing_plans (is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read active plans
CREATE POLICY "Allow authenticated users to read active billing plans"
    ON public.billing_plans
    FOR SELECT
    TO authenticated
    USING (is_active IS TRUE);

-- Revoke all mutations from public/anon/authenticated
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.billing_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.billing_plans TO authenticated;

-- Seed the initial Business Subscription Plan
INSERT INTO public.billing_plans (
    code,
    name,
    amount_minor,
    currency,
    billing_interval,
    trial_days,
    cancel_anytime,
    is_active,
    paystack_plan_code
) VALUES (
    'business-monthly',
    'Business Subscription Plan',
    500000,
    'ZAR',
    'monthly',
    7,
    true,
    true,
    NULL
)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.billing_plans IS 'Catalogue of subscription plans available in ProjectMatrix.';
