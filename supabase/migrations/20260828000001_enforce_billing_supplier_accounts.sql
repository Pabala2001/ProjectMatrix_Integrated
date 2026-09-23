-- Migration: 20260828000001_enforce_billing_supplier_accounts.sql
-- ProjectMatrix Phase 3A.2 — Enforce Billing Access on Supplier Accounts
--
-- Corrected migration guarantees:
--   1. Existing authorization and SELECT policies remain unchanged.
--   2. Billing enforcement is added through restrictive write policies.
--   3. Supplier child rows must retain authoritative parent context.
--   4. Every user-facing mutating RPC rejects read-only Billing access with PM001.
--   5. SECURITY DEFINER functions use an empty search_path and explicit schemas.
--   6. Existing Core Finance and Client Accounts archive/restore protections remain intact.

BEGIN;

-- ============================================================================
-- 0. FAIL-CLOSED PREREQUISITE CHECK
-- ============================================================================

DO $migration_guard$
DECLARE
    v_relation text;
    v_signature text;
    v_missing text[] := ARRAY[]::text[];
BEGIN
    FOREACH v_relation IN ARRAY ARRAY[
        'supplier_accounts',
        'supplier_invoices',
        'supplier_invoice_lines',
        'supplier_credit_notes',
        'supplier_credit_note_lines',
        'supplier_payments',
        'supplier_payment_allocations',
        'supplier_attachments',
        'supplier_accounts_audit_log',
        'cashbook_transactions',
        'cashbook_allocations',
        'financial_commitments',
        'financial_cost_postings',
        'project_budget_versions',
        'project_financial_forecasts',
        'client_accounts',
        'project_client_contracts',
        'client_invoices',
        'client_invoice_lines',
        'client_credit_notes',
        'client_credit_note_lines',
        'client_receipts',
        'client_receipt_allocations'
    ] LOOP
        IF pg_catalog.to_regclass('public.' || v_relation) IS NULL THEN
            v_missing := pg_catalog.array_append(v_missing, 'relation public.' || v_relation);
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY ARRAY[
        'public.has_finance_full_access(uuid)',
        'public.company_billing_allows_operational_write(uuid)',
        'public.fn_lock_supplier_invoice_context(uuid)',
        'public.fn_assert_supplier_invoice_capacity(uuid)',
        'public.fn_lock_supplier_credit_note_context(uuid)',
        'public.fn_assert_supplier_credit_capacity(uuid)',
        'public.fn_lock_supplier_payment_context(uuid)',
        'public.fn_assert_supplier_version(text,uuid,integer)',
        'public.submit_financial_cost_posting(uuid)',
        'public.post_financial_cost_posting(uuid)',
        'public.submit_cashbook_transaction(uuid,integer)',
        'public.approve_cashbook_transaction(uuid,integer)',
        'public.post_cashbook_transaction(uuid,integer)'
    ] LOOP
        IF pg_catalog.to_regprocedure(v_signature) IS NULL THEN
            v_missing := pg_catalog.array_append(v_missing, 'function ' || v_signature);
        END IF;
    END LOOP;

    IF pg_catalog.cardinality(v_missing) > 0 THEN
        RAISE EXCEPTION 'Supplier Accounts Billing migration prerequisites are missing: %',
            pg_catalog.array_to_string(v_missing, ', ')
            USING ERRCODE = 'P0001';
    END IF;
END;
$migration_guard$;

-- ============================================================================
-- 1. RESTRICTIVE BILLING WRITE POLICIES
--
-- PostgreSQL combines permissive authorization policies with OR, then combines
-- restrictive policies with AND. Keeping Billing in its own restrictive policy
-- prevents another permissive policy from bypassing the entitlement check.
-- ============================================================================

-- 1.1 SUPPLIER ACCOUNTS
ALTER TABLE public.supplier_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.supplier_accounts;
CREATE POLICY billing_operational_write_insert
    ON public.supplier_accounts
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.supplier_accounts;
CREATE POLICY billing_operational_write_update
    ON public.supplier_accounts
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.supplier_accounts;
CREATE POLICY billing_operational_write_delete
    ON public.supplier_accounts
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- 1.2 SUPPLIER INVOICES
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.supplier_invoices;
CREATE POLICY billing_operational_write_insert
    ON public.supplier_invoices
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.supplier_invoices;
CREATE POLICY billing_operational_write_update
    ON public.supplier_invoices
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.supplier_invoices;
CREATE POLICY billing_operational_write_delete
    ON public.supplier_invoices
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- 1.3 SUPPLIER INVOICE LINES
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.supplier_invoice_lines;
CREATE POLICY billing_operational_write_insert
    ON public.supplier_invoice_lines
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_invoices AS si
            WHERE si.id = supplier_invoice_lines.supplier_invoice_id
              AND si.company_id = supplier_invoice_lines.company_id
              AND si.project_id = supplier_invoice_lines.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.supplier_invoice_lines;
CREATE POLICY billing_operational_write_update
    ON public.supplier_invoice_lines
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_invoices AS si
            WHERE si.id = supplier_invoice_lines.supplier_invoice_id
              AND si.company_id = supplier_invoice_lines.company_id
              AND si.project_id = supplier_invoice_lines.project_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_invoices AS si
            WHERE si.id = supplier_invoice_lines.supplier_invoice_id
              AND si.company_id = supplier_invoice_lines.company_id
              AND si.project_id = supplier_invoice_lines.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.supplier_invoice_lines;
CREATE POLICY billing_operational_write_delete
    ON public.supplier_invoice_lines
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_invoices AS si
            WHERE si.id = supplier_invoice_lines.supplier_invoice_id
              AND si.company_id = supplier_invoice_lines.company_id
              AND si.project_id = supplier_invoice_lines.project_id
        )
    );

-- 1.4 SUPPLIER CREDIT NOTES
ALTER TABLE public.supplier_credit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.supplier_credit_notes;
CREATE POLICY billing_operational_write_insert
    ON public.supplier_credit_notes
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.supplier_credit_notes;
CREATE POLICY billing_operational_write_update
    ON public.supplier_credit_notes
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.supplier_credit_notes;
CREATE POLICY billing_operational_write_delete
    ON public.supplier_credit_notes
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- 1.5 SUPPLIER CREDIT NOTE LINES
ALTER TABLE public.supplier_credit_note_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.supplier_credit_note_lines;
CREATE POLICY billing_operational_write_insert
    ON public.supplier_credit_note_lines
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_credit_notes AS scn
            WHERE scn.id = supplier_credit_note_lines.credit_note_id
              AND scn.company_id = supplier_credit_note_lines.company_id
              AND scn.project_id = supplier_credit_note_lines.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.supplier_credit_note_lines;
