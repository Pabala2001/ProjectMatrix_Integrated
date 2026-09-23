-- ============================================================================
-- ProjectMatrix Billing Phase 3A.1
-- Paystack payment foundation: plans, payments, webhooks and subscriptions
-- Raw card data is never stored. Verified webhook JSON is server-only.
-- ============================================================================

-- Required for the company/plan-safe composite payment foreign key.
ALTER TABLE public.billing_subscriptions
    ADD CONSTRAINT uq_billing_subscriptions_payment_scope
    UNIQUE (id, company_id, plan_id);


-- ============================================================================
-- 1. Provider plan mappings
-- ============================================================================

CREATE TABLE public.billing_provider_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    plan_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    provider_plan_code TEXT NOT NULL,
    provider_plan_id TEXT,

    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    billing_interval TEXT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    CONSTRAINT fk_billing_provider_plans_plan
        FOREIGN KEY (plan_id)
        REFERENCES public.billing_plans(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_billing_provider_plans_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_billing_provider_plans_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_billing_provider_plans_code_non_empty
        CHECK (pg_catalog.char_length(pg_catalog.btrim(provider_plan_code)) > 0),

    CONSTRAINT chk_billing_provider_plans_id_non_empty
        CHECK (
            provider_plan_id IS NULL
            OR pg_catalog.char_length(pg_catalog.btrim(provider_plan_id)) > 0
        ),

    CONSTRAINT chk_billing_provider_plans_amount_positive
        CHECK (amount_minor > 0),

    CONSTRAINT chk_billing_provider_plans_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_billing_provider_plans_interval
        CHECK (billing_interval = 'monthly'),

    CONSTRAINT uq_billing_provider_plans_provider_code
        UNIQUE (provider, environment, provider_plan_code),

    -- Supports the composite payment foreign key.
    CONSTRAINT uq_billing_provider_plans_payment_scope
        UNIQUE (id, plan_id, provider, environment)
);

CREATE UNIQUE INDEX uq_billing_provider_plans_provider_id
    ON public.billing_provider_plans (
        provider,
        environment,
        provider_plan_id
    )
    WHERE provider_plan_id IS NOT NULL;

CREATE UNIQUE INDEX uq_billing_provider_plans_active
    ON public.billing_provider_plans (
        plan_id,
        provider,
        environment
    )
    WHERE is_active IS TRUE;

CREATE INDEX idx_billing_provider_plans_plan
    ON public.billing_provider_plans (plan_id);

CREATE INDEX idx_billing_provider_plans_environment_active
    ON public.billing_provider_plans (environment, is_active);


-- ============================================================================
-- 2. Payment attempts
-- ============================================================================

CREATE TABLE public.billing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    provider_plan_mapping_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,
    purpose TEXT NOT NULL,

    idempotency_key UUID NOT NULL,
    provider_reference TEXT NOT NULL,
    provider_transaction_id TEXT,

    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    customer_email TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'initialized',

    checkout_url TEXT,
    access_code TEXT,

    error_code TEXT,
    error_message TEXT,

    initiated_by_profile_id UUID,

    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    -- Ensures the subscription, company and plan belong together.
    CONSTRAINT fk_billing_payments_subscription_scope
        FOREIGN KEY (subscription_id, company_id, plan_id)
        REFERENCES public.billing_subscriptions(id, company_id, plan_id)
        ON DELETE RESTRICT,

    -- Prevents test/live, provider or plan mapping mismatches.
    CONSTRAINT fk_billing_payments_provider_plan_scope
        FOREIGN KEY (
            provider_plan_mapping_id,
            plan_id,
            provider,
            environment
        )
        REFERENCES public.billing_provider_plans(
            id,
            plan_id,
            provider,
            environment
        )
        ON DELETE RESTRICT,

    CONSTRAINT fk_billing_payments_initiated_by
        FOREIGN KEY (initiated_by_profile_id)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_billing_payments_idempotency_key
        UNIQUE (idempotency_key),

    CONSTRAINT uq_billing_payments_provider_reference
        UNIQUE (provider_reference),

    CONSTRAINT chk_billing_payments_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_billing_payments_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_billing_payments_purpose
        CHECK (purpose IN ('activation', 'renewal')),

    CONSTRAINT chk_billing_payments_reference_non_empty
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_reference)
            ) > 0
        ),

    CONSTRAINT chk_billing_payments_transaction_id_non_empty
        CHECK (
            provider_transaction_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_transaction_id)
            ) > 0
        ),

    CONSTRAINT chk_billing_payments_amount_positive
        CHECK (amount_minor > 0),

    CONSTRAINT chk_billing_payments_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_billing_payments_email_non_empty
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(customer_email)
            ) > 0
        ),

    CONSTRAINT chk_billing_payments_status
        CHECK (
            status IN (
                'initialized',
                'pending',
                'succeeded',
                'failed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_billing_payments_checkout_url_non_empty
        CHECK (
            checkout_url IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(checkout_url)
            ) > 0
        ),

    CONSTRAINT chk_billing_payments_access_code_non_empty
        CHECK (
            access_code IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(access_code)
            ) > 0
        )
);

