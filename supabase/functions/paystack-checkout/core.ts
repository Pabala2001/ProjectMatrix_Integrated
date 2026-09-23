/**
 * ProjectMatrix Paystack Checkout Core
 *
 * Pure validation, decoding, payload construction, and error-mapping helpers
 * shared by the authenticated paystack-checkout Edge Function and its tests.
 */

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PROVIDER_REFERENCE_REGEX =
  /^PAY-[0-9]{8}-[0-9A-F]{32}$/;
export const PAYSTACK_PLAN_CODE_REGEX = /^PLN_[A-Za-z0-9]+$/;
export const PAYSTACK_CHECKOUT_URL_ORIGIN = "https://checkout.paystack.com";
export const PAYSTACK_INITIALIZE_URL =
  "https://api.paystack.co/transaction/initialize";
export const MAX_REQUEST_BYTES = 16_384;
export const MAX_PROVIDER_RESPONSE_BYTES = 65_536;
export const PAYSTACK_REQUEST_TIMEOUT_MS = 10_000;
export const DATABASE_RETRY_DELAY_MS = 75;

// Backward-compatible names retained for existing imports.
export const PAYSTACK_CHECKOUT_URL_PREFIX = `${PAYSTACK_CHECKOUT_URL_ORIGIN}/`;
export const MAX_PAYLOAD_BYTES = MAX_REQUEST_BYTES;

export const WHITESPACE_OR_CONTROL_REGEX = /[\s\x00-\x1F\x7F]/;

type UnknownRecord = Record<string, unknown>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };

export type DecodeResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface PaystackCheckoutRequestBody {
  company_id: string;
  idempotency_key: string;
  auto_renew?: boolean;
  action?: "checkout" | "status";
}

export type BillingPaymentStatus =
  | "initialized"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface InitializedPaymentRpcResult {
  payment_id: string;
  subscription_id: string;
  provider_plan_mapping_id: string;
  provider_plan_code: string;
  provider: "paystack";
  environment: "test" | "live";
  purpose: "activation" | "renewal";
  provider_reference: string;
  amount_minor: number;
  currency: string;
  customer_email: string;
  payment_status: BillingPaymentStatus;
  checkout_url: string | null;
  is_reused: boolean;
  auto_renew_requested: boolean;
}

export interface RecordCheckoutSessionRpcResult {
  payment_id: string;
  provider_reference: string;
  payment_status: "pending";
  checkout_url: string;
  is_reused: boolean;
}

export interface ServerConfig {
  paystackSecretKey: string;
  paystackEnvironment: "test" | "live";
  paystackCallbackUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  allowedOrigins: readonly string[];
}

export type ServerConfigValidationResult =
  | { success: true; data: ServerConfig; config: ServerConfig }
  | { success: false; error: string };

export interface PaystackInitializePayload {
  email: string;
  amount: string;
  currency: string;
  reference: string;
  plan?: string;
  channels?: string[];
  callback_url: string;
  metadata: string;
}

export interface PaystackCheckoutSuccessData {
  payment_id: string;
  provider_reference: string;
  payment_status: "pending" | "succeeded";
  checkout_url: string | null;
  is_reused: boolean;
}

export interface PaystackCheckoutSuccessResponse {
  ok: true;
  data: PaystackCheckoutSuccessData;
}

export interface PaystackCheckoutErrorResponse {
  ok: false;
  error: string;
  error_code?: string;
}

export interface DatabaseErrorLike {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
}

export function isPlainObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: UnknownRecord, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpected = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpected.length &&
    actualKeys.every((key, index) => key === sortedExpected[index])
  );
}

function isBoundedString(
  value: unknown,
  maximumLength: number,
  rejectWhitespaceOrControl = false,
): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value !== value.trim()
  ) {
    return false;
  }

  return !rejectWhitespaceOrControl || !WHITESPACE_OR_CONTROL_REGEX.test(value);
}

export function getErrorField(error: unknown, field: keyof DatabaseErrorLike): string {
  if (!isPlainObject(error)) return "";
  const value = error[field];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

export function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === 36 &&
    UUID_REGEX.test(value)
  );
}

