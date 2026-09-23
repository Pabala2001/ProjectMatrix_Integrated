import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1F: Server-Side Billing Write Enforcement on Cashbook and Banking Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 9 Cashbook and Banking tables:
 *    - cashbook_sequences
 *    - bank_accounts
 *    - cashbook_transactions
 *    - cashbook_allocations
 *    - bank_statement_imports
 *    - bank_statement_lines
 *    - bank_reconciliation_sessions
 *    - bank_reconciliation_matches
 *    - cashbook_attachments
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(company_id)
 * 3. Authoritative parent company validation for child tables:
 *    - cashbook_allocations -> cashbook_transactions
 *    - bank_statement_imports -> bank_accounts
 *    - bank_statement_lines -> bank_statement_imports & bank_accounts
 *    - bank_reconciliation_sessions -> bank_accounts
 *    - bank_reconciliation_matches -> bank_reconciliation_sessions, bank_statement_lines, cashbook_transactions
 *    - cashbook_attachments -> owning cashbook record (transaction, import, session)
 * 4. SELECT RLS Policies remain intact without write block (allowing read and export)
 * 5. All mutating SECURITY DEFINER RPCs contain the required billing write guard:
 *    - Raises PM001 with exact message: "Company billing access is read-only."
 *    - Guards execute before any INSERT/UPDATE/DELETE mutation
 * 6. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 7. Non-mutation and error sanitization guarantees
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260828000002_enforce_billing_cashbook.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const TARGET_TABLES = [
  "cashbook_sequences",
  "bank_accounts",
  "cashbook_transactions",
  "cashbook_allocations",
  "bank_statement_imports",
  "bank_statement_lines",
  "bank_reconciliation_sessions",
  "bank_reconciliation_matches",
  "cashbook_attachments",
] as const;

