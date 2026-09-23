-- ============================================================================
-- Step 3C.4F-1I: Enforce Billing Access on Procurement and Inventory
--
-- Protects:
--   1. public.procurement_items
--   2. public.procurement_forecasts
--   3. public.project_inventory_items
--
-- Enforces:
--   - public.company_billing_allows_operational_write(company_id) on all INSERT, UPDATE, DELETE write policies
--   - Authoritative company and project relationship validation on child & linked entities
--   - ID tampering & tenant isolation protections
--   - Search path safety (SET search_path = '') and full schema qualification on all functions
--   - Billing guard on public.soft_delete_project_inventory_item RPC with PM001 error code
--   - Automatic procurement-to-inventory synchronization preservation
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: TABLE DEFINITIONS & CONSTRAINTS (IDEMPOTENT)
-- ============================================================================

-- 1.1 Procurement Items
CREATE TABLE IF NOT EXISTS public.procurement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    item_name TEXT NOT NULL,
    supplier_name TEXT,
    quotation_number TEXT,
    procurement_date DATE,
    required_by_date DATE,
    quantity NUMERIC,
    unit TEXT,
    unit_rate NUMERIC,
    vat_percentage NUMERIC DEFAULT 0,
    amount_excl_vat NUMERIC DEFAULT 0,
    vat_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending',
    priority TEXT NOT NULL DEFAULT 'Medium',
    notes TEXT,
    quotation_file_path TEXT,
    quotation_file_name TEXT,
    quotation_file_type TEXT,
    quotation_file_size BIGINT,
    proof_of_payment_path TEXT,
    proof_of_payment_file_name TEXT,
    proof_of_payment_file_type TEXT,
    proof_of_payment_file_size BIGINT,
    paid_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    programme_id UUID,
    programme_activity_id UUID
);

-- 1.2 Procurement Forecasts
CREATE TABLE IF NOT EXISTS public.procurement_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    forecast_month INTEGER NOT NULL CHECK (forecast_month BETWEEN 1 AND 12),
    forecast_year INTEGER NOT NULL,
    category TEXT NOT NULL,
    forecast_amount_excl_vat NUMERIC DEFAULT 0,
    forecast_vat NUMERIC DEFAULT 0,
    forecast_total_amount NUMERIC DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- 1.3 Project Inventory Items
CREATE TABLE IF NOT EXISTS public.project_inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    procurement_item_id UUID NULL REFERENCES public.procurement_items(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'procurement' CHECK (source IN ('procurement', 'company_stock')),
    category TEXT CHECK (category IS NULL OR category IN ('OHS', 'Site Establishment', 'Operational Costs', 'Environmental')),
    subcategory TEXT,
    item_name TEXT NOT NULL,
    quantity NUMERIC NULL CHECK (quantity IS NULL OR quantity > 0),
    description TEXT,
    logged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT chk_company_stock_requirements CHECK (
        source <> 'company_stock' OR (
            category IS NOT NULL 
            AND quantity IS NOT NULL 
            AND quantity > 0 
            AND description IS NOT NULL 
            AND pg_catalog.length(pg_catalog.btrim(description)) > 0 
            AND procurement_item_id IS NULL
        )
    )
);

-- Performance and Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_procurement_items_company_id ON public.procurement_items(company_id);
CREATE INDEX IF NOT EXISTS idx_procurement_items_project_id ON public.procurement_items(project_id);
CREATE INDEX IF NOT EXISTS idx_procurement_items_company_project ON public.procurement_items(company_id, project_id);

