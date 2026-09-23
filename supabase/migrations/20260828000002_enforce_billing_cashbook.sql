-- Migration: 20260828000002_enforce_billing_cashbook.sql
-- ProjectMatrix Phase 3A.2 — Enforce Billing Access on Cashbook and Banking
--
-- Corrected migration guarantees:
--   1. Existing authorization and SELECT policies remain unchanged.
--   2. Billing enforcement is added through restrictive write policies.
--   3. Child rows retain authoritative company and parent context.
--   4. Reconciliation matches cannot cross bank-account boundaries.
--   5. Every user-facing mutating RPC rejects read-only Billing access with PM001.
--   6. SECURITY DEFINER functions use an empty search_path and explicit schemas.
--   7. Existing Core Finance, Client Accounts and Supplier Accounts protections remain intact.

BEGIN;

-- ============================================================================
-- 0. FAIL-CLOSED PREREQUISITE CHECK
-- ============================================================================

DO $migration_guard$
DECLARE
    v_relation text;
    v_signature text;
    v_missing text[] := ARRAY[]::text[];
BEGIN
    FOREACH v_relation IN ARRAY ARRAY[
        'cashbook_sequences',
        'bank_accounts',
        'cashbook_transactions',
        'cashbook_allocations',
        'bank_statement_imports',
        'bank_statement_lines',
        'bank_reconciliation_sessions',
        'bank_reconciliation_matches',
        'cashbook_attachments',
        'cashbook_audit_log',
        'projects'
    ] LOOP
        IF pg_catalog.to_regclass('public.' || v_relation) IS NULL THEN
            v_missing := pg_catalog.array_append(v_missing, 'relation public.' || v_relation);
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY ARRAY[
        'public.has_finance_full_access(uuid)',
        'public.company_billing_allows_operational_write(uuid)',
        'public.generate_cashbook_transaction_number(uuid,text)',
        'public.submit_cashbook_transaction(uuid,integer)',
        'public.approve_cashbook_transaction(uuid,integer)',
        'public.post_cashbook_transaction(uuid,integer)',
        'public.cancel_cashbook_transaction(uuid,text,integer)',
        'public.match_bank_statement_line(uuid,uuid,uuid,numeric,text,integer,integer,integer)',
        'public.unmatch_bank_statement_line(uuid,integer)',
        'public.complete_bank_reconciliation_session(uuid,integer)'
    ] LOOP
        IF pg_catalog.to_regprocedure(v_signature) IS NULL THEN
            v_missing := pg_catalog.array_append(v_missing, 'function ' || v_signature);
        END IF;
    END LOOP;

    IF pg_catalog.cardinality(v_missing) > 0 THEN
        RAISE EXCEPTION 'Cashbook Billing migration prerequisites are missing: %',
            pg_catalog.array_to_string(v_missing, ', ')
            USING ERRCODE = 'P0001';
    END IF;
END;
$migration_guard$;

-- ============================================================================
-- SECTION 1: CASHBOOK AND BANKING RLS WRITE POLICIES
--
-- PostgreSQL combines permissive authorization policies with OR, then combines
-- restrictive policies with AND. These policies therefore enforce Billing and
-- parent integrity without replacing or weakening existing authorization rules.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 CASHBOOK SEQUENCES
-- ----------------------------------------------------------------------------
ALTER TABLE public.cashbook_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.cashbook_sequences;
CREATE POLICY billing_operational_write_insert
    ON public.cashbook_sequences
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.cashbook_sequences;
CREATE POLICY billing_operational_write_update
    ON public.cashbook_sequences
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.cashbook_sequences;
CREATE POLICY billing_operational_write_delete
    ON public.cashbook_sequences
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- ----------------------------------------------------------------------------
-- 1.2 BANK ACCOUNTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.bank_accounts;
CREATE POLICY billing_operational_write_insert
    ON public.bank_accounts
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.bank_accounts;
CREATE POLICY billing_operational_write_update
    ON public.bank_accounts
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.bank_accounts;
CREATE POLICY billing_operational_write_delete
    ON public.bank_accounts
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
    );

-- ----------------------------------------------------------------------------
-- 1.3 CASHBOOK TRANSACTIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.cashbook_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.cashbook_transactions;
CREATE POLICY billing_operational_write_insert
    ON public.cashbook_transactions
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = cashbook_transactions.bank_account_id
              AND ba.company_id = cashbook_transactions.company_id
        )
        AND (
            cashbook_transactions.project_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS p
                WHERE p.id = cashbook_transactions.project_id
                  AND p.company_id = cashbook_transactions.company_id
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.cashbook_transactions;
CREATE POLICY billing_operational_write_update
    ON public.cashbook_transactions
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = cashbook_transactions.bank_account_id
              AND ba.company_id = cashbook_transactions.company_id
        )
        AND (
            cashbook_transactions.project_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS p
                WHERE p.id = cashbook_transactions.project_id
                  AND p.company_id = cashbook_transactions.company_id
            )
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = cashbook_transactions.bank_account_id
              AND ba.company_id = cashbook_transactions.company_id
        )
        AND (
            cashbook_transactions.project_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS p
                WHERE p.id = cashbook_transactions.project_id
                  AND p.company_id = cashbook_transactions.company_id
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.cashbook_transactions;
CREATE POLICY billing_operational_write_delete
    ON public.cashbook_transactions
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = cashbook_transactions.bank_account_id
              AND ba.company_id = cashbook_transactions.company_id
        )
        AND (
            cashbook_transactions.project_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.projects AS p
                WHERE p.id = cashbook_transactions.project_id
                  AND p.company_id = cashbook_transactions.company_id
            )
        )
    );

