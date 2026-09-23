import {
  type AdminRepository,
  type CallerRepository,
  createProjectAdvisorFileIndexHandler,
  type FileSearchStoreRow,
  type IndexedDocumentRow,
  type ProjectAdvisorFileIndexDependencies,
  ProjectAdvisorFileIndexError,
  type SafeLogger,
} from "./index.ts";
import {
  type CommunicationDocumentRow,
  computeSha256,
  type SourceKind,
} from "./helpers.ts";
import {
  type GeminiDeleteResult,
  type GeminiDocument,
  type GeminiDocumentPage,
  type GeminiFileSearchStore,
  type GeminiOperation,
  type GeminiRestClient,
  type GeminiRestClientConfig,
  GeminiRestError,
  type GeminiUploadInput,
} from "./gemini-rest-client.ts";

const COMPANY_ID = "11111111-1111-4111-a111-111111111111";
const PROJECT_ID = "22222222-2222-4222-a222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-a333-333333333333";
const REGISTRY_ID = "44444444-4444-4444-a444-444444444444";
const STORE_ROW_ID = "55555555-5555-4555-a555-555555555555";
const GENERATED_STORE_ROW_ID = "66666666-6666-4666-a666-666666666666";
const STORE_NAME = "fileSearchStores/project-store-1";
const DOCUMENT_NAME = `${STORE_NAME}/documents/document-1`;
const SECOND_DOCUMENT_NAME = `${STORE_NAME}/documents/document-2`;
const OTHER_DOCUMENT_NAME = `${STORE_NAME}/documents/document-3`;
const OPERATION_NAME = `${STORE_NAME}/upload/operations/operation-1`;
const FIXED_NOW = Date.parse("2026-07-29T12:00:00.000Z");
const API_KEY = "test-gemini-api-key";
const AUTHORIZATION = "Bearer header.payload.signature";

function fail(message: string): never {
  throw new Error(message);
}

function assert(
  condition: unknown,
  message = "Assertion failed.",
): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function assertEquals<T>(
  actual: T,
  expected: T,
  message = "Values are not equal.",
): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    fail(`${message}\nActual: ${actualJson}\nExpected: ${expectedJson}`);
  }
}

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  const data: unknown = await response.json();
  assert(
    typeof data === "object" && data !== null && !Array.isArray(data),
    "Response body must be a JSON object.",
  );
  return data as Record<string, unknown>;
}

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode(
    "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
  );
}

