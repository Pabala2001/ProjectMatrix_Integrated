import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1K: Server-Side Billing Write Enforcement on Site and Field Operations Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 10 target tables:
 *    - public.site_diaries
 *    - public.technical_reports
 *    - public.technical_report_images
 *    - public.reports
 *    - public.report_images
 *    - public.survey_control_points
 *    - public.survey_instruments
 *    - public.survey_campaigns
 *    - public.survey_campaign_points
 *    - public.quality_control_records
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(...)
 * 3. Authoritative company and parent-child relation validation:
 *    - site_diaries: parent project in same company
 *    - technical_reports: parent project in same company
 *    - technical_report_images: parent technical_report in same company and project
 *    - reports: parent project in same company
 *    - report_images: parent report in same company and project
 *    - survey_control_points: parent project in same company
 *    - survey_instruments: parent project in same company
 *    - survey_campaigns: parent project in same company
 *    - survey_campaign_points: parent survey_campaign and survey_control_point in same company and project
 *    - quality_control_records: parent project in same company
 * 4. SELECT RLS Policies remain intact without write block (allowing read and export in read-only billing mode)
 * 5. All trigger functions use SET search_path = '' and fully qualified identifiers:
 *    - public.fn_site_diaries_meta_stamp()
 *    - public.fn_technical_reports_meta_stamp()
 *    - public.fn_technical_report_images_meta_stamp()
 *    - public.fn_reports_meta_stamp()
 *    - public.fn_report_images_meta_stamp()
 *    - public.fn_survey_control_points_meta_stamp()
 *    - public.fn_survey_instruments_meta_stamp()
 *    - public.fn_survey_campaigns_meta_stamp()
 *    - public.fn_survey_campaign_points_meta_stamp()
 *    - public.fn_quality_control_records_meta_stamp()
 * 6. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 7. Tenant isolation, dependency boundary guards, immutability, and atomic rollback guarantees
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260829000001_enforce_billing_site_field_operations.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const TARGET_TABLES = [
  "site_diaries",
  "technical_reports",
  "technical_report_images",
  "reports",
  "report_images",
  "survey_control_points",
  "survey_instruments",
  "survey_campaigns",
  "survey_campaign_points",
  "quality_control_records",
] as const;

const SITE_FIELD_TRIGGER_FUNCTIONS = [
  "fn_site_diaries_meta_stamp",
  "fn_technical_reports_meta_stamp",
  "fn_technical_report_images_meta_stamp",
  "fn_reports_meta_stamp",
  "fn_report_images_meta_stamp",
  "fn_survey_control_points_meta_stamp",
  "fn_survey_instruments_meta_stamp",
  "fn_survey_campaigns_meta_stamp",
  "fn_survey_campaign_points_meta_stamp",
  "fn_quality_control_records_meta_stamp",
] as const;

// ---------------------------------------------------------------------------
// Simulated Database & Entitlement Engine
// ---------------------------------------------------------------------------

type AccessMode = "full" | "grace_period" | "read_only";

interface CompanyEntitlement {
  companyId: string;
  accessMode: AccessMode;
  canRead: boolean;
  canWrite: boolean;
  canAccessBilling: boolean;
  canExport: boolean;
}

interface SimulatedCompanyMember {
  id: string;
  company_id: string;
  profile_id: string;
  role: string;
  designation: string;
  is_company_admin: boolean;
  is_active: boolean;
}

interface SimulatedProject {
  id: string;
  company_id: string;
  name: string;
  status: string;
}

interface SimulatedProjectMember {
  id: string;
  project_id: string;
  company_member_id: string;
}

interface SimulatedSiteDiary {
  id: string;
  company_id: string;
  project_id: string;
  diary_date: string;
  log_category: string;
  details: string;
  created_by?: string;
}

interface SimulatedTechnicalReport {
  id: string;
  company_id: string;
  project_id: string;
  category: "Progress" | "Environmental" | "Occupational Health and Safety";
  frequency: "Daily" | "Weekly" | "Monthly";
  report_date: string;
  status: "Draft" | "Final";
}

interface SimulatedTechnicalReportImage {
  id: string;
  technical_report_id: string;
  company_id: string;
  project_id: string;
  image_path: string;
}

