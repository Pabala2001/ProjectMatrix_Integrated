import { createClient } from "@supabase/supabase-js";
import {
  MAX_PROVIDER_RESPONSE_BYTES,
  MAX_REQUEST_BYTES,
  PAYSTACK_REQUEST_TIMEOUT_MS,
  PAYSTACK_SUBSCRIPTION_URL_PREFIX,
  PAYSTACK_VERIFY_URL_PREFIX,
  calculateSha256Hex,
  decodePaystackInvoiceCreateEvent,
  decodePaystackInvoiceUpdateSuccessEvent,
  decodePaystackSubscriptionCreateEvent,
  decodePaystackSubscriptionDisableEvent,
  decodePaystackSubscriptionNotRenewEvent,
  decodePaystackVerifyResponse,
  decodeProcessChargeSuccessRpcResult,
  decodeProcessPaystackInvoiceCreateRpcResult,
  decodeProcessPaystackInvoiceUpdateSuccessRpcResult,
  decodeProcessPaystackSubscriptionCreateRpcResult,
  decodeProcessPaystackSubscriptionDisableRpcResult,
  decodeProcessPaystackSubscriptionNotRenewRpcResult,
  isValidProviderReference,
  parseWebhookEnvelope,
  readRawBodyWithLimit,
  sanitizeDatabaseError,
  sanitizeInvoiceCreateDatabaseError,
  sanitizeInvoiceUpdateSuccessDatabaseError,
  sanitizeSubscriptionDatabaseError,
  sanitizeSubscriptionDisableDatabaseError,
  sanitizeSubscriptionNotRenewDatabaseError,
  validatePaystackInvoiceCreateSubscriptionResponse,
  validatePaystackInvoiceUpdateSubscriptionResponse,
  validatePaystackInvoiceUpdateTransactionResponse,
  validatePaystackSubscriptionDisableResponse,
  validatePaystackSubscriptionNotRenewResponse,
  validatePaystackSubscriptionResponse,
  validateServerConfig,
  verifyPaystackSignature,
  type ProcessPaystackChargeSuccessRpcParams,
  type ProcessPaystackInvoiceCreateRpcParams,
  type ProcessPaystackInvoiceUpdateSuccessRpcParams,
  type ProcessPaystackSubscriptionCreateRpcParams,
  type ProcessPaystackSubscriptionDisableRpcParams,
  type ProcessPaystackSubscriptionNotRenewRpcParams,
  type ServerConfig,
  type VerifiedInvoiceUpdateTransactionData,
  type WebhookErrorResponse,
  type WebhookSuccessResponse,
} from "./core.ts";