export function isValidProviderReference(value: unknown): value is string {
  return typeof value === "string" && PROVIDER_REFERENCE_REGEX.test(value);
}

export function isValidPaystackCheckoutUrl(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2_048 ||
    value !== value.trim() ||
    WHITESPACE_OR_CONTROL_REGEX.test(value)
  ) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.origin === PAYSTACK_CHECKOUT_URL_ORIGIN &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname.length > 1 &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

export async function readRequestBodyWithLimit(
  request: Request,
  maximumBytes = MAX_REQUEST_BYTES,
): Promise<ValidationResult<string>> {
  return readBodyWithLimit(
    request.body,
    request.headers.get("content-length"),
    maximumBytes,
  );
}

async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  contentLength: string | null,
  maximumBytes: number,
): Promise<ValidationResult<string>> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    return {
      success: false,
      error: "Invalid body-size limit.",
      status: 500,
    };
  }

  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return {
        success: false,
        error: "Invalid Content-Length header.",
        status: 400,
      };
    }

    if (Number(contentLength) > maximumBytes) {
      return {
        success: false,
        error: `Request body exceeds the ${maximumBytes}-byte limit.`,
        status: 413,
      };
    }
  }

  if (!body) {
    return { success: true, data: "" };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size violation is authoritative even if cancellation fails.
        }
        return {
          success: false,
          error: `Request body exceeds the ${maximumBytes}-byte limit.`,
          status: 413,
        };
      }

      chunks.push(value);
    }
  } catch {
    return {
      success: false,
      error: "Failed to read request body.",
      status: 400,
    };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      success: true,
      data: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return {
      success: false,
      error: "Request body must contain valid UTF-8 text.",
      status: 400,
    };
  }
}

export function parseAndValidateRequestBody(
  bodyText: string,
  contentType: string | null,
): ValidationResult<PaystackCheckoutRequestBody> {
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return {
      success: false,
      error: "Invalid Content-Type: application/json is required.",
      status: 415,
    };
  }

  if (bodyText.trim().length === 0) {
    return {
      success: false,
      error: "Request body cannot be empty.",
      status: 400,
    };
  }

  if (new TextEncoder().encode(bodyText).byteLength > MAX_REQUEST_BYTES) {
    return {
      success: false,
      error: `Request body exceeds the ${MAX_REQUEST_BYTES}-byte limit.`,
      status: 413,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText) as unknown;
  } catch {
    return {
      success: false,
      error: "Malformed JSON in request body.",
      status: 400,
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      success: false,
      error: "Request body must be a JSON object.",
      status: 400,
    };
  }

  const allowedKeys = ["company_id", "idempotency_key", "auto_renew", "action"];
  if (Object.keys(parsed).some((key) => !allowedKeys.includes(key)) ||
      (parsed.auto_renew !== undefined && typeof parsed.auto_renew !== "boolean") ||
      (parsed.action !== undefined && parsed.action !== "checkout" && parsed.action !== "status")) {
    return {
      success: false,
      error: "Invalid checkout request fields.",
      status: 400,
    };
  }

  if (!isValidUuid(parsed.company_id)) {
    return {
      success: false,
      error: "Invalid company_id: a canonical UUID is required.",
      status: 400,
    };
  }

  if (!isValidUuid(parsed.idempotency_key)) {
    return {
      success: false,
      error: "Invalid idempotency_key: a canonical UUID is required.",
      status: 400,
    };
  }

  return {
    success: true,
    data: {
      company_id: parsed.company_id,
      idempotency_key: parsed.idempotency_key,
      ...(parsed.auto_renew !== undefined ? { auto_renew: parsed.auto_renew as boolean } : {}),
      ...(parsed.action !== undefined ? { action: parsed.action as "checkout" | "status" } : {}),
    },
  };
}

