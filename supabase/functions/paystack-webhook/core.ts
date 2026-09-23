/**
 * ProjectMatrix Paystack Webhook Core
 *
 * Pure validation, cryptography, payload hashing, Paystack verification decoding,
 * RPC parameters and return-contract validation, and error mapping for the
 * public Paystack charge.success webhook Edge Function.
 */

export const MAX_REQUEST_BYTES = 65_536; // 64 KB
export const MAX_PROVIDER_RESPONSE_BYTES = 65_536; // 64 KB
export const PAYSTACK_REQUEST_TIMEOUT_MS = 10_000; // 10 seconds
export const PAYSTACK_VERIFY_URL_PREFIX = "https://api.paystack.co/transaction/verify/";
export const PAYSTACK_SUBSCRIPTION_URL_PREFIX = "https://api.paystack.co/subscription/";

export const PROVIDER_REFERENCE_REGEX = /^PAY-[0-9]{8}-[0-9A-F]{32}$/;
export const HEX_128_REGEX = /^[0-9a-fA-F]{128}$/;
export const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
export const PAYSTACK_SUBSCRIPTION_CODE_REGEX = /^SUB_[A-Za-z0-9]+$/;
export const PAYSTACK_PLAN_CODE_REGEX = /^PLN_[A-Za-z0-9]+$/;
export const PAYSTACK_CUSTOMER_CODE_REGEX = /^CUS_[A-Za-z0-9]+$/;
export const PAYSTACK_AUTHORIZATION_CODE_REGEX = /^AUTH_[A-Za-z0-9]+$/;
export const PAYSTACK_AUTHORIZATION_SIGNATURE_REGEX = /^SIG_[A-Za-z0-9]+$/;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TRANSACTION_ID_REGEX = /^[0-9]{1,20}$/;
export const MAX_UNSIGNED_64_BIT = "18446744073709551615";
export const PAYSTACK_INVOICE_CODE_REGEX = /^INV_[A-Za-z0-9_\-]+$/;
export const PAYSTACK_RECOGNIZED_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "non-renewing",
  "attention",
  "completed",
  "cancelled",
]);
export const WHITESPACE_OR_CONTROL_REGEX = /[\s\x00-\x1F\x7F]/;

type UnknownRecord = Record<string, unknown>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status: number };

export type DecodeResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ServerConfig {
  paystackSecretKey: string;
  paystackEnvironment: "test" | "live";
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export type ServerConfigValidationResult =
  | { success: true; config: ServerConfig }
  | { success: false; error: string };

export interface WebhookEnvelope {
  event: string;
  data: UnknownRecord;
}

export interface VerifiedTransactionData {
  environment: "test" | "live";
  provider_reference: string;
  provider_transaction_id: string;
  amount_minor: number;
  currency: string;
  paid_at: string;
  provider_plan_code: string | null;
  provider_customer_code: string | null;
  customer_email: string | null;
  authorization_code: string | null;
  authorization_signature: string | null;
  card_type: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  bank: string | null;
  channel: string | null;
  reusable: boolean;
}

export interface ProcessPaystackChargeSuccessRpcParams {
  p_environment: "test" | "live";
  p_payload_sha256: string;
  p_provider_reference: string;
  p_provider_transaction_id: string;
  p_amount_minor: number;
  p_currency: string;
  p_paid_at: string;
  p_provider_plan_code: string | null;
  p_provider_customer_code: string | null;
  p_customer_email: string | null;
  p_authorization_code: string | null;
  p_authorization_signature: string | null;
  p_card_type: string | null;
  p_last4: string | null;
  p_exp_month: string | null;
  p_exp_year: string | null;
  p_bank: string | null;
  p_channel: string | null;
  p_reusable: boolean;
}

export interface ProcessPaystackChargeSuccessRpcResult {
  webhook_event_id: string;
  payment_id: string;
  subscription_id: string | null;
  payment_status: string;
  subscription_status: string | null;
  payment_method_id: string | null;
  processing_status: string;
  is_reused: boolean;
}

export interface PaystackSubscriptionCreateEvent {
  environment: "test" | "live";
  providerSubscriptionCode: string;
  providerEventId: null;
}

export interface VerifiedSubscriptionData {
  environment: "test" | "live";
  providerSubscriptionCode: string;
  providerSubscriptionId: string;
  providerCustomerCode: string;
  providerCustomerId: string;
  customerEmail: string;
  providerPlanCode: string;
  amountMinor: number;
  currency: string;
  authorizationCode: string;
  authorizationSignature: string;
  emailToken: string;
  providerStatus: string;
  nextPaymentAt: string | null;
  occurredAt: string;
}

export interface ProcessPaystackSubscriptionCreateRpcParams {
  p_environment: "test" | "live";
  p_payload_sha256: string;
  p_provider_event_id: string | null;
  p_provider_subscription_code: string;
  p_provider_subscription_id: string;
  p_provider_customer_code: string;
  p_provider_customer_id: string;
  p_customer_email: string;
  p_provider_plan_code: string;
  p_amount_minor: number;
  p_currency: string;
  p_authorization_code: string;
  p_authorization_signature: string;
  p_email_token: string;
  p_provider_status: string;
  p_next_payment_at: string | null;
  p_occurred_at: string;
}

export interface ProcessPaystackSubscriptionCreateRpcResult {
  provider_subscription_record_id: string;
  subscription_id: string;
  payment_id: string;
  provider_subscription_code: string;
  provider_status: string;
  is_reused: boolean;
}

export interface PaystackSubscriptionNotRenewEvent {
  environment: "test" | "live";
  providerSubscriptionCode: string;
  providerEventId: null;
}

export interface VerifiedSubscriptionNotRenewData {
  environment: "test" | "live";
  providerSubscriptionCode: string;
  providerSubscriptionId: string;
  providerCustomerCode: string;
  providerStatus: "non-renewing";
  nextPaymentAt: string | null;
  occurredAt: string;
}

export interface ProcessPaystackSubscriptionNotRenewRpcParams {
  p_environment: "test" | "live";
  p_payload_sha256: string;
  p_provider_event_id: string | null;
  p_provider_subscription_code: string;
  p_provider_subscription_id: string;
  p_provider_customer_code: string;
  p_provider_status: string;
  p_next_payment_at: string | null;
  p_occurred_at: string;
}

export interface ProcessPaystackSubscriptionNotRenewRpcResult {
  webhook_event_id: string;
  provider_subscription_record_id: string;
  subscription_id: string;
  provider_subscription_code: string;
  provider_status: string;
  subscription_status: string;
  auto_renew_enabled: boolean;
  is_reused: boolean;
  is_ignored: boolean;
}

export interface PaystackSubscriptionDisableEvent {
  environment: "test" | "live";
  providerSubscriptionCode: string;
  providerEventId: null;
}

export interface VerifiedSubscriptionDisableData {
  environment: "test" | "live";
  providerSubscriptionCode: string;
  providerSubscriptionId: string;
  providerCustomerCode: string;
  providerStatus: "completed" | "cancelled";
  disabledAt: string;
  occurredAt: string;
}

export interface ProcessPaystackSubscriptionDisableRpcParams {
  p_environment: "test" | "live";
  p_payload_sha256: string;
  p_provider_event_id: string | null;
  p_provider_subscription_code: string;
  p_provider_subscription_id: string;
  p_provider_customer_code: string;
  p_provider_status: string;
  p_disabled_at: string;
  p_occurred_at: string;
}

export interface ProcessPaystackSubscriptionDisableRpcResult {
  webhook_event_id: string;
  provider_subscription_record_id: string;
  subscription_id: string;
  provider_subscription_code: string;
  provider_status: string;
  subscription_status: string;
  auto_renew_enabled: boolean;
  is_reused: boolean;
  is_ignored: boolean;
}

export interface WebhookSuccessResponse {
  ok: true;
  received: true;
  processed: boolean;
  is_reused?: boolean;
}

export interface WebhookErrorResponse {
  ok: false;
  error: string;
}

export interface DatabaseErrorLike {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  sqlstate?: unknown;
}

export function isPlainObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && value.length === 36 && UUID_REGEX.test(value);
}

export function isValidProviderReference(value: unknown): value is string {
  return typeof value === "string" && PROVIDER_REFERENCE_REGEX.test(value);
}

export function hasExactKeys(
  record: UnknownRecord,
  keys: readonly string[],
): boolean {
  const recordKeys = Object.keys(record);
  if (recordKeys.length !== keys.length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(record, key));
}

export function validateServerConfig(
  env: Readonly<Record<string, string | undefined>>,
): ServerConfigValidationResult {
  const paystackSecretKey = env.PAYSTACK_SECRET_KEY;
  const paystackEnvironment = env.PAYSTACK_ENVIRONMENT;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    typeof paystackEnvironment !== "string" ||
    (paystackEnvironment !== "test" && paystackEnvironment !== "live")
  ) {
    return {
      success: false,
      error: "PAYSTACK_ENVIRONMENT must be configured as 'test' or 'live'.",
    };
  }

  if (
    typeof paystackSecretKey !== "string" ||
    paystackSecretKey.trim().length === 0 ||
    WHITESPACE_OR_CONTROL_REGEX.test(paystackSecretKey)
  ) {
    return {
      success: false,
      error: "PAYSTACK_SECRET_KEY is missing or contains invalid characters.",
    };
  }

  const expectedKeyPrefix =
    paystackEnvironment === "test" ? "sk_test_" : "sk_live_";
  if (!paystackSecretKey.startsWith(expectedKeyPrefix)) {
    return {
      success: false,
      error: `PAYSTACK_SECRET_KEY does not match the configured environment prefix (${expectedKeyPrefix}).`,
    };
  }

  if (
    typeof supabaseUrl !== "string" ||
    supabaseUrl.trim().length === 0 ||
    WHITESPACE_OR_CONTROL_REGEX.test(supabaseUrl)
  ) {
    return {
      success: false,
      error: "SUPABASE_URL is missing or contains invalid characters.",
    };
  }

  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    return {
      success: false,
      error: "SUPABASE_URL must be a valid URL.",
    };
  }

  const isLocalHttp =
    parsedSupabaseUrl.protocol === "http:" &&
    (parsedSupabaseUrl.hostname === "localhost" ||
      parsedSupabaseUrl.hostname === "127.0.0.1");

  if (
    (parsedSupabaseUrl.protocol !== "https:" && !isLocalHttp) ||
    parsedSupabaseUrl.username !== "" ||
    parsedSupabaseUrl.password !== ""
  ) {
    return {
      success: false,
      error: "SUPABASE_URL must use HTTPS and cannot contain credentials.",
    };
  }

  if (
    typeof supabaseServiceRoleKey !== "string" ||
    supabaseServiceRoleKey.trim().length === 0 ||
    WHITESPACE_OR_CONTROL_REGEX.test(supabaseServiceRoleKey)
  ) {
    return {
      success: false,
      error: "SUPABASE_SERVICE_ROLE_KEY is missing or contains invalid characters.",
    };
  }

  return {
    success: true,
    config: {
      paystackSecretKey,
      paystackEnvironment,
      supabaseUrl: parsedSupabaseUrl.origin,
      supabaseServiceRoleKey,
    },
  };
}

export async function readRawBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  contentLength: string | null,
  maximumBytes = MAX_REQUEST_BYTES,
): Promise<ValidationResult<Uint8Array>> {
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
    return { success: true, data: new Uint8Array(0) };
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
          // Cancellation failure does not override the 413 violation
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

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { success: true, data: result };
}

export function constantTimeCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  let diff = 0;
  for (let i = 0; i < aLower.length; i++) {
    diff |= aLower.charCodeAt(i) ^ bLower.charCodeAt(i);
  }
  return diff === 0;
}

