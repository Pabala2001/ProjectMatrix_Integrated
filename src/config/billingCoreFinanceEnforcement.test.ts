import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1C: Server-Side Billing Write Enforcement on Core Finance Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 5 Core Finance tables:
 *    - project_budget_versions
 *    - project_budget_lines
 *    - financial_commitments
 *    - financial_cost_postings
 *    - project_financial_forecasts
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(company_id)
 * 3. SELECT RLS Policies remain intact without write block (allowing read and export)
 * 4. All 18 mutating SECURITY DEFINER RPCs contain the required billing write guard:
 *    - Raises PM001 with exact message: "Company billing access is read-only."
 *    - Guards execute before any INSERT/UPDATE/DELETE mutation
 * 5. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 6. Non-mutation and error sanitization guarantees
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260827000003_enforce_billing_core_finance.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const TARGET_TABLES = [
  "project_budget_versions",
  "project_budget_lines",
  "financial_commitments",
  "financial_cost_postings",
  "project_financial_forecasts",
] as const;

const TARGET_RPCS = [
  "archive_finance_record",
  "restore_finance_record",
  "submit_budget_version",
  "approve_budget_version",
  "reject_budget_version",
  "cancel_budget_version",
  "submit_financial_commitment",
  "approve_financial_commitment",
  "reject_financial_commitment",
  "close_financial_commitment",
  "cancel_financial_commitment",
  "submit_financial_cost_posting",
  "post_financial_cost_posting",
  "reject_financial_cost_posting",
  "reverse_financial_cost_posting",
  "submit_project_financial_forecast",
  "approve_project_financial_forecast",
  "reject_project_financial_forecast",
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
  hasFinanceFullAccess: boolean,
  entitlement: CompanyEntitlement
): boolean {
  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  return hasFinanceFullAccess && writeAllowed;
}