function parseConfiguredUrl(
  value: string,
  label: string,
  allowLocalHttp = false,
): DecodeResult<URL> {
  if (
    value !== value.trim() ||
    WHITESPACE_OR_CONTROL_REGEX.test(value) ||
    value.length > 2_048
  ) {
    return { success: false, error: `${label} contains invalid characters.` };
  }

  try {
    const parsed = new URL(value);
    const isLocalHttp =
      allowLocalHttp &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (
      (parsed.protocol !== "https:" && !isLocalHttp) ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== ""
    ) {
      return {
        success: false,
        error: `${label} must be an HTTPS URL without credentials or a fragment.`,
      };
    }
    return { success: true, data: parsed };
  } catch {
    return { success: false, error: `${label} must be a valid HTTPS URL.` };
  }
}

export function validateServerConfig(
  env: Readonly<Record<string, string | undefined>>,
): ServerConfigValidationResult {
  const paystackSecretKey = env.PAYSTACK_SECRET_KEY ?? "";
  const paystackEnvironment = env.PAYSTACK_ENVIRONMENT?.trim().toLowerCase() ?? "";
  const paystackCallbackUrl = env.PAYSTACK_CALLBACK_URL ?? "";
  const supabaseUrl = env.SUPABASE_URL ?? "";
  const supabaseAnonKey = env.SUPABASE_ANON_KEY ?? "";
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!isBoundedString(paystackSecretKey, 512, true)) {
    return { success: false, error: "PAYSTACK_SECRET_KEY is missing or invalid." };
  }

  if (paystackEnvironment !== "test" && paystackEnvironment !== "live") {
    return {
      success: false,
      error: "PAYSTACK_ENVIRONMENT must be test or live.",
    };
  }

  const requiredKeyPrefix =
    paystackEnvironment === "test" ? "sk_test_" : "sk_live_";
  if (
    !paystackSecretKey.startsWith(requiredKeyPrefix) ||
    paystackSecretKey.length < requiredKeyPrefix.length + 16
  ) {
    return {
      success: false,
      error: `PAYSTACK_SECRET_KEY does not match the ${paystackEnvironment} environment.`,
    };
  }

  const callbackResult = parseConfiguredUrl(
    paystackCallbackUrl,
    "PAYSTACK_CALLBACK_URL",
  );
  if ("error" in callbackResult) {
    return { success: false, error: callbackResult.error };
  }

  const supabaseUrlResult = parseConfiguredUrl(
    supabaseUrl,
    "SUPABASE_URL",
    true,
  );
  if ("error" in supabaseUrlResult) {
    return { success: false, error: supabaseUrlResult.error };
  }
  if (
    supabaseUrlResult.data.pathname !== "/" ||
    supabaseUrlResult.data.search !== ""
  ) {
    return {
      success: false,
      error: "SUPABASE_URL must be an origin URL without a path or query.",
    };
  }

  if (!isBoundedString(supabaseAnonKey, 4_096, true)) {
    return { success: false, error: "SUPABASE_ANON_KEY is missing or invalid." };
  }

  if (!isBoundedString(supabaseServiceRoleKey, 4_096, true)) {
    return {
      success: false,
      error: "SUPABASE_SERVICE_ROLE_KEY is missing or invalid.",
    };
  }

  const allowedOrigins = new Set<string>([callbackResult.data.origin]);
  const configuredOrigins = env.PAYSTACK_ALLOWED_ORIGINS?.split(",") ?? [];
  for (const configuredOrigin of configuredOrigins) {
    const candidate = configuredOrigin.trim();
    if (!candidate) continue;

    try {
      const parsed = new URL(candidate);
      const isLocalHttp =
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
      if (
        (parsed.protocol !== "https:" && !isLocalHttp) ||
        candidate !== parsed.origin ||
        parsed.username !== "" ||
        parsed.password !== ""
      ) {
        return {
          success: false,
          error: "PAYSTACK_ALLOWED_ORIGINS contains an invalid origin.",
        };
      }
      allowedOrigins.add(parsed.origin);
    } catch {
      return {
        success: false,
        error: "PAYSTACK_ALLOWED_ORIGINS contains an invalid origin.",
      };
    }
  }

  const config: ServerConfig = {
    paystackSecretKey,
    paystackEnvironment,
    paystackCallbackUrl: callbackResult.data.toString(),
    supabaseUrl: supabaseUrlResult.data.origin,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    allowedOrigins: [...allowedOrigins],
  };

  return {
    success: true,
    data: config,
    config,
  };
}

