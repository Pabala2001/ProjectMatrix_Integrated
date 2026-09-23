// Pure validation helpers for the project-advisor-file-index Edge Function.
// This module performs no network, Storage, database, or Gemini operations.

export type SourceKind = "uploaded" | "signed" | "generated";

export type ValidationErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_UUID"
  | "INVALID_SOURCE_KIND"
  | "INVALID_STORAGE_PATH"
  | "UNSUPPORTED_FORMAT"
  | "MIME_MISMATCH"
  | "INVALID_FILE_SIZE"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_SIGNATURE"
  | "INVALID_IMAGE_DIMENSIONS";

export interface RequestPayload {
  action: "index" | "delete";
  communicationDocumentId: string;
  sourceKind: SourceKind;
}

export interface ValidationResult {
  isValid: boolean;
  error?: ValidationErrorCode;
  data?: RequestPayload;
}

export interface CommunicationDocumentRow {
  id: string;
  company_id: string;
  project_id: string;
  document_title?: string | null;
  subject?: string | null;
  document_number?: string | null;
  uploaded_file_path?: string | null;
  uploaded_file_name?: string | null;
  uploaded_file_type?: string | null;
  uploaded_file_size?: number | string | null;
  signed_file_path?: string | null;
  signed_file_name?: string | null;
  generated_docx_path?: string | null;
}

export interface MappedSourceFields {
  filePath: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | string | null;
  error?: ValidationErrorCode;
}

export interface FormatCheckResult {
  isSupported: boolean;
  mimeType: string;
  extension: string;
  error?: ValidationErrorCode;
}

export interface BinaryValidationResult {
  isValid: boolean;
  error?: ValidationErrorCode;
  detectedType?: string;
}

export interface ImageDimensionResult {
  isValid: boolean;
  error?: ValidationErrorCode;
  width?: number;
  height?: number;
}

export interface FileSizeValidationResult {
  isValid: boolean;
  error?: ValidationErrorCode;
  bytes?: number;
}

export const MAX_FILE_SIZE_BYTES = 104_857_600;

const MAX_IMAGE_DIMENSION = 4096;
const MAX_FILENAME_LENGTH = 120;
const MAX_ZIP_ENTRIES = 4096;
const MAX_ZIP_COMMENT_LENGTH = 65_535;

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  pdf: "application/pdf",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const CONTROL_CHARACTER_REPLACEMENT_PATTERN = /[\u0000-\u001f\u007f]/g;
const ENCODED_PATH_CONTROL_PATTERN = /%(?:2e|2f|5c)/i;

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP_DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const ZIP64_EXTRA_FIELD_ID = 0x0001;
const ZIP_ALLOWED_GENERAL_PURPOSE_FLAGS = 0x080e;
const ZIP_DATA_DESCRIPTOR_FLAG = 0x0008;

interface ZipEntry {
  name: string;
  nameBytes: Uint8Array;
  versionNeeded: number;
  generalPurposeFlags: number;
  compressionMethod: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface ZipParseSuccess {
  ok: true;
  entries: ZipEntry[];
}

interface ZipParseFailure {
  ok: false;
}

type ZipParseResult = ZipParseSuccess | ZipParseFailure;

interface ImageParseSuccess {
  ok: true;
  width: number;
  height: number;
}

interface ImageParseFailure {
  ok: false;
  error: ValidationErrorCode;
}

type ImageParseResult = ImageParseSuccess | ImageParseFailure;

function invalidMappedSource(
  error: ValidationErrorCode,
): MappedSourceFields {
  return {
    filePath: null,
    fileName: null,
    fileType: null,
    fileSize: null,
    error,
  };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isSafeSingleFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("?") &&
    !value.includes("#") &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function getSafeStorageFilename(
  filePath: string | null | undefined,
): string | null {
  if (
    typeof filePath !== "string" ||
    filePath.length === 0 ||
    filePath.endsWith("/") ||
    filePath.includes("\\") ||
    filePath.includes("?") ||
    filePath.includes("#") ||
    CONTROL_CHARACTER_PATTERN.test(filePath)
  ) {
    return null;
  }

  const segments = filePath.split("/");
const finalSegment = segments[segments.length - 1];
return isSafeSingleFilename(finalSegment) ? finalSegment : null;
}

function appendExtensionWhenMissing(
  filename: string,
  extension: string,
): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot > 0 && lastDot < filename.length - 1) {
    return filename;
  }
  return `${filename}.${extension}`;
}

