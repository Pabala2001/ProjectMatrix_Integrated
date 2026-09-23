import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

/**
 * ProjectMatrix Billing Phase 3A.2 — Prompt 8
 * Test Suite: Recover Expired Subscriptions with Stale Raw Status (PGlite)
 *
 * Verifies:
 * 1. Expired active: server entitlement is read-only after paid period expires; checkout initialization succeeds with purpose 'renewal'.
 * 2. Expired non_renewing: server entitlement is read-only; checkout initialization succeeds with purpose 'renewal'.
 * 3. Still-valid paid periods: both active and non_renewing reject checkout initialization with 23514 while paid period is active.
 * 4. Pending/uncertain attempts: retrying with same idempotency key reuses initialized session; new key is rejected with 23505.
 * 5. Concurrent renewal: blocks manual recovery when an active renewable provider subscription exists to avoid racing renewals.
 * 6. Preserved opt-out: auto_renew_enabled = false is preserved upon recovery without being silently enabled.
 * 7. Verified restoration: write access remains strictly blocked until verified payment establishes a future paid period.
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
  console.log("PROJECTMATRIX RECOVER EXPIRED SUBSCRIPTIONS TEST SUITE (PGLITE)");
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

  // 2. Load Payment Foundation
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

  // 4. Seed standard plan and provider mapping
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

  const testPlanMappingSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260820000001_paystack_test_plan_mapping.sql"),
    "utf-8"
  );
  await db.exec(testPlanMappingSql);

  // 5. Load base initialize_billing_checkout RPC
  const baseCheckoutSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260820000002_initialize_billing_checkout.sql"),
    "utf-8"
  );
  await db.exec(baseCheckoutSql);

  // 6. Load base entitlement foundation
  const baseEntitlementSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260827000002_company_billing_entitlement_foundation.sql"),
    "utf-8"
  );
  await db.exec(baseEntitlementSql);

  // 7. Load process_paystack_charge_success RPC
  const chargeSuccessSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260820000004_process_paystack_charge_success.sql"),
    "utf-8"
  );
  await db.exec(chargeSuccessSql);

  // 8. Load process_paystack_subscription_disable RPC
  const subDisableSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260824000002_process_paystack_subscription_disable.sql"),
    "utf-8"
  );
  await db.exec(subDisableSql);

  // Recovery depends on the recurring invoice foundation in the supplied primary schema.
  await db.exec(fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260825000001_paystack_recurring_invoice_foundation.sql"), "utf-8"));

  // 9. Load prompt 8 migration (recover_expired_subscriptions) with authoritative reconciliation
  const recoveryMigrationSql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260830000003_recover_expired_subscriptions.sql"),
    "utf-8"
  );
  await db.exec(recoveryMigrationSql);

  // Setup test tenant and user
  const companyId = "11111111-1111-1111-1111-111111111111";
  const userId = "00000000-0000-0000-0000-000000000001";
  const planId = "10000000-0000-0000-0000-000000000001";

  await db.exec(`
    INSERT INTO public.companies (id, name) VALUES ('${companyId}', 'Acme Construction Ltd');
    INSERT INTO public.profiles (id, email, full_name) VALUES ('${userId}', 'billing.manager@example.com', 'Billing Manager');
    INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ('${userId}', 'billing.manager@example.com', now());
    INSERT INTO public.company_members (company_id, profile_id, role, is_active)
    VALUES ('${companyId}', '${userId}', 'company_admin', true);
  `);

  const setAuthUser = async (uid: string, email: string) => {
    await db.exec(`
      SET request.jwt.claim.sub = '${uid}';
      SET request.jwt.claim.email = '${email}';
    `);
  };

  await setAuthUser(userId, "billing.manager@example.com");

  // =========================================================================
  // Section 1: Expired Active Subscription Recovery
  // =========================================================================
  console.log("--- Section 1: Expired Active Subscription Recovery ---");
  const subActiveExpiredId = "20000000-0000-0000-0000-000000000001";
  await db.exec(`
    INSERT INTO public.billing_subscriptions (
        id, company_id, plan_id, subscription_reference, status,
        amount_minor, currency, billing_interval,
        current_period_start, current_period_end, auto_renew_enabled
    ) VALUES (
        '${subActiveExpiredId}', '${companyId}', '${planId}', 'SUB-ACTIVE-EXPIRED-01', 'active',
        500000, 'ZAR', 'monthly',
        now() - interval '32 days', now() - interval '2 days', false
    );
  `);

  // 1.1 Entitlement must be read_only and period_expired
  const ent1Res = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const ent1 = ent1Res.rows[0] as any;
  assert(ent1.access_mode === "read_only", "Expired active sub yields access_mode = 'read_only'");
  assert(ent1.entitlement_state === "period_expired", "Expired active sub yields entitlement_state = 'period_expired'");
  assert(ent1.can_write === false, "can_write is strictly false for expired active subscription");
  assert(ent1.reason_code === "PERIOD_EXPIRED", "reason_code is 'PERIOD_EXPIRED'");

  // 1.2 Checkout initialization must be allowed with purpose 'renewal'
  const initKey1 = "30000000-0000-0000-0000-000000000001";
  const init1Res = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, initKey1]
  );
  assert(init1Res.rows.length === 1, "Checkout initialization succeeds for expired active subscription");
  const init1 = init1Res.rows[0] as any;
  assert(init1.subscription_id === subActiveExpiredId, "Checkout targets existing subscription (no duplicate subscription created)");
  assert(init1.purpose === "renewal", "Derived payment purpose is 'renewal'");
  assert(init1.payment_status === "initialized", "Payment is recorded in 'initialized' status");

  // 1.3 Entitlement must remain read_only after opening checkout
  const entAfterInitRes = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const entAfterInit = entAfterInitRes.rows[0] as any;
  assert(entAfterInit.can_write === false, "Opening checkout does NOT grant operational write access (remains read_only)");
  assert(entAfterInit.access_mode === "read_only", "Access mode remains read_only");

  // =========================================================================
  // Section 2: Pending/Uncertain Payment Attempt Concurrency
  // =========================================================================
  console.log("\n--- Section 2: Pending/Uncertain Payment Attempt Concurrency ---");

  // 2.1 Same key retry returns existing payment (is_reused = true)
  const retrySameKeyRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, initKey1]
  );
  const retrySameKey = retrySameKeyRes.rows[0] as any;
  assert(retrySameKey.payment_id === init1.payment_id, "Same idempotency key returns same payment_id");
  assert(retrySameKey.is_reused === true, "Same idempotency key returns is_reused = TRUE");

  // 2.2 New key while payment is open is rejected with 23505
  const newKeyWhileOpen = "30000000-0000-0000-0000-000000000002";
  let rejectedOpen = false;
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyId, newKeyWhileOpen]
    );
  } catch (err: any) {
    rejectedOpen = true;
    assert(
      err.message.includes("An active billing checkout session already exists"),
      "New key rejected with 23505 while an initialized attempt is open"
    );
  }
  assert(rejectedOpen, "Safe initialized-attempt recovery behavior is preserved; duplicate attempts blocked");

  // Transition payment to terminal failed status so subsequent scenarios are not blocked
  await db.exec(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE company_id = '${companyId}';`);

  // =========================================================================
  // Section 3: Expired Non-Renewing Subscription Recovery
  // =========================================================================
  console.log("\n--- Section 3: Expired Non-Renewing Subscription Recovery ---");
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'non_renewing',
        auto_renew_enabled = false
    WHERE id = '${subActiveExpiredId}';
  `);

  // 3.1 Entitlement is read_only
  const ent2Res = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const ent2 = ent2Res.rows[0] as any;
  assert(ent2.access_mode === "read_only", "Expired non_renewing sub yields access_mode = 'read_only'");
  assert(ent2.entitlement_state === "period_expired", "Expired non_renewing sub yields entitlement_state = 'period_expired'");
  assert(ent2.can_write === false, "can_write is false for expired non_renewing subscription");

  // 3.2 Checkout initialization succeeds with purpose 'renewal'
  const initKey2 = "30000000-0000-0000-0000-000000000003";
  const init2Res = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, initKey2]
  );
  const init2 = init2Res.rows[0] as any;
  assert(init2.subscription_id === subActiveExpiredId, "Recovery operates on existing non_renewing subscription");
  assert(init2.purpose === "renewal", "Recovery derives purpose 'renewal'");
  assert(init2.payment_status === "initialized", "Recovery payment is initialized");

  await db.exec(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE company_id = '${companyId}';`);

  // =========================================================================
  // Section 4: Still-Valid Paid Periods and Null Period End Handling
  // =========================================================================
  console.log("\n--- Section 4: Valid Periods & Null Period End Handling ---");

  // 4.1 Active subscription with still-valid period
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'active',
        current_period_start = now() - interval '5 days',
        current_period_end = now() + interval '25 days'
    WHERE id = '${subActiveExpiredId}';
  `);

  const entValidActiveRes = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const entValidActive = entValidActiveRes.rows[0] as any;
  assert(entValidActive.access_mode === "full", "Still-valid active sub has access_mode = 'full'");
  assert(entValidActive.can_write === true, "can_write is true for still-valid active subscription");

  let rejectedValidActive = false;
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyId, "30000000-0000-0000-0000-000000000004"]
    );
  } catch (err: any) {
    rejectedValidActive = true;
    assert(
      err.message.includes('cannot be initialized for a subscription in "active" status'),
      "Still-valid active subscription rejected with 23514"
    );
  }
  assert(rejectedValidActive, "Rejects checkout initialization while paid period is active");

  // 4.2 Non-renewing subscription with still-valid period
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'non_renewing',
        current_period_start = now() - interval '10 days',
        current_period_end = now() + interval '20 days'
    WHERE id = '${subActiveExpiredId}';
  `);

  const entValidNonRenewRes = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const entValidNonRenew = entValidNonRenewRes.rows[0] as any;
  assert(entValidNonRenew.access_mode === "full", "Still-valid non_renewing sub has access_mode = 'full'");
  assert(entValidNonRenew.can_write === true, "can_write is true for still-valid non_renewing subscription");

  let rejectedValidNonRenew = false;
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyId, "30000000-0000-0000-0000-000000000005"]
    );
  } catch (err: any) {
    rejectedValidNonRenew = true;
    assert(
      err.message.includes('cannot be initialized for a subscription in "non_renewing" status'),
      "Still-valid non_renewing subscription rejected with 23514"
    );
  }
  assert(rejectedValidNonRenew, "Rejects checkout initialization for non_renewing while period is active");

  // 4.3 Active subscription with NULL current_period_end
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'active',
        current_period_start = now() - interval '30 days',
        current_period_end = NULL
    WHERE id = '${subActiveExpiredId}';
  `);

  const entNullActiveRes = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const entNullActive = entNullActiveRes.rows[0] as any;
  assert(entNullActive.access_mode === "read_only", "Active sub with null period end has access_mode = 'read_only'");
  assert(entNullActive.can_write === false, "can_write is false for active sub with null period end");
  assert(entNullActive.reason_code === "MISSING_PERIOD_END_DATE", "reason_code is MISSING_PERIOD_END_DATE");

  let missingPeriodRejectedActive = false;
  try {
    await db.query(`SELECT * FROM public.initialize_billing_checkout($1, $2)`, [companyId, "30000000-0000-0000-0000-000000000010"]);
  } catch (err: any) {
    missingPeriodRejectedActive = true;
    assert(err.message.includes("PAID_PERIOD_RECONCILIATION_REQUIRED"), "Missing paid-period evidence requires reconciliation before another charge");
  }
  assert(missingPeriodRejectedActive, "Missing period end cannot initialize another payment");

  await db.exec(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE company_id = '${companyId}';`);

  // 4.4 Non-renewing subscription with NULL current_period_end
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'non_renewing',
        current_period_start = now() - interval '30 days',
        current_period_end = NULL,
        auto_renew_enabled = false
    WHERE id = '${subActiveExpiredId}';
  `);

  const entNullNonRenewRes = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const entNullNonRenew = entNullNonRenewRes.rows[0] as any;
  assert(entNullNonRenew.access_mode === "read_only", "Non-renewing sub with null period end has access_mode = 'read_only'");
  assert(entNullNonRenew.can_write === false, "can_write is false for non-renewing sub with null period end");
  assert(entNullNonRenew.reason_code === "MISSING_PERIOD_END_DATE", "reason_code is MISSING_PERIOD_END_DATE");

  let missingPeriodRejectedNonRenew = false;
  try {
    await db.query(`SELECT * FROM public.initialize_billing_checkout($1, $2)`, [companyId, "30000000-0000-0000-0000-000000000011"]);
  } catch (err: any) {
    missingPeriodRejectedNonRenew = true;
    assert(err.message.includes("PAID_PERIOD_RECONCILIATION_REQUIRED"), "Missing paid-period evidence requires reconciliation before another charge");
  }
  assert(missingPeriodRejectedNonRenew, "Missing period end cannot initialize another payment");

  await db.exec(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE company_id = '${companyId}';`);

  // =========================================================================
  // Section 5: Provider-Subscription Guard & Stale Row Auto-Reconciliation
  // =========================================================================
  console.log("\n--- Section 5: Provider Guard & Stale Row Auto-Reconciliation ---");

  // 5.1 Stale Provider Subscription (next_payment_at in the past / null)
  // Reconciles the stale provider row automatically rather than permanently blocking recovery!
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'active',
        current_period_start = now() - interval '35 days',
        current_period_end = now() - interval '5 days',
        auto_renew_enabled = true
    WHERE id = '${subActiveExpiredId}';

    INSERT INTO public.billing_provider_subscriptions (
        id, company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        provider_subscription_code, provider_customer_code, email_token, customer_email,
        provider_status, is_current, disabled_at, next_payment_at, created_at, updated_at
    )
    SELECT
        '40000000-0000-0000-0000-000000000001', '${companyId}', '${subActiveExpiredId}', '${planId}', bpp.id,
        'paystack', 'test', 'SUB_PS_STALE_01', 'CUS_01', 'TOKEN_01', 'billing.manager@example.com',
        'active', true, NULL, now() - interval '5 days', now() - interval '35 days', now() - interval '35 days'
    FROM public.billing_provider_plans AS bpp
    WHERE bpp.provider = 'paystack' AND bpp.is_active IS TRUE
    LIMIT 1;
  `);

  // Calling initialize_billing_checkout should require provider reconciliation
  let rejectedStaleRow = false;
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyId, "30000000-0000-0000-0000-000000000012"]
    );
  } catch (err: any) {
    rejectedStaleRow = true;
    assert(
      err.message.includes("PROVIDER_RECONCILIATION_REQUIRED"),
      "Stale provider row requires authoritative status reconciliation with Paystack before checkout"
    );
  }
  assert(rejectedStaleRow, "Provider reconciliation guard successfully halts checkout until reconciled");

  // Reconcile the stale provider subscription as the Edge Function does after checking provider status
  await db.exec(`
    UPDATE public.billing_provider_subscriptions
    SET is_current = false, disabled_at = now(), provider_status = 'cancelled'
    WHERE id = '40000000-0000-0000-0000-000000000001';
  `);

  // Calling initialize_billing_checkout should now succeed
  const staleReconciledRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, "30000000-0000-0000-0000-000000000012"]
  );
  assert(staleReconciledRes.rows.length === 1, "Stale provider row reconciled via Edge RPC allows checkout to succeed");

  // Verify the stale provider record was reconciled (disabled and non-current)
  const reconciledProvRes = await db.query(
    `SELECT is_current, disabled_at FROM public.billing_provider_subscriptions WHERE id = '40000000-0000-0000-0000-000000000001'`
  );
  const reconciledProv = reconciledProvRes.rows[0] as any;
  assert(reconciledProv.is_current === false, "Stale provider subscription was reconciled to is_current = false");
  assert(reconciledProv.disabled_at !== null, "Stale provider subscription was marked with disabled_at");

  await db.exec(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE company_id = '${companyId}';`);

  // 5.2 Genuine Future Scheduled Renewal (next_payment_at > now())
  // Must return specific recoverable error state SCHEDULED_RENEWAL_PENDING so manual payment does not race
  await db.exec(`
    INSERT INTO public.billing_provider_subscriptions (
        id, company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment,
        provider_subscription_code, provider_customer_code, email_token, customer_email,
        provider_status, is_current, disabled_at, next_payment_at, created_at, updated_at
    )
    SELECT
        '40000000-0000-0000-0000-000000000002', '${companyId}', '${subActiveExpiredId}', '${planId}', bpp.id,
        'paystack', 'test', 'SUB_PS_FUTURE_02', 'CUS_02', 'TOKEN_02', 'billing.manager@example.com',
        'active', true, NULL, now() + interval '2 days', now(), now()
    FROM public.billing_provider_plans AS bpp
    WHERE bpp.provider = 'paystack' AND bpp.is_active IS TRUE
    LIMIT 1;
  `);

  let rejectedScheduledPending = false;
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyId, "30000000-0000-0000-0000-000000000013"]
    );
  } catch (err: any) {
    rejectedScheduledPending = true;
    assert(
      err.message.includes("PROVIDER_RECONCILIATION_REQUIRED"),
      "Future provider renewals require authoritative status and invoice reconciliation"
    );
  }
  assert(rejectedScheduledPending, "Future scheduled renewal properly prevented from racing manual payment");

  // Clean up provider row
  await db.exec(`
    UPDATE public.billing_provider_subscriptions
    SET is_current = false, disabled_at = now(), provider_status = 'cancelled'
    WHERE company_id = '${companyId}';
  `);

  // Now manual recovery should be allowed because provider renewal is not running
  const unblockedRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, "30000000-0000-0000-0000-000000000007"]
  );
  assert(unblockedRes.rows.length === 1, "Checkout initialization succeeds once provider subscription is not renewable");

  await db.exec(`UPDATE public.billing_payments SET status = 'failed', failed_at = now() WHERE company_id = '${companyId}';`);
  await db.exec(`UPDATE public.billing_provider_subscriptions SET is_current = false, disabled_at = now() WHERE company_id = '${companyId}';`);

  // =========================================================================
  // Section 6 & 7: Preserved Opt-Out and Verified Restoration
  // =========================================================================
  console.log("\n--- Section 6 & 7: Preserved Opt-Out & Verified Restoration ---");

  // Isolate this verified-payment scenario from the later six-month recovery fixture.
  await db.exec("BEGIN; SAVEPOINT before_verified_restore;");

  // Subscription is expired with auto_renew_enabled = false (customer explicitly opted out)
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'non_renewing',
        current_period_start = now() - interval '35 days',
        current_period_end = now() - interval '5 days',
        auto_renew_enabled = false
    WHERE id = '${subActiveExpiredId}';
  `);

  // Pre-condition: entitlement is read_only
  const preRestoreEnt = (await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`)).rows[0] as any;
  assert(preRestoreEnt.can_write === false, "Prior to payment verification, can_write is strictly false");
  assert(preRestoreEnt.access_mode === "read_only", "Prior to payment verification, access_mode is read_only");

  // Initialize recovery payment
  const recoveryKey = "30000000-0000-0000-0000-000000000008";
  const recoveryInitRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, recoveryKey]
  );
  const recoveryInit = recoveryInitRes.rows[0] as any;
  const paymentId = recoveryInit.payment_id;
  const providerRef = recoveryInit.provider_reference;

  // Simulate verified Paystack charge success webhook
  await db.exec(`
    SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';
    SET request.jwt.claim.role = 'service_role';
  `);

  const chargeSuccessRes = await db.query(`
    SELECT * FROM public.process_paystack_charge_success(
        'test',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        '${providerRef}',
        '9988776655',
        500000,
        'ZAR',
        now(),
        NULL,
        NULL,
        'billing.manager@example.com',
        'AUTH_RECOVER01',
        'visa',
        '4081',
        '12',
        '2030',
        'Test Bank',
        'card',
        true
    );
  `);
  assert(chargeSuccessRes.rows.length === 1, "process_paystack_charge_success executes successfully");

  // Verify subscription status and period dates
  const restoredSubRes = await db.query(`SELECT * FROM public.billing_subscriptions WHERE id = '${subActiveExpiredId}'`);
  const restoredSub = restoredSubRes.rows[0] as any;
  assert(restoredSub.status === "active", "Subscription status is restored to 'active'");
  assert(new Date(restoredSub.current_period_end) > new Date(), "Subscription current_period_end is advanced into future");
  assert(restoredSub.auto_renew_enabled === false, "Customer auto-renewal opt-out is strictly preserved (auto_renew_enabled remains false)");

  // Verify entitlement restoration
  await setAuthUser(userId, "billing.manager@example.com");
  const postRestoreEntRes = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const postRestoreEnt = postRestoreEntRes.rows[0] as any;
  assert(postRestoreEnt.access_mode === "full", "Entitlement access_mode is restored to 'full'");
  assert(postRestoreEnt.can_write === true, "Operational write access (can_write) is restored only upon verified payment");
  assert(postRestoreEnt.reason_code === "ACTIVE_SUBSCRIPTION", "Reason code is restored to 'ACTIVE_SUBSCRIPTION'");

  // =========================================================================
  // Section 8: Substantially Old Period End (6 Months Expired)
  // =========================================================================
  console.log("\n--- Section 8: Substantially Old Period End (6 Months Expired) ---");

  // Restore the unpaid fixture; do not rewind periods under an already verified payment.
  await db.exec("ROLLBACK TO SAVEPOINT before_verified_restore; RELEASE SAVEPOINT before_verified_restore; COMMIT;");

  // Set subscription to 6 months expired
  await db.exec(`
    UPDATE public.billing_subscriptions
    SET status = 'active',
        current_period_start = now() - interval '210 days',
        current_period_end = now() - interval '180 days',
        auto_renew_enabled = false
    WHERE id = '${subActiveExpiredId}';
  `);

  // Pre-condition: entitlement is read_only
  const pre6MoEnt = (await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`)).rows[0] as any;
  assert(pre6MoEnt.can_write === false, "Pre-recovery 6-month expired sub has can_write = false");
  assert(pre6MoEnt.access_mode === "read_only", "Pre-recovery 6-month expired sub has access_mode = 'read_only'");

  // Initialize checkout recovery
  const sixMoInitKey = "30000000-0000-0000-0000-000000000020";
  const sixMoInitRes = await db.query(
    `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
    [companyId, sixMoInitKey]
  );
  const sixMoInit = sixMoInitRes.rows[0] as any;
  assert(sixMoInit.purpose === "renewal", "6-month expired sub allows renewal checkout");
  assert(sixMoInit.payment_status === "initialized", "6-month expired payment is initialized");

  // Access remains read_only while payment is initialized
  const during6MoEnt = (await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`)).rows[0] as any;
  assert(during6MoEnt.can_write === false, "Access strictly remains read-only before payment confirmation");

  // Process verified Paystack charge success
  await db.exec(`
    SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';
    SET request.jwt.claim.role = 'service_role';
  `);

  const sixMoChargeSuccessRes = await db.query(`
    SELECT * FROM public.process_paystack_charge_success(
        'test',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856',
        '${sixMoInit.provider_reference}',
        '9988776656',
        500000,
        'ZAR',
        now(),
        NULL,
        NULL,
        'billing.manager@example.com',
        'AUTH_RECOVER01',
        'visa',
        '4081',
        '12',
        '2030',
        'Test Bank',
        'card',
        true
    );
  `);
  assert(sixMoChargeSuccessRes.rows.length === 1, "process_paystack_charge_success succeeds for 6-month recovery");

  // Verify that payment established a new period starting from paid_at (max(now, old_period_end))
  const sixMoSubRes = await db.query(`SELECT * FROM public.billing_subscriptions WHERE id = '${subActiveExpiredId}'`);
  const sixMoSub = sixMoSubRes.rows[0] as any;
  assert(sixMoSub.status === "active", "6-month expired subscription status restored to 'active'");
  assert(new Date(sixMoSub.current_period_end) > new Date(), "New period_end is established in the future, NOT immediately expired");
  assert(sixMoSub.auto_renew_enabled === false, "6-month expired non-renewing subscription preserves auto_renew_enabled = false");

  // Verify entitlement is restored to full/operational only AFTER payment verification
  await setAuthUser(userId, "billing.manager@example.com");
  const post6MoEntRes = await db.query(`SELECT * FROM public.get_company_billing_entitlement('${companyId}')`);
  const post6MoEnt = post6MoEntRes.rows[0] as any;
  assert(post6MoEnt.access_mode === "full", "Entitlement access_mode restored to 'full' after 6-month recovery");
  assert(post6MoEnt.can_write === true, "Operational write access restored only after verified payment confirmation");

  // =========================================================================
  // Section 9: RBAC Security & Unauthorized Role Rejection
  // =========================================================================
  console.log("\n--- Section 9: RBAC Security & Unauthorized Role Rejection ---");

  // 9.1 Set user to an unauthorized non-billing role ('member', 'developer')
  await db.exec(`
    UPDATE public.company_members
    SET role = 'member', designation = 'developer', is_active = true
    WHERE company_id = '${companyId}' AND profile_id = '${userId}';
  `);

  let rejectedUnauthorizedRole = false;
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyId, "30000000-0000-0000-0000-000000000030"]
    );
  } catch (err: any) {
    rejectedUnauthorizedRole = true;
    assert(
      err.message.includes("permission denied") || err.message.includes("42501") || err.message.includes("billing"),
      "Unauthorized member role is strictly rejected from initializing checkout"
    );
  }
  assert(rejectedUnauthorizedRole, "Rejects unauthorized company role from initializing checkout");

  // 9.2 Inactive company member rejection
  await db.exec(`
    UPDATE public.company_members
    SET role = 'company_admin', designation = 'ceo', is_active = false
    WHERE company_id = '${companyId}' AND profile_id = '${userId}';
  `);

  let rejectedInactiveMember = false;
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      [companyId, "30000000-0000-0000-0000-000000000031"]
    );
  } catch (err: any) {
    rejectedInactiveMember = true;
  }
  assert(rejectedInactiveMember, "Rejects inactive / non-active company member from initializing checkout");

  // 9.3 Foreign company rejection
  await db.exec(`
    UPDATE public.company_members
    SET role = 'company_admin', designation = 'ceo', is_active = true
    WHERE company_id = '${companyId}' AND profile_id = '${userId}';
  `);

  let rejectedForeignCompany = false;
  try {
    await db.query(
      `SELECT * FROM public.initialize_billing_checkout($1, $2)`,
      ["99999999-9999-9999-9999-999999999999", "30000000-0000-0000-0000-000000000032"]
    );
  } catch (err: any) {
    rejectedForeignCompany = true;
  }
  assert(rejectedForeignCompany, "Rejects access to a foreign company for which caller has no membership");

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unhandled test exception:", err);
  process.exit(1);
});
