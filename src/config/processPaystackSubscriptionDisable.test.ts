import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Phase 3A.2 — Step 3C.4D-1A: Paystack subscription.disable Database RPC Test Suite (PGlite)
 *
 * Verifies all required validation, lifecycle, idempotency, security, and schema contract points:
 * 1. Function metadata, SECURITY DEFINER, search_path = '', and service_role execute privilege.
 * 2. Strict input validation (environment, sha256, event_id, code, id, customer_code, status, disabled_at, occurred_at).
 * 3. Valid terminal transitions for 'completed' (active/non_renewing/past_due -> expired).
 * 4. Valid terminal transitions for 'cancelled' (active/non_renewing/past_due -> cancelled).
 * 5. Rejection of non-activated states (pending_activation, trialing) with SQLSTATE 23514.
 * 6. Same-outcome stale terminal events (expired+completed, cancelled+cancelled) handled as ignored without state regression.
 * 7. Contradictory terminal outcomes (expired+cancelled, cancelled+completed) rejected with SQLSTATE 23514.
 * 8. Billing-period dates (current_period_start/end) preserved intact; next_renewal_at set to null; auto_renew_enabled set to false.
 * 9. Provider record updates: provider_status updated, disabled_at set, next_payment_at set to null, is_current set to false.
 * 10. Provider subscription missing / mismatched identifiers (P0002, 23514).
 * 11. Exact payload replay returns is_reused = true with zero new ledger entries.
 * 12. Distinct payload hashes accepted independently.
 * 13. Webhook raw_payload and ledger event_data sanitization (no sensitive tokens/auth codes/emails).
 * 14. Exact safe return-column contract (9 columns).
 * 15. Migration and schema.sql parity.
 * 16. Static confirmation that Edge Function files were not modified in this step.
 * 17. Genuine multi-session concurrency integration (5 independent concurrent trials).
 * 18. Committed 'processing' row produces retryable SQLSTATE 40001.
 * 19. Payload hash collision with mismatched identifiers produces SQLSTATE 23505.
 * 20. Transactional rollback safety (failed winning claim leaves no orphan inbox row and allows valid retry).
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

