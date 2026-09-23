// Gemini File Search REST Client Core & Store Management
// Pure TypeScript REST implementation for Deno Edge Functions

import { MAX_FILE_SIZE_BYTES } from "./helpers.ts";

export const GEMINI_API_ORIGIN = "https://generativelanguage.googleapis.com";

export const GEMINI_API_VERSION = "v1beta";

export const GEMINI_EMBEDDING_MODEL = "models/gemini-embedding-2";

export type GeminiRestErrorCode =
  | "INVALID_API_KEY"
  | "INVALID_ARGUMENT"
  | "INVALID_RESOURCE_NAME"
  | "INVALID_METADATA"
  | "INVALID_FILE_SIZE"
  | "UNSUPPORTED_MIME_TYPE"
  | "GEMINI_NETWORK_ERROR"
  | "GEMINI_REQUEST_TIMEOUT"
  | "GEMINI_HTTP_ERROR"
  | "GEMINI_INVALID_RESPONSE"
  | "GEMINI_UPLOAD_PROTOCOL_ERROR"
  | "GEMINI_OPERATION_FAILED"
  | "GEMINI_OPERATION_TIMEOUT"
  | "GEMINI_PAGINATION_ERROR";

export class GeminiRestError extends Error {
  readonly code: GeminiRestErrorCode;
  readonly status?: number;
  readonly isRetryable: boolean;
  readonly operationName?: string;

  constructor(options: {
    code: GeminiRestErrorCode;
    message: string;
    status?: number;
    isRetryable?: boolean;
    operationName?: string;
  }) {
    super(options.message);
    this.name = "GeminiRestError";
    this.code = options.code;
    this.status = options.status;
    this.isRetryable = options.isRetryable ?? false;
    this.operationName = options.operationName;
    Object.setPrototypeOf(this, GeminiRestError.prototype);
  }
}

export interface GeminiFileSearchStore {
  name: string;
  displayName: string;
  createTime?: string;
  updateTime?: string;
}

export interface GeminiDocument {
  name: string;
  displayName?: string;
  customMetadata?: readonly GeminiCustomMetadata[];
  createTime?: string;
  updateTime?: string;
  state?:
    | "STATE_UNSPECIFIED"
    | "STATE_PENDING"
    | "STATE_ACTIVE"
    | "STATE_FAILED";
  sizeBytes?: string;
  mimeType?: string;
}

export interface GeminiDocumentPage {
  readonly documents: readonly GeminiDocument[];
  readonly nextPageToken?: string;
}

export interface GeminiDeleteResult {
  outcome: "deleted" | "not_found";
}

export interface GeminiCustomMetadata {
  readonly key: string;
  readonly stringValue: string;
}

export interface GeminiUploadInput {
  storeName: string;
  displayName: string;
  mimeType: string;
  bytes: ArrayBuffer;
  customMetadata: readonly GeminiCustomMetadata[];
}

export interface GeminiOperation {
  name: string;
  done?: boolean;
  error?: {
    code?: number;
  };
  response?: {
    documentName?: string;
  };
}

export interface GeminiRestClientConfig {
  apiKey: string;
  fetchFn?: typeof fetch;
  sleepFn?: (milliseconds: number) => Promise<void>;
  nowFn?: () => number;
  requestTimeoutMs?: number;
  uploadTimeoutMs?: number;
  operationTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface GeminiRestClient {
  createFileSearchStore(
    displayName: string,
  ): Promise<GeminiFileSearchStore>;

  getFileSearchStore(
    storeName: string,
  ): Promise<GeminiFileSearchStore | null>;

  deleteFileSearchStore(
    storeName: string,
  ): Promise<GeminiDeleteResult>;

  uploadToFileSearchStore(
    input: GeminiUploadInput,
  ): Promise<GeminiOperation>;

  getOperation(
    operationName: string,
  ): Promise<GeminiOperation>;

  waitForUploadOperation(
    initialOperation: GeminiOperation,
  ): Promise<GeminiOperation>;

  getDocument(
    documentName: string,
  ): Promise<GeminiDocument | null>;

  deleteDocument(
    documentName: string,
  ): Promise<GeminiDeleteResult>;

  listDocuments(
    storeName: string,
    pageToken?: string,
  ): Promise<GeminiDocumentPage>;

  listAllDocuments(
    storeName: string,
  ): Promise<readonly GeminiDocument[]>;
}

const STORE_NAME_PATTERN = /^fileSearchStores\/[a-z0-9-]{1,40}$/;

const DISPLAY_NAME_CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;

const CANONICAL_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

const SAFE_RESOURCE_SEGMENT_PATTERN = /^[A-Za-z0-9._~-]{1,512}$/;

const DOCUMENT_ID_PATTERN = /^(?=.{1,40}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const MAX_CUSTOM_METADATA_ENTRIES = 20;

const MAX_PAGE_TOKEN_LENGTH = 4096;

const DOCUMENT_LIST_PAGE_SIZE = 20;

const MAX_DOCUMENT_LIST_PAGES = 1000;

const MAX_INT64_STRING = "9223372036854775807";

const RFC3339_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-](\d{2}):(\d{2}))$/;

const FORBIDDEN_UPLOAD_QUERY_PARAMETERS = new Set([
  "key",
  "api_key",
  "x-goog-api-key",
  "access_token",
  "authorization",
]);