CREATE POLICY billing_operational_write_update
    ON public.supplier_credit_note_lines
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_credit_notes AS scn
            WHERE scn.id = supplier_credit_note_lines.credit_note_id
              AND scn.company_id = supplier_credit_note_lines.company_id
              AND scn.project_id = supplier_credit_note_lines.project_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_credit_notes AS scn
            WHERE scn.id = supplier_credit_note_lines.credit_note_id
              AND scn.company_id = supplier_credit_note_lines.company_id
              AND scn.project_id = supplier_credit_note_lines.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.supplier_credit_note_lines;
CREATE POLICY billing_operational_write_delete
    ON public.supplier_credit_note_lines
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_credit_notes AS scn
            WHERE scn.id = supplier_credit_note_lines.credit_note_id
              AND scn.company_id = supplier_credit_note_lines.company_id
              AND scn.project_id = supplier_credit_note_lines.project_id
        )
    );

-- 1.6 SUPPLIER PAYMENTS
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.supplier_payments;
CREATE POLICY billing_operational_write_insert
    ON public.supplier_payments
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.supplier_payments;
CREATE POLICY billing_operational_write_update
    ON public.supplier_payments
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.supplier_payments;
CREATE POLICY billing_operational_write_delete
    ON public.supplier_payments
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- 1.7 SUPPLIER PAYMENT ALLOCATIONS
ALTER TABLE public.supplier_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.supplier_payment_allocations;
CREATE POLICY billing_operational_write_insert
    ON public.supplier_payment_allocations
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_payments AS sp
            WHERE sp.id = supplier_payment_allocations.supplier_payment_id
              AND sp.company_id = supplier_payment_allocations.company_id
              AND sp.project_id = supplier_payment_allocations.project_id
              AND sp.supplier_account_id = supplier_payment_allocations.supplier_account_id
              AND sp.currency = supplier_payment_allocations.currency
        )
        AND EXISTS (
            SELECT 1
            FROM public.supplier_invoices AS si
            WHERE si.id = supplier_payment_allocations.supplier_invoice_id
              AND si.company_id = supplier_payment_allocations.company_id
              AND si.project_id = supplier_payment_allocations.project_id
              AND si.supplier_account_id = supplier_payment_allocations.supplier_account_id
              AND si.currency = supplier_payment_allocations.currency
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.supplier_payment_allocations;
CREATE POLICY billing_operational_write_update
    ON public.supplier_payment_allocations
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_payments AS sp
            WHERE sp.id = supplier_payment_allocations.supplier_payment_id
              AND sp.company_id = supplier_payment_allocations.company_id
              AND sp.project_id = supplier_payment_allocations.project_id
              AND sp.supplier_account_id = supplier_payment_allocations.supplier_account_id
              AND sp.currency = supplier_payment_allocations.currency
        )
        AND EXISTS (
            SELECT 1
            FROM public.supplier_invoices AS si
            WHERE si.id = supplier_payment_allocations.supplier_invoice_id
              AND si.company_id = supplier_payment_allocations.company_id
              AND si.project_id = supplier_payment_allocations.project_id
              AND si.supplier_account_id = supplier_payment_allocations.supplier_account_id
              AND si.currency = supplier_payment_allocations.currency
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_payments AS sp
            WHERE sp.id = supplier_payment_allocations.supplier_payment_id
              AND sp.company_id = supplier_payment_allocations.company_id
              AND sp.project_id = supplier_payment_allocations.project_id
              AND sp.supplier_account_id = supplier_payment_allocations.supplier_account_id
              AND sp.currency = supplier_payment_allocations.currency
        )
        AND EXISTS (
            SELECT 1
            FROM public.supplier_invoices AS si
            WHERE si.id = supplier_payment_allocations.supplier_invoice_id
              AND si.company_id = supplier_payment_allocations.company_id
              AND si.project_id = supplier_payment_allocations.project_id
              AND si.supplier_account_id = supplier_payment_allocations.supplier_account_id
              AND si.currency = supplier_payment_allocations.currency
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.supplier_payment_allocations;
CREATE POLICY billing_operational_write_delete
    ON public.supplier_payment_allocations
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.supplier_payments AS sp
            WHERE sp.id = supplier_payment_allocations.supplier_payment_id
              AND sp.company_id = supplier_payment_allocations.company_id
              AND sp.project_id = supplier_payment_allocations.project_id
              AND sp.supplier_account_id = supplier_payment_allocations.supplier_account_id
              AND sp.currency = supplier_payment_allocations.currency
        )
        AND EXISTS (
            SELECT 1
            FROM public.supplier_invoices AS si
            WHERE si.id = supplier_payment_allocations.supplier_invoice_id
              AND si.company_id = supplier_payment_allocations.company_id
              AND si.project_id = supplier_payment_allocations.project_id
              AND si.supplier_account_id = supplier_payment_allocations.supplier_account_id
              AND si.currency = supplier_payment_allocations.currency
        )
    );

