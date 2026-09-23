BEGIN;

-- ====================================================================
-- ProjectMatrix Logistics Supabase Integration Migration
-- ====================================================================

-- 1. Create Core Fleet Assets Table
CREATE TABLE public.fleet_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    current_project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
    asset_number TEXT NOT NULL,
    category TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    make_model TEXT NOT NULL,
    registration TEXT NULL,
    vin_chassis_number TEXT NULL,
    model_year INTEGER NULL,
    status TEXT NOT NULL DEFAULT 'Available',
    assigned_driver_operator TEXT NULL,
    current_location TEXT NULL,
    odometer_reading NUMERIC NOT NULL DEFAULT 0,
    operating_hours NUMERIC NOT NULL DEFAULT 0,
    last_service_date DATE NULL,
    next_service_date DATE NULL,
    notes TEXT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ NULL,
    archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_fleet_assets_asset_number_not_empty CHECK (btrim(asset_number) <> ''),
    CONSTRAINT chk_fleet_assets_asset_type_not_empty CHECK (btrim(asset_type) <> ''),
    CONSTRAINT chk_fleet_assets_make_model_not_empty CHECK (btrim(make_model) <> ''),
    CONSTRAINT chk_fleet_assets_odometer CHECK (odometer_reading >= 0),
    CONSTRAINT chk_fleet_assets_operating_hours CHECK (operating_hours >= 0),
    CONSTRAINT chk_fleet_assets_model_year CHECK (model_year IS NULL OR (model_year >= 1900 AND model_year <= 2100)),
    CONSTRAINT chk_fleet_assets_category CHECK (category IN ('Plant', 'Automobiles', 'Commercial Vehicles')),
    CONSTRAINT chk_fleet_assets_status CHECK (status IN ('Available', 'In Use', 'Under Maintenance', 'Out of Service'))
);

-- Case-insensitive asset number uniqueness within a company
CREATE UNIQUE INDEX idx_fleet_assets_company_asset_number_uniq 
ON public.fleet_assets(company_id, lower(btrim(asset_number)));

-- Case-insensitive non-blank registration uniqueness within a company
CREATE UNIQUE INDEX idx_fleet_assets_company_reg_uniq 
ON public.fleet_assets(company_id, lower(btrim(registration))) 
WHERE registration IS NOT NULL;


-- 2. Create Core Fleet Trips Table
CREATE TABLE public.fleet_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
    fleet_asset_id UUID NOT NULL REFERENCES public.fleet_assets(id) ON DELETE RESTRICT,
    driver_first_name TEXT NOT NULL,
    driver_last_name TEXT NOT NULL,
    start_destination TEXT NOT NULL,
    end_destination TEXT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NULL,
    kilometres_travelled NUMERIC NOT NULL DEFAULT 0,
    fuel_quantity NUMERIC NOT NULL DEFAULT 0,
    fuel_unit TEXT NOT NULL DEFAULT 'L',
    fuel_litres NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN fuel_unit = 'L' THEN fuel_quantity
            WHEN fuel_unit = 'gal' THEN fuel_quantity * 3.78541
            ELSE fuel_quantity
        END
    ) STORED,
    status TEXT NOT NULL DEFAULT 'In Progress',
    notes TEXT NULL,
    
    -- Immutable database-driven asset snapshot fields
    registration_snapshot TEXT NULL,
    vehicle_type_snapshot TEXT NULL,
    category_snapshot TEXT NULL,
    
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ NULL,
    archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_fleet_trips_driver_first_name_not_empty CHECK (btrim(driver_first_name) <> ''),
    CONSTRAINT chk_fleet_trips_driver_last_name_not_empty CHECK (btrim(driver_last_name) <> ''),
    CONSTRAINT chk_fleet_trips_start_destination_not_empty CHECK (btrim(start_destination) <> ''),
    CONSTRAINT chk_fleet_trips_ended_at CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT chk_fleet_trips_completed CHECK (status <> 'Completed' OR (end_destination IS NOT NULL AND btrim(end_destination) <> '' AND ended_at IS NOT NULL)),
    CONSTRAINT chk_fleet_trips_kilometres CHECK (kilometres_travelled >= 0),
    CONSTRAINT chk_fleet_trips_fuel CHECK (fuel_quantity >= 0),
    CONSTRAINT chk_fleet_trips_fuel_unit CHECK (fuel_unit IN ('L', 'gal')),
    CONSTRAINT chk_fleet_trips_status CHECK (status IN ('In Progress', 'Completed', 'Delayed', 'Cancelled'))
);


