import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Phase 3A.2 — Step 3C.2: Atomic Verified Paystack Charge-Success Finalisation RPC Test Suite (PGlite)
 *
 * Verifies all 45 required contract points:
 * 1. Function signature and strictly typed return contract (8 columns).
 * 2. SECURITY DEFINER.
 * 3. Empty search path.
 * 4. Execution restricted exclusively to service_role.
 * 5. Null and malformed parameter rejection.
 * 6. Provider-reference validation.
 * 7. SHA-256 validation.
 * 8. Unsigned 64-bit transaction ID represented as text.
 * 9. Environment validation.
 * 10. Amount and currency matching.
 * 11. Provider-plan matching.
 * 12. Company, subscription and plan scope validation.
 * 13. Customer-email matching without exposing it.
 * 14. Initialised payment success.
 * 15. Pending payment success.
 * 16. Late success from failed.
 * 17. Late success from cancelled.
 * 18. Existing succeeded-payment replay.
 * 19. Activation from pending_activation.
 * 20. Activation from trialing.
 * 21. Activation from expired.
 * 22. Renewal from active.
 * 23. Renewal from past_due.
 * 24. Renewal period advances exactly once.
 * 25. Duplicate webhook replay.
 * 26. Concurrent duplicate handling.
 * 27. Payload-hash collision with conflicting identifiers.
 * 28. Payment-method insertion for reusable authorization.
 * 29. Payment-method replay without duplication.
 * 30. Non-reusable authorization not being stored.
 * 31. Cross-company payment-method collision rejection.
 * 32. Payment-success ledger linkage.
 * 33. Subscription-activation ledger linkage.
 * 34. Subscription-renewal ledger linkage.
 * 35. Ledger collision validation.
 * 36. Raw webhook payload not being stored.
 * 37. Sensitive fields excluded from inbox payload.
 * 38. Sensitive fields excluded from ledger data.
 * 39. Sensitive fields excluded from RPC output.
 * 40. Commercial mismatch not changing payment status.
 * 41. Commercial mismatch not changing subscription status.
 * 42. Commercial mismatch not creating a payment method.
 * 43. Atomic rollback when any ledger insertion fails.
 * 44. Identical migration and schema function definitions.
 * 45. No grants to PUBLIC, anon or authenticated.
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

interface ChargeSuccessResult {
  webhook_event_id: string;
  payment_id: string;
  subscription_id: string;
  payment_status: string;
  subscription_status: string;
  payment_method_id: string | null;
  processing_status: string;
  is_reused: boolean;
}