export function isOriginAllowed(
  origin: string | null,
  allowedOrigins: readonly string[],
): boolean {
  return origin === null || allowedOrigins.includes(origin);
}

export function getCorsHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin !== null && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

const INITIALIZED_PAYMENT_KEYS = [
  "payment_id",
  "subscription_id",
  "provider_plan_mapping_id",
  "provider_plan_code",
  "provider",
  "environment",
  "purpose",
  "provider_reference",
  "amount_minor",
  "currency",
  "customer_email",
  "payment_status",
  "checkout_url",
  "is_reused",
  "auto_renew_requested",
] as const;

function decodeExactlyOneRow(data: unknown): DecodeResult<UnknownRecord> {
  if (!Array.isArray(data) || data.length !== 1 || !isPlainObject(data[0])) {
    return {
      success: false,
      error: "RPC must return exactly one object row.",
    };
  }

  return { success: true, data: data[0] };
}

export function decodeInitializedPaymentRpcResult(
  data: unknown,
): DecodeResult<InitializedPaymentRpcResult> {
  const rowResult = decodeExactlyOneRow(data);
  if ("error" in rowResult) {
    return { success: false, error: rowResult.error };
  }
  const row = rowResult.data;

  if (!hasExactKeys(row, INITIALIZED_PAYMENT_KEYS)) {
    return { success: false, error: "Unexpected initialize RPC return contract." };
  }

  if (
    !isValidUuid(row.payment_id) ||
    !isValidUuid(row.subscription_id) ||
    !isValidUuid(row.provider_plan_mapping_id) ||
    typeof row.provider_plan_code !== "string" ||
    !PAYSTACK_PLAN_CODE_REGEX.test(row.provider_plan_code) ||
    row.provider_plan_code.length > 255 ||
    row.provider !== "paystack" ||
    (row.environment !== "test" && row.environment !== "live") ||
    (row.purpose !== "activation" && row.purpose !== "renewal") ||
    !isValidProviderReference(row.provider_reference) ||
    typeof row.amount_minor !== "number" ||
    !Number.isSafeInteger(row.amount_minor) ||
    row.amount_minor <= 0 ||
    row.amount_minor > 2_147_483_647 ||
    typeof row.currency !== "string" ||
    !/^[A-Z]{3}$/.test(row.currency) ||
    typeof row.customer_email !== "string" ||
    row.customer_email.length > 320 ||
    row.customer_email !== row.customer_email.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.customer_email) ||
    ![
      "initialized",
      "pending",
      "succeeded",
      "failed",
      "cancelled",
    ].includes(String(row.payment_status)) ||
    (row.checkout_url !== null && !isValidPaystackCheckoutUrl(row.checkout_url)) ||
    typeof row.is_reused !== "boolean" ||
    typeof row.auto_renew_requested !== "boolean"
  ) {
    return { success: false, error: "Initialize RPC returned invalid field values." };
  }

  if (row.payment_status === "initialized" && row.checkout_url !== null) {
    return {
      success: false,
      error: "Initialized payment unexpectedly contains a checkout URL.",
    };
  }

  return {
    success: true,
    data: row as unknown as InitializedPaymentRpcResult,
  };
}

const RECORD_SESSION_KEYS = [
  "payment_id",
  "provider_reference",
  "payment_status",
  "checkout_url",
  "is_reused",
] as const;

export function decodeRecordCheckoutSessionRpcResult(
  data: unknown,
): DecodeResult<RecordCheckoutSessionRpcResult> {
  const rowResult = decodeExactlyOneRow(data);
  if ("error" in rowResult) {
    return { success: false, error: rowResult.error };
  }
  const row = rowResult.data;

  if (
    !hasExactKeys(row, RECORD_SESSION_KEYS) ||
    !isValidUuid(row.payment_id) ||
    !isValidProviderReference(row.provider_reference) ||
    row.payment_status !== "pending" ||
    !isValidPaystackCheckoutUrl(row.checkout_url) ||
    typeof row.is_reused !== "boolean"
  ) {
    return { success: false, error: "Record-session RPC returned invalid data." };
  }

  return {
    success: true,
    data: row as unknown as RecordCheckoutSessionRpcResult,
  };
}

