declare const Deno: {
  test: (name: string, fn: () => void | Promise<void>) => void;
};
import { deepStrictEqual, match, ok } from "node:assert/strict";

import {
  createGeminiRestClient,
  GEMINI_API_ORIGIN,
  GEMINI_API_VERSION,
  GEMINI_EMBEDDING_MODEL,
  type GeminiDocument,
  type GeminiOperation,
  type GeminiRestClientConfig,
  GeminiRestError,
  type GeminiUploadInput,
} from "./gemini-rest-client.ts";
import { MAX_FILE_SIZE_BYTES } from "./helpers.ts";

function assert(value: unknown, message?: string): asserts value {
  ok(value, message);
}

function assertEquals<T>(
  actual: T,
  expected: T,
  message?: string,
): void {
  deepStrictEqual(actual, expected, message);
}

function assertMatch(
  actual: string,
  expected: RegExp,
  message?: string,
): void {
  match(actual, expected, message);
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedError?: { code?: string; status?: number },
): Promise<GeminiRestError> {
  try {
    await fn();
  } catch (error: unknown) {
    assert(
      error instanceof GeminiRestError,
      "Expected GeminiRestError",
    );

    if (expectedError?.code) {
      assertEquals(error.code, expectedError.code);
    }

    if (expectedError?.status !== undefined) {
      assertEquals(error.status, expectedError.status);
    }

    return error;
  }

  throw new Error("Expected function to reject, but it resolved");
}

interface MockFetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | ArrayBuffer;
  redirect?: string;
}

function createMockFetch(
  handler: (
    call: MockFetchCall,
  ) => Response | Promise<Response>,
): typeof fetch {
  return (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {};

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key.toLowerCase()] = value;
        });
      } else {
        Object.entries(init.headers).forEach(
          ([key, value]) => {
            headers[key.toLowerCase()] = String(value);
          },
        );
      }
    }

    const body = init?.body === undefined
      ? undefined
      : init.body instanceof ArrayBuffer
      ? init.body
      : String(init.body);

    return Promise.resolve(
      handler({
        url,
        method,
        headers,
        body,
        redirect: init?.redirect,
      }),
    );
  };
}

Deno.test("1. Blank API keys are rejected", () => {
  const invalidKeys = ["", "   ", "\t\n"];

  for (const apiKey of invalidKeys) {
    try {
      createGeminiRestClient({ apiKey });
      assert(false, "Expected an invalid API key error");
    } catch (error: unknown) {
      assert(error instanceof GeminiRestError);
      assertEquals(error.code, "INVALID_API_KEY");
    }
  }
});

Deno.test("2. Invalid timeout values are rejected", () => {
  const timeoutFields = [
    "requestTimeoutMs",
    "uploadTimeoutMs",
    "operationTimeoutMs",
    "pollIntervalMs",
  ] as const;

  const invalidValues = [
    0,
    -100,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ];

  for (const field of timeoutFields) {
    for (const value of invalidValues) {
      const config: GeminiRestClientConfig = {
        apiKey: "valid-key",
      };
      config[field] = value;

      try {
        createGeminiRestClient(config);
        assert(
          false,
          `Expected ${field}=${value} to be rejected`,
        );
      } catch (error: unknown) {
        assert(error instanceof GeminiRestError);
        assertEquals(error.code, "INVALID_ARGUMENT");
      }
    }
  }
});

Deno.test(
  "3. Store creation uses the exact URL, method, headers and JSON body",
  async () => {
    let capturedCall: MockFetchCall | null = null;

    const mockFetch = createMockFetch((call) => {
      capturedCall = call;

      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-123",
          displayName: "Project Documents",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-secret-api-key",
      fetchFn: mockFetch,
    });

    const store = await client.createFileSearchStore(
      "Project Documents",
    );

    assert(capturedCall !== null);
    const call: MockFetchCall = capturedCall;

    assertEquals(
      call.url,
      `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/fileSearchStores`,
    );
    assertEquals(call.method, "POST");
    assertEquals(
      call.headers["x-goog-api-key"],
      "test-secret-api-key",
    );
    assertEquals(
      call.headers["content-type"],
      "application/json",
    );
    assertEquals(call.redirect, "error");
    assertEquals(
      call.body,
      JSON.stringify({
        displayName: "Project Documents",
        embeddingModel: GEMINI_EMBEDDING_MODEL,
      }),
    );
    assertEquals(
      store.name,
      "fileSearchStores/store-123",
    );
    assertEquals(store.displayName, "Project Documents");
  },
);

Deno.test(
  "4. Store creation uses models/gemini-embedding-2",
  async () => {
    let capturedBody: string | undefined;

    const mockFetch = createMockFetch((call) => {
      if (typeof call.body === "string") {
        capturedBody = call.body;
      }

      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-abc",
          displayName: "Embedding Test",
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    await client.createFileSearchStore("Embedding Test");

    assert(capturedBody !== undefined);
    const parsed: unknown = JSON.parse(capturedBody);
    assert(
      typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed),
    );

    const bodyObject = parsed as Record<string, unknown>;
    assertEquals(
      bodyObject.embeddingModel,
      "models/gemini-embedding-2",
    );
  },
);

Deno.test(
  "5. Invalid display names are rejected before fetch",
  async () => {
    let fetchCalled = false;

    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const invalidNames = [
      "",
      "   ",
      " Leading space",
      "Trailing space ",
      "Control\u0000Character",
      "C1\u0085Control",
      "a".repeat(513),
    ];

    for (const displayName of invalidNames) {
      await assertRejects(
        () => client.createFileSearchStore(displayName),
        { code: "INVALID_ARGUMENT" },
      );
    }

    assertEquals(
      fetchCalled,
      false,
      "fetchFn must not run for an invalid display name",
    );
  },
);

Deno.test(
  "6. Invalid resource names are rejected before fetch",
  async () => {
    let fetchCalled = false;

    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const invalidNames = [
      "invalid",
      "fileSearchStores/",
      "fileSearchStores/123/extra",
      "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/123",
      "fileSearchStores/..",
      "fileSearchStores/.",
      "fileSearchStores/123?query=true",
      "fileSearchStores/123#fragment",
      "fileSearchStores/123\\456",
      "fileSearchStores/%2e%2e",
      "fileSearchStores/123 ",
      " fileSearchStores/123",
    ];

    for (const storeName of invalidNames) {
      await assertRejects(
        () => client.getFileSearchStore(storeName),
        { code: "INVALID_RESOURCE_NAME" },
      );
      await assertRejects(
        () => client.deleteFileSearchStore(storeName),
        { code: "INVALID_RESOURCE_NAME" },
      );
    }

    assertEquals(
      fetchCalled,
      false,
      "fetchFn must not run for an invalid resource name",
    );
  },
);

Deno.test("7. GET returns null on 404", async () => {
  const mockFetch = createMockFetch(() => {
    return new Response("Not Found", { status: 404 });
  });

  const client = createGeminiRestClient({
    apiKey: "test-key",
    fetchFn: mockFetch,
  });

  const result = await client.getFileSearchStore(
    "fileSearchStores/nonexistent-123",
  );

  assertEquals(result, null);
});

Deno.test(
  "8. GET does not hide 401, 403, 429 or 500",
  async () => {
    const statusCodes = [401, 403, 429, 500];

    for (const status of statusCodes) {
      const mockFetch = createMockFetch(() => {
        return new Response("Provider details", { status });
      });

      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: mockFetch,
      });

      const error = await assertRejects(
        () =>
          client.getFileSearchStore(
            "fileSearchStores/store-123",
          ),
        { code: "GEMINI_HTTP_ERROR", status },
      );

      assertEquals(
        error.isRetryable,
        status === 429 || status === 500,
      );
    }
  },
);

Deno.test("9. DELETE uses force=true", async () => {
  let capturedUrl = "";
  let capturedMethod = "";

  const mockFetch = createMockFetch((call) => {
    capturedUrl = call.url;
    capturedMethod = call.method;
    return new Response("{}", { status: 200 });
  });

  const client = createGeminiRestClient({
    apiKey: "test-key",
    fetchFn: mockFetch,
  });

  const result = await client.deleteFileSearchStore(
    "fileSearchStores/store-999",
  );

  assertEquals(result, { outcome: "deleted" });
  assertEquals(capturedMethod, "DELETE");
  assertEquals(
    capturedUrl,
    `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/fileSearchStores/store-999?force=true`,
  );
});

Deno.test(
  "10. DELETE treats 404 as not_found",
  async () => {
    const mockFetch = createMockFetch(() => {
      return new Response("Not Found", { status: 404 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const result = await client.deleteFileSearchStore(
      "fileSearchStores/store-missing",
    );

    assertEquals(result, { outcome: "not_found" });
  },
);

Deno.test(
  "11. Malformed JSON and malformed store resources are rejected",
  async () => {
    const malformedJsonClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response("NOT_VALID_JSON{", {
          status: 200,
        });
      }),
    });

    await assertRejects(
      () =>
        malformedJsonClient.getFileSearchStore(
          "fileSearchStores/store-123",
        ),
      { code: "GEMINI_INVALID_RESPONSE" },
    );

    const mismatchedNameClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: "fileSearchStores/store-other",
            displayName: "Store Other",
          }),
          { status: 200 },
        );
      }),
    });

    await assertRejects(
      () =>
        mismatchedNameClient.getFileSearchStore(
          "fileSearchStores/store-123",
        ),
      { code: "GEMINI_INVALID_RESPONSE" },
    );

    const missingDisplayNameClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: "fileSearchStores/store-123",
          }),
          { status: 200 },
        );
      }),
    });

    await assertRejects(
      () =>
        missingDisplayNameClient.getFileSearchStore(
          "fileSearchStores/store-123",
        ),
      { code: "GEMINI_INVALID_RESPONSE" },
    );
  },
);

Deno.test(
  "12. Abort errors become GEMINI_REQUEST_TIMEOUT",
  async () => {
    const mockFetch: typeof fetch = () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    };

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const error = await assertRejects(
      () =>
        client.getFileSearchStore(
          "fileSearchStores/store-123",
        ),
      { code: "GEMINI_REQUEST_TIMEOUT" },
    );

    assertEquals(error.isRetryable, true);
  },
);

