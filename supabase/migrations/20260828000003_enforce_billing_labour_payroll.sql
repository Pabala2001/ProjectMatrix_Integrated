-- Migration: 20260828000003_enforce_billing_labour_payroll.sql
-- ProjectMatrix Phase 3A.2 -- Enforce Billing Access on Labour Payroll
--
-- Corrected migration guarantees:
--   1. Existing authorization and SELECT policies remain unchanged.
--   2. Billing enforcement is added through restrictive write policies.
--   3. Payroll rows retain authoritative company/project relationships.
--   4. Entry writes inherit Billing and tenant context from their parent payroll.
--   5. Every mutating Labour Payroll RPC rejects read-only Billing access with PM001.
--   6. SECURITY DEFINER functions use an empty search_path and explicit schemas.
--   7. Existing payroll workflow permissions and status transitions remain intact.
--   8. Excel registration preserves its live arguments, defaults, composite return type,
--      generated_excel_* columns, storage-path validation and returned payroll row.

BEGIN;

-- ============================================================================
-- 0. FAIL-CLOSED PREREQUISITE CHECK
-- ============================================================================

DO $migration_guard$
DECLARE
    v_relation pg_catalog.text;
    v_signature pg_catalog.text;
    v_required record;
    v_relation_oid pg_catalog.oid;
    v_register_oid pg_catalog.oid;
    v_register_return_type pg_catalog.oid;
    v_missing pg_catalog.text[] := ARRAY[]::pg_catalog.text[];
BEGIN
    FOREACH v_relation IN ARRAY ARRAY[
        'labour_payrolls',
        'labour_payroll_entries',
        'projects',
        'company_members'
    ] LOOP
        IF pg_catalog.to_regclass('public.' || v_relation) IS NULL THEN
            v_missing := pg_catalog.array_append(v_missing, 'relation public.' || v_relation);
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY ARRAY[
        'auth.uid()',
        'public.verify_membership_access(uuid,uuid)',
        'public.company_billing_allows_operational_write(uuid)',
        'public.save_labour_payroll(jsonb,jsonb)',
        'public.submit_labour_payroll(uuid)',
        'public.approve_labour_payroll(uuid)',
        'public.lock_labour_payroll(uuid)',
        'public.unlock_labour_payroll(uuid)',
        'public.reopen_labour_payroll(uuid)',
        'public.duplicate_labour_payroll(uuid)',
        'public.register_labour_payroll_excel(uuid,text,text,bigint,text)'
    ] LOOP
        IF pg_catalog.to_regprocedure(v_signature) IS NULL THEN
            v_missing := pg_catalog.array_append(v_missing, 'function ' || v_signature);
        END IF;
    END LOOP;

    v_register_oid := pg_catalog.to_regprocedure(
        'public.register_labour_payroll_excel(uuid,text,text,bigint,text)'
    );

    IF v_register_oid IS NOT NULL
       AND pg_catalog.to_regtype('public.labour_payrolls') IS NOT NULL THEN
        SELECT procedure.prorettype
        INTO v_register_return_type
        FROM pg_catalog.pg_proc AS procedure
        WHERE procedure.oid = v_register_oid;

        IF v_register_return_type IS DISTINCT FROM
           pg_catalog.to_regtype('public.labour_payrolls')::pg_catalog.oid THEN
            v_missing := pg_catalog.array_append(
                v_missing,
                'function public.register_labour_payroll_excel must return public.labour_payrolls'
            );
        END IF;
    END IF;

    FOR v_required IN
        SELECT required.relation_name, required.column_name
        FROM (
            VALUES
                ('company_members', 'company_id'),
                ('company_members', 'profile_id'),
                ('company_members', 'is_company_admin'),
                ('company_members', 'is_active'),
                ('labour_payrolls', 'generated_excel_path'),
                ('labour_payrolls', 'generated_excel_name'),
                ('labour_payrolls', 'generated_excel_size'),
                ('labour_payrolls', 'generated_excel_mime_type'),
                ('labour_payrolls', 'generated_excel_at'),
                ('labour_payrolls', 'generated_excel_by')
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

    IF pg_catalog.cardinality(v_missing) > 0 THEN
        RAISE EXCEPTION 'Labour Payroll Billing migration prerequisites are missing: %',
            pg_catalog.array_to_string(v_missing, ', ')
            USING ERRCODE = 'P0001';
    END IF;
END;
$migration_guard$;

-- ============================================================================
-- 1. RESTRICTIVE RLS WRITE POLICIES
--
-- PostgreSQL ORs existing permissive authorization policies, then ANDs the
-- result with these restrictive policies. This adds Billing and tenant-integrity
-- enforcement without replacing any existing authorization or SELECT policy.
-- ============================================================================

ALTER TABLE public.labour_payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_payroll_entries ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1.1 LABOUR PAYROLLS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS billing_operational_write_insert ON public.labour_payrolls;
CREATE POLICY billing_operational_write_insert
    ON public.labour_payrolls
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = labour_payrolls.project_id
              AND project.company_id = labour_payrolls.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.labour_payrolls;
CREATE POLICY billing_operational_write_update
    ON public.labour_payrolls
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = labour_payrolls.project_id
              AND project.company_id = labour_payrolls.company_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = labour_payrolls.project_id
              AND project.company_id = labour_payrolls.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.labour_payrolls;
CREATE POLICY billing_operational_write_delete
    ON public.labour_payrolls
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = labour_payrolls.project_id
              AND project.company_id = labour_payrolls.company_id
        )
    );

