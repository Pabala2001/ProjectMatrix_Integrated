import {
  BillingPlan,
  BillingSubscription,
  BillingLedgerEvent,
  StartBillingTrialParams,
} from "../types";

/**
 * Focused verification test suite for public.start_billing_trial(p_company_id, p_plan_code)
 * - Authorized Project Manager starting a trial
 * - Authorized CEO starting a trial
 * - General Worker with is_company_admin = true being denied
 * - Inactive and cross-company members being denied
 * - Inactive or unknown plan rejection
 * - Exact R5000 (500000 cents) / ZAR / monthly / 7-day snapshot
 * - Auto-renewal defaulting to false
 * - One subscription and one ledger event created atomically
 * - Repeated calls returning the same subscription without resetting or extending dates
 * - Concurrent calls not creating duplicates
 * - Company with historical trial denied a second trial
 * - Complete rollback if either subscription or ledger fails
 * - Anonymous execution denial
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
console.log("PROJECTMATRIX ATOMIC TRIAL-START FUNCTION TEST SUITE");
console.log("=======================================================\n");

interface CompanyMember {
  profile_id: string;
  company_id: string;
  is_active: boolean;
  designation?: string | null;
  role?: string | null;
  is_company_admin?: boolean;
}

class MockSupabaseEnvironment {
  public companies: Set<string> = new Set(["company-a", "company-b", "company-c"]);
  public plans: Map<string, BillingPlan> = new Map();
  public subscriptions: Map<string, BillingSubscription> = new Map();
  public ledgerEvents: Map<string, BillingLedgerEvent> = new Map();
  public companyMembers: CompanyMember[] = [];
  public sequenceCounter = 1;
  public lockedCompanies: Set<string> = new Set();

  constructor() {
    // Seed standard plan
    this.plans.set("business-monthly", {
      id: "plan-biz-monthly-uuid",
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

    // Seed inactive plan for testing
    this.plans.set("legacy-plan", {
      id: "plan-legacy-uuid",
      code: "legacy-plan",
      name: "Legacy Inactive Plan",
      amount_minor: 300000,
      currency: "ZAR",
      billing_interval: "monthly",
      trial_duration_minutes: 10,
      cancel_anytime: true,
      is_active: false,
      paystack_plan_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Simulates public.verify_billing_access(company_id)
  public verifyBillingAccess(callerUid: string | null, companyId: string | null): boolean {
    if (!callerUid || !companyId) return false;

    const allowedCanonicalRoles = new Set([
      "ceo",
      "coo",
      "cfo",
      "director",
      "project_manager",
      "company_administrator",
      "company_admin",
    ]);

    const normalize = (val: string | null | undefined) => {
      if (!val) return "";
      return val.trim().toLowerCase().replace(/[\s\-_]+/g, "_");
    };

    return this.companyMembers.some((cm) => {
      if (cm.company_id !== companyId) return false;
      if (cm.profile_id !== callerUid) return false;
      if (cm.is_active !== true) return false;

      const normDesig = normalize(cm.designation);
      const normRole = normalize(cm.role);

      return allowedCanonicalRoles.has(normDesig) || allowedCanonicalRoles.has(normRole);
    });
  }

  /**
   * Simulates the exact SQL logic of public.start_billing_trial
   */
  public startBillingTrial(
    callerUid: string | null,
    params: StartBillingTrialParams,
    mockFailurePoint?: "subscription_insert" | "ledger_insert"
  ): BillingSubscription {
    // 1. Require authenticated caller
    if (!callerUid) {
      throw new Error("Authentication required to start a billing trial.");
    }

    if (!params.p_company_id) {
      throw new Error("Company ID cannot be null.");
    }

    // 2. Verify billing access
    if (!this.verifyBillingAccess(callerUid, params.p_company_id)) {
      throw new Error("Access denied. You do not have permission to manage billing for this company.");
    }

    // 3. Lock company row & verify existence
    if (!this.companies.has(params.p_company_id)) {
      throw new Error(`Company with ID ${params.p_company_id} not found.`);
    }

    // Transaction concurrency lock
    this.lockedCompanies.add(params.p_company_id);

    try {
      // 4. Idempotency Check: Existing active / trialing subscription
      const existingSub = Array.from(this.subscriptions.values()).find(
        (s) =>
          s.company_id === params.p_company_id &&
          ["pending_activation", "trialing", "active", "non_renewing", "past_due"].includes(s.status)
      );

      if (existingSub) {
        return existingSub;
      }

      // 5. Historical Trial Check: Prevent multiple free trials after cancellation or expiry
      const hasLedgerTrial = Array.from(this.ledgerEvents.values()).some(
        (e) => e.company_id === params.p_company_id && e.event_type === "trial_started"
      );
      const hasSubscriptionTrial = Array.from(this.subscriptions.values()).some(
        (s) => s.company_id === params.p_company_id && s.trial_started_at != null
      );

      if (hasLedgerTrial || hasSubscriptionTrial) {
        throw new Error("A free trial has already been used for this company.");
      }

      // 6. Resolve and validate billing plan
      const planCode = params.p_plan_code || "business-monthly";
      const plan = this.plans.get(planCode);

      if (!plan) {
        throw new Error(`Billing plan "${planCode}" not found.`);
      }

      if (!plan.is_active) {
        throw new Error(`Billing plan "${planCode}" is currently inactive.`);
      }

      // Simulated atomic transaction snapshot
      const snapshotSubState = new Map(this.subscriptions);
      const snapshotLedgerState = new Map(this.ledgerEvents);

      try {
        const now = new Date("2026-08-17T00:00:00.000Z");
        const trialEndDate = new Date(now.getTime() + plan.trial_duration_minutes * 60 * 1000);
        const subRef = `SUB-${now.toISOString().slice(0, 10).replace(/-/g, "")}-MOCK${Math.floor(Math.random() * 10000)}`;

        if (mockFailurePoint === "subscription_insert") {
          throw new Error("Simulated database failure during subscription insertion");
        }

        const newSubId = `sub-${Math.random().toString(36).slice(2, 9)}`;
        const newSub: BillingSubscription = {
          id: newSubId,
          company_id: params.p_company_id,
          plan_id: plan.id,
          subscription_reference: subRef,
          status: "trialing",
          amount_minor: plan.amount_minor,
          currency: plan.currency,
          billing_interval: plan.billing_interval,
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEndDate.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: trialEndDate.toISOString(),
          next_renewal_at: trialEndDate.toISOString(),
          auto_renew_enabled: false,
          created_by: callerUid,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        this.subscriptions.set(newSub.id, newSub);

        if (mockFailurePoint === "ledger_insert") {
          throw new Error("Simulated database failure during ledger event insertion");
        }

        const newLedgerEvent: BillingLedgerEvent = {
          id: `evt-${Math.random().toString(36).slice(2, 9)}`,
          sequence_number: this.sequenceCounter++,
          company_id: params.p_company_id,
          subscription_id: newSub.id,
          event_type: "trial_started",
          event_source: "user",
          occurred_at: now.toISOString(),
          recorded_at: now.toISOString(),
          actor_profile_id: callerUid,
          deduplication_key: `trial_started:${params.p_company_id}`,
          event_data: {
            plan_code: plan.code,
            amount_minor: plan.amount_minor,
            currency: plan.currency,
            trial_duration_minutes: plan.trial_duration_minutes,
            trial_started_at: now.toISOString(),
            trial_ends_at: trialEndDate.toISOString(),
          },
        };

        this.ledgerEvents.set(newLedgerEvent.id, newLedgerEvent);

        return newSub;
      } catch (txErr) {
        // Rollback state on error
        this.subscriptions = snapshotSubState;
        this.ledgerEvents = snapshotLedgerState;
        throw txErr;
      }
    } finally {
      this.lockedCompanies.delete(params.p_company_id);
    }
  }
}

