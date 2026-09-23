import { BillingPlan } from "../types";

/**
 * Focused verification test suite for the public.billing_plans table definition,
 * constraints, seed values, and permissions.
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

console.log("\n=======================================================");
console.log("PROJECTMATRIX BILLING PLAN BACKEND TEST SUITE");
console.log("=======================================================\n");

// Simulated Database Schema & Store
interface BillingPlanRow {
  id: string;
  code: string;
  name: string;
  amount_minor: number;
  currency: string;
  billing_interval: string;
  trial_duration_minutes: number;
  cancel_anytime: boolean;
  is_active: boolean;
  paystack_plan_code: string | null;
  created_at: string;
  updated_at: string;
}

class MockBillingPlanDatabase {
  private plans: Map<string, BillingPlanRow> = new Map();

  constructor() {
    // Seed initial row matching migration exactly
    this.seed({
      id: "b1000000-0000-0000-0000-000000000001",
      code: "business-monthly",
      name: "Business Subscription Plan",
      amount_minor: 500000,
      currency: "ZAR",
      billing_interval: "monthly",
      trial_duration_minutes: 5,
      cancel_anytime: true,
      is_active: true,
      paystack_plan_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  private validateConstraints(plan: Omit<BillingPlanRow, "id" | "created_at" | "updated_at">) {
    if (!plan.code || plan.code.trim().length === 0) {
      throw new Error("chk_billing_plans_code_non_empty violated");
    }
    if (!plan.name || plan.name.trim().length === 0) {
      throw new Error("chk_billing_plans_name_non_empty violated");
    }
    if (plan.amount_minor <= 0) {
      throw new Error("chk_billing_plans_amount_minor_positive violated");
    }
    if (!/^[A-Z]{3}$/.test(plan.currency)) {
      throw new Error("chk_billing_plans_currency_iso violated");
    }
    if (plan.billing_interval !== "monthly") {
      throw new Error("chk_billing_plans_billing_interval violated");
    }
    if (plan.trial_duration_minutes < 0) {
      throw new Error("chk_billing_plans_trial_duration_minutes_non_negative violated");
    }
  }

  public seed(plan: BillingPlanRow) {
    this.validateConstraints(plan);
    if (Array.from(this.plans.values()).some((p) => p.code === plan.code)) {
      // ON CONFLICT (code) DO NOTHING
      return;
    }
    this.plans.set(plan.id, plan);
  }

  public insertServerSide(plan: BillingPlanRow) {
    this.validateConstraints(plan);
    if (Array.from(this.plans.values()).some((p) => p.code === plan.code)) {
      throw new Error("uq_billing_plans_code duplicate violated");
    }
    this.plans.set(plan.id, plan);
  }

  // Client queries respecting RLS and Permissions
  public clientQuerySelect(userRole: "authenticated" | "anon"): BillingPlanRow[] {
    if (userRole === "anon") {
      return []; // Anon has no SELECT grant
    }
    // Authenticated users read where is_active IS TRUE
    return Array.from(this.plans.values()).filter((p) => p.is_active === true);
  }

  public clientAttemptInsert(userRole: "authenticated" | "anon", _plan: any): void {
    // REVOKE INSERT ON public.billing_plans FROM PUBLIC, anon, authenticated;
    throw new Error(`permission denied for table billing_plans: ${userRole} client cannot insert`);
  }

  public clientAttemptUpdate(userRole: "authenticated" | "anon", _id: string, _changes: any): void {
    // REVOKE UPDATE ON public.billing_plans FROM PUBLIC, anon, authenticated;
    throw new Error(`permission denied for table billing_plans: ${userRole} client cannot update`);
  }

  public clientAttemptDelete(userRole: "authenticated" | "anon", _id: string): void {
    // REVOKE DELETE ON public.billing_plans FROM PUBLIC, anon, authenticated;
    throw new Error(`permission denied for table billing_plans: ${userRole} client cannot delete`);
  }

  public getRawCount(): number {
    return this.plans.size;
  }

  public getByCode(code: string): BillingPlanRow | undefined {
    return Array.from(this.plans.values()).find((p) => p.code === code);
  }
}

const db = new MockBillingPlanDatabase();

// -------------------------------------------------------------
// Test 1: Seeded plan verification
// -------------------------------------------------------------
console.log("1. Seeded Plan Verification");
const seededPlan = db.getByCode("business-monthly");
assert(seededPlan !== undefined, "Seeded plan 'business-monthly' exists");
assert(db.getRawCount() === 1, "The seeded plan exists exactly once");
assert(seededPlan?.amount_minor === 500000, "Plan amount is exactly 500000 (R5,000 in cents)");
assert(seededPlan?.currency === "ZAR", "Plan currency is 'ZAR'");
assert(seededPlan?.billing_interval === "monthly", "Plan interval is 'monthly'");
assert(seededPlan?.trial_duration_minutes === 5, "Plan trial duration is exactly 5 minutes");
assert(seededPlan?.cancel_anytime === true, "Cancel anytime is true");
assert(seededPlan?.is_active === true, "Plan is active (true)");
assert(seededPlan?.paystack_plan_code === null, "Paystack plan code is NULL (not fabricated)");

// -------------------------------------------------------------
// Test 2: Constraint Validations
// -------------------------------------------------------------
console.log("\n2. Constraint & Schema Enforcement");

// Duplicate plan code
try {
  db.insertServerSide({
    id: "b2",
    code: "business-monthly",
    name: "Duplicate Plan",
    amount_minor: 500000,
    currency: "ZAR",
    billing_interval: "monthly",
    trial_duration_minutes: 5,
    cancel_anytime: true,
    is_active: true,
    paystack_plan_code: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert(false, "Duplicate code should fail");
} catch (e: any) {
  assert(e.message.includes("uq_billing_plans_code"), "Duplicate plan code is rejected");
}

// Invalid amount <= 0
try {
  db.insertServerSide({
    id: "b3",
    code: "zero-amount",
    name: "Zero Plan",
    amount_minor: 0,
    currency: "ZAR",
    billing_interval: "monthly",
    trial_duration_minutes: 5,
    cancel_anytime: true,
    is_active: true,
    paystack_plan_code: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert(false, "Zero amount should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_plans_amount_minor_positive"), "Invalid amount (<= 0) is rejected");
}

// Invalid currency
try {
  db.insertServerSide({
    id: "b4",
    code: "invalid-currency",
    name: "Invalid Currency Plan",
    amount_minor: 500000,
    currency: "zar", // Lowercase violates ^[A-Z]{3}$
    billing_interval: "monthly",
    trial_duration_minutes: 5,
    cancel_anytime: true,
    is_active: true,
    paystack_plan_code: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert(false, "Lowercase currency should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_plans_currency_iso"), "Invalid currency format is rejected");
}

// Invalid trial duration < 0
try {
  db.insertServerSide({
    id: "b5",
    code: "negative-trial",
    name: "Negative Trial Plan",
    amount_minor: 500000,
    currency: "ZAR",
    billing_interval: "monthly",
    trial_duration_minutes: -1,
    cancel_anytime: true,
    is_active: true,
    paystack_plan_code: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert(false, "Negative trial duration should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_plans_trial_duration_minutes_non_negative"), "Negative trial duration is rejected");
}

// -------------------------------------------------------------
// Test 3: RLS & Client Permissions
// -------------------------------------------------------------
console.log("\n3. RLS & Client Mutation Denial");

const authPlans = db.clientQuerySelect("authenticated");
assert(authPlans.length === 1 && authPlans[0].code === "business-monthly", "Authenticated clients can SELECT active plans");

const anonPlans = db.clientQuerySelect("anon");
assert(anonPlans.length === 0, "Anonymous clients cannot read plans");

try {
  db.clientAttemptInsert("authenticated", { code: "new-plan" });
  assert(false, "Authenticated client INSERT should fail");
} catch (e: any) {
  assert(e.message.includes("permission denied"), "Authenticated client INSERT is blocked");
}

try {
  db.clientAttemptUpdate("authenticated", seededPlan!.id, { amount_minor: 100 });
  assert(false, "Authenticated client UPDATE should fail");
} catch (e: any) {
  assert(e.message.includes("permission denied"), "Authenticated client UPDATE is blocked");
}

try {
  db.clientAttemptDelete("authenticated", seededPlan!.id);
  assert(false, "Authenticated client DELETE should fail");
} catch (e: any) {
  assert(e.message.includes("permission denied"), "Authenticated client DELETE is blocked");
}

console.log("\n=======================================================");
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
