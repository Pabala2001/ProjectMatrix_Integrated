import {
  calculateNextEntitlementDeadlineMs,
  isBillingVerificationError,
  subscribeToBillingRefresh,
  dispatchBillingRefreshEvent,
  createFallbackReadOnlyEntitlement,
  isValidBillingEntitlement,
} from "../services/billingService";
import type { CompanyBillingEntitlement } from "../types";

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
console.log("PROJECTMATRIX BILLING ENTITLEMENT REFRESH TEST SUITE");
console.log("=======================================================\n");

// -------------------------------------------------------------
// Suite 1: Deadline Calculation (calculateNextEntitlementDeadlineMs)
// -------------------------------------------------------------
console.log("Suite 1: Authoritative Billing Deadline Calculations");

const now = Date.now();
const futureGrace = new Date(now + 60000).toISOString(); // 1 min in future
const entitlementWithGrace: CompanyBillingEntitlement = {
  company_id: "comp-1",
  subscription_id: "sub-1",
  subscription_status: "past_due",
  entitlement_state: "past_due_grace",
  access_mode: "grace_period",
  can_read: true,
  can_write: true,
  can_access_billing: true,
  can_export: true,
  can_access_settings: true,
  grace_started_at: new Date(now - 10000).toISOString(),
  grace_ends_at: futureGrace,
  read_only_since: null,
  reason_code: "GRACE_PERIOD_ACTIVE",
  evaluated_at: new Date(now).toISOString(),
};

const delayMs = calculateNextEntitlementDeadlineMs(entitlementWithGrace, now, 0);
assert(
  delayMs !== null && delayMs >= 59900 && delayMs <= 60100,
  "Accurately calculates remaining milliseconds until grace period expires"
);

// Past deadline returns null
const pastGrace = new Date(now - 60000).toISOString();
const entitlementPastGrace: CompanyBillingEntitlement = {
  ...entitlementWithGrace,
  grace_ends_at: pastGrace,
};
assert(
  calculateNextEntitlementDeadlineMs(entitlementPastGrace, now, 0) === null,
  "Returns null for expired past deadlines"
);

// No deadline returns null
const fullPaidEntitlement: CompanyBillingEntitlement = {
  company_id: "comp-2",
  subscription_id: "sub-2",
  subscription_status: "active",
  entitlement_state: "active_paid",
  access_mode: "full",
  can_read: true,
  can_write: true,
  can_access_billing: true,
  can_export: true,
  can_access_settings: true,
  grace_started_at: null,
  grace_ends_at: null,
  read_only_since: null,
  reason_code: "SUBSCRIPTION_ACTIVE",
  evaluated_at: new Date(now).toISOString(),
};
assert(
  calculateNextEntitlementDeadlineMs(fullPaidEntitlement, now) === null,
  "Returns null when no expiration deadlines exist"
);

// Null or undefined entitlement returns null
assert(
  calculateNextEntitlementDeadlineMs(null) === null &&
  calculateNextEntitlementDeadlineMs(undefined) === null,
  "Handles null/undefined safely"
);

// -------------------------------------------------------------
// Suite 2: Distinguishing Verification Errors from Confirmed Expiry
// -------------------------------------------------------------
console.log("\nSuite 2: Billing Verification Error Classification");

const rpcErrorEntitlement = createFallbackReadOnlyEntitlement("comp-err", "RPC_FETCH_ERROR");
assert(
  isBillingVerificationError(rpcErrorEntitlement) === true,
  "Fallback with RPC_FETCH_ERROR is marked as verification error"
);

const confirmedExpiredEntitlement: CompanyBillingEntitlement = {
  company_id: "comp-exp",
  subscription_id: "sub-exp",
  subscription_status: "canceled",
  entitlement_state: "unpaid_read_only",
  access_mode: "read_only",
  can_read: true,
  can_write: false,
  can_access_billing: true,
  can_export: true,
  can_access_settings: true,
  grace_started_at: null,
  grace_ends_at: null,
  read_only_since: new Date().toISOString(),
  reason_code: "SUBSCRIPTION_CANCELED",
  evaluated_at: new Date().toISOString(),
};
assert(
  isBillingVerificationError(confirmedExpiredEntitlement) === false,
  "Authoritative expired subscription is NOT treated as a transient verification error"
);

assert(
  isBillingVerificationError(fullPaidEntitlement) === false,
  "Active paid subscription is NOT treated as a verification error"
);

// -------------------------------------------------------------
// Suite 3: Event Synchronization (subscribeToBillingRefresh & dispatchBillingRefreshEvent)
// -------------------------------------------------------------
console.log("\nSuite 3: Event Synchronization Delivery");

let receivedCompanyId: string | undefined = "unset";
const unsubscribe = subscribeToBillingRefresh((compId) => {
  receivedCompanyId = compId;
});

dispatchBillingRefreshEvent("comp-target-42");
assert(
  receivedCompanyId === "comp-target-42",
  "dispatches and receives custom billing refresh event with target companyId"
);

dispatchBillingRefreshEvent();
assert(
  receivedCompanyId === undefined,
  "dispatches general refresh without specific companyId"
);

unsubscribe();
receivedCompanyId = "after-unsub";
dispatchBillingRefreshEvent("comp-should-not-reach");
assert(
  receivedCompanyId === "after-unsub",
  "unsubscription cleanly terminates event listener"
);

// -------------------------------------------------------------
// Suite 4: Fail-Closed Logic Verification
// -------------------------------------------------------------
console.log("\nSuite 4: Fail-Closed Entitlement Invariants");

const fallback = createFallbackReadOnlyEntitlement("comp-secure");
assert(fallback.can_write === false, "Fallback entitlement strictly denies can_write");
assert(fallback.can_read === true, "Fallback entitlement preserves can_read for operational data");
assert(fallback.can_access_billing === true, "Fallback entitlement allows billing portal access");
assert(fallback.can_export === true, "Fallback entitlement allows data export");
assert(fallback.access_mode === "read_only", "Fallback entitlement sets access_mode to read_only");
assert(isValidBillingEntitlement(fallback), "Fallback entitlement conforms to valid schema");

console.log("\n=======================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
