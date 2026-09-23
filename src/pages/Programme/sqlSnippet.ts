export const PROGRAMME_SQL_SNIPPET = `-- =============================================================
-- PHASE 1.2: PROGRAMME MODULE RLS & GRANTS
-- =============================================================

-- 1. Enable Row Level Security (RLS) on the tables
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_dependencies ENABLE ROW LEVEL SECURITY;

-- 2. Grant permissions explicitly to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programmes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_dependencies TO authenticated;

-- 3. Clean up any existing RLS policies for these tables
DROP POLICY IF EXISTS select_programmes ON public.programmes;
DROP POLICY IF EXISTS insert_programmes ON public.programmes;
DROP POLICY IF EXISTS update_programmes ON public.programmes;
DROP POLICY IF EXISTS delete_programmes ON public.programmes;

DROP POLICY IF EXISTS select_programme_activities ON public.programme_activities;
DROP POLICY IF EXISTS insert_programme_activities ON public.programme_activities;
DROP POLICY IF EXISTS update_programme_activities ON public.programme_activities;
DROP POLICY IF EXISTS delete_programme_activities ON public.programme_activities;

DROP POLICY IF EXISTS select_programme_dependencies ON public.programme_dependencies;
DROP POLICY IF EXISTS insert_programme_dependencies ON public.programme_dependencies;
DROP POLICY IF EXISTS update_programme_dependencies ON public.programme_dependencies;
DROP POLICY IF EXISTS delete_programme_dependencies ON public.programme_dependencies;

-- 4. Create RLS Policies using verify_membership_access helper

-- --- public.programmes POLICIES ---
CREATE POLICY select_programmes ON public.programmes
    FOR SELECT
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY insert_programmes ON public.programmes
    FOR INSERT
    TO authenticated
    WITH CHECK (public.verify_membership_access(company_id, project_id));

CREATE POLICY update_programmes ON public.programmes
    FOR UPDATE
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY delete_programmes ON public.programmes
    FOR DELETE
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

-- --- public.programme_activities POLICIES ---
CREATE POLICY select_programme_activities ON public.programme_activities
    FOR SELECT
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY insert_programme_activities ON public.programme_activities
    FOR INSERT
    TO authenticated
    WITH CHECK (public.verify_membership_access(company_id, project_id));

CREATE POLICY update_programme_activities ON public.programme_activities
    FOR UPDATE
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY delete_programme_activities ON public.programme_activities
    FOR DELETE
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

-- --- public.programme_dependencies POLICIES ---
CREATE POLICY select_programme_dependencies ON public.programme_dependencies
    FOR SELECT
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY insert_programme_dependencies ON public.programme_dependencies
    FOR INSERT
    TO authenticated
    WITH CHECK (public.verify_membership_access(company_id, project_id));

CREATE POLICY update_programme_dependencies ON public.programme_dependencies
    FOR UPDATE
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY delete_programme_dependencies ON public.programme_dependencies
    FOR DELETE
    TO authenticated
    USING (public.verify_membership_access(company_id, project_id));
`;
