-- ============================================================================
-- Migration: 20260828000006_enforce_billing_projects_programmes.sql
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1J
-- Enforce Billing Access on Projects, Memberships, and Programmes
--
-- Additive contract:
--   * preserves every live permissive policy and every live table grant;
--   * keeps RLS enabled but not forced;
--   * adds restrictive Billing policies for INSERT, UPDATE, and DELETE;
--   * preserves read/export access when Billing is read-only;
--   * validates project, programme, activity, dependency, and membership scope;
--   * rejects updates to authoritative tenant and relationship identifiers;
--   * preserves the company-creation bootstrap sequence in which the creator's
--     first active company_members row must exist before the trial can start.
--
-- This migration intentionally does not create or alter the six live tables,
-- replace their existing policies, broaden their grants, or force RLS.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. FAIL-CLOSED LIVE-CONTRACT GUARD
-- ============================================================================

DO $migration_guard$
DECLARE
    v_missing pg_catalog.text[] := ARRAY[]::pg_catalog.text[];
    v_relation pg_catalog.text;
    v_column_requirement pg_catalog.text;
    v_relation_name pg_catalog.text;
    v_column_name pg_catalog.text;
    v_expected_type pg_catalog.regtype;
    v_relation_oid pg_catalog.oid;
    v_guard_function_oid pg_catalog.oid;
    v_bootstrap_function_oid pg_catalog.oid;
    v_billing_function_oid pg_catalog.oid;
BEGIN
    FOREACH v_relation IN ARRAY ARRAY[
        'projects',
        'company_members',
        'project_members',
        'programmes',
        'programme_activities',
        'programme_dependencies'
    ] LOOP
        v_relation_oid := pg_catalog.to_regclass('public.' || v_relation);

        IF v_relation_oid IS NULL THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'table public.' || v_relation
            );
        ELSIF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class AS relation
            WHERE relation.oid = v_relation_oid
              AND relation.relkind IN ('r', 'p')
              AND relation.relrowsecurity IS TRUE
              AND relation.relforcerowsecurity IS FALSE
        ) THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'public.' || v_relation || ' with enabled, unforced RLS'
            );
        END IF;
    END LOOP;

    IF pg_catalog.to_regclass('public.companies') IS NULL THEN
        v_missing := pg_catalog.array_append(v_missing, 'table public.companies');
    END IF;

    FOREACH v_column_requirement IN ARRAY ARRAY[
        'projects.id:uuid',
        'projects.company_id:uuid',
        'company_members.id:uuid',
        'company_members.company_id:uuid',
        'company_members.profile_id:uuid',
        'company_members.created_by:uuid',
        'company_members.is_active:boolean',
        'project_members.id:uuid',
        'project_members.project_id:uuid',
        'project_members.company_member_id:uuid',
        'programmes.id:uuid',
        'programmes.company_id:uuid',
        'programmes.project_id:uuid',
        'programme_activities.id:uuid',
        'programme_activities.programme_id:uuid',
        'programme_activities.company_id:uuid',
        'programme_activities.project_id:uuid',
        'programme_activities.parent_id:uuid',
        'programme_dependencies.id:uuid',
        'programme_dependencies.programme_id:uuid',
        'programme_dependencies.company_id:uuid',
        'programme_dependencies.project_id:uuid',
        'programme_dependencies.predecessor_activity_id:uuid',
        'programme_dependencies.successor_activity_id:uuid',
        'companies.id:uuid',
        'companies.created_by:uuid'
    ] LOOP
        v_relation_name := pg_catalog.split_part(v_column_requirement, '.', 1);
        v_column_name := pg_catalog.split_part(
            pg_catalog.split_part(v_column_requirement, '.', 2),
            ':',
            1
        );
        v_expected_type := pg_catalog.to_regtype(
            pg_catalog.split_part(v_column_requirement, ':', 2)
        );

        IF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_attribute AS attribute
            WHERE attribute.attrelid = pg_catalog.to_regclass(
                    'public.' || v_relation_name
                  )
              AND attribute.attname = v_column_name
              AND attribute.atttypid = v_expected_type
              AND attribute.attnum > 0
              AND NOT attribute.attisdropped
        ) THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'column public.' || v_relation_name || '.' || v_column_name
                    || ' (' || v_expected_type::pg_catalog.text || ')'
            );
        END IF;
    END LOOP;

    v_billing_function_oid := pg_catalog.to_regprocedure(
        'public.company_billing_allows_operational_write(uuid)'
    );

    IF v_billing_function_oid IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_proc AS routine
           WHERE routine.oid = v_billing_function_oid
             AND routine.prorettype = 'pg_catalog.bool'::pg_catalog.regtype
             AND routine.prosecdef IS TRUE
             AND routine.provolatile IN ('s', 'i')
             AND COALESCE(routine.proconfig, ARRAY[]::pg_catalog.text[])
                 @> ARRAY['search_path=""']::pg_catalog.text[]
       ) THEN
        v_missing := pg_catalog.array_append(
            v_missing,
            'hardened function public.company_billing_allows_operational_write(uuid)'
        );
    END IF;

    v_guard_function_oid := pg_catalog.to_regprocedure(
        'public.fn_enforce_projects_programmes_tenancy()'
    );

    IF v_guard_function_oid IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_proc AS routine
           WHERE routine.oid = v_guard_function_oid
             AND routine.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
       ) THEN
        v_missing := pg_catalog.array_append(
            v_missing,
            'compatible function public.fn_enforce_projects_programmes_tenancy()'
        );
    END IF;

    v_bootstrap_function_oid := pg_catalog.to_regprocedure(
        'public.company_members_billing_allows_insert(uuid,uuid,uuid,boolean)'
    );

    IF v_bootstrap_function_oid IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_proc AS routine
           WHERE routine.oid = v_bootstrap_function_oid
             AND routine.prorettype = 'pg_catalog.bool'::pg_catalog.regtype
       ) THEN
        v_missing := pg_catalog.array_append(
            v_missing,
            'compatible function public.company_members_billing_allows_insert(uuid,uuid,uuid,boolean)'
        );
    END IF;

    FOREACH v_relation IN ARRAY ARRAY[
        'projects',
        'company_members',
        'project_members',
        'programmes',
        'programme_activities',
        'programme_dependencies'
    ] LOOP
        v_relation_oid := pg_catalog.to_regclass('public.' || v_relation);

        IF v_relation_oid IS NOT NULL
           AND EXISTS (
               SELECT 1
               FROM pg_catalog.pg_trigger AS trigger
               WHERE trigger.tgrelid = v_relation_oid
                 AND trigger.tgname = 'trg_projects_programmes_tenancy_guard'
                 AND NOT trigger.tgisinternal
                 AND (
                     v_guard_function_oid IS NULL
                     OR trigger.tgfoid <> v_guard_function_oid
                 )
           ) THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'compatible trigger public.' || v_relation
                    || '.trg_projects_programmes_tenancy_guard'
            );
        END IF;
    END LOOP;

    IF pg_catalog.cardinality(v_missing) > 0 THEN
        RAISE EXCEPTION
            'Projects and Programmes Billing migration prerequisites are missing or incompatible: %',
            pg_catalog.array_to_string(v_missing, ', ')
            USING ERRCODE = 'P0001';
    END IF;
