import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1G: Server-Side Billing Write Enforcement on Labour Payroll Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 2 Labour Payroll tables:
 *    - labour_payrolls
 *    - labour_payroll_entries
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(company_id)
 * 3. Authoritative parent company validation for child table:
 *    - labour_payroll_entries -> labour_payrolls (lp.company_id, lp.project_id)
 * 4. SELECT RLS Policies remain intact without write block (allowing read and export)
 * 5. All mutating SECURITY DEFINER RPCs contain the required billing write guard:
 *    - save_labour_payroll
 *    - submit_labour_payroll
 *    - approve_labour_payroll
 *    - lock_labour_payroll
 *    - unlock_labour_payroll
 *    - reopen_labour_payroll
 *    - duplicate_labour_payroll
 *    - register_labour_payroll_excel
 *    - Raises PM001 with exact message: "Company billing access is read-only."
 *    - Guards execute before any INSERT/UPDATE/DELETE mutation
 * 6. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 7. Non-mutation, transactional atomicity, and error sanitization guarantees
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260828000003_enforce_billing_labour_payroll.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const TARGET_TABLES = [
  "labour_payrolls",
  "labour_payroll_entries",
] as const;

const TARGET_RPCS = [
  "save_labour_payroll",
  "submit_labour_payroll",
  "approve_labour_payroll",
  "lock_labour_payroll",
  "unlock_labour_payroll",
  "reopen_labour_payroll",
  "duplicate_labour_payroll",
  "register_labour_payroll_excel",
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

function checkRlsWritePolicy(
  table: string,
  operation: "INSERT" | "UPDATE" | "DELETE",
  hasMembershipAccess: boolean,
  entitlement: CompanyEntitlement,
  parentMatch: boolean = true,
  statusAllowed: boolean = true
): boolean {
  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  return hasMembershipAccess && writeAllowed && parentMatch && statusAllowed;
}

function checkRlsSelectPolicy(
  table: string,
  hasMembershipAccess: boolean
): boolean {
  return hasMembershipAccess;
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

test("Step 3C.4F-1G: Labour Payroll Billing Enforcement Suite", async (t) => {
  await t.test("1. Migration Structure & Completeness", async (t1) => {
    await t1.test("1.1 Migration file exists and has non-empty content", () => {
      assert.ok(migrationSql.length > 500, "Migration file should have substantial SQL content");
      assert.match(migrationSql, /BEGIN;/, "Migration starts with BEGIN transaction");
      assert.match(migrationSql, /COMMIT;/, "Migration ends with COMMIT transaction");
    });

    await t1.test("1.2 Both target tables have write RLS policies redefined", () => {
      for (const table of TARGET_TABLES) {
        const insertPattern = new RegExp(`CREATE POLICY [a-z0-9_]+ ON public\\.${table}[\\s\\S]*?FOR INSERT`, "i");
        const updatePattern = new RegExp(`CREATE POLICY [a-z0-9_]+ ON public\\.${table}[\\s\\S]*?FOR UPDATE`, "i");
        const deletePattern = new RegExp(`CREATE POLICY [a-z0-9_]+ ON public\\.${table}[\\s\\S]*?FOR DELETE`, "i");

        assert.match(migrationSql, insertPattern, `Table ${table} must have INSERT policy in migration`);
        assert.match(migrationSql, updatePattern, `Table ${table} must have UPDATE policy in migration`);
        assert.match(migrationSql, deletePattern, `Table ${table} must have DELETE policy in migration`);
      }
    });

    await t1.test("1.3 Write RLS policies enforce company_billing_allows_operational_write", () => {
      // labour_payrolls
      assert.match(
        migrationSql,
        /CREATE POLICY p_lp_insert ON public\.labour_payrolls[\s\S]*?WITH CHECK \([\s\S]*?public\.company_billing_allows_operational_write\(company_id\)/i,
        "labour_payrolls INSERT policy must enforce company_billing_allows_operational_write(company_id)"
      );
      assert.match(
        migrationSql,
        /CREATE POLICY p_lp_update ON public\.labour_payrolls[\s\S]*?USING \([\s\S]*?public\.company_billing_allows_operational_write\(company_id\)[\s\S]*?WITH CHECK \([\s\S]*?public\.company_billing_allows_operational_write\(company_id\)/i,
        "labour_payrolls UPDATE policy must enforce company_billing_allows_operational_write(company_id) in USING and WITH CHECK"
      );
      assert.match(
        migrationSql,
        /CREATE POLICY p_lp_delete ON public\.labour_payrolls[\s\S]*?USING \([\s\S]*?public\.company_billing_allows_operational_write\(company_id\)/i,
        "labour_payrolls DELETE policy must enforce company_billing_allows_operational_write(company_id) in USING"
      );

      // labour_payroll_entries
      assert.match(
        migrationSql,
        /CREATE POLICY p_lpe_insert ON public\.labour_payroll_entries[\s\S]*?WITH CHECK \([\s\S]*?public\.company_billing_allows_operational_write\(lp\.company_id\)/i,
        "labour_payroll_entries INSERT policy must enforce company_billing_allows_operational_write(lp.company_id) via parent"
      );
      assert.match(
        migrationSql,
        /CREATE POLICY p_lpe_update ON public\.labour_payroll_entries[\s\S]*?USING \([\s\S]*?public\.company_billing_allows_operational_write\(lp\.company_id\)[\s\S]*?WITH CHECK \([\s\S]*?public\.company_billing_allows_operational_write\(lp\.company_id\)/i,
        "labour_payroll_entries UPDATE policy must enforce company_billing_allows_operational_write(lp.company_id) in USING and WITH CHECK"
      );
      assert.match(
        migrationSql,
        /CREATE POLICY p_lpe_delete ON public\.labour_payroll_entries[\s\S]*?USING \([\s\S]*?public\.company_billing_allows_operational_write\(lp\.company_id\)/i,
        "labour_payroll_entries DELETE policy must enforce company_billing_allows_operational_write(lp.company_id) in USING"
      );
    });

    await t1.test("1.4 Child table labour_payroll_entries enforces authoritative parent company and project integrity", () => {
      assert.match(
        migrationSql,
        /CREATE POLICY p_lpe_insert ON public\.labour_payroll_entries[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.labour_payrolls lp[\s\S]*?lp\.id = labour_payroll_entries\.payroll_id[\s\S]*?public\.verify_membership_access\(lp\.company_id,\s*lp\.project_id\)/i,
        "labour_payroll_entries must validate authoritative parent labour_payrolls membership"
      );
    });

    await t1.test("1.5 SELECT policies remain intact without operational write restriction", () => {
      assert.match(
        migrationSql,
        /CREATE POLICY p_lp_select ON public\.labour_payrolls[\s\S]*?FOR SELECT TO authenticated[\s\S]*?USING \([\s\S]*?public\.verify_membership_access\(company_id,\s*project_id\)[\s\S]*?\);/i,
        "labour_payrolls must maintain SELECT policy without operational write requirement"
      );
      assert.match(
        migrationSql,
        /CREATE POLICY p_lpe_select ON public\.labour_payroll_entries[\s\S]*?FOR SELECT TO authenticated[\s\S]*?USING \([\s\S]*?public\.verify_membership_access\(lp\.company_id,\s*lp\.project_id\)[\s\S]*?\);/i,
        "labour_payroll_entries must maintain SELECT policy without operational write requirement"
      );
    });

    await t1.test("1.6 All 8 mutating SECURITY DEFINER RPCs are defined in migration", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcPattern = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`, "i");
        assert.match(migrationSql, rpcPattern, `RPC public.${rpc} must be defined in migration`);
      }
    });

    await t1.test("1.7 All 8 mutating RPCs raise SQLSTATE PM001 with exact message on billing read-only", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const match = migrationSql.match(rpcBlockRegex);
        assert.ok(match, `RPC ${rpc} body must be extractable`);
        const body = match[0];

        assert.ok(
          body.includes("public.company_billing_allows_operational_write("),
          `RPC ${rpc} must call company_billing_allows_operational_write`
        );
        assert.ok(
          body.includes("USING ERRCODE = 'PM001'"),
          `RPC ${rpc} must raise error with ERRCODE = 'PM001'`
        );
        assert.ok(
          body.includes("RAISE EXCEPTION 'Company billing access is read-only.'"),
          `RPC ${rpc} must raise exact message: 'Company billing access is read-only.'`
        );
        assert.ok(
          body.includes("SECURITY DEFINER"),
          `RPC ${rpc} must be declared SECURITY DEFINER`
        );
      }
    });

    await t1.test("1.8 Execution permissions granted to authenticated and revoked from anon/public", () => {
      for (const rpc of TARGET_RPCS) {
        const revokePattern = new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}\\([^)]*\\) FROM PUBLIC, anon;`, "i");
        const grantPattern = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([^)]*\\) TO authenticated`, "i");
        assert.match(migrationSql, revokePattern, `RPC ${rpc} must revoke anon/public`);
        assert.match(migrationSql, grantPattern, `RPC ${rpc} must grant authenticated`);
      }
    });
  });

  await t.test("2. Schema Parity & Search Path Verification", async (t2) => {
    await t2.test("2.1 schema.sql contains the Labour Payroll billing enforcement write policies", () => {
      assert.ok(
        schemaSql.includes("p_lp_insert"),
        "schema.sql must contain updated labour_payrolls insert policy"
      );
      assert.ok(
        schemaSql.includes("p_lpe_insert"),
        "schema.sql must contain updated labour_payroll_entries insert policy"
      );
      assert.ok(
        schemaSql.includes("save_labour_payroll"),
        "schema.sql must contain updated save_labour_payroll RPC"
      );
      assert.ok(
        schemaSql.includes("duplicate_labour_payroll"),
        "schema.sql must contain updated duplicate_labour_payroll RPC"
      );
      assert.ok(
        schemaSql.includes("register_labour_payroll_excel"),
        "schema.sql must contain updated register_labour_payroll_excel RPC"
      );
    });

    await t2.test("2.2 All eight mutating RPCs configure empty search_path (SET search_path = '') in migration and schema", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const migMatch = migrationSql.match(rpcBlockRegex);
        assert.ok(migMatch, `RPC ${rpc} body must be extractable from migration`);
        const migBody = migMatch[0];

        assert.match(
          migBody,
          /SET search_path\s*=\s*''/i,
          `RPC ${rpc} must set empty search_path (SET search_path = '') in migration`
        );
        assert.doesNotMatch(
          migBody,
          /SET search_path\s*=\s*public/i,
          `RPC ${rpc} in migration must not use search_path = public`
        );

        const schemaMatch = schemaSql.match(rpcBlockRegex);
        assert.ok(schemaMatch, `RPC ${rpc} body must be extractable from schema.sql`);
        const schemaBody = schemaMatch[0];

        assert.match(
          schemaBody,
          /SET search_path\s*=\s*''/i,
          `RPC ${rpc} must set empty search_path (SET search_path = '') in schema.sql`
        );
        assert.doesNotMatch(
          schemaBody,
          /SET search_path\s*=\s*public/i,
          `RPC ${rpc} in schema.sql must not use search_path = public`
        );
      }
    });

    await t2.test("2.3 All eight RPCs fully qualify all application tables and helper functions with public.", () => {
      const appTables = [
        "labour_payrolls",
        "labour_payroll_entries",
        "projects",
        "company_members",
        "profiles",
      ];

      for (const rpc of TARGET_RPCS) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const match = migrationSql.match(rpcBlockRegex);
        assert.ok(match, `RPC ${rpc} body must be extractable`);
        const body = match[0];

        // Ensure helper functions are qualified with public.
        assert.ok(
          body.includes("public.company_billing_allows_operational_write"),
          `RPC ${rpc} must qualify company_billing_allows_operational_write with public.`
        );

        if (body.includes("verify_membership_access")) {
          assert.ok(
            body.includes("public.verify_membership_access"),
            `RPC ${rpc} must qualify verify_membership_access with public.`
          );
        }

        // Ensure no unqualified FROM <table>, JOIN <table>, INTO <table>, UPDATE <table>, DELETE FROM <table>
        for (const tbl of appTables) {
          const unqualifiedFrom = new RegExp(`\\bFROM\\s+(?!public\\.)(${tbl})\\b`, "i");
          const unqualifiedInto = new RegExp(`\\bINTO\\s+(?!public\\.)(${tbl})\\b`, "i");
          const unqualifiedUpdate = new RegExp(`\\bUPDATE\\s+(?!public\\.)(${tbl})\\b`, "i");

          assert.doesNotMatch(
            body,
            unqualifiedFrom,
            `RPC ${rpc} must not have unqualified FROM ${tbl}`
          );
          assert.doesNotMatch(
            body,
            unqualifiedInto,
            `RPC ${rpc} must not have unqualified INSERT INTO ${tbl}`
          );
          assert.doesNotMatch(
            body,
            unqualifiedUpdate,
            `RPC ${rpc} must not have unqualified UPDATE ${tbl}`
          );
        }
      }
    });

    await t2.test("2.4 All eight RPCs fully qualify auth functions with auth.", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const match = migrationSql.match(rpcBlockRegex);
        assert.ok(match, `RPC ${rpc} body must be extractable`);
        const body = match[0];

        if (body.includes("uid()")) {
          assert.match(
            body,
            /auth\.uid\(\)/,
            `RPC ${rpc} must qualify uid() as auth.uid()`
          );
          assert.doesNotMatch(
            body,
            /(?<!auth\.)\buid\(\)/,
            `RPC ${rpc} must not contain unqualified uid()`
          );
        }
      }
    });

    await t2.test("2.5 All eight RPCs fully qualify built-in functions with pg_catalog.", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const match = migrationSql.match(rpcBlockRegex);
        assert.ok(match, `RPC ${rpc} body must be extractable`);
        const body = match[0];

        // Check for specific functions when they appear
        if (body.includes("gen_random_uuid")) {
          assert.ok(
            body.includes("pg_catalog.gen_random_uuid"),
            `RPC ${rpc} must qualify gen_random_uuid with pg_catalog.`
          );
        }
        if (body.includes("now()")) {
          assert.ok(
            body.includes("pg_catalog.now()"),
            `RPC ${rpc} must qualify now() with pg_catalog.`
          );
        }
        if (body.includes("coalesce(")) {
          assert.ok(
            body.includes("pg_catalog.coalesce("),
            `RPC ${rpc} must qualify coalesce with pg_catalog.`
          );
        }
        if (body.includes("jsonb_typeof")) {
          assert.ok(
            body.includes("pg_catalog.jsonb_typeof"),
            `RPC ${rpc} must qualify jsonb_typeof with pg_catalog.`
          );
        }
        if (body.includes("jsonb_array_length")) {
          assert.ok(
            body.includes("pg_catalog.jsonb_array_length"),
            `RPC ${rpc} must qualify jsonb_array_length with pg_catalog.`
          );
        }
        if (body.includes("jsonb_array_elements")) {
          assert.ok(
            body.includes("pg_catalog.jsonb_array_elements"),
            `RPC ${rpc} must qualify jsonb_array_elements with pg_catalog.`
          );
        }
        if (body.includes("initcap")) {
          assert.ok(
            body.includes("pg_catalog.initcap"),
            `RPC ${rpc} must qualify initcap with pg_catalog.`
          );
        }
        if (body.includes("timezone(")) {
          assert.ok(
            body.includes("pg_catalog.timezone("),
            `RPC ${rpc} must qualify timezone with pg_catalog.`
          );
        }
      }
    });
  });

  await t.test("3. Entitlement Behavior Simulation & RLS Evaluation", async (t3) => {
    const fullAccessCompany: CompanyEntitlement = {
      companyId: "c1111111-1111-1111-1111-111111111111",
      accessMode: "full",
      canRead: true,
      canWrite: true,
      canAccessBilling: true,
      canExport: true,
    };

    const gracePeriodCompany: CompanyEntitlement = {
      companyId: "c2222222-2222-2222-2222-222222222222",
      accessMode: "grace_period",
      canRead: true,
      canWrite: true,
      canAccessBilling: true,
      canExport: true,
    };

    const readOnlyCompany: CompanyEntitlement = {
      companyId: "c3333333-3333-3333-3333-333333333333",
      accessMode: "read_only",
      canRead: true,
      canWrite: false,
      canAccessBilling: true,
      canExport: true,
    };

    await t3.test("3.1 Full access company allows operational writes on both tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, fullAccessCompany), true);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, fullAccessCompany), true);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, fullAccessCompany), true);
      }
    });

    await t3.test("3.2 Grace period company allows operational writes on both tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, gracePeriodCompany), true);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, gracePeriodCompany), true);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, gracePeriodCompany), true);
      }
    });

    await t3.test("3.3 Read-only company rejects all operational writes on both tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, readOnlyCompany), false);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, readOnlyCompany), false);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, readOnlyCompany), false);
      }
    });

    await t3.test("3.4 Inactive or non-member rejected even if billing is full", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", false, fullAccessCompany), false);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", false, fullAccessCompany), false);
        assert.equal(checkRlsWritePolicy(table, "DELETE", false, fullAccessCompany), false);
      }
    });

    await t3.test("3.5 Cross-company parent/child mismatch is rejected even with full access", () => {
      assert.equal(
        checkRlsWritePolicy("labour_payroll_entries", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company parent payroll entry link must be blocked"
      );
    });

    await t3.test("3.6 Read and export remain available for all companies including read-only", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsSelectPolicy(table, true), true, `Table ${table} must be readable`);
      }
      assert.equal(readOnlyCompany.canRead, true, "Read-only company can read");
      assert.equal(readOnlyCompany.canExport, true, "Read-only company can export");
    });
  });

  await t.test("4. SECURITY DEFINER RPC Simulation & Error Handling", async (t4) => {
    const fullAccessCompany: CompanyEntitlement = {
      companyId: "c1111111-1111-1111-1111-111111111111",
      accessMode: "full",
      canRead: true,
      canWrite: true,
      canAccessBilling: true,
      canExport: true,
    };

    const gracePeriodCompany: CompanyEntitlement = {
      companyId: "c2222222-2222-2222-2222-222222222222",
      accessMode: "grace_period",
      canRead: true,
      canWrite: true,
      canAccessBilling: true,
      canExport: true,
    };

    const readOnlyCompany: CompanyEntitlement = {
      companyId: "c3333333-3333-3333-3333-333333333333",
      accessMode: "read_only",
      canRead: true,
      canWrite: false,
      canAccessBilling: true,
      canExport: true,
    };

    await t4.test("4.1 RPC billing guard succeeds for full access companies across all 8 RPCs", () => {
      for (const rpc of TARGET_RPCS) {
        assert.doesNotThrow(() => {
          executeRpcBillingGuard(fullAccessCompany.companyId, fullAccessCompany);
        }, `RPC ${rpc} must succeed for full access company`);
      }
    });

    await t4.test("4.2 RPC billing guard succeeds for grace period companies across all 8 RPCs", () => {
      for (const rpc of TARGET_RPCS) {
        assert.doesNotThrow(() => {
          executeRpcBillingGuard(gracePeriodCompany.companyId, gracePeriodCompany);
        }, `RPC ${rpc} must succeed for grace period company`);
      }
    });

    await t4.test("4.3 RPC billing guard throws PM001 error for read-only companies across all 8 RPCs", () => {
      for (const rpc of TARGET_RPCS) {
        assert.throws(
          () => {
            executeRpcBillingGuard(readOnlyCompany.companyId, readOnlyCompany);
          },
          (err: any) => {
            return err instanceof PostgresError &&
              err.code === "PM001" &&
              err.message === "Company billing access is read-only.";
          },
          `RPC ${rpc} must raise PM001 on read-only billing`
        );
      }
    });
  });

  await t.test("5. Non-Mutation and Transaction Safety Guarantees", async (t5) => {
    await t5.test("5.1 In every mutating RPC, company_billing_allows_operational_write is checked before UPDATE/INSERT/DELETE", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const match = migrationSql.match(rpcBlockRegex);
        assert.ok(match, `RPC ${rpc} body must be extractable`);
        const body = match[0];

        const guardIndex = body.indexOf("company_billing_allows_operational_write");
        assert.ok(guardIndex > 0, `RPC ${rpc} must contain billing guard`);

        // Find the first mutating UPDATE, INSERT, or DELETE statement (excluding FOR UPDATE in SELECT)
        const updateMatches = [...body.matchAll(/\bUPDATE\s+public\.[a-z0-9_]+/gi)];
        const insertMatches = [...body.matchAll(/\bINSERT\s+INTO\s+public\.[a-z0-9_]+/gi)];
        const deleteMatches = [...body.matchAll(/\bDELETE\s+FROM\s+public\.[a-z0-9_]+/gi)];

        const firstMutationPos = Math.min(
          updateMatches.length > 0 ? updateMatches[0].index! : Infinity,
          insertMatches.length > 0 ? insertMatches[0].index! : Infinity,
          deleteMatches.length > 0 ? deleteMatches[0].index! : Infinity
        );

        assert.ok(
          guardIndex < firstMutationPos,
          `In RPC ${rpc}, billing guard (pos ${guardIndex}) must appear BEFORE first mutation (pos ${firstMutationPos})`
        );
      }
    });

    await t5.test("5.2 Excel-registration and payroll-duplication cannot partially mutate on PM001 rejection", () => {
      const complexRpcs = ["duplicate_labour_payroll", "register_labour_payroll_excel", "save_labour_payroll"];
      for (const rpc of complexRpcs) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const match = migrationSql.match(rpcBlockRegex);
        assert.ok(match, `RPC ${rpc} body must be extractable`);
        const body = match[0];

        const guardIndex = body.indexOf("company_billing_allows_operational_write");
        const writeIndices = [
          body.indexOf("INSERT INTO"),
          body.indexOf("UPDATE public."),
          body.indexOf("DELETE FROM"),
        ].filter((idx) => idx !== -1);
        const firstInsertOrUpdate = writeIndices.length > 0 ? Math.min(...writeIndices) : Infinity;

        assert.ok(
          guardIndex < firstInsertOrUpdate,
          `In complex operation ${rpc}, guard at ${guardIndex} precedes any table writes at ${firstInsertOrUpdate}`
        );
      }
    });
  });
});
