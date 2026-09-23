-- ============================================================================
-- Migration: 20260828000007_enforce_billing_site_field_operations.sql
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1K
-- Enforce Billing Access on Site and Field Operations
--
-- Live-contract scope:
--   * site_diaries
--   * reports
--   * report_images
--   * survey_control_points
--   * survey_instruments
--   * survey_campaigns
--   * survey_campaign_points
--   * quality_control_records
--
-- technical_reports and technical_report_images are deliberately not created:
-- neither relation exists in the audited live database. If either appears before
-- this migration runs, the preflight guard aborts so the new contract is audited.
--
-- Additive contract:
--   * preserves all 32 live permissive policies and all table grants;
--   * keeps RLS enabled but not forced;
--   * adds 24 restrictive Billing policies (8 tables x 3 write commands);
--   * leaves every SELECT policy unchanged for read-only Billing access;
--   * preserves all eight existing triggers and their functions;
--   * adds tenancy guards only for Site Diaries and Quality Control, where the
--     audited live contract has no authoritative composite tenant constraint;
--   * derives Quality Control company scope from its required parent project.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. FAIL-CLOSED LIVE-CONTRACT GUARD
-- ============================================================================

DO $migration_guard$
DECLARE
    v_issues pg_catalog.text[] := ARRAY[]::pg_catalog.text[];
    v_relation_name pg_catalog.text;
    v_relation_oid pg_catalog.oid;
    v_requirement pg_catalog.text;
    v_table_name pg_catalog.text;
    v_column_name pg_catalog.text;
    v_expected_type pg_catalog.regtype;
    v_constraint_name pg_catalog.text;
    v_constraint_fragment pg_catalog.text;
    v_trigger_name pg_catalog.text;
    v_function_name pg_catalog.text;
    v_function_oid pg_catalog.oid;
    v_authenticated_oid pg_catalog.oid;