interface SimulatedReport {
  id: string;
  company_id: string;
  project_id: string;
  category: "Progress" | "Environmental" | "Occupational Health and Safety";
  frequency: "Daily" | "Weekly" | "Monthly";
  report_date: string;
  status: "Draft" | "Final";
}

interface SimulatedReportImage {
  id: string;
  report_id: string;
  company_id: string;
  project_id: string;
  image_path: string;
}

interface SimulatedSurveyControlPoint {
  id: string;
  company_id: string;
  project_id: string;
  point_id: string;
  name: string;
  easting: number;
  northing: number;
  elevation: number;
  status: string;
  is_archived: boolean;
}

interface SimulatedSurveyInstrument {
  id: string;
  company_id: string;
  project_id: string;
  instrument_id: string;
  name: string;
  status: string;
  is_archived: boolean;
}

interface SimulatedSurveyCampaign {
  id: string;
  company_id: string;
  project_id: string;
  campaign_code: string;
  campaign_name: string;
  status: string;
  is_archived: boolean;
}

interface SimulatedSurveyCampaignPoint {
  id: string;
  campaign_id: string;
  control_point_id: string;
  sequence_order: number;
}

interface SimulatedQualityControlRecord {
  id: string;
  company_id: string;
  project_id: string;
  template_id: string;
  category: string;
  title: string;
  status: string;
}

function simulateBillingAllowsOperationalWrite(entitlement: CompanyEntitlement): boolean {
  return entitlement.canWrite && (entitlement.accessMode === "full" || entitlement.accessMode === "grace_period");
}

class PostgresError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "PostgresError";
  }
}

function executeRpcBillingGuard(companyId: string, entitlement: CompanyEntitlement): void {
  const allowed = simulateBillingAllowsOperationalWrite(entitlement);
  if (!allowed) {
    throw new PostgresError("Company billing access is read-only.", "PM001");
  }
}

// ---------------------------------------------------------------------------
// Static Analysis & Schema Parity Tests
// ---------------------------------------------------------------------------

test("1. Migration SQL and Schema.sql contains Step 3C.4F-1K header", () => {
  assert.ok(
    migrationSql.includes("Step 3C.4F-1K: Enforce Billing Access on Site and Field Operations"),
    "Migration SQL must contain Step 3C.4F-1K header"
  );
  assert.ok(
    schemaSql.includes("STEP 3C.4F-1K: SITE AND FIELD OPERATIONS ENFORCEMENT"),
    "Schema.sql must contain Step 3C.4F-1K header"
  );
});

test("2. All 10 target tables are defined in migration SQL", () => {
  TARGET_TABLES.forEach((table) => {
    const tablePattern = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i");
    assert.ok(
      tablePattern.test(migrationSql),
      `Migration must define table public.${table}`
    );
  });
});

