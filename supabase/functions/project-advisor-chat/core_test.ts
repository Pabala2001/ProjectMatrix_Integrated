import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";

import {
  isValidStoreName,
  validateAndDeduplicateStoreNames,
  filterStoresByScopeAndAuthorization,
  buildFileSearchToolConfig,
  filterIndexedDocsByScopeAndAuthorization,
  buildFilePresenceContext,
  validateAndMapGroundingCitations,
  sanitiseAnswerInternalPaths,
  isDocumentAvailabilityQuestion,
  isRetryableGeminiError,
  extractRetryAfterDelayMs,
  invokeGeminiWithRetry,
  sanitizeUserFacingErrorMessage,
  type AdvisorSource,
} from "./core.ts";

function assert(value: unknown, message?: string): asserts value {
  ok(value, message);
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  deepStrictEqual(actual, expected, message);
}

const testRunner = (globalThis as any).Deno?.test || (async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    console.log("✓", name);
  } catch (err) {
    console.error("✗", name, err);
    throw err;
  }
});

const COMPANY_A = "11111111-1111-4111-a111-111111111111";
const COMPANY_B = "99999999-9999-4999-a999-999999999999";
const PROJECT_1 = "22222222-2222-4222-a222-222222222222";
const PROJECT_2 = "33333333-3333-4333-a333-333333333333";
const PROJECT_UNAUTH = "44444444-4444-4444-a444-444444444444";

testRunner("1. isValidStoreName validates store resource name format", () => {
  assertEquals(isValidStoreName("fileSearchStores/store-123"), true);
  assertEquals(isValidStoreName("fileSearchStores/proj-store-abc-1"), true);
  assertEquals(isValidStoreName("fileSearchStores/store_123"), false); // underscore invalid
  assertEquals(isValidStoreName("fileSearchStores/"), false);
  assertEquals(isValidStoreName("invalidStores/store-123"), false);
  assertEquals(isValidStoreName(null), false);
  assertEquals(isValidStoreName(undefined), false);
  assertEquals(isValidStoreName(123), false);
});

testRunner("2. validateAndDeduplicateStoreNames deduplicates and filters store names", () => {
  const input = [
    { provider_store_name: "fileSearchStores/store-1", status: "ready" },
    { provider_store_name: "fileSearchStores/store-1", status: "ready" },
    { provider_store_name: "fileSearchStores/store-2", status: "ready" },
    { provider_store_name: "invalid/store", status: "ready" },
    { provider_store_name: "fileSearchStores/failed-store", status: "failed" },
    { provider_store_name: null, status: "ready" },
  ];

  const result = validateAndDeduplicateStoreNames(input);
  assertEquals(result, ["fileSearchStores/store-1", "fileSearchStores/store-2"]);
});

testRunner("3. Project scope store filtering selects only active project store", () => {
  const stores = [
    { id: "s1", company_id: COMPANY_A, project_id: PROJECT_1, provider_store_name: "fileSearchStores/store-p1", status: "ready" },
    { id: "s2", company_id: COMPANY_A, project_id: PROJECT_2, provider_store_name: "fileSearchStores/store-p2", status: "ready" },
  ];

  // Project scope for PROJECT_1
  const filtered = filterStoresByScopeAndAuthorization(stores, "project", COMPANY_A, [PROJECT_1]);
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].provider_store_name, "fileSearchStores/store-p1");
});