function isValidDisplayName(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value &&
    !DISPLAY_NAME_CONTROL_PATTERN.test(value);
}

function isValidSafeFilename(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    value.trim() !== value ||
    DISPLAY_NAME_CONTROL_PATTERN.test(value)
  ) {
    return false;
  }
  if (
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    return false;
  }
  return true;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysBeforeYear(year: number): number {
  const completedYears = year - 1;
  return completedYears * 365 +
    Math.floor(completedYears / 4) -
    Math.floor(completedYears / 100) +
    Math.floor(completedYears / 400);
}

function isValidRfc3339Timestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = RFC3339_TIMESTAMP_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const timezone = match[8];
  const offsetHour = timezone === "Z" ? 0 : Number(match[9]);
  const offsetMinute = timezone === "Z" ? 0 : Number(match[10]);

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return false;
  }

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (day < 1 || day > daysInMonth[month - 1]) {
    return false;
  }

  const daysBeforeMonth = [
    0,
    31,
    59,
    90,
    120,
    151,
    181,
    212,
    243,
    273,
    304,
    334,
  ];
  const dayOfYear = daysBeforeMonth[month - 1] +
    day -
    1 +
    (month > 2 && isLeapYear(year) ? 1 : 0);
  const localSecond = (daysBeforeYear(year) + dayOfYear) * 86_400 +
    hour * 3_600 +
    minute * 60 +
    second;
  const offsetSign = timezone.startsWith("-") ? -1 : 1;
  const offsetSecond = offsetSign *
    (offsetHour * 3_600 + offsetMinute * 60);
  const utcSecond = localSecond - offsetSecond;
  const maximumUtcSecond = daysBeforeYear(10_000) * 86_400 - 1;

  return utcSecond >= 0 && utcSecond <= maximumUtcSecond;
}

function isCanonicalNonNegativeInt64(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^(?:0|[1-9]\d*)$/.test(value)
  ) {
    return false;
  }

  return value.length < MAX_INT64_STRING.length ||
    (value.length === MAX_INT64_STRING.length &&
      value <= MAX_INT64_STRING);
}

export function isValidStoreName(storeName: unknown): storeName is string {
  return typeof storeName === "string" &&
    STORE_NAME_PATTERN.test(storeName);
}

function isValidPageToken(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PAGE_TOKEN_LENGTH &&
    value.trim() === value &&
    !DISPLAY_NAME_CONTROL_PATTERN.test(value);
}

function getArrayBufferByteLength(value: unknown): number | null {
  const byteLengthGetter = Object.getOwnPropertyDescriptor(
    ArrayBuffer.prototype,
    "byteLength",
  )?.get;

  if (typeof byteLengthGetter !== "function") {
    return null;
  }

  try {
    const byteLength: unknown = Reflect.apply(byteLengthGetter, value, []);
    return typeof byteLength === "number" ? byteLength : null;
  } catch {
    return null;
  }
}

function isSafeResourceSegment(value: unknown): value is string {
  return typeof value === "string" &&
    value !== "." &&
    value !== ".." &&
    SAFE_RESOURCE_SEGMENT_PATTERN.test(value);
}

function isValidDocumentName(
  documentName: unknown,
  storeName: string,
): documentName is string {
  if (typeof documentName !== "string") {
    return false;
  }

  const prefix = `${storeName}/documents/`;
  if (!documentName.startsWith(prefix)) {
    return false;
  }

  return DOCUMENT_ID_PATTERN.test(documentName.slice(prefix.length));
}

function isValidOperationName(
  operationName: unknown,
  storeName: string,
): operationName is string {
  if (typeof operationName !== "string") {
    return false;
  }

  const operationPrefixes = [
    `${storeName}/operations/`,
    `${storeName}/upload/operations/`,
  ];

  for (const prefix of operationPrefixes) {
    if (
      operationName.startsWith(prefix) &&
      isSafeResourceSegment(operationName.slice(prefix.length))
    ) {
      return true;
    }
  }

  return false;
}

function parseStoreFromOperationName(
  operationName: unknown,
): string | null {
  if (typeof operationName !== "string") {
    return null;
  }

  const parts = operationName.split("/");
  if (parts.length < 2 || parts[0] !== "fileSearchStores") {
    return null;
  }

  const storeName = `${parts[0]}/${parts[1]}`;
  if (!isValidStoreName(storeName)) {
    return null;
  }

  if (!isValidOperationName(operationName, storeName)) {
    return null;
  }

  return storeName;
}

function parseStoreFromDocumentName(
  documentName: unknown,
): string | null {
  if (typeof documentName !== "string") {
    return null;
  }

  const parts = documentName.split("/");
  if (
    parts.length !== 4 ||
    parts[0] !== "fileSearchStores" ||
    parts[2] !== "documents"
  ) {
    return null;
  }

  const storeName = `${parts[0]}/${parts[1]}`;
  if (!isValidStoreName(storeName)) {
    return null;
  }

  if (!isValidDocumentName(documentName, storeName)) {
    return null;
  }

  return storeName;
}