-- ----------------------------------------------------------------------------
-- 1.2 LABOUR PAYROLL ENTRIES
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS billing_operational_write_insert ON public.labour_payroll_entries;
CREATE POLICY billing_operational_write_insert
    ON public.labour_payroll_entries
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.labour_payrolls AS payroll
            JOIN public.projects AS project
              ON project.id = payroll.project_id
             AND project.company_id = payroll.company_id
            WHERE payroll.id = labour_payroll_entries.payroll_id
              AND public.company_billing_allows_operational_write(payroll.company_id)
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.labour_payroll_entries;
CREATE POLICY billing_operational_write_update
    ON public.labour_payroll_entries
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.labour_payrolls AS payroll
            JOIN public.projects AS project
              ON project.id = payroll.project_id
             AND project.company_id = payroll.company_id
            WHERE payroll.id = labour_payroll_entries.payroll_id
              AND public.company_billing_allows_operational_write(payroll.company_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.labour_payrolls AS payroll
            JOIN public.projects AS project
              ON project.id = payroll.project_id
             AND project.company_id = payroll.company_id
            WHERE payroll.id = labour_payroll_entries.payroll_id
              AND public.company_billing_allows_operational_write(payroll.company_id)
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.labour_payroll_entries;
CREATE POLICY billing_operational_write_delete
    ON public.labour_payroll_entries
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.labour_payrolls AS payroll
            JOIN public.projects AS project
              ON project.id = payroll.project_id
             AND project.company_id = payroll.company_id
            WHERE payroll.id = labour_payroll_entries.payroll_id
              AND public.company_billing_allows_operational_write(payroll.company_id)
        )
    );


