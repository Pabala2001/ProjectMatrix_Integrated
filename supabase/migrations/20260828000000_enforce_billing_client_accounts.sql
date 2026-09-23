-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1D
-- Migration: Enforce Billing Operational Write Access on Client Accounts
-- Filename: 20260828000000_enforce_billing_client_accounts.sql
--
-- Target tables:
--   1. public.client_accounts
--   2. public.project_client_contracts
--   3. public.client_invoices
--   4. public.client_invoice_lines
--   5. public.client_credit_notes
--   6. public.client_credit_note_lines
--   7. public.client_receipts
--   8. public.client_receipt_allocations
--
-- Enforcement model:
--   - Existing authorization and SELECT policies remain intact.
--   - Separate RESTRICTIVE INSERT, UPDATE and DELETE policies require an
--     operational Billing entitlement for every authenticated write.
--   - Child-table guards also validate their authoritative parent records.
--   - All 20 mutating SECURITY DEFINER RPCs explicitly enforce Billing and
--     raise SQLSTATE PM001 when the company is read-only.
--   - Shared archive/restore support is extended without removing the Core
--     Finance tables installed by the preceding migration.
--
-- Security:
--   - Empty search_path on every SECURITY DEFINER function.
--   - Schema-qualified application relations and functions.
--   - RPC execution limited to authenticated users.
--   - Fail-closed prerequisite validation before any policy or RPC replacement.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. FAIL-CLOSED PREREQUISITE CHECK
-- ============================================================================

DO $migration_guard$
DECLARE
    v_missing text;