END;
$migration_guard$;

-- ============================================================================
-- 1. COMPANY-MEMBER INSERT BILLING HELPER
--
-- Normal personnel additions require operational Billing access. The sole
-- exception is the first active membership row for the authenticated creator
-- of a newly created company. ProjectMatrix must create that row before its
-- start_billing_trial RPC can authorize the creator and start the trial.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.company_members_billing_allows_insert(
    p_company_id pg_catalog.uuid,
    p_profile_id pg_catalog.uuid,
    p_created_by pg_catalog.uuid,
    p_is_active pg_catalog.bool
)
RETURNS pg_catalog.bool
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id pg_catalog.uuid;
BEGIN
    IF p_company_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF public.company_billing_allows_operational_write(p_company_id) IS TRUE THEN
        RETURN TRUE;
    END IF;

    RETURN p_profile_id = v_user_id
       AND p_created_by = v_user_id
       AND p_is_active IS TRUE
       AND EXISTS (
           SELECT 1
           FROM public.companies AS company
           WHERE company.id = p_company_id
             AND company.created_by = v_user_id
       )
       AND NOT EXISTS (
           SELECT 1
           FROM public.company_members AS existing_member
           WHERE existing_member.company_id = p_company_id
       );
END;
$function$;

-- ============================================================================
-- 2. ADDITIVE AUTHORITATIVE TENANCY AND RELATIONSHIP GUARD
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_enforce_projects_programmes_tenancy()
RETURNS pg_catalog.trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
        RAISE EXCEPTION
            'Unsupported operation for Projects and Programmes tenancy guard: %',
            TG_OP
            USING ERRCODE = '23514';
    END IF;

    IF TG_TABLE_SCHEMA <> 'public'
       OR TG_TABLE_NAME NOT IN (
           'projects',
           'company_members',
           'project_members',
           'programmes',
           'programme_activities',
           'programme_dependencies'
       ) THEN
        RAISE EXCEPTION
            'Unsupported relation for Projects and Programmes tenancy guard: %.%',
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Cannot modify id of an existing %.% record',
                TG_TABLE_SCHEMA,
                TG_TABLE_NAME
                USING ERRCODE = '23514';
        END IF;

        IF TG_TABLE_NAME = 'project_members' THEN
            IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
                RAISE EXCEPTION
                    'Cannot modify project_id of an existing project_members record'
                    USING ERRCODE = '23514';
            END IF;

            IF NEW.company_member_id IS DISTINCT FROM OLD.company_member_id THEN
                RAISE EXCEPTION
                    'Cannot modify company_member_id of an existing project_members record'
                    USING ERRCODE = '23514';
            END IF;
        ELSIF TG_TABLE_NAME = 'projects' THEN
            IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
                RAISE EXCEPTION
                    'Cannot modify company_id of an existing projects record'
                    USING ERRCODE = '23514';
            END IF;
        ELSIF TG_TABLE_NAME = 'company_members' THEN
            IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
                RAISE EXCEPTION
                    'Cannot modify company_id of an existing company_members record'
                    USING ERRCODE = '23514';
            END IF;
        ELSIF TG_TABLE_NAME = 'programmes' THEN
            IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
                RAISE EXCEPTION
                    'Cannot modify company_id of an existing programmes record'
                    USING ERRCODE = '23514';
            END IF;

            IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
                RAISE EXCEPTION
                    'Cannot modify project_id of an existing programmes record'
                    USING ERRCODE = '23514';
            END IF;
        ELSIF TG_TABLE_NAME = 'programme_activities' THEN
            IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
                RAISE EXCEPTION
                    'Cannot modify company_id of an existing programme_activities record'
                    USING ERRCODE = '23514';
            END IF;

            IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
                RAISE EXCEPTION
                    'Cannot modify project_id of an existing programme_activities record'
                    USING ERRCODE = '23514';
            END IF;

            IF NEW.programme_id IS DISTINCT FROM OLD.programme_id THEN
                RAISE EXCEPTION
                    'Cannot modify programme_id of an existing programme_activities record'
                    USING ERRCODE = '23514';
            END IF;
        ELSIF TG_TABLE_NAME = 'programme_dependencies' THEN
            IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
                RAISE EXCEPTION
                    'Cannot modify company_id of an existing programme_dependencies record'
                    USING ERRCODE = '23514';
            END IF;

            IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
                RAISE EXCEPTION
                    'Cannot modify project_id of an existing programme_dependencies record'
                    USING ERRCODE = '23514';
            END IF;

            IF NEW.programme_id IS DISTINCT FROM OLD.programme_id THEN
                RAISE EXCEPTION
                    'Cannot modify programme_id of an existing programme_dependencies record'
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'project_members' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.projects AS project
            JOIN public.company_members AS member
              ON member.id = NEW.company_member_id
             AND member.company_id = project.company_id
            WHERE project.id = NEW.project_id
              AND member.is_active IS TRUE
        ) THEN
            RAISE EXCEPTION
                'Project member must be an active member of the project company'
                USING ERRCODE = '23514';
        END IF;

    ELSIF TG_TABLE_NAME = 'programmes' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = NEW.project_id
              AND project.company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION
                'Programme project must belong to the programme company'
                USING ERRCODE = '23514';
        END IF;

    ELSIF TG_TABLE_NAME = 'programme_activities' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.programmes AS programme
            WHERE programme.id = NEW.programme_id
              AND programme.company_id = NEW.company_id
              AND programme.project_id = NEW.project_id
        ) THEN
            RAISE EXCEPTION
                'Programme activity must belong to its programme company and project'
                USING ERRCODE = '23514';
        END IF;

        IF NEW.parent_id IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM public.programme_activities AS parent_activity
               WHERE parent_activity.id = NEW.parent_id
                 AND parent_activity.id <> NEW.id
                 AND parent_activity.programme_id = NEW.programme_id
                 AND parent_activity.company_id = NEW.company_id
                 AND parent_activity.project_id = NEW.project_id
           ) THEN
            RAISE EXCEPTION
                'Parent activity must be a different activity in the same programme'
                USING ERRCODE = '23514';
        END IF;

    ELSIF TG_TABLE_NAME = 'programme_dependencies' THEN
        IF NEW.predecessor_activity_id = NEW.successor_activity_id THEN
            RAISE EXCEPTION
                'Programme dependency predecessor and successor must be different'
                USING ERRCODE = '23514';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.programmes AS programme
            WHERE programme.id = NEW.programme_id
              AND programme.company_id = NEW.company_id
              AND programme.project_id = NEW.project_id
        ) THEN
            RAISE EXCEPTION
                'Programme dependency must belong to its programme company and project'
                USING ERRCODE = '23514';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.programme_activities AS predecessor
            JOIN public.programme_activities AS successor
              ON successor.id = NEW.successor_activity_id
            WHERE predecessor.id = NEW.predecessor_activity_id
              AND predecessor.programme_id = NEW.programme_id
              AND successor.programme_id = NEW.programme_id
              AND predecessor.company_id = NEW.company_id
              AND successor.company_id = NEW.company_id
              AND predecessor.project_id = NEW.project_id
              AND successor.project_id = NEW.project_id
        ) THEN
            RAISE EXCEPTION
                'Programme dependency activities must belong to the same programme, company, and project'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_projects_programmes_tenancy_guard
    ON public.projects;
