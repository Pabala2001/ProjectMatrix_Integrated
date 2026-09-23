import { createClient } from "@supabase/supabase-js";
import {
  DATABASE_RETRY_DELAY_MS,
  PAYSTACK_INITIALIZE_URL,
  PAYSTACK_REQUEST_TIMEOUT_MS,
  PAYSTACK_VERIFY_URL_PREFIX,
  buildPaystackInitializePayload,
  calculateSha256Hex,
  decodeInitializedPaymentRpcResult,
  decodePaystackSubscriptionFetchData,
  decodePaystackVerifyRecoveryData,
  decodeRecordCheckoutSessionRpcResult,
  delay,
  extractProviderSubscriptionCode,
  getCorsHeaders,
  getErrorField,
  isDuplicateReferenceResponse,
  isOriginAllowed,
  isPlainObject,
  isProviderReconciliationRequiredError,
  isReferenceNotFoundResponse,
  isTransientDatabaseError,
  parseAndValidateRequestBody,
  readJsonResponseWithLimit,
  readRequestBodyWithLimit,
  sanitizeDatabaseError,
  sanitizeRecordSessionDatabaseError,
  validatePaystackResponse,
  validateServerConfig,
  type InitializedPaymentRpcResult,
  type PaystackCheckoutErrorResponse,
  type PaystackCheckoutSuccessResponse,
  type ServerConfig,
} from "./core.ts";

type RpcParameters = Readonly<Record<string, unknown>>;

interface RpcResponse {
  data: unknown;
  error: unknown;
}

interface UserVerificationResponse {
  data: { user: unknown | null } | null;
  error: unknown;
}

export interface UserSupabaseClient {
  auth: {
    getUser(jwt: string): Promise<UserVerificationResponse>;
  };
  rpc(functionName: string, parameters: RpcParameters): Promise<RpcResponse>;
}

export interface ServiceSupabaseClient {
  rpc(functionName: string, parameters: RpcParameters): Promise<RpcResponse>;
}

export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface HandlePaystackCheckoutOptions {
  userSupabase?: UserSupabaseClient;
  supabaseService?: ServiceSupabaseClient;
  paystackFetch?: FetchFunction;
  env?: Readonly<Record<string, string | undefined>>;
  requestTimeoutMs?: number;
  databaseRetryDelayMs?: number;
  retryDelayMs?: number;
}

interface DenoRuntime {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
}

function getDenoRuntime(): DenoRuntime | undefined {
  return (globalThis as unknown as { Deno?: DenoRuntime }).Deno;
}

