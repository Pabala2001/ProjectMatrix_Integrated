import {
  formatTrialDuration,
  getActiveBillingPlan,
  startBillingTrial,
  getCurrentCompanySubscription,
} from "../services/billingService";
import { supabase } from "../lib/supabase";
import { BillingSubscription } from "../types";

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

console.log("\n=======================================================");
console.log("PROJECTMATRIX BILLING SERVICE & TYPE FOUNDATION TESTS");
console.log("=======================================================\n");

// -------------------------------------------------------------
// Test 1: formatTrialDuration Functionality
// -------------------------------------------------------------
console.log("1. formatTrialDuration Functionality");
assert(formatTrialDuration(5) === "5-Minute", "5 minutes -> '5-Minute'");
assert(formatTrialDuration(60) === "1-Hour", "60 minutes -> '1-Hour'");
assert(formatTrialDuration(120) === "2-Hour", "120 minutes -> '2-Hour'");
assert(formatTrialDuration(1440) === "1-Day", "1440 minutes -> '1-Day'");
assert(formatTrialDuration(10080) === "7-Day", "10080 minutes -> '7-Day'");
assert(formatTrialDuration(2880) === "2-Day", "2880 minutes -> '2-Day'");
assert(formatTrialDuration(0) === "0-Minute", "0 minutes -> '0-Minute'");

// Invalid duration inputs
try {
  formatTrialDuration(-5);
  assert(false, "Negative duration should throw");
} catch (e: any) {
  assert(e.message.includes("Invalid trial duration minutes"), "Negative duration rejected");
}

try {
  formatTrialDuration(NaN);
  assert(false, "NaN duration should throw");
} catch (e: any) {
  assert(e.message.includes("Invalid trial duration minutes"), "NaN duration rejected");
}

try {
  formatTrialDuration(5.5);
  assert(false, "Fractional duration should throw");
} catch (e: any) {
  assert(e.message.includes("Invalid trial duration minutes"), "Fractional duration rejected");
}

// -------------------------------------------------------------
// Test 2: startBillingTrial Pre-condition Validations
// -------------------------------------------------------------
console.log("\n2. startBillingTrial Pre-condition Validations");

async function testPreconditions() {
  // Empty company ID rejection before calling Supabase
  let rpcCalled = false;
  const originalRpc = supabase.rpc;
  (supabase as any).rpc = async () => {
    rpcCalled = true;
    return { data: null, error: null };
  };

  try {
    await startBillingTrial("");
    assert(false, "Empty companyId should throw");
  } catch (e: any) {
    assert(
      e.message.includes("Company ID is required"),
      "Empty company ID rejected before Supabase is called"
    );
    assert(rpcCalled === false, "Supabase.rpc was not called for empty company ID");
  }

  try {
    await startBillingTrial("   ");
    assert(false, "Whitespace companyId should throw");
  } catch (e: any) {
    assert(
      e.message.includes("Company ID is required"),
      "Whitespace company ID rejected before Supabase is called"
    );
    assert(rpcCalled === false, "Supabase.rpc was not called for whitespace company ID");
  }

  (supabase as any).rpc = originalRpc;
}

// -------------------------------------------------------------
// Test 3: startBillingTrial RPC Call Exact Parameters & No Commercial Overrides
// -------------------------------------------------------------
console.log("\n3. startBillingTrial RPC Parameters & No Client Commercial Injection");

