-- Migration: 20260828000004_enforce_billing_logistics.sql
-- ProjectMatrix Phase 3A.2 -- Enforce Billing Access on Logistics
--
-- Corrected migration guarantees:
--   1. Existing authorization and SELECT policies remain unchanged.
--   2. Billing enforcement is added through restrictive write policies.
--   3. Fleet assets and trips retain authoritative company relationships.
--   4. Existing trigger bindings and live Logistics audit semantics are preserved.
--   5. SECURITY DEFINER functions use an empty search_path and explicit schemas.
--   6. Existing table grants remain unchanged; this migration grants no new DELETE access.
--   7. RLS remains enabled without introducing FORCE ROW LEVEL SECURITY.

BEGIN;

-- ============================================================================
-- 0. FAIL-CLOSED PREREQUISITE AND CONTRACT CHECK
-- ============================================================================

DO $migration_guard$
DECLARE
    v_relation pg_catalog.text;
    v_signature pg_catalog.text;
    v_required record;
    v_relation_oid pg_catalog.oid;
    v_function_oid pg_catalog.oid;
    v_trigger_oid pg_catalog.oid;
    v_missing pg_catalog.text[] := ARRAY[]::pg_catalog.text[];
BEGIN
    FOREACH v_relation IN ARRAY ARRAY[
        'company_members',
        'fleet_assets',
        'fleet_trips',
        'logistics_audit_log',
        'profiles',
        'projects'
    ] LOOP
        IF pg_catalog.to_regclass('public.' || v_relation) IS NULL THEN
            v_missing := pg_catalog.array_append(v_missing, 'relation public.' || v_relation);
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY ARRAY[
        'auth.uid()',
        'auth.jwt()',
        'public.company_billing_allows_operational_write(uuid)',
        'public.verify_company_membership_access(uuid)',
        'public.fn_normalize_fleet_assets()',
        'public.fn_normalize_fleet_trips()',
        'public.fn_logistics_meta_stamp()',
        'public.fn_logistics_audit_trigger()'
    ] LOOP
        IF pg_catalog.to_regprocedure(v_signature) IS NULL THEN
            v_missing := pg_catalog.array_append(v_missing, 'function ' || v_signature);
        END IF;
    END LOOP;

    FOR v_required IN
        SELECT required.relation_name, required.column_name
        FROM (
            VALUES
                ('company_members', 'company_id'),
                ('company_members', 'profile_id'),
                ('company_members', 'is_active'),

                ('projects', 'id'),
                ('projects', 'company_id'),

                ('profiles', 'id'),
                ('profiles', 'full_name'),
                ('profiles', 'email'),

                ('fleet_assets', 'id'),
                ('fleet_assets', 'company_id'),
                ('fleet_assets', 'current_project_id'),
                ('fleet_assets', 'asset_number'),
                ('fleet_assets', 'category'),
                ('fleet_assets', 'asset_type'),
                ('fleet_assets', 'make_model'),
                ('fleet_assets', 'registration'),
                ('fleet_assets', 'vin_chassis_number'),
                ('fleet_assets', 'assigned_driver_operator'),
                ('fleet_assets', 'current_location'),
                ('fleet_assets', 'notes'),
                ('fleet_assets', 'is_archived'),
                ('fleet_assets', 'archived_at'),
                ('fleet_assets', 'archived_by'),
                ('fleet_assets', 'created_by'),
                ('fleet_assets', 'updated_by'),
                ('fleet_assets', 'created_at'),
                ('fleet_assets', 'updated_at'),

                ('fleet_trips', 'id'),
                ('fleet_trips', 'company_id'),
                ('fleet_trips', 'project_id'),
                ('fleet_trips', 'fleet_asset_id'),
                ('fleet_trips', 'driver_first_name'),
                ('fleet_trips', 'driver_last_name'),
                ('fleet_trips', 'start_destination'),
                ('fleet_trips', 'end_destination'),
                ('fleet_trips', 'notes'),
                ('fleet_trips', 'registration_snapshot'),
                ('fleet_trips', 'vehicle_type_snapshot'),
                ('fleet_trips', 'category_snapshot'),
                ('fleet_trips', 'is_archived'),
                ('fleet_trips', 'archived_at'),
                ('fleet_trips', 'archived_by'),
                ('fleet_trips', 'created_by'),
                ('fleet_trips', 'updated_by'),
                ('fleet_trips', 'created_at'),
                ('fleet_trips', 'updated_at'),

                ('logistics_audit_log', 'company_id'),
                ('logistics_audit_log', 'project_id'),
                ('logistics_audit_log', 'entity_type'),
                ('logistics_audit_log', 'entity_id'),
                ('logistics_audit_log', 'action'),
                ('logistics_audit_log', 'changed_by'),
                ('logistics_audit_log', 'changed_by_name'),
                ('logistics_audit_log', 'changed_by_email'),
                ('logistics_audit_log', 'changed_at'),
                ('logistics_audit_log', 'changed_fields'),
                ('logistics_audit_log', 'old_values'),
                ('logistics_audit_log', 'new_values')
        ) AS required(relation_name, column_name)
    LOOP
        v_relation_oid := pg_catalog.to_regclass('public.' || v_required.relation_name);

        IF v_relation_oid IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM pg_catalog.pg_attribute AS attribute
               WHERE attribute.attrelid = v_relation_oid
                 AND attribute.attname = v_required.column_name
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
           ) THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'column public.' || v_required.relation_name || '.' || v_required.column_name
            );
        END IF;
    END LOOP;

    -- Preserve the live function signatures, return types and SECURITY DEFINER contract.
    FOR v_required IN
        SELECT required.signature, required.return_type
        FROM (
            VALUES
                ('public.verify_company_membership_access(uuid)', 'boolean'),
                ('public.fn_normalize_fleet_assets()', 'trigger'),
                ('public.fn_normalize_fleet_trips()', 'trigger'),
                ('public.fn_logistics_meta_stamp()', 'trigger'),
                ('public.fn_logistics_audit_trigger()', 'trigger')
        ) AS required(signature, return_type)
    LOOP
        v_function_oid := pg_catalog.to_regprocedure(v_required.signature);

        IF v_function_oid IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM pg_catalog.pg_proc AS procedure
               WHERE procedure.oid = v_function_oid
                 AND procedure.prorettype = pg_catalog.to_regtype(v_required.return_type)
                 AND procedure.prosecdef
           ) THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'live function contract ' || v_required.signature
            );
        END IF;
    END LOOP;

    -- Preserve all six live trigger bindings, timing/event masks and audit arguments.
    FOR v_required IN
        SELECT
            required.relation_name,
            required.trigger_name,
            required.function_signature,
            required.trigger_type,
            required.argument_count,
            required.argument_fragment
        FROM (
            VALUES
                ('fleet_assets', 'trg_normalize_fleet_assets',
                    'public.fn_normalize_fleet_assets()', 23, 0, NULL),
                ('fleet_assets', 'trg_meta_stamp_fleet_assets',
                    'public.fn_logistics_meta_stamp()', 23, 0, NULL),
                ('fleet_assets', 'trg_audit_fleet_assets',
                    'public.fn_logistics_audit_trigger()', 29, 1, 'fleet_asset'),
                ('fleet_trips', 'trg_normalize_fleet_trips',
                    'public.fn_normalize_fleet_trips()', 23, 0, NULL),
                ('fleet_trips', 'trg_meta_stamp_fleet_trips',
                    'public.fn_logistics_meta_stamp()', 23, 0, NULL),
                ('fleet_trips', 'trg_audit_fleet_trips',
                    'public.fn_logistics_audit_trigger()', 29, 1, 'fleet_trip')
        ) AS required(
            relation_name,
            trigger_name,
            function_signature,
            trigger_type,
            argument_count,
            argument_fragment
        )
    LOOP
        v_relation_oid := pg_catalog.to_regclass('public.' || v_required.relation_name);
        v_function_oid := pg_catalog.to_regprocedure(v_required.function_signature);
        v_trigger_oid := NULL;

        IF v_relation_oid IS NOT NULL THEN
            SELECT trigger.oid
            INTO v_trigger_oid
            FROM pg_catalog.pg_trigger AS trigger
            WHERE trigger.tgrelid = v_relation_oid
              AND trigger.tgname = v_required.trigger_name
              AND NOT trigger.tgisinternal
              AND trigger.tgfoid = v_function_oid
              AND trigger.tgtype = v_required.trigger_type
              AND trigger.tgnargs = v_required.argument_count
              AND trigger.tgenabled = 'O'
              AND (
                  v_required.argument_fragment IS NULL
                  OR pg_catalog.strpos(
                      pg_catalog.pg_get_triggerdef(trigger.oid, false),
                      v_required.argument_fragment
                  ) > 0
              );
        END IF;

        IF v_trigger_oid IS NULL THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'trigger contract public.' || v_required.relation_name || '.'
                    || v_required.trigger_name
            );
        END IF;
    END LOOP;

    -- These are the live permissive authorization policies. They are prerequisites,
    -- not replacement targets; the Billing policies below are additive and restrictive.
    FOR v_required IN
        SELECT required.relation_name, required.policy_name, required.command
        FROM (
            VALUES
                ('fleet_assets', 'select_fleet_assets', 'r'),
                ('fleet_assets', 'insert_fleet_assets', 'a'),
                ('fleet_assets', 'update_fleet_assets', 'w'),
                ('fleet_trips', 'select_fleet_trips', 'r'),
                ('fleet_trips', 'insert_fleet_trips', 'a'),
                ('fleet_trips', 'update_fleet_trips', 'w')
        ) AS required(relation_name, policy_name, command)
    LOOP
        v_relation_oid := pg_catalog.to_regclass('public.' || v_required.relation_name);

        IF v_relation_oid IS NOT NULL
           AND NOT EXISTS (
               SELECT 1
               FROM pg_catalog.pg_policy AS policy
               WHERE policy.polrelid = v_relation_oid
                 AND policy.polname = v_required.policy_name
                 AND policy.polcmd = v_required.command
                 AND policy.polpermissive
                 AND pg_catalog.to_regrole('authenticated') = ANY (policy.polroles)
           ) THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'permissive policy public.' || v_required.relation_name || '.'
                    || v_required.policy_name
            );
        END IF;
    END LOOP;

    IF pg_catalog.cardinality(v_missing) > 0 THEN
        RAISE EXCEPTION 'Logistics Billing migration prerequisites are missing or incompatible: %',
            pg_catalog.array_to_string(v_missing, ', ')
            USING ERRCODE = 'P0001';
    END IF;
