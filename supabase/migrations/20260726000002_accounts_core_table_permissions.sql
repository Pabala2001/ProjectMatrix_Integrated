-- Migration: 20260726000002_accounts_core_table_permissions.sql
-- Description:
-- Grants explicit table-level SELECT, INSERT, UPDATE permissions to authenticated users
-- for the core Accounts tables:
--   - public.project_budget_versions
--   - public.financial_commitments
--   - public.financial_cost_postings
--
-- This resolves PostgREST column privilege errors when inserting/updating rows
-- (e.g. permission denied on id, status, timestamps, or full-row operations)
-- while preserving strict Row Level Security (RLS) enforcement.
--
-- Security model:
--   - RLS remains ENABLED and FORCED on all three tables.
--   - Table-level SELECT, INSERT, UPDATE privileges are granted to authenticated.
--   - DELETE privileges remain REVOKED from authenticated.
--   - No privileges granted to anon.
--   - Existing RLS policies remain untouched and authoritative.

BEGIN;

-- ============================================================================
-- 1. SCHEMA USAGE
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- 2. TABLE-LEVEL PRIVILEGES FOR CORE ACCOUNTS TABLES
-- ============================================================================

-- project_budget_versions
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_budget_versions TO authenticated;
REVOKE DELETE ON TABLE public.project_budget_versions FROM authenticated;
ALTER TABLE public.project_budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_versions FORCE ROW LEVEL SECURITY;

-- financial_commitments
GRANT SELECT, INSERT, UPDATE ON TABLE public.financial_commitments TO authenticated;
REVOKE DELETE ON TABLE public.financial_commitments FROM authenticated;
ALTER TABLE public.financial_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_commitments FORCE ROW LEVEL SECURITY;

-- financial_cost_postings
GRANT SELECT, INSERT, UPDATE ON TABLE public.financial_cost_postings TO authenticated;
REVOKE DELETE ON TABLE public.financial_cost_postings FROM authenticated;
ALTER TABLE public.financial_cost_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cost_postings FORCE ROW LEVEL SECURITY;

COMMIT;