async function testRpcParameters() {
  const originalRpc = supabase.rpc;
  let capturedRpcName = "";
  let capturedParams: any = null;

  const sampleSub: BillingSubscription = {
    id: "sub-123",
    company_id: "comp-456",
    plan_id: "plan-789",
    subscription_reference: "SUB-20260817-ABCDEF12",
    status: "trialing",
    amount_minor: 500000,
    currency: "ZAR",
    billing_interval: "monthly",
    trial_started_at: "2026-08-17T12:00:00Z",
    trial_ends_at: "2026-08-17T12:05:00Z",
    current_period_start: "2026-08-17T12:00:00Z",
    current_period_end: "2026-08-17T12:05:00Z",
    next_renewal_at: "2026-08-17T12:05:00Z",
    auto_renew_enabled: false,
    created_at: "2026-08-17T12:00:00Z",
    updated_at: "2026-08-17T12:00:00Z",
  };

  (supabase as any).rpc = async (name: string, params: any) => {
    capturedRpcName = name;
    capturedParams = params;
    return { data: sampleSub, error: null };
  };

  const res = await startBillingTrial("comp-456");
  assert(capturedRpcName === "start_billing_trial", "Invokes exact RPC 'start_billing_trial'");
  assert(capturedParams?.p_company_id === "comp-456", "p_company_id is passed accurately");
  assert(capturedParams?.p_plan_code === "business-monthly", "p_plan_code defaults to 'business-monthly'");
  
  // Verify strictly NO client-controlled commercial params are sent
  const paramKeys = Object.keys(capturedParams || {});
  assert(
    !paramKeys.includes("amount_minor") &&
    !paramKeys.includes("amount") &&
    !paramKeys.includes("currency") &&
    !paramKeys.includes("trial_duration_minutes") &&
    !paramKeys.includes("trial_days") &&
    !paramKeys.includes("user_id") &&
    !paramKeys.includes("profile_id") &&
    !paramKeys.includes("auto_renew") &&
    !paramKeys.includes("created_by"),
    "Client does NOT send profile IDs, amounts, currencies, dates, renewal settings or trial duration"
  );
  assert(res.id === "sub-123", "Returns parsed subscription object");

  // Explicit planCode passed
  await startBillingTrial("comp-456", "enterprise-monthly");
  assert(capturedParams?.p_plan_code === "enterprise-monthly", "p_plan_code overrides cleanly when provided");

  (supabase as any).rpc = originalRpc;
}

// -------------------------------------------------------------
// Test 4: Result Normalization (Single object vs One-element array vs Malformed)
// -------------------------------------------------------------
console.log("\n4. RPC Result Normalization & Error Handling");

async function testResultNormalization() {
  const originalRpc = supabase.rpc;

  const sampleSub = {
    id: "sub-999",
    company_id: "comp-999",
    plan_id: "plan-999",
    subscription_reference: "SUB-20260817-12345678",
    status: "trialing",
    amount_minor: 500000,
    currency: "ZAR",
    auto_renew_enabled: false,
  };

  // 1. One-element array normalization
  (supabase as any).rpc = async () => ({
    data: [sampleSub],
    error: null,
  });
  const normalizedFromArr = await startBillingTrial("comp-999");
  assert(normalizedFromArr.id === "sub-999", "Normalizes 1-element array return");

  // 2. Single object normalization
  (supabase as any).rpc = async () => ({
    data: sampleSub,
    error: null,
  });
  const normalizedFromObj = await startBillingTrial("comp-999");
  assert(normalizedFromObj.id === "sub-999", "Normalizes single object return");

  // 3. Null return rejection
  (supabase as any).rpc = async () => ({
    data: null,
    error: null,
  });
  try {
    await startBillingTrial("comp-999");
    assert(false, "Null return should throw");
  } catch (e: any) {
    assert(e.message.includes("Malformed subscription data"), "Rejects null RPC data");
  }

  // 4. Empty array return rejection
  (supabase as any).rpc = async () => ({
    data: [],
    error: null,
  });
  try {
    await startBillingTrial("comp-999");
    assert(false, "Empty array return should throw");
  } catch (e: any) {
    assert(e.message.includes("returned an empty result"), "Rejects empty array RPC data");
  }

  // 5. Malformed data rejection
  (supabase as any).rpc = async () => ({
    data: { somethingElse: true },
    error: null,
  });
  try {
    await startBillingTrial("comp-999");
    assert(false, "Malformed data should throw");
  } catch (e: any) {
    assert(e.message.includes("Malformed subscription data"), "Rejects malformed subscription object");
  }

  // 6. Supabase RPC Error propagation
  (supabase as any).rpc = async () => ({
    data: null,
    error: { message: "A free trial has already been used for this company.", code: "23505" },
  });
  try {
    await startBillingTrial("comp-999");
    assert(false, "RPC error should be thrown");
  } catch (e: any) {
    assert(
      e.message.includes("A free trial has already been used"),
      "Supabase RPC error is thrown transparently"
    );
  }

  (supabase as any).rpc = originalRpc;
}