CREATE UNIQUE INDEX uq_billing_payments_provider_transaction
    ON public.billing_payments (
        provider,
        environment,
        provider_transaction_id
    )
    WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX idx_billing_payments_company_created
    ON public.billing_payments (company_id, created_at DESC);

CREATE INDEX idx_billing_payments_subscription_created
    ON public.billing_payments (subscription_id, created_at DESC);

CREATE INDEX idx_billing_payments_provider_plan
    ON public.billing_payments (provider_plan_mapping_id);

CREATE INDEX idx_billing_payments_status
    ON public.billing_payments (status);


-- ============================================================================
-- Server-only security for provider plans and payments
-- ============================================================================

ALTER TABLE public.billing_provider_plans
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_provider_plans
    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_payments
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_payments
    FORCE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.billing_provider_plans
    FROM PUBLIC, anon, authenticated;

REVOKE ALL
    ON TABLE public.billing_payments
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_provider_plans
    TO service_role;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_payments
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_provider_plans
    FROM service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_payments
    FROM service_role;

-- ============================================================================
-- 3. Durable Paystack webhook inbox
-- ============================================================================

CREATE TABLE public.billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    payload_sha256 TEXT NOT NULL,
    provider_event_id TEXT,
    event_type TEXT NOT NULL,
    provider_object_id TEXT,

    raw_payload JSONB NOT NULL,
    signature_verified BOOLEAN NOT NULL,

    processing_status TEXT NOT NULL DEFAULT 'received',
    processing_attempts INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,

    received_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    processing_started_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    CONSTRAINT chk_billing_webhook_events_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_billing_webhook_events_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_billing_webhook_events_payload_hash
        CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),

    CONSTRAINT chk_billing_webhook_events_event_type
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(event_type)
            ) > 0
        ),

    CONSTRAINT chk_billing_webhook_events_provider_event_id
        CHECK (
            provider_event_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_event_id)
            ) > 0
        ),

    CONSTRAINT chk_billing_webhook_events_provider_object_id
        CHECK (
            provider_object_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_object_id)
            ) > 0
        ),

    CONSTRAINT chk_billing_webhook_events_payload_object
        CHECK (pg_catalog.jsonb_typeof(raw_payload) = 'object'),

    CONSTRAINT chk_billing_webhook_events_processing_status
        CHECK (
            processing_status IN (
                'received',
                'processing',
                'processed',
                'failed',
                'ignored'
            )
        ),

    CONSTRAINT chk_billing_webhook_events_attempts
        CHECK (processing_attempts >= 0),

    CONSTRAINT chk_billing_webhook_events_verified_before_processed
        CHECK (
            processing_status <> 'processed'
            OR signature_verified IS TRUE
        ),

    CONSTRAINT chk_billing_webhook_events_error_message
        CHECK (
            error_message IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(error_message)
            ) > 0
        ),

    CONSTRAINT uq_billing_webhook_events_payload
        UNIQUE (provider, environment, payload_sha256)
);

CREATE UNIQUE INDEX uq_billing_webhook_events_provider_event
    ON public.billing_webhook_events (
        provider,
        environment,
        provider_event_id
    )
    WHERE provider_event_id IS NOT NULL;

CREATE INDEX idx_billing_webhook_events_status_received
    ON public.billing_webhook_events (
        processing_status,
        received_at
    );