BEGIN
    SELECT role.oid
    INTO v_authenticated_oid
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'authenticated';

    IF v_authenticated_oid IS NULL THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'database role authenticated'
        );
    END IF;

    FOREACH v_relation_name IN ARRAY ARRAY[
        'site_diaries',
        'reports',
        'report_images',
        'survey_control_points',
        'survey_instruments',
        'survey_campaigns',
        'survey_campaign_points',
        'quality_control_records'
    ] LOOP
        v_relation_oid := pg_catalog.to_regclass(
            'public.' || v_relation_name
        );

        IF v_relation_oid IS NULL THEN
            v_issues := pg_catalog.array_append(
                v_issues,
                'table public.' || v_relation_name
            );
        ELSIF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_class AS relation
            WHERE relation.oid = v_relation_oid
              AND relation.relkind IN ('r', 'p')
              AND relation.relrowsecurity IS TRUE
              AND relation.relforcerowsecurity IS FALSE
        ) THEN
            v_issues := pg_catalog.array_append(
                v_issues,
                'public.' || v_relation_name
                    || ' with enabled, unforced RLS'
            );
        END IF;
    END LOOP;

    IF pg_catalog.to_regclass('public.projects') IS NULL THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'table public.projects'
        );
    END IF;

    -- These relations were absent from the authoritative snapshot. Their later
    -- appearance requires a separate audit rather than silent partial coverage.
    IF pg_catalog.to_regclass('public.technical_reports') IS NOT NULL THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'unexpected relation public.technical_reports requiring re-audit'
        );
    END IF;

    IF pg_catalog.to_regclass('public.technical_report_images') IS NOT NULL THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'unexpected relation public.technical_report_images requiring re-audit'
        );
    END IF;

    FOREACH v_requirement IN ARRAY ARRAY[
        'projects.id:uuid',
        'projects.company_id:uuid',
        'site_diaries.id:uuid',
        'site_diaries.company_id:uuid',
        'site_diaries.project_id:uuid',
        'reports.id:uuid',
        'reports.company_id:uuid',
        'reports.project_id:uuid',
        'report_images.id:uuid',
        'report_images.report_id:uuid',
        'report_images.company_id:uuid',
        'report_images.project_id:uuid',
        'survey_control_points.id:uuid',
        'survey_control_points.company_id:uuid',
        'survey_control_points.project_id:uuid',
        'survey_instruments.id:uuid',
        'survey_instruments.company_id:uuid',
        'survey_instruments.project_id:uuid',
        'survey_campaigns.id:uuid',
        'survey_campaigns.company_id:uuid',
        'survey_campaigns.project_id:uuid',
        'survey_campaign_points.id:uuid',
        'survey_campaign_points.company_id:uuid',
        'survey_campaign_points.project_id:uuid',
        'survey_campaign_points.campaign_id:uuid',
        'survey_campaign_points.control_point_id:uuid',
        'quality_control_records.id:uuid',
        'quality_control_records.project_id:uuid'
    ] LOOP
        v_table_name := pg_catalog.split_part(v_requirement, '.', 1);
        v_column_name := pg_catalog.split_part(
            pg_catalog.split_part(v_requirement, '.', 2),
            ':',
            1
        );
        v_expected_type := pg_catalog.to_regtype(
            pg_catalog.split_part(v_requirement, ':', 2)
        );

        IF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_attribute AS attribute
            WHERE attribute.attrelid = pg_catalog.to_regclass(
                    'public.' || v_table_name
                  )
              AND attribute.attname = v_column_name
              AND attribute.atttypid = v_expected_type
              AND attribute.attnum > 0
              AND attribute.attisdropped IS FALSE
        ) THEN
            v_issues := pg_catalog.array_append(
                v_issues,
                'column public.' || v_table_name || '.' || v_column_name
                    || ' (' || v_expected_type::pg_catalog.text || ')'
            );
        END IF;
    END LOOP;

    -- Require the audited composite foreign keys that protect service-role and
    -- other RLS-bypassing workflows on the six structurally hardened tables.
    FOREACH v_requirement IN ARRAY ARRAY[
        'reports|reports_project_company_fk|FOREIGN KEY (project_id, company_id) REFERENCES projects(id, company_id)',
        'report_images|report_images_report_tenant_fk|FOREIGN KEY (report_id, company_id, project_id) REFERENCES reports(id, company_id, project_id)',
        'survey_control_points|survey_control_points_project_company_fk|FOREIGN KEY (project_id, company_id) REFERENCES projects(id, company_id)',
        'survey_instruments|survey_instruments_project_company_fk|FOREIGN KEY (project_id, company_id) REFERENCES projects(id, company_id)',
        'survey_campaigns|survey_campaigns_project_company_fk|FOREIGN KEY (project_id, company_id) REFERENCES projects(id, company_id)',
        'survey_campaign_points|survey_campaign_points_campaign_fk|FOREIGN KEY (campaign_id, company_id, project_id) REFERENCES survey_campaigns(id, company_id, project_id)',
        'survey_campaign_points|survey_campaign_points_control_point_fk|FOREIGN KEY (control_point_id, company_id, project_id) REFERENCES survey_control_points(id, company_id, project_id)'
    ] LOOP
        v_table_name := pg_catalog.split_part(v_requirement, '|', 1);
        v_constraint_name := pg_catalog.split_part(v_requirement, '|', 2);
        v_constraint_fragment := pg_catalog.split_part(v_requirement, '|', 3);

        IF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_constraint AS constraint_row
            WHERE constraint_row.conrelid = pg_catalog.to_regclass(
                    'public.' || v_table_name
                  )
              AND constraint_row.conname = v_constraint_name
              AND constraint_row.contype = 'f'
              AND constraint_row.convalidated IS TRUE
              AND pg_catalog.strpos(
                    pg_catalog.pg_get_constraintdef(
                        constraint_row.oid,
                        TRUE
                    ),
                    v_constraint_fragment
                  ) = 1
        ) THEN
            v_issues := pg_catalog.array_append(
                v_issues,
                'validated constraint public.' || v_table_name || '.'
                    || v_constraint_name
            );
        END IF;
    END LOOP;

    -- These six existing triggers are part of the live authoritative contract.
    FOREACH v_requirement IN ARRAY ARRAY[
        'reports|reports_before_write|fn_reports_before_write',
        'report_images|report_images_before_write|fn_report_images_before_write',
        'survey_control_points|survey_control_points_before_write|fn_survey_control_points_before_write',
        'survey_instruments|survey_instruments_before_write|fn_survey_instruments_before_write',
        'survey_campaigns|survey_campaigns_before_write|fn_survey_campaigns_before_write',
        'survey_campaign_points|survey_campaign_points_before_write|fn_survey_campaign_points_before_write'
    ] LOOP
        v_table_name := pg_catalog.split_part(v_requirement, '|', 1);
        v_trigger_name := pg_catalog.split_part(v_requirement, '|', 2);
        v_function_name := pg_catalog.split_part(v_requirement, '|', 3);

        IF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_trigger AS trigger_row
            JOIN pg_catalog.pg_proc AS function_row
              ON function_row.oid = trigger_row.tgfoid
            JOIN pg_catalog.pg_namespace AS function_namespace
              ON function_namespace.oid = function_row.pronamespace
            WHERE trigger_row.tgrelid = pg_catalog.to_regclass(
                    'public.' || v_table_name
                  )
              AND trigger_row.tgname = v_trigger_name
              AND trigger_row.tgisinternal IS FALSE
              AND trigger_row.tgenabled <> 'D'
              AND function_namespace.nspname = 'public'
              AND function_row.proname = v_function_name
        ) THEN
            v_issues := pg_catalog.array_append(
                v_issues,
                'live trigger public.' || v_table_name || '.'
                    || v_trigger_name || ' -> public.' || v_function_name
            );
        END IF;
    END LOOP;

    v_function_oid := pg_catalog.to_regprocedure(
        'public.company_billing_allows_operational_write(uuid)'
    );

    IF v_function_oid IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_proc AS function_row
           WHERE function_row.oid = v_function_oid
             AND function_row.prorettype =
                 'pg_catalog.bool'::pg_catalog.regtype
             AND function_row.prosecdef IS TRUE
             AND function_row.provolatile IN ('s', 'i')
             AND COALESCE(
                    function_row.proconfig,
                    ARRAY[]::pg_catalog.text[]
                 ) @> ARRAY['search_path=""']::pg_catalog.text[]
       ) THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'hardened function public.company_billing_allows_operational_write(uuid)'
        );
    END IF;

    v_function_oid := pg_catalog.to_regprocedure(
        'public.verify_membership_access(uuid,uuid)'
    );

    IF v_function_oid IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_proc AS function_row
           WHERE function_row.oid = v_function_oid
             AND function_row.prorettype =
                 'pg_catalog.bool'::pg_catalog.regtype
             AND function_row.prosecdef IS TRUE
             AND function_row.provolatile IN ('s', 'i')
             AND COALESCE(
                    function_row.proconfig,
                    ARRAY[]::pg_catalog.text[]
                 ) @> ARRAY['search_path=""']::pg_catalog.text[]
       ) THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'hardened function public.verify_membership_access(uuid,uuid)'
        );
    END IF;

    -- The snapshot contains exactly four permissive CRUD policies per live
    -- target table. Preserve that authorization layer unchanged.
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT
                relation.relname,
                pg_catalog.count(*) FILTER (
                    WHERE policy.polpermissive IS TRUE
                ) AS permissive_count
            FROM pg_catalog.pg_class AS relation
            JOIN pg_catalog.pg_namespace AS namespace
              ON namespace.oid = relation.relnamespace
            LEFT JOIN pg_catalog.pg_policy AS policy
              ON policy.polrelid = relation.oid
            WHERE namespace.nspname = 'public'
              AND relation.relname IN (
                  'site_diaries',
                  'reports',
                  'report_images',
                  'survey_control_points',
                  'survey_instruments',
                  'survey_campaigns',
                  'survey_campaign_points',
                  'quality_control_records'
              )
            GROUP BY relation.relname
        ) AS policy_count
        WHERE policy_count.permissive_count <> 4
    ) THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'four preserved permissive policies on each live target table'
        );
    END IF;

    -- A rerun may find the policies created below. Any conflicting object with
    -- the same name must fail closed rather than be silently replaced.
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_policy AS policy
        JOIN pg_catalog.pg_class AS relation
          ON relation.oid = policy.polrelid
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname IN (
              'site_diaries',
              'reports',
              'report_images',
              'survey_control_points',
              'survey_instruments',
              'survey_campaigns',
              'survey_campaign_points',
              'quality_control_records'
          )
          AND policy.polname IN (
              'billing_operational_write_insert',
              'billing_operational_write_update',
              'billing_operational_write_delete'
          )
          AND (
              policy.polpermissive IS TRUE
              OR policy.polroles <>
                 ARRAY[v_authenticated_oid]::pg_catalog.oid[]
              OR policy.polcmd <> CASE policy.polname
                  WHEN 'billing_operational_write_insert' THEN 'a'::"char"
                  WHEN 'billing_operational_write_update' THEN 'w'::"char"
                  WHEN 'billing_operational_write_delete' THEN 'd'::"char"
              END
          )
    ) THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'compatible restrictive Billing policy names on live target tables'
        );
    END IF;

    FOREACH v_function_name IN ARRAY ARRAY[
        'fn_enforce_site_diaries_tenancy',
        'fn_enforce_quality_control_project_scope'
    ] LOOP
        v_function_oid := pg_catalog.to_regprocedure(
            'public.' || v_function_name || '()'
        );

        IF v_function_oid IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM pg_catalog.pg_proc AS function_row
               WHERE function_row.oid = v_function_oid
                 AND function_row.prorettype =
                     'pg_catalog.trigger'::pg_catalog.regtype
           ) THEN
            v_issues := pg_catalog.array_append(
                v_issues,
                'compatible function public.' || v_function_name || '()'
            );
        END IF;
    END LOOP;

    v_function_oid := pg_catalog.to_regprocedure(
        'public.fn_enforce_site_diaries_tenancy()'
    );

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger AS trigger_row
        WHERE trigger_row.tgrelid =
              pg_catalog.to_regclass('public.site_diaries')
          AND trigger_row.tgname = 'trg_site_diaries_tenancy_guard'
          AND trigger_row.tgisinternal IS FALSE
          AND (
              v_function_oid IS NULL
              OR trigger_row.tgfoid <> v_function_oid
          )
    ) THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'compatible trigger public.site_diaries.trg_site_diaries_tenancy_guard'
        );
    END IF;

    v_function_oid := pg_catalog.to_regprocedure(
        'public.fn_enforce_quality_control_project_scope()'
    );

    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger AS trigger_row
        WHERE trigger_row.tgrelid =
              pg_catalog.to_regclass('public.quality_control_records')
          AND trigger_row.tgname =
              'trg_quality_control_project_scope_guard'
          AND trigger_row.tgisinternal IS FALSE
          AND (
              v_function_oid IS NULL
              OR trigger_row.tgfoid <> v_function_oid
          )
    ) THEN
        v_issues := pg_catalog.array_append(
            v_issues,
            'compatible trigger public.quality_control_records.'
                || 'trg_quality_control_project_scope_guard'
        );
    END IF;

    IF pg_catalog.cardinality(v_issues) > 0 THEN
        RAISE EXCEPTION
            'Site and Field Operations Billing migration prerequisites are missing or incompatible: %',
            pg_catalog.array_to_string(v_issues, ', ')
            USING ERRCODE = 'P0001';
    END IF;
