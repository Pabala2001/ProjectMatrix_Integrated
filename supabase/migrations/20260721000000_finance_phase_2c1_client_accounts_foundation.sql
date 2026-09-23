-- =============================================================================
-- MIGRATION: Phase 2C.1 Client Accounts Database Foundation
-- FILE: supabase/migrations/20260721000000_finance_phase_2c1_client_accounts_foundation.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. PREREQUISITE ASSERTS & VERIFICATION
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    v_tbl text;
BEGIN
    IF to_regprocedure('public.has_finance_full_access(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Prerequisite function public.has_finance_full_access(uuid) does not exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies'
    ) THEN
        RAISE EXCEPTION 'Prerequisite table public.companies does not exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects'
    ) THEN
        RAISE EXCEPTION 'Prerequisite table public.projects does not exist.';
    END IF;

    -- Verify public.projects has a unique key supporting (id, company_id)
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'projects'
          AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        GROUP BY tc.constraint_name
        HAVING array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) IN (ARRAY['id', 'company_id'], ARRAY['company_id', 'id'])
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'projects' AND i.indisunique
        AND (
            SELECT array_agg(a.attname::text ORDER BY ordinality)
            FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality)
            JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
        ) IN (ARRAY['id', 'company_id'], ARRAY['company_id', 'id'])
    ) THEN
        RAISE EXCEPTION 'Prerequisite table public.projects does not have a unique constraint supporting (id, company_id).';
    END IF;

    -- Verify Phase 2B.1 tables exist and have status, is_archived, updated_by, updated_at
    FOR v_tbl IN SELECT unnest(ARRAY['project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts']) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl
        ) THEN
            RAISE EXCEPTION 'Prerequisite table public.% does not exist.', v_tbl;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'status'
        ) OR NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'is_archived'
        ) OR NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'updated_by'
        ) OR NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'updated_at'
        ) THEN
            RAISE EXCEPTION 'Prerequisite table public.% is missing required columns (status, is_archived, updated_by, updated_at).', v_tbl;
        END IF;
    END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 1. CORE CLIENT ACCOUNTS TABLES (NO IF NOT EXISTS TO PREVENT SILENT SKIPPING)
-- -----------------------------------------------------------------------------

-- 1.1 CLIENT ACCOUNTS
CREATE TABLE public.client_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    client_code text NOT NULL,
    legal_name text NOT NULL,
    trading_name text,
    registration_number text,
    vat_number text,
    billing_email text,
    billing_phone text,
    billing_address text,
    payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    credit_limit numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
    currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    is_archived boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_client_accounts_code UNIQUE (company_id, client_code),
    CONSTRAINT uq_ca_comp_client UNIQUE (id, company_id)
);


-- 1.2 PROJECT CLIENT CONTRACTS
CREATE TABLE public.project_client_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    client_account_id uuid NOT NULL,
    contract_number text NOT NULL,
    contract_title text NOT NULL,
    purchase_order_reference text,
    original_contract_value_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (original_contract_value_excl_vat >= 0),
    approved_variations_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (approved_variations_excl_vat >= 0),
    current_contract_value_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (current_contract_value_excl_vat >= 0),
    contract_start_date date,
    contract_end_date date,
    payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    default_vat_rate numeric(5,2) NOT NULL DEFAULT 15.00 CHECK (default_vat_rate >= 0.00 AND default_vat_rate <= 100.00),
    notes text,
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Closed', 'Cancelled')),
    is_primary boolean NOT NULL DEFAULT false,
    is_archived boolean NOT NULL DEFAULT false,
    activated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    activated_at timestamptz,
    closed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    closed_at timestamptz,
    cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    cancelled_at timestamptz,
    cancellation_reason text,
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_pcc_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT fk_pcc_client FOREIGN KEY (client_account_id, company_id) REFERENCES public.client_accounts(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT chk_pcc_dates CHECK (contract_end_date IS NULL OR contract_start_date IS NULL OR contract_end_date >= contract_start_date),
    CONSTRAINT uq_pcc_contract_number UNIQUE (company_id, contract_number),
    CONSTRAINT uq_pcc_comp_proj_client UNIQUE (id, company_id, project_id, client_account_id)
);

CREATE UNIQUE INDEX uq_pcc_primary_per_project 
ON public.project_client_contracts (company_id, project_id) 
WHERE (is_primary = true AND is_archived = false);


-- 1.3 CLIENT INVOICES
CREATE TABLE public.client_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    client_account_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    invoice_number text,
    external_reference text,
    payment_certificate_reference text,
    invoice_date date NOT NULL DEFAULT CURRENT_DATE,
    due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')::date,
    billing_period_start date,
    billing_period_end date,
    subtotal_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (subtotal_excl_vat >= 0),
    vat_amount numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (vat_amount >= 0),
    total_incl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (total_incl_vat >= 0),
    currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
    notes text,
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Issued', 'Rejected', 'Cancelled')),
    is_archived boolean NOT NULL DEFAULT false,
    submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    submitted_at timestamptz,
    approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    approved_at timestamptz,
    issued_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    issued_at timestamptz,
    rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    rejected_at timestamptz,
    rejection_reason text,
    cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    cancelled_at timestamptz,
    cancellation_reason text,
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_ci_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ci_client FOREIGN KEY (client_account_id, company_id) REFERENCES public.client_accounts(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ci_contract FOREIGN KEY (contract_id, company_id, project_id, client_account_id) REFERENCES public.project_client_contracts(id, company_id, project_id, client_account_id) ON DELETE RESTRICT,
    CONSTRAINT chk_ci_dates CHECK (due_date >= invoice_date),
    CONSTRAINT chk_ci_billing_period CHECK (billing_period_end IS NULL OR billing_period_start IS NULL OR billing_period_end >= billing_period_start),
    CONSTRAINT uq_ci_comp_proj UNIQUE (id, company_id, project_id),
    CONSTRAINT uq_ci_comp_proj_client UNIQUE (id, company_id, project_id, client_account_id),
    CONSTRAINT uq_ci_full_context UNIQUE (id, company_id, project_id, client_account_id, contract_id)
);

CREATE UNIQUE INDEX uq_client_invoices_number 
ON public.client_invoices (company_id, invoice_number) 
WHERE (invoice_number IS NOT NULL AND invoice_number <> '');


-- 1.4 CLIENT INVOICE LINES
CREATE TABLE public.client_invoice_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    line_code text NOT NULL,
    description text NOT NULL,
    quantity numeric(15,4) NOT NULL DEFAULT 1.0000 CHECK (quantity > 0),
    unit text NOT NULL DEFAULT 'item',
    unit_rate_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (unit_rate_excl_vat >= 0),
    vat_rate numeric(5,2) NOT NULL DEFAULT 15.00 CHECK (vat_rate >= 0.00 AND vat_rate <= 100.00),
    amount_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (amount_excl_vat >= 0),
    vat_amount numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (vat_amount >= 0),
    amount_incl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (amount_incl_vat >= 0),
    sort_order integer NOT NULL DEFAULT 0,
    is_archived boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_cil_invoice FOREIGN KEY (invoice_id, company_id, project_id) REFERENCES public.client_invoices(id, company_id, project_id) ON DELETE RESTRICT
);


-- 1.5 CLIENT CREDIT NOTES
CREATE TABLE public.client_credit_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    client_account_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    credit_note_number text,
    external_reference text,
    credit_note_date date NOT NULL DEFAULT CURRENT_DATE,
    reason text NOT NULL,
    subtotal_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (subtotal_excl_vat >= 0),
    vat_amount numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (vat_amount >= 0),
    total_incl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (total_incl_vat >= 0),
    currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Issued', 'Rejected', 'Cancelled')),
    is_archived boolean NOT NULL DEFAULT false,
    submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    submitted_at timestamptz,
    approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    approved_at timestamptz,
    issued_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    issued_at timestamptz,
    rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    rejected_at timestamptz,
    rejection_reason text,
    cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    cancelled_at timestamptz,
    cancellation_reason text,
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_ccn_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ccn_client FOREIGN KEY (client_account_id, company_id) REFERENCES public.client_accounts(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ccn_contract FOREIGN KEY (contract_id, company_id, project_id, client_account_id) REFERENCES public.project_client_contracts(id, company_id, project_id, client_account_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ccn_invoice FOREIGN KEY (invoice_id, company_id, project_id, client_account_id, contract_id) REFERENCES public.client_invoices(id, company_id, project_id, client_account_id, contract_id) ON DELETE RESTRICT,
    CONSTRAINT uq_ccn_comp_proj UNIQUE (id, company_id, project_id),
    CONSTRAINT uq_ccn_comp_proj_client UNIQUE (id, company_id, project_id, client_account_id)
);

CREATE UNIQUE INDEX uq_client_credit_notes_number 
ON public.client_credit_notes (company_id, credit_note_number) 
WHERE (credit_note_number IS NOT NULL AND credit_note_number <> '');


-- 1.6 CLIENT CREDIT NOTE LINES
CREATE TABLE public.client_credit_note_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    credit_note_id uuid NOT NULL,
    line_code text NOT NULL,
    description text NOT NULL,
    quantity numeric(15,4) NOT NULL DEFAULT 1.0000 CHECK (quantity > 0),
    unit text NOT NULL DEFAULT 'item',
    unit_rate_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (unit_rate_excl_vat >= 0),
    vat_rate numeric(5,2) NOT NULL DEFAULT 15.00 CHECK (vat_rate >= 0.00 AND vat_rate <= 100.00),
    amount_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (amount_excl_vat >= 0),
    vat_amount numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (vat_amount >= 0),
    amount_incl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (amount_incl_vat >= 0),
    sort_order integer NOT NULL DEFAULT 0,
    is_archived boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_ccnl_credit_note FOREIGN KEY (credit_note_id, company_id, project_id) REFERENCES public.client_credit_notes(id, company_id, project_id) ON DELETE RESTRICT
);


-- 1.7 CLIENT RECEIPTS
CREATE TABLE public.client_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    client_account_id uuid NOT NULL,
    receipt_number text NOT NULL,
    external_reference text,
    receipt_date date NOT NULL DEFAULT CURRENT_DATE,
    payment_method text NOT NULL DEFAULT 'EFT' CHECK (payment_method IN ('EFT', 'Direct Deposit', 'Credit Card', 'Cheque', 'Other')),
    amount_received numeric(15,2) NOT NULL CHECK (amount_received > 0),
    currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
    notes text,
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Posted', 'Reversed', 'Cancelled')),
    is_archived boolean NOT NULL DEFAULT false,
    posted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    posted_at timestamptz,
    reversed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    reversed_at timestamptz,
    reversal_reason text,
    cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    cancelled_at timestamptz,
    cancellation_reason text,
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_cr_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cr_client FOREIGN KEY (client_account_id, company_id) REFERENCES public.client_accounts(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT uq_client_receipts_number UNIQUE (company_id, receipt_number),
    CONSTRAINT uq_cr_comp_proj_client UNIQUE (id, company_id, project_id, client_account_id)
);


-- 1.8 CLIENT RECEIPT ALLOCATIONS
CREATE TABLE public.client_receipt_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    client_account_id uuid NOT NULL,
    receipt_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    amount_allocated numeric(15,2) NOT NULL CHECK (amount_allocated > 0),
    status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Reversed')),
    allocated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    allocated_at timestamptz NOT NULL DEFAULT now(),
    reversed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    reversed_at timestamptz,
    reversal_reason text,
    transaction_identifier text NOT NULL DEFAULT pg_current_xact_id()::text,
    CONSTRAINT fk_cra_receipt FOREIGN KEY (receipt_id, company_id, project_id, client_account_id) REFERENCES public.client_receipts(id, company_id, project_id, client_account_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cra_invoice FOREIGN KEY (invoice_id, company_id, project_id, client_account_id) REFERENCES public.client_invoices(id, company_id, project_id, client_account_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cra_client FOREIGN KEY (client_account_id, company_id) REFERENCES public.client_accounts(id, company_id) ON DELETE RESTRICT
);


-- 1.9 CLIENT ACCOUNTS AUDIT LOG
CREATE TABLE public.client_accounts_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid,
    source_table text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'ISSUE', 'POST', 'ALLOCATE', 'REVERSE', 'CANCEL', 'ACTIVATE', 'CLOSE', 'ARCHIVE', 'RESTORE')),
    old_record jsonb,
    new_record jsonb,
    changed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    changed_at timestamptz NOT NULL DEFAULT now(),
    transaction_identifier text NOT NULL DEFAULT pg_current_xact_id()::text
);