function resolveMappedFilename(
  databaseFilename: string | null | undefined,
  storagePath: string | null | undefined,
  documentTitle: string | null | undefined,
  subject: string | null | undefined,
  generated: boolean,
): string {
  if (isSafeSingleFilename(databaseFilename)) {
    return databaseFilename;
  }

  const storageFilename = getSafeStorageFilename(storagePath);
  if (storageFilename !== null) {
    return storageFilename;
  }

  if (isSafeSingleFilename(documentTitle)) {
    return generated
      ? appendExtensionWhenMissing(documentTitle, "docx")
      : documentTitle;
  }

  if (isSafeSingleFilename(subject)) {
    return generated ? appendExtensionWhenMissing(subject, "docx") : subject;
  }

  return generated ? "document.docx" : "document";
}

export function validateRequestPayload(body: unknown): ValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { isValid: false, error: "INVALID_REQUEST" };
  }

  const ownKeys = Reflect.ownKeys(body);
  const expectedKeys = new Set([
    "action",
    "communicationDocumentId",
    "sourceKind",
  ]);

  if (
    ownKeys.length !== expectedKeys.size ||
    ownKeys.some((key) => typeof key !== "string" || !expectedKeys.has(key))
  ) {
    return { isValid: false, error: "INVALID_REQUEST" };
  }

  const candidate = body as Record<string, unknown>;
  const action = candidate.action;
  const communicationDocumentId = candidate.communicationDocumentId;
  const sourceKind = candidate.sourceKind;

  if (action !== "index" && action !== "delete") {
    return { isValid: false, error: "INVALID_REQUEST" };
  }

  if (!isUuid(communicationDocumentId)) {
    return { isValid: false, error: "INVALID_UUID" };
  }

  if (
    sourceKind !== "uploaded" &&
    sourceKind !== "signed" &&
    sourceKind !== "generated"
  ) {
    return { isValid: false, error: "INVALID_SOURCE_KIND" };
  }

  return {
    isValid: true,
    data: {
      action,
      communicationDocumentId,
      sourceKind,
    },
  };
}

export function mapSourceKindToDocumentFields(
  doc: CommunicationDocumentRow | null | undefined,
  sourceKind: SourceKind,
): MappedSourceFields {
  if (doc === null || doc === undefined) {
    return invalidMappedSource("INVALID_REQUEST");
  }

  if (sourceKind === "uploaded") {
    return {
      filePath: doc.uploaded_file_path ?? null,
      fileName: resolveMappedFilename(
        doc.uploaded_file_name,
        doc.uploaded_file_path,
        doc.document_title,
        doc.subject,
        false,
      ),
      fileType: doc.uploaded_file_type ?? null,
      fileSize: doc.uploaded_file_size ?? null,
    };
  }

  if (sourceKind === "signed") {
    return {
      filePath: doc.signed_file_path ?? null,
      fileName: resolveMappedFilename(
        doc.signed_file_name,
        doc.signed_file_path,
        doc.document_title,
        doc.subject,
        false,
      ),
      fileType: null,
      fileSize: null,
    };
  }

  if (sourceKind === "generated") {
    return {
      filePath: doc.generated_docx_path ?? null,
      fileName: resolveMappedFilename(
        null,
        doc.generated_docx_path,
        doc.document_title,
        doc.subject,
        true,
      ),
      fileType: null,
      fileSize: null,
    };
  }

  return invalidMappedSource("INVALID_SOURCE_KIND");
}

export function validateStoragePath(
  filePath: string | null | undefined,
  companyId: string,
  projectId: string,
): { isValid: boolean; error?: ValidationErrorCode } {
  if (
    typeof filePath !== "string" ||
    filePath.length === 0 ||
    filePath.trim() !== filePath ||
    !isUuid(companyId) ||
    !isUuid(projectId) ||
    filePath.startsWith("/") ||
    filePath.endsWith("/") ||
    filePath.includes("\\") ||
    filePath.includes("?") ||
    filePath.includes("#") ||
    CONTROL_CHARACTER_PATTERN.test(filePath) ||
    ENCODED_PATH_CONTROL_PATTERN.test(filePath)
  ) {
    return { isValid: false, error: "INVALID_STORAGE_PATH" };
  }

  const expectedPrefix = `${companyId}/${projectId}/`;
  if (!filePath.startsWith(expectedPrefix)) {
    return { isValid: false, error: "INVALID_STORAGE_PATH" };
  }

  const segments = filePath.split("/");
  if (
    segments.length < 3 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment.trim().length === 0 ||
        segment === "." ||
        segment === "..",
    )
  ) {
    return { isValid: false, error: "INVALID_STORAGE_PATH" };
  }

  const finalSegment = segments[segments.length - 1];
  if (!isSafeSingleFilename(finalSegment)) {
    return { isValid: false, error: "INVALID_STORAGE_PATH" };
  }

  return { isValid: true };
}