function evaluateOperationState(
  op: GeminiOperation,
  expectedStoreName: string,
  operationName: string,
):
  | { status: "success"; operation: GeminiOperation }
  | { status: "pending"; operation: GeminiOperation } {
  if (typeof op !== "object" || op === null || Array.isArray(op)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
    );
  }

  const opRecord = op as unknown as Record<string, unknown>;

  if (hasOwn(opRecord, "done") && typeof op.done !== "boolean") {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
    );
  }

  const hasError = hasOwn(opRecord, "error");
  const hasResponse = hasOwn(opRecord, "response");

  if (hasError && hasResponse) {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
    );
  }

  if (op.done === false && (hasError || hasResponse)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
    );
  }

  if (hasResponse) {
    if (
      typeof op.response !== "object" ||
      op.response === null ||
      Array.isArray(op.response)
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid operation resource.",
        operationName,
      );
    }

    if (
      hasOwn(op.response as Record<string, unknown>, "documentName") &&
      !isValidDocumentName(op.response.documentName, expectedStoreName)
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid operation resource.",
        operationName,
      );
    }

    if (typeof op.response.documentName === "string") {
      const result: GeminiOperation = { name: op.name };
      if (typeof op.done === "boolean") {
        result.done = op.done;
      }
      result.response = { documentName: op.response.documentName };
      return { status: "success", operation: result };
    }
  }

  if (hasError) {
    if (
      typeof op.error !== "object" ||
      op.error === null ||
      Array.isArray(op.error)
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid operation resource.",
        operationName,
      );
    }

    const errRecord = op.error as Record<string, unknown>;
    if (
      hasOwn(errRecord, "code") &&
      (typeof errRecord.code !== "number" || !Number.isInteger(errRecord.code))
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid operation resource.",
        operationName,
      );
    }

    throw new GeminiRestError({
      code: "GEMINI_OPERATION_FAILED",
      message: "The upload operation failed.",
      status: typeof errRecord.code === "number" ? errRecord.code : undefined,
      isRetryable: false,
      operationName,
    });
  }

  if (op.done === true) {
    throw invalidProviderResponse(
      "Gemini returned a completed operation resource without a response or error.",
      operationName,
    );
  }

  const pendingOp: GeminiOperation = { name: op.name };
  if (typeof op.done === "boolean") {
    pendingOp.done = op.done;
  }
  return { status: "pending", operation: pendingOp };
}

function hasOwn(
  object: Record<string, unknown>,
  property: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function invalidProviderResponse(
  message: string,
  operationName: string,
  status?: number,
): GeminiRestError {
  return new GeminiRestError({
    code: "GEMINI_INVALID_RESPONSE",
    message,
    status,
    isRetryable: false,
    operationName,
  });
}

function parseStoreResource(
  data: unknown,
  operationName: string,
  status?: number,
): GeminiFileSearchStore {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid store resource.",
      operationName,
      status,
    );
  }

  const object = data as Record<string, unknown>;

  if (!isValidStoreName(object.name)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid store resource.",
      operationName,
      status,
    );
  }

  if (!isValidDisplayName(object.displayName)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid store resource.",
      operationName,
      status,
    );
  }

  if (
    hasOwn(object, "createTime") &&
    typeof object.createTime !== "string"
  ) {
    throw invalidProviderResponse(
      "Gemini returned an invalid store resource.",
      operationName,
      status,
    );
  }

  if (
    hasOwn(object, "updateTime") &&
    typeof object.updateTime !== "string"
  ) {
    throw invalidProviderResponse(
      "Gemini returned an invalid store resource.",
      operationName,
      status,
    );
  }

  const store: GeminiFileSearchStore = {
    name: object.name,
    displayName: object.displayName,
  };

  if (typeof object.createTime === "string") {
    store.createTime = object.createTime;
  }

  if (typeof object.updateTime === "string") {
    store.updateTime = object.updateTime;
  }

  return store;
}

function parseOperationResource(
  data: unknown,
  expectedStoreName: string,
  operationName: string,
  status?: number,
): GeminiOperation {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
      status,
    );
  }

  const object = data as Record<string, unknown>;

  if (!isValidOperationName(object.name, expectedStoreName)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
      status,
    );
  }

  if (hasOwn(object, "done") && typeof object.done !== "boolean") {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
      status,
    );
  }

  const hasError = hasOwn(object, "error");
  const hasResponse = hasOwn(object, "response");

  if (hasError && hasResponse) {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
      status,
    );
  }

  if (object.done === false && (hasError || hasResponse)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid operation resource.",
      operationName,
      status,
    );
  }

  let errorResult: { code?: number } | undefined;
  if (hasError) {
    if (
      typeof object.error !== "object" ||
      object.error === null ||
      Array.isArray(object.error)
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid operation resource.",
        operationName,
        status,
      );
    }

    const error = object.error as Record<string, unknown>;
    if (
      hasOwn(error, "code") &&
      (typeof error.code !== "number" || !Number.isInteger(error.code))
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid operation resource.",
        operationName,
        status,
      );
    }

    errorResult = {};
    if (typeof error.code === "number") {
      errorResult.code = error.code;
    }
  }

  let responseResult: { documentName?: string } | undefined;
  if (hasResponse) {
    if (
      typeof object.response !== "object" ||
      object.response === null ||
      Array.isArray(object.response)
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid operation resource.",
        operationName,
        status,
      );
    }

    const response = object.response as Record<string, unknown>;
    if (
      hasOwn(response, "documentName") &&
      !isValidDocumentName(response.documentName, expectedStoreName)
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid operation resource.",
        operationName,
        status,
      );
    }

    responseResult = {};
    if (typeof response.documentName === "string") {
      responseResult.documentName = response.documentName;
    }
  }

  const result: GeminiOperation = {
    name: object.name,
  };

  if (typeof object.done === "boolean") {
    result.done = object.done;
  }

  if (errorResult !== undefined) {
    result.error = errorResult;
  }

  if (responseResult !== undefined) {
    result.response = responseResult;
  }

  return result;
}