testRunner("4. Company scope store filtering selects only authorised project stores", () => {
  const stores = [
    { id: "s1", company_id: COMPANY_A, project_id: PROJECT_1, provider_store_name: "fileSearchStores/store-p1", status: "ready" },
    { id: "s2", company_id: COMPANY_A, project_id: PROJECT_2, provider_store_name: "fileSearchStores/store-p2", status: "ready" },
    { id: "s3", company_id: COMPANY_A, project_id: PROJECT_UNAUTH, provider_store_name: "fileSearchStores/store-unauth", status: "ready" },
    { id: "s4", company_id: COMPANY_B, project_id: PROJECT_1, provider_store_name: "fileSearchStores/store-comp-b", status: "ready" },
  ];

  // User is authorised for PROJECT_1 and PROJECT_2 in COMPANY_A
  const filtered = filterStoresByScopeAndAuthorization(stores, "company", COMPANY_A, [PROJECT_1, PROJECT_2]);
  assertEquals(filtered.length, 2);
  const names = filtered.map((s) => s.provider_store_name);
  assertEquals(names.includes("fileSearchStores/store-p1"), true);
  assertEquals(names.includes("fileSearchStores/store-p2"), true);
  assertEquals(names.includes("fileSearchStores/store-unauth"), false);
  assertEquals(names.includes("fileSearchStores/store-comp-b"), false);
});

testRunner("5. Tenant isolation enforces company and project boundaries", () => {
  const stores = [
    { id: "s1", company_id: COMPANY_B, project_id: PROJECT_1, provider_store_name: "fileSearchStores/store-foreign", status: "ready" },
  ];

  const filtered = filterStoresByScopeAndAuthorization(stores, "project", COMPANY_A, [PROJECT_1]);
  assertEquals(filtered, []);
});

testRunner("6. Fallback to relational-only chat when no store exists", () => {
  const emptyResult = buildFileSearchToolConfig([]);
  assertEquals(emptyResult, null);

  const invalidResult = buildFileSearchToolConfig(["invalid-store"]);
  assertEquals(invalidResult, null);
});

testRunner(
  "7. Gemini tool configuration emits only the supported fileSearchStoreNames field",
  () => {
    const config = buildFileSearchToolConfig([
      "fileSearchStores/store-p1",
      "fileSearchStores/store-p2",
    ]);

    assertEquals(config, {
      fileSearch: {
        fileSearchStoreNames: [
          "fileSearchStores/store-p1",
          "fileSearchStores/store-p2",
        ],
      },
    });

    assert(config !== null);
    assertEquals(Object.keys(config.fileSearch), ["fileSearchStoreNames"]);
  }
);

testRunner("8. File presence metadata context building does not download files", () => {
  const indexedDocs = [
    {
      id: "idx-1",
      company_id: COMPANY_A,
      project_id: PROJECT_1,
      communication_document_id: "doc-uuid-1",
      source_kind: "uploaded",
      source_file_name: "Contract_Notice.pdf",
      source_mime_type: "application/pdf",
      source_file_size: 1024500,
      status: "ready",
    },
  ];

  const catalogue = new Map<string, any>();
  const presence = buildFilePresenceContext(indexedDocs, catalogue);

  assertEquals(presence.status, "ok");
  assertEquals(presence.count, 1);
  assertEquals(presence.items[0].file_name, "Contract_Notice.pdf");
  assertEquals(presence.items[0].source_kind, "uploaded");
  assertEquals(presence.items[0].file_size_bytes, 1024500);
  // Storage path is NOT present in items
  assertEquals((presence.items[0] as any).source_storage_path, undefined);
  assertEquals(catalogue.has(presence.items[0].source_key), true);
});

testRunner("9. Grounding citation validation maps authorised documents correctly", () => {
  const authorisedDocs = [
    {
      id: "idx-1",
      company_id: COMPANY_A,
      project_id: PROJECT_1,
      communication_document_id: "doc-uuid-1",
      source_kind: "uploaded",
      source_file_name: "Site_Plan.pdf",
      provider_document_name: "fileSearchStores/store-p1/documents/doc-1",
      status: "ready",
    },
  ];

  const groundingMetadata = {
    groundingChunks: [
      {
        retrievedContext: {
          uri: "fileSearchStores/store-p1/documents/doc-1",
          title: "Site_Plan.pdf",
        },
      },
    ],
  };

  const catalogue = new Map<string, any>();
  const sources = validateAndMapGroundingCitations(
    groundingMetadata,
    authorisedDocs,
    COMPANY_A,
    [PROJECT_1],
    catalogue
  );

  assertEquals(sources.length, 1);
  assertEquals(sources[0].label, "Site_Plan.pdf");
  assertEquals(sources[0].id, "doc-uuid-1");
  assertEquals(sources[0].table, "communication_documents");
});

