-- =============================================================================
-- MIGRATION: Phase 2B.1 Financial Foundation & Schema Core
-- FILE: supabase/migrations/20260720000000_finance_phase_2b1_foundation.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. PRE-REQUISITES & ACCESS CONTROL VERIFICATION
-- -----------------------------------------------------------------------------

-- Guard projects_id_company_key using pg_constraint scoped specifically to public.projects
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'public.projects'::regclass 
          AND conname = 'projects_id_company_key'
    ) THEN
        ALTER TABLE public.projects ADD CONSTRAINT projects_id_company_key UNIQUE (id, company_id);
    END IF;
END $$;

-- Core Access Function: has_finance_full_access
CREATE OR REPLACE FUNCTION public.has_finance_full_access(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_has_access boolean := false;
BEGIN
    IF auth.uid() IS NULL OR p_company_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT EXISTS (
        SELECT 1 
        FROM public.company_members cm
        WHERE cm.company_id = p_company_id
          AND cm.profile_id = auth.uid()
          AND cm.is_active = true
          AND LOWER(TRIM(cm.designation)) IN (
              'director', 
              'ceo', 
              'coo', 
              'cfo', 
              'project manager',
              'project_manager'
          )
    ) INTO v_has_access;

    RETURN COALESCE(v_has_access, false);
END;
$$;

-- Security Settings for Access Function
REVOKE ALL ON FUNCTION public.has_finance_full_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_finance_full_access(uuid) TO authenticated;


-- Helper Function: Resolve Current User Company ID
CREATE OR REPLACE FUNCTION public.fn_current_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id uuid;
BEGIN
    SELECT cm.company_id INTO v_company_id
    FROM public.company_members cm
    WHERE cm.profile_id = auth.uid()
      AND cm.is_active = true
    LIMIT 1;

    RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_current_company_id() TO authenticated;


-- -----------------------------------------------------------------------------
-- 1. OPERATIONAL TABLES DEFINITION
-- -----------------------------------------------------------------------------

-- Table 1: project_budget_versions
CREATE TABLE IF NOT EXISTS public.project_budget_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    version_number integer NOT NULL CHECK (version_number > 0),
    version_label text NOT NULL,
    effective_date date NOT NULL DEFAULT CURRENT_DATE,
    original_budget_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (original_budget_excl_vat >= 0),
    approved_variations_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (approved_variations_excl_vat >= 0),
    current_budget_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
    notes text,
    currency_code text NOT NULL DEFAULT 'ZAR' CHECK (currency_code = 'ZAR'),
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Superseded', 'Cancelled')),
    submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    submitted_at timestamptz,
    approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    approved_at timestamptz,
    rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    rejected_at timestamptz,
    rejection_reason text,
    cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    cancelled_at timestamptz,
    cancellation_reason text,
    is_archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_budget_version_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT uq_budget_version_project_number UNIQUE (project_id, version_number),
    CONSTRAINT uq_budget_version_company UNIQUE (id, company_id),
    CONSTRAINT uq_budget_version_company_project UNIQUE (id, company_id, project_id)
);

-- Table 2: project_budget_lines
CREATE TABLE IF NOT EXISTS public.project_budget_lines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    budget_version_id uuid NOT NULL,
    line_code text,
    cost_category text NOT NULL,
    description text NOT NULL,
    line_type text NOT NULL DEFAULT 'Original Budget' CHECK (line_type IN ('Original Budget', 'Approved Variation')),
    amount_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (amount_excl_vat >= 0),
    sort_order integer NOT NULL DEFAULT 0,
    is_archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_budget_line_version FOREIGN KEY (budget_version_id, company_id, project_id) REFERENCES public.project_budget_versions(id, company_id, project_id) ON DELETE RESTRICT,
    CONSTRAINT fk_budget_line_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT
);

-- Table 3: financial_commitments
CREATE TABLE IF NOT EXISTS public.financial_commitments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    commitment_reference text NOT NULL,
    commitment_type text NOT NULL CHECK (commitment_type IN ('Purchase Order', 'Subcontract', 'Approved Variation', 'Other Contractual Commitment', 'Service Agreement', 'Other')),
    counterparty_name text NOT NULL,
    description text NOT NULL,
    original_amount_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (original_amount_excl_vat >= 0),
    approved_variations_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (approved_variations_excl_vat >= 0),
    revised_commitment_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
    start_date date,
    completion_date date,
    procurement_item_id uuid REFERENCES public.procurement_items(id) ON DELETE RESTRICT,
    notes text,
    currency_code text NOT NULL DEFAULT 'ZAR' CHECK (currency_code = 'ZAR'),
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Closed', 'Cancelled')),
    submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    submitted_at timestamptz,
    approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    approved_at timestamptz,
    rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    rejected_at timestamptz,
    rejection_reason text,
    closed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    closed_at timestamptz,
    cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    cancelled_at timestamptz,
    cancellation_reason text,
    is_archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_commitment_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT chk_commitment_dates CHECK (completion_date IS NULL OR start_date IS NULL OR completion_date >= start_date),
    CONSTRAINT uq_commitment_company_ref UNIQUE (company_id, commitment_reference),
    CONSTRAINT uq_commitment_company UNIQUE (id, company_id),
    CONSTRAINT uq_commitment_company_project UNIQUE (id, company_id, project_id)
);