export function buildPaystackInitializePayload(
  payment: InitializedPaymentRpcResult,
  companyId: string,
  callbackUrl: string,
): PaystackInitializePayload {
  return {
    email: payment.customer_email,
    amount: String(payment.amount_minor),
    currency: payment.currency,
    reference: payment.provider_reference,
    ...(payment.auto_renew_requested ? { plan: payment.provider_plan_code, channels: ["card"] } : {}),
    callback_url: callbackUrl,
    metadata: JSON.stringify({
      payment_id: payment.payment_id,
      company_id: companyId,
      subscription_id: payment.subscription_id,
      purpose: payment.purpose,
      environment: payment.environment,
      auto_renew_requested: payment.auto_renew_requested,
    }),
  };
}

export function validatePaystackResponse(
  responseJson: unknown,
  expectedReference: string,
):
  | {
    success: true;
    data: { authorizationUrl: string; accessCode: string };
    authorizationUrl: string;
    accessCode: string;
  }
  | { success: false; error: string } {
  if (!isPlainObject(responseJson) || responseJson.status !== true) {
    return {
      success: false,
      error: "Payment provider rejected transaction initialization.",
    };
  }

  if (!isPlainObject(responseJson.data)) {
    return {
      success: false,
      error: "Payment provider returned an invalid response contract.",
    };
  }

  const data = responseJson.data;
  if (!isValidPaystackCheckoutUrl(data.authorization_url)) {
    return {
      success: false,
      error: "Payment provider returned an invalid checkout URL.",
    };
  }

  if (!isBoundedString(data.access_code, 255, true)) {
    return {
      success: false,
      error: "Payment provider returned an invalid access code.",
    };
  }

  if (
    !isValidProviderReference(expectedReference) ||
    data.reference !== expectedReference
  ) {
    return {
      success: false,
      error: "Payment provider returned an unexpected transaction reference.",
    };
  }

  const authorizationUrl = data.authorization_url;
  const accessCode = data.access_code;

  return {
    success: true,
    data: { authorizationUrl, accessCode },
    authorizationUrl,
    accessCode,
  };
}

export function isDuplicateReferenceResponse(responseJson: unknown): boolean {
  if (!isPlainObject(responseJson) || typeof responseJson.message !== "string") {
    return false;
  }

  return (
    /duplicate[^.]*reference/i.test(responseJson.message) ||
    /reference[^.]*(already exists|already used|has already been used)/i.test(
      responseJson.message,
    )
  );
}

export function sanitizeDatabaseError(
  error: unknown,
): { status: number; message: string; errorCode: string } {
  const code = getErrorField(error, "code");
  const message = getErrorField(error, "message").toLowerCase();

  if (
    code === "42501" ||
    code === "28000" ||
    message.includes("permission denied") ||
    message.includes("unauthorized") ||
    message.includes("caller is not a member")
  ) {
    return {
      status: 403,
      message: "You are not authorized to initialize billing checkout for this company.",
      errorCode: "BILLING_ACCESS_DENIED",
    };
  }

  if (
    code === "23505" ||
    message.includes("open payment") ||
    message.includes("already in progress") ||
    message.includes("duplicate key")
  ) {
    return {
      status: 409,
      message: "A billing checkout attempt is already in progress.",
      errorCode: "BILLING_CHECKOUT_CONFLICT",
    };
  }

  if (message.includes("scheduled_renewal_pending")) {
    return {
      status: 409,
      message: "An automated renewal is currently scheduled with the payment provider.",
      errorCode: "SCHEDULED_RENEWAL_PENDING",
    };
  }

  if (message.includes("provider_reconciliation_required")) {
    return {
      status: 409,
      message: "Provider subscription requires authoritative reconciliation before checkout can be initialized.",
      errorCode: "PROVIDER_RECONCILIATION_REQUIRED",
    };
  }

  if (code === "23514") {
    return {
      status: 409,
      message: "The target subscription is not eligible for checkout.",
      errorCode: "BILLING_SUBSCRIPTION_INELIGIBLE",
    };
  }

  if (code === "P0002") {
    return {
      status: 404,
      message: "No eligible subscription or active billing plan mapping was found.",
      errorCode: "BILLING_CONFIGURATION_NOT_FOUND",
    };
  }

  if (["22004", "22000", "22023"].includes(code)) {
    return {
      status: 400,
      message: "Invalid billing checkout parameters or account configuration.",
      errorCode: "BILLING_CHECKOUT_INVALID",
    };
  }

  if (isTransientDatabaseError(error)) {
    return {
      status: 503,
      message: "Billing checkout is temporarily unavailable.",
      errorCode: "BILLING_DATABASE_TEMPORARY_FAILURE",
    };
  }

  return {
    status: 500,
    message: "An error occurred while initializing billing checkout.",
    errorCode: "BILLING_CHECKOUT_INTERNAL_ERROR",
  };
}

