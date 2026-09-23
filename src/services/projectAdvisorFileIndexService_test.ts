import { deepStrictEqual, ok, rejects } from "node:assert/strict";
import { supabase } from "../lib/supabase";
import {
  deleteAllCommunicationDocumentSourceIndexes,
  deleteCommunicationDocumentSourceIndex,
  indexCommunicationDocumentSource,
  PROJECT_ADVISOR_SOURCE_KINDS,
  ProjectAdvisorFileIndexServiceError,
} from "./projectAdvisorFileIndexService";

interface InvokeCall {
  readonly functionName: string;
  readonly options: {
    readonly body?: unknown;
    readonly headers?: Record<string, string>;
  };
}

type InvokeImplementation = (
  functionName: string,
  options: InvokeCall["options"],
) => Promise<{
  readonly data: unknown;
  readonly error: unknown;
}>;

const VALID_UUID = "123e4567-e89b-42d3-a456-426614174000";
const PROVIDER_DOCUMENT_NAME = "fileSearchStores/store-1/documents/document-1";
const ORIGINAL_FUNCTIONS_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  supabase,
  "functions",
);

function assertEquals<T>(
  actual: T,
  expected: T,
  message?: string,
): void {
  deepStrictEqual(actual, expected, message);
}

function assert(
  value: unknown,
  message?: string,
): asserts value {
  ok(value, message);
}

function mockInvoke(implementation: InvokeImplementation): void {
  Object.defineProperty(supabase, "functions", {
    configurable: true,
    get: () => ({
      invoke: implementation,
    }),
  });
}

function restoreInvoke(): void {
  if (ORIGINAL_FUNCTIONS_DESCRIPTOR !== undefined) {
    Object.defineProperty(
      supabase,
      "functions",
      ORIGINAL_FUNCTIONS_DESCRIPTOR,
    );
    return;
  }

  Reflect.deleteProperty(supabase, "functions");
}

function matchesServiceError(
  expectedCode: string,
  expectedRetryable: boolean,
): (error: unknown) => boolean {
  return (error: unknown): boolean => {
    if (!(error instanceof ProjectAdvisorFileIndexServiceError)) {
      throw new Error("Expected ProjectAdvisorFileIndexServiceError.");
    }
    assertEquals(error.code, expectedCode);
    assertEquals(error.retryable, expectedRetryable);
    assertEquals(
      error.message,
      "An error occurred during file index synchronisation.",
    );
    return true;
  };
}