-- 3. Create Immutable Logistics Audit Log Table
CREATE TABLE public.logistics_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    changed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_by_name TEXT NULL,
    changed_by_email TEXT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_fields TEXT[] NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,

    -- Constraints
    CONSTRAINT chk_audit_entity_type CHECK (entity_type IN ('fleet_asset', 'fleet_trip')),
    CONSTRAINT chk_audit_action CHECK (action IN ('INSERT', 'UPDATE', 'ARCHIVE', 'RESTORE', 'DELETE'))
);


-- ====================================================================
-- Helper Trigger Functions
-- ====================================================================

-- Trigger Function for empty string normalisation to NULL and validation
CREATE OR REPLACE FUNCTION public.fn_normalize_fleet_assets()
RETURNS TRIGGER AS $$
BEGIN
    NEW.asset_number := btrim(NEW.asset_number);
    NEW.asset_type := btrim(NEW.asset_type);
    NEW.make_model := btrim(NEW.make_model);

    NEW.registration := NULLIF(btrim(NEW.registration), '');
    NEW.vin_chassis_number := NULLIF(btrim(NEW.vin_chassis_number), '');
    NEW.assigned_driver_operator := NULLIF(btrim(NEW.assigned_driver_operator), '');
    NEW.current_location := NULLIF(btrim(NEW.current_location), '');
    NEW.notes := NULLIF(btrim(NEW.notes), '');

    -- Reject blank required values
    IF NEW.asset_number = '' OR NEW.asset_number IS NULL THEN
        RAISE EXCEPTION 'Asset number cannot be blank';
    END IF;
    IF NEW.asset_type = '' OR NEW.asset_type IS NULL THEN
        RAISE EXCEPTION 'Asset type cannot be blank';
    END IF;
    IF NEW.make_model = '' OR NEW.make_model IS NULL THEN
        RAISE EXCEPTION 'Make and model cannot be blank';
    END IF;

    -- Validate current project belongs to the same company
    IF NEW.current_project_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = NEW.current_project_id AND company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'Cross-company violation: Current project does not belong to the asset company.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- Trigger Function for fleet trip company checks, snapshot population and normalisation
CREATE OR REPLACE FUNCTION public.fn_normalize_fleet_trips()
RETURNS TRIGGER AS $$
DECLARE
    v_asset_company_id UUID;
    v_reg TEXT;
    v_type TEXT;
    v_cat TEXT;