END;
$migration_guard$;

-- ============================================================================
-- 1. ADDITIVE TENANCY GUARDS FOR LIVE CONTRACT GAPS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_enforce_site_diaries_tenancy()
RETURNS pg_catalog.trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    IF TG_TABLE_SCHEMA <> 'public'
       OR TG_TABLE_NAME <> 'site_diaries'
       OR TG_OP NOT IN ('INSERT', 'UPDATE') THEN
        RAISE EXCEPTION
            'Unsupported invocation for Site Diaries tenancy guard: %.% %',
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME,
            TG_OP
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND (
           NEW.id IS DISTINCT FROM OLD.id
           OR NEW.company_id IS DISTINCT FROM OLD.company_id
           OR NEW.project_id IS DISTINCT FROM OLD.project_id
       ) THEN
        RAISE EXCEPTION
            'Site Diary identity, company, and project fields are immutable.'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = NEW.project_id
          AND project.company_id = NEW.company_id
    ) THEN
        RAISE EXCEPTION
            'Site Diary project must belong to the Site Diary company.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_enforce_quality_control_project_scope()
RETURNS pg_catalog.trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    IF TG_TABLE_SCHEMA <> 'public'
       OR TG_TABLE_NAME <> 'quality_control_records'
       OR TG_OP NOT IN ('INSERT', 'UPDATE') THEN
        RAISE EXCEPTION
            'Unsupported invocation for Quality Control project-scope guard: %.% %',
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME,
            TG_OP
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND (
           NEW.id IS DISTINCT FROM OLD.id
           OR NEW.project_id IS DISTINCT FROM OLD.project_id
       ) THEN
        RAISE EXCEPTION
            'Quality Control identity and project fields are immutable.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.project_id IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM public.projects AS project
           WHERE project.id = NEW.project_id
       ) THEN
        RAISE EXCEPTION
            'Quality Control records require an existing parent project.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_site_diaries_tenancy_guard
    ON public.site_diaries;