function getEnvironmentVariables(): Record<string, string | undefined> {
  const runtime = getDenoRuntime();
  if (!runtime) return {};

  return {
    PAYSTACK_SECRET_KEY: runtime.env.get("PAYSTACK_SECRET_KEY"),
    PAYSTACK_ENVIRONMENT: runtime.env.get("PAYSTACK_ENVIRONMENT"),
    PAYSTACK_CALLBACK_URL: runtime.env.get("PAYSTACK_CALLBACK_URL"),
    PAYSTACK_ALLOWED_ORIGINS: runtime.env.get("PAYSTACK_ALLOWED_ORIGINS"),
    SUPABASE_URL: runtime.env.get("SUPABASE_URL"),
    SUPABASE_ANON_KEY: runtime.env.get("SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: runtime.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function createUserSupabaseClient(
  config: ServerConfig,
  authorizationHeader: string,
): UserSupabaseClient {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: { Authorization: authorizationHeader },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    auth: {
      getUser: async (jwt) => {
        const result = await client.auth.getUser(jwt);
        return {
          data: { user: result.data.user },
          error: result.error,
        };
      },
    },
    rpc: async (functionName, parameters) => {
      const result = await client.rpc(functionName, parameters);
      return { data: result.data, error: result.error };
    },
  };
}

function createServiceSupabaseClient(
  config: ServerConfig,
): ServiceSupabaseClient {
  const client = createClient(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return {
    rpc: async (functionName, parameters) => {
      const result = await client.rpc(functionName, parameters);
      return { data: result.data, error: result.error };
    },
  };
}

function responseHeaders(corsHeaders: Readonly<Record<string, string>>): Headers {
  return new Headers({
    ...corsHeaders,
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Type": "application/json; charset=utf-8",
  });
}

function jsonResponse(
  body: PaystackCheckoutSuccessResponse | PaystackCheckoutErrorResponse,
  status: number,
  corsHeaders: Readonly<Record<string, string>>,
  additionalHeaders?: Readonly<Record<string, string>>,
): Response {
  const headers = responseHeaders(corsHeaders);
  for (const [name, value] of Object.entries(additionalHeaders ?? {})) {
    headers.set(name, value);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(
  status: number,
  error: string,
  errorCode: string,
  corsHeaders: Readonly<Record<string, string>>,
  additionalHeaders?: Readonly<Record<string, string>>,
): Response {
  return jsonResponse(
    { ok: false, error, error_code: errorCode },
    status,
    corsHeaders,
    additionalHeaders,
  );
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  const token = match?.[1] ?? null;
  return token && token.length <= 8_192 ? token : null;
}

function createAbortSignal(timeoutMs: number): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeoutId),
  };
}

export async function handlePaystackCheckoutRequest(
  request: Request,
  injectedDependencies: HandlePaystackCheckoutOptions = {},
): Promise<Response> {
  const env = injectedDependencies.env ?? getEnvironmentVariables();
  const configResult = validateServerConfig(env);

  if ("error" in configResult) {
    return errorResponse(
      500,
      "Payment checkout is not configured correctly.",
      "PAYSTACK_CONFIGURATION_INVALID",
      {},
    );
  }

  const config = configResult.data;
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin, config.allowedOrigins);

  if (!isOriginAllowed(origin, config.allowedOrigins)) {
    return errorResponse(
      403,
      "Request origin is not permitted.",
      "CORS_ORIGIN_DENIED",
      corsHeaders,
    );
  }

  if (request.method === "OPTIONS") {
    const headers = new Headers({
      ...corsHeaders,
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return errorResponse(
      405,
      "Method not allowed.",
      "METHOD_NOT_ALLOWED",
      corsHeaders,
      { Allow: "POST, OPTIONS" },
    );
  }

  const authorizationHeader = request.headers.get("authorization");
  const token = extractBearerToken(authorizationHeader);
  if (!token || !authorizationHeader) {
    return errorResponse(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
      corsHeaders,
    );
  }

  const bodyResult = await readRequestBodyWithLimit(request);
  if ("error" in bodyResult) {
    return errorResponse(
      bodyResult.status,
      bodyResult.error,
      bodyResult.status === 413 ? "REQUEST_TOO_LARGE" : "REQUEST_BODY_INVALID",
      corsHeaders,
    );
  }

  const requestResult = parseAndValidateRequestBody(
    bodyResult.data,
    request.headers.get("content-type"),
  );
  if ("error" in requestResult) {
    return errorResponse(
      requestResult.status,
      requestResult.error,
      "REQUEST_CONTRACT_INVALID",
      corsHeaders,
    );
  }

  const { company_id, idempotency_key, auto_renew = false, action = "checkout" } = requestResult.data;
  const userSupabase =
    injectedDependencies.userSupabase ??
    createUserSupabaseClient(config, authorizationHeader);

  let userResult: UserVerificationResponse;
  try {
    userResult = await userSupabase.auth.getUser(token);
  } catch {
    return errorResponse(
      503,
      "Authentication is temporarily unavailable.",
      "AUTHENTICATION_SERVICE_UNAVAILABLE",
      corsHeaders,
    );
  }

  if (userResult.error) {
    if (isTransientDatabaseError(userResult.error)) {
      return errorResponse(
        503,
        "Authentication is temporarily unavailable.",
        "AUTHENTICATION_SERVICE_UNAVAILABLE",
        corsHeaders,
      );
    }

    return errorResponse(
      401,
      "Invalid or expired authentication token.",
      "AUTHENTICATION_INVALID",
      corsHeaders,
    );
  }

  if (!userResult.data?.user) {
    return errorResponse(
      401,
      "Invalid or expired authentication token.",
      "AUTHENTICATION_INVALID",
      corsHeaders,
    );
  }

  const supabaseService =
    injectedDependencies.supabaseService ??
    createServiceSupabaseClient(config);
  const paystackFetch = injectedDependencies.paystackFetch ?? fetch;
  const requestTimeoutMs =
    injectedDependencies.requestTimeoutMs ?? PAYSTACK_REQUEST_TIMEOUT_MS;

  let initializationResult: RpcResponse;
  try {
    initializationResult = await userSupabase.rpc(
      "initialize_billing_checkout",
      {
        p_company_id: company_id,
        p_idempotency_key: idempotency_key,
        p_environment: config.paystackEnvironment,
        p_auto_renew: auto_renew,
        p_lookup_only: action === "status",
      },
    );
  } catch (error) {
    if (action === "checkout" && isProviderReconciliationRequiredError(error)) {
      const reconOutcome = await reconcileProviderSubscriptionBeforeCheckout(
        company_id,
        idempotency_key,
        getErrorField(error, "message"),
        config,
        userSupabase,
        supabaseService,
        paystackFetch,
        requestTimeoutMs,
        corsHeaders,
        auto_renew,
      );
      if ("response" in reconOutcome) {
        return reconOutcome.response;
      }
      initializationResult = reconOutcome.retryResult;
    } else {
      const sanitized = sanitizeDatabaseError(error);
      return errorResponse(
        sanitized.status,
        sanitized.message,
        sanitized.errorCode,
        corsHeaders,
      );
    }
  }

  if (initializationResult.error) {
    if (action === "checkout" && isProviderReconciliationRequiredError(initializationResult.error)) {
      const reconOutcome = await reconcileProviderSubscriptionBeforeCheckout(
        company_id,
        idempotency_key,
        getErrorField(initializationResult.error, "message"),
        config,
        userSupabase,
        supabaseService,
        paystackFetch,
        requestTimeoutMs,
        corsHeaders,
        auto_renew,
      );
      if ("response" in reconOutcome) {
        return reconOutcome.response;
      }
      initializationResult = reconOutcome.retryResult;
    } else {
      const sanitized = sanitizeDatabaseError(initializationResult.error);
      return errorResponse(
        sanitized.status,
        sanitized.message,
        sanitized.errorCode,
        corsHeaders,
      );
    }
  }

  const paymentResult = decodeInitializedPaymentRpcResult(
    initializationResult.data,
  );
  if ("error" in paymentResult) {
    return errorResponse(
      500,
      "Billing initialization returned an invalid result.",
      "BILLING_RPC_CONTRACT_INVALID",
      corsHeaders,
    );
  }

  const payment = paymentResult.data;

  if (payment.environment !== config.paystackEnvironment) {
    return errorResponse(
      500,
      "Billing environment configuration does not match the payment.",
      "PAYSTACK_ENVIRONMENT_MISMATCH",
      corsHeaders,
    );
  }

  if (action === "status" && (payment.payment_status === "pending" || payment.payment_status === "initialized")) {
    return reconcilePaystackCheckoutAttempt(payment, config, supabaseService, paystackFetch, requestTimeoutMs, corsHeaders);
  }

  if (payment.payment_status === "pending") {
    if (!payment.checkout_url || !payment.is_reused) {
      return errorResponse(
        500,
        "Stored checkout session failed an integrity check.",
        "PAYSTACK_SESSION_INTEGRITY_FAILURE",
        corsHeaders,
      );
    }

    return jsonResponse(
      {
        ok: true,
        data: {
          payment_id: payment.payment_id,
          provider_reference: payment.provider_reference,
          payment_status: "pending",
          checkout_url: payment.checkout_url,
          is_reused: true,
        },
      },
      200,
      corsHeaders,
    );
  }

  if (payment.payment_status === "succeeded") {
    return jsonResponse(
      {
        ok: true,
        data: {
          payment_id: payment.payment_id,
          provider_reference: payment.provider_reference,
          payment_status: "succeeded",
          checkout_url: null,
          is_reused: true,
        },
      },
      200,
      corsHeaders,
    );
  }

  if (
    payment.payment_status === "failed" ||
    payment.payment_status === "cancelled"
  ) {
    return errorResponse(
      409,
      "This payment attempt is closed. Start a new logical payment attempt with a new idempotency key.",
      "PAYMENT_ATTEMPT_TERMINAL",
      corsHeaders,
    );
  }

  if (payment.payment_status !== "initialized") {
    return errorResponse(
      500,
      "Payment is in an unexpected state.",
      "PAYMENT_STATE_INVALID",
      corsHeaders,
    );
  }

  /*
   * An initialized row returned with is_reused=true means a previous invocation
   * may already have reached Paystack without durably recording the response.
   * Reconcile server-side against Paystack to recover or resolve the attempt.
   */
  if (payment.is_reused) {
    return await reconcilePaystackCheckoutAttempt(
      payment,
      config,
      supabaseService,
      paystackFetch,
      requestTimeoutMs,
      corsHeaders,
      {
        retryDelayMs:
          injectedDependencies.retryDelayMs ??
          injectedDependencies.databaseRetryDelayMs ??
          DATABASE_RETRY_DELAY_MS,
      },
    );
  }

  const paystackPayload = buildPaystackInitializePayload(
    payment,
    company_id,
    config.paystackCallbackUrl,
  );
  const timeout = createAbortSignal(requestTimeoutMs);

  let paystackResponse: Response;
  let providerBodyResult: Awaited<ReturnType<typeof readJsonResponseWithLimit>>;
  try {
    paystackResponse = await paystackFetch(PAYSTACK_INITIALIZE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.paystackSecretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(paystackPayload),
      signal: timeout.signal,
      redirect: "error",
    });
    // Keep the timeout active until the response body has finished streaming.
    providerBodyResult = await readJsonResponseWithLimit(paystackResponse);
  } catch {
    return errorResponse(
      502,
      "The payment provider response was not received. This attempt must be reconciled before retrying.",
      "PAYSTACK_INITIALIZATION_OUTCOME_UNKNOWN",
      corsHeaders,
    );
  } finally {
    timeout.dispose();
  }

  if (paystackResponse.status === 429) {
    const retryAfter = paystackResponse.headers.get("retry-after");
    const safeRetryAfter =
      retryAfter && /^\d{1,5}$/.test(retryAfter) ? retryAfter : undefined;
    return errorResponse(
      429,
      "The payment provider rate limit was reached. Keep the existing payment attempt and retry its status check.",
      "PAYSTACK_RATE_LIMITED",
      corsHeaders,
      safeRetryAfter ? { "Retry-After": safeRetryAfter } : undefined,
    );
  }

  if (paystackResponse.status >= 500) {
    return errorResponse(
      502,
      "The payment provider returned an indeterminate server error. Reconciliation is required before retrying.",
      "PAYSTACK_INITIALIZATION_OUTCOME_UNKNOWN",
      corsHeaders,
    );
  }

  if ("error" in providerBodyResult) {
    return errorResponse(
      502,
      providerBodyResult.error,
      "PAYSTACK_RESPONSE_INVALID",
      corsHeaders,
    );
  }

  if (!paystackResponse.ok) {
    const duplicateReference = isDuplicateReferenceResponse(
      providerBodyResult.data,
    );
    return errorResponse(
      duplicateReference ? 409 : 502,
      duplicateReference
        ? "The payment reference already exists at the provider and requires reconciliation."
        : "The payment provider rejected checkout initialization.",
      duplicateReference
        ? "PAYSTACK_REFERENCE_RECOVERY_REQUIRED"
        : "PAYSTACK_INITIALIZATION_REJECTED",
      corsHeaders,
    );
  }

  const validatedProviderResult = validatePaystackResponse(
    providerBodyResult.data,
    payment.provider_reference,
  );
  if ("error" in validatedProviderResult) {
    return errorResponse(
      502,
      validatedProviderResult.error,
      "PAYSTACK_RESPONSE_INVALID",
      corsHeaders,
    );
  }

  const { authorizationUrl, accessCode } = validatedProviderResult.data;

  let recordResponse: RpcResponse | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      recordResponse = await supabaseService.rpc(
        "record_paystack_checkout_session",
        {
          p_payment_id: payment.payment_id,
          p_provider_reference: payment.provider_reference,
          p_checkout_url: authorizationUrl,
          p_access_code: accessCode,
        },
      );
    } catch (error) {
      recordResponse = { data: null, error };
    }

    if (!recordResponse.error) break;
    if (!isTransientDatabaseError(recordResponse.error) || attempt === 1) break;
    await delay(
      injectedDependencies.databaseRetryDelayMs ?? DATABASE_RETRY_DELAY_MS,
    );
  }

  if (!recordResponse || recordResponse.error) {
    const sanitized = sanitizeRecordSessionDatabaseError(
      recordResponse?.error ?? null,
    );
    return errorResponse(
      sanitized.status,
      sanitized.message,
      sanitized.errorCode,
      corsHeaders,
    );
  }

  const recordedResult = decodeRecordCheckoutSessionRpcResult(
    recordResponse.data,
  );
  if ("error" in recordedResult) {
    return errorResponse(
      500,
      "Recorded checkout session failed an integrity check.",
      "PAYSTACK_SESSION_RECORD_CONTRACT_INVALID",
      corsHeaders,
    );
  }

  const recordedSession = recordedResult.data;
  if (
    recordedSession.payment_id !== payment.payment_id ||
    recordedSession.provider_reference !== payment.provider_reference ||
    recordedSession.checkout_url !== authorizationUrl
  ) {
    return errorResponse(
      500,
      "Recorded checkout session failed an integrity check.",
      "PAYSTACK_SESSION_RECORD_CONTRACT_INVALID",
      corsHeaders,
    );
  }

  return jsonResponse(
    {
      ok: true,
      data: {
        payment_id: recordedSession.payment_id,
        provider_reference: recordedSession.provider_reference,
        payment_status: "pending",
        checkout_url: recordedSession.checkout_url,
        is_reused: recordedSession.is_reused,
      },
    },
    200,
    corsHeaders,
  );
}