function pdfArrayBuffer(): ArrayBuffer {
  const bytes = pdfBytes();
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function communicationDocument(
  overrides: Partial<CommunicationDocumentRow> = {},
): CommunicationDocumentRow {
  const bytes = pdfBytes();
  return {
    id: DOCUMENT_ID,
    company_id: COMPANY_ID,
    project_id: PROJECT_ID,
    document_title: "Approved programme",
    subject: "Programme",
    document_number: "PM-001",
    uploaded_file_path: `${COMPANY_ID}/${PROJECT_ID}/documents/programme.pdf`,
    uploaded_file_name: "programme.pdf",
    uploaded_file_type: "application/pdf",
    uploaded_file_size: bytes.byteLength,
    signed_file_path: null,
    signed_file_name: null,
    generated_docx_path: null,
    ...overrides,
  };
}

function storeRow(
  overrides: Partial<FileSearchStoreRow> = {},
): FileSearchStoreRow {
  return {
    id: STORE_ROW_ID,
    company_id: COMPANY_ID,
    project_id: PROJECT_ID,
    provider: "gemini_file_search",
    provider_store_name: STORE_NAME,
    display_name: `PM Project Store - ${PROJECT_ID}`,
    embedding_model: "models/gemini-embedding-2",
    status: "ready",
    last_error: null,
    created_at: "2026-07-29T10:00:00.000Z",
    updated_at: "2026-07-29T10:00:00.000Z",
    ...overrides,
  };
}

function indexedDocument(
  overrides: Partial<IndexedDocumentRow> = {},
): IndexedDocumentRow {
  return {
    id: REGISTRY_ID,
    company_id: COMPANY_ID,
    project_id: PROJECT_ID,
    store_id: STORE_ROW_ID,
    communication_document_id: DOCUMENT_ID,
    source_kind: "uploaded",
    source_storage_path: `${COMPANY_ID}/${PROJECT_ID}/documents/programme.pdf`,
    source_file_name: "programme.pdf",
    source_mime_type: "application/pdf",
    source_file_size: pdfBytes().byteLength,
    source_fingerprint: null,
    provider_document_name: DOCUMENT_NAME,
    status: "ready",
    error_message: null,
    indexed_at: "2026-07-29T11:00:00.000Z",
    created_at: "2026-07-29T11:00:00.000Z",
    updated_at: "2026-07-29T11:00:00.000Z",
    ...overrides,
  };
}

function customMetadata(
  fingerprint: string,
  overrides: Partial<Record<string, string>> = {},
): readonly { readonly key: string; readonly stringValue: string }[] {
  const values = {
    pm_company_id: COMPANY_ID,
    pm_project_id: PROJECT_ID,
    pm_document_id: DOCUMENT_ID,
    pm_source_kind: "uploaded",
    pm_fingerprint: fingerprint,
    ...overrides,
  };
  return Object.entries(values).map(([key, stringValue]) => ({
    key,
    stringValue,
  }));
}

class FakeCallerRepository implements CallerRepository {
  authenticated = true;
  communication: CommunicationDocumentRow | null = communicationDocument();
  indexed: IndexedDocumentRow | null = null;
  hasAccess = true;
  entitlement: { can_write: boolean } | null = { can_write: true };
  readonly sequence: string[];

  constructor(sequence: string[]) {
    this.sequence = sequence;
  }

  authenticate(token: string): Promise<boolean> {
    this.sequence.push(`authenticate:${token}`);
    return Promise.resolve(this.authenticated);
  }

  getCommunicationDocument(
    communicationDocumentId: string,
  ): Promise<CommunicationDocumentRow | null> {
    this.sequence.push(`caller_document:${communicationDocumentId}`);
    return Promise.resolve(this.communication);
  }

  getIndexedDocument(
    communicationDocumentId: string,
    sourceKind: SourceKind,
  ): Promise<IndexedDocumentRow | null> {
    this.sequence.push(
      `caller_indexed:${communicationDocumentId}:${sourceKind}`,
    );
    return Promise.resolve(this.indexed);
  }

  verifyProjectAdvisorAccess(
    companyId: string,
    projectId: string | null,
  ): Promise<boolean> {
    this.sequence.push(`caller_access:${companyId}:${projectId}`);
    return Promise.resolve(this.hasAccess);
  }

  getBillingEntitlement(
    companyId: string,
  ): Promise<{ can_write: boolean } | null> {
    this.sequence.push(`caller_entitlement:${companyId}`);
    return Promise.resolve(this.entitlement);
  }
}

class FakeAdminRepository implements AdminRepository {
  store: FileSearchStoreRow | null = storeRow();
  indexed: IndexedDocumentRow | null = null;
  file = new Blob([pdfArrayBuffer()], { type: "application/pdf" });
  downloadCount = 0;
  deletedIndexed = false;
  failReadyStoreUpdate = false;
  failReadyIndexedUpdate = false;
  failIndexedDelete = false;
  readonly storeSaves: Record<string, unknown>[] = [];
  readonly storeUpdates: Record<string, unknown>[] = [];
  readonly indexedSaves: Record<string, unknown>[] = [];
  readonly indexedUpdates: Record<string, unknown>[] = [];

  getStore(
    companyId: string,
    projectId: string,
  ): Promise<FileSearchStoreRow | null> {
    assertEquals(companyId, COMPANY_ID);
    assertEquals(projectId, PROJECT_ID);
    return Promise.resolve(this.store);
  }

  saveStore(
    values: Record<string, unknown>,
  ): Promise<FileSearchStoreRow> {
    this.storeSaves.push({ ...values });
    this.store = {
      id: String(values.id),
      company_id: String(values.company_id),
      project_id: String(values.project_id),
      provider: typeof values.provider === "string" ? values.provider : null,
      provider_store_name: typeof values.provider_store_name === "string"
        ? values.provider_store_name
        : null,
      display_name: typeof values.display_name === "string"
        ? values.display_name
        : null,
      embedding_model: typeof values.embedding_model === "string"
        ? values.embedding_model
        : null,
      status: String(values.status),
      last_error: typeof values.last_error === "string"
        ? values.last_error
        : null,
      updated_at: typeof values.updated_at === "string"
        ? values.updated_at
        : null,
    };
    return Promise.resolve(this.store);
  }

  updateStore(
    storeId: string,
    companyId: string,
    projectId: string,
    values: Record<string, unknown>,
  ): Promise<FileSearchStoreRow> {
    assertEquals(storeId, this.store?.id ?? storeId);
    assertEquals(companyId, COMPANY_ID);
    assertEquals(projectId, PROJECT_ID);
    this.storeUpdates.push({ ...values });

    if (this.failReadyStoreUpdate && values.status === "ready") {
      throw new ProjectAdvisorFileIndexError({
        status: 500,
        code: "DATABASE_ERROR",
        publicMessage: "Database failed.",
      });
    }

    const current = this.store ?? storeRow({ id: storeId });
    this.store = {
      ...current,
      ...values,
      id: storeId,
      company_id: companyId,
      project_id: projectId,
    } as FileSearchStoreRow;
    return Promise.resolve(this.store);
  }

  getIndexedDocument(
    companyId: string,
    projectId: string,
    communicationDocumentId: string,
    sourceKind: SourceKind,
  ): Promise<IndexedDocumentRow | null> {
    assertEquals(companyId, COMPANY_ID);
    assertEquals(projectId, PROJECT_ID);
    assertEquals(communicationDocumentId, DOCUMENT_ID);
    assertEquals(sourceKind, "uploaded");
    return Promise.resolve(this.indexed);
  }

  saveIndexedDocument(
    values: Record<string, unknown>,
  ): Promise<IndexedDocumentRow> {
    this.indexedSaves.push({ ...values });
    const current = this.indexed ?? indexedDocument();
    this.indexed = {
      ...current,
      ...values,
      id: current.id,
      company_id: String(values.company_id),
      project_id: String(values.project_id),
      communication_document_id: String(
        values.communication_document_id,
      ),
      source_kind: values.source_kind as SourceKind,
      status: String(values.status),
    };
    return Promise.resolve(this.indexed);
  }

  updateIndexedDocument(
    indexedDocumentId: string,
    companyId: string,
    projectId: string,
    values: Record<string, unknown>,
  ): Promise<IndexedDocumentRow> {
    assertEquals(indexedDocumentId, REGISTRY_ID);
    assertEquals(companyId, COMPANY_ID);
    assertEquals(projectId, PROJECT_ID);
    this.indexedUpdates.push({ ...values });

    if (this.failReadyIndexedUpdate && values.status === "ready") {
      throw new Error("Sensitive database message.");
    }

    const current = this.indexed ?? indexedDocument();
    this.indexed = {
      ...current,
      ...values,
      id: indexedDocumentId,
      company_id: companyId,
      project_id: projectId,
    } as IndexedDocumentRow;
    return Promise.resolve(this.indexed);
  }

  deleteIndexedDocument(
    indexedDocumentId: string,
    companyId: string,
    projectId: string,
  ): Promise<void> {
    assertEquals(indexedDocumentId, REGISTRY_ID);
    assertEquals(companyId, COMPANY_ID);
    assertEquals(projectId, PROJECT_ID);
    if (this.failIndexedDelete) {
      throw new ProjectAdvisorFileIndexError({
        status: 500,
        code: "DATABASE_ERROR",
        publicMessage: "Database failed.",
      });
    }
    this.deletedIndexed = true;
    this.indexed = null;
    return Promise.resolve();
  }

  downloadFile(path: string): Promise<Blob> {
    assertEquals(
      path,
      `${COMPANY_ID}/${PROJECT_ID}/documents/programme.pdf`,
    );
    this.downloadCount += 1;
    return Promise.resolve(this.file);
  }
}

class FakeGeminiRestClient implements GeminiRestClient {
  getStoreResult: GeminiFileSearchStore | null = {
    name: STORE_NAME,
    displayName: `PM Project Store - ${PROJECT_ID}`,
  };
  getDocumentResult: GeminiDocument | null = null;
  listAllResult: readonly GeminiDocument[] = [];
  uploadResult: GeminiOperation = {
    name: OPERATION_NAME,
    done: false,
  };
  waitResult: GeminiOperation = {
    name: OPERATION_NAME,
    done: true,
    response: { documentName: DOCUMENT_NAME },
  };
  waitError: unknown = null;
  deleteError: unknown = null;
  createStoreCount = 0;
  getStoreCount = 0;
  uploadCount = 0;
  waitCount = 0;
  listAllCount = 0;
  readonly uploadInputs: GeminiUploadInput[] = [];
  readonly deletedDocuments: string[] = [];
  readonly deletedStores: string[] = [];

  createFileSearchStore(
    displayName: string,
  ): Promise<GeminiFileSearchStore> {
    this.createStoreCount += 1;
    return Promise.resolve({ name: STORE_NAME, displayName });
  }

  getFileSearchStore(
    storeName: string,
  ): Promise<GeminiFileSearchStore | null> {
    assertEquals(storeName, STORE_NAME);
    this.getStoreCount += 1;
    return Promise.resolve(this.getStoreResult);
  }

  deleteFileSearchStore(
    storeName: string,
  ): Promise<GeminiDeleteResult> {
    this.deletedStores.push(storeName);
    return Promise.resolve({ outcome: "deleted" });
  }

  uploadToFileSearchStore(
    input: GeminiUploadInput,
  ): Promise<GeminiOperation> {
    this.uploadCount += 1;
    this.uploadInputs.push(input);
    return Promise.resolve(this.uploadResult);
  }

  getOperation(_operationName: string): Promise<GeminiOperation> {
    return Promise.reject(new Error("Unexpected direct operation poll."));
  }

  waitForUploadOperation(
    _initialOperation: GeminiOperation,
  ): Promise<GeminiOperation> {
    this.waitCount += 1;
    if (this.waitError !== null) {
      return Promise.reject(this.waitError);
    }
    return Promise.resolve(this.waitResult);
  }

  getDocument(
    documentName: string,
  ): Promise<GeminiDocument | null> {
    assertEquals(documentName, DOCUMENT_NAME);
    return Promise.resolve(this.getDocumentResult);
  }

  deleteDocument(
    documentName: string,
  ): Promise<GeminiDeleteResult> {
    if (this.deleteError !== null) {
      return Promise.reject(this.deleteError);
    }
    this.deletedDocuments.push(documentName);
    return Promise.resolve({ outcome: "deleted" });
  }

  listDocuments(
    _storeName: string,
    _pageToken?: string,
  ): Promise<GeminiDocumentPage> {
    return Promise.reject(new Error("Unexpected single-page list call."));
  }

  listAllDocuments(
    storeName: string,
  ): Promise<readonly GeminiDocument[]> {
    assertEquals(storeName, STORE_NAME);
    this.listAllCount += 1;
    return Promise.resolve(this.listAllResult);
  }
}

interface TestHarness {
  readonly handler: (request: Request) => Promise<Response>;
  readonly caller: FakeCallerRepository;
  readonly admin: FakeAdminRepository;
  readonly gemini: FakeGeminiRestClient;
  readonly sequence: string[];
  readonly loggedErrors: Array<Readonly<Record<string, string>>>;
  readonly loggedWarnings: Array<Readonly<Record<string, string>>>;
  adminFactoryCount: number;
  geminiFactoryCount: number;
  geminiConfig: GeminiRestClientConfig | null;
}

function createHarness(): TestHarness {
  const sequence: string[] = [];
  const caller = new FakeCallerRepository(sequence);
  const admin = new FakeAdminRepository();
  const gemini = new FakeGeminiRestClient();
  const loggedErrors: Array<Readonly<Record<string, string>>> = [];
  const loggedWarnings: Array<Readonly<Record<string, string>>> = [];

  const harness = {
    caller,
    admin,
    gemini,
    sequence,
    loggedErrors,
    loggedWarnings,
    adminFactoryCount: 0,
    geminiFactoryCount: 0,
    geminiConfig: null as GeminiRestClientConfig | null,
    handler: (_request: Request): Promise<Response> =>
      Promise.reject(new Error("Handler not initialized.")),
  };

  const logger: SafeLogger = {
    error(_event, fields): void {
      loggedErrors.push(fields);
    },
    warn(_event, fields): void {
      loggedWarnings.push(fields);
    },
  };

  const environment: Record<string, string> = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    GEMINI_API_KEY: API_KEY,
  };

  const dependencies: Partial<ProjectAdvisorFileIndexDependencies> = {
    getEnv(name): string | undefined {
      return environment[name];
    },
    createCallerRepository(_configuration, authorizationHeader) {
      assertEquals(authorizationHeader, AUTHORIZATION);
      sequence.push("caller_factory");
      return caller;
    },
    createAdminRepository() {
      sequence.push("admin_factory");
      harness.adminFactoryCount += 1;
      return admin;
    },
    createGeminiClient(config) {
      sequence.push("gemini_factory");
      harness.geminiFactoryCount += 1;
      harness.geminiConfig = config;
      return gemini;
    },
    now: () => FIXED_NOW,
    randomUuid: () => GENERATED_STORE_ROW_ID,
    logger,
  };

  harness.handler = createProjectAdvisorFileIndexHandler(dependencies);
  return harness;
}

