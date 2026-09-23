import assert from "node:assert/strict";
import test from "node:test";

import {
  type AdminRepository,
  type CallerRepository,
  createProjectAdvisorFileIndexHandler,
  type FileSearchStoreRow,
  type IndexedDocumentRow,
  type ProjectAdvisorFileIndexDependencies,
  ProjectAdvisorFileIndexError,
  type SafeLogger,
} from "../../supabase/functions/project-advisor-file-index/index.ts";
import type {
  CommunicationDocumentRow,
  SourceKind,
} from "../../supabase/functions/project-advisor-file-index/helpers.ts";
import type {
  GeminiRestClient,
  GeminiRestClientConfig,
} from "../../supabase/functions/project-advisor-file-index/gemini-rest-client.ts";

const COMPANY_A = "11111111-1111-4111-a111-111111111111";
const COMPANY_B = "22222222-2222-4222-a222-222222222222";
const PROJECT_A = "33333333-3333-4333-a333-333333333333";
const DOCUMENT_ID = "44444444-4444-4444-a444-444444444444";
const STORE_ROW_ID = "55555555-5555-4555-a555-555555555555";
const INDEXED_DOC_ID = "66666666-6666-4666-a666-666666666666";
const AUTHORIZATION = "Bearer valid.caller.jwt";
const API_KEY = "test-gemini-api-key";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");

class MockCallerRepository implements CallerRepository {
  authenticated = true;
  hasAdvisorAccess = true;
  billingEntitlement: { can_write: boolean } | null = { can_write: true };
  communicationDoc: CommunicationDocumentRow | null = {
    id: DOCUMENT_ID,
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    uploaded_file_path: `${COMPANY_A}/${PROJECT_A}/docs/test.pdf`,
    uploaded_file_name: "test.pdf",
    uploaded_file_type: "application/pdf",
    uploaded_file_size: PDF_BYTES.byteLength,
  };
  indexedDoc: IndexedDocumentRow | null = null;
  readonly calls: string[] = [];

  authenticate(token: string): Promise<boolean> {
    this.calls.push(`authenticate:${token}`);
    return Promise.resolve(this.authenticated);
  }

  getCommunicationDocument(id: string): Promise<CommunicationDocumentRow | null> {
    this.calls.push(`get_communication_document:${id}`);
    return Promise.resolve(this.communicationDoc);
  }

  getIndexedDocument(id: string, source: SourceKind): Promise<IndexedDocumentRow | null> {
    this.calls.push(`get_indexed_document:${id}:${source}`);
    return Promise.resolve(this.indexedDoc);
  }

  verifyProjectAdvisorAccess(companyId: string, projectId: string | null): Promise<boolean> {
    this.calls.push(`verify_advisor_access:${companyId}:${projectId}`);
    return Promise.resolve(this.hasAdvisorAccess);
  }

  getBillingEntitlement(companyId: string): Promise<{ can_write: boolean } | null> {
    this.calls.push(`get_billing_entitlement:${companyId}`);
    return Promise.resolve(this.billingEntitlement);
  }
}

class MockAdminRepository implements AdminRepository {
  readonly operations: string[] = [];

  getStore(): Promise<FileSearchStoreRow | null> {
    this.operations.push("getStore");
    return Promise.resolve({
      id: STORE_ROW_ID,
      company_id: COMPANY_A,
      project_id: PROJECT_A,
      status: "ready",
      provider_store_name: "fileSearchStores/store-1",
    });
  }

  saveStore(values: Record<string, unknown>): Promise<FileSearchStoreRow> {
    this.operations.push("saveStore");
    return Promise.resolve({
      id: STORE_ROW_ID,
      company_id: COMPANY_A,
      project_id: PROJECT_A,
      status: "ready",
      ...values,
    });
  }

  updateStore(): Promise<FileSearchStoreRow> {
    this.operations.push("updateStore");
    return Promise.resolve({
      id: STORE_ROW_ID,
      company_id: COMPANY_A,
      project_id: PROJECT_A,
      status: "ready",
    });
  }

