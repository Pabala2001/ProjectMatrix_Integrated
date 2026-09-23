import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Step 3C.4F-1M: Server-Side Billing Write Enforcement on Operational Storage Test Suite
 *
 * Validates:
 * 1. Migration SQL and Schema definition for 8 protected storage buckets and public.accounts_attachments:
 *    - accounts-documents
 *    - labour-payroll-files
 *    - technical-reports
 *    - quality-control-assets
 *    - quality-control-documents
 *    - communication-documents
 *    - site-diary-attachments
 *    - cashbook-attachments
 *    - public.accounts_attachments
 * 2. Write RLS Policies (INSERT, UPDATE, DELETE) require public.company_billing_allows_operational_write(...)
 * 3. Authoritative company resolution from canonical object path and parent database records
 * 4. SELECT RLS Policies remain intact without write block (allowing read and export in read-only billing mode)
 * 5. All helper functions use SET search_path = '' and fully qualified identifiers:
 *    - public.parse_storage_path_uuid()
 *    - public.accounts_company_id_from_storage_path()
 *    - public.technical_reports_storage_resolve_company_id()
 *    - public.qc_assets_storage_resolve_company_id()
 *    - public.qc_documents_storage_resolve_company_id()
 *    - public.storage_resolve_operational_company_id()
 * 6. Simulation of entitlement matrix across full, grace_period, and read_only states
 * 7. Path spoofing, cross-tenant substitution, malformed UUIDs, and mismatch rejection
 */

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260829000002_enforce_billing_storage.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const schemaSql = readFileSync(schemaPath, "utf-8");

const PROTECTED_BUCKETS = [
  "accounts-documents",
  "labour-payroll-files",
  "technical-reports",
  "quality-control-assets",
  "quality-control-documents",
  "communication-documents",
  "site-diary-attachments",
  "cashbook-attachments",
] as const;

const STORAGE_HELPER_FUNCTIONS = [
  "parse_storage_path_uuid",
  "accounts_company_id_from_storage_path",
  "technical_reports_storage_resolve_company_id",
  "qc_assets_storage_resolve_company_id",
  "qc_documents_storage_resolve_company_id",
  "storage_resolve_operational_company_id",
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
  is_active: boolean;
}

interface SimulatedProject {
  id: string;
  company_id: string;
  name: string;
}

interface SimulatedQcRecord {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
}

interface SimulatedStorageObject {
  id: string;
  bucket_id: string;
  name: string;
  owner?: string;
  created_at: string;
  updated_at: string;
}

interface SimulatedAccountsAttachment {
  id: string;
  company_id: string;
  project_id?: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
}

class SimulatedStorageBillingEnvironment {
  private companies: Map<string, { id: string; name: string }> = new Map();
  private entitlements: Map<string, CompanyEntitlement> = new Map();
  private companyMembers: Map<string, SimulatedCompanyMember> = new Map();
  private projects: Map<string, SimulatedProject> = new Map();
  private qcRecords: Map<string, SimulatedQcRecord> = new Map();
  private storageObjects: Map<string, SimulatedStorageObject> = new Map();
  private accountsAttachments: Map<string, SimulatedAccountsAttachment> = new Map();

  createCompany(companyId: string, name: string, accessMode: AccessMode = "full") {
    this.companies.set(companyId, { id: companyId, name });
    this.entitlements.set(companyId, {
      companyId,
      accessMode,
      canRead: true,
      canWrite: accessMode !== "read_only",
      canAccessBilling: true,
      canExport: true,
    });
  }

  setEntitlementMode(companyId: string, accessMode: AccessMode) {
    const ent = this.entitlements.get(companyId);
    if (ent) {
      ent.accessMode = accessMode;
      ent.canWrite = accessMode !== "read_only";
    }
  }

  addMember(member: SimulatedCompanyMember) {
    this.companyMembers.set(member.id, member);
  }

  addProject(project: SimulatedProject) {
    this.projects.set(project.id, project);
  }

  addQcRecord(record: SimulatedQcRecord) {
    this.qcRecords.set(record.id, record);
  }

  // Pure functions matching SQL implementation logic
  parseStoragePathUuid(val: string | undefined): string | null {
    if (!val) return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(val) ? val.toLowerCase() : null;
  }