function request(
  body: unknown,
  options: {
    method?: string;
    authorization?: string | null;
    contentType?: string | null;
  } = {},
): Request {
  const headers = new Headers();
  const authorization = options.authorization === undefined
    ? AUTHORIZATION
    : options.authorization;
  const contentType = options.contentType === undefined
    ? "application/json"
    : options.contentType;

  if (authorization !== null) {
    headers.set("authorization", authorization);
  }
  if (contentType !== null) {
    headers.set("content-type", contentType);
  }

  return new Request("https://example.test/project-advisor-file-index", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "GET" || options.method === "OPTIONS"
      ? undefined
      : JSON.stringify(body),
  });
}

Deno.test("1. OPTIONS and non-POST requests never initialize repositories", async () => {
  const harness = createHarness();

  const optionsResponse = await harness.handler(
    request(null, { method: "OPTIONS" }),
  );
  assertEquals(optionsResponse.status, 200);
  assertEquals(
    optionsResponse.headers.get("access-control-allow-methods"),
    "POST, OPTIONS",
  );

  const getResponse = await harness.handler(
    request(null, { method: "GET" }),
  );
  assertEquals(getResponse.status, 405);
  assertEquals((await responseJson(getResponse)).code, "METHOD_NOT_ALLOWED");
  assertEquals(harness.sequence, []);
  assertEquals(harness.adminFactoryCount, 0);
  assertEquals(harness.geminiFactoryCount, 0);
});

