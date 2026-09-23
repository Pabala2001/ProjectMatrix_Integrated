-- STEP 3C.4F-1K: SITE AND FIELD OPERATIONS ENFORCEMENT
-- STEP 3C.4F-1H: LOGISTICS BILLING ENFORCEMENT
-- STEP 3C.4F-1F: CASHBOOK AND BANKING ENFORCEMENT
-- ====================================================================
-- Phase 2: Complete Labour Payroll Module Database Schema (Supabase)
-- ====================================================================

-- 1. Create labour_payrolls table
CREATE TABLE IF NOT EXISTS public.labour_payrolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    payroll_title TEXT NOT NULL,
    payroll_month TEXT NOT NULL,
    payroll_year TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    prepared_by TEXT NOT NULL,
    date_prepared DATE NOT NULL,
    notes TEXT,
    currency_code TEXT NOT NULL DEFAULT 'ZAR',
    currency_symbol TEXT NOT NULL DEFAULT 'R',
    currency_locale TEXT NOT NULL DEFAULT 'en-ZA',
    decimal_places INTEGER NOT NULL DEFAULT 2,
    normal_multiplier NUMERIC NOT NULL DEFAULT 1.0,
    overtime_multiplier NUMERIC NOT NULL DEFAULT 1.5,
    sunday_holiday_multiplier NUMERIC NOT NULL DEFAULT 2.0,
    uif_percentage NUMERIC NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'Draft',
    
    -- Workflow audit trails
    submitted_at TIMESTAMPTZ,
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Core Audit Timestamps
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Excel Storage integration columns
    excel_storage_path TEXT,
    excel_file_name TEXT,
    excel_file_size BIGINT,
    excel_mime_type TEXT,
    excel_uploaded_at TIMESTAMPTZ,
    excel_uploader_name TEXT,

    -- Prevent duplicate payroll periods for the same project
    CONSTRAINT unique_project_period UNIQUE (project_id, payroll_month, payroll_year),
    
    -- Status validation check constraint (Exact Case)
    CONSTRAINT valid_status CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Locked'))
);

-- Indexing for lookup performance
CREATE INDEX IF NOT EXISTS idx_labour_payrolls_company ON public.labour_payrolls(company_id);
CREATE INDEX IF NOT EXISTS idx_labour_payrolls_project ON public.labour_payrolls(project_id);
CREATE INDEX IF NOT EXISTS idx_labour_payrolls_status ON public.labour_payrolls(status);
CREATE INDEX IF NOT EXISTS idx_labour_payrolls_period ON public.labour_payrolls(payroll_year, payroll_month);

-- 2. Create labour_payroll_entries table
CREATE TABLE IF NOT EXISTS public.labour_payroll_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID NOT NULL REFERENCES public.labour_payrolls(id) ON DELETE CASCADE,
    employee_number TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    id_number TEXT,
    staff_category TEXT NOT NULL DEFAULT 'General Worker',
    contact_number TEXT,
    pay_type TEXT NOT NULL DEFAULT 'Hourly', -- 'Hourly' or 'Salaried'
    bank_name TEXT,
    account_holder TEXT,
    account_number TEXT,
    branch_code TEXT,
    account_type TEXT,
    
    -- Numeric Inputs
    normal_hourly_rate NUMERIC NOT NULL DEFAULT 0.0,
    normal_hours NUMERIC NOT NULL DEFAULT 0.0,
    base_salary NUMERIC NOT NULL DEFAULT 0.0,
    
    -- Calculated Snapshot fields (saved precisely from calculations)
    normal_wages NUMERIC NOT NULL DEFAULT 0.0,
    overtime_hourly_rate NUMERIC NOT NULL DEFAULT 0.0,
    overtime_hours NUMERIC NOT NULL DEFAULT 0.0,
    overtime_wages NUMERIC NOT NULL DEFAULT 0.0,
    sunday_holiday_hourly_rate NUMERIC NOT NULL DEFAULT 0.0,
    sunday_holiday_hours NUMERIC NOT NULL DEFAULT 0.0,
    sunday_holiday_wages NUMERIC NOT NULL DEFAULT 0.0,
    gross_wage NUMERIC NOT NULL DEFAULT 0.0,
    uif_deduction NUMERIC NOT NULL DEFAULT 0.0,
    other_deductions NUMERIC NOT NULL DEFAULT 0.0,
    net_pay NUMERIC NOT NULL DEFAULT 0.0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Pay type validation constraint (Exact case matching instructions)
    CONSTRAINT valid_pay_type CHECK (pay_type IN ('Hourly', 'Salaried'))
);

-- Indexing for lookup performance
CREATE INDEX IF NOT EXISTS idx_labour_payroll_entries_payroll ON public.labour_payroll_entries(payroll_id);
CREATE INDEX IF NOT EXISTS idx_labour_payroll_entries_emp_num ON public.labour_payroll_entries(employee_number);

-- 3. Trigger Function for updated_at Column (reused across tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach Triggers
DROP TRIGGER IF EXISTS trg_update_labour_payrolls_updated_at ON public.labour_payrolls;
CREATE TRIGGER trg_update_labour_payrolls_updated_at
    BEFORE UPDATE ON public.labour_payrolls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_labour_payroll_entries_updated_at ON public.labour_payroll_entries;
CREATE TRIGGER trg_update_labour_payroll_entries_updated_at
    BEFORE UPDATE ON public.labour_payroll_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ====================================================================
-- Row Level Security (RLS) Policies (Hardened with Billing Write Enforcement)
-- ====================================================================

ALTER TABLE public.labour_payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_payroll_entries ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to prevent naming conflicts
DROP POLICY IF EXISTS select_labour_payrolls ON public.labour_payrolls;
DROP POLICY IF EXISTS insert_labour_payrolls ON public.labour_payrolls;
DROP POLICY IF EXISTS update_labour_payrolls ON public.labour_payrolls;
DROP POLICY IF EXISTS delete_labour_payrolls ON public.labour_payrolls;
DROP POLICY IF EXISTS p_lp_select ON public.labour_payrolls;
DROP POLICY IF EXISTS p_lp_insert ON public.labour_payrolls;
DROP POLICY IF EXISTS p_lp_update ON public.labour_payrolls;
DROP POLICY IF EXISTS p_lp_delete ON public.labour_payrolls;

DROP POLICY IF EXISTS select_labour_payroll_entries ON public.labour_payroll_entries;
DROP POLICY IF EXISTS insert_labour_payroll_entries ON public.labour_payroll_entries;
DROP POLICY IF EXISTS update_labour_payroll_entries ON public.labour_payroll_entries;
DROP POLICY IF EXISTS delete_labour_payroll_entries ON public.labour_payroll_entries;
DROP POLICY IF EXISTS p_lpe_select ON public.labour_payroll_entries;
DROP POLICY IF EXISTS p_lpe_insert ON public.labour_payroll_entries;
DROP POLICY IF EXISTS p_lpe_update ON public.labour_payroll_entries;
DROP POLICY IF EXISTS p_lpe_delete ON public.labour_payroll_entries;

-- --------------------------------------------------------------------
-- public.labour_payrolls RLS Policies
-- --------------------------------------------------------------------
CREATE POLICY p_lp_select ON public.labour_payrolls
    FOR SELECT TO authenticated
    USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY p_lp_insert ON public.labour_payrolls
    FOR INSERT TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND public.verify_membership_access(company_id, project_id)
        AND status = Draft
    );

CREATE POLICY p_lp_update ON public.labour_payrolls
    FOR UPDATE TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND public.verify_membership_access(company_id, project_id)
        AND status IN (Draft, Submitted)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND public.verify_membership_access(company_id, project_id)
        AND status IN (Draft, Submitted)
    );

CREATE POLICY p_lp_delete ON public.labour_payrolls
    FOR DELETE TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND public.verify_membership_access(company_id, project_id)
        AND status = Draft
    );

-- --------------------------------------------------------------------
-- public.labour_payroll_entries RLS Policies
-- --------------------------------------------------------------------
CREATE POLICY p_lpe_select ON public.labour_payroll_entries
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.labour_payrolls lp
            WHERE lp.id = labour_payroll_entries.payroll_id
              AND public.verify_membership_access(lp.company_id, lp.project_id)
        )
    );

CREATE POLICY p_lpe_insert ON public.labour_payroll_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.labour_payrolls lp
            WHERE lp.id = labour_payroll_entries.payroll_id
              AND public.company_billing_allows_operational_write(lp.company_id)
              AND public.verify_membership_access(lp.company_id, lp.project_id)
              AND lp.status IN (Draft, Submitted)
        )
    );

CREATE POLICY p_lpe_update ON public.labour_payroll_entries
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.labour_payrolls lp
            WHERE lp.id = labour_payroll_entries.payroll_id
              AND public.company_billing_allows_operational_write(lp.company_id)
              AND public.verify_membership_access(lp.company_id, lp.project_id)
              AND lp.status IN (Draft, Submitted)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.labour_payrolls lp
            WHERE lp.id = labour_payroll_entries.payroll_id
              AND public.company_billing_allows_operational_write(lp.company_id)
              AND public.verify_membership_access(lp.company_id, lp.project_id)
              AND lp.status IN (Draft, Submitted)
        )
    );

CREATE POLICY p_lpe_delete ON public.labour_payroll_entries
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.labour_payrolls lp
            WHERE lp.id = labour_payroll_entries.payroll_id
              AND public.company_billing_allows_operational_write(lp.company_id)
              AND public.verify_membership_access(lp.company_id, lp.project_id)
              AND lp.status IN (Draft, Submitted)
        )
    );

-- ====================================================================
-- Database Grants
-- ====================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.labour_payrolls
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.labour_payroll_entries
TO authenticated;


-- ====================================================================
-- Secure RPC Functions with Search Path Hardening, Row Locking and Billing Write Enforcement
-- ====================================================================

-- 1. TRANSACTIONAL SAVE RPC (Hardened with Billing Write Guard)
CREATE OR REPLACE FUNCTION public.save_labour_payroll(
    p_payroll pg_catalog.jsonb,
    p_entries pg_catalog.jsonb
)
RETURNS pg_catalog.uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payroll_id pg_catalog.uuid;
    v_company_id pg_catalog.uuid;
    v_project_id pg_catalog.uuid;
    v_current_status pg_catalog.text;
BEGIN
    -- Validate auth.uid()
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Extract IDs and validate
    v_payroll_id := pg_catalog.coalesce((p_payroll->>'id')::pg_catalog.uuid, (p_payroll->>'payroll_id')::pg_catalog.uuid, pg_catalog.gen_random_uuid());
    v_company_id := (p_payroll->>'company_id')::pg_catalog.uuid;
    v_project_id := (p_payroll->>'project_id')::pg_catalog.uuid;

    IF v_company_id IS NULL OR v_project_id IS NULL THEN
        RAISE EXCEPTION 'Bad Request: company_id and project_id are required fields';
    END IF;

    -- Confirm project belongs to the company
    IF NOT EXISTS (
        SELECT 1 FROM public.projects 
        WHERE id = v_project_id AND company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid project: The selected project does not belong to the active company';
    END IF;

    -- Validate membership access using ProjectMatrix tenant helper
    IF NOT public.verify_membership_access(v_company_id, v_project_id) THEN
        RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
    END IF;

    -- Billing Write Enforcement Guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Lock the payroll row during updates to prevent race conditions and enforce immutability checks safely
    SELECT status INTO v_current_status
    FROM public.labour_payrolls
    WHERE id = v_payroll_id
    FOR UPDATE;

    IF v_current_status IN ('Approved', 'Locked') THEN
        RAISE EXCEPTION 'Locked: Cannot save or modify an Approved or Locked payroll ledger';
    END IF;

    -- Upsert Payroll Header
    INSERT INTO public.labour_payrolls (
        id, company_id, project_id, payroll_title, payroll_month, payroll_year,
        period_start, period_end, prepared_by, date_prepared, notes,
        currency_code, currency_symbol, currency_locale, decimal_places,
        normal_multiplier, overtime_multiplier, sunday_holiday_multiplier,
        uif_percentage, status, created_by, updated_at
    ) VALUES (
        v_payroll_id, v_company_id, v_project_id, 
        p_payroll->>'payroll_title', p_payroll->>'payroll_month', p_payroll->>'payroll_year',
        (p_payroll->>'period_start')::pg_catalog.date, (p_payroll->>'period_end')::pg_catalog.date, 
        p_payroll->>'prepared_by', (p_payroll->>'date_prepared')::pg_catalog.date, p_payroll->>'notes',
        pg_catalog.coalesce(p_payroll->>'currency_code', 'ZAR'::pg_catalog.text), 
        pg_catalog.coalesce(p_payroll->>'currency_symbol', 'R'::pg_catalog.text), 
        pg_catalog.coalesce(p_payroll->>'currency_locale', 'en-ZA'::pg_catalog.text),
        pg_catalog.coalesce((p_payroll->>'decimal_places')::pg_catalog.int4, 2),
        pg_catalog.coalesce((p_payroll->>'normal_multiplier')::pg_catalog.numeric, 1.0),
        pg_catalog.coalesce((p_payroll->>'overtime_multiplier')::pg_catalog.numeric, 1.5),
        pg_catalog.coalesce((p_payroll->>'sunday_holiday_multiplier')::pg_catalog.numeric, 2.0),
        pg_catalog.coalesce((p_payroll->>'uif_percentage')::pg_catalog.numeric, 1.0),
        pg_catalog.coalesce(p_payroll->>'status', 'Draft'::pg_catalog.text),
        auth.uid(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO UPDATE SET
        payroll_title = EXCLUDED.payroll_title,
        payroll_month = EXCLUDED.payroll_month,
        payroll_year = EXCLUDED.payroll_year,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        prepared_by = EXCLUDED.prepared_by,
        date_prepared = EXCLUDED.date_prepared,
        notes = EXCLUDED.notes,
        currency_code = EXCLUDED.currency_code,
        currency_symbol = EXCLUDED.currency_symbol,
        currency_locale = EXCLUDED.currency_locale,
        decimal_places = EXCLUDED.decimal_places,
        normal_multiplier = EXCLUDED.normal_multiplier,
        overtime_multiplier = EXCLUDED.overtime_multiplier,
        sunday_holiday_multiplier = EXCLUDED.sunday_holiday_multiplier,
        uif_percentage = EXCLUDED.uif_percentage,
        updated_at = pg_catalog.now();

    -- Delete old entries to replace entirely
    DELETE FROM public.labour_payroll_entries WHERE payroll_id = v_payroll_id;

    -- Upsert and calculate Entry Snapshots
    IF p_entries IS NOT NULL AND pg_catalog.jsonb_typeof(p_entries) = 'array'::pg_catalog.text AND pg_catalog.jsonb_array_length(p_entries) > 0 THEN
        INSERT INTO public.labour_payroll_entries (
            payroll_id, employee_number, first_name, last_name, id_number,
            staff_category, contact_number, pay_type, bank_name, account_holder,
            account_number, branch_code, account_type,
            normal_hourly_rate, normal_hours, base_salary, normal_wages,
            overtime_hourly_rate, overtime_hours, overtime_wages,
            sunday_holiday_hourly_rate, sunday_holiday_hours, sunday_holiday_wages,
            gross_wage, uif_deduction, other_deductions, net_pay
        )
        SELECT
            v_payroll_id,
            pg_catalog.coalesce(elem->>'employee_number', elem->>'employeeNumber')::pg_catalog.text,
            pg_catalog.coalesce(elem->>'first_name', elem->>'firstName')::pg_catalog.text,
            pg_catalog.coalesce(elem->>'last_name', elem->>'lastName')::pg_catalog.text,
            pg_catalog.coalesce(elem->>'id_number', elem->>'idNumber')::pg_catalog.text,
            pg_catalog.coalesce(elem->>'staff_category', elem->>'jobTitle', elem->>'staffCategory', 'General Worker'::pg_catalog.text)::pg_catalog.text,
            pg_catalog.coalesce(elem->>'contact_number', elem->>'contactNumber')::pg_catalog.text,
            pg_catalog.initcap(pg_catalog.coalesce(elem->>'pay_type', elem->>'payType', 'Hourly'::pg_catalog.text))::pg_catalog.text,
            pg_catalog.coalesce(elem->>'bank_name', elem->>'bankName')::pg_catalog.text,
            pg_catalog.coalesce(elem->>'account_holder', elem->>'accountHolder')::pg_catalog.text,
            pg_catalog.coalesce(elem->>'account_number', elem->>'accountNumber')::pg_catalog.text,
            pg_catalog.coalesce(elem->>'branch_code', elem->>'branchCode')::pg_catalog.text,
            pg_catalog.coalesce(elem->>'account_type', elem->>'accountType')::pg_catalog.text,
            pg_catalog.coalesce((elem->>'normal_hourly_rate')::pg_catalog.numeric, (elem->>'normalHourlyRate')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'normal_hours')::pg_catalog.numeric, (elem->>'normalHours')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'base_salary')::pg_catalog.numeric, (elem->>'baseSalary')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'normal_wages')::pg_catalog.numeric, (elem->>'normalWages')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'overtime_hourly_rate')::pg_catalog.numeric, (elem->>'overtimeHourlyRate')::pg_catalog.numeric, (elem->>'overtimeRate')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'overtime_hours')::pg_catalog.numeric, (elem->>'overtimeHours')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'overtime_wages')::pg_catalog.numeric, (elem->>'overtimeWages')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'sunday_holiday_hourly_rate')::pg_catalog.numeric, (elem->>'sundayHolidayHourlyRate')::pg_catalog.numeric, (elem->>'sundayHolidayRate')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'sunday_holiday_hours')::pg_catalog.numeric, (elem->>'sundayHolidayHours')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'sunday_holiday_wages')::pg_catalog.numeric, (elem->>'sundayHolidayWages')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'gross_wage')::pg_catalog.numeric, (elem->>'grossWage')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'uif_deduction')::pg_catalog.numeric, (elem->>'uifDeduction')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'other_deductions')::pg_catalog.numeric, (elem->>'otherDeductions')::pg_catalog.numeric, 0.0),
            pg_catalog.coalesce((elem->>'net_pay')::pg_catalog.numeric, (elem->>'netPay')::pg_catalog.numeric, 0.0)
        FROM pg_catalog.jsonb_array_elements(p_entries) AS elem;
    END IF;

    RETURN v_payroll_id;
END;
$$;
$;

-- 2. REGISTER RETRIEVAL RPC (Hardened)
CREATE OR REPLACE FUNCTION public.get_payroll_register(p_project_id UUID)
RETURNS TABLE (
    payroll_id UUID,
    payroll_title TEXT,
    month TEXT,
    year TEXT,
    period_start DATE,
    period_end DATE,
    status TEXT,
    currency_code TEXT,
    currency_symbol TEXT,
    decimal_places INTEGER,
    currency_locale TEXT,
    staff_count BIGINT,
    gross_payroll NUMERIC,
    net_payroll NUMERIC,
    uif_total NUMERIC,
    other_deductions_total NUMERIC,
    prepared_by TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ,
    excel_storage_path TEXT,
    excel_file_name TEXT,
    excel_file_size BIGINT,
    excel_mime_type TEXT,
    excel_uploaded_at TIMESTAMPTZ,
    excel_uploader_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Validate auth.uid()
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Ensure columns exist (robust migration)
    BEGIN
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_storage_path TEXT;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_file_name TEXT;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_file_size BIGINT;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_mime_type TEXT;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_uploaded_at TIMESTAMPTZ;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_uploader_name TEXT;
    EXCEPTION WHEN duplicate_column THEN
        -- Column already exists, safe to ignore
    END;

    -- Retrieve company_id for the project
    SELECT company_id INTO v_company_id FROM public.projects WHERE id = p_project_id;
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Project not found';
    END IF;

    -- Validate membership
    IF NOT public.verify_membership_access(v_company_id, p_project_id) THEN
        RAISE EXCEPTION 'Forbidden: You do not have membership access to this project';
    END IF;

    RETURN QUERY
    SELECT 
        lp.id AS payroll_id,
        lp.payroll_title,
        lp.payroll_month AS month,
        lp.payroll_year AS year,
        lp.period_start,
        lp.period_end,
        lp.status,
        lp.currency_code,
        lp.currency_symbol,
        lp.decimal_places,
        lp.currency_locale,
        COUNT(lpe.id) AS staff_count,
        COALESCE(SUM(lpe.gross_wage), 0.0) AS gross_payroll,
        COALESCE(SUM(lpe.net_pay), 0.0) AS net_payroll,
        COALESCE(SUM(lpe.uif_deduction), 0.0) AS uif_total,
        COALESCE(SUM(lpe.other_deductions), 0.0) AS other_deductions_total,
        lp.prepared_by,
        lp.created_by,
        lp.created_at,
        lp.excel_storage_path,
        lp.excel_file_name,
        lp.excel_file_size,
        lp.excel_mime_type,
        lp.excel_uploaded_at,
        lp.excel_uploader_name
    FROM public.labour_payrolls lp
    LEFT JOIN public.labour_payroll_entries lpe ON lp.id = lpe.payroll_id
    WHERE lp.project_id = p_project_id
    GROUP BY lp.id;
END;
$$;

-- 3. SUBMIT RPC (Draft -> Submitted) (Hardened with Billing Write Guard)
CREATE OR REPLACE FUNCTION public.submit_labour_payroll(p_payroll_id pg_catalog.uuid)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_company_id pg_catalog.uuid;
    v_project_id pg_catalog.uuid;
    v_status pg_catalog.text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Row level locking for transactional safety and transition isolation
    SELECT company_id, project_id, status INTO v_company_id, v_project_id, v_status
    FROM public.labour_payrolls
    WHERE id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    -- Enforce membership verification
    IF NOT public.verify_membership_access(v_company_id, v_project_id) THEN
        RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
    END IF;

    -- Billing Write Enforcement Guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Verify valid status transition
    IF v_status <> 'Draft' THEN
        RAISE EXCEPTION 'Invalid Transition: Only Draft payrolls can be submitted. Current status: %', v_status;
    END IF;

    UPDATE public.labour_payrolls
    SET status = 'Submitted',
        submitted_at = pg_catalog.now(),
        submitted_by = auth.uid(),
        updated_at = pg_catalog.now()
    WHERE id = p_payroll_id;
END;
$$;
$;

-- 4. APPROVE RPC (Submitted -> Approved) (Hardened with Billing Write Guard)
CREATE OR REPLACE FUNCTION public.approve_labour_payroll(p_payroll_id pg_catalog.uuid)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_company_id pg_catalog.uuid;
    v_status pg_catalog.text;
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
        RAISE EXCEPTION 'Forbidden: Only "Company Admin" users are authorized to approve labor payroll sheets';
    END IF;

    -- Billing Write Enforcement Guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Verify valid status transition
    IF v_status <> 'Submitted' THEN
        RAISE EXCEPTION 'Invalid Transition: Only Submitted payrolls can be approved. Current status: %', v_status;
    END IF;

    UPDATE public.labour_payrolls
    SET status = 'Approved',
        approved_at = pg_catalog.now(),
        approved_by = auth.uid(),
        updated_at = pg_catalog.now()
    WHERE id = p_payroll_id;
END;
$$;
$;

-- 5. LOCK RPC (Approved -> Locked) (Hardened with Billing Write Guard)
CREATE OR REPLACE FUNCTION public.lock_labour_payroll(p_payroll_id pg_catalog.uuid)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_company_id pg_catalog.uuid;
    v_status pg_catalog.text;
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

    -- Billing Write Enforcement Guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Verify valid status transition
    IF v_status <> 'Approved' THEN
        RAISE EXCEPTION 'Invalid Transition: Only Approved payrolls can be locked. Current status: %', v_status;
    END IF;

    UPDATE public.labour_payrolls
    SET status = 'Locked',
        locked_at = pg_catalog.now(),
        locked_by = auth.uid(),
        updated_at = pg_catalog.now()
    WHERE id = p_payroll_id;
END;
$$;
$;

-- 6. UNLOCK RPC (Locked -> Approved) (Hardened with Billing Write Guard)
CREATE OR REPLACE FUNCTION public.unlock_labour_payroll(p_payroll_id pg_catalog.uuid)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_company_id pg_catalog.uuid;
    v_status pg_catalog.text;
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

    -- Billing Write Enforcement Guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Verify valid status transition
    IF v_status <> 'Locked' THEN
        RAISE EXCEPTION 'Invalid Transition: Only Locked payrolls can be unlocked. Current status: %', v_status;
    END IF;

    UPDATE public.labour_payrolls
    SET status = 'Approved',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = pg_catalog.now()
    WHERE id = p_payroll_id;
END;
$$;
$;

-- 7. REOPEN RPC (Backward Transitions) (Hardened with Billing Write Guard)
CREATE OR REPLACE FUNCTION public.reopen_labour_payroll(p_payroll_id pg_catalog.uuid)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_company_id pg_catalog.uuid;
    v_project_id pg_catalog.uuid;
    v_current_status pg_catalog.text;
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

    -- Billing Write Enforcement Guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
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
            updated_at = pg_catalog.now()
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
            updated_at = pg_catalog.now()
        WHERE id = p_payroll_id;

    ELSIF v_current_status = 'Submitted' THEN
        -- Any valid member can reopen Submitted to Draft
        IF NOT public.verify_membership_access(v_company_id, v_project_id) THEN
            RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
        END IF;

        UPDATE public.labour_payrolls
        SET status = 'Draft',
            submitted_at = NULL,
            submitted_by = NULL,
            updated_at = pg_catalog.now()
        WHERE id = p_payroll_id;
    ELSE
        RAISE EXCEPTION 'Invalid Transition: Current payroll is already in Draft status.';
    END IF;
END;
$$;
$;

-- 8. DUPLICATE PAYROLL RPC (Hardened with Billing Write Guard)
CREATE OR REPLACE FUNCTION public.duplicate_labour_payroll(p_payroll_id pg_catalog.uuid)
RETURNS pg_catalog.uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_payroll_id pg_catalog.uuid;
    v_company_id pg_catalog.uuid;
    v_project_id pg_catalog.uuid;
    v_payroll_month pg_catalog.text;
    v_payroll_year pg_catalog.text;
    v_suffix pg_catalog.text;
BEGIN
    -- Validate Auth
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Fetch original details with lock to guarantee safe clone source reads
    SELECT company_id, project_id, payroll_month, payroll_year 
    INTO v_company_id, v_project_id, v_payroll_month, v_payroll_year
    FROM public.labour_payrolls
    WHERE id = p_payroll_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original payroll record not found';
    END IF;

    -- Validate membership
    IF NOT public.verify_membership_access(v_company_id, v_project_id) THEN
        RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
    END IF;

    -- Billing Write Enforcement Guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    v_new_payroll_id := pg_catalog.gen_random_uuid();
    v_suffix := ' (Copy ' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::pg_catalog.text), 1, 4) || ')';

    -- Insert duplicated header in 'Draft' state
    INSERT INTO public.labour_payrolls (
        id, company_id, project_id, payroll_title, payroll_month, payroll_year,
        period_start, period_end, prepared_by, date_prepared, notes,
        currency_code, currency_symbol, currency_locale, decimal_places,
        normal_multiplier, overtime_multiplier, sunday_holiday_multiplier,
        uif_percentage, status, created_by, created_at, updated_at
    )
    SELECT
        v_new_payroll_id, company_id, project_id, 
        pg_catalog.substr(payroll_title || ' (Copy)'::pg_catalog.text, 1, 200),
        pg_catalog.substr(payroll_month || v_suffix, 1, 50),
        payroll_year,
        period_start, period_end, prepared_by, CURRENT_DATE, 
        pg_catalog.coalesce(notes || ' (Duplicated from original)'::pg_catalog.text, 'Duplicated payroll ledger'::pg_catalog.text),
        currency_code, currency_symbol, currency_locale, decimal_places,
        normal_multiplier, overtime_multiplier, sunday_holiday_multiplier,
        uif_percentage, 'Draft'::pg_catalog.text, auth.uid(), pg_catalog.now(), pg_catalog.now()
    FROM public.labour_payrolls
    WHERE id = p_payroll_id;

    -- Duplicate all nested entries
    INSERT INTO public.labour_payroll_entries (
        payroll_id, employee_number, first_name, last_name, id_number,
        staff_category, contact_number, pay_type, bank_name, account_holder,
        account_number, branch_code, account_type,
        normal_hourly_rate, normal_hours, base_salary, normal_wages,
        overtime_hourly_rate, overtime_hours, overtime_wages,
        sunday_holiday_hourly_rate, sunday_holiday_hours, sunday_holiday_wages,
        gross_wage, uif_deduction, other_deductions, net_pay,
        created_at, updated_at
    )
    SELECT
        v_new_payroll_id, employee_number, first_name, last_name, id_number,
        staff_category, contact_number, pay_type, bank_name, account_holder,
        account_number, branch_code, account_type,
        normal_hourly_rate, normal_hours, base_salary, normal_wages,
        overtime_hourly_rate, overtime_hours, overtime_wages,
        sunday_holiday_hourly_rate, sunday_holiday_hours, sunday_holiday_wages,
        gross_wage, uif_deduction, other_deductions, net_pay,
        pg_catalog.now(), pg_catalog.now()
    FROM public.labour_payroll_entries
    WHERE payroll_id = p_payroll_id;

    RETURN v_new_payroll_id;
END;
$$;
$;

-- 10. REGISTER LABOUR PAYROLL EXCEL FILE METADATA (Hardened with Billing Write Guard)
CREATE OR REPLACE FUNCTION public.register_labour_payroll_excel(
    p_payroll_id pg_catalog.uuid,
    p_storage_path pg_catalog.text,
    p_file_name pg_catalog.text,
    p_file_size pg_catalog.int8,
    p_mime_type pg_catalog.text
)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_name pg_catalog.text;
    v_company_id pg_catalog.uuid;
    v_project_id pg_catalog.uuid;
BEGIN
    -- Validate auth.uid()
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    -- Fetch company ownership and project with lock
    SELECT company_id, project_id INTO v_company_id, v_project_id
    FROM public.labour_payrolls
    WHERE id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    -- Validate membership access
    IF NOT public.verify_membership_access(v_company_id, v_project_id) THEN
        RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
    END IF;

    -- Billing Write Enforcement Guard
    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Fetch active user name
    SELECT pg_catalog.coalesce(full_name, email) INTO v_user_name 
    FROM public.profiles 
    WHERE id = auth.uid();

    -- Ensure columns exist (robust migration)
    BEGIN
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_storage_path TEXT;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_file_name TEXT;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_file_size BIGINT;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_mime_type TEXT;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_uploaded_at TIMESTAMPTZ;
        ALTER TABLE public.labour_payrolls ADD COLUMN IF NOT EXISTS excel_uploader_name TEXT;
    EXCEPTION WHEN duplicate_column THEN
        -- Column already exists, safe to ignore
    END;

    -- Update the payroll record
    UPDATE public.labour_payrolls
    SET 
        excel_storage_path = p_storage_path,
        excel_file_name = p_file_name,
        excel_file_size = p_file_size,
        excel_mime_type = p_mime_type,
        excel_uploaded_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now()),
        excel_uploader_name = pg_catalog.coalesce(v_user_name, 'Unknown'::pg_catalog.text)
    WHERE id = p_payroll_id;
END;
$$;
$;

-- Permissions and grants for Labour Payroll RPCs
REVOKE ALL ON FUNCTION public.save_labour_payroll(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_labour_payroll(JSONB, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_labour_payroll(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_labour_payroll(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_labour_payroll(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_labour_payroll(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.lock_labour_payroll(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_labour_payroll(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.unlock_labour_payroll(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_labour_payroll(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.reopen_labour_payroll(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_labour_payroll(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.duplicate_labour_payroll(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_labour_payroll(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.register_labour_payroll_excel(UUID, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_labour_payroll_excel(UUID, TEXT, TEXT, BIGINT, TEXT) TO authenticated;

-- ====================================================================
-- Secure Company Member Password Reset Helpers
-- ====================================================================

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS VOID SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"must_change_password": false}'::jsonb
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql;


-- ====================================================================
-- Foundational Schema: Project Members
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.project_members (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    company_member_id uuid NOT NULL,
    project_role text NULL,
    designation text NULL,
    permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
    assigned_by uuid NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT project_members_pkey PRIMARY KEY (id),
    CONSTRAINT project_members_project_id_company_member_id_key UNIQUE (project_id, company_member_id),
    CONSTRAINT project_members_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT project_members_company_member_id_fkey FOREIGN KEY (company_member_id) REFERENCES public.company_members(id) ON DELETE CASCADE,
    CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- Secure verify_membership_access RPC Function
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
-- Secure verify_billing_access RPC Function
-- ====================================================================

CREATE OR REPLACE FUNCTION public.verify_billing_access(
    p_company_id pg_catalog.uuid
)
RETURNS pg_catalog.bool
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $verify_billing_access$
    SELECT (
        auth.uid() IS NOT NULL
        AND p_company_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.company_members AS cm
            WHERE cm.company_id = p_company_id
              AND cm.profile_id = auth.uid()
              AND cm.is_active IS TRUE
              AND (
                -- 1. Evaluate designation
                (
                    pg_catalog.regexp_replace(
                        pg_catalog.lower(
                            pg_catalog.btrim(
                                COALESCE(cm.designation, ''::pg_catalog.text)
                            )
                        ),
                        '[\s\-_]+'::pg_catalog.text,
                        '_'::pg_catalog.text,
                        'g'::pg_catalog.text
                    ) IN (
                        'ceo',
                        'coo',
                        'cfo',
                        'director',
                        'project_manager',
                        'company_administrator',
                        'company_admin'
                    )
                )
                OR
                -- 2. Evaluate legacy role independently
                (
                    pg_catalog.regexp_replace(
                        pg_catalog.lower(
                            pg_catalog.btrim(
                                COALESCE(cm.role, ''::pg_catalog.text)
                            )
                        ),
                        '[\s\-_]+'::pg_catalog.text,
                        '_'::pg_catalog.text,
                        'g'::pg_catalog.text
                    ) IN (
                        'ceo',
                        'coo',
                        'cfo',
                        'director',
                        'project_manager',
                        'company_administrator',
                        'company_admin'
                    )
                )
              )
        )
    );
$verify_billing_access$;

REVOKE ALL ON FUNCTION public.verify_billing_access(pg_catalog.uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_billing_access(pg_catalog.uuid) TO authenticated;



-- ====================================================================
-- Billing Plans Table
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.billing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    billing_interval TEXT NOT NULL,
    trial_duration_minutes INTEGER NOT NULL DEFAULT 0,
    cancel_anytime BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    paystack_plan_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraints
    CONSTRAINT uq_billing_plans_code UNIQUE (code),
    CONSTRAINT chk_billing_plans_code_non_empty CHECK (char_length(btrim(code)) > 0),
    CONSTRAINT chk_billing_plans_name_non_empty CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT chk_billing_plans_amount_minor_positive CHECK (amount_minor > 0),
    CONSTRAINT chk_billing_plans_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_billing_plans_billing_interval CHECK (billing_interval IN ('monthly')),
    CONSTRAINT chk_billing_plans_trial_duration_minutes_non_negative CHECK (trial_duration_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_code ON public.billing_plans (code);
CREATE INDEX IF NOT EXISTS idx_billing_plans_is_active ON public.billing_plans (is_active);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read active billing plans"
    ON public.billing_plans
    FOR SELECT
    TO authenticated
    USING (is_active IS TRUE);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.billing_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.billing_plans TO authenticated;

INSERT INTO public.billing_plans (
    code,
    name,
    amount_minor,
    currency,
    billing_interval,
    trial_duration_minutes,
    cancel_anytime,
    is_active,
    paystack_plan_code
) VALUES (
    'business-monthly',
    'Business Subscription Plan',
    500000,
    'ZAR',
    'monthly',
    5,
    true,
    true,
    NULL
)
ON CONFLICT (code) DO NOTHING;


-- ====================================================================
-- Billing Subscriptions Table
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    plan_id UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE RESTRICT,
    subscription_reference TEXT NOT NULL,
    status TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    billing_interval TEXT NOT NULL,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    next_renewal_at TIMESTAMPTZ,
    auto_renew_enabled BOOLEAN NOT NULL DEFAULT false,
    notice_message TEXT,
    cancelled_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    past_due_since TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Integrity Constraints
    CONSTRAINT uq_billing_subscriptions_reference UNIQUE (subscription_reference),
    CONSTRAINT uq_billing_subscriptions_company_scope UNIQUE (id, company_id),
    CONSTRAINT chk_billing_subscriptions_ref_non_empty CHECK (char_length(btrim(subscription_reference)) > 0),
    CONSTRAINT chk_billing_subscriptions_status CHECK (
        status IN (
            'pending_activation',
            'trialing',
            'active',
            'non_renewing',
            'past_due',
            'expired',
            'cancelled'
        )
    ),
    CONSTRAINT chk_billing_subscriptions_past_due_since CHECK (
        past_due_since IS NULL OR status = 'past_due'
    ),
    CONSTRAINT chk_billing_subscriptions_amount_minor_positive CHECK (amount_minor > 0),
    CONSTRAINT chk_billing_subscriptions_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_billing_subscriptions_billing_interval CHECK (billing_interval IN ('monthly')),
    CONSTRAINT chk_billing_subscriptions_trial_dates CHECK (
        trial_ends_at IS NULL 
        OR trial_started_at IS NULL 
        OR trial_ends_at >= trial_started_at
    ),
    CONSTRAINT chk_billing_subscriptions_period_dates CHECK (
        current_period_end IS NULL 
        OR current_period_start IS NULL 
        OR current_period_end >= current_period_start
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_subscriptions_active_company
    ON public.billing_subscriptions (company_id)
    WHERE status IN ('pending_activation', 'trialing', 'active', 'non_renewing', 'past_due');

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_company_id ON public.billing_subscriptions (company_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_plan_id ON public.billing_subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON public.billing_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_reference ON public.billing_subscriptions (subscription_reference);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_past_due_since ON public.billing_subscriptions (past_due_since) WHERE status = 'past_due';

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members with billing access to view company subscription"
    ON public.billing_subscriptions
    FOR SELECT
    TO authenticated
    USING (public.verify_billing_access(company_id) IS TRUE);

REVOKE ALL ON public.billing_subscriptions FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.billing_subscriptions FROM authenticated;
GRANT SELECT ON public.billing_subscriptions TO authenticated;


-- ====================================================================
-- Billing Ledger Events Table (Immutable)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.billing_ledger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_number BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL,
    event_source TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    deduplication_key TEXT,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Constraints
    CONSTRAINT uq_billing_ledger_events_seq UNIQUE (sequence_number),
    CONSTRAINT chk_billing_ledger_events_event_type_non_empty CHECK (char_length(btrim(event_type)) > 0),
    CONSTRAINT chk_billing_ledger_events_event_source CHECK (
        event_source IN ('user', 'system', 'paystack_webhook', 'reconciliation')
    ),
    CONSTRAINT chk_billing_ledger_events_data_is_object CHECK (jsonb_typeof(event_data) = 'object'),
    CONSTRAINT chk_billing_ledger_events_dedup_non_empty CHECK (
        deduplication_key IS NULL OR char_length(btrim(deduplication_key)) > 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_ledger_events_dedup_key
    ON public.billing_ledger_events (deduplication_key)
    WHERE deduplication_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_ledger_company_recorded
    ON public.billing_ledger_events (company_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_ledger_sub_recorded
    ON public.billing_ledger_events (subscription_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_ledger_event_type
    ON public.billing_ledger_events (event_type);

-- Immutability Triggers
CREATE OR REPLACE FUNCTION public.prevent_billing_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'billing_ledger_events rows are immutable and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_ledger_events_immutable ON public.billing_ledger_events;
CREATE TRIGGER trg_billing_ledger_events_immutable
    BEFORE UPDATE OR DELETE ON public.billing_ledger_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_billing_ledger_mutation();

CREATE OR REPLACE FUNCTION public.prevent_billing_ledger_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'billing_ledger_events table is append-only and cannot be truncated.';
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_ledger_events_prevent_truncate ON public.billing_ledger_events;
CREATE TRIGGER trg_billing_ledger_events_prevent_truncate
    BEFORE TRUNCATE ON public.billing_ledger_events
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_billing_ledger_truncate();

-- RLS and Privileges
ALTER TABLE public.billing_ledger_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members with billing access to view billing ledger events"
    ON public.billing_ledger_events
    FOR SELECT
    TO authenticated
    USING (public.verify_billing_access(company_id) IS TRUE);

REVOKE ALL ON public.billing_ledger_events FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.billing_ledger_events FROM authenticated;
GRANT SELECT ON public.billing_ledger_events TO authenticated;


-- ====================================================================
-- Atomic Trial-Start Database Function
-- ====================================================================

CREATE OR REPLACE FUNCTION public.start_billing_trial(
    p_company_id pg_catalog.uuid,
    p_plan_code pg_catalog.text DEFAULT 'business-monthly'::pg_catalog.text
)
RETURNS public.billing_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $start_billing_trial$
DECLARE
    v_caller_id pg_catalog.uuid;
    v_plan public.billing_plans%ROWTYPE;
    v_existing_sub public.billing_subscriptions%ROWTYPE;
    v_has_historical_trial pg_catalog.bool;
    v_now pg_catalog.timestamptz;
    v_trial_ends pg_catalog.timestamptz;
    v_sub_ref pg_catalog.text;
    v_new_sub public.billing_subscriptions%ROWTYPE;
BEGIN
    -- Require an authenticated caller.
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to start a billing trial.'
            USING ERRCODE = '28000';
    END IF;

    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'Company ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- Authorize against the active-company Billing roles.
    IF public.verify_billing_access(p_company_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Access denied. You do not have permission to manage billing for this company.'
            USING ERRCODE = '42501';
    END IF;

    -- Serialize concurrent requests for the same company and verify existence.
    PERFORM 1
    FROM public.companies
    WHERE id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Company with ID % not found.', p_company_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Return an existing current subscription without resetting its dates or
    -- appending a duplicate ledger event.
    SELECT *
    INTO v_existing_sub
    FROM public.billing_subscriptions
    WHERE company_id = p_company_id
      AND status IN (
          'pending_activation',
          'trialing',
          'active',
          'non_renewing',
          'past_due'
      )
    LIMIT 1;

    IF FOUND THEN
        RETURN v_existing_sub;
    END IF;

    -- Prevent a second free trial after cancellation or expiry.
    SELECT (
        EXISTS (
            SELECT 1
            FROM public.billing_ledger_events
            WHERE company_id = p_company_id
              AND event_type = 'trial_started'
        )
        OR EXISTS (
            SELECT 1
            FROM public.billing_subscriptions
            WHERE company_id = p_company_id
              AND trial_started_at IS NOT NULL
        )
    )
    INTO v_has_historical_trial;

    IF v_has_historical_trial IS TRUE THEN
        RAISE EXCEPTION 'A free trial has already been used for this company.'
            USING ERRCODE = '23505';
    END IF;

    -- Resolve the active server-controlled Billing plan.
    SELECT *
    INTO v_plan
    FROM public.billing_plans
    WHERE code = COALESCE(
        p_plan_code,
        'business-monthly'::pg_catalog.text
    );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Billing plan "%" not found.', p_plan_code
            USING ERRCODE = 'P0002';
    END IF;

    IF v_plan.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Billing plan "%" is currently inactive.', p_plan_code
            USING ERRCODE = '22023';
    END IF;

    -- Snapshot timestamps and calculate the configured minute-based trial.
    v_now := pg_catalog.now();
    v_trial_ends := v_now
        + pg_catalog.make_interval(
            mins => v_plan.trial_duration_minutes
        );

    v_sub_ref :=
        'SUB-'::pg_catalog.text
        || pg_catalog.to_char(v_now, 'YYYYMMDD'::pg_catalog.text)
        || '-'::pg_catalog.text
        || pg_catalog.upper(
            pg_catalog.substring(
                pg_catalog.replace(
                    pg_catalog.gen_random_uuid()::pg_catalog.text,
                    '-'::pg_catalog.text,
                    ''::pg_catalog.text
                ),
                1,
                8
            )
        );

    -- Insert the subscription using the server-controlled plan snapshot.
    INSERT INTO public.billing_subscriptions (
        company_id,
        plan_id,
        subscription_reference,
        status,
        amount_minor,
        currency,
        billing_interval,
        trial_started_at,
        trial_ends_at,
        current_period_start,
        current_period_end,
        next_renewal_at,
        auto_renew_enabled,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        p_company_id,
        v_plan.id,
        v_sub_ref,
        'trialing',
        v_plan.amount_minor,
        v_plan.currency,
        v_plan.billing_interval,
        v_now,
        v_trial_ends,
        v_now,
        v_trial_ends,
        v_trial_ends,
        false,
        v_caller_id,
        v_now,
        v_now
    )
    RETURNING * INTO v_new_sub;

    -- Append the immutable trial-start event in the same transaction.
    INSERT INTO public.billing_ledger_events (
        company_id,
        subscription_id,
        event_type,
        event_source,
        occurred_at,
        recorded_at,
        actor_profile_id,
        deduplication_key,
        event_data
    ) VALUES (
        p_company_id,
        v_new_sub.id,
        'trial_started',
        'user',
        v_now,
        v_now,
        v_caller_id,
        'trial_started:'::pg_catalog.text || p_company_id::pg_catalog.text,
        pg_catalog.jsonb_build_object(
            'plan_code', v_plan.code,
            'amount_minor', v_plan.amount_minor,
            'currency', v_plan.currency,
            'trial_duration_minutes', v_plan.trial_duration_minutes,
            'trial_started_at', v_now,
            'trial_ends_at', v_trial_ends
        )
    );

    RETURN v_new_sub;
END;
$start_billing_trial$;

-- Preserve the existing RPC privilege boundary.
REVOKE ALL ON FUNCTION public.start_billing_trial(
    pg_catalog.uuid,
    pg_catalog.text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_billing_trial(
    pg_catalog.uuid,
    pg_catalog.text
) TO authenticated;


-- ============================================================================
-- ProjectMatrix Billing Phase 3A.1
-- Paystack payment foundation: plans, payments, webhooks and subscriptions
-- Raw card data is never stored. Verified webhook JSON is server-only.
-- ============================================================================

-- Required for the company/plan-safe composite payment foreign key.
ALTER TABLE public.billing_subscriptions
    ADD CONSTRAINT uq_billing_subscriptions_payment_scope
    UNIQUE (id, company_id, plan_id);


-- ============================================================================
-- 1. Provider plan mappings
-- ============================================================================

CREATE TABLE public.billing_provider_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    plan_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    provider_plan_code TEXT NOT NULL,
    provider_plan_id TEXT,

    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    billing_interval TEXT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    CONSTRAINT fk_billing_provider_plans_plan
        FOREIGN KEY (plan_id)
        REFERENCES public.billing_plans(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_billing_provider_plans_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_billing_provider_plans_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_billing_provider_plans_code_non_empty
        CHECK (pg_catalog.char_length(pg_catalog.btrim(provider_plan_code)) > 0),

    CONSTRAINT chk_billing_provider_plans_id_non_empty
        CHECK (
            provider_plan_id IS NULL
            OR pg_catalog.char_length(pg_catalog.btrim(provider_plan_id)) > 0
        ),

    CONSTRAINT chk_billing_provider_plans_amount_positive
        CHECK (amount_minor > 0),

    CONSTRAINT chk_billing_provider_plans_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_billing_provider_plans_interval
        CHECK (billing_interval = 'monthly'),

    CONSTRAINT uq_billing_provider_plans_provider_code
        UNIQUE (provider, environment, provider_plan_code),

    -- Supports the composite payment foreign key.
    CONSTRAINT uq_billing_provider_plans_payment_scope
        UNIQUE (id, plan_id, provider, environment)
);

CREATE UNIQUE INDEX uq_billing_provider_plans_provider_id
    ON public.billing_provider_plans (
        provider,
        environment,
        provider_plan_id
    )
    WHERE provider_plan_id IS NOT NULL;

CREATE UNIQUE INDEX uq_billing_provider_plans_active
    ON public.billing_provider_plans (
        plan_id,
        provider,
        environment
    )
    WHERE is_active IS TRUE;

CREATE INDEX idx_billing_provider_plans_plan
    ON public.billing_provider_plans (plan_id);

CREATE INDEX idx_billing_provider_plans_environment_active
    ON public.billing_provider_plans (environment, is_active);


-- ============================================================================
-- 2. Payment attempts
-- ============================================================================

CREATE TABLE public.billing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    provider_plan_mapping_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,
    purpose TEXT NOT NULL,

    idempotency_key UUID NOT NULL,
    provider_reference TEXT NOT NULL,
    provider_transaction_id TEXT,

    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    customer_email TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'initialized',

    checkout_url TEXT,
    access_code TEXT,

    error_code TEXT,
    error_message TEXT,

    initiated_by_profile_id UUID,
    billing_invoice_id UUID,

    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    -- Ensures the subscription, company and plan belong together.
    CONSTRAINT fk_billing_payments_subscription_scope
        FOREIGN KEY (subscription_id, company_id, plan_id)
        REFERENCES public.billing_subscriptions(id, company_id, plan_id)
        ON DELETE RESTRICT,

    -- Prevents test/live, provider or plan mapping mismatches.
    CONSTRAINT fk_billing_payments_provider_plan_scope
        FOREIGN KEY (
            provider_plan_mapping_id,
            plan_id,
            provider,
            environment
        )
        REFERENCES public.billing_provider_plans(
            id,
            plan_id,
            provider,
            environment
        )
        ON DELETE RESTRICT,

    CONSTRAINT fk_billing_payments_initiated_by
        FOREIGN KEY (initiated_by_profile_id)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_billing_payments_idempotency_key
        UNIQUE (idempotency_key),

    CONSTRAINT uq_billing_payments_provider_env_reference
        UNIQUE (provider, environment, provider_reference),

    CONSTRAINT chk_billing_payments_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_billing_payments_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_billing_payments_purpose
        CHECK (purpose IN ('activation', 'renewal')),

    CONSTRAINT chk_billing_payments_purpose_invoice
        CHECK (
            purpose <> 'renewal'
            OR billing_invoice_id IS NOT NULL
        ),

    CONSTRAINT chk_billing_payments_reference_non_empty
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_reference)
            ) > 0
        ),

    CONSTRAINT chk_billing_payments_transaction_id_non_empty
        CHECK (
            provider_transaction_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_transaction_id)
            ) > 0
        ),

    CONSTRAINT chk_billing_payments_amount_positive
        CHECK (amount_minor > 0),

    CONSTRAINT chk_billing_payments_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_billing_payments_email_non_empty
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(customer_email)
            ) > 0
        ),

    CONSTRAINT chk_billing_payments_status
        CHECK (
            status IN (
                'initialized',
                'pending',
                'succeeded',
                'failed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_billing_payments_checkout_url_non_empty
        CHECK (
            checkout_url IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(checkout_url)
            ) > 0
        ),

    CONSTRAINT chk_billing_payments_access_code_non_empty
        CHECK (
            access_code IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(access_code)
            ) > 0
        )
);

CREATE UNIQUE INDEX uq_billing_payments_provider_transaction
    ON public.billing_payments (
        provider,
        environment,
        provider_transaction_id
    )
    WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX idx_billing_payments_company_created
    ON public.billing_payments (company_id, created_at DESC);

CREATE INDEX idx_billing_payments_subscription_created
    ON public.billing_payments (subscription_id, created_at DESC);

CREATE INDEX idx_billing_payments_provider_plan
    ON public.billing_payments (provider_plan_mapping_id);

CREATE INDEX idx_billing_payments_status
    ON public.billing_payments (status);


-- ============================================================================
-- Server-only security for provider plans and payments
-- ============================================================================

ALTER TABLE public.billing_provider_plans
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_provider_plans
    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.billing_payments
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_payments
    FORCE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.billing_provider_plans
    FROM PUBLIC, anon, authenticated;

REVOKE ALL
    ON TABLE public.billing_payments
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_provider_plans
    TO service_role;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_payments
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_provider_plans
    FROM service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_payments
    FROM service_role;

-- ============================================================================
-- 3. Durable Paystack webhook inbox
-- ============================================================================

CREATE TABLE public.billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    payload_sha256 TEXT NOT NULL,
    provider_event_id TEXT,
    event_type TEXT NOT NULL,
    provider_object_id TEXT,

    raw_payload JSONB NOT NULL,
    signature_verified BOOLEAN NOT NULL,

    processing_status TEXT NOT NULL DEFAULT 'received',
    processing_attempts INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,

    received_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    processing_started_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    CONSTRAINT chk_billing_webhook_events_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_billing_webhook_events_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_billing_webhook_events_payload_hash
        CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),

    CONSTRAINT chk_billing_webhook_events_event_type
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(event_type)
            ) > 0
        ),

    CONSTRAINT chk_billing_webhook_events_provider_event_id
        CHECK (
            provider_event_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_event_id)
            ) > 0
        ),

    CONSTRAINT chk_billing_webhook_events_provider_object_id
        CHECK (
            provider_object_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_object_id)
            ) > 0
        ),

    CONSTRAINT chk_billing_webhook_events_payload_object
        CHECK (pg_catalog.jsonb_typeof(raw_payload) = 'object'),

    CONSTRAINT chk_billing_webhook_events_processing_status
        CHECK (
            processing_status IN (
                'received',
                'processing',
                'processed',
                'failed',
                'ignored'
            )
        ),

    CONSTRAINT chk_billing_webhook_events_attempts
        CHECK (processing_attempts >= 0),

    CONSTRAINT chk_billing_webhook_events_verified_before_processed
        CHECK (
            processing_status <> 'processed'
            OR signature_verified IS TRUE
        ),

    CONSTRAINT chk_billing_webhook_events_error_message
        CHECK (
            error_message IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(error_message)
            ) > 0
        ),

    CONSTRAINT uq_billing_webhook_events_payload
        UNIQUE (provider, environment, payload_sha256)
);

CREATE UNIQUE INDEX uq_billing_webhook_events_provider_event
    ON public.billing_webhook_events (
        provider,
        environment,
        provider_event_id
    )
    WHERE provider_event_id IS NOT NULL;

CREATE INDEX idx_billing_webhook_events_status_received
    ON public.billing_webhook_events (
        processing_status,
        received_at
    );

CREATE INDEX idx_billing_webhook_events_event_type
    ON public.billing_webhook_events (
        provider,
        environment,
        event_type
    );

CREATE INDEX idx_billing_webhook_events_provider_object
    ON public.billing_webhook_events (
        provider,
        environment,
        provider_object_id
    )
    WHERE provider_object_id IS NOT NULL;


-- Server-only security

ALTER TABLE public.billing_webhook_events
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_webhook_events
    FORCE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.billing_webhook_events
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_webhook_events
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_webhook_events
    FROM service_role;

-- ============================================================================
-- 4. Paystack subscription mappings
-- ============================================================================

CREATE TABLE public.billing_provider_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    provider_plan_mapping_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    provider_subscription_code TEXT NOT NULL,
    provider_subscription_id TEXT,

    provider_customer_code TEXT NOT NULL,
    provider_customer_id TEXT,

    email_token TEXT NOT NULL,
    customer_email TEXT NOT NULL,

    provider_status TEXT NOT NULL,
    next_payment_at TIMESTAMPTZ,

    is_current BOOLEAN NOT NULL DEFAULT true,
    disabled_at TIMESTAMPTZ,

    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    -- Ensures the company, subscription and plan belong together.
    CONSTRAINT fk_provider_subscriptions_subscription_scope
        FOREIGN KEY (subscription_id, company_id, plan_id)
        REFERENCES public.billing_subscriptions(id, company_id, plan_id)
        ON DELETE RESTRICT,

    -- Prevents plan, provider or test/live environment mismatches.
    CONSTRAINT fk_provider_subscriptions_plan_scope
        FOREIGN KEY (
            provider_plan_mapping_id,
            plan_id,
            provider,
            environment
        )
        REFERENCES public.billing_provider_plans(
            id,
            plan_id,
            provider,
            environment
        )
        ON DELETE RESTRICT,

    CONSTRAINT chk_provider_subscriptions_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_provider_subscriptions_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_provider_subscriptions_code
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_subscription_code)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_id
        CHECK (
            provider_subscription_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_subscription_id)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_customer_code
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_customer_code)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_customer_id
        CHECK (
            provider_customer_id IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(provider_customer_id)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_email_token
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(email_token)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_customer_email
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(customer_email)
            ) > 0
        ),

    CONSTRAINT chk_provider_subscriptions_status
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_status)
            ) > 0
        ),

    CONSTRAINT uq_provider_subscriptions_code
        UNIQUE (
            provider,
            environment,
            provider_subscription_code
        ),

    CONSTRAINT uq_provider_subscriptions_invoice_scope
        UNIQUE (
            id,
            company_id,
            subscription_id,
            provider,
            environment
        )
);

CREATE UNIQUE INDEX uq_provider_subscriptions_provider_id
    ON public.billing_provider_subscriptions (
        provider,
        environment,
        provider_subscription_id
    )
    WHERE provider_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX uq_provider_subscriptions_current
    ON public.billing_provider_subscriptions (
        subscription_id,
        provider,
        environment
    )
    WHERE is_current IS TRUE;

CREATE INDEX idx_provider_subscriptions_company
    ON public.billing_provider_subscriptions (company_id);

CREATE INDEX idx_provider_subscriptions_customer
    ON public.billing_provider_subscriptions (
        provider,
        environment,
        provider_customer_code
    );

CREATE INDEX idx_provider_subscriptions_next_payment
    ON public.billing_provider_subscriptions (next_payment_at)
    WHERE is_current IS TRUE;


-- Server-only security

ALTER TABLE public.billing_provider_subscriptions
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_provider_subscriptions
    FORCE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.billing_provider_subscriptions
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_provider_subscriptions
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_provider_subscriptions
    FROM service_role;

-- ============================================================================
-- 5. Paystack payment methods
-- ============================================================================

-- Supports company/environment-safe payment-method provenance.
ALTER TABLE public.billing_payments
    ADD CONSTRAINT uq_billing_payments_method_scope
    UNIQUE (id, company_id, provider, environment);


CREATE TABLE public.billing_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL,
    source_payment_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    provider_customer_code TEXT NOT NULL,
    customer_email TEXT NOT NULL,

    -- Sensitive server-only Paystack tokens.
    authorization_code TEXT NOT NULL,
    authorization_signature TEXT NOT NULL,

    -- Safe display information.
    channel TEXT NOT NULL,
    card_type TEXT NOT NULL,
    brand TEXT NOT NULL,
    bank TEXT,
    last4 VARCHAR(4) NOT NULL,
    expiry_month SMALLINT NOT NULL,
    expiry_year SMALLINT NOT NULL,
    country_code VARCHAR(2) NOT NULL,

    reusable BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    -- Ensures the source payment belongs to the same company and environment.
    CONSTRAINT fk_payment_methods_source_scope
        FOREIGN KEY (
            source_payment_id,
            company_id,
            provider,
            environment
        )
        REFERENCES public.billing_payments(
            id,
            company_id,
            provider,
            environment
        )
        ON DELETE RESTRICT,

    CONSTRAINT chk_payment_methods_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_payment_methods_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_payment_methods_customer_code
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(provider_customer_code)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_customer_email
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(customer_email)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_authorization_code
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(authorization_code)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_signature
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(authorization_signature)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_channel
        CHECK (channel = 'card'),

    CONSTRAINT chk_payment_methods_card_type
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(card_type)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_brand
        CHECK (
            pg_catalog.char_length(
                pg_catalog.btrim(brand)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_bank
        CHECK (
            bank IS NULL
            OR pg_catalog.char_length(
                pg_catalog.btrim(bank)
            ) > 0
        ),

    CONSTRAINT chk_payment_methods_last4
        CHECK (last4 ~ '^[0-9]{4}$'),

    CONSTRAINT chk_payment_methods_expiry_month
        CHECK (expiry_month BETWEEN 1 AND 12),

    CONSTRAINT chk_payment_methods_expiry_year
        CHECK (expiry_year BETWEEN 2000 AND 9999),

    CONSTRAINT chk_payment_methods_country
        CHECK (country_code ~ '^[A-Z]{2}$'),

    CONSTRAINT chk_payment_methods_default
        CHECK (
            is_default IS FALSE
            OR (
                is_active IS TRUE
                AND reusable IS TRUE
            )
        ),

    CONSTRAINT chk_payment_methods_revoked
        CHECK (
            is_active IS TRUE
            OR revoked_at IS NOT NULL
        ),

    CONSTRAINT uq_payment_methods_authorization
        UNIQUE (
            provider,
            environment,
            authorization_code
        ),

    CONSTRAINT uq_payment_methods_signature
        UNIQUE (
            company_id,
            provider,
            environment,
            authorization_signature
        ),

    -- Supports a safe link from provider subscriptions.
    CONSTRAINT uq_payment_methods_scope
        UNIQUE (
            id,
            company_id,
            provider,
            environment
        )
);

CREATE UNIQUE INDEX uq_payment_methods_default
    ON public.billing_payment_methods (
        company_id,
        provider,
        environment
    )
    WHERE is_default IS TRUE
      AND is_active IS TRUE;

CREATE INDEX idx_payment_methods_company_active
    ON public.billing_payment_methods (
        company_id,
        is_active
    );

CREATE INDEX idx_payment_methods_source_payment
    ON public.billing_payment_methods (source_payment_id);

CREATE INDEX idx_payment_methods_expiry
    ON public.billing_payment_methods (
        expiry_year,
        expiry_month
    )
    WHERE is_active IS TRUE;


-- Link the provider subscription to its current payment method.

ALTER TABLE public.billing_provider_subscriptions
    ADD COLUMN payment_method_id UUID;

ALTER TABLE public.billing_provider_subscriptions
    ADD CONSTRAINT fk_provider_subscriptions_payment_method
    FOREIGN KEY (
        payment_method_id,
        company_id,
        provider,
        environment
    )
    REFERENCES public.billing_payment_methods(
        id,
        company_id,
        provider,
        environment
    )
    ON DELETE RESTRICT;

CREATE INDEX idx_provider_subscriptions_payment_method
    ON public.billing_provider_subscriptions (payment_method_id)
    WHERE payment_method_id IS NOT NULL;


-- Server-only security

ALTER TABLE public.billing_payment_methods
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_payment_methods
    FORCE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.billing_payment_methods
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_payment_methods
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_payment_methods
    FROM service_role;

-- ============================================================================
-- 5b. Recurring billing invoices
-- ============================================================================

CREATE TABLE public.billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    provider_subscription_record_id UUID NOT NULL,

    provider TEXT NOT NULL,
    environment TEXT NOT NULL,

    provider_invoice_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_status TEXT,

    amount_minor INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,

    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,

    first_failed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

    -- Foreign keys with strict ON DELETE RESTRICT
    CONSTRAINT fk_billing_invoices_company
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_billing_invoices_subscription_scope
        FOREIGN KEY (subscription_id, company_id)
        REFERENCES public.billing_subscriptions(id, company_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_billing_invoices_provider_sub_scope
        FOREIGN KEY (
            provider_subscription_record_id,
            company_id,
            subscription_id,
            provider,
            environment
        )
        REFERENCES public.billing_provider_subscriptions(
            id,
            company_id,
            subscription_id,
            provider,
            environment
        )
        ON DELETE RESTRICT,

    -- Exact semantic uniqueness on (provider, environment, provider_invoice_code)
    CONSTRAINT uq_billing_invoices_provider_code
        UNIQUE (provider, environment, provider_invoice_code),

    -- Supports composite payment foreign key
    CONSTRAINT uq_billing_invoices_payment_scope
        UNIQUE (id, company_id, subscription_id, provider, environment),

    -- Check constraints
    CONSTRAINT chk_billing_invoices_provider
        CHECK (provider = 'paystack'),

    CONSTRAINT chk_billing_invoices_environment
        CHECK (environment IN ('test', 'live')),

    CONSTRAINT chk_billing_invoices_code_format
        CHECK (
            provider_invoice_code ~ '^INV_[a-zA-Z0-9_\-]+$'
            AND pg_catalog.char_length(pg_catalog.btrim(provider_invoice_code)) >= 5
        ),

    CONSTRAINT chk_billing_invoices_status
        CHECK (status IN ('pending', 'failed', 'paid')),

    CONSTRAINT chk_billing_invoices_provider_status
        CHECK (
            provider_status IS NULL
            OR (
                pg_catalog.char_length(pg_catalog.btrim(provider_status)) > 0
                AND pg_catalog.char_length(provider_status) <= 50
            )
        ),

    CONSTRAINT chk_billing_invoices_amount_positive
        CHECK (amount_minor > 0),

    CONSTRAINT chk_billing_invoices_currency
        CHECK (currency ~ '^[A-Z]{3}$'),

    -- Period integrity: both null or both non-null with end > start
    CONSTRAINT chk_billing_invoices_period_dates
        CHECK (
            (period_start IS NULL AND period_end IS NULL)
            OR (period_start IS NOT NULL AND period_end IS NOT NULL AND period_end > period_start)
        ),

    CONSTRAINT chk_billing_invoices_paid_period
        CHECK (
            status <> 'paid'
            OR (period_start IS NOT NULL AND period_end IS NOT NULL)
        ),

    -- Timestamp and status coherence
    CONSTRAINT chk_billing_invoices_pending_timestamps
        CHECK (
            status <> 'pending'
            OR paid_at IS NULL
        ),

    CONSTRAINT chk_billing_invoices_failed_timestamps
        CHECK (
            status <> 'failed'
            OR (first_failed_at IS NOT NULL AND paid_at IS NULL)
        ),

    CONSTRAINT chk_billing_invoices_paid_timestamps
        CHECK (
            status <> 'paid'
            OR paid_at IS NOT NULL
        )
);

CREATE INDEX idx_billing_invoices_company_created
    ON public.billing_invoices (company_id, created_at DESC);

CREATE INDEX idx_billing_invoices_subscription_created
    ON public.billing_invoices (subscription_id, created_at DESC);

CREATE INDEX idx_billing_invoices_provider_sub
    ON public.billing_invoices (provider_subscription_record_id);

CREATE INDEX idx_billing_invoices_status
    ON public.billing_invoices (status);

CREATE INDEX idx_billing_invoices_period
    ON public.billing_invoices (period_start, period_end)
    WHERE period_start IS NOT NULL;

ALTER TABLE public.billing_invoices
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_invoices
    FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow members with billing access to view company invoices"
    ON public.billing_invoices
    FOR SELECT
    TO authenticated
    USING (public.verify_billing_access(company_id) IS TRUE);

REVOKE ALL
    ON TABLE public.billing_invoices
    FROM PUBLIC, anon, authenticated;

GRANT SELECT
    ON TABLE public.billing_invoices
    TO authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE public.billing_invoices
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE public.billing_invoices
    FROM service_role;

-- Connect payment attempts to invoices
ALTER TABLE public.billing_payments
    ADD CONSTRAINT fk_billing_payments_invoice_scope
        FOREIGN KEY (
            billing_invoice_id,
            company_id,
            subscription_id,
            provider,
            environment
        )
        REFERENCES public.billing_invoices(
            id,
            company_id,
            subscription_id,
            provider,
            environment
        )
        ON DELETE RESTRICT;

CREATE INDEX idx_billing_payments_invoice
    ON public.billing_payments (billing_invoice_id)
    WHERE billing_invoice_id IS NOT NULL;

-- ============================================================================
-- 6. Connect payment attempts to the immutable billing ledger
-- ============================================================================

-- Supports company/subscription-safe ledger references.
ALTER TABLE public.billing_payments
    ADD CONSTRAINT uq_billing_payments_ledger_scope
    UNIQUE (id, company_id, subscription_id);

ALTER TABLE public.billing_ledger_events
    ADD COLUMN payment_id UUID;

ALTER TABLE public.billing_ledger_events
    ADD CONSTRAINT fk_billing_ledger_events_payment
    FOREIGN KEY (
        payment_id,
        company_id,
        subscription_id
    )
    REFERENCES public.billing_payments(
        id,
        company_id,
        subscription_id
    )
    ON DELETE RESTRICT;

CREATE INDEX idx_billing_ledger_events_payment
    ON public.billing_ledger_events (payment_id)
    WHERE payment_id IS NOT NULL;

-- ============================================================================
-- 7. Prevent deletion of financial and provider records
-- ============================================================================

CREATE FUNCTION public.prevent_billing_foundation_deletion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $prevent_billing_foundation_deletion$
BEGIN
    RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = pg_catalog.format(
            'Deleting or truncating records from public.%I is prohibited',
            TG_TABLE_NAME
        );
END;
$prevent_billing_foundation_deletion$;

REVOKE ALL
    ON FUNCTION public.prevent_billing_foundation_deletion()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.prevent_billing_foundation_deletion()
    TO service_role;


CREATE TRIGGER trg_billing_provider_plans_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_provider_plans
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_payments_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_payments
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_webhook_events_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_webhook_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_provider_subscriptions_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_provider_subscriptions
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_payment_methods_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_payment_methods
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

CREATE TRIGGER trg_billing_invoices_no_delete
BEFORE DELETE OR TRUNCATE
ON public.billing_invoices
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_billing_foundation_deletion();

-- ============================================================================
-- 8. Protect provider-plan, payment, invoice and subscription commercial data
-- ============================================================================

CREATE FUNCTION public.protect_billing_provider_plan_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_provider_plan_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.provider_plan_code IS DISTINCT FROM OLD.provider_plan_code
       OR NEW.provider_plan_id IS DISTINCT FROM OLD.provider_plan_id
       OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Provider-plan commercial fields are immutable';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_provider_plan_update$;


CREATE FUNCTION public.protect_billing_payment_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_payment_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.provider_plan_mapping_id
            IS DISTINCT FROM OLD.provider_plan_mapping_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.purpose IS DISTINCT FROM OLD.purpose
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
       OR NEW.provider_reference IS DISTINCT FROM OLD.provider_reference
       OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Payment identity and commercial fields are immutable';
    END IF;

    -- One-way invoice binding
    IF OLD.billing_invoice_id IS NOT NULL AND NEW.billing_invoice_id IS DISTINCT FROM OLD.billing_invoice_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Payment invoice linkage cannot be changed or cleared once set';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_payment_update$;


CREATE FUNCTION public.protect_billing_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_invoice_update$
BEGIN
    -- 1. Identity and commercial snapshot fields are immutable
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
       OR NEW.provider_subscription_record_id IS DISTINCT FROM OLD.provider_subscription_record_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.provider_invoice_code IS DISTINCT FROM OLD.provider_invoice_code
       OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Invoice identity and commercial fields are immutable';
    END IF;

    -- 2. State transition matrix validation
    IF OLD.status = 'pending' AND NEW.status NOT IN ('pending', 'failed', 'paid') THEN
        RAISE EXCEPTION 'Invalid invoice status transition from pending to %', NEW.status
            USING ERRCODE = '55000';
    ELSIF OLD.status = 'failed' AND NEW.status NOT IN ('failed', 'paid') THEN
        RAISE EXCEPTION 'Invalid invoice status transition from failed to %', NEW.status
            USING ERRCODE = '55000';
    ELSIF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
        RAISE EXCEPTION 'Invalid invoice status transition from paid to %', NEW.status
            USING ERRCODE = '55000';
    END IF;

    -- 3. Period immutability: once set, period_start and period_end cannot be changed
    IF OLD.period_start IS NOT NULL THEN
        IF NEW.period_start IS DISTINCT FROM OLD.period_start
           OR NEW.period_end IS DISTINCT FROM OLD.period_end
        THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'Invoice billing period is immutable once established';
        END IF;
    ELSIF NEW.period_start IS NOT NULL THEN
        IF NEW.period_end IS NULL OR NEW.period_end <= NEW.period_start THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'Invoice period_end must be strictly greater than period_start';
        END IF;
    END IF;

    -- 4. first_failed_at immutability and rules
    IF OLD.first_failed_at IS NOT NULL THEN
        IF NEW.first_failed_at IS DISTINCT FROM OLD.first_failed_at THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'first_failed_at cannot be modified or cleared once recorded';
        END IF;
    ELSIF NEW.status = 'failed' AND NEW.first_failed_at IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'first_failed_at is required when transitioning to failed';
    END IF;

    -- 5. paid_at immutability and rules
    IF OLD.paid_at IS NOT NULL THEN
        IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'paid_at cannot be modified or cleared once recorded';
        END IF;
    ELSIF NEW.status = 'paid' THEN
        IF NEW.paid_at IS NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'paid_at is required when transitioning to paid';
        END IF;
        IF NEW.period_start IS NULL OR NEW.period_end IS NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = '55000',
                MESSAGE = 'paid invoice must have non-null billing period';
        END IF;
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_invoice_update$;


CREATE FUNCTION public.protect_billing_subscription_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_subscription_update$
BEGIN
    -- 1. Identity and commercial snapshot fields are immutable
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.subscription_reference IS DISTINCT FROM OLD.subscription_reference
       OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Subscription identity and commercial fields are immutable';
    END IF;

    -- 2. past_due_since rules
    IF NEW.status <> 'past_due' THEN
        IF NEW.past_due_since IS NOT NULL THEN
            IF OLD.status = 'past_due' THEN
                NEW.past_due_since := NULL;
            ELSE
                RAISE EXCEPTION USING
                    ERRCODE = '55000',
                    MESSAGE = 'past_due_since can only be populated when subscription status is past_due';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_subscription_update$;


REVOKE ALL
    ON FUNCTION public.protect_billing_provider_plan_update()
    FROM PUBLIC, anon, authenticated;

REVOKE ALL
    ON FUNCTION public.protect_billing_payment_update()
    FROM PUBLIC, anon, authenticated;

REVOKE ALL
    ON FUNCTION public.protect_billing_invoice_update()
    FROM PUBLIC, anon, authenticated;

REVOKE ALL
    ON FUNCTION public.protect_billing_subscription_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_provider_plan_update()
    TO service_role;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_payment_update()
    TO service_role;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_invoice_update()
    TO service_role;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_subscription_update()
    TO service_role;


CREATE TRIGGER trg_billing_provider_plans_protect_update
BEFORE UPDATE
ON public.billing_provider_plans
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_provider_plan_update();

CREATE TRIGGER trg_billing_payments_protect_update
BEFORE UPDATE
ON public.billing_payments
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_payment_update();

CREATE TRIGGER trg_billing_invoices_protect_update
BEFORE UPDATE
ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_invoice_update();

CREATE TRIGGER trg_billing_subscriptions_protect_update
BEFORE UPDATE
ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_subscription_update();


-- Require matching terminal timestamps.

ALTER TABLE public.billing_payments
    ADD CONSTRAINT chk_billing_payments_paid_timestamp
    CHECK (
        (status = 'succeeded' AND paid_at IS NOT NULL)
        OR (status <> 'succeeded' AND paid_at IS NULL)
    );

ALTER TABLE public.billing_payments
    ADD CONSTRAINT chk_billing_payments_failed_timestamp
    CHECK (
        (status = 'failed' AND failed_at IS NOT NULL)
        OR (status <> 'failed' AND failed_at IS NULL)
    );

ALTER TABLE public.billing_payments
    ADD CONSTRAINT chk_billing_payments_cancelled_timestamp
    CHECK (
        (status = 'cancelled' AND cancelled_at IS NOT NULL)
        OR (status <> 'cancelled' AND cancelled_at IS NULL)
    );

-- ============================================================================
-- 9. Strengthen webhook and payment-method state constraints
-- ============================================================================

-- Only signature-verified Paystack events may enter the durable inbox.
ALTER TABLE public.billing_webhook_events
    ADD CONSTRAINT chk_webhook_signature_verified
    CHECK (signature_verified IS TRUE);

ALTER TABLE public.billing_webhook_events
    ADD CONSTRAINT chk_webhook_processing_started
    CHECK (
        processing_status = 'received'
        OR processing_started_at IS NOT NULL
    );

ALTER TABLE public.billing_webhook_events
    ADD CONSTRAINT chk_webhook_processing_completed
    CHECK (
        processing_status IN ('received', 'processing')
        OR processed_at IS NOT NULL
    );

ALTER TABLE public.billing_webhook_events
    ADD CONSTRAINT chk_webhook_failed_error
    CHECK (
        processing_status <> 'failed'
        OR error_message IS NOT NULL
    );


-- Active payment methods must not have a revocation timestamp.
ALTER TABLE public.billing_payment_methods
    DROP CONSTRAINT chk_payment_methods_revoked;

ALTER TABLE public.billing_payment_methods
    ADD CONSTRAINT chk_payment_methods_revoked
    CHECK (
        (
            is_active IS TRUE
            AND revoked_at IS NULL
        )
        OR
        (
            is_active IS FALSE
            AND revoked_at IS NOT NULL
        )
    );


-- ============================================================================
-- 10. Protect immutable webhook data
-- ============================================================================

CREATE FUNCTION public.protect_billing_webhook_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_webhook_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
       OR NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id
       OR NEW.event_type IS DISTINCT FROM OLD.event_type
       OR NEW.provider_object_id IS DISTINCT FROM OLD.provider_object_id
       OR NEW.raw_payload IS DISTINCT FROM OLD.raw_payload
       OR NEW.signature_verified IS DISTINCT FROM OLD.signature_verified
       OR NEW.received_at IS DISTINCT FROM OLD.received_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Webhook identity and payload fields are immutable';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_webhook_update$;

REVOKE ALL
    ON FUNCTION public.protect_billing_webhook_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_webhook_update()
    TO service_role;

CREATE TRIGGER trg_billing_webhook_events_protect_update
BEFORE UPDATE
ON public.billing_webhook_events
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_webhook_update();


-- ============================================================================
-- 11. Protect provider-subscription identity
-- ============================================================================

CREATE FUNCTION public.protect_provider_subscription_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_provider_subscription_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.provider_plan_mapping_id
            IS DISTINCT FROM OLD.provider_plan_mapping_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.provider_subscription_code
            IS DISTINCT FROM OLD.provider_subscription_code
       OR NEW.provider_subscription_id
            IS DISTINCT FROM OLD.provider_subscription_id
       OR NEW.provider_customer_code
            IS DISTINCT FROM OLD.provider_customer_code
       OR NEW.provider_customer_id
            IS DISTINCT FROM OLD.provider_customer_id
       OR NEW.email_token IS DISTINCT FROM OLD.email_token
       OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Provider-subscription identity fields are immutable';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_provider_subscription_update$;

REVOKE ALL
    ON FUNCTION public.protect_provider_subscription_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_provider_subscription_update()
    TO service_role;

CREATE TRIGGER trg_provider_subscriptions_protect_update
BEFORE UPDATE
ON public.billing_provider_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.protect_provider_subscription_update();


-- ============================================================================
-- 12. Protect payment-method ownership and card signature
-- ============================================================================

CREATE FUNCTION public.protect_billing_payment_method_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $protect_billing_payment_method_update$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.authorization_signature
            IS DISTINCT FROM OLD.authorization_signature
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '55000',
            MESSAGE = 'Payment-method ownership and signature are immutable';
    END IF;

    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$protect_billing_payment_method_update$;

REVOKE ALL
    ON FUNCTION public.protect_billing_payment_method_update()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.protect_billing_payment_method_update()
    TO service_role;

CREATE TRIGGER trg_billing_payment_methods_protect_update
BEFORE UPDATE
ON public.billing_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_payment_method_update();


-- ============================================================================
-- 13. Documentation for sensitive server-only fields
-- ============================================================================

COMMENT ON TABLE public.billing_provider_plans IS
    'Server-only mappings between ProjectMatrix billing plans and Paystack plans.';

COMMENT ON TABLE public.billing_payments IS
    'Server-only payment attempts recorded before contacting Paystack.';

COMMENT ON TABLE public.billing_webhook_events IS
    'Immutable Paystack webhook inbox containing signature-verified payloads.';

COMMENT ON TABLE public.billing_provider_subscriptions IS
    'Server-only mapping between ProjectMatrix and Paystack subscriptions.';

COMMENT ON TABLE public.billing_payment_methods IS
    'Server-only Paystack authorization tokens and masked card information.';

COMMENT ON COLUMN
    public.billing_provider_subscriptions.email_token IS
    'Sensitive Paystack token used to enable or disable a subscription.';

COMMENT ON COLUMN
    public.billing_payment_methods.authorization_code IS
    'Sensitive reusable Paystack authorization token. Never expose to clients.';

COMMENT ON COLUMN
    public.billing_payment_methods.authorization_signature IS
    'Stable Paystack payment-instrument identifier used for deduplication.';

COMMENT ON COLUMN
    public.billing_payment_methods.last4 IS
    'Display-safe final four card digits. Full card numbers are never stored.';

COMMENT ON COLUMN
    public.billing_webhook_events.raw_payload IS
    'Signature-verified Paystack webhook JSON. Accessible only server-side.';


-- ============================================================================
-- 14. Final privilege enforcement
-- ============================================================================

REVOKE ALL
    ON TABLE
        public.billing_provider_plans,
        public.billing_payments,
        public.billing_webhook_events,
        public.billing_provider_subscriptions,
        public.billing_payment_methods
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
    ON TABLE
        public.billing_provider_plans,
        public.billing_payments,
        public.billing_webhook_events,
        public.billing_provider_subscriptions,
        public.billing_payment_methods
    TO service_role;

REVOKE DELETE, TRUNCATE
    ON TABLE
        public.billing_provider_plans,
        public.billing_payments,
        public.billing_webhook_events,
        public.billing_provider_subscriptions,
        public.billing_payment_methods
    FROM service_role;

-- ============================================================================
-- 15. Final financial-integrity corrections
-- ============================================================================

-- A payment must use the exact commercial snapshot of its provider-plan map.
ALTER TABLE public.billing_provider_plans
    ADD CONSTRAINT uq_billing_provider_plans_commercial_scope
    UNIQUE (
        id,
        plan_id,
        provider,
        environment,
        amount_minor,
        currency
    );

ALTER TABLE public.billing_payments
    DROP CONSTRAINT fk_billing_payments_provider_plan_scope;

ALTER TABLE public.billing_payments
    ADD CONSTRAINT fk_billing_payments_provider_plan_scope
    FOREIGN KEY (
        provider_plan_mapping_id,
        plan_id,
        provider,
        environment,
        amount_minor,
        currency
    )
    REFERENCES public.billing_provider_plans (
        id,
        plan_id,
        provider,
        environment,
        amount_minor,
        currency
    )
    ON DELETE RESTRICT;


-- A stored authorization must retain the email used by its source payment.
ALTER TABLE public.billing_payments
    ADD CONSTRAINT uq_billing_payments_method_customer_scope
    UNIQUE (
        id,
        company_id,
        provider,
        environment,
        customer_email
    );

ALTER TABLE public.billing_payment_methods
    DROP CONSTRAINT fk_payment_methods_source_scope;

ALTER TABLE public.billing_payment_methods
    ADD CONSTRAINT fk_payment_methods_source_scope
    FOREIGN KEY (
        source_payment_id,
        company_id,
        provider,
        environment,
        customer_email
    )
    REFERENCES public.billing_payments (
        id,
        company_id,
        provider,
        environment,
        customer_email
    )
    ON DELETE RESTRICT;


-- A provider subscription may only use a payment method belonging to the
-- same company, environment, Paystack customer and immutable payment email.
ALTER TABLE public.billing_payment_methods
    ADD CONSTRAINT uq_payment_methods_customer_scope
    UNIQUE (
        id,
        company_id,
        provider,
        environment,
        provider_customer_code,
        customer_email
    );

ALTER TABLE public.billing_provider_subscriptions
    DROP CONSTRAINT fk_provider_subscriptions_payment_method;

ALTER TABLE public.billing_provider_subscriptions
    ADD CONSTRAINT fk_provider_subscriptions_payment_method
    FOREIGN KEY (
        payment_method_id,
        company_id,
        provider,
        environment,
        provider_customer_code,
        customer_email
    )
    REFERENCES public.billing_payment_methods (
        id,
        company_id,
        provider,
        environment,
        provider_customer_code,
        customer_email
    )
    ON DELETE RESTRICT;


-- A new provider-plan mapping must initially match its internal plan.
-- The mapping then remains an immutable historical commercial snapshot.
CREATE FUNCTION public.validate_billing_provider_plan_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $validate_billing_provider_plan_insert$
DECLARE
    expected_amount_minor INTEGER;
    expected_currency VARCHAR(3);
    expected_billing_interval TEXT;
BEGIN
    SELECT
        plan.amount_minor,
        plan.currency,
        plan.billing_interval
    INTO
        expected_amount_minor,
        expected_currency,
        expected_billing_interval
    FROM public.billing_plans AS plan
    WHERE plan.id = NEW.plan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'The billing plan does not exist';
    END IF;

    IF NEW.amount_minor IS DISTINCT FROM expected_amount_minor
       OR NEW.currency IS DISTINCT FROM expected_currency
       OR NEW.billing_interval IS DISTINCT FROM expected_billing_interval
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Provider-plan commercial values must match the internal billing plan';
    END IF;

    RETURN NEW;
END;
$validate_billing_provider_plan_insert$;

REVOKE ALL
    ON FUNCTION public.validate_billing_provider_plan_insert()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.validate_billing_provider_plan_insert()
    TO service_role;

CREATE TRIGGER trg_billing_provider_plans_validate_insert
BEFORE INSERT
ON public.billing_provider_plans
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_provider_plan_insert();


-- Authorization details may only originate from a verified successful charge.
CREATE FUNCTION public.validate_billing_payment_method_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $validate_billing_payment_method_source$
DECLARE
    source_status TEXT;
    source_email TEXT;
BEGIN
    SELECT
        payment.status,
        payment.customer_email
    INTO
        source_status,
        source_email
    FROM public.billing_payments AS payment
    WHERE payment.id = NEW.source_payment_id
      AND payment.company_id = NEW.company_id
      AND payment.provider = NEW.provider
      AND payment.environment = NEW.environment;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'The source payment does not match this payment method';
    END IF;

    IF source_status <> 'succeeded' THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Payment methods may only be stored from successful payments';
    END IF;

    IF NEW.customer_email IS DISTINCT FROM source_email THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Payment-method email must match the source payment email';
    END IF;

    RETURN NEW;
END;
$validate_billing_payment_method_source$;

REVOKE ALL
    ON FUNCTION public.validate_billing_payment_method_source()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.validate_billing_payment_method_source()
    TO service_role;

CREATE TRIGGER trg_billing_payment_methods_validate_source
BEFORE INSERT OR UPDATE
ON public.billing_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_payment_method_source();


-- Prevent late or out-of-order events from regressing payment state.
CREATE FUNCTION public.validate_billing_payment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $validate_billing_payment_status_transition$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
           (OLD.status = 'initialized'
                AND NEW.status IN ('pending', 'succeeded', 'failed', 'cancelled'))
           OR
           (OLD.status = 'pending'
                AND NEW.status IN ('succeeded', 'failed', 'cancelled'))
           OR
           (OLD.status IN ('failed', 'cancelled')
                AND NEW.status = 'succeeded')
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Invalid billing payment status transition: %s -> %s',
                OLD.status,
                NEW.status
            );
    END IF;

    RETURN NEW;
END;
$validate_billing_payment_status_transition$;

REVOKE ALL
    ON FUNCTION public.validate_billing_payment_status_transition()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.validate_billing_payment_status_transition()
    TO service_role;

CREATE TRIGGER trg_billing_payments_validate_status_transition
BEFORE UPDATE
ON public.billing_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_payment_status_transition();


-- Processed/ignored webhooks are terminal; failed webhooks may be retried.
CREATE FUNCTION public.validate_billing_webhook_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $validate_billing_webhook_transition$
BEGIN
    IF NEW.processing_attempts < OLD.processing_attempts THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Webhook processing attempts cannot decrease';
    END IF;

    IF NEW.processing_status IS DISTINCT FROM OLD.processing_status
       AND NOT (
           (OLD.processing_status = 'received'
                AND NEW.processing_status IN ('processing', 'processed', 'failed', 'ignored'))
           OR
           (OLD.processing_status = 'processing'
                AND NEW.processing_status IN ('processed', 'failed', 'ignored'))
           OR
           (OLD.processing_status = 'failed'
                AND NEW.processing_status IN ('processing', 'ignored'))
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Invalid webhook processing transition: %s -> %s',
                OLD.processing_status,
                NEW.processing_status
            );
    END IF;

    RETURN NEW;
END;
$validate_billing_webhook_transition$;

REVOKE ALL
    ON FUNCTION public.validate_billing_webhook_transition()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
    ON FUNCTION public.validate_billing_webhook_transition()
    TO service_role;

CREATE TRIGGER trg_billing_webhook_events_validate_transition
BEFORE UPDATE
ON public.billing_webhook_events
FOR EACH ROW
EXECUTE FUNCTION public.validate_billing_webhook_transition();


-- ============================================================================
-- 17. Seed: Map active internal plan 'business-monthly' to Paystack Test Plan
-- ============================================================================

DO $$
DECLARE
    v_plan RECORD;
    v_existing RECORD;
    c_target_plan_code CONSTANT TEXT := 'business-monthly';
    c_provider CONSTANT TEXT := 'paystack';
    c_environment CONSTANT TEXT := 'test';
    c_provider_plan_code CONSTANT TEXT := 'PLN_os65zcdsrs9yyes';
    c_provider_plan_id CONSTANT TEXT := '3994459';
    c_amount_minor CONSTANT INTEGER := 500000;
    c_currency CONSTANT VARCHAR(3) := 'ZAR';
    c_billing_interval CONSTANT TEXT := 'monthly';
BEGIN
    -- 1. Verify internal plan exists
    SELECT
        id,
        code,
        amount_minor,
        currency,
        billing_interval,
        is_active
    INTO v_plan
    FROM public.billing_plans
    WHERE code = c_target_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = pg_catalog.format('Internal plan %s not found in public.billing_plans', c_target_plan_code);
    END IF;

    -- 2. Verify internal plan is active
    IF v_plan.is_active IS NOT TRUE THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format('Internal plan %s is not active in public.billing_plans', c_target_plan_code);
    END IF;

    -- 3. Verify matching commercial values
    IF v_plan.amount_minor <> c_amount_minor THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Internal plan %s amount_minor %s does not match expected mapping amount_minor %s',
                c_target_plan_code,
                v_plan.amount_minor,
                c_amount_minor
            );
    END IF;

    IF v_plan.currency <> c_currency THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Internal plan %s currency %s does not match expected mapping currency %s',
                c_target_plan_code,
                v_plan.currency,
                c_currency
            );
    END IF;

    IF v_plan.billing_interval <> c_billing_interval THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = pg_catalog.format(
                'Internal plan %s billing_interval %s does not match expected mapping billing_interval %s',
                c_target_plan_code,
                v_plan.billing_interval,
                c_billing_interval
            );
    END IF;

    -- 4. Check for active mapping for this plan, provider, and environment
    SELECT
        id,
        plan_id,
        provider,
        environment,
        provider_plan_code,
        provider_plan_id,
        amount_minor,
        currency,
        billing_interval,
        is_active
    INTO v_existing
    FROM public.billing_provider_plans
    WHERE plan_id = v_plan.id
      AND provider = c_provider
      AND environment = c_environment
      AND is_active IS TRUE;

    IF FOUND THEN
        -- If identical existing mapping: No-Op
        IF v_existing.provider_plan_code = c_provider_plan_code
           AND (v_existing.provider_plan_id = c_provider_plan_id OR (v_existing.provider_plan_id IS NULL AND c_provider_plan_id IS NULL))
           AND v_existing.amount_minor = c_amount_minor
           AND v_existing.currency = c_currency
           AND v_existing.billing_interval = c_billing_interval
           AND v_existing.is_active IS TRUE
        THEN
            RAISE NOTICE 'Identical active provider-plan mapping already exists for plan % on % (%) with id %. No-op.',
                c_target_plan_code, c_provider, c_environment, v_existing.id;
            RETURN;
        ELSE
            -- Conflicting active mapping exists: Raise Exception
            RAISE EXCEPTION USING
                ERRCODE = '23505',
                MESSAGE = pg_catalog.format(
                    'Conflicting active mapping exists for plan %s on %s (%s): existing (code=%s, id=%s, amount=%s, curr=%s, intv=%s) vs requested (code=%s, id=%s, amount=%s, curr=%s, intv=%s)',
                    c_target_plan_code,
                    c_provider,
                    c_environment,
                    v_existing.provider_plan_code,
                    v_existing.provider_plan_id,
                    v_existing.amount_minor,
                    v_existing.currency,
                    v_existing.billing_interval,
                    c_provider_plan_code,
                    c_provider_plan_id,
                    c_amount_minor,
                    c_currency,
                    c_billing_interval
                );
        END IF;
    END IF;

    -- 5. Verify provider_plan_code is not already in use in the same provider/environment
    IF EXISTS (
        SELECT 1
        FROM public.billing_provider_plans
        WHERE provider = c_provider
          AND environment = c_environment
          AND provider_plan_code = c_provider_plan_code
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23505',
            MESSAGE = pg_catalog.format(
                'Provider plan code %s is already in use in %s (%s)',
                c_provider_plan_code,
                c_provider,
                c_environment
            );
    END IF;

    -- 6. Insert new active provider plan mapping
    INSERT INTO public.billing_provider_plans (
        plan_id,
        provider,
        environment,
        provider_plan_code,
        provider_plan_id,
        amount_minor,
        currency,
        billing_interval,
        is_active
    ) VALUES (
        v_plan.id,
        c_provider,
        c_environment,
        c_provider_plan_code,
        c_provider_plan_id,
        c_amount_minor,
        c_currency,
        c_billing_interval,
        true
    );

    RAISE NOTICE 'Successfully mapped plan % to % (%) provider_plan_code %',
        c_target_plan_code, c_provider, c_environment, c_provider_plan_code;
END $$;


-- ============================================================================
-- 18. RPC: Atomic Paystack Checkout Initialization
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initialize_billing_checkout(
    p_company_id pg_catalog.uuid,
    p_idempotency_key pg_catalog.uuid
)
RETURNS TABLE (
    payment_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_plan_mapping_id pg_catalog.uuid,
    provider_plan_code pg_catalog.text,
    provider pg_catalog.text,
    environment pg_catalog.text,
    purpose pg_catalog.text,
    provider_reference pg_catalog.text,
    amount_minor pg_catalog.int4,
    currency pg_catalog.varchar(3),
    customer_email pg_catalog.text,
    payment_status pg_catalog.text,
    checkout_url pg_catalog.text,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $initialize_billing_checkout$
DECLARE
    v_caller_id pg_catalog.uuid;
    v_caller_email pg_catalog.text;

    v_subscription public.billing_subscriptions%ROWTYPE;
    v_plan public.billing_plans%ROWTYPE;
    v_provider_plan public.billing_provider_plans%ROWTYPE;
    v_existing_provider_plan public.billing_provider_plans%ROWTYPE;

    v_existing_payment public.billing_payments%ROWTYPE;
    v_active_payment public.billing_payments%ROWTYPE;
    v_new_payment public.billing_payments%ROWTYPE;

    v_payment_id pg_catalog.uuid;
    v_purpose pg_catalog.text;
    v_now pg_catalog.timestamptz;
    v_provider_reference pg_catalog.text;
BEGIN
    -- 1. Require an authenticated caller.
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION
            'Authentication required to initialize billing checkout.'
            USING ERRCODE = '28000';
    END IF;

    -- 2. Validate required parameters.
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION
            'Company ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION
            'Idempotency key cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- 3. Verify company-scoped Billing access before exposing payment data.
    IF public.verify_billing_access(p_company_id) IS NOT TRUE THEN
        RAISE EXCEPTION
            'Access denied. You do not have permission to manage billing for this company.'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Lock the company to serialize checkout initialization.
    PERFORM 1
    FROM public.companies AS company
    WHERE company.id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Company with ID % was not found.',
            p_company_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 5. Check idempotency before resolving current subscription state.
    --    A retry must still work after the subscription or plan changes.
    SELECT payment.*
    INTO v_existing_payment
    FROM public.billing_payments AS payment
    WHERE payment.idempotency_key = p_idempotency_key
    FOR SHARE;

    IF FOUND THEN
        IF v_existing_payment.company_id IS DISTINCT FROM p_company_id THEN
            RAISE EXCEPTION
                'Idempotency key is already assigned to another company.'
                USING ERRCODE = '23505';
        END IF;

        IF v_existing_payment.initiated_by_profile_id
            IS DISTINCT FROM v_caller_id
        THEN
            RAISE EXCEPTION
                'Idempotency key is already assigned to another caller.'
                USING ERRCODE = '23505';
        END IF;

        SELECT mapping.*
        INTO v_existing_provider_plan
        FROM public.billing_provider_plans AS mapping
        WHERE mapping.id =
            v_existing_payment.provider_plan_mapping_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Provider-plan mapping for existing payment % was not found.',
                v_existing_payment.id
                USING ERRCODE = '23503';
        END IF;

        RETURN QUERY
        SELECT
            v_existing_payment.id,
            v_existing_payment.subscription_id,
            v_existing_payment.provider_plan_mapping_id,
            v_existing_provider_plan.provider_plan_code,
            v_existing_payment.provider,
            v_existing_payment.environment,
            v_existing_payment.purpose,
            v_existing_payment.provider_reference,
            v_existing_payment.amount_minor,
            v_existing_payment.currency,
            v_existing_payment.customer_email,
            v_existing_payment.status,
            v_existing_payment.checkout_url,
            TRUE;

        RETURN;
    END IF;

    -- 6. Resolve the confirmed email from the authenticated identity.
    --    public.profiles is not used as an email-verification fallback.
    SELECT
        pg_catalog.lower(
            pg_catalog.btrim(auth_user.email::pg_catalog.text)
        )
    INTO v_caller_email
    FROM auth.users AS auth_user
    WHERE auth_user.id = v_caller_id
      AND auth_user.email IS NOT NULL
      AND auth_user.email_confirmed_at IS NOT NULL;

    IF v_caller_email IS NULL
       OR v_caller_email = ''
       OR v_caller_email !~*
            '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    THEN
        RAISE EXCEPTION
            'A confirmed caller email address is required to initialize billing checkout.'
            USING ERRCODE = '22000';
    END IF;

    -- 7. Select and lock the current subscription deterministically.
    --    Prefer the single nonterminal subscription when one exists.
    SELECT subscription.*
    INTO v_subscription
    FROM public.billing_subscriptions AS subscription
    WHERE subscription.company_id = p_company_id
      AND subscription.status IN (
          'pending_activation',
          'trialing',
          'active',
          'non_renewing',
          'past_due'
      )
    ORDER BY
        subscription.created_at DESC,
        subscription.id DESC
    LIMIT 1
    FOR UPDATE;

    -- If no nonterminal subscription exists, use the latest terminal record.
    IF NOT FOUND THEN
        SELECT subscription.*
        INTO v_subscription
        FROM public.billing_subscriptions AS subscription
        WHERE subscription.company_id = p_company_id
          AND subscription.status IN (
              'expired',
              'cancelled'
          )
        ORDER BY
            subscription.created_at DESC,
            subscription.id DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_subscription.id IS NULL THEN
        RAISE EXCEPTION
            'No billing subscription was found for company %.',
            p_company_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 8. Validate subscription state and derive payment purpose.
    IF v_subscription.status IN (
        'pending_activation',
        'trialing',
        'expired'
    ) THEN
        v_purpose := 'activation';

    ELSIF v_subscription.status = 'past_due' THEN
        v_purpose := 'renewal';

    ELSE
        RAISE EXCEPTION
            'Billing checkout cannot be initialized for a subscription in "%" status.',
            v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    -- 9. Reject a different logical attempt while another checkout is open.
    SELECT payment.*
    INTO v_active_payment
    FROM public.billing_payments AS payment
    WHERE payment.company_id = p_company_id
      AND payment.subscription_id = v_subscription.id
      AND payment.status IN (
          'initialized',
          'pending'
      )
    ORDER BY
        payment.created_at DESC,
        payment.id DESC
    LIMIT 1
    FOR SHARE;

    IF FOUND THEN
        RAISE EXCEPTION
            'A payment attempt (%) is already open for this subscription with reference %.',
            v_active_payment.status,
            v_active_payment.provider_reference
            USING ERRCODE = '23505';
    END IF;

    -- 10. Resolve and lock the internal plan.
    SELECT plan.*
    INTO v_plan
    FROM public.billing_plans AS plan
    WHERE plan.id = v_subscription.plan_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Billing plan with ID % was not found.',
            v_subscription.plan_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_plan.is_active IS NOT TRUE THEN
        RAISE EXCEPTION
            'Billing plan "%" is currently inactive.',
            v_plan.code
            USING ERRCODE = '22023';
    END IF;

    -- 11. Require exactly one active Paystack mapping.
    BEGIN
        SELECT mapping.*
        INTO STRICT v_provider_plan
        FROM public.billing_provider_plans AS mapping
        WHERE mapping.plan_id = v_plan.id
          AND mapping.provider = 'paystack'
          AND mapping.is_active IS TRUE
        ORDER BY
            mapping.environment ASC,
            mapping.id ASC
        FOR SHARE;

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE EXCEPTION
                'No active Paystack mapping was found for plan "%".',
                v_plan.code
                USING ERRCODE = 'P0002';

        WHEN TOO_MANY_ROWS THEN
            RAISE EXCEPTION
                'Multiple active Paystack mappings were found for plan "%".',
                v_plan.code
                USING ERRCODE = '23505';
    END;

    -- 12. Verify commercial snapshot alignment.
    IF v_provider_plan.amount_minor
            IS DISTINCT FROM v_plan.amount_minor
       OR v_provider_plan.currency
            IS DISTINCT FROM v_plan.currency
       OR v_provider_plan.billing_interval
            IS DISTINCT FROM v_plan.billing_interval
    THEN
        RAISE EXCEPTION
            'Provider-plan commercial values do not match internal plan "%".',
            v_plan.code
            USING ERRCODE = '23514';
    END IF;

    -- 13. Generate a full-UUID payment ID and Paystack-compatible reference.
    v_now := pg_catalog.now();
    v_payment_id := pg_catalog.gen_random_uuid();

    v_provider_reference :=
        'PAY-'
        || pg_catalog.to_char(
            v_now,
            'YYYYMMDD'
        )
        || '-'
        || pg_catalog.upper(
            pg_catalog.replace(
                v_payment_id::pg_catalog.text,
                '-',
                ''
            )
        );

    -- 14. Insert the initialized payment before any Paystack API call.
    INSERT INTO public.billing_payments (
        id,
        company_id,
        subscription_id,
        plan_id,
        provider_plan_mapping_id,
        provider,
        environment,
        purpose,
        idempotency_key,
        provider_reference,
        amount_minor,
        currency,
        customer_email,
        status,
        initiated_by_profile_id,
        created_at,
        updated_at
    )
    VALUES (
        v_payment_id,
        p_company_id,
        v_subscription.id,
        v_plan.id,
        v_provider_plan.id,
        v_provider_plan.provider,
        v_provider_plan.environment,
        v_purpose,
        p_idempotency_key,
        v_provider_reference,
        v_provider_plan.amount_minor,
        v_provider_plan.currency,
        v_caller_email,
        'initialized'::pg_catalog.text,
        v_caller_id,
        v_now,
        v_now
    )
    RETURNING *
    INTO v_new_payment;

    -- 15. Append exactly one immutable linked ledger event.
    INSERT INTO public.billing_ledger_events (
        company_id,
        subscription_id,
        payment_id,
        event_type,
        event_source,
        occurred_at,
        recorded_at,
        actor_profile_id,
        deduplication_key,
        event_data
    ) VALUES (
        p_company_id,
        v_subscription.id,
        v_new_payment.id,
        'payment_initiated'::pg_catalog.text,
        'user'::pg_catalog.text,
        v_now,
        v_now,
        v_caller_id,
        'payment_initiated:' || v_new_payment.id::pg_catalog.text,
        pg_catalog.jsonb_build_object(
            'payment_id',
            v_new_payment.id,
            'provider_reference',
            v_provider_reference,
            'provider',
            v_provider_plan.provider,
            'environment',
            v_provider_plan.environment,
            'purpose',
            v_purpose,
            'plan_code',
            v_plan.code,
            'amount_minor',
            v_provider_plan.amount_minor,
            'currency',
            v_provider_plan.currency,
            'provider_plan_code',
            v_provider_plan.provider_plan_code,
            'subscription_status_prior',
            v_subscription.status
        )
    );

    -- 16. Return only the fields required by the Edge Function.
    RETURN QUERY
    SELECT
        v_new_payment.id,
        v_new_payment.subscription_id,
        v_new_payment.provider_plan_mapping_id,
        v_provider_plan.provider_plan_code,
        v_new_payment.provider,
        v_new_payment.environment,
        v_new_payment.purpose,
        v_new_payment.provider_reference,
        v_new_payment.amount_minor,
        v_new_payment.currency,
        v_new_payment.customer_email,
        v_new_payment.status,
        v_new_payment.checkout_url,
        FALSE;

    RETURN;
END;
$initialize_billing_checkout$;

REVOKE ALL
ON FUNCTION public.initialize_billing_checkout(
    pg_catalog.uuid,
    pg_catalog.uuid
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.initialize_billing_checkout(
    pg_catalog.uuid,
    pg_catalog.uuid
)
TO authenticated;

COMMENT ON FUNCTION public.initialize_billing_checkout(
    pg_catalog.uuid,
    pg_catalog.uuid
) IS
'Atomically creates or returns an idempotent Paystack checkout intent for an authorized company billing member.';


-- ============================================================================
-- ProjectMatrix Billing Phase 3A.2 — Step 3A
-- Description: Creates an atomic, idempotent Paystack checkout session
--              recording RPC.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_paystack_checkout_session(
    p_payment_id pg_catalog.uuid,
    p_provider_reference pg_catalog.text,
    p_checkout_url pg_catalog.text,
    p_access_code pg_catalog.text
)
RETURNS TABLE (
    payment_id pg_catalog.uuid,
    provider_reference pg_catalog.text,
    payment_status pg_catalog.text,
    checkout_url pg_catalog.text,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $record_paystack_checkout_session$
DECLARE
    v_payment public.billing_payments%ROWTYPE;
    v_now pg_catalog.timestamptz;
    v_deduplication_key pg_catalog.text;
BEGIN
    -- 1. Reject null parameters.
    IF p_payment_id IS NULL THEN
        RAISE EXCEPTION
            'Payment ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    IF p_provider_reference IS NULL THEN
        RAISE EXCEPTION
            'Provider reference cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    IF p_checkout_url IS NULL THEN
        RAISE EXCEPTION
            'Checkout URL cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    IF p_access_code IS NULL THEN
        RAISE EXCEPTION
            'Access code cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- 2. Reject empty values and surrounding whitespace. Values received from
    --    Paystack must be stored exactly; this function never normalizes them.
    IF pg_catalog.char_length(p_provider_reference) = 0
       OR p_provider_reference IS DISTINCT FROM
            pg_catalog.btrim(p_provider_reference)
    THEN
        RAISE EXCEPTION
            'Provider reference cannot be empty or contain surrounding whitespace.'
            USING ERRCODE = '22000';
    END IF;

    IF pg_catalog.char_length(p_checkout_url) = 0
       OR p_checkout_url IS DISTINCT FROM
            pg_catalog.btrim(p_checkout_url)
    THEN
        RAISE EXCEPTION
            'Checkout URL cannot be empty or contain surrounding whitespace.'
            USING ERRCODE = '22000';
    END IF;

    IF pg_catalog.char_length(p_access_code) = 0
       OR p_access_code IS DISTINCT FROM
            pg_catalog.btrim(p_access_code)
    THEN
        RAISE EXCEPTION
            'Access code cannot be empty or contain surrounding whitespace.'
            USING ERRCODE = '22000';
    END IF;

    -- 3. Reject embedded whitespace and control characters in provider values.
    IF p_checkout_url ~ '[[:space:][:cntrl:]]' THEN
        RAISE EXCEPTION
            'Checkout URL cannot contain whitespace or control characters.'
            USING ERRCODE = '22000';
    END IF;

    IF p_access_code ~ '[[:space:][:cntrl:]]' THEN
        RAISE EXCEPTION
            'Access code cannot contain whitespace or control characters.'
            USING ERRCODE = '22000';
    END IF;

    -- 4. Enforce expected formats and reasonable storage bounds.
    IF p_provider_reference !~ '^PAY-[0-9]{8}-[0-9A-F]{32}$' THEN
        RAISE EXCEPTION
            'Invalid provider reference format: %.',
            p_provider_reference
            USING ERRCODE = '22000';
    END IF;

    IF p_checkout_url !~ '^https://checkout[.]paystack[.]com/' THEN
        RAISE EXCEPTION
            'Checkout URL must begin with "https://checkout.paystack.com/".'
            USING ERRCODE = '22000';
    END IF;

    IF pg_catalog.char_length(p_checkout_url) > 2048 THEN
        RAISE EXCEPTION
            'Checkout URL exceeds the maximum length of 2048 characters.'
            USING ERRCODE = '22000';
    END IF;

    IF pg_catalog.char_length(p_access_code) > 255 THEN
        RAISE EXCEPTION
            'Access code exceeds the maximum length of 255 characters.'
            USING ERRCODE = '22000';
    END IF;

    -- 5. Lock the target payment for the complete state evaluation, update and
    --    ledger append transaction.
    SELECT payment.*
    INTO v_payment
    FROM public.billing_payments AS payment
    WHERE payment.id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Billing payment with ID % was not found.',
            p_payment_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 6. Confirm that the response belongs to this Paystack payment.
    IF v_payment.provider IS DISTINCT FROM 'paystack' THEN
        RAISE EXCEPTION
            'Payment % uses provider "%"; only "paystack" is supported.',
            p_payment_id,
            v_payment.provider
            USING ERRCODE = '22023';
    END IF;

    IF v_payment.provider_reference IS DISTINCT FROM
        p_provider_reference
    THEN
        RAISE EXCEPTION
            'Provider reference "%" does not match payment %.',
            p_provider_reference,
            p_payment_id
            USING ERRCODE = '23514';
    END IF;

    v_deduplication_key :=
        'payment_pending:' || v_payment.id::pg_catalog.text;

    -- 7. An exact replay of an already-recorded session is a no-op.
    IF v_payment.status = 'pending' THEN
        IF v_payment.checkout_url IS DISTINCT FROM p_checkout_url
           OR v_payment.access_code IS DISTINCT FROM p_access_code
        THEN
            RAISE EXCEPTION
                'Conflicting checkout session details for pending payment %.',
                p_payment_id
                USING ERRCODE = '23505';
        END IF;

        -- A replay is valid only if the deduplication key identifies the exact
        -- ledger event expected for this payment and tenant scope.
        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_deduplication_key
              AND event.payment_id IS NOT DISTINCT FROM v_payment.id
              AND event.company_id IS NOT DISTINCT FROM
                    v_payment.company_id
              AND event.subscription_id IS NOT DISTINCT FROM
                    v_payment.subscription_id
              AND event.event_type = 'payment_pending'
              AND event.event_source = 'system'
        ) THEN
            NULL;

        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_deduplication_key
        ) THEN
            RAISE EXCEPTION
                'Ledger deduplication key collision for payment %.',
                p_payment_id
                USING ERRCODE = '23505';

        ELSE
            -- Repair a genuinely missing event. If a concurrent or malformed
            -- row claims the key, the unique index raises and this call rolls
            -- back instead of silently accepting the collision.
            v_now := pg_catalog.now();

            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_payment.company_id,
                v_payment.subscription_id,
                v_payment.id,
                'payment_pending',
                'system',
                v_now,
                v_now,
                v_payment.initiated_by_profile_id,
                v_deduplication_key,
                pg_catalog.jsonb_build_object(
                    'payment_id',
                    v_payment.id,
                    'provider_reference',
                    v_payment.provider_reference,
                    'provider',
                    v_payment.provider,
                    'environment',
                    v_payment.environment,
                    'purpose',
                    v_payment.purpose,
                    'status',
                    'pending'
                )
            );
        END IF;

        RETURN QUERY
        SELECT
            v_payment.id,
            v_payment.provider_reference,
            v_payment.status,
            v_payment.checkout_url,
            TRUE;

        RETURN;
    END IF;

    -- 8. Only an initialized payment may create a checkout session.
    IF v_payment.status IN ('succeeded', 'failed', 'cancelled') THEN
        RAISE EXCEPTION
            'Payment % is in terminal state "%".',
            p_payment_id,
            v_payment.status
            USING ERRCODE = '23514';

    ELSIF v_payment.status <> 'initialized' THEN
        RAISE EXCEPTION
            'Payment % is in invalid checkout state "%".',
            p_payment_id,
            v_payment.status
            USING ERRCODE = '23514';
    END IF;

    IF v_payment.checkout_url IS NOT NULL
       OR v_payment.access_code IS NOT NULL
    THEN
        RAISE EXCEPTION
            'Initialized payment % already contains checkout details.',
            p_payment_id
            USING ERRCODE = '23514';
    END IF;

    -- 9. Persist the Paystack session and append the linked ledger event in
    --    this single database transaction.
    v_now := pg_catalog.now();

    UPDATE public.billing_payments AS payment
    SET
        status = 'pending',
        checkout_url = p_checkout_url,
        access_code = p_access_code
    WHERE payment.id = v_payment.id
      AND payment.status = 'initialized'
    RETURNING payment.*
    INTO v_payment;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Payment % could not transition from initialized to pending.',
            p_payment_id
            USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.billing_ledger_events (
        company_id,
        subscription_id,
        payment_id,
        event_type,
        event_source,
        occurred_at,
        recorded_at,
        actor_profile_id,
        deduplication_key,
        event_data
    ) VALUES (
        v_payment.company_id,
        v_payment.subscription_id,
        v_payment.id,
        'payment_pending',
        'system',
        v_now,
        v_now,
        v_payment.initiated_by_profile_id,
        v_deduplication_key,
        pg_catalog.jsonb_build_object(
            'payment_id',
            v_payment.id,
            'provider_reference',
            v_payment.provider_reference,
            'provider',
            v_payment.provider,
            'environment',
            v_payment.environment,
            'purpose',
            v_payment.purpose,
            'status',
            v_payment.status
        )
    );

    -- 10. Return only the Edge Function contract. access_code is deliberately
    --     stored but never returned by this RPC.
    RETURN QUERY
    SELECT
        v_payment.id,
        v_payment.provider_reference,
        v_payment.status,
        v_payment.checkout_url,
        FALSE;

    RETURN;
END;
$record_paystack_checkout_session$;

REVOKE ALL
ON FUNCTION public.record_paystack_checkout_session(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.record_paystack_checkout_session(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text
)
TO service_role;

COMMENT ON FUNCTION public.record_paystack_checkout_session(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text
) IS
'Atomically records an active Paystack checkout session and transitions an initialized payment to pending.';


CREATE OR REPLACE FUNCTION public.process_paystack_charge_success(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_reference pg_catalog.text,
    p_provider_transaction_id pg_catalog.text,
    p_amount_minor pg_catalog.int4,
    p_currency pg_catalog.text,
    p_paid_at pg_catalog.timestamptz,
    p_provider_plan_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_customer_email pg_catalog.text DEFAULT NULL,
    p_authorization_code pg_catalog.text DEFAULT NULL,
    p_card_type pg_catalog.text DEFAULT NULL,
    p_last4 pg_catalog.text DEFAULT NULL,
    p_exp_month pg_catalog.text DEFAULT NULL,
    p_exp_year pg_catalog.text DEFAULT NULL,
    p_bank pg_catalog.text DEFAULT NULL,
    p_channel pg_catalog.text DEFAULT NULL,
    p_reusable pg_catalog.bool DEFAULT FALSE
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    payment_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    payment_status pg_catalog.text,
    subscription_status pg_catalog.text,
    payment_method_id pg_catalog.uuid,
    processing_status pg_catalog.text,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_charge_success$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_reference pg_catalog.text;
    v_provider_transaction_id pg_catalog.text;
    v_currency pg_catalog.text;
    v_reusable pg_catalog.bool;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_webhook_event_id pg_catalog.uuid;
    v_is_reused pg_catalog.bool := FALSE;

    v_payment public.billing_payments%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;
    v_provider_plan public.billing_provider_plans%ROWTYPE;

    v_period_start pg_catalog.timestamptz;
    v_period_end pg_catalog.timestamptz;
    v_next_renewal pg_catalog.timestamptz;
    v_final_subscription_status pg_catalog.text;

    v_payment_method_id pg_catalog.uuid := NULL;
    v_existing_pm public.billing_payment_methods%ROWTYPE;

    v_payment_ledger_key pg_catalog.text;
    v_subscription_ledger_key pg_catalog.text;
    v_exp_month_int pg_catalog.int2;
    v_exp_year_int pg_catalog.int2;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL OR p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-fA-F]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := pg_catalog.lower(p_payload_sha256);

    IF p_provider_reference IS NULL OR p_provider_reference !~ '^PAY-[0-9]{8}-[0-9A-F]{32}$' THEN
        RAISE EXCEPTION 'Invalid provider reference format "%".', p_provider_reference
            USING ERRCODE = '22023';
    END IF;
    v_provider_reference := p_provider_reference;

    IF p_provider_transaction_id IS NULL OR p_provider_transaction_id !~ '^[0-9]{1,20}$' THEN
        RAISE EXCEPTION 'Invalid provider transaction ID "%".', p_provider_transaction_id
            USING ERRCODE = '22023';
    END IF;

    IF pg_catalog.char_length(p_provider_transaction_id) = 20 AND p_provider_transaction_id > '18446744073709551615' THEN
        RAISE EXCEPTION 'Provider transaction ID "%" exceeds unsigned 64-bit integer limit.', p_provider_transaction_id
            USING ERRCODE = '22023';
    END IF;
    v_provider_transaction_id := p_provider_transaction_id;

    IF p_amount_minor IS NULL OR p_amount_minor <= 0 OR p_amount_minor > 2147483647 THEN
        RAISE EXCEPTION 'Invalid amount % minor units.', p_amount_minor
            USING ERRCODE = '22023';
    END IF;

    IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Invalid currency "%". Must be 3 uppercase letters.', p_currency
            USING ERRCODE = '22023';
    END IF;
    v_currency := p_currency;

    IF p_paid_at IS NULL THEN
        RAISE EXCEPTION 'p_paid_at timestamp is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_plan_code IS NOT NULL AND (
        p_provider_plan_code ~ '[[:cntrl:][:space:]]' OR p_provider_plan_code !~ '^PLN_[A-Za-z0-9]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid provider plan code format "%".', p_provider_plan_code
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_customer_code IS NOT NULL AND (
        p_provider_customer_code ~ '[[:cntrl:][:space:]]' OR p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;

    IF p_customer_email IS NOT NULL AND (
        p_customer_email ~ '[[:cntrl:][:space:]]' OR p_customer_email !~ '^[^@]+@[^@]+\.[^@]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid customer email.'
            USING ERRCODE = '22023';
    END IF;

    IF p_authorization_code IS NOT NULL AND (
        p_authorization_code ~ '[[:cntrl:][:space:]]' OR p_authorization_code !~ '^AUTH_[A-Za-z0-9]+$'
    ) THEN
        RAISE EXCEPTION 'Invalid authorization code format.'
            USING ERRCODE = '22023';
    END IF;

    IF p_last4 IS NOT NULL AND p_last4 !~ '^[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid last4 digits.'
            USING ERRCODE = '22023';
    END IF;

    IF p_exp_month IS NOT NULL AND p_exp_month !~ '^(0[1-9]|1[0-2]|[1-9])$' THEN
        RAISE EXCEPTION 'Invalid expiry month.'
            USING ERRCODE = '22023';
    END IF;

    IF p_exp_year IS NOT NULL AND p_exp_year !~ '^(20[2-9][0-9]|[0-9]{2})$' THEN
        RAISE EXCEPTION 'Invalid expiry year.'
            USING ERRCODE = '22023';
    END IF;

    v_reusable := COALESCE(p_reusable, FALSE);

    -- 2. Webhook Inbox Lookup & Locking (Deterministic Order)
    SELECT *
    INTO v_existing_webhook
    FROM public.billing_webhook_events
    WHERE provider = 'paystack'
      AND environment = v_environment
      AND payload_sha256 = v_payload_sha256
    FOR UPDATE;

    IF FOUND THEN
        -- Check for payload hash collision with conflicting identifiers
        IF v_existing_webhook.event_type <> 'charge.success'
           OR (v_existing_webhook.raw_payload->>'provider_reference') IS DISTINCT FROM v_provider_reference
           OR (v_existing_webhook.raw_payload->>'provider_transaction_id') IS DISTINCT FROM v_provider_transaction_id
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        v_webhook_event_id := v_existing_webhook.id;
        IF v_existing_webhook.processing_status = 'processed' THEN
            v_is_reused := TRUE;
        ELSE
            UPDATE public.billing_webhook_events
            SET processing_status = 'processing',
                processing_attempts = processing_attempts + 1,
                updated_at = v_now
            WHERE id = v_webhook_event_id;
        END IF;
    ELSE
        INSERT INTO public.billing_webhook_events (
            provider,
            environment,
            event_type,
            provider_event_id,
            provider_object_id,
            payload_sha256,
            raw_payload,
            signature_verified,
            processing_status,
            processing_attempts,
            received_at,
            processing_started_at,
            updated_at
        ) VALUES (
            'paystack',
            v_environment,
            'charge.success',
            'txn_' || v_provider_transaction_id,
            v_provider_reference,
            v_payload_sha256,
            pg_catalog.jsonb_build_object(
                'event_type', 'charge.success',
                'provider_reference', v_provider_reference,
                'provider_transaction_id', v_provider_transaction_id
            ),
            TRUE,
            'processing',
            1,
            v_now,
            v_now,
            v_now
        )
        RETURNING id INTO v_webhook_event_id;
    END IF;

    -- 3. Lock & Correlate Authoritative Payment Record
    SELECT *
    INTO v_payment
    FROM public.billing_payments
    WHERE provider = 'paystack'
      AND environment = v_environment
      AND provider_reference = v_provider_reference
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment with provider reference "%" not found in % environment.',
            v_provider_reference, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    -- 4. Lock Matched Subscription
    SELECT *
    INTO v_subscription
    FROM public.billing_subscriptions
    WHERE id = v_payment.subscription_id
      AND company_id = v_payment.company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription % not found for payment %.',
            v_payment.subscription_id, v_payment.id
            USING ERRCODE = 'P0002';
    END IF;

    -- 5. Commercial Verification Against Database Snapshot
    IF v_payment.amount_minor <> p_amount_minor THEN
        RAISE EXCEPTION 'Commercial mismatch: amount % does not match expected payment amount %.',
            p_amount_minor, v_payment.amount_minor
            USING ERRCODE = '23514';
    END IF;

    IF v_payment.currency <> v_currency THEN
        RAISE EXCEPTION 'Commercial mismatch: currency % does not match expected payment currency %.',
            v_currency, v_payment.currency
            USING ERRCODE = '23514';
    END IF;

    IF p_customer_email IS NOT NULL AND
       pg_catalog.lower(pg_catalog.btrim(p_customer_email)) <> pg_catalog.lower(pg_catalog.btrim(v_payment.customer_email))
    THEN
        RAISE EXCEPTION 'Commercial mismatch: customer email does not match payment scope.'
            USING ERRCODE = '23514';
    END IF;

    -- Verify Provider Plan Mapping
    SELECT *
    INTO v_provider_plan
    FROM public.billing_provider_plans
    WHERE id = v_payment.provider_plan_mapping_id
      AND plan_id = v_payment.plan_id
      AND provider = 'paystack'
      AND environment = v_environment;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider plan mapping % not found for payment %.',
            v_payment.provider_plan_mapping_id, v_payment.id
            USING ERRCODE = 'P0002';
    END IF;

    IF p_provider_plan_code IS NOT NULL AND v_provider_plan.provider_plan_code IS DISTINCT FROM p_provider_plan_code THEN
        RAISE EXCEPTION 'Provider plan code "%" does not match mapping "%".',
            p_provider_plan_code, v_provider_plan.provider_plan_code
            USING ERRCODE = '23514';
    END IF;

    -- 6. Payment State Handling
    IF v_payment.status = 'succeeded' THEN
        -- If already succeeded, treat as replay
        v_is_reused := TRUE;
    ELSE
        -- Update payment to succeeded
        UPDATE public.billing_payments
        SET status = 'succeeded',
            provider_transaction_id = v_provider_transaction_id,
            paid_at = p_paid_at,
            failed_at = NULL,
            cancelled_at = NULL,
            error_code = NULL,
            error_message = NULL,
            updated_at = v_now
        WHERE id = v_payment.id;
    END IF;

    -- 7. Subscription Transition
    v_final_subscription_status := v_subscription.status;

    IF v_payment.purpose = 'activation' THEN
        IF v_payment.status <> 'succeeded' OR v_subscription.status IN ('pending_activation', 'trialing', 'expired') THEN
            v_period_start := p_paid_at;
            v_period_end := p_paid_at + INTERVAL '1 month';
            v_next_renewal := v_period_end;
            v_final_subscription_status := 'active';

            UPDATE public.billing_subscriptions
            SET status = 'active',
                current_period_start = v_period_start,
                current_period_end = v_period_end,
                next_renewal_at = v_next_renewal,
                auto_renew_enabled = TRUE,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
    ELSIF v_payment.purpose = 'renewal' THEN
        IF v_payment.status <> 'succeeded' OR v_subscription.status IN ('past_due', 'non_renewing') THEN
            IF v_subscription.current_period_end IS NOT NULL AND v_subscription.current_period_end > p_paid_at THEN
                v_period_start := v_subscription.current_period_end;
                v_period_end := v_subscription.current_period_end + INTERVAL '1 month';
            ELSE
                v_period_start := p_paid_at;
                v_period_end := p_paid_at + INTERVAL '1 month';
            END IF;
            v_next_renewal := v_period_end;
            v_final_subscription_status := 'active';

            UPDATE public.billing_subscriptions
            SET status = 'active',
                current_period_start = v_period_start,
                current_period_end = v_period_end,
                next_renewal_at = v_next_renewal,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unrecognized payment purpose "%".', v_payment.purpose
            USING ERRCODE = '23514';
    END IF;

    -- 8. Payment Method Handling
    IF v_reusable AND p_authorization_code IS NOT NULL AND pg_catalog.char_length(pg_catalog.btrim(p_authorization_code)) > 0 THEN
        IF p_card_type IS NULL OR p_last4 IS NULL OR p_exp_month IS NULL OR p_exp_year IS NULL THEN
            RAISE EXCEPTION 'Missing required card authorization details for reusable payment method.'
                USING ERRCODE = '22023';
        END IF;

        v_exp_month_int := p_exp_month::pg_catalog.int2;
        IF pg_catalog.char_length(p_exp_year) = 2 THEN
            v_exp_year_int := (2000 + p_exp_year::pg_catalog.int2)::pg_catalog.int2;
        ELSE
            v_exp_year_int := p_exp_year::pg_catalog.int2;
        END IF;

        -- Check if authorization_code already exists for provider & environment
        SELECT *
        INTO v_existing_pm
        FROM public.billing_payment_methods
        WHERE provider = 'paystack'
          AND environment = v_environment
          AND authorization_code = p_authorization_code
        FOR UPDATE;

        IF FOUND THEN
            IF v_existing_pm.company_id <> v_payment.company_id THEN
                RAISE EXCEPTION 'Payment method authorization code is already registered to another company.'
                    USING ERRCODE = '23505';
            END IF;

            UPDATE public.billing_payment_methods
            SET provider_customer_code = COALESCE(p_provider_customer_code, v_existing_pm.provider_customer_code),
                customer_email = v_payment.customer_email,
                card_type = p_card_type,
                brand = p_card_type,
                last4 = p_last4,
                expiry_month = v_exp_month_int,
                expiry_year = v_exp_year_int,
                bank = p_bank,
                channel = COALESCE(p_channel, 'card'),
                reusable = TRUE,
                is_active = TRUE,
                updated_at = v_now
            WHERE id = v_existing_pm.id;

            v_payment_method_id := v_existing_pm.id;
        ELSE
            INSERT INTO public.billing_payment_methods (
                company_id,
                source_payment_id,
                provider,
                environment,
                provider_customer_code,
                customer_email,
                authorization_code,
                authorization_signature,
                channel,
                card_type,
                brand,
                bank,
                last4,
                expiry_month,
                expiry_year,
                country_code,
                reusable,
                is_default,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                v_payment.company_id,
                v_payment.id,
                'paystack',
                v_environment,
                COALESCE(p_provider_customer_code, 'CUS_' || v_payment.company_id::pg_catalog.text),
                v_payment.customer_email,
                p_authorization_code,
                'SIG_' || p_authorization_code,
                COALESCE(p_channel, 'card'),
                p_card_type,
                p_card_type,
                p_bank,
                p_last4,
                v_exp_month_int,
                v_exp_year_int,
                'ZA',
                TRUE,
                TRUE,
                TRUE,
                v_now,
                v_now
            )
            RETURNING id INTO v_payment_method_id;
        END IF;
    END IF;

    -- 9. Immutable Ledger Linkage
    v_payment_ledger_key := 'payment_succeeded:' || v_payment.id::pg_catalog.text;

    IF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_payment_ledger_key
          AND event.payment_id IS NOT DISTINCT FROM v_payment.id
          AND event.company_id IS NOT DISTINCT FROM v_payment.company_id
          AND event.subscription_id IS NOT DISTINCT FROM v_payment.subscription_id
          AND event.event_type = 'payment_succeeded'
          AND event.event_source = 'paystack_webhook'
    ) THEN
        NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_payment_ledger_key
    ) THEN
        RAISE EXCEPTION 'Ledger deduplication key collision for payment %.', v_payment.id
            USING ERRCODE = '23505';
    ELSE
        INSERT INTO public.billing_ledger_events (
            company_id,
            subscription_id,
            payment_id,
            event_type,
            event_source,
            occurred_at,
            recorded_at,
            actor_profile_id,
            deduplication_key,
            event_data
        ) VALUES (
            v_payment.company_id,
            v_payment.subscription_id,
            v_payment.id,
            'payment_succeeded',
            'paystack_webhook',
            p_paid_at,
            v_now,
            v_payment.initiated_by_profile_id,
            v_payment_ledger_key,
            pg_catalog.jsonb_build_object(
                'payment_id', v_payment.id,
                'provider_reference', v_payment.provider_reference,
                'provider_transaction_id', v_provider_transaction_id,
                'provider', v_payment.provider,
                'environment', v_payment.environment,
                'purpose', v_payment.purpose,
                'status', 'succeeded',
                'amount_minor', v_payment.amount_minor,
                'currency', v_payment.currency
            )
        );
    END IF;

    -- Subscription Ledger Event
    IF v_payment.purpose = 'activation' THEN
        v_subscription_ledger_key := 'subscription_activated:' || v_subscription.id::pg_catalog.text || ':' || v_payment.id::pg_catalog.text;

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_subscription_ledger_key
              AND event.payment_id IS NOT DISTINCT FROM v_payment.id
              AND event.company_id IS NOT DISTINCT FROM v_payment.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = 'subscription_activated'
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_subscription_ledger_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for subscription %.', v_subscription.id
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_payment.company_id,
                v_subscription.id,
                v_payment.id,
                'subscription_activated',
                'paystack_webhook',
                p_paid_at,
                v_now,
                v_payment.initiated_by_profile_id,
                v_subscription_ledger_key,
                pg_catalog.jsonb_build_object(
                    'subscription_id', v_subscription.id,
                    'payment_id', v_payment.id,
                    'plan_id', v_payment.plan_id,
                    'company_id', v_payment.company_id,
                    'status', 'active',
                    'current_period_start', v_period_start,
                    'current_period_end', v_period_end,
                    'next_renewal_at', v_next_renewal
                )
            );
        END IF;
    ELSIF v_payment.purpose = 'renewal' THEN
        v_subscription_ledger_key := 'subscription_renewed:' || v_subscription.id::pg_catalog.text || ':' || v_payment.id::pg_catalog.text;

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_subscription_ledger_key
              AND event.payment_id IS NOT DISTINCT FROM v_payment.id
              AND event.company_id IS NOT DISTINCT FROM v_payment.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = 'subscription_renewed'
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_subscription_ledger_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for subscription %.', v_subscription.id
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_payment.company_id,
                v_subscription.id,
                v_payment.id,
                'subscription_renewed',
                'paystack_webhook',
                p_paid_at,
                v_now,
                v_payment.initiated_by_profile_id,
                v_subscription_ledger_key,
                pg_catalog.jsonb_build_object(
                    'subscription_id', v_subscription.id,
                    'payment_id', v_payment.id,
                    'plan_id', v_payment.plan_id,
                    'company_id', v_payment.company_id,
                    'status', 'active',
                    'current_period_start', v_period_start,
                    'current_period_end', v_period_end,
                    'next_renewal_at', v_next_renewal
                )
            );
        END IF;
    END IF;

    -- 10. Mark Webhook Event as Processed
    UPDATE public.billing_webhook_events
    SET processing_status = 'processed',
        processed_at = v_now,
        updated_at = v_now
    WHERE id = v_webhook_event_id;

    -- 11. Return Strict Safe Return Contract
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_payment.id,
        v_subscription.id,
        'succeeded'::pg_catalog.text,
        v_final_subscription_status,
        v_payment_method_id,
        'processed'::pg_catalog.text,
        v_is_reused;

    RETURN;
END;
$process_paystack_charge_success$;

REVOKE ALL
ON FUNCTION public.process_paystack_charge_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_charge_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_charge_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool
) IS
'Atomically processes an authenticated and signature-verified Paystack charge.success webhook event, finalising payment and subscription state.';


-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4B-1: Paystack Subscription Create Linking RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_paystack_subscription_create(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_id pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_id pg_catalog.text DEFAULT NULL,
    p_customer_email pg_catalog.text DEFAULT NULL,
    p_provider_plan_code pg_catalog.text DEFAULT NULL,
    p_amount_minor pg_catalog.int4 DEFAULT NULL,
    p_currency pg_catalog.text DEFAULT NULL,
    p_authorization_code pg_catalog.text DEFAULT NULL,
    p_authorization_signature pg_catalog.text DEFAULT NULL,
    p_email_token pg_catalog.text DEFAULT NULL,
    p_provider_status pg_catalog.text DEFAULT NULL,
    p_next_payment_at pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    payment_id pg_catalog.uuid,
    provider_subscription_code pg_catalog.text,
    provider_status pg_catalog.text,
    is_reused pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_subscription_create$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_subscription_code pg_catalog.text;
    v_provider_subscription_id pg_catalog.text;
    v_provider_customer_code pg_catalog.text;
    v_provider_customer_id pg_catalog.text;
    v_normalized_email pg_catalog.text;
    v_provider_plan_code pg_catalog.text;
    v_currency pg_catalog.text;
    v_authorization_code pg_catalog.text;
    v_authorization_signature pg_catalog.text;
    v_email_token pg_catalog.text;
    v_provider_status pg_catalog.text;
    v_provider_event_id pg_catalog.text;

    v_existing_prov_sub public.billing_provider_subscriptions%ROWTYPE;
    v_existing_current_sub public.billing_provider_subscriptions%ROWTYPE;
    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_prov_plan public.billing_provider_plans%ROWTYPE;
    v_pm public.billing_payment_methods%ROWTYPE;

    v_match_count pg_catalog.int4 := 0;
    v_match_record RECORD;
    v_payment_method_id pg_catalog.uuid;
    v_company_id pg_catalog.uuid;
    v_payment_id pg_catalog.uuid;
    v_subscription_id pg_catalog.uuid;
    v_plan_id pg_catalog.uuid;
    v_provider_plan_mapping_id pg_catalog.uuid;

    v_subscription public.billing_subscriptions%ROWTYPE;
    v_payment public.billing_payments%ROWTYPE;
    v_payment_method public.billing_payment_methods%ROWTYPE;

    v_new_provider_subscription_id pg_catalog.uuid;
    v_webhook_event_id pg_catalog.uuid;
    v_ledger_dedup_key pg_catalog.text;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL OR p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 lowercase hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := p_payload_sha256;

    IF p_provider_subscription_code IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_subscription_code)) = 0
       OR p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_subscription_code := pg_catalog.btrim(p_provider_subscription_code);

    IF p_provider_subscription_id IS NOT NULL THEN
        IF pg_catalog.char_length(pg_catalog.btrim(p_provider_subscription_id)) = 0
           OR p_provider_subscription_id !~ '^[0-9]+$'
        THEN
            RAISE EXCEPTION 'Invalid provider subscription ID "%". Must be decimal digits string.', p_provider_subscription_id
                USING ERRCODE = '22023';
        END IF;
        v_provider_subscription_id := pg_catalog.btrim(p_provider_subscription_id);
    ELSE
        v_provider_subscription_id := NULL;
    END IF;

    IF p_provider_customer_code IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_customer_code)) = 0
       OR p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_customer_code := pg_catalog.btrim(p_provider_customer_code);

    IF p_provider_customer_id IS NOT NULL THEN
        IF pg_catalog.char_length(pg_catalog.btrim(p_provider_customer_id)) = 0
           OR p_provider_customer_id !~ '^[0-9]+$'
        THEN
            RAISE EXCEPTION 'Invalid provider customer ID "%". Must be decimal digits string.', p_provider_customer_id
                USING ERRCODE = '22023';
        END IF;
        v_provider_customer_id := pg_catalog.btrim(p_provider_customer_id);
    ELSE
        v_provider_customer_id := NULL;
    END IF;

    IF p_customer_email IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_customer_email)) = 0
       OR p_customer_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    THEN
        RAISE EXCEPTION 'Invalid customer email format.'
            USING ERRCODE = '22023';
    END IF;
    v_normalized_email := pg_catalog.lower(pg_catalog.btrim(p_customer_email));

    IF p_provider_plan_code IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_plan_code)) = 0
       OR p_provider_plan_code !~ '^PLN_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid provider plan code format "%".', p_provider_plan_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_plan_code := pg_catalog.btrim(p_provider_plan_code);

    IF p_amount_minor IS NULL OR p_amount_minor <= 0 OR p_amount_minor > 2147483647 THEN
        RAISE EXCEPTION 'Invalid amount % minor units.', p_amount_minor
            USING ERRCODE = '22023';
    END IF;

    IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Invalid currency "%". Must be 3 uppercase letters.', p_currency
            USING ERRCODE = '22023';
    END IF;
    v_currency := p_currency;

    IF p_authorization_code IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_authorization_code)) = 0
       OR p_authorization_code !~ '^AUTH_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid authorization code format.'
            USING ERRCODE = '22023';
    END IF;
    v_authorization_code := pg_catalog.btrim(p_authorization_code);

    IF p_authorization_signature IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_authorization_signature)) = 0
       OR p_authorization_signature !~ '^SIG_[A-Za-z0-9]+$'
    THEN
        RAISE EXCEPTION 'Invalid authorization signature format.'
            USING ERRCODE = '22023';
    END IF;
    v_authorization_signature := pg_catalog.btrim(p_authorization_signature);

    IF p_email_token IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_email_token)) = 0
    THEN
        RAISE EXCEPTION 'Email token must not be empty.'
            USING ERRCODE = '22023';
    END IF;
    v_email_token := pg_catalog.btrim(p_email_token);

    IF p_provider_status IS NULL OR pg_catalog.btrim(p_provider_status) <> 'active' THEN
        RAISE EXCEPTION 'Invalid provider status "%". Must be "active".', p_provider_status
            USING ERRCODE = '22023';
    END IF;
    v_provider_status := pg_catalog.btrim(p_provider_status);

    IF p_next_payment_at IS NULL THEN
        RAISE EXCEPTION 'p_next_payment_at timestamp is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_event_id IS NOT NULL THEN
        IF pg_catalog.char_length(pg_catalog.btrim(p_provider_event_id)) = 0 THEN
            RAISE EXCEPTION 'p_provider_event_id must not be empty when provided.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_event_id := pg_catalog.btrim(p_provider_event_id);
    ELSE
        v_provider_event_id := NULL;
    END IF;

    -- 2. Check for Exact Replay of Existing Provider Subscription
    SELECT *
    INTO v_existing_prov_sub
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.provider_subscription_code = v_provider_subscription_code
    FOR UPDATE;

    IF FOUND THEN
        -- Verify that all immutable identity and commercial fields match exactly
        IF v_existing_prov_sub.provider_customer_code <> v_provider_customer_code
           OR pg_catalog.lower(pg_catalog.btrim(v_existing_prov_sub.customer_email)) <> v_normalized_email
           OR v_existing_prov_sub.email_token <> v_email_token
           OR (v_provider_subscription_id IS NOT NULL AND v_existing_prov_sub.provider_subscription_id IS NOT NULL AND v_existing_prov_sub.provider_subscription_id <> v_provider_subscription_id)
           OR (v_provider_customer_id IS NOT NULL AND v_existing_prov_sub.provider_customer_id IS NOT NULL AND v_existing_prov_sub.provider_customer_id <> v_provider_customer_id)
        THEN
            RAISE EXCEPTION 'Conflicting reuse for provider subscription code %.', v_provider_subscription_code
                USING ERRCODE = '23505';
        END IF;

        -- Verify linked provider plan commercial snapshot
        SELECT *
        INTO v_prov_plan
        FROM public.billing_provider_plans AS bpp
        WHERE bpp.id = v_existing_prov_sub.provider_plan_mapping_id;

        IF NOT FOUND
           OR v_prov_plan.provider_plan_code <> v_provider_plan_code
           OR v_prov_plan.amount_minor <> p_amount_minor
           OR v_prov_plan.currency <> v_currency
        THEN
            RAISE EXCEPTION 'Conflicting commercial snapshot for provider subscription %.', v_provider_subscription_code
                USING ERRCODE = '23505';
        END IF;

        -- Verify linked payment method authorization details
        SELECT *
        INTO v_pm
        FROM public.billing_payment_methods AS bpm
        WHERE bpm.id = v_existing_prov_sub.payment_method_id;

        IF NOT FOUND
           OR v_pm.authorization_code <> v_authorization_code
           OR v_pm.authorization_signature <> v_authorization_signature
        THEN
            RAISE EXCEPTION 'Conflicting payment method for provider subscription %.', v_provider_subscription_code
                USING ERRCODE = '23505';
        END IF;

        -- Deduplicate webhook event inbox
        SELECT *
        INTO v_existing_webhook
        FROM public.billing_webhook_events AS bwe
        WHERE bwe.provider = 'paystack'
          AND bwe.environment = v_environment
          AND (
              bwe.payload_sha256 = v_payload_sha256
              OR (v_provider_event_id IS NOT NULL AND bwe.provider_event_id = v_provider_event_id)
          )
        FOR UPDATE;

        IF FOUND THEN
            IF v_existing_webhook.event_type <> 'subscription.create'
               OR v_existing_webhook.provider_object_id <> v_provider_subscription_code
               OR (v_provider_event_id IS NOT NULL AND v_existing_webhook.provider_event_id IS NOT NULL AND v_existing_webhook.provider_event_id <> v_provider_event_id)
               OR v_existing_webhook.payload_sha256 <> v_payload_sha256
            THEN
                RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_webhook.processing_status <> 'processed' THEN
                UPDATE public.billing_webhook_events AS bwe_upd
                SET processing_status = 'processed',
                    processed_at = v_now,
                    updated_at = v_now
                WHERE bwe_upd.id = v_existing_webhook.id;
            END IF;
        ELSE
            INSERT INTO public.billing_webhook_events (
                provider,
                environment,
                event_type,
                provider_event_id,
                provider_object_id,
                payload_sha256,
                raw_payload,
                signature_verified,
                processing_status,
                processing_attempts,
                received_at,
                processing_started_at,
                processed_at,
                updated_at
            ) VALUES (
                'paystack',
                v_environment,
                'subscription.create',
                v_provider_event_id,
                v_provider_subscription_code,
                v_payload_sha256,
                pg_catalog.jsonb_build_object(
                    'provider', 'paystack',
                    'environment', v_environment,
                    'event_type', 'subscription.create',
                    'provider_subscription_code', v_provider_subscription_code,
                    'provider_subscription_id', v_provider_subscription_id,
                    'provider_customer_code', v_provider_customer_code,
                    'provider_customer_id', v_provider_customer_id,
                    'provider_plan_code', v_provider_plan_code,
                    'amount_minor', p_amount_minor,
                    'currency', v_currency,
                    'provider_status', v_provider_status,
                    'next_payment_at', p_next_payment_at
                ),
                TRUE,
                'processed',
                1,
                p_occurred_at,
                v_now,
                v_now,
                v_now
            );
        END IF;

        -- Return existing provider subscription record safely
        RETURN QUERY
        SELECT
            v_existing_prov_sub.id,
            v_existing_prov_sub.subscription_id,
            v_pm.source_payment_id,
            v_existing_prov_sub.provider_subscription_code,
            v_existing_prov_sub.provider_status,
            TRUE AS is_reused;
        RETURN;
    END IF;

    -- 3. Check for Webhook Hash / Event-ID Collision Prior to Insert
    SELECT *
    INTO v_existing_webhook
    FROM public.billing_webhook_events AS bwe
    WHERE bwe.provider = 'paystack'
      AND bwe.environment = v_environment
      AND (
          bwe.payload_sha256 = v_payload_sha256
          OR (v_provider_event_id IS NOT NULL AND bwe.provider_event_id = v_provider_event_id)
      )
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_webhook.event_type <> 'subscription.create'
           OR v_existing_webhook.provider_object_id <> v_provider_subscription_code
           OR (v_provider_event_id IS NOT NULL AND v_existing_webhook.provider_event_id IS NOT NULL AND v_existing_webhook.provider_event_id <> v_provider_event_id)
           OR v_existing_webhook.payload_sha256 <> v_payload_sha256
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        IF v_existing_webhook.processing_status = 'processed' THEN
            RAISE EXCEPTION 'Webhook event already processed but provider subscription not found.'
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 4. Secure Internal Resolution: Resolve 5-Table Relationship
    FOR v_match_record IN
        SELECT
            pm.id AS payment_method_id,
            pm.company_id AS company_id,
            pm.source_payment_id AS payment_id,
            p.subscription_id AS subscription_id,
            p.plan_id AS plan_id,
            pp.id AS provider_plan_mapping_id
        FROM public.billing_payment_methods AS pm
        JOIN public.billing_payments AS p
            ON p.id = pm.source_payment_id
           AND p.company_id = pm.company_id
           AND p.provider = pm.provider
           AND p.environment = pm.environment
        JOIN public.billing_provider_plans AS pp
            ON pp.id = p.provider_plan_mapping_id
           AND pp.plan_id = p.plan_id
           AND pp.provider = p.provider
           AND pp.environment = p.environment
        JOIN public.billing_subscriptions AS s
            ON s.id = p.subscription_id
           AND s.company_id = p.company_id
           AND s.plan_id = p.plan_id
        WHERE pm.provider = 'paystack'
          AND pm.environment = v_environment
          AND pm.provider_customer_code = v_provider_customer_code
          AND pg_catalog.lower(pg_catalog.btrim(pm.customer_email)) = v_normalized_email
          AND pm.authorization_code = v_authorization_code
          AND pm.authorization_signature = v_authorization_signature
          AND pm.is_active IS TRUE
          AND pm.reusable IS TRUE
          AND p.status = 'succeeded'
          AND p.purpose = 'activation'
          AND pg_catalog.lower(pg_catalog.btrim(p.customer_email)) = v_normalized_email
          AND p.amount_minor = p_amount_minor
          AND p.currency = v_currency
          AND pp.provider_plan_code = v_provider_plan_code
          AND pp.amount_minor = p_amount_minor
          AND pp.currency = v_currency
          AND pp.is_active IS TRUE
        LIMIT 2
    LOOP
        v_match_count := v_match_count + 1;
        v_payment_method_id := v_match_record.payment_method_id;
        v_company_id := v_match_record.company_id;
        v_payment_id := v_match_record.payment_id;
        v_subscription_id := v_match_record.subscription_id;
        v_plan_id := v_match_record.plan_id;
        v_provider_plan_mapping_id := v_match_record.provider_plan_mapping_id;
    END LOOP;

    IF v_match_count = 0 THEN
        RAISE EXCEPTION 'No matching successful activation payment method found for provider subscription in % environment.', v_environment
            USING ERRCODE = 'P0002';
    ELSIF v_match_count > 1 THEN
        RAISE EXCEPTION 'Ambiguous matching relationships (% matches) found for provider subscription.', v_match_count
            USING ERRCODE = '23505';
    END IF;

    -- 5. Lock Resolved Subscription, Payment and Payment Method
    SELECT *
    INTO v_subscription
    FROM public.billing_subscriptions AS s
    WHERE s.id = v_subscription_id
      AND s.company_id = v_company_id
    FOR UPDATE;

    SELECT *
    INTO v_payment
    FROM public.billing_payments AS p
    WHERE p.id = v_payment_id
      AND p.company_id = v_company_id
    FOR UPDATE;

    SELECT *
    INTO v_payment_method
    FROM public.billing_payment_methods AS pm
    WHERE pm.id = v_payment_method_id
      AND pm.company_id = v_company_id
    FOR UPDATE;

    -- 6. Verify No Conflicting Active Provider Subscription Already Exists
    SELECT *
    INTO v_existing_current_sub
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.subscription_id = v_subscription.id
      AND bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.is_current IS TRUE
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_current_sub.provider_subscription_code <> v_provider_subscription_code THEN
            RAISE EXCEPTION 'A different active provider subscription "%" already exists for subscription %.',
                v_existing_current_sub.provider_subscription_code, v_subscription.id
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 7. Insert Immutable Provider Subscription Row
    INSERT INTO public.billing_provider_subscriptions (
        company_id,
        subscription_id,
        plan_id,
        provider_plan_mapping_id,
        provider,
        environment,
        provider_subscription_code,
        provider_subscription_id,
        provider_customer_code,
        provider_customer_id,
        email_token,
        customer_email,
        provider_status,
        next_payment_at,
        is_current,
        payment_method_id,
        last_synced_at,
        created_at,
        updated_at
    ) VALUES (
        v_subscription.company_id,
        v_subscription.id,
        v_subscription.plan_id,
        v_provider_plan_mapping_id,
        'paystack',
        v_environment,
        v_provider_subscription_code,
        v_provider_subscription_id,
        v_provider_customer_code,
        v_provider_customer_id,
        v_email_token,
        v_normalized_email,
        v_provider_status,
        p_next_payment_at,
        TRUE,
        v_payment_method.id,
        v_now,
        v_now,
        v_now
    )
    RETURNING id INTO v_new_provider_subscription_id;

    -- 8. Record / Update Webhook Event in Inbox
    IF v_existing_webhook.id IS NOT NULL THEN
        UPDATE public.billing_webhook_events AS bwe_upd
        SET processing_status = 'processed',
            processed_at = v_now,
            processing_attempts = processing_attempts + 1,
            updated_at = v_now
        WHERE bwe_upd.id = v_existing_webhook.id;
        v_webhook_event_id := v_existing_webhook.id;
    ELSE
        INSERT INTO public.billing_webhook_events (
            provider,
            environment,
            event_type,
            provider_event_id,
            provider_object_id,
            payload_sha256,
            raw_payload,
            signature_verified,
            processing_status,
            processing_attempts,
            received_at,
            processing_started_at,
            processed_at,
            updated_at
        ) VALUES (
            'paystack',
            v_environment,
            'subscription.create',
            v_provider_event_id,
            v_provider_subscription_code,
            v_payload_sha256,
            pg_catalog.jsonb_build_object(
                'provider', 'paystack',
                'environment', v_environment,
                'event_type', 'subscription.create',
                'provider_subscription_code', v_provider_subscription_code,
                'provider_subscription_id', v_provider_subscription_id,
                'provider_customer_code', v_provider_customer_code,
                'provider_customer_id', v_provider_customer_id,
                'provider_plan_code', v_provider_plan_code,
                'amount_minor', p_amount_minor,
                'currency', v_currency,
                'provider_status', v_provider_status,
                'next_payment_at', p_next_payment_at
            ),
            TRUE,
            'processed',
            1,
            p_occurred_at,
            v_now,
            v_now,
            v_now
        )
        RETURNING id INTO v_webhook_event_id;
    END IF;

    -- 9. Append Immutable Ledger Entry
    v_ledger_dedup_key := 'provider_subscription_linked:paystack:' || v_environment || ':' || v_subscription.id::pg_catalog.text || ':' || v_provider_subscription_code;

    IF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
          AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
          AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
          AND event.event_type = 'provider_subscription_linked'
          AND event.event_source = 'paystack_webhook'
    ) THEN
        NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
    ) THEN
        RAISE EXCEPTION 'Ledger deduplication key collision for subscription %.', v_subscription.id
            USING ERRCODE = '23505';
    ELSE
        INSERT INTO public.billing_ledger_events (
            company_id,
            subscription_id,
            payment_id,
            event_type,
            event_source,
            occurred_at,
            recorded_at,
            actor_profile_id,
            deduplication_key,
            event_data
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            v_payment.id,
            'provider_subscription_linked',
            'paystack_webhook',
            p_occurred_at,
            v_now,
            NULL,
            v_ledger_dedup_key,
            pg_catalog.jsonb_build_object(
                'subscription_id', v_subscription.id,
                'payment_id', v_payment.id,
                'company_id', v_subscription.company_id,
                'plan_id', v_subscription.plan_id,
                'provider', 'paystack',
                'environment', v_environment,
                'provider_subscription_code', v_provider_subscription_code,
                'provider_subscription_id', v_provider_subscription_id,
                'provider_customer_code', v_provider_customer_code,
                'provider_customer_id', v_provider_customer_id,
                'provider_plan_code', v_provider_plan_code,
                'amount_minor', p_amount_minor,
                'currency', v_currency,
                'provider_status', v_provider_status,
                'next_payment_at', p_next_payment_at,
                'linked_payment_method_id', v_payment_method.id
            )
        );
    END IF;

    -- 10. Return Strict Safe Return Contract
    RETURN QUERY
    SELECT
        v_new_provider_subscription_id,
        v_subscription.id,
        v_payment.id,
        v_provider_subscription_code,
        v_provider_status,
        FALSE AS is_reused;

    RETURN;
END;
$process_paystack_subscription_create$;

REVOKE ALL
ON FUNCTION public.process_paystack_subscription_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_subscription_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_subscription_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified Paystack subscription.create webhook event, linking provider subscription state without extending billing periods.';


CREATE OR REPLACE FUNCTION public.process_paystack_subscription_not_renew(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_id pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_status pg_catalog.text DEFAULT NULL,
    p_next_payment_at pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_subscription_code pg_catalog.text,
    provider_status pg_catalog.text,
    subscription_status pg_catalog.text,
    auto_renew_enabled pg_catalog.bool,
    is_reused pg_catalog.bool,
    is_ignored pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_subscription_not_renew$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_event_id pg_catalog.text;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;

    v_webhook_event_id pg_catalog.uuid;
    v_is_reused pg_catalog.bool := FALSE;
    v_is_ignored pg_catalog.bool := FALSE;

    v_resulting_provider_status pg_catalog.text;
    v_resulting_subscription_status pg_catalog.text;
    v_resulting_auto_renew pg_catalog.bool;

    v_ledger_dedup_key pg_catalog.text;
    v_ledger_event_type pg_catalog.text;
    v_ledger_event_data pg_catalog.jsonb;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL THEN
        RAISE EXCEPTION 'p_environment is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL THEN
        RAISE EXCEPTION 'p_payload_sha256 is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 lowercase hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := p_payload_sha256;

    IF p_provider_event_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_event_id) = 0
           OR p_provider_event_id ~ '[[:cntrl:]]'
           OR p_provider_event_id <> pg_catalog.btrim(p_provider_event_id)
           OR pg_catalog.char_length(p_provider_event_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider event ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_event_id := p_provider_event_id;
    ELSE
        v_provider_event_id := NULL;
    END IF;

    IF p_provider_subscription_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_subscription_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$' THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_subscription_id IS NOT NULL THEN
        IF p_provider_subscription_id !~ '^[0-9]+$'
           OR pg_catalog.char_length(p_provider_subscription_id) = 0
           OR pg_catalog.char_length(p_provider_subscription_id) > 20
           OR (pg_catalog.char_length(p_provider_subscription_id) = 20 AND p_provider_subscription_id > '18446744073709551615')
        THEN
            RAISE EXCEPTION 'Invalid provider subscription ID "%". Must be decimal digits string.', p_provider_subscription_id
                USING ERRCODE = '22023';
        END IF;
    END IF;

    IF p_provider_customer_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_customer_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$' THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_status IS NULL THEN
        RAISE EXCEPTION 'p_provider_status is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_status <> 'non-renewing' THEN
        RAISE EXCEPTION 'Invalid provider status "%". Must be "non-renewing".', p_provider_status
            USING ERRCODE = '22023';
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    -- 2. Webhook Claim & Inbox Insertion (Insertion-First Pattern)
    INSERT INTO public.billing_webhook_events (
        provider,
        environment,
        event_type,
        provider_event_id,
        provider_object_id,
        payload_sha256,
        raw_payload,
        signature_verified,
        processing_status,
        processing_attempts,
        received_at,
        processing_started_at,
        updated_at
    ) VALUES (
        'paystack',
        v_environment,
        'subscription.not_renew',
        v_provider_event_id,
        p_provider_subscription_code,
        v_payload_sha256,
        pg_catalog.jsonb_build_object(
            'provider', 'paystack',
            'environment', v_environment,
            'event_type', 'subscription.not_renew',
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', 'non-renewing',
            'next_payment_at', p_next_payment_at
        ),
        TRUE,
        'processing',
        1,
        p_occurred_at,
        v_now,
        v_now
    )
    ON CONFLICT (provider, environment, payload_sha256)
    DO NOTHING
    RETURNING id INTO v_webhook_event_id;

    IF v_webhook_event_id IS NULL THEN
        -- Conflicting transaction already claimed or processed this payload
        SELECT bwe.*
        INTO v_existing_webhook
        FROM public.billing_webhook_events AS bwe
        WHERE bwe.provider = 'paystack'
          AND bwe.environment = v_environment
          AND bwe.payload_sha256 = v_payload_sha256
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Concurrent transaction rolled back while claiming webhook payload. Please retry.'
                USING ERRCODE = '40001';
        END IF;

        -- Check for payload hash collision with conflicting identifiers
        IF v_existing_webhook.event_type <> 'subscription.not_renew'
           OR v_existing_webhook.provider_object_id IS DISTINCT FROM p_provider_subscription_code
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        v_webhook_event_id := v_existing_webhook.id;

        IF v_existing_webhook.processing_status IN ('processed', 'ignored') THEN
            v_is_reused := TRUE;
            v_is_ignored := (v_existing_webhook.processing_status = 'ignored');
        ELSIF v_existing_webhook.processing_status IN ('received', 'processing') THEN
            RAISE EXCEPTION 'Webhook payload is currently being processed by a concurrent transaction. Please retry.'
                USING ERRCODE = '40001';
        ELSIF v_existing_webhook.processing_status = 'failed' THEN
            RAISE EXCEPTION 'Webhook payload processing previously failed. Manual inspection or retry required.'
                USING ERRCODE = '40001';
        ELSE
            RAISE EXCEPTION 'Unknown webhook processing status "%".', v_existing_webhook.processing_status
                USING ERRCODE = 'XX000';
        END IF;
    END IF;

    -- 3. Resolve & Lock Provider Subscription
    SELECT bps.*
    INTO v_provider_subscription
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.provider_subscription_code = p_provider_subscription_code
      AND bps.provider_customer_code = p_provider_customer_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider subscription not found for code % and customer % in % environment.',
            p_provider_subscription_code, p_provider_customer_code, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    IF p_provider_subscription_id IS NOT NULL
       AND v_provider_subscription.provider_subscription_id IS NOT NULL
       AND v_provider_subscription.provider_subscription_id <> p_provider_subscription_id
    THEN
        RAISE EXCEPTION 'Provider subscription ID mismatch.'
            USING ERRCODE = '23514';
    END IF;

    -- 4. Resolve & Lock Linked Internal Subscription
    SELECT bs.*
    INTO v_subscription
    FROM public.billing_subscriptions AS bs
    WHERE bs.id = v_provider_subscription.subscription_id
      AND bs.company_id = v_provider_subscription.company_id
      AND bs.plan_id = v_provider_subscription.plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked billing subscription % not found for company % and plan %.',
            v_provider_subscription.subscription_id,
            v_provider_subscription.company_id,
            v_provider_subscription.plan_id
            USING ERRCODE = '23514';
    END IF;

    -- 5. Exact Replay Handling: Return early without mutations or ledger insertions
    IF v_is_reused THEN
        RETURN QUERY
        SELECT
            v_webhook_event_id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_subscription.provider_subscription_code,
            v_provider_subscription.provider_status,
            v_subscription.status,
            v_subscription.auto_renew_enabled,
            TRUE AS is_reused,
            v_is_ignored AS is_ignored;
        RETURN;
    END IF;

    -- 6. Lifecycle Validation & State Application
    IF v_subscription.status IN ('pending_activation', 'trialing') THEN
        RAISE EXCEPTION 'Cannot process subscription.not_renew for subscription % in % state.',
            v_subscription.id, v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    IF v_subscription.status IN ('expired', 'cancelled') THEN
        -- Stale terminal event: do not regress state or overwrite terminal status
        v_is_ignored := TRUE;
        v_ledger_event_type := 'provider_subscription_non_renewing_ignored';
        v_resulting_provider_status := v_provider_subscription.provider_status;
        v_resulting_subscription_status := v_subscription.status;
        v_resulting_auto_renew := v_subscription.auto_renew_enabled;

        UPDATE public.billing_webhook_events AS bwe_ign
        SET processing_status = 'ignored',
            processed_at = v_now,
            updated_at = v_now
        WHERE bwe_ign.id = v_webhook_event_id;

        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', v_provider_subscription.provider_status,
            'subscription_status', v_subscription.status,
            'reason', 'terminal_state_ignored',
            'auto_renew_enabled', v_subscription.auto_renew_enabled,
            'next_payment_at', p_next_payment_at
        );
    ELSE
        -- Non-terminal state (active, non_renewing, past_due)
        v_is_ignored := FALSE;
        v_ledger_event_type := 'provider_subscription_non_renewing';
        v_resulting_provider_status := 'non-renewing';
        v_resulting_auto_renew := FALSE;

        IF v_subscription.status = 'active' THEN
            v_resulting_subscription_status := 'non_renewing';
            UPDATE public.billing_subscriptions AS bs_act
            SET status = 'non_renewing',
                auto_renew_enabled = FALSE,
                updated_at = v_now
            WHERE bs_act.id = v_subscription.id;
        ELSIF v_subscription.status = 'non_renewing' THEN
            v_resulting_subscription_status := 'non_renewing';
            UPDATE public.billing_subscriptions AS bs_nr
            SET auto_renew_enabled = FALSE,
                updated_at = v_now
            WHERE bs_nr.id = v_subscription.id;
        ELSIF v_subscription.status = 'past_due' THEN
            v_resulting_subscription_status := 'past_due';
            UPDATE public.billing_subscriptions AS bs_pd
            SET auto_renew_enabled = FALSE,
                updated_at = v_now
            WHERE bs_pd.id = v_subscription.id;
        END IF;

        UPDATE public.billing_provider_subscriptions AS bps_upd
        SET provider_status = 'non-renewing',
            next_payment_at = p_next_payment_at,
            last_synced_at = v_now,
            updated_at = v_now
        WHERE bps_upd.id = v_provider_subscription.id;

        UPDATE public.billing_webhook_events AS bwe_proc
        SET processing_status = 'processed',
            processed_at = v_now,
            updated_at = v_now
        WHERE bwe_proc.id = v_webhook_event_id;

        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', 'non-renewing',
            'previous_provider_status', v_provider_subscription.provider_status,
            'previous_subscription_status', v_subscription.status,
            'resulting_subscription_status', v_resulting_subscription_status,
            'auto_renew_enabled', FALSE,
            'next_payment_at', p_next_payment_at
        );
    END IF;

    -- 7. Append Immutable Ledger Entry
    v_ledger_dedup_key := 'provider_subscription_non_renewing:paystack:' || v_environment || ':' || v_subscription.id::pg_catalog.text || ':' || p_provider_subscription_code || ':' || v_payload_sha256;

    IF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
          AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
          AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
          AND event.event_type = v_ledger_event_type
          AND event.event_source = 'paystack_webhook'
    ) THEN
        NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
    ) THEN
        RAISE EXCEPTION 'Ledger deduplication key collision for subscription %.', v_subscription.id
            USING ERRCODE = '23505';
    ELSE
        INSERT INTO public.billing_ledger_events (
            company_id,
            subscription_id,
            payment_id,
            event_type,
            event_source,
            occurred_at,
            recorded_at,
            actor_profile_id,
            deduplication_key,
            event_data
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            NULL,
            v_ledger_event_type,
            'paystack_webhook',
            p_occurred_at,
            v_now,
            NULL,
            v_ledger_dedup_key,
            v_ledger_event_data
        );
    END IF;

    -- 8. Return Safe Return Contract
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_provider_subscription.id,
        v_subscription.id,
        p_provider_subscription_code,
        v_resulting_provider_status,
        v_resulting_subscription_status,
        v_resulting_auto_renew,
        FALSE AS is_reused,
        v_is_ignored AS is_ignored;

    RETURN;
END;
$process_paystack_subscription_not_renew$;

REVOKE ALL
ON FUNCTION public.process_paystack_subscription_not_renew(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_subscription_not_renew(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_subscription_not_renew(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified Paystack subscription.not_renew webhook event, setting internal and provider subscriptions to non-renewing without terminating access or modifying billing period dates.';


CREATE OR REPLACE FUNCTION public.process_paystack_subscription_disable(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_id pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_status pg_catalog.text DEFAULT NULL,
    p_disabled_at pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_subscription_code pg_catalog.text,
    provider_status pg_catalog.text,
    subscription_status pg_catalog.text,
    auto_renew_enabled pg_catalog.bool,
    is_reused pg_catalog.bool,
    is_ignored pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_subscription_disable$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_event_id pg_catalog.text;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;

    v_webhook_event_id pg_catalog.uuid;
    v_is_reused pg_catalog.bool := FALSE;
    v_is_ignored pg_catalog.bool := FALSE;

    v_resulting_provider_status pg_catalog.text;
    v_resulting_subscription_status pg_catalog.text;
    v_resulting_auto_renew pg_catalog.bool;

    v_ledger_dedup_key pg_catalog.text;
    v_ledger_event_type pg_catalog.text;
    v_ledger_event_data pg_catalog.jsonb;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL THEN
        RAISE EXCEPTION 'p_environment is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL THEN
        RAISE EXCEPTION 'p_payload_sha256 is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 lowercase hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := p_payload_sha256;

    IF p_provider_event_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_event_id) = 0
           OR p_provider_event_id ~ '[[:cntrl:]]'
           OR p_provider_event_id <> pg_catalog.btrim(p_provider_event_id)
           OR pg_catalog.char_length(p_provider_event_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider event ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_event_id := p_provider_event_id;
    ELSE
        v_provider_event_id := NULL;
    END IF;

    IF p_provider_subscription_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_subscription_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$' THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_subscription_id IS NOT NULL THEN
        IF p_provider_subscription_id !~ '^[0-9]+$'
           OR pg_catalog.char_length(p_provider_subscription_id) = 0
           OR pg_catalog.char_length(p_provider_subscription_id) > 20
           OR (pg_catalog.char_length(p_provider_subscription_id) = 20 AND p_provider_subscription_id > '18446744073709551615')
        THEN
            RAISE EXCEPTION 'Invalid provider subscription ID "%". Must be decimal digits string.', p_provider_subscription_id
                USING ERRCODE = '22023';
        END IF;
    END IF;

    IF p_provider_customer_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_customer_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$' THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_status IS NULL THEN
        RAISE EXCEPTION 'p_provider_status is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_status NOT IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid provider status "%". Must be "completed" or "cancelled".', p_provider_status
            USING ERRCODE = '22023';
    END IF;

    IF p_disabled_at IS NULL THEN
        RAISE EXCEPTION 'p_disabled_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_disabled_at <> p_occurred_at THEN
        RAISE EXCEPTION 'p_disabled_at and p_occurred_at must represent the same verified timestamp.'
            USING ERRCODE = '22023';
    END IF;

    -- 2. Webhook Claim & Inbox Insertion (Insertion-First Pattern)
    INSERT INTO public.billing_webhook_events (
        provider,
        environment,
        event_type,
        provider_event_id,
        provider_object_id,
        payload_sha256,
        raw_payload,
        signature_verified,
        processing_status,
        processing_attempts,
        received_at,
        processing_started_at,
        updated_at
    ) VALUES (
        'paystack',
        v_environment,
        'subscription.disable',
        v_provider_event_id,
        p_provider_subscription_code,
        v_payload_sha256,
        pg_catalog.jsonb_build_object(
            'provider', 'paystack',
            'environment', v_environment,
            'event_type', 'subscription.disable',
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', p_provider_status,
            'disabled_at', p_disabled_at,
            'occurred_at', p_occurred_at
        ),
        TRUE,
        'processing',
        1,
        p_occurred_at,
        v_now,
        v_now
    )
    ON CONFLICT (provider, environment, payload_sha256)
    DO NOTHING
    RETURNING id INTO v_webhook_event_id;

    IF v_webhook_event_id IS NULL THEN
        -- Conflicting transaction already claimed or processed this payload
        SELECT bwe.*
        INTO v_existing_webhook
        FROM public.billing_webhook_events AS bwe
        WHERE bwe.provider = 'paystack'
          AND bwe.environment = v_environment
          AND bwe.payload_sha256 = v_payload_sha256
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Concurrent transaction rolled back while claiming webhook payload. Please retry.'
                USING ERRCODE = '40001';
        END IF;

        -- Check for payload hash collision with conflicting identifiers
        IF v_existing_webhook.event_type <> 'subscription.disable'
           OR v_existing_webhook.provider_object_id IS DISTINCT FROM p_provider_subscription_code
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        v_webhook_event_id := v_existing_webhook.id;

        IF v_existing_webhook.processing_status IN ('processed', 'ignored') THEN
            v_is_reused := TRUE;
            v_is_ignored := (v_existing_webhook.processing_status = 'ignored');
        ELSIF v_existing_webhook.processing_status IN ('received', 'processing') THEN
            RAISE EXCEPTION 'Webhook payload is currently being processed by a concurrent transaction. Please retry.'
                USING ERRCODE = '40001';
        ELSIF v_existing_webhook.processing_status = 'failed' THEN
            RAISE EXCEPTION 'Webhook payload processing previously failed. Manual inspection or retry required.'
                USING ERRCODE = '40001';
        ELSE
            RAISE EXCEPTION 'Unknown webhook processing status "%".', v_existing_webhook.processing_status
                USING ERRCODE = 'XX000';
        END IF;
    END IF;

    -- 3. Resolve & Lock Provider Subscription
    SELECT bps.*
    INTO v_provider_subscription
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.provider_subscription_code = p_provider_subscription_code
      AND bps.provider_customer_code = p_provider_customer_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider subscription not found for code % and customer % in % environment.',
            p_provider_subscription_code, p_provider_customer_code, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    IF p_provider_subscription_id IS NOT NULL
       AND v_provider_subscription.provider_subscription_id IS NOT NULL
       AND v_provider_subscription.provider_subscription_id <> p_provider_subscription_id
    THEN
        RAISE EXCEPTION 'Provider subscription ID mismatch.'
            USING ERRCODE = '23514';
    END IF;

    -- 4. Resolve & Lock Linked Internal Subscription
    SELECT bs.*
    INTO v_subscription
    FROM public.billing_subscriptions AS bs
    WHERE bs.id = v_provider_subscription.subscription_id
      AND bs.company_id = v_provider_subscription.company_id
      AND bs.plan_id = v_provider_subscription.plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked billing subscription % not found for company % and plan %.',
            v_provider_subscription.subscription_id,
            v_provider_subscription.company_id,
            v_provider_subscription.plan_id
            USING ERRCODE = '23514';
    END IF;

    -- 5. Exact Replay Handling: Return early without mutations or ledger insertions
    IF v_is_reused THEN
        RETURN QUERY
        SELECT
            v_webhook_event_id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_subscription.provider_subscription_code,
            v_provider_subscription.provider_status,
            v_subscription.status,
            v_subscription.auto_renew_enabled,
            TRUE AS is_reused,
            v_is_ignored AS is_ignored;
        RETURN;
    END IF;

    -- 6. Lifecycle Validation & State Application
    IF v_subscription.status IN ('pending_activation', 'trialing') THEN
        RAISE EXCEPTION 'Cannot process subscription.disable for subscription % in % state.',
            v_subscription.id, v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    IF v_subscription.status IN ('expired', 'cancelled') THEN
        -- Check for contradictory terminal state
        IF (v_subscription.status = 'expired' AND p_provider_status <> 'completed')
           OR (v_subscription.status = 'cancelled' AND p_provider_status <> 'cancelled')
        THEN
            RAISE EXCEPTION 'Contradictory terminal state transition for subscription % in % state with provider status %.',
                v_subscription.id, v_subscription.status, p_provider_status
                USING ERRCODE = '23514';
        END IF;

        -- Same-outcome fresh stale event: preserve state without regression
        v_is_ignored := TRUE;
        v_ledger_event_type := 'provider_subscription_disable_ignored';
        v_resulting_provider_status := v_provider_subscription.provider_status;
        v_resulting_subscription_status := v_subscription.status;
        v_resulting_auto_renew := v_subscription.auto_renew_enabled;

        UPDATE public.billing_webhook_events AS bwe_ign
        SET processing_status = 'ignored',
            processed_at = v_now,
            updated_at = v_now
        WHERE bwe_ign.id = v_webhook_event_id;

        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', v_provider_subscription.provider_status,
            'subscription_status', v_subscription.status,
            'reason', 'terminal_state_ignored',
            'auto_renew_enabled', v_subscription.auto_renew_enabled,
            'disabled_at', p_disabled_at
        );
    ELSE
        -- Non-terminal states (active, non_renewing, past_due)
        v_is_ignored := FALSE;
        v_resulting_provider_status := p_provider_status;
        v_resulting_auto_renew := FALSE;

        IF p_provider_status = 'completed' THEN
            v_resulting_subscription_status := 'expired';
            v_ledger_event_type := 'provider_subscription_completed';

            UPDATE public.billing_subscriptions AS bs_exp
            SET status = 'expired',
                auto_renew_enabled = FALSE,
                next_renewal_at = NULL,
                expired_at = p_disabled_at,
                updated_at = v_now
            WHERE bs_exp.id = v_subscription.id;
        ELSIF p_provider_status = 'cancelled' THEN
            v_resulting_subscription_status := 'cancelled';
            v_ledger_event_type := 'provider_subscription_cancelled';

            UPDATE public.billing_subscriptions AS bs_cnc
            SET status = 'cancelled',
                auto_renew_enabled = FALSE,
                next_renewal_at = NULL,
                cancelled_at = p_disabled_at,
                updated_at = v_now
            WHERE bs_cnc.id = v_subscription.id;
        END IF;

        UPDATE public.billing_provider_subscriptions AS bps_upd
        SET provider_status = p_provider_status,
            disabled_at = p_disabled_at,
            next_payment_at = NULL,
            is_current = FALSE,
            last_synced_at = v_now,
            updated_at = v_now
        WHERE bps_upd.id = v_provider_subscription.id;

        UPDATE public.billing_webhook_events AS bwe_proc
        SET processing_status = 'processed',
            processed_at = v_now,
            updated_at = v_now
        WHERE bwe_proc.id = v_webhook_event_id;

        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_subscription_code', p_provider_subscription_code,
            'provider_subscription_id', p_provider_subscription_id,
            'provider_customer_code', p_provider_customer_code,
            'provider_status', p_provider_status,
            'previous_provider_status', v_provider_subscription.provider_status,
            'previous_subscription_status', v_subscription.status,
            'resulting_subscription_status', v_resulting_subscription_status,
            'auto_renew_enabled', FALSE,
            'disabled_at', p_disabled_at
        );
    END IF;

    -- 7. Append Immutable Ledger Entry
    v_ledger_dedup_key := 'provider_subscription_disable:paystack:' || v_environment || ':' || v_subscription.id::pg_catalog.text || ':' || p_provider_subscription_code || ':' || v_payload_sha256;

    IF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
          AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
          AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
          AND event.event_type = v_ledger_event_type
          AND event.event_source = 'paystack_webhook'
    ) THEN
        NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
    ) THEN
        RAISE EXCEPTION 'Ledger deduplication key collision for subscription %.', v_subscription.id
            USING ERRCODE = '23505';
    ELSE
        INSERT INTO public.billing_ledger_events (
            company_id,
            subscription_id,
            payment_id,
            event_type,
            event_source,
            occurred_at,
            recorded_at,
            actor_profile_id,
            deduplication_key,
            event_data
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            NULL,
            v_ledger_event_type,
            'paystack_webhook',
            p_occurred_at,
            v_now,
            NULL,
            v_ledger_dedup_key,
            v_ledger_event_data
        );
    END IF;

    -- 8. Return Safe Return Contract
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_provider_subscription.id,
        v_subscription.id,
        p_provider_subscription_code,
        v_resulting_provider_status,
        v_resulting_subscription_status,
        v_resulting_auto_renew,
        FALSE AS is_reused,
        v_is_ignored AS is_ignored;

    RETURN;
END;
$process_paystack_subscription_disable$;

REVOKE ALL
ON FUNCTION public.process_paystack_subscription_disable(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_subscription_disable(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_subscription_disable(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified Paystack subscription.disable webhook event, transitioning subscriptions to terminal expired or cancelled states with full idempotency and ledger audit logging.';


-- ============================================================================
-- Paystack invoice.create Database RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_paystack_invoice_create(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_invoice_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_status pg_catalog.text DEFAULT NULL,
    p_amount_minor pg_catalog.int8 DEFAULT NULL,
    p_currency pg_catalog.text DEFAULT NULL,
    p_period_start pg_catalog.timestamptz DEFAULT NULL,
    p_period_end pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    invoice_id pg_catalog.uuid,
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_invoice_code pg_catalog.text,
    invoice_status pg_catalog.text,
    provider_status pg_catalog.text,
    amount_minor pg_catalog.int8,
    currency pg_catalog.text,
    is_reused pg_catalog.bool,
    is_ignored pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_invoice_create$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_event_id pg_catalog.text;
    v_provider_invoice_code pg_catalog.text;
    v_provider_subscription_code pg_catalog.text;
    v_provider_customer_code pg_catalog.text;
    v_provider_status pg_catalog.text;
    v_currency pg_catalog.text;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;
    v_existing_invoice public.billing_invoices%ROWTYPE;

    v_webhook_event_id pg_catalog.uuid;
    v_new_invoice_id pg_catalog.uuid;
    v_is_reused pg_catalog.bool := FALSE;
    v_is_ignored pg_catalog.bool := FALSE;

    v_ledger_dedup_key pg_catalog.text;
    v_ledger_event_type pg_catalog.text;
    v_ledger_event_data pg_catalog.jsonb;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL THEN
        RAISE EXCEPTION 'p_environment is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL THEN
        RAISE EXCEPTION 'p_payload_sha256 is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 lowercase hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := p_payload_sha256;

    IF p_provider_event_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_event_id) = 0
           OR p_provider_event_id ~ '[[:cntrl:]]'
           OR p_provider_event_id <> pg_catalog.btrim(p_provider_event_id)
           OR pg_catalog.char_length(p_provider_event_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider event ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_event_id := p_provider_event_id;
    ELSE
        v_provider_event_id := NULL;
    END IF;

    IF p_provider_invoice_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_invoice_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_invoice_code !~ '^INV_[a-zA-Z0-9_\-]+$'
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_invoice_code)) < 5
       OR p_provider_invoice_code <> pg_catalog.btrim(p_provider_invoice_code)
       OR pg_catalog.char_length(p_provider_invoice_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider invoice code format "%".', p_provider_invoice_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_invoice_code := p_provider_invoice_code;

    IF p_provider_subscription_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_subscription_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$'
       OR p_provider_subscription_code <> pg_catalog.btrim(p_provider_subscription_code)
       OR pg_catalog.char_length(p_provider_subscription_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_subscription_code := p_provider_subscription_code;

    IF p_provider_customer_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_customer_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
       OR p_provider_customer_code <> pg_catalog.btrim(p_provider_customer_code)
       OR pg_catalog.char_length(p_provider_customer_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_customer_code := p_provider_customer_code;

    IF p_provider_status IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_status) = 0
           OR p_provider_status ~ '[[:cntrl:]]'
           OR p_provider_status <> pg_catalog.btrim(p_provider_status)
           OR pg_catalog.char_length(p_provider_status) > 50
        THEN
            RAISE EXCEPTION 'Invalid provider status "%".', p_provider_status
                USING ERRCODE = '22023';
        END IF;
        v_provider_status := p_provider_status;
    ELSE
        v_provider_status := NULL;
    END IF;

    IF p_amount_minor IS NULL THEN
        RAISE EXCEPTION 'p_amount_minor is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_amount_minor <= 0 OR p_amount_minor > 2147483647 THEN
        RAISE EXCEPTION 'Invalid amount % minor units.', p_amount_minor
            USING ERRCODE = '22023';
    END IF;

    IF p_currency IS NULL THEN
        RAISE EXCEPTION 'p_currency is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Invalid currency "%". Must be 3 uppercase letters.', p_currency
            USING ERRCODE = '22023';
    END IF;
    v_currency := p_currency;

    IF (p_period_start IS NULL AND p_period_end IS NOT NULL)
       OR (p_period_start IS NOT NULL AND p_period_end IS NULL)
    THEN
        RAISE EXCEPTION 'Period boundaries must be either both null or both specified.'
            USING ERRCODE = '22023';
    END IF;

    IF p_period_start IS NOT NULL AND p_period_end <= p_period_start THEN
        RAISE EXCEPTION 'p_period_end must be strictly greater than p_period_start.'
            USING ERRCODE = '22023';
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    -- 2. Webhook Claim & Inbox Insertion (Insertion-First Pattern)
    INSERT INTO public.billing_webhook_events (
        provider,
        environment,
        event_type,
        provider_event_id,
        provider_object_id,
        payload_sha256,
        raw_payload,
        signature_verified,
        processing_status,
        processing_attempts,
        received_at,
        processing_started_at,
        updated_at
    ) VALUES (
        'paystack',
        v_environment,
        'invoice.create',
        v_provider_event_id,
        v_provider_invoice_code,
        v_payload_sha256,
        pg_catalog.jsonb_build_object(
            'provider', 'paystack',
            'environment', v_environment,
            'event_type', 'invoice.create',
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_status,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'occurred_at', p_occurred_at
        ),
        TRUE,
        'processing',
        1,
        p_occurred_at,
        v_now,
        v_now
    )
    ON CONFLICT (provider, environment, payload_sha256)
    DO NOTHING
    RETURNING id INTO v_webhook_event_id;

    IF v_webhook_event_id IS NULL THEN
        -- Conflicting transaction already claimed or processed this exact payload hash
        SELECT bwe.*
        INTO v_existing_webhook
        FROM public.billing_webhook_events AS bwe
        WHERE bwe.provider = 'paystack'
          AND bwe.environment = v_environment
          AND bwe.payload_sha256 = v_payload_sha256
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Concurrent transaction rolled back while claiming webhook payload. Please retry.'
                USING ERRCODE = '40001';
        END IF;

        -- Check for payload hash collision with conflicting identifiers
        IF v_existing_webhook.event_type <> 'invoice.create'
           OR v_existing_webhook.provider_object_id IS DISTINCT FROM v_provider_invoice_code
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        v_webhook_event_id := v_existing_webhook.id;

        IF v_existing_webhook.processing_status IN ('processed', 'ignored') THEN
            v_is_reused := TRUE;
            v_is_ignored := (v_existing_webhook.processing_status = 'ignored');
        ELSIF v_existing_webhook.processing_status IN ('received', 'processing') THEN
            RAISE EXCEPTION 'Webhook payload is currently being processed by a concurrent transaction. Please retry.'
                USING ERRCODE = '40001';
        ELSIF v_existing_webhook.processing_status = 'failed' THEN
            RAISE EXCEPTION 'Webhook payload processing previously failed. Manual inspection or retry required.'
                USING ERRCODE = '40001';
        ELSE
            RAISE EXCEPTION 'Unknown webhook processing status "%".', v_existing_webhook.processing_status
                USING ERRCODE = 'XX000';
        END IF;
    END IF;

    -- 3. Resolve & Lock Provider Subscription
    SELECT bps.*
    INTO v_provider_subscription
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.provider_subscription_code = v_provider_subscription_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider subscription not found for code % in % environment.',
            v_provider_subscription_code, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    IF v_provider_subscription.provider_customer_code <> v_provider_customer_code THEN
        RAISE EXCEPTION 'Provider customer code % does not match customer % on provider subscription %.',
            v_provider_customer_code, v_provider_subscription.provider_customer_code, v_provider_subscription_code
            USING ERRCODE = 'P0002';
    END IF;

    -- 4. Resolve & Lock Linked Internal Subscription
    SELECT bs.*
    INTO v_subscription
    FROM public.billing_subscriptions AS bs
    WHERE bs.id = v_provider_subscription.subscription_id
      AND bs.company_id = v_provider_subscription.company_id
      AND bs.plan_id = v_provider_subscription.plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked billing subscription % not found for company % and plan %.',
            v_provider_subscription.subscription_id,
            v_provider_subscription.company_id,
            v_provider_subscription.plan_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Commercial snapshot verification
    IF v_subscription.amount_minor <> p_amount_minor
       OR v_subscription.currency <> v_currency
    THEN
        RAISE EXCEPTION 'Commercial snapshot mismatch for subscription %: expected % %, received % %.',
            v_subscription.id, v_subscription.amount_minor, v_subscription.currency, p_amount_minor, v_currency
            USING ERRCODE = '23514';
    END IF;

    -- 5. Exact Replay Handling: Return early without mutations or ledger insertions
    IF v_is_reused THEN
        SELECT bi.*
        INTO v_existing_invoice
        FROM public.billing_invoices AS bi
        WHERE bi.provider = 'paystack'
          AND bi.environment = v_environment
          AND bi.provider_invoice_code = v_provider_invoice_code
        FOR UPDATE;

        IF v_existing_invoice.id IS NOT NULL THEN
            RETURN QUERY
            SELECT
                v_webhook_event_id,
                v_existing_invoice.id,
                v_provider_subscription.id,
                v_subscription.id,
                v_provider_invoice_code,
                v_existing_invoice.status,
                v_existing_invoice.provider_status,
                v_existing_invoice.amount_minor::pg_catalog.int8,
                v_existing_invoice.currency::pg_catalog.text,
                TRUE AS is_reused,
                v_is_ignored AS is_ignored;
            RETURN;
        ELSE
            -- Stale ignored event with no invoice created
            RETURN QUERY
            SELECT
                v_webhook_event_id,
                NULL::pg_catalog.uuid AS invoice_id,
                v_provider_subscription.id,
                v_subscription.id,
                v_provider_invoice_code,
                NULL::pg_catalog.text AS invoice_status,
                v_provider_status,
                p_amount_minor,
                v_currency,
                TRUE AS is_reused,
                TRUE AS is_ignored;
            RETURN;
        END IF;
    END IF;

    -- 6. Check Semantic Invoice Existence (Different payload hash referencing existing invoice code)
    SELECT bi.*
    INTO v_existing_invoice
    FROM public.billing_invoices AS bi
    WHERE bi.provider = 'paystack'
      AND bi.environment = v_environment
      AND bi.provider_invoice_code = v_provider_invoice_code
    FOR UPDATE;

    IF v_existing_invoice.id IS NOT NULL THEN
        -- Verify that identity matches exactly
        IF v_existing_invoice.company_id <> v_subscription.company_id
           OR v_existing_invoice.subscription_id <> v_subscription.id
           OR v_existing_invoice.provider_subscription_record_id <> v_provider_subscription.id
        THEN
            RAISE EXCEPTION 'Conflicting invoice identity for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        END IF;

        -- Verify commercial snapshot matches
        IF v_existing_invoice.amount_minor <> p_amount_minor
           OR v_existing_invoice.currency <> v_currency
        THEN
            RAISE EXCEPTION 'Conflicting commercial snapshot for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;

        -- Verify period dates match
        IF v_existing_invoice.period_start IS DISTINCT FROM p_period_start
           OR v_existing_invoice.period_end IS DISTINCT FROM p_period_end
        THEN
            RAISE EXCEPTION 'Conflicting period dates for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;

        IF v_existing_invoice.status = 'pending' THEN
            -- Reused existing pending invoice
            UPDATE public.billing_webhook_events AS bwe_proc
            SET processing_status = 'processed',
                processed_at = v_now,
                updated_at = v_now
            WHERE bwe_proc.id = v_webhook_event_id;

            RETURN QUERY
            SELECT
                v_webhook_event_id,
                v_existing_invoice.id,
                v_provider_subscription.id,
                v_subscription.id,
                v_provider_invoice_code,
                v_existing_invoice.status,
                v_existing_invoice.provider_status,
                v_existing_invoice.amount_minor::pg_catalog.int8,
                v_existing_invoice.currency::pg_catalog.text,
                TRUE AS is_reused,
                FALSE AS is_ignored;
            RETURN;
        ELSE
            -- Invoice has already advanced to failed or paid; treat new invoice.create event as stale ignored
            UPDATE public.billing_webhook_events AS bwe_ign
            SET processing_status = 'ignored',
                processed_at = v_now,
                updated_at = v_now
            WHERE bwe_ign.id = v_webhook_event_id;

            RETURN QUERY
            SELECT
                v_webhook_event_id,
                v_existing_invoice.id,
                v_provider_subscription.id,
                v_subscription.id,
                v_provider_invoice_code,
                v_existing_invoice.status,
                v_existing_invoice.provider_status,
                v_existing_invoice.amount_minor::pg_catalog.int8,
                v_existing_invoice.currency::pg_catalog.text,
                TRUE AS is_reused,
                TRUE AS is_ignored;
            RETURN;
        END IF;
    END IF;

    -- 7. Subscription Lifecycle Validation & Invoice Creation
    IF v_subscription.status IN ('pending_activation', 'trialing') THEN
        RAISE EXCEPTION 'Cannot process invoice.create for subscription % in % state.',
            v_subscription.id, v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    IF v_subscription.status IN ('non_renewing', 'expired', 'cancelled') THEN
        -- Stale event on non-renewing / terminal subscription: ignore without creating an invoice
        v_is_ignored := TRUE;
        v_ledger_event_type := 'billing_invoice_create_ignored';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':create_ignored:' || v_payload_sha256;

        UPDATE public.billing_webhook_events AS bwe_ign
        SET processing_status = 'ignored',
            processed_at = v_now,
            updated_at = v_now
        WHERE bwe_ign.id = v_webhook_event_id;

        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_status,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'occurred_at', p_occurred_at,
            'reason', 'stale_subscription_status',
            'subscription_status', v_subscription.status,
            'is_ignored', TRUE
        );

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
              AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = v_ledger_event_type
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_subscription.company_id,
                v_subscription.id,
                NULL,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;

        RETURN QUERY
        SELECT
            v_webhook_event_id,
            NULL::pg_catalog.uuid AS invoice_id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_invoice_code,
            NULL::pg_catalog.text AS invoice_status,
            v_provider_status,
            p_amount_minor,
            v_currency,
            FALSE AS is_reused,
            TRUE AS is_ignored;
        RETURN;
    END IF;

    -- Subscription is 'active' or 'past_due': Create pending billing_invoices record
    INSERT INTO public.billing_invoices (
        company_id,
        subscription_id,
        provider_subscription_record_id,
        provider,
        environment,
        provider_invoice_code,
        status,
        provider_status,
        amount_minor,
        currency,
        period_start,
        period_end,
        first_failed_at,
        paid_at,
        created_at,
        updated_at
    ) VALUES (
        v_subscription.company_id,
        v_subscription.id,
        v_provider_subscription.id,
        'paystack',
        v_environment,
        v_provider_invoice_code,
        'pending',
        v_provider_status,
        p_amount_minor::pg_catalog.int4,
        v_currency,
        p_period_start,
        p_period_end,
        NULL,
        NULL,
        v_now,
        v_now
    )
    RETURNING id INTO v_new_invoice_id;

    UPDATE public.billing_webhook_events AS bwe_proc
    SET processing_status = 'processed',
        processed_at = v_now,
        updated_at = v_now
    WHERE bwe_proc.id = v_webhook_event_id;

    -- 8. Append Immutable Ledger Entry
    v_ledger_event_type := 'billing_invoice_created';
    v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':created';

    v_ledger_event_data := pg_catalog.jsonb_build_object(
        'company_id', v_subscription.company_id,
        'subscription_id', v_subscription.id,
        'invoice_id', v_new_invoice_id,
        'provider', 'paystack',
        'environment', v_environment,
        'provider_invoice_code', v_provider_invoice_code,
        'provider_subscription_code', v_provider_subscription_code,
        'provider_customer_code', v_provider_customer_code,
        'provider_status', v_provider_status,
        'amount_minor', p_amount_minor,
        'currency', v_currency,
        'period_start', p_period_start,
        'period_end', p_period_end,
        'occurred_at', p_occurred_at,
        'invoice_status', 'pending',
        'subscription_status', v_subscription.status,
        'is_ignored', FALSE
    );

    IF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
          AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
          AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
          AND event.event_type = v_ledger_event_type
          AND event.event_source = 'paystack_webhook'
    ) THEN
        NULL;
    ELSIF EXISTS (
        SELECT 1
        FROM public.billing_ledger_events AS event
        WHERE event.deduplication_key = v_ledger_dedup_key
    ) THEN
        RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
            USING ERRCODE = '23505';
    ELSE
        INSERT INTO public.billing_ledger_events (
            company_id,
            subscription_id,
            payment_id,
            event_type,
            event_source,
            occurred_at,
            recorded_at,
            actor_profile_id,
            deduplication_key,
            event_data
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            NULL,
            v_ledger_event_type,
            'paystack_webhook',
            p_occurred_at,
            v_now,
            NULL,
            v_ledger_dedup_key,
            v_ledger_event_data
        );
    END IF;

    -- 9. Return Single Row Result
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_new_invoice_id,
        v_provider_subscription.id,
        v_subscription.id,
        v_provider_invoice_code,
        'pending'::pg_catalog.text,
        v_provider_status,
        p_amount_minor,
        v_currency,
        FALSE AS is_reused,
        FALSE AS is_ignored;

    RETURN;
END;
$process_paystack_invoice_create$;

REVOKE ALL
ON FUNCTION public.process_paystack_invoice_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_invoice_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_invoice_create(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified Paystack invoice.create webhook event, creating pending invoice lifecycle projections for active or past-due subscriptions with strict idempotency and audit logging.';

CREATE OR REPLACE FUNCTION public.process_paystack_invoice_payment_failed(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_invoice_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_status pg_catalog.text DEFAULT NULL,
    p_provider_transaction_id pg_catalog.text DEFAULT NULL,
    p_provider_reference pg_catalog.text DEFAULT NULL,
    p_failure_category pg_catalog.text DEFAULT NULL,
    p_amount_minor pg_catalog.int8 DEFAULT NULL,
    p_currency pg_catalog.text DEFAULT NULL,
    p_period_start pg_catalog.timestamptz DEFAULT NULL,
    p_period_end pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    invoice_id pg_catalog.uuid,
    payment_id pg_catalog.uuid,
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_invoice_code pg_catalog.text,
    invoice_status pg_catalog.text,
    subscription_status pg_catalog.text,
    amount_minor pg_catalog.int8,
    currency pg_catalog.text,
    past_due_since pg_catalog.timestamptz,
    failure_category pg_catalog.text,
    is_reused pg_catalog.bool,
    is_ignored pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_invoice_payment_failed$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_event_id pg_catalog.text;
    v_provider_invoice_code pg_catalog.text;
    v_provider_subscription_code pg_catalog.text;
    v_provider_customer_code pg_catalog.text;
    v_provider_status pg_catalog.text;
    v_provider_transaction_id pg_catalog.text;
    v_provider_reference pg_catalog.text;
    v_failure_category pg_catalog.text;
    v_currency pg_catalog.text;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;
    v_existing_invoice public.billing_invoices%ROWTYPE;
    v_existing_payment public.billing_payments%ROWTYPE;

    v_webhook_event_id pg_catalog.uuid;
    v_invoice_id pg_catalog.uuid;
    v_payment_id pg_catalog.uuid := NULL;
    v_invoice_status pg_catalog.text;
    v_final_subscription_status pg_catalog.text;
    v_final_past_due_since pg_catalog.timestamptz;

    v_is_reused pg_catalog.bool := FALSE;
    v_is_ignored pg_catalog.bool := FALSE;

    v_record_invoice_failed_ledger pg_catalog.bool := FALSE;
    v_record_subscription_past_due_ledger pg_catalog.bool := FALSE;
    v_record_payment_failed_ledger pg_catalog.bool := FALSE;

    v_payment_ref pg_catalog.text;
    v_payment_idempotency_key pg_catalog.uuid;

    v_ledger_dedup_key pg_catalog.text;
    v_ledger_event_type pg_catalog.text;
    v_ledger_event_data pg_catalog.jsonb;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL THEN
        RAISE EXCEPTION 'p_environment is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL THEN
        RAISE EXCEPTION 'p_payload_sha256 is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 lowercase hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := p_payload_sha256;

    IF p_provider_event_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_event_id) = 0
           OR p_provider_event_id ~ '[[:cntrl:]]'
           OR p_provider_event_id <> pg_catalog.btrim(p_provider_event_id)
           OR pg_catalog.char_length(p_provider_event_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider event ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_event_id := p_provider_event_id;
    ELSE
        v_provider_event_id := NULL;
    END IF;

    IF p_provider_invoice_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_invoice_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_invoice_code !~ '^INV_[a-zA-Z0-9_\-]+$'
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_invoice_code)) < 5
       OR p_provider_invoice_code <> pg_catalog.btrim(p_provider_invoice_code)
       OR pg_catalog.char_length(p_provider_invoice_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider invoice code format "%".', p_provider_invoice_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_invoice_code := p_provider_invoice_code;

    IF p_provider_subscription_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_subscription_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$'
       OR p_provider_subscription_code <> pg_catalog.btrim(p_provider_subscription_code)
       OR pg_catalog.char_length(p_provider_subscription_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_subscription_code := p_provider_subscription_code;

    IF p_provider_customer_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_customer_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
       OR p_provider_customer_code <> pg_catalog.btrim(p_provider_customer_code)
       OR pg_catalog.char_length(p_provider_customer_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_customer_code := p_provider_customer_code;

    IF p_provider_status IS NULL THEN
        RAISE EXCEPTION 'p_provider_status is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_status <> 'failed' THEN
        RAISE EXCEPTION 'Invalid provider invoice status "%". Must be "failed".', p_provider_status
            USING ERRCODE = '22023';
    END IF;
    v_provider_status := p_provider_status;

    IF p_failure_category IS NULL THEN
        RAISE EXCEPTION 'p_failure_category is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_failure_category NOT IN ('insufficient_funds', 'card_expired', 'issuer_declined', 'processing_error', 'unknown_failure') THEN
        RAISE EXCEPTION 'Invalid failure category "%".', p_failure_category
            USING ERRCODE = '22023';
    END IF;
    v_failure_category := p_failure_category;

    IF p_amount_minor IS NULL THEN
        RAISE EXCEPTION 'p_amount_minor is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_amount_minor <= 0 OR p_amount_minor > 2147483647 THEN
        RAISE EXCEPTION 'Invalid amount % minor units.', p_amount_minor
            USING ERRCODE = '22023';
    END IF;

    IF p_currency IS NULL THEN
        RAISE EXCEPTION 'p_currency is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Invalid currency "%". Must be 3 uppercase letters.', p_currency
            USING ERRCODE = '22023';
    END IF;
    v_currency := p_currency;

    IF p_period_start IS NULL THEN
        RAISE EXCEPTION 'p_period_start is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_period_end IS NULL THEN
        RAISE EXCEPTION 'p_period_end is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_period_end <= p_period_start THEN
        RAISE EXCEPTION 'p_period_end must be strictly greater than p_period_start.'
            USING ERRCODE = '22023';
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_provider_transaction_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_transaction_id) = 0
           OR p_provider_transaction_id ~ '[[:cntrl:]]'
           OR p_provider_transaction_id <> pg_catalog.btrim(p_provider_transaction_id)
           OR pg_catalog.char_length(p_provider_transaction_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider transaction ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_transaction_id := p_provider_transaction_id;
    ELSE
        v_provider_transaction_id := NULL;
    END IF;

    IF p_provider_reference IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_reference) = 0
           OR p_provider_reference ~ '[[:cntrl:]]'
           OR p_provider_reference <> pg_catalog.btrim(p_provider_reference)
           OR pg_catalog.char_length(p_provider_reference) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider reference.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_reference := p_provider_reference;
    ELSE
        v_provider_reference := NULL;
    END IF;

    -- 2. Webhook Claim & Inbox Insertion (Insertion-First Pattern)
    INSERT INTO public.billing_webhook_events (
        provider,
        environment,
        event_type,
        provider_event_id,
        provider_object_id,
        payload_sha256,
        raw_payload,
        signature_verified,
        processing_status,
        processing_attempts,
        received_at,
        processing_started_at,
        updated_at
    ) VALUES (
        'paystack',
        v_environment,
        'invoice.payment_failed',
        v_provider_event_id,
        v_provider_invoice_code,
        v_payload_sha256,
        pg_catalog.jsonb_build_object(
            'provider', 'paystack',
            'environment', v_environment,
            'event_type', 'invoice.payment_failed',
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_status,
            'provider_transaction_id', v_provider_transaction_id,
            'provider_reference', v_provider_reference,
            'failure_category', v_failure_category,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'occurred_at', p_occurred_at
        ),
        TRUE,
        'processing',
        1,
        p_occurred_at,
        v_now,
        v_now
    )
    ON CONFLICT (provider, environment, payload_sha256)
    DO NOTHING
    RETURNING id INTO v_webhook_event_id;

    IF v_webhook_event_id IS NULL THEN
        -- Conflicting transaction already claimed or processed this exact payload hash
        SELECT bwe.*
        INTO v_existing_webhook
        FROM public.billing_webhook_events AS bwe
        WHERE bwe.provider = 'paystack'
          AND bwe.environment = v_environment
          AND bwe.payload_sha256 = v_payload_sha256
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Concurrent transaction rolled back while claiming webhook payload. Please retry.'
                USING ERRCODE = '40001';
        END IF;

        -- Check for payload hash collision with conflicting identifiers
        IF v_existing_webhook.event_type <> 'invoice.payment_failed'
           OR v_existing_webhook.provider_object_id IS DISTINCT FROM v_provider_invoice_code
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        v_webhook_event_id := v_existing_webhook.id;

        IF v_existing_webhook.processing_status IN ('processed', 'ignored') THEN
            v_is_reused := TRUE;
            v_is_ignored := (v_existing_webhook.processing_status = 'ignored');
        ELSIF v_existing_webhook.processing_status IN ('received', 'processing') THEN
            RAISE EXCEPTION 'Webhook payload is currently being processed by a concurrent transaction. Please retry.'
                USING ERRCODE = '40001';
        ELSIF v_existing_webhook.processing_status = 'failed' THEN
            RAISE EXCEPTION 'Webhook payload processing previously failed. Manual inspection or retry required.'
                USING ERRCODE = '40001';
        ELSE
            RAISE EXCEPTION 'Unknown webhook processing status "%".', v_existing_webhook.processing_status
                USING ERRCODE = 'XX000';
        END IF;
    END IF;

    -- 3. Resolve & Lock Provider Subscription
    SELECT bps.*
    INTO v_provider_subscription
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.provider_subscription_code = v_provider_subscription_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider subscription not found for code % in % environment.',
            v_provider_subscription_code, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    IF v_provider_subscription.provider_customer_code <> v_provider_customer_code THEN
        RAISE EXCEPTION 'Provider customer code % does not match customer % on provider subscription %.',
            v_provider_customer_code, v_provider_subscription.provider_customer_code, v_provider_subscription_code
            USING ERRCODE = 'P0002';
    END IF;

    -- 4. Resolve & Lock Linked Internal Subscription
    SELECT bs.*
    INTO v_subscription
    FROM public.billing_subscriptions AS bs
    WHERE bs.id = v_provider_subscription.subscription_id
      AND bs.company_id = v_provider_subscription.company_id
      AND bs.plan_id = v_provider_subscription.plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked billing subscription % not found for company % and plan %.',
            v_provider_subscription.subscription_id,
            v_provider_subscription.company_id,
            v_provider_subscription.plan_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Commercial snapshot verification
    IF v_subscription.amount_minor <> p_amount_minor
       OR v_subscription.currency <> v_currency
    THEN
        RAISE EXCEPTION 'Commercial snapshot mismatch for subscription %: expected % %, received % %.',
            v_subscription.id, v_subscription.amount_minor, v_subscription.currency, p_amount_minor, v_currency
            USING ERRCODE = '23514';
    END IF;

    -- 5. Resolve Existing Invoice & Existing Payment (if any)
    SELECT bi.*
    INTO v_existing_invoice
    FROM public.billing_invoices AS bi
    WHERE bi.provider = 'paystack'
      AND bi.environment = v_environment
      AND bi.provider_invoice_code = v_provider_invoice_code
    FOR UPDATE;

    IF v_existing_invoice.id IS NOT NULL THEN
        -- Verify that identity matches exactly
        IF v_existing_invoice.company_id <> v_subscription.company_id
           OR v_existing_invoice.subscription_id <> v_subscription.id
           OR v_existing_invoice.provider_subscription_record_id <> v_provider_subscription.id
        THEN
            RAISE EXCEPTION 'Conflicting invoice identity for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        END IF;

        -- Verify commercial snapshot matches
        IF v_existing_invoice.amount_minor <> p_amount_minor
           OR v_existing_invoice.currency <> v_currency
        THEN
            RAISE EXCEPTION 'Conflicting commercial snapshot for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;

        -- Verify period dates match
        IF v_existing_invoice.period_start IS DISTINCT FROM p_period_start
           OR v_existing_invoice.period_end IS DISTINCT FROM p_period_end
        THEN
            RAISE EXCEPTION 'Conflicting period dates for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF v_provider_transaction_id IS NOT NULL OR v_provider_reference IS NOT NULL THEN
        SELECT bp.*
        INTO v_existing_payment
        FROM public.billing_payments AS bp
        WHERE bp.provider = 'paystack'
          AND bp.environment = v_environment
          AND (
            (v_provider_transaction_id IS NOT NULL AND bp.provider_transaction_id = v_provider_transaction_id)
            OR (v_provider_reference IS NOT NULL AND bp.provider_reference = v_provider_reference)
          )
        FOR UPDATE;

        IF v_existing_payment.id IS NOT NULL THEN
            IF v_existing_payment.company_id <> v_subscription.company_id
               OR v_existing_payment.subscription_id <> v_subscription.id
            THEN
                RAISE EXCEPTION 'Conflicting payment identity for company or subscription.'
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_payment.amount_minor <> p_amount_minor
               OR v_existing_payment.currency <> v_currency
               OR v_existing_payment.purpose <> 'renewal'
            THEN
                RAISE EXCEPTION 'Conflicting commercial snapshot or purpose for payment.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_existing_payment.billing_invoice_id IS NOT NULL
               AND v_existing_invoice.id IS NOT NULL
               AND v_existing_payment.billing_invoice_id <> v_existing_invoice.id
            THEN
                RAISE EXCEPTION 'Payment already linked to a different billing invoice.'
                    USING ERRCODE = '23505';
            END IF;
        END IF;
    END IF;

    -- 6. Exact Replay Handling: Return early without mutations or duplicate ledger insertions
    IF v_is_reused THEN
        RETURN QUERY
        SELECT
            v_webhook_event_id,
            v_existing_invoice.id,
            v_existing_payment.id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_invoice_code,
            v_existing_invoice.status,
            v_subscription.status,
            p_amount_minor,
            v_currency,
            v_subscription.past_due_since,
            v_failure_category,
            TRUE AS is_reused,
            v_is_ignored AS is_ignored;
        RETURN;
    END IF;

    -- 7. Subscription Lifecycle Validation & Stale Success Rules
    IF v_subscription.status IN ('pending_activation', 'trialing') THEN
        RAISE EXCEPTION 'Cannot process invoice.payment_failed for subscription % in % state.',
            v_subscription.id, v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    IF v_subscription.status IN ('non_renewing', 'expired', 'cancelled')
       OR (v_existing_invoice.id IS NOT NULL AND v_existing_invoice.status = 'paid')
       OR (v_subscription.status = 'active' AND (v_subscription.current_period_end > p_period_end OR v_subscription.current_period_start >= p_period_end))
    THEN
        -- Stale failure event: ignore without transitioning subscription to past_due
        v_is_ignored := TRUE;
        v_ledger_event_type := 'billing_invoice_payment_failed_ignored';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':payment_failed_ignored:' || v_payload_sha256;

        UPDATE public.billing_webhook_events AS bwe_ign
        SET processing_status = 'ignored',
            processed_at = v_now,
            updated_at = v_now
        WHERE bwe_ign.id = v_webhook_event_id;

        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_existing_invoice.id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_status,
            'provider_transaction_id', v_provider_transaction_id,
            'provider_reference', v_provider_reference,
            'failure_category', v_failure_category,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'occurred_at', p_occurred_at,
            'reason', 'stale_event',
            'subscription_status', v_subscription.status,
            'invoice_status', v_existing_invoice.status,
            'is_ignored', TRUE
        );

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
              AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = v_ledger_event_type
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_subscription.company_id,
                v_subscription.id,
                v_existing_payment.id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;

        RETURN QUERY
        SELECT
            v_webhook_event_id,
            v_existing_invoice.id,
            v_existing_payment.id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_invoice_code,
            v_existing_invoice.status,
            v_subscription.status,
            p_amount_minor,
            v_currency,
            v_subscription.past_due_since,
            v_failure_category,
            FALSE AS is_reused,
            TRUE AS is_ignored;
        RETURN;
    END IF;

    -- 8. Invoice Materialization / Transition to 'failed'
    IF v_existing_invoice.id IS NULL THEN
        -- Materialize new invoice directly as failed
        INSERT INTO public.billing_invoices (
            company_id,
            subscription_id,
            provider_subscription_record_id,
            provider,
            environment,
            provider_invoice_code,
            status,
            provider_status,
            amount_minor,
            currency,
            period_start,
            period_end,
            first_failed_at,
            paid_at,
            created_at,
            updated_at
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            v_provider_subscription.id,
            'paystack',
            v_environment,
            v_provider_invoice_code,
            'failed',
            v_provider_status,
            p_amount_minor::pg_catalog.int4,
            v_currency,
            p_period_start,
            p_period_end,
            p_occurred_at,
            NULL,
            v_now,
            v_now
        )
        RETURNING id INTO v_invoice_id;

        v_invoice_status := 'failed';
        v_record_invoice_failed_ledger := TRUE;
    ELSIF v_existing_invoice.status = 'pending' THEN
        -- Transition existing pending invoice to failed
        UPDATE public.billing_invoices
        SET status = 'failed',
            provider_status = v_provider_status,
            first_failed_at = p_occurred_at,
            updated_at = v_now
        WHERE id = v_existing_invoice.id;

        v_invoice_id := v_existing_invoice.id;
        v_invoice_status := 'failed';
        v_record_invoice_failed_ledger := TRUE;
    ELSE
        -- Existing invoice is already failed
        v_invoice_id := v_existing_invoice.id;
        v_invoice_status := v_existing_invoice.status;
        v_record_invoice_failed_ledger := FALSE;
    END IF;

    -- 9. Optional Genuine Failed Payment Attempt Recording
    IF v_existing_payment.id IS NOT NULL THEN
        IF v_existing_payment.status IN ('initialized', 'pending') THEN
            UPDATE public.billing_payments
            SET status = 'failed',
                failed_at = p_occurred_at,
                error_code = v_failure_category,
                error_message = v_failure_category,
                billing_invoice_id = COALESCE(billing_invoice_id, v_invoice_id),
                updated_at = v_now
            WHERE id = v_existing_payment.id;

            v_payment_id := v_existing_payment.id;
            v_record_payment_failed_ledger := TRUE;
        ELSE
            -- Already failed or succeeded
            v_payment_id := v_existing_payment.id;
            v_record_payment_failed_ledger := FALSE;
        END IF;
    ELSIF v_provider_transaction_id IS NOT NULL OR v_provider_reference IS NOT NULL THEN
        v_payment_ref := COALESCE(v_provider_reference, 'txn_' || v_provider_transaction_id);
        v_payment_idempotency_key := pg_catalog.md5('paystack:' || v_environment || ':payment:' || COALESCE(v_provider_transaction_id, v_provider_reference) || ':failed')::pg_catalog.uuid;

        INSERT INTO public.billing_payments (
            company_id,
            subscription_id,
            plan_id,
            provider_plan_mapping_id,
            provider,
            environment,
            purpose,
            idempotency_key,
            provider_reference,
            provider_transaction_id,
            amount_minor,
            currency,
            customer_email,
            status,
            error_code,
            error_message,
            failed_at,
            billing_invoice_id,
            created_at,
            updated_at
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            v_subscription.plan_id,
            v_provider_subscription.provider_plan_mapping_id,
            'paystack',
            v_environment,
            'renewal',
            v_payment_idempotency_key,
            v_payment_ref,
            v_provider_transaction_id,
            p_amount_minor::pg_catalog.int4,
            v_currency,
            v_provider_subscription.customer_email,
            'failed',
            v_failure_category,
            v_failure_category,
            p_occurred_at,
            v_invoice_id,
            v_now,
            v_now
        )
        RETURNING id INTO v_payment_id;

        v_record_payment_failed_ledger := TRUE;
    ELSE
        v_payment_id := NULL;
        v_record_payment_failed_ledger := FALSE;
    END IF;

    -- 10. Subscription Transition to 'past_due'
    IF v_subscription.status = 'active' THEN
        UPDATE public.billing_subscriptions
        SET status = 'past_due',
            past_due_since = p_occurred_at,
            updated_at = v_now
        WHERE id = v_subscription.id;

        v_final_subscription_status := 'past_due';
        v_final_past_due_since := p_occurred_at;
        v_record_subscription_past_due_ledger := TRUE;
    ELSIF v_subscription.status = 'past_due' THEN
        v_final_subscription_status := 'past_due';
        IF v_subscription.past_due_since IS NULL THEN
            v_final_past_due_since := p_occurred_at;
        ELSIF p_occurred_at < v_subscription.past_due_since THEN
            v_final_past_due_since := p_occurred_at;
        ELSE
            v_final_past_due_since := v_subscription.past_due_since;
        END IF;

        IF v_subscription.past_due_since IS DISTINCT FROM v_final_past_due_since THEN
            UPDATE public.billing_subscriptions
            SET past_due_since = v_final_past_due_since,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
        v_record_subscription_past_due_ledger := FALSE;
    END IF;

    -- 11. Mark Webhook Processed
    UPDATE public.billing_webhook_events
    SET processing_status = 'processed',
        processed_at = v_now,
        updated_at = v_now
    WHERE id = v_webhook_event_id;

    -- 12. Append Immutable Ledger Entries
    IF v_record_invoice_failed_ledger THEN
        v_ledger_event_type := 'billing_invoice_failed';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':failed';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'payment_id', v_payment_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_status,
            'failure_category', v_failure_category,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'occurred_at', p_occurred_at,
            'invoice_status', 'failed',
            'subscription_status', v_final_subscription_status
        );

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
              AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = v_ledger_event_type
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_subscription.company_id,
                v_subscription.id,
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    IF v_record_subscription_past_due_ledger THEN
        v_ledger_event_type := 'subscription_payment_past_due';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':subscription_past_due';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'failure_category', v_failure_category,
            'occurred_at', p_occurred_at,
            'previous_status', 'active',
            'current_status', 'past_due',
            'past_due_since', v_final_past_due_since
        );

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
              AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = v_ledger_event_type
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_subscription.company_id,
                v_subscription.id,
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    IF v_record_payment_failed_ledger AND v_payment_id IS NOT NULL THEN
        v_ledger_event_type := 'renewal_payment_failed';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':payment:' || COALESCE(v_provider_transaction_id, v_provider_reference) || ':failed';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'payment_id', v_payment_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_reference', v_payment_ref,
            'provider_transaction_id', v_provider_transaction_id,
            'failure_category', v_failure_category,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'failed_at', p_occurred_at
        );

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
              AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = v_ledger_event_type
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for payment %.', COALESCE(v_provider_transaction_id, v_provider_reference)
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_subscription.company_id,
                v_subscription.id,
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    -- 13. Return Single Row Result
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_invoice_id,
        v_payment_id,
        v_provider_subscription.id,
        v_subscription.id,
        v_provider_invoice_code,
        v_invoice_status,
        v_final_subscription_status,
        p_amount_minor,
        v_currency,
        v_final_past_due_since,
        v_failure_category,
        FALSE AS is_reused,
        FALSE AS is_ignored;

    RETURN;
END;
$process_paystack_invoice_payment_failed$;

REVOKE ALL
ON FUNCTION public.process_paystack_invoice_payment_failed(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_invoice_payment_failed(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_invoice_payment_failed(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified Paystack invoice.payment_failed webhook event, materializing or transitioning invoices to failed, optionally recording genuine failed payments, transitioning subscriptions to past_due, and appending immutable ledger events.';


-- ============================================================================
-- Process Paystack invoice.update Success Database RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_paystack_invoice_update_success(
    p_environment pg_catalog.text,
    p_payload_sha256 pg_catalog.text,
    p_provider_event_id pg_catalog.text DEFAULT NULL,
    p_provider_invoice_code pg_catalog.text DEFAULT NULL,
    p_provider_subscription_code pg_catalog.text DEFAULT NULL,
    p_provider_customer_code pg_catalog.text DEFAULT NULL,
    p_provider_plan_code pg_catalog.text DEFAULT NULL,
    p_provider_invoice_status pg_catalog.text DEFAULT NULL,
    p_provider_paid pg_catalog.bool DEFAULT NULL,
    p_provider_transaction_status pg_catalog.text DEFAULT NULL,
    p_provider_transaction_id pg_catalog.text DEFAULT NULL,
    p_provider_reference pg_catalog.text DEFAULT NULL,
    p_amount_minor pg_catalog.int8 DEFAULT NULL,
    p_currency pg_catalog.text DEFAULT NULL,
    p_period_start pg_catalog.timestamptz DEFAULT NULL,
    p_period_end pg_catalog.timestamptz DEFAULT NULL,
    p_paid_at pg_catalog.timestamptz DEFAULT NULL,
    p_next_payment_date pg_catalog.timestamptz DEFAULT NULL,
    p_occurred_at pg_catalog.timestamptz DEFAULT NULL
)
RETURNS TABLE (
    webhook_event_id pg_catalog.uuid,
    invoice_id pg_catalog.uuid,
    payment_id pg_catalog.uuid,
    provider_subscription_record_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    provider_invoice_code pg_catalog.text,
    invoice_status pg_catalog.text,
    payment_status pg_catalog.text,
    subscription_status pg_catalog.text,
    amount_minor pg_catalog.int8,
    currency pg_catalog.text,
    current_period_start pg_catalog.timestamptz,
    current_period_end pg_catalog.timestamptz,
    next_renewal_at pg_catalog.timestamptz,
    past_due_since pg_catalog.timestamptz,
    is_reused pg_catalog.bool,
    is_ignored pg_catalog.bool
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $process_paystack_invoice_update_success$
DECLARE
    v_now pg_catalog.timestamptz;
    v_environment pg_catalog.text;
    v_payload_sha256 pg_catalog.text;
    v_provider_event_id pg_catalog.text;
    v_provider_invoice_code pg_catalog.text;
    v_provider_subscription_code pg_catalog.text;
    v_provider_customer_code pg_catalog.text;
    v_provider_plan_code pg_catalog.text;
    v_provider_invoice_status pg_catalog.text;
    v_provider_transaction_status pg_catalog.text;
    v_provider_transaction_id pg_catalog.text;
    v_provider_reference pg_catalog.text;
    v_currency pg_catalog.text;

    v_existing_webhook public.billing_webhook_events%ROWTYPE;
    v_provider_subscription public.billing_provider_subscriptions%ROWTYPE;
    v_provider_plan public.billing_provider_plans%ROWTYPE;
    v_subscription public.billing_subscriptions%ROWTYPE;
    v_existing_invoice public.billing_invoices%ROWTYPE;
    v_existing_payment public.billing_payments%ROWTYPE;
    v_existing_invoice_success_payment public.billing_payments%ROWTYPE;

    v_webhook_event_id pg_catalog.uuid;
    v_invoice_id pg_catalog.uuid;
    v_payment_id pg_catalog.uuid;
    v_payment_ref pg_catalog.text;
    v_payment_idempotency_key pg_catalog.uuid;

    v_invoice_status pg_catalog.text;
    v_payment_status pg_catalog.text;
    v_final_subscription_status pg_catalog.text;
    v_final_past_due_since pg_catalog.timestamptz;
    v_final_current_period_start pg_catalog.timestamptz;
    v_final_current_period_end pg_catalog.timestamptz;
    v_final_next_renewal_at pg_catalog.timestamptz;

    v_is_reused pg_catalog.bool := FALSE;
    v_is_ignored pg_catalog.bool := FALSE;
    v_should_advance_period pg_catalog.bool := FALSE;
    v_record_invoice_paid_ledger pg_catalog.bool := FALSE;
    v_record_payment_succeeded_ledger pg_catalog.bool := FALSE;
    v_record_subscription_recovered_ledger pg_catalog.bool := FALSE;

    v_ledger_dedup_key pg_catalog.text;
    v_ledger_event_type pg_catalog.text;
    v_ledger_event_data pg_catalog.jsonb;
BEGIN
    -- 1. Input Validation
    v_now := pg_catalog.now();

    IF p_environment IS NULL THEN
        RAISE EXCEPTION 'p_environment is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_environment NOT IN ('test', 'live') THEN
        RAISE EXCEPTION 'Invalid environment "%". Must be "test" or "live".', p_environment
            USING ERRCODE = '22023';
    END IF;
    v_environment := p_environment;

    IF p_payload_sha256 IS NULL THEN
        RAISE EXCEPTION 'p_payload_sha256 is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid payload SHA-256 hash. Must be 64 lowercase hexadecimal characters.'
            USING ERRCODE = '22023';
    END IF;
    v_payload_sha256 := p_payload_sha256;

    IF p_provider_event_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_event_id) = 0
           OR p_provider_event_id ~ '[[:cntrl:]]'
           OR p_provider_event_id <> pg_catalog.btrim(p_provider_event_id)
           OR pg_catalog.char_length(p_provider_event_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider event ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_event_id := p_provider_event_id;
    ELSE
        v_provider_event_id := NULL;
    END IF;

    IF p_provider_invoice_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_invoice_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_invoice_code !~ '^INV_[a-zA-Z0-9_\-]+$'
       OR pg_catalog.char_length(pg_catalog.btrim(p_provider_invoice_code)) < 5
       OR p_provider_invoice_code <> pg_catalog.btrim(p_provider_invoice_code)
       OR pg_catalog.char_length(p_provider_invoice_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider invoice code format "%".', p_provider_invoice_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_invoice_code := p_provider_invoice_code;

    IF p_provider_subscription_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_subscription_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_subscription_code !~ '^SUB_[A-Za-z0-9]+$'
       OR p_provider_subscription_code <> pg_catalog.btrim(p_provider_subscription_code)
       OR pg_catalog.char_length(p_provider_subscription_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider subscription code format "%".', p_provider_subscription_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_subscription_code := p_provider_subscription_code;

    IF p_provider_customer_code IS NULL THEN
        RAISE EXCEPTION 'p_provider_customer_code is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_customer_code !~ '^CUS_[A-Za-z0-9]+$'
       OR p_provider_customer_code <> pg_catalog.btrim(p_provider_customer_code)
       OR pg_catalog.char_length(p_provider_customer_code) > 255
    THEN
        RAISE EXCEPTION 'Invalid provider customer code format "%".', p_provider_customer_code
            USING ERRCODE = '22023';
    END IF;
    v_provider_customer_code := p_provider_customer_code;

    IF p_provider_plan_code IS NOT NULL THEN
        IF p_provider_plan_code !~ '^PLN_[A-Za-z0-9]+$'
           OR p_provider_plan_code <> pg_catalog.btrim(p_provider_plan_code)
           OR pg_catalog.char_length(p_provider_plan_code) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider plan code format "%".', p_provider_plan_code
                USING ERRCODE = '22023';
        END IF;
        v_provider_plan_code := p_provider_plan_code;
    ELSE
        v_provider_plan_code := NULL;
    END IF;

    IF p_provider_invoice_status IS NULL THEN
        RAISE EXCEPTION 'p_provider_invoice_status is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_invoice_status <> 'success' THEN
        RAISE EXCEPTION 'Invalid provider invoice status "%". Must be "success".', p_provider_invoice_status
            USING ERRCODE = '22023';
    END IF;
    v_provider_invoice_status := p_provider_invoice_status;

    IF p_provider_paid IS NULL THEN
        RAISE EXCEPTION 'p_provider_paid is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_provider_paid IS NOT TRUE THEN
        RAISE EXCEPTION 'p_provider_paid must be true for successful invoice.update.'
            USING ERRCODE = '22023';
    END IF;

    IF p_provider_transaction_status IS NOT NULL THEN
        IF p_provider_transaction_status <> 'success' THEN
            RAISE EXCEPTION 'Invalid provider transaction status "%". Must be "success".', p_provider_transaction_status
                USING ERRCODE = '22023';
        END IF;
        v_provider_transaction_status := p_provider_transaction_status;
    ELSE
        v_provider_transaction_status := NULL;
    END IF;

    IF p_amount_minor IS NULL THEN
        RAISE EXCEPTION 'p_amount_minor is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_amount_minor <= 0 OR p_amount_minor > 2147483647 THEN
        RAISE EXCEPTION 'Invalid amount % minor units.', p_amount_minor
            USING ERRCODE = '22023';
    END IF;

    IF p_currency IS NULL THEN
        RAISE EXCEPTION 'p_currency is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_currency !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'Invalid currency "%". Must be 3 uppercase letters.', p_currency
            USING ERRCODE = '22023';
    END IF;
    v_currency := p_currency;

    IF p_period_start IS NULL THEN
        RAISE EXCEPTION 'p_period_start is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_period_end IS NULL THEN
        RAISE EXCEPTION 'p_period_end is required.'
            USING ERRCODE = '22004';
    END IF;
    IF p_period_end <= p_period_start THEN
        RAISE EXCEPTION 'p_period_end must be strictly greater than p_period_start.'
            USING ERRCODE = '22023';
    END IF;

    IF p_paid_at IS NULL THEN
        RAISE EXCEPTION 'p_paid_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_next_payment_date IS NOT NULL THEN
        IF p_next_payment_date < p_period_end THEN
            RAISE EXCEPTION 'p_next_payment_date cannot be earlier than p_period_end.'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    IF p_occurred_at IS NULL THEN
        RAISE EXCEPTION 'p_occurred_at timestamp is required.'
            USING ERRCODE = '22004';
    END IF;

    IF p_provider_transaction_id IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_transaction_id) = 0
           OR p_provider_transaction_id ~ '[[:cntrl:]]'
           OR p_provider_transaction_id <> pg_catalog.btrim(p_provider_transaction_id)
           OR pg_catalog.char_length(p_provider_transaction_id) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider transaction ID.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_transaction_id := p_provider_transaction_id;
    ELSE
        v_provider_transaction_id := NULL;
    END IF;

    IF p_provider_reference IS NOT NULL THEN
        IF pg_catalog.char_length(p_provider_reference) = 0
           OR p_provider_reference ~ '[[:cntrl:]]'
           OR p_provider_reference <> pg_catalog.btrim(p_provider_reference)
           OR pg_catalog.char_length(p_provider_reference) > 255
        THEN
            RAISE EXCEPTION 'Invalid provider reference.'
                USING ERRCODE = '22023';
        END IF;
        v_provider_reference := p_provider_reference;
    ELSE
        v_provider_reference := NULL;
    END IF;

    -- 2. Webhook Claim & Inbox Insertion (Insertion-First Pattern)
    INSERT INTO public.billing_webhook_events (
        provider,
        environment,
        event_type,
        provider_event_id,
        provider_object_id,
        payload_sha256,
        raw_payload,
        signature_verified,
        processing_status,
        processing_attempts,
        received_at,
        processing_started_at,
        updated_at
    ) VALUES (
        'paystack',
        v_environment,
        'invoice.update',
        v_provider_event_id,
        v_provider_invoice_code,
        v_payload_sha256,
        pg_catalog.jsonb_build_object(
            'provider', 'paystack',
            'environment', v_environment,
            'event_type', 'invoice.update',
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_plan_code', v_provider_plan_code,
            'provider_invoice_status', v_provider_invoice_status,
            'provider_paid', p_provider_paid,
            'provider_transaction_status', v_provider_transaction_status,
            'provider_transaction_id', v_provider_transaction_id,
            'provider_reference', v_provider_reference,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'paid_at', p_paid_at,
            'next_payment_date', p_next_payment_date,
            'occurred_at', p_occurred_at
        ),
        TRUE,
        'processing',
        1,
        p_occurred_at,
        v_now,
        v_now
    )
    ON CONFLICT (provider, environment, payload_sha256)
    DO NOTHING
    RETURNING id INTO v_webhook_event_id;

    IF v_webhook_event_id IS NULL THEN
        -- Conflicting transaction already claimed or processed this exact payload hash
        SELECT bwe.*
        INTO v_existing_webhook
        FROM public.billing_webhook_events AS bwe
        WHERE bwe.provider = 'paystack'
          AND bwe.environment = v_environment
          AND bwe.payload_sha256 = v_payload_sha256
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Concurrent transaction rolled back while claiming webhook payload. Please retry.'
                USING ERRCODE = '40001';
        END IF;

        -- Check for payload hash collision with conflicting identifiers
        IF v_existing_webhook.event_type <> 'invoice.update'
           OR v_existing_webhook.provider_object_id IS DISTINCT FROM v_provider_invoice_code
        THEN
            RAISE EXCEPTION 'Payload hash collision for webhook event with conflicting identifiers.'
                USING ERRCODE = '23505';
        END IF;

        v_webhook_event_id := v_existing_webhook.id;

        IF v_existing_webhook.processing_status IN ('processed', 'ignored') THEN
            v_is_reused := TRUE;
            v_is_ignored := (v_existing_webhook.processing_status = 'ignored');
        ELSIF v_existing_webhook.processing_status IN ('received', 'processing') THEN
            RAISE EXCEPTION 'Webhook payload is currently being processed by a concurrent transaction. Please retry.'
                USING ERRCODE = '40001';
        ELSIF v_existing_webhook.processing_status = 'failed' THEN
            RAISE EXCEPTION 'Webhook payload processing previously failed. Manual inspection or retry required.'
                USING ERRCODE = '40001';
        ELSE
            RAISE EXCEPTION 'Unknown webhook processing status "%".', v_existing_webhook.processing_status
                USING ERRCODE = 'XX000';
        END IF;
    END IF;

    -- 3. Resolve & Lock Provider Subscription
    SELECT bps.*
    INTO v_provider_subscription
    FROM public.billing_provider_subscriptions AS bps
    WHERE bps.provider = 'paystack'
      AND bps.environment = v_environment
      AND bps.provider_subscription_code = v_provider_subscription_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Provider subscription not found for code % in % environment.',
            v_provider_subscription_code, v_environment
            USING ERRCODE = 'P0002';
    END IF;

    IF v_provider_subscription.provider_customer_code <> v_provider_customer_code THEN
        RAISE EXCEPTION 'Provider customer code % does not match customer % on provider subscription %.',
            v_provider_customer_code, v_provider_subscription.provider_customer_code, v_provider_subscription_code
            USING ERRCODE = 'P0002';
    END IF;

    IF v_provider_plan_code IS NOT NULL THEN
        SELECT bpp.*
        INTO v_provider_plan
        FROM public.billing_provider_plans AS bpp
        WHERE bpp.id = v_provider_subscription.provider_plan_mapping_id;

        IF NOT FOUND OR v_provider_plan.provider_plan_code <> v_provider_plan_code THEN
            RAISE EXCEPTION 'Provider plan code % does not match provider subscription %.',
                v_provider_plan_code, v_provider_subscription_code
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 4. Resolve & Lock Linked Internal Subscription
    SELECT bs.*
    INTO v_subscription
    FROM public.billing_subscriptions AS bs
    WHERE bs.id = v_provider_subscription.subscription_id
      AND bs.company_id = v_provider_subscription.company_id
      AND bs.plan_id = v_provider_subscription.plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked billing subscription % not found for company % and plan %.',
            v_provider_subscription.subscription_id,
            v_provider_subscription.company_id,
            v_provider_subscription.plan_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Commercial snapshot verification
    IF v_subscription.amount_minor <> p_amount_minor
       OR v_subscription.currency <> v_currency
    THEN
        RAISE EXCEPTION 'Commercial snapshot mismatch for subscription %: expected % %, received % %.',
            v_subscription.id, v_subscription.amount_minor, v_subscription.currency, p_amount_minor, v_currency
            USING ERRCODE = '23514';
    END IF;

    -- 5. Resolve Existing Invoice & Existing Payment (if any)
    SELECT bi.*
    INTO v_existing_invoice
    FROM public.billing_invoices AS bi
    WHERE bi.provider = 'paystack'
      AND bi.environment = v_environment
      AND bi.provider_invoice_code = v_provider_invoice_code
    FOR UPDATE;

    IF v_existing_invoice.id IS NOT NULL THEN
        -- Verify that identity matches exactly
        IF v_existing_invoice.company_id <> v_subscription.company_id
           OR v_existing_invoice.subscription_id <> v_subscription.id
           OR v_existing_invoice.provider_subscription_record_id <> v_provider_subscription.id
        THEN
            RAISE EXCEPTION 'Conflicting invoice identity for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        END IF;

        -- Verify commercial snapshot matches
        IF v_existing_invoice.amount_minor <> p_amount_minor
           OR v_existing_invoice.currency <> v_currency
        THEN
            RAISE EXCEPTION 'Conflicting commercial snapshot for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;

        -- Verify period dates match
        IF (v_existing_invoice.period_start IS NOT NULL AND v_existing_invoice.period_start IS DISTINCT FROM p_period_start)
           OR (v_existing_invoice.period_end IS NOT NULL AND v_existing_invoice.period_end IS DISTINCT FROM p_period_end)
        THEN
            RAISE EXCEPTION 'Conflicting period dates for provider invoice code %.', v_provider_invoice_code
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF v_provider_transaction_id IS NOT NULL OR v_provider_reference IS NOT NULL THEN
        SELECT bp.*
        INTO v_existing_payment
        FROM public.billing_payments AS bp
        WHERE bp.provider = 'paystack'
          AND bp.environment = v_environment
          AND (
            (v_provider_transaction_id IS NOT NULL AND bp.provider_transaction_id = v_provider_transaction_id)
            OR (v_provider_reference IS NOT NULL AND bp.provider_reference = v_provider_reference)
          )
        FOR UPDATE;

        IF v_existing_payment.id IS NOT NULL THEN
            IF v_provider_transaction_id IS NOT NULL
               AND v_existing_payment.provider_transaction_id IS NOT NULL
               AND v_existing_payment.provider_transaction_id <> v_provider_transaction_id
            THEN
                RAISE EXCEPTION 'Provider reference % is already associated with a different transaction ID.',
                    v_provider_reference
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_payment.company_id <> v_subscription.company_id
               OR v_existing_payment.subscription_id <> v_subscription.id
               OR v_existing_payment.plan_id <> v_subscription.plan_id
               OR v_existing_payment.provider_plan_mapping_id <> v_provider_subscription.provider_plan_mapping_id
            THEN
                RAISE EXCEPTION 'Conflicting payment identity for company, subscription, or plan.'
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_payment.amount_minor <> p_amount_minor
               OR v_existing_payment.currency <> v_currency
               OR v_existing_payment.purpose <> 'renewal'
            THEN
                RAISE EXCEPTION 'Conflicting commercial snapshot or purpose for payment.'
                    USING ERRCODE = '23514';
            END IF;

            IF v_existing_payment.billing_invoice_id IS NOT NULL
               AND (
                   v_existing_invoice.id IS NULL
                   OR v_existing_payment.billing_invoice_id <> v_existing_invoice.id
               )
            THEN
                RAISE EXCEPTION 'Payment already linked to a different billing invoice.'
                    USING ERRCODE = '23505';
            END IF;

            IF v_existing_payment.status IN ('failed', 'cancelled') THEN
                RAISE EXCEPTION 'A terminal % payment attempt cannot be rewritten as succeeded. A distinct successful provider reference is required.',
                    v_existing_payment.status
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        IF v_provider_transaction_id IS NOT NULL
           AND EXISTS (
               SELECT 1
               FROM public.billing_payments AS bp
               WHERE bp.provider = 'paystack'
                 AND bp.environment = v_environment
                 AND bp.provider_transaction_id = v_provider_transaction_id
                 AND (
                     v_existing_payment.id IS NULL
                     OR bp.id <> v_existing_payment.id
                 )
           )
        THEN
            RAISE EXCEPTION 'Provider transaction ID % is already associated with a different payment.',
                v_provider_transaction_id
                USING ERRCODE = '23505';
        END IF;

        IF v_existing_payment.status = 'succeeded'
           AND v_existing_payment.paid_at IS DISTINCT FROM p_paid_at
        THEN
            RAISE EXCEPTION 'Conflicting paid timestamp for provider reference %.', v_provider_reference
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF v_existing_invoice.id IS NOT NULL THEN
        SELECT bp.*
        INTO v_existing_invoice_success_payment
        FROM public.billing_payments AS bp
        WHERE bp.billing_invoice_id = v_existing_invoice.id
          AND bp.company_id = v_subscription.company_id
          AND bp.subscription_id = v_subscription.id
          AND bp.provider = 'paystack'
          AND bp.environment = v_environment
          AND bp.status = 'succeeded'
        ORDER BY bp.created_at ASC, bp.id ASC
        LIMIT 1
        FOR UPDATE;

        IF v_existing_invoice_success_payment.id IS NOT NULL
           AND (
               v_existing_payment.id IS NULL
               OR v_existing_invoice_success_payment.id <> v_existing_payment.id
           )
        THEN
            RAISE EXCEPTION 'Billing invoice % already has a different succeeded payment.', v_provider_invoice_code
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 6. Exact Replay Handling: Return early without mutations or duplicate ledger insertions
    IF v_is_reused THEN
        RETURN QUERY
        SELECT
            v_webhook_event_id,
            v_existing_invoice.id,
            v_existing_payment.id,
            v_provider_subscription.id,
            v_subscription.id,
            v_provider_invoice_code,
            v_existing_invoice.status,
            v_existing_payment.status,
            v_subscription.status,
            p_amount_minor,
            v_currency,
            v_subscription.current_period_start,
            v_subscription.current_period_end,
            v_subscription.next_renewal_at,
            v_subscription.past_due_since,
            TRUE AS is_reused,
            v_is_ignored AS is_ignored;
        RETURN;
    END IF;

    -- 7. Subscription Lifecycle Validation
    IF v_subscription.status IN ('pending_activation', 'trialing') THEN
        RAISE EXCEPTION 'Cannot process invoice.update for subscription % in % state.',
            v_subscription.id, v_subscription.status
            USING ERRCODE = '23514';
    END IF;

    -- A paid invoice/payment may still need reconciliation, but entitlement periods
    -- advance only when the provider-confirmed period is strictly newer.
    v_should_advance_period := (
        v_subscription.current_period_end IS NULL
        OR p_period_end > v_subscription.current_period_end
    );

    -- 8. Invoice Materialization / Transition to 'paid'
    IF v_existing_invoice.id IS NULL THEN
        -- Materialize new invoice directly as paid
        INSERT INTO public.billing_invoices (
            company_id,
            subscription_id,
            provider_subscription_record_id,
            provider,
            environment,
            provider_invoice_code,
            status,
            provider_status,
            amount_minor,
            currency,
            period_start,
            period_end,
            first_failed_at,
            paid_at,
            created_at,
            updated_at
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            v_provider_subscription.id,
            'paystack',
            v_environment,
            v_provider_invoice_code,
            'paid',
            v_provider_invoice_status,
            p_amount_minor::pg_catalog.int4,
            v_currency,
            p_period_start,
            p_period_end,
            NULL,
            p_paid_at,
            v_now,
            v_now
        )
        RETURNING id INTO v_invoice_id;

        v_invoice_status := 'paid';
        v_record_invoice_paid_ledger := TRUE;
    ELSIF v_existing_invoice.status IN ('pending', 'failed') THEN
        -- Transition existing pending or failed invoice to paid
        UPDATE public.billing_invoices
        SET status = 'paid',
            provider_status = v_provider_invoice_status,
            paid_at = p_paid_at,
            period_start = COALESCE(period_start, p_period_start),
            period_end = COALESCE(period_end, p_period_end),
            updated_at = v_now
        WHERE id = v_existing_invoice.id;

        v_invoice_id := v_existing_invoice.id;
        v_invoice_status := 'paid';
        v_record_invoice_paid_ledger := TRUE;
    ELSE
        -- Existing invoice is already paid
        v_invoice_id := v_existing_invoice.id;
        v_invoice_status := v_existing_invoice.status;
        v_record_invoice_paid_ledger := FALSE;
    END IF;

    -- 9. Renewal Payment Recording / Reconciliation
    IF v_existing_payment.id IS NOT NULL THEN
        v_payment_ref := v_existing_payment.provider_reference;

        IF v_existing_payment.status IN ('initialized', 'pending') THEN
            UPDATE public.billing_payments
            SET status = 'succeeded',
                paid_at = p_paid_at,
                failed_at = NULL,
                cancelled_at = NULL,
                error_code = NULL,
                error_message = NULL,
                billing_invoice_id = COALESCE(billing_invoice_id, v_invoice_id),
                provider_transaction_id = COALESCE(provider_transaction_id, v_provider_transaction_id),
                updated_at = v_now
            WHERE id = v_existing_payment.id;

            v_payment_id := v_existing_payment.id;
            v_payment_status := 'succeeded';
            v_record_payment_succeeded_ledger := TRUE;
        ELSIF v_existing_payment.status = 'succeeded' THEN
            -- Already succeeded
            v_payment_id := v_existing_payment.id;
            v_payment_status := 'succeeded';
            v_record_payment_succeeded_ledger := FALSE;
        ELSE
            RAISE EXCEPTION 'Unsupported existing payment status "%" for successful invoice reconciliation.',
                v_existing_payment.status
                USING ERRCODE = '23514';
        END IF;
    ELSIF v_provider_transaction_id IS NOT NULL OR v_provider_reference IS NOT NULL THEN
        v_payment_ref := COALESCE(v_provider_reference, 'txn_' || v_provider_transaction_id);
        v_payment_idempotency_key := pg_catalog.md5('paystack:' || v_environment || ':payment:' || COALESCE(v_provider_transaction_id, v_provider_reference) || ':succeeded')::pg_catalog.uuid;

        INSERT INTO public.billing_payments (
            company_id,
            subscription_id,
            plan_id,
            provider_plan_mapping_id,
            provider,
            environment,
            purpose,
            idempotency_key,
            provider_reference,
            provider_transaction_id,
            amount_minor,
            currency,
            customer_email,
            status,
            paid_at,
            billing_invoice_id,
            created_at,
            updated_at
        ) VALUES (
            v_subscription.company_id,
            v_subscription.id,
            v_subscription.plan_id,
            v_provider_subscription.provider_plan_mapping_id,
            'paystack',
            v_environment,
            'renewal',
            v_payment_idempotency_key,
            v_payment_ref,
            v_provider_transaction_id,
            p_amount_minor::pg_catalog.int4,
            v_currency,
            v_provider_subscription.customer_email,
            'succeeded',
            p_paid_at,
            v_invoice_id,
            v_now,
            v_now
        )
        RETURNING id INTO v_payment_id;

        v_payment_status := 'succeeded';
        v_record_payment_succeeded_ledger := TRUE;
    ELSE
        v_payment_id := NULL;
        v_payment_status := NULL;
        v_record_payment_succeeded_ledger := FALSE;
    END IF;

    -- 10. Advance Subscription Period & Lifecycle State Transitions
    v_final_subscription_status := v_subscription.status;
    v_final_past_due_since := v_subscription.past_due_since;
    v_final_current_period_start := v_subscription.current_period_start;
    v_final_current_period_end := v_subscription.current_period_end;
    v_final_next_renewal_at := v_subscription.next_renewal_at;

    IF v_subscription.status = 'active' THEN
        v_final_subscription_status := 'active';
        v_final_past_due_since := NULL;
        IF v_should_advance_period THEN
            v_final_current_period_start := p_period_start;
            v_final_current_period_end := p_period_end;
            v_final_next_renewal_at := CASE
                WHEN v_subscription.auto_renew_enabled IS TRUE
                    THEN COALESCE(p_next_payment_date, p_period_end)
                ELSE NULL
            END;

            UPDATE public.billing_subscriptions
            SET current_period_start = v_final_current_period_start,
                current_period_end = v_final_current_period_end,
                next_renewal_at = v_final_next_renewal_at,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
    ELSIF v_subscription.status = 'past_due' THEN
        IF v_should_advance_period THEN
            -- Recover access without re-enabling renewal that the customer disabled.
            v_final_subscription_status := CASE
                WHEN v_subscription.auto_renew_enabled IS TRUE THEN 'active'
                ELSE 'non_renewing'
            END;
            v_final_past_due_since := NULL;
            v_final_current_period_start := p_period_start;
            v_final_current_period_end := p_period_end;
            v_final_next_renewal_at := CASE
                WHEN v_subscription.auto_renew_enabled IS TRUE
                    THEN COALESCE(p_next_payment_date, p_period_end)
                ELSE NULL
            END;
            v_record_subscription_recovered_ledger := TRUE;

            UPDATE public.billing_subscriptions
            SET status = v_final_subscription_status,
                past_due_since = NULL,
                current_period_start = v_final_current_period_start,
                current_period_end = v_final_current_period_end,
                next_renewal_at = v_final_next_renewal_at,
                updated_at = v_now
            WHERE id = v_subscription.id;
        ELSE
            -- Historical invoice payment, subscription remains past_due
            v_final_subscription_status := 'past_due';
            v_final_past_due_since := v_subscription.past_due_since;
        END IF;
    ELSIF v_subscription.status = 'non_renewing' THEN
        v_final_subscription_status := 'non_renewing';
        v_final_past_due_since := NULL;
        IF v_should_advance_period THEN
            v_final_current_period_start := p_period_start;
            v_final_current_period_end := p_period_end;
            v_final_next_renewal_at := NULL;

            UPDATE public.billing_subscriptions
            SET current_period_start = v_final_current_period_start,
                current_period_end = v_final_current_period_end,
                next_renewal_at = NULL,
                updated_at = v_now
            WHERE id = v_subscription.id;
        END IF;
    ELSIF v_subscription.status IN ('expired', 'cancelled') THEN
        v_final_subscription_status := v_subscription.status;
        v_final_past_due_since := NULL;
    END IF;

    -- Update provider subscription mapping
    UPDATE public.billing_provider_subscriptions
    SET next_payment_at = CASE
            WHEN v_subscription.auto_renew_enabled IS FALSE THEN NULL
            WHEN p_next_payment_date IS NOT NULL
                 AND (
                     next_payment_at IS NULL
                     OR p_next_payment_date > next_payment_at
                 )
                THEN p_next_payment_date
            ELSE next_payment_at
        END,
        last_synced_at = v_now,
        updated_at = v_now
    WHERE id = v_provider_subscription.id;

    -- 11. Mark Webhook Processed
    UPDATE public.billing_webhook_events
    SET processing_status = 'processed',
        processed_at = v_now,
        updated_at = v_now
    WHERE id = v_webhook_event_id;

    -- 12. Append Immutable Ledger Entries
    IF v_record_invoice_paid_ledger THEN
        v_ledger_event_type := 'billing_invoice_paid';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':paid';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'payment_id', v_payment_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'provider_customer_code', v_provider_customer_code,
            'provider_status', v_provider_invoice_status,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'period_start', p_period_start,
            'period_end', p_period_end,
            'paid_at', p_paid_at,
            'occurred_at', p_occurred_at,
            'invoice_status', 'paid',
            'subscription_status', v_final_subscription_status
        );

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
              AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = v_ledger_event_type
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_subscription.company_id,
                v_subscription.id,
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    IF v_record_payment_succeeded_ledger AND v_payment_id IS NOT NULL THEN
        v_ledger_event_type := 'renewal_payment_succeeded';
        v_ledger_dedup_key := 'paystack:' || v_environment || ':payment:' || COALESCE(v_provider_transaction_id, v_provider_reference) || ':succeeded';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'payment_id', v_payment_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_reference', v_payment_ref,
            'provider_transaction_id', v_provider_transaction_id,
            'amount_minor', p_amount_minor,
            'currency', v_currency,
            'paid_at', p_paid_at,
            'purpose', 'renewal'
        );

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
              AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = v_ledger_event_type
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for payment %.', COALESCE(v_provider_transaction_id, v_provider_reference)
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_subscription.company_id,
                v_subscription.id,
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    IF v_record_subscription_recovered_ledger THEN
        v_ledger_event_type := CASE
            WHEN v_final_subscription_status = 'active'
                THEN 'subscription_recovered_to_active'
            ELSE 'subscription_recovered_to_non_renewing'
        END;
        v_ledger_dedup_key := 'paystack:' || v_environment || ':invoice:' || v_provider_invoice_code || ':subscription_recovered';
        v_ledger_event_data := pg_catalog.jsonb_build_object(
            'company_id', v_subscription.company_id,
            'subscription_id', v_subscription.id,
            'invoice_id', v_invoice_id,
            'payment_id', v_payment_id,
            'provider', 'paystack',
            'environment', v_environment,
            'provider_invoice_code', v_provider_invoice_code,
            'provider_subscription_code', v_provider_subscription_code,
            'occurred_at', p_occurred_at,
            'previous_status', 'past_due',
            'current_status', v_final_subscription_status,
            'cleared_past_due_since', v_subscription.past_due_since,
            'current_period_start', v_final_current_period_start,
            'current_period_end', v_final_current_period_end,
            'next_renewal_at', v_final_next_renewal_at
        );

        IF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
              AND event.company_id IS NOT DISTINCT FROM v_subscription.company_id
              AND event.subscription_id IS NOT DISTINCT FROM v_subscription.id
              AND event.event_type = v_ledger_event_type
              AND event.event_source = 'paystack_webhook'
        ) THEN
            NULL;
        ELSIF EXISTS (
            SELECT 1
            FROM public.billing_ledger_events AS event
            WHERE event.deduplication_key = v_ledger_dedup_key
        ) THEN
            RAISE EXCEPTION 'Ledger deduplication key collision for invoice %.', v_provider_invoice_code
                USING ERRCODE = '23505';
        ELSE
            INSERT INTO public.billing_ledger_events (
                company_id,
                subscription_id,
                payment_id,
                event_type,
                event_source,
                occurred_at,
                recorded_at,
                actor_profile_id,
                deduplication_key,
                event_data
            ) VALUES (
                v_subscription.company_id,
                v_subscription.id,
                v_payment_id,
                v_ledger_event_type,
                'paystack_webhook',
                p_occurred_at,
                v_now,
                NULL,
                v_ledger_dedup_key,
                v_ledger_event_data
            );
        END IF;
    END IF;

    -- 13. Return Single Row Result
    RETURN QUERY
    SELECT
        v_webhook_event_id,
        v_invoice_id,
        v_payment_id,
        v_provider_subscription.id,
        v_subscription.id,
        v_provider_invoice_code,
        v_invoice_status,
        v_payment_status,
        v_final_subscription_status,
        p_amount_minor,
        v_currency,
        v_final_current_period_start,
        v_final_current_period_end,
        v_final_next_renewal_at,
        v_final_past_due_since,
        v_is_reused AS is_reused,
        v_is_ignored AS is_ignored;

    RETURN;
END;
$process_paystack_invoice_update_success$;

REVOKE ALL
ON FUNCTION public.process_paystack_invoice_update_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.process_paystack_invoice_update_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
)
TO service_role;

COMMENT ON FUNCTION public.process_paystack_invoice_update_success(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.bool,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int8,
    pg_catalog.text,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz,
    pg_catalog.timestamptz
) IS
'Atomically processes an authenticated and signature-verified successful Paystack invoice.update webhook event, materializing or transitioning invoices to paid, recording/reconciling renewal payments, advancing subscription billing periods, recovering past_due subscriptions to active, and appending immutable ledger events.';










-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1A
-- Seven-Day Billing Entitlement Foundation Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_company_billing_entitlement(
    p_company_id pg_catalog.uuid
)
RETURNS TABLE (
    company_id pg_catalog.uuid,
    subscription_id pg_catalog.uuid,
    subscription_status pg_catalog.text,
    entitlement_state pg_catalog.text,
    access_mode pg_catalog.text,
    can_read pg_catalog.bool,
    can_write pg_catalog.bool,
    can_access_billing pg_catalog.bool,
    can_export pg_catalog.bool,
    can_access_settings pg_catalog.bool,
    grace_started_at pg_catalog.timestamptz,
    grace_ends_at pg_catalog.timestamptz,
    read_only_since pg_catalog.timestamptz,
    reason_code pg_catalog.text,
    evaluated_at pg_catalog.timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $get_company_billing_entitlement$
DECLARE
    v_caller_id pg_catalog.uuid;
    v_now pg_catalog.timestamptz;
    v_current_subs public.billing_subscriptions[];
    v_current_count pg_catalog.int4;
    v_sub public.billing_subscriptions%ROWTYPE;
    v_terminal_subs public.billing_subscriptions[];
    v_terminal_count pg_catalog.int4;
    v_grace_end pg_catalog.timestamptz;
BEGIN
    -- 1. Evaluated at single point in time using statement_timestamp()
    v_now := pg_catalog.statement_timestamp();

    -- 2. Validate input parameters
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'Company ID cannot be null.'
            USING ERRCODE = '22004';
    END IF;

    -- 3. Require authenticated user
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '28000';
    END IF;

    -- 4. Enforce tenant isolation via active company membership
    IF NOT EXISTS (
        SELECT 1
        FROM public.company_members AS cm
        WHERE cm.company_id = p_company_id
          AND cm.profile_id = v_caller_id
          AND cm.is_active IS TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. You do not have active membership in this company.'
            USING ERRCODE = '42501';
    END IF;

    -- 5. Query current subscriptions for the company
    -- Current statuses: pending_activation, trialing, active, non_renewing, past_due
    SELECT pg_catalog.array_agg(bs ORDER BY bs.created_at DESC, bs.id DESC), pg_catalog.count(*)
    INTO v_current_subs, v_current_count
    FROM public.billing_subscriptions AS bs
    WHERE bs.company_id = p_company_id
      AND bs.status IN (
          'pending_activation',
          'trialing',
          'active',
          'non_renewing',
          'past_due'
      );

    -- 6. Check for conflicting current subscriptions
    IF v_current_count > 1 THEN
        -- Conflicting current subscriptions exist; fail safely to read-only without choosing arbitrarily
        RETURN QUERY
        SELECT
            p_company_id,
            NULL::pg_catalog.uuid,
            NULL::pg_catalog.text,
            'conflict'::pg_catalog.text,
            'read_only'::pg_catalog.text,
            TRUE,
            FALSE,
            TRUE,
            TRUE,
            TRUE,
            NULL::pg_catalog.timestamptz,
            NULL::pg_catalog.timestamptz,
            NULL::pg_catalog.timestamptz,
            'SUBSCRIPTION_CONFLICT'::pg_catalog.text,
            v_now;
        RETURN;
    END IF;

    -- 7. If exactly one current subscription exists, evaluate it
    IF v_current_count = 1 THEN
        v_sub := v_current_subs[1];

        IF v_sub.status = 'active' THEN
            RETURN QUERY
            SELECT
                p_company_id,
                v_sub.id,
                v_sub.status,
                'active'::pg_catalog.text,
                'full'::pg_catalog.text,
                TRUE,
                TRUE,
                TRUE,
                TRUE,
                TRUE,
                NULL::pg_catalog.timestamptz,
                NULL::pg_catalog.timestamptz,
                NULL::pg_catalog.timestamptz,
                'ACTIVE_SUBSCRIPTION'::pg_catalog.text,
                v_now;
            RETURN;

        ELSIF v_sub.status IN ('trialing', 'pending_activation') THEN
            IF v_sub.trial_ends_at IS NULL THEN
                -- Missing required trial_ends_at; fail safely to read-only
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'trial_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_now,
                    'MISSING_TRIAL_END_DATE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSIF v_now < v_sub.trial_ends_at THEN
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    v_sub.status::pg_catalog.text,
                    'full'::pg_catalog.text,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    'TRIAL_ACTIVE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSE
                -- At or after trial_ends_at
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'trial_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_sub.trial_ends_at,
                    'TRIAL_EXPIRED'::pg_catalog.text,
                    v_now;
                RETURN;
            END IF;

        ELSIF v_sub.status = 'past_due' THEN
            IF v_sub.past_due_since IS NULL THEN
                -- Missing required past_due_since; fail safely to read-only
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'grace_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_now,
                    'MISSING_PAST_DUE_DATE'::pg_catalog.text,
                    v_now;
                RETURN;
            END IF;

            v_grace_end := v_sub.past_due_since + pg_catalog.interval '7 days';

            IF v_now < v_grace_end THEN
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'grace_period'::pg_catalog.text,
                    'grace_period'::pg_catalog.text,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    v_sub.past_due_since,
                    v_grace_end,
                    NULL::pg_catalog.timestamptz,
                    'PAST_DUE_GRACE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSE
                -- At or after 7-day deadline
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'grace_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    v_sub.past_due_since,
                    v_grace_end,
                    v_grace_end,
                    'PAST_DUE_EXPIRED'::pg_catalog.text,
                    v_now;
                RETURN;
            END IF;

        ELSIF v_sub.status = 'non_renewing' THEN
            IF v_sub.current_period_end IS NULL THEN
                -- Missing required current_period_end; fail safely to read-only
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'period_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_now,
                    'MISSING_PERIOD_END_DATE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSIF v_now < v_sub.current_period_end THEN
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'non_renewing'::pg_catalog.text,
                    'full'::pg_catalog.text,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    'NON_RENEWING_ACTIVE'::pg_catalog.text,
                    v_now;
                RETURN;
            ELSE
                -- At or after period end
                RETURN QUERY
                SELECT
                    p_company_id,
                    v_sub.id,
                    v_sub.status,
                    'period_expired'::pg_catalog.text,
                    'read_only'::pg_catalog.text,
                    TRUE,
                    FALSE,
                    TRUE,
                    TRUE,
                    TRUE,
                    NULL::pg_catalog.timestamptz,
                    NULL::pg_catalog.timestamptz,
                    v_sub.current_period_end,
                    'PERIOD_EXPIRED'::pg_catalog.text,
                    v_now;
                RETURN;
            END IF;
        END IF;
    END IF;

    -- 8. If no current subscription, check for terminal subscriptions (expired, cancelled)
    SELECT pg_catalog.array_agg(bs ORDER BY COALESCE(bs.cancelled_at, bs.expired_at, bs.updated_at, bs.created_at) DESC, bs.id DESC), pg_catalog.count(*)
    INTO v_terminal_subs, v_terminal_count
    FROM public.billing_subscriptions AS bs
    WHERE bs.company_id = p_company_id
      AND bs.status IN ('expired', 'cancelled');

    IF v_terminal_count > 0 THEN
        v_sub := v_terminal_subs[1];

        IF v_sub.status = 'cancelled' THEN
            RETURN QUERY
            SELECT
                p_company_id,
                v_sub.id,
                v_sub.status,
                'cancelled'::pg_catalog.text,
                'read_only'::pg_catalog.text,
                TRUE,
                FALSE,
                TRUE,
                TRUE,
                TRUE,
                NULL::pg_catalog.timestamptz,
                NULL::pg_catalog.timestamptz,
                COALESCE(v_sub.cancelled_at, v_sub.updated_at),
                'SUBSCRIPTION_CANCELLED'::pg_catalog.text,
                v_now;
            RETURN;
        ELSE -- 'expired'
            RETURN QUERY
            SELECT
                p_company_id,
                v_sub.id,
                v_sub.status,
                'expired'::pg_catalog.text,
                'read_only'::pg_catalog.text,
                TRUE,
                FALSE,
                TRUE,
                TRUE,
                TRUE,
                NULL::pg_catalog.timestamptz,
                NULL::pg_catalog.timestamptz,
                COALESCE(v_sub.expired_at, v_sub.current_period_end, v_sub.trial_ends_at, v_sub.updated_at),
                'SUBSCRIPTION_EXPIRED'::pg_catalog.text,
                v_now;
            RETURN;
        END IF;
    END IF;

    -- 9. No subscription exists for the company (Unconfigured)
    RETURN QUERY
    SELECT
        p_company_id,
        NULL::pg_catalog.uuid,
        NULL::pg_catalog.text,
        'unconfigured'::pg_catalog.text,
        'read_only'::pg_catalog.text,
        TRUE,
        FALSE,
        TRUE,
        TRUE,
        TRUE,
        NULL::pg_catalog.timestamptz,
        NULL::pg_catalog.timestamptz,
        NULL::pg_catalog.timestamptz,
        'NO_SUBSCRIPTION'::pg_catalog.text,
        v_now;
    RETURN;
END;
$get_company_billing_entitlement$;

REVOKE ALL ON FUNCTION public.get_company_billing_entitlement(pg_catalog.uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_billing_entitlement(pg_catalog.uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_company_billing_entitlement(pg_catalog.uuid) IS
'Evaluates and returns the real-time billing entitlement and access mode (full, grace-period, or read-only) for an authorized company member at statement_timestamp().';


CREATE OR REPLACE FUNCTION public.company_billing_allows_operational_write(
    p_company_id pg_catalog.uuid
)
RETURNS pg_catalog.bool
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $company_billing_allows_operational_write$
DECLARE
    v_can_write pg_catalog.bool;
BEGIN
    SELECT e.can_write
    INTO v_can_write
    FROM public.get_company_billing_entitlement(p_company_id) AS e;

    RETURN COALESCE(v_can_write, false);
END;
$company_billing_allows_operational_write$;

REVOKE ALL ON FUNCTION public.company_billing_allows_operational_write(pg_catalog.uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_billing_allows_operational_write(pg_catalog.uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.company_billing_allows_operational_write(pg_catalog.uuid) IS
'Helper function returning true if the company billing entitlement allows operational write access (full or grace_period access mode).';


-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1C
-- Migration: Enforce Billing Operational Write Access on Core Finance
-- Description:
--   Applies server-side commercial write entitlement enforcement to:
--     1. public.project_budget_versions
--     2. public.project_budget_lines
--     3. public.financial_commitments
--     4. public.financial_cost_postings
--     5. public.project_financial_forecasts
--
--   Updates write RLS policies (INSERT, UPDATE, DELETE) to require:
--     public.company_billing_allows_operational_write(company_id)
--   Leaves SELECT policies intact so read-only companies can view and export records.
--
--   Updates all 18 mutating SECURITY DEFINER RPCs for Core Finance to explicitly
--   validate public.company_billing_allows_operational_write(v_company_id)
--   prior to mutation, raising SQLSTATE 'PM001' with message:
--   'Company billing access is read-only.' if not permitted.
-- ============================================================================

-- RLS WRITE POLICIES

DROP POLICY IF EXISTS p_budget_versions_insert ON public.project_budget_versions;
CREATE POLICY p_budget_versions_insert ON public.project_budget_versions
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_versions_update ON public.project_budget_versions;
CREATE POLICY p_budget_versions_update ON public.project_budget_versions
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_versions_delete ON public.project_budget_versions;
CREATE POLICY p_budget_versions_delete ON public.project_budget_versions
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_lines_insert ON public.project_budget_lines;
CREATE POLICY p_budget_lines_insert ON public.project_budget_lines
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_lines_update ON public.project_budget_lines;
CREATE POLICY p_budget_lines_update ON public.project_budget_lines
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_budget_lines_delete ON public.project_budget_lines;
CREATE POLICY p_budget_lines_delete ON public.project_budget_lines
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_commitments_insert ON public.financial_commitments;
CREATE POLICY p_commitments_insert ON public.financial_commitments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_commitments_update ON public.financial_commitments;
CREATE POLICY p_commitments_update ON public.financial_commitments
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_commitments_delete ON public.financial_commitments;
CREATE POLICY p_commitments_delete ON public.financial_commitments
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_cost_postings_insert ON public.financial_cost_postings;
CREATE POLICY p_cost_postings_insert ON public.financial_cost_postings
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_cost_postings_update ON public.financial_cost_postings;
CREATE POLICY p_cost_postings_update ON public.financial_cost_postings
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_cost_postings_delete ON public.financial_cost_postings;
CREATE POLICY p_cost_postings_delete ON public.financial_cost_postings
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_forecasts_insert ON public.project_financial_forecasts;
CREATE POLICY p_forecasts_insert ON public.project_financial_forecasts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_forecasts_update ON public.project_financial_forecasts;
CREATE POLICY p_forecasts_update ON public.project_financial_forecasts
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_forecasts_delete ON public.project_financial_forecasts;
CREATE POLICY p_forecasts_delete ON public.project_financial_forecasts
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- MUTATING SECURITY DEFINER RPCs

CREATE OR REPLACE FUNCTION public.archive_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id uuid;
    v_project_id uuid;
    v_status text;
    v_is_archived boolean;
    v_result jsonb;
BEGIN
    IF p_table NOT IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts') THEN
        RAISE EXCEPTION 'Table % is not eligible for soft archiving.', p_table;
    END IF;

    EXECUTE format('SELECT company_id, project_id, status, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table)
    INTO v_company_id, v_project_id, v_status, v_is_archived
    USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % in table % was not found.', p_id, p_table;
    END IF;

    IF v_is_archived THEN
        RAISE EXCEPTION 'Record is already archived.';
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance permissions for company %.', v_company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    CASE p_table
        WHEN 'project_budget_versions' THEN
            IF v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
                RAISE EXCEPTION 'Budget version cannot be archived in status %.', v_status;
            END IF;
        WHEN 'financial_commitments' THEN
            IF v_status NOT IN ('Closed', 'Cancelled') THEN
                RAISE EXCEPTION 'Financial commitment cannot be archived in status %.', v_status;
            END IF;
        WHEN 'financial_cost_postings' THEN
            IF v_status NOT IN ('Draft', 'Rejected') THEN
                RAISE EXCEPTION 'Cost posting cannot be archived in status %.', v_status;
            END IF;
        WHEN 'project_financial_forecasts' THEN
            IF v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
                RAISE EXCEPTION 'Forecast cannot be archived in status %.', v_status;
            END IF;
    END CASE;

    EXECUTE format('UPDATE public.%I SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table)
    INTO v_result
    USING p_id;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_finance_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_finance_record(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_id uuid;
    v_project_id uuid;
    v_status text;
    v_is_archived boolean;
    v_result jsonb;
BEGIN
    IF p_table NOT IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts') THEN
        RAISE EXCEPTION 'Table % is not eligible for soft restoration.', p_table;
    END IF;

    EXECUTE format('SELECT company_id, project_id, status, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table)
    INTO v_company_id, v_project_id, v_status, v_is_archived
    USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % in table % was not found.', p_id, p_table;
    END IF;

    IF NOT v_is_archived THEN
        RAISE EXCEPTION 'Record is not archived.';
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance permissions for company %.', v_company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    CASE p_table
        WHEN 'project_budget_versions' THEN
            IF v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
                RAISE EXCEPTION 'Budget version cannot be restored in status %.', v_status;
            END IF;
        WHEN 'financial_commitments' THEN
            IF v_status NOT IN ('Closed', 'Cancelled') THEN
                RAISE EXCEPTION 'Financial commitment cannot be restored in status %.', v_status;
            END IF;
        WHEN 'financial_cost_postings' THEN
            IF v_status NOT IN ('Draft', 'Rejected') THEN
                RAISE EXCEPTION 'Cost posting cannot be restored in status %.', v_status;
            END IF;
        WHEN 'project_financial_forecasts' THEN
            IF v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
                RAISE EXCEPTION 'Forecast cannot be restored in status %.', v_status;
            END IF;
    END CASE;

    EXECUTE format('UPDATE public.%I SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table)
    INTO v_result
    USING p_id;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_finance_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_finance_record(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_budget_version(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_budget_versions%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.project_budget_versions WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget version % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot submit an archived budget version.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Budget version must be in Draft status to submit (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_budget_versions
    SET status = 'Submitted',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_budget_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_budget_version(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_budget_version(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_budget_versions%ROWTYPE;
    v_orig_lines_total numeric(15,2);
    v_var_lines_total numeric(15,2);
BEGIN
    SELECT * INTO v_rec FROM public.project_budget_versions WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget version % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot approve an archived budget version.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Budget version must be in Submitted status to approve (current status: %).', v_rec.status;
    END IF;

    SELECT 
        COALESCE(SUM(CASE WHEN line_type = 'Original Budget' THEN amount_excl_vat ELSE 0 END), 0.00),
        COALESCE(SUM(CASE WHEN line_type = 'Approved Variation' THEN amount_excl_vat ELSE 0 END), 0.00)
    INTO v_orig_lines_total, v_var_lines_total
    FROM public.project_budget_lines
    WHERE budget_version_id = p_id AND is_archived = false;

    IF v_orig_lines_total <> v_rec.original_budget_excl_vat THEN
        RAISE EXCEPTION 'Original budget line total (%) does not match budget header original total (%).', v_orig_lines_total, v_rec.original_budget_excl_vat;
    END IF;

    IF v_var_lines_total <> v_rec.approved_variations_excl_vat THEN
        RAISE EXCEPTION 'Approved variation line total (%) does not match budget header variation total (%).', v_var_lines_total, v_rec.approved_variations_excl_vat;
    END IF;

    UPDATE public.project_budget_versions
    SET status = 'Superseded',
        updated_at = now(),
        updated_by = auth.uid()
    WHERE project_id = v_rec.project_id
      AND status = 'Approved'
      AND id <> p_id;

    UPDATE public.project_budget_versions
    SET status = 'Approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_budget_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_budget_version(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_budget_version(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_budget_versions%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank rejection reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.project_budget_versions WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget version % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot reject an archived budget version.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Budget version must be in Submitted status to reject (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_budget_versions
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_budget_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_budget_version(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_budget_version(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_budget_versions%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank cancellation reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.project_budget_versions WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Budget version % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot cancel an archived budget version.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Budget version can only be cancelled from Draft status (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_budget_versions
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_budget_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_budget_version(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_financial_commitment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot submit an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Commitment must be in Draft status to submit (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
    SET status = 'Submitted',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_financial_commitment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_financial_commitment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot approve an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Commitment must be in Submitted status to approve (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
    SET status = 'Approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_financial_commitment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_financial_commitment(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank rejection reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot reject an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Commitment must be in Submitted status to reject (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_financial_commitment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_financial_commitment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_financial_commitment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot close an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Approved' THEN
        RAISE EXCEPTION 'Commitment must be in Approved status to close (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
    SET status = 'Closed',
        closed_by = auth.uid(),
        closed_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.close_financial_commitment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_financial_commitment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_financial_commitment(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_commitments%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank cancellation reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.financial_commitments WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial commitment % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot cancel an archived financial commitment.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
        RAISE EXCEPTION 'Commitment can only be cancelled from Draft, Submitted or Approved status (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_commitments
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_financial_commitment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_financial_commitment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_financial_cost_posting(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_cost_postings%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_cost_postings WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost posting % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot submit an archived cost posting.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Cost posting must be in Draft status to submit (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_cost_postings
    SET status = 'Submitted',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_financial_cost_posting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_financial_cost_posting(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_financial_cost_posting(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_cost_postings%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.financial_cost_postings WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost posting % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot post an archived cost posting.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Cost posting must be in Submitted status to post (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_cost_postings
    SET status = 'Posted',
        posted_by = auth.uid(),
        posted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.post_financial_cost_posting(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_financial_cost_posting(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_financial_cost_posting(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.financial_cost_postings%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank rejection reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.financial_cost_postings WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost posting % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot reject an archived cost posting.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Cost posting must be in Submitted status to reject (current status: %).', v_rec.status;
    END IF;

    UPDATE public.financial_cost_postings
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_financial_cost_posting(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_financial_cost_posting(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reverse_financial_cost_posting(
    p_cost_posting_id uuid,
    p_reversal_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig public.financial_cost_postings%ROWTYPE;
    v_rev public.financial_cost_postings%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reversal_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank reversal reason must be provided.';
    END IF;

    IF p_cost_posting_id IS NULL THEN
        RAISE EXCEPTION 'Cost posting ID must be provided.';
    END IF;

    SELECT * INTO v_orig FROM public.financial_cost_postings WHERE id = p_cost_posting_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cost posting % not found.', p_cost_posting_id;
    END IF;

    IF v_orig.is_archived THEN
        RAISE EXCEPTION 'Cannot reverse an archived cost posting.';
    END IF;

    IF NOT public.has_finance_full_access(v_orig.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_orig.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_orig.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_orig.status <> 'Posted' THEN
        RAISE EXCEPTION 'Cost posting must be in Posted status to reverse (current status: %).', v_orig.status;
    END IF;

    IF v_orig.entry_type <> 'Cost' THEN
        RAISE EXCEPTION 'Only primary Cost postings can be reversed.';
    END IF;

    UPDATE public.financial_cost_postings
    SET status = 'Reversed',
        reversed_by = auth.uid(),
        reversed_at = now(),
        reversal_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_cost_posting_id;

    INSERT INTO public.financial_cost_postings (
        company_id,
        project_id,
        posting_reference,
        posting_date,
        source_type,
        source_record_id,
        source_reference,
        commitment_id,
        cost_category,
        description,
        entry_type,
        amount_excl_vat,
        reversal_of_id,
        notes,
        currency_code,
        status,
        posted_by,
        posted_at,
        reversal_reason,
        is_archived,
        created_by,
        updated_by
    ) VALUES (
        v_orig.company_id,
        v_orig.project_id,
        v_orig.posting_reference || '-REV',
        CURRENT_DATE,
        v_orig.source_type,
        v_orig.source_record_id,
        v_orig.source_reference,
        v_orig.commitment_id,
        v_orig.cost_category,
        'Reversal of ' || v_orig.posting_reference || ': ' || v_clean_reason,
        'Reversal',
        -1 * ABS(v_orig.amount_excl_vat),
        v_orig.id,
        v_orig.notes,
        v_orig.currency_code,
        'Posted',
        auth.uid(),
        now(),
        v_clean_reason,
        false,
        auth.uid(),
        auth.uid()
    ) RETURNING * INTO v_rev;

    RETURN to_jsonb(v_rev);
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_financial_cost_posting(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_financial_cost_posting(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_project_financial_forecast(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_financial_forecasts%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.project_financial_forecasts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial forecast % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot submit an archived financial forecast.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Forecast must be in Draft status to submit (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_financial_forecasts
    SET status = 'Submitted',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_project_financial_forecast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_project_financial_forecast(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_project_financial_forecast(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_financial_forecasts%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.project_financial_forecasts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial forecast % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot approve an archived financial forecast.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Forecast must be in Submitted status to approve (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_financial_forecasts
    SET status = 'Superseded',
        updated_at = now(),
        updated_by = auth.uid()
    WHERE project_id = v_rec.project_id
      AND status = 'Approved'
      AND id <> p_id;

    UPDATE public.project_financial_forecasts
    SET status = 'Approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_project_financial_forecast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_project_financial_forecast(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_project_financial_forecast(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec public.project_financial_forecasts%ROWTYPE;
    v_clean_reason text;
BEGIN
    v_clean_reason := NULLIF(btrim(p_reason), '');
    IF v_clean_reason IS NULL THEN
        RAISE EXCEPTION 'A non-blank rejection reason must be provided.';
    END IF;

    SELECT * INTO v_rec FROM public.project_financial_forecasts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial forecast % not found.', p_id;
    END IF;

    IF v_rec.is_archived THEN
        RAISE EXCEPTION 'Cannot reject an archived financial forecast.';
    END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance access for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Forecast must be in Submitted status to reject (current status: %).', v_rec.status;
    END IF;

    UPDATE public.project_financial_forecasts
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_clean_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_project_financial_forecast(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_project_financial_forecast(uuid, text) TO authenticated;

-- ============================================================================
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1D: Enforce Billing Access on Client Accounts
--
-- Target Tables:
--   1. public.client_accounts
--   2. public.project_client_contracts
--   3. public.client_invoices
--   4. public.client_invoice_lines
--   5. public.client_credit_notes
--   6. public.client_credit_note_lines
--   7. public.client_receipts
--   8. public.client_receipt_allocations
--
-- Write Policies:
--   - INSERT: WITH CHECK requires company_billing_allows_operational_write(company_id)
--   - UPDATE: USING and WITH CHECK require company_billing_allows_operational_write(company_id)
--   - DELETE: USING requires company_billing_allows_operational_write(company_id)
--   - Authoritative parent company validation for child tables:
--       * client_invoice_lines -> client_invoices
--       * client_credit_note_lines -> client_credit_notes
--       * client_receipt_allocations -> client_receipts AND client_invoices
--   - SELECT policies are preserved intact.
--
-- Mutating SECURITY DEFINER RPCs:
--   - activate_client_contract
--   - close_client_contract
--   - cancel_client_contract
--   - submit_client_invoice
--   - approve_client_invoice
--   - reject_client_invoice
--   - issue_client_invoice
--   - cancel_client_invoice
--   - submit_client_credit_note
--   - approve_client_credit_note
--   - reject_client_credit_note
--   - issue_client_credit_note
--   - cancel_client_credit_note
--   - post_client_receipt
--   - reverse_client_receipt
--   - cancel_client_receipt
--   - allocate_client_receipt
--   - reverse_client_receipt_allocation
--   - archive_finance_record
--   - restore_finance_record
--
-- All mutating RPCs validate company_billing_allows_operational_write(company_id)
-- and raise SQLSTATE 'PM001' with 'Company billing access is read-only.'


-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1D: Client Accounts Billing Enforcement
-- ============================================================================
-- Migration: 20260828000000_enforce_billing_client_accounts.sql
-- Description: Step 3C.4F-1D: Enforce Billing Access on Client Accounts
--
-- Target Tables:
--   1. public.client_accounts
--   2. public.project_client_contracts
--   3. public.client_invoices
--   4. public.client_invoice_lines
--   5. public.client_credit_notes
--   6. public.client_credit_note_lines
--   7. public.client_receipts
--   8. public.client_receipt_allocations
--
-- Write Policies:
--   - INSERT: WITH CHECK requires company_billing_allows_operational_write(company_id)
--   - UPDATE: USING and WITH CHECK require company_billing_allows_operational_write(company_id)
--   - DELETE: USING requires company_billing_allows_operational_write(company_id)
--   - Authoritative parent company validation for child tables:
--       * client_invoice_lines -> client_invoices
--       * client_credit_note_lines -> client_credit_notes
--       * client_receipt_allocations -> client_receipts AND client_invoices
--   - SELECT policies are preserved intact.
--
-- Mutating SECURITY DEFINER RPCs:
--   - activate_client_contract
--   - close_client_contract
--   - cancel_client_contract
--   - submit_client_invoice
--   - approve_client_invoice
--   - reject_client_invoice
--   - issue_client_invoice
--   - cancel_client_invoice
--   - submit_client_credit_note
--   - approve_client_credit_note
--   - reject_client_credit_note
--   - issue_client_credit_note
--   - cancel_client_credit_note
--   - post_client_receipt
--   - reverse_client_receipt
--   - cancel_client_receipt
--   - allocate_client_receipt
--   - reverse_client_receipt_allocation
--   - archive_finance_record
--   - restore_finance_record
--
-- All mutating RPCs validate company_billing_allows_operational_write(company_id)
-- and raise SQLSTATE 'PM001' with 'Company billing access is read-only.'
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ROW LEVEL SECURITY (RLS) WRITE POLICIES ON CLIENT ACCOUNTS TABLES
-- ============================================================================

-- 1.1 client_accounts
DROP POLICY IF EXISTS p_ca_insert ON public.client_accounts;
CREATE POLICY p_ca_insert ON public.client_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_ca_update ON public.client_accounts;
CREATE POLICY p_ca_update ON public.client_accounts
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_ca_delete ON public.client_accounts;
CREATE POLICY p_ca_delete ON public.client_accounts
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- 1.2 project_client_contracts
DROP POLICY IF EXISTS p_pcc_insert ON public.project_client_contracts;
CREATE POLICY p_pcc_insert ON public.project_client_contracts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_pcc_update ON public.project_client_contracts;
CREATE POLICY p_pcc_update ON public.project_client_contracts
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_pcc_delete ON public.project_client_contracts;
CREATE POLICY p_pcc_delete ON public.project_client_contracts
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- 1.3 client_invoices
DROP POLICY IF EXISTS p_ci_insert ON public.client_invoices;
CREATE POLICY p_ci_insert ON public.client_invoices
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_ci_update ON public.client_invoices;
CREATE POLICY p_ci_update ON public.client_invoices
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_ci_delete ON public.client_invoices;
CREATE POLICY p_ci_delete ON public.client_invoices
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- 1.4 client_invoice_lines (authoritative parent: client_invoices)
DROP POLICY IF EXISTS p_cil_insert ON public.client_invoice_lines;
CREATE POLICY p_cil_insert ON public.client_invoice_lines
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_invoices ci
            WHERE ci.id = client_invoice_lines.invoice_id
              AND ci.company_id = client_invoice_lines.company_id
              AND ci.project_id = client_invoice_lines.project_id
        )
    );

DROP POLICY IF EXISTS p_cil_update ON public.client_invoice_lines;
CREATE POLICY p_cil_update ON public.client_invoice_lines
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_invoices ci
            WHERE ci.id = client_invoice_lines.invoice_id
              AND ci.company_id = client_invoice_lines.company_id
              AND ci.project_id = client_invoice_lines.project_id
        )
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_invoices ci
            WHERE ci.id = client_invoice_lines.invoice_id
              AND ci.company_id = client_invoice_lines.company_id
              AND ci.project_id = client_invoice_lines.project_id
        )
    );

DROP POLICY IF EXISTS p_cil_delete ON public.client_invoice_lines;
CREATE POLICY p_cil_delete ON public.client_invoice_lines
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_invoices ci
            WHERE ci.id = client_invoice_lines.invoice_id
              AND ci.company_id = client_invoice_lines.company_id
              AND ci.project_id = client_invoice_lines.project_id
        )
    );

-- 1.5 client_credit_notes
DROP POLICY IF EXISTS p_ccn_insert ON public.client_credit_notes;
CREATE POLICY p_ccn_insert ON public.client_credit_notes
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_ccn_update ON public.client_credit_notes;
CREATE POLICY p_ccn_update ON public.client_credit_notes
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_ccn_delete ON public.client_credit_notes;
CREATE POLICY p_ccn_delete ON public.client_credit_notes
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- 1.6 client_credit_note_lines (authoritative parent: client_credit_notes)
DROP POLICY IF EXISTS p_ccnl_insert ON public.client_credit_note_lines;
CREATE POLICY p_ccnl_insert ON public.client_credit_note_lines
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_credit_notes ccn
            WHERE ccn.id = client_credit_note_lines.credit_note_id
              AND ccn.company_id = client_credit_note_lines.company_id
              AND ccn.project_id = client_credit_note_lines.project_id
        )
    );

DROP POLICY IF EXISTS p_ccnl_update ON public.client_credit_note_lines;
CREATE POLICY p_ccnl_update ON public.client_credit_note_lines
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_credit_notes ccn
            WHERE ccn.id = client_credit_note_lines.credit_note_id
              AND ccn.company_id = client_credit_note_lines.company_id
              AND ccn.project_id = client_credit_note_lines.project_id
        )
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_credit_notes ccn
            WHERE ccn.id = client_credit_note_lines.credit_note_id
              AND ccn.company_id = client_credit_note_lines.company_id
              AND ccn.project_id = client_credit_note_lines.project_id
        )
    );

DROP POLICY IF EXISTS p_ccnl_delete ON public.client_credit_note_lines;
CREATE POLICY p_ccnl_delete ON public.client_credit_note_lines
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_credit_notes ccn
            WHERE ccn.id = client_credit_note_lines.credit_note_id
              AND ccn.company_id = client_credit_note_lines.company_id
              AND ccn.project_id = client_credit_note_lines.project_id
        )
    );

-- 1.7 client_receipts
DROP POLICY IF EXISTS p_cr_insert ON public.client_receipts;
CREATE POLICY p_cr_insert ON public.client_receipts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_cr_update ON public.client_receipts;
CREATE POLICY p_cr_update ON public.client_receipts
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS p_cr_delete ON public.client_receipts;
CREATE POLICY p_cr_delete ON public.client_receipts
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- 1.8 client_receipt_allocations (authoritative parents: client_receipts & client_invoices)
DROP POLICY IF EXISTS p_cra_insert ON public.client_receipt_allocations;
CREATE POLICY p_cra_insert ON public.client_receipt_allocations
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_receipts cr
            WHERE cr.id = client_receipt_allocations.receipt_id
              AND cr.company_id = client_receipt_allocations.company_id
              AND cr.project_id = client_receipt_allocations.project_id
              AND cr.client_account_id = client_receipt_allocations.client_account_id
        )
        AND EXISTS (
            SELECT 1 FROM public.client_invoices ci
            WHERE ci.id = client_receipt_allocations.invoice_id
              AND ci.company_id = client_receipt_allocations.company_id
              AND ci.project_id = client_receipt_allocations.project_id
              AND ci.client_account_id = client_receipt_allocations.client_account_id
        )
    );

DROP POLICY IF EXISTS p_cra_update ON public.client_receipt_allocations;
CREATE POLICY p_cra_update ON public.client_receipt_allocations
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_receipts cr
            WHERE cr.id = client_receipt_allocations.receipt_id
              AND cr.company_id = client_receipt_allocations.company_id
              AND cr.project_id = client_receipt_allocations.project_id
              AND cr.client_account_id = client_receipt_allocations.client_account_id
        )
        AND EXISTS (
            SELECT 1 FROM public.client_invoices ci
            WHERE ci.id = client_receipt_allocations.invoice_id
              AND ci.company_id = client_receipt_allocations.company_id
              AND ci.project_id = client_receipt_allocations.project_id
              AND ci.client_account_id = client_receipt_allocations.client_account_id
        )
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_receipts cr
            WHERE cr.id = client_receipt_allocations.receipt_id
              AND cr.company_id = client_receipt_allocations.company_id
              AND cr.project_id = client_receipt_allocations.project_id
              AND cr.client_account_id = client_receipt_allocations.client_account_id
        )
        AND EXISTS (
            SELECT 1 FROM public.client_invoices ci
            WHERE ci.id = client_receipt_allocations.invoice_id
              AND ci.company_id = client_receipt_allocations.company_id
              AND ci.project_id = client_receipt_allocations.project_id
              AND ci.client_account_id = client_receipt_allocations.client_account_id
        )
    );

DROP POLICY IF EXISTS p_cra_delete ON public.client_receipt_allocations;
CREATE POLICY p_cra_delete ON public.client_receipt_allocations
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.client_receipts cr
            WHERE cr.id = client_receipt_allocations.receipt_id
              AND cr.company_id = client_receipt_allocations.company_id
              AND cr.project_id = client_receipt_allocations.project_id
              AND cr.client_account_id = client_receipt_allocations.client_account_id
        )
        AND EXISTS (
            SELECT 1 FROM public.client_invoices ci
            WHERE ci.id = client_receipt_allocations.invoice_id
              AND ci.company_id = client_receipt_allocations.company_id
              AND ci.project_id = client_receipt_allocations.project_id
              AND ci.client_account_id = client_receipt_allocations.client_account_id
        )
    );


-- ============================================================================
-- 2. MUTATING SECURITY DEFINER RPCs WITH BILLING WRITE ENFORCEMENT
-- ============================================================================

-- 2.1 CONTRACT WORKFLOWS

CREATE OR REPLACE FUNCTION public.activate_client_contract(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.project_client_contracts%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
BEGIN
    SELECT * INTO v_rec FROM public.project_client_contracts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot activate archived contract.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Contract must be Draft to activate (current: %).', v_rec.status;
    END IF;

    -- Lock and validate stored client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client account not found.';
    END IF;
    IF v_ca_archived IS TRUE THEN
        RAISE EXCEPTION 'Cannot activate contract for an archived client account.';
    END IF;
    IF v_ca_active IS FALSE THEN
        RAISE EXCEPTION 'Cannot activate contract for an inactive client account.';
    END IF;

    UPDATE public.project_client_contracts
    SET status = 'Active',
        activated_by = auth.uid(),
        activated_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.activate_client_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_client_contract(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.close_client_contract(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.project_client_contracts%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.project_client_contracts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot close archived contract.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Active' THEN
        RAISE EXCEPTION 'Contract must be Active to close (current: %).', v_rec.status;
    END IF;

    UPDATE public.project_client_contracts
    SET status = 'Closed',
        closed_by = auth.uid(),
        closed_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.close_client_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_client_contract(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_client_contract(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.project_client_contracts%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.project_client_contracts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel archived contract.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status NOT IN ('Draft', 'Active') THEN
        RAISE EXCEPTION 'Contract cannot be cancelled in status %.', v_rec.status;
    END IF;

    UPDATE public.project_client_contracts
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.cancel_client_contract(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_client_contract(uuid, text) TO authenticated;


-- 2.2 INVOICE WORKFLOWS

CREATE OR REPLACE FUNCTION public.submit_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_pcc_status text;
    v_pcc_archived boolean;
    v_line_count integer;
BEGIN
    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot submit archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Invoice must be Draft to submit (current: %).', v_rec.status;
    END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot submit invoice for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot submit invoice for an inactive client account.'; END IF;

    -- Lock and validate contract
    SELECT status, is_archived INTO v_pcc_status, v_pcc_archived
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;
    IF v_pcc_archived IS TRUE THEN RAISE EXCEPTION 'Cannot submit invoice for an archived contract.'; END IF;
    IF v_pcc_status <> 'Active' THEN RAISE EXCEPTION 'Contract must be Active to submit invoice (current: %).', v_pcc_status; END IF;

    SELECT COUNT(*) INTO v_line_count 
    FROM public.client_invoice_lines 
    WHERE invoice_id = p_id AND is_archived = false;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'Invoice must contain at least one line item before submission.';
    END IF;

    IF v_rec.total_incl_vat <= 0 THEN
        RAISE EXCEPTION 'Invoice total must be positive to submit.';
    END IF;

    UPDATE public.client_invoices
    SET status = 'Submitted',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.submit_client_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_client_invoice(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.approve_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_pcc_status text;
    v_pcc_archived boolean;
BEGIN
    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot approve archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Invoice must be Submitted to approve (current: %).', v_rec.status;
    END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot approve invoice for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot approve invoice for an inactive client account.'; END IF;

    -- Lock and validate contract
    SELECT status, is_archived INTO v_pcc_status, v_pcc_archived
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;
    IF v_pcc_archived IS TRUE THEN RAISE EXCEPTION 'Cannot approve invoice for an archived contract.'; END IF;
    IF v_pcc_status <> 'Active' THEN RAISE EXCEPTION 'Contract must be Active to approve invoice (current: %).', v_pcc_status; END IF;

    UPDATE public.client_invoices
    SET status = 'Approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.approve_client_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_client_invoice(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.reject_client_invoice(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Rejection reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot reject archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Invoice must be Submitted to reject (current: %).', v_rec.status;
    END IF;

    UPDATE public.client_invoices
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.reject_client_invoice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_client_invoice(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.issue_client_invoice(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_pcc_status text;
    v_pcc_archived boolean;
    v_num text;
BEGIN
    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot issue archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Approved' THEN
        RAISE EXCEPTION 'Invoice must be Approved to issue (current: %).', v_rec.status;
    END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot issue invoice for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot issue invoice for an inactive client account.'; END IF;

    -- Lock and validate contract
    SELECT status, is_archived INTO v_pcc_status, v_pcc_archived
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;
    IF v_pcc_archived IS TRUE THEN RAISE EXCEPTION 'Cannot issue invoice for an archived contract.'; END IF;
    IF v_pcc_status <> 'Active' THEN RAISE EXCEPTION 'Contract must be Active to issue invoice (current: %).', v_pcc_status; END IF;

    v_num := btrim(v_rec.invoice_number);
    IF v_num IS NULL OR v_num = '' THEN
        RAISE EXCEPTION 'Invoice number is mandatory before issuing.';
    END IF;

    UPDATE public.client_invoices
    SET status = 'Issued',
        issued_by = auth.uid(),
        issued_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.issue_client_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_client_invoice(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_client_invoice(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_invoices%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_invoices WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel archived invoice.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status = 'Issued' THEN
        RAISE EXCEPTION 'Issued invoices cannot be cancelled. Issue a credit note to process corrections.';
    END IF;
    IF v_rec.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
        RAISE EXCEPTION 'Invoice cannot be cancelled in status %.', v_rec.status;
    END IF;

    UPDATE public.client_invoices
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.cancel_client_invoice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_client_invoice(uuid, text) TO authenticated;


-- 2.3 CREDIT NOTE WORKFLOWS

CREATE OR REPLACE FUNCTION public.submit_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_credit_notes%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_inv public.client_invoices%ROWTYPE;
    v_line_count integer;
BEGIN
    SELECT * INTO v_rec FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot submit archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Credit note must be Draft to submit (current: %).', v_rec.status;
    END IF;

    -- Lock and validate referenced invoice first
    SELECT * INTO v_inv
    FROM public.client_invoices
    WHERE id = v_rec.invoice_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
      AND contract_id = v_rec.contract_id
      AND currency = v_rec.currency
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived invoice.'; END IF;
    IF v_inv.is_archived IS TRUE THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived invoice.'; END IF;
    IF v_inv.status <> 'Issued' THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived invoice.'; END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot submit credit note for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot submit credit note for an inactive client account.'; END IF;

    -- Lock and validate contract relationship (do not reject solely because a Closed contract is archived)
    PERFORM 1
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;

    SELECT COUNT(*) INTO v_line_count 
    FROM public.client_credit_note_lines 
    WHERE credit_note_id = p_id AND is_archived = false;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'Credit note must contain at least one line item before submission.';
    END IF;

    IF v_rec.total_incl_vat <= 0 THEN
        RAISE EXCEPTION 'Credit note total must be positive to submit.';
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Submitted',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.submit_client_credit_note(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_client_credit_note(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.approve_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_credit_notes%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_inv public.client_invoices%ROWTYPE;
BEGIN
    SELECT * INTO v_rec FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot approve archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Credit note must be Submitted to approve (current: %).', v_rec.status;
    END IF;

    -- Lock and validate referenced invoice first
    SELECT * INTO v_inv
    FROM public.client_invoices
    WHERE id = v_rec.invoice_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
      AND contract_id = v_rec.contract_id
      AND currency = v_rec.currency
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Referenced invoice must be Issued and non-archived.'; END IF;
    IF v_inv.is_archived IS TRUE THEN RAISE EXCEPTION 'Referenced invoice must be Issued and non-archived.'; END IF;
    IF v_inv.status <> 'Issued' THEN RAISE EXCEPTION 'Referenced invoice must be Issued and non-archived.'; END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot approve credit note for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot approve credit note for an inactive client account.'; END IF;

    -- Lock and validate contract relationship
    PERFORM 1
    FROM public.project_client_contracts
    WHERE id = v_rec.contract_id
      AND company_id = v_rec.company_id
      AND project_id = v_rec.project_id
      AND client_account_id = v_rec.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;

    IF v_rec.total_incl_vat <= 0 THEN
        RAISE EXCEPTION 'Credit note total must be positive.';
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Approved',
        approved_by = auth.uid(),
        approved_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.approve_client_credit_note(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_client_credit_note(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.reject_client_credit_note(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_credit_notes%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Rejection reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot reject archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Submitted' THEN
        RAISE EXCEPTION 'Credit note must be Submitted to reject (current: %).', v_rec.status;
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Rejected',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.reject_client_credit_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_client_credit_note(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.issue_client_credit_note(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_cn public.client_credit_notes%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
    v_inv public.client_invoices%ROWTYPE;
    v_issued_cn_sum numeric(15,2);
    v_allocated_sum numeric(15,2);
    v_net_outstanding numeric(15,2);
    v_num text;
BEGIN
    SELECT * INTO v_cn FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_cn.is_archived THEN RAISE EXCEPTION 'Cannot issue archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_cn.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_cn.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_cn.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_cn.status <> 'Approved' THEN
        RAISE EXCEPTION 'Credit note must be Approved to issue (current: %).', v_cn.status;
    END IF;

    v_num := btrim(v_cn.credit_note_number);
    IF v_num IS NULL OR v_num = '' THEN
        RAISE EXCEPTION 'Credit note number is mandatory before issuing.';
    END IF;

    IF v_cn.total_incl_vat <= 0 THEN
        RAISE EXCEPTION 'Credit note amount must be greater than zero to issue.';
    END IF;

    -- Lock target invoice FOR UPDATE first
    SELECT * INTO v_inv
    FROM public.client_invoices
    WHERE id = v_cn.invoice_id
      AND company_id = v_cn.company_id
      AND project_id = v_cn.project_id
      AND client_account_id = v_cn.client_account_id
      AND contract_id = v_cn.contract_id
      AND currency = v_cn.currency
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived client invoice.'; END IF;
    IF v_inv.is_archived IS TRUE THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived client invoice.'; END IF;
    IF v_inv.status <> 'Issued' THEN RAISE EXCEPTION 'Credit note must reference an Issued, non-archived client invoice.'; END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_cn.client_account_id AND company_id = v_cn.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot issue credit note for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot issue credit note for an inactive client account.'; END IF;

    -- Lock and validate contract relationship
    PERFORM 1
    FROM public.project_client_contracts
    WHERE id = v_cn.contract_id
      AND company_id = v_cn.company_id
      AND project_id = v_cn.project_id
      AND client_account_id = v_cn.client_account_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found or mismatch.'; END IF;

    -- Transaction-safe balance check
    SELECT COALESCE(SUM(total_incl_vat), 0.00) INTO v_issued_cn_sum
    FROM public.client_credit_notes
    WHERE invoice_id = v_cn.invoice_id AND status = 'Issued' AND is_archived = false;

    SELECT COALESCE(SUM(amount_allocated), 0.00) INTO v_allocated_sum
    FROM public.client_receipt_allocations
    WHERE invoice_id = v_cn.invoice_id AND status = 'Active';

    v_net_outstanding := v_inv.total_incl_vat - v_issued_cn_sum - v_allocated_sum;

    IF v_cn.total_incl_vat > v_net_outstanding THEN
        RAISE EXCEPTION 'Credit note amount (ZAR %) exceeds remaining outstanding invoice balance (ZAR %).', v_cn.total_incl_vat, v_net_outstanding;
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Issued',
        issued_by = auth.uid(),
        issued_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_cn;

    RETURN to_jsonb(v_cn);
END;
$;

REVOKE ALL ON FUNCTION public.issue_client_credit_note(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_client_credit_note(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_client_credit_note(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_credit_notes%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_credit_notes WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Credit note % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel archived credit note.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
        RAISE EXCEPTION 'Credit note cannot be cancelled in status %.', v_rec.status;
    END IF;

    UPDATE public.client_credit_notes
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.cancel_client_credit_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_client_credit_note(uuid, text) TO authenticated;


-- 2.4 RECEIPT WORKFLOWS

CREATE OR REPLACE FUNCTION public.post_client_receipt(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_ca_active boolean;
    v_ca_archived boolean;
BEGIN
    SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Receipt % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot post archived receipt.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Receipt must be Draft to post (current: %).', v_rec.status;
    END IF;

    -- Lock and validate client account
    SELECT is_active, is_archived INTO v_ca_active, v_ca_archived
    FROM public.client_accounts
    WHERE id = v_rec.client_account_id AND company_id = v_rec.company_id
    FOR SHARE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Client account not found.'; END IF;
    IF v_ca_archived IS TRUE THEN RAISE EXCEPTION 'Cannot post receipt for an archived client account.'; END IF;
    IF v_ca_active IS FALSE THEN RAISE EXCEPTION 'Cannot post receipt for an inactive client account.'; END IF;

    UPDATE public.client_receipts
    SET status = 'Posted',
        posted_by = auth.uid(),
        posted_at = now(),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.post_client_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_client_receipt(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.reverse_client_receipt(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Reversal reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Receipt % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot reverse archived receipt.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Posted' THEN
        RAISE EXCEPTION 'Receipt must be Posted to reverse (current: %).', v_rec.status;
    END IF;

    -- Reversing a receipt reverses all active allocations for this receipt
    UPDATE public.client_receipt_allocations
    SET status = 'Reversed',
        reversed_by = auth.uid(),
        reversed_at = now(),
        reversal_reason = 'Receipt ' || v_rec.receipt_number || ' reversed: ' || v_reason
    WHERE receipt_id = p_id AND status = 'Active';

    UPDATE public.client_receipts
    SET status = 'Reversed',
        reversed_by = auth.uid(),
        reversed_at = now(),
        reversal_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.reverse_client_receipt(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_client_receipt(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_client_receipt(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason is required.';
    END IF;

    SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Receipt % not found.', p_id; END IF;
    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot cancel archived receipt.'; END IF;
    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.status <> 'Draft' THEN
        RAISE EXCEPTION 'Receipt can only be cancelled in Draft status (current: %).', v_rec.status;
    END IF;

    UPDATE public.client_receipts
    SET status = 'Cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_id
    RETURNING * INTO v_rec;

    RETURN to_jsonb(v_rec);
END;
$;

REVOKE ALL ON FUNCTION public.cancel_client_receipt(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_client_receipt(uuid, text) TO authenticated;


-- 2.5 RECEIPT ALLOCATION WORKFLOWS

CREATE OR REPLACE FUNCTION public.allocate_client_receipt(
    p_receipt_id uuid,
    p_invoice_id uuid,
    p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_rec public.client_receipts%ROWTYPE;
    v_inv public.client_invoices%ROWTYPE;
    v_rec_allocated_sum numeric(15,2);
    v_unallocated_receipt numeric(15,2);
    v_issued_cn_sum numeric(15,2);
    v_inv_allocated_sum numeric(15,2);
    v_outstanding_inv numeric(15,2);
    v_result jsonb;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Allocation amount must be greater than zero.';
    END IF;

    -- Lock receipt and invoice in deterministic order to prevent deadlock
    IF p_receipt_id < p_invoice_id THEN
        SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_receipt_id FOR UPDATE;
        SELECT * INTO v_inv FROM public.client_invoices WHERE id = p_invoice_id FOR UPDATE;
    ELSE
        SELECT * INTO v_inv FROM public.client_invoices WHERE id = p_invoice_id FOR UPDATE;
        SELECT * INTO v_rec FROM public.client_receipts WHERE id = p_receipt_id FOR UPDATE;
    END IF;

    IF v_rec.id IS NULL THEN RAISE EXCEPTION 'Receipt % not found.', p_receipt_id; END IF;
    IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invoice % not found.', p_invoice_id; END IF;

    IF v_rec.is_archived THEN RAISE EXCEPTION 'Cannot allocate from an archived receipt.'; END IF;
    IF v_inv.is_archived THEN RAISE EXCEPTION 'Cannot allocate to an archived invoice.'; END IF;

    IF NOT public.has_finance_full_access(v_rec.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_rec.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_rec.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_rec.company_id <> v_inv.company_id OR
       v_rec.project_id <> v_inv.project_id OR
       v_rec.client_account_id <> v_inv.client_account_id OR
       v_rec.currency <> v_inv.currency THEN
        RAISE EXCEPTION 'Receipt and invoice parameters (company, project, client, currency) do not match.';
    END IF;

    IF v_rec.status <> 'Posted' THEN
        RAISE EXCEPTION 'Only Posted receipts can be allocated (current: %).', v_rec.status;
    END IF;

    IF v_inv.status <> 'Issued' THEN
        RAISE EXCEPTION 'Only Issued invoices can receive allocations (current: %).', v_inv.status;
    END IF;

    -- Check unallocated receipt balance
    SELECT COALESCE(SUM(amount_allocated), 0.00) INTO v_rec_allocated_sum
    FROM public.client_receipt_allocations
    WHERE receipt_id = p_receipt_id AND status = 'Active';

    v_unallocated_receipt := v_rec.amount_received - v_rec_allocated_sum;

    IF p_amount > v_unallocated_receipt THEN
        RAISE EXCEPTION 'Allocation amount (ZAR %) exceeds remaining unallocated receipt balance (ZAR %).', p_amount, v_unallocated_receipt;
    END IF;

    -- Check remaining outstanding invoice balance
    SELECT COALESCE(SUM(total_incl_vat), 0.00) INTO v_issued_cn_sum
    FROM public.client_credit_notes
    WHERE invoice_id = p_invoice_id AND status = 'Issued' AND is_archived = false;

    SELECT COALESCE(SUM(amount_allocated), 0.00) INTO v_inv_allocated_sum
    FROM public.client_receipt_allocations
    WHERE invoice_id = p_invoice_id AND status = 'Active';

    v_outstanding_inv := v_inv.total_incl_vat - v_issued_cn_sum - v_inv_allocated_sum;

    IF p_amount > v_outstanding_inv THEN
        RAISE EXCEPTION 'Allocation amount (ZAR %) exceeds remaining outstanding invoice balance (ZAR %).', p_amount, v_outstanding_inv;
    END IF;

    INSERT INTO public.client_receipt_allocations (
        company_id,
        project_id,
        client_account_id,
        receipt_id,
        invoice_id,
        amount_allocated,
        status,
        allocated_by,
        allocated_at,
        transaction_identifier
    ) VALUES (
        v_rec.company_id,
        v_rec.project_id,
        v_rec.client_account_id,
        p_receipt_id,
        p_invoice_id,
        p_amount,
        'Active',
        auth.uid(),
        now(),
        pg_current_xact_id()::text
    ) RETURNING to_jsonb(client_receipt_allocations.*) INTO v_result;

    RETURN v_result;
END;
$;

REVOKE ALL ON FUNCTION public.allocate_client_receipt(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_client_receipt(uuid, uuid, numeric) TO authenticated;


CREATE OR REPLACE FUNCTION public.reverse_client_receipt_allocation(p_allocation_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_alloc public.client_receipt_allocations%ROWTYPE;
    v_reason text := btrim(p_reason);
BEGIN
    IF v_reason IS NULL OR v_reason = '' THEN
        RAISE EXCEPTION 'Reversal reason is required.';
    END IF;

    SELECT * INTO v_alloc FROM public.client_receipt_allocations WHERE id = p_allocation_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Allocation % not found.', p_allocation_id; END IF;
    IF NOT public.has_finance_full_access(v_alloc.company_id) THEN
        RAISE EXCEPTION 'Access denied for company %.', v_alloc.company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_alloc.company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_alloc.status <> 'Active' THEN
        RAISE EXCEPTION 'Allocation is already reversed.';
    END IF;

    UPDATE public.client_receipt_allocations
    SET status = 'Reversed',
        reversed_by = auth.uid(),
        reversed_at = now(),
        reversal_reason = v_reason
    WHERE id = p_allocation_id
    RETURNING * INTO v_alloc;

    RETURN to_jsonb(v_alloc);
END;
$;

REVOKE ALL ON FUNCTION public.reverse_client_receipt_allocation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_client_receipt_allocation(uuid, text) TO authenticated;


-- ============================================================================
-- 3. SECURED ARCHIVE & RESTORE FUNCTIONS WITH CLIENT ACCOUNTS SUPPORT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_company_id uuid;
    v_status text;
    v_is_active boolean;
    v_is_archived boolean;
    v_parent_id uuid;
    v_cnt integer;
    v_sql text;
    v_result jsonb;
BEGIN
    IF p_table NOT IN (
        'project_budget_versions',
        'financial_commitments',
        'financial_cost_postings',
        'project_financial_forecasts',
        'client_accounts',
        'project_client_contracts',
        'client_invoices',
        'client_credit_notes',
        'client_receipts',
        'client_invoice_lines',
        'client_credit_note_lines'
    ) THEN
        RAISE EXCEPTION 'Table % is not eligible for soft archiving.', p_table;
    END IF;

    -- Fetch record & lock
    v_sql := format('SELECT company_id, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table);
    EXECUTE v_sql INTO v_company_id, v_is_archived USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % in table % was not found.', p_id, p_table;
    END IF;

    IF v_is_archived IS TRUE THEN
        RAISE EXCEPTION 'Record is already archived.';
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance permissions for company %.', v_company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Table-specific status & eligibility validations
    IF p_table IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts', 'project_client_contracts', 'client_invoices', 'client_credit_notes', 'client_receipts') THEN
        v_sql := format('SELECT status FROM public.%I WHERE id = $1', p_table);
        EXECUTE v_sql INTO v_status USING p_id;
    END IF;

    IF p_table = 'project_budget_versions' AND v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
        RAISE EXCEPTION 'Budget version cannot be archived in status %.', v_status;
    ELSIF p_table = 'financial_commitments' AND v_status NOT IN ('Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Financial commitment cannot be archived in status %.', v_status;
    ELSIF p_table = 'financial_cost_postings' AND v_status NOT IN ('Draft', 'Rejected') THEN
        RAISE EXCEPTION 'Cost posting cannot be archived in status %.', v_status;
    ELSIF p_table = 'project_financial_forecasts' AND v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
        RAISE EXCEPTION 'Forecast cannot be archived in status %.', v_status;
    ELSIF p_table = 'project_client_contracts' AND v_status NOT IN ('Draft', 'Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Contract cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_invoices' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Client invoice cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_credit_notes' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Credit note cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_receipts' AND v_status NOT IN ('Draft', 'Cancelled') THEN
        RAISE EXCEPTION 'Receipt cannot be archived in status %.', v_status;
    ELSIF p_table = 'client_invoice_lines' THEN
        SELECT invoice_id INTO v_parent_id FROM public.client_invoice_lines WHERE id = p_id;
        SELECT status INTO v_status FROM public.client_invoices WHERE id = v_parent_id;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Invoice line cannot be archived when parent invoice status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_credit_note_lines' THEN
        SELECT credit_note_id INTO v_parent_id FROM public.client_credit_note_lines WHERE id = p_id;
        SELECT status INTO v_status FROM public.client_credit_notes WHERE id = v_parent_id;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Credit note line cannot be archived when parent credit note status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_accounts' THEN
        SELECT is_active INTO v_is_active FROM public.client_accounts WHERE id = p_id;
        IF v_is_active IS TRUE THEN
            RAISE EXCEPTION 'Client account must be marked inactive before archiving.';
        END IF;

        -- Check active contracts
        SELECT COUNT(*) INTO v_cnt FROM public.project_client_contracts WHERE client_account_id = p_id AND status = 'Active' AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Active contracts.'; END IF;

        -- Check non-terminal invoices
        SELECT COUNT(*) INTO v_cnt FROM public.client_invoices WHERE client_account_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with non-terminal invoices.'; END IF;

        -- Check non-terminal credit notes
        SELECT COUNT(*) INTO v_cnt FROM public.client_credit_notes WHERE client_account_id = p_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with non-terminal credit notes.'; END IF;

        -- Check non-terminal receipts
        SELECT COUNT(*) INTO v_cnt FROM public.client_receipts WHERE client_account_id = p_id AND status = 'Draft' AND is_archived = false;
        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with draft receipts.'; END IF;

        -- Check Issued invoices with outstanding balance
        SELECT COUNT(*) INTO v_cnt
        FROM (
            SELECT ci.id,
                   ci.total_incl_vat,
                   COALESCE((SELECT SUM(ccn.total_incl_vat) FROM public.client_credit_notes ccn WHERE ccn.invoice_id = ci.id AND ccn.status = 'Issued' AND ccn.is_archived = false), 0.00) AS cn_sum,
                   COALESCE((SELECT SUM(cra.amount_allocated) FROM public.client_receipt_allocations cra WHERE cra.invoice_id = ci.id AND cra.status = 'Active'), 0.00) AS alloc_sum
            FROM public.client_invoices ci
            WHERE ci.client_account_id = p_id AND ci.status = 'Issued' AND ci.is_archived = false
        ) inv_bal
        WHERE (inv_bal.total_incl_vat - inv_bal.cn_sum - inv_bal.alloc_sum) > 0;

        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Issued invoices that have an outstanding balance.'; END IF;

        -- Check Posted receipts with unallocated balance
        SELECT COUNT(*) INTO v_cnt
        FROM (
            SELECT cr.id,
                   cr.amount_received,
                   COALESCE((SELECT SUM(cra.amount_allocated) FROM public.client_receipt_allocations cra WHERE cra.receipt_id = cr.id AND cra.status = 'Active'), 0.00) AS alloc_sum
            FROM public.client_receipts cr
            WHERE cr.client_account_id = p_id AND cr.status = 'Posted' AND cr.is_archived = false
        ) rec_bal
        WHERE (rec_bal.amount_received - rec_bal.alloc_sum) > 0;

        IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot archive client with Posted receipts that have an unallocated balance.'; END IF;
    END IF;

    -- Execute Archive mutation
    v_sql := format('UPDATE public.%I SET is_archived = true, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table);
    EXECUTE v_sql INTO v_result USING p_id;

    RETURN v_result;
END;
$;

REVOKE ALL ON FUNCTION public.archive_finance_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_finance_record(text, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.restore_finance_record(p_table text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
    v_company_id uuid;
    v_status text;
    v_is_archived boolean;
    v_parent_id uuid;
    v_sql text;
    v_result jsonb;
BEGIN
    IF p_table NOT IN (
        'project_budget_versions',
        'financial_commitments',
        'financial_cost_postings',
        'project_financial_forecasts',
        'client_accounts',
        'project_client_contracts',
        'client_invoices',
        'client_credit_notes',
        'client_receipts',
        'client_invoice_lines',
        'client_credit_note_lines'
    ) THEN
        RAISE EXCEPTION 'Table % is not eligible for soft restoration.', p_table;
    END IF;

    v_sql := format('SELECT company_id, is_archived FROM public.%I WHERE id = $1 FOR UPDATE', p_table);
    EXECUTE v_sql INTO v_company_id, v_is_archived USING p_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Record % in table % was not found.', p_id, p_table;
    END IF;

    IF v_is_archived IS FALSE THEN
        RAISE EXCEPTION 'Record is not archived.';
    END IF;

    IF NOT public.has_finance_full_access(v_company_id) THEN
        RAISE EXCEPTION 'Access denied: user lacks finance permissions for company %.', v_company_id;
    END IF;

    IF NOT public.company_billing_allows_operational_write(v_company_id) THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF p_table IN ('project_budget_versions', 'financial_commitments', 'financial_cost_postings', 'project_financial_forecasts', 'project_client_contracts', 'client_invoices', 'client_credit_notes', 'client_receipts') THEN
        v_sql := format('SELECT status FROM public.%I WHERE id = $1', p_table);
        EXECUTE v_sql INTO v_status USING p_id;
    END IF;

    IF p_table = 'project_budget_versions' AND v_status NOT IN ('Draft', 'Rejected', 'Superseded', 'Cancelled') THEN
        RAISE EXCEPTION 'Budget version cannot be restored in status %.', v_status;
    ELSIF p_table = 'financial_commitments' AND v_status NOT IN ('Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Financial commitment cannot be restored in status %.', v_status;
    ELSIF p_table = 'financial_cost_postings' AND v_status NOT IN ('Draft', 'Rejected') THEN
        RAISE EXCEPTION 'Cost posting cannot be restored in status %.', v_status;
    ELSIF p_table = 'project_financial_forecasts' AND v_status NOT IN ('Draft', 'Rejected', 'Superseded') THEN
        RAISE EXCEPTION 'Forecast cannot be restored in status %.', v_status;
    ELSIF p_table = 'project_client_contracts' AND v_status NOT IN ('Draft', 'Closed', 'Cancelled') THEN
        RAISE EXCEPTION 'Contract cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_invoices' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Client invoice cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_credit_notes' AND v_status NOT IN ('Draft', 'Rejected', 'Cancelled') THEN
        RAISE EXCEPTION 'Credit note cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_receipts' AND v_status NOT IN ('Draft', 'Cancelled') THEN
        RAISE EXCEPTION 'Receipt cannot be restored in status %.', v_status;
    ELSIF p_table = 'client_invoice_lines' THEN
        SELECT invoice_id INTO v_parent_id FROM public.client_invoice_lines WHERE id = p_id;
        SELECT status INTO v_status FROM public.client_invoices WHERE id = v_parent_id;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Invoice line cannot be restored when parent invoice status is %.', v_status;
        END IF;
    ELSIF p_table = 'client_credit_note_lines' THEN
        SELECT credit_note_id INTO v_parent_id FROM public.client_credit_note_lines WHERE id = p_id;
        SELECT status INTO v_status FROM public.client_credit_notes WHERE id = v_parent_id;
        IF v_status <> 'Draft' THEN
            RAISE EXCEPTION 'Credit note line cannot be restored when parent credit note status is %.', v_status;
        END IF;
    END IF;

    v_sql := format('UPDATE public.%I SET is_archived = false, updated_at = now(), updated_by = auth.uid() WHERE id = $1 RETURNING to_jsonb(public.%I.*)', p_table, p_table);
    EXECUTE v_sql INTO v_result USING p_id;

    RETURN v_result;
END;
$;

REVOKE ALL ON FUNCTION public.restore_finance_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_finance_record(text, uuid) TO authenticated;

COMMIT;


-- Migration: 20260828000001_enforce_billing_supplier_accounts.sql
-- ProjectMatrix Phase 3A.2 — Step 3C.4F-1E: Enforce Billing Access on Supplier Accounts
--
-- Summary:
-- 1. Updates Row Level Security (RLS) write policies (INSERT, UPDATE, DELETE) for all 8 Supplier Accounts tables:
--    - public.supplier_accounts
--    - public.supplier_invoices
--    - public.supplier_invoice_lines
--    - public.supplier_credit_notes
--    - public.supplier_credit_note_lines
--    - public.supplier_payments
--    - public.supplier_payment_allocations
--    - public.supplier_attachments
--
-- 2. Enforces operational write entitlement:
--    public.company_billing_allows_operational_write(company_id)
--    - INSERT: in WITH CHECK
--    - UPDATE: in both USING and WITH CHECK
--    - DELETE: in USING
--
-- 3. Enforces authoritative parent company validation for child tables:
--    - supplier_invoice_lines -> supplier_invoices
--    - supplier_credit_note_lines -> supplier_credit_notes
--    - supplier_payment_allocations -> supplier_payments AND supplier_invoices
--    - supplier_attachments -> validates company_id
--
-- 4. Updates all user-facing mutating SECURITY DEFINER RPCs to reject execution when company billing is read-only:
--    - Raises exception with ERRCODE = 'PM001' and exact message: 'Company billing access is read-only.'
--    - Guards execute before any UPDATE or INSERT statements.
--
-- 5. SELECT policies remain unchanged to allow read-only export and viewing.

-- ============================================================================
-- SECTION 1: ROW LEVEL SECURITY POLICIES FOR 8 SUPPLIER ACCOUNTS TABLES
-- ============================================================================

-- 1.1 SUPPLIER ACCOUNTS
ALTER TABLE public.supplier_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_sa_insert ON public.supplier_accounts;
DROP POLICY IF EXISTS p_sa_insert ON public.supplier_accounts;
CREATE POLICY p_sa_insert ON public.supplier_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_sa_update ON public.supplier_accounts;
DROP POLICY IF EXISTS p_sa_update ON public.supplier_accounts;
CREATE POLICY p_sa_update ON public.supplier_accounts
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_sa_delete ON public.supplier_accounts;
DROP POLICY IF EXISTS p_sa_delete ON public.supplier_accounts;
CREATE POLICY p_sa_delete ON public.supplier_accounts
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );


-- 1.2 SUPPLIER INVOICES
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_si_insert ON public.supplier_invoices;
DROP POLICY IF EXISTS p_si_insert ON public.supplier_invoices;
CREATE POLICY p_si_insert ON public.supplier_invoices
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_si_update ON public.supplier_invoices;
DROP POLICY IF EXISTS p_si_update ON public.supplier_invoices;
CREATE POLICY p_si_update ON public.supplier_invoices
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_si_delete ON public.supplier_invoices;
DROP POLICY IF EXISTS p_si_delete ON public.supplier_invoices;
CREATE POLICY p_si_delete ON public.supplier_invoices
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );


-- 1.3 SUPPLIER INVOICE LINES
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_sil_insert ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS p_sil_insert ON public.supplier_invoice_lines;
CREATE POLICY p_sil_insert ON public.supplier_invoice_lines
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_invoices si
            WHERE si.id = supplier_invoice_lines.supplier_invoice_id
              AND si.company_id = supplier_invoice_lines.company_id
              AND si.project_id = supplier_invoice_lines.project_id
        )
    );

DROP POLICY IF EXISTS rls_sil_update ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS p_sil_update ON public.supplier_invoice_lines;
CREATE POLICY p_sil_update ON public.supplier_invoice_lines
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_invoices si
            WHERE si.id = supplier_invoice_lines.supplier_invoice_id
              AND si.company_id = supplier_invoice_lines.company_id
              AND si.project_id = supplier_invoice_lines.project_id
        )
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_invoices si
            WHERE si.id = supplier_invoice_lines.supplier_invoice_id
              AND si.company_id = supplier_invoice_lines.company_id
              AND si.project_id = supplier_invoice_lines.project_id
        )
    );

DROP POLICY IF EXISTS rls_sil_delete ON public.supplier_invoice_lines;
DROP POLICY IF EXISTS p_sil_delete ON public.supplier_invoice_lines;
CREATE POLICY p_sil_delete ON public.supplier_invoice_lines
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_invoices si
            WHERE si.id = supplier_invoice_lines.supplier_invoice_id
              AND si.company_id = supplier_invoice_lines.company_id
              AND si.project_id = supplier_invoice_lines.project_id
        )
    );


-- 1.4 SUPPLIER CREDIT NOTES
ALTER TABLE public.supplier_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credit_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_scn_insert ON public.supplier_credit_notes;
DROP POLICY IF EXISTS p_scn_insert ON public.supplier_credit_notes;
CREATE POLICY p_scn_insert ON public.supplier_credit_notes
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_scn_update ON public.supplier_credit_notes;
DROP POLICY IF EXISTS p_scn_update ON public.supplier_credit_notes;
CREATE POLICY p_scn_update ON public.supplier_credit_notes
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_scn_delete ON public.supplier_credit_notes;
DROP POLICY IF EXISTS p_scn_delete ON public.supplier_credit_notes;
CREATE POLICY p_scn_delete ON public.supplier_credit_notes
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );


-- 1.5 SUPPLIER CREDIT NOTE LINES
ALTER TABLE public.supplier_credit_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_credit_note_lines FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_scnl_insert ON public.supplier_credit_note_lines;
DROP POLICY IF EXISTS p_scnl_insert ON public.supplier_credit_note_lines;
CREATE POLICY p_scnl_insert ON public.supplier_credit_note_lines
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_credit_notes scn
            WHERE scn.id = supplier_credit_note_lines.credit_note_id
              AND scn.company_id = supplier_credit_note_lines.company_id
              AND scn.project_id = supplier_credit_note_lines.project_id
        )
    );

DROP POLICY IF EXISTS rls_scnl_update ON public.supplier_credit_note_lines;
DROP POLICY IF EXISTS p_scnl_update ON public.supplier_credit_note_lines;
CREATE POLICY p_scnl_update ON public.supplier_credit_note_lines
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_credit_notes scn
            WHERE scn.id = supplier_credit_note_lines.credit_note_id
              AND scn.company_id = supplier_credit_note_lines.company_id
              AND scn.project_id = supplier_credit_note_lines.project_id
        )
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_credit_notes scn
            WHERE scn.id = supplier_credit_note_lines.credit_note_id
              AND scn.company_id = supplier_credit_note_lines.company_id
              AND scn.project_id = supplier_credit_note_lines.project_id
        )
    );

DROP POLICY IF EXISTS rls_scnl_delete ON public.supplier_credit_note_lines;
DROP POLICY IF EXISTS p_scnl_delete ON public.supplier_credit_note_lines;
CREATE POLICY p_scnl_delete ON public.supplier_credit_note_lines
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_credit_notes scn
            WHERE scn.id = supplier_credit_note_lines.credit_note_id
              AND scn.company_id = supplier_credit_note_lines.company_id
              AND scn.project_id = supplier_credit_note_lines.project_id
        )
    );


-- 1.6 SUPPLIER PAYMENTS
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_sp_insert ON public.supplier_payments;
DROP POLICY IF EXISTS p_sp_insert ON public.supplier_payments;
CREATE POLICY p_sp_insert ON public.supplier_payments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_sp_update ON public.supplier_payments;
DROP POLICY IF EXISTS p_sp_update ON public.supplier_payments;
CREATE POLICY p_sp_update ON public.supplier_payments
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_sp_delete ON public.supplier_payments;
DROP POLICY IF EXISTS p_sp_delete ON public.supplier_payments;
CREATE POLICY p_sp_delete ON public.supplier_payments
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );


-- 1.7 SUPPLIER PAYMENT ALLOCATIONS
ALTER TABLE public.supplier_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_spa_insert ON public.supplier_payment_allocations;
DROP POLICY IF EXISTS p_spa_insert ON public.supplier_payment_allocations;
CREATE POLICY p_spa_insert ON public.supplier_payment_allocations
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_payments sp
            WHERE sp.id = supplier_payment_allocations.supplier_payment_id
              AND sp.company_id = supplier_payment_allocations.company_id
              AND sp.supplier_account_id = supplier_payment_allocations.supplier_account_id
        )
        AND EXISTS (
            SELECT 1 FROM public.supplier_invoices si
            WHERE si.id = supplier_payment_allocations.supplier_invoice_id
              AND si.company_id = supplier_payment_allocations.company_id
              AND si.supplier_account_id = supplier_payment_allocations.supplier_account_id
        )
    );

DROP POLICY IF EXISTS rls_spa_update ON public.supplier_payment_allocations;
DROP POLICY IF EXISTS p_spa_update ON public.supplier_payment_allocations;
CREATE POLICY p_spa_update ON public.supplier_payment_allocations
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_payments sp
            WHERE sp.id = supplier_payment_allocations.supplier_payment_id
              AND sp.company_id = supplier_payment_allocations.company_id
              AND sp.supplier_account_id = supplier_payment_allocations.supplier_account_id
        )
        AND EXISTS (
            SELECT 1 FROM public.supplier_invoices si
            WHERE si.id = supplier_payment_allocations.supplier_invoice_id
              AND si.company_id = supplier_payment_allocations.company_id
              AND si.supplier_account_id = supplier_payment_allocations.supplier_account_id
        )
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_payments sp
            WHERE sp.id = supplier_payment_allocations.supplier_payment_id
              AND sp.company_id = supplier_payment_allocations.company_id
              AND sp.supplier_account_id = supplier_payment_allocations.supplier_account_id
        )
        AND EXISTS (
            SELECT 1 FROM public.supplier_invoices si
            WHERE si.id = supplier_payment_allocations.supplier_invoice_id
              AND si.company_id = supplier_payment_allocations.company_id
              AND si.supplier_account_id = supplier_payment_allocations.supplier_account_id
        )
    );

DROP POLICY IF EXISTS rls_spa_delete ON public.supplier_payment_allocations;
DROP POLICY IF EXISTS p_spa_delete ON public.supplier_payment_allocations;
CREATE POLICY p_spa_delete ON public.supplier_payment_allocations
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1 FROM public.supplier_payments sp
            WHERE sp.id = supplier_payment_allocations.supplier_payment_id
              AND sp.company_id = supplier_payment_allocations.company_id
              AND sp.supplier_account_id = supplier_payment_allocations.supplier_account_id
        )
        AND EXISTS (
            SELECT 1 FROM public.supplier_invoices si
            WHERE si.id = supplier_payment_allocations.supplier_invoice_id
              AND si.company_id = supplier_payment_allocations.company_id
              AND si.supplier_account_id = supplier_payment_allocations.supplier_account_id
        )
    );


-- 1.8 SUPPLIER ATTACHMENTS
ALTER TABLE public.supplier_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_attachments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_supplier_attachments_insert ON public.supplier_attachments;
DROP POLICY IF EXISTS p_sa_attach_insert ON public.supplier_attachments;
CREATE POLICY p_sa_attach_insert ON public.supplier_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_supplier_attachments_update ON public.supplier_attachments;
DROP POLICY IF EXISTS p_sa_attach_update ON public.supplier_attachments;
CREATE POLICY p_sa_attach_update ON public.supplier_attachments
    FOR UPDATE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS rls_supplier_attachments_delete ON public.supplier_attachments;
DROP POLICY IF EXISTS p_sa_attach_delete ON public.supplier_attachments;
CREATE POLICY p_sa_attach_delete ON public.supplier_attachments
    FOR DELETE TO authenticated
    USING (
        public.has_finance_full_access(company_id)
        AND public.company_billing_allows_operational_write(company_id)
    );

-- ============================================================================
-- SECTION 2: SUPPLIER LIFECYCLE, INVOICE & CREDIT NOTE WORKFLOW RPCS
-- ============================================================================

-- 2.1 ACTIVATION / DEACTIVATION
CREATE OR REPLACE FUNCTION public.activate_supplier_account(p_supplier_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sa public.supplier_accounts%ROWTYPE;
BEGIN
  -- Lock Order 1: supplier_accounts
  SELECT * INTO v_sa FROM public.supplier_accounts WHERE id = p_supplier_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier account % not found.', p_supplier_account_id; END IF;
  IF v_sa.is_archived THEN RAISE EXCEPTION 'Cannot activate archived supplier account.'; END IF;
  IF NOT public.has_finance_full_access(v_sa.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_sa.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_sa.is_active THEN
    RETURN to_jsonb(v_sa);
  END IF;

  UPDATE public.supplier_accounts
  SET is_active = true,
      activated_by = auth.uid(),
      activated_at = now(),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_supplier_account_id
  RETURNING * INTO v_sa;
  RETURN to_jsonb(v_sa);
END;
$$;


CREATE OR REPLACE FUNCTION public.deactivate_supplier_account(
  p_supplier_account_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sa public.supplier_accounts%ROWTYPE;
  v_cnt integer;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank supplier deactivation reason is required.';
  END IF;

  -- Lock Order 1: supplier_accounts
  SELECT * INTO v_sa FROM public.supplier_accounts WHERE id = p_supplier_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier account % not found.', p_supplier_account_id; END IF;
  IF v_sa.is_archived THEN RAISE EXCEPTION 'Cannot deactivate archived supplier account.'; END IF;
  IF NOT public.has_finance_full_access(v_sa.company_id) THEN RAISE EXCEPTION 'Access denied.'; END IF;

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_sa.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF NOT v_sa.is_active THEN
    RAISE EXCEPTION 'Supplier account is already inactive.';
  END IF;

  -- Acquire all dependent locks in the global order before revalidation.
  PERFORM 1
  FROM public.financial_commitments
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.supplier_invoices
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.supplier_credit_notes
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.supplier_payments
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.supplier_payment_allocations
  WHERE supplier_account_id = p_supplier_account_id
  ORDER BY id
  FOR UPDATE;
  PERFORM 1
  FROM public.financial_cost_postings fcp
  WHERE EXISTS (
    SELECT 1
    FROM public.supplier_invoices si
    WHERE si.supplier_account_id = p_supplier_account_id
      AND si.id = fcp.supplier_invoice_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.supplier_credit_notes scn
    WHERE scn.supplier_account_id = p_supplier_account_id
      AND scn.id = fcp.supplier_credit_note_id
  )
  ORDER BY fcp.id
  FOR UPDATE;

  -- Check active commitments
  SELECT COUNT(*) INTO v_cnt FROM public.financial_commitments
  WHERE supplier_account_id = p_supplier_account_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with active commitments.'; END IF;

  -- Check active invoices
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices
  WHERE supplier_account_id = p_supplier_account_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with active invoices.'; END IF;

  -- Check active credit notes
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_credit_notes
  WHERE supplier_account_id = p_supplier_account_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with active credit notes.'; END IF;

  -- Check active payments
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_payments
  WHERE supplier_account_id = p_supplier_account_id AND status IN ('Draft', 'Submitted', 'Approved') AND is_archived = false;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with active payments.'; END IF;

  -- Check outstanding posted invoices
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_invoices si
  WHERE si.supplier_account_id = p_supplier_account_id AND si.status = 'Posted' AND si.is_archived = false
    AND (si.total_incl_vat - COALESCE((SELECT SUM(scn.total_incl_vat) FROM public.supplier_credit_notes scn WHERE scn.invoice_id = si.id AND scn.status = 'Posted' AND scn.is_archived = false), 0.00) - COALESCE((SELECT SUM(spa.amount_allocated) FROM public.supplier_payment_allocations spa WHERE spa.supplier_invoice_id = si.id AND spa.status = 'Active'), 0.00)) > 0;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with outstanding posted invoices.'; END IF;

  -- Check unallocated posted payments
  SELECT COUNT(*) INTO v_cnt FROM public.supplier_payments sp
  WHERE sp.supplier_account_id = p_supplier_account_id AND sp.status = 'Posted' AND sp.is_archived = false
    AND (sp.amount_paid - COALESCE((SELECT SUM(spa.amount_allocated) FROM public.supplier_payment_allocations spa WHERE spa.supplier_payment_id = sp.id AND spa.status = 'Active'), 0.00)) > 0;
  IF v_cnt > 0 THEN RAISE EXCEPTION 'Cannot deactivate supplier with unallocated posted payments.'; END IF;

  UPDATE public.supplier_accounts
  SET is_active = false,
      deactivated_by = auth.uid(),
      deactivated_at = now(),
      deactivation_reason = v_reason,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_supplier_account_id
  RETURNING * INTO v_sa;
  RETURN to_jsonb(v_sa);
END;
$$;


CREATE OR REPLACE FUNCTION public.associate_commitment_supplier(
  p_commitment_id uuid,
  p_supplier_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lookup_company_id uuid;
  v_supplier public.supplier_accounts%ROWTYPE;
  v_commitment public.financial_commitments%ROWTYPE;
  v_old_data jsonb;
BEGIN
  IF p_commitment_id IS NULL OR p_supplier_account_id IS NULL THEN
    RAISE EXCEPTION 'Commitment ID and supplier account ID are required.';
  END IF;

  SELECT company_id INTO v_lookup_company_id
  FROM public.financial_commitments
  WHERE id = p_commitment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial commitment % not found.', p_commitment_id;
  END IF;

  -- Lock supplier before commitment.
  SELECT * INTO v_supplier
  FROM public.supplier_accounts
  WHERE id = p_supplier_account_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier account % not found.', p_supplier_account_id;
  END IF;

  SELECT * INTO v_commitment
  FROM public.financial_commitments
  WHERE id = p_commitment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial commitment % not found after locking.', p_commitment_id;
  END IF;

  IF NOT public.has_finance_full_access(v_commitment.company_id) THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_commitment.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_commitment.company_id <> v_lookup_company_id
     OR v_supplier.company_id <> v_commitment.company_id THEN
    RAISE EXCEPTION 'Supplier and commitment company context mismatch.';
  END IF;
  IF v_supplier.is_active IS NOT TRUE OR v_supplier.is_archived IS TRUE THEN
    RAISE EXCEPTION 'Supplier must be active and non-archived.';
  END IF;
  IF v_commitment.status <> 'Draft' OR v_commitment.is_archived IS TRUE THEN
    RAISE EXCEPTION 'Supplier association requires a Draft, non-archived commitment.';
  END IF;
  IF v_commitment.supplier_account_id IS NOT NULL THEN
    RAISE EXCEPTION 'Commitment already has a supplier and cannot be reassociated.';
  END IF;

  v_old_data := to_jsonb(v_commitment);

  UPDATE public.financial_commitments
  SET supplier_account_id = p_supplier_account_id,
      supplier_associated_by = auth.uid(),
      supplier_associated_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_commitment_id
  RETURNING * INTO v_commitment;

  INSERT INTO public.supplier_accounts_audit_log (
    company_id,
    entity_type,
    entity_id,
    event_type,
    old_data,
    new_data,
    actor_id
  )
  VALUES (
    v_commitment.company_id,
    'financial_commitments',
    v_commitment.id,
    'ASSOCIATE',
    v_old_data,
    to_jsonb(v_commitment),
    auth.uid()
  );

  RETURN to_jsonb(v_commitment);
END;
$$;


-- 2.2 INVOICE WORKFLOWS
CREATE OR REPLACE FUNCTION public.submit_supplier_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_line_cnt integer;
  v_cost_cnt integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_inv.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_inv.status <> 'Draft' THEN RAISE EXCEPTION 'Invoice must be in Draft status to submit.'; END IF;

  SELECT COUNT(*) INTO v_line_cnt FROM public.supplier_invoice_lines WHERE supplier_invoice_id = p_invoice_id AND is_archived = false;
  IF v_line_cnt = 0 THEN RAISE EXCEPTION 'Cannot submit an invoice with no non-archived lines.'; END IF;
  IF v_inv.subtotal_excl_vat <= 0 OR v_inv.total_incl_vat <= 0 THEN
    RAISE EXCEPTION 'Supplier invoice totals must be positive.';
  END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_cnt
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id;
  IF v_cost_cnt <> 0 THEN
    RAISE EXCEPTION 'A non-Posted invoice must not already have a linked cost.';
  END IF;

  PERFORM public.fn_assert_supplier_invoice_capacity(p_invoice_id);

  UPDATE public.supplier_invoices
  SET status = 'Submitted', submitted_by = auth.uid(), submitted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  RETURN to_jsonb(v_inv);
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_supplier_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_cost_cnt integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_inv.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_inv.status <> 'Submitted' THEN RAISE EXCEPTION 'Invoice must be in Submitted status to approve.'; END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_cnt
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id;
  IF v_cost_cnt <> 0 THEN
    RAISE EXCEPTION 'A non-Posted invoice must not already have a linked cost.';
  END IF;

  PERFORM public.fn_assert_supplier_invoice_capacity(p_invoice_id);

  UPDATE public.supplier_invoices
  SET status = 'Approved', approved_by = auth.uid(), approved_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  RETURN to_jsonb(v_inv);
END;
$$;


CREATE OR REPLACE FUNCTION public.post_supplier_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv public.supplier_invoices%ROWTYPE;
  v_cost public.financial_cost_postings%ROWTYPE;
  v_cost_count integer;
BEGIN
  v_inv := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_inv.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*) INTO v_cost_count
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
    AND entry_type = 'Cost';

  IF v_cost_count > 1 THEN
    RAISE EXCEPTION 'Supplier invoice % has more than one primary Cost.', p_invoice_id;
  END IF;

  IF v_cost_count = 1 THEN
    SELECT * INTO v_cost
    FROM public.financial_cost_postings
    WHERE supplier_invoice_id = p_invoice_id
      AND entry_type = 'Cost';
  END IF;

  IF v_inv.status = 'Posted' THEN
    IF v_cost_count <> 1
       OR v_cost.status <> 'Posted'
       OR v_cost.source_type <> 'Supplier Invoice'
       OR v_cost.entry_type <> 'Cost'
       OR v_cost.reversal_of_id IS NOT NULL
       OR v_cost.supplier_invoice_id <> v_inv.id
       OR v_cost.supplier_credit_note_id IS NOT NULL
       OR v_cost.source_record_id <> v_inv.id
       OR v_cost.company_id <> v_inv.company_id
       OR v_cost.project_id <> v_inv.project_id
       OR v_cost.commitment_id <> v_inv.financial_commitment_id
       OR v_cost.currency_code <> v_inv.currency
       OR round(v_cost.amount_excl_vat, 2) <> round(v_inv.subtotal_excl_vat, 2) THEN
      RAISE EXCEPTION 'Posted supplier invoice has an invalid or incomplete linked Cost.';
    END IF;
    RETURN to_jsonb(v_inv);
  END IF;

  IF v_inv.status <> 'Approved' THEN
    RAISE EXCEPTION 'Invoice must be in Approved status to post.';
  END IF;

  PERFORM public.fn_assert_supplier_invoice_capacity(p_invoice_id);

  IF v_cost_count = 0 THEN
    INSERT INTO public.financial_cost_postings (
      company_id,
      project_id,
      posting_reference,
      posting_date,
      source_type,
      source_record_id,
      source_reference,
      commitment_id,
      cost_category,
      description,
      entry_type,
      amount_excl_vat,
      currency_code,
      supplier_invoice_id,
      created_by,
      updated_by
    ) VALUES (
      v_inv.company_id,
      v_inv.project_id,
      'SI-' || gen_random_uuid()::text,
      v_inv.invoice_date,
      'Supplier Invoice',
      v_inv.id,
      v_inv.supplier_invoice_number,
      v_inv.financial_commitment_id,
      'Supplier Cost',
      COALESCE(v_inv.notes, 'Supplier Invoice ' || v_inv.supplier_invoice_number),
      'Cost',
      v_inv.subtotal_excl_vat,
      v_inv.currency,
      v_inv.id,
      auth.uid(),
      auth.uid()
    )
    RETURNING * INTO v_cost;
  END IF;

  IF v_cost.status = 'Draft' THEN
    PERFORM public.submit_financial_cost_posting(v_cost.id);
    PERFORM public.post_financial_cost_posting(v_cost.id);
  ELSIF v_cost.status = 'Submitted' THEN
    PERFORM public.post_financial_cost_posting(v_cost.id);
  ELSIF v_cost.status <> 'Posted' THEN
    RAISE EXCEPTION 'Linked invoice Cost is in incompatible status %.', v_cost.status;
  END IF;

  SELECT * INTO v_cost
  FROM public.financial_cost_postings
  WHERE id = v_cost.id;

  IF v_cost.status <> 'Posted'
     OR v_cost.source_type <> 'Supplier Invoice'
     OR v_cost.entry_type <> 'Cost'
     OR v_cost.reversal_of_id IS NOT NULL
     OR v_cost.supplier_invoice_id <> v_inv.id
     OR v_cost.supplier_credit_note_id IS NOT NULL
     OR v_cost.source_record_id <> v_inv.id
     OR v_cost.company_id <> v_inv.company_id
     OR v_cost.project_id <> v_inv.project_id
     OR v_cost.commitment_id <> v_inv.financial_commitment_id
     OR v_cost.currency_code <> v_inv.currency
     OR round(v_cost.amount_excl_vat, 2) <> round(v_inv.subtotal_excl_vat, 2) THEN
    RAISE EXCEPTION 'Supplier invoice Cost failed post-workflow validation.';
  END IF;

  UPDATE public.supplier_invoices
  SET status = 'Posted', posted_by = auth.uid(), posted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  RETURN to_jsonb(v_inv);
END;
$$;


CREATE OR REPLACE FUNCTION public.reject_supplier_invoice(
  p_invoice_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.supplier_invoices%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank invoice rejection reason is required.';
  END IF;

  v_invoice := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_invoice.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_invoice.status <> 'Submitted' THEN
    RAISE EXCEPTION 'Only a Submitted invoice can be rejected.';
  END IF;

  UPDATE public.supplier_invoices
  SET status = 'Rejected',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_reason = v_reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_invoice;

  RETURN to_jsonb(v_invoice);
END;
$$;


CREATE OR REPLACE FUNCTION public.cancel_supplier_invoice(
  p_invoice_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice public.supplier_invoices%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_cost_count integer;
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A nonblank invoice cancellation reason is required.';
  END IF;

  v_invoice := public.fn_lock_supplier_invoice_context(p_invoice_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_invoice.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_invoice.status NOT IN ('Draft', 'Submitted', 'Approved') THEN
    RAISE EXCEPTION 'Invoice can only be cancelled from Draft, Submitted or Approved status.';
  END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_count
  FROM public.financial_cost_postings
  WHERE supplier_invoice_id = p_invoice_id;
  IF v_cost_count <> 0 THEN
    RAISE EXCEPTION 'Invoice with a linked Cost cannot be cancelled.';
  END IF;

  UPDATE public.supplier_invoices
  SET status = 'Cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      cancellation_reason = v_reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_invoice;

  RETURN to_jsonb(v_invoice);
END;
$$;


-- 2.3 CREDIT NOTE WORKFLOWS
CREATE OR REPLACE FUNCTION public.submit_supplier_credit_note(p_credit_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cn public.supplier_credit_notes%ROWTYPE;
  v_line_cnt integer;
  v_cost_cnt integer;
BEGIN
  v_cn := public.fn_lock_supplier_credit_note_context(p_credit_note_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_cn.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_cn.status <> 'Draft' THEN RAISE EXCEPTION 'Credit note must be in Draft status to submit.'; END IF;

  SELECT COUNT(*) INTO v_line_cnt FROM public.supplier_credit_note_lines WHERE credit_note_id = p_credit_note_id AND is_archived = false;
  IF v_line_cnt = 0 THEN RAISE EXCEPTION 'Cannot submit credit note with no non-archived lines.'; END IF;
  IF v_cn.subtotal_excl_vat <= 0 OR v_cn.total_incl_vat <= 0 THEN
    RAISE EXCEPTION 'Supplier credit-note totals must be positive.';
  END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_cnt
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id;
  IF v_cost_cnt <> 0 THEN
    RAISE EXCEPTION 'A non-Posted credit note must not already have a linked cost.';
  END IF;

  PERFORM public.fn_assert_supplier_credit_capacity(p_credit_note_id);

  UPDATE public.supplier_credit_notes
  SET status = 'Submitted', submitted_by = auth.uid(), submitted_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_credit_note_id RETURNING * INTO v_cn;

  RETURN to_jsonb(v_cn);
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_supplier_credit_note(p_credit_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cn public.supplier_credit_notes%ROWTYPE;
  v_cost_cnt integer;
BEGIN
  v_cn := public.fn_lock_supplier_credit_note_context(p_credit_note_id);

  -- Operational write billing guard
  IF NOT public.company_billing_allows_operational_write(v_cn.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_cn.status <> 'Submitted' THEN RAISE EXCEPTION 'Credit note must be in Submitted status to approve.'; END IF;

  PERFORM 1
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id
  ORDER BY id
  FOR UPDATE;
  SELECT COUNT(*) INTO v_cost_cnt
  FROM public.financial_cost_postings
  WHERE supplier_credit_note_id = p_credit_note_id;
  IF v_cost_cnt <> 0 THEN
    RAISE EXCEPTION 'A non-Posted credit note must not already have a linked cost.';
  END IF;

  PERFORM public.fn_assert_supplier_credit_capacity(p_credit_note_id);

  UPDATE public.supplier_credit_notes
  SET status = 'Approved', approved_by = auth.uid(), approved_at = now(), updated_at = now(), updated_by = auth.uid()
  WHERE id = p_credit_note_id RETURNING * INTO v_cn;

  RETURN to_jsonb(v_cn);
END;
$$;


CREATE OR REPLACE FUNCTION public.post_supplier_crx�t���ee�6|wwwwwwww����
�����*
"�"�qL��3S0���� ��=��x�y�s�k�
�̺w����8qŚ���]^ٜ�[�\�6|��
�ښ��w����h���XY�ph*o��.��[]\��X[t謮��������o��П�
ۘ_��]ߜ
+[ݚX��L
[�ݜ^Zu(���r���l*�v��\�E)[���s��-����Y����u��O��kD�r����3�� ����������&�O
v���+��y�,�jD�����������)��*��)�t��w���Q���W��~��(4�a�=E��������:K�/'(([��\XҠ	����o]P�|�o���q��r��e/M��пL��$YJ��=�;V�זV�˘7�)A���S?�)�����_����[Q/J:T>��Ւ��X�����r��+��/c�� ������\�{-;"��_ڕ���vަ������0S���2�إ�Η��-�ѐ�_��qj�Ŷ�Z�
�w��$�Cx�7qo��CuZ�����u���Q�9��6�m��Ռ���z-9E�������4��eE1��N��}t:?���`�#Ά�8�)d*g=�A��4�m4��_ֿU�@�2�{��\3B���u��[}$�A]!�Ny���v�	C�
]�F��H|3�*�ĸ�dB���Nz��������kH�H�f-�re��1�e�b�¹l�b{�	���|�[:,��H"�ѫ޳���C�u����0�6���c9��3F��V�ݞ�=�.� .U����
(5�SUZ�`ؐ�EC$�»ijg3��i ����j�y�[4H�
֩*�h^Y�|;�S�L=����#����E�,Avbފ8�?ٹU�_;�˘�6�ք���*k���l�h���ա��B�b��B��˸�ڥ'������}wuW�O����IFOQN�3���qa �*�3jd<OO�ǀ)K�R�p
(�h
ԶP>ϟR�j�-��v<�/VG���&�JB�L8�S�S��񱦼�}M=�o��4���k��w:{�����h֯'�����f�ks������+A�2 m�t�\銞���_}!�K2��7����`cE�'�Q�1�R��]�#�^����⡶�]��{���J�o�_&-�5h9���21:�	���{ο
M��)n�s�q7'����x�Y�S�������Qi��0ㆦ�x/A��W!}����R��+
$.)"�y�i�T���V�^C��N:K]Ջ��OW�v��w���7���}�wt
������R�ɲh@�aH��c���|G�3���Q�q�1�Gԏ#�ch:id���������~92.��"CG�W�϶(���,Wpl�,�1��P0ϊ@�a�#~m�
���E�큗45{���؇Z��k��9L6-F��9�l;$�m��w�?H+�,�&ǆ&�������Ҿ�`�N`���h"N7�I[o��OwW]���g
^��Voڛ��h��c�y��|����Z��пt�zF���zʐ��C��=E�_�����J����/����A��_�qm̀<H�Q�Ek�d�QF,D�(��sA��O��x�x���P�*ʐD��s �ܙ3n��s�۹N�p�,��y.�4�x�������)�f��[����� ��)�g���=����,�����j�|�N:�ae�r�jqn���5d�,� :�}�1/cCR��Ɓ��oג��AK���*7�����V�t��Z>��݇��M^+���#��{�������Q�N�W9�d�V��C*���vQ��~FyO�L����R�8
��M]Ysg���D/eYC"zZ����Z���	T2Z�s�B�`]�~�et��7Zd���TY�Kϐ�~(���`�d���[ѨjZ
o�α��0��cM���B8�HʭG�Pg�Pp�Y9�u��"ъ�&��@��R��P+t���	#v�Ŝn�#�yߋ+�j(
�`$��E߼w=�z��~��fAP�r����u��>E�ґ������˕3!W�����`P�~�4���
��f��5T����y�&=��X��B���ha�8��U�3z�E�U֘�<ԧ���i{7�-92&Sz��7PƩi&�צ]��:���3ԫg�78@��s���t]���KgY��]\m�_�����0�m�:�i��'
룯� C��,���UK��}@�B�q�n��o.��2t�L��Gk��%�/`�'a>f��c� 3S4�#���򒋏6�:�Б�Sԍ���u�R���B�$�HQ��C_���+/('�W��?��ot�\GZ�����0�#h���^�V��W��}����E�+�ė��@qc�����/�-����-P�q5�v@���e�a�(�%.�b_�qm�y~`�=s�_O��.�_�q��G<�)��c���zBvA �zId/Z��l��8(�F��G� ���R
5*���o����t)_�(Y��6����Oԗ�ﶽ���b��FnI�>YP�T����.㺠ypz���	����J�=�D�_���z7�P�z��-�'�&�:�|��9j|q6��?�v�!�:��� ǁQn�W2��d.ۗ��`$��$`}ano�F:��h�n�( �jg �,J0��t i�D6$��T�X ��@������Kկ���ނ�ic��?�~�ȒM�3����	M�F�;��]?��9��|��0�25π�\9H�rD���P�y�K�;�Nn�.�� #��Q�G���+�R����!2v�������W�Hp���t�d��K֩�b\��bT�#k���k��H-������쵛R��C�pa��?m��O�-� 9�_�i ��9��
_E28ݛ!u�	Ò�.#�	G��(��g���e��S���,����j�.!!��t/۝���/���r5CH\u�E�@9����t
�C�Gb�����ag��Tl���A�}����ҏ!dN�y���߷�$R����6�z�a��2�b�nף�{O�+�8��WZ42l�_�Nv�����s�'� ���5e��TP5q�l̏�{��p�~B���c.7/�0!��@,����K�%��"D!ja�A�b㾏B���Rs"(-	��%�� >E2�͝�܀�N3�6c��uƥ[9�ep�);Q4q ��AJ_V�TH��)^5'�	���׌;�Dxk"́#�1F���s�~�����a�r.$D���+j�b�u
��X�2&C�x�j�W��v�y��<���������<�?����/��I��n�|S�b,:�xҧI�>�2�h3 p��t@V7A�?ya@�v�A��Elr})��^�jG�Qk�%���\�����+Z\��c9v ��
�Nq����p��{ ��e�f�쭗�{�p�A�!�T����?�p�N�8He��6�Q�?�����ʶ����=�
�j��ƃ�{r<�<�� �WK��J��ScC�ꀍ��� P-Xg,�:5�h�-���9;��g��X���_��oA���r
��:4���y~��.�=�b>�s�z0znՐ5Oly��+Գ�ʏ�����ߢ�F�)E	�L�z�q�ƛ�E8��S��0����⿾�[��}y��/��!�b�+��	�A�\�CAw�g������Ԯ���dK$6���)�Pƥ��u�2i9/E)�,��[pP�L�u3�v���$�� X���oՏ-9��o��ٯ��D�w4��(��T��
3MP4:KA2�};.D	��y�>�0�Q�]O��P�6��Z�q2�r�xy�XW��� ����x�I�:c݃�Cc۩z�吨����I:�}l{ȝ
��0��k�0�0z�K�P/x^�n��q9i�'N�WZ�r�g,k��r-!�۸t�lq7͊��uMz��g�;�_�p�X�΁������^x�8}���ߩ�~���N<2.�bcv��H��B2
�o]��z݈+X���`�f]C��sF�l m!��5�_�if�P"�
:-GH<�� �zk�|:%_�J9LVS�Q�!Ajp�����R�6f��^Ѷm����ܯS<�j`��+��@&i�|�)����4V���3/�zd6���l�<:=�(yJ��&��v�Q���9Hx����@�s���*�Ï��Ŏy{��~����w^����|}���Qn9����qKV2�1�����֛0�((����zXڑ�<xR���\���������2(�d��#ʇܕ�����)(2ǡ��|�z�$�<G�A^��iX�l�jZ��{��*��?�b4H���菅\��v"
MԀ
�H�!^t��������<8��C`������^?�S'��\�m� s��7� ��WK�_e�Tu��TH)�+��Ρ�:��QF�jy{��x��(h�k�3�,�u��!�v�*�o���eK��K���:�j�4M^g��w5L��g�,��=���y����X@~-T�u.~��l'Ɩ���XJ�G�T����lǒ��d�0mɉ5��'b�D���n�wjJ̃g~e����C���K�G����@�4!����Q3�A=�=�|��g�Ӽf��=i#䷺���Vy�T�����@j\�!6��+pfD"��_=�a#��)���TX@x̾6M'hAR 
Sj�f�Dt^��-�`B
��Lp(sЩЪSd�Q�y�� q;���VxJ�з�ޔ
ҩ�';��_ޯ| JT�v�w�?�4������q	���}���R ������M�N��� 9�����k��%>y����Oͥ	0�=M�]w�(k��H2����������HB	�G�6�������yX�Q������F���%Kz�� ��l�C�A%�2�b�NJ��;���5)���>	��m-�=�I\�r�9�%��1��Z�'K��S��rRI:�� ��b�Q�ƾQLa�Wq�?���Y?�c���cp�.}�I�~�yD�U�cl� !�(�':�Tg<]��ۮa}:��N�?ډi�Wv� ĳo�v��+�1��f�P�<M�'}Gp(0d�'��A��d�X-Uyg���q���[���_����!��8
�O�!O�[�  �]@"�+��p��inn��D��2�.�\�HST֮3&�'G�l�������ZwA�J>��e������ct�/�y�s��� ����U���9j�+d!��传�����l {n"H�����߁g	�A��|N��3Pt.[.h��m�')Gb��O�8�΋2����,//^!�P7�k��'@Bd��GG#�� d��Sm�í0$�_v���̙t
�4ؑ���e�ДP�sd�\���D��{Asf�*��������� ^r"�Tz7wK2m&�����=S�q�G�fڏ�7��ts�oA����s��� {.n"��{x��`~W�;oh���8t�D��oP�����2�A�`���W+\s�x'Қ�%�-���@r/+���g0��g��X�:�I�dxR�O@���iJ�m8^=#��)L��9��:WӬS�p͇[�y���'������-��޼�<�$�@�`G�
=�
���dޱP�L�*狿Cc[!����'@����
�m_ctO�e�^ve�!�~�w34� ��2�I�
4\�D����M����A�dpm��Þ�0��1	�]�e�����*�!Iq�'��F$A��lt7�I���.��o?���vѩNfDSZ���Jʉ�j\��ɭ�c1{P��MEg��e�?}�eW�D#8������8�cJ!
��Y(�B�@&���
�r8��/�L|3��LBm�կ���Bmw,�d0U{�T��CQ�&�
����B��B�5�U{k)�Dq�z���O�R���q�0	f2XοP8�1�+���Y��z)J��~�|�\y�
@��D��LN���Af+ ��`�D?��@n(ʸ�(�ո~��-��P� Ӫ�A:���	Ǚ t��3�ax���ɣ7�{�g=�{:�364�!�J�DI4��h�!_V6�,�aM�fԏY��v�
ud<ن>�wp�6e ��]�;	'�O��dF��}���.N4i�$��S�5�Ei � �����Ȁ:4�j�/�s��_HI��(l��F�.�n �)%Е�r.�P��7��i+�[�7_�r��[e:�!�	RA�m�i2� ��c)�f�y�����^�Aft��Cv;2��}(; "�z"�'�j~z*#w��fAF�0F�u-b�;)�2�Qp�/Ud��>��w�pl�"\;�ŦA��Ⱦ1PE���P��ˬ�g��; $i:�f{��)�j�� �k��8f���WY��0K��
�%n
U��`���6�f�ѨɌ?3�鑓�����.�Ύ�x�,p 8���/���Y��n!��!^P ��Ţ>��3�L`J/Q���/�K��r�'�	r�'�A`'>}�)�M�1rĚ�D�	�5��*٬wk�A����'�Ȁ��*�(��a��׍-t��yG�W���mQ���|}f�������r��p���'�UDu�G�ˡY����Hw���o��P(�h�M�� �6K}�2��7��!�ז��_O�u=�f���nܗ�B��|=@غ�Rjt�c�����0a����$i������>� LEa�h���lSG1��T
��K����`�g @h���T2�5P��t���^L��?XՔ�O�%O>xπ�3k踢r�!A��w^��A��R��r�C�F{��I>�$���*����I�59�U`�O��t��/���Dl�� _#�!yK�9F�%�W̺KD%��{������&�UH3	7�F&AL7������;K���-7�	�<)ש�� d���FNe�-OE{�٧�}��VC�XH2�l3іO�ch�JO�(��{Rk�k
Pq�k�h|.�_̀[1�����(�ꝿO�}1�d�li`mE�E�q��:�|�AIF���9�*�P���f�q��I�w�S���;�4��C
�o�(��%0��-�S�0�4#�g� ��i�$@��n+'z�r��D��g_�f~d�Z��|��q错A����f�Lb�Ca"h�bc��T]��i�g�EK��Gb�ڱC��9Yg�8��0��8g
pX��}�5��ޒ�t���r���>n�"U�V��~�"E�a�t�¼$T�&�d�Yl�v%��"�r`L'W���Px��4�B?�a�R�g)�_�]��?&(`��&/�}�q�e��Q��l��I���
�)���l1���1� R��6�i���
�%4X=�I��@�e|�u��P�����AC?t�_|��g�3����O�*$�Z�3�T�yD����M��˵���,Z~��
����1�b	m�
�/�L����Z��� �	J�ā��h��U(� ~�r`8����[7��0����o��+5�S9PBg�����^�
��7�۽$Ӵ�N�G��:-��3�����x�ډ���_���eX�M�O�J�G<���?�o�ˎ�k��m�c���{h�T0�,�����
���):�Y�o��R +��f�Ef�w}J���2{a9����6�����&GhУmk�&��e�̑b��0�+�G�����?�x��_)jK�E��M0.��g����%f�O��i6�C���W^4]嫙��I+C:�+#�@�� ��ԣ�L��d�A�:�:dǼ�؁d�+i�wWNS4"��a2�'��������qSC���U3t?�A��Ͼ��n_�����1��}�e_,��JuyW�qY����:D�/�;pu#�XB#��� ̃�+�#��{�X3\�Tڷa����EJ�gQD׊%�kО� N�%^�;����p�/�A=�,:uf<L��񩜸�y0]��
̝,��@t�͸`:�)1b֭_�̠Gm� K䵙͙A
��� *���/s�@"Ŏ�C!��Exs0��W�`.!���ë��7�3�+�S'�T�A�[A�p�yarX�$�cj��u_���}ja�ޡ�N��Tμ�ݓ���ș��,5�\ �4z��Z��`6�5�3p@��
� ���X��T*]�~I�-蘘v �CN�S@���5.(��;x��i��H�zYt0{����	=%O{�����%:��Hv��a}�h����m�Z���?'��� �L >�MI�I?�4gJ�ew
���M'< ��9,������:�4�FSVs�8�U�o�*
,�t�����A���P�ָAΈ��.��D�/��t[�Y{�_g�
�rU$gY3e	�KD*���'?מ]��
2�y9cߟ�hZyI.��r'[�'�jm�$̽#{��9w�{��hO��i�^���
�ܙ���!9�q��X��V����@�F8�V������g��\����e`�p���ӱ��������u���Q9Q����r�"���wj�/��e���Ƀ�AH8�i{��٥K61�� .��zO@-9���Y6�s�1�S�
]�n݀:��.~ǘf��ݧ��O���Z$�
Z�b�&��n}y�}��e�~�D�֢E0 T�]�M;�hfx���� ��;������FH��(ENtu\�w���V�'�>�~�tN���m�C���0�AFV@�V�}��z�`8�p� 4���`'5)z�(�yI��fg9�;��d�����vnA	��>I!8F�,�����e	��2"=_�!������y��^͸1P=ݫD�� m��a��,���W�d����� ��O�74B@��J� {�.��b��[�419���������Ԗ��C&�. �_��	�41	��tyǄ�e ��_B+�u���*_��Z\1,n9h#�=<��J&��^��D%� e;�ʜN�JC�
;L�6���}'&���a�%��F3�����թR�
+���a���x�[uư�?N����@ ��G�Ū�k�w��{ԙ@
Yȓ�Q�`����k�' �)�Q*ӑ��D�����|3L�8��n�:�F��S��5�  �T�R��2���=ʩn�{O�
M(�Q�t�W�2D4}6��s�?�[24��*r����\�!g݀Ւ����9N�n����O6���}py����S �&��-��hv�1Z�9��v�Ib[�]�Iᕁ�X���/8l�.���\J�U�K�0W�1���� ��N�L1��;N' ��v
�LNI?^w�X�F@!��&2�!M���V����B.��T�X'��.�5{�0��3������`�ݰ��H����!B����q�
۰�l�̦Mk茵�$��ӿ�d2��gL^
� �.��Hy�&����أE`����~������x���V��X2`�Ҍ}M?�&̀I��S��m�邍&��t1�ȸ(/5.�,>5�`��`*!I�o���3����>@�˚�����	�U3)�	c�Bps�)pq��,����C���Sޖ7�?�|��w�W�?��Ng<u��*�J3�!�M�+��N.Vv"=3c��@L�ݺ6�B�:1[��_fQB���n������Г�#[ y	a�t#
�E�e��\��<L�h�����
,Q���
x�+-b^Dt��	����תi/���#�тsd[��<!z>��pZ��`�����:��G��`D���,��r�}(�i��IN��1z��O�Z4J�

�-] ��p/*?m�7Z��ɡnԴ(��S1d5C3���B��l��G{�+Ho�"_��S�č�{p��}�h��<H�Q5<�.avV�i���#�4�peB���,z�:�w��-8�����2��"S^I��#�pu�K�m X9��2�2��:oI�Qh���:��58 �� ��d s6-�F #ma���8���-v��)ʭɌ�m�K���9�/Z������VO������Sq��I�icA����3,��������s� 8��"GS

�s��fQ�J�4��A��s\����5.��¾��?de4$�?���c� 8I�UQ���С�ɽ�T�+�T�j=,?�,����q��|��I����B�qQb��,ʚ6cL�\K����r_"$����"��ցP�����wGk�`H2��L�:��y����1l�c�^'���}?6����i��$���
r�DH�)b�o?(]�pc���JZ#�Q`��5�Ħf벏t����\�c�z>��kW�l_�]��ۂ�� ��u�d���D�-eFΧ���H���C�γP2;�q�g���ڋ��f�V���)
�rvo�5���zSV���G��)2l�u���w�&�"3���~�اG�R��@�d�����Ň0�n_H��+g
3��0�
�����k��eN	B�6A'@՝W�.�W�DчH

��с����<p#+����4�qg�"���b���c����@�
�-��e�R��u0s��g$i4����n�ʗM
��`��Mذ���{�f�x_�O�l'=���<�����u�i��'�C1��|4��8
��61�t��f�����M��M������=L�2��dX�s�=� �M֍¶��?�)x6��7P��쓣Gp#���C� ��xD�P�[�3n�omK��]|n���q�Q�r0d&�!〮NI5����՞�ԝ�r�)�3125�WXR:�|��
ZA��Q�q]����S�I�T�*ȇ��Y�=�����Фu� ���,W�2r����� ��qR
!�2x�:%���c���&��=f�(�`��h���D���Pu�_�Z�艈��K �� i�/��pA6+2q'����ɬg�X��?N�
��@���k1o(a�ȶa��fp_���'��`A&O�i��S��͸�!"�C8�h/���F��t�qy?�����TRs���Sv�p�����a�XH�c�;:q��w߰Ib$�@����������O�F�G�@�3|b�m�|[��P-(	�ǒ�TU�&B5S��r�J1�k
nKT:%�A_�Z��)���I-V�m�M�?쎄 ȭ���S�&}�K��ȶ!GN6fD���˰�T�P	�dp��E�&B`)���.�9˶������:�����`���m��y��ʁN����9����t�tP����~+s� ���I��Dֳ?��Il�,���
Aq�^�� ���
�jN��d�Jf�x�Ah$V�����f���G��#yFNDJ̅�
�.�{'��4M�Dqa�J�=��ި�&��}��6!2H��)<u�p�������A-��R�yG<�lV�%_�?P�W���p�+^s[F�z43����9x'~h���G��=AbKh�Q����(�3������=C���u�_bn&S�G���>r����������Bк�2+9��L�Ք!�@��Q`ɇO��#�o�f�<�;ZD�J��#��e.!j�0��� �4���Nu�+��b����+����s�ߐ�ө�?����@7i���7��
�A�ɦ�}���i�>��&m�/ˌ� o�N���?B��@;8t��iN�?�Ҭ[�e��Ez��~�(�Yp
6wh�
:/e�wew���ܹ�&����ٝ�5��xO�-�1�DF	�)&>�>i�q�t7�`C�
C�A�w�Bh�8��{8�|Q.idl�� a��"��p�-MS�Ĭ�G]�x�u��Dip�!����uZJ3j�����[�T��2e jj5��[n�������ے�����<�� ~�/	�۟^�@V��,&��]s�oA��4�Kp��� Z���JoD�X�4�?=�+TkW�~�,E�T�?�;�-��	Ӓ ��K�dV����P��s,� �y&���u������
���P�M �)�MPv`����<j'��#�����"��!c��4�l?�.flA�̈́q����ɪ�F�?�����0������/ޣܞ��K��S?1���s����4\\����-w�q���?�n��X�5+����ż		�[1�w^��80��t��ߏ��J86�������)EO��8���֩�FDm(�E�Jz�4[ �~i�fӡ��3m�������v#'�,[�����b�+J��`8K����6�Qꌯ֩IB��sx$��V�zb�x�/n�].]�^�O�"��	��Ԕ�� >ud\V��r�P�һa�	r��$�G':i�@ƞ�)h1+K
W��M9ҦH�`������ܥ� �;2�~G,m�C��[�Go������)����ػ����.C2�P��f9�H0�p�hR�
s�*��]����LH���gt��y�`nF�eT� �n�����o�ˑ�4�'�T�U!�@!%C�D:�װ��
�`��G/���A�bƦ`f�.�0�?I�r�n�_���.P�4VA�.�7�;�?{�'r��j���@��s"۸����s�]oΆ1�H�+b����X1��A��4J�v�,��������.�TZ�ޘ;���4 ���(oN�s��^l���7̈́[<�6�GF�1㾾4�<����E5��H��[�f���Sf�
iIA���e��S���˰��`�?~�t�t������������װ!� 2`������Wa*�^HWwȝ�A�2|�n9+PE���Ic)	!䑴Ǉ��g�e�o���%���{�s�~�g+�����G�%h��
\\���xV".���}���A(n-on�;������m�Gr��QTt@/E<PBƺ�1v��`
PC�#�S�fn'(��<)Ѥ��b�b<:)��U��M�:m<���9KgȂ�a�m��<��D�F���G�ltr��y@ЀNm�(��B����7���šD�M��2Oq��-���D��ì��$�v��B�n8���*B���u�0�(�SG���9�
d���X�t�~�wN:X�����t[�4U��t�K+���,�#HS����4�bW0[ͬPާ7�c	�'�VN4��*0���M��^��lk��L���y����X����
�#�\VUߩ?�hV@>(*ʂ�A^�v������Xb�h�Qs4�h�`�{4^#�M��e77�[�X%'����HA����n�����:��XIǏ( :���|���U��2N�6C����w����fs7�d�Ig��:��h�X�����qݠt�-�\Ytk_�6--����Z�����$�����G���S[v!m�i;'i�U��qL#�	��>t�"�@����\��FC[Qٙ߫�E)�;im|8 fzNe��P#l�=�&�����5�'����Y����hl�[%���Gi] ����\�:���r��6���o@�~H� �-�����Z�����O�� ���4�=�33�2�DH�� �}Qib�ݨ3��טb:���]�N����ɟ�*|�K�3iJ��p�Í�P���V1z��0���:k��᫦��*Vޤ�?}��\�>�hVf,��r�\6.'*P�*���"?~\=���Y���*�I?&02T[����bE�M��H܅� �<�7�z�Ww��(��/ԏ���8y�%c��d����A`��ޚ �]I&(!��֟���G�IS�M=4#d"��j���s��q��E[ ���>�
��Ѧ�kO�Q^b��1��M!��?��q3�R�U��mvә�4���|y6c ���`�&���,��t����r���էh̩��W���1����&xL6l
�R��>nzW�ž��$R�I
�q�1�I�mD$�\aܲ�yT����Y��n����G
��aM��T6�^�.��
���$K�8��h��9 f�w���9�	��ifuj���ԉͲz99�rO�^a�E���1�J�x��fp0 p�l���V�9�ĢS��2;b�oP(��1�1�f}�I���
�F��L�):�P�&��Zw`�kن��|+*�����.��^D��F&���W�ܝ*���Q�q��>�B<�ij��z�LToifD�=\!xE��g���W��|Xݙ6��nٗdV�S;�E���~�a�����F!��| C"�[��O�Z�3�i,5��.����fuIa���O�F�]>{��u�]+z]V�ع��\�`6u�r 
rx�)ɋ���<�b����:���jW�'4N�r�M�B���"�AUز�~O�
ޠA�h�i���s1s$���?z	�j�^Ȕ��+�|���&��{�o*ΰ�Y���Q���LQHE�;Ulܜ�
S
�������4���U�β�6��N���X����	^ 	ҡ��)�]p!��@m�rHf����7V��t1*3f�G,8�w������v�o#=� ���Rop���kT7TY��'��C-�x�������u��#j.|��JdI"ֆ��Åܝv�p��
0d�Qj7|���qC_E���ͱ�6�Е ��`�n+g��Ic��}=���w5K3(�.��`�Wg<g�!���Lj���M�Րw��1����SEj�DK�<۰�]l|$�M��Of�%�� eGlj�f6'��Y8���٧�E4;5?\�F��]�[X
G��U	�U{��Cp��uC$�?�g�'��!��X�Z�sn �k�sU�����.�y�Qө�:%��X��6�!!�e���{�*�x�!�%���ɲ�l�e��/���N������	9M����� 4-����SM���y�F�vBqV<?C'#�#�U�|���,= P�z��7�^���A�$����ߞ��׿���8���}r����a0��O��f� ��hJ<�^�7�r�{~����Hp��Qذ��ph���h���D�uV=��� ��4���4��Pk�;
�	d�������y~-
�؅`{�0"�Sޙ_���f�9Ȃ�y��p�de�Z���_�ҸIK�I�_5��;���<�
�D³�x�i��
��tf�)gXM������l�f����fn�f���*(6��M�~ţ~S>�]�r�H�w񕕏�п���.S�]\}Ģ���w^��~�	�1B��\H&�lP���Y��Ajj%���Ѥ�1���g�ŧ��W�&(X��gPT۪�������F�6�~	EsOp5l|��<�{3h�z��+,Hm�Ծ42zV#2ʕbD��꾨'�PV�#٘h�4{n ��
��╛����Zt�	��a���Т���iD,;P�9(��8"/T�@���t�g����Z
Ie}g_��9��h����j�<�����Q��f��]"A��T�@,�ap����}�m���N�S�7Ĳ\I��~�!'��!���ӡ"BPDƥ?J���7G+p�	{
b��twR.�iMy�PX � V�'��n�(���d�N��e`��O[A�S�c�������d���\��x�B�*���鄯���a�,�듘�6����G'AŖ��|>�P
pn�jbB��������Ě��^kZ8H4]l�MF-��@S��C��dTWK��1�P�u�f�CNV9�;�������Q�32ܻ�&@$P3El-�&��%:��$����\��u���kt85V��sZ��� ��Q҇|��^�5�^��S�Q'�!_�H����L�0�����Z����]��oU |MQ��xb�u0{;I�f9HXq�Q?~�*��4<�Rc5���~�Y�V���35����SB!�y�Uj�#�VŸrKg��
�Fӕ��P���+���e�|�\�>�;#��h���Җd�=-��!S�
#��Z�8��dY%�t�����&s�uh�*!��As-!>��m
+g�T�ٟ��$�Έ\}h�TA3I�5�9���R.��{~ �<�ݧ��V�I���<o�r��q' ���Q,��h�
�A2�����k`��1��f�X닄<ź����\�s�Y(�X����ǘ�<ܠ�2����դ�j(0":���7tժb��˶���YL�ǧE�:��K+l�Ī!M����1�:�EM�1�r��u���_�1M#��&6ȅ$�r�N̠�gEa��ug��c�N�h�4>-������@2Y����5z�M��Dt�Ѕ����ä.�k�_~�ф��ۯǒ
~-������̹��S��Rp�ڡd��>xȿg�2�Jg�X��Xp"U��d?ng
����W��ʔIND��ed��q�.���>�ô)��b�)��MbɊ��P��6^��P�Xg<���=�v�{?_ � ��X���_[!�����{?w_��m��+���Li�!zr�h']����G60:��L��\4�~��Z�
��̌����(h��/?��GY;��#�/:�*f�
�8
��d�. �_x������֫�<���r/w񴝐���4&"@a��s��N�a().�&z%I��>f�3�j� �t�˛��`>��;(��g�4��Kߞ�pU3�Kl���o?%�0�3��}�/ �̇�TV��F0+s}"R3Q2#!7�sq�P7���H�$D�t�D�P���Ug�Mͬ��ms_��ƫn �8�#��3-b���IJ��xh��
z�����~�;r�w������!��?�K)�b>�I/��2�z��^2�9�SH(&<@�ϼ�a$7V��-�ʛ8j�j<Є���pA��
��$�CZ�u�?��zu�yᚪ��o<����e�����&�>���׾���sG��,�N��H���Q�83PaV���9l�2�D[m�T^b�S9]"%�a�V�H�t����z!�Ь�,ڌ�b2���?d�W�-� UD-�^�χ�t�M'���H�p���b3�����z�p��wAW�J�t�6�5G!r����SӬȹ/���ekLN�H�[fy���L.E����5��M��h��#�}2�>[-rg���ZC�H�I-/_:ҩ�s r'�����O
A�Rh����c��}��_̡�
HL�rn%$�
�Y���3�Z��� %Դ��/uQ�a�F� p���Ǳ*�b�������3�ľ3v-�����뱃p�Ь��]������p+�{��"������=�L̍
�4�%�8-%K� �n��#��G�P^Y���"��S�q�ďT)��0����X�Yp����T�KX���u�#�+�����M~�٤�O�x��N��P�`
���/k��:-��FL�u�3�e�
8 �LC�"N�o��6wڑ�IsSSdT�X�[�Hk\/�B�	R�ǬB̍/�̼
����xwɎ��C����%�a!�@��98�Uy�(��}�`�;��=P�0ht�rǎ(�;�G���Y?5d4_@�UZc�����X�{�ae���&�\�6�Lθ�0Ӹ\	�M FB8�	��f�y�(O���	1@��L�7��W�X�u�9�����ʄ���y����g O��Jj5#U�!6��#�i!�������Y��F��x�y�5�[�~	�N��&=:U����̘w������]rZa�Z��g?y��B����G8t���V������kV+����rH�xd�I������G�-JrXU���K�E�˂uH&��ϗKmc�pY�)�a4��A����d3�@(�傣��S��K߇��=��ֳ��<2���]��Bվm�KI�h5G�B)Y6���˨�:u�	�B��=bΰ%^
0#JR�NZ����� �w�Y k��f+�;fI��}hP��q��kPfy ����G�D��qX�� �{�����C�>-E��2�����Y�����^\���c-�p�P�� ì�����`ˎ��/��ٓč"ӽ��2�O��;�t�5)~��J���F~���-O�O)C]���ts�� p�*4��>x����J�B(���/+�Ć	Ұ�0�����
@H^$tz���&��{�L���L��,�ăT�2�{m�@�ξ��8���*G�̖�&&���i��;��s�뽟��M�'�Q�UM���;X]!����m�^/L�]P�4.�t�eG�,�d7܀��M����G~�|Kda���}Fh0
O�N'V�Y�36p�!�"�[P �鹊���i�h� 3:���	3:.�G�_�,v�{�����~J���9,}k�ݦ����M
!�F���Q-�ɧ���HDg���ڪłN�1��_`D��_��N��� �+H�o����4@p�8�� �a[�'Itm˺��Z�v�kf�,N��ɣ�̀��P���}ÔE%��9.뚫x��g�b>I'�V�#/?o�#�ͮ���N�UL M����T^����Ӝ���p]C[	LdF����Y��_�(ҩI��n܇F���\�&�o��m��S6a0��Xx �e!�4�} Q��@�2d6z�\� ���`"<����<����D9��v3YL�ӂ��An۠iD�5���>/�S�a��c�k������-](q�
�j���q���Ho(�g�f�"p��	%�m��6]{M���~Kph37}�4���+5E�X��Y��]���{7i�'M�X�虫�
O�&)ߙ 0���H����i�u�O��)�)f}TB�^Ѓ��
yOQ��:.�J�����X�fx|�@��;1�0����|$�t��^3����OÈj����E9c��{����ٿ��|9I�c^06γpJ}��^NLl�T��~��nX���@���i��ȊX�
֙L6�)>uG�H�O���	�1��3�~d �I�N*��M u۪v����J����v�1�;>|�O�d5���Ȳ��M-
�phimذLyC�kK�lr�s�t&��ǜc��^��ያ�r��0 ���bߚMǜ2�k?�*v��� ����{�%��ۜEC�)[���v\|Q���=h����@�2��l�c/��:%����e��¬@�R��1����c�4�~V�~ FU0:�����zi�� �O����'� }�Tݱ��~�ـc���ن�8S\�G;��Y�3�����@�jN��,��Y��!����l%ƽr|,1{N��o�"{c��a�21G���v�Aj��¦
�ML]W��b��͏�����&�r^2��UyO���1t8A܁ Ŗ��`hъ��W&�Y=�q�?|]2F��1Y��ǱX�J���o���cD���Tk�����:9���t��9A�ށ�(vE��
3"sV����|@�Tp�PX��=�o2������@�u������3�7�>`'������ʄ���Q{4�N�{��)�I4���cR0�r\��fX�P��!��l�ҡ�V�y��8��3�@�&�E�����Q�R ɞA�a�?�߁Q [�6ށ��B����X$��7�q,Rr�V�v�ξ*����z ���n<Y��u��i�N^��#����FT�)C�Z#��[���9Y�`4�1B"�NkV	D�@�)S��o?U\
��6��!��ӝ{���X
	��7��ɍŭ'�M�Ǻh�U�e	��V�
����md��{nv���gʉ�x �DR�*h:�m���ߣ%bN��d��^V��\s���C �����F���xCT��D@z̖F��)��l���[�/�#���)��C��`�sc�w�X:��ka6��`��y��J:���g���0 )�P	X��B3���!̉0�2R: fԛ��u��a�)�q�����՗�ǤL%�He7�<gڄf����������3�@��S�}�
�6=�Y�G*���l���G�n�v�nC;��d�9j\��-���g�_N���0Ijx�C�0[�jx �N���3�I�A-�t��N�պ�%�P��@*���q�Uӹ0�,���"���NS,�t��y�rA�<ݦq����9z�4C�&e��iT���#O�8���9 ��$_Wh�_�JX4�}�j��HBW7�7k=�Uw�z/-ĩc��2�@џ��f;�g6��������'J�Wҷ>�
�陃���|�w��O_����&���\8�p�_!������;����g�+�;��Nuż)�C��H��B�V�enT��L����<_�
1v;�S&�[M�,��BC�?�i�=h��J���:���ۼa�,�̍	��A�P���jf�L�L��@/#gKӐڍ��Ba���c��V�
fhB����1�'(���Qu�yIy���a~.<X�,�j�X�^8?� �:�;?����FV��\�����=�+��2k�L�F� �_�k���/0�0�d���Ɣ��?�_�#Y����y�pî�
Zk�������v �n�&���,�[ݽ���I `�L��@'߹/J����#2	\��A�`m���3/����e��1�b�>����4�2�^��q�QU�h�lk��
��%���7��3���3�L��/�}]����@?��G){l��D�6�m2�7�W��G�g�ȯ }��ѐX���������^N��N�?�?ĮCY��`A$��C������>����� ��5
솜�$�M�m�V�z�e�\+@U���㿞���y�HP4�P[�@�z]}Q��D6���@�͐)�
<��k��+`�H�8�&]͞��:D�>���+o����~u����Đ��/Z\#6�\�۩�]�@F��o��\QP/��}�2H�~��
<�_�����#͕�(�������QM�K_
�"�7���&��/L����3A���/9?N(+8����Eб}����
���
b�)jHʔ����Do~�(G���a��TSvJ�a�x�*���)-2�����3hS� Xh���-�����/ȟc7��R�Ї��?LZ2�;&���
�M��a������chv�������:%�(��Y��?�#�Y o�)6LR
j��!�z���z�pmXG�yҁ<ҭ4���}��fwI�IX��/Jc�	|��sK@�2̧���ՃB�r0=NVA�2s���j��=L���_�j�Vz䁆⮆�6� (�TKk����Q���[��g���3A�+U��<����c^��oZvsA��Ct_���'�����koR�|!�Y��-���ٽ{���� �	=�h� �
Ҷ����)G�m����ժ�q��JFj�q_Z4F^�����,[}���� �T�'����Ol!�'b'�۠nbe1�n]����!n�y����M�{U��5+%cs}n�k1�D.4	��k��a ���w�?xH_�՚(��翞}��(�Fd���wc@5���(�+i�_t,��@4,���`q���a:��5ÓH�sj�Yױ�<�Ȓ���/�u�[=��F�T���?���2s�C����V�~(صǯ�|���^[9=����eF�5�;�h�x
��9�
4b]|��*oz�e�6�	���������A�n!�0�)U�}���`�p�{�3�|�p&$�� s(-�ࡋe�:%���	+U+�Ҍ���{�)k�J=�M��A>8^$'��ʹ���
S�N@z[+�Cv"��f9��Sp�o�����y���R���7]cè2�����d<I��]���X@�E��YW R��G��R6�RS�V��rP��
�;�K�ʆCp5���:!���|o��6�}�u+��1[�h���̱5]Ŵ���{�\�z��q!�`�\�Hr�V�o�)�$8�#G�;���>�	̱iV��1d�[�>o:�~6]
A�'��9I:E�-6�MS7|��|�����tʥr�-��'*����B�n��^��6���Tv�4��{D��9@03�C'o}����2���J`m�ez�a!���C`a���'�	����:X�"��xE�G4n
J�P�\ q��8�˫cP�at�D���%��J����a{�e��1ϰ�8�|ys�@��]k��\<zm�ڢ�U!i �n�'4�0[-�-=�#2�x�'�:ML�9����m�3I��l�� A��)�tʜ�a)e
�C�c44;�5���~L|Df�M,�өɐ89>��Ji�Bj�3�+��
ǄЖ��vS����~���?��n� ��-fX�Y͂��'�
Ĵ��'J]�p*�`
�%At�bM��@�B@��/A��)� �������~^Z)X�(� �W�N1Ʌ���X�2񅸣���W�!�T/�D��<��lt˼�@�o^��9�M L�
|���kO(^��q9�p����9�чXΪ������y
�| �e%�x��d�@�+HUn��e�U�D�o_�ib��5+�Bz�;���% n|ŝY��K2]�pL��v�g�]��5ɮ�؏0��F���퓝Qcb�"�o
����P���S v��,1��7�"�?��+b� ��Q�'��i)$ޭkc���gA
�D��G`�jz�sc�����5�)������L*A,Ńa박@P͢���*͂۽s/A{FiRrP��P��!����:u�\�����?�����Vu��<|�N\#ѓ���4.��W0���
��j�K��NP��t*2N�pC\�# ��J��B���d��@L���DD�Z��̡I�]o�QϤY�&��������*F���v�A������.4Ƕ��Z�Ο�����N:̖D�c�����|N��ťoݧSC�\2��X�;&��������.�~�4��i�3�׏ĵ�.`�T{�f��r�W3�
�&
A]q	�`2q�������H��w�����#��#����Q�Z�?)wW3�~�GG<u����b����޾_����% ��@:P6����Xcv�sF鐬o��L_�@�7���z�˿������Hxq�@�r�����MPЗ��?N�#n�rv���������_�C�G9r�G�?���4�d�|1��Ufg�v�N���Q9��y@I8"GwC8\
�X�7X�YJ�� ��
4<7�݇���)����_mJ\O��}�����0<�b rU����#a��4�>)5��x+P�	({Pιi.�2lz�?-����%�����-d^����_ n�<�,j��e&�L�x�h0F9|�3v��μ@��Щ��c��46���#rG@�KH�ǂ׌��H�Nb0��ԢO�{w����P� !����&ȾF�t���"D�t�O�'O=���=>F2�/I�>��?8�m�,�9��O����g�ȋ^K��l��ۥ���}e������"��=�����q3	U���nz��&ƒa8l���uo@ d��.@�d`�?�Jʁ>��Ѡg4˝:���rE�'R��Z1���}��c/WV#�sb- *$�r�4fG�o6��& &���k���Vl�eѸE�x�޺�j5�i�����tʣ�qr���v�
�Q�\��u�aW1����'��"�4���d?��S%}q�]��R��pq؜r[����t���#���P�E�gw���vb�K��C=�!1�!�=��-��0��<���.9{��u�����)H.x���Nz4>u>�x��?�ŷ�`V�C/s��w�;?�L�Lܳżk�v04��(J3�b�<A� �u��j�#�bPi:� ��Hj�~f,"m��ͽr
����g{uƏ: 2�/���2����h��Ń��{_���u�)˒ʗl˷��X2�E�D��!)� �%K�@�IB�%<dɞ��9��;S5�l2��ff�&ٝ�Iv'�n�&�8�8v���:N욭��;���>��ݯ��
4@H�,�(����������}�E��$r㿢��5�������Xך*��d�����n��롹��RK1�H�xB6�"MkSާ$ısn
�q���:t��VN��NL�J~'�"�;����F�@m��͒nȏHDޠwݳ���y\$iC;��M��ٴw$%�èݽ����~� ���6,��(���p���e������Kn0����۽�0�qx#Yn��Q;f,C��叾��'�iQ]����|H�q�
���))���=p��#cp��n�ú�oe`&��t`���@�'�%���6�}p�t&�M*%��9���I�D���1�'�{����(��|!BǺ�&�&��.�n����O/ZFL�Q�
��\�&�_�'k�Rb�2����~��b<E���#�{�gr��px�:B./o�U���pJ�$ŀ�o��{{�͚���g�}���G1h ����4���I5�A8�Q�����Ƈ�Ͽ|�s����r	�R`r��)=|YO1v��/��&��Γz�&-H(��Qڛ4{װfP�y㓃�G�
������0��%� �T$<L��FY��󔥅$�_Uvsv��q��N�Wz��}O�yT�� ����6k�4�>#鼸��'�����	-��)�p��į����������DD�J�j�W�\]s�a��{�C���o�V�`�7Y���)��W9)ᙐ�D�Q���iѲ��"������p��h�i��g�ο�9@ �W����ڷ�&��S�Z�ǩ'X���u��~��L1Kܹ0M�5 �0b�Uc�������wdިg �RnZ����+�^pL��8�ςo�\�Ћ����Qiw�Nmx~��+ٝ��\
�����Gƣ�6I��Jބ���ѱ��r�M3B����_��A��h������G6j=cn[5>q�˺|���"3!���˳h�>���灈���  2@_�prÐ�۩_z�\<4%oO�g��K�L �w�I�8h��ߕ�|ʺ���C�-M����C�F���c�ʍ�#�}4�C
�`~�@Mӫga���3P�Ҩ�kP����Y�l;m��,�x�Kw�Zx�'ۇ�4JcfԷ����զ\�80Sb�2�&��g-Y������l�B	t0r7XD�|q
�Ƚ�/�7i��B����`�4��	�28p��_~����{%{�
O�YT�Sg���	���?[����yfT,��^b�H�=.&�X����@!����
��U*�"��Xx��7�U�d�P5���?�����ѓ(p[5�u�'����<'��y~j�����~j�g���G����G'��;cٰ���W��g��o>�����,�j�x����mo}��I&1CAXгm!�'O���s�Gx�s�˾�i��'��G��冠=o��o���b#�Eu|R�6�+����# 9��a\��w�@y�-����'A�����K:+����zT���H� ��V)*ß�WA]��c`�Η�=�؝�_�*�z��w;�Y����Pjui�S��}��	��9�o�;��=Ja\)l9y��YbX�V�׃~s�a�/l�i<��w!�IF��8|�G�
��������-'D�:_��ꛪr��p�|���Q�\xHl�*�
S6Abpp�`��Ĺ�N<��O�$�v��4�ן����O�4�	��4Q�>9..K��bJ8�U��Ea��*�T��0�\�yEF"�^����	�;��ҭxw������nyr�d�����dr���F�8����Q��� ���v���"�B��'��E@���G"��b�3&jϠ�^�������ȋ?�s�7ܕ�__�������; a��=QK)�o�s�%P��~y�q�H;���^��Ժ]ڢ�s����Qn�����q�G�L+���kq��`��~��R��]*!�_ `?e��.�B�|�8�B3� D��d:6����^��,��PWQ=��(���+�����C��Ǵ
�E-oya/:4������n��Y�ޞ���wˁ�U���U�	(9�� �h�]3D�q����B�^��;v~��=����y��n�C��yd���y��_�$�y��]b1袞�0)B�R�iI	D��l�>���OZ!��1l��ć_�z�e�a��E��+�	�jV�����;'��d.Iu]/}Õ�k�W�?�ț��$HE���B������s�6XX~^l��\���L�����?�I�}�n�9�y�Mx�#d�����?�����K�[k0�}Q�p���S�`Ń����J��8"/���]%A�L.b�
���{V������϶!�o��n1�y�� ���uP������l������	`{�î���}@�D������
��w���u#��?��rO-����x��]6����0��Qē��w�+�D�}w����#j��%ilNm�u�de��-�G ��}hZ�ܦ�GO�,Z67]4vF��������:��S�BEn}�c/�����(snn�ct�dh$>����A:�u�4��_�4��<#�Ph�'� >��o�M��7WP1k(�|��aX%4��3��:�짺�L�dvV=w�
���	m|eQ���������OhP���7Կg��~�o�1d�Nқ�a!���8�����64�ؖ���
˩i����E��l���%���7C���T%	��[i���֌�4�������.x�ժ+�����'׭F'&Jt����#���e�sT
xL�@DiU"��c=5RD�Kplg���畣?������^�����׬��V�u=��u��Y�jdb�<���_�H��O��ߖ�`ξ�9"���9����'H�)JC�����9��@H5�+�Iw��:�����)͇򾜻�$��eč��bQ.5^;���6n����lb��?�F��IE��/L�n���kQP��<-�eU��2��R������ڞ���O���V�NONM��:���+�����0��$�� �3LP�ty�L� ʇ�?�g]�~HA�(_)]YT]5�g'�x+�8�X"{?��)��m���9S����j�.�a��[߆}�yG�g�Ј�{�$[�TĘ�z���<P���QI9�?�Qu�Un�-�A���4/��L=�{��9?$��{H�86���]g#�_��I8���.��Ip5J�C�[���$r,��/�I��S=ᢞ��׎��w A6O"0��$�(�UK��g�&�CPBve��z	�8���̇�=�ؔxP������y��}ܔt��1o$��_��r
��c�k��B�?�]�.�{/�{,�_���5�ĢqTj3�I�p�i�,N�,A .�4 ���s�a��k`0�6��A�����~�{4�(�$��T<m7�1s������~Ժ��?ES��'rD���4#c�4��:ߦ���P��n�H�!>���h++��q����r	��a�w�< .H4S[�Q�g�zNY��������c�����`�<(k'�}0YH��\���w���Rs��E��Ŷ싪exHf�p�>�@����U���3�,�A8���?��/�F�#�h\|<+�Th{Q��ז:��ւ&���1:���%p�����9?Bp9p��q�d}���
��G~�uX�@AN�c0z�ygŰ������eSO�>�*B���%6|4������@ӏ�SD�u�������˺-��ъw�yd3�8yp�U����|s�����
�h��#T��qڻ���P�R-gGz����1�O`�W��5��XTێ�KB��x-A�Y����Ɓ��
��9��R֭?����P�Ȋ�3졾��[w$�X&Q��?�Pd� �޲�G(�!z_8��/�%���4��P{�^��
4zÐ�^M�5.���l��i�����x�v'��[b2��)��ME0�ʿ�w��i��%�s:����Q��H|܂��M��G.�W<���>
%z��/��&�\��!���6��8BaW��I�M���O>
>7�
�{P��.1�L�0��4��X��SZ�GB����
�<\[Ϟ��E��� �bb�����/�#8�W���A�)�6\������м���|�{	��Y@m>��(�Srx�.�_z���K�/��w	�I,Ơz�aA�IXhE����.-ͮ���C.<}����G+�b+�sL;�m���7j��6�Y�ѧ�Rb�X��	*���s�I{S�;���#P�8D�d^KH�v>:!|��2JP(X{�c&@z��F��
u��} wܖ�BH�7|��`u~S�w/
�O���O���A��� EM�����LS�Eqk�)s�U�l�`�:Ql�ֽ���FST��ϣbp��Ӌ���t���>\}��
��=
�y�5�p��c�~�~��W����NĲ(�$V`�⥅.t�	.���F�q(�R\��S�A
F�b7Pc��/Fn'��7�9�7�Rԣ�n�/�Ԏ��雏n��WI}˽ǟC�����x���Wtj�	87� _�J���:���ޫ$�s� �� �U��!Έ�{ߥ�Ͼ>�J�E��HM��B�?C���K��L����/'�/&�7@&b2�n��������6R�x|�^�G���WNQ$p���2`�P2����
���#������q���|�~��X;�
���	���ͽ2 \&�gʰ�@����5��2��6P{�w�l�Έi5�������7K���u� ������;����t9U���oGߞ{�����/���崒���r��t2���L�����뉏!��.gK����y%]KU��y6>��(lg������|�MT�������g!�0;�f�tZ�TX���TK2�P�p���E��^?K�2��Ra��+�J�M(�Z9[]`ݱ�����+l��˦�� �ϖ$��&sJ�t����j���V�dE�XS
�+���@2�Nk�j�M��j9U��Ґ��C�\��N�>#J�Tye�J����K�r}q���(�-+�b!��eEi�r��c��g�jz����D��JϠ�
�S�_k_� %EխT�͉��f�9��&}�d1_Jtm�x�*I�� ѭ=��xu�F#�X��e��h|�GB������P w'������`��P(���sT���j�jՙ"��5��R��kÈ-6��e3�c�g�l.S�o���z0�~�n�X,�K��U��d�*��^��Jwz^��t=�܀��26)�^-����ly�5���r���\�C��Ph9ú��Օ�J���9����N�7)�U�r�T*�b�5��c"L�F�'���FB1VX��IC=�2ϝ�п����%��V���LO��[�
Ke9+�ݴRR��rC	�b��P�
2��؎�Ѹ�<�#�s�S�J?�-%�Twn,���K:\K�3�Ra�
���}�L7՜�.��_2��rK��*��=���i� ��$�%Y��'�rw����XU��z�)Tj��l��}z1[�*�J���T��6k_xӗK�J�ŦS<X����6� ,*ic.���.D��M[���aSL�Ь���z�Sx�60�z"�����i�K��VȘ¡`��h_��3�h��j��^(ztӛ+�/L!,�����F:UH�-<>���~L��F��@d�
D�"rq��Npb���hp44�q.@�������L��%B���zGK
���)���!g\�B�@,z��C�Caݭ�$0�����E�զ9�F�Y��щ�+�*x����M��u$>ЄT���K���Ry�idܠ�H�&���hd8�&4���P@3��-	�N����+�Q �d9�R2�
)��}��%��x��T-�K��фa�יCb�9��iˡ������R {������F�t��7��]X�.{��t}�~�*��>�Y �&"�k����ւ��ݶ��d�sL4�+�f��u�ri����M���� ��֙���:�kZ��
?ME���:M[{%�\�7����c�N�U������^�ޒ)9�f��D��ؓ��:ux��!�pF�n��:F�ϻ�����p{f6`ѭ ����V�7\��PSJ~�!1���Xt��M�Lo�	�B��?�a��iq·�}����ӑ�|D'a���24���,��o'�z;�]1a���՚�U\rP�65f��6W���3�	�htVT���Ux�[����zKw�f���;�cK�p4���㬅6�Fm�.��-;ڍ;6)�V��:E��&�7\�p�A	�u)���V��MЫ��ߧ�6�2]��
��l�؇MN�>~��9EM��t��ot}�5��\7���ׯ�-�v�c�q.ñP$�F�ƣ�k8xX?Q��Q�z"�
'V�v�u�,r�#g�ɔ:G�~��E"�#Q-�[�!R?0�^�6(�^�7k!Ya/�6��Z�-���z�
�b(�j(.��
�� k�d�G#�f����%,�D��*�^	ڍ�U�)hH��)͢��B�͌�H��K!,�r)�N��p�����m����:
�f�H�Rp�$,ɉ�S����1?��5���i�䮜�M�6W����G���ׅ":8ZWPi���{+Ϫ��X(�Gãb�+��ĵ�o� ��ދ��z1�]/ơ����r���H��iR�л-R� �-R�&�H��
�*�e����7K/���� �v����P��p ��IW��1��b�
��n�-�Ĺ./��6LZ:��(����.0����A�&�J��
M���*~���ʄuJ6^�5-�kM�7�s�q�n���D��ۓtO�J���n���$�:�6Y�٦�r��l&�.�-K]ۘNؐ��g�U_'cn�� ~ŎW�X��z�㕈�bi+�������W�}�}�E��x 8�Yc�x�a��vAH���h8.��%4^
��i���9��� �`�^k�,k�P��3FBv���"��ꏷ(��;n�6�����BI���v������ꃖ���Ģ�J}�b"N+�����XC���iG<.��H��JڒP�Ԓ�'"{�ض��b[��4|۞��`�MI��3�<�)Xq1Z�ϊ�Yq1�t1+@c�8�g����
�
W=�-�r5O2��gc�x ������M�4�1�4���27'u�lRN�^��x8��DD6)����x�sŖf#�����~��]�P<�L�_Á��D�p��r�ihmI~!�*J�̭����p�T���t�;�RW`�m��5
��/z6Y*+S�yQ���	hg��W
�^r6�3_���[�t~mt�E��ffe���GBa���D���`h\�Cf�BV����b�e��P���Ԭ�~>܂z�J�m�{|&a��7��an}VV]��[ރ�F�S�T��z��ӿ,S���b�@0�}2����kA,�'�����Z��p�Ѱ.
�٘�V�%�Q��(O,�h����n��4=G�SJ����ǆ���l���Ca^!ӽ��uq��B`��k�27&Y���8�2���V���+�/�8��RΦr�K
�N��ʞ.���*M��Q�}��K�x��}i4�8�-	���f`"�)d��I��q�]��<=���d��r�'}l�׫*�����(g����$C�� (���X.U]S|L��gx0Et:'B{����!��qK����+|0�;�\(�jy �D[JFt_eS����h�䛿*x�U	{2�"�$���W�&B7\���%�Q���g��;�������8еu+/.:=�Ώ�U[��p��j��C\�86�X�:D��3���8ՁB� ���r_^.攫3D���c
�\����tB�MQ\�/����J�[���ρD8.��5D��ba�*���<�)�3u���:�/6�vi=��E����$��*�<��URd��e��	�F�h��i(�m�~�X+d�Xn�md�y������_�����+ΜEK�l��E�'�S\XUn�r�g!*�iEl��Z��keq~�� 
�Yǚ��~C���k��,�ut�P���.γ(Y�Z
�*���8h
/���l�¯ؤB��
YI1�b��6M��SE���p*ۼvZa	@/>9���@���/���? ��vO��W�E��m�v0V�>[�4hc�V�I�6�QX�8��3��47]:,WA�S8�Zׅ�#)�� �T-�<�6c%qhu���+>�g_xx���Qpn�B�>n��T6W16����s���x&��F�����Ո���es�dq[�w{8>��k���Kf��
ʜ�eP3���(Wj�<�k�2��'���ْt��ܟ+��j��� ������� �ּ��V��
��	�������dcLEn�@� ��#*�p'@�߿��*�T�ㅦ����P�ᔮbCS��{0�0vw M�By��.V*V����#/+@jH� ��H�n���l��a�
�%�J-�	@�ݛ>A*��z�Nt>E��1��s���t0�k���vÓ�����pc��c�"�BWP�
�ZAQ7���n̅i�H��p�҈��AA�
�l����5:���'ɢ��@�|�G�=u1y�A�!�th�(���
"�P��ˠ����e�v��=k�ԧ%²�Yx����	�6�P,8s�E�frD����p�a������#+��J��.yON��!�'��� Ԙk-��[x�:=�NTT���j�.��v_t��פ�ݻ����^i������X�����`Ծ���u
���h>�ԧ=��UD����ʥ^�с]R�E?��9BVS"�r,�[�q����"u�1��
vrv���p
�� �M0�&�֋$f*X��˲��[���V�=�p��֗�(+;ԫ�/��k���R?������µ������o�������h������9�h؝�^;S�l�mbRI�j�ʲU�0���KhANf�,�n����I�Ύ��	�6>�Z���0��z?��~����D�R������>'n}���譸mXBƫ^gM
*mi �ֹ�J��LEi=�E�k��p!`z��%��Ҵ�����;oc>v�=�l��E�&r��$wy36��ʀ$[H�޺�i��ٳ�g���
ʶ�\�/�Fe�@GM�.Q��2m��8���\p�b̚�tЭRg\u�!�j��@�s�
������rA��f9� 
�(�&�G}����I�z]]&�bJ�yd#�X�"�G�c�R��QD�,ݫ���0֭Y #F ?#^=i�����:N-�YVt�Z��lu&SNͥr���,b�$Ό;���~C������}�r隚���Q�Y��D�I�^�d/F���}�E��Ҥz���@84uO$ƺ��K�������0�@c?�2��xcJ5�գ��������o��{��������\1����es"=�̧Ζ�Q	�1��i`a��y_=����gje��.���)�6��	��l�n��85:��6��^�u�n�\�}����o�~�a��"�d?��ukc�q+c_����Z�Ǭ��)Nyor����G+uP�>�a۽i Ѭ��>�`�װ��� 鿖�Ӥ����^t��s�����ַ���%��mGyU�?9BG9EO�^�P��Dh)E����l*�[`�jugɃ���b S�m��&�r��8K������u_�2��ՙ����G3������8-��H��G]n�S�^N���I�yG��Q��&�_��Т&	�XZOt�R���kL�ѿ�?�t�:�,��䳬V���&p�m.��s�޻�d�_�����p�Ӡ��l5�9�0��u�_��.��̛B�g��۾>ݦf2�3n�w;;ҥ���3o2v8��V�͉m*�k7�e-�S��Z�G�g�ulhY��cwĽ�-u��q�q7*�Š[@�#U-�y���U�<2�j*s<,�J�T�e��6�ݱ�m I��l]vS��}K��t��;:���q�S��H�IG��X�j]q�LI7Ś�Q��c����g��Z|�$�n�������1m�?Zsz\��:p���I�.����f�.�o�z��`��r4�VG7���
\�-\��e3֛Z��6��Nf��m4���Rf��v(%��d�㜌�5M���'q��1�/$���AL����ү��i�q�����/O"c��N � f/�R8l5�x}=-��Kbh'̩�*��VN�m��/�׈F�+Iu�i��g �sr�!9�cNy�o�}&;5e��j�M.�K��5��ƙM�bq	��g�R�+�7�x�Ɍ	]�1�%Z�/l�m����7���|��fZwc�;�Yѷ.��4�3U.�EF$_�T��Pa}=���2��_��U
��ZY��=4�V�泌��EAs_z��:�Ω�z��t�I���Vaj�n�J�������4���S��@޲]��
�b��I��x��'�>q����^�"����R�5����:]����f��r69�inӢ�>�;���n-�z����	]�.��y<�wO��~n�>�d�}�}Tt�J�|�C�w�Ge�p����h�i5�mV&����w̙v��H5��8'`�uF��VoH�9u���dtnҒ:ߎ7��,C��A/�3�9��q�&�`�����ֿ�	�8K� V������X���JP�.�� �:BKò|}7j�5�8}��"�j���q@'5d���~ �	K��d��L
Rk	��jf �|ͤ�6��Gk`��[n�m>�a
�P��9`��t��N/�9;�*[^��
6t!
^�k�'�V�tL��A��k�J�f�
��I#�u�^��l<���M�sw�i���Y�6
����Y��c��=N��y���qZ`rg�:�o�S�crӰӈ�a����;�V�ZnCL����e��y���i���8NLN�&&�vhΛt��1�h�'��/����8Oc��F��٬?ڕCw�����&ف|q;�4Ms���(����Am,;��;�Yߎ�=;���݁�N�/�R8Z�$��,��I�9[9?���s�4�K��DU)��A������l���R��fv�r<'�&�M�S�XXP�� P�.uUNL�(Sb�V��X,<�JE�;YL�W=��\���"\�� ��03��뼂�2'J�U���RNUia����S���RH3�p?�C���-�dK��#a�W,�xY�~�l|�ڃ,rT��_,c	V)%����~6�*gD�\��k(���,l۳G+�y9U��5N�"[I�*=��Գ8�j{K;��p�W+4�[V��p����r�i8�>��RNZuc>�hO�RY1i�Xx".��E���\%3���`����@��U}�0z��C�Ca�,�������	p��&bl<p2E�*p(����m �Z*�k�i�q�$��z����y�FD:=B��O��{��U��Eǵ3�y׀N��(9%m5؊�g˝:Y��j�t���NG=�z�tJ�0���˪d�|YG�/ם�]��zT5�K?K�X�}��F͍�8���nw�@�,����J�)�.���x�bZ+'�ϊ�$�T:���G��4���yU���Q�8������D|W��,�'��z�����}���kO6�ڟ����H(x�^m�r���"J���5�g��ⱥ���wOH��U蒦�@+zv=	Y�U1��^S�~C)L���
���m�����>*;7����h�Q��/}
:U.��:���h	�,��-�Y2U[��d�0�YXwG�IttG���wG���K"��Qu�\�M�PǞi��z��Z�mA$�����5���x8W2��f�s%u�ԞC���2����}q�Fƿ�9�v�[��5�6�	�@ů"�k�4.U�}�v����0ej/�UkpI�?�
1ԩI�=5q�|��+rU5d�4��4[��홦ː��_ѐ��!W'��gc�x �ִ�P¡�p����C,����"q�	ĆB��?���@|�jd��J�����4T��/s��C����K�
�r�i���}�c�oX�b��A�ַx<uKZ0EN����z�0?��	i2�4��ڌ�S�F� Q7օ/1�&�}��I������u��v�Oplt���SV]vƣ�j��#�	�W�)ޭ�HG�M�6���X�t1�S*i��[׀�p���"%3?$��>l�0��e�V1��	�xmZ�3f�/��зi�:�-��L\gv��k�C���J��o�1�&1�UoP6�Ur��C����l9�'�'�\�0]���Xq@Eh5�4��0i"�^�鏙�Ax���o���m"�тi�_�WS���з�U���S�f��:HI7E9�̀�_ŸZ�X���yVU
)lfY�F�5�ƪ�Lbj&��by2��(����B�<��g+&�EE9�yr�aL��c�l��ֲ��D�����Z��9�B�U�����Q��)��]iw�P�B&K��i
���膺���w����[0N4�1�:���f�%��Fe����5WdA��;Is����m	��~F� �c��|1�n/���WՇu��̴Rvh�DI�h��+#�]5���h��)��9m3�>��d5[�)�k�X��ȯ6�tz\m�Ō:�Ч}S
��R���Jd|�+>ؠR�DT٧��gx����B~��3\��)��Q��<��R����P�X��|-W�b7���qY��ټb�X�2���L�k�xK'U�N%yu��,5���v�XZ���J;z.U%lگ�������x`�E���67E9�Dsyd�,���z�P����ymv������I-li�jc���2#�b��ObS)��^#�I��	�#���G���9�#ې�E�&#�H7[��򱾖�Y�����c�GK�mlԙ��H;Z�S}-�n��K�̵>�Y� 4Rì��  ���}�rG�໾����${HJ$%[�Z��HHB��@�=�I� H������%�'�ʵ*�pQ��+3Ong��sL���	����'$f7A�8>g�Zd�Dƃ�(q'����]YHh�1/2�'RD���T�.e�ڢ�Qk��^�.Ȧ�fʛ�����u%^%֖e� �@-�e	=��,
����[P���!��؆��t�ې&�*u�Y�"��3����$�y[+]��ż�XQ �\�o5BK��c⑍! <�� a	,|B6(Uz�3֮�rQk����j�"h�i��6�r�f�<���	�}S��Bu9�G���&o��7��"��Y��<�D����1�X�V�G-;�E}+��'�]
����ɒ>�������!�Bl����ċ;Л* u�AC]�H����^�#�� Yp�g�[���BQjFI�M~r7X`�H��@�I4H�IäE_�&2 NQ(�k"�m��P��P�h_
0oq���mL��h���bdt.��,Z(Nt�	��OҾe,1H`D�S�
� )�����-
��;I1Q��?���2�9b��[i��L��Q�!� ��W}j�Hu�Ҫ�Y�'�o��3��*��L��(h���ǳ�r�7�ze|E�}�/1��Yf���	}·�8#�C:-�H�Wх�I����@��|�b�ʖ��xۋ���u�a�R�&Ӻ
^Hf��HT{4kֺ��R2�w��ˬZl�X�9������ݛD�0X�|DКT�5�~�5��W�m�X�*7Юy��4�HZz�Ԯ�
5)����ia�vXM�ۜ*ùc�U˨�ٵ�{���j�U��2E�ϧ3hp�[ߗS#�IG�{5��IL{�-� P�h
�zX
0��@	�՟�7��";�]s��9\�1�$u�n�/�|���(S�5���/�rǥ
&їh�����H!���wIN�q>�
�IL�������G���zR���A��� �0ȸ����IC�ڮ	��o����@w���h�Bд��\��)Ƨ�	�0����N��:��X�c>~�?!�)��$\
�Kz�q�x��9��L4#�HK����w���7UT�9�ӳhx
r� #bG���>�P�����Z�,{�ҋ���h:����m��CU��]�d�B��z'�z�1�7>eZ���	�C$��Rm�p!��߽۠$h�!;1W���	V	L H	2�-~���7���(Zڮ�6r�"GSITT�r�<��T�8M����)��(e�K[x��;���q4R����}�R0K�d��)C��)*B��uU�N�e���'����<�o�줵��|e�Xqw.���H�Fz>&�Ih���U�O*~�JO����d�����'p<�̔K��������q$�AZ��d����	��d�
$�xߘ?"NId*��L��-�mǯ7i���'�d����垹ާl�>��@����hZ�2�c҃.��4��$JR����[�A}`!!�8���ʇ焝��6=G�LG]'�%������i6�Svϸ���j:L�ϩZ*Bu�n���x�s�%Y��	?��J
�~��3��%�I����e����E���
���_�ׅ\��u��g:�g��0�Idb�1�� ��������^��j�]~���*.�T�4L�4x劅���Պ�Q�b@J_NV�_��)dF+��U�l��O�yP*�1�6�
��<�:��,����_�q͆�+��:���z��1Y!���{4��l�@ʡp��"lm�I�̐a�0��,��3͏� .��Q���w���a���r��o�g�BV������4�$��ӂ�)���6����������d�eNG��?	�M���v�����[�~tHLm��G�-�b��%�\	%61��o�1�ؿå�I`������H�WG4)�
�A�-�Y/Ư���1
<"G<����+�q@E�}�������4$�	��qJ׋x�e�q�Bm%2ZV�ǀ�h>r�W�۬���B���8K�,J`��@�EBpT~����nTr�\���Cm	�!�Wi6�`�����,J
Ho�jd�X�壌Xkp��ϏZq�.'�#RB�p\<Y���!`11`�,�Tf���r���kVa

$�B0�0����E'P�+��'���$��Θ��Z���!ߣ��/����#K{����8��i�r�� �\Dd�er�BGt�h�'[�S>�a2=��'Z�D-'�D�����$��!Nl.����e�'|!e�s���:>��O.Oϔ�9��e��o����B�$�2!�:hA*��J��G��8�#�~���N/����.겧D���L8� X�����,�$(��]��/7Hi���q$1��b�c�+��>��0`�[E�V*��V�D��0����Z�	oE�D�&n��a��ųhsc���xU޲�^�9�����A	��@���l+?Պ��.t�\����^!a/�!��m��k�{�m:����������G����v���E��廓��Ǎgo���""B:%��E����������s\p��gy\^|t� ��gztP|lvh�3��(>�,xރ3_?->�,xރ��_��ed�m,����B�*��ez4L������)P-gh�L�=�_��������{9��^�1�d��x��%��r�D�b<'��lE�a�����������<88�}�~g��!�
�,�1m�Q~��6�'Q��I��E�B����3�:��X	~	t�_���j�q6�'�-j�]�?�׎z��X�WHm8`��1D{6��q<c>.695%II	��$Q�X?e���Ѱ��㙐����l���*F�"1��5Tf�5Qe\�N�@�u�,C1�R[yE��.�X�t-�E�e�������3dQnS0��$Zr�4s�[ �����78+���)	:���p��=��5�a�G�y]��C��4]�����p1� �R�ՒQ^�f��L�Q&��y�������z��������	��l����\�RIc6 �{d=��t����X��4�e��yN�p5c�77�b�1�W��9�>��eŖ��x�k�c�N�IB<��zH�@�-\�k��|
ĺ��80�Tn'���D����DOۧ������E�}��.+��#=O��5�
�_���*�'��{���Á��᯦�5ōL�5�.������Ǭ��éT�^ߞ
��/�T�ճ��6W#�'~���r��x�-d������rwS�O�ki۪����wjP�j$�}����·�Un�?c�w�KZ�{g�SQ�Ӵ�^[�jsf�H�W��(uʞ��%b�+Wή{�n���ų�3v9e��*B�i�9L��m��*B;b?�Ki	z��z�Kl���B�6�}|�C�'�f���Փ�8�?�|3�F����.c�^m r�fJ\�\S�in_�Ɣ{��*��v#��v�>��o���U�BM��&�@�ZM��L��dHRc^EdP�َ6$����3��y0EfF��6�S� �g�Q����K��Ւ�87���X@N%�2K�$gb�}�r��X�%<����X#px�s$*_�4T��>%'�1�����K�z=�Y��ѳ�,�y ��m" +����T ��)��_�@R�v��t����99�BN�i8C�`�i����Tt��3����.����p&K@z��*_����e��Z^Q����FXo&ْ�j
P��(F��PZ>p��[&֫�1�c܎\Mė	���.Lk{��yOG��������):�v�
�yȽ���(��$Qs�RM`;`�E��N*��&lj���m�~���7� �d�����nt�
u�$���?P�ѣ>�;20���Ѽ�:6���4"Yd���u�h�/�9IG��D�i���{��/&p?2��;�ݰ��?�/ ��Yy���4��/��o��_���pBn(u�\�!�R}�f�G���Six$v������O��:���3W���Ιλ�>2����c� �X�8h�Xt�̗З�d5��xA�"-Dr#�J�>N(IAd'�$9q�����k?�GC��r���M�_������ͨH�?�5N��B;=����G$�;�2�k��󂚼\N�4}4�#�{4�
���H�#�u�;�l�B�\��EFSC�T�i�
�fŴS� K�_Z�����3)fT_�4��bI��b�Ŀd��XSdŊ�g5��7�H��d�t]d�Pj�,q�>��,<�'!ۢ���39/��&)a0�Le��c���i	��#$�0��e�2�:!�Q$+`aD§���"z��'���R�-8��=}Y�zbZ�_���tc��R
������.Q��2�?�d���h@Ln-I��S��cU|��>��W9�������
q�V�ç?^���@�L�jCLg�d�8���~AC�[6��� Z�(�+�O
R��>9ؖ&̫�� �BA��C2�/�ҝ�*DH 4'�E"���u�aꡪХ��[��L�
�J~hs����	(}�}a�L#Yz,�&p�m;�F*�7��TDn��WwR)��K�8��p�c���ByiF�j�|5��
�Q����"�ު��>��G;�D��NHJ]��jg� k�̫�}�Â�hK!?�)h%�ߜ8�E��i^����ET���$X%���0T���I�'q�3�����
on6h�-����ߡ�������~��O���ǟ�M��SRddt����4��F)����:8NI�y8�-�#78��;���N�M	#h5��@�id��"i�|�5����b��f}����Y��o��n�L���:^�]�M
�՚)��bC�����7!��&,��Q�G�I��A�����My�&`UQ/	��7B�B0
�;B�N4��V�ur����sg�i1$<3|��K��Y퓼�Ҝ�B��eED����bP��L���Md�ƅZ��k�7�.4zæw
� mvlVY�8 �����a�=����'�r�����#y�k���$����\�s���$�aŞ4���0<��.����?�O���7�M���[>;�"����;8=I�	07	��y��7c�"��@�Y�B �*�!}�4I�,K�����e������}�
��-�{���{n[̷G��Ƙ_⸡DU�R�r�XH�J�xQ[|�ĸ�N�R�K�8R�,�����<� ��A�R<K��肸�_��$}3U���k/�L�#�������	O)�yR̵�4 �.yѠ��էӗ_B��{��3D�/��m����P8~�h�\U���`���z�h3�1J�!���c6�#�l��V�na�n_UC+�ª�a㢐BGZ���?�W'm�@{��h/!xf�{��2�����i��7�mH"u�7�>��9�Uy�����1�?_�R"���]AĘ�+"
����]M�H�/Q\L[�(O��� E���F�l�TF��Nס)��cԓ+��
^ݗ�T%�'�z�����L�6���WK��
�@(k�j2۔o32d������e�fv~����V�H�R"�)�Vu�(��~͊��Ӈ`�a��9�'
�Coӳ�?{�<$",�h���l����3����"ˆV8�V��3�T{ɫI�_)��6?��Z-�D�g�E<���A�I�����b��h������͌��l+���{��� J�t84<]\1�.�NN�	A���v�:�6[h����(g��1j��<�j�c<Ya"�����o�����#�Vz.#���Lc���B'&B+0�*�5b�� t�.Кc{�����w<s:� �q]
���={�OC��L��O
`�k�;�� �{/W$��r	��9���`��	
&�s�����!J1�V�+���_;S����ԋ���u�)4ݛ��!ۂdxMC�������q�����է��W���hL�9A�O#������� �����y�}�ߪ�ow���c*��O&?�3M��#{b���i��{�k��h]��-��-#�:�)��m�GF��Q�'K��&��pT�zG��6��Zuy����w7�*�#��K!�7��N>"5���V�F4q��5%w�H�V��6L��
�w��'��_����&T@�$Ly�m����)>�a���9:���������;Ë,�-y)�����@��L��hB�t���W���b^��Q�xow?�3Q��*���Q^��O����R��sln ����dc;�hϾ��0'�����p5gބ�Q8Ah��E�u
1< Ϟ�ô�x����E�ɿN!��$H��b���@���E�
��5hp��6Hn��o����p�%򤳣U��HN�`�=d:L�'^L�e#�����{��ߐ�,!~#ī���'��x����I����	Y�O��$Ň�)���8�P�0ġ��W|�_zp�O7|�a�i���n�ר��or�"� � ���h�2m�>m��C4M4�x*r㕷��HF�K�F�o�A�m�#ꑹ �K��z��Oǂ�����;i�r���C��v.>S6�lP�<:�<mw;Gz��G��.�ID}Sy5E���O97X��S,�
3;[!����~b8����/xV�,��s�Dy�a��c�1�	P�b�����BR5�`#��� 8�#��W4�ׂ��V�Z���YЋ_�ç��9���X��5y��Ώ, !�Y��
6����x>�X�"x4�2�l(P
cg6^��&��!RXo$�!��ϩC�'
G���HV��V�_��ϯJ =䀥*�e밂��\�Ԕ�h��z��.�D�A�E�q�&�W����"�r����.=��/�q���Rp�A\-"9��$��5�L��}Q[��.B�xp�~���)_KU��Xf2ޥ
&#^� �=�
��b y+B�CL�4�҆k�c���y�6�nӰ�Lf(���^Y�6�Q&m�a����i�6h�t
3'���y��ɦJ�tMUL�5�3M�
O���f攱?L�#�j��)���a�-�q��3��;�.���	J����l��_��[�$��������@� ���
5�K^o�@��:��	���ݽ��vP�/��Z:H����@Վ�̋��4��މq�N|��>}C����o���+��ٻ�u7
g��e�Ϛu_x�(SQ2ѣR�Bi��vy�=��uc+�N�qda�F;ʋ+;3�gcg^�3sf��3�b+�K3WU�WdI�n��S��b�fc]I�
�'�d�&��J�E&B�.��6;�Rn�8~k����޳LINq�����p���bFKe/��uhD[�>8�7C��駍�F zf�{jo՞�V�=����-l�ԗ�V���t�sn��%������2��r�m�l,���e�L�ecV0u�	�;���s[H5�b�֕��eQ���S$� �r�  �ō
9-f)�(X<�w����6�E���7��M��p�u�±��Ѭ�>����Ԯv���n�64���C��,���9�#I�d}�:����Y���eI��O��L��iC�/�UJA:�{���I\���#�eB�4�RA���FP>DA�)��baQXT f��W�]#��
M�ݏ8sb�����*'��墿�s�x�����> �� �Ej�5��%9@]�&�`@�T�����LO
��x���YCg�x�y
�Eafp~�%��*H[6lg��?d(*��QdCT
QeaE��t��2��V��NQAe�qFJ��%	���Τ"\0`x�~Z�e��7�w\P��Z�O,��Y���ŉ/��.<=��a�tt���H�|<Ϳ�bd����-6�/p��5�Բ��4��&�`��V�����AWڇ!���/-�Դh^	��*Gff�h^�hPy'r~◆*���ۈ݈{΢��Y�e}�Q}���R�A�0N�ų�d��.����L4b�V-j?��/k��ر��l�j����,H�4~���InaI� �y�G��Rc���5��-K�(�N�%�g`i��
��´$*J�<"3'O���S�g���U�p�L����ǳ�Q�\�wדAZ�������x:�̫~��^%��<��OX� W�x3����y��}�Ŗ������K`��^XM
q���_��W��X�������tN[����/�K2(Ui����w/��4\��)
�BYp]4бp:[�t��ѫ��h�*477-����T�˅A6.f�HW��D� +�LaɠD�D8ô1H�z�^g�,˘�#5�{Dˆ�<�=\�J��7����/��.�
.� ��>7g�w;*ռ�Q��h�.g�i���>���_��D�uq�q�<lWk��?}}��v���ji��*�F݉�N���-����iӸ}��`H�� 	�sa�k_�>K���>���[��D)c���X��Y�Yn��I�8����O�D7�=}��q�PC�i7��2]��8���cл�~j������'hU;g��ݙӾz��1�(�x�-7�H�s�*a���U�dW���t�dIS�m.�Ki��g?EF��5\��@���;Q|�.�������T�C����>L�i�r}tY��Rt��TO���H�������*�b��B���z*�ʎ�墘��&����d�q�框��ŲtP�οK��{q�S�o�*nb��qz�J�k�K*\֪_zSY�YR��5���N/Z�gku~�أ����yY�'�����Y��(I1�� ��2y<�L/�C�ߥ��0��yF�r���Zk�B�Fc\'v4�W7������FK�Z�Ϫ�x�rP�rcUG�
���>:dY�f�R���ܡ�3���=RH�t��I������٤��Ml6��$�]��$�]۩G-f#��3a*O�u��ς$�F�s:('��{s�����>���?�̾�3����fy�����ƨ�*��&Y-՗.�I(V�j�ť�B����I��.d4���b����ĵ�c�|��6{�z[�[^�MGr!���uY�]�n��{�Ғ��ӈ�A)jE��9�ɴ#+�KU���RVP��5I��,-�ќ,<���(��25ܽjY*//�
��<�(�>͡��aNC���z��4�H�G*�&�,{�T��N��:Cx�Cp��vz=TTC�2�Zeȁ���!J<m��vY���x
�6FohcB�ToS��Ͷ՜�j�z(��;`od+��:f�ߥ�N�z5M����¯i�l�8��gG秧�>�c��� ���
ᩇ����_��������:^�A0&�,���]��Z�0��F9�2�G�/���m2����-,��x���Gf��x4.1�,h?�w���h��� �������!�v���w�Ix�;��m�d�z<�h��nt�E��%/w��Cqc'L���ҋ�~܅���
`�\��vq2���w;�ro��רy��^��g�P^�~x5��*�0�fk1�[Rm�ͺ�|�����p'#>Um�1�����Q��[�J�4���S_���ѿB�%
��G��!8���M�T5K��E4#���������\ ��}���(�:��!b�q�@l����B��`5ކ��hė�%Nor ���?�
:���"���$&ي�+���Cz ddƅW!ZxƧ6�8���r�B��9���ш@I���[|T���D{��-�p�~K��ގ'� �YDix��p��zJ�#�t<#&��e��9\�I���f!j����r-W��[� &��_�S�>m^��ϸ�Y�/�h)��%F��.�=�4ny����ĉ'?.�.� 
c�5ڢd�|����W��;z��.(��.�~m#���z���-(�~N�k�9Cb��J��&��pmS��z��ur��!�sC��ہ��u8I��m��ı����T�����Qldf���Z��\�lV��"- ��H`'��Z"�o7�s�w��Bǣ�����*l���K$JM���z�d�|lu��g���c��<�v/�41��ZRZ�C
��:0�H��~�#f�d�w�'�#=)��2�z������Hq���zF��(xv�:�p	la>�߀N�9=�ć)�s@[�̴
�Z��%�[������pGz~w���-�����9ܹ��?_�{����ÿ�����
c���!Lמ]��ϣ��ԭt�#��^�tҔ�����_�A�m����=!^���w�(@?�g�,a�߽!�#���"���qE��� pP�ߋ��!3��oJ]U������V����z�H��������,���e��o��
2L��$��M戻@Y���s�%��8]�@���{�7<)N5>��h�@Vփ#��w�ʾ�:��NPsԁr4�*5
�� F����(��Cpdϼ���f��s_�3�fH�(EX�a����JN�BHxdnM���� ��kR��;�]�($�z�f�0:&�B{X��>Y�X�xBn^r���-h[�8Ei�VJ�"�p�h{�4k���kƶ�JYS�"�⼭@7n,��3�=�|�_�i����@���t4xt�Oƭ���RD�]���sAb����n�/��&�/>\U\�"\Ul_����\U�T��
���d|3�+��ߗw��#����XִY�5=p[SmA��
���$����˟u��~�yS��2Z���l3�m�����\>���~d��8(.+=����WEd$w�y�I��1H��+
r.�X��!}YB9��Uvx�
ӕ0^�' |d�ڽ�gp�6N�9��͖�� ��rI
�����) ��8e��\�h����,*%7�\Fn�C.�i�����n��T	�44���
د}�kg5N9��J�)l�\��{��Nr������M����	bI.��tI$_ު�"�&��9����ߖ��+���jŊ8MG�d*�\!)��8j��"T�ў�e��',�`����ǹy=ZO�\Tm��p^�<�Z��S弮=�*�]�o����ul;�^�>[���;�Q�����C#� Q�hrd�����S�n\�T������e��Q�M�?vOz��K�*X�L�/M{>�4��~���$�(�Y#�+HS�y�X%D�r�J��1W��Ӕ\�����Y8F�������]Mb�Y����.E� ^8ډg��`��-�eL��������0\�Y`���O�����)�	b����U^5��I�*�7rY'|��R���������c��9\�E��՝������RZK��t�C� �t��,[h�d��f�e4V���9*��7t&�?��;*��F ��91~��'��/^�M<�/C�$�I���C9�t!9'��\��k'��ߴ������>��1������U���QI�����`���ÔL��P6/w��ڡ�W�=��翴��Q��<��*[���0ƿ �+�h�ҭQ��������#�*�s�e�M��0R��8�T�(�F��[�x�2°�t�5-d��^�F'��w���#)�̙@٤�O�t�]A+F7��k����R:��Z�>V���t6�%�T�j�b���T+�Xyh!��!��`1�4��A�'��.�����#<1
�>v���[�� .��i3^a�0qSf��I�Bev}�P�_-Tf���J�h{�\������n��m�[�d�Np���^���(eW�@qwD�-HyW��~�������2�%R�i*��v�@U��t��Nu�e����"�jC�V�����2K�����T��T��U�Q������ j(��܆rPn#�j��%c���r�m(����6=�nScx�J;����~�1�w�i�+�4tBC8�f��P�Zw7԰)Ճ�颷W��۵h��_��rw2X��F���Cy==} '��P!U�����_� mU䜼g44�ci�Q�nE���ge�c����Ѝ�j_ݪz�{�t�/3 
��^�k��!�jV�՟��[AW��T�A�f�K��^�h|
��/j�o7̿a�
�o������ռ��U��pg��p�;�S5��a�
�o����n�_���K~<k�1\i�>�Z�C*���Z��ۖj᦯[��µ���M��SӦ�ǧiS��R�I�?���51��N��(�fͬ��{�6��a�+:�{RYR,T�o5��-+�e
Y�+Y�h7[Vn�jQl_Y���js�m�2sQoK��k��Aە�B��T�q֤�E�"��&\�ڛ��5OC՜ν�����hOsQ�K���q�q��w�Y��  ���]�r۸���S�������If��d�����g$;��S[*��ndQ��<��\�C��l�I�)J�"�@h4�k4M�b�g�l�X63X�b8Ύ�sI�2��ԚQ�Kf%�s@�I��\�$yBW_�$�[E�o@&�l?&�l> �"!YΕw#e+oP�V޳�����f��;�ԛ�JO&�R���6��%�\K7���{-��b^�f߬c���:^k�%���3KlCP�F/�Y�f�u�]��~���/�oʯ�[���=7���ȓҡ{����m��t��]�W+���]���M<���M��Ӎ��A����T��*�Tv�*���`�2fu׫|2����x^������-W��4�g{�O�%�F7�Y�f��ջN/�Yaf���V|\�oլ^�z���*��$f�?�����p�ʃ<%j ³A�Bxg�T������i�X���"j�C:��U��,�V!���Vw'�&z�X��䵜����|m�ӷ�*��:��̄o�^�L�6��u�֘	��^�]�?Lo�� ���1�y�;������
�cx<n��g������1(��ckN�:�q�=�����oYej�u���a���"T�A�%^�h6�Ff!��}ֿ8;\��D~��
�-��I���:?�N������o�~8���IV�0�h��LnalS"m��_3��u��%uk��Q�}E���\���=B��?��Ƒ�@/��W���=\���D����{w�b?�����J��N��j����2���1�7toA��#�\�����'PZ$w��Vt}=8�C�|JIU^�yZ���{{��.Q�X^|(
5�]}��G��i��gϐ�=��5[�w�|2�5��糇=J�o�a�`SW���3�9*�n�zS
AG+q����bw����C��MZA�0���v0oПn�#��-#R-�6�4�[?Ω<�3ۛ��Ɋ��N�s��G@��u9��-tz}Nu��4���FA[c��l��Ⱥ����U���b��@Z��&�S�Bx���X0r�F���$ȌʋQ<���SEǞO�,�o�g�["��׬�Iu9�+N4ZJ't���d
���iA���ĥ9�S,�ΧaYÌ	�I�)QV6��q��k�� A�������'���D��0_�W��έ<���k�gb?`�k�Yo��V"�{vb����E:uݘ��@"xoY���������"o �|5�E�
��_�*�E��<z�A�Br�G�~��x��
�<�r+t$�SؓXd�� *���J�ⳍ`�Az>�@,|��9"Z}��ʵ����w��ҠY�G]���ydo��K� �� �e?8Mk0��~��c�v��-d�ַ.�~���
hp�W�܏Ѝ�� >�t�r�/�F��ŉ�������e"4�|�ח]4r���W�Ϝlp�.6����%��K����LK���@^�d�o��qs ��=T-�s�u����Q��L�`�*��åL��޹�K�3&�.s$̻0X�������ߢ�E��Kz�5鈀�W�k�G���N�8��s��~��h�#,J�m �(&�!��r��MЫ����	z�E�.��1�����AS��Z}^�����b���2
+��BƄ�s��A�.�0�L��3aN��l��0�?}��u1:�F����&�:�R%Pqb������#R jk�U�s�u��q'�l�e�I� �H�P�A�	��D���@1f��SǤ;y��z;��駔��g"��o8������.�v�/d�~C��\(����aZб��C�W/�ނ��͈�f3���
�mt�����	(���v���%ELK��5�=�%���ĤOL�z<>����"��3�3o��`l=���Z$��7[e�t������Yrg|�~�
���/�O���U;��L�\���E�[�/X& G�ܕJ @P�E^���wY	�f��^����nĄ�1_��╛&��'#��'f�Stܽ��
�P�-�_�\��x��S0/~�|�/��.�Ӄ��k"J��2��\���p�.�,\H�e//w1R5��I�F�#>���dn*�Tu�V��R�=�)d����Q����u�;lH_x�:3Gji�w���1�I�}y�:o�	v�D�<#���'W�Ao8u>�~d]J���|��=�R��
��
�XBWBu7�5+g�*��k�PQ�*~=�j��n/B`�۷��Un�d�(ֆkN�ʬ���`d��ChE;�<ț)��h�5��0ses$]�i�#��j�M#5t����jrrm���.Z?�
�d=�[�%���E;?����d�,��v�,&��DW[��Tz|�G6窒�6f��R���,��}e4��Y�}r�-��Ŵ�@"��n��<�6wR�Ctne;&O�i�2|<��*�c�
.N6�]�,����n�,���s~q>Y��G,���k��@|�$�Fˮ�Ӓ�h*��)ܵ�+���g�oș�ܗ�v�G�Я�i�.�vr��̝��
����Eoh���.���$��
GG0��Oz*�3	�ث������H�
E~����7Bvx<��L��O�@y�X��s���>']�9����C����:^HL��}��IB�L�E�o
�z���h�����XԷQ�* �3�KQC+qPzQ]&+ ��D��wѹ/�
��?���9��>-�|9a��\xK��Jb�v�B7��'�i���i�e�_z��d)�h�2�e�����; '#���?,��m���c2��G�����A����&���տ�W�VnD뎝�6��`�l�G���S�F� ,&�z��Z�ƋxU��Y�r#���0��E��=�w����T9�W ��ŧ"��m��>����ΠB�"���>�+<$+	�V�KR��ݞe�B�m�̕����v3Fq�I����n7.-�釢�]��6�]����p*n��/���_��/]��7�X��[[E�o+���C��ҏ������J�i	�!*}LW5���x�'*�ث�$~	�G���Cw���W���p?s�_�᷇%j��&�cA�t,��˙ �E�[,f@�xyV��KgP�f���3*�K'���,�XI Ր�B`�T�a\�e\���#[�;/��|��+i��[�߰�_�ZM*�x\�	UZ�~g6d�
A��P�iW~i~��㟘'U��1)��k�C��W����#���]к�-�St��fRa�~0%���#����7�~3Hb���O�jQ�m�ܝh�@)��zUG}?ɍ{�!���{��9b�: ��syvpp�C�ڟ8��;~\M1%�	ú;X��;[쏉@ٮ�nw������G4�>X�d�>¿,k��ZC� xe��\tx�T]��l�-'d�*�o3�`�S�VL�4\%�XD	�U�dT���>F]v&i�Ve�.���U�[='[=�I��U�V�R<�Ur'="'c�t�SL԰(a5)T�HH)%�+�x����Ly�P���>��2��3�Z4Z�q^#�&E�_�L^[HI��[�ƓR9��sڢ�h�����i��G��*�UZ�5��R�*C((�r:OL��,(TX�K�(���k�
�0��tZ��^';.�SU����z�$!��v=:OJ!%,P�*��
���?��T�y�B�m
i^��._�^�ި�������_]�,z4BD��`8$9�΁]}��6�z/�g���}|�7��>��ID�4	�i𦈜��!���I�By�m���F�݂�+����	1'��c�����$}tdStCc@���
���@�j �!�qBBīpt�^�� �B�j��G�p�	{r	)n>�R�ʝy�<�����m��x���N��D
�c�ޝ�B!~
%l��$2T��x>`Q�$4�o��RO��N�'�$Ni'��Nz��Q����sD��q�"��?l�R�@�2�pA�BҴ��6=|r���ؕ%ld	1K�b��J��c�_�p�j�!t�yf�� y��s������;��̿Zx6WO�EȏIO~%����-6�1	�s�\����T
���$�o#��G.&C�����Нҿ��� �]�,+ޓ� �!m,� ٬'l��_��I��:Ms�����)o%
�ql�Z�=��c�CK�5���!!՞A�p##����RYlϐ 62D}���uP�����{ɳ�$�TΠ5s���	1v��/�h�c�1��ły!�X��0ը�V?�P�l֊�cY��"!��X���,�L�O��R�ǦlK,#��Kܒ�-�mٴm�T���-��6ؖM�i�m��#\ݶ$N��q���V5.5�J��uxe_v��듟a6?^��q:���}��py
*�	���a�J"=��n��H��IYs
R�� #M���pzq
K��3�<o{��y�ۮ��է�����o	R=X��]j�c���K�ԤVm���Yfp��O�T5��[�� xHu?���a�I}9�=�K�,�S�i�)��&�:N�1&�p���gY ��+~+��ܻizH�^�$�iUC�b$���aK�1��U�Z^{Sy�J��~�}b�����<_޹�������R�vPT蛆6�ڊ�n��1	'�\�
����ķ���g���@6pxQN����G}k�d����A�N<5q�:3X�M�s�[���A��@��:��踦�x�34�
��������)^�=��,�WJ�Lm��H$�;Q&rz$�N�ϸ�[��W,,�d0]�i#Jz����.���~���}�˛L�S��񬨋��U��X��Nq	:���xc���VrR+3�L_;=m��J�m
�M�!�;6����6�g��jì	>��#��'c�y��+��6+V�
�lEk�I�1�+�9C��LN����t�	��U�h̼>~G�a��7Q����!��줾�+���0.�p���̞A��4�	!�O�7U�|�.e�1p���2p�Xl��2���#5\�%d���I�eTK�M1P�t�Q��q4���u`K&k�+�9�+sm��:~~��dɂ�'^F�����o���_���J�3G�JTO���*ԕS�Ё��.���!���x�Ϸe�@�z""�M�s�-%�(�I����V����G�~"U�9�V'�0��z�s����+�y=�2=/;�6��u�^۫'W��Y������i}�Av���b}��޺�O�o��n=�QO�$gR��5z*�a�L���8�*�]�|
_K3ۜ�!�6��xwP���Tl���� �<(8ơ�[��)Й+|=���*�f[Ӷ���[�0\����x�XC�4�>�
�:�^&!|�;�P5xa-{"]�
dx�d_�K��ڲP�$������d$���R�"i*��#28B�9�9+0���lr~Ġ�3
c�ѭ��$��o�����N_��G��e�>D 6��/�UJ�/���g�[�݋�e}�^N����n�.�T�����[� ,I����o���PZ&V�f�B��VPP��z�����O��]��� �y�)X��l*�"�w�H��O�J�WBT�~>;�zm������i�����3-�?Ft'Kn=�N��|�4�$�W����G�x�����v
ܩD(�]h���P7x���p7q�:y�
�����=�9"I�Mz'_��MJ4eZ�GE�+!7-�8�f�"�"�T�π5W�ڒ�&�.l��U�\����uAL7�
w^p������ri����M�|r��@�m�O~�<���x�����h
73�I %s�ߦ��B�d�8�٩8B�Y���E�]Q�O�BP�B�P*K4��h}�
���0�9��ɾ��;��~��_hg�Sa�U5�ί&xU�(H�!�N"�9�HF%���TV�" �ſE;xD��=�e�+;�&pd����1������z*�|F��������tYF�FD�,PH)���仝����}��N�a��6�
�"|�E������k� ����ېZA�Վ�H9-���*���[S�����x/�Op�}�Zq
�Gm6�A�7�M�B]�r�B)�/h9
'b00�
�>�A���0TŃv';��I8���&�J(��=~8��Z�NH���dǿM_Czt=�3!B<JЪ�0�d�Hҽb(�5~��
�Q�Ĥwy	�N������o����ĝuP|=:3{�a�`y��C/�[�S���D�|�>a'��1G���w_���(-J�gڀi8�>!�b@Ӻ���|�><�O:�&�S������Ɗ9�<
l��{�%���}�C_�R�f_�"e^g�8�;��	9��E�/("��![D�&��o���v�w��>b5�.}(��<�gǟ��
���������^��H[�j�ӥ�im{>���R'`�$
4��,P^BAؠ-l��9~��3oJo�X��ͦ(�^ �X����T�RUr" T�KP��dڅ�\f�fKڏ}n�-�|����AL�{��VH������iִ&'*�hA
�t]v���4߃�%�ުx�p�������-S��^.U�=ʼLwH�-E�$%��HuN�>ò|�����qz�'���y�dNUWNY�Ԙ��3_O�ȾA��7���Ƅ����Z_�`��^�����֘����`Өi�6~�Hv�o�rl
 
�W4�>X�di�=��o��0���C������æ�j��z�ָ���r�c������wl�[�
���b�ذ4AkEHL,�����#Xu�J�(��V/��稕�@\AR���W�z��,Kl�"&Qc�"��*�Lb�)�(`?>�6cSw�V���J�Qsj�g�-�GHi«��p��WQ�s�R�'�*��s˾㴫���Y̩�j��]��*�en_��Ğ�V�u%���ғ�0^��PȤ�JFC�q�T�BጕUj�6x%�����qVs��xV�hK2NkVm��t�����J�N3�F���C��KNd<����#P3飊BRBN!!������x���td�iUm��5���~�J�w	��o��mBd#<�!&�k�ɐR����|	H�J�f���e�Vae9�tj�	d�S��N���N�f�h�/�W�2okđlm��z��kR��
�[�l8��8&r�d`��Sh��VW|"�$ !�5	�Bh22l˓�ga�P��2�]�Mڈ��x��ک+��]���	��xU/b(����SK]��Xx]���Wj�uS�4%�2��R��y�P�d�T��p��*�Im���MQ��t�g�{�#�@�&�l"*h���t*Z<N ò eNu�39R��)F�@
d2:(K�'�Uޭl�@�f|%W��gu��/w�Vg��4�u�:(S[]T �&ԭ-�FSM�NMa�ڬA���KvI�h]�@�v\��h
�)Z�)�q�廓ή�z�۫��锧�f�Z��N����ը�������)noE�L����	鿋n|'�_�\2��Y���ȴ#K�B�I���yL1yJuN<6��whkݝ�u��1�q*��IύCs��v|^y>�D8����\���l���S�[S����F�UGL��K��:�F͡<���B
�MYN�8�);�/I�O��F.��4����`��Fזf�J>o|�5���I�/�=���?�
ǫv ;�W�j�J�)e�#��T�@҄�*�u�(W`\���U��B��b������/�����
 9���[��L�U�qZ
�8�֊ ^[��qkb";�|��e�[�x�
���-�WS�ڲ�Kۘ��l�%��W��U5[M������Hk�"l��bjU��Ij�ղ��3@l@����.��ub�(�$���- ��I
���BoPD�� 0�"2\p�+�>mm�S��^5թYŧ���G0���Jn?i��G5�3n��\}�Ϋ�3
����cU�:�no��ܠ�v#�oE��:@�G�f�6���B.9Oa�sH��	�� ����������V[d�@m'`�՞?���bi`_��B��;ś�Bc%/�ur�'�4]�*�#I�T֖9n��҆`���Ύ��R1H�W#���<�@4������!�����J7q$��=.[T�4K:��(I��8�f�A�����zZh�:���1�m����c�sar ���s�S�!`��cT�"?��m^��V��~gH��{$~�gG���1q$[	�]��a����깟����i���Z��7򌉿M&���r�f~�ɧ�5�>��
��&����Y��·	s?ۉ
�~U��|��9s��`={S�E�m:�,�>7z�9�~<r�Ζ��[��^}z�j擎��_��`C�ol��\7������C�Űo�UA�͗w��?1$ 3o�`�� 6�+� ��a�N�qZl�ӂN�]����sX��&��.TpVP,������"��q�=���pjk�h��B������#?x�Ǉx����
0;D����f�[�L�ښ�])䚈7���G��̂�ƈZ*(4��Z��I)K�$2��t��hV,?��T #p|�0�&KP]+-_9˿��\��f/-�^=��)�O9Ue�K�w2���R���x\Db��&�D�TM�m$�=�����P���@0��
�m@�(�j�[h8	��[/#�Ҁ*�P
�r��\�m���^Į�2w��cj;�sO��S�����6+���z(�54߸ �Y����#t�75D�zs�5$�6���Vl��[�ݩ����,��$9��@4u@R����ڭ����OiUO��>k\j�aL�l�� �ܐ�g�}����7u�!�U:s�Ag���e�<�F.<�m�����=�ݠRunk,�lG���f[�x��Q��|��O��;j`;�`������4ۿ
_��������7�f��n��ƶ)�zL���R�M\��nR�&£h��$�˴m���6c�;J����N��gJ�\��r�& �]�QQn�*ͣ:�����XI���'��G׺�������"�3PJYd�F�
�O�R�Ҹ���N4��"�ys�,J}�|e(JQk�*us�@��qsGC:�w��$����cF	Uͅɋ��*�y�ڞξ#�	��O0�t&���?���Y)���Gv��Mr�	_�m�9����o2%��-<����D+8&IJ���T�-���Ԍ�`��G�Z���:�W�]�f'�L�V�ֹ0��ްS���/���15��]������6ٕ��-����^���:_�ؿ�
�q��_���qq���q�JʞV-���S��3�I���[Ł-��S`N��� R־j ��c�����+&vRf#q��i�5��ۺ�g�^l��$i��u����������w�7ǤD��z���j�fc�g�|��j��N�3Wz*�y���x�KH6�E��~��[�pX馣q+��Q?�S�F�(<k�UX�fa���4�ף��a�
�ַ�?����x�,�me]��ǰ3�6�#JlX�g-A�k����D���Q�/j�Ld^�ۄI֞�kI��\�I��J���<Pc={��p)���)���
��w��S�9Dޚ�
�7��e����
`�b��2�Z�h	�Z4�Nkuk��2�C�?���K&.�L�A*�"I�!���"���裢�*VBWEW��8�v�_1��ޱqx��=N
b
��Z�k�*�uU��/Z��V����e�d���l~,�m[�9�5�
�\i�S�pr�X�qgd�W.�㙭�m
Lʩ*=��c�,����#d+9g�Yw�y¯�D0^H��c� ^|�γY���'��f�����'��9,-� 
]�iR8�'�
�p9�(�3�O����3���^l��Fgerva�"�m �7u�ĝ7�Bv�SLg��ښ���$�D�Ǵh�Ʊ�m���6����I������Z{#�d�)�i,{
��)UDhiu���C�۩�Y3�"F�����ͳ|@�^8ü07�1 7d 
G?��&Txv1�
d/g'Ņg���㎤�ܫ\eӝ��O�TQI/����Z[�t|��a�8�|�i<��I����[+VNؠ��=P��\�]�I�iڷ�W,߫�M9l�q@)L�CYL��í���vTGr��W��gq��̊:��w�S���o2u�)�pU�F�Y0bt&�QGޡ��֊U���B�S�Ŧ�s�r=��HVb�Fx� �\��m�9��,E7���<[�+:C���v?A�|���   ���}�rG��;��V&� i]<�^z4�q�%��M�)"�n@�"�a?b�p�����u�@�n=��;++++3+3+i4���t��5Zޱ\L���VZ9AֿH�)����k�R��� <9��M�>>DO�>F�tmk�g=���4z�!����WU�"�[�(���\3�H�U��wv�����x,�̕/Fz\��p��������٨_���x<̱�����5�T��X�F�����G�PD����l�ij�<%��T'���w��j@���� �<�� �<�UEv�@����Z��&��g�o2>�^���΁8�|�z���]O�6���s3�`�G���x���郷������� }��9���R:f�~^���g���i����ч�ˋ����J�E�ごO�����Uv3�)	Y�t�UV��+��iXf�:uTJo��eF
(�Do9�����,��gG��'L˛���|5��<XTh�`���4���t����P��$=KT�1�z����d�	�J� �7��υ�x��^���c��
Ç!�w����t]�YOx>�~��_��,w"����u������-�w���0N��������	��7���n�<��?^hf�B�ǘ�Ld�om��:�)��Z��t�}�I���D�V��_��M�Q�9�<�#�ckzZ+/�mEy�Y\'h]��e��%�ђ��hg��س�r=O�
#7��z��|���a�|Ƿ�t6]}�����Kz��+!��1 #�0$� ��k�8���'8}B���ޝρ���0A��~]D=o�{�QU�#!��6e�RI,1F|C�D|L�6�H�.C����9�5<3a=a�!�N�� ���3n��7|�����f��5Q���C���1�밋�b�m[
U�s|�BG�am�
a^�n���Q�HFSK6l���f�h��#�Yǟ��[1Y�}N�
��T>��0"
.�	#)� eEB	����+>�#6��o>�$��6�;�V'���p;c�����.��'S�E/�����-�1��@Fb��K��5��y	�=̄����*����3���=jGS����I��a�m��R{L4h*��/���'4��<�z�`���_��{tjM�ɿ2HCj��$Gl��$+�p)dI�%�a��4�@6m��% �v�|:-*�иP�|V2h��B|�乥W'�a���Z����ل�$_��:0��P��c=���O�n�[2I�$�2���a���7b���z�����*~le�L�J�|e������
�(�c'�'5֊?��;3�t�#G7�(S�2��XM�؝L�W9
S 'S�����S��r�C¥c̏{�x�g7�H<��G�9�C�ô}�l�ٛiu�ѸϾ����
oM;���gݵ�5��,�,�G�j#��b�2W����"�Յ������\M�9��?���f���;������m����|�Ƈ�S>��zEؘ�gC�7	�*�y�7�/g�u��,9��������H'�S?u� p��Sq�uӴ�>"�t�R|�F��ь���
����s����Օt֔Up~�.r�E�5�2�v-r��ی�D�iD�"�X��h?r�֏9n��V"ǭ�C9�E�%y���S���R?r<>%x�����T����.��������ȵ��G�C<�;>���S�=A/�����^����y1��x5��<S��K�ʅ�0�}��x>��9����H8�V��wt�O9zuz�����/��%z�?���ы�	0��
?�c6gG<����>:"�G뇇��vB���}�V���Wt��gh�O�ɯ=�:"zR��&��w�n��������=8dէg3��;2;j�tH��H��C�2�y�I*�[����"���7j��^0�ryi�Ze�{��ˋT�����^�r� l��v��h��=!�S�ˠ�O��-:}z�X�s!A*� /3Π/����^i�"�s�q�h΅������?�~:�uX	� t�w�I�~��8�;�[Bkk|-����h�O��
���y��Q�Z��+��.���Ϣ�/��]]�K�ezN���TN,��UQ��ʦ�40)A�dߒ��`����{����S~��#�c��%�R�-��>���K�LwAy���ca�H�Ū%��|r��?���t[���`�E���|��_Iv������}x��:{q��.~Eg���3�n�X#�C��^�;�u����Oߜ
F����j�;����5�'�+��1D���9�{<�>���۫�KF�߈U8��p��P��q��}�w�
)�����2�s;� ?��YBέ�EB�+٩�T"�_]v�Oh��:��8�Q����)��9@��g��\B��f���{�~���˞�9�����3k�i/;�#���R����a�*=5����|�$� X��ϝ�O��&_�I�D��J�?���F��/钖=�s`����|}��Wt��AIB���IZ�����% ��������	`�S
L}a��]-ZB��%�M~��H���s��(��uf���>x����zG�o&ɪY\[�pg2�;?�%��1f�1;a�{k&Q$E�$��I�ǻd
u���X�Q��;��I�E�V4b�5MEF=Kq2�i:��� ��<���[x�~$��0 §}�K����q.��t.H�qAڷ����`�(�N�n\���nt���Cjg� �T�0M%;'������1� ��\�6�
�b�f�d�` � Al����_�tM�V��n���:��ʶ����%�K�$�&I�T�J�
v���ض�2���B�<��|˓�I�5�Q�}=3t0���.J���:)�휕]ˀ��D��J�?�%������uDҲ�|,{��]RHJ���#_���I����n&u
P5p(g&�+�A�|S��	i��e#5m�����e� �rI	[$K�e��6K'=2$��e�4�b�XR�z��T�n��1��q�,*��$C%�dT4`�N(�N(�*:���nw�V��sO�ʬ
R��@�ҁ�;wBuB�m����������/q��~ɺ�UU
D='  )t�T��a��Kܵ�`�<U-I��i�%I�_�$ �t{zfo
��M�������`����V\xy�4���ݠ�[�lГ7ž3��~����3,�.��)����:Ř}�^m�^!�ϔ^ˤL<^B������i����_0����m?�Z���ˁ*1�)q��|F�m^���7{�L�=�����Z���D&���پ����.6?�@d��gv�``��<+i����u����W���Y�>�z0�A�y���V��dNa"Q�����`�,@��thT8PX���D����d_f���f�7����a� GQ,�S��}A�ǟU�'�=�#{H+1�m�����P���m�ax��ѧx��д����k@��/:��J )Y>|wp�*�b&�=���#eF��S��ݯ�3��,�VRB�m�����zZ����D1(��v�x����Q��ڼ�N�˟N�v�E�n�e>�%��fR$����ѧ���vA��JV�P�1�t9�|�^왍y���R�¾�8��z�m�7�!�/s���w�I�1�u)e��k�0�5����2��n��X�I�d����FV���1��a�<��C:��h�I�*9�&�"����Id=�W�����hU���[/�6�LoޥiV�Pi}I�(��3ȧɷDڵ"�(�<
Y�3��V%\S��D�h�jP�,U��D)=Q)�����\�}-l[���!����^���Ai�{EGp�2��ի���zC�R6D-�������>\��n�!���e�7�����2���w�l�?���U�K$������2^�W���^Fxu)Vu�Mo���*�O��������=x���^'�����=6���Z��v�ٗ�����@V�ă�������ܒ�o�X|^/�^�_$j�~Aտ+d��-f�c���ݛ�6�1i&܄x`����}���-��n������q#:�#79���*�k�t���9�C:��� ��1��o���lIأ_i�g,�_
.����t�E�;�؊"l�v�x�HU���V�)�;�7j�o�ڠ�2����x��N�X@��v��/e`�����HO>�y���jro.�l�@$*^��c�U,}#��uI�Uq���b~d����҈��̢Xio��K(pK���D���u��֣�0E���p���*��֚I�݂��=y��9
�C�>�:je���xS�$�>+z5����11
X����Yb }��t�lM���'��U��F��V�ƫo���A>�B0R�����ڿ�6Z�)�����@��=R�}�\nn(���ht�Ҷ��-3��8���Θ�5�
v��o�M�Rf2�ܥQ�]^Rw�bK~*>X�G����A�n�,&��@;
r�
s��>y-7�|L,g�c�	
nAS��WE����ΗB[M�L��j�gYl��D.f��g���=K��<�r��1��
�(��'�+���c�C�4 N��
� �s_��ȰT9��#�o��V���K��E9��Ä�k�K�p|��/���ut4k�K���=HR�@sti�=i.��1�MFV�35tʕ��J�`%���O�e6��
5G��,��W_�^�R��Q��#��hBR�B����G��'�=H,�����SJ�)%���I~�)'�L�v��S:�0hO,< ����vT.Fx�,���D�#	��d#+�	�X���E t�cH��?R���ы*��3�hz ���=>,���.���6�S��sd��
����Gw���>H#QE"�T�Z�YbnO�|�,
�$� ��X�~�!���p�|�M�|A��U�_��d[�Y~F 	����LȠ.'����Q�TY����(��Z�K��[�Ҁ���'��~]�|�
��6�P�?k$<s�?���\�C/�����L_���Zn����>bz�'�ۤ�4>rcқ��n�K�Ew]�Uu�h��G@� v��L3[�3�\�����WחW,.���T���_�G���r�"����Y��Ă���>��X�Տd�x�O����('Ŕv;?)#�cY�+ ���q�+����Rg�뷧?�^k�l���K����h���O�|\d����xMm֓b
��u�B�������|�p��K��I��Y�-1 4U��"�脃��@Ⱦ1�O����#p{O?(���`@�\�LMk�Y
�ܭ�R!y��>�ǉ�Og#9������gL��OV���9��B���B�>#��1L4��j�R;LN^\�8�l�F�fQE���IT� �fU3���B
��͠�хl:㉐G_��;|bE�]6ۼ��l��㩖�����{n�"���8Z�r|-�uGY,u�f���j���w�Ռ��k����r���[�s��C��%���ҍX.`i�
�+HZZ�/AE>wS[$ų�kg��X���~�B�V�1�p8��ʘ�����a�%�D��OM�Cf�v1-��P/+�R7r���+"�P	�Ea�Mv$b#�p+�'<��H� :�֧�ĴlJ�
��B_@�ZA��In������[����k������\XY'��'��Ǧ)}|@.�V�٤�6����1r���y}}u�y;�}n�U��,�����O���i������j��>��orv��b���(�h��:.�V��������pl�$�<��*��4���%���s_&��q��.j�N���ˢ�}�Ŕ�N��8}�l���R3_pWi������ta31�I�I
fI(�edZR�+������+L�Y��B���6����O`�)�1���y8�P����0�@w���+�=�A�vL�$����$��>�WN.�7r�	�T�ǌ���B��^�a�9�en'�Ф}�LCC����<����DCV��5�%�񩅉�N4��<C�I3�p�� &�$C��1���S�R�N������&��S
#�QEӨ�aT�,�d52��D�Ci��6
���-'n�Kc��~�=�b�)A*�8[M?���b
�>�]���Y�!�8-Q?e�LM��]KOt.�4R��Ēz�i��[>m,uQ�[��;�՚�j#��o	���ָ�H�F=�5���h7�1�dv3�q��f�-__i-_/O#���w����Ϻ�n����r�&	��b=��Z9��Eg�ޞnSW�~@߈9(]�f�
=�G{\�BHMʼd�������7~��?R�^�2
���"�)$�i��Z��GZ�'�SԺ=�G޳��3`ߦ'�U�_������e�,���BR��d���b�Y��ٿǫ"���'؟܌�G�����n?'�go�	EX^0���\��.
��ǾXv
zZv �EQ9�� ���� ��IzKh�-�dL	 w�[H^O@7���^p_'5���h�2�%/��?Y�<'���g�'��l�������2�+�c����=Fq�ޟ�錵^�Gz,ߌ��5��m����a�8DL�/��h*���k$�>���dя1�IS6N7��,��)L~�Te�nQ��{=��a�ڎ	��Ҙ$\@�s�HL��
�(���9?G�]o�治GF���LpzV|�U���M~��K�1�J�pL�G.��Fbd`
t�ퟮW���DeZ��W�"b�P�CB
�*
��$X���s5���y<��X�Б8�y똊S���dYR��a.���t��*��YO�;�ܘ���V�q��m;�,,n����Ǌ�q�f�o5�,P�i�=m���ۉ	$G��kF���eעɊ�`�>�/nW���N�Ԓ1գ��%fڈ _j��证n�ao�'0�aр��I��+7w3@�(ғe����ꠗ�1����zj�:�Q_1�4%⧆Vf5�����D��!�N�dt
�1M����4QS�A�:�:V)��p�����s�\b�/�����Dev���)�M--� m���q��Ӧ`��`s����$(i��:�k�Ri�R����o�����
��r�Ρ�b���9W���d+����H�#�-���u9����6���A�1�3	SD��C���bN#:��a�O��*�h��.�`��T%��c��q����>/�c�a~��kN�V,�M��x�p�����tWj/�d7N�~u�K�W7Ƅ�/���'ll^
�_��F䁕}�L"џ�����}'�D���nx�JXK�;7���w��8��'��/��(hF��Q6qr��]=���+�2zw{V����5�2����T<
�^��L���}q����6��U浼�L�j^f����̟C^f���M��}�z�~���R�hk��4%<!�ˬ*~���-�
�b:ْ��\�3����MW�}5x��B�eȩ ӳ��P���!�����^�-�+����p�^�ߧ���Zl�k,N�����B��r�@�vĺ�9l���蜚�ٰ�h-�;r�U�� �0U��CU+2�֝����A�Q�2DZ�G���_�
�����s��MK�}��Ks�|�tz�'d|ـ�\��m-�D��C6��/��%�&�HCl�/�`t����� ��,TW(��E��l�	����X����D_���D�j������ݸB����Z���6\	D"NNE%:� �-�i)�
b>LK|V��C�:�~���DM>�[�fc�>�(r&�2��m>��ͺ哑ܐG�&ww;�@r���Շg �\8���i�_�s+���+-@�ۀ�go�H:w��o�l=��Ou�M)��v��TeQ�SY��pܘ�2OL�\:�x�8�_�q��p=��kM��EǶ�&�-�?��9�W䎔7i����6����LĩC7-7��<�{FMV�ǵ"i�I��6R��51����I�ߖH7���d3"�X�+�@e�o�M�j�s��%�d�ym6!��>=oњs���^T�If��>0#��i�h*r��uN�OUB�&p���)�\�e��a_>`I��mك�Gw���uӻ��Ejl�~w�w�r��� ���fz����S��<��L]�rNO2��8�W
S~��8�}�V��0�}����L�[�Ŕ���vB��]��ɩ��Qv�J�1�"�ZIm���=��I4a�J�W���78/�q��`�wa�K��VuH4�F���p����kP�M�r[�C�5h�'@�C�ْ�qNn����0�[=[2�{�L�ES��"!F�VR"���HrY0�F���⁡�H@��$�w��g�-_�� �k����C��Ͽ�p��
=�f .��f��j�T:B��K�����G�%�۝6JZ��&d���B9W����.��J�037=&:�@.S���T��<�m�eVЌ/��)Ӳ^�J�7�2ٶt�/��o���PH�I��L���BCЯP���|xM���������,=������-%=�-�*!M�Ro�F�yL�0r��I���.zIF8�^�d�����5~ �������7`
��[�Uls;6p6��T��{@�-�#����z���
V3��Wk"ϱ����X�sX�TtW��G	���p�Ж
b���� .u��Ig��S>9@�m��@Y�W}'ȡ��;tQ]R����g�)1W.g�=��Z�=��o������.Kz;9�N�W��1��'b��Ěu]�H�CG��{K��`ss����Oj��[=�.�à�����b�E���U�a8�'�#�ʫw�e��@�ۺ����̠?�D�Ng=��J�|��-�N�(p�lӊRE��B���}T�k���<A��
o��U�����c4���������/���� �+�����ǒ�? ���+�'ܗ`*�*k��m�UF|۴O$ڪ���n�>\2���gq��H��T��f� <�?��zĜ�6p���#%;��Ly�?�����><�Y��$�r����by�����([�_v`j�p�����~K�h�T>�$h��c�"�^�9Ծ�߬o�mD~��w��+����.�_èW���IV��&x�	p���_![�Y�\�c����<.�� �1�
b��wc|��D'��}s�^��~f�&��3b u�Ϧ�hT��?��݊[��ء��!��X���I�.g���m4|��0���>77�/]��&ǳ�����fG+t���KO,��x�a��E�ì���E/��Hљ����|�G׊�kV����X�3�����b&t��$�@KD�8��u���YF]2���ô�2����:Ǌ�`���)���J�g�S�8[���,�#�]�1��Jn�a��1Wik�א�1g÷�-�Xo'Q�m�;*�?�G��ˌ,�=��#Eq���b�8B@AUk�1�
�t�E�ކ�A�+�[��V7��K<
w�U�c��6e$�3&_���~*�S�Y�N� �O��Iުǡ����N	V�����K_��
����!��eϠG���{�%��)�c�v���ӌ;����u���â��u�=���y���뚌,$�d�]��T���A�??vZ9B���|�t�|[�q�4��XS�3t�� xCh	�ͥ���#��3���X'#�8*��dzGz�0�w�O1�MW�Mؔ閦��D�.2�k,����B~.����k�,���uA�l�q}^N���Е��/��jqV�܂�Ţ!!	Ѝ����H�gٿT<&v�Cǔ��TH閙�}�����#N`���D&�T@�Shm���� �M)W��m�nh?��(�� �!�H��uإϡ7G�dU�\_:�*Z���1p3�kd[hK]e�d4y�Ҷ�!t|��GysQ��R� D��d�.S���:uvUL�^��������@ y�������o>�$��6�;�����Q���r�Om.�s��,�D{�����Cxc���q* HY�αA��BRWT!ꇬ�L��`���K
{��#�6�4���"�$"�Dz&�7�����"~/V"i%�U�8,�R��0��R��	��0��LՔ�`�M�h��
�S�ھ��r��%� �a�ɚ>�CP	�5�j���p�X�h2���.A����7����GJh�H���,���x,�({�NGh2��
�(��p�&���B�c1�7��[���L!�
�C�n25^�(L��L��{�:��*G8$҉$�Yn�����H���B�AΔ�z�qw���&��uW���>7*O�̶
l�»�
�^��0��7��7��yS��I�f��BCC� �¼�ǅx��l��|�^��%9^����x��`o���[����'sq�Y�8>H����΁�
�����B��<�0�67�j��@���m���Ȣ����
G�#X��ؠ����F�nT�t�@0��$J���	�ʐn3 6P����Q�0�]
��&��#^����?�[9�&�X:�.���snJ��.Ҧ��n,\���Siu?a�l�&E�Æj>D����}���.#���o�GKy-��1���ڇ�2vL	���@�*��/'nʷ�|��q���V�4�J�$�t=�q�[�e#z+�o~e�
����,?��h��P��`jFLɟ�4E\lJ꿊�Ρ�KS�R�<�y���BoCۺ��)�)�	=i̜K��	��j��(..�`�%����,U��].@��\=�jl81й���
��*/�h��o�3d��
���-q��F�p����k��oIb�!�jR���p���i���_���6N�J���bp�Ij0�'3����L�iuIk��PR�����b�{ۀ����brny�Aۖ�9�����gA6�k>����8�������%qk���$�;�����Ly�.@
d�)�
�j���ԍ|+'|�{>Yc	{��}X�D'B ��,��lH����˪X畊�Xw�UAY8Ew���J�N��ΫP8��ym�B�!�jQ�v��]�G��q_��t�E��"\0u�E@�m��ȻӳQzyM�w�E��"���QK�t%E��"��J�<u��J��QJ�+!��ز+!R��HW:�O�E���C���J�t�B4�TW�v��ڵ:-���:5�}u>"�Xu>j���u>�a�hu>����:��CW��W�C������|���^��.	q�%�LB�|���;�zI�����.�"?��o��D�w;Ai�m��r�.���ւ}tv��'�����t�E��g�oG�������N����H"������8��FVb�������Ĭ�<-�ge!��%r��oF�
��,�b�p��@)+�4�^�_�Q�hJ_�ۼ�Jh=T��S�t�j��73Ƕ�@:���w;��oi���B����ح׎ҖJ!KER�WGg��q�T$rA�7�d�]�ތ�)D�-�y��nB+�B�֔�v�� Y�;Fz+�eO��2
Q��R�V Iɶ��b��W�-��/I��]U��jT!Zkʹ[��z#+c�#����n��IPo5��J�JS��Q:�,��pG�4�4T�A2�(oF�"��T�HP���@�JVtK�	Tj}
��x �sEȷ�l��F��AWɘpÅ
����®=!;�H�uDs�X��<������
\����4���ߓ�^���~�y���?�Ox_!K�]���oΆ�����{t2^�����%���'xA� ٓ�`�j�+�
2�dg��:���nH�ʃTg��\L�d �Ҏ��рÓ�WF�լ�lb�6d�D�ՙ��l�a����T�%®�4��O���kH�$����E!�*��@�!�+
P}_��)�S�n ن��4@cu�����i.��mY��7W�9l�����ڤ�?Dؖ�k��a���6i
���}�7�t˺0:Hc�&�Sao�uc������Ӎ&�VlY'z@7W2͉�.�m����
G���}
)�֪�k���\ۺ��d[�q����h�wȶ��ڥ�7�֜� o�Ƭ]e�ꊄW���g����b:��O�
����Mq�o�
ObC<��4"eV�P!�z?
����lA�GaWߺ�&��z�-YS5�w�]��� @�q~>�&a�=���{t>ă����������'���}��˟��?/���nQ�AD��IV��,��I���?@��O�bu��ɗo�rRL���KV��<[����}V�����K���h�ʗ�U���wG/ޝ����2׼��b��|ں�M6����h/��z��DW������uA��\��ѯ�t���y�S����E�O\rO_�={w\��^�sқ�z�&��   �� .~5x��}�rG��;��bcl� ,Q�ׇ����5Ip����	4�^h
P��<�G�/<_r2�^�U}�7�ݱ�]�������ʚ�q��������X_N�qs$7�q�i�Z�$��x�oL��8p���F�*X��p�E�E�Lwg��F���f���8�F��Q&��W��,X�o�`� V�`|��clv�$��U��	���	���2Z�F�)E�� ��"�ߍ.�)�䚒�s2�@�(�}�0��%ZݳA�?<"ќ��~$폝�/����qkءo/��
�t�>�`>q5>�txcڎ�6�`�����6$�`	�!-rL�	Ř@s2����
.�ar$;qr
9���9�E��x�)�X���WI=
F�%��͈n�J��kO�L�N�A�3 y�1�{7[ʏ<@N�9�q17��c��;]NȾZ�gF�qcZ�\��I.�=�d�)Y'���*c��5��c�i_���߁S�w�:}�?o'dhd~	�k��o¹�K.W$J�a09���;Ő� T��q�`�F (�~��;�v~���������� ��:<"���� �3:j�dO��r�p,Cr����gbJ@h�8I������$�`��D���
=r�Qc�#״����e��_��I���/�zB���E+����h�
�å��`�ݺ;��x'v;��p��-�5���C\�����e4������f=��(c��g�f6C��@��Mr�A�n�`�_���I�=$�a@����"�<�����@���x��
�Rso�]�C����[�၄��3��[���z�_H�옼k�����2 ��
���I���*�T�Cx/�/�x���蜵���:�R�ޝtR�J�L�цw�h�~�7r���s"�ꛂ ���m��{���9���I�=���;�r�����ST�0�^�or@ o��b4��	#��@m	cM��v0&!*�{�~�%��R��C%�-tŰG@�d��
'�=s)���qh7A2��樝GW��t�l���b��d�r���P�����?TD۸�9�-�r��a��	�l�ω�$IҞ-��6��ܓ;����������A,��.,g��o7�[��es�Y�
�L��B/��4�7���A�?M���iJ�r�X�'��
��;�;cs$ϖ����J-����٠E���Z2��.�ٞ��ʷ�сg!���@YT�����w����;{&��X���r*J�gg�>�
�q2�$���S��w_�������f4!o�aq �a|ϐ���^8��a����@��9�89!0O�q{�.vL�"՞�|�5p�A�k>��z6���8;�~Ϟ�w�r�j��-�95�,0^k{K''�v���z��Ć�;�傝��p�p� YT����w7
��ˠ�!���xˊ�$�
V���x尗�e64J9��&�q���j�������g7�;�y2�SH���-p��g{��!��s6$���^�7Ӊ��"��l���D����̍E���9+fQ�VYI �@�{+ 鍙��x�M���
���
7�6�Vx ��%x���z=�	�	ʣ
JA}�s�����v�N�g�a�<#����@l�^M��+
;۹���@U�ȳ�@䙚 򄐃ppA"<�CU��_�;�^�vً$rJ�&��c(��,K� x6B�"����Û�l|��eR/y�����
��?s��)�#>	F�(�B��n����`��~��;kwO�t�a0x������^|�6[�,�*��G�jf�x���U�r���r;8�r��TZ
�%ң�~�N�ײ
*aw<��������Ce��+p��Ӕ���ɈQ)[�s������֝���ˏ�Չ�I�;u҆>ݬ�Oǻ�v�f�\�X��!�&
A*d�
A*$��C�#��9s�����r�Ehw�QZ&~��)�t����e�o���S��v�e2u����c6A��E�G�鄙�m�U��x}�\F~�N�wr����xg1w����G��e<��Z���G;9��1k�AjE�7=����$��=
�z�>
)�d����@'���82VP����Z_�<�z�$��rܴ6��*�hu��n��2���j;��6Z.J79�ޓ���b�I���g��Ig&�&�)�R�$�J6�P*���H��7�QQ�V���o7����nH�"z��f~������p�v*f�b�T1;Gc����i��4z�Z ��(�r{n��������^[C���|+/4q]i�<�49l�$En��oΜ�^���I��!�/��93�	f[�
�>�>�S���������E�l��<i�}�h}��tq��1ݳgIK��E���d�5��zJt�����e��>i�;���h���/��7�� w��'sx7�
��S��Eo�g���7�+�u2��9�R�ou�}��9%l��n����(�4���Lb2�W�&�
	-c7�1��f�aq��v߃�٨墸�9ٷt1�´R��/a>/Go��a�����i��% .�wΆ#\bՏ��Y��
�qp�7�l?��4�GqtU�w���<�Cu�jz���h:���%��]͇���潵�j�9�����&Ʌå����� Lj���6��`r%��L��'��-	�Q0��q�0�x�.DË�g}���gz9���Ꜣ|	�#��m���AnPD���pb���>'�����?rL�#쇵l��:c^�랁��m��3I�; 
r� ��	�u� l?c������E|цĬ�j��
����Ԕ÷{g��p��b�㞈���s����1����ߡk���>���c�/Q��O(������'�������#&���������7{��o��������K+?"�62�zL��/���ڴx�f�C�u6� �T��TE�6]�����l6I�}��`ֳn'��۰���(qt.����s��dHK�jV��x~yOf}��_���3_>�U��<�]������	��"݆��*�&hRT�O���{�E���|j��o������	��.�9V��1RSDq�M��]��1�-V�o/SKAo$��W@�s7��7I�wAD�4��zE��%��V2H"<�/S�5�3}��E<��euV��Ub��]�3����v��������VNI��\�\׭��m���#� &{`!ŭh��R��І�
Dg�'��~ty-pZ�������Ȋw��Z���ŞX6�{������:Ġ^F�l*�Û�,��d|̯At�e��4�`�S|Ny�^͔��I����+�K�G�`6����y��P 63J�H�*����YB�p�(�kj��w��!���;�H��u4���K,1�_��6��Ɉ�ɘ h~V�46��*w�\��5O�l�DW�M~N�Ž���
o�O� �8��+�u;�#�R��5�|��/��B_J��<J������y���������P��_�?�hL�\�T������S�;%Y�2oJA,�Le��
��2�ǝzMq�d�R^\v��Α�9R_�#%�z�%f�Q�aƉ:�=I�u�s��ۯ�}B
0"��7�>��2�I�+�6��t>Sa���0}��dN��˔���i��B�Bw^�΋�yQ_��=#��Ei�#A�E��da6�$���T�H`��N�r�I�(\!ٙωR
�~�҈�|+�W�m���s�\��Y�sR�ӥ�#&�#��>�?+��4�,�e� *�iK��t'���@he����#8g^\�k�
xh.Z�����S!Bk��2��a�G2_��%x]�JÖ.^����5�!�e9��'��W_��ۉ��'>�a4�T���N�3A����7�⓼Jp�XS�7a���HGOM�Ooɋ�q�Z�z�N��������:��˸Ih�4x�,$b�c��_�;�"�s����S:>�c\MP<����;�j�$}�c�wڇW}��C�y[V�=����Ǜ;HP��k_����q���$�]~
��~��,�Kx�%Q����~��>����29�#s9K]z*��l�t�����,Zy��蹀�F�v�PT�֕2�D�pV�+�aw�W��L�	|��Ɨ[*���F��tÇm���o�k�=%M��&H�:Ё�t�%*�K�^կ��p���C�K��J�<�Y��i/���Z�9�ee2�s0+��bq3~��<��4���O��F�gS���9O��
��B��T*Z�@�

���;=��|,8J��YC:�:֑[���p�f�?����9��G@�u0V���o��'C���ϰp�r�:�+i"S6��Yt��"�# �m'�E���L,\D�(���}!�#������=���b�D։β���n&��s0�$��4	82	 �b4`������`�A���5
&�5��[�z7�7(X _���~N82�a�Y���v�u��;����}syYo��@������OvaJf��^a)_Q�h���O-���g�
����W�������4<~������YSeXH5�"�H�f�Cc�uN�v�͐�S�s^6pl�i�"9�I��p��4LͺS3���4����U4,��H�H�k>Xi=��-e�HKl�7�
b�V�8ջ�;�.w(*)W(�p.o2\4=��07���yn�A��"�'���I.X-:&����C��?��j�m�Z2��m��2���)�rVᔝN�m�:��(�N�H�N��b���-�60)�6W��ʷ��Sl��/�K��[��G��K�g-C�P�G��э��-)'�����?۪����pnN��^�Qc�����(��((a���~�׊m���+6��ݿ�?6�t�Lgg�?�z���&3��׶�9���ؼSk�;��Ϋf�η)��Vc�tcM�,�_�]�	�#o�	�g��s���H�;�f~[�N�t��Gޔ���ڰ�ab��p�\vU���G�n�m-��x�#��o۽7��s��x?6�Zg.�*���C'z��4�$�-*��,�d�XL#Z\��{WᨿMR�C�GܚmϕB��-Y�tF�J��2��'��Hf���m���#��<�ڱ6�U�
.OG�L.~2:?�9���7c6\^��"+_�����B���r�[���w� g��+ew7������{�_桞+��!UFr����B�{��l�jE!�,�y�1���
��u��`<F�_(��ALT����%�#Y�
ο� �8���9�Q���G�
���x���¥�"q�u���ë)]:��)�#��ɈeN�Sm<�N�`g�ӛ� ����~]]��}��?Qrq*�QV���&.�E\"��t҈�	�<^�����tLw�"
we�mٖ�/%�<��r�]�fb�q�䖮���܀P?W�xF#"�8Y!�#��p��2��_��`����n��2��'\t&t�������;��7xj1�6Iq�l����/�Ft����|�/�w,P���y0��?��ɻ�]=Ú���|�#��{���#FR��$�
h�tA�&��\�9G��D�.^�᣼-�'��E��T��Q^��PL�`O����Y��i�O|�^��e)��ox�|�5*�Ρ�����j�2+��N�����,iC ���g(��|�Y0H��ef2��t���`J5��f5�z5���9��4M~9��rRQ7���}�Қ�z�V���?��P��B ���aa���v,_��&m\���%��擊�d�m��QD�(4��=��e0��6�A)�F%z�pOd��n b�ȣZÞ(�F�����M����[���5ܫ��~=�����<C�>J���f�����n�w����1��o-.M�,����$(ݢ�%仜���T�4��S�B
lБU���׷א)?
����2�y�\8�U$��Y�:��M�҈>1��)͸s�7e碃�&&��̿�葓݄�I秵{��x;�h��+�yS��P�5SE�
(񚭿j~=^s(�Z���A�8/�W吪�LU�"��
�ś��8��e��q���JN��v;j��	:�G����/~<���^�l�ޘ��z9��N��S��諭���y]��H�&WႼj7_�?x�����`MB�U~���H;}3''��Ahi��釓��n�҈��"��0�)�׶
~�g-���11M<�a��% �~��6�y2X�p.b_��"�����)�s�I��h�8cdM�G@Η!��3��^��bX�;0��O=-zF
^ү_5��`9	�HM�d���aD&���}&�딡0F��5@Ka��6��@�c�_xފrΞ�h�}����
����bJ����5��rd�Ɨq(Z���f���d0�7�b��L����=.濩��X�P
{���ί��,� �uvo�/�ѓֻ�E���~��00�z���m�d\J��d�7�6������&�R���|�|��Vwt�k���I'�4��h�*[o�x�D�|��pX���ˡ���MѭA"m�1�̆3rl�q�����vh�/G�l���Y��p�uL��ՍN ��x'd���� ���֋ܦ������p���f�o�nG���0D�/�WA�}M�f�-cG�;�UW
jt��m<��1������k$���?���N��4	6�X\��!�����;���ۖ����0��yR!)͗�e��)��d����џ�䌅1s��[P���d�γe��V�UP��0cQUq%����&Z4(��l
���l
���l
�%�3�ŀ�X�b@r1 9⯀�{G��e����{"֕i�S���H|x��8��F4������.���æ���կ��غ�?]JlS�-���iFh��JêΩ)Ț��oOo~
�)c���6�
4(�1�ؤ���T>9�;�Wى棊f	�~3�,h�7r�wr�r?���&9���8����S�''��7x�!�3`�v�s6$ߒ���q�s߷���5�x��{Y�6_��j*�,�d�&O�'�� ��u��<7�{����kI�W�O�ё�Z-u��Ҕ8ڽ��-��`O%2^,�_$�h���:��j٢.DG�H�6�I:O�tXհ
�b��p�u��I3K��'5���C��|Y-X�t���EֲA������q0
�q��/9����R��ёE�1)���ڃ�p>ZZ�l��d�;f
3�w��IMP� �lX��T:�b��.�P�&�#=I�D�UN(����$��k;�_E˙�_��x~�`�UL��]��`fW�L:M$����8y���H��2��9D�΍��#�"Ɩ��ΐUp��1��V�C%)��r�� +q�:9
@�}!�p�cs�˲�i�g���72���}���&�p~�:��ƙ=Jϋw�!�?��&
8�X�����s�e��_�A��(O�d82��U�g8Y/�+�(���`	(Dd��$♂@F�FC���`%�i����U8��s��Ų�
�J�s�M�2]J�>��LD�7u�=�!
�2�Ι`͎�ɂv����	���J6�S�XRuN�åg.4F#�W>¼
Jgڎ�RJ��3��x�V�j�?g�|u�����!��F��5�_�B4ώf-b�W<i����h?���@����nvO��x j�p�@RS`5
�<^���z��� ͲA���U4���z>	�F71��;�����F0<�\�
"���oب�mo���c�D(�t�k�k({�4�tJh���%� �K����e��ٳL5�,�x��u6�A�A�h���ќ��6�?ez2:c��w�_3zA����^$cNZH��5�{��-�L�q
!���W����tY0eŗ�� ;d���R������$؜"&�2s�E�!}���=��H�{g�O�`f�ѳ8�@-,
]�wrq�9n�F"՞�"W{fER�Q=������Z�>vk<O�n��I�T��h��.���UzkӶi��"�]���ۙ�0ݞ)��`��a���
��j���0Z�ꚣ�M���!���.�-��ʵ����?� ��4��mJД�v�"�1�`�p��K�x�֠����X�O+c@̭Ղ
�{����Vձ: ���"��W��}U�ɮa���9��j_~���k�rܥU�m<����Ս�g��E,ϫ�X��i��
g�i|�#�×����>Y�6�@�3��(P+WW�x/��oV wM@��xqvzr�����&6@�N �\��
�z�K
�����
~z7ZR�H{�`�I8J�i�h�W��k��(��4��v@�$ʀ�x���:`^/�$�/T'�d͏>Ű�\� n��� :��#��gx�&�8,0����5`��7g�E=���;Q�������6�%ck���ր��h��I�0M��?�启|��mմ�!���`J~��� ����b��kX���ͣ�8X�g�*��<�'��T���f�R�i}Ⳮy�T�t��#{^E�I�/*`PMQ��O���
��)��o^�O��*���qZ?�Ʋ�&�z4oے�kV2�wl;�l��ة�+8�߲ږ��e�s��3B�
���OJ!]9��M�h^��=�\tاٗ%�����	u9��qO�-6�6UN�r�sq�M�hY�k����Z�5.+e���/g��qn����-1�t�:�7�Ne�li�^#8�
���[�8v�xmsկ*
�S"͡�\s��H�qa�§�,g��m\m�Li0��/���ҏ?�ixNeI<��]����؎9}A�~I��쌿����~�6}�;e�n/�l;j�8�*�aY�U�՗&ķ������g`��lr!�M�*!XVq��'�*��=���:C	�� W~�On����1�����i�4ٿcf�&�̘e�T�}���QpWC��V�xz�?��{�Q�����
���`��>��e˞����5�Es ��)�YǶ+�)�­����~$����L��*��4>��E����%��c���j�3h�od�� 0�T1%�P.����Rfz%7a����ǎ*K��-�R������S�S(�}�S��Y��׾�Vw�oHx��Ί�蓵��Y�	eD��В6T��MM��_�-�&�߻��y���~�l'o�,-����wW�����Yϝ�|N֓���~Va?����z�'���d3�8�O�~��s�L��S��?��!W�]��tb���}�o�bz<c�>��ǚ����7Տ�)�M�7�,��U���&��u\5{G��7Ws�c��i��k!<��`��3Kw�hMz�E�f�\O�D�KV�z��A����̂;n�c�D���9g�u/���,''ϳ��5{��=� ���dd���5�eT�|�RSH'<�^2���L������a;�o?Ռ8l(cO~�y��<k|?{1�ʥ���=�����\��u��{i2���|;1x��\8Ԍ	t�����4��f�ʒ_�f���ʘ��	3��R,�3l�VT���|Z���Xfj����ꅩ�������dރRq��k2�U�������yj<��0ѣ�6���*��V! �:�����\���C�|�t�A���!	p�8�άX�g.?2
�����9��Q���/Qz�~�rkG�*��d�}��`)�d��K�������v������_��`K��R?�9�|���������e���#�Z����jjK-?!7�d�A���2I��p���$�����4%+a�L�
E�4��U�uc���z)�𔏱�1;
��ӯ�7>ކ���wΆ#v�!y���?aC;VBp��g��9�[�Z[�Ѳ��<��U�1o[Mmb���
��V�DЙޒ8��^(z��ߨ���e7*)��]���KmlRfC�����<ܰ��2
�;�94�<�h2�~̿��n��,f`d�w,�Eq�d/�X@�Ybb1�Y���	���B'�E�24��
�]ü��N̋p��P��-N��;��,�<�L��Ta���B^���p�mY�+W��# ��W*G)'(�:#�V&Wk�8�#�� ��_+=��d�/�w�4VB�o'�%V���g�_@S��e|�����M�L/(偿7<���I�wrqzfm�Q�o*�a�o�7W��^ S����>Uc
�8��-�a��3�Nχ�}],m�+!f<�v6ץ����؋�<�N"F�1����P�^G�*I��;U��A��3���C�Z>H�j�8��8�Q�y��#v3�	ou��n�O�aD����<ܯ�Wc�2�����K9&�~�Q��O j�}d��W|?��j��N��; ȷ�C�u6��{���_{�t@�N�zq��u�s�;{� �?u���/ޝt�x?n<�G�!���M��wg��E�Y���{�!��J#�9\�9v� K��:t�9n~h�s����,x��s��n�\���y��7�/���Zd#�5������ڔ����`�wz��@���_�i��.G��s0��#r����?���G��� �HE�	�p���ҩpc�}M/C+���c�� 	ɫV������d�
�U�����ˏG2S,nZl5���ٿ���j$I��
�`/������{5	=|sB���z�W���Ou�l:�aJ0�
=j}��K��G�$1wz��w�=V�1o�d�@��Xa0��6��l�M��\�T������3��Ŧ�����v|X��a���*�o�Oa��K��*�F�+Z�Dl��3-�]ѕ�qu2������X]�e�����uBb-s �C��]����10��������x��˻E�8�_�ĩ��I>��>�K��UW,����j=g�] r�����b������UN��Dք.���$V�.aL�h�G,`�H���"M)=�-��DVnm�9
��$� ����P�7qr�%�
Y��	g��X�˦���(IX��J� ﻢ�?��OW(��=3|S�k�.lg�呺��s���|잓���ۥ����\>�+�q숶�Ɨq<Uc,�k�1c!qmfY�[~E�Z�g�H���3�)Ϙ�i�0��1�1��'}��8�g���d�\��U���NR�l�)�iǨa�-�~R�N��=
ߡ&|�~��M�*_#��nߣJ$-�=�ה��~+<-��������� ��m�c��g�ߚ�,�Z+����l�n�s��c����h�͂O�hO��}��h�1��9_֗�DW�NX�g�"�Q}�F��|�d�I�����������d4Y�~Xr�2.ӫDn����<��4�?��%)�BA�~Ȯ���O���`�V��R\��E3ղ��!��2f�Q^�)k;%���"DەA�~PM"3���C�>���(�Ԏ�8?�8�Ȯ}?�Ɯ����%���ĵ����Rw�v�-��#(p��m,Tn#^�B;�s�0����UjRxF�l%�`�jf��<0Ma��
-�X�Tj�&o�y
`U|I��� �r�N !gd�a!H��۳����LCL�Zݑx���T�� �t/�}M��T5'��Ȇ��:���zs�$�R��'0�̇��7O�y�����Ŕ�1��e����"�ET�Kᇟ�D/�n����Cp@o�Կ+i�h���RP��O$��tϵA�'� "C�8]d��SS
��L��2.�h�Ú��;6²9C��*Ĥp�K�悏_(��)�9�O?[F4/E�g6߻02M��jxф�>���D����g0�Gc�4@Ƒy^l4��~�Α�Y�:�k�iF�/�_t��moÛh<e�V[|d6�e5��򜪎 d��>U�oPĎ��ꂑg��;9�ۤ|�2c-=ޢc������|Y[��|Yp �}����<||1O֋E��C�i�xet�x&v�p��bJ�Ir�R��bh?Y�c�����h�<۷��Q�k�J��8K3�F�1��-���QZ���^�g����\���:������Z+�Ud7�m�эl�Z�\�E��FX$_��o)o�w��i��S
����uf�i"�8�Bf�K2hKՒ|�E_����-�/Z�'otLǰd�Fv]1f�P�q�t�}d+6Fx��,�`Է�j�3�/��i��඙�D�q�����G�24�(R�`h�j!�v�d,b�=���h���Kʹ�С�5��MO\��gYUi��c��D�e�1X�T�[�~+ZPɆY�����C����[r��3y��w*ؔ&����=CФ��p�9�h�V�ï���
o����x%J>I-M��
n̲Q-��Gq_���Wz���o��\i���fI��K�u���E	��in�ΫG�aݤ8��v�T;J7}��/miSK�@�Ï|ac[�z:A��`Nؚ>K	�i=V����Ԕ����D����w�[����q�0�c"���9X�hέj��z��E`Q��|�EYoU[W��Z����:CUg$��.Μ]u2�`�̨���}7U4��a~�­��Լ�o)%�ű�e��1����O�]B�	z��h�U�<[�.�$VE53�i��խ���>�o��'�~�~�
���[����@����2q�QJ�]0m�3 =��7�Ɨ��p����� j��M��b�(�_�LG�����i�>L�ze��Y�����G��2t���PGP���#��b���U�;nB7�%D4�T�K\W�%�vP�UI�ZC���k��V[G>��z��cܤ���rwy�zf�1�^PW1�&X��1���?���
KH��������EG�'���.b|�xl��I"���#��ӜQB��":��Om�8�j���^`rW Y[
ӗ����i��pK��9U�v6��l�
 ����WG�2 �=��ޟt:C�w���+�?������cVZ��xi��>g�u6�������I��Ή<S�&�S ����q����(�|$	��� �i��x D���6����FQ�^t����-)�,ye�g�}�}v��P�����#[��8������ynu��x�1՗�T'�A�Tj���
�L�֏)	m�N*�Y~��}� 4D�1��1*v�)y0�x�^� �YF��5N��3SP�>���t8�����q�عK��̝J�H��5���DC��T{>|�$�７�����K�u{@�*�P$��*pU�V}��O��š���,���g7t��&τ���Z��E]�C�
���[F9t����9�����7�������{��3�d?.�g��͂�Ddِ���g\}f9sE��l]��c�~�
��e�
���q��L" 9�S�{�4�M�c���L�w��0����@"�����S���F9}O��>G?��X��}}�]��)5g� d�3ӕ�r?�s�/]{d�\���d\7�d��Ac���}�Y%ի�O՟�+mZJi�1�6^�i��*e!�V�hU7�hչB����@�ם�	���˦�-ՈV�W�:t6���q���T����U4����e���m���xX�U�Z�b[����x�^�Z�����V������NȷP��.��Vl��ҷ�����&�ʣ�MQ%4E��T�+u�.�&�d|�Q;i,�CR��K�`��k��D���
�R��1�?o�\�T2	��xI�:��18�јh�q��$ ����7�x.ʅ,X�#Ƭ\�>L�#�Ji�qwȋ���?�~�{��I��sz�vΆ�{�|�|iy��wv���|s.
V $���i��;��CӨ['C����m�k��T���;���:kw�d����	�x�[�v��k�+�/������X�Pc����=Ez�ZȩO�Հ=�c�؉7^C��iM�~Q�D_��ј�a���)��i���>]�1�^��?�
f+*�R �NN��*��{H�/����5C`����
�>�i�o"5(*�����TSM,�i�DO��p�g�1;��Z�J)w��N"}+z;�j���<�W#��EpG'��;�ޅ������Q� ��s�P���i��R�A1�B��H��v`I���+wΎv�h��a���`6��������{|���yh(���o)�0���U�b���7���Py �j��3����H�z/�0z+�
+_K��*,پH�"��V1�U|����i加���r����`�J
���Zer�p�c�4X5!t����7�7HMP2Y��O5q5�)[�|(
����!���8@�z�K�Y�Qr#z�iA�v�v�8��&���7p�l��P:򥆹|�3QNT	h�[���$��Np7�~;˹��aK���9�`�᩵��?�~qgyFK�!x.?�lK���������͗�f�����ou��|ίW7��K�z�ݝKSٱs���M�y��´��8�"^.�5	��� tώ;�B4�2Ji;�`�
ƥ���yS�M�gu�]��A'E
*6�:3�r�n�c�OD�tcB��r��:۔��e�5��u�)^Һ�%��Cy��$p��$��E�͇��D��nU�s��5�ƈr���k�Ŝ�S`2x��;c;��d/�=��kb:4W�%�g���p��Á�=�̮@��.l���p����N��&ߒ�ΰE���+܍u�H"ja��O��i;���j���f+�mj���wU`�YW��3��Y�,�V@ni �e�ӟ�U¨Q����,J!K*�r�����,'N�[6E�]�}���}*�)�#�z�i�?b�+3����̩���B~e�;����v¾��*�..�[`�
�����o�wˡ�[�T ���*��`�y����e�����)*<��RT�E��3��W|**ˠ6�2�Uk�*�X�b�w��T	�Ԝ9�
�i�����Sw��%5h�Su7�e�U	d�U1�P�����[�P���8�u
CO!V�C��&��܍S
C<]��v�itM���f]��:�K���%:"��c�p�ú��F���@Pݒ""�u͓����L`��9�o Fɖ0��3��un	`|�x)����X^�vV\�C�A�iF����6��1��`�&��f5��nj�m1!��Un��'�\��w���ïv��-J��q?���kL�!�]x��,uA�T�~V�~*�#���yDU7��Q���aOoC�2�/�\�a�i,٭��ֶ�^@(�Ӂ��̡�S'S&�����o;6��N�|T!��W���&����!��T��]z��i��Xi���.�{15��?'���%����W�����K�
4q��Z�]p�Pn��GbCQ=�6��C���u��3�~���`�KՄ2�����E�o��ff�	6Ej1\��P�4j���A��7��Bw����'X��} �뀥���l٪�r���V>te��ja�6�&�@�w����w��O,������ه̢�Nj��T:��	�"�z��ҷ�Q���|�"~P=ϑ���w���9���x",u�s��
Z���|�=9�6��������\�i`�n1���xʗ�g�?��{���z'����9��W�h�D�弿l�x��~ȉ�l@؄��O��tQ��!��n_$�;l*�=�/�+����W�R. �IX`ҍ�q���_��`,�km~
�\�H��Ϙ!�{ЩQ5�g�%;�~�w���=<|�ⵇ��� ���~
���1�`z����[�v5��/:y�͎����7��@�X�݂�1�����W6W�N���&`]�ԘN�܅��(Q�3����� �}g	X$Xųh��5�M�-�B�"�`4�Q�t���j�Vr^X1Q�^J�.u�NW��&�oӼG��������n��Yo0��|��v��]�
Qh�
n�^�YyqXÆ_��jzG���$�
֝����u�Z�J�y�8]�F֖|�#_�I�~P�v�`6�>H���CV��P��Mk�!e���u�*���qTKySe`��*�Y�Zu�L��Q)4���yY��
F�����Dz��Q��Lð�쮳�]w&n�s�#ڌ2[�&*Gi����]�. b���Y� �r 鯽uO|�z�K6Q	�K6/��8R�dώ7��T�|M���lƠ���y$}sO�ء��>k�5x����t�-|2�
�LA��*�m
ӡ���鐣0�o+��W뿕��Ώs�AI��m�������\���v�����  ���]�s�8�����5�5�3�I���T)�ҭ���革�]-Q672�&�$ީٿ}q�A )K2���!���?< ���3l���;�8�7�P���Ի�s��7��
k���R�)��e,C|���Tw�t�=��VG؎��ba�sF�I0-:tk�B�wT2�� ���#��Y>s�ܖTV�X���Cek��4�$�F|�?�hɂ�eJ%ɨ���"�Q�D�(t$�P~��n�L㪯\��Z��z��3�g[pUT����wf��	r�{�S��5�b�+/X��8�mi�p����ݫK^��:�*Aq�8���Ut"����ȅK�O��U�uw�-���Š�rn<�$�&
���(����V5��v�TK��G�z�R%��R%�R�J@������+J��[I��Ǡ��bM3H���)�#�'�O�!� �9��� �,��k�7�`D� ʒ���fք�r.����?�#ZC���[D�N/�-хD\�^P���J��7�i����*�f_�}�3ˬ�Q�P�@�L�X��*�<�+\����@�K�t��$�y�U�U��So��i�!��#�dM�OL|�#'��{
ְ�@']ޤ�p����@S���+.i�������P�2X��7����,î�Հ�=P�C�D�Lw��0��!\�NۜM�rN`�g/z�D��S� �p1�u��	�qq�g!4�BD�q- i#t�-?B	��4�2I 5">z� ��>qNlP9��|}x�J�@��6��JQ���v��[xe���͘���`�E��'�aD���>v?
{��/��^"G��lI�{s�@�;Or��Z2��dŜәt��gl�fN�I&�O),yu�8��?���J=��Z�C���^�%������� ��`��g��`���js��97^g\�u3 o�oܚ�	p�A"��$ѲJ�
TD��"ʌ���s-Ҝ�ԗ�H���0
�;^(�x0�C�O��Rو���hX'I�c�s4,�Q�]/�7�5��
�,�����,�	: $� h�x[�b5pj��fE��1��q2	��C[���
�i�x����]����6I0	��#Nd�cB�P����
ja\��S���!��SQ��AF�H{���E�$��G�\MYD�U*����
���+ K���q�lQj�������+��l�dA��l٥�G�־�YY�"q�}ٓ��fHԚ���ڳ̆B�ꦄ���
���y_�d��1���셢>^���Z�Π�|�5������v�o�Jn�cP����McçAO�_����E��;��
�����_{���\��� ���,���Cc�o�D�"'vM-Fǐ%8�
1�rǳ,0
���Ul,X'�1b'��A�͏���G�D��^qDo|�?B�Dq|ǙY>��������N�� 4ś���'L����Z�c#{�Y��b��o�:����s�Ƅ�+��	_0����@ Xd8{!����d|C��]��м���Чw� ������� m�0�h-�ł�x��e�v���B���� �&Q��HN��v���~~8��P�Xn����G癡~P�MP�R��P�_|�ߌ���J���������<xЛ;Ԟ���>؎.`.qh�0��7
wGӦ(f: F�!���|'A�#�f Q����mQ�
�k�%�b�-L�=�xB~���
�Hk�]���ה���!��C�rL5�A��}y��^��\�3#S���D�R�ҸTgbrjEb�H�����;����}8ՂM��m��b����T&�)I�c�Ϫ(��{
��$G���&-�]tU�l_{�n�>���
��)�>L���	J�xx�Vx�؛�Pv�Q�DOe+C&2�a��t|t���X[�ҳ�ޡ]�R�Y�����P��sD�D��O[�H����$�2k*w[t�+7�Zz.�A`UEe�?��m:�J-�k�����onG,��=�&iW�t�d�P�����8g��X��3T��P�"����u���Z	���Jw�K�SC�Z<s�R�T+/m*��8}Y*p�q �U����ab�Ϧd>��M�|�u�|�=~[K����~�}
a���mC����K�����M )ٿS��;��)�Y�犱��;5F����:����=|�#���O���i-�>lZ�<=���j�H����+����[�ϔ�R���=�lzZ��t�*�L��s;�r���J��=ѯ��,7g�F�๮�cI������Z��n?����8o?ɭ����_������̯j�E:��F��������
�[|Rd'���y����U;Y�f"��D6=���� ������Y�$��ޫ�����6���O�5��<O�]�u����&KG�u�ݧ���IP4e���3�D�ظ0���VĤ���	�m�ih�[I�bI� �q$
����b'�
�j�kE�hQp����U���A� -Xa@I�Ou�a�ҙ�s)��Zq��U\��ha�vK�ƢM!��]��X�J�Jh1BX�,�F�Цjy��D7FL���lj"�Π��=���޿���q_�O�2*�C�x5G�)�:�:EQ`l(6����`K����ܐ�+�\��t`5�De���qc�;�2y���MI��h&��S��O��07�潨҉������¶��ʷ�|7�D������Y%p�8]9��ݮr�9"���\���%@-T%�UUI�,�6��jІ.	�f��m���������.��&3��l��6��b��c����8�+�#�P���$�Ѩ��Fz��C������U���,�Ln"����P�j@%~��gt�&B5�	nMU"�ܖoI%��g�Y�V�f��hk/Z{�ڋ�^([R��h�e��7�mQk�.N�k�м�{(�0�{�����f�,�@ş�0(�{�y��Pi�a\k�=]�t�Zn�tų��4�A��^6E�7"�Ց���է����k���/��>����{�vg'���7����
�FA4�@�
l
�s4
��$Z`���y/^6"��`����������x����!x�v5'ԧa�Kָg�Ay��('89��>MԣI�',q�!{J�E0)�(	�qB3�i?���-�s�>˕~-<Εy��k�|
���h�o4�ÈR�Q�(��E���o%2>���6"�ҽ��s��}���[Ys�`':�dZ��v��{8�0/ ��ܙ�c8����r����u�.���sǲ�3h�``���6�4�^x<O��g���|9�_�&|�H��]���Qsh@�*�֦2G;�f�^���v���A���7�c��!�6v ��oa"�xꍓ8M;�=�OB`��4;�3Я�t.�{�b��LX�� +�S��w䇸�y5��`Ю�o�/��Y<�L�L���!].��x�\un�.�������c6�
50"�z D[$��-�k���T���P��f���	لB���4��)����ۇh�y��w~uyݻ��m$b���6�g�
�gv����s��{A�J_,d]�o!���?'Ef1
���Ƀ*U�$X��,U�Eoqx�,{��7�����2�󩏁���;�A�|)ߠ�,���5Kպ-��kjj�R�Ȭ��%۾�|�f`�geo���+��`g���E_�$� ��3��r<^Ωo����6�
~�L��.�i���Y��f�Q�g@� ���/��s`P�fAdt�K^��R*I$��qbi��_DK���0�3^V�\�,��Y�O;�w��5�t�cF,�8����߆�������CTB<���W���#Ix�>^?ً0���,,�@I���zk
4~�	R2������>����ӭ�^o=�R�Z���O	�г{ FE��^���@�/����k��x	}{�D��_��h��ζ؍��֢&anZ{`?�o�!r�x��#s���KX��jkm�$���J��L�d}����{?�B�X�"�����ޠ*�xEj|~g�a0�o��K^��
ű�vh�Pf\�$�;�����%܂��Uُ�����ߘ�9���r{�GK��
��u&�.k������/�Ij ��-A�0���o�d(�*K��2_�{?�x�oKX�-S�l�\��"[��l�bO�l�>���$L��|F"<
�����0��pB�@cN�� ��漇��-?g,>�?�	�y��tF�Idt{@�߿��������V�a9�eC<�Ԅ`�<`J�D�Q�L�lqH;|P�<x��o�1�9 �����Z-7g��$m�d�ui��L��z׵:]���f9�,x�ƿ���;��=��j/S�+��Zq�q��F>�!�f*�����F�lŇ���(�uc9���D�T�i8����ۊo�N+�PuY��:jRwv��yP6ɪ���>Q�W����ZzR�U_v�ä>��Zϙ��B�쬄�N�ꖺ��-�t��U�@5�C�ܽ}� �5	�gN���Y��'�G�)�g}�����!�wV�9C�!�;�#M�D�ޔ6=w�ٮ.y5dg
��P���ԃ/�4�̀\�r�Jl�G�yB��#̊m�������%�>W�����Vl�kZ�s�YƅQ
�Å)�Y�2�O{~�-��tbk�N��H����(+���L����Y��)vI���s��*��ː���'_��`�z�Iu���z�Y��\��UQȐ�
^�z�gCEW�
� �/������u/3�6�
%:���E���*T2��B*��J�ݴC����ڹ���wxK����p�yﺋ;�$P>�C{�vI�s��i�f'��)��r�ק�6��ߝ�93�|������o)����am�k�S�,U�xא@�)�잻n���s׊�;"���ݶ�+/I[nex�d��C��%Ji."f(��-Y[�.�9*�ڣ�UE�.ַO�S�T��I�+[i�U�d(��I�L�Q��%񪒥bu*_Ǯ&�5���\GCYh����)t5�Ef�u5cך��B2l�c��X��h����r�9�o�Qn*l�TX��5�+k`-�X�l�I�,)!j�5Q���r�Ҧ�b�(j��S+g���E�.d����ىF�Q�t�NK���j��Vd+T�PqE��t��R���V쮎��R�8%�U������XT����G+]ٔ�M�Y�˄��ٽ��o�ز��0���&�k�xkc�����̊R	�6��ب�j�D"�=k���щ"�=NRy�Zs�Ȏ��>�~w���c�p�vY�rE]s���r��@�d �@�Ĵ7���
�B�� ���[��D�K�u�G��0����z�|��|�0�0�ެd`�~I=C¸��	�	�R���f@6:�W��1��J��+�p&"[�0�s���Uh3�����$���-6��yZj\�z׽�_/��]��rp�d'G���wryW�'S*<�W��j�E�A-��dX�*����b4#��Y���0��дh��*i���\z=q���q���_���jt��?�x$�G���e5�A]��jX�R�QRzG߭�ee�S��F�,� �0p�vW��T�IX�f�B�G� R�N,T)���8�QS]�Q��ERl,)5���ɥ��QX�fp�1oVULO?E�lU����*!���h�=��ǫt
����:��e���׺�j��W�3�˅nZ-���V.��ax"`������YoWk��o?�|��oe�^j[��H��vz�z�h7h=�O�qtV����4r�^J�}�,�j�x<f整�'ʨ�U�ޞ��w� Q�����$_��ю���m6��N��<�4��q���~����wzyq=��F��ߝ:���%
��;Jj��F����I����&=
�F���4ۜ7ϥ�����b���E�JC�D�����@��`PRXOOe5��~�������䲡+F��ũ��Hq*0`׃��ՂT>U�B�	T��<��]&��*��y�J-/4��,`(Z���V�$ѧ�സS�o�(�7��Z#NkVi�檹���UHa���Z�ZdI��[��_u��\����b���=Y�.OF�(D����%�UQ����2�d��d�4���>I�h50-r�<#t���"��Z�F+i�*�����%�YO��d�(��ğD�������c][����6�*U�I�JU-N�Tp�ў�eC����V��M:V��t�ԯl�&v�R�%
'��:'��N3�����zB!��-\܅�����G���4�1[O�5z.���C���
(��3;c<z����^>�}�5-�Xe�s����X�1�����}���+�@5���:h���r�[�Шĕ�Ǭ����lq[�S^��Bx���s���@�Zz������!5-,�:*��H=�4"�����(R;]�
*�5YM���6M��\N:��imeT�vc��W5Ce�e��X�m����nz<�2�Zm�W��
��5s���@����ˠ{����Uop�����Z�(����!���.!iF�*"H���`�1xG
cY�#�x���=:�� uӖC�5\�#[s5
���6��.�T�k�l��,���I��˪yvzy~޿����y��;�Fu��zg������Woz�� ��	 AUh���a��3���F��"�{G���;�'^7��@UY/��KΘ
q��a'�UaC�}X����>���}h��%���$������7�o�eҙ�`�f�i8�ˣ�,g�eBo��������i�ׯ��B�o��s�~	iþ���G��:P�>t����q�߂�~zw�_���q��of�e$:#�$�+6�3LE l�C����ǀ.x5��j�l�OR 2�,�SBtNm�4�2�p�>�6dP�o�@������~34ʿ��F TRG��v�
 - i�I�-��>��Y��q�˟�;
��q����w~tLذt���<@6�}e�?^�̛&�=�W�8AP|Ꮗ��p����<U
ϓ }8���=L�
��^�V �L%
nѤ�V�m`�A�y�	������.�M<�6	Ӱ����{B���?��8M;� �A�ty�k�����qЫ��E|���UŰ�E��~�@̒q��Έ����.g`��p�·����$�@�7M�e$k�s8�t�(���^_ �����o= 5���5�����8j��Q;AD�{�z��{D�w������7x�����w�<�ө?K��=TL��aA�s����a9�C��Z�Ò�7E�s�-z��XHB��'�6'���M�~��A����� ;�^^|��k�
���%u�@%�����f������;8�]�μ_{��ڋe�z�U
c��,҇0�?
�&�����߯`�C���,���O�S9����z�����#�ip���}�s�=��٧��/��Z��� �=럟F�πr S�L5
ϺC���B���GW��5O���rJuV��^x;����:?�������;��c����Î�ZD��vW��5�����҇ēs�]��aAw�,�����y]�{0!�3��;��> B�Aѕ M�nM�t��� 9�e�@+28́���\�(���iD�y������w��;�y��I���jz�g�\K�:O��7�k��?�o��9��#Vr���%В�L.�D���\-�.'f|�.56��d�(ֽS��'CJp�,G
$Grv���E���!�2�!����3�����9 �C�y��)�	RH�(�X�f���U+N�� H�efE���* X�{����v@�8$��%��X1Æ�6�a��ñ������D(7p��g�7����n���5�>ʚp�Hsk�kN���Ǻ��:�2�f%��͡3wl����s=��x��l�~�<��IZ:m��c�1+rD5$t)��]�Dй�S�/�&�/�K��hU~0]�*_�����*���V�,K��6�K@��ϋ�y ����kV�����4 d`�-l����>燿h�����99:��l��7����Ա���s6sU���Ǳ�F���VZ�7���]l$s�Y�IVj,��F��+PZ��5���P��7�vCu
��,36�����3������E�=�I�v�r!_����	!�4a�L���8Q�C��Ck&-W��� ��m�/��;���@h�W�
��i�+*�i�\)S螙�G��Fv��ɵ��������$�:$Rnoņ�G�Fc���q�P��=�Y�g
�b��f-�6t��ʢ�v�=�*�h/���zד���[����۹e5jw�L���yg��~�T�fW��j�Ji��Sl�Q��u�׫�g��j��J_U$s�TPC4k�U0Ҹ��}r���H�zZ�;�pt�.C^��?�ȕ��������
�� ՕGUŖ�&�$��L&�t$P�'
K�Hw�P��� ��"�,W'E|�N��6H)E����0�q�N��s�ϗ��,�b� =��s��G��>���e��@����坟���#���򎥪�a9�k8�>��>͎t�e�;�
���?�qq�ai:8�W煭��9<^�S7<���G}ه&pW(�3o�3� �v=β�����n��ִF����FvvmM� �;klF��t%M���:�-AF��I��%�UO�e�G�V �o-�^y�&�&"g0��9�)]��5~�����x8D�4�����������; �.�|1�p�D������v���Uk�j���n�f�2�1FX�cF�6�	��0�:�������+"F����j��"�Y8�[J���`�;�x�� ��d~�RJ:�n0�NK����^�V�n3��<��Μ���z�הY���r������Q�U.n��f��j�X

6�l�C^��b��1VjTj�:�i��
L+0,0�%h{+��h᫓a��c�X#��C���q��N����"�ԏ�
�[gT麾^�t_/U�b�N��򌹬��:�kv
�u��N��ۈ�ʣ��TL���`*����P�OS)Xg�p��`�,0��ij��^�DE���0`���2��Suq��v��V���z^e�����L�.Ou^-��J׬ķAQ+��䶒� ��el嫕�Ƕ�
:�Z�m%��\7�m�mz�ܦ��ֵVX�1��,b��I�stK**!�!y��j�^m����T��ꢵWQO�ڵ�'e�_ԓ2w2:RuO�|
U�������N��6�CH�塴�u�K:�VM��GfC�<V���Zr��+�nć�U���U�N��K�P����[����0 �7� ]�5��SgE��~#?�:Gc� ����A�v��[��*�V����ʿ��v���V;s�V;��y�м�
�V��ʿU���o����#۳�l{V�c��Zm�T�fK�t��-���n�T�˅k��^͊Zo�fE��O���ۥ���=����RF1r�.�uM�i��y�:Li0�5m�m�@V4u�[�n�v�*LY+�*
.��)�6e� ��Z`��Xm&��1��	��LZ�p+�փ\'��P�B��\i��ͬ�����x�y��t���F��A�nAj��"�vg���u����v�g�����:]Ҫ`��M+(gZ�>6�u����K�$ϰ��IR��TP}R3�l�Q3�l�Q�	�8[�F�Z/P�Z�Y��/c����F3�mp��	��,H5-����k����ͽ�n'�
.�[9n帕�F/�"֊�S��  ���AK�@���=y�U�C�RrH+]�P�(*���5�&�M���&�}=�Bކ�y�ٯCwХ2 像�c�8�b�ڃ]�	�}q];��}�<<,���)��r�r!�)߱rV�����V�VW��r�}��N��鰩l��6��`�#G��`�������p:�P|������I�Y�^��
IY�08�>d�p/��F�V�����ח�x���<=��ᩨZk�TT��v
Uw���b��:���-�mj�~�65F3g�	��D_�{_����w�N)����cңX�Q���Ǵ�G8b�_���ǽ���*m2J�˛�t�Ψ�?Lyf}mԇ}�B�N'6
�L��M��Kh�ެ(���}y�n.��
�[:�]
���uJ���ڠ��jc���~���#]l  �� �L