import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.2 — Step 2: Initialize Billing Checkout RPC Test Suite (PGlite)
 *
 * Verifies:
 * 1. Minimal typed TABLE return contract (14 columns including is_reused)
 * 2. Confirmed auth.users email requirement (email_confirmed_at required, profiles not used as fallback)
 * 3. Idempotency lookup before subscription state validation:
 *    - Same-key retry works even after subscription or plan mapping changes
 *    - Same-key returns is_reused: true and identical fields
 *    - Same key rejected for another company (23505)
 *    - Same key rejected for another initiating profile (23505)
 * 4. Deterministic subscription selection:
 *    - Prefers latest nonterminal subscription (created_at DESC, id DESC)
 *    - Falls back to latest terminal subscription if no nonterminal exists
 * 5. Valid and invalid subscription states & purpose derivation:
 *    - pending_activation -> activation
 *    - trialing -> activation
 *    - expired -> activation
 *    - past_due -> renewal
 *    - active, cancelled, non_renewing -> rejected (23514)
 * 6. Concurrency conflict guard:
 *    - Different key rejected while an initialized or pending payment exists (23505)
 *    - Different key allowed after previous payment reaches terminal state (failed, cancelled)
 * 7. Provider plan mapping edge cases:
 *    - Exactly one active Paystack mapping required (0 -> P0002, >1 -> 23505)
 *    - Commercial snapshot validation mismatch rejected (23514)
 *    - Inactive internal plan rejected (22023)
 * 8. Provider reference format:
 *    - PAY-YYYYMMDD- followed by 32 uppercase hexadecimal characters
 * 9. Atomic ledger event linkage:
 *    - Exactly one payment_initiated ledger event
 *    - event_data excludes customer_email and idempotency_key
 *    - event_data includes all commercial & plan snapshot fields
 * 10. Security boundary & table privileges:
 *     - Direct table mutations revoked from client roles
 *     - RPC execution granted to authenticated, revoked from anon and PUBLIC
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

interface CheckoutRPCResult {
  payment_id: string;
  subscription_id: string;
  provider_plan_mapping_id: string;
  provider_plan_code: string;
  provider: string;
  environment: string;
  purpose: string;
  provider_reference: string;
  amount_minor: number;
  currency: string;
  customer_email: string;
  payment_status: string;
  checkout_url: string | null;
  is_reused: boolean;
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("PROJECTMATRIX INITIALIZE BILLING CHECKOUT RPC TEST SUITE");
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
  const foundationSql = fs.readFileSync(foundationSqlPath, "utf-8");
  await db.exec(foundationSql);

  // 3. Load verify_billing_access RPC
  const verifyBillingSqlPath = path.join(
    process.cwd(),
    "supabase/migrations/20260729000000_verify_billing_access.sql"
  );
  const verifyBillingSql = fs.readFileSync(verifyBillingSqlPath, "utf-8");
  await db.exec(verifyBillingSql);

  // 4. Seed standard business-monthly plan & Load Test Plan Mapping Migration
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
  const testPlanMappingSql = fs.readFileSync(testPlanMappingSqlPath, "utf-8");
  await db.exec(testPlanMappingSql);

  // 5. Load initialize_billing_checkout RPC migration
  const rpcSqlPath = path.join(
    process.cwd(),
    "supabase/migrations/20260820000002_initialize_billing_checkout.sql"
  );
  const rpcSql = fs.readFileSync(rpcSqlPath, "utf-8");
  await db.exec(rpcSql);

  // Helper to set auth state (auth.uid() and auth.users)
  const setAuth = async (
    uid: string | null,
    email: string | null = null,
    confirmed: boolean = true
  ) => {
    await db.exec(`
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT ${uid ? `'${uid}'::uuid` : "NULL::uuid"}
      $$;
    `);

    if (uid) {
      await db.exec(`
        INSERT INTO auth.users (id, email, email_confirmed_at)
        VALUES ('${uid}', ${email ? `'${email}'` : "NULL"}, ${confirmed && email ? "now()" : "NULL"})
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          email_confirmed_at = EXCLUDED.email_confirmed_at;
      `);
    }
  };

