import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  handlePaystackCheckoutRequest,
  type FetchFunction,
  type ServiceSupabaseClient,
  type UserSupabaseClient,
} from "../../supabase/functions/paystack-checkout/index.ts";
import {
  MAX_REQUEST_BYTES,
  PAYSTACK_INITIALIZE_URL,
  buildPaystackInitializePayload,
  decodeInitializedPaymentRpcResult,
  decodeRecordCheckoutSessionRpcResult,
  isTransientDatabaseError,
  parseAndValidateRequestBody,
  readJsonResponseWithLimit,
  readRequestBodyWithLimit,
  sanitizeDatabaseError,
  validatePaystackResponse,
  validateServerConfig,
  type InitializedPaymentRpcResult,
  type RecordCheckoutSessionRpcResult,
} from "../../supabase/functions/paystack-checkout/core.ts";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const IDEMPOTENCY_KEY = "22222222-2222-4222-8222-222222222222";
const PAYMENT_ID = "33333333-3333-4333-8333-333333333333";
const SUBSCRIPTION_ID = "44444444-4444-4444-8444-444444444444";
const PROVIDER_PLAN_MAPPING_ID = "55555555-5555-4555-8555-555555555555";
const PROVIDER_REFERENCE =
  "PAY-20260820-A1B2C3D4E5F67890A1B2C3D4E5F67890";
const CHECKOUT_URL = "https://checkout.paystack.com/session_abc123";
const ACCESS_CODE = "access_code_123";
const AUTHORIZATION = "Bearer valid.jwt.token";
const ALLOWED_ORIGIN = "https://app.projectmatrix.co.za";
const CALLBACK_URL =
  "https://app.projectmatrix.co.za/billing/paystack/callback";
const PAYSTACK_SECRET_KEY = "sk_test_mock_secret_key_1234567890";

const VALID_ENV: Readonly<Record<string, string>> = {
  PAYSTACK_SECRET_KEY,
  PAYSTACK_ENVIRONMENT: "test",
  PAYSTACK_CALLBACK_URL: CALLBACK_URL,
  PAYSTACK_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
  SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_ANON_KEY: "mock-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key",
};

const BASE_PAYMENT: InitializedPaymentRpcResult = {
  payment_id: PAYMENT_ID,
  subscription_id: SUBSCRIPTION_ID,
  provider_plan_mapping_id: PROVIDER_PLAN_MAPPING_ID,
  provider_plan_code: "PLN_os65zcdsrs9yyes",
  provider: "paystack",
  environment: "test",
  purpose: "activation",
  provider_reference: PROVIDER_REFERENCE,
  amount_minor: 500_000,
  currency: "ZAR",
  customer_email: "finance@projectmatrix.co.za",
  payment_status: "initialized",
  checkout_url: null,
  is_reused: false,
  auto_renew_requested: false,
};

const BASE_RECORDED_SESSION: RecordCheckoutSessionRpcResult = {
  payment_id: PAYMENT_ID,
  provider_reference: PROVIDER_REFERENCE,
  payment_status: "pending",
  checkout_url: CHECKOUT_URL,
  is_reused: false,
};

interface MockRpcResponse {
  data: unknown;
  error: unknown;
}

interface UserClientOptions {
  payment?: InitializedPaymentRpcResult;
  initData?: unknown;
  initError?: unknown;
  authError?: unknown;
  user?: unknown | null;
  onGetUser?: (jwt: string) => void;
  onRpc?: (name: string, parameters: Readonly<Record<string, unknown>>) => void;
}

interface ServiceClientOptions {
  responses?: readonly MockRpcResponse[];
  onRpc?: (name: string, parameters: Readonly<Record<string, unknown>>) => void;
}

function payment(
  overrides: Partial<InitializedPaymentRpcResult> = {},
): InitializedPaymentRpcResult {
  return { ...BASE_PAYMENT, ...overrides };
}

function recordedSession(
  overrides: Partial<RecordCheckoutSessionRpcResult> = {},
): RecordCheckoutSessionRpcResult {
  return { ...BASE_RECORDED_SESSION, ...overrides };
}

function createUserClient(
  options: UserClientOptions = {},
): UserSupabaseClient {
  const user = options.user === undefined ? { id: "caller-id" } : options.user;
  const initData =
    options.initData === undefined
      ? [options.payment ?? payment()]
      : options.initData;

  return {
    auth: {
      getUser: async (jwt) => {
        options.onGetUser?.(jwt);
        return {
          data: { user: options.authError ? null : user },
          error: options.authError ?? null,
        };
      },
    },
    rpc: async (name, parameters) => {
      options.onRpc?.(name, parameters);
      return {
        data: options.initError ? null : initData,
        error: options.initError ?? null,
      };
    },
  };
}

function createServiceClient(
  options: ServiceClientOptions = {},
): ServiceSupabaseClient {
  const responses = options.responses ?? [
    { data: [recordedSession()], error: null },
  ];
  let index = 0;

  return {
    rpc: async (name, parameters) => {
      options.onRpc?.(name, parameters);
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return response ?? { data: null, error: { code: "XX000" } };
    },
  };
}