END;
$migration_guard$;

-- ============================================================================
-- 1. HARDENED MEMBERSHIP HELPER
--
-- The live signature, result, volatility, SECURITY DEFINER behavior and
-- authenticated/service-role execution contract remain unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_company_membership_access(
    co_id pg_catalog.uuid
)
RETURNS pg_catalog.bool
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.company_members AS member
            WHERE member.company_id = co_id
              AND member.profile_id = auth.uid()
              AND member.is_active = true
        );
$function$;

-- ============================================================================
-- 2. HARDENED TRIGGER FUNCTIONS
--
-- Bodies below preserve the live Logistics behavior captured before this
-- migration, including INSERT/RESTORE audit action labels and JWT fallbacks.
-- ============================================================================

-- 2.1 Fleet Assets Normalization and Project Validation
CREATE OR REPLACE FUNCTION public.fn_normalize_fleet_assets()
RETURNS pg_catalog.trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    NEW.asset_number := pg_catalog.btrim(NEW.asset_number);
    NEW.asset_type := pg_catalog.btrim(NEW.asset_type);
    NEW.make_model := pg_catalog.btrim(NEW.make_model);

    NEW.registration := NULLIF(pg_catalog.btrim(NEW.registration), '');
    NEW.vin_chassis_number := NULLIF(pg_catalog.btrim(NEW.vin_chassis_number), '');
    NEW.assigned_driver_operator := NULLIF(
        pg_catalog.btrim(NEW.assigned_driver_operator),
        ''
    );
    NEW.current_location := NULLIF(pg_catalog.btrim(NEW.current_location), '');
    NEW.notes := NULLIF(pg_catalog.btrim(NEW.notes), '');

    IF NEW.asset_number = '' OR NEW.asset_number IS NULL THEN
        RAISE EXCEPTION 'Asset number cannot be blank';
    END IF;

    IF NEW.asset_type = '' OR NEW.asset_type IS NULL THEN
        RAISE EXCEPTION 'Asset type cannot be blank';
    END IF;

    IF NEW.make_model = '' OR NEW.make_model IS NULL THEN
        RAISE EXCEPTION 'Make and model cannot be blank';
    END IF;

    IF NEW.current_project_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.projects AS project
           WHERE project.id = NEW.current_project_id
             AND project.company_id = NEW.company_id
       ) THEN
        RAISE EXCEPTION
            'Cross-company violation: Current project does not belong to the asset company.';
    END IF;

    RETURN NEW;