export async function calculateHmacSha512Hex(
  secretKey: string,
  rawBytes: Uint8Array,
): Promise<string> {
  const keyBytes = new TextEncoder().encode(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, rawBytes as unknown as BufferSource);
  const signatureBytes = new Uint8Array(signature);
  return Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function calculateSha256Hex(
  rawBytes: Uint8Array,
): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", rawBytes as unknown as BufferSource);
  const digestBytes = new Uint8Array(digest);
  return Array.from(digestBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPaystackSignature(
  signatureHeader: string | null,
  rawBytes: Uint8Array,
  secretKey: string,
): Promise<boolean> {
  if (typeof signatureHeader !== "string") {
    return false;
  }

  const trimmed = signatureHeader.trim();
  if (!HEX_128_REGEX.test(trimmed)) {
    return false;
  }

  const expectedSignatureHex = await calculateHmacSha512Hex(secretKey, rawBytes);
  return constantTimeCompareHex(trimmed, expectedSignatureHex);
}

export function parseWebhookEnvelope(
  rawBytes: Uint8Array,
): ValidationResult<WebhookEnvelope> {
  if (rawBytes.byteLength === 0) {
    return {
      success: false,
      error: "Webhook request body cannot be empty.",
      status: 400,
    };
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
  } catch {
    return {
      success: false,
      error: "Webhook body must be valid UTF-8.",
      status: 400,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return {
      success: false,
      error: "Malformed JSON in webhook request body.",
      status: 400,
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      success: false,
      error: "Webhook payload must be a JSON object.",
      status: 400,
    };
  }

  const event = parsed.event;
  if (typeof event !== "string" || event.trim().length === 0) {
    return {
      success: false,
      error: "Webhook payload is missing a valid 'event' property.",
      status: 400,
    };
  }

  const data = parsed.data;
  if (data !== undefined && !isPlainObject(data)) {
    return {
      success: false,
      error: "Webhook 'data' must be a JSON object when present.",
      status: 400,
    };
  }

  return {
    success: true,
    data: {
      event: event.trim(),
      data: (data ?? {}) as UnknownRecord,
    },
  };
}

export function validateTransactionId(id: unknown): DecodeResult<string> {
  if (typeof id === "number") {
    if (!Number.isSafeInteger(id) || id < 0) {
      return {
        success: false,
        error: "Unsafe or negative numeric transaction ID.",
      };
    }
    return { success: true, data: String(id) };
  }

  if (typeof id === "string") {
    const trimmed = id.trim();
    if (!TRANSACTION_ID_REGEX.test(trimmed)) {
      return {
        success: false,
        error: "Invalid transaction ID format. Must be 1 to 20 digits.",
      };
    }
    if (trimmed.length === 20 && trimmed > MAX_UNSIGNED_64_BIT) {
      return {
        success: false,
        error: "Transaction ID exceeds unsigned 64-bit limit.",
      };
    }
    return { success: true, data: trimmed };
  }

  return {
    success: false,
    error: "Transaction ID must be a numeric string or safe integer.",
  };
}

export function decodePaystackVerifyResponse(
  json: unknown,
  expectedReference: string,
  expectedEnvironment: "test" | "live",
): DecodeResult<VerifiedTransactionData> {
  if (!isPlainObject(json)) {
    return {
      success: false,
      error: "Paystack verification response must be a JSON object.",
    };
  }

  if (json.status !== true) {
    return {
      success: false,
      error: "Paystack verification response status is not true.",
    };
  }

  const data = json.data;
  if (!isPlainObject(data)) {
    return {
      success: false,
      error: "Paystack verification response is missing a valid data object.",
    };
  }

  // 1. Transaction Status
  if (data.status !== "success") {
    return {
      success: false,
      error: `Verified transaction status is '${String(data.status)}', expected 'success'.`,
    };
  }

  // 2. Reference Matching
  const reference = data.reference;
  if (typeof reference !== "string" || reference !== expectedReference) {
    return {
      success: false,
      error: "Verified transaction reference does not match the webhook reference.",
    };
  }

  // 3. Domain Matching
  const domain = data.domain;
  if (typeof domain !== "string" || domain !== expectedEnvironment) {
    return {
      success: false,
      error: `Verified transaction domain '${String(domain)}' does not match environment '${expectedEnvironment}'.`,
    };
  }

  // 4. Amount Minor
  const amount = data.amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    return {
      success: false,
      error: "Verified transaction amount must be a positive integer.",
    };
  }

  // 5. Currency
  const currency = data.currency;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    return {
      success: false,
      error: "Verified transaction currency must be a 3-letter uppercase code.",
    };
  }

  // 6. Paid At Timestamp
  const rawPaidAt = data.paid_at ?? data.paidAt;
  if (typeof rawPaidAt !== "string" || rawPaidAt.trim().length === 0) {
    return {
      success: false,
      error: "Verified transaction is missing a valid paid_at timestamp.",
    };
  }

  const parsedPaidAt = new Date(rawPaidAt);
  if (Number.isNaN(parsedPaidAt.getTime())) {
    return {
      success: false,
      error: "Verified transaction paid_at timestamp is not a valid date.",
    };
  }
  const paid_at = parsedPaidAt.toISOString();

  // 7. Transaction ID
  const transactionIdResult = validateTransactionId(data.id);
  if ("error" in transactionIdResult) {
    return {
      success: false,
      error: transactionIdResult.error,
    };
  }
  const provider_transaction_id = transactionIdResult.data;

  // 8. Provider Plan Code
  let provider_plan_code: string | null = null;
  if (typeof data.plan === "string" && data.plan.trim().length > 0) {
    const trimmedPlan = data.plan.trim();
    if (!PAYSTACK_PLAN_CODE_REGEX.test(trimmedPlan)) {
      return {
        success: false,
        error: "Verified transaction plan code has invalid format.",
      };
    }
    provider_plan_code = trimmedPlan;
  } else if (isPlainObject(data.plan) && typeof data.plan.plan_code === "string" && data.plan.plan_code.trim().length > 0) {
    const trimmedPlan = data.plan.plan_code.trim();
    if (!PAYSTACK_PLAN_CODE_REGEX.test(trimmedPlan)) {
      return {
        success: false,
        error: "Verified transaction plan_code has invalid format.",
      };
    }
    provider_plan_code = trimmedPlan;
  }

  // 9. Customer Data
  let provider_customer_code: string | null = null;
  let customer_email: string | null = null;
  if (isPlainObject(data.customer)) {
    if (typeof data.customer.customer_code === "string" && data.customer.customer_code.trim().length > 0) {
      const trimmedCustomerCode = data.customer.customer_code.trim();
      if (!PAYSTACK_CUSTOMER_CODE_REGEX.test(trimmedCustomerCode)) {
        return {
          success: false,
          error: "Verified customer code has invalid format.",
        };
      }
      provider_customer_code = trimmedCustomerCode;
    }

    if (typeof data.customer.email === "string" && data.customer.email.trim().length > 0) {
      const trimmedEmail = data.customer.email.trim().toLowerCase();
      if (!trimmedEmail.includes("@") || WHITESPACE_OR_CONTROL_REGEX.test(trimmedEmail)) {
        return {
          success: false,
          error: "Verified customer email is invalid.",
        };
      }
      customer_email = trimmedEmail;
    }
  }

  // 10. Authorization Details
  let authorization_code: string | null = null;
  let card_type: string | null = null;
  let last4: string | null = null;
  let exp_month: string | null = null;
  let exp_year: string | null = null;
  let bank: string | null = null;
  let channel: string | null = null;
  let reusable = false;

  if (isPlainObject(data.authorization)) {
    const auth = data.authorization;

    if (typeof auth.authorization_code === "string" && auth.authorization_code.trim().length > 0) {
      authorization_code = auth.authorization_code.trim();
    }

    if (typeof auth.card_type === "string" && auth.card_type.trim().length > 0) {
      card_type = auth.card_type.trim();
    }

    if (typeof auth.last4 === "string" && /^[0-9]{4}$/.test(auth.last4.trim())) {
      last4 = auth.last4.trim();
    }

    if (typeof auth.exp_month === "string" && /^(0[1-9]|1[0-2]|[1-9])$/.test(auth.exp_month.trim())) {
      exp_month = auth.exp_month.trim().padStart(2, "0");
    } else if (typeof auth.exp_month === "number" && Number.isSafeInteger(auth.exp_month) && auth.exp_month >= 1 && auth.exp_month <= 12) {
      exp_month = String(auth.exp_month).padStart(2, "0");
    }

    if (typeof auth.exp_year === "string" && /^[0-9]{2,4}$/.test(auth.exp_year.trim())) {
      exp_year = auth.exp_year.trim();
    } else if (typeof auth.exp_year === "number" && Number.isSafeInteger(auth.exp_year) && auth.exp_year > 0) {
      exp_year = String(auth.exp_year);
    }

    if (typeof auth.bank === "string" && auth.bank.trim().length > 0) {
      bank = auth.bank.trim();
    }

    if (typeof auth.channel === "string" && auth.channel.trim().length > 0) {
      channel = auth.channel.trim();
    }

    reusable = auth.reusable === true;
  }

  // Also check top-level channel if authorization.channel not set
  if (channel === null && typeof data.channel === "string" && data.channel.trim().length > 0) {
    channel = data.channel.trim();
  }

  return {
    success: true,
    data: {
      environment: expectedEnvironment,
      provider_reference: reference,
      provider_transaction_id,
      amount_minor: amount,
      currency,
      paid_at,
      provider_plan_code,
      provider_customer_code,
      customer_email,
      authorization_code,
      authorization_signature: isPlainObject(data.authorization) && typeof data.authorization.signature === "string" ? data.authorization.signature : null,
      card_type,
      last4,
      exp_month,
      exp_year,
      bank,
      channel,
      reusable,
    },
  };
}

const PROCESS_CHARGE_SUCCESS_KEYS = [
  "webhook_event_id",
  "payment_id",
  "subscription_id",
  "payment_status",
  "subscription_status",
  "payment_method_id",
  "processing_status",
  "is_reused",
] as const;

export function decodeProcessChargeSuccessRpcResult(
  data: unknown,
): DecodeResult<ProcessPaystackChargeSuccessRpcResult> {
  if (!Array.isArray(data) || data.length !== 1 || !isPlainObject(data[0])) {
    return {
      success: false,
      error: "RPC must return exactly one object row.",
    };
  }

  const row = data[0];
  if (!hasExactKeys(row, PROCESS_CHARGE_SUCCESS_KEYS)) {
    return {
      success: false,
      error: "RPC return row does not match the expected column contract.",
    };
  }

  if (!isValidUuid(row.webhook_event_id)) {
    return {
      success: false,
      error: "Invalid webhook_event_id UUID returned by RPC.",
    };
  }

  if (!isValidUuid(row.payment_id)) {
    return {
      success: false,
      error: "Invalid payment_id UUID returned by RPC.",
    };
  }

  if (row.subscription_id !== null && !isValidUuid(row.subscription_id)) {
    return {
      success: false,
      error: "Invalid subscription_id UUID returned by RPC.",
    };
  }

  if (typeof row.payment_status !== "string" || row.payment_status !== "succeeded") {
    return {
      success: false,
      error: `Unexpected payment_status '${String(row.payment_status)}' returned by RPC.`,
    };
  }

  if (row.subscription_status !== null && typeof row.subscription_status !== "string") {
    return {
      success: false,
      error: "Invalid subscription_status returned by RPC.",
    };
  }

  if (row.payment_method_id !== null && !isValidUuid(row.payment_method_id)) {
    return {
      success: false,
      error: "Invalid payment_method_id UUID returned by RPC.",
    };
  }

  if (typeof row.processing_status !== "string" || row.processing_status !== "processed") {
    return {
      success: false,
      error: `Unexpected processing_status '${String(row.processing_status)}' returned by RPC.`,
    };
  }

  if (typeof row.is_reused !== "boolean") {
    return {
      success: false,
      error: "Invalid is_reused boolean returned by RPC.",
    };
  }

  return {
    success: true,
    data: {
      webhook_event_id: row.webhook_event_id as string,
      payment_id: row.payment_id as string,
      subscription_id: row.subscription_id as string | null,
      payment_status: row.payment_status as string,
      subscription_status: row.subscription_status as string | null,
      payment_method_id: row.payment_method_id as string | null,
      processing_status: row.processing_status as string,
      is_reused: row.is_reused as boolean,
    },
  };
}

const PROCESS_SUBSCRIPTION_CREATE_KEYS = [
  "provider_subscription_record_id",
  "subscription_id",
  "payment_id",
  "provider_subscription_code",
  "provider_status",
  "is_reused",
] as const;

export function decodeProcessPaystackSubscriptionCreateRpcResult(
  data: unknown,
): DecodeResult<ProcessPaystackSubscriptionCreateRpcResult> {
  if (!Array.isArray(data) || data.length !== 1 || !isPlainObject(data[0])) {
    return {
      success: false,
      error: "RPC must return exactly one object row.",
    };
  }

  const row = data[0];
  if (!hasExactKeys(row, PROCESS_SUBSCRIPTION_CREATE_KEYS)) {
    return {
      success: false,
      error: "RPC return row does not match the expected column contract.",
    };
  }

  if (!isValidUuid(row.provider_subscription_record_id)) {
    return {
      success: false,
      error: "Invalid provider_subscription_record_id UUID returned by RPC.",
    };
  }

  if (!isValidUuid(row.subscription_id)) {
    return {
      success: false,
      error: "Invalid subscription_id UUID returned by RPC.",
    };
  }

  if (!isValidUuid(row.payment_id)) {
    return {
      success: false,
      error: "Invalid payment_id UUID returned by RPC.",
    };
  }

  if (
    typeof row.provider_subscription_code !== "string" ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(row.provider_subscription_code)
  ) {
    return {
      success: false,
      error: "Invalid provider_subscription_code returned by RPC.",
    };
  }

  if (row.provider_status !== "active" && row.provider_status !== "non-renewing") {
    return {
      success: false,
      error: `Unexpected provider_status '${String(row.provider_status)}' returned by RPC.`,
    };
  }

  if (typeof row.is_reused !== "boolean") {
    return {
      success: false,
      error: "Invalid is_reused boolean returned by RPC.",
    };
  }

  return {
    success: true,
    data: {
      provider_subscription_record_id: row.provider_subscription_record_id as string,
      subscription_id: row.subscription_id as string,
      payment_id: row.payment_id as string,
      provider_subscription_code: row.provider_subscription_code as string,
      provider_status: row.provider_status as string,
      is_reused: row.is_reused as boolean,
    },
  };
}

const PROCESS_SUBSCRIPTION_NOT_RENEW_KEYS = [
  "webhook_event_id",
  "provider_subscription_record_id",
  "subscription_id",
  "provider_subscription_code",
  "provider_status",
  "subscription_status",
  "auto_renew_enabled",
  "is_reused",
  "is_ignored",
] as const;

export const PROCESS_SUBSCRIPTION_DISABLE_KEYS = [
  "webhook_event_id",
  "provider_subscription_record_id",
  "subscription_id",
  "provider_subscription_code",
  "provider_status",
  "subscription_status",
  "auto_renew_enabled",
  "is_reused",
  "is_ignored",
] as const;

export const CANONICAL_SUBSCRIPTION_STATUSES = new Set([
  "pending_activation",
  "trialing",
  "active",
  "non_renewing",
  "past_due",
  "expired",
  "cancelled",
]);

export function decodeProcessPaystackSubscriptionDisableRpcResult(
  data: unknown,
): DecodeResult<ProcessPaystackSubscriptionDisableRpcResult> {
  if (!Array.isArray(data) || data.length !== 1 || !isPlainObject(data[0])) {
    return {
      success: false,
      error: "RPC must return exactly one object row.",
    };
  }

  const row = data[0];
  if (!hasExactKeys(row, PROCESS_SUBSCRIPTION_DISABLE_KEYS)) {
    return {
      success: false,
      error: "RPC return row does not match the expected column contract.",
    };
  }

  if (!isValidUuid(row.webhook_event_id)) {
    return {
      success: false,
      error: "Invalid webhook_event_id UUID returned by RPC.",
    };
  }

  if (!isValidUuid(row.provider_subscription_record_id)) {
    return {
      success: false,
      error: "Invalid provider_subscription_record_id UUID returned by RPC.",
    };
  }

  if (!isValidUuid(row.subscription_id)) {
    return {
      success: false,
      error: "Invalid subscription_id UUID returned by RPC.",
    };
  }

  if (
    typeof row.provider_subscription_code !== "string" ||
    row.provider_subscription_code.trim() !== row.provider_subscription_code ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(row.provider_subscription_code)
  ) {
    return {
      success: false,
      error: "Invalid provider_subscription_code returned by RPC.",
    };
  }

  if (
    typeof row.provider_status !== "string" ||
    row.provider_status.trim() !== row.provider_status ||
    row.provider_status.length === 0 ||
    row.provider_status.length > 50 ||
    WHITESPACE_OR_CONTROL_REGEX.test(row.provider_status)
  ) {
    return {
      success: false,
      error: "Invalid provider_status returned by RPC.",
    };
  }

  if (
    typeof row.subscription_status !== "string" ||
    !CANONICAL_SUBSCRIPTION_STATUSES.has(row.subscription_status)
  ) {
    return {
      success: false,
      error: "Invalid subscription_status returned by RPC.",
    };
  }

  if (typeof row.auto_renew_enabled !== "boolean") {
    return {
      success: false,
      error: "Invalid auto_renew_enabled boolean returned by RPC.",
    };
  }

  if (typeof row.is_reused !== "boolean") {
    return {
      success: false,
      error: "Invalid is_reused boolean returned by RPC.",
    };
  }

  if (typeof row.is_ignored !== "boolean") {
    return {
      success: false,
      error: "Invalid is_ignored boolean returned by RPC.",
    };
  }

  // Consistency checks for new, non-reused results
  if (!row.is_reused) {
    if (!row.is_ignored) {
      const isCompletedValid =
        row.provider_status === "completed" &&
        row.subscription_status === "expired" &&
        row.auto_renew_enabled === false;
      const isCancelledValid =
        row.provider_status === "cancelled" &&
        row.subscription_status === "cancelled" &&
        row.auto_renew_enabled === false;

      if (!isCompletedValid && !isCancelledValid) {
        return {
          success: false,
          error:
            "Inconsistent non-reused RPC result: provider_status must be 'completed' with 'expired' and auto_renew_enabled=false, or 'cancelled' with 'cancelled' and auto_renew_enabled=false.",
        };
      }
    } else {
      const isCompletedIgnoredValid =
        row.provider_status === "completed" &&
        row.subscription_status === "expired" &&
        row.auto_renew_enabled === false;
      const isCancelledIgnoredValid =
        row.provider_status === "cancelled" &&
        row.subscription_status === "cancelled" &&
        row.auto_renew_enabled === false;

      if (!isCompletedIgnoredValid && !isCancelledIgnoredValid) {
        return {
          success: false,
          error:
            "Inconsistent ignored RPC result: must be same-outcome terminal combination ('completed' with 'expired' or 'cancelled' with 'cancelled') and auto_renew_enabled=false.",
        };
      }
    }
  }

  return {
    success: true,
    data: {
      webhook_event_id: row.webhook_event_id as string,
      provider_subscription_record_id: row.provider_subscription_record_id as string,
      subscription_id: row.subscription_id as string,
      provider_subscription_code: row.provider_subscription_code as string,
      provider_status: row.provider_status as string,
      subscription_status: row.subscription_status as string,
      auto_renew_enabled: row.auto_renew_enabled as boolean,
      is_reused: row.is_reused as boolean,
      is_ignored: row.is_ignored as boolean,
    },
  };
}

export function decodeProcessPaystackSubscriptionNotRenewRpcResult(
  data: unknown,
): DecodeResult<ProcessPaystackSubscriptionNotRenewRpcResult> {
  if (!Array.isArray(data) || data.length !== 1 || !isPlainObject(data[0])) {
    return {
      success: false,
      error: "RPC must return exactly one object row.",
    };
  }

  const row = data[0];
  if (!hasExactKeys(row, PROCESS_SUBSCRIPTION_NOT_RENEW_KEYS)) {
    return {
      success: false,
      error: "RPC return row does not match the expected column contract.",
    };
  }

  if (!isValidUuid(row.webhook_event_id)) {
    return {
      success: false,
      error: "Invalid webhook_event_id UUID returned by RPC.",
    };
  }

  if (!isValidUuid(row.provider_subscription_record_id)) {
    return {
      success: false,
      error: "Invalid provider_subscription_record_id UUID returned by RPC.",
    };
  }

  if (!isValidUuid(row.subscription_id)) {
    return {
      success: false,
      error: "Invalid subscription_id UUID returned by RPC.",
    };
  }

  if (
    typeof row.provider_subscription_code !== "string" ||
    row.provider_subscription_code.trim() !== row.provider_subscription_code ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(row.provider_subscription_code)
  ) {
    return {
      success: false,
      error: "Invalid provider_subscription_code returned by RPC.",
    };
  }

  if (
    typeof row.provider_status !== "string" ||
    row.provider_status.trim() !== row.provider_status ||
    row.provider_status.length === 0 ||
    row.provider_status.length > 50 ||
    WHITESPACE_OR_CONTROL_REGEX.test(row.provider_status)
  ) {
    return {
      success: false,
      error: "Invalid provider_status returned by RPC.",
    };
  }

  if (
    typeof row.subscription_status !== "string" ||
    !CANONICAL_SUBSCRIPTION_STATUSES.has(row.subscription_status)
  ) {
    return {
      success: false,
      error: "Invalid subscription_status returned by RPC.",
    };
  }

  if (typeof row.auto_renew_enabled !== "boolean") {
    return {
      success: false,
      error: "Invalid auto_renew_enabled boolean returned by RPC.",
    };
  }

  if (typeof row.is_reused !== "boolean") {
    return {
      success: false,
      error: "Invalid is_reused boolean returned by RPC.",
    };
  }

  if (typeof row.is_ignored !== "boolean") {
    return {
      success: false,
      error: "Invalid is_ignored boolean returned by RPC.",
    };
  }

  // Consistency checks for new, non-reused results
  if (!row.is_reused) {
    if (!row.is_ignored) {
      if (
        row.provider_status !== "non-renewing" ||
        (row.subscription_status !== "non_renewing" && row.subscription_status !== "past_due") ||
        row.auto_renew_enabled !== false
      ) {
        return {
          success: false,
          error: "Inconsistent non-reused RPC result: provider_status must be 'non-renewing', subscription_status must be 'non_renewing' or 'past_due', and auto_renew_enabled must be false.",
        };
      }
    } else {
      if (
        row.subscription_status !== "expired" &&
        row.subscription_status !== "cancelled"
      ) {
        return {
          success: false,
          error: "Inconsistent ignored RPC result: subscription_status must be 'expired' or 'cancelled'.",
        };
      }
    }
  }

  return {
    success: true,
    data: {
      webhook_event_id: row.webhook_event_id as string,
      provider_subscription_record_id: row.provider_subscription_record_id as string,
      subscription_id: row.subscription_id as string,
      provider_subscription_code: row.provider_subscription_code as string,
      provider_status: row.provider_status as string,
      subscription_status: row.subscription_status as string,
      auto_renew_enabled: row.auto_renew_enabled as boolean,
      is_reused: row.is_reused as boolean,
      is_ignored: row.is_ignored as boolean,
    },
  };
}

export function sanitizeSubscriptionDisableDatabaseError(error: unknown): {
  status: number;
  message: string;
  code: string;
  headers?: Record<string, string>;
} {
  if (!isPlainObject(error)) {
    return {
      status: 500,
      message: "Internal server error.",
      code: "PAYSTACK_INTERNAL_ERROR",
    };
  }

  let code: string | undefined;
  if (typeof error.code === "string" && error.code.length > 0) {
    code = error.code;
  } else if (typeof error.sqlstate === "string" && error.sqlstate.length > 0) {
    code = error.sqlstate;
  }

  // Missing prerequisite (P0002) - Subscription not found or environment mismatch
  if (code === "P0002") {
    return {
      status: 503,
      message: "Subscription prerequisite is pending. Please retry later.",
      code: "PAYSTACK_SUBSCRIPTION_PREREQUISITE_PENDING",
      headers: { "Retry-After": "60" },
    };
  }

  // Unique constraint / collision violation (23505)
  if (code === "23505") {
    return {
      status: 409,
      message: "Subscription identifier or payload collision.",
      code: "PAYSTACK_SUBSCRIPTION_CONFLICT",
    };
  }

  // Commercial / lifecycle mismatch (23514, 22023, 22004, 22000)
  if (
    code === "23514" ||
    code === "22023" ||
    code === "22004" ||
    code === "22000"
  ) {
    return {
      status: 409,
      message: "Subscription lifecycle or constraint conflict.",
      code: "PAYSTACK_SUBSCRIPTION_MISMATCH",
    };
  }

  // Transient database errors (retryable) (53300, 40001, 40P01, 57P01, 08006, 08001)
  if (
    code === "53300" || // too_many_connections
    code === "40001" || // serialization_failure
    code === "40P01" || // deadlock_detected
    code === "57P01" || // admin_shutdown
    code === "08006" || // connection_failure
    code === "08001"
  ) {
    return {
      status: 503,
      message: "Transient database failure.",
      code: "PAYSTACK_DATABASE_UNAVAILABLE",
    };
  }

  return {
    status: 500,
    message: "Internal server error.",
    code: "PAYSTACK_INTERNAL_ERROR",
  };
}

export function sanitizeSubscriptionNotRenewDatabaseError(error: unknown): {
  status: number;
  message: string;
  code: string;
  headers?: Record<string, string>;
} {
  if (!isPlainObject(error)) {
    return {
      status: 500,
      message: "Internal server error.",
      code: "PAYSTACK_INTERNAL_ERROR",
    };
  }

  let code: string | undefined;
  if (typeof error.code === "string" && error.code.length > 0) {
    code = error.code;
  } else if (typeof error.sqlstate === "string" && error.sqlstate.length > 0) {
    code = error.sqlstate;
  }

  // Missing prerequisite (P0002) - Subscription not found or environment mismatch
  if (code === "P0002") {
    return {
      status: 503,
      message: "Subscription prerequisite is pending. Please retry later.",
      code: "PAYSTACK_SUBSCRIPTION_PREREQUISITE_PENDING",
      headers: { "Retry-After": "60" },
    };
  }

  // Unique constraint / collision violation (23505)
  if (code === "23505") {
    return {
      status: 409,
      message: "Subscription identifier or payload collision.",
      code: "PAYSTACK_SUBSCRIPTION_CONFLICT",
    };
  }

  // Commercial / lifecycle mismatch (23514, 22023, 22004, 22000)
  if (
    code === "23514" ||
    code === "22023" ||
    code === "22004" ||
    code === "22000"
  ) {
    return {
      status: 409,
      message: "Subscription lifecycle or constraint conflict.",
      code: "PAYSTACK_SUBSCRIPTION_MISMATCH",
    };
  }

  // Transient database errors (retryable) (53300, 40001, 40P01, 57P01, 08006, 08001)
  if (
    code === "53300" ||
    code === "40001" ||
    code === "40P01" ||
    code === "57P01" ||
    code === "08006" ||
    code === "08001"
  ) {
    return {
      status: 503,
      message: "Transient database failure.",
      code: "PAYSTACK_DATABASE_UNAVAILABLE",
    };
  }

  return {
    status: 500,
    message: "Internal server error.",
    code: "PAYSTACK_INTERNAL_ERROR",
  };
}

export function sanitizeSubscriptionDatabaseError(error: unknown): {
  status: number;
  message: string;
  code: string;
  headers?: Record<string, string>;
} {
  if (!isPlainObject(error)) {
    return {
      status: 500,
      message: "Internal server error.",
      code: "PAYSTACK_INTERNAL_ERROR",
    };
  }

  let code: string | undefined;
  if (typeof error.code === "string" && error.code.length > 0) {
    code = error.code;
  } else if (typeof error.sqlstate === "string" && error.sqlstate.length > 0) {
    code = error.sqlstate;
  }

  // Missing prerequisite (P0002) - Activation payment / payment method not yet ready
  if (code === "P0002") {
    return {
      status: 503,
      message: "Activation payment prerequisite is pending. Please retry later.",
      code: "PAYSTACK_SUBSCRIPTION_PREREQUISITE_PENDING",
      headers: { "Retry-After": "60" },
    };
  }

  // Unique constraint / collision violation (23505)
  if (code === "23505") {
    return {
      status: 409,
      message: "Subscription identifier or payload collision.",
      code: "PAYSTACK_SUBSCRIPTION_CONFLICT",
    };
  }

  // Commercial / contract mismatch (23514, 22023, 22004, 22000)
  if (
    code === "23514" ||
    code === "22023" ||
    code === "22004" ||
    code === "22000"
  ) {
    return {
      status: 409,
      message: "Subscription commercial or constraint conflict.",
      code: "PAYSTACK_SUBSCRIPTION_MISMATCH",
    };
  }

  // Transient database errors (retryable) (53300, 40001, 40P01, 57P01, 08006, 08001)
  if (
    code === "53300" || // too_many_connections
    code === "40001" || // serialization_failure
    code === "40P01" || // deadlock_detected
    code === "57P01" || // admin_shutdown
    code === "08006" || // connection_failure
    code === "08001"
  ) {
    return {
      status: 503,
      message: "Transient database failure.",
      code: "PAYSTACK_DATABASE_UNAVAILABLE",
    };
  }

  return {
    status: 500,
    message: "Internal server error.",
    code: "PAYSTACK_INTERNAL_ERROR",
  };
}

export function sanitizeDatabaseError(error: unknown): {
  status: number;
  message: string;
} {
  if (!isPlainObject(error)) {
    return { status: 500, message: "Internal server error." };
  }

  const code = String(error.code ?? error.sqlstate ?? "");
  const msg = String(error.message ?? "");

  // Commercial snapshot or state-machine violation
  if (
    code === "23514" ||
    code === "22023" ||
    code === "22004" ||
    code === "22000" ||
    code === "P0002" ||
    msg.includes("Commercial snapshot mismatch") ||
    msg.includes("not found")
  ) {
    return {
      status: 409,
      message: "Commercial or reconciliation conflict.",
    };
  }

  // Unique constraint / collision violation
  if (code === "23505") {
    return {
      status: 409,
      message: "Payload hash or identifier collision.",
    };
  }

  // Transient database errors (retryable)
  if (
    code === "53300" || // too_many_connections
    code === "40001" || // serialization_failure
    code === "40P01" || // deadlock_detected
    code === "57P01" || // admin_shutdown
    code === "08006" || // connection_failure
    code === "08001"
  ) {
    return {
      status: 503,
      message: "Transient database failure.",
    };
  }

  return {
    status: 500,
    message: "Internal server error.",
  };
}

export function validateProviderId(id: unknown): DecodeResult<string> {
  if (typeof id === "number") {
    if (!Number.isSafeInteger(id) || id <= 0) {
      return {
        success: false,
        error: "Provider ID must be a positive safe integer.",
      };
    }
    return { success: true, data: String(id) };
  }

  if (typeof id === "string") {
    if (id.trim() !== id || !/^[1-9][0-9]{0,19}$/.test(id)) {
      return {
        success: false,
        error: "Provider ID must be a positive decimal identifier string.",
      };
    }
    if (id.length === 20 && id > MAX_UNSIGNED_64_BIT) {
      return {
        success: false,
        error: "Provider ID exceeds unsigned 64-bit limit.",
      };
    }
    return { success: true, data: id };
  }

  return {
    success: false,
    error: "Provider ID must be a numeric string or safe integer.",
  };
}

export function decodePaystackSubscriptionCreateEvent(
  payload: unknown,
): DecodeResult<PaystackSubscriptionCreateEvent> {
  if (!isPlainObject(payload)) {
    return {
      success: false,
      error: "Webhook payload must be a JSON object.",
    };
  }

  if (payload.event !== "subscription.create") {
    return {
      success: false,
      error: "Webhook event must be 'subscription.create'.",
    };
  }

  const data = payload.data;
  if (!isPlainObject(data)) {
    return {
      success: false,
      error: "Webhook payload is missing a valid data object.",
    };
  }

  const domain = data.domain;
  if (
    typeof domain !== "string" ||
    domain.trim() !== domain ||
    (domain !== "test" && domain !== "live")
  ) {
    return {
      success: false,
      error: "Webhook domain must be exactly 'test' or 'live'.",
    };
  }

  const subscriptionCode = data.subscription_code;
  if (
    typeof subscriptionCode !== "string" ||
    subscriptionCode.trim() !== subscriptionCode ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(subscriptionCode)
  ) {
    return {
      success: false,
      error: "Webhook subscription code must be a valid SUB_ identifier.",
    };
  }

  return {
    success: true,
    data: {
      environment: domain,
      providerSubscriptionCode: subscriptionCode,
      providerEventId: null,
    },
  };
}

export function validatePaystackSubscriptionResponse(
  json: unknown,
  expectedSubscriptionCode: string,
  expectedEnvironment: "test" | "live",
): DecodeResult<VerifiedSubscriptionData> {
  if (!isPlainObject(json)) {
    return {
      success: false,
      error: "Paystack subscription response must be a JSON object.",
    };
  }

  if (json.status !== true) {
    return {
      success: false,
      error: "Paystack subscription response status is not true.",
    };
  }

  const data = json.data;
  if (!isPlainObject(data)) {
    return {
      success: false,
      error: "Paystack subscription response is missing a valid data object.",
    };
  }

  // 1. Subscription Code Matching & Format
  const subCode = data.subscription_code;
  if (
    typeof subCode !== "string" ||
    subCode.trim() !== subCode ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(subCode)
  ) {
    return {
      success: false,
      error: "Verified subscription code must be a valid SUB_ identifier.",
    };
  }

  if (subCode !== expectedSubscriptionCode) {
    return {
      success: false,
      error: "Verified subscription code does not match the webhook subscription code.",
    };
  }

  // 2. Domain / Environment Matching
  const domain = data.domain;
  if (
    typeof domain !== "string" ||
    domain.trim() !== domain ||
    (domain !== "test" && domain !== "live")
  ) {
    return {
      success: false,
      error: "Verified subscription domain must be exactly 'test' or 'live'.",
    };
  }

  if (domain !== expectedEnvironment) {
    return {
      success: false,
      error: "Verified subscription domain does not match expected environment.",
    };
  }

  // A delayed creation delivery may be verified after cancellation. Preserve
  // that verified non-renewing state when linking; do not reactivate it.
  const status = data.status;
  if (status !== "active" && status !== "non-renewing") {
    return {
      success: false,
      error: "Paystack subscription status must be 'active' or 'non-renewing'.",
    };
  }

  // 4. Provider Subscription ID
  const subIdResult = validateProviderId(data.id);
  if (!subIdResult.success) {
    return {
      success: false,
      error: "Invalid provider subscription id.",
    };
  }

  // 5. Customer Object & Fields
  if (!isPlainObject(data.customer)) {
    return {
      success: false,
      error: "Paystack subscription response is missing a valid customer object.",
    };
  }

  const customerCode = data.customer.customer_code;
  if (
    typeof customerCode !== "string" ||
    customerCode.trim() !== customerCode ||
    !PAYSTACK_CUSTOMER_CODE_REGEX.test(customerCode)
  ) {
    return {
      success: false,
      error: "Invalid customer code format.",
    };
  }

  const customerIdResult = validateProviderId(data.customer.id);
  if (!customerIdResult.success) {
    return {
      success: false,
      error: "Invalid provider customer id.",
    };
  }

  const email = data.customer.email;
  if (
    typeof email !== "string" ||
    email.trim() !== email ||
    email.length === 0 ||
    email.length > 255 ||
    !email.includes("@") ||
    email.startsWith("@") ||
    email.endsWith("@") ||
    WHITESPACE_OR_CONTROL_REGEX.test(email)
  ) {
    return {
      success: false,
      error: "Verified customer email is invalid.",
    };
  }

  // 6. Plan Object & Fields
  if (!isPlainObject(data.plan)) {
    return {
      success: false,
      error: "Paystack subscription response is missing a valid plan object.",
    };
  }

  const planCode = data.plan.plan_code;
  if (
    typeof planCode !== "string" ||
    planCode.trim() !== planCode ||
    !PAYSTACK_PLAN_CODE_REGEX.test(planCode)
  ) {
    return {
      success: false,
      error: "Invalid plan code format.",
    };
  }

  const currency = data.plan.currency;
  if (
    typeof currency !== "string" ||
    currency.trim() !== currency ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    return {
      success: false,
      error: "Invalid plan currency format. Must be a 3-letter uppercase code.",
    };
  }

  const planAmount = data.plan.amount;
  if (
    typeof planAmount !== "number" ||
    !Number.isSafeInteger(planAmount) ||
    planAmount <= 0
  ) {
    return {
      success: false,
      error: "Plan amount must be a positive safe integer.",
    };
  }

  const topLevelAmount = data.amount;
  if (
    typeof topLevelAmount !== "number" ||
    !Number.isSafeInteger(topLevelAmount) ||
    topLevelAmount <= 0
  ) {
    return {
      success: false,
      error: "Subscription amount must be a positive safe integer.",
    };
  }

  if (topLevelAmount !== planAmount) {
    return {
      success: false,
      error: "Subscription amount does not match plan amount.",
    };
  }

  // 7. Authorization Object & Fields
  if (!isPlainObject(data.authorization)) {
    return {
      success: false,
      error: "Paystack subscription response is missing a valid authorization object.",
    };
  }

  const authCode = data.authorization.authorization_code;
  if (
    typeof authCode !== "string" ||
    authCode.trim() !== authCode ||
    !PAYSTACK_AUTHORIZATION_CODE_REGEX.test(authCode)
  ) {
    return {
      success: false,
      error: "Verified authorization code has invalid format.",
    };
  }

  const authSig = data.authorization.signature;
  if (
    typeof authSig !== "string" ||
    authSig.trim() !== authSig ||
    !PAYSTACK_AUTHORIZATION_SIGNATURE_REGEX.test(authSig)
  ) {
    return {
      success: false,
      error: "Verified authorization signature has invalid format.",
    };
  }

  // 8. Email Token
  const emailToken = data.email_token;
  if (
    typeof emailToken !== "string" ||
    emailToken.trim() !== emailToken ||
    emailToken.length === 0 ||
    emailToken.length > 255 ||
    WHITESPACE_OR_CONTROL_REGEX.test(emailToken)
  ) {
    return {
      success: false,
      error: "Verified email token is missing or invalid.",
    };
  }

  // 9. Next Payment Date (Nullable)
  let nextPaymentAt: string | null = null;
  const rawNextPaymentDate = data.next_payment_date;
  if (rawNextPaymentDate !== null && rawNextPaymentDate !== undefined) {
    if (
      typeof rawNextPaymentDate !== "string" ||
      rawNextPaymentDate.trim() !== rawNextPaymentDate ||
      rawNextPaymentDate.length === 0
    ) {
      return {
        success: false,
        error: "Verified next_payment_date timestamp is invalid.",
      };
    }
    const parsedNext = new Date(rawNextPaymentDate);
    if (Number.isNaN(parsedNext.getTime())) {
      return {
        success: false,
        error: "Verified next_payment_date timestamp is not a valid date.",
      };
    }
    nextPaymentAt = parsedNext.toISOString();
  }

  // 10. Creation Timestamp (createdAt and/or created_at)
  const rawCreatedAt = data.createdAt;
  const rawCreatedAtSnake = data.created_at;

  if (rawCreatedAt === undefined && rawCreatedAtSnake === undefined) {
    return {
      success: false,
      error: "Verified subscription is missing createdAt/created_at timestamp.",
    };
  }

  let occurredAt: string;
  if (rawCreatedAt !== undefined && rawCreatedAtSnake !== undefined) {
    if (
      typeof rawCreatedAt !== "string" ||
      rawCreatedAt.trim() !== rawCreatedAt ||
      typeof rawCreatedAtSnake !== "string" ||
      rawCreatedAtSnake.trim() !== rawCreatedAtSnake
    ) {
      return {
        success: false,
        error: "Verified subscription createdAt timestamps must be valid strings.",
      };
    }
    const parsed1 = new Date(rawCreatedAt);
    const parsed2 = new Date(rawCreatedAtSnake);
    if (Number.isNaN(parsed1.getTime()) || Number.isNaN(parsed2.getTime())) {
      return {
        success: false,
        error: "Verified subscription createdAt timestamp is not a valid date.",
      };
    }
    if (parsed1.getTime() !== parsed2.getTime()) {
      return {
        success: false,
        error: "Conflicting createdAt and created_at timestamps in subscription response.",
      };
    }
    occurredAt = parsed1.toISOString();
  } else {
    const single = rawCreatedAt ?? rawCreatedAtSnake;
    if (
      typeof single !== "string" ||
      single.trim() !== single ||
      single.length === 0
    ) {
      return {
        success: false,
        error: "Verified subscription createdAt timestamp must be a valid string.",
      };
    }
    const parsed = new Date(single);
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        error: "Verified subscription createdAt timestamp is not a valid date.",
      };
    }
    occurredAt = parsed.toISOString();
  }

  return {
    success: true,
    data: {
      environment: expectedEnvironment,
      providerSubscriptionCode: subCode,
      providerSubscriptionId: subIdResult.data,
      providerCustomerCode: customerCode,
      providerCustomerId: customerIdResult.data,
      customerEmail: email,
      providerPlanCode: planCode,
      amountMinor: topLevelAmount,
      currency: currency,
      authorizationCode: authCode,
      authorizationSignature: authSig,
      emailToken: emailToken,
      providerStatus: status,
      nextPaymentAt: nextPaymentAt,
      occurredAt: occurredAt,
    },
  };
}

