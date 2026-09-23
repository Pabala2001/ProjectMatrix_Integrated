-- ============================================================================
-- PROJECTMATRIX — SOFT DELETE INVENTORY ITEM RPC FUNCTION
-- ADDITIVE MIGRATION FOR PROCUREMENT & INVENTORY MODULE (INV-5C)
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

    -- 4. Perform atomic scoped soft-delete
    UPDATE public.project_inventory_items
    SET
        deleted_at = pg_catalog.now(),
        deleted_by = v_user_id
    WHERE id = p_item_id
      AND company_id = p_company_id
      AND project_id = p_project_id
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    -- 5. Return true if exactly one row was updated
    RETURN (v_updated_rows = 1);
END;
$$;

-- Revoke default public execution privileges and grant to authenticated users only
REVOKE ALL ON FUNCTION public.soft_delete_project_inventory_item(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_project_inventory_item(UUID, UUID, UUID) TO authenticated;
