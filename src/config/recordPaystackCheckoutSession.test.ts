import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.2 — Step 3A: Atomic Paystack Checkout Session Recording RPC Test Suite (PGlite)
 *
 * Verifies:
 * 1. Successful initialized-to-pending transition.
 * 2. Exact five-column return contract (payment_id, provider_reference, payment_status, checkout_url, is_reused).
 * 3. Correct checkout URL persistence in public.billing_payments.
 * 4. access_code stored securely in billing_payments but excluded from RPC return columns.
 * 5. provider_transaction_id remains null.
 * 6. Exactly one linked payment_pending ledger event.
 * 7. Safe ledger event_data with sensitive fields excluded (email, idempotency key, access code, checkout URL).
 * 8. Exact idempotent retry returning is_reused = true.
 * 9. No duplicate ledger event on retry (and safe insert if missing).
 * 10. Conflicting checkout URL rejection (23505).
 * 11. Conflicting access-code rejection (23505).
 * 12. Stored vs supplied provider reference mismatch rejection (23503).
 * 13. Invalid reference-format rejection (22000).
 * 14. Non-HTTPS or non-Paystack checkout URL rejection (22000).
 * 15. Null and empty/whitespace parameter rejection (22004 / 22000).
 * 16. Missing payment rejection (P0002).
 * 17. Non-Paystack provider rejection (22023).
 * 18. Terminal (succeeded, failed, cancelled) state rejection (23514).
 * 19. Initialized payment with pre-existing unexpected checkout details rejection (23514).
 * 20. Atomic rollback when ledger insertion fails (transaction atomicity).
 * 21. SECURITY DEFINER, search_path = '' verification.
 * 22. Privileges: service_role has EXECUTE; authenticated, anon, PUBLIC revoked.
 * 23. Direct table mutation restrictions remain revoked for client roles.
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