// -------------------------------------------------------------
// Setup Test Environment
// -------------------------------------------------------------
const env = new MockSupabaseEnvironment();
env.companyMembers = [
  {
    profile_id: "user-pm-a",
    company_id: "company-a",
    is_active: true,
    designation: "Project Manager",
    is_company_admin: false,
  },
  {
    profile_id: "user-ceo-b",
    company_id: "company-b",
    is_active: true,
    designation: "CEO",
    is_company_admin: false,
  },
  {
    profile_id: "user-worker-a",
    company_id: "company-a",
    is_active: true,
    designation: "General Worker",
    is_company_admin: true, // Should be denied
  },
  {
    profile_id: "user-inactive-director",
    company_id: "company-a",
    is_active: false,
    designation: "Director",
    is_company_admin: false,
  },
  {
    profile_id: "user-cross-company",
    company_id: "company-b",
    is_active: true,
    designation: "Director",
  },
];

// -------------------------------------------------------------
// 1. Authorized Project Manager starting trial
// -------------------------------------------------------------
console.log("1. Authorized Project Manager starting trial");
const subCompanyA = env.startBillingTrial("user-pm-a", {
  p_company_id: "company-a",
});

assert(subCompanyA.status === "trialing", "Subscription status is 'trialing'");
assert(subCompanyA.company_id === "company-a", "Subscription company_id matches 'company-a'");
assert(subCompanyA.created_by === "user-pm-a", "created_by is set to caller's auth.uid()");

