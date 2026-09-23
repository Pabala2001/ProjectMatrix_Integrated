import { deepStrictEqual, match, ok } from "node:assert/strict";
import {
  BackfillAuthError,
  evaluateCandidateAction,
  expandDocumentCandidates,
  invokeIndexWithRetry,
  runBackfill,
  sanitizeLogMessage,
  type CandidateItem,
  type CommunicationDocRow,
  type FileIndexRow,
  type SourceKind,
} from "./backfillProjectAdvisorFileSearch.ts";

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  deepStrictEqual(actual, expected, message);
}

function assert(value: unknown, message?: string): asserts value {
  ok(value, message);
}

function assertMatch(actual: string, expected: RegExp, message?: string): void {
  match(actual, expected, message);
}

const mockCompanyId = "11111111-1111-4111-8111-111111111111";
const mockProjectId1 = "22222222-2222-4222-8222-222222222222";
const mockProjectId2 = "33333333-3333-4333-8333-333333333333";
const mockDocId1 = "44444444-4444-4444-8444-444444444444";
const mockDocId2 = "55555555-5555-4555-8555-555555555555";

Deno.test("1. Candidate expansion creates targets for uploaded, signed, and generated paths", () => {
  const docFull: CommunicationDocRow = {
    id: mockDocId1,
    company_id: mockCompanyId,
    project_id: mockProjectId1,
    uploaded_file_path: "company/proj/upload.pdf",
    signed_file_path: "company/proj/signed.pdf",
    generated_docx_path: "company/proj/gen.docx",
  };

  const candidates = expandDocumentCandidates(docFull);
  assertEquals(candidates.length, 3);
  assertEquals(candidates[0].sourceKind, "uploaded");
  assertEquals(candidates[1].sourceKind, "signed");
  assertEquals(candidates[2].sourceKind, "generated");

  const docPartial: CommunicationDocRow = {
    id: mockDocId2,
    company_id: mockCompanyId,
    project_id: mockProjectId1,
    uploaded_file_path: "company/proj/upload.pdf",
    signed_file_path: null,
    generated_docx_path: "",
  };

  const partialCandidates = expandDocumentCandidates(docPartial);
  assertEquals(partialCandidates.length, 1);
  assertEquals(partialCandidates[0].sourceKind, "uploaded");

  const docEmpty: CommunicationDocRow = {
    id: mockDocId2,
    company_id: mockCompanyId,
    project_id: mockProjectId1,
    uploaded_file_path: null,
    signed_file_path: "",
    generated_docx_path: "   ",
  };

  assertEquals(expandDocumentCandidates(docEmpty).length, 0);
});

Deno.test("2. Terminal status evaluation skips ready/unsupported and reports deleting", () => {
  const candidate: CandidateItem = {
    communicationDocumentId: mockDocId1,
    sourceKind: "uploaded",
    companyId: mockCompanyId,
    projectId: mockProjectId1,
  };

  assertEquals(evaluateCandidateAction(candidate, undefined), "process");

  const rowReady: FileIndexRow = {
    id: "idx-1",
    company_id: mockCompanyId,
    project_id: mockProjectId1,
    communication_document_id: mockDocId1,
    source_kind: "uploaded",
    status: "ready",
  };
  assertEquals(evaluateCandidateAction(candidate, rowReady), "skip_ready");

  const rowUnsupported: FileIndexRow = {
    ...rowReady,
    status: "unsupported",
  };
  assertEquals(evaluateCandidateAction(candidate, rowUnsupported), "skip_unsupported");

  const rowDeleting: FileIndexRow = {
    ...rowReady,
    status: "deleting",
  };
  assertEquals(evaluateCandidateAction(candidate, rowDeleting), "report_deleting");

  const rowFailed: FileIndexRow = {
    ...rowReady,
    status: "failed",
  };
  assertEquals(evaluateCandidateAction(candidate, rowFailed), "process");

  const rowIndexing: FileIndexRow = {
    ...rowReady,
    status: "indexing",
  };
  assertEquals(evaluateCandidateAction(candidate, rowIndexing), "process");
});