CREATE TRIGGER trg_site_diaries_tenancy_guard
    BEFORE INSERT OR UPDATE ON public.site_diaries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_site_diaries_tenancy();

DROP TRIGGER IF EXISTS trg_quality_control_project_scope_guard
    ON public.quality_control_records;
CREATE TRIGGER trg_quality_control_project_scope_guard
    BEFORE INSERT OR UPDATE ON public.quality_control_records
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_enforce_quality_control_project_scope();

-- ============================================================================
-- 2. ADDITIVE RESTRICTIVE BILLING POLICIES
--
-- PostgreSQL ORs permissive policies and ANDs restrictive policies. These
-- policies therefore preserve the existing authorization rules while adding
-- Billing, tenancy, and project-scope requirements to every authenticated write.
-- ============================================================================

-- 2.1 site_diaries -----------------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.site_diaries;
CREATE POLICY billing_operational_write_insert
    ON public.site_diaries
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = site_diaries.project_id
              AND project.company_id = site_diaries.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.site_diaries;
CREATE POLICY billing_operational_write_update
    ON public.site_diaries
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = site_diaries.project_id
              AND project.company_id = site_diaries.company_id
        )
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = site_diaries.project_id
              AND project.company_id = site_diaries.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.site_diaries;
CREATE POLICY billing_operational_write_delete
    ON public.site_diaries
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = site_diaries.project_id
              AND project.company_id = site_diaries.company_id
        )
    );

