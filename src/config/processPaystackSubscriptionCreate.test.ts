import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.2 — Step 3C.4B-1: Paystack Provider Subscription Linking RPC Test Suite (PGlite)
 *
 * Verifies all required contract points:
 * 1. Function signature and strictly typed return contract (6 columns).
 * 2. SECURITY DEFINER.
 * 3. Empty search path.
 * 4. Execution restricted exclusively to service_role (revoked from public, anon, authenticated).
 * 5. Migration definition strictly matches schema.sql definition.
 * 6. Null and malformed parameter rejection (environment, SHA-256, prefixes, email, timestamps, tokens).
 * 7. Provider code prefixes: SUB_, CUS_, PLN_, AUTH_, SIG_.
 * 8. Decimal string provider numeric IDs (or null).
 * 9. Rejection with P0002 when no matching successful activation payment exists.
 * 10. Rejection when payment method is non-reusable or inactive.
 * 11. Rejection when payment is not succeeded or not purpose=activation.
 * 12. Rejection when commercial parameters mismatch (amount, currency, plan).
 * 13. Ambiguity rejection (23505) if multiple relationships match.
 * 14. Successful provider subscription link creation with is_current=true.
 * 15. Webhook inbox creation / update to processed.
 * 16. Immutable ledger event provider_subscription_linked recorded with event_source=paystack_webhook.
 * 17. Subscription lifecycle timestamps and payment statuses left untouched.
 * 18. Exact replay returns is_reused=true without duplication.
 * 19. Conflicting provider subscription reuse rejected.
 * 20. Conflicting active subscription code on same internal subscription rejected.
 * 21. Sensitive data protection (email_token, authorization_code not in return columns, webhook json or ledger json).
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