Deno.test("2. Missing and malformed bearer credentials fail before client creation", async () => {
  for (
    const authorization of [
      null,
      "",
      "Basic abc",
      "Bearer",
      "Bearer token with spaces",
    ]
  ) {
    const harness = createHarness();
    const response = await harness.handler(
      request(
        {
          action: "index",
          communicationDocumentId: DOCUMENT_ID,
          sourceKind: "uploaded",
        },
        { authorization },
      ),
    );
    assertEquals(response.status, 401);
    assertEquals(harness.sequence, []);
    assertEquals(harness.adminFactoryCount, 0);
  }
});

Deno.test("3. Invalid authentication never creates the service-role repository", async () => {
  const harness = createHarness();
  harness.caller.authenticated = false;

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));

  assertEquals(response.status, 401);
  assertEquals((await responseJson(response)).code, "INVALID_AUTHENTICATION");
  assertEquals(harness.adminFactoryCount, 0);
  assertEquals(harness.geminiFactoryCount, 0);
});

Deno.test("4. Strict payload validation occurs before service-role access", async () => {
  const invalidBodies = [
    null,
    {},
    {
      action: "index",
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "uploaded",
      companyId: COMPANY_ID,
    },
    {
      action: "index",
      communicationDocumentId: "not-a-uuid",
      sourceKind: "uploaded",
    },
  ];

  for (const body of invalidBodies) {
    const harness = createHarness();
    const response = await harness.handler(request(body));
    assertEquals(response.status, 400);
    assertEquals(harness.adminFactoryCount, 0);
    assertEquals(harness.geminiFactoryCount, 0);
  }
});

