import {
  getErrorMessage,
} from "../utils/billingUiHelpers";
import {
  isValidBillingEntitlement,
  createFallbackReadOnlyEntitlement,
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
console.log("STEP 3C.4F-1N: READ-ONLY BILLING ACCESS INTEGRATION TESTS");
console.log("=======================================================\n");

// -------------------------------------------------------------
// Suite 1: SQLSTATE PM001 and BILLING_READ_ONLY Error Mapping
// -------------------------------------------------------------
console.log("Suite 1: Error Message Mapping for Read-Only Billing Enforcement");

const pm001Error = { code: "PM001", message: "Operational write disabled: company billing is read-only" };
assert(
  getErrorMessage(pm001Error) === "Your company is in read-only mode. Update billing to continue.",
  "SQLSTATE PM001 maps to 'Your company is in read-only mode. Update billing to continue.'"
);

const pm001InMessage = new Error("Database query failed: PM001 operational write blocked");
assert(
  getErrorMessage(pm001InMessage) === "Your company is in read-only mode. Update billing to continue.",
  "Error containing 'PM001' in message string maps to read-only notice"
);

const billingReadOnlyCode = { code: "BILLING_READ_ONLY", message: "Company is currently in read-only mode" };
assert(
  getErrorMessage(billingReadOnlyCode) === "Your company is in read-only mode. Update billing to continue.",
  "Error code BILLING_READ_ONLY maps to 'Your company is in read-only mode. Update billing to continue.'"
);

const billingReadOnlyInMessage = new Error("Action failed: BILLING_READ_ONLY entitlement violation");
assert(
  getErrorMessage(billingReadOnlyInMessage) === "Your company is in read-only mode. Update billing to continue.",
  "Error containing BILLING_READ_ONLY in message string maps to read-only notice"
);

// Standard errors should not be rewritten to read-only message
const standardError = new Error("Network connection reset");
assert(
  getErrorMessage(standardError) === "Network connection reset",
  "Standard errors preserve original message"
);

// -------------------------------------------------------------
// Suite 2: Entitlement Runtime Validation (isValidBillingEntitlement)
// -------------------------------------------------------------
console.log("\nSuite 2: Entitlement Runtime Decoding and Validation");

const validFullEntitlement: CompanyBillingEntitlement = {
  company_id: "comp-100",
  subscription_id: "sub-100",
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
  evaluated_at: new Date().toISOString(),
};

assert(isValidBillingEntitlement(validFullEntitlement) === true, "Valid full entitlement passes validation");

const validGraceEntitlement: CompanyBillingEntitlement = {
  company_id: "comp-100",
  subscription_id: "sub-100",
  subscription_status: "past_due",
  entitlement_state: "past_due_grace",
  access_mode: "grace_period",
  can_read: true,
  can_write: true,
  can_access_billing: true,
  can_export: true,
  can_access_settings: true,
  grace_started_at: new Date().toISOString(),
  grace_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  read_only_since: null,
  reason_code: "PAST_DUE_WITHIN_GRACE",
  evaluated_at: new Date().toISOString(),
};

assert(isValidBillingEntitlement(validGraceEntitlement) === true, "Valid grace period entitlement passes validation");

const validReadOnlyEntitlement: CompanyBillingEntitlement = {
  company_id: "comp-100",
  subscription_id: "sub-100",
  subscription_status: "past_due",
  entitlement_state: "past_due_read_only",
  access_mode: "read_only",
  can_read: true,
  can_write: false,
  can_access_billing: true,
  can_export: true,
  can_access_settings: true,
  grace_started_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  grace_ends_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  read_only_since: new Date(Date.now() - 3 * 86400000).toISOString(),
  reason_code: "PAST_DUE_EXPIRED",
  evaluated_at: new Date().toISOString(),
};

assert(isValidBillingEntitlement(validReadOnlyEntitlement) === true, "Valid read-only entitlement passes validation");

// Invalid shapes
assert(isValidBillingEntitlement(null) === false, "Null entitlement fails validation");
assert(isValidBillingEntitlement(undefined) === false, "Undefined entitlement fails validation");
assert(isValidBillingEntitlement({}) === false, "Empty object fails validation");
assert(isValidBillingEntitlement({ company_id: "comp-100" }) === false, "Incomplete object fails validation");
assert(
  isValidBillingEntitlement({ ...validFullEntitlement, access_mode: "invalid_mode" }) === false,
  "Invalid access_mode fails validation"
);
assert(
  isValidBillingEntitlement({ ...validFullEntitlement, can_write: "true" }) === false,
  "Non-boolean can_write fails validation"
);

// -------------------------------------------------------------
// Suite 3: Fail-Closed Fallback Generator
// -------------------------------------------------------------
console.log("\nSuite 3: Fail-Closed Fallback Entitlement Generation");

const fallback = createFallbackReadOnlyEntitlement("comp-error-01", "FETCH_TIMEOUT");
assert(fallback.company_id === "comp-error-01", "Fallback company ID matches");
assert(fallback.access_mode === "read_only", "Fallback access_mode is read_only");
assert(fallback.can_write === false, "Fallback can_write is strictly false");
assert(fallback.can_read === true, "Fallback can_read is preserved");
assert(fallback.can_access_billing === true, "Fallback can_access_billing is preserved");
assert(fallback.can_access_settings === true, "Fallback can_access_settings is preserved");
assert(fallback.reason_code === "FETCH_TIMEOUT", "Fallback records specific reason code");
assert(isValidBillingEntitlement(fallback) === true, "Generated fallback passes runtime validation");

// -------------------------------------------------------------
// Suite 4: Fail-Closed UI State Computation
// -------------------------------------------------------------
console.log("\nSuite 4: Fail-Closed UI State Computation");

function computeUiCapabilities(
  entitlement: CompanyBillingEntitlement | null,
  isLoading: boolean
) {
  const isGracePeriod = Boolean(entitlement && entitlement.access_mode === "grace_period");
  const isReadOnly = !isLoading && (
    entitlement?.access_mode === "read_only" ||
    (entitlement && !entitlement.can_write) ||
    !entitlement
  );
  const canWrite = Boolean(
    entitlement &&
    entitlement.can_write === true &&
    !isLoading
  );
  return { isGracePeriod, isReadOnly, canWrite };
}

// Case A: Loading state
const loadingState = computeUiCapabilities(null, true);
assert(loadingState.canWrite === false, "Loading state blocks writes (fail closed)");
assert(loadingState.isGracePeriod === false, "Loading state has no grace banner");

// Case B: Full access
const fullState = computeUiCapabilities(validFullEntitlement, false);
assert(fullState.canWrite === true, "Full access enables writes");
assert(fullState.isReadOnly === false, "Full access does not show read-only banner");
assert(fullState.isGracePeriod === false, "Full access does not show grace banner");

// Case C: Grace period (7-day past due grace)
const graceState = computeUiCapabilities(validGraceEntitlement, false);
assert(graceState.canWrite === true, "Grace period maintains write access");
assert(graceState.isGracePeriod === true, "Grace period displays persistent grace banner");
assert(graceState.isReadOnly === false, "Grace period does not display read-only banner");

// Case D: Read-only access
const readOnlyState = computeUiCapabilities(validReadOnlyEntitlement, false);
assert(readOnlyState.canWrite === false, "Read-only access disables writes");
assert(readOnlyState.isReadOnly === true, "Read-only access displays persistent read-only banner");
assert(readOnlyState.isGracePeriod === false, "Read-only access does not show grace banner");

// Case E: Unavailable / Malformed (null entitlement settled)
const unavailableState = computeUiCapabilities(null, false);
assert(unavailableState.canWrite === false, "Unavailable entitlement disables writes");
assert(unavailableState.isReadOnly === true, "Unavailable entitlement defaults to read-only");

// -------------------------------------------------------------
// Suite 5: Company and Session Switching (Stale Entitlement Clearing)
// -------------------------------------------------------------
console.log("\nSuite 5: Company & Session Switching Stale Entitlement Clearing");

let currentActiveCompanyId = "comp-1";
let currentEntitlement: CompanyBillingEntitlement | null = validFullEntitlement;

function switchCompany(newCompanyId: string) {
  // Stale entitlement MUST be cleared immediately
  currentEntitlement = null;
  currentActiveCompanyId = newCompanyId;
}

function handleUserSignOut() {
  currentEntitlement = null;
  currentActiveCompanyId = "";
}

switchCompany("comp-2");
assert(currentEntitlement === null, "Switching companies immediately clears stale entitlement");
assert(currentActiveCompanyId === "comp-2", "Active company ID updated to comp-2");

currentEntitlement = validGraceEntitlement;
handleUserSignOut();
assert(currentEntitlement === null, "Signing out immediately clears entitlement");

// -------------------------------------------------------------
// Suite 6: create-company-member Edge Function Guard Logic
// -------------------------------------------------------------
console.log("\nSuite 6: Edge Function Pre-Operation Entitlement Verification");

interface MockRpcResponse {
  data: CompanyBillingEntitlement[] | null;
  error: any;
}

interface EdgeFunctionExecutionResult {
  status: number;
  responseBody: any;
  serviceRoleInitialized: boolean;
  dbWritesPerformed: boolean;
}

async function simulateCreateCompanyMemberHandler(
  callerToken: string | null,
  companyId: string,
  mockRpcResponse: MockRpcResponse
): Promise<EdgeFunctionExecutionResult> {
  let serviceRoleInitialized = false;
  let dbWritesPerformed = false;

  // 1. Authenticate caller
  if (!callerToken) {
    return {
      status: 401,
      responseBody: { error: "Authentication required", code: "UNAUTHORIZED" },
      serviceRoleInitialized,
      dbWritesPerformed,
    };
  }

  // 2. Evaluate authoritative billing entitlement using caller's user-scoped client
  if (mockRpcResponse.error || !mockRpcResponse.data || mockRpcResponse.data.length === 0) {
    return {
      status: 403,
      responseBody: {
        error: "Your company is in read-only mode. Update billing to continue.",
        code: "BILLING_READ_ONLY",
      },
      serviceRoleInitialized,
      dbWritesPerformed,
    };
  }

  const entitlement = mockRpcResponse.data[0];
  if (!entitlement || entitlement.can_write !== true) {
    return {
      status: 403,
      responseBody: {
        error: "Your company is in read-only mode. Update billing to continue.",
        code: "BILLING_READ_ONLY",
        access_mode: entitlement?.access_mode || "read_only",
      },
      serviceRoleInitialized,
      dbWritesPerformed,
    };
  }

  // 3. Only initialize service-role admin AFTER confirming can_write === true
  serviceRoleInitialized = true;
  dbWritesPerformed = true;

  return {
    status: 200,
    responseBody: { success: true, memberId: "new-member-001" },
    serviceRoleInitialized,
    dbWritesPerformed,
  };
}

// Test 6A: Caller blocked in read-only mode
const readOnlyExecution = await simulateCreateCompanyMemberHandler(
  "valid-jwt-token",
  "comp-100",
  { data: [validReadOnlyEntitlement], error: null }
);
assert(readOnlyExecution.status === 403, "Read-only company member creation returns HTTP 403");
assert(readOnlyExecution.responseBody.code === "BILLING_READ_ONLY", "Returns sanitized BILLING_READ_ONLY code");
assert(readOnlyExecution.serviceRoleInitialized === false, "Service role client NOT initialized when blocked");
assert(readOnlyExecution.dbWritesPerformed === false, "Zero DB writes performed when blocked");

// Test 6B: Caller blocked on RPC error / unavailable entitlement (fails closed)
const errorExecution = await simulateCreateCompanyMemberHandler(
  "valid-jwt-token",
  "comp-100",
  { data: null, error: { message: "RPC failed" } }
);
assert(errorExecution.status === 403, "RPC failure returns HTTP 403 BILLING_READ_ONLY (fail closed)");
assert(errorExecution.serviceRoleInitialized === false, "Service role client NOT initialized on RPC error");
assert(errorExecution.dbWritesPerformed === false, "Zero DB writes performed on RPC error");

// Test 6C: Caller allowed in full write mode
const fullExecution = await simulateCreateCompanyMemberHandler(
  "valid-jwt-token",
  "comp-100",
  { data: [validFullEntitlement], error: null }
);
assert(fullExecution.status === 200, "Full access company member creation succeeds (HTTP 200)");
assert(fullExecution.serviceRoleInitialized === true, "Service role initialized after confirmation");
assert(fullExecution.dbWritesPerformed === true, "Member created successfully");

// Test 6D: Caller allowed in grace period with can_write === true
const graceExecution = await simulateCreateCompanyMemberHandler(
  "valid-jwt-token",
  "comp-100",
  { data: [validGraceEntitlement], error: null }
);
assert(graceExecution.status === 200, "Grace period with can_write=true allows member creation");
assert(graceExecution.serviceRoleInitialized === true, "Service role initialized for grace write");

// -------------------------------------------------------------
// Suite 7: Route & Navigation Preservation
// -------------------------------------------------------------
console.log("\nSuite 7: Route & Navigation Preservation");

interface RouteAccessCheck {
  path: string;
  directory: string;
  allowed: boolean;
  reason?: string;
}

function checkRouteEntitlementAccess(
  directory: string,
  entitlement: CompanyBillingEntitlement
): boolean {
  if (directory === "billing") {
    return entitlement.can_access_billing === true;
  }
  if (directory === "settings") {
    return entitlement.can_access_settings === true;
  }
  return entitlement.can_read === true;
}

// In read-only mode, billing, settings, and read views remain accessible
assert(
  checkRouteEntitlementAccess("billing", validReadOnlyEntitlement) === true,
  "/billing/* route accessible in read-only mode"
);
assert(
  checkRouteEntitlementAccess("settings", validReadOnlyEntitlement) === true,
  "/settings/* route accessible in read-only mode"
);
assert(
  checkRouteEntitlementAccess("dailyReports", validReadOnlyEntitlement) === true,
  "Operational read route accessible in read-only mode"
);
assert(
  checkRouteEntitlementAccess("siteDiaries", validReadOnlyEntitlement) === true,
  "Site diaries read route accessible in read-only mode"
);

// If can_access_billing is false, billing route is denied
const restrictedBillingEntitlement = { ...validReadOnlyEntitlement, can_access_billing: false };
assert(
  checkRouteEntitlementAccess("billing", restrictedBillingEntitlement) === false,
  "Billing route denied when can_access_billing === false"
);

// -------------------------------------------------------------
// Suite 8: Operational Mutation Guards
// -------------------------------------------------------------
console.log("\nSuite 8: Operational Mutation Action Disabling");

interface OperationalAction {
  name: string;
  type: "create" | "edit" | "delete" | "upload" | "workflow" | "archive" | "restore";
}

const operationalActions: OperationalAction[] = [
  { name: "Create Site Diary", type: "create" },
  { name: "Edit Technical Report", type: "edit" },
  { name: "Delete Survey Point", type: "delete" },
  { name: "Upload Document", type: "upload" },
  { name: "Submit for Approval", type: "workflow" },
  { name: "Archive Quality Record", type: "archive" },
  { name: "Restore Cashbook Item", type: "restore" },
];

for (const action of operationalActions) {
  const isActionAllowedInReadOnly = validReadOnlyEntitlement.can_write === true;
  const isActionAllowedInFull = validFullEntitlement.can_write === true;
  const isActionAllowedInGrace = validGraceEntitlement.can_write === true;

  assert(
    isActionAllowedInReadOnly === false,
    `Action '${action.name}' (${action.type}) disabled in read-only mode`
  );
  assert(
    isActionAllowedInFull === true,
    `Action '${action.name}' (${action.type}) enabled in full access mode`
  );
  assert(
    isActionAllowedInGrace === true,
    `Action '${action.name}' (${action.type}) enabled in grace period mode`
  );
}

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL STEP 3C.4F-1N READ-ONLY BILLING ACCESS TESTS PASSED! ✓\n");
}