Deno.test(
  "13. Other fetch failures become GEMINI_NETWORK_ERROR",
  async () => {
    const mockFetch: typeof fetch = () => {
      return Promise.reject(new TypeError("Failed to fetch"));
    };

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const error = await assertRejects(
      () =>
        client.getFileSearchStore(
          "fileSearchStores/store-123",
        ),
      { code: "GEMINI_NETWORK_ERROR" },
    );

    assertEquals(error.isRetryable, true);
  },
);

Deno.test(
  "14. API keys and raw provider errors never appear in thrown messages",
  async () => {
    const secretApiKey = "SECRET_SUPER_CONFIDENTIAL_KEY_999";
    const rawProviderBody = "Internal provider trace with secret tokens";

    const client = createGeminiRestClient({
      apiKey: secretApiKey,
      fetchFn: createMockFetch(() => {
        return new Response(rawProviderBody, {
          status: 500,
        });
      }),
    });

    const error = await assertRejects(
      () => client.createFileSearchStore("My Store"),
      { code: "GEMINI_HTTP_ERROR", status: 500 },
    );

    assertEquals(
      error.message.includes(secretApiKey),
      false,
    );
    assertEquals(
      error.message.includes(rawProviderBody),
      false,
    );
  },
);

Deno.test(
  "15. Every store fetch uses redirect: error",
  async () => {
    const redirects: Array<string | undefined> = [];

    const mockFetch = createMockFetch((call) => {
      redirects.push(call.redirect);

      if (call.method === "DELETE") {
        return new Response("{}", { status: 200 });
      }

      const displayName = call.method === "POST"
        ? "Created Store"
        : "Existing Store";

      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-1",
          displayName,
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    await client.createFileSearchStore("Created Store");
    await client.getFileSearchStore(
      "fileSearchStores/store-1",
    );
    await client.deleteFileSearchStore(
      "fileSearchStores/store-1",
    );

    assertEquals(redirects, ["error", "error", "error"]);
  },
);

Deno.test(
  "16. No test performs a real network request",
  async () => {
    let mockCalled = false;

    const mockFetch = createMockFetch(() => {
      mockCalled = true;

      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-offline",
          displayName: "Offline Store",
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const store = await client.createFileSearchStore(
      "Offline Store",
    );

    assertEquals(mockCalled, true);
    assertEquals(
      store.name,
      "fileSearchStores/store-offline",
    );
  },
);

Deno.test(
  "17. Store IDs allow only lowercase alphanumeric characters or dashes up to 40 characters",
  async () => {
    let fetchCalled = false;

    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const invalidStoreNames = [
      "fileSearchStores/Uppercase",
      "fileSearchStores/has_underscore",
      `fileSearchStores/${"a".repeat(41)}`,
    ];

    for (const storeName of invalidStoreNames) {
      await assertRejects(
        () => client.getFileSearchStore(storeName),
        { code: "INVALID_RESOURCE_NAME" },
      );
      await assertRejects(
        () => client.deleteFileSearchStore(storeName),
        { code: "INVALID_RESOURCE_NAME" },
      );
    }

    assertEquals(
      fetchCalled,
      false,
      "Strict resource validation must occur before fetch",
    );
  },
);

Deno.test(
  "18. Unsafe returned display names are rejected",
  async () => {
    const unsafeDisplayNames = [
      "",
      " Returned padding",
      "Returned padding ",
      "Bad\u0000Name",
      "Bad\u0085Name",
      "a".repeat(513),
    ];

    for (const displayName of unsafeDisplayNames) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch(() => {
          return new Response(
            JSON.stringify({
              name: "fileSearchStores/store-123",
              displayName,
            }),
            { status: 200 },
          );
        }),
      });

      await assertRejects(
        () =>
          client.getFileSearchStore(
            "fileSearchStores/store-123",
          ),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "19. Non-string createTime and updateTime values are rejected",
  async () => {
    const invalidFields: Array<Record<string, unknown>> = [
      { createTime: 123 },
      { createTime: null },
      { updateTime: false },
      { updateTime: { seconds: 123 } },
    ];

    for (const extraFields of invalidFields) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch(() => {
          return new Response(
            JSON.stringify({
              name: "fileSearchStores/store-123",
              displayName: "Store 123",
              ...extraFields,
            }),
            { status: 200 },
          );
        }),
      });

      await assertRejects(
        () =>
          client.getFileSearchStore(
            "fileSearchStores/store-123",
          ),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "20. A stalled JSON response body times out within a bounded period",
  async () => {
    const stalledResponse = new Response(null, {
      status: 200,
    });

    Object.defineProperty(stalledResponse, "json", {
      configurable: true,
      value: (): Promise<unknown> =>
        new Promise<unknown>(() => {
          // Intentionally never settles. The client deadline must win.
        }),
    });

    const mockFetch: typeof fetch = () => {
      return Promise.resolve(stalledResponse);
    };

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
      requestTimeoutMs: 20,
    });

    const startedAt = performance.now();

    const error = await assertRejects(
      () =>
        client.getFileSearchStore(
          "fileSearchStores/store-123",
        ),
      { code: "GEMINI_REQUEST_TIMEOUT" },
    );

    const elapsedMs = performance.now() - startedAt;

    assertEquals(error.isRetryable, true);
    assert(
      elapsedMs < 1_000,
      `The stalled body exceeded the bounded timeout: ${elapsedMs} ms`,
    );
    assertMatch(
      error.message,
      /timed out/i,
    );
  },
);

function createValidUploadInput(
  overrides?: Partial<GeminiUploadInput>,
): GeminiUploadInput {
  const encoder = new TextEncoder();
  const bytes = encoder.encode("Test content for resumable file upload").buffer;

  return {
    storeName: "fileSearchStores/store-123",
    displayName: "document.pdf",
    mimeType: "application/pdf",
    bytes,
    customMetadata: [
      { key: "pm_company_id", stringValue: "comp-456" },
    ],
    ...overrides,
  };
}

function createSuccessfulUploadFetch(
  finalOperation: unknown = {
    name: "fileSearchStores/store-123/upload/operations/op-001",
    done: true,
  },
  sessionUrl =
    "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=session-success",
): typeof fetch {
  return createMockFetch((call) => {
    if (call.headers["x-goog-upload-command"] === "start") {
      const responseHeaders = new Headers();
      responseHeaders.set("X-Goog-Upload-URL", sessionUrl);
      return new Response(null, {
        status: 200,
        headers: responseHeaders,
      });
    }

    return new Response(JSON.stringify(finalOperation), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

Deno.test(
  "21. Direct upload initiation uses exact endpoint, headers, JSON body, non-nested metadata, and never obsolete multipart",
  async () => {
    const capturedCalls: MockFetchCall[] = [];

    const mockFetch = createMockFetch((call) => {
      capturedCalls.push(call);

      if (call.headers["x-goog-upload-command"] === "start") {
        const responseHeaders = new Headers();
        responseHeaders.set(
          "x-goog-upload-url",
          "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=session-abc",
        );
        return new Response("{}", { status: 200, headers: responseHeaders });
      }

      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-123/operations/op-001",
          done: true,
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-api-key",
      fetchFn: mockFetch,
    });

    const input = createValidUploadInput();
    await client.uploadToFileSearchStore(input);

    assert(capturedCalls.length >= 1);
    const startCall = capturedCalls[0];

    assertEquals(
      startCall.url,
      `${GEMINI_API_ORIGIN}/upload/${GEMINI_API_VERSION}/fileSearchStores/store-123:uploadToFileSearchStore`,
    );
    assertEquals(startCall.method, "POST");
    assertEquals(startCall.headers["x-goog-api-key"], "test-api-key");
    assertEquals(startCall.headers["x-goog-upload-protocol"], "resumable");
    assertEquals(startCall.headers["x-goog-upload-command"], "start");
    assertEquals(
      startCall.headers["x-goog-upload-header-content-length"],
      String(input.bytes.byteLength),
    );
    assertEquals(
      startCall.headers["x-goog-upload-header-content-type"],
      "application/pdf",
    );
    assertEquals(
      startCall.headers["content-type"],
      "application/json; charset=UTF-8",
    );
    assertEquals(startCall.redirect, "error");

    assert(typeof startCall.body === "string");
    const parsedBody = JSON.parse(startCall.body as string);
    assertEquals(parsedBody, {
      displayName: "document.pdf",
      mimeType: "application/pdf",
      customMetadata: [{ key: "pm_company_id", stringValue: "comp-456" }],
    });

    assertEquals("document" in parsedBody, false);
    assertEquals(
      startCall.url.includes("/documents?uploadType=multipart"),
      false,
    );
  },
);

Deno.test(
  "22. Empty files and oversized files are rejected before fetch",
  async () => {
    let fetchCalled = false;
    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const emptyInput = createValidUploadInput({ bytes: new ArrayBuffer(0) });
    await assertRejects(() => client.uploadToFileSearchStore(emptyInput), {
      code: "INVALID_FILE_SIZE",
    });

    const oversizedInput = createValidUploadInput({
      bytes: new ArrayBuffer(MAX_FILE_SIZE_BYTES + 1),
    });
    await assertRejects(() => client.uploadToFileSearchStore(oversizedInput), {
      code: "INVALID_FILE_SIZE",
    });

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "23. Non-ArrayBuffer values are rejected before fetch",
  async () => {
    let fetchCalled = false;
    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const invalidInputs = [
      createValidUploadInput({
        bytes: "not an array buffer" as unknown as ArrayBuffer,
      }),
      createValidUploadInput({ bytes: [1, 2, 3] as unknown as ArrayBuffer }),
      createValidUploadInput({ bytes: null as unknown as ArrayBuffer }),
    ];

    for (const input of invalidInputs) {
      await assertRejects(() => client.uploadToFileSearchStore(input), {
        code: "INVALID_ARGUMENT",
      });
    }

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "24. Unsupported MIME types are rejected before fetch",
  async () => {
    let fetchCalled = false;
    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const unsupportedMimes = [
      "text/plain",
      "application/octet-stream",
      "APPLICATION/PDF",
      "application/pdf; charset=utf-8",
      "image/gif",
      "video/mp4",
    ];

    for (const mimeType of unsupportedMimes) {
      const input = createValidUploadInput({ mimeType });
      await assertRejects(() => client.uploadToFileSearchStore(input), {
        code: "UNSUPPORTED_MIME_TYPE",
      });
    }

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "25. Unsafe filenames are rejected before fetch",
  async () => {
    let fetchCalled = false;
    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const unsafeNames = [
      "",
      "   ",
      " leading.pdf",
      "trailing.pdf ",
      "control\u0000.pdf",
      "control\u0085.pdf",
      "a".repeat(513),
      ".",
      "..",
      "folder/file.pdf",
      "folder\\file.pdf",
      "file.pdf?query=1",
      "file.pdf#frag",
    ];

    for (const displayName of unsafeNames) {
      const input = createValidUploadInput({ displayName });
      await assertRejects(() => client.uploadToFileSearchStore(input), {
        code: "INVALID_ARGUMENT",
      });
    }

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "26. More than 20 metadata entries are rejected before fetch",
  async () => {
    let fetchCalled = false;
    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const customMetadata = Array.from({ length: 21 }, (_, i) => ({
      key: `key_${i}`,
      stringValue: `val_${i}`,
    }));

    const input = createValidUploadInput({ customMetadata });
    await assertRejects(() => client.uploadToFileSearchStore(input), {
      code: "INVALID_METADATA",
    });

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "27. Duplicate, blank, padded and malformed metadata is rejected before fetch",
  async () => {
    let fetchCalled = false;
    const mockFetch = createMockFetch(() => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const invalidMetadataSets = [
      [{ key: "k1", stringValue: "v1" }, { key: "k1", stringValue: "v2" }],
      [{ key: "", stringValue: "v1" }],
      [{ key: "k1", stringValue: "" }],
      [{ key: " k1", stringValue: "v1" }],
      [{ key: "k1", stringValue: "v1 " }],
      [{ key: "k\u00001", stringValue: "v1" }],
      [{ key: "k1", stringValue: "v\u00001" }],
      [{ key: "k1", stringValue: "v1", extraProp: "bad" } as unknown as {
        key: string;
        stringValue: string;
      }],
      ["not an object" as unknown as { key: string; stringValue: string }],
    ];

    for (const customMetadata of invalidMetadataSets) {
      const input = createValidUploadInput({ customMetadata });
      await assertRejects(() => client.uploadToFileSearchStore(input), {
        code: "INVALID_METADATA",
      });
    }

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "28. Missing or blank upload-session header is rejected",
  async () => {
    const mockFetch = createMockFetch((call) => {
      if (call.headers["x-goog-upload-command"] === "start") {
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const input = createValidUploadInput();
    await assertRejects(() => client.uploadToFileSearchStore(input), {
      code: "GEMINI_UPLOAD_PROTOCOL_ERROR",
    });
  },
);

Deno.test(
  "29. HTTP, foreign-host, credential-bearing and wrong-path session URLs are rejected",
  async () => {
    const invalidSessionUrls = [
      "http://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore",
      "https://attacker.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore",
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?key=SECRET",
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?api_key=SECRET",
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?x-goog-api-key=SECRET",
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/other-store:uploadToFileSearchStore",
    ];

    for (const sessionUrl of invalidSessionUrls) {
      const mockFetch = createMockFetch((call) => {
        if (call.headers["x-goog-upload-command"] === "start") {
          const responseHeaders = new Headers();
          responseHeaders.set("x-goog-upload-url", sessionUrl);
          return new Response("{}", { status: 200, headers: responseHeaders });
        }
        return new Response("{}", { status: 200 });
      });

      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: mockFetch,
      });

      const input = createValidUploadInput();
      await assertRejects(() => client.uploadToFileSearchStore(input), {
        code: "GEMINI_UPLOAD_PROTOCOL_ERROR",
      });
    }
  },
);

Deno.test(
  "30. A valid Gemini upload-session URL is accepted",
  async () => {
    let finalCall: MockFetchCall | null = null;
    const validSessionUrl =
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=session-999";

    const mockFetch = createMockFetch((call) => {
      if (call.headers["x-goog-upload-command"] === "start") {
        const responseHeaders = new Headers();
        responseHeaders.set("x-goog-upload-url", validSessionUrl);
        return new Response("{}", { status: 200, headers: responseHeaders });
      }

      finalCall = call;
      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-123/operations/op-999",
          done: true,
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const input = createValidUploadInput();
    const op = await client.uploadToFileSearchStore(input);

    assertEquals(op.name, "fileSearchStores/store-123/operations/op-999");
    assert(finalCall !== null);
    assertEquals((finalCall as MockFetchCall).url, validSessionUrl);
  },
);

Deno.test(
  "31. Finalisation sends exact bytes, length, MIME, offset, command, and API key is never sent",
  async () => {
    let capturedFinalCall: MockFetchCall | null = null;
    const sessionUrl =
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=sess-1";

    const mockFetch = createMockFetch((call) => {
      if (call.headers["x-goog-upload-command"] === "start") {
        const responseHeaders = new Headers();
        responseHeaders.set("x-goog-upload-url", sessionUrl);
        return new Response("{}", { status: 200, headers: responseHeaders });
      }

      capturedFinalCall = call;
      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-123/operations/op-777",
          done: true,
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "SECRET_KEY_MUST_NOT_BE_SENT",
      fetchFn: mockFetch,
    });

    const input = createValidUploadInput();
    await client.uploadToFileSearchStore(input);

    assert(capturedFinalCall !== null);
    const call = capturedFinalCall as MockFetchCall;

    assertEquals(call.url, sessionUrl);
    assertEquals(call.method, "POST");
    assertEquals(
      call.headers["content-length"],
      String(input.bytes.byteLength),
    );
    assertEquals(call.headers["x-goog-upload-offset"], "0");
    assertEquals(call.headers["x-goog-upload-command"], "upload, finalize");
    assertEquals(call.headers["content-type"], input.mimeType);

    assertEquals("x-goog-api-key" in call.headers, false);
    assertEquals("authorization" in call.headers, false);
    assertEquals(call.body, input.bytes);
  },
);

Deno.test(
  "32. Both initiation and finalisation requests use redirect: error",
  async () => {
    const redirects: Array<string | undefined> = [];

    const mockFetch = createMockFetch((call) => {
      redirects.push(call.redirect);

      if (call.headers["x-goog-upload-command"] === "start") {
        const responseHeaders = new Headers();
        responseHeaders.set(
          "x-goog-upload-url",
          "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=sess-1",
        );
        return new Response("{}", { status: 200, headers: responseHeaders });
      }

      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-123/operations/op-1",
          done: true,
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    await client.uploadToFileSearchStore(createValidUploadInput());

    assertEquals(redirects, ["error", "error"]);
  },
);

Deno.test(
  "33. Valid operation responses are sanitised and returned",
  async () => {
    const mockFetch = createMockFetch((call) => {
      if (call.headers["x-goog-upload-command"] === "start") {
        const responseHeaders = new Headers();
        responseHeaders.set(
          "x-goog-upload-url",
          "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=sess-1",
        );
        return new Response("{}", { status: 200, headers: responseHeaders });
      }

      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-123/operations/op-555",
          done: true,
          response: {
            documentName: "fileSearchStores/store-123/documents/doc-888",
          },
          providerSecretMetadata: "should be stripped",
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const op = await client.uploadToFileSearchStore(createValidUploadInput());

    assertEquals(op, {
      name: "fileSearchStores/store-123/operations/op-555",
      done: true,
      response: {
        documentName: "fileSearchStores/store-123/documents/doc-888",
      },
    });
    assertEquals("providerSecretMetadata" in op, false);
  },
);

Deno.test(
  "34. Malformed or foreign-store operation names are rejected",
  async () => {
    const invalidOpNames = [
      "fileSearchStores/other-store/operations/op-1",
      "fileSearchStores/store-123/operations/../op-1",
      "fileSearchStores/store-123/operations/op-1?query=1",
      "fileSearchStores/store-123/operations/op-1#frag",
      "fileSearchStores/store-123/operations/op-1/extra",
      "invalid-op-name",
    ];

    for (const name of invalidOpNames) {
      const mockFetch = createMockFetch((call) => {
        if (call.headers["x-goog-upload-command"] === "start") {
          const responseHeaders = new Headers();
          responseHeaders.set(
            "x-goog-upload-url",
            "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=sess-1",
          );
          return new Response("{}", { status: 200, headers: responseHeaders });
        }

        return new Response(JSON.stringify({ name }), { status: 200 });
      });

      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: mockFetch,
      });

      await assertRejects(
        () => client.uploadToFileSearchStore(createValidUploadInput()),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "35. Foreign-store document names are rejected",
  async () => {
    const mockFetch = createMockFetch((call) => {
      if (call.headers["x-goog-upload-command"] === "start") {
        const responseHeaders = new Headers();
        responseHeaders.set(
          "x-goog-upload-url",
          "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=sess-1",
        );
        return new Response("{}", { status: 200, headers: responseHeaders });
      }

      return new Response(
        JSON.stringify({
          name: "fileSearchStores/store-123/operations/op-1",
          response: {
            documentName: "fileSearchStores/foreign-store/documents/doc-1",
          },
        }),
        { status: 200 },
      );
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    await assertRejects(
      () => client.uploadToFileSearchStore(createValidUploadInput()),
      { code: "GEMINI_INVALID_RESPONSE" },
    );
  },
);

Deno.test(
  "36. Provider error messages and upload-session URLs never appear in returned objects or errors",
  async () => {
    const sensitiveSessionUrl =
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=SENSITIVE_SESSION_TOKEN_123";
    const sensitiveProviderMsg =
      "Internal provider crash with SENSITIVE_DB_CREDENTIALS";

    const mockFetch = createMockFetch((call) => {
      if (call.headers["x-goog-upload-command"] === "start") {
        const responseHeaders = new Headers();
        responseHeaders.set("x-goog-upload-url", sensitiveSessionUrl);
        return new Response("{}", { status: 200, headers: responseHeaders });
      }

      return new Response(sensitiveProviderMsg, { status: 500 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    const error = await assertRejects(
      () => client.uploadToFileSearchStore(createValidUploadInput()),
      { code: "GEMINI_HTTP_ERROR", status: 500 },
    );

    assertEquals(error.message.includes("SENSITIVE_SESSION_TOKEN_123"), false);
    assertEquals(error.message.includes("SENSITIVE_DB_CREDENTIALS"), false);
  },
);

Deno.test(
  "37. Upload timeout, HTTP failure and fetch failure use existing sanitised error codes",
  async () => {
    const httpErrorClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => new Response("Error", { status: 503 })),
    });
    await assertRejects(
      () => httpErrorClient.uploadToFileSearchStore(createValidUploadInput()),
      { code: "GEMINI_HTTP_ERROR", status: 503 },
    );

    const abortErrorClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      },
    });
    await assertRejects(
      () => abortErrorClient.uploadToFileSearchStore(createValidUploadInput()),
      { code: "GEMINI_REQUEST_TIMEOUT" },
    );

    const networkErrorClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: () => Promise.reject(new TypeError("Network error")),
    });
    await assertRejects(
      () =>
        networkErrorClient.uploadToFileSearchStore(createValidUploadInput()),
      { code: "GEMINI_NETWORK_ERROR" },
    );
  },
);

Deno.test(
  "38. No hidden retry occurs on upload failure",
  async () => {
    let callCount = 0;

    const mockFetch = createMockFetch((call) => {
      callCount++;

      if (call.headers["x-goog-upload-command"] === "start") {
        const responseHeaders = new Headers();
        responseHeaders.set(
          "x-goog-upload-url",
          "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=no-retry",
        );
        return new Response(null, {
          status: 200,
          headers: responseHeaders,
        });
      }

      return new Response("Server Error", { status: 500 });
    });

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: mockFetch,
    });

    await assertRejects(
      () => client.uploadToFileSearchStore(createValidUploadInput()),
      { code: "GEMINI_HTTP_ERROR", status: 500 },
    );

    assertEquals(callCount, 2);
  },
);

Deno.test(
  "39. ArrayBuffer lookalikes and typed-array views are rejected before fetch",
  async () => {
    let fetchCalled = false;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        fetchCalled = true;
        return new Response(null, { status: 500 });
      }),
    });

    const fakeArrayBuffer = {
      byteLength: 10,
      [Symbol.toStringTag]: "ArrayBuffer",
    } as unknown as ArrayBuffer;

    const invalidValues = [
      fakeArrayBuffer,
      new Uint8Array([1, 2, 3]) as unknown as ArrayBuffer,
      new DataView(new ArrayBuffer(3)) as unknown as ArrayBuffer,
    ];

    for (const bytes of invalidValues) {
      await assertRejects(
        () =>
          client.uploadToFileSearchStore(
            createValidUploadInput({ bytes }),
          ),
        { code: "INVALID_ARGUMENT" },
      );
    }

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "40. Every canonical MIME type plus zero and twenty metadata entries are accepted",
  async () => {
    const canonicalMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
    ];

    for (const mimeType of canonicalMimeTypes) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createSuccessfulUploadFetch(),
      });

      const operation = await client.uploadToFileSearchStore(
        createValidUploadInput({
          mimeType,
          customMetadata: [],
        }),
      );

      assertEquals(
        operation.name,
        "fileSearchStores/store-123/upload/operations/op-001",
      );
    }

    const twentyEntries = Array.from({ length: 20 }, (_, index) => ({
      key: `key_${index}`,
      stringValue: `value_${index}`,
    }));

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createSuccessfulUploadFetch(),
    });

    await client.uploadToFileSearchStore(
      createValidUploadInput({ customMetadata: twentyEntries }),
    );
  },
);

Deno.test(
  "41. Invalid metadata containers and alternate value variants are rejected",
  async () => {
    let fetchCalled = false;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        fetchCalled = true;
        return new Response(null, { status: 500 });
      }),
    });

    const invalidMetadataValues = [
      null,
      {},
      "metadata",
      [{ key: "key", numericValue: 1 }],
      [{ key: "key", stringListValue: { values: ["value"] } }],
      [{ key: "key", stringValue: "value", numericValue: 1 }],
      [{ key: "key", stringValue: "value", symbolValue: true }],
    ];

    for (const customMetadata of invalidMetadataValues) {
      await assertRejects(
        () =>
          client.uploadToFileSearchStore(
            createValidUploadInput({
              customMetadata: customMetadata as unknown as GeminiUploadInput[
                "customMetadata"
              ],
            }),
          ),
        { code: "INVALID_METADATA" },
      );
    }

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "42. Upload-session validation rejects malformed, ambiguous, and credential-bearing URLs",
  async () => {
    const base =
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore";
    const invalidSessionUrls = [
      "   ",
      "not-a-url",
      "https://user:password@generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore",
      `${base}#fragment`,
      "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/store-123:uploadToFileSearchStore",
      `${base}/extra`,
      "https://generativelanguage.googleapis.com:444/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore",
      `${base}?KEY=secret`,
      `${base}?X-Goog-Api-Key=secret`,
      `${base}?access_token=secret`,
      `${base}?%6Bey=secret`,
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/other/../store-123:uploadToFileSearchStore",
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/other/%2e%2e/store-123:uploadToFileSearchStore",
    ];

    for (const sessionUrl of invalidSessionUrls) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch((call) => {
          assertEquals(
            call.headers["x-goog-upload-command"],
            "start",
          );
          const headers = new Headers();
          headers.set("X-Goog-Upload-URL", sessionUrl);
          return new Response(null, { status: 200, headers });
        }),
      });

      await assertRejects(
        () =>
          client.uploadToFileSearchStore(
            createValidUploadInput(),
          ),
        { code: "GEMINI_UPLOAD_PROTOCOL_ERROR" },
      );
    }
  },
);

Deno.test(
  "43. Malformed known operation fields and invalid result combinations are rejected",
  async () => {
    const name = "fileSearchStores/store-123/upload/operations/op-123";
    const invalidOperations = [
      { name, done: "true" },
      { name, error: null },
      { name, error: [] },
      { name, error: { code: 1.5 } },
      { name, error: { code: "13" } },
      { name, response: null },
      { name, response: [] },
      { name, response: { documentName: 123 } },
      { name, error: {}, response: {} },
      { name, done: false, error: {} },
      { name, done: false, response: {} },
    ];

    for (const finalOperation of invalidOperations) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createSuccessfulUploadFetch(finalOperation),
      });

      await assertRejects(
        () =>
          client.uploadToFileSearchStore(
            createValidUploadInput(),
          ),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "44. Both operation-name forms and immediate document responses are accepted and sanitised",
  async () => {
    const immediateClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createSuccessfulUploadFetch({
        name: "fileSearchStores/store-123/upload/operations/op.safe-id~1",
        response: {
          "@type": "provider-type",
          parent: "fileSearchStores/store-123",
          documentName: "fileSearchStores/store-123/documents/doc-123",
          mimeType: "application/pdf",
          sizeBytes: "42",
        },
        metadata: { secret: "strip-me" },
      }),
    });

    const immediateOperation = await immediateClient
      .uploadToFileSearchStore(createValidUploadInput());

    assertEquals(immediateOperation, {
      name: "fileSearchStores/store-123/upload/operations/op.safe-id~1",
      response: {
        documentName: "fileSearchStores/store-123/documents/doc-123",
      },
    });

    const errorClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createSuccessfulUploadFetch({
        name: "fileSearchStores/store-123/operations/op-error",
        done: true,
        error: {
          code: 13,
          message: "SENSITIVE_PROVIDER_MESSAGE",
          details: [{ secret: "SENSITIVE_DETAIL" }],
        },
      }),
    });

    const errorOperation = await errorClient.uploadToFileSearchStore(
      createValidUploadInput(),
    );

    assertEquals(errorOperation, {
      name: "fileSearchStores/store-123/operations/op-error",
      done: true,
      error: { code: 13 },
    });
    assertEquals(
      JSON.stringify(errorOperation).includes("SENSITIVE"),
      false,
    );
  },
);