BEGIN
    SELECT pg_catalog.string_agg(required_object, ', ' ORDER BY required_object)
    INTO v_missing
    FROM (
        VALUES
            ('table public.client_accounts', pg_catalog.to_regclass('public.client_accounts') IS NOT NULL),
            ('table public.project_client_contracts', pg_catalog.to_regclass('public.project_client_contracts') IS NOT NULL),
            ('table public.client_invoices', pg_catalog.to_regclass('public.client_invoices') IS NOT NULL),
            ('table public.client_invoice_lines', pg_catalog.to_regclass('public.client_invoice_lines') IS NOT NULL),
            ('table public.client_credit_notes', pg_catalog.to_regclass('public.client_credit_notes') IS NOT NULL),
            ('table public.client_credit_note_lines', pg_catalog.to_regclass('public.client_credit_note_lines') IS NOT NULL),
            ('table public.client_receipts', pg_catalog.to_regclass('public.client_receipts') IS NOT NULL),
            ('table public.client_receipt_allocations', pg_catalog.to_regclass('public.client_receipt_allocations') IS NOT NULL),
            ('function public.has_finance_full_access(uuid)', pg_catalog.to_regprocedure('public.has_finance_full_access(uuid)') IS NOT NULL),
            ('function public.company_billing_allows_operational_write(uuid)', pg_catalog.to_regprocedure('public.company_billing_allows_operational_write(uuid)') IS NOT NULL),
            ('function public.activate_client_contract(uuid)', pg_catalog.to_regprocedure('public.activate_client_contract(uuid)') IS NOT NULL),
            ('function public.close_client_contract(uuid)', pg_catalog.to_regprocedure('public.close_client_contract(uuid)') IS NOT NULL),
            ('function public.cancel_client_contract(uuid,text)', pg_catalog.to_regprocedure('public.cancel_client_contract(uuid,text)') IS NOT NULL),
            ('function public.submit_client_invoice(uuid)', pg_catalog.to_regprocedure('public.submit_client_invoice(uuid)') IS NOT NULL),
            ('function public.approve_client_invoice(uuid)', pg_catalog.to_regprocedure('public.approve_client_invoice(uuid)') IS NOT NULL),
            ('function public.reject_client_invoice(uuid,text)', pg_catalog.to_regprocedure('public.reject_client_invoice(uuid,text)') IS NOT NULL),
            ('function public.issue_client_invoice(uuid)', pg_catalog.to_regprocedure('public.issue_client_invoice(uuid)') IS NOT NULL),
            ('function public.cancel_client_invoice(uuid,text)', pg_catalog.to_regprocedure('public.cancel_client_invoice(uuid,text)') IS NOT NULL),
            ('function public.submit_client_credit_note(uuid)', pg_catalog.to_regprocedure('public.submit_client_credit_note(uuid)') IS NOT NULL),
            ('function public.approve_client_credit_note(uuid)', pg_catalog.to_regprocedure('public.approve_client_credit_note(uuid)') IS NOT NULL),
            ('function public.reject_client_credit_note(uuid,text)', pg_catalog.to_regprocedure('public.reject_client_credit_note(uuid,text)') IS NOT NULL),
            ('function public.issue_client_credit_note(uuid)', pg_catalog.to_regprocedure('public.issue_client_credit_note(uuid)') IS NOT NULL),
            ('function public.cancel_client_credit_note(uuid,text)', pg_catalog.to_regprocedure('public.cancel_client_credit_note(uuid,text)') IS NOT NULL),
            ('function public.post_client_receipt(uuid)', pg_catalog.to_regprocedure('public.post_client_receipt(uuid)') IS NOT NULL),
            ('function public.reverse_client_receipt(uuid,text)', pg_catalog.to_regprocedure('public.reverse_client_receipt(uuid,text)') IS NOT NULL),
            ('function public.cancel_client_receipt(uuid,text)', pg_catalog.to_regprocedure('public.cancel_client_receipt(uuid,text)') IS NOT NULL),
            ('function public.allocate_client_receipt(uuid,uuid,numeric)', pg_catalog.to_regprocedure('public.allocate_client_receipt(uuid,uuid,numeric)') IS NOT NULL),
            ('function public.reverse_client_receipt_allocation(uuid,text)', pg_catalog.to_regprocedure('public.reverse_client_receipt_allocation(uuid,text)') IS NOT NULL),
            ('function public.archive_finance_record(text,uuid)', pg_catalog.to_regprocedure('public.archive_finance_record(text,uuid)') IS NOT NULL),
            ('function public.restore_finance_record(text,uuid)', pg_catalog.to_regprocedure('public.restore_finance_record(text,uuid)') IS NOT NULL)
    ) AS prerequisites(required_object, is_present)
    WHERE NOT is_present;

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Client Accounts Billing migration prerequisites are missing: %', v_missing
            USING ERRCODE = 'P0001';
    END IF;
END;
$migration_guard$;


-- ============================================================================
-- 1. RESTRICTIVE RLS BILLING AND PARENT-INTEGRITY GUARDS
-- ============================================================================

-- Existing authorization and SELECT policies are intentionally preserved.
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_receipt_allocations ENABLE ROW LEVEL SECURITY;

-- 1.1 client_accounts
DROP POLICY IF EXISTS billing_operational_write_insert ON public.client_accounts;
CREATE POLICY billing_operational_write_insert ON public.client_accounts
    AS RESTRICTIVE
    FOR INSERT TO authenticated
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_update ON public.client_accounts;
CREATE POLICY billing_operational_write_update ON public.client_accounts
    AS RESTRICTIVE
    FOR UPDATE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id))
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_delete ON public.client_accounts;
CREATE POLICY billing_operational_write_delete ON public.client_accounts
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id));

-- 1.2 project_client_contracts
DROP POLICY IF EXISTS billing_operational_write_insert ON public.project_client_contracts;
CREATE POLICY billing_operational_write_insert ON public.project_client_contracts
    AS RESTRICTIVE
    FOR INSERT TO authenticated
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_update ON public.project_client_contracts;
CREATE POLICY billing_operational_write_update ON public.project_client_contracts
    AS RESTRICTIVE
    FOR UPDATE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id))
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_delete ON public.project_client_contracts;
CREATE POLICY billing_operational_write_delete ON public.project_client_contracts
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id));

