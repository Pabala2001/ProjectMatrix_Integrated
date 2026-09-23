import { createClient } from "@supabase/supabase-js";
import {
  type CommunicationDocumentRow,
  computeSha256,
  getMimeTypeAndAllowlistCheck,
  mapSourceKindToDocumentFields,
  parseImageDimensions,
  sanitizeFilename,
  type SourceKind,
  validateBinarySignature,
  validateFileSize,
  validateRequestPayload,
  validateStoragePath,
} from "./helpers.ts";
import {
  createGeminiRestClient,
  type GeminiCustomMetadata,
  type GeminiDocument,
  type GeminiFileSearchStore,
  type GeminiRestClient,
  type GeminiRestClientConfig,
  GeminiRestError,
  isValidStoreName,
} from "./gemini-rest-client.ts";

const COMMUNICATION_DOCUMENT_COLUMNS = [
  "id",
  "company_id",
  "project_id",
  "document_title",
  "subject",
  "document_number",
  "uploaded_file_path",
  "uploaded_file_name",
  "uploaded_file_type",
  "uploaded_file_size",
  "signed_file_path",
  "signed_file_name",
  "generated_docx_path",
].join(",");

const STORE_COLUMNS = [
  "id",
  "company_id",
  "project_id",
  "provider",
  "provider_store_name",
  "display_name",
  "embedding_model",
  "status",
  "last_error",
  "created_at",
  "updated_at",
].join(",");

const INDEXED_DOCUMENT_COLUMNS = [
  "id",
  "company_id",
  "project_id",
  "store_id",
  "communication_document_id",
  "source_kind",
  "source_storage_path",
  "source_file_name",
  "source_mime_type",
  "source_file_size",
  "source_fingerprint",
  "provider_document_name",
  "status",
  "error_message",
  "indexed_at",
  "created_at",
  "updated_at",
].join(",");