CREATE INDEX IF NOT EXISTS idx_procurement_forecasts_company_id ON public.procurement_forecasts(company_id);
CREATE INDEX IF NOT EXISTS idx_procurement_forecasts_project_id ON public.procurement_forecasts(project_id);
CREATE INDEX IF NOT EXISTS idx_procurement_forecasts_company_project ON public.procurement_forecasts(company_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_inventory_items_company_id ON public.project_inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_project_id ON public.project_inventory_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_company_project ON public.project_inventory_items(company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_procurement_item_id ON public.project_inventory_items(procurement_item_id) WHERE procurement_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_source ON public.project_inventory_items(source);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_category ON public.project_inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_active_scope_category ON public.project_inventory_items (company_id, project_id, category) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_inventory_procurement_item 
    ON public.project_inventory_items (procurement_item_id) 
    WHERE procurement_item_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- SECTION 2: TRIGGER FUNCTIONS & METASTAMPS
-- ============================================================================

-- 2.1 Meta stamping for procurement_items
CREATE OR REPLACE FUNCTION public.fn_procurement_items_meta_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := pg_catalog.coalesce(NEW.created_at, pg_catalog.now());
        NEW.updated_at := pg_catalog.now();
        IF NEW.created_by IS NULL THEN
            NEW.created_by := auth.uid();
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.company_id := OLD.company_id;
        NEW.project_id := OLD.project_id;
        NEW.created_by := OLD.created_by;
        NEW.created_at := OLD.created_at;
        NEW.updated_at := pg_catalog.now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_procurement_items_meta_stamp ON public.procurement_items;
CREATE TRIGGER trg_procurement_items_meta_stamp
    BEFORE INSERT OR UPDATE ON public.procurement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_procurement_items_meta_stamp();

-- 2.2 Meta stamping for procurement_forecasts
CREATE OR REPLACE FUNCTION public.fn_procurement_forecasts_meta_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := pg_catalog.coalesce(NEW.created_at, pg_catalog.now());
        NEW.updated_at := pg_catalog.now();
        IF NEW.created_by IS NULL THEN
            NEW.created_by := auth.uid();
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.company_id := OLD.company_id;
        NEW.project_id := OLD.project_id;
        NEW.created_by := OLD.created_by;
        NEW.created_at := OLD.created_at;
        NEW.updated_at := pg_catalog.now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_procurement_forecasts_meta_stamp ON public.procurement_forecasts;
CREATE TRIGGER trg_procurement_forecasts_meta_stamp
    BEFORE INSERT OR UPDATE ON public.procurement_forecasts
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_procurement_forecasts_meta_stamp();

-- 2.3 Meta stamping for project_inventory_items
CREATE OR REPLACE FUNCTION public.fn_project_inventory_items_meta_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := pg_catalog.coalesce(NEW.created_at, pg_catalog.now());
        NEW.logged_at := pg_catalog.coalesce(NEW.logged_at, pg_catalog.now());
        NEW.updated_at := pg_catalog.now();
        IF NEW.logged_by IS NULL THEN
            NEW.logged_by := auth.uid();
        END IF;
        IF NEW.updated_by IS NULL THEN
            NEW.updated_by := auth.uid();
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.company_id := OLD.company_id;
        NEW.project_id := OLD.project_id;
        NEW.logged_by := OLD.logged_by;
        NEW.logged_at := OLD.logged_at;
        NEW.created_at := OLD.created_at;
        NEW.updated_at := pg_catalog.now();
        IF auth.uid() IS NOT NULL THEN
            NEW.updated_by := auth.uid();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_inventory_items_meta_stamp ON public.project_inventory_items;
CREATE TRIGGER trg_project_inventory_items_meta_stamp
    BEFORE INSERT OR UPDATE ON public.project_inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_project_inventory_items_meta_stamp();

-- 2.4 Automatic procurement-to-inventory synchronization trigger function
CREATE OR REPLACE FUNCTION public.fn_sync_procurement_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Only process when status is one of the eligible statuses
    IF NEW.status NOT IN ('Procured', 'Paid', 'Delivered') THEN
        RETURN NEW;
    END IF;

    -- Validate category against allowed domain values if category is supplied
    IF NEW.category IS NOT NULL AND NEW.category NOT IN ('OHS', 'Site Establishment', 'Operational Costs', 'Environmental') THEN
        RAISE EXCEPTION 'Cannot sync procurement item % to inventory: invalid category %', NEW.id, NEW.category;
    END IF;

    -- Duplicate prevention: Check if ANY inventory record exists for this procurement item (including soft-deleted)
    IF EXISTS (
        SELECT 1 FROM public.project_inventory_items 
        WHERE procurement_item_id = NEW.id
    ) THEN
        RETURN NEW;
    END IF;

    -- Resolve user identity: Prefer auth.uid(), fallback to NEW.created_by
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        v_user_id := NEW.created_by;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Cannot sync procurement item % to inventory: missing user identity (both auth.uid() and created_by are null)', NEW.id;
    END IF;

    -- Insert new inventory item (never update existing inventory rows)
    INSERT INTO public.project_inventory_items (
        company_id,
        project_id,
        procurement_item_id,
        source,
        category,
        subcategory,
        item_name,
        quantity,
        description,
        logged_by,
        logged_at,
        updated_by,
        updated_at
    )
    VALUES (
        NEW.company_id,
        NEW.project_id,
        NEW.id,
        'procurement',
        NEW.category,
        NEW.subcategory,
        NEW.item_name,
        CASE WHEN NEW.quantity IS NOT NULL AND NEW.quantity > 0 THEN NEW.quantity ELSE NULL END,
        CASE WHEN NEW.notes IS NOT NULL AND pg_catalog.length(pg_catalog.btrim(NEW.notes)) > 0 THEN pg_catalog.btrim(NEW.notes) ELSE NULL END,
        v_user_id,
        pg_catalog.now(),
        v_user_id,
        pg_catalog.now()
    )
    ON CONFLICT (procurement_item_id) WHERE procurement_item_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_procurement_to_inventory ON public.procurement_items;
CREATE TRIGGER trg_sync_procurement_to_inventory
    AFTER INSERT OR UPDATE ON public.procurement_items
    FOR EACH ROW
    WHEN (NEW.status IN ('Procured', 'Paid', 'Delivered'))
    EXECUTE FUNCTION public.fn_sync_procurement_to_inventory();

-- ============================================================================
-- SECTION 3: MUTATING SECURITY DEFINER RPCs (WITH BILLING GUARDS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_project_inventory_item(
    p_company_id UUID,
    p_project_id UUID,
    p_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_updated_rows INTEGER;
BEGIN
    -- 1. Get authenticated user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 2. Validate input parameters
    IF p_company_id IS NULL 
       OR p_project_id IS NULL 
       OR p_item_id IS NULL THEN
        RAISE EXCEPTION 
            'Company ID, Project ID, and Item ID are required.'
            USING ERRCODE = '22004';
    END IF;

    -- 3. Verify company and project membership access
    IF public.verify_membership_access(
        p_company_id,
        p_project_id
    ) IS NOT TRUE THEN
        RAISE EXCEPTION 'Access denied for specified company and project scope.';
    END IF;

    -- 4. Verify company billing access allows operational writes
    IF NOT public.company_billing_allows_operational_write(p_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- 5. Perform atomic scoped soft-delete
    UPDATE public.project_inventory_items
    SET
        deleted_at = pg_catalog.now(),
        deleted_by = v_user_id
    WHERE id = p_item_id
      AND company_id = p_company_id
      AND project_id = p_project_id
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    -- 6. Return true if exactly one row was updated
    RETURN (v_updated_rows = 1);
END;
$$;

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 PROCUREMENT ITEMS
-- ----------------------------------------------------------------------------
ALTER TABLE public.procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_procurement_items ON public.procurement_items;
DROP POLICY IF EXISTS insert_procurement_items ON public.procurement_items;
DROP POLICY IF EXISTS update_procurement_items ON public.procurement_items;
DROP POLICY IF EXISTS delete_procurement_items ON public.procurement_items;

-- SELECT: Accessible if member has access to company and project
CREATE POLICY select_procurement_items ON public.procurement_items
    FOR SELECT TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
    );

-- INSERT: Requires membership, operational write billing access, and project belonging to company
CREATE POLICY insert_procurement_items ON public.procurement_items
    FOR INSERT TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = procurement_items.project_id
              AND p.company_id = procurement_items.company_id
        )
    );

-- UPDATE: Requires membership, operational write billing access, and project belonging to company
CREATE POLICY update_procurement_items ON public.procurement_items
    FOR UPDATE TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = procurement_items.project_id
              AND p.company_id = procurement_items.company_id
        )
    );

