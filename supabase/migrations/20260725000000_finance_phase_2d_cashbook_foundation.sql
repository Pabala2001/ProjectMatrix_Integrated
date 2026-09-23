-- Migration: 20260725000000_finance_phase_2d_cashbook_foundation.sql
-- Description: Cashbook, Bank Reconciliation and Attachment Metadata database foundation for ProjectMatrix (Phase 2D).
-- Covers: Bank accounts, cashbook transactions, transaction allocations, statement imports, statement lines,
--         reconciliation sessions, reconciliation matches, transaction numbering sequences, attachment metadata,
--         audit logs, trigger functions for updated_at/versioning, RPC lifecycle functions, and least-privilege RLS policies.

BEGIN;

-- ============================================================================
-- 0. PREREQUISITE & DEPENDENCY CHECKS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
    WHERE pg_proc.proname = 'has_finance_full_access' AND pg_namespace.nspname = 'public'
  ) THEN
    RAISE EXCEPTION 'Prerequisite function public.has_finance_full_access(uuid) does not exist. Please apply previous finance foundation migrations first.';
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
END $$;

-- ============================================================================
-- 1. UTILITY TRIGGERS & NUMBERING SEQUENCES
-- ============================================================================

-- Reusable trigger function for auto-updating updated_at and incrementing version
CREATE OR REPLACE FUNCTION public.fn_set_updated_at_and_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_OP = 'UPDATE' THEN
    BEGIN
      NEW.version = OLD.version + 1;
    EXCEPTION WHEN undefined_column THEN
      -- Safety fallback in case table has no version column
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Table for sequence-based transaction numbering
CREATE TABLE IF NOT EXISTS public.cashbook_sequences (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  prefix text NOT NULL,
  year integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, prefix, year)
);

-- Function to safely generate unique transaction reference numbers (Concurrency-Safe)
CREATE OR REPLACE FUNCTION public.generate_cashbook_transaction_number(
  p_company_id uuid,
  p_transaction_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prefix text;
  v_year integer;
  v_next_val integer;
  v_ref text;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  
  CASE p_transaction_type
    WHEN 'Receipt' THEN v_prefix := 'REC';
    WHEN 'Payment' THEN v_prefix := 'PAY';
    WHEN 'Transfer In' THEN v_prefix := 'TRF';
    WHEN 'Transfer Out' THEN v_prefix := 'TRF';
    ELSE v_prefix := 'CBX';
  END CASE;

  -- Acquire transaction-level advisory lock to serialize sequence increments per company/prefix/year
  PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::text || '-' || v_prefix || '-' || v_year::text, 0));

  INSERT INTO public.cashbook_sequences (company_id, prefix, year, last_value, updated_at)
  VALUES (p_company_id, v_prefix, v_year, 1, now())
  ON CONFLICT (company_id, prefix, year)
  DO UPDATE SET
    last_value = public.cashbook_sequences.last_value + 1,
    updated_at = now()
  RETURNING last_value INTO v_next_val;

  v_ref := v_prefix || '-' || v_year::text || '-' || LPAD(v_next_val::text, 6, '0');
  RETURN v_ref;
END;
$$;

-- Trigger function for automatic numbering on insert
CREATE OR REPLACE FUNCTION public.fn_auto_number_cashbook_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.reference_number IS NULL OR TRIM(NEW.reference_number) = '' THEN
    NEW.reference_number := public.generate_cashbook_transaction_number(NEW.company_id, NEW.transaction_type);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. TABLES & CONSTRAINTS
-- ============================================================================

-- Table 1: bank_accounts
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  account_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'Bank' CHECK (account_type IN ('Bank', 'Petty Cash', 'Credit Card', 'Investment', 'Other')),
  bank_name text,
  account_number text,
  branch_code text,
  swift_bic text,
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  opening_balance numeric(15,2) NOT NULL DEFAULT 0.00,
  opening_balance_date date NOT NULL DEFAULT CURRENT_DATE,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_bank_accounts_comp UNIQUE (id, company_id),
  CONSTRAINT uq_bank_account_num_per_comp UNIQUE (company_id, account_number)
);