export function isTransientDatabaseError(error: unknown): boolean {
  const code = getErrorField(error, "code");
  const statusText = getErrorField(error, "status");
  const status = statusText === "" ? Number.NaN : Number(statusText);
  const name = getErrorField(error, "name").toLowerCase();
  const message = getErrorField(error, "message").toLowerCase();

  return (
    code.startsWith("08") ||
    code === "40001" ||
    code === "40P01" ||
    code === "57014" ||
    (Number.isFinite(status) && [0, 429, 500, 502, 503, 504].includes(status)) ||
    name.includes("fetch") ||
    name.includes("timeout") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("connection reset") ||
    message.includes("timed out")
  );
}

export function sanitizeRecordSessionDatabaseError(
  error: unknown,
): { status: number; message: string; errorCode: string } {
  const code = getErrorField(error, "code");

  if (code === "23505") {
    return {
      status: 409,
      message:
        "The provider checkout session conflicts with existing billing state. Reconciliation is required.",
      errorCode: "PAYSTACK_SESSION_CONFLICT",
    };
  }

  if (code === "23514") {
    return {
      status: 409,
      message:
        "The provider checkout session failed a billing integrity check. Reconciliation is required.",
      errorCode: "PAYSTACK_SESSION_INTEGRITY_FAILURE",
    };
  }

  if (code === "P0002") {
    return {
      status: 404,
      message:
        "The initialized payment could not be found. Reconciliation is required.",
      errorCode: "PAYSTACK_PAYMENT_NOT_FOUND",
    };
  }

  if (isTransientDatabaseError(error)) {
    return {
      status: 503,
      message:
        "The checkout session could not be confirmed in the billing ledger. Reconciliation is required.",
      errorCode: "PAYSTACK_SESSION_RECORDING_UNCONFIRMED",
    };
  }

  return {
    status: 500,
    message:
      "The checkout session could not be recorded safely. Reconciliation is required.",
    errorCode: "PAYSTACK_SESSION_RECORDING_FAILED",
  };
}

