import { 
  normalizeBillingRole, 
  isBillingAllowedRole, 
  canAccessBilling, 
  canUserAccessBilling, 
  BILLING_ALLOWED_ROLES,
  canAccessDirectory
} from "./accessControl";

/**
 * Test runner helper for asserting conditions with clear error logging.
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
console.log("PROJECTMATRIX BILLING ACCESS CONTROL TEST SUITE");
console.log("=======================================================\n");

// -------------------------------------------------------------
// Test Group 1: CEO, COO, CFO, Director Variations
// -------------------------------------------------------------
console.log("1. Canonical Executive Roles (CEO, COO, CFO, Director)");
assert(normalizeBillingRole("CEO") === "ceo", "Normalizes uppercase 'CEO' to 'ceo'");
assert(normalizeBillingRole("ceo") === "ceo", "Normalizes lowercase 'ceo' to 'ceo'");
assert(normalizeBillingRole("  CEO  ") === "ceo", "Normalizes leading and trailing whitespace '  CEO  ' to 'ceo'");
assert(normalizeBillingRole("COO") === "coo" && isBillingAllowedRole("  Coo  "), "Normalizes COO");
assert(normalizeBillingRole("CFO") === "cfo" && isBillingAllowedRole("  cfo  "), "Normalizes CFO");
assert(normalizeBillingRole("Director") === "director" && isBillingAllowedRole("DIRECTOR"), "Normalizes Director");

// -------------------------------------------------------------
// Test Group 2: Project Manager Variations & Disallowed 'projectmanager'
// -------------------------------------------------------------
console.log("\n2. Project Manager Variations & Disallowed 'projectmanager'");
const allowedPmVariants = [
  "Project Manager",
  "project manager",
  "PROJECT MANAGER",
  "project_manager",
  "PROJECT-MANAGER",
  "  Project   Manager  ",
  "  project-manager  ",
  "  PROJECT_MANAGER  ",
];

for (const variant of allowedPmVariants) {
  assert(
    normalizeBillingRole(variant) === "project_manager",
    `Normalizes '${variant}' -> 'project_manager'`
  );
  assert(
    isBillingAllowedRole(variant) === true,
    `isBillingAllowedRole returns true for '${variant}'`
  );
  assert(
    canAccessBilling({
      member: {
        profile_id: "user-123",
        company_id: "company-abc",
        designation: variant,
        is_active: true,
      },
      activeCompanyId: "company-abc",
      profileId: "user-123",
    }) === true,
    `canAccessBilling grants access when designation is '${variant}'`
  );
}

// Explicit test: 'projectmanager' WITHOUT a separator MUST be denied (returns false)
console.log("\n--- Disallowed 'projectmanager' without separator ---");
assert(
  normalizeBillingRole("projectmanager") === "projectmanager",
  "Normalizes 'projectmanager' to 'projectmanager' without re-mapping"
);
assert(
  isBillingAllowedRole("projectmanager") === false,
  "isBillingAllowedRole returns FALSE for 'projectmanager' without separator"
);
assert(
  isBillingAllowedRole("PROJECTMANAGER") === false,
  "isBillingAllowedRole returns FALSE for 'PROJECTMANAGER' without separator"
);
assert(
  canAccessBilling({
    member: {
      profile_id: "user-123",
      company_id: "company-abc",
      designation: "projectmanager",
      is_active: true,
    },
    activeCompanyId: "company-abc",
    profileId: "user-123",
  }) === false,
  "canAccessBilling returns FALSE for designation 'projectmanager'"
);

// -------------------------------------------------------------
// Test Group 3: Company Administrator & Company Admin
// -------------------------------------------------------------
console.log("\n3. Company Administrator, company_administrator, legacy Company Admin & Disallowed 'companyadmin'");
assert(normalizeBillingRole("Company Administrator") === "company_administrator", "Normalizes 'Company Administrator' to 'company_administrator'");
assert(normalizeBillingRole("company_administrator") === "company_administrator", "Normalizes 'company_administrator' to 'company_administrator'");
assert(normalizeBillingRole("COMPANY-ADMINISTRATOR") === "company_administrator", "Normalizes 'COMPANY-ADMINISTRATOR' to 'company_administrator'");
assert(normalizeBillingRole("Company Admin") === "company_administrator", "Normalizes legacy 'Company Admin' to 'company_administrator'");
assert(normalizeBillingRole("company_admin") === "company_administrator", "Normalizes legacy 'company_admin' to 'company_administrator'");
assert(normalizeBillingRole("COMPANY-ADMIN") === "company_administrator", "Normalizes legacy 'COMPANY-ADMIN' to 'company_administrator'");
assert(isBillingAllowedRole("Company Administrator") === true, "isBillingAllowedRole returns true for 'Company Administrator'");
assert(isBillingAllowedRole("Company Admin") === true, "isBillingAllowedRole returns true for 'Company Admin'");
assert(isBillingAllowedRole("company_admin") === true, "isBillingAllowedRole returns true for 'company_admin'");

// Explicit test: 'companyadmin' WITHOUT separator is denied
assert(
  isBillingAllowedRole("companyadmin") === false,
  "isBillingAllowedRole returns FALSE for 'companyadmin' without separator"
);

// -------------------------------------------------------------
// Test Group 4: Allowed designation with is_company_admin = false
// -------------------------------------------------------------
console.log("\n4. Allowed Designation with is_company_admin = false");
const allowedMemberWithoutAdminFlag = {
  profile_id: "user-123",
  company_id: "company-abc",
  designation: "Project Manager",
  role: undefined,
  is_active: true,
  is_company_admin: false,
};
assert(
  canAccessBilling({
    member: allowedMemberWithoutAdminFlag,
    activeCompanyId: "company-abc",
    profileId: "user-123",
  }) === true,
  "Allowed role with is_company_admin = false MUST receive Billing access (true)"
);

// -------------------------------------------------------------
// Test Group 5: General Worker with is_company_admin = true being denied
// -------------------------------------------------------------
console.log("\n5. General Worker with is_company_admin = true");
const generalWorkerAdmin = {
  profile_id: "user-123",
  company_id: "company-abc",
  designation: "General Worker",
  role: "General Worker",
  is_active: true,
  is_company_admin: true,
};
assert(
  canAccessBilling({
    member: generalWorkerAdmin,
    activeCompanyId: "company-abc",
    profileId: "user-123",
  }) === false,
  "General Worker with is_company_admin = true MUST NOT receive Billing access (false)"
);

// -------------------------------------------------------------
// Test Group 6: Allowed legacy role with a different designation
// -------------------------------------------------------------
console.log("\n6. Allowed Legacy Role with Different Designation");
const allowedLegacyRoleMember = {
  profile_id: "user-123",
  company_id: "company-abc",
  designation: "General Worker",
  role: "Project Manager",
  is_active: true,
  is_company_admin: false,
};
assert(
  canAccessBilling({
    member: allowedLegacyRoleMember,
    activeCompanyId: "company-abc",
    profileId: "user-123",
  }) === true,
  "Member with disallowed designation but allowed legacy role MUST receive Billing access (true)"
);

// -------------------------------------------------------------
// Test Group 7: Inactive allowed member being denied
// -------------------------------------------------------------
console.log("\n7. Inactive Allowed Member");
const inactiveCeo = {
  profile_id: "user-123",
  company_id: "company-abc",
  designation: "CEO",
  role: "CEO",
  is_active: false,
  is_company_admin: true,
};
assert(
  canAccessBilling({
    member: inactiveCeo,
    activeCompanyId: "company-abc",
    profileId: "user-123",
  }) === false,
  "Inactive CEO (is_active = false) MUST NOT receive Billing access (false)"
);

// -------------------------------------------------------------
// Test Group 8: Allowed member from another company being denied
// -------------------------------------------------------------
console.log("\n8. Allowed Member From Another Company");
const otherCompanyDirector = {
  profile_id: "user-123",
  company_id: "company-other",
  designation: "Director",
  role: "Director",
  is_active: true,
  is_company_admin: true,
};
assert(
  canAccessBilling({
    member: otherCompanyDirector,
    activeCompanyId: "company-abc",
    profileId: "user-123",
  }) === false,
  "Director from another company (company_id mismatch) MUST NOT receive Billing access (false)"
);

// -------------------------------------------------------------
// Test Group 9: Anonymous / Unauthenticated Caller
// -------------------------------------------------------------
console.log("\n9. Anonymous / Unauthenticated Caller");
assert(
  canAccessBilling({
    member: { profile_id: "user-123", company_id: "company-abc", designation: "CEO", is_active: true },
    activeCompanyId: "company-abc",
    profileId: null, // anonymous / unauthenticated
  }) === false,
  "Anonymous caller (profileId = null) MUST NOT receive Billing access (false)"
);

assert(
  canAccessBilling({
    member: null,
    activeCompanyId: "company-abc",
    profileId: "user-123",
  }) === false,
  "Null member record MUST NOT receive Billing access (false)"
);

// -------------------------------------------------------------
// Test Group 10: Array Lookup (canUserAccessBilling)
// -------------------------------------------------------------
console.log("\n10. canUserAccessBilling Array Lookup");
const personnelList = [
  {
    profile_id: "user-other-1",
    company_id: "company-abc",
    designation: "General Worker",
    is_active: true,
  },
  {
    profile_id: "user-123",
    company_id: "company-abc",
    designation: "Project Manager",
    is_active: true,
    is_company_admin: false,
  },
  {
    profile_id: "user-456",
    company_id: "company-xyz",
    designation: "CEO",
    is_active: true,
  },
];
assert(
  canUserAccessBilling(personnelList, "company-abc", "user-123") === true,
  "Finds active project manager in active company and grants access (true)"
);
assert(
  canUserAccessBilling(personnelList, "company-abc", "user-other-1") === false,
  "Finds general worker in active company and denies access (false)"
);
assert(
  canUserAccessBilling(personnelList, "company-abc", "user-456") === false,
  "User 456 belongs to different company, denies access (false)"
);

// -------------------------------------------------------------
// Test Group 11: SQL Simulation of public.verify_billing_access
// -------------------------------------------------------------
console.log("\n11. SQL Simulation of public.verify_billing_access");

function simulateVerifyBillingAccessSql(
  authUid: string | null,
  pCompanyId: string | null,
  companyMembers: Array<{
    profile_id: string;
    company_id: string;
    is_active: boolean;
    designation?: string | null;
    role?: string | null;
    is_company_admin?: boolean;
  }>
): boolean {
  if (!authUid || !pCompanyId) return false;

  const allowedTokens = [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "company_administrator",
    "company_admin",
  ];

  const normalize = (val: string | null | undefined) => {
    if (!val) return "";
    return val.trim().toLowerCase().replace(/[\s\-_]+/g, "_");
  };

  return companyMembers.some((cm) => {
    if (cm.company_id !== pCompanyId) return false;
    if (cm.profile_id !== authUid) return false;
    if (cm.is_active !== true) return false;

    const normDesig = normalize(cm.designation);
    const normRole = normalize(cm.role);

    return allowedTokens.includes(normDesig) || allowedTokens.includes(normRole);
  });
}

const mockDb = [
  { profile_id: "u-pm", company_id: "c-1", is_active: true, designation: "Project Manager", is_company_admin: false },
  { profile_id: "u-pm-hyphen", company_id: "c-1", is_active: true, designation: "PROJECT-MANAGER", is_company_admin: false },
  { profile_id: "u-pm-under", company_id: "c-1", is_active: true, designation: "project_manager", is_company_admin: false },
  { profile_id: "u-pm-nosep", company_id: "c-1", is_active: true, designation: "projectmanager", is_company_admin: false },
  { profile_id: "u-ca", company_id: "c-1", is_active: true, designation: "Company Administrator", is_company_admin: false },
  { profile_id: "u-cadmin", company_id: "c-1", is_active: true, designation: "Company Admin", is_company_admin: false },
  { profile_id: "u-gw-admin", company_id: "c-1", is_active: true, designation: "General Worker", is_company_admin: true },
  { profile_id: "u-inactive-ceo", company_id: "c-1", is_active: false, designation: "CEO", is_company_admin: true },
  { profile_id: "u-cross-dir", company_id: "c-2", is_active: true, designation: "Director", is_company_admin: false },
];

assert(simulateVerifyBillingAccessSql("u-pm", "c-1", mockDb) === true, "SQL: 'Project Manager' with is_company_admin=false returns true");
assert(simulateVerifyBillingAccessSql("u-pm-hyphen", "c-1", mockDb) === true, "SQL: 'PROJECT-MANAGER' returns true");
assert(simulateVerifyBillingAccessSql("u-pm-under", "c-1", mockDb) === true, "SQL: 'project_manager' returns true");
assert(simulateVerifyBillingAccessSql("u-pm-nosep", "c-1", mockDb) === false, "SQL: 'projectmanager' (no separator) returns false");
assert(simulateVerifyBillingAccessSql("u-ca", "c-1", mockDb) === true, "SQL: 'Company Administrator' returns true");
assert(simulateVerifyBillingAccessSql("u-cadmin", "c-1", mockDb) === true, "SQL: 'Company Admin' returns true");
assert(simulateVerifyBillingAccessSql("u-gw-admin", "c-1", mockDb) === false, "SQL: 'General Worker' with is_company_admin=true returns false");
assert(simulateVerifyBillingAccessSql("u-inactive-ceo", "c-1", mockDb) === false, "SQL: Inactive CEO returns false");
assert(simulateVerifyBillingAccessSql("u-cross-dir", "c-1", mockDb) === false, "SQL: Member from company c-2 queried for c-1 returns false");
assert(simulateVerifyBillingAccessSql(null, "c-1", mockDb) === false, "SQL: Anonymous caller (auth.uid() IS NULL) returns false");

console.log("\n=======================================================");
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
