-- ============================================================================
-- Migration: Verify Billing Access Database Helper
-- Filename: 20260729000000_verify_billing_access.sql
-- Description: Creates public.verify_billing_access(p_company_id UUID) to enforce
--              company-scoped role-based access control for Billing & Subscription management.
-- Authorised roles: CEO, COO, CFO, Director, Project Manager, Company Administrator.
-- Supported aliases: company_admin -> company_administrator.
-- Explicitly rejected without separators: projectmanager, companyadmin.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_billing_access(
    p_company_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT (
        auth.uid() IS NOT NULL
        AND p_company_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.company_members AS cm
            WHERE cm.company_id = p_company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_active IS TRUE
              AND (
                -- 1. Evaluate designation (normalized: trimmed, lowercase, spaces/hyphens/underscores -> _)
                (
                    regexp_replace(pg_catalog.lower(pg_catalog.btrim(COALESCE(cm.designation, ''))), '[\s\-_]+', '_', 'g') IN (
                        'ceo',
                        'coo',
                        'cfo',
                        'director',
                        'project_manager',
                        'company_administrator',
                        'company_admin'
                    )
                )
                OR
                -- 2. Evaluate legacy role independently
                (
                    regexp_replace(pg_catalog.lower(pg_catalog.btrim(COALESCE(cm.role, ''))), '[\s\-_]+', '_', 'g') IN (
                        'ceo',
                        'coo',
                        'cfo',
                        'director',
                        'project_manager',
                        'company_administrator',
                        'company_admin'
                    )
                )
              )
        )
    );
$$;

-- Revoke execution from PUBLIC and anon, grant only to authenticated
REVOKE ALL ON FUNCTION public.verify_billing_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_billing_access(UUID) TO authenticated;

COMMENT ON FUNCTION public.verify_billing_access(UUID) IS 
'Authorises Billing access for active members of the active company with roles: CEO, COO, CFO, Director, Project Manager, or Company Administrator (including legacy company_admin alias).';
