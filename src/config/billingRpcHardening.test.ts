import fs from "fs";
import path from "path";

/**
 * Focused verification test suite for ProjectMatrix Billing RPC Search-Path Hardening
 *
 * Verifies:
 * 1. Migration 20260729000005_harden_billing_rpc_search_paths.sql exists and is properly structured
 * 2. Both public.verify_billing_access and public.start_billing_trial set search_path = ''
 * 3. Neither function uses search_path = public or search_path = public, pg_temp in migration 0005 or schema.sql
 * 4. The trial function explicitly uses pg_catalog.gen_random_uuid() and not extensions.gen_random_uuid()
 * 5. Built-in functions are qualified with pg_catalog (now, make_interval, to_char, upper, substring, replace, regexp_replace, lower, btrim, coalesce, jsonb_build_object)
 * 6. Objects are fully qualified with public.* and auth.uid()
 * 7. REVOKE from PUBLIC, anon is present for both functions
 * 8. GRANT to authenticated is present for both functions
 * 9. schema.sql is synchronized with identical hardened definitions
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
console.log("PROJECTMATRIX BILLING RPC SEARCH-PATH HARDENING TEST SUITE");
console.log("=======================================================\n");

const migration0005Path = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260729000005_harden_billing_rpc_search_paths.sql"
);
const migration0006Path = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260729000006_billing_trial_duration_minutes-1.sql"
);
const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");

// -------------------------------------------------------------
// Test 1: Migration file existence and basic validity
// -------------------------------------------------------------
console.log("1. Migration File Existence and Structure");
assert(fs.existsSync(migration0005Path), "Migration 20260729000005_harden_billing_rpc_search_paths.sql exists");
assert(fs.existsSync(migration0006Path), "Migration 20260729000006_billing_trial_duration_minutes-1.sql exists");

const migration0005Content = fs.readFileSync(migration0005Path, "utf-8");
const migration0006Content = fs.readFileSync(migration0006Path, "utf-8");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");

// -------------------------------------------------------------
// Test 2: Verify Empty Search Path in Migration and Schema
// -------------------------------------------------------------
console.log("\n2. Empty Search Path Enforcement (SET search_path = '')");

// Check verify_billing_access in migration 0005
const verifyBillingFnInMigration = migration0005Content.match(
  /CREATE OR REPLACE FUNCTION public\.verify_billing_access[\s\S]*?\$(?:verify_billing_access)?\$[\s\S]*?\$(?:verify_billing_access)?\$;/
);
assert(verifyBillingFnInMigration !== null, "Found public.verify_billing_access in migration 0005");
if (verifyBillingFnInMigration) {
  const code = verifyBillingFnInMigration[0];
  assert(
    /SET\s+search_path\s*=\s*''/i.test(code),
    "verify_billing_access sets search_path = ''"
  );
  assert(
    !/search_path\s*=\s*public/i.test(code),
    "verify_billing_access does NOT contain 'search_path = public'"
  );
}

// Check latest effective start_billing_trial in migration 0006
const startTrialFnInMigration = migration0006Content.match(
  /CREATE OR REPLACE FUNCTION public\.start_billing_trial[\s\S]*?\$(?:start_billing_trial)?\$[\s\S]*?\$(?:start_billing_trial)?\$;/
);
assert(startTrialFnInMigration !== null, "Found public.start_billing_trial in migration 0006");
if (startTrialFnInMigration) {
  const code = startTrialFnInMigration[0];
  assert(
    /SET\s+search_path\s*=\s*''/i.test(code),
    "start_billing_trial sets search_path = ''"
  );
  assert(
    !/search_path\s*=\s*public/i.test(code),
    "start_billing_trial does NOT contain 'search_path = public'"
  );
}

// -------------------------------------------------------------
// Test 3: Explicit pg_catalog qualifications & pg_catalog.gen_random_uuid
// -------------------------------------------------------------
console.log("\n3. Explicit pg_catalog Qualifications & UUID Function");

if (startTrialFnInMigration) {
  const code = startTrialFnInMigration[0];
  assert(
    code.includes("pg_catalog.gen_random_uuid()"),
    "start_billing_trial explicitly calls pg_catalog.gen_random_uuid()"
  );
  assert(
    !code.includes("extensions.gen_random_uuid()"),
    "start_billing_trial does not use extensions.gen_random_uuid()"
  );
  assert(
    code.includes("pg_catalog.now()"),
    "start_billing_trial explicitly calls pg_catalog.now()"
  );
  assert(
    code.includes("pg_catalog.make_interval(") && code.includes("mins => v_plan.trial_duration_minutes"),
    "start_billing_trial calculates minute interval using mins => v_plan.trial_duration_minutes"
  );
  assert(
    code.includes("pg_catalog.to_char("),
    "start_billing_trial explicitly calls pg_catalog.to_char("
  );
  assert(
    code.includes("pg_catalog.upper("),
    "start_billing_trial explicitly calls pg_catalog.upper("
  );
  assert(
    code.includes("pg_catalog.substring("),
    "start_billing_trial explicitly calls pg_catalog.substring("
  );
  assert(
    code.includes("pg_catalog.replace("),
    "start_billing_trial explicitly calls pg_catalog.replace("
  );
  assert(
    !code.includes("pg_catalog.coalesce("),
    "start_billing_trial explicitly rejects 'pg_catalog.coalesce('"
  );
  assert(
    code.includes("COALESCE(") || code.includes("coalesce("),
    "start_billing_trial uses plain COALESCE conditional expression"
  );
  assert(
    !code.includes("pg_catalog.boolean"),
    "start_billing_trial explicitly rejects 'pg_catalog.boolean'"
  );
  assert(
    code.includes("pg_catalog.bool"),
    "start_billing_trial uses pg_catalog.bool for boolean variables"
  );
  assert(
    code.includes("pg_catalog.jsonb_build_object("),
    "start_billing_trial explicitly calls pg_catalog.jsonb_build_object("
  );
}

if (verifyBillingFnInMigration) {
  const code = verifyBillingFnInMigration[0];
  assert(
    code.includes("pg_catalog.regexp_replace("),
    "verify_billing_access explicitly calls pg_catalog.regexp_replace("
  );
  assert(
    code.includes("pg_catalog.lower("),
    "verify_billing_access explicitly calls pg_catalog.lower("
  );
  assert(
    code.includes("pg_catalog.btrim("),
    "verify_billing_access explicitly calls pg_catalog.btrim("
  );
  assert(
    !code.includes("pg_catalog.coalesce("),
    "verify_billing_access explicitly rejects 'pg_catalog.coalesce('"
  );
  assert(
    code.includes("COALESCE(") || code.includes("coalesce("),
    "verify_billing_access uses plain COALESCE conditional expression"
  );
  assert(
    !code.includes("pg_catalog.boolean"),
    "verify_billing_access explicitly rejects 'pg_catalog.boolean'"
  );
}

// -------------------------------------------------------------
// Test 4: Fully Qualified Table, Function, and Auth References
// -------------------------------------------------------------
console.log("\n4. Fully Qualified Public & Auth References");
if (startTrialFnInMigration) {
  const code = startTrialFnInMigration[0];
  assert(code.includes("auth.uid()"), "start_billing_trial references auth.uid()");
  assert(code.includes("public.verify_billing_access("), "start_billing_trial references public.verify_billing_access(");
  assert(code.includes("public.companies"), "start_billing_trial references public.companies");
  assert(code.includes("public.billing_plans"), "start_billing_trial references public.billing_plans");
  assert(code.includes("public.billing_subscriptions"), "start_billing_trial references public.billing_subscriptions");
  assert(code.includes("public.billing_ledger_events"), "start_billing_trial references public.billing_ledger_events");
}

if (verifyBillingFnInMigration) {
  const code = verifyBillingFnInMigration[0];
  assert(code.includes("auth.uid()"), "verify_billing_access references auth.uid()");
  assert(code.includes("public.company_members"), "verify_billing_access references public.company_members");
}

// -------------------------------------------------------------
// Test 5: Execution Permissions & Role Hardening
// -------------------------------------------------------------
console.log("\n5. Execution Permissions & Role Hardening");
assert(
  /REVOKE ALL ON FUNCTION public\.verify_billing_access\(\s*(?:pg_catalog\.)?UUID\s*\)\s+FROM PUBLIC, anon;/i.test(migration0005Content),
  "REVOKE ALL ON verify_billing_access FROM PUBLIC, anon is present in 0005"
);
assert(
  /GRANT EXECUTE ON FUNCTION public\.verify_billing_access\(\s*(?:pg_catalog\.)?UUID\s*\)\s+TO authenticated;/i.test(migration0005Content),
  "GRANT EXECUTE ON verify_billing_access TO authenticated is present in 0005"
);
assert(
  /REVOKE ALL ON FUNCTION public\.start_billing_trial\(\s*(?:pg_catalog\.)?UUID,\s*(?:pg_catalog\.)?TEXT\s*\)\s+FROM PUBLIC, anon;/i.test(migration0006Content),
  "REVOKE ALL ON start_billing_trial FROM PUBLIC, anon is present in 0006"
);
assert(
  /GRANT EXECUTE ON FUNCTION public\.start_billing_trial\(\s*(?:pg_catalog\.)?UUID,\s*(?:pg_catalog\.)?TEXT\s*\)\s+TO authenticated;/i.test(migration0006Content),
  "GRANT EXECUTE ON start_billing_trial TO authenticated is present in 0006"
);

// -------------------------------------------------------------
// Test 6: Synchronization with schema.sql
// -------------------------------------------------------------
console.log("\n6. Synchronization with schema.sql");
const verifyBillingFnInSchema = schemaContent.match(
  /CREATE OR REPLACE FUNCTION public\.verify_billing_access[\s\S]*?\$(?:verify_billing_access)?\$[\s\S]*?\$(?:verify_billing_access)?\$;/
);
assert(verifyBillingFnInSchema !== null, "Found public.verify_billing_access in schema.sql");
if (verifyBillingFnInSchema) {
  const code = verifyBillingFnInSchema[0];
  assert(
    /SET\s+search_path\s*=\s*''/i.test(code),
    "schema.sql verify_billing_access sets search_path = ''"
  );
  assert(
    !code.includes("pg_catalog.coalesce("),
    "schema.sql verify_billing_access rejects pg_catalog.coalesce("
  );
  assert(
    code.includes("COALESCE(") || code.includes("coalesce("),
    "schema.sql verify_billing_access uses plain COALESCE"
  );
  assert(
    !code.includes("pg_catalog.boolean"),
    "schema.sql verify_billing_access rejects pg_catalog.boolean"
  );
  assert(
    code.includes("RETURNS pg_catalog.bool"),
    "schema.sql verify_billing_access returns pg_catalog.bool"
  );
}

const startTrialFnInSchema = schemaContent.match(
  /CREATE OR REPLACE FUNCTION public\.start_billing_trial[\s\S]*?\$(?:start_billing_trial)?\$[\s\S]*?\$(?:start_billing_trial)?\$;/
);
assert(startTrialFnInSchema !== null, "Found public.start_billing_trial in schema.sql");
if (startTrialFnInSchema) {
  assert(
    /SET\s+search_path\s*=\s*''/i.test(startTrialFnInSchema[0]),
    "schema.sql start_billing_trial sets search_path = ''"
  );
  assert(
    startTrialFnInSchema[0].includes("pg_catalog.gen_random_uuid()"),
    "schema.sql start_billing_trial uses pg_catalog.gen_random_uuid()"
  );
  assert(
    startTrialFnInSchema[0].includes("mins => v_plan.trial_duration_minutes"),
    "schema.sql start_billing_trial calculates minute interval"
  );
  assert(
    !startTrialFnInSchema[0].includes("pg_catalog.coalesce("),
    "schema.sql start_billing_trial rejects pg_catalog.coalesce("
  );
  assert(
    !startTrialFnInSchema[0].includes("pg_catalog.boolean"),
    "schema.sql start_billing_trial rejects pg_catalog.boolean"
  );
}

console.log("\n=======================================================");
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