Deno.test("5. RLS-invisible records return a generic 404 before service-role access", async () => {
  const harness = createHarness();
  harness.caller.communication = null;
  harness.caller.indexed = null;

  const response = await harness.handler(request({
    action: "delete",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 404);
  assertEquals(body.error, "Document not found or access denied.");
  assertEquals(body.code, "DOCUMENT_NOT_FOUND");
  assertEquals(harness.adminFactoryCount, 0);
  assertEquals(harness.geminiFactoryCount, 0);
});

Deno.test("6. Indexing uses RLS scope before admin, then the validated upload and polling contract", async () => {
  const harness = createHarness();
  harness.admin.store = null;
  const oldFingerprint = "0".repeat(64);
  harness.gemini.listAllResult = [
    {
      name: DOCUMENT_NAME,
      customMetadata: customMetadata("current-placeholder"),
    },
    {
      name: SECOND_DOCUMENT_NAME,
      customMetadata: customMetadata(oldFingerprint),
    },
    {
      name: OTHER_DOCUMENT_NAME,
      customMetadata: customMetadata(oldFingerprint, {
        pm_project_id: "99999999-9999-4999-a999-999999999999",
      }),
    },
  ];

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.status, "ready");
  assertEquals(body.providerDocumentName, DOCUMENT_NAME);
  assertEquals(
    harness.sequence.slice(0, 7),
    [
      "caller_factory",
      "authenticate:header.payload.signature",
      `caller_document:${DOCUMENT_ID}`,
      `caller_access:${COMPANY_ID}:${PROJECT_ID}`,
      `caller_entitlement:${COMPANY_ID}`,
      "admin_factory",
      "gemini_factory",
    ],
  );
  assertEquals(harness.adminFactoryCount, 1);
  assertEquals(harness.geminiFactoryCount, 1);
  assertEquals(harness.geminiConfig?.apiKey, API_KEY);
  assertEquals(harness.gemini.createStoreCount, 1);
  assertEquals(harness.gemini.uploadCount, 1);
  assertEquals(harness.gemini.waitCount, 1);
  assertEquals(harness.admin.downloadCount, 1);
  assertEquals(harness.admin.storeSaves[0].status, "creating");
  assertEquals(
    (harness.admin.store as FileSearchStoreRow | null)?.status,
    "ready",
  );
  assertEquals(harness.admin.indexed?.status, "ready");
  assertEquals(
    harness.gemini.uploadInputs[0].storeName,
    STORE_NAME,
  );
  assertEquals(
    harness.gemini.uploadInputs[0].mimeType,
    "application/pdf",
  );
  assertEquals(
    harness.gemini.uploadInputs[0].customMetadata.map((entry) => entry.key),
    [
      "pm_company_id",
      "pm_project_id",
      "pm_document_id",
      "pm_source_kind",
      "pm_fingerprint",
    ],
  );
  assertEquals(
    harness.gemini.deletedDocuments,
    [SECOND_DOCUMENT_NAME],
  );
});

Deno.test("7. Matching ready fingerprints return an idempotent noop only when the remote document exists", async () => {
  const harness = createHarness();
  const fingerprint = await computeSha256(pdfArrayBuffer());
  harness.admin.indexed = indexedDocument({
    source_fingerprint: fingerprint,
    provider_document_name: DOCUMENT_NAME,
    status: "ready",
  });
  harness.gemini.getDocumentResult = {
    name: DOCUMENT_NAME,
    state: "STATE_ACTIVE",
  };

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.action, "noop");
  assertEquals(harness.gemini.uploadCount, 0);
  assertEquals(harness.gemini.waitCount, 0);
  assertEquals(harness.admin.indexedSaves.length, 0);
});

