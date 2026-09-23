import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.2 — Step 3C.4E-1A
 * Paystack Recurring Subscription Invoice Foundation Test Suite (PGlite)
 *
 * Verifies:
 * 1. Migration application cleanly on top of existing billing schema
 * 2. Table structure and forced RLS on public.billing_invoices
 * 3. Privilege isolation (SELECT-only for authenticated, zero anon access, service_role write access)
 * 4. Multi-tenant RLS isolation with verify_billing_access
 * 5. Composite foreign key scoping (company_id, subscription_id, provider, environment)
 * 6. Format checks (INV_ code format, ISO currency, positive amount)
 * 7. Exact semantic uniqueness on (provider, environment, provider_invoice_code)
 * 8. Status and timestamp constraints (pending, failed, paid)
 * 9. Period integrity (end > start, paid invoices must have valid period)
 * 10. Immutable fields on billing_invoices (identity, commercial snapshot, periods, timestamps)
 * 11. State transition matrix (pending -> failed -> paid, terminal paid)
 * 12. Deletion and truncation protection triggers on billing_invoices
 * 13. public.billing_payments invoice linkage (renewal requires invoice, activation does not)
 * 14. public.billing_payments one-way invoice binding
 * 15. public.billing_payments environment-scoped reference uniqueness (test vs live)
 * 16. public.billing_subscriptions past_due_since column, checks, and update protections
 */

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${description}`);
  }
}

async function expectRejection(promise: Promise<unknown>, expectedCodeOrMsg: string, description: string) {
  try {
    await promise;
    failed++;
    console.error(`  ✗ FAIL (Expected Rejection, but succeeded): ${description}`);
  } catch (err: any) {
    const msg = String(err?.message || "");
    const code = String(err?.code || "");
    if (msg.includes(expectedCodeOrMsg) || code.includes(expectedCodeOrMsg) || expectedCodeOrMsg === "") {
      passed++;
      console.log(`  ✓ ${description} [Rejected: ${code || msg.slice(0, 40)}]`);
    } else {
      failed++;
      console.error(`  ✗ FAIL (Wrong error): ${description}. Received: ${msg}`);
    }
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("PAYSTACK RECURRING INVOICE FOUNDATION TEST SUITE (PGLITE)");
  console.log("=======================================================\n");

  const db = new PGlite();

  // 1. Setup Auth & Core Schema Prerequisite
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE ROLE service_role;
    CREATE ROLE anon;
    CREATE ROLE authenticated;

    CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        email_confirmed_at TIMESTAMPTZ
    );

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT '00000000-0000-0000-0000-000000000001'::uuid
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT '{"email":"pm@example.com"}'::jsonb
    $$;

    CREATE TABLE public.companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL
    );

    CREATE TABLE public.profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        full_name TEXT
    );

    CREATE TABLE public.company_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        designation TEXT,
        role TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION public.verify_billing_access(target_company_id UUID)
    RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = target_company_id
          AND cm.profile_id = (SELECT id FROM public.profiles WHERE email = 'pm@example.com' LIMIT 1)
          AND cm.is_active = true
      );
    END;
    $$;
  `);

  // 2. Load prior billing migrations in sequential order
  const priorMigrationFiles = [
    "20260729000001_billing_plans.sql",
    "20260729000002_billing_subscriptions.sql",
    "20260729000003_billing_ledger_events.sql",
    "20260818000001_paystack_payment_foundation.sql",
    "20260820000001_paystack_test_plan_mapping.sql",
  ];

  for (const file of priorMigrationFiles) {
    const filePath = path.join(process.cwd(), "supabase", "migrations", file);
    const sql = fs.readFileSync(filePath, "utf-8");
    await db.exec(sql);
  }

  // 3. Load Migration Under Test: 20260825000001_paystack_recurring_invoice_foundation.sql
  const testMigrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000001_paystack_recurring_invoice_foundation.sql"
  );
  const testMigrationSql = fs.readFileSync(testMigrationPath, "utf-8");
  await db.exec(testMigrationSql);
  assert(true, "Migration 20260825000001_paystack_recurring_invoice_foundation.sql applied cleanly");

  // Setup Test Seed Data
  const userId = "00000000-0000-0000-0000-000000000001";
  const userEmail = "pm@example.com";
  const companyA = "11111111-1111-1111-1111-111111111111";
  const companyB = "22222222-2222-2222-2222-222222222222";
  const planId = "33333333-3333-3333-3333-333333333333";
  const mappingId = "44444444-4444-4444-4444-444444444444";
  const subIdA = "55555555-5555-5555-5555-555555555555";
  const subIdB = "66666666-6666-6666-6666-666666666666";
  const provSubIdA = "77777777-7777-7777-7777-777777777777";
  const provSubIdB = "88888888-8888-8888-8888-888888888888";

  await db.exec(`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES ('${userId}', '${userEmail}', now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, email, full_name)
    VALUES ('${userId}', '${userEmail}', 'Project Manager')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.companies (id, name)
    VALUES ('${companyA}', 'Company Alpha'), ('${companyB}', 'Company Beta')
    ON CONFLICT (id) DO NOTHING;

    -- Authenticated user belongs to Company Alpha ONLY
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyA}', '${userId}', 'Owner', 'admin', true);

    INSERT INTO public.billing_plans (
        id, code, name, amount_minor, currency, billing_interval, trial_days, is_active
    ) VALUES (
        '${planId}', 'pro_monthly', 'Pro Monthly', 50000, 'ZAR', 'monthly', 5, true
    );

    INSERT INTO public.billing_provider_plans (
        id, plan_id, provider, environment, provider_plan_code, amount_minor, currency, billing_interval, is_active
    ) VALUES (
        '${mappingId}', '${planId}', 'paystack', 'test', 'PLN_pro_test_123', 50000, 'ZAR', 'monthly', true
    );

    INSERT INTO public.billing_subscriptions (
        id, company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval,
        current_period_start, current_period_end, next_renewal_at, auto_renew_enabled
    ) VALUES (
        '${subIdA}', '${companyA}', '${planId}', 'SUB_REF_ALPHA', 'active', 50000, 'ZAR', 'monthly',
        now() - INTERVAL '15 days', now() + INTERVAL '15 days', now() + INTERVAL '15 days', true
    ), (
        '${subIdB}', '${companyB}', '${planId}', 'SUB_REF_BETA', 'active', 50000, 'ZAR', 'monthly',
        now() - INTERVAL '15 days', now() + INTERVAL '15 days', now() + INTERVAL '15 days', true
    );

    INSERT INTO public.billing_provider_subscriptions (
        id, company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        provider_subscription_code, provider_customer_code, customer_email, email_token, provider_status,
        is_current, next_payment_at
    ) VALUES (
        '${provSubIdA}', '${companyA}', '${subIdA}', '${planId}', '${mappingId}', 'paystack', 'test',
        'SUB_alpha_test_code', 'CUS_alpha_123', 'alpha@example.com', 'tok_alpha_123', 'active',
        true, now() + INTERVAL '15 days'
    ), (
        '${provSubIdB}', '${companyB}', '${subIdB}', '${planId}', '${mappingId}', 'paystack', 'test',
        'SUB_beta_test_code', 'CUS_beta_123', 'beta@example.com', 'tok_beta_123', 'active',
        true, now() + INTERVAL '15 days'
    );
  `);

  // -------------------------------------------------------------
  // 1. Table Schema, RLS & Privileges
  // -------------------------------------------------------------
  console.log("\n1. Table Schema, RLS & Privileges");

  const rlsRes = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
    SELECT relrowsecurity, relforcerowsecurity
    FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public' AND relname = 'billing_invoices';
  `);
  assert(rlsRes.rows[0]?.relrowsecurity === true, "billing_invoices has Row Level Security ENABLED");
  assert(rlsRes.rows[0]?.relforcerowsecurity === true, "billing_invoices has Row Level Security FORCED");

  const anonGrants = await db.query(`
    SELECT privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'billing_invoices' AND grantee IN ('PUBLIC', 'anon');
  `);
  assert(anonGrants.rows.length === 0, "billing_invoices has 0 privileges for PUBLIC or anon");

  const authGrants = await db.query<{ privilege_type: string }>(`
    SELECT privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'billing_invoices' AND grantee = 'authenticated';
  `);
  assert(
    authGrants.rows.length === 1 && authGrants.rows[0]?.privilege_type === "SELECT",
    "billing_invoices allows only SELECT for authenticated"
  );

  // -------------------------------------------------------------
  // 2. Multi-Tenant RLS Visibility
  // -------------------------------------------------------------
  console.log("\n2. Multi-Tenant RLS Visibility");

  const invoiceA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const invoiceB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  await db.exec(`
    INSERT INTO public.billing_invoices (
        id, company_id, subscription_id, provider_subscription_record_id, provider, environment,
        provider_invoice_code, status, amount_minor, currency
    ) VALUES (
        '${invoiceA}', '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
        'INV_alpha_001', 'pending', 50000, 'ZAR'
    ), (
        '${invoiceB}', '${companyB}', '${subIdB}', '${provSubIdB}', 'paystack', 'test',
        'INV_beta_001', 'pending', 50000, 'ZAR'
    );
  `);

  // As authenticated user (member of companyA only)
  await db.exec("SET ROLE authenticated;");
  const visibleInvoices = await db.query<{ id: string; company_id: string }>(
    "SELECT id, company_id FROM public.billing_invoices;"
  );
  assert(visibleInvoices.rows.length === 1, "Authenticated user sees exactly 1 invoice");
  assert(visibleInvoices.rows[0]?.id === invoiceA, "Authenticated user sees only their company's invoice (invoiceA)");
  assert(visibleInvoices.rows[0]?.company_id === companyA, "Invoice belongs to companyA");

  await db.exec("RESET ROLE;");

  // -------------------------------------------------------------
  // 3. Composite Foreign Key Scoping
  // -------------------------------------------------------------
  console.log("\n3. Composite Foreign Key Scoping");

  // Cross-company subscription mismatch
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdB}', '${provSubIdA}', 'paystack', 'test',
          'INV_cross_sub', 'pending', 50000, 'ZAR'
      );
    `),
    "violates foreign key constraint",
    "Rejects invoice pointing to another company's subscription"
  );

  // Cross-company provider subscription record mismatch
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdB}', 'paystack', 'test',
          'INV_cross_prov_sub', 'pending', 50000, 'ZAR'
      );
    `),
    "violates foreign key constraint",
    "Rejects invoice pointing to another company's provider subscription record"
  );

  // Provider mismatch
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'stripe', 'test',
          'INV_provider_mismatch', 'pending', 50000, 'ZAR'
      );
    `),
    "chk_billing_invoices_provider",
    "Rejects provider other than paystack"
  );

  // Environment mismatch
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'live',
          'INV_env_mismatch', 'pending', 50000, 'ZAR'
      );
    `),
    "violates foreign key constraint",
    "Rejects invoice environment mismatched with parent provider subscription"
  );

  // -------------------------------------------------------------
  // 4. Code Format, Amount & Currency Check Constraints
  // -------------------------------------------------------------
  console.log("\n4. Code Format, Amount & Currency Constraints");

  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'invalid_prefix_123', 'pending', 50000, 'ZAR'
      );
    `),
    "chk_billing_invoices_code_format",
    "Rejects provider_invoice_code without INV_ prefix"
  );

  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_', 'pending', 50000, 'ZAR'
      );
    `),
    "chk_billing_invoices_code_format",
    "Rejects provider_invoice_code shorter than minimum length"
  );

  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_valid_code_001', 'pending', -100, 'ZAR'
      );
    `),
    "chk_billing_invoices_amount_positive",
    "Rejects negative amount_minor"
  );

  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_valid_code_002', 'pending', 50000, 'zar'
      );
    `),
    "chk_billing_invoices_currency",
    "Rejects lowercase currency code"
  );

  // -------------------------------------------------------------
  // 5. Uniqueness Scoping (provider, environment, provider_invoice_code)
  // -------------------------------------------------------------
  console.log("\n5. Exact Semantic Uniqueness on (provider, environment, provider_invoice_code)");

  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_alpha_001', 'pending', 50000, 'ZAR'
      );
    `),
    "uq_billing_invoices_provider_code",
    "Rejects duplicate provider_invoice_code within same environment"
  );

  // -------------------------------------------------------------
  // 6. Period and Lifecycle Timestamp Constraints
  // -------------------------------------------------------------
  console.log("\n6. Period and Lifecycle Timestamp Constraints");

  // period_end <= period_start rejected
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency, period_start, period_end
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_period_invalid', 'pending', 50000, 'ZAR', now(), now() - INTERVAL '1 day'
      );
    `),
    "chk_billing_invoices_period_dates",
    "Rejects period_end <= period_start"
  );

  // one null, one non-null period date rejected
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency, period_start, period_end
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_period_partial', 'pending', 50000, 'ZAR', now(), NULL
      );
    `),
    "chk_billing_invoices_period_dates",
    "Rejects partial period dates (start without end)"
  );

  // pending invoice cannot have paid_at
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency, paid_at
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_pending_paid_at', 'pending', 50000, 'ZAR', now()
      );
    `),
    "chk_billing_invoices_pending_timestamps",
    "Rejects pending invoice with paid_at timestamp populated"
  );

  // failed invoice requires first_failed_at and null paid_at
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency, first_failed_at
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_failed_no_ts', 'failed', 50000, 'ZAR', NULL
      );
    `),
    "chk_billing_invoices_failed_timestamps",
    "Rejects failed invoice without first_failed_at timestamp"
  );

  // paid invoice requires paid_at and valid billing period
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, amount_minor, currency, paid_at, period_start, period_end
      ) VALUES (
          '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
          'INV_paid_no_period', 'paid', 50000, 'ZAR', now(), NULL, NULL
      );
    `),
    "chk_billing_invoices_paid_period",
    "Rejects paid invoice without non-null billing period"
  );

  // -------------------------------------------------------------
  // 7. State Transitions and Immutability Triggers
  // -------------------------------------------------------------
  console.log("\n7. State Transitions and Immutability Triggers");

  const invoiceTest = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  await db.exec(`
    INSERT INTO public.billing_invoices (
        id, company_id, subscription_id, provider_subscription_record_id, provider, environment,
        provider_invoice_code, status, amount_minor, currency
    ) VALUES (
        '${invoiceTest}', '${companyA}', '${subIdA}', '${provSubIdA}', 'paystack', 'test',
        'INV_test_lifecycle', 'pending', 50000, 'ZAR'
    );
  `);

  // Immutability: identity & commercial fields cannot be changed
  await expectRejection(
    db.exec(`UPDATE public.billing_invoices SET amount_minor = 60000 WHERE id = '${invoiceTest}';`),
    "55000",
    "Rejects modification of amount_minor on billing_invoices"
  );

  await expectRejection(
    db.exec(`UPDATE public.billing_invoices SET currency = 'USD' WHERE id = '${invoiceTest}';`),
    "55000",
    "Rejects modification of currency on billing_invoices"
  );

  await expectRejection(
    db.exec(`UPDATE public.billing_invoices SET provider_invoice_code = 'INV_tampered' WHERE id = '${invoiceTest}';`),
    "55000",
    "Rejects modification of provider_invoice_code on billing_invoices"
  );

  await expectRejection(
    db.exec(`UPDATE public.billing_invoices SET company_id = '${companyB}' WHERE id = '${invoiceTest}';`),
    "55000",
    "Rejects modification of company_id on billing_invoices"
  );

  // Transition: pending -> failed (with first_failed_at)
  await db.exec(`
    UPDATE public.billing_invoices
    SET status = 'failed',
        first_failed_at = now()
    WHERE id = '${invoiceTest}';
  `);
  const failedInv = await db.query<{ status: string; first_failed_at: string }>(
    `SELECT status, first_failed_at FROM public.billing_invoices WHERE id = '${invoiceTest}';`
  );
  assert(failedInv.rows[0]?.status === "failed", "Successfully transitioned pending -> failed");
  assert(Boolean(failedInv.rows[0]?.first_failed_at), "first_failed_at is populated");

  // first_failed_at is now immutable
  await expectRejection(
    db.exec(`
      UPDATE public.billing_invoices
      SET first_failed_at = now() - INTERVAL '1 hour'
      WHERE id = '${invoiceTest}';
    `),
    "55000",
    "Rejects modification of first_failed_at once recorded"
  );

  // Transition: failed -> pending is REJECTED
  await expectRejection(
    db.exec(`
      UPDATE public.billing_invoices
      SET status = 'pending'
      WHERE id = '${invoiceTest}';
    `),
    "55000",
    "Rejects regression transition failed -> pending"
  );

  // Transition: failed -> paid (with paid_at and period)
  await db.exec(`
    UPDATE public.billing_invoices
    SET status = 'paid',
        paid_at = now(),
        period_start = now(),
        period_end = now() + INTERVAL '1 month'
    WHERE id = '${invoiceTest}';
  `);
  const paidInv = await db.query<{ status: string; paid_at: string; period_start: string }>(
    `SELECT status, paid_at, period_start FROM public.billing_invoices WHERE id = '${invoiceTest}';`
  );
  assert(paidInv.rows[0]?.status === "paid", "Successfully transitioned failed -> paid");
  assert(Boolean(paidInv.rows[0]?.paid_at), "paid_at is populated");

  // Terminal state: paid -> failed or paid -> pending is REJECTED
  await expectRejection(
    db.exec(`
      UPDATE public.billing_invoices
      SET status = 'failed'
      WHERE id = '${invoiceTest}';
    `),
    "55000",
    "Rejects transition from terminal state paid -> failed"
  );

  await expectRejection(
    db.exec(`
      UPDATE public.billing_invoices
      SET period_start = now() - INTERVAL '10 days'
      WHERE id = '${invoiceTest}';
    `),
    "55000",
    "Rejects modification of billing period once established"
  );

  await expectRejection(
    db.exec(`
      UPDATE public.billing_invoices
      SET paid_at = now() - INTERVAL '1 day'
      WHERE id = '${invoiceTest}';
    `),
    "55000",
    "Rejects modification of paid_at once established"
  );

  // -------------------------------------------------------------
  // 8. Deletion and Truncation Protection
  // -------------------------------------------------------------
  console.log("\n8. Deletion and Truncation Protection");

  await expectRejection(
    db.exec(`DELETE FROM public.billing_invoices WHERE id = '${invoiceTest}';`),
    "55000",
    "Rejects DELETE on billing_invoices via protection trigger"
  );

  await expectRejection(
    db.exec("TRUNCATE TABLE public.billing_invoices CASCADE;"),
    "55000",
    "Rejects TRUNCATE on billing_invoices via protection trigger"
  );

  // -------------------------------------------------------------
  // 9. public.billing_payments Invoice Linkage & Protections
  // -------------------------------------------------------------
  console.log("\n9. public.billing_payments Invoice Linkage & Protections");

  const paymentActId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const paymentRenId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

  // Activation payment may have billing_invoice_id = NULL
  await db.exec(`
    INSERT INTO public.billing_payments (
        id, company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        purpose, idempotency_key, provider_reference, amount_minor, currency, customer_email,
        status, billing_invoice_id
    ) VALUES (
        '${paymentActId}', '${companyA}', '${subIdA}', '${planId}', '${mappingId}', 'paystack', 'test',
        'activation', gen_random_uuid(), 'PAY_act_test_001', 50000, 'ZAR', 'alpha@example.com',
        'initialized', NULL
    );
  `);
  assert(true, "Activation payment successfully created with billing_invoice_id = NULL");

  // Renewal payment MUST have billing_invoice_id != NULL
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_payments (
          id, company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
          purpose, idempotency_key, provider_reference, amount_minor, currency, customer_email,
          status, billing_invoice_id
      ) VALUES (
          '${paymentRenId}', '${companyA}', '${subIdA}', '${planId}', '${mappingId}', 'paystack', 'test',
          'renewal', gen_random_uuid(), 'PAY_ren_test_001', 50000, 'ZAR', 'alpha@example.com',
          'initialized', NULL
      );
    `),
    "chk_billing_payments_purpose_invoice",
    "Rejects renewal payment with billing_invoice_id = NULL"
  );

  // Renewal payment with mismatched invoice scope rejected
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_payments (
          id, company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
          purpose, idempotency_key, provider_reference, amount_minor, currency, customer_email,
          status, billing_invoice_id
      ) VALUES (
          '${paymentRenId}', '${companyA}', '${subIdA}', '${planId}', '${mappingId}', 'paystack', 'test',
          'renewal', gen_random_uuid(), 'PAY_ren_test_001', 50000, 'ZAR', 'alpha@example.com',
          'initialized', '${invoiceB}'
      );
    `),
    "fk_billing_payments_invoice_scope",
    "Rejects renewal payment linked to another company's invoice (invoiceB)"
  );

  // Renewal payment with valid invoice link succeeds
  await db.exec(`
    INSERT INTO public.billing_payments (
        id, company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        purpose, idempotency_key, provider_reference, amount_minor, currency, customer_email,
        status, billing_invoice_id
    ) VALUES (
        '${paymentRenId}', '${companyA}', '${subIdA}', '${planId}', '${mappingId}', 'paystack', 'test',
        'renewal', gen_random_uuid(), 'PAY_ren_test_001', 50000, 'ZAR', 'alpha@example.com',
        'initialized', '${invoiceA}'
    );
  `);
  assert(true, "Renewal payment successfully created with valid linked invoiceA");

  // One-way invoice binding: once set on payment, billing_invoice_id cannot be changed or cleared
  await expectRejection(
    db.exec(`
      UPDATE public.billing_payments
      SET billing_invoice_id = NULL
      WHERE id = '${paymentRenId}';
    `),
    "55000",
    "Rejects clearing billing_invoice_id on payment once established"
  );

  await expectRejection(
    db.exec(`
      UPDATE public.billing_payments
      SET billing_invoice_id = '${invoiceTest}'
      WHERE id = '${paymentRenId}';
    `),
    "55000",
    "Rejects changing billing_invoice_id on payment to another invoice"
  );

  // -------------------------------------------------------------
  // 10. Environment-Scoped Payment Reference Uniqueness
  // -------------------------------------------------------------
  console.log("\n10. Environment-Scoped Payment Reference Uniqueness");

  // Insert payment in live environment with the same provider_reference as test environment
  const companyC = "33333333-3333-3333-3333-333333333333";
  const mappingLiveId = "44444444-4444-4444-4444-444444444445";
  const subLiveId = "55555555-5555-5555-5555-555555555556";
  const provSubLiveId = "77777777-7777-7777-7777-777777777778";

  await db.exec(`
    INSERT INTO public.companies (id, name)
    VALUES ('${companyC}', 'Company Gamma')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.billing_provider_plans (
        id, plan_id, provider, environment, provider_plan_code, amount_minor, currency, billing_interval, is_active
    ) VALUES (
        '${mappingLiveId}', '${planId}', 'paystack', 'live', 'PLN_pro_live_123', 50000, 'ZAR', 'monthly', true
    );

    INSERT INTO public.billing_subscriptions (
        id, company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval
    ) VALUES (
        '${subLiveId}', '${companyC}', '${planId}', 'SUB_REF_LIVE', 'active', 50000, 'ZAR', 'monthly'
    );

    INSERT INTO public.billing_provider_subscriptions (
        id, company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        provider_subscription_code, provider_customer_code, customer_email, email_token, provider_status,
        is_current
    ) VALUES (
        '${provSubLiveId}', '${companyC}', '${subLiveId}', '${planId}', '${mappingLiveId}', 'paystack', 'live',
        'SUB_live_code', 'CUS_live_123', 'live@example.com', 'tok_live_123', 'active', true
    );

    -- Insert payment with identical provider_reference 'PAY_act_test_001' in 'live' environment
    INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        purpose, idempotency_key, provider_reference, amount_minor, currency, customer_email, status
    ) VALUES (
        '${companyC}', '${subLiveId}', '${planId}', '${mappingLiveId}', 'paystack', 'live',
        'activation', gen_random_uuid(), 'PAY_act_test_001', 50000, 'ZAR', 'live@example.com', 'initialized'
    );
  `);
  assert(true, "Successfully allowed identical provider_reference across test and live environments");

  // Duplicate within same environment is still rejected
  await expectRejection(
    db.exec(`
      INSERT INTO public.billing_payments (
          company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
          purpose, idempotency_key, provider_reference, amount_minor, currency, customer_email, status
      ) VALUES (
          '${companyA}', '${subIdA}', '${planId}', '${mappingId}', 'paystack', 'test',
          'activation', gen_random_uuid(), 'PAY_act_test_001', 50000, 'ZAR', 'alpha@example.com', 'initialized'
      );
    `),
    "uq_billing_payments_provider_env_reference",
    "Rejects duplicate provider_reference within the same environment"
  );

  // -------------------------------------------------------------
  // 11. public.billing_subscriptions.past_due_since & Protections
  // -------------------------------------------------------------
  console.log("\n11. public.billing_subscriptions past_due_since & Protections");

  const companyD = "44444444-1111-1111-1111-111111111111";
  const subPdTest = "99999999-9999-9999-9999-999999999999";
  await db.exec(`
    INSERT INTO public.companies (id, name)
    VALUES ('${companyD}', 'Company Delta')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.billing_subscriptions (
        id, company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval
    ) VALUES (
        '${subPdTest}', '${companyD}', '${planId}', 'SUB_PD_TEST', 'active', 50000, 'ZAR', 'monthly'
    );
  `);

  // Setting past_due_since while status = active is REJECTED
  await expectRejection(
    db.exec(`
      UPDATE public.billing_subscriptions
      SET past_due_since = now()
      WHERE id = '${subPdTest}';
    `),
    "55000",
    "Rejects setting past_due_since when subscription status is active"
  );

  // Transitioning to past_due WITH past_due_since succeeds
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'past_due',
        past_due_since = now()
    WHERE id = '${subPdTest}';
  `);
  const pdSub = await db.query<{ status: string; past_due_since: string }>(
    `SELECT status, past_due_since FROM public.billing_subscriptions WHERE id = '${subPdTest}';`
  );
  assert(pdSub.rows[0]?.status === "past_due", "Successfully transitioned to past_due status");
  assert(Boolean(pdSub.rows[0]?.past_due_since), "past_due_since timestamp recorded");

  // Leaving past_due to active clears past_due_since
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'active'
    WHERE id = '${subPdTest}';
  `);
  const activeSub = await db.query<{ status: string; past_due_since: string | null }>(
    `SELECT status, past_due_since FROM public.billing_subscriptions WHERE id = '${subPdTest}';`
  );
  assert(activeSub.rows[0]?.status === "active", "Successfully transitioned from past_due to active");
  assert(activeSub.rows[0]?.past_due_since === null, "past_due_since is cleared upon leaving past_due");

  // Subscription identity & commercial immutability
  await expectRejection(
    db.exec(`UPDATE public.billing_subscriptions SET amount_minor = 75000 WHERE id = '${subPdTest}';`),
    "55000",
    "Rejects updating amount_minor on billing_subscriptions"
  );

  await expectRejection(
    db.exec(`UPDATE public.billing_subscriptions SET currency = 'USD' WHERE id = '${subPdTest}';`),
    "55000",
    "Rejects updating currency on billing_subscriptions"
  );

  await expectRejection(
    db.exec(`UPDATE public.billing_subscriptions SET company_id = '${companyB}' WHERE id = '${subPdTest}';`),
    "55000",
    "Rejects updating company_id on billing_subscriptions"
  );

  // Summary
  console.log("\n-------------------------------------------------------");
  console.log(`TOTAL TESTS RUN: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed with unhandled error:", err);
  process.exit(1);
});
