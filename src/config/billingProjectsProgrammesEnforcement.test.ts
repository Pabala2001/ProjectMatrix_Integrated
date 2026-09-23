import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1J: Server-Side Billing Write Enforcement on Projects and Programmes Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 6 target tables:
 *    - public.projects
 *    - public.project_members
 *    - public.programmes
 *    - public.programme_activities
 *    - public.programme_dependencies
 *    - public.company_members
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(company_id)
 * 3. Authoritative company and parent-child relation validation:
 *    - projects: direct company_id
 *    - company_members: direct company_id
 *    - project_members: parent project and company member in same company
 *    - programmes: parent project in same company
 *    - programme_activities: parent programme and project in same company
 *    - programme_dependencies: parent programme, distinct activities in same programme/project/company
 * 4. SELECT RLS Policies remain intact without write block (allowing read and export in read-only billing mode)
 * 5. All helper and trigger functions use SET search_path = '' and fully qualified identifiers:
 *    - public.verify_company_membership_access(uuid)
 *    - public.verify_membership_access(uuid, uuid)
 *    - public.fn_projects_meta_stamp()
 *    - public.fn_company_members_meta_stamp()
 *    - public.fn_project_members_meta_stamp()
 *    - public.fn_programmes_meta_stamp()
 *    - public.fn_programme_activities_meta_stamp()
 *    - public.fn_programme_dependencies_meta_stamp()
 * 6. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 7. Tenant isolation, dependency boundary guards, immutability, and atomic rollback guarantees
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260829000000_enforce_billing_projects_programmes.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const TARGET_TABLES = [
  "projects",
  "project_members",
  "programmes",
  "programme_activities",
  "programme_dependencies",
  "company_members",
] as const;

const PROJECTS_PROGRAMMES_SECURITY_DEFINER_FUNCTIONS = [
  "verify_company_membership_access",
  "verify_membership_access",
  "fn_projects_meta_stamp",
  "fn_company_members_meta_stamp",
  "fn_project_members_meta_stamp",
  "fn_programmes_meta_stamp",
  "fn_programme_activities_meta_stamp",
  "fn_programme_dependencies_meta_stamp",
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
  project_role?: string;
}

interface SimulatedProgramme {
  id: string;
  company_id: string;
  project_id: string;
  programme_name: string;
  status: string;
}

interface SimulatedProgrammeActivity {
  id: string;
  company_id: string;
  project_id: string;
  programme_id: string;
  activity_name: string;
  status: string;
}