-- 1.3 client_invoices
DROP POLICY IF EXISTS billing_operational_write_insert ON public.client_invoices;
CREATE POLICY billing_operational_write_insert ON public.client_invoices
    AS RESTRICTIVE
    FOR INSERT TO authenticated
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_update ON public.client_invoices;
CREATE POLICY billing_operational_write_update ON public.client_invoices
    AS RESTRICTIVE
    FOR UPDATE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id))
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_delete ON public.client_invoices;
CREATE POLICY billing_operational_write_delete ON public.client_invoices
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id));

-- 1.4 client_invoice_lines — authoritative parent: client_invoices
DROP POLICY IF EXISTS billing_operational_write_insert ON public.client_invoice_lines;
CREATE POLICY billing_operational_write_insert ON public.client_invoice_lines
    AS RESTRICTIVE
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_invoices AS ci
            WHERE ci.id = client_invoice_lines.invoice_id
              AND ci.company_id = client_invoice_lines.company_id
              AND ci.project_id = client_invoice_lines.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.client_invoice_lines;
CREATE POLICY billing_operational_write_update ON public.client_invoice_lines
    AS RESTRICTIVE
    FOR UPDATE TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_invoices AS ci
            WHERE ci.id = client_invoice_lines.invoice_id
              AND ci.company_id = client_invoice_lines.company_id
              AND ci.project_id = client_invoice_lines.project_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_invoices AS ci
            WHERE ci.id = client_invoice_lines.invoice_id
              AND ci.company_id = client_invoice_lines.company_id
              AND ci.project_id = client_invoice_lines.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.client_invoice_lines;
CREATE POLICY billing_operational_write_delete ON public.client_invoice_lines
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_invoices AS ci
            WHERE ci.id = client_invoice_lines.invoice_id
              AND ci.company_id = client_invoice_lines.company_id
              AND ci.project_id = client_invoice_lines.project_id
        )
    );

-- 1.5 client_credit_notes
DROP POLICY IF EXISTS billing_operational_write_insert ON public.client_credit_notes;
CREATE POLICY billing_operational_write_insert ON public.client_credit_notes
    AS RESTRICTIVE
    FOR INSERT TO authenticated
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_update ON public.client_credit_notes;
CREATE POLICY billing_operational_write_update ON public.client_credit_notes
    AS RESTRICTIVE
    FOR UPDATE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id))
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_delete ON public.client_credit_notes;
CREATE POLICY billing_operational_write_delete ON public.client_credit_notes
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id));

-- 1.6 client_credit_note_lines — authoritative parent: client_credit_notes
DROP POLICY IF EXISTS billing_operational_write_insert ON public.client_credit_note_lines;
CREATE POLICY billing_operational_write_insert ON public.client_credit_note_lines
    AS RESTRICTIVE
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_credit_notes AS ccn
            WHERE ccn.id = client_credit_note_lines.credit_note_id
              AND ccn.company_id = client_credit_note_lines.company_id
              AND ccn.project_id = client_credit_note_lines.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.client_credit_note_lines;
CREATE POLICY billing_operational_write_update ON public.client_credit_note_lines
    AS RESTRICTIVE
    FOR UPDATE TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_credit_notes AS ccn
            WHERE ccn.id = client_credit_note_lines.credit_note_id
              AND ccn.company_id = client_credit_note_lines.company_id
              AND ccn.project_id = client_credit_note_lines.project_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_credit_notes AS ccn
            WHERE ccn.id = client_credit_note_lines.credit_note_id
              AND ccn.company_id = client_credit_note_lines.company_id
              AND ccn.project_id = client_credit_note_lines.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.client_credit_note_lines;
CREATE POLICY billing_operational_write_delete ON public.client_credit_note_lines
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_credit_notes AS ccn
            WHERE ccn.id = client_credit_note_lines.credit_note_id
              AND ccn.company_id = client_credit_note_lines.company_id
              AND ccn.project_id = client_credit_note_lines.project_id
        )
    );