Deno.test("8. Unsupported formats are registered without downloading or uploading", async () => {
  const harness = createHarness();
  harness.caller.communication = communicationDocument({
    uploaded_file_path: `${COMPANY_ID}/${PROJECT_ID}/documents/drawing.dwg`,
    uploaded_file_name: "drawing.dwg",
    uploaded_file_type: "application/octet-stream",
    uploaded_file_size: null,
  });

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.status, "unsupported");
  assertEquals(harness.admin.downloadCount, 0);
  assertEquals(harness.gemini.uploadCount, 0);
  assertEquals(harness.admin.indexed?.status, "unsupported");
  assertEquals(
    harness.admin.indexed?.error_message,
    "UNSUPPORTED_FORMAT",
  );
});

Deno.test("9. MIME mismatches and cross-tenant storage paths fail before Storage or Gemini", async () => {
  const cases: Array<{
    overrides: Partial<CommunicationDocumentRow>;
    expectedCode: string;
  }> = [
    {
      overrides: { uploaded_file_type: "image/png" },
      expectedCode: "MIME_MISMATCH",
    },
    {
      overrides: {
        uploaded_file_path:
          `99999999-9999-4999-a999-999999999999/${PROJECT_ID}/programme.pdf`,
      },
      expectedCode: "INVALID_STORAGE_PATH",
    },
  ];

  for (const item of cases) {
    const harness = createHarness();
    harness.caller.communication = communicationDocument(item.overrides);
    const response = await harness.handler(request({
      action: "index",
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "uploaded",
    }));
    const body = await responseJson(response);

    assertEquals(response.status, 400);
    assertEquals(body.code, item.expectedCode);
    assertEquals(harness.admin.downloadCount, 0);
    assertEquals(harness.gemini.uploadCount, 0);
    assertEquals(harness.gemini.createStoreCount, 0);
  }
});

Deno.test("10. Binary signature and declared-size mismatches fail closed", async () => {
  const cases: Array<{
    mutate(harness: TestHarness): void;
    code: string;
  }> = [
    {
      mutate(harness) {
        harness.admin.file = new Blob(
          [new TextEncoder().encode("not a PDF")],
          { type: "application/pdf" },
        );
        harness.caller.communication = communicationDocument({
          uploaded_file_size: "9",
        });
      },
      code: "INVALID_FILE_SIGNATURE",
    },
    {
      mutate(harness) {
        harness.caller.communication = communicationDocument({
          uploaded_file_size: pdfBytes().byteLength + 1,
        });
      },
      code: "INVALID_FILE_SIZE",
    },
  ];

  for (const item of cases) {
    const harness = createHarness();
    item.mutate(harness);
    const response = await harness.handler(request({
      action: "index",
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "uploaded",
    }));
    const body = await responseJson(response);

    assertEquals(response.status, 400);
    assertEquals(body.code, item.code);
    assertEquals(harness.gemini.uploadCount, 0);
  }
});

Deno.test("11. Provider upload failures are sanitised and leave a retryable failed registry", async () => {
  const harness = createHarness();
  const sensitive = `${API_KEY} SENSITIVE_PROVIDER_BODY upload-session-url`;
  harness.gemini.waitError = new GeminiRestError({
    code: "GEMINI_OPERATION_FAILED",
    message: sensitive,
    status: 500,
    operationName: "waitForUploadOperation",
  });

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const text = await response.text();

  assertEquals(response.status, 502);
  assert(!text.includes(API_KEY));
  assert(!text.includes("SENSITIVE_PROVIDER_BODY"));
  assert(!text.includes("upload-session-url"));
  const body = JSON.parse(text) as Record<string, unknown>;
  assertEquals(body.code, "GEMINI_REQUEST_FAILED");
  assertEquals(harness.admin.indexed?.status, "failed");
  assertEquals(
    harness.admin.indexed?.error_message,
    "GEMINI_OPERATION_FAILED",
  );
});

Deno.test("12. A failed ready-state database write cleans up the newly uploaded remote document", async () => {
  const harness = createHarness();
  harness.admin.failReadyIndexedUpdate = true;

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const text = await response.text();

  assertEquals(response.status, 500);
  assert(!text.includes("Sensitive database message"));
  assertEquals(
    (JSON.parse(text) as Record<string, unknown>).code,
    "INTERNAL_ERROR",
  );
  assertEquals(harness.gemini.deletedDocuments, [DOCUMENT_NAME]);
  assertEquals(harness.admin.indexed?.status, "failed");
});