export function decodePaystackSubscriptionNotRenewEvent(
  payload: unknown,
): DecodeResult<PaystackSubscriptionNotRenewEvent> {
  if (!isPlainObject(payload)) {
    return {
      success: false,
      error: "Webhook payload must be a JSON object.",
    };
  }

  if (payload.event !== "subscription.not_renew") {
    return {
      success: false,
      error: "Webhook event must be 'subscription.not_renew'.",
    };
  }

  const data = payload.data;
  if (!isPlainObject(data)) {
    return {
      success: false,
      error: "Webhook payload is missing a valid data object.",
    };
  }

  const domain = data.domain;
  if (
    typeof domain !== "string" ||
    domain.trim() !== domain ||
    (domain !== "test" && domain !== "live")
  ) {
    return {
      success: false,
      error: "Webhook domain must be exactly 'test' or 'live'.",
    };
  }

  const subscriptionCode = data.subscription_code;
  if (
    typeof subscriptionCode !== "string" ||
    subscriptionCode.trim() !== subscriptionCode ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(subscriptionCode)
  ) {
    return {
      success: false,
      error: "Webhook subscription code must be a valid SUB_ identifier.",
    };
  }

  const status = data.status;
  if (typeof status !== "string" || status !== "non-renewing") {
    return {
      success: false,
      error: "Webhook status must be 'non-renewing'.",
    };
  }

  return {
    success: true,
    data: {
      environment: domain,
      providerSubscriptionCode: subscriptionCode,
      providerEventId: null,
    },
  };
}