-- INDEXES FOR PERFORMANCE & QUERYING
CREATE INDEX idx_ca_company ON public.client_accounts(company_id);
CREATE INDEX idx_pcc_company_project ON public.project_client_contracts(company_id, project_id);
CREATE INDEX idx_pcc_client ON public.project_client_contracts(client_account_id);
CREATE INDEX idx_ci_company_project ON public.client_invoices(company_id, project_id);
CREATE INDEX idx_ci_client ON public.client_invoices(client_account_id);
CREATE INDEX idx_ci_status ON public.client_invoices(status);
CREATE INDEX idx_cil_invoice ON public.client_invoice_lines(invoice_id);
CREATE INDEX idx_ccn_invoice ON public.client_credit_notes(invoice_id);
CREATE INDEX idx_ccnl_credit_note ON public.client_credit_note_lines(credit_note_id);
CREATE INDEX idx_cr_company_project ON public.client_receipts(company_id, project_id);
CREATE INDEX idx_cr_client ON public.client_receipts(client_account_id);
CREATE INDEX idx_cra_receipt ON public.client_receipt_allocations(receipt_id);
CREATE INDEX idx_cra_invoice ON public.client_receipt_allocations(invoice_id);
CREATE INDEX idx_ca_audit_rec ON public.client_accounts_audit_log(source_table, record_id);


-- -----------------------------------------------------------------------------
-- 2. AUDIT LOG TRIGGER
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_client_accounts_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id uuid;
    v_project_id uuid;
    v_action text := 'UPDATE';
    v_new_json jsonb;
    v_old_json jsonb;
    v_new_status text;
    v_old_status text;
    v_new_archived boolean;
    v_old_archived boolean;
BEGIN
    v_new_json := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
    v_old_json := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;

    v_company_id := (COALESCE(v_new_json, v_old_json)->>'company_id')::uuid;
    v_project_id := (COALESCE(v_new_json, v_old_json)->>'project_id')::uuid;

    v_new_status := (v_new_json->>'status');
    v_old_status := (v_old_json->>'status');
    v_new_archived := (v_new_json->>'is_archived')::boolean;
    v_old_archived := (v_old_json->>'is_archived')::boolean;

    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'client_receipt_allocations' THEN
            v_action := 'ALLOCATE';
        ELSE
            v_action := 'INSERT';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF v_new_archived IS TRUE AND (v_old_archived IS FALSE OR v_old_archived IS NULL) THEN
            v_action := 'ARCHIVE';
        ELSIF v_new_archived IS FALSE AND v_old_archived IS TRUE THEN
            v_action := 'RESTORE';
        ELSIF v_new_status IS DISTINCT FROM v_old_status THEN
            CASE v_new_status
                WHEN 'Submitted' THEN v_action := 'SUBMIT';
                WHEN 'Approved' THEN v_action := 'APPROVE';
                WHEN 'Rejected' THEN v_action := 'REJECT';
                WHEN 'Issued' THEN v_action := 'ISSUE';
                WHEN 'Active' THEN v_action := 'ACTIVATE';
                WHEN 'Posted' THEN v_action := 'POST';
                WHEN 'Reversed' THEN v_action := 'REVERSE';
                WHEN 'Closed' THEN v_action := 'CLOSE';
                WHEN 'Cancelled' THEN v_action := 'CANCEL';
                ELSE v_action := 'UPDATE';
            END CASE;
        ELSE
            v_action := 'UPDATE';
        END IF;
    END IF;

    INSERT INTO public.client_accounts_audit_log (
        company_id,
        project_id,
        source_table,
        record_id,
        action,
        old_record,
        new_record,
        changed_by,
        changed_at,
        transaction_identifier
    ) VALUES (
        v_company_id,
        v_project_id,
        TG_TABLE_NAME,
        (COALESCE(v_new_json, v_old_json)->>'id')::uuid,
        v_action,
        v_old_json,
        v_new_json,
        auth.uid(),
        now(),
        pg_current_xact_id()::text
    );

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_client_accounts_audit_trigger() FROM PUBLIC, anon, authenticated;

-- Apply Audit Triggers (INSERT OR UPDATE only; NO DELETE)
CREATE TRIGGER trg_audit_client_accounts
    AFTER INSERT OR UPDATE ON public.client_accounts
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_audit_trigger();

CREATE TRIGGER trg_audit_project_client_contracts
    AFTER INSERT OR UPDATE ON public.project_client_contracts
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_audit_trigger();

CREATE TRIGGER trg_audit_client_invoices
    AFTER INSERT OR UPDATE ON public.client_invoices
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_audit_trigger();

CREATE TRIGGER trg_audit_client_invoice_lines
    AFTER INSERT OR UPDATE ON public.client_invoice_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_audit_trigger();

CREATE TRIGGER trg_audit_client_credit_notes
    AFTER INSERT OR UPDATE ON public.client_credit_notes
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_audit_trigger();

CREATE TRIGGER trg_audit_client_credit_note_lines
    AFTER INSERT OR UPDATE ON public.client_credit_note_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_audit_trigger();

CREATE TRIGGER trg_audit_client_receipts
    AFTER INSERT OR UPDATE ON public.client_receipts
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_audit_trigger();

CREATE TRIGGER trg_audit_client_receipt_allocations
    AFTER INSERT OR UPDATE ON public.client_receipt_allocations
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_audit_trigger();


-- -----------------------------------------------------------------------------
-- 3. CALCULATION & RECONCILIATION TRIGGERS
-- -----------------------------------------------------------------------------

-- 3.1 CONTRACT CURRENT VALUE CONTROL
CREATE OR REPLACE FUNCTION public.fn_pcc_value_calc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.current_contract_value_excl_vat := NEW.original_contract_value_excl_vat + NEW.approved_variations_excl_vat;
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_pcc_value_calc() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_pcc_value_calc
    BEFORE INSERT OR UPDATE ON public.project_client_contracts
    FOR EACH ROW EXECUTE FUNCTION public.fn_pcc_value_calc();


-- 3.2 INVOICE LINE CALCULATION (BEFORE) & HEADER RECONCILIATION (AFTER)
CREATE OR REPLACE FUNCTION public.fn_cil_before_calc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv public.client_invoices%ROWTYPE;
BEGIN
    SELECT * INTO v_inv FROM public.client_invoices WHERE id = NEW.invoice_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent invoice % does not exist.', NEW.invoice_id;
    END IF;

    IF v_inv.is_archived THEN
        RAISE EXCEPTION 'Parent invoice % is archived.', NEW.invoice_id;
    END IF;

    IF v_inv.status <> 'Draft' THEN
        RAISE EXCEPTION 'Invoice lines can only be created or modified when parent invoice is Draft (current: %).', v_inv.status;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.amount_excl_vat := ROUND(NEW.quantity * NEW.unit_rate_excl_vat, 2);
        NEW.vat_amount := ROUND(NEW.amount_excl_vat * (NEW.vat_rate / 100.0), 2);
        NEW.amount_incl_vat := NEW.amount_excl_vat + NEW.vat_amount;

        NEW.created_at := now();
        NEW.created_by := auth.uid();
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
            RAISE EXCEPTION 'Archived invoice lines are immutable.';
        END IF;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
            IF NEW.id IS DISTINCT FROM OLD.id OR
               NEW.company_id IS DISTINCT FROM OLD.company_id OR
               NEW.project_id IS DISTINCT FROM OLD.project_id OR
               NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
               NEW.line_code IS DISTINCT FROM OLD.line_code OR
               NEW.description IS DISTINCT FROM OLD.description OR
               NEW.quantity IS DISTINCT FROM OLD.quantity OR
               NEW.unit IS DISTINCT FROM OLD.unit OR
               NEW.unit_rate_excl_vat IS DISTINCT FROM OLD.unit_rate_excl_vat OR
               NEW.vat_rate IS DISTINCT FROM OLD.vat_rate OR
               NEW.amount_excl_vat IS DISTINCT FROM OLD.amount_excl_vat OR
               NEW.vat_amount IS DISTINCT FROM OLD.vat_amount OR
               NEW.amount_incl_vat IS DISTINCT FROM OLD.amount_incl_vat OR
               NEW.sort_order IS DISTINCT FROM OLD.sort_order OR
               NEW.created_by IS DISTINCT FROM OLD.created_by OR
               NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                RAISE EXCEPTION 'Simultaneous field edits are prohibited during invoice line archive or restore.';
            END IF;
        ELSE
            NEW.amount_excl_vat := ROUND(NEW.quantity * NEW.unit_rate_excl_vat, 2);
            NEW.vat_amount := ROUND(NEW.amount_excl_vat * (NEW.vat_rate / 100.0), 2);
            NEW.amount_incl_vat := NEW.amount_excl_vat + NEW.vat_amount;

            NEW.created_at := OLD.created_at;
            NEW.created_by := OLD.created_by;

            IF NEW.id IS DISTINCT FROM OLD.id OR
               NEW.company_id IS DISTINCT FROM OLD.company_id OR
               NEW.project_id IS DISTINCT FROM OLD.project_id OR
               NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
               NEW.line_code IS DISTINCT FROM OLD.line_code THEN
                RAISE EXCEPTION 'Identity fields on invoice lines are immutable.';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := now();
    NEW.updated_by := auth.uid();

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cil_before_calc() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_cil_before_calc
    BEFORE INSERT OR UPDATE ON public.client_invoice_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_cil_before_calc();


CREATE OR REPLACE FUNCTION public.fn_cil_after_reconcile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv_id uuid;
    v_subtotal numeric(15,2);
    v_vat numeric(15,2);
    v_total numeric(15,2);
BEGIN
    v_inv_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;

    SELECT 
        COALESCE(SUM(amount_excl_vat), 0.00),
        COALESCE(SUM(vat_amount), 0.00),
        COALESCE(SUM(amount_incl_vat), 0.00)
    INTO v_subtotal, v_vat, v_total
    FROM public.client_invoice_lines
    WHERE invoice_id = v_inv_id AND is_archived = false;

    UPDATE public.client_invoices
    SET subtotal_excl_vat = v_subtotal,
        vat_amount = v_vat,
        total_incl_vat = v_total,
        updated_at = now()
    WHERE id = v_inv_id;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cil_after_reconcile() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_cil_after_reconcile
    AFTER INSERT OR UPDATE OR DELETE ON public.client_invoice_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_cil_after_reconcile();