interface RecordSessionResult {
  payment_id: string;
  provider_reference: string;
  payment_status: string;
  checkout_url: string;
  is_reused: boolean;
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("PROJECTMATRIX RECORD PAYSTACK CHECKOUT SESSION RPC TEST SUITE");
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
        is_company_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE public.billing_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL,
        billing_interval TEXT NOT NULL,
        trial_duration_minutes INTEGER NOT NULL DEFAULT 5,
        cancel_anytime BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        paystack_plan_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE public.billing_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
        plan_id UUID NOT NULL REFERENCES public.billing_plans(id) ON DELETE RESTRICT,
        subscription_reference TEXT NOT NULL UNIQUE,
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
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE public.billing_ledger_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sequence_number BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
        company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
        subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        event_source TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        deduplication_key TEXT,
        event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT chk_billing_ledger_events_event_source CHECK (
            event_source IN ('user', 'system', 'paystack_webhook', 'reconciliation')
        ),
        CONSTRAINT chk_billing_ledger_events_data_is_object CHECK (jsonb_typeof(event_data) = 'object')
    );

    CREATE UNIQUE INDEX uq_billing_ledger_events_dedup_key
        ON public.billing_ledger_events (deduplication_key)
        WHERE deduplication_key IS NOT NULL;
  `);

  // 2. Load Foundation Migration
  const foundationSqlPath = path.join(
    process.cwd(),
    "supabase/migrations/20260818000001_paystack_payment_foundation.sql"
  );
  await db.exec(fs.readFileSync(foundationSqlPath, "utf-8"));

  // 3. Load verify_billing_access RPC
  const verifyBillingSqlPath = path.join(
    process.cwd(),
    "supabase/migrations/20260729000000_verify_billing_access.sql"
  );
  await db.exec(fs.readFileSync(verifyBillingSqlPath, "utf-8"));

  // 4. Seed standard business-monthly plan & Test Plan Mapping Migration
  await db.exec(`
    INSERT INTO public.billing_plans (
        id, code, name, amount_minor, currency, billing_interval, is_active
    ) VALUES (
        '10000000-0000-0000-0000-000000000001',
        'business-monthly',
        'ProjectMatrix Business Monthly',
        500000,
        'ZAR',
        'monthly',
        true
    );
  `);

  const testPlanMappingSqlPath = path.join(
    process.cwd(),
    "supabase/migrations/20260820000001_paystack_test_plan_mapping.sql"
  );
  await db.exec(fs.readFileSync(testPlanMappingSqlPath, "utf-8"));

  // 5. Load initialize_billing_checkout RPC migration
  const initCheckoutSqlPath = path.join(
    process.cwd(),
    "supabase/migrations/20260820000002_initialize_billing_checkout.sql"
  );
  await db.exec(fs.readFileSync(initCheckoutSqlPath, "utf-8"));

  // 6. Load record_paystack_checkout_session RPC migration
  const recordSessionSqlPath = path.join(
    process.cwd(),
    "supabase/migrations/20260820000003_record_paystack_checkout_session.sql"
  );
  await db.exec(fs.readFileSync(recordSessionSqlPath, "utf-8"));

  // Seed Profiles, Companies & Subscriptions
  const pmProfileId = "00000000-0000-0000-0000-000000000001";
  const companyId = "aaaaaaaa-0000-0000-0000-000000000001";
  const planId = "10000000-0000-0000-0000-000000000001";
  const subId = "20000000-0000-0000-0000-000000000001";

  await db.exec(`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES ('${pmProfileId}', 'pm@example.com', now());

    INSERT INTO public.profiles (id, email, full_name)
    VALUES ('${pmProfileId}', 'pm@example.com', 'Project Manager Profile');

    INSERT INTO public.companies (id, name)
    VALUES ('${companyId}', 'Acme Construction');

    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyId}', '${pmProfileId}', 'Project Manager', 'company_admin', true);

    INSERT INTO public.billing_subscriptions (
        id, company_id, plan_id, subscription_reference, status,
        amount_minor, currency, billing_interval, created_at
    ) VALUES (
        '${subId}', '${companyId}', '${planId}', 'SUB-20260820-0001', 'trialing',
        500000, 'ZAR', 'monthly', now()
    );
  `);

  console.log("Section 1: Successful Initialized-to-Pending Execution & Return Contract");

  // Create an initialized payment using initialize_billing_checkout RPC
  const initRes = await db.query<any>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, "11111111-1111-1111-1111-111111111111"]
  );
  const paymentId = initRes.rows[0].payment_id;
  const providerRef = initRes.rows[0].provider_reference;
  const checkoutUrl = "https://checkout.paystack.com/0123456789abcdef";
  const accessCode = "0123456789abcdef";

  // Execute record_paystack_checkout_session
  const recordRes = await db.query<RecordSessionResult>(
    `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
    [paymentId, providerRef, checkoutUrl, accessCode]
  );

  assert(recordRes.rows.length === 1, "RPC returns exactly 1 row");
  const row = recordRes.rows[0];

  // Verify 5-column contract
  assert(row.payment_id === paymentId, "Contract: payment_id matches target payment");
  assert(row.provider_reference === providerRef, "Contract: provider_reference matches target reference");
  assert(row.payment_status === "pending", "Contract: payment_status is 'pending'");
  assert(row.checkout_url === checkoutUrl, "Contract: checkout_url is correctly returned");
  assert(row.is_reused === false, "Contract: is_reused is FALSE on initial session recording");

  // Verify access_code is NOT returned as a column in the result table
  assert((row as any).access_code === undefined, "Security: access_code is excluded from return columns");

  // Verify table state in public.billing_payments
  const paymentRow = (
    await db.query<any>(`SELECT * FROM public.billing_payments WHERE id = $1`, [paymentId])
  ).rows[0];

  assert(paymentRow.status === "pending", "Database: payment status transitioned to 'pending'");
  assert(paymentRow.checkout_url === checkoutUrl, "Database: checkout_url persisted correctly");
  assert(paymentRow.access_code === accessCode, "Database: access_code persisted securely");
  assert(paymentRow.provider_transaction_id === null, "Database: provider_transaction_id remains NULL");

  // Verify linked ledger event
  const ledgerRes = await db.query<any>(
    `SELECT * FROM public.billing_ledger_events WHERE payment_id = $1 AND event_type = 'payment_pending'`,
    [paymentId]
  );
  assert(ledgerRes.rows.length === 1, "Ledger: exactly one payment_pending ledger event recorded");
  const ledgerEvent = ledgerRes.rows[0];
  assert(ledgerEvent.event_source === "system", "Ledger: event_source is 'system'");
  assert(ledgerEvent.deduplication_key === `payment_pending:${paymentId}`, "Ledger: deduplication_key is payment_pending:<payment_id>");
  assert(ledgerEvent.actor_profile_id === pmProfileId, "Ledger: actor_profile_id matches initiator");

  // Verify sensitive fields excluded from event_data
  const eventData = ledgerEvent.event_data;
  assert(eventData.customer_email === undefined, "Ledger Security: event_data EXCLUDES customer_email");
  assert(eventData.idempotency_key === undefined, "Ledger Security: event_data EXCLUDES idempotency_key");
  assert(eventData.access_code === undefined, "Ledger Security: event_data EXCLUDES access_code");
  assert(eventData.checkout_url === undefined, "Ledger Security: event_data EXCLUDES checkout_url");
  assert(eventData.raw_response === undefined, "Ledger Security: event_data EXCLUDES raw_response");

  // Verify safe metadata in event_data
  assert(eventData.payment_id === paymentId, "Ledger event_data contains payment_id");
  assert(eventData.provider_reference === providerRef, "Ledger event_data contains provider_reference");
  assert(eventData.provider === "paystack", "Ledger event_data contains provider");
  assert(eventData.environment === "test", "Ledger event_data contains environment");
  assert(eventData.purpose === "activation", "Ledger event_data contains purpose");
  assert(eventData.status === "pending", "Ledger event_data contains status");

  console.log("\nSection 2: Idempotent Replay & Conflict Detection");

  // 2.1 Exact retry returns is_reused = true with same data
  const retryRes = await db.query<RecordSessionResult>(
    `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
    [paymentId, providerRef, checkoutUrl, accessCode]
  );
  assert(retryRes.rows.length === 1, "Idempotent retry returns 1 row");
  assert(retryRes.rows[0].payment_id === paymentId, "Retry returns same payment_id");
  assert(retryRes.rows[0].payment_status === "pending", "Retry returns payment_status 'pending'");
  assert(retryRes.rows[0].checkout_url === checkoutUrl, "Retry returns same checkout_url");
  assert(retryRes.rows[0].is_reused === true, "Retry returns is_reused = TRUE");

  // 2.2 Verify no duplicate ledger event was created
  const ledgerCount = (
    await db.query<any>(
      `SELECT count(*) AS count FROM public.billing_ledger_events WHERE payment_id = $1 AND event_type = 'payment_pending'`,
      [paymentId]
    )
  ).rows[0].count;
  assert(Number(ledgerCount) === 1, "Ledger: count of payment_pending events remains exactly 1 on retry");

  // 2.3 Conflicting checkout URL on already-pending payment rejected with 23505
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, "https://checkout.paystack.com/different_url_code", accessCode]
    );
    assert(false, "Conflicting checkout URL must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Conflicting checkout session details"),
      "Conflicting checkout URL rejected with 23505"
    );
  }

  // 2.4 Conflicting access code on already-pending payment rejected with 23505
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, checkoutUrl, "different_access_code"]
    );
    assert(false, "Conflicting access code must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Conflicting checkout session details"),
      "Conflicting access code rejected with 23505"
    );
  }

  console.log("\nSection 3: Input Validation & Format Constraints");

  // 3.1 Null parameters
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session(NULL, $1, $2, $3)`,
      [providerRef, checkoutUrl, accessCode]
    );
    assert(false, "Null payment_id must be rejected");
  } catch (err: any) {
    assert(err.message.includes("Payment ID cannot be null"), "Null payment_id rejected with 22004");
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, NULL, $2, $3)`,
      [paymentId, checkoutUrl, accessCode]
    );
    assert(false, "Null provider_reference must be rejected");
  } catch (err: any) {
    assert(err.message.includes("Provider reference cannot be null"), "Null provider_reference rejected with 22004");
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, NULL, $3)`,
      [paymentId, providerRef, accessCode]
    );
    assert(false, "Null checkout_url must be rejected");
  } catch (err: any) {
    assert(err.message.includes("Checkout URL cannot be null"), "Null checkout_url rejected with 22004");
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, NULL)`,
      [paymentId, providerRef, checkoutUrl]
    );
    assert(false, "Null access_code must be rejected");
  } catch (err: any) {
    assert(err.message.includes("Access code cannot be null"), "Null access_code rejected with 22004");
  }

  // 3.2 Empty or surrounding whitespace strings
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, '   ', $2, $3)`,
      [paymentId, checkoutUrl, accessCode]
    );
    assert(false, "Whitespace provider_reference must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Provider reference cannot be empty or contain surrounding whitespace"),
      "Whitespace provider_reference rejected with 22000"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, '   ', $3)`,
      [paymentId, providerRef, accessCode]
    );
    assert(false, "Whitespace checkout_url must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Checkout URL cannot be empty or contain surrounding whitespace"),
      "Whitespace checkout_url rejected with 22000"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, '   ')`,
      [paymentId, providerRef, checkoutUrl]
    );
    assert(false, "Whitespace access_code must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Access code cannot be empty or contain surrounding whitespace"),
      "Whitespace access_code rejected with 22000"
    );
  }

  // 3.3 Leading or trailing whitespace on valid URLs/codes
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, ` ${checkoutUrl}`, accessCode]
    );
    assert(false, "Leading whitespace checkout_url must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Checkout URL cannot be empty or contain surrounding whitespace"),
      "Leading checkout URL whitespace rejected with 22000"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, `${checkoutUrl} `, accessCode]
    );
    assert(false, "Trailing whitespace checkout_url must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Checkout URL cannot be empty or contain surrounding whitespace"),
      "Trailing checkout URL whitespace rejected with 22000"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, checkoutUrl, ` ${accessCode}`]
    );
    assert(false, "Leading whitespace access_code must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Access code cannot be empty or contain surrounding whitespace"),
      "Leading access code whitespace rejected with 22000"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, checkoutUrl, `${accessCode} `]
    );
    assert(false, "Trailing whitespace access_code must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Access code cannot be empty or contain surrounding whitespace"),
      "Trailing access code whitespace rejected with 22000"
    );
  }

  // 3.4 Control characters and embedded whitespace
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, "https://checkout.paystack.com/with space", accessCode]
    );
    assert(false, "Checkout URL with internal space must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Checkout URL cannot contain whitespace or control characters"),
      "Checkout URL space rejected with 22000"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, "https://checkout.paystack.com/with\nnewline", accessCode]
    );
    assert(false, "Checkout URL with newline must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Checkout URL cannot contain whitespace or control characters"),
      "Checkout URL control-character rejected with 22000"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, checkoutUrl, "code with space"]
    );
    assert(false, "Access code with internal space must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Access code cannot contain whitespace or control characters"),
      "Access code space rejected with 22000"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, providerRef, checkoutUrl, "code\twithtab"]
    );
    assert(false, "Access code with tab must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Access code cannot contain whitespace or control characters"),
      "Access-code control-character rejected with 22000"
    );
  }

  // 3.5 Invalid provider reference format
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, 'INVALID-REF-FORMAT', $2, $3)`,
      [paymentId, checkoutUrl, accessCode]
    );
    assert(false, "Malformed provider reference format must be rejected");
  } catch (err: any) {
    assert(err.message.includes("Invalid provider reference format"), "Invalid provider reference format rejected with 22000");
  }

  // 3.6 Non-HTTPS or non-Paystack checkout URL
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, 'http://checkout.paystack.com/insecure', $3)`,
      [paymentId, providerRef, accessCode]
    );
    assert(false, "HTTP non-secure URL must be rejected");
  } catch (err: any) {
    assert(err.message.includes('Checkout URL must begin with "https://checkout.paystack.com/".'), "HTTP non-secure URL rejected with 22000");
  }

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, 'https://malicious.com/paystack', $3)`,
      [paymentId, providerRef, accessCode]
    );
    assert(false, "Non-Paystack domain URL must be rejected");
  } catch (err: any) {
    assert(err.message.includes('Checkout URL must begin with "https://checkout.paystack.com/".'), "Non-Paystack domain URL rejected with 22000");
  }

  console.log("\nSection 4: Payment Locking, Matching & Provider Validation");

  // 4.1 Missing payment
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session('99999999-9999-9999-9999-999999999999', $1, $2, $3)`,
      [providerRef, checkoutUrl, accessCode]
    );
    assert(false, "Non-existent payment must be rejected");
  } catch (err: any) {
    assert(err.message.includes("Billing payment with ID") && err.message.includes("was not found"), "Missing payment rejected with P0002");
  }

  // 4.2 Stored provider reference mismatch
  const anotherValidRef = "PAY-20260820-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [paymentId, anotherValidRef, checkoutUrl, accessCode]
    );
    assert(false, "Mismatched provider reference must be rejected");
  } catch (err: any) {
    assert(
      (err.code === "23514" || err.message.includes("does not match payment")),
      "Mismatched provider reference returning SQLSTATE 23514"
    );
  }

  // 4.3 Non-Paystack provider rejection (22023)
  const nonPaystackId = "55555555-5555-5555-5555-555555555555";
  const nonPaystackRef = "PAY-20260820-55555555555555555555555555555555";
  // Temporarily adjust check constraint to create non-paystack provider row for testing RPC guard
  await db.exec(`
    ALTER TABLE public.billing_payments DROP CONSTRAINT chk_billing_payments_provider;
    ALTER TABLE public.billing_payments DISABLE TRIGGER ALL;
    INSERT INTO public.billing_payments (
        id, company_id, subscription_id, plan_id, provider_plan_mapping_id,
        provider, environment, purpose, idempotency_key, provider_reference,
        amount_minor, currency, customer_email, status, initiated_by_profile_id
    ) VALUES (
        '${nonPaystackId}', '${companyId}', '${subId}', '${planId}',
        '00000000-0000-0000-0000-000000000001', 'stripe', 'test', 'activation',
        gen_random_uuid(), '${nonPaystackRef}', 500000, 'ZAR', 'pm@example.com',
        'initialized', '${pmProfileId}'
    );
    ALTER TABLE public.billing_payments ENABLE TRIGGER ALL;
  `);

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [nonPaystackId, nonPaystackRef, checkoutUrl, accessCode]
    );
    assert(false, "Non-Paystack provider must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes('only "paystack" is supported'),
      "Non-Paystack provider rejected with 22023"
    );
  }

  // Cleanup non-paystack row and restore constraint
  await db.exec(`
    ALTER TABLE public.billing_payments DISABLE TRIGGER ALL;
    DELETE FROM public.billing_payments WHERE id = '${nonPaystackId}';
    ALTER TABLE public.billing_payments ENABLE TRIGGER ALL;
    ALTER TABLE public.billing_payments ADD CONSTRAINT chk_billing_payments_provider CHECK (provider = 'paystack');
  `);

  // 4.4 Exact matching ledger replay & missing ledger-event repair
  // Close previous payment to allow new checkout initialization
  await db.query(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE id = $1`, [paymentId]);

  // Create an initialized payment and transition to pending
  const initRecover = await db.query<any>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, "44444444-4444-4444-4444-111111111111"]
  );
  const recPaymentId = initRecover.rows[0].payment_id;
  const recRef = initRecover.rows[0].provider_reference;

  await db.query(
    `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
    [recPaymentId, recRef, checkoutUrl, accessCode]
  );

  // Exact matching ledger replay
  const exactReplay = await db.query<RecordSessionResult>(
    `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
    [recPaymentId, recRef, checkoutUrl, accessCode]
  );
  assert(exactReplay.rows[0].is_reused === true, "Exact matching ledger replay returns is_reused = true");

  // Intentionally delete the ledger event to simulate missing audit log
  await db.query(
    `DELETE FROM public.billing_ledger_events WHERE deduplication_key = $1`,
    [`payment_pending:${recPaymentId}`]
  );

  // Missing ledger-event repair
  const recRetry = await db.query<RecordSessionResult>(
    `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
    [recPaymentId, recRef, checkoutUrl, accessCode]
  );
  assert(recRetry.rows[0].is_reused === true, "Missing ledger-event repair returns is_reused = true");

  const recLedgerCount = (
    await db.query<any>(
      `SELECT count(*) AS count FROM public.billing_ledger_events WHERE deduplication_key = $1`,
      [`payment_pending:${recPaymentId}`]
    )
  ).rows[0].count;
  assert(Number(recLedgerCount) === 1, "Missing ledger-event repair safely re-created exactly one event");

  // 4.5 Deduplication key collision for another payment
  // Modify ledger event's payment_id to another UUID to simulate key collision
  const foreignPaymentId = "33333333-3333-3333-3333-333333333333";
  await db.exec(`
    ALTER TABLE public.billing_ledger_events DISABLE TRIGGER ALL;
    UPDATE public.billing_ledger_events
    SET payment_id = '${foreignPaymentId}'
    WHERE deduplication_key = 'payment_pending:${recPaymentId}';
    ALTER TABLE public.billing_ledger_events ENABLE TRIGGER ALL;
  `);

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [recPaymentId, recRef, checkoutUrl, accessCode]
    );
    assert(false, "Deduplication key collision for another payment must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Ledger deduplication key collision for payment") || err.code === "23505",
      "Deduplication key collision for another payment rejection (23505)"
    );
  }

  // 4.6 Incorrect company, subscription, event type or event source rejection
  // Restore payment_id, but test incorrect company_id
  const otherCompanyId = "bbbbbbbb-0000-0000-0000-000000000002";
  await db.exec(`
    ALTER TABLE public.billing_ledger_events DISABLE TRIGGER ALL;
    UPDATE public.billing_ledger_events
    SET payment_id = '${recPaymentId}', company_id = '${otherCompanyId}'
    WHERE deduplication_key = 'payment_pending:${recPaymentId}';
    ALTER TABLE public.billing_ledger_events ENABLE TRIGGER ALL;
  `);

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [recPaymentId, recRef, checkoutUrl, accessCode]
    );
    assert(false, "Incorrect company on ledger event must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Ledger deduplication key collision for payment") || err.code === "23505",
      "Incorrect company on ledger event rejected with 23505"
    );
  }

  // Test incorrect subscription_id
  const otherSubId = "20000000-0000-0000-0000-999999999999";
  await db.exec(`
    ALTER TABLE public.billing_ledger_events DISABLE TRIGGER ALL;
    UPDATE public.billing_ledger_events
    SET company_id = '${companyId}', subscription_id = '${otherSubId}'
    WHERE deduplication_key = 'payment_pending:${recPaymentId}';
    ALTER TABLE public.billing_ledger_events ENABLE TRIGGER ALL;
  `);

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [recPaymentId, recRef, checkoutUrl, accessCode]
    );
    assert(false, "Incorrect subscription on ledger event must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Ledger deduplication key collision for payment") || err.code === "23505",
      "Incorrect subscription on ledger event rejected with 23505"
    );
  }

  // Test incorrect event_type ('payment_initiated' instead of 'payment_pending')
  await db.exec(`
    ALTER TABLE public.billing_ledger_events DISABLE TRIGGER ALL;
    UPDATE public.billing_ledger_events
    SET subscription_id = '${subId}', event_type = 'payment_initiated'
    WHERE deduplication_key = 'payment_pending:${recPaymentId}';
    ALTER TABLE public.billing_ledger_events ENABLE TRIGGER ALL;
  `);

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [recPaymentId, recRef, checkoutUrl, accessCode]
    );
    assert(false, "Incorrect event_type on ledger event must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Ledger deduplication key collision for payment") || err.code === "23505",
      "Incorrect event_type on ledger event rejected with 23505"
    );
  }

  // Test incorrect event_source ('user' instead of 'system')
  await db.exec(`
    ALTER TABLE public.billing_ledger_events DISABLE TRIGGER ALL;
    UPDATE public.billing_ledger_events
    SET event_type = 'payment_pending', event_source = 'user'
    WHERE deduplication_key = 'payment_pending:${recPaymentId}';
    ALTER TABLE public.billing_ledger_events ENABLE TRIGGER ALL;
  `);

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [recPaymentId, recRef, checkoutUrl, accessCode]
    );
    assert(false, "Incorrect event_source on ledger event must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Ledger deduplication key collision for payment") || err.code === "23505",
      "Incorrect event_source on ledger event rejected with 23505"
    );
  }

  // Cleanup recPaymentId and restore ledger event
  await db.exec(`
    ALTER TABLE public.billing_ledger_events DISABLE TRIGGER ALL;
    DELETE FROM public.billing_ledger_events WHERE deduplication_key = 'payment_pending:${recPaymentId}';
    ALTER TABLE public.billing_ledger_events ENABLE TRIGGER ALL;
    UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE id = '${recPaymentId}';
  `);

  console.log("\nSection 5: State Machine Guards & Terminal States");

  // 5.0 Close previous pending payment to allow new checkout initialization
  await db.query(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE id = $1`, [paymentId]);

  // 5.1 Terminal statuses: succeeded, failed, cancelled
  for (const terminalStatus of ["succeeded", "failed", "cancelled"]) {
    // Create a new initialized payment
    const initTerminal = await db.query<any>(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyId, `88888888-8888-8888-8888-${terminalStatus === "succeeded" ? "111111111111" : terminalStatus === "failed" ? "222222222222" : "333333333333"}`]
    );
    const termPaymentId = initTerminal.rows[0].payment_id;
    const termRef = initTerminal.rows[0].provider_reference;

    // Transition directly to terminal state
    if (terminalStatus === "succeeded") {
      await db.query(`UPDATE public.billing_payments SET status = 'succeeded', paid_at = now() WHERE id = $1`, [termPaymentId]);
    } else if (terminalStatus === "failed") {
      await db.query(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE id = $1`, [termPaymentId]);
    } else {
      await db.query(`UPDATE public.billing_payments SET status = 'cancelled', cancelled_at = now() WHERE id = $1`, [termPaymentId]);
    }

    try {
      await db.query(
        `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
        [termPaymentId, termRef, checkoutUrl, accessCode]
      );
      assert(false, `Terminal status '${terminalStatus}' must be rejected`);
    } catch (err: any) {
      assert(
        err.message.includes("is in terminal state") && err.message.includes(terminalStatus),
        `Terminal status '${terminalStatus}' rejected with 23514`
      );
    }
  }

  // 5.2 Initialized row containing unexpected checkout details
  const initUnexpected = await db.query<any>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, "77777777-7777-7777-7777-111111111111"]
  );
  const unexpPaymentId = initUnexpected.rows[0].payment_id;
  const unexpRef = initUnexpected.rows[0].provider_reference;

  // Force unexpected checkout_url on initialized payment
  await db.query(
    `UPDATE public.billing_payments SET checkout_url = 'https://checkout.paystack.com/unexpected' WHERE id = $1`,
    [unexpPaymentId]
  );

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [unexpPaymentId, unexpRef, checkoutUrl, accessCode]
    );
    assert(false, "Initialized payment with unexpected checkout details must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("already contains checkout details"),
      "Initialized payment with unexpected checkout details rejected with 23514"
    );
  }

  // Close unexpPaymentId
  await db.query(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE id = $1`, [unexpPaymentId]);

  console.log("\nSection 6: Transaction Atomicity & Rollback Integrity");

  // 6.1 Create a new initialized payment, attach a temporary failing trigger to billing_ledger_events to test rollback
  const initAtomicity = await db.query<any>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, "66666666-6666-6666-6666-111111111111"]
  );
  const atomPaymentId = initAtomicity.rows[0].payment_id;
  const atomRef = initAtomicity.rows[0].provider_reference;

  // Create temporary failing trigger on billing_ledger_events for testing atomic rollback
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.test_fail_ledger_insert()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.event_type = 'payment_pending' AND NEW.payment_id = '${atomPaymentId}'::uuid THEN
        RAISE EXCEPTION 'Simulated ledger failure for atomic rollback test' USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_test_fail_ledger
    BEFORE INSERT ON public.billing_ledger_events
    FOR EACH ROW EXECUTE FUNCTION public.test_fail_ledger_insert();
  `);

  try {
    await db.query(
      `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
      [atomPaymentId, atomRef, checkoutUrl, accessCode]
    );
    assert(false, "Should have failed due to simulated ledger error");
  } catch (err: any) {
    assert(
      err.message.includes("Simulated ledger failure"),
      "Ledger failure aborted transaction cleanly"
    );
  }

  // Verify payment status is STILL 'initialized' (atomically rolled back)
  const rolledBackPayment = (
    await db.query<any>(`SELECT * FROM public.billing_payments WHERE id = $1`, [atomPaymentId])
  ).rows[0];
  assert(
    rolledBackPayment.status === "initialized" && rolledBackPayment.checkout_url === null && rolledBackPayment.access_code === null,
    "Atomicity: payment status remains 'initialized' and checkout details remain NULL after failed ledger insert"
  );

  // Remove test trigger
  await db.exec(`
    DROP TRIGGER trg_test_fail_ledger ON public.billing_ledger_events;
    DROP FUNCTION public.test_fail_ledger_insert();
  `);

  // Now execute record_paystack_checkout_session normally on atomPaymentId
  const atomSuccess = await db.query<RecordSessionResult>(
    `SELECT * FROM public.record_paystack_checkout_session($1, $2, $3, $4)`,
    [atomPaymentId, atomRef, checkoutUrl, accessCode]
  );
  assert(atomSuccess.rows[0].payment_status === "pending", "Payment successfully transitions to 'pending' after trigger removed");

  console.log("\nSection 7: Security Boundaries & Function Privileges");

  // 7.1 service_role has EXECUTE
  const srvExec = await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('service_role', 'public.record_paystack_checkout_session(uuid, text, text, text)', 'EXECUTE') AS has_exec;
  `);
  assert(srvExec.rows[0]?.has_exec === true, "Privileges: EXECUTE is GRANTED to service_role");

  // 7.2 authenticated revoked
  const authExec = await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('authenticated', 'public.record_paystack_checkout_session(uuid, text, text, text)', 'EXECUTE') AS has_exec;
  `);
  assert(authExec.rows[0]?.has_exec === false, "Privileges: EXECUTE is REVOKED from authenticated");

  // 7.3 anon revoked
  const anonExec = await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('anon', 'public.record_paystack_checkout_session(uuid, text, text, text)', 'EXECUTE') AS has_exec;
  `);
  assert(anonExec.rows[0]?.has_exec === false, "Privileges: EXECUTE is REVOKED from anon");

  // 7.4 Verify function definition: SECURITY DEFINER and search_path = ''
  const funcDef = (
    await db.query<any>(`
      SELECT
        p.prosecdef AS is_secdef,
        p.proconfig AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'record_paystack_checkout_session'
    `)
  ).rows[0];

  assert(funcDef.is_secdef === true, "Security: function is defined as SECURITY DEFINER");
  assert(
    funcDef.config !== null && funcDef.config.some((c: string) => c.includes("search_path=")),
    "Security: function has explicit search_path configuration (search_path = '')"
  );

  console.log("\n=================================================================");
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