CREATE TRIGGER trg_projects_programmes_tenancy_guard
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_projects_programmes_tenancy();

DROP TRIGGER IF EXISTS trg_projects_programmes_tenancy_guard
    ON public.company_members;
CREATE TRIGGER trg_projects_programmes_tenancy_guard
    BEFORE UPDATE ON public.company_members
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_projects_programmes_tenancy();

DROP TRIGGER IF EXISTS trg_projects_programmes_tenancy_guard
    ON public.project_members;
CREATE TRIGGER trg_projects_programmes_tenancy_guard
    BEFORE INSERT OR UPDATE ON public.project_members
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_projects_programmes_tenancy();

DROP TRIGGER IF EXISTS trg_projects_programmes_tenancy_guard
    ON public.programmes;
CREATE TRIGGER trg_projects_programmes_tenancy_guard
    BEFORE INSERT OR UPDATE ON public.programmes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_projects_programmes_tenancy();

DROP TRIGGER IF EXISTS trg_projects_programmes_tenancy_guard
    ON public.programme_activities;
CREATE TRIGGER trg_projects_programmes_tenancy_guard
    BEFORE INSERT OR UPDATE ON public.programme_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_projects_programmes_tenancy();

DROP TRIGGER IF EXISTS trg_projects_programmes_tenancy_guard
    ON public.programme_dependencies;