-- ==============================================================================
-- 2. MUTATING SECURITY DEFINER RPCS WITH BILLING WRITE ENFORCEMENT & HARDENED SEARCH PATH
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 2.1 save_labour_payroll
-- ------------------------------------------------------------------------------
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
    v_stored_company_id pg_catalog.uuid;
    v_stored_project_id pg_catalog.uuid;
    v_current_status pg_catalog.text;
    v_existing_payroll pg_catalog.bool := false;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User authentication required';
    END IF;

    IF p_payroll IS NULL OR pg_catalog.jsonb_typeof(p_payroll) <> 'object' THEN
        RAISE EXCEPTION 'Bad Request: p_payroll must be a JSON object';
    END IF;

    IF p_entries IS NOT NULL AND pg_catalog.jsonb_typeof(p_entries) <> 'array' THEN
        RAISE EXCEPTION 'Bad Request: p_entries must be a JSON array or null';
    END IF;

    IF NULLIF(p_payroll->>'id', '') IS NOT NULL
       AND NULLIF(p_payroll->>'payroll_id', '') IS NOT NULL
       AND (p_payroll->>'id')::pg_catalog.uuid
           <> (p_payroll->>'payroll_id')::pg_catalog.uuid THEN
        RAISE EXCEPTION 'Bad Request: id and payroll_id must identify the same payroll';
    END IF;

    v_payroll_id := COALESCE(
        NULLIF(p_payroll->>'id', '')::pg_catalog.uuid,
        NULLIF(p_payroll->>'payroll_id', '')::pg_catalog.uuid,
        pg_catalog.gen_random_uuid()
    );
    v_company_id := (p_payroll->>'company_id')::pg_catalog.uuid;
    v_project_id := (p_payroll->>'project_id')::pg_catalog.uuid;

    IF v_company_id IS NULL OR v_project_id IS NULL THEN
        RAISE EXCEPTION 'Bad Request: company_id and project_id are required fields';
    END IF;

    -- Bind an update to the payroll's stored tenant context before authorizing it.
    SELECT payroll.company_id, payroll.project_id, payroll.status
    INTO v_stored_company_id, v_stored_project_id, v_current_status
    FROM public.labour_payrolls AS payroll
    WHERE payroll.id = v_payroll_id
    FOR UPDATE;

    v_existing_payroll := FOUND;

    IF v_existing_payroll
       AND (
           v_stored_company_id IS DISTINCT FROM v_company_id
           OR v_stored_project_id IS DISTINCT FROM v_project_id
       ) THEN
        RAISE EXCEPTION 'Forbidden: Payroll company/project context does not match the stored record';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = v_project_id
          AND project.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid project: The selected project does not belong to the active company';
    END IF;

    IF public.verify_membership_access(v_company_id, v_project_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
    END IF;

    IF public.company_billing_allows_operational_write(v_company_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    IF v_existing_payroll AND v_current_status NOT IN ('Draft', 'Submitted') THEN
        RAISE EXCEPTION 'Locked: Only Draft or Submitted payrolls can be saved. Current status: %',
            v_current_status;
    END IF;

    IF v_existing_payroll THEN
        UPDATE public.labour_payrolls AS payroll
        SET payroll_title = p_payroll->>'payroll_title',
            payroll_month = p_payroll->>'payroll_month',
            payroll_year = p_payroll->>'payroll_year',
            period_start = (p_payroll->>'period_start')::pg_catalog.date,
            period_end = (p_payroll->>'period_end')::pg_catalog.date,
            prepared_by = p_payroll->>'prepared_by',
            date_prepared = (p_payroll->>'date_prepared')::pg_catalog.date,
            notes = p_payroll->>'notes',
            currency_code = COALESCE(p_payroll->>'currency_code', 'ZAR'::pg_catalog.text),
            currency_symbol = COALESCE(p_payroll->>'currency_symbol', 'R'::pg_catalog.text),
            currency_locale = COALESCE(p_payroll->>'currency_locale', 'en-ZA'::pg_catalog.text),
            decimal_places = COALESCE((p_payroll->>'decimal_places')::pg_catalog.int4, 2),
            normal_multiplier = COALESCE((p_payroll->>'normal_multiplier')::pg_catalog.numeric, 1.0),
            overtime_multiplier = COALESCE((p_payroll->>'overtime_multiplier')::pg_catalog.numeric, 1.5),
            sunday_holiday_multiplier = COALESCE((p_payroll->>'sunday_holiday_multiplier')::pg_catalog.numeric, 2.0),
            uif_percentage = COALESCE((p_payroll->>'uif_percentage')::pg_catalog.numeric, 1.0),
            updated_at = pg_catalog.now()
        WHERE payroll.id = v_payroll_id
          AND payroll.company_id = v_company_id
          AND payroll.project_id = v_project_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Payroll record changed before it could be saved';
        END IF;
    ELSE
        INSERT INTO public.labour_payrolls (
            id,
            company_id,
            project_id,
            payroll_title,
            payroll_month,
            payroll_year,
            period_start,
            period_end,
            prepared_by,
            date_prepared,
            notes,
            currency_code,
            currency_symbol,
            currency_locale,
            decimal_places,
            normal_multiplier,
            overtime_multiplier,
            sunday_holiday_multiplier,
            uif_percentage,
            status,
            created_by,
            updated_at
        ) VALUES (
            v_payroll_id,
            v_company_id,
            v_project_id,
            p_payroll->>'payroll_title',
            p_payroll->>'payroll_month',
            p_payroll->>'payroll_year',
            (p_payroll->>'period_start')::pg_catalog.date,
            (p_payroll->>'period_end')::pg_catalog.date,
            p_payroll->>'prepared_by',
            (p_payroll->>'date_prepared')::pg_catalog.date,
            p_payroll->>'notes',
            COALESCE(p_payroll->>'currency_code', 'ZAR'::pg_catalog.text),
            COALESCE(p_payroll->>'currency_symbol', 'R'::pg_catalog.text),
            COALESCE(p_payroll->>'currency_locale', 'en-ZA'::pg_catalog.text),
            COALESCE((p_payroll->>'decimal_places')::pg_catalog.int4, 2),
            COALESCE((p_payroll->>'normal_multiplier')::pg_catalog.numeric, 1.0),
            COALESCE((p_payroll->>'overtime_multiplier')::pg_catalog.numeric, 1.5),
            COALESCE((p_payroll->>'sunday_holiday_multiplier')::pg_catalog.numeric, 2.0),
            COALESCE((p_payroll->>'uif_percentage')::pg_catalog.numeric, 1.0),
            'Draft'::pg_catalog.text,
            auth.uid(),
            pg_catalog.now()
        );
    END IF;

    DELETE FROM public.labour_payroll_entries AS entry
    WHERE entry.payroll_id = v_payroll_id;

    IF p_entries IS NOT NULL AND pg_catalog.jsonb_array_length(p_entries) > 0 THEN
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
            COALESCE(element->>'employee_number', element->>'employeeNumber'),
            COALESCE(element->>'first_name', element->>'firstName'),
            COALESCE(element->>'last_name', element->>'lastName'),
            COALESCE(element->>'id_number', element->>'idNumber'),
            COALESCE(element->>'staff_category', element->>'jobTitle', element->>'staffCategory', 'General Worker'::pg_catalog.text),
            COALESCE(element->>'contact_number', element->>'contactNumber'),
            pg_catalog.initcap(COALESCE(element->>'pay_type', element->>'payType', 'Hourly'::pg_catalog.text)),
            COALESCE(element->>'bank_name', element->>'bankName'),
            COALESCE(element->>'account_holder', element->>'accountHolder'),
            COALESCE(element->>'account_number', element->>'accountNumber'),
            COALESCE(element->>'branch_code', element->>'branchCode'),
            COALESCE(element->>'account_type', element->>'accountType'),
            COALESCE((element->>'normal_hourly_rate')::pg_catalog.numeric, (element->>'normalHourlyRate')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'normal_hours')::pg_catalog.numeric, (element->>'normalHours')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'base_salary')::pg_catalog.numeric, (element->>'baseSalary')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'normal_wages')::pg_catalog.numeric, (element->>'normalWages')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'overtime_hourly_rate')::pg_catalog.numeric, (element->>'overtimeHourlyRate')::pg_catalog.numeric, (element->>'overtimeRate')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'overtime_hours')::pg_catalog.numeric, (element->>'overtimeHours')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'overtime_wages')::pg_catalog.numeric, (element->>'overtimeWages')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'sunday_holiday_hourly_rate')::pg_catalog.numeric, (element->>'sundayHolidayHourlyRate')::pg_catalog.numeric, (element->>'sundayHolidayRate')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'sunday_holiday_hours')::pg_catalog.numeric, (element->>'sundayHolidayHours')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'sunday_holiday_wages')::pg_catalog.numeric, (element->>'sundayHolidayWages')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'gross_wage')::pg_catalog.numeric, (element->>'grossWage')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'uif_deduction')::pg_catalog.numeric, (element->>'uifDeduction')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'other_deductions')::pg_catalog.numeric, (element->>'otherDeductions')::pg_catalog.numeric, 0.0),
            COALESCE((element->>'net_pay')::pg_catalog.numeric, (element->>'netPay')::pg_catalog.numeric, 0.0)
        FROM pg_catalog.jsonb_array_elements(p_entries) AS payload(element);
    END IF;

    RETURN v_payroll_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2.2 submit_labour_payroll