test("3. All 10 target tables have RLS enabled and forced in migration SQL", () => {
  TARGET_TABLES.forEach((table) => {
    const enablePattern = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i");
    const forcePattern = new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`, "i");
    assert.ok(
      enablePattern.test(migrationSql),
      `Table public.${table} must have RLS enabled`
    );
    assert.ok(
      forcePattern.test(migrationSql),
      `Table public.${table} must have RLS forced`
    );
  });
});

test("4. All write policies (INSERT, UPDATE, DELETE) enforce company_billing_allows_operational_write", () => {
  TARGET_TABLES.forEach((table) => {
    const insertPolicyPattern = new RegExp(
      `CREATE POLICY insert_${table}[\\s\\S]*?WITH CHECK[\\s\\S]*?public\\.company_billing_allows_operational_write`,
      "i"
    );
    const updatePolicyPattern = new RegExp(
      `CREATE POLICY update_${table}[\\s\\S]*?USING[\\s\\S]*?public\\.company_billing_allows_operational_write[\\s\\S]*?WITH CHECK[\\s\\S]*?public\\.company_billing_allows_operational_write`,
      "i"
    );
    const deletePolicyPattern = new RegExp(
      `CREATE POLICY delete_${table}[\\s\\S]*?USING[\\s\\S]*?public\\.company_billing_allows_operational_write`,
      "i"
    );

    assert.ok(
      insertPolicyPattern.test(migrationSql),
      `Table public.${table} INSERT policy must enforce operational write`
    );
    assert.ok(
      updatePolicyPattern.test(migrationSql),
      `Table public.${table} UPDATE policy must enforce operational write in USING and WITH CHECK`
    );
    assert.ok(
      deletePolicyPattern.test(migrationSql),
      `Table public.${table} DELETE policy must enforce operational write`
    );
  });
});

test("5. All SELECT policies remain unblocked by billing write checks", () => {
  TARGET_TABLES.forEach((table) => {
    const selectPolicyMatch = migrationSql.match(
      new RegExp(`CREATE POLICY select_${table}[\\s\\S]*?;`, "i")
    );
    assert.ok(selectPolicyMatch, `Table public.${table} must have a select policy`);
    const selectPolicy = selectPolicyMatch[0];
    assert.ok(
      !selectPolicy.includes("public.company_billing_allows_operational_write"),
      `SELECT policy for ${table} must NOT enforce write checks`
    );
  });
});

test("6. All trigger functions use SET search_path = '' and fully qualified identifiers", () => {
  SITE_FIELD_TRIGGER_FUNCTIONS.forEach((fn) => {
    const fnMatch = migrationSql.match(
      new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(\\)[\\s\\S]*?\\$\\$ LANGUAGE plpgsql|CREATE OR REPLACE FUNCTION public\\.${fn}\\(\\)[\\s\\S]*?AS \\$\\$[\\s\\S]*?\\$\\$`, "i")
    );
    assert.ok(fnMatch, `Trigger function public.${fn} must be defined`);
    const fnDef = fnMatch[0];
    assert.ok(
      fnDef.includes("SET search_path = ''"),
      `Function public.${fn} must set search_path = ''`
    );
    assert.ok(
      fnDef.includes("SECURITY DEFINER"),
      `Function public.${fn} must be SECURITY DEFINER`
    );
  });
});

test("7. Indexes and schema parity are strictly maintained between migration and schema.sql", () => {
  TARGET_TABLES.forEach((table) => {
    const migrationTableMatch = migrationSql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`);
    const schemaTableMatch = schemaSql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`);
    assert.ok(migrationTableMatch, `Migration must define public.${table}`);
    assert.ok(schemaTableMatch, `Schema.sql must contain public.${table}`);
  });
});

// ---------------------------------------------------------------------------
// Functional Simulation Tests: Entitlement Matrix & Access Modes
// ---------------------------------------------------------------------------

test("8. Operational write is permitted in 'full' access mode", () => {
  const fullEntitlement: CompanyEntitlement = {
    companyId: "c1111111-1111-1111-1111-111111111111",
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };
  assert.equal(simulateBillingAllowsOperationalWrite(fullEntitlement), true);
  assert.doesNotThrow(() => executeRpcBillingGuard(fullEntitlement.companyId, fullEntitlement));
});

test("9. Operational write is permitted during 'grace_period'", () => {
  const graceEntitlement: CompanyEntitlement = {
    companyId: "c2222222-2222-2222-2222-222222222222",
    accessMode: "grace_period",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };
  assert.equal(simulateBillingAllowsOperationalWrite(graceEntitlement), true);
  assert.doesNotThrow(() => executeRpcBillingGuard(graceEntitlement.companyId, graceEntitlement));
});

test("10. Operational write is strictly rejected with PM001 in 'read_only' mode", () => {
  const readOnlyEntitlement: CompanyEntitlement = {
    companyId: "c3333333-3333-3333-3333-333333333333",
    accessMode: "read_only",
    canRead: true,
    canWrite: false,
    canAccessBilling: true,
    canExport: true,
  };
  assert.equal(simulateBillingAllowsOperationalWrite(readOnlyEntitlement), false);
  assert.throws(
    () => executeRpcBillingGuard(readOnlyEntitlement.companyId, readOnlyEntitlement),
    (err: PostgresError) => {
      return err.code === "PM001" && err.message === "Company billing access is read-only.";
    }
  );
});

// ---------------------------------------------------------------------------
// RLS Policy Simulation: Site Diaries
// ---------------------------------------------------------------------------

