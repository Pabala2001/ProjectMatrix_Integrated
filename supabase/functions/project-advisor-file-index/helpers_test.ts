import { deepStrictEqual, match, ok } from "node:assert/strict";

import {
  type CommunicationDocumentRow,
  computeSha256,
  getMimeTypeAndAllowlistCheck,
  mapSourceKindToDocumentFields,
  MAX_FILE_SIZE_BYTES,
  parseImageDimensions as parseImageDimensionsFromArrayBuffer,
  sanitizeFilename,
  type SourceKind,
  validateBinarySignature as validateBinarySignatureFromArrayBuffer,
  validateFileSize,
  validateRequestPayload,
  validateStoragePath,
} from "./helpers.ts";

function assert(
  value: unknown,
  message?: string,
): asserts value {
  ok(value, message);
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  deepStrictEqual(actual, expected, message);
}

function assertMatch(
  actual: string,
  expected: RegExp,
  message?: string,
): void {
  match(actual, expected, message);
}

function toOwnedArrayBuffer(buffer: ArrayBufferLike): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(new Uint8Array(buffer));
  return copy.buffer;
}

function validateBinarySignature(
  buffer: ArrayBufferLike,
  extension: string,
) {
  return validateBinarySignatureFromArrayBuffer(
    toOwnedArrayBuffer(buffer),
    extension,
  );
}

function parseImageDimensions(
  buffer: ArrayBufferLike,
  extension: string,
) {
  return parseImageDimensionsFromArrayBuffer(
    toOwnedArrayBuffer(buffer),
    extension,
  );
}

const COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";
const PROJECT_ID = "8f14e45f-ea6f-4a9f-9234-123456789abc";
const DOCUMENT_ID = "123e4567-e89b-42d3-a456-426614174000";

interface ZipEntrySpec {
  name: string;
  data?: Uint8Array;
  method?: 0 | 8;
  flags?: number;
  centralFlags?: number;
  localVersionNeeded?: number;
  centralVersionNeeded?: number;
  versionMadeBy?: number;
  localExtra?: Uint8Array;
  centralExtra?: Uint8Array;
  centralCrc32?: number;
  localCrc32?: number;
  centralCompressedSize?: number;
  centralUncompressedSize?: number;
  localCompressedSize?: number;
  localUncompressedSize?: number;
  descriptor?:
    | "signed"
    | "unsigned"
    | "zip64-signed"
    | "zip64-unsigned"
    | "missing";
  descriptorCrc32?: number;
  descriptorCompressedSize?: number;
  descriptorUncompressedSize?: number;
}

interface ZipBuildOptions {
  comment?: Uint8Array;
  corruptEocdCdOffset?: number;
  corruptEocdCdSize?: number;
}

interface BuiltZip {
  bytes: Uint8Array;
  localOffsets: number[];
  centralRecordOffsets: number[];
  centralOffset: number;
  eocdOffset: number;
}

interface BuiltEntry {
  spec: ZipEntrySpec;
  nameBytes: Uint8Array;
  localOffset: number;
  flags: number;
  centralFlags: number;
  method: 0 | 8;
  versionMadeBy: number;
  localVersionNeeded: number;
  centralVersionNeeded: number;
  localExtra: Uint8Array;
  centralExtra: Uint8Array;
  crc32: number;
  localCrc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localCompressedSize: number;
  localUncompressedSize: number;
}