CREATE TRIGGER trg_projects_programmes_tenancy_guard
    BEFORE INSERT OR UPDATE ON public.programme_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_projects_programmes_tenancy();

-- ============================================================================
-- 3. ADDITIVE RESTRICTIVE BILLING POLICIES
--
-- PostgreSQL ORs permissive policies together. These policies are deliberately
-- restrictive so Billing entitlement is ANDed with every existing or future
-- permissive write policy for authenticated users.
-- ============================================================================

-- 3.1 projects ---------------------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert ON public.projects;
CREATE POLICY billing_operational_write_insert
    ON public.projects
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.projects;
CREATE POLICY billing_operational_write_update
    ON public.projects
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.projects;
CREATE POLICY billing_operational_write_delete
    ON public.projects
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- 3.2 company_members --------------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert ON public.company_members;
CREATE POLICY billing_operational_write_insert
    ON public.company_members
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_members_billing_allows_insert(
            company_id,
            profile_id,
            created_by,
            is_active
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.company_members;
CREATE POLICY billing_operational_write_update
    ON public.company_members
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.company_members;
CREATE POLICY billing_operational_write_delete
    ON public.company_members
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- 3.3 project_members --------------------------------------------------------
-- Authenticated currently has SELECT only. These policies preserve that grant
-- while protecting the table if an authenticated write path is added later.
DROP POLICY IF EXISTS billing_operational_write_insert ON public.project_members;
CREATE POLICY billing_operational_write_insert
    ON public.project_members
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects AS project
            JOIN public.company_members AS member
              ON member.id = project_members.company_member_id
             AND member.company_id = project.company_id
            WHERE project.id = project_members.project_id
              AND member.is_active IS TRUE
              AND public.company_billing_allows_operational_write(
                  project.company_id
              )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.project_members;
CREATE POLICY billing_operational_write_update
    ON public.project_members
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = project_members.project_id
              AND public.company_billing_allows_operational_write(
                  project.company_id
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects AS project
            JOIN public.company_members AS member
              ON member.id = project_members.company_member_id
             AND member.company_id = project.company_id
            WHERE project.id = project_members.project_id
              AND member.is_active IS TRUE
              AND public.company_billing_allows_operational_write(
                  project.company_id
              )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.project_members;
CREATE POLICY billing_operational_write_delete
    ON public.project_members
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = project_members.project_id
              AND public.company_billing_allows_operational_write(
                  project.company_id
              )
        )
    );