export async function reconcileProviderSubscriptionBeforeCheckout(
  companyId: string,
  idempotencyKey: string,
  errorMessage: string,
  config: ServerConfig,
  userSupabase: UserSupabaseClient,
  supabaseService: ServiceSupabaseClient,
  paystackFetch: FetchFunction,
  requestTimeoutMs: number,
  corsHeaders: Readonly<Record<string, string>>,
  autoRenew = false,
): Promise<{ ok: true; retryResult: RpcResponse } | { ok: false; response: Response }> {
  const blocked = (message: string, code = "PROVIDER_RECONCILIATION_REQUIRED", status = 409) =>
    ({ ok: false as const, response: errorResponse(status, message, code, corsHeaders) });
  const code = extractProviderSubscriptionCode(errorMessage);
  if (!code) return blocked("The existing provider subscription needs review before another payment.");
  try {
    const local = await supabaseService.rpc("get_provider_subscription_for_reconciliation", {
      p_company_id: companyId, p_provider_subscription_code: code,
    });
    if (local.error || !Array.isArray(local.data) || local.data.length !== 1) {
      return blocked("Could not confirm the existing provider subscription.");
    }
    const record = local.data[0];
    if (!isPlainObject(record) || record.company_id !== companyId ||
        record.provider !== "paystack" || record.environment !== config.paystackEnvironment ||
        record.provider_subscription_code !== code || typeof record.provider_customer_code !== "string") {
      return blocked("Provider subscription does not match this company and payment environment.");
    }
    const timeout = createAbortSignal(requestTimeoutMs);
    let response: Response;
    let body;
    try {
      response = await paystackFetch(`https://api.paystack.co/subscription/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${config.paystackSecretKey}`, Accept: "application/json" },
        signal: timeout.signal, redirect: "error",
      });
      body = await readJsonResponseWithLimit(response);
    } finally { timeout.dispose(); }
    if (!response.ok || "error" in body) return blocked("Paystack subscription verification is unavailable. Please retry.");
    const decoded = decodePaystackSubscriptionFetchData(body.data, code, config.paystackEnvironment);
    if ("error" in decoded || decoded.data.customerCode !== record.provider_customer_code) {
      return blocked("Paystack subscription verification did not match the billing record.", "PAYSTACK_SUBSCRIPTION_VERIFICATION_INVALID", 502);
    }
    const verified = decoded.data;
    if (verified.status === "active" || verified.status === "attention") {
      return blocked("Paystack still has an active recurring subscription. Manage it through Paystack before starting another payment.",
        verified.nextPaymentDate && Date.parse(verified.nextPaymentDate) > Date.now() ? "SCHEDULED_RENEWAL_PENDING" : "PAYSTACK_SUBSCRIPTION_ACTIVE");
    }
    if (verified.status === "non-renewing") {
      return blocked("Auto-renewal has been stopped. Paystack is still closing the subscription; check again after it confirms cancellation.", "PAYSTACK_SUBSCRIPTION_CLOSING");
    }
    // Terminal status stops future debits, but does not by itself resolve an earlier invoice.
    const providerData = (body.data as { data: Record<string, unknown> }).data;
    if (providerData.open_invoice !== null) {
      return blocked("Paystack still has an open or unconfirmed invoice for this subscription.", "PAYSTACK_INVOICE_RECONCILIATION_REQUIRED");
    }
    const invoice = providerData.most_recent_invoice;
    if (invoice !== null) {
      if (!isPlainObject(invoice) || typeof invoice.invoice_code !== "string" ||
          !["success", "failed"].includes(String(invoice.status))) {
        return blocked("The most recent Paystack invoice still requires final confirmation.", "PAYSTACK_INVOICE_RECONCILIATION_REQUIRED");
      }
      const invoiceCheck = await supabaseService.rpc("is_paystack_invoice_reconciled", {
        p_company_id: companyId, p_provider_subscription_code: code,
        p_invoice_code: invoice.invoice_code, p_provider_status: invoice.status,
      });
      if (invoiceCheck.error || invoiceCheck.data !== true) {
        return blocked("The most recent Paystack invoice has not been reconciled in billing yet.", "PAYSTACK_INVOICE_RECONCILIATION_REQUIRED");
      }
    }
    const reconciled = await supabaseService.rpc("reconcile_paystack_provider_subscription", {
      p_company_id: companyId, p_provider_subscription_code: code,
      p_target_status: verified.status, p_reason: "verified_terminal_subscription_and_invoice",
    });
    const row = Array.isArray(reconciled.data) && reconciled.data.length === 1 ? reconciled.data[0] : null;
    if (reconciled.error || !isPlainObject(row) || row.provider_subscription_code !== code ||
        row.is_current !== false || !["cancelled", "completed"].includes(String(row.provider_status))) {
      return blocked("Paystack closure could not be recorded. Please retry.");
    }
    const retryResult = await userSupabase.rpc("initialize_billing_checkout", {
      p_company_id: companyId, p_idempotency_key: idempotencyKey,
      p_environment: config.paystackEnvironment, p_auto_renew: autoRenew, p_lookup_only: false,
    });
    if (retryResult.error) {
      const safe = sanitizeDatabaseError(retryResult.error);
      return blocked(safe.message, safe.errorCode, safe.status);
    }
    return { ok: true, retryResult };
  } catch {
    return blocked("Provider verification could not be completed. Retry the existing payment request.");
  }
}