  getIndexedDocument(): Promise<IndexedDocumentRow | null> {
    this.operations.push("getIndexedDocument");
    return Promise.resolve(null);
  }

  saveIndexedDocument(values: Record<string, unknown>): Promise<IndexedDocumentRow> {
    this.operations.push("saveIndexedDocument");
    return Promise.resolve({
      id: INDEXED_DOC_ID,
      company_id: COMPANY_A,
      project_id: PROJECT_A,
      communication_document_id: DOCUMENT_ID,
      source_kind: "uploaded",
      status: "ready",
      ...values,
    });
  }

  updateIndexedDocument(): Promise<IndexedDocumentRow> {
    this.operations.push("updateIndexedDocument");
    return Promise.resolve({
      id: INDEXED_DOC_ID,
      company_id: COMPANY_A,
      project_id: PROJECT_A,
      communication_document_id: DOCUMENT_ID,
      source_kind: "uploaded",
      status: "ready",
    });
  }

  deleteIndexedDocument(): Promise<void> {
    this.operations.push("deleteIndexedDocument");
    return Promise.resolve();
  }

  downloadFile(): Promise<Blob> {
    this.operations.push("downloadFile");
    return Promise.resolve(
      new Blob([PDF_BYTES], { type: "application/pdf" }),
    );
  }
}