-- ----------------------------------------------------------------------------
-- 1.4 CASHBOOK ALLOCATIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.cashbook_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.cashbook_allocations;
CREATE POLICY billing_operational_write_insert
    ON public.cashbook_allocations
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.cashbook_transactions AS ct
            WHERE ct.id = cashbook_allocations.cashbook_transaction_id
              AND ct.company_id = cashbook_allocations.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.cashbook_allocations;
CREATE POLICY billing_operational_write_update
    ON public.cashbook_allocations
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.cashbook_transactions AS ct
            WHERE ct.id = cashbook_allocations.cashbook_transaction_id
              AND ct.company_id = cashbook_allocations.company_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.cashbook_transactions AS ct
            WHERE ct.id = cashbook_allocations.cashbook_transaction_id
              AND ct.company_id = cashbook_allocations.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.cashbook_allocations;
CREATE POLICY billing_operational_write_delete
    ON public.cashbook_allocations
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.cashbook_transactions AS ct
            WHERE ct.id = cashbook_allocations.cashbook_transaction_id
              AND ct.company_id = cashbook_allocations.company_id
        )
    );

-- ----------------------------------------------------------------------------
-- 1.5 BANK STATEMENT IMPORTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.bank_statement_imports;
CREATE POLICY billing_operational_write_insert
    ON public.bank_statement_imports
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_statement_imports.bank_account_id
              AND ba.company_id = bank_statement_imports.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.bank_statement_imports;
CREATE POLICY billing_operational_write_update
    ON public.bank_statement_imports
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_statement_imports.bank_account_id
              AND ba.company_id = bank_statement_imports.company_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_statement_imports.bank_account_id
              AND ba.company_id = bank_statement_imports.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.bank_statement_imports;
CREATE POLICY billing_operational_write_delete
    ON public.bank_statement_imports
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_statement_imports.bank_account_id
              AND ba.company_id = bank_statement_imports.company_id
        )
    );

-- ----------------------------------------------------------------------------
-- 1.6 BANK STATEMENT LINES
-- ----------------------------------------------------------------------------
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.bank_statement_lines;
CREATE POLICY billing_operational_write_insert
    ON public.bank_statement_lines
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_statement_imports AS bsi
            WHERE bsi.id = bank_statement_lines.import_id
              AND bsi.company_id = bank_statement_lines.company_id
              AND bsi.bank_account_id = bank_statement_lines.bank_account_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_statement_lines.bank_account_id
              AND ba.company_id = bank_statement_lines.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.bank_statement_lines;
CREATE POLICY billing_operational_write_update
    ON public.bank_statement_lines
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_statement_imports AS bsi
            WHERE bsi.id = bank_statement_lines.import_id
              AND bsi.company_id = bank_statement_lines.company_id
              AND bsi.bank_account_id = bank_statement_lines.bank_account_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_statement_lines.bank_account_id
              AND ba.company_id = bank_statement_lines.company_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_statement_imports AS bsi
            WHERE bsi.id = bank_statement_lines.import_id
              AND bsi.company_id = bank_statement_lines.company_id
              AND bsi.bank_account_id = bank_statement_lines.bank_account_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_statement_lines.bank_account_id
              AND ba.company_id = bank_statement_lines.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.bank_statement_lines;
CREATE POLICY billing_operational_write_delete
    ON public.bank_statement_lines
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_statement_imports AS bsi
            WHERE bsi.id = bank_statement_lines.import_id
              AND bsi.company_id = bank_statement_lines.company_id
              AND bsi.bank_account_id = bank_statement_lines.bank_account_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_statement_lines.bank_account_id
              AND ba.company_id = bank_statement_lines.company_id
        )
    );

-- ----------------------------------------------------------------------------
-- 1.7 BANK RECONCILIATION SESSIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.bank_reconciliation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.bank_reconciliation_sessions;
CREATE POLICY billing_operational_write_insert
    ON public.bank_reconciliation_sessions
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_reconciliation_sessions.bank_account_id
              AND ba.company_id = bank_reconciliation_sessions.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.bank_reconciliation_sessions;
CREATE POLICY billing_operational_write_update
    ON public.bank_reconciliation_sessions
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_reconciliation_sessions.bank_account_id
              AND ba.company_id = bank_reconciliation_sessions.company_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_reconciliation_sessions.bank_account_id
              AND ba.company_id = bank_reconciliation_sessions.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.bank_reconciliation_sessions;
CREATE POLICY billing_operational_write_delete
    ON public.bank_reconciliation_sessions
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_accounts AS ba
            WHERE ba.id = bank_reconciliation_sessions.bank_account_id
              AND ba.company_id = bank_reconciliation_sessions.company_id
        )
    );