-- 3.3 CREDIT NOTE LINE CALCULATION (BEFORE) & HEADER RECONCILIATION (AFTER)
CREATE OR REPLACE FUNCTION public.fn_ccnl_before_calc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cn public.client_credit_notes%ROWTYPE;
BEGIN
    SELECT * INTO v_cn FROM public.client_credit_notes WHERE id = NEW.credit_note_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent credit note % does not exist.', NEW.credit_note_id;
    END IF;

    IF v_cn.is_archived THEN
        RAISE EXCEPTION 'Parent credit note % is archived.', NEW.credit_note_id;
    END IF;

    IF v_cn.status <> 'Draft' THEN
        RAISE EXCEPTION 'Credit note lines can only be created or modified when parent credit note is Draft (current: %).', v_cn.status;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.amount_excl_vat := ROUND(NEW.quantity * NEW.unit_rate_excl_vat, 2);
        NEW.vat_amount := ROUND(NEW.amount_excl_vat * (NEW.vat_rate / 100.0), 2);
        NEW.amount_incl_vat := NEW.amount_excl_vat + NEW.vat_amount;

        NEW.created_at := now();
        NEW.created_by := auth.uid();
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
            RAISE EXCEPTION 'Archived credit note lines are immutable.';
        END IF;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
            IF NEW.id IS DISTINCT FROM OLD.id OR
               NEW.company_id IS DISTINCT FROM OLD.company_id OR
               NEW.project_id IS DISTINCT FROM OLD.project_id OR
               NEW.credit_note_id IS DISTINCT FROM OLD.credit_note_id OR
               NEW.line_code IS DISTINCT FROM OLD.line_code OR
               NEW.description IS DISTINCT FROM OLD.description OR
               NEW.quantity IS DISTINCT FROM OLD.quantity OR
               NEW.unit IS DISTINCT FROM OLD.unit OR
               NEW.unit_rate_excl_vat IS DISTINCT FROM OLD.unit_rate_excl_vat OR
               NEW.vat_rate IS DISTINCT FROM OLD.vat_rate OR
               NEW.amount_excl_vat IS DISTINCT FROM OLD.amount_excl_vat OR
               NEW.vat_amount IS DISTINCT FROM OLD.vat_amount OR
               NEW.amount_incl_vat IS DISTINCT FROM OLD.amount_incl_vat OR
               NEW.sort_order IS DISTINCT FROM OLD.sort_order OR
               NEW.created_by IS DISTINCT FROM OLD.created_by OR
               NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                RAISE EXCEPTION 'Simultaneous field edits are prohibited during credit note line archive or restore.';
            END IF;
        ELSE
            NEW.amount_excl_vat := ROUND(NEW.quantity * NEW.unit_rate_excl_vat, 2);
            NEW.vat_amount := ROUND(NEW.amount_excl_vat * (NEW.vat_rate / 100.0), 2);
            NEW.amount_incl_vat := NEW.amount_excl_vat + NEW.vat_amount;

            NEW.created_at := OLD.created_at;
            NEW.created_by := OLD.created_by;

            IF NEW.id IS DISTINCT FROM OLD.id OR
               NEW.company_id IS DISTINCT FROM OLD.company_id OR
               NEW.project_id IS DISTINCT FROM OLD.project_id OR
               NEW.credit_note_id IS DISTINCT FROM OLD.credit_note_id OR
               NEW.line_code IS DISTINCT FROM OLD.line_code THEN
                RAISE EXCEPTION 'Identity fields on credit note lines are immutable.';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := now();
    NEW.updated_by := auth.uid();

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ccnl_before_calc() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ccnl_before_calc
    BEFORE INSERT OR UPDATE ON public.client_credit_note_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_ccnl_before_calc();


CREATE OR REPLACE FUNCTION public.fn_ccnl_after_reconcile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cn_id uuid;
    v_subtotal numeric(15,2);
    v_vat numeric(15,2);
    v_total numeric(15,2);
BEGIN
    v_cn_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.credit_note_id ELSE NEW.credit_note_id END;

    SELECT 
        COALESCE(SUM(amount_excl_vat), 0.00),
        COALESCE(SUM(vat_amount), 0.00),
        COALESCE(SUM(amount_incl_vat), 0.00)
    INTO v_subtotal, v_vat, v_total
    FROM public.client_credit_note_lines
    WHERE credit_note_id = v_cn_id AND is_archived = false;

    UPDATE public.client_credit_notes
    SET subtotal_excl_vat = v_subtotal,
        vat_amount = v_vat,
        total_incl_vat = v_total,
        updated_at = now()
    WHERE id = v_cn_id;

    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ccnl_after_reconcile() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ccnl_after_reconcile
    AFTER INSERT OR UPDATE OR DELETE ON public.client_credit_note_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_ccnl_after_reconcile();


-- -----------------------------------------------------------------------------
-- 4. WORKFLOW RPC FUNCTIONS
-- -----------------------------------------------------------------------------

