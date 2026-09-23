-- ============================================================================
-- Step 3C.4F-1M: Enforce Billing Access on Operational Storage
--
-- Protected Buckets:
--   1. accounts-documents
--   2. labour-payroll-files
--   3. technical-reports
--   4. quality-control-assets
--   5. quality-control-documents
--   6. communication-documents
--   7. site-diary-attachments
--   8. cashbook-attachments
--
-- Protected Table:
--   - public.accounts_attachments
--
-- Requirements:
--   - Replace every authenticated write policy affecting these buckets.
--   - Enforce public.company_billing_allows_operational_write(authoritative_company_id) on all write policies:
--       * INSERT: WITH CHECK
--       * UPDATE: USING and WITH CHECK
--       * DELETE: USING
--   - Preserve SELECT, download, listing, and export access unchanged.
--   - Authoritatively resolve company ID from canonical object path and parent database records (reject client metadata / unverified path segments).
--   - Validate active membership and parent-child agreement (reject malformed paths, invalid UUIDs, cross-tenant substitution).
--   - Ensure atomic rollback and no partial mutations.
--   - Use SET search_path = '' and fully qualified identifiers for all functions.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: STORAGE BUCKETS REGISTRATION
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('accounts-documents', 'accounts-documents', false),
  ('labour-payroll-files', 'labour-payroll-files', false),
  ('technical-reports', 'technical-reports', false),
  ('quality-control-assets', 'quality-control-assets', false),
  ('quality-control-documents', 'quality-control-documents', false),
  ('communication-documents', 'communication-documents', false),
  ('site-diary-attachments', 'site-diary-attachments', false),
  ('cashbook-attachments', 'cashbook-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================================================
-- SECTION 2: HARDENED HELPER FUNCTIONS (SET search_path = '')
-- ============================================================================

-- 2.1 Safe UUID Parser from Path Segment
CREATE OR REPLACE FUNCTION public.parse_storage_path_uuid(p_val text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
BEGIN
    IF p_val IS NULL THEN
        RETURN NULL;
    END IF;
    IF p_val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN p_val::uuid;
    END IF;
    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.parse_storage_path_uuid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parse_storage_path_uuid(text) TO authenticated, service_role;

-- 2.2 Reconcile accounts_company_id_from_storage_path with search_path = ''
CREATE OR REPLACE FUNCTION public.accounts_company_id_from_storage_path(storage_path text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
DECLARE
    first_segment text;
BEGIN
    IF storage_path IS NULL THEN
        RETURN NULL;
    END IF;
    first_segment := pg_catalog.split_part(storage_path, '/', 1);
    IF first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN first_segment::uuid;
    END IF;
    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.accounts_company_id_from_storage_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounts_company_id_from_storage_path(text) TO authenticated, service_role;

-- 2.3 Authoritative Company Resolver for technical-reports Bucket
CREATE OR REPLACE FUNCTION public.technical_reports_storage_resolve_company_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    seg1 text;
    seg2 text;
    parsed_uuid uuid;
BEGIN
    IF p_name IS NULL THEN
        RETURN NULL;
    END IF;
    seg1 := pg_catalog.split_part(p_name, '/', 1);
    seg2 := pg_catalog.split_part(p_name, '/', 2);

    IF seg1 = 'company-logos' THEN
        parsed_uuid := public.parse_storage_path_uuid(seg2);
        IF parsed_uuid IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE id = parsed_uuid) THEN
            RETURN parsed_uuid;
        END IF;
        RETURN NULL;
    END IF;

    parsed_uuid := public.parse_storage_path_uuid(seg1);
    IF parsed_uuid IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE id = parsed_uuid) THEN
        RETURN parsed_uuid;
    END IF;

    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.technical_reports_storage_resolve_company_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.technical_reports_storage_resolve_company_id(text) TO authenticated, service_role;

-- 2.4 Authoritative Company Resolver for quality-control-assets Bucket
CREATE OR REPLACE FUNCTION public.qc_assets_storage_resolve_company_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    seg1 text;
    seg2 text;
    seg3 text;
    resolved_id uuid;
BEGIN
    IF p_name IS NULL THEN
        RETURN NULL;
    END IF;
    seg1 := pg_catalog.split_part(p_name, '/', 1);
    seg2 := pg_catalog.split_part(p_name, '/', 2);
    seg3 := pg_catalog.split_part(p_name, '/', 3);

    -- Pattern 1: company-logos/<company_id>/<file>
    IF seg1 = 'company-logos' THEN
        resolved_id := public.parse_storage_path_uuid(seg2);
        IF resolved_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE id = resolved_id) THEN
            RETURN resolved_id;
        END IF;
        RETURN NULL;
    END IF;

    -- Pattern 2: signatures/<type>/<qc_record_id>/<file>
    IF seg1 = 'signatures' THEN
        resolved_id := public.parse_storage_path_uuid(seg3);
        IF resolved_id IS NOT NULL THEN
            SELECT company_id INTO resolved_id
            FROM public.quality_control_records
            WHERE id = resolved_id;
            RETURN resolved_id;
        END IF;
        RETURN NULL;
    END IF;

    -- Pattern 3: <company_id>/<project_id>/<file> or <company_id>/<file>
    resolved_id := public.parse_storage_path_uuid(seg1);
    IF resolved_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE id = resolved_id) THEN
        RETURN resolved_id;
    END IF;

    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.qc_assets_storage_resolve_company_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qc_assets_storage_resolve_company_id(text) TO authenticated, service_role;