-- 1.7 client_receipts
DROP POLICY IF EXISTS billing_operational_write_insert ON public.client_receipts;
CREATE POLICY billing_operational_write_insert ON public.client_receipts
    AS RESTRICTIVE
    FOR INSERT TO authenticated
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_update ON public.client_receipts;
CREATE POLICY billing_operational_write_update ON public.client_receipts
    AS RESTRICTIVE
    FOR UPDATE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id))
    WITH CHECK (public.company_billing_allows_operational_write(company_id));

DROP POLICY IF EXISTS billing_operational_write_delete ON public.client_receipts;
CREATE POLICY billing_operational_write_delete ON public.client_receipts
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (public.company_billing_allows_operational_write(company_id));

-- 1.8 client_receipt_allocations — authoritative parents: receipt and invoice
DROP POLICY IF EXISTS billing_operational_write_insert ON public.client_receipt_allocations;
CREATE POLICY billing_operational_write_insert ON public.client_receipt_allocations
    AS RESTRICTIVE
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_receipts AS cr
            WHERE cr.id = client_receipt_allocations.receipt_id
              AND cr.company_id = client_receipt_allocations.company_id
              AND cr.project_id = client_receipt_allocations.project_id
              AND cr.client_account_id = client_receipt_allocations.client_account_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.client_invoices AS ci
            WHERE ci.id = client_receipt_allocations.invoice_id
              AND ci.company_id = client_receipt_allocations.company_id
              AND ci.project_id = client_receipt_allocations.project_id
              AND ci.client_account_id = client_receipt_allocations.client_account_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.client_receipt_allocations;
CREATE POLICY billing_operational_write_update ON public.client_receipt_allocations
    AS RESTRICTIVE
    FOR UPDATE TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_receipts AS cr
            WHERE cr.id = client_receipt_allocations.receipt_id
              AND cr.company_id = client_receipt_allocations.company_id
              AND cr.project_id = client_receipt_allocations.project_id
              AND cr.client_account_id = client_receipt_allocations.client_account_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.client_invoices AS ci
            WHERE ci.id = client_receipt_allocations.invoice_id
              AND ci.company_id = client_receipt_allocations.company_id
              AND ci.project_id = client_receipt_allocations.project_id
              AND ci.client_account_id = client_receipt_allocations.client_account_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_receipts AS cr
            WHERE cr.id = client_receipt_allocations.receipt_id
              AND cr.company_id = client_receipt_allocations.company_id
              AND cr.project_id = client_receipt_allocations.project_id
              AND cr.client_account_id = client_receipt_allocations.client_account_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.client_invoices AS ci
            WHERE ci.id = client_receipt_allocations.invoice_id
              AND ci.company_id = client_receipt_allocations.company_id
              AND ci.project_id = client_receipt_allocations.project_id
              AND ci.client_account_id = client_receipt_allocations.client_account_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.client_receipt_allocations;
CREATE POLICY billing_operational_write_delete ON public.client_receipt_allocations
    AS RESTRICTIVE
    FOR DELETE TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.client_receipts AS cr
            WHERE cr.id = client_receipt_allocations.receipt_id
              AND cr.company_id = client_receipt_allocations.company_id
              AND cr.project_id = client_receipt_allocations.project_id
              AND cr.client_account_id = client_receipt_allocations.client_account_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.client_invoices AS ci
            WHERE ci.id = client_receipt_allocations.invoice_id
              AND ci.company_id = client_receipt_allocations.company_id
              AND ci.project_id = client_receipt_allocations.project_id
              AND ci.client_account_id = client_receipt_allocations.client_account_id
        )
    );


-- 2. MUTATING SECURITY DEFINER RPCs WITH BILLING WRITE ENFORCEMENT
-- ============================================================================

-- 2.1 CONTRACT WORKFLOWS

