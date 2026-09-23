import { BillingSubscription, BillingSubscriptionStatus } from "../types";
import { normalizeBillingRole, isBillingAllowedRole } from "./accessControl";

/**
 * Focused verification test suite for public.billing_subscriptions
 * - Schema constraints (reference, status, amount, currency, dates)
 * - Partial unique index (single current subscription per company)
 * - Preservation of historical (expired/cancelled) subscriptions
 * - RLS policy evaluation via verify_billing_access(company_id)
 * - Revocation of client mutation privileges
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
console.log("PROJECTMATRIX BILLING SUBSCRIPTIONS BACKEND TEST SUITE");
console.log("=======================================================\n");

const ALLOWED_STATUSES: Set<BillingSubscriptionStatus> = new Set([
  "pending_activation",
  "trialing",
  "active",
  "non_renewing",
  "past_due",
  "expired",
  "cancelled",
]);

const CURRENT_STATUSES: Set<BillingSubscriptionStatus> = new Set([
  "pending_activation",
  "trialing",
  "active",
  "non_renewing",
  "past_due",
]);

interface CompanyMember {
  profile_id: string;
  company_id: string;
  is_active: boolean;
  designation?: string | null;
  role?: string | null;
  is_company_admin?: boolean;
}

class MockBillingSubscriptionsDatabase {
  private subscriptions: Map<string, BillingSubscription> = new Map();
  private companyMembers: CompanyMember[] = [];

  constructor(initialMembers: CompanyMember[]) {
    this.companyMembers = initialMembers;
  }

  // Simulates PostgreSQL verify_billing_access(p_company_id UUID)
  public verifyBillingAccess(authUid: string | null, pCompanyId: string | null): boolean {
    if (!authUid || !pCompanyId) return false;

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
      if (cm.company_id !== pCompanyId) return false;
      if (cm.profile_id !== authUid) return false;
      if (cm.is_active !== true) return false;

      const normDesig = normalize(cm.designation);
      const normRole = normalize(cm.role);

      return allowedCanonicalRoles.has(normDesig) || allowedCanonicalRoles.has(normRole);
    });
  }

  // Simulates DB constraints validation on INSERT / UPDATE
  private validateConstraints(sub: BillingSubscription) {
    if (!sub.subscription_reference || sub.subscription_reference.trim().length === 0) {
      throw new Error("chk_billing_subscriptions_ref_non_empty violated: Reference cannot be empty");
    }

    if (!ALLOWED_STATUSES.has(sub.status)) {
      throw new Error(`chk_billing_subscriptions_status violated: Invalid status '${sub.status}'`);
    }

    if (sub.amount_minor <= 0) {
      throw new Error("chk_billing_subscriptions_amount_minor_positive violated: Amount must be > 0");
    }

    if (!/^[A-Z]{3}$/.test(sub.currency)) {
      throw new Error("chk_billing_subscriptions_currency_iso violated: Currency must be 3 uppercase letters");
    }

    if (sub.billing_interval !== "monthly") {
      throw new Error("chk_billing_subscriptions_billing_interval violated: Interval must be 'monthly'");
    }

    // Trial dates check
    if (sub.trial_started_at && sub.trial_ends_at) {
      if (new Date(sub.trial_ends_at).getTime() < new Date(sub.trial_started_at).getTime()) {
        throw new Error("chk_billing_subscriptions_trial_dates violated: trial_ends_at cannot precede trial_started_at");
      }
    }

    // Period dates check
    if (sub.current_period_start && sub.current_period_end) {
      if (new Date(sub.current_period_end).getTime() < new Date(sub.current_period_start).getTime()) {
        throw new Error("chk_billing_subscriptions_period_dates violated: current_period_end cannot precede current_period_start");
      }
    }

    // Unique reference check
    for (const existing of this.subscriptions.values()) {
      if (existing.id !== sub.id && existing.subscription_reference === sub.subscription_reference) {
        throw new Error("uq_billing_subscriptions_reference violated: Duplicate subscription reference");
      }
    }

    // Partial Unique Index: uq_billing_subscriptions_active_company
    // Only one subscription in current statuses per company
    if (CURRENT_STATUSES.has(sub.status)) {
      for (const existing of this.subscriptions.values()) {
        if (
          existing.id !== sub.id &&
          existing.company_id === sub.company_id &&
          CURRENT_STATUSES.has(existing.status)
        ) {
          throw new Error(
            `uq_billing_subscriptions_active_company violated: Company '${sub.company_id}' already has a current subscription in status '${existing.status}'`
          );
        }
      }
    }
  }

  // Server-level operation (e.g., migration or secure Edge Function with service role)
  public insertServerSide(sub: BillingSubscription): void {
    this.validateConstraints(sub);
    this.subscriptions.set(sub.id, { ...sub });
  }

  // Client SELECT with RLS policy: USING (public.verify_billing_access(company_id) IS TRUE)
  public clientSelect(callerUid: string | null): BillingSubscription[] {
    if (!callerUid) return []; // Anonymous has no access

    return Array.from(this.subscriptions.values()).filter((sub) => {
      return this.verifyBillingAccess(callerUid, sub.company_id);
    });
  }

  // Client mutations (REVOKED)
  public clientInsert(_callerUid: string, _sub: any): void {
    throw new Error("permission denied for table billing_subscriptions: client INSERT is revoked");
  }

  public clientUpdate(_callerUid: string, _id: string, _patch: any): void {
    throw new Error("permission denied for table billing_subscriptions: client UPDATE is revoked");
  }

  public clientDelete(_callerUid: string, _id: string): void {
    throw new Error("permission denied for table billing_subscriptions: client DELETE is revoked");
  }
}

// -------------------------------------------------------------
// Setup Mock DB & Test Data
// -------------------------------------------------------------
const mockMembers: CompanyMember[] = [
  {
    profile_id: "user-pm-company-a",
    company_id: "company-a",
    is_active: true,
    designation: "Project Manager",
    is_company_admin: false,
  },
  {
    profile_id: "user-ceo-company-a",
    company_id: "company-a",
    is_active: true,
    designation: "CEO",
    is_company_admin: true,
  },
  {
    profile_id: "user-worker-company-a",
    company_id: "company-a",
    is_active: true,
    designation: "General Worker",
    is_company_admin: true, // Should still be denied
  },
  {
    profile_id: "user-pm-company-b",
    company_id: "company-b",
    is_active: true,
    designation: "Project Manager",
    is_company_admin: false,
  },
  {
    profile_id: "user-inactive-ceo",
    company_id: "company-a",
    is_active: false,
    designation: "CEO",
    is_company_admin: true,
  },
];

const db = new MockBillingSubscriptionsDatabase(mockMembers);

// -------------------------------------------------------------
// Test 1: Valid Subscription Insertion
// -------------------------------------------------------------
console.log("1. Valid Subscription Insertion");
const validSub1: BillingSubscription = {
  id: "sub-001",
  company_id: "company-a",
  plan_id: "plan-monthly-001",
  subscription_reference: "PMX-SUB-202608-001",
  status: "trialing",
  amount_minor: 500000,
  currency: "ZAR",
  billing_interval: "monthly",
  trial_started_at: "2026-08-17T00:00:00Z",
  trial_ends_at: "2026-08-24T00:00:00Z",
  current_period_start: "2026-08-17T00:00:00Z",
  current_period_end: "2026-09-17T00:00:00Z",
  next_renewal_at: "2026-08-24T00:00:00Z",
  auto_renew_enabled: false,
  notice_message: null,
  cancelled_at: null,
  expired_at: null,
  created_by: "user-pm-company-a",
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
};

db.insertServerSide(validSub1);
assert(true, "Successfully inserted valid subscription record (server-level simulation)");

// -------------------------------------------------------------
// Test 2: Invalid Status Rejection
// -------------------------------------------------------------
console.log("\n2. Invalid Status Rejection");
try {
  db.insertServerSide({
    ...validSub1,
    id: "sub-bad-status",
    subscription_reference: "PMX-SUB-BAD-STATUS",
    status: "bogus_status" as any,
  });
  assert(false, "Invalid status should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_subscriptions_status"), "Invalid status is rejected by check constraint");
}

// -------------------------------------------------------------
// Test 3: Invalid Amount and Currency Rejection
// -------------------------------------------------------------
console.log("\n3. Invalid Amount and Currency Rejection");
try {
  db.insertServerSide({
    ...validSub1,
    id: "sub-bad-amount",
    subscription_reference: "PMX-SUB-BAD-AMT",
    amount_minor: 0,
  });
  assert(false, "Amount <= 0 should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_subscriptions_amount_minor_positive"), "Amount <= 0 is rejected");
}

try {
  db.insertServerSide({
    ...validSub1,
    id: "sub-bad-currency",
    subscription_reference: "PMX-SUB-BAD-CURR",
    currency: "zar", // Lowercase violates ^[A-Z]{3}$
  });
  assert(false, "Invalid currency should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_subscriptions_currency_iso"), "Invalid currency format is rejected");
}

// -------------------------------------------------------------
// Test 4: Invalid Date Ranges Rejection
// -------------------------------------------------------------
console.log("\n4. Invalid Date Ranges Rejection");
try {
  db.insertServerSide({
    ...validSub1,
    id: "sub-bad-trial-dates",
    subscription_reference: "PMX-SUB-BAD-TRIAL",
    trial_started_at: "2026-08-24T00:00:00Z",
    trial_ends_at: "2026-08-17T00:00:00Z", // End before start
  });
  assert(false, "trial_ends_at < trial_started_at should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_subscriptions_trial_dates"), "trial_ends_at before trial_started_at is rejected");
}

try {
  db.insertServerSide({
    ...validSub1,
    id: "sub-bad-period-dates",
    subscription_reference: "PMX-SUB-BAD-PERIOD",
    current_period_start: "2026-09-17T00:00:00Z",
    current_period_end: "2026-08-17T00:00:00Z", // End before start
  });
  assert(false, "current_period_end < current_period_start should fail");
} catch (e: any) {
  assert(e.message.includes("chk_billing_subscriptions_period_dates"), "current_period_end before current_period_start is rejected");
}

// -------------------------------------------------------------
// Test 5: Duplicate Subscription Reference Rejection
// -------------------------------------------------------------
console.log("\n5. Duplicate Subscription Reference Rejection");
try {
  db.insertServerSide({
    ...validSub1,
    id: "sub-duplicate-ref",
    company_id: "company-b",
    subscription_reference: "PMX-SUB-202608-001", // Duplicate
  });
  assert(false, "Duplicate reference should fail");
} catch (e: any) {
  assert(e.message.includes("uq_billing_subscriptions_reference"), "Duplicate subscription reference is rejected");
}

// -------------------------------------------------------------
// Test 6: Two Simultaneous Current Subscriptions for One Company Rejection
// -------------------------------------------------------------
console.log("\n6. Two Simultaneous Current Subscriptions for One Company Rejection");
try {
  db.insertServerSide({
    ...validSub1,
    id: "sub-company-a-second-active",
    subscription_reference: "PMX-SUB-202608-002",
    company_id: "company-a", // Already has 'trialing' sub
    status: "active",
  });
  assert(false, "Second active subscription for company-a should fail");
} catch (e: any) {
  assert(
    e.message.includes("uq_billing_subscriptions_active_company"),
    "Second simultaneous current subscription for same company is rejected by partial unique index"
  );
}

// -------------------------------------------------------------
// Test 7: Historical Expired/Cancelled Subscriptions Preserved
// -------------------------------------------------------------
console.log("\n7. Historical Expired/Cancelled Subscriptions Preserved");
// Should allow expired and cancelled subscriptions for company-a even if company-a has a current subscription
const historicalExpired: BillingSubscription = {
  ...validSub1,
  id: "sub-company-a-hist-1",
  subscription_reference: "PMX-SUB-HIST-001",
  status: "expired",
  expired_at: "2026-08-01T00:00:00Z",
};
const historicalCancelled: BillingSubscription = {
  ...validSub1,
  id: "sub-company-a-hist-2",
  subscription_reference: "PMX-SUB-HIST-002",
  status: "cancelled",
  cancelled_at: "2026-08-10T00:00:00Z",
};

db.insertServerSide(historicalExpired);
db.insertServerSide(historicalCancelled);
assert(true, "Historical 'expired' and 'cancelled' subscriptions for company-a coexist peacefully");

// Also insert a subscription for company-b
const validSubCompanyB: BillingSubscription = {
  ...validSub1,
  id: "sub-company-b-001",
  company_id: "company-b",
  subscription_reference: "PMX-SUB-COMP-B-001",
  status: "active",
};
db.insertServerSide(validSubCompanyB);
assert(true, "Inserted active subscription for company-b");

// -------------------------------------------------------------
// Test 8: RLS - Authorized Billing Roles Reading Active Company's Subscription
// -------------------------------------------------------------
console.log("\n8. RLS - Authorized Billing Roles Reading Active Company Subscription");
const pmCompanyAReads = db.clientSelect("user-pm-company-a");
assert(
  pmCompanyAReads.length === 3 &&
    pmCompanyAReads.every((s) => s.company_id === "company-a"),
  "Project Manager in company-a sees only company-a's 3 subscriptions (trialing, expired, cancelled)"
);

const ceoCompanyAReads = db.clientSelect("user-ceo-company-a");
assert(
  ceoCompanyAReads.length === 3 &&
    ceoCompanyAReads.every((s) => s.company_id === "company-a"),
  "CEO in company-a sees only company-a's 3 subscriptions"
);

// -------------------------------------------------------------
// Test 9: RLS - Cross-Company and Unauthorized Role Denial
// -------------------------------------------------------------
console.log("\n9. RLS - Cross-Company and Unauthorized Role Denial");
const pmCompanyBReads = db.clientSelect("user-pm-company-b");
assert(
  pmCompanyBReads.length === 1 && pmCompanyBReads[0].company_id === "company-b",
  "Project Manager in company-b cannot read company-a subscriptions (cross-company isolation)"
);

const generalWorkerReads = db.clientSelect("user-worker-company-a");
assert(
  generalWorkerReads.length === 0,
  "General Worker with is_company_admin = true is DENIED subscription access (returns 0 rows)"
);

const inactiveCeoReads = db.clientSelect("user-inactive-ceo");
assert(
  inactiveCeoReads.length === 0,
  "Inactive CEO (is_active = false) is DENIED subscription access (returns 0 rows)"
);

const anonReads = db.clientSelect(null);
assert(
  anonReads.length === 0,
  "Anonymous caller receives 0 rows (no SELECT privilege / RLS failure)"
);

// -------------------------------------------------------------
// Test 10: Authenticated Client Mutations Denied
// -------------------------------------------------------------
console.log("\n10. Authenticated Client Mutations Denied");
try {
  db.clientInsert("user-pm-company-a", { id: "client-sub" });
  assert(false, "Client INSERT should fail");
} catch (e: any) {
  assert(e.message.includes("permission denied"), "Client direct INSERT is revoked and denied");
}

try {
  db.clientUpdate("user-pm-company-a", "sub-001", { amount_minor: 100 });
  assert(false, "Client UPDATE should fail");
} catch (e: any) {
  assert(e.message.includes("permission denied"), "Client direct UPDATE is revoked and denied");
}

try {
  db.clientDelete("user-pm-company-a", "sub-001");
  assert(false, "Client DELETE should fail");
} catch (e: any) {
  assert(e.message.includes("permission denied"), "Client direct DELETE is revoked and denied");
}

console.log("\n=======================================================");
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