// -------------------------------------------------------------
// Test 5: getCurrentCompanySubscription Query Structure & Filters
// -------------------------------------------------------------
console.log("\n5. getCurrentCompanySubscription Filters & Isolation");

async function testSubscriptionQuery() {
  const originalFrom = supabase.from;
  let capturedTable = "";
  let capturedSelect = "";
  let capturedEq: { col: string; val: any } | null = null;
  let capturedIn: { col: string; vals: any[] } | null = null;
  let capturedOrder: { col: string; asc: boolean } | null = null;
  let capturedLimit = 0;

  const mockQueryBuilder = {
    select(cols: string) {
      capturedSelect = cols;
      return this;
    },
    eq(col: string, val: any) {
      capturedEq = { col, val };
      return this;
    },
    in(col: string, vals: any[]) {
      capturedIn = { col, vals };
      return this;
    },
    order(col: string, opts: { ascending: boolean }) {
      capturedOrder = { col, asc: opts.ascending };
      return this;
    },
    limit(num: number) {
      capturedLimit = num;
      return this;
    },
    async maybeSingle() {
      return {
        data: {
          id: "sub-active-1",
          company_id: capturedEq?.val,
          plan_id: "plan-1",
          subscription_reference: "SUB-2026-TEST",
          status: "expired",
          amount_minor: 500000,
          currency: "ZAR",
          auto_renew_enabled: false,
          plan: {
            id: "plan-1",
            code: "business-monthly",
            name: "Business Subscription Plan",
            amount_minor: 500000,
            currency: "ZAR",
            billing_interval: "monthly",
            trial_duration_minutes: 5,
            cancel_anytime: true,
            is_active: true,
          },
        },
        error: null,
      };
    },
  };

  (supabase as any).from = (table: string) => {
    capturedTable = table;
    return mockQueryBuilder;
  };

  // 1. Empty company ID rejection
  try {
    await getCurrentCompanySubscription("");
    assert(false, "Empty company ID should throw");
  } catch (e: any) {
    assert(e.message.includes("Company ID is required"), "Empty company ID rejected");
  }

  // 2. Query execution
  const subResult = await getCurrentCompanySubscription("company-alpha-123");
  assert(capturedTable === "billing_subscriptions", "Queries 'billing_subscriptions' table");
  assert(capturedEq?.col === "company_id" && capturedEq?.val === "company-alpha-123", "Filters strictly to requested company_id");
  assert(capturedIn?.col === "status", "Filters current and recoverable subscription statuses");
  assert(JSON.stringify(capturedIn?.vals) === JSON.stringify(["pending_activation","trialing","active","non_renewing","past_due","expired"]), "Includes expired subscriptions needed for billing recovery");
  assert(capturedOrder?.col === "created_at" && capturedOrder?.asc === false, "Orders by created_at DESC");
  assert(capturedLimit === 1, "Limits to 1 row");
  assert(capturedSelect.includes("plan:billing_plans"), "Joins plan with billing_plans");
  assert(subResult?.company_id === "company-alpha-123", "Returns typed subscription-with-plan");

  assert(subResult?.status === "expired", "Returns expired subscription for recovery");

  // 3. Null return handling
  mockQueryBuilder.maybeSingle = async () => ({ data: null, error: null });
  const emptyRes = await getCurrentCompanySubscription("company-without-sub");
  assert(emptyRes === null, "Returns null when no subscription exists");

  // 4. Malformed joined-subscription rejection
  (mockQueryBuilder as any).maybeSingle = async () => ({
    data: {
      id: "sub-malformed-1",
      // missing company_id, amount_minor, etc.
      status: "trialing",
    },
    error: null,
  });
  try {
    await getCurrentCompanySubscription("company-alpha-123");
    assert(false, "Malformed subscription should throw error");
  } catch (e: any) {
    assert(e.message.includes("Malformed subscription data"), "Malformed subscription rejected with controlled error");
  }

  // 5. Malformed plan inside joined-subscription rejection
  (mockQueryBuilder as any).maybeSingle = async () => ({
    data: {
      id: "sub-valid-1",
      company_id: "company-alpha-123",
      plan_id: "plan-1",
      subscription_reference: "SUB-123",
      status: "trialing",
      amount_minor: 500000,
      currency: "ZAR",
      auto_renew_enabled: false,
      plan: {
        id: "plan-1",
        code: "invalid-plan",
        // missing required fields
      },
    },
    error: null,
  });
  try {
    await getCurrentCompanySubscription("company-alpha-123");
    assert(false, "Malformed joined plan should throw error");
  } catch (e: any) {
    assert(e.message.includes("Malformed subscription data"), "Malformed joined plan rejected with controlled error");
  }

  (supabase as any).from = originalFrom;
}