function extractOriginalExtension(filename: string): string {
  if (
    !isSafeSingleFilename(filename) ||
    filename.startsWith(".") ||
    filename.endsWith(".")
  ) {
    return "";
  }

  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return "";
  }

  const extension = filename.slice(lastDot + 1);
  return /^[a-z0-9]+$/i.test(extension) ? extension.toLowerCase() : "";
}

export function getMimeTypeAndAllowlistCheck(
  fileName: string,
  rawMimeType?: string | null,
): FormatCheckResult {
  const extension = extractOriginalExtension(fileName);
  const canonicalMimeType = MIME_BY_EXTENSION[extension];

  if (canonicalMimeType === undefined) {
    return {
      isSupported: false,
      mimeType: "",
      extension,
      error: "UNSUPPORTED_FORMAT",
    };
  }

  const suppliedMimeType = typeof rawMimeType === "string"
    ? rawMimeType.trim().toLowerCase().split(";", 1)[0]
    : "";

  if (
    suppliedMimeType !== "" &&
    suppliedMimeType !== "application/octet-stream" &&
    suppliedMimeType !== canonicalMimeType
  ) {
    return {
      isSupported: false,
      mimeType: canonicalMimeType,
      extension,
      error: "MIME_MISMATCH",
    };
  }

  return {
    isSupported: true,
    mimeType: canonicalMimeType,
    extension,
  };
}

function cleanFilenameSource(value: string): string {
  return value
    .replace(CONTROL_CHARACTER_REPLACEMENT_PATTERN, "")
    .replace(/[\\/]/g, "_")
    .replace(/[?#]/g, "_")
    .trim();
}

function splitFilenameForSanitisation(
  filename: string,
): { basename: string; extension: string } {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot > 0 && lastDot < filename.length - 1) {
    const possibleExtension = filename.slice(lastDot + 1);
    if (/^[a-z0-9]{1,10}$/i.test(possibleExtension)) {
      return {
        basename: filename.slice(0, lastDot),
        extension: possibleExtension.toLowerCase(),
      };
    }
  }

  return { basename: filename, extension: "" };
}

export function sanitizeFilename(
  fileName: string | null | undefined,
  fallbackTitle?: string | null,
  verifiedExtension?: string,
): string {
  let source = typeof fileName === "string" && fileName.trim().length > 0
    ? fileName
    : typeof fallbackTitle === "string" && fallbackTitle.trim().length > 0
    ? fallbackTitle
    : "document";

  source = cleanFilenameSource(source);
  if (source.length === 0 || source === "." || source === "..") {
    source = "document";
  }

  const split = splitFilenameForSanitisation(source);
  let extension = split.extension;

  if (verifiedExtension !== undefined) {
    const normalizedVerifiedExtension = verifiedExtension
      .replace(/^\./, "")
      .toLowerCase();
    if (
      MIME_BY_EXTENSION[normalizedVerifiedExtension] !== undefined &&
      (extension === "" ||
        MIME_BY_EXTENSION[extension] ===
          MIME_BY_EXTENSION[normalizedVerifiedExtension])
    ) {
      extension = extension === "" ? normalizedVerifiedExtension : extension;
    }
  }

  let basename = split.basename
    .replace(/[^a-z0-9()[\] _.-]+/gi, "_")
    .replace(/\s+/g, " ")
    .replace(/_+/g, "_")
    .replace(/^[ ._-]+|[ ._-]+$/g, "");

  if (basename.length === 0 || basename === "." || basename === "..") {
    basename = "document";
  }

  const extensionSuffix = extension.length > 0 ? `.${extension}` : "";
  const maximumBasenameLength = Math.max(
    1,
    MAX_FILENAME_LENGTH - extensionSuffix.length,
  );
  basename = basename
    .slice(0, maximumBasenameLength)
    .replace(/[ ._-]+$/g, "");

  if (basename.length === 0) {
    basename = "document".slice(0, maximumBasenameLength);
  }

  return `${basename}${extensionSuffix}`;
}

function parseDeclaredSize(
  declaredSize: number | string,
): FileSizeValidationResult {
  if (typeof declaredSize === "number") {
    if (
      !Number.isFinite(declaredSize) ||
      !Number.isSafeInteger(declaredSize) ||
      declaredSize <= 0
    ) {
      return { isValid: false, error: "INVALID_FILE_SIZE" };
    }

    if (declaredSize > MAX_FILE_SIZE_BYTES) {
      return { isValid: false, error: "FILE_TOO_LARGE" };
    }

    return { isValid: true, bytes: declaredSize };
  }

  if (!/^[0-9]+$/.test(declaredSize)) {
    return { isValid: false, error: "INVALID_FILE_SIZE" };
  }

  let parsed: bigint;
  try {
    parsed = BigInt(declaredSize);
  } catch {
    return { isValid: false, error: "INVALID_FILE_SIZE" };
  }

  if (parsed <= 0n) {
    return { isValid: false, error: "INVALID_FILE_SIZE" };
  }

  if (parsed > BigInt(MAX_FILE_SIZE_BYTES)) {
    return { isValid: false, error: "FILE_TOO_LARGE" };
  }

  return { isValid: true, bytes: Number(parsed) };
}

function parseActualSize(actualByteLength: number): FileSizeValidationResult {
  if (
    !Number.isFinite(actualByteLength) ||
    !Number.isSafeInteger(actualByteLength) ||
    actualByteLength <= 0
  ) {
    return { isValid: false, error: "INVALID_FILE_SIZE" };
  }

  if (actualByteLength > MAX_FILE_SIZE_BYTES) {
    return { isValid: false, error: "FILE_TOO_LARGE" };
  }

  return { isValid: true, bytes: actualByteLength };
}

export function validateFileSize(
  declaredSize: number | string | null | undefined,
  actualByteLength?: number,
): FileSizeValidationResult {
  let declaredBytes: number | undefined;

  if (declaredSize !== null && declaredSize !== undefined) {
    const declaredResult = parseDeclaredSize(declaredSize);
    if (!declaredResult.isValid) {
      return declaredResult;
    }
    declaredBytes = declaredResult.bytes;
  }

  if (actualByteLength !== undefined) {
    const actualResult = parseActualSize(actualByteLength);
    if (!actualResult.isValid) {
      return actualResult;
    }

    if (
      declaredBytes !== undefined &&
      declaredBytes !== actualResult.bytes
    ) {
      return { isValid: false, error: "INVALID_FILE_SIZE" };
    }

    return actualResult;
  }

  return declaredBytes === undefined
    ? { isValid: true }
    : { isValid: true, bytes: declaredBytes };
}

function readUint16LittleEndian(
  bytes: Uint8Array,
  offset: number,
): number | null {
  if (
    !Number.isSafeInteger(offset) || offset < 0 || offset + 2 > bytes.length
  ) {
    return null;
  }
  return bytes[offset] + bytes[offset + 1] * 0x100;
}

function readUint32LittleEndian(
  bytes: Uint8Array,
  offset: number,
): number | null {
  if (
    !Number.isSafeInteger(offset) || offset < 0 || offset + 4 > bytes.length
  ) {
    return null;
  }
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x1_0000 +
    bytes[offset + 3] * 0x1_000000
  );
}