function createRequest(options: {
  method?: string;
  body?: string;
  authorization?: string | null;
  origin?: string | null;
  contentType?: string | null;
} = {}): Request {
  const method = options.method ?? "POST";
  const headers = new Headers();
  const authorization =
    options.authorization === undefined ? AUTHORIZATION : options.authorization;
  const origin = options.origin === undefined ? ALLOWED_ORIGIN : options.origin;
  const contentType =
    options.contentType === undefined ? "application/json" : options.contentType;

  if (authorization !== null) headers.set("Authorization", authorization);
  if (origin !== null) headers.set("Origin", origin);
  if (contentType !== null) headers.set("Content-Type", contentType);

  const body =
    method === "POST"
      ? options.body ?? JSON.stringify({
        company_id: COMPANY_ID,
        idempotency_key: IDEMPOTENCY_KEY,
      })
      : undefined;

  const requestInit: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) requestInit.body = body;

  return new Request(
    "https://functions.example.test/paystack-checkout",
    requestInit,
  );
}

function createPaystackFetch(options: {
  status?: number;
  body?: unknown;
  headers?: Readonly<Record<string, string>>;
  onRequest?: (input: string | URL | Request, init?: RequestInit) => void;
  verifyBody?: unknown;
  verifyStatus?: number;
} = {}): FetchFunction {
  return async (input, init) => {
    options.onRequest?.(input, init);
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    if (url.includes("/transaction/verify/")) {
      const body = options.verifyBody ?? options.body ?? {
        status: false,
        message: "Transaction reference not found",
      };
      return new Response(JSON.stringify(body), {
        status: options.verifyStatus ?? (options.verifyBody ? 200 : options.status ?? 404),
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    }

    const body = options.body ?? {
      status: true,
      message: "Authorization URL created",
      data: {
        authorization_url: CHECKOUT_URL,
        access_code: ACCESS_CODE,
        reference: PROVIDER_REFERENCE,
      },
    };

    return new Response(JSON.stringify(body), {
      status: options.status ?? 200,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  };
}

async function responseObject(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function nestedObject(
  object: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = object[key];
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function successDependencies(overrides: {
  userSupabase?: UserSupabaseClient;
  supabaseService?: ServiceSupabaseClient;
  paystackFetch?: FetchFunction;
} = {}) {
  return {
    env: VALID_ENV,
    userSupabase: overrides.userSupabase ?? createUserClient(),
    supabaseService: overrides.supabaseService ?? createServiceClient(),
    paystackFetch: overrides.paystackFetch ?? createPaystackFetch(),
    databaseRetryDelayMs: 0,
  } as const;
}

test("request contract accepts exactly the two canonical UUID fields", () => {
  const result = parseAndValidateRequestBody(
    JSON.stringify({ company_id: COMPANY_ID, idempotency_key: IDEMPOTENCY_KEY }),
    "application/json; charset=utf-8",
  );
  assert.deepEqual(result, {
    success: true,
    data: { company_id: COMPANY_ID, idempotency_key: IDEMPOTENCY_KEY },
  });
});

test("request contract rejects MIME-type spoofing and browser commercial fields", () => {
  const spoofed = parseAndValidateRequestBody(
    JSON.stringify({ company_id: COMPANY_ID, idempotency_key: IDEMPOTENCY_KEY }),
    "text/plain; profile=application/json",
  );
  assert.equal(spoofed.success, false);
  if (!spoofed.success) assert.equal(spoofed.status, 415);

  for (const forbidden of ["amount", "currency", "plan", "callback_url"]) {
    const result = parseAndValidateRequestBody(
      JSON.stringify({
        company_id: COMPANY_ID,
        idempotency_key: IDEMPOTENCY_KEY,
        [forbidden]: "attacker-controlled",
      }),
      "application/json",
    );
    assert.equal(result.success, false, forbidden);
  }
});

test("request contract rejects malformed, non-object, incomplete, and non-UUID bodies", () => {
  const bodies = [
    "{not-json",
    JSON.stringify([COMPANY_ID, IDEMPOTENCY_KEY]),
    JSON.stringify({ company_id: COMPANY_ID }),
    JSON.stringify({
      company_id: "not-a-uuid",
      idempotency_key: IDEMPOTENCY_KEY,
    }),
  ];
  for (const body of bodies) {
    const result = parseAndValidateRequestBody(body, "application/json");
    assert.equal(result.success, false, body);
    if (!result.success) assert.equal(result.status, 400);
  }
});

test("streaming body reader enforces the byte limit without trusting Content-Length", async () => {
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_REQUEST_BYTES));
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  const request = new Request("https://example.test", {
    method: "POST",
    body: oversized,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const result = await readRequestBodyWithLimit(request);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.status, 413);
});

test("configuration binds Paystack key prefix to environment", () => {
  assert.equal(validateServerConfig(VALID_ENV).success, true);
  assert.equal(
    validateServerConfig({
      ...VALID_ENV,
      PAYSTACK_ENVIRONMENT: "live",
      PAYSTACK_SECRET_KEY: "sk_test_wrong_environment",
    }).success,
    false,
  );
  assert.equal(
    validateServerConfig({
      ...VALID_ENV,
      PAYSTACK_ENVIRONMENT: "live",
      PAYSTACK_SECRET_KEY: "sk_live_valid_environment",
    }).success,
    true,
  );
});

test("configuration rejects callback credentials, fragments, and unsafe origins", () => {
  for (const callback of [
    "https://user:password@app.projectmatrix.co.za/callback",
    "https://app.projectmatrix.co.za/callback#secret",
    "http://app.projectmatrix.co.za/callback",
  ]) {
    assert.equal(
      validateServerConfig({ ...VALID_ENV, PAYSTACK_CALLBACK_URL: callback }).success,
      false,
      callback,
    );
  }

  assert.equal(
    validateServerConfig({
      ...VALID_ENV,
      PAYSTACK_ALLOWED_ORIGINS: "https://app.projectmatrix.co.za/path",
    }).success,
    false,
  );
});

test("configuration permits local HTTP only for SUPABASE_URL", () => {
  assert.equal(
    validateServerConfig({
      ...VALID_ENV,
      SUPABASE_URL: "http://127.0.0.1:54321",
    }).success,
    true,
  );
  assert.equal(
    validateServerConfig({
      ...VALID_ENV,
      SUPABASE_URL: "http://supabase.example.test",
    }).success,
    false,
  );
});

test("initialize RPC decoder enforces exactly one strict 14-column row", () => {
  assert.equal(decodeInitializedPaymentRpcResult([payment()]).success, true);
  assert.equal(decodeInitializedPaymentRpcResult([]).success, false);
  assert.equal(
    decodeInitializedPaymentRpcResult([payment(), payment()]).success,
    false,
  );
  assert.equal(decodeInitializedPaymentRpcResult(payment()).success, false);
  assert.equal(
    decodeInitializedPaymentRpcResult([
      { ...payment(), unexpected_column: "must fail" },
    ]).success,
    false,
  );
});

test("initialize RPC decoder requires the complete 32-hex provider reference", () => {
  const shortReference = payment({
    provider_reference: "PAY-20260820-A1B2C3D4E5F67890",
  });
  assert.equal(decodeInitializedPaymentRpcResult([shortReference]).success, false);
});

test("record-session decoder enforces exactly one strict five-column row", () => {
  assert.equal(
    decodeRecordCheckoutSessionRpcResult([recordedSession()]).success,
    true,
  );
  assert.equal(decodeRecordCheckoutSessionRpcResult([]).success, false);
  assert.equal(
    decodeRecordCheckoutSessionRpcResult([
      recordedSession(),
      recordedSession(),
    ]).success,
    false,
  );
});

test("Recurring Paystack payload contains only trusted snapshot data and safe metadata", () => {
  const payload = buildPaystackInitializePayload(
    payment({auto_renew_requested:true}),
    COMPANY_ID,
    CALLBACK_URL,
  );
  assert.deepEqual(Object.keys(payload).sort(), [
    "amount",
    "callback_url",
    "channels",
    "currency",
    "email",
    "metadata",
    "plan",
    "reference",
  ]);
  assert.equal(payload.amount, "500000");
  assert.equal(payload.currency, "ZAR");
  assert.deepEqual(JSON.parse(payload.metadata) as unknown, {
    payment_id: PAYMENT_ID,
    company_id: COMPANY_ID,
    subscription_id: SUBSCRIPTION_ID,
    purpose: "activation",
    environment: "test",
    auto_renew_requested: true,
  });
  assert.equal(payload.metadata.includes("finance@"), false);
  assert.equal(payload.metadata.includes(IDEMPOTENCY_KEY), false);
});

test("Paystack response accepts only exact checkout origin and matching reference", () => {
  const valid = validatePaystackResponse(
    {
      status: true,
      data: {
        authorization_url: CHECKOUT_URL,
        access_code: ACCESS_CODE,
        reference: PROVIDER_REFERENCE,
      },
    },
    PROVIDER_REFERENCE,
  );
  assert.equal(valid.success, true);

  for (const authorizationUrl of [
    "https://checkout.paystack.com.evil.test/access_code_123",
    "https://checkout.paystack.com/access code",
    "https://checkout.paystack.com/access_code_123#fragment",
  ]) {
    assert.equal(
      validatePaystackResponse(
        {
          status: true,
          data: {
            authorization_url: authorizationUrl,
            access_code: ACCESS_CODE,
            reference: PROVIDER_REFERENCE,
          },
        },
        PROVIDER_REFERENCE,
      ).success,
      false,
      authorizationUrl,
    );
  }
});

test("provider validation never returns a raw upstream rejection message", () => {
  const secretMessage = "DECLINED secret-provider-detail";
  const result = validatePaystackResponse(
    { status: false, message: secretMessage },
    PROVIDER_REFERENCE,
  );
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.includes(secretMessage), false);
});

test("provider response reader rejects oversized and malformed JSON bodies", async () => {
  const oversized = await readJsonResponseWithLimit(
    new Response(JSON.stringify({ value: "x".repeat(100) })),
    32,
  );
  assert.equal(oversized.success, false);

  const malformed = await readJsonResponseWithLimit(
    new Response("not-json", {
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(malformed.success, false);
});

test("database errors are sanitized and unknown errors are not retryable", () => {
  const rawMessage = "duplicate key contains private database identifiers";
  const conflict = sanitizeDatabaseError({ code: "23505", message: rawMessage });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.message.includes(rawMessage), false);
  assert.equal(isTransientDatabaseError({ message: "ordinary SQL failure" }), false);
  assert.equal(isTransientDatabaseError({ code: "40001" }), true);
  assert.equal(isTransientDatabaseError({ status: 503 }), true);
});

test("documented billing SQLSTATE values map to stable HTTP contracts", () => {
  const cases = [
    ["42501", 403, "BILLING_ACCESS_DENIED"],
    ["23505", 409, "BILLING_CHECKOUT_CONFLICT"],
    ["23514", 409, "BILLING_SUBSCRIPTION_INELIGIBLE"],
    ["P0002", 404, "BILLING_CONFIGURATION_NOT_FOUND"],
    ["22000", 400, "BILLING_CHECKOUT_INVALID"],
  ] as const;
  for (const [code, status, errorCode] of cases) {
    const result = sanitizeDatabaseError({ code, message: "private detail" });
    assert.equal(result.status, status, code);
    assert.equal(result.errorCode, errorCode, code);
    assert.equal(result.message.includes("private detail"), false, code);
  }
});

test("allowed CORS preflight returns 204 with no-store headers", async () => {
  const response = await handlePaystackCheckoutRequest(
    createRequest({ method: "OPTIONS", authorization: null, contentType: null }),
    { env: VALID_ENV },
  );
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("disallowed browser origin is denied without reflecting it", async () => {
  const response = await handlePaystackCheckoutRequest(
    createRequest({ origin: "https://attacker.example" }),
    { env: VALID_ENV },
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("unsupported methods return 405 and an Allow header", async () => {
  const response = await handlePaystackCheckoutRequest(
    createRequest({ method: "GET", authorization: null, contentType: null }),
    { env: VALID_ENV },
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST, OPTIONS");
});

test("missing and malformed bearer credentials are rejected", async () => {
  for (const authorization of [null, "Basic abc", "Bearer token with spaces"]) {
    const response = await handlePaystackCheckoutRequest(
      createRequest({ authorization }),
      { env: VALID_ENV },
    );
    assert.equal(response.status, 401, String(authorization));
  }
});

test("invalid server configuration returns only a generic 500 response", async () => {
  const response = await handlePaystackCheckoutRequest(createRequest(), {
    env: { ...VALID_ENV, PAYSTACK_SECRET_KEY: "wrong-key" },
  });
  assert.equal(response.status, 500);
  const body = await responseObject(response);
  assert.equal(body.error_code, "PAYSTACK_CONFIGURATION_INVALID");
  assert.equal(JSON.stringify(body).includes("wrong-key"), false);
});

test("auth.getUser receives the exact bearer token", async () => {
  let observedToken = "";
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        onGetUser: (jwt) => {
          observedToken = jwt;
        },
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(observedToken, "valid.jwt.token");
});

test("invalid authenticated user is rejected before either RPC", async () => {
  let rpcCalls = 0;
  const response = await handlePaystackCheckoutRequest(createRequest(), {
    env: VALID_ENV,
    userSupabase: createUserClient({
      authError: { message: "invalid token" },
      onRpc: () => {
        rpcCalls += 1;
      },
    }),
  });
  assert.equal(response.status, 401);
  assert.equal(rpcCalls, 0);
});

test("thrown authentication transport failure becomes a sanitized 503", async () => {
  const userSupabase: UserSupabaseClient = {
    auth: {
      getUser: async () => {
        throw new TypeError("fetch failed: private-auth-host");
      },
    },
    rpc: async () => ({ data: null, error: null }),
  };
  const response = await handlePaystackCheckoutRequest(createRequest(), {
    env: VALID_ENV,
    userSupabase,
  });
  assert.equal(response.status, 503);
  const body = await responseObject(response);
  assert.equal(body.error_code, "AUTHENTICATION_SERVICE_UNAVAILABLE");
  assert.equal(JSON.stringify(body).includes("private-auth-host"), false);
});

test("caller-scoped initialization RPC receives workspace, idempotency and explicit checkout preferences", async () => {
  let observedName = "";
  let observedParameters: Readonly<Record<string, unknown>> = {};
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        onRpc: (name, parameters) => {
          observedName = name;
          observedParameters = parameters;
        },
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(observedName, "initialize_billing_checkout");
  assert.deepEqual(observedParameters, {
    p_company_id: COMPANY_ID,
    p_idempotency_key: IDEMPOTENCY_KEY,
    p_environment: "test", p_auto_renew: false, p_lookup_only: false,
  });
});

test("database authorization failure is sanitized", async () => {
  const rawMessage = "permission denied for private_table.internal_column";
  const response = await handlePaystackCheckoutRequest(createRequest(), {
    env: VALID_ENV,
    userSupabase: createUserClient({
      initError: { code: "42501", message: rawMessage },
    }),
  });
  assert.equal(response.status, 403);
  assert.equal(JSON.stringify(await responseObject(response)).includes(rawMessage), false);
});

test("thrown initialization RPC transport failure becomes a sanitized 503", async () => {
  const userSupabase: UserSupabaseClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: "caller-id" } }, error: null }),
    },
    rpc: async () => {
      throw new TypeError("fetch failed: private-database-host");
    },
  };
  const response = await handlePaystackCheckoutRequest(createRequest(), {
    env: VALID_ENV,
    userSupabase,
  });
  assert.equal(response.status, 503);
  const body = await responseObject(response);
  assert.equal(body.error_code, "BILLING_DATABASE_TEMPORARY_FAILURE");
  assert.equal(JSON.stringify(body).includes("private-database-host"), false);
});

test("pending sessions are reused without contacting Paystack", async () => {
  let providerCalls = 0;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({
          payment_status: "pending",
          checkout_url: CHECKOUT_URL,
          is_reused: true,
        }),
      }),
      paystackFetch: createPaystackFetch({
        onRequest: () => {
          providerCalls += 1;
        },
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 0);
  const data = nestedObject(await responseObject(response), "data");
  assert.equal(data.checkout_url, CHECKOUT_URL);
  assert.equal(data.is_reused, true);
});

test("pending session without a valid stored URL fails its integrity check", async () => {
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({
          payment_status: "pending",
          checkout_url: null,
          is_reused: true,
        }),
      }),
    }),
  );
  assert.equal(response.status, 500);
  assert.equal(
    (await responseObject(response)).error_code,
    "PAYSTACK_SESSION_INTEGRITY_FAILURE",
  );
});