Deno.test(
  "45. Encoded, whitespace, control, backslash, URL, and empty operation IDs are rejected",
  async () => {
    const invalidOperationNames = [
      "fileSearchStores/store-123/upload/operations/",
      "fileSearchStores/store-123/upload/operations/.",
      "fileSearchStores/store-123/upload/operations/..",
      "fileSearchStores/store-123/upload/operations/%2e%2e",
      "fileSearchStores/store-123/upload/operations/op%2Fextra",
      "fileSearchStores/store-123/upload/operations/op id",
      "fileSearchStores/store-123/upload/operations/op\\id",
      "fileSearchStores/store-123/upload/operations/op\u0000id",
      "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/store-123/upload/operations/op",
    ];

    for (const name of invalidOperationNames) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createSuccessfulUploadFetch({ name }),
      });

      await assertRejects(
        () =>
          client.uploadToFileSearchStore(
            createValidUploadInput(),
          ),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "46. Invalid document IDs are rejected using the provider resource contract",
  async () => {
    const invalidDocumentNames = [
      "fileSearchStores/store-123/documents/Doc-1",
      "fileSearchStores/store-123/documents/doc_1",
      `fileSearchStores/store-123/documents/${"a".repeat(41)}`,
      "fileSearchStores/store-123/documents/-doc",
      "fileSearchStores/store-123/documents/doc-",
      "fileSearchStores/store-123/documents/..",
      "fileSearchStores/store-123/documents/doc/extra",
      "fileSearchStores/store-123/documents/doc?query=1",
    ];

    for (const documentName of invalidDocumentNames) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createSuccessfulUploadFetch({
          name: "fileSearchStores/store-123/upload/operations/op-doc",
          response: { documentName },
        }),
      });

      await assertRejects(
        () =>
          client.uploadToFileSearchStore(
            createValidUploadInput(),
          ),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "47. Case-insensitive upload headers are read and safe provider query parameters are preserved",
  async () => {
    const sessionUrl =
      "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=session-1&part=a%20b&part=c";
    let finalUrl: string | undefined;

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch((call) => {
        if (call.headers["x-goog-upload-command"] === "start") {
          const headers = new Headers();
          headers.set("X-GoOg-UpLoAd-UrL", sessionUrl);
          return new Response(null, { status: 200, headers });
        }

        finalUrl = call.url;
        return new Response(
          JSON.stringify({
            name: "fileSearchStores/store-123/upload/operations/op-query",
          }),
          { status: 200 },
        );
      }),
    });

    await client.uploadToFileSearchStore(createValidUploadInput());
    assertEquals(finalUrl, sessionUrl);
  },
);