-- 3.4 programmes -------------------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert ON public.programmes;
CREATE POLICY billing_operational_write_insert
    ON public.programmes
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = programmes.project_id
              AND project.company_id = programmes.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.programmes;
CREATE POLICY billing_operational_write_update
    ON public.programmes
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = programmes.project_id
              AND project.company_id = programmes.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.programmes;
CREATE POLICY billing_operational_write_delete
    ON public.programmes
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- 3.5 programme_activities ---------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.programme_activities;
CREATE POLICY billing_operational_write_insert
    ON public.programme_activities
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.programmes AS programme
            WHERE programme.id = programme_activities.programme_id
              AND programme.company_id = programme_activities.company_id
              AND programme.project_id = programme_activities.project_id
        )
        AND (
            parent_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.programme_activities AS parent_activity
                WHERE parent_activity.id = programme_activities.parent_id
                  AND parent_activity.id <> programme_activities.id
                  AND parent_activity.programme_id = programme_activities.programme_id
                  AND parent_activity.company_id = programme_activities.company_id
                  AND parent_activity.project_id = programme_activities.project_id
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.programme_activities;
CREATE POLICY billing_operational_write_update
    ON public.programme_activities
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.programmes AS programme
            WHERE programme.id = programme_activities.programme_id
              AND programme.company_id = programme_activities.company_id
              AND programme.project_id = programme_activities.project_id
        )
        AND (
            parent_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.programme_activities AS parent_activity
                WHERE parent_activity.id = programme_activities.parent_id
                  AND parent_activity.id <> programme_activities.id
                  AND parent_activity.programme_id = programme_activities.programme_id
                  AND parent_activity.company_id = programme_activities.company_id
                  AND parent_activity.project_id = programme_activities.project_id
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.programme_activities;
CREATE POLICY billing_operational_write_delete
    ON public.programme_activities
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- 3.6 programme_dependencies -------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.programme_dependencies;
CREATE POLICY billing_operational_write_insert
    ON public.programme_dependencies
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND predecessor_activity_id <> successor_activity_id
        AND EXISTS (
            SELECT 1
            FROM public.programmes AS programme
            WHERE programme.id = programme_dependencies.programme_id
              AND programme.company_id = programme_dependencies.company_id
              AND programme.project_id = programme_dependencies.project_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.programme_activities AS predecessor
            JOIN public.programme_activities AS successor
              ON successor.id = programme_dependencies.successor_activity_id
            WHERE predecessor.id = programme_dependencies.predecessor_activity_id
              AND predecessor.programme_id = programme_dependencies.programme_id
              AND successor.programme_id = programme_dependencies.programme_id
              AND predecessor.company_id = programme_dependencies.company_id
              AND successor.company_id = programme_dependencies.company_id
              AND predecessor.project_id = programme_dependencies.project_id
              AND successor.project_id = programme_dependencies.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.programme_dependencies;
CREATE POLICY billing_operational_write_update
    ON public.programme_dependencies
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND predecessor_activity_id <> successor_activity_id
        AND EXISTS (
            SELECT 1
            FROM public.programmes AS programme
            WHERE programme.id = programme_dependencies.programme_id
              AND programme.company_id = programme_dependencies.company_id
              AND programme.project_id = programme_dependencies.project_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.programme_activities AS predecessor
            JOIN public.programme_activities AS successor
              ON successor.id = programme_dependencies.successor_activity_id
            WHERE predecessor.id = programme_dependencies.predecessor_activity_id
              AND predecessor.programme_id = programme_dependencies.programme_id
              AND successor.programme_id = programme_dependencies.programme_id
              AND predecessor.company_id = programme_dependencies.company_id
              AND successor.company_id = programme_dependencies.company_id
              AND predecessor.project_id = programme_dependencies.project_id
              AND successor.project_id = programme_dependencies.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.programme_dependencies;
CREATE POLICY billing_operational_write_delete
    ON public.programme_dependencies
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- ============================================================================
-- 4. FUNCTION EXECUTION PRIVILEGES
--
-- Preserve all live table grants. Only the two new helper functions are
-- assigned execution privileges here; no existing shared helper ACL is changed.
-- ============================================================================

REVOKE ALL ON FUNCTION public.company_members_billing_allows_insert(
    pg_catalog.uuid,
    pg_catalog.uuid,
    pg_catalog.uuid,
    pg_catalog.bool
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.company_members_billing_allows_insert(
    pg_catalog.uuid,
    pg_catalog.uuid,
    pg_catalog.uuid,
    pg_catalog.bool
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_enforce_projects_programmes_tenancy()
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_enforce_projects_programmes_tenancy()
    TO service_role;

COMMIT;