function readUint16BigEndian(
  bytes: Uint8Array,
  offset: number,
): number | null {
  if (
    !Number.isSafeInteger(offset) || offset < 0 || offset + 2 > bytes.length
  ) {
    return null;
  }
  return bytes[offset] * 0x100 + bytes[offset + 1];
}

function readUint32BigEndian(
  bytes: Uint8Array,
  offset: number,
): number | null {
  if (
    !Number.isSafeInteger(offset) || offset < 0 || offset + 4 > bytes.length
  ) {
    return null;
  }
  return (
    bytes[offset] * 0x1_000000 +
    bytes[offset + 1] * 0x1_0000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3]
  );
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function validateZipExtraFields(extra: Uint8Array): boolean {
  let offset = 0;
  while (offset < extra.length) {
    if (offset + 4 > extra.length) {
      return false;
    }

    const headerId = readUint16LittleEndian(extra, offset);
    const dataSize = readUint16LittleEndian(extra, offset + 2);
    if (headerId === null || dataSize === null) {
      return false;
    }

    if (headerId === ZIP64_EXTRA_FIELD_ID) {
      return false;
    }

    const fieldEnd = offset + 4 + dataSize;
    if (fieldEnd > extra.length) {
      return false;
    }
    offset = fieldEnd;
  }

  return offset === extra.length;
}