Deno.test(
  "48. uploadTimeoutMs governs stalled final response-body consumption",
  async () => {
    let callCount = 0;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      requestTimeoutMs: 1_000,
      uploadTimeoutMs: 20,
      fetchFn: createMockFetch((call) => {
        callCount++;
        if (call.headers["x-goog-upload-command"] === "start") {
          const headers = new Headers();
          headers.set(
            "x-goog-upload-url",
            "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=timeout",
          );
          return new Response(null, { status: 200, headers });
        }

        const stalledResponse = new Response(null, { status: 200 });
        Object.defineProperty(stalledResponse, "json", {
          configurable: true,
          value: (): Promise<unknown> =>
            new Promise<unknown>(() => {
              // The upload deadline must settle the outer request.
            }),
        });
        return stalledResponse;
      }),
    });

    const startedAt = performance.now();
    const error = await assertRejects(
      () =>
        client.uploadToFileSearchStore(
          createValidUploadInput(),
        ),
      { code: "GEMINI_REQUEST_TIMEOUT" },
    );
    const elapsedMs = performance.now() - startedAt;

    assertEquals(error.isRetryable, true);
    assertEquals(callCount, 2);
    assert(
      elapsedMs < 1_000,
      `The final response body exceeded the upload deadline: ${elapsedMs} ms`,
    );
  },
);

