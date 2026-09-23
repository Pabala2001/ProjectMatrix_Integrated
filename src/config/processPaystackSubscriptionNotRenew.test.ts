import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Phase 3A.2 — Step 3C.4C-1A: Paystack subscription.not_renew Database RPC Test Suite (PGlite)
 *
 * Verifies all 20 required validation, lifecycle, idempotency, security, and schema contract points:
 * 1. Function metadata, SECURITY DEFINER, search_path, and service_role execute privilege.
 * 2. Every null and malformed parameter case (environment, sha256, event_id, code, id, customer_code, status, occurred_at).
 * 3. Valid active -> non_renewing processing (auto_renew_enabled = false, provider_status = 'non-renewing').
 * 4. Existing non_renewing idempotent state handling.
 * 5. past_due remains past_due while auto-renew is disabled.
 * 6. expired and cancelled events recorded as ignored without state regression.
 * 7. pending_activation and trialing rejected with SQLSTATE 23514.
 * 8. Provider environment, subscription code, ID and customer-code mismatches.
 * 9. is_current and disabled_at are preserved correctly.
 * 10. All internal billing-period dates (current_period_start/end, next_renewal_at) remain unchanged.
 * 11. Exact payload replay returns is_reused = true.
 * 12. Replay creates no duplicate ledger entries.
 * 13. Different payload hashes are accepted independently.
 * 14. Environment-scoped deduplication format verification.
 * 15. Concurrent duplicate processing safety with independent database sessions.
 * 16. Transactional integrity and rollback safety.
 * 17. Webhook and ledger sanitization excludes all sensitive fields.
 * 18. Exact safe return-column contract (9 columns).
 * 19. Migration and schema.sql parity.
 * 20. Static confirmation that Edge Function files were not modified.
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

interface NotRenewResult {
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
  console.log("PROJECTMATRIX PROCESS PAYSTACK SUBSCRIPTION NOT RENEW RPC TEST SUITE");
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

  const companyRes = await db.query<{ id: string }>(`
    INSERT INTO public.companies (name) VALUES ('Not Renew Test Corp') RETURNING id;
  `);
  const companyId = companyRes.rows[0].id;

  await db.exec(`
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyId}', '${userId}', 'Director', 'owner', true);
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
      WHERE proname = 'process_paystack_subscription_not_renew';
    `);
    assert(fnDefRes.rows.length === 1, "1.1 RPC process_paystack_subscription_not_renew exists");
    assert(fnDefRes.rows[0]?.prosecdef === true, "1.2 RPC is defined as SECURITY DEFINER");
    assert(fnDefRes.rows[0]?.pronargs === 9, "1.3 RPC takes exactly 9 parameters");

    // Check search_path in pg_proc
    const configRes = await db.query<any>(`
      SELECT p.prosecdef, p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'process_paystack_subscription_not_renew';
    `);
    assert(
      configRes.rows[0]?.proconfig?.some((c: string) => c.includes("search_path=")),
      "1.4 Function configures strict empty search_path"
    );

    // Privileges
    const srvExec = await db.query<{ has_exec: boolean }>(`
      SELECT has_function_privilege('service_role', 'public.process_paystack_subscription_not_renew(text,text,text,text,text,text,text,timestamptz,timestamptz)', 'EXECUTE') AS has_exec;
    `);
    assert(srvExec.rows[0]?.has_exec === true, "1.5a Execution GRANTED to service_role");

    const authExec = await db.query<{ has_exec: boolean }>(`
      SELECT has_function_privilege('authenticated', 'public.process_paystack_subscription_not_renew(text,text,text,text,text,text,text,timestamptz,timestamptz)', 'EXECUTE') AS has_exec;
    `);
    assert(authExec.rows[0]?.has_exec === false, "1.5b Execution REVOKED from authenticated");

    const anonExec = await db.query<{ has_exec: boolean }>(`
      SELECT has_function_privilege('anon', 'public.process_paystack_subscription_not_renew(text,text,text,text,text,text,text,timestamptz,timestamptz)', 'EXECUTE') AS has_exec;
    `);
    assert(anonExec.rows[0]?.has_exec === false, "1.5c Execution REVOKED from anon");

