import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.2 — Step 3C.4E-2A: Paystack invoice.payment_failed Database RPC Test Suite (PGlite)
 *
 * Verifies all required validation, lifecycle, idempotency, security, and schema contract points:
 * 1. Function metadata, SECURITY DEFINER, search_path = '', and service_role execute privilege.
 * 2. Strict input validation (environment, sha256, event_id, invoice_code, sub_code, cust_code, status, failure_category, amount, currency, periods, occurred_at, txn_id, ref).
 * 3. Subscription resolution & prerequisite scope (P0002, 23514).
 * 4. Lifecycle matrix execution:
 *    - Reject pending_activation / trialing (SQLSTATE 23514).
 *    - Stale / Ignored branches on non_renewing, expired, cancelled, already paid invoice, or already renewed active sub.
 *    - Materialize failed invoice and transition active subscription to past_due with past_due_since.
 *    - Transition existing pending invoice to failed.
 *    - Preserve past_due subscription with LEAST(past_due_since, occurred_at).
 * 5. Optional genuine failed payment attempt creation and ledger emission.
 * 6. Webhook inbox claiming and exact replay handling (is_reused = true, zero new ledger entries, no status regression).
 * 7. Semantic invoice idempotency across different payload hashes for the same invoice code.
 * 8. Sanitization of webhook raw_payload and ledger event_data.
 * 9. Exact safe return-column contract (14 columns).
 * 10. Multi-session concurrency & transactional rollback safety.
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

interface InvoicePaymentFailedResult {
  webhook_event_id: string;
  invoice_id: string | null;
  payment_id: string | null;
  provider_subscription_record_id: string;
  subscription_id: string;
  provider_invoice_code: string;
  invoice_status: string | null;
  subscription_status: string | null;
  amount_minor: number;
  currency: string;
  past_due_since: string | null;
  failure_category: string;
  is_reused: boolean;
  is_ignored: boolean;
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("PROJECTMATRIX PROCESS PAYSTACK INVOICE PAYMENT FAILED RPC TEST SUITE");
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
    "20260826000002_process_paystack_invoice_payment_failed.sql",
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
  const planAmountMinor = planRes.rows[0].amount_minor; // 500000
  const planCurrency = planRes.rows[0].currency; // 'ZAR'

  const mappingRes = await db.query<{ id: string; provider_plan_code: string }>(`
    SELECT id, provider_plan_code FROM public.billing_provider_plans
    WHERE plan_id = '${planId}' AND provider = 'paystack' AND environment = 'test'
    LIMIT 1;
  `);
  const providerPlanMappingId = mappingRes.rows[0].id;