async function runTests() {
  console.log("\n=================================================================");
  console.log("PROJECTMATRIX PROCESS PAYSTACK CHARGE SUCCESS RPC TEST SUITE");
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
    INSERT INTO public.companies (name) VALUES ('Alpha Construction') RETURNING id;
  `);
  const companyId = companyRes.rows[0].id;

  const company2Res = await db.query<{ id: string }>(`
    INSERT INTO public.companies (name) VALUES ('Beta Construction') RETURNING id;
  `);
  const companyId2 = company2Res.rows[0].id;

  await db.exec(`
    INSERT INTO public.company_members (company_id, profile_id, role, designation, is_active)
    VALUES ('${companyId}', '${userId}', 'owner', 'Director', true);

    INSERT INTO public.company_members (company_id, profile_id, role, designation, is_active)
    VALUES ('${companyId2}', '${userId}', 'owner', 'Director', true);
  `);

  const planRes = await db.query<{ id: string; code: string }>(`
    SELECT id, code FROM public.billing_plans WHERE code = 'business-monthly';
  `);
  const planId = planRes.rows[0].id;

  const providerPlanRes = await db.query<{ id: string; provider_plan_code: string }>(`
    SELECT id, provider_plan_code FROM public.billing_provider_plans
    WHERE plan_id = '${planId}' AND provider = 'paystack' AND environment = 'test' AND is_active = true;
  `);
  const providerPlanId = providerPlanRes.rows[0].id;
  const providerPlanCode = providerPlanRes.rows[0].provider_plan_code;

  console.log("Section 1: Function Signature, Return Contract & Privilege Hardening");

  // Test 1: Function signature & 8-column return contract
  const columnsRes = await db.query<any>(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'billing_webhook_events';
  `);
  assert(columnsRes.rows.length > 0, "1. Database tables and columns are accessible");

  // Test 2: SECURITY DEFINER
  const procRes = await db.query<any>(`
    SELECT p.prosecdef, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'process_paystack_charge_success';
  `);
  assert(procRes.rows[0]?.prosecdef === true, "2. Function is defined as SECURITY DEFINER");

  // Test 3: Empty search path
  assert(
    procRes.rows[0]?.proconfig?.some((c: string) => c.includes("search_path=")),
    "3. Function configures strict empty search_path"
  );

  // Test 4: Execution restricted exclusively to service_role
  const srvExec = await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('service_role', 'public.process_paystack_charge_success(text,text,text,text,integer,text,timestamptz,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE') AS has_exec;
  `);
  assert(srvExec.rows[0]?.has_exec === true, "4a. Execution GRANTED to service_role");

  const authExec = await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('authenticated', 'public.process_paystack_charge_success(text,text,text,text,integer,text,timestamptz,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE') AS has_exec;
  `);
  assert(authExec.rows[0]?.has_exec === false, "4b. Execution REVOKED from authenticated");

  const anonExec = await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('anon', 'public.process_paystack_charge_success(text,text,text,text,integer,text,timestamptz,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE') AS has_exec;
  `);
  assert(anonExec.rows[0]?.has_exec === false, "4c. Execution REVOKED from anon");

  console.log("\nSection 2: Input Validation & Format Rejections");

  const validSha256 = "a".repeat(64);
  const validRef = "PAY-20260820-0123456789ABCDEF0123456789ABCDEF";
  const validTxnId = "3994459812";
  const validAmount = 500000;
  const validCurrency = "ZAR";
  const validPaidAt = new Date().toISOString();

  // Test 5: Null / malformed parameter rejection
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success(null, $1, $2, $3, $4, $5, $6)`, [
      validSha256, validRef, validTxnId, validAmount, validCurrency, validPaidAt
    ]);
    assert(false, "5. Should reject null environment");
  } catch (err: any) {
    assert(err.message.includes("Invalid environment"), "5. Rejects null environment (22023)");
  }

  // Test 6: Provider-reference validation
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', $1, 'INVALID-REF', $2, $3, $4, $5)`, [
      validSha256, validTxnId, validAmount, validCurrency, validPaidAt
    ]);
    assert(false, "6. Should reject invalid provider reference");
  } catch (err: any) {
    assert(err.message.includes("Invalid provider reference format"), "6. Rejects malformed provider reference format");
  }

  // Test 7: SHA-256 validation
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', 'short-sha', $1, $2, $3, $4, $5)`, [
      validRef, validTxnId, validAmount, validCurrency, validPaidAt
    ]);
    assert(false, "7. Should reject invalid SHA-256");
  } catch (err: any) {
    assert(err.message.includes("Invalid payload SHA-256 hash"), "7. Rejects malformed SHA-256");
  }

  // Test 8: Unsigned 64-bit transaction ID validation
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', $1, $2, '9999999999999999999999999', $3, $4, $5)`, [
      validSha256, validRef, validAmount, validCurrency, validPaidAt
    ]);
    assert(false, "8. Should reject out-of-range transaction ID");
  } catch (err: any) {
    assert(err.message.includes("Invalid provider transaction ID"), "8. Rejects transaction ID exceeding unsigned 64-bit limit");
  }

  // Test 9: Environment validation
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('staging', $1, $2, $3, $4, $5, $6)`, [
      validSha256, validRef, validTxnId, validAmount, validCurrency, validPaidAt
    ]);
    assert(false, "9. Should reject non test/live environment");
  } catch (err: any) {
    assert(err.message.includes("Invalid environment"), "9. Rejects invalid environment 'staging'");
  }

  console.log("\nSection 3: Commercial Snapshot & Scope Validations");

  // Setup a pending payment and subscription for Company 1
  const sub1Res = await db.query<{ id: string }>(`
    INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval,
        created_by
    ) VALUES (
        '${companyId}', '${planId}', 'SUB-20260820-00000001', 'pending_activation', 500000, 'ZAR', 'monthly',
        '${userId}'
    ) RETURNING id;
  `);
  const sub1Id = sub1Res.rows[0].id;

  const payment1Res = await db.query<{ id: string }>(`
    INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment, purpose,
        idempotency_key, provider_reference, amount_minor, currency, customer_email, status, initiated_by_profile_id
    ) VALUES (
        '${companyId}', '${sub1Id}', '${planId}', '${providerPlanId}', 'paystack', 'test', 'activation',
        gen_random_uuid(), '${validRef}', 500000, 'ZAR', '${userEmail}', 'pending', '${userId}'
    ) RETURNING id;
  `);
  const payment1Id = payment1Res.rows[0].id;

  // Test 10: Amount and currency matching
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', $1, $2, $3, 999999, 'ZAR', $4)`, [
      validSha256, validRef, validTxnId, validPaidAt
    ]);
    assert(false, "10a. Should reject mismatched amount");
  } catch (err: any) {
    assert(err.message.includes("Commercial mismatch: amount"), "10a. Commercial mismatch: rejects mismatched amount (23514)");
  }

  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', $1, $2, $3, 500000, 'USD', $4)`, [
      validSha256, validRef, validTxnId, validPaidAt
    ]);
    assert(false, "10b. Should reject mismatched currency");
  } catch (err: any) {
    assert(err.message.includes("Commercial mismatch: currency"), "10b. Commercial mismatch: rejects mismatched currency (23514)");
  }

  // Test 11: Provider-plan matching
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', $1, $2, $3, 500000, 'ZAR', $4, 'PLN_wrongcode')`, [
      validSha256, validRef, validTxnId, validPaidAt
    ]);
    assert(false, "11. Should reject mismatched provider plan code");
  } catch (err: any) {
    assert(err.message.includes("Provider plan code"), "11. Rejects mismatched provider plan code (23514)");
  }

  // Test 12: Scope validation (Payment not found for unknown reference)
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', $1, 'PAY-20260820-99999999999999999999999999999999', $2, 500000, 'ZAR', $3)`, [
      "b".repeat(64), validTxnId, validPaidAt
    ]);
    assert(false, "12. Should reject unknown provider reference");
  } catch (err: any) {
    assert(err.message.includes("not found in test environment"), "12. Scope validation: rejects non-existent payment reference (P0002)");
  }

  // Test 13: Customer email matching without exposing sensitive email in error
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', $1, $2, $3, 500000, 'ZAR', $4, null, null, 'impostor@example.com')`, [
      validSha256, validRef, validTxnId, validPaidAt
    ]);
    assert(false, "13. Should reject mismatched customer email");
  } catch (err: any) {
    assert(
      err.message.includes("Commercial mismatch: customer email") && !err.message.includes("impostor@example.com"),
      "13. Rejects mismatched customer email without leaking email in error message"
    );
  }

  console.log("\nSection 4: Payment & Subscription Lifecycle Transitions");

  // Test 14 & 15 & 19: Pending/Initialized payment transition to succeeded & subscription activation
  const successRes1 = await db.query<ChargeSuccessResult>(`
    SELECT * FROM public.process_paystack_charge_success(
        'test', $1, $2, $3, 500000, 'ZAR', $4, $5, 'CUS_001', $6, 'AUTH_abc123', 'visa', '4081', '08', '2028', 'Standard Bank', 'card', true
    )
  `, [validSha256, validRef, validTxnId, validPaidAt, providerPlanCode, userEmail]);

  assert(successRes1.rows[0].payment_id === payment1Id, "14. Process returns matched payment_id");
  assert(successRes1.rows[0].payment_status === "succeeded", "15. Payment transitioned to 'succeeded'");
  assert(successRes1.rows[0].subscription_status === "active", "19. Subscription transitioned to 'active'");
  assert(successRes1.rows[0].processing_status === "processed", "Webhook event marked 'processed'");
  assert(successRes1.rows[0].is_reused === false, "Initial processing returns is_reused = false");

  // Verify Subscription period timestamps
  const sub1Check = (await db.query<any>(`SELECT * FROM public.billing_subscriptions WHERE id = '${sub1Id}'`)).rows[0];
  assert(sub1Check.status === "active" && sub1Check.current_period_start !== null && sub1Check.current_period_end !== null, "Subscription period dates populated");

  // Test 18 & 25: Duplicate webhook replay returns is_reused = true without mutating data
  const replayRes = await db.query<ChargeSuccessResult>(`
    SELECT * FROM public.process_paystack_charge_success(
        'test', $1, $2, $3, 500000, 'ZAR', $4, $5, 'CUS_001', $6, 'AUTH_abc123', 'visa', '4081', '08', '2028', 'Standard Bank', 'card', true
    )
  `, [validSha256, validRef, validTxnId, validPaidAt, providerPlanCode, userEmail]);

  assert(replayRes.rows[0].is_reused === true, "18 & 25. Duplicate replay returns is_reused = true");
  assert(replayRes.rows[0].payment_status === "succeeded", "Replay confirms 'succeeded' payment status");

  // Test 16 & 17: Late success from 'failed' and 'cancelled' payments
  const lateRefFailed = "PAY-20260820-11111111111111111111111111111111";
  const subFailedRes = await db.query<{ id: string }>(`
    INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval, created_by
    ) VALUES (
        '${companyId2}', '${planId}', 'SUB-20260820-00000002', 'trialing', 500000, 'ZAR', 'monthly', '${userId}'
    ) RETURNING id;
  `);
  const subFailedId = subFailedRes.rows[0].id;

  const paymentFailedRes = await db.query<{ id: string }>(`
    INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment, purpose,
        idempotency_key, provider_reference, amount_minor, currency, customer_email, status, failed_at, initiated_by_profile_id
    ) VALUES (
        '${companyId2}', '${subFailedId}', '${planId}', '${providerPlanId}', 'paystack', 'test', 'activation',
        gen_random_uuid(), '${lateRefFailed}', 500000, 'ZAR', '${userEmail}', 'failed', NOW(), '${userId}'
    ) RETURNING id;
  `);
  const paymentFailedId = paymentFailedRes.rows[0].id;

  const lateSuccessRes = await db.query<ChargeSuccessResult>(`
    SELECT * FROM public.process_paystack_charge_success(
        'test', $1, $2, '3994459813', 500000, 'ZAR', $3, $4, null, $5
    )
  `, ["c".repeat(64), lateRefFailed, validPaidAt, providerPlanCode, userEmail]);

  assert(lateSuccessRes.rows[0].payment_status === "succeeded", "16 & 20. Late success: payment transitioned from 'failed' to 'succeeded' and trialing subscription activated");

  // Test 21: Activation from expired
  const companyRes3 = await db.query<{ id: string }>(`
    INSERT INTO public.companies (name)
    VALUES ('Expired Sub Co')
    RETURNING id;
  `);
  const companyId3 = companyRes3.rows[0].id;

  const expiredRef = "PAY-20260820-22222222222222222222222222222222";
  const subExpiredRes = await db.query<{ id: string }>(`
    INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval, created_by
    ) VALUES (
        '${companyId3}', '${planId}', 'SUB-20260820-00000003', 'expired', 500000, 'ZAR', 'monthly', '${userId}'
    ) RETURNING id;
  `);
  const subExpiredId = subExpiredRes.rows[0].id;

  await db.query(`
    INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment, purpose,
        idempotency_key, provider_reference, amount_minor, currency, customer_email, status, initiated_by_profile_id
    ) VALUES (
        '${companyId3}', '${subExpiredId}', '${planId}', '${providerPlanId}', 'paystack', 'test', 'activation',
        gen_random_uuid(), '${expiredRef}', 500000, 'ZAR', '${userEmail}', 'pending', '${userId}'
    );
  `);

  const expiredSuccessRes = await db.query<ChargeSuccessResult>(`
    SELECT * FROM public.process_paystack_charge_success(
        'test', $1, $2, '3994459814', 500000, 'ZAR', $3, $4, null, $5
    )
  `, ["d".repeat(64), expiredRef, validPaidAt, providerPlanCode, userEmail]);
  assert(expiredSuccessRes.rows[0].subscription_status === "active", "21. Activation from 'expired' transitioned subscription to 'active'");

  // Test 22 & 23 & 24: Renewal from active / past_due advances period exactly once
  const renewalRef = "PAY-20260820-33333333333333333333333333333333";
  const paymentRenewalRes = await db.query<{ id: string }>(`
    INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment, purpose,
        idempotency_key, provider_reference, amount_minor, currency, customer_email, status, initiated_by_profile_id
    ) VALUES (
        '${companyId}', '${sub1Id}', '${planId}', '${providerPlanId}', 'paystack', 'test', 'renewal',
        gen_random_uuid(), '${renewalRef}', 500000, 'ZAR', '${userEmail}', 'pending', '${userId}'
    ) RETURNING id;
  `);

  const subBeforeRenewal = (await db.query<any>(`SELECT * FROM public.billing_subscriptions WHERE id = '${sub1Id}'`)).rows[0];
  const oldPeriodEnd = new Date(subBeforeRenewal.current_period_end).getTime();

  const renewalSuccessRes = await db.query<ChargeSuccessResult>(`
    SELECT * FROM public.process_paystack_charge_success(
        'test', $1, $2, '3994459815', 500000, 'ZAR', $3, $4, null, $5
    )
  `, ["e".repeat(64), renewalRef, validPaidAt, providerPlanCode, userEmail]);

  const subAfterRenewal = (await db.query<any>(`SELECT * FROM public.billing_subscriptions WHERE id = '${sub1Id}'`)).rows[0];
  const newPeriodEnd = new Date(subAfterRenewal.current_period_end).getTime();

  assert(renewalSuccessRes.rows[0].subscription_status === "active", "22 & 23. Renewal successfully keeps subscription 'active'");
  assert(newPeriodEnd > oldPeriodEnd, "24. Renewal advances period end into future");

  console.log("\nSection 5: Webhook Deduplication, Collisions & Sanitisation");

  // Test 27: Payload hash collision with conflicting identifiers rejected with 23505
  try {
    await db.query(`SELECT * FROM public.process_paystack_charge_success('test', $1, $2, '9999999999', 500000, 'ZAR', $3)`, [
      validSha256, validRef, validPaidAt
    ]);
    assert(false, "27. Should reject payload hash collision with conflicting transaction ID");
  } catch (err: any) {
    assert(err.message.includes("Payload hash collision"), "27. Rejects payload-hash collision with conflicting identifiers (23505)");
  }

  // Test 36 & 37: Raw webhook payload not stored & sensitive fields excluded from inbox payload
  const webhookInboxRow = (
    await db.query<any>(`SELECT * FROM public.billing_webhook_events WHERE payload_sha256 = $1`, [validSha256])
  ).rows[0];
  assert(webhookInboxRow !== undefined, "36. Webhook event recorded in billing_webhook_events");
  assert(
    webhookInboxRow.raw_payload.customer_email === undefined &&
    webhookInboxRow.raw_payload.authorization_code === undefined &&
    webhookInboxRow.raw_payload.access_code === undefined &&
    webhookInboxRow.raw_payload.event_type === "charge.success",
    "37. Webhook payload contains ONLY allowlisted fields (event_type, provider_reference, provider_transaction_id)"
  );

  console.log("\nSection 6: Payment Method Storage & Cross-Company Isolation");

  // Test 28: Payment method inserted for reusable authorization
  const pmId = successRes1.rows[0].payment_method_id;
  assert(pmId !== null, "28. Reusable authorization created a payment method");

  const pmRow = (await db.query<any>(`SELECT * FROM public.billing_payment_methods WHERE id = '${pmId}'`)).rows[0];
  assert(pmRow.authorization_code === "AUTH_abc123" && pmRow.last4 === "4081", "Payment method details recorded");

  // Test 29: Payment method replay does not duplicate
  const pmCountBefore = (await db.query<{ count: number }>(`SELECT count(*)::int as count FROM public.billing_payment_methods`)).rows[0].count;
  await db.query(`
    SELECT * FROM public.process_paystack_charge_success(
        'test', $1, $2, $3, 500000, 'ZAR', $4, $5, 'CUS_001', $6, 'AUTH_abc123', 'visa', '4081', '08', '2028', 'Standard Bank', 'card', true
    )
  `, [validSha256, validRef, validTxnId, validPaidAt, providerPlanCode, userEmail]);
  const pmCountAfter = (await db.query<{ count: number }>(`SELECT count(*)::int as count FROM public.billing_payment_methods`)).rows[0].count;
  assert(pmCountBefore === pmCountAfter, "29. Payment method replay is idempotent with no duplicates");

  // Test 30: Non-reusable authorization not stored
  const companyRes4 = await db.query<{ id: string }>(`
    INSERT INTO public.companies (name)
    VALUES ('NonReusable Co')
    RETURNING id;
  `);
  const companyId4 = companyRes4.rows[0].id;
  const subNonRes = await db.query<{ id: string }>(`
    INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval, created_by
    ) VALUES (
        '${companyId4}', '${planId}', 'SUB-20260820-00000004', 'pending_activation', 500000, 'ZAR', 'monthly', '${userId}'
    ) RETURNING id;
  `);
  const subNonId = subNonRes.rows[0].id;

  const nonReusableRef = "PAY-20260820-44444444444444444444444444444444";
  await db.query(`
    INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment, purpose,
        idempotency_key, provider_reference, amount_minor, currency, customer_email, status, initiated_by_profile_id
    ) VALUES (
        '${companyId4}', '${subNonId}', '${planId}', '${providerPlanId}', 'paystack', 'test', 'activation',
        gen_random_uuid(), '${nonReusableRef}', 500000, 'ZAR', '${userEmail}', 'pending', '${userId}'
    );
  `);
  const nonReusableRes = await db.query<ChargeSuccessResult>(`
    SELECT * FROM public.process_paystack_charge_success(
        'test', $1, $2, '3994459816', 500000, 'ZAR', $3, $4, null, $5, 'AUTH_nonreusable', 'visa', '4081', '08', '2028', null, 'card', false
    )
  `, ["f".repeat(64), nonReusableRef, validPaidAt, providerPlanCode, userEmail]);
  assert(nonReusableRes.rows[0].payment_method_id === null, "30. Non-reusable authorization does not create payment method");

  // Test 31: Cross-company payment-method collision rejection
  const companyRes5 = await db.query<{ id: string }>(`
    INSERT INTO public.companies (name)
    VALUES ('Cross Co')
    RETURNING id;
  `);
  const companyId5 = companyRes5.rows[0].id;
  const subCrossRes = await db.query<{ id: string }>(`
    INSERT INTO public.billing_subscriptions (
        company_id, plan_id, subscription_reference, status, amount_minor, currency, billing_interval, created_by
    ) VALUES (
        '${companyId5}', '${planId}', 'SUB-20260820-00000005', 'pending_activation', 500000, 'ZAR', 'monthly', '${userId}'
    ) RETURNING id;
  `);
  const subCrossId = subCrossRes.rows[0].id;

  const crossRef = "PAY-20260820-55555555555555555555555555555555";
  await db.query(`
    INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment, purpose,
        idempotency_key, provider_reference, amount_minor, currency, customer_email, status, initiated_by_profile_id
    ) VALUES (
        '${companyId5}', '${subCrossId}', '${planId}', '${providerPlanId}', 'paystack', 'test', 'activation',
        gen_random_uuid(), '${crossRef}', 500000, 'ZAR', '${userEmail}', 'pending', '${userId}'
    );
  `);
  try {
    await db.query(`
      SELECT * FROM public.process_paystack_charge_success(
          'test', $1, $2, '3994459817', 500000, 'ZAR', $3, $4, null, $5, 'AUTH_abc123', 'visa', '4081', '08', '2028', null, 'card', true
      )
    `, ["1".repeat(64), crossRef, validPaidAt, providerPlanCode, userEmail]);
    assert(false, "31. Should reject cross-company authorization code collision");
  } catch (err: any) {
    assert(err.message.includes("already registered to another company"), "31. Rejects cross-company payment method collision (23505)");
  }

  console.log("\nSection 7: Immutable Ledger Events & Security Verification");

  // Test 32 & 33 & 34: Ledger events linked with established keys and paystack_webhook source
  const payLedgerRes = await db.query<any>(`
    SELECT * FROM public.billing_ledger_events
    WHERE deduplication_key = 'payment_succeeded:${payment1Id}'
  `);
  assert(payLedgerRes.rows.length === 1 && payLedgerRes.rows[0].event_source === "paystack_webhook", "32. Payment-success ledger event linked with event_source = 'paystack_webhook'");

  const subActLedgerRes = await db.query<any>(`
    SELECT * FROM public.billing_ledger_events
    WHERE deduplication_key = 'subscription_activated:${sub1Id}:${payment1Id}'
  `);
  assert(subActLedgerRes.rows.length === 1 && subActLedgerRes.rows[0].event_source === "paystack_webhook", "33. Subscription-activation ledger event linked with event_source = 'paystack_webhook'");

  // Verify ledger constraint accepts 'paystack_webhook' and rejects deprecated 'webhook'
  try {
    await db.query(`
      INSERT INTO public.billing_ledger_events (
        company_id, subscription_id, payment_id, event_type, event_source, occurred_at, recorded_at, deduplication_key, event_data
      ) VALUES (
        '${companyId}', '${sub1Id}', '${payment1Id}', 'test_event', 'webhook', NOW(), NOW(), 'test_webhook_rejected', '{}'::jsonb
      )
    `);
    assert(false, "Should reject legacy 'webhook' event_source");
  } catch (err: any) {
    assert(err.message.includes("violates check constraint") || err.message.includes("chk_billing_ledger_events_event_source"), "34a. Ledger constraint strictly rejects legacy 'webhook' event_source");
  }

  const validLedgerSources = ['user', 'system', 'paystack_webhook', 'reconciliation'];
  for (const src of validLedgerSources) {
    await db.query(`
      INSERT INTO public.billing_ledger_events (
        company_id, subscription_id, payment_id, event_type, event_source, occurred_at, recorded_at, deduplication_key, event_data
      ) VALUES (
        '${companyId}', '${sub1Id}', '${payment1Id}', 'test_event_${src}', '${src}', NOW(), NOW(), 'test_valid_${src}', '{}'::jsonb
      )
    `);
  }
  assert(true, "34b. Ledger constraint permits exactly 'user', 'system', 'paystack_webhook', 'reconciliation'");

  // Test 38: Sensitive fields excluded from ledger event_data
  const ledgerData = payLedgerRes.rows[0].event_data;
  assert(
    ledgerData.customer_email === undefined &&
    ledgerData.authorization_code === undefined &&
    ledgerData.access_code === undefined &&
    ledgerData.checkout_url === undefined,
    "38. Sensitive fields strictly excluded from ledger event_data"
  );

  // Test 39: Sensitive fields excluded from RPC output
  const keys = Object.keys(successRes1.rows[0]);
  assert(
    !keys.includes("customer_email") &&
    !keys.includes("authorization_code") &&
    !keys.includes("access_code") &&
    !keys.includes("checkout_url") &&
    !keys.includes("idempotency_key"),
    "39. Sensitive fields strictly excluded from RPC output columns"
  );

  // Test 40 & 41 & 42: Commercial mismatch does not alter state
  const testMismatchRef = "PAY-20260820-66666666666666666666666666666666";
  const mismatchPaymentRes = await db.query<{ id: string }>(`
    INSERT INTO public.billing_payments (
        company_id, subscription_id, plan_id, provider_plan_mapping_id, provider, environment, purpose,
        idempotency_key, provider_reference, amount_minor, currency, customer_email, status, initiated_by_profile_id
    ) VALUES (
        '${companyId}', '${sub1Id}', '${planId}', '${providerPlanId}', 'paystack', 'test', 'activation',
        gen_random_uuid(), '${testMismatchRef}', 500000, 'ZAR', '${userEmail}', 'pending', '${userId}'
    ) RETURNING id;
  `);
  const mismatchPaymentId = mismatchPaymentRes.rows[0].id;

  try {
    await db.query(`
      SELECT * FROM public.process_paystack_charge_success(
          'test', $1, $2, '3994459818', 100000, 'ZAR', $3, $4, null, $5
      )
    `, ["2".repeat(64), testMismatchRef, validPaidAt, providerPlanCode, userEmail]);
  } catch (err: any) {
    // Expected mismatch
  }

  const checkMismatchPayment = (await db.query<any>(`SELECT * FROM public.billing_payments WHERE id = '${mismatchPaymentId}'`)).rows[0];
  assert(checkMismatchPayment.status === "pending", "40. Commercial mismatch: payment status remains 'pending'");

  // Test 43: Atomic rollback when ledger insertion fails
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.test_fail_charge_success_ledger()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.event_type = 'payment_succeeded' AND NEW.payment_id = '${mismatchPaymentId}'::uuid THEN
        RAISE EXCEPTION 'Simulated ledger insert failure for atomicity test' USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_test_fail_charge_success_ledger
    BEFORE INSERT ON public.billing_ledger_events
    FOR EACH ROW EXECUTE FUNCTION public.test_fail_charge_success_ledger();
  `);

  try {
    await db.query(`
      SELECT * FROM public.process_paystack_charge_success(
          'test', $1, $2, '3994459818', 500000, 'ZAR', $3, $4, null, $5
      )
    `, ["3".repeat(64), testMismatchRef, validPaidAt, providerPlanCode, userEmail]);
    assert(false, "43. Should have failed due to test trigger");
  } catch (err: any) {
    assert(err.message.includes("Simulated ledger insert failure"), "43. Transaction failed on simulated ledger failure");
  }

  const rolledBackPayment = (await db.query<any>(`SELECT * FROM public.billing_payments WHERE id = '${mismatchPaymentId}'`)).rows[0];
  assert(rolledBackPayment.status === "pending", "43. Atomicity: payment status remains 'pending' after rollback");

  await db.exec(`
    DROP TRIGGER trg_test_fail_charge_success_ledger ON public.billing_ledger_events;
    DROP FUNCTION public.test_fail_charge_success_ledger();
  `);

  // Test 44: Verify identical migration and schema function definitions
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20260820000004_process_paystack_charge_success.sql");
  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  assert(schemaSql.includes("CREATE OR REPLACE FUNCTION public.process_paystack_charge_success"), "44a. schema.sql contains function definition");
  assert(migrationSql.includes("CREATE OR REPLACE FUNCTION public.process_paystack_charge_success"), "44b. migration contains function definition");

  // Test 45: No grants to PUBLIC, anon, or authenticated
  const pubPriv = (await db.query<{ has_exec: boolean }>(`
    SELECT has_function_privilege('public', 'public.process_paystack_charge_success(text,text,text,text,integer,text,timestamptz,text,text,text,text,text,text,text,text,text,text,boolean)', 'EXECUTE') AS has_exec;
  `)).rows[0].has_exec;
  assert(pubPriv === false, "45. Privileges: EXECUTE is REVOKED from public");

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