-- ----------------------------------------------------------------------------
-- 1.8 BANK RECONCILIATION MATCHES
-- ----------------------------------------------------------------------------
ALTER TABLE public.bank_reconciliation_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.bank_reconciliation_matches;
CREATE POLICY billing_operational_write_insert
    ON public.bank_reconciliation_matches
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_reconciliation_sessions AS brs
            JOIN public.bank_statement_lines AS bsl
              ON bsl.id = bank_reconciliation_matches.statement_line_id
             AND bsl.company_id = brs.company_id
             AND bsl.bank_account_id = brs.bank_account_id
            JOIN public.cashbook_transactions AS ct
              ON ct.id = bank_reconciliation_matches.cashbook_transaction_id
             AND ct.company_id = brs.company_id
             AND ct.bank_account_id = brs.bank_account_id
            WHERE brs.id = bank_reconciliation_matches.reconciliation_session_id
              AND brs.company_id = bank_reconciliation_matches.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.bank_reconciliation_matches;
CREATE POLICY billing_operational_write_update
    ON public.bank_reconciliation_matches
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_reconciliation_sessions AS brs
            JOIN public.bank_statement_lines AS bsl
              ON bsl.id = bank_reconciliation_matches.statement_line_id
             AND bsl.company_id = brs.company_id
             AND bsl.bank_account_id = brs.bank_account_id
            JOIN public.cashbook_transactions AS ct
              ON ct.id = bank_reconciliation_matches.cashbook_transaction_id
             AND ct.company_id = brs.company_id
             AND ct.bank_account_id = brs.bank_account_id
            WHERE brs.id = bank_reconciliation_matches.reconciliation_session_id
              AND brs.company_id = bank_reconciliation_matches.company_id
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_reconciliation_sessions AS brs
            JOIN public.bank_statement_lines AS bsl
              ON bsl.id = bank_reconciliation_matches.statement_line_id
             AND bsl.company_id = brs.company_id
             AND bsl.bank_account_id = brs.bank_account_id
            JOIN public.cashbook_transactions AS ct
              ON ct.id = bank_reconciliation_matches.cashbook_transaction_id
             AND ct.company_id = brs.company_id
             AND ct.bank_account_id = brs.bank_account_id
            WHERE brs.id = bank_reconciliation_matches.reconciliation_session_id
              AND brs.company_id = bank_reconciliation_matches.company_id
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.bank_reconciliation_matches;
CREATE POLICY billing_operational_write_delete
    ON public.bank_reconciliation_matches
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND EXISTS (
            SELECT 1
            FROM public.bank_reconciliation_sessions AS brs
            JOIN public.bank_statement_lines AS bsl
              ON bsl.id = bank_reconciliation_matches.statement_line_id
             AND bsl.company_id = brs.company_id
             AND bsl.bank_account_id = brs.bank_account_id
            JOIN public.cashbook_transactions AS ct
              ON ct.id = bank_reconciliation_matches.cashbook_transaction_id
             AND ct.company_id = brs.company_id
             AND ct.bank_account_id = brs.bank_account_id
            WHERE brs.id = bank_reconciliation_matches.reconciliation_session_id
              AND brs.company_id = bank_reconciliation_matches.company_id
        )
    );