const VALID_DOCUMENT_STATES = new Set([
  "STATE_UNSPECIFIED",
  "STATE_PENDING",
  "STATE_ACTIVE",
  "STATE_FAILED",
]);

function parseDocumentResource(
  data: unknown,
  operationName: string,
  expectedStoreName: string,
  status?: number,
): GeminiDocument {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid document resource.",
      operationName,
      status,
    );
  }

  const object = data as Record<string, unknown>;

  if (!isValidDocumentName(object.name, expectedStoreName)) {
    throw invalidProviderResponse(
      "Gemini returned an invalid document resource.",
      operationName,
      status,
    );
  }

  if (hasOwn(object, "displayName")) {
    if (!isValidDisplayName(object.displayName)) {
      throw invalidProviderResponse(
        "Gemini returned an invalid document resource.",
        operationName,
        status,
      );
    }
  }

  if (hasOwn(object, "createTime")) {
    if (!isValidRfc3339Timestamp(object.createTime)) {
      throw invalidProviderResponse(
        "Gemini returned an invalid document resource.",
        operationName,
        status,
      );
    }
  }

  if (hasOwn(object, "updateTime")) {
    if (!isValidRfc3339Timestamp(object.updateTime)) {
      throw invalidProviderResponse(
        "Gemini returned an invalid document resource.",
        operationName,
        status,
      );
    }
  }

  if (hasOwn(object, "state")) {
    if (
      typeof object.state !== "string" ||
      !VALID_DOCUMENT_STATES.has(object.state)
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid document resource.",
        operationName,
        status,
      );
    }
  }

  if (hasOwn(object, "sizeBytes")) {
    if (!isCanonicalNonNegativeInt64(object.sizeBytes)) {
      throw invalidProviderResponse(
        "Gemini returned an invalid document resource.",
        operationName,
        status,
      );
    }
  }

  if (hasOwn(object, "mimeType")) {
    if (
      typeof object.mimeType !== "string" ||
      !CANONICAL_MIME_TYPES.has(object.mimeType)
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid document resource.",
        operationName,
        status,
      );
    }
  }

  let customMetadata: GeminiCustomMetadata[] | undefined;
  if (hasOwn(object, "customMetadata")) {
    if (
      !Array.isArray(object.customMetadata) ||
      object.customMetadata.length > MAX_CUSTOM_METADATA_ENTRIES
    ) {
      throw invalidProviderResponse(
        "Gemini returned an invalid document resource.",
        operationName,
        status,
      );
    }

    customMetadata = [];
    const seenKeys = new Set<string>();

    for (const entry of object.customMetadata) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        Array.isArray(entry)
      ) {
        throw invalidProviderResponse(
          "Gemini returned an invalid document resource.",
          operationName,
          status,
        );
      }

      const keys = Object.keys(entry);
      if (
        keys.length !== 2 ||
        !keys.includes("key") ||
        !keys.includes("stringValue")
      ) {
        throw invalidProviderResponse(
          "Gemini returned an invalid document resource.",
          operationName,
          status,
        );
      }

      const key = (entry as Record<string, unknown>).key;
      const stringValue = (entry as Record<string, unknown>).stringValue;

      if (
        typeof key !== "string" ||
        key.length === 0 ||
        key.length > 512 ||
        key.trim() !== key ||
        DISPLAY_NAME_CONTROL_PATTERN.test(key)
      ) {
        throw invalidProviderResponse(
          "Gemini returned an invalid document resource.",
          operationName,
          status,
        );
      }

      if (
        typeof stringValue !== "string" ||
        stringValue.length === 0 ||
        stringValue.length > 512 ||
        stringValue.trim() !== stringValue ||
        DISPLAY_NAME_CONTROL_PATTERN.test(stringValue)
      ) {
        throw invalidProviderResponse(
          "Gemini returned an invalid document resource.",
          operationName,
          status,
        );
      }

      if (seenKeys.has(key)) {
        throw invalidProviderResponse(
          "Gemini returned an invalid document resource.",
          operationName,
          status,
        );
      }

      seenKeys.add(key);
      customMetadata.push({ key, stringValue });
    }
  }

  const doc: GeminiDocument = {
    name: object.name as string,
  };

  if (typeof object.displayName === "string") {
    doc.displayName = object.displayName;
  }
  if (customMetadata !== undefined) {
    doc.customMetadata = customMetadata;
  }
  if (typeof object.createTime === "string") {
    doc.createTime = object.createTime;
  }
  if (typeof object.updateTime === "string") {
    doc.updateTime = object.updateTime;
  }
  if (typeof object.state === "string") {
    doc.state = object.state as GeminiDocument["state"];
  }
  if (typeof object.sizeBytes === "string") {
    doc.sizeBytes = object.sizeBytes;
  }
  if (typeof object.mimeType === "string") {
    doc.mimeType = object.mimeType;
  }

  return doc;
}

function uploadProtocolError(
  message: string,
  operationName: string,
): GeminiRestError {
  return new GeminiRestError({
    code: "GEMINI_UPLOAD_PROTOCOL_ERROR",
    message,
    operationName,
  });
}

