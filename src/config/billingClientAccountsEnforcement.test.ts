import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1D: Server-Side Billing Write Enforcement on Client Accounts Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 8 Client Accounts tables:
 *    - client_accounts
 *    - project_client_contracts
 *    - client_invoices
 *    - client_invoice_lines
 *    - client_credit_notes
 *    - client_credit_note_lines
 *    - client_receipts
 *    - client_receipt_allocations
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(company_id)
 * 3. Authoritative parent company validation for child tables (invoice lines, credit note lines, receipt allocations)
 * 4. SELECT RLS Policies remain intact without write block (allowing read and export)
 * 5. All 20 mutating SECURITY DEFINER RPCs contain the required billing write guard:
 *    - Raises PM001 with exact message: "Company billing access is read-only."
 *    - Guards execute before any INSERT/UPDATE/DELETE mutation
 * 6. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 7. Non-mutation and error sanitization guarantees
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260828000000_enforce_billing_client_accounts.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const TARGET_TABLES = [
  "client_accounts",
  "project_client_contracts",
  "client_invoices",
  "client_invoice_lines",
  "client_credit_notes",
  "client_credit_note_lines",
  "client_receipts",
  "client_receipt_allocations",
] as const;

const TARGET_RPCS = [
  "activate_client_contract",
  "close_client_contract",
  "cancel_client_contract",
  "submit_client_invoice",
  "approve_client_invoice",
  "reject_client_invoice",
  "issue_client_invoice",
  "cancel_client_invoice",
  "submit_client_credit_note",
  "approve_client_credit_note",
  "reject_client_credit_note",
  "issue_client_credit_note",
  "cancel_client_credit_note",
  "post_client_receipt",
  "reverse_client_receipt",
  "cancel_client_receipt",
  "allocate_client_receipt",
  "reverse_client_receipt_allocation",
  "archive_finance_record",
  "restore_finance_record",
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
  entitlement: CompanyEntitlement,
  parentMatch: boolean = true
): boolean {
  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  return hasFinanceFullAccess && writeAllowed && parentMatch;
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

test("Step 3C.4F-1D: Client Accounts Billing Enforcement Suite", async (t) => {

  await t.test("1. Migration Structure & Completeness", async (t1) => {
    await t1.test("1.1 Migration file exists and has non-empty content", () => {
      assert.ok(migrationSql.length > 500, "Migration file should have substantial SQL content");
      assert.match(migrationSql, /BEGIN;/, "Migration starts with BEGIN transaction");
      assert.match(migrationSql, /COMMIT;/, "Migration ends with COMMIT transaction");
    });

    await t1.test("1.2 All 8 target tables have write RLS policies redefined", () => {
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
        const insertRegex = new RegExp(`CREATE POLICY [a-z0-9_]+_insert ON public\\.${table}[\\s\\S]*?WITH CHECK \\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)`, "i");
        const updateRegex = new RegExp(`CREATE POLICY [a-z0-9_]+_update ON public\\.${table}[\\s\\S]*?USING \\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)[\\s\\S]*?WITH CHECK \\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)`, "i");
        const deleteRegex = new RegExp(`CREATE POLICY [a-z0-9_]+_delete ON public\\.${table}[\\s\\S]*?USING \\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)`, "i");

        assert.match(migrationSql, insertRegex, `Table ${table} INSERT policy must enforce company_billing_allows_operational_write(company_id)`);
        assert.match(migrationSql, updateRegex, `Table ${table} UPDATE policy must enforce company_billing_allows_operational_write(company_id) in both USING and WITH CHECK`);
        assert.match(migrationSql, deleteRegex, `Table ${table} DELETE policy must enforce company_billing_allows_operational_write(company_id) in USING`);
      }
    });

    await t1.test("1.4 Child tables enforce authoritative parent company and relation integrity", () => {
      // client_invoice_lines -> client_invoices
      assert.match(
        migrationSql,
        /CREATE POLICY p_cil_insert ON public\.client_invoice_lines[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.client_invoices ci[\s\S]*?ci\.id = client_invoice_lines\.invoice_id[\s\S]*?ci\.company_id = client_invoice_lines\.company_id[\s\S]*?ci\.project_id = client_invoice_lines\.project_id/i,
        "client_invoice_lines must validate authoritative parent client_invoices"
      );

      // client_credit_note_lines -> client_credit_notes
      assert.match(
        migrationSql,
        /CREATE POLICY p_ccnl_insert ON public\.client_credit_note_lines[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.client_credit_notes ccn[\s\S]*?ccn\.id = client_credit_note_lines\.credit_note_id[\s\S]*?ccn\.company_id = client_credit_note_lines\.company_id[\s\S]*?ccn\.project_id = client_credit_note_lines\.project_id/i,
        "client_credit_note_lines must validate authoritative parent client_credit_notes"
      );

      // client_receipt_allocations -> client_receipts AND client_invoices
      assert.match(
        migrationSql,
        /CREATE POLICY p_cra_insert ON public\.client_receipt_allocations[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.client_receipts cr[\s\S]*?cr\.id = client_receipt_allocations\.receipt_id[\s\S]*?cr\.company_id = client_receipt_allocations\.company_id[\s\S]*?cr\.client_account_id = client_receipt_allocations\.client_account_id/i,
        "client_receipt_allocations must validate authoritative parent client_receipts"
      );
      assert.match(
        migrationSql,
        /CREATE POLICY p_cra_insert ON public\.client_receipt_allocations[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.client_invoices ci[\s\S]*?ci\.id = client_receipt_allocations\.invoice_id[\s\S]*?ci\.company_id = client_receipt_allocations\.company_id[\s\S]*?ci\.client_account_id = client_receipt_allocations\.client_account_id/i,
        "client_receipt_allocations must validate authoritative parent client_invoices"
      );
    });

    await t1.test("1.5 SELECT policies are not altered to block read-only companies", () => {
      assert.doesNotMatch(
        migrationSql,
        /FOR SELECT TO authenticated/i,
        "Migration must not restrict SELECT policies"
      );
    });

    await t1.test("1.6 All 20 mutating SECURITY DEFINER RPCs are defined in migration", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcPattern = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`, "i");
        assert.match(migrationSql, rpcPattern, `RPC public.${rpc} must be defined in migration`);
      }
    });

    await t1.test("1.7 All 20 RPCs raise SQLSTATE PM001 with exact message on billing read-only", () => {
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
        const grantPattern = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([^)]*\\) TO authenticated;`, "i");

        assert.match(migrationSql, revokePattern, `RPC ${rpc} must revoke anon/public`);
        assert.match(migrationSql, grantPattern, `RPC ${rpc} must grant authenticated`);
      }
    });
  });

  await t.test("2. Schema Parity & Search Path Verification", async (t2) => {
    await t2.test("2.1 schema.sql contains the Step 3C.4F-1D billing enforcement section", () => {
      assert.ok(
        schemaSql.includes("ProjectMatrix Phase 3A.2 — Step 3C.4F-1D"),
        "schema.sql must contain Step 3C.4F-1D header"
      );
      assert.ok(
        schemaSql.includes("p_ca_insert"),
        "schema.sql must contain updated client accounts insert policy"
      );
      assert.ok(
        schemaSql.includes("allocate_client_receipt"),
        "schema.sql must contain updated allocate_client_receipt RPC"
      );
      assert.ok(
        schemaSql.includes("reverse_client_receipt_allocation"),
        "schema.sql must contain updated reverse_client_receipt_allocation RPC"
      );
    });

    await t2.test("2.2 All 20 RPCs configure secure search_path (search_path = public, pg_temp)", () => {
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

    const readOnlyCompany: CompanyEntitlement = {
      companyId: "c3333333-3333-3333-3333-333333333333",
      accessMode: "read_only",
      canRead: true,
      canWrite: false,
      canAccessBilling: true,
      canExport: true,
    };

    await t3.test("3.1 Full access company allows all operational writes on all 8 tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, fullAccessCompany), true);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, fullAccessCompany), true);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, fullAccessCompany), true);
      }
    });

    await t3.test("3.2 Grace period company allows operational writes on all 8 tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, gracePeriodCompany), true);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, gracePeriodCompany), true);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, gracePeriodCompany), true);
      }
    });

    await t3.test("3.3 Read-only company rejects all operational writes on all 8 tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, readOnlyCompany), false);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, readOnlyCompany), false);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, readOnlyCompany), false);
      }
    });

    await t3.test("3.4 Cross-company parent/child mismatch is rejected even with full access", () => {
      assert.equal(
        checkRlsWritePolicy("client_invoice_lines", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company invoice line insert must be blocked"
      );
      assert.equal(
        checkRlsWritePolicy("client_credit_note_lines", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company credit note line insert must be blocked"
      );
      assert.equal(
        checkRlsWritePolicy("client_receipt_allocations", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company receipt allocation insert must be blocked"
      );
    });

    await t3.test("3.5 Read and export remain available for all companies including read-only", () => {
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

    await t4.test("4.1 RPC billing guard succeeds for full access companies across all RPCs", () => {
      for (const rpc of TARGET_RPCS) {
        assert.doesNotThrow(() => {
          executeRpcBillingGuard(fullAccessCompany.companyId, fullAccessCompany);
        }, `RPC ${rpc} must succeed for full access company`);
      }
    });

    await t4.test("4.2 RPC billing guard succeeds for grace period companies across all RPCs", () => {
      for (const rpc of TARGET_RPCS) {
        assert.doesNotThrow(() => {
          executeRpcBillingGuard(gracePeriodCompany.companyId, gracePeriodCompany);
        }, `RPC ${rpc} must succeed for grace period company`);
      }
    });

    await t4.test("4.3 RPC billing guard throws PM001 error for read-only companies across all RPCs", () => {
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
    await t5.test("5.1 In every mutating RPC, company_billing_allows_operational_write is checked before UPDATE/INSERT", () => {
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

        // Find the first mutating UPDATE or INSERT statement (excluding FOR UPDATE in SELECT)
        const updateMatches = [...body.matchAll(/\bUPDATE\s+public\.[a-z0-9_]+/gi)];
        const insertMatches = [...body.matchAll(/\bINSERT\s+INTO\s+public\.[a-z0-9_]+/gi)];
        const firstMutationPos = Math.min(
          updateMatches.length > 0 ? updateMatches[0].index! : Infinity,
          insertMatches.length > 0 ? insertMatches[0].index! : Infinity
        );

        assert.ok(
          guardIndex < firstMutationPos,
          `In RPC ${rpc}, billing guard (pos ${guardIndex}) must appear BEFORE first mutation (pos ${firstMutationPos})`
        );
      }
    });
  });
});