-- 1.8 SUPPLIER ATTACHMENTS
ALTER TABLE public.supplier_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.supplier_attachments;
CREATE POLICY billing_operational_write_insert
    ON public.supplier_attachments
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.supplier_attachments;
CREATE POLICY billing_operational_write_update
    ON public.supplier_attachments
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.supplier_attachments;
CREATE POLICY billing_operational_write_delete
    ON public.supplier_attachments
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- ============================================================================
-- 2. SUPPLIER LIFECYCLE, INVOICE & CREDIT NOTE WORKFLOW RPCS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_supplier_account(p_supplier_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sa public.supplier_accounts%ROWTYPE;
BEGIN
  -- Lock Order 1: supplier_accounts
  SELECT * INTO v_sa FROM public.supplier_accounts WHERE id = p_supplier_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier account % not found.', p_supplier_account_id; END IF;
  IF v_sa.is_archived THEN RAISE EXCEPTION 'Cannot activate archived supplier account.'; END IF;
  IF NOT public.has_finance_full_access(v_sa.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_sa.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_sa.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_commitment.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
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


-- 2.2 INVOICE WORKFLOWS
CREATE OR REPLACE FUNCTION public.submit_supplier_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_line_cnt integer;
  v_cost_cnt integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_inv.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_cost_cnt integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_inv.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_cost public.financial_cost_postings%ROWTYPE;
  v_cost_count integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_inv.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
AS $$
DECLARE
  v_invoice public.supplier_invoices%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank invoice rejection reason is required.';
  END IF;

  v_invoice := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_invoice.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_invoice.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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


-- 2.3 CREDIT NOTE WORKFLOWS
CREATE OR REPLACE FUNCTION public.submit_supplier_credit_note(p_credit_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cn public.supplier_credit_notes%ROWTYPE;
  v_line_cnt integer;
  v_cost_cnt integer;
BEGIN
  v_cn := public.fn_lock_supplier_credit_note_context(p_credit_note_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_cn.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
AS $$
DECLARE
  v_cn public.supplier_credit_notes%ROWTYPE;
  v_cost_cnt integer;
BEGIN
  v_cn := public.fn_lock_supplier_credit_note_context(p_credit_note_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_cn.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
AS $$
DECLARE
  v_cn public.supplier_credit_notes%ROWTYPE;
  v_cost public.financial_cost_postings%ROWTYPE;
  v_cost_count integer;
BEGIN
  v_cn := public.fn_lock_supplier_credit_note_context(p_credit_note_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_cn.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
AS $$
DECLARE
  v_credit_note public.supplier_credit_notes%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank credit-note rejection reason is required.';
  END IF;

  v_credit_note := public.fn_lock_supplier_credit_note_context(p_credit_note_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_credit_note.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_credit_note.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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

-- ============================================================================
-- SECTION 3: SUPPLIER PAYMENT & ALLOCATION WORKFLOW RPCS
-- ============================================================================

-- 3.1 PAYMENT WORKFLOWS
CREATE OR REPLACE FUNCTION public.submit_supplier_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pay public.supplier_payments%ROWTYPE;
BEGIN
  v_pay := public.fn_lock_supplier_payment_context(p_payment_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_pay.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_pay.status <> 'Draft' THEN RAISE EXCEPTION 'Payment must be in Draft status to submit.'; END IF;
  IF v_pay.amount_paid <= 0 THEN RAISE EXCEPTION 'Payment amount must be positive.'; END IF;

  UPDATE public.supplier_payments
  SET status = 'Submitted', submitted_by = auth.uid(), submitted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_payment_id RETURNING * INTO v_pay;

  RETURN to_jsonb(v_pay);
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_supplier_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pay public.supplier_payments%ROWTYPE;
BEGIN
  v_pay := public.fn_lock_supplier_payment_context(p_payment_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_pay.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_pay.status <> 'Submitted' THEN RAISE EXCEPTION 'Payment must be in Submitted status to approve.'; END IF;

  UPDATE public.supplier_payments
  SET status = 'Approved', approved_by = auth.uid(), approved_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_payment_id RETURNING * INTO v_pay;

  RETURN to_jsonb(v_pay);
END;
$$;


CREATE OR REPLACE FUNCTION public.post_supplier_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pay public.supplier_payments%ROWTYPE;
  v_supp public.supplier_accounts%ROWTYPE;
  v_cashbook public.cashbook_transactions%ROWTYPE;
  v_cb_version integer;
BEGIN
  v_pay := public.fn_lock_supplier_payment_context(p_payment_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_pay.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_pay.status = 'Posted' THEN
    IF v_pay.cashbook_transaction_id IS NULL THEN
      RAISE EXCEPTION 'Posted payment must have a linked Cashbook transaction.';
    END IF;
    RETURN to_jsonb(v_pay);
  END IF;

  IF v_pay.status <> 'Approved' THEN
    RAISE EXCEPTION 'Payment must be in Approved status to post.';
  END IF;

  SELECT * INTO v_supp FROM public.supplier_accounts WHERE id = v_pay.supplier_account_id;

  INSERT INTO public.cashbook_transactions (
    company_id, project_id, bank_account_id, transaction_type, transaction_date,
    reference_number, external_reference, payee_payer_name, description,
    amount, vat_amount, currency, payment_method, status,
    reconciliation_status, created_by, updated_by
  ) VALUES (
    v_pay.company_id, v_pay.project_id, v_pay.bank_account_id, 'Payment', v_pay.payment_date,
    v_pay.payment_reference, v_pay.payment_reference, COALESCE(v_supp.trading_name, v_supp.legal_name),
    'Supplier payment for ' || COALESCE(v_supp.trading_name, v_supp.legal_name),
    v_pay.amount_paid, 0.00, v_pay.currency, v_pay.payment_method, 'Draft',
    'Unreconciled', auth.uid(), auth.uid()
  ) RETURNING * INTO v_cashbook;

  INSERT INTO public.cashbook_allocations (
    company_id, cashbook_transaction_id, allocation_type, target_id,
    amount_allocated, allocated_by, notes
  ) VALUES (
    v_pay.company_id, v_cashbook.id, 'Supplier Payment', v_pay.id,
    v_pay.amount_paid, auth.uid(), 'Automatic supplier payment allocation'
  );

  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_cashbook.id;
  PERFORM public.submit_cashbook_transaction(v_cashbook.id, v_cb_version);
  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_cashbook.id;
  PERFORM public.approve_cashbook_transaction(v_cashbook.id, v_cb_version);
  SELECT version INTO v_cb_version FROM public.cashbook_transactions WHERE id = v_cashbook.id;
  PERFORM public.post_cashbook_transaction(v_cashbook.id, v_cb_version);

  UPDATE public.supplier_payments
  SET status = 'Posted',
      cashbook_transaction_id = v_cashbook.id,
      posted_by = auth.uid(),
      posted_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_payment_id RETURNING * INTO v_pay;

  RETURN to_jsonb(v_pay);
END;
$$;


CREATE OR REPLACE FUNCTION public.reject_supplier_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.supplier_payments%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank payment rejection reason is required.';
  END IF;

  v_payment := public.fn_lock_supplier_payment_context(p_payment_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_payment.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
AS $$
DECLARE
  v_payment public.supplier_payments%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank payment cancellation reason is required.';
  END IF;

  v_payment := public.fn_lock_supplier_payment_context(p_payment_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_payment.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_payment.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
    RAISE EXCEPTION 'Payment can only be cancelled from Draft, Submitted or Approved status.';
  END IF;

  IF v_payment.cashbook_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Payment with linked Cashbook transaction cannot be cancelled.';
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


CREATE OR REPLACE FUNCTION public.reverse_supplier_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_payment.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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


-- 3.2 PAYMENT ALLOCATION RPCS
CREATE OR REPLACE FUNCTION public.allocate_supplier_payment(
  p_payment_id uuid,
  p_invoice_id uuid,
  p_amount_allocated numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_sp.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
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
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_alloc.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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


-- 3.3 COMMITMENT COORDINATION EXTENSIONS
CREATE OR REPLACE FUNCTION public.close_financial_commitment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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
SET search_path = ''
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

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

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

-- ============================================================================
-- SECTION 4: UNIFIED ARCHIVE & RESTORE RPCS WITH BILLING WRITE ENFORCEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_company_id uuid;
    v_status text;
    v_is_active boolean;
    v_is_archived boolean;
    v_parent_id uuid;
    v_parent_archived boolean;
    v_supplier_id uuid;
    v_commitment_id uuid;
    v_invoice_id uuid;
    v_credit_note_id uuid;
    v_cnt integer;
    v_balance numeric(15,2);
    v_sql text;
    v_result jsonb;
BEGIN
    IF p_table IS NULL OR p_id IS NULL THEN
        RAISE EXCEPTION 'Table name and record ID must be provided.';
    END IF;

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
        'client_credit_note_lines',
        'supplier_accounts',
        'supplier_invoices',
        'supplier_invoice_lines',
        'supplier_credit_notes',
        'supplier_credit_note_lines',
        'supplier_payments'
    ) THEN
        RAISE EXCEPTION 'Table % is not eligible for soft archiving.', p_table;
    END IF;

    -- Fetch record & lock
    v_sql := format('SELECT company_id, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table);
    EXECUTE v_sql INTO v_company_id, v_is_archived USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % in table % was not found.', p_id, p_table;
    END IF;

    IF v_is_archived IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Record is already archived.';
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance permissions for company %.', v_company_id;
    END IF;

    -- Operational write billing guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Pre-lock contexts for supplier child tables
    IF p_table = 'supplier_invoices' THEN
        SELECT supplier_account_id, financial_commitment_id
        INTO v_supplier_id, v_commitment_id
        FROM public.supplier_invoices
        WHERE id = p_id
          AND company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice supplier context is invalid.'; END IF;
        PERFORM 1 FROM public.financial_commitments
        WHERE id = v_commitment_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice commitment context is invalid.'; END IF;
    ELSIF p_table = 'supplier_invoice_lines' THEN
        SELECT si.id, si.supplier_account_id, si.financial_commitment_id
        INTO v_invoice_id, v_supplier_id, v_commitment_id
        FROM public.supplier_invoice_lines AS sil
        JOIN public.supplier_invoices AS si
          ON si.id = sil.supplier_invoice_id
         AND si.company_id = sil.company_id
         AND si.project_id = sil.project_id
        WHERE sil.id = p_id
          AND sil.company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Invoice line % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice line supplier context is invalid.'; END IF;
        PERFORM 1 FROM public.financial_commitments
        WHERE id = v_commitment_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice line commitment context is invalid.'; END IF;
    ELSIF p_table = 'supplier_credit_notes' THEN
        SELECT supplier_account_id, financial_commitment_id, invoice_id
        INTO v_supplier_id, v_commitment_id, v_invoice_id
        FROM public.supplier_credit_notes
        WHERE id = p_id
          AND company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note supplier context is invalid.'; END IF;
        PERFORM 1 FROM public.financial_commitments
        WHERE id = v_commitment_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note commitment context is invalid.'; END IF;
        PERFORM 1 FROM public.supplier_invoices
        WHERE id = v_invoice_id
          AND company_id = v_company_id
          AND supplier_account_id = v_supplier_id
        FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note invoice context is invalid.'; END IF;
    ELSIF p_table = 'supplier_credit_note_lines' THEN
        SELECT scn.id, scn.supplier_account_id, scn.financial_commitment_id, scn.invoice_id
        INTO v_credit_note_id, v_supplier_id, v_commitment_id, v_invoice_id
        FROM public.supplier_credit_note_lines AS scnl
        JOIN public.supplier_credit_notes AS scn
          ON scn.id = scnl.credit_note_id
         AND scn.company_id = scnl.company_id
         AND scn.project_id = scnl.project_id
        WHERE scnl.id = p_id
          AND scnl.company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Credit note line % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note line supplier context is invalid.'; END IF;
        PERFORM 1 FROM public.financial_commitments
        WHERE id = v_commitment_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note line commitment context is invalid.'; END IF;
        PERFORM 1 FROM public.supplier_invoices
        WHERE id = v_invoice_id
          AND company_id = v_company_id
          AND supplier_account_id = v_supplier_id
        FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note line invoice context is invalid.'; END IF;
    ELSIF p_table = 'supplier_payments' THEN
        SELECT supplier_account_id INTO v_supplier_id
        FROM public.supplier_payments
        WHERE id = p_id
          AND company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier payment supplier context is invalid.'; END IF;
    END IF;

    -- Table-specific status & eligibility validations
    IF p_table IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts', 'project_client_contracts', 'client_invoices', 'client_credit_notes', 'client_receipts', 'supplier_invoices', 'supplier_credit_notes', 'supplier_payments') THEN
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
        RAISE EXCEPTION 'Forecast cannot be archived in status %.', v_status;
    ELSIF p_table = 'project_client_contracts' AND v_status NOT IN ('Draft', 'Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Contract cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_invoices' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Client invoice cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_credit_notes' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Credit note cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_receipts' AND v_status NOT IN ('Draft', 'Cancelled') THEN
        RAISE EXCEPTION 'Receipt cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_invoice_lines' THEN
        SELECT cil.invoice_id, ci.status, ci.is_archived
        INTO v_parent_id, v_status, v_parent_archived
        FROM public.client_invoice_lines AS cil
        JOIN public.client_invoices AS ci
          ON ci.id = cil.invoice_id
         AND ci.company_id = cil.company_id
         AND ci.project_id = cil.project_id
        WHERE cil.id = p_id
          AND cil.company_id = v_company_id
        FOR SHARE OF ci;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invoice line parent invoice was not found or does not match its company and project.';
        END IF;
        IF v_parent_archived IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Invoice line cannot be archived while its parent invoice is archived.';
        END IF;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Invoice line cannot be archived when parent invoice status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_credit_note_lines' THEN
        SELECT ccnl.credit_note_id, ccn.status, ccn.is_archived
        INTO v_parent_id, v_status, v_parent_archived
        FROM public.client_credit_note_lines AS ccnl
        JOIN public.client_credit_notes AS ccn
          ON ccn.id = ccnl.credit_note_id
         AND ccn.company_id = ccnl.company_id
         AND ccn.project_id = ccnl.project_id
        WHERE ccnl.id = p_id
          AND ccnl.company_id = v_company_id
        FOR SHARE OF ccn;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Credit note line parent was not found or does not match its company and project.';
        END IF;
        IF v_parent_archived IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Credit note line cannot be archived while its parent credit note is archived.';
        END IF;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Credit note line cannot be archived when parent credit note status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_accounts' THEN
        SELECT is_active
        INTO v_is_active
        FROM public.client_accounts
        WHERE id = p_id
          AND company_id = v_company_id;

        IF v_is_active IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Client account must be marked inactive before archiving.';
        END IF;

        SELECT COUNT(*) INTO v_cnt
        FROM public.project_client_contracts
        WHERE company_id = v_company_id
          AND client_account_id = p_id
          AND status = 'Active'
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Active contracts.'; END IF;

        SELECT COUNT(*) INTO v_cnt
        FROM public.client_invoices
        WHERE company_id = v_company_id
          AND client_account_id = p_id
          AND status IN ('Draft', 'Submitted', 'Approved')
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with non-terminal invoices.'; END IF;

        SELECT COUNT(*) INTO v_cnt
        FROM public.client_credit_notes
        WHERE company_id = v_company_id
          AND client_account_id = p_id
          AND status IN ('Draft', 'Submitted', 'Approved')
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with non-terminal credit notes.'; END IF;

        SELECT COUNT(*) INTO v_cnt
        FROM public.client_receipts
        WHERE company_id = v_company_id
          AND client_account_id = p_id
          AND status = 'Draft'
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with draft receipts.'; END IF;

        SELECT COUNT(*) INTO v_cnt
        FROM (
            SELECT ci.id,
                   ci.total_incl_vat,
                   COALESCE((
                       SELECT SUM(ccn.total_incl_vat)
                       FROM public.client_credit_notes AS ccn
                       WHERE ccn.company_id = v_company_id
                         AND ccn.invoice_id = ci.id
                         AND ccn.status = 'Issued'
                         AND ccn.is_archived = false
                   ), 0.00) AS cn_sum,
                   COALESCE((
                       SELECT SUM(cra.amount_allocated)
                       FROM public.client_receipt_allocations AS cra
                       WHERE cra.company_id = v_company_id
                         AND cra.invoice_id = ci.id
                         AND cra.status = 'Active'
                   ), 0.00) AS alloc_sum
            FROM public.client_invoices AS ci
            WHERE ci.company_id = v_company_id
              AND ci.client_account_id = p_id
              AND ci.status = 'Issued'
              AND ci.is_archived = false
        ) AS inv_bal
        WHERE (inv_bal.total_incl_vat - inv_bal.cn_sum - inv_bal.alloc_sum) > 0;

        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Issued invoices that have an outstanding balance.'; END IF;

        SELECT COUNT(*) INTO v_cnt
        FROM (
            SELECT cr.id,
                   cr.amount_received,
                   COALESCE((
                       SELECT SUM(cra.amount_allocated)
                       FROM public.client_receipt_allocations AS cra
                       WHERE cra.company_id = v_company_id
                         AND cra.receipt_id = cr.id
                         AND cra.status = 'Active'
                   ), 0.00) AS alloc_sum
            FROM public.client_receipts AS cr
            WHERE cr.company_id = v_company_id
              AND cr.client_account_id = p_id
              AND cr.status = 'Posted'
              AND cr.is_archived = false
        ) AS rec_bal
        WHERE (rec_bal.amount_received - rec_bal.alloc_sum) > 0;

        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Posted receipts that have an unallocated balance.'; END IF;

    ELSIF p_table = 'supplier_accounts' THEN
        SELECT is_active
        INTO v_is_active
        FROM public.supplier_accounts
        WHERE id = p_id
          AND company_id = v_company_id;

        IF v_is_active IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Active supplier account % cannot be archived.', p_id;
        END IF;

        PERFORM 1 FROM public.financial_commitments
        WHERE company_id = v_company_id AND supplier_account_id = p_id
        ORDER BY id FOR UPDATE;
        PERFORM 1 FROM public.supplier_invoices
        WHERE company_id = v_company_id AND supplier_account_id = p_id
        ORDER BY id FOR UPDATE;
        PERFORM 1 FROM public.supplier_credit_notes
        WHERE company_id = v_company_id AND supplier_account_id = p_id
        ORDER BY id FOR UPDATE;
        PERFORM 1 FROM public.supplier_payments
        WHERE company_id = v_company_id AND supplier_account_id = p_id
        ORDER BY id FOR UPDATE;
        PERFORM 1 FROM public.supplier_payment_allocations
        WHERE company_id = v_company_id AND supplier_account_id = p_id
        ORDER BY id FOR UPDATE;
        PERFORM 1 FROM public.financial_cost_postings AS fcp
        WHERE fcp.company_id = v_company_id
          AND (
              EXISTS (
                  SELECT 1
                  FROM public.supplier_invoices AS si
                  WHERE si.company_id = v_company_id
                    AND si.supplier_account_id = p_id
                    AND si.id = fcp.supplier_invoice_id
              )
              OR EXISTS (
                  SELECT 1
                  FROM public.supplier_credit_notes AS scn
                  WHERE scn.company_id = v_company_id
                    AND scn.supplier_account_id = p_id
                    AND scn.id = fcp.supplier_credit_note_id
              )
          )
        ORDER BY fcp.id FOR UPDATE;

        SELECT COUNT(*) INTO v_cnt FROM public.financial_commitments
        WHERE company_id = v_company_id
          AND supplier_account_id = p_id
          AND status IN ('Draft', 'Submitted', 'Approved')
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with active commitments.'; END IF;

        SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices
        WHERE company_id = v_company_id
          AND supplier_account_id = p_id
          AND status IN ('Draft', 'Submitted', 'Approved')
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with active invoices.'; END IF;

        SELECT COUNT(*) INTO v_cnt FROM public.supplier_credit_notes
        WHERE company_id = v_company_id
          AND supplier_account_id = p_id
          AND status IN ('Draft', 'Submitted', 'Approved')
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with active credit notes.'; END IF;

        SELECT COUNT(*) INTO v_cnt FROM public.supplier_payments
        WHERE company_id = v_company_id
          AND supplier_account_id = p_id
          AND status IN ('Draft', 'Submitted', 'Approved')
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with active payments.'; END IF;

        SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices AS si
        WHERE si.company_id = v_company_id
          AND si.supplier_account_id = p_id
          AND si.status = 'Posted'
          AND si.is_archived = false
          AND (
              si.total_incl_vat
              - COALESCE((
                  SELECT SUM(scn.total_incl_vat)
                  FROM public.supplier_credit_notes AS scn
                  WHERE scn.company_id = v_company_id
                    AND scn.invoice_id = si.id
                    AND scn.status = 'Posted'
                    AND scn.is_archived = false
              ), 0.00)
              - COALESCE((
                  SELECT SUM(spa.amount_allocated)
                  FROM public.supplier_payment_allocations AS spa
                  WHERE spa.company_id = v_company_id
                    AND spa.supplier_invoice_id = si.id
                    AND spa.status = 'Active'
              ), 0.00)
          ) > 0;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with outstanding posted invoices.'; END IF;

        SELECT COUNT(*) INTO v_cnt FROM public.supplier_payments AS sp
        WHERE sp.company_id = v_company_id
          AND sp.supplier_account_id = p_id
          AND sp.status = 'Posted'
          AND sp.is_archived = false
          AND (
              sp.amount_paid
              - COALESCE((
                  SELECT SUM(spa.amount_allocated)
                  FROM public.supplier_payment_allocations AS spa
                  WHERE spa.company_id = v_company_id
                    AND spa.supplier_payment_id = sp.id
                    AND spa.status = 'Active'
              ), 0.00)
          ) > 0;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive supplier with Posted payments that have an unallocated balance.'; END IF;

    ELSIF p_table = 'supplier_invoices' THEN
        IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
            RAISE EXCEPTION 'Cannot archive invoice in % status.', v_status;
        END IF;

        SELECT COUNT(*) INTO v_cnt
        FROM public.supplier_payment_allocations
        WHERE company_id = v_company_id
          AND supplier_invoice_id = p_id
          AND status = 'Active';
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive invoice with active payment allocations.'; END IF;

        SELECT COUNT(*) INTO v_cnt
        FROM public.supplier_credit_notes
        WHERE company_id = v_company_id
          AND invoice_id = p_id
          AND status = 'Posted'
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive invoice with posted credit notes.'; END IF;

    ELSIF p_table = 'supplier_invoice_lines' THEN
        SELECT sil.supplier_invoice_id, si.status, si.is_archived
        INTO v_parent_id, v_status, v_parent_archived
        FROM public.supplier_invoice_lines AS sil
        JOIN public.supplier_invoices AS si
          ON si.id = sil.supplier_invoice_id
         AND si.company_id = sil.company_id
         AND si.project_id = sil.project_id
        WHERE sil.id = p_id
          AND sil.company_id = v_company_id
        FOR SHARE OF si;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Supplier invoice line parent was not found or does not match its company and project.';
        END IF;
        IF v_parent_archived IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Supplier invoice line cannot be archived while its parent invoice is archived.';
        END IF;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Supplier invoice line cannot be archived when parent invoice status is %.', v_status;
        END IF;

    ELSIF p_table = 'supplier_credit_notes' THEN
        IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
            RAISE EXCEPTION 'Cannot archive credit note in % status.', v_status;
        END IF;

    ELSIF p_table = 'supplier_credit_note_lines' THEN
        SELECT scnl.credit_note_id, scn.status, scn.is_archived
        INTO v_parent_id, v_status, v_parent_archived
        FROM public.supplier_credit_note_lines AS scnl
        JOIN public.supplier_credit_notes AS scn
          ON scn.id = scnl.credit_note_id
         AND scn.company_id = scnl.company_id
         AND scn.project_id = scnl.project_id
        WHERE scnl.id = p_id
          AND scnl.company_id = v_company_id
        FOR SHARE OF scn;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Supplier credit note line parent was not found or does not match its company and project.';
        END IF;
        IF v_parent_archived IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Supplier credit note line cannot be archived while its parent credit note is archived.';
        END IF;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Supplier credit note line cannot be archived when parent credit note status is %.', v_status;
        END IF;

    ELSIF p_table = 'supplier_payments' THEN
        IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled', 'Posted', 'Reversed') THEN
            RAISE EXCEPTION 'Cannot archive payment in % status.', v_status;
        END IF;

        IF v_status = 'Posted' THEN
            SELECT sp.amount_paid - COALESCE(SUM(spa.amount_allocated), 0.00)
            INTO v_balance
            FROM public.supplier_payments AS sp
            LEFT JOIN public.supplier_payment_allocations AS spa
              ON spa.supplier_payment_id = sp.id
             AND spa.company_id = sp.company_id
             AND spa.status = 'Active'
            WHERE sp.id = p_id
              AND sp.company_id = v_company_id
            GROUP BY sp.amount_paid;
            IF round(v_balance, 2) > 0 THEN
                RAISE EXCEPTION 'Cannot archive a Posted payment with an unallocated balance.';
            END IF;
        END IF;
    END IF;

    -- Execute Archive mutation
    v_sql := format('UPDATE public.%I SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table);
    EXECUTE v_sql INTO v_result USING p_id;

    RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION public.restore_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_company_id uuid;
    v_status text;
    v_is_archived boolean;
    v_parent_id uuid;
    v_parent_archived boolean;
    v_supplier_id uuid;
    v_commitment_id uuid;
    v_invoice_id uuid;
    v_credit_note_id uuid;
    v_sql text;
    v_result jsonb;
BEGIN
    IF p_table IS NULL OR p_id IS NULL THEN
        RAISE EXCEPTION 'Table name and record ID must be provided.';
    END IF;

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
        'client_credit_note_lines',
        'supplier_accounts',
        'supplier_invoices',
        'supplier_invoice_lines',
        'supplier_credit_notes',
        'supplier_credit_note_lines',
        'supplier_payments'
    ) THEN
        RAISE EXCEPTION 'Table % is not eligible for soft restore.', p_table;
    END IF;

    -- Fetch record & lock
    v_sql := format('SELECT company_id, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table);
    EXECUTE v_sql INTO v_company_id, v_is_archived USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % in table % was not found.', p_id, p_table;
    END IF;

    IF v_is_archived IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Record is not archived.';
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance permissions for company %.', v_company_id;
    END IF;

    -- Operational write billing guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Pre-lock contexts for supplier child tables
    IF p_table = 'supplier_invoices' THEN
        SELECT supplier_account_id, financial_commitment_id
        INTO v_supplier_id, v_commitment_id
        FROM public.supplier_invoices
        WHERE id = p_id
          AND company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice supplier context is invalid.'; END IF;
        PERFORM 1 FROM public.financial_commitments
        WHERE id = v_commitment_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice commitment context is invalid.'; END IF;
    ELSIF p_table = 'supplier_invoice_lines' THEN
        SELECT si.id, si.supplier_account_id, si.financial_commitment_id
        INTO v_invoice_id, v_supplier_id, v_commitment_id
        FROM public.supplier_invoice_lines AS sil
        JOIN public.supplier_invoices AS si
          ON si.id = sil.supplier_invoice_id
         AND si.company_id = sil.company_id
         AND si.project_id = sil.project_id
        WHERE sil.id = p_id
          AND sil.company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Invoice line % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice line supplier context is invalid.'; END IF;
        PERFORM 1 FROM public.financial_commitments
        WHERE id = v_commitment_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier invoice line commitment context is invalid.'; END IF;
    ELSIF p_table = 'supplier_credit_notes' THEN
        SELECT supplier_account_id, financial_commitment_id, invoice_id
        INTO v_supplier_id, v_commitment_id, v_invoice_id
        FROM public.supplier_credit_notes
        WHERE id = p_id
          AND company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note supplier context is invalid.'; END IF;
        PERFORM 1 FROM public.financial_commitments
        WHERE id = v_commitment_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note commitment context is invalid.'; END IF;
        PERFORM 1 FROM public.supplier_invoices
        WHERE id = v_invoice_id
          AND company_id = v_company_id
          AND supplier_account_id = v_supplier_id
        FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note invoice context is invalid.'; END IF;
    ELSIF p_table = 'supplier_credit_note_lines' THEN
        SELECT scn.id, scn.supplier_account_id, scn.financial_commitment_id, scn.invoice_id
        INTO v_credit_note_id, v_supplier_id, v_commitment_id, v_invoice_id
        FROM public.supplier_credit_note_lines AS scnl
        JOIN public.supplier_credit_notes AS scn
          ON scn.id = scnl.credit_note_id
         AND scn.company_id = scnl.company_id
         AND scn.project_id = scnl.project_id
        WHERE scnl.id = p_id
          AND scnl.company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Credit note line % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note line supplier context is invalid.'; END IF;
        PERFORM 1 FROM public.financial_commitments
        WHERE id = v_commitment_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note line commitment context is invalid.'; END IF;
        PERFORM 1 FROM public.supplier_invoices
        WHERE id = v_invoice_id
          AND company_id = v_company_id
          AND supplier_account_id = v_supplier_id
        FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier credit note line invoice context is invalid.'; END IF;
    ELSIF p_table = 'supplier_payments' THEN
        SELECT supplier_account_id INTO v_supplier_id
        FROM public.supplier_payments
        WHERE id = p_id
          AND company_id = v_company_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Payment % not found.', p_id; END IF;
        PERFORM 1 FROM public.supplier_accounts
        WHERE id = v_supplier_id AND company_id = v_company_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Supplier payment supplier context is invalid.'; END IF;
    END IF;

    -- Table-specific status & eligibility validations
    IF p_table IN (
        'project_budget_versions',
        'financial_commitments',
        'financial_cost_postings',
        'project_financial_forecasts',
        'project_client_contracts',
        'client_invoices',
        'client_credit_notes',
        'client_receipts',
        'supplier_invoices',
        'supplier_credit_notes',
        'supplier_payments'
    ) THEN
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
        RAISE EXCEPTION 'Forecast cannot be restored in status %.', v_status;
    ELSIF p_table = 'project_client_contracts' AND v_status NOT IN ('Draft', 'Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Contract cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_invoices' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Client invoice cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_credit_notes' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Credit note cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_receipts' AND v_status NOT IN ('Draft', 'Cancelled') THEN
        RAISE EXCEPTION 'Receipt cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_invoice_lines' THEN
        SELECT cil.invoice_id, ci.status, ci.is_archived
        INTO v_parent_id, v_status, v_parent_archived
        FROM public.client_invoice_lines AS cil
        JOIN public.client_invoices AS ci
          ON ci.id = cil.invoice_id
         AND ci.company_id = cil.company_id
         AND ci.project_id = cil.project_id
        WHERE cil.id = p_id
          AND cil.company_id = v_company_id
        FOR SHARE OF ci;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invoice line parent invoice was not found or does not match its company and project.';
        END IF;
        IF v_parent_archived IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Invoice line cannot be restored while its parent invoice is archived.';
        END IF;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Invoice line cannot be restored when parent invoice status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_credit_note_lines' THEN
        SELECT ccnl.credit_note_id, ccn.status, ccn.is_archived
        INTO v_parent_id, v_status, v_parent_archived
        FROM public.client_credit_note_lines AS ccnl
        JOIN public.client_credit_notes AS ccn
          ON ccn.id = ccnl.credit_note_id
         AND ccn.company_id = ccnl.company_id
         AND ccn.project_id = ccnl.project_id
        WHERE ccnl.id = p_id
          AND ccnl.company_id = v_company_id
        FOR SHARE OF ccn;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Credit note line parent was not found or does not match its company and project.';
        END IF;
        IF v_parent_archived IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Credit note line cannot be restored while its parent credit note is archived.';
        END IF;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Credit note line cannot be restored when parent credit note status is %.', v_status;
        END IF;
    ELSIF p_table = 'supplier_invoices' THEN
        IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
            RAISE EXCEPTION 'Supplier invoice cannot be restored in status %.', v_status;
        END IF;
    ELSIF p_table = 'supplier_invoice_lines' THEN
        SELECT sil.supplier_invoice_id, si.status, si.is_archived
        INTO v_parent_id, v_status, v_parent_archived
        FROM public.supplier_invoice_lines AS sil
        JOIN public.supplier_invoices AS si
          ON si.id = sil.supplier_invoice_id
         AND si.company_id = sil.company_id
         AND si.project_id = sil.project_id
        WHERE sil.id = p_id
          AND sil.company_id = v_company_id
        FOR SHARE OF si;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Supplier invoice line parent was not found or does not match its company and project.';
        END IF;
        IF v_parent_archived IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Supplier invoice line cannot be restored while its parent invoice is archived.';
        END IF;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Supplier invoice line cannot be restored when parent invoice status is %.', v_status;
        END IF;
    ELSIF p_table = 'supplier_credit_notes' THEN
        IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
            RAISE EXCEPTION 'Supplier credit note cannot be restored in status %.', v_status;
        END IF;
    ELSIF p_table = 'supplier_credit_note_lines' THEN
        SELECT scnl.credit_note_id, scn.status, scn.is_archived
        INTO v_parent_id, v_status, v_parent_archived
        FROM public.supplier_credit_note_lines AS scnl
        JOIN public.supplier_credit_notes AS scn
          ON scn.id = scnl.credit_note_id
         AND scn.company_id = scnl.company_id
         AND scn.project_id = scnl.project_id
        WHERE scnl.id = p_id
          AND scnl.company_id = v_company_id
        FOR SHARE OF scn;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Supplier credit note line parent was not found or does not match its company and project.';
        END IF;
        IF v_parent_archived IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Supplier credit note line cannot be restored while its parent credit note is archived.';
        END IF;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Supplier credit note line cannot be restored when parent credit note status is %.', v_status;
        END IF;
    ELSIF p_table = 'supplier_payments' THEN
        IF v_status NOT IN ('Draft', 'Rejected', 'Cancelled', 'Posted', 'Reversed') THEN
            RAISE EXCEPTION 'Supplier payment cannot be restored in status %.', v_status;
        END IF;
    END IF;

    -- Execute Restore mutation
    v_sql := format('UPDATE public.%I SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table);
    EXECUTE v_sql INTO v_result USING p_id;

    RETURN v_result;
END;
$$;


-- ============================================================================
-- SECTION 5: OPTIMISTIC LOCKING VERSIONED OVERLOADS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_supplier_account(p_supplier_account_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_accounts', p_supplier_account_id, p_expected_version);
  RETURN public.activate_supplier_account(p_supplier_account_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_supplier_account(p_supplier_account_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_accounts', p_supplier_account_id, p_expected_version);
  RETURN public.deactivate_supplier_account(p_supplier_account_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_supplier_invoice(p_invoice_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_invoices', p_invoice_id, p_expected_version);
  RETURN public.submit_supplier_invoice(p_invoice_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_supplier_invoice(p_invoice_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_invoices', p_invoice_id, p_expected_version);
  RETURN public.approve_supplier_invoice(p_invoice_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.post_supplier_invoice(p_invoice_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_invoices', p_invoice_id, p_expected_version);
  RETURN public.post_supplier_invoice(p_invoice_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_supplier_invoice(p_invoice_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_invoices', p_invoice_id, p_expected_version);
  RETURN public.reject_supplier_invoice(p_invoice_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_supplier_invoice(p_invoice_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_invoices', p_invoice_id, p_expected_version);
  RETURN public.cancel_supplier_invoice(p_invoice_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_supplier_credit_note(p_credit_note_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_credit_notes', p_credit_note_id, p_expected_version);
  RETURN public.submit_supplier_credit_note(p_credit_note_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_supplier_credit_note(p_credit_note_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_credit_notes', p_credit_note_id, p_expected_version);
  RETURN public.approve_supplier_credit_note(p_credit_note_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.post_supplier_credit_note(p_credit_note_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_credit_notes', p_credit_note_id, p_expected_version);
  RETURN public.post_supplier_credit_note(p_credit_note_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_supplier_credit_note(p_credit_note_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_credit_notes', p_credit_note_id, p_expected_version);
  RETURN public.reject_supplier_credit_note(p_credit_note_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_supplier_credit_note(p_credit_note_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_credit_notes', p_credit_note_id, p_expected_version);
  RETURN public.cancel_supplier_credit_note(p_credit_note_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_supplier_payment(p_payment_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_payments', p_payment_id, p_expected_version);
  RETURN public.submit_supplier_payment(p_payment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_supplier_payment(p_payment_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_payments', p_payment_id, p_expected_version);
  RETURN public.approve_supplier_payment(p_payment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.post_supplier_payment(p_payment_id uuid, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_payments', p_payment_id, p_expected_version);
  RETURN public.post_supplier_payment(p_payment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_supplier_payment(p_payment_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_payments', p_payment_id, p_expected_version);
  RETURN public.reject_supplier_payment(p_payment_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_supplier_payment(p_payment_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_payments', p_payment_id, p_expected_version);
  RETURN public.cancel_supplier_payment(p_payment_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_supplier_payment(p_payment_id uuid, p_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_payments', p_payment_id, p_expected_version);
  RETURN public.reverse_supplier_payment(p_payment_id, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_supplier_payment_allocation(p_allocation_id uuid, p_reversal_reason text, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.fn_assert_supplier_version('supplier_payment_allocations', p_allocation_id, p_expected_version);
  RETURN public.reverse_supplier_payment_allocation(p_allocation_id, p_reversal_reason);
END;
$$;


-- ============================================================================
-- SECTION 6: PERMISSIONS AND EXECUTION GRANTS
-- ============================================================================

-- SA / SI / SCN / SP RPCs
REVOKE ALL ON FUNCTION public.activate_supplier_account(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_supplier_account(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.activate_supplier_account(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_supplier_account(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.deactivate_supplier_account(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_supplier_account(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.deactivate_supplier_account(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_supplier_account(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.associate_commitment_supplier(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.associate_commitment_supplier(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_invoice(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_supplier_invoice(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_invoice(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_supplier_invoice(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_supplier_invoice(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_supplier_invoice(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_supplier_invoice(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_supplier_invoice(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.post_supplier_invoice(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_supplier_invoice(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.post_supplier_invoice(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_supplier_invoice(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_supplier_invoice(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_supplier_invoice(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_supplier_invoice(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_supplier_invoice(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_supplier_invoice(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_invoice(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_supplier_invoice(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_invoice(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_credit_note(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_supplier_credit_note(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_credit_note(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_supplier_credit_note(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_supplier_credit_note(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_supplier_credit_note(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_supplier_credit_note(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_supplier_credit_note(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.post_supplier_credit_note(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_supplier_credit_note(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.post_supplier_credit_note(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_supplier_credit_note(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_supplier_credit_note(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_supplier_credit_note(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_supplier_credit_note(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_supplier_credit_note(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_supplier_credit_note(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_credit_note(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_supplier_credit_note(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_credit_note(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_payment(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_supplier_payment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_payment(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_supplier_payment(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_supplier_payment(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_supplier_payment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_supplier_payment(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_supplier_payment(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.post_supplier_payment(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_supplier_payment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.post_supplier_payment(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_supplier_payment(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_supplier_payment(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_supplier_payment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_supplier_payment(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_supplier_payment(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_supplier_payment(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_payment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_supplier_payment(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_payment(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_supplier_payment(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_supplier_payment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_supplier_payment(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_supplier_payment(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.allocate_supplier_payment(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.allocate_supplier_payment(uuid, uuid, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_supplier_payment_allocation(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_supplier_payment_allocation(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_supplier_payment_allocation(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_supplier_payment_allocation(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.close_financial_commitment(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_financial_commitment(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_financial_commitment(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_financial_commitment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_finance_record(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_finance_record(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_finance_record(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_finance_record(text, uuid) TO authenticated;

COMMIT;



