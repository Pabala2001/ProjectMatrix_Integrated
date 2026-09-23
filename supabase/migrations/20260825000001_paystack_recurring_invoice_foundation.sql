-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4E-1A
-- Migration: Paystack Recurring Subscription Invoice Foundation
-- Filename: 20260825000001_paystack_recurring_invoice_foundation.sql
-- Description:
--   Creates public.billing_invoices lifecycle projection table,
--   adds invoice foreign key & purpose checks to public.billing_payments,
--   scopes payment reference uniqueness by (provider, environment, provider_reference),
--   adds past_due_since to public.billing_subscriptions with update protections.
-- ============================================================================

-- 1. Prerequisites: Ensure composite unique keys on parent tables for foreign key references
BEGIN;
ALTER TABLE public.billing_subscriptions
    ADD CONSTRAINT uq_billing_subscriptions_company_scope
    UNIQUE (id, company_id);

ALTER TABLE public.billing_provider_subscriptions
    ADD CONSTRAINT uq_provider_subscriptions_invoice_scope
    UNIQUE (id, company_id, subscription_id, provider, environment);


-- ============================================================================
-- 2. Create public.billing_invoices
-- ============================================================================

CREATE TABLE public.billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    provider_subscription_record_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    provider_invoice_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_status TEXT,

    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,

    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,

    first_failed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    -- Foreign keys with strict ON DELETE RESTRICT
    CONSTRAINT fk_billing_invoices_company
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_billing_invoices_subscription_scope
        FOREIGN KEY (subscription_id, company_id)
        REFERENCES public.billing_subscriptions(id, company_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_billing_invoices_provider_sub_scope
        FOREIGN KEY (
            provider_subscription_record_id,
            company_id,
            subscription_id,
            provider,
            environment
        )
        REFERENCES public.billing_provider_subscriptions(
            id,
            company_id,
            subscription_id,
            provider,
            environment
        )
        ON DELETE RESTRICT,

    -- Exact semantic uniqueness on (provider, environment, provider_invoice_code)
    CONSTRAINT uq_billing_invoices_provider_code
        UNIQUE (provider, environment, provider_invoice_code),

    -- Supports composite payment foreign key
    CONSTRAINT uq_billing_invoices_payment_scope
        UNIQUE (id, company_id, subscription_id, provider, environment),

    -- Check constraints
    CONSTRAINT chk_billing_invoices_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_billing_invoices_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_billing_invoices_code_format
        CHECK (
            provider_invoice_code ~ '^INV_[a-zA-Z0-9_\-]+$'
            AND pg_catalog.char_length(pg_catalog.btrim(provider_invoice_code)) >= 5
        ),

    CONSTRAINT chk_billing_invoices_status
        CHECK (status IN ('pending', 'failed', 'paid')),

    CONSTRAINT chk_billing_invoices_provider_status
        CHECK (
            provider_status IS NULL
            OR (
                pg_catalog.char_length(pg_catalog.btrim(provider_status)) > 0
                AND pg_catalog.char_length(provider_status) <= 50
            )
        ),

    CONSTRAINT chk_billing_invoices_amount_positive
        CHECK (amount_minor > 0),

    CONSTRAINT chk_billing_invoices_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    -- Period integrity: both null or both non-null with end > start
    CONSTRAINT chk_billing_invoices_period_dates
        CHECK (
            (period_start IS NULL AND period_end IS NULL)
            OR (period_start IS NOT NULL AND period_end IS NOT NULL AND period_end > period_start)
        ),

    CONSTRAINT chk_billing_invoices_paid_period
        CHECK (
            status <> 'paid'
            OR (period_start IS NOT NULL AND period_end IS NOT NULL)
        ),

    -- Timestamp and status coherence
    CONSTRAINT chk_billing_invoices_pending_timestamps
        CHECK (
            status <> 'pending'
            OR paid_at IS NULL
        ),

    CONSTRAINT chk_billing_invoices_failed_timestamps
        CHECK (
            status <> 'failed'
            OR (first_failed_at IS NOT NULL AND paid_at IS NULL)
        ),

    CONSTRAINT chk_billing_invoices_paid_timestamps
        CHECK (
            status <> 'paid'
            OR paid_at IS NOT NULL
        )
);

-- Performance and lookup indexes
CREATE INDEX idx_billing_invoices_company_created
    ON public.billing_invoices (company_id, created_at DESC);

