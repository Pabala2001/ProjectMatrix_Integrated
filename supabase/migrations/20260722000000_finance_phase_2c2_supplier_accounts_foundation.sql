-- ============================================================================
-- PROJECTMATRIX ACCOUNTS — PHASE 2C.2A-R7
-- SUPPLIER ACCOUNTS, CASHBOOK BRIDGE, CONCURRENCY, ATTACHMENTS AND HISTORY REBUILD
-- ============================================================================
-- File: supabase/migrations/20260722000000_finance_phase_2c2_supplier_accounts_foundation.sql
-- Description: Complete replacement SQL for the unapplied Supplier Accounts
--              Foundation migration. Phase 2B.1 and Phase 2C.1 remain immutable.
--
-- Global lock order used by all Supplier Accounts workflows:
--   supplier_accounts
--   -> financial_commitments
--   -> supplier_invoices (and their credit notes)
--   -> supplier_payments
--   -> supplier_payment_allocations
--   -> financial_cost_postings
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- SECTION 0: PREREQUISITE ASSERTIONS
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- Verify core access control function from Phase 2B.1
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_finance_full_access'
  ) THEN
    RAISE EXCEPTION 'Prerequisite failed: public.has_finance_full_access function does not exist.';
  END IF;

  -- Verify prerequisite tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    RAISE EXCEPTION 'Prerequisite failed: public.companies table does not exist.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    RAISE EXCEPTION 'Prerequisite failed: public.projects table does not exist.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_commitments') THEN
    RAISE EXCEPTION 'Prerequisite failed: public.financial_commitments table does not exist.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_cost_postings') THEN
    RAISE EXCEPTION 'Prerequisite failed: public.financial_cost_postings table does not exist.';
  END IF;

  -- Verify the already-deployed Cashbook foundation required by the Supplier Payment bridge
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
    RAISE EXCEPTION 'Prerequisite failed: public.bank_accounts table does not exist. Apply the Cashbook foundation first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cashbook_transactions') THEN
    RAISE EXCEPTION 'Prerequisite failed: public.cashbook_transactions table does not exist. Apply the Cashbook foundation first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cashbook_allocations') THEN
    RAISE EXCEPTION 'Prerequisite failed: public.cashbook_allocations table does not exist. Apply the Cashbook foundation first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('submit_cashbook_transaction','approve_cashbook_transaction','post_cashbook_transaction')
    GROUP BY n.nspname HAVING COUNT(DISTINCT p.proname) = 3
  ) THEN
    RAISE EXCEPTION 'Prerequisite failed: Cashbook lifecycle RPCs are missing.';
  END IF;

  -- Verify prerequisite column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_commitments' AND column_name = 'revised_commitment_excl_vat'
  ) THEN
    RAISE EXCEPTION 'Prerequisite failed: financial_commitments.revised_commitment_excl_vat column does not exist.';
  END IF;

  -- Assert that all Supplier Accounts tables are absent
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'supplier_accounts',
        'supplier_invoices',
        'supplier_invoice_lines',
        'supplier_credit_notes',
        'supplier_credit_note_lines',
        'supplier_payments',
        'supplier_payment_allocations',
        'supplier_accounts_audit_log',
        'supplier_attachments'
      )
  ) THEN
    RAISE EXCEPTION 'Prerequisite failed: One or more Supplier Accounts tables already exist. This one-shot migration has not been applied cleanly.';
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- SECTION 1: BASE TABLES & SCHEMA
-- ----------------------------------------------------------------------------

-- 1.1 SUPPLIER ACCOUNTS
CREATE TABLE public.supplier_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  supplier_code text NOT NULL,
  legal_name text NOT NULL,
  trading_name text,
  registration_number text,
  vat_number text,
  contact_person text,
  email text,
  telephone text,
  physical_address text,
  payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  default_currency text NOT NULL DEFAULT 'ZAR' CHECK (default_currency = 'ZAR'),
  bank_details jsonb,
  notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_active boolean NOT NULL DEFAULT false,
  activated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  activated_at timestamptz,
  deactivated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  deactivated_at timestamptz,
  deactivation_reason text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_supplier_accounts_code UNIQUE (company_id, supplier_code),
  CONSTRAINT uq_sa_comp_supp UNIQUE (id, company_id),
  CONSTRAINT uq_sa_full_context UNIQUE (id, company_id, default_currency)
);

-- 1.2 EXTEND FINANCIAL COMMITMENTS
ALTER TABLE public.financial_commitments
  ADD COLUMN IF NOT EXISTS supplier_account_id uuid;

ALTER TABLE public.financial_commitments
  ADD COLUMN IF NOT EXISTS supplier_associated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS supplier_associated_at timestamptz;

ALTER TABLE public.financial_commitments
  DROP CONSTRAINT IF EXISTS fk_fc_supplier;

ALTER TABLE public.financial_commitments
  ADD CONSTRAINT fk_fc_supplier FOREIGN KEY (supplier_account_id, company_id)
  REFERENCES public.supplier_accounts(id, company_id) ON DELETE RESTRICT;

ALTER TABLE public.financial_commitments
  DROP CONSTRAINT IF EXISTS uq_fc_id_company_project;

ALTER TABLE public.financial_commitments
  ADD CONSTRAINT uq_fc_id_company_project UNIQUE (id, company_id, project_id);

ALTER TABLE public.financial_commitments
  DROP CONSTRAINT IF EXISTS uq_fc_id_company_project_supplier;

ALTER TABLE public.financial_commitments
  ADD CONSTRAINT uq_fc_id_company_project_supplier UNIQUE (id, company_id, project_id, supplier_account_id);

CREATE INDEX IF NOT EXISTS idx_fc_supplier_account_id ON public.financial_commitments(supplier_account_id);


-- 1.3 SUPPLIER INVOICES
CREATE TABLE public.supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  supplier_account_id uuid NOT NULL,
  financial_commitment_id uuid NOT NULL,
  supplier_invoice_number text NOT NULL,
  external_reference text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  billing_period_start date,
  billing_period_end date,
  notes text,
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  subtotal_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
  vat_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  total_incl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Cancelled')),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  rejected_at timestamptz,
  rejection_reason text,
  posted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancellation_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_si_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_si_supplier FOREIGN KEY (supplier_account_id, company_id, currency) REFERENCES public.supplier_accounts(id, company_id, default_currency) ON DELETE RESTRICT,
  CONSTRAINT fk_si_commitment FOREIGN KEY (financial_commitment_id, company_id, project_id, supplier_account_id) REFERENCES public.financial_commitments(id, company_id, project_id, supplier_account_id) ON DELETE RESTRICT,
  CONSTRAINT uq_si_comp_inv_num UNIQUE (company_id, supplier_account_id, supplier_invoice_number),
  CONSTRAINT uq_si_comp_id UNIQUE (id, company_id),
  CONSTRAINT uq_si_comp_proj UNIQUE (id, company_id, project_id),
  CONSTRAINT uq_si_comp_proj_supp UNIQUE (id, company_id, project_id, supplier_account_id),
  CONSTRAINT uq_si_full_context UNIQUE (id, company_id, project_id, supplier_account_id, currency),
  CONSTRAINT uq_si_comm_context UNIQUE (id, company_id, project_id, supplier_account_id, financial_commitment_id, currency),
  CONSTRAINT uq_si_cost_context UNIQUE (id, company_id, project_id, financial_commitment_id, currency),
  CONSTRAINT chk_si_billing_period CHECK (billing_period_end IS NULL OR billing_period_start IS NULL OR billing_period_end >= billing_period_start),
  CONSTRAINT chk_si_due_date CHECK (due_date >= invoice_date)
);

-- 1.4 SUPPLIER INVOICE LINES
CREATE TABLE public.supplier_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  supplier_invoice_id uuid NOT NULL,
  supplier_account_id uuid NOT NULL,
  financial_commitment_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  line_code text NOT NULL,
  description text NOT NULL,
  quantity numeric(15,4) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'SUM',
  unit_rate_excl_vat numeric(15,2) NOT NULL CHECK (unit_rate_excl_vat >= 0),
  vat_rate numeric(5,2) NOT NULL DEFAULT 15.00 CHECK (vat_rate >= 0),
  amount_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
  vat_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  amount_incl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
  cost_category text NOT NULL DEFAULT 'Supplier Cost',
  sort_order integer NOT NULL DEFAULT 1,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_sil_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_sil_invoice FOREIGN KEY (
    supplier_invoice_id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  ) REFERENCES public.supplier_invoices(
    id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  ) ON DELETE RESTRICT,
  CONSTRAINT uq_sil_inv_line UNIQUE (supplier_invoice_id, line_code),
  CONSTRAINT uq_sil_comp_id UNIQUE (id, company_id),
  CONSTRAINT uq_sil_comp_proj UNIQUE (id, company_id, project_id),
  CONSTRAINT uq_sil_full_context UNIQUE (
    id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  )
);


-- 1.5 SUPPLIER CREDIT NOTES
CREATE TABLE public.supplier_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  supplier_account_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  financial_commitment_id uuid NOT NULL,
  credit_note_number text NOT NULL,
  external_reference text,
  credit_note_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  notes text,
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  subtotal_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
  vat_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  total_incl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Cancelled')),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  rejected_at timestamptz,
  rejection_reason text,
  posted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancellation_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_scn_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_scn_supplier FOREIGN KEY (supplier_account_id, company_id, currency) REFERENCES public.supplier_accounts(id, company_id, default_currency) ON DELETE RESTRICT,
  CONSTRAINT fk_scn_invoice FOREIGN KEY (invoice_id, company_id, project_id, supplier_account_id, currency) REFERENCES public.supplier_invoices(id, company_id, project_id, supplier_account_id, currency) ON DELETE RESTRICT,
  CONSTRAINT fk_scn_commitment FOREIGN KEY (financial_commitment_id, company_id, project_id, supplier_account_id) REFERENCES public.financial_commitments(id, company_id, project_id, supplier_account_id) ON DELETE RESTRICT,
  CONSTRAINT uq_scn_comp_cn_num UNIQUE (company_id, supplier_account_id, credit_note_number),
  CONSTRAINT uq_scn_comp_id UNIQUE (id, company_id),
  CONSTRAINT uq_scn_comp_proj UNIQUE (id, company_id, project_id),
  CONSTRAINT uq_scn_comp_proj_supp UNIQUE (id, company_id, project_id, supplier_account_id),
  CONSTRAINT uq_scn_full_context UNIQUE (id, company_id, project_id, supplier_account_id, currency),
  CONSTRAINT uq_scn_comm_context UNIQUE (
    id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  ),
  CONSTRAINT uq_scn_cost_context UNIQUE (id, company_id, project_id, financial_commitment_id, currency)
);

-- 1.6 SUPPLIER CREDIT NOTE LINES
CREATE TABLE public.supplier_credit_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  credit_note_id uuid NOT NULL,
  invoice_line_id uuid,
  supplier_account_id uuid NOT NULL,
  financial_commitment_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  line_code text NOT NULL,
  description text NOT NULL,
  quantity numeric(15,4) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'SUM',
  unit_rate_excl_vat numeric(15,2) NOT NULL CHECK (unit_rate_excl_vat >= 0),
  vat_rate numeric(5,2) NOT NULL DEFAULT 15.00 CHECK (vat_rate >= 0),
  amount_excl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
  vat_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  amount_incl_vat numeric(15,2) NOT NULL DEFAULT 0.00,
  cost_category text NOT NULL DEFAULT 'Supplier Cost',
  sort_order integer NOT NULL DEFAULT 1,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_scnl_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_scnl_cn FOREIGN KEY (
    credit_note_id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  ) REFERENCES public.supplier_credit_notes(
    id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  ) ON DELETE RESTRICT,
  CONSTRAINT fk_scnl_inv_line FOREIGN KEY (
    invoice_line_id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  ) REFERENCES public.supplier_invoice_lines(
    id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  ) ON DELETE RESTRICT,
  CONSTRAINT uq_scnl_cn_line UNIQUE (credit_note_id, line_code),
  CONSTRAINT uq_scnl_comp_id UNIQUE (id, company_id),
  CONSTRAINT uq_scnl_full_context UNIQUE (
    id,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  )
);


-- 1.7 SUPPLIER PAYMENTS
CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  supplier_account_id uuid NOT NULL,
  payment_reference text NOT NULL,
  external_reference text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'EFT' CHECK (payment_method IN ('EFT', 'Cheque', 'Credit Card', 'Cash', 'Other')),
  amount_paid numeric(15,2) NOT NULL CHECK (amount_paid > 0),
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  notes text,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Posted', 'Rejected', 'Cancelled', 'Reversed')),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  rejected_at timestamptz,
  rejection_reason text,
  posted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancellation_reason text,
  reversed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reversed_at timestamptz,
  reversal_reason text,
  bank_account_id uuid NOT NULL,
  cashbook_transaction_id uuid,
  cashbook_reversal_transaction_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_sp_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_sp_supplier FOREIGN KEY (supplier_account_id, company_id, currency) REFERENCES public.supplier_accounts(id, company_id, default_currency) ON DELETE RESTRICT,
  CONSTRAINT fk_sp_bank_account FOREIGN KEY (bank_account_id, company_id) REFERENCES public.bank_accounts(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_sp_cashbook_transaction FOREIGN KEY (cashbook_transaction_id, company_id) REFERENCES public.cashbook_transactions(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_sp_cashbook_reversal_transaction FOREIGN KEY (cashbook_reversal_transaction_id, company_id) REFERENCES public.cashbook_transactions(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT uq_sp_cashbook_transaction UNIQUE (cashbook_transaction_id),
  CONSTRAINT uq_sp_cashbook_reversal_transaction UNIQUE (cashbook_reversal_transaction_id),
  CONSTRAINT uq_sp_comp_ref UNIQUE (company_id, supplier_account_id, payment_reference),
  CONSTRAINT uq_sp_comp_id UNIQUE (id, company_id),
  CONSTRAINT uq_sp_comp_proj UNIQUE (id, company_id, project_id),
  CONSTRAINT uq_sp_comp_proj_supp UNIQUE (id, company_id, project_id, supplier_account_id),
  CONSTRAINT uq_sp_full_context UNIQUE (id, company_id, project_id, supplier_account_id, currency)
);


-- 1.8 SUPPLIER PAYMENT ALLOCATIONS
CREATE TABLE public.supplier_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL,
  supplier_account_id uuid NOT NULL,
  supplier_payment_id uuid NOT NULL,
  supplier_invoice_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  amount_allocated numeric(15,2) NOT NULL CHECK (amount_allocated > 0),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  allocated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Reversed')),
  reversed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reversed_at timestamptz,
  reversal_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_spa_payment FOREIGN KEY (supplier_payment_id, company_id, project_id, supplier_account_id, currency) REFERENCES public.supplier_payments(id, company_id, project_id, supplier_account_id, currency) ON DELETE RESTRICT,
  CONSTRAINT fk_spa_invoice FOREIGN KEY (supplier_invoice_id, company_id, project_id, supplier_account_id, currency) REFERENCES public.supplier_invoices(id, company_id, project_id, supplier_account_id, currency) ON DELETE RESTRICT,
  CONSTRAINT uq_spa_comp_id UNIQUE (id, company_id)
);


-- 1.9 AUDIT LOG TABLE
CREATE TABLE public.supplier_accounts_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  reason text,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- 1.10 SUPPLIER ATTACHMENTS
CREATE TABLE public.supplier_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  entity_type text NOT NULL CHECK (entity_type IN ('supplier_account','supplier_invoice','supplier_credit_note','supplier_payment')),
  entity_id uuid NOT NULL,
  document_category text NOT NULL DEFAULT 'Other' CHECK (document_category IN ('Supplier Invoice','Credit Note','Proof of Payment','Supplier Statement','Bank Confirmation','Tax Document','Contract','Other')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint CHECK (file_size > 0),
  mime_type text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_supplier_attachment_comp UNIQUE (id, company_id),
  CONSTRAINT uq_supplier_attachment_path UNIQUE (company_id, file_path)
);


-- 1.11 EXTEND FINANCIAL COST POSTINGS WITH COST-SOURCE CONSTRAINTS
ALTER TABLE public.financial_cost_postings
  ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_credit_note_id uuid;

DO $$
DECLARE
  v_invalid text;
BEGIN
  SELECT string_agg(DISTINCT source_type, ', ' ORDER BY source_type)
  INTO v_invalid
  FROM public.financial_cost_postings
  WHERE source_type IS NOT NULL
    AND source_type NOT IN (
      'Supplier Invoice',
      'Supplier Credit Note',
      'Labour Payroll',
      'Direct Expense',
      'Overhead Allocation',
      'Adjustment'
    );

  IF v_invalid IS NOT NULL THEN
    RAISE EXCEPTION 'Prerequisite failed: financial_cost_postings contains unsupported source_type values: %', v_invalid;
  END IF;
END $$;

ALTER TABLE public.financial_cost_postings
  DROP CONSTRAINT IF EXISTS financial_cost_postings_source_type_check;

ALTER TABLE public.financial_cost_postings
  ADD CONSTRAINT financial_cost_postings_source_type_check CHECK (
    source_type IN (
      'Supplier Invoice',
      'Supplier Credit Note',
      'Labour Payroll',
      'Direct Expense',
      'Overhead Allocation',
      'Adjustment'
    )
  );

ALTER TABLE public.financial_cost_postings
  DROP CONSTRAINT IF EXISTS fk_fcp_supplier_invoice,
  DROP CONSTRAINT IF EXISTS fk_fcp_supplier_credit_note;

ALTER TABLE public.financial_cost_postings
  ADD CONSTRAINT fk_fcp_supplier_invoice FOREIGN KEY (
    supplier_invoice_id,
    company_id,
    project_id,
    commitment_id,
    currency_code
  ) REFERENCES public.supplier_invoices(
    id,
    company_id,
    project_id,
    financial_commitment_id,
    currency
  ) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_fcp_supplier_credit_note FOREIGN KEY (
    supplier_credit_note_id,
    company_id,
    project_id,
    commitment_id,
    currency_code
  ) REFERENCES public.supplier_credit_notes(
    id,
    company_id,
    project_id,
    financial_commitment_id,
    currency
  ) ON DELETE RESTRICT;

-- Check for incompatible deployed data after adding the linkage columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.financial_cost_postings
    WHERE source_type IN ('Supplier Invoice', 'Supplier Credit Note')
      AND (
        source_record_id IS NULL OR
        (source_type = 'Supplier Invoice' AND supplier_invoice_id IS NULL) OR
        (source_type = 'Supplier Credit Note' AND supplier_credit_note_id IS NULL)
      )
  ) THEN
    RAISE EXCEPTION 'Prerequisite failed: Incompatible deployed data exists (unlinked supplier costs in financial_cost_postings).';
  END IF;
END $$;

ALTER TABLE public.financial_cost_postings
  DROP CONSTRAINT IF EXISTS chk_fcp_supplier_invoice_link;

ALTER TABLE public.financial_cost_postings
  ADD CONSTRAINT chk_fcp_supplier_invoice_link CHECK (
    (entry_type = 'Cost' AND source_type = 'Supplier Invoice' AND supplier_invoice_id IS NOT NULL AND supplier_credit_note_id IS NULL AND source_record_id = supplier_invoice_id)
    OR
    (entry_type = 'Cost' AND source_type = 'Supplier Credit Note' AND supplier_credit_note_id IS NOT NULL AND supplier_invoice_id IS NULL AND source_record_id = supplier_credit_note_id)
    OR
    ((entry_type = 'Reversal' OR source_type NOT IN ('Supplier Invoice', 'Supplier Credit Note')) AND supplier_invoice_id IS NULL AND supplier_credit_note_id IS NULL)
  );

ALTER TABLE public.financial_cost_postings
  DROP CONSTRAINT IF EXISTS chk_cost_posting_entry_integrity;

