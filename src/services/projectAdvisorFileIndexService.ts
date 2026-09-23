import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from "../lib/supabase";

export type ProjectAdvisorSourceKind =
  | "uploaded"
  | "signed"
  | "generated";

export const PROJECT_ADVISOR_SOURCE_KINDS = [
  "uploaded",
  "signed",
  "generated",
] as const;

export interface ProjectAdvisorFileIndexResult {
  status: "ready" | "unsupported" | "noop" | "deleted";
  indexedDocumentId?: string;
  providerDocumentName?: string;
  fileSearchStoreId?: string;
  message?: string;
}

export class ProjectAdvisorFileIndexServiceError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super("An error occurred during file index synchronisation.");
    this.name = "ProjectAdvisorFileIndexServiceError";
    this.code = code;
    this.retryable = retryable;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_RESOURCE_VALUE_PATTERN = /^[A-Za-z0-9._~/-]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;
const MAX_PUBLIC_MESSAGE_LENGTH = 500;
const MAX_RESOURCE_VALUE_LENGTH = 2_048;
const SAFE_EDGE_FUNCTION_ERROR_CODES = new Set([
  "AUTHENTICATION_REQUIRED",
  "BILLING_READ_ONLY",
  "CLOCK_ERROR",
  "DATABASE_ERROR",
  "DATA_INTEGRITY_ERROR",
  "DOCUMENT_NOT_FOUND",
  "FILE_TOO_LARGE",
  "FORBIDDEN",
  "GEMINI_REQUEST_FAILED",
  "GEMINI_TIMEOUT",
  "INTERNAL_ERROR",
  "INVALID_AUTHENTICATION",
  "INVALID_FILE_SIGNATURE",
  "INVALID_FILE_SIZE",
  "INVALID_IMAGE_DIMENSIONS",
  "INVALID_JSON",
  "INVALID_REQUEST",
  "INVALID_SOURCE",
  "INVALID_SOURCE_KIND",
  "INVALID_STORAGE_PATH",
  "INVALID_UUID",
  "METHOD_NOT_ALLOWED",
  "MIME_MISMATCH",
  "REMOTE_DELETE_FAILED",
  "SERVER_CONFIGURATION_ERROR",
  "SOURCE_FILE_UNAVAILABLE",
  "STORE_CREATION_IN_PROGRESS",
  "UNSUPPORTED_MEDIA_TYPE",
]);

interface FailureDetails {
  readonly code: string;
  readonly retryable: boolean;
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function malformedResponse(): ProjectAdvisorFileIndexServiceError {
  return new ProjectAdvisorFileIndexServiceError(
    "MALFORMED_RESPONSE",
    false,
  );
}

function isSafePublicMessage(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PUBLIC_MESSAGE_LENGTH &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value);
}

function isSafeResourceValue(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_RESOURCE_VALUE_LENGTH &&
    SAFE_RESOURCE_VALUE_PATTERN.test(value);
}

function readOptionalPublicMessage(
  value: Record<string, unknown>,
): string | undefined {
  if (!hasOwn(value, "message")) {
    return undefined;
  }

  if (!isSafePublicMessage(value.message)) {
    throw malformedResponse();
  }

  return value.message;
}

function readOptionalResourceValue(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  if (!hasOwn(value, key)) {
    return undefined;
  }

  const candidate = value[key];
  if (!isSafeResourceValue(candidate)) {
    throw malformedResponse();
  }

  return candidate;
}

function readRequiredResourceValue(
  value: Record<string, unknown>,
  key: string,
): string {
  const candidate = readOptionalResourceValue(value, key);
  if (candidate === undefined) {
    throw malformedResponse();
  }
  return candidate;
}

function validateParams(
  communicationDocumentId: string,
  sourceKind: ProjectAdvisorSourceKind,
): void {
  if (
    typeof communicationDocumentId !== "string" ||
    !UUID_PATTERN.test(communicationDocumentId)
  ) {
    throw new ProjectAdvisorFileIndexServiceError("INVALID_UUID", false);
  }

  if (!PROJECT_ADVISOR_SOURCE_KINDS.includes(sourceKind)) {
    throw new ProjectAdvisorFileIndexServiceError(
      "INVALID_SOURCE_KIND",
      false,
    );
  }
}

function parseFailureDetails(value: unknown): FailureDetails | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const code = value.code;
  if (
    typeof code !== "string" ||
    !SAFE_EDGE_FUNCTION_ERROR_CODES.has(code)
  ) {
    return undefined;
  }

  return {
    code,
    retryable: typeof value.retryable === "boolean" ? value.retryable : false,
  };
}