function decodeSafeZipEntryName(nameBytes: Uint8Array): string | null {
  if (nameBytes.length === 0) {
    return null;
  }

  let name = "";
  for (const byte of nameBytes) {
    if (byte < 0x20 || byte > 0x7e) {
      return null;
    }
    name += String.fromCharCode(byte);
  }

  if (
    name.startsWith("/") ||
    name.endsWith("/") ||
    name.includes("\\") ||
    name.includes("?") ||
    name.includes("#") ||
    CONTROL_CHARACTER_PATTERN.test(name)
  ) {
    return null;
  }

  const segments = name.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment.trim().length === 0 ||
        segment === "." ||
        segment === "..",
    )
  ) {
    return null;
  }

  return name;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number | null {
  if (bytes.length < 22) {
    return null;
  }

  const earliestOffset = Math.max(
    0,
    bytes.length - (22 + MAX_ZIP_COMMENT_LENGTH),
  );

  for (
    let offset = bytes.length - 22;
    offset >= earliestOffset;
    offset -= 1
  ) {
    if (
      readUint32LittleEndian(bytes, offset) !==
        ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      continue;
    }

    const commentLength = readUint16LittleEndian(bytes, offset + 20);
    if (
      commentLength !== null &&
      offset + 22 + commentLength === bytes.length
    ) {
      return offset;
    }
  }

  return null;
}

function hasUnsupportedZipFlags(flags: number, method: number): boolean {
  const unsupportedFlags = flags &
    (~ZIP_ALLOWED_GENERAL_PURPOSE_FLAGS & 0xffff);
  if (unsupportedFlags !== 0) {
    return true;
  }

  if (method === 0 && (flags & 0x0006) !== 0) {
    return true;
  }

  return false;
}

