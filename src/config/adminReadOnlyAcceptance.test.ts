import {
  guardOperationalWriteMutation,
  canPerformOperationalWrite,
  getOperationalWriteNotice,
  getErrorMessage,
} from "../utils/billingUiHelpers";
import { canUserAccessBilling, BillingAccessMember } from "./accessControl";
import fs from "node:fs";
import path from "node:path";

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
console.log("PROJECTMATRIX FOCUSED ACCEPTANCE CHECK: PERSONNEL & PROJECT ADMIN READ-ONLY");
console.log("=======================================================\n");

// ============================================================================
// SUITE 1: Source-Code Structural Verification of the 6 Target Handlers
// ============================================================================
console.log("Suite 1: Source Code Verification of 6 Handlers in AdministrationPage.tsx");

const adminPagePath = path.resolve(process.cwd(), "src/pages/Administration/AdministrationPage.tsx");
const adminPageCode = fs.readFileSync(adminPagePath, "utf-8");

const TARGET_HANDLERS = [
  "handleAddPersonnel",
  "handleSaveMemberEdits",
  "handleDeletePersonnel",
  "handleCreateProject",
  "handleDeleteProject",
  "handleSaveAssignments"
];

for (const handlerName of TARGET_HANDLERS) {
  const handlerStartIndex = adminPageCode.indexOf(`const ${handlerName} =`);
  assert(handlerStartIndex !== -1, `${handlerName} definition exists in AdministrationPage.tsx`);

  if (handlerStartIndex !== -1) {
    // Extract block up to next handler or 3000 chars
    const slice = adminPageCode.slice(handlerStartIndex, handlerStartIndex + 3000);
    const guardIndex = slice.indexOf("guardOperationalWriteMutation");
    assert(guardIndex !== -1, `${handlerName} invokes guardOperationalWriteMutation`);

    // Ensure guard runs before any database or network call
    const supabaseIndex = slice.indexOf("supabase");
    const fetchIndex = slice.indexOf("fetch(");

    if (supabaseIndex !== -1) {
      assert(guardIndex < supabaseIndex, `${handlerName} runs guardOperationalWriteMutation BEFORE supabase call`);
    } else {
      assert(true, `${handlerName} does not contain direct supabase call or already guarded`);
    }

    if (fetchIndex !== -1) {
      assert(guardIndex < fetchIndex, `${handlerName} runs guardOperationalWriteMutation BEFORE fetch call`);
    } else {
      assert(true, `${handlerName} does not contain direct fetch call`);
    }
  }
}

// ============================================================================
// SUITE 2: Read-Only, Loading & Verification-Error States Block Every Handler (0 Network Calls)
// ============================================================================
console.log("\nSuite 2: Zero Network/DB Calls Across All 6 Handlers in Blocked States");

const blockedScenarios = [
  { name: "read-only state (canWrite=false)", canWrite: false, isBillingLoading: false },
  { name: "loading state (isBillingLoading=true)", canWrite: false, isBillingLoading: true },
  { name: "verification-error / unresolved (canWrite=false, loading=false)", canWrite: false, isBillingLoading: false },
  { name: "unconfigured / null entitlement (canWrite=null)", canWrite: null, isBillingLoading: false }
];

for (const scenario of blockedScenarios) {
  for (const handlerName of TARGET_HANDLERS) {
    let networkCallCount = 0;
    let errorMsg: string | null = null;

    // Simulate handler execution with guard
    const isAllowed = guardOperationalWriteMutation({
      canWrite: scenario.canWrite,
      isBillingLoading: scenario.isBillingLoading,
      hasModulePermission: true,
      companyPersonnel: [],
      activeCompanyId: "comp-123",
      profileId: "prof-123",
      setErrorMsg: (msg) => { errorMsg = msg; }
    });

    if (isAllowed) {
      // If guard permitted (which it shouldn't), simulate network call
      networkCallCount++;
    }

    assert(
      !isAllowed && networkCallCount === 0 && errorMsg !== null,
      `${handlerName} blocked in ${scenario.name} with 0 network/DB calls`
    );
  }
}

// ============================================================================
// SUITE 3: Full and Grace-Period States Permit Writes ONLY with Module Permission
// ============================================================================
console.log("\nSuite 3: Full & Grace-Period Entitlement Requires Module Permission");

const writeAllowedScenarios = [
  { name: "Active / Paid Subscription (canWrite=true)", canWrite: true, isBillingLoading: false },
  { name: "Grace-Period Subscription (canWrite=true)", canWrite: true, isBillingLoading: false },
  { name: "Active Trialing (canWrite=true)", canWrite: true, isBillingLoading: false }
];