END;
$function$;

-- 2.2 Fleet Trips Normalization, Asset Validation and Project Validation
CREATE OR REPLACE FUNCTION public.fn_normalize_fleet_trips()
RETURNS pg_catalog.trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_asset_company_id pg_catalog.uuid;
    v_registration pg_catalog.text;
    v_asset_type pg_catalog.text;
    v_category pg_catalog.text;
BEGIN
    NEW.driver_first_name := pg_catalog.btrim(NEW.driver_first_name);
    NEW.driver_last_name := pg_catalog.btrim(NEW.driver_last_name);
    NEW.start_destination := pg_catalog.btrim(NEW.start_destination);
    NEW.end_destination := NULLIF(pg_catalog.btrim(NEW.end_destination), '');
    NEW.notes := NULLIF(pg_catalog.btrim(NEW.notes), '');

    IF NEW.driver_first_name = '' OR NEW.driver_first_name IS NULL THEN
        RAISE EXCEPTION 'Driver first name cannot be blank';
    END IF;

    IF NEW.driver_last_name = '' OR NEW.driver_last_name IS NULL THEN
        RAISE EXCEPTION 'Driver last name cannot be blank';
    END IF;

    IF NEW.start_destination = '' OR NEW.start_destination IS NULL THEN
        RAISE EXCEPTION 'Start destination cannot be blank';
    END IF;

    SELECT
        asset.company_id,
        asset.registration,
        asset.asset_type,
        asset.category
    INTO
        v_asset_company_id,
        v_registration,
        v_asset_type,
        v_category
    FROM public.fleet_assets AS asset
    WHERE asset.id = NEW.fleet_asset_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced fleet asset does not exist.';
    END IF;

    IF v_asset_company_id <> NEW.company_id THEN
        RAISE EXCEPTION
            'Cross-company violation: Fleet asset does not belong to the same company.';
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.registration_snapshot := v_registration;
        NEW.vehicle_type_snapshot := v_asset_type;
        NEW.category_snapshot := v_category;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.fleet_asset_id IS DISTINCT FROM OLD.fleet_asset_id THEN
            NEW.registration_snapshot := v_registration;
            NEW.vehicle_type_snapshot := v_asset_type;
            NEW.category_snapshot := v_category;
        ELSE
            NEW.registration_snapshot := OLD.registration_snapshot;
            NEW.vehicle_type_snapshot := OLD.vehicle_type_snapshot;
            NEW.category_snapshot := OLD.category_snapshot;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported operation for fleet trip normalisation: %', TG_OP;
    END IF;

    IF NEW.project_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.projects AS project
           WHERE project.id = NEW.project_id
             AND project.company_id = NEW.company_id
       ) THEN
        RAISE EXCEPTION
            'Cross-company violation: Project does not belong to the trip company.';
    END IF;

    RETURN NEW;