export function validatePaystackSubscriptionNotRenewResponse(
  json: unknown,
  expectedSubscriptionCode: string,
  expectedEnvironment: "test" | "live",
  verifiedAt?: string,
): DecodeResult<VerifiedSubscriptionNotRenewData> {
  if (!isPlainObject(json)) {
    return {
      success: false,
      error: "Paystack subscription response must be a JSON object.",
    };
  }

  if (json.status !== true) {
    return {
      success: false,
      error: "Paystack subscription response status is not true.",
    };
  }

  const data = json.data;
  if (!isPlainObject(data)) {
    return {
      success: false,
      error: "Paystack subscription response is missing a valid data object.",
    };
  }

  // 1. Subscription Code Matching & Format
  const subCode = data.subscription_code;
  if (
    typeof subCode !== "string" ||
    subCode.trim() !== subCode ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(subCode)
  ) {
    return {
      success: false,
      error: "Verified subscription code must be a valid SUB_ identifier.",
    };
  }

  if (subCode !== expectedSubscriptionCode) {
    return {
      success: false,
      error: "Verified subscription code does not match the webhook subscription code.",
    };
  }

  // 2. Domain / Environment Matching
  const domain = data.domain;
  if (
    typeof domain !== "string" ||
    domain.trim() !== domain ||
    (domain !== "test" && domain !== "live")
  ) {
    return {
      success: false,
      error: "Verified subscription domain must be exactly 'test' or 'live'.",
    };
  }

  if (domain !== expectedEnvironment) {
    return {
      success: false,
      error: "Verified subscription domain does not match expected environment.",
    };
  }

  // 3. Status must be 'non-renewing'
  const status = data.status;
  if (typeof status !== "string" || status !== "non-renewing") {
    return {
      success: false,
      error: "Paystack subscription status must be 'non-renewing'.",
    };
  }

  // 4. Provider Subscription ID
  const subIdResult = validateProviderId(data.id);
  if (!subIdResult.success) {
    return {
      success: false,
      error: "Invalid provider subscription id.",
    };
  }

  // 5. Customer Object & Customer Code
  if (!isPlainObject(data.customer)) {
    return {
      success: false,
      error: "Paystack subscription response is missing a valid customer object.",
    };
  }

  const customerCode = data.customer.customer_code;
  if (
    typeof customerCode !== "string" ||
    customerCode.trim() !== customerCode ||
    !PAYSTACK_CUSTOMER_CODE_REGEX.test(customerCode)
  ) {
    return {
      success: false,
      error: "Invalid customer code format.",
    };
  }

  // 6. Next Payment Date (Nullable)
  let nextPaymentAt: string | null = null;
  const rawNextPaymentDate = data.next_payment_date;
  if (rawNextPaymentDate !== null && rawNextPaymentDate !== undefined) {
    if (
      typeof rawNextPaymentDate !== "string" ||
      rawNextPaymentDate.trim() !== rawNextPaymentDate ||
      rawNextPaymentDate.length === 0
    ) {
      return {
        success: false,
        error: "Verified next_payment_date timestamp is invalid.",
      };
    }
    const parsedNext = new Date(rawNextPaymentDate);
    if (Number.isNaN(parsedNext.getTime())) {
      return {
        success: false,
        error: "Verified next_payment_date timestamp is not a valid date.",
      };
    }
    nextPaymentAt = parsedNext.toISOString();
  }

  // 7. Update Timestamp (updatedAt and/or updated_at)
  // Fetch Subscription can omit both update timestamps. Only a caller that has
  // just fetched the authenticated provider snapshot may supply verifiedAt.
  // In that case occurredAt records observation time, not the cancellation time.
  const rawUpdatedAt = data.updatedAt ?? undefined;
  const rawUpdatedAtSnake = data.updated_at ?? undefined;

  if (rawUpdatedAt === undefined && rawUpdatedAtSnake === undefined) {
    if (typeof verifiedAt !== "string" || verifiedAt.trim() !== verifiedAt ||
        !Number.isFinite(Date.parse(verifiedAt))) {
      return {
        success: false,
        error: "Verified subscription is missing updatedAt/updated_at timestamp.",
      };
    }
    return {
      success: true,
      data: {
        environment: expectedEnvironment,
        providerSubscriptionCode: subCode,
        providerSubscriptionId: subIdResult.data,
        providerCustomerCode: customerCode,
        providerStatus: "non-renewing",
        nextPaymentAt,
        occurredAt: new Date(verifiedAt).toISOString(),
      },
    };
  }

  let occurredAt: string;
  if (rawUpdatedAt !== undefined && rawUpdatedAtSnake !== undefined) {
    if (
      typeof rawUpdatedAt !== "string" ||
      rawUpdatedAt.trim() !== rawUpdatedAt ||
      typeof rawUpdatedAtSnake !== "string" ||
      rawUpdatedAtSnake.trim() !== rawUpdatedAtSnake
    ) {
      return {
        success: false,
        error: "Verified subscription updatedAt timestamps must be valid strings.",
      };
    }
    const parsed1 = new Date(rawUpdatedAt);
    const parsed2 = new Date(rawUpdatedAtSnake);
    if (Number.isNaN(parsed1.getTime()) || Number.isNaN(parsed2.getTime())) {
      return {
        success: false,
        error: "Verified subscription updatedAt timestamp is not a valid date.",
      };
    }
    if (parsed1.getTime() !== parsed2.getTime()) {
      return {
        success: false,
        error: "Conflicting updatedAt and updated_at timestamps in subscription response.",
      };
    }
    occurredAt = parsed1.toISOString();
  } else {
    const single = rawUpdatedAt ?? rawUpdatedAtSnake;
    if (
      typeof single !== "string" ||
      single.trim() !== single ||
      single.length === 0
    ) {
      return {
        success: false,
        error: "Verified subscription updatedAt timestamp must be a valid string.",
      };
    }
    const parsed = new Date(single);
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        error: "Verified subscription updatedAt timestamp is not a valid date.",
      };
    }
    occurredAt = parsed.toISOString();
  }

  return {
    success: true,
    data: {
      environment: expectedEnvironment,
      providerSubscriptionCode: subCode,
      providerSubscriptionId: subIdResult.data,
      providerCustomerCode: customerCode,
      providerStatus: "non-renewing",
      nextPaymentAt: nextPaymentAt,
      occurredAt: occurredAt,
    },
  };
}

export function decodePaystackSubscriptionDisableEvent(
  payload: unknown,
): DecodeResult<PaystackSubscriptionDisableEvent> {
  if (!isPlainObject(payload)) {
    return {
      success: false,
      error: "Webhook payload must be a JSON object.",
    };
  }

  if (payload.event !== "subscription.disable") {
    return {
      success: false,
      error: "Webhook event must be 'subscription.disable'.",
    };
  }

  const data = payload.data;
  if (!isPlainObject(data)) {
    return {
      success: false,
      error: "Webhook payload is missing a valid data object.",
    };
  }

  const domain = data.domain;
  if (
    typeof domain !== "string" ||
    domain.trim() !== domain ||
    (domain !== "test" && domain !== "live")
  ) {
    return {
      success: false,
      error: "Webhook domain must be exactly 'test' or 'live'.",
    };
  }

  const subscriptionCode = data.subscription_code;
  if (
    typeof subscriptionCode !== "string" ||
    subscriptionCode.trim() !== subscriptionCode ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(subscriptionCode)
  ) {
    return {
      success: false,
      error: "Webhook subscription code must be a valid SUB_ identifier.",
    };
  }

  const status = data.status;
  if (status !== undefined) {
    if (
      typeof status !== "string" ||
      status.length === 0 ||
      status.length > 50 ||
      status.trim() !== status ||
      /[\x00-\x1F\x7F]/.test(status)
    ) {
      return {
        success: false,
        error: "Webhook status must be a non-empty, untrimmed, bounded string.",
      };
    }
  }

  return {
    success: true,
    data: {
      environment: domain,
      providerSubscriptionCode: subscriptionCode,
      providerEventId: null,
    },
  };
}

export function validatePaystackSubscriptionDisableResponse(
  json: unknown,
  expectedSubscriptionCode: string,
  expectedEnvironment: "test" | "live",
): DecodeResult<VerifiedSubscriptionDisableData> {
  if (!isPlainObject(json)) {
    return {
      success: false,
      error: "Paystack subscription response must be a JSON object.",
    };
  }

  if (json.status !== true) {
    return {
      success: false,
      error: "Paystack subscription response status is not true.",
    };
  }

  const data = json.data;
  if (!isPlainObject(data)) {
    return {
      success: false,
      error: "Paystack subscription response is missing a valid data object.",
    };
  }

  // 1. Subscription Code Matching & Format
  const subCode = data.subscription_code;
  if (
    typeof subCode !== "string" ||
    subCode.trim() !== subCode ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(subCode)
  ) {
    return {
      success: false,
      error: "Verified subscription code must be a valid SUB_ identifier.",
    };
  }

  if (subCode !== expectedSubscriptionCode) {
    return {
      success: false,
      error: "Verified subscription code does not match the webhook subscription code.",
    };
  }

  // 2. Domain / Environment Matching
  const domain = data.domain;
  if (
    typeof domain !== "string" ||
    domain.trim() !== domain ||
    (domain !== "test" && domain !== "live")
  ) {
    return {
      success: false,
      error: "Verified subscription domain must be exactly 'test' or 'live'.",
    };
  }

  if (domain !== expectedEnvironment) {
    return {
      success: false,
      error: "Verified subscription domain does not match expected environment.",
    };
  }

  // 3. Status must be 'completed' or 'cancelled'
  const status = data.status;
  if (
    typeof status !== "string" ||
    status.trim() !== status ||
    (status !== "completed" && status !== "cancelled")
  ) {
    return {
      success: false,
      error: "Paystack subscription status must be 'completed' or 'cancelled'.",
    };
  }

  // 4. Provider Subscription ID
  const subIdResult = validateProviderId(data.id);
  if (!subIdResult.success) {
    return {
      success: false,
      error: "Invalid provider subscription id.",
    };
  }

  // 5. Customer Object & Customer Code
  if (!isPlainObject(data.customer)) {
    return {
      success: false,
      error: "Paystack subscription response is missing a valid customer object.",
    };
  }

  const customerCode = data.customer.customer_code;
  if (
    typeof customerCode !== "string" ||
    customerCode.trim() !== customerCode ||
    !PAYSTACK_CUSTOMER_CODE_REGEX.test(customerCode)
  ) {
    return {
      success: false,
      error: "Invalid customer code format.",
    };
  }

  // 6. Update Timestamp (updatedAt and/or updated_at) - DO NOT FALL BACK to createdAt/created_at
  const rawUpdatedAt = data.updatedAt;
  const rawUpdatedAtSnake = data.updated_at;

  if (rawUpdatedAt === undefined && rawUpdatedAtSnake === undefined) {
    return {
      success: false,
      error: "Verified subscription is missing updatedAt/updated_at timestamp.",
    };
  }

  let occurredAt: string;
  if (rawUpdatedAt !== undefined && rawUpdatedAtSnake !== undefined) {
    if (
      typeof rawUpdatedAt !== "string" ||
      rawUpdatedAt.trim() !== rawUpdatedAt ||
      rawUpdatedAt.length === 0 ||
      typeof rawUpdatedAtSnake !== "string" ||
      rawUpdatedAtSnake.trim() !== rawUpdatedAtSnake ||
      rawUpdatedAtSnake.length === 0
    ) {
      return {
        success: false,
        error: "Verified subscription updatedAt timestamps must be valid strings.",
      };
    }
    const parsed1 = new Date(rawUpdatedAt);
    const parsed2 = new Date(rawUpdatedAtSnake);
    if (Number.isNaN(parsed1.getTime()) || Number.isNaN(parsed2.getTime())) {
      return {
        success: false,
        error: "Verified subscription updatedAt timestamp is not a valid date.",
      };
    }
    if (parsed1.getTime() !== parsed2.getTime()) {
      return {
        success: false,
        error: "Conflicting updatedAt and updated_at timestamps in subscription response.",
      };
    }
    occurredAt = parsed1.toISOString();
  } else {
    const single = rawUpdatedAt !== undefined ? rawUpdatedAt : rawUpdatedAtSnake;
    if (
      typeof single !== "string" ||
      single.trim() !== single ||
      single.length === 0
    ) {
      return {
        success: false,
        error: "Verified subscription updatedAt timestamp must be a valid string.",
      };
    }
    const parsed = new Date(single);
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        error: "Verified subscription updatedAt timestamp is not a valid date.",
      };
    }
    occurredAt = parsed.toISOString();
  }

  return {
    success: true,
    data: {
      environment: expectedEnvironment,
      providerSubscriptionCode: subCode,
      providerSubscriptionId: subIdResult.data,
      providerCustomerCode: customerCode,
      providerStatus: status,
      disabledAt: occurredAt,
      occurredAt: occurredAt,
    },
  };
}