-- DELETE: Requires membership and operational write billing access
CREATE POLICY delete_procurement_items ON public.procurement_items
    FOR DELETE TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- ----------------------------------------------------------------------------
-- 4.2 PROCUREMENT FORECASTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.procurement_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_forecasts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_procurement_forecasts ON public.procurement_forecasts;
DROP POLICY IF EXISTS insert_procurement_forecasts ON public.procurement_forecasts;
DROP POLICY IF EXISTS update_procurement_forecasts ON public.procurement_forecasts;
DROP POLICY IF EXISTS delete_procurement_forecasts ON public.procurement_forecasts;

-- SELECT: Accessible if member has access to company and project
CREATE POLICY select_procurement_forecasts ON public.procurement_forecasts
    FOR SELECT TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
    );

-- INSERT: Requires membership, operational write billing access, and project belonging to company
CREATE POLICY insert_procurement_forecasts ON public.procurement_forecasts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = procurement_forecasts.project_id
              AND p.company_id = procurement_forecasts.company_id
        )
    );

-- UPDATE: Requires membership, operational write billing access, and project belonging to company
CREATE POLICY update_procurement_forecasts ON public.procurement_forecasts
    FOR UPDATE TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = procurement_forecasts.project_id
              AND p.company_id = procurement_forecasts.company_id
        )
    );