-- Table 4: financial_cost_postings
CREATE TABLE IF NOT EXISTS public.financial_cost_postings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    posting_reference text NOT NULL,
    posting_date date NOT NULL DEFAULT CURRENT_DATE,
    source_type text NOT NULL CHECK (source_type IN ('Supplier Invoice', 'Labour Payroll', 'Direct Expense', 'Overhead Allocation', 'Adjustment')),
    source_record_id uuid,
    source_reference text,
    commitment_id uuid,
    cost_category text NOT NULL,
    description text NOT NULL,
    entry_type text NOT NULL DEFAULT 'Cost' CHECK (entry_type IN ('Cost', 'Reversal')),
    amount_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
    reversal_of_id uuid REFERENCES public.financial_cost_postings(id) ON DELETE RESTRICT,
    notes text,
    currency_code text NOT NULL DEFAULT 'ZAR' CHECK (currency_code = 'ZAR'),
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Posted', 'Reversed', 'Rejected')),
    submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    submitted_at timestamptz,
    posted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    posted_at timestamptz,
    rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    rejected_at timestamptz,
    rejection_reason text,
    reversed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    reversed_at timestamptz,
    reversal_reason text,
    is_archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cost_posting_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cost_posting_commitment FOREIGN KEY (commitment_id, company_id, project_id) REFERENCES public.financial_commitments(id, company_id, project_id) ON DELETE RESTRICT,
    CONSTRAINT uq_cost_posting_company_ref UNIQUE (company_id, posting_reference),
    CONSTRAINT uq_cost_posting_company UNIQUE (id, company_id),
    CONSTRAINT uq_cost_posting_company_project UNIQUE (id, company_id, project_id),
    CONSTRAINT chk_cost_posting_entry_integrity CHECK (
        (entry_type = 'Cost' AND amount_excl_vat > 0 AND reversal_of_id IS NULL)
        OR
        (entry_type = 'Reversal' AND amount_excl_vat < 0 AND reversal_of_id IS NOT NULL AND status = 'Posted')
    )
);

-- Table 5: project_financial_forecasts
CREATE TABLE IF NOT EXISTS public.project_financial_forecasts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL,
    version_number integer NOT NULL CHECK (version_number > 0),
    version_label text NOT NULL,
    as_of_date date NOT NULL DEFAULT CURRENT_DATE,
    forecast_contract_revenue_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (forecast_contract_revenue_excl_vat >= 0),
    uncommitted_estimate_to_complete_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (uncommitted_estimate_to_complete_excl_vat >= 0),
    notes text,
    currency_code text NOT NULL DEFAULT 'ZAR' CHECK (currency_code = 'ZAR'),
    status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Superseded')),
    submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    submitted_at timestamptz,
    approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    approved_at timestamptz,
    rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    rejected_at timestamptz,
    rejection_reason text,
    is_archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_forecast_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
    CONSTRAINT uq_forecast_project_number UNIQUE (project_id, version_number),
    CONSTRAINT uq_forecast_company UNIQUE (id, company_id),
    CONSTRAINT uq_forecast_company_project UNIQUE (id, company_id, project_id)
);

-- Table 6: finance_audit_log
CREATE TABLE IF NOT EXISTS public.finance_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    project_id uuid,
    source_table text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'POST', 'REVERSE', 'ARCHIVE', 'RESTORE', 'SUPERSEDE', 'CLOSE', 'CANCEL')),
    old_record jsonb,
    new_record jsonb,
    changed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
    changed_at timestamptz NOT NULL DEFAULT now(),
    transaction_identifier text DEFAULT pg_current_xact_id()::text
);


-- -----------------------------------------------------------------------------
-- 2. INDEXES & UNIQ CONSTRAINTS
-- -----------------------------------------------------------------------------

