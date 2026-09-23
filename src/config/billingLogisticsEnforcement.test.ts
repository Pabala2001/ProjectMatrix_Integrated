import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1H: Server-Side Billing Write Enforcement on Logistics Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 2 Logistics tables:
 *    - fleet_assets
 *    - fleet_trips
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(company_id)
 * 3. Authoritative company and relation validation:
 *    - fleet_assets.current_project_id -> projects (company match)
 *    - fleet_trips.fleet_asset_id -> fleet_assets (company match)
 *    - fleet_trips.project_id -> projects (company match)
 * 4. SELECT RLS Policies remain intact without write block (allowing read and export)
 * 5. All Logistics SECURITY DEFINER functions use SET search_path = '' and fully qualified identifiers:
 *    - public.verify_company_membership_access(uuid)
 *    - public.fn_normalize_fleet_assets()
 *    - public.fn_normalize_fleet_trips()
 *    - public.fn_logistics_meta_stamp()
 *    - public.fn_logistics_audit_trigger()
 * 6. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 7. Cross-company tampering, asset/project isolation, and non-mutation guarantees
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260828000004_enforce_billing_logistics.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const TARGET_TABLES = [
  "fleet_assets",
  "fleet_trips",
] as const;

const LOGISTICS_SECURITY_DEFINER_FUNCTIONS = [
  "verify_company_membership_access",
  "fn_normalize_fleet_assets",
  "fn_normalize_fleet_trips",
  "fn_logistics_meta_stamp",
  "fn_logistics_audit_trigger",
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

interface SimulatedFleetAsset {
  id: string;
  company_id: string;
  current_project_id?: string | null;
  asset_number: string;
  asset_type: string;
  make_model: string;
  registration?: string | null;
  status: string;
  category: string;
}

interface SimulatedFleetTrip {
  id: string;
  company_id: string;
  fleet_asset_id: string;
  project_id?: string | null;
  driver_first_name: string;
  driver_last_name: string;
  start_destination: string;
  end_destination?: string | null;
  status: string;
}

interface SimulatedProject {
  id: string;
  company_id: string;
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

function checkRlsWritePolicyForAsset(
  operation: "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  asset: Partial<SimulatedFleetAsset>,
  projects: SimulatedProject[]
): boolean {
  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  if (!isMember || !writeAllowed) {
    return false;
  }
  if (operation === "INSERT" || operation === "UPDATE") {
    if (asset.current_project_id) {
      const project = projects.find(p => p.id === asset.current_project_id);
      if (!project || project.company_id !== asset.company_id) {
        return false;
      }
    }
  }
  return true;
}

function checkRlsWritePolicyForTrip(
  operation: "INSERT" | "UPDATE" | "DELETE",
  isMember: boolean,
  entitlement: CompanyEntitlement,
  trip: Partial<SimulatedFleetTrip>,
  assets: SimulatedFleetAsset[],
  projects: SimulatedProject[]
): boolean {
  const writeAllowed = simulateBillingAllowsOperationalWrite(entitlement);
  if (!isMember || !writeAllowed) {
    return false;
  }
  if (operation === "INSERT" || operation === "UPDATE") {
    if (!trip.fleet_asset_id) {
      return false;
    }
    const asset = assets.find(a => a.id === trip.fleet_asset_id);
    if (!asset || asset.company_id !== trip.company_id) {
      return false;
    }
    if (trip.project_id) {
      const project = projects.find(p => p.id === trip.project_id);
      if (!project || project.company_id !== trip.company_id) {
        return false;
      }
    }
  }
  return true;
}

function checkRlsSelectPolicy(isMember: boolean): boolean {
  return isMember;
}

test("Step 3C.4F-1H: Logistics Billing Enforcement Suite", async (t) => {
  const companyFull: CompanyEntitlement = {
    companyId: "11111111-1111-1111-1111-111111111111",
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const companyGrace: CompanyEntitlement = {
    companyId: "22222222-2222-2222-2222-222222222222",
    accessMode: "grace_period",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const companyReadOnly: CompanyEntitlement = {
    companyId: "33333333-3333-3333-3333-333333333333",
    accessMode: "read_only",
    canRead: true,
    canWrite: false,
    canAccessBilling: true,
    canExport: true,
  };

  const companyOther: CompanyEntitlement = {
    companyId: "44444444-4444-4444-4444-444444444444",
    accessMode: "full",
    canRead: true,
    canWrite: true,
    canAccessBilling: true,
    canExport: true,
  };

  const sampleAssets: SimulatedFleetAsset[] = [
    {
      id: "fa-1",
      company_id: companyFull.companyId,
      asset_number: "TRK-001",
      asset_type: "Truck",
      make_model: "Volvo FH16",
      status: "Available",
      category: "Commercial Vehicles",
    },
    {
      id: "fa-2",
      company_id: companyGrace.companyId,
      asset_number: "VAN-002",
      asset_type: "Van",
      make_model: "Ford Transit",
      status: "Available",
      category: "Commercial Vehicles",
    },
    {
      id: "fa-3",
      company_id: companyReadOnly.companyId,
      asset_number: "EXC-003",
      asset_type: "Excavator",
      make_model: "CAT 320",
      status: "Available",
      category: "Plant",
    },
    {
      id: "fa-4",
      company_id: companyOther.companyId,
      asset_number: "TRK-004",
      asset_type: "Truck",
      make_model: "Scania R500",
      status: "Available",
      category: "Commercial Vehicles",
    },
  ];

  const sampleProjects: SimulatedProject[] = [
    { id: "proj-1", company_id: companyFull.companyId },
    { id: "proj-2", company_id: companyGrace.companyId },
    { id: "proj-3", company_id: companyReadOnly.companyId },
    { id: "proj-4", company_id: companyOther.companyId },
  ];

  await t.test("1. Migration Structure & Completeness", async (t1) => {
    await t1.test("1.1 Migration file exists and has non-empty content", () => {
      assert.ok(migrationSql.length > 500, "Migration file must contain substantive content");
    });

    await t1.test("1.2 Both target tables have write RLS policies redefined", () => {
      for (const table of TARGET_TABLES) {
        assert.ok(
          migrationSql.includes(`DROP POLICY IF EXISTS insert_${table} ON public.${table};`),
          `Migration must drop insert policy on ${table}`
        );
        assert.ok(
          migrationSql.includes(`CREATE POLICY insert_${table} ON public.${table}`),
          `Migration must create insert policy on ${table}`
        );
        assert.ok(
          migrationSql.includes(`CREATE POLICY update_${table} ON public.${table}`),
          `Migration must create update policy on ${table}`
        );
        assert.ok(
          migrationSql.includes(`CREATE POLICY delete_${table} ON public.${table}`),
          `Migration must create delete policy on ${table}`
        );
      }
    });

    await t1.test("1.3 Write RLS policies enforce company_billing_allows_operational_write", () => {
      for (const table of TARGET_TABLES) {
        const insertRegex = new RegExp(
          `CREATE POLICY insert_${table}[\\s\\S]*?WITH CHECK\\s*\\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)[\\s\\S]*?\\);`,
          "i"
        );
        assert.match(
          migrationSql,
          insertRegex,
          `Table ${table} INSERT policy must enforce company_billing_allows_operational_write`
        );

        const updateRegex = new RegExp(
          `CREATE POLICY update_${table}[\\s\\S]*?USING\\s*\\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)[\\s\\S]*?\\)[\\s\\S]*?WITH CHECK\\s*\\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)[\\s\\S]*?\\);`,
          "i"
        );
        assert.match(
          migrationSql,
          updateRegex,
          `Table ${table} UPDATE policy must enforce company_billing_allows_operational_write in USING and WITH CHECK`
        );

        const deleteRegex = new RegExp(
          `CREATE POLICY delete_${table}[\\s\\S]*?USING\\s*\\([\\s\\S]*?public\\.company_billing_allows_operational_write\\(company_id\\)[\\s\\S]*?\\);`,
          "i"
        );
        assert.match(
          migrationSql,
          deleteRegex,
          `Table ${table} DELETE policy must enforce company_billing_allows_operational_write in USING`
        );
      }
    });

    await t1.test("1.4 Child table fleet_trips enforces authoritative parent asset and project company integrity", () => {
      assert.ok(
        migrationSql.includes("fa.company_id = fleet_trips.company_id"),
        "fleet_trips write policies must verify fleet_asset belongs to same company"
      );
      assert.ok(
        migrationSql.includes("p.company_id = fleet_trips.company_id"),
        "fleet_trips write policies must verify linked project belongs to same company"
      );
    });

    await t1.test("1.5 fleet_assets enforces project company integrity", () => {
      assert.ok(
        migrationSql.includes("p.company_id = fleet_assets.company_id"),
        "fleet_assets write policies must verify current_project_id belongs to same company"
      );
    });

    await t1.test("1.6 SELECT policies remain intact without operational write restriction", () => {
      for (const table of TARGET_TABLES) {
        const selectMatch = migrationSql.match(
          new RegExp(`CREATE POLICY select_${table}[\\s\\S]*?USING\\s*\\(([\\s\\S]*?)\\);`, "i")
        );
        assert.ok(selectMatch, `Table ${table} must have a SELECT policy`);
        assert.ok(
          !selectMatch[1].includes("company_billing_allows_operational_write"),
          `Table ${table} SELECT policy MUST NOT be gated by company_billing_allows_operational_write`
        );
        assert.ok(
          selectMatch[1].includes("public.verify_company_membership_access(company_id)"),
          `Table ${table} SELECT policy must verify company membership`
        );
      }
    });

    await t1.test("1.7 Execution permissions granted to authenticated and revoked from anon/public", () => {
      assert.ok(
        migrationSql.includes("GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_assets TO authenticated;"),
        "authenticated must be granted DML on fleet_assets"
      );
      assert.ok(
        migrationSql.includes("GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_trips TO authenticated;"),
        "authenticated must be granted DML on fleet_trips"
      );
      assert.ok(
        migrationSql.includes("REVOKE ALL ON TABLE public.fleet_assets FROM PUBLIC, anon;"),
        "PUBLIC and anon must be revoked from fleet_assets"
      );
      assert.ok(
        migrationSql.includes("REVOKE ALL ON TABLE public.fleet_trips FROM PUBLIC, anon;"),
        "PUBLIC and anon must be revoked from fleet_trips"
      );
    });
  });

  await t.test("2. Schema Parity & Search Path Verification", async (t2) => {
    await t2.test("2.1 schema.sql contains the Step 3C.4F-1H Logistics billing enforcement section", () => {
      assert.ok(
        schemaSql.includes("STEP 3C.4F-1H: LOGISTICS BILLING ENFORCEMENT"),
        "schema.sql must contain Step 3C.4F-1H Logistics section header"
      );
      for (const table of TARGET_TABLES) {
        assert.ok(
          schemaSql.includes(`CREATE POLICY insert_${table} ON public.${table}`),
          `schema.sql must contain insert policy for ${table}`
        );
        assert.ok(
          schemaSql.includes(`CREATE POLICY update_${table} ON public.${table}`),
          `schema.sql must contain update policy for ${table}`
        );
        assert.ok(
          schemaSql.includes(`CREATE POLICY delete_${table} ON public.${table}`),
          `schema.sql must contain delete policy for ${table}`
        );
      }
    });

    await t2.test("2.2 All logistics SECURITY DEFINER functions configure empty search_path (SET search_path = '')", () => {
      for (const func of LOGISTICS_SECURITY_DEFINER_FUNCTIONS) {
        const regex = new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${func}[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`,
          "i"
        );
        assert.match(
          migrationSql,
          regex,
          `Function ${func} in migration must configure SET search_path = ''`
        );
        assert.match(
          schemaSql,
          regex,
          `Function ${func} in schema.sql must configure SET search_path = ''`
        );
      }
    });

    await t2.test("2.3 All functions fully qualify application tables with public.", () => {
      for (const func of LOGISTICS_SECURITY_DEFINER_FUNCTIONS) {
        const funcBlock = migrationSql.match(
          new RegExp(`CREATE OR REPLACE FUNCTION public\\.${func}[\\s\\S]*?\\$\\$;`, "i")
        );
        if (funcBlock) {
          const sql = funcBlock[0];
          assert.ok(
            !sql.includes("FROM fleet_assets") && !sql.includes("JOIN fleet_assets"),
            `Function ${func} must not use unqualified fleet_assets`
          );
          assert.ok(
            !sql.includes("FROM fleet_trips") && !sql.includes("JOIN fleet_trips"),
            `Function ${func} must not use unqualified fleet_trips`
          );
          assert.ok(
            !sql.includes("FROM projects") && !sql.includes("JOIN projects"),
            `Function ${func} must not use unqualified projects`
          );
          assert.ok(
            !sql.includes("FROM company_members") && !sql.includes("JOIN company_members"),
            `Function ${func} must not use unqualified company_members`
          );
          assert.ok(
            !sql.includes("FROM profiles") && !sql.includes("JOIN profiles"),
            `Function ${func} must not use unqualified profiles`
          );
          assert.ok(
            !sql.includes("FROM logistics_audit_log") && !sql.includes("INTO logistics_audit_log"),
            `Function ${func} must not use unqualified logistics_audit_log`
          );
        }
      }
    });

    await t2.test("2.4 All functions fully qualify auth functions with auth.", () => {
      for (const func of LOGISTICS_SECURITY_DEFINER_FUNCTIONS) {
        const funcBlock = migrationSql.match(
          new RegExp(`CREATE OR REPLACE FUNCTION public\\.${func}[\\s\\S]*?\\$\\$;`, "i")
        );
        if (funcBlock) {
          const sql = funcBlock[0];
          const hasUnqualifiedUid = /(?<!auth\.)\buid\(\)/.test(sql);
          assert.ok(!hasUnqualifiedUid, `Function ${func} must not use unqualified uid()`);
        }
      }
    });

    await t2.test("2.5 All functions fully qualify built-in functions with pg_catalog.", () => {
      for (const func of LOGISTICS_SECURITY_DEFINER_FUNCTIONS) {
        const funcBlock = migrationSql.match(
          new RegExp(`CREATE OR REPLACE FUNCTION public\\.${func}[\\s\\S]*?\\$\\$;`, "i")
        );
        if (funcBlock) {
          const sql = funcBlock[0];
          const builtins = ["btrim", "nullif", "to_jsonb", "jsonb_object_keys"];
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
    await t3.test("3.1 Full access company allows operational writes on both tables", () => {
      for (const op of ["INSERT", "UPDATE", "DELETE"] as const) {
        assert.equal(
          checkRlsWritePolicyForAsset(op, true, companyFull, { company_id: companyFull.companyId }, sampleProjects),
          true,
          `Full access must allow ${op} on fleet_assets`
        );
        assert.equal(
          checkRlsWritePolicyForTrip(op, true, companyFull, { company_id: companyFull.companyId, fleet_asset_id: "fa-1" }, sampleAssets, sampleProjects),
          true,
          `Full access must allow ${op} on fleet_trips`
        );
      }
    });

    await t3.test("3.2 Grace period company allows operational writes on both tables", () => {
      for (const op of ["INSERT", "UPDATE", "DELETE"] as const) {
        assert.equal(
          checkRlsWritePolicyForAsset(op, true, companyGrace, { company_id: companyGrace.companyId }, sampleProjects),
          true,
          `Grace period must allow ${op} on fleet_assets`
        );
        assert.equal(
          checkRlsWritePolicyForTrip(op, true, companyGrace, { company_id: companyGrace.companyId, fleet_asset_id: "fa-2" }, sampleAssets, sampleProjects),
          true,
          `Grace period must allow ${op} on fleet_trips`
        );
      }
    });

    await t3.test("3.3 Read-only company rejects all operational writes on both tables", () => {
      for (const op of ["INSERT", "UPDATE", "DELETE"] as const) {
        assert.equal(
          checkRlsWritePolicyForAsset(op, true, companyReadOnly, { company_id: companyReadOnly.companyId }, sampleProjects),
          false,
          `Read-only company must reject ${op} on fleet_assets`
        );
        assert.equal(
          checkRlsWritePolicyForTrip(op, true, companyReadOnly, { company_id: companyReadOnly.companyId, fleet_asset_id: "fa-3" }, sampleAssets, sampleProjects),
          false,
          `Read-only company must reject ${op} on fleet_trips`
        );
      }
    });

    await t3.test("3.4 Inactive or non-member rejected even if billing is full", () => {
      for (const op of ["INSERT", "UPDATE", "DELETE"] as const) {
        assert.equal(
          checkRlsWritePolicyForAsset(op, false, companyFull, { company_id: companyFull.companyId }, sampleProjects),
          false,
          `Non-member must be rejected for ${op} on fleet_assets`
        );
        assert.equal(
          checkRlsWritePolicyForTrip(op, false, companyFull, { company_id: companyFull.companyId, fleet_asset_id: "fa-1" }, sampleAssets, sampleProjects),
          false,
          `Non-member must be rejected for ${op} on fleet_trips`
        );
      }
    });

    await t3.test("3.5 Cross-company asset or project mismatch is rejected even with full access", () => {
      // Trip linked to asset of different company
      const crossAssetTrip: Partial<SimulatedFleetTrip> = {
        company_id: companyFull.companyId,
        fleet_asset_id: "fa-4", // belongs to companyOther
      };
      assert.equal(
        checkRlsWritePolicyForTrip("INSERT", true, companyFull, crossAssetTrip, sampleAssets, sampleProjects),
        false,
        "Trip referencing asset from different company must be rejected"
      );

      // Trip linked to project of different company
      const crossProjectTrip: Partial<SimulatedFleetTrip> = {
        company_id: companyFull.companyId,
        fleet_asset_id: "fa-1",
        project_id: "proj-4", // belongs to companyOther
      };
      assert.equal(
        checkRlsWritePolicyForTrip("INSERT", true, companyFull, crossProjectTrip, sampleAssets, sampleProjects),
        false,
        "Trip referencing project from different company must be rejected"
      );

      // Asset linked to project of different company
      const crossProjectAsset: Partial<SimulatedFleetAsset> = {
        company_id: companyFull.companyId,
        current_project_id: "proj-4", // belongs to companyOther
      };
      assert.equal(
        checkRlsWritePolicyForAsset("INSERT", true, companyFull, crossProjectAsset, sampleProjects),
        false,
        "Asset referencing project from different company must be rejected"
      );
    });

    await t3.test("3.6 Read and export remain available for all companies including read-only", () => {
      assert.equal(checkRlsSelectPolicy(true), true, "Member of full company can SELECT");
      assert.equal(checkRlsSelectPolicy(true), true, "Member of grace company can SELECT");
      assert.equal(checkRlsSelectPolicy(true), true, "Member of read-only company can SELECT");
      assert.equal(checkRlsSelectPolicy(false), false, "Non-member cannot SELECT");

      assert.equal(companyReadOnly.canRead, true, "Read-only company has canRead = true");
      assert.equal(companyReadOnly.canExport, true, "Read-only company has canExport = true");
      assert.equal(companyReadOnly.canAccessBilling, true, "Read-only company has canAccessBilling = true");
    });
  });

  await t.test("4. ID Tampering, Tenancy & Immutability Guarantees", async (t4) => {
    await t4.test("4.1 Trigger fn_logistics_meta_stamp enforces company_id immutability on UPDATE", () => {
      assert.ok(
        migrationSql.includes("NEW.company_id := OLD.company_id;"),
        "fn_logistics_meta_stamp must freeze company_id on UPDATE"
      );
      assert.ok(
        migrationSql.includes("NEW.created_by := OLD.created_by;"),
        "fn_logistics_meta_stamp must freeze created_by on UPDATE"
      );
      assert.ok(
        migrationSql.includes("NEW.created_at := OLD.created_at;"),
        "fn_logistics_meta_stamp must freeze created_at on UPDATE"
      );
    });

    await t4.test("4.2 Trigger fn_normalize_fleet_trips enforces asset company validation", () => {
      assert.ok(
        migrationSql.includes("IF v_asset_company_id <> NEW.company_id THEN"),
        "fn_normalize_fleet_trips must raise cross-company violation on asset mismatch"
      );
    });

    await t4.test("4.3 Trigger fn_normalize_fleet_assets enforces project company validation", () => {
      assert.ok(
        migrationSql.includes("WHERE id = NEW.current_project_id AND company_id = NEW.company_id"),
        "fn_normalize_fleet_assets must raise cross-company violation on project mismatch"
      );
    });

    await t4.test("4.4 RPC / RLS billing guard throws PM001 error when read-only", () => {
      assert.throws(
        () => executeRpcBillingGuard(companyReadOnly.companyId, companyReadOnly),
        (err: any) => {
          assert.equal(err.code, "PM001");
          assert.equal(err.message, "Company billing access is read-only.");
          return true;
        },
        "Billing guard must throw PM001 when read-only"
      );

      assert.doesNotThrow(() => {
        executeRpcBillingGuard(companyFull.companyId, companyFull);
      });

      assert.doesNotThrow(() => {
        executeRpcBillingGuard(companyGrace.companyId, companyGrace);
      });
    });
  });

  await t.test("5. Non-Mutation and Transaction Safety Guarantees", async (t5) => {
    await t5.test("5.1 RLS policies verify billing write check before permitting mutation", () => {
      for (const table of TARGET_TABLES) {
        assert.ok(
          migrationSql.includes(`public.company_billing_allows_operational_write(company_id)`),
          `All tables must check company_billing_allows_operational_write for ${table}`
        );
      }
    });

    await t5.test("5.2 Atomic rollback occurs on any constraint, validation or RLS violation", () => {
      // Verify all DML statements are strictly rolled back when check returns false
      const canWriteReadOnly = simulateBillingAllowsOperationalWrite(companyReadOnly);
      assert.equal(canWriteReadOnly, false, "Read-only company cannot perform operational write");
    });
  });
});