CREATE INDEX idx_billing_invoices_subscription_created
    ON public.billing_invoices (subscription_id, created_at DESC);

CREATE INDEX idx_billing_invoices_provider_sub
    ON public.billing_invoices (provider_subscription_record_id);

CREATE INDEX idx_billing_invoices_status
    ON public.billing_invoices (status);

CREATE INDEX idx_billing_invoices_period
    ON public.billing_invoices (period_start, period_end)
    WHERE period_start IS NOT NULL;


-- ============================================================================
-- 3. Row-Level Security & Privileges for public.billing_invoices
-- ============================================================================

ALTER TABLE public.billing_invoices
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_invoices
    FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow members with billing access to view company invoices"
    ON public.billing_invoices
    FOR SELECT
    TO authenticated
    USING (public.verify_billing_access(company_id) IS TRUE);

REVOKE ALL
    ON TABLE public.billing_invoices
    FROM PUBLIC, anon, authenticated;

GRANT SELECT
    ON TABLE public.billing_invoices
    TO authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_invoices
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_invoices
    FROM service_role;

COMMENT ON TABLE public.billing_invoices IS
'Stores provider-neutral recurring subscription invoice projections, protected by RLS and immutable state triggers.';


-- ============================================================================
-- 4. Immutability and State Transition Triggers for public.billing_invoices
-- ============================================================================

CREATE TRIGGER trg_billing_invoices_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_invoices
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();


CREATE OR REPLACE FUNCTION public.protect_billing_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_invoice_update$
BEGIN
    -- 1. Identity and commercial snapshot fields are immutable
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
       OR NEW.provider_subscription_record_id IS DISTINCT FROM OLD.provider_subscription_record_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.provider_invoice_code IS DISTINCT FROM OLD.provider_invoice_code
       OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Invoice identity and commercial fields are immutable';
    END IF;

    -- 2. State transition matrix validation
    -- Allowed: pending -> failed, pending -> paid, failed -> paid, or same status
    IF OLD.status = 'pending' AND NEW.status NOT IN ('pending', 'failed', 'paid') THEN
        RAISE EXCEPTION 'Invalid invoice status transition from pending to %', NEW.status
            USING ERRCODE = '55000';
    ELSIF OLD.status = 'failed' AND NEW.status NOT IN ('failed', 'paid') THEN
        RAISE EXCEPTION 'Invalid invoice status transition from failed to %', NEW.status
            USING ERRCODE = '55000';
    ELSIF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
        RAISE EXCEPTION 'Invalid invoice status transition from paid to %', NEW.status
            USING ERRCODE = '55000';
    END IF;

    -- 3. Period immutability: once set, period_start and period_end cannot be changed
    IF OLD.period_start IS NOT NULL THEN
        IF NEW.period_start IS DISTINCT FROM OLD.period_start
           OR NEW.period_end IS DISTINCT FROM OLD.period_end
        THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'Invoice billing period is immutable once established';
        END IF;
    ELSIF NEW.period_start IS NOT NULL THEN
        -- Transitioning from null to populated
        IF NEW.period_end IS NULL OR NEW.period_end <= NEW.period_start THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'Invoice period_end must be strictly greater than period_start';
        END IF;
    END IF;

    -- 4. first_failed_at immutability and rules
    IF OLD.first_failed_at IS NOT NULL THEN
        IF NEW.first_failed_at IS DISTINCT FROM OLD.first_failed_at THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'first_failed_at cannot be modified or cleared once recorded';
        END IF;
    ELSIF NEW.status = 'failed' AND NEW.first_failed_at IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'first_failed_at is required when transitioning to failed';
    END IF;

    -- 5. paid_at immutability and rules
    IF OLD.paid_at IS NOT NULL THEN
        IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'paid_at cannot be modified or cleared once recorded';
        END IF;
    ELSIF NEW.status = 'paid' THEN
        IF NEW.paid_at IS NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'paid_at is required when transitioning to paid';
        END IF;
        IF NEW.period_start IS NULL OR NEW.period_end IS NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'paid invoice must have non-null billing period';
        END IF;
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_invoice_update$;

REVOKE ALL
    ON FUNCTION public.protect_billing_invoice_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_invoice_update()
    TO service_role;

CREATE TRIGGER trg_billing_invoices_protect_update
BEFORE UPDATE
ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_invoice_update();