-- 2.2 reports ----------------------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.reports;
CREATE POLICY billing_operational_write_insert
    ON public.reports
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = reports.project_id
              AND project.company_id = reports.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.reports;
CREATE POLICY billing_operational_write_update
    ON public.reports
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = reports.project_id
              AND project.company_id = reports.company_id
        )
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = reports.project_id
              AND project.company_id = reports.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.reports;
CREATE POLICY billing_operational_write_delete
    ON public.reports
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = reports.project_id
              AND project.company_id = reports.company_id
        )
    );

-- 2.3 report_images ----------------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.report_images;
CREATE POLICY billing_operational_write_insert
    ON public.report_images
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.reports AS parent_report
            WHERE parent_report.id = report_images.report_id
              AND parent_report.company_id = report_images.company_id
              AND parent_report.project_id = report_images.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.report_images;
CREATE POLICY billing_operational_write_update
    ON public.report_images
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.reports AS parent_report
            WHERE parent_report.id = report_images.report_id
              AND parent_report.company_id = report_images.company_id
              AND parent_report.project_id = report_images.project_id
        )
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.reports AS parent_report
            WHERE parent_report.id = report_images.report_id
              AND parent_report.company_id = report_images.company_id
              AND parent_report.project_id = report_images.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.report_images;
CREATE POLICY billing_operational_write_delete
    ON public.report_images
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.reports AS parent_report
            WHERE parent_report.id = report_images.report_id
              AND parent_report.company_id = report_images.company_id
              AND parent_report.project_id = report_images.project_id
        )
    );

-- 2.4 survey_control_points --------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.survey_control_points;
CREATE POLICY billing_operational_write_insert
    ON public.survey_control_points
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_control_points.project_id
              AND project.company_id = survey_control_points.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.survey_control_points;
CREATE POLICY billing_operational_write_update
    ON public.survey_control_points
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_control_points.project_id
              AND project.company_id = survey_control_points.company_id
        )
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_control_points.project_id
              AND project.company_id = survey_control_points.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.survey_control_points;
CREATE POLICY billing_operational_write_delete
    ON public.survey_control_points
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_control_points.project_id
              AND project.company_id = survey_control_points.company_id
        )
    );

-- 2.5 survey_instruments -----------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.survey_instruments;
CREATE POLICY billing_operational_write_insert
    ON public.survey_instruments
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_instruments.project_id
              AND project.company_id = survey_instruments.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.survey_instruments;
CREATE POLICY billing_operational_write_update
    ON public.survey_instruments
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_instruments.project_id
              AND project.company_id = survey_instruments.company_id
        )
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_instruments.project_id
              AND project.company_id = survey_instruments.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.survey_instruments;
CREATE POLICY billing_operational_write_delete
    ON public.survey_instruments
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_instruments.project_id
              AND project.company_id = survey_instruments.company_id
        )
    );

-- 2.6 survey_campaigns -------------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.survey_campaigns;
CREATE POLICY billing_operational_write_insert
    ON public.survey_campaigns
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_campaigns.project_id
              AND project.company_id = survey_campaigns.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.survey_campaigns;