Deno.test(
  "49. Finalisation HTTP, abort, and network failures use sanitised error codes",
  async () => {
    function createFinalFailureFetch(
      finalHandler: () => Response | Promise<Response>,
    ): typeof fetch {
      return createMockFetch((call) => {
        if (call.headers["x-goog-upload-command"] === "start") {
          const headers = new Headers();
          headers.set(
            "x-goog-upload-url",
            "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=failure",
          );
          return new Response(null, { status: 200, headers });
        }

        return finalHandler();
      });
    }

    const httpClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createFinalFailureFetch(
        () => new Response("SENSITIVE_BODY", { status: 503 }),
      ),
    });
    const httpError = await assertRejects(
      () =>
        httpClient.uploadToFileSearchStore(
          createValidUploadInput(),
        ),
      { code: "GEMINI_HTTP_ERROR", status: 503 },
    );
    assertEquals(httpError.message.includes("SENSITIVE_BODY"), false);

    const abortClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createFinalFailureFetch(() => {
        const error = new Error("SENSITIVE_ABORT");
        error.name = "AbortError";
        return Promise.reject(error);
      }),
    });
    const abortError = await assertRejects(
      () =>
        abortClient.uploadToFileSearchStore(
          createValidUploadInput(),
        ),
      { code: "GEMINI_REQUEST_TIMEOUT" },
    );
    assertEquals(abortError.message.includes("SENSITIVE_ABORT"), false);

    const networkClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createFinalFailureFetch(
        () => Promise.reject(new TypeError("SENSITIVE_NETWORK")),
      ),
    });
    const networkError = await assertRejects(
      () =>
        networkClient.uploadToFileSearchStore(
          createValidUploadInput(),
        ),
      { code: "GEMINI_NETWORK_ERROR" },
    );
    assertEquals(networkError.message.includes("SENSITIVE_NETWORK"), false);
  },
);

Deno.test(
  "50. Malformed final JSON and non-object operation payloads are rejected",
  async () => {
    const invalidBodies = [
      "{not-json",
      JSON.stringify(null),
      JSON.stringify([]),
      JSON.stringify("operation"),
      JSON.stringify(123),
    ];

    for (const body of invalidBodies) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch((call) => {
          if (call.headers["x-goog-upload-command"] === "start") {
            const headers = new Headers();
            headers.set(
              "x-goog-upload-url",
              "https://generativelanguage.googleapis.com/upload/v1beta/fileSearchStores/store-123:uploadToFileSearchStore?upload_id=invalid-json",
            );
            return new Response(null, { status: 200, headers });
          }

          return new Response(body, { status: 200 });
        }),
      });

      await assertRejects(
        () =>
          client.uploadToFileSearchStore(
            createValidUploadInput(),
          ),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "51. getOperation validates operation name before fetch and supports both operation name forms",
  async () => {
    const invalidOpNames = [
      "",
      "   ",
      "invalid-op-name",
      "fileSearchStores/store-123/operations/..",
      "fileSearchStores/store-123/operations/../bad",
      "fileSearchStores/store-123/invalid/op-1",
      "fileSearchStores/STORE-123/operations/op-1",
    ];

    let fetchCalled = false;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: () => {
        fetchCalled = true;
        return Promise.reject(new Error("Network should not be called"));
      },
    });

    for (const name of invalidOpNames) {
      await assertRejects(
        () => client.getOperation(name),
        { code: "INVALID_RESOURCE_NAME" },
      );
    }
    assertEquals(fetchCalled, false);

    const validNames = [
      "fileSearchStores/store-123/operations/op-456",
      "fileSearchStores/store-123/upload/operations/op-789",
    ];

    for (const name of validNames) {
      const calls: MockFetchCall[] = [];
      const mockClient = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch((call) => {
          calls.push(call);
          return new Response(
            JSON.stringify({
              name,
              done: false,
            }),
            { status: 200 },
          );
        }),
      });

      const op = await mockClient.getOperation(name);
      assertEquals(op.name, name);
      assertEquals(op.done, false);
      assertEquals(calls.length, 1);
      assertEquals(
        calls[0].url,
        `https://generativelanguage.googleapis.com/v1beta/${name}`,
      );
      assertEquals(calls[0].method, "GET");
      assertEquals(calls[0].headers["x-goog-api-key"], "test-key");
      assertEquals(calls[0].redirect, "error");
    }
  },
);

Deno.test(
  "52. getOperation enforces exact operation name matching in response",
  async () => {
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: "fileSearchStores/store-123/operations/different-op",
            done: false,
          }),
          { status: 200 },
        );
      }),
    });

    await assertRejects(
      () => client.getOperation("fileSearchStores/store-123/operations/op-123"),
      { code: "GEMINI_INVALID_RESPONSE" },
    );
  },
);

Deno.test(
  "53. waitForUploadOperation handles immediate completion without sleeping or fetching",
  async () => {
    let sleepCalled = false;
    let fetchCalled = false;

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: () => {
        fetchCalled = true;
        return Promise.reject(new Error("Network should not be called"));
      },
      sleepFn: () => {
        sleepCalled = true;
        return Promise.resolve();
      },
    });

    const initialOp = {
      name: "fileSearchStores/store-123/operations/op-123",
      response: {
        documentName: "fileSearchStores/store-123/documents/doc-123",
      },
    };

    const result = await client.waitForUploadOperation(initialOp);
    assertEquals(result.name, initialOp.name);
    assertEquals(
      result.response?.documentName,
      "fileSearchStores/store-123/documents/doc-123",
    );
    assertEquals(sleepCalled, false);
    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "54. waitForUploadOperation handles multiple polls until completion with injected clock and sleepFn",
  async () => {
    const sleepMsLogs: number[] = [];
    let nowTime = 1000;
    const fetchCalls: string[] = [];

    let pollCount = 0;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      pollIntervalMs: 2000,
      operationTimeoutMs: 30000,
      sleepFn: (ms) => {
        sleepMsLogs.push(ms);
        nowTime += ms;
        return Promise.resolve();
      },
      nowFn: () => nowTime,
      fetchFn: createMockFetch((call) => {
        fetchCalls.push(call.url);
        pollCount++;
        if (pollCount === 1) {
          return new Response(
            JSON.stringify({
              name: "fileSearchStores/store-123/upload/operations/op-999",
              done: false,
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            name: "fileSearchStores/store-123/upload/operations/op-999",
            done: true,
            response: {
              documentName: "fileSearchStores/store-123/documents/doc-999",
            },
          }),
          { status: 200 },
        );
      }),
    });

    const initialOp = {
      name: "fileSearchStores/store-123/upload/operations/op-999",
      done: false,
    };

    const result = await client.waitForUploadOperation(initialOp);
    assertEquals(
      result.response?.documentName,
      "fileSearchStores/store-123/documents/doc-999",
    );
    assertEquals(result.done, true);
    assertEquals(pollCount, 2);
    assertEquals(sleepMsLogs, [2000, 2000]);
    assertEquals(fetchCalls.length, 2);
  },
);

Deno.test(
  "55. waitForUploadOperation rejects failed operations with sanitised GEMINI_OPERATION_FAILED",
  async () => {
    const client = createGeminiRestClient({
      apiKey: "test-key",
      sleepFn: () => Promise.resolve(),
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: "fileSearchStores/store-123/operations/op-failed",
            done: true,
            error: {
              code: 13,
              message: "SECRET_PROVIDER_ERROR_DETAILS",
            },
          }),
          { status: 200 },
        );
      }),
    });

    const err = await assertRejects(
      () =>
        client.waitForUploadOperation({
          name: "fileSearchStores/store-123/operations/op-failed",
          done: false,
        }),
      { code: "GEMINI_OPERATION_FAILED", status: 13 },
    );

    assertEquals(err.message.includes("SECRET_PROVIDER_ERROR_DETAILS"), false);
  },
);

Deno.test(
  "56. waitForUploadOperation rejects malformed completed operations with GEMINI_INVALID_RESPONSE",
  async () => {
    const client = createGeminiRestClient({
      apiKey: "test-key",
      sleepFn: () => Promise.resolve(),
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: "fileSearchStores/store-123/operations/op-malformed",
            done: true,
          }),
          { status: 200 },
        );
      }),
    });

    await assertRejects(
      () =>
        client.waitForUploadOperation({
          name: "fileSearchStores/store-123/operations/op-malformed",
          done: false,
        }),
      { code: "GEMINI_INVALID_RESPONSE" },
    );
  },
);