-- ============================================================================
-- 5. Link Payments to Invoices and Update Payment Protections
-- ============================================================================

-- Add billing_invoice_id column
ALTER TABLE public.billing_payments
    ADD COLUMN billing_invoice_id UUID;

-- Enforce scope foreign key
ALTER TABLE public.billing_payments
    ADD CONSTRAINT fk_billing_payments_invoice_scope
        FOREIGN KEY (
            billing_invoice_id,
            company_id,
            subscription_id,
            provider,
            environment
        )
        REFERENCES public.billing_invoices(
            id,
            company_id,
            subscription_id,
            provider,
            environment
        )
        ON DELETE RESTRICT;

-- Index for invoice-to-payment lookup
CREATE INDEX idx_billing_payments_invoice
    ON public.billing_payments (billing_invoice_id)
    WHERE billing_invoice_id IS NOT NULL;

-- Enforce purpose requirements: renewal requires invoice link, activation does not
ALTER TABLE public.billing_payments
    ADD CONSTRAINT chk_billing_payments_purpose_invoice
        CHECK (
            purpose <> 'renewal'
            OR billing_invoice_id IS NOT NULL
        );

-- Update protect_billing_payment_update() to enforce one-way invoice binding
CREATE OR REPLACE FUNCTION public.protect_billing_payment_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_payment_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.provider_plan_mapping_id
            IS DISTINCT FROM OLD.provider_plan_mapping_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.purpose IS DISTINCT FROM OLD.purpose
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
       OR NEW.provider_reference IS DISTINCT FROM OLD.provider_reference
       OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Payment identity and commercial fields are immutable';
    END IF;

    -- One-way invoice binding: null may become a non-null invoice ID once; never cleared or changed
    IF OLD.billing_invoice_id IS NOT NULL AND NEW.billing_invoice_id IS DISTINCT FROM OLD.billing_invoice_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Payment invoice linkage cannot be changed or cleared once set';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_payment_update$;


-- ============================================================================
-- 6. Environment-Scoped Payment Uniqueness
-- ============================================================================

-- Replace global provider_reference uniqueness with (provider, environment, provider_reference)
ALTER TABLE public.billing_payments
    DROP CONSTRAINT IF EXISTS uq_billing_payments_provider_reference;

ALTER TABLE public.billing_payments
    ADD CONSTRAINT uq_billing_payments_provider_env_reference
        UNIQUE (provider, environment, provider_reference);


-- ============================================================================
-- 7. Add past_due_since to public.billing_subscriptions and protect updates
-- ============================================================================

ALTER TABLE public.billing_subscriptions
    ADD COLUMN past_due_since TIMESTAMPTZ;

ALTER TABLE public.billing_subscriptions
    ADD CONSTRAINT chk_billing_subscriptions_past_due_since
        CHECK (past_due_since IS NULL OR status = 'past_due');

CREATE INDEX idx_billing_subscriptions_past_due_since
    ON public.billing_subscriptions (past_due_since)
    WHERE status = 'past_due';

CREATE OR REPLACE FUNCTION public.protect_billing_subscription_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_subscription_update$
BEGIN
    -- 1. Identity and commercial snapshot fields are immutable
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.subscription_reference IS DISTINCT FROM OLD.subscription_reference
       OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Subscription identity and commercial fields are immutable';
    END IF;

    -- 2. past_due_since management:
    -- If status is past_due, past_due_since may be set or maintained.
    -- If status is leaving past_due, past_due_since is cleared.
    -- If status is not past_due, setting past_due_since is rejected.
    IF NEW.status <> 'past_due' THEN
        IF NEW.past_due_since IS NOT NULL THEN
            IF OLD.status = 'past_due' THEN
                NEW.past_due_since := NULL;
            ELSE
                RAISE EXCEPTION USING
                    ERRCODE = '55000',
                    MESSAGE = 'past_due_since can only be populated when subscription status is past_due';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_subscription_update$;

REVOKE ALL
    ON FUNCTION public.protect_billing_subscription_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_subscription_update()
    TO service_role;

DROP TRIGGER IF EXISTS trg_billing_subscriptions_protect_update ON public.billing_subscriptions;
CREATE TRIGGER trg_billing_subscriptions_protect_update
BEFORE UPDATE
ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_subscription_update();
COMMIT;