// --- Paystack invoice.create Webhook Decoding & Snapshot Validation (Step 3C.4E-1C) ---

export interface PaystackInvoiceCreateEvent {
  environment: "test" | "live";
  providerInvoiceCode: string;
  providerSubscriptionCode: string;
  providerCustomerCode: string;
  providerPlanCode: string | null;
  providerStatus: string;
  amountMinor: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  occurredAt: string;
  providerEventId: string | null;
}

export interface VerifiedInvoiceCreateSubscriptionData {
  environment: "test" | "live";
  providerSubscriptionCode: string;
  providerSubscriptionId: string;
  providerCustomerCode: string;
  providerPlanCode: string | null;
  providerSubscriptionStatus: string;
  amountMinor: number;
  currency: string;
  matchedInvoiceCode: string | null;
  occurredAt: string;
}

export type ProcessPaystackInvoiceCreateRpcParams = {
  p_environment: "test" | "live";
  p_payload_sha256: string;
  p_provider_event_id: string | null;
  p_provider_invoice_code: string;
  p_provider_subscription_code: string;
  p_provider_customer_code: string;
  p_provider_status: string | null;
  p_amount_minor: number;
  p_currency: string;
  p_period_start: string;
  p_period_end: string;
  p_occurred_at: string;
};

export const PROCESS_INVOICE_CREATE_KEYS = [
  "webhook_event_id",
  "invoice_id",
  "provider_subscription_record_id",
  "subscription_id",
  "provider_invoice_code",
  "invoice_status",
  "provider_status",
  "amount_minor",
  "currency",
  "is_reused",
  "is_ignored",
] as const;

export interface ProcessPaystackInvoiceCreateRpcResult {
  webhook_event_id: string;
  invoice_id: string | null;
  provider_subscription_record_id: string;
  subscription_id: string;
  provider_invoice_code: string;
  invoice_status: "pending" | "failed" | "paid" | null;
  provider_status: string | null;
  amount_minor: number;
  currency: string;
  is_reused: boolean;
  is_ignored: boolean;
}

export function decodePaystackInvoiceCreateEvent(
  payload: unknown,
): DecodeResult<PaystackInvoiceCreateEvent> {
  if (!isPlainObject(payload)) {
    return {
      success: false,
      error: "Webhook payload must be a non-null object.",
    };
  }

  if (payload.event !== "invoice.create") {
    return {
      success: false,
      error: 'Webhook event must be "invoice.create".',
    };
  }

  if (!isPlainObject(payload.data)) {
    return {
      success: false,
      error: "Webhook data must be a non-null object.",
    };
  }

  const data = payload.data as UnknownRecord;

  // Environment / domain
  if (
    typeof data.domain !== "string" ||
    (data.domain !== "test" && data.domain !== "live") ||
    data.domain.trim() !== data.domain
  ) {
    return {
      success: false,
      error: 'Webhook data domain must be "test" or "live".',
    };
  }
  const environment = data.domain as "test" | "live";

  // Provider invoice code
  if (
    typeof data.invoice_code !== "string" ||
    data.invoice_code.trim() !== data.invoice_code ||
    data.invoice_code.length < 5 ||
    data.invoice_code.length > 255 ||
    !PAYSTACK_INVOICE_CODE_REGEX.test(data.invoice_code)
  ) {
    return {
      success: false,
      error: "Webhook data invoice_code has an invalid format.",
    };
  }
  const providerInvoiceCode = data.invoice_code;

  // Nested subscription code from data.subscription.subscription_code ONLY
  if (!isPlainObject(data.subscription)) {
    return {
      success: false,
      error: "Webhook data subscription must be a non-null object.",
    };
  }
  const subObj = data.subscription as UnknownRecord;
  if (
    typeof subObj.subscription_code !== "string" ||
    subObj.subscription_code.trim() !== subObj.subscription_code ||
    subObj.subscription_code.length > 255 ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(subObj.subscription_code)
  ) {
    return {
      success: false,
      error: "Webhook data subscription.subscription_code has an invalid format.",
    };
  }
  const providerSubscriptionCode = subObj.subscription_code;

  // Nested customer code from data.customer.customer_code
  if (!isPlainObject(data.customer)) {
    return {
      success: false,
      error: "Webhook data customer must be a non-null object.",
    };
  }
  const custObj = data.customer as UnknownRecord;
  if (
    typeof custObj.customer_code !== "string" ||
    custObj.customer_code.trim() !== custObj.customer_code ||
    custObj.customer_code.length > 255 ||
    !PAYSTACK_CUSTOMER_CODE_REGEX.test(custObj.customer_code)
  ) {
    return {
      success: false,
      error: "Webhook data customer.customer_code has an invalid format.",
    };
  }
  const providerCustomerCode = custObj.customer_code;

  // Plan code (optional in subscription.plan, subscription.plan_code, or data.plan)
  let providerPlanCode: string | null = null;
  if (isPlainObject(subObj.plan) && typeof (subObj.plan as UnknownRecord).plan_code === "string") {
    const rawPlan = (subObj.plan as UnknownRecord).plan_code as string;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data subscription plan_code has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  } else if (typeof subObj.plan_code === "string") {
    const rawPlan = subObj.plan_code;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data subscription plan_code has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  } else if (typeof subObj.plan === "string") {
    const rawPlan = subObj.plan;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data subscription plan has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  } else if (isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).plan_code === "string") {
    const rawPlan = (data.plan as UnknownRecord).plan_code as string;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data plan.plan_code has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  } else if (typeof data.plan === "string") {
    const rawPlan = data.plan;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data plan has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  }

  // Amount minor
  if (
    typeof data.amount !== "number" ||
    !Number.isSafeInteger(data.amount) ||
    data.amount <= 0 ||
    data.amount > 2147483647
  ) {
    return {
      success: false,
      error: "Webhook data amount must be a positive integer minor units up to 2147483647.",
    };
  }
  const amountMinor = data.amount;

  // Currency
  const rawCurrency =
    typeof data.currency === "string"
      ? data.currency
      : isPlainObject(subObj.plan) && typeof (subObj.plan as UnknownRecord).currency === "string"
        ? ((subObj.plan as UnknownRecord).currency as string)
        : typeof (subObj as UnknownRecord).currency === "string"
          ? ((subObj as UnknownRecord).currency as string)
          : isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).currency === "string"
            ? ((data.plan as UnknownRecord).currency as string)
            : isPlainObject(data.transaction) && typeof (data.transaction as UnknownRecord).currency === "string"
              ? ((data.transaction as UnknownRecord).currency as string)
              : null;

  if (
    typeof rawCurrency !== "string" ||
    !/^[A-Z]{3}$/.test(rawCurrency) ||
    rawCurrency.trim() !== rawCurrency
  ) {
    return {
      success: false,
      error: "Webhook data currency must be 3 uppercase ASCII letters.",
    };
  }
  const currency = rawCurrency;

  // Provider Status
  if (
    typeof data.status !== "string" ||
    data.status.trim() !== data.status ||
    data.status.length === 0 ||
    data.status.length > 50 ||
    /[\x00-\x1F\x7F]/.test(data.status)
  ) {
    return {
      success: false,
      error: "Webhook data status must be a non-empty bounded string without control characters.",
    };
  }
  const providerStatus = data.status;

  // Period start & Period end
  if (
    typeof data.period_start !== "string" ||
    data.period_start.trim() !== data.period_start ||
    data.period_start.length === 0 ||
    typeof data.period_end !== "string" ||
    data.period_end.trim() !== data.period_end ||
    data.period_end.length === 0
  ) {
    return {
      success: false,
      error: "Webhook data period_start and period_end must be non-empty ISO strings.",
    };
  }
  const parsedStart = new Date(data.period_start);
  const parsedEnd = new Date(data.period_end);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
    return {
      success: false,
      error: "Webhook data period_start or period_end is not a valid date.",
    };
  }
  if (parsedEnd.getTime() <= parsedStart.getTime()) {
    return {
      success: false,
      error: "Webhook data period_end must be strictly greater than period_start.",
    };
  }
  const periodStart = parsedStart.toISOString();
  const periodEnd = parsedEnd.toISOString();

  // Created at (event occurrence timestamp)
  const rawCreatedAt = data.created_at ?? data.createdAt;
  if (
    typeof rawCreatedAt !== "string" ||
    rawCreatedAt.trim() !== rawCreatedAt ||
    rawCreatedAt.length === 0
  ) {
    return {
      success: false,
      error: "Webhook data created_at must be a non-empty ISO string.",
    };
  }
  const parsedCreatedAt = new Date(rawCreatedAt);
  if (Number.isNaN(parsedCreatedAt.getTime())) {
    return {
      success: false,
      error: "Webhook data created_at is not a valid date.",
    };
  }
  const occurredAt = parsedCreatedAt.toISOString();

  return {
    success: true,
    data: {
      environment,
      providerInvoiceCode,
      providerSubscriptionCode,
      providerCustomerCode,
      providerPlanCode,
      providerStatus,
      amountMinor,
      currency,
      periodStart,
      periodEnd,
      occurredAt,
      providerEventId: null,
    },
  };
}

export function validatePaystackInvoiceCreateSubscriptionResponse(
  json: unknown,
  expected: {
    environment: "test" | "live";
    providerSubscriptionCode: string;
    providerCustomerCode: string;
    providerPlanCode?: string | null;
    providerInvoiceCode: string;
    amountMinor: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
  },
): DecodeResult<VerifiedInvoiceCreateSubscriptionData> {
  if (!isPlainObject(json)) {
    return {
      success: false,
      error: "Paystack subscription response must be a non-null object.",
    };
  }

  if (json.status !== true) {
    return {
      success: false,
      error: "Paystack subscription response status is not true.",
    };
  }

  if (!isPlainObject(json.data)) {
    return {
      success: false,
      error: "Paystack subscription response data must be a non-null object.",
    };
  }

  const data = json.data as UnknownRecord;

  // Environment / domain
  if (
    typeof data.domain !== "string" ||
    (data.domain !== "test" && data.domain !== "live") ||
    data.domain.trim() !== data.domain
  ) {
    return {
      success: false,
      error: 'Verified subscription domain must be "test" or "live".',
    };
  }
  if (data.domain !== expected.environment) {
    return {
      success: false,
      error: "Verified subscription domain does not match expected environment.",
    };
  }

  // Subscription Code
  if (
    typeof data.subscription_code !== "string" ||
    data.subscription_code.trim() !== data.subscription_code ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(data.subscription_code)
  ) {
    return {
      success: false,
      error: "Verified subscription code has an invalid format.",
    };
  }
  if (data.subscription_code !== expected.providerSubscriptionCode) {
    return {
      success: false,
      error: "Verified subscription code does not match expected subscription.",
    };
  }

  // Provider ID
  const subIdResult = validateProviderId(data.id);
  if (!subIdResult.success) {
    return {
      success: false,
      error: "Verified subscription ID is invalid.",
    };
  }

  // Customer code
  if (!isPlainObject(data.customer)) {
    return {
      success: false,
      error: "Verified subscription customer must be an object.",
    };
  }
  const custCode = (data.customer as UnknownRecord).customer_code;
  if (
    typeof custCode !== "string" ||
    custCode.trim() !== custCode ||
    !PAYSTACK_CUSTOMER_CODE_REGEX.test(custCode)
  ) {
    return {
      success: false,
      error: "Verified subscription customer_code has an invalid format.",
    };
  }
  if (custCode !== expected.providerCustomerCode) {
    return {
      success: false,
      error: "Verified subscription customer_code does not match expected customer.",
    };
  }

  // Plan code verification
  let snapshotPlanCode: string | null = null;
  if (isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).plan_code === "string") {
    snapshotPlanCode = (data.plan as UnknownRecord).plan_code as string;
  } else if (typeof data.plan === "string") {
    snapshotPlanCode = data.plan;
  }
  if (expected.providerPlanCode !== undefined && expected.providerPlanCode !== null) {
    if (snapshotPlanCode === null || snapshotPlanCode !== expected.providerPlanCode) {
      return {
        success: false,
        error: "Verified subscription plan_code does not match expected plan.",
      };
    }
  }

  // Commercial amount and currency
  const snapshotAmount =
    typeof data.amount === "number"
      ? data.amount
      : isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).amount === "number"
        ? ((data.plan as UnknownRecord).amount as number)
        : null;

  if (snapshotAmount !== expected.amountMinor) {
    return {
      success: false,
      error: "Verified subscription amount does not match expected amount.",
    };
  }

  const snapshotCurrency =
    typeof data.currency === "string"
      ? data.currency
      : isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).currency === "string"
        ? ((data.plan as UnknownRecord).currency as string)
        : null;

  if (snapshotCurrency !== expected.currency) {
    return {
      success: false,
      error: "Verified subscription currency does not match expected currency.",
    };
  }

  // Subscription Status (exact recognized set: active, non-renewing, attention, completed, cancelled)
  if (
    typeof data.status !== "string" ||
    !PAYSTACK_RECOGNIZED_SUBSCRIPTION_STATUSES.has(data.status)
  ) {
    return {
      success: false,
      error: "Verified subscription status is not a recognized status.",
    };
  }
  const providerSubscriptionStatus = data.status;

  // Invoice validation in most_recent_invoice or invoices
  let matchedInvoiceCode: string | null = null;

  const validateInvoiceSnapshotFields = (
    inv: UnknownRecord,
    context: string,
  ): { success: true } | { success: false; error: string } => {
    if (typeof inv.amount === "number" && inv.amount !== expected.amountMinor) {
      return {
        success: false,
        error: `Contradictory invoice snapshot amount in ${context}.`,
      };
    }
    if (typeof inv.currency === "string" && inv.currency !== expected.currency) {
      return {
        success: false,
        error: `Contradictory invoice snapshot currency in ${context}.`,
      };
    }
    if (typeof inv.period_start === "string") {
      const ps = new Date(inv.period_start);
      if (!Number.isNaN(ps.getTime()) && ps.toISOString() !== expected.periodStart) {
        return {
          success: false,
          error: `Contradictory invoice snapshot period start in ${context}.`,
        };
      }
    }
    if (typeof inv.period_end === "string") {
      const pe = new Date(inv.period_end);
      if (!Number.isNaN(pe.getTime()) && pe.toISOString() !== expected.periodEnd) {
        return {
          success: false,
          error: `Contradictory invoice snapshot period end in ${context}.`,
        };
      }
    }
    return { success: true };
  };

  // Check most_recent_invoice
  if (isPlainObject(data.most_recent_invoice)) {
    const mri = data.most_recent_invoice as UnknownRecord;
    const mriCode =
      typeof mri.invoice_code === "string"
        ? mri.invoice_code
        : typeof mri.code === "string"
          ? mri.code
          : null;
    if (mriCode === expected.providerInvoiceCode) {
      const valRes = validateInvoiceSnapshotFields(mri, "most_recent_invoice");
      if (valRes.success === false) {
        return { success: false, error: valRes.error };
      }
      matchedInvoiceCode = expected.providerInvoiceCode;
    }
  }

  // Check invoices collection if present
  if (data.invoices !== undefined && data.invoices !== null) {
    if (!Array.isArray(data.invoices)) {
      return {
        success: false,
        error: "Verified subscription invoices field must be an array when present.",
      };
    }
    if (data.invoices.length > 50) {
      return {
        success: false,
        error: "Verified subscription invoices collection exceeds maximum bounded limit.",
      };
    }
    for (let i = 0; i < data.invoices.length; i++) {
      const inv = data.invoices[i];
      if (!isPlainObject(inv)) {
        return {
          success: false,
          error: "Malformed invoice item in invoices collection.",
        };
      }
      const invCode =
        typeof (inv as UnknownRecord).invoice_code === "string"
          ? ((inv as UnknownRecord).invoice_code as string)
          : typeof (inv as UnknownRecord).code === "string"
            ? ((inv as UnknownRecord).code as string)
            : null;
      if (invCode === expected.providerInvoiceCode) {
        const valRes = validateInvoiceSnapshotFields(inv as UnknownRecord, "invoices collection");
        if (valRes.success === false) {
          return { success: false, error: valRes.error };
        }
        matchedInvoiceCode = expected.providerInvoiceCode;
      }
    }
  }

  // Timestamp
  const updatedAtRaw = data.updatedAt ?? data.updated_at;
  const createdAtRaw = data.createdAt ?? data.created_at;
  const chosenTime =
    typeof updatedAtRaw === "string" && updatedAtRaw.length > 0
      ? updatedAtRaw
      : typeof createdAtRaw === "string" && createdAtRaw.length > 0
        ? createdAtRaw
        : null;
  if (!chosenTime) {
    return {
      success: false,
      error: "Verified subscription is missing timestamp.",
    };
  }
  const parsedTime = new Date(chosenTime);
  if (Number.isNaN(parsedTime.getTime())) {
    return {
      success: false,
      error: "Verified subscription timestamp is not a valid date.",
    };
  }
  const occurredAt = parsedTime.toISOString();

  return {
    success: true,
    data: {
      environment: expected.environment,
      providerSubscriptionCode: expected.providerSubscriptionCode,
      providerSubscriptionId: subIdResult.data,
      providerCustomerCode: expected.providerCustomerCode,
      providerPlanCode: snapshotPlanCode,
      providerSubscriptionStatus,
      amountMinor: expected.amountMinor,
      currency: expected.currency,
      matchedInvoiceCode,
      occurredAt,
    },
  };
}