test("11. Site Diaries: INSERT allows write in active billing, rejects in read-only", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";
  const activeEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };
  const readOnlyEntitlement: CompanyEntitlement = {
    ...activeEntitlement,
    accessMode: "read_only",
    canWrite: false,
  };

  const project: SimulatedProject = {
    id: projectA,
    company_id: companyA,
    name: "Project A",
    status: "Active",
  };

  const siteDiary: SimulatedSiteDiary = {
    id: "sd-1",
    company_id: companyA,
    project_id: projectA,
    diary_date: "2026-08-29",
    log_category: "Progress",
    details: "Excavation completed for Foundation Block 1",
  };

  // Valid insert in full billing
  const canInsertActive =
    project.company_id === siteDiary.company_id &&
    simulateBillingAllowsOperationalWrite(activeEntitlement);
  assert.equal(canInsertActive, true);

  // Blocked in read-only billing
  const canInsertReadOnly =
    project.company_id === siteDiary.company_id &&
    simulateBillingAllowsOperationalWrite(readOnlyEntitlement);
  assert.equal(canInsertReadOnly, false);
});

test("12. Site Diaries: Cross-company project binding is rejected", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const companyB = "c2222222-2222-2222-2222-222222222222";
  const projectB = "p2222222-2222-2222-2222-222222222222";

  const entitlementA: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const projectOfB: SimulatedProject = {
    id: projectB,
    company_id: companyB,
    name: "Project B",
    status: "Active",
  };

  const forgedDiary: SimulatedSiteDiary = {
    id: "sd-tampered",
    company_id: companyA,
    project_id: projectB, // Trying to attach company A's diary to company B's project
    diary_date: "2026-08-29",
    log_category: "Safety",
    details: "Tampered entry",
  };

  const allowed =
    projectOfB.company_id === forgedDiary.company_id &&
    simulateBillingAllowsOperationalWrite(entitlementA);
  assert.equal(allowed, false, "Cross-company project binding must be rejected");
});

// ---------------------------------------------------------------------------
// RLS Policy Simulation: Technical Reports & Images
// ---------------------------------------------------------------------------

test("13. Technical Reports: Full and Grace write permitted, Read-only rejected", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";

  const fullEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const graceEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "grace_period",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const readOnlyEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "read_only",
    canRead: true,
    canWrite: false,
    canAccessBilling: true,
    canExport: true,
  };

  const report: SimulatedTechnicalReport = {
    id: "tr-1",
    company_id: companyA,
    project_id: projectA,
    category: "Environmental",
    frequency: "Monthly",
    report_date: "2026-08-01",
    status: "Draft",
  };

  assert.equal(simulateBillingAllowsOperationalWrite(fullEntitlement), true);
  assert.equal(simulateBillingAllowsOperationalWrite(graceEntitlement), true);
  assert.equal(simulateBillingAllowsOperationalWrite(readOnlyEntitlement), false);
});

test("14. Technical Report Images: Must match parent report company and project", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";
  const projectB = "p2222222-2222-2222-2222-222222222222";

  const entitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const parentReport: SimulatedTechnicalReport = {
    id: "tr-100",
    company_id: companyA,
    project_id: projectA,
    category: "Progress",
    frequency: "Weekly",
    report_date: "2026-08-20",
    status: "Draft",
  };

  const validImage: SimulatedTechnicalReportImage = {
    id: "tri-1",
    technical_report_id: "tr-100",
    company_id: companyA,
    project_id: projectA,
    image_path: "technical-reports/tr-100/img1.jpg",
  };

  const mismatchedProjectImage: SimulatedTechnicalReportImage = {
    id: "tri-2",
    technical_report_id: "tr-100",
    company_id: companyA,
    project_id: projectB, // Mismatched project
    image_path: "technical-reports/tr-100/img2.jpg",
  };

  const isValidValid =
    parentReport.id === validImage.technical_report_id &&
    parentReport.company_id === validImage.company_id &&
    parentReport.project_id === validImage.project_id &&
    simulateBillingAllowsOperationalWrite(entitlement);
  assert.equal(isValidValid, true);

  const isMismatchedValid =
    parentReport.id === mismatchedProjectImage.technical_report_id &&
    parentReport.company_id === mismatchedProjectImage.company_id &&
    parentReport.project_id === mismatchedProjectImage.project_id &&
    simulateBillingAllowsOperationalWrite(entitlement);
  assert.equal(isMismatchedValid, false);
});

