-- ============================================================================
-- PROJECTMATRIX — INVENTORY FOUNDATION (project_inventory_items)
-- ADDITIVE MIGRATION FOR PROCUREMENT & INVENTORY MODULE
-- ============================================================================

-- 1. Create project_inventory_items table
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
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Company Stock specific requirements
    CONSTRAINT chk_company_stock_requirements CHECK (
        source <> 'company_stock' OR (
            category IS NOT NULL 
            AND quantity IS NOT NULL 
            AND quantity > 0 
            AND description IS NOT NULL 
            AND length(trim(description)) > 0 
            AND procurement_item_id IS NULL
        )
    )
);

-- 2. Prevent duplicate active inventory entries for the same procurement item
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_inventory_procurement_item 
    ON public.project_inventory_items (procurement_item_id) 
    WHERE procurement_item_id IS NOT NULL AND deleted_at IS NULL;

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_company_id ON public.project_inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_project_id ON public.project_inventory_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_procurement_item_id ON public.project_inventory_items(procurement_item_id) WHERE procurement_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_source ON public.project_inventory_items(source);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_category ON public.project_inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_project_inventory_items_active_scope_category
ON public.project_inventory_items (company_id, project_id, category)
WHERE deleted_at IS NULL;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.project_inventory_items ENABLE ROW LEVEL SECURITY;

-- 5. Privileges & Grants
REVOKE ALL ON public.project_inventory_items FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.project_inventory_items TO authenticated;
GRANT ALL ON public.project_inventory_items TO service_role;

-- 6. RLS Policies
DROP POLICY IF EXISTS select_project_inventory_items ON public.project_inventory_items;
DROP POLICY IF EXISTS insert_project_inventory_items ON public.project_inventory_items;
DROP POLICY IF EXISTS update_project_inventory_items ON public.project_inventory_items;
DROP POLICY IF EXISTS delete_project_inventory_items ON public.project_inventory_items;

CREATE POLICY select_project_inventory_items ON public.project_inventory_items
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL 
        AND public.verify_membership_access(company_id, project_id)
    );

CREATE POLICY insert_project_inventory_items ON public.project_inventory_items
    FOR INSERT TO authenticated
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
    );

CREATE POLICY update_project_inventory_items ON public.project_inventory_items
    FOR UPDATE TO authenticated
    USING (
        public.verify_membership_access(company_id, project_id)
    )
    WITH CHECK (
        public.verify_membership_access(company_id, project_id)
    );

-- 7. Automatic updated_at trigger using existing update_updated_at_column helper
DROP TRIGGER IF EXISTS trg_project_inventory_items_updated_at ON public.project_inventory_items;
CREATE TRIGGER trg_project_inventory_items_updated_at
    BEFORE UPDATE ON public.project_inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