-- ----------------------------------------------------------------------------
-- 1.9 CASHBOOK ATTACHMENTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.cashbook_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_operational_write_insert ON public.cashbook_attachments;
CREATE POLICY billing_operational_write_insert
    ON public.cashbook_attachments
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND (
            (
                cashbook_attachments.record_type = 'cashbook_transaction'
                AND EXISTS (
                SELECT 1
                FROM public.cashbook_transactions AS ct
                WHERE ct.id = cashbook_attachments.record_id
                  AND ct.company_id = cashbook_attachments.company_id
                )
            )
            OR (
                cashbook_attachments.record_type = 'bank_statement_import'
                AND EXISTS (
                SELECT 1
                FROM public.bank_statement_imports AS bsi
                WHERE bsi.id = cashbook_attachments.record_id
                  AND bsi.company_id = cashbook_attachments.company_id
                )
            )
            OR (
                cashbook_attachments.record_type = 'reconciliation_session'
                AND EXISTS (
                SELECT 1
                FROM public.bank_reconciliation_sessions AS brs
                WHERE brs.id = cashbook_attachments.record_id
                  AND brs.company_id = cashbook_attachments.company_id
                )
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_update ON public.cashbook_attachments;
CREATE POLICY billing_operational_write_update
    ON public.cashbook_attachments
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND (
            (
                cashbook_attachments.record_type = 'cashbook_transaction'
                AND EXISTS (
                SELECT 1
                FROM public.cashbook_transactions AS ct
                WHERE ct.id = cashbook_attachments.record_id
                  AND ct.company_id = cashbook_attachments.company_id
                )
            )
            OR (
                cashbook_attachments.record_type = 'bank_statement_import'
                AND EXISTS (
                SELECT 1
                FROM public.bank_statement_imports AS bsi
                WHERE bsi.id = cashbook_attachments.record_id
                  AND bsi.company_id = cashbook_attachments.company_id
                )
            )
            OR (
                cashbook_attachments.record_type = 'reconciliation_session'
                AND EXISTS (
                SELECT 1
                FROM public.bank_reconciliation_sessions AS brs
                WHERE brs.id = cashbook_attachments.record_id
                  AND brs.company_id = cashbook_attachments.company_id
                )
            )
        )
    )
    WITH CHECK (
        public.company_billing_allows_operational_write(company_id)
        AND (
            (
                cashbook_attachments.record_type = 'cashbook_transaction'
                AND EXISTS (
                SELECT 1
                FROM public.cashbook_transactions AS ct
                WHERE ct.id = cashbook_attachments.record_id
                  AND ct.company_id = cashbook_attachments.company_id
                )
            )
            OR (
                cashbook_attachments.record_type = 'bank_statement_import'
                AND EXISTS (
                SELECT 1
                FROM public.bank_statement_imports AS bsi
                WHERE bsi.id = cashbook_attachments.record_id
                  AND bsi.company_id = cashbook_attachments.company_id
                )
            )
            OR (
                cashbook_attachments.record_type = 'reconciliation_session'
                AND EXISTS (
                SELECT 1
                FROM public.bank_reconciliation_sessions AS brs
                WHERE brs.id = cashbook_attachments.record_id
                  AND brs.company_id = cashbook_attachments.company_id
                )
            )
        )
    );

DROP POLICY IF EXISTS billing_operational_write_delete ON public.cashbook_attachments;
CREATE POLICY billing_operational_write_delete
    ON public.cashbook_attachments
    AS RESTRICTIVE
    FOR DELETE
    TO authenticated
    USING (
        public.company_billing_allows_operational_write(company_id)
        AND (
            (
                cashbook_attachments.record_type = 'cashbook_transaction'
                AND EXISTS (
                SELECT 1
                FROM public.cashbook_transactions AS ct
                WHERE ct.id = cashbook_attachments.record_id
                  AND ct.company_id = cashbook_attachments.company_id
                )
            )
            OR (
                cashbook_attachments.record_type = 'bank_statement_import'
                AND EXISTS (
                SELECT 1
                FROM public.bank_statement_imports AS bsi
                WHERE bsi.id = cashbook_attachments.record_id
                  AND bsi.company_id = cashbook_attachments.company_id
                )
            )
            OR (
                cashbook_attachments.record_type = 'reconciliation_session'
                AND EXISTS (
                SELECT 1
                FROM public.bank_reconciliation_sessions AS brs
                WHERE brs.id = cashbook_attachments.record_id
                  AND brs.company_id = cashbook_attachments.company_id
                )
            )
        )
    );


-- ============================================================================
-- SECTION 2: MUTATING CASHBOOK & BANKING SECURITY DEFINER RPCS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 generate_cashbook_transaction_number
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_cashbook_transaction_number(
  p_company_id uuid,
  p_transaction_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prefix text;
  v_year integer;
  v_next_val integer;
  v_ref text;
BEGIN
  IF NOT public.has_finance_full_access(p_company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', p_company_id;
  END IF;

  IF NOT public.company_billing_allows_operational_write(p_company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  
  CASE p_transaction_type
    WHEN 'Receipt' THEN v_prefix := 'REC';
    WHEN 'Payment' THEN v_prefix := 'PAY';
    WHEN 'Transfer In' THEN v_prefix := 'TRF';
    WHEN 'Transfer Out' THEN v_prefix := 'TRF';
    ELSE v_prefix := 'CBX';
  END CASE;

  -- Acquire transaction-level advisory lock to serialize sequence increments per company/prefix/year
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text || '-' || v_prefix || '-' || v_year::text, 0));

  INSERT INTO public.cashbook_sequences (company_id, prefix, year, last_value, updated_at)
  VALUES (p_company_id, v_prefix, v_year, 1, pg_catalog.now())
  ON CONFLICT (company_id, prefix, year)
  DO UPDATE SET
    last_value = public.cashbook_sequences.last_value + 1,
    updated_at = pg_catalog.now()
  RETURNING last_value INTO v_next_val;

  v_ref := v_prefix || '-' || v_year::text || '-' || pg_catalog.lpad(v_next_val::text, 6, '0');
  RETURN v_ref;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_cashbook_transaction_number(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_cashbook_transaction_number(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2.2 submit_cashbook_transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_cashbook_transaction(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = p_id AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found.', p_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_tx.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_id, p_expected_version, v_tx.version;
  END IF;

  IF NOT public.has_finance_full_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_tx.company_id;
  END IF;

  IF NOT public.company_billing_allows_operational_write(v_tx.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_tx.status <> 'Draft' THEN
    RAISE EXCEPTION 'Only Draft cashbook transactions can be submitted. Current status: %', v_tx.status;
  END IF;

  UPDATE public.cashbook_transactions
  SET status = 'Submitted',
      submitted_by = auth.uid(),
      submitted_at = pg_catalog.now(),
      updated_by = auth.uid()
  WHERE id = p_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. The row changed before submission could be completed.', p_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_tx.company_id, 'cashbook_transactions', p_id, 'SUBMIT', auth.uid(), pg_catalog.jsonb_build_object('previous_status', v_tx.status, 'new_status', 'Submitted'));

  RETURN pg_catalog.jsonb_build_object('success', true, 'id', p_id, 'status', 'Submitted');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_cashbook_transaction(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_cashbook_transaction(uuid, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2.3 approve_cashbook_transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_cashbook_transaction(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = p_id AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found.', p_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_tx.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_id, p_expected_version, v_tx.version;
  END IF;

  IF NOT public.has_finance_full_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_tx.company_id;
  END IF;

  IF NOT public.company_billing_allows_operational_write(v_tx.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_tx.status <> 'Submitted' THEN
    RAISE EXCEPTION 'Only Submitted cashbook transactions can be approved. Current status: %', v_tx.status;
  END IF;

  UPDATE public.cashbook_transactions
  SET status = 'Approved',
      approved_by = auth.uid(),
      approved_at = pg_catalog.now(),
      updated_by = auth.uid()
  WHERE id = p_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. The row changed before approval could be completed.', p_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_tx.company_id, 'cashbook_transactions', p_id, 'APPROVE', auth.uid(), pg_catalog.jsonb_build_object('previous_status', v_tx.status, 'new_status', 'Approved'));

  RETURN pg_catalog.jsonb_build_object('success', true, 'id', p_id, 'status', 'Approved');
END;
$$;

REVOKE ALL ON FUNCTION public.approve_cashbook_transaction(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_cashbook_transaction(uuid, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2.4 post_cashbook_transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_cashbook_transaction(
  p_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = p_id AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found.', p_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_tx.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_id, p_expected_version, v_tx.version;
  END IF;

  IF NOT public.has_finance_full_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_tx.company_id;
  END IF;

  IF NOT public.company_billing_allows_operational_write(v_tx.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_tx.status <> 'Approved' THEN
    RAISE EXCEPTION 'Only Approved cashbook transactions can be posted. Current status: %', v_tx.status;
  END IF;

  UPDATE public.cashbook_transactions
  SET status = 'Posted',
      posted_by = auth.uid(),
      posted_at = pg_catalog.now(),
      updated_by = auth.uid()
  WHERE id = p_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. The row changed before posting could be completed.', p_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_tx.company_id, 'cashbook_transactions', p_id, 'POST', auth.uid(), pg_catalog.jsonb_build_object('previous_status', v_tx.status, 'new_status', 'Posted'));

  RETURN pg_catalog.jsonb_build_object('success', true, 'id', p_id, 'status', 'Posted');
END;
$$;

REVOKE ALL ON FUNCTION public.post_cashbook_transaction(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_cashbook_transaction(uuid, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2.5 cancel_cashbook_transaction
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_cashbook_transaction(
  p_id uuid,
  p_reason text,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx record;
BEGIN
  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = p_id AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found.', p_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_tx.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_id, p_expected_version, v_tx.version;
  END IF;

  IF NOT public.has_finance_full_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_tx.company_id;
  END IF;

  IF NOT public.company_billing_allows_operational_write(v_tx.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_tx.status IN ('Reconciled', 'Cancelled') THEN
    RAISE EXCEPTION 'Transaction in status % cannot be cancelled.', v_tx.status;
  END IF;

  UPDATE public.cashbook_transactions
  SET status = 'Cancelled',
      cancelled_by = auth.uid(),
      cancelled_at = pg_catalog.now(),
      cancellation_reason = p_reason,
      updated_by = auth.uid()
  WHERE id = p_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. The row changed before cancellation could be completed.', p_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_tx.company_id, 'cashbook_transactions', p_id, 'CANCEL', auth.uid(), pg_catalog.jsonb_build_object('previous_status', v_tx.status, 'new_status', 'Cancelled', 'reason', p_reason));

  RETURN pg_catalog.jsonb_build_object('success', true, 'id', p_id, 'status', 'Cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_cashbook_transaction(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_cashbook_transaction(uuid, text, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2.6 match_bank_statement_line
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_bank_statement_line(
  p_session_id uuid,
  p_statement_line_id uuid,
  p_cashbook_transaction_id uuid,
  p_matched_amount numeric,
  p_match_type text DEFAULT 'Exact',
  p_expected_session_version integer DEFAULT NULL,
  p_expected_line_version integer DEFAULT NULL,
  p_expected_tx_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sess record;
  v_line record;
  v_tx record;
  v_line_matched_sum numeric(15,2);
  v_tx_matched_sum numeric(15,2);
  v_line_abs_amount numeric(15,2);
  v_match_id uuid;
BEGIN
  IF p_matched_amount <= 0 THEN
    RAISE EXCEPTION 'Matched amount must be greater than zero. Received: %', p_matched_amount;
  END IF;

  -- Verify and lock session
  SELECT * INTO v_sess FROM public.bank_reconciliation_sessions WHERE id = p_session_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation session % not found.', p_session_id; END IF;
  IF p_expected_session_version IS NOT NULL AND v_sess.version <> p_expected_session_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank reconciliation session %. Expected version %, but current version is %.', p_session_id, p_expected_session_version, v_sess.version;
  END IF;
  IF NOT public.has_finance_full_access(v_sess.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_sess.company_id;
  END IF;
  IF NOT public.company_billing_allows_operational_write(v_sess.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;
  IF v_sess.status <> 'In Progress' THEN
    RAISE EXCEPTION 'Cannot match lines in session % because it is %.', p_session_id, v_sess.status;
  END IF;

  -- Verify and lock statement line
  SELECT * INTO v_line FROM public.bank_statement_lines WHERE id = p_statement_line_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Statement line % not found.', p_statement_line_id; END IF;
  IF p_expected_line_version IS NOT NULL AND v_line.version <> p_expected_line_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank statement line %. Expected version %, but current version is %.', p_statement_line_id, p_expected_line_version, v_line.version;
  END IF;
  IF v_line.company_id <> v_sess.company_id THEN
    RAISE EXCEPTION 'Statement line company mismatch.';
  END IF;
  IF v_line.bank_account_id <> v_sess.bank_account_id THEN
    RAISE EXCEPTION 'Statement line bank account does not match reconciliation session bank account.';
  END IF;

  -- Verify and lock cashbook transaction
  SELECT * INTO v_tx FROM public.cashbook_transactions WHERE id = p_cashbook_transaction_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cashbook transaction % not found.', p_cashbook_transaction_id; END IF;
  IF p_expected_tx_version IS NOT NULL AND v_tx.version <> p_expected_tx_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for cashbook transaction %. Expected version %, but current version is %.', p_cashbook_transaction_id, p_expected_tx_version, v_tx.version;
  END IF;
  IF v_tx.company_id <> v_sess.company_id THEN
    RAISE EXCEPTION 'Cashbook transaction company mismatch.';
  END IF;
  IF v_tx.bank_account_id <> v_sess.bank_account_id THEN
    RAISE EXCEPTION 'Cashbook transaction bank account does not match reconciliation session bank account.';
  END IF;
  IF v_tx.status NOT IN ('Posted', 'Approved') THEN
    RAISE EXCEPTION 'Cashbook transaction % is in status %, must be Posted or Approved to match.', p_cashbook_transaction_id, v_tx.status;
  END IF;

  -- Sign & Direction Compatibility Check
  IF v_line.amount > 0 AND v_tx.transaction_type NOT IN ('Receipt', 'Transfer In') THEN
    RAISE EXCEPTION 'Statement line is a deposit (amount > 0) but cashbook transaction type is % (expected Receipt or Transfer In).', v_tx.transaction_type;
  END IF;
  IF v_line.amount < 0 AND v_tx.transaction_type NOT IN ('Payment', 'Transfer Out') THEN
    RAISE EXCEPTION 'Statement line is a withdrawal (amount < 0) but cashbook transaction type is % (expected Payment or Transfer Out).', v_tx.transaction_type;
  END IF;

  -- Overmatch prevention calculations
  v_line_abs_amount := pg_catalog.abs(v_line.amount);

  -- 1. Cumulative line match check
  SELECT COALESCE(pg_catalog.sum(matched_amount), 0.00) INTO v_line_matched_sum
  FROM public.bank_reconciliation_matches
  WHERE statement_line_id = p_statement_line_id AND is_archived = false;

  IF (v_line_matched_sum + p_matched_amount) > v_line_abs_amount THEN
    RAISE EXCEPTION 'Cannot match %. Total line match (%) would exceed statement line amount (%).',
      p_matched_amount, (v_line_matched_sum + p_matched_amount), v_line_abs_amount;
  END IF;

  -- 2. Cumulative transaction match check
  SELECT COALESCE(pg_catalog.sum(matched_amount), 0.00) INTO v_tx_matched_sum
  FROM public.bank_reconciliation_matches
  WHERE cashbook_transaction_id = p_cashbook_transaction_id AND is_archived = false;

  IF (v_tx_matched_sum + p_matched_amount) > v_tx.amount THEN
    RAISE EXCEPTION 'Cannot match %. Total transaction match (%) would exceed cashbook transaction amount (%).',
      p_matched_amount, (v_tx_matched_sum + p_matched_amount), v_tx.amount;
  END IF;

  -- 3. Insert Match
  INSERT INTO public.bank_reconciliation_matches (
    company_id, reconciliation_session_id, statement_line_id, cashbook_transaction_id, matched_amount, match_type, matched_by
  ) VALUES (
    v_sess.company_id, p_session_id, p_statement_line_id, p_cashbook_transaction_id, p_matched_amount, p_match_type, auth.uid()
  ) RETURNING id INTO v_match_id;

  -- 4. Update line and tx statuses
  IF (v_line_matched_sum + p_matched_amount) = v_line_abs_amount THEN
    UPDATE public.bank_statement_lines SET match_status = 'Matched' WHERE id = p_statement_line_id;
  ELSE
    UPDATE public.bank_statement_lines SET match_status = 'Partially Matched' WHERE id = p_statement_line_id;
  END IF;

  IF (v_tx_matched_sum + p_matched_amount) = v_tx.amount THEN
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Matched' WHERE id = p_cashbook_transaction_id;
  ELSE
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Unreconciled' WHERE id = p_cashbook_transaction_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_sess.company_id, 'bank_reconciliation_matches', v_match_id, 'CREATE_MATCH', auth.uid(), pg_catalog.jsonb_build_object(
    'session_id', p_session_id, 'statement_line_id', p_statement_line_id, 'cashbook_transaction_id', p_cashbook_transaction_id, 'amount', p_matched_amount
  ));

  RETURN pg_catalog.jsonb_build_object('success', true, 'match_id', v_match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.match_bank_statement_line(uuid, uuid, uuid, numeric, text, integer, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_bank_statement_line(uuid, uuid, uuid, numeric, text, integer, integer, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2.7 unmatch_bank_statement_line
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unmatch_bank_statement_line(
  p_match_id uuid,
  p_expected_match_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match record;
  v_sess record;
  v_line_matched_sum numeric(15,2);
  v_tx_matched_sum numeric(15,2);
  v_line record;
  v_tx record;
BEGIN
  SELECT * INTO v_match FROM public.bank_reconciliation_matches WHERE id = p_match_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation match % not found.', p_match_id; END IF;

  IF p_expected_match_version IS NOT NULL AND v_match.version <> p_expected_match_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank reconciliation match %. Expected version %, but current version is %.', p_match_id, p_expected_match_version, v_match.version;
  END IF;

  IF NOT public.has_finance_full_access(v_match.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_match.company_id;
  END IF;

  IF NOT public.company_billing_allows_operational_write(v_match.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  SELECT * INTO v_sess
  FROM public.bank_reconciliation_sessions
  WHERE id = v_match.reconciliation_session_id
    AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reconciliation session % not found or archived.', v_match.reconciliation_session_id;
  END IF;

  IF v_sess.company_id <> v_match.company_id THEN
    RAISE EXCEPTION 'Reconciliation match company does not match its session company.';
  END IF;

  IF v_sess.status <> 'In Progress' THEN
    RAISE EXCEPTION 'Cannot unmatch in session % because it is %.', v_sess.id, v_sess.status;
  END IF;

  SELECT * INTO v_line
  FROM public.bank_statement_lines
  WHERE id = v_match.statement_line_id
    AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Statement line % not found or archived.', v_match.statement_line_id;
  END IF;

  IF v_line.company_id <> v_sess.company_id
     OR v_line.bank_account_id <> v_sess.bank_account_id THEN
    RAISE EXCEPTION 'Statement line context does not match the reconciliation session.';
  END IF;

  SELECT * INTO v_tx
  FROM public.cashbook_transactions
  WHERE id = v_match.cashbook_transaction_id
    AND is_archived = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashbook transaction % not found or archived.', v_match.cashbook_transaction_id;
  END IF;

  IF v_tx.company_id <> v_sess.company_id
     OR v_tx.bank_account_id <> v_sess.bank_account_id THEN
    RAISE EXCEPTION 'Cashbook transaction context does not match the reconciliation session.';
  END IF;

  -- Archive match atomically using the expected version when supplied
  UPDATE public.bank_reconciliation_matches
  SET is_archived = true
  WHERE id = p_match_id
    AND (p_expected_match_version IS NULL OR version = p_expected_match_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank reconciliation match %. The row changed before it could be unmatched.', p_match_id;
  END IF;

  -- Recalculate statement line status
  SELECT COALESCE(pg_catalog.sum(matched_amount), 0.00) INTO v_line_matched_sum
  FROM public.bank_reconciliation_matches
  WHERE statement_line_id = v_match.statement_line_id AND is_archived = false;

  IF v_line_matched_sum = 0 THEN
    UPDATE public.bank_statement_lines SET match_status = 'Unmatched' WHERE id = v_match.statement_line_id;
  ELSIF v_line_matched_sum < pg_catalog.abs(v_line.amount) THEN
    UPDATE public.bank_statement_lines SET match_status = 'Partially Matched' WHERE id = v_match.statement_line_id;
  ELSE
    UPDATE public.bank_statement_lines SET match_status = 'Matched' WHERE id = v_match.statement_line_id;
  END IF;

  -- Recalculate cashbook transaction status
  SELECT COALESCE(pg_catalog.sum(matched_amount), 0.00) INTO v_tx_matched_sum
  FROM public.bank_reconciliation_matches
  WHERE cashbook_transaction_id = v_match.cashbook_transaction_id AND is_archived = false;

  IF v_tx_matched_sum = 0 THEN
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Unreconciled' WHERE id = v_match.cashbook_transaction_id;
  ELSIF v_tx_matched_sum < v_tx.amount THEN
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Unreconciled' WHERE id = v_match.cashbook_transaction_id;
  ELSE
    UPDATE public.cashbook_transactions SET reconciliation_status = 'Matched' WHERE id = v_match.cashbook_transaction_id;
  END IF;

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_match.company_id, 'bank_reconciliation_matches', p_match_id, 'UNMATCH', auth.uid(), pg_catalog.jsonb_build_object('match_id', p_match_id));

  RETURN pg_catalog.jsonb_build_object('success', true, 'match_id', p_match_id, 'status', 'Unmatched');
END;
$$;

REVOKE ALL ON FUNCTION public.unmatch_bank_statement_line(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unmatch_bank_statement_line(uuid, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2.8 complete_bank_reconciliation_session
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_bank_reconciliation_session(
  p_session_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sess record;
  v_bank_acc record;
  v_start_balance numeric(15,2);
  v_cleared_deposits_count integer;
  v_cleared_deposits_sum numeric(15,2);
  v_cleared_withdrawals_count integer;
  v_cleared_withdrawals_sum numeric(15,2);
  v_calc_balance numeric(15,2);
  v_diff numeric(15,2);
BEGIN
  SELECT * INTO v_sess FROM public.bank_reconciliation_sessions WHERE id = p_session_id AND is_archived = false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation session % not found.', p_session_id; END IF;

  IF p_expected_version IS NOT NULL AND v_sess.version <> p_expected_version THEN
    RAISE EXCEPTION 'Optimistic locking conflict for bank reconciliation session %. Expected version %, but current version is %.', p_session_id, p_expected_version, v_sess.version;
  END IF;

  IF NOT public.has_finance_full_access(v_sess.company_id) THEN
    RAISE EXCEPTION 'Access denied. You do not have finance authority for company %.', v_sess.company_id;
  END IF;

  IF NOT public.company_billing_allows_operational_write(v_sess.company_id) THEN
    RAISE EXCEPTION 'Company billing access is read-only.'
      USING ERRCODE = 'PM001';
  END IF;

  IF v_sess.status <> 'In Progress' THEN
    RAISE EXCEPTION 'Session % is already %.', p_session_id, v_sess.status;
  END IF;

  SELECT * INTO v_bank_acc
  FROM public.bank_accounts
  WHERE id = v_sess.bank_account_id
    AND company_id = v_sess.company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank account % does not belong to reconciliation session company %.',
      v_sess.bank_account_id, v_sess.company_id;
  END IF;

  -- Derive starting balance from the most recent completed reconciliation session before this end date
  SELECT statement_ending_balance INTO v_start_balance
  FROM public.bank_reconciliation_sessions
  WHERE bank_account_id = v_sess.bank_account_id
    AND company_id = v_sess.company_id
    AND status = 'Completed'
    AND statement_end_date <= v_sess.statement_end_date
    AND id <> p_session_id
    AND is_archived = false
  ORDER BY statement_end_date DESC, completed_at DESC
  LIMIT 1;

  IF v_start_balance IS NULL THEN
    v_start_balance := v_bank_acc.opening_balance;
  END IF;

  -- Aggregate cleared receipts (deposits) matched in this session
  SELECT
    pg_catalog.count(brm.id),
    COALESCE(pg_catalog.sum(brm.matched_amount), 0.00)
  INTO v_cleared_deposits_count, v_cleared_deposits_sum
  FROM public.bank_reconciliation_matches brm
  JOIN public.cashbook_transactions cbt ON cbt.id = brm.cashbook_transaction_id
  WHERE brm.reconciliation_session_id = p_session_id
    AND brm.is_archived = false
    AND cbt.transaction_type IN ('Receipt', 'Transfer In');

  -- Aggregate cleared payments (withdrawals) matched in this session
  SELECT
    pg_catalog.count(brm.id),
    COALESCE(pg_catalog.sum(brm.matched_amount), 0.00)
  INTO v_cleared_withdrawals_count, v_cleared_withdrawals_sum
  FROM public.bank_reconciliation_matches brm
  JOIN public.cashbook_transactions cbt ON cbt.id = brm.cashbook_transaction_id
  WHERE brm.reconciliation_session_id = p_session_id
    AND brm.is_archived = false
    AND cbt.transaction_type IN ('Payment', 'Transfer Out');

  v_calc_balance := v_start_balance + v_cleared_deposits_sum - v_cleared_withdrawals_sum;
  v_diff := v_sess.statement_ending_balance - v_calc_balance;

  IF v_diff <> 0.00 THEN
    RAISE EXCEPTION 'Reconciliation session % cannot be completed. Calculated difference is % (must be 0.00). Ending statement balance: %, Starting balance: %, Cleared deposits: %, Cleared withdrawals: %',
      p_session_id, v_diff, v_sess.statement_ending_balance, v_start_balance, v_cleared_deposits_sum, v_cleared_withdrawals_sum;
  END IF;

  -- Complete session
  UPDATE public.bank_reconciliation_sessions
  SET status = 'Completed',
      cleared_deposits_count = v_cleared_deposits_count,
      cleared_deposits_sum = v_cleared_deposits_sum,
      cleared_withdrawals_count = v_cleared_withdrawals_count,
      cleared_withdrawals_sum = v_cleared_withdrawals_sum,
      calculated_balance = v_calc_balance,
      difference_amount = 0.00,
      completed_at = pg_catalog.now(),
      completed_by = auth.uid()
  WHERE id = p_session_id
    AND (p_expected_version IS NULL OR version = p_expected_version);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Optimistic locking conflict for reconciliation session %. The row changed before completion could be committed.', p_session_id;
  END IF;

  -- Mark matched transactions as fully Reconciled
  UPDATE public.cashbook_transactions
  SET reconciliation_status = 'Reconciled'
  WHERE id IN (
    SELECT cashbook_transaction_id
    FROM public.bank_reconciliation_matches
    WHERE reconciliation_session_id = p_session_id AND is_archived = false
  );

  INSERT INTO public.cashbook_audit_log (company_id, table_name, record_id, action, performed_by, details)
  VALUES (v_sess.company_id, 'bank_reconciliation_sessions', p_session_id, 'COMPLETE_SESSION', auth.uid(), pg_catalog.jsonb_build_object(
    'session_id', p_session_id, 'start_balance', v_start_balance, 'ending_balance', v_sess.statement_ending_balance, 'cleared_deposits', v_cleared_deposits_sum, 'cleared_withdrawals', v_cleared_withdrawals_sum
  ));

  RETURN pg_catalog.jsonb_build_object('success', true, 'session_id', p_session_id, 'status', 'Completed');
END;
$$;

REVOKE ALL ON FUNCTION public.complete_bank_reconciliation_session(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_bank_reconciliation_session(uuid, integer) TO authenticated;

COMMIT;