CREATE INDEX idx_billing_webhook_events_event_type
    ON public.billing_webhook_events (
        provider,
        environment,
        event_type
    );

CREATE INDEX idx_billing_webhook_events_provider_object
    ON public.billing_webhook_events (
        provider,
        environment,
        provider_object_id
    )
    WHERE provider_object_id IS NOT NULL;


-- Server-only security

ALTER TABLE public.billing_webhook_events
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_webhook_events
    FORCE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.billing_webhook_events
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_webhook_events
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_webhook_events
    FROM service_role;

-- ============================================================================
-- 4. Paystack subscription mappings
-- ============================================================================

CREATE TABLE public.billing_provider_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    provider_plan_mapping_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    provider_subscription_code TEXT NOT NULL,
    provider_subscription_id TEXT,

    provider_customer_code TEXT NOT NULL,
    provider_customer_id TEXT,

    email_token TEXT NOT NULL,
    customer_email TEXT NOT NULL,

    provider_status TEXT NOT NULL,
    next_payment_at TIMESTAMPTZ,

    is_current BOOLEAN NOT NULL DEFAULT true,
    disabled_at TIMESTAMPTZ,

    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    -- Ensures the company, subscription and plan belong together.
    CONSTRAINT fk_provider_subscriptions_subscription_scope
        FOREIGN KEY (subscription_id, company_id, plan_id)
        REFERENCES public.billing_subscriptions(id, company_id, plan_id)
        ON DELETE RESTRICT,

    -- Prevents plan, provider or test/live environment mismatches.
    CONSTRAINT fk_provider_subscriptions_plan_scope
        FOREIGN KEY (
            provider_plan_mapping_id,
            plan_id,
            provider,
            environment
        )
        REFERENCES public.billing_provider_plans(
            id,
            plan_id,
            provider,
            environment
        )
        ON DELETE RESTRICT,

    CONSTRAINT chk_provider_subscriptions_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_provider_subscriptions_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_provider_subscriptions_code
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_subscription_code)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_id
        CHECK (
            provider_subscription_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_subscription_id)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_customer_code
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_customer_code)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_customer_id
        CHECK (
            provider_customer_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_customer_id)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_email_token
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(email_token)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_customer_email
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(customer_email)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_status
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_status)
            ) > 0
        ),

    CONSTRAINT uq_provider_subscriptions_code
        UNIQUE (
            provider,
            environment,
            provider_subscription_code
        )
);

CREATE UNIQUE INDEX uq_provider_subscriptions_provider_id
    ON public.billing_provider_subscriptions (
        provider,
        environment,
        provider_subscription_id
    )
    WHERE provider_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX uq_provider_subscriptions_current
    ON public.billing_provider_subscriptions (
        subscription_id,
        provider,
        environment
    )
    WHERE is_current IS TRUE;

CREATE INDEX idx_provider_subscriptions_company
    ON public.billing_provider_subscriptions (company_id);

CREATE INDEX idx_provider_subscriptions_customer
    ON public.billing_provider_subscriptions (
        provider,
        environment,
        provider_customer_code
    );

CREATE INDEX idx_provider_subscriptions_next_payment
    ON public.billing_provider_subscriptions (next_payment_at)
    WHERE is_current IS TRUE;


-- Server-only security

ALTER TABLE public.billing_provider_subscriptions
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_provider_subscriptions
    FORCE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.billing_provider_subscriptions
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_provider_subscriptions
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_provider_subscriptions
    FROM service_role;

-- ============================================================================
-- 5. Paystack payment methods
-- ============================================================================

-- Supports company/environment-safe payment-method provenance.
ALTER TABLE public.billing_payments
    ADD CONSTRAINT uq_billing_payments_method_scope
    UNIQUE (id, company_id, provider, environment);