export function decodeProcessPaystackInvoiceCreateRpcResult(
  data: unknown,
): DecodeResult<ProcessPaystackInvoiceCreateRpcResult> {
  if (!Array.isArray(data) || data.length !== 1 || !isPlainObject(data[0])) {
    return {
      success: false,
      error: "RPC result must be a single-row array.",
    };
  }

  const row = data[0] as UnknownRecord;

  if (!hasExactKeys(row, PROCESS_INVOICE_CREATE_KEYS)) {
    return {
      success: false,
      error: "RPC result row does not have exact expected keys.",
    };
  }

  // webhook_event_id
  if (typeof row.webhook_event_id !== "string" || !isValidUuid(row.webhook_event_id)) {
    return {
      success: false,
      error: "RPC result webhook_event_id must be a valid UUID.",
    };
  }

  // provider_subscription_record_id
  if (
    typeof row.provider_subscription_record_id !== "string" ||
    !isValidUuid(row.provider_subscription_record_id)
  ) {
    return {
      success: false,
      error: "RPC result provider_subscription_record_id must be a valid UUID.",
    };
  }

  // subscription_id
  if (typeof row.subscription_id !== "string" || !isValidUuid(row.subscription_id)) {
    return {
      success: false,
      error: "RPC result subscription_id must be a valid UUID.",
    };
  }

  // provider_invoice_code
  if (
    typeof row.provider_invoice_code !== "string" ||
    row.provider_invoice_code.trim() !== row.provider_invoice_code ||
    row.provider_invoice_code.length < 5 ||
    row.provider_invoice_code.length > 255 ||
    !PAYSTACK_INVOICE_CODE_REGEX.test(row.provider_invoice_code)
  ) {
    return {
      success: false,
      error: "RPC result provider_invoice_code has an invalid format.",
    };
  }

  // amount_minor
  if (
    typeof row.amount_minor !== "number" ||
    !Number.isSafeInteger(row.amount_minor) ||
    row.amount_minor <= 0
  ) {
    return {
      success: false,
      error: "RPC result amount_minor must be a positive integer.",
    };
  }

  // currency
  if (
    typeof row.currency !== "string" ||
    !/^[A-Z]{3}$/.test(row.currency) ||
    row.currency.trim() !== row.currency
  ) {
    return {
      success: false,
      error: "RPC result currency must be 3 uppercase ASCII letters.",
    };
  }

  // is_reused
  if (typeof row.is_reused !== "boolean") {
    return {
      success: false,
      error: "RPC result is_reused must be a boolean.",
    };
  }

  // is_ignored
  if (typeof row.is_ignored !== "boolean") {
    return {
      success: false,
      error: "RPC result is_ignored must be a boolean.",
    };
  }

  // invoice_id
  if (row.invoice_id !== null) {
    if (typeof row.invoice_id !== "string" || !isValidUuid(row.invoice_id)) {
      return {
        success: false,
        error: "RPC result invoice_id must be null or a valid UUID.",
      };
    }
  }

  // invoice_status
  if (row.invoice_status !== null) {
    if (
      row.invoice_status !== "pending" &&
      row.invoice_status !== "failed" &&
      row.invoice_status !== "paid"
    ) {
      return {
        success: false,
        error: "RPC result invoice_status must be null or one of 'pending', 'failed', 'paid'.",
      };
    }
  }

  // provider_status
  if (row.provider_status !== null) {
    if (
      typeof row.provider_status !== "string" ||
      row.provider_status.trim() !== row.provider_status ||
      row.provider_status.length === 0 ||
      row.provider_status.length > 50 ||
      WHITESPACE_OR_CONTROL_REGEX.test(row.provider_status)
    ) {
      return {
        success: false,
        error: "RPC result provider_status must be null or a bounded trimmed string.",
      };
    }
  }

  // Mixed null state check
  if ((row.invoice_id === null) !== (row.invoice_status === null)) {
    return {
      success: false,
      error: "RPC result invoice_id and invoice_status must be either both null or both non-null.",
    };
  }

  // Non-ignored result must have non-null invoice_id and invoice_status
  if (!row.is_ignored) {
    if (row.invoice_id === null || row.invoice_status === null) {
      return {
        success: false,
        error: "Non-ignored RPC result must return non-null invoice_id and invoice_status.",
      };
    }
  }

  // Fresh non-ignored result must be pending
  if (!row.is_reused && !row.is_ignored) {
    if (row.invoice_status !== "pending") {
      return {
        success: false,
        error: "Fresh non-ignored RPC result must have invoice_status 'pending'.",
      };
    }
  }

  return {
    success: true,
    data: {
      webhook_event_id: row.webhook_event_id as string,
      invoice_id: row.invoice_id as string | null,
      provider_subscription_record_id: row.provider_subscription_record_id as string,
      subscription_id: row.subscription_id as string,
      provider_invoice_code: row.provider_invoice_code as string,
      invoice_status: row.invoice_status as "pending" | "failed" | "paid" | null,
      provider_status: row.provider_status as string | null,
      amount_minor: row.amount_minor as number,
      currency: row.currency as string,
      is_reused: row.is_reused as boolean,
      is_ignored: row.is_ignored as boolean,
    },
  };
}

export function sanitizeInvoiceCreateDatabaseError(error: unknown): {
  status: number;
  message: string;
  code: string;
  headers?: Record<string, string>;
} {
  if (!isPlainObject(error)) {
    return {
      status: 500,
      message: "Internal server error.",
      code: "PAYSTACK_INTERNAL_ERROR",
    };
  }

  const errObj = error as UnknownRecord;
  let code: string | undefined;
  if (typeof errObj.code === "string" && errObj.code.length > 0) {
    code = errObj.code;
  } else if (typeof errObj.sqlstate === "string" && errObj.sqlstate.length > 0) {
    code = errObj.sqlstate;
  }

  // Missing prerequisite (P0002) - Subscription not found or environment mismatch
  if (code === "P0002") {
    return {
      status: 503,
      message: "Invoice prerequisite is pending. Please retry later.",
      code: "PAYSTACK_INVOICE_PREREQUISITE_PENDING",
      headers: { "Retry-After": "60" },
    };
  }

  // Unique constraint / collision violation (23505)
  if (code === "23505") {
    return {
      status: 409,
      message: "Invoice identifier or payload collision.",
      code: "PAYSTACK_INVOICE_CONFLICT",
    };
  }

  // Commercial / lifecycle mismatch (23514, 22023, 22004, 22000)
  if (
    code === "23514" ||
    code === "22023" ||
    code === "22004" ||
    code === "22000"
  ) {
    return {
      status: 409,
      message: "Invoice lifecycle or constraint conflict.",
      code: "PAYSTACK_INVOICE_MISMATCH",
    };
  }

  // Transient database errors (retryable) (53300, 40001, 40P01, 57P01, 08006, 08001)
  if (
    code === "53300" ||
    code === "40001" ||
    code === "40P01" ||
    code === "57P01" ||
    code === "08006" ||
    code === "08001"
  ) {
    return {
      status: 503,
      message: "Transient database failure.",
      code: "PAYSTACK_DATABASE_UNAVAILABLE",
    };
  }

  return {
    status: 500,
    message: "Internal server error.",
    code: "PAYSTACK_INTERNAL_ERROR",
  };
}

// --- Paystack invoice.update (Success) Webhook Decoding, Verification & Database RPC (Step 3C.4E-3B) ---

export interface PaystackInvoiceUpdateSuccessEvent {
  environment: "test" | "live";
  providerInvoiceCode: string;
  providerSubscriptionCode: string;
  providerCustomerCode: string;
  providerPlanCode: string | null;
  providerInvoiceStatus: "success";
  providerPaid: true;
  providerTransactionStatus: string | null;
  providerTransactionId: string | null;
  providerReference: string | null;
  amountMinor: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
  nextPaymentDate: string | null;
  occurredAt: string;
  providerEventId: string | null;
}

export interface VerifiedInvoiceUpdateTransactionData {
  environment: "test" | "live";
  providerReference: string;
  providerTransactionId: string;
  providerTransactionStatus: "success";
  amountMinor: number;
  currency: string;
  paidAt: string;
  providerCustomerCode: string;
  providerPlanCode: string | null;
}

export interface VerifiedInvoiceUpdateSubscriptionData {
  environment: "test" | "live";
  providerSubscriptionCode: string;
  providerSubscriptionId: string;
  providerCustomerCode: string;
  providerPlanCode: string | null;
  providerSubscriptionStatus: string;
  amountMinor: number;
  currency: string;
  nextPaymentDate: string | null;
  matchedInvoiceCode: string | null;
  occurredAt: string;
}

export interface ProcessPaystackInvoiceUpdateSuccessRpcParams {
  p_environment: "test" | "live";
  p_payload_sha256: string;
  p_provider_event_id: string | null;
  p_provider_invoice_code: string;
  p_provider_subscription_code: string;
  p_provider_customer_code: string;
  p_provider_plan_code: string | null;
  p_provider_invoice_status: string;
  p_provider_paid: boolean;
  p_provider_transaction_status: string | null;
  p_provider_transaction_id: string | null;
  p_provider_reference: string | null;
  p_amount_minor: number;
  p_currency: string;
  p_period_start: string;
  p_period_end: string;
  p_paid_at: string;
  p_next_payment_date: string | null;
  p_occurred_at: string;
}

export const PROCESS_INVOICE_UPDATE_SUCCESS_KEYS = [
  "webhook_event_id",
  "invoice_id",
  "payment_id",
  "provider_subscription_record_id",
  "subscription_id",
  "provider_invoice_code",
  "invoice_status",
  "payment_status",
  "subscription_status",
  "amount_minor",
  "currency",
  "current_period_start",
  "current_period_end",
  "next_renewal_at",
  "past_due_since",
  "is_reused",
  "is_ignored",
] as const;

export interface ProcessPaystackInvoiceUpdateSuccessRpcResult {
  webhook_event_id: string;
  invoice_id: string | null;
  payment_id: string | null;
  provider_subscription_record_id: string;
  subscription_id: string;
  provider_invoice_code: string;
  invoice_status: string | null;
  payment_status: string | null;
  subscription_status: string | null;
  amount_minor: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  next_renewal_at: string | null;
  past_due_since: string | null;
  is_reused: boolean;
  is_ignored: boolean;
}