Deno.test("3. Log sanitisation redacts JWTs, store names, and storage paths", () => {
  const rawLog =
    "Calling indexing with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c on fileSearchStores/store-xyz for 11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/doc.pdf";

  const sanitized = sanitizeLogMessage(rawLog);

  assert(!sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "JWT must be redacted");
  assert(!sanitized.includes("fileSearchStores/store-xyz"), "Store name must be redacted");
  assert(
    !sanitized.includes("11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/doc.pdf"),
    "Storage path must be redacted"
  );
  assertMatch(sanitized, /\[REDACTED_STORE\]/);
  assertMatch(sanitized, /\[REDACTED_STORAGE_PATH\]/);
});

Deno.test("4. Retry logic bounds retries with backoff delays for retryable errors", async () => {
  const delays: number[] = [];
  const mockSleep = async (ms: number) => {
    delays.push(ms);
  };

  let calls = 0;
  const mockInvoker = async (docId: string, sourceKind: SourceKind) => {
    calls++;
    if (calls < 3) {
      return { success: false, code: "GEMINI_TIMEOUT", retryable: true };
    }
    return { success: true, status: "ready" };
  };

  const res = await invokeIndexWithRetry(
    mockDocId1,
    "uploaded",
    mockInvoker,
    mockSleep
  );

  assertEquals(res.success, true);
  assertEquals(calls, 3);
  assertEquals(delays.length, 2);
  assert(delays[0] >= 2000 && delays[0] <= 2500, "First retry delay must be ~2s + jitter");
  assert(delays[1] >= 4000 && delays[1] <= 4500, "Second retry delay must be ~4s + jitter");
});

Deno.test("5. Non-retryable errors abort retries immediately", async () => {
  const delays: number[] = [];
  const mockSleep = async (ms: number) => {
    delays.push(ms);
  };

  let calls = 0;
  const mockInvoker = async () => {
    calls++;
    return { success: false, code: "FILE_TOO_LARGE", retryable: false };
  };

  const res = await invokeIndexWithRetry(
    mockDocId1,
    "uploaded",
    mockInvoker,
    mockSleep
  );

  assertEquals(res.success, false);
  assertEquals(res.code, "FILE_TOO_LARGE");
  assertEquals(calls, 1);
  assertEquals(delays.length, 0);
});

Deno.test("6. Authentication errors throw BackfillAuthError immediately", async () => {
  const mockSleep = async () => {};
  const mockInvoker = async () => {
    return { success: false, code: "AUTHENTICATION_REQUIRED", retryable: false };
  };

  let threw = false;
  try {
    await invokeIndexWithRetry(mockDocId1, "uploaded", mockInvoker, mockSleep);
  } catch (err: any) {
    threw = true;
    assert(err instanceof BackfillAuthError);
    assertEquals(err.code, "AUTHENTICATION_REQUIRED");
  }
  assert(threw, "Must throw BackfillAuthError");
});

Deno.test("7. Dry-run mode evaluates candidates without invoking edge function", async () => {
  let invoked = false;
  const mockInvoker = async () => {
    invoked = true;
    return { success: true };
  };

  const mockDocs: CommunicationDocRow[] = [
    {
      id: mockDocId1,
      company_id: mockCompanyId,
      project_id: mockProjectId1,
      uploaded_file_path: "path/to/upload.pdf",
    },
  ];

  const mockClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: table === "communication_documents" ? mockDocs : [], error: null }),
          then: (cb: any) => cb({ data: table === "communication_documents" ? mockDocs : [], error: null }),
        }),
        then: (cb: any) => cb({ data: table === "communication_documents" ? mockDocs : [], error: null }),
      }),
    }),
  };

  const logs: string[] = [];
  const report = await runBackfill({
    companyId: mockCompanyId,
    dryRun: true,
    supabaseClient: mockClient,
    invokeFunction: mockInvoker,
    logger: (msg) => logs.push(msg),
  });

  assertEquals(invoked, false, "Edge function must not be invoked during dry run");
  assertEquals(report.scannedDocuments, 1);
  assertEquals(report.totalCandidates, 1);
  assertEquals(report.processedSuccess, 1);
  assert(logs.some((l) => l.includes("[DRY-RUN] Would index document")));
});