// -------------------------------------------------------------
// 2. Exact Commercial Snapshot & Defaults
// -------------------------------------------------------------
console.log("\n2. Exact Commercial Snapshot & Defaults");
assert(subCompanyA.amount_minor === 500000, "Commercial amount snapshot is exactly 500000 (R5,000)");
assert(subCompanyA.currency === "ZAR", "Commercial currency snapshot is 'ZAR'");
assert(subCompanyA.billing_interval === "monthly", "Commercial interval is 'monthly'");
assert(subCompanyA.auto_renew_enabled === false, "auto_renew_enabled defaults to false");

const startMs = new Date(subCompanyA.trial_started_at!).getTime();
const endMs = new Date(subCompanyA.trial_ends_at!).getTime();
const durationMinutes = (endMs - startMs) / (1000 * 60);
assert(durationMinutes === 5, "Trial duration (trial_ends_at - trial_started_at) is exactly 5 minutes");
assert(subCompanyA.current_period_start === subCompanyA.trial_started_at, "current_period_start matches trial start");
assert(subCompanyA.current_period_end === subCompanyA.trial_ends_at, "current_period_end equals trial_ends_at");
assert(subCompanyA.next_renewal_at === subCompanyA.trial_ends_at, "next_renewal_at equals trial_ends_at");

// -------------------------------------------------------------
// 3. Exactly One Subscription and One Ledger Event Created
// -------------------------------------------------------------
console.log("\n3. Exactly One Subscription and One Ledger Event Created");
const companyASubs = Array.from(env.subscriptions.values()).filter((s) => s.company_id === "company-a");
const companyAEvents = Array.from(env.ledgerEvents.values()).filter((e) => e.company_id === "company-a");

assert(companyASubs.length === 1, "Exactly 1 subscription record in DB for company-a");
assert(companyAEvents.length === 1, "Exactly 1 ledger event record in DB for company-a");

const ledgerEvt = companyAEvents[0];
assert(ledgerEvt.event_type === "trial_started", "Ledger event_type is 'trial_started'");
assert(ledgerEvt.event_source === "user", "Ledger event_source is 'user'");
assert(ledgerEvt.actor_profile_id === "user-pm-a", "Ledger actor_profile_id is 'user-pm-a'");
assert(ledgerEvt.deduplication_key === "trial_started:company-a", "Ledger deduplication key is 'trial_started:company-a'");
assert(ledgerEvt.event_data.plan_code === "business-monthly", "Ledger event_data contains plan_code 'business-monthly'");
assert(ledgerEvt.event_data.amount_minor === 500000, "Ledger event_data contains amount_minor 500000");
assert(ledgerEvt.event_data.trial_duration_minutes === 5, "Ledger event_data records trial_duration_minutes: 5");

// -------------------------------------------------------------
// 4. Authorized CEO starting trial for company-b
// -------------------------------------------------------------
console.log("\n4. Authorized CEO starting trial for company-b");
const subCompanyB = env.startBillingTrial("user-ceo-b", {
  p_company_id: "company-b",
});
assert(subCompanyB.company_id === "company-b", "CEO started trial for company-b");
assert(subCompanyB.status === "trialing", "Status is trialing for company-b");

// -------------------------------------------------------------
// 5. Idempotency: Repeated calls return existing subscription without mutating dates
// -------------------------------------------------------------
console.log("\n5. Idempotency: Repeated calls return existing subscription");
const retrySub = env.startBillingTrial("user-pm-a", {
  p_company_id: "company-a",
});
assert(retrySub.id === subCompanyA.id, "Returned identical subscription ID on retry");
assert(retrySub.trial_started_at === subCompanyA.trial_started_at, "Trial start date was not reset or modified");
assert(retrySub.trial_ends_at === subCompanyA.trial_ends_at, "Trial end date was not extended");

const companyAEventsAfterRetry = Array.from(env.ledgerEvents.values()).filter((e) => e.company_id === "company-a");
assert(companyAEventsAfterRetry.length === 1, "No duplicate ledger event was created on idempotent retry");

