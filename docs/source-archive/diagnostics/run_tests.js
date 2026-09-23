import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

async function run() {
  const db = new PGlite();
  console.log("Initializing PGlite...");

  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT '00000000-0000-0000-0000-000000000001'::uuid;
    $$ LANGUAGE sql;

    CREATE TABLE IF NOT EXISTS public.companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text
    );
    CREATE TABLE IF NOT EXISTS public.company_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id),
      profile_id uuid,
      role text,
      is_company_admin boolean DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text
    );
    CREATE TABLE IF NOT EXISTS public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id),
      name text,
      CONSTRAINT uq_projects_company UNIQUE (id, company_id)
    );
    CREATE TABLE IF NOT EXISTS public.procurement_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  const files = [
    "supabase/migrations/20260715000000_permission_system_refactor.sql",
    "supabase/migrations/20260717000000_logistics_supabase_integration.sql",
    "supabase/migrations/20260720000000_finance_phase_2b1_foundation.sql",
    "supabase/migrations/20260721000000_finance_phase_2c1_client_accounts_foundation.sql",
    "supabase/migrations/20260722000000_finance_phase_2c2_supplier_accounts_foundation.sql"
  ];

  for (const file of files) {
    console.log(`Applying ${file}...`);
    try {
      const sql = fs.readFileSync(file, "utf8");
      await db.exec(sql);
      console.log(`Applied ${file} successfully.`);
    } catch (err) {
      console.error(`Error applying ${file}:`, err.message || err);
      process.exit(1);
    }
  }

  console.log("Prerequisites applied successfully!");
}

run();