BEGIN
    -- Trim manual text fields and handle empty optionals
    NEW.driver_first_name := btrim(NEW.driver_first_name);
    NEW.driver_last_name := btrim(NEW.driver_last_name);
    NEW.start_destination := btrim(NEW.start_destination);
    NEW.end_destination := NULLIF(btrim(NEW.end_destination), '');
    NEW.notes := NULLIF(btrim(NEW.notes), '');

    -- Reject blank required values
    IF NEW.driver_first_name = '' OR NEW.driver_first_name IS NULL THEN
        RAISE EXCEPTION 'Driver first name cannot be blank';
    END IF;
    IF NEW.driver_last_name = '' OR NEW.driver_last_name IS NULL THEN
        RAISE EXCEPTION 'Driver last name cannot be blank';
    END IF;
    IF NEW.start_destination = '' OR NEW.start_destination IS NULL THEN
        RAISE EXCEPTION 'Start destination cannot be blank';
    END IF;

    -- Validate and fetch asset details
    SELECT company_id, registration, asset_type, category 
    INTO v_asset_company_id, v_reg, v_type, v_cat
    FROM public.fleet_assets
    WHERE id = NEW.fleet_asset_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced fleet asset does not exist.';
    END IF;
    
    IF v_asset_company_id <> NEW.company_id THEN
        RAISE EXCEPTION 'Cross-company violation: Fleet asset does not belong to the same company.';
    END IF;
    
    -- Populate snapshots conditionally with safe operation branching
    IF TG_OP = 'INSERT' THEN
        NEW.registration_snapshot := v_reg;
        NEW.vehicle_type_snapshot := v_type;
        NEW.category_snapshot := v_cat;

    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.fleet_asset_id IS DISTINCT FROM OLD.fleet_asset_id THEN
            NEW.registration_snapshot := v_reg;
            NEW.vehicle_type_snapshot := v_type;
            NEW.category_snapshot := v_cat;
        ELSE
            NEW.registration_snapshot := OLD.registration_snapshot;
            NEW.vehicle_type_snapshot := OLD.vehicle_type_snapshot;
            NEW.category_snapshot := OLD.category_snapshot;
        END IF;

    ELSE
        RAISE EXCEPTION 'Unsupported operation for fleet trip normalisation: %', TG_OP;
    END IF;

    -- Validate referenced project (if specified) belongs to the same company
    IF NEW.project_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = NEW.project_id AND company_id = NEW.company_id
        ) THEN
            RAISE EXCEPTION 'Cross-company violation: Project does not belong to the trip company.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- Trigger Function for metadata stamping (created_by, updated_by, archived_by, etc.)
CREATE OR REPLACE FUNCTION public.fn_logistics_meta_stamp()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_by := auth.uid();
        NEW.created_at := now();
        NEW.updated_by := auth.uid();
        NEW.updated_at := now();
        NEW.is_archived := false;
        NEW.archived_by := NULL;
        NEW.archived_at := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Reject attempt to change id or company_id
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Cannot modify id of an existing Logistics record';
        END IF;

        IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
            RAISE EXCEPTION 'Cannot modify company_id of an existing Logistics record';
        END IF;

        -- Preserve immutable metadata
        NEW.created_by := OLD.created_by;
        NEW.created_at := OLD.created_at;

        -- Stamp update metadata
        NEW.updated_by := auth.uid();
        NEW.updated_at := now();
        
        -- Handle archive metadata transition
        IF OLD.is_archived = false AND NEW.is_archived = true THEN
            NEW.archived_by := auth.uid();
            NEW.archived_at := now();
        ELSIF OLD.is_archived = true AND NEW.is_archived = false THEN
            NEW.archived_by := NULL;
            NEW.archived_at := NULL;
        ELSE
            -- Preserve previous archive details
            NEW.archived_by := OLD.archived_by;
            NEW.archived_at := OLD.archived_at;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- Trigger Function for logistics audit trails (INSERT, UPDATE, ARCHIVE, RESTORE, DELETE)
CREATE OR REPLACE FUNCTION public.fn_logistics_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_project_id UUID;
    v_entity_type TEXT;
    v_entity_id UUID;
    v_action TEXT;
    v_user_id UUID;
    v_user_name TEXT;
    v_user_email TEXT;
    v_changed_fields TEXT[] := '{}';
    v_old_values JSONB := NULL;
    v_new_values JSONB := NULL;
    v_row_values JSONB;