-- 4.1 CONTRACT WORKFLOWS
CREATE OR REPLACE FUNCTION public.activate_client_contract(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_client_contracts%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
BEGIN
    SELECT * INTO v_rec FROM public.project_client_contracts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot activate archived contract.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Contract must be Draft to activate (current: %).', v_rec.status;
    END IF;

    -- Lock and validate stored client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client account not found.';
    END IF;
    IF v_ca_archived IS TRUE THEN
        RAISE EXCEPTION 'Cannot activate contract for an archived client account.';
    END IF;
    IF v_ca_active IS FALSE THEN
        RAISE EXCEPTION 'Cannot activate contract for an inactive client account.';
    END IF;

    UPDATE public.project_client_contracts
    SET status = 'Active',
        activated_by = auth.uid(),
        activated_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_client_contract(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_client_contracts%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.project_client_contracts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot close archived contract.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Active' THEN
        RAISE EXCEPTION 'Contract must be Active to close (current: %).', v_rec.status;
    END IF;

    UPDATE public.project_client_contracts
    SET status = 'Closed',
        closed_by = auth.uid(),
        closed_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_contract(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_client_contracts%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.project_client_contracts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel archived contract.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status NOT IN ('Draft', 'Active') THEN
        RAISE EXCEPTION 'Contract cannot be cancelled in status %.', v_rec.status;
    END IF;

    UPDATE public.project_client_contracts
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;


-- 4.2 INVOICE WORKFLOWS
CREATE OR REPLACE FUNCTION public.submit_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_pcc_status text;
    v_pcc_archived boolean;
    v_line_count integer;
BEGIN
    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot submit archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Invoice must be Draft to submit (current: %).', v_rec.status;
    END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot submit invoice for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot submit invoice for an inactive client account.'; END IF;

    -- Lock and validate contract
    SELECT status, is_archived INTO v_pcc_status, v_pcc_archived
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;
    IF v_pcc_archived IS TRUE THEN RAISE EXCEPTION 'Cannot submit invoice for an archived contract.'; END IF;
    IF v_pcc_status <> 'Active' THEN RAISE EXCEPTION 'Contract must be Active to submit invoice (current: %).', v_pcc_status; END IF;

    SELECT COUNT(*) INTO v_line_count 
    FROM public.client_invoice_lines 
    WHERE invoice_id = p_id AND is_archived = false;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'Invoice must contain at least one line item before submission.';
    END IF;

    IF v_rec.total_incl_vat <= 0 THEN
        RAISE EXCEPTION 'Invoice total must be positive to submit.';
    END IF;

    UPDATE public.client_invoices
    SET status = 'Submitted',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_pcc_status text;
    v_pcc_archived boolean;
BEGIN
    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot approve archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Invoice must be Submitted to approve (current: %).', v_rec.status;
    END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot approve invoice for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot approve invoice for an inactive client account.'; END IF;

    -- Lock and validate contract
    SELECT status, is_archived INTO v_pcc_status, v_pcc_archived
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;
    IF v_pcc_archived IS TRUE THEN RAISE EXCEPTION 'Cannot approve invoice for an archived contract.'; END IF;
    IF v_pcc_status <> 'Active' THEN RAISE EXCEPTION 'Contract must be Active to approve invoice (current: %).', v_pcc_status; END IF;

    UPDATE public.client_invoices
    SET status = 'Approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_client_invoice(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Rejection reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot reject archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Invoice must be Submitted to reject (current: %).', v_rec.status;
    END IF;

    UPDATE public.client_invoices
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_pcc_status text;
    v_pcc_archived boolean;
    v_num text;
BEGIN
    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot issue archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Approved' THEN
        RAISE EXCEPTION 'Invoice must be Approved to issue (current: %).', v_rec.status;
    END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot issue invoice for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot issue invoice for an inactive client account.'; END IF;

    -- Lock and validate contract
    SELECT status, is_archived INTO v_pcc_status, v_pcc_archived
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;
    IF v_pcc_archived IS TRUE THEN RAISE EXCEPTION 'Cannot issue invoice for an archived contract.'; END IF;
    IF v_pcc_status <> 'Active' THEN RAISE EXCEPTION 'Contract must be Active to issue invoice (current: %).', v_pcc_status; END IF;

    v_num := btrim(v_rec.invoice_number);
    IF v_num IS NULL OR v_num = '' THEN
        RAISE EXCEPTION 'Invoice number is mandatory before issuing.';
    END IF;

    UPDATE public.client_invoices
    SET status = 'Issued',
        issued_by = auth.uid(),
        issued_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_invoice(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status = 'Issued' THEN
        RAISE EXCEPTION 'Issued invoices cannot be cancelled. Issue a credit note to process corrections.';
    END IF;
    IF v_rec.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
        RAISE EXCEPTION 'Invoice cannot be cancelled in status %.', v_rec.status;
    END IF;

    UPDATE public.client_invoices
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;


-- 4.3 CREDIT NOTE WORKFLOWS
CREATE OR REPLACE FUNCTION public.submit_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_credit_notes%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_inv public.client_invoices%ROWTYPE;
    v_line_count integer;
BEGIN
    SELECT * INTO v_rec FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot submit archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Credit note must be Draft to submit (current: %).', v_rec.status;
    END IF;

    -- Lock and validate referenced invoice first
    SELECT * INTO v_inv
    FROM public.client_invoices
    WHERE id = v_rec.invoice_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
      AND contract_id = v_rec.contract_id
      AND currency = v_rec.currency
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived invoice.'; END IF;
    IF v_inv.is_archived IS TRUE THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived invoice.'; END IF;
    IF v_inv.status <> 'Issued' THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived invoice.'; END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot submit credit note for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot submit credit note for an inactive client account.'; END IF;

    -- Lock and validate contract relationship (do not reject solely because a Closed contract is archived)
    PERFORM 1
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;

    SELECT COUNT(*) INTO v_line_count 
    FROM public.client_credit_note_lines 
    WHERE credit_note_id = p_id AND is_archived = false;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'Credit note must contain at least one line item before submission.';
    END IF;

    IF v_rec.total_incl_vat <= 0 THEN
        RAISE EXCEPTION 'Credit note total must be positive to submit.';
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Submitted',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_credit_notes%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_inv public.client_invoices%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot approve archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Credit note must be Submitted to approve (current: %).', v_rec.status;
    END IF;

    -- Lock and validate referenced invoice first
    SELECT * INTO v_inv
    FROM public.client_invoices
    WHERE id = v_rec.invoice_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
      AND contract_id = v_rec.contract_id
      AND currency = v_rec.currency
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Referenced invoice must be Issued and non-archived.'; END IF;
    IF v_inv.is_archived IS TRUE THEN RAISE EXCEPTION 'Referenced invoice must be Issued and non-archived.'; END IF;
    IF v_inv.status <> 'Issued' THEN RAISE EXCEPTION 'Referenced invoice must be Issued and non-archived.'; END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot approve credit note for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot approve credit note for an inactive client account.'; END IF;

    -- Lock and validate contract relationship
    PERFORM 1
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;

    IF v_rec.total_incl_vat <= 0 THEN
        RAISE EXCEPTION 'Credit note total must be positive.';
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_client_credit_note(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_credit_notes%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Rejection reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot reject archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Credit note must be Submitted to reject (current: %).', v_rec.status;
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cn public.client_credit_notes%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_inv public.client_invoices%ROWTYPE;
    v_issued_cn_sum numeric(15,2);
    v_allocated_sum numeric(15,2);
    v_net_outstanding numeric(15,2);
    v_num text;
BEGIN
    SELECT * INTO v_cn FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_cn.is_archived THEN RAISE EXCEPTION 'Cannot issue archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_cn.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_cn.company_id;
    END IF;
    IF v_cn.status <> 'Approved' THEN
        RAISE EXCEPTION 'Credit note must be Approved to issue (current: %).', v_cn.status;
    END IF;

    v_num := btrim(v_cn.credit_note_number);
    IF v_num IS NULL OR v_num = '' THEN
        RAISE EXCEPTION 'Credit note number is mandatory before issuing.';
    END IF;

    IF v_cn.total_incl_vat <= 0 THEN
        RAISE EXCEPTION 'Credit note amount must be greater than zero to issue.';
    END IF;

    -- Lock target invoice FOR UPDATE first
    SELECT * INTO v_inv
    FROM public.client_invoices
    WHERE id = v_cn.invoice_id
      AND company_id = v_cn.company_id
      AND project_id = v_cn.project_id
      AND client_account_id = v_cn.client_account_id
      AND contract_id = v_cn.contract_id
      AND currency = v_cn.currency
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived client invoice.'; END IF;
    IF v_inv.is_archived IS TRUE THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived client invoice.'; END IF;
    IF v_inv.status <> 'Issued' THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived client invoice.'; END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_cn.client_account_id AND company_id = v_cn.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot issue credit note for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot issue credit note for an inactive client account.'; END IF;

    -- Lock and validate contract relationship
    PERFORM 1
    FROM public.project_client_contracts
    WHERE id = v_cn.contract_id
      AND company_id = v_cn.company_id
      AND project_id = v_cn.project_id
      AND client_account_id = v_cn.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;

    -- Transaction-safe balance check
    SELECT COALESCE(SUM(total_incl_vat), 0.00) INTO v_issued_cn_sum
    FROM public.client_credit_notes
    WHERE invoice_id = v_cn.invoice_id AND status = 'Issued' AND is_archived = false;

    SELECT COALESCE(SUM(amount_allocated), 0.00) INTO v_allocated_sum
    FROM public.client_receipt_allocations
    WHERE invoice_id = v_cn.invoice_id AND status = 'Active';

    v_net_outstanding := v_inv.total_incl_vat - v_issued_cn_sum - v_allocated_sum;

    IF v_cn.total_incl_vat > v_net_outstanding THEN
        RAISE EXCEPTION 'Credit note amount (ZAR %) exceeds remaining outstanding invoice balance (ZAR %).', v_cn.total_incl_vat, v_net_outstanding;
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Issued',
        issued_by = auth.uid(),
        issued_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_cn;

    RETURN to_jsonb(v_cn);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_credit_note(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_credit_notes%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
        RAISE EXCEPTION 'Credit note cannot be cancelled in status %.', v_rec.status;
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;


-- 4.4 RECEIPT WORKFLOWS
CREATE OR REPLACE FUNCTION public.post_client_receipt(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
BEGIN
    SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Receipt % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot post archived receipt.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Receipt must be Draft to post (current: %).', v_rec.status;
    END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot post receipt for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot post receipt for an inactive client account.'; END IF;

    UPDATE public.client_receipts
    SET status = 'Posted',
        posted_by = auth.uid(),
        posted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_client_receipt(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Reversal reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Receipt % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot reverse archived receipt.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Posted' THEN
        RAISE EXCEPTION 'Receipt must be Posted to reverse (current: %).', v_rec.status;
    END IF;

    -- Reversing a receipt reverses all active allocations for this receipt
    UPDATE public.client_receipt_allocations
    SET status = 'Reversed',
        reversed_by = auth.uid(),
        reversed_at = now(),
        reversal_reason = 'Receipt ' || v_rec.receipt_number || ' reversed: ' || v_reason
    WHERE receipt_id = p_id AND status = 'Active';

    UPDATE public.client_receipts
    SET status = 'Reversed',
        reversed_by = auth.uid(),
        reversed_at = now(),
        reversal_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_receipt(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Receipt % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel archived receipt.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;
    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Receipt can only be cancelled in Draft status (current: %).', v_rec.status;
    END IF;

    UPDATE public.client_receipts
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;


-- 4.5 RECEIPT ALLOCATION WORKFLOWS
CREATE OR REPLACE FUNCTION public.allocate_client_receipt(
    p_receipt_id uuid,
    p_invoice_id uuid,
    p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_inv public.client_invoices%ROWTYPE;
    v_alloc_id uuid;
    v_rec_allocated_sum numeric(15,2);
    v_unallocated_receipt numeric(15,2);
    v_issued_cn_sum numeric(15,2);
    v_inv_allocated_sum numeric(15,2);
    v_outstanding_inv numeric(15,2);
    v_result jsonb;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Allocation amount must be greater than zero.';
    END IF;

    -- Lock receipt and invoice in deterministic order to prevent deadlock
    IF p_receipt_id < p_invoice_id THEN
        SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_receipt_id FOR UPDATE;
        SELECT * INTO v_inv FROM public.client_invoices WHERE id = p_invoice_id FOR UPDATE;
    ELSE
        SELECT * INTO v_inv FROM public.client_invoices WHERE id = p_invoice_id FOR UPDATE;
        SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_receipt_id FOR UPDATE;
    END IF;

    IF v_rec.id IS NULL THEN RAISE EXCEPTION 'Receipt % not found.', p_receipt_id; END IF;
    IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invoice % not found.', p_invoice_id; END IF;

    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot allocate from an archived receipt.'; END IF;
    IF v_inv.is_archived THEN RAISE EXCEPTION 'Cannot allocate to an archived invoice.'; END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF v_rec.company_id <> v_inv.company_id OR
       v_rec.project_id <> v_inv.project_id OR
       v_rec.client_account_id <> v_inv.client_account_id OR
       v_rec.currency <> v_inv.currency THEN
        RAISE EXCEPTION 'Receipt and invoice parameters (company, project, client, currency) do not match.';
    END IF;

    IF v_rec.status <> 'Posted' THEN
        RAISE EXCEPTION 'Only Posted receipts can be allocated (current: %).', v_rec.status;
    END IF;

    IF v_inv.status <> 'Issued' THEN
        RAISE EXCEPTION 'Only Issued invoices can receive allocations (current: %).', v_inv.status;
    END IF;

    -- Check unallocated receipt balance
    SELECT COALESCE(SUM(amount_allocated), 0.00) INTO v_rec_allocated_sum
    FROM public.client_receipt_allocations
    WHERE receipt_id = p_receipt_id AND status = 'Active';

    v_unallocated_receipt := v_rec.amount_received - v_rec_allocated_sum;

    IF p_amount > v_unallocated_receipt THEN
        RAISE EXCEPTION 'Allocation amount (ZAR %) exceeds remaining unallocated receipt balance (ZAR %).', p_amount, v_unallocated_receipt;
    END IF;

    -- Check remaining outstanding invoice balance
    SELECT COALESCE(SUM(total_incl_vat), 0.00) INTO v_issued_cn_sum
    FROM public.client_credit_notes
    WHERE invoice_id = p_invoice_id AND status = 'Issued' AND is_archived = false;

    SELECT COALESCE(SUM(amount_allocated), 0.00) INTO v_inv_allocated_sum
    FROM public.client_receipt_allocations
    WHERE invoice_id = p_invoice_id AND status = 'Active';

    v_outstanding_inv := v_inv.total_incl_vat - v_issued_cn_sum - v_inv_allocated_sum;

    IF p_amount > v_outstanding_inv THEN
        RAISE EXCEPTION 'Allocation amount (ZAR %) exceeds remaining outstanding invoice balance (ZAR %).', p_amount, v_outstanding_inv;
    END IF;

    INSERT INTO public.client_receipt_allocations (
        company_id,
        project_id,
        client_account_id,
        receipt_id,
        invoice_id,
        amount_allocated,
        status,
        allocated_by,
        allocated_at,
        transaction_identifier
    ) VALUES (
        v_rec.company_id,
        v_rec.project_id,
        v_rec.client_account_id,
        p_receipt_id,
        p_invoice_id,
        p_amount,
        'Active',
        auth.uid(),
        now(),
        pg_current_xact_id()::text
    ) RETURNING to_jsonb(client_receipt_allocations.*) INTO v_result;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_client_receipt_allocation(p_allocation_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_alloc public.client_receipt_allocations%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Reversal reason is required.';
    END IF;

    SELECT * INTO v_alloc FROM public.client_receipt_allocations WHERE id = p_allocation_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Allocation % not found.', p_allocation_id; END IF;
    IF NOT public.has_finance_full_access(v_alloc.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_alloc.company_id;
    END IF;
    IF v_alloc.status <> 'Active' THEN
        RAISE EXCEPTION 'Allocation is already reversed.';
    END IF;

    UPDATE public.client_receipt_allocations
    SET status = 'Reversed',
        reversed_by = auth.uid(),
        reversed_at = now(),
        reversal_reason = v_reason
    WHERE id = p_allocation_id
    RETURNING * INTO v_alloc;

    RETURN to_jsonb(v_alloc);
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. SECURED ARCHIVE & RESTORE FUNCTION (PRESERVING PHASE 2B.1 & ADDING 2C.1)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id uuid;
    v_status text;
    v_is_active boolean;
    v_is_archived boolean;
    v_parent_id uuid;
    v_cnt integer;
    v_sql text;
    v_result jsonb;
BEGIN
    IF p_table NOT IN (
        'project_budget_versions',
        'financial_commitments',
        'financial_cost_postings',
        'project_financial_forecasts',
        'client_accounts',
        'project_client_contracts',
        'client_invoices',
        'client_credit_notes',
        'client_receipts',
        'client_invoice_lines',
        'client_credit_note_lines'
    ) THEN
        RAISE EXCEPTION 'Table % is not supported for archive.', p_table;
    END IF;

    -- Fetch record & lock
    v_sql := format('SELECT company_id, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table);
    EXECUTE v_sql INTO v_company_id, v_is_archived USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % not found in table %.', p_id, p_table;
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_company_id;
    END IF;

    IF v_is_archived IS TRUE THEN
        RAISE EXCEPTION 'Record % in table % is already archived.', p_id, p_table;
    END IF;

    -- Table-specific status & eligibility validations
    IF p_table IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts', 'project_client_contracts', 'client_invoices', 'client_credit_notes', 'client_receipts') THEN
        v_sql := format('SELECT status FROM public.%I WHERE id = $1', p_table);
        EXECUTE v_sql INTO v_status USING p_id;
    END IF;

    IF p_table = 'project_budget_versions' AND v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
        RAISE EXCEPTION 'Budget version cannot be archived in status %.', v_status;
    ELSIF p_table = 'financial_commitments' AND v_status NOT IN ('Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Financial commitment cannot be archived in status %.', v_status;
    ELSIF p_table = 'financial_cost_postings' AND v_status NOT IN ('Draft', 'Rejected') THEN
        RAISE EXCEPTION 'Cost posting cannot be archived in status %.', v_status;
    ELSIF p_table = 'project_financial_forecasts' AND v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
        RAISE EXCEPTION 'Financial forecast cannot be archived in status %.', v_status;
    ELSIF p_table = 'project_client_contracts' AND v_status NOT IN ('Draft', 'Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Contract cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_invoices' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Client invoice cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_credit_notes' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Credit note cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_receipts' AND v_status NOT IN ('Draft', 'Cancelled') THEN
        RAISE EXCEPTION 'Receipt cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_invoice_lines' THEN
        SELECT invoice_id INTO v_parent_id FROM public.client_invoice_lines WHERE id = p_id;
        SELECT status INTO v_status FROM public.client_invoices WHERE id = v_parent_id;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Invoice line cannot be archived when parent invoice status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_credit_note_lines' THEN
        SELECT credit_note_id INTO v_parent_id FROM public.client_credit_note_lines WHERE id = p_id;
        SELECT status INTO v_status FROM public.client_credit_notes WHERE id = v_parent_id;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Credit note line cannot be archived when parent credit note status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_accounts' THEN
        SELECT is_active INTO v_is_active FROM public.client_accounts WHERE id = p_id;
        IF v_is_active IS TRUE THEN
            RAISE EXCEPTION 'Client account must be marked inactive before archiving.';
        END IF;

        -- Check active contracts
        SELECT COUNT(*) INTO v_cnt FROM public.project_client_contracts WHERE client_account_id = p_id AND status = 'Active' AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Active contracts.'; END IF;

        -- Check non-terminal invoices
        SELECT COUNT(*) INTO v_cnt FROM public.client_invoices WHERE client_account_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with non-terminal invoices.'; END IF;

        -- Check non-terminal credit notes
        SELECT COUNT(*) INTO v_cnt FROM public.client_credit_notes WHERE client_account_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with non-terminal credit notes.'; END IF;

        -- Check non-terminal receipts
        SELECT COUNT(*) INTO v_cnt FROM public.client_receipts WHERE client_account_id = p_id AND status = 'Draft' AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with draft receipts.'; END IF;

        -- Check Issued invoices with outstanding balance
        SELECT COUNT(*) INTO v_cnt
        FROM (
            SELECT ci.id,
                   ci.total_incl_vat,
                   COALESCE((SELECT SUM(ccn.total_incl_vat) FROM public.client_credit_notes ccn WHERE ccn.invoice_id = ci.id AND ccn.status = 'Issued' AND ccn.is_archived = false), 0.00) AS cn_sum,
                   COALESCE((SELECT SUM(cra.amount_allocated) FROM public.client_receipt_allocations cra WHERE cra.invoice_id = ci.id AND cra.status = 'Active'), 0.00) AS alloc_sum
            FROM public.client_invoices ci
            WHERE ci.client_account_id = p_id AND ci.status = 'Issued' AND ci.is_archived = false
        ) inv_bal
        WHERE (inv_bal.total_incl_vat - inv_bal.cn_sum - inv_bal.alloc_sum) > 0;

        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Issued invoices that have an outstanding balance.'; END IF;

        -- Check Posted receipts with unallocated balance
        SELECT COUNT(*) INTO v_cnt
        FROM (
            SELECT cr.id,
                   cr.amount_received,
                   COALESCE((SELECT SUM(cra.amount_allocated) FROM public.client_receipt_allocations cra WHERE cra.receipt_id = cr.id AND cra.status = 'Active'), 0.00) AS alloc_sum
            FROM public.client_receipts cr
            WHERE cr.client_account_id = p_id AND cr.status = 'Posted' AND cr.is_archived = false
        ) rec_bal
        WHERE (rec_bal.amount_received - rec_bal.alloc_sum) > 0;

        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Posted receipts that have an unallocated balance.'; END IF;
    END IF;

    -- Execute Archive mutation
    v_sql := format('UPDATE public.%I SET is_archived = true, updated_at = now(), updated_by = $1 WHERE id = $2 RETURNING to_jsonb(public.%I.*)', p_table, p_table);
    EXECUTE v_sql INTO v_result USING auth.uid(), p_id;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id uuid;
    v_status text;
    v_is_archived boolean;
    v_parent_id uuid;
    v_sql text;
    v_result jsonb;
BEGIN
    IF p_table NOT IN (
        'project_budget_versions',
        'financial_commitments',
        'financial_cost_postings',
        'project_financial_forecasts',
        'client_accounts',
        'project_client_contracts',
        'client_invoices',
        'client_credit_notes',
        'client_receipts',
        'client_invoice_lines',
        'client_credit_note_lines'
    ) THEN
        RAISE EXCEPTION 'Table % is not supported for restore.', p_table;
    END IF;

    v_sql := format('SELECT company_id, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table);
    EXECUTE v_sql INTO v_company_id, v_is_archived USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % not found in table %.', p_id, p_table;
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_company_id;
    END IF;

    IF v_is_archived IS FALSE THEN
        RAISE EXCEPTION 'Record % in table % is not archived.', p_id, p_table;
    END IF;

    IF p_table IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts', 'project_client_contracts', 'client_invoices', 'client_credit_notes', 'client_receipts') THEN
        v_sql := format('SELECT status FROM public.%I WHERE id = $1', p_table);
        EXECUTE v_sql INTO v_status USING p_id;
    END IF;

    IF p_table = 'project_budget_versions' AND v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
        RAISE EXCEPTION 'Budget version cannot be restored in status %.', v_status;
    ELSIF p_table = 'financial_commitments' AND v_status NOT IN ('Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Financial commitment cannot be restored in status %.', v_status;
    ELSIF p_table = 'financial_cost_postings' AND v_status NOT IN ('Draft', 'Rejected') THEN
        RAISE EXCEPTION 'Cost posting cannot be restored in status %.', v_status;
    ELSIF p_table = 'project_financial_forecasts' AND v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
        RAISE EXCEPTION 'Financial forecast cannot be restored in status %.', v_status;
    ELSIF p_table = 'project_client_contracts' AND v_status NOT IN ('Draft', 'Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Contract cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_invoices' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Client invoice cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_credit_notes' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Credit note cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_receipts' AND v_status NOT IN ('Draft', 'Cancelled') THEN
        RAISE EXCEPTION 'Receipt cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_invoice_lines' THEN
        SELECT invoice_id INTO v_parent_id FROM public.client_invoice_lines WHERE id = p_id;
        SELECT status INTO v_status FROM public.client_invoices WHERE id = v_parent_id;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Invoice line cannot be restored when parent invoice status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_credit_note_lines' THEN
        SELECT credit_note_id INTO v_parent_id FROM public.client_credit_note_lines WHERE id = p_id;
        SELECT status INTO v_status FROM public.client_credit_notes WHERE id = v_parent_id;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Credit note line cannot be restored when parent credit note status is %.', v_status;
        END IF;
    END IF;

    v_sql := format('UPDATE public.%I SET is_archived = false, updated_at = now(), updated_by = $1 WHERE id = $2 RETURNING to_jsonb(public.%I.*)', p_table, p_table);
    EXECUTE v_sql INTO v_result USING auth.uid(), p_id;

    RETURN v_result;
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. PROTECTION & METADATA TRIGGERS FOR OPERATIONAL TABLES
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_client_accounts_protection_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.is_archived := false;
        NEW.created_at := now();
        NEW.created_by := auth.uid();
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
        NEW.created_by := OLD.created_by;
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();

        IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
            RAISE EXCEPTION 'Identity fields (id, company_id) on client accounts are immutable.';
        END IF;

        IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
            RAISE EXCEPTION 'Archived client accounts cannot be modified.';
        END IF;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
            IF NEW.client_code IS DISTINCT FROM OLD.client_code OR
               NEW.legal_name IS DISTINCT FROM OLD.legal_name OR
               NEW.trading_name IS DISTINCT FROM OLD.trading_name OR
               NEW.registration_number IS DISTINCT FROM OLD.registration_number OR
               NEW.vat_number IS DISTINCT FROM OLD.vat_number OR
               NEW.billing_email IS DISTINCT FROM OLD.billing_email OR
               NEW.billing_phone IS DISTINCT FROM OLD.billing_phone OR
               NEW.billing_address IS DISTINCT FROM OLD.billing_address OR
               NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days OR
               NEW.credit_limit IS DISTINCT FROM OLD.credit_limit OR
               NEW.currency IS DISTINCT FROM OLD.currency OR
               NEW.notes IS DISTINCT FROM OLD.notes OR
               NEW.is_active IS DISTINCT FROM OLD.is_active THEN
                RAISE EXCEPTION 'Simultaneous ordinary edits are prohibited during client account archive or restore.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_project_client_contracts_protection_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ca_active boolean;
    v_ca_archived boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Lock client_accounts using client_account_id and company_id FOR SHARE
        SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
        FROM public.client_accounts
        WHERE id = NEW.client_account_id AND company_id = NEW.company_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client account not found.';
        END IF;
        IF v_ca_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot create contract for an archived client account.';
        END IF;
        IF v_ca_active IS FALSE THEN
            RAISE EXCEPTION 'Cannot create contract for an inactive client account.';
        END IF;

        NEW.status := 'Draft';
        NEW.is_archived := false;
        NEW.activated_by := NULL;
        NEW.activated_at := NULL;
        NEW.closed_by := NULL;
        NEW.closed_at := NULL;
        NEW.cancelled_by := NULL;
        NEW.cancelled_at := NULL;
        NEW.cancellation_reason := NULL;

        NEW.created_at := now();
        NEW.created_by := auth.uid();
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
        NEW.created_by := OLD.created_by;
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();

        IF NEW.id IS DISTINCT FROM OLD.id OR
           NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.client_account_id IS DISTINCT FROM OLD.client_account_id OR
           NEW.contract_number IS DISTINCT FROM OLD.contract_number THEN
            RAISE EXCEPTION 'Identity fields on project client contracts are immutable.';
        END IF;

        IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
            RAISE EXCEPTION 'Archived contracts cannot be modified.';
        END IF;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
            IF NEW.contract_title IS DISTINCT FROM OLD.contract_title OR
               NEW.purchase_order_reference IS DISTINCT FROM OLD.purchase_order_reference OR
               NEW.original_contract_value_excl_vat IS DISTINCT FROM OLD.original_contract_value_excl_vat OR
               NEW.approved_variations_excl_vat IS DISTINCT FROM OLD.approved_variations_excl_vat OR
               NEW.contract_start_date IS DISTINCT FROM OLD.contract_start_date OR
               NEW.contract_end_date IS DISTINCT FROM OLD.contract_end_date OR
               NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days OR
               NEW.default_vat_rate IS DISTINCT FROM OLD.default_vat_rate OR
               NEW.notes IS DISTINCT FROM OLD.notes OR
               NEW.is_primary IS DISTINCT FROM OLD.is_primary THEN
                RAISE EXCEPTION 'Simultaneous ordinary edits are prohibited during contract archive or restore.';
            END IF;
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF auth.uid() IS NULL THEN
                RAISE EXCEPTION 'Authentication required for contract status transitions.';
            END IF;

            -- Preserve all ordinary, archive, calculated fields during status transition
            IF NEW.contract_title IS DISTINCT FROM OLD.contract_title OR
               NEW.purchase_order_reference IS DISTINCT FROM OLD.purchase_order_reference OR
               NEW.original_contract_value_excl_vat IS DISTINCT FROM OLD.original_contract_value_excl_vat OR
               NEW.approved_variations_excl_vat IS DISTINCT FROM OLD.approved_variations_excl_vat OR
               NEW.contract_start_date IS DISTINCT FROM OLD.contract_start_date OR
               NEW.contract_end_date IS DISTINCT FROM OLD.contract_end_date OR
               NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days OR
               NEW.default_vat_rate IS DISTINCT FROM OLD.default_vat_rate OR
               NEW.notes IS DISTINCT FROM OLD.notes OR
               NEW.is_primary IS DISTINCT FROM OLD.is_primary OR
               NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
                RAISE EXCEPTION 'Ordinary fields cannot be modified during contract status transitions.';
            END IF;

            IF OLD.status = 'Draft' AND NEW.status = 'Active' THEN
                IF NEW.activated_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.activated_at IS NULL OR NEW.activated_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.closed_by IS DISTINCT FROM OLD.closed_by OR
                   NEW.closed_at IS DISTINCT FROM OLD.closed_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR
                   NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR
                   NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during contract activation.';
                END IF;
            ELSIF OLD.status = 'Active' AND NEW.status = 'Closed' THEN
                IF NEW.closed_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.closed_at IS NULL OR NEW.closed_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.activated_by IS DISTINCT FROM OLD.activated_by OR
                   NEW.activated_at IS DISTINCT FROM OLD.activated_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR
                   NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR
                   NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during contract closure.';
                END IF;
            ELSIF OLD.status IN ('Draft', 'Active') AND NEW.status = 'Cancelled' THEN
                IF NEW.cancelled_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.cancelled_at IS NULL OR NEW.cancelled_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF btrim(NEW.cancellation_reason) IS NULL OR btrim(NEW.cancellation_reason) = '' THEN
                    RAISE EXCEPTION 'Cancellation reason must be nonblank.';
                END IF;
                IF NEW.activated_by IS DISTINCT FROM OLD.activated_by OR
                   NEW.activated_at IS DISTINCT FROM OLD.activated_at OR
                   NEW.closed_by IS DISTINCT FROM OLD.closed_by OR
                   NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during contract cancellation.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Direct or unpermitted contract workflow status modification is prohibited.';
            END IF;
        ELSE
            IF NEW.activated_by IS DISTINCT FROM OLD.activated_by OR
               NEW.activated_at IS DISTINCT FROM OLD.activated_at OR
               NEW.closed_by IS DISTINCT FROM OLD.closed_by OR
               NEW.closed_at IS DISTINCT FROM OLD.closed_at OR
               NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR
               NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR
               NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                RAISE EXCEPTION 'Workflow actor, timestamp, and reason fields are immutable when status is unchanged.';
            END IF;

            IF OLD.status <> 'Draft' AND NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived THEN
                IF NEW.contract_title IS DISTINCT FROM OLD.contract_title OR
                   NEW.purchase_order_reference IS DISTINCT FROM OLD.purchase_order_reference OR
                   NEW.original_contract_value_excl_vat IS DISTINCT FROM OLD.original_contract_value_excl_vat OR
                   NEW.approved_variations_excl_vat IS DISTINCT FROM OLD.approved_variations_excl_vat OR
                   NEW.contract_start_date IS DISTINCT FROM OLD.contract_start_date OR
                   NEW.contract_end_date IS DISTINCT FROM OLD.contract_end_date OR
                   NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days OR
                   NEW.default_vat_rate IS DISTINCT FROM OLD.default_vat_rate OR
                   NEW.notes IS DISTINCT FROM OLD.notes OR
                   NEW.is_primary IS DISTINCT FROM OLD.is_primary THEN
                    RAISE EXCEPTION 'Contract fields are locked outside Draft status (current: %).', OLD.status;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_client_invoices_protection_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ca_active boolean;
    v_ca_archived boolean;
    v_pcc_status text;
    v_pcc_archived boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Lock client using client_account_id and company_id FOR SHARE
        SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
        FROM public.client_accounts
        WHERE id = NEW.client_account_id AND company_id = NEW.company_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client account not found.';
        END IF;
        IF v_ca_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot create invoice for an archived client account.';
        END IF;
        IF v_ca_active IS FALSE THEN
            RAISE EXCEPTION 'Cannot create invoice for an inactive client account.';
        END IF;

        -- Lock contract using id, company_id, project_id and client_account_id FOR SHARE
        SELECT status, is_archived INTO v_pcc_status, v_pcc_archived
        FROM public.project_client_contracts
        WHERE id = NEW.contract_id
          AND company_id = NEW.company_id
          AND project_id = NEW.project_id
          AND client_account_id = NEW.client_account_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Contract not found or mismatch.';
        END IF;
        IF v_pcc_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot create invoice for an archived contract.';
        END IF;
        IF v_pcc_status <> 'Active' THEN
            RAISE EXCEPTION 'Cannot create invoice for a contract in status % (must be Active).', v_pcc_status;
        END IF;

        NEW.status := 'Draft';
        NEW.is_archived := false;

        -- Derive totals from non-archived lines on INSERT
        SELECT 
            COALESCE(SUM(amount_excl_vat), 0.00),
            COALESCE(SUM(vat_amount), 0.00),
            COALESCE(SUM(amount_incl_vat), 0.00)
        INTO NEW.subtotal_excl_vat, NEW.vat_amount, NEW.total_incl_vat
        FROM public.client_invoice_lines
        WHERE invoice_id = NEW.id AND is_archived = false;

        NEW.submitted_by := NULL;
        NEW.submitted_at := NULL;
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
        NEW.issued_by := NULL;
        NEW.issued_at := NULL;
        NEW.rejected_by := NULL;
        NEW.rejected_at := NULL;
        NEW.rejection_reason := NULL;
        NEW.cancelled_by := NULL;
        NEW.cancelled_at := NULL;
        NEW.cancellation_reason := NULL;

        NEW.created_at := now();
        NEW.created_by := auth.uid();
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
        NEW.created_by := OLD.created_by;
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();

        IF NEW.id IS DISTINCT FROM OLD.id OR
           NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.client_account_id IS DISTINCT FROM OLD.client_account_id OR
           NEW.contract_id IS DISTINCT FROM OLD.contract_id THEN
            RAISE EXCEPTION 'Identity fields on client invoices are immutable.';
        END IF;

        IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
            RAISE EXCEPTION 'Archived invoices cannot be modified.';
        END IF;

        -- Derive totals from non-archived lines on UPDATE (do not trust NEW caller values)
        SELECT 
            COALESCE(SUM(amount_excl_vat), 0.00),
            COALESCE(SUM(vat_amount), 0.00),
            COALESCE(SUM(amount_incl_vat), 0.00)
        INTO NEW.subtotal_excl_vat, NEW.vat_amount, NEW.total_incl_vat
        FROM public.client_invoice_lines
        WHERE invoice_id = NEW.id AND is_archived = false;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
            IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
               NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
               NEW.payment_certificate_reference IS DISTINCT FROM OLD.payment_certificate_reference OR
               NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
               NEW.due_date IS DISTINCT FROM OLD.due_date OR
               NEW.billing_period_start IS DISTINCT FROM OLD.billing_period_start OR
               NEW.billing_period_end IS DISTINCT FROM OLD.billing_period_end OR
               NEW.currency IS DISTINCT FROM OLD.currency OR
               NEW.notes IS DISTINCT FROM OLD.notes THEN
                RAISE EXCEPTION 'Simultaneous ordinary edits are prohibited during invoice archive or restore.';
            END IF;
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF auth.uid() IS NULL THEN
                RAISE EXCEPTION 'Authentication required for invoice status transitions.';
            END IF;

            -- Preserve ordinary fields during status transitions
            IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
               NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
               NEW.payment_certificate_reference IS DISTINCT FROM OLD.payment_certificate_reference OR
               NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
               NEW.due_date IS DISTINCT FROM OLD.due_date OR
               NEW.billing_period_start IS DISTINCT FROM OLD.billing_period_start OR
               NEW.billing_period_end IS DISTINCT FROM OLD.billing_period_end OR
               NEW.currency IS DISTINCT FROM OLD.currency OR
               NEW.notes IS DISTINCT FROM OLD.notes OR
               NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
                RAISE EXCEPTION 'Ordinary fields cannot be modified during invoice status transitions.';
            END IF;

            IF OLD.status = 'Draft' AND NEW.status = 'Submitted' THEN
                IF NEW.submitted_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.submitted_at IS NULL OR NEW.submitted_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
                   NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
                   NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during invoice submission.';
                END IF;
            ELSIF OLD.status = 'Submitted' AND NEW.status = 'Approved' THEN
                IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.approved_at IS NULL OR NEW.approved_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
                   NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
                   NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during invoice approval.';
                END IF;
            ELSIF OLD.status = 'Submitted' AND NEW.status = 'Rejected' THEN
                IF NEW.rejected_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.rejected_at IS NULL OR NEW.rejected_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF btrim(NEW.rejection_reason) IS NULL OR btrim(NEW.rejection_reason) = '' THEN
                    RAISE EXCEPTION 'Rejection reason must be nonblank.';
                END IF;
                IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
                   NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
                   NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during invoice rejection.';
                END IF;
            ELSIF OLD.status = 'Approved' AND NEW.status = 'Issued' THEN
                IF NEW.issued_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.issued_at IS NULL OR NEW.issued_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
                   NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
                   NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during invoice issue.';
                END IF;
            ELSIF OLD.status IN ('Draft', 'Submitted', 'Approved') AND NEW.status = 'Cancelled' THEN
                IF NEW.cancelled_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.cancelled_at IS NULL OR NEW.cancelled_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF btrim(NEW.cancellation_reason) IS NULL OR btrim(NEW.cancellation_reason) = '' THEN
                    RAISE EXCEPTION 'Cancellation reason must be nonblank.';
                END IF;
                IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
                   NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
                   NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
                   NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during invoice cancellation.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Direct or unpermitted invoice workflow status modification is prohibited.';
            END IF;
        ELSE
            IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
               NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
               NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
               NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
               NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                RAISE EXCEPTION 'Workflow actor, timestamp, and reason fields are immutable when status is unchanged.';
            END IF;

            IF OLD.status <> 'Draft' AND NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived THEN
                IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
                   NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
                   NEW.payment_certificate_reference IS DISTINCT FROM OLD.payment_certificate_reference OR
                   NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
                   NEW.due_date IS DISTINCT FROM OLD.due_date OR
                   NEW.billing_period_start IS DISTINCT FROM OLD.billing_period_start OR
                   NEW.billing_period_end IS DISTINCT FROM OLD.billing_period_end OR
                   NEW.currency IS DISTINCT FROM OLD.currency OR
                   NEW.notes IS DISTINCT FROM OLD.notes THEN
                    RAISE EXCEPTION 'Invoice fields are locked outside Draft status (current: %).', OLD.status;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_client_credit_notes_protection_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ca_active boolean;
    v_ca_archived boolean;
    v_ci_status text;
    v_ci_archived boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Lock invoice, client, and contract in consistent order
        -- 1. Client Invoices (Lock FOR SHARE, validate context and Issued status)
        SELECT status, is_archived INTO v_ci_status, v_ci_archived
        FROM public.client_invoices
        WHERE id = NEW.invoice_id
          AND company_id = NEW.company_id
          AND project_id = NEW.project_id
          AND client_account_id = NEW.client_account_id
          AND contract_id = NEW.contract_id
          AND currency = NEW.currency
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced invoice not found or context mismatch.';
        END IF;
        IF v_ci_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot create credit note for an archived invoice.';
        END IF;
        IF v_ci_status <> 'Issued' THEN
            RAISE EXCEPTION 'Cannot create credit note for an invoice in status % (must be Issued).', v_ci_status;
        END IF;

        -- 2. Client Accounts
        SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
        FROM public.client_accounts
        WHERE id = NEW.client_account_id AND company_id = NEW.company_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client account not found.';
        END IF;
        IF v_ca_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot create credit note for an archived client account.';
        END IF;
        IF v_ca_active IS FALSE THEN
            RAISE EXCEPTION 'Cannot create credit note for an inactive client account.';
        END IF;

        -- 3. Project Client Contracts (Validate relationship, lock FOR SHARE, do not reject solely because Closed/Cancelled contract is archived)
        PERFORM 1
        FROM public.project_client_contracts
        WHERE id = NEW.contract_id
          AND company_id = NEW.company_id
          AND project_id = NEW.project_id
          AND client_account_id = NEW.client_account_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Contract not found or mismatch.';
        END IF;

        NEW.status := 'Draft';
        NEW.is_archived := false;

        -- Derive totals from non-archived lines on INSERT
        SELECT 
            COALESCE(SUM(amount_excl_vat), 0.00),
            COALESCE(SUM(vat_amount), 0.00),
            COALESCE(SUM(amount_incl_vat), 0.00)
        INTO NEW.subtotal_excl_vat, NEW.vat_amount, NEW.total_incl_vat
        FROM public.client_credit_note_lines
        WHERE credit_note_id = NEW.id AND is_archived = false;

        NEW.submitted_by := NULL;
        NEW.submitted_at := NULL;
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
        NEW.issued_by := NULL;
        NEW.issued_at := NULL;
        NEW.rejected_by := NULL;
        NEW.rejected_at := NULL;
        NEW.rejection_reason := NULL;
        NEW.cancelled_by := NULL;
        NEW.cancelled_at := NULL;
        NEW.cancellation_reason := NULL;

        NEW.created_at := now();
        NEW.created_by := auth.uid();
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
        NEW.created_by := OLD.created_by;
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();

        IF NEW.id IS DISTINCT FROM OLD.id OR
           NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.client_account_id IS DISTINCT FROM OLD.client_account_id OR
           NEW.contract_id IS DISTINCT FROM OLD.contract_id OR
           NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
            RAISE EXCEPTION 'Identity fields on client credit notes are immutable.';
        END IF;

        IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
            RAISE EXCEPTION 'Archived credit notes cannot be modified.';
        END IF;

        -- Derive totals from non-archived lines on UPDATE
        SELECT 
            COALESCE(SUM(amount_excl_vat), 0.00),
            COALESCE(SUM(vat_amount), 0.00),
            COALESCE(SUM(amount_incl_vat), 0.00)
        INTO NEW.subtotal_excl_vat, NEW.vat_amount, NEW.total_incl_vat
        FROM public.client_credit_note_lines
        WHERE credit_note_id = NEW.id AND is_archived = false;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
            IF NEW.credit_note_number IS DISTINCT FROM OLD.credit_note_number OR
               NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
               NEW.credit_note_date IS DISTINCT FROM OLD.credit_note_date OR
               NEW.reason IS DISTINCT FROM OLD.reason OR
               NEW.currency IS DISTINCT FROM OLD.currency THEN
                RAISE EXCEPTION 'Simultaneous ordinary edits are prohibited during credit note archive or restore.';
            END IF;
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF auth.uid() IS NULL THEN
                RAISE EXCEPTION 'Authentication required for credit note status transitions.';
            END IF;

            -- Preserve ordinary fields during status transitions
            IF NEW.credit_note_number IS DISTINCT FROM OLD.credit_note_number OR
               NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
               NEW.credit_note_date IS DISTINCT FROM OLD.credit_note_date OR
               NEW.reason IS DISTINCT FROM OLD.reason OR
               NEW.currency IS DISTINCT FROM OLD.currency OR
               NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
                RAISE EXCEPTION 'Ordinary fields cannot be modified during credit note status transitions.';
            END IF;

            IF OLD.status = 'Draft' AND NEW.status = 'Submitted' THEN
                IF NEW.submitted_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.submitted_at IS NULL OR NEW.submitted_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
                   NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
                   NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during credit note submission.';
                END IF;
            ELSIF OLD.status = 'Submitted' AND NEW.status = 'Approved' THEN
                IF NEW.approved_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.approved_at IS NULL OR NEW.approved_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
                   NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
                   NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during credit note approval.';
                END IF;
            ELSIF OLD.status = 'Submitted' AND NEW.status = 'Rejected' THEN
                IF NEW.rejected_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.rejected_at IS NULL OR NEW.rejected_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF btrim(NEW.rejection_reason) IS NULL OR btrim(NEW.rejection_reason) = '' THEN
                    RAISE EXCEPTION 'Rejection reason must be nonblank.';
                END IF;
                IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
                   NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
                   NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during credit note rejection.';
                END IF;
            ELSIF OLD.status = 'Approved' AND NEW.status = 'Issued' THEN
                IF NEW.issued_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.issued_at IS NULL OR NEW.issued_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
                   NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
                   NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during credit note issue.';
                END IF;
            ELSIF OLD.status IN ('Draft', 'Submitted', 'Approved') AND NEW.status = 'Cancelled' THEN
                IF NEW.cancelled_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.cancelled_at IS NULL OR NEW.cancelled_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF btrim(NEW.cancellation_reason) IS NULL OR btrim(NEW.cancellation_reason) = '' THEN
                    RAISE EXCEPTION 'Cancellation reason must be nonblank.';
                END IF;
                IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
                   NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
                   NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
                   NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during credit note cancellation.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Direct or unpermitted credit note workflow status modification is prohibited.';
            END IF;
        ELSE
            IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
               NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
               NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
               NEW.issued_by IS DISTINCT FROM OLD.issued_by OR NEW.issued_at IS DISTINCT FROM OLD.issued_at OR
               NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                RAISE EXCEPTION 'Workflow actor, timestamp, and reason fields are immutable when status is unchanged.';
            END IF;

            IF OLD.status <> 'Draft' AND NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived THEN
                IF NEW.credit_note_number IS DISTINCT FROM OLD.credit_note_number OR
                   NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
                   NEW.credit_note_date IS DISTINCT FROM OLD.credit_note_date OR
                   NEW.reason IS DISTINCT FROM OLD.reason OR
                   NEW.currency IS DISTINCT FROM OLD.currency THEN
                    RAISE EXCEPTION 'Credit note fields are locked outside Draft status (current: %).', OLD.status;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_client_receipts_protection_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ca_active boolean;
    v_ca_archived boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
        FROM public.client_accounts
        WHERE id = NEW.client_account_id AND company_id = NEW.company_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Client account not found.';
        END IF;
        IF v_ca_archived IS TRUE THEN
            RAISE EXCEPTION 'Cannot create receipt for an archived client account.';
        END IF;
        IF v_ca_active IS FALSE THEN
            RAISE EXCEPTION 'Cannot create receipt for an inactive client account.';
        END IF;

        NEW.status := 'Draft';
        NEW.is_archived := false;

        NEW.posted_by := NULL;
        NEW.posted_at := NULL;
        NEW.reversed_by := NULL;
        NEW.reversed_at := NULL;
        NEW.reversal_reason := NULL;
        NEW.cancelled_by := NULL;
        NEW.cancelled_at := NULL;
        NEW.cancellation_reason := NULL;

        NEW.created_at := now();
        NEW.created_by := auth.uid();
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
        NEW.created_by := OLD.created_by;
        NEW.updated_at := now();
        NEW.updated_by := auth.uid();

        IF NEW.id IS DISTINCT FROM OLD.id OR
           NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.client_account_id IS DISTINCT FROM OLD.client_account_id OR
           NEW.receipt_number IS DISTINCT FROM OLD.receipt_number THEN
            RAISE EXCEPTION 'Identity fields on client receipts are immutable.';
        END IF;

        IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
            RAISE EXCEPTION 'Archived receipts cannot be modified.';
        END IF;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
            IF NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
               NEW.receipt_date IS DISTINCT FROM OLD.receipt_date OR
               NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
               NEW.amount_received IS DISTINCT FROM OLD.amount_received OR
               NEW.currency IS DISTINCT FROM OLD.currency OR
               NEW.notes IS DISTINCT FROM OLD.notes THEN
                RAISE EXCEPTION 'Simultaneous ordinary edits are prohibited during receipt archive or restore.';
            END IF;
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF auth.uid() IS NULL THEN
                RAISE EXCEPTION 'Authentication required for receipt status transitions.';
            END IF;

            -- Preserve ordinary fields during status transitions
            IF NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
               NEW.receipt_date IS DISTINCT FROM OLD.receipt_date OR
               NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
               NEW.amount_received IS DISTINCT FROM OLD.amount_received OR
               NEW.currency IS DISTINCT FROM OLD.currency OR
               NEW.notes IS DISTINCT FROM OLD.notes OR
               NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
                RAISE EXCEPTION 'Ordinary fields cannot be modified during receipt status transitions.';
            END IF;

            IF OLD.status = 'Draft' AND NEW.status = 'Posted' THEN
                IF NEW.posted_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.posted_at IS NULL OR NEW.posted_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF NEW.reversed_by IS DISTINCT FROM OLD.reversed_by OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at OR NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during receipt posting.';
                END IF;
            ELSIF OLD.status = 'Posted' AND NEW.status = 'Reversed' THEN
                IF NEW.reversed_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.reversed_at IS NULL OR NEW.reversed_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF btrim(NEW.reversal_reason) IS NULL OR btrim(NEW.reversal_reason) = '' THEN
                    RAISE EXCEPTION 'Reversal reason must be nonblank.';
                END IF;
                IF NEW.posted_by IS DISTINCT FROM OLD.posted_by OR NEW.posted_at IS DISTINCT FROM OLD.posted_at OR
                   NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during receipt reversal.';
                END IF;
            ELSIF OLD.status = 'Draft' AND NEW.status = 'Cancelled' THEN
                IF NEW.cancelled_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.cancelled_at IS NULL OR NEW.cancelled_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF btrim(NEW.cancellation_reason) IS NULL OR btrim(NEW.cancellation_reason) = '' THEN
                    RAISE EXCEPTION 'Cancellation reason must be nonblank.';
                END IF;
                IF NEW.posted_by IS DISTINCT FROM OLD.posted_by OR NEW.posted_at IS DISTINCT FROM OLD.posted_at OR
                   NEW.reversed_by IS DISTINCT FROM OLD.reversed_by OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at OR NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason THEN
                    RAISE EXCEPTION 'Unrelated workflow fields must be preserved during receipt cancellation.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Direct or unpermitted receipt workflow status modification is prohibited.';
            END IF;
        ELSE
            IF NEW.posted_by IS DISTINCT FROM OLD.posted_by OR NEW.posted_at IS DISTINCT FROM OLD.posted_at OR
               NEW.reversed_by IS DISTINCT FROM OLD.reversed_by OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at OR NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason OR
               NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                RAISE EXCEPTION 'Workflow actor, timestamp, and reason fields are immutable when status is unchanged.';
            END IF;

            IF OLD.status <> 'Draft' AND NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived THEN
                IF NEW.external_reference IS DISTINCT FROM OLD.external_reference OR
                   NEW.receipt_date IS DISTINCT FROM OLD.receipt_date OR
                   NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
                   NEW.amount_received IS DISTINCT FROM OLD.amount_received OR
                   NEW.currency IS DISTINCT FROM OLD.currency OR
                   NEW.notes IS DISTINCT FROM OLD.notes THEN
                    RAISE EXCEPTION 'Receipt fields are locked outside Draft status (current: %).', OLD.status;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_client_receipt_allocations_protection_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.status := 'Active';
        NEW.allocated_at := now();
        NEW.allocated_by := auth.uid();
        NEW.reversed_by := NULL;
        NEW.reversed_at := NULL;
        NEW.reversal_reason := NULL;
        -- Force server transaction identifier and ignore caller value
        NEW.transaction_identifier := pg_current_xact_id()::text;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.allocated_at := OLD.allocated_at;
        NEW.allocated_by := OLD.allocated_by;

        -- Make transaction_identifier immutable and reject any attempted change
        IF NEW.transaction_identifier IS DISTINCT FROM OLD.transaction_identifier THEN
            RAISE EXCEPTION 'transaction_identifier is immutable.';
        END IF;

        IF NEW.id IS DISTINCT FROM OLD.id OR
           NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.client_account_id IS DISTINCT FROM OLD.client_account_id OR
           NEW.receipt_id IS DISTINCT FROM OLD.receipt_id OR
           NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
           NEW.amount_allocated IS DISTINCT FROM OLD.amount_allocated THEN
            RAISE EXCEPTION 'Identity and amount fields on receipt allocations are immutable.';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF auth.uid() IS NULL THEN
                RAISE EXCEPTION 'Authentication required for allocation status transitions.';
            END IF;

            IF OLD.status = 'Active' AND NEW.status = 'Reversed' THEN
                IF NEW.reversed_by IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Transition actor must match auth.uid().';
                END IF;
                IF NEW.reversed_at IS NULL OR NEW.reversed_at IS DISTINCT FROM now() THEN
                    RAISE EXCEPTION 'Transition timestamp must be server-generated with now().';
                END IF;
                IF btrim(NEW.reversal_reason) IS NULL OR btrim(NEW.reversal_reason) = '' THEN
                    RAISE EXCEPTION 'Reversal reason must be nonblank.';
                END IF;
            ELSE
                RAISE EXCEPTION 'Direct or unpermitted receipt allocation workflow status modification is prohibited.';
            END IF;
        ELSE
            IF NEW.reversed_by IS DISTINCT FROM OLD.reversed_by OR
               NEW.reversed_at IS DISTINCT FROM OLD.reversed_at OR
               NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason THEN
                RAISE EXCEPTION 'Workflow reversal fields are immutable when status is unchanged.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_protect_client_accounts
    BEFORE INSERT OR UPDATE ON public.client_accounts
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_accounts_protection_trigger();

CREATE TRIGGER trg_protect_project_client_contracts
    BEFORE INSERT OR UPDATE ON public.project_client_contracts
    FOR EACH ROW EXECUTE FUNCTION public.fn_project_client_contracts_protection_trigger();

CREATE TRIGGER trg_protect_client_invoices
    BEFORE INSERT OR UPDATE ON public.client_invoices
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_invoices_protection_trigger();

CREATE TRIGGER trg_protect_client_credit_notes
    BEFORE INSERT OR UPDATE ON public.client_credit_notes
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_credit_notes_protection_trigger();

CREATE TRIGGER trg_protect_client_receipts
    BEFORE INSERT OR UPDATE ON public.client_receipts
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_receipts_protection_trigger();

CREATE TRIGGER trg_protect_client_receipt_allocations
    BEFORE INSERT OR UPDATE ON public.client_receipt_allocations
    FOR EACH ROW EXECUTE FUNCTION public.fn_client_receipt_allocations_protection_trigger();


-- -----------------------------------------------------------------------------
-- 7. RECEIVABLES AGEING & SETTLEMENT RPC
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_client_receivables_ageing(
    p_company_id uuid,
    p_project_id uuid DEFAULT NULL,
    p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    invoice_id uuid,
    company_id uuid,
    project_id uuid,
    client_account_id uuid,
    client_name text,
    invoice_number text,
    invoice_date date,
    due_date date,
    invoice_total_incl_vat numeric(15,2),
    issued_credit_notes_incl_vat numeric(15,2),
    allocated_receipts numeric(15,2),
    outstanding_balance numeric(15,2),
    settlement_status text,
    is_overdue boolean,
    days_overdue integer,
    ageing_bucket text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.has_finance_full_access(p_company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', p_company_id;
    END IF;

    RETURN QUERY
    WITH inv_base AS (
        SELECT 
            ci.id AS inv_id,
            ci.company_id AS comp_id,
            ci.project_id AS proj_id,
            ci.client_account_id AS client_id,
            ca.legal_name AS c_name,
            ci.invoice_number AS inv_num,
            ci.invoice_date AS inv_date,
            ci.due_date AS d_date,
            ci.total_incl_vat AS inv_total
        FROM public.client_invoices ci
        JOIN public.client_accounts ca ON ca.id = ci.client_account_id
        WHERE ci.company_id = p_company_id
          AND (p_project_id IS NULL OR ci.project_id = p_project_id)
          AND ci.status = 'Issued'
          AND ci.issued_at::date <= p_as_of_date
          AND ci.is_archived = false
    ),
    cn_calc AS (
        SELECT 
            ccn.invoice_id AS inv_id,
            COALESCE(SUM(ccn.total_incl_vat), 0.00) AS cn_sum
        FROM public.client_credit_notes ccn
        WHERE ccn.company_id = p_company_id
          AND ccn.status = 'Issued'
          AND ccn.issued_at::date <= p_as_of_date
          AND ccn.is_archived = false
        GROUP BY ccn.invoice_id
    ),
    alloc_calc AS (
        SELECT 
            cra.invoice_id AS inv_id,
            COALESCE(SUM(cra.amount_allocated), 0.00) AS alloc_sum
        FROM public.client_receipt_allocations cra
        WHERE cra.company_id = p_company_id
          AND cra.allocated_at::date <= p_as_of_date
          AND (cra.status = 'Active' OR cra.reversed_at::date > p_as_of_date)
        GROUP BY cra.invoice_id
    )
    SELECT 
        ib.inv_id AS invoice_id,
        ib.comp_id AS company_id,
        ib.proj_id AS project_id,
        ib.client_id AS client_account_id,
        ib.c_name AS client_name,
        ib.inv_num AS invoice_number,
        ib.inv_date AS invoice_date,
        ib.d_date AS due_date,
        ib.inv_total AS invoice_total_incl_vat,
        COALESCE(cn.cn_sum, 0.00) AS issued_credit_notes_incl_vat,
        COALESCE(al.alloc_sum, 0.00) AS allocated_receipts,
        (ib.inv_total - COALESCE(cn.cn_sum, 0.00) - COALESCE(al.alloc_sum, 0.00)) AS outstanding_balance,
        CASE 
            WHEN (ib.inv_total - COALESCE(cn.cn_sum, 0.00) - COALESCE(al.alloc_sum, 0.00)) <= 0 THEN 'Paid'
            WHEN (COALESCE(cn.cn_sum, 0.00) + COALESCE(al.alloc_sum, 0.00)) > 0 THEN 'Partially Paid'
            ELSE 'Unpaid'
        END AS settlement_status,
        ((p_as_of_date > ib.d_date) AND ((ib.inv_total - COALESCE(cn.cn_sum, 0.00) - COALESCE(al.alloc_sum, 0.00)) > 0)) AS is_overdue,
        GREATEST(0, (p_as_of_date - ib.d_date))::integer AS days_overdue,
        CASE 
            WHEN ib.d_date >= p_as_of_date THEN 'Not Due'
            WHEN (p_as_of_date - ib.d_date) BETWEEN 1 AND 30 THEN '1-30 Days'
            WHEN (p_as_of_date - ib.d_date) BETWEEN 31 AND 60 THEN '31-60 Days'
            WHEN (p_as_of_date - ib.d_date) BETWEEN 61 AND 90 THEN '61-90 Days'
            ELSE '91+ Days'
        END AS ageing_bucket
    FROM inv_base ib
    LEFT JOIN cn_calc cn ON cn.inv_id = ib.inv_id
    LEFT JOIN alloc_calc al ON al.inv_id = ib.inv_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) & FORCE RLS ON ALL 9 TABLES
-- -----------------------------------------------------------------------------

ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.project_client_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_contracts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE public.client_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invoice_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.client_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_notes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.client_credit_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_note_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.client_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_receipts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.client_receipt_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_receipt_allocations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.client_accounts_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_accounts_audit_log FORCE ROW LEVEL SECURITY;


-- POLICIES FOR OPERATIONAL TABLES

-- 8.1 client_accounts
CREATE POLICY p_ca_select ON public.client_accounts FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));
CREATE POLICY p_ca_insert ON public.client_accounts FOR INSERT TO authenticated
    WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY p_ca_update ON public.client_accounts FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- 8.2 project_client_contracts
CREATE POLICY p_pcc_select ON public.project_client_contracts FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));
CREATE POLICY p_pcc_insert ON public.project_client_contracts FOR INSERT TO authenticated
    WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY p_pcc_update ON public.project_client_contracts FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- 8.3 client_invoices
CREATE POLICY p_ci_select ON public.client_invoices FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));
CREATE POLICY p_ci_insert ON public.client_invoices FOR INSERT TO authenticated
    WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY p_ci_update ON public.client_invoices FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- 8.4 client_invoice_lines
CREATE POLICY p_cil_select ON public.client_invoice_lines FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));
CREATE POLICY p_cil_insert ON public.client_invoice_lines FOR INSERT TO authenticated
    WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY p_cil_update ON public.client_invoice_lines FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- 8.5 client_credit_notes
CREATE POLICY p_ccn_select ON public.client_credit_notes FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));
CREATE POLICY p_ccn_insert ON public.client_credit_notes FOR INSERT TO authenticated
    WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY p_ccn_update ON public.client_credit_notes FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- 8.6 client_credit_note_lines
CREATE POLICY p_ccnl_select ON public.client_credit_note_lines FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));
CREATE POLICY p_ccnl_insert ON public.client_credit_note_lines FOR INSERT TO authenticated
    WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY p_ccnl_update ON public.client_credit_note_lines FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- 8.7 client_receipts
CREATE POLICY p_cr_select ON public.client_receipts FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));
CREATE POLICY p_cr_insert ON public.client_receipts FOR INSERT TO authenticated
    WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY p_cr_update ON public.client_receipts FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- 8.8 client_receipt_allocations (RPC ONLY for Insert/Update, SELECT allowed for reporting)
CREATE POLICY p_cra_select ON public.client_receipt_allocations FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));

-- 8.9 client_accounts_audit_log (Trigger-inserted, SELECT allowed for reporting)
CREATE POLICY p_caal_select ON public.client_accounts_audit_log FOR SELECT TO authenticated
    USING (public.has_finance_full_access(company_id));


-- -----------------------------------------------------------------------------
-- 9. GRANTS AND PRIVILEGES
-- -----------------------------------------------------------------------------

-- EXPLICIT REVOKES ON PHASE 2C.1 TABLES
REVOKE ALL ON public.client_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.project_client_contracts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.client_invoices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.client_invoice_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.client_credit_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.client_credit_note_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.client_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.client_receipt_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.client_accounts_audit_log FROM PUBLIC, anon, authenticated;

-- EXPLICIT REVOKES ON PHASE 2C.1 FUNCTIONS
REVOKE ALL ON FUNCTION public.fn_client_accounts_audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_pcc_value_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_cil_before_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_cil_after_reconcile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ccnl_before_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ccnl_after_reconcile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_client_accounts_protection_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_project_client_contracts_protection_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_client_invoices_protection_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_client_credit_notes_protection_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_client_receipts_protection_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_client_receipt_allocations_protection_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_client_contract(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_client_contract(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_client_contract(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_client_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_client_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_client_invoice(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_client_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_client_invoice(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_client_credit_note(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_client_credit_note(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_client_credit_note(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_client_credit_note(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_client_credit_note(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_client_receipt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_client_receipt(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_client_receipt(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allocate_client_receipt(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_client_receipt_allocation(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_finance_record(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_finance_record(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_client_receivables_ageing(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- TABLE-LEVEL SELECT GRANTS
GRANT SELECT ON public.client_accounts TO authenticated;
GRANT SELECT ON public.project_client_contracts TO authenticated;
GRANT SELECT ON public.client_invoices TO authenticated;
GRANT SELECT ON public.client_invoice_lines TO authenticated;
GRANT SELECT ON public.client_credit_notes TO authenticated;
GRANT SELECT ON public.client_credit_note_lines TO authenticated;
GRANT SELECT ON public.client_receipts TO authenticated;
GRANT SELECT ON public.client_receipt_allocations TO authenticated;
GRANT SELECT ON public.client_accounts_audit_log TO authenticated;

-- COLUMN-LEVEL INSERT & UPDATE GRANTS

-- client_accounts
GRANT INSERT (company_id, client_code, legal_name, trading_name, registration_number, vat_number, billing_email, billing_phone, billing_address, payment_terms_days, credit_limit, currency, notes, is_active) ON public.client_accounts TO authenticated;
GRANT UPDATE (client_code, legal_name, trading_name, registration_number, vat_number, billing_email, billing_phone, billing_address, payment_terms_days, credit_limit, notes, is_active) ON public.client_accounts TO authenticated;

-- project_client_contracts
GRANT INSERT (company_id, project_id, client_account_id, contract_number, contract_title, purchase_order_reference, original_contract_value_excl_vat, approved_variations_excl_vat, contract_start_date, contract_end_date, payment_terms_days, default_vat_rate, notes, is_primary) ON public.project_client_contracts TO authenticated;
GRANT UPDATE (contract_title, purchase_order_reference, original_contract_value_excl_vat, approved_variations_excl_vat, contract_start_date, contract_end_date, payment_terms_days, default_vat_rate, notes, is_primary) ON public.project_client_contracts TO authenticated;

-- client_invoices
GRANT INSERT (company_id, project_id, client_account_id, contract_id, invoice_number, external_reference, payment_certificate_reference, invoice_date, due_date, billing_period_start, billing_period_end, notes) ON public.client_invoices TO authenticated;
GRANT UPDATE (invoice_number, external_reference, payment_certificate_reference, invoice_date, due_date, billing_period_start, billing_period_end, notes) ON public.client_invoices TO authenticated;

-- client_invoice_lines
GRANT INSERT (company_id, project_id, invoice_id, line_code, description, quantity, unit, unit_rate_excl_vat, vat_rate, sort_order) ON public.client_invoice_lines TO authenticated;
GRANT UPDATE (description, quantity, unit, unit_rate_excl_vat, vat_rate, sort_order) ON public.client_invoice_lines TO authenticated;

-- client_credit_notes (CORRECTED: NO notes COLUMN IN GRANT)
GRANT INSERT (company_id, project_id, client_account_id, contract_id, invoice_id, credit_note_number, external_reference, credit_note_date, reason) ON public.client_credit_notes TO authenticated;
GRANT UPDATE (credit_note_number, external_reference, credit_note_date, reason) ON public.client_credit_notes TO authenticated;

-- client_credit_note_lines
GRANT INSERT (company_id, project_id, credit_note_id, line_code, description, quantity, unit, unit_rate_excl_vat, vat_rate, sort_order) ON public.client_credit_note_lines TO authenticated;
GRANT UPDATE (description, quantity, unit, unit_rate_excl_vat, vat_rate, sort_order) ON public.client_credit_note_lines TO authenticated;

-- client_receipts
GRANT INSERT (company_id, project_id, client_account_id, receipt_number, external_reference, receipt_date, payment_method, amount_received, notes) ON public.client_receipts TO authenticated;
GRANT UPDATE (external_reference, receipt_date, payment_method, amount_received, notes) ON public.client_receipts TO authenticated;

-- RPC EXECUTE GRANTS
GRANT EXECUTE ON FUNCTION public.activate_client_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_client_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_client_contract(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.submit_client_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_client_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_client_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_client_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_client_invoice(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.submit_client_credit_note(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_client_credit_note(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_client_credit_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_client_credit_note(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_client_credit_note(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.post_client_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_client_receipt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_client_receipt(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.allocate_client_receipt(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_client_receipt_allocation(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.archive_finance_record(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_finance_record(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_receivables_ageing(uuid, uuid, date) TO authenticated;

COMMIT;
