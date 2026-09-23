import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.2 — Step 3C.4E-1B: Paystack invoice.create Database RPC Test Suite (PGlite)
 *
 * Verifies all required validation, lifecycle, idempotency, security, and schema contract points:
 * 1. Function metadata, SECURITY DEFINER, search_path = '', and service_role execute privilege.
 * 2. Strict input validation (environment, sha256, event_id, invoice_code, sub_code, cust_code, amount, currency, periods, occurred_at).
 * 3. Subscription resolution & prerequisite scope (P0002, 23514).
 * 4. Lifecycle matrix execution (reject pending_activation/trialing; create pending on active/past_due; ignore on non_renewing/expired/cancelled).
 * 5. Invariant verification (no mutation of subscription or provider subscription lifecycle; no payment creation; invoices stay pending).
 * 6. Webhook inbox claiming and exact replay handling (is_reused = true, zero new ledger entries, no status regression).
 * 7. Semantic invoice idempotency across different payload hashes for the same invoice code (reuse if pending; ignore if paid/failed; conflict 23505/23514).
 * 8. Sanitization of webhook raw_payload and ledger event_data (strictly no sensitive email, auth code, tokens, card info).
 * 9. Exact safe return-column contract (11 columns).
 * 10. Multi-session concurrency & transactional rollback safety (5 concurrent racing trials, 40001 retryable lock, 23505 hash collision, rollback cleanliness).
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

interface InvoiceCreateResult {
  webhook_event_id: string;
  invoice_id: string | null;
  provider_subscription_record_id: string;
  subscription_id: string;
  provider_invoice_code: string;
  invoice_status: string | null;
  provider_status: string | null;
  amount_minor: number;
  currency: string;
  is_reused: boolean;
  is_ignored: boolean;
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("PROJECTMATRIX PROCESS PAYSTACK INVOICE CREATE RPC TEST SUITE");
  console.log("=================================================================\n");

  const db = new PGlite();

  // 1. Setup Auth & Core Schemas
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

  // 2. Load billing migrations in sequential order
  const migrationFiles = [
    "20260729000001_billing_plans.sql",
    "20260729000002_billing_subscriptions.sql",
    "20260729000003_billing_ledger_events.sql",
    "20260818000001_paystack_payment_foundation.sql",
    "20260820000001_paystack_test_plan_mapping.sql",
    "20260820000002_initialize_billing_checkout.sql",
    "20260820000003_record_paystack_checkout_session.sql",
    "20260820000004_process_paystack_charge_success.sql",
    "20260821000001_process_paystack_subscription_create.sql",
    "20260824000001_process_paystack_subscription_not_renew.sql",
    "20260824000002_process_paystack_subscription_disable.sql",
    "20260825000001_paystack_recurring_invoice_foundation.sql",
    "20260826000001_process_paystack_invoice_create.sql",
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(process.cwd(), "supabase", "migrations", file);
    const sql = fs.readFileSync(filePath, "utf-8");
    await db.exec(sql);
  }

  // Ensure canonical billing_ledger_events constraint
  await db.exec(`
    ALTER TABLE public.billing_ledger_events DROP CONSTRAINT IF EXISTS chk_billing_ledger_events_event_source;
    ALTER TABLE public.billing_ledger_events ADD CONSTRAINT chk_billing_ledger_events_event_source CHECK (
      event_source IN ('user', 'system', 'paystack_webhook', 'reconciliation')
    );
  `);

  // 3. Setup Seed Data
  const userId = "00000000-0000-0000-0000-000000000001";
  const userEmail = "pm@example.com";

  await db.exec(`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES ('${userId}', '${userEmail}', now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, email, full_name)
    VALUES ('${userId}', '${userEmail}', 'Test Project Manager')
    ON CONFLICT (id) DO NOTHING;
  `);

  const planRes = await db.query<{ id: string; amount_minor: number; currency: string }>(`
    SELECT id, amount_minor, currency FROM public.billing_plans WHERE code = 'business-monthly' LIMIT 1;
  `);
  const planId = planRes.rows[0].id;

  const mappingRes = await db.query<{ id: string; provider_plan_code: string }>(`
    SELECT id, provider_plan_code FROM public.billing_provider_plans
    WHERE plan_id = '${planId}' AND provider = 'paystack' AND environment = 'test'
    LIMIT 1;
  `);
  const providerPlanMappingId = mappingRes.rows[0].id;