test("succeeded sessions return no checkout URL and do not contact Paystack", async () => {
  let providerCalls = 0;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ payment_status: "succeeded", is_reused: true }),
      }),
      paystackFetch: createPaystackFetch({
        onRequest: () => {
          providerCalls += 1;
        },
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 0);
  assert.equal(nestedObject(await responseObject(response), "data").checkout_url, null);
});

test("terminal failed and cancelled payments are rejected", async () => {
  for (const status of ["failed", "cancelled"] as const) {
    const response = await handlePaystackCheckoutRequest(
      createRequest(),
      successDependencies({
        userSupabase: createUserClient({
          payment: payment({ payment_status: status, is_reused: true }),
        }),
      }),
    );
    assert.equal(response.status, 409, status);
  }
});

test("reused initialized attempt reconciles safely without making a duplicate initialize call", async () => {
  let initializeCalls = 0;
  let verifyCalls = 0;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ is_reused: true }),
      }),
      paystackFetch: createPaystackFetch({
        onRequest: (input) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
              ? input.toString()
              : input.url;
          if (url.includes("/transaction/initialize")) {
            initializeCalls += 1;
          } else if (url.includes("/transaction/verify/")) {
            verifyCalls += 1;
          }
        },
      }),
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(initializeCalls, 0);
  assert.equal(verifyCalls, 1);
  assert.equal(
    (await responseObject(response)).error_code,
    "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
  );
});