function parseZipEntries(bytes: Uint8Array): ZipParseResult {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset === null) {
    return { ok: false };
  }

  if (
    eocdOffset >= 20 &&
    readUint32LittleEndian(bytes, eocdOffset - 20) ===
      ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE
  ) {
    return { ok: false };
  }

  const diskNumber = readUint16LittleEndian(bytes, eocdOffset + 4);
  const centralDirectoryDisk = readUint16LittleEndian(bytes, eocdOffset + 6);
  const entriesOnDisk = readUint16LittleEndian(bytes, eocdOffset + 8);
  const totalEntries = readUint16LittleEndian(bytes, eocdOffset + 10);
  const centralDirectorySize = readUint32LittleEndian(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUint32LittleEndian(
    bytes,
    eocdOffset + 16,
  );

  if (
    diskNumber === null ||
    centralDirectoryDisk === null ||
    entriesOnDisk === null ||
    totalEntries === null ||
    centralDirectorySize === null ||
    centralDirectoryOffset === null ||
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries === 0 ||
    totalEntries === 0xffff ||
    totalEntries > MAX_ZIP_ENTRIES ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    return { ok: false };
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (
    !Number.isSafeInteger(centralDirectoryEnd) ||
    centralDirectoryOffset >= eocdOffset ||
    centralDirectoryEnd !== eocdOffset
  ) {
    return { ok: false };
  }

  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  const localOffsets = new Set<number>();
  let centralOffset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (
      centralOffset + 46 > centralDirectoryEnd ||
      readUint32LittleEndian(bytes, centralOffset) !==
        ZIP_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return { ok: false };
    }

    const versionNeeded = readUint16LittleEndian(bytes, centralOffset + 6);
    const generalPurposeFlags = readUint16LittleEndian(
      bytes,
      centralOffset + 8,
    );
    const compressionMethod = readUint16LittleEndian(
      bytes,
      centralOffset + 10,
    );
    const crc32 = readUint32LittleEndian(bytes, centralOffset + 16);
    const compressedSize = readUint32LittleEndian(bytes, centralOffset + 20);
    const uncompressedSize = readUint32LittleEndian(
      bytes,
      centralOffset + 24,
    );
    const nameLength = readUint16LittleEndian(bytes, centralOffset + 28);
    const extraLength = readUint16LittleEndian(bytes, centralOffset + 30);
    const commentLength = readUint16LittleEndian(bytes, centralOffset + 32);
    const diskStart = readUint16LittleEndian(bytes, centralOffset + 34);
    const localHeaderOffset = readUint32LittleEndian(
      bytes,
      centralOffset + 42,
    );

    if (
      versionNeeded === null ||
      generalPurposeFlags === null ||
      compressionMethod === null ||
      crc32 === null ||
      compressedSize === null ||
      uncompressedSize === null ||
      nameLength === null ||
      extraLength === null ||
      commentLength === null ||
      diskStart === null ||
      localHeaderOffset === null ||
      versionNeeded >= 45 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      diskStart === 0xffff ||
      diskStart !== 0 ||
      (compressionMethod !== 0 && compressionMethod !== 8) ||
      hasUnsupportedZipFlags(generalPurposeFlags, compressionMethod) ||
      (compressionMethod === 0 && compressedSize !== uncompressedSize)
    ) {
      return { ok: false };
    }

    const recordEnd = centralOffset + 46 + nameLength + extraLength +
      commentLength;
    if (
      !Number.isSafeInteger(recordEnd) ||
      recordEnd > centralDirectoryEnd
    ) {
      return { ok: false };
    }

    const nameStart = centralOffset + 46;
    const nameBytes = bytes.slice(nameStart, nameStart + nameLength);
    const extra = bytes.slice(
      nameStart + nameLength,
      nameStart + nameLength + extraLength,
    );
    const name = decodeSafeZipEntryName(nameBytes);

    if (
      name === null ||
      !validateZipExtraFields(extra) ||
      names.has(name) ||
      localOffsets.has(localHeaderOffset) ||
      localHeaderOffset >= centralDirectoryOffset
    ) {
      return { ok: false };
    }

    names.add(name);
    localOffsets.add(localHeaderOffset);
    entries.push({
      name,
      nameBytes,
      versionNeeded,
      generalPurposeFlags,
      compressionMethod,
      crc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    centralOffset = recordEnd;
  }

  if (centralOffset !== centralDirectoryEnd) {
    return { ok: false };
  }

  const entriesByLocalOffset = [...entries].sort(
    (left, right) => left.localHeaderOffset - right.localHeaderOffset,
  );

  for (let index = 0; index < entriesByLocalOffset.length; index += 1) {
    const entry = entriesByLocalOffset[index];
    const nextBoundary = index + 1 < entriesByLocalOffset.length
      ? entriesByLocalOffset[index + 1].localHeaderOffset
      : centralDirectoryOffset;
    const localOffset = entry.localHeaderOffset;

    if (
      localOffset + 30 > nextBoundary ||
      readUint32LittleEndian(bytes, localOffset) !==
        ZIP_LOCAL_FILE_HEADER_SIGNATURE
    ) {
      return { ok: false };
    }

    const localVersionNeeded = readUint16LittleEndian(bytes, localOffset + 4);
    const localFlags = readUint16LittleEndian(bytes, localOffset + 6);
    const localCompressionMethod = readUint16LittleEndian(
      bytes,
      localOffset + 8,
    );
    const localCrc32 = readUint32LittleEndian(bytes, localOffset + 14);
    const localCompressedSize = readUint32LittleEndian(bytes, localOffset + 18);
    const localUncompressedSize = readUint32LittleEndian(
      bytes,
      localOffset + 22,
    );
    const localNameLength = readUint16LittleEndian(bytes, localOffset + 26);
    const localExtraLength = readUint16LittleEndian(bytes, localOffset + 28);

    if (
      localVersionNeeded === null ||
      localFlags === null ||
      localCompressionMethod === null ||
      localCrc32 === null ||
      localCompressedSize === null ||
      localUncompressedSize === null ||
      localNameLength === null ||
      localExtraLength === null ||
      localVersionNeeded >= 45 ||
      localVersionNeeded !== entry.versionNeeded ||
      localFlags !== entry.generalPurposeFlags ||
      localCompressionMethod !== entry.compressionMethod ||
      localCompressedSize === 0xffffffff ||
      localUncompressedSize === 0xffffffff ||
      hasUnsupportedZipFlags(localFlags, localCompressionMethod)
    ) {
      return { ok: false };
    }

    const localNameStart = localOffset + 30;
    const localHeaderEnd = localNameStart + localNameLength + localExtraLength;
    if (
      !Number.isSafeInteger(localHeaderEnd) ||
      localHeaderEnd > nextBoundary
    ) {
      return { ok: false };
    }

    const localNameBytes = bytes.slice(
      localNameStart,
      localNameStart + localNameLength,
    );
    const localExtra = bytes.slice(
      localNameStart + localNameLength,
      localHeaderEnd,
    );

    if (
      !bytesEqual(localNameBytes, entry.nameBytes) ||
      !validateZipExtraFields(localExtra)
    ) {
      return { ok: false };
    }

    const compressedDataEnd = localHeaderEnd + entry.compressedSize;
    if (
      !Number.isSafeInteger(compressedDataEnd) ||
      compressedDataEnd > nextBoundary
    ) {
      return { ok: false };
    }

    const usesDataDescriptor =
      (entry.generalPurposeFlags & ZIP_DATA_DESCRIPTOR_FLAG) !== 0;

    if (!usesDataDescriptor) {
      if (
        localCrc32 !== entry.crc32 ||
        localCompressedSize !== entry.compressedSize ||
        localUncompressedSize !== entry.uncompressedSize ||
        compressedDataEnd !== nextBoundary
      ) {
        return { ok: false };
      }
      continue;
    }

    if (
      (localCrc32 !== 0 && localCrc32 !== entry.crc32) ||
      (localCompressedSize !== 0 &&
        localCompressedSize !== entry.compressedSize) ||
      (localUncompressedSize !== 0 &&
        localUncompressedSize !== entry.uncompressedSize)
    ) {
      return { ok: false };
    }

    const descriptorLength = nextBoundary - compressedDataEnd;
    let descriptorCrcOffset: number;

    if (descriptorLength === 16) {
      if (
        readUint32LittleEndian(bytes, compressedDataEnd) !==
          ZIP_DATA_DESCRIPTOR_SIGNATURE
      ) {
        return { ok: false };
      }
      descriptorCrcOffset = compressedDataEnd + 4;
    } else if (descriptorLength === 12) {
      if (
        readUint32LittleEndian(bytes, compressedDataEnd) ===
          ZIP_DATA_DESCRIPTOR_SIGNATURE
      ) {
        return { ok: false };
      }
      descriptorCrcOffset = compressedDataEnd;
    } else {
      return { ok: false };
    }

    const descriptorCrc32 = readUint32LittleEndian(
      bytes,
      descriptorCrcOffset,
    );
    const descriptorCompressedSize = readUint32LittleEndian(
      bytes,
      descriptorCrcOffset + 4,
    );
    const descriptorUncompressedSize = readUint32LittleEndian(
      bytes,
      descriptorCrcOffset + 8,
    );

    if (
      descriptorCrc32 !== entry.crc32 ||
      descriptorCompressedSize !== entry.compressedSize ||
      descriptorUncompressedSize !== entry.uncompressedSize
    ) {
      return { ok: false };
    }
  }

  return { ok: true, entries };
}

function validatePdf(bytes: Uint8Array): boolean {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const maximumStart = Math.min(1024, bytes.length - 8);

  for (let start = 0; start <= maximumStart; start += 1) {
    let matches = true;
    for (let index = 0; index < header.length; index += 1) {
      if (bytes[start + index] !== header[index]) {
        matches = false;
        break;
      }
    }

    if (
      matches &&
      bytes[start + 5] >= 0x30 &&
      bytes[start + 5] <= 0x39 &&
      bytes[start + 6] === 0x2e &&
      bytes[start + 7] >= 0x30 &&
      bytes[start + 7] <= 0x39
    ) {
      return true;
    }
  }

  return false;
}

function parsePng(bytes: Uint8Array): ImageParseResult {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33) {
    return { ok: false, error: "INVALID_FILE_SIGNATURE" };
  }

  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      return { ok: false, error: "INVALID_FILE_SIGNATURE" };
    }
  }

  const firstChunkLength = readUint32BigEndian(bytes, 8);
  if (
    firstChunkLength !== 13 ||
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  ) {
    return { ok: false, error: "INVALID_FILE_SIGNATURE" };
  }

  const width = readUint32BigEndian(bytes, 16);
  const height = readUint32BigEndian(bytes, 20);
  if (width === null || height === null) {
    return { ok: false, error: "INVALID_FILE_SIGNATURE" };
  }

  if (
    width === 0 ||
    height === 0 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION
  ) {
    return { ok: false, error: "INVALID_IMAGE_DIMENSIONS" };
  }

  return { ok: true, width, height };
}

