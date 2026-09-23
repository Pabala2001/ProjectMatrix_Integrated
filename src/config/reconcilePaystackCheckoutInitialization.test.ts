import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * ProjectMatrix Billing Engine - Prompt 7A Hardened Checkout Reconciliation Test Suite (PGlite)
 *
 * Verifies:
 * 1. Execution grants: REVOKE from authenticated, anon, PUBLIC; EXCLUSIVELY granted to service_role.
 * 2. Unauthenticated and authenticated browser callers cannot execute reconciliation RPC.
 * 3. Strict parameter validation: payment_id NOT NULL, provider_reference format, target_status in ('failed', 'cancelled').
 * 4. Provider lookup miss error codes are strictly rejected from transitioning to terminal.
 * 5. Row ownership and provider validation (only paystack provider, exact reference match).
 * 6. Concurrency and Row-locking: two sequential/concurrent terminal calls produce 1 ledger event and return is_reused=true.
 * 7. Race condition with charge success: if payment succeeded, reconcile returns existing state without overwriting.
 * 8. Reconciled payments unblock future checkouts (trialing subscription with failed payment can re-initialize).
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

async function runTests() {
  console.log("\n=======================================================");
  console.log("PROJECTMATRIX CHECKOUT RECONCILIATION HARDENING TEST SUITE (PGLITE)");
  console.log("=======================================================\n");

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
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT json_build_object(
        'sub', current_setting('request.jwt.claim.sub', true),
        'email', current_setting('request.jwt.claim.email', true)
      )::jsonb
    $$;

    CREATE TABLE public.companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        access_mode TEXT NOT NULL DEFAULT 'read_write'
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
        event_data JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE UNIQUE INDEX uq_billing_ledger_events_dedup_key
        ON public.billing_ledger_events (deduplication_key)
        WHERE deduplication_key IS NOT NULL;
  `);

  // 2. Load Foundation Migration
  const foundationSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260818000001_paystack_payment_foundation.sql"),
    "utf-8"
  );
  await db.exec(foundationSql);

  // 3. Load verify_billing_access RPC
  const verifyBillingSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260729000000_verify_billing_access.sql"),
    "utf-8"
  );
  await db.exec(verifyBillingSql);

  // 4. Seed standard plan & test plan mapping
  const planId = "10000000-0000-0000-0000-000000000001";
  await db.exec(`
    INSERT INTO public.billing_plans (
        id, code, name, amount_minor, currency, billing_interval, is_active
    ) VALUES (
        '${planId}',
        'business-monthly',
        'ProjectMatrix Business Monthly',
        500000,
        'ZAR',
        'monthly',
        true
    );
  `);

  const testPlanMappingSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260820000001_paystack_test_plan_mapping.sql"),
    "utf-8"
  );
  await db.exec(testPlanMappingSql);

  // 5. Load initialize_billing_checkout RPC
  const initCheckoutSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260820000002_initialize_billing_checkout.sql"),
    "utf-8"
  );
  await db.exec(initCheckoutSql);

  // 6. Apply reconciliation migrations in order (01 then 02)
  const migration01Sql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260830000001_reconcile_paystack_checkout_initialization.sql"),
    "utf-8"
  );
  await db.exec(migration01Sql);

  const hardeningMigrationSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260830000002_harden_paystack_checkout_reconciliation.sql"),
    "utf-8"
  );
  await db.exec(hardeningMigrationSql);

  // Helper to switch session auth
  const setAuth = async (uid: string | null, email: string | null, confirmed = true) => {
    if (!uid) {
      await db.exec(`
        SET request.jwt.claim.sub = '';
        SET request.jwt.claim.email = '';
      `);
    } else {
      await db.exec(`
        SET request.jwt.claim.sub = '${uid}';
        SET request.jwt.claim.email = '${email || ""}';
      `);
      await db.exec(`
        INSERT INTO auth.users (id, email, email_confirmed_at)
        VALUES ('${uid}', ${email ? `'${email}'` : "NULL"}, ${confirmed && email ? "now()" : "NULL"})
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          email_confirmed_at = EXCLUDED.email_confirmed_at;
      `);
    }
  };

  // Seed company and PM user
  const companyId = "20000000-0000-0000-0000-000000000001";
  const pmProfileId = "00000000-0000-0000-0000-000000000001";
  const subId = "30000000-0000-0000-0000-000000000001";

  await db.exec(`
    INSERT INTO public.profiles (id, email, full_name)
    VALUES ('${pmProfileId}', 'pm@example.com', 'Project Manager Profile');

    INSERT INTO public.companies (id, name, access_mode)
    VALUES ('${companyId}', 'Test Construction Co', 'read_write');

    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyId}', '${pmProfileId}', 'Project Manager', 'company_admin', true);

    INSERT INTO public.billing_subscriptions (
        id, company_id, plan_id, subscription_reference, status,
        amount_minor, currency, billing_interval, created_at
    ) VALUES (
        '${subId}', '${companyId}', '${planId}', 'SUB-20260910-0001', 'trialing',
        500000, 'ZAR', 'monthly', now() - interval '1 hour'
    );
  `);

  async function createCompanyWithSubscription(suffix: string) {
    const cid = `20000000-0000-0000-0000-0000000000${suffix}`;
    const sid = `30000000-0000-0000-0000-0000000000${suffix}`;
    await db.exec(`
      INSERT INTO public.companies (id, name, access_mode)
      VALUES ('${cid}', 'Test Construction Co ${suffix}', 'read_write');

      INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
      VALUES ('${cid}', '${pmProfileId}', 'Project Manager', 'company_admin', true);

      INSERT INTO public.billing_subscriptions (
          id, company_id, plan_id, subscription_reference, status,
          amount_minor, currency, billing_interval, created_at
      ) VALUES (
          '${sid}', '${cid}', '${planId}', 'SUB-20260910-00${suffix}', 'trialing',
          500000, 'ZAR', 'monthly', now() - interval '1 hour'
      );
    `);
    return { companyId: cid, subscriptionId: sid };
  }

  await setAuth(pmProfileId, "pm@example.com", true);

  console.log("--- 1. Testing Permission Grants and Execution Security ---");

  // Verify EXECUTE privileges
  const grantsRes = await db.query(`
    SELECT grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE routine_name = 'reconcile_paystack_checkout_initialization';
  `);
  const grantees = grantsRes.rows.map((r: any) => r.grantee);

  assert(!grantees.includes("PUBLIC"), "PUBLIC must NOT have execute grant");
  assert(!grantees.includes("anon"), "anon must NOT have execute grant");
  assert(!grantees.includes("authenticated"), "authenticated must NOT have execute grant");
  assert(grantees.includes("service_role"), "service_role has execute grant");

  // Attempt direct call as authenticated user
  try {
    await db.exec(`
      SET ROLE authenticated;
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '40000000-0000-0000-0000-000000000001'::uuid,
        'PAY-20260910-11111111111111111111111111111111',
        'failed'
      );
    `);
    assert(false, "authenticated caller must be denied direct RPC execution");
  } catch (err: any) {
    assert(err.message.includes("permission denied"), "authenticated user receives permission denied");
  } finally {
    await db.exec("RESET ROLE;");
  }

  console.log("\n--- 2. Initializing Valid Payment & Testing Parameter Validation ---");

  // Initialize a real payment via initialize_billing_checkout
  const idempKey1 = "50000000-0000-0000-0000-000000000001";
  const initRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, idempKey1]
  );
  const payment1 = initRes.rows[0] as any;
  const paymentId1 = payment1.payment_id;
  const validRef1 = payment1.provider_reference;

  assert(paymentId1 != null, "Payment successfully initialized in database");
  assert(validRef1.startsWith("PAY-"), "Payment reference has valid format");

  // Test NULL payment_id
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        NULL, '${validRef1}', 'failed'
      );
    `);
    assert(false, "NULL payment_id must fail");
  } catch (err: any) {
    assert(err.message.includes("p_payment_id cannot be null"), "reconciliation rejects null payment_id");
  }

  // Test NULL provider_reference
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', NULL, 'failed'
      );
    `);
    assert(false, "NULL provider_reference must fail");
  } catch (err: any) {
    assert(err.message.includes("p_provider_reference is invalid"), "reconciliation rejects null provider_reference");
  }

  // Test empty string provider_reference
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', '', 'failed'
      );
    `);
    assert(false, "empty provider_reference must fail");
  } catch (err: any) {
    assert(err.message.includes("p_provider_reference is invalid"), "reconciliation rejects empty provider_reference");
  }

  // Test whitespace provider_reference
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', '   ', 'failed'
      );
    `);
    assert(false, "whitespace provider_reference must fail");
  } catch (err: any) {
    assert(err.message.includes("p_provider_reference is invalid"), "reconciliation rejects whitespace provider_reference");
  }

  // Test malformed provider_reference
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', 'INVALID-REF', 'failed'
      );
    `);
    assert(false, "malformed provider reference must fail");
  } catch (err: any) {
    assert(err.message.includes("p_provider_reference is invalid"), "reconciliation rejects malformed reference");
  }

  // Test NULL target status
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', '${validRef1}', NULL
      );
    `);
    assert(false, "NULL target status must fail");
  } catch (err: any) {
    assert(err.message.includes("p_target_status must be either failed or cancelled"), "reconciliation rejects null target status");
  }

  // Test invalid target status (e.g. 'succeeded' or 'unknown')
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', '${validRef1}', 'succeeded'
      );
    `);
    assert(false, "non-terminal target status must fail");
  } catch (err: any) {
    assert(err.message.includes("p_target_status must be either failed or cancelled"), "reconciliation rejects non-terminal target status");
  }

  // Test lookup miss error code prohibition (Prompt 7A requirement)
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', '${validRef1}', 'failed', NULL, 'PAYSTACK_REFERENCE_NOT_FOUND_TERMINAL'
      );
    `);
    assert(false, "lookup miss error code must fail");
  } catch (err: any) {
    assert(err.message.includes("Provider lookup miss cannot transition payment attempt to terminal status"), "reconciliation rejects lookup miss termination");
  }

  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', '${validRef1}', 'failed', NULL, 'PAYSTACK_LOOKUP_MISS'
      );
    `);
    assert(false, "PAYSTACK_LOOKUP_MISS error code must fail");
  } catch (err: any) {
    assert(err.message.includes("Provider lookup miss cannot transition payment attempt to terminal status"), "reconciliation rejects PAYSTACK_LOOKUP_MISS termination");
  }

  console.log("\n--- 3. Testing Provider Reference Integrity ---");

  // Non-existent payment
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '99999999-9999-9999-9999-999999999999'::uuid, '${validRef1}', 'failed'
      );
    `);
    assert(false, "non-existent payment must fail");
  } catch (err: any) {
    assert(err.message.includes("not found for reconciliation"), "reconciliation returns P0002 for non-existent payment");
  }

  // Provider reference mismatch
  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${paymentId1}', 'PAY-20260910-99999999999999999999999999999999', 'failed'
      );
    `);
    assert(false, "mismatched provider reference must fail");
  } catch (err: any) {
    assert(err.message.includes("Provider reference mismatch"), "reconciliation enforces exact provider reference match");
  }

  // NULL-safe reference comparison when row's provider_reference is NULL in database
  const { companyId: nullCompanyId } = await createCompanyWithSubscription("02");
  const nullRefIdemp = "50000000-0000-0000-0000-000000000099";
  const initNullRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [nullCompanyId, nullRefIdemp]
  );
  const nullPaymentId = (initNullRes.rows[0] as any).payment_id;
  const originalRef = (initNullRes.rows[0] as any).provider_reference;

  await db.exec(`ALTER TABLE public.billing_payments DISABLE TRIGGER trg_billing_payments_protect_update;`);
  await db.exec(`ALTER TABLE public.billing_payments ALTER COLUMN provider_reference DROP NOT NULL;`);
  await db.exec(`UPDATE public.billing_payments SET provider_reference = NULL WHERE id = '${nullPaymentId}';`);

  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${nullPaymentId}', '${validRef1}', 'failed'
      );
    `);
    assert(false, "NULL row reference compared to non-null reference must fail");
  } catch (err: any) {
    assert(err.message.includes("Provider reference mismatch"), "IS DISTINCT FROM safely catches mismatch when row reference is NULL");
  } finally {
    await db.exec(`UPDATE public.billing_payments SET provider_reference = '${originalRef}' WHERE id = '${nullPaymentId}';`);
    await db.exec(`ALTER TABLE public.billing_payments ALTER COLUMN provider_reference SET NOT NULL;`);
    await db.exec(`ALTER TABLE public.billing_payments ENABLE TRIGGER trg_billing_payments_protect_update;`);
  }

  console.log("\n--- 4. Testing Concurrency, Idempotency, and Ledger Deduplication ---");

  // First terminal reconciliation call: transitions to failed, records ledger
  const res1 = await db.query(`
    SELECT * FROM public.reconcile_paystack_checkout_initialization(
      '${paymentId1}', '${validRef1}', 'failed', 'TX-998877', 'PAYSTACK_TRANSACTION_FAILED', 'Insufficient funds'
    );
  `);
  const row1 = res1.rows[0] as any;
  assert(row1.payment_status === "failed", "first call transitions payment to failed");
  assert(row1.is_reused === false, "first call is not reused (new transition)");
  assert(row1.is_resolved === true, "first call is resolved");

  // Check ledger event
  const ledgerRes1 = await db.query(`
    SELECT COUNT(*) as count FROM public.billing_ledger_events
    WHERE payment_id = '${paymentId1}' AND event_type = 'payment_failed';
  `);
  assert(Number((ledgerRes1.rows[0] as any).count) === 1, "exactly 1 ledger event recorded on first failure");

  // Second simultaneous/repeated reconciliation call: should be idempotent and NOT create duplicate ledger event
  const res2 = await db.query(`
    SELECT * FROM public.reconcile_paystack_checkout_initialization(
      '${paymentId1}', '${validRef1}', 'failed', 'TX-998877', 'PAYSTACK_TRANSACTION_FAILED', 'Insufficient funds'
    );
  `);
  const row2 = res2.rows[0] as any;
  assert(row2.payment_status === "failed", "second call returns terminal failed state");
  assert(row2.is_reused === true, "second call indicates state was reused (idempotent)");
  assert(row2.is_resolved === true, "second call is resolved");

  const ledgerRes2 = await db.query(`
    SELECT COUNT(*) as count FROM public.billing_ledger_events
    WHERE payment_id = '${paymentId1}' AND event_type = 'payment_failed';
  `);
  assert(Number((ledgerRes2.rows[0] as any).count) === 1, "no duplicate ledger event created on repeated call");

  console.log("\n--- 5. Testing Racing Webhook (Succeeded Payment Protection) ---");

  // Initialize a second payment
  const idempKey2 = "50000000-0000-0000-0000-000000000002";
  const initRes2 = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, idempKey2]
  );
  const payment2 = initRes2.rows[0] as any;
  const paymentId2 = payment2.payment_id;
  const validRef2 = payment2.provider_reference;

  // Simulate charge success webhook finalizing payment to succeeded
  await db.exec(`
    UPDATE public.billing_payments
    SET status = 'succeeded', paid_at = now(), updated_at = now()
    WHERE id = '${paymentId2}';
  `);

  // Attempting reconcile on already succeeded payment must return existing succeeded state without overwriting
  const resSucceeded = await db.query(`
    SELECT * FROM public.reconcile_paystack_checkout_initialization(
      '${paymentId2}', '${validRef2}', 'failed'
    );
  `);
  const rowSucceeded = resSucceeded.rows[0] as any;
  assert(rowSucceeded.payment_status === "succeeded", "succeeded payment is not overwritten by failed reconciliation");
  assert(rowSucceeded.is_reused === true, "returns existing succeeded state as reused");

  const ledgerSucceeded = await db.query(`
    SELECT COUNT(*) as count FROM public.billing_ledger_events
    WHERE payment_id = '${paymentId2}' AND event_type = 'payment_failed';
  `);
  assert(Number((ledgerSucceeded.rows[0] as any).count) === 0, "no failed ledger event created for succeeded payment");

  console.log("\n--- 6. Testing Ineligible Status and Cancelled Transitions ---");

  // Create a payment in an ineligible non-terminal status (e.g. 'processing')
  const { companyId: ineligCompanyId } = await createCompanyWithSubscription("03");
  const ineligibleIdemp = "50000000-0000-0000-0000-000000000088";
  const initIneligibleRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [ineligCompanyId, ineligibleIdemp]
  );
  const ineligiblePaymentId = (initIneligibleRes.rows[0] as any).payment_id;
  const ineligibleRef = (initIneligibleRes.rows[0] as any).provider_reference;

  await db.exec(`ALTER TABLE public.billing_payments DROP CONSTRAINT chk_billing_payments_status;`);
  await db.exec(`ALTER TABLE public.billing_payments DISABLE TRIGGER trg_billing_payments_validate_status_transition;`);
  await db.exec(`UPDATE public.billing_payments SET status = 'processing' WHERE id = '${ineligiblePaymentId}';`);

  try {
    await db.query(`
      SELECT * FROM public.reconcile_paystack_checkout_initialization(
        '${ineligiblePaymentId}', '${ineligibleRef}', 'failed'
      );
    `);
    assert(false, "ineligible status cannot be transitioned to failed");
  } catch (err: any) {
    assert(err.message.includes("cannot be transitioned to"), "ineligible status transition strictly rejected with 23514");
  } finally {
    await db.exec(`UPDATE public.billing_payments SET status = 'initialized' WHERE id = '${ineligiblePaymentId}';`);
    await db.exec(`ALTER TABLE public.billing_payments ENABLE TRIGGER trg_billing_payments_validate_status_transition;`);
    await db.exec(`ALTER TABLE public.billing_payments ADD CONSTRAINT chk_billing_payments_status CHECK (status IN ('initialized', 'pending', 'succeeded', 'failed', 'cancelled'));`);
  }

  // Create a payment in 'pending' status to test cancellation
  const { companyId: pendingCompanyId } = await createCompanyWithSubscription("04");
  const pendingIdemp = "50000000-0000-0000-0000-000000000077";
  const initPendingRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [pendingCompanyId, pendingIdemp]
  );
  const pendingPaymentId = (initPendingRes.rows[0] as any).payment_id;
  const pendingRef = (initPendingRes.rows[0] as any).provider_reference;
  await db.exec(`UPDATE public.billing_payments SET status = 'pending' WHERE id = '${pendingPaymentId}';`);

  const resCancel = await db.query(`
    SELECT * FROM public.reconcile_paystack_checkout_initialization(
      '${pendingPaymentId}', '${pendingRef}', 'cancelled'
    );
  `);
  const rowCancel = resCancel.rows[0] as any;
  assert(rowCancel.payment_status === "cancelled", "pending payment successfully transitioned to cancelled");
  assert(rowCancel.is_reused === false, "first cancelled transition returns is_reused=false");
  assert(rowCancel.is_resolved === true, "cancelled transition is resolved");

  // Check cancelled_at timestamp
  const cancelDbRes = await db.query(`
    SELECT cancelled_at FROM public.billing_payments WHERE id = '${pendingPaymentId}';
  `);
  assert((cancelDbRes.rows[0] as any).cancelled_at != null, "cancelled_at timestamp is populated");

  // Repeated reconcile with cancelled is idempotent
  const resCancel2 = await db.query(`
    SELECT * FROM public.reconcile_paystack_checkout_initialization(
      '${pendingPaymentId}', '${pendingRef}', 'cancelled'
    );
  `);
  const rowCancel2 = resCancel2.rows[0] as any;
  assert(rowCancel2.payment_status === "cancelled", "repeated call returns cancelled status");
  assert(rowCancel2.is_reused === true, "repeated call returns is_reused=true");

  const ledgerCancelCount = await db.query(`
    SELECT COUNT(*) as count FROM public.billing_ledger_events
    WHERE payment_id = '${pendingPaymentId}' AND event_type = 'payment_cancelled';
  `);
  assert(Number((ledgerCancelCount.rows[0] as any).count) === 1, "exactly 1 payment_cancelled ledger event created");

  console.log("\n--- 7. Unblocking Subsequent Checkout Attempts ---");

  // Now that payment1 failed and payment2 succeeded, let's verify that a new idempotency key
  // against a pending subscription can proceed once previous attempt was finalized.
  const idempKey3 = "50000000-0000-0000-0000-000000000003";
  const initRes3 = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, idempKey3]
  );
  const payment3 = initRes3.rows[0] as any;
  assert(payment3.payment_id != null, "subsequent checkout initialized successfully after recovery");
  assert(payment3.is_reused === false, "new attempt created clean fresh payment");

  console.log("\n=======================================================");
  console.log(`PGLITE RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
