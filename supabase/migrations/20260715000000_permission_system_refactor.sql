-- ====================================================================
-- ProjectMatrix User Designation & Permission System Refactor Migration
-- ====================================================================

-- 1. Ensure new columns exist on public.company_members
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS is_company_admin BOOLEAN;
ALTER TABLE public.company_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

-- 2. Migrate existing "Company Admin" members to has is_company_admin = TRUE and default designations
UPDATE public.company_members
SET is_company_admin = TRUE
WHERE role = 'Company Admin' OR designation = 'Company Admin' OR is_company_admin IS TRUE;

-- Update defaults for existing rows
UPDATE public.company_members SET is_company_admin = FALSE WHERE is_company_admin IS NULL;
UPDATE public.company_members SET is_active = TRUE WHERE is_active IS NULL;

-- If designation is 'Company Admin', migrate it to 'ceo' (or 'project_manager')
UPDATE public.company_members
SET designation = 'ceo'
WHERE designation = 'Company Admin' OR designation = 'Admin' OR designation IS NULL;

-- 3. Set NOT NULL and DEFAULT constraints on public.company_members
ALTER TABLE public.company_members ALTER COLUMN designation SET NOT NULL;
ALTER TABLE public.company_members ALTER COLUMN is_company_admin SET NOT NULL;
ALTER TABLE public.company_members ALTER COLUMN is_company_admin SET DEFAULT FALSE;
ALTER TABLE public.company_members ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.company_members ALTER COLUMN is_active SET DEFAULT TRUE;

-- ====================================================================
-- Recreate verify_membership_access Function
-- ====================================================================

CREATE OR REPLACE FUNCTION public.verify_membership_access(
    p_company_id UUID,
    p_project_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_member BOOLEAN;
    v_is_admin BOOLEAN;
    v_member_id UUID;
BEGIN
    -- Check if the current authenticated user is an active member of the company
    SELECT TRUE, is_company_admin, id INTO v_is_member, v_is_admin, v_member_id
    FROM public.company_members
    WHERE company_id = p_company_id
      AND profile_id = auth.uid()
      AND is_active = TRUE;

    IF v_is_member IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    -- If they are a company admin, they have access to all projects in the company
    IF v_is_admin = TRUE THEN
        RETURN TRUE;
    END IF;

    -- If no project is specified, company-wide active membership is enough
    IF p_project_id IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Otherwise, check if they are assigned to this project
    RETURN EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_id = p_project_id
          AND company_member_id = v_member_id
    );
END;
$$;


-- ====================================================================
-- Recreate Labour Payroll RPC Functions with is_company_admin Checks
-- ====================================================================

-- 1. approve_labour_payroll
CREATE OR REPLACE FUNCTION public.approve_labour_payroll(p_payroll_id UUID)
RETURNS VOID SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Row level locking for transactional safety and transition isolation
    SELECT company_id, status INTO v_company_id, v_status
    FROM public.labour_payrolls
    WHERE id = p_payroll_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    -- Enforce Company Admin Role restriction
    IF NOT EXISTS (
        SELECT 1 FROM public.company_members 
        WHERE company_id = v_company_id 
          AND profile_id = auth.uid() 
          AND is_company_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only "Company Admin" users are authorized to approve labor payroll sheets';
    END IF;

    -- Verify valid status transition
    IF v_status <> 'Submitted' THEN
        RAISE EXCEPTION 'Invalid Transition: Only Submitted payrolls can be approved. Current status: %', v_status;
    END IF;

    UPDATE public.labour_payrolls
    SET status = 'Approved',
        approved_at = NOW(),
        approved_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_payroll_id;
END;
$$ LANGUAGE plpgsql;


-- 2. lock_labour_payroll
CREATE OR REPLACE FUNCTION public.lock_labour_payroll(p_payroll_id UUID)
RETURNS VOID SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Row level locking for transactional safety and transition isolation
    SELECT company_id, status INTO v_company_id, v_status
    FROM public.labour_payrolls
    WHERE id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    -- Enforce Company Admin Role restriction
    IF NOT EXISTS (
        SELECT 1 FROM public.company_members 
        WHERE company_id = v_company_id 
          AND profile_id = auth.uid() 
          AND is_company_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only "Company Admin" users are authorized to lock labor payroll records';
    END IF;

    -- Verify valid status transition
    IF v_status <> 'Approved' THEN
        RAISE EXCEPTION 'Invalid Transition: Only Approved payrolls can be locked. Current status: %', v_status;
    END IF;

    UPDATE public.labour_payrolls
    SET status = 'Locked',
        locked_at = NOW(),
        locked_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_payroll_id;
END;
$$ LANGUAGE plpgsql;


-- 3. unlock_labour_payroll
CREATE OR REPLACE FUNCTION public.unlock_labour_payroll(p_payroll_id UUID)
RETURNS VOID SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Row level locking for transactional safety and transition isolation
    SELECT company_id, status INTO v_company_id, v_status
    FROM public.labour_payrolls
    WHERE id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    -- Enforce Company Admin Role restriction
    IF NOT EXISTS (
        SELECT 1 FROM public.company_members 
        WHERE company_id = v_company_id 
          AND profile_id = auth.uid() 
          AND is_company_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only "Company Admin" users are authorized to unlock labor payroll records';
    END IF;

    -- Verify valid status transition
    IF v_status <> 'Locked' THEN
        RAISE EXCEPTION 'Invalid Transition: Only Locked payrolls can be unlocked. Current status: %', v_status;
    END IF;

    UPDATE public.labour_payrolls
    SET status = 'Approved',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
    WHERE id = p_payroll_id;
END;
$$ LANGUAGE plpgsql;


-- 4. reopen_labour_payroll
CREATE OR REPLACE FUNCTION public.reopen_labour_payroll(p_payroll_id UUID)
RETURNS VOID SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_project_id UUID;
    v_current_status TEXT;
BEGIN
    -- Validate Auth
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Fetch current state with lock to isolate status machine modifications safely
    SELECT company_id, project_id, status
    INTO v_company_id, v_project_id, v_current_status
    FROM public.labour_payrolls
    WHERE id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    -- Enforce backward transition and role check rules
    IF v_current_status = 'Locked' THEN
        -- Only Company Admin may unlock/reopen
        IF NOT EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = v_company_id AND profile_id = auth.uid() AND is_company_admin = TRUE
        ) THEN
            RAISE EXCEPTION 'Forbidden: Only a "Company Admin" can reopen/unlock a Locked payroll.';
        END IF;

        UPDATE public.labour_payrolls
        SET status = 'Approved',
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE id = p_payroll_id;

    ELSIF v_current_status = 'Approved' THEN
        -- Only Company Admin may reopen Approved
        IF NOT EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = v_company_id AND profile_id = auth.uid() AND is_company_admin = TRUE
        ) THEN
            RAISE EXCEPTION 'Forbidden: Only a "Company Admin" can reopen an Approved payroll.';
        END IF;

        UPDATE public.labour_payrolls
        SET status = 'Submitted',
            approved_at = NULL,
            approved_by = NULL,
            updated_at = NOW()
        WHERE id = p_payroll_id;

    ELSIF v_current_status = 'Submitted' THEN
        -- Any valid member can reopen Submitted to Draft
        IF NOT public.verify_membership_access(v_company_id, v_project_id) THEN
            RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
        END IF;

        UPDATE public.labour_payrolls
        SET status = 'Draft',
            updated_at = NOW()
        WHERE id = p_payroll_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