CREATE TABLE public.billing_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL,
    source_payment_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    provider_customer_code TEXT NOT NULL,
    customer_email TEXT NOT NULL,

    -- Sensitive server-only Paystack tokens.
    authorization_code TEXT NOT NULL,
    authorization_signature TEXT NOT NULL,

    -- Safe display information.
    channel TEXT NOT NULL,
    card_type TEXT NOT NULL,
    brand TEXT NOT NULL,
    bank TEXT,
    last4 VARCHAR(4) NOT NULL,
    expiry_month SMALLINT NOT NULL,
    expiry_year SMALLINT NOT NULL,
    country_code VARCHAR(2) NOT NULL,

    reusable BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    -- Ensures the source payment belongs to the same company and environment.
    CONSTRAINT fk_payment_methods_source_scope
        FOREIGN KEY (
            source_payment_id,
            company_id,
            provider,
            environment
        )
        REFERENCES public.billing_payments(
            id,
            company_id,
            provider,
            environment
        )
        ON DELETE RESTRICT,

    CONSTRAINT chk_payment_methods_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_payment_methods_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_payment_methods_customer_code
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_customer_code)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_customer_email
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(customer_email)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_authorization_code
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(authorization_code)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_signature
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(authorization_signature)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_channel
        CHECK (channel = 'card'),

    CONSTRAINT chk_payment_methods_card_type
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(card_type)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_brand
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(brand)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_bank
        CHECK (
            bank IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(bank)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_last4
        CHECK (last4 ~ '^[0-9]{4}$'),

    CONSTRAINT chk_payment_methods_expiry_month
        CHECK (expiry_month BETWEEN 1 AND 12),

    CONSTRAINT chk_payment_methods_expiry_year
        CHECK (expiry_year BETWEEN 2000 AND 9999),

    CONSTRAINT chk_payment_methods_country
        CHECK (country_code ~ '^[A-Z]{2}$'),

    CONSTRAINT chk_payment_methods_default
        CHECK (
            is_default IS FALSE
            OR (
                is_active IS TRUE
                AND reusable IS TRUE
            )
        ),

    CONSTRAINT chk_payment_methods_revoked
        CHECK (
            is_active IS TRUE
            OR revoked_at IS NOT NULL
        ),

    CONSTRAINT uq_payment_methods_authorization
        UNIQUE (
            provider,
            environment,
            authorization_code
        ),

    CONSTRAINT uq_payment_methods_signature
        UNIQUE (
            company_id,
            provider,
            environment,
            authorization_signature
        ),

    -- Supports a safe link from provider subscriptions.
    CONSTRAINT uq_payment_methods_scope
        UNIQUE (
            id,
            company_id,
            provider,
            environment
        )
);

CREATE UNIQUE INDEX uq_payment_methods_default
    ON public.billing_payment_methods (
        company_id,
        provider,
        environment
    )
    WHERE is_default IS TRUE
      AND is_active IS TRUE;

CREATE INDEX idx_payment_methods_company_active
    ON public.billing_payment_methods (
        company_id,
        is_active
    );

CREATE INDEX idx_payment_methods_source_payment
    ON public.billing_payment_methods (source_payment_id);

CREATE INDEX idx_payment_methods_expiry
    ON public.billing_payment_methods (
        expiry_year,
        expiry_month
    )
    WHERE is_active IS TRUE;


-- Link the provider subscription to its current payment method.

ALTER TABLE public.billing_provider_subscriptions
    ADD COLUMN payment_method_id UUID;

ALTER TABLE public.billing_provider_subscriptions
    ADD CONSTRAINT fk_provider_subscriptions_payment_method
    FOREIGN KEY (
        payment_method_id,
        company_id,
        provider,
        environment
    )
    REFERENCES public.billing_payment_methods(
        id,
        company_id,
        provider,
        environment
    )
    ON DELETE RESTRICT;

CREATE INDEX idx_provider_subscriptions_payment_method
    ON public.billing_provider_subscriptions (payment_method_id)
    WHERE payment_method_id IS NOT NULL;


-- Server-only security

ALTER TABLE public.billing_payment_methods
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_payment_methods
    FORCE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.billing_payment_methods
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_payment_methods
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_payment_methods
    FROM service_role;

-- ============================================================================
-- 6. Connect payment attempts to the immutable billing ledger
-- ============================================================================

-- Supports company/subscription-safe ledger references.
ALTER TABLE public.billing_payments
    ADD CONSTRAINT uq_billing_payments_ledger_scope
    UNIQUE (id, company_id, subscription_id);

ALTER TABLE public.billing_ledger_events
    ADD COLUMN payment_id UUID;