test("database and server Paystack environments must match", async () => {
  let providerCalls = 0;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ environment: "live" }),
      }),
      paystackFetch: createPaystackFetch({
        onRequest: () => {
          providerCalls += 1;
        },
      }),
    }),
  );
  assert.equal(response.status, 500);
  assert.equal(providerCalls, 0);
});

test("successful checkout makes one backend provider call and atomically records it", async () => {
  let providerCalls = 0;
  let providerUrl = "";
  let providerInit: RequestInit | undefined;
  let serviceName = "";
  let serviceParameters: Readonly<Record<string, unknown>> = {};

  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      paystackFetch: createPaystackFetch({
        onRequest: (input, init) => {
          providerCalls += 1;
          providerUrl = String(input);
          providerInit = init;
        },
      }),
      supabaseService: createServiceClient({
        onRpc: (name, parameters) => {
          serviceName = name;
          serviceParameters = parameters;
        },
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(providerCalls, 1);
  assert.equal(providerUrl, PAYSTACK_INITIALIZE_URL);
  assert.equal(providerInit?.method, "POST");
  assert.equal(providerInit?.redirect, "error");

  const providerBody = JSON.parse(String(providerInit?.body)) as Record<
    string,
    unknown
  >;
  assert.equal(providerBody.amount, "500000");
  assert.equal(providerBody.reference, PROVIDER_REFERENCE);
  assert.equal(providerBody.plan, undefined, "Auto-renew opt-out does not create a recurring plan");
  assert.equal(Object.hasOwn(providerBody, "company_id"), false);
  assert.equal(Object.hasOwn(providerBody, "idempotency_key"), false);

  assert.equal(serviceName, "record_paystack_checkout_session");
  assert.deepEqual(serviceParameters, {
    p_payment_id: PAYMENT_ID,
    p_provider_reference: PROVIDER_REFERENCE,
    p_checkout_url: CHECKOUT_URL,
    p_access_code: ACCESS_CODE,
  });

  const responseBody = await responseObject(response);
  const responseData = nestedObject(responseBody, "data");
  assert.deepEqual(Object.keys(responseData).sort(), [
    "checkout_url",
    "is_reused",
    "payment_id",
    "payment_status",
    "provider_reference",
  ]);
  const serialized = JSON.stringify(responseBody);
  assert.equal(Object.hasOwn(responseData, "access_code"), false);
  assert.equal(serialized.includes(ACCESS_CODE), false);
  assert.equal(serialized.includes("finance@projectmatrix.co.za"), false);
  assert.equal(serialized.includes(IDEMPOTENCY_KEY), false);
  assert.equal(serialized.includes(PAYSTACK_SECRET_KEY), false);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("provider timeout returns a retry-safe, zero-leak 502", async () => {
  let serviceCalls = 0;
  const timeoutFetch: FetchFunction = (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const rejectAsAborted = () => reject(new DOMException("Aborted", "AbortError"));
      if (init?.signal?.aborted) {
        rejectAsAborted();
      } else {
        init?.signal?.addEventListener("abort", rejectAsAborted, { once: true });
      }
    });

  const response = await handlePaystackCheckoutRequest(createRequest(), {
    ...successDependencies({
      paystackFetch: timeoutFetch,
      supabaseService: createServiceClient({
        onRpc: () => {
          serviceCalls += 1;
        },
      }),
    }),
    requestTimeoutMs: 5,
  });
  assert.equal(response.status, 502);
  assert.equal(serviceCalls, 0);
  assert.equal(
    (await responseObject(response)).error_code,
    "PAYSTACK_INITIALIZATION_OUTCOME_UNKNOWN",
  );
});

test("raw provider rejection details never reach the browser", async () => {
  const rawMessage = "declined: private-provider-trace-123";
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      paystackFetch: createPaystackFetch({
        status: 400,
        body: { status: false, message: rawMessage },
      }),
    }),
  );
  assert.equal(response.status, 502);
  assert.equal(JSON.stringify(await responseObject(response)).includes(rawMessage), false);
});