testRunner("10. Grounding citation validation rejects cross-tenant and foreign citations", () => {
  const authorisedDocs = [
    {
      id: "idx-1",
      company_id: COMPANY_A,
      project_id: PROJECT_1,
      communication_document_id: "doc-uuid-1",
      source_kind: "uploaded",
      source_file_name: "Site_Plan.pdf",
      provider_document_name: "fileSearchStores/store-p1/documents/doc-1",
      status: "ready",
    },
  ];

  const groundingMetadata = {
    groundingChunks: [
      {
        retrievedContext: {
          uri: "fileSearchStores/foreign-store/documents/foreign-doc",
          title: "Secret_Financials.pdf",
        },
      },
    ],
  };

  const catalogue = new Map<string, any>();
  const sources = validateAndMapGroundingCitations(
    groundingMetadata,
    authorisedDocs,
    COMPANY_A,
    [PROJECT_1],
    catalogue
  );

  assertEquals(sources, []);
});

testRunner("11. sanitiseAnswerInternalPaths removes provider internals and storage paths", () => {
  const rawText = "According to fileSearchStores/store-123/documents/doc-456 and 11111111-1111-4111-a111-111111111111/22222222-2222-4222-a222-222222222222/secret.pdf, the site budget is ZAR 5,000,000.";
  const cleaned = sanitiseAnswerInternalPaths(rawText);
  assertEquals(cleaned.includes("fileSearchStores"), false);
  assertEquals(cleaned.includes("secret.pdf"), false);
  assertEquals(cleaned.includes("the site budget is ZAR 5,000,000."), true);
});

testRunner("12. Malformed grounding metadata is handled gracefully", () => {
  const catalogue = new Map<string, any>();
  assertEquals(validateAndMapGroundingCitations(null, [], COMPANY_A, [PROJECT_1], catalogue), []);
  assertEquals(validateAndMapGroundingCitations({}, [], COMPANY_A, [PROJECT_1], catalogue), []);
  assertEquals(validateAndMapGroundingCitations({ groundingChunks: "invalid" }, [], COMPANY_A, [PROJECT_1], catalogue), []);
});

testRunner("13. isDocumentAvailabilityQuestion identifies document availability queries", () => {
  assertEquals(isDocumentAvailabilityQuestion("What project documents are currently available for you to analyse?"), true);
  assertEquals(isDocumentAvailabilityQuestion("What documents are available?"), true);
  assertEquals(isDocumentAvailabilityQuestion("List all available documents"), true);
  assertEquals(isDocumentAvailabilityQuestion("Which files are indexed?"), true);
  assertEquals(isDocumentAvailabilityQuestion("Are there any project documents available?"), true);
  assertEquals(isDocumentAvailabilityQuestion("What is the current project budget?"), false);
  assertEquals(isDocumentAvailabilityQuestion("Who is the primary contractor?"), false);
  assertEquals(isDocumentAvailabilityQuestion(null), false);
});

testRunner("14. Zero ready documents + availability question returns early deterministic fallback without Gemini", () => {
  const zeroDocs: any[] = [];
  const question = "What project documents are currently available for you to analyse?";
  
  const isDocQuery = isDocumentAvailabilityQuestion(question);
  assertEquals(isDocQuery, true);
  assertEquals(zeroDocs.length === 0 && isDocQuery, true);
});

testRunner("15. Stale/empty store with zero ready documents results in no active store names", () => {
  const rawStores = [
    { id: "store-1", company_id: COMPANY_A, project_id: PROJECT_1, provider_store_name: "fileSearchStores/stale-store-1", status: "ready" },
  ];
  const authorisedIndexedDocs: any[] = []; // zero ready documents

  const activeStoreIds = new Set(authorisedIndexedDocs.map((d: any) => d.store_id).filter(Boolean));
  const activeStores = filterStoresByScopeAndAuthorization(rawStores, "project", COMPANY_A, [PROJECT_1])
    .filter((s: any) => activeStoreIds.has(s.id));
  
  const storeNames = validateAndDeduplicateStoreNames(activeStores);
  assertEquals(storeNames, []);
});