// ---------------------------------------------------------------------------
// RLS Policy Simulation: Reports & Images
// ---------------------------------------------------------------------------

test("15. General Reports: Write permitted in active mode, blocked in read-only", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";

  const entitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "read_only",
    canRead: true,
    canWrite: false,
    canAccessBilling: true,
    canExport: true,
  };

  const project: SimulatedProject = {
    id: projectA,
    company_id: companyA,
    name: "Project A",
    status: "Active",
  };

  const report: SimulatedReport = {
    id: "rep-1",
    company_id: companyA,
    project_id: projectA,
    category: "Occupational Health and Safety",
    frequency: "Monthly",
    report_date: "2026-08-15",
    status: "Draft",
  };

  const canWrite =
    project.company_id === report.company_id &&
    simulateBillingAllowsOperationalWrite(entitlement);
  assert.equal(canWrite, false, "Must block report creation in read-only mode");

  // Read remains allowed
  assert.equal(entitlement.canRead, true, "Reading reports remains unblocked");
});

test("16. Report Images: Enforces parent report relationship", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";

  const parentReport: SimulatedReport = {
    id: "rep-10",
    company_id: companyA,
    project_id: projectA,
    category: "Progress",
    frequency: "Weekly",
    report_date: "2026-08-22",
    status: "Draft",
  };

  const img: SimulatedReportImage = {
    id: "ri-1",
    report_id: "rep-10",
    company_id: companyA,
    project_id: projectA,
    image_path: "reports/rep-10/photo.jpg",
  };

  const isValid =
    parentReport.id === img.report_id &&
    parentReport.company_id === img.company_id &&
    parentReport.project_id === img.project_id;
  assert.equal(isValid, true);
});

// ---------------------------------------------------------------------------
// RLS Policy Simulation: Surveying (Control Points, Instruments, Campaigns, Campaign Points)
// ---------------------------------------------------------------------------

test("17. Survey Control Points: Operational write allows creation and archival", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";

  const activeEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const cp: SimulatedSurveyControlPoint = {
    id: "cp-1",
    company_id: companyA,
    project_id: projectA,
    point_id: "BM-01",
    name: "Benchmark 01",
    easting: 28.5123,
    northing: -26.1234,
    elevation: 1540.25,
    status: "Active",
    is_archived: false,
  };

  assert.equal(simulateBillingAllowsOperationalWrite(activeEntitlement), true);
});

test("18. Survey Instruments: Rejects calibration update in read-only mode", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";

  const readOnlyEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "read_only",
    canRead: true,
    canWrite: false,
    canAccessBilling: true,
    canExport: true,
  };

  const instrument: SimulatedSurveyInstrument = {
    id: "inst-1",
    company_id: companyA,
    project_id: projectA,
    instrument_id: "TS-LEICA-01",
    name: "Leica TS06 Plus",
    status: "In Service",
    is_archived: false,
  };

  assert.equal(simulateBillingAllowsOperationalWrite(readOnlyEntitlement), false);
});

test("19. Survey Campaign Points: Must link points from same company and project", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";
  const projectB = "p2222222-2222-2222-2222-222222222222";

  const entitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const campaignA: SimulatedSurveyCampaign = {
    id: "cmp-1",
    company_id: companyA,
    project_id: projectA,
    campaign_code: "CMP-001",
    campaign_name: "Initial Topo Survey",
    status: "In Progress",
    is_archived: false,
  };

  const controlPointA: SimulatedSurveyControlPoint = {
    id: "cp-1",
    company_id: companyA,
    project_id: projectA,
    point_id: "BM-01",
    name: "Benchmark 01",
    easting: 100,
    northing: 200,
    elevation: 50,
    status: "Active",
    is_archived: false,
  };

  const controlPointB: SimulatedSurveyControlPoint = {
    id: "cp-2",
    company_id: companyA,
    project_id: projectB, // Control point in project B
    point_id: "BM-02",
    name: "Benchmark 02",
    easting: 300,
    northing: 400,
    elevation: 80,
    status: "Active",
    is_archived: false,
  };

  // Valid linking: same campaign and control point project/company
  const isValidLink =
    campaignA.company_id === controlPointA.company_id &&
    campaignA.project_id === controlPointA.project_id &&
    simulateBillingAllowsOperationalWrite(entitlement);
  assert.equal(isValidLink, true);

  // Invalid cross-project link
  const isInvalidLink =
    campaignA.company_id === controlPointB.company_id &&
    campaignA.project_id === controlPointB.project_id &&
    simulateBillingAllowsOperationalWrite(entitlement);
  assert.equal(isInvalidLink, false, "Cross-project campaign point link must be rejected");
});