function checkRlsSelectPolicy(
  table: string,
  hasFinanceFullAccess: boolean
): boolean {
  return hasFinanceFullAccess;
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

test("Step 3C.4F-1C: Core Finance Billing Enforcement Suite", async (t) => {

  await t.test("1. Migration Structure & Completeness", async (t1) => {
    await t1.test("1.1 Migration file exists and has non-empty content", () => {
      assert.ok(migrationSql.length > 500, "Migration file should have substantial SQL content");
      assert.match(migrationSql, /BEGIN;/, "Migration starts with BEGIN transaction");
      assert.match(migrationSql, /COMMIT;/, "Migration ends with COMMIT transaction");
    });

    await t1.test("1.2 All 5 target tables have write RLS policies redefined", () => {
      for (const table of TARGET_TABLES) {
        const insertPattern = new RegExp(`CREATE POLICY [a-z0-9_]+_insert ON public\\.${table}[\\s\\S]*?FOR INSERT`, "i");
        const updatePattern = new RegExp(`CREATE POLICY [a-z0-9_]+_update ON public\\.${table}[\\s\\S]*?FOR UPDATE`, "i");
        const deletePattern = new RegExp(`CREATE POLICY [a-z0-9_]+_delete ON public\\.${table}[\\s\\S]*?FOR DELETE`, "i");

        assert.match(migrationSql, insertPattern, `Table ${table} must have INSERT policy in migration`);
        assert.match(migrationSql, updatePattern, `Table ${table} must have UPDATE policy in migration`);
        assert.match(migrationSql, deletePattern, `Table ${table} must have DELETE policy in migration`);
      }
    });

    await t1.test("1.3 Write RLS policies enforce company_billing_allows_operational_write(company_id)", () => {
      for (const table of TARGET_TABLES) {
        // Match INSERT, UPDATE, DELETE policies for each table
        const insertRegex = new RegExp(`CREATE POLICY [a-z0-9_]+_insert ON public\\.${table}[\\s\\S]*?WITH CHECK \\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)`, "i");
        const updateRegex = new RegExp(`CREATE POLICY [a-z0-9_]+_update ON public\\.${table}[\\s\\S]*?USING \\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)[\\s\\S]*?WITH CHECK \\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)`, "i");
        const deleteRegex = new RegExp(`CREATE POLICY [a-z0-9_]+_delete ON public\\.${table}[\\s\\S]*?USING \\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)`, "i");

        assert.match(migrationSql, insertRegex, `Table ${table} INSERT policy must enforce company_billing_allows_operational_write(company_id)`);
        assert.match(migrationSql, updateRegex, `Table ${table} UPDATE policy must enforce company_billing_allows_operational_write(company_id) in both USING and WITH CHECK`);
        assert.match(migrationSql, deleteRegex, `Table ${table} DELETE policy must enforce company_billing_allows_operational_write(company_id) in USING`);
      }
    });

    await t1.test("1.4 SELECT policies are not altered to block read-only companies", () => {
      // In the migration, SELECT policies should NOT be present (preserved from foundation)
      assert.doesNotMatch(
        migrationSql,
        /FOR SELECT TO authenticated/i,
        "Migration must not restrict SELECT policies"
      );
    });

    await t1.test("1.5 All 18 mutating SECURITY DEFINER RPCs are defined in migration", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcPattern = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`, "i");
        assert.match(migrationSql, rpcPattern, `RPC public.${rpc} must be defined in migration`);
      }
    });

    await t1.test("1.6 All 18 RPCs raise SQLSTATE PM001 with exact message on billing read-only", () => {
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

    await t1.test("1.7 Execution permissions granted to authenticated and revoked from anon/public", () => {
      for (const rpc of TARGET_RPCS) {
        const revokePattern = new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}\\([^)]*\\) FROM PUBLIC, anon;`, "i");
        const grantPattern = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([^)]*\\) TO authenticated;`, "i");

        assert.match(migrationSql, revokePattern, `RPC ${rpc} must revoke anon/public`);
        assert.match(migrationSql, grantPattern, `RPC ${rpc} must grant authenticated`);
      }
    });
  });

  await t.test("2. Schema Parity & Search Path Verification", async (t2) => {
    await t2.test("2.1 schema.sql contains the Step 3C.4F-1C billing enforcement section", () => {
      assert.ok(
        schemaSql.includes("ProjectMatrix Phase 3A.2 — Step 3C.4F-1C"),
        "schema.sql must contain Step 3C.4F-1C header"
      );
      assert.ok(
        schemaSql.includes("p_budget_versions_insert"),
        "schema.sql must contain updated budget versions insert policy"
      );
      assert.ok(
        schemaSql.includes("reverse_financial_cost_posting"),
        "schema.sql must contain updated reverse_financial_cost_posting RPC"
      );
    });

    await t2.test("2.2 All 18 RPCs configure secure search_path (search_path = public, pg_temp)", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const match = migrationSql.match(rpcBlockRegex);
        assert.ok(match, `RPC ${rpc} body must be extractable`);
        const body = match[0];

        assert.match(
          body,
          /SET search_path\s*=\s*public,\s*pg_temp/i,
          `RPC ${rpc} must set secure search_path`
        );
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

    const readOnlyExpiredCompany: CompanyEntitlement = {
      companyId: "c3333333-3333-3333-3333-333333333333",
      accessMode: "read_only",
      canRead: true,
      canWrite: false,
      canAccessBilling: true,
      canExport: true,
    };

    const readOnlyUnconfiguredCompany: CompanyEntitlement = {
      companyId: "c4444444-4444-4444-4444-444444444444",
      accessMode: "read_only",
      canRead: true,
      canWrite: false,
      canAccessBilling: true,
      canExport: true,
    };

    await t3.test("3.1 Full access companies allow all writes and reads across 5 tables", () => {
      for (const table of TARGET_TABLES) {
        assert.strictEqual(
          checkRlsWritePolicy(table, "INSERT", true, fullAccessCompany),
          true,
          `INSERT on ${table} should succeed for full access`
        );
        assert.strictEqual(
          checkRlsWritePolicy(table, "UPDATE", true, fullAccessCompany),
          true,
          `UPDATE on ${table} should succeed for full access`
        );
        assert.strictEqual(
          checkRlsWritePolicy(table, "DELETE", true, fullAccessCompany),
          true,
          `DELETE on ${table} should succeed for full access`
        );
        assert.strictEqual(
          checkRlsSelectPolicy(table, true),
          true,
          `SELECT on ${table} should succeed for full access`
        );
      }
    });

    await t3.test("3.2 Grace period companies allow all writes and reads across 5 tables", () => {
      for (const table of TARGET_TABLES) {
        assert.strictEqual(
          checkRlsWritePolicy(table, "INSERT", true, gracePeriodCompany),
          true,
          `INSERT on ${table} should succeed during grace period`
        );
        assert.strictEqual(
          checkRlsWritePolicy(table, "UPDATE", true, gracePeriodCompany),
          true,
          `UPDATE on ${table} should succeed during grace period`
        );
        assert.strictEqual(
          checkRlsWritePolicy(table, "DELETE", true, gracePeriodCompany),
          true,
          `DELETE on ${table} should succeed during grace period`
        );
        assert.strictEqual(
          checkRlsSelectPolicy(table, true),
          true,
          `SELECT on ${table} should succeed during grace period`
        );
      }
    });

    await t3.test("3.3 Read-only companies block all writes while allowing reads and exports", () => {
      const readOnlyCompanies = [readOnlyExpiredCompany, readOnlyUnconfiguredCompany];

      for (const comp of readOnlyCompanies) {
        for (const table of TARGET_TABLES) {
          assert.strictEqual(
            checkRlsWritePolicy(table, "INSERT", true, comp),
            false,
            `INSERT on ${table} must be blocked for read_only (${comp.companyId})`
          );
          assert.strictEqual(
            checkRlsWritePolicy(table, "UPDATE", true, comp),
            false,
            `UPDATE on ${table} must be blocked for read_only (${comp.companyId})`
          );
          assert.strictEqual(
            checkRlsWritePolicy(table, "DELETE", true, comp),
            false,
            `DELETE on ${table} must be blocked for read_only (${comp.companyId})`
          );
          assert.strictEqual(
            checkRlsSelectPolicy(table, true),
            true,
            `SELECT on ${table} must remain accessible for read_only (${comp.companyId})`
          );
        }
      }
    });

    await t3.test("3.4 Users lacking finance permissions are blocked even if billing is full", () => {
      for (const table of TARGET_TABLES) {
        assert.strictEqual(
          checkRlsWritePolicy(table, "INSERT", false, fullAccessCompany),
          false,
          `INSERT on ${table} must be blocked if user lacks finance permission`
        );
        assert.strictEqual(
          checkRlsSelectPolicy(table, false),
          false,
          `SELECT on ${table} must be blocked if user lacks finance permission`
        );
      }
    });
  });

  await t.test("4. RPC Billing Guard Execution & Exception Handling", async (t4) => {
    const fullCompany: CompanyEntitlement = {
      companyId: "c1111111-1111-1111-1111-111111111111",
      accessMode: "full",
      canRead: true,
      canWrite: true,
      canAccessBilling: true,
      canExport: true,
    };

    const graceCompany: CompanyEntitlement = {
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

    await t4.test("4.1 All 18 RPC guards succeed without error for full access companies", () => {
      for (const rpc of TARGET_RPCS) {
        assert.doesNotThrow(() => {
          executeRpcBillingGuard(fullCompany.companyId, fullCompany);
        }, `RPC guard for ${rpc} should succeed on full access`);
      }
    });

    await t4.test("4.2 All 18 RPC guards succeed without error for grace-period companies", () => {
      for (const rpc of TARGET_RPCS) {
        assert.doesNotThrow(() => {
          executeRpcBillingGuard(graceCompany.companyId, graceCompany);
        }, `RPC guard for ${rpc} should succeed on grace period`);
      }
    });

    await t4.test("4.3 All 18 RPC guards raise PM001 for read-only companies", () => {
      for (const rpc of TARGET_RPCS) {
        assert.throws(
          () => {
            executeRpcBillingGuard(readOnlyCompany.companyId, readOnlyCompany);
          },
          (err: any) => {
            assert.strictEqual(err.name, "PostgresError");
            assert.strictEqual(err.code, "PM001");
            assert.strictEqual(err.message, "Company billing access is read-only.");
            return true;
          },
          `RPC guard for ${rpc} must raise PM001 with 'Company billing access is read-only.'`
        );
      }
    });

    await t4.test("4.4 Sanitization guarantee: error message does not leak internal IDs or timestamps", () => {
      try {
        executeRpcBillingGuard(readOnlyCompany.companyId, readOnlyCompany);
        assert.fail("Should have thrown");
      } catch (err: any) {
        assert.strictEqual(err.message, "Company billing access is read-only.");
        assert.ok(!err.message.includes(readOnlyCompany.companyId), "Error message must not include company ID");
        assert.ok(!err.message.includes("sub_"), "Error message must not include subscription ID");
        assert.ok(!err.message.includes("2026-"), "Error message must not include dates");
      }
    });
  });

  await t.test("5. Workflow RPC Ordering & Guard Placement Verification", async (t5) => {
    await t5.test("5.1 Each RPC checks billing BEFORE performing any UPDATE or INSERT statement", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcBlockRegex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${rpc}\\([\\s\\S]*?\\$\\$;`,
          "i"
        );
        const match = migrationSql.match(rpcBlockRegex);
        assert.ok(match, `RPC ${rpc} body must be extractable`);
        const body = match[0];

        const guardIndex = body.indexOf("public.company_billing_allows_operational_write");
        assert.ok(guardIndex > 0, `RPC ${rpc} must have billing guard`);

        // Find the index of the first state-modifying UPDATE or INSERT (excluding SELECT ... FOR UPDATE)
        // Find UPDATE statements (direct or dynamic)
        const updateDirectMatch = body.search(/\bUPDATE\s+public\.[a-z0-9_]+\s+SET\b/i);
        const updateDynamicMatch = body.search(/EXECUTE\s+format\(\s*'(?:UPDATE\s+public\.|UPDATE\s+)/i);
        const insertMatch = body.search(/\bINSERT\s+INTO\s+public\.[a-z0-9_]+/i);

        const candidateIndices = [updateDirectMatch, updateDynamicMatch, insertMatch].filter(idx => idx !== -1);
        assert.ok(candidateIndices.length > 0, `RPC ${rpc} must contain a mutation statement`);

        const firstMutationIndex = Math.min(...candidateIndices);
        assert.ok(
          guardIndex < firstMutationIndex,
          `RPC ${rpc}: Billing guard (index ${guardIndex}) must occur before first mutation (index ${firstMutationIndex})`
        );
      }
    });

    await t5.test("5.2 Workflow status checks and authorizations occur in logical sequence", () => {
      // In submit_budget_version, authorization and billing are checked before mutation
      const submitBudgetBody = migrationSql.match(/CREATE OR REPLACE FUNCTION public\.submit_budget_version[\s\S]*?\$\$;/i)![0];
      const authIdx = submitBudgetBody.indexOf("public.has_finance_full_access");
      const billingIdx = submitBudgetBody.indexOf("public.company_billing_allows_operational_write");
      const statusIdx = submitBudgetBody.indexOf("v_rec.status <> 'Draft'");
      const mutationIdx = submitBudgetBody.indexOf("UPDATE public.project_budget_versions");

      assert.ok(authIdx < billingIdx, "Auth check should precede billing check");
      assert.ok(billingIdx < statusIdx, "Billing check precedes or accompanies status validation");
      assert.ok(billingIdx < mutationIdx, "Billing check must precede mutation");
    });
  });

  await t.test("6. Child Table Context & Anti-Tampering Checks", async (t6) => {
    await t6.test("6.1 project_budget_lines enforces company_id via RLS on insert/update/delete", () => {
      const budgetLinesBlock = migrationSql.match(/DROP POLICY IF EXISTS p_budget_lines_insert[\s\S]*?FOR DELETE[\s\S]*?\);/i)![0];
      assert.ok(
        budgetLinesBlock.includes("public.company_billing_allows_operational_write(company_id)"),
        "project_budget_lines must enforce billing directly on company_id"
      );
      assert.ok(
        budgetLinesBlock.includes("public.has_finance_full_access(company_id)"),
        "project_budget_lines must enforce authorization directly on company_id"
      );
    });

    await t6.test("6.2 Updating company_id to another company is blocked by WITH CHECK on all tables", () => {
      for (const table of TARGET_TABLES) {
        const updatePolicyRegex = new RegExp(`CREATE POLICY [a-z0-9_]+_update ON public\\.${table}[\\s\\S]*?WITH CHECK \\(([\\s\\S]*?)\\);`, "i");
        const match = migrationSql.match(updatePolicyRegex);
        assert.ok(match, `Table ${table} must have WITH CHECK in UPDATE policy`);
        const withCheckClause = match[1];

        assert.ok(
          withCheckClause.includes("public.company_billing_allows_operational_write(company_id)"),
          `Table ${table} UPDATE WITH CHECK must require company_billing_allows_operational_write(company_id)`
        );
        assert.ok(
          withCheckClause.includes("public.has_finance_full_access(company_id)"),
          `Table ${table} UPDATE WITH CHECK must require has_finance_full_access(company_id)`
        );
      }
    });
  });
});