function pushUint16LittleEndian(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUint32LittleEndian(target: number[], value: number): void {
  const normalized = value >>> 0;
  target.push(
    normalized & 0xff,
    (normalized >>> 8) & 0xff,
    (normalized >>> 16) & 0xff,
    (normalized >>> 24) & 0xff,
  );
}

function pushUint64LittleEndian(target: number[], value: number): void {
  pushUint32LittleEndian(target, value);
  pushUint32LittleEndian(target, 0);
}

function setUint16LittleEndian(
  target: Uint8Array,
  offset: number,
  value: number,
): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function setUint32LittleEndian(
  target: Uint8Array,
  offset: number,
  value: number,
): void {
  const normalized = value >>> 0;
  target[offset] = normalized & 0xff;
  target[offset + 1] = (normalized >>> 8) & 0xff;
  target[offset + 2] = (normalized >>> 16) & 0xff;
  target[offset + 3] = (normalized >>> 24) & 0xff;
}

function setUint32BigEndian(
  target: Uint8Array,
  offset: number,
  value: number,
): void {
  const normalized = value >>> 0;
  target[offset] = (normalized >>> 24) & 0xff;
  target[offset + 1] = (normalized >>> 16) & 0xff;
  target[offset + 2] = (normalized >>> 8) & 0xff;
  target[offset + 3] = normalized & 0xff;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeExtraField(id: number, data = new Uint8Array()): Uint8Array {
  const result: number[] = [];
  pushUint16LittleEndian(result, id);
  pushUint16LittleEndian(result, data.length);
  result.push(...data);
  return new Uint8Array(result);
}

function buildZip(
  entrySpecs: ZipEntrySpec[],
  options?: ZipBuildOptions,
): BuiltZip {
  const output: number[] = [];
  const encoder = new TextEncoder();
  const builtEntries: BuiltEntry[] = [];
  const localOffsets: number[] = [];

  for (const spec of entrySpecs) {
    const data = spec.data ?? new Uint8Array();
    const nameBytes = encoder.encode(spec.name);
    const flags = spec.flags ?? 0;
    const centralFlags = spec.centralFlags ?? flags;
    const method = spec.method ?? 0;
    const localVersionNeeded = spec.localVersionNeeded ?? 20;
    const centralVersionNeeded = spec.centralVersionNeeded ??
      localVersionNeeded;
    const versionMadeBy = spec.versionMadeBy ?? 20;
    const localExtra = spec.localExtra ?? new Uint8Array();
    const centralExtra = spec.centralExtra ?? new Uint8Array();
    const calculatedCrc = crc32(data);
    const crc = spec.centralCrc32 ?? calculatedCrc;
    const compressedSize = spec.centralCompressedSize ?? data.length;
    const uncompressedSize = spec.centralUncompressedSize ?? data.length;
    const usesDescriptor = (flags & 0x0008) !== 0;
    const localCrc = spec.localCrc32 ?? (usesDescriptor ? 0 : crc);
    const localCompressedSize = spec.localCompressedSize ??
      (usesDescriptor ? 0 : compressedSize);
    const localUncompressedSize = spec.localUncompressedSize ??
      (usesDescriptor ? 0 : uncompressedSize);
    const localOffset = output.length;

    localOffsets.push(localOffset);
    pushUint32LittleEndian(output, 0x04034b50);
    pushUint16LittleEndian(output, localVersionNeeded);
    pushUint16LittleEndian(output, flags);
    pushUint16LittleEndian(output, method);
    pushUint16LittleEndian(output, 0);
    pushUint16LittleEndian(output, 0);
    pushUint32LittleEndian(output, localCrc);
    pushUint32LittleEndian(output, localCompressedSize);
    pushUint32LittleEndian(output, localUncompressedSize);
    pushUint16LittleEndian(output, nameBytes.length);
    pushUint16LittleEndian(output, localExtra.length);
    output.push(...nameBytes, ...localExtra, ...data);

    if (usesDescriptor) {
      const descriptorKind = spec.descriptor ?? "signed";
      const descriptorCrc = spec.descriptorCrc32 ?? crc;
      const descriptorCompressedSize = spec.descriptorCompressedSize ??
        compressedSize;
      const descriptorUncompressedSize = spec.descriptorUncompressedSize ??
        uncompressedSize;

      if (descriptorKind === "signed") {
        pushUint32LittleEndian(output, 0x08074b50);
        pushUint32LittleEndian(output, descriptorCrc);
        pushUint32LittleEndian(output, descriptorCompressedSize);
        pushUint32LittleEndian(output, descriptorUncompressedSize);
      } else if (descriptorKind === "unsigned") {
        pushUint32LittleEndian(output, descriptorCrc);
        pushUint32LittleEndian(output, descriptorCompressedSize);
        pushUint32LittleEndian(output, descriptorUncompressedSize);
      } else if (descriptorKind === "zip64-signed") {
        pushUint32LittleEndian(output, 0x08074b50);
        pushUint32LittleEndian(output, descriptorCrc);
        pushUint64LittleEndian(output, descriptorCompressedSize);
        pushUint64LittleEndian(output, descriptorUncompressedSize);
      } else if (descriptorKind === "zip64-unsigned") {
        pushUint32LittleEndian(output, descriptorCrc);
        pushUint64LittleEndian(output, descriptorCompressedSize);
        pushUint64LittleEndian(output, descriptorUncompressedSize);
      }
    }

    builtEntries.push({
      spec,
      nameBytes,
      localOffset,
      flags,
      centralFlags,
      method,
      versionMadeBy,
      localVersionNeeded,
      centralVersionNeeded,
      localExtra,
      centralExtra,
      crc32: crc,
      localCrc32: localCrc,
      compressedSize,
      uncompressedSize,
      localCompressedSize,
      localUncompressedSize,
    });
  }

  const centralOffset = output.length;
  const centralRecordOffsets: number[] = [];

  for (const entry of builtEntries) {
    centralRecordOffsets.push(output.length);
    pushUint32LittleEndian(output, 0x02014b50);
    pushUint16LittleEndian(output, entry.versionMadeBy);
    pushUint16LittleEndian(output, entry.centralVersionNeeded);
    pushUint16LittleEndian(output, entry.centralFlags);
    pushUint16LittleEndian(output, entry.method);
    pushUint16LittleEndian(output, 0);
    pushUint16LittleEndian(output, 0);
    pushUint32LittleEndian(output, entry.crc32);
    pushUint32LittleEndian(output, entry.compressedSize);
    pushUint32LittleEndian(output, entry.uncompressedSize);
    pushUint16LittleEndian(output, entry.nameBytes.length);
    pushUint16LittleEndian(output, entry.centralExtra.length);
    pushUint16LittleEndian(output, 0);
    pushUint16LittleEndian(output, 0);
    pushUint16LittleEndian(output, 0);
    pushUint32LittleEndian(output, 0);
    pushUint32LittleEndian(output, entry.localOffset);
    output.push(...entry.nameBytes, ...entry.centralExtra);
  }

  const centralSize = output.length - centralOffset;
  const eocdOffset = output.length;
  const comment = options?.comment ?? new Uint8Array();

  pushUint32LittleEndian(output, 0x06054b50);
  pushUint16LittleEndian(output, 0);
  pushUint16LittleEndian(output, 0);
  pushUint16LittleEndian(output, builtEntries.length);
  pushUint16LittleEndian(output, builtEntries.length);
  pushUint32LittleEndian(
    output,
    options?.corruptEocdCdSize ?? centralSize,
  );
  pushUint32LittleEndian(
    output,
    options?.corruptEocdCdOffset ?? centralOffset,
  );
  pushUint16LittleEndian(output, comment.length);
  output.push(...comment);

  return {
    bytes: new Uint8Array(output),
    localOffsets,
    centralRecordOffsets,
    centralOffset,
    eocdOffset,
  };
}

function buildDocx(
  options?: ZipBuildOptions,
  entryOverrides?: Partial<ZipEntrySpec>,
): BuiltZip {
  return buildZip(
    [
      { name: "[Content_Types].xml", ...entryOverrides },
      { name: "word/document.xml" },
    ],
    options,
  );
}

function buildXlsx(options?: ZipBuildOptions): BuiltZip {
  return buildZip(
    [
      { name: "[Content_Types].xml" },
      { name: "xl/workbook.xml" },
    ],
    options,
  );
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function concatenateBytes(...parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function makePng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    0,
  );
  setUint32BigEndian(bytes, 8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  setUint32BigEndian(bytes, 16, width);
  setUint32BigEndian(bytes, 20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return bytes;
}

function makeJpeg(width: number, height: number): Uint8Array {
  const bytes: number[] = [
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
  ];
  return new Uint8Array(bytes);
}

function baseDocument(): CommunicationDocumentRow {
  return {
    id: DOCUMENT_ID,
    company_id: COMPANY_ID,
    project_id: PROJECT_ID,
    document_title: "Engineer instruction",
    subject: "Reservoir works",
    document_number: "PM-COM-001",
    uploaded_file_path: `${COMPANY_ID}/${PROJECT_ID}/uploaded/report.pdf`,
    uploaded_file_name: "report.pdf",
    uploaded_file_type: "application/pdf",
    uploaded_file_size: "2048",
    signed_file_path: `${COMPANY_ID}/${PROJECT_ID}/signed/signed-report.pdf`,
    signed_file_name: "signed-report.pdf",
    generated_docx_path:
      `${COMPANY_ID}/${PROJECT_ID}/generated/generated-report.docx`,
  };
}

Deno.test("validateRequestPayload accepts valid index and delete payloads", () => {
  for (const action of ["index", "delete"] as const) {
    const result = validateRequestPayload({
      action,
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "uploaded",
    });
    assertEquals(result.isValid, true);
    assertEquals(result.data?.action, action);
  }
});

Deno.test("validateRequestPayload rejects null, arrays, and malformed bodies", () => {
  assertEquals(validateRequestPayload(null).error, "INVALID_REQUEST");
  assertEquals(validateRequestPayload([]).error, "INVALID_REQUEST");
  assertEquals(validateRequestPayload("request").error, "INVALID_REQUEST");
  assertEquals(
    validateRequestPayload({
      action: "index",
      communicationDocumentId: DOCUMENT_ID,
    }).error,
    "INVALID_REQUEST",
  );
});

Deno.test("validateRequestPayload rejects unknown and caller-supplied scope keys", () => {
  assertEquals(
    validateRequestPayload({
      action: "index",
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "uploaded",
      companyId: COMPANY_ID,
    }).error,
    "INVALID_REQUEST",
  );
  assertEquals(
    validateRequestPayload({
      action: "index",
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "uploaded",
      storagePath: `${COMPANY_ID}/${PROJECT_ID}/report.pdf`,
      providerDocumentName: "documents/123",
    }).error,
    "INVALID_REQUEST",
  );
});

Deno.test("validateRequestPayload returns stable codes for action, UUID, and source errors", () => {
  assertEquals(
    validateRequestPayload({
      action: "replace",
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "uploaded",
    }).error,
    "INVALID_REQUEST",
  );
  assertEquals(
    validateRequestPayload({
      action: "index",
      communicationDocumentId: "not-a-uuid",
      sourceKind: "uploaded",
    }).error,
    "INVALID_UUID",
  );
  assertEquals(
    validateRequestPayload({
      action: "index",
      communicationDocumentId: DOCUMENT_ID,
      sourceKind: "unknown",
    }).error,
    "INVALID_SOURCE_KIND",
  );
});

Deno.test("mapSourceKindToDocumentFields maps uploaded fields only", () => {
  const mapped = mapSourceKindToDocumentFields(baseDocument(), "uploaded");
  assertEquals(mapped, {
    filePath: `${COMPANY_ID}/${PROJECT_ID}/uploaded/report.pdf`,
    fileName: "report.pdf",
    fileType: "application/pdf",
    fileSize: "2048",
  });
});

Deno.test("mapSourceKindToDocumentFields maps signed fields without invented metadata", () => {
  const mapped = mapSourceKindToDocumentFields(baseDocument(), "signed");
  assertEquals(mapped, {
    filePath: `${COMPANY_ID}/${PROJECT_ID}/signed/signed-report.pdf`,
    fileName: "signed-report.pdf",
    fileType: null,
    fileSize: null,
  });
});

Deno.test("mapSourceKindToDocumentFields maps generated fields without invented metadata", () => {
  const mapped = mapSourceKindToDocumentFields(baseDocument(), "generated");
  assertEquals(mapped, {
    filePath: `${COMPANY_ID}/${PROJECT_ID}/generated/generated-report.docx`,
    fileName: "generated-report.docx",
    fileType: null,
    fileSize: null,
  });
});

Deno.test("source mapping uses database name, Storage name, title, subject, then fallback", () => {
  const doc = baseDocument();
  doc.uploaded_file_name = "../unsafe.pdf";
  assertEquals(
    mapSourceKindToDocumentFields(doc, "uploaded").fileName,
    "report.pdf",
  );

  doc.uploaded_file_path = null;
  assertEquals(
    mapSourceKindToDocumentFields(doc, "uploaded").fileName,
    "Engineer instruction",
  );

  doc.document_title = null;
  assertEquals(
    mapSourceKindToDocumentFields(doc, "uploaded").fileName,
    "Reservoir works",
  );

  doc.subject = null;
  assertEquals(
    mapSourceKindToDocumentFields(doc, "uploaded").fileName,
    "document",
  );
});

Deno.test("generated source never disguises an .exe path as DOCX", () => {
  const doc = baseDocument();
  doc.generated_docx_path = `${COMPANY_ID}/${PROJECT_ID}/generated/malware.exe`;
  const mapped = mapSourceKindToDocumentFields(doc, "generated");
  assertEquals(mapped.fileName, "malware.exe");
  assertEquals(
    getMimeTypeAndAllowlistCheck(mapped.fileName ?? "").error,
    "UNSUPPORTED_FORMAT",
  );
});

Deno.test("generated title fallback receives DOCX only when no original filename exists", () => {
  const doc = baseDocument();
  doc.generated_docx_path = null;
  assertEquals(
    mapSourceKindToDocumentFields(doc, "generated").fileName,
    "Engineer instruction.docx",
  );
});

Deno.test("source mapping rejects a runtime-invalid source kind", () => {
  const result = mapSourceKindToDocumentFields(
    baseDocument(),
    "mystery" as SourceKind,
  );
  assertEquals(result.error, "INVALID_SOURCE_KIND");
  assertEquals(result.filePath, null);
});

Deno.test("validateStoragePath accepts the exact company/project prefix", () => {
  assertEquals(
    validateStoragePath(
      `${COMPANY_ID}/${PROJECT_ID}/letters/report.pdf`,
      COMPANY_ID,
      PROJECT_ID,
    ),
    { isValid: true },
  );
});

Deno.test("validateStoragePath rejects cross-tenant and imitated prefixes", () => {
  const otherCompany = "9f14e45f-ea6f-4a9f-9234-123456789abc";
  assertEquals(
    validateStoragePath(
      `${otherCompany}/${PROJECT_ID}/report.pdf`,
      COMPANY_ID,
      PROJECT_ID,
    ).error,
    "INVALID_STORAGE_PATH",
  );
  assertEquals(
    validateStoragePath(
      `${COMPANY_ID}/${PROJECT_ID}0/report.pdf`,
      COMPANY_ID,
      PROJECT_ID,
    ).error,
    "INVALID_STORAGE_PATH",
  );
});

Deno.test("validateStoragePath rejects traversal, separators, queries, fragments, and controls", () => {
  const invalidPaths = [
    `${COMPANY_ID}/${PROJECT_ID}/../report.pdf`,
    `${COMPANY_ID}/${PROJECT_ID}/folder\\report.pdf`,
    `${COMPANY_ID}/${PROJECT_ID}/report.pdf?download=1`,
    `${COMPANY_ID}/${PROJECT_ID}/report.pdf#page=1`,
    `${COMPANY_ID}/${PROJECT_ID}/report\u0000.pdf`,
    `${COMPANY_ID}/${PROJECT_ID}/%2e%2e/report.pdf`,
  ];
  for (const path of invalidPaths) {
    assertEquals(
      validateStoragePath(path, COMPANY_ID, PROJECT_ID).error,
      "INVALID_STORAGE_PATH",
    );
  }
});

Deno.test("validateStoragePath rejects leading/trailing whitespace and slash defects", () => {
  const validPath = `${COMPANY_ID}/${PROJECT_ID}/report.pdf`;
  const invalidPaths = [
    ` ${validPath}`,
    `${validPath} `,
    `/${validPath}`,
    `${COMPANY_ID}/${PROJECT_ID}/`,
    `${COMPANY_ID}/${PROJECT_ID}//report.pdf`,
    `${COMPANY_ID}/${PROJECT_ID}/   /report.pdf`,
  ];
  for (const path of invalidPaths) {
    assertEquals(
      validateStoragePath(path, COMPANY_ID, PROJECT_ID).error,
      "INVALID_STORAGE_PATH",
    );
  }
});

Deno.test("getMimeTypeAndAllowlistCheck accepts the native allowlist", () => {
  const cases = [
    ["file.pdf", "application/pdf"],
    [
      "file.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "file.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    ["file.png", "image/png"],
    ["file.jpg", "image/jpeg"],
    ["file.JPEG", "image/jpeg"],
  ] as const;

  for (const [filename, mime] of cases) {
    assertEquals(
      getMimeTypeAndAllowlistCheck(filename, mime).isSupported,
      true,
    );
  }
});

Deno.test("blank and generic MIME metadata fall back to the extension", () => {
  assertEquals(
    getMimeTypeAndAllowlistCheck("report.pdf", "").isSupported,
    true,
  );
  assertEquals(
    getMimeTypeAndAllowlistCheck("report.pdf", "   ").isSupported,
    true,
  );
  assertEquals(
    getMimeTypeAndAllowlistCheck(
      "report.pdf",
      "application/octet-stream",
    ).isSupported,
    true,
  );
});

Deno.test("unsupported extensions stay unsupported despite allowed MIME claims", () => {
  for (
    const filename of [
      "message.msg",
      "message.eml",
      "legacy.doc",
      "legacy.xls",
      "notes.txt",
      "table.csv",
      "program.exe",
    ]
  ) {
    assertEquals(
      getMimeTypeAndAllowlistCheck(filename, "application/pdf").error,
      "UNSUPPORTED_FORMAT",
    );
  }
});

Deno.test("specific MIME metadata must agree with the original extension", () => {
  const result = getMimeTypeAndAllowlistCheck("report.pdf", "image/png");
  assertEquals(result.isSupported, false);
  assertEquals(result.error, "MIME_MISMATCH");
  assertEquals(result.mimeType, "application/pdf");
});

Deno.test("sanitizeFilename preserves a verified extension after truncation", () => {
  const result = sanitizeFilename(
    `${"very-long-report-name-".repeat(20)}final.docx`,
    null,
    "docx",
  );
  assert(result.length <= 120);
  assert(result.endsWith(".docx"));
  assertEquals(result.endsWith(".d"), false);
});

Deno.test("sanitizeFilename removes path separators and control characters", () => {
  const result = sanitizeFilename(
    "folder\\bad/name\u0000.pdf",
    "fallback",
    "pdf",
  );
  assertEquals(result.includes("\\"), false);
  assertEquals(result.includes("/"), false);
  assertEquals(result.includes("\u0000"), false);
  assert(result.endsWith(".pdf"));
});

Deno.test("validateFileSize accepts strict positive integer sizes", () => {
  assertEquals(validateFileSize(1), { isValid: true, bytes: 1 });
  assertEquals(validateFileSize("001024"), {
    isValid: true,
    bytes: 1024,
  });
  assertEquals(validateFileSize(MAX_FILE_SIZE_BYTES), {
    isValid: true,
    bytes: MAX_FILE_SIZE_BYTES,
  });
  assertEquals(validateFileSize(null), { isValid: true });
});

Deno.test("validateFileSize rejects malformed declared sizes", () => {
  const invalidSizes: Array<number | string> = [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    "",
    " ",
    "1.5",
    "1e3",
    "+100",
    "-100",
    " 100",
    "100 ",
  ];
  for (const size of invalidSizes) {
    assertEquals(validateFileSize(size).error, "INVALID_FILE_SIZE");
  }
});

Deno.test("validateFileSize rejects excessive declared and actual sizes", () => {
  assertEquals(
    validateFileSize(MAX_FILE_SIZE_BYTES + 1).error,
    "FILE_TOO_LARGE",
  );
  assertEquals(
    validateFileSize(String(MAX_FILE_SIZE_BYTES + 1)).error,
    "FILE_TOO_LARGE",
  );
  assertEquals(
    validateFileSize(null, MAX_FILE_SIZE_BYTES + 1).error,
    "FILE_TOO_LARGE",
  );
});

Deno.test("validateFileSize rejects invalid actual sizes and size mismatches", () => {
  for (const actual of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertEquals(
      validateFileSize(null, actual).error,
      "INVALID_FILE_SIZE",
    );
  }
  assertEquals(validateFileSize(10, 11).error, "INVALID_FILE_SIZE");
  assertEquals(validateFileSize(10, 10), { isValid: true, bytes: 10 });
});

Deno.test("validateBinarySignature accepts a valid PDF header near the beginning", () => {
  const bytes = new TextEncoder().encode("\uFEFF\n%PDF-1.7\n");
  assertEquals(validateBinarySignature(bytes.buffer, "pdf"), {
    isValid: true,
    detectedType: "pdf",
  });
});

Deno.test("validateBinarySignature rejects malformed and truncated PDF headers", () => {
  for (const text of ["PDF-1.7", "%PDF-", "%PDF-X.Y", "not a pdf"]) {
    const bytes = new TextEncoder().encode(text);
    assertEquals(
      validateBinarySignature(bytes.buffer, "pdf").error,
      "INVALID_FILE_SIGNATURE",
    );
  }
});

Deno.test("PNG validation and dimension parsing share a valid IHDR parser", () => {
  const png = makePng(640, 480);
  assertEquals(validateBinarySignature(png.buffer, "png"), {
    isValid: true,
    detectedType: "png",
  });
  assertEquals(parseImageDimensions(png.buffer, "png"), {
    isValid: true,
    width: 640,
    height: 480,
  });
});

Deno.test("PNG parser rejects bad signature, chunk type, IHDR length, and truncation", () => {
  const badSignature = makePng(10, 10);
  badSignature[0] = 0;
  const badChunkType = makePng(10, 10);
  badChunkType[12] = 0x49;
  badChunkType[13] = 0x44;
  badChunkType[14] = 0x41;
  badChunkType[15] = 0x54;
  const badLength = makePng(10, 10);
  setUint32BigEndian(badLength, 8, 12);
  const truncated = makePng(10, 10).slice(0, 32);

  for (const png of [badSignature, badChunkType, badLength, truncated]) {
    assertEquals(
      validateBinarySignature(png.buffer, "png").error,
      "INVALID_FILE_SIGNATURE",
    );
    assertEquals(
      parseImageDimensions(png.buffer, "png").error,
      "INVALID_FILE_SIGNATURE",
    );
  }
});

Deno.test("PNG parser rejects zero and oversized dimensions", () => {
  for (const png of [makePng(0, 10), makePng(10, 0), makePng(4097, 10)]) {
    assertEquals(
      validateBinarySignature(png.buffer, "png").error,
      "INVALID_IMAGE_DIMENSIONS",
    );
  }
});

Deno.test("JPEG validation and dimension parsing accept a complete SOF", () => {
  const jpeg = makeJpeg(800, 600);
  assertEquals(validateBinarySignature(jpeg.buffer, "jpg"), {
    isValid: true,
    detectedType: "jpeg",
  });
  assertEquals(parseImageDimensions(jpeg.buffer, "jpeg"), {
    isValid: true,
    width: 800,
    height: 600,
  });
});

Deno.test("JPEG parser rejects missing marker prefixes and repeated SOI", () => {
  const missingPrefix = makeJpeg(100, 100);
  missingPrefix[8] = 0;
  const repeatedSoi = concatenateBytes(
    new Uint8Array([0xff, 0xd8]),
    makeJpeg(100, 100),
  );

  for (const jpeg of [missingPrefix, repeatedSoi]) {
    assertEquals(
      validateBinarySignature(jpeg.buffer, "jpeg").error,
      "INVALID_FILE_SIGNATURE",
    );
  }
});

Deno.test("JPEG parser rejects invalid segment lengths and truncated descriptors", () => {
  const invalidAppLength = makeJpeg(100, 100);
  invalidAppLength[4] = 0;
  invalidAppLength[5] = 1;

  const oversizedSofLength = concatenateBytes(
    makeJpeg(100, 100),
    new Uint8Array([0, 0, 0]),
  );
  oversizedSofLength[10] = 0;
  oversizedSofLength[11] = 14;

  const truncatedDescriptor = makeJpeg(100, 100).slice(0, 20);
  const sixByteFake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  for (
    const jpeg of [
      invalidAppLength,
      oversizedSofLength,
      truncatedDescriptor,
      sixByteFake,
    ]
  ) {
    assertEquals(
      validateBinarySignature(jpeg.buffer, "jpg").error,
      "INVALID_FILE_SIGNATURE",
    );
  }
});

Deno.test("JPEG parser rejects zero and oversized dimensions", () => {
  for (
    const jpeg of [
      makeJpeg(0, 100),
      makeJpeg(100, 0),
      makeJpeg(4097, 100),
      makeJpeg(100, 4097),
    ]
  ) {
    assertEquals(
      validateBinarySignature(jpeg.buffer, "jpeg").error,
      "INVALID_IMAGE_DIMENSIONS",
    );
  }
});

Deno.test("unsupported image extensions never produce valid dimensions", () => {
  assertEquals(parseImageDimensions(makePng(10, 10).buffer, "gif"), {
    isValid: false,
    error: "UNSUPPORTED_FORMAT",
  });
});

Deno.test("OOXML parser accepts structurally valid minimal DOCX and XLSX packages", () => {
  assertEquals(validateBinarySignature(buildDocx().bytes.buffer, "docx"), {
    isValid: true,
    detectedType: "docx",
  });
  assertEquals(validateBinarySignature(buildXlsx().bytes.buffer, "xlsx"), {
    isValid: true,
    detectedType: "xlsx",
  });
});

Deno.test("OOXML parser rejects generic ZIP, incomplete packages, and fake marker strings", () => {
  const genericZip = buildZip([{ name: "file.txt" }]).bytes;
  const incomplete = buildZip([{ name: "[Content_Types].xml" }]).bytes;
  const fake = new TextEncoder().encode(
    "PK\u0003\u0004[Content_Types].xml word/document.xml",
  );

  for (const bytes of [genericZip, incomplete, fake]) {
    assertEquals(
      validateBinarySignature(bytes.buffer, "docx").error,
      "INVALID_FILE_SIGNATURE",
    );
  }
});

Deno.test("OOXML parser rejects cross-renamed DOCX and XLSX packages", () => {
  assertEquals(
    validateBinarySignature(buildDocx().bytes.buffer, "xlsx").error,
    "INVALID_FILE_SIGNATURE",
  );
  assertEquals(
    validateBinarySignature(buildXlsx().bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );
});

Deno.test("OOXML parser reads central-directory entries beyond the first 4096 bytes", () => {
  const padding = new Uint8Array(5000);
  padding.fill(0x41);
  const zip = buildZip([
    { name: "padding.bin", data: padding },
    { name: "[Content_Types].xml" },
    { name: "word/document.xml" },
  ]);
  assert(zip.centralOffset > 4096);
  assertEquals(validateBinarySignature(zip.bytes.buffer, "docx").isValid, true);
});

Deno.test("ZIP parser rejects central-directory-only and bad local headers", () => {
  const badSignature = buildDocx();
  setUint32LittleEndian(
    badSignature.bytes,
    badSignature.localOffsets[0],
    0x02014b50,
  );
  assertEquals(
    validateBinarySignature(badSignature.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );

  const badOffset = buildDocx();
  setUint32LittleEndian(
    badOffset.bytes,
    badOffset.centralRecordOffsets[0] + 42,
    badOffset.centralOffset + 1,
  );
  assertEquals(
    validateBinarySignature(badOffset.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );
});

Deno.test("ZIP parser rejects local/central filename mismatches and duplicate names", () => {
  const mismatch = buildDocx();
  mismatch.bytes[mismatch.localOffsets[0] + 30] ^= 0x01;
  assertEquals(
    validateBinarySignature(mismatch.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );

  const duplicate = buildZip([
    { name: "[Content_Types].xml" },
    { name: "word/document.xml" },
    { name: "word/document.xml" },
  ]);
  assertEquals(
    validateBinarySignature(duplicate.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );
});

Deno.test("ZIP parser requires exact local and central general-purpose flags", () => {
  const zip = buildDocx(undefined, {
    flags: 0,
    centralFlags: 0x0800,
  });
  assertEquals(
    validateBinarySignature(zip.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );
});

Deno.test("ZIP parser accepts signed and unsigned standard data descriptors", () => {
  for (const descriptor of ["signed", "unsigned"] as const) {
    const zip = buildDocx(undefined, {
      flags: 0x0008,
      descriptor,
    });
    assertEquals(
      validateBinarySignature(zip.bytes.buffer, "docx").isValid,
      true,
    );
  }
});

Deno.test("ZIP parser rejects missing and mismatched data descriptors", () => {
  const cases: Array<Partial<ZipEntrySpec>> = [
    { flags: 0x0008, descriptor: "missing" },
    { flags: 0x0008, descriptor: "signed", descriptorCrc32: 1 },
    {
      flags: 0x0008,
      descriptor: "signed",
      descriptorCompressedSize: 1,
    },
    {
      flags: 0x0008,
      descriptor: "unsigned",
      descriptorUncompressedSize: 1,
    },
  ];

  for (const entryOverride of cases) {
    const zip = buildDocx(undefined, entryOverride);
    assertEquals(
      validateBinarySignature(zip.bytes.buffer, "docx").error,
      "INVALID_FILE_SIGNATURE",
    );
  }
});

Deno.test("ZIP parser rejects signed and unsigned ZIP64 data descriptors", () => {
  for (
    const descriptor of ["zip64-signed", "zip64-unsigned"] as const
  ) {
    const zip = buildDocx(undefined, {
      flags: 0x0008,
      descriptor,
    });
    assertEquals(
      validateBinarySignature(zip.bytes.buffer, "docx").error,
      "INVALID_FILE_SIGNATURE",
    );
  }
});

Deno.test("ZIP parser rejects stored entries with unequal sizes or compression flags", () => {
  const unequalSizes = buildDocx(undefined, {
    centralCompressedSize: 0,
    centralUncompressedSize: 1,
    localCompressedSize: 0,
    localUncompressedSize: 1,
  });
  assertEquals(
    validateBinarySignature(unequalSizes.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );

  for (const flags of [0x0002, 0x0004, 0x0006]) {
    const zip = buildDocx(undefined, { flags });
    assertEquals(
      validateBinarySignature(zip.bytes.buffer, "docx").error,
      "INVALID_FILE_SIGNATURE",
    );
  }
});

Deno.test("ZIP parser accepts high version-made-by when version-needed is ordinary", () => {
  const zip = buildDocx(undefined, {
    versionMadeBy: 63,
    localVersionNeeded: 20,
    centralVersionNeeded: 20,
  });
  assertEquals(validateBinarySignature(zip.bytes.buffer, "docx").isValid, true);
});

Deno.test("ZIP parser rejects ZIP64-required versions, sentinels, and extra fields", () => {
  const highVersion = buildDocx(undefined, {
    localVersionNeeded: 45,
    centralVersionNeeded: 45,
  });
  assertEquals(
    validateBinarySignature(highVersion.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );

  const localSentinel = buildDocx(undefined, {
    localCompressedSize: 0xffffffff,
  });
  assertEquals(
    validateBinarySignature(localSentinel.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );

  const zip64Extra = makeExtraField(0x0001);
  const extraFieldZip = buildDocx(undefined, {
    localExtra: zip64Extra,
    centralExtra: zip64Extra,
  });
  assertEquals(
    validateBinarySignature(extraFieldZip.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );
});

Deno.test("ZIP parser accepts a correctly encoded non-zero EOCD comment", () => {
  const zip = buildDocx({
    comment: new TextEncoder().encode("ProjectMatrix test archive"),
  });
  assertEquals(validateBinarySignature(zip.bytes.buffer, "docx").isValid, true);
});

Deno.test("ZIP parser rejects mismatched EOCD comment length and trailing bytes", () => {
  const badCommentLength = buildDocx({
    comment: new TextEncoder().encode("comment"),
  });
  setUint16LittleEndian(
    badCommentLength.bytes,
    badCommentLength.eocdOffset + 20,
    50,
  );
  assertEquals(
    validateBinarySignature(badCommentLength.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );

  const valid = buildDocx();
  const withTrailingByte = concatenateBytes(valid.bytes, new Uint8Array([0]));
  assertEquals(
    validateBinarySignature(withTrailingByte.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );
});

Deno.test("ZIP parser rejects separate corrupted EOCD offset and size cases", () => {
  const baseline = buildDocx();
  const badOffset = buildDocx({
    corruptEocdCdOffset: baseline.centralOffset + 1,
  });
  const badSize = buildDocx({
    corruptEocdCdSize: baseline.eocdOffset - baseline.centralOffset + 1,
  });

  assertEquals(
    validateBinarySignature(badOffset.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );
  assertEquals(
    validateBinarySignature(badSize.bytes.buffer, "docx").error,
    "INVALID_FILE_SIGNATURE",
  );
});

Deno.test("ZIP fixtures use CRC32 zero for empty stored entries", () => {
  const zip = buildDocx();
  const firstLocalOffset = zip.localOffsets[0];
  assertEquals(
    Array.from(zip.bytes.slice(firstLocalOffset + 14, firstLocalOffset + 18)),
    [0, 0, 0, 0],
  );
});

Deno.test("validateBinarySignature rejects an unsupported extension", () => {
  assertEquals(
    validateBinarySignature(new ArrayBuffer(8), "exe").error,
    "UNSUPPORTED_FORMAT",
  );
});

Deno.test("computeSha256 returns the known lowercase 64-character vector", async () => {
  const bytes = new TextEncoder().encode("hello world");
  const digest = await computeSha256(bytes.buffer);
  assertEquals(
    digest,
    "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  );
  assertMatch(digest, /^[0-9a-f]{64}$/);
});

Deno.test("test ZIP helper copy preserves independent mutation", () => {
  const original = buildDocx().bytes;
  const copied = copyBytes(original);
  copied[0] ^= 0xff;
  assert(original[0] !== copied[0]);
});