ALTER TABLE public.financial_cost_postings
  ADD CONSTRAINT chk_cost_posting_entry_integrity CHECK (
    (entry_type = 'Cost' AND amount_excl_vat > 0 AND reversal_of_id IS NULL AND source_type <> 'Supplier Credit Note')
    OR
    (entry_type = 'Cost' AND amount_excl_vat < 0 AND reversal_of_id IS NULL AND source_type = 'Supplier Credit Note' AND supplier_credit_note_id IS NOT NULL AND source_record_id = supplier_credit_note_id)
    OR
    (entry_type = 'Reversal' AND amount_excl_vat < 0 AND reversal_of_id IS NOT NULL AND status = 'Posted')
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_fcp_supplier_invoice ON public.financial_cost_postings(supplier_invoice_id) WHERE supplier_invoice_id IS NOT NULL AND entry_type = 'Cost';
CREATE UNIQUE INDEX IF NOT EXISTS uq_fcp_supplier_credit_note ON public.financial_cost_postings(supplier_credit_note_id) WHERE supplier_credit_note_id IS NOT NULL AND entry_type = 'Cost';


-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_sa_company_id ON public.supplier_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_si_company_project ON public.supplier_invoices(company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_si_supplier ON public.supplier_invoices(supplier_account_id);
CREATE INDEX IF NOT EXISTS idx_si_commitment ON public.supplier_invoices(financial_commitment_id);
CREATE INDEX IF NOT EXISTS idx_sil_invoice ON public.supplier_invoice_lines(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_scn_invoice ON public.supplier_credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_scn_supplier ON public.supplier_credit_notes(supplier_account_id);
CREATE INDEX IF NOT EXISTS idx_scnl_cn ON public.supplier_credit_note_lines(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_sp_supplier ON public.supplier_payments(supplier_account_id);
CREATE INDEX IF NOT EXISTS idx_sp_bank_account ON public.supplier_payments(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_sp_cashbook_tx ON public.supplier_payments(cashbook_transaction_id);
CREATE INDEX IF NOT EXISTS idx_supplier_attachments_entity ON public.supplier_attachments(company_id, entity_type, entity_id) WHERE is_archived = false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sa_vat_number_active ON public.supplier_accounts(company_id, vat_number) WHERE vat_number IS NOT NULL AND btrim(vat_number) <> '' AND is_archived = false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sa_registration_active ON public.supplier_accounts(company_id, registration_number) WHERE registration_number IS NOT NULL AND btrim(registration_number) <> '' AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_spa_payment ON public.supplier_payment_allocations(supplier_payment_id);
CREATE INDEX IF NOT EXISTS idx_spa_invoice ON public.supplier_payment_allocations(supplier_invoice_id);


-- ----------------------------------------------------------------------------
-- SECTION 2: SECURITY & ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

-- Enable Row Level Security and FORCE RLS on all tables
ALTER TABLE public.supplier_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credit_notes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_credit_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credit_note_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_allocations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_accounts_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_accounts_audit_log FORCE ROW LEVEL SECURITY;

ALTER TABLE public.supplier_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_attachments FORCE ROW LEVEL SECURITY;


-- RLS Policies
DROP POLICY IF EXISTS rls_sa_select ON public.supplier_accounts;
CREATE POLICY rls_sa_select ON public.supplier_accounts FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_si_select ON public.supplier_invoices;
CREATE POLICY rls_si_select ON public.supplier_invoices FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_sil_select ON public.supplier_invoice_lines;
CREATE POLICY rls_sil_select ON public.supplier_invoice_lines FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_scn_select ON public.supplier_credit_notes;
CREATE POLICY rls_scn_select ON public.supplier_credit_notes FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_scnl_select ON public.supplier_credit_note_lines;
CREATE POLICY rls_scnl_select ON public.supplier_credit_note_lines FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_sp_select ON public.supplier_payments;
CREATE POLICY rls_sp_select ON public.supplier_payments FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_spa_select ON public.supplier_payment_allocations;
CREATE POLICY rls_spa_select ON public.supplier_payment_allocations FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_audit_select ON public.supplier_accounts_audit_log;
CREATE POLICY rls_audit_select ON public.supplier_accounts_audit_log FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_supplier_attachments_select ON public.supplier_attachments;
CREATE POLICY rls_supplier_attachments_select ON public.supplier_attachments FOR SELECT TO authenticated USING (public.has_finance_full_access(company_id));
DROP POLICY IF EXISTS rls_supplier_attachments_insert ON public.supplier_attachments;
CREATE POLICY rls_supplier_attachments_insert ON public.supplier_attachments FOR INSERT TO authenticated WITH CHECK (public.has_finance_full_access(company_id));
DROP POLICY IF EXISTS rls_supplier_attachments_update ON public.supplier_attachments;
CREATE POLICY rls_supplier_attachments_update ON public.supplier_attachments FOR UPDATE TO authenticated USING (public.has_finance_full_access(company_id)) WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY rls_sa_insert ON public.supplier_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY rls_sa_update ON public.supplier_accounts
  FOR UPDATE TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY rls_si_insert ON public.supplier_invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY rls_si_update ON public.supplier_invoices
  FOR UPDATE TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY rls_sil_insert ON public.supplier_invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY rls_sil_update ON public.supplier_invoice_lines
  FOR UPDATE TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY rls_scn_insert ON public.supplier_credit_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY rls_scn_update ON public.supplier_credit_notes
  FOR UPDATE TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY rls_scnl_insert ON public.supplier_credit_note_lines
  FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY rls_scnl_update ON public.supplier_credit_note_lines
  FOR UPDATE TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

CREATE POLICY rls_sp_insert ON public.supplier_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_full_access(company_id));
CREATE POLICY rls_sp_update ON public.supplier_payments
  FOR UPDATE TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));


-- REVOKE ALL PRIVILEGES ON ALL 8 TABLES
REVOKE ALL ON TABLE public.supplier_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.supplier_invoices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.supplier_invoice_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.supplier_credit_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.supplier_credit_note_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.supplier_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.supplier_payment_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.supplier_accounts_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.supplier_attachments FROM PUBLIC, anon, authenticated;


-- GRANT NARROWLY SCOPED TABLE PRIVILEGES TO AUTHENTICATED
-- SELECT on all tables
GRANT SELECT ON TABLE public.supplier_accounts TO authenticated;
GRANT SELECT ON TABLE public.supplier_invoices TO authenticated;
GRANT SELECT ON TABLE public.supplier_invoice_lines TO authenticated;
GRANT SELECT ON TABLE public.supplier_credit_notes TO authenticated;
GRANT SELECT ON TABLE public.supplier_credit_note_lines TO authenticated;
GRANT SELECT ON TABLE public.supplier_payments TO authenticated;
GRANT SELECT ON TABLE public.supplier_payment_allocations TO authenticated;
GRANT SELECT ON TABLE public.supplier_accounts_audit_log TO authenticated;
GRANT SELECT ON TABLE public.supplier_attachments TO authenticated;

-- Narrow column-level INSERT and UPDATE for operational tables
GRANT INSERT (company_id, supplier_code, legal_name, trading_name, registration_number, vat_number, contact_person, email, telephone, physical_address, payment_terms_days, default_currency, bank_details, notes) ON public.supplier_accounts TO authenticated;
GRANT UPDATE (supplier_code, legal_name, trading_name, registration_number, vat_number, contact_person, email, telephone, physical_address, payment_terms_days, bank_details, notes) ON public.supplier_accounts TO authenticated;

GRANT INSERT (company_id, project_id, supplier_account_id, financial_commitment_id, supplier_invoice_number, external_reference, invoice_date, due_date, billing_period_start, billing_period_end, notes, currency) ON public.supplier_invoices TO authenticated;
GRANT UPDATE (supplier_invoice_number, external_reference, invoice_date, due_date, billing_period_start, billing_period_end, notes) ON public.supplier_invoices TO authenticated;

GRANT INSERT (company_id, project_id, supplier_invoice_id, line_code, description, quantity, unit, unit_rate_excl_vat, vat_rate, cost_category, sort_order) ON public.supplier_invoice_lines TO authenticated;
GRANT UPDATE (line_code, description, quantity, unit, unit_rate_excl_vat, vat_rate, cost_category, sort_order) ON public.supplier_invoice_lines TO authenticated;

GRANT INSERT (company_id, project_id, supplier_account_id, invoice_id, financial_commitment_id, credit_note_number, external_reference, credit_note_date, reason, notes, currency) ON public.supplier_credit_notes TO authenticated;
GRANT UPDATE (credit_note_number, external_reference, credit_note_date, reason, notes) ON public.supplier_credit_notes TO authenticated;

GRANT INSERT (company_id, project_id, credit_note_id, invoice_line_id, line_code, description, quantity, unit, unit_rate_excl_vat, vat_rate, cost_category, sort_order) ON public.supplier_credit_note_lines TO authenticated;
GRANT UPDATE (line_code, description, quantity, unit, unit_rate_excl_vat, vat_rate, cost_category, sort_order) ON public.supplier_credit_note_lines TO authenticated;

GRANT INSERT (company_id, project_id, supplier_account_id, bank_account_id, payment_reference, external_reference, payment_date, payment_method, amount_paid, notes, currency) ON public.supplier_payments TO authenticated;
GRANT UPDATE (bank_account_id, payment_reference, external_reference, payment_date, payment_method, amount_paid, notes) ON public.supplier_payments TO authenticated;

GRANT INSERT (company_id, entity_type, entity_id, document_category, file_name, file_path, file_size, mime_type, uploaded_by) ON public.supplier_attachments TO authenticated;
GRANT UPDATE (document_category, file_name, file_path, file_size, mime_type, is_archived) ON public.supplier_attachments TO authenticated;

-- Replace the Phase 2B.1 metadata function so caller-supplied actors are never
-- accepted as a fallback on any financial table.
CREATE OR REPLACE FUNCTION public.fn_finance_metadata_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.created_by := auth.uid();
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();

    -- Use jsonb field access so this shared trigger remains safe on tables
    -- that do not contain project_id or another optional context column.
    IF to_jsonb(NEW)->'id' IS DISTINCT FROM to_jsonb(OLD)->'id' THEN
      RAISE EXCEPTION 'Field id is immutable.';
    END IF;
    IF to_jsonb(NEW)->'company_id' IS DISTINCT FROM to_jsonb(OLD)->'company_id' THEN
      RAISE EXCEPTION 'Field company_id is immutable.';
    END IF;
    IF (to_jsonb(NEW) ? 'project_id')
       AND to_jsonb(NEW)->'project_id' IS DISTINCT FROM to_jsonb(OLD)->'project_id' THEN
      RAISE EXCEPTION 'Field project_id is immutable.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- Version bump runs after the protection trigger because PostgreSQL orders
-- same-timing triggers alphabetically; the zz_ prefix is intentional.
CREATE OR REPLACE FUNCTION public.fn_supplier_bump_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- SECTION 3: AUDIT & PROTECTION TRIGGERS
-- ----------------------------------------------------------------------------

-- Audit event handler
CREATE OR REPLACE FUNCTION public.fn_audit_supplier_accounts_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_entity_id uuid;
  v_event_type text;
  v_reason text;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_company_id := NEW.company_id;
    v_entity_id := NEW.id;
    v_event_type := CASE
      WHEN TG_TABLE_NAME = 'supplier_payment_allocations' THEN 'ALLOCATE'
      ELSE 'CREATE'
    END;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW) - 'bank_details';
  ELSE
    v_company_id := NEW.company_id;
    v_entity_id := NEW.id;
    v_old_data := to_jsonb(OLD) - 'bank_details';
    v_new_data := to_jsonb(NEW) - 'bank_details';

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
      v_event_type := CASE WHEN NEW.is_archived THEN 'ARCHIVE' ELSE 'RESTORE' END;
    ELSIF TG_TABLE_NAME = 'supplier_accounts'
      AND (to_jsonb(NEW)->>'is_active')::boolean
          IS DISTINCT FROM
          (to_jsonb(OLD)->>'is_active')::boolean THEN
      v_event_type := CASE
        WHEN (to_jsonb(NEW)->>'is_active')::boolean THEN 'ACTIVATE'
        ELSE 'DEACTIVATE'
      END;
    ELSIF to_jsonb(NEW)->>'status' IS DISTINCT FROM to_jsonb(OLD)->>'status' THEN
      v_event_type := CASE to_jsonb(NEW)->>'status'
        WHEN 'Submitted' THEN 'SUBMIT'
        WHEN 'Approved' THEN 'APPROVE'
        WHEN 'Rejected' THEN 'REJECT'
        WHEN 'Posted' THEN 'POST'
        WHEN 'Cancelled' THEN 'CANCEL'
        WHEN 'Reversed' THEN 'REVERSE'
        ELSE 'UPDATE'
      END;
    ELSE
      v_event_type := 'UPDATE';
    END IF;

    v_reason := CASE v_event_type
      WHEN 'REJECT' THEN to_jsonb(NEW)->>'rejection_reason'
      WHEN 'CANCEL' THEN to_jsonb(NEW)->>'cancellation_reason'
      WHEN 'REVERSE' THEN to_jsonb(NEW)->>'reversal_reason'
      WHEN 'DEACTIVATE' THEN to_jsonb(NEW)->>'deactivation_reason'
      ELSE NULL
    END;
  END IF;

  INSERT INTO public.supplier_accounts_audit_log (
    company_id,
    entity_type,
    entity_id,
    event_type,
    reason,
    old_data,
    new_data,
    actor_id
  )
  VALUES (
    v_company_id,
    TG_TABLE_NAME,
    v_entity_id,
    v_event_type,
    v_reason,
    v_old_data,
    v_new_data,
    auth.uid()
  );

  RETURN NEW;
END;
$$;


-- Protection Trigger: supplier_accounts
CREATE OR REPLACE FUNCTION public.fn_protect_supplier_accounts_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_active := false;
    NEW.activated_by := NULL;
    NEW.activated_at := NULL;
    NEW.deactivated_by := NULL;
    NEW.deactivated_at := NULL;
    NEW.deactivation_reason := NULL;
    NEW.is_archived := false;
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'Supplier account identity is immutable.';
    END IF;

    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();

    IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
      RAISE EXCEPTION 'Archived supplier accounts are immutable.';
    END IF;

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
      IF NEW.supplier_code IS DISTINCT FROM OLD.supplier_code OR
         NEW.legal_name IS DISTINCT FROM OLD.legal_name OR
         NEW.trading_name IS DISTINCT FROM OLD.trading_name OR
         NEW.registration_number IS DISTINCT FROM OLD.registration_number OR
         NEW.vat_number IS DISTINCT FROM OLD.vat_number OR
         NEW.contact_person IS DISTINCT FROM OLD.contact_person OR
         NEW.email IS DISTINCT FROM OLD.email OR
         NEW.telephone IS DISTINCT FROM OLD.telephone OR
         NEW.physical_address IS DISTINCT FROM OLD.physical_address OR
         NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days OR
         NEW.default_currency IS DISTINCT FROM OLD.default_currency OR
         NEW.bank_details IS DISTINCT FROM OLD.bank_details OR
         NEW.notes IS DISTINCT FROM OLD.notes OR
         NEW.is_active IS DISTINCT FROM OLD.is_active OR
         NEW.activated_by IS DISTINCT FROM OLD.activated_by OR
         NEW.activated_at IS DISTINCT FROM OLD.activated_at OR
         NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by OR
         NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at OR
         NEW.deactivation_reason IS DISTINCT FROM OLD.deactivation_reason THEN
        RAISE EXCEPTION 'Simultaneous content edits are prohibited during supplier archiving or restoration.';
      END IF;
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
        RAISE EXCEPTION 'Supplier lifecycle and archive changes must be separate.';
      END IF;

      IF NEW.is_active THEN
        IF NEW.activated_by IS DISTINCT FROM auth.uid()
           OR NEW.activated_at IS NULL
           OR NEW.activated_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Supplier activation actor and timestamp must be server generated.';
        END IF;
        IF NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
           OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
           OR NEW.deactivation_reason IS DISTINCT FROM OLD.deactivation_reason THEN
          RAISE EXCEPTION 'Unrelated deactivation metadata must be preserved during activation.';
        END IF;
      ELSE
        IF NEW.deactivated_by IS DISTINCT FROM auth.uid()
           OR NEW.deactivated_at IS NULL
           OR NEW.deactivated_at IS DISTINCT FROM now()
           OR NULLIF(btrim(NEW.deactivation_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Supplier deactivation requires a server actor, timestamp and nonblank reason.';
        END IF;
        IF NEW.activated_by IS DISTINCT FROM OLD.activated_by
           OR NEW.activated_at IS DISTINCT FROM OLD.activated_at THEN
          RAISE EXCEPTION 'Activation metadata must be preserved during deactivation.';
        END IF;
      END IF;
    ELSE
      IF NEW.activated_by IS DISTINCT FROM OLD.activated_by
         OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
         OR NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by
         OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
         OR NEW.deactivation_reason IS DISTINCT FROM OLD.deactivation_reason THEN
        RAISE EXCEPTION 'Supplier lifecycle metadata is immutable when active state is unchanged.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_supplier_accounts ON public.supplier_accounts;
CREATE TRIGGER trg_protect_supplier_accounts
  BEFORE INSERT OR UPDATE ON public.supplier_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_supplier_accounts_header();

DROP TRIGGER IF EXISTS zz_trg_supplier_accounts_version ON public.supplier_accounts;
CREATE TRIGGER zz_trg_supplier_accounts_version
  BEFORE UPDATE ON public.supplier_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_bump_version();

DROP TRIGGER IF EXISTS trg_audit_supplier_accounts ON public.supplier_accounts;
CREATE TRIGGER trg_audit_supplier_accounts
  AFTER INSERT OR UPDATE ON public.supplier_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_supplier_accounts_event();


-- Protection Trigger: supplier_invoices
CREATE OR REPLACE FUNCTION public.fn_protect_supplier_invoices_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_supp public.supplier_accounts%ROWTYPE;
  v_comm public.financial_commitments%ROWTYPE;
  v_transition_old jsonb;
  v_transition_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_supp
    FROM public.supplier_accounts
    WHERE id = NEW.supplier_account_id
    FOR SHARE;
    IF NOT FOUND
       OR v_supp.company_id <> NEW.company_id
       OR v_supp.default_currency <> NEW.currency
       OR v_supp.is_active IS NOT TRUE
       OR v_supp.is_archived IS TRUE THEN
      RAISE EXCEPTION 'Invoice supplier must be active, non-archived and match company and currency.';
    END IF;

    SELECT * INTO v_comm
    FROM public.financial_commitments
    WHERE id = NEW.financial_commitment_id
    FOR SHARE;
    IF NOT FOUND
       OR v_comm.status <> 'Approved'
       OR v_comm.is_archived IS TRUE
       OR v_comm.company_id <> NEW.company_id
       OR v_comm.project_id <> NEW.project_id
       OR v_comm.supplier_account_id IS DISTINCT FROM NEW.supplier_account_id
       OR v_comm.currency_code <> NEW.currency THEN
      RAISE EXCEPTION 'Invoice commitment must be Approved, non-archived and match the exact invoice context.';
    END IF;

    NEW.status := 'Draft';
    NEW.is_archived := false;
    NEW.subtotal_excl_vat := 0.00;
    NEW.vat_amount := 0.00;
    NEW.total_incl_vat := 0.00;
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();

    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    NEW.rejected_by := NULL; NEW.rejected_at := NULL; NEW.rejection_reason := NULL;
    NEW.posted_by := NULL; NEW.posted_at := NULL;
    NEW.cancelled_by := NULL; NEW.cancelled_at := NULL; NEW.cancellation_reason := NULL;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.supplier_account_id IS DISTINCT FROM OLD.supplier_account_id
       OR NEW.financial_commitment_id IS DISTINCT FROM OLD.financial_commitment_id
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Supplier invoice identity and relationship context is immutable.';
    END IF;

    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();

    IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
      RAISE EXCEPTION 'Archived supplier invoices are immutable.';
    END IF;

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
      IF OLD.status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Invoice cannot be archived or restored in status %.', OLD.status;
      END IF;

      IF (to_jsonb(NEW) - ARRAY['is_archived', 'updated_by', 'updated_at']::text[])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['is_archived', 'updated_by', 'updated_at']::text[]) THEN
        RAISE EXCEPTION 'Simultaneous field edits are prohibited during invoice archiving or restoration.';
      END IF;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
        RAISE EXCEPTION 'Invoice workflow and archive transitions must be separate.';
      END IF;

      IF NOT (
        (OLD.status = 'Draft' AND NEW.status IN ('Submitted', 'Cancelled')) OR
        (OLD.status = 'Submitted' AND NEW.status IN ('Approved', 'Rejected', 'Cancelled')) OR
        (OLD.status = 'Approved' AND NEW.status IN ('Posted', 'Cancelled'))
      ) THEN
        RAISE EXCEPTION 'Invalid invoice status transition from % to %.', OLD.status, NEW.status;
      END IF;

      v_transition_old := to_jsonb(OLD) - ARRAY[
        'status',
        'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
        'rejected_by', 'rejected_at', 'rejection_reason',
        'posted_by', 'posted_at',
        'cancelled_by', 'cancelled_at', 'cancellation_reason',
        'updated_by', 'updated_at'
      ]::text[];
      v_transition_new := to_jsonb(NEW) - ARRAY[
        'status',
        'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
        'rejected_by', 'rejected_at', 'rejection_reason',
        'posted_by', 'posted_at',
        'cancelled_by', 'cancelled_at', 'cancellation_reason',
        'updated_by', 'updated_at'
      ]::text[];
      IF v_transition_new IS DISTINCT FROM v_transition_old THEN
        RAISE EXCEPTION 'Ordinary invoice fields cannot change during a workflow transition.';
      END IF;

      IF NEW.status = 'Submitted' THEN
        IF NEW.submitted_by IS DISTINCT FROM auth.uid()
           OR NEW.submitted_at IS NULL
           OR NEW.submitted_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Invoice submission actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Approved' THEN
        IF NEW.approved_by IS DISTINCT FROM auth.uid()
           OR NEW.approved_at IS NULL
           OR NEW.approved_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Invoice approval actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Rejected' THEN
        IF NEW.rejected_by IS DISTINCT FROM auth.uid()
           OR NEW.rejected_at IS NULL
           OR NEW.rejected_at IS DISTINCT FROM now()
           OR NULLIF(btrim(NEW.rejection_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Invoice rejection requires a server actor, timestamp and nonblank reason.';
        END IF;
      ELSIF NEW.status = 'Posted' THEN
        IF NEW.posted_by IS DISTINCT FROM auth.uid()
           OR NEW.posted_at IS NULL
           OR NEW.posted_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Invoice posting actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Cancelled' THEN
        IF NEW.cancelled_by IS DISTINCT FROM auth.uid()
           OR NEW.cancelled_at IS NULL
           OR NEW.cancelled_at IS DISTINCT FROM now()
           OR NULLIF(btrim(NEW.cancellation_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Invoice cancellation requires a server actor, timestamp and nonblank reason.';
        END IF;
      END IF;
    ELSE
      IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
         OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
         OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
         OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
         OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
         OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
         OR NEW.posted_by IS DISTINCT FROM OLD.posted_by
         OR NEW.posted_at IS DISTINCT FROM OLD.posted_at
         OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
         OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
         OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
        RAISE EXCEPTION 'Invoice workflow metadata is immutable when status is unchanged.';
      END IF;

      IF OLD.status <> 'Draft'
         AND NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived
         AND (to_jsonb(NEW) - ARRAY['updated_by', 'updated_at']::text[])
             IS DISTINCT FROM
             (to_jsonb(OLD) - ARRAY['updated_by', 'updated_at']::text[]) THEN
        RAISE EXCEPTION 'Editing non-draft invoice is prohibited.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_supplier_invoices ON public.supplier_invoices;
CREATE TRIGGER trg_protect_supplier_invoices
  BEFORE INSERT OR UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_supplier_invoices_header();

DROP TRIGGER IF EXISTS zz_trg_supplier_invoices_version ON public.supplier_invoices;
CREATE TRIGGER zz_trg_supplier_invoices_version
  BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_bump_version();

DROP TRIGGER IF EXISTS trg_audit_supplier_invoices ON public.supplier_invoices;
CREATE TRIGGER trg_audit_supplier_invoices
  AFTER INSERT OR UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_supplier_accounts_event();


-- Protection Trigger: supplier_invoice_lines
CREATE OR REPLACE FUNCTION public.fn_sil_before_calc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv_status text;
  v_inv_archived boolean;
  v_company_id uuid;
  v_project_id uuid;
  v_supplier_account_id uuid;
  v_financial_commitment_id uuid;
  v_currency text;
BEGIN
  SELECT
    status,
    is_archived,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  INTO
    v_inv_status,
    v_inv_archived,
    v_company_id,
    v_project_id,
    v_supplier_account_id,
    v_financial_commitment_id,
    v_currency
  FROM public.supplier_invoices
  WHERE id = COALESCE(NEW.supplier_invoice_id, OLD.supplier_invoice_id)
  FOR SHARE;

  IF NOT FOUND OR v_inv_status <> 'Draft' OR v_inv_archived IS TRUE THEN
    RAISE EXCEPTION 'Invoice lines can only be modified under a Draft, non-archived invoice.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.company_id <> v_company_id OR NEW.project_id <> v_project_id THEN
      RAISE EXCEPTION 'Invoice line company and project must match its parent invoice.';
    END IF;
    NEW.supplier_account_id := v_supplier_account_id;
    NEW.financial_commitment_id := v_financial_commitment_id;
    NEW.currency := v_currency;
    NEW.is_archived := false;
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.supplier_invoice_id IS DISTINCT FROM OLD.supplier_invoice_id
       OR NEW.supplier_account_id IS DISTINCT FROM OLD.supplier_account_id
       OR NEW.financial_commitment_id IS DISTINCT FROM OLD.financial_commitment_id
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Supplier invoice line identity and relationship context is immutable.';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;

  NEW.amount_excl_vat := round(NEW.quantity * NEW.unit_rate_excl_vat, 2);
  NEW.vat_amount := round(NEW.amount_excl_vat * (NEW.vat_rate / 100.00), 2);
  NEW.amount_incl_vat := NEW.amount_excl_vat + NEW.vat_amount;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sil_before_calc ON public.supplier_invoice_lines;
CREATE TRIGGER trg_sil_before_calc
  BEFORE INSERT OR UPDATE ON public.supplier_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_sil_before_calc();

DROP TRIGGER IF EXISTS zz_trg_supplier_invoice_lines_version ON public.supplier_invoice_lines;
CREATE TRIGGER zz_trg_supplier_invoice_lines_version
  BEFORE UPDATE ON public.supplier_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_bump_version();

DROP TRIGGER IF EXISTS trg_audit_supplier_invoice_lines ON public.supplier_invoice_lines;
CREATE TRIGGER trg_audit_supplier_invoice_lines
  AFTER INSERT OR UPDATE ON public.supplier_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_supplier_accounts_event();

-- Line total reconciliation trigger for supplier_invoices
CREATE OR REPLACE FUNCTION public.fn_sil_after_reconcile()
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
  v_inv_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.supplier_invoice_id ELSE NEW.supplier_invoice_id END;

  SELECT
    COALESCE(SUM(amount_excl_vat), 0.00),
    COALESCE(SUM(vat_amount), 0.00),
    COALESCE(SUM(amount_incl_vat), 0.00)
  INTO v_subtotal, v_vat, v_total
  FROM public.supplier_invoice_lines
  WHERE supplier_invoice_id = v_inv_id AND is_archived = false;

  UPDATE public.supplier_invoices
  SET subtotal_excl_vat = v_subtotal,
      vat_amount = v_vat,
      total_incl_vat = v_total,
      updated_at = now()
  WHERE id = v_inv_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sil_after_reconcile ON public.supplier_invoice_lines;
CREATE TRIGGER trg_sil_after_reconcile
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_sil_after_reconcile();


-- Protection Trigger: supplier_credit_notes
CREATE OR REPLACE FUNCTION public.fn_protect_supplier_credit_notes_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_supp public.supplier_accounts%ROWTYPE;
  v_comm public.financial_commitments%ROWTYPE;
  v_inv public.supplier_invoices%ROWTYPE;
  v_transition_old jsonb;
  v_transition_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_supp
    FROM public.supplier_accounts
    WHERE id = NEW.supplier_account_id
    FOR SHARE;
    IF NOT FOUND
       OR v_supp.company_id <> NEW.company_id
       OR v_supp.default_currency <> NEW.currency
       OR v_supp.is_active IS NOT TRUE
       OR v_supp.is_archived IS TRUE THEN
      RAISE EXCEPTION 'Credit note supplier must be active, non-archived and match company and currency.';
    END IF;

    SELECT * INTO v_comm
    FROM public.financial_commitments
    WHERE id = NEW.financial_commitment_id
    FOR SHARE;
    IF NOT FOUND
       OR v_comm.status <> 'Approved'
       OR v_comm.is_archived IS TRUE
       OR v_comm.company_id <> NEW.company_id
       OR v_comm.project_id <> NEW.project_id
       OR v_comm.supplier_account_id IS DISTINCT FROM NEW.supplier_account_id
       OR v_comm.currency_code <> NEW.currency THEN
      RAISE EXCEPTION 'Credit note commitment must be Approved, non-archived and match the exact credit-note context.';
    END IF;

    SELECT * INTO v_inv
    FROM public.supplier_invoices
    WHERE id = NEW.invoice_id
    FOR SHARE;
    IF NOT FOUND
       OR v_inv.status <> 'Posted'
       OR v_inv.is_archived IS TRUE
       OR v_inv.company_id <> NEW.company_id
       OR v_inv.project_id <> NEW.project_id
       OR v_inv.supplier_account_id <> NEW.supplier_account_id
       OR v_inv.currency <> NEW.currency
       OR v_inv.financial_commitment_id IS DISTINCT FROM NEW.financial_commitment_id THEN
      RAISE EXCEPTION 'Credit note parent invoice must be Posted, non-archived and match the exact context and commitment.';
    END IF;

    NEW.status := 'Draft';
    NEW.is_archived := false;
    NEW.subtotal_excl_vat := 0.00;
    NEW.vat_amount := 0.00;
    NEW.total_incl_vat := 0.00;
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();

    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    NEW.rejected_by := NULL; NEW.rejected_at := NULL; NEW.rejection_reason := NULL;
    NEW.posted_by := NULL; NEW.posted_at := NULL;
    NEW.cancelled_by := NULL; NEW.cancelled_at := NULL; NEW.cancellation_reason := NULL;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.supplier_account_id IS DISTINCT FROM OLD.supplier_account_id
       OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
       OR NEW.financial_commitment_id IS DISTINCT FROM OLD.financial_commitment_id
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Supplier credit-note identity and relationship context is immutable.';
    END IF;

    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();

    IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
      RAISE EXCEPTION 'Archived supplier credit notes are immutable.';
    END IF;

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
      IF OLD.status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Credit note cannot be archived or restored in status %.', OLD.status;
      END IF;
      IF (to_jsonb(NEW) - ARRAY['is_archived', 'updated_by', 'updated_at']::text[])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['is_archived', 'updated_by', 'updated_at']::text[]) THEN
        RAISE EXCEPTION 'Simultaneous field edits are prohibited during credit-note archiving or restoration.';
      END IF;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
        RAISE EXCEPTION 'Credit-note workflow and archive transitions must be separate.';
      END IF;
      IF NOT (
        (OLD.status = 'Draft' AND NEW.status IN ('Submitted', 'Cancelled')) OR
        (OLD.status = 'Submitted' AND NEW.status IN ('Approved', 'Rejected', 'Cancelled')) OR
        (OLD.status = 'Approved' AND NEW.status IN ('Posted', 'Cancelled'))
      ) THEN
        RAISE EXCEPTION 'Invalid credit note status transition from % to %.', OLD.status, NEW.status;
      END IF;

      v_transition_old := to_jsonb(OLD) - ARRAY[
        'status',
        'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
        'rejected_by', 'rejected_at', 'rejection_reason',
        'posted_by', 'posted_at',
        'cancelled_by', 'cancelled_at', 'cancellation_reason',
        'updated_by', 'updated_at'
      ]::text[];
      v_transition_new := to_jsonb(NEW) - ARRAY[
        'status',
        'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
        'rejected_by', 'rejected_at', 'rejection_reason',
        'posted_by', 'posted_at',
        'cancelled_by', 'cancelled_at', 'cancellation_reason',
        'updated_by', 'updated_at'
      ]::text[];
      IF v_transition_new IS DISTINCT FROM v_transition_old THEN
        RAISE EXCEPTION 'Ordinary credit-note fields cannot change during a workflow transition.';
      END IF;

      IF NEW.status = 'Submitted' THEN
        IF NEW.submitted_by IS DISTINCT FROM auth.uid()
           OR NEW.submitted_at IS NULL
           OR NEW.submitted_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Credit-note submission actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Approved' THEN
        IF NEW.approved_by IS DISTINCT FROM auth.uid()
           OR NEW.approved_at IS NULL
           OR NEW.approved_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Credit-note approval actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Rejected' THEN
        IF NEW.rejected_by IS DISTINCT FROM auth.uid()
           OR NEW.rejected_at IS NULL
           OR NEW.rejected_at IS DISTINCT FROM now()
           OR NULLIF(btrim(NEW.rejection_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Credit-note rejection requires a server actor, timestamp and nonblank reason.';
        END IF;
      ELSIF NEW.status = 'Posted' THEN
        IF NEW.posted_by IS DISTINCT FROM auth.uid()
           OR NEW.posted_at IS NULL
           OR NEW.posted_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Credit-note posting actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Cancelled' THEN
        IF NEW.cancelled_by IS DISTINCT FROM auth.uid()
           OR NEW.cancelled_at IS NULL
           OR NEW.cancelled_at IS DISTINCT FROM now()
           OR NULLIF(btrim(NEW.cancellation_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Credit-note cancellation requires a server actor, timestamp and nonblank reason.';
        END IF;
      END IF;
    ELSE
      IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
         OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
         OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
         OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
         OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
         OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
         OR NEW.posted_by IS DISTINCT FROM OLD.posted_by
         OR NEW.posted_at IS DISTINCT FROM OLD.posted_at
         OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
         OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
         OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
        RAISE EXCEPTION 'Credit-note workflow metadata is immutable when status is unchanged.';
      END IF;

      IF OLD.status <> 'Draft'
         AND NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived
         AND (to_jsonb(NEW) - ARRAY['updated_by', 'updated_at']::text[])
             IS DISTINCT FROM
             (to_jsonb(OLD) - ARRAY['updated_by', 'updated_at']::text[]) THEN
        RAISE EXCEPTION 'Editing non-draft credit note is prohibited.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_supplier_credit_notes ON public.supplier_credit_notes;
CREATE TRIGGER trg_protect_supplier_credit_notes
  BEFORE INSERT OR UPDATE ON public.supplier_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_supplier_credit_notes_header();

DROP TRIGGER IF EXISTS zz_trg_supplier_credit_notes_version ON public.supplier_credit_notes;
CREATE TRIGGER zz_trg_supplier_credit_notes_version
  BEFORE UPDATE ON public.supplier_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_bump_version();

DROP TRIGGER IF EXISTS trg_audit_supplier_credit_notes ON public.supplier_credit_notes;
CREATE TRIGGER trg_audit_supplier_credit_notes
  AFTER INSERT OR UPDATE ON public.supplier_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_supplier_accounts_event();


-- Protection Trigger: supplier_credit_note_lines
CREATE OR REPLACE FUNCTION public.fn_scnl_before_calc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cn_status text;
  v_cn_archived boolean;
  v_company_id uuid;
  v_project_id uuid;
  v_supplier_account_id uuid;
  v_financial_commitment_id uuid;
  v_currency text;
BEGIN
  SELECT
    status,
    is_archived,
    company_id,
    project_id,
    supplier_account_id,
    financial_commitment_id,
    currency
  INTO
    v_cn_status,
    v_cn_archived,
    v_company_id,
    v_project_id,
    v_supplier_account_id,
    v_financial_commitment_id,
    v_currency
  FROM public.supplier_credit_notes
  WHERE id = COALESCE(NEW.credit_note_id, OLD.credit_note_id)
  FOR SHARE;

  IF NOT FOUND OR v_cn_status <> 'Draft' OR v_cn_archived IS TRUE THEN
    RAISE EXCEPTION 'Credit note lines can only be modified under a Draft, non-archived credit note.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.company_id <> v_company_id OR NEW.project_id <> v_project_id THEN
      RAISE EXCEPTION 'Credit-note line company and project must match its parent credit note.';
    END IF;
    NEW.supplier_account_id := v_supplier_account_id;
    NEW.financial_commitment_id := v_financial_commitment_id;
    NEW.currency := v_currency;
    NEW.is_archived := false;
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.credit_note_id IS DISTINCT FROM OLD.credit_note_id
       OR NEW.invoice_line_id IS DISTINCT FROM OLD.invoice_line_id
       OR NEW.supplier_account_id IS DISTINCT FROM OLD.supplier_account_id
       OR NEW.financial_commitment_id IS DISTINCT FROM OLD.financial_commitment_id
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Supplier credit-note line identity and relationship context is immutable.';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;

  NEW.amount_excl_vat := round(NEW.quantity * NEW.unit_rate_excl_vat, 2);
  NEW.vat_amount := round(NEW.amount_excl_vat * (NEW.vat_rate / 100.00), 2);
  NEW.amount_incl_vat := NEW.amount_excl_vat + NEW.vat_amount;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scnl_before_calc ON public.supplier_credit_note_lines;
CREATE TRIGGER trg_scnl_before_calc
  BEFORE INSERT OR UPDATE ON public.supplier_credit_note_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_scnl_before_calc();

DROP TRIGGER IF EXISTS zz_trg_supplier_credit_note_lines_version ON public.supplier_credit_note_lines;
CREATE TRIGGER zz_trg_supplier_credit_note_lines_version
  BEFORE UPDATE ON public.supplier_credit_note_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_bump_version();

DROP TRIGGER IF EXISTS trg_audit_supplier_credit_note_lines ON public.supplier_credit_note_lines;
CREATE TRIGGER trg_audit_supplier_credit_note_lines
  AFTER INSERT OR UPDATE ON public.supplier_credit_note_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_supplier_accounts_event();

-- Line total reconciliation trigger for supplier_credit_notes
CREATE OR REPLACE FUNCTION public.fn_scnl_after_reconcile()
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
  FROM public.supplier_credit_note_lines
  WHERE credit_note_id = v_cn_id AND is_archived = false;

  UPDATE public.supplier_credit_notes
  SET subtotal_excl_vat = v_subtotal,
      vat_amount = v_vat,
      total_incl_vat = v_total,
      updated_at = now()
  WHERE id = v_cn_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_scnl_after_reconcile ON public.supplier_credit_note_lines;
CREATE TRIGGER trg_scnl_after_reconcile
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_credit_note_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_scnl_after_reconcile();


-- Protection Trigger: supplier_payments
CREATE OR REPLACE FUNCTION public.fn_protect_supplier_payments_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_supp public.supplier_accounts%ROWTYPE;
  v_transition_old jsonb;
  v_transition_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_supp
    FROM public.supplier_accounts
    WHERE id = NEW.supplier_account_id
    FOR SHARE;
    PERFORM 1
    FROM public.bank_accounts ba
    WHERE ba.id = NEW.bank_account_id
      AND ba.company_id = NEW.company_id
      AND ba.currency = NEW.currency
      AND ba.is_active = true
      AND ba.is_archived = false
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment bank account must be active, non-archived and match company and currency.';
    END IF;
    IF NOT FOUND
       OR v_supp.company_id <> NEW.company_id
       OR v_supp.default_currency <> NEW.currency
       OR v_supp.is_active IS NOT TRUE
       OR v_supp.is_archived IS TRUE THEN
      RAISE EXCEPTION 'Payment supplier must be active, non-archived and match company and currency.';
    END IF;

    NEW.status := 'Draft';
    NEW.is_archived := false;
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();

    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    NEW.rejected_by := NULL; NEW.rejected_at := NULL; NEW.rejection_reason := NULL;
    NEW.posted_by := NULL; NEW.posted_at := NULL;
    NEW.cancelled_by := NULL; NEW.cancelled_at := NULL; NEW.cancellation_reason := NULL;
    NEW.reversed_by := NULL; NEW.reversed_at := NULL; NEW.reversal_reason := NULL;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.supplier_account_id IS DISTINCT FROM OLD.supplier_account_id
       OR NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Supplier payment identity and relationship context is immutable.';
    END IF;

    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();

    IF OLD.is_archived IS TRUE AND NEW.is_archived IS TRUE THEN
      RAISE EXCEPTION 'Archived supplier payments are immutable.';
    END IF;

    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
      IF OLD.status NOT IN ('Draft', 'Rejected', 'Cancelled', 'Posted', 'Reversed') THEN
        RAISE EXCEPTION 'Payment cannot be archived or restored in status %.', OLD.status;
      END IF;
      IF (to_jsonb(NEW) - ARRAY['is_archived', 'updated_by', 'updated_at']::text[])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['is_archived', 'updated_by', 'updated_at']::text[]) THEN
        RAISE EXCEPTION 'Simultaneous field edits are prohibited during payment archiving or restoration.';
      END IF;
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
        RAISE EXCEPTION 'Payment workflow and archive transitions must be separate.';
      END IF;
      IF NOT (
        (OLD.status = 'Draft' AND NEW.status IN ('Submitted', 'Cancelled')) OR
        (OLD.status = 'Submitted' AND NEW.status IN ('Approved', 'Rejected', 'Cancelled')) OR
        (OLD.status = 'Approved' AND NEW.status IN ('Posted', 'Cancelled')) OR
        (OLD.status = 'Posted' AND NEW.status = 'Reversed')
      ) THEN
        RAISE EXCEPTION 'Invalid payment status transition from % to %.', OLD.status, NEW.status;
      END IF;

      v_transition_old := to_jsonb(OLD) - ARRAY[
        'status',
        'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
        'rejected_by', 'rejected_at', 'rejection_reason',
        'posted_by', 'posted_at',
        'cancelled_by', 'cancelled_at', 'cancellation_reason',
        'reversed_by', 'reversed_at', 'reversal_reason',
        'cashbook_transaction_id', 'cashbook_reversal_transaction_id',
        'updated_by', 'updated_at'
      ]::text[];
      v_transition_new := to_jsonb(NEW) - ARRAY[
        'status',
        'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
        'rejected_by', 'rejected_at', 'rejection_reason',
        'posted_by', 'posted_at',
        'cancelled_by', 'cancelled_at', 'cancellation_reason',
        'reversed_by', 'reversed_at', 'reversal_reason',
        'cashbook_transaction_id', 'cashbook_reversal_transaction_id',
        'updated_by', 'updated_at'
      ]::text[];
      IF v_transition_new IS DISTINCT FROM v_transition_old THEN
        RAISE EXCEPTION 'Ordinary payment fields cannot change during a workflow transition.';
      END IF;

      IF NEW.status = 'Submitted' THEN
        IF NEW.submitted_by IS DISTINCT FROM auth.uid()
           OR NEW.submitted_at IS NULL
           OR NEW.submitted_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Payment submission actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Approved' THEN
        IF NEW.approved_by IS DISTINCT FROM auth.uid()
           OR NEW.approved_at IS NULL
           OR NEW.approved_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Payment approval actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Rejected' THEN
        IF NEW.rejected_by IS DISTINCT FROM auth.uid()
           OR NEW.rejected_at IS NULL
           OR NEW.rejected_at IS DISTINCT FROM now()
           OR NULLIF(btrim(NEW.rejection_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Payment rejection requires a server actor, timestamp and nonblank reason.';
        END IF;
      ELSIF NEW.status = 'Posted' THEN
        IF NEW.posted_by IS DISTINCT FROM auth.uid()
           OR NEW.posted_at IS NULL
           OR NEW.posted_at IS DISTINCT FROM now() THEN
          RAISE EXCEPTION 'Payment posting actor and timestamp must be server generated.';
        END IF;
      ELSIF NEW.status = 'Cancelled' THEN
        IF NEW.cancelled_by IS DISTINCT FROM auth.uid()
           OR NEW.cancelled_at IS NULL
           OR NEW.cancelled_at IS DISTINCT FROM now()
           OR NULLIF(btrim(NEW.cancellation_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Payment cancellation requires a server actor, timestamp and nonblank reason.';
        END IF;
      ELSIF NEW.status = 'Reversed' THEN
        IF NEW.reversed_by IS DISTINCT FROM auth.uid()
           OR NEW.reversed_at IS NULL
           OR NEW.reversed_at IS DISTINCT FROM now()
           OR NULLIF(btrim(NEW.reversal_reason), '') IS NULL THEN
          RAISE EXCEPTION 'Payment reversal requires a server actor, timestamp and nonblank reason.';
        END IF;
      END IF;
    ELSE
      IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
         OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
         OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
         OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
         OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
         OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
         OR NEW.posted_by IS DISTINCT FROM OLD.posted_by
         OR NEW.posted_at IS DISTINCT FROM OLD.posted_at
         OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
         OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
         OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
         OR NEW.reversed_by IS DISTINCT FROM OLD.reversed_by
         OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at
         OR NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason
         OR NEW.cashbook_transaction_id IS DISTINCT FROM OLD.cashbook_transaction_id
         OR NEW.cashbook_reversal_transaction_id IS DISTINCT FROM OLD.cashbook_reversal_transaction_id THEN
        RAISE EXCEPTION 'Payment workflow and Cashbook linkage metadata is immutable when status is unchanged.';
      END IF;

      IF OLD.status <> 'Draft'
         AND NEW.is_archived IS NOT DISTINCT FROM OLD.is_archived
         AND (to_jsonb(NEW) - ARRAY['updated_by', 'updated_at']::text[])
             IS DISTINCT FROM
             (to_jsonb(OLD) - ARRAY['updated_by', 'updated_at']::text[]) THEN
        RAISE EXCEPTION 'Editing non-draft payment is prohibited.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_supplier_payments ON public.supplier_payments;
CREATE TRIGGER trg_protect_supplier_payments
  BEFORE INSERT OR UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_supplier_payments_header();

DROP TRIGGER IF EXISTS zz_trg_supplier_payments_version ON public.supplier_payments;
CREATE TRIGGER zz_trg_supplier_payments_version
  BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_bump_version();

DROP TRIGGER IF EXISTS trg_audit_supplier_payments ON public.supplier_payments;
CREATE TRIGGER trg_audit_supplier_payments
  AFTER INSERT OR UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_supplier_accounts_event();


-- Protection Trigger: supplier_payment_allocations
CREATE OR REPLACE FUNCTION public.fn_protect_supplier_payment_allocations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'Active';
    NEW.is_archived := false;
    NEW.allocated_by := auth.uid();
    NEW.allocated_at := now();
    NEW.reversed_by := NULL;
    NEW.reversed_at := NULL;
    NEW.reversal_reason := NULL;
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();

    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.supplier_payment_id IS DISTINCT FROM OLD.supplier_payment_id OR
       NEW.supplier_invoice_id IS DISTINCT FROM OLD.supplier_invoice_id OR
       NEW.company_id IS DISTINCT FROM OLD.company_id OR
       NEW.project_id IS DISTINCT FROM OLD.project_id OR
       NEW.supplier_account_id IS DISTINCT FROM OLD.supplier_account_id OR
       NEW.currency IS DISTINCT FROM OLD.currency OR
       NEW.amount_allocated IS DISTINCT FROM OLD.amount_allocated OR
       NEW.allocated_by IS DISTINCT FROM OLD.allocated_by OR
       NEW.allocated_at IS DISTINCT FROM OLD.allocated_at OR
       NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
      RAISE EXCEPTION 'Allocation context is immutable.';
    END IF;

    IF OLD.status = 'Reversed' THEN
      RAISE EXCEPTION 'Reversed allocations are immutable.';
    END IF;

    IF OLD.status <> 'Active' OR NEW.status <> 'Reversed' THEN
      RAISE EXCEPTION 'Only Active to Reversed allocation transitions are permitted.';
    END IF;

    IF NEW.reversed_by IS DISTINCT FROM auth.uid()
       OR NEW.reversed_at IS NULL
       OR NEW.reversed_at IS DISTINCT FROM now()
       OR NULLIF(btrim(NEW.reversal_reason), '') IS NULL THEN
      RAISE EXCEPTION 'Allocation reversal requires a server actor, timestamp and nonblank reason.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_supplier_payment_allocations ON public.supplier_payment_allocations;
CREATE TRIGGER trg_protect_supplier_payment_allocations
  BEFORE INSERT OR UPDATE ON public.supplier_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_supplier_payment_allocations();

DROP TRIGGER IF EXISTS zz_trg_supplier_payment_allocations_version ON public.supplier_payment_allocations;
CREATE TRIGGER zz_trg_supplier_payment_allocations_version
  BEFORE UPDATE ON public.supplier_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_bump_version();

DROP TRIGGER IF EXISTS trg_audit_supplier_payment_allocations ON public.supplier_payment_allocations;
CREATE TRIGGER trg_audit_supplier_payment_allocations
  AFTER INSERT OR UPDATE ON public.supplier_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_supplier_accounts_event();

-- Protect the one-time Supplier Account association on Phase 2B.1 commitments.
CREATE OR REPLACE FUNCTION public.fn_protect_commitment_supplier_association()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.supplier_account_id := NULL;
    NEW.supplier_associated_by := NULL;
    NEW.supplier_associated_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.supplier_account_id IS DISTINCT FROM OLD.supplier_account_id THEN
    IF OLD.supplier_account_id IS NOT NULL
       OR NEW.supplier_account_id IS NULL
       OR OLD.status <> 'Draft'
       OR OLD.is_archived IS TRUE THEN
      RAISE EXCEPTION 'A supplier may be associated exactly once while the commitment is Draft and non-archived.';
    END IF;

    IF NEW.supplier_associated_by IS DISTINCT FROM auth.uid()
       OR NEW.supplier_associated_at IS NULL
       OR NEW.supplier_associated_at IS DISTINCT FROM now() THEN
      RAISE EXCEPTION 'Commitment association actor and timestamp must be server generated.';
    END IF;
  ELSE
    IF NEW.supplier_associated_by IS DISTINCT FROM OLD.supplier_associated_by
       OR NEW.supplier_associated_at IS DISTINCT FROM OLD.supplier_associated_at THEN
      RAISE EXCEPTION 'Commitment supplier association metadata is immutable.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_commitment_supplier_association ON public.financial_commitments;
CREATE TRIGGER trg_protect_commitment_supplier_association
  BEFORE INSERT OR UPDATE ON public.financial_commitments
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_commitment_supplier_association();

-- Phase 2B.1 did not know about the two Supplier Accounts source-link columns.
CREATE OR REPLACE FUNCTION public.fn_protect_supplier_cost_source_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.supplier_invoice_id IS DISTINCT FROM OLD.supplier_invoice_id
       OR NEW.supplier_credit_note_id IS DISTINCT FROM OLD.supplier_credit_note_id
     ) THEN
    RAISE EXCEPTION 'Supplier cost-source links are immutable.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_supplier_cost_source_links ON public.financial_cost_postings;
CREATE TRIGGER trg_protect_supplier_cost_source_links
  BEFORE INSERT OR UPDATE ON public.financial_cost_postings
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_supplier_cost_source_links();



DROP TRIGGER IF EXISTS zz_trg_supplier_attachments_version ON public.supplier_attachments;
CREATE TRIGGER zz_trg_supplier_attachments_version
  BEFORE UPDATE ON public.supplier_attachments
  FOR EACH ROW EXECUTE FUNCTION public.fn_supplier_bump_version();

-- ----------------------------------------------------------------------------
-- SECTION 4: GENERIC SOFT-ARCHIVING API
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.archive_finance_record(
  p_table text,
  p_id uuid
)
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
  v_parent_archived boolean;
  v_parent_id uuid;
  v_supplier_id uuid;
  v_commitment_id uuid;
  v_invoice_id uuid;
  v_credit_note_id uuid;
  v_cnt integer;
  v_balance numeric(15,2);
  v_sql text;
  v_res jsonb;
BEGIN
  IF p_table IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'Table name and record ID must be provided.';
  END IF;

  -- Preserve every Phase 2B.1 and final Phase 2C.1 branch and eligibility rule.
  IF p_table IN (
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
    v_sql := format(
      'SELECT company_id, is_archived FROM public.%I WHERE id = $1 FOR UPDATE',
      p_table
    );
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

    IF p_table IN (
      'project_budget_versions',
      'financial_commitments',
      'financial_cost_postings',
      'project_financial_forecasts',
      'project_client_contracts',
      'client_invoices',
      'client_credit_notes',
      'client_receipts'
    ) THEN
      v_sql := format('SELECT status FROM public.%I WHERE id = $1', p_table);
      EXECUTE v_sql INTO v_status USING p_id;
    END IF;

    IF p_table = 'project_budget_versions'
       AND v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
      RAISE EXCEPTION 'Budget version cannot be archived in status %.', v_status;
    ELSIF p_table = 'financial_commitments'
       AND v_status NOT IN ('Closed', 'Cancelled') THEN
      RAISE EXCEPTION 'Financial commitment cannot be archived in status %.', v_status;
    ELSIF p_table = 'financial_cost_postings'
       AND v_status NOT IN ('Draft', 'Rejected') THEN
      RAISE EXCEPTION 'Cost posting cannot be archived in status %.', v_status;
    ELSIF p_table = 'project_financial_forecasts'
       AND v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
      RAISE EXCEPTION 'Financial forecast cannot be archived in status %.', v_status;
    ELSIF p_table = 'project_client_contracts'
       AND v_status NOT IN ('Draft', 'Closed', 'Cancelled') THEN
      RAISE EXCEPTION 'Contract cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_invoices'
       AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
      RAISE EXCEPTION 'Client invoice cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_credit_notes'
       AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
      RAISE EXCEPTION 'Credit note cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_receipts'
       AND v_status NOT IN ('Draft', 'Cancelled') THEN
      RAISE EXCEPTION 'Receipt cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_invoice_lines' THEN
      SELECT invoice_id INTO v_parent_id
      FROM public.client_invoice_lines
      WHERE id = p_id;
      SELECT status INTO v_status
      FROM public.client_invoices
      WHERE id = v_parent_id;
      IF v_status <> 'Draft' THEN
        RAISE EXCEPTION 'Invoice line cannot be archived when parent invoice status is %.', v_status;
      END IF;
    ELSIF p_table = 'client_credit_note_lines' THEN
      SELECT credit_note_id INTO v_parent_id
      FROM public.client_credit_note_lines
      WHERE id = p_id;
      SELECT status INTO v_status
      FROM public.client_credit_notes
      WHERE id = v_parent_id;
      IF v_status <> 'Draft' THEN
        RAISE EXCEPTION 'Credit note line cannot be archived when parent credit note status is %.', v_status;
      END IF;
    ELSIF p_table = 'client_accounts' THEN
      SELECT is_active INTO v_is_active
      FROM public.client_accounts
      WHERE id = p_id;
      IF v_is_active IS TRUE THEN
        RAISE EXCEPTION 'Client account must be marked inactive before archiving.';
      END IF;

      SELECT COUNT(*) INTO v_cnt
      FROM public.project_client_contracts
      WHERE client_account_id = p_id
        AND status = 'Active'
        AND is_archived = false;
      IF v_cnt > 0 THEN
        RAISE EXCEPTION 'Cannot archive client with Active contracts.';
      END IF;

      SELECT COUNT(*) INTO v_cnt
      FROM public.client_invoices
      WHERE client_account_id = p_id
        AND status IN ('Draft', 'Submitted', 'Approved')
        AND is_archived = false;
      IF v_cnt > 0 THEN
        RAISE EXCEPTION 'Cannot archive client with non-terminal invoices.';
      END IF;

      SELECT COUNT(*) INTO v_cnt
      FROM public.client_credit_notes
      WHERE client_account_id = p_id
        AND status IN ('Draft', 'Submitted', 'Approved')
        AND is_archived = false;
      IF v_cnt > 0 THEN
        RAISE EXCEPTION 'Cannot archive client with non-terminal credit notes.';
      END IF;

      SELECT COUNT(*) INTO v_cnt
      FROM public.client_receipts
      WHERE client_account_id = p_id
        AND status = 'Draft'
        AND is_archived = false;
      IF v_cnt > 0 THEN
        RAISE EXCEPTION 'Cannot archive client with draft receipts.';
      END IF;

      SELECT COUNT(*) INTO v_cnt
      FROM (
        SELECT
          ci.id,
          ci.total_incl_vat,
          COALESCE((
            SELECT SUM(ccn.total_incl_vat)
            FROM public.client_credit_notes ccn
            WHERE ccn.invoice_id = ci.id
              AND ccn.status = 'Issued'
              AND ccn.is_archived = false
          ), 0.00) AS cn_sum,
          COALESCE((
            SELECT SUM(cra.amount_allocated)
            FROM public.client_receipt_allocations cra
            WHERE cra.invoice_id = ci.id
              AND cra.status = 'Active'
          ), 0.00) AS alloc_sum
        FROM public.client_invoices ci
        WHERE ci.client_account_id = p_id
          AND ci.status = 'Issued'
          AND ci.is_archived = false
      ) inv_bal
      WHERE (inv_bal.total_incl_vat - inv_bal.cn_sum - inv_bal.alloc_sum) > 0;
      IF v_cnt > 0 THEN
        RAISE EXCEPTION 'Cannot archive client with Issued invoices that have an outstanding balance.';
      END IF;

      SELECT COUNT(*) INTO v_cnt
      FROM (
        SELECT
          cr.id,
          cr.amount_received,
          COALESCE((
            SELECT SUM(cra.amount_allocated)
            FROM public.client_receipt_allocations cra
            WHERE cra.receipt_id = cr.id
              AND cra.status = 'Active'
          ), 0.00) AS alloc_sum
        FROM public.client_receipts cr
        WHERE cr.client_account_id = p_id
          AND cr.status = 'Posted'
          AND cr.is_archived = false
      ) rec_bal
      WHERE (rec_bal.amount_received - rec_bal.alloc_sum) > 0;
      IF v_cnt > 0 THEN
        RAISE EXCEPTION 'Cannot archive client with Posted receipts that have an unallocated balance.';
      END IF;
    END IF;

    v_sql := format(
      'UPDATE public.%I SET is_archived = true, updated_at = now(), updated_by = $1 WHERE id = $2 RETURNING to_jsonb(public.%I.*)',
      p_table,
      p_table
    );
    EXECUTE v_sql INTO v_res USING auth.uid(), p_id;
    RETURN v_res;
  END IF;

  IF p_table = 'supplier_invoices' THEN
    SELECT supplier_account_id, financial_commitment_id
    INTO v_supplier_id, v_commitment_id
    FROM public.supplier_invoices
    WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.financial_commitments WHERE id = v_commitment_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoices WHERE id = p_id FOR UPDATE;
  ELSIF p_table = 'supplier_invoice_lines' THEN
    SELECT si.id, si.supplier_account_id, si.financial_commitment_id
    INTO v_invoice_id, v_supplier_id, v_commitment_id
    FROM public.supplier_invoice_lines sil
    JOIN public.supplier_invoices si ON si.id = sil.supplier_invoice_id
    WHERE sil.id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice line % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.financial_commitments WHERE id = v_commitment_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoices WHERE id = v_invoice_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoice_lines WHERE id = p_id FOR UPDATE;
  ELSIF p_table = 'supplier_credit_notes' THEN
    SELECT supplier_account_id, financial_commitment_id, invoice_id
    INTO v_supplier_id, v_commitment_id, v_invoice_id
    FROM public.supplier_credit_notes
    WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.financial_commitments WHERE id = v_commitment_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoices WHERE id = v_invoice_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_credit_notes WHERE id = p_id FOR UPDATE;
  ELSIF p_table = 'supplier_credit_note_lines' THEN
    SELECT scn.id, scn.supplier_account_id, scn.financial_commitment_id, scn.invoice_id
    INTO v_credit_note_id, v_supplier_id, v_commitment_id, v_invoice_id
    FROM public.supplier_credit_note_lines scnl
    JOIN public.supplier_credit_notes scn ON scn.id = scnl.credit_note_id
    WHERE scnl.id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note line % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.financial_commitments WHERE id = v_commitment_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoices WHERE id = v_invoice_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_credit_notes WHERE id = v_credit_note_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_credit_note_lines WHERE id = p_id FOR UPDATE;
  ELSIF p_table = 'supplier_payments' THEN
    SELECT supplier_account_id INTO v_supplier_id
    FROM public.supplier_payments
    WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_payments WHERE id = p_id FOR UPDATE;
  END IF;

  CASE p_table
    WHEN 'supplier_accounts' THEN
      SELECT company_id, is_active, is_archived INTO v_company_id, v_is_active, v_is_archived
      FROM public.supplier_accounts WHERE id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Supplier account % not found.', p_id; END IF;
      IF v_is_archived THEN RAISE EXCEPTION 'Supplier account is already archived.'; END IF;
      IF v_is_active THEN RAISE EXCEPTION 'Active supplier account % cannot be archived.', p_id; END IF;

      -- Lock every dependent row in the documented global order, then revalidate.
      PERFORM 1
      FROM public.financial_commitments
      WHERE supplier_account_id = p_id
      ORDER BY id
      FOR UPDATE;
      PERFORM 1
      FROM public.supplier_invoices
      WHERE supplier_account_id = p_id
      ORDER BY id
      FOR UPDATE;
      PERFORM 1
      FROM public.supplier_credit_notes
      WHERE supplier_account_id = p_id
      ORDER BY id
      FOR UPDATE;
      PERFORM 1
      FROM public.supplier_payments
      WHERE supplier_account_id = p_id
      ORDER BY id
      FOR UPDATE;
      PERFORM 1
      FROM public.supplier_payment_allocations
      WHERE supplier_account_id = p_id
      ORDER BY id
      FOR UPDATE;
      PERFORM 1
      FROM public.financial_cost_postings fcp
      WHERE EXISTS (
        SELECT 1
        FROM public.supplier_invoices si
        WHERE si.supplier_account_id = p_id
          AND si.id = fcp.supplier_invoice_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.supplier_credit_notes scn
        WHERE scn.supplier_account_id = p_id
          AND scn.id = fcp.supplier_credit_note_id
      )
      ORDER BY id
      FOR UPDATE;

      -- Check commitments
      SELECT COUNT(*) INTO v_cnt FROM public.financial_commitments
      WHERE supplier_account_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
      IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with active commitments.'; END IF;

      -- Check open invoices/credit notes/payments
      SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices
      WHERE supplier_account_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
      IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with active invoices.'; END IF;

      SELECT COUNT(*) INTO v_cnt FROM public.supplier_credit_notes
      WHERE supplier_account_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
      IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with active credit notes.'; END IF;

      SELECT COUNT(*) INTO v_cnt FROM public.supplier_payments
      WHERE supplier_account_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
      IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with active payments.'; END IF;

      -- Check outstanding invoice balances
      SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices si
      WHERE si.supplier_account_id = p_id AND si.status = 'Posted' AND si.is_archived = false
        AND (si.total_incl_vat - COALESCE((SELECT SUM(scn.total_incl_vat) FROM public.supplier_credit_notes scn WHERE scn.invoice_id = si.id AND scn.status = 'Posted' AND scn.is_archived = false), 0.00) - COALESCE((SELECT SUM(spa.amount_allocated) FROM public.supplier_payment_allocations spa WHERE spa.supplier_invoice_id = si.id AND spa.status = 'Active'), 0.00)) > 0;
      IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with outstanding posted invoices.'; END IF;

      SELECT COUNT(*) INTO v_cnt
      FROM public.supplier_payments sp
      WHERE sp.supplier_account_id = p_id
        AND sp.status = 'Posted'
        AND sp.is_archived = false
        AND (
          sp.amount_paid
          - COALESCE((
              SELECT SUM(spa.amount_allocated)
              FROM public.supplier_payment_allocations spa
              WHERE spa.supplier_payment_id = sp.id
                AND spa.status = 'Active'
            ), 0.00)
        ) > 0;
      IF v_cnt > 0 THEN
        RAISE EXCEPTION 'Cannot archive supplier with Posted payments that have an unallocated balance.';
      END IF;

      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_accounts SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_accounts.*) INTO v_res;

    WHEN 'supplier_invoices' THEN
      SELECT company_id, status, is_archived INTO v_company_id, v_status, v_is_archived
      FROM public.supplier_invoices WHERE id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice % not found.', p_id; END IF;
      IF v_is_archived THEN RAISE EXCEPTION 'Invoice is already archived.'; END IF;
      IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Cannot archive invoice in % status.', v_status;
      END IF;

      -- Check active allocations or posted credit notes
      SELECT COUNT(*) INTO v_cnt FROM public.supplier_payment_allocations WHERE supplier_invoice_id = p_id AND status = 'Active';
      IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive invoice with active payment allocations.'; END IF;

      SELECT COUNT(*) INTO v_cnt FROM public.supplier_credit_notes WHERE invoice_id = p_id AND status = 'Posted' AND is_archived = false;
      IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive invoice with posted credit notes.'; END IF;

      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_invoices SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_invoices.*) INTO v_res;

    WHEN 'supplier_invoice_lines' THEN
      SELECT sil.company_id, si.status, sil.is_archived, si.is_archived
      INTO v_company_id, v_status, v_is_archived, v_parent_archived
      FROM public.supplier_invoice_lines sil JOIN public.supplier_invoices si ON si.id = sil.supplier_invoice_id
      WHERE sil.id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Invoice line % not found.', p_id; END IF;
      IF v_is_archived THEN RAISE EXCEPTION 'Line is already archived.'; END IF;
      IF v_status <> 'Draft' OR v_parent_archived THEN
        RAISE EXCEPTION 'Line can only be archived under a Draft, non-archived invoice.';
      END IF;

      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_invoice_lines SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_invoice_lines.*) INTO v_res;

    WHEN 'supplier_credit_notes' THEN
      SELECT company_id, status, is_archived INTO v_company_id, v_status, v_is_archived
      FROM public.supplier_credit_notes WHERE id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
      IF v_is_archived THEN RAISE EXCEPTION 'Credit note is already archived.'; END IF;
      IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Cannot archive credit note in % status.', v_status;
      END IF;

      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_credit_notes SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_credit_notes.*) INTO v_res;

    WHEN 'supplier_credit_note_lines' THEN
      SELECT scnl.company_id, scn.status, scnl.is_archived, scn.is_archived
      INTO v_company_id, v_status, v_is_archived, v_parent_archived
      FROM public.supplier_credit_note_lines scnl JOIN public.supplier_credit_notes scn ON scn.id = scnl.credit_note_id
      WHERE scnl.id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Credit note line % not found.', p_id; END IF;
      IF v_is_archived THEN RAISE EXCEPTION 'Line is already archived.'; END IF;
      IF v_status <> 'Draft' OR v_parent_archived THEN
        RAISE EXCEPTION 'Line can only be archived under a Draft, non-archived credit note.';
      END IF;

      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_credit_note_lines SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_credit_note_lines.*) INTO v_res;

    WHEN 'supplier_payments' THEN
      SELECT company_id, status, is_archived INTO v_company_id, v_status, v_is_archived
      FROM public.supplier_payments WHERE id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found.', p_id; END IF;
      IF v_is_archived THEN RAISE EXCEPTION 'Payment is already archived.'; END IF;
      IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled', 'Posted', 'Reversed') THEN
        RAISE EXCEPTION 'Cannot archive payment in % status.', v_status;
      END IF;

      IF v_status = 'Posted' THEN
        SELECT
          sp.amount_paid - COALESCE(SUM(spa.amount_allocated), 0.00)
        INTO v_balance
        FROM public.supplier_payments sp
        LEFT JOIN public.supplier_payment_allocations spa
          ON spa.supplier_payment_id = sp.id
         AND spa.status = 'Active'
        WHERE sp.id = p_id
        GROUP BY sp.amount_paid;
        IF round(v_balance, 2) > 0 THEN
          RAISE EXCEPTION 'Cannot archive a Posted payment with an unallocated balance.';
        END IF;
      END IF;

      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_payments SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_payments.*) INTO v_res;

    ELSE
      RAISE EXCEPTION 'Unsupported table % for archive_finance_record.', p_table;
  END CASE;

  RETURN v_res;
END;
$$;


CREATE OR REPLACE FUNCTION public.restore_finance_record(
  p_table text,
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_status text;
  v_is_archived boolean;
  v_parent_archived boolean;
  v_parent_id uuid;
  v_supplier_id uuid;
  v_commitment_id uuid;
  v_invoice_id uuid;
  v_credit_note_id uuid;
  v_sql text;
  v_res jsonb;
BEGIN
  IF p_table IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'Table name and record ID must be provided.';
  END IF;

  -- Preserve every Phase 2B.1 and final Phase 2C.1 branch and eligibility rule.
  IF p_table IN (
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
    v_sql := format(
      'SELECT company_id, is_archived FROM public.%I WHERE id = $1 FOR UPDATE',
      p_table
    );
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

    IF p_table IN (
      'project_budget_versions',
      'financial_commitments',
      'financial_cost_postings',
      'project_financial_forecasts',
      'project_client_contracts',
      'client_invoices',
      'client_credit_notes',
      'client_receipts'
    ) THEN
      v_sql := format('SELECT status FROM public.%I WHERE id = $1', p_table);
      EXECUTE v_sql INTO v_status USING p_id;
    END IF;

    IF p_table = 'project_budget_versions'
       AND v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
      RAISE EXCEPTION 'Budget version cannot be restored in status %.', v_status;
    ELSIF p_table = 'financial_commitments'
       AND v_status NOT IN ('Closed', 'Cancelled') THEN
      RAISE EXCEPTION 'Financial commitment cannot be restored in status %.', v_status;
    ELSIF p_table = 'financial_cost_postings'
       AND v_status NOT IN ('Draft', 'Rejected') THEN
      RAISE EXCEPTION 'Cost posting cannot be restored in status %.', v_status;
    ELSIF p_table = 'project_financial_forecasts'
       AND v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
      RAISE EXCEPTION 'Financial forecast cannot be restored in status %.', v_status;
    ELSIF p_table = 'project_client_contracts'
       AND v_status NOT IN ('Draft', 'Closed', 'Cancelled') THEN
      RAISE EXCEPTION 'Contract cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_invoices'
       AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
      RAISE EXCEPTION 'Client invoice cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_credit_notes'
       AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
      RAISE EXCEPTION 'Credit note cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_receipts'
       AND v_status NOT IN ('Draft', 'Cancelled') THEN
      RAISE EXCEPTION 'Receipt cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_invoice_lines' THEN
      SELECT invoice_id INTO v_parent_id
      FROM public.client_invoice_lines
      WHERE id = p_id;
      SELECT status INTO v_status
      FROM public.client_invoices
      WHERE id = v_parent_id;
      IF v_status <> 'Draft' THEN
        RAISE EXCEPTION 'Invoice line cannot be restored when parent invoice status is %.', v_status;
      END IF;
    ELSIF p_table = 'client_credit_note_lines' THEN
      SELECT credit_note_id INTO v_parent_id
      FROM public.client_credit_note_lines
      WHERE id = p_id;
      SELECT status INTO v_status
      FROM public.client_credit_notes
      WHERE id = v_parent_id;
      IF v_status <> 'Draft' THEN
        RAISE EXCEPTION 'Credit note line cannot be restored when parent credit note status is %.', v_status;
      END IF;
    END IF;

    v_sql := format(
      'UPDATE public.%I SET is_archived = false, updated_at = now(), updated_by = $1 WHERE id = $2 RETURNING to_jsonb(public.%I.*)',
      p_table,
      p_table
    );
    EXECUTE v_sql INTO v_res USING auth.uid(), p_id;
    RETURN v_res;
  END IF;

  IF p_table = 'supplier_invoices' THEN
    SELECT supplier_account_id, financial_commitment_id
    INTO v_supplier_id, v_commitment_id
    FROM public.supplier_invoices
    WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.financial_commitments WHERE id = v_commitment_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoices WHERE id = p_id FOR UPDATE;
  ELSIF p_table = 'supplier_invoice_lines' THEN
    SELECT si.id, si.supplier_account_id, si.financial_commitment_id
    INTO v_invoice_id, v_supplier_id, v_commitment_id
    FROM public.supplier_invoice_lines sil
    JOIN public.supplier_invoices si ON si.id = sil.supplier_invoice_id
    WHERE sil.id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice line % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.financial_commitments WHERE id = v_commitment_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoices WHERE id = v_invoice_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoice_lines WHERE id = p_id FOR UPDATE;
  ELSIF p_table = 'supplier_credit_notes' THEN
    SELECT supplier_account_id, financial_commitment_id, invoice_id
    INTO v_supplier_id, v_commitment_id, v_invoice_id
    FROM public.supplier_credit_notes
    WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.financial_commitments WHERE id = v_commitment_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoices WHERE id = v_invoice_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_credit_notes WHERE id = p_id FOR UPDATE;
  ELSIF p_table = 'supplier_credit_note_lines' THEN
    SELECT scn.id, scn.supplier_account_id, scn.financial_commitment_id, scn.invoice_id
    INTO v_credit_note_id, v_supplier_id, v_commitment_id, v_invoice_id
    FROM public.supplier_credit_note_lines scnl
    JOIN public.supplier_credit_notes scn ON scn.id = scnl.credit_note_id
    WHERE scnl.id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note line % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.financial_commitments WHERE id = v_commitment_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_invoices WHERE id = v_invoice_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_credit_notes WHERE id = v_credit_note_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_credit_note_lines WHERE id = p_id FOR UPDATE;
  ELSIF p_table = 'supplier_payments' THEN
    SELECT supplier_account_id INTO v_supplier_id
    FROM public.supplier_payments
    WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found.', p_id; END IF;
    PERFORM 1 FROM public.supplier_accounts WHERE id = v_supplier_id FOR UPDATE;
    PERFORM 1 FROM public.supplier_payments WHERE id = p_id FOR UPDATE;
  END IF;

  CASE p_table
    WHEN 'supplier_accounts' THEN
      SELECT company_id, is_archived INTO v_company_id, v_is_archived
      FROM public.supplier_accounts WHERE id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Supplier account % not found.', p_id; END IF;
      IF NOT v_is_archived THEN RAISE EXCEPTION 'Supplier account is not archived.'; END IF;
      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_accounts SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_accounts.*) INTO v_res;

    WHEN 'supplier_invoices' THEN
      SELECT company_id, is_archived INTO v_company_id, v_is_archived
      FROM public.supplier_invoices WHERE id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice % not found.', p_id; END IF;
      IF NOT v_is_archived THEN RAISE EXCEPTION 'Invoice is not archived.'; END IF;
      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_invoices SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_invoices.*) INTO v_res;

    WHEN 'supplier_invoice_lines' THEN
      SELECT sil.company_id, si.status, sil.is_archived, si.is_archived
      INTO v_company_id, v_status, v_is_archived, v_parent_archived
      FROM public.supplier_invoice_lines sil JOIN public.supplier_invoices si ON si.id = sil.supplier_invoice_id
      WHERE sil.id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Invoice line % not found.', p_id; END IF;
      IF NOT v_is_archived THEN RAISE EXCEPTION 'Line is not archived.'; END IF;
      IF v_status <> 'Draft' OR v_parent_archived THEN
        RAISE EXCEPTION 'Line can only be restored under a Draft, non-archived invoice.';
      END IF;

      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_invoice_lines SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_invoice_lines.*) INTO v_res;

    WHEN 'supplier_credit_notes' THEN
      SELECT company_id, is_archived INTO v_company_id, v_is_archived
      FROM public.supplier_credit_notes WHERE id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
      IF NOT v_is_archived THEN RAISE EXCEPTION 'Credit note is not archived.'; END IF;
      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_credit_notes SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_credit_notes.*) INTO v_res;

    WHEN 'supplier_credit_note_lines' THEN
      SELECT scnl.company_id, scn.status, scnl.is_archived, scn.is_archived
      INTO v_company_id, v_status, v_is_archived, v_parent_archived
      FROM public.supplier_credit_note_lines scnl JOIN public.supplier_credit_notes scn ON scn.id = scnl.credit_note_id
      WHERE scnl.id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Credit note line % not found.', p_id; END IF;
      IF NOT v_is_archived THEN RAISE EXCEPTION 'Line is not archived.'; END IF;
      IF v_status <> 'Draft' OR v_parent_archived THEN
        RAISE EXCEPTION 'Line can only be restored under a Draft, non-archived credit note.';
      END IF;

      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_credit_note_lines SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_credit_note_lines.*) INTO v_res;

    WHEN 'supplier_payments' THEN
      SELECT company_id, is_archived INTO v_company_id, v_is_archived
      FROM public.supplier_payments WHERE id = p_id FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found.', p_id; END IF;
      IF NOT v_is_archived THEN RAISE EXCEPTION 'Payment is not archived.'; END IF;
      IF NOT public.has_finance_full_access(v_company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

      UPDATE public.supplier_payments SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = p_id RETURNING to_jsonb(supplier_payments.*) INTO v_res;

    ELSE
      RAISE EXCEPTION 'Unsupported table % for restore_finance_record.', p_table;
  END CASE;

  RETURN v_res;
END;
$$;


-- ----------------------------------------------------------------------------
-- SECTION 5: SUPPLIER LIFECYCLE & WORKFLOW RPCS
-- ----------------------------------------------------------------------------

-- 5.1 ACTIVATION / DEACTIVATION
CREATE OR REPLACE FUNCTION public.activate_supplier_account(p_supplier_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sa public.supplier_accounts%ROWTYPE;
BEGIN
  -- Lock Order 1: supplier_accounts
  SELECT * INTO v_sa FROM public.supplier_accounts WHERE id = p_supplier_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier account % not found.', p_supplier_account_id; END IF;
  IF v_sa.is_archived THEN RAISE EXCEPTION 'Cannot activate archived supplier account.'; END IF;
  IF NOT public.has_finance_full_access(v_sa.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;
  IF v_sa.is_active THEN
    RETURN to_jsonb(v_sa);
  END IF;

  UPDATE public.supplier_accounts
  SET is_active = true,
      activated_by = auth.uid(),
      activated_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_supplier_account_id
  RETURNING * INTO v_sa;
  RETURN to_jsonb(v_sa);
END;
$$;


CREATE OR REPLACE FUNCTION public.deactivate_supplier_account(
  p_supplier_account_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sa public.supplier_accounts%ROWTYPE;
  v_cnt integer;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank supplier deactivation reason is required.';
  END IF;

  -- Lock Order 1: supplier_accounts
  SELECT * INTO v_sa FROM public.supplier_accounts WHERE id = p_supplier_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier account % not found.', p_supplier_account_id; END IF;
  IF v_sa.is_archived THEN RAISE EXCEPTION 'Cannot deactivate archived supplier account.'; END IF;
  IF NOT public.has_finance_full_access(v_sa.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;
  IF NOT v_sa.is_active THEN
    RAISE EXCEPTION 'Supplier account is already inactive.';
  END IF;

  -- Acquire all dependent locks in the global order before revalidation.
  PERFORM 1
  FROM public.financial_commitments
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.supplier_invoices
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.supplier_credit_notes
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.supplier_payments
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.supplier_payment_allocations
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.financial_cost_postings fcp
  WHERE EXISTS (
    SELECT 1
    FROM public.supplier_invoices si
    WHERE si.supplier_account_id = p_supplier_account_id
      AND si.id = fcp.supplier_invoice_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.supplier_credit_notes scn
    WHERE scn.supplier_account_id = p_supplier_account_id
      AND scn.id = fcp.supplier_credit_note_id
  )
  ORDER BY fcp.id
  FOR UPDATE;

  -- Check active commitments
  SELECT COUNT(*) INTO v_cnt FROM public.financial_commitments
  WHERE supplier_account_id = p_supplier_account_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with active commitments.'; END IF;

  -- Check active invoices
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices
  WHERE supplier_account_id = p_supplier_account_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with active invoices.'; END IF;

  -- Check active credit notes
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_credit_notes
  WHERE supplier_account_id = p_supplier_account_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with active credit notes.'; END IF;

  -- Check active payments
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_payments
  WHERE supplier_account_id = p_supplier_account_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with active payments.'; END IF;

  -- Check outstanding posted invoices
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices si
  WHERE si.supplier_account_id = p_supplier_account_id AND si.status = 'Posted' AND si.is_archived = false
    AND (si.total_incl_vat - COALESCE((SELECT SUM(scn.total_incl_vat) FROM public.supplier_credit_notes scn WHERE scn.invoice_id = si.id AND scn.status = 'Posted' AND scn.is_archived = false), 0.00) - COALESCE((SELECT SUM(spa.amount_allocated) FROM public.supplier_payment_allocations spa WHERE spa.supplier_invoice_id = si.id AND spa.status = 'Active'), 0.00)) > 0;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with outstanding posted invoices.'; END IF;

  -- Check unallocated posted payments
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_payments sp
  WHERE sp.supplier_account_id = p_supplier_account_id AND sp.status = 'Posted' AND sp.is_archived = false
    AND (sp.amount_paid - COALESCE((SELECT SUM(spa.amount_allocated) FROM public.supplier_payment_allocations spa WHERE spa.supplier_payment_id = sp.id AND spa.status = 'Active'), 0.00)) > 0;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with unallocated posted payments.'; END IF;

  UPDATE public.supplier_accounts
  SET is_active = false,
      deactivated_by = auth.uid(),
      deactivated_at = now(),
      deactivation_reason = v_reason,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_supplier_account_id
  RETURNING * INTO v_sa;
  RETURN to_jsonb(v_sa);
END;
$$;


CREATE OR REPLACE FUNCTION public.associate_commitment_supplier(
  p_commitment_id uuid,
  p_supplier_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lookup_company_id uuid;
  v_supplier public.supplier_accounts%ROWTYPE;
  v_commitment public.financial_commitments%ROWTYPE;
  v_old_data jsonb;
BEGIN
  IF p_commitment_id IS NULL OR p_supplier_account_id IS NULL THEN
    RAISE EXCEPTION 'Commitment ID and supplier account ID are required.';
  END IF;

  SELECT company_id INTO v_lookup_company_id
  FROM public.financial_commitments
  WHERE id = p_commitment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial commitment % not found.', p_commitment_id;
  END IF;

  -- Lock supplier before commitment.
  SELECT * INTO v_supplier
  FROM public.supplier_accounts
  WHERE id = p_supplier_account_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier account % not found.', p_supplier_account_id;
  END IF;

  SELECT * INTO v_commitment
  FROM public.financial_commitments
  WHERE id = p_commitment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial commitment % not found after locking.', p_commitment_id;
  END IF;

  IF NOT public.has_finance_full_access(v_commitment.company_id) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF v_commitment.company_id <> v_lookup_company_id
     OR v_supplier.company_id <> v_commitment.company_id THEN
    RAISE EXCEPTION 'Supplier and commitment company context mismatch.';
  END IF;
  IF v_supplier.is_active IS NOT TRUE OR v_supplier.is_archived IS TRUE THEN
    RAISE EXCEPTION 'Supplier must be active and non-archived.';
  END IF;
  IF v_commitment.status <> 'Draft' OR v_commitment.is_archived IS TRUE THEN
    RAISE EXCEPTION 'Supplier association requires a Draft, non-archived commitment.';
  END IF;
  IF v_commitment.supplier_account_id IS NOT NULL THEN
    RAISE EXCEPTION 'Commitment already has a supplier and cannot be reassociated.';
  END IF;

  v_old_data := to_jsonb(v_commitment);

  UPDATE public.financial_commitments
  SET supplier_account_id = p_supplier_account_id,
      supplier_associated_by = auth.uid(),
      supplier_associated_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_commitment_id
  RETURNING * INTO v_commitment;

  INSERT INTO public.supplier_accounts_audit_log (
    company_id,
    entity_type,
    entity_id,
    event_type,
    old_data,
    new_data,
    actor_id
  )
  VALUES (
    v_commitment.company_id,
    'financial_commitments',
    v_commitment.id,
    'ASSOCIATE',
    v_old_data,
    to_jsonb(v_commitment),
    auth.uid()
  );

  RETURN to_jsonb(v_commitment);
END;
$$;


-- 5.2 INVOICE WORKFLOWS
CREATE OR REPLACE FUNCTION public.fn_lock_supplier_invoice_context(p_invoice_id uuid)
RETURNS public.supplier_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lookup public.supplier_invoices%ROWTYPE;
  v_invoice public.supplier_invoices%ROWTYPE;
  v_supplier public.supplier_accounts%ROWTYPE;
  v_commitment public.financial_commitments%ROWTYPE;
BEGIN
  SELECT * INTO v_lookup
  FROM public.supplier_invoices
  WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier invoice % not found.', p_invoice_id;
  END IF;

  IF v_lookup.financial_commitment_id IS NULL THEN
    RAISE EXCEPTION 'Supplier invoice must have a financial commitment.';
  END IF;

  SELECT * INTO v_supplier
  FROM public.supplier_accounts
  WHERE id = v_lookup.supplier_account_id
  FOR UPDATE;

  SELECT * INTO v_commitment
  FROM public.financial_commitments
  WHERE id = v_lookup.financial_commitment_id
  FOR UPDATE;

  SELECT * INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_invoice.supplier_account_id <> v_lookup.supplier_account_id
     OR v_invoice.financial_commitment_id <> v_lookup.financial_commitment_id THEN
    RAISE EXCEPTION 'Supplier invoice context changed while locks were being acquired.';
  END IF;
  IF NOT public.has_finance_full_access(v_invoice.company_id) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF v_invoice.is_archived THEN
    RAISE EXCEPTION 'Archived supplier invoices cannot enter a workflow transition.';
  END IF;
  IF v_supplier.id IS NULL
     OR v_supplier.is_active IS NOT TRUE
     OR v_supplier.is_archived IS TRUE
     OR v_supplier.company_id <> v_invoice.company_id
     OR v_supplier.default_currency <> v_invoice.currency THEN
    RAISE EXCEPTION 'Supplier must be active, non-archived and match invoice company and currency.';
  END IF;
  IF v_commitment.id IS NULL
     OR v_commitment.status <> 'Approved'
     OR v_commitment.is_archived IS TRUE
     OR v_commitment.company_id <> v_invoice.company_id
     OR v_commitment.project_id <> v_invoice.project_id
     OR v_commitment.supplier_account_id IS DISTINCT FROM v_invoice.supplier_account_id
     OR v_commitment.currency_code <> v_invoice.currency THEN
    RAISE EXCEPTION 'Invoice commitment must be Approved, non-archived and match exact company, project, supplier and currency context.';
  END IF;

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_assert_supplier_invoice_capacity(
  p_invoice_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.supplier_invoices%ROWTYPE;
  v_commitment public.financial_commitments%ROWTYPE;
  v_recognised numeric(15,2);
BEGIN
  SELECT * INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier invoice % not found.', p_invoice_id;
  END IF;

  SELECT * INTO v_commitment
  FROM public.financial_commitments
  WHERE id = v_invoice.financial_commitment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice commitment was not found.';
  END IF;

  SELECT COALESCE(SUM(amount_excl_vat), 0.00)
  INTO v_recognised
  FROM public.financial_cost_postings
  WHERE commitment_id = v_invoice.financial_commitment_id
    AND status = 'Posted'
    AND entry_type = 'Cost';

  IF round(v_recognised + v_invoice.subtotal_excl_vat, 2)
     > round(v_commitment.revised_commitment_excl_vat, 2) THEN
    RAISE EXCEPTION
      'Invoice exceeds commitment: recognised expenditure % plus invoice subtotal % exceeds revised commitment %.',
      v_recognised,
      v_invoice.subtotal_excl_vat,
      v_commitment.revised_commitment_excl_vat;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_supplier_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_line_cnt integer;
  v_cost_cnt integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);
  IF v_inv.status <> 'Draft' THEN RAISE EXCEPTION 'Invoice must be in Draft status to submit.'; END IF;

  SELECT COUNT(*) INTO v_line_cnt FROM public.supplier_invoice_lines WHERE supplier_invoice_id = p_invoice_id AND is_archived = false;
  IF v_line_cnt = 0 THEN RAISE EXCEPTION 'Cannot submit an invoice with no non-archived lines.'; END IF;
  IF v_inv.subtotal_excl_vat <= 0 OR v_inv.total_incl_vat <= 0 THEN
    RAISE EXCEPTION 'Supplier invoice totals must be positive.';
  END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_cnt
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id;
  IF v_cost_cnt <> 0 THEN
    RAISE EXCEPTION 'A non-Posted invoice must not already have a linked cost.';
  END IF;

  PERFORM public.fn_assert_supplier_invoice_capacity(p_invoice_id);

  UPDATE public.supplier_invoices
  SET status = 'Submitted', submitted_by = auth.uid(), submitted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  RETURN to_jsonb(v_inv);
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_supplier_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_cost_cnt integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);
  IF v_inv.status <> 'Submitted' THEN RAISE EXCEPTION 'Invoice must be in Submitted status to approve.'; END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_cnt
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id;
  IF v_cost_cnt <> 0 THEN
    RAISE EXCEPTION 'A non-Posted invoice must not already have a linked cost.';
  END IF;

  PERFORM public.fn_assert_supplier_invoice_capacity(p_invoice_id);

  UPDATE public.supplier_invoices
  SET status = 'Approved', approved_by = auth.uid(), approved_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  RETURN to_jsonb(v_inv);
END;
$$;


CREATE OR REPLACE FUNCTION public.post_supplier_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_cost public.financial_cost_postings%ROWTYPE;
  v_cost_count integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_cost_count
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
    AND entry_type = 'Cost';

  IF v_cost_count > 1 THEN
    RAISE EXCEPTION 'Supplier invoice % has more than one primary Cost.', p_invoice_id;
  END IF;

  IF v_cost_count = 1 THEN
    SELECT * INTO v_cost
    FROM public.financial_cost_postings
    WHERE supplier_invoice_id = p_invoice_id
      AND entry_type = 'Cost';
  END IF;

  IF v_inv.status = 'Posted' THEN
    IF v_cost_count <> 1
       OR v_cost.status <> 'Posted'
       OR v_cost.source_type <> 'Supplier Invoice'
       OR v_cost.entry_type <> 'Cost'
       OR v_cost.reversal_of_id IS NOT NULL
       OR v_cost.supplier_invoice_id <> v_inv.id
       OR v_cost.supplier_credit_note_id IS NOT NULL
       OR v_cost.source_record_id <> v_inv.id
       OR v_cost.company_id <> v_inv.company_id
       OR v_cost.project_id <> v_inv.project_id
       OR v_cost.commitment_id <> v_inv.financial_commitment_id
       OR v_cost.currency_code <> v_inv.currency
       OR round(v_cost.amount_excl_vat, 2) <> round(v_inv.subtotal_excl_vat, 2) THEN
      RAISE EXCEPTION 'Posted supplier invoice has an invalid or incomplete linked Cost.';
    END IF;
    RETURN to_jsonb(v_inv);
  END IF;

  IF v_inv.status <> 'Approved' THEN
    RAISE EXCEPTION 'Invoice must be in Approved status to post.';
  END IF;

  PERFORM public.fn_assert_supplier_invoice_capacity(p_invoice_id);

  IF v_cost_count = 0 THEN
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
      currency_code,
      supplier_invoice_id,
      created_by,
      updated_by
    ) VALUES (
      v_inv.company_id,
      v_inv.project_id,
      'SI-' || gen_random_uuid()::text,
      v_inv.invoice_date,
      'Supplier Invoice',
      v_inv.id,
      v_inv.supplier_invoice_number,
      v_inv.financial_commitment_id,
      'Supplier Cost',
      COALESCE(v_inv.notes, 'Supplier Invoice ' || v_inv.supplier_invoice_number),
      'Cost',
      v_inv.subtotal_excl_vat,
      v_inv.currency,
      v_inv.id,
      auth.uid(),
      auth.uid()
    )
    RETURNING * INTO v_cost;
  END IF;

  IF v_cost.status = 'Draft' THEN
    PERFORM public.submit_financial_cost_posting(v_cost.id);
    PERFORM public.post_financial_cost_posting(v_cost.id);
  ELSIF v_cost.status = 'Submitted' THEN
    PERFORM public.post_financial_cost_posting(v_cost.id);
  ELSIF v_cost.status <> 'Posted' THEN
    RAISE EXCEPTION 'Linked invoice Cost is in incompatible status %.', v_cost.status;
  END IF;

  SELECT * INTO v_cost
  FROM public.financial_cost_postings
  WHERE id = v_cost.id;

  IF v_cost.status <> 'Posted'
     OR v_cost.source_type <> 'Supplier Invoice'
     OR v_cost.entry_type <> 'Cost'
     OR v_cost.reversal_of_id IS NOT NULL
     OR v_cost.supplier_invoice_id <> v_inv.id
     OR v_cost.supplier_credit_note_id IS NOT NULL
     OR v_cost.source_record_id <> v_inv.id
     OR v_cost.company_id <> v_inv.company_id
     OR v_cost.project_id <> v_inv.project_id
     OR v_cost.commitment_id <> v_inv.financial_commitment_id
     OR v_cost.currency_code <> v_inv.currency
     OR round(v_cost.amount_excl_vat, 2) <> round(v_inv.subtotal_excl_vat, 2) THEN
    RAISE EXCEPTION 'Supplier invoice Cost failed post-workflow validation.';
  END IF;

  UPDATE public.supplier_invoices
  SET status = 'Posted', posted_by = auth.uid(), posted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  RETURN to_jsonb(v_inv);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_supplier_invoice(
  p_invoice_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.supplier_invoices%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank invoice rejection reason is required.';
  END IF;

  v_invoice := public.fn_lock_supplier_invoice_context(p_invoice_id);
  IF v_invoice.status <> 'Submitted' THEN
    RAISE EXCEPTION 'Only a Submitted invoice can be rejected.';
  END IF;

  UPDATE public.supplier_invoices
  SET status = 'Rejected',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_reason = v_reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_invoice;

  RETURN to_jsonb(v_invoice);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_supplier_invoice(
  p_invoice_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.supplier_invoices%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_cost_count integer;
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank invoice cancellation reason is required.';
  END IF;

  v_invoice := public.fn_lock_supplier_invoice_context(p_invoice_id);
  IF v_invoice.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
    RAISE EXCEPTION 'Invoice can only be cancelled from Draft, Submitted or Approved status.';
  END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_count
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id;
  IF v_cost_count <> 0 THEN
    RAISE EXCEPTION 'Invoice with a linked Cost cannot be cancelled.';
  END IF;

  UPDATE public.supplier_invoices
  SET status = 'Cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      cancellation_reason = v_reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_invoice;

  RETURN to_jsonb(v_invoice);
END;
$$;


-- 5.3 CREDIT NOTE WORKFLOWS
CREATE OR REPLACE FUNCTION public.fn_lock_supplier_credit_note_context(
  p_credit_note_id uuid
)
RETURNS public.supplier_credit_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lookup public.supplier_credit_notes%ROWTYPE;
  v_credit_note public.supplier_credit_notes%ROWTYPE;
  v_supplier public.supplier_accounts%ROWTYPE;
  v_commitment public.financial_commitments%ROWTYPE;
  v_invoice public.supplier_invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_lookup
  FROM public.supplier_credit_notes
  WHERE id = p_credit_note_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier credit note % not found.', p_credit_note_id;
  END IF;

  SELECT * INTO v_supplier
  FROM public.supplier_accounts
  WHERE id = v_lookup.supplier_account_id
  FOR UPDATE;

  SELECT * INTO v_commitment
  FROM public.financial_commitments
  WHERE id = v_lookup.financial_commitment_id
  FOR UPDATE;

  SELECT * INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = v_lookup.invoice_id
  FOR UPDATE;

  PERFORM 1
  FROM public.supplier_credit_notes
  WHERE invoice_id = v_lookup.invoice_id
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_credit_note
  FROM public.supplier_credit_notes
  WHERE id = p_credit_note_id;

  IF NOT FOUND
     OR v_credit_note.supplier_account_id <> v_lookup.supplier_account_id
     OR v_credit_note.financial_commitment_id <> v_lookup.financial_commitment_id
     OR v_credit_note.invoice_id <> v_lookup.invoice_id THEN
    RAISE EXCEPTION 'Supplier credit-note context changed while locks were being acquired.';
  END IF;
  IF NOT public.has_finance_full_access(v_credit_note.company_id) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF v_credit_note.is_archived THEN
    RAISE EXCEPTION 'Archived supplier credit notes cannot enter a workflow transition.';
  END IF;
  IF v_supplier.id IS NULL
     OR v_supplier.is_active IS NOT TRUE
     OR v_supplier.is_archived IS TRUE
     OR v_supplier.company_id <> v_credit_note.company_id
     OR v_supplier.default_currency <> v_credit_note.currency THEN
    RAISE EXCEPTION 'Supplier must be active, non-archived and match credit-note company and currency.';
  END IF;
  IF v_commitment.id IS NULL
     OR v_commitment.status <> 'Approved'
     OR v_commitment.is_archived IS TRUE
     OR v_commitment.company_id <> v_credit_note.company_id
     OR v_commitment.project_id <> v_credit_note.project_id
     OR v_commitment.supplier_account_id IS DISTINCT FROM v_credit_note.supplier_account_id
     OR v_commitment.currency_code <> v_credit_note.currency THEN
    RAISE EXCEPTION 'Credit-note commitment must be Approved, non-archived and match exact context.';
  END IF;
  IF v_invoice.id IS NULL
     OR v_invoice.status <> 'Posted'
     OR v_invoice.is_archived IS TRUE
     OR v_invoice.company_id <> v_credit_note.company_id
     OR v_invoice.project_id <> v_credit_note.project_id
     OR v_invoice.supplier_account_id <> v_credit_note.supplier_account_id
     OR v_invoice.currency <> v_credit_note.currency
     OR v_invoice.financial_commitment_id IS DISTINCT FROM v_credit_note.financial_commitment_id THEN
    RAISE EXCEPTION 'Parent invoice must be Posted, non-archived and match exact company, project, supplier, currency and commitment context.';
  END IF;

  RETURN v_credit_note;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_assert_supplier_credit_capacity(
  p_credit_note_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit_note public.supplier_credit_notes%ROWTYPE;
  v_invoice public.supplier_invoices%ROWTYPE;
  v_prior_credits numeric(15,2);
  v_allocations numeric(15,2);
  v_remaining numeric(15,2);
BEGIN
  SELECT * INTO v_credit_note
  FROM public.supplier_credit_notes
  WHERE id = p_credit_note_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier credit note % not found.', p_credit_note_id;
  END IF;

  SELECT * INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = v_credit_note.invoice_id;

  SELECT COALESCE(SUM(total_incl_vat), 0.00)
  INTO v_prior_credits
  FROM public.supplier_credit_notes
  WHERE invoice_id = v_credit_note.invoice_id
    AND id <> v_credit_note.id
    AND status = 'Posted';

  SELECT COALESCE(SUM(amount_allocated), 0.00)
  INTO v_allocations
  FROM public.supplier_payment_allocations
  WHERE supplier_invoice_id = v_credit_note.invoice_id
    AND status = 'Active';

  v_remaining := v_invoice.total_incl_vat - v_prior_credits - v_allocations;

  IF round(v_credit_note.total_incl_vat, 2) > round(v_remaining, 2) THEN
    RAISE EXCEPTION
      'Credit note total % exceeds remaining VAT-inclusive invoice balance %.',
      v_credit_note.total_incl_vat,
      v_remaining;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_supplier_credit_note(p_credit_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cn public.supplier_credit_notes%ROWTYPE;
  v_line_cnt integer;
  v_cost_cnt integer;
BEGIN
  v_cn := public.fn_lock_supplier_credit_note_context(p_credit_note_id);
  IF v_cn.status <> 'Draft' THEN RAISE EXCEPTION 'Credit note must be in Draft status to submit.'; END IF;

  SELECT COUNT(*) INTO v_line_cnt FROM public.supplier_credit_note_lines WHERE credit_note_id = p_credit_note_id AND is_archived = false;
  IF v_line_cnt = 0 THEN RAISE EXCEPTION 'Cannot submit credit note with no non-archived lines.'; END IF;
  IF v_cn.subtotal_excl_vat <= 0 OR v_cn.total_incl_vat <= 0 THEN
    RAISE EXCEPTION 'Supplier credit-note totals must be positive.';
  END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_cnt
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id;
  IF v_cost_cnt <> 0 THEN
    RAISE EXCEPTION 'A non-Posted credit note must not already have a linked cost.';
  END IF;

  PERFORM public.fn_assert_supplier_credit_capacity(p_credit_note_id);

  UPDATE public.supplier_credit_notes
  SET status = 'Submitted', submitted_by = auth.uid(), submitted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_credit_note_id RETURNING * INTO v_cn;

  RETURN to_jsonb(v_cn);
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_supplier_credit_note(p_credit_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cn public.supplier_credit_notes%ROWTYPE;
  v_cost_cnt integer;
BEGIN
  v_cn := public.fn_lock_supplier_credit_note_context(p_credit_note_id);
  IF v_cn.status <> 'Submitted' THEN RAISE EXCEPTION 'Credit note must be in Submitted status to approve.'; END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_cnt
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id;
  IF v_cost_cnt <> 0 THEN
    RAISE EXCEPTION 'A non-Posted credit note must not already have a linked cost.';
  END IF;

  PERFORM public.fn_assert_supplier_credit_capacity(p_credit_note_id);

  UPDATE public.supplier_credit_notes
  SET status = 'Approved', approved_by = auth.uid(), approved_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_credit_note_id RETURNING * INTO v_cn;

  RETURN to_jsonb(v_cn);
END;
$$;


CREATE OR REPLACE FUNCTION public.post_supplier_credit_note(p_credit_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cn public.supplier_credit_notes%ROWTYPE;
  v_cost public.financial_cost_postings%ROWTYPE;
  v_cost_count integer;
BEGIN
  v_cn := public.fn_lock_supplier_credit_note_context(p_credit_note_id);

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_cost_count
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id
    AND entry_type = 'Cost';

  IF v_cost_count > 1 THEN
    RAISE EXCEPTION 'Supplier credit note % has more than one primary Cost.', p_credit_note_id;
  END IF;
  IF v_cost_count = 1 THEN
    SELECT * INTO v_cost
    FROM public.financial_cost_postings
    WHERE supplier_credit_note_id = p_credit_note_id
      AND entry_type = 'Cost';
  END IF;

  IF v_cn.status = 'Posted' THEN
    IF v_cost_count <> 1
       OR v_cost.status <> 'Posted'
       OR v_cost.source_type <> 'Supplier Credit Note'
       OR v_cost.entry_type <> 'Cost'
       OR v_cost.reversal_of_id IS NOT NULL
       OR v_cost.supplier_credit_note_id <> v_cn.id
       OR v_cost.supplier_invoice_id IS NOT NULL
       OR v_cost.source_record_id <> v_cn.id
       OR v_cost.company_id <> v_cn.company_id
       OR v_cost.project_id <> v_cn.project_id
       OR v_cost.commitment_id <> v_cn.financial_commitment_id
       OR v_cost.currency_code <> v_cn.currency
       OR round(v_cost.amount_excl_vat, 2) <> round(-v_cn.subtotal_excl_vat, 2) THEN
      RAISE EXCEPTION 'Posted supplier credit note has an invalid or incomplete linked Cost.';
    END IF;
    RETURN to_jsonb(v_cn);
  END IF;

  IF v_cn.status <> 'Approved' THEN
    RAISE EXCEPTION 'Credit note must be in Approved status to post.';
  END IF;

  PERFORM public.fn_assert_supplier_credit_capacity(p_credit_note_id);

  IF v_cost_count = 0 THEN
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
      currency_code,
      supplier_credit_note_id,
      created_by,
      updated_by
    ) VALUES (
      v_cn.company_id,
      v_cn.project_id,
      'SCN-' || gen_random_uuid()::text,
      v_cn.credit_note_date,
      'Supplier Credit Note',
      v_cn.id,
      v_cn.credit_note_number,
      v_cn.financial_commitment_id,
      'Supplier Cost',
      COALESCE(v_cn.notes, 'Supplier Credit Note ' || v_cn.credit_note_number),
      'Cost',
      -v_cn.subtotal_excl_vat,
      v_cn.currency,
      v_cn.id,
      auth.uid(),
      auth.uid()
    )
    RETURNING * INTO v_cost;
  END IF;

  IF v_cost.status = 'Draft' THEN
    PERFORM public.submit_financial_cost_posting(v_cost.id);
    PERFORM public.post_financial_cost_posting(v_cost.id);
  ELSIF v_cost.status = 'Submitted' THEN
    PERFORM public.post_financial_cost_posting(v_cost.id);
  ELSIF v_cost.status <> 'Posted' THEN
    RAISE EXCEPTION 'Linked credit-note Cost is in incompatible status %.', v_cost.status;
  END IF;

  SELECT * INTO v_cost
  FROM public.financial_cost_postings
  WHERE id = v_cost.id;

  IF v_cost.status <> 'Posted'
     OR v_cost.source_type <> 'Supplier Credit Note'
     OR v_cost.entry_type <> 'Cost'
     OR v_cost.reversal_of_id IS NOT NULL
     OR v_cost.supplier_credit_note_id <> v_cn.id
     OR v_cost.supplier_invoice_id IS NOT NULL
     OR v_cost.source_record_id <> v_cn.id
     OR v_cost.company_id <> v_cn.company_id
     OR v_cost.project_id <> v_cn.project_id
     OR v_cost.commitment_id <> v_cn.financial_commitment_id
     OR v_cost.currency_code <> v_cn.currency
     OR round(v_cost.amount_excl_vat, 2) <> round(-v_cn.subtotal_excl_vat, 2) THEN
    RAISE EXCEPTION 'Supplier credit-note Cost failed post-workflow validation.';
  END IF;

  UPDATE public.supplier_credit_notes
  SET status = 'Posted', posted_by = auth.uid(), posted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_credit_note_id RETURNING * INTO v_cn;

  RETURN to_jsonb(v_cn);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_supplier_credit_note(
  p_credit_note_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit_note public.supplier_credit_notes%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank credit-note rejection reason is required.';
  END IF;

  v_credit_note := public.fn_lock_supplier_credit_note_context(p_credit_note_id);
  IF v_credit_note.status <> 'Submitted' THEN
    RAISE EXCEPTION 'Only a Submitted credit note can be rejected.';
  END IF;

  UPDATE public.supplier_credit_notes
  SET status = 'Rejected',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_reason = v_reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_credit_note_id
  RETURNING * INTO v_credit_note;

  RETURN to_jsonb(v_credit_note);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_supplier_credit_note(
  p_credit_note_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit_note public.supplier_credit_notes%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_cost_count integer;
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank credit-note cancellation reason is required.';
  END IF;

  v_credit_note := public.fn_lock_supplier_credit_note_context(p_credit_note_id);
  IF v_credit_note.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
    RAISE EXCEPTION 'Credit note can only be cancelled from Draft, Submitted or Approved status.';
  END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_count
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id;
  IF v_cost_count <> 0 THEN
    RAISE EXCEPTION 'Credit note with a linked Cost cannot be cancelled.';
  END IF;

  UPDATE public.supplier_credit_notes
  SET status = 'Cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      cancellation_reason = v_reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_credit_note_id
  RETURNING * INTO v_credit_note;

  RETURN to_jsonb(v_credit_note);
END;
$$;


-- 5.4 PAYMENT WORKFLOWS
CREATE OR REPLACE FUNCTION public.fn_lock_supplier_payment_context(
  p_payment_id uuid
)
RETURNS public.supplier_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lookup public.supplier_payments%ROWTYPE;
  v_payment public.supplier_payments%ROWTYPE;
  v_supplier public.supplier_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_lookup
  FROM public.supplier_payments
  WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier payment % not found.', p_payment_id;
  END IF;

  SELECT * INTO v_supplier
  FROM public.supplier_accounts
  WHERE id = v_lookup.supplier_account_id
  FOR UPDATE;

  SELECT * INTO v_payment
  FROM public.supplier_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_payment.supplier_account_id <> v_lookup.supplier_account_id THEN
    RAISE EXCEPTION 'Supplier payment context changed while locks were being acquired.';
  END IF;
  IF NOT public.has_finance_full_access(v_payment.company_id) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF v_payment.is_archived THEN
    RAISE EXCEPTION 'Archived supplier payments cannot enter a workflow transition.';
  END IF;
  IF v_supplier.id IS NULL
     OR v_supplier.is_active IS NOT TRUE
     OR v_supplier.is_archived IS TRUE
     OR v_supplier.company_id <> v_payment.company_id
     OR v_supplier.default_currency <> v_payment.currency THEN
    RAISE EXCEPTION 'Supplier must be active, non-archived and match payment company and currency.';
  END IF;

  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_supplier_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sp public.supplier_payments%ROWTYPE;
BEGIN
  v_sp := public.fn_lock_supplier_payment_context(p_payment_id);
  IF v_sp.status <> 'Draft' THEN RAISE EXCEPTION 'Payment must be in Draft status to submit.'; END IF;

  UPDATE public.supplier_payments
  SET status = 'Submitted', submitted_by = auth.uid(), submitted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_payment_id RETURNING * INTO v_sp;

  RETURN to_jsonb(v_sp);
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_supplier_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sp public.supplier_payments%ROWTYPE;
BEGIN
  v_sp := public.fn_lock_supplier_payment_context(p_payment_id);
  IF v_sp.status <> 'Submitted' THEN RAISE EXCEPTION 'Payment must be in Submitted status to approve.'; END IF;

  UPDATE public.supplier_payments
  SET status = 'Approved', approved_by = auth.uid(), approved_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_payment_id RETURNING * INTO v_sp;

  RETURN to_jsonb(v_sp);
END;
$$;


CREATE OR REPLACE FUNCTION public.post_supplier_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sp public.supplier_payments%ROWTYPE;
  v_supplier public.supplier_accounts%ROWTYPE;
  v_cbt public.cashbook_transactions%ROWTYPE;
  v_cb_version integer;
  v_alloc_count integer;
BEGIN
  v_sp := public.fn_lock_supplier_payment_context(p_payment_id);
  IF v_sp.status = 'Posted' THEN
    IF v_sp.cashbook_transaction_id IS NULL THEN
      RAISE EXCEPTION 'Posted supplier payment is missing its Cashbook transaction link.';
    END IF;
    RETURN to_jsonb(v_sp);
  END IF;
  IF v_sp.status <> 'Approved' THEN RAISE EXCEPTION 'Payment must be in Approved status to post.'; END IF;
  IF v_sp.cashbook_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Non-Posted supplier payment already has a Cashbook transaction link.';
  END IF;

  SELECT * INTO v_supplier FROM public.supplier_accounts WHERE id = v_sp.supplier_account_id;

  INSERT INTO public.cashbook_transactions (
    company_id, project_id, bank_account_id, transaction_type, transaction_date,
    reference_number, external_reference, payee_payer_name, description,
    amount, vat_amount, currency, payment_method, status,
    reconciliation_status, created_by, updated_by
  ) VALUES (
    v_sp.company_id, v_sp.project_id, v_sp.bank_account_id, 'Payment', v_sp.payment_date,
    '', v_sp.external_reference, COALESCE(v_supplier.trading_name, v_supplier.legal_name),
    COALESCE(v_sp.notes, 'Supplier payment ' || v_sp.payment_reference),
    v_sp.amount_paid, 0.00, v_sp.currency, v_sp.payment_method, 'Draft',
    'Unreconciled', auth.uid(), auth.uid()
  ) RETURNING * INTO v_cbt;

  INSERT INTO public.cashbook_allocations (
    company_id, cashbook_transaction_id, allocation_type, target_id,
    amount_allocated, allocated_by, notes
  ) VALUES (
    v_sp.company_id, v_cbt.id, 'Supplier Payment', v_sp.id,
    v_sp.amount_paid, auth.uid(), 'Automatic link created while posting supplier payment'
  );

  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_cbt.id;
  PERFORM public.submit_cashbook_transaction(v_cbt.id, v_cb_version);
  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_cbt.id;
  PERFORM public.approve_cashbook_transaction(v_cbt.id, v_cb_version);
  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_cbt.id;
  PERFORM public.post_cashbook_transaction(v_cbt.id, v_cb_version);

  SELECT COUNT(*) INTO v_alloc_count
  FROM public.cashbook_allocations
  WHERE cashbook_transaction_id = v_cbt.id
    AND allocation_type = 'Supplier Payment'
    AND target_id = v_sp.id
    AND is_archived = false;
  IF v_alloc_count <> 1 THEN
    RAISE EXCEPTION 'Cashbook bridge validation failed for supplier payment %.', v_sp.id;
  END IF;

  UPDATE public.supplier_payments
  SET status = 'Posted',
      posted_by = auth.uid(),
      posted_at = now(),
      cashbook_transaction_id = v_cbt.id,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_payment_id
  RETURNING * INTO v_sp;

  RETURN to_jsonb(v_sp);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_supplier_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.supplier_payments%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank payment rejection reason is required.';
  END IF;

  v_payment := public.fn_lock_supplier_payment_context(p_payment_id);
  IF v_payment.status <> 'Submitted' THEN
    RAISE EXCEPTION 'Only a Submitted payment can be rejected.';
  END IF;

  UPDATE public.supplier_payments
  SET status = 'Rejected',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_reason = v_reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  RETURN to_jsonb(v_payment);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_supplier_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.supplier_payments%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank payment cancellation reason is required.';
  END IF;

  v_payment := public.fn_lock_supplier_payment_context(p_payment_id);
  IF v_payment.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
    RAISE EXCEPTION 'Payment can only be cancelled from Draft, Submitted or Approved status.';
  END IF;

  UPDATE public.supplier_payments
  SET status = 'Cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      cancellation_reason = v_reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  RETURN to_jsonb(v_payment);
END;
$$;

-- Payment reversal rule: reject reversal while any Active allocation exists.
CREATE OR REPLACE FUNCTION public.reverse_supplier_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.supplier_payments%ROWTYPE;
  v_supplier public.supplier_accounts%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_active_count integer;
  v_original_cashbook public.cashbook_transactions%ROWTYPE;
  v_reversal_cashbook public.cashbook_transactions%ROWTYPE;
  v_cb_version integer;
BEGIN
  IF v_reason IS NULL THEN RAISE EXCEPTION 'A nonblank payment reversal reason is required.'; END IF;

  v_payment := public.fn_lock_supplier_payment_context(p_payment_id);
  IF v_payment.status <> 'Posted' OR v_payment.is_archived THEN
    RAISE EXCEPTION 'Only a Posted, non-archived payment can be reversed.';
  END IF;
  IF v_payment.cashbook_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Supplier payment has no linked Cashbook transaction and cannot be reversed safely.';
  END IF;
  IF v_payment.cashbook_reversal_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Supplier payment already has a linked Cashbook reversal.';
  END IF;

  PERFORM 1 FROM public.supplier_payment_allocations
  WHERE supplier_payment_id = p_payment_id ORDER BY id FOR UPDATE;
  SELECT COUNT(*) INTO v_active_count
  FROM public.supplier_payment_allocations
  WHERE supplier_payment_id = p_payment_id AND status = 'Active';
  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Reverse Active payment allocations before reversing the payment.';
  END IF;

  SELECT * INTO v_original_cashbook
  FROM public.cashbook_transactions
  WHERE id = v_payment.cashbook_transaction_id
  FOR UPDATE;
  IF NOT FOUND OR v_original_cashbook.status NOT IN ('Posted','Reconciled') THEN
    RAISE EXCEPTION 'Linked Cashbook payment must be Posted or Reconciled before supplier reversal.';
  END IF;
  IF v_original_cashbook.reconciliation_status = 'Reconciled' THEN
    RAISE EXCEPTION 'A reconciled Cashbook payment cannot be reversed here. Undo the bank reconciliation first.';
  END IF;

  SELECT * INTO v_supplier FROM public.supplier_accounts WHERE id = v_payment.supplier_account_id;

  INSERT INTO public.cashbook_transactions (
    company_id, project_id, bank_account_id, transaction_type, transaction_date,
    reference_number, external_reference, payee_payer_name, description,
    amount, vat_amount, currency, payment_method, status,
    reconciliation_status, created_by, updated_by
  ) VALUES (
    v_payment.company_id, v_payment.project_id, v_payment.bank_account_id, 'Receipt', CURRENT_DATE,
    '', v_payment.payment_reference || '-REV', COALESCE(v_supplier.trading_name, v_supplier.legal_name),
    'Reversal of supplier payment ' || v_payment.payment_reference || ': ' || v_reason,
    v_payment.amount_paid, 0.00, v_payment.currency, v_payment.payment_method, 'Draft',
    'Unreconciled', auth.uid(), auth.uid()
  ) RETURNING * INTO v_reversal_cashbook;

  INSERT INTO public.cashbook_allocations (
    company_id, cashbook_transaction_id, allocation_type, target_id,
    amount_allocated, allocated_by, notes
  ) VALUES (
    v_payment.company_id, v_reversal_cashbook.id, 'Supplier Payment', v_payment.id,
    v_payment.amount_paid, auth.uid(), 'Automatic reversal link: ' || v_reason
  );

  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_reversal_cashbook.id;
  PERFORM public.submit_cashbook_transaction(v_reversal_cashbook.id, v_cb_version);
  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_reversal_cashbook.id;
  PERFORM public.approve_cashbook_transaction(v_reversal_cashbook.id, v_cb_version);
  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_reversal_cashbook.id;
  PERFORM public.post_cashbook_transaction(v_reversal_cashbook.id, v_cb_version);

  UPDATE public.supplier_payments
  SET status = 'Reversed',
      reversed_by = auth.uid(),
      reversed_at = now(),
      reversal_reason = v_reason,
      cashbook_reversal_transaction_id = v_reversal_cashbook.id,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  RETURN to_jsonb(v_payment);
END;
$$;

-- 5.5 PAYMENT ALLOCATION RPCS
CREATE OR REPLACE FUNCTION public.allocate_supplier_payment(
  p_payment_id uuid,
  p_invoice_id uuid,
  p_amount_allocated numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sp_lookup public.supplier_payments%ROWTYPE;
  v_inv_lookup public.supplier_invoices%ROWTYPE;
  v_sp public.supplier_payments%ROWTYPE;
  v_inv public.supplier_invoices%ROWTYPE;
  v_supp public.supplier_accounts%ROWTYPE;
  v_pay_unallocated numeric(15,2);
  v_inv_outstanding numeric(15,2);
  v_alloc public.supplier_payment_allocations%ROWTYPE;
BEGIN
  IF p_amount_allocated IS NULL OR p_amount_allocated <= 0 THEN
    RAISE EXCEPTION 'Allocation amount must be positive.';
  END IF;

  SELECT * INTO v_sp_lookup
  FROM public.supplier_payments
  WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found.', p_payment_id; END IF;

  SELECT * INTO v_inv_lookup
  FROM public.supplier_invoices
  WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_invoice_id; END IF;

  -- supplier -> invoice -> payment -> allocation
  SELECT * INTO v_supp
  FROM public.supplier_accounts
  WHERE id = v_sp_lookup.supplier_account_id
  FOR UPDATE;

  SELECT * INTO v_inv
  FROM public.supplier_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  SELECT * INTO v_sp
  FROM public.supplier_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  PERFORM 1
  FROM public.supplier_payment_allocations
  WHERE supplier_payment_id = p_payment_id
     OR supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;

  IF v_sp.supplier_account_id <> v_sp_lookup.supplier_account_id
     OR v_inv.supplier_account_id <> v_inv_lookup.supplier_account_id THEN
    RAISE EXCEPTION 'Payment or invoice context changed while locks were being acquired.';
  END IF;
  IF v_sp.company_id <> v_inv.company_id
     OR v_sp.project_id <> v_inv.project_id
     OR v_sp.supplier_account_id <> v_inv.supplier_account_id
     OR v_sp.currency <> v_inv.currency THEN
    RAISE EXCEPTION 'Payment and invoice company, project, supplier or currency context mismatch.';
  END IF;

  IF NOT public.has_finance_full_access(v_sp.company_id) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  IF v_supp.is_active IS NOT TRUE OR v_supp.is_archived IS TRUE THEN
    RAISE EXCEPTION 'Supplier account is inactive or archived.';
  END IF;
  IF v_supp.company_id <> v_sp.company_id
     OR v_supp.default_currency <> v_sp.currency THEN
    RAISE EXCEPTION 'Supplier context does not match payment and invoice.';
  END IF;

  IF v_sp.status <> 'Posted' OR v_sp.is_archived THEN RAISE EXCEPTION 'Payment must be Posted and non-archived.'; END IF;
  IF v_inv.status <> 'Posted' OR v_inv.is_archived THEN RAISE EXCEPTION 'Invoice must be Posted and non-archived.'; END IF;

  SELECT
    v_sp.amount_paid - COALESCE(SUM(amount_allocated), 0.00)
  INTO v_pay_unallocated
  FROM public.supplier_payment_allocations
  WHERE supplier_payment_id = p_payment_id
    AND status = 'Active';

  IF round(p_amount_allocated, 2) > round(v_pay_unallocated, 2) THEN
    RAISE EXCEPTION 'Allocation amount % exceeds unallocated payment balance %.', p_amount_allocated, v_pay_unallocated;
  END IF;

  SELECT v_inv.total_incl_vat
    - COALESCE((SELECT SUM(total_incl_vat) FROM public.supplier_credit_notes WHERE invoice_id = p_invoice_id AND status = 'Posted'), 0.00)
    - COALESCE((SELECT SUM(amount_allocated) FROM public.supplier_payment_allocations WHERE supplier_invoice_id = p_invoice_id AND status = 'Active'), 0.00)
  INTO v_inv_outstanding;

  IF round(p_amount_allocated, 2) > round(v_inv_outstanding, 2) THEN
    RAISE EXCEPTION 'Allocation amount % exceeds outstanding invoice balance %.', p_amount_allocated, v_inv_outstanding;
  END IF;

  INSERT INTO public.supplier_payment_allocations (
    company_id, project_id, supplier_account_id, supplier_payment_id, supplier_invoice_id, currency, amount_allocated, status, allocated_by, allocated_at, created_by, created_at, updated_by, updated_at
  ) VALUES (
    v_sp.company_id, v_sp.project_id, v_sp.supplier_account_id, p_payment_id, p_invoice_id, v_sp.currency, round(p_amount_allocated, 2), 'Active', auth.uid(), now(), auth.uid(), now(), auth.uid(), now()
  ) RETURNING * INTO v_alloc;

  RETURN to_jsonb(v_alloc);
END;
$$;


CREATE OR REPLACE FUNCTION public.reverse_supplier_payment_allocation(
  p_allocation_id uuid,
  p_reversal_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lookup public.supplier_payment_allocations%ROWTYPE;
  v_alloc public.supplier_payment_allocations%ROWTYPE;
  v_supplier public.supplier_accounts%ROWTYPE;
  v_invoice public.supplier_invoices%ROWTYPE;
  v_payment public.supplier_payments%ROWTYPE;
  v_reason text := btrim(p_reversal_reason);
BEGIN
  IF v_reason IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION 'Reversal reason is required.';
  END IF;

  SELECT * INTO v_lookup
  FROM public.supplier_payment_allocations
  WHERE id = p_allocation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Allocation % not found.', p_allocation_id; END IF;

  SELECT * INTO v_supplier
  FROM public.supplier_accounts
  WHERE id = v_lookup.supplier_account_id
  FOR UPDATE;

  SELECT * INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = v_lookup.supplier_invoice_id
  FOR UPDATE;

  SELECT * INTO v_payment
  FROM public.supplier_payments
  WHERE id = v_lookup.supplier_payment_id
  FOR UPDATE;

  SELECT * INTO v_alloc
  FROM public.supplier_payment_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT public.has_finance_full_access(v_alloc.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;
  IF v_alloc.status <> 'Active' THEN
    RAISE EXCEPTION 'Only an Active allocation can be reversed.';
  END IF;
  IF v_alloc.supplier_account_id <> v_lookup.supplier_account_id
     OR v_alloc.supplier_invoice_id <> v_lookup.supplier_invoice_id
     OR v_alloc.supplier_payment_id <> v_lookup.supplier_payment_id THEN
    RAISE EXCEPTION 'Allocation context changed while locks were being acquired.';
  END IF;
  IF v_supplier.is_active IS NOT TRUE
     OR v_supplier.is_archived IS TRUE
     OR v_supplier.company_id <> v_alloc.company_id
     OR v_supplier.default_currency <> v_alloc.currency THEN
    RAISE EXCEPTION 'Supplier is inactive, archived or has incompatible allocation context.';
  END IF;
  IF v_invoice.status <> 'Posted'
     OR v_invoice.is_archived
     OR v_payment.status <> 'Posted'
     OR v_payment.is_archived
     OR v_invoice.company_id <> v_alloc.company_id
     OR v_invoice.project_id <> v_alloc.project_id
     OR v_invoice.supplier_account_id <> v_alloc.supplier_account_id
     OR v_invoice.currency <> v_alloc.currency
     OR v_payment.company_id <> v_alloc.company_id
     OR v_payment.project_id <> v_alloc.project_id
     OR v_payment.supplier_account_id <> v_alloc.supplier_account_id
     OR v_payment.currency <> v_alloc.currency THEN
    RAISE EXCEPTION 'Allocation parent context is invalid for reversal.';
  END IF;

  UPDATE public.supplier_payment_allocations
  SET status = 'Reversed', reversed_by = auth.uid(), reversed_at = now(), reversal_reason = v_reason, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_allocation_id RETURNING * INTO v_alloc;

  RETURN to_jsonb(v_alloc);
END;
$$;


-- 5.6 COST POSTING REVERSAL RPC WITH SCN PROTECTION
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
  v_clean_reason text := btrim(p_reversal_reason);
BEGIN
  IF v_clean_reason IS NULL OR v_clean_reason = '' THEN
    RAISE EXCEPTION 'A non-blank reversal reason must be provided.';
  END IF;

  SELECT * INTO v_orig FROM public.financial_cost_postings WHERE id = p_cost_posting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cost posting % not found.', p_cost_posting_id; END IF;
  IF v_orig.is_archived THEN RAISE EXCEPTION 'Cannot reverse an archived cost posting.'; END IF;
  IF NOT public.has_finance_full_access(v_orig.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;
  IF v_orig.status <> 'Posted' THEN RAISE EXCEPTION 'Cost posting must be in Posted status to reverse.'; END IF;
  IF v_orig.entry_type <> 'Cost' THEN RAISE EXCEPTION 'Only primary Cost postings can be reversed.'; END IF;

  IF v_orig.source_type = 'Supplier Credit Note' THEN
    RAISE EXCEPTION 'Reversal of Supplier Credit Note cost postings via this function is prohibited.';
  END IF;

  UPDATE public.financial_cost_postings
  SET status = 'Reversed', reversed_by = auth.uid(), reversed_at = now(), reversal_reason = v_clean_reason, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_cost_posting_id;

  INSERT INTO public.financial_cost_postings (
    company_id, project_id, posting_reference, posting_date, source_type, source_record_id, source_reference, commitment_id, cost_category, description, entry_type, amount_excl_vat, reversal_of_id, notes, currency_code, status, posted_by, posted_at, reversal_reason, is_archived, created_by, created_at, updated_by, updated_at
  ) VALUES (
    v_orig.company_id, v_orig.project_id, v_orig.posting_reference || '-REV', CURRENT_DATE, v_orig.source_type, v_orig.source_record_id, v_orig.source_reference, v_orig.commitment_id, v_orig.cost_category, 'Reversal of ' || v_orig.posting_reference || ': ' || v_clean_reason, 'Reversal', -1 * ABS(v_orig.amount_excl_vat), v_orig.id, v_orig.notes, v_orig.currency_code, 'Posted', auth.uid(), now(), v_clean_reason, false, auth.uid(), now(), auth.uid(), now()
  ) RETURNING * INTO v_rev;

  RETURN to_jsonb(v_rev);
END;
$$;


-- ----------------------------------------------------------------------------
-- SECTION 6: COMMITMENT COORDINATION EXTENSIONS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_financial_commitment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lookup public.financial_commitments%ROWTYPE;
  v_rec public.financial_commitments%ROWTYPE;
  v_cnt integer;
BEGIN
  SELECT * INTO v_lookup
  FROM public.financial_commitments
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Financial commitment % not found.', p_id; END IF;

  IF v_lookup.supplier_account_id IS NOT NULL THEN
    PERFORM 1
    FROM public.supplier_accounts
    WHERE id = v_lookup.supplier_account_id
    FOR UPDATE;
  END IF;

  SELECT * INTO v_rec
  FROM public.financial_commitments
  WHERE id = p_id
  FOR UPDATE;
  IF v_rec.supplier_account_id IS DISTINCT FROM v_lookup.supplier_account_id THEN
    RAISE EXCEPTION 'Commitment supplier context changed while locks were being acquired.';
  END IF;

  PERFORM 1
  FROM public.supplier_invoices
  WHERE financial_commitment_id = p_id
  ORDER BY id
  FOR UPDATE;

  IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot close an archived financial commitment.'; END IF;
  IF NOT public.has_finance_full_access(v_rec.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;
  IF v_rec.status <> 'Approved' THEN RAISE EXCEPTION 'Commitment must be in Approved status to close.'; END IF;

  -- Check open supplier invoices on this commitment
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices
  WHERE financial_commitment_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;

  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'Cannot close commitment with open supplier invoices.';
  END IF;

  UPDATE public.financial_commitments
  SET status = 'Closed', closed_by = auth.uid(), closed_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_id RETURNING * INTO v_rec;

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
  v_lookup public.financial_commitments%ROWTYPE;
  v_rec public.financial_commitments%ROWTYPE;
  v_clean_reason text := btrim(p_reason);
  v_cnt integer;
BEGIN
  IF v_clean_reason IS NULL OR v_clean_reason = '' THEN
    RAISE EXCEPTION 'A non-blank cancellation reason must be provided.';
  END IF;

  SELECT * INTO v_lookup
  FROM public.financial_commitments
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Financial commitment % not found.', p_id; END IF;

  IF v_lookup.supplier_account_id IS NOT NULL THEN
    PERFORM 1
    FROM public.supplier_accounts
    WHERE id = v_lookup.supplier_account_id
    FOR UPDATE;
  END IF;

  SELECT * INTO v_rec
  FROM public.financial_commitments
  WHERE id = p_id
  FOR UPDATE;
  IF v_rec.supplier_account_id IS DISTINCT FROM v_lookup.supplier_account_id THEN
    RAISE EXCEPTION 'Commitment supplier context changed while locks were being acquired.';
  END IF;

  PERFORM 1
  FROM public.supplier_invoices
  WHERE financial_commitment_id = p_id
  ORDER BY id
  FOR UPDATE;

  IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel an archived financial commitment.'; END IF;
  IF NOT public.has_finance_full_access(v_rec.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;
  IF v_rec.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
    RAISE EXCEPTION 'Commitment can only be cancelled from Draft, Submitted or Approved status.';
  END IF;

  -- Check open supplier invoices on this commitment
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices
  WHERE financial_commitment_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;

  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'Cannot cancel commitment with open supplier invoices.';
  END IF;

  UPDATE public.financial_commitments
  SET status = 'Cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancellation_reason = v_clean_reason, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_id RETURNING * INTO v_rec;

  RETURN to_jsonb(v_rec);
END;
$$;


-- ----------------------------------------------------------------------------
-- SECTION 7: PAYABLES AGEING REPORT
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_supplier_payables_ageing(
  p_company_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  supplier_account_id uuid,
  supplier_code text,
  legal_name text,
  current_amount numeric,
  days_1_30 numeric,
  days_31_60 numeric,
  days_61_90 numeric,
  days_90_plus numeric,
  total_outstanding numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff_tz timestamptz;
BEGIN
  IF NOT public.has_finance_full_access(p_company_id) THEN
    RAISE EXCEPTION 'Access denied for company %.', p_company_id;
  END IF;

  -- Exclusive next-day Africa/Johannesburg cutoff timestamp
  v_cutoff_tz := ((p_as_of_date + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg');

  RETURN QUERY
  WITH valid_suppliers AS (
    SELECT sa.id, sa.supplier_code, sa.legal_name
    FROM public.supplier_accounts sa
    WHERE sa.company_id = p_company_id
      AND sa.created_at < v_cutoff_tz
  ),
  invoice_balances AS (
    SELECT
      si.supplier_account_id,
      si.id AS invoice_id,
      si.due_date,
      si.total_incl_vat
        - COALESCE((
            SELECT SUM(scn.total_incl_vat)
            FROM public.supplier_credit_notes scn
            WHERE scn.invoice_id = si.id
              AND scn.posted_at IS NOT NULL AND scn.posted_at < v_cutoff_tz
          ), 0.00)
        - COALESCE((
            SELECT SUM(spa.amount_allocated)
            FROM public.supplier_payment_allocations spa
            WHERE spa.supplier_invoice_id = si.id
              AND spa.allocated_at < v_cutoff_tz
              AND (spa.reversed_at IS NULL OR spa.reversed_at >= v_cutoff_tz)
          ), 0.00) AS net_outstanding
    FROM public.supplier_invoices si
    WHERE si.company_id = p_company_id
      AND si.posted_at IS NOT NULL AND si.posted_at < v_cutoff_tz
  )
  SELECT
    vs.id AS supplier_account_id,
    vs.supplier_code,
    vs.legal_name,
    COALESCE(SUM(CASE WHEN (p_as_of_date - ib.due_date) <= 0 THEN ib.net_outstanding ELSE 0.00 END), 0.00) AS current_amount,
    COALESCE(SUM(CASE WHEN (p_as_of_date - ib.due_date) BETWEEN 1 AND 30 THEN ib.net_outstanding ELSE 0.00 END), 0.00) AS days_1_30,
    COALESCE(SUM(CASE WHEN (p_as_of_date - ib.due_date) BETWEEN 31 AND 60 THEN ib.net_outstanding ELSE 0.00 END), 0.00) AS days_31_60,
    COALESCE(SUM(CASE WHEN (p_as_of_date - ib.due_date) BETWEEN 61 AND 90 THEN ib.net_outstanding ELSE 0.00 END), 0.00) AS days_61_90,
    COALESCE(SUM(CASE WHEN (p_as_of_date - ib.due_date) > 90 THEN ib.net_outstanding ELSE 0.00 END), 0.00) AS days_90_plus,
    COALESCE(SUM(ib.net_outstanding), 0.00) AS total_outstanding
  FROM valid_suppliers vs
  LEFT JOIN invoice_balances ib ON ib.supplier_account_id = vs.id AND ib.net_outstanding > 0
  GROUP BY vs.id, vs.supplier_code, vs.legal_name
  ORDER BY vs.supplier_code;
END;
$$;


-- ----------------------------------------------------------------------------
-- SECTION 7.1: OPTIMISTIC-CONCURRENCY USER-FACING WRAPPERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_assert_supplier_version(
  p_table text,
  p_id uuid,
  p_expected_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current integer;
  v_company uuid;
BEGIN
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Expected version is required.';
  END IF;
  IF p_table NOT IN ('supplier_accounts','supplier_invoices','supplier_credit_notes','supplier_payments','supplier_payment_allocations') THEN
    RAISE EXCEPTION 'Unsupported supplier version table %.', p_table;
  END IF;
  EXECUTE format('SELECT version, company_id FROM public.%I WHERE id = $1 FOR UPDATE', p_table)
    INTO v_current, v_company USING p_id;
  IF v_current IS NULL THEN RAISE EXCEPTION 'Record % not found in %.', p_id, p_table; END IF;
  IF NOT public.has_finance_full_access(v_company) THEN RAISE EXCEPTION 'Access denied.'; END IF;
  IF v_current <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for %. Expected version %, current version %.', p_table, p_expected_version, v_current;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_supplier_account(p_supplier_account_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN PERFORM public.fn_assert_supplier_version('supplier_accounts',p_supplier_account_id,p_expected_version); RETURN public.activate_supplier_account(p_supplier_account_id); END; $$;
CREATE OR REPLACE FUNCTION public.deactivate_supplier_account(p_supplier_account_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN PERFORM public.fn_assert_supplier_version('supplier_accounts',p_supplier_account_id,p_expected_version); RETURN public.deactivate_supplier_account(p_supplier_account_id,p_reason); END; $$;

CREATE OR REPLACE FUNCTION public.submit_supplier_invoice(p_invoice_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_invoices',p_invoice_id,p_expected_version); RETURN public.submit_supplier_invoice(p_invoice_id); END; $$;
CREATE OR REPLACE FUNCTION public.approve_supplier_invoice(p_invoice_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_invoices',p_invoice_id,p_expected_version); RETURN public.approve_supplier_invoice(p_invoice_id); END; $$;
CREATE OR REPLACE FUNCTION public.post_supplier_invoice(p_invoice_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_invoices',p_invoice_id,p_expected_version); RETURN public.post_supplier_invoice(p_invoice_id); END; $$;
CREATE OR REPLACE FUNCTION public.reject_supplier_invoice(p_invoice_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_invoices',p_invoice_id,p_expected_version); RETURN public.reject_supplier_invoice(p_invoice_id,p_reason); END; $$;
CREATE OR REPLACE FUNCTION public.cancel_supplier_invoice(p_invoice_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_invoices',p_invoice_id,p_expected_version); RETURN public.cancel_supplier_invoice(p_invoice_id,p_reason); END; $$;

CREATE OR REPLACE FUNCTION public.submit_supplier_credit_note(p_credit_note_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_credit_notes',p_credit_note_id,p_expected_version); RETURN public.submit_supplier_credit_note(p_credit_note_id); END; $$;
CREATE OR REPLACE FUNCTION public.approve_supplier_credit_note(p_credit_note_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_credit_notes',p_credit_note_id,p_expected_version); RETURN public.approve_supplier_credit_note(p_credit_note_id); END; $$;
CREATE OR REPLACE FUNCTION public.post_supplier_credit_note(p_credit_note_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_credit_notes',p_credit_note_id,p_expected_version); RETURN public.post_supplier_credit_note(p_credit_note_id); END; $$;
CREATE OR REPLACE FUNCTION public.reject_supplier_credit_note(p_credit_note_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_credit_notes',p_credit_note_id,p_expected_version); RETURN public.reject_supplier_credit_note(p_credit_note_id,p_reason); END; $$;
CREATE OR REPLACE FUNCTION public.cancel_supplier_credit_note(p_credit_note_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_credit_notes',p_credit_note_id,p_expected_version); RETURN public.cancel_supplier_credit_note(p_credit_note_id,p_reason); END; $$;

CREATE OR REPLACE FUNCTION public.submit_supplier_payment(p_payment_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_payments',p_payment_id,p_expected_version); RETURN public.submit_supplier_payment(p_payment_id); END; $$;
CREATE OR REPLACE FUNCTION public.approve_supplier_payment(p_payment_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_payments',p_payment_id,p_expected_version); RETURN public.approve_supplier_payment(p_payment_id); END; $$;
CREATE OR REPLACE FUNCTION public.post_supplier_payment(p_payment_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_payments',p_payment_id,p_expected_version); RETURN public.post_supplier_payment(p_payment_id); END; $$;
CREATE OR REPLACE FUNCTION public.reject_supplier_payment(p_payment_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_payments',p_payment_id,p_expected_version); RETURN public.reject_supplier_payment(p_payment_id,p_reason); END; $$;
CREATE OR REPLACE FUNCTION public.cancel_supplier_payment(p_payment_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_payments',p_payment_id,p_expected_version); RETURN public.cancel_supplier_payment(p_payment_id,p_reason); END; $$;
CREATE OR REPLACE FUNCTION public.reverse_supplier_payment(p_payment_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_payments',p_payment_id,p_expected_version); RETURN public.reverse_supplier_payment(p_payment_id,p_reason); END; $$;

CREATE OR REPLACE FUNCTION public.reverse_supplier_payment_allocation(p_allocation_id uuid, p_reversal_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN PERFORM public.fn_assert_supplier_version('supplier_payment_allocations',p_allocation_id,p_expected_version); RETURN public.reverse_supplier_payment_allocation(p_allocation_id,p_reversal_reason); END; $$;

-- ----------------------------------------------------------------------------
-- SECTION 8: FUNCTION REVOKE & GRANT SUMMARY
-- ----------------------------------------------------------------------------

-- REVOKE ALL EXECUTION ON ALL FUNCTIONS FROM PUBLIC, ANON, AUTHENTICATED
REVOKE ALL ON FUNCTION public.fn_audit_supplier_accounts_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_supplier_bump_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_assert_supplier_version(text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_supplier_accounts_header() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_supplier_invoices_header() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sil_before_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sil_after_reconcile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_supplier_credit_notes_header() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_scnl_before_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_scnl_after_reconcile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_supplier_payments_header() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_supplier_payment_allocations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_finance_metadata_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_calculate_finance_totals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_finance_audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_guard_budget_lines_draft() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_budget_version_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_commitment_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_cost_posting_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_forecast_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_validate_commitment_procurement_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_commitment_supplier_association() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_protect_supplier_cost_source_links() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_lock_supplier_invoice_context(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_assert_supplier_invoice_capacity(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_lock_supplier_credit_note_context(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_assert_supplier_credit_capacity(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_lock_supplier_payment_context(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.archive_finance_record(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_finance_record(text, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.activate_supplier_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deactivate_supplier_account(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.associate_commitment_supplier(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_supplier_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_supplier_invoice(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_supplier_invoice(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_supplier_invoice(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_credit_note(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_supplier_credit_note(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_supplier_credit_note(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_supplier_credit_note(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_supplier_credit_note(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_payment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_supplier_payment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_supplier_payment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_supplier_payment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_supplier_payment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_supplier_payment(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.allocate_supplier_payment(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_supplier_payment_allocation(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_financial_cost_posting(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.close_financial_commitment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_financial_commitment(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_supplier_payables_ageing(uuid, date) FROM PUBLIC, anon, authenticated;



REVOKE ALL ON FUNCTION public.activate_supplier_account(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deactivate_supplier_account(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_supplier_invoice(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_supplier_invoice(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_supplier_invoice(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_supplier_invoice(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_supplier_invoice(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_supplier_credit_note(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_supplier_credit_note(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_supplier_credit_note(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_supplier_credit_note(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_supplier_credit_note(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_supplier_payment(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_supplier_payment(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_supplier_payment(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_supplier_payment(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_supplier_payment(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_supplier_payment(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_supplier_payment_allocation(uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- GRANT EXECUTE ONLY ON INTENDED USER-FACING RPCS TO AUTHENTICATED
GRANT EXECUTE ON FUNCTION public.archive_finance_record(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_finance_record(text, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.associate_commitment_supplier(uuid, uuid) TO authenticated;




GRANT EXECUTE ON FUNCTION public.allocate_supplier_payment(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_financial_cost_posting(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.close_financial_commitment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_financial_commitment(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_supplier_payables_ageing(uuid, date) TO authenticated;

GRANT EXECUTE ON FUNCTION public.activate_supplier_account(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_supplier_account(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_supplier_invoice(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_supplier_invoice(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_supplier_invoice(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_supplier_invoice(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_invoice(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_supplier_credit_note(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_supplier_credit_note(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_supplier_credit_note(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_supplier_credit_note(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_credit_note(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_supplier_payment(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_supplier_payment(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_supplier_payment(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_supplier_payment(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_payment(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_supplier_payment(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_supplier_payment_allocation(uuid, text, integer) TO authenticated;

COMMIT;
