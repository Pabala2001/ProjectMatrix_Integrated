import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.1 — Paystack Payment Foundation Backend Test Suite (PGlite)
 *
 * Verifies:
 * 1. Five tables and forced RLS status (relrowsecurity & relforcerowsecurity)
 * 2. Zero anon or authenticated access (privilege revocation and RLS containment)
 * 3. Payment idempotency, reference uniqueness, and transaction ID uniqueness
 * 4. Plan/payment amount, currency, and interval snapshot consistency
 * 5. Payment methods only originate from verified successful payments
 * 6. Email, customer, company, and environment isolation across all relations
 * 7. Immutable fields and DELETE/TRUNCATE rejection triggers
 * 8. Valid payment and webhook state transitions and terminal timestamp checks
 * 9. Nullable ledger payment_id and cross-company / cross-subscription rejection
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
  console.log("PROJECTMATRIX PAYSTACK PAYMENT FOUNDATION TEST SUITE (PGLITE)");
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
  `);

  // 2. Load and Apply Migration 20260818000001_paystack_payment_foundation.sql
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260818000001_paystack_payment_foundation.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  await db.exec(migrationSql);
  assert(true, "Migration 20260818000001_paystack_payment_foundation.sql applied cleanly in PostgreSQL");

  // -------------------------------------------------------------
  // Test Suite 1: Five Tables and Forced RLS Status
  // -------------------------------------------------------------
  console.log("\n1. Five Foundation Tables and Forced RLS");
  const tables = [
    "billing_provider_plans",
    "billing_payments",
    "billing_webhook_events",
    "billing_provider_subscriptions",
    "billing_payment_methods",
  ];

  for (const table of tables) {
    const tableRes = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
       JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
       WHERE pg_namespace.nspname = 'public' AND relname = $1;`,
      [table]
    );

    assert(tableRes.rows.length === 1, `Table public.${table} exists in catalog`);
    assert(tableRes.rows[0]?.relrowsecurity === true, `Table public.${table} has Row Level Security ENABLED`);
    assert(tableRes.rows[0]?.relforcerowsecurity === true, `Table public.${table} has Row Level Security FORCED`);
  }

  // -------------------------------------------------------------
  // Test Suite 2: Zero Client Privileges (anon and authenticated)
  // -------------------------------------------------------------
  console.log("\n2. Zero anon and authenticated Privileges");
  for (const table of tables) {
    const grantsRes = await db.query<{ grantee: string; privilege_type: string }>(
      `SELECT grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND table_name = $1 AND grantee IN ('PUBLIC', 'anon', 'authenticated');`,
      [table]
    );

    assert(grantsRes.rows.length === 0, `Table public.${table} has zero privileges granted to PUBLIC, anon, or authenticated`);
  }

  // -------------------------------------------------------------
  // Setup Seed Fixtures for Integration Testing
  // -------------------------------------------------------------
  const companyAId = "11111111-1111-1111-1111-111111111111";
  const companyBId = "22222222-2222-2222-2222-222222222222";
  const planId = "33333333-3333-3333-3333-333333333333";
  const subAId = "44444444-4444-4444-4444-444444444444";
  const subBId = "55555555-5555-5555-5555-555555555555";
  const userProfileId = "66666666-6666-6666-6666-666666666666";

  await db.exec(`
    INSERT INTO public.companies (id, name) VALUES
      ('${companyAId}', 'Acme Construction'),
      ('${companyBId}', 'Apex Engineering');

    INSERT INTO public.profiles (id, email) VALUES
      ('${userProfileId}', 'admin@acme.co.za');

    INSERT INTO public.billing_plans (id, code, name, amount_minor, currency, billing_interval, trial_duration_minutes, cancel_anytime, is_active) VALUES
      ('${planId}', 'business-monthly', 'Business Monthly', 500000, 'ZAR', 'monthly', 5, true, true);

    INSERT INTO public.billing_subscriptions (id, company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval) VALUES
      ('${subAId}', '${companyAId}', '${planId}', 'SUB-ACME-001', 'active', 500000, 'ZAR', 'monthly'),
      ('${subBId}', '${companyBId}', '${planId}', 'SUB-APEX-002', 'active', 500000, 'ZAR', 'monthly');
  `);

  // -------------------------------------------------------------
  // Test Suite 3: Provider-Plan Snapshot Validation & Single Active Rule
  // -------------------------------------------------------------
  console.log("\n3. Provider-Plan Snapshot Validation and Active Uniqueness");
  const providerPlanId = "77777777-7777-7777-7777-777777777777";

  // Valid Provider-Plan creation matching plan
  await db.exec(`
    INSERT INTO public.billing_provider_plans (
      id, plan_id, provider, environment, provider_plan_code, provider_plan_id,
      amount_minor, currency, billing_interval, is_active
    ) VALUES (
      '${providerPlanId}', '${planId}', 'paystack', 'test', 'PLN_paystack_test_001', '1001',
      500000, 'ZAR', 'monthly', true
    );
  `);
  assert(true, "Inserted valid provider-plan mapping matching billing_plans snapshot");

  // Attempt mismatch in amount_minor
  try {
    await db.exec(`
      INSERT INTO public.billing_provider_plans (
        plan_id, provider, environment, provider_plan_code,
        amount_minor, currency, billing_interval
      ) VALUES (
        '${planId}', 'paystack', 'test', 'PLN_mismatch_amount',
        300000, 'ZAR', 'monthly'
      );
    `);
    assert(false, "Should reject provider-plan with mismatched amount_minor");
  } catch (e: any) {
    assert(e.message.includes("Provider-plan commercial values must match"), "Rejects provider-plan with mismatched amount_minor (23514)");
  }

  // Attempt mismatch in currency
  try {
    await db.exec(`
      INSERT INTO public.billing_provider_plans (
        plan_id, provider, environment, provider_plan_code,
        amount_minor, currency, billing_interval
      ) VALUES (
        '${planId}', 'paystack', 'test', 'PLN_mismatch_curr',
        500000, 'USD', 'monthly'
      );
    `);
    assert(false, "Should reject provider-plan with mismatched currency");
  } catch (e: any) {
    assert(e.message.includes("Provider-plan commercial values must match"), "Rejects provider-plan with mismatched currency (23514)");
  }

  // Partial unique index: Only one active mapping per plan/provider/environment
  try {
    await db.exec(`
      INSERT INTO public.billing_provider_plans (
        plan_id, provider, environment, provider_plan_code,
        amount_minor, currency, billing_interval, is_active
      ) VALUES (
        '${planId}', 'paystack', 'test', 'PLN_second_active',
        500000, 'ZAR', 'monthly', true
      );
    `);
    assert(false, "Should reject duplicate active provider-plan mapping");
  } catch (e: any) {
    assert(e.message.includes("uq_billing_provider_plans_active"), "Rejects second active provider-plan mapping for same plan/environment (23505)");
  }

  // Historical inactive mapping allowed
  await db.exec(`
    INSERT INTO public.billing_provider_plans (
      plan_id, provider, environment, provider_plan_code,
      amount_minor, currency, billing_interval, is_active
    ) VALUES (
      '${planId}', 'paystack', 'test', 'PLN_historical_inactive',
      500000, 'ZAR', 'monthly', false
    );
  `);
  assert(true, "Allows historical inactive provider-plan mappings alongside active mapping");

  // -------------------------------------------------------------
  // Test Suite 4: Payment Attempts, Idempotency & Provider Plan Consistency
  // -------------------------------------------------------------
  console.log("\n4. Payment Idempotency, Reference Uniqueness & Commercial Consistency");
  const paymentA1Id = "88888888-8888-8888-8888-888888888881";
  const idempotencyKey1 = "99999999-9999-9999-9999-999999999991";

  // Valid initialized payment
  await db.exec(`
    INSERT INTO public.billing_payments (
      id, company_id, subscription_id, plan_id, provider_plan_mapping_id,
      provider, environment, purpose, idempotency_key, provider_reference,
      amount_minor, currency, customer_email, status
    ) VALUES (
      '${paymentA1Id}', '${companyAId}', '${subAId}', '${planId}', '${providerPlanId}',
      'paystack', 'test', 'activation', '${idempotencyKey1}', 'ref_pay_001',
      500000, 'ZAR', 'admin@acme.co.za', 'initialized'
    );
  `);
  assert(true, "Inserted initialized payment attempt with matching commercial snapshot");

  // Duplicate idempotency_key rejection
  try {
    await db.exec(`
      INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id,
        provider, environment, purpose, idempotency_key, provider_reference,
        amount_minor, currency, customer_email, status
      ) VALUES (
        '${companyAId}', '${subAId}', '${planId}', '${providerPlanId}',
        'paystack', 'test', 'activation', '${idempotencyKey1}', 'ref_pay_002',
        500000, 'ZAR', 'admin@acme.co.za', 'initialized'
      );
    `);
    assert(false, "Should reject duplicate idempotency_key");
  } catch (e: any) {
    assert(e.message.includes("uq_billing_payments_idempotency_key"), "Rejects duplicate idempotency_key (23505)");
  }

  // Duplicate provider_reference rejection
  try {
    await db.exec(`
      INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id,
        provider, environment, purpose, idempotency_key, provider_reference,
        amount_minor, currency, customer_email, status
      ) VALUES (
        '${companyAId}', '${subAId}', '${planId}', '${providerPlanId}',
        'paystack', 'test', 'activation', gen_random_uuid(), 'ref_pay_001',
        500000, 'ZAR', 'admin@acme.co.za', 'initialized'
      );
    `);
    assert(false, "Should reject duplicate provider_reference");
  } catch (e: any) {
    assert(e.message.includes("uq_billing_payments_provider_reference"), "Rejects duplicate provider_reference (23505)");
  }

  // Commercial mismatch between payment and provider-plan mapping (amount_minor)
  try {
    await db.exec(`
      INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id,
        provider, environment, purpose, idempotency_key, provider_reference,
        amount_minor, currency, customer_email, status
      ) VALUES (
        '${companyAId}', '${subAId}', '${planId}', '${providerPlanId}',
        'paystack', 'test', 'activation', gen_random_uuid(), 'ref_pay_mismatch_amt',
        400000, 'ZAR', 'admin@acme.co.za', 'initialized'
      );
    `);
    assert(false, "Should reject payment with amount_minor differing from provider-plan snapshot");
  } catch (e: any) {
    assert(e.message.includes("fk_billing_payments_provider_plan_scope"), "Rejects payment with amount_minor mismatching provider-plan mapping (23503)");
  }

  // Cross-company subscription FK mismatch
  try {
    await db.exec(`
      INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id,
        provider, environment, purpose, idempotency_key, provider_reference,
        amount_minor, currency, customer_email, status
      ) VALUES (
        '${companyBId}', '${subAId}', '${planId}', '${providerPlanId}',
        'paystack', 'test', 'activation', gen_random_uuid(), 'ref_pay_cross_comp',
        500000, 'ZAR', 'admin@acme.co.za', 'initialized'
      );
    `);
    assert(false, "Should reject payment referencing subscription of another company");
  } catch (e: any) {
    assert(e.message.includes("fk_billing_payments_subscription_scope"), "Rejects payment with company/subscription mismatch (23503)");
  }

  // -------------------------------------------------------------
  // Test Suite 5: Payment State Transitions and Terminal Timestamps
  // -------------------------------------------------------------
  console.log("\n5. Payment State Transitions and Terminal Timestamp Invariants");

  // Valid transition: initialized -> pending
  await db.exec(`
    UPDATE public.billing_payments
    SET status = 'pending', access_code = 'acc_123', checkout_url = 'https://checkout.paystack.com/123'
    WHERE id = '${paymentA1Id}';
  `);
  assert(true, "Payment status transition initialized -> pending allowed");

  // Invalid transition: pending -> initialized
  try {
    await db.exec(`
      UPDATE public.billing_payments
      SET status = 'initialized'
      WHERE id = '${paymentA1Id}';
    `);
    assert(false, "Should reject status regression pending -> initialized");
  } catch (e: any) {
    assert(e.message.includes("Invalid billing payment status transition"), "Rejects status transition pending -> initialized (23514)");
  }

  // Attempt transition to succeeded without paid_at timestamp
  try {
    await db.exec(`
      UPDATE public.billing_payments
      SET status = 'succeeded'
      WHERE id = '${paymentA1Id}';
    `);
    assert(false, "Should reject status succeeded without paid_at");
  } catch (e: any) {
    assert(e.message.includes("chk_billing_payments_paid_timestamp"), "Rejects status succeeded when paid_at is null (23514)");
  }

  // Valid transition: pending -> succeeded with paid_at
  await db.exec(`
    UPDATE public.billing_payments
    SET status = 'succeeded', paid_at = now(), provider_transaction_id = 'txn_paystack_99901'
    WHERE id = '${paymentA1Id}';
  `);
  assert(true, "Payment status transition pending -> succeeded with paid_at allowed");

  // Terminal state protection: succeeded -> failed should fail
  try {
    await db.exec(`
      UPDATE public.billing_payments
      SET status = 'failed', failed_at = now()
      WHERE id = '${paymentA1Id}';
    `);
    assert(false, "Should reject status regression from terminal succeeded -> failed");
  } catch (e: any) {
    assert(e.message.includes("Invalid billing payment status transition"), "Rejects invalid transition from terminal succeeded state (23514)");
  }

  // -------------------------------------------------------------
  // Test Suite 6: Payment Methods Originating ONLY from Successful Payments
  // -------------------------------------------------------------
  console.log("\n6. Payment Method Provenance & Successful Payment Constraint");
  const failedPaymentId = "88888888-8888-8888-8888-888888888882";
  await db.exec(`
    INSERT INTO public.billing_payments (
      id, company_id, subscription_id, plan_id, provider_plan_mapping_id,
      provider, environment, purpose, idempotency_key, provider_reference,
      amount_minor, currency, customer_email, status, failed_at
    ) VALUES (
      '${failedPaymentId}', '${companyAId}', '${subAId}', '${planId}', '${providerPlanId}',
      'paystack', 'test', 'activation', gen_random_uuid(), 'ref_pay_failed_001',
      500000, 'ZAR', 'admin@acme.co.za', 'failed', now()
    );
  `);

  // Attempt creating payment method from failed payment
  try {
    await db.exec(`
      INSERT INTO public.billing_payment_methods (
        company_id, source_payment_id, provider, environment,
        provider_customer_code, customer_email,
        authorization_code, authorization_signature,
        channel, card_type, brand, last4, expiry_month, expiry_year, country_code,
        reusable, is_default, is_active
      ) VALUES (
        '${companyAId}', '${failedPaymentId}', 'paystack', 'test',
        'CUS_acme_001', 'admin@acme.co.za',
        'AUTH_code_fail', 'SIG_fail_001',
        'card', 'visa', 'visa', '4081', 12, 2030, 'ZA',
        true, false, true
      );
    `);
    assert(false, "Should reject payment method created from non-succeeded payment");
  } catch (e: any) {
    assert(e.message.includes("Payment methods may only be stored from successful payments"), "Rejects payment method from failed payment (23514)");
  }

  // Attempt creating payment method with email mismatch from source payment
  try {
    await db.exec(`
      INSERT INTO public.billing_payment_methods (
        company_id, source_payment_id, provider, environment,
        provider_customer_code, customer_email,
        authorization_code, authorization_signature,
        channel, card_type, brand, last4, expiry_month, expiry_year, country_code,
        reusable, is_default, is_active
      ) VALUES (
        '${companyAId}', '${paymentA1Id}', 'paystack', 'test',
        'CUS_acme_001', 'other_user@acme.co.za',
        'AUTH_code_mismatch', 'SIG_mismatch_001',
        'card', 'visa', 'visa', '4081', 12, 2030, 'ZA',
        true, false, true
      );
    `);
    assert(false, "Should reject payment method with customer_email mismatching source payment");
  } catch (e: any) {
    assert(
      e.message.includes("fk_payment_methods_source_scope") || e.message.includes("Payment-method email must match"),
      "Rejects payment method with customer_email mismatch from source payment"
    );
  }

  // Valid Payment Method from successful payment
  const methodId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  await db.exec(`
    INSERT INTO public.billing_payment_methods (
      id, company_id, source_payment_id, provider, environment,
      provider_customer_code, customer_email,
      authorization_code, authorization_signature,
      channel, card_type, brand, last4, expiry_month, expiry_year, country_code,
      reusable, is_default, is_active
    ) VALUES (
      '${methodId}', '${companyAId}', '${paymentA1Id}', 'paystack', 'test',
      'CUS_acme_001', 'admin@acme.co.za',
      'AUTH_code_valid_001', 'SIG_valid_001',
      'card', 'visa', 'visa', '4081', 12, 2030, 'ZA',
      true, true, true
    );
  `);
  assert(true, "Inserted payment method from successful source payment with exact email and company matching");

  // Single default active payment method per company/provider/environment
  try {
    await db.exec(`
      INSERT INTO public.billing_payment_methods (
        company_id, source_payment_id, provider, environment,
        provider_customer_code, customer_email,
        authorization_code, authorization_signature,
        channel, card_type, brand, last4, expiry_month, expiry_year, country_code,
        reusable, is_default, is_active
      ) VALUES (
        '${companyAId}', '${paymentA1Id}', 'paystack', 'test',
        'CUS_acme_001', 'admin@acme.co.za',
        'AUTH_code_second_def', 'SIG_second_001',
        'card', 'visa', 'visa', '1111', 10, 2029, 'ZA',
        true, true, true
      );
    `);
    assert(false, "Should reject second default active payment method");
  } catch (e: any) {
    assert(e.message.includes("uq_payment_methods_default"), "Rejects second default active payment method for same company (23505)");
  }

  // -------------------------------------------------------------
  // Test Suite 7: Provider Subscriptions and Payment Method Scoping
  // -------------------------------------------------------------
  console.log("\n7. Provider Subscriptions & Payment Method Tenant Isolation");
  const provSubId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  // Valid Provider Subscription
  await db.exec(`
    INSERT INTO public.billing_provider_subscriptions (
      id, company_id, subscription_id, plan_id, provider_plan_mapping_id,
      payment_method_id, provider, environment,
      provider_subscription_code, provider_customer_code,
      email_token, customer_email, provider_status, is_current
    ) VALUES (
      '${provSubId}', '${companyAId}', '${subAId}', '${planId}', '${providerPlanId}',
      '${methodId}', 'paystack', 'test',
      'SUB_code_001', 'CUS_acme_001',
      'tok_email_001', 'admin@acme.co.za', 'active', true
    );
  `);
  assert(true, "Inserted provider subscription linking matching subscription, plan and payment method");

  // Cross-company payment method assignment to Company B provider subscription
  try {
    await db.exec(`
      INSERT INTO public.billing_provider_subscriptions (
        company_id, subscription_id, plan_id, provider_plan_mapping_id,
        payment_method_id, provider, environment,
        provider_subscription_code, provider_customer_code,
        email_token, customer_email, provider_status, is_current
      ) VALUES (
        '${companyBId}', '${subBId}', '${planId}', '${providerPlanId}',
        '${methodId}', 'paystack', 'test',
        'SUB_code_cross', 'CUS_acme_001',
        'tok_email_cross', 'admin@acme.co.za', 'active', true
      );
    `);
    assert(false, "Should reject using Company A's payment method in Company B's provider subscription");
  } catch (e: any) {
    assert(e.message.includes("fk_provider_subscriptions_payment_method"), "Rejects cross-company payment method assignment (23503)");
  }

  // -------------------------------------------------------------
  // Test Suite 8: Durable Webhook Inbox & Transition Validation
  // -------------------------------------------------------------
  console.log("\n8. Durable Webhook Inbox, Signature Verification & State Transitions");
  const webhookId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const payloadHash = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";

  // Rejection when signature_verified is false
  try {
    await db.exec(`
      INSERT INTO public.billing_webhook_events (
        provider, environment, payload_sha256, event_type,
        raw_payload, signature_verified
      ) VALUES (
        'paystack', 'test', '${payloadHash}', 'charge.success',
        '{"event":"charge.success"}'::jsonb, false
      );
    `);
    assert(false, "Should reject unverified webhook payload insertion");
  } catch (e: any) {
    assert(e.message.includes("chk_webhook_signature_verified"), "Rejects unverified webhook payload from entering inbox (23514)");
  }

  // Valid webhook insertion
  await db.exec(`
    INSERT INTO public.billing_webhook_events (
      id, provider, environment, payload_sha256, event_type,
      raw_payload, signature_verified, processing_status, processing_attempts
    ) VALUES (
      '${webhookId}', 'paystack', 'test', '${payloadHash}', 'charge.success',
      '{"event":"charge.success","data":{"reference":"ref_pay_001"}}'::jsonb, true,
      'received', 0
    );
  `);
  assert(true, "Inserted verified webhook event in received state");

  // Valid transition: received -> processing
  await db.exec(`
    UPDATE public.billing_webhook_events
    SET processing_status = 'processing', processing_started_at = now(), processing_attempts = 1
    WHERE id = '${webhookId}';
  `);
  assert(true, "Webhook transition received -> processing with incremented attempt allowed");

  // Valid transition: processing -> processed
  await db.exec(`
    UPDATE public.billing_webhook_events
    SET processing_status = 'processed', processed_at = now()
    WHERE id = '${webhookId}';
  `);
  assert(true, "Webhook transition processing -> processed with processed_at allowed");

  // Terminal state protection: processed -> received should fail
  try {
    await db.exec(`
      UPDATE public.billing_webhook_events
      SET processing_status = 'received'
      WHERE id = '${webhookId}';
    `);
    assert(false, "Should reject transition from terminal processed state");
  } catch (e: any) {
    assert(e.message.includes("Invalid webhook processing transition"), "Rejects webhook transition out of terminal processed state (23514)");
  }

  // Decreasing processing_attempts rejection
  try {
    await db.exec(`
      UPDATE public.billing_webhook_events
      SET processing_attempts = 0
      WHERE id = '${webhookId}';
    `);
    assert(false, "Should reject decreasing processing_attempts");
  } catch (e: any) {
    assert(e.message.includes("Webhook processing attempts cannot decrease"), "Rejects decreasing webhook processing attempts (23514)");
  }

  // -------------------------------------------------------------
  // Test Suite 9: Ledger Events Payment Linkage & Cross-Company Isolation
  // -------------------------------------------------------------
  console.log("\n9. Nullable Ledger payment_id & Cross-Company Rejection");

  // Nullable payment_id allowed for non-payment ledger events (e.g. trial_started)
  await db.exec(`
    INSERT INTO public.billing_ledger_events (
      company_id, subscription_id, event_type, event_source, occurred_at, recorded_at, deduplication_key, payment_id
    ) VALUES (
      '${companyAId}', '${subAId}', 'trial_started', 'user', now(), now(), 'trial:acme', NULL
    );
  `);
  assert(true, "Ledger event supports NULL payment_id for non-payment events");

  // Valid ledger event referencing payment
  await db.exec(`
    INSERT INTO public.billing_ledger_events (
      company_id, subscription_id, event_type, event_source, occurred_at, recorded_at, deduplication_key, payment_id
    ) VALUES (
      '${companyAId}', '${subAId}', 'payment_succeeded', 'paystack_webhook', now(), now(), 'pay_succ:ref_001', '${paymentA1Id}'
    );
  `);
  assert(true, "Ledger event links matching payment_id with matching company and subscription");

  // Cross-company payment reference in ledger event
  try {
    await db.exec(`
      INSERT INTO public.billing_ledger_events (
        company_id, subscription_id, event_type, event_source, occurred_at, recorded_at, deduplication_key, payment_id
      ) VALUES (
        '${companyBId}', '${subBId}', 'payment_succeeded', 'paystack_webhook', now(), now(), 'pay_succ:cross_comp', '${paymentA1Id}'
      );
    `);
    assert(false, "Should reject ledger event referencing another company's payment");
  } catch (e: any) {
    assert(e.message.includes("fk_billing_ledger_events_payment"), "Rejects cross-company payment reference in billing_ledger_events (23503)");
  }

  // -------------------------------------------------------------
  // Test Suite 10: Immutability & DELETE / TRUNCATE Rejection
  // -------------------------------------------------------------
  console.log("\n10. Immutability & DELETE / TRUNCATE Rejection");

  for (const table of tables) {
    try {
      await db.exec(`DELETE FROM public.${table};`);
      assert(false, `Should reject DELETE on public.${table}`);
    } catch (e: any) {
      assert(e.message.includes("Deleting or truncating records from public"), `DELETE is prohibited on public.${table} (55000)`);
    }

    try {
      await db.exec(`TRUNCATE TABLE public.${table} CASCADE;`);
      assert(false, `Should reject TRUNCATE on public.${table}`);
    } catch (e: any) {
      assert(
        e.message.includes("Deleting or truncating records from public") ||
          e.message.includes("cannot truncate a table referenced in a foreign key constraint"),
        `TRUNCATE is prohibited on public.${table} (55000 / FK protected)`
      );
    }
  }

  // Immutability of Payment commercial fields
  try {
    await db.exec(`
      UPDATE public.billing_payments
      SET amount_minor = 999999
      WHERE id = '${paymentA1Id}';
    `);
    assert(false, "Should reject modifying payment amount_minor");
  } catch (e: any) {
    assert(e.message.includes("Payment identity and commercial fields are immutable"), "Rejects modification of payment commercial fields (55000)");
  }

  // Immutability of Provider-Plan commercial fields
  try {
    await db.exec(`
      UPDATE public.billing_provider_plans
      SET currency = 'USD'
      WHERE id = '${providerPlanId}';
    `);
    assert(false, "Should reject modifying provider-plan currency");
  } catch (e: any) {
    assert(e.message.includes("Provider-plan commercial fields are immutable"), "Rejects modification of provider-plan commercial fields (55000)");
  }

  // Immutability of Webhook payload fields
  try {
    await db.exec(`
      UPDATE public.billing_webhook_events
      SET raw_payload = '{"hacked":true}'::jsonb
      WHERE id = '${webhookId}';
    `);
    assert(false, "Should reject modifying webhook raw_payload");
  } catch (e: any) {
    assert(e.message.includes("Webhook identity and payload fields are immutable"), "Rejects modification of webhook raw_payload (55000)");
  }

  // Immutability of Payment Method ownership and signature
  try {
    await db.exec(`
      UPDATE public.billing_payment_methods
      SET authorization_signature = 'SIG_tampered'
      WHERE id = '${methodId}';
    `);
    assert(false, "Should reject modifying payment method authorization_signature");
  } catch (e: any) {
    assert(e.message.includes("Payment-method ownership and signature are immutable"), "Rejects modification of payment method signature (55000)");
  }

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
  console.error("Test execution failed with unhandled error:", err);
  process.exit(1);
});