test("provider 5xx response is treated as an indeterminate outcome", async () => {
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      paystackFetch: createPaystackFetch({
        status: 503,
        body: "not-json-and-must-not-be-reflected",
      }),
    }),
  );
  assert.equal(response.status, 502);
  const body = await responseObject(response);
  assert.equal(body.error_code, "PAYSTACK_INITIALIZATION_OUTCOME_UNKNOWN");
  assert.equal(JSON.stringify(body).includes("not-json"), false);
});

test("duplicate provider reference becomes a reconciliation conflict", async () => {
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      paystackFetch: createPaystackFetch({
        status: 400,
        body: { status: false, message: "Duplicate transaction reference" },
      }),
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(
    (await responseObject(response)).error_code,
    "PAYSTACK_REFERENCE_RECOVERY_REQUIRED",
  );
});

test("rate-limit response forwards only a strictly numeric Retry-After value", async () => {
  const safe = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      paystackFetch: createPaystackFetch({
        status: 429,
        headers: { "Retry-After": "60" },
        body: { status: false, message: "rate limited" },
      }),
    }),
  );
  assert.equal(safe.status, 429);
  assert.equal(safe.headers.get("retry-after"), "60");

  const unsafe = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      paystackFetch: createPaystackFetch({
        status: 429,
        headers: { "Retry-After": "not-a-delay" },
        body: { status: false, message: "rate limited" },
      }),
    }),
  );
  assert.equal(unsafe.headers.get("retry-after"), null);
});