ALTER TABLE public.billing_ledger_events
    ADD CONSTRAINT fk_billing_ledger_events_payment
    FOREIGN KEY (
        payment_id,
        company_id,
        subscription_id
    )
    REFERENCES public.billing_payments(
        id,
        company_id,
        subscription_id
    )
    ON DELETE RESTRICT;

CREATE INDEX idx_billing_ledger_events_payment
    ON public.billing_ledger_events (payment_id)
    WHERE payment_id IS NOT NULL;

-- ============================================================================
-- 7. Prevent deletion of financial and provider records
-- ============================================================================

CREATE FUNCTION public.prevent_billing_foundation_deletion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $prevent_billing_foundation_deletion$
BEGIN
    RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = pg_catalog.format(
            'Deleting or truncating records from public.%I is prohibited',
            TG_TABLE_NAME
        );
END;
$prevent_billing_foundation_deletion$;

REVOKE ALL
    ON FUNCTION public.prevent_billing_foundation_deletion()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.prevent_billing_foundation_deletion()
    TO service_role;


CREATE TRIGGER trg_billing_provider_plans_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_provider_plans
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_payments_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_payments
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_webhook_events_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_webhook_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_provider_subscriptions_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_provider_subscriptions
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_payment_methods_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_payment_methods
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

-- ============================================================================
-- 8. Protect provider-plan and payment commercial data
-- ============================================================================

CREATE FUNCTION public.protect_billing_provider_plan_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_provider_plan_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.provider_plan_code IS DISTINCT FROM OLD.provider_plan_code
       OR NEW.provider_plan_id IS DISTINCT FROM OLD.provider_plan_id
       OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Provider-plan commercial fields are immutable';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_provider_plan_update$;


CREATE FUNCTION public.protect_billing_payment_update()
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

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_payment_update$;


REVOKE ALL
    ON FUNCTION public.protect_billing_provider_plan_update()
    FROM PUBLIC, anon, authenticated;

REVOKE ALL
    ON FUNCTION public.protect_billing_payment_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_provider_plan_update()
    TO service_role;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_payment_update()
    TO service_role;


CREATE TRIGGER trg_billing_provider_plans_protect_update
BEFORE UPDATE
ON public.billing_provider_plans
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_provider_plan_update();

CREATE TRIGGER trg_billing_payments_protect_update
BEFORE UPDATE
ON public.billing_payments
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_payment_update();


-- Require matching terminal timestamps.

ALTER TABLE public.billing_payments
    ADD CONSTRAINT chk_billing_payments_paid_timestamp
    CHECK (
        (status = 'succeeded' AND paid_at IS NOT NULL)
        OR (status <> 'succeeded' AND paid_at IS NULL)
    );

ALTER TABLE public.billing_payments
    ADD CONSTRAINT chk_billing_payments_failed_timestamp
    CHECK (
        (status = 'failed' AND failed_at IS NOT NULL)
        OR (status <> 'failed' AND failed_at IS NULL)
    );

ALTER TABLE public.billing_payments
    ADD CONSTRAINT chk_billing_payments_cancelled_timestamp
    CHECK (
        (status = 'cancelled' AND cancelled_at IS NOT NULL)
        OR (status <> 'cancelled' AND cancelled_at IS NULL)
    );

-- ============================================================================
-- 9. Strengthen webhook and payment-method state constraints
-- ============================================================================

-- Only signature-verified Paystack events may enter the durable inbox.
ALTER TABLE public.billing_webhook_events
    ADD CONSTRAINT chk_webhook_signature_verified
    CHECK (signature_verified IS TRUE);

ALTER TABLE public.billing_webhook_events
    ADD CONSTRAINT chk_webhook_processing_started
    CHECK (
        processing_status = 'received'
        OR processing_started_at IS NOT NULL
    );

ALTER TABLE public.billing_webhook_events
    ADD CONSTRAINT chk_webhook_processing_completed
    CHECK (
        processing_status IN ('received', 'processing')
        OR processed_at IS NOT NULL
    );

ALTER TABLE public.billing_webhook_events
    ADD CONSTRAINT chk_webhook_failed_error
    CHECK (
        processing_status <> 'failed'
        OR error_message IS NOT NULL
    );


-- Active payment methods must not have a revocation timestamp.
ALTER TABLE public.billing_payment_methods
    DROP CONSTRAINT chk_payment_methods_revoked;