  resolveCompanyIdFromStoragePath(bucketId: string, name: string): string | null {
    if (!bucketId || !name) return null;
    const segments = name.split("/");

    switch (bucketId) {
      case "accounts-documents":
      case "labour-payroll-files":
      case "communication-documents":
      case "site-diary-attachments":
      case "cashbook-attachments": {
        const seg1Uuid = this.parseStoragePathUuid(segments[0]);
        return seg1Uuid && this.companies.has(seg1Uuid) ? seg1Uuid : null;
      }
      case "technical-reports": {
        if (segments[0] === "company-logos") {
          const seg2Uuid = this.parseStoragePathUuid(segments[1]);
          return seg2Uuid && this.companies.has(seg2Uuid) ? seg2Uuid : null;
        }
        const seg1Uuid = this.parseStoragePathUuid(segments[0]);
        return seg1Uuid && this.companies.has(seg1Uuid) ? seg1Uuid : null;
      }
      case "quality-control-assets": {
        if (segments[0] === "company-logos") {
          const seg2Uuid = this.parseStoragePathUuid(segments[1]);
          return seg2Uuid && this.companies.has(seg2Uuid) ? seg2Uuid : null;
        }
        if (segments[0] === "signatures") {
          const recId = this.parseStoragePathUuid(segments[2]);
          if (recId) {
            const qc = this.qcRecords.get(recId);
            return qc ? qc.company_id : null;
          }
          return null;
        }
        const seg1Uuid = this.parseStoragePathUuid(segments[0]);
        return seg1Uuid && this.companies.has(seg1Uuid) ? seg1Uuid : null;
      }
      case "quality-control-documents": {
        const seg1Uuid = this.parseStoragePathUuid(segments[0]);
        if (seg1Uuid && this.companies.has(seg1Uuid)) return seg1Uuid;
        if (seg1Uuid && this.projects.has(seg1Uuid)) {
          const proj = this.projects.get(seg1Uuid)!;
          const recId = this.parseStoragePathUuid(segments[1]);
          if (recId) {
            const qc = this.qcRecords.get(recId);
            if (qc && qc.project_id === seg1Uuid && qc.company_id === proj.company_id) {
              return proj.company_id;
            }
            return null;
          }
          return proj.company_id;
        }
        return null;
      }
      default:
        return null;
    }
  }

  isMember(userId: string, companyId: string): boolean {
    for (const member of this.companyMembers.values()) {
      if (member.profile_id === userId && member.company_id === companyId && member.is_active) {
        return true;
      }
    }
    return false;
  }

  allowsOperationalWrite(companyId: string): boolean {
    const ent = this.entitlements.get(companyId);
    return ent ? ent.canWrite : false;
  }

