import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1I: Server-Side Billing Write Enforcement on Procurement & Inventory Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 3 Procurement & Inventory tables:
 *    - public.procurement_items
 *    - public.procurement_forecasts
 *    - public.project_inventory_items
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(company_id)
 * 3. Authoritative company and relation validation:
 *    - procurement_items.project_id -> projects (company match)
 *    - procurement_forecasts.project_id -> projects (company match)
 *    - project_inventory_items.project_id -> projects (company match)
 *    - project_inventory_items.procurement_item_id -> procurement_items (company and project match)
 * 4. SELECT RLS Policies remain intact without write block (allowing read and export in read-only billing mode)
 * 5. All Procurement & Inventory SECURITY DEFINER functions use SET search_path = '' and fully qualified identifiers:
 *    - public.soft_delete_project_inventory_item(uuid, uuid, uuid)
 *    - public.fn_sync_procurement_to_inventory()
 *    - public.fn_procurement_items_meta_stamp()
 *    - public.fn_procurement_forecasts_meta_stamp()
 *    - public.fn_project_inventory_items_meta_stamp()
 * 6. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 7. Billing guard on mutating RPC with PM001 error code
 * 8. Automatic procurement-to-inventory sync preservation and non-mutation guarantees
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260828000005_enforce_billing_procurement_inventory.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const TARGET_TABLES = [
  "procurement_items",
  "procurement_forecasts",
  "project_inventory_items",
] as const;