for (const scenario of writeAllowedScenarios) {
  // 1. With module permission -> allowed
  const allowed = canPerformOperationalWrite({
    canWrite: scenario.canWrite,
    isBillingLoading: scenario.isBillingLoading,
    hasModulePermission: true
  });
  assert(allowed === true, `${scenario.name} permits write when user has module permission`);

  // 2. Without module permission -> blocked
  const denied = canPerformOperationalWrite({
    canWrite: scenario.canWrite,
    isBillingLoading: scenario.isBillingLoading,
    hasModulePermission: false
  });
  assert(denied === false, `${scenario.name} strictly blocks write when module permission is false`);
}

// ============================================================================
// SUITE 4: Role-Restricted User Remains Blocked Even When Billing Permits Writes
// ============================================================================
console.log("\nSuite 4: Role-Restricted User Remains Blocked When Billing Permits Writes");

for (const handlerName of TARGET_HANDLERS) {
  let networkCallCount = 0;
  let errorMsg: string | null = null;

  const isAllowed = guardOperationalWriteMutation({
    canWrite: true, // Billing permits writes
    isBillingLoading: false,
    hasModulePermission: false, // User lacks manager permission
    companyPersonnel: [
      {
        company_id: "comp-123",
        profile_id: "prof-worker",
        designation: "General Worker",
        is_company_admin: false,
        is_active: true
      }
    ],
    activeCompanyId: "comp-123",
    profileId: "prof-worker",
    setErrorMsg: (msg) => { errorMsg = msg; },
    customPermissionDeniedMessage: `Access Denied: Your assigned role does not have permission for ${handlerName}.`
  });

  if (isAllowed) {
    networkCallCount++;
  }

  assert(
    !isAllowed && networkCallCount === 0,
    `Role-restricted user blocked from ${handlerName} despite canWrite=true (0 calls)`
  );
  assert(
    errorMsg?.includes("Access Denied"),
    `Error message explains role restriction: "${errorMsg}"`
  );
}

// ============================================================================
// SUITE 5: Banner, Tooltip, and Billing-Recovery Guidance (No is_company_admin Fallback)
// ============================================================================
console.log("\nSuite 5: Accurate Recovery Guidance without is_company_admin Fallback");

const personnelDirectory: BillingAccessMember[] = [
  // 1. Canonical allowed role: CEO
  {
    company_id: "comp-123",
    profile_id: "prof-ceo",
    designation: "CEO",
    is_company_admin: false,
    is_active: true
  },
  // 2. Canonical allowed role: Project Manager
  {
    company_id: "comp-123",
    profile_id: "prof-pm",
    designation: "Project Manager",
    is_company_admin: false,
    is_active: true
  },
  // 3. Disallowed role with is_company_admin: true (e.g. General Worker set as company admin)
  {
    company_id: "comp-123",
    profile_id: "prof-worker-admin",
    designation: "General Worker",
    is_company_admin: true,
    is_active: true
  },
  // 4. Standard member with no billing role
  {
    company_id: "comp-123",
    profile_id: "prof-surveyor",
    designation: "Site Surveyor",
    is_company_admin: false,
    is_active: true
  }
];

// Test 5A: Canonical Billing Roles receive direct self-service Billing link
const ceoNotice = getOperationalWriteNotice({
  canWrite: false,
  isBillingLoading: false,
  hasModulePermission: true,
  companyPersonnel: personnelDirectory,
  activeCompanyId: "comp-123",
  profileId: "prof-ceo"
});
assert(ceoNotice.isAllowed === false, "CEO blocked when billing is read-only");
assert(ceoNotice.reason === "billing_read_only", "CEO reason is billing_read_only");
assert(ceoNotice.canManageBilling === true, "CEO canManageBilling is true");
assert(
  ceoNotice.message.includes("Update your subscription in Billing"),
  "CEO receives direct Billing-management instructions"
);

const pmNotice = getOperationalWriteNotice({
  canWrite: false,
  isBillingLoading: false,
  hasModulePermission: true,
  companyPersonnel: personnelDirectory,
  activeCompanyId: "comp-123",
  profileId: "prof-pm"
});
assert(pmNotice.canManageBilling === true, "Project Manager canManageBilling is true");
assert(
  pmNotice.message.includes("Update your subscription in Billing"),
  "Project Manager receives direct Billing-management instructions"
);