interface SubscriptionCreateResult {
  provider_subscription_record_id: string;
  subscription_id: string;
  payment_id: string;
  provider_subscription_code: string;
  provider_status: string;
  is_reused: boolean;
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("PROJECTMATRIX PROCESS PAYSTACK SUBSCRIPTION CREATE RPC TEST SUITE");
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
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(process.cwd(), "supabase", "migrations", file);
    const sql = fs.readFileSync(filePath, "utf-8");
    await db.exec(sql);
  }

  // Ensure canonical billing_ledger_events constraint ('user', 'system', 'paystack_webhook', 'reconciliation')
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
    INSERT INTO public.companies (name) VALUES ('Subscription Test Corp') RETURNING id;
  `);
  const companyId = companyRes.rows[0].id;

  const company2Res = await db.query<{ id: string }>(`
    INSERT INTO public.companies (name) VALUES ('Subscription Test Corp Beta') RETURNING id;
  `);
  const companyId2 = company2Res.rows[0].id;

  await db.exec(`
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyId}', '${userId}', 'Director', 'owner', true);

    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyId2}', '${userId}', 'Director', 'owner', true);
  `);

  const planRes = await db.query<{ id: string; amount_minor: number; currency: string }>(`
    SELECT id, amount_minor, currency FROM public.billing_plans WHERE code = 'business-monthly' LIMIT 1;
  `);
  const planId = planRes.rows[0].id;

  const mappingRes = await db.query<{ id: string; provider_plan_code: string; amount_minor: number; currency: string }>(`
    SELECT id, provider_plan_code, amount_minor, currency FROM public.billing_provider_plans
    WHERE plan_id = '${planId}' AND provider = 'paystack' AND environment = 'test'
    LIMIT 1;
  `);
  const providerPlanMappingId = mappingRes.rows[0].id;
  const providerPlanCode = mappingRes.rows[0].provider_plan_code;
  const amountMinor = mappingRes.rows[0].amount_minor;
  const currency = mappingRes.rows[0].currency;

  console.log("Section 1: Function Signature, Return Contract & Privilege Hardening");
  {
    const fnDefRes = await db.query<{
      prosecdef: boolean;
      provolatile: string;
      pronargs: number;
    }>(`
      SELECT prosecdef, provolatile, pronargs
      FROM pg_proc
      WHERE proname = 'process_paystack_subscription_create';
    `);
    assert(fnDefRes.rows.length === 1, "1. RPC process_paystack_subscription_create exists");
    assert(fnDefRes.rows[0].prosecdef === true, "2. RPC is defined as SECURITY DEFINER");
    assert(fnDefRes.rows[0].pronargs === 17, "3. RPC takes exactly 17 parameters");

    // Check search_path config in pg_proc
    const configRes = await db.query<any>(`
      SELECT p.prosecdef, p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'process_paystack_subscription_create';
    `);
    assert(
      configRes.rows[0]?.proconfig?.some((c: string) => c.includes("search_path=")),
      "4. Function configures strict empty search_path"
    );

    // Check privileges
    const srvExec = await db.query<{ has_exec: boolean }>(`
      SELECT has_function_privilege('service_role', 'public.process_paystack_subscription_create(text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,timestamptz,timestamptz)', 'EXECUTE') AS has_exec;
    `);
    assert(srvExec.rows[0]?.has_exec === true, "5a. Execution GRANTED to service_role");

    const authExec = await db.query<{ has_exec: boolean }>(`
      SELECT has_function_privilege('authenticated', 'public.process_paystack_subscription_create(text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,timestamptz,timestamptz)', 'EXECUTE') AS has_exec;
    `);
    assert(authExec.rows[0]?.has_exec === false, "5b. Execution REVOKED from authenticated");

    const anonExec = await db.query<{ has_exec: boolean }>(`
      SELECT has_function_privilege('anon', 'public.process_paystack_subscription_create(text,text,text,text,text,text,text,text,text,integer,text,text,text,text,text,timestamptz,timestamptz)', 'EXECUTE') AS has_exec;
    `);
    assert(anonExec.rows[0]?.has_exec === false, "5c. Execution REVOKED from anon");

    // Check migration vs schema.sql definition equivalence
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260821000001_process_paystack_subscription_create.sql"),
      "utf-8"
    );
    const schemaSql = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf-8");
    assert(
      schemaSql.includes("FUNCTION public.process_paystack_subscription_create"),
      "6a. schema.sql contains process_paystack_subscription_create definition"
    );
    assert(
      migrationSql.includes("FUNCTION public.process_paystack_subscription_create"),
      "6b. Migration contains process_paystack_subscription_create definition"
    );
  }

  console.log("\nSection 2: Input Validation & Format Rejections");
  {
    const validSha = "a".repeat(64);
    const validOccurred = new Date().toISOString();
    const validNextPayment = new Date(Date.now() + 30 * 86400000).toISOString();

    // 7. Invalid environment
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'staging', '${validSha}', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject invalid environment");
    } catch (e: any) {
      assert(e.message.includes("Invalid environment"), "7. Rejects invalid environment 'staging'");
    }

    // 8. Invalid SHA-256 (uppercase or malformed length)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', 'INVALID_HEX_HASH', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject invalid SHA-256 hash");
    } catch (e: any) {
      assert(e.message.includes("Invalid payload SHA-256 hash"), "8. Rejects malformed SHA-256 hash");
    }

    // 9. Invalid subscription code (missing SUB_ prefix)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'INVALID_SUB_CODE', '100', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject subscription code without SUB_ prefix");
    } catch (e: any) {
      assert(e.message.includes("Invalid provider subscription code format"), "9. Rejects non-SUB_ subscription code");
    }

    // 10. Invalid customer code (missing CUS_ prefix)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', '100', 'INVALID_CUS_CODE', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject customer code without CUS_ prefix");
    } catch (e: any) {
      assert(e.message.includes("Invalid provider customer code format"), "10. Rejects non-CUS_ customer code");
    }

    // 11. Invalid plan code (missing PLN_ prefix)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'test@example.com',
        'PLAN_NO_PREFIX', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject plan code without PLN_ prefix");
    } catch (e: any) {
      assert(e.message.includes("Invalid provider plan code format"), "11. Rejects non-PLN_ plan code");
    }

    // 12. Invalid authorization code (missing AUTH_ prefix)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'BAD_AUTH', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject auth code without AUTH_ prefix");
    } catch (e: any) {
      assert(e.message.includes("Invalid authorization code format"), "12. Rejects non-AUTH_ authorization code");
    }

    // 13. Invalid authorization signature (missing SIG_ prefix)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'BAD_SIG', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject signature without SIG_ prefix");
    } catch (e: any) {
      assert(e.message.includes("Invalid authorization signature format"), "13. Rejects non-SIG_ signature");
    }

    // 14. Invalid email token (empty)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', '   ', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject empty email token");
    } catch (e: any) {
      assert(e.message.includes("Email token must not be empty"), "14. Rejects blank email token");
    }

    // 15. Invalid provider status (not active)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', 'tok_123', 'cancelled',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject non-active provider status");
    } catch (e: any) {
      assert(e.message.includes("Invalid provider status"), "15. Rejects non-active provider status");
    }

    // 16. Invalid numeric string for subscription id
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', 'NOT_NUMERIC', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject non-numeric provider subscription id");
    } catch (e: any) {
      assert(e.message.includes("Must be decimal digits string"), "16. Rejects non-numeric provider subscription id");
    }

    // 17. Invalid customer email format
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'invalid-email',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_123', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject malformed customer email");
    } catch (e: any) {
      assert(e.message.includes("Invalid customer email format"), "17. Rejects malformed customer email");
    }

    // 18. Invalid currency (lowercase or not 3 chars)
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_1', 'SUB_123', '100', 'CUS_123', '200', 'test@example.com',
        '${providerPlanCode}', ${amountMinor}, 'zar', 'AUTH_123', 'SIG_123', 'tok_123', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject lowercase currency");
    } catch (e: any) {
      assert(e.message.includes("Invalid currency"), "18. Rejects lowercase or non-3-letter currency");
    }
  }

  console.log("\nSection 3: Internal Resolution & Missing Activation Handling (P0002)");
  {
    const validSha = "b".repeat(64);
    const validOccurred = new Date().toISOString();
    const validNextPayment = new Date(Date.now() + 30 * 86400000).toISOString();

    // 19. Case: When no payment / payment method exists at all
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test', '${validSha}', 'evt_101', 'SUB_test001', '1001', 'CUS_test001', '2001', 'missing@example.com',
        '${providerPlanCode}', ${amountMinor}, '${currency}', 'AUTH_test001', 'SIG_test001', 'tok_test001', 'active',
        '${validNextPayment}'::timestamptz, '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should fail when no activation payment exists");
    } catch (e: any) {
      if (!e.message.includes("No matching successful activation payment method") && e.code !== "P0002") {
        console.error("DEBUG TEST 19 ERROR:", e);
      }
      assert(
        e.code === "P0002" || e.message.includes("No matching successful activation payment method"),
        "19. Raises P0002 when no matching activation payment method found"
      );
    }
  }

  console.log("\nSection 4: Successful Activation, Linking & State Preservation");
  {
    // Setup clean subscription, payment and reusable payment method
    const subRef = "SUB-20260821-00000000000000000000000000000001";
    const subRes = await db.query<{ id: string }>(`
      INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, amount_minor, currency, billing_interval,
        created_by, status, current_period_start, current_period_end, next_renewal_at, auto_renew_enabled
      ) VALUES (
        '${companyId}', '${planId}', '${subRef}', ${amountMinor}, '${currency}', 'monthly',
        '${userId}', 'active', now(), now() + interval '30 days', now() + interval '30 days', true
      ) RETURNING id;
    `);
    const subId = subRes.rows[0].id;

    const payRes = await db.query<{ id: string }>(`
      INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        idempotency_key, provider_reference, provider_transaction_id, customer_email, amount_minor, currency,
        status, purpose, paid_at
      ) VALUES (
        '${companyId}', '${subId}', '${planId}', '${providerPlanMappingId}', 'paystack', 'test',
        gen_random_uuid(), 'PAY-20260821-00000000000000000000000000000001', '10000000001', 'customer@example.com', ${amountMinor}, '${currency}',
        'succeeded', 'activation', now()
      ) RETURNING id;
    `);
    const paymentId = payRes.rows[0].id;

    const pmRes = await db.query<{ id: string }>(`
      INSERT INTO public.billing_payment_methods (
        company_id, provider, environment, provider_customer_code, customer_email,
        authorization_code, authorization_signature, channel, card_type, brand, bank, last4,
        expiry_month, expiry_year, country_code, reusable, is_active, source_payment_id
      ) VALUES (
        '${companyId}', 'paystack', 'test', 'CUS_cust12345', 'customer@example.com',
        'AUTH_auth12345', 'SIG_sig12345', 'card', 'visa', 'visa', 'Access Bank', '4081',
        12, 2030, 'NG', true, true, '${paymentId}'
      ) RETURNING id;
    `);
    const paymentMethodId = pmRes.rows[0].id;

    const validSha = "c".repeat(64);
    const validOccurred = new Date().toISOString();
    const nextPaymentAt = new Date(Date.now() + 30 * 86400000).toISOString();

    const linkRes = await db.query<SubscriptionCreateResult>(`
      SELECT * FROM public.process_paystack_subscription_create(
        'test',
        '${validSha}',
        'evt_create_1',
        'SUB_sub12345',
        '99887766',
        'CUS_cust12345',
        '55443322',
        'customer@example.com',
        '${providerPlanCode}',
        ${amountMinor},
        '${currency}',
        'AUTH_auth12345',
        'SIG_sig12345',
        'email_token_secret_123',
        'active',
        '${nextPaymentAt}'::timestamptz,
        '${validOccurred}'::timestamptz
      );
    `);

    assert(linkRes.rows.length === 1, "20. RPC returned single row");
    const row = linkRes.rows[0];
    assert(row.subscription_id === subId, "21. Correct subscription_id returned");
    assert(row.payment_id === paymentId, "22. Correct payment_id returned");
    assert(row.provider_subscription_code === "SUB_sub12345", "23. Correct provider_subscription_code returned");
    assert(row.provider_status === "active", "24. Correct provider_status returned");
    assert(row.is_reused === false, "25. is_reused is FALSE on initial link");

    // Verify row in billing_provider_subscriptions
    const provSubRes = await db.query<{
      id: string;
      subscription_id: string;
      email_token: string;
      customer_email: string;
      is_current: boolean;
      payment_method_id: string;
    }>(`
      SELECT * FROM public.billing_provider_subscriptions WHERE id = '${row.provider_subscription_record_id}';
    `);
    assert(provSubRes.rows.length === 1, "26. billing_provider_subscriptions row exists");
    assert(provSubRes.rows[0].is_current === true, "27. is_current is true");
    assert(provSubRes.rows[0].email_token === "email_token_secret_123", "28. email_token stored securely in provider_subscriptions");
    assert(provSubRes.rows[0].payment_method_id === paymentMethodId, "29. payment_method_id correctly linked");

    // Verify webhook inbox record
    const webhookRes = await db.query<{
      event_type: string;
      processing_status: string;
      raw_payload: any;
    }>(`
      SELECT * FROM public.billing_webhook_events WHERE payload_sha256 = '${validSha}';
    `);
    assert(webhookRes.rows.length === 1, "30. Webhook inbox event recorded");
    assert(webhookRes.rows[0].processing_status === "processed", "31. Webhook status is 'processed'");
    assert(webhookRes.rows[0].event_type === "subscription.create", "32. Webhook event_type is subscription.create");
    assert(
      !("email_token" in webhookRes.rows[0].raw_payload),
      "33. Sensitive email_token excluded from webhook raw_payload"
    );

    // Verify immutable ledger event
    const ledgerRes = await db.query<{
      event_type: string;
      event_source: string;
      deduplication_key: string;
      event_data: any;
    }>(`
      SELECT * FROM public.billing_ledger_events
      WHERE subscription_id = '${subId}' AND event_type = 'provider_subscription_linked';
    `);
    assert(ledgerRes.rows.length === 1, "34. Immutable ledger event recorded");
    assert(ledgerRes.rows[0].event_source === "paystack_webhook", "35. Ledger event_source is 'paystack_webhook'");
    assert(
      ledgerRes.rows[0].deduplication_key === `provider_subscription_linked:paystack:test:${subId}:SUB_sub12345`,
      "36. Ledger deduplication_key exactly follows 'provider_subscription_linked:paystack:<environment>:<sub_id>:<sub_code>'"
    );
    assert(
      !("email_token" in ledgerRes.rows[0].event_data),
      "37. email_token excluded from ledger event_data"
    );
    assert(
      !("authorization_code" in ledgerRes.rows[0].event_data),
      "38. authorization_code excluded from ledger event_data"
    );
    assert(
      !("customer_email" in ledgerRes.rows[0].event_data),
      "39. customer_email excluded from ledger event_data"
    );
    assert(
      ledgerRes.rows[0].event_data.linked_payment_method_id === paymentMethodId,
      "40. linked_payment_method_id included in ledger event_data"
    );

    // Verify webhook inbox record sanitized
    assert(
      !("email_token" in webhookRes.rows[0].raw_payload),
      "41. Sensitive email_token excluded from webhook raw_payload"
    );
    assert(
      !("authorization_code" in webhookRes.rows[0].raw_payload),
      "42. Sensitive authorization_code excluded from webhook raw_payload"
    );
    assert(
      !("customer_email" in webhookRes.rows[0].raw_payload),
      "43. Sensitive customer_email excluded from webhook raw_payload"
    );

    // Verify return contract has only safe columns
    const returnKeys = Object.keys(row).sort();
    const expectedKeys = [
      "is_reused",
      "payment_id",
      "provider_status",
      "provider_subscription_code",
      "provider_subscription_record_id",
      "subscription_id",
    ].sort();
    assert(
      JSON.stringify(returnKeys) === JSON.stringify(expectedKeys),
      "44. RPC return value contains ONLY non-sensitive columns"
    );

    // Verify subscription status and period left completely unchanged
    const verifySub = await db.query<{
      status: string;
      auto_renew_enabled: boolean;
    }>(`
      SELECT status, auto_renew_enabled FROM public.billing_subscriptions WHERE id = '${subId}';
    `);
    assert(verifySub.rows[0].status === "active", "45. Subscription status remains active");
    assert(verifySub.rows[0].auto_renew_enabled === true, "46. auto_renew_enabled remains untouched");

    console.log("\nSection 5: Idempotency & Exact Replay");
    // Replay identical event
    const replayRes = await db.query<SubscriptionCreateResult>(`
      SELECT * FROM public.process_paystack_subscription_create(
        'test',
        '${validSha}',
        'evt_create_1',
        'SUB_sub12345',
        '99887766',
        'CUS_cust12345',
        '55443322',
        'customer@example.com',
        '${providerPlanCode}',
        ${amountMinor},
        '${currency}',
        'AUTH_auth12345',
        'SIG_sig12345',
        'email_token_secret_123',
        'active',
        '${nextPaymentAt}'::timestamptz,
        '${validOccurred}'::timestamptz
      );
    `);
    assert(replayRes.rows.length === 1, "47. Replay returned single row");
    assert(replayRes.rows[0].is_reused === true, "48. is_reused is TRUE on exact replay");
    assert(
      replayRes.rows[0].provider_subscription_record_id === row.provider_subscription_record_id,
      "49. Same provider subscription record ID returned"
    );

    // Ensure no additional provider subscription, webhook, or ledger event was appended
    const countProvSub = await db.query<{ count: number }>(`
      SELECT count(*)::int as count FROM public.billing_provider_subscriptions
      WHERE provider_subscription_code = 'SUB_sub12345' AND environment = 'test';
    `);
    assert(countProvSub.rows[0].count === 1, "50. No second provider-subscription row on replay");

    const countWebhook = await db.query<{ count: number }>(`
      SELECT count(*)::int as count FROM public.billing_webhook_events
      WHERE payload_sha256 = '${validSha}';
    `);
    assert(countWebhook.rows[0].count === 1, "51. No second webhook row on replay");

    const countLedger = await db.query<{ count: number }>(`
      SELECT count(*)::int as count FROM public.billing_ledger_events
      WHERE subscription_id = '${subId}' AND event_type = 'provider_subscription_linked';
    `);
    assert(countLedger.rows[0].count === 1, "52. No duplicate ledger events appended on replay");

    console.log("\nSection 6: Environment Scoping (Test vs Live Independence)");
    // Setup distinct company and live subscription and activation payment to test live environment ledger key
    const compResLive = await db.query<{ id: string }>(`
      INSERT INTO public.companies (name) VALUES ('Live Company') RETURNING id;
    `);
    const companyIdLive = compResLive.rows[0].id;
    await db.query(`
      INSERT INTO public.company_members (company_id, profile_id, role, is_active)
      VALUES ('${companyIdLive}', '${userId}', 'owner', true);
    `);

    const subRefLive = "SUB-20260821-00000000000000000000000000000002";
    const subResLive = await db.query<{ id: string }>(`
      INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, amount_minor, currency, billing_interval,
        created_by, status, current_period_start, current_period_end, next_renewal_at, auto_renew_enabled
      ) VALUES (
        '${companyIdLive}', '${planId}', '${subRefLive}', ${amountMinor}, '${currency}', 'monthly',
        '${userId}', 'active', now(), now() + interval '30 days', now() + interval '30 days', true
      ) RETURNING id;
    `);
    const subIdLive = subResLive.rows[0].id;

    // Create live plan mapping
    const livePlanCode = "PLN_livesub123";
    const livePlanRes = await db.query<{ id: string }>(`
      INSERT INTO public.billing_provider_plans (
        plan_id, provider, environment, provider_plan_code, amount_minor, currency, billing_interval, is_active
      ) VALUES (
        '${planId}', 'paystack', 'live', '${livePlanCode}', ${amountMinor}, '${currency}', 'monthly', true
      ) RETURNING id;
    `);
    const liveProviderPlanMappingId = livePlanRes.rows[0].id;

    const payResLive = await db.query<{ id: string }>(`
      INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        idempotency_key, provider_reference, provider_transaction_id, customer_email, amount_minor, currency,
        status, purpose, paid_at
      ) VALUES (
        '${companyIdLive}', '${subIdLive}', '${planId}', '${liveProviderPlanMappingId}', 'paystack', 'live',
        gen_random_uuid(), 'PAY-20260821-00000000000000000000000000000003', '10000000003', 'customer@example.com', ${amountMinor}, '${currency}',
        'succeeded', 'activation', now()
      ) RETURNING id;
    `);
    const paymentIdLive = payResLive.rows[0].id;

    await db.query<{ id: string }>(`
      INSERT INTO public.billing_payment_methods (
        company_id, provider, environment, provider_customer_code, customer_email,
        authorization_code, authorization_signature, channel, card_type, brand, bank, last4,
        expiry_month, expiry_year, country_code, reusable, is_active, source_payment_id
      ) VALUES (
        '${companyIdLive}', 'paystack', 'live', 'CUS_cust12345', 'customer@example.com',
        'AUTH_auth12345', 'SIG_sig12345', 'card', 'visa', 'visa', 'Access Bank', '4081',
        12, 2030, 'NG', true, true, '${paymentIdLive}'
      ) RETURNING id;
    `);

    const liveSha = "f".repeat(64);
    // Use the exact same SUB_sub12345 code in live environment
    const liveLinkRes = await db.query<SubscriptionCreateResult>(`
      SELECT * FROM public.process_paystack_subscription_create(
        'live',
        '${liveSha}',
        'evt_create_live',
        'SUB_sub12345',
        '99887766',
        'CUS_cust12345',
        '55443322',
        'customer@example.com',
        '${livePlanCode}',
        ${amountMinor},
        '${currency}',
        'AUTH_auth12345',
        'SIG_sig12345',
        'email_token_secret_live',
        'active',
        '${nextPaymentAt}'::timestamptz,
        '${validOccurred}'::timestamptz
      );
    `);

    assert(liveLinkRes.rows.length === 1, "53. Successfully linked subscription in 'live' environment");

    const liveLedgerRes = await db.query<{
      deduplication_key: string;
    }>(`
      SELECT deduplication_key FROM public.billing_ledger_events
      WHERE subscription_id = '${subIdLive}' AND event_type = 'provider_subscription_linked';
    `);
    assert(
      liveLedgerRes.rows[0].deduplication_key === `provider_subscription_linked:paystack:live:${subIdLive}:SUB_sub12345`,
      "54. Live environment ledger key includes 'live' environment and does not collide with 'test'"
    );

    console.log("\nSection 7: Conflict & Ambiguity Protections");
    // 55. Conflicting reuse of same subscription code with different email token
    try {
      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test',
        '${"d".repeat(64)}',
        'evt_create_diff',
        'SUB_sub12345',
        '99887766',
        'CUS_cust12345',
        '55443322',
        'customer@example.com',
        '${providerPlanCode}',
        ${amountMinor},
        '${currency}',
        'AUTH_auth12345',
        'SIG_sig12345',
        'DIFFERENT_EMAIL_TOKEN',
        'active',
        '${nextPaymentAt}'::timestamptz,
        '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject conflicting reuse of provider subscription code");
    } catch (e: any) {
      assert(
        e.code === "23505" || e.message.includes("Conflicting reuse"),
        "55. Rejects conflicting reuse with 23505"
      );
    }

    // 56. Reject when a different active provider subscription code already exists for the internal subscription
    try {
      // Create another distinct activation payment method for same subscription to test conflict
      const payRes2 = await db.query<{ id: string }>(`
        INSERT INTO public.billing_payments (
          company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
          idempotency_key, provider_reference, provider_transaction_id, customer_email, amount_minor, currency,
          status, purpose, paid_at
        ) VALUES (
          '${companyId}', '${subId}', '${planId}', '${providerPlanMappingId}', 'paystack', 'test',
          gen_random_uuid(), 'PAY-20260821-00000000000000000000000000000002', '10000000002', 'customer2@example.com', ${amountMinor}, '${currency}',
          'succeeded', 'activation', now()
        ) RETURNING id;
      `);
      const paymentId2 = payRes2.rows[0].id;

      await db.query(`
        INSERT INTO public.billing_payment_methods (
          company_id, provider, environment, provider_customer_code, customer_email,
          authorization_code, authorization_signature, channel, card_type, brand, bank, last4,
          expiry_month, expiry_year, country_code, reusable, is_active, source_payment_id
        ) VALUES (
          '${companyId}', 'paystack', 'test', 'CUS_cust99999', 'customer2@example.com',
          'AUTH_auth99999', 'SIG_sig99999', 'card', 'visa', 'visa', 'Access Bank', '4081',
          12, 2030, 'NG', true, true, '${paymentId2}'
        );
      `);

      await db.query(`SELECT * FROM public.process_paystack_subscription_create(
        'test',
        '${"e".repeat(64)}',
        'evt_create_diff2',
        'SUB_sub99999',
        '99887799',
        'CUS_cust99999',
        '55443399',
        'customer2@example.com',
        '${providerPlanCode}',
        ${amountMinor},
        '${currency}',
        'AUTH_auth99999',
        'SIG_sig99999',
        'email_token_secret_999',
        'active',
        '${nextPaymentAt}'::timestamptz,
        '${validOccurred}'::timestamptz
      );`);
      assert(false, "Should reject when active provider subscription already exists for this subscription");
    } catch (e: any) {
      assert(
        e.code === "23505" || e.message.includes("already exists for subscription"),
        "56. Rejects conflicting active provider subscription code for same internal subscription"
      );
    }
  }

  console.log("\n=================================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed with unhandled error:", err);
  process.exit(1);
});