function readProperty(value: unknown, key: string): unknown {
  if (
    (typeof value !== "object" || value === null) &&
    typeof value !== "function"
  ) {
    return undefined;
  }

  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

async function parseFunctionErrorContext(
  error: unknown,
): Promise<FailureDetails | undefined> {
  const context = readProperty(error, "context");
  const json = readProperty(context, "json");
  if (typeof json !== "function") {
    return undefined;
  }

  try {
    const body = await Reflect.apply(json, context, []);
    return parseFailureDetails(body);
  } catch {
    return undefined;
  }
}

async function extractFailureDetails(
  data: unknown,
  error: unknown,
): Promise<FailureDetails> {
  return parseFailureDetails(data) ??
    await parseFunctionErrorContext(error) ??
    parseFailureDetails(error) ?? {
    code: "INVOCATION_FAILED",
    retryable: false,
  };
}

function parseIndexSuccess(
  data: unknown,
): ProjectAdvisorFileIndexResult {
  if (!isRecord(data) || data.success !== true) {
    throw malformedResponse();
  }

  if (data.status === "unsupported") {
    const message = readOptionalPublicMessage(data);
    if (message === undefined) {
      throw malformedResponse();
    }

    return {
      status: "unsupported",
      message,
    };
  }

  if (data.status !== "ready") {
    throw malformedResponse();
  }

  if (
    hasOwn(data, "action") &&
    data.action !== "noop"
  ) {
    throw malformedResponse();
  }

  const providerDocumentName = readRequiredResourceValue(
    data,
    "providerDocumentName",
  );
  const indexedDocumentId = readOptionalResourceValue(
    data,
    "indexedDocumentId",
  );
  const fileSearchStoreId = readOptionalResourceValue(
    data,
    "fileSearchStoreId",
  );
  const message = readOptionalPublicMessage(data);

  return {
    status: data.action === "noop" ? "noop" : "ready",
    providerDocumentName,
    indexedDocumentId,
    fileSearchStoreId,
    message,
  };
}

function parseDeleteSuccess(
  data: unknown,
): ProjectAdvisorFileIndexResult {
  if (
    !isRecord(data) ||
    data.success !== true ||
    hasOwn(data, "status") ||
    hasOwn(data, "action")
  ) {
    throw malformedResponse();
  }

  const message = readOptionalPublicMessage(data);
  if (message === undefined) {
    throw malformedResponse();
  }

  return {
    status: "deleted",
    message,
  };
}

export async function indexCommunicationDocumentSource(
  communicationDocumentId: string,
  sourceKind: ProjectAdvisorSourceKind,
): Promise<ProjectAdvisorFileIndexResult> {
  validateParams(communicationDocumentId, sourceKind);

  let response;
  try {
    response = await supabase.functions.invoke<unknown>(
      "project-advisor-file-index",
      {
        body: {
          action: "index",
          communicationDocumentId,
          sourceKind,
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof ProjectAdvisorFileIndexServiceError) {
      throw error;
    }

    const details = await extractFailureDetails(undefined, error);
    throw new ProjectAdvisorFileIndexServiceError(
      details.code,
      details.retryable,
    );
  }

  if (response.error !== null && response.error !== undefined) {
    const details = await extractFailureDetails(
      response.data,
      response.error,
    );
    throw new ProjectAdvisorFileIndexServiceError(
      details.code,
      details.retryable,
    );
  }

  return parseIndexSuccess(response.data);
}

export async function deleteCommunicationDocumentSourceIndex(
  communicationDocumentId: string,
  sourceKind: ProjectAdvisorSourceKind,
): Promise<ProjectAdvisorFileIndexResult> {
    assertOperationalAction("delete", "services/projectAdvisorFileIndexService.ts");
  validateParams(communicationDocumentId, sourceKind);

  let response;
  try {
    response = await supabase.functions.invoke<unknown>(
      "project-advisor-file-index",
      {
        body: {
          action: "delete",
          communicationDocumentId,
          sourceKind,
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof ProjectAdvisorFileIndexServiceError) {
      throw error;
    }

    const details = await extractFailureDetails(undefined, error);
    throw new ProjectAdvisorFileIndexServiceError(
      details.code,
      details.retryable,
    );
  }

  if (response.error !== null && response.error !== undefined) {
    const details = await extractFailureDetails(
      response.data,
      response.error,
    );
    throw new ProjectAdvisorFileIndexServiceError(
      details.code,
      details.retryable,
    );
  }

  return parseDeleteSuccess(response.data);
}

export async function deleteAllCommunicationDocumentSourceIndexes(
  communicationDocumentId: string,
): Promise<void> {
    assertOperationalAction("delete", "services/projectAdvisorFileIndexService.ts");
  for (const sourceKind of PROJECT_ADVISOR_SOURCE_KINDS) {
    await deleteCommunicationDocumentSourceIndex(
      communicationDocumentId,
      sourceKind,
    );
  }
}