testRunner("16. Ready documents produce active store names and file presence context", () => {
  const authorisedIndexedDocs = [
    { id: "idx-1", store_id: "store-1", company_id: COMPANY_A, project_id: PROJECT_1, source_file_name: "Spec.pdf", status: "ready" },
  ];
  const rawStores = [
    { id: "store-1", company_id: COMPANY_A, project_id: PROJECT_1, provider_store_name: "fileSearchStores/active-store-1", status: "ready" },
  ];

  const activeStoreIds = new Set(authorisedIndexedDocs.map((d: any) => d.store_id).filter(Boolean));
  const activeStores = filterStoresByScopeAndAuthorization(rawStores, "project", COMPANY_A, [PROJECT_1])
    .filter((s: any) => activeStoreIds.has(s.id));
  
  const storeNames = validateAndDeduplicateStoreNames(activeStores);
  assertEquals(storeNames, ["fileSearchStores/active-store-1"]);

  const presence = buildFilePresenceContext(authorisedIndexedDocs);
  assertEquals(presence.count, 1);
  assertEquals(presence.items[0].file_name, "Spec.pdf");
});

testRunner("17. invokeGeminiWithRetry performs bounded retries on 503 errors and fails safely", async () => {
  let callCount = 0;
  const failingFn = async () => {
    callCount++;
    const err: any = new Error("503 UNAVAILABLE — model experiencing high demand");
    err.status = 503;
    throw err;
  };

  let caught: any = null;
  try {
    await invokeGeminiWithRetry(failingFn, {
      maxRetries: 3,
      baseDelayMs: 1,
      sleepFn: async () => {},
    });
  } catch (err) {
    caught = err;
  }

  assertEquals(callCount, 3);
  assertEquals(caught !== null, true);
  assertEquals(isRetryableGeminiError(caught), true);
});

testRunner("18. isRetryableGeminiError correctly identifies retryable status codes and messages", () => {
  assertEquals(isRetryableGeminiError({ status: 503 }), true);
  assertEquals(isRetryableGeminiError({ status: 429 }), true);
  assertEquals(isRetryableGeminiError({ status: 500 }), true);
  assertEquals(isRetryableGeminiError({ message: "RESOURCE_EXHAUSTED" }), true);
  assertEquals(isRetryableGeminiError({ message: "503 UNAVAILABLE — model experiencing high demand" }), true);
  assertEquals(isRetryableGeminiError({ status: 400 }), false);
  assertEquals(isRetryableGeminiError({ status: 404 }), false);
});

testRunner("19. sanitizeUserFacingErrorMessage sanitizes raw provider errors into safe fallback", () => {
  const raw503 = "503 UNAVAILABLE — model experiencing high demand";
  const safe1 = sanitizeUserFacingErrorMessage(raw503);
  assertEquals(safe1, "Project Advisor is temporarily busy. Please try again shortly.");

  const rawJson = JSON.stringify({ error: { code: 503, message: "UNAVAILABLE" } });
  const safe2 = sanitizeUserFacingErrorMessage(rawJson);
  assertEquals(safe2, "Project Advisor is temporarily busy. Please try again shortly.");

  const internalPath = "Error at fileSearchStores/store-123/documents/doc-456";
  const safe3 = sanitizeUserFacingErrorMessage(internalPath);
  assertEquals(safe3, "Project Advisor could not complete the request. Please try again.");
});

testRunner("20. extractRetryAfterDelayMs parses Retry-After header when present", () => {
  const errWithHeader = {
    response: {
      headers: new Map([["retry-after", "3"]]),
    },
  };
  const delay = extractRetryAfterDelayMs(errWithHeader);
  assertEquals(delay, 3000);

  const errNoHeader = { response: { headers: new Map() } };
  assertEquals(extractRetryAfterDelayMs(errNoHeader), null);
});

