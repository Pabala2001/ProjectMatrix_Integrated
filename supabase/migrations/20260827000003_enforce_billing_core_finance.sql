-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1C
-- Migration: Enforce Billing Operational Write Access on Core Finance
-- Filename: 20260827000003_enforce_billing_core_finance.sql
-- Description:
--   Applies server-side commercial write entitlement enforcement to:
--     1. public.project_budget_versions
--     2. public.project_budget_lines
--     3. public.financial_commitments
--     4. public.financial_cost_postings
--     5. public.project_financial_forecasts
--
--   Updates write RLS policies (INSERT, UPDATE, DELETE) to require:
--     public.company_billing_allows_operational_write(company_id)
--   Leaves SELECT policies intact so read-only companies can view and export records.
--
--   Updates all 18 mutating SECURITY DEFINER RPCs for Core Finance to explicitly
--   validate public.company_billing_allows_operational_write(v_company_id)
--   prior to mutation, raising SQLSTATE 'PM001' with message:
--   'Company billing access is read-only.' if not permitted.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ROW LEVEL SECURITY WRITE POLICIES
-- ============================================================================

-- Table 1: project_budget_versions
DROP POLICY IF EXISTS p_budget_versions_insert ON public.project_budget_versions;
CREATE POLICY p_budget_versions_insert ON public.project_budget_versions
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_versions_update ON public.project_budget_versions;
CREATE POLICY p_budget_versions_update ON public.project_budget_versions
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_versions_delete ON public.project_budget_versions;
CREATE POLICY p_budget_versions_delete ON public.project_budget_versions
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- Table 2: project_budget_lines
DROP POLICY IF EXISTS p_budget_lines_insert ON public.project_budget_lines;
CREATE POLICY p_budget_lines_insert ON public.project_budget_lines
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_lines_update ON public.project_budget_lines;
CREATE POLICY p_budget_lines_update ON public.project_budget_lines
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_lines_delete ON public.project_budget_lines;
CREATE POLICY p_budget_lines_delete ON public.project_budget_lines
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- Table 3: financial_commitments
DROP POLICY IF EXISTS p_commitments_insert ON public.financial_commitments;
CREATE POLICY p_commitments_insert ON public.financial_commitments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_commitments_update ON public.financial_commitments;
CREATE POLICY p_commitments_update ON public.financial_commitments
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_commitments_delete ON public.financial_commitments;
CREATE POLICY p_commitments_delete ON public.financial_commitments
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- Table 4: financial_cost_postings
DROP POLICY IF EXISTS p_cost_postings_insert ON public.financial_cost_postings;
CREATE POLICY p_cost_postings_insert ON public.financial_cost_postings
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_cost_postings_update ON public.financial_cost_postings;
CREATE POLICY p_cost_postings_update ON public.financial_cost_postings
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_cost_postings_delete ON public.financial_cost_postings;
CREATE POLICY p_cost_postings_delete ON public.financial_cost_postings
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- Table 5: project_financial_forecasts
DROP POLICY IF EXISTS p_forecasts_insert ON public.project_financial_forecasts;
CREATE POLICY p_forecasts_insert ON public.project_financial_forecasts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_forecasts_update ON public.project_financial_forecasts;
CREATE POLICY p_forecasts_update ON public.project_financial_forecasts
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_forecasts_delete ON public.project_financial_forecasts;
CREATE POLICY p_forecasts_delete ON public.project_financial_forecasts
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );


-- ============================================================================
-- 2. SOFT ARCHIVING & RESTORE RPCs WITH BILLING ENFORCEMENT
-- ============================================================================

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

    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.archive_finance_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_finance_record(text, uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.restore_finance_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_finance_record(text, uuid) TO authenticated;


-- ============================================================================
-- 3. BUDGET WORKFLOW RPCs WITH BILLING ENFORCEMENT
-- ============================================================================

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.submit_budget_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_budget_version(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.approve_budget_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_budget_version(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reject_budget_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_budget_version(uuid, text) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.cancel_budget_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_budget_version(uuid, text) TO authenticated;


-- ============================================================================
-- 4. FINANCIAL COMMITMENTS WORKFLOW RPCs WITH BILLING ENFORCEMENT
-- ============================================================================

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.submit_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_financial_commitment(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.approve_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_financial_commitment(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reject_financial_commitment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_financial_commitment(uuid, text) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.close_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_financial_commitment(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.cancel_financial_commitment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_financial_commitment(uuid, text) TO authenticated;


-- ============================================================================
-- 5. FINANCIAL COST POSTINGS WORKFLOW RPCs WITH BILLING ENFORCEMENT
-- ============================================================================

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.submit_financial_cost_posting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_financial_cost_posting(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.post_financial_cost_posting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_financial_cost_posting(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reject_financial_cost_posting(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_financial_cost_posting(uuid, text) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_orig.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reverse_financial_cost_posting(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_financial_cost_posting(uuid, text) TO authenticated;


-- ============================================================================
-- 6. PROJECT FINANCIAL FORECASTS WORKFLOW RPCs WITH BILLING ENFORCEMENT
-- ============================================================================

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.submit_project_financial_forecast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_project_financial_forecast(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.approve_project_financial_forecast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_project_financial_forecast(uuid) TO authenticated;

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

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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

REVOKE ALL ON FUNCTION public.reject_project_financial_forecast(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_project_financial_forecast(uuid, text) TO authenticated;

COMMIT;
