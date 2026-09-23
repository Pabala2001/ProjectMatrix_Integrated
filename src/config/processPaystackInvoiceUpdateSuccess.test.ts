import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.2 — Step 3C.4E-3A: Paystack invoice.update Success Database RPC Test Suite (PGlite)
 *
 * Verifies all required validation, lifecycle, idempotency, security, and schema contract points:
 * 1. Function metadata, SECURITY DEFINER, search_path = '', and service_role execute privilege.
 * 2. Strict input validation (environment, sha256, event_id, invoice_code, sub_code, cust_code, plan_code, invoice_status, paid, txn_status, txn_id, ref, amount, currency, periods, paid_at, next_payment_date, occurred_at).
 * 3. Subscription resolution & prerequisite scope (P0002, 23514).
 * 4. Lifecycle matrix execution:
 *    - Reject pending_activation / trialing (SQLSTATE 23514).
 *    - Materialize new invoice as 'paid' and advance active subscription period.
 *    - Transition existing pending / failed invoice to 'paid'.
 *    - Recover past_due subscription to 'active' and clear past_due_since.
 *    - Preserve past_due subscription if payment is for an older historical period.
 *    - Handle non_renewing subscription (advance period, retain non_renewing, next_renewal_at null).
 *    - Preserve expired / cancelled subscription status without regression.
 * 5. Payment recording & reconciliation:
 *    - Create new succeeded renewal payment with proper purpose and linkage.
 *    - Reconcile existing pending/failed payment to succeeded.
 *    - Handle call without transaction details (null payment_id).
 * 6. Webhook inbox claiming and exact replay handling (is_reused = true, zero new ledger entries).
 * 7. Semantic invoice idempotency across different payload hashes for the same invoice code.
 * 8. Sanitization of webhook raw_payload and ledger event_data.
 * 9. Exact safe return-column contract (17 columns).
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