  // Storage Objects Operations
  insertStorageObject(userId: string, bucketId: string, name: string): { success: boolean; error?: string } {
    const companyId = this.resolveCompanyIdFromStoragePath(bucketId, name);
    if (!companyId) {
      return { success: false, error: "Invalid path or unresolvable company" };
    }

    if (!this.isMember(userId, companyId)) {
      return { success: false, error: "User is not active company member" };
    }

    // Check project agreement
    const segments = name.split("/");
    if (bucketId === "quality-control-documents") {
      // Format: <project_id>/<qc_record_id>/<file> or <company_id>/<project_id>/...
      const seg1Uuid = this.parseStoragePathUuid(segments[0]);
      if (seg1Uuid && this.projects.has(seg1Uuid)) {
        const proj = this.projects.get(seg1Uuid);
        if (!proj || proj.company_id !== companyId) {
          return { success: false, error: "Project does not belong to company" };
        }
      } else if (segments.length > 1) {
        const projId = this.parseStoragePathUuid(segments[1]);
        if (projId) {
          const proj = this.projects.get(projId);
          if (!proj || proj.company_id !== companyId) {
            return { success: false, error: "Project does not belong to company" };
          }
        }
      }
    } else if (segments.length > 1 && segments[0] !== "company-logos" && segments[0] !== "signatures") {
      const projId = this.parseStoragePathUuid(segments[1]);
      if (projId) {
        const proj = this.projects.get(projId);
        if (!proj || proj.company_id !== companyId) {
          return { success: false, error: "Project does not belong to company" };
        }
      }
    }

    if (!this.allowsOperationalWrite(companyId)) {
      return { success: false, error: "Billing write access disallowed: read_only subscription" };
    }

    const objId = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.storageObjects.set(objId, {
      id: objId,
      bucket_id: bucketId,
      name,
      owner: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return { success: true };
  }

  updateStorageObject(userId: string, objId: string, newName: string): { success: boolean; error?: string } {
    const existing = this.storageObjects.get(objId);
    if (!existing) return { success: false, error: "Object not found" };

    const oldCompanyId = this.resolveCompanyIdFromStoragePath(existing.bucket_id, existing.name);
    const newCompanyId = this.resolveCompanyIdFromStoragePath(existing.bucket_id, newName);

    if (!oldCompanyId || !newCompanyId) {
      return { success: false, error: "Invalid path or company resolution failure" };
    }

    if (!this.isMember(userId, oldCompanyId) || !this.isMember(userId, newCompanyId)) {
      return { success: false, error: "User is not active member" };
    }

    if (!this.allowsOperationalWrite(oldCompanyId) || !this.allowsOperationalWrite(newCompanyId)) {
      return { success: false, error: "Billing write access disallowed: read_only subscription" };
    }

    existing.name = newName;
    existing.updated_at = new Date().toISOString();
    return { success: true };
  }

  deleteStorageObject(userId: string, objId: string): { success: boolean; error?: string } {
    const existing = this.storageObjects.get(objId);
    if (!existing) return { success: false, error: "Object not found" };

    const companyId = this.resolveCompanyIdFromStoragePath(existing.bucket_id, existing.name);
    if (!companyId) return { success: false, error: "Cannot resolve company" };

    if (!this.isMember(userId, companyId)) {
      return { success: false, error: "User is not active member" };
    }

    if (!this.allowsOperationalWrite(companyId)) {
      return { success: false, error: "Billing write access disallowed: read_only subscription" };
    }

    this.storageObjects.delete(objId);
    return { success: true };
  }

  selectStorageObject(userId: string, objId: string): { success: boolean; object?: SimulatedStorageObject } {
    const existing = this.storageObjects.get(objId);
    if (!existing) return { success: false };

    const companyId = this.resolveCompanyIdFromStoragePath(existing.bucket_id, existing.name);
    if (!companyId || !this.isMember(userId, companyId)) {
      return { success: false };
    }

    // SELECT is allowed in read_only mode!
    return { success: true, object: existing };
  }

  // accounts_attachments table operations
  insertAccountsAttachment(userId: string, att: SimulatedAccountsAttachment): { success: boolean; error?: string } {
    if (!this.isMember(userId, att.company_id)) {
      return { success: false, error: "User is not active member" };
    }

    if (att.storage_path) {
      const pathCompanyId = this.parseStoragePathUuid(att.storage_path.split("/")[0]);
      if (pathCompanyId !== att.company_id) {
        return { success: false, error: "Storage path company mismatch" };
      }
    }

    if (att.project_id) {
      const proj = this.projects.get(att.project_id);
      if (!proj || proj.company_id !== att.company_id) {
        return { success: false, error: "Project company mismatch" };
      }
    }

    if (!this.allowsOperationalWrite(att.company_id)) {
      return { success: false, error: "Billing write access disallowed: read_only subscription" };
    }

    this.accountsAttachments.set(att.id, att);
    return { success: true };
  }

  deleteAccountsAttachment(userId: string, attId: string): { success: boolean; error?: string } {
    const existing = this.accountsAttachments.get(attId);
    if (!existing) return { success: false, error: "Attachment not found" };

    if (!this.isMember(userId, existing.company_id)) {
      return { success: false, error: "User is not active member" };
    }

    if (!this.allowsOperationalWrite(existing.company_id)) {
      return { success: false, error: "Billing write access disallowed: read_only subscription" };
    }

    this.accountsAttachments.delete(attId);
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

test("Step 3C.4F-1M: Migration and Schema Validation", async (t) => {
  await t.test("Migration file 20260829000002_enforce_billing_storage.sql exists and is valid", () => {
    assert.ok(migrationSql.length > 500, "Migration SQL should not be empty");
    assert.match(migrationSql, /BEGIN;/, "Migration should open transaction");
    assert.match(migrationSql, /COMMIT;/, "Migration should commit transaction");
  });

  await t.test("All 8 protected storage buckets are registered in migration and schema", () => {
    for (const bucket of PROTECTED_BUCKETS) {
      const regex = new RegExp(`\\('${bucket}',\\s*'${bucket}',\\s*false\\)`, "i");
      assert.match(migrationSql, regex, `Migration should register bucket '${bucket}'`);
      assert.match(schemaSql, regex, `Schema should register bucket '${bucket}'`);
    }
  });

  await t.test("All storage helper functions are created with SET search_path = '' and fully qualified calls", () => {
    for (const func of STORAGE_HELPER_FUNCTIONS) {
      const funcRegex = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${func}`, "i");
      assert.match(migrationSql, funcRegex, `Migration should declare function public.${func}`);
      assert.match(schemaSql, funcRegex, `Schema should declare function public.${func}`);
    }

    const searchPathMatches = migrationSql.match(/SET search_path = ''/gi) || [];
    assert.ok(searchPathMatches.length >= STORAGE_HELPER_FUNCTIONS.length, "All storage helper functions must enforce empty search path");
  });

  await t.test("All protected storage buckets have write policies enforcing public.company_billing_allows_operational_write", () => {
    for (const bucket of PROTECTED_BUCKETS) {
      const bucketEscaped = bucket.replace(/-/g, "[-_]");
      const insertRegex = new RegExp(`CREATE POLICY [^\\n]+ ON storage\\.objects\\s+FOR INSERT[\\s\\S]*?bucket_id = '${bucket}'[\\s\\S]*?public\\.company_billing_allows_operational_write`, "i");
      const updateRegex = new RegExp(`CREATE POLICY [^\\n]+ ON storage\\.objects\\s+FOR UPDATE[\\s\\S]*?bucket_id = '${bucket}'[\\s\\S]*?public\\.company_billing_allows_operational_write`, "i");
      const deleteRegex = new RegExp(`CREATE POLICY [^\\n]+ ON storage\\.objects\\s+FOR DELETE[\\s\\S]*?bucket_id = '${bucket}'[\\s\\S]*?public\\.company_billing_allows_operational_write`, "i");

      assert.match(migrationSql, insertRegex, `Bucket '${bucket}' must enforce billing write check on INSERT`);
      assert.match(migrationSql, updateRegex, `Bucket '${bucket}' must enforce billing write check on UPDATE`);
      assert.match(migrationSql, deleteRegex, `Bucket '${bucket}' must enforce billing write check on DELETE`);
    }
  });

  await t.test("public.accounts_attachments write policies enforce public.company_billing_allows_operational_write", () => {
    const insertRegex = /CREATE POLICY accounts_attachments_insert ON public\.accounts_attachments\s+FOR INSERT[\s\S]*?public\.company_billing_allows_operational_write\(company_id\)/i;
    const updateRegex = /CREATE POLICY accounts_attachments_update ON public\.accounts_attachments\s+FOR UPDATE[\s\S]*?public\.company_billing_allows_operational_write\(company_id\)/i;
    const deleteRegex = /CREATE POLICY accounts_attachments_delete ON public\.accounts_attachments\s+FOR DELETE[\s\S]*?public\.company_billing_allows_operational_write\(company_id\)/i;

    assert.match(migrationSql, insertRegex, "accounts_attachments INSERT policy must require billing write");
    assert.match(migrationSql, updateRegex, "accounts_attachments UPDATE policy must require billing write");
    assert.match(migrationSql, deleteRegex, "accounts_attachments DELETE policy must require billing write");
  });

  await t.test("SELECT policies on storage.objects and public.accounts_attachments do NOT contain write billing check", () => {
    const selectPolicies = migrationSql.match(/CREATE POLICY [^\n]+ ON (?:storage\.objects|public\.accounts_attachments)\s+FOR SELECT[\s\S]*?;/gi) || [];
    assert.ok(selectPolicies.length >= 9, "Should find SELECT policies for all 8 buckets + accounts_attachments");

    for (const policy of selectPolicies) {
      assert.doesNotMatch(policy, /company_billing_allows_operational_write/i, "SELECT policies must allow read access even when operational write is blocked");
    }
  });
});

test("Step 3C.4F-1M: Functional Entitlement & Security Simulation", async (t) => {
  const env = new SimulatedStorageBillingEnvironment();

  const compA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const compB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const projA = "33333333-3333-3333-3333-333333333333";
  const projB = "44444444-4444-4444-4444-444444444444";
  const qcRecA = "55555555-5555-5555-5555-555555555555";

  env.createCompany(compA, "Alpha Corp", "full");
  env.createCompany(compB, "Beta LLC", "full");

  env.addMember({ id: "m1", company_id: compA, profile_id: userA, role: "admin", is_active: true });
  env.addMember({ id: "m2", company_id: compB, profile_id: userB, role: "admin", is_active: true });

  env.addProject({ id: projA, company_id: compA, name: "Alpha Tower" });
  env.addProject({ id: projB, company_id: compB, name: "Beta Complex" });

  env.addQcRecord({ id: qcRecA, company_id: compA, project_id: projA, title: "QC Record 1" });

  await t.test("Full subscription permits uploads to all 8 operational buckets", () => {
    for (const bucket of PROTECTED_BUCKETS) {
      let path = `${compA}/${projA}/test_file.pdf`;
      if (bucket === "quality-control-assets") {
        path = `company-logos/${compA}/logo.png`;
      } else if (bucket === "quality-control-documents") {
        path = `${projA}/${qcRecA}/inspection.docx`;
      }

      const res = env.insertStorageObject(userA, bucket, path);
      assert.equal(res.success, true, `Upload to ${bucket} should succeed under active billing`);
    }
  });

  await t.test("Grace period subscription permits uploads and mutations", () => {
    env.setEntitlementMode(compA, "grace_period");

    const res = env.insertStorageObject(userA, "site-diary-attachments", `${compA}/${projA}/diary1/photo.jpg`);
    assert.equal(res.success, true, "Upload during grace period should succeed");
  });

  await t.test("Read-only subscription blocks uploads across all 8 operational buckets", () => {
    env.setEntitlementMode(compA, "read_only");

    for (const bucket of PROTECTED_BUCKETS) {
      let path = `${compA}/${projA}/test_file_blocked.pdf`;
      if (bucket === "quality-control-assets") {
        path = `company-logos/${compA}/logo.png`;
      } else if (bucket === "quality-control-documents") {
        path = `${projA}/${qcRecA}/inspection_blocked.docx`;
      }

      const res = env.insertStorageObject(userA, bucket, path);
      assert.equal(res.success, false, `Upload to ${bucket} should be blocked in read_only mode`);
      assert.match(res.error || "", /read_only subscription/i);
    }
  });

  await t.test("Read-only subscription permits SELECT / download of existing objects", () => {
    // Re-enable temporarily to seed object
    env.setEntitlementMode(compA, "full");
    const insertRes = env.insertStorageObject(userA, "communication-documents", `${compA}/${projA}/rfis/doc1/spec.pdf`);
    assert.equal(insertRes.success, true);

    // Switch to read-only
    env.setEntitlementMode(compA, "read_only");

    // Upload blocked
    const uploadRes = env.insertStorageObject(userA, "communication-documents", `${compA}/${projA}/rfis/doc2/spec2.pdf`);
    assert.equal(uploadRes.success, false);

    // Read allowed
    // Find inserted object ID
    // We test that select succeeds
    const firstObjId = Array.from((env as any).storageObjects.keys())[0] as string;
    const selectRes = env.selectStorageObject(userA, firstObjId);
    assert.equal(selectRes.success, true, "Download / SELECT must succeed in read_only mode");
  });

  await t.test("Cross-tenant and project substitution attempts are rejected", () => {
    env.setEntitlementMode(compA, "full");
    env.setEntitlementMode(compB, "full");

    // User A attempting to upload to Company B path
    const crossCompany = env.insertStorageObject(userA, "labour-payroll-files", `${compB}/${projB}/p1/payroll.pdf`);
    assert.equal(crossCompany.success, false, "Cross-company upload should fail");

    // User A attempting to upload with Company A but Project B (which belongs to Company B)
    const crossProject = env.insertStorageObject(userA, "labour-payroll-files", `${compA}/${projB}/p1/payroll.pdf`);
    assert.equal(crossProject.success, false, "Cross-project parent mismatch should fail");

    // Malformed UUID in path
    const malformedPath = env.insertStorageObject(userA, "cashbook-attachments", `invalid-uuid/bank_statement/123/stmt.csv`);
    assert.equal(malformedPath.success, false, "Malformed UUID in path should fail");
  });

  await t.test("accounts_attachments table write operations are guarded by billing entitlement", () => {
    env.setEntitlementMode(compA, "full");

    // INSERT with active billing
    const attId = "att-1";
    const insertOk = env.insertAccountsAttachment(userA, {
      id: attId,
      company_id: compA,
      project_id: projA,
      storage_path: `${compA}/${projA}/invoices/inv1.pdf`,
      file_name: "inv1.pdf",
      file_size: 1024,
      mime_type: "application/pdf",
      uploaded_by: userA,
    });
    assert.equal(insertOk.success, true, "Attachment insert should succeed with active billing");

    // Switch to read-only
    env.setEntitlementMode(compA, "read_only");

    // INSERT blocked
    const insertBlocked = env.insertAccountsAttachment(userA, {
      id: "att-2",
      company_id: compA,
      project_id: projA,
      storage_path: `${compA}/${projA}/invoices/inv2.pdf`,
      file_name: "inv2.pdf",
      file_size: 1024,
      mime_type: "application/pdf",
      uploaded_by: userA,
    });
    assert.equal(insertBlocked.success, false, "Attachment insert must be blocked under read_only");

    // DELETE blocked
    const deleteBlocked = env.deleteAccountsAttachment(userA, attId);
    assert.equal(deleteBlocked.success, false, "Attachment delete must be blocked under read_only");

    // Re-enable full
    env.setEntitlementMode(compA, "full");
    const deleteOk = env.deleteAccountsAttachment(userA, attId);
    assert.equal(deleteOk.success, true, "Attachment delete should succeed once billing is restored");
  });
});