function validateUploadSessionUrl(
  value: unknown,
  expectedStoreName: string,
  operationName: string,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    DISPLAY_NAME_CONTROL_PATTERN.test(value)
  ) {
    throw uploadProtocolError(
      "Gemini returned an invalid upload session.",
      operationName,
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw uploadProtocolError(
      "Gemini returned an invalid upload session.",
      operationName,
    );
  }

  const expectedPath =
    `/upload/${GEMINI_API_VERSION}/${expectedStoreName}:uploadToFileSearchStore`;
  const expectedUrl = `${GEMINI_API_ORIGIN}${expectedPath}`;

  if (value !== expectedUrl && !value.startsWith(`${expectedUrl}?`)) {
    throw uploadProtocolError(
      "Gemini returned an invalid upload session.",
      operationName,
    );
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.origin !== GEMINI_API_ORIGIN ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.hash !== "" ||
    parsedUrl.pathname !== expectedPath
  ) {
    throw uploadProtocolError(
      "Gemini returned an invalid upload session.",
      operationName,
    );
  }

  for (const [parameterName] of parsedUrl.searchParams) {
    if (
      FORBIDDEN_UPLOAD_QUERY_PARAMETERS.has(
        parameterName.toLowerCase(),
      )
    ) {
      throw uploadProtocolError(
        "Gemini returned an invalid upload session.",
        operationName,
      );
    }
  }

  return value;
}

function validatePositiveInteger(
  value: number,
  name: string,
): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new GeminiRestError({
      code: "INVALID_ARGUMENT",
      message: `${name} must be a positive finite integer.`,
    });
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function createHttpError(
  response: Response,
  operationName: string,
): GeminiRestError {
  return new GeminiRestError({
    code: "GEMINI_HTTP_ERROR",
    message: `Gemini request failed with HTTP status ${response.status}.`,
    status: response.status,
    isRetryable: isRetryableHttpStatus(response.status),
    operationName,
  });
}