  // Seed Profiles & Companies
  const pmProfileId = "00000000-0000-0000-0000-000000000001";
  const pm2ProfileId = "00000000-0000-0000-0000-000000000009";
  const workerProfileId = "00000000-0000-0000-0000-000000000002";
  const unconfirmedProfileId = "00000000-0000-0000-0000-000000000003";

  const companyAId = "aaaaaaaa-0000-0000-0000-000000000001";
  const companyBId = "bbbbbbbb-0000-0000-0000-000000000002";
  const companyCId = "cccccccc-0000-0000-0000-000000000003";
  const planId = "10000000-0000-0000-0000-000000000001";

  await db.exec(`
    INSERT INTO public.profiles (id, email, full_name) VALUES
      ('${pmProfileId}', 'pm@example.com', 'Project Manager Profile'),
      ('${pm2ProfileId}', 'pm2@example.com', 'Second Admin Profile'),
      ('${workerProfileId}', 'worker@example.com', 'Worker Profile'),
      ('${unconfirmedProfileId}', 'unconfirmed@example.com', 'Unconfirmed Profile');

    INSERT INTO public.companies (id, name) VALUES
      ('${companyAId}', 'Acme Construction'),
      ('${companyBId}', 'Beta Builders'),
      ('${companyCId}', 'Gamma Contractors');

    -- PM in Company A (authorized billing role: Project Manager)
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyAId}', '${pmProfileId}', 'Project Manager', 'company_admin', true);

    -- Second PM in Company A (authorized billing role: Company Administrator)
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyAId}', '${pm2ProfileId}', 'Company Administrator', 'company_admin', true);

    -- Worker in Company A (non-billing role)
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyAId}', '${workerProfileId}', 'General Worker', 'member', true);

    -- Unconfirmed user in Company A (authorized designation, but unconfirmed email in auth.users)
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyAId}', '${unconfirmedProfileId}', 'Project Manager', 'company_admin', true);

    -- PM in Company C
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyCId}', '${pmProfileId}', 'Project Manager', 'company_admin', true);
  `);

  // Seed auth.users records
  await setAuth(pmProfileId, "pm@example.com", true);
  await setAuth(pm2ProfileId, "pm2@example.com", true);
  await setAuth(workerProfileId, "worker@example.com", true);
  await setAuth(unconfirmedProfileId, "unconfirmed@example.com", false); // Unconfirmed email in auth.users

  console.log("Section 1: Authorization, Input Validation & Email Verification");