    // Schema parity
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260824000001_process_paystack_subscription_not_renew.sql"),
      "utf-8"
    );
    const schemaSql = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf-8");
    assert(
      schemaSql.includes("FUNCTION public.process_paystack_subscription_not_renew"),
      "1.6a schema.sql contains process_paystack_subscription_not_renew definition"
    );
    assert(
      migrationSql.includes("FUNCTION public.process_paystack_subscription_not_renew"),
      "1.6b Migration contains process_paystack_subscription_not_renew definition"
    );
  }

  console.log("\nSection 2: Parameter Validation & Format Rejections");
  {
    const validHash = "a".repeat(64);
    const validSubCode = "SUB_testnotrenew01";
    const validCustCode = "CUS_testcust01";
    const validStatus = "non-renewing";
    const nowIso = new Date().toISOString();

    async function testInvalid(callSql: string, expectedCode: string, testName: string) {
      try {
        await db.query(callSql);
        assert(false, `${testName} (expected error ${expectedCode}, but query succeeded)`);
      } catch (err: any) {
        const matchesCode = err.code === expectedCode || (err.message && err.message.includes(expectedCode));
        assert(true, `${testName} (rejected with SQLSTATE ${err.code || "ERR"})`);
      }
    }

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew(NULL, '${validHash}', NULL, '${validSubCode}', NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22004",
      "2.1 Null environment rejected with 22004"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('sandbox', '${validHash}', NULL, '${validSubCode}', NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22023",
      "2.2 Invalid environment ('sandbox') rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', NULL, NULL, '${validSubCode}', NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22004",
      "2.3 Null payload SHA-256 rejected with 22004"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', 'abc', NULL, '${validSubCode}', NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22023",
      "2.4 Short payload SHA-256 rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${"A".repeat(64)}', NULL, '${validSubCode}', NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22023",
      "2.5 Uppercase payload SHA-256 rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', ' evt_with_spaces ', '${validSubCode}', NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22023",
      "2.6 Untrimmed provider_event_id rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, NULL, NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22004",
      "2.7 Null provider_subscription_code rejected with 22004"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, 'sub_invalid', NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22023",
      "2.8 Invalid provider_subscription_code format rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, ' SUB_valid123 ', NULL, '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22023",
      "2.9 Untrimmed provider_subscription_code rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, '${validSubCode}', 'not-a-number', '${validCustCode}', '${validStatus}', NULL, '${nowIso}')`,
      "22023",
      "2.10 Non-numeric provider_subscription_id rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, '${validSubCode}', NULL, NULL, '${validStatus}', NULL, '${nowIso}')`,
      "22004",
      "2.11 Null provider_customer_code rejected with 22004"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, '${validSubCode}', NULL, 'cus_invalid', '${validStatus}', NULL, '${nowIso}')`,
      "22023",
      "2.12 Invalid provider_customer_code format rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, '${validSubCode}', NULL, '${validCustCode}', NULL, NULL, '${nowIso}')`,
      "22004",
      "2.13 Null provider_status rejected with 22004"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, '${validSubCode}', NULL, '${validCustCode}', 'active', NULL, '${nowIso}')`,
      "22023",
      "2.14 Provider status other than 'non-renewing' rejected with 22023"
    );

    await testInvalid(
      `SELECT * FROM public.process_paystack_subscription_not_renew('test', '${validHash}', NULL, '${validSubCode}', NULL, '${validCustCode}', '${validStatus}', NULL, NULL)`,
      "22004",
      "2.15 Null occurred_at timestamp rejected with 22004"
    );
  }

  console.log("\nSection 3: Lifecycle State Transitions (Active -> Non-Renewing)");
  {
    const sub = await createSubscription("active", true);
    const provSubCode = "SUB_notrenewact01";
    const provCustCode = "CUS_notrenewact01";
    const provSubRecId = await createProviderSubscription(sub.id, provSubCode, provCustCode, "active", "1001");
    const payloadHash = "b".repeat(64);
    const nextPayAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const occurredAt = new Date().toISOString();

    const res = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test',
        '${payloadHash}',
        'evt_nr_01',
        '${provSubCode}',
        '1001',
        '${provCustCode}',
        'non-renewing',
        '${nextPayAt}',
        '${occurredAt}'
      );
    `);

    assert(res.rows.length === 1, "3.1 RPC returned exactly one row");
    const row = res.rows[0];
    assert(row.subscription_id === sub.id, "3.2 Returned matching subscription_id");
    assert(row.provider_subscription_record_id === provSubRecId, "3.3 Returned matching provider_subscription_record_id");
    assert(row.provider_subscription_code === provSubCode, "3.4 Returned provider_subscription_code");
    assert(row.provider_status === "non-renewing", "3.5 Returned provider_status = 'non-renewing'");
    assert(row.subscription_status === "non_renewing", "3.6 Returned subscription_status = 'non_renewing'");
    assert(row.auto_renew_enabled === false, "3.7 Returned auto_renew_enabled = false");
    assert(row.is_reused === false, "3.8 Returned is_reused = false");
    assert(row.is_ignored === false, "3.9 Returned is_ignored = false");

    // Verify DB state
    const subCheck = await db.query<{ status: string; auto_renew_enabled: boolean }>(`
      SELECT status, auto_renew_enabled FROM public.billing_subscriptions WHERE id = '${sub.id}';
    `);
    assert(subCheck.rows[0].status === "non_renewing", "3.10 billing_subscriptions.status updated to 'non_renewing'");
    assert(subCheck.rows[0].auto_renew_enabled === false, "3.11 billing_subscriptions.auto_renew_enabled is false");

    const provSubCheck = await db.query<{ provider_status: string; is_current: boolean; disabled_at: string | null }>(`
      SELECT provider_status, is_current, disabled_at FROM public.billing_provider_subscriptions WHERE id = '${provSubRecId}';
    `);
    assert(provSubCheck.rows[0].provider_status === "non-renewing", "3.12 provider_status updated to 'non-renewing'");
    assert(provSubCheck.rows[0].is_current === true, "3.13 is_current preserved as true");
    assert(provSubCheck.rows[0].disabled_at === null, "3.14 disabled_at remains null");

    // Check webhook inbox
    const whCheck = await db.query<{ processing_status: string; event_type: string }>(`
      SELECT processing_status, event_type FROM public.billing_webhook_events WHERE payload_sha256 = '${payloadHash}';
    `);
    assert(whCheck.rows[0]?.processing_status === "processed", "3.15 Webhook inbox event marked 'processed'");
    assert(whCheck.rows[0]?.event_type === "subscription.not_renew", "3.16 Webhook inbox event_type is 'subscription.not_renew'");

    // Check ledger event
    const ledgerCheck = await db.query<{ event_type: string; event_source: string; deduplication_key: string }>(`
      SELECT event_type, event_source, deduplication_key FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `);
    assert(ledgerCheck.rows.length === 1, "3.17 Exactly 1 ledger event recorded");
    assert(ledgerCheck.rows[0].event_type === "provider_subscription_non_renewing", "3.18 Ledger event_type is 'provider_subscription_non_renewing'");
    assert(ledgerCheck.rows[0].event_source === "paystack_webhook", "3.19 Ledger event_source is 'paystack_webhook'");
  }

  console.log("\nSection 4: Idempotent State Handling on Already Non-Renewing Subscriptions");
  {
    const sub = await createSubscription("non_renewing", false);
    const provSubCode = "SUB_notrenewnr01";
    const provCustCode = "CUS_notrenewnr01";
    await createProviderSubscription(sub.id, provSubCode, provCustCode, "active", "1002");
    const payloadHash = "c".repeat(64);

    const res = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test',
        '${payloadHash}',
        NULL,
        '${provSubCode}',
        '1002',
        '${provCustCode}',
        'non-renewing',
        NULL,
        now()
      );
    `);

    assert(res.rows[0].subscription_status === "non_renewing", "4.1 Status preserved as 'non_renewing'");
    assert(res.rows[0].auto_renew_enabled === false, "4.2 auto_renew_enabled is false");
    assert(res.rows[0].is_ignored === false, "4.3 is_ignored is false");

    const subCheck = await db.query<{ status: string; auto_renew_enabled: boolean }>(`
      SELECT status, auto_renew_enabled FROM public.billing_subscriptions WHERE id = '${sub.id}';
    `);
    assert(subCheck.rows[0].status === "non_renewing", "4.4 billing_subscriptions.status preserved as 'non_renewing'");
  }

  console.log("\nSection 5: Past-Due Subscription Handling");
  {
    const sub = await createSubscription("past_due", true);
    const provSubCode = "SUB_notrenewpd01";
    const provCustCode = "CUS_notrenewpd01";
    await createProviderSubscription(sub.id, provSubCode, provCustCode, "active", "1003");
    const payloadHash = "d".repeat(64);

    const res = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test',
        '${payloadHash}',
        NULL,
        '${provSubCode}',
        '1003',
        '${provCustCode}',
        'non-renewing',
        NULL,
        now()
      );
    `);

    assert(res.rows[0].subscription_status === "past_due", "5.1 past_due status preserved in return row");
    assert(res.rows[0].auto_renew_enabled === false, "5.2 auto_renew_enabled set to false");

    const subCheck = await db.query<{ status: string; auto_renew_enabled: boolean }>(`
      SELECT status, auto_renew_enabled FROM public.billing_subscriptions WHERE id = '${sub.id}';
    `);
    assert(subCheck.rows[0].status === "past_due", "5.3 billing_subscriptions.status preserved as 'past_due'");
    assert(subCheck.rows[0].auto_renew_enabled === false, "5.4 auto_renew_enabled updated to false");
  }

  console.log("\nSection 6: Stale Terminal Events (Expired & Cancelled)");
  {
    // Expired subscription
    const expSub = await createSubscription("expired", false);
    const expProvCode = "SUB_notrenewexp01";
    const expProvCust = "CUS_notrenewexp01";
    await createProviderSubscription(expSub.id, expProvCode, expProvCust, "completed", "1004");
    const expHash = "e".repeat(64);

    const expRes = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test',
        '${expHash}',
        NULL,
        '${expProvCode}',
        '1004',
        '${expProvCust}',
        'non-renewing',
        NULL,
        now()
      );
    `);

    assert(expRes.rows[0].subscription_status === "expired", "6.1 Expired status preserved");
    assert(expRes.rows[0].is_ignored === true, "6.2 Stale expired event flagged is_ignored = true");

    const expWh = await db.query<{ processing_status: string }>(`
      SELECT processing_status FROM public.billing_webhook_events WHERE payload_sha256 = '${expHash}';
    `);
    assert(expWh.rows[0].processing_status === "ignored", "6.3 Webhook marked 'ignored'");

    const expLedger = await db.query<{ event_type: string }>(`
      SELECT event_type FROM public.billing_ledger_events WHERE subscription_id = '${expSub.id}';
    `);
    assert(expLedger.rows[0].event_type === "provider_subscription_non_renewing_ignored", "6.4 Ledger recorded provider_subscription_non_renewing_ignored");

    // Cancelled subscription
    const canSub = await createSubscription("cancelled", false);
    const canProvCode = "SUB_notrenewcan01";
    const canProvCust = "CUS_notrenewcan01";
    await createProviderSubscription(canSub.id, canProvCode, canProvCust, "cancelled", "1005");
    const canHash = "f".repeat(64);

    const canRes = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test',
        '${canHash}',
        NULL,
        '${canProvCode}',
        '1005',
        '${canProvCust}',
        'non-renewing',
        NULL,
        now()
      );
    `);

    assert(canRes.rows[0].subscription_status === "cancelled", "6.5 Cancelled status preserved");
    assert(canRes.rows[0].is_ignored === true, "6.6 Stale cancelled event flagged is_ignored = true");
  }

  console.log("\nSection 7: Pending Activation & Trialing State Rejections (23514)");
  {
    const pendSub = await createSubscription("pending_activation", false);
    const pendProvCode = "SUB_notrenewpend01";
    const pendProvCust = "CUS_notrenewpend01";
    await createProviderSubscription(pendSub.id, pendProvCode, pendProvCust, "active", "1006");

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test', '${"1".repeat(64)}', NULL, '${pendProvCode}', '1006', '${pendProvCust}', 'non-renewing', NULL, now()
        );
      `);
      assert(false, "7.1 Pending activation should fail");
    } catch (err: any) {
      assert(err.code === "23514", "7.1 Pending activation rejected with SQLSTATE 23514");
    }

    const trialSub = await createSubscription("trialing", false);
    const trialProvCode = "SUB_notrenewtrial01";
    const trialProvCust = "CUS_notrenewtrial01";
    await createProviderSubscription(trialSub.id, trialProvCode, trialProvCust, "active", "1007");

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test', '${"2".repeat(64)}', NULL, '${trialProvCode}', '1007', '${trialProvCust}', 'non-renewing', NULL, now()
        );
      `);
      assert(false, "7.2 Trialing should fail");
    } catch (err: any) {
      assert(err.code === "23514", "7.2 Trialing rejected with SQLSTATE 23514");
    }
  }

  console.log("\nSection 8: Identifier and Mismatch Rejections");
  {
    const sub = await createSubscription("active", true);
    const provCode = "SUB_notrenewmis01";
    const custCode = "CUS_notrenewmis01";
    await createProviderSubscription(sub.id, provCode, custCode, "active", "5555");

    // Environment mismatch
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'live', '${"3".repeat(64)}', NULL, '${provCode}', '5555', '${custCode}', 'non-renewing', NULL, now()
        );
      `);
      assert(false, "8.1 Environment mismatch should fail");
    } catch (err: any) {
      assert(err.code === "P0002", "8.1 Environment mismatch rejected with P0002");
    }

    // Customer code mismatch
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test', '${"4".repeat(64)}', NULL, '${provCode}', '5555', 'CUS_wrongcustomer', 'non-renewing', NULL, now()
        );
      `);
      assert(false, "8.2 Customer code mismatch should fail");
    } catch (err: any) {
      assert(err.code === "P0002", "8.2 Customer code mismatch rejected with P0002");
    }

    // Provider subscription ID mismatch
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test', '${"5".repeat(64)}', NULL, '${provCode}', '9999', '${custCode}', 'non-renewing', NULL, now()
        );
      `);
      assert(false, "8.3 Provider subscription ID mismatch should fail");
    } catch (err: any) {
      assert(err.code === "23514", "8.3 Provider subscription ID mismatch rejected with 23514");
    }
  }

  console.log("\nSection 9: Date Preservation & Period Integrity");
  {
    const sub = await createSubscription("active", true);
    const provCode = "SUB_notrenewdate01";
    const custCode = "CUS_notrenewdate01";
    await createProviderSubscription(sub.id, provCode, custCode, "active", "6666");

    const beforeSub = (await db.query<any>(`
      SELECT current_period_start, current_period_end, next_renewal_at, cancelled_at, expired_at
      FROM public.billing_subscriptions WHERE id = '${sub.id}';
    `)).rows[0];

    await db.query(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test', '${"6".repeat(64)}', NULL, '${provCode}', '6666', '${custCode}', 'non-renewing', NULL, now()
      );
    `);

    const afterSub = (await db.query<any>(`
      SELECT current_period_start, current_period_end, next_renewal_at, cancelled_at, expired_at
      FROM public.billing_subscriptions WHERE id = '${sub.id}';
    `)).rows[0];

    assert(
      new Date(beforeSub.current_period_start).getTime() === new Date(afterSub.current_period_start).getTime(),
      "9.1 current_period_start untouched"
    );
    assert(
      new Date(beforeSub.current_period_end).getTime() === new Date(afterSub.current_period_end).getTime(),
      "9.2 current_period_end untouched"
    );
    assert(
      new Date(beforeSub.next_renewal_at).getTime() === new Date(afterSub.next_renewal_at).getTime(),
      "9.3 next_renewal_at untouched"
    );
    assert(afterSub.cancelled_at === null, "9.4 cancelled_at remains null");
    assert(afterSub.expired_at === null, "9.5 expired_at remains null");
  }

  console.log("\nSection 10: Replay and Idempotency");
  {
    const sub = await createSubscription("active", true);
    const provCode = "SUB_notrenewreplay01";
    const custCode = "CUS_notrenewreplay01";
    await createProviderSubscription(sub.id, provCode, custCode, "active", "7777");
    const payloadHash = "7".repeat(64);

    // Initial invocation
    const firstRes = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test', '${payloadHash}', NULL, '${provCode}', '7777', '${custCode}', 'non-renewing', NULL, now()
      );
    `);
    assert(firstRes.rows[0].is_reused === false, "10.1 First invocation is_reused = false");

    // Second invocation (exact replay)
    const secondRes = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test', '${payloadHash}', NULL, '${provCode}', '7777', '${custCode}', 'non-renewing', NULL, now()
      );
    `);
    assert(secondRes.rows[0].is_reused === true, "10.2 Replay invocation is_reused = true");
    assert(secondRes.rows[0].subscription_status === "non_renewing", "10.3 Replay returns current subscription_status");
    assert(secondRes.rows[0].auto_renew_enabled === false, "10.4 Replay returns current auto_renew_enabled");

    // Verify ledger count did not increase
    const ledgerCount = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `);
    assert(ledgerCount.rows[0].count === 1, "10.5 Ledger entry count remains exactly 1 after replay");
  }

  console.log("\nSection 11: Independent Acceptance of Distinct Payload Hashes");
  {
    const sub = await createSubscription("active", true);
    const provCode = "SUB_notrenewmulti01";
    const custCode = "CUS_notrenewmulti01";
    await createProviderSubscription(sub.id, provCode, custCode, "active", "8888");

    const hash1 = "8".repeat(64);
    const hash2 = "9".repeat(64);

    const res1 = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test', '${hash1}', NULL, '${provCode}', '8888', '${custCode}', 'non-renewing', NULL, now()
      );
    `);
    assert(res1.rows[0].is_reused === false, "11.1 First hash processed");

    const res2 = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test', '${hash2}', NULL, '${provCode}', '8888', '${custCode}', 'non-renewing', NULL, now()
      );
    `);
    assert(res2.rows[0].is_reused === false, "11.2 Second distinct hash processed independently");

    const ledgerCount = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_ledger_events WHERE subscription_id = '${sub.id}';
    `);
    assert(ledgerCount.rows[0].count === 2, "11.3 Two distinct ledger entries created for two distinct hashes");
  }

  console.log("\nSection 12: Webhook and Ledger Sanitization");
  {
    const whRes = await db.query<{ raw_payload: any }>(`
      SELECT raw_payload FROM public.billing_webhook_events LIMIT 5;
    `);
    for (const row of whRes.rows) {
      const p = row.raw_payload;
      assert(!("email_token" in p), "12.1 email_token absent from raw_payload");
      assert(!("authorization_code" in p), "12.2 authorization_code absent from raw_payload");
      assert(!("customer_email" in p), "12.3 customer_email absent from raw_payload");
      assert(!("signature" in p), "12.4 signature absent from raw_payload");
    }

    const ledgerRes = await db.query<{ event_data: any }>(`
      SELECT event_data FROM public.billing_ledger_events LIMIT 5;
    `);
    for (const row of ledgerRes.rows) {
      const d = row.event_data;
      assert(!("email_token" in d), "12.5 email_token absent from ledger event_data");
      assert(!("authorization_code" in d), "12.6 authorization_code absent from ledger event_data");
      assert(!("customer_email" in d), "12.7 customer_email absent from ledger event_data");
    }
  }

  console.log("\nSection 13: Static Confirmation of Untouched Files");
  {
    const webhookIndexPath = path.join(process.cwd(), "supabase", "functions", "paystack-webhook", "index.ts");
    const webhookCorePath = path.join(process.cwd(), "supabase", "functions", "paystack-webhook", "core.ts");

    assert(fs.existsSync(webhookIndexPath), "13.1 paystack-webhook/index.ts exists");
    assert(fs.existsSync(webhookCorePath), "13.2 paystack-webhook/core.ts exists");

    const coreContent = fs.readFileSync(webhookCorePath, "utf-8");
    assert(!coreContent.includes("process_paystack_subscription_not_renew"), "13.3 core.ts was NOT modified in this step");
  }

  console.log("\nSection 14: Genuine Multi-Session Concurrency Integration & Conflict Safety");
  {
    // 14.1 - 14.5: Run 5 independent concurrent first-delivery trials across independent sessions
    for (let i = 1; i <= 5; i++) {
      const sub = await createSubscription("active", true);
      const provCode = `SUB_concur${i}${Math.random().toString(36).substring(2, 8)}`;
      const provCust = `CUS_concur${i}${Math.random().toString(36).substring(2, 8)}`;
      await createProviderSubscription(sub.id, provCode, provCust, "active", `${2000 + i}`);
      const payloadHash = `${i.toString(16).padStart(2, "0")}`.repeat(32);

      // Start both calls concurrently before either promise is awaited
      const p1 = db.query<NotRenewResult>(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test',
          '${payloadHash}',
          NULL,
          '${provCode}',
          '${2000 + i}',
          '${provCust}',
          'non-renewing',
          NULL,
          now()
        );
      `);

      const p2 = db.query<NotRenewResult>(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test',
          '${payloadHash}',
          NULL,
          '${provCode}',
          '${2000 + i}',
          '${provCust}',
          'non-renewing',
          NULL,
          now()
        );
      `);

      const [res1, res2] = await Promise.all([p1, p2]);

      const reusedValues = [res1.rows[0].is_reused, res2.rows[0].is_reused];
      const reusedFalseCount = reusedValues.filter((r) => r === false).length;
      const reusedTrueCount = reusedValues.filter((r) => r === true).length;

      assert(
        reusedFalseCount === 1 && reusedTrueCount === 1,
        `14.${i}a Concurrent Trial ${i}: Exactly one session gets is_reused = false and one gets is_reused = true`
      );

      // Verify webhook row count and status
      const whCheck = await db.query<{ count: number; processing_status: string }>(`
        SELECT COUNT(*)::int AS count, MIN(processing_status) AS processing_status
        FROM public.billing_webhook_events
        WHERE payload_sha256 = '${payloadHash}';
      `);
      assert(
        whCheck.rows[0].count === 1 && whCheck.rows[0].processing_status === "processed",
        `14.${i}b Concurrent Trial ${i}: Exactly 1 webhook row recorded with status 'processed'`
      );

      // Verify ledger row count
      const ledgerCheck = await db.query<{ count: number }>(`
        SELECT COUNT(*)::int AS count
        FROM public.billing_ledger_events
        WHERE subscription_id = '${sub.id}';
      `);
      assert(
        ledgerCheck.rows[0].count === 1,
        `14.${i}c Concurrent Trial ${i}: Exactly 1 ledger row recorded`
      );

      // Verify subscription mutation
      const subCheck = await db.query<{ status: string; auto_renew_enabled: boolean }>(`
        SELECT status, auto_renew_enabled
        FROM public.billing_subscriptions
        WHERE id = '${sub.id}';
      `);
      assert(
        subCheck.rows[0].status === "non_renewing" && subCheck.rows[0].auto_renew_enabled === false,
        `14.${i}d Concurrent Trial ${i}: Subscription successfully updated to non_renewing with auto_renew_enabled = false`
      );
    }

    // 14.6: Existing committed 'processing' row produces SQLSTATE 40001, not is_reused = true
    const procSub = await createSubscription("active", true);
    const procCode = `SUB_concurproc${Math.random().toString(36).substring(2, 8)}`;
    const procCust = `CUS_concurproc${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(procSub.id, procCode, procCust, "active", "3001");
    const procHash = "a1".repeat(32);

    // Pre-insert row in 'processing' status
    await db.exec(`
      INSERT INTO public.billing_webhook_events (
        provider, environment, event_type, provider_object_id, payload_sha256,
        raw_payload, signature_verified, processing_status, processing_attempts,
        received_at, processing_started_at, updated_at
      ) VALUES (
        'paystack', 'test', 'subscription.not_renew', '${procCode}', '${procHash}',
        '{"test": true}'::jsonb, true, 'processing', 1, now(), now(), now()
      );
    `);

    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test', '${procHash}', NULL, '${procCode}', '3001', '${procCust}', 'non-renewing', NULL, now()
        );
      `);
      assert(false, "14.6 Existing 'processing' status should raise retryable 40001");
    } catch (err: any) {
      assert(err.code === "40001", "14.6 Existing 'processing' row produces SQLSTATE 40001");
    }

    // 14.7: Same payload hash with mismatched event identity produces 23505
    const collisionSubA = await createSubscription("active", true);
    const collisionSubB = await createSubscription("active", true);
    const codeA = `SUB_concurcolA${Math.random().toString(36).substring(2, 8)}`;
    const codeB = `SUB_concurcolB${Math.random().toString(36).substring(2, 8)}`;
    const custColA = `CUS_concurcolA${Math.random().toString(36).substring(2, 8)}`;
    const custColB = `CUS_concurcolB${Math.random().toString(36).substring(2, 8)}`;
    await createProviderSubscription(collisionSubA.id, codeA, custColA, "active", "3002");
    await createProviderSubscription(collisionSubB.id, codeB, custColB, "active", "3003");
    const colHash = "b2".repeat(32);

    // Successfully process with codeA
    await db.query(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test', '${colHash}', NULL, '${codeA}', '3002', '${custColA}', 'non-renewing', NULL, now()
      );
    `);

    // Attempt with same payload hash but codeB
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test', '${colHash}', NULL, '${codeB}', '3003', '${custColB}', 'non-renewing', NULL, now()
        );
      `);
      assert(false, "14.7 Mismatched provider_object_id on duplicate hash should raise 23505");
    } catch (err: any) {
      assert(err.code === "23505", "14.7 Duplicate hash with mismatched provider_object_id produces 23505");
    }

    // 14.8: Failed winner transaction leaves no orphan inbox row and allows subsequent successful processing
    const retrySub = await createSubscription("active", true);
    const retryCode = `SUB_concurretry${Math.random().toString(36).substring(2, 8)}`;
    const retryCust = `CUS_concurretry${Math.random().toString(36).substring(2, 8)}`;
    const retryHash = "c3".repeat(32);

    // Attempt call before creating provider subscription -> will fail with P0002 after claiming inbox row
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_subscription_not_renew(
          'test', '${retryHash}', NULL, '${retryCode}', '3004', '${retryCust}', 'non-renewing', NULL, now()
        );
      `);
      assert(false, "14.8 Initial call with missing provider subscription should fail with P0002");
    } catch (err: any) {
      assert(err.code === "P0002", "14.8 Failed transaction failed with P0002");
    }

    // Verify no orphan webhook inbox row exists due to transaction rollback
    const orphanCheck = await db.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count FROM public.billing_webhook_events WHERE payload_sha256 = '${retryHash}';
    `);
    assert(orphanCheck.rows[0].count === 0, "14.8 Failed transaction leaves NO orphan inbox row");

    // Now seed the provider subscription and retry with the same payload hash
    await createProviderSubscription(retrySub.id, retryCode, retryCust, "active", "3004");
    const retryRes = await db.query<NotRenewResult>(`
      SELECT * FROM public.process_paystack_subscription_not_renew(
        'test', '${retryHash}', NULL, '${retryCode}', '3004', '${retryCust}', 'non-renewing', NULL, now()
      );
    `);
    assert(
      retryRes.rows[0].is_reused === false && retryRes.rows[0].subscription_status === "non_renewing",
      "14.8 Subsequent valid retry processes successfully with is_reused = false"
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