test("malformed successful provider response is rejected before recording", async () => {
  let serviceCalls = 0;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      paystackFetch: createPaystackFetch({
        body: {
          status: true,
          data: {
            authorization_url: "https://checkout.paystack.com.evil.test/x",
            access_code: ACCESS_CODE,
            reference: PROVIDER_REFERENCE,
          },
        },
      }),
      supabaseService: createServiceClient({
        onRpc: () => {
          serviceCalls += 1;
        },
      }),
    }),
  );
  assert.equal(response.status, 502);
  assert.equal(serviceCalls, 0);
});

test("mismatched reference and unsafe access code are rejected before recording", async () => {
  const invalidData = [
    {
      authorization_url: CHECKOUT_URL,
      access_code: ACCESS_CODE,
      reference: "PAY-20260820-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    },
    {
      authorization_url: CHECKOUT_URL,
      access_code: "access code with spaces",
      reference: PROVIDER_REFERENCE,
    },
  ];
  for (const data of invalidData) {
    let serviceCalls = 0;
    const response = await handlePaystackCheckoutRequest(
      createRequest(),
      successDependencies({
        paystackFetch: createPaystackFetch({ body: { status: true, data } }),
        supabaseService: createServiceClient({
          onRpc: () => {
            serviceCalls += 1;
          },
        }),
      }),
    );
    assert.equal(response.status, 502);
    assert.equal(serviceCalls, 0);
  }
});

test("record-session RPC retries one transient error only", async () => {
  let serviceCalls = 0;
  const service = createServiceClient({
    responses: [
      { data: null, error: { code: "40001" } },
      { data: [recordedSession()], error: null },
    ],
    onRpc: () => {
      serviceCalls += 1;
    },
  });
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({ supabaseService: service }),
  );
  assert.equal(response.status, 200);
  assert.equal(serviceCalls, 2);
});

test("record-session RPC retries one thrown transport failure", async () => {
  let serviceCalls = 0;
  const service: ServiceSupabaseClient = {
    rpc: async () => {
      serviceCalls += 1;
      if (serviceCalls === 1) {
        throw new TypeError("fetch failed: private-service-host");
      }
      return { data: [recordedSession()], error: null };
    },
  };
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({ supabaseService: service }),
  );
  assert.equal(response.status, 200);
  assert.equal(serviceCalls, 2);
});

test("record-session RPC does not retry deterministic errors or leak checkout data", async () => {
  let serviceCalls = 0;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      supabaseService: createServiceClient({
        responses: [
          {
            data: null,
            error: {
              code: "23505",
              message: `conflict ${CHECKOUT_URL} ${ACCESS_CODE}`,
            },
          },
        ],
        onRpc: () => {
          serviceCalls += 1;
        },
      }),
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(serviceCalls, 1);
  const responseBody = await responseObject(response);
  assert.equal(responseBody.error_code, "PAYSTACK_SESSION_CONFLICT");
  const serialized = JSON.stringify(responseBody);
  assert.equal(serialized.includes(CHECKOUT_URL), false);
  assert.equal(serialized.includes(ACCESS_CODE), false);
});

test("initialize and record RPC cardinality violations fail closed", async () => {
  const badInitialize = await handlePaystackCheckoutRequest(createRequest(), {
    env: VALID_ENV,
    userSupabase: createUserClient({ initData: [payment(), payment()] }),
  });
  assert.equal(badInitialize.status, 500);

  const badRecord = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      supabaseService: createServiceClient({
        responses: [
          { data: [recordedSession(), recordedSession()], error: null },
        ],
      }),
    }),
  );
  assert.equal(badRecord.status, 500);
});

test("Supabase function configuration keeps JWT verification enabled", () => {
  const configPath = resolve(process.cwd(), "supabase/config.toml");
  const config = readFileSync(configPath, "utf8");
  const escapedName = "paystack-checkout".replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockMatch = new RegExp(
    `^\\[functions\\.${escapedName}\\]\\s*$([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`,
    "m",
  ).exec(config);
  assert.ok(blockMatch, "Missing [functions.paystack-checkout] block");
  assert.match(blockMatch[1] ?? "", /^\s*verify_jwt\s*=\s*true\s*$/m);
  assert.doesNotMatch(blockMatch[1] ?? "", /^\s*verify_jwt\s*=\s*false\s*$/m);
});