BEGIN
    v_user_id := auth.uid();
    
    -- Safely retrieve user profile details as snapshots
    IF v_user_id IS NOT NULL THEN
        SELECT full_name, email INTO v_user_name, v_user_email
        FROM public.profiles
        WHERE id = v_user_id;
        
        IF v_user_name IS NULL THEN
            v_user_name := COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', 'Unknown User');
        END IF;
        v_user_email := COALESCE(v_user_email, auth.jwt() ->> 'email');
    ELSE
        v_user_name := 'System/DB Direct';
        v_user_email := NULL;
    END IF;

    v_entity_type := TG_ARGV[0];

    v_row_values :=
        CASE
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            ELSE to_jsonb(NEW)
        END;

    IF v_entity_type = 'fleet_asset' THEN
        v_project_id := NULLIF(v_row_values ->> 'current_project_id', '')::uuid;
    ELSIF v_entity_type = 'fleet_trip' THEN
        v_project_id := NULLIF(v_row_values ->> 'project_id', '')::uuid;
    ELSE
        RAISE EXCEPTION 'Unsupported Logistics audit entity type: %', v_entity_type;
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_entity_id := NEW.id;
        v_company_id := NEW.company_id;
        v_new_values := to_jsonb(NEW) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by';
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_entity_id := NEW.id;
        v_company_id := NEW.company_id;

        -- Differentiate core actions
        IF OLD.is_archived = false AND NEW.is_archived = true THEN
            v_action := 'ARCHIVE';
        ELSIF OLD.is_archived = true AND NEW.is_archived = false THEN
            v_action := 'RESTORE';
        ELSE
            v_action := 'UPDATE';
        END IF;

        v_old_values := to_jsonb(OLD) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by' - 'archived_at' - 'archived_by';
        v_new_values := to_jsonb(NEW) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by' - 'archived_at' - 'archived_by';
        
        -- Compute sorted changed keys using direct value comparison
        SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
        INTO v_changed_fields
        FROM (
            SELECT key
            FROM jsonb_object_keys(v_old_values || v_new_values) AS keys(key)
            WHERE (v_old_values -> key) IS DISTINCT FROM (v_new_values -> key)
        ) changed;

    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_entity_id := OLD.id;
        v_company_id := OLD.company_id;
        v_old_values := to_jsonb(OLD) - 'created_at' - 'updated_at' - 'created_by' - 'updated_by';
    END IF;

    -- Commit immutable audit record
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
        now(),
        v_changed_fields,
        v_old_values,
        v_new_values
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ====================================================================
-- Attach Database Triggers
-- ====================================================================

-- Fleet Assets Triggers
CREATE TRIGGER trg_normalize_fleet_assets
    BEFORE INSERT OR UPDATE ON public.fleet_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_normalize_fleet_assets();

CREATE TRIGGER trg_meta_stamp_fleet_assets
    BEFORE INSERT OR UPDATE ON public.fleet_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_logistics_meta_stamp();

CREATE TRIGGER trg_audit_fleet_assets
    AFTER INSERT OR UPDATE OR DELETE ON public.fleet_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_logistics_audit_trigger('fleet_asset');


-- Fleet Trips Triggers
CREATE TRIGGER trg_normalize_fleet_trips
    BEFORE INSERT OR UPDATE ON public.fleet_trips
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_normalize_fleet_trips();

CREATE TRIGGER trg_meta_stamp_fleet_trips
    BEFORE INSERT OR UPDATE ON public.fleet_trips
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_logistics_meta_stamp();

CREATE TRIGGER trg_audit_fleet_trips
    AFTER INSERT OR UPDATE OR DELETE ON public.fleet_trips
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_logistics_audit_trigger('fleet_trip');


-- ====================================================================
-- Enable Row Level Security (RLS)
-- ====================================================================

ALTER TABLE public.fleet_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_audit_log ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- Create Company-Level Membership Helper Function
-- ====================================================================

CREATE OR REPLACE FUNCTION public.verify_company_membership_access(
    co_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.company_id = co_id
              AND cm.profile_id = auth.uid()
              AND cm.is_active = true
        );
$function$;


-- ====================================================================
-- RLS Policy Implementations
-- ====================================================================

-- 1. Fleet Assets Policies
CREATE POLICY select_fleet_assets ON public.fleet_assets
    FOR SELECT TO authenticated
    USING (public.verify_company_membership_access(company_id));

CREATE POLICY insert_fleet_assets ON public.fleet_assets
    FOR INSERT TO authenticated
    WITH CHECK (public.verify_company_membership_access(company_id));