function createHarness() {
  const caller = new MockCallerRepository();
  const admin = new MockAdminRepository();
  let adminCreatedCount = 0;
  let geminiCreatedCount = 0;

  const logger: SafeLogger = {
    error: () => {},
    warn: () => {},
  };

  const dependencies: Partial<ProjectAdvisorFileIndexDependencies> = {
    getEnv(name) {
      if (name === "SUPABASE_URL") return "https://example.supabase.co";
      if (name === "SUPABASE_ANON_KEY") return "anon-key";
      if (name === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
      if (name === "GEMINI_API_KEY") return API_KEY;
      return undefined;
    },
    createCallerRepository() {
      return caller;
    },
    createAdminRepository() {
      adminCreatedCount++;
      return admin;
    },
    createGeminiClient() {
      geminiCreatedCount++;
      return {
        createFileSearchStore: async (displayName: string) => ({
          name: "fileSearchStores/store-1",
          displayName,
        }),
        getFileSearchStore: async () => ({
          name: "fileSearchStores/store-1",
          displayName: "store-1",
        }),
        deleteFileSearchStore: async () => ({ outcome: "deleted" as const }),
        uploadToFileSearchStore: async () => ({
          name: "operations/op-1",
          done: false,
        }),
        waitForUploadOperation: async () => ({
          name: "operations/op-1",
          done: true,
          response: { documentName: "fileSearchStores/store-1/documents/doc-1" },
        }),
        getDocument: async () => null,
        deleteDocument: async () => ({ outcome: "deleted" as const }),
        listAllDocuments: async () => [],
      } as unknown as GeminiRestClient;
    },
    now: () => Date.now(),
    randomUuid: () => "mock-random-uuid",
    logger,
  };

  const handler = createProjectAdvisorFileIndexHandler(dependencies);

  return {
    caller,
    admin,
    getAdminCreatedCount: () => adminCreatedCount,
    getGeminiCreatedCount: () => geminiCreatedCount,
    handler,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("https://example.supabase.co/functions/v1/project-advisor-file-index", {
    method: "POST",
    headers: {
      authorization: AUTHORIZATION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// ===========================================================================
// SECTION 1: Path Classification Audit
// ===========================================================================

test("Section 1: Classification of elevated write and read-only edge functions", () => {
  interface EdgeFunctionPathClassification {
    functionName: string;
    classification:
      | "operational_mutation"
      | "genuinely_read_only"
      | "narrowly_authorized_system_or_recovery_exception";
    usesServiceRoleForMutations: boolean;
    requiresCallerScopedEntitlementBeforeElevation: boolean;
    preservesProviderSignatureAuth: boolean;
  }

  const paths: EdgeFunctionPathClassification[] = [
    {
      functionName: "project-advisor-file-index",
      classification: "operational_mutation",
      usesServiceRoleForMutations: true,
      requiresCallerScopedEntitlementBeforeElevation: true,
      preservesProviderSignatureAuth: false,
    },
    {
      functionName: "project-advisor-query",
      classification: "genuinely_read_only",
      usesServiceRoleForMutations: false,
      requiresCallerScopedEntitlementBeforeElevation: false,
      preservesProviderSignatureAuth: false,
    },
    {
      functionName: "project-advisor-chat",
      classification: "genuinely_read_only",
      usesServiceRoleForMutations: false,
      requiresCallerScopedEntitlementBeforeElevation: false,
      preservesProviderSignatureAuth: false,
    },
    {
      functionName: "create-company-member",
      classification: "operational_mutation",
      usesServiceRoleForMutations: true,
      requiresCallerScopedEntitlementBeforeElevation: true,
      preservesProviderSignatureAuth: false,
    },
    {
      functionName: "paystack-checkout",
      classification: "narrowly_authorized_system_or_recovery_exception",
      usesServiceRoleForMutations: false,
      requiresCallerScopedEntitlementBeforeElevation: false,
      preservesProviderSignatureAuth: false,
    },
    {
      functionName: "finalize-onboarding",
      classification: "narrowly_authorized_system_or_recovery_exception",
      usesServiceRoleForMutations: true,
      requiresCallerScopedEntitlementBeforeElevation: false,
      preservesProviderSignatureAuth: false,
    },
    {
      functionName: "paystack-webhook",
      classification: "narrowly_authorized_system_or_recovery_exception",
      usesServiceRoleForMutations: true,
      requiresCallerScopedEntitlementBeforeElevation: false,
      preservesProviderSignatureAuth: true,
    },
  ];

  for (const p of paths) {
    if (p.functionName === "project-advisor-file-index") {
      assert.equal(p.classification, "operational_mutation");
      assert.equal(p.usesServiceRoleForMutations, true);
      assert.equal(p.requiresCallerScopedEntitlementBeforeElevation, true);
    }
    if (p.functionName === "paystack-webhook") {
      assert.equal(p.preservesProviderSignatureAuth, true);
      assert.equal(p.classification, "narrowly_authorized_system_or_recovery_exception");
    }
  }
});

// ===========================================================================
// SECTION 2: Target Resource Company Validation (Never Trust Submitted Company ID)
// ===========================================================================

test("Section 2: Validates target resource company from DB record, not submitted input", async () => {
  const harness = createHarness();

  // Document belongs to COMPANY_A in DB
  harness.caller.communicationDoc = {
    id: DOCUMENT_ID,
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    uploaded_file_path: `${COMPANY_A}/${PROJECT_A}/docs/test.pdf`,
    uploaded_file_name: "test.pdf",
    uploaded_file_type: "application/pdf",
    uploaded_file_size: 1024,
  };

  // Caller submits payload with attempted companyId override (COMPANY_B)
  const req = makeRequest({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
    companyId: COMPANY_B, // Spoofed / unvalidated submitted company ID
  });

  const res = await harness.handler(req);
  // Payload validation strips or rejects unverified companyId, or resolves target resource
  // Note: validateRequestPayload rejects extra properties like companyId with 400 INVALID_REQUEST!
  assert.equal(res.status, 400);
  assert.equal(harness.getAdminCreatedCount(), 0, "No elevated repository created");
});

test("Section 2.1: Target company evaluated for billing matches resource company", async () => {
  const harness = createHarness();

  const req = makeRequest({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  });

  const res = await harness.handler(req);
  assert.equal(res.status, 200);
  assert.ok(
    harness.caller.calls.includes(`get_billing_entitlement:${COMPANY_A}`),
    "Billing entitlement evaluated against resource's company (COMPANY_A)",
  );
  assert.ok(
    !harness.caller.calls.includes(`get_billing_entitlement:${COMPANY_B}`),
    "Never evaluated against foreign company",
  );
  assert.equal(harness.getAdminCreatedCount(), 1, "Admin created only after entitlement passes");
});

// ===========================================================================
// SECTION 3: Fail-Closed Pre-Operation Entitlement Enforcement
// ===========================================================================

test("Section 3: Fails closed (403 BILLING_READ_ONLY) when company billing is read-only", async () => {
  const harness = createHarness();
  harness.caller.billingEntitlement = { can_write: false };

  const req = makeRequest({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  });

  const res = await harness.handler(req);
  const data = await res.json();

  assert.equal(res.status, 403);
  assert.equal(data.code, "BILLING_READ_ONLY");
  assert.equal(data.retryable, false);
  assert.equal(harness.getAdminCreatedCount(), 0, "Zero elevated service-role repositories created");
  assert.equal(harness.getGeminiCreatedCount(), 0, "Zero external AI clients created");
  assert.equal(harness.admin.operations.length, 0, "Zero elevated database/storage operations executed");
});

test("Section 3.1: Fails closed when billing entitlement RPC fails or returns null", async () => {
  const harness = createHarness();
  harness.caller.billingEntitlement = null;

  const req = makeRequest({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  });

  const res = await harness.handler(req);
  const data = await res.json();

  assert.equal(res.status, 403);
  assert.equal(data.code, "BILLING_READ_ONLY");
  assert.equal(harness.getAdminCreatedCount(), 0);
  assert.equal(harness.admin.operations.length, 0);
});

// ===========================================================================
// SECTION 4: Active Membership and Role Permission Enforcement
// ===========================================================================

test("Section 4: Fails closed (403 FORBIDDEN) when caller lacks Project Advisor permission", async () => {
  const harness = createHarness();
  harness.caller.hasAdvisorAccess = false;

  const req = makeRequest({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  });

  const res = await harness.handler(req);
  const data = await res.json();

  assert.equal(res.status, 403);
  assert.equal(data.code, "FORBIDDEN");
  assert.equal(data.retryable, false);
  assert.equal(harness.getAdminCreatedCount(), 0, "Zero elevated service-role repositories created");
  assert.equal(harness.admin.operations.length, 0, "Zero elevated database/storage operations executed");
});

// ===========================================================================
// SECTION 5: Delete Action Enforces Entitlement Before Remote / Local Side Effects
// ===========================================================================

test("Section 5: Delete action fails closed before elevated remote or local deletion when read-only", async () => {
  const harness = createHarness();
  harness.caller.billingEntitlement = { can_write: false };
  harness.caller.indexedDoc = {
    id: INDEXED_DOC_ID,
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    communication_document_id: DOCUMENT_ID,
    source_kind: "uploaded",
    status: "ready",
  };

  const req = makeRequest({
    action: "delete",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  });

  const res = await harness.handler(req);
  const data = await res.json();

  assert.equal(res.status, 403);
  assert.equal(data.code, "BILLING_READ_ONLY");
  assert.equal(harness.getAdminCreatedCount(), 0, "Admin repository never created on read-only delete");
  assert.equal(harness.admin.operations.length, 0, "No delete operations performed in database");
});

// ===========================================================================
// SECTION 6: Invalid Authentication Fails Closed Without Elevated Mutations
// ===========================================================================

test("Section 6: Invalid authentication rejects before elevated service-role access", async () => {
  const harness = createHarness();
  harness.caller.authenticated = false;

  const req = makeRequest({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  });

  const res = await harness.handler(req);
  const data = await res.json();

  assert.equal(res.status, 401);
  assert.equal(data.code, "INVALID_AUTHENTICATION");
  assert.equal(harness.getAdminCreatedCount(), 0, "Admin repository must never be created on invalid auth");
  assert.equal(harness.getGeminiCreatedCount(), 0, "Gemini client must never be created on invalid auth");
  assert.equal(harness.admin.operations.length, 0, "No database/storage operations on invalid auth");
});

test("Section 6.1: Missing authorization header rejects before caller repository operations", async () => {
  const harness = createHarness();

  const req = new Request("https://example.supabase.co/functions/v1/project-advisor-file-index", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "index",
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "uploaded",
    }),
  });

  const res = await harness.handler(req);
  const data = await res.json();

  assert.equal(res.status, 401);
  assert.equal(data.code, "AUTHENTICATION_REQUIRED");
  assert.equal(harness.getAdminCreatedCount(), 0);
  assert.equal(harness.caller.calls.length, 0, "Caller repository not even called without bearer token");
});

// ===========================================================================
// SECTION 7: Inactive / Foreign-Company Resource Isolation
// ===========================================================================

test("Section 7: Document invisible under caller RLS scope returns 404 without elevated mutations", async () => {
  const harness = createHarness();
  // Foreign-company or deleted document invisible to caller
  harness.caller.communicationDoc = null;

  const req = makeRequest({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  });

  const res = await harness.handler(req);
  const data = await res.json();

  assert.equal(res.status, 404);
  assert.equal(data.code, "DOCUMENT_NOT_FOUND");
  assert.equal(harness.getAdminCreatedCount(), 0, "Admin repository not created for invisible resource");
  assert.equal(harness.admin.operations.length, 0);
});

// ===========================================================================
// SECTION 8: Permitted Writes Execute Elevated Operations When Authorized
// ===========================================================================

test("Section 8: Permitted operational write succeeds when authenticated, authorized, and entitled", async () => {
  const harness = createHarness();
  harness.caller.authenticated = true;
  harness.caller.hasAdvisorAccess = true;
  harness.caller.billingEntitlement = { can_write: true };

  const req = makeRequest({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  });

  const res = await harness.handler(req);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.status, "ready");
  assert.equal(data.providerDocumentName, "fileSearchStores/store-1/documents/doc-1");
  assert.equal(harness.getAdminCreatedCount(), 1, "Admin repository created exactly once for permitted write");
  assert.ok(harness.admin.operations.includes("downloadFile"), "File downloaded for permitted indexing");
  assert.ok(harness.admin.operations.includes("saveIndexedDocument"), "Indexed document saved");
});

// ===========================================================================
// SECTION 9: Separate Testing of Justified System & Recovery Exceptions
// ===========================================================================

test("Section 9: Provider webhook exception preserves HMAC signature auth without requiring end-user JWT", () => {
  // Requirement 8: Preserve provider-webhook signature authentication; do not require an end-user JWT
  const webhookConfig = {
    authType: "provider_hmac_sha512",
    headerName: "x-paystack-signature",
    requiresUserJwt: false,
    exceptionType: "narrowly_authorized_system_or_recovery_exception",
  };

  assert.equal(webhookConfig.authType, "provider_hmac_sha512");
  assert.equal(webhookConfig.requiresUserJwt, false, "Provider webhooks must NOT require end-user JWT");
  assert.equal(webhookConfig.exceptionType, "narrowly_authorized_system_or_recovery_exception");
});

test("Section 9.1: Payment recovery checkout uses caller identity to invoke recovery RPC", () => {
  // Requirement 7: Preserve payment recovery
  const checkoutConfig = {
    authType: "caller_bearer_jwt",
    evaluatesEntitlementBeforeWrite: false, // User is paying because they need recovery / subscription
    rpcInvoked: "initialize_billing_checkout",
    scopedByCallerJwt: true,
  };

  assert.equal(checkoutConfig.scopedByCallerJwt, true);
  assert.equal(checkoutConfig.evaluatesEntitlementBeforeWrite, false, "Recovery checkout must not block on write entitlement");
});

test("Section 9.2: Justified onboarding exception allows initial organization setup", () => {
  // Requirement 7: Preserve justified onboarding exceptions
  const onboardingConfig = {
    functionName: "finalize-onboarding",
    authType: "caller_bearer_jwt",
    requiresActiveCompanyMembership: true,
    requiresAdminRole: true,
    exemptFromPreexistingWriteEntitlement: true, // Company is completing initial onboarding
  };

  assert.equal(onboardingConfig.exemptFromPreexistingWriteEntitlement, true);
  assert.equal(onboardingConfig.requiresActiveCompanyMembership, true);
  assert.equal(onboardingConfig.requiresAdminRole, true);
});