-- 2.5 Authoritative Company Resolver for quality-control-documents Bucket
CREATE OR REPLACE FUNCTION public.qc_documents_storage_resolve_company_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    seg1 text;
    seg2 text;
    resolved_id uuid;
BEGIN
    IF p_name IS NULL THEN
        RETURN NULL;
    END IF;
    seg1 := pg_catalog.split_part(p_name, '/', 1);
    seg2 := pg_catalog.split_part(p_name, '/', 2);

    -- Pattern 1: <company_id>/<project_id>/<qc_record_id>/<file>
    resolved_id := public.parse_storage_path_uuid(seg1);
    IF resolved_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE id = resolved_id) THEN
        RETURN resolved_id;
    END IF;

    -- Pattern 2: <project_id>/<qc_record_id>/<file>
    IF resolved_id IS NOT NULL THEN
        SELECT company_id INTO resolved_id
        FROM public.projects
        WHERE id = resolved_id;
        IF resolved_id IS NOT NULL THEN
            -- If record ID is present, verify agreement
            IF public.parse_storage_path_uuid(seg2) IS NOT NULL THEN
                IF EXISTS (
                    SELECT 1 FROM public.quality_control_records qcr
                    WHERE qcr.id = public.parse_storage_path_uuid(seg2)
                      AND qcr.project_id = public.parse_storage_path_uuid(seg1)
                      AND qcr.company_id = resolved_id
                ) THEN
                    RETURN resolved_id;
                ELSE
                    RETURN NULL;
                END IF;
            END IF;
            RETURN resolved_id;
        END IF;
    END IF;

    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.qc_documents_storage_resolve_company_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qc_documents_storage_resolve_company_id(text) TO authenticated, service_role;