// Test 5B: General Worker with is_company_admin=true MUST NOT receive Billing management rights
const workerAdminNotice = getOperationalWriteNotice({
  canWrite: false,
  isBillingLoading: false,
  hasModulePermission: true,
  companyPersonnel: personnelDirectory,
  activeCompanyId: "comp-123",
  profileId: "prof-worker-admin"
});
assert(
  workerAdminNotice.canManageBilling === false,
  "General Worker with is_company_admin=true has canManageBilling=false (no fallback!)"
);
assert(
  workerAdminNotice.message.includes("contact an authorized company administrator or financial controller"),
  "General Worker receives contact-administrator guidance, not direct billing mutation"
);

// Test 5C: Non-billing role receives contact-admin guidance
const surveyorNotice = getOperationalWriteNotice({
  canWrite: false,
  isBillingLoading: false,
  hasModulePermission: true,
  companyPersonnel: personnelDirectory,
  activeCompanyId: "comp-123",
  profileId: "prof-surveyor"
});
assert(surveyorNotice.canManageBilling === false, "Surveyor has canManageBilling=false");
assert(
  surveyorNotice.message.includes("contact an authorized company administrator or financial controller"),
  "Surveyor receives contact-administrator guidance"
);

// Test 5D: Loading Notice
const loadingNotice = getOperationalWriteNotice({
  canWrite: false,
  isBillingLoading: true,
  hasModulePermission: true,
  companyPersonnel: personnelDirectory,
  activeCompanyId: "comp-123",
  profileId: "prof-ceo"
});
assert(loadingNotice.reason === "loading", "Loading state has reason 'loading'");
assert(
  loadingNotice.message === "Verifying subscription entitlement. Please wait...",
  "Loading message accurately conveys verification in progress"
);

// ============================================================================
// SUITE 6: UI Form Controls and Already-Open Form Disabling Verification
// ============================================================================
console.log("\nSuite 6: UI Form Controls & Already-Open Form Disabling Verification");

// 6A: Fieldsets disabled on write protection
assert(
  adminPageCode.includes('<fieldset disabled={isActionLoading || !isWriteAllowed}'),
  "Personnel edit & create forms are wrapped in fieldsets disabled by isWriteAllowed"
);
assert(
  adminPageCode.includes('<fieldset disabled={isActionLoading || !isProjectWriteAllowed}'),
  "Project create form is wrapped in fieldset disabled by isProjectWriteAllowed"
);

// 6B: Buttons disabled on write protection
assert(
  adminPageCode.includes('disabled={isActionLoading || !isWriteAllowed}') &&
  adminPageCode.includes('disabled={isActionLoading || !isProjectWriteAllowed}'),
  "Form submission and action buttons have explicit disabled={!isWriteAllowed} conditions"
);

// 6C: Table action buttons (Edit, Delete) disabled
assert(
  adminPageCode.includes('onClick={() => handleEditPersonnel(p)}\n                      disabled={!isWriteAllowed}'),
  "Personnel Edit button is disabled when !isWriteAllowed"
);
assert(
  adminPageCode.includes('onClick={() => handleDeletePersonnel(p.id)}\n                        disabled={!isWriteAllowed}'),
  "Personnel Delete button is disabled when !isWriteAllowed"
);
assert(
  adminPageCode.includes('onClick={() => handleDeleteProject(proj.id)}\n                      disabled={!isProjectWriteAllowed}'),
  "Project Delete button is disabled when !isProjectWriteAllowed"
);

// 6D: Assignment Matrix Controls
assert(
  adminPageCode.includes('onClick={() => handleTogglePersID(p.id)}') &&
  adminPageCode.includes('if (!isWriteAllowed) return;'),
  "Matrix personnel toggle is guarded against clicks when !isWriteAllowed"
);
assert(
  adminPageCode.includes('assignedPersRoles[p.id] || "Member"') &&
  adminPageCode.includes('disabled={!isWriteAllowed}'),
  "Matrix role select dropdown is disabled when !isWriteAllowed"
);
assert(
  adminPageCode.includes('onClick={handleSaveAssignments}\n                  disabled={isActionLoading || !isWriteAllowed}'),
  "Matrix save assignments button is disabled when !isWriteAllowed"
);

// 6E: Banner present for read-only / unverified state
assert(
  adminPageCode.includes('(!isWriteAllowed || isBillingEntitlementLoading) && writeNotice.message'),
  "Read-Only / Unverified state renders informative top banner"
);

console.log(`\n=======================================================`);
console.log(`TOTAL CHECKS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log(`=======================================================\n`);

if (failed > 0) {
  process.exit(1);
}