export function decodePaystackInvoiceUpdateSuccessEvent(
  payload: unknown,
): DecodeResult<PaystackInvoiceUpdateSuccessEvent> {
  if (!isPlainObject(payload)) {
    return {
      success: false,
      error: "Webhook payload must be a non-null object.",
    };
  }

  if (payload.event !== "invoice.update") {
    return {
      success: false,
      error: 'Webhook event must be "invoice.update".',
    };
  }

  if (!isPlainObject(payload.data)) {
    return {
      success: false,
      error: "Webhook data must be a non-null object.",
    };
  }

  const data = payload.data as UnknownRecord;

  // Environment / domain
  if (
    typeof data.domain !== "string" ||
    (data.domain !== "test" && data.domain !== "live") ||
    data.domain.trim() !== data.domain
  ) {
    return {
      success: false,
      error: 'Webhook data domain must be "test" or "live".',
    };
  }
  const environment = data.domain as "test" | "live";

  // Provider invoice code
  const rawInvoiceCode = data.invoice_code ?? data.code;
  if (
    typeof rawInvoiceCode !== "string" ||
    rawInvoiceCode.trim() !== rawInvoiceCode ||
    rawInvoiceCode.length < 5 ||
    rawInvoiceCode.length > 255 ||
    !PAYSTACK_INVOICE_CODE_REGEX.test(rawInvoiceCode)
  ) {
    return {
      success: false,
      error: "Webhook data invoice_code has an invalid format.",
    };
  }
  const providerInvoiceCode = rawInvoiceCode;

  // Provider Invoice Status
  if (data.status !== "success") {
    return {
      success: false,
      error: 'Webhook data status must be "success".',
    };
  }
  const providerInvoiceStatus: "success" = "success";

  // Provider Paid
  if (data.paid !== true) {
    return {
      success: false,
      error: "Webhook data paid must be true for successful invoice.update.",
    };
  }
  const providerPaid: true = true;

  // Nested subscription code from data.subscription.subscription_code ONLY
  if (!isPlainObject(data.subscription)) {
    return {
      success: false,
      error: "Webhook data subscription must be a non-null object.",
    };
  }
  const subObj = data.subscription as UnknownRecord;
  if (
    typeof subObj.subscription_code !== "string" ||
    subObj.subscription_code.trim() !== subObj.subscription_code ||
    subObj.subscription_code.length > 255 ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(subObj.subscription_code)
  ) {
    return {
      success: false,
      error: "Webhook data subscription.subscription_code has an invalid format.",
    };
  }
  const providerSubscriptionCode = subObj.subscription_code;

  // Nested customer code from data.customer.customer_code
  if (!isPlainObject(data.customer)) {
    return {
      success: false,
      error: "Webhook data customer must be a non-null object.",
    };
  }
  const custObj = data.customer as UnknownRecord;
  if (
    typeof custObj.customer_code !== "string" ||
    custObj.customer_code.trim() !== custObj.customer_code ||
    custObj.customer_code.length > 255 ||
    !PAYSTACK_CUSTOMER_CODE_REGEX.test(custObj.customer_code)
  ) {
    return {
      success: false,
      error: "Webhook data customer.customer_code has an invalid format.",
    };
  }
  const providerCustomerCode = custObj.customer_code;

  // Plan code (optional in subscription.plan, subscription.plan_code, or data.plan)
  let providerPlanCode: string | null = null;
  if (isPlainObject(subObj.plan) && typeof (subObj.plan as UnknownRecord).plan_code === "string") {
    const rawPlan = (subObj.plan as UnknownRecord).plan_code as string;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data subscription plan_code has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  } else if (typeof subObj.plan_code === "string") {
    const rawPlan = subObj.plan_code;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data subscription plan_code has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  } else if (typeof subObj.plan === "string") {
    const rawPlan = subObj.plan;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data subscription plan has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  } else if (isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).plan_code === "string") {
    const rawPlan = (data.plan as UnknownRecord).plan_code as string;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data plan.plan_code has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  } else if (typeof data.plan === "string") {
    const rawPlan = data.plan;
    if (rawPlan.trim() !== rawPlan || !PAYSTACK_PLAN_CODE_REGEX.test(rawPlan) || rawPlan.length > 255) {
      return {
        success: false,
        error: "Webhook data plan has an invalid format.",
      };
    }
    providerPlanCode = rawPlan;
  }

  // Amount minor
  if (
    typeof data.amount !== "number" ||
    !Number.isSafeInteger(data.amount) ||
    data.amount <= 0 ||
    data.amount > 2147483647
  ) {
    return {
      success: false,
      error: "Webhook data amount must be a positive integer minor units up to 2147483647.",
    };
  }
  const amountMinor = data.amount;

  // Currency
  const rawCurrency =
    typeof data.currency === "string"
      ? data.currency
      : isPlainObject(subObj.plan) && typeof (subObj.plan as UnknownRecord).currency === "string"
        ? ((subObj.plan as UnknownRecord).currency as string)
        : typeof (subObj as UnknownRecord).currency === "string"
          ? ((subObj as UnknownRecord).currency as string)
          : isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).currency === "string"
            ? ((data.plan as UnknownRecord).currency as string)
            : isPlainObject(data.transaction) && typeof (data.transaction as UnknownRecord).currency === "string"
              ? ((data.transaction as UnknownRecord).currency as string)
              : null;

  if (
    typeof rawCurrency !== "string" ||
    !/^[A-Z]{3}$/.test(rawCurrency) ||
    rawCurrency.trim() !== rawCurrency
  ) {
    return {
      success: false,
      error: "Webhook data currency must be 3 uppercase ASCII letters.",
    };
  }
  const currency = rawCurrency;

  // Period start & Period end
  if (
    typeof data.period_start !== "string" ||
    data.period_start.trim() !== data.period_start ||
    data.period_start.length === 0 ||
    typeof data.period_end !== "string" ||
    data.period_end.trim() !== data.period_end ||
    data.period_end.length === 0
  ) {
    return {
      success: false,
      error: "Webhook data period_start and period_end must be non-empty ISO strings.",
    };
  }
  const parsedStart = new Date(data.period_start);
  const parsedEnd = new Date(data.period_end);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
    return {
      success: false,
      error: "Webhook data period_start or period_end is not a valid date.",
    };
  }
  if (parsedEnd.getTime() <= parsedStart.getTime()) {
    return {
      success: false,
      error: "Webhook data period_end must be strictly greater than period_start.",
    };
  }
  const periodStart = parsedStart.toISOString();
  const periodEnd = parsedEnd.toISOString();

  // Paid at
  const rawPaidAt = data.paid_at ?? data.paidAt;
  if (
    typeof rawPaidAt !== "string" ||
    rawPaidAt.trim() !== rawPaidAt ||
    rawPaidAt.length === 0
  ) {
    return {
      success: false,
      error: "Webhook data paid_at must be a non-empty ISO string.",
    };
  }
  const parsedPaidAt = new Date(rawPaidAt);
  if (Number.isNaN(parsedPaidAt.getTime())) {
    return {
      success: false,
      error: "Webhook data paid_at is not a valid date.",
    };
  }
  const paidAt = parsedPaidAt.toISOString();

  // Next payment date (optional)
  let nextPaymentDate: string | null = null;
  const rawNextPaymentDate =
    data.next_payment_date ??
    (isPlainObject(data.subscription) ? (data.subscription as UnknownRecord).next_payment_date : undefined);
  if (rawNextPaymentDate !== null && rawNextPaymentDate !== undefined) {
    if (
      typeof rawNextPaymentDate !== "string" ||
      rawNextPaymentDate.trim() !== rawNextPaymentDate ||
      rawNextPaymentDate.length === 0
    ) {
      return {
        success: false,
        error: "Webhook data next_payment_date timestamp is invalid.",
      };
    }
    const parsedNext = new Date(rawNextPaymentDate);
    if (Number.isNaN(parsedNext.getTime())) {
      return {
        success: false,
        error: "Webhook data next_payment_date is not a valid date.",
      };
    }
    if (parsedNext.getTime() <= parsedStart.getTime()) {
      return {
        success: false,
        error: "Webhook data next_payment_date must be strictly after period_start.",
      };
    }
    nextPaymentDate = parsedNext.toISOString();
  }

  // Transaction details (optional)
  let providerTransactionStatus: string | null = null;
  let providerTransactionId: string | null = null;
  let providerReference: string | null = null;

  if (isPlainObject(data.transaction)) {
    const txn = data.transaction as UnknownRecord;
    if (txn.status !== undefined && txn.status !== null) {
      if (typeof txn.status !== "string" || txn.status.trim() !== txn.status || txn.status.length === 0) {
        return {
          success: false,
          error: "Webhook data transaction status is invalid.",
        };
      }
      if (txn.status !== "success") {
        return {
          success: false,
          error: 'Webhook data transaction status must be "success".',
        };
      }
      providerTransactionStatus = txn.status;
    }
    if (txn.id !== undefined && txn.id !== null) {
      const txnIdRes = validateTransactionId(txn.id);
      if (!txnIdRes.success) {
        return {
          success: false,
          error: "Webhook data transaction id is invalid.",
        };
      }
      providerTransactionId = txnIdRes.data;
    }
    if (typeof txn.reference === "string" && txn.reference.trim().length > 0) {
      const refTrimmed = txn.reference.trim();
      if (refTrimmed !== txn.reference || refTrimmed.length > 255 || WHITESPACE_OR_CONTROL_REGEX.test(refTrimmed)) {
        return {
          success: false,
          error: "Webhook data transaction reference has an invalid format.",
        };
      }
      providerReference = refTrimmed;
    }
  }

  if (!providerReference && typeof data.reference === "string" && data.reference.trim().length > 0) {
    const refTrimmed = data.reference.trim();
    if (refTrimmed !== data.reference || refTrimmed.length > 255 || WHITESPACE_OR_CONTROL_REGEX.test(refTrimmed)) {
      return {
        success: false,
        error: "Webhook data reference has an invalid format.",
      };
    }
    providerReference = refTrimmed;
  }

  // Created at / Occurred at timestamp
  const rawCreatedAt = data.created_at ?? data.createdAt ?? data.paid_at ?? data.paidAt;
  if (
    typeof rawCreatedAt !== "string" ||
    rawCreatedAt.trim() !== rawCreatedAt ||
    rawCreatedAt.length === 0
  ) {
    return {
      success: false,
      error: "Webhook data created_at must be a non-empty ISO string.",
    };
  }
  const parsedCreatedAt = new Date(rawCreatedAt);
  if (Number.isNaN(parsedCreatedAt.getTime())) {
    return {
      success: false,
      error: "Webhook data created_at is not a valid date.",
    };
  }
  const occurredAt = parsedCreatedAt.toISOString();

  return {
    success: true,
    data: {
      environment,
      providerInvoiceCode,
      providerSubscriptionCode,
      providerCustomerCode,
      providerPlanCode,
      providerInvoiceStatus,
      providerPaid,
      providerTransactionStatus,
      providerTransactionId,
      providerReference,
      amountMinor,
      currency,
      periodStart,
      periodEnd,
      paidAt,
      nextPaymentDate,
      occurredAt,
      providerEventId: null,
    },
  };
}

export function validatePaystackInvoiceUpdateTransactionResponse(
  json: unknown,
  expected: {
    environment: "test" | "live";
    providerReference: string;
    providerCustomerCode: string;
    providerPlanCode?: string | null;
    amountMinor: number;
    currency: string;
  },
): DecodeResult<VerifiedInvoiceUpdateTransactionData> {
  if (!isPlainObject(json)) {
    return {
      success: false,
      error: "Paystack verification response must be a non-null object.",
    };
  }

  if (json.status !== true) {
    return {
      success: false,
      error: "Paystack verification response status is not true.",
    };
  }

  if (!isPlainObject(json.data)) {
    return {
      success: false,
      error: "Paystack verification response data must be a non-null object.",
    };
  }

  const data = json.data as UnknownRecord;

  // 1. Transaction Status
  if (data.status !== "success") {
    return {
      success: false,
      error: `Verified transaction status is '${String(data.status)}', expected 'success'.`,
    };
  }

  // 2. Reference Matching
  const reference = data.reference;
  if (typeof reference !== "string" || reference !== expected.providerReference) {
    return {
      success: false,
      error: "Verified transaction reference does not match expected reference.",
    };
  }

  // 3. Domain Matching
  const domain = data.domain;
  if (typeof domain !== "string" || domain !== expected.environment) {
    return {
      success: false,
      error: `Verified transaction domain '${String(domain)}' does not match environment '${expected.environment}'.`,
    };
  }

  // 4. Amount Minor
  const amount = data.amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount !== expected.amountMinor) {
    return {
      success: false,
      error: "Verified transaction amount does not match expected amount.",
    };
  }

  // 5. Currency
  const currency = data.currency;
  if (typeof currency !== "string" || currency !== expected.currency) {
    return {
      success: false,
      error: "Verified transaction currency does not match expected currency.",
    };
  }

  // 6. Paid At Timestamp
  const rawPaidAt = data.paid_at ?? data.paidAt;
  if (typeof rawPaidAt !== "string" || rawPaidAt.trim().length === 0) {
    return {
      success: false,
      error: "Verified transaction is missing a valid paid_at timestamp.",
    };
  }

  const parsedPaidAt = new Date(rawPaidAt);
  if (Number.isNaN(parsedPaidAt.getTime())) {
    return {
      success: false,
      error: "Verified transaction paid_at timestamp is not a valid date.",
    };
  }
  const paidAt = parsedPaidAt.toISOString();

  // 7. Transaction ID
  const transactionIdResult = validateTransactionId(data.id);
  if (transactionIdResult.success === false) {
    return {
      success: false,
      error: transactionIdResult.error,
    };
  }
  const providerTransactionId = transactionIdResult.data;

  // 8. Provider Plan Code
  let providerPlanCode: string | null = null;
  if (typeof data.plan === "string" && data.plan.trim().length > 0) {
    const trimmedPlan = data.plan.trim();
    if (!PAYSTACK_PLAN_CODE_REGEX.test(trimmedPlan)) {
      return {
        success: false,
        error: "Verified transaction plan code has invalid format.",
      };
    }
    providerPlanCode = trimmedPlan;
  } else if (
    isPlainObject(data.plan) &&
    typeof (data.plan as UnknownRecord).plan_code === "string" &&
    ((data.plan as UnknownRecord).plan_code as string).trim().length > 0
  ) {
    const trimmedPlan = ((data.plan as UnknownRecord).plan_code as string).trim();
    if (!PAYSTACK_PLAN_CODE_REGEX.test(trimmedPlan)) {
      return {
        success: false,
        error: "Verified transaction plan_code has invalid format.",
      };
    }
    providerPlanCode = trimmedPlan;
  }

  if (expected.providerPlanCode !== undefined && expected.providerPlanCode !== null) {
    if (providerPlanCode !== null && providerPlanCode !== expected.providerPlanCode) {
      return {
        success: false,
        error: "Verified transaction plan code does not match expected plan code.",
      };
    }
  }

  // 9. Customer Data
  if (!isPlainObject(data.customer)) {
    return {
      success: false,
      error: "Verified transaction customer must be an object.",
    };
  }
  const custCode = (data.customer as UnknownRecord).customer_code;
  if (
    typeof custCode !== "string" ||
    custCode.trim() !== custCode ||
    !PAYSTACK_CUSTOMER_CODE_REGEX.test(custCode)
  ) {
    return {
      success: false,
      error: "Verified transaction customer_code has invalid format.",
    };
  }
  if (custCode !== expected.providerCustomerCode) {
    return {
      success: false,
      error: "Verified transaction customer_code does not match expected customer.",
    };
  }

  return {
    success: true,
    data: {
      environment: expected.environment,
      providerReference: expected.providerReference,
      providerTransactionId,
      providerTransactionStatus: "success",
      amountMinor: expected.amountMinor,
      currency: expected.currency,
      paidAt,
      providerCustomerCode: expected.providerCustomerCode,
      providerPlanCode: providerPlanCode ?? expected.providerPlanCode ?? null,
    },
  };
}