export function createGeminiRestClient(
  config: GeminiRestClientConfig,
): GeminiRestClient {
  if (!config || typeof config !== "object") {
    throw new GeminiRestError({
      code: "INVALID_ARGUMENT",
      message: "A Gemini REST client configuration is required.",
    });
  }

  const { apiKey } = config;

  if (
    typeof apiKey !== "string" ||
    apiKey.trim().length === 0
  ) {
    throw new GeminiRestError({
      code: "INVALID_API_KEY",
      message: "The Gemini API key must be a non-empty string.",
    });
  }

  if (
    config.fetchFn !== undefined &&
    typeof config.fetchFn !== "function"
  ) {
    throw new GeminiRestError({
      code: "INVALID_ARGUMENT",
      message: "fetchFn must be a function.",
    });
  }

  if (
    config.sleepFn !== undefined &&
    typeof config.sleepFn !== "function"
  ) {
    throw new GeminiRestError({
      code: "INVALID_ARGUMENT",
      message: "sleepFn must be a function.",
    });
  }

  if (
    config.nowFn !== undefined &&
    typeof config.nowFn !== "function"
  ) {
    throw new GeminiRestError({
      code: "INVALID_ARGUMENT",
      message: "nowFn must be a function.",
    });
  }

  if (config.requestTimeoutMs !== undefined) {
    validatePositiveInteger(
      config.requestTimeoutMs,
      "requestTimeoutMs",
    );
  }

  if (config.uploadTimeoutMs !== undefined) {
    validatePositiveInteger(
      config.uploadTimeoutMs,
      "uploadTimeoutMs",
    );
  }

  if (config.operationTimeoutMs !== undefined) {
    validatePositiveInteger(
      config.operationTimeoutMs,
      "operationTimeoutMs",
    );
  }

  if (config.pollIntervalMs !== undefined) {
    validatePositiveInteger(
      config.pollIntervalMs,
      "pollIntervalMs",
    );
  }

  const requestTimeoutMs = config.requestTimeoutMs ?? 30_000;
  const uploadTimeoutMs = config.uploadTimeoutMs ?? 120_000;
  const operationTimeoutMs = config.operationTimeoutMs ?? 600_000;
  const pollIntervalMs = config.pollIntervalMs ?? 5_000;
  const fetchFn = config.fetchFn ?? globalThis.fetch;
  const sleepFn = config.sleepFn ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const nowFn = config.nowFn ?? (() => Date.now());

  async function request<T>(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string | ArrayBuffer;
    timeoutMs?: number;
    operationName: string;
    handleResponse: (
      response: Response,
    ) => Promise<T> | T;
  }): Promise<T> {
    const timeoutMs = options.timeoutMs ?? requestTimeoutMs;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new GeminiRestError({
            code: "GEMINI_REQUEST_TIMEOUT",
            message: "The Gemini request timed out.",
            isRetryable: true,
            operationName: options.operationName,
          }),
        );
      }, timeoutMs);
    });

    const requestPromise = (async (): Promise<T> => {
      const response = await fetchFn(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        redirect: "error",
        signal: controller.signal,
      });

      return await options.handleResponse(response);
    })();

    try {
      return await Promise.race([
        requestPromise,
        timeoutPromise,
      ]);
    } catch (error: unknown) {
      if (error instanceof GeminiRestError) {
        throw error;
      }

      if (
        controller.signal.aborted ||
        isAbortError(error)
      ) {
        throw new GeminiRestError({
          code: "GEMINI_REQUEST_TIMEOUT",
          message: "The Gemini request timed out.",
          isRetryable: true,
          operationName: options.operationName,
        });
      }

      throw new GeminiRestError({
        code: "GEMINI_NETWORK_ERROR",
        message: "The Gemini network request failed.",
        isRetryable: true,
        operationName: options.operationName,
      });
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  async function parseResponseJson(
    response: Response,
    operationName: string,
  ): Promise<unknown> {
    try {
      return await response.json();
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw error;
      }

      throw invalidProviderResponse(
        "Gemini returned an invalid JSON response.",
        operationName,
        response.status,
      );
    }
  }

  return {
    async createFileSearchStore(
      displayName: string,
    ): Promise<GeminiFileSearchStore> {
      const operationName = "createFileSearchStore";

      if (!isValidDisplayName(displayName)) {
        throw new GeminiRestError({
          code: "INVALID_ARGUMENT",
          message:
            "The store display name must be non-empty, unpadded, free of control characters, and no longer than 512 characters.",
          operationName,
        });
      }

      const url = `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/fileSearchStores`;

      return await request({
        url,
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          embeddingModel: GEMINI_EMBEDDING_MODEL,
        }),
        operationName,
        handleResponse: async (response) => {
          if (!response.ok) {
            throw createHttpError(response, operationName);
          }

          const data = await parseResponseJson(
            response,
            operationName,
          );

          return parseStoreResource(
            data,
            operationName,
            response.status,
          );
        },
      });
    },

    async getFileSearchStore(
      storeName: string,
    ): Promise<GeminiFileSearchStore | null> {
      const operationName = "getFileSearchStore";

      if (!isValidStoreName(storeName)) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The file search store resource name is invalid.",
          operationName,
        });
      }

      const url = `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${storeName}`;

      return await request({
        url,
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
        },
        operationName,
        handleResponse: async (response) => {
          if (response.status === 404) {
            return null;
          }

          if (!response.ok) {
            throw createHttpError(response, operationName);
          }

          const data = await parseResponseJson(
            response,
            operationName,
          );

          const store = parseStoreResource(
            data,
            operationName,
            response.status,
          );

          if (store.name !== storeName) {
            throw invalidProviderResponse(
              "Gemini returned a store that does not match the requested resource.",
              operationName,
              response.status,
            );
          }

          return store;
        },
      });
    },

    async deleteFileSearchStore(
      storeName: string,
    ): Promise<GeminiDeleteResult> {
      const operationName = "deleteFileSearchStore";

      if (!isValidStoreName(storeName)) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The file search store resource name is invalid.",
          operationName,
        });
      }

      const url =
        `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${storeName}?force=true`;

      return await request({
        url,
        method: "DELETE",
        headers: {
          "x-goog-api-key": apiKey,
        },
        operationName,
        handleResponse: (response) => {
          if (response.status === 404) {
            return { outcome: "not_found" };
          }

          if (!response.ok) {
            throw createHttpError(response, operationName);
          }

          return { outcome: "deleted" };
        },
      });
    },

    async getDocument(
      documentName: string,
    ): Promise<GeminiDocument | null> {
      const operationName = "getDocument";

      const storeName = parseStoreFromDocumentName(documentName);
      if (storeName === null) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The document resource name is invalid.",
          operationName,
        });
      }

      const url = `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${documentName}`;

      return await request({
        url,
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
        },
        operationName,
        handleResponse: async (response) => {
          if (response.status === 404) {
            return null;
          }

          if (!response.ok) {
            throw createHttpError(response, operationName);
          }

          const data = await parseResponseJson(
            response,
            operationName,
          );

          const doc = parseDocumentResource(
            data,
            operationName,
            storeName,
            response.status,
          );

          if (doc.name !== documentName) {
            throw invalidProviderResponse(
              "Gemini returned a document that does not match the requested resource.",
              operationName,
              response.status,
            );
          }

          return doc;
        },
      });
    },

    async deleteDocument(
      documentName: string,
    ): Promise<GeminiDeleteResult> {
      const operationName = "deleteDocument";

      const storeName = parseStoreFromDocumentName(documentName);
      if (storeName === null) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The document resource name is invalid.",
          operationName,
        });
      }

      const url =
        `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${documentName}?force=true`;

      return await request({
        url,
        method: "DELETE",
        headers: {
          "x-goog-api-key": apiKey,
        },
        operationName,
        handleResponse: (response) => {
          if (response.status === 404) {
            return { outcome: "not_found" };
          }

          if (!response.ok) {
            throw createHttpError(response, operationName);
          }

          return { outcome: "deleted" };
        },
      });
    },

    async listDocuments(
      storeName: string,
      pageToken?: string,
    ): Promise<GeminiDocumentPage> {
      const operationName = "listDocuments";

      if (!isValidStoreName(storeName)) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The file search store resource name is invalid.",
          operationName,
        });
      }

      if (pageToken !== undefined && !isValidPageToken(pageToken)) {
        throw new GeminiRestError({
          code: "INVALID_ARGUMENT",
          message: "The page token is invalid.",
          operationName,
        });
      }

      const query = new URLSearchParams();
      query.set("pageSize", String(DOCUMENT_LIST_PAGE_SIZE));
      if (pageToken !== undefined) {
        query.set("pageToken", pageToken);
      }

      const url =
        `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${storeName}/documents?${query.toString()}`;

      return await request({
        url,
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
        },
        operationName,
        handleResponse: async (response) => {
          if (!response.ok) {
            throw createHttpError(response, operationName);
          }

          const data = await parseResponseJson(
            response,
            operationName,
          );

          if (
            typeof data !== "object" ||
            data === null ||
            Array.isArray(data)
          ) {
            throw invalidProviderResponse(
              "Gemini returned an invalid document list response.",
              operationName,
              response.status,
            );
          }

          const object = data as Record<string, unknown>;
          let documents: GeminiDocument[] = [];

          if (hasOwn(object, "documents")) {
            if (!Array.isArray(object.documents)) {
              throw invalidProviderResponse(
                "Gemini returned an invalid document list response.",
                operationName,
                response.status,
              );
            }

            documents = object.documents.map((document) =>
              parseDocumentResource(
                document,
                operationName,
                storeName,
                response.status,
              )
            );
          }

          if (!hasOwn(object, "nextPageToken")) {
            return { documents };
          }

          if (!isValidPageToken(object.nextPageToken)) {
            throw invalidProviderResponse(
              "Gemini returned an invalid document list response.",
              operationName,
              response.status,
            );
          }

          return {
            documents,
            nextPageToken: object.nextPageToken,
          };
        },
      });
    },

    async listAllDocuments(
      storeName: string,
    ): Promise<readonly GeminiDocument[]> {
      const operationName = "listAllDocuments";

      if (!isValidStoreName(storeName)) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The file search store resource name is invalid.",
          operationName,
        });
      }

      const documents: GeminiDocument[] = [];
      const seenDocumentNames = new Set<string>();
      const seenPageTokens = new Set<string>();
      let pageToken: string | undefined;
      let pageCount = 0;

      while (true) {
        if (pageCount >= MAX_DOCUMENT_LIST_PAGES) {
          throw new GeminiRestError({
            code: "GEMINI_PAGINATION_ERROR",
            message: "Gemini document pagination exceeded its page limit.",
            operationName,
          });
        }

        const page = await this.listDocuments(storeName, pageToken);
        pageCount += 1;

        for (const document of page.documents) {
          if (seenDocumentNames.has(document.name)) {
            throw new GeminiRestError({
              code: "GEMINI_PAGINATION_ERROR",
              message: "Gemini document pagination returned a duplicate item.",
              operationName,
            });
          }

          seenDocumentNames.add(document.name);
          documents.push(document);
        }

        if (page.nextPageToken === undefined) {
          return documents;
        }

        if (seenPageTokens.has(page.nextPageToken)) {
          throw new GeminiRestError({
            code: "GEMINI_PAGINATION_ERROR",
            message: "Gemini document pagination returned a repeated token.",
            operationName,
          });
        }

        seenPageTokens.add(page.nextPageToken);
        pageToken = page.nextPageToken;
      }
    },

    async uploadToFileSearchStore(
      input: GeminiUploadInput,
    ): Promise<GeminiOperation> {
      const operationName = "uploadToFileSearchStore";

      if (
        typeof input !== "object" ||
        input === null ||
        Array.isArray(input)
      ) {
        throw new GeminiRestError({
          code: "INVALID_ARGUMENT",
          message: "Input object is required.",
          operationName,
        });
      }

      if (!isValidStoreName(input.storeName)) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The file search store resource name is invalid.",
          operationName,
        });
      }

      const byteLength = getArrayBufferByteLength(input.bytes);
      if (byteLength === null) {
        throw new GeminiRestError({
          code: "INVALID_ARGUMENT",
          message: "Bytes must be an ArrayBuffer.",
          operationName,
        });
      }

      if (
        !Number.isInteger(byteLength) ||
        byteLength < 1 ||
        byteLength > MAX_FILE_SIZE_BYTES
      ) {
        throw new GeminiRestError({
          code: "INVALID_FILE_SIZE",
          message:
            "File size must be an integer between 1 byte and MAX_FILE_SIZE_BYTES.",
          operationName,
        });
      }

      if (!isValidSafeFilename(input.displayName)) {
        throw new GeminiRestError({
          code: "INVALID_ARGUMENT",
          message: "The file display name is invalid.",
          operationName,
        });
      }

      if (
        typeof input.mimeType !== "string" ||
        !CANONICAL_MIME_TYPES.has(input.mimeType)
      ) {
        throw new GeminiRestError({
          code: "UNSUPPORTED_MIME_TYPE",
          message: "The MIME type is unsupported.",
          operationName,
        });
      }

      if (
        !Array.isArray(input.customMetadata) ||
        input.customMetadata.length > MAX_CUSTOM_METADATA_ENTRIES
      ) {
        throw new GeminiRestError({
          code: "INVALID_METADATA",
          message: "Custom metadata must be an array of at most 20 entries.",
          operationName,
        });
      }

      const seenKeys = new Set<string>();
      for (const entry of input.customMetadata) {
        if (
          typeof entry !== "object" ||
          entry === null ||
          Array.isArray(entry)
        ) {
          throw new GeminiRestError({
            code: "INVALID_METADATA",
            message: "Invalid metadata entry.",
            operationName,
          });
        }
        const keys = Object.keys(entry);
        if (
          keys.length !== 2 ||
          !keys.includes("key") ||
          !keys.includes("stringValue")
        ) {
          throw new GeminiRestError({
            code: "INVALID_METADATA",
            message: "Metadata entry must contain exactly key and stringValue.",
            operationName,
          });
        }
        const key = (entry as Record<string, unknown>).key;
        const stringValue = (entry as Record<string, unknown>).stringValue;
        if (
          typeof key !== "string" ||
          key.length === 0 ||
          key.trim() !== key ||
          DISPLAY_NAME_CONTROL_PATTERN.test(key)
        ) {
          throw new GeminiRestError({
            code: "INVALID_METADATA",
            message: "Invalid metadata key.",
            operationName,
          });
        }
        if (
          typeof stringValue !== "string" ||
          stringValue.length === 0 ||
          stringValue.trim() !== stringValue ||
          DISPLAY_NAME_CONTROL_PATTERN.test(stringValue)
        ) {
          throw new GeminiRestError({
            code: "INVALID_METADATA",
            message: "Invalid metadata stringValue.",
            operationName,
          });
        }
        if (seenKeys.has(key)) {
          throw new GeminiRestError({
            code: "INVALID_METADATA",
            message: "Duplicate metadata keys are not allowed.",
            operationName,
          });
        }
        seenKeys.add(key);
      }

      // Step 3: Start resumable upload session
      const startUrl =
        `${GEMINI_API_ORIGIN}/upload/${GEMINI_API_VERSION}/${input.storeName}:uploadToFileSearchStore`;

      const sessionUrl = await request({
        url: startUrl,
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(byteLength),
          "X-Goog-Upload-Header-Content-Type": input.mimeType,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          displayName: input.displayName,
          mimeType: input.mimeType,
          customMetadata: input.customMetadata.map((m) => ({
            key: m.key,
            stringValue: m.stringValue,
          })),
        }),
        timeoutMs: requestTimeoutMs,
        operationName,
        handleResponse: (response) => {
          if (!response.ok) {
            throw createHttpError(response, operationName);
          }

          return validateUploadSessionUrl(
            response.headers.get("x-goog-upload-url"),
            input.storeName,
            operationName,
          );
        },
      });

      // Step 5: Upload binary data and finalize
      return await request({
        url: sessionUrl,
        method: "POST",
        headers: {
          "Content-Length": String(byteLength),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
          "Content-Type": input.mimeType,
        },
        body: input.bytes,
        timeoutMs: uploadTimeoutMs,
        operationName,
        handleResponse: async (response) => {
          if (!response.ok) {
            throw createHttpError(response, operationName);
          }

          const data = await parseResponseJson(response, operationName);
          return parseOperationResource(
            data,
            input.storeName,
            operationName,
            response.status,
          );
        },
      });
    },

    async getOperation(
      operationName: string,
    ): Promise<GeminiOperation> {
      const reqOperationName = "getOperation";

      const storeName = parseStoreFromOperationName(operationName);
      if (storeName === null) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The operation resource name is invalid.",
          operationName: reqOperationName,
        });
      }

      const url = `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${operationName}`;

      return await request({
        url,
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
        },
        operationName: reqOperationName,
        handleResponse: async (response) => {
          if (!response.ok) {
            throw createHttpError(response, reqOperationName);
          }

          const data = await parseResponseJson(
            response,
            reqOperationName,
          );
          const op = parseOperationResource(
            data,
            storeName,
            reqOperationName,
            response.status,
          );

          if (op.name !== operationName) {
            throw invalidProviderResponse(
              "Gemini returned an operation resource that does not match the requested operation name.",
              reqOperationName,
              response.status,
            );
          }

          return op;
        },
      });
    },

    async waitForUploadOperation(
      initialOperation: GeminiOperation,
    ): Promise<GeminiOperation> {
      const reqOperationName = "waitForUploadOperation";

      if (
        typeof initialOperation !== "object" ||
        initialOperation === null ||
        Array.isArray(initialOperation)
      ) {
        throw new GeminiRestError({
          code: "INVALID_ARGUMENT",
          message: "initialOperation object is required.",
          operationName: reqOperationName,
        });
      }

      const storeName = parseStoreFromOperationName(initialOperation.name);
      if (storeName === null) {
        throw new GeminiRestError({
          code: "INVALID_RESOURCE_NAME",
          message: "The operation resource name is invalid.",
          operationName: reqOperationName,
        });
      }

      let state = evaluateOperationState(
        initialOperation,
        storeName,
        reqOperationName,
      );

      if (state.status === "success") {
        return state.operation;
      }

      const startTime = nowFn();
      const deadline = startTime + operationTimeoutMs;

      while (true) {
        if (nowFn() >= deadline) {
          throw new GeminiRestError({
            code: "GEMINI_OPERATION_TIMEOUT",
            message: "The upload operation timed out.",
            isRetryable: true,
            operationName: reqOperationName,
          });
        }

        await sleepFn(pollIntervalMs);

        if (nowFn() >= deadline) {
          throw new GeminiRestError({
            code: "GEMINI_OPERATION_TIMEOUT",
            message: "The upload operation timed out.",
            isRetryable: true,
            operationName: reqOperationName,
          });
        }

        const fetchedOp = await this.getOperation(initialOperation.name);

        state = evaluateOperationState(
          fetchedOp,
          storeName,
          reqOperationName,
        );

        if (state.status === "success") {
          return state.operation;
        }
      }
    },
  };
}