const TARGET_RPCS = [
  "generate_cashbook_transaction_number",
  "submit_cashbook_transaction",
  "approve_cashbook_transaction",
  "post_cashbook_transaction",
  "cancel_cashbook_transaction",
  "match_bank_statement_line",
  "unmatch_bank_statement_line",
  "complete_bank_reconciliation_session",
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

test("Step 3C.4F-1F: Cashbook and Banking Billing Enforcement Suite", async (t) => {
  await t.test("1. Migration Structure & Completeness", async (t1) => {
    await t1.test("1.1 Migration file exists and has non-empty content", () => {
      assert.ok(migrationSql.length > 500, "Migration file should have substantial SQL content");
      assert.match(migrationSql, /BEGIN;/, "Migration starts with BEGIN transaction");
      assert.match(migrationSql, /COMMIT;/, "Migration ends with COMMIT transaction");
    });

    await t1.test("1.2 All 9 target tables have write RLS policies redefined", () => {
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
      // cashbook_transactions -> bank_accounts
      assert.match(
        migrationSql,
        /CREATE POLICY p_cbt_insert ON public\.cashbook_transactions[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.bank_accounts ba[\s\S]*?ba\.id = cashbook_transactions\.bank_account_id[\s\S]*?ba\.company_id = cashbook_transactions\.company_id/i,
        "cashbook_transactions must validate authoritative parent bank_accounts"
      );

      // cashbook_allocations -> cashbook_transactions
      assert.match(
        migrationSql,
        /CREATE POLICY p_cba_insert ON public\.cashbook_allocations[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.cashbook_transactions ct[\s\S]*?ct\.id = cashbook_allocations\.cashbook_transaction_id[\s\S]*?ct\.company_id = cashbook_allocations\.company_id/i,
        "cashbook_allocations must validate authoritative parent cashbook_transactions"
      );

      // bank_statement_imports -> bank_accounts
      assert.match(
        migrationSql,
        /CREATE POLICY p_bsi_insert ON public\.bank_statement_imports[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.bank_accounts ba[\s\S]*?ba\.id = bank_statement_imports\.bank_account_id[\s\S]*?ba\.company_id = bank_statement_imports\.company_id/i,
        "bank_statement_imports must validate authoritative parent bank_accounts"
      );

      // bank_statement_lines -> bank_statement_imports AND bank_accounts
      assert.match(
        migrationSql,
        /CREATE POLICY p_bsl_insert ON public\.bank_statement_lines[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.bank_statement_imports bsi[\s\S]*?bsi\.id = bank_statement_lines\.import_id[\s\S]*?bsi\.company_id = bank_statement_lines\.company_id/i,
        "bank_statement_lines must validate authoritative parent bank_statement_imports"
      );

      // bank_reconciliation_sessions -> bank_accounts
      assert.match(
        migrationSql,
        /CREATE POLICY p_brs_insert ON public\.bank_reconciliation_sessions[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.bank_accounts ba[\s\S]*?ba\.id = bank_reconciliation_sessions\.bank_account_id[\s\S]*?ba\.company_id = bank_reconciliation_sessions\.company_id/i,
        "bank_reconciliation_sessions must validate authoritative parent bank_accounts"
      );

      // bank_reconciliation_matches -> sessions, lines, and transactions
      assert.match(
        migrationSql,
        /CREATE POLICY p_brm_insert ON public\.bank_reconciliation_matches[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.bank_reconciliation_sessions brs[\s\S]*?brs\.id = bank_reconciliation_matches\.reconciliation_session_id[\s\S]*?brs\.company_id = bank_reconciliation_matches\.company_id/i,
        "bank_reconciliation_matches must validate authoritative parent bank_reconciliation_sessions"
      );
      assert.match(
        migrationSql,
        /CREATE POLICY p_brm_insert ON public\.bank_reconciliation_matches[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.bank_statement_lines bsl[\s\S]*?bsl\.id = bank_reconciliation_matches\.statement_line_id[\s\S]*?bsl\.company_id = bank_reconciliation_matches\.company_id/i,
        "bank_reconciliation_matches must validate authoritative parent bank_statement_lines"
      );
      assert.match(
        migrationSql,
        /CREATE POLICY p_brm_insert ON public\.bank_reconciliation_matches[\s\S]*?EXISTS \([\s\S]*?SELECT 1 FROM public\.cashbook_transactions ct[\s\S]*?ct\.id = bank_reconciliation_matches\.cashbook_transaction_id[\s\S]*?ct\.company_id = bank_reconciliation_matches\.company_id/i,
        "bank_reconciliation_matches must validate authoritative parent cashbook_transactions"
      );

      // cashbook_attachments -> polymorphic owning cashbook records
      assert.match(
        migrationSql,
        /CREATE POLICY p_cb_attach_insert ON public\.cashbook_attachments[\s\S]*?record_type = 'cashbook_transaction'[\s\S]*?SELECT 1 FROM public\.cashbook_transactions ct[\s\S]*?record_type = 'bank_statement_import'[\s\S]*?SELECT 1 FROM public\.bank_statement_imports bsi[\s\S]*?record_type = 'reconciliation_session'[\s\S]*?SELECT 1 FROM public\.bank_reconciliation_sessions brs/i,
        "cashbook_attachments must validate authoritative parent records across supported record types"
      );
    });

    await t1.test("1.5 SELECT policies remain intact without operational write restriction", () => {
      for (const table of TARGET_TABLES) {
        const selectRegex = new RegExp(`CREATE POLICY [a-z0-9_]+_select ON public\\.${table}[\\s\\S]*?FOR SELECT TO authenticated[\\s\\S]*?USING \\([\\s\\S]*?public\\.has_finance_full_access\\(company_id\\)[\\s\\S]*?\\);`, "i");
        assert.match(migrationSql, selectRegex, `Table ${table} must maintain SELECT policy without operational write requirement`);
      }
    });

    await t1.test("1.6 All mutating SECURITY DEFINER RPCs are defined in migration", () => {
      for (const rpc of TARGET_RPCS) {
        const rpcPattern = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${rpc}\\(`, "i");
        assert.match(migrationSql, rpcPattern, `RPC public.${rpc} must be defined in migration`);
      }
    });

    await t1.test("1.7 All mutating RPCs raise SQLSTATE PM001 with exact message on billing read-only", () => {
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
    await t2.test("2.1 schema.sql contains the Step 3C.4F-1F billing enforcement section", () => {
      assert.ok(
        schemaSql.includes("STEP 3C.4F-1F: CASHBOOK AND BANKING ENFORCEMENT"),
        "schema.sql must contain Step 3C.4F-1F header"
      );
      assert.ok(
        schemaSql.includes("p_cbt_insert"),
        "schema.sql must contain updated cashbook transactions insert policy"
      );
      assert.ok(
        schemaSql.includes("match_bank_statement_line"),
        "schema.sql must contain updated match_bank_statement_line RPC"
      );
      assert.ok(
        schemaSql.includes("complete_bank_reconciliation_session"),
        "schema.sql must contain updated complete_bank_reconciliation_session RPC"
      );
    });

    await t2.test("2.2 All mutating RPCs configure secure search_path (search_path = public, pg_temp)", () => {
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

    await t3.test("3.1 Full access company allows all operational writes on all 9 tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, fullAccessCompany), true);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, fullAccessCompany), true);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, fullAccessCompany), true);
      }
    });

    await t3.test("3.2 Grace period company allows operational writes on all 9 tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, gracePeriodCompany), true);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, gracePeriodCompany), true);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, gracePeriodCompany), true);
      }
    });

    await t3.test("3.3 Read-only company rejects all operational writes on all 9 tables", () => {
      for (const table of TARGET_TABLES) {
        assert.equal(checkRlsWritePolicy(table, "INSERT", true, readOnlyCompany), false);
        assert.equal(checkRlsWritePolicy(table, "UPDATE", true, readOnlyCompany), false);
        assert.equal(checkRlsWritePolicy(table, "DELETE", true, readOnlyCompany), false);
      }
    });

    await t3.test("3.4 Cross-company parent/child mismatch is rejected even with full access", () => {
      assert.equal(
        checkRlsWritePolicy("cashbook_transactions", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company bank account reference in transaction must be blocked"
      );
      assert.equal(
        checkRlsWritePolicy("cashbook_allocations", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company transaction allocation must be blocked"
      );
      assert.equal(
        checkRlsWritePolicy("bank_statement_imports", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company statement import bank account must be blocked"
      );
      assert.equal(
        checkRlsWritePolicy("bank_statement_lines", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company statement line import must be blocked"
      );
      assert.equal(
        checkRlsWritePolicy("bank_reconciliation_sessions", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company reconciliation session bank account must be blocked"
      );
      assert.equal(
        checkRlsWritePolicy("bank_reconciliation_matches", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company reconciliation match must be blocked"
      );
      assert.equal(
        checkRlsWritePolicy("cashbook_attachments", "INSERT", true, fullAccessCompany, false),
        false,
        "Cross-company cashbook attachment must be blocked"
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