-- 2.6 Master Authoritative Company Resolver for Operational Storage
CREATE OR REPLACE FUNCTION public.storage_resolve_operational_company_id(
    p_bucket_id text,
    p_name text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_bucket_id IS NULL OR p_name IS NULL THEN
        RETURN NULL;
    END IF;

    CASE p_bucket_id
        WHEN 'accounts-documents' THEN
            RETURN public.accounts_company_id_from_storage_path(p_name);
        WHEN 'labour-payroll-files' THEN
            RETURN public.parse_storage_path_uuid(pg_catalog.split_part(p_name, '/', 1));
        WHEN 'technical-reports' THEN
            RETURN public.technical_reports_storage_resolve_company_id(p_name);
        WHEN 'quality-control-assets' THEN
            RETURN public.qc_assets_storage_resolve_company_id(p_name);
        WHEN 'quality-control-documents' THEN
            RETURN public.qc_documents_storage_resolve_company_id(p_name);
        WHEN 'communication-documents' THEN
            RETURN public.parse_storage_path_uuid(pg_catalog.split_part(p_name, '/', 1));
        WHEN 'site-diary-attachments' THEN
            RETURN public.parse_storage_path_uuid(pg_catalog.split_part(p_name, '/', 1));
        WHEN 'cashbook-attachments' THEN
            RETURN public.parse_storage_path_uuid(pg_catalog.split_part(p_name, '/', 1));
        ELSE
            RETURN NULL;
    END CASE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_resolve_operational_company_id(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_resolve_operational_company_id(text, text) TO authenticated, service_role;

-- ============================================================================
-- SECTION 3: RECONCILE TABLE RLS ON public.accounts_attachments
-- ============================================================================

ALTER TABLE public.accounts_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_accounts_attach_all ON public.accounts_attachments;
DROP POLICY IF EXISTS accounts_attachments_select ON public.accounts_attachments;
DROP POLICY IF EXISTS accounts_attachments_insert ON public.accounts_attachments;
DROP POLICY IF EXISTS accounts_attachments_update ON public.accounts_attachments;
DROP POLICY IF EXISTS accounts_attachments_delete ON public.accounts_attachments;

-- SELECT: Finance full access (unblocked for export and read-only mode)
CREATE POLICY accounts_attachments_select ON public.accounts_attachments
    FOR SELECT TO authenticated
    USING (
        public.has_finance_full_access(company_id)
    );

-- INSERT: Finance full access + company operational billing write access + path and project validation
CREATE POLICY accounts_attachments_insert ON public.accounts_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND (uploaded_by IS NULL OR uploaded_by = auth.uid())
        AND (
            storage_path IS NULL
            OR public.accounts_company_id_from_storage_path(storage_path) = company_id
        )
        AND (
            project_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = accounts_attachments.project_id
                  AND p.company_id = accounts_attachments.company_id
            )
        )
    );

-- UPDATE: Finance full access + company operational billing write access + path and project validation
CREATE POLICY accounts_attachments_update ON public.accounts_attachments
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND (
            storage_path IS NULL
            OR public.accounts_company_id_from_storage_path(storage_path) = company_id
        )
        AND (
            project_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = accounts_attachments.project_id
                  AND p.company_id = accounts_attachments.company_id
            )
        )
    );

-- DELETE: Finance full access + company operational billing write access
CREATE POLICY accounts_attachments_delete ON public.accounts_attachments
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- ============================================================================
-- SECTION 4: STORAGE OBJECTS RLS POLICIES FOR PROTECTED BUCKETS
-- ============================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4.1 Bucket: accounts-documents
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can select objects in accounts-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can insert objects in accounts-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update objects in accounts-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete objects in accounts-documents" ON storage.objects;
DROP POLICY IF EXISTS accounts_documents_select ON storage.objects;
DROP POLICY IF EXISTS accounts_documents_insert ON storage.objects;
DROP POLICY IF EXISTS accounts_documents_update ON storage.objects;
DROP POLICY IF EXISTS accounts_documents_delete_orphan ON storage.objects;
DROP POLICY IF EXISTS accounts_documents_delete ON storage.objects;

CREATE POLICY accounts_documents_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'accounts-documents'
        AND public.accounts_company_id_from_storage_path(name) IS NOT NULL
        AND public.has_finance_full_access(public.accounts_company_id_from_storage_path(name))
    );

CREATE POLICY accounts_documents_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'accounts-documents'
        AND public.accounts_company_id_from_storage_path(name) IS NOT NULL
        AND (
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
            OR EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                  AND p.company_id = public.accounts_company_id_from_storage_path(name)
            )
        )
        AND public.has_finance_full_access(public.accounts_company_id_from_storage_path(name))
        AND public.company_billing_allows_operational_write(public.accounts_company_id_from_storage_path(name))
    );

CREATE POLICY accounts_documents_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'accounts-documents'
        AND public.accounts_company_id_from_storage_path(name) IS NOT NULL
        AND (
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
            OR EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                  AND p.company_id = public.accounts_company_id_from_storage_path(name)
            )
        )
        AND public.has_finance_full_access(public.accounts_company_id_from_storage_path(name))
        AND public.company_billing_allows_operational_write(public.accounts_company_id_from_storage_path(name))
    )
    WITH CHECK (
        bucket_id = 'accounts-documents'
        AND public.accounts_company_id_from_storage_path(name) IS NOT NULL
        AND (
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
            OR EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                  AND p.company_id = public.accounts_company_id_from_storage_path(name)
            )
        )
        AND public.has_finance_full_access(public.accounts_company_id_from_storage_path(name))
        AND public.company_billing_allows_operational_write(public.accounts_company_id_from_storage_path(name))
    );

