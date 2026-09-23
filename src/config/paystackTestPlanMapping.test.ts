import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

/**
 * Focused regression test suite for Paystack Test Plan Mapping
 * Migration: 20260820000001_paystack_test_plan_mapping.sql
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
  console.log("PAYSTACK TEST PLAN MAPPING TEST SUITE (PGLITE)");
  console.log("=======================================================\n");

  const db = new PGlite();

  // 1. Setup Auth & Core Schema Prerequisite
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE ROLE service_role;
    CREATE ROLE anon;
    CREATE ROLE authenticated;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;

    CREATE TABLE public.companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL
    );

    CREATE TABLE public.profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL
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

    -- Seed the active business-monthly internal plan
    INSERT INTO public.billing_plans (
        code,
        name,
        amount_minor,
        currency,
        billing_interval,
        trial_duration_minutes,
        cancel_anytime,
        is_active
    ) VALUES (
        'business-monthly',
        'Business Subscription Plan',
        500000,
        'ZAR',
        'monthly',
        5,
        true,
        true
    );
  `);

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

  // 2. Load and Apply Foundation Migration 20260818000001_paystack_payment_foundation.sql
  const foundationSql = fs.readFileSync(
    path.join(migrationsDir, "20260818000001_paystack_payment_foundation.sql"),
    "utf8"
  );
  await db.exec(foundationSql);
  assert(true, "Migration 20260818000001_paystack_payment_foundation.sql applied cleanly");

  // 3. Load and Apply 20260820000001_paystack_test_plan_mapping.sql
  const mappingMigrationSql = fs.readFileSync(
    path.join(migrationsDir, "20260820000001_paystack_test_plan_mapping.sql"),
    "utf8"
  );
  await db.exec(mappingMigrationSql);
  assert(true, "Migration 20260820000001_paystack_test_plan_mapping.sql applied cleanly");

  console.log("\n1. Verify Seeded Test Plan Mapping");
  // -------------------------------------------------------------
  const mappingRes = await db.query<any>(`
    SELECT
      m.id,
      m.plan_id,
      m.provider,
      m.environment,
      m.provider_plan_code,
      m.provider_plan_id,
      m.amount_minor,
      m.currency,
      m.billing_interval,
      m.is_active,
      p.code AS internal_plan_code,
      p.amount_minor AS plan_amount_minor,
      p.currency AS plan_currency,
      p.billing_interval AS plan_billing_interval
    FROM public.billing_provider_plans m
    JOIN public.billing_plans p ON p.id = m.plan_id
    WHERE p.code = 'business-monthly' AND m.environment = 'test';
  `);

  assert(mappingRes.rows.length === 1, "Exactly one test mapping exists for business-monthly");
  const mapping = mappingRes.rows[0];
  assert(mapping.provider === "paystack", "Provider is 'paystack'");
  assert(mapping.environment === "test", "Environment is 'test'");
  assert(mapping.provider_plan_code === "PLN_os65zcdsrs9yyes", "provider_plan_code is 'PLN_os65zcdsrs9yyes'");
  assert(mapping.provider_plan_id === "3994459", "provider_plan_id is '3994459'");
  assert(mapping.amount_minor === 500000, "amount_minor is 500000 (R5,000)");
  assert(mapping.currency === "ZAR", "currency is 'ZAR'");
  assert(mapping.billing_interval === "monthly", "billing_interval is 'monthly'");
  assert(mapping.is_active === true, "is_active is true");
  assert(mapping.amount_minor === mapping.plan_amount_minor, "amount_minor matches internal billing_plans snapshot");
  assert(mapping.currency === mapping.plan_currency, "currency matches internal billing_plans snapshot");
  assert(mapping.billing_interval === mapping.plan_billing_interval, "billing_interval matches internal billing_plans snapshot");

  console.log("\n2. Idempotency: Re-running Migration is a No-Op");
  // -------------------------------------------------------------
  // Execute migration a second time
  await db.exec(mappingMigrationSql);

  const countRes = await db.query<any>(`
    SELECT COUNT(*)::integer AS total_count, COUNT(DISTINCT id)::integer AS distinct_ids
    FROM public.billing_provider_plans
    WHERE provider = 'paystack' AND environment = 'test';
  `);
  assert(countRes.rows[0].total_count === 1, "Total test mapping row count remains 1 after repeated execution");
  assert(countRes.rows[0].distinct_ids === 1, "Mapping ID remains unchanged after repeated execution");

  console.log("\n3. Conflicting Active Mapping Rejection");
  // -------------------------------------------------------------
  // Test conflicting active mapping with different provider_plan_code for same plan
  let conflictCaught = false;
  try {
    await db.exec(`
      DO $$
      DECLARE
        v_plan_id UUID;
      BEGIN
        SELECT id INTO v_plan_id FROM public.billing_plans WHERE code = 'business-monthly';
        INSERT INTO public.billing_provider_plans (
          plan_id, provider, environment, provider_plan_code, provider_plan_id,
          amount_minor, currency, billing_interval, is_active
        ) VALUES (
          v_plan_id, 'paystack', 'test', 'PLN_conflict999999', '9999999',
          500000, 'ZAR', 'monthly', true
        );
      END $$;
    `);
  } catch (err: any) {
    conflictCaught = true;
    assert(
      err.code === "23505" || err.message.includes("uq_billing_provider_plans_active"),
      "Second active mapping for the same plan, provider, and environment rejected (23505)"
    );
  }
  assert(conflictCaught, "Conflicting active mapping insertion threw an error");

  console.log("\n4. Commercial Mismatch Validation on Insertion");
  // -------------------------------------------------------------
  // Test mismatching amount_minor against billing_plans
  let amountMismatchCaught = false;
  try {
    await db.exec(`
      DO $$
      DECLARE
        v_plan_id UUID;
      BEGIN
        SELECT id INTO v_plan_id FROM public.billing_plans WHERE code = 'business-monthly';
        INSERT INTO public.billing_provider_plans (
          plan_id, provider, environment, provider_plan_code, provider_plan_id,
          amount_minor, currency, billing_interval, is_active
        ) VALUES (
          v_plan_id, 'paystack', 'live', 'PLN_live_wrong_amount', '8888888',
          600000, 'ZAR', 'monthly', true
        );
      END $$;
    `);
  } catch (err: any) {
    amountMismatchCaught = true;
    assert(
      err.code === "23514" || err.message.includes("commercial values must match"),
      "Provider plan with mismatched amount rejected by validation trigger (23514)"
    );
  }
  assert(amountMismatchCaught, "Mismatched amount_minor was rejected");

  // Test mismatching currency against billing_plans
  let currencyMismatchCaught = false;
  try {
    await db.exec(`
      DO $$
      DECLARE
        v_plan_id UUID;
      BEGIN
        SELECT id INTO v_plan_id FROM public.billing_plans WHERE code = 'business-monthly';
        INSERT INTO public.billing_provider_plans (
          plan_id, provider, environment, provider_plan_code, provider_plan_id,
          amount_minor, currency, billing_interval, is_active
        ) VALUES (
          v_plan_id, 'paystack', 'live', 'PLN_live_wrong_curr', '7777777',
          500000, 'USD', 'monthly', true
        );
      END $$;
    `);
  } catch (err: any) {
    currencyMismatchCaught = true;
    assert(
      err.code === "23514" || err.message.includes("commercial values must match"),
      "Provider plan with mismatched currency rejected by validation trigger (23514)"
    );
  }
  assert(currencyMismatchCaught, "Mismatched currency was rejected");

  console.log("\n5. Inactive or Non-Existent Internal Plan Rejection");
  // -------------------------------------------------------------
  // Test mapping a non-existent plan
  let nonExistentPlanCaught = false;
  try {
    await db.exec(`
      DO $$
      BEGIN
        INSERT INTO public.billing_provider_plans (
          plan_id, provider, environment, provider_plan_code, provider_plan_id,
          amount_minor, currency, billing_interval, is_active
        ) VALUES (
          gen_random_uuid(), 'paystack', 'test', 'PLN_fake_plan_code', '1234567',
          500000, 'ZAR', 'monthly', true
        );
      END $$;
    `);
  } catch (err: any) {
    nonExistentPlanCaught = true;
    assert(
      err.code === "23503" || err.message.includes("does not exist"),
      "Mapping to non-existent plan rejected by FK / trigger (23503)"
    );
  }
  assert(nonExistentPlanCaught, "Non-existent plan mapping was rejected");

  // Create an inactive internal plan and test mapping script validation
  await db.exec(`
    INSERT INTO public.billing_plans (
      code, name, amount_minor, currency, billing_interval, is_active
    ) VALUES (
      'archived-plan', 'Archived Plan', 100000, 'ZAR', 'monthly', false
    );
  `);

  let inactivePlanCaught = false;
  try {
    await db.exec(`
      DO $$
      DECLARE
        v_plan RECORD;
        c_target_plan_code CONSTANT TEXT := 'archived-plan';
      BEGIN
        SELECT id, is_active INTO v_plan FROM public.billing_plans WHERE code = c_target_plan_code;
        IF v_plan.is_active IS NOT TRUE THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Internal plan is not active';
        END IF;
      END $$;
    `);
  } catch (err: any) {
    inactivePlanCaught = true;
    assert(
      err.code === "23514" || err.message.includes("not active"),
      "Mapping to inactive internal plan rejected (23514)"
    );
  }
  assert(inactivePlanCaught, "Inactive internal plan mapping was rejected");

  console.log("\n6. Historical Inactive Mappings Preserved");
  // -------------------------------------------------------------
  // Deactivate the current mapping (simulate historical archiving)
  await db.exec(`
    UPDATE public.billing_provider_plans
    SET is_active = false
    WHERE provider_plan_code = 'PLN_os65zcdsrs9yyes';
  `);

  // Insert a new active mapping alongside the historical inactive mapping
  const newMappingRes = await db.query<any>(`
    INSERT INTO public.billing_provider_plans (
      plan_id, provider, environment, provider_plan_code, provider_plan_id,
      amount_minor, currency, billing_interval, is_active
    ) VALUES (
      '${mapping.plan_id}', 'paystack', 'test', 'PLN_v2_new_code', '3994460',
      500000, 'ZAR', 'monthly', true
    )
    RETURNING id, is_active, provider_plan_code;
  `);

  assert(newMappingRes.rows.length === 1, "New active mapping created alongside historical inactive mapping");

  const allMappingsRes = await db.query<any>(`
    SELECT provider_plan_code, is_active
    FROM public.billing_provider_plans
    WHERE plan_id = '${mapping.plan_id}' AND environment = 'test'
    ORDER BY created_at ASC;
  `);

  assert(allMappingsRes.rows.length === 2, "Both historical and active mappings coexist in database");
  assert(allMappingsRes.rows[0].is_active === false, "Historical mapping remains inactive");
  assert(allMappingsRes.rows[1].is_active === true, "Current mapping is active");

  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unhandled error running tests:", err);
  process.exit(1);
});