-- Cost Posting Source-Document Uniqueness (entry_type = 'Cost' only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_postings_source_uniq 
ON public.financial_cost_postings (company_id, source_type, source_record_id) 
WHERE entry_type = 'Cost' AND status NOT IN ('Reversed', 'Rejected') AND is_archived = false AND source_record_id IS NOT NULL;

-- Single Reversal Uniqueness Constraint per original posting
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_postings_reversal_uniq 
ON public.financial_cost_postings (reversal_of_id) 
WHERE reversal_of_id IS NOT NULL;

-- Concurrency-Safe Unique Indexes for Approved Header Records
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_approved_unique 
ON public.project_budget_versions (project_id) 
WHERE status = 'Approved' AND is_archived = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_forecast_approved_unique 
ON public.project_financial_forecasts (project_id) 
WHERE status = 'Approved' AND is_archived = false;

-- Operational Performance Indexes
CREATE INDEX IF NOT EXISTS idx_budget_versions_comp_proj ON public.project_budget_versions (company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_comp_ver ON public.project_budget_lines (company_id, budget_version_id);
CREATE INDEX IF NOT EXISTS idx_commitments_comp_proj ON public.financial_commitments (company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_cost_postings_comp_proj ON public.financial_cost_postings (company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_comp_proj ON public.project_financial_forecasts (company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_comp_rec ON public.finance_audit_log (company_id, source_table, record_id);


-- -----------------------------------------------------------------------------
-- 3. TRIGGERS & AUTOMATION
-- -----------------------------------------------------------------------------

-- Metadata & Identity-Protection Trigger
CREATE OR REPLACE FUNCTION public.fn_finance_metadata_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := now();
        NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
        NEW.updated_at := now();
        NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.created_at := OLD.created_at;
        NEW.created_by := OLD.created_by;
        NEW.updated_at := now();
        NEW.updated_by := COALESCE(auth.uid(), OLD.updated_by);

        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Field id is immutable.';
        END IF;
        IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
            RAISE EXCEPTION 'Field company_id is immutable.';
        END IF;
        IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
            RAISE EXCEPTION 'Field project_id is immutable.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_project_budget_versions
    BEFORE INSERT OR UPDATE ON public.project_budget_versions
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_metadata_trigger();

CREATE TRIGGER trg_meta_project_budget_lines
    BEFORE INSERT OR UPDATE ON public.project_budget_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_metadata_trigger();

CREATE TRIGGER trg_meta_financial_commitments
    BEFORE INSERT OR UPDATE ON public.financial_commitments
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_metadata_trigger();

CREATE TRIGGER trg_meta_financial_cost_postings
    BEFORE INSERT OR UPDATE ON public.financial_cost_postings
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_metadata_trigger();

CREATE TRIGGER trg_meta_project_financial_forecasts
    BEFORE INSERT OR UPDATE ON public.project_financial_forecasts
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_metadata_trigger();


-- Workflow State-Machine Triggers
CREATE OR REPLACE FUNCTION public.fn_protect_budget_version_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.status := 'Draft';
        NEW.submitted_by := NULL; NEW.submitted_at := NULL;
        NEW.approved_by := NULL; NEW.approved_at := NULL;
        NEW.rejected_by := NULL; NEW.rejected_at := NULL; NEW.rejection_reason := NULL;
        NEW.cancelled_by := NULL; NEW.cancelled_at := NULL; NEW.cancellation_reason := NULL;
        RETURN NEW;
    END IF;

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
        IF OLD.status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
            RAISE EXCEPTION 'Budget version cannot be archived or restored in status %.', OLD.status;
        END IF;

        IF NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.version_number IS DISTINCT FROM OLD.version_number OR
           NEW.version_label IS DISTINCT FROM OLD.version_label OR
           NEW.effective_date IS DISTINCT FROM OLD.effective_date OR
           NEW.original_budget_excl_vat IS DISTINCT FROM OLD.original_budget_excl_vat OR
           NEW.approved_variations_excl_vat IS DISTINCT FROM OLD.approved_variations_excl_vat OR
           NEW.current_budget_excl_vat IS DISTINCT FROM OLD.current_budget_excl_vat OR
           NEW.notes IS DISTINCT FROM OLD.notes OR
           NEW.currency_code IS DISTINCT FROM OLD.currency_code OR
           NEW.status IS DISTINCT FROM OLD.status OR
           NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
           NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
           NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
           NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
           NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR
           NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR
           NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
           NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR
           NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR
           NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason OR
           NEW.created_at IS DISTINCT FROM OLD.created_at OR
           NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'When archiving or restoring a budget version, no other fields may be modified in the same update.';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'Draft' AND NEW.status IN ('Submitted', 'Cancelled') THEN
            -- Valid
        ELSIF OLD.status = 'Submitted' AND NEW.status IN ('Approved', 'Rejected') THEN
            -- Valid
        ELSIF OLD.status = 'Approved' AND NEW.status = 'Superseded' THEN
            -- Valid
        ELSE
            RAISE EXCEPTION 'Invalid budget version status transition from % to %.', OLD.status, NEW.status;
        END IF;
    ELSE
        IF OLD.status <> 'Draft' AND (NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived) THEN
            RAISE EXCEPTION 'Cannot edit budget version fields when status is %.', OLD.status;
        END IF;
    END IF;

    IF OLD.status IN ('Approved', 'Superseded', 'Cancelled') THEN
        IF NEW.version_number IS DISTINCT FROM OLD.version_number
           OR NEW.version_label IS DISTINCT FROM OLD.version_label
           OR NEW.original_budget_excl_vat IS DISTINCT FROM OLD.original_budget_excl_vat
           OR NEW.approved_variations_excl_vat IS DISTINCT FROM OLD.approved_variations_excl_vat THEN
            RAISE EXCEPTION 'Budget version financial and identity values are immutable once approved or finalized.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_budget_version_workflow
    BEFORE INSERT OR UPDATE ON public.project_budget_versions
    FOR EACH ROW EXECUTE FUNCTION public.fn_protect_budget_version_workflow();


CREATE OR REPLACE FUNCTION public.fn_protect_commitment_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.status := 'Draft';
        NEW.submitted_by := NULL; NEW.submitted_at := NULL;
        NEW.approved_by := NULL; NEW.approved_at := NULL;
        NEW.rejected_by := NULL; NEW.rejected_at := NULL; NEW.rejection_reason := NULL;
        NEW.closed_by := NULL; NEW.closed_at := NULL;
        NEW.cancelled_by := NULL; NEW.cancelled_at := NULL; NEW.cancellation_reason := NULL;
        RETURN NEW;
    END IF;

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
        IF OLD.status NOT IN ('Closed', 'Cancelled') THEN
            RAISE EXCEPTION 'Financial commitment cannot be archived or restored in status %.', OLD.status;
        END IF;

        IF NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.commitment_reference IS DISTINCT FROM OLD.commitment_reference OR
           NEW.commitment_type IS DISTINCT FROM OLD.commitment_type OR
           NEW.counterparty_name IS DISTINCT FROM OLD.counterparty_name OR
           NEW.description IS DISTINCT FROM OLD.description OR
           NEW.original_amount_excl_vat IS DISTINCT FROM OLD.original_amount_excl_vat OR
           NEW.approved_variations_excl_vat IS DISTINCT FROM OLD.approved_variations_excl_vat OR
           NEW.revised_commitment_excl_vat IS DISTINCT FROM OLD.revised_commitment_excl_vat OR
           NEW.start_date IS DISTINCT FROM OLD.start_date OR
           NEW.completion_date IS DISTINCT FROM OLD.completion_date OR
           NEW.procurement_item_id IS DISTINCT FROM OLD.procurement_item_id OR
           NEW.notes IS DISTINCT FROM OLD.notes OR
           NEW.currency_code IS DISTINCT FROM OLD.currency_code OR
           NEW.status IS DISTINCT FROM OLD.status OR
           NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
           NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
           NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
           NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
           NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR
           NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR
           NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
           NEW.closed_by IS DISTINCT FROM OLD.closed_by OR
           NEW.closed_at IS DISTINCT FROM OLD.closed_at OR
           NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR
           NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR
           NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason OR
           NEW.created_at IS DISTINCT FROM OLD.created_at OR
           NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'When archiving or restoring a financial commitment, no other fields may be modified in the same update.';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'Draft' AND NEW.status IN ('Submitted', 'Cancelled') THEN
            -- Valid
        ELSIF OLD.status = 'Submitted' AND NEW.status IN ('Approved', 'Rejected', 'Cancelled') THEN
            -- Valid
        ELSIF OLD.status = 'Approved' AND NEW.status IN ('Closed', 'Cancelled') THEN
            -- Valid
        ELSE
            RAISE EXCEPTION 'Invalid commitment status transition from % to %.', OLD.status, NEW.status;
        END IF;
    ELSE
        IF OLD.status <> 'Draft' AND (NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived) THEN
            RAISE EXCEPTION 'Cannot edit financial commitment fields when status is %.', OLD.status;
        END IF;
    END IF;

    IF OLD.status IN ('Approved', 'Closed', 'Cancelled') THEN
        IF NEW.commitment_reference IS DISTINCT FROM OLD.commitment_reference
           OR NEW.commitment_type IS DISTINCT FROM OLD.commitment_type
           OR NEW.counterparty_name IS DISTINCT FROM OLD.counterparty_name
           OR NEW.original_amount_excl_vat IS DISTINCT FROM OLD.original_amount_excl_vat
           OR NEW.approved_variations_excl_vat IS DISTINCT FROM OLD.approved_variations_excl_vat THEN
            RAISE EXCEPTION 'Financial commitment financial and identity values are immutable once approved or finalized.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_commitment_workflow
    BEFORE INSERT OR UPDATE ON public.financial_commitments
    FOR EACH ROW EXECUTE FUNCTION public.fn_protect_commitment_workflow();


CREATE OR REPLACE FUNCTION public.fn_protect_cost_posting_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.entry_type = 'Reversal' THEN
            IF NEW.status <> 'Posted' OR NEW.reversal_of_id IS NULL OR NEW.amount_excl_vat >= 0 THEN
                RAISE EXCEPTION 'System reversals must be inserted as Posted with negative amount and reversal_of_id.';
            END IF;
        ELSE
            NEW.entry_type := 'Cost';
            NEW.status := 'Draft';
            NEW.reversal_of_id := NULL;
            NEW.submitted_by := NULL; NEW.submitted_at := NULL;
            NEW.posted_by := NULL; NEW.posted_at := NULL;
            NEW.rejected_by := NULL; NEW.rejected_at := NULL; NEW.rejection_reason := NULL;
            NEW.reversed_by := NULL; NEW.reversed_at := NULL; NEW.reversal_reason := NULL;
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
        IF OLD.status NOT IN ('Draft', 'Rejected') THEN
            RAISE EXCEPTION 'Cost posting cannot be archived or restored in status %.', OLD.status;
        END IF;

        IF NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.posting_reference IS DISTINCT FROM OLD.posting_reference OR
           NEW.posting_date IS DISTINCT FROM OLD.posting_date OR
           NEW.source_type IS DISTINCT FROM OLD.source_type OR
           NEW.source_record_id IS DISTINCT FROM OLD.source_record_id OR
           NEW.source_reference IS DISTINCT FROM OLD.source_reference OR
           NEW.commitment_id IS DISTINCT FROM OLD.commitment_id OR
           NEW.cost_category IS DISTINCT FROM OLD.cost_category OR
           NEW.description IS DISTINCT FROM OLD.description OR
           NEW.entry_type IS DISTINCT FROM OLD.entry_type OR
           NEW.amount_excl_vat IS DISTINCT FROM OLD.amount_excl_vat OR
           NEW.reversal_of_id IS DISTINCT FROM OLD.reversal_of_id OR
           NEW.notes IS DISTINCT FROM OLD.notes OR
           NEW.currency_code IS DISTINCT FROM OLD.currency_code OR
           NEW.status IS DISTINCT FROM OLD.status OR
           NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
           NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
           NEW.posted_by IS DISTINCT FROM OLD.posted_by OR
           NEW.posted_at IS DISTINCT FROM OLD.posted_at OR
           NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR
           NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR
           NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
           NEW.reversed_by IS DISTINCT FROM OLD.reversed_by OR
           NEW.reversed_at IS DISTINCT FROM OLD.reversed_at OR
           NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason OR
           NEW.created_at IS DISTINCT FROM OLD.created_at OR
           NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'When archiving or restoring a cost posting, no other fields may be modified in the same update.';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'Draft' AND NEW.status = 'Submitted' THEN
            -- Valid
        ELSIF OLD.status = 'Submitted' AND NEW.status IN ('Posted', 'Rejected') THEN
            -- Valid
        ELSIF OLD.status = 'Posted' AND NEW.status = 'Reversed' THEN
            -- Valid
        ELSE
            RAISE EXCEPTION 'Invalid cost posting status transition from % to %.', OLD.status, NEW.status;
        END IF;
    ELSE
        IF OLD.status <> 'Draft' AND (NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived) THEN
            RAISE EXCEPTION 'Cannot edit cost posting fields when status is %.', OLD.status;
        END IF;
    END IF;

    IF OLD.status IN ('Posted', 'Reversed') THEN
        IF NEW.posting_reference IS DISTINCT FROM OLD.posting_reference
           OR NEW.entry_type IS DISTINCT FROM OLD.entry_type
           OR NEW.amount_excl_vat IS DISTINCT FROM OLD.amount_excl_vat
           OR NEW.reversal_of_id IS DISTINCT FROM OLD.reversal_of_id
           OR NEW.source_type IS DISTINCT FROM OLD.source_type
           OR NEW.source_record_id IS DISTINCT FROM OLD.source_record_id THEN
            RAISE EXCEPTION 'Cost posting financial and identity values are immutable once posted or reversed.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_cost_posting_workflow
    BEFORE INSERT OR UPDATE ON public.financial_cost_postings
    FOR EACH ROW EXECUTE FUNCTION public.fn_protect_cost_posting_workflow();


CREATE OR REPLACE FUNCTION public.fn_protect_forecast_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.status := 'Draft';
        NEW.submitted_by := NULL; NEW.submitted_at := NULL;
        NEW.approved_by := NULL; NEW.approved_at := NULL;
        NEW.rejected_by := NULL; NEW.rejected_at := NULL; NEW.rejection_reason := NULL;
        RETURN NEW;
    END IF;

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
        IF OLD.status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
            RAISE EXCEPTION 'Financial forecast cannot be archived or restored in status %.', OLD.status;
        END IF;

        IF NEW.company_id IS DISTINCT FROM OLD.company_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.version_number IS DISTINCT FROM OLD.version_number OR
           NEW.version_label IS DISTINCT FROM OLD.version_label OR
           NEW.as_of_date IS DISTINCT FROM OLD.as_of_date OR
           NEW.forecast_contract_revenue_excl_vat IS DISTINCT FROM OLD.forecast_contract_revenue_excl_vat OR
           NEW.uncommitted_estimate_to_complete_excl_vat IS DISTINCT FROM OLD.uncommitted_estimate_to_complete_excl_vat OR
           NEW.notes IS DISTINCT FROM OLD.notes OR
           NEW.currency_code IS DISTINCT FROM OLD.currency_code OR
           NEW.status IS DISTINCT FROM OLD.status OR
           NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR
           NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
           NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
           NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
           NEW.rejected_by IS DISTINCT FROM OLD.rejected_by OR
           NEW.rejected_at IS DISTINCT FROM OLD.rejected_at OR
           NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
           NEW.created_at IS DISTINCT FROM OLD.created_at OR
           NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'When archiving or restoring a financial forecast, no other fields may be modified in the same update.';
        END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'Draft' AND NEW.status = 'Submitted' THEN
            -- Valid
        ELSIF OLD.status = 'Submitted' AND NEW.status IN ('Approved', 'Rejected') THEN
            -- Valid
        ELSIF OLD.status = 'Approved' AND NEW.status = 'Superseded' THEN
            -- Valid
        ELSE
            RAISE EXCEPTION 'Invalid forecast status transition from % to %.', OLD.status, NEW.status;
        END IF;
    ELSE
        IF OLD.status <> 'Draft' AND (NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived) THEN
            RAISE EXCEPTION 'Cannot edit forecast fields when status is %.', OLD.status;
        END IF;
    END IF;

    IF OLD.status IN ('Approved', 'Superseded') THEN
        IF NEW.version_number IS DISTINCT FROM OLD.version_number
           OR NEW.version_label IS DISTINCT FROM OLD.version_label
           OR NEW.forecast_contract_revenue_excl_vat IS DISTINCT FROM OLD.forecast_contract_revenue_excl_vat
           OR NEW.uncommitted_estimate_to_complete_excl_vat IS DISTINCT FROM OLD.uncommitted_estimate_to_complete_excl_vat THEN
            RAISE EXCEPTION 'Financial forecast financial and identity values are immutable once approved.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_forecast_workflow
    BEFORE INSERT OR UPDATE ON public.project_financial_forecasts
    FOR EACH ROW EXECUTE FUNCTION public.fn_protect_forecast_workflow();


-- Calculated Header Fields Trigger: Budgets & Commitments
CREATE OR REPLACE FUNCTION public.fn_calculate_finance_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_TABLE_NAME = 'project_budget_versions' THEN
        NEW.current_budget_excl_vat := COALESCE(NEW.original_budget_excl_vat, 0.00) + COALESCE(NEW.approved_variations_excl_vat, 0.00);
    ELSIF TG_TABLE_NAME = 'financial_commitments' THEN
        NEW.revised_commitment_excl_vat := COALESCE(NEW.original_amount_excl_vat, 0.00) + COALESCE(NEW.approved_variations_excl_vat, 0.00);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calc_budget_totals
    BEFORE INSERT OR UPDATE ON public.project_budget_versions
    FOR EACH ROW EXECUTE FUNCTION public.fn_calculate_finance_totals();

CREATE TRIGGER trg_calc_commitment_totals
    BEFORE INSERT OR UPDATE ON public.financial_commitments
    FOR EACH ROW EXECUTE FUNCTION public.fn_calculate_finance_totals();


-- Budget Line Draft Constraint Trigger
CREATE OR REPLACE FUNCTION public.fn_guard_budget_lines_draft()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent_status text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT status INTO v_parent_status
        FROM public.project_budget_versions
        WHERE id = OLD.budget_version_id;
    ELSE
        SELECT status INTO v_parent_status
        FROM public.project_budget_versions
        WHERE id = NEW.budget_version_id;
    END IF;

    IF v_parent_status IS NULL OR v_parent_status <> 'Draft' THEN
        RAISE EXCEPTION 'Budget lines may only be modified while parent budget version is in Draft status (current status: %).', COALESCE(v_parent_status, 'Unknown');
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_budget_lines_draft
    BEFORE INSERT OR UPDATE OR DELETE ON public.project_budget_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_budget_lines_draft();


-- Procurement Item Relationship Validation Trigger
CREATE OR REPLACE FUNCTION public.fn_validate_commitment_procurement_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_proc_company_id uuid;
    v_proc_project_id uuid;
BEGIN
    IF NEW.procurement_item_id IS NOT NULL THEN
        SELECT company_id, project_id
        INTO v_proc_company_id, v_proc_project_id
        FROM public.procurement_items
        WHERE id = NEW.procurement_item_id;

        IF v_proc_company_id IS NULL THEN
            RAISE EXCEPTION 'Referenced procurement item % does not exist.', NEW.procurement_item_id;
        END IF;

        IF v_proc_company_id IS DISTINCT FROM NEW.company_id OR v_proc_project_id IS DISTINCT FROM NEW.project_id THEN
            RAISE EXCEPTION 'Procurement item % does not belong to company % and project %.', NEW.procurement_item_id, NEW.company_id, NEW.project_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_commitment_procurement_item
    BEFORE INSERT OR UPDATE ON public.financial_commitments
    FOR EACH ROW EXECUTE FUNCTION public.fn_validate_commitment_procurement_item();


-- Audit Logging Trigger Function
CREATE OR REPLACE FUNCTION public.fn_finance_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_action text;
    v_new_status text;
    v_old_status text;
    v_new_archived boolean;
    v_old_archived boolean;
    v_company_id uuid;
    v_project_id uuid;
    v_record_id uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_company_id := NEW.company_id;
        v_project_id := NEW.project_id;
        v_record_id := NEW.id;

        INSERT INTO public.finance_audit_log (
            company_id, project_id, source_table, record_id, action, old_record, new_record, changed_by, changed_at, transaction_identifier
        ) VALUES (
            v_company_id, v_project_id, TG_TABLE_NAME, v_record_id, v_action, NULL, to_jsonb(NEW), auth.uid(), now(), pg_current_xact_id()::text
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        v_company_id := NEW.company_id;
        v_project_id := NEW.project_id;
        v_record_id := NEW.id;

        v_new_status := to_jsonb(NEW)->>'status';
        v_old_status := to_jsonb(OLD)->>'status';

        v_new_archived := (to_jsonb(NEW)->>'is_archived')::boolean;
        v_old_archived := (to_jsonb(OLD)->>'is_archived')::boolean;

        IF v_new_archived IS TRUE AND (v_old_archived IS FALSE OR v_old_archived IS NULL) THEN
            v_action := 'ARCHIVE';
        ELSIF v_new_archived IS FALSE AND v_old_archived IS TRUE THEN
            v_action := 'RESTORE';
        ELSIF v_new_status IS DISTINCT FROM v_old_status THEN
            CASE v_new_status
                WHEN 'Submitted' THEN v_action := 'SUBMIT';
                WHEN 'Approved' THEN v_action := 'APPROVE';
                WHEN 'Rejected' THEN v_action := 'REJECT';
                WHEN 'Posted' THEN v_action := 'POST';
                WHEN 'Reversed' THEN v_action := 'REVERSE';
                WHEN 'Superseded' THEN v_action := 'SUPERSEDE';
                WHEN 'Closed' THEN v_action := 'CLOSE';
                WHEN 'Cancelled' THEN v_action := 'CANCEL';
                ELSE v_action := 'UPDATE';
            END CASE;
        ELSE
            v_action := 'UPDATE';
        END IF;

        INSERT INTO public.finance_audit_log (
            company_id, project_id, source_table, record_id, action, old_record, new_record, changed_by, changed_at, transaction_identifier
        ) VALUES (
            v_company_id, v_project_id, TG_TABLE_NAME, v_record_id, v_action, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), now(), pg_current_xact_id()::text
        );
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

-- Apply Audit Triggers (INSERT OR UPDATE only; NO DELETE)
CREATE TRIGGER trg_audit_project_budget_versions
    AFTER INSERT OR UPDATE ON public.project_budget_versions
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_audit_trigger();

CREATE TRIGGER trg_audit_project_budget_lines
    AFTER INSERT OR UPDATE ON public.project_budget_lines
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_audit_trigger();

CREATE TRIGGER trg_audit_financial_commitments
    AFTER INSERT OR UPDATE ON public.financial_commitments
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_audit_trigger();

CREATE TRIGGER trg_audit_financial_cost_postings
    AFTER INSERT OR UPDATE ON public.financial_cost_postings
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_audit_trigger();

CREATE TRIGGER trg_audit_project_financial_forecasts
    AFTER INSERT OR UPDATE ON public.project_financial_forecasts
    FOR EACH ROW EXECUTE FUNCTION public.fn_finance_audit_trigger();


-- -----------------------------------------------------------------------------
-- 4. SOFT ARCHIVING & RESTORE LOGIC
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id uuid;
    v_project_id uuid;
    v_status text;
    v_is_archived boolean;
    v_result jsonb;
BEGIN
    IF p_table NOT IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts') THEN
        RAISE EXCEPTION 'Table % is not eligible for soft archiving.', p_table;
    END IF;

    EXECUTE format('SELECT company_id, project_id, status, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table)
    INTO v_company_id, v_project_id, v_status, v_is_archived
    USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % in table % was not found.', p_id, p_table;
    END IF;

    IF v_is_archived THEN
        RAISE EXCEPTION 'Record is already archived.';
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance permissions for company %.', v_company_id;
    END IF;

    CASE p_table
        WHEN 'project_budget_versions' THEN
            IF v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
                RAISE EXCEPTION 'Budget version cannot be archived in status %.', v_status;
            END IF;
        WHEN 'financial_commitments' THEN
            IF v_status NOT IN ('Closed', 'Cancelled') THEN
                RAISE EXCEPTION 'Financial commitment cannot be archived in status %.', v_status;
            END IF;
        WHEN 'financial_cost_postings' THEN
            IF v_status NOT IN ('Draft', 'Rejected') THEN
                RAISE EXCEPTION 'Cost posting cannot be archived in status %.', v_status;
            END IF;
        WHEN 'project_financial_forecasts' THEN
            IF v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
                RAISE EXCEPTION 'Forecast cannot be archived in status %.', v_status;
            END IF;
    END CASE;

    EXECUTE format('UPDATE public.%I SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table)
    INTO v_result
    USING p_id;

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
    v_project_id uuid;
    v_status text;
    v_is_archived boolean;
    v_result jsonb;
BEGIN
    IF p_table NOT IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts') THEN
        RAISE EXCEPTION 'Table % is not eligible for soft restoration.', p_table;
    END IF;

    EXECUTE format('SELECT company_id, project_id, status, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table)
    INTO v_company_id, v_project_id, v_status, v_is_archived
    USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % in table % was not found.', p_id, p_table;
    END IF;

    IF NOT v_is_archived THEN
        RAISE EXCEPTION 'Record is not archived.';
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance permissions for company %.', v_company_id;
    END IF;

    CASE p_table
        WHEN 'project_budget_versions' THEN
            IF v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
                RAISE EXCEPTION 'Budget version cannot be restored in status %.', v_status;
            END IF;
        WHEN 'financial_commitments' THEN
            IF v_status NOT IN ('Closed', 'Cancelled') THEN
                RAISE EXCEPTION 'Financial commitment cannot be restored in status %.', v_status;
            END IF;
        WHEN 'financial_cost_postings' THEN
            IF v_status NOT IN ('Draft', 'Rejected') THEN
                RAISE EXCEPTION 'Cost posting cannot be restored in status %.', v_status;
            END IF;
        WHEN 'project_financial_forecasts' THEN
            IF v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
                RAISE EXCEPTION 'Forecast cannot be restored in status %.', v_status;
            END IF;
    END CASE;

    EXECUTE format('UPDATE public.%I SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table)
    INTO v_result
    USING p_id;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_finance_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_finance_record(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_finance_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_finance_record(text, uuid) TO authenticated;


-- -----------------------------------------------------------------------------
-- 5. WORKFLOW RPC FUNCTIONS
-- -----------------------------------------------------------------------------

-- --- BUDGET WORKFLOWS ---

CREATE OR REPLACE FUNCTION public.submit_budget_version(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_budget_versions%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.project_budget_versions WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget version % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot submit an archived budget version.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Budget version must be in Draft status to submit (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_budget_versions
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

CREATE OR REPLACE FUNCTION public.approve_budget_version(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_budget_versions%ROWTYPE;
    v_orig_lines_total numeric(15,2);
    v_var_lines_total numeric(15,2);
BEGIN
    SELECT * INTO v_rec FROM public.project_budget_versions WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget version % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot approve an archived budget version.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Budget version must be in Submitted status to approve (current status: %).', v_rec.status;
    END IF;

    SELECT 
        COALESCE(SUM(CASE WHEN line_type = 'Original Budget' THEN amount_excl_vat ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN line_type = 'Approved Variation' THEN amount_excl_vat ELSE 0 END), 0.00)
    INTO v_orig_lines_total, v_var_lines_total
    FROM public.project_budget_lines
    WHERE budget_version_id = p_id AND is_archived = false;

    IF v_orig_lines_total <> v_rec.original_budget_excl_vat THEN
        RAISE EXCEPTION 'Original budget line total (%) does not match budget header original total (%).', v_orig_lines_total, v_rec.original_budget_excl_vat;
    END IF;

    IF v_var_lines_total <> v_rec.approved_variations_excl_vat THEN
        RAISE EXCEPTION 'Approved variation line total (%) does not match budget header variation total (%).', v_var_lines_total, v_rec.approved_variations_excl_vat;
    END IF;

    UPDATE public.project_budget_versions
    SET status = 'Superseded',
        updated_at = now(),
        updated_by = auth.uid()
    WHERE project_id = v_rec.project_id
      AND status = 'Approved'
      AND id <> p_id;

    UPDATE public.project_budget_versions
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

CREATE OR REPLACE FUNCTION public.reject_budget_version(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_budget_versions%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank rejection reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.project_budget_versions WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget version % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot reject an archived budget version.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Budget version must be in Submitted status to reject (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_budget_versions
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_budget_version(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_budget_versions%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank cancellation reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.project_budget_versions WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget version % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot cancel an archived budget version.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Budget version can only be cancelled from Draft status (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_budget_versions
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;


-- --- FINANCIAL COMMITMENTS WORKFLOWS ---

CREATE OR REPLACE FUNCTION public.submit_financial_commitment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot submit an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Commitment must be in Draft status to submit (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
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

CREATE OR REPLACE FUNCTION public.approve_financial_commitment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot approve an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Commitment must be in Submitted status to approve (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
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

CREATE OR REPLACE FUNCTION public.reject_financial_commitment(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank rejection reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot reject an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Commitment must be in Submitted status to reject (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_financial_commitment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot close an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Approved' THEN
        RAISE EXCEPTION 'Commitment must be in Approved status to close (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
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

CREATE OR REPLACE FUNCTION public.cancel_financial_commitment(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank cancellation reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot cancel an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
        RAISE EXCEPTION 'Commitment can only be cancelled from Draft, Submitted or Approved status (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;


-- --- FINANCIAL COST POSTINGS WORKFLOWS ---

CREATE OR REPLACE FUNCTION public.submit_financial_cost_posting(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_cost_postings%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_cost_postings WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost posting % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot submit an archived cost posting.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Cost posting must be in Draft status to submit (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_cost_postings
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

CREATE OR REPLACE FUNCTION public.post_financial_cost_posting(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_cost_postings%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_cost_postings WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost posting % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot post an archived cost posting.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Cost posting must be in Submitted status to post (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_cost_postings
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

CREATE OR REPLACE FUNCTION public.reject_financial_cost_posting(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_cost_postings%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank rejection reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.financial_cost_postings WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost posting % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot reject an archived cost posting.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Cost posting must be in Submitted status to reject (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_cost_postings
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_financial_cost_posting(
    p_cost_posting_id uuid,
    p_reversal_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig public.financial_cost_postings%ROWTYPE;
    v_rev public.financial_cost_postings%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reversal_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank reversal reason must be provided.';
    END IF;

    IF p_cost_posting_id IS NULL THEN
        RAISE EXCEPTION 'Cost posting ID must be provided.';
    END IF;

    SELECT * INTO v_orig FROM public.financial_cost_postings WHERE id = p_cost_posting_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost posting % not found.', p_cost_posting_id;
    END IF;

    IF v_orig.is_archived THEN
        RAISE EXCEPTION 'Cannot reverse an archived cost posting.';
    END IF;

    IF NOT public.has_finance_full_access(v_orig.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_orig.company_id;
    END IF;

    IF v_orig.status <> 'Posted' THEN
        RAISE EXCEPTION 'Cost posting must be in Posted status to reverse (current status: %).', v_orig.status;
    END IF;

    IF v_orig.entry_type <> 'Cost' THEN
        RAISE EXCEPTION 'Only primary Cost postings can be reversed.';
    END IF;

    UPDATE public.financial_cost_postings
    SET status = 'Reversed',
        reversed_by = auth.uid(),
        reversed_at = now(),
        reversal_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_cost_posting_id;

    INSERT INTO public.financial_cost_postings (
        company_id,
        project_id,
        posting_reference,
        posting_date,
        source_type,
        source_record_id,
        source_reference,
        commitment_id,
        cost_category,
        description,
        entry_type,
        amount_excl_vat,
        reversal_of_id,
        notes,
        currency_code,
        status,
        posted_by,
        posted_at,
        reversal_reason,
        is_archived,
        created_by,
        updated_by
    ) VALUES (
        v_orig.company_id,
        v_orig.project_id,
        v_orig.posting_reference || '-REV',
        CURRENT_DATE,
        v_orig.source_type,
        v_orig.source_record_id,
        v_orig.source_reference,
        v_orig.commitment_id,
        v_orig.cost_category,
        'Reversal of ' || v_orig.posting_reference || ': ' || v_clean_reason,
        'Reversal',
        -1 * ABS(v_orig.amount_excl_vat),
        v_orig.id,
        v_orig.notes,
        v_orig.currency_code,
        'Posted',
        auth.uid(),
        now(),
        v_clean_reason,
        false,
        auth.uid(),
        auth.uid()
    ) RETURNING * INTO v_rev;

    RETURN to_jsonb(v_rev);
END;
$$;


-- --- PROJECT FINANCIAL FORECASTS WORKFLOWS ---

CREATE OR REPLACE FUNCTION public.submit_project_financial_forecast(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_financial_forecasts%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.project_financial_forecasts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial forecast % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot submit an archived financial forecast.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Forecast must be in Draft status to submit (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_financial_forecasts
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

CREATE OR REPLACE FUNCTION public.approve_project_financial_forecast(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_financial_forecasts%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.project_financial_forecasts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial forecast % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot approve an archived financial forecast.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Forecast must be in Submitted status to approve (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_financial_forecasts
    SET status = 'Superseded',
        updated_at = now(),
        updated_by = auth.uid()
    WHERE project_id = v_rec.project_id
      AND status = 'Approved'
      AND id <> p_id;

    UPDATE public.project_financial_forecasts
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

CREATE OR REPLACE FUNCTION public.reject_project_financial_forecast(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_financial_forecasts%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank rejection reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.project_financial_forecasts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial forecast % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot reject an archived financial forecast.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Forecast must be in Submitted status to reject (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_financial_forecasts
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

-- Revoke & Grant EXECUTE on all Workflow RPCs
REVOKE ALL ON FUNCTION public.submit_budget_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_budget_version(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_budget_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_budget_version(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_budget_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_budget_version(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_budget_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_budget_version(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_financial_commitment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_financial_commitment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_financial_commitment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_financial_commitment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.close_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_financial_commitment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_financial_commitment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_financial_commitment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_financial_cost_posting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_financial_cost_posting(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.post_financial_cost_posting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_financial_cost_posting(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_financial_cost_posting(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_financial_cost_posting(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_financial_cost_posting(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_financial_cost_posting(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_project_financial_forecast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_project_financial_forecast(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_project_financial_forecast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_project_financial_forecast(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_project_financial_forecast(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_project_financial_forecast(uuid, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY & REVOKE/GRANT PRIVILEGES
-- -----------------------------------------------------------------------------

-- Explicit REVOKE of all privileges on finance tables
REVOKE ALL ON TABLE public.finance_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_budget_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_budget_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.financial_commitments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.financial_cost_postings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_financial_forecasts FROM PUBLIC, anon, authenticated;

-- Enable Row Level Security
ALTER TABLE public.project_budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cost_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_financial_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;

-- Apply SELECT table grants and column-level INSERT/UPDATE grants (Strictly NO DELETE grants)
GRANT SELECT ON TABLE public.project_budget_versions TO authenticated;
GRANT INSERT (company_id, project_id, version_number, version_label, effective_date, original_budget_excl_vat, approved_variations_excl_vat, notes, currency_code) ON TABLE public.project_budget_versions TO authenticated;
GRANT UPDATE (company_id, project_id, version_number, version_label, effective_date, original_budget_excl_vat, approved_variations_excl_vat, notes, currency_code) ON TABLE public.project_budget_versions TO authenticated;

GRANT SELECT ON TABLE public.project_budget_lines TO authenticated;
GRANT INSERT (company_id, project_id, budget_version_id, line_code, cost_category, description, line_type, amount_excl_vat, sort_order, is_archived) ON TABLE public.project_budget_lines TO authenticated;
GRANT UPDATE (company_id, project_id, budget_version_id, line_code, cost_category, description, line_type, amount_excl_vat, sort_order, is_archived) ON TABLE public.project_budget_lines TO authenticated;

GRANT SELECT ON TABLE public.financial_commitments TO authenticated;
GRANT INSERT (company_id, project_id, commitment_reference, commitment_type, counterparty_name, description, original_amount_excl_vat, approved_variations_excl_vat, start_date, completion_date, procurement_item_id, notes, currency_code) ON TABLE public.financial_commitments TO authenticated;
GRANT UPDATE (company_id, project_id, commitment_reference, commitment_type, counterparty_name, description, original_amount_excl_vat, approved_variations_excl_vat, start_date, completion_date, procurement_item_id, notes, currency_code) ON TABLE public.financial_commitments TO authenticated;

GRANT SELECT ON TABLE public.financial_cost_postings TO authenticated;
GRANT INSERT (company_id, project_id, posting_reference, posting_date, source_type, source_record_id, source_reference, commitment_id, cost_category, description, amount_excl_vat, notes, currency_code) ON TABLE public.financial_cost_postings TO authenticated;
GRANT UPDATE (company_id, project_id, posting_reference, posting_date, source_type, source_record_id, source_reference, commitment_id, cost_category, description, amount_excl_vat, notes, currency_code) ON TABLE public.financial_cost_postings TO authenticated;

GRANT SELECT ON TABLE public.project_financial_forecasts TO authenticated;
GRANT INSERT (company_id, project_id, version_number, version_label, as_of_date, forecast_contract_revenue_excl_vat, uncommitted_estimate_to_complete_excl_vat, notes, currency_code) ON TABLE public.project_financial_forecasts TO authenticated;
GRANT UPDATE (company_id, project_id, version_number, version_label, as_of_date, forecast_contract_revenue_excl_vat, uncommitted_estimate_to_complete_excl_vat, notes, currency_code) ON TABLE public.project_financial_forecasts TO authenticated;

GRANT SELECT ON TABLE public.finance_audit_log TO authenticated;

-- RLS Policies for project_budget_versions
CREATE POLICY p_budget_versions_select ON public.project_budget_versions
    FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

CREATE POLICY p_budget_versions_insert ON public.project_budget_versions
    FOR INSERT TO authenticated WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY p_budget_versions_update ON public.project_budget_versions
    FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- RLS Policies for project_budget_lines
CREATE POLICY p_budget_lines_select ON public.project_budget_lines
    FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

CREATE POLICY p_budget_lines_insert ON public.project_budget_lines
    FOR INSERT TO authenticated WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY p_budget_lines_update ON public.project_budget_lines
    FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- RLS Policies for financial_commitments
CREATE POLICY p_commitments_select ON public.financial_commitments
    FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

CREATE POLICY p_commitments_insert ON public.financial_commitments
    FOR INSERT TO authenticated WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY p_commitments_update ON public.financial_commitments
    FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- RLS Policies for financial_cost_postings
CREATE POLICY p_cost_postings_select ON public.financial_cost_postings
    FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

CREATE POLICY p_cost_postings_insert ON public.financial_cost_postings
    FOR INSERT TO authenticated WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY p_cost_postings_update ON public.financial_cost_postings
    FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- RLS Policies for project_financial_forecasts
CREATE POLICY p_forecasts_select ON public.project_financial_forecasts
    FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

CREATE POLICY p_forecasts_insert ON public.project_financial_forecasts
    FOR INSERT TO authenticated WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY p_forecasts_update ON public.project_financial_forecasts
    FOR UPDATE TO authenticated
    USING (public.has_finance_full_access(company_id))
    WITH CHECK (public.has_finance_full_access(company_id));

-- RLS Policies for finance_audit_log (SELECT only)
CREATE POLICY p_audit_log_select ON public.finance_audit_log
    FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

COMMIT;