test("reused initialized attempt recovers completed payment without creating another payment", async () => {
  let initializeCalls = 0;
  let verifyCalls = 0;
  let chargeRpcCalled = false;

  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ is_reused: true }),
      }),
      supabaseService: createServiceClient({
        onRpc: (name, parameters) => {
          if (name === "process_paystack_charge_success") {
            chargeRpcCalled = true;
            assert.equal(
              (parameters as Record<string, unknown>).p_provider_reference,
              PROVIDER_REFERENCE,
            );
          }
        },
        responses: [{ data: [{ payment_id: PAYMENT_ID, subscription_id: SUBSCRIPTION_ID, payment_status: "succeeded", processing_status: "processed" }], error: null }],
      }),
      paystackFetch: createPaystackFetch({
        onRequest: (input) => {
          const url = String(input);
          if (url.includes("/transaction/initialize")) initializeCalls += 1;
          if (url.includes("/transaction/verify/")) verifyCalls += 1;
        },
        verifyBody: {
          status: true,
          message: "Verification successful",
          data: {
            id: 998877,
            domain: "test",
            status: "success",
            reference: PROVIDER_REFERENCE,
            amount: 500000,
            currency: "ZAR",
            paid_at: "2026-04-16T12:00:00.000Z",
            customer: {
              id: 111,
              email: "finance@projectmatrix.co.za",
              customer_code: "CUS_rec123",
            },
            plan: null,
            authorization: {
              authorization_code: "AUTH_recovered123",
              card_type: "mastercard",
              last4: "5555",
              exp_month: "11",
              exp_year: "2029",
              bank: "Recovery Bank",
              channel: "card",
              reusable: true,
            },
          },
        },
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(initializeCalls, 0);
  assert.equal(verifyCalls, 1);
  assert.equal(chargeRpcCalled, true);
  const body = await responseObject(response);
  assert.equal(body.ok, true);
  const data = nestedObject(body, "data");
  assert.equal(data.payment_id, PAYMENT_ID);
  assert.equal(data.payment_status, "succeeded");
  assert.equal(data.checkout_url, null);
  assert.equal(data.is_reused, true);
});

test("reused initialized attempt recovers terminal failure and updates ledger", async () => {
  let reconcileRpcCalled = false;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ is_reused: true }),
      }),
      supabaseService: createServiceClient({
        responses: [{data:[{payment_id: PAYMENT_ID,provider_reference: PROVIDER_REFERENCE,payment_status:"failed",is_resolved:true}],error:null}],
        onRpc: (name, parameters) => {
          if (name === "reconcile_paystack_checkout_initialization") {
            reconcileRpcCalled = true;
            assert.equal(
              (parameters as Record<string, unknown>).p_target_status,
              "failed",
            );
          }
        },
      }),
      paystackFetch: createPaystackFetch({
        verifyBody: {
          status: true,
          message: "Verification successful",
          data: {
            id: 998877,
            domain: "test",
            status: "failed",
            reference: PROVIDER_REFERENCE,
            amount: 500000,
            currency: "ZAR",
            gateway_response: "Insufficient funds",
          },
        },
      }),
    }),
  );

  assert.equal(response.status, 409);
  assert.equal(reconcileRpcCalled, true);
  const body = await responseObject(response);
  assert.equal(body.error_code, "PAYMENT_ATTEMPT_TERMINAL");
});

test("reused initialized attempt keeps pending status when transaction is ongoing", async () => {
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ is_reused: true }),
      }),
      paystackFetch: createPaystackFetch({
        verifyBody: {
          status: true,
          message: "Verification successful",
          data: {
            id: 998877,
            domain: "test",
            status: "ongoing",
            reference: PROVIDER_REFERENCE,
            amount: 500000,
            currency: "ZAR",
          },
        },
      }),
    }),
  );

  assert.equal(response.status, 409);
  const body = await responseObject(response);
  assert.equal(body.error_code, "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED");
});

test("reused initialized attempt rejects commercial snapshot mismatch during verification", async () => {
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ is_reused: true }),
      }),
      paystackFetch: createPaystackFetch({
        verifyBody: {
          status: true,
          message: "Verification successful",
          data: {
            id: 998877,
            domain: "test",
            status: "success",
            reference: PROVIDER_REFERENCE,
            amount: 999999, // Mismatched amount!
            currency: "NGN",
          },
        },
      }),
    }),
  );

  assert.equal(response.status, 502);
  const body = await responseObject(response);
  assert.equal(body.error_code, "PAYSTACK_COMMERCIAL_MISMATCH");
});