Deno.test("13. A failed store ready-state write cleans up the newly created remote store", async () => {
  const harness = createHarness();
  harness.admin.store = null;
  harness.admin.failReadyStoreUpdate = true;

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));

  assertEquals(response.status, 500);
  assertEquals(harness.gemini.deletedStores, [STORE_NAME]);
  assertEquals(harness.gemini.uploadCount, 0);
  assertEquals(
    (harness.admin.store as FileSearchStoreRow | null)?.status,
    "failed",
  );
});

Deno.test("14. A recent store-creation lease returns retryable conflict without duplicating a store", async () => {
  const harness = createHarness();
  harness.admin.store = storeRow({
    provider_store_name: null,
    status: "creating",
    updated_at: new Date(FIXED_NOW - 30_000).toISOString(),
  });

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 409);
  assertEquals(body.code, "STORE_CREATION_IN_PROGRESS");
  assertEquals(body.retryable, true);
  assertEquals(harness.gemini.createStoreCount, 0);
  assertEquals(harness.gemini.uploadCount, 0);
});

Deno.test("15. A missing remote store is recreated before indexing", async () => {
  const harness = createHarness();
  harness.gemini.getStoreResult = null;

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));

  assertEquals(response.status, 200);
  assertEquals(harness.gemini.getStoreCount, 1);
  assertEquals(harness.gemini.createStoreCount, 1);
  assertEquals(harness.gemini.uploadCount, 1);
});