ALTER TABLE public.billing_payment_methods
    ADD CONSTRAINT chk_payment_methods_revoked
    CHECK (
        (
            is_active IS TRUE
            AND revoked_at IS NULL
        )
        OR
        (
            is_active IS FALSE
            AND revoked_at IS NOT NULL
        )
    );


-- ============================================================================
-- 10. Protect immutable webhook data
-- ============================================================================

CREATE FUNCTION public.protect_billing_webhook_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_webhook_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
       OR NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id
       OR NEW.event_type IS DISTINCT FROM OLD.event_type
       OR NEW.provider_object_id IS DISTINCT FROM OLD.provider_object_id
       OR NEW.raw_payload IS DISTINCT FROM OLD.raw_payload
       OR NEW.signature_verified IS DISTINCT FROM OLD.signature_verified
       OR NEW.received_at IS DISTINCT FROM OLD.received_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Webhook identity and payload fields are immutable';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_webhook_update$;

REVOKE ALL
    ON FUNCTION public.protect_billing_webhook_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_webhook_update()
    TO service_role;

CREATE TRIGGER trg_billing_webhook_events_protect_update
BEFORE UPDATE
ON public.billing_webhook_events
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_webhook_update();


-- ============================================================================
-- 11. Protect provider-subscription identity
-- ============================================================================

CREATE FUNCTION public.protect_provider_subscription_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_provider_subscription_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.provider_plan_mapping_id
            IS DISTINCT FROM OLD.provider_plan_mapping_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.provider_subscription_code
            IS DISTINCT FROM OLD.provider_subscription_code
       OR NEW.provider_subscription_id
            IS DISTINCT FROM OLD.provider_subscription_id
       OR NEW.provider_customer_code
            IS DISTINCT FROM OLD.provider_customer_code
       OR NEW.provider_customer_id
            IS DISTINCT FROM OLD.provider_customer_id
       OR NEW.email_token IS DISTINCT FROM OLD.email_token
       OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Provider-subscription identity fields are immutable';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_provider_subscription_update$;

REVOKE ALL
    ON FUNCTION public.protect_provider_subscription_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_provider_subscription_update()
    TO service_role;

CREATE TRIGGER trg_provider_subscriptions_protect_update
BEFORE UPDATE
ON public.billing_provider_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.protect_provider_subscription_update();


-- ============================================================================
-- 12. Protect payment-method ownership and card signature
-- ============================================================================

CREATE FUNCTION public.protect_billing_payment_method_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_payment_method_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.authorization_signature
            IS DISTINCT FROM OLD.authorization_signature
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Payment-method ownership and signature are immutable';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_payment_method_update$;

REVOKE ALL
    ON FUNCTION public.protect_billing_payment_method_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_payment_method_update()
    TO service_role;

CREATE TRIGGER trg_billing_payment_methods_protect_update
BEFORE UPDATE
ON public.billing_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_payment_method_update();


-- ============================================================================
-- 13. Documentation for sensitive server-only fields
-- ============================================================================

COMMENT ON TABLE public.billing_provider_plans IS
    'Server-only mappings between ProjectMatrix billing plans and Paystack plans.';

COMMENT ON TABLE public.billing_payments IS
    'Server-only payment attempts recorded before contacting Paystack.';

COMMENT ON TABLE public.billing_webhook_events IS
    'Immutable Paystack webhook inbox containing signature-verified payloads.';

COMMENT ON TABLE public.billing_provider_subscriptions IS
    'Server-only mapping between ProjectMatrix and Paystack subscriptions.';

COMMENT ON TABLE public.billing_payment_methods IS
    'Server-only Paystack authorization tokens and masked card information.';

COMMENT ON COLUMN
    public.billing_provider_subscriptions.email_token IS
    'Sensitive Paystack token used to enable or disable a subscription.';

COMMENT ON COLUMN
    public.billing_payment_methods.authorization_code IS
    'Sensitive reusable Paystack authorization token. Never expose to clients.';

COMMENT ON COLUMN
    public.billing_payment_methods.authorization_signature IS
    'Stable Paystack payment-instrument identifier used for deduplication.';