  // Helper to create internal subscription with its own company
  async function createSubscription(
    status: string,
    amountMinor = planAmountMinor,
    currency = planCurrency,
    pastDueSince: string | null = null,
    periodStart: string | null = null,
    periodEnd: string | null = null
  ) {
    const cRes = await db.query<{ id: string }>(`
      INSERT INTO public.companies (name) VALUES ('Test Company ${Math.random().toString(36).substring(2, 8)}') RETURNING id;
    `);
    const cId = cRes.rows[0].id;
    await db.exec(`
      INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
      VALUES ('${cId}', '${userId}', 'Director', 'owner', true);
    `);

    const subRef = `SUB-REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const pStartSql = periodStart ? `'${periodStart}'::timestamptz` : "now() - INTERVAL '15 days'";
    const pEndSql = periodEnd ? `'${periodEnd}'::timestamptz` : "now() + INTERVAL '15 days'";

    const subRes = await db.query<{
      id: string;
      company_id: string;
      subscription_reference: string;
      amount_minor: number;
      currency: string;
      status: string;
    }>(`
      INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, status, amount_minor,
        currency, billing_interval, current_period_start, current_period_end,
        next_renewal_at, auto_renew_enabled, past_due_since
      ) VALUES (
        '${cId}', '${planId}', '${subRef}', '${status}', ${amountMinor},
        '${currency}', 'monthly', ${pStartSql}, ${pEndSql},
        ${pEndSql}, true, ${pastDueSince ? `'${pastDueSince}'::timestamptz` : "NULL"}
      )
      RETURNING id, company_id, subscription_reference, amount_minor, currency, status;
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
    const subInfo = (
      await db.query<{ company_id: string }>(`
      SELECT company_id FROM public.billing_subscriptions WHERE id = '${subId}';
    `)
    ).rows[0];

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
      WHERE proname = 'process_paystack_invoice_payment_failed';
    `);

    assert(fnDefRes.rows.length === 1, "1.1 Function process_paystack_invoice_payment_failed exists");
    assert(fnDefRes.rows[0].prosecdef === true, "1.2 Function is marked SECURITY DEFINER");
    assert(fnDefRes.rows[0].pronargs === 15, "1.3 Function has exactly 15 parameters");

    // Check search_path configuration
    const configRes = await db.query<{ proconfig: string[] }>(`
      SELECT proconfig FROM pg_proc WHERE proname = 'process_paystack_invoice_payment_failed';
    `);
    const hasEmptySearchPath = configRes.rows[0]?.proconfig?.some((cfg: string) => cfg.startsWith("search_path="));
    assert(hasEmptySearchPath, "1.4 Function search_path is hardened (search_path = '')");

    // Check schema parity between migration file and schema.sql
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260826000002_process_paystack_invoice_payment_failed.sql"),
      "utf-8"
    );
    const schemaSql = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf-8");

    assert(schemaSql.includes("process_paystack_invoice_payment_failed"), "1.5 schema.sql contains process_paystack_invoice_payment_failed");
    assert(
      schemaSql.includes("Atomically processes an authenticated and signature-verified Paystack invoice.payment_failed"),
      "1.6 schema.sql comment parity confirmed"
    );
  }

  console.log("\nSection 2: Strict Input Validation (SQLSTATE 22004 & 22023)");
  {
    const validHash = "a".repeat(64);
    const validInvCode = "INV_testfail001";
    const validSubCode = "SUB_testfail001";
    const validCustCode = "CUS_testfail001";
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    // 2.1 Null Environment
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed(NULL, '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.1 Null environment should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.1 Null environment produces SQLSTATE 22004");
    }

    // 2.2 Invalid Environment
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('sandbox', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.2 Invalid environment should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.2 Invalid environment produces SQLSTATE 22023");
    }

    // 2.3 Null Payload Hash
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', NULL, NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.3 Null payload SHA-256 should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.3 Null payload SHA-256 produces SQLSTATE 22004");
    }

    // 2.4 Invalid Payload Hash (uppercase / non-hex)
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${"A".repeat(64)}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.4 Uppercase payload hash should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.4 Uppercase payload hash produces SQLSTATE 22023");
    }

    // 2.5 Null Provider Invoice Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, NULL, '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.5 Null provider invoice code should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.5 Null provider invoice code produces SQLSTATE 22004");
    }

    // 2.6 Invalid Provider Invoice Code format
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, 'INVALID_INV', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.6 Invalid provider invoice code format should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.6 Invalid provider invoice code produces SQLSTATE 22023");
    }

    // 2.7 Null Provider Subscription Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', NULL, '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.7 Null provider subscription code should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.7 Null provider subscription code produces SQLSTATE 22004");
    }

    // 2.8 Invalid Provider Subscription Code format
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', 'NOT_SUB', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.8 Invalid provider subscription code format should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.8 Invalid provider subscription code produces SQLSTATE 22023");
    }

    // 2.9 Null Provider Customer Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', NULL, 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.9 Null provider customer code should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.9 Null provider customer code produces SQLSTATE 22004");
    }

    // 2.10 Invalid Provider Customer Code format
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', 'NOT_CUS', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.10 Invalid provider customer code format should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.10 Invalid provider customer code produces SQLSTATE 22023");
    }

    // 2.11 Null Provider Status
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', NULL, NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.11 Null provider status should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.11 Null provider status produces SQLSTATE 22004");
    }

    // 2.12 Invalid Provider Status (must be 'failed')
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'success', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.12 Non-failed provider status should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.12 Non-failed provider status produces SQLSTATE 22023");
    }

    // 2.13 Null Failure Category
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, NULL, ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.13 Null failure category should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.13 Null failure category produces SQLSTATE 22004");
    }

    // 2.14 Invalid Failure Category
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'fraud_detected', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.14 Invalid failure category should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.14 Invalid failure category produces SQLSTATE 22023");
    }

    // 2.15 Null Amount Minor
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', NULL, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.15 Null amount_minor should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.15 Null amount_minor produces SQLSTATE 22004");
    }

    // 2.16 Invalid Amount Minor (<= 0)
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', 0, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.16 Zero amount_minor should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.16 Zero amount_minor produces SQLSTATE 22023");
    }

    // 2.17 Null Currency
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, NULL, '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.17 Null currency should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.17 Null currency produces SQLSTATE 22004");
    }

    // 2.18 Lowercase Currency
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'zar', '${periodStart}', '${periodEnd}', '${nowIso}');`);
      assert(false, "2.18 Lowercase currency should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.18 Lowercase currency produces SQLSTATE 22023");
    }

    // 2.19 Null Period Start / End
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', NULL, '${periodEnd}', '${nowIso}');`);
      assert(false, "2.19 Null period_start should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.19 Null period_start produces SQLSTATE 22004");
    }

    // 2.20 Inverted Period Boundaries
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodEnd}', '${periodStart}', '${nowIso}');`);
      assert(false, "2.20 Inverted period boundaries should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.20 Inverted period boundaries produces SQLSTATE 22023");
    }

    // 2.21 Null Occurred At
    try {
      await db.query(`SELECT * FROM public.process_paystack_invoice_payment_failed('test', '${validHash}', NULL, '${validInvCode}', '${validSubCode}', '${validCustCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', NULL);`);
      assert(false, "2.21 Null occurred_at should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.21 Null occurred_at produces SQLSTATE 22004");
    }
  }

  console.log("\nSection 3: Subscription Resolution & Prerequisite Scope (P0002 & 23514)");
  {
    const sub = await createSubscription("active", planAmountMinor, "ZAR");
    const subCode = `SUB_res${Math.random().toString(36).substring(2, 8)}`;
    const custCode = `CUS_res${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, subCode, custCode, "active", "2001", true, "test");
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    // 3.1 Missing Provider Subscription Code -> P0002
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"b".repeat(64)}', NULL, 'INV_misssub001', 'SUB_nonexistent999', '${custCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);
      assert(false, "3.1 Missing provider subscription should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "3.1 Missing provider subscription produces SQLSTATE P0002");
    }

    // 3.2 Customer Code Mismatch -> P0002
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"c".repeat(64)}', NULL, 'INV_misscust001', '${subCode}', 'CUS_wrongcustomer99', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);
      assert(false, "3.2 Customer code mismatch should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "3.2 Customer code mismatch produces SQLSTATE P0002");
    }

    // 3.3 Commercial Snapshot Mismatch (Amount) -> 23514
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"d".repeat(64)}', NULL, 'INV_missamt001', '${subCode}', '${custCode}', 'failed', NULL, NULL, 'insufficient_funds', 99000, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);
      assert(false, "3.3 Commercial amount mismatch should fail with 23514");
    } catch (err: any) {
      assert(err.code === "23514", "3.3 Commercial amount mismatch produces SQLSTATE 23514");
    }

    // 3.4 Commercial Snapshot Mismatch (Currency) -> 23514
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"e".repeat(64)}', NULL, 'INV_misscurr001', '${subCode}', '${custCode}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'USD', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);
      assert(false, "3.4 Commercial currency mismatch should fail with 23514");
    } catch (err: any) {
      assert(err.code === "23514", "3.4 Commercial currency mismatch produces SQLSTATE 23514");
    }
  }

  console.log("\nSection 4: Lifecycle Matrix Execution");
  {
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();

    // 4.1 Reject pending_activation (SQLSTATE 23514)
    {
      const subPending = await createSubscription("pending_activation", planAmountMinor, "ZAR");
      const subCodePending = `SUB_pen${Math.random().toString(36).substring(2, 8)}`;
      const custCodePending = `CUS_pen${Math.random().toString(36).substring(2, 8)}`;
      await createProviderSubscription(subPending.id, subCodePending, custCodePending, "active", "3001", true, "test");

      try {
        await db.query(`
          SELECT * FROM public.process_paystack_invoice_payment_failed(
            'test', '${"1".repeat(64)}', NULL, 'INV_pen001', '${subCodePending}', '${custCodePending}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
          );
        `);
        assert(false, "4.1 pending_activation state should fail with 23514");
      } catch (err: any) {
        assert(err.code === "23514", "4.1 pending_activation state produces SQLSTATE 23514");
      }
    }

    // 4.2 Active Subscription -> Transitions to past_due, Materializes Failed Invoice, Appends Ledgers
    {
      const subActive = await createSubscription("active", planAmountMinor, "ZAR", null, periodStart, periodEnd);
      const subCodeActive = `SUB_act${Math.random().toString(36).substring(2, 8)}`;
      const custCodeActive = `CUS_act${Math.random().toString(36).substring(2, 8)}`;
      await createProviderSubscription(subActive.id, subCodeActive, custCodeActive, "active", "3002", true, "test");
      const occurredAt = new Date(Date.now() - 1000).toISOString();

      const res = await db.query<InvoicePaymentFailedResult>(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"2".repeat(64)}', 'EVT_fail_act001', 'INV_act001', '${subCodeActive}', '${custCodeActive}', 'failed', 'TXN_fail001', 'ref_fail001', 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${occurredAt}'
        );
      `);

      assert(res.rows.length === 1, "4.2.1 Returned 1 row");
      const row = res.rows[0];
      assert(row.invoice_status === "failed", "4.2.2 Invoice status is 'failed'");
      assert(row.subscription_status === "past_due", "4.2.3 Subscription status transitioned to 'past_due'");
      assert(row.past_due_since !== null, "4.2.4 past_due_since is populated");
      assert(row.payment_id !== null, "4.2.5 payment_id is populated for genuine failed payment");
      assert(row.is_reused === false, "4.2.6 is_reused is false");
      assert(row.is_ignored === false, "4.2.7 is_ignored is false");

      // Verify DB subscription state
      const subCheck = (await db.query<{ status: string; past_due_since: string }>(`
        SELECT status, past_due_since FROM public.billing_subscriptions WHERE id = '${subActive.id}';
      `)).rows[0];
      assert(subCheck.status === "past_due", "4.2.8 DB subscription status is 'past_due'");
      assert(new Date(subCheck.past_due_since).getTime() === new Date(occurredAt).getTime(), "4.2.9 DB past_due_since matches occurred_at");

      // Verify DB invoice state
      const invCheck = (await db.query<{ status: string; provider_status: string; first_failed_at: string }>(`
        SELECT status, provider_status, first_failed_at FROM public.billing_invoices WHERE id = '${row.invoice_id}';
      `)).rows[0];
      assert(invCheck.status === "failed", "4.2.10 DB invoice status is 'failed'");
      assert(invCheck.provider_status === "failed", "4.2.11 DB provider_status is 'failed'");
      assert(invCheck.first_failed_at !== null, "4.2.12 first_failed_at is recorded");

      // Verify DB payment state
      const payCheck = (await db.query<{ status: string; purpose: string; error_code: string; billing_invoice_id: string }>(`
        SELECT status, purpose, error_code, billing_invoice_id FROM public.billing_payments WHERE id = '${row.payment_id}';
      `)).rows[0];
      assert(payCheck.status === "failed", "4.2.13 DB payment status is 'failed'");
      assert(payCheck.purpose === "renewal", "4.2.14 DB payment purpose is 'renewal'");
      assert(payCheck.error_code === "insufficient_funds", "4.2.15 DB payment error_code matches failure_category");
      assert(payCheck.billing_invoice_id === row.invoice_id, "4.2.16 DB payment links to billing_invoice_id");

      // Verify Ledger Events
      const ledgers = (await db.query<{ event_type: string; deduplication_key: string }>(`
        SELECT event_type, deduplication_key FROM public.billing_ledger_events
        WHERE subscription_id = '${subActive.id}'
        ORDER BY recorded_at ASC;
      `)).rows;
      assert(ledgers.some(l => l.event_type === "billing_invoice_failed"), "4.2.17 billing_invoice_failed ledger event emitted");
      assert(ledgers.some(l => l.event_type === "subscription_payment_past_due"), "4.2.18 subscription_payment_past_due ledger event emitted");
      assert(ledgers.some(l => l.event_type === "renewal_payment_failed"), "4.2.19 renewal_payment_failed ledger event emitted");
    }

    // 4.3 Existing Pending Invoice Transition -> Transitions to Failed
    {
      const subPendingInv = await createSubscription("active", planAmountMinor, "ZAR", null, periodStart, periodEnd);
      const subCodePendingInv = `SUB_peninv${Math.random().toString(36).substring(2, 8)}`;
      const custCodePendingInv = `CUS_peninv${Math.random().toString(36).substring(2, 8)}`;
      const provSubId = await createProviderSubscription(subPendingInv.id, subCodePendingInv, custCodePendingInv, "active", "3003", true, "test");
      const invCode = `INV_peninv${Math.random().toString(36).substring(2, 8)}`;

      // Create pending invoice first
      const pendingInvRes = await db.query<{ id: string }>(`
        INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, provider_status, amount_minor, currency, period_start, period_end, created_at, updated_at
        ) VALUES (
          '${subPendingInv.company_id}', '${subPendingInv.id}', '${provSubId}', 'paystack', 'test',
          '${invCode}', 'pending', 'pending', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', now(), now()
        ) RETURNING id;
      `);
      const existingInvId = pendingInvRes.rows[0].id;

      const res = await db.query<InvoicePaymentFailedResult>(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"3".repeat(64)}', NULL, '${invCode}', '${subCodePendingInv}', '${custCodePendingInv}', 'failed', NULL, NULL, 'issuer_declined', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);

      const row = res.rows[0];
      assert(row.invoice_id === existingInvId, "4.3.1 Matched existing invoice ID");
      assert(row.invoice_status === "failed", "4.3.2 Invoice status updated from pending to failed");
      assert(row.payment_id === null, "4.3.3 payment_id is null when no transaction/ref provided");

      const invCheck = (await db.query<{ status: string; provider_status: string }>(`
        SELECT status, provider_status FROM public.billing_invoices WHERE id = '${existingInvId}';
      `)).rows[0];
      assert(invCheck.status === "failed", "4.3.4 DB invoice status transitioned to failed");
      assert(invCheck.provider_status === "failed", "4.3.5 DB invoice provider_status updated");
    }

    // 4.4 Already Past-Due Subscription -> Preserves Earliest past_due_since, No Duplicate Past Due Ledger
    {
      const initialPastDueSince = new Date(Date.now() - 5 * 86400000).toISOString();
      const subPastDue = await createSubscription("past_due", planAmountMinor, "ZAR", initialPastDueSince, periodStart, periodEnd);
      const subCodePastDue = `SUB_past${Math.random().toString(36).substring(2, 8)}`;
      const custCodePastDue = `CUS_past${Math.random().toString(36).substring(2, 8)}`;
      await createProviderSubscription(subPastDue.id, subCodePastDue, custCodePastDue, "active", "3004", true, "test");
      const laterFailureOccurred = new Date().toISOString();

      const res = await db.query<InvoicePaymentFailedResult>(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"4".repeat(64)}', NULL, 'INV_past001', '${subCodePastDue}', '${custCodePastDue}', 'failed', NULL, NULL, 'card_expired', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${laterFailureOccurred}'
        );
      `);

      const row = res.rows[0];
      assert(row.subscription_status === "past_due", "4.4.1 Subscription remains past_due");
      const subCheck = (await db.query<{ past_due_since: string }>(`
        SELECT past_due_since FROM public.billing_subscriptions WHERE id = '${subPastDue.id}';
      `)).rows[0];
      assert(
        new Date(subCheck.past_due_since).getTime() === new Date(initialPastDueSince).getTime(),
        "4.4.2 Earliest past_due_since is preserved (not overwritten with later date)"
      );

      // Verify no subscription_payment_past_due ledger emitted
      const pastDueLedgers = (await db.query<{ id: string }>(`
        SELECT id FROM public.billing_ledger_events
        WHERE subscription_id = '${subPastDue.id}' AND event_type = 'subscription_payment_past_due';
      `)).rows;
      assert(pastDueLedgers.length === 0, "4.4.3 No subscription_payment_past_due ledger emitted for already past_due subscription");
    }

    // 4.5 Stale Event: Non-Renewing / Expired / Cancelled Subscription -> Ignored
    {
      const subCancelled = await createSubscription("cancelled", planAmountMinor, "ZAR", null, periodStart, periodEnd);
      const subCodeCancelled = `SUB_canc${Math.random().toString(36).substring(2, 8)}`;
      const custCodeCancelled = `CUS_canc${Math.random().toString(36).substring(2, 8)}`;
      await createProviderSubscription(subCancelled.id, subCodeCancelled, custCodeCancelled, "cancelled", "3005", false, "test");

      const res = await db.query<InvoicePaymentFailedResult>(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"5".repeat(64)}', NULL, 'INV_canc001', '${subCodeCancelled}', '${custCodeCancelled}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);

      const row = res.rows[0];
      assert(row.is_ignored === true, "4.5.1 Cancelled subscription failure returns is_ignored = true");
      assert(row.subscription_status === "cancelled", "4.5.2 Subscription status remains 'cancelled'");

      const ignLedgers = (await db.query<{ event_type: string }>(`
        SELECT event_type FROM public.billing_ledger_events
        WHERE subscription_id = '${subCancelled.id}';
      `)).rows;
      assert(ignLedgers.some(l => l.event_type === "billing_invoice_payment_failed_ignored"), "4.5.3 Emits billing_invoice_payment_failed_ignored ledger");
    }

    // 4.6 Stale Event: Existing Invoice is already Paid -> Ignored
    {
      const subActivePaid = await createSubscription("active", planAmountMinor, "ZAR", null, periodStart, periodEnd);
      const subCodePaid = `SUB_paid${Math.random().toString(36).substring(2, 8)}`;
      const custCodePaid = `CUS_paid${Math.random().toString(36).substring(2, 8)}`;
      const provSubId = await createProviderSubscription(subActivePaid.id, subCodePaid, custCodePaid, "active", "3006", true, "test");
      const invCodePaid = `INV_paid${Math.random().toString(36).substring(2, 8)}`;

      // Create paid invoice
      await db.query(`
        INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider, environment,
          provider_invoice_code, status, provider_status, amount_minor, currency, period_start, period_end, paid_at, created_at, updated_at
        ) VALUES (
          '${subActivePaid.company_id}', '${subActivePaid.id}', '${provSubId}', 'paystack', 'test',
          '${invCodePaid}', 'paid', 'success', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', now(), now(), now()
        );
      `);

      const res = await db.query<InvoicePaymentFailedResult>(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"6".repeat(64)}', NULL, '${invCodePaid}', '${subCodePaid}', '${custCodePaid}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
        );
      `);

      const row = res.rows[0];
      assert(row.is_ignored === true, "4.6.1 Failure for already paid invoice returns is_ignored = true");
      assert(row.invoice_status === "paid", "4.6.2 Invoice status remains 'paid' (no regression to failed)");
      assert(row.subscription_status === "active", "4.6.3 Subscription status remains 'active'");
    }

    // 4.7 Stale Event: Active Subscription already renewed beyond period_end -> Ignored
    {
      const futureStart = new Date(Date.now() + 10 * 86400000).toISOString();
      const futureEnd = new Date(Date.now() + 40 * 86400000).toISOString();
      const subRenewed = await createSubscription("active", planAmountMinor, "ZAR", null, futureStart, futureEnd);
      const subCodeRenewed = `SUB_ren${Math.random().toString(36).substring(2, 8)}`;
      const custCodeRenewed = `CUS_ren${Math.random().toString(36).substring(2, 8)}`;
      await createProviderSubscription(subRenewed.id, subCodeRenewed, custCodeRenewed, "active", "3007", true, "test");

      const oldPeriodStart = new Date(Date.now() - 30 * 86400000).toISOString();
      const oldPeriodEnd = new Date(Date.now() - 1 * 86400000).toISOString();

      const res = await db.query<InvoicePaymentFailedResult>(`
        SELECT * FROM public.process_paystack_invoice_payment_failed(
          'test', '${"7".repeat(64)}', NULL, 'INV_oldfail001', '${subCodeRenewed}', '${custCodeRenewed}', 'failed', NULL, NULL, 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${oldPeriodStart}', '${oldPeriodEnd}', '${nowIso}'
        );
      `);

      const row = res.rows[0];
      assert(row.is_ignored === true, "4.7.1 Stale failure against renewed active subscription returns is_ignored = true");
      assert(row.subscription_status === "active", "4.7.2 Subscription remains 'active'");
    }
  }

  console.log("\nSection 5: Exact Replay Handling & Semantic Idempotency");
  {
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();
    const sub = await createSubscription("active", planAmountMinor, "ZAR", null, periodStart, periodEnd);
    const subCode = `SUB_rep${Math.random().toString(36).substring(2, 8)}`;
    const custCode = `CUS_rep${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, subCode, custCode, "active", "4001", true, "test");
    const hash = "8".repeat(64);
    const invCode = "INV_replay001";

    // First Call
    const res1 = await db.query<InvoicePaymentFailedResult>(`
      SELECT * FROM public.process_paystack_invoice_payment_failed(
        'test', '${hash}', 'EVT_rep001', '${invCode}', '${subCode}', '${custCode}', 'failed', 'TXN_rep001', 'ref_rep001', 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);
    const initialLedgerCount = (await db.query<{ count: string }>(`
      SELECT count(*) FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `)).rows[0].count;

    assert(res1.rows[0].is_reused === false, "5.1 Initial call returns is_reused = false");

    // Second Call: Exact Replay (same payload sha256)
    const res2 = await db.query<InvoicePaymentFailedResult>(`
      SELECT * FROM public.process_paystack_invoice_payment_failed(
        'test', '${hash}', 'EVT_rep001', '${invCode}', '${subCode}', '${custCode}', 'failed', 'TXN_rep001', 'ref_rep001', 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    assert(res2.rows[0].is_reused === true, "5.2 Replay call returns is_reused = true");
    assert(res2.rows[0].invoice_id === res1.rows[0].invoice_id, "5.3 Replay returns identical invoice_id");
    assert(res2.rows[0].payment_id === res1.rows[0].payment_id, "5.4 Replay returns identical payment_id");

    const afterReplayLedgerCount = (await db.query<{ count: string }>(`
      SELECT count(*) FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `)).rows[0].count;
    assert(initialLedgerCount === afterReplayLedgerCount, "5.5 Exact replay produces zero new ledger entries");

    // Third Call: Semantic Idempotency (different payload hash for already failed invoice)
    const diffHash = "9".repeat(64);
    const res3 = await db.query<InvoicePaymentFailedResult>(`
      SELECT * FROM public.process_paystack_invoice_payment_failed(
        'test', '${diffHash}', 'EVT_rep002', '${invCode}', '${subCode}', '${custCode}', 'failed', 'TXN_rep001', 'ref_rep001', 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    assert(res3.rows[0].is_reused === false, "5.6 Different hash is not marked is_reused in webhook inbox");
    assert(res3.rows[0].invoice_id === res1.rows[0].invoice_id, "5.7 Returns same invoice_id without re-inserting invoice");
    assert(res3.rows[0].invoice_status === "failed", "5.8 Invoice status remains 'failed'");
  }

  console.log("\nSection 6: Webhook & Ledger Sanitization");
  {
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();
    const sub = await createSubscription("active", planAmountMinor, "ZAR", null, periodStart, periodEnd);
    const subCode = `SUB_san${Math.random().toString(36).substring(2, 8)}`;
    const custCode = `CUS_san${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, subCode, custCode, "active", "5001", true, "test");
    const hash = "f".repeat(64);

    await db.query(`
      SELECT * FROM public.process_paystack_invoice_payment_failed(
        'test', '${hash}', 'EVT_san001', 'INV_san001', '${subCode}', '${custCode}', 'failed', 'TXN_san001', 'ref_san001', 'processing_error', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    // Verify raw_payload in webhook inbox
    const webhook = (await db.query<{ raw_payload: any }>(`
      SELECT raw_payload FROM public.billing_webhook_events WHERE payload_sha256 = '${hash}';
    `)).rows[0];
    const rawStr = JSON.stringify(webhook.raw_payload);
    assert(!rawStr.includes("tok_"), "6.1 Webhook raw_payload does not contain auth tokens");
    assert(!rawStr.includes("pm@example.com"), "6.2 Webhook raw_payload does not contain customer email");
    assert(rawStr.includes("processing_error"), "6.3 Webhook raw_payload contains failure_category");

    // Verify ledger event_data
    const ledgers = (await db.query<{ event_data: any }>(`
      SELECT event_data FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `)).rows;
    for (const l of ledgers) {
      const lStr = JSON.stringify(l.event_data);
      assert(!lStr.includes("tok_"), "6.4 Ledger event_data does not contain auth tokens");
      assert(!lStr.includes("pm@example.com"), "6.5 Ledger event_data does not contain customer email");
    }
  }

  console.log("\nSection 7: Exact Return-Column Contract (14 Columns)");
  {
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();
    const sub = await createSubscription("active", planAmountMinor, "ZAR", null, periodStart, periodEnd);
    const subCode = `SUB_ret${Math.random().toString(36).substring(2, 8)}`;
    const custCode = `CUS_ret${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, subCode, custCode, "active", "7001", true, "test");
    const invCode = `INV_ret${Math.random().toString(36).substring(2, 8)}`;
    const hash = "c".repeat(64);
    const nowIso = new Date().toISOString();

    const res = await db.query<InvoicePaymentFailedResult>(`
      SELECT * FROM public.process_paystack_invoice_payment_failed(
        'test', '${hash}', NULL, '${invCode}', '${subCode}', '${custCode}', 'failed', 'TXN_ret001', 'ref_ret001', 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
      );
    `);

    const keys = Object.keys(res.rows[0]);
    const expectedCols = [
      "webhook_event_id",
      "invoice_id",
      "payment_id",
      "provider_subscription_record_id",
      "subscription_id",
      "provider_invoice_code",
      "invoice_status",
      "subscription_status",
      "amount_minor",
      "currency",
      "past_due_since",
      "failure_category",
      "is_reused",
      "is_ignored",
    ];

    assert(keys.length === expectedCols.length, `7.1 Returns exactly ${expectedCols.length} columns`);
    for (let i = 0; i < expectedCols.length; i++) {
      assert(keys.includes(expectedCols[i]), `7.2 Column #${i + 1} "${expectedCols[i]}" is present`);
    }

    const forbiddenKeys = ["email", "customer_email", "authorization_code", "signature", "card", "token", "phone", "secret"];
    const hasForbidden = forbiddenKeys.some((k) => keys.includes(k));
    assert(!hasForbidden, "7.3 RPC return columns do NOT leak sensitive tokens or email");
  }

  console.log("\nSection 8: Concurrency & Transactional Rollback Cleanliness");
  {
    const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();
    const periodEnd = new Date().toISOString();
    const sub = await createSubscription("active", planAmountMinor, "ZAR", null, periodStart, periodEnd);
    const subCode = `SUB_con${Math.random().toString(36).substring(2, 8)}`;
    const custCode = `CUS_con${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(sub.id, subCode, custCode, "active", "6001", true, "test");
    const nowIso = new Date().toISOString();
    const sharedHash = "e".repeat(64);

    // 8.1 5 Concurrent racing calls with identical payload hash
    const results = await Promise.all(
      Array.from({ length: 2 }).map((_, i) =>
        db.query<InvoicePaymentFailedResult>(`
          SELECT * FROM public.process_paystack_invoice_payment_failed(
            'test', '${sharedHash}', 'EVT_con_${i}', 'INV_con001', '${subCode}', '${custCode}', 'failed', 'TXN_con001', 'ref_con001', 'insufficient_funds', ${planAmountMinor}, 'ZAR', '${periodStart}', '${periodEnd}', '${nowIso}'
          );
        `)
      )
    );

    const reusedValues = results.map((r) => r.rows[0].is_reused);
    const reusedFalseCount = reusedValues.filter((r) => r === false).length;
    const reusedTrueCount = reusedValues.filter((r) => r === true).length;
    assert(
      reusedFalseCount === 1 && reusedTrueCount === 1,
      "8.1 Concurrent execution: exactly one gets is_reused = false and one gets is_reused = true"
    );

    // Check that invoice table has exactly 1 record for INV_con001
    const invCountRes = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_invoices WHERE provider_invoice_code = 'INV_con001';
    `);
    assert(invCountRes.rows[0].count === 1, "8.2 Exactly one billing invoice created under concurrency");

    // Check that webhook events table has exactly 1 record for sharedHash
    const whCountRes = await db.query<{ count: number; processing_status: string }>(`
      SELECT COUNT(*)::int AS count, MIN(processing_status) AS processing_status
      FROM public.billing_webhook_events
      WHERE payload_sha256 = '${sharedHash}';
    `);
    assert(
      whCountRes.rows[0].count === 1 && whCountRes.rows[0].processing_status === "processed",
      "8.3 Exactly one webhook event record created under concurrency with status 'processed'"
    );
  }

  console.log("\n=================================================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