Deno.test("8. Scope isolation and resumability processes only missing and failed targets", async () => {
  const mockDocs: CommunicationDocRow[] = [
    {
      id: mockDocId1,
      company_id: mockCompanyId,
      project_id: mockProjectId1,
      uploaded_file_path: "upload1.pdf", // ready
      signed_file_path: "signed1.pdf",     // failed -> process
    },
    {
      id: mockDocId2,
      company_id: mockCompanyId,
      project_id: mockProjectId1,
      uploaded_file_path: "upload2.pdf", // missing -> process
      generated_docx_path: "gen2.docx",  // deleting -> report
    },
  ];

  const mockIndexes: FileIndexRow[] = [
    {
      id: "idx-1",
      company_id: mockCompanyId,
      project_id: mockProjectId1,
      communication_document_id: mockDocId1,
      source_kind: "uploaded",
      status: "ready",
    },
    {
      id: "idx-2",
      company_id: mockCompanyId,
      project_id: mockProjectId1,
      communication_document_id: mockDocId1,
      source_kind: "signed",
      status: "failed",
    },
    {
      id: "idx-3",
      company_id: mockCompanyId,
      project_id: mockProjectId1,
      communication_document_id: mockDocId2,
      source_kind: "generated",
      status: "deleting",
    },
  ];

  const invokedTargets: Array<{ id: string; kind: string }> = [];
  const mockInvoker = async (docId: string, sourceKind: SourceKind) => {
    invokedTargets.push({ id: docId, kind: sourceKind });
    return { success: true, status: "ready" };
  };

  const mockClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: (field: string, val: string) => ({
          eq: () => Promise.resolve({
            data: table === "communication_documents" ? mockDocs : mockIndexes,
            error: null,
          }),
          then: (cb: any) => cb({
            data: table === "communication_documents" ? mockDocs : mockIndexes,
            error: null,
          }),
        }),
      }),
    }),
  };

  const report = await runBackfill({
    companyId: mockCompanyId,
    projectId: mockProjectId1,
    dryRun: false,
    supabaseClient: mockClient,
    invokeFunction: mockInvoker,
  });

  assertEquals(report.scannedDocuments, 2);
  assertEquals(report.totalCandidates, 4);
  assertEquals(report.skippedReady, 1);
  assertEquals(report.reportedDeleting, 1);
  assertEquals(report.processedSuccess, 2);
  assertEquals(invokedTargets.length, 2);
  assert(invokedTargets.some((t) => t.id === mockDocId1 && t.kind === "signed"));
  assert(invokedTargets.some((t) => t.id === mockDocId2 && t.kind === "uploaded"));
});

Deno.test("9. Concurrency processes max 2 project queues concurrently", async () => {
  const mockDocs: CommunicationDocRow[] = [
    { id: "doc-1", company_id: mockCompanyId, project_id: mockProjectId1, uploaded_file_path: "p1.pdf" },
    { id: "doc-2", company_id: mockCompanyId, project_id: mockProjectId2, uploaded_file_path: "p2.pdf" },
    { id: "doc-3", company_id: mockCompanyId, project_id: "44444444-9999-4444-8444-444444444444", uploaded_file_path: "p3.pdf" },
  ];

  let activeInvocations = 0;
  let maxActiveObserved = 0;

  const mockInvoker = async () => {
    activeInvocations++;
    if (activeInvocations > maxActiveObserved) {
      maxActiveObserved = activeInvocations;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
    activeInvocations--;
    return { success: true, status: "ready" };
  };

  const mockClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: table === "communication_documents" ? mockDocs : [], error: null }),
          then: (cb: any) => cb({ data: table === "communication_documents" ? mockDocs : [], error: null }),
        }),
        then: (cb: any) => cb({ data: table === "communication_documents" ? mockDocs : [], error: null }),
      }),
    }),
  };

  const report = await runBackfill({
    companyId: mockCompanyId,
    maxProjectConcurrency: 2,
    supabaseClient: mockClient,
    invokeFunction: mockInvoker,
  });

  assertEquals(report.scannedDocuments, 3);
  assertEquals(report.processedSuccess, 3);
  assert(maxActiveObserved <= 2, "Max active project workers must not exceed 2");
});