COMMENT ON COLUMN
    public.billing_payment_methods.last4 IS
    'Display-safe final four card digits. Full card numbers are never stored.';

COMMENT ON COLUMN
    public.billing_webhook_events.raw_payload IS
    'Signature-verified Paystack webhook JSON. Accessible only server-side.';


-- ============================================================================
-- 14. Final privilege enforcement
-- ============================================================================

REVOKE ALL
    ON TABLE
        public.billing_provider_plans,
        public.billing_payments,
        public.billing_webhook_events,
        public.billing_provider_subscriptions,
        public.billing_payment_methods
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE
        public.billing_provider_plans,
        public.billing_payments,
        public.billing_webhook_events,
        public.billing_provider_subscriptions,
        public.billing_payment_methods
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE
        public.billing_provider_plans,
        public.billing_payments,
        public.billing_webhook_events,
        public.billing_provider_subscriptions,
        public.billing_payment_methods
    FROM service_role;

-- ============================================================================
-- 15. Final financial-integrity corrections
-- ============================================================================

-- A payment must use the exact commercial snapshot of its provider-plan map.
ALTER TABLE public.billing_provider_plans
    ADD CONSTRAINT uq_billing_provider_plans_commercial_scope
    UNIQUE (
        id,
        plan_id,
        provider,
        environment,
        amount_minor,
        currency
    );

ALTER TABLE public.billing_payments
    DROP CONSTRAINT fk_billing_payments_provider_plan_scope;

ALTER TABLE public.billing_payments
    ADD CONSTRAINT fk_billing_payments_provider_plan_scope
    FOREIGN KEY (
        provider_plan_mapping_id,
        plan_id,
        provider,
        environment,
        amount_minor,
        currency
    )
    REFERENCES public.billing_provider_plans (
        id,
        plan_id,
        provider,
        environment,
        amount_minor,
        currency
    )
    ON DELETE RESTRICT;


-- A stored authorization must retain the email used by its source payment.
ALTER TABLE public.billing_payments
    ADD CONSTRAINT uq_billing_payments_method_customer_scope
    UNIQUE (
        id,
        company_id,
        provider,
        environment,
        customer_email
    );

ALTER TABLE public.billing_payment_methods
    DROP CONSTRAINT fk_payment_methods_source_scope;

ALTER TABLE public.billing_payment_methods
    ADD CONSTRAINT fk_payment_methods_source_scope
    FOREIGN KEY (
        source_payment_id,
        company_id,
        provider,
        environment,
        customer_email
    )
    REFERENCES public.billing_payments (
        id,
        company_id,
        provider,
        environment,
        customer_email
    )
    ON DELETE RESTRICT;


-- A provider subscription may only use a payment method belonging to the
-- same company, environment, Paystack customer and immutable payment email.
ALTER TABLE public.billing_payment_methods
    ADD CONSTRAINT uq_payment_methods_customer_scope
    UNIQUE (
        id,
        company_id,
        provider,
        environment,
        provider_customer_code,
        customer_email
    );

ALTER TABLE public.billing_provider_subscriptions
    DROP CONSTRAINT fk_provider_subscriptions_payment_method;

ALTER TABLE public.billing_provider_subscriptions
    ADD CONSTRAINT fk_provider_subscriptions_payment_method
    FOREIGN KEY (
        payment_method_id,
        company_id,
        provider,
        environment,
        provider_customer_code,
        customer_email
    )
    REFERENCES public.billing_payment_methods (
        id,
        company_id,
        provider,
        environment,
        provider_customer_code,
        customer_email
    )
    ON DELETE RESTRICT;


-- A new provider-plan mapping must initially match its internal plan.
-- The mapping then remains an immutable historical commercial snapshot.
CREATE FUNCTION public.validate_billing_provider_plan_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $validate_billing_provider_plan_insert$
DECLARE
    expected_amount_minor INTEGER;
    expected_currency VARCHAR(3);
    expected_billing_interval TEXT;
BEGIN
    SELECT
        plan.amount_minor,
        plan.currency,
        plan.billing_interval
    INTO
        expected_amount_minor,
        expected_currency,
        expected_billing_interval
    FROM public.billing_plans AS plan
    WHERE plan.id = NEW.plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'The billing plan does not exist';
    END IF;

    IF NEW.amount_minor IS DISTINCT FROM expected_amount_minor
       OR NEW.currency IS DISTINCT FROM expected_currency
       OR NEW.billing_interval IS DISTINCT FROM expected_billing_interval
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Provider-plan commercial values must match the internal billing plan';
    END IF;

    RETURN NEW;