Deno.test(
  "57. waitForUploadOperation enforces total operation deadline and throws retryable GEMINI_OPERATION_TIMEOUT",
  async () => {
    let nowTime = 1000;

    const client = createGeminiRestClient({
      apiKey: "test-key",
      pollIntervalMs: 5000,
      operationTimeoutMs: 10000,
      nowFn: () => nowTime,
      sleepFn: (ms) => {
        nowTime += ms + 2000;
        return Promise.resolve();
      },
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: "fileSearchStores/store-123/operations/op-timeout",
            done: false,
          }),
          { status: 200 },
        );
      }),
    });

    const err = await assertRejects(
      () =>
        client.waitForUploadOperation({
          name: "fileSearchStores/store-123/operations/op-timeout",
          done: false,
        }),
      { code: "GEMINI_OPERATION_TIMEOUT" },
    );
    assertEquals(err.isRetryable, true);
  },
);

Deno.test(
  "58. waitForUploadOperation does not retry HTTP or network errors during polling",
  async () => {
    let fetchCount = 0;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      pollIntervalMs: 100,
      sleepFn: () => Promise.resolve(),
      fetchFn: createMockFetch(() => {
        fetchCount++;
        return new Response("Internal Error", { status: 500 });
      }),
    });

    await assertRejects(
      () =>
        client.waitForUploadOperation({
          name: "fileSearchStores/store-123/operations/op-500",
          done: false,
        }),
      { code: "GEMINI_HTTP_ERROR", status: 500 },
    );

    assertEquals(fetchCount, 1);
  },
);

Deno.test(
  "59. waitForUploadOperation rejects invalid initialOperation input before fetching or sleeping",
  async () => {
    let fetchCalled = false;
    let sleepCalled = false;

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: () => {
        fetchCalled = true;
        return Promise.reject(new Error("Network should not be called"));
      },
      sleepFn: () => {
        sleepCalled = true;
        return Promise.resolve();
      },
    });

    const invalidInputs = [
      null,
      undefined,
      "not-an-object",
      123,
      {},
      { name: "invalid-name" },
      { name: "fileSearchStores/store-123/operations/.." },
    ];

    for (const input of invalidInputs) {
      await assertRejects(
        () =>
          client.waitForUploadOperation(input as unknown as GeminiOperation),
      );
    }

    assertEquals(fetchCalled, false);
    assertEquals(sleepCalled, false);
  },
);

Deno.test(
  "60. getOperation and waitForUploadOperation never leak sensitive details, raw bodies, or API keys in errors",
  async () => {
    const sensitiveBody = "SENSITIVE_SECRET_PROVIDER_PAYLOAD";
    const client = createGeminiRestClient({
      apiKey: "test-api-key-secret",
      fetchFn: createMockFetch(() => {
        return new Response(sensitiveBody, { status: 404 });
      }),
    });

    const httpErr = await assertRejects(
      () => client.getOperation("fileSearchStores/store-123/operations/op-404"),
      { code: "GEMINI_HTTP_ERROR", status: 404 },
    );
    assertEquals(httpErr.message.includes(sensitiveBody), false);
    assertEquals(httpErr.message.includes("test-api-key-secret"), false);

    const pollClient = createGeminiRestClient({
      apiKey: "test-api-key-secret",
      sleepFn: () => Promise.resolve(),
      fetchFn: createMockFetch(() => {
        return new Response(sensitiveBody, { status: 502 });
      }),
    });

    const pollErr = await assertRejects(
      () =>
        pollClient.waitForUploadOperation({
          name: "fileSearchStores/store-123/operations/op-502",
          done: false,
        }),
      { code: "GEMINI_HTTP_ERROR", status: 502 },
    );
    assertEquals(pollErr.message.includes(sensitiveBody), false);
    assertEquals(pollErr.message.includes("test-api-key-secret"), false);
  },
);

Deno.test(
  "61. getDocument and deleteDocument validate document resource names before fetch",
  async () => {
    let fetchCalled = false;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: () => {
        fetchCalled = true;
        return Promise.reject(new Error("Network should not be called"));
      },
    });

    const invalidDocumentNames = [
      "",
      "   ",
      "invalid-doc-name",
      "fileSearchStores/store-123",
      "fileSearchStores/store-123/documents",
      "fileSearchStores/store-123/documents/",
      "fileSearchStores/store-123/documents/-doc",
      "fileSearchStores/store-123/documents/doc-",
      "fileSearchStores/store-123/documents/DOC-123",
      "fileSearchStores/STORE-123/documents/doc-123",
      "fileSearchStores/store-123/documents/doc.123",
      "fileSearchStores/store-123/documents/doc_123",
      "fileSearchStores/store-123/documents/a123456789b123456789c123456789d123456789e",
      "fileSearchStores/store-123/documents/doc/extra",
    ];

    for (const name of invalidDocumentNames) {
      await assertRejects(
        () => client.getDocument(name),
        { code: "INVALID_RESOURCE_NAME" },
      );
      await assertRejects(
        () => client.deleteDocument(name),
        { code: "INVALID_RESOURCE_NAME" },
      );
    }

    assertEquals(fetchCalled, false);
  },
);

Deno.test(
  "62. getDocument sends exact GET request and returns null on 404",
  async () => {
    const calls: MockFetchCall[] = [];
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch((call) => {
        calls.push(call);
        return new Response("Not Found", { status: 404 });
      }),
    });

    const docName = "fileSearchStores/store-123/documents/doc-456";
    const result = await client.getDocument(docName);

    assertEquals(result, null);
    assertEquals(calls.length, 1);
    assertEquals(
      calls[0].url,
      `https://generativelanguage.googleapis.com/v1beta/${docName}`,
    );
    assertEquals(calls[0].method, "GET");
    assertEquals(calls[0].headers["x-goog-api-key"], "test-key");
    assertEquals(calls[0].redirect, "error");
  },
);

Deno.test(
  "63. getDocument parses valid document response and sanitises unknown provider fields",
  async () => {
    const docName = "fileSearchStores/store-123/documents/doc-456";
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: docName,
            displayName: "Test Document",
            customMetadata: [
              { key: "category", stringValue: "analytics" },
            ],
            createTime: "2026-07-29T10:00:00Z",
            updateTime: "2026-07-29T10:05:00Z",
            state: "STATE_ACTIVE",
            sizeBytes: "2048",
            mimeType: "application/pdf",
            secretProviderData: "sensitive-info",
            unknownField: 123,
          }),
          { status: 200 },
        );
      }),
    });

    const doc = await client.getDocument(docName);
    assertEquals(doc, {
      name: docName,
      displayName: "Test Document",
      customMetadata: [
        { key: "category", stringValue: "analytics" },
      ],
      createTime: "2026-07-29T10:00:00Z",
      updateTime: "2026-07-29T10:05:00Z",
      state: "STATE_ACTIVE",
      sizeBytes: "2048",
      mimeType: "application/pdf",
    });
    assertEquals(
      "secretProviderData" in (doc as unknown as Record<string, unknown>),
      false,
    );
    assertEquals(
      "unknownField" in (doc as unknown as Record<string, unknown>),
      false,
    );
  },
);

Deno.test(
  "64. getDocument strictly validates returned known fields and rejects malformed fields",
  async () => {
    const docName = "fileSearchStores/store-123/documents/doc-456";

    const malformedPayloads = [
      null,
      [],
      "not-an-object",
      { name: "invalid-doc-name" },
      { name: docName, displayName: "  padded  " },
      { name: docName, displayName: "" },
      { name: docName, createTime: 123 },
      { name: docName, updateTime: "" },
      { name: docName, state: "INVALID_STATE" },
      { name: docName, sizeBytes: -100 },
      { name: docName, sizeBytes: "not-a-number" },
      { name: docName, mimeType: "text/plain" },
      { name: docName, customMetadata: "not-an-array" },
      { name: docName, customMetadata: [{ key: "k1" }] },
      {
        name: docName,
        customMetadata: [{ key: "k1", stringValue: "v1", extra: "x" }],
      },
      {
        name: docName,
        customMetadata: [
          { key: "k1", stringValue: "v1" },
          { key: "k1", stringValue: "v2" },
        ],
      },
    ];

    for (const payload of malformedPayloads) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch(() => {
          return new Response(JSON.stringify(payload), { status: 200 });
        }),
      });

      await assertRejects(
        () => client.getDocument(docName),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "65. getDocument rejects foreign document names with GEMINI_INVALID_RESPONSE",
  async () => {
    const requestedName = "fileSearchStores/store-123/documents/doc-456";
    const foreignName = "fileSearchStores/store-123/documents/doc-789";

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: foreignName,
            displayName: "Foreign Document",
          }),
          { status: 200 },
        );
      }),
    });

    await assertRejects(
      () => client.getDocument(requestedName),
      { code: "GEMINI_INVALID_RESPONSE" },
    );
  },
);

Deno.test(
  "66. deleteDocument sends exact forced DELETE request and handles success and 404",
  async () => {
    const docName = "fileSearchStores/store-123/documents/doc-456";
    const calls: MockFetchCall[] = [];

    let statusToReturn = 200;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch((call) => {
        calls.push(call);
        return new Response("", { status: statusToReturn });
      }),
    });

    const delResult = await client.deleteDocument(docName);
    assertEquals(delResult, { outcome: "deleted" });
    assertEquals(calls.length, 1);
    assertEquals(
      calls[0].url,
      `https://generativelanguage.googleapis.com/v1beta/${docName}?force=true`,
    );
    assertEquals(calls[0].method, "DELETE");
    assertEquals(calls[0].headers["x-goog-api-key"], "test-key");
    assertEquals(calls[0].redirect, "error");

    statusToReturn = 404;
    const notFoundResult = await client.deleteDocument(docName);
    assertEquals(notFoundResult, { outcome: "not_found" });
  },
);

Deno.test(
  "67. getDocument and deleteDocument handle timeouts, HTTP, and network failures without retries",
  async () => {
    let getFetchCount = 0;
    let delFetchCount = 0;

    const errorClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch((call) => {
        if (call.method === "GET") {
          getFetchCount++;
        } else {
          delFetchCount++;
        }
        return new Response("Server Error", { status: 500 });
      }),
    });

    const docName = "fileSearchStores/store-123/documents/doc-456";

    await assertRejects(
      () => errorClient.getDocument(docName),
      { code: "GEMINI_HTTP_ERROR", status: 500 },
    );
    assertEquals(getFetchCount, 1);

    await assertRejects(
      () => errorClient.deleteDocument(docName),
      { code: "GEMINI_HTTP_ERROR", status: 500 },
    );
    assertEquals(delFetchCount, 1);
  },
);