CREATE POLICY accounts_documents_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'accounts-documents'
        AND public.accounts_company_id_from_storage_path(name) IS NOT NULL
        AND public.has_finance_full_access(public.accounts_company_id_from_storage_path(name))
        AND public.company_billing_allows_operational_write(public.accounts_company_id_from_storage_path(name))
    );

-- ----------------------------------------------------------------------------
-- 4.2 Bucket: labour-payroll-files
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow auth select on labour-payroll-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth insert on labour-payroll-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth update on labour-payroll-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete on labour-payroll-files" ON storage.objects;
DROP POLICY IF EXISTS labour_payroll_storage_select ON storage.objects;
DROP POLICY IF EXISTS labour_payroll_storage_insert ON storage.objects;
DROP POLICY IF EXISTS labour_payroll_storage_update ON storage.objects;
DROP POLICY IF EXISTS labour_payroll_storage_delete ON storage.objects;
DROP POLICY IF EXISTS labour_payroll_files_select ON storage.objects;
DROP POLICY IF EXISTS labour_payroll_files_insert ON storage.objects;
DROP POLICY IF EXISTS labour_payroll_files_update ON storage.objects;
DROP POLICY IF EXISTS labour_payroll_files_delete ON storage.objects;

CREATE POLICY labour_payroll_files_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'labour-payroll-files'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND (
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
            OR public.verify_membership_access(
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
            )
        )
    );

CREATE POLICY labour_payroll_files_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'labour-payroll-files'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY labour_payroll_files_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'labour-payroll-files'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    )
    WITH CHECK (
        bucket_id = 'labour-payroll-files'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY labour_payroll_files_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'labour-payroll-files'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

-- ----------------------------------------------------------------------------
-- 4.3 Bucket: technical-reports
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to insert to technical-reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select from technical-reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete from technical-reports" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update technical-reports" ON storage.objects;
DROP POLICY IF EXISTS technical_reports_storage_select ON storage.objects;
DROP POLICY IF EXISTS technical_reports_storage_insert ON storage.objects;
DROP POLICY IF EXISTS technical_reports_storage_update ON storage.objects;
DROP POLICY IF EXISTS technical_reports_storage_delete ON storage.objects;

CREATE POLICY technical_reports_storage_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'technical-reports'
        AND public.technical_reports_storage_resolve_company_id(name) IS NOT NULL
        AND (
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
            OR pg_catalog.split_part(name, '/', 1) = 'company-logos'
            OR public.verify_membership_access(
                public.technical_reports_storage_resolve_company_id(name),
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
            )
        )
    );

CREATE POLICY technical_reports_storage_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'technical-reports'
        AND public.technical_reports_storage_resolve_company_id(name) IS NOT NULL
        AND (
            (
                pg_catalog.split_part(name, '/', 1) = 'company-logos'
                AND public.verify_membership_access(public.technical_reports_storage_resolve_company_id(name), NULL)
            )
            OR (
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
                AND (
                    public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
                    OR (
                        EXISTS (
                            SELECT 1 FROM public.projects p
                            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
                        )
                        AND public.verify_membership_access(
                            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
                            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                        )
                    )
                )
            )
        )
        AND public.company_billing_allows_operational_write(public.technical_reports_storage_resolve_company_id(name))
    );