function isStartOfFrameMarker(marker: number): boolean {
  return (
    marker === 0xc0 ||
    marker === 0xc1 ||
    marker === 0xc2 ||
    marker === 0xc3 ||
    marker === 0xc5 ||
    marker === 0xc6 ||
    marker === 0xc7 ||
    marker === 0xc9 ||
    marker === 0xca ||
    marker === 0xcb ||
    marker === 0xcd ||
    marker === 0xce ||
    marker === 0xcf
  );
}

function parseJpeg(bytes: Uint8Array): ImageParseResult {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return { ok: false, error: "INVALID_FILE_SIGNATURE" };
  }

  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return { ok: false, error: "INVALID_FILE_SIGNATURE" };
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= bytes.length) {
      return { ok: false, error: "INVALID_FILE_SIGNATURE" };
    }

    const marker = bytes[offset];
    offset += 1;

    if (
      marker === 0x00 ||
      marker === 0x01 ||
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0xda ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      return { ok: false, error: "INVALID_FILE_SIGNATURE" };
    }

    const segmentLength = readUint16BigEndian(bytes, offset);
    if (segmentLength === null || segmentLength < 2) {
      return { ok: false, error: "INVALID_FILE_SIGNATURE" };
    }

    const segmentEnd = offset + segmentLength;
    if (!Number.isSafeInteger(segmentEnd) || segmentEnd > bytes.length) {
      return { ok: false, error: "INVALID_FILE_SIGNATURE" };
    }

    if (isStartOfFrameMarker(marker)) {
      if (segmentLength < 8) {
        return { ok: false, error: "INVALID_FILE_SIGNATURE" };
      }

      const height = readUint16BigEndian(bytes, offset + 3);
      const width = readUint16BigEndian(bytes, offset + 5);
      const componentCount = bytes[offset + 7];
      const expectedSegmentLength = 8 + 3 * componentCount;

      if (
        height === null ||
        width === null ||
        componentCount === 0 ||
        segmentLength !== expectedSegmentLength
      ) {
        return { ok: false, error: "INVALID_FILE_SIGNATURE" };
      }

      const componentIds = new Set<number>();
      for (
        let componentIndex = 0;
        componentIndex < componentCount;
        componentIndex += 1
      ) {
        const descriptorOffset = offset + 8 + componentIndex * 3;
        if (descriptorOffset + 3 > segmentEnd) {
          return { ok: false, error: "INVALID_FILE_SIGNATURE" };
        }

        const componentId = bytes[descriptorOffset];
        const samplingFactors = bytes[descriptorOffset + 1];
        const horizontalSampling = samplingFactors >>> 4;
        const verticalSampling = samplingFactors & 0x0f;
        const quantisationTable = bytes[descriptorOffset + 2];

        if (
          componentIds.has(componentId) ||
          horizontalSampling === 0 ||
          horizontalSampling > 4 ||
          verticalSampling === 0 ||
          verticalSampling > 4 ||
          quantisationTable > 3
        ) {
          return { ok: false, error: "INVALID_FILE_SIGNATURE" };
        }
        componentIds.add(componentId);
      }

      if (
        width === 0 ||
        height === 0 ||
        width > MAX_IMAGE_DIMENSION ||
        height > MAX_IMAGE_DIMENSION
      ) {
        return { ok: false, error: "INVALID_IMAGE_DIMENSIONS" };
      }

      return { ok: true, width, height };
    }

    offset = segmentEnd;
  }

  return { ok: false, error: "INVALID_FILE_SIGNATURE" };
}

