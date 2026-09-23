-- Migration: 20260726000001_project_budget_versions_permissions.sql
-- Description:
-- Grants explicit table-level SELECT, INSERT, UPDATE permissions to authenticated users
-- for project_budget_versions and all Accounts module tables, ensuring Supabase API access
-- works reliably while preserving Row Level Security (RLS) enforcement.
--
-- Security model:
--   - RLS remains ENABLED and FORCED on all tables.
--   - Privileges are granted at table level for SELECT, INSERT, UPDATE.
--   - DELETE remains REVOKED from authenticated.
--   - RLS policies continue to restrict access to finance-authorized company records.

BEGIN;

-- ============================================================================
-- 1. SCHEMA USAGE
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- 2. BUDGETS & CORE FINANCIAL TABLES (Phase 2B.1)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_budget_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_budget_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.financial_commitments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.financial_cost_postings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_financial_forecasts TO authenticated;
GRANT SELECT ON TABLE public.finance_audit_log TO authenticated;

REVOKE DELETE ON TABLE public.project_budget_versions FROM authenticated;
REVOKE DELETE ON TABLE public.project_budget_lines FROM authenticated;
REVOKE DELETE ON TABLE public.financial_commitments FROM authenticated;
REVOKE DELETE ON TABLE public.financial_cost_postings FROM authenticated;
REVOKE DELETE ON TABLE public.project_financial_forecasts FROM authenticated;
REVOKE DELETE ON TABLE public.finance_audit_log FROM authenticated;

ALTER TABLE public.project_budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.project_budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE public.financial_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_commitments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.financial_cost_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cost_postings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.project_financial_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_financial_forecasts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_log FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CLIENT ACCOUNTS TABLES (Phase 2C.1)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_client_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_invoice_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_credit_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_credit_note_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_receipt_allocations TO authenticated;
GRANT SELECT ON TABLE public.client_accounts_audit_log TO authenticated;

REVOKE DELETE ON TABLE public.client_accounts FROM authenticated;
REVOKE DELETE ON TABLE public.project_client_contracts FROM authenticated;
REVOKE DELETE ON TABLE public.client_invoices FROM authenticated;
REVOKE DELETE ON TABLE public.client_invoice_lines FROM authenticated;
REVOKE DELETE ON TABLE public.client_credit_notes FROM authenticated;
REVOKE DELETE ON TABLE public.client_credit_note_lines FROM authenticated;
REVOKE DELETE ON TABLE public.client_receipts FROM authenticated;
REVOKE DELETE ON TABLE public.client_receipt_allocations FROM authenticated;
REVOKE DELETE ON TABLE public.client_accounts_audit_log FROM authenticated;

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

-- ============================================================================
-- 4. SUPPLIER ACCOUNTS TABLES (Phase 2C.2)
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_invoice_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_credit_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_credit_note_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_payment_allocations TO authenticated;
GRANT SELECT ON TABLE public.supplier_accounts_audit_log TO authenticated;

REVOKE DELETE ON TABLE public.supplier_accounts FROM authenticated;
REVOKE DELETE ON TABLE public.supplier_invoices FROM authenticated;
REVOKE DELETE ON TABLE public.supplier_invoice_lines FROM authenticated;
REVOKE DELETE ON TABLE public.supplier_credit_notes FROM authenticated;
REVOKE DELETE ON TABLE public.supplier_credit_note_lines FROM authenticated;
REVOKE DELETE ON TABLE public.supplier_payments FROM authenticated;
REVOKE DELETE ON TABLE public.supplier_payment_allocations FROM authenticated;
REVOKE DELETE ON TABLE public.supplier_accounts_audit_log FROM authenticated;

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

COMMIT;