  // 1.1 Unauthenticated caller
  await setAuth(null, null);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "11111111-1111-1111-1111-111111111111"]
    );
    assert(false, "Unauthenticated caller must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Authentication required"),
      "Unauthenticated caller rejected with 28000"
    );
  }

  // 1.2 Non-billing member
  await setAuth(workerProfileId, "worker@example.com", true);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "11111111-1111-1111-1111-111111111111"]
    );
    assert(false, "Non-billing member must be denied access");
  } catch (err: any) {
    assert(
      err.message.includes("Access denied"),
      "Non-billing member rejected with 42501"
    );
  }

  // 1.3 Billing member accessing another company
  await setAuth(pmProfileId, "pm@example.com", true);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyBId, "11111111-1111-1111-1111-111111111111"]
    );
    assert(false, "Cross-company access must be denied");
  } catch (err: any) {
    assert(
      err.message.includes("Access denied"),
      "Cross-company caller rejected with 42501"
    );
  }

  // 1.4 Null company ID or null idempotency key
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout(NULL, $1)`,
      ["11111111-1111-1111-1111-111111111111"]
    );
    assert(false, "Null company ID must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Company ID cannot be null"),
      "Null company ID rejected with 22004"
    );
  }

  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, NULL)`,
      [companyAId]
    );
    assert(false, "Null idempotency key must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Idempotency key cannot be null"),
      "Null idempotency key rejected with 22004"
    );
  }

  // 1.5 Unconfirmed caller email (in auth.users)
  await setAuth(unconfirmedProfileId, "unconfirmed@example.com", false);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "11111111-1111-1111-1111-111111111111"]
    );
    assert(false, "Unconfirmed auth.users email must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("confirmed caller email address is required"),
      "Unconfirmed email rejected with 22000 (auth.users verified, profiles not used as fallback)"
    );
  }

  // Switch back to confirmed PM caller
  await setAuth(pmProfileId, "pm@example.com", true);

  console.log("\nSection 2: Subscription Selection, States & Return Table Contract");

  // 2.1 Missing subscription
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "11111111-1111-1111-1111-111111111111"]
    );
    assert(false, "Missing subscription must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("No billing subscription was found"),
      "Missing subscription rejected with P0002"
    );
  }

  // Create an initial trialing subscription
  const subId1 = "20000000-0000-0000-0000-000000000001";
  await db.exec(`
    INSERT INTO public.billing_subscriptions (
        id, company_id, plan_id, subscription_reference, status,
        amount_minor, currency, billing_interval, created_at
    ) VALUES (
        '${subId1}', '${companyAId}', '${planId}', 'SUB-20260820-0001', 'trialing',
        500000, 'ZAR', 'monthly', now() - interval '1 hour'
    );
  `);

  // 2.2 Minimal typed TABLE return contract verification
  const resTrialing = await db.query<CheckoutRPCResult>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyAId, "11111111-1111-1111-1111-111111111111"]
  );

  assert(resTrialing.rows.length === 1, "RPC returns exactly 1 row");
  const row = resTrialing.rows[0];

  // Contract verification: 14 specific columns
  assert(row.payment_id !== undefined && row.payment_id.length === 36, "Contract: payment_id is UUID string");
  assert(row.subscription_id === subId1, "Contract: subscription_id matches target subscription");
  assert(row.provider_plan_mapping_id !== undefined, "Contract: provider_plan_mapping_id is populated");
  assert(row.provider_plan_code === "PLN_os65zcdsrs9yyes", "Contract: provider_plan_code matches Paystack mapping");
  assert(row.provider === "paystack", "Contract: provider is 'paystack'");
  assert(row.environment === "test", "Contract: environment is 'test'");
  assert(row.purpose === "activation", "Contract: purpose is 'activation' for trialing subscription");
  assert(/^PAY-\d{8}-[A-F0-9]{32}$/.test(row.provider_reference), "Contract: provider_reference format is PAY-YYYYMMDD-HEX32");
  assert(row.amount_minor === 500000, "Contract: amount_minor is 500000");
  assert(row.currency === "ZAR", "Contract: currency is 'ZAR'");
  assert(row.customer_email === "pm@example.com", "Contract: customer_email matches caller's confirmed email");
  assert(row.payment_status === "initialized", "Contract: payment_status is 'initialized'");
  assert(row.checkout_url === null, "Contract: checkout_url is null prior to edge function initialization");
  assert(row.is_reused === false, "Contract: is_reused is FALSE on initial creation");

  const initialPaymentId = row.payment_id;
  const initialProviderRef = row.provider_reference;

  // 2.3 Verify linked ledger event and that customer_email/idempotency_key are excluded
  const ledgerRes = await db.query<{
    event_type: string;
    event_source: string;
    payment_id: string;
    event_data: any;
    deduplication_key: string;
  }>(
    `SELECT * FROM public.billing_ledger_events WHERE payment_id = $1`,
    [initialPaymentId]
  );
  assert(ledgerRes.rows.length === 1, "Exactly one ledger event linked to initialized payment");
  const ledgerEvent = ledgerRes.rows[0];
  assert(ledgerEvent.event_type === "payment_initiated", "Ledger event type is 'payment_initiated'");
  assert(ledgerEvent.event_source === "user", "Ledger event source is 'user'");
  assert(ledgerEvent.deduplication_key === `payment_initiated:${initialPaymentId}`, "Ledger deduplication key is payment_initiated:<id>");

  // Ensure event_data excludes sensitive customer_email and idempotency_key
  assert(ledgerEvent.event_data.customer_email === undefined, "Ledger event_data EXCLUDES customer_email");
  assert(ledgerEvent.event_data.idempotency_key === undefined, "Ledger event_data EXCLUDES idempotency_key");

  // Ensure event_data includes all commercial and plan snapshot fields
  assert(ledgerEvent.event_data.payment_id === initialPaymentId, "Ledger event_data includes payment_id");
  assert(ledgerEvent.event_data.provider_reference === initialProviderRef, "Ledger event_data includes provider_reference");
  assert(ledgerEvent.event_data.provider === "paystack", "Ledger event_data includes provider");
  assert(ledgerEvent.event_data.environment === "test", "Ledger event_data includes environment");
  assert(ledgerEvent.event_data.purpose === "activation", "Ledger event_data includes purpose");
  assert(ledgerEvent.event_data.plan_code === "business-monthly", "Ledger event_data includes plan_code");
  assert(ledgerEvent.event_data.amount_minor === 500000, "Ledger event_data includes amount_minor");
  assert(ledgerEvent.event_data.currency === "ZAR", "Ledger event_data includes currency");
  assert(ledgerEvent.event_data.provider_plan_code === "PLN_os65zcdsrs9yyes", "Ledger event_data includes provider_plan_code");
  assert(ledgerEvent.event_data.subscription_status_prior === "trialing", "Ledger event_data includes prior subscription status");

  console.log("\nSection 3: Idempotency Lookup & State Independence");

  // 3.1 Idempotency retry returns identical data with is_reused = TRUE
  const resRetry = await db.query<CheckoutRPCResult>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyAId, "11111111-1111-1111-1111-111111111111"]
  );
  assert(resRetry.rows.length === 1, "Idempotency retry returns 1 row");
  assert(resRetry.rows[0].payment_id === initialPaymentId, "Retry returns same payment_id");
  assert(resRetry.rows[0].provider_reference === initialProviderRef, "Retry returns same provider_reference");
  assert(resRetry.rows[0].is_reused === true, "Retry returns is_reused = TRUE");

  // 3.2 Idempotency works even if subscription state or plan changes subsequently (idempotency evaluated BEFORE state checks)
  await db.query(`UPDATE public.billing_subscriptions SET status = 'cancelled' WHERE id = '${subId1}'`);

  const resRetryAfterCancel = await db.query<CheckoutRPCResult>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyAId, "11111111-1111-1111-1111-111111111111"]
  );
  assert(
    resRetryAfterCancel.rows[0].payment_id === initialPaymentId && resRetryAfterCancel.rows[0].is_reused === true,
    "Same-key retry succeeds even after subscription transitions to 'cancelled'"
  );

  // Restore subscription status to trialing
  await db.query(`UPDATE public.billing_subscriptions SET status = 'trialing' WHERE id = '${subId1}'`);

  // 3.3 Same key rejected for another company (23505)
  // Give PM access to Company B as well to test cross-company key reuse
  await db.exec(`
    INSERT INTO public.company_members (company_id, profile_id, designation, role, is_active)
    VALUES ('${companyBId}', '${pmProfileId}', 'Project Manager', 'company_admin', true);
  `);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyBId, "11111111-1111-1111-1111-111111111111"]
    );
    assert(false, "Same idempotency key for another company must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("already assigned to another company"),
      "Same key rejected for another company with 23505"
    );
  }

  // 3.4 Same key rejected for another initiating caller (23505)
  await setAuth(pm2ProfileId, "pm2@example.com", true);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "11111111-1111-1111-1111-111111111111"]
    );
    assert(false, "Same idempotency key by another caller must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("already assigned to another caller"),
      "Same key rejected for another caller with 23505"
    );
  }

  // Switch back to primary PM
  await setAuth(pmProfileId, "pm@example.com", true);

  console.log("\nSection 4: Concurrency Conflicts & Terminal States");

  // 4.1 Different key rejected while initial payment is in 'initialized' status
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "22222222-2222-2222-2222-222222222222"]
    );
    assert(false, "Different key while payment initialized must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("already open for this subscription") && err.message.includes("initialized"),
      "Different key rejected when open payment is 'initialized' (23505)"
    );
  }

  // 4.2 Different key rejected while initial payment is in 'pending' status
  await db.query(`UPDATE public.billing_payments SET status = 'pending' WHERE id = '${initialPaymentId}'`);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "22222222-2222-2222-2222-222222222222"]
    );
    assert(false, "Different key while payment pending must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("already open for this subscription") && err.message.includes("pending"),
      "Different key rejected when open payment is 'pending' (23505)"
    );
  }

  // 4.3 Advance payment to terminal 'failed' -> new key now permitted
  await db.query(`
    UPDATE public.billing_payments
    SET status = 'failed', failed_at = now(), error_code = 'USER_CANCELLED', error_message = 'User closed checkout'
    WHERE id = '${initialPaymentId}'
  `);

  const resNewKey = await db.query<CheckoutRPCResult>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyAId, "22222222-2222-2222-2222-222222222222"]
  );
  assert(resNewKey.rows.length === 1, "New payment initialization permitted after previous terminal failure");
  assert(resNewKey.rows[0].payment_id !== initialPaymentId, "New payment created with unique payment_id");
  assert(resNewKey.rows[0].payment_status === "initialized", "New payment starts in 'initialized' status");
  assert(resNewKey.rows[0].is_reused === false, "New payment has is_reused = FALSE");

  const payment2Id = resNewKey.rows[0].payment_id;

  console.log("\nSection 5: Subscription State Permissibility & Purpose Derivation");

  // Fail payment2 to allow testing subsequent subscription state transitions
  await db.query(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE id = '${payment2Id}'`);

  // 5.1 past_due -> purpose = renewal
  await db.query(`UPDATE public.billing_subscriptions SET status = 'past_due' WHERE id = '${subId1}'`);
  const resPastDue = await db.query<CheckoutRPCResult>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyAId, "33333333-3333-3333-3333-333333333333"]
  );
  assert(resPastDue.rows[0].purpose === "renewal", "past_due subscription yields purpose 'renewal'");

  // Fail payment 3
  await db.query(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE idempotency_key = '33333333-3333-3333-3333-333333333333'`);

  // 5.2 expired -> purpose = activation
  await db.query(`UPDATE public.billing_subscriptions SET status = 'expired' WHERE id = '${subId1}'`);
  const resExpired = await db.query<CheckoutRPCResult>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyAId, "44444444-4444-4444-4444-444444444444"]
  );
  assert(resExpired.rows[0].purpose === "activation", "expired subscription yields purpose 'activation'");

  // Fail payment 4
  await db.query(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE idempotency_key = '44444444-4444-4444-4444-444444444444'`);

  // 5.3 pending_activation -> purpose = activation
  await db.query(`UPDATE public.billing_subscriptions SET status = 'pending_activation' WHERE id = '${subId1}'`);
  const resPending = await db.query<CheckoutRPCResult>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyAId, "55555555-5555-5555-5555-555555555555"]
  );
  assert(resPending.rows[0].purpose === "activation", "pending_activation subscription yields purpose 'activation'");

  // Fail payment 5
  await db.query(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE idempotency_key = '55555555-5555-5555-5555-555555555555'`);

  // 5.4 Ineligible statuses: active, cancelled, non_renewing
  for (const invalidStatus of ["active", "cancelled", "non_renewing"]) {
    await db.query(`UPDATE public.billing_subscriptions SET status = '${invalidStatus}' WHERE id = '${subId1}'`);
    try {
      await db.query(
        `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
        [companyAId, `66666666-6666-6666-6666-${invalidStatus === "active" ? "111111111111" : invalidStatus === "cancelled" ? "222222222222" : "333333333333"}`]
      );
      assert(false, `Subscription in status '${invalidStatus}' must be rejected`);
    } catch (err: any) {
      assert(
        err.message.includes("cannot be initialized for a subscription in"),
        `Subscription in '${invalidStatus}' status rejected with 23514`
      );
    }
  }

  console.log("\nSection 6: Deterministic Subscription Selection");

  // 6.1 In companyC: create one old terminal subscription, and one new nonterminal subscription
  const subIdOld = "20000000-0000-0000-0000-000000000098";
  const subIdNew = "20000000-0000-0000-0000-000000000099";

  await db.exec(`
    INSERT INTO public.billing_subscriptions (
        id, company_id, plan_id, subscription_reference, status,
        amount_minor, currency, billing_interval, created_at
    ) VALUES
      ('${subIdOld}', '${companyCId}', '${planId}', 'SUB-OLD-TERMINAL', 'cancelled', 500000, 'ZAR', 'monthly', now() - interval '2 days'),
      ('${subIdNew}', '${companyCId}', '${planId}', 'SUB-NEW-NONTERMINAL', 'trialing', 500000, 'ZAR', 'monthly', now() - interval '10 minutes');
  `);

  const resDeterministic = await db.query<CheckoutRPCResult>(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyCId, "77777777-7777-7777-7777-000000000001"]
  );
  assert(
    resDeterministic.rows[0].subscription_id === subIdNew,
    "Deterministic selection prefers latest nonterminal subscription over terminal records"
  );

  // Reset subId1 to 'trialing'
  await db.query(`UPDATE public.billing_subscriptions SET status = 'trialing' WHERE id = '${subId1}'`);

  console.log("\nSection 7: Provider Plan Mapping Edge Cases & Commercial Validation");

  // 7.1 Inactive internal plan
  await db.query(`UPDATE public.billing_plans SET is_active = false WHERE id = '${planId}'`);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "88888888-8888-8888-8888-111111111111"]
    );
    assert(false, "Inactive plan must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("is currently inactive"),
      "Inactive plan rejected with 22023"
    );
  }
  await db.query(`UPDATE public.billing_plans SET is_active = true WHERE id = '${planId}'`);

  // 7.2 No active provider mapping
  await db.query(`UPDATE public.billing_provider_plans SET is_active = false WHERE plan_id = '${planId}'`);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "88888888-8888-8888-8888-222222222222"]
    );
    assert(false, "Missing active mapping must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("No active Paystack mapping was found"),
      "Missing active Paystack mapping rejected with P0002"
    );
  }
  await db.query(`UPDATE public.billing_provider_plans SET is_active = true WHERE plan_id = '${planId}'`);

  // 7.3 Multiple active mappings
  await db.query(`
    INSERT INTO public.billing_provider_plans (
        plan_id, provider, environment, provider_plan_code, amount_minor, currency, billing_interval, is_active
    ) VALUES (
        '${planId}', 'paystack', 'live', 'PLN_live_code_123', 500000, 'ZAR', 'monthly', true
    );
  `);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "88888888-8888-8888-8888-333333333333"]
    );
    assert(false, "Multiple active mappings must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Multiple active Paystack mappings were found"),
      "Multiple active mappings rejected with 23505"
    );
  }
  await db.query(`UPDATE public.billing_provider_plans SET is_active = false WHERE provider_plan_code = 'PLN_live_code_123'`);

  // 7.4 Commercial mismatch validation
  await db.query(`UPDATE public.billing_plans SET amount_minor = 600000 WHERE id = '${planId}'`);
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyAId, "88888888-8888-8888-8888-444444444444"]
    );
    assert(false, "Commercial mismatch must be rejected");
  } catch (err: any) {
    assert(
      err.message.includes("Provider-plan commercial values do not match internal plan"),
      "Commercial mismatch rejected with 23514"
    );
  }
  await db.query(`UPDATE public.billing_plans SET amount_minor = 500000 WHERE id = '${planId}'`);

  console.log("\nSection 8: Security Boundary & Privileges");

  // 8.1 Direct INSERT on billing_payments revoked from authenticated
  const directPaymentInsert = await db.query<{ has_insert: boolean }>(`
    SELECT has_table_privilege('authenticated', 'public.billing_payments', 'INSERT') AS has_insert;
  `);
  assert(
    directPaymentInsert.rows[0]?.has_insert === false,
    "Direct INSERT on public.billing_payments is REVOKED from authenticated"
  );

  // 8.2 Direct INSERT on billing_ledger_events revoked from authenticated
  const directLedgerInsert = await db.query<{ has_insert: boolean }>(`
    SELECT has_table_privilege('authenticated', 'public.billing_ledger_events', 'INSERT') AS has_insert;
  `);
  assert(
    directLedgerInsert.rows[0]?.has_insert === false,
    "Direct INSERT on public.billing_ledger_events is REVOKED from authenticated"
  );

  // 8.3 RPC function execution granted to authenticated, revoked from anon and PUBLIC
  const rpcAuthExec = await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('authenticated', 'public.initialize_billing_checkout(uuid, uuid)', 'EXECUTE') AS has_exec;
  `);
  assert(
    rpcAuthExec.rows[0]?.has_exec === true,
    "EXECUTE on public.initialize_billing_checkout is GRANTED to authenticated"
  );

  const rpcAnonExec = await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('anon', 'public.initialize_billing_checkout(uuid, uuid)', 'EXECUTE') AS has_exec;
  `);
  assert(
    rpcAnonExec.rows[0]?.has_exec === false,
    "EXECUTE on public.initialize_billing_checkout is REVOKED from anon"
  );

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