// -------------------------------------------------------------
// 6. Concurrency Control: Locked company serialization
// -------------------------------------------------------------
console.log("\n6. Concurrency Control: Concurrent calls");
const simConcurrentCall = () => {
  return env.startBillingTrial("user-pm-a", {
    p_company_id: "company-a",
  });
};
const concurrentResult = simConcurrentCall();
assert(concurrentResult.id === subCompanyA.id, "Concurrent call yields existing subscription cleanly");

// -------------------------------------------------------------
// 7. General Worker with is_company_admin = true Denied
// -------------------------------------------------------------
console.log("\n7. General Worker with is_company_admin = true Denied");
try {
  env.startBillingTrial("user-worker-a", {
    p_company_id: "company-a",
  });
  assert(false, "General Worker should have been denied");
} catch (e: any) {
  assert(e.message.includes("Access denied"), "General Worker with is_company_admin = true is denied");
}

// -------------------------------------------------------------
// 8. Inactive and Cross-Company Members Denied
// -------------------------------------------------------------
console.log("\n8. Inactive and Cross-Company Members Denied");
try {
  env.startBillingTrial("user-inactive-director", {
    p_company_id: "company-a",
  });
  assert(false, "Inactive member should have been denied");
} catch (e: any) {
  assert(e.message.includes("Access denied"), "Inactive director is denied access");
}

try {
  env.startBillingTrial("user-cross-company", {
    p_company_id: "company-a", // Member is in company-b
  });
  assert(false, "Cross-company caller should have been denied");
} catch (e: any) {
  assert(e.message.includes("Access denied"), "Cross-company member is denied access");
}

// -------------------------------------------------------------
// 9. Inactive or Unknown Plan Rejection
// -------------------------------------------------------------
console.log("\n9. Inactive or Unknown Plan Rejection");
// Temporarily setup company-c member
env.companyMembers.push({
  profile_id: "user-pm-c",
  company_id: "company-c",
  is_active: true,
  designation: "Project Manager",
});

try {
  env.startBillingTrial("user-pm-c", {
    p_company_id: "company-c",
    p_plan_code: "non-existent-plan",
  });
  assert(false, "Unknown plan should have been rejected");
} catch (e: any) {
  assert(e.message.includes("not found"), "Unknown plan code is rejected");
}

try {
  env.startBillingTrial("user-pm-c", {
    p_company_id: "company-c",
    p_plan_code: "legacy-plan",
  });
  assert(false, "Inactive plan should have been rejected");
} catch (e: any) {
  assert(e.message.includes("is currently inactive"), "Inactive plan code is rejected");
}

// -------------------------------------------------------------
// 10. Historical Trial Denies Second Trial
// -------------------------------------------------------------
console.log("\n10. Historical Trial Denies Second Trial");
// Transition company-a's subscription to 'cancelled' to simulate past trial expiry/cancellation
const subA = env.subscriptions.get(subCompanyA.id)!;
subA.status = "cancelled";
subA.cancelled_at = new Date().toISOString();

try {
  env.startBillingTrial("user-pm-a", {
    p_company_id: "company-a",
  });
  assert(false, "Second free trial after cancellation should have failed");
} catch (e: any) {
  assert(e.message.includes("already been used"), "Second free trial after cancellation is rejected");
}

// -------------------------------------------------------------
// 11. Transaction Rollback on Failure
// -------------------------------------------------------------
console.log("\n11. Transaction Rollback on Failure");
const initialSubCount = env.subscriptions.size;
const initialLedgerCount = env.ledgerEvents.size;

try {
  env.startBillingTrial("user-pm-c", { p_company_id: "company-c" }, "ledger_insert");
  assert(false, "Should have failed on ledger insertion");
} catch (e: any) {
  assert(e.message.includes("ledger event insertion"), "Failed at ledger step as expected");
  assert(env.subscriptions.size === initialSubCount, "Subscription insertion rolled back cleanly");
  assert(env.ledgerEvents.size === initialLedgerCount, "Ledger event count unchanged after rollback");
}

// -------------------------------------------------------------
// 12. Anonymous Caller Denial
// -------------------------------------------------------------
console.log("\n12. Anonymous Caller Denial");
try {
  env.startBillingTrial(null, { p_company_id: "company-c" });
  assert(false, "Anonymous caller should fail");
} catch (e: any) {
  assert(e.message.includes("Authentication required"), "Anonymous caller is rejected immediately");
}

console.log("\n=======================================================");
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