END;
$function$;

-- 2.3 Logistics Metadata Stamping and Immutable Tenancy
CREATE OR REPLACE FUNCTION public.fn_logistics_meta_stamp()
RETURNS pg_catalog.trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_by := auth.uid();
        NEW.created_at := pg_catalog.now();
        NEW.updated_by := auth.uid();
        NEW.updated_at := pg_catalog.now();
        NEW.is_archived := false;
        NEW.archived_by := NULL;
        NEW.archived_at := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Cannot modify id of an existing Logistics record';
        END IF;

        IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
            RAISE EXCEPTION 'Cannot modify company_id of an existing Logistics record';
        END IF;

        NEW.created_by := OLD.created_by;
        NEW.created_at := OLD.created_at;
        NEW.updated_by := auth.uid();
        NEW.updated_at := pg_catalog.now();

        IF OLD.is_archived = false AND NEW.is_archived = true THEN
            NEW.archived_by := auth.uid();
            NEW.archived_at := pg_catalog.now();
        ELSIF OLD.is_archived = true AND NEW.is_archived = false THEN
            NEW.archived_by := NULL;
            NEW.archived_at := NULL;
        ELSE
            NEW.archived_by := OLD.archived_by;
            NEW.archived_at := OLD.archived_at;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- 2.4 Logistics Audit Trigger