Deno.test(
  "68. getDocument and deleteDocument never leak sensitive details, raw bodies, or API keys in errors",
  async () => {
    const sensitiveBody = "SENSITIVE_SECRET_PROVIDER_PAYLOAD";
    const client = createGeminiRestClient({
      apiKey: "test-api-key-secret",
      fetchFn: createMockFetch(() => {
        return new Response(sensitiveBody, { status: 403 });
      }),
    });

    const docName = "fileSearchStores/store-123/documents/doc-456";

    const getErr = await assertRejects(
      () => client.getDocument(docName),
      { code: "GEMINI_HTTP_ERROR", status: 403 },
    );
    assertEquals(getErr.message.includes(sensitiveBody), false);
    assertEquals(getErr.message.includes("test-api-key-secret"), false);

    const delErr = await assertRejects(
      () => client.deleteDocument(docName),
      { code: "GEMINI_HTTP_ERROR", status: 403 },
    );
    assertEquals(delErr.message.includes(sensitiveBody), false);
    assertEquals(delErr.message.includes("test-api-key-secret"), false);
  },
);

Deno.test(
  "69. getDocument accepts real RFC 3339 timestamps and rejects malformed calendar dates or timezones",
  async () => {
    const docName = "fileSearchStores/store-123/documents/doc-456";
    const validTimestamps = [
      "0001-01-01T00:00:00Z",
      "2000-02-29T23:59:59.123456789Z",
      "2026-07-29T10:05:00+02:00",
      "2026-07-29T23:59:59.999999999-23:59",
      "9999-12-31T23:59:59.999999999Z",
    ];

    for (const timestamp of validTimestamps) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch(() => {
          return new Response(
            JSON.stringify({
              name: docName,
              createTime: timestamp,
              updateTime: timestamp,
            }),
            { status: 200 },
          );
        }),
      });

      const document = await client.getDocument(docName);
      assertEquals(document?.createTime, timestamp);
      assertEquals(document?.updateTime, timestamp);
    }

    const invalidTimestamps = [
      "",
      "0000-01-01T00:00:00Z",
      "2025-02-29T10:00:00Z",
      "2024-02-30T10:00:00Z",
      "2026-04-31T10:00:00Z",
      "2026-13-01T10:00:00Z",
      "2026-07-29T24:00:00Z",
      "2026-07-29T10:60:00Z",
      "2026-07-29T10:00:60Z",
      "2026-07-29T10:00:00",
      "2026-07-29 10:00:00Z",
      "2026-07-29t10:00:00z",
      "2026-07-29T10:00:00.1234567890Z",
      "2026-07-29T10:00:00+24:00",
      "2026-07-29T10:00:00+02:60",
      "0001-01-01T00:00:00+00:01",
      "9999-12-31T23:59:59-00:01",
    ];

    for (const timestamp of invalidTimestamps) {
      for (const field of ["createTime", "updateTime"] as const) {
        const client = createGeminiRestClient({
          apiKey: "test-key",
          fetchFn: createMockFetch(() => {
            return new Response(
              JSON.stringify({
                name: docName,
                [field]: timestamp,
              }),
              { status: 200 },
            );
          }),
        });

        await assertRejects(
          () => client.getDocument(docName),
          { code: "GEMINI_INVALID_RESPONSE" },
        );
      }
    }
  },
);

Deno.test(
  "70. getDocument validates sizeBytes as a canonical non-negative int64 string",
  async () => {
    const docName = "fileSearchStores/store-123/documents/doc-456";
    const validSizes = [
      "0",
      "1",
      "9223372036854775806",
      "9223372036854775807",
    ];

    for (const sizeBytes of validSizes) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch(() => {
          return new Response(
            JSON.stringify({ name: docName, sizeBytes }),
            { status: 200 },
          );
        }),
      });

      const document = await client.getDocument(docName);
      assertEquals(document?.sizeBytes, sizeBytes);
    }

    const invalidSizes: unknown[] = [
      "",
      "-1",
      "+1",
      "00",
      "01",
      "1.0",
      " 1",
      "1 ",
      "1e3",
      "9223372036854775808",
      "99999999999999999999",
      0,
      1,
      null,
    ];

    for (const sizeBytes of invalidSizes) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch(() => {
          return new Response(
            JSON.stringify({ name: docName, sizeBytes }),
            { status: 200 },
          );
        }),
      });

      await assertRejects(
        () => client.getDocument(docName),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }
  },
);

Deno.test(
  "71. getDocument accepts twenty metadata entries and rejects twenty-one",
  async () => {
    const docName = "fileSearchStores/store-123/documents/doc-456";
    const metadata = Array.from(
      { length: 21 },
      (_, index) => ({
        key: `key-${index}`,
        stringValue: `value-${index}`,
      }),
    );

    const acceptedClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            name: docName,
            customMetadata: metadata.slice(0, 20),
          }),
          { status: 200 },
        );
      }),
    });

    const acceptedDocument = await acceptedClient.getDocument(docName);
    assertEquals(acceptedDocument?.customMetadata?.length, 20);

    let rejectedFetchCount = 0;
    const rejectedClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        rejectedFetchCount++;
        return new Response(
          JSON.stringify({
            name: docName,
            customMetadata: metadata,
          }),
          { status: 200 },
        );
      }),
    });

    await assertRejects(
      () => rejectedClient.getDocument(docName),
      { code: "GEMINI_INVALID_RESPONSE" },
    );
    assertEquals(rejectedFetchCount, 1);
  },
);

Deno.test(
  "72. requestTimeoutMs governs successful getDocument JSON-body consumption",
  async () => {
    const stalledResponse = new Response(null, { status: 200 });
    Object.defineProperty(stalledResponse, "json", {
      configurable: true,
      value: (): Promise<unknown> =>
        new Promise<unknown>(() => {
          // The request deadline must settle the outer request.
        }),
    });

    let fetchCount = 0;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      requestTimeoutMs: 20,
      fetchFn: createMockFetch(() => {
        fetchCount++;
        return stalledResponse;
      }),
    });

    const startedAt = performance.now();
    const error = await assertRejects(
      () =>
        client.getDocument(
          "fileSearchStores/store-123/documents/doc-456",
        ),
      { code: "GEMINI_REQUEST_TIMEOUT" },
    );
    const elapsedMs = performance.now() - startedAt;

    assertEquals(error.isRetryable, true);
    assertEquals(fetchCount, 1);
    assert(
      elapsedMs < 1_000,
      `The document response body exceeded the deadline: ${elapsedMs} ms`,
    );
  },
);

Deno.test(
  "73. getDocument and deleteDocument sanitise abort and network failures without retrying",
  async () => {
    const docName = "fileSearchStores/store-123/documents/doc-456";

    for (
      const method of ["getDocument", "deleteDocument"] as const
    ) {
      let abortFetchCount = 0;
      const abortClient = createGeminiRestClient({
        apiKey: "test-api-key-secret",
        fetchFn: createMockFetch(() => {
          abortFetchCount++;
          const error = new Error("SENSITIVE_ABORT_DETAIL");
          error.name = "AbortError";
          return Promise.reject(error);
        }),
      });

      const abortError = await assertRejects(
        () => abortClient[method](docName),
        { code: "GEMINI_REQUEST_TIMEOUT" },
      );
      assertEquals(abortFetchCount, 1);
      assertEquals(
        abortError.message.includes("SENSITIVE_ABORT_DETAIL"),
        false,
      );
      assertEquals(
        abortError.message.includes("test-api-key-secret"),
        false,
      );

      let networkFetchCount = 0;
      const networkClient = createGeminiRestClient({
        apiKey: "test-api-key-secret",
        fetchFn: createMockFetch(() => {
          networkFetchCount++;
          return Promise.reject(
            new TypeError("SENSITIVE_NETWORK_DETAIL"),
          );
        }),
      });

      const networkError = await assertRejects(
        () => networkClient[method](docName),
        { code: "GEMINI_NETWORK_ERROR" },
      );
      assertEquals(networkFetchCount, 1);
      assertEquals(
        networkError.message.includes("SENSITIVE_NETWORK_DETAIL"),
        false,
      );
      assertEquals(
        networkError.message.includes("test-api-key-secret"),
        false,
      );
    }
  },
);

Deno.test(
  "74. listDocuments and listAllDocuments validate store names and page tokens before fetch",
  async () => {
    let fetchCount = 0;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        fetchCount++;
        return new Response("{}", { status: 200 });
      }),
    });

    const invalidStoreNames = [
      "",
      "fileSearchStores/",
      "fileSearchStores/store-123/documents",
      "fileSearchStores/store_123",
      " fileSearchStores/store-123",
      "fileSearchStores/store-123 ",
    ];

    for (const storeName of invalidStoreNames) {
      await assertRejects(
        () => client.listDocuments(storeName),
        { code: "INVALID_RESOURCE_NAME" },
      );
      await assertRejects(
        () => client.listAllDocuments(storeName),
        { code: "INVALID_RESOURCE_NAME" },
      );
    }

    const invalidPageTokens: unknown[] = [
      "",
      " ",
      " padded",
      "padded ",
      "control\u0000token",
      "control\u0085token",
      "a".repeat(4097),
      123,
      null,
      {},
    ];

    for (const pageToken of invalidPageTokens) {
      await assertRejects(
        () =>
          client.listDocuments(
            "fileSearchStores/store-123",
            pageToken as string,
          ),
        { code: "INVALID_ARGUMENT" },
      );
    }

    assertEquals(fetchCount, 0);
  },
);

Deno.test(
  "75. listDocuments sends exact URLs and safely encodes opaque page tokens",
  async () => {
    const calls: MockFetchCall[] = [];
    const client = createGeminiRestClient({
      apiKey: "test-api-key",
      fetchFn: createMockFetch((call) => {
        calls.push(call);
        return new Response(
          JSON.stringify({ documents: [] }),
          { status: 200 },
        );
      }),
    });

    const storeName = "fileSearchStores/store-123";
    await client.listDocuments(storeName);

    const opaqueToken = "opaque token/+?=#&%";
    await client.listDocuments(storeName, opaqueToken);

    assertEquals(calls.length, 2);
    assertEquals(
      calls[0].url,
      `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${storeName}/documents?pageSize=20`,
    );
    assertEquals(
      calls[1].url,
      `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${storeName}/documents?pageSize=20&pageToken=opaque+token%2F%2B%3F%3D%23%26%25`,
    );

    for (const call of calls) {
      assertEquals(call.method, "GET");
      assertEquals(call.headers["x-goog-api-key"], "test-api-key");
      assertEquals(call.body, undefined);
      assertEquals(call.redirect, "error");
    }
  },
);