export function validatePaystackInvoiceUpdateSubscriptionResponse(
  json: unknown,
  expected: {
    environment: "test" | "live";
    providerSubscriptionCode: string;
    providerCustomerCode: string;
    providerPlanCode?: string | null;
    providerInvoiceCode: string;
    amountMinor: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
  },
): DecodeResult<VerifiedInvoiceUpdateSubscriptionData> {
  if (!isPlainObject(json)) {
    return {
      success: false,
      error: "Paystack subscription response must be a non-null object.",
    };
  }

  if (json.status !== true) {
    return {
      success: false,
      error: "Paystack subscription response status is not true.",
    };
  }

  if (!isPlainObject(json.data)) {
    return {
      success: false,
      error: "Paystack subscription response data must be a non-null object.",
    };
  }

  const data = json.data as UnknownRecord;

  // Environment / domain
  if (
    typeof data.domain !== "string" ||
    (data.domain !== "test" && data.domain !== "live") ||
    data.domain.trim() !== data.domain
  ) {
    return {
      success: false,
      error: 'Verified subscription domain must be "test" or "live".',
    };
  }
  if (data.domain !== expected.environment) {
    return {
      success: false,
      error: "Verified subscription domain does not match expected environment.",
    };
  }

  // Subscription Code
  if (
    typeof data.subscription_code !== "string" ||
    data.subscription_code.trim() !== data.subscription_code ||
    !PAYSTACK_SUBSCRIPTION_CODE_REGEX.test(data.subscription_code)
  ) {
    return {
      success: false,
      error: "Verified subscription code has an invalid format.",
    };
  }
  if (data.subscription_code !== expected.providerSubscriptionCode) {
    return {
      success: false,
      error: "Verified subscription code does not match expected subscription.",
    };
  }

  // Provider ID
  const subIdResult = validateProviderId(data.id);
  if (!subIdResult.success) {
    return {
      success: false,
      error: "Verified subscription ID is invalid.",
    };
  }

  // Customer code
  if (!isPlainObject(data.customer)) {
    return {
      success: false,
      error: "Verified subscription customer must be an object.",
    };
  }
  const custCode = (data.customer as UnknownRecord).customer_code;
  if (
    typeof custCode !== "string" ||
    custCode.trim() !== custCode ||
    !PAYSTACK_CUSTOMER_CODE_REGEX.test(custCode)
  ) {
    return {
      success: false,
      error: "Verified subscription customer_code has an invalid format.",
    };
  }
  if (custCode !== expected.providerCustomerCode) {
    return {
      success: false,
      error: "Verified subscription customer_code does not match expected customer.",
    };
  }

  // Plan code verification
  let snapshotPlanCode: string | null = null;
  if (isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).plan_code === "string") {
    snapshotPlanCode = (data.plan as UnknownRecord).plan_code as string;
  } else if (typeof data.plan === "string") {
    snapshotPlanCode = data.plan;
  }
  if (expected.providerPlanCode !== undefined && expected.providerPlanCode !== null) {
    if (snapshotPlanCode === null || snapshotPlanCode !== expected.providerPlanCode) {
      return {
        success: false,
        error: "Verified subscription plan_code does not match expected plan.",
      };
    }
  }

  // Commercial amount and currency
  const snapshotAmount =
    typeof data.amount === "number"
      ? data.amount
      : isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).amount === "number"
        ? ((data.plan as UnknownRecord).amount as number)
        : null;

  if (snapshotAmount !== expected.amountMinor) {
    return {
      success: false,
      error: "Verified subscription amount does not match expected amount.",
    };
  }

  const snapshotCurrency =
    typeof data.currency === "string"
      ? data.currency
      : isPlainObject(data.plan) && typeof (data.plan as UnknownRecord).currency === "string"
        ? ((data.plan as UnknownRecord).currency as string)
        : null;

  if (snapshotCurrency !== expected.currency) {
    return {
      success: false,
      error: "Verified subscription currency does not match expected currency.",
    };
  }

  // Subscription Status (exact recognized set)
  if (
    typeof data.status !== "string" ||
    !PAYSTACK_RECOGNIZED_SUBSCRIPTION_STATUSES.has(data.status)
  ) {
    return {
      success: false,
      error: "Verified subscription status is not a recognized status.",
    };
  }
  const providerSubscriptionStatus = data.status;

  // Next payment date (optional)
  let nextPaymentDate: string | null = null;
  const rawNextPaymentDate = data.next_payment_date;
  if (rawNextPaymentDate !== null && rawNextPaymentDate !== undefined) {
    if (
      typeof rawNextPaymentDate !== "string" ||
      rawNextPaymentDate.trim() !== rawNextPaymentDate ||
      rawNextPaymentDate.length === 0
    ) {
      return {
        success: false,
        error: "Verified subscription next_payment_date timestamp is invalid.",
      };
    }
    const parsedNext = new Date(rawNextPaymentDate);
    if (Number.isNaN(parsedNext.getTime())) {
      return {
        success: false,
        error: "Verified subscription next_payment_date timestamp is not a valid date.",
      };
    }
    nextPaymentDate = parsedNext.toISOString();
  }

  // Invoice validation in most_recent_invoice or invoices
  let matchedInvoiceCode: string | null = null;

  const validateInvoiceSnapshotFields = (
    inv: UnknownRecord,
    context: string,
  ): { success: true } | { success: false; error: string } => {
    if (typeof inv.amount === "number" && inv.amount !== expected.amountMinor) {
      return {
        success: false,
        error: `Contradictory invoice snapshot amount in ${context}.`,
      };
    }
    if (typeof inv.currency === "string" && inv.currency !== expected.currency) {
      return {
        success: false,
        error: `Contradictory invoice snapshot currency in ${context}.`,
      };
    }
    if (typeof inv.period_start === "string") {
      const ps = new Date(inv.period_start);
      if (!Number.isNaN(ps.getTime()) && ps.toISOString() !== expected.periodStart) {
        return {
          success: false,
          error: `Contradictory invoice snapshot period start in ${context}.`,
        };
      }
    }
    if (typeof inv.period_end === "string") {
      const pe = new Date(inv.period_end);
      if (!Number.isNaN(pe.getTime()) && pe.toISOString() !== expected.periodEnd) {
        return {
          success: false,
          error: `Contradictory invoice snapshot period end in ${context}.`,
        };
      }
    }
    return { success: true };
  };

  // Check most_recent_invoice
  if (isPlainObject(data.most_recent_invoice)) {
    const mri = data.most_recent_invoice as UnknownRecord;
    const mriCode =
      typeof mri.invoice_code === "string"
        ? mri.invoice_code
        : typeof mri.code === "string"
          ? mri.code
          : null;
    if (mriCode === expected.providerInvoiceCode) {
      const valRes = validateInvoiceSnapshotFields(mri, "most_recent_invoice");
      if (valRes.success === false) {
        return { success: false, error: valRes.error };
      }
      matchedInvoiceCode = expected.providerInvoiceCode;
    }
  }

  // Check invoices collection if present
  if (data.invoices !== undefined && data.invoices !== null) {
    if (!Array.isArray(data.invoices)) {
      return {
        success: false,
        error: "Verified subscription invoices field must be an array when present.",
      };
    }
    if (data.invoices.length > 50) {
      return {
        success: false,
        error: "Verified subscription invoices collection exceeds maximum bounded limit.",
      };
    }
    for (let i = 0; i < data.invoices.length; i++) {
      const inv = data.invoices[i];
      if (!isPlainObject(inv)) {
        return {
          success: false,
          error: "Malformed invoice item in invoices collection.",
        };
      }
      const invCode =
        typeof (inv as UnknownRecord).invoice_code === "string"
          ? ((inv as UnknownRecord).invoice_code as string)
          : typeof (inv as UnknownRecord).code === "string"
            ? ((inv as UnknownRecord).code as string)
            : null;
      if (invCode === expected.providerInvoiceCode) {
        const valRes = validateInvoiceSnapshotFields(inv as UnknownRecord, "invoices collection");
        if (valRes.success === false) {
          return { success: false, error: valRes.error };
        }
        matchedInvoiceCode = expected.providerInvoiceCode;
      }
    }
  }

  // Timestamp
  const updatedAtRaw = data.updatedAt ?? data.updated_at;
  const createdAtRaw = data.createdAt ?? data.created_at;
  const chosenTime =
    typeof updatedAtRaw === "string" && updatedAtRaw.length > 0
      ? updatedAtRaw
      : typeof createdAtRaw === "string" && createdAtRaw.length > 0
        ? createdAtRaw
        : null;
  if (!chosenTime) {
    return {
      success: false,
      error: "Verified subscription is missing timestamp.",
    };
  }
  const parsedTime = new Date(chosenTime);
  if (Number.isNaN(parsedTime.getTime())) {
    return {
      success: false,
      error: "Verified subscription timestamp is not a valid date.",
    };
  }
  const occurredAt = parsedTime.toISOString();

  return {
    success: true,
    data: {
      environment: expected.environment,
      providerSubscriptionCode: expected.providerSubscriptionCode,
      providerSubscriptionId: subIdResult.data,
      providerCustomerCode: expected.providerCustomerCode,
      providerPlanCode: snapshotPlanCode,
      providerSubscriptionStatus,
      amountMinor: expected.amountMinor,
      currency: expected.currency,
      nextPaymentDate,
      matchedInvoiceCode,
      occurredAt,
    },
  };
}

export function decodeProcessPaystackInvoiceUpdateSuccessRpcResult(
  data: unknown,
): DecodeResult<ProcessPaystackInvoiceUpdateSuccessRpcResult> {
  if (!Array.isArray(data) || data.length !== 1 || !isPlainObject(data[0])) {
    return {
      success: false,
      error: "RPC result must be a single-row array.",
    };
  }

  const row = data[0] as UnknownRecord;

  if (!hasExactKeys(row, PROCESS_INVOICE_UPDATE_SUCCESS_KEYS)) {
    return {
      success: false,
      error: "RPC result row does not have exact expected keys.",
    };
  }

  // webhook_event_id
  if (typeof row.webhook_event_id !== "string" || !isValidUuid(row.webhook_event_id)) {
    return {
      success: false,
      error: "RPC result webhook_event_id must be a valid UUID.",
    };
  }

  // provider_subscription_record_id
  if (
    typeof row.provider_subscription_record_id !== "string" ||
    !isValidUuid(row.provider_subscription_record_id)
  ) {
    return {
      success: false,
      error: "RPC result provider_subscription_record_id must be a valid UUID.",
    };
  }

  // subscription_id
  if (typeof row.subscription_id !== "string" || !isValidUuid(row.subscription_id)) {
    return {
      success: false,
      error: "RPC result subscription_id must be a valid UUID.",
    };
  }

  // provider_invoice_code
  if (
    typeof row.provider_invoice_code !== "string" ||
    row.provider_invoice_code.trim() !== row.provider_invoice_code ||
    row.provider_invoice_code.length < 5 ||
    row.provider_invoice_code.length > 255 ||
    !PAYSTACK_INVOICE_CODE_REGEX.test(row.provider_invoice_code)
  ) {
    return {
      success: false,
      error: "RPC result provider_invoice_code has an invalid format.",
    };
  }

  // amount_minor
  if (
    typeof row.amount_minor !== "number" ||
    !Number.isSafeInteger(row.amount_minor) ||
    row.amount_minor <= 0
  ) {
    return {
      success: false,
      error: "RPC result amount_minor must be a positive integer.",
    };
  }

  // currency
  if (
    typeof row.currency !== "string" ||
    !/^[A-Z]{3}$/.test(row.currency) ||
    row.currency.trim() !== row.currency
  ) {
    return {
      success: false,
      error: "RPC result currency must be 3 uppercase ASCII letters.",
    };
  }

  // is_reused
  if (typeof row.is_reused !== "boolean") {
    return {
      success: false,
      error: "RPC result is_reused must be a boolean.",
    };
  }

  // is_ignored
  if (typeof row.is_ignored !== "boolean") {
    return {
      success: false,
      error: "RPC result is_ignored must be a boolean.",
    };
  }

  // invoice_id
  if (row.invoice_id !== null) {
    if (typeof row.invoice_id !== "string" || !isValidUuid(row.invoice_id)) {
      return {
        success: false,
        error: "RPC result invoice_id must be null or a valid UUID.",
      };
    }
  }

  // payment_id
  if (row.payment_id !== null) {
    if (typeof row.payment_id !== "string" || !isValidUuid(row.payment_id)) {
      return {
        success: false,
        error: "RPC result payment_id must be null or a valid UUID.",
      };
    }
  }

  // invoice_status
  if (row.invoice_status !== null) {
    if (
      typeof row.invoice_status !== "string" ||
      row.invoice_status.trim() !== row.invoice_status ||
      row.invoice_status.length === 0 ||
      row.invoice_status.length > 50 ||
      WHITESPACE_OR_CONTROL_REGEX.test(row.invoice_status)
    ) {
      return {
        success: false,
        error: "RPC result invoice_status must be null or a bounded trimmed string.",
      };
    }
  }

  // payment_status
  if (row.payment_status !== null) {
    if (
      typeof row.payment_status !== "string" ||
      row.payment_status.trim() !== row.payment_status ||
      row.payment_status.length === 0 ||
      row.payment_status.length > 50 ||
      WHITESPACE_OR_CONTROL_REGEX.test(row.payment_status)
    ) {
      return {
        success: false,
        error: "RPC result payment_status must be null or a bounded trimmed string.",
      };
    }
  }

  // subscription_status
  if (row.subscription_status !== null) {
    if (
      typeof row.subscription_status !== "string" ||
      row.subscription_status.trim() !== row.subscription_status ||
      row.subscription_status.length === 0 ||
      row.subscription_status.length > 50 ||
      WHITESPACE_OR_CONTROL_REGEX.test(row.subscription_status)
    ) {
      return {
        success: false,
        error: "RPC result subscription_status must be null or a bounded trimmed string.",
      };
    }
  }

  // current_period_start
  let current_period_start: string | null = null;
  if (row.current_period_start !== null && row.current_period_start !== undefined) {
    if (
      typeof row.current_period_start !== "string" ||
      row.current_period_start.trim() !== row.current_period_start ||
      row.current_period_start.length === 0
    ) {
      return {
        success: false,
        error: "RPC result current_period_start must be null or a valid ISO string.",
      };
    }
    const parsed = new Date(row.current_period_start);
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        error: "RPC result current_period_start is not a valid date.",
      };
    }
    current_period_start = parsed.toISOString();
  }

  // current_period_end
  let current_period_end: string | null = null;
  if (row.current_period_end !== null && row.current_period_end !== undefined) {
    if (
      typeof row.current_period_end !== "string" ||
      row.current_period_end.trim() !== row.current_period_end ||
      row.current_period_end.length === 0
    ) {
      return {
        success: false,
        error: "RPC result current_period_end must be null or a valid ISO string.",
      };
    }
    const parsed = new Date(row.current_period_end);
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        error: "RPC result current_period_end is not a valid date.",
      };
    }
    current_period_end = parsed.toISOString();
  }

  // next_renewal_at
  let next_renewal_at: string | null = null;
  if (row.next_renewal_at !== null && row.next_renewal_at !== undefined) {
    if (
      typeof row.next_renewal_at !== "string" ||
      row.next_renewal_at.trim() !== row.next_renewal_at ||
      row.next_renewal_at.length === 0
    ) {
      return {
        success: false,
        error: "RPC result next_renewal_at must be null or a valid ISO string.",
      };
    }
    const parsed = new Date(row.next_renewal_at);
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        error: "RPC result next_renewal_at is not a valid date.",
      };
    }
    next_renewal_at = parsed.toISOString();
  }

  // past_due_since
  let past_due_since: string | null = null;
  if (row.past_due_since !== null && row.past_due_since !== undefined) {
    if (
      typeof row.past_due_since !== "string" ||
      row.past_due_since.trim() !== row.past_due_since ||
      row.past_due_since.length === 0
    ) {
      return {
        success: false,
        error: "RPC result past_due_since must be null or a valid ISO string.",
      };
    }
    const parsed = new Date(row.past_due_since);
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        error: "RPC result past_due_since is not a valid date.",
      };
    }
    past_due_since = parsed.toISOString();
  }

  // Non-ignored result must have non-null invoice_id and invoice_status 'paid'
  if (!row.is_ignored) {
    if (row.invoice_id === null || row.invoice_status === null) {
      return {
        success: false,
        error: "Non-ignored RPC result must return non-null invoice_id and invoice_status.",
      };
    }
    if (row.invoice_status !== "paid") {
      return {
        success: false,
        error: "Non-ignored RPC result must have invoice_status 'paid'.",
      };
    }
  }

  // Fresh non-ignored result must return subscription_status
  if (!row.is_reused && !row.is_ignored) {
    if (row.subscription_status === null) {
      return {
        success: false,
        error: "Fresh non-ignored RPC result must have subscription_status.",
      };
    }
  }

  return {
    success: true,
    data: {
      webhook_event_id: row.webhook_event_id as string,
      invoice_id: row.invoice_id as string | null,
      payment_id: row.payment_id as string | null,
      provider_subscription_record_id: row.provider_subscription_record_id as string,
      subscription_id: row.subscription_id as string,
      provider_invoice_code: row.provider_invoice_code as string,
      invoice_status: row.invoice_status as string | null,
      payment_status: row.payment_status as string | null,
      subscription_status: row.subscription_status as string | null,
      amount_minor: row.amount_minor as number,
      currency: row.currency as string,
      current_period_start,
      current_period_end,
      next_renewal_at,
      past_due_since,
      is_reused: row.is_reused as boolean,
      is_ignored: row.is_ignored as boolean,
    },
  };
}

export function sanitizeInvoiceUpdateSuccessDatabaseError(error: unknown): {
  status: number;
  message: string;
  code: string;
  headers?: Record<string, string>;
} {
  if (!isPlainObject(error)) {
    return {
      status: 500,
      message: "Internal server error.",
      code: "PAYSTACK_INTERNAL_ERROR",
    };
  }

  const errObj = error as UnknownRecord;
  let code: string | undefined;
  if (typeof errObj.code === "string" && errObj.code.length > 0) {
    code = errObj.code;
  } else if (typeof errObj.sqlstate === "string" && errObj.sqlstate.length > 0) {
    code = errObj.sqlstate;
  }

  // Missing prerequisite (P0002) - Subscription not found or environment mismatch
  if (code === "P0002") {
    return {
      status: 503,
      message: "Invoice update prerequisite is pending. Please retry later.",
      code: "PAYSTACK_INVOICE_UPDATE_PREREQUISITE_PENDING",
      headers: { "Retry-After": "30" },
    };
  }

  // Unique constraint / collision violation (23505)
  if (code === "23505") {
    return {
      status: 409,
      message: "Invoice update identifier or payload collision.",
      code: "PAYSTACK_INVOICE_UPDATE_IDEMPOTENCY_CONFLICT",
    };
  }

  // Commercial / lifecycle mismatch (23514, 22023, 22004, 22000)
  if (
    code === "23514" ||
    code === "22023" ||
    code === "22004" ||
    code === "22000"
  ) {
    return {
      status: 409,
      message: "Invoice update lifecycle or constraint conflict.",
      code: "PAYSTACK_INVOICE_UPDATE_DATA_MISMATCH",
    };
  }

  // Transient database errors (retryable) (53300, 40001, 40P01, 57P01, 08006, 08001)
  if (
    code === "53300" ||
    code === "40001" ||
    code === "40P01" ||
    code === "57P01" ||
    code === "08006" ||
    code === "08001"
  ) {
    return {
      status: 503,
      message: "Transient database failure.",
      code: "PAYSTACK_INVOICE_UPDATE_TRANSIENT_DATABASE_FAILURE",
    };
  }

  return {
    status: 500,
    message: "Internal server error.",
    code: "PAYSTACK_INTERNAL_ERROR",
  };
}