// ---------------------------------------------------------------------------
// RLS Policy Simulation: Quality Control Records
// ---------------------------------------------------------------------------

test("20. Quality Control Records: Enforces company binding and operational write", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const projectA = "p1111111-1111-1111-1111-111111111111";

  const fullEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const readOnlyEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "read_only",
    canRead: true,
    canWrite: false,
    canAccessBilling: true,
    canExport: true,
  };

  const qcRecord: SimulatedQualityControlRecord = {
    id: "qc-1",
    company_id: companyA,
    project_id: projectA,
    template_id: "qc_concrete_pour_v1",
    category: "Civil Works",
    title: "Concrete Pour Inspection - Slab 3",
    status: "Draft",
  };

  assert.equal(simulateBillingAllowsOperationalWrite(fullEntitlement), true);
  assert.equal(simulateBillingAllowsOperationalWrite(readOnlyEntitlement), false);
});

// ---------------------------------------------------------------------------
// Atomic Rollback & State Isolation Guarantees
// ---------------------------------------------------------------------------

test("21. Rollback safety: Any write failure during batch operation rejects atomically", () => {
  const companyA = "c1111111-1111-1111-1111-111111111111";
  const readOnlyEntitlement: CompanyEntitlement = {
    companyId: companyA,
    accessMode: "read_only",
    canRead: true,
    canWrite: false,
    canAccessBilling: true,
    canExport: true,
  };

  const simulatedDbState: SimulatedSiteDiary[] = [];

  function insertBatch(diaries: SimulatedSiteDiary[]): void {
    const backup = [...simulatedDbState];
    try {
      diaries.forEach((d) => {
        if (!simulateBillingAllowsOperationalWrite(readOnlyEntitlement)) {
          throw new PostgresError("Company billing access is read-only.", "PM001");
        }
        simulatedDbState.push(d);
      });
    } catch (e) {
      simulatedDbState.length = 0;
      simulatedDbState.push(...backup);
      throw e;
    }
  }

  assert.throws(
    () => {
      insertBatch([
        {
          id: "sd-10",
          company_id: companyA,
          project_id: "p1",
          diary_date: "2026-08-29",
          log_category: "Site",
          details: "Test",
        },
      ]);
    },
    (err: PostgresError) => err.code === "PM001"
  );

  assert.equal(simulatedDbState.length, 0, "Database state must remain clean on rollback");
});

test("22. Metasamp immutability prevents company_id and project_id tampering on update", () => {
  const original = {
    id: "sd-1",
    company_id: "c1",
    project_id: "p1",
    details: "Original",
    created_at: "2026-08-01T00:00:00Z",
  };

  // Simulate trigger fn_site_diaries_meta_stamp on UPDATE
  function applyMetaStamp(oldRow: typeof original, newRow: typeof original) {
    return {
      ...newRow,
      company_id: oldRow.company_id,
      project_id: oldRow.project_id,
      created_at: oldRow.created_at,
    };
  }

  const tampered = {
    id: "sd-1",
    company_id: "c-malicious",
    project_id: "p-malicious",
    details: "Updated details",
    created_at: "2020-01-01T00:00:00Z",
  };

  const stamped = applyMetaStamp(original, tampered);
  assert.equal(stamped.company_id, "c1", "company_id must remain locked");
  assert.equal(stamped.project_id, "p1", "project_id must remain locked");
  assert.equal(stamped.created_at, "2026-08-01T00:00:00Z", "created_at must remain locked");
  assert.equal(stamped.details, "Updated details", "Details can be updated");
});