-- Table 2: cashbook_transactions
CREATE TABLE IF NOT EXISTS public.cashbook_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  project_id uuid,
  bank_account_id uuid NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('Receipt', 'Payment', 'Transfer In', 'Transfer Out')),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_number text NOT NULL,
  external_reference text,
  payee_payer_name text,
  description text NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  vat_amount numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (vat_amount >= 0),
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  payment_method text NOT NULL DEFAULT 'EFT' CHECK (payment_method IN ('EFT', 'Cheque', 'Credit Card', 'Cash', 'Direct Debit', 'Other')),
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Posted', 'Reconciled', 'Cancelled', 'Reversed')),
  reconciliation_status text NOT NULL DEFAULT 'Unreconciled' CHECK (reconciliation_status IN ('Unreconciled', 'Matched', 'Reconciled')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  posted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  cancellation_reason text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_cbt_bank_account FOREIGN KEY (bank_account_id, company_id) REFERENCES public.bank_accounts(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_cbt_project FOREIGN KEY (project_id, company_id) REFERENCES public.projects(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT uq_cashbook_tx_comp UNIQUE (id, company_id)
);

-- Partial Unique Index to ensure reference uniqueness per bank account per company among active records
CREATE UNIQUE INDEX IF NOT EXISTS uq_cbt_comp_acc_ref
ON public.cashbook_transactions(company_id, bank_account_id, reference_number)
WHERE is_archived = false AND status <> 'Cancelled';

-- Table 3: cashbook_allocations
CREATE TABLE IF NOT EXISTS public.cashbook_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  cashbook_transaction_id uuid NOT NULL,
  allocation_type text NOT NULL CHECK (allocation_type IN ('Client Receipt', 'Supplier Payment', 'Financial Cost Posting', 'General Ledger')),
  target_id uuid NOT NULL,
  amount_allocated numeric(15,2) NOT NULL CHECK (amount_allocated > 0),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  allocated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_cba_transaction FOREIGN KEY (cashbook_transaction_id, company_id) REFERENCES public.cashbook_transactions(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT uq_cashbook_alloc_comp UNIQUE (id, company_id)
);

-- Table 4: bank_statement_imports
CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL,
  filename text NOT NULL,
  file_format text NOT NULL DEFAULT 'CSV' CHECK (file_format IN ('OFX', 'CSV', 'QBO', 'MT940', 'PDF', 'Manual')),
  statement_identifier text,
  import_date timestamptz NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  period_start date,
  period_end date,
  opening_balance numeric(15,2),
  closing_balance numeric(15,2),
  total_lines_imported integer NOT NULL DEFAULT 0 CHECK (total_lines_imported >= 0),
  status text NOT NULL DEFAULT 'Uploaded' CHECK (status IN ('Uploaded', 'Processing', 'Completed', 'Error', 'Cancelled')),
  notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_bsi_bank_account FOREIGN KEY (bank_account_id, company_id) REFERENCES public.bank_accounts(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT uq_bank_stmt_import_comp UNIQUE (id, company_id),
  CONSTRAINT uq_bsi_account_filename UNIQUE (company_id, bank_account_id, filename, period_start, period_end)
);

-- Table 5: bank_statement_lines
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  import_id uuid NOT NULL,
  bank_account_id uuid NOT NULL,
  line_number integer NOT NULL CHECK (line_number > 0),
  transaction_date date NOT NULL,
  value_date date,
  bank_reference text,
  description text NOT NULL,
  amount numeric(15,2) NOT NULL,
  balance_after numeric(15,2),
  match_status text NOT NULL DEFAULT 'Unmatched' CHECK (match_status IN ('Unmatched', 'Partially Matched', 'Matched', 'Ignored')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_bsl_import FOREIGN KEY (import_id, company_id) REFERENCES public.bank_statement_imports(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_bsl_bank_account FOREIGN KEY (bank_account_id, company_id) REFERENCES public.bank_accounts(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT uq_bank_stmt_line_comp UNIQUE (id, company_id),
  CONSTRAINT uq_import_line_number UNIQUE (import_id, line_number)
);

-- Table 6: bank_reconciliation_sessions
CREATE TABLE IF NOT EXISTS public.bank_reconciliation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL,
  statement_end_date date NOT NULL,
  statement_ending_balance numeric(15,2) NOT NULL,
  cleared_deposits_count integer NOT NULL DEFAULT 0 CHECK (cleared_deposits_count >= 0),
  cleared_deposits_sum numeric(15,2) NOT NULL DEFAULT 0.00,
  cleared_withdrawals_count integer NOT NULL DEFAULT 0 CHECK (cleared_withdrawals_count >= 0),
  cleared_withdrawals_sum numeric(15,2) NOT NULL DEFAULT 0.00,
  calculated_balance numeric(15,2) NOT NULL DEFAULT 0.00,
  difference_amount numeric(15,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'Cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  started_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_brs_bank_account FOREIGN KEY (bank_account_id, company_id) REFERENCES public.bank_accounts(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT uq_bank_recon_sess_comp UNIQUE (id, company_id)
);

-- Table 7: bank_reconciliation_matches
CREATE TABLE IF NOT EXISTS public.bank_reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  reconciliation_session_id uuid NOT NULL,
  statement_line_id uuid NOT NULL,
  cashbook_transaction_id uuid NOT NULL,
  matched_amount numeric(15,2) NOT NULL CHECK (matched_amount > 0),
  match_type text NOT NULL DEFAULT 'Exact' CHECK (match_type IN ('Exact', 'Rule Based', 'Manual', 'Split')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  matched_at timestamptz NOT NULL DEFAULT now(),
  matched_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_brm_session FOREIGN KEY (reconciliation_session_id, company_id) REFERENCES public.bank_reconciliation_sessions(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_brm_stmt_line FOREIGN KEY (statement_line_id, company_id) REFERENCES public.bank_statement_lines(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT fk_brm_cashbook_tx FOREIGN KEY (cashbook_transaction_id, company_id) REFERENCES public.cashbook_transactions(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT uq_bank_recon_match_comp UNIQUE (id, company_id),
  CONSTRAINT uq_brm_line_tx UNIQUE (statement_line_id, cashbook_transaction_id)
);

-- Table 8: cashbook_attachments
CREATE TABLE IF NOT EXISTS public.cashbook_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  record_type text NOT NULL CHECK (record_type IN ('cashbook_transaction', 'bank_statement_import', 'reconciliation_session')),
  record_id uuid NOT NULL,
  document_category text NOT NULL DEFAULT 'Other'
    CHECK (document_category IN ('Proof of Payment', 'Invoice', 'Deposit Slip', 'Bank Confirmation', 'Statement', 'Other')),
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
  CONSTRAINT uq_cb_attach_comp UNIQUE (id, company_id)
);

-- Table 9: cashbook_audit_log
CREATE TABLE IF NOT EXISTS public.cashbook_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  performed_at timestamptz NOT NULL DEFAULT now(),
  details jsonb
);

-- Idempotent Trigger Creations
DROP TRIGGER IF EXISTS trg_ba_updated_at ON public.bank_accounts;
CREATE TRIGGER trg_ba_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_cbt_updated_at ON public.cashbook_transactions;
CREATE TRIGGER trg_cbt_updated_at BEFORE UPDATE ON public.cashbook_transactions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_cba_updated_at ON public.cashbook_allocations;
CREATE TRIGGER trg_cba_updated_at BEFORE UPDATE ON public.cashbook_allocations FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_bsi_updated_at ON public.bank_statement_imports;
CREATE TRIGGER trg_bsi_updated_at BEFORE UPDATE ON public.bank_statement_imports FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_bsl_updated_at ON public.bank_statement_lines;
CREATE TRIGGER trg_bsl_updated_at BEFORE UPDATE ON public.bank_statement_lines FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_brs_updated_at ON public.bank_reconciliation_sessions;
CREATE TRIGGER trg_brs_updated_at BEFORE UPDATE ON public.bank_reconciliation_sessions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_brm_updated_at ON public.bank_reconciliation_matches;
CREATE TRIGGER trg_brm_updated_at BEFORE UPDATE ON public.bank_reconciliation_matches FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_cb_attach_updated_at ON public.cashbook_attachments;
CREATE TRIGGER trg_cb_attach_updated_at BEFORE UPDATE ON public.cashbook_attachments FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_and_version();

DROP TRIGGER IF EXISTS trg_cbt_auto_number ON public.cashbook_transactions;
CREATE TRIGGER trg_cbt_auto_number BEFORE INSERT ON public.cashbook_transactions FOR EACH ROW EXECUTE FUNCTION public.fn_auto_number_cashbook_transaction();

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ba_company ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_cbt_company_account ON public.cashbook_transactions(company_id, bank_account_id);
CREATE INDEX IF NOT EXISTS idx_cbt_company_project ON public.cashbook_transactions(company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_cbt_status ON public.cashbook_transactions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_cbt_date ON public.cashbook_transactions(company_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_cba_tx ON public.cashbook_allocations(company_id, cashbook_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bsi_company_account ON public.bank_statement_imports(company_id, bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bsl_import ON public.bank_statement_lines(company_id, import_id);
CREATE INDEX IF NOT EXISTS idx_bsl_account_status ON public.bank_statement_lines(company_id, bank_account_id, match_status);
CREATE INDEX IF NOT EXISTS idx_brs_account ON public.bank_reconciliation_sessions(company_id, bank_account_id, status);
CREATE INDEX IF NOT EXISTS idx_brm_session ON public.bank_reconciliation_matches(company_id, reconciliation_session_id);
CREATE INDEX IF NOT EXISTS idx_cba_record ON public.cashbook_attachments(company_id, record_type, record_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cashbook_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cashbook_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_allocations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_imports FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bank_reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bank_reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_matches FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cashbook_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_attachments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cashbook_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_audit_log FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cashbook_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_sequences FORCE ROW LEVEL SECURITY;

-- Idempotent Policy Creation
DROP POLICY IF EXISTS rls_ba_all ON public.bank_accounts;
CREATE POLICY rls_ba_all ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_cbt_all ON public.cashbook_transactions;
CREATE POLICY rls_cbt_all ON public.cashbook_transactions FOR ALL TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_cba_all ON public.cashbook_allocations;
CREATE POLICY rls_cba_all ON public.cashbook_allocations FOR ALL TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_bsi_all ON public.bank_statement_imports;
CREATE POLICY rls_bsi_all ON public.bank_statement_imports FOR ALL TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_bsl_all ON public.bank_statement_lines;
CREATE POLICY rls_bsl_all ON public.bank_statement_lines FOR ALL TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_brs_all ON public.bank_reconciliation_sessions;
CREATE POLICY rls_brs_all ON public.bank_reconciliation_sessions FOR ALL TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_brm_all ON public.bank_reconciliation_matches;
CREATE POLICY rls_brm_all ON public.bank_reconciliation_matches FOR ALL TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_cb_attach_all ON public.cashbook_attachments;
CREATE POLICY rls_cb_attach_all ON public.cashbook_attachments FOR ALL TO authenticated
  USING (public.has_finance_full_access(company_id))
  WITH CHECK (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_cbal_select ON public.cashbook_audit_log;
CREATE POLICY rls_cbal_select ON public.cashbook_audit_log FOR SELECT TO authenticated
  USING (public.has_finance_full_access(company_id));

DROP POLICY IF EXISTS rls_seq_select ON public.cashbook_sequences;
CREATE POLICY rls_seq_select ON public.cashbook_sequences FOR SELECT TO authenticated
  USING (public.has_finance_full_access(company_id));

-- ============================================================================
-- 5. RPC TRANSACTIONAL & LIFECYCLE FUNCTIONS
-- ============================================================================

-- Function 1: submit_cashbook_transaction (With Optimistic Locking)
CREATE OR REPLACE FUNCTION public.submit_cashbook_transaction(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = p_id AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found.', p_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_tx.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_id, p_expected_version, v_tx.version;
  END IF;

  IF NOT public.has_finance_full_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_tx.company_id;
  END IF;

  IF v_tx.status <> 'Draft' THEN
    RAISE EXCEPTION 'Only Draft cashbook transactions can be submitted. Current status: %', v_tx.status;
  END IF;

  UPDATE public.cashbook_transactions
  SET status = 'Submitted',
      submitted_by = auth.uid(),
      submitted_at = now(),
      updated_by = auth.uid()
  WHERE id = p_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. The row changed before submission could be completed.', p_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_tx.company_id, 'cashbook_transactions', p_id, 'SUBMIT', auth.uid(), jsonb_build_object('previous_status', v_tx.status, 'new_status', 'Submitted'));

  RETURN jsonb_build_object('success', true, 'id', p_id, 'status', 'Submitted');
END;
$$;

-- Function 2: approve_cashbook_transaction (With Optimistic Locking)
CREATE OR REPLACE FUNCTION public.approve_cashbook_transaction(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = p_id AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found.', p_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_tx.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_id, p_expected_version, v_tx.version;
  END IF;

  IF NOT public.has_finance_full_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_tx.company_id;
  END IF;

  IF v_tx.status <> 'Submitted' THEN
    RAISE EXCEPTION 'Only Submitted cashbook transactions can be approved. Current status: %', v_tx.status;
  END IF;

  UPDATE public.cashbook_transactions
  SET status = 'Approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_by = auth.uid()
  WHERE id = p_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. The row changed before approval could be completed.', p_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_tx.company_id, 'cashbook_transactions', p_id, 'APPROVE', auth.uid(), jsonb_build_object('previous_status', v_tx.status, 'new_status', 'Approved'));

  RETURN jsonb_build_object('success', true, 'id', p_id, 'status', 'Approved');
END;
$$;

-- Function 3: post_cashbook_transaction (With Optimistic Locking)
CREATE OR REPLACE FUNCTION public.post_cashbook_transaction(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = p_id AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found.', p_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_tx.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_id, p_expected_version, v_tx.version;
  END IF;

  IF NOT public.has_finance_full_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_tx.company_id;
  END IF;

  IF v_tx.status <> 'Approved' THEN
    RAISE EXCEPTION 'Only Approved cashbook transactions can be posted. Current status: %', v_tx.status;
  END IF;

  UPDATE public.cashbook_transactions
  SET status = 'Posted',
      posted_by = auth.uid(),
      posted_at = now(),
      updated_by = auth.uid()
  WHERE id = p_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. The row changed before posting could be completed.', p_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_tx.company_id, 'cashbook_transactions', p_id, 'POST', auth.uid(), jsonb_build_object('previous_status', v_tx.status, 'new_status', 'Posted'));

  RETURN jsonb_build_object('success', true, 'id', p_id, 'status', 'Posted');
END;
$$;

-- Function 4: cancel_cashbook_transaction (With Optimistic Locking)
CREATE OR REPLACE FUNCTION public.cancel_cashbook_transaction(
  p_id uuid,
  p_reason text,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = p_id AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found.', p_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_tx.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_id, p_expected_version, v_tx.version;
  END IF;

  IF NOT public.has_finance_full_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_tx.company_id;
  END IF;

  IF v_tx.status IN ('Reconciled', 'Cancelled') THEN
    RAISE EXCEPTION 'Transaction in status % cannot be cancelled.', v_tx.status;
  END IF;

  UPDATE public.cashbook_transactions
  SET status = 'Cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      cancellation_reason = p_reason,
      updated_by = auth.uid()
  WHERE id = p_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. The row changed before cancellation could be completed.', p_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_tx.company_id, 'cashbook_transactions', p_id, 'CANCEL', auth.uid(), jsonb_build_object('previous_status', v_tx.status, 'new_status', 'Cancelled', 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'id', p_id, 'status', 'Cancelled');
END;
$$;

-- Function 5: match_bank_statement_line (With Overmatch Prevention, Split Support & Optimistic Locking)
CREATE OR REPLACE FUNCTION public.match_bank_statement_line(
  p_session_id uuid,
  p_statement_line_id uuid,
  p_cashbook_transaction_id uuid,
  p_matched_amount numeric,
  p_match_type text DEFAULT 'Exact',
  p_expected_session_version integer DEFAULT NULL,
  p_expected_line_version integer DEFAULT NULL,
  p_expected_tx_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sess record;
  v_line record;
  v_tx record;
  v_match_id uuid;
  v_line_matched_sum numeric(15,2);
  v_tx_matched_sum numeric(15,2);
  v_line_abs_amount numeric(15,2);
BEGIN
  SELECT * INTO v_sess FROM public.bank_reconciliation_sessions WHERE id = p_session_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation session % not found.', p_session_id; END IF;

  IF p_expected_session_version IS NOT NULL AND v_sess.version <> p_expected_session_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank reconciliation session %. Expected version %, but current version is %.', p_session_id, p_expected_session_version, v_sess.version;
  END IF;

  IF NOT public.has_finance_full_access(v_sess.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_sess.company_id;
  END IF;

  IF v_sess.status <> 'In Progress' THEN
    RAISE EXCEPTION 'Session % is not In Progress.', p_session_id;
  END IF;

  SELECT * INTO v_line FROM public.bank_statement_lines WHERE id = p_statement_line_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Statement line % not found.', p_statement_line_id; END IF;

  IF p_expected_line_version IS NOT NULL AND v_line.version <> p_expected_line_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank statement line %. Expected version %, but current version is %.', p_statement_line_id, p_expected_line_version, v_line.version;
  END IF;

  IF v_line.company_id <> v_sess.company_id THEN
    RAISE EXCEPTION 'Statement line % does not belong to session company %.', p_statement_line_id, v_sess.company_id;
  END IF;

  SELECT * INTO v_tx FROM public.cashbook_transactions WHERE id = p_cashbook_transaction_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cashbook transaction % not found.', p_cashbook_transaction_id; END IF;

  IF p_expected_tx_version IS NOT NULL AND v_tx.version <> p_expected_tx_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_cashbook_transaction_id, p_expected_tx_version, v_tx.version;
  END IF;

  IF v_tx.company_id <> v_sess.company_id THEN
    RAISE EXCEPTION 'Cashbook transaction % does not belong to session company %.', p_cashbook_transaction_id, v_sess.company_id;
  END IF;

  IF v_tx.bank_account_id <> v_sess.bank_account_id THEN
    RAISE EXCEPTION 'Cashbook transaction % bank account does not match reconciliation session bank account.', p_cashbook_transaction_id;
  END IF;

  v_line_abs_amount := ABS(v_line.amount);

  -- 1. Cumulative line match check
  SELECT COALESCE(SUM(matched_amount), 0.00) INTO v_line_matched_sum
  FROM public.bank_reconciliation_matches
  WHERE statement_line_id = p_statement_line_id AND is_archived = false;

  IF (v_line_matched_sum + p_matched_amount) > v_line_abs_amount THEN
    RAISE EXCEPTION 'Cannot match %. Total line match (%) would exceed statement line amount (%).',
      p_matched_amount, (v_line_matched_sum + p_matched_amount), v_line_abs_amount;
  END IF;

  -- 2. Cumulative transaction match check
  SELECT COALESCE(SUM(matched_amount), 0.00) INTO v_tx_matched_sum
  FROM public.bank_reconciliation_matches
  WHERE cashbook_transaction_id = p_cashbook_transaction_id AND is_archived = false;

  IF (v_tx_matched_sum + p_matched_amount) > v_tx.amount THEN
    RAISE EXCEPTION 'Cannot match %. Total transaction match (%) would exceed cashbook transaction amount (%).',
      p_matched_amount, (v_tx_matched_sum + p_matched_amount), v_tx.amount;
  END IF;

  -- 3. Insert Match
  INSERT INTO public.bank_reconciliation_matches (
    company_id, reconciliation_session_id, statement_line_id, cashbook_transaction_id, matched_amount, match_type, matched_by
  ) VALUES (
    v_sess.company_id, p_session_id, p_statement_line_id, p_cashbook_transaction_id, p_matched_amount, p_match_type, auth.uid()
  ) RETURNING id INTO v_match_id;

  -- 4. Update line and tx statuses
  IF (v_line_matched_sum + p_matched_amount) = v_line_abs_amount THEN
    UPDATE public.bank_statement_lines SET match_status = 'Matched' WHERE id = p_statement_line_id;
  ELSE
    UPDATE public.bank_statement_lines SET match_status = 'Partially Matched' WHERE id = p_statement_line_id;
  END IF;

  IF (v_tx_matched_sum + p_matched_amount) = v_tx.amount THEN
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Matched' WHERE id = p_cashbook_transaction_id;
  ELSE
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Unreconciled' WHERE id = p_cashbook_transaction_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_sess.company_id, 'bank_reconciliation_matches', v_match_id, 'CREATE_MATCH', auth.uid(), jsonb_build_object(
    'session_id', p_session_id, 'statement_line_id', p_statement_line_id, 'cashbook_transaction_id', p_cashbook_transaction_id, 'amount', p_matched_amount
  ));

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);
END;
$$;

-- Function 6: unmatch_bank_statement_line (With Optimistic Locking)
CREATE OR REPLACE FUNCTION public.unmatch_bank_statement_line(
  p_match_id uuid,
  p_expected_match_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match record;
  v_sess record;
  v_line_matched_sum numeric(15,2);
  v_tx_matched_sum numeric(15,2);
  v_line record;
  v_tx record;
BEGIN
  SELECT * INTO v_match FROM public.bank_reconciliation_matches WHERE id = p_match_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation match % not found.', p_match_id; END IF;

  IF p_expected_match_version IS NOT NULL AND v_match.version <> p_expected_match_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank reconciliation match %. Expected version %, but current version is %.', p_match_id, p_expected_match_version, v_match.version;
  END IF;

  IF NOT public.has_finance_full_access(v_match.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_match.company_id;
  END IF;

  SELECT * INTO v_sess FROM public.bank_reconciliation_sessions WHERE id = v_match.reconciliation_session_id AND is_archived = false FOR UPDATE;
  IF v_sess.status <> 'In Progress' THEN
    RAISE EXCEPTION 'Cannot unmatch in session % because it is %.', v_sess.id, v_sess.status;
  END IF;

  -- Archive match atomically using the expected version when supplied
  UPDATE public.bank_reconciliation_matches
  SET is_archived = true
  WHERE id = p_match_id
    AND (p_expected_match_version IS NULL OR version = p_expected_match_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank reconciliation match %. The row changed before it could be unmatched.', p_match_id;
  END IF;

  -- Recalculate statement line status
  SELECT * INTO v_line FROM public.bank_statement_lines WHERE id = v_match.statement_line_id FOR UPDATE;
  SELECT COALESCE(SUM(matched_amount), 0.00) INTO v_line_matched_sum
  FROM public.bank_reconciliation_matches
  WHERE statement_line_id = v_match.statement_line_id AND is_archived = false;

  IF v_line_matched_sum = 0 THEN
    UPDATE public.bank_statement_lines SET match_status = 'Unmatched' WHERE id = v_match.statement_line_id;
  ELSIF v_line_matched_sum < ABS(v_line.amount) THEN
    UPDATE public.bank_statement_lines SET match_status = 'Partially Matched' WHERE id = v_match.statement_line_id;
  ELSE
    UPDATE public.bank_statement_lines SET match_status = 'Matched' WHERE id = v_match.statement_line_id;
  END IF;

  -- Recalculate cashbook transaction status
  SELECT * INTO v_tx FROM public.cashbook_transactions WHERE id = v_match.cashbook_transaction_id FOR UPDATE;
  SELECT COALESCE(SUM(matched_amount), 0.00) INTO v_tx_matched_sum
  FROM public.bank_reconciliation_matches
  WHERE cashbook_transaction_id = v_match.cashbook_transaction_id AND is_archived = false;

  IF v_tx_matched_sum = 0 THEN
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Unreconciled' WHERE id = v_match.cashbook_transaction_id;
  ELSIF v_tx_matched_sum < v_tx.amount THEN
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Unreconciled' WHERE id = v_match.cashbook_transaction_id;
  ELSE
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Matched' WHERE id = v_match.cashbook_transaction_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_match.company_id, 'bank_reconciliation_matches', p_match_id, 'UNMATCH', auth.uid(), jsonb_build_object('match_id', p_match_id));

  RETURN jsonb_build_object('success', true, 'match_id', p_match_id, 'status', 'Unmatched');
END;
$$;

-- Function 7: complete_bank_reconciliation_session (With Prior Completed Balance Resolution, Zero Difference Enforcement & Optimistic Locking)
CREATE OR REPLACE FUNCTION public.complete_bank_reconciliation_session(
  p_session_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sess record;
  v_bank_acc record;
  v_start_balance numeric(15,2);
  v_cleared_deposits_count integer;
  v_cleared_deposits_sum numeric(15,2);
  v_cleared_withdrawals_count integer;
  v_cleared_withdrawals_sum numeric(15,2);
  v_calc_balance numeric(15,2);
  v_diff numeric(15,2);
BEGIN
  SELECT * INTO v_sess FROM public.bank_reconciliation_sessions WHERE id = p_session_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation session % not found.', p_session_id; END IF;

  IF p_expected_version IS NOT NULL AND v_sess.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank reconciliation session %. Expected version %, but current version is %.', p_session_id, p_expected_version, v_sess.version;
  END IF;

  IF NOT public.has_finance_full_access(v_sess.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_sess.company_id;
  END IF;

  IF v_sess.status <> 'In Progress' THEN
    RAISE EXCEPTION 'Session % is already %.', p_session_id, v_sess.status;
  END IF;

  SELECT * INTO v_bank_acc FROM public.bank_accounts WHERE id = v_sess.bank_account_id;

  -- Derive starting balance from the most recent completed reconciliation session before this end date
  SELECT statement_ending_balance INTO v_start_balance
  FROM public.bank_reconciliation_sessions
  WHERE bank_account_id = v_sess.bank_account_id
    AND company_id = v_sess.company_id
    AND status = 'Completed'
    AND statement_end_date <= v_sess.statement_end_date
    AND id <> p_session_id
    AND is_archived = false
  ORDER BY statement_end_date DESC, completed_at DESC
  LIMIT 1;

  IF v_start_balance IS NULL THEN
    v_start_balance := v_bank_acc.opening_balance;
  END IF;

  -- Aggregate cleared receipts (deposits) matched in this session
  SELECT
    COUNT(brm.id),
    COALESCE(SUM(brm.matched_amount), 0.00)
  INTO v_cleared_deposits_count, v_cleared_deposits_sum
  FROM public.bank_reconciliation_matches brm
  JOIN public.cashbook_transactions cbt ON cbt.id = brm.cashbook_transaction_id
  WHERE brm.reconciliation_session_id = p_session_id
    AND brm.is_archived = false
    AND cbt.transaction_type IN ('Receipt', 'Transfer In');

  -- Aggregate cleared payments (withdrawals) matched in this session
  SELECT
    COUNT(brm.id),
    COALESCE(SUM(brm.matched_amount), 0.00)
  INTO v_cleared_withdrawals_count, v_cleared_withdrawals_sum
  FROM public.bank_reconciliation_matches brm
  JOIN public.cashbook_transactions cbt ON cbt.id = brm.cashbook_transaction_id
  WHERE brm.reconciliation_session_id = p_session_id
    AND brm.is_archived = false
    AND cbt.transaction_type IN ('Payment', 'Transfer Out');

  v_calc_balance := v_start_balance + v_cleared_deposits_sum - v_cleared_withdrawals_sum;
  v_diff := v_sess.statement_ending_balance - v_calc_balance;

  IF v_diff <> 0.00 THEN
    RAISE EXCEPTION 'Reconciliation session % cannot be completed. Calculated difference is % (must be 0.00). Ending statement balance: %, Starting balance: %, Cleared deposits: %, Cleared withdrawals: %',
      p_session_id, v_diff, v_sess.statement_ending_balance, v_start_balance, v_cleared_deposits_sum, v_cleared_withdrawals_sum;
  END IF;

  -- Complete session
  UPDATE public.bank_reconciliation_sessions
  SET status = 'Completed',
      cleared_deposits_count = v_cleared_deposits_count,
      cleared_deposits_sum = v_cleared_deposits_sum,
      cleared_withdrawals_count = v_cleared_withdrawals_count,
      cleared_withdrawals_sum = v_cleared_withdrawals_sum,
      calculated_balance = v_calc_balance,
      difference_amount = 0.00,
      completed_at = now(),
      completed_by = auth.uid()
  WHERE id = p_session_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for reconciliation session %. The row changed before completion could be committed.', p_session_id;
  END IF;

  -- Mark matched transactions as fully Reconciled
  UPDATE public.cashbook_transactions
  SET reconciliation_status = 'Reconciled'
  WHERE id IN (
    SELECT cashbook_transaction_id
    FROM public.bank_reconciliation_matches
    WHERE reconciliation_session_id = p_session_id AND is_archived = false
  );

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_sess.company_id, 'bank_reconciliation_sessions', p_session_id, 'COMPLETE_SESSION', auth.uid(), jsonb_build_object(
    'session_id', p_session_id, 'start_balance', v_start_balance, 'ending_balance', v_sess.statement_ending_balance, 'cleared_deposits', v_cleared_deposits_sum, 'cleared_withdrawals', v_cleared_withdrawals_sum
  ));

  RETURN jsonb_build_object('success', true, 'session_id', p_session_id, 'status', 'Completed');
END;
$$;

-- ============================================================================
-- 6. LEAST-PRIVILEGE GRANTS
-- ============================================================================

-- Table level least-privilege grants
GRANT SELECT, INSERT, UPDATE ON public.bank_accounts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.cashbook_transactions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.cashbook_allocations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.bank_statement_imports TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.bank_statement_lines TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.bank_reconciliation_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.bank_reconciliation_matches TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.cashbook_attachments TO authenticated, service_role;
GRANT SELECT ON public.cashbook_audit_log TO authenticated, service_role;
GRANT SELECT ON public.cashbook_sequences TO authenticated, service_role;

-- RPC Execution Grants
GRANT EXECUTE ON FUNCTION public.generate_cashbook_transaction_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_cashbook_transaction(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_cashbook_transaction(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_cashbook_transaction(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_cashbook_transaction(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_bank_statement_line(uuid, uuid, uuid, numeric, text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmatch_bank_statement_line(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_bank_reconciliation_session(uuid, integer) TO authenticated;

COMMIT;