export async function readJsonResponseWithLimit(
  response: Response,
  maximumBytes = MAX_PROVIDER_RESPONSE_BYTES,
): Promise<DecodeResult<unknown>> {
  const bodyResult = await readBodyWithLimit(
    response.body,
    response.headers.get("content-length"),
    maximumBytes,
  );
  if ("error" in bodyResult) {
    return { success: false, error: "Payment provider response was too large or unreadable." };
  }

  try {
    return { success: true, data: JSON.parse(bodyResult.data) as unknown };
  } catch {
    return { success: false, error: "Payment provider returned invalid JSON." };
  }
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export const PAYSTACK_VERIFY_URL_PREFIX = "https://api.paystack.co/transaction/verify/";

export function isReferenceNotFoundResponse(responseJson: unknown): boolean {
  if (!isPlainObject(responseJson)) return false;
  if (responseJson.status === false) {
    const message = typeof responseJson.message === "string" ? responseJson.message.toLowerCase() : "";
    return (
      message.includes("not found") ||
      message.includes("reference") ||
      message.includes("transaction")
    );
  }
  return false;
}

export async function calculateSha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface VerifiedTransactionRecoveryData {
  status: string;
  reference: string;
  transaction_id: string;
  amount_minor: number;
  currency: string;
  paid_at: string | null;
  customer_email: string | null;
  provider_customer_code: string | null;
  provider_plan_code: string | null;
  authorization_code: string | null;
  authorization_signature: string | null;
  card_type: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  bank: string | null;
  channel: string | null;
  reusable: boolean;
  gateway_response: string | null;
}

export function decodePaystackVerifyRecoveryData(
  responseJson: unknown,
  expectedReference: string,
  expectedEnvironment: "test" | "live",
): DecodeResult<VerifiedTransactionRecoveryData> {
  if (!isPlainObject(responseJson)) {
    return { success: false, error: "Paystack verify response must be a JSON object." };
  }

  if (responseJson.status !== true) {
    return {
      success: false,
      error: typeof responseJson.message === "string" ? responseJson.message : "Paystack verify failed.",
    };
  }

  const data = responseJson.data;
  if (!isPlainObject(data)) {
    return { success: false, error: "Paystack verify response missing data object." };
  }

  const reference = typeof data.reference === "string" ? data.reference : "";
  if (reference !== expectedReference) {
    return {
      success: false,
      error: `Paystack verify reference mismatch: expected ${expectedReference}, got ${reference}.`,
    };
  }

  const domain = typeof data.domain === "string" ? data.domain : "";
  if (domain !== expectedEnvironment) {
    return {
      success: false,
      error: `Paystack verify domain mismatch: expected ${expectedEnvironment}, got ${domain}.`,
    };
  }

  const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
  if (!status) {
    return { success: false, error: "Paystack verify missing transaction status." };
  }

  const rawAmount = data.amount;
  const amountMinor =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string" && /^[0-9]+$/.test(rawAmount)
      ? Number(rawAmount)
      : Number.NaN;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return { success: false, error: "Paystack verify amount is invalid." };
  }

  const currency = typeof data.currency === "string" ? data.currency.toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { success: false, error: "Paystack verify currency is invalid." };
  }

  const transactionId =
    typeof data.id === "number" || typeof data.id === "string" ? String(data.id) : "";
  if (!/^[0-9]{1,20}$/.test(transactionId) ||
      (transactionId.length === 20 && transactionId > "18446744073709551615") ||
      (typeof data.id === "number" && !Number.isSafeInteger(data.id))) {
    return { success: false, error: "Paystack verify transaction ID is missing or invalid." };
  }

  const paidAt =
    typeof data.paid_at === "string"
      ? data.paid_at
      : typeof data.paidAt === "string"
      ? data.paidAt
      : null;

  const customer = isPlainObject(data.customer) ? data.customer : null;
  const customerEmail =
    customer && typeof customer.email === "string" ? customer.email : null;
  const providerCustomerCode =
    customer && typeof customer.customer_code === "string"
      ? customer.customer_code
      : null;

  const providerPlanCode =
    typeof data.plan === "string"
      ? data.plan
      : isPlainObject(data.plan) && typeof data.plan.plan_code === "string"
      ? data.plan.plan_code
      : null;

  const auth = isPlainObject(data.authorization) ? data.authorization : null;
  const authorizationCode =
    auth && typeof auth.authorization_code === "string"
      ? auth.authorization_code
      : null;
  const cardType =
    auth && typeof auth.card_type === "string" ? auth.card_type : null;
  const last4 = auth && typeof auth.last4 === "string" ? auth.last4 : null;
  const expMonth =
    auth && typeof auth.exp_month === "string" ? auth.exp_month : null;
  const expYear =
    auth && typeof auth.exp_year === "string" ? auth.exp_year : null;
  const bank = auth && typeof auth.bank === "string" ? auth.bank : null;
  const channel =
    typeof data.channel === "string"
      ? data.channel
      : auth && typeof auth.channel === "string"
      ? auth.channel
      : null;
  const reusable = auth?.reusable === true;
  const gatewayResponse =
    typeof data.gateway_response === "string" ? data.gateway_response : null;

  return {
    success: true,
    data: {
      status,
      reference,
      transaction_id: transactionId,
      amount_minor: amountMinor,
      currency,
      paid_at: paidAt,
      customer_email: customerEmail,
      provider_customer_code: providerCustomerCode,
      provider_plan_code: providerPlanCode,
      authorization_code: authorizationCode,
      authorization_signature: typeof auth?.signature === "string" ? auth.signature : null,
      card_type: cardType,
      last4,
      exp_month: expMonth,
      exp_year: expYear,
      bank,
      channel,
      reusable,
      gateway_response: gatewayResponse,
    },
  };
}