CREATE POLICY billing_operational_write_update
    ON public.survey_campaigns
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_campaigns.project_id
              AND project.company_id = survey_campaigns.company_id
        )
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_campaigns.project_id
              AND project.company_id = survey_campaigns.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.survey_campaigns;
CREATE POLICY billing_operational_write_delete
    ON public.survey_campaigns
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = survey_campaigns.project_id
              AND project.company_id = survey_campaigns.company_id
        )
    );

-- 2.7 survey_campaign_points ------------------------------------------------
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.survey_campaign_points;
CREATE POLICY billing_operational_write_insert
    ON public.survey_campaign_points
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.survey_campaigns AS campaign
            JOIN public.survey_control_points AS control_point
              ON control_point.id = survey_campaign_points.control_point_id
             AND control_point.company_id = campaign.company_id
             AND control_point.project_id = campaign.project_id
            WHERE campaign.id = survey_campaign_points.campaign_id
              AND campaign.company_id = survey_campaign_points.company_id
              AND campaign.project_id = survey_campaign_points.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.survey_campaign_points;
CREATE POLICY billing_operational_write_update
    ON public.survey_campaign_points
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.survey_campaigns AS campaign
            JOIN public.survey_control_points AS control_point
              ON control_point.id = survey_campaign_points.control_point_id
             AND control_point.company_id = campaign.company_id
             AND control_point.project_id = campaign.project_id
            WHERE campaign.id = survey_campaign_points.campaign_id
              AND campaign.company_id = survey_campaign_points.company_id
              AND campaign.project_id = survey_campaign_points.project_id
        )
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.survey_campaigns AS campaign
            JOIN public.survey_control_points AS control_point
              ON control_point.id = survey_campaign_points.control_point_id
             AND control_point.company_id = campaign.company_id
             AND control_point.project_id = campaign.project_id
            WHERE campaign.id = survey_campaign_points.campaign_id
              AND campaign.company_id = survey_campaign_points.company_id
              AND campaign.project_id = survey_campaign_points.project_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.survey_campaign_points;
CREATE POLICY billing_operational_write_delete
    ON public.survey_campaign_points
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.survey_campaigns AS campaign
            JOIN public.survey_control_points AS control_point
              ON control_point.id = survey_campaign_points.control_point_id
             AND control_point.company_id = campaign.company_id
             AND control_point.project_id = campaign.project_id
            WHERE campaign.id = survey_campaign_points.campaign_id
              AND campaign.company_id = survey_campaign_points.company_id
              AND campaign.project_id = survey_campaign_points.project_id
        )
    );

-- 2.8 quality_control_records ------------------------------------------------
-- This live table has no company_id. Resolve both authorization and Billing
-- entitlement from its required parent project and fail closed for NULL scope.
DROP POLICY IF EXISTS billing_operational_write_insert
    ON public.quality_control_records;
CREATE POLICY billing_operational_write_insert
    ON public.quality_control_records
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = quality_control_records.project_id
              AND public.verify_membership_access(
                    project.company_id,
                    project.id
                  )
              AND public.company_billing_allows_operational_write(
                    project.company_id
                  )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update
    ON public.quality_control_records;
CREATE POLICY billing_operational_write_update
    ON public.quality_control_records
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = quality_control_records.project_id
              AND public.verify_membership_access(
                    project.company_id,
                    project.id
                  )
              AND public.company_billing_allows_operational_write(
                    project.company_id
                  )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = quality_control_records.project_id
              AND public.verify_membership_access(
                    project.company_id,
                    project.id
                  )
              AND public.company_billing_allows_operational_write(
                    project.company_id
                  )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete
    ON public.quality_control_records;
CREATE POLICY billing_operational_write_delete
    ON public.quality_control_records
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = quality_control_records.project_id
              AND public.verify_membership_access(
                    project.company_id,
                    project.id
                  )
              AND public.company_billing_allows_operational_write(
                    project.company_id
                  )
        )
    );

-- ============================================================================
-- 3. NEW TRIGGER-FUNCTION EXECUTION PRIVILEGES
--
-- Preserve every live table grant and every pre-existing function ACL. Only the
-- two new trigger functions receive explicit execution privileges here.
-- ============================================================================

REVOKE ALL ON FUNCTION public.fn_enforce_site_diaries_tenancy()
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_enforce_site_diaries_tenancy()
    TO service_role;

REVOKE ALL ON FUNCTION public.fn_enforce_quality_control_project_scope()
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_enforce_quality_control_project_scope()
    TO service_role;

COMMIT;