END;
$validate_billing_provider_plan_insert$;

REVOKE ALL
    ON FUNCTION public.validate_billing_provider_plan_insert()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.validate_billing_provider_plan_insert()
    TO service_role;

CREATE TRIGGER trg_billing_provider_plans_validate_insert
BEFORE INSERT
ON public.billing_provider_plans
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_provider_plan_insert();


-- Authorization details may only originate from a verified successful charge.
CREATE FUNCTION public.validate_billing_payment_method_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $validate_billing_payment_method_source$
DECLARE
    source_status TEXT;
    source_email TEXT;
BEGIN
    SELECT
        payment.status,
        payment.customer_email
    INTO
        source_status,
        source_email
    FROM public.billing_payments AS payment
    WHERE payment.id = NEW.source_payment_id
      AND payment.company_id = NEW.company_id
      AND payment.provider = NEW.provider
      AND payment.environment = NEW.environment;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'The source payment does not match this payment method';
    END IF;

    IF source_status <> 'succeeded' THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Payment methods may only be stored from successful payments';
    END IF;

    IF NEW.customer_email IS DISTINCT FROM source_email THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Payment-method email must match the source payment email';
    END IF;

    RETURN NEW;
END;
$validate_billing_payment_method_source$;

REVOKE ALL
    ON FUNCTION public.validate_billing_payment_method_source()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.validate_billing_payment_method_source()
    TO service_role;

CREATE TRIGGER trg_billing_payment_methods_validate_source
BEFORE INSERT OR UPDATE
ON public.billing_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_payment_method_source();


-- Prevent late or out-of-order events from regressing payment state.
CREATE FUNCTION public.validate_billing_payment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $validate_billing_payment_status_transition$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
           (OLD.status = 'initialized'
                AND NEW.status IN ('pending', 'succeeded', 'failed', 'cancelled'))
           OR
           (OLD.status = 'pending'
                AND NEW.status IN ('succeeded', 'failed', 'cancelled'))
           OR
           (OLD.status IN ('failed', 'cancelled')
                AND NEW.status = 'succeeded')
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Invalid billing payment status transition: %s -> %s',
                OLD.status,
                NEW.status
            );
    END IF;

    RETURN NEW;
END;
$validate_billing_payment_status_transition$;

REVOKE ALL
    ON FUNCTION public.validate_billing_payment_status_transition()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.validate_billing_payment_status_transition()
    TO service_role;

CREATE TRIGGER trg_billing_payments_validate_status_transition
BEFORE UPDATE
ON public.billing_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_payment_status_transition();


-- Processed/ignored webhooks are terminal; failed webhooks may be retried.
CREATE FUNCTION public.validate_billing_webhook_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $validate_billing_webhook_transition$
BEGIN
    IF NEW.processing_attempts < OLD.processing_attempts THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Webhook processing attempts cannot decrease';
    END IF;

    IF NEW.processing_status IS DISTINCT FROM OLD.processing_status
       AND NOT (
           (OLD.processing_status = 'received'
                AND NEW.processing_status IN ('processing', 'processed', 'failed', 'ignored'))
           OR
           (OLD.processing_status = 'processing'
                AND NEW.processing_status IN ('processed', 'failed', 'ignored'))
           OR
           (OLD.processing_status = 'failed'
                AND NEW.processing_status IN ('processing', 'ignored'))
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Invalid webhook processing transition: %s -> %s',
                OLD.processing_status,
                NEW.processing_status
            );
    END IF;

    RETURN NEW;
END;
$validate_billing_webhook_transition$;

REVOKE ALL
    ON FUNCTION public.validate_billing_webhook_transition()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.validate_billing_webhook_transition()
    TO service_role;

CREATE TRIGGER trg_billing_webhook_events_validate_transition
BEFORE UPDATE
ON public.billing_webhook_events
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_webhook_transition();

-- ============================================================================
-- End Phase 3A.1
-- ============================================================================