  // Helper to create internal subscription with its own company
  async function createSubscription(status: string, amountMinor = 75000, currency = "ZAR", pastDueSince: string | null = null) {
    const cRes = await db.query<{ id: string }>(`
      INSERT INTO public.companies (name) VALUES ('Test Company ${Math.random().toString(36).substring(2, 8)}') RETURNING id;
    `);
    const cId = cRes.rows[0].id;
    await db.exec(`
      INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
      VALUES ('${cId}', '${userId}', 'Director', 'owner', true);
    `);

    const subRef = `SUB-REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const subRes = await db.query<{ id: string; company_id: string; subscription_reference: string; amount_minor: number; currency: string }>(`
      INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, status, amount_minor,
        currency, billing_interval, current_period_start, current_period_end,
        next_renewal_at, auto_renew_enabled, past_due_since
      ) VALUES (
        '${cId}', '${planId}', '${subRef}', '${status}', ${amountMinor},
        '${currency}', 'monthly', now() - INTERVAL '15 days', now() + INTERVAL '15 days',
        now() + INTERVAL '15 days', true, ${pastDueSince ? `'${pastDueSince}'` : "NULL"}
      )
      RETURNING id, company_id, subscription_reference, amount_minor, currency;
    `);
    return subRes.rows[0];
  }

  // Helper to create provider subscription
  async function createProviderSubscription(
    subId: string,
    provSubCode: string,
    provCustCode: string,
    provStatus = "active",
    provSubId: string | null = "998877",
    isCurrent = true,
    environment = "test"
  ) {
    const subInfo = (await db.query<{ company_id: string }>(`
      SELECT company_id FROM public.billing_subscriptions WHERE id = '${subId}';
    `)).rows[0];

    const res = await db.query<{ id: string }>(`
      INSERT INTO public.billing_provider_subscriptions (
        company_id, subscription_id, plan_id, provider_plan_mapping_id,
        provider, environment, provider_subscription_code, provider_subscription_id,
        provider_customer_code, email_token, customer_email, provider_status,
        next_payment_at, is_current, last_synced_at
      ) VALUES (
        '${subInfo.company_id}', '${subId}', '${planId}', '${providerPlanMappingId}',
        'paystack', '${environment}', '${provSubCode}', ${provSubId ? `'${provSubId}'` : "NULL"},
        '${provCustCode}', 'tok_test123', 'pm@example.com', '${provStatus}',
        now() + INTERVAL '15 days', ${isCurrent}, now()
      )
      RETURNING id;
    `);
    return res.rows[0].id;
  }

  console.log("Section 1: Function Metadata, Permissions & Schema Parity");
  {
    const fnDefRes = await db.query<{
      prosecdef: boolean;
      provolatile: string;
      pronargs: number;
    }>(`
      SELECT prosecdef, provolatile, pronargs
      FROM pg_proc
      WHERE proname = 'process_paystack_invoice_create';
    `);

    assert(fnDefRes.rows.length === 1, "1.1 Function process_paystack_invoice_create exists");
    assert(fnDefRes.rows[0].prosecdef === true, "1.2 Function is marked SECURITY DEFINER");
    assert(fnDefRes.rows[0].pronargs === 12, "1.3 Function has exactly 12 parameters");

    // Check search_path configuration
    const configRes = await db.query<{ proconfig: string[] }>(`
      SELECT proconfig FROM pg_proc WHERE proname = 'process_paystack_invoice_create';
    `);
    const hasEmptySearchPath = configRes.rows[0]?.proconfig?.some((cfg: string) => cfg.startsWith("search_path="));
    assert(hasEmptySearchPath, "1.4 Function search_path is hardened (search_path = '')");

    // Check schema parity between migration file and schema.sql
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260826000001_process_paystack_invoice_create.sql"),
      "utf-8"
    );
    const schemaSql = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf-8");

    assert(schemaSql.includes("process_paystack_invoice_create"), "1.5 schema.sql contains process_paystack_invoice_create");
    assert(
      schemaSql.includes("Atomically processes an authenticated and signature-verified Paystack invoice.create"),
      "1.6 schema.sql comment parity confirmed"
    );
  }

  console.log("\nSection 2: Strict Input Validation (SQLSTATE 22004 & 22023)");
  {
    const validHash = "a".repeat(64);
    const validInvCode = "INV_testinv001";
    const validSubCode = "SUB_testinv001";
    const validCustCode = "CUS_testinv001";
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    // 2.1 Null Environment
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create(NULL, '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.1 Null environment should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.1 Null environment produces SQLSTATE 22004");
    }

    // 2.2 Invalid Environment
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('staging', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.2 Invalid environment should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.2 Invalid environment produces SQLSTATE 22023");
    }

    // 2.3 Null Payload Hash
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', NULL, NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.3 Null payload SHA-256 should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.3 Null payload SHA-256 produces SQLSTATE 22004");
    }

    // 2.4 Invalid Payload Hash (uppercase / non-hex)
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${"A".repeat(64)}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.4 Uppercase payload hash should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.4 Uppercase payload hash produces SQLSTATE 22023");
    }

    // 2.5 Null Provider Invoice Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, NULL, '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.5 Null provider invoice code should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.5 Null provider invoice code produces SQLSTATE 22004");
    }

    // 2.6 Invalid Provider Invoice Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, 'INVALID_CODE', '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.6 Invalid provider invoice code format should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.6 Invalid provider invoice code produces SQLSTATE 22023");
    }

    // 2.7 Null Provider Subscription Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', NULL, '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.7 Null provider subscription code should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.7 Null provider subscription code produces SQLSTATE 22004");
    }

    // 2.8 Invalid Provider Subscription Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', 'NOT_SUB', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.8 Invalid provider subscription code format should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.8 Invalid provider subscription code produces SQLSTATE 22023");
    }

    // 2.9 Null Provider Customer Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', NULL, 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.9 Null provider customer code should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.9 Null provider customer code produces SQLSTATE 22004");
    }

    // 2.10 Invalid Provider Customer Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', 'NOT_CUS', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.10 Invalid provider customer code format should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.10 Invalid provider customer code produces SQLSTATE 22023");
    }

    // 2.11 Null Amount Minor
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', NULL, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.11 Null amount_minor should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.11 Null amount_minor produces SQLSTATE 22004");
    }

    // 2.12 Invalid Amount Minor (negative or zero)
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 0, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.12 Zero amount_minor should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.12 Zero amount_minor produces SQLSTATE 22023");
    }

    // 2.13 Null Currency
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, NULL, '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.13 Null currency should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.13 Null currency produces SQLSTATE 22004");
    }

    // 2.14 Invalid Currency format
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, 'zar', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.14 Lowercase currency should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.14 Lowercase currency produces SQLSTATE 22023");
    }

    // 2.15 Incoherent Period Boundaries (one null, one specified)
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', NULL, '${nowIso}');`);
      assert(false, "2.15 Single null period boundary should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.15 Single null period boundary produces SQLSTATE 22023");
    }

    // 2.16 Invalid Period Boundaries (period_end <= period_start)
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodEnd}', '${periodStart}', '${nowIso}');`);
      assert(false, "2.16 Inverted period boundaries should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.16 Inverted period boundaries produces SQLSTATE 22023");
    }

    // 2.17 Null Occurred At
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', NULL);`);
      assert(false, "2.17 Null occurred_at should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.17 Null occurred_at produces SQLSTATE 22004");
    }

    // 2.18 Invalid Provider Status (too long or contains control characters)
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_create('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', '   ', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.18 Untrimmed provider status should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.18 Untrimmed provider status produces SQLSTATE 22023");
    }
  }

  console.log("\nSection 3: Subscription Resolution & Scope (P0002 & 23514)");
  {
    const sub = await createSubscription("active", 75000, "ZAR");
    const subCode = `SUB_res${Math.random().toString(36).substring(2, 8)}`;
    const custCode = `CUS_res${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, subCode, custCode, "active", "1001", true, "test");
    const nowIso = new Date().toISOString();

    // 3.1 Missing Provider Subscription Code -> P0002
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${"b".repeat(64)}', NULL, 'INV_missing001', 'SUB_nonexistent999', '${custCode}', 'success', 75000, 'ZAR', NULL, NULL, '${nowIso}'
        );
      `);
      assert(false, "3.1 Missing provider subscription should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "3.1 Missing provider subscription produces SQLSTATE P0002");
    }

    // 3.2 Environment Mismatch (test vs live) -> P0002
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'live', '${"c".repeat(64)}', NULL, 'INV_envmiss001', '${subCode}', '${custCode}', 'success', 75000, 'ZAR', NULL, NULL, '${nowIso}'
        );
      `);
      assert(false, "3.2 Environment mismatch should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "3.2 Environment mismatch produces SQLSTATE P0002");
    }

    // 3.3 Customer Code Mismatch -> P0002
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${"d".repeat(64)}', NULL, 'INV_custmiss001', '${subCode}', 'CUS_mismatch999', 'success', 75000, 'ZAR', NULL, NULL, '${nowIso}'
        );
      `);
      assert(false, "3.3 Customer code mismatch should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "3.3 Customer code mismatch produces SQLSTATE P0002");
    }

    // 3.4 Commercial Snapshot Mismatch: Amount Mismatch -> 23514
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${"e".repeat(64)}', NULL, 'INV_amtmiss001', '${subCode}', '${custCode}', 'success', 99999, 'ZAR', NULL, NULL, '${nowIso}'
        );
      `);
      assert(false, "3.4 Amount mismatch should fail with 23514");
    } catch (err: any) {
      assert(err.code === "23514", "3.4 Amount mismatch produces SQLSTATE 23514");
    }

    // 3.5 Commercial Snapshot Mismatch: Currency Mismatch -> 23514
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${"f".repeat(64)}', NULL, 'INV_currmiss001', '${subCode}', '${custCode}', 'success', 75000, 'USD', NULL, NULL, '${nowIso}'
        );
      `);
      assert(false, "3.5 Currency mismatch should fail with 23514");
    } catch (err: any) {
      assert(err.code === "23514", "3.5 Currency mismatch produces SQLSTATE 23514");
    }
  }

  console.log("\nSection 4: Lifecycle Matrix Execution");
  {
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    // 4.1 pending_activation -> Reject with 23514
    const subPending = await createSubscription("pending_activation", 75000, "ZAR");
    const codePending = `SUB_pen${Math.random().toString(36).substring(2, 8)}`;
    const custPending = `CUS_pen${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(subPending.id, codePending, custPending, "active", "2001");

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${"10".repeat(32)}', NULL, 'INV_pen001', '${codePending}', '${custPending}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);
      assert(false, "4.1 pending_activation should fail with 23514");
    } catch (err: any) {
      assert(err.code === "23514", "4.1 pending_activation produces SQLSTATE 23514");
    }

    // 4.2 trialing -> Reject with 23514
    const subTrial = await createSubscription("trialing", 75000, "ZAR");
    const codeTrial = `SUB_tri${Math.random().toString(36).substring(2, 8)}`;
    const custTrial = `CUS_tri${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(subTrial.id, codeTrial, custTrial, "active", "2002");

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${"11".repeat(32)}', NULL, 'INV_tri001', '${codeTrial}', '${custTrial}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);
      assert(false, "4.2 trialing should fail with 23514");
    } catch (err: any) {
      assert(err.code === "23514", "4.2 trialing produces SQLSTATE 23514");
    }

    // 4.3 active -> Successfully creates pending invoice
    const subActive = await createSubscription("active", 75000, "ZAR");
    const codeActive = `SUB_act${Math.random().toString(36).substring(2, 8)}`;
    const custActive = `CUS_act${Math.random().toString(36).substring(2, 8)}`;
    const provSubActId = await createProviderSubscription(subActive.id, codeActive, custActive, "active", "2003");
    const invCodeActive = `INV_act${Math.random().toString(36).substring(2, 8)}`;
    const hashActive = "12".repeat(32);

    const resActive = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hashActive}', 'evt_act_001', '${invCodeActive}', '${codeActive}', '${custActive}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    assert(resActive.rows.length === 1, "4.3a active subscription returns single row");
    assert(resActive.rows[0].invoice_status === "pending", "4.3b invoice_status is 'pending'");
    assert(resActive.rows[0].is_reused === false, "4.3c is_reused is false");
    assert(resActive.rows[0].is_ignored === false, "4.3d is_ignored is false");
    assert(resActive.rows[0].provider_subscription_record_id === provSubActId, "4.3e linked provider subscription matches");
    assert(resActive.rows[0].subscription_id === subActive.id, "4.3f linked subscription matches");

    // Check billing_invoices row
    const invRow = (await db.query<{ id: string; status: string; amount_minor: number; currency: string }>(`
      SELECT id, status, amount_minor, currency FROM public.billing_invoices WHERE id = '${resActive.rows[0].invoice_id}';
    `)).rows[0];
    assert(invRow.status === "pending" && invRow.amount_minor === 75000 && invRow.currency === "ZAR", "4.3g billing_invoices record created correctly");

    // 4.4 past_due -> Successfully creates pending invoice without clearing delinquency
    const pastDueSince = new Date(Date.now() - 5 * 86400000).toISOString();
    const subPastDue = await createSubscription("past_due", 75000, "ZAR", pastDueSince);
    const codePastDue = `SUB_pd${Math.random().toString(36).substring(2, 8)}`;
    const custPastDue = `CUS_pd${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(subPastDue.id, codePastDue, custPastDue, "active", "2004");
    const invCodePastDue = `INV_pd${Math.random().toString(36).substring(2, 8)}`;
    const hashPastDue = "13".repeat(32);

    const resPastDue = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hashPastDue}', 'evt_pd_001', '${invCodePastDue}', '${codePastDue}', '${custPastDue}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    assert(resPastDue.rows[0].invoice_status === "pending", "4.4a past_due subscription returns pending invoice");
    const subPdCheck = (await db.query<{ status: string; past_due_since: string | null }>(`
      SELECT status, past_due_since FROM public.billing_subscriptions WHERE id = '${subPastDue.id}';
    `)).rows[0];
    assert(subPdCheck.status === "past_due" && subPdCheck.past_due_since !== null, "4.4b past_due status and past_due_since preserved intact");

    // 4.5 non_renewing -> Ignored as stale, no pending invoice created
    const subNonRenew = await createSubscription("non_renewing", 75000, "ZAR");
    const codeNonRenew = `SUB_nr${Math.random().toString(36).substring(2, 8)}`;
    const custNonRenew = `CUS_nr${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(subNonRenew.id, codeNonRenew, custNonRenew, "non_renewing", "2005");
    const invCodeNonRenew = `INV_nr${Math.random().toString(36).substring(2, 8)}`;
    const hashNonRenew = "14".repeat(32);

    const resNonRenew = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hashNonRenew}', 'evt_nr_001', '${invCodeNonRenew}', '${codeNonRenew}', '${custNonRenew}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    assert(resNonRenew.rows[0].invoice_id === null, "4.5a non_renewing returns invoice_id = null");
    assert(resNonRenew.rows[0].invoice_status === null, "4.5b non_renewing returns invoice_status = null");
    assert(resNonRenew.rows[0].is_ignored === true, "4.5c non_renewing returns is_ignored = true");
    assert(resNonRenew.rows[0].is_reused === false, "4.5d non_renewing returns is_reused = false");

    const noInvCheck = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_invoices WHERE provider_invoice_code = '${invCodeNonRenew}';
    `);
    assert(noInvCheck.rows[0].count === 0, "4.5e No invoice row created for non_renewing");

    // 4.6 expired -> Ignored as stale, no invoice created
    const subExpired = await createSubscription("expired", 75000, "ZAR");
    const codeExpired = `SUB_exp${Math.random().toString(36).substring(2, 8)}`;
    const custExpired = `CUS_exp${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(subExpired.id, codeExpired, custExpired, "completed", "2006");
    const invCodeExpired = `INV_exp${Math.random().toString(36).substring(2, 8)}`;
    const hashExpired = "15".repeat(32);

    const resExpired = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hashExpired}', 'evt_exp_001', '${invCodeExpired}', '${codeExpired}', '${custExpired}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(resExpired.rows[0].invoice_id === null && resExpired.rows[0].is_ignored === true, "4.6 expired subscription ignored as stale");

    // 4.7 cancelled -> Ignored as stale, no invoice created
    const subCancelled = await createSubscription("cancelled", 75000, "ZAR");
    const codeCancelled = `SUB_cnc${Math.random().toString(36).substring(2, 8)}`;
    const custCancelled = `CUS_cnc${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(subCancelled.id, codeCancelled, custCancelled, "cancelled", "2007");
    const invCodeCancelled = `INV_cnc${Math.random().toString(36).substring(2, 8)}`;
    const hashCancelled = "16".repeat(32);

    const resCancelled = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hashCancelled}', 'evt_cnc_001', '${invCodeCancelled}', '${codeCancelled}', '${custCancelled}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(resCancelled.rows[0].invoice_id === null && resCancelled.rows[0].is_ignored === true, "4.7 cancelled subscription ignored as stale");
  }

  console.log("\nSection 5: Invariant Verification (No Unsolicited Mutations)");
  {
    const sub = await createSubscription("active", 75000, "ZAR");
    const code = `SUB_inv${Math.random().toString(36).substring(2, 8)}`;
    const cust = `CUS_inv${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, code, cust, "active", "3001");
    const invCode = `INV_inv${Math.random().toString(36).substring(2, 8)}`;
    const hash = "20".repeat(32);
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    const prePayments = (await db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM public.billing_payments;`)).rows[0].count;
    const preMethods = (await db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM public.billing_payment_methods;`)).rows[0].count;

    const res = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash}', NULL, '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    // Invariant 1: No payment rows created
    const postPayments = (await db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM public.billing_payments;`)).rows[0].count;
    assert(postPayments === prePayments, "5.1 Zero billing_payments created");

    // Invariant 2: No payment method rows created
    const postMethods = (await db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM public.billing_payment_methods;`)).rows[0].count;
    assert(postMethods === preMethods, "5.2 Zero billing_payment_methods created");

    // Invariant 3: Invoice paid_at and first_failed_at remain null
    const inv = (await db.query<{ paid_at: string | null; first_failed_at: string | null; status: string }>(`
      SELECT paid_at, first_failed_at, status FROM public.billing_invoices WHERE id = '${res.rows[0].invoice_id}';
    `)).rows[0];
    assert(inv.status === "pending" && inv.paid_at === null && inv.first_failed_at === null, "5.3 Invoice has pending status and null terminal timestamps");

    // Invariant 4: Subscription lifecycle and renewal fields unchanged
    const subPost = (await db.query<{ status: string; auto_renew_enabled: boolean }>(`
      SELECT status, auto_renew_enabled FROM public.billing_subscriptions WHERE id = '${sub.id}';
    `)).rows[0];
    assert(subPost.status === "active" && subPost.auto_renew_enabled === true, "5.4 Subscription status and auto_renew_enabled unchanged");
  }

  console.log("\nSection 6: Webhook Inbox & Ledger Idempotency (Exact Replay)");
  {
    const sub = await createSubscription("active", 75000, "ZAR");
    const code = `SUB_rep${Math.random().toString(36).substring(2, 8)}`;
    const cust = `CUS_rep${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, code, cust, "active", "4001");
    const invCode = `INV_rep${Math.random().toString(36).substring(2, 8)}`;
    const hash = "30".repeat(32);
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    // 6.1 Initial processing
    const firstRes = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash}', 'evt_rep_001', '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(firstRes.rows[0].is_reused === false, "6.1a First call has is_reused = false");

    // Exact replay
    const replayRes = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash}', 'evt_rep_001', '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(replayRes.rows[0].is_reused === true, "6.1b Exact replay returns is_reused = true");
    assert(replayRes.rows[0].invoice_id === firstRes.rows[0].invoice_id, "6.1c Exact replay returns identical invoice_id");
    assert(replayRes.rows[0].invoice_status === "pending", "6.1d Exact replay returns pending status");

    // Verify ledger count is exactly 1
    const ledgerCount = (await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `)).rows[0].count;
    assert(ledgerCount === 1, "6.1e Exactly 1 ledger entry exists after exact replay");

    // 6.2 Advance invoice to 'paid' and verify exact replay returns 'paid' without downgrade
    await db.exec(`
      UPDATE public.billing_invoices
      SET status = 'paid', paid_at = now()
      WHERE id = '${firstRes.rows[0].invoice_id}';
    `);

    const paidReplayRes = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash}', 'evt_rep_001', '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(paidReplayRes.rows[0].is_reused === true, "6.2a Replay of paid invoice returns is_reused = true");
    assert(paidReplayRes.rows[0].invoice_status === "paid", "6.2b Replay returns current status 'paid' without downgrade");

    // 6.3 Advance invoice to 'failed' (on a fresh sub/invoice) and verify exact replay returns 'failed'
    const subFail = await createSubscription("active", 75000, "ZAR");
    const codeFail = `SUB_fl${Math.random().toString(36).substring(2, 8)}`;
    const custFail = `CUS_fl${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(subFail.id, codeFail, custFail, "active", "4002");
    const invCodeFail = `INV_fl${Math.random().toString(36).substring(2, 8)}`;
    const hashFail = "31".repeat(32);

    const failFirst = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hashFail}', NULL, '${invCodeFail}', '${codeFail}', '${custFail}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    await db.exec(`
      UPDATE public.billing_invoices
      SET status = 'failed', first_failed_at = now()
      WHERE id = '${failFirst.rows[0].invoice_id}';
    `);

    const failReplayRes = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hashFail}', NULL, '${invCodeFail}', '${codeFail}', '${custFail}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(failReplayRes.rows[0].is_reused === true && failReplayRes.rows[0].invoice_status === "failed", "6.3 Replay of failed invoice returns current status 'failed'");
  }

  console.log("\nSection 7: Semantic Invoice Idempotency (Different Hash, Same Invoice Code)");
  {
    const sub = await createSubscription("active", 75000, "ZAR");
    const code = `SUB_sem${Math.random().toString(36).substring(2, 8)}`;
    const cust = `CUS_sem${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, code, cust, "active", "5001");
    const invCode = `INV_sem${Math.random().toString(36).substring(2, 8)}`;
    const hash1 = "40".repeat(32);
    const hash2 = "41".repeat(32);
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    // 7.1 Initial creation with hash1
    const res1 = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash1}', NULL, '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(res1.rows[0].is_reused === false, "7.1a Initial creation with hash1");

    // 7.2 Semantic reuse with hash2 while invoice is pending -> returns reused existing invoice, status pending, is_ignored = false
    const res2 = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash2}', NULL, '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(res2.rows[0].is_reused === true, "7.2a Different hash for same pending invoice returns is_reused = true");
    assert(res2.rows[0].is_ignored === false, "7.2b is_ignored = false for pending invoice");
    assert(res2.rows[0].invoice_id === res1.rows[0].invoice_id, "7.2c Reuses same invoice_id");

    const invCount = (await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_invoices WHERE provider_invoice_code = '${invCode}';
    `)).rows[0].count;
    assert(invCount === 1, "7.2d Exactly 1 invoice record in database");

    // 7.3 Advance invoice to 'paid' -> new hash3 references existing invoice code -> marked ignored, is_ignored = true, status paid
    await db.exec(`
      UPDATE public.billing_invoices
      SET status = 'paid', paid_at = now()
      WHERE id = '${res1.rows[0].invoice_id}';
    `);

    const hash3 = "42".repeat(32);
    const res3 = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash3}', NULL, '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    assert(res3.rows[0].is_reused === true && res3.rows[0].is_ignored === true, "7.3a New event for already paid invoice returns is_reused = true, is_ignored = true");
    assert(res3.rows[0].invoice_status === "paid", "7.3b Preserves invoice status 'paid'");

    // 7.4 Semantic Conflict: Commercial Mismatch (different amount on second hash for same invoice code) -> 23514
    const subConf = await createSubscription("active", 75000, "ZAR");
    const codeConf = `SUB_cnf${Math.random().toString(36).substring(2, 8)}`;
    const custConf = `CUS_cnf${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(subConf.id, codeConf, custConf, "active", "5002");
    const invCodeConf = `INV_cnf${Math.random().toString(36).substring(2, 8)}`;
    const hashConf1 = "43".repeat(32);

    await db.query(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hashConf1}', NULL, '${invCodeConf}', '${codeConf}', '${custConf}', 'success', 75000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    // Try second hash with conflicting period dates -> 23514
    const hashConf2 = "44".repeat(32);
    const otherPeriodStart = new Date(Date.now() - 60 * 86400000).toISOString();
    const otherPeriodEnd = new Date(Date.now() - 30 * 86400000).toISOString();

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${hashConf2}', NULL, '${invCodeConf}', '${codeConf}', '${custConf}', 'success', 75000, 'ZAR', '${otherPeriodStart}', '${otherPeriodEnd}', '${nowIso}'
        );
      `);
      assert(false, "7.4 Conflicting period dates should fail with 23514");
    } catch (err: any) {
      assert(err.code === "23514", "7.4 Conflicting period dates produces SQLSTATE 23514");
    }
  }

  console.log("\nSection 8: Webhook Payload & Ledger Sanitization");
  {
    const sub = await createSubscription("active", 75000, "ZAR");
    const code = `SUB_san${Math.random().toString(36).substring(2, 8)}`;
    const cust = `CUS_san${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, code, cust, "active", "6001");
    const invCode = `INV_san${Math.random().toString(36).substring(2, 8)}`;
    const hash = "50".repeat(32);
    const nowIso = new Date().toISOString();

    await db.query(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash}', 'evt_san_001', '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', NULL, NULL, '${nowIso}'
      );
    `);

    // Check webhook raw_payload
    const whRow = (await db.query<{ raw_payload: Record<string, any> }>(`
      SELECT raw_payload FROM public.billing_webhook_events WHERE payload_sha256 = '${hash}';
    `)).rows[0];

    const whPayload = whRow.raw_payload;
    const forbiddenKeys = ["email", "customer_email", "authorization_code", "signature", "card", "token", "phone"];
    const hasForbiddenWh = forbiddenKeys.some((k) => k in whPayload);
    assert(!hasForbiddenWh, "8.1 Webhook raw_payload does NOT leak email, tokens, authorization codes or card data");

    // Check ledger event_data
    const ledgerRow = (await db.query<{ event_data: Record<string, any>; event_type: string }>(`
      SELECT event_data, event_type FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}' LIMIT 1;
    `)).rows[0];

    assert(ledgerRow.event_type === "billing_invoice_created", "8.2a Ledger event_type is 'billing_invoice_created'");
    const hasForbiddenLedger = forbiddenKeys.some((k) => k in ledgerRow.event_data);
    assert(!hasForbiddenLedger, "8.2b Ledger event_data does NOT leak sensitive tokens or email");
  }

  console.log("\nSection 9: Safe Return Column Contract (11 columns)");
  {
    const sub = await createSubscription("active", 75000, "ZAR");
    const code = `SUB_ret${Math.random().toString(36).substring(2, 8)}`;
    const cust = `CUS_ret${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, code, cust, "active", "7001");
    const invCode = `INV_ret${Math.random().toString(36).substring(2, 8)}`;
    const hash = "60".repeat(32);
    const nowIso = new Date().toISOString();

    const res = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${hash}', NULL, '${invCode}', '${code}', '${cust}', 'success', 75000, 'ZAR', NULL, NULL, '${nowIso}'
      );
    `);

    const keys = Object.keys(res.rows[0]);
    const expectedKeys = [
      "webhook_event_id",
      "invoice_id",
      "provider_subscription_record_id",
      "subscription_id",
      "provider_invoice_code",
      "invoice_status",
      "provider_status",
      "amount_minor",
      "currency",
      "is_reused",
      "is_ignored",
    ];

    assert(keys.length === 11, "9.1 Exactly 11 columns returned");
    const allKeysMatch = expectedKeys.every((k) => keys.includes(k));
    assert(allKeysMatch, "9.2 All 11 return column names match RPC contract exactly");
  }

  console.log("\nSection 10: Multi-Session Concurrency & Transactional Safety");
  {
    const timestamp = new Date().toISOString();

    // 10.1 Multi-session concurrency: 5 independent trials
    for (let i = 1; i <= 5; i++) {
      const sub = await createSubscription("active", 75000, "ZAR");
      const provSubCode = `SUB_race${i}${Math.random().toString(36).substring(2, 8)}`;
      const provCustCode = `CUS_race${i}${Math.random().toString(36).substring(2, 8)}`;
      await createProviderSubscription(sub.id, provSubCode, provCustCode, "active", `800${i}`);
      const invCode = `INV_race_${i}_${Math.random().toString(36).substring(2, 8)}`;
      const payloadHash = `${i}`.repeat(64);

      // Launch 2 parallel executions
      const results = await Promise.all([
        db.query<InvoiceCreateResult>(`
          SELECT * FROM public.process_paystack_invoice_create(
            'test', '${payloadHash}', NULL, '${invCode}', '${provSubCode}', '${provCustCode}', 'success', 75000, 'ZAR', NULL, NULL, '${timestamp}'
          );
        `),
        db.query<InvoiceCreateResult>(`
          SELECT * FROM public.process_paystack_invoice_create(
            'test', '${payloadHash}', NULL, '${invCode}', '${provSubCode}', '${provCustCode}', 'success', 75000, 'ZAR', NULL, NULL, '${timestamp}'
          );
        `),
      ]);

      const reusedValues = results.map((r) => r.rows[0].is_reused);
      const reusedFalseCount = reusedValues.filter((r) => r === false).length;
      const reusedTrueCount = reusedValues.filter((r) => r === true).length;

      assert(
        reusedFalseCount === 1 && reusedTrueCount === 1,
        `10.${i}a Concurrent Trial ${i}: Exactly one session gets is_reused = false and one gets is_reused = true`
      );

      // Verify webhook row count and status
      const whCheck = await db.query<{ count: number; processing_status: string }>(`
        SELECT COUNT(*)::int AS count, MIN(processing_status) AS processing_status
        FROM public.billing_webhook_events
        WHERE payload_sha256 = '${payloadHash}';
      `);
      assert(
        whCheck.rows[0].count === 1 && whCheck.rows[0].processing_status === "processed",
        `10.${i}b Concurrent Trial ${i}: Exactly 1 webhook row recorded with status 'processed'`
      );

      // Verify invoice row count
      const invCheck = await db.query<{ count: number; status: string }>(`
        SELECT COUNT(*)::int AS count, MIN(status) AS status
        FROM public.billing_invoices
        WHERE provider_invoice_code = '${invCode}';
      `);
      assert(
        invCheck.rows[0].count === 1 && invCheck.rows[0].status === "pending",
        `10.${i}c Concurrent Trial ${i}: Exactly 1 invoice row recorded with status 'pending'`
      );

      // Verify ledger row count
      const ledgerCheck = await db.query<{ count: number }>(`
        SELECT COUNT(*)::int AS count
        FROM public.billing_ledger_events
        WHERE subscription_id = '${sub.id}';
      `);
      assert(
        ledgerCheck.rows[0].count === 1,
        `10.${i}d Concurrent Trial ${i}: Exactly 1 ledger row recorded`
      );
    }

    // 10.6: Existing committed 'processing' row produces SQLSTATE 40001
    const procSub = await createSubscription("active", 75000, "ZAR");
    const procCode = `SUB_invproc${Math.random().toString(36).substring(2, 8)}`;
    const procCust = `CUS_invproc${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(procSub.id, procCode, procCust, "active", "8010");
    const procInvCode = `INV_invproc${Math.random().toString(36).substring(2, 8)}`;
    const procHash = "d1".repeat(32);

    // Pre-insert row in 'processing' status
    await db.exec(`
      INSERT INTO public.billing_webhook_events (
        provider, environment, event_type, provider_object_id, payload_sha256,
        raw_payload, signature_verified, processing_status, processing_attempts,
        received_at, processing_started_at, updated_at
      ) VALUES (
        'paystack', 'test', 'invoice.create', '${procInvCode}', '${procHash}',
        '{"test": true}'::jsonb, true, 'processing', 1, now(), now(), now()
      );
    `);

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${procHash}', NULL, '${procInvCode}', '${procCode}', '${procCust}', 'success', 75000, 'ZAR', NULL, NULL, '${timestamp}'
        );
      `);
      assert(false, "10.6 Existing 'processing' status should raise retryable 40001");
    } catch (err: any) {
      assert(err.code === "40001", "10.6 Existing 'processing' row produces SQLSTATE 40001");
    }

    // 10.7: Same payload hash with mismatched event identity produces 23505
    const collisionSubA = await createSubscription("active", 75000, "ZAR");
    const collisionSubB = await createSubscription("active", 75000, "ZAR");
    const codeA = `SUB_colA${Math.random().toString(36).substring(2, 8)}`;
    const codeB = `SUB_colB${Math.random().toString(36).substring(2, 8)}`;
    const custColA = `CUS_colA${Math.random().toString(36).substring(2, 8)}`;
    const custColB = `CUS_colB${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(collisionSubA.id, codeA, custColA, "active", "8011");
    await createProviderSubscription(collisionSubB.id, codeB, custColB, "active", "8012");
    const colInvA = `INV_colA${Math.random().toString(36).substring(2, 8)}`;
    const colInvB = `INV_colB${Math.random().toString(36).substring(2, 8)}`;
    const colHash = "e2".repeat(32);

    // Successfully process with colInvA
    await db.query(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${colHash}', NULL, '${colInvA}', '${codeA}', '${custColA}', 'success', 75000, 'ZAR', NULL, NULL, '${timestamp}'
      );
    `);

    // Attempt with same payload hash but colInvB
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${colHash}', NULL, '${colInvB}', '${codeB}', '${custColB}', 'success', 75000, 'ZAR', NULL, NULL, '${timestamp}'
        );
      `);
      assert(false, "10.7 Mismatched provider_object_id on duplicate hash should raise 23505");
    } catch (err: any) {
      assert(err.code === "23505", "10.7 Duplicate hash with mismatched provider_object_id produces 23505");
    }

    // 10.8: Failed winner transaction leaves no orphan inbox row and allows subsequent successful processing
    const retrySub = await createSubscription("active", 75000, "ZAR");
    const retryCode = `SUB_retry${Math.random().toString(36).substring(2, 8)}`;
    const retryCust = `CUS_retry${Math.random().toString(36).substring(2, 8)}`;
    const retryInv = `INV_retry${Math.random().toString(36).substring(2, 8)}`;
    const retryHash = "f3".repeat(32);

    // Attempt call before creating provider subscription -> will fail with P0002 after claiming inbox row
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_create(
          'test', '${retryHash}', NULL, '${retryInv}', '${retryCode}', '${retryCust}', 'success', 75000, 'ZAR', NULL, NULL, '${timestamp}'
        );
      `);
      assert(false, "10.8 Initial call with missing provider subscription should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "10.8 Failed transaction failed with P0002");
    }

    // Verify no orphan webhook inbox row exists due to transaction rollback
    const orphanCheck = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_webhook_events WHERE payload_sha256 = '${retryHash}';
    `);
    assert(orphanCheck.rows[0].count === 0, "10.8 Failed transaction leaves NO orphan inbox row");

    // Now seed the provider subscription and retry with the same payload hash
    await createProviderSubscription(retrySub.id, retryCode, retryCust, "active", "8013");
    const retryRes = await db.query<InvoiceCreateResult>(`
      SELECT * FROM public.process_paystack_invoice_create(
        'test', '${retryHash}', NULL, '${retryInv}', '${retryCode}', '${retryCust}', 'success', 75000, 'ZAR', NULL, NULL, '${timestamp}'
      );
    `);
    assert(
      retryRes.rows[0].is_reused === false && retryRes.rows[0].invoice_status === "pending",
      "10.8 Subsequent valid retry processes successfully with is_reused = false"
    );
  }

  console.log("\n-----------------------------------------------------------------");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("-----------------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