Deno.test("16. Deletion can be authorized through the RLS-visible registry after the source row is gone", async () => {
  const harness = createHarness();
  const fingerprint = "a".repeat(64);
  harness.caller.communication = null;
  harness.caller.indexed = indexedDocument({
    source_fingerprint: fingerprint,
  });
  harness.admin.indexed = indexedDocument({
    source_fingerprint: fingerprint,
  });
  harness.gemini.listAllResult = [
    {
      name: DOCUMENT_NAME,
      customMetadata: customMetadata(fingerprint),
    },
    {
      name: SECOND_DOCUMENT_NAME,
      customMetadata: customMetadata(fingerprint),
    },
    {
      name: OTHER_DOCUMENT_NAME,
      customMetadata: customMetadata(fingerprint, {
        pm_source_kind: "signed",
      }),
    },
  ];

  const response = await harness.handler(request({
    action: "delete",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(
    harness.gemini.deletedDocuments,
    [DOCUMENT_NAME, SECOND_DOCUMENT_NAME],
  );
  assertEquals(harness.admin.deletedIndexed, true);
  assert(
    harness.sequence.indexOf("admin_factory") >
      harness.sequence.indexOf(
        `caller_indexed:${DOCUMENT_ID}:uploaded`,
      ),
    "Admin repository must be created after the RLS registry query.",
  );
});

Deno.test("17. Remote deletion failures retain a failed local row and never leak provider details", async () => {
  const harness = createHarness();
  harness.admin.indexed = indexedDocument();
  const sensitive = `${API_KEY} SENSITIVE_DELETE_BODY`;
  harness.gemini.listAllResult = [{
    name: DOCUMENT_NAME,
    customMetadata: customMetadata("a".repeat(64)),
  }];
  harness.gemini.deleteError = new GeminiRestError({
    code: "GEMINI_HTTP_ERROR",
    message: sensitive,
    status: 503,
    isRetryable: true,
    operationName: "deleteDocument",
  });

  const response = await harness.handler(request({
    action: "delete",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const text = await response.text();

  assertEquals(response.status, 502);
  assert(!text.includes(API_KEY));
  assert(!text.includes("SENSITIVE_DELETE_BODY"));
  assertEquals(harness.admin.deletedIndexed, false);
  assertEquals(harness.admin.indexed?.status, "failed");
  assertEquals(
    harness.admin.indexed?.error_message,
    "GEMINI_HTTP_ERROR",
  );
});

Deno.test("18. A missing remote store allows safe local registry deletion", async () => {
  const harness = createHarness();
  harness.admin.indexed = indexedDocument();
  harness.gemini.getStoreResult = null;

  const response = await harness.handler(request({
    action: "delete",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));

  assertEquals(response.status, 200);
  assertEquals(harness.gemini.listAllCount, 0);
  assertEquals(harness.gemini.deletedDocuments, []);
  assertEquals(harness.admin.deletedIndexed, true);
});

Deno.test("19. Foreign-store document pointers are never sent to Gemini and the local row is retained", async () => {
  const harness = createHarness();
  harness.admin.indexed = indexedDocument({
    provider_document_name:
      "fileSearchStores/foreign-store/documents/document-1",
  });
  harness.gemini.listAllResult = [];

  const response = await harness.handler(request({
    action: "delete",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 502);
  assertEquals(body.code, "REMOTE_DELETE_FAILED");
  assertEquals(harness.gemini.deletedDocuments, []);
  assertEquals(harness.admin.deletedIndexed, false);
  assertEquals(harness.admin.indexed?.status, "failed");
});

Deno.test("20. Unsupported media types and malformed JSON are sanitised without admin access", async () => {
  for (const contentType of ["text/plain", "application/jsonp"]) {
    const mediaHarness = createHarness();
    const mediaResponse = await mediaHarness.handler(
      request(
        {
          action: "index",
          communicationDocumentId: DOCUMENT_ID,
          sourceKind: "uploaded",
        },
        { contentType },
      ),
    );
    assertEquals(mediaResponse.status, 415);
    assertEquals(mediaHarness.adminFactoryCount, 0);
  }

  const jsonHarness = createHarness();
  const malformedRequest = new Request(
    "https://example.test/project-advisor-file-index",
    {
      method: "POST",
      headers: {
        authorization: AUTHORIZATION,
        "content-type": "application/json",
      },
      body: "{not-json",
    },
  );
  const jsonResponse = await jsonHarness.handler(malformedRequest);
  assertEquals(jsonResponse.status, 400);
  assertEquals((await responseJson(jsonResponse)).code, "INVALID_JSON");
  assertEquals(jsonHarness.adminFactoryCount, 0);
});

Deno.test("21. Error logging contains only stable codes, never secrets or raw failures", async () => {
  const harness = createHarness();
  const sensitive = `${API_KEY} raw-provider-response`;
  harness.gemini.waitError = new Error(sensitive);

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const serializedLogs = JSON.stringify({
    errors: harness.loggedErrors,
    warnings: harness.loggedWarnings,
  });

  assertEquals(response.status, 500);
  assert(!serializedLogs.includes(API_KEY));
  assert(!serializedLogs.includes("raw-provider-response"));
  assert(
    harness.loggedErrors.every((fields) =>
      Object.keys(fields).length === 1 && typeof fields.code === "string"
    ),
  );
});

Deno.test("22. Missing or failed Project Advisor access authorization fails closed with 403 FORBIDDEN without elevated mutations", async () => {
  const harness = createHarness();
  harness.caller.hasAccess = false;

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 403);
  assertEquals(body.code, "FORBIDDEN");
  assertEquals(body.retryable, false);
  assertEquals(harness.adminFactoryCount, 0);
  assertEquals(harness.geminiFactoryCount, 0);
});

Deno.test("23. Read-only billing entitlement fails closed with 403 BILLING_READ_ONLY without elevated mutations", async () => {
  const harness = createHarness();
  harness.caller.entitlement = { can_write: false };

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 403);
  assertEquals(body.code, "BILLING_READ_ONLY");
  assertEquals(body.retryable, false);
  assertEquals(harness.adminFactoryCount, 0);
  assertEquals(harness.geminiFactoryCount, 0);
});

Deno.test("24. Missing or errored billing entitlement RPC fails closed with 403 BILLING_READ_ONLY", async () => {
  const harness = createHarness();
  harness.caller.entitlement = null;

  const response = await harness.handler(request({
    action: "index",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  const body = await responseJson(response);

  assertEquals(response.status, 403);
  assertEquals(body.code, "BILLING_READ_ONLY");
  assertEquals(body.retryable, false);
  assertEquals(harness.adminFactoryCount, 0);
  assertEquals(harness.geminiFactoryCount, 0);
});

Deno.test("25. Delete action enforces Project Advisor access and billing entitlement before remote or local deletion", async () => {
  const accessHarness = createHarness();
  accessHarness.caller.hasAccess = false;
  accessHarness.admin.indexed = indexedDocument();

  const accessResponse = await accessHarness.handler(request({
    action: "delete",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  assertEquals(accessResponse.status, 403);
  assertEquals((await responseJson(accessResponse)).code, "FORBIDDEN");
  assertEquals(accessHarness.adminFactoryCount, 0);
  assertEquals(accessHarness.admin.deletedIndexed, false);

  const billingHarness = createHarness();
  billingHarness.caller.entitlement = { can_write: false };
  billingHarness.admin.indexed = indexedDocument();

  const billingResponse = await billingHarness.handler(request({
    action: "delete",
    communicationDocumentId: DOCUMENT_ID,
    sourceKind: "uploaded",
  }));
  assertEquals(billingResponse.status, 403);
  assertEquals((await responseJson(billingResponse)).code, "BILLING_READ_ONLY");
  assertEquals(billingHarness.adminFactoryCount, 0);
  assertEquals(billingHarness.admin.deletedIndexed, false);
});