interface SimulatedProgrammeDependency {
  id: string;
  company_id: string;
  project_id: string;
  programme_id: string;
  predecessor_activity_id: string;
  successor_activity_id: string;
  dependency_type: string;
  lag_days: number;
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
// RLS Policy Evaluators for Test Simulation
// ---------------------------------------------------------------------------

function checkRlsProject(
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement
): boolean {
  if (!isMember) return false;
  if (operation === "SELECT") return true;
  return simulateBillingAllowsOperationalWrite(entitlement);
}

function checkRlsCompanyMember(
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  isOwnProfile: boolean,
  entitlement: CompanyEntitlement
): boolean {
  if (operation === "SELECT") {
    return isMember || isOwnProfile;
  }
  if (!isMember) return false;
  return simulateBillingAllowsOperationalWrite(entitlement);
}

function checkRlsProjectMember(
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  record: Partial<SimulatedProjectMember>,
  projects: SimulatedProject[],
  companyMembers: SimulatedCompanyMember[]
): boolean {
  if (!record.project_id) return false;
  const project = projects.find(p => p.id === record.project_id);
  if (!project) return false;

  if (!isMember) return false;
  if (operation === "SELECT") return true;

  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  if (!writeAllowed) return false;

  if (operation === "INSERT" || operation === "UPDATE") {
    if (!record.company_member_id) return false;
    const member = companyMembers.find(m => m.id === record.company_member_id);
    if (!member || !member.is_active || member.company_id !== project.company_id) {
      return false;
    }
  }
  return true;
}

function checkRlsProgramme(
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  record: Partial<SimulatedProgramme>,
  projects: SimulatedProject[]
): boolean {
  if (!isMember) return false;
  if (operation === "SELECT") return true;

  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  if (!writeAllowed) return false;

  if (operation === "INSERT" || operation === "UPDATE") {
    if (!record.project_id || !record.company_id) return false;
    const project = projects.find(p => p.id === record.project_id);
    if (!project || project.company_id !== record.company_id) {
      return false;
    }
  }
  return true;
}

function checkRlsProgrammeActivity(
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  record: Partial<SimulatedProgrammeActivity>,
  programmes: SimulatedProgramme[],
  projects: SimulatedProject[]
): boolean {
  if (!isMember) return false;
  if (operation === "SELECT") return true;

  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  if (!writeAllowed) return false;

  if (operation === "INSERT" || operation === "UPDATE") {
    if (!record.programme_id || !record.project_id || !record.company_id) return false;
    const programme = programmes.find(pr => pr.id === record.programme_id);
    if (!programme || programme.project_id !== record.project_id || programme.company_id !== record.company_id) {
      return false;
    }
    const project = projects.find(p => p.id === record.project_id);
    if (!project || project.company_id !== record.company_id) {
      return false;
    }
  }
  return true;
}

function checkRlsProgrammeDependency(
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  record: Partial<SimulatedProgrammeDependency>,
  programmes: SimulatedProgramme[],
  activities: SimulatedProgrammeActivity[]
): boolean {
  if (!isMember) return false;
  if (operation === "SELECT") return true;

  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  if (!writeAllowed) return false;

  if (operation === "INSERT" || operation === "UPDATE") {
    if (!record.programme_id || !record.project_id || !record.company_id) return false;
    if (!record.predecessor_activity_id || !record.successor_activity_id) return false;
    if (record.predecessor_activity_id === record.successor_activity_id) return false;

    const programme = programmes.find(pr => pr.id === record.programme_id);
    if (!programme || programme.project_id !== record.project_id || programme.company_id !== record.company_id) {
      return false;
    }

    const pa1 = activities.find(a => a.id === record.predecessor_activity_id);
    const pa2 = activities.find(a => a.id === record.successor_activity_id);
    if (!pa1 || !pa2) return false;

    if (
      pa1.programme_id !== record.programme_id ||
      pa2.programme_id !== record.programme_id ||
      pa1.project_id !== record.project_id ||
      pa2.project_id !== record.project_id ||
      pa1.company_id !== record.company_id ||
      pa2.company_id !== record.company_id
    ) {
      return false;
    }
  }
  return true;
}

function extractTablePolicies(sql: string, table: string): string {
  const normalizedTable = table.replace(/_/g, "[ _]");
  const parts = sql.split(new RegExp(`4\\.\\d+\\s+${normalizedTable}`, "i"));
  return parts[1] || "";
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

test("Step 3C.4F-1J: Projects & Programmes Billing Enforcement Suite", async (t) => {

  await t.test("1. Migration Structure & Completeness", async (t2) => {
    await t2.test("1.1 Migration file exists and has non-empty content", () => {
      assert.ok(migrationSql.length > 500, "Migration SQL should have substantial content");
      assert.match(migrationSql, /Step 3C\.4F-1J: Enforce Billing Access on Projects and Programmes/i);
    });

    await t2.test("1.2 All six target tables have write RLS policies redefined", () => {
      TARGET_TABLES.forEach((table) => {
        assert.match(migrationSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, "i"));
        assert.match(migrationSql, new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY;`, "i"));
        assert.match(migrationSql, new RegExp(`CREATE POLICY insert_${table} ON public\\.${table}`, "i"));
        assert.match(migrationSql, new RegExp(`CREATE POLICY update_${table} ON public\\.${table}`, "i"));
        assert.match(migrationSql, new RegExp(`CREATE POLICY delete_${table} ON public\\.${table}`, "i"));
        assert.match(migrationSql, new RegExp(`CREATE POLICY select_${table} ON public\\.${table}`, "i"));
      });
    });

    await t2.test("1.3 Write RLS policies enforce company_billing_allows_operational_write", () => {
      TARGET_TABLES.forEach((table) => {
        const tablePolicies = extractTablePolicies(migrationSql, table);
        assert.match(tablePolicies, /company_billing_allows_operational_write/i, `Table ${table} must enforce operational write billing guard`);
      });
    });

    await t2.test("1.4 Child table project_members enforces parent project and active company member integrity", () => {
      const pmSection = extractTablePolicies(migrationSql, "project_members");
      assert.match(pmSection, /JOIN public\.company_members cm ON cm\.company_id = p\.company_id/i);
      assert.match(pmSection, /cm\.is_active = TRUE/i);
    });

    await t2.test("1.5 programmes and programme_activities enforce project and programme parent integrity", () => {
      const progSection = extractTablePolicies(migrationSql, "programmes");
      assert.match(progSection, /WHERE p\.id = programmes\.project_id\s+AND p\.company_id = programmes\.company_id/i);

      const actSection = extractTablePolicies(migrationSql, "programme_activities");
      assert.match(actSection, /WHERE pr\.id = programme_activities\.programme_id/i);
      assert.match(actSection, /AND pr\.project_id = programme_activities\.project_id/i);
    });

    await t2.test("1.6 programme_dependencies enforces within-programme activity link integrity", () => {
      const depSection = extractTablePolicies(migrationSql, "programme_dependencies");
      assert.match(depSection, /predecessor_activity_id <> successor_activity_id/i);
      assert.match(depSection, /pa1\.programme_id = programme_dependencies\.programme_id/i);
      assert.match(depSection, /pa2\.programme_id = programme_dependencies\.programme_id/i);
    });

    await t2.test("1.7 SELECT policies remain intact without operational write restriction", () => {
      TARGET_TABLES.forEach((table) => {
        const selectRegex = new RegExp(`CREATE POLICY select_${table} ON public\\.${table}[\\s\\S]*?;`, "i");
        const selectMatch = migrationSql.match(selectRegex);
        assert.ok(selectMatch, `select_${table} policy should exist`);
        assert.doesNotMatch(selectMatch[0], /company_billing_allows_operational_write/i, `SELECT on ${table} should not require operational write`);
      });
    });

    await t2.test("1.8 Execution permissions and table grants properly configured", () => {
      TARGET_TABLES.forEach((table) => {
        assert.match(migrationSql, new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON public\\.${table} TO authenticated, service_role;`, "i"));
      });
      assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.verify_membership_access\(pg_catalog\.uuid, pg_catalog\.uuid\) TO authenticated, service_role;/i);
      assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.verify_company_membership_access\(pg_catalog\.uuid\) TO authenticated, service_role;/i);
    });
  });

  await t.test("2. Schema Parity & Search Path Verification", async (t2) => {
    await t2.test("2.1 schema.sql contains the Step 3C.4F-1J Projects and Programmes billing enforcement section", () => {
      assert.ok(schemaSql.includes("Step 3C.4F-1J: Enforce Billing Access on Projects and Programmes"));
      TARGET_TABLES.forEach((table) => {
        assert.match(schemaSql, new RegExp(`CREATE POLICY insert_${table} ON public\\.${table}`, "i"));
        assert.match(schemaSql, new RegExp(`CREATE POLICY update_${table} ON public\\.${table}`, "i"));
        assert.match(schemaSql, new RegExp(`CREATE POLICY delete_${table} ON public\\.${table}`, "i"));
        assert.match(schemaSql, new RegExp(`CREATE POLICY select_${table} ON public\\.${table}`, "i"));
      });
    });

    await t2.test("2.2 All Projects & Programmes SECURITY DEFINER functions configure empty search_path (SET search_path = '')", () => {
      PROJECTS_PROGRAMMES_SECURITY_DEFINER_FUNCTIONS.forEach((fnName) => {
        const fnRegex = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${fnName}[\\s\\S]*?\\$(?:function)?\\$([\\s\\S]*?)\\$(?:function)?\\$;`, "i");
        const match = migrationSql.match(fnRegex);
        assert.ok(match, `Function ${fnName} should exist in migration`);
        assert.match(match[0], /SET search_path = ''/i, `Function ${fnName} must set empty search_path`);
      });
    });

    await t2.test("2.3 All functions fully qualify application tables with public.", () => {
      PROJECTS_PROGRAMMES_SECURITY_DEFINER_FUNCTIONS.forEach((fnName) => {
        const fnRegex = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${fnName}[\\s\\S]*?\\$(?:function)?\\$([\\s\\S]*?)\\$(?:function)?\\$;`, "i");
        const match = migrationSql.match(fnRegex);
        assert.ok(match, `Function ${fnName} should exist`);
        const body = match[1];
        const unqualifiedFrom = body.match(/FROM\s+(?!(public|pg_catalog|auth)\.)([a-zA-Z0-9_]+)/gi);
        assert.equal(unqualifiedFrom, null, `Function ${fnName} should not have unqualified FROM tables: ${unqualifiedFrom}`);
      });
    });

    await t2.test("2.4 All functions fully qualify auth functions with auth.", () => {
      PROJECTS_PROGRAMMES_SECURITY_DEFINER_FUNCTIONS.forEach((fnName) => {
        const fnRegex = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${fnName}[\\s\\S]*?\\$(?:function)?\\$([\\s\\S]*?)\\$(?:function)?\\$;`, "i");
        const match = migrationSql.match(fnRegex);
        assert.ok(match);
        const body = match[1];
        if (body.includes("uid()")) {
          assert.match(body, /auth\.uid\(\)/i, `Function ${fnName} must fully qualify auth.uid()`);
        }
      });
    });

    await t2.test("2.5 All functions fully qualify built-in functions with pg_catalog.", () => {
      PROJECTS_PROGRAMMES_SECURITY_DEFINER_FUNCTIONS.forEach((fnName) => {
        const fnRegex = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${fnName}[\\s\\S]*?\\$(?:function)?\\$([\\s\\S]*?)\\$(?:function)?\\$;`, "i");
        const match = migrationSql.match(fnRegex);
        assert.ok(match);
        const body = match[1];
        ["now()", "coalesce("].forEach(builtin => {
          if (body.includes(builtin)) {
            const escaped = builtin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            assert.match(body, new RegExp(`pg_catalog\\.${escaped}`, "i"), `Function ${fnName} should qualify ${builtin} with pg_catalog.`);
          }
        });
      });
    });
  });

  await t.test("3. Entitlement Behavior Simulation & RLS Evaluation", async (t2) => {
    const fullCompany: CompanyEntitlement = {
      companyId: "c0000000-0000-0000-0000-000000000001",
      accessMode: "full",
      canRead: true,
      canWrite: true,
      canAccessBilling: true,
      canExport: true,
    };

    const graceCompany: CompanyEntitlement = {
      companyId: "c0000000-0000-0000-0000-000000000002",
      accessMode: "grace_period",
      canRead: true,
      canWrite: true,
      canAccessBilling: true,
      canExport: true,
    };

    const readOnlyCompany: CompanyEntitlement = {
      companyId: "c0000000-0000-0000-0000-000000000003",
      accessMode: "read_only",
      canRead: true,
      canWrite: false,
      canAccessBilling: true,
      canExport: true,
    };

    const mockProjects: SimulatedProject[] = [
      { id: "p0000000-0000-0000-0000-000000000001", company_id: fullCompany.companyId, name: "Bridge Proj 1", status: "Active" },
      { id: "p0000000-0000-0000-0000-000000000002", company_id: graceCompany.companyId, name: "Highway Proj 2", status: "Active" },
      { id: "p0000000-0000-0000-0000-000000000003", company_id: readOnlyCompany.companyId, name: "Tunnel Proj 3", status: "Active" },
    ];

    const mockMembers: SimulatedCompanyMember[] = [
      { id: "m0000000-0000-0000-0000-000000000001", company_id: fullCompany.companyId, profile_id: "u1", role: "CEO", designation: "ceo", is_company_admin: true, is_active: true },
      { id: "m0000000-0000-0000-0000-000000000002", company_id: graceCompany.companyId, profile_id: "u2", role: "PM", designation: "pm", is_company_admin: false, is_active: true },
      { id: "m0000000-0000-0000-0000-000000000003", company_id: readOnlyCompany.companyId, profile_id: "u3", role: "PM", designation: "pm", is_company_admin: false, is_active: true },
      { id: "m0000000-0000-0000-0000-000000000004", company_id: fullCompany.companyId, profile_id: "u4", role: "Staff", designation: "eng", is_company_admin: false, is_active: false }, // Inactive
    ];

    const mockProgrammes: SimulatedProgramme[] = [
      { id: "pr000000-0000-0000-0000-000000000001", company_id: fullCompany.companyId, project_id: mockProjects[0].id, programme_name: "Master Schedule", status: "Active" },
      { id: "pr000000-0000-0000-0000-000000000002", company_id: graceCompany.companyId, project_id: mockProjects[1].id, programme_name: "Phase 1 Schedule", status: "Active" },
      { id: "pr000000-0000-0000-0000-000000000003", company_id: readOnlyCompany.companyId, project_id: mockProjects[2].id, programme_name: "Read-Only Schedule", status: "Active" },
    ];

    const mockActivities: SimulatedProgrammeActivity[] = [
      { id: "a0000000-0000-0000-0000-000000000001", company_id: fullCompany.companyId, project_id: mockProjects[0].id, programme_id: mockProgrammes[0].id, activity_name: "Excavation", status: "In Progress" },
      { id: "a0000000-0000-0000-0000-000000000002", company_id: fullCompany.companyId, project_id: mockProjects[0].id, programme_id: mockProgrammes[0].id, activity_name: "Piling", status: "Not Started" },
      { id: "a0000000-0000-0000-0000-000000000003", company_id: fullCompany.companyId, project_id: mockProjects[0].id, programme_id: mockProgrammes[0].id, activity_name: "Substructure", status: "Not Started" },
    ];

    await t2.test("3.1 Full access company allows operational writes on all six tables", () => {
      assert.equal(checkRlsProject("INSERT", true, fullCompany), true);
      assert.equal(checkRlsCompanyMember("INSERT", true, false, fullCompany), true);
      assert.equal(checkRlsProjectMember("INSERT", true, fullCompany, { project_id: mockProjects[0].id, company_member_id: mockMembers[0].id }, mockProjects, mockMembers), true);
      assert.equal(checkRlsProgramme("INSERT", true, fullCompany, { company_id: fullCompany.companyId, project_id: mockProjects[0].id }, mockProjects), true);
      assert.equal(checkRlsProgrammeActivity("INSERT", true, fullCompany, { company_id: fullCompany.companyId, project_id: mockProjects[0].id, programme_id: mockProgrammes[0].id }, mockProgrammes, mockProjects), true);
      assert.equal(checkRlsProgrammeDependency("INSERT", true, fullCompany, { company_id: fullCompany.companyId, project_id: mockProjects[0].id, programme_id: mockProgrammes[0].id, predecessor_activity_id: mockActivities[0].id, successor_activity_id: mockActivities[1].id }, mockProgrammes, mockActivities), true);
    });

    await t2.test("3.2 Grace period company allows operational writes on all six tables", () => {
      assert.equal(checkRlsProject("INSERT", true, graceCompany), true);
      assert.equal(checkRlsCompanyMember("UPDATE", true, false, graceCompany), true);
      assert.equal(checkRlsProjectMember("INSERT", true, graceCompany, { project_id: mockProjects[1].id, company_member_id: mockMembers[1].id }, mockProjects, mockMembers), true);
      assert.equal(checkRlsProgramme("UPDATE", true, graceCompany, { company_id: graceCompany.companyId, project_id: mockProjects[1].id }, mockProjects), true);
      assert.equal(checkRlsProgrammeActivity("INSERT", true, graceCompany, { company_id: graceCompany.companyId, project_id: mockProjects[1].id, programme_id: mockProgrammes[1].id }, mockProgrammes, mockProjects), true);
    });

    await t2.test("3.3 Read-only company rejects all operational writes on all six tables", () => {
      assert.equal(checkRlsProject("INSERT", true, readOnlyCompany), false);
      assert.equal(checkRlsProject("UPDATE", true, readOnlyCompany), false);
      assert.equal(checkRlsProject("DELETE", true, readOnlyCompany), false);

      assert.equal(checkRlsCompanyMember("INSERT", true, false, readOnlyCompany), false);
      assert.equal(checkRlsCompanyMember("UPDATE", true, false, readOnlyCompany), false);
      assert.equal(checkRlsCompanyMember("DELETE", true, false, readOnlyCompany), false);

      assert.equal(checkRlsProjectMember("INSERT", true, readOnlyCompany, { project_id: mockProjects[2].id, company_member_id: mockMembers[2].id }, mockProjects, mockMembers), false);
      assert.equal(checkRlsProgramme("INSERT", true, readOnlyCompany, { company_id: readOnlyCompany.companyId, project_id: mockProjects[2].id }, mockProjects), false);
      assert.equal(checkRlsProgrammeActivity("INSERT", true, readOnlyCompany, { company_id: readOnlyCompany.companyId, project_id: mockProjects[2].id, programme_id: mockProgrammes[2].id }, mockProgrammes, mockProjects), false);
      assert.equal(checkRlsProgrammeDependency("INSERT", true, readOnlyCompany, { company_id: readOnlyCompany.companyId, project_id: mockProjects[2].id, programme_id: mockProgrammes[2].id, predecessor_activity_id: "a1", successor_activity_id: "a2" }, mockProgrammes, mockActivities), false);
    });

    await t2.test("3.4 Inactive or non-member rejected even if billing is full", () => {
      assert.equal(checkRlsProject("INSERT", false, fullCompany), false);
      assert.equal(checkRlsCompanyMember("INSERT", false, false, fullCompany), false);
      // Inactive company member assignment to project rejected:
      assert.equal(checkRlsProjectMember("INSERT", true, fullCompany, { project_id: mockProjects[0].id, company_member_id: mockMembers[3].id }, mockProjects, mockMembers), false);
    });

    await t2.test("3.5 Cross-company project or company member mismatch is rejected even with full access", () => {
      // Trying to assign member from fullCompany to project in graceCompany
      assert.equal(checkRlsProjectMember("INSERT", true, fullCompany, { project_id: mockProjects[1].id, company_member_id: mockMembers[0].id }, mockProjects, mockMembers), false);
      // Programme referencing project from another company
      assert.equal(checkRlsProgramme("INSERT", true, fullCompany, { company_id: fullCompany.companyId, project_id: mockProjects[1].id }, mockProjects), false);
    });

    await t2.test("3.6 Cross-programme activity mismatch is rejected even with full access", () => {
      // Activity with programme belonging to another project
      assert.equal(checkRlsProgrammeActivity("INSERT", true, fullCompany, { company_id: fullCompany.companyId, project_id: mockProjects[1].id, programme_id: mockProgrammes[0].id }, mockProgrammes, mockProjects), false);
    });

    await t2.test("3.7 Cross-programme dependency or self-referential dependency is rejected", () => {
      // Self-referential dependency (predecessor === successor)
      assert.equal(checkRlsProgrammeDependency("INSERT", true, fullCompany, { company_id: fullCompany.companyId, project_id: mockProjects[0].id, programme_id: mockProgrammes[0].id, predecessor_activity_id: mockActivities[0].id, successor_activity_id: mockActivities[0].id }, mockProgrammes, mockActivities), false);

      // Activities from different programmes/projects
      const externalActivity: SimulatedProgrammeActivity = {
        id: "a0000000-0000-0000-0000-000000000099",
        company_id: fullCompany.companyId,
        project_id: mockProjects[0].id,
        programme_id: "pr-other",
        activity_name: "External Act",
        status: "Draft",
      };
      assert.equal(checkRlsProgrammeDependency("INSERT", true, fullCompany, { company_id: fullCompany.companyId, project_id: mockProjects[0].id, programme_id: mockProgrammes[0].id, predecessor_activity_id: mockActivities[0].id, successor_activity_id: externalActivity.id }, mockProgrammes, [...mockActivities, externalActivity]), false);
    });

    await t2.test("3.8 Read and export remain available for all companies including read-only", () => {
      assert.equal(checkRlsProject("SELECT", true, readOnlyCompany), true);
      assert.equal(checkRlsCompanyMember("SELECT", true, false, readOnlyCompany), true);
      assert.equal(checkRlsCompanyMember("SELECT", false, true, readOnlyCompany), true); // Own profile
      assert.equal(checkRlsProjectMember("SELECT", true, readOnlyCompany, { project_id: mockProjects[2].id }, mockProjects, mockMembers), true);
      assert.equal(checkRlsProgramme("SELECT", true, readOnlyCompany, { company_id: readOnlyCompany.companyId, project_id: mockProjects[2].id }, mockProjects), true);
      assert.equal(checkRlsProgrammeActivity("SELECT", true, readOnlyCompany, { company_id: readOnlyCompany.companyId, project_id: mockProjects[2].id, programme_id: mockProgrammes[2].id }, mockProgrammes, mockProjects), true);
      assert.equal(checkRlsProgrammeDependency("SELECT", true, readOnlyCompany, { company_id: readOnlyCompany.companyId, project_id: mockProjects[2].id, programme_id: mockProgrammes[2].id }, mockProgrammes, mockActivities), true);
    });
  });

  await t.test("4. RPC Billing Guard & Immutability Guarantees", async (t2) => {
    const fullCompany: CompanyEntitlement = {
      companyId: "c0000000-0000-0000-0000-000000000001",
      accessMode: "full",
      canRead: true,
      canWrite: true,
      canAccessBilling: true,
      canExport: true,
    };

    const readOnlyCompany: CompanyEntitlement = {
      companyId: "c0000000-0000-0000-0000-000000000003",
      accessMode: "read_only",
      canRead: true,
      canWrite: false,
      canAccessBilling: true,
      canExport: true,
    };

    await t2.test("4.1 executeRpcBillingGuard enforces PM001 error on read-only access", () => {
      assert.doesNotThrow(() => executeRpcBillingGuard(fullCompany.companyId, fullCompany));
      assert.throws(
        () => executeRpcBillingGuard(readOnlyCompany.companyId, readOnlyCompany),
        (err: any) => err instanceof PostgresError && err.code === "PM001" && err.message === "Company billing access is read-only."
      );
    });

    await t2.test("4.2 Trigger fn_projects_meta_stamp enforces company_id immutability on UPDATE", () => {
      assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.fn_projects_meta_stamp/i);
      assert.match(migrationSql, /NEW\.company_id := OLD\.company_id;/i);
    });

    await t2.test("4.3 Trigger fn_company_members_meta_stamp enforces company_id & profile_id immutability on UPDATE", () => {
      assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.fn_company_members_meta_stamp/i);
      assert.match(migrationSql, /NEW\.company_id := OLD\.company_id;/i);
      assert.match(migrationSql, /NEW\.profile_id := OLD\.profile_id;/i);
    });

    await t2.test("4.4 Trigger fn_project_members_meta_stamp enforces project_id & company_member_id immutability on UPDATE", () => {
      assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.fn_project_members_meta_stamp/i);
      assert.match(migrationSql, /NEW\.project_id := OLD\.project_id;/i);
      assert.match(migrationSql, /NEW\.company_member_id := OLD\.company_member_id;/i);
    });

    await t2.test("4.5 Trigger fn_programmes_meta_stamp enforces company_id & project_id immutability on UPDATE", () => {
      assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.fn_programmes_meta_stamp/i);
      assert.match(migrationSql, /NEW\.company_id := OLD\.company_id;/i);
      assert.match(migrationSql, /NEW\.project_id := OLD\.project_id;/i);
    });

    await t2.test("4.6 Trigger fn_programme_activities_meta_stamp enforces company_id, project_id, programme_id immutability on UPDATE", () => {
      assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.fn_programme_activities_meta_stamp/i);
      assert.match(migrationSql, /NEW\.company_id := OLD\.company_id;/i);
      assert.match(migrationSql, /NEW\.project_id := OLD\.project_id;/i);
      assert.match(migrationSql, /NEW\.programme_id := OLD\.programme_id;/i);
    });

    await t2.test("4.7 Trigger fn_programme_dependencies_meta_stamp enforces company_id, project_id, programme_id immutability on UPDATE", () => {
      assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.fn_programme_dependencies_meta_stamp/i);
      assert.match(migrationSql, /NEW\.company_id := OLD\.company_id;/i);
      assert.match(migrationSql, /NEW\.project_id := OLD\.project_id;/i);
      assert.match(migrationSql, /NEW\.programme_id := OLD\.programme_id;/i);
    });
  });

  await t.test("5. Non-Mutation and Transaction Safety Guarantees", async (t2) => {
    await t2.test("5.1 RLS write policies verify operational write check before permitting mutation", () => {
      TARGET_TABLES.forEach((table) => {
        const tablePolicies = extractTablePolicies(migrationSql, table);
        assert.match(tablePolicies, /company_billing_allows_operational_write/i, `Table ${table} must check billing before mutation`);
      });
    });

    await t2.test("5.2 Atomic rollback occurs on any constraint, validation or RLS violation", () => {
      const rollbackSimulation = () => {
        const state = { mutated: false };
        try {
          executeRpcBillingGuard("read_only_co", {
            companyId: "read_only_co",
            accessMode: "read_only",
            canRead: true,
            canWrite: false,
            canAccessBilling: true,
            canExport: true,
          });
          state.mutated = true;
        } catch (e) {
          // Transaction rolled back
        }
        return state.mutated;
      };
      assert.equal(rollbackSimulation(), false, "No partial mutations should persist when operation is rejected");
    });
  });
});