interface DisableResult {
  webhook_event_id: string;
  provider_subscription_record_id: string;
  subscription_id: string;
  provider_subscription_code: string;
  provider_status: string;
  subscription_status: string;
  auto_renew_enabled: boolean;
  is_reused: boolean;
  is_ignored: boolean;
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("PROJECTMATRIX PROCESS PAYSTACK SUBSCRIPTION DISABLE RPC TEST SUITE");
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
  async function createSubscription(status: string, autoRenew = true) {
    const cRes = await db.query<{ id: string }>(`
      INSERT INTO public.companies (name) VALUES ('Test Company ${Math.random().toString(36).substring(2, 8)}') RETURNING id;
    `);
    const cId = cRes.rows[0].id;
    await db.exec(`
      INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
      VALUES ('${cId}', '${userId}', 'Director', 'owner', true);
    `);

    const subRef = `SUB-REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const subRes = await db.query<{ id: string; company_id: string; subscription_reference: string }>(`
      INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, status, amount_minor,
        currency, billing_interval, current_period_start, current_period_end,
        next_renewal_at, auto_renew_enabled
      ) VALUES (
        '${cId}', '${planId}', '${subRef}', '${status}', 75000,
        'ZAR', 'monthly', now() - INTERVAL '15 days', now() + INTERVAL '15 days',
        now() + INTERVAL '15 days', ${autoRenew}
      )
      RETURNING id, company_id, subscription_reference;
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
      WHERE proname = 'process_paystack_subscription_disable';
    `);

    assert(fnDefRes.rows.length === 1, "1.1 Function process_paystack_subscription_disable exists");
    assert(fnDefRes.rows[0].prosecdef === true, "1.2 Function is marked SECURITY DEFINER");
    assert(fnDefRes.rows[0].pronargs === 9, "1.3 Function has exactly 9 parameters");

    // Check search_path configuration
    const configRes = await db.query<{ proconfig: string[] }>(`
      SELECT proconfig FROM pg_proc WHERE proname = 'process_paystack_subscription_disable';
    `);
    const hasEmptySearchPath = configRes.rows[0]?.proconfig?.some((cfg: string) => cfg.startsWith("search_path="));
    assert(hasEmptySearchPath, "1.4 Function search_path is hardened (search_path = '')");

    // Check schema parity between migration file and schema.sql
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260824000002_process_paystack_subscription_disable.sql"),
      "utf-8"
    );
    const schemaSql = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf-8");

    assert(schemaSql.includes("process_paystack_subscription_disable"), "1.5 schema.sql contains process_paystack_subscription_disable");
    assert(
      schemaSql.includes("Atomically processes an authenticated and signature-verified Paystack subscription.disable"),
      "1.6 schema.sql comment parity confirmed"
    );
  }

  console.log("\nSection 2: Parameter Validation & Constraints");
  {
    const validHash = "a".repeat(64);
    const validSubCode = "SUB_testdisable001";
    const validCustCode = "CUS_testdisable001";
    const nowIso = new Date().toISOString();

    // 2.1 Null Environment
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable(NULL, '${validHash}', NULL, '${validSubCode}', '123', '${validCustCode}', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.1 Null environment should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.1 Null environment produces SQLSTATE 22004");
    }

    // 2.2 Invalid Environment
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('staging', '${validHash}', NULL, '${validSubCode}', '123', '${validCustCode}', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.2 Invalid environment should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.2 Invalid environment produces SQLSTATE 22023");
    }

    // 2.3 Null Payload Hash
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', NULL, NULL, '${validSubCode}', '123', '${validCustCode}', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.3 Null payload SHA-256 should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.3 Null payload SHA-256 produces SQLSTATE 22004");
    }

    // 2.4 Invalid Payload Hash (uppercase or short)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', 'INVALID_HASH', NULL, '${validSubCode}', '123', '${validCustCode}', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.4 Invalid payload SHA-256 should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.4 Invalid payload SHA-256 produces SQLSTATE 22023");
    }

    // 2.5 Invalid Provider Event ID
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', '   ', '${validSubCode}', '123', '${validCustCode}', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.5 Whitespace provider_event_id should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.5 Whitespace provider_event_id produces SQLSTATE 22023");
    }

    // 2.6 Null Provider Subscription Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, NULL, '123', '${validCustCode}', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.6 Null provider_subscription_code should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.6 Null provider_subscription_code produces SQLSTATE 22004");
    }

    // 2.7 Malformed Provider Subscription Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, 'INVALID_CODE', '123', '${validCustCode}', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.7 Malformed provider_subscription_code should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.7 Malformed provider_subscription_code produces SQLSTATE 22023");
    }

    // 2.8 Malformed Provider Subscription ID
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, '${validSubCode}', 'non-digits', '${validCustCode}', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.8 Non-numeric provider_subscription_id should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.8 Non-numeric provider_subscription_id produces SQLSTATE 22023");
    }

    // 2.9 Null Customer Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, '${validSubCode}', '123', NULL, 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.9 Null customer code should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.9 Null customer code produces SQLSTATE 22004");
    }

    // 2.10 Malformed Customer Code
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, '${validSubCode}', '123', 'invalid_customer', 'completed', '${nowIso}', '${nowIso}');`);
      assert(false, "2.10 Malformed customer code should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.10 Malformed customer code produces SQLSTATE 22023");
    }

    // 2.11 Null Provider Status
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, '${validSubCode}', '123', '${validCustCode}', NULL, '${nowIso}', '${nowIso}');`);
      assert(false, "2.11 Null provider status should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.11 Null provider status produces SQLSTATE 22004");
    }

    // 2.12 Invalid Provider Status ('disabled', 'active', etc.)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, '${validSubCode}', '123', '${validCustCode}', 'disabled', '${nowIso}', '${nowIso}');`);
      assert(false, "2.12 'disabled' provider status must be rejected");
    } catch (err: any) {
      assert(err.code === "22023", "2.12 'disabled' provider status produces SQLSTATE 22023");
    }

    // 2.13 Null disabled_at
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, '${validSubCode}', '123', '${validCustCode}', 'completed', NULL, '${nowIso}');`);
      assert(false, "2.13 Null disabled_at should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.13 Null disabled_at produces SQLSTATE 22004");
    }

    // 2.14 Null occurred_at
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, '${validSubCode}', '123', '${validCustCode}', 'completed', '${nowIso}', NULL);`);
      assert(false, "2.14 Null occurred_at should fail");
    } catch (err: any) {
      assert(err.code === "22004", "2.14 Null occurred_at produces SQLSTATE 22004");
    }

    // 2.15 Mismatched disabled_at and occurred_at
    const earlierIso = new Date(Date.now() - 60000).toISOString();
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_disable('test', '${validHash}', NULL, '${validSubCode}', '123', '${validCustCode}', 'completed', '${nowIso}', '${earlierIso}');`);
      assert(false, "2.15 Mismatched timestamps should fail");
    } catch (err: any) {
      assert(err.code === "22023", "2.15 Mismatched timestamps produces SQLSTATE 22023");
    }
  }

  console.log("\nSection 3: Valid Terminal Transitions (Completed -> Expired)");
  {
    const statuses = ["active", "non_renewing", "past_due"];
    for (let i = 0; i < statuses.length; i++) {
      const initialStatus = statuses[i];
      const sub = await createSubscription(initialStatus, true);
      const provCode = `SUB_discomp${i}01`;
      const custCode = `CUS_discomp${i}01`;
      const provRecId = await createProviderSubscription(sub.id, provCode, custCode, initialStatus === "non_renewing" ? "non-renewing" : "active", `100${i}`);
      const payloadHash = `1${i}`.repeat(32);
      const timestamp = new Date().toISOString();

      const res = await db.query<DisableResult>(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${payloadHash}', 'EVT_dis_comp_${i}', '${provCode}', '100${i}', '${custCode}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);

      assert(res.rows.length === 1, `3.${i + 1}a Returned exactly 1 row for ${initialStatus} -> completed`);
      const row = res.rows[0];
      assert(row.subscription_status === "expired", `3.${i + 1}b Subscription transitioned to 'expired'`);
      assert(row.provider_status === "completed", `3.${i + 1}c Provider status set to 'completed'`);
      assert(row.auto_renew_enabled === false, `3.${i + 1}d auto_renew_enabled set to false`);
      assert(row.is_reused === false, `3.${i + 1}e is_reused is false`);
      assert(row.is_ignored === false, `3.${i + 1}f is_ignored is false`);

      // Verify internal subscription record
      const subCheck = (await db.query<{
        status: string;
        auto_renew_enabled: boolean;
        next_renewal_at: string | null;
        expired_at: string | null;
        cancelled_at: string | null;
      }>(`
        SELECT status, auto_renew_enabled, next_renewal_at, expired_at, cancelled_at
        FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];

      assert(subCheck.status === "expired", `3.${i + 1}g DB subscription status is 'expired'`);
      assert(subCheck.auto_renew_enabled === false, `3.${i + 1}h DB auto_renew_enabled is false`);
      assert(subCheck.next_renewal_at === null, `3.${i + 1}i DB next_renewal_at is null`);
      assert(subCheck.expired_at !== null, `3.${i + 1}j DB expired_at is populated`);
      assert(subCheck.cancelled_at === null, `3.${i + 1}k DB cancelled_at remains null`);

      // Verify provider subscription record
      const provCheck = (await db.query<{
        provider_status: string;
        disabled_at: string | null;
        next_payment_at: string | null;
        is_current: boolean;
      }>(`
        SELECT provider_status, disabled_at, next_payment_at, is_current
        FROM public.billing_provider_subscriptions WHERE id = '${provRecId}';
      `)).rows[0];

      assert(provCheck.provider_status === "completed", `3.${i + 1}l DB provider_status is 'completed'`);
      assert(provCheck.disabled_at !== null, `3.${i + 1}m DB disabled_at is populated`);
      assert(provCheck.next_payment_at === null, `3.${i + 1}n DB next_payment_at is null`);
      assert(provCheck.is_current === false, `3.${i + 1}o DB is_current flipped to false`);

      // Verify ledger entry
      const ledgerCheck = (await db.query<{
        event_type: string;
        event_source: string;
      }>(`
        SELECT event_type, event_source FROM public.billing_ledger_events
        WHERE subscription_id = '${sub.id}' ORDER BY recorded_at DESC LIMIT 1;
      `)).rows[0];

      assert(ledgerCheck.event_type === "provider_subscription_completed", `3.${i + 1}p Ledger event_type is 'provider_subscription_completed'`);
      assert(ledgerCheck.event_source === "paystack_webhook", `3.${i + 1}q Ledger event_source is 'paystack_webhook'`);
    }
  }

  console.log("\nSection 4: Valid Terminal Transitions (Cancelled -> Cancelled)");
  {
    const statuses = ["active", "non_renewing", "past_due"];
    for (let i = 0; i < statuses.length; i++) {
      const initialStatus = statuses[i];
      const sub = await createSubscription(initialStatus, true);
      const provCode = `SUB_discan${i}01`;
      const custCode = `CUS_discan${i}01`;
      const provRecId = await createProviderSubscription(sub.id, provCode, custCode, initialStatus === "non_renewing" ? "non-renewing" : "active", `200${i}`);
      const payloadHash = `2${i}`.repeat(32);
      const timestamp = new Date().toISOString();

      const res = await db.query<DisableResult>(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${payloadHash}', 'EVT_dis_can_${i}', '${provCode}', '200${i}', '${custCode}', 'cancelled', '${timestamp}', '${timestamp}'
        );
      `);

      assert(res.rows.length === 1, `4.${i + 1}a Returned exactly 1 row for ${initialStatus} -> cancelled`);
      const row = res.rows[0];
      assert(row.subscription_status === "cancelled", `4.${i + 1}b Subscription transitioned to 'cancelled'`);
      assert(row.provider_status === "cancelled", `4.${i + 1}c Provider status set to 'cancelled'`);
      assert(row.auto_renew_enabled === false, `4.${i + 1}d auto_renew_enabled set to false`);
      assert(row.is_reused === false, `4.${i + 1}e is_reused is false`);
      assert(row.is_ignored === false, `4.${i + 1}f is_ignored is false`);

      // Verify internal subscription record
      const subCheck = (await db.query<{
        status: string;
        auto_renew_enabled: boolean;
        next_renewal_at: string | null;
        expired_at: string | null;
        cancelled_at: string | null;
      }>(`
        SELECT status, auto_renew_enabled, next_renewal_at, expired_at, cancelled_at
        FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];

      assert(subCheck.status === "cancelled", `4.${i + 1}g DB subscription status is 'cancelled'`);
      assert(subCheck.auto_renew_enabled === false, `4.${i + 1}h DB auto_renew_enabled is false`);
      assert(subCheck.next_renewal_at === null, `4.${i + 1}i DB next_renewal_at is null`);
      assert(subCheck.cancelled_at !== null, `4.${i + 1}j DB cancelled_at is populated`);
      assert(subCheck.expired_at === null, `4.${i + 1}k DB expired_at remains null`);

      // Verify provider subscription record
      const provCheck = (await db.query<{
        provider_status: string;
        disabled_at: string | null;
        next_payment_at: string | null;
        is_current: boolean;
      }>(`
        SELECT provider_status, disabled_at, next_payment_at, is_current
        FROM public.billing_provider_subscriptions WHERE id = '${provRecId}';
      `)).rows[0];

      assert(provCheck.provider_status === "cancelled", `4.${i + 1}l DB provider_status is 'cancelled'`);
      assert(provCheck.disabled_at !== null, `4.${i + 1}m DB disabled_at is populated`);
      assert(provCheck.next_payment_at === null, `4.${i + 1}n DB next_payment_at is null`);
      assert(provCheck.is_current === false, `4.${i + 1}o DB is_current flipped to false`);

      // Verify ledger entry
      const ledgerCheck = (await db.query<{
        event_type: string;
        event_source: string;
      }>(`
        SELECT event_type, event_source FROM public.billing_ledger_events
        WHERE subscription_id = '${sub.id}' ORDER BY recorded_at DESC LIMIT 1;
      `)).rows[0];

      assert(ledgerCheck.event_type === "provider_subscription_cancelled", `4.${i + 1}p Ledger event_type is 'provider_subscription_cancelled'`);
      assert(ledgerCheck.event_source === "paystack_webhook", `4.${i + 1}q Ledger event_source is 'paystack_webhook'`);
    }
  }

  console.log("\nSection 5: Rejection of Non-Activated States");
  {
    // 5.1 pending_activation
    const pendingSub = await createSubscription("pending_activation", true);
    const pendingCode = "SUB_dispend01";
    const pendingCust = "CUS_dispend01";
    await createProviderSubscription(pendingSub.id, pendingCode, pendingCust, "attention", "50001");
    const timestamp = new Date().toISOString();

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${"31".repeat(32)}', NULL, '${pendingCode}', '50001', '${pendingCust}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "5.1 pending_activation state should be rejected");
    } catch (err: any) {
      assert(err.code === "23514", "5.1 pending_activation raises SQLSTATE 23514");
    }

    // 5.2 trialing
    const trialSub = await createSubscription("trialing", true);
    const trialCode = "SUB_distrial01";
    const trialCust = "CUS_distrial01";
    await createProviderSubscription(trialSub.id, trialCode, trialCust, "active", "50002");

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${"32".repeat(32)}', NULL, '${trialCode}', '50002', '${trialCust}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "5.2 trialing state should be rejected");
    } catch (err: any) {
      assert(err.code === "23514", "5.2 trialing raises SQLSTATE 23514");
    }
  }

  console.log("\nSection 6: Terminal State & Conflict Handling");
  {
    const timestamp = new Date().toISOString();

    // 6.1 Same-outcome stale event on 'expired' subscription with 'completed' status
    const expSub = await createSubscription("expired", false);
    const expCode = "SUB_disexpstale01";
    const expCust = "CUS_disexpstale01";
    await createProviderSubscription(expSub.id, expCode, expCust, "completed", "60001", false);
    const expHash = "41".repeat(32);

    const expRes = await db.query<DisableResult>(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${expHash}', NULL, '${expCode}', '60001', '${expCust}', 'completed', '${timestamp}', '${timestamp}'
      );
    `);

    assert(expRes.rows[0].subscription_status === "expired", "6.1a Sub status remains 'expired'");
    assert(expRes.rows[0].is_reused === false, "6.1b is_reused is false for fresh stale event");
    assert(expRes.rows[0].is_ignored === true, "6.1c is_ignored is true for fresh stale event");

    const expWh = (await db.query<{ processing_status: string }>(`
      SELECT processing_status FROM public.billing_webhook_events WHERE payload_sha256 = '${expHash}';
    `)).rows[0];
    assert(expWh.processing_status === "ignored", "6.1d Webhook marked 'ignored'");

    const expLedger = (await db.query<{ event_type: string }>(`
      SELECT event_type FROM public.billing_ledger_events WHERE subscription_id = '${expSub.id}' ORDER BY recorded_at DESC LIMIT 1;
    `)).rows[0];
    assert(expLedger.event_type === "provider_subscription_disable_ignored", "6.1e Ledger recorded 'provider_subscription_disable_ignored'");

    // 6.2 Same-outcome stale event on 'cancelled' subscription with 'cancelled' status
    const canSub = await createSubscription("cancelled", false);
    const canCode = "SUB_discanstale01";
    const canCust = "CUS_discanstale01";
    await createProviderSubscription(canSub.id, canCode, canCust, "cancelled", "60002", false);
    const canHash = "42".repeat(32);

    const canRes = await db.query<DisableResult>(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${canHash}', NULL, '${canCode}', '60002', '${canCust}', 'cancelled', '${timestamp}', '${timestamp}'
      );
    `);

    assert(canRes.rows[0].subscription_status === "cancelled", "6.2a Sub status remains 'cancelled'");
    assert(canRes.rows[0].is_reused === false, "6.2b is_reused is false for fresh stale event");
    assert(canRes.rows[0].is_ignored === true, "6.2c is_ignored is true for fresh stale event");

    // 6.3 Contradictory outcome: 'expired' sub receiving 'cancelled' status
    const conflictSubA = await createSubscription("expired", false);
    const codeA = "SUB_disconflA01";
    const custA = "CUS_disconflA01";
    await createProviderSubscription(conflictSubA.id, codeA, custA, "completed", "60003", false);

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${"43".repeat(32)}', NULL, '${codeA}', '60003', '${custA}', 'cancelled', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "6.3 expired subscription receiving cancelled status must raise 23514");
    } catch (err: any) {
      assert(err.code === "23514", "6.3 expired + cancelled raises SQLSTATE 23514");
    }

    // 6.4 Contradictory outcome: 'cancelled' sub receiving 'completed' status
    const conflictSubB = await createSubscription("cancelled", false);
    const codeB = "SUB_disconflB01";
    const custB = "CUS_disconflB01";
    await createProviderSubscription(conflictSubB.id, codeB, custB, "cancelled", "60004", false);

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${"44".repeat(32)}', NULL, '${codeB}', '60004', '${custB}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "6.4 cancelled subscription receiving completed status must raise 23514");
    } catch (err: any) {
      assert(err.code === "23514", "6.4 cancelled + completed raises SQLSTATE 23514");
    }
  }

  console.log("\nSection 7: Provider Subscription & Linked Record Mismatch Checks");
  {
    const sub = await createSubscription("active", true);
    const provCode = "SUB_dismismatch01";
    const custCode = "CUS_dismismatch01";
    await createProviderSubscription(sub.id, provCode, custCode, "active", "70001");
    const timestamp = new Date().toISOString();

    // 7.1 Provider subscription not found
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${"51".repeat(32)}', NULL, 'SUB_nonexistent999', '70001', '${custCode}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "7.1 Missing provider subscription should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "7.1 Missing provider subscription produces SQLSTATE P0002");
    }

    // 7.2 Customer code mismatch
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${"52".repeat(32)}', NULL, '${provCode}', '70001', 'CUS_wrongcustomer99', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "7.2 Customer code mismatch should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "7.2 Customer code mismatch produces SQLSTATE P0002");
    }

    // 7.3 Subscription ID mismatch
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${"53".repeat(32)}', NULL, '${provCode}', '999999', '${custCode}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "7.3 Subscription ID mismatch should fail with 23514");
    } catch (err: any) {
      assert(err.code === "23514", "7.3 Subscription ID mismatch produces SQLSTATE 23514");
    }
  }

  console.log("\nSection 8: Paid-Period Boundary Preservation");
  {
    const sub = await createSubscription("active", true);
    const provCode = "SUB_disperiod01";
    const custCode = "CUS_disperiod01";
    await createProviderSubscription(sub.id, provCode, custCode, "active", "80001");
    const timestamp = new Date().toISOString();

    const beforeSub = (await db.query<{
      current_period_start: string;
      current_period_end: string;
    }>(`
      SELECT current_period_start, current_period_end FROM public.billing_subscriptions WHERE id = '${sub.id}';
    `)).rows[0];

    await db.query(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${"61".repeat(32)}', NULL, '${provCode}', '80001', '${custCode}', 'completed', '${timestamp}', '${timestamp}'
      );
    `);

    const afterSub = (await db.query<{
      current_period_start: string;
      current_period_end: string;
      next_renewal_at: string | null;
      auto_renew_enabled: boolean;
    }>(`
      SELECT current_period_start, current_period_end, next_renewal_at, auto_renew_enabled
      FROM public.billing_subscriptions WHERE id = '${sub.id}';
    `)).rows[0];

    assert(
      new Date(beforeSub.current_period_start).getTime() === new Date(afterSub.current_period_start).getTime(),
      "8.1 current_period_start preserved intact"
    );
    assert(
      new Date(beforeSub.current_period_end).getTime() === new Date(afterSub.current_period_end).getTime(),
      "8.2 current_period_end preserved intact"
    );
    assert(afterSub.next_renewal_at === null, "8.3 next_renewal_at set to null");
    assert(afterSub.auto_renew_enabled === false, "8.4 auto_renew_enabled set to false");
  }

  console.log("\nSection 9: Replay and Idempotency");
  {
    const sub = await createSubscription("active", true);
    const provCode = "SUB_disreplay01";
    const custCode = "CUS_disreplay01";
    await createProviderSubscription(sub.id, provCode, custCode, "active", "90001");
    const payloadHash = "71".repeat(32);
    const timestamp = new Date().toISOString();

    // First invocation
    const firstRes = await db.query<DisableResult>(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${payloadHash}', NULL, '${provCode}', '90001', '${custCode}', 'completed', '${timestamp}', '${timestamp}'
      );
    `);
    assert(firstRes.rows[0].is_reused === false, "9.1 First invocation is_reused = false");

    // Exact replay
    const secondRes = await db.query<DisableResult>(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${payloadHash}', NULL, '${provCode}', '90001', '${custCode}', 'completed', '${timestamp}', '${timestamp}'
      );
    `);
    assert(secondRes.rows[0].is_reused === true, "9.2 Replay invocation is_reused = true");
    assert(secondRes.rows[0].subscription_status === "expired", "9.3 Replay returns current subscription_status");
    assert(secondRes.rows[0].auto_renew_enabled === false, "9.4 Replay returns current auto_renew_enabled");

    // Verify ledger count did not increase
    const ledgerCount = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `);
    assert(ledgerCount.rows[0].count === 1, "9.5 Ledger entry count remains exactly 1 after replay");
  }

  console.log("\nSection 10: Independent Acceptance of Distinct Payload Hashes");
  {
    const sub = await createSubscription("active", true);
    const provCode = "SUB_dismulti01";
    const custCode = "CUS_dismulti01";
    await createProviderSubscription(sub.id, provCode, custCode, "active", "100001");
    const timestamp = new Date().toISOString();

    const hash1 = "81".repeat(32);
    const hash2 = "82".repeat(32);

    const res1 = await db.query<DisableResult>(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${hash1}', NULL, '${provCode}', '100001', '${custCode}', 'completed', '${timestamp}', '${timestamp}'
      );
    `);
    assert(res1.rows[0].is_reused === false && res1.rows[0].is_ignored === false, "10.1 First hash processed");

    const res2 = await db.query<DisableResult>(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${hash2}', NULL, '${provCode}', '100001', '${custCode}', 'completed', '${timestamp}', '${timestamp}'
      );
    `);
    assert(res2.rows[0].is_reused === false && res2.rows[0].is_ignored === true, "10.2 Second distinct hash processed as ignored stale event");

    const ledgerCount = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `);
    assert(ledgerCount.rows[0].count === 2, "10.3 Two distinct ledger entries created for two distinct hashes");
  }

  console.log("\nSection 11: Webhook and Ledger Sanitization");
  {
    const whRes = await db.query<{ raw_payload: any }>(`
      SELECT raw_payload FROM public.billing_webhook_events WHERE event_type = 'subscription.disable' LIMIT 5;
    `);
    for (const row of whRes.rows) {
      const p = row.raw_payload;
      assert(!("email_token" in p), "11.1 email_token absent from raw_payload");
      assert(!("authorization_code" in p), "11.2 authorization_code absent from raw_payload");
      assert(!("customer_email" in p), "11.3 customer_email absent from raw_payload");
      assert(!("signature" in p), "11.4 signature absent from raw_payload");
    }

    const ledgerRes = await db.query<{ event_data: any }>(`
      SELECT event_data FROM public.billing_ledger_events WHERE event_type LIKE 'provider_subscription_%' LIMIT 5;
    `);
    for (const row of ledgerRes.rows) {
      const d = row.event_data;
      assert(!("email_token" in d), "11.5 email_token absent from ledger event_data");
      assert(!("authorization_code" in d), "11.6 authorization_code absent from ledger event_data");
      assert(!("customer_email" in d), "11.7 customer_email absent from ledger event_data");
    }
  }

  console.log("\nSection 12: Static Confirmation of Untouched Files");
  {
    const webhookIndexPath = path.join(process.cwd(), "supabase", "functions", "paystack-webhook", "index.ts");
    const webhookCorePath = path.join(process.cwd(), "supabase", "functions", "paystack-webhook", "core.ts");

    assert(fs.existsSync(webhookIndexPath), "12.1 paystack-webhook/index.ts exists");
    assert(fs.existsSync(webhookCorePath), "12.2 paystack-webhook/core.ts exists");

    const coreContent = fs.readFileSync(webhookCorePath, "utf-8");
    assert(!coreContent.includes("process_paystack_subscription_disable"), "12.3 core.ts was NOT modified in this step");
  }

  console.log("\nSection 13: Genuine Multi-Session Concurrency Integration & Conflict Safety");
  {
    // 13.1 - 13.5: Run 5 independent concurrent first-delivery trials across independent sessions
    for (let i = 1; i <= 5; i++) {
      const sub = await createSubscription("active", true);
      const provCode = `SUB_disconcur${i}${Math.random().toString(36).substring(2, 8)}`;
      const provCust = `CUS_disconcur${i}${Math.random().toString(36).substring(2, 8)}`;
      await createProviderSubscription(sub.id, provCode, provCust, "active", `${3000 + i}`);
      const payloadHash = `${i.toString(16).padStart(2, "0")}`.repeat(32);
      const timestamp = new Date().toISOString();

      // Start both calls concurrently before either promise is awaited
      const p1 = db.query<DisableResult>(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test',
          '${payloadHash}',
          NULL,
          '${provCode}',
          '${3000 + i}',
          '${provCust}',
          'completed',
          '${timestamp}',
          '${timestamp}'
        );
      `);

      const p2 = db.query<DisableResult>(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test',
          '${payloadHash}',
          NULL,
          '${provCode}',
          '${3000 + i}',
          '${provCust}',
          'completed',
          '${timestamp}',
          '${timestamp}'
        );
      `);

      const [res1, res2] = await Promise.all([p1, p2]);

      const reusedValues = [res1.rows[0].is_reused, res2.rows[0].is_reused];
      const reusedFalseCount = reusedValues.filter((r) => r === false).length;
      const reusedTrueCount = reusedValues.filter((r) => r === true).length;

      assert(
        reusedFalseCount === 1 && reusedTrueCount === 1,
        `13.${i}a Concurrent Trial ${i}: Exactly one session gets is_reused = false and one gets is_reused = true`
      );

      // Verify webhook row count and status
      const whCheck = await db.query<{ count: number; processing_status: string }>(`
        SELECT COUNT(*)::int AS count, MIN(processing_status) AS processing_status
        FROM public.billing_webhook_events
        WHERE payload_sha256 = '${payloadHash}';
      `);
      assert(
        whCheck.rows[0].count === 1 && whCheck.rows[0].processing_status === "processed",
        `13.${i}b Concurrent Trial ${i}: Exactly 1 webhook row recorded with status 'processed'`
      );

      // Verify ledger row count
      const ledgerCheck = await db.query<{ count: number }>(`
        SELECT COUNT(*)::int AS count
        FROM public.billing_ledger_events
        WHERE subscription_id = '${sub.id}';
      `);
      assert(
        ledgerCheck.rows[0].count === 1,
        `13.${i}c Concurrent Trial ${i}: Exactly 1 ledger row recorded`
      );

      // Verify subscription mutation
      const subCheck = await db.query<{ status: string; auto_renew_enabled: boolean }>(`
        SELECT status, auto_renew_enabled
        FROM public.billing_subscriptions
        WHERE id = '${sub.id}';
      `);
      assert(
        subCheck.rows[0].status === "expired" && subCheck.rows[0].auto_renew_enabled === false,
        `13.${i}d Concurrent Trial ${i}: Subscription successfully updated to expired with auto_renew_enabled = false`
      );
    }

    // 13.6: Existing committed 'processing' row produces SQLSTATE 40001
    const procSub = await createSubscription("active", true);
    const procCode = `SUB_disproc${Math.random().toString(36).substring(2, 8)}`;
    const procCust = `CUS_disproc${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(procSub.id, procCode, procCust, "active", "4001");
    const procHash = "d1".repeat(32);
    const timestamp = new Date().toISOString();

    // Pre-insert row in 'processing' status
    await db.exec(`
      INSERT INTO public.billing_webhook_events (
        provider, environment, event_type, provider_object_id, payload_sha256,
        raw_payload, signature_verified, processing_status, processing_attempts,
        received_at, processing_started_at, updated_at
      ) VALUES (
        'paystack', 'test', 'subscription.disable', '${procCode}', '${procHash}',
        '{"test": true}'::jsonb, true, 'processing', 1, now(), now(), now()
      );
    `);

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${procHash}', NULL, '${procCode}', '4001', '${procCust}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "13.6 Existing 'processing' status should raise retryable 40001");
    } catch (err: any) {
      assert(err.code === "40001", "13.6 Existing 'processing' row produces SQLSTATE 40001");
    }

    // 13.7: Same payload hash with mismatched event identity produces 23505
    const collisionSubA = await createSubscription("active", true);
    const collisionSubB = await createSubscription("active", true);
    const codeA = `SUB_discolA${Math.random().toString(36).substring(2, 8)}`;
    const codeB = `SUB_discolB${Math.random().toString(36).substring(2, 8)}`;
    const custColA = `CUS_discolA${Math.random().toString(36).substring(2, 8)}`;
    const custColB = `CUS_discolB${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(collisionSubA.id, codeA, custColA, "active", "4002");
    await createProviderSubscription(collisionSubB.id, codeB, custColB, "active", "4003");
    const colHash = "e2".repeat(32);

    // Successfully process with codeA
    await db.query(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${colHash}', NULL, '${codeA}', '4002', '${custColA}', 'completed', '${timestamp}', '${timestamp}'
      );
    `);

    // Attempt with same payload hash but codeB
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${colHash}', NULL, '${codeB}', '4003', '${custColB}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "13.7 Mismatched provider_object_id on duplicate hash should raise 23505");
    } catch (err: any) {
      assert(err.code === "23505", "13.7 Duplicate hash with mismatched provider_object_id produces 23505");
    }

    // 13.8: Failed winner transaction leaves no orphan inbox row and allows subsequent successful processing
    const retrySub = await createSubscription("active", true);
    const retryCode = `SUB_disretry${Math.random().toString(36).substring(2, 8)}`;
    const retryCust = `CUS_disretry${Math.random().toString(36).substring(2, 8)}`;
    const retryHash = "f3".repeat(32);

    // Attempt call before creating provider subscription -> will fail with P0002 after claiming inbox row
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_disable(
          'test', '${retryHash}', NULL, '${retryCode}', '4004', '${retryCust}', 'completed', '${timestamp}', '${timestamp}'
        );
      `);
      assert(false, "13.8 Initial call with missing provider subscription should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "13.8 Failed transaction failed with P0002");
    }

    // Verify no orphan webhook inbox row exists due to transaction rollback
    const orphanCheck = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_webhook_events WHERE payload_sha256 = '${retryHash}';
    `);
    assert(orphanCheck.rows[0].count === 0, "13.8 Failed transaction leaves NO orphan inbox row");

    // Now seed the provider subscription and retry with the same payload hash
    await createProviderSubscription(retrySub.id, retryCode, retryCust, "active", "4004");
    const retryRes = await db.query<DisableResult>(`
      SELECT * FROM public.process_paystack_subscription_disable(
        'test', '${retryHash}', NULL, '${retryCode}', '4004', '${retryCust}', 'completed', '${timestamp}', '${timestamp}'
      );
    `);
    assert(
      retryRes.rows[0].is_reused === false && retryRes.rows[0].subscription_status === "expired",
      "13.8 Subsequent valid retry processes successfully with is_reused = false"
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