CREATE POLICY update_fleet_assets ON public.fleet_assets
    FOR UPDATE TO authenticated
    USING (public.verify_company_membership_access(company_id))
    WITH CHECK (public.verify_company_membership_access(company_id));

-- 2. Fleet Trips Policies
CREATE POLICY select_fleet_trips ON public.fleet_trips
    FOR SELECT TO authenticated
    USING (public.verify_company_membership_access(company_id));

CREATE POLICY insert_fleet_trips ON public.fleet_trips
    FOR INSERT TO authenticated
    WITH CHECK (public.verify_company_membership_access(company_id));

CREATE POLICY update_fleet_trips ON public.fleet_trips
    FOR UPDATE TO authenticated
    USING (public.verify_company_membership_access(company_id))
    WITH CHECK (public.verify_company_membership_access(company_id));

-- 3. Logistics Audit Log Policies
CREATE POLICY select_logistics_audit ON public.logistics_audit_log
    FOR SELECT TO authenticated
    USING (public.verify_company_membership_access(company_id));


-- ====================================================================
-- Database Indexes for Query Optimization
-- ====================================================================

-- Fleet Assets indexes
CREATE INDEX idx_fleet_assets_company_id ON public.fleet_assets(company_id);
CREATE INDEX idx_fleet_assets_company_archived ON public.fleet_assets(company_id, is_archived);
CREATE INDEX idx_fleet_assets_company_category ON public.fleet_assets(company_id, category);
CREATE INDEX idx_fleet_assets_company_status ON public.fleet_assets(company_id, status);
CREATE INDEX idx_fleet_assets_current_project ON public.fleet_assets(current_project_id);

-- Fleet Trips indexes
CREATE INDEX idx_fleet_trips_company_id ON public.fleet_trips(company_id);
CREATE INDEX idx_fleet_trips_company_archived ON public.fleet_trips(company_id, is_archived);
CREATE INDEX idx_fleet_trips_company_project ON public.fleet_trips(company_id, project_id);
CREATE INDEX idx_fleet_trips_asset ON public.fleet_trips(fleet_asset_id);
CREATE INDEX idx_fleet_trips_started ON public.fleet_trips(started_at);
CREATE INDEX idx_fleet_trips_company_started ON public.fleet_trips(company_id, started_at);
CREATE INDEX idx_fleet_trips_status ON public.fleet_trips(status);

-- Logistics Audit Log indexes
CREATE INDEX idx_logistics_audit_company_changed ON public.logistics_audit_log(company_id, changed_at);
CREATE INDEX idx_logistics_audit_entity ON public.logistics_audit_log(entity_type, entity_id);
CREATE INDEX idx_logistics_audit_user ON public.logistics_audit_log(changed_by);
CREATE INDEX idx_logistics_audit_project ON public.logistics_audit_log(project_id);


-- ====================================================================
-- Database Grants and Execution Hardening
-- ====================================================================

-- Explicitly revoke table privileges from public before granting
REVOKE ALL ON TABLE public.fleet_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fleet_trips FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.logistics_audit_log FROM PUBLIC, anon, authenticated;

-- Explicit grants to authenticated role
GRANT SELECT, INSERT, UPDATE ON public.fleet_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fleet_trips TO authenticated;
GRANT SELECT ON public.logistics_audit_log TO authenticated;

-- Explicitly revoke public execution of our trigger functions for security
REVOKE ALL ON FUNCTION public.fn_normalize_fleet_assets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_normalize_fleet_trips() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_logistics_meta_stamp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_logistics_audit_trigger() FROM PUBLIC, anon, authenticated;

-- Revoke all function privileges on the new helper from PUBLIC, anon, authenticated
REVOKE ALL ON FUNCTION public.verify_company_membership_access(uuid) FROM PUBLIC, anon, authenticated;

-- Explicitly grant execute on the new helper to authenticated role
GRANT EXECUTE ON FUNCTION public.verify_company_membership_access(uuid) TO authenticated;

COMMIT;