const STORAGE_BUCKET = "communication-documents";
const STORE_CREATION_LEASE_MS = 120_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_ID_PATTERN = /^(?=.{1,40}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SupabaseConfiguration {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  geminiApiKey: string;
}

export interface FileSearchStoreRow {
  id: string;
  company_id: string;
  project_id: string;
  provider?: string | null;
  provider_store_name?: string | null;
  display_name?: string | null;
  embedding_model?: string | null;
  status: string;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface IndexedDocumentRow {
  id: string;
  company_id: string;
  project_id: string;
  store_id?: string | null;
  communication_document_id: string;
  source_kind: SourceKind;
  source_storage_path?: string | null;
  source_file_name?: string | null;
  source_mime_type?: string | null;
  source_file_size?: number | string | null;
  source_fingerprint?: string | null;
  provider_document_name?: string | null;
  status: string;
  error_message?: string | null;
  indexed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CallerRepository {
  authenticate(token: string): Promise<boolean>;
  getCommunicationDocument(
    communicationDocumentId: string,
  ): Promise<CommunicationDocumentRow | null>;
  getIndexedDocument(
    communicationDocumentId: string,
    sourceKind: SourceKind,
  ): Promise<IndexedDocumentRow | null>;
  verifyProjectAdvisorAccess(
    companyId: string,
    projectId: string | null,
  ): Promise<boolean>;
  getBillingEntitlement(
    companyId: string,
  ): Promise<{ can_write: boolean } | null>;
}

export interface AdminRepository {
  getStore(
    companyId: string,
    projectId: string,
  ): Promise<FileSearchStoreRow | null>;
  saveStore(
    values: Record<string, unknown>,
  ): Promise<FileSearchStoreRow>;
  updateStore(
    storeId: string,
    companyId: string,
    projectId: string,
    values: Record<string, unknown>,
  ): Promise<FileSearchStoreRow>;
  getIndexedDocument(
    companyId: string,
    projectId: string,
    communicationDocumentId: string,
    sourceKind: SourceKind,
  ): Promise<IndexedDocumentRow | null>;
  saveIndexedDocument(
    values: Record<string, unknown>,
  ): Promise<IndexedDocumentRow>;
  updateIndexedDocument(
    indexedDocumentId: string,
    companyId: string,
    projectId: string,
    values: Record<string, unknown>,
  ): Promise<IndexedDocumentRow>;
  deleteIndexedDocument(
    indexedDocumentId: string,
    companyId: string,
    projectId: string,
  ): Promise<void>;
  downloadFile(path: string): Promise<Blob>;
}

export interface SafeLogger {
  error(event: string, fields: Readonly<Record<string, string>>): void;
  warn(event: string, fields: Readonly<Record<string, string>>): void;
}

export interface ProjectAdvisorFileIndexDependencies {
  getEnv(name: string): string | undefined;
  createCallerRepository(
    configuration: SupabaseConfiguration,
    authorizationHeader: string,
  ): CallerRepository;
  createAdminRepository(
    configuration: SupabaseConfiguration,
  ): AdminRepository;
  createGeminiClient(config: GeminiRestClientConfig): GeminiRestClient;
  now(): number;
  randomUuid(): string;
  logger: SafeLogger;
}

interface BearerCredential {
  authorizationHeader: string;
  token: string;
}

interface ResponseErrorBody {
  error: string;
  code: string;
  retryable: boolean;
}

export class ProjectAdvisorFileIndexError extends Error {
  readonly status: number;
  readonly code: string;
  readonly publicMessage: string;
  readonly retryable: boolean;

  constructor(options: {
    status: number;
    code: string;
    publicMessage: string;
    retryable?: boolean;
  }) {
    super(options.publicMessage);
    this.name = "ProjectAdvisorFileIndexError";
    this.status = options.status;
    this.code = options.code;
    this.publicMessage = options.publicMessage;
    this.retryable = options.retryable ?? false;
    Object.setPrototypeOf(this, ProjectAdvisorFileIndexError.prototype);
  }
}

function databaseError(): ProjectAdvisorFileIndexError {
  return new ProjectAdvisorFileIndexError({
    status: 500,
    code: "DATABASE_ERROR",
    publicMessage: "The document index could not be updated.",
    retryable: true,
  });
}

function dataIntegrityError(): ProjectAdvisorFileIndexError {
  return new ProjectAdvisorFileIndexError({
    status: 500,
    code: "DATA_INTEGRITY_ERROR",
    publicMessage: "The document index contains invalid state.",
  });
}

function createDefaultCallerRepository(
  configuration: SupabaseConfiguration,
  authorizationHeader: string,
): CallerRepository {
  const client = createClient(
    configuration.supabaseUrl,
    configuration.anonKey,
    {
      global: {
        headers: {
          Authorization: authorizationHeader,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return {
    async authenticate(token: string): Promise<boolean> {
      const {
        data: { user },
        error,
      } = await client.auth.getUser(token);
      return error === null && user !== null;
    },

    async getCommunicationDocument(
      communicationDocumentId: string,
    ): Promise<CommunicationDocumentRow | null> {
      const { data, error } = await client
        .from("communication_documents")
        .select(COMMUNICATION_DOCUMENT_COLUMNS)
        .eq("id", communicationDocumentId)
        .maybeSingle();

      if (error !== null) {
        throw databaseError();
      }

      return data as unknown as CommunicationDocumentRow | null;
    },

    async getIndexedDocument(
      communicationDocumentId: string,
      sourceKind: SourceKind,
    ): Promise<IndexedDocumentRow | null> {
      const { data, error } = await client
        .from("project_advisor_indexed_documents")
        .select(INDEXED_DOCUMENT_COLUMNS)
        .eq("communication_document_id", communicationDocumentId)
        .eq("source_kind", sourceKind)
        .maybeSingle();

      if (error !== null) {
        throw databaseError();
      }

      return data as unknown as IndexedDocumentRow | null;
    },

    async verifyProjectAdvisorAccess(
      companyId: string,
      projectId: string | null,
    ): Promise<boolean> {
      const { data, error } = await client.rpc("verify_project_advisor_access", {
        co_id: companyId,
        proj_id: projectId,
      });

      if (error !== null) {
        return false;
      }

      return data === true;
    },

    async getBillingEntitlement(
      companyId: string,
    ): Promise<{ can_write: boolean } | null> {
      const { data, error } = await client.rpc(
        "get_company_billing_entitlement",
        { p_company_id: companyId },
      );

      if (error !== null || data === null) {
        return null;
      }

      const entitlement = Array.isArray(data) ? data[0] : data;
      if (typeof entitlement !== "object" || entitlement === null) {
        return null;
      }

      return {
        can_write: entitlement.can_write === true,
      };
    },
  };
}

function createDefaultAdminRepository(
  configuration: SupabaseConfiguration,
): AdminRepository {
  const client = createClient(
    configuration.supabaseUrl,
    configuration.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  async function getIndexedDocument(
    companyId: string,
    projectId: string,
    communicationDocumentId: string,
    sourceKind: SourceKind,
  ): Promise<IndexedDocumentRow | null> {
    const { data, error } = await client
      .from("project_advisor_indexed_documents")
      .select(INDEXED_DOCUMENT_COLUMNS)
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .eq("communication_document_id", communicationDocumentId)
      .eq("source_kind", sourceKind)
      .maybeSingle();

    if (error !== null) {
      throw databaseError();
    }

    return data as unknown as IndexedDocumentRow | null;
  }

  return {
    async getStore(
      companyId: string,
      projectId: string,
    ): Promise<FileSearchStoreRow | null> {
      const { data, error } = await client
        .from("project_advisor_file_search_stores")
        .select(STORE_COLUMNS)
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (error !== null) {
        throw databaseError();
      }

      return data as unknown as FileSearchStoreRow | null;
    },

    async saveStore(
      values: Record<string, unknown>,
    ): Promise<FileSearchStoreRow> {
      const { data, error } = await client
        .from("project_advisor_file_search_stores")
        .upsert(values, { onConflict: "company_id,project_id" })
        .select(STORE_COLUMNS)
        .single();

      if (error !== null || data === null) {
        throw databaseError();
      }

      return data as unknown as FileSearchStoreRow;
    },

    async updateStore(
      storeId: string,
      companyId: string,
      projectId: string,
      values: Record<string, unknown>,
    ): Promise<FileSearchStoreRow> {
      const { data, error } = await client
        .from("project_advisor_file_search_stores")
        .update(values)
        .eq("id", storeId)
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .select(STORE_COLUMNS)
        .single();

      if (error !== null || data === null) {
        throw databaseError();
      }

      return data as unknown as FileSearchStoreRow;
    },

    getIndexedDocument,

    async saveIndexedDocument(
      values: Record<string, unknown>,
    ): Promise<IndexedDocumentRow> {
      const companyId = values.company_id;
      const projectId = values.project_id;
      const communicationDocumentId = values.communication_document_id;
      const sourceKind = values.source_kind;

      if (
        typeof companyId !== "string" ||
        typeof projectId !== "string" ||
        typeof communicationDocumentId !== "string" ||
        (sourceKind !== "uploaded" &&
          sourceKind !== "signed" &&
          sourceKind !== "generated")
      ) {
        throw dataIntegrityError();
      }

      const existing = await getIndexedDocument(
        companyId,
        projectId,
        communicationDocumentId,
        sourceKind,
      );

      const query = existing === null
        ? client
          .from("project_advisor_indexed_documents")
          .insert(values)
        : client
          .from("project_advisor_indexed_documents")
          .update(values)
          .eq("id", existing.id)
          .eq("company_id", companyId)
          .eq("project_id", projectId);

      const { data, error } = await query
        .select(INDEXED_DOCUMENT_COLUMNS)
        .single();

      if (error !== null || data === null) {
        throw databaseError();
      }

      return data as unknown as IndexedDocumentRow;
    },

    async updateIndexedDocument(
      indexedDocumentId: string,
      companyId: string,
      projectId: string,
      values: Record<string, unknown>,
    ): Promise<IndexedDocumentRow> {
      const { data, error } = await client
        .from("project_advisor_indexed_documents")
        .update(values)
        .eq("id", indexedDocumentId)
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .select(INDEXED_DOCUMENT_COLUMNS)
        .single();

      if (error !== null || data === null) {
        throw databaseError();
      }

      return data as unknown as IndexedDocumentRow;
    },

    async deleteIndexedDocument(
      indexedDocumentId: string,
      companyId: string,
      projectId: string,
    ): Promise<void> {
      const { error } = await client
        .from("project_advisor_indexed_documents")
        .delete()
        .eq("id", indexedDocumentId)
        .eq("company_id", companyId)
        .eq("project_id", projectId);

      if (error !== null) {
        throw databaseError();
      }
    },

    async downloadFile(path: string): Promise<Blob> {
      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .download(path);

      if (error !== null || data === null) {
        throw new ProjectAdvisorFileIndexError({
          status: 422,
          code: "SOURCE_FILE_UNAVAILABLE",
          publicMessage: "The source file could not be loaded.",
          retryable: true,
        });
      }

      return data;
    },
  };
}

const defaultLogger: SafeLogger = {
  error(event, fields): void {
    console.error(event, fields);
  },
  warn(event, fields): void {
    console.warn(event, fields);
  },
};

function defaultEnvironmentReader(name: string): string | undefined {
  const runtime = (
    globalThis as typeof globalThis & {
      Deno?: { env?: { get(name: string): string | undefined } };
    }
  ).Deno;
  return runtime?.env?.get(name);
}

const defaultDependencies: ProjectAdvisorFileIndexDependencies = {
  getEnv: defaultEnvironmentReader,
  createCallerRepository: createDefaultCallerRepository,
  createAdminRepository: createDefaultAdminRepository,
  createGeminiClient: createGeminiRestClient,
  now: () => Date.now(),
  randomUuid: () => crypto.randomUUID(),
  logger: defaultLogger,
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSafeConfigurationValue(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !CONTROL_CHARACTER_PATTERN.test(value);
}

function readConfiguration(
  dependencies: ProjectAdvisorFileIndexDependencies,
): SupabaseConfiguration {
  const supabaseUrl = dependencies.getEnv("SUPABASE_URL");
  const anonKey = dependencies.getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = dependencies.getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = dependencies.getEnv("GEMINI_API_KEY");

  if (
    !hasSafeConfigurationValue(supabaseUrl) ||
    !hasSafeConfigurationValue(anonKey) ||
    !hasSafeConfigurationValue(serviceRoleKey) ||
    !hasSafeConfigurationValue(geminiApiKey)
  ) {
    throw new ProjectAdvisorFileIndexError({
      status: 500,
      code: "SERVER_CONFIGURATION_ERROR",
      publicMessage: "The document indexing service is not configured.",
    });
  }

  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new ProjectAdvisorFileIndexError({
      status: 500,
      code: "SERVER_CONFIGURATION_ERROR",
      publicMessage: "The document indexing service is not configured.",
    });
  }

  if (
    (parsedSupabaseUrl.protocol !== "https:" &&
      parsedSupabaseUrl.protocol !== "http:") ||
    parsedSupabaseUrl.username !== "" ||
    parsedSupabaseUrl.password !== "" ||
    parsedSupabaseUrl.hash !== ""
  ) {
    throw new ProjectAdvisorFileIndexError({
      status: 500,
      code: "SERVER_CONFIGURATION_ERROR",
      publicMessage: "The document indexing service is not configured.",
    });
  }

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    geminiApiKey,
  };
}

function parseBearerCredential(
  value: string | null,
): BearerCredential | null {
  if (
    value === null ||
    value.length > 8192 ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return null;
  }

  const match = /^Bearer[ \t]+([^ \t]+)$/i.exec(value);
  if (match === null || match[1].length === 0) {
    return null;
  }

  return {
    authorizationHeader: `Bearer ${match[1]}`,
    token: match[1],
  };
}

function jsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function responseForError(
  error: unknown,
  dependencies: ProjectAdvisorFileIndexDependencies,
): Response {
  const mapped = mapToPublicError(error);
  dependencies.logger.error("project_advisor_file_index_failed", {
    code: mapped.code,
  });

  const body: ResponseErrorBody = {
    error: mapped.publicMessage,
    code: mapped.code,
    retryable: mapped.retryable,
  };
  return jsonResponse(body, mapped.status);
}

function mapToPublicError(error: unknown): ProjectAdvisorFileIndexError {
  if (error instanceof ProjectAdvisorFileIndexError) {
    return error;
  }

  if (error instanceof GeminiRestError) {
    if (
      error.code === "GEMINI_REQUEST_TIMEOUT" ||
      error.code === "GEMINI_OPERATION_TIMEOUT"
    ) {
      return new ProjectAdvisorFileIndexError({
        status: 504,
        code: "GEMINI_TIMEOUT",
        publicMessage: "The document indexing provider timed out.",
        retryable: true,
      });
    }

    return new ProjectAdvisorFileIndexError({
      status: 502,
      code: "GEMINI_REQUEST_FAILED",
      publicMessage:
        "The document indexing provider could not complete the request.",
      retryable: error.isRetryable,
    });
  }

  return new ProjectAdvisorFileIndexError({
    status: 500,
    code: "INTERNAL_ERROR",
    publicMessage: "The document indexing request could not be completed.",
    retryable: true,
  });
}

function safeFailureCode(error: unknown): string {
  if (error instanceof GeminiRestError) {
    return error.code;
  }
  if (error instanceof ProjectAdvisorFileIndexError) {
    return error.code;
  }
  return "INTERNAL_ERROR";
}

function getNow(
  dependencies: ProjectAdvisorFileIndexDependencies,
): number {
  const value = dependencies.now();
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new ProjectAdvisorFileIndexError({
      status: 500,
      code: "CLOCK_ERROR",
      publicMessage: "The document indexing request could not be completed.",
    });
  }
  return value;
}

function nowIso(
  dependencies: ProjectAdvisorFileIndexDependencies,
): string {
  return new Date(getNow(dependencies)).toISOString();
}

function assertCommunicationDocument(
  value: CommunicationDocumentRow,
  communicationDocumentId: string,
): CommunicationDocumentRow {
  if (
    !isRecord(value) ||
    value.id !== communicationDocumentId ||
    !isUuid(value.company_id) ||
    !isUuid(value.project_id)
  ) {
    throw dataIntegrityError();
  }
  return value;
}

function assertIndexedDocument(
  value: IndexedDocumentRow,
  expected: {
    companyId?: string;
    projectId?: string;
    communicationDocumentId: string;
    sourceKind: SourceKind;
  },
): IndexedDocumentRow {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !isUuid(value.company_id) ||
    !isUuid(value.project_id) ||
    value.communication_document_id !== expected.communicationDocumentId ||
    value.source_kind !== expected.sourceKind ||
    typeof value.status !== "string" ||
    (expected.companyId !== undefined &&
      value.company_id !== expected.companyId) ||
    (expected.projectId !== undefined &&
      value.project_id !== expected.projectId)
  ) {
    throw dataIntegrityError();
  }
  return value;
}

function assertStore(
  value: FileSearchStoreRow,
  companyId: string,
  projectId: string,
): FileSearchStoreRow {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    value.company_id !== companyId ||
    value.project_id !== projectId ||
    typeof value.status !== "string" ||
    (value.provider_store_name !== undefined &&
      value.provider_store_name !== null &&
      typeof value.provider_store_name !== "string")
  ) {
    throw dataIntegrityError();
  }
  return value;
}

function isDocumentInStore(
  documentName: unknown,
  storeName: string,
): documentName is string {
  if (typeof documentName !== "string") {
    return false;
  }
  const prefix = `${storeName}/documents/`;
  return documentName.startsWith(prefix) &&
    DOCUMENT_ID_PATTERN.test(documentName.slice(prefix.length));
}

function metadataValue(
  document: GeminiDocument,
  key: string,
): string | undefined {
  return document.customMetadata?.find((entry) => entry.key === key)
    ?.stringValue;
}

async function bestEffortStoreFailure(
  admin: AdminRepository,
  storeId: string,
  companyId: string,
  projectId: string,
  error: unknown,
  dependencies: ProjectAdvisorFileIndexDependencies,
): Promise<void> {
  try {
    await admin.updateStore(storeId, companyId, projectId, {
      status: "failed",
      last_error: safeFailureCode(error),
      updated_at: nowIso(dependencies),
    });
  } catch {
    dependencies.logger.warn("project_advisor_store_failure_not_saved", {
      code: "DATABASE_ERROR",
    });
  }
}

async function getOrCreateProjectStore(
  admin: AdminRepository,
  gemini: GeminiRestClient,
  companyId: string,
  projectId: string,
  dependencies: ProjectAdvisorFileIndexDependencies,
): Promise<FileSearchStoreRow> {
  const existingValue = await admin.getStore(companyId, projectId);
  const existing = existingValue === null
    ? null
    : assertStore(existingValue, companyId, projectId);

  if (
    existing?.provider_store_name !== undefined &&
    existing.provider_store_name !== null
  ) {
    if (!isValidStoreName(existing.provider_store_name)) {
      throw dataIntegrityError();
    }

    const remoteStore = await gemini.getFileSearchStore(
      existing.provider_store_name,
    );
    if (remoteStore !== null) {
      if (existing.status === "ready") {
        return existing;
      }

      const recovered = await admin.updateStore(
        existing.id,
        companyId,
        projectId,
        {
          provider_store_name: remoteStore.name,
          status: "ready",
          last_error: null,
          updated_at: nowIso(dependencies),
        },
      );
      return assertStore(recovered, companyId, projectId);
    }
  }

  if (existing?.status === "creating") {
    const updatedAt = typeof existing.updated_at === "string"
      ? Date.parse(existing.updated_at)
      : Number.NaN;
    if (
      Number.isFinite(updatedAt) &&
      getNow(dependencies) - updatedAt < STORE_CREATION_LEASE_MS
    ) {
      throw new ProjectAdvisorFileIndexError({
        status: 409,
        code: "STORE_CREATION_IN_PROGRESS",
        publicMessage: "The project document index is being prepared.",
        retryable: true,
      });
    }
  }

  const storeId = existing?.id ?? dependencies.randomUuid();
  if (!isUuid(storeId)) {
    throw dataIntegrityError();
  }

  const displayName = `PM Project Store - ${projectId}`;
  let remoteStore: GeminiFileSearchStore | null = null;

  try {
    const creating = await admin.saveStore({
      id: storeId,
      company_id: companyId,
      project_id: projectId,
      provider: "gemini_file_search",
      provider_store_name: null,
      display_name: displayName,
      embedding_model: "models/gemini-embedding-2",
      status: "creating",
      last_error: null,
      updated_at: nowIso(dependencies),
    });
    assertStore(creating, companyId, projectId);

    remoteStore = await gemini.createFileSearchStore(displayName);

    const ready = await admin.updateStore(
      storeId,
      companyId,
      projectId,
      {
        provider_store_name: remoteStore.name,
        status: "ready",
        last_error: null,
        updated_at: nowIso(dependencies),
      },
    );
    return assertStore(ready, companyId, projectId);
  } catch (error: unknown) {
    if (remoteStore !== null) {
      try {
        await gemini.deleteFileSearchStore(remoteStore.name);
      } catch {
        dependencies.logger.warn(
          "project_advisor_orphan_store_cleanup_failed",
          {
            code: "GEMINI_REQUEST_FAILED",
          },
        );
      }
    }

    await bestEffortStoreFailure(
      admin,
      storeId,
      companyId,
      projectId,
      error,
      dependencies,
    );
    throw error;
  }
}

function validationError(
  code: string,
  publicMessage: string,
  status = 422,
): ProjectAdvisorFileIndexError {
  return new ProjectAdvisorFileIndexError({
    status,
    code,
    publicMessage,
  });
}

async function bestEffortIndexedFailure(
  admin: AdminRepository,
  registry: IndexedDocumentRow,
  error: unknown,
  dependencies: ProjectAdvisorFileIndexDependencies,
): Promise<void> {
  try {
    await admin.updateIndexedDocument(
      registry.id,
      registry.company_id,
      registry.project_id,
      {
        status: "failed",
        error_message: safeFailureCode(error),
        updated_at: nowIso(dependencies),
      },
    );
  } catch {
    dependencies.logger.warn("project_advisor_index_failure_not_saved", {
      code: "DATABASE_ERROR",
    });
  }
}

async function reconcileSupersededDocuments(
  gemini: GeminiRestClient,
  storeName: string,
  companyId: string,
  projectId: string,
  communicationDocumentId: string,
  sourceKind: SourceKind,
  currentFingerprint: string,
  currentDocumentName: string,
  dependencies: ProjectAdvisorFileIndexDependencies,
): Promise<void> {
  try {
    const documents = await gemini.listAllDocuments(storeName);
    for (const document of documents) {
      if (
        document.name === currentDocumentName ||
        metadataValue(document, "pm_company_id") !== companyId ||
        metadataValue(document, "pm_project_id") !== projectId ||
        metadataValue(document, "pm_document_id") !==
          communicationDocumentId ||
        metadataValue(document, "pm_source_kind") !== sourceKind ||
        metadataValue(document, "pm_fingerprint") === currentFingerprint
      ) {
        continue;
      }

      await gemini.deleteDocument(document.name);
    }
  } catch (error: unknown) {
    dependencies.logger.warn("project_advisor_reconciliation_failed", {
      code: safeFailureCode(error),
    });
  }
}

async function handleIndexAction(
  admin: AdminRepository,
  gemini: GeminiRestClient,
  communicationDocument: CommunicationDocumentRow,
  communicationDocumentId: string,
  sourceKind: SourceKind,
  dependencies: ProjectAdvisorFileIndexDependencies,
): Promise<Response> {
  const companyId = communicationDocument.company_id;
  const projectId = communicationDocument.project_id;
  const mapped = mapSourceKindToDocumentFields(
    communicationDocument,
    sourceKind,
  );

  if (mapped.error !== undefined) {
    throw validationError(
      "INVALID_SOURCE",
      "The selected source file is invalid.",
      400,
    );
  }

  const pathValidation = validateStoragePath(
    mapped.filePath,
    companyId,
    projectId,
  );
  if (!pathValidation.isValid || mapped.filePath === null) {
    throw validationError(
      "INVALID_STORAGE_PATH",
      "The selected source file path is invalid.",
      400,
    );
  }

  const candidateName = mapped.fileName ?? "document";
  const format = getMimeTypeAndAllowlistCheck(
    candidateName,
    mapped.fileType,
  );

  if (format.error === "MIME_MISMATCH") {
    throw validationError(
      "MIME_MISMATCH",
      "The source file type does not match its filename.",
      400,
    );
  }

  const declaredSize = validateFileSize(mapped.fileSize);
  if (!declaredSize.isValid) {
    throw validationError(
      declaredSize.error ?? "INVALID_FILE_SIZE",
      "The source file size is invalid.",
      declaredSize.error === "FILE_TOO_LARGE" ? 413 : 400,
    );
  }

  const safeName = sanitizeFilename(
    candidateName,
    communicationDocument.document_title,
    format.extension,
  );

  if (!format.isSupported) {
    const store = await getOrCreateProjectStore(
      admin,
      gemini,
      companyId,
      projectId,
      dependencies,
    );
    const unsupported = await admin.saveIndexedDocument({
      company_id: companyId,
      project_id: projectId,
      store_id: store.id,
      communication_document_id: communicationDocumentId,
      source_kind: sourceKind,
      source_storage_path: mapped.filePath,
      source_file_name: safeName,
      source_mime_type: null,
      source_file_size: declaredSize.bytes ?? null,
      status: "unsupported",
      error_message: "UNSUPPORTED_FORMAT",
      updated_at: nowIso(dependencies),
    });
    assertIndexedDocument(unsupported, {
      companyId,
      projectId,
      communicationDocumentId,
      sourceKind,
    });

    return jsonResponse({
      success: true,
      status: "unsupported",
      message: "This file format is not supported for document indexing.",
    }, 200);
  }

  const blob = await admin.downloadFile(mapped.filePath);
  const bytes = await blob.arrayBuffer();

  const actualSize = validateFileSize(mapped.fileSize, bytes.byteLength);
  if (!actualSize.isValid) {
    throw validationError(
      actualSize.error ?? "INVALID_FILE_SIZE",
      "The source file size is invalid.",
      actualSize.error === "FILE_TOO_LARGE" ? 413 : 400,
    );
  }

  const signature = validateBinarySignature(bytes, format.extension);
  if (!signature.isValid) {
    throw validationError(
      signature.error ?? "INVALID_FILE_SIGNATURE",
      "The source file content is invalid.",
      400,
    );
  }

  if (
    format.extension === "png" ||
    format.extension === "jpg" ||
    format.extension === "jpeg"
  ) {
    const dimensions = parseImageDimensions(bytes, format.extension);
    if (!dimensions.isValid) {
      throw validationError(
        dimensions.error ?? "INVALID_IMAGE_DIMENSIONS",
        "The source image is invalid.",
        400,
      );
    }
  }

  const fingerprint = await computeSha256(bytes);
  const store = await getOrCreateProjectStore(
    admin,
    gemini,
    companyId,
    projectId,
    dependencies,
  );
  const storeName = store.provider_store_name;
  if (!isValidStoreName(storeName)) {
    throw dataIntegrityError();
  }

  const existingValue = await admin.getIndexedDocument(
    companyId,
    projectId,
    communicationDocumentId,
    sourceKind,
  );
  const existing = existingValue === null
    ? null
    : assertIndexedDocument(existingValue, {
      companyId,
      projectId,
      communicationDocumentId,
      sourceKind,
    });

  if (
    existing?.status === "ready" &&
    existing.source_fingerprint === fingerprint &&
    isDocumentInStore(existing.provider_document_name, storeName)
  ) {
    const remoteDocument = await gemini.getDocument(
      existing.provider_document_name,
    );
    if (
      remoteDocument !== null &&
      remoteDocument.state !== "STATE_FAILED"
    ) {
      return jsonResponse({
        success: true,
        status: "ready",
        action: "noop",
        providerDocumentName: remoteDocument.name,
        indexedAt: existing.indexed_at ?? null,
      }, 200);
    }
  }

  const registryValue = await admin.saveIndexedDocument({
    company_id: companyId,
    project_id: projectId,
    store_id: store.id,
    communication_document_id: communicationDocumentId,
    source_kind: sourceKind,
    source_storage_path: mapped.filePath,
    source_file_name: safeName,
    source_mime_type: format.mimeType,
    source_file_size: bytes.byteLength,
    source_fingerprint: fingerprint,
    status: "processing",
    error_message: null,
    updated_at: nowIso(dependencies),
  });
  const registry = assertIndexedDocument(registryValue, {
    companyId,
    projectId,
    communicationDocumentId,
    sourceKind,
  });

  let providerDocumentName: string | null = null;
  try {
    const customMetadata: readonly GeminiCustomMetadata[] = [
      { key: "pm_company_id", stringValue: companyId },
      { key: "pm_project_id", stringValue: projectId },
      {
        key: "pm_document_id",
        stringValue: communicationDocumentId,
      },
      { key: "pm_source_kind", stringValue: sourceKind },
      { key: "pm_fingerprint", stringValue: fingerprint },
    ];

    const initialOperation = await gemini.uploadToFileSearchStore({
      storeName,
      displayName: safeName,
      mimeType: format.mimeType,
      bytes,
      customMetadata,
    });
    const completedOperation = await gemini.waitForUploadOperation(
      initialOperation,
    );
    providerDocumentName = completedOperation.response?.documentName ?? null;

    if (!isDocumentInStore(providerDocumentName, storeName)) {
      throw dataIntegrityError();
    }

    const indexedAt = nowIso(dependencies);
    const readyValue = await admin.updateIndexedDocument(
      registry.id,
      companyId,
      projectId,
      {
        status: "ready",
        provider_document_name: providerDocumentName,
        indexed_at: indexedAt,
        error_message: null,
        updated_at: indexedAt,
      },
    );
    assertIndexedDocument(readyValue, {
      companyId,
      projectId,
      communicationDocumentId,
      sourceKind,
    });

    await reconcileSupersededDocuments(
      gemini,
      storeName,
      companyId,
      projectId,
      communicationDocumentId,
      sourceKind,
      fingerprint,
      providerDocumentName,
      dependencies,
    );

    return jsonResponse({
      success: true,
      status: "ready",
      providerDocumentName,
      indexedAt,
    }, 200);
  } catch (error: unknown) {
    if (providerDocumentName !== null) {
      try {
        await gemini.deleteDocument(providerDocumentName);
      } catch {
        dependencies.logger.warn(
          "project_advisor_orphan_document_cleanup_failed",
          { code: "GEMINI_REQUEST_FAILED" },
        );
      }
    }

    await bestEffortIndexedFailure(
      admin,
      registry,
      error,
      dependencies,
    );
    throw error;
  }
}

async function markRemoteDeleteFailure(
  admin: AdminRepository,
  registry: IndexedDocumentRow,
  error: unknown,
  dependencies: ProjectAdvisorFileIndexDependencies,
): Promise<void> {
  try {
    await admin.updateIndexedDocument(
      registry.id,
      registry.company_id,
      registry.project_id,
      {
        status: "failed",
        error_message: safeFailureCode(error),
        updated_at: nowIso(dependencies),
      },
    );
  } catch {
    dependencies.logger.warn("project_advisor_delete_failure_not_saved", {
      code: "DATABASE_ERROR",
    });
  }
}

async function deleteRemoteCopies(
  admin: AdminRepository,
  gemini: GeminiRestClient,
  registry: IndexedDocumentRow,
): Promise<void> {
  const storeValue = await admin.getStore(
    registry.company_id,
    registry.project_id,
  );

  if (storeValue === null) {
    if (
      registry.provider_document_name === null ||
      registry.provider_document_name === undefined
    ) {
      return;
    }
    throw dataIntegrityError();
  }

  const store = assertStore(
    storeValue,
    registry.company_id,
    registry.project_id,
  );
  const storeName = store.provider_store_name;

  if (storeName === null || storeName === undefined) {
    if (
      registry.provider_document_name === null ||
      registry.provider_document_name === undefined
    ) {
      return;
    }
    throw dataIntegrityError();
  }

  if (!isValidStoreName(storeName)) {
    throw dataIntegrityError();
  }

  const remoteStore = await gemini.getFileSearchStore(storeName);
  if (remoteStore === null) {
    return;
  }

  const documents = await gemini.listAllDocuments(storeName);
  const namesToDelete = new Set<string>();

  for (const document of documents) {
    if (
      metadataValue(document, "pm_company_id") === registry.company_id &&
      metadataValue(document, "pm_project_id") === registry.project_id &&
      metadataValue(document, "pm_document_id") ===
        registry.communication_document_id &&
      metadataValue(document, "pm_source_kind") === registry.source_kind
    ) {
      namesToDelete.add(document.name);
    }
  }

  if (
    registry.provider_document_name !== null &&
    registry.provider_document_name !== undefined
  ) {
    if (
      !isDocumentInStore(registry.provider_document_name, storeName)
    ) {
      throw dataIntegrityError();
    }
    namesToDelete.add(registry.provider_document_name);
  }

  for (const documentName of namesToDelete) {
    await gemini.deleteDocument(documentName);
  }
}

async function handleDeleteAction(
  admin: AdminRepository,
  gemini: GeminiRestClient,
  companyId: string,
  projectId: string,
  communicationDocumentId: string,
  sourceKind: SourceKind,
  dependencies: ProjectAdvisorFileIndexDependencies,
): Promise<Response> {
  const registryValue = await admin.getIndexedDocument(
    companyId,
    projectId,
    communicationDocumentId,
    sourceKind,
  );

  if (registryValue === null) {
    return jsonResponse({
      success: true,
      message: "No indexed document was found.",
    }, 200);
  }

  const registry = assertIndexedDocument(registryValue, {
    companyId,
    projectId,
    communicationDocumentId,
    sourceKind,
  });

  const deletingValue = await admin.updateIndexedDocument(
    registry.id,
    companyId,
    projectId,
    {
      status: "deleting",
      error_message: null,
      updated_at: nowIso(dependencies),
    },
  );
  assertIndexedDocument(deletingValue, {
    companyId,
    projectId,
    communicationDocumentId,
    sourceKind,
  });

  try {
    await deleteRemoteCopies(
      admin,
      gemini,
      registry,
    );
  } catch (error: unknown) {
    await markRemoteDeleteFailure(
      admin,
      registry,
      error,
      dependencies,
    );
    throw new ProjectAdvisorFileIndexError({
      status: 502,
      code: "REMOTE_DELETE_FAILED",
      publicMessage:
        "The remote document could not be deleted. The local record was retained for retry.",
      retryable: true,
    });
  }

  await admin.deleteIndexedDocument(
    registry.id,
    companyId,
    projectId,
  );

  return jsonResponse({
    success: true,
    message:
      "Document indexing record and remote search copy deleted successfully.",
  }, 200);
}

async function parseRequestJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type");
  const mediaType = contentType?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== undefined && mediaType !== "application/json") {
    throw new ProjectAdvisorFileIndexError({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
      publicMessage: "The request body must be JSON.",
    });
  }

  try {
    return await request.json();
  } catch {
    throw new ProjectAdvisorFileIndexError({
      status: 400,
      code: "INVALID_JSON",
      publicMessage: "The request body is invalid.",
    });
  }
}

export function createProjectAdvisorFileIndexHandler(
  overrides: Partial<ProjectAdvisorFileIndexDependencies> = {},
): (request: Request) => Promise<Response> {
  const dependencies: ProjectAdvisorFileIndexDependencies = {
    ...defaultDependencies,
    ...overrides,
  };

  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({
        error: "Method not allowed.",
        code: "METHOD_NOT_ALLOWED",
        retryable: false,
      }, 405);
    }

    try {
      const configuration = readConfiguration(dependencies);
      const credential = parseBearerCredential(
        request.headers.get("authorization"),
      );
      if (credential === null) {
        throw new ProjectAdvisorFileIndexError({
          status: 401,
          code: "AUTHENTICATION_REQUIRED",
          publicMessage: "Authentication is required.",
        });
      }

      const caller = dependencies.createCallerRepository(
        configuration,
        credential.authorizationHeader,
      );
      if (!await caller.authenticate(credential.token)) {
        throw new ProjectAdvisorFileIndexError({
          status: 401,
          code: "INVALID_AUTHENTICATION",
          publicMessage: "Authentication is invalid or expired.",
        });
      }

      const body = await parseRequestJson(request);
      const validation = validateRequestPayload(body);
      if (!validation.isValid || validation.data === undefined) {
        throw new ProjectAdvisorFileIndexError({
          status: 400,
          code: validation.error ?? "INVALID_REQUEST",
          publicMessage: "The request parameters are invalid.",
        });
      }

      const {
        action,
        communicationDocumentId,
        sourceKind,
      } = validation.data;

      const visibleCommunicationValue = await caller
        .getCommunicationDocument(communicationDocumentId);
      const visibleCommunication = visibleCommunicationValue === null
        ? null
        : assertCommunicationDocument(
          visibleCommunicationValue,
          communicationDocumentId,
        );

      const visibleIndexedValue = action === "delete"
        ? await caller.getIndexedDocument(
          communicationDocumentId,
          sourceKind,
        )
        : null;
      const visibleIndexed = visibleIndexedValue === null
        ? null
        : assertIndexedDocument(visibleIndexedValue, {
          communicationDocumentId,
          sourceKind,
        });

      if (action === "index" && visibleCommunication === null) {
        throw new ProjectAdvisorFileIndexError({
          status: 404,
          code: "DOCUMENT_NOT_FOUND",
          publicMessage: "Document not found or access denied.",
        });
      }

      if (
        action === "delete" &&
        visibleCommunication === null &&
        visibleIndexed === null
      ) {
        throw new ProjectAdvisorFileIndexError({
          status: 404,
          code: "DOCUMENT_NOT_FOUND",
          publicMessage: "Document not found or access denied.",
        });
      }

      if (
        visibleCommunication !== null &&
        visibleIndexed !== null &&
        (visibleCommunication.company_id !== visibleIndexed.company_id ||
          visibleCommunication.project_id !== visibleIndexed.project_id)
      ) {
        throw dataIntegrityError();
      }

      const companyId = visibleCommunication?.company_id ??
        visibleIndexed?.company_id;
      const projectId = visibleCommunication?.project_id ??
        visibleIndexed?.project_id;
      if (!isUuid(companyId) || !isUuid(projectId)) {
        throw dataIntegrityError();
      }

      // Prior to creating the elevated service-role repository or initiating
      // operational writes, verify the caller's active membership, resource company,
      // applicable role permission, and server billing entitlement via user-scoped RPCs.
      const hasAdvisorAccess = await caller.verifyProjectAdvisorAccess(
        companyId,
        projectId,
      );
      if (!hasAdvisorAccess) {
        throw new ProjectAdvisorFileIndexError({
          status: 403,
          code: "FORBIDDEN",
          publicMessage:
            "Access denied. You do not have authorised Project Advisor access for this company or project.",
          retryable: false,
        });
      }

      const entitlement = await caller.getBillingEntitlement(companyId);
      if (entitlement === null || entitlement.can_write !== true) {
        throw new ProjectAdvisorFileIndexError({
          status: 403,
          code: "BILLING_READ_ONLY",
          publicMessage:
            "Your company is in read-only mode. Update billing to continue.",
          retryable: false,
        });
      }

      // The service-role repository is intentionally created only after
      // caller authentication, resource verification, Project Advisor access,
      // and server billing entitlement have succeeded.
      const admin = dependencies.createAdminRepository(configuration);
      const gemini = dependencies.createGeminiClient({
        apiKey: configuration.geminiApiKey,
      });

      if (action === "delete") {
        return await handleDeleteAction(
          admin,
          gemini,
          companyId,
          projectId,
          communicationDocumentId,
          sourceKind,
          dependencies,
        );
      }

      return await handleIndexAction(
        admin,
        gemini,
        visibleCommunication as CommunicationDocumentRow,
        communicationDocumentId,
        sourceKind,
        dependencies,
      );
    } catch (error: unknown) {
      return responseForError(error, dependencies);
    }
  };
}

const runtime = (
  globalThis as typeof globalThis & {
    Deno?: {
      serve(handler: (request: Request) => Response | Promise<Response>): void;
    };
  }
).Deno;
const moduleMetadata = import.meta as ImportMeta & { main?: boolean };

if (moduleMetadata.main && runtime !== undefined) {
  runtime.serve(createProjectAdvisorFileIndexHandler());
}