export const PAYSTACK_RECOGNIZED_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "non-renewing",
  "attention",
  "completed",
  "cancelled",
]);

export interface PaystackSubscriptionRecoveryData {
  subscriptionCode: string;
  customerCode?: string;
  emailToken?: string;
  status: string;
  nextPaymentDate: string | null;
  domain?: string;
}

export function isProviderReconciliationRequiredError(error: unknown): boolean {
  const message = getErrorField(error, "message").toUpperCase();
  return message.includes("PROVIDER_RECONCILIATION_REQUIRED");
}

export function extractProviderSubscriptionCode(message: string): string | null {
  const match = /SUB_[A-Za-z0-9]+/i.exec(message);
  return match ? match[0] : null;
}

export function decodePaystackSubscriptionFetchData(
  responseJson: unknown,
  expectedSubscriptionCode: string,
  expectedEnvironment: string,
):
  | { success: true; data: PaystackSubscriptionRecoveryData }
  | { success: false; error: string } {
  if (!isPlainObject(responseJson) || responseJson.status !== true) {
    return {
      success: false,
      error: "Payment provider rejected subscription query or returned negative status.",
    };
  }

  if (!isPlainObject(responseJson.data)) {
    return {
      success: false,
      error: "Payment provider returned an invalid subscription response contract.",
    };
  }

  const data = responseJson.data;

  if (
    typeof data.subscription_code !== "string" ||
    data.subscription_code !== expectedSubscriptionCode
  ) {
    return {
      success: false,
      error: "Subscription code mismatch in provider response.",
    };
  }

  if (
    data.domain !== expectedEnvironment
  ) {
    return {
      success: false,
      error: "Subscription environment mismatch in provider response.",
    };
  }

  const status =
    typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
  if (!PAYSTACK_RECOGNIZED_SUBSCRIPTION_STATUSES.has(status)) {
    return {
      success: false,
      error: `Unrecognized subscription status "${status}" from provider.`,
    };
  }

  let nextPaymentDate: string | null = null;
  if (data.next_payment_date !== null && data.next_payment_date !== undefined) {
    if (typeof data.next_payment_date !== "string" || !Number.isFinite(Date.parse(data.next_payment_date))) {
      return {
        success: false,
        error: "Invalid next_payment_date format in provider response.",
      };
    }
    nextPaymentDate = data.next_payment_date;
  }

  return {
    success: true,
    data: {
      subscriptionCode: data.subscription_code,
      customerCode:
        typeof data.customer === "object" &&
        data.customer !== null &&
        typeof (data.customer as Record<string, unknown>).customer_code === "string"
          ? ((data.customer as Record<string, unknown>).customer_code as string)
          : undefined,
      emailToken:
        typeof data.email_token === "string" ? data.email_token : undefined,
      status,
      nextPaymentDate,
      domain: typeof data.domain === "string" ? data.domain : undefined,
    },
  };
}

export interface PaystackDisableSubscriptionPayload {
  code: string;
  token: string;
}

export function buildPaystackDisableSubscriptionPayload(
  subscriptionCode: string,
  emailToken: string,
): PaystackDisableSubscriptionPayload {
  return {
    code: subscriptionCode,
    token: emailToken,
  };
}

export function validatePaystackDisableResponse(
  responseJson: unknown,
): { success: true } | { success: false; error: string } {
  if (!isPlainObject(responseJson) || responseJson.status !== true) {
    return {
      success: false,
      error: "Payment provider rejected subscription disable request.",
    };
  }
  return { success: true };
}