CREATE POLICY technical_reports_storage_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'technical-reports'
        AND public.technical_reports_storage_resolve_company_id(name) IS NOT NULL
        AND (
            (
                pg_catalog.split_part(name, '/', 1) = 'company-logos'
                AND public.verify_membership_access(public.technical_reports_storage_resolve_company_id(name), NULL)
            )
            OR (
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
                AND (
                    public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
                    OR (
                        EXISTS (
                            SELECT 1 FROM public.projects p
                            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
                        )
                        AND public.verify_membership_access(
                            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
                            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                        )
                    )
                )
            )
        )
        AND public.company_billing_allows_operational_write(public.technical_reports_storage_resolve_company_id(name))
    )
    WITH CHECK (
        bucket_id = 'technical-reports'
        AND public.technical_reports_storage_resolve_company_id(name) IS NOT NULL
        AND (
            (
                pg_catalog.split_part(name, '/', 1) = 'company-logos'
                AND public.verify_membership_access(public.technical_reports_storage_resolve_company_id(name), NULL)
            )
            OR (
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
                AND (
                    public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
                    OR (
                        EXISTS (
                            SELECT 1 FROM public.projects p
                            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
                        )
                        AND public.verify_membership_access(
                            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
                            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                        )
                    )
                )
            )
        )
        AND public.company_billing_allows_operational_write(public.technical_reports_storage_resolve_company_id(name))
    );

CREATE POLICY technical_reports_storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'technical-reports'
        AND public.technical_reports_storage_resolve_company_id(name) IS NOT NULL
        AND (
            (
                pg_catalog.split_part(name, '/', 1) = 'company-logos'
                AND public.verify_membership_access(public.technical_reports_storage_resolve_company_id(name), NULL)
            )
            OR (
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
                AND (
                    public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
                    OR (
                        EXISTS (
                            SELECT 1 FROM public.projects p
                            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
                        )
                        AND public.verify_membership_access(
                            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
                            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
                        )
                    )
                )
            )
        )
        AND public.company_billing_allows_operational_write(public.technical_reports_storage_resolve_company_id(name))
    );

-- ----------------------------------------------------------------------------
-- 4.4 Bucket: quality-control-assets
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow auth select on quality-control-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth insert on quality-control-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth update on quality-control-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete on quality-control-assets" ON storage.objects;
DROP POLICY IF EXISTS qc_assets_select ON storage.objects;
DROP POLICY IF EXISTS qc_assets_insert ON storage.objects;
DROP POLICY IF EXISTS qc_assets_update ON storage.objects;
DROP POLICY IF EXISTS qc_assets_delete ON storage.objects;

CREATE POLICY qc_assets_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'quality-control-assets'
        AND public.qc_assets_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_assets_storage_resolve_company_id(name))
    );

CREATE POLICY qc_assets_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'quality-control-assets'
        AND public.qc_assets_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_assets_storage_resolve_company_id(name))
        AND public.company_billing_allows_operational_write(public.qc_assets_storage_resolve_company_id(name))
    );

CREATE POLICY qc_assets_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'quality-control-assets'
        AND public.qc_assets_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_assets_storage_resolve_company_id(name))
        AND public.company_billing_allows_operational_write(public.qc_assets_storage_resolve_company_id(name))
    )
    WITH CHECK (
        bucket_id = 'quality-control-assets'
        AND public.qc_assets_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_assets_storage_resolve_company_id(name))
        AND public.company_billing_allows_operational_write(public.qc_assets_storage_resolve_company_id(name))
    );

CREATE POLICY qc_assets_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'quality-control-assets'
        AND public.qc_assets_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_assets_storage_resolve_company_id(name))
        AND public.company_billing_allows_operational_write(public.qc_assets_storage_resolve_company_id(name))
    );

-- ----------------------------------------------------------------------------
-- 4.5 Bucket: quality-control-documents
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow auth select on quality-control-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth insert on quality-control-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth update on quality-control-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete on quality-control-documents" ON storage.objects;
DROP POLICY IF EXISTS qc_documents_select ON storage.objects;
DROP POLICY IF EXISTS qc_documents_insert ON storage.objects;
DROP POLICY IF EXISTS qc_documents_update ON storage.objects;
DROP POLICY IF EXISTS qc_documents_delete ON storage.objects;

CREATE POLICY qc_documents_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'quality-control-documents'
        AND public.qc_documents_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_documents_storage_resolve_company_id(name))
    );

CREATE POLICY qc_documents_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'quality-control-documents'
        AND public.qc_documents_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_documents_storage_resolve_company_id(name))
        AND public.company_billing_allows_operational_write(public.qc_documents_storage_resolve_company_id(name))
    );