CREATE OR REPLACE FUNCTION public.activate_client_contract(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.activate_client_contract(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_client_contract(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.close_client_contract(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.close_client_contract(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_client_contract(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_client_contract(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.cancel_client_contract(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_contract(uuid, text) TO authenticated;


-- 2.2 INVOICE WORKFLOWS

CREATE OR REPLACE FUNCTION public.submit_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.submit_client_invoice(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_client_invoice(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.approve_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.approve_client_invoice(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_client_invoice(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.reject_client_invoice(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reject_client_invoice(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_client_invoice(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.issue_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.issue_client_invoice(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_client_invoice(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_client_invoice(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.cancel_client_invoice(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_invoice(uuid, text) TO authenticated;


-- 2.3 CREDIT NOTE WORKFLOWS

CREATE OR REPLACE FUNCTION public.submit_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.submit_client_credit_note(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_client_credit_note(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.approve_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.approve_client_credit_note(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_client_credit_note(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.reject_client_credit_note(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reject_client_credit_note(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_client_credit_note(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.issue_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_cn.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.issue_client_credit_note(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_client_credit_note(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_client_credit_note(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.cancel_client_credit_note(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_credit_note(uuid, text) TO authenticated;


-- 2.4 RECEIPT WORKFLOWS

CREATE OR REPLACE FUNCTION public.post_client_receipt(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.post_client_receipt(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_client_receipt(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.reverse_client_receipt(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reverse_client_receipt(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_client_receipt(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_client_receipt(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.cancel_client_receipt(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_receipt(uuid, text) TO authenticated;


-- 2.5 RECEIPT ALLOCATION WORKFLOWS

CREATE OR REPLACE FUNCTION public.allocate_client_receipt(
    p_receipt_id uuid,
    p_invoice_id uuid,
    p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_inv public.client_invoices%ROWTYPE;
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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.allocate_client_receipt(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.allocate_client_receipt(uuid, uuid, numeric) TO authenticated;


CREATE OR REPLACE FUNCTION public.reverse_client_receipt_allocation(p_allocation_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF NOT public.company_billing_allows_operational_write(v_alloc.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reverse_client_receipt_allocation(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_client_receipt_allocation(uuid, text) TO authenticated;


-- ============================================================================
-- 3. SECURED ARCHIVE & RESTORE FUNCTIONS WITH CLIENT ACCOUNTS SUPPORT
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
    v_parent_archived boolean;
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

    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

        -- Check active contracts
        SELECT COUNT(*) INTO v_cnt
        FROM public.project_client_contracts
        WHERE company_id = v_company_id
          AND client_account_id = p_id
          AND status = 'Active'
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Active contracts.'; END IF;

        -- Check non-terminal invoices
        SELECT COUNT(*) INTO v_cnt
        FROM public.client_invoices
        WHERE company_id = v_company_id
          AND client_account_id = p_id
          AND status IN ('Draft', 'Submitted', 'Approved')
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with non-terminal invoices.'; END IF;

        -- Check non-terminal credit notes
        SELECT COUNT(*) INTO v_cnt
        FROM public.client_credit_notes
        WHERE company_id = v_company_id
          AND client_account_id = p_id
          AND status IN ('Draft', 'Submitted', 'Approved')
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with non-terminal credit notes.'; END IF;

        -- Check non-terminal receipts
        SELECT COUNT(*) INTO v_cnt
        FROM public.client_receipts
        WHERE company_id = v_company_id
          AND client_account_id = p_id
          AND status = 'Draft'
          AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with draft receipts.'; END IF;

        -- Check Issued invoices with outstanding balance
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

        -- Check Posted receipts with unallocated balance
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
    END IF;

    -- Execute Archive mutation
    v_sql := format('UPDATE public.%I SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table);
    EXECUTE v_sql INTO v_result USING p_id;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_finance_record(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_finance_record(text, uuid) TO authenticated;


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
    v_parent_archived boolean;
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
        RAISE EXCEPTION 'Table % is not eligible for soft restoration.', p_table;
    END IF;

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

    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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
    END IF;

    v_sql := format('UPDATE public.%I SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table);
    EXECUTE v_sql INTO v_result USING p_id;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_finance_record(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_finance_record(text, uuid) TO authenticated;

COMMIT;