-- ------------------------------------------------------------------------------
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

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = v_project_id
          AND project.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid payroll tenant context: project does not belong to company';
    END IF;

    IF public.verify_membership_access(v_company_id, v_project_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
    END IF;

    IF public.company_billing_allows_operational_write(v_company_id) IS NOT TRUE THEN
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

-- ------------------------------------------------------------------------------
-- 2.3 approve_labour_payroll
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_labour_payroll(p_payroll_id pg_catalog.uuid)
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
    SELECT payroll.company_id, payroll.project_id, payroll.status
    INTO v_company_id, v_project_id, v_status
    FROM public.labour_payrolls AS payroll
    WHERE payroll.id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = v_project_id
          AND project.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid payroll tenant context: project does not belong to company';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.company_members AS member
        WHERE member.company_id = v_company_id
          AND member.profile_id = auth.uid()
          AND member.is_company_admin IS TRUE
          AND member.is_active IS TRUE
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only "Company Admin" users are authorized to approve labor payroll sheets';
    END IF;

    IF public.company_billing_allows_operational_write(v_company_id) IS NOT TRUE THEN
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

-- ------------------------------------------------------------------------------
-- 2.4 lock_labour_payroll
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_labour_payroll(p_payroll_id pg_catalog.uuid)
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
    SELECT payroll.company_id, payroll.project_id, payroll.status
    INTO v_company_id, v_project_id, v_status
    FROM public.labour_payrolls AS payroll
    WHERE payroll.id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = v_project_id
          AND project.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid payroll tenant context: project does not belong to company';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.company_members AS member
        WHERE member.company_id = v_company_id
          AND member.profile_id = auth.uid()
          AND member.is_company_admin IS TRUE
          AND member.is_active IS TRUE
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only "Company Admin" users are authorized to lock labor payroll records';
    END IF;

    IF public.company_billing_allows_operational_write(v_company_id) IS NOT TRUE THEN
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

-- ------------------------------------------------------------------------------
-- 2.5 unlock_labour_payroll
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_labour_payroll(p_payroll_id pg_catalog.uuid)
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
    SELECT payroll.company_id, payroll.project_id, payroll.status
    INTO v_company_id, v_project_id, v_status
    FROM public.labour_payrolls AS payroll
    WHERE payroll.id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = v_project_id
          AND project.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid payroll tenant context: project does not belong to company';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.company_members AS member
        WHERE member.company_id = v_company_id
          AND member.profile_id = auth.uid()
          AND member.is_company_admin IS TRUE
          AND member.is_active IS TRUE
    ) THEN
        RAISE EXCEPTION 'Forbidden: Only "Company Admin" users are authorized to unlock labor payroll records';
    END IF;

    IF public.company_billing_allows_operational_write(v_company_id) IS NOT TRUE THEN
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