function validateOfficeOpenXml(
  bytes: Uint8Array,
  extension: "docx" | "xlsx",
): boolean {
  const parsed = parseZipEntries(bytes);
  if (!parsed.ok) {
    return false;
  }

  const names = new Set(parsed.entries.map((entry) => entry.name));
  if (!names.has("[Content_Types].xml")) {
    return false;
  }

  if (extension === "docx") {
    return (
      names.has("word/document.xml") &&
      !parsed.entries.some((entry) => entry.name.startsWith("xl/"))
    );
  }

  return (
    names.has("xl/workbook.xml") &&
    !parsed.entries.some((entry) => entry.name.startsWith("word/"))
  );
}

export function validateBinarySignature(
  buffer: ArrayBuffer,
  extension: string,
): BinaryValidationResult {
  const bytes = new Uint8Array(buffer);
  const normalizedExtension = extension.replace(/^\./, "").toLowerCase();

  if (normalizedExtension === "pdf") {
    return validatePdf(bytes)
      ? { isValid: true, detectedType: "pdf" }
      : { isValid: false, error: "INVALID_FILE_SIGNATURE" };
  }

  if (normalizedExtension === "png") {
    const parsed = parsePng(bytes);
    return parsed.ok== true
      ? { isValid: true, detectedType: "png" }
      : { isValid: false, error: parsed.error };
  }

  if (normalizedExtension === "jpg" || normalizedExtension === "jpeg") {
    const parsed = parseJpeg(bytes);
    return parsed.ok== true
      ? { isValid: true, detectedType: "jpeg" }
      : { isValid: false, error: parsed.error };
  }

  if (normalizedExtension === "docx" || normalizedExtension === "xlsx") {
    return validateOfficeOpenXml(bytes, normalizedExtension)
      ? { isValid: true, detectedType: normalizedExtension }
      : { isValid: false, error: "INVALID_FILE_SIGNATURE" };
  }

  return { isValid: false, error: "UNSUPPORTED_FORMAT" };
}

export function parseImageDimensions(
  buffer: ArrayBuffer,
  extension: string,
): ImageDimensionResult {
  const bytes = new Uint8Array(buffer);
  const normalizedExtension = extension.replace(/^\./, "").toLowerCase();
  const parsed = normalizedExtension === "png"
    ? parsePng(bytes)
    : normalizedExtension === "jpg" || normalizedExtension === "jpeg"
    ? parseJpeg(bytes)
    : null;

  if (parsed === null) {
    return { isValid: false, error: "UNSUPPORTED_FORMAT" };
  }

  return parsed.ok==true
    ? {
      isValid: true,
      width: parsed.width,
      height: parsed.height,
    }
    : { isValid: false, error: parsed.error };
}

export async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}