Deno.test(
  "76. listDocuments handles empty pages and returns only sanitised document fields",
  async () => {
    const storeName = "fileSearchStores/store-123";
    const documentName = `${storeName}/documents/doc-1`;
    const payloads: unknown[] = [
      { providerField: "ignored" },
      { documents: [] },
      {
        documents: [
          {
            name: documentName,
            displayName: "Document One",
            customMetadata: [
              { key: "project", stringValue: "project-1" },
            ],
            createTime: "2026-07-29T10:00:00Z",
            updateTime: "2026-07-29T10:01:00Z",
            state: "STATE_ACTIVE",
            sizeBytes: "2048",
            mimeType: "application/pdf",
            providerSecret: "must-not-return",
          },
        ],
        nextPageToken: "next-token",
        providerField: "ignored",
      },
    ];
    let responseIndex = 0;

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        const payload = payloads[responseIndex++];
        return new Response(JSON.stringify(payload), { status: 200 });
      }),
    });

    assertEquals(
      await client.listDocuments(storeName),
      { documents: [] },
    );
    assertEquals(
      await client.listDocuments(storeName),
      { documents: [] },
    );

    const page = await client.listDocuments(storeName);
    assertEquals(page, {
      documents: [
        {
          name: documentName,
          displayName: "Document One",
          customMetadata: [
            { key: "project", stringValue: "project-1" },
          ],
          createTime: "2026-07-29T10:00:00Z",
          updateTime: "2026-07-29T10:01:00Z",
          state: "STATE_ACTIVE",
          sizeBytes: "2048",
          mimeType: "application/pdf",
        },
      ],
      nextPageToken: "next-token",
    });
    assertEquals(
      "providerField" in (page as unknown as Record<string, unknown>),
      false,
    );
    assertEquals(
      "providerSecret" in
        (page.documents[0] as unknown as Record<string, unknown>),
      false,
    );
  },
);

Deno.test(
  "77. listDocuments strictly rejects malformed list responses and page tokens",
  async () => {
    const storeName = "fileSearchStores/store-123";
    const documentName = `${storeName}/documents/doc-1`;
    const malformedPayloads: unknown[] = [
      null,
      [],
      "not-an-object",
      { documents: null },
      { documents: {} },
      { documents: [null] },
      { documents: [{ name: documentName, sizeBytes: "01" }] },
      { documents: [], nextPageToken: "" },
      { documents: [], nextPageToken: " padded" },
      { documents: [], nextPageToken: "padded " },
      { documents: [], nextPageToken: "control\u0000token" },
      { documents: [], nextPageToken: "control\u0085token" },
      { documents: [], nextPageToken: "a".repeat(4097) },
      { documents: [], nextPageToken: 123 },
    ];

    for (const payload of malformedPayloads) {
      const client = createGeminiRestClient({
        apiKey: "test-key",
        fetchFn: createMockFetch(() => {
          return new Response(JSON.stringify(payload), { status: 200 });
        }),
      });

      await assertRejects(
        () => client.listDocuments(storeName),
        { code: "GEMINI_INVALID_RESPONSE" },
      );
    }

    const invalidJsonClient = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response("NOT_JSON", { status: 200 });
      }),
    });

    await assertRejects(
      () => invalidJsonClient.listDocuments(storeName),
      { code: "GEMINI_INVALID_RESPONSE" },
    );
  },
);

Deno.test(
  "78. listDocuments rejects documents belonging to another store",
  async () => {
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        return new Response(
          JSON.stringify({
            documents: [
              {
                name: "fileSearchStores/foreign-store/documents/foreign-doc",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    });

    await assertRejects(
      () => client.listDocuments("fileSearchStores/store-123"),
      { code: "GEMINI_INVALID_RESPONSE" },
    );
  },
);

Deno.test(
  "79. listAllDocuments fetches pages sequentially and preserves document order",
  async () => {
    const storeName = "fileSearchStores/store-123";
    const calls: MockFetchCall[] = [];

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch((call) => {
        calls.push(call);
        const pageToken = new URL(call.url).searchParams.get("pageToken");

        if (pageToken === null) {
          return new Response(
            JSON.stringify({
              documents: [
                { name: `${storeName}/documents/doc-1` },
                { name: `${storeName}/documents/doc-2` },
              ],
              nextPageToken: "token/+?",
            }),
            { status: 200 },
          );
        }

        assertEquals(pageToken, "token/+?");
        return new Response(
          JSON.stringify({
            documents: [
              { name: `${storeName}/documents/doc-3` },
            ],
          }),
          { status: 200 },
        );
      }),
    });

    const documents = await client.listAllDocuments(storeName);
    assertEquals(
      documents.map((document) => document.name),
      [
        `${storeName}/documents/doc-1`,
        `${storeName}/documents/doc-2`,
        `${storeName}/documents/doc-3`,
      ],
    );
    assertEquals(calls.length, 2);
    assertEquals(
      calls[1].url,
      `${GEMINI_API_ORIGIN}/${GEMINI_API_VERSION}/${storeName}/documents?pageSize=20&pageToken=token%2F%2B%3F`,
    );
  },
);

Deno.test(
  "80. listAllDocuments rejects repeated page tokens without another fetch",
  async () => {
    const sensitiveToken = "SENSITIVE_REPEAT_TOKEN";
    let fetchCount = 0;

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        fetchCount++;
        const nextPageToken = fetchCount === 1
          ? sensitiveToken
          : fetchCount === 2
          ? "second-token"
          : sensitiveToken;

        return new Response(
          JSON.stringify({
            documents: [],
            nextPageToken,
          }),
          { status: 200 },
        );
      }),
    });

    const error = await assertRejects(
      () => client.listAllDocuments("fileSearchStores/store-123"),
      { code: "GEMINI_PAGINATION_ERROR" },
    );
    assertEquals(fetchCount, 3);
    assertEquals(error.message.includes(sensitiveToken), false);
  },
);

Deno.test(
  "81. listAllDocuments rejects duplicate document names across pages",
  async () => {
    const storeName = "fileSearchStores/store-123";
    const duplicateName = `${storeName}/documents/doc-1`;
    let fetchCount = 0;

    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        fetchCount++;
        return new Response(
          JSON.stringify(
            fetchCount === 1
              ? {
                documents: [{ name: duplicateName }],
                nextPageToken: "page-2",
              }
              : {
                documents: [{ name: duplicateName }],
              },
          ),
          { status: 200 },
        );
      }),
    });

    const error = await assertRejects(
      () => client.listAllDocuments(storeName),
      { code: "GEMINI_PAGINATION_ERROR" },
    );
    assertEquals(fetchCount, 2);
    assertEquals(error.message.includes(duplicateName), false);
  },
);

Deno.test(
  "82. listAllDocuments enforces the one-thousand-page limit",
  async () => {
    let fetchCount = 0;
    const client = createGeminiRestClient({
      apiKey: "test-key",
      fetchFn: createMockFetch(() => {
        fetchCount++;
        return new Response(
          JSON.stringify({
            documents: [],
            nextPageToken: `page-${fetchCount + 1}`,
          }),
          { status: 200 },
        );
      }),
    });

    await assertRejects(
      () => client.listAllDocuments("fileSearchStores/store-123"),
      { code: "GEMINI_PAGINATION_ERROR" },
    );
    assertEquals(fetchCount, 1000);
  },
);

Deno.test(
  "83. listing timeouts and request failures are sanitised and never retried",
  async () => {
    const storeName = "fileSearchStores/store-123";
    const apiKey = "SENSITIVE_API_KEY";
    const providerBody = "SENSITIVE_PROVIDER_BODY";

    const stalledResponse = new Response(null, { status: 200 });
    Object.defineProperty(stalledResponse, "json", {
      configurable: true,
      value: (): Promise<unknown> =>
        new Promise<unknown>(() => {
          // The outer request deadline must settle this stalled body.
        }),
    });

    let timeoutFetchCount = 0;
    const timeoutClient = createGeminiRestClient({
      apiKey,
      requestTimeoutMs: 20,
      fetchFn: createMockFetch(() => {
        timeoutFetchCount++;
        return stalledResponse;
      }),
    });

    const timeoutError = await assertRejects(
      () => timeoutClient.listDocuments(storeName),
      { code: "GEMINI_REQUEST_TIMEOUT" },
    );
    assertEquals(timeoutFetchCount, 1);
    assertEquals(timeoutError.isRetryable, true);

    let httpFetchCount = 0;
    const httpClient = createGeminiRestClient({
      apiKey,
      fetchFn: createMockFetch(() => {
        httpFetchCount++;
        return new Response(providerBody, { status: 500 });
      }),
    });

    const httpError = await assertRejects(
      () => httpClient.listAllDocuments(storeName),
      { code: "GEMINI_HTTP_ERROR", status: 500 },
    );
    assertEquals(httpFetchCount, 1);

    for (const useAbortError of [true, false]) {
      let fetchCount = 0;
      const failureClient = createGeminiRestClient({
        apiKey,
        fetchFn: createMockFetch(() => {
          fetchCount++;
          const error = new Error(
            useAbortError
              ? "SENSITIVE_ABORT_DETAIL"
              : "SENSITIVE_NETWORK_DETAIL",
          );
          if (useAbortError) {
            error.name = "AbortError";
          }
          return Promise.reject(error);
        }),
      });

      const error = await assertRejects(
        () => failureClient.listDocuments(storeName),
        {
          code: useAbortError
            ? "GEMINI_REQUEST_TIMEOUT"
            : "GEMINI_NETWORK_ERROR",
        },
      );
      assertEquals(fetchCount, 1);
      assertEquals(error.message.includes(apiKey), false);
      assertEquals(error.message.includes(providerBody), false);
      assertEquals(error.message.includes("SENSITIVE"), false);
    }

    for (const error of [timeoutError, httpError]) {
      assertEquals(error.message.includes(apiKey), false);
      assertEquals(error.message.includes(providerBody), false);
    }
  },
);