Deno.test(
  "1. invokes the exact function name and camelCase index body",
  async () => {
    const calls: InvokeCall[] = [];
    mockInvoke(async (functionName, options) => {
      calls.push({ functionName, options });
      return {
        data: {
          success: true,
          status: "ready",
          providerDocumentName: PROVIDER_DOCUMENT_NAME,
        },
        error: null,
      };
    });

    try {
      const result = await indexCommunicationDocumentSource(
        VALID_UUID,
        "uploaded",
      );

      assertEquals(result.status, "ready");
      assertEquals(calls, [{
        functionName: "project-advisor-file-index",
        options: {
          body: {
            action: "index",
            communicationDocumentId: VALID_UUID,
            sourceKind: "uploaded",
          },
        },
      }]);
      assertEquals(calls[0].options.headers, undefined);
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "2. sends index and delete actions for every source kind",
  async () => {
    const calls: InvokeCall[] = [];
    mockInvoke(async (functionName, options) => {
      calls.push({ functionName, options });
      const body = options.body as Record<string, unknown>;

      return body.action === "index"
        ? {
          data: {
            success: true,
            status: "ready",
            providerDocumentName: PROVIDER_DOCUMENT_NAME,
          },
          error: null,
        }
        : {
          data: {
            success: true,
            message: "No indexed document was found.",
          },
          error: null,
        };
    });

    try {
      for (const sourceKind of PROJECT_ADVISOR_SOURCE_KINDS) {
        await indexCommunicationDocumentSource(VALID_UUID, sourceKind);
        await deleteCommunicationDocumentSourceIndex(
          VALID_UUID,
          sourceKind,
        );
      }

      assertEquals(calls.length, 6);
      assertEquals(
        calls.map((call) => call.options.body),
        [
          {
            action: "index",
            communicationDocumentId: VALID_UUID,
            sourceKind: "uploaded",
          },
          {
            action: "delete",
            communicationDocumentId: VALID_UUID,
            sourceKind: "uploaded",
          },
          {
            action: "index",
            communicationDocumentId: VALID_UUID,
            sourceKind: "signed",
          },
          {
            action: "delete",
            communicationDocumentId: VALID_UUID,
            sourceKind: "signed",
          },
          {
            action: "index",
            communicationDocumentId: VALID_UUID,
            sourceKind: "generated",
          },
          {
            action: "delete",
            communicationDocumentId: VALID_UUID,
            sourceKind: "generated",
          },
        ],
      );
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "3. validates UUIDs and source kinds before invoking",
  async () => {
    let invocationCount = 0;
    mockInvoke(async () => {
      invocationCount += 1;
      return {
        data: null,
        error: null,
      };
    });

    try {
      await rejects(
        () => indexCommunicationDocumentSource("invalid", "uploaded"),
        matchesServiceError("INVALID_UUID", false),
      );
      await rejects(
        () =>
          indexCommunicationDocumentSource(
            VALID_UUID,
            "invalid" as "uploaded",
          ),
        matchesServiceError("INVALID_SOURCE_KIND", false),
      );
      await rejects(
        () => deleteAllCommunicationDocumentSourceIndexes("invalid"),
        matchesServiceError("INVALID_UUID", false),
      );
      assertEquals(invocationCount, 0);
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "4. returns only typed fields from a ready index response",
  async () => {
    mockInvoke(async () => ({
      data: {
        success: true,
        status: "ready",
        providerDocumentName: PROVIDER_DOCUMENT_NAME,
        indexedDocumentId: "index-record-1",
        fileSearchStoreId: "store-record-1",
        indexedAt: "2026-07-29T18:00:00.000Z",
        ignoredSecret: "must-not-be-returned",
      },
      error: null,
    }));

    try {
      const result = await indexCommunicationDocumentSource(
        VALID_UUID,
        "uploaded",
      );

      assertEquals(result.status, "ready");
      assertEquals(
        result.providerDocumentName,
        PROVIDER_DOCUMENT_NAME,
      );
      assertEquals(result.indexedDocumentId, "index-record-1");
      assertEquals(result.fileSearchStoreId, "store-record-1");
      assert(!("indexedAt" in result));
      assert(!("ignoredSecret" in result));
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "5. handles unsupported and no-op index responses",
  async () => {
    mockInvoke(async (_functionName, options) => {
      const body = options.body as Record<string, unknown>;
      if (body.sourceKind === "signed") {
        return {
          data: {
            success: true,
            status: "unsupported",
            message: "This file format is not supported for document indexing.",
          },
          error: null,
        };
      }

      return {
        data: {
          success: true,
          status: "ready",
          action: "noop",
          providerDocumentName: PROVIDER_DOCUMENT_NAME,
        },
        error: null,
      };
    });

    try {
      const unsupported = await indexCommunicationDocumentSource(
        VALID_UUID,
        "signed",
      );
      const noop = await indexCommunicationDocumentSource(
        VALID_UUID,
        "uploaded",
      );

      assertEquals(unsupported.status, "unsupported");
      assertEquals(
        unsupported.message,
        "This file format is not supported for document indexing.",
      );
      assertEquals(noop.status, "noop");
      assertEquals(noop.providerDocumentName, PROVIDER_DOCUMENT_NAME);
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "6. rejects malformed and unsafe index success responses",
  async () => {
    const malformedResponses: unknown[] = [
      null,
      "not-an-object",
      { success: false },
      { success: true },
      { success: true, status: "unknown" },
      { success: true, status: "ready" },
      {
        success: true,
        status: "ready",
        action: "delete",
        providerDocumentName: PROVIDER_DOCUMENT_NAME,
      },
      {
        success: true,
        status: "ready",
        providerDocumentName: "document name with spaces",
      },
      {
        success: true,
        status: "ready",
        providerDocumentName: PROVIDER_DOCUMENT_NAME,
        indexedDocumentId: "unsafe identifier",
      },
      {
        success: true,
        status: "unsupported",
      },
      {
        success: true,
        status: "unsupported",
        message: "unsafe\nmessage",
      },
    ];

    try {
      for (const data of malformedResponses) {
        mockInvoke(async () => ({ data, error: null }));
        await rejects(
          () =>
            indexCommunicationDocumentSource(
              VALID_UUID,
              "uploaded",
            ),
          matchesServiceError("MALFORMED_RESPONSE", false),
        );
      }
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "7. treats successful deletion and a missing index as deleted",
  async () => {
    const messages = [
      "Document indexing record and remote search copy deleted successfully.",
      "No indexed document was found.",
    ];
    let responseIndex = 0;
    mockInvoke(async () => ({
      data: {
        success: true,
        message: messages[responseIndex++],
      },
      error: null,
    }));

    try {
      const deleted = await deleteCommunicationDocumentSourceIndex(
        VALID_UUID,
        "uploaded",
      );
      const missing = await deleteCommunicationDocumentSourceIndex(
        VALID_UUID,
        "signed",
      );

      assertEquals(deleted, {
        status: "deleted",
        message: messages[0],
      });
      assertEquals(missing, {
        status: "deleted",
        message: messages[1],
      });
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "8. rejects malformed delete success responses",
  async () => {
    const malformedResponses: unknown[] = [
      null,
      "not-an-object",
      { success: false },
      { success: true },
      {
        success: true,
        status: "ready",
        message: "Wrong action response.",
      },
      {
        success: true,
        action: "noop",
        message: "Wrong action response.",
      },
      {
        success: true,
        message: "unsafe\u0000message",
      },
    ];

    try {
      for (const data of malformedResponses) {
        mockInvoke(async () => ({ data, error: null }));
        await rejects(
          () =>
            deleteCommunicationDocumentSourceIndex(
              VALID_UUID,
              "uploaded",
            ),
          matchesServiceError("MALFORMED_RESPONSE", false),
        );
      }
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "9. reads the real FunctionsHttpError context body safely",
  async () => {
    const context = new Response(
      JSON.stringify({
        error: "Provider detail that must not escape.",
        code: "REMOTE_DELETE_FAILED",
        retryable: true,
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
        },
      },
    );
    mockInvoke(async () => ({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code.",
        context,
      },
    }));

    try {
      await rejects(
        () =>
          deleteCommunicationDocumentSourceIndex(
            VALID_UUID,
            "uploaded",
          ),
        matchesServiceError("REMOTE_DELETE_FAILED", true),
      );
      assertEquals(context.bodyUsed, true);
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "10. supports the legacy data error shape without exposing its message",
  async () => {
    mockInvoke(async () => ({
      data: {
        code: "SOURCE_FILE_UNAVAILABLE",
        retryable: true,
        error: "storage detail secret-token-123",
      },
      error: {
        message: "secret-token-123",
      },
    }));

    try {
      await rejects(
        () =>
          indexCommunicationDocumentSource(
            VALID_UUID,
            "uploaded",
          ),
        matchesServiceError("SOURCE_FILE_UNAVAILABLE", true),
      );
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "11. collapses unknown or malformed failure details to a safe code",
  async () => {
    mockInvoke(async () => ({
      data: {
        code: "API_KEY_SECRET_123",
        retryable: true,
      },
      error: {
        code: 500,
        retryable: true,
        message: "api-key=secret",
        context: {
          json: async () => {
            throw new Error("raw response unavailable");
          },
        },
      },
    }));

    try {
      await rejects(
        () =>
          indexCommunicationDocumentSource(
            VALID_UUID,
            "uploaded",
          ),
        matchesServiceError("INVOCATION_FAILED", false),
      );
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "12. sanitises thrown invocation failures and never retries",
  async () => {
    let invocationCount = 0;
    mockInvoke(async () => {
      invocationCount += 1;
      throw {
        code: "GEMINI_TIMEOUT",
        retryable: true,
        message: "secret provider timeout detail",
      };
    });

    try {
      await rejects(
        () =>
          indexCommunicationDocumentSource(
            VALID_UUID,
            "uploaded",
          ),
        matchesServiceError("GEMINI_TIMEOUT", true),
      );
      assertEquals(invocationCount, 1);
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "13. invokes each source operation at most once",
  async () => {
    let invocationCount = 0;
    mockInvoke(async () => {
      invocationCount += 1;
      return {
        data: null,
        error: {
          context: new Response(
            JSON.stringify({
              code: "GEMINI_REQUEST_FAILED",
              retryable: true,
            }),
            {
              status: 502,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
        },
      };
    });

    try {
      await rejects(
        () =>
          indexCommunicationDocumentSource(
            VALID_UUID,
            "uploaded",
          ),
        matchesServiceError("GEMINI_REQUEST_FAILED", true),
      );
      assertEquals(invocationCount, 1);
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "14. delete-all runs sequentially in uploaded, signed, generated order",
  async () => {
    const started: string[] = [];
    const finished: string[] = [];
    mockInvoke(async (_functionName, options) => {
      const body = options.body as Record<string, unknown>;
      const sourceKind = body.sourceKind as string;
      started.push(sourceKind);
      await Promise.resolve();
      finished.push(sourceKind);
      return {
        data: {
          success: true,
          message: "No indexed document was found.",
        },
        error: null,
      };
    });

    try {
      await deleteAllCommunicationDocumentSourceIndexes(VALID_UUID);
      assertEquals(started, ["uploaded", "signed", "generated"]);
      assertEquals(finished, ["uploaded", "signed", "generated"]);
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "15. delete-all stops immediately when one source deletion fails",
  async () => {
    const sourceKinds: string[] = [];
    mockInvoke(async (_functionName, options) => {
      const body = options.body as Record<string, unknown>;
      const sourceKind = body.sourceKind as string;
      sourceKinds.push(sourceKind);

      if (sourceKind === "signed") {
        return {
          data: null,
          error: {
            context: new Response(
              JSON.stringify({
                code: "REMOTE_DELETE_FAILED",
                retryable: true,
              }),
              {
                status: 502,
                headers: {
                  "content-type": "application/json",
                },
              },
            ),
          },
        };
      }

      return {
        data: {
          success: true,
          message: "No indexed document was found.",
        },
        error: null,
      };
    });

    try {
      await rejects(
        () => deleteAllCommunicationDocumentSourceIndexes(VALID_UUID),
        matchesServiceError("REMOTE_DELETE_FAILED", true),
      );
      assertEquals(sourceKinds, ["uploaded", "signed"]);
    } finally {
      restoreInvoke();
    }
  },
);

Deno.test(
  "16. adds no custom auth headers, service-role key, or direct network call",
  async () => {
    const originalFetchDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "fetch",
    );
    let fetchCount = 0;
    let capturedOptions: InvokeCall["options"] | undefined;

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async () => {
        fetchCount += 1;
        throw new Error("Unexpected direct network request.");
      },
    });
    mockInvoke(async (_functionName, options) => {
      capturedOptions = options;
      return {
        data: {
          success: true,
          message: "No indexed document was found.",
        },
        error: null,
      };
    });

    try {
      await deleteCommunicationDocumentSourceIndex(
        VALID_UUID,
        "generated",
      );
      assert(capturedOptions !== undefined);
      assertEquals(capturedOptions.headers, undefined);
      assertEquals(fetchCount, 0);
      const requestText = JSON.stringify(capturedOptions);
      assert(!requestText.includes("service_role"));
      assert(!requestText.includes("Authorization"));
    } finally {
      restoreInvoke();
      if (originalFetchDescriptor !== undefined) {
        Object.defineProperty(
          globalThis,
          "fetch",
          originalFetchDescriptor,
        );
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
    }
  },
);