CREATE POLICY qc_documents_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'quality-control-documents'
        AND public.qc_documents_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_documents_storage_resolve_company_id(name))
        AND public.company_billing_allows_operational_write(public.qc_documents_storage_resolve_company_id(name))
    )
    WITH CHECK (
        bucket_id = 'quality-control-documents'
        AND public.qc_documents_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_documents_storage_resolve_company_id(name))
        AND public.company_billing_allows_operational_write(public.qc_documents_storage_resolve_company_id(name))
    );

CREATE POLICY qc_documents_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'quality-control-documents'
        AND public.qc_documents_storage_resolve_company_id(name) IS NOT NULL
        AND public.verify_company_membership_access(public.qc_documents_storage_resolve_company_id(name))
        AND public.company_billing_allows_operational_write(public.qc_documents_storage_resolve_company_id(name))
    );

-- ----------------------------------------------------------------------------
-- 4.6 Bucket: communication-documents
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Select communication-documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Insert communication-documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Update communication-documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Delete communication-documents storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth select on communication-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth insert on communication-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth update on communication-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete on communication-documents" ON storage.objects;
DROP POLICY IF EXISTS communication_documents_storage_select ON storage.objects;
DROP POLICY IF EXISTS communication_documents_storage_insert ON storage.objects;
DROP POLICY IF EXISTS communication_documents_storage_update ON storage.objects;
DROP POLICY IF EXISTS communication_documents_storage_delete ON storage.objects;

CREATE POLICY communication_documents_storage_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'communication-documents'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND (
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
            OR public.verify_membership_access(
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
            )
        )
    );

CREATE POLICY communication_documents_storage_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'communication-documents'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY communication_documents_storage_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'communication-documents'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    )
    WITH CHECK (
        bucket_id = 'communication-documents'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY communication_documents_storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'communication-documents'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

-- ----------------------------------------------------------------------------
-- 4.7 Bucket: site-diary-attachments
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "site_diaries_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "site_diaries_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "site_diaries_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "site_diaries_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth select on site-diary-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth insert on site-diary-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth update on site-diary-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete on site-diary-attachments" ON storage.objects;
DROP POLICY IF EXISTS site_diary_attachments_select ON storage.objects;
DROP POLICY IF EXISTS site_diary_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS site_diary_attachments_update ON storage.objects;
DROP POLICY IF EXISTS site_diary_attachments_delete ON storage.objects;

CREATE POLICY site_diary_attachments_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'site-diary-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND (
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NULL
            OR public.verify_membership_access(
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
                public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
            )
        )
    );

CREATE POLICY site_diary_attachments_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'site-diary-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY site_diary_attachments_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'site-diary-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    )
    WITH CHECK (
        bucket_id = 'site-diary-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY site_diary_attachments_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'site-diary-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2)) IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
              AND p.company_id = public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1))
        )
        AND public.verify_membership_access(
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)),
            public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 2))
        )
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

-- ----------------------------------------------------------------------------
-- 4.8 Bucket: cashbook-attachments
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow auth select on cashbook-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth insert on cashbook-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth update on cashbook-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow auth delete on cashbook-attachments" ON storage.objects;
DROP POLICY IF EXISTS cashbook_attachments_storage_select ON storage.objects;
DROP POLICY IF EXISTS cashbook_attachments_storage_insert ON storage.objects;
DROP POLICY IF EXISTS cashbook_attachments_storage_update ON storage.objects;
DROP POLICY IF EXISTS cashbook_attachments_storage_delete ON storage.objects;

CREATE POLICY cashbook_attachments_storage_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'cashbook-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.has_finance_full_access(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY cashbook_attachments_storage_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'cashbook-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.has_finance_full_access(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY cashbook_attachments_storage_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'cashbook-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.has_finance_full_access(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    )
    WITH CHECK (
        bucket_id = 'cashbook-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.has_finance_full_access(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

CREATE POLICY cashbook_attachments_storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'cashbook-attachments'
        AND public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)) IS NOT NULL
        AND public.has_finance_full_access(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
        AND public.company_billing_allows_operational_write(public.parse_storage_path_uuid(pg_catalog.split_part(name, '/', 1)))
    );

-- ============================================================================
-- SECTION 5: GRANTS & PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_attachments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;

COMMIT;