async function reconcilePaystackCheckoutAttempt(
  payment: InitializedPaymentRpcResult,
  config: ServerConfig,
  supabaseService: ServiceSupabaseClient,
  paystackFetch: FetchFunction,
  requestTimeoutMs: number,
  corsHeaders: Readonly<Record<string, string>>,
  options?: {
    retryDelayMs?: number;
  },
): Promise<Response> {
  const verifyUrl = `${PAYSTACK_VERIFY_URL_PREFIX}${encodeURIComponent(payment.provider_reference)}`;
  const timeout = createAbortSignal(requestTimeoutMs);

  let paystackResponse: Response;
  let providerBodyResult: Awaited<ReturnType<typeof readJsonResponseWithLimit>>;
  try {
    paystackResponse = await paystackFetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.paystackSecretKey}`,
        Accept: "application/json",
      },
      signal: timeout.signal,
      redirect: "error",
    });
    providerBodyResult = await readJsonResponseWithLimit(paystackResponse);
  } catch {
    return errorResponse(
      409,
      "The payment initialization outcome could not be resolved from the provider. Status verification timed out; please retry status check.",
      "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
      corsHeaders,
    );
  } finally {
    timeout.dispose();
  }

  if (paystackResponse.status === 429) {
    const retryAfter = paystackResponse.headers.get("Retry-After");
    const safeRetryAfter =
      retryAfter && /^\d+$/.test(retryAfter.trim()) ? retryAfter.trim() : null;
    return errorResponse(
      429,
      "Paystack rate limit reached during payment recovery. Please retry shortly.",
      "PAYSTACK_RATE_LIMITED",
      corsHeaders,
      safeRetryAfter ? { "Retry-After": safeRetryAfter } : undefined,
    );
  }

  if (paystackResponse.status >= 500) {
    return errorResponse(
      409,
      "The payment initialization outcome could not be resolved from the provider. Provider server error; please retry status check.",
      "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
      corsHeaders,
    );
  }

  if ("error" in providerBodyResult) {
    return errorResponse(
      409,
      "The payment initialization outcome could not be resolved from the provider. Invalid provider response; please retry status check.",
      "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
      corsHeaders,
    );
  }

  const rawJson = providerBodyResult.data;

  // Rule 6: Check for reference lookup miss (404 or status: false / reference not found)
  if (paystackResponse.status === 404 || isReferenceNotFoundResponse(rawJson)) {
    // Provider lookup misses (whether before or after 15 minutes) are never treated as terminal failure.
    // Paystack documentation does not guarantee that an unindexed reference will never be charged.
    // Keep attempt initialized / recovery-required to block duplicate payment creation and prevent premature entitlement grants.
    return errorResponse(
      409,
      "Paystack could not confirm this payment reference. The existing attempt remains unresolved; please check its status again.",
      "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
      corsHeaders,
    );
  }

  if (!paystackResponse.ok) {
    return errorResponse(
      502,
      "Payment verification was rejected by the provider. The existing attempt remains unresolved.",
      "PAYSTACK_RECOVERY_VERIFICATION_INVALID",
      corsHeaders,
    );
  }

  const decodeResult = decodePaystackVerifyRecoveryData(
    rawJson,
    payment.provider_reference,
    config.paystackEnvironment,
  );

  if ("error" in decodeResult) {
    return errorResponse(
      502,
      "Payment provider returned unexpected verification data.",
      "PAYSTACK_RECOVERY_VERIFICATION_INVALID",
      corsHeaders,
    );
  }

  const verified = decodeResult.data;

  // Commercial snapshot integrity validation
  if (
    verified.amount_minor !== payment.amount_minor ||
    verified.currency !== payment.currency
  ) {
    return errorResponse(
      502,
      "Payment provider verification data does not match the commercial snapshot.",
      "PAYSTACK_COMMERCIAL_MISMATCH",
      corsHeaders,
    );
  }

  // Outcome 1: Successful payment (delayed confirmation / completed)
  if (verified.status === "success") {
    if (!verified.paid_at || !Number.isFinite(Date.parse(verified.paid_at)) ||
        verified.customer_email?.toLowerCase() !== payment.customer_email.toLowerCase() ||
        (payment.auto_renew_requested && verified.provider_plan_code !== payment.provider_plan_code) ||
        (!payment.auto_renew_requested && verified.provider_plan_code !== null)) {
      return errorResponse(502, "Verified payment is missing matching payment details.", "PAYSTACK_COMMERCIAL_MISMATCH", corsHeaders);
    }
    const rawText = JSON.stringify(rawJson);
    const payloadSha256 = await calculateSha256Hex(rawText);

    const chargeParams = {
      p_environment: config.paystackEnvironment,
      p_payload_sha256: payloadSha256,
      p_provider_reference: payment.provider_reference,
      p_provider_transaction_id: verified.transaction_id,
      p_amount_minor: verified.amount_minor,
      p_currency: verified.currency,
      p_paid_at: verified.paid_at,
      p_provider_plan_code:
        verified.provider_plan_code ?? null,
      p_provider_customer_code: verified.provider_customer_code ?? null,
      p_customer_email: verified.customer_email,
      p_authorization_code: verified.authorization_code ?? null,
      p_authorization_signature: verified.authorization_signature,
      p_card_type: verified.card_type ?? null,
      p_last4: verified.last4 ?? null,
      p_exp_month: verified.exp_month ?? null,
      p_exp_year: verified.exp_year ?? null,
      p_bank: verified.bank ?? null,
      p_channel: verified.channel ?? null,
      p_reusable: verified.reusable,
    };

    let chargeSuccessRpcResult: { data: unknown; error: unknown };
    try {
      chargeSuccessRpcResult = await supabaseService.rpc(
        "process_paystack_charge_success",
        chargeParams,
      );
    } catch (err) {
      if (isTransientDatabaseError(err)) {
        if (options?.retryDelayMs) await delay(options.retryDelayMs);
        try {
          chargeSuccessRpcResult = await supabaseService.rpc(
            "process_paystack_charge_success",
            chargeParams,
          );
        } catch {
          return errorResponse(
            503,
            "The verified payment could not be confirmed in the billing ledger. Please retry status check.",
            "PAYSTACK_RECOVERY_RECORDING_UNCONFIRMED",
            corsHeaders,
          );
        }
      } else {
        return errorResponse(
          500,
          "The verified payment could not be recorded safely.",
          "PAYSTACK_RECOVERY_RECORDING_FAILED",
          corsHeaders,
        );
      }
    }

    if (chargeSuccessRpcResult.error) {
      return errorResponse(
        500,
        "Failed to finalize verified payment in billing ledger.",
        "PAYSTACK_RECOVERY_RECORDING_FAILED",
        corsHeaders,
      );
    }

    const recorded = Array.isArray(chargeSuccessRpcResult.data) && chargeSuccessRpcResult.data.length === 1
      ? chargeSuccessRpcResult.data[0] : null;
    if (!isPlainObject(recorded) || recorded.payment_id !== payment.payment_id ||
        recorded.subscription_id !== payment.subscription_id || recorded.payment_status !== "succeeded" ||
        recorded.processing_status !== "processed") {
      return errorResponse(503, "Payment recording is unconfirmed. Please check again.", "PAYSTACK_RECOVERY_RECORDING_UNCONFIRMED", corsHeaders);
    }

    return jsonResponse(
      {
        ok: true,
        data: {
          payment_id: payment.payment_id,
          provider_reference: payment.provider_reference,
          payment_status: "succeeded",
          checkout_url: null,
          is_reused: true,
        },
      },
      200,
      corsHeaders,
    );
  }

  // Outcome 2: Definitive terminal failure (failed)
  if (verified.status === "failed") {
    let result: RpcResponse;
    try {
      result = await supabaseService.rpc("reconcile_paystack_checkout_initialization", {
        p_payment_id: payment.payment_id,
        p_provider_reference: payment.provider_reference,
        p_target_status: "failed",
        p_provider_transaction_id: verified.transaction_id,
        p_error_code: "PAYSTACK_TRANSACTION_FAILED",
        p_error_message: verified.gateway_response ?? "Paystack transaction failed.",
      });
    } catch {
      return errorResponse(503, "Payment status could not be saved. Retry this payment status check.", "PAYSTACK_RECOVERY_RECORDING_UNCONFIRMED", corsHeaders);
    }
    const row = Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : null;
    if (result.error || !isPlainObject(row) || row.payment_id !== payment.payment_id ||
        row.provider_reference !== payment.provider_reference || row.is_resolved !== true ||
        !["succeeded", "failed", "cancelled"].includes(String(row.payment_status))) {
      return errorResponse(503, "Payment status could not be confirmed in billing. Please check again.", "PAYSTACK_RECOVERY_RECORDING_UNCONFIRMED", corsHeaders);
    }
    // A concurrent verified success wins over this older failure response.
    if (row.payment_status === "succeeded") {
      return jsonResponse({ ok: true, data: {
        payment_id: payment.payment_id, provider_reference: payment.provider_reference,
        payment_status: "succeeded", checkout_url: null, is_reused: true,
      } }, 200, corsHeaders);
    }
    return errorResponse(409, "This payment attempt failed. You can start a new payment.", "PAYMENT_ATTEMPT_TERMINAL", corsHeaders);
  }

  // Outcome 3: Reversed (potential refund or chargeback)
  // Paystack documents reversed as potentially representing a refund or chargeback.
  // Do not record as an ordinary checkout-initialization failure to avoid misrepresenting the immutable ledger.
  if (verified.status === "reversed") {
    return errorResponse(
      409,
      "Payment provider transaction was reversed (refund or chargeback). Reversal lifecycle is not supported in checkout initialization recovery and requires manual administrator review.",
      "PAYSTACK_REVERSAL_LIFECYCLE_UNSUPPORTED",
      corsHeaders,
    );
  }

  // Outcome 4: Pending / non-terminal at provider (abandoned, ongoing, pending, processing, queued)
  if (
    verified.status === "abandoned" ||
    verified.status === "ongoing" ||
    verified.status === "pending" ||
    verified.status === "processing" ||
    verified.status === "queued"
  ) {
    return errorResponse(
      409,
      `Checkout attempt is registered with provider with status '${verified.status}'. Awaiting payment completion or definitive terminal status.`,
      "PAYSTACK_INITIALIZATION_RECOVERY_REQUIRED",
      corsHeaders,
    );
  }

  // Outcome 5: Unknown or malformed status - do not silently classify as terminal!
  return errorResponse(
    502,
    `Payment provider returned an unknown or malformed transaction status '${verified.status}'.`,
    "PAYSTACK_RECOVERY_VERIFICATION_INVALID",
    corsHeaders,
  );
}

const runtime = getDenoRuntime();
const isMainModule =
  (import.meta as ImportMeta & { main?: boolean }).main === true;

if (runtime && isMainModule) {
  runtime.serve(handlePaystackCheckoutRequest);
}