-- DELETE: Requires membership and operational write billing access
CREATE POLICY delete_procurement_forecasts ON public.procurement_forecasts
    FOR DELETE TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- ----------------------------------------------------------------------------
-- 4.3 PROJECT INVENTORY ITEMS
-- ----------------------------------------------------------------------------
ALTER TABLE public.project_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inventory_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_project_inventory_items ON public.project_inventory_items;
DROP POLICY IF EXISTS insert_project_inventory_items ON public.project_inventory_items;
DROP POLICY IF EXISTS update_project_inventory_items ON public.project_inventory_items;
DROP POLICY IF EXISTS delete_project_inventory_items ON public.project_inventory_items;

-- SELECT: Accessible if member has access to company and project, and record is not soft-deleted
CREATE POLICY select_project_inventory_items ON public.project_inventory_items
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL
        AND public.verify_membership_access(company_id, project_id)
    );

-- INSERT: Requires membership, operational write billing access, valid company project, and matching procurement item
CREATE POLICY insert_project_inventory_items ON public.project_inventory_items
    FOR INSERT TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_inventory_items.project_id
              AND p.company_id = project_inventory_items.company_id
        )
        AND (
            procurement_item_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.procurement_items pi
                WHERE pi.id = project_inventory_items.procurement_item_id
                  AND pi.company_id = project_inventory_items.company_id
                  AND pi.project_id = project_inventory_items.project_id
            )
        )
    );

-- UPDATE: Requires membership, operational write billing access, valid company project, and matching procurement item
CREATE POLICY update_project_inventory_items ON public.project_inventory_items
    FOR UPDATE TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_inventory_items.project_id
              AND p.company_id = project_inventory_items.company_id
        )
        AND (
            procurement_item_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.procurement_items pi
                WHERE pi.id = project_inventory_items.procurement_item_id
                  AND pi.company_id = project_inventory_items.company_id
                  AND pi.project_id = project_inventory_items.project_id
            )
        )
    );

-- DELETE: Requires membership and operational write billing access
CREATE POLICY delete_project_inventory_items ON public.project_inventory_items
    FOR DELETE TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- ============================================================================
-- SECTION 5: PRIVILEGES AND GRANTS
-- ============================================================================

REVOKE ALL ON TABLE public.procurement_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.procurement_forecasts FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.project_inventory_items FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_forecasts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_inventory_items TO authenticated;

REVOKE ALL ON FUNCTION public.soft_delete_project_inventory_item(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_project_inventory_item(UUID, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_sync_procurement_to_inventory() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_sync_procurement_to_inventory() TO service_role;

REVOKE ALL ON FUNCTION public.fn_procurement_items_meta_stamp() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_procurement_forecasts_meta_stamp() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.fn_project_inventory_items_meta_stamp() FROM PUBLIC, authenticated, anon;

COMMIT;