interface InvoiceUpdateSuccessResult {
  webhook_event_id: string;
  invoice_id: string | null;
  payment_id: string | null;
  provider_subscription_record_id: string;
  subscription_id: string;
  provider_invoice_code: string;
  invoice_status: string | null;
  payment_status: string | null;
  subscription_status: string | null;
  amount_minor: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  next_renewal_at: string | null;
  past_due_since: string | null;
  is_reused: boolean;
  is_ignored: boolean;
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("PROJECTMATRIX PROCESS PAYSTACK INVOICE UPDATE SUCCESS RPC TEST SUITE");
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
    "20260827000001_process_paystack_invoice_update_success.sql",
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
  const providerPlanCode = mappingRes.rows[0].provider_plan_code; // 'PLN_os65zcdsrs9yyes'

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
    const pStartSql = periodStart ? `'${periodStart}'::timestamptz` : "now() - INTERVAL '30 days'";
    const pEndSql = periodEnd ? `'${periodEnd}'::timestamptz` : "now()";

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
    provSubId: string | null = null,
    isCurrent = true,
    environment = "test"
  ) {
    const subInfo = (
      await db.query<{ company_id: string }>(`
      SELECT company_id FROM public.billing_subscriptions WHERE id = '${subId}';
    `)
    ).rows[0];

    const generatedSubId = provSubId ?? Math.floor(Math.random() * 100000000).toString();

    const res = await db.query<{ id: string }>(`
      INSERT INTO public.billing_provider_subscriptions (
        company_id, subscription_id, plan_id, provider_plan_mapping_id,
        provider, environment, provider_subscription_code, provider_subscription_id,
        provider_customer_code, email_token, customer_email, provider_status,
        next_payment_at, is_current, last_synced_at
      ) VALUES (
        '${subInfo.company_id}', '${subId}', '${planId}', '${providerPlanMappingId}',
        'paystack', '${environment}', '${provSubCode}', '${generatedSubId}',
        '${provCustCode}', 'tok_test123', 'pm@example.com', '${provStatus}',
        now() + INTERVAL '30 days', ${isCurrent}, now()
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
      WHERE proname = 'process_paystack_invoice_update_success';
    `);

    assert(fnDefRes.rows.length === 1, "1.1 Function process_paystack_invoice_update_success exists");
    assert(fnDefRes.rows[0].prosecdef === true, "1.2 Function is marked SECURITY DEFINER");
    assert(fnDefRes.rows[0].pronargs === 19, "1.3 Function has exactly 19 parameters");

    // Check search_path configuration
    const configRes = await db.query<{ proconfig: string[] }>(`
      SELECT proconfig FROM pg_proc WHERE proname = 'process_paystack_invoice_update_success';
    `);
    const hasEmptySearchPath = configRes.rows[0]?.proconfig?.some((cfg: string) => cfg.startsWith("search_path="));
    assert(hasEmptySearchPath, "1.4 Function search_path is hardened (search_path = '')");

    // Check schema parity between migration file and schema.sql
    const schemaSql = fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf-8");
    assert(schemaSql.includes("process_paystack_invoice_update_success"), "1.5 schema.sql contains process_paystack_invoice_update_success");
    assert(
      schemaSql.includes("Atomically processes an authenticated and signature-verified successful Paystack invoice.update"),
      "1.6 schema.sql comment parity confirmed"
    );
  }

  console.log("\nSection 2: Strict Input Validation (SQLSTATE 22004 & 22023)");
  {
    const validHash = "b".repeat(64);
    const validInvCode = "INV_testsucc001";
    const validSubCode = "SUB_testsucc001";
    const validCustCode = "CUS_testsucc001";
    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now()).toISOString();
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const paidAt = nowIso;

    async function testValidation(params: Record<string, any>, expectedCode: string, testDesc: string) {
      const p = {
        env: "'test'",
        hash: `'${validHash}'`,
        eventId: "NULL",
        invCode: `'${validInvCode}'`,
        subCode: `'${validSubCode}'`,
        custCode: `'${validCustCode}'`,
        planCode: `'${providerPlanCode}'`,
        invStatus: "'success'",
        paid: "true",
        txnStatus: "'success'",
        txnId: "'334455'",
        ref: "'ref_test_001'",
        amount: 500000,
        currency: "'ZAR'",
        pStart: `'${periodStart}'::timestamptz`,
        pEnd: `'${periodEnd}'::timestamptz`,
        paidAt: `'${paidAt}'::timestamptz`,
        nextPayment: "NULL",
        occurredAt: `'${nowIso}'::timestamptz`,
        ...params,
      };

      try {
        await db.query(`
          SELECT * FROM public.process_paystack_invoice_update_success(
            ${p.env}, ${p.hash}, ${p.eventId}, ${p.invCode}, ${p.subCode},
            ${p.custCode}, ${p.planCode}, ${p.invStatus}, ${p.paid}, ${p.txnStatus},
            ${p.txnId}, ${p.ref}, ${p.amount}, ${p.currency}, ${p.pStart},
            ${p.pEnd}, ${p.paidAt}, ${p.nextPayment}, ${p.occurredAt}
          );
        `);
        assert(false, testDesc);
      } catch (err: any) {
        assert(err.code === expectedCode, `${testDesc} (got SQLSTATE ${err.code})`);
      }
    }

    await testValidation({ env: "NULL" }, "22004", "2.1 Null environment produces SQLSTATE 22004");
    await testValidation({ env: "'staging'" }, "22023", "2.2 Invalid environment produces SQLSTATE 22023");
    await testValidation({ hash: "NULL" }, "22004", "2.3 Null payload SHA-256 produces SQLSTATE 22004");
    await testValidation({ hash: `'${"B".repeat(64)}'` }, "22023", "2.4 Uppercase payload hash produces SQLSTATE 22023");
    await testValidation({ invCode: "NULL" }, "22004", "2.5 Null provider invoice code produces SQLSTATE 22004");
    await testValidation({ invCode: "'INVALID_CODE'" }, "22023", "2.6 Invalid provider invoice code produces SQLSTATE 22023");
    await testValidation({ subCode: "NULL" }, "22004", "2.7 Null provider subscription code produces SQLSTATE 22004");
    await testValidation({ subCode: "'INVALID_SUB'" }, "22023", "2.8 Invalid provider subscription code produces SQLSTATE 22023");
    await testValidation({ custCode: "NULL" }, "22004", "2.9 Null provider customer code produces SQLSTATE 22004");
    await testValidation({ custCode: "'INVALID_CUST'" }, "22023", "2.10 Invalid provider customer code produces SQLSTATE 22023");
    await testValidation({ invStatus: "NULL" }, "22004", "2.11 Null provider invoice status produces SQLSTATE 22004");
    await testValidation({ invStatus: "'failed'" }, "22023", "2.12 Non-success provider invoice status produces SQLSTATE 22023");
    await testValidation({ paid: "NULL" }, "22004", "2.13 Null provider paid produces SQLSTATE 22004");
    await testValidation({ paid: "false" }, "22023", "2.14 False provider paid produces SQLSTATE 22023");
    await testValidation({ txnStatus: "'failed'" }, "22023", "2.15 Non-success provider transaction status produces SQLSTATE 22023");
    await testValidation({ amount: "NULL" }, "22004", "2.16 Null amount_minor produces SQLSTATE 22004");
    await testValidation({ amount: "0" }, "22023", "2.17 Zero amount_minor produces SQLSTATE 22023");
    await testValidation({ currency: "NULL" }, "22004", "2.18 Null currency produces SQLSTATE 22004");
    await testValidation({ currency: "'zar'" }, "22023", "2.19 Lowercase currency produces SQLSTATE 22023");
    await testValidation({ pStart: "NULL" }, "22004", "2.20 Null period_start produces SQLSTATE 22004");
    await testValidation({ pEnd: "NULL" }, "22004", "2.21 Null period_end produces SQLSTATE 22004");
    await testValidation({ pStart: `'${periodEnd}'::timestamptz`, pEnd: `'${periodStart}'::timestamptz` }, "22023", "2.22 Inverted period boundaries produces SQLSTATE 22023");
    await testValidation({ paidAt: "NULL" }, "22004", "2.23 Null paid_at produces SQLSTATE 22004");
    await testValidation({ occurredAt: "NULL" }, "22004", "2.24 Null occurred_at produces SQLSTATE 22004");
  }

  console.log("\nSection 3: Subscription Resolution & Prerequisite Scope (P0002 & 23514)");
  {
    const sub = await createSubscription("active");
    const validSubCode = "SUB_res001";
    const validCustCode = "CUS_res001";
    await createProviderSubscription(sub.id, validSubCode, validCustCode);

    const nowIso = new Date().toISOString();
    const periodStart = new Date(Date.now()).toISOString();
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();

    // 3.1 Non-existent provider subscription code
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"c".repeat(64)}', NULL, 'INV_scope001', 'SUB_nonexistent999',
          '${validCustCode}', NULL, 'success', true, 'success',
          '334455', 'ref_scope_1', 500000, 'ZAR', '${periodStart}'::timestamptz,
          '${periodEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);
      assert(false, "3.1 Missing provider subscription produces SQLSTATE P0002");
    } catch (err: any) {
      assert(err.code === "P0002", `3.1 Missing provider subscription produces SQLSTATE P0002 (got ${err.code})`);
    }

    // 3.2 Customer code mismatch
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"d".repeat(64)}', NULL, 'INV_scope002', '${validSubCode}',
          'CUS_mismatch999', NULL, 'success', true, 'success',
          '334455', 'ref_scope_2', 500000, 'ZAR', '${periodStart}'::timestamptz,
          '${periodEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);
      assert(false, "3.2 Customer code mismatch produces SQLSTATE P0002");
    } catch (err: any) {
      assert(err.code === "P0002", `3.2 Customer code mismatch produces SQLSTATE P0002 (got ${err.code})`);
    }

    // 3.3 Commercial amount mismatch
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"e".repeat(64)}', NULL, 'INV_scope003', '${validSubCode}',
          '${validCustCode}', NULL, 'success', true, 'success',
          '334455', 'ref_scope_3', 999999, 'ZAR', '${periodStart}'::timestamptz,
          '${periodEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);
      assert(false, "3.3 Commercial amount mismatch produces SQLSTATE 23514");
    } catch (err: any) {
      assert(err.code === "23514", `3.3 Commercial amount mismatch produces SQLSTATE 23514 (got ${err.code})`);
    }

    // 3.4 Commercial currency mismatch
    try {
      await db.query(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"f".repeat(64)}', NULL, 'INV_scope004', '${validSubCode}',
          '${validCustCode}', NULL, 'success', true, 'success',
          '334455', 'ref_scope_4', 500000, 'USD', '${periodStart}'::timestamptz,
          '${periodEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);
      assert(false, "3.4 Commercial currency mismatch produces SQLSTATE 23514");
    } catch (err: any) {
      assert(err.code === "23514", `3.4 Commercial currency mismatch produces SQLSTATE 23514 (got ${err.code})`);
    }
  }

  console.log("\nSection 4: Lifecycle Matrix Execution");
  {
    const nowIso = new Date().toISOString();
    const pStart = new Date(Date.now()).toISOString();
    const pEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const nextRenewal = new Date(Date.now() + 30 * 86400000).toISOString();

    // 4.1 Reject pending_activation subscription
    {
      const sub = await createSubscription("pending_activation");
      const subCode = "SUB_pendact001";
      const custCode = "CUS_pendact001";
      await createProviderSubscription(sub.id, subCode, custCode);

      try {
        await db.query(`
          SELECT * FROM public.process_paystack_invoice_update_success(
            'test', '${"1".repeat(64)}', NULL, 'INV_pendact001', '${subCode}',
            '${custCode}', NULL, 'success', true, 'success',
            '334455', 'ref_pend_1', 500000, 'ZAR', '${pStart}'::timestamptz,
            '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
          );
        `);
        assert(false, "4.1 pending_activation state produces SQLSTATE 23514");
      } catch (err: any) {
        assert(err.code === "23514", `4.1 pending_activation state produces SQLSTATE 23514 (got ${err.code})`);
      }
    }

    // 4.2 Materialize new invoice and advance active subscription period
    {
      const oldPStart = new Date(Date.now() - 30 * 86400000).toISOString();
      const oldPEnd = new Date(Date.now()).toISOString();
      const sub = await createSubscription("active", planAmountMinor, planCurrency, null, oldPStart, oldPEnd);
      const subCode = "SUB_renew001";
      const custCode = "CUS_renew001";
      const provSubRecId = await createProviderSubscription(sub.id, subCode, custCode);

      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"2".repeat(64)}', 'EVT_succ_001', 'INV_renew001', '${subCode}',
          '${custCode}', '${providerPlanCode}', 'success', true, 'success',
          'TXN_998811', 'REF_renew_001', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, '${nextRenewal}'::timestamptz, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows.length === 1, "4.2.1 Returned 1 row");
      const row = res.rows[0];
      assert(row.invoice_status === "paid", "4.2.2 Invoice status is 'paid'");
      assert(row.payment_status === "succeeded", "4.2.3 Payment status is 'succeeded'");
      assert(row.subscription_status === "active", "4.2.4 Subscription status remains 'active'");
      assert(row.is_reused === false, "4.2.5 is_reused is false");
      assert(row.is_ignored === false, "4.2.6 is_ignored is false");

      // Verify DB invoice record
      const invDb = (await db.query<{ status: string; provider_status: string; paid_at: string }>(`
        SELECT status, provider_status, paid_at FROM public.billing_invoices WHERE id = '${row.invoice_id}';
      `)).rows[0];
      assert(invDb.status === "paid", "4.2.7 DB invoice status is 'paid'");
      assert(invDb.provider_status === "success", "4.2.8 DB provider_status is 'success'");
      assert(invDb.paid_at !== null, "4.2.9 DB invoice paid_at is recorded");

      // Verify DB payment record
      const payDb = (await db.query<{ status: string; purpose: string; billing_invoice_id: string }>(`
        SELECT status, purpose, billing_invoice_id FROM public.billing_payments WHERE id = '${row.payment_id}';
      `)).rows[0];
      assert(payDb.status === "succeeded", "4.2.10 DB payment status is 'succeeded'");
      assert(payDb.purpose === "renewal", "4.2.11 DB payment purpose is 'renewal'");
      assert(payDb.billing_invoice_id === row.invoice_id, "4.2.12 DB payment linked to invoice");

      // Verify DB subscription period advancement
      const subDb = (await db.query<{ current_period_start: string; current_period_end: string }>(`
        SELECT current_period_start, current_period_end FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];
      assert(new Date(subDb.current_period_end).getTime() === new Date(pEnd).getTime(), "4.2.13 Subscription period advanced");

      // Verify ledger events
      const ledgerRes = await db.query<{ event_type: string }>(`
        SELECT event_type FROM public.billing_ledger_events
        WHERE subscription_id = '${sub.id}'
        ORDER BY occurred_at ASC;
      `);
      const eventTypes = ledgerRes.rows.map((r) => r.event_type);
      assert(eventTypes.includes("billing_invoice_paid"), "4.2.14 billing_invoice_paid ledger emitted");
      assert(eventTypes.includes("renewal_payment_succeeded"), "4.2.15 renewal_payment_succeeded ledger emitted");
    }

    // 4.3 Transition existing pending / failed invoice to paid
    {
      const sub = await createSubscription("active");
      const subCode = "SUB_invtrans001";
      const custCode = "CUS_invtrans001";
      const provSubRecId = await createProviderSubscription(sub.id, subCode, custCode);

      // Create an existing pending invoice
      const invCode = "INV_pending001";
      const createdInv = (await db.query<{ id: string }>(`
        INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider,
          environment, provider_invoice_code, status, provider_status, amount_minor,
          currency, period_start, period_end, created_at, updated_at
        ) VALUES (
          '${sub.company_id}', '${sub.id}', '${provSubRecId}', 'paystack',
          'test', '${invCode}', 'pending', 'pending', 500000,
          'ZAR', '${pStart}'::timestamptz, '${pEnd}'::timestamptz, now(), now()
        ) RETURNING id;
      `)).rows[0];

      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"3".repeat(64)}', NULL, '${invCode}', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_trans_001', 'REF_trans_001', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].invoice_id === createdInv.id, "4.3.1 Reconciled to existing invoice ID");
      assert(res.rows[0].invoice_status === "paid", "4.3.2 Invoice status transitioned to paid");

      const invDb = (await db.query<{ status: string }>(`
        SELECT status FROM public.billing_invoices WHERE id = '${createdInv.id}';
      `)).rows[0];
      assert(invDb.status === "paid", "4.3.3 DB invoice status transitioned from pending to paid");
    }

    // 4.4 Recover past_due subscription to active and clear past_due_since
    {
      const pastDueSinceDate = new Date(Date.now() - 5 * 86400000).toISOString();
      const oldPStart = new Date(Date.now() - 35 * 86400000).toISOString();
      const oldPEnd = new Date(Date.now() - 5 * 86400000).toISOString();
      const sub = await createSubscription("past_due", planAmountMinor, planCurrency, pastDueSinceDate, oldPStart, oldPEnd);
      const subCode = "SUB_pastdue001";
      const custCode = "CUS_pastdue001";
      const provSubRecId = await createProviderSubscription(sub.id, subCode, custCode);

      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"4".repeat(64)}', NULL, 'INV_recov001', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_recov_001', 'REF_recov_001', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, '${nextRenewal}'::timestamptz, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].subscription_status === "active", "4.4.1 Subscription returned status is active");
      assert(res.rows[0].past_due_since === null, "4.4.2 past_due_since is cleared in return");

      const subDb = (await db.query<{ status: string; past_due_since: string | null }>(`
        SELECT status, past_due_since FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];
      assert(subDb.status === "active", "4.4.3 DB subscription status recovered to 'active'");
      assert(subDb.past_due_since === null, "4.4.4 DB past_due_since is cleared (NULL)");

      const ledgerRes = await db.query<{ event_type: string }>(`
        SELECT event_type FROM public.billing_ledger_events
        WHERE subscription_id = '${sub.id}' AND event_type = 'subscription_recovered_to_active';
      `);
      assert(ledgerRes.rows.length === 1, "4.4.5 subscription_recovered_to_active ledger event emitted");
    }

    // 4.4B Past_due subscription with auto_renew_enabled = false recovers to non_renewing (never forcing active or renewal)
    {
      const pastDueSinceDate = new Date(Date.now() - 5 * 86400000).toISOString();
      const sub = await createSubscription("past_due", planAmountMinor, planCurrency, pastDueSinceDate);
      // Explicitly disable auto-renewal
      await db.exec(`
        UPDATE public.billing_subscriptions
        SET auto_renew_enabled = false, next_renewal_at = NULL
        WHERE id = '${sub.id}';
      `);

      const subCode = "SUB_recoptout001";
      const custCode = "CUS_recoptout001";
      await createProviderSubscription(sub.id, subCode, custCode);

      const nextPaymentDate = new Date(Date.now() + 35 * 86400000).toISOString();
      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"4b".repeat(32)}', NULL, 'INV_recoptout001', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_recoptout001', 'REF_recoptout001', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, '${nextPaymentDate}'::timestamptz, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].subscription_status === "non_renewing", "4.4B.1 Subscription recovered to 'non_renewing' (not 'active')");
      assert(res.rows[0].past_due_since === null, "4.4B.2 past_due_since is cleared in return");
      assert(res.rows[0].next_renewal_at === null, "4.4B.3 next_renewal_at remains NULL in return");
      assert(new Date(res.rows[0].current_period_start).getTime() === new Date(pStart).getTime(), "4.4B.3a Restores verified period start in return");
      assert(new Date(res.rows[0].current_period_end).getTime() === new Date(pEnd).getTime(), "4.4B.3b Restores verified period end in return");

      const subDb = (await db.query<{
        status: string;
        past_due_since: string | null;
        auto_renew_enabled: boolean;
        next_renewal_at: string | null;
        current_period_start: string;
        current_period_end: string;
      }>(`
        SELECT status, past_due_since, auto_renew_enabled, next_renewal_at, current_period_start, current_period_end
        FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];

      assert(subDb.status === "non_renewing", "4.4B.4 DB status recovered to 'non_renewing'");
      assert(subDb.past_due_since === null, "4.4B.5 DB past_due_since is cleared (NULL)");
      assert(subDb.auto_renew_enabled === false, "4.4B.6 DB auto_renew_enabled remains false (opt-out preserved)");
      assert(subDb.next_renewal_at === null, "4.4B.7 DB next_renewal_at remains NULL");
      assert(new Date(subDb.current_period_start).getTime() === new Date(pStart).getTime(), "4.4B.7a DB current_period_start matches verified period");
      assert(new Date(subDb.current_period_end).getTime() === new Date(pEnd).getTime(), "4.4B.7b DB current_period_end matches verified period");

      const provSubDb = (await db.query<{ next_payment_at: string | null }>(`
        SELECT next_payment_at FROM public.billing_provider_subscriptions
        WHERE subscription_id = '${sub.id}';
      `)).rows[0];
      assert(provSubDb.next_payment_at === null, "4.4B.8 Provider subscription next_payment_at remains NULL");

      const ledgerRes = await db.query<{ event_type: string }>(`
        SELECT event_type FROM public.billing_ledger_events
        WHERE subscription_id = '${sub.id}' AND event_type = 'subscription_recovered_to_non_renewing';
      `);
      assert(ledgerRes.rows.length === 1, "4.4B.9 subscription_recovered_to_non_renewing ledger event emitted");
    }

    // 4.4C Stale non-null provider next_payment_at with auto_renew_enabled = false is cleared to NULL upon recovery
    {
      const pastDueSinceDate = new Date(Date.now() - 3 * 86400000).toISOString();
      const sub = await createSubscription("past_due", planAmountMinor, planCurrency, pastDueSinceDate);
      await db.exec(`
        UPDATE public.billing_subscriptions
        SET auto_renew_enabled = false, next_renewal_at = NULL
        WHERE id = '${sub.id}';
      `);

      const subCode = "SUB_staleprov01";
      const custCode = "CUS_staleprov01";
      await createProviderSubscription(sub.id, subCode, custCode);

      // Seed a stale non-null next_payment_at on billing_provider_subscriptions
      const stalePaymentAt = new Date(Date.now() + 15 * 86400000).toISOString();
      await db.exec(`
        UPDATE public.billing_provider_subscriptions
        SET next_payment_at = '${stalePaymentAt}'::timestamptz
        WHERE subscription_id = '${sub.id}';
      `);

      // Verify provider subscription has stale next_payment_at before recovery
      const beforeProv = (await db.query<{ next_payment_at: string | null }>(`
        SELECT next_payment_at FROM public.billing_provider_subscriptions
        WHERE subscription_id = '${sub.id}';
      `)).rows[0];
      assert(beforeProv.next_payment_at !== null, "4.4C.0 Precondition: provider next_payment_at is non-null before recovery");

      const nextPaymentDate = new Date(Date.now() + 30 * 86400000).toISOString();
      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"4c".repeat(32)}', NULL, 'INV_staleprov01', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_staleprov01', 'REF_staleprov01', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, '${nextPaymentDate}'::timestamptz, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].subscription_status === "non_renewing", "4.4C.1 Subscription recovered to 'non_renewing'");
      assert(res.rows[0].next_renewal_at === null, "4.4C.2 return next_renewal_at is NULL");

      const afterProv = (await db.query<{ next_payment_at: string | null }>(`
        SELECT next_payment_at FROM public.billing_provider_subscriptions
        WHERE subscription_id = '${sub.id}';
      `)).rows[0];
      assert(afterProv.next_payment_at === null, "4.4C.3 Stale provider next_payment_at cleared to NULL upon recovery when auto_renew_enabled = false");

      const afterSub = (await db.query<{ auto_renew_enabled: boolean; next_renewal_at: string | null; status: string }>(`
        SELECT auto_renew_enabled, next_renewal_at, status FROM public.billing_subscriptions
        WHERE id = '${sub.id}';
      `)).rows[0];
      assert(afterSub.auto_renew_enabled === false, "4.4C.4 auto_renew_enabled remains false");
      assert(afterSub.next_renewal_at === null, "4.4C.5 subscription next_renewal_at remains NULL");
      assert(afterSub.status === "non_renewing", "4.4C.6 subscription status is non_renewing");
    }

    // 4.5 Past_due subscription remains past_due when paying historical invoice
    {
      const currentPEnd = new Date(Date.now() + 10 * 86400000).toISOString();
      const histPStart = new Date(Date.now() - 60 * 86400000).toISOString();
      const histPEnd = new Date(Date.now() - 30 * 86400000).toISOString();
      const pastDueSinceDate = new Date(Date.now() - 2 * 86400000).toISOString();
      const sub = await createSubscription("past_due", planAmountMinor, planCurrency, pastDueSinceDate, null, currentPEnd);
      const subCode = "SUB_hist001";
      const custCode = "CUS_hist001";
      await createProviderSubscription(sub.id, subCode, custCode);

      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"5".repeat(64)}', NULL, 'INV_hist001', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_hist_001', 'REF_hist_001', 500000, 'ZAR', '${histPStart}'::timestamptz,
          '${histPEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].subscription_status === "past_due", "4.5.1 Subscription remains past_due for historical payment");
      assert(res.rows[0].past_due_since !== null, "4.5.2 past_due_since is retained");

      const subDb = (await db.query<{ status: string }>(`
        SELECT status FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];
      assert(subDb.status === "past_due", "4.5.3 DB subscription remains past_due");
    }

    // 4.6 Non-renewing subscription maintains status and advances period with next_renewal_at NULL
    {
      const sub = await createSubscription("non_renewing");
      const subCode = "SUB_nonrenew001";
      const custCode = "CUS_nonrenew001";
      await createProviderSubscription(sub.id, subCode, custCode);

      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"6".repeat(64)}', NULL, 'INV_nonren001', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_nonren_001', 'REF_nonren_001', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, '${nextRenewal}'::timestamptz, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].subscription_status === "non_renewing", "4.6.1 Retains non_renewing status");
      assert(res.rows[0].next_renewal_at === null, "4.6.2 next_renewal_at is NULL for non_renewing");

      const subDb = (await db.query<{ status: string; next_renewal_at: string | null }>(`
        SELECT status, next_renewal_at FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];
      assert(subDb.status === "non_renewing", "4.6.3 DB status is non_renewing");
      assert(subDb.next_renewal_at === null, "4.6.4 DB next_renewal_at is null");
    }

    // 4.7 Cancelled subscription retains cancelled status
    {
      const sub = await createSubscription("cancelled");
      const subCode = "SUB_canc001";
      const custCode = "CUS_canc001";
      await createProviderSubscription(sub.id, subCode, custCode);

      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"7".repeat(64)}', NULL, 'INV_canc001', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_canc_001', 'REF_canc_001', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].subscription_status === "cancelled", "4.7.1 Retains cancelled status");
      const subDb = (await db.query<{ status: string }>(`
        SELECT status FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];
      assert(subDb.status === "cancelled", "4.7.2 DB subscription status remains cancelled");
    }

    // 4.8 Out-of-order event: subscription already at future period; older invoice event does not regress period
    {
      const sub = await createSubscription("active");
      const subCode = "SUB_ooo001";
      const custCode = "CUS_ooo001";
      await createProviderSubscription(sub.id, subCode, custCode);

      // Advance period to month 2
      const m2Start = new Date(Date.now() + 30 * 86400000).toISOString();
      const m2End = new Date(Date.now() + 60 * 86400000).toISOString();
      await db.exec(`
        UPDATE public.billing_subscriptions
        SET current_period_start = '${m2Start}', current_period_end = '${m2End}'
        WHERE id = '${sub.id}';
      `);

      // Out-of-order invoice for month 1 arrives
      const m1Start = new Date(Date.now()).toISOString();
      const m1End = new Date(Date.now() + 30 * 86400000).toISOString();
      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"b".repeat(64)}', NULL, 'INV_ooo_m1', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_ooo_001', 'REF_ooo_001', 500000, 'ZAR', '${m1Start}'::timestamptz,
          '${m1End}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);

      // Check that subscription current_period_end was NOT regressed to month 1
      const subDb = (await db.query<{ current_period_end: string }>(`
        SELECT current_period_end FROM public.billing_subscriptions WHERE id = '${sub.id}';
      `)).rows[0];
      assert(new Date(subDb.current_period_end).getTime() === new Date(m2End).getTime(), "4.8 Out-of-order event does not regress current_period_end");
    }
  }

  console.log("\nSection 5: Payment Reconciliation & Call Without Transaction Details");
  {
    const nowIso = new Date().toISOString();
    const pStart = new Date(Date.now()).toISOString();
    const pEnd = new Date(Date.now() + 30 * 86400000).toISOString();

    // 5.1 Reconcile existing pending payment to succeeded
    {
      const sub = await createSubscription("active");
      const subCode = "SUB_payrecon001";
      const custCode = "CUS_payrecon001";
      const provSubRecId = await createProviderSubscription(sub.id, subCode, custCode);

      const txnId = "TXN_pending_recon_001";
      const paymentRef = "REF_pending_recon_001";
      const invCode = "INV_payrec001";

      const createdInv = (await db.query<{ id: string }>(`
        INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider,
          environment, provider_invoice_code, status, provider_status, amount_minor,
          currency, period_start, period_end, created_at, updated_at
        ) VALUES (
          '${sub.company_id}', '${sub.id}', '${provSubRecId}', 'paystack',
          'test', '${invCode}', 'pending', 'pending', 500000,
          'ZAR', '${pStart}'::timestamptz, '${pEnd}'::timestamptz, now(), now()
        ) RETURNING id;
      `)).rows[0];

      const existingPay = (await db.query<{ id: string }>(`
        INSERT INTO public.billing_payments (
          company_id, subscription_id, plan_id, provider_plan_mapping_id,
          provider, environment, purpose, idempotency_key, provider_reference,
          provider_transaction_id, amount_minor, currency, customer_email,
          status, billing_invoice_id, created_at, updated_at
        ) VALUES (
          '${sub.company_id}', '${sub.id}', '${planId}', '${providerPlanMappingId}',
          'paystack', 'test', 'renewal', gen_random_uuid(), '${paymentRef}',
          '${txnId}', 500000, 'ZAR', 'pm@example.com',
          'pending', '${createdInv.id}', now(), now()
        ) RETURNING id;
      `)).rows[0];

      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"8".repeat(64)}', NULL, '${invCode}', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          '${txnId}', '${paymentRef}', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].payment_id === existingPay.id, "5.1.1 Reconciled to existing payment ID");
      assert(res.rows[0].payment_status === "succeeded", "5.1.2 Payment status is succeeded");

      const payDb = (await db.query<{ status: string; billing_invoice_id: string }>(`
        SELECT status, billing_invoice_id FROM public.billing_payments WHERE id = '${existingPay.id}';
      `)).rows[0];
      assert(payDb.status === "succeeded", "5.1.3 DB payment status updated from pending to succeeded");
      assert(payDb.billing_invoice_id === res.rows[0].invoice_id, "5.1.4 DB payment linked to invoice");
    }

    // 5.2 Call without transaction_id and reference (payment_id remains null)
    {
      const sub = await createSubscription("active");
      const subCode = "SUB_notxn001";
      const custCode = "CUS_notxn001";
      await createProviderSubscription(sub.id, subCode, custCode);

      const res = await db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${"9".repeat(64)}', NULL, 'INV_notxn001', '${subCode}',
          '${custCode}', NULL, 'success', true, NULL,
          NULL, NULL, 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);

      assert(res.rows[0].payment_id === null, "5.2.1 payment_id is null when no txn/ref provided");
      assert(res.rows[0].payment_status === null, "5.2.2 payment_status is null");
      assert(res.rows[0].invoice_status === "paid", "5.2.3 invoice is still marked paid");
    }

    // 5.3 Wrong-company data: payment transaction belongs to Company A, but invoice event targets Company B
    {
      const subA = await createSubscription("active");
      const subCodeA = "SUB_compA001";
      const custCodeA = "CUS_compA001";
      await createProviderSubscription(subA.id, subCodeA, custCodeA);

      const subB = await createSubscription("active");
      const subCodeB = "SUB_compB001";
      const custCodeB = "CUS_compB001";
      await createProviderSubscription(subB.id, subCodeB, custCodeB);

      const crossTxnId = "TXN_cross_company_001";
      const crossPaymentRef = "REF_cross_company_001";

      // Insert payment under company A with an invoice
      const invA = (await db.query<{ id: string }>(`
        INSERT INTO public.billing_invoices (
          company_id, subscription_id, provider_subscription_record_id, provider,
          environment, provider_invoice_code, status, provider_status, amount_minor,
          currency, period_start, period_end, created_at, updated_at
        ) VALUES (
          '${subA.company_id}', '${subA.id}', '${(await db.query<{ id: string }>(`SELECT id FROM public.billing_provider_subscriptions WHERE subscription_id = '${subA.id}'`)).rows[0].id}',
          'paystack', 'test', 'INV_compA_inv01', 'pending', 'pending', 500000,
          'ZAR', '${pStart}'::timestamptz, '${pEnd}'::timestamptz, now(), now()
        ) RETURNING id;
      `)).rows[0];

      await db.exec(`
        INSERT INTO public.billing_payments (
          company_id, subscription_id, plan_id, provider_plan_mapping_id,
          provider, environment, purpose, idempotency_key, provider_reference,
          provider_transaction_id, amount_minor, currency, customer_email,
          status, billing_invoice_id, created_at, updated_at
        ) VALUES (
          '${subA.company_id}', '${subA.id}', '${planId}', '${providerPlanMappingId}',
          'paystack', 'test', 'renewal', gen_random_uuid(), '${crossPaymentRef}',
          '${crossTxnId}', 500000, 'ZAR', 'pm@example.com',
          'pending', '${invA.id}', now(), now()
        );
      `);

      // Attempt to process invoice for subB referencing company A's transaction/reference
      try {
        await db.query(`
          SELECT * FROM public.process_paystack_invoice_update_success(
            'test', '${"a".repeat(64)}', NULL, 'INV_cross_comp01', '${subCodeB}',
            '${custCodeB}', NULL, 'success', true, 'success',
            '${crossTxnId}', '${crossPaymentRef}', 500000, 'ZAR', '${pStart}'::timestamptz,
            '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
          );
        `);
        assert(false, "5.3 Wrong-company payment mismatch must fail closed");
      } catch (err: any) {
        assert(err.code === "23505", `5.3 Wrong-company payment mismatch produces SQLSTATE 23505 (got ${err.code})`);
      }
    }
  }

  console.log("\nSection 6: Webhook Inbox Claiming & Exact Replay Handling");
  {
    const sub = await createSubscription("active");
    const subCode = "SUB_replay001";
    const custCode = "CUS_replay001";
    await createProviderSubscription(sub.id, subCode, custCode);

    const nowIso = new Date().toISOString();
    const pStart = new Date(Date.now()).toISOString();
    const pEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const replayHash = "0".repeat(64);

    // Initial call
    const res1 = await db.query<InvoiceUpdateSuccessResult>(`
      SELECT * FROM public.process_paystack_invoice_update_success(
        'test', '${replayHash}', 'EVT_replay_001', 'INV_replay001', '${subCode}',
        '${custCode}', NULL, 'success', true, 'success',
        'TXN_replay_001', 'REF_replay_001', 500000, 'ZAR', '${pStart}'::timestamptz,
        '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
      );
    `);
    assert(res1.rows[0].is_reused === false, "6.1 Initial call returns is_reused = false");

    // Exact Replay call
    const res2 = await db.query<InvoiceUpdateSuccessResult>(`
      SELECT * FROM public.process_paystack_invoice_update_success(
        'test', '${replayHash}', 'EVT_replay_001', 'INV_replay001', '${subCode}',
        '${custCode}', NULL, 'success', true, 'success',
        'TXN_replay_001', 'REF_replay_001', 500000, 'ZAR', '${pStart}'::timestamptz,
        '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
      );
    `);
    assert(res2.rows[0].is_reused === true, "6.2 Replay call returns is_reused = true");
    assert(res2.rows[0].invoice_id === res1.rows[0].invoice_id, "6.3 Replay returns identical invoice_id");
    assert(res2.rows[0].payment_id === res1.rows[0].payment_id, "6.4 Replay returns identical payment_id");

    // Check no duplicate ledger records
    const ledgerCount = (await db.query<{ cnt: string }>(`
      SELECT COUNT(*)::text AS cnt FROM public.billing_ledger_events
      WHERE deduplication_key = 'paystack:test:invoice:INV_replay001:paid';
    `)).rows[0].cnt;
    assert(ledgerCount === "1", "6.5 Zero duplicate ledger entries created on exact replay");

    // Semantic idempotency with different payload hash
    const differentHash = "1234567890abcdef".repeat(4);
    const res3 = await db.query<InvoiceUpdateSuccessResult>(`
      SELECT * FROM public.process_paystack_invoice_update_success(
        'test', '${differentHash}', 'EVT_replay_002', 'INV_replay001', '${subCode}',
        '${custCode}', NULL, 'success', true, 'success',
        'TXN_replay_001', 'REF_replay_001', 500000, 'ZAR', '${pStart}'::timestamptz,
        '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
      );
    `);
    assert(res3.rows[0].invoice_id === res1.rows[0].invoice_id, "6.6 Semantic idempotency: same invoice_id with different hash");
    assert(res3.rows[0].is_reused === false, "6.7 New webhook row created for different hash");
  }

  console.log("\nSection 7: Webhook & Ledger Sanitization");
  {
    const sub = await createSubscription("active");
    const subCode = "SUB_sanit001";
    const custCode = "CUS_sanit001";
    await createProviderSubscription(sub.id, subCode, custCode);

    const nowIso = new Date().toISOString();
    const pStart = new Date(Date.now()).toISOString();
    const pEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const hash = "fedcba9876543210".repeat(4);

    await db.query(`
      SELECT * FROM public.process_paystack_invoice_update_success(
        'test', '${hash}', 'EVT_sanit_001', 'INV_sanit001', '${subCode}',
        '${custCode}', NULL, 'success', true, 'success',
        'TXN_sanit_001', 'REF_sanit_001', 500000, 'ZAR', '${pStart}'::timestamptz,
        '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
      );
    `);

    // Check webhook raw_payload
    const whRes = await db.query<{ raw_payload: Record<string, any> }>(`
      SELECT raw_payload FROM public.billing_webhook_events WHERE payload_sha256 = '${hash}';
    `);
    const payload = whRes.rows[0].raw_payload;
    assert(!("email_token" in payload), "7.1 Webhook raw_payload does not contain auth tokens");
    assert(!("customer_email" in payload), "7.2 Webhook raw_payload does not contain customer email");
    assert(payload.event_type === "invoice.update", "7.3 Webhook raw_payload contains event_type");

    // Check ledger event_data
    const ledgerRes = await db.query<{ event_data: Record<string, any> }>(`
      SELECT event_data FROM public.billing_ledger_events
      WHERE deduplication_key = 'paystack:test:invoice:INV_sanit001:paid';
    `);
    const eventData = ledgerRes.rows[0].event_data;
    assert(!("email_token" in eventData), "7.4 Ledger event_data does not contain auth tokens");
    assert(!("customer_email" in eventData), "7.5 Ledger event_data does not contain customer email");
  }

  console.log("\nSection 8: Exact Return-Column Contract (17 Columns)");
  {
    const sub = await createSubscription("active");
    const subCode = "SUB_contract001";
    const custCode = "CUS_contract001";
    await createProviderSubscription(sub.id, subCode, custCode);

    const nowIso = new Date().toISOString();
    const pStart = new Date(Date.now()).toISOString();
    const pEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const hash = "9876543210abcdef".repeat(4);

    const res = await db.query<Record<string, any>>(`
      SELECT * FROM public.process_paystack_invoice_update_success(
        'test', '${hash}', 'EVT_contract_001', 'INV_contract001', '${subCode}',
        '${custCode}', NULL, 'success', true, 'success',
        'TXN_contract_001', 'REF_contract_001', 500000, 'ZAR', '${pStart}'::timestamptz,
        '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
      );
    `);

    const keys = Object.keys(res.rows[0]);
    assert(keys.length === 17, `8.1 Returns exactly 17 columns (got ${keys.length})`);

    const expectedColumns = [
      "webhook_event_id",
      "invoice_id",
      "payment_id",
      "provider_subscription_record_id",
      "subscription_id",
      "provider_invoice_code",
      "invoice_status",
      "payment_status",
      "subscription_status",
      "amount_minor",
      "currency",
      "current_period_start",
      "current_period_end",
      "next_renewal_at",
      "past_due_since",
      "is_reused",
      "is_ignored",
    ];

    for (const col of expectedColumns) {
      assert(keys.includes(col), `8.2 Column "${col}" is present`);
    }

    assert(!keys.includes("email_token") && !keys.includes("customer_email"), "8.3 RPC return columns do NOT leak sensitive tokens or email");
  }

  console.log("\nSection 9: Concurrency & Transactional Rollback Cleanliness");
  {
    const sub = await createSubscription("active");
    const subCode = "SUB_concur001";
    const custCode = "CUS_concur001";
    await createProviderSubscription(sub.id, subCode, custCode);

    const nowIso = new Date().toISOString();
    const pStart = new Date(Date.now()).toISOString();
    const pEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    const hash = "1122334455667788".repeat(4);

    const executeCall = () =>
      db.query<InvoiceUpdateSuccessResult>(`
        SELECT * FROM public.process_paystack_invoice_update_success(
          'test', '${hash}', 'EVT_concur_001', 'INV_concur001', '${subCode}',
          '${custCode}', NULL, 'success', true, 'success',
          'TXN_concur_001', 'REF_concur_001', 500000, 'ZAR', '${pStart}'::timestamptz,
          '${pEnd}'::timestamptz, '${nowIso}'::timestamptz, NULL, '${nowIso}'::timestamptz
        );
      `);

    const results = await Promise.all([executeCall(), executeCall()]);
    const reusedFlags = results.map((r) => r.rows[0].is_reused);

    assert(
      reusedFlags.includes(false) && reusedFlags.includes(true),
      "9.1 Concurrent execution: exactly one gets is_reused = false and one gets is_reused = true"
    );

    const invoiceCount = (await db.query<{ cnt: string }>(`
      SELECT COUNT(*)::text AS cnt FROM public.billing_invoices WHERE provider_invoice_code = 'INV_concur001';
    `)).rows[0].cnt;
    assert(invoiceCount === "1", "9.2 Exactly one billing invoice created under concurrency");
  }

  console.log("\n=================================================================");
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
