-- ============================================================================
-- PROJECTMATRIX — AUTOMATIC PROCUREMENT-TO-INVENTORY SYNCHRONISATION
-- ADDITIVE MIGRATION FOR PROCUREMENT & INVENTORY MODULE (INV-2)
-- ============================================================================

BEGIN;

-- 1. Create Trigger Function to Automatically Sync Procurement Items to Inventory
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
        CASE WHEN NEW.notes IS NOT NULL AND length(trim(NEW.notes)) > 0 THEN trim(NEW.notes) ELSE NULL END,
        v_user_id,
        now(),
        v_user_id,
        now()
    )
    ON CONFLICT (procurement_item_id) WHERE procurement_item_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;

    RETURN NEW;
END;
$$;

-- Secure trigger function execution
REVOKE ALL ON FUNCTION public.fn_sync_procurement_to_inventory() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fn_sync_procurement_to_inventory() TO service_role;

-- 2. Create Trigger on public.procurement_items
DROP TRIGGER IF EXISTS trg_sync_procurement_to_inventory ON public.procurement_items;

CREATE TRIGGER trg_sync_procurement_to_inventory
    AFTER INSERT OR UPDATE ON public.procurement_items
    FOR EACH ROW
    WHEN (NEW.status IN ('Procured', 'Paid', 'Delivered'))
    EXECUTE FUNCTION public.fn_sync_procurement_to_inventory();

-- 3. Idempotent Backfill Validation & Execution for Existing Procurement Items
DO $$
BEGIN
    -- Verify if any eligible procurement items needing backfill have NULL created_by
    IF EXISTS (
        SELECT 1 
        FROM public.procurement_items p
        WHERE p.status IN ('Procured', 'Paid', 'Delivered')
          AND p.created_by IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.project_inventory_items i
              WHERE i.procurement_item_id = p.id
          )
    ) THEN
        RAISE EXCEPTION 'Backfill aborted: One or more eligible procurement items requiring backfill have null created_by';
    END IF;

    -- Verify if any eligible procurement items needing backfill have an invalid category
    IF EXISTS (
        SELECT 1 
        FROM public.procurement_items p
        WHERE p.status IN ('Procured', 'Paid', 'Delivered')
          AND p.category IS NOT NULL
          AND p.category NOT IN ('OHS', 'Site Establishment', 'Operational Costs', 'Environmental')
          AND NOT EXISTS (
              SELECT 1 FROM public.project_inventory_items i
              WHERE i.procurement_item_id = p.id
          )
    ) THEN
        RAISE EXCEPTION 'Backfill aborted: One or more eligible procurement items requiring backfill have an invalid category';
    END IF;

    -- Verify if any eligible procurement items needing backfill have both updated_at and created_at as NULL
    IF EXISTS (
        SELECT 1 
        FROM public.procurement_items p
        WHERE p.status IN ('Procured', 'Paid', 'Delivered')
          AND p.updated_at IS NULL
          AND p.created_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.project_inventory_items i
              WHERE i.procurement_item_id = p.id
          )
    ) THEN
        RAISE EXCEPTION 'Backfill aborted: One or more eligible procurement items requiring backfill have both updated_at and created_at as null';
    END IF;

    -- Perform idempotent backfill
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
    SELECT
        p.company_id,
        p.project_id,
        p.id,
        'procurement',
        p.category,
        p.subcategory,
        p.item_name,
        CASE WHEN p.quantity IS NOT NULL AND p.quantity > 0 THEN p.quantity ELSE NULL END,
        CASE WHEN p.notes IS NOT NULL AND length(trim(p.notes)) > 0 THEN trim(p.notes) ELSE NULL END,
        p.created_by,
        COALESCE(p.updated_at, p.created_at),
        p.created_by,
        COALESCE(p.updated_at, p.created_at)
    FROM public.procurement_items p
    WHERE p.status IN ('Procured', 'Paid', 'Delivered')
      AND NOT EXISTS (
          SELECT 1 FROM public.project_inventory_items i
          WHERE i.procurement_item_id = p.id
      )
    ON CONFLICT (procurement_item_id) WHERE procurement_item_id IS NOT NULL AND deleted_at IS NULL DO NOTHING;
END $$;

COMMIT;