export interface ServiceSupabaseClient {
  rpc(
    functionName: string,
    parameters:
      | ProcessPaystackChargeSuccessRpcParams
      | ProcessPaystackSubscriptionCreateRpcParams
      | ProcessPaystackSubscriptionNotRenewRpcParams
      | ProcessPaystackSubscriptionDisableRpcParams
      | ProcessPaystackInvoiceCreateRpcParams
      | ProcessPaystackInvoiceUpdateSuccessRpcParams
      | Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface HandlePaystackWebhookOptions {
  supabaseService?: ServiceSupabaseClient;
  paystackFetch?: FetchFunction;
  env?: Readonly<Record<string, string | undefined>>;
  requestTimeoutMs?: number;
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
    SUPABASE_URL: runtime.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: runtime.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function createServiceRoleClient(config: ServerConfig): ServiceSupabaseClient {
  const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    rpc: async (functionName, parameters) => {
      const result = await client.rpc(functionName, parameters);
      return { data: result.data, error: result.error };
    },
  };
}

function jsonResponse(
  body: WebhookSuccessResponse | WebhookErrorResponse | Record<string, unknown>,
  status: number,
  additionalHeaders: Record<string, string> = {},
): Response {
  if (status >= 400) {
    console.error("PAYSTACK_WEBHOOK_ERROR", {
      status,
      error: "error" in body ? body.error : "Unknown error",
    });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
  });
}

export async function handlePaystackWebhook(
  request: Request,
  options: HandlePaystackWebhookOptions = {},
): Promise<Response> {
  // 1. Method Restriction: Only POST allowed
  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed." },
      405,
      { Allow: "POST" },
    );
  }

  // 2. Server Configuration Validation
  const env = options.env ?? getEnvironmentVariables();
  const configResult = validateServerConfig(env);
  if ("error" in configResult) {
    return jsonResponse(
      { ok: false, error: "Server configuration error." },
      500,
    );
  }
  const config = configResult.config;

  // 3. Read Raw Request Body with Strict Size Limit
  const rawBodyResult = await readRawBodyWithLimit(
    request.body,
    request.headers.get("content-length"),
    MAX_REQUEST_BYTES,
  );
  if ("error" in rawBodyResult) {
    return jsonResponse(
      { ok: false, error: rawBodyResult.error },
      rawBodyResult.status,
    );
  }
  const rawBytes = rawBodyResult.data;

  // 4. HMAC-SHA512 Signature Verification (Must occur before JSON parsing or any upstream/database calls)
  const signatureHeader = request.headers.get("x-paystack-signature");
  const isSignatureValid = await verifyPaystackSignature(
    signatureHeader,
    rawBytes,
    config.paystackSecretKey,
  );
  if (!isSignatureValid) {
    return jsonResponse(
      { ok: false, error: "Missing or invalid Paystack signature." },
      401,
    );
  }

  // 5. Payload SHA-256 Digest over Exact Raw Bytes
  const payloadSha256 = await calculateSha256Hex(rawBytes);

  // 6. JSON Webhook Envelope Parsing
  const envelopeResult = parseWebhookEnvelope(rawBytes);
  if ("error" in envelopeResult) {
    return jsonResponse(
      { ok: false, error: envelopeResult.error },
      envelopeResult.status,
    );
  }
  const { event, data } = envelopeResult.data;

  // 7. Route Supported Webhook Events
  if (event === "charge.success") {
    // 8. Extract & Validate Provider Reference from Signed Payload
    const webhookReference = data.reference;
    if (!isValidProviderReference(webhookReference)) {
      return jsonResponse(
        { ok: false, error: "Invalid provider reference format in webhook payload." },
        400,
      );
    }

    // 9. Verify Transaction with Paystack API
    const fetchImpl = options.paystackFetch ?? globalThis.fetch;
    const timeoutMs = options.requestTimeoutMs ?? PAYSTACK_REQUEST_TIMEOUT_MS;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    let paystackResponse: Response;
    try {
      const verifyUrl = `${PAYSTACK_VERIFY_URL_PREFIX}${encodeURIComponent(webhookReference)}`;
      paystackResponse = await fetchImpl(verifyUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.paystackSecretKey}`,
          Accept: "application/json",
        },
        signal: abortController.signal,
      });
    } catch {
      return jsonResponse(
        { ok: false, error: "Paystack verification timeout or network failure." },
        503,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 10. Read & Validate Paystack Verification Response
    const verifyBodyResult = await readRawBodyWithLimit(
      paystackResponse.body,
      paystackResponse.headers.get("content-length"),
      MAX_PROVIDER_RESPONSE_BYTES,
    );
    if ("error" in verifyBodyResult) {
      return jsonResponse(
        { ok: false, error: "Failed to read Paystack verification response." },
        502,
      );
    }

    if (!paystackResponse.ok) {
      const status = paystackResponse.status >= 500 ? 503 : 502;
      return jsonResponse(
        { ok: false, error: "Paystack transaction verification failed." },
        status,
      );
    }

    let verifyJson: unknown;
    try {
      const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
        verifyBodyResult.data,
      );
      verifyJson = JSON.parse(responseText);
    } catch {
      return jsonResponse(
        { ok: false, error: "Malformed JSON in Paystack verification response." },
        502,
      );
    }

    const decodeVerifyResult = decodePaystackVerifyResponse(
      verifyJson,
      webhookReference,
      config.paystackEnvironment,
    );
    if ("error" in decodeVerifyResult) {
      return jsonResponse(
        { ok: false, error: "Paystack transaction verification validation failed." },
        502,
      );
    }
    const verified = decodeVerifyResult.data;

    // 11. Create Supabase Service-Role Client and Invoke Atomic Finalization RPC
    const supabaseService =
      options.supabaseService ?? createServiceRoleClient(config);

    const rpcParameters: ProcessPaystackChargeSuccessRpcParams = {
      p_environment: verified.environment,
      p_payload_sha256: payloadSha256,
      p_provider_reference: verified.provider_reference,
      p_provider_transaction_id: verified.provider_transaction_id,
      p_amount_minor: verified.amount_minor,
      p_currency: verified.currency,
      p_paid_at: verified.paid_at,
      p_provider_plan_code: verified.provider_plan_code,
      p_provider_customer_code: verified.provider_customer_code,
      p_customer_email: verified.customer_email,
      p_authorization_code: verified.authorization_code,
      p_authorization_signature: verified.authorization_signature,
      p_card_type: verified.card_type,
      p_last4: verified.last4,
      p_exp_month: verified.exp_month,
      p_exp_year: verified.exp_year,
      p_bank: verified.bank,
      p_channel: verified.channel,
      p_reusable: verified.reusable,
    };

    let rpcResult: { data: unknown; error: unknown };
    try {
      rpcResult = await supabaseService.rpc(
        "process_paystack_charge_success",
        rpcParameters,
      );
    } catch {
      return jsonResponse(
        { ok: false, error: "Transient database failure." },
        503,
      );
    }

    if (rpcResult.error) {
      const sanitized = sanitizeDatabaseError(rpcResult.error);
      return jsonResponse(
        { ok: false, error: sanitized.message },
        sanitized.status,
      );
    }

    const decodedRpc = decodeProcessChargeSuccessRpcResult(rpcResult.data);
    if ("error" in decodedRpc) {
      return jsonResponse(
        { ok: false, error: "Invalid RPC result contract." },
        500,
      );
    }

    // 12. Return Success Acknowledgement
    return jsonResponse(
      {
        ok: true,
        received: true,
        processed: true,
        is_reused: decodedRpc.data.is_reused,
      },
      200,
    );
  }

  if (event === "subscription.create") {
    // 8. Decode subscription.create envelope data
    const decodeSubEventResult = decodePaystackSubscriptionCreateEvent(envelopeResult.data);
    if ("error" in decodeSubEventResult) {
      return jsonResponse(
        { ok: false, error: decodeSubEventResult.error },
        400,
      );
    }
    const subscriptionEvent = decodeSubEventResult.data;

    // 9. Fetch authoritative subscription snapshot from Paystack API
    const fetchImpl = options.paystackFetch ?? globalThis.fetch;
    const timeoutMs = options.requestTimeoutMs ?? PAYSTACK_REQUEST_TIMEOUT_MS;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    let paystackResponse: Response;
    try {
      const subscriptionUrl = `${PAYSTACK_SUBSCRIPTION_URL_PREFIX}${encodeURIComponent(subscriptionEvent.providerSubscriptionCode)}`;
      paystackResponse = await fetchImpl(subscriptionUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.paystackSecretKey}`,
          Accept: "application/json",
        },
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      if (abortController.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        return jsonResponse(
          { ok: false, error: "Paystack subscription fetch timed out." },
          504,
        );
      }
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch network failure." },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 10. Read & Validate Paystack Subscription Snapshot Response
    const subBodyResult = await readRawBodyWithLimit(
      paystackResponse.body,
      paystackResponse.headers.get("content-length"),
      MAX_PROVIDER_RESPONSE_BYTES,
    );
    if ("error" in subBodyResult) {
      return jsonResponse(
        { ok: false, error: "Failed to read Paystack subscription response." },
        502,
      );
    }

    if (!paystackResponse.ok) {
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch failed." },
        502,
      );
    }

    let subJson: unknown;
    try {
      const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
        subBodyResult.data,
      );
      subJson = JSON.parse(responseText);
    } catch {
      return jsonResponse(
        { ok: false, error: "Malformed JSON in Paystack subscription response." },
        502,
      );
    }

    const validateSubResult = validatePaystackSubscriptionResponse(
      subJson,
      subscriptionEvent.providerSubscriptionCode,
      subscriptionEvent.environment,
    );
    if (validateSubResult.success === false) {
      console.error("PAYSTACK_SUBSCRIPTION_VALIDATION_FAILED", validateSubResult.error);
      return jsonResponse(
        { ok: false, error: "Paystack subscription response validation failed." },
        502,
      );
    }
    const verifiedSub = validateSubResult.data;

    // 11. Create Supabase Service-Role Client and Invoke Atomic Subscription Linking RPC
    const supabaseService =
      options.supabaseService ?? createServiceRoleClient(config);

    const rpcParameters: ProcessPaystackSubscriptionCreateRpcParams = {
      p_environment: verifiedSub.environment,
      p_payload_sha256: payloadSha256,
      p_provider_event_id: null,
      p_provider_subscription_code: verifiedSub.providerSubscriptionCode,
      p_provider_subscription_id: verifiedSub.providerSubscriptionId,
      p_provider_customer_code: verifiedSub.providerCustomerCode,
      p_provider_customer_id: verifiedSub.providerCustomerId,
      p_customer_email: verifiedSub.customerEmail,
      p_provider_plan_code: verifiedSub.providerPlanCode,
      p_amount_minor: verifiedSub.amountMinor,
      p_currency: verifiedSub.currency,
      p_authorization_code: verifiedSub.authorizationCode,
      p_authorization_signature: verifiedSub.authorizationSignature,
      p_email_token: verifiedSub.emailToken,
      p_provider_status: verifiedSub.providerStatus,
      p_next_payment_at: verifiedSub.nextPaymentAt,
      p_occurred_at: verifiedSub.occurredAt,
    };

    let rpcResult: { data: unknown; error: unknown };
    try {
      rpcResult = await supabaseService.rpc(
        "process_paystack_subscription_create",
        rpcParameters,
      );
    } catch {
      return jsonResponse(
        { ok: false, error: "Transient database failure." },
        503,
      );
    }

    if (rpcResult.error) {
      const sanitized = sanitizeSubscriptionDatabaseError(rpcResult.error);
      return jsonResponse(
        {
          ok: false,
          error: sanitized.message,
          ...(sanitized.code ? { code: sanitized.code } : {}),
        },
        sanitized.status,
        sanitized.headers ?? {},
      );
    }

    const decodedRpc = decodeProcessPaystackSubscriptionCreateRpcResult(rpcResult.data);
    if (decodedRpc.success === false) {
      return jsonResponse(
        { ok: false, error: "Invalid RPC result contract." },
        500,
      );
    }

    if (decodedRpc.data.provider_subscription_code !== verifiedSub.providerSubscriptionCode) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified subscription data." },
        500,
      );
    }

    if (
      decodedRpc.data.is_reused === false &&
      decodedRpc.data.provider_status !== verifiedSub.providerStatus
    ) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified subscription data." },
        500,
      );
    }

    // 12. Return Success Acknowledgement
    return jsonResponse(
      {
        ok: true,
        received: true,
        processed: true,
        is_reused: decodedRpc.data.is_reused,
      },
      200,
    );
  }

  if (event === "subscription.not_renew") {
    // 8. Decode subscription.not_renew envelope data
    const decodeSubEventResult = decodePaystackSubscriptionNotRenewEvent(envelopeResult.data);
    if ("error" in decodeSubEventResult) {
      return jsonResponse(
        { ok: false, error: decodeSubEventResult.error },
        400,
      );
    }
    const subscriptionEvent = decodeSubEventResult.data;

    // Reject if environment mismatch with server config
    if (subscriptionEvent.environment !== config.paystackEnvironment) {
      return jsonResponse(
        { ok: false, error: "Webhook environment does not match server configuration." },
        400,
      );
    }

    // 9. Fetch authoritative subscription snapshot from Paystack API
    const fetchImpl = options.paystackFetch ?? globalThis.fetch;
    const timeoutMs = options.requestTimeoutMs ?? PAYSTACK_REQUEST_TIMEOUT_MS;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    let paystackResponse: Response;
    try {
      const subscriptionUrl = `${PAYSTACK_SUBSCRIPTION_URL_PREFIX}${encodeURIComponent(subscriptionEvent.providerSubscriptionCode)}`;
      paystackResponse = await fetchImpl(subscriptionUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.paystackSecretKey}`,
          Accept: "application/json",
        },
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      if (abortController.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        return jsonResponse(
          { ok: false, error: "Paystack subscription fetch timed out." },
          504,
        );
      }
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch network failure." },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 10. Read & Validate Paystack Subscription Snapshot Response
    const subBodyResult = await readRawBodyWithLimit(
      paystackResponse.body,
      paystackResponse.headers.get("content-length"),
      MAX_PROVIDER_RESPONSE_BYTES,
    );
    if ("error" in subBodyResult) {
      return jsonResponse(
        { ok: false, error: "Failed to read Paystack subscription response." },
        502,
      );
    }

    if (!paystackResponse.ok) {
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch failed." },
        502,
      );
    }

    let subJson: unknown;
    try {
      const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
        subBodyResult.data,
      );
      subJson = JSON.parse(responseText);
    } catch {
      return jsonResponse(
        { ok: false, error: "Malformed JSON in Paystack subscription response." },
        502,
      );
    }

    const validateSubResult = validatePaystackSubscriptionNotRenewResponse(
      subJson,
      subscriptionEvent.providerSubscriptionCode,
      subscriptionEvent.environment,
      new Date().toISOString(), // Server observation after a successful provider fetch.
    );
    if (validateSubResult.success === false) {
      console.error("PAYSTACK_SUBSCRIPTION_VALIDATION_FAILED", validateSubResult.error);
      return jsonResponse(
        { ok: false, error: "Paystack subscription response validation failed." },
        502,
      );
    }
    const verifiedSub = validateSubResult.data;

    // 11. Create Supabase Service-Role Client and Invoke Atomic Subscription Not Renew RPC
    const supabaseService =
      options.supabaseService ?? createServiceRoleClient(config);

    const rpcParameters: ProcessPaystackSubscriptionNotRenewRpcParams = {
      p_environment: verifiedSub.environment,
      p_payload_sha256: payloadSha256,
      p_provider_event_id: subscriptionEvent.providerEventId,
      p_provider_subscription_code: verifiedSub.providerSubscriptionCode,
      p_provider_subscription_id: verifiedSub.providerSubscriptionId,
      p_provider_customer_code: verifiedSub.providerCustomerCode,
      p_provider_status: verifiedSub.providerStatus,
      p_next_payment_at: verifiedSub.nextPaymentAt,
      p_occurred_at: verifiedSub.occurredAt,
    };

    let rpcResult: { data: unknown; error: unknown };
    try {
      rpcResult = await supabaseService.rpc(
        "process_paystack_subscription_not_renew",
        rpcParameters,
      );
    } catch {
      return jsonResponse(
        { ok: false, error: "Transient database failure." },
        503,
      );
    }

    if (rpcResult.error) {
      const sanitized = sanitizeSubscriptionNotRenewDatabaseError(rpcResult.error);
      return jsonResponse(
        {
          ok: false,
          error: sanitized.message,
          ...(sanitized.code ? { code: sanitized.code } : {}),
        },
        sanitized.status,
        sanitized.headers ?? {},
      );
    }

    const decodedRpc = decodeProcessPaystackSubscriptionNotRenewRpcResult(rpcResult.data);
    if (decodedRpc.success === false) {
      return jsonResponse(
        { ok: false, error: "Invalid RPC result contract." },
        500,
      );
    }

    if (decodedRpc.data.provider_subscription_code !== verifiedSub.providerSubscriptionCode) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified subscription data." },
        500,
      );
    }

    if (
      decodedRpc.data.is_reused === false &&
      decodedRpc.data.is_ignored === false &&
      decodedRpc.data.provider_status !== verifiedSub.providerStatus
    ) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified subscription data." },
        500,
      );
    }

    // 12. Return Success Acknowledgement
    return jsonResponse(
      {
        ok: true,
        received: true,
        processed: true,
        is_reused: decodedRpc.data.is_reused,
      },
      200,
    );
  }

  if (event === "subscription.disable") {
    // 8. Decode subscription.disable envelope data
    const decodeSubEventResult = decodePaystackSubscriptionDisableEvent(envelopeResult.data);
    if ("error" in decodeSubEventResult) {
      return jsonResponse(
        { ok: false, error: decodeSubEventResult.error },
        400,
      );
    }
    const subscriptionEvent = decodeSubEventResult.data;

    // Reject if environment mismatch with server config
    if (subscriptionEvent.environment !== config.paystackEnvironment) {
      return jsonResponse(
        { ok: false, error: "Webhook environment does not match server configuration." },
        400,
      );
    }

    // 9. Fetch authoritative subscription snapshot from Paystack API
    const fetchImpl = options.paystackFetch ?? globalThis.fetch;
    const timeoutMs = options.requestTimeoutMs ?? PAYSTACK_REQUEST_TIMEOUT_MS;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    let paystackResponse: Response;
    try {
      const subscriptionUrl = `${PAYSTACK_SUBSCRIPTION_URL_PREFIX}${encodeURIComponent(subscriptionEvent.providerSubscriptionCode)}`;
      paystackResponse = await fetchImpl(subscriptionUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.paystackSecretKey}`,
          Accept: "application/json",
        },
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      if (abortController.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        return jsonResponse(
          { ok: false, error: "Paystack subscription fetch timed out." },
          504,
        );
      }
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch network failure." },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 10. Read & Validate Paystack Subscription Snapshot Response
    const subBodyResult = await readRawBodyWithLimit(
      paystackResponse.body,
      paystackResponse.headers.get("content-length"),
      MAX_PROVIDER_RESPONSE_BYTES,
    );
    if ("error" in subBodyResult) {
      return jsonResponse(
        { ok: false, error: "Failed to read Paystack subscription response." },
        502,
      );
    }

    if (!paystackResponse.ok) {
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch failed." },
        502,
      );
    }

    let subJson: unknown;
    try {
      const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
        subBodyResult.data,
      );
      subJson = JSON.parse(responseText);
    } catch {
      return jsonResponse(
        { ok: false, error: "Malformed JSON in Paystack subscription response." },
        502,
      );
    }

    const validateSubResult = validatePaystackSubscriptionDisableResponse(
      subJson,
      subscriptionEvent.providerSubscriptionCode,
      subscriptionEvent.environment,
    );
    if (validateSubResult.success === false) {
      console.error("PAYSTACK_SUBSCRIPTION_VALIDATION_FAILED", validateSubResult.error);
      return jsonResponse(
        { ok: false, error: "Paystack subscription response validation failed." },
        502,
      );
    }
    const verifiedSub = validateSubResult.data;

    // 11. Create Supabase Service-Role Client and Invoke Atomic Subscription Disable RPC
    const supabaseService =
      options.supabaseService ?? createServiceRoleClient(config);

    const rpcParameters: ProcessPaystackSubscriptionDisableRpcParams = {
      p_environment: verifiedSub.environment,
      p_payload_sha256: payloadSha256,
      p_provider_event_id: subscriptionEvent.providerEventId,
      p_provider_subscription_code: verifiedSub.providerSubscriptionCode,
      p_provider_subscription_id: verifiedSub.providerSubscriptionId,
      p_provider_customer_code: verifiedSub.providerCustomerCode,
      p_provider_status: verifiedSub.providerStatus,
      p_disabled_at: verifiedSub.disabledAt,
      p_occurred_at: verifiedSub.occurredAt,
    };

    let rpcResult: { data: unknown; error: unknown };
    try {
      rpcResult = await supabaseService.rpc(
        "process_paystack_subscription_disable",
        rpcParameters,
      );
    } catch {
      return jsonResponse(
        { ok: false, error: "Transient database failure." },
        503,
      );
    }

    if (rpcResult.error) {
      const sanitized = sanitizeSubscriptionDisableDatabaseError(rpcResult.error);
      return jsonResponse(
        {
          ok: false,
          error: sanitized.message,
          ...(sanitized.code ? { code: sanitized.code } : {}),
        },
        sanitized.status,
        sanitized.headers ?? {},
      );
    }

    const decodedRpc = decodeProcessPaystackSubscriptionDisableRpcResult(rpcResult.data);
    if (decodedRpc.success === false) {
      return jsonResponse(
        { ok: false, error: "Invalid RPC result contract." },
        500,
      );
    }

    if (decodedRpc.data.provider_subscription_code !== verifiedSub.providerSubscriptionCode) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified subscription data." },
        500,
      );
    }

    if (
      decodedRpc.data.is_reused === false &&
      decodedRpc.data.provider_status !== verifiedSub.providerStatus
    ) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified subscription data." },
        500,
      );
    }

    // 12. Return Success Acknowledgement
    return jsonResponse(
      {
        ok: true,
        received: true,
        processed: true,
        is_reused: decodedRpc.data.is_reused,
      },
      200,
    );
  }

  if (event === "invoice.create") {
    // 8. Decode invoice.create envelope data
    const decodeInvoiceEventResult = decodePaystackInvoiceCreateEvent(envelopeResult.data);
    if (decodeInvoiceEventResult.success === false) {
      return jsonResponse(
        { ok: false, error: decodeInvoiceEventResult.error },
        400,
      );
    }
    const invoiceEvent = decodeInvoiceEventResult.data;

    // Reject if environment mismatch with server config
    if (invoiceEvent.environment !== config.paystackEnvironment) {
      return jsonResponse(
        { ok: false, error: "Webhook environment does not match server configuration." },
        400,
      );
    }

    // 9. Fetch authoritative subscription snapshot from Paystack API
    const fetchImpl = options.paystackFetch ?? globalThis.fetch;
    const timeoutMs = options.requestTimeoutMs ?? PAYSTACK_REQUEST_TIMEOUT_MS;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    let paystackResponse: Response;
    try {
      const subscriptionUrl = `${PAYSTACK_SUBSCRIPTION_URL_PREFIX}${encodeURIComponent(invoiceEvent.providerSubscriptionCode)}`;
      paystackResponse = await fetchImpl(subscriptionUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.paystackSecretKey}`,
          Accept: "application/json",
        },
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      if (abortController.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        return jsonResponse(
          { ok: false, error: "Paystack subscription fetch timed out." },
          504,
        );
      }
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch network failure." },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 10. Read & Validate Paystack Subscription Snapshot Response
    const subBodyResult = await readRawBodyWithLimit(
      paystackResponse.body,
      paystackResponse.headers.get("content-length"),
      MAX_PROVIDER_RESPONSE_BYTES,
    );
    if ("error" in subBodyResult) {
      return jsonResponse(
        { ok: false, error: "Failed to read Paystack subscription response." },
        502,
      );
    }

    if (!paystackResponse.ok) {
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch failed." },
        502,
      );
    }

    let subJson: unknown;
    try {
      const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
        subBodyResult.data,
      );
      subJson = JSON.parse(responseText);
    } catch {
      return jsonResponse(
        { ok: false, error: "Malformed JSON in Paystack subscription response." },
        502,
      );
    }

    const validateSubResult = validatePaystackInvoiceCreateSubscriptionResponse(
      subJson,
      invoiceEvent,
    );
    if (validateSubResult.success === false) {
      console.error("PAYSTACK_SUBSCRIPTION_VALIDATION_FAILED", validateSubResult.error);
      return jsonResponse(
        { ok: false, error: "Paystack subscription response validation failed." },
        502,
      );
    }

    // 11. Create Supabase Service-Role Client and Invoke Atomic Invoice Create RPC
    const supabaseService =
      options.supabaseService ?? createServiceRoleClient(config);

    const rpcParameters: ProcessPaystackInvoiceCreateRpcParams = {
      p_environment: invoiceEvent.environment,
      p_payload_sha256: payloadSha256,
      p_provider_event_id: invoiceEvent.providerEventId,
      p_provider_invoice_code: invoiceEvent.providerInvoiceCode,
      p_provider_subscription_code: invoiceEvent.providerSubscriptionCode,
      p_provider_customer_code: invoiceEvent.providerCustomerCode,
      p_provider_status: invoiceEvent.providerStatus,
      p_amount_minor: invoiceEvent.amountMinor,
      p_currency: invoiceEvent.currency,
      p_period_start: invoiceEvent.periodStart,
      p_period_end: invoiceEvent.periodEnd,
      p_occurred_at: invoiceEvent.occurredAt,
    };

    let rpcResult: { data: unknown; error: unknown };
    try {
      rpcResult = await supabaseService.rpc(
        "process_paystack_invoice_create",
        rpcParameters,
      );
    } catch {
      return jsonResponse(
        { ok: false, error: "Transient database failure." },
        503,
      );
    }

    if (rpcResult.error) {
      const sanitized = sanitizeInvoiceCreateDatabaseError(rpcResult.error);
      return jsonResponse(
        {
          ok: false,
          error: sanitized.message,
          ...(sanitized.code ? { code: sanitized.code } : {}),
        },
        sanitized.status,
        sanitized.headers ?? {},
      );
    }

    const decodedRpc = decodeProcessPaystackInvoiceCreateRpcResult(rpcResult.data);
    if (decodedRpc.success === false) {
      return jsonResponse(
        { ok: false, error: "Invalid RPC result contract." },
        500,
      );
    }

    // Consistency Checks
    if (
      decodedRpc.data.provider_invoice_code !== invoiceEvent.providerInvoiceCode ||
      decodedRpc.data.amount_minor !== invoiceEvent.amountMinor ||
      decodedRpc.data.currency !== invoiceEvent.currency
    ) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified invoice data." },
        500,
      );
    }

    if (
      decodedRpc.data.is_reused === false &&
      decodedRpc.data.is_ignored === false &&
      (decodedRpc.data.invoice_status !== "pending" ||
        decodedRpc.data.provider_status !== invoiceEvent.providerStatus)
    ) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified invoice data." },
        500,
      );
    }

    // 12. Return Success Acknowledgement
    return jsonResponse(
      {
        ok: true,
        received: true,
        processed: true,
        is_reused: decodedRpc.data.is_reused,
        is_ignored: decodedRpc.data.is_ignored,
        invoice: {
          id: decodedRpc.data.invoice_id,
          provider_invoice_code: decodedRpc.data.provider_invoice_code,
          status: decodedRpc.data.invoice_status,
        },
      },
      200,
    );
  }

  // --- invoice.update Handler (Step 3C.4E-3B) ---
  if (event === "invoice.update") {
    // 8. Decode and Validate Paystack invoice.update Payload
    const decodeResult = decodePaystackInvoiceUpdateSuccessEvent(envelopeResult.data);
    if (decodeResult.success === false) {
      return jsonResponse({ ok: false, error: decodeResult.error }, 400);
    }
    const invoiceEvent = decodeResult.data;

    // Environment matching check
    if (invoiceEvent.environment !== config.paystackEnvironment) {
      return jsonResponse(
        { ok: false, error: "Environment mismatch." },
        400,
      );
    }

    const fetchImpl = options.paystackFetch ?? globalThis.fetch;
    const timeoutMs = options.requestTimeoutMs ?? PAYSTACK_REQUEST_TIMEOUT_MS;

    // 9. Upstream Verification: Transaction Verification (if providerReference present)
    let verifiedTransaction: VerifiedInvoiceUpdateTransactionData | null = null;
    if (invoiceEvent.providerReference) {
      const verifyUrl = `${PAYSTACK_VERIFY_URL_PREFIX}${encodeURIComponent(invoiceEvent.providerReference)}`;
      const txnAbortController = new AbortController();
      const txnTimeoutId = setTimeout(() => {
        txnAbortController.abort();
      }, timeoutMs);

      let paystackTxnResponse: Response;
      try {
        paystackTxnResponse = await fetchImpl(verifyUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.paystackSecretKey}`,
            "User-Agent": "ProjectMatrix-Paystack-Webhook/1.0",
            Accept: "application/json",
          },
          signal: txnAbortController.signal,
        });
      } catch (err: unknown) {
        if (txnAbortController.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
          return jsonResponse(
            { ok: false, error: "Paystack transaction verification timed out." },
            504,
          );
        }
        return jsonResponse(
          { ok: false, error: "Paystack transaction verification network failure." },
          502,
        );
      } finally {
        clearTimeout(txnTimeoutId);
      }

      const txnBodyResult = await readRawBodyWithLimit(
        paystackTxnResponse.body,
        paystackTxnResponse.headers.get("content-length"),
        MAX_PROVIDER_RESPONSE_BYTES,
      );
      if ("error" in txnBodyResult) {
        return jsonResponse(
          { ok: false, error: "Failed to read Paystack transaction verification response." },
          502,
        );
      }

      if (!paystackTxnResponse.ok) {
        return jsonResponse(
          { ok: false, error: "Paystack transaction verification failed." },
          502,
        );
      }

      let txnJson: unknown;
      try {
        const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
          txnBodyResult.data,
        );
        txnJson = JSON.parse(responseText);
      } catch {
        return jsonResponse(
          { ok: false, error: "Malformed JSON in Paystack transaction verification response." },
          502,
        );
      }

      const validateTxnResult = validatePaystackInvoiceUpdateTransactionResponse(
        txnJson,
        {
          environment: invoiceEvent.environment,
          providerReference: invoiceEvent.providerReference,
          providerCustomerCode: invoiceEvent.providerCustomerCode,
          providerPlanCode: invoiceEvent.providerPlanCode,
          amountMinor: invoiceEvent.amountMinor,
          currency: invoiceEvent.currency,
        },
      );
      if (validateTxnResult.success === false) {
        return jsonResponse(
          { ok: false, error: "Paystack transaction response validation failed." },
          502,
        );
      }
      verifiedTransaction = validateTxnResult.data;
    }

    // 10. Upstream Verification: Subscription Snapshot Verification
    const subUrl = `${PAYSTACK_SUBSCRIPTION_URL_PREFIX}${encodeURIComponent(invoiceEvent.providerSubscriptionCode)}`;
    const subAbortController = new AbortController();
    const subTimeoutId = setTimeout(() => {
      subAbortController.abort();
    }, timeoutMs);

    let paystackSubResponse: Response;
    try {
      paystackSubResponse = await fetchImpl(subUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.paystackSecretKey}`,
          "User-Agent": "ProjectMatrix-Paystack-Webhook/1.0",
          Accept: "application/json",
        },
        signal: subAbortController.signal,
      });
    } catch (err: unknown) {
      if (subAbortController.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        return jsonResponse(
          { ok: false, error: "Paystack subscription fetch timed out." },
          504,
        );
      }
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch network failure." },
        502,
      );
    } finally {
      clearTimeout(subTimeoutId);
    }

    const subBodyResult = await readRawBodyWithLimit(
      paystackSubResponse.body,
      paystackSubResponse.headers.get("content-length"),
      MAX_PROVIDER_RESPONSE_BYTES,
    );
    if ("error" in subBodyResult) {
      return jsonResponse(
        { ok: false, error: "Failed to read Paystack subscription response." },
        502,
      );
    }

    if (!paystackSubResponse.ok) {
      return jsonResponse(
        { ok: false, error: "Paystack subscription fetch failed." },
        502,
      );
    }

    let subJson: unknown;
    try {
      const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
        subBodyResult.data,
      );
      subJson = JSON.parse(responseText);
    } catch {
      return jsonResponse(
        { ok: false, error: "Malformed JSON in Paystack subscription response." },
        502,
      );
    }

    const validateSubResult = validatePaystackInvoiceUpdateSubscriptionResponse(
      subJson,
      {
        environment: invoiceEvent.environment,
        providerSubscriptionCode: invoiceEvent.providerSubscriptionCode,
        providerCustomerCode: invoiceEvent.providerCustomerCode,
        providerPlanCode: invoiceEvent.providerPlanCode,
        providerInvoiceCode: invoiceEvent.providerInvoiceCode,
        amountMinor: invoiceEvent.amountMinor,
        currency: invoiceEvent.currency,
        periodStart: invoiceEvent.periodStart,
        periodEnd: invoiceEvent.periodEnd,
      },
    );
    if (validateSubResult.success === false) {
      return jsonResponse(
        { ok: false, error: "Paystack subscription response validation failed." },
        502,
      );
    }
    const verifiedSubscription = validateSubResult.data;

    // 11. Create Supabase Service-Role Client and Invoke Atomic Invoice Update Success RPC
    const supabaseService =
      options.supabaseService ?? createServiceRoleClient(config);

    const rpcParameters: ProcessPaystackInvoiceUpdateSuccessRpcParams = {
      p_environment: invoiceEvent.environment,
      p_payload_sha256: payloadSha256,
      p_provider_event_id: invoiceEvent.providerEventId,
      p_provider_invoice_code: invoiceEvent.providerInvoiceCode,
      p_provider_subscription_code: invoiceEvent.providerSubscriptionCode,
      p_provider_customer_code: invoiceEvent.providerCustomerCode,
      p_provider_plan_code: verifiedTransaction?.providerPlanCode ?? verifiedSubscription.providerPlanCode ?? invoiceEvent.providerPlanCode,
      p_provider_invoice_status: invoiceEvent.providerInvoiceStatus,
      p_provider_paid: invoiceEvent.providerPaid,
      p_provider_transaction_status: verifiedTransaction?.providerTransactionStatus ?? invoiceEvent.providerTransactionStatus,
      p_provider_transaction_id: verifiedTransaction?.providerTransactionId ?? invoiceEvent.providerTransactionId,
      p_provider_reference: verifiedTransaction?.providerReference ?? invoiceEvent.providerReference,
      p_amount_minor: invoiceEvent.amountMinor,
      p_currency: invoiceEvent.currency,
      p_period_start: invoiceEvent.periodStart,
      p_period_end: invoiceEvent.periodEnd,
      p_paid_at: verifiedTransaction?.paidAt ?? invoiceEvent.paidAt,
      p_next_payment_date: verifiedSubscription.nextPaymentDate ?? invoiceEvent.nextPaymentDate,
      p_occurred_at: invoiceEvent.occurredAt,
    };

    let rpcResult: { data: unknown; error: unknown };
    try {
      rpcResult = await supabaseService.rpc(
        "process_paystack_invoice_update_success",
        rpcParameters,
      );
    } catch {
      return jsonResponse(
        { ok: false, error: "Transient database failure." },
        503,
      );
    }

    if (rpcResult.error) {
      const sanitized = sanitizeInvoiceUpdateSuccessDatabaseError(rpcResult.error);
      return jsonResponse(
        {
          ok: false,
          error: sanitized.message,
          ...(sanitized.code ? { code: sanitized.code } : {}),
        },
        sanitized.status,
        sanitized.headers ?? {},
      );
    }

    const decodedRpc = decodeProcessPaystackInvoiceUpdateSuccessRpcResult(rpcResult.data);
    if (decodedRpc.success === false) {
      return jsonResponse(
        { ok: false, error: "Invalid RPC result contract." },
        500,
      );
    }

    // Consistency Checks
    if (
      decodedRpc.data.provider_invoice_code !== invoiceEvent.providerInvoiceCode ||
      decodedRpc.data.amount_minor !== invoiceEvent.amountMinor ||
      decodedRpc.data.currency !== invoiceEvent.currency
    ) {
      return jsonResponse(
        { ok: false, error: "RPC result does not match verified invoice data." },
        500,
      );
    }

    // 12. Return Success Acknowledgement
    return jsonResponse(
      {
        ok: true,
        received: true,
        processed: true,
        is_reused: decodedRpc.data.is_reused,
        is_ignored: decodedRpc.data.is_ignored,
        invoice: {
          id: decodedRpc.data.invoice_id,
          provider_invoice_code: decodedRpc.data.provider_invoice_code,
          status: decodedRpc.data.invoice_status,
        },
        payment: {
          id: decodedRpc.data.payment_id,
          status: decodedRpc.data.payment_status,
        },
        subscription: {
          id: decodedRpc.data.subscription_id,
          status: decodedRpc.data.subscription_status,
          current_period_start: decodedRpc.data.current_period_start,
          current_period_end: decodedRpc.data.current_period_end,
          next_renewal_at: decodedRpc.data.next_renewal_at,
          past_due_since: decodedRpc.data.past_due_since,
        },
      },
      200,
    );
  }

  // 13. Other events: ignored safely with 200 OK
  return jsonResponse(
    {
      ok: true,
      received: true,
      processed: false,
    },
    200,
  );
}

const runtime = getDenoRuntime();
if (runtime && typeof runtime.serve === "function") {
  runtime.serve((request: Request) => handlePaystackWebhook(request));
}