// -------------------------------------------------------------
// Test 6: getActiveBillingPlan Query Structure
// -------------------------------------------------------------
console.log("\n6. getActiveBillingPlan Query Structure & Validation");

async function testGetActiveBillingPlan() {
  const originalFrom = supabase.from;
  let capturedTable = "";
  let capturedFilters: Array<{ col: string; val: any }> = [];

  const mockQueryBuilder = {
    select(_cols: string) {
      return this;
    },
    eq(col: string, val: any) {
      capturedFilters.push({ col, val });
      return this;
    },
    async maybeSingle(): Promise<any> {
      return {
        data: {
          id: "plan-biz",
          code: "business-monthly",
          name: "Business Subscription Plan",
          amount_minor: 500000,
          currency: "ZAR",
          billing_interval: "monthly",
          trial_duration_minutes: 5,
          cancel_anytime: true,
          is_active: true,
          paystack_plan_code: null,
        },
        error: null,
      };
    },
  };

  (supabase as any).from = (table: string) => {
    capturedTable = table;
    capturedFilters = [];
    return mockQueryBuilder;
  };

  const plan = await getActiveBillingPlan();
  assert(capturedTable === "billing_plans", "Queries 'billing_plans' table");
  assert(
    capturedFilters.some((f) => f.col === "code" && f.val === "business-monthly"),
    "Queries code 'business-monthly' by default"
  );
  assert(
    capturedFilters.some((f) => f.col === "is_active" && f.val === true),
    "Filters by is_active = true"
  );
  assert(plan?.trial_duration_minutes === 5, "Returns plan with trial_duration_minutes = 5");

  // Malformed plan rejection
  (mockQueryBuilder as any).maybeSingle = async () => ({
    data: {
      id: "plan-invalid",
      code: "invalid-plan",
      // missing name, amount_minor, currency, etc.
    },
    error: null,
  });

  try {
    await getActiveBillingPlan();
    assert(false, "Malformed plan should throw error");
  } catch (e: any) {
    assert(e.message.includes("Malformed billing plan data"), "Malformed billing plan rejected with controlled error");
  }

  (supabase as any).from = originalFrom;
}

async function runAll() {
  await testPreconditions();
  await testRpcParameters();
  await testResultNormalization();
  await testSubscriptionQuery();
  await testGetActiveBillingPlan();

  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll();