-- ------------------------------------------------------------------------------
-- 2.6 reopen_labour_payroll
-- ------------------------------------------------------------------------------
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

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = v_project_id
          AND project.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid payroll tenant context: project does not belong to company';
    END IF;

    IF public.company_billing_allows_operational_write(v_company_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    -- Enforce backward transition and role check rules
    IF v_current_status = 'Locked' THEN
        -- Only Company Admin may unlock/reopen
        IF NOT EXISTS (
            SELECT 1
            FROM public.company_members AS member
            WHERE member.company_id = v_company_id
              AND member.profile_id = auth.uid()
              AND member.is_company_admin IS TRUE
              AND member.is_active IS TRUE
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
            SELECT 1
            FROM public.company_members AS member
            WHERE member.company_id = v_company_id
              AND member.profile_id = auth.uid()
              AND member.is_company_admin IS TRUE
              AND member.is_active IS TRUE
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
        IF public.verify_membership_access(v_company_id, v_project_id) IS NOT TRUE THEN
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

-- ------------------------------------------------------------------------------
-- 2.7 duplicate_labour_payroll
-- ------------------------------------------------------------------------------
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

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = v_project_id
          AND project.company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invalid payroll tenant context: project does not belong to company';
    END IF;

    IF public.verify_membership_access(v_company_id, v_project_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: You do not have membership access to this company and project';
    END IF;

    IF public.company_billing_allows_operational_write(v_company_id) IS NOT TRUE THEN
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
        COALESCE(notes || ' (Duplicated from original)'::pg_catalog.text, 'Duplicated payroll ledger'::pg_catalog.text),
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

-- ------------------------------------------------------------------------------
-- 2.8 register_labour_payroll_excel
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_labour_payroll_excel(
    p_payroll_id pg_catalog.uuid,
    p_storage_path pg_catalog.text,
    p_file_name pg_catalog.text,
    p_file_size pg_catalog.int8 DEFAULT NULL::pg_catalog.int8,
    p_mime_type pg_catalog.text DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::pg_catalog.text
)
RETURNS public.labour_payrolls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payroll public.labour_payrolls%ROWTYPE;
    v_expected_prefix pg_catalog.text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    SELECT payroll.*
    INTO v_payroll
    FROM public.labour_payrolls AS payroll
    WHERE payroll.id = p_payroll_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll register not found.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id = v_payroll.project_id
          AND project.company_id = v_payroll.company_id
    ) THEN
        RAISE EXCEPTION 'Invalid payroll tenant context: project does not belong to company';
    END IF;

    IF public.verify_membership_access(
        v_payroll.company_id,
        v_payroll.project_id
    ) IS NOT TRUE THEN
        RAISE EXCEPTION 'You do not have access to this payroll.';
    END IF;

    IF public.company_billing_allows_operational_write(v_payroll.company_id) IS NOT TRUE THEN
        RAISE EXCEPTION 'Company billing access is read-only.'
            USING ERRCODE = 'PM001';
    END IF;

    v_expected_prefix :=
        v_payroll.company_id::pg_catalog.text || '/'
        || v_payroll.project_id::pg_catalog.text || '/'
        || v_payroll.id::pg_catalog.text || '/';

    IF p_storage_path IS NULL
       OR pg_catalog.btrim(p_storage_path) = ''
       OR pg_catalog.strpos(p_storage_path, v_expected_prefix) <> 1 THEN
        RAISE EXCEPTION
            'Invalid storage path. Expected company_id/project_id/payroll_id/filename.xlsx.';
    END IF;

    IF pg_catalog.lower(pg_catalog.right(p_storage_path, 5)) <> '.xlsx' THEN
        RAISE EXCEPTION 'Only .xlsx workbooks may be registered.';
    END IF;

    IF p_file_size IS NOT NULL AND p_file_size < 0 THEN
        RAISE EXCEPTION 'File size cannot be negative.';
    END IF;

    UPDATE public.labour_payrolls AS payroll
    SET
        generated_excel_path = p_storage_path,
        generated_excel_name = COALESCE(
            NULLIF(pg_catalog.btrim(p_file_name), ''),
            pg_catalog.regexp_replace(p_storage_path, '^.*/', '')
        ),
        generated_excel_size = p_file_size,
        generated_excel_mime_type = COALESCE(
            NULLIF(pg_catalog.btrim(p_mime_type), ''),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::pg_catalog.text
        ),
        generated_excel_at = pg_catalog.now(),
        generated_excel_by = auth.uid()
    WHERE payroll.id = p_payroll_id
      AND payroll.company_id = v_payroll.company_id
      AND payroll.project_id = v_payroll.project_id
    RETURNING payroll.*
    INTO v_payroll;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payroll record changed before its Excel metadata could be registered';
    END IF;

    RETURN v_payroll;
END;
$$;


-- ==============================================================================
-- 3. PERMISSIONS & GRANTS
-- ==============================================================================

REVOKE ALL ON FUNCTION public.save_labour_payroll(jsonb, jsonb)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_labour_payroll(jsonb, jsonb)
    TO authenticated;

REVOKE ALL ON FUNCTION public.submit_labour_payroll(uuid)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_labour_payroll(uuid)
    TO authenticated;

REVOKE ALL ON FUNCTION public.approve_labour_payroll(uuid)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_labour_payroll(uuid)
    TO authenticated;

REVOKE ALL ON FUNCTION public.lock_labour_payroll(uuid)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lock_labour_payroll(uuid)
    TO authenticated;

REVOKE ALL ON FUNCTION public.unlock_labour_payroll(uuid)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlock_labour_payroll(uuid)
    TO authenticated;

REVOKE ALL ON FUNCTION public.reopen_labour_payroll(uuid)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_labour_payroll(uuid)
    TO authenticated;

REVOKE ALL ON FUNCTION public.duplicate_labour_payroll(uuid)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_labour_payroll(uuid)
    TO authenticated;

REVOKE ALL ON FUNCTION public.register_labour_payroll_excel(uuid, text, text, bigint, text)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_labour_payroll_excel(uuid, text, text, bigint, text)
    TO authenticated;

COMMIT;