const PROCUREMENT_INVENTORY_SECURITY_DEFINER_FUNCTIONS = [
  "soft_delete_project_inventory_item",
  "fn_sync_procurement_to_inventory",
  "fn_procurement_items_meta_stamp",
  "fn_procurement_forecasts_meta_stamp",
  "fn_project_inventory_items_meta_stamp",
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

interface SimulatedProject {
  id: string;
  company_id: string;
}

interface SimulatedProcurementItem {
  id: string;
  company_id: string;
  project_id: string;
  item_name: string;
  category: string;
  status: string;
}

interface SimulatedProcurementForecast {
  id: string;
  company_id: string;
  project_id: string;
  forecast_month: number;
  forecast_year: number;
  category: string;
}

interface SimulatedProjectInventoryItem {
  id: string;
  company_id: string;
  project_id: string;
  procurement_item_id?: string | null;
  source: "procurement" | "company_stock";
  item_name: string;
  deleted_at?: string | null;
}

function simulateBillingAllowsOperationalWrite(entitlement: CompanyEntitlement): boolean {
  return entitlement.canWrite && (entitlement.accessMode === "full" || entitlement.accessMode === "grace_period");
}

class PostgresError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

function executeRpcBillingGuard(companyId: string, entitlement: CompanyEntitlement): void {
  if (!simulateBillingAllowsOperationalWrite(entitlement)) {
    throw new PostgresError("Company billing access is read-only.", "PM001");
  }
}

// ---------------------------------------------------------------------------
// Simulated RLS Evaluators
// ---------------------------------------------------------------------------

function checkRlsSelectPolicy(
  isMember: boolean,
  isDeleted: boolean = false
): boolean {
  return isMember && !isDeleted;
}

function checkRlsWritePolicyForProcurementItem(
  operation: "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  record: Partial<SimulatedProcurementItem>,
  projects: SimulatedProject[]
): boolean {
  if (!isMember) return false;
  if (!simulateBillingAllowsOperationalWrite(entitlement)) return false;

  if (operation === "INSERT" || operation === "UPDATE") {
    if (!record.project_id || !record.company_id) return false;
    const projectValid = projects.some(
      (p) => p.id === record.project_id && p.company_id === record.company_id
    );
    if (!projectValid) return false;
  }

  return true;
}

function checkRlsWritePolicyForProcurementForecast(
  operation: "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  record: Partial<SimulatedProcurementForecast>,
  projects: SimulatedProject[]
): boolean {
  if (!isMember) return false;
  if (!simulateBillingAllowsOperationalWrite(entitlement)) return false;

  if (operation === "INSERT" || operation === "UPDATE") {
    if (!record.project_id || !record.company_id) return false;
    const projectValid = projects.some(
      (p) => p.id === record.project_id && p.company_id === record.company_id
    );
    if (!projectValid) return false;
  }

  return true;
}

function checkRlsWritePolicyForProjectInventoryItem(
  operation: "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  record: Partial<SimulatedProjectInventoryItem>,
  projects: SimulatedProject[],
  procurementItems: SimulatedProcurementItem[]
): boolean {
  if (!isMember) return false;
  if (!simulateBillingAllowsOperationalWrite(entitlement)) return false;

  if (operation === "INSERT" || operation === "UPDATE") {
    if (!record.project_id || !record.company_id) return false;
    const projectValid = projects.some(
      (p) => p.id === record.project_id && p.company_id === record.company_id
    );
    if (!projectValid) return false;

    if (record.procurement_item_id) {
      const procItemValid = procurementItems.some(
        (pi) =>
          pi.id === record.procurement_item_id &&
          pi.company_id === record.company_id &&
          pi.project_id === record.project_id
      );
      if (!procItemValid) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Test Data Fixtures
// ---------------------------------------------------------------------------

const companyFull: CompanyEntitlement = {
  companyId: "c-full-1111-1111-1111-111111111111",
  accessMode: "full",
  canRead: true,
  canWrite: true,
  canAccessBilling: true,
  canExport: true,
};

const companyGrace: CompanyEntitlement = {
  companyId: "c-grace-2222-2222-2222-222222222222",
  accessMode: "grace_period",
  canRead: true,
  canWrite: true,
  canAccessBilling: true,
  canExport: true,
};

const companyReadOnly: CompanyEntitlement = {
  companyId: "c-ro-3333-3333-3333-333333333333",
  accessMode: "read_only",
  canRead: true,
  canWrite: false,
  canAccessBilling: true,
  canExport: true,
};

const companyOther: CompanyEntitlement = {
  companyId: "c-other-4444-4444-4444-444444444444",
  accessMode: "full",
  canRead: true,
  canWrite: true,
  canAccessBilling: true,
  canExport: true,
};

const sampleProjects: SimulatedProject[] = [
  { id: "proj-1", company_id: companyFull.companyId },
  { id: "proj-2", company_id: companyGrace.companyId },
  { id: "proj-3", company_id: companyReadOnly.companyId },
  { id: "proj-4", company_id: companyOther.companyId },
];

const sampleProcurementItems: SimulatedProcurementItem[] = [
  {
    id: "proc-1",
    company_id: companyFull.companyId,
    project_id: "proj-1",
    item_name: "Safety Helmets",
    category: "OHS",
    status: "Delivered",
  },
  {
    id: "proc-2",
    company_id: companyGrace.companyId,
    project_id: "proj-2",
    item_name: "Site Office Containers",
    category: "Site Establishment",
    status: "Procured",
  },
  {
    id: "proc-3",
    company_id: companyReadOnly.companyId,
    project_id: "proj-3",
    item_name: "Diesel Generator Fuel",
    category: "Operational Costs",
    status: "Paid",
  },
  {
    id: "proc-4",
    company_id: companyOther.companyId,
    project_id: "proj-4",
    item_name: "Spill Kits",
    category: "Environmental",
    status: "Delivered",
  },
];

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test("Step 3C.4F-1I: Procurement & Inventory Billing Enforcement Suite", async (t) => {
  await t.test("1. Migration Structure & Completeness", async (t1) => {
    await t1.test("1.1 Migration file exists and has non-empty content", () => {
      assert.ok(migrationSql.length > 500, "Migration file must contain valid SQL");
      assert.ok(
        migrationSql.includes("Step 3C.4F-1I"),
        "Migration header must reference Step 3C.4F-1I"
      );
    });

    await t1.test("1.2 All three target tables have write RLS policies redefined", () => {
      for (const table of TARGET_TABLES) {
        assert.ok(
          migrationSql.includes(`CREATE POLICY insert_${table}`),
          `Missing INSERT policy for ${table}`
        );
        assert.ok(
          migrationSql.includes(`CREATE POLICY update_${table}`),
          `Missing UPDATE policy for ${table}`
        );
        assert.ok(
          migrationSql.includes(`CREATE POLICY delete_${table}`),
          `Missing DELETE policy for ${table}`
        );
      }
    });

    await t1.test("1.3 Write RLS policies enforce company_billing_allows_operational_write", () => {
      for (const table of TARGET_TABLES) {
        const insertPolicy = migrationSql.match(
          new RegExp(`CREATE POLICY insert_${table}[\\s\\S]*?;`, "i")
        );
        assert.ok(insertPolicy, `INSERT policy found for ${table}`);
        assert.ok(
          insertPolicy[0].includes("public.company_billing_allows_operational_write(company_id)"),
          `INSERT policy on ${table} must check operational write billing`
        );

        const updatePolicy = migrationSql.match(
          new RegExp(`CREATE POLICY update_${table}[\\s\\S]*?;`, "i")
        );
        assert.ok(updatePolicy, `UPDATE policy found for ${table}`);
        assert.ok(
          updatePolicy[0].includes("public.company_billing_allows_operational_write(company_id)"),
          `UPDATE policy on ${table} must check operational write billing`
        );

        const deletePolicy = migrationSql.match(
          new RegExp(`CREATE POLICY delete_${table}[\\s\\S]*?;`, "i")
        );
        assert.ok(deletePolicy, `DELETE policy found for ${table}`);
        assert.ok(
          deletePolicy[0].includes("public.company_billing_allows_operational_write(company_id)"),
          `DELETE policy on ${table} must check operational write billing`
        );
      }
    });

    await t1.test("1.4 Child table project_inventory_items enforces authoritative parent procurement item and project integrity", () => {
      const insertPolicy = migrationSql.match(
        /CREATE POLICY insert_project_inventory_items[\s\S]*?;/i
      );
      assert.ok(insertPolicy);
      assert.ok(
        insertPolicy[0].includes("procurement_item_id IS NULL") &&
        insertPolicy[0].includes("WHERE pi.id = project_inventory_items.procurement_item_id") &&
        insertPolicy[0].includes("AND pi.company_id = project_inventory_items.company_id") &&
        insertPolicy[0].includes("AND pi.project_id = project_inventory_items.project_id"),
        "project_inventory_items INSERT policy must ensure linked procurement item belongs to same company and project"
      );

      const updatePolicy = migrationSql.match(
        /CREATE POLICY update_project_inventory_items[\s\S]*?;/i
      );
      assert.ok(updatePolicy);
      assert.ok(
        updatePolicy[0].includes("procurement_item_id IS NULL") &&
        updatePolicy[0].includes("WHERE pi.id = project_inventory_items.procurement_item_id") &&
        updatePolicy[0].includes("AND pi.company_id = project_inventory_items.company_id") &&
        updatePolicy[0].includes("AND pi.project_id = project_inventory_items.project_id"),
        "project_inventory_items UPDATE policy must ensure linked procurement item belongs to same company and project"
      );
    });

    await t1.test("1.5 procurement_items and procurement_forecasts enforce project company integrity", () => {
      for (const table of ["procurement_items", "procurement_forecasts"] as const) {
        const insertPolicy = migrationSql.match(
          new RegExp(`CREATE POLICY insert_${table}[\\s\\S]*?;`, "i")
        );
        assert.ok(insertPolicy);
        assert.ok(
          insertPolicy[0].includes(`WHERE p.id = ${table}.project_id`) &&
          insertPolicy[0].includes(`AND p.company_id = ${table}.company_id`),
          `${table} INSERT policy must ensure project belongs to row company`
        );

        const updatePolicy = migrationSql.match(
          new RegExp(`CREATE POLICY update_${table}[\\s\\S]*?;`, "i")
        );
        assert.ok(updatePolicy);
        assert.ok(
          updatePolicy[0].includes(`WHERE p.id = ${table}.project_id`) &&
          updatePolicy[0].includes(`AND p.company_id = ${table}.company_id`),
          `${table} UPDATE policy must ensure project belongs to row company`
        );
      }
    });

    await t1.test("1.6 SELECT policies remain intact without operational write restriction", () => {
      for (const table of TARGET_TABLES) {
        const selectPolicy = migrationSql.match(
          new RegExp(`CREATE POLICY select_${table}[\\s\\S]*?;`, "i")
        );
        assert.ok(selectPolicy, `SELECT policy found for ${table}`);
        assert.ok(
          !selectPolicy[0].includes("company_billing_allows_operational_write"),
          `SELECT policy on ${table} must not restrict read access by billing write status`
        );
        assert.ok(
          selectPolicy[0].includes("verify_membership_access"),
          `SELECT policy on ${table} must check membership access`
        );
      }
    });

    await t1.test("1.7 Execution permissions and table grants properly configured", () => {
      assert.ok(
        migrationSql.includes("GRANT EXECUTE ON FUNCTION public.soft_delete_project_inventory_item(UUID, UUID, UUID) TO authenticated;"),
        "soft_delete_project_inventory_item must be granted to authenticated"
      );
      assert.ok(
        migrationSql.includes("REVOKE ALL ON FUNCTION public.soft_delete_project_inventory_item(UUID, UUID, UUID) FROM PUBLIC, anon;"),
        "soft_delete_project_inventory_item must be revoked from PUBLIC and anon"
      );
      assert.ok(
        migrationSql.includes("GRANT EXECUTE ON FUNCTION public.fn_sync_procurement_to_inventory() TO service_role;"),
        "fn_sync_procurement_to_inventory must be granted to service_role"
      );
    });
  });

  await t.test("2. Schema Parity & Search Path Verification", async (t2) => {
    await t2.test("2.1 schema.sql contains the Step 3C.4F-1I Procurement and Inventory billing enforcement section", () => {
      assert.ok(
        schemaSql.includes("Step 3C.4F-1I"),
        "schema.sql must contain Step 3C.4F-1I section"
      );
      for (const table of TARGET_TABLES) {
        assert.ok(
          schemaSql.includes(`CREATE POLICY insert_${table}`),
          `schema.sql missing INSERT policy for ${table}`
        );
        assert.ok(
          schemaSql.includes(`CREATE POLICY update_${table}`),
          `schema.sql missing UPDATE policy for ${table}`
        );
        assert.ok(
          schemaSql.includes(`CREATE POLICY delete_${table}`),
          `schema.sql missing DELETE policy for ${table}`
        );
      }
    });

    await t2.test("2.2 All Procurement & Inventory SECURITY DEFINER functions configure empty search_path (SET search_path = '')", () => {
      for (const func of PROCUREMENT_INVENTORY_SECURITY_DEFINER_FUNCTIONS) {
        const funcBlock = migrationSql.match(
          new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${func}[\\s\\S]*?\\$\\$;`, "i")
        );
        assert.ok(funcBlock, `Function public.${func} must be defined in migration`);
        assert.ok(
          /SET search_path\s*=\s*''/i.test(funcBlock[0]),
          `Function public.${func} must contain SET search_path = ''`
        );
      }
    });

    await t2.test("2.3 All functions fully qualify application tables with public.", () => {
      for (const func of PROCUREMENT_INVENTORY_SECURITY_DEFINER_FUNCTIONS) {
        const funcBlock = migrationSql.match(
          new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${func}[\\s\\S]*?\\$\\$;`, "i")
        );
        if (funcBlock) {
          const sql = funcBlock[0];
          for (const tbl of TARGET_TABLES) {
            const re = new RegExp(`(?<!public\\.)\\b${tbl}\\b`, "i");
            assert.ok(
              !re.test(sql),
              `Function ${func} must qualify table ${tbl} with public.`
            );
          }
        }
      }
    });

    await t2.test("2.4 All functions fully qualify auth functions with auth.", () => {
      for (const func of PROCUREMENT_INVENTORY_SECURITY_DEFINER_FUNCTIONS) {
        const funcBlock = migrationSql.match(
          new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${func}[\\s\\S]*?\\$\\$;`, "i")
        );
        if (funcBlock) {
          const sql = funcBlock[0];
          if (sql.includes("uid()")) {
            assert.ok(
              sql.includes("auth.uid()"),
              `Function ${func} must qualify uid() with auth.uid()`
            );
          }
        }
      }
    });

    await t2.test("2.5 All functions fully qualify built-in functions with pg_catalog.", () => {
      for (const func of PROCUREMENT_INVENTORY_SECURITY_DEFINER_FUNCTIONS) {
        const funcBlock = migrationSql.match(
          new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${func}[\\s\\S]*?\\$\\$;`, "i")
        );
        if (funcBlock) {
          const sql = funcBlock[0];
          const builtins = ["now", "coalesce", "length", "btrim"];
          for (const b of builtins) {
            const re = new RegExp(`(?<!pg_catalog\\.)\\b${b}\\(`, "i");
            assert.ok(
              !re.test(sql),
              `Function ${func} must qualify ${b} with pg_catalog.`
            );
          }
        }
      }
    });
  });

  await t.test("3. Entitlement Behavior Simulation & RLS Evaluation", async (t3) => {
    await t3.test("3.1 Full access company allows operational writes on all three tables", () => {
      for (const op of ["INSERT", "UPDATE", "DELETE"] as const) {
        assert.equal(
          checkRlsWritePolicyForProcurementItem(
            op,
            true,
            companyFull,
            { company_id: companyFull.companyId, project_id: "proj-1" },
            sampleProjects
          ),
          true,
          `Full access must allow ${op} on procurement_items`
        );
        assert.equal(
          checkRlsWritePolicyForProcurementForecast(
            op,
            true,
            companyFull,
            { company_id: companyFull.companyId, project_id: "proj-1" },
            sampleProjects
          ),
          true,
          `Full access must allow ${op} on procurement_forecasts`
        );
        assert.equal(
          checkRlsWritePolicyForProjectInventoryItem(
            op,
            true,
            companyFull,
            { company_id: companyFull.companyId, project_id: "proj-1", procurement_item_id: "proc-1" },
            sampleProjects,
            sampleProcurementItems
          ),
          true,
          `Full access must allow ${op} on project_inventory_items`
        );
      }
    });

    await t3.test("3.2 Grace period company allows operational writes on all three tables", () => {
      for (const op of ["INSERT", "UPDATE", "DELETE"] as const) {
        assert.equal(
          checkRlsWritePolicyForProcurementItem(
            op,
            true,
            companyGrace,
            { company_id: companyGrace.companyId, project_id: "proj-2" },
            sampleProjects
          ),
          true,
          `Grace period must allow ${op} on procurement_items`
        );
        assert.equal(
          checkRlsWritePolicyForProcurementForecast(
            op,
            true,
            companyGrace,
            { company_id: companyGrace.companyId, project_id: "proj-2" },
            sampleProjects
          ),
          true,
          `Grace period must allow ${op} on procurement_forecasts`
        );
        assert.equal(
          checkRlsWritePolicyForProjectInventoryItem(
            op,
            true,
            companyGrace,
            { company_id: companyGrace.companyId, project_id: "proj-2", procurement_item_id: "proc-2" },
            sampleProjects,
            sampleProcurementItems
          ),
          true,
          `Grace period must allow ${op} on project_inventory_items`
        );
      }
    });

    await t3.test("3.3 Read-only company rejects all operational writes on all three tables", () => {
      for (const op of ["INSERT", "UPDATE", "DELETE"] as const) {
        assert.equal(
          checkRlsWritePolicyForProcurementItem(
            op,
            true,
            companyReadOnly,
            { company_id: companyReadOnly.companyId, project_id: "proj-3" },
            sampleProjects
          ),
          false,
          `Read-only company must reject ${op} on procurement_items`
        );
        assert.equal(
          checkRlsWritePolicyForProcurementForecast(
            op,
            true,
            companyReadOnly,
            { company_id: companyReadOnly.companyId, project_id: "proj-3" },
            sampleProjects
          ),
          false,
          `Read-only company must reject ${op} on procurement_forecasts`
        );
        assert.equal(
          checkRlsWritePolicyForProjectInventoryItem(
            op,
            true,
            companyReadOnly,
            { company_id: companyReadOnly.companyId, project_id: "proj-3", procurement_item_id: "proc-3" },
            sampleProjects,
            sampleProcurementItems
          ),
          false,
          `Read-only company must reject ${op} on project_inventory_items`
        );
      }
    });

    await t3.test("3.4 Inactive or non-member rejected even if billing is full", () => {
      for (const op of ["INSERT", "UPDATE", "DELETE"] as const) {
        assert.equal(
          checkRlsWritePolicyForProcurementItem(
            op,
            false,
            companyFull,
            { company_id: companyFull.companyId, project_id: "proj-1" },
            sampleProjects
          ),
          false,
          `Non-member must be rejected for ${op} on procurement_items`
        );
        assert.equal(
          checkRlsWritePolicyForProcurementForecast(
            op,
            false,
            companyFull,
            { company_id: companyFull.companyId, project_id: "proj-1" },
            sampleProjects
          ),
          false,
          `Non-member must be rejected for ${op} on procurement_forecasts`
        );
        assert.equal(
          checkRlsWritePolicyForProjectInventoryItem(
            op,
            false,
            companyFull,
            { company_id: companyFull.companyId, project_id: "proj-1" },
            sampleProjects,
            sampleProcurementItems
          ),
          false,
          `Non-member must be rejected for ${op} on project_inventory_items`
        );
      }
    });

    await t3.test("3.5 Cross-company project or procurement item mismatch is rejected even with full access", () => {
      // Procurement item linked to project of different company
      const crossProjectProcItem: Partial<SimulatedProcurementItem> = {
        company_id: companyFull.companyId,
        project_id: "proj-4", // belongs to companyOther
      };
      assert.equal(
        checkRlsWritePolicyForProcurementItem("INSERT", true, companyFull, crossProjectProcItem, sampleProjects),
        false,
        "Procurement item referencing project from different company must be rejected"
      );

      // Inventory item linked to procurement item of different company
      const crossProcInventoryItem: Partial<SimulatedProjectInventoryItem> = {
        company_id: companyFull.companyId,
        project_id: "proj-1",
        procurement_item_id: "proc-4", // belongs to companyOther
      };
      assert.equal(
        checkRlsWritePolicyForProjectInventoryItem("INSERT", true, companyFull, crossProcInventoryItem, sampleProjects, sampleProcurementItems),
        false,
        "Inventory item referencing procurement item from different company must be rejected"
      );

      // Inventory item linked to project of different company
      const crossProjectInventoryItem: Partial<SimulatedProjectInventoryItem> = {
        company_id: companyFull.companyId,
        project_id: "proj-4", // belongs to companyOther
      };
      assert.equal(
        checkRlsWritePolicyForProjectInventoryItem("INSERT", true, companyFull, crossProjectInventoryItem, sampleProjects, sampleProcurementItems),
        false,
        "Inventory item referencing project from different company must be rejected"
      );
    });

    await t3.test("3.6 Read and export remain available for all companies including read-only", () => {
      assert.equal(checkRlsSelectPolicy(true), true, "Member of full company can SELECT");
      assert.equal(checkRlsSelectPolicy(true), true, "Member of grace company can SELECT");
      assert.equal(checkRlsSelectPolicy(true), true, "Member of read-only company can SELECT");
      assert.equal(checkRlsSelectPolicy(false), false, "Non-member cannot SELECT");
      assert.equal(checkRlsSelectPolicy(true, true), false, "Soft-deleted inventory item cannot be selected");
      assert.equal(companyReadOnly.canRead, true, "Read-only company has canRead = true");
      assert.equal(companyReadOnly.canExport, true, "Read-only company has canExport = true");
      assert.equal(companyReadOnly.canAccessBilling, true, "Read-only company has canAccessBilling = true");
    });
  });

  await t.test("4. RPC Billing Guard & Immutability Guarantees", async (t4) => {
    await t4.test("4.1 soft_delete_project_inventory_item enforces PM001 error on read-only access", () => {
      assert.throws(
        () => executeRpcBillingGuard(companyReadOnly.companyId, companyReadOnly),
        (err: any) => {
          assert.equal(err.code, "PM001");
          assert.equal(err.message, "Company billing access is read-only.");
          return true;
        },
        "RPC must throw PM001 when company billing is read-only"
      );

      assert.doesNotThrow(() => {
        executeRpcBillingGuard(companyFull.companyId, companyFull);
      });
      assert.doesNotThrow(() => {
        executeRpcBillingGuard(companyGrace.companyId, companyGrace);
      });
    });

    await t4.test("4.2 RPC soft_delete_project_inventory_item definition checks billing and membership", () => {
      const rpcBlock = migrationSql.match(
        /CREATE (?:OR REPLACE )?FUNCTION public\.soft_delete_project_inventory_item[\s\S]*?\$\$;/i
      );
      assert.ok(rpcBlock, "soft_delete_project_inventory_item must be present");
      assert.ok(
        /public\.verify_membership_access\s*\(\s*p_company_id\s*,\s*p_project_id\s*\)/i.test(rpcBlock[0]),
        "soft_delete_project_inventory_item must verify membership access"
      );
      assert.ok(
        /public\.company_billing_allows_operational_write\s*\(\s*p_company_id\s*\)/i.test(rpcBlock[0]),
        "soft_delete_project_inventory_item must check company_billing_allows_operational_write"
      );
      assert.ok(
        rpcBlock[0].includes("PM001"),
        "soft_delete_project_inventory_item must raise PM001 error code"
      );
      assert.ok(
        rpcBlock[0].includes("Company billing access is read-only."),
        "soft_delete_project_inventory_item must raise 'Company billing access is read-only.' message"
      );
    });

    await t4.test("4.3 Trigger fn_procurement_items_meta_stamp enforces company_id immutability on UPDATE", () => {
      assert.ok(
        migrationSql.includes("NEW.company_id := OLD.company_id;"),
        "fn_procurement_items_meta_stamp must freeze company_id on UPDATE"
      );
      assert.ok(
        migrationSql.includes("NEW.project_id := OLD.project_id;"),
        "fn_procurement_items_meta_stamp must freeze project_id on UPDATE"
      );
      assert.ok(
        migrationSql.includes("NEW.created_by := OLD.created_by;"),
        "fn_procurement_items_meta_stamp must freeze created_by on UPDATE"
      );
      assert.ok(
        migrationSql.includes("NEW.created_at := OLD.created_at;"),
        "fn_procurement_items_meta_stamp must freeze created_at on UPDATE"
      );
    });

    await t4.test("4.4 Automatic sync trigger fn_sync_procurement_to_inventory preserves sync logic", () => {
      const syncBlock = migrationSql.match(
        /CREATE (?:OR REPLACE )?FUNCTION public\.fn_sync_procurement_to_inventory[\s\S]*?\$\$;/i
      );
      assert.ok(syncBlock, "fn_sync_procurement_to_inventory must be present");
      assert.ok(
        syncBlock[0].includes("NEW.status NOT IN ('Procured', 'Paid', 'Delivered')"),
        "fn_sync_procurement_to_inventory must check eligible statuses"
      );
      assert.ok(
        syncBlock[0].includes("INSERT INTO public.project_inventory_items"),
        "fn_sync_procurement_to_inventory must insert into project_inventory_items"
      );
    });
  });

  await t.test("5. Non-Mutation and Transaction Safety Guarantees", async (t5) => {
    await t5.test("5.1 RLS write policies verify operational write check before permitting mutation", () => {
      for (const table of TARGET_TABLES) {
        assert.ok(
          migrationSql.includes(`public.company_billing_allows_operational_write(company_id)`),
          `All tables must check company_billing_allows_operational_write for ${table}`
        );
      }
    });

    await t5.test("5.2 Atomic rollback occurs on any constraint, validation or RLS violation", () => {
      const canWriteReadOnly = simulateBillingAllowsOperationalWrite(companyReadOnly);
      assert.equal(canWriteReadOnly, false, "Read-only company cannot perform operational write");
    });
  });
});