test("reused initialized attempt keeps pending/recovery-required on lookup miss before and after 15 minutes without marking terminal", async () => {
  let reconcileRpcCalled = false;

  // Test 1: Immediate lookup miss (before 15 min)
  const immediateResponse = await handlePaystackCheckoutRequest(
    createRequest(),
    {
      ...successDependencies({
        userSupabase: createUserClient({
          payment: payment({ is_reused: true }),
        }),
        supabaseService: createServiceClient({
          onRpc: (name) => {
            if (name === "reconcile_paystack_checkout_initialization") {
              reconcileRpcCalled = true;
            }
          },
        }),
        paystackFetch: createPaystackFetch({
          verifyStatus: 404,
          verifyBody: { status: false, message: "Transaction reference not found" },
        }),
      }),
    },
  );

  assert.equal(immediateResponse.status, 409);
  assert.equal(reconcileRpcCalled, false);
  const immediateBody = await responseObject(immediateResponse);
  assert.equal(
    immediateBody.error_code,
    "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
  );

  // Test 2: Delayed lookup miss (after 15 min) - must STILL NOT mark terminal failed!
  const delayedResponse = await handlePaystackCheckoutRequest(
    createRequest(),
    {
      ...successDependencies({
        userSupabase: createUserClient({
          payment: payment({ is_reused: true }),
        }),
        supabaseService: createServiceClient({
          onRpc: (name) => {
            if (name === "reconcile_paystack_checkout_initialization") {
              reconcileRpcCalled = true;
            }
          },
        }),
        paystackFetch: createPaystackFetch({
          verifyStatus: 404,
          verifyBody: { status: false, message: "Transaction reference not found" },
        }),
      }),
    },
  );

  assert.equal(delayedResponse.status, 409);
  assert.equal(reconcileRpcCalled, false);
  const delayedBody = await responseObject(delayedResponse);
  assert.equal(
    delayedBody.error_code,
    "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
  );
});

test("delayed verification success completes original attempt after earlier lookup misses", async () => {
  let chargeSuccessRpcCalled = false;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ is_reused: true, payment_status: "initialized" }),
      }),
      supabaseService: createServiceClient({
        responses: [{data:[{payment_id:PAYMENT_ID,subscription_id:SUBSCRIPTION_ID,payment_status:"succeeded",processing_status:"processed"}],error:null}],
        onRpc: (name) => {
          if (name === "process_paystack_charge_success") {
            chargeSuccessRpcCalled = true;
          }
        },
      }),
      paystackFetch: createPaystackFetch({
        verifyBody: {
          status: true,
          message: "Verification successful",
          data: {
            id: 998877,
            domain: "test",
            status: "success",
            reference: PROVIDER_REFERENCE,
            amount: 500000,
            currency: "ZAR",
            paid_at: "2026-09-10T08:00:00.000Z",
            customer: {email: "finance@projectmatrix.co.za"},
          },
        },
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(chargeSuccessRpcCalled, true);
  const body = await responseObject(response);
  assert.equal(body.ok, true);
  assert.equal((body.data as Record<string, unknown>).payment_status, "succeeded");
  assert.equal((body.data as Record<string, unknown>).is_reused, true);
});

test("reused initialized attempt explicitly classifies all documented Paystack verification statuses", async () => {
  const nonTerminalStatuses = ["abandoned", "pending", "processing", "queued"];

  for (const status of nonTerminalStatuses) {
    let reconcileRpcCalled = false;
    const response = await handlePaystackCheckoutRequest(
      createRequest(),
      successDependencies({
        userSupabase: createUserClient({
          payment: payment({ is_reused: true }),
        }),
        supabaseService: createServiceClient({
          onRpc: () => {
            reconcileRpcCalled = true;
          },
        }),
        paystackFetch: createPaystackFetch({
          verifyBody: {
            status: true,
            message: "Verification successful",
            data: {
              id: 998877,
              domain: "test",
              status,
              reference: PROVIDER_REFERENCE,
              amount: 500000,
              currency: "ZAR",
            },
          },
        }),
      }),
    );

    assert.equal(response.status, 409, `status ${status} should return 409`);
    assert.equal(reconcileRpcCalled, false, `status ${status} should not call reconcile RPC`);
    const body = await responseObject(response);
    assert.equal(
      body.error_code,
      "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
      `status ${status} must map to PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED`,
    );
  }
});

test("reused initialized attempt blocks reversed status without recording ordinary failure", async () => {
  let reconcileRpcCalled = false;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ is_reused: true }),
      }),
      supabaseService: createServiceClient({
        onRpc: () => {
          reconcileRpcCalled = true;
        },
      }),
      paystackFetch: createPaystackFetch({
        verifyBody: {
          status: true,
          message: "Verification successful",
          data: {
            id: 998877,
            domain: "test",
            status: "reversed",
            reference: PROVIDER_REFERENCE,
            amount: 500000,
            currency: "ZAR",
          },
        },
      }),
    }),
  );

  assert.equal(response.status, 409);
  assert.equal(reconcileRpcCalled, false); // Must NOT record ordinary payment failure
  const body = await responseObject(response);
  assert.equal(body.error_code, "PAYSTACK_REVERSAL_LIFECYCLE_UNSUPPORTED");
});

test("reused initialized attempt rejects unknown or malformed status with 502", async () => {
  let reconcileRpcCalled = false;
  const response = await handlePaystackCheckoutRequest(
    createRequest(),
    successDependencies({
      userSupabase: createUserClient({
        payment: payment({ is_reused: true }),
      }),
      supabaseService: createServiceClient({
        onRpc: () => {
          reconcileRpcCalled = true;
        },
      }),
      paystackFetch: createPaystackFetch({
        verifyBody: {
          status: true,
          message: "Verification successful",
          data: {
            id: 998877,
            domain: "test",
            status: "unexpected_future_status",
            reference: PROVIDER_REFERENCE,
            amount: 500000,
            currency: "ZAR",
          },
        },
      }),
    }),
  );

  assert.equal(response.status, 502);
  assert.equal(reconcileRpcCalled, false);
  const body = await responseObject(response);
  assert.equal(body.error_code, "PAYSTACK_RECOVERY_VERIFICATION_INVALID");
});