CREATE OR REPLACE FUNCTION public.fn_logistics_audit_trigger()
RETURNS pg_catalog.trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_company_id pg_catalog.uuid;
    v_project_id pg_catalog.uuid;
    v_entity_type pg_catalog.text;
    v_entity_id pg_catalog.uuid;
    v_action pg_catalog.text;
    v_user_id pg_catalog.uuid;
    v_user_name pg_catalog.text;
    v_user_email pg_catalog.text;
    v_changed_fields pg_catalog.text[] := ARRAY[]::pg_catalog.text[];
    v_old_values pg_catalog.jsonb := NULL;
    v_new_values pg_catalog.jsonb := NULL;
    v_row_values pg_catalog.jsonb;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NOT NULL THEN
        SELECT profile.full_name, profile.email
        INTO v_user_name, v_user_email
        FROM public.profiles AS profile
        WHERE profile.id = v_user_id;

        IF v_user_name IS NULL THEN
            v_user_name := COALESCE(
                auth.jwt() -> 'user_metadata' ->> 'full_name',
                'Unknown User'
            );
        END IF;

        v_user_email := COALESCE(v_user_email, auth.jwt() ->> 'email');
    ELSE
        v_user_name := 'System/DB Direct';
        v_user_email := NULL;
    END IF;

    v_entity_type := TG_ARGV[0];

    v_row_values :=
        CASE
            WHEN TG_OP = 'DELETE' THEN pg_catalog.to_jsonb(OLD)
            ELSE pg_catalog.to_jsonb(NEW)
        END;

    IF v_entity_type = 'fleet_asset' THEN
        v_project_id := NULLIF(v_row_values ->> 'current_project_id', '')::pg_catalog.uuid;
    ELSIF v_entity_type = 'fleet_trip' THEN
        v_project_id := NULLIF(v_row_values ->> 'project_id', '')::pg_catalog.uuid;
    ELSE
        RAISE EXCEPTION 'Unsupported Logistics audit entity type: %', v_entity_type;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_entity_id := NEW.id;
        v_company_id := NEW.company_id;
        v_new_values := pg_catalog.to_jsonb(NEW)
            - 'created_at' - 'updated_at' - 'created_by' - 'updated_by';
    ELSIF TG_OP = 'UPDATE' THEN
        v_entity_id := NEW.id;
        v_company_id := NEW.company_id;

        IF OLD.is_archived = false AND NEW.is_archived = true THEN
            v_action := 'ARCHIVE';
        ELSIF OLD.is_archived = true AND NEW.is_archived = false THEN
            v_action := 'RESTORE';
        ELSE
            v_action := 'UPDATE';
        END IF;

        v_old_values := pg_catalog.to_jsonb(OLD)
            - 'created_at' - 'updated_at' - 'created_by' - 'updated_by'
            - 'archived_at' - 'archived_by';
        v_new_values := pg_catalog.to_jsonb(NEW)
            - 'created_at' - 'updated_at' - 'created_by' - 'updated_by'
            - 'archived_at' - 'archived_by';

        SELECT COALESCE(
            pg_catalog.array_agg(changed.key ORDER BY changed.key),
            ARRAY[]::pg_catalog.text[]
        )
        INTO v_changed_fields
        FROM (
            SELECT keys.key
            FROM pg_catalog.jsonb_object_keys(v_old_values || v_new_values) AS keys(key)
            WHERE (v_old_values -> keys.key) IS DISTINCT FROM (v_new_values -> keys.key)
        ) AS changed;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_entity_id := OLD.id;
        v_company_id := OLD.company_id;
        v_old_values := pg_catalog.to_jsonb(OLD)
            - 'created_at' - 'updated_at' - 'created_by' - 'updated_by';
    END IF;

    INSERT INTO public.logistics_audit_log (
        company_id,
        project_id,
        entity_type,
        entity_id,
        action,
        changed_by,
        changed_by_name,
        changed_by_email,
        changed_at,
        changed_fields,
        old_values,
        new_values
    ) VALUES (
        v_company_id,
        v_project_id,
        v_entity_type,
        v_entity_id,
        v_action,
        v_user_id,
        v_user_name,
        v_user_email,
        pg_catalog.now(),
        v_changed_fields,
        v_old_values,
        v_new_values
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;

-- ============================================================================
-- 3. RESTRICTIVE RLS WRITE POLICIES
--
-- PostgreSQL ORs the existing permissive authorization policies, then ANDs
-- their result with these restrictive policies. No existing policy is dropped.
-- ============================================================================

ALTER TABLE public.fleet_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_trips ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3.1 FLEET ASSETS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS billing_operational_write_insert ON public.fleet_assets;
CREATE POLICY billing_operational_write_insert
    ON public.fleet_assets
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND (
            current_project_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS project
                WHERE project.id = fleet_assets.current_project_id
                  AND project.company_id = fleet_assets.company_id
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.fleet_assets;
CREATE POLICY billing_operational_write_update
    ON public.fleet_assets
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND (
            current_project_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS project
                WHERE project.id = fleet_assets.current_project_id
                  AND project.company_id = fleet_assets.company_id
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.fleet_assets;
CREATE POLICY billing_operational_write_delete
    ON public.fleet_assets
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- ----------------------------------------------------------------------------
-- 3.2 FLEET TRIPS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS billing_operational_write_insert ON public.fleet_trips;
CREATE POLICY billing_operational_write_insert
    ON public.fleet_trips
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.fleet_assets AS asset
            WHERE asset.id = fleet_trips.fleet_asset_id
              AND asset.company_id = fleet_trips.company_id
        )
        AND (
            project_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS project
                WHERE project.id = fleet_trips.project_id
                  AND project.company_id = fleet_trips.company_id
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.fleet_trips;
CREATE POLICY billing_operational_write_update
    ON public.fleet_trips
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
            FROM public.fleet_assets AS asset
            WHERE asset.id = fleet_trips.fleet_asset_id
              AND asset.company_id = fleet_trips.company_id
        )
        AND (
            project_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS project
                WHERE project.id = fleet_trips.project_id
                  AND project.company_id = fleet_trips.company_id
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.fleet_trips;
CREATE POLICY billing_operational_write_delete
    ON public.fleet_trips
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- ============================================================================
-- 4. FUNCTION EXECUTION PRIVILEGES
--
-- Preserve the live service_role grants. Trigger functions are not callable by
-- client roles. The membership helper remains executable by authenticated.
-- ============================================================================

REVOKE ALL ON FUNCTION public.verify_company_membership_access(uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_company_membership_access(uuid)
    TO authenticated;

REVOKE ALL ON FUNCTION public.fn_normalize_fleet_assets()
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_normalize_fleet_trips()
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_logistics_meta_stamp()
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_logistics_audit_trigger()
    FROM PUBLIC, anon, authenticated;

COMMIT;

