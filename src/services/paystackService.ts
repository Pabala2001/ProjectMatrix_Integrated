import { supabase } from "../lib/supabase";
import { dispatchBillingRefreshEvent } from "./billingService";

export interface BillingPaymentSummary {
  id: string; subscription_id: string; provider_reference: string;
  amount_minor: number; currency: string; status: string; purpose: string;
  environment: "test" | "live"; paid_at: string | null; created_at: string;
}
export interface BillingMethodSummary {
  id: string; brand: string; last4: string; expiry_month: number; expiry_year: number;
  environment: "test" | "live"; created_at: string;
}
export interface CheckoutAttempt {
  idempotency_key: string; auto_renew: boolean; provider_reference?: string;
}
export interface BillingOverview {
  payments: BillingPaymentSummary[]; methods: BillingMethodSummary[];
  active_attempt: CheckoutAttempt | null; has_recurring_subscription: boolean;
}
export interface CheckoutResult {
  payment_id: string; provider_reference: string; payment_status: "pending" | "succeeded";
  checkout_url: string | null; is_reused: boolean;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const referencePattern = /^PAY-\d{8}-[0-9A-F]{32}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export class BillingCheckoutError extends Error {
  constructor(message: string, public code = "PAYMENT_UNCONFIRMED") { super(message); this.name = "BillingCheckoutError"; }
}
export function isCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048 || /[\s\x00-\x1f\x7f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.origin === "https://checkout.paystack.com" && !url.username && !url.password && !url.hash && url.pathname.length > 1;
  } catch { return false; }
}
export function decodeCheckoutResult(value: unknown): CheckoutResult {
  if (!object(value) || value.ok !== true || !object(value.data)) throw new BillingCheckoutError("Invalid checkout response. Check this payment again.");
  const row = value.data;
  if (typeof row.payment_id !== "string" || !uuid.test(row.payment_id) ||
      typeof row.provider_reference !== "string" || !referencePattern.test(row.provider_reference) ||
      typeof row.is_reused !== "boolean" ||
      !(row.payment_status === "succeeded" && row.checkout_url === null || row.payment_status === "pending" && isCheckoutUrl(row.checkout_url))) {
    throw new BillingCheckoutError("Checkout could not be confirmed. Check this payment again.");
  }
  return row as unknown as CheckoutResult;
}
function isAttempt(value: unknown): value is CheckoutAttempt {
  return object(value) && typeof value.idempotency_key === "string" && uuid.test(value.idempotency_key) &&
    typeof value.auto_renew === "boolean" && (value.provider_reference === undefined ||
    typeof value.provider_reference === "string" && referencePattern.test(value.provider_reference));
}
export async function getBillingOverview(companyId: string): Promise<BillingOverview> {
  if (!uuid.test(companyId)) throw new Error("Select a company to view billing.");
  const { data, error } = await supabase.rpc("get_billing_overview", { p_company_id: companyId });
  if (error) throw new Error("Billing records could not be loaded. Please try again.");
  if (!object(data) || !Array.isArray(data.payments) || !Array.isArray(data.methods) ||
      typeof data.has_recurring_subscription !== "boolean" || !(data.active_attempt === null || isAttempt(data.active_attempt)) ||
      data.payments.some(row => !object(row) || typeof row.id !== "string" || typeof row.provider_reference !== "string" ||
        typeof row.amount_minor !== "number" || !Number.isSafeInteger(row.amount_minor) || row.amount_minor <= 0 ||
        typeof row.currency !== "string" || typeof row.created_at !== "string" ||
        !["initialized", "pending", "succeeded", "failed", "cancelled"].includes(String(row.status)) || !["test", "live"].includes(String(row.environment))) ||
      data.methods.some(row => !object(row) || typeof row.id !== "string" || typeof row.brand !== "string" ||
        typeof row.last4 !== "string" || !/^\d{4}$/.test(row.last4) || typeof row.expiry_month !== "number" ||
        typeof row.expiry_year !== "number" || !["test", "live"].includes(String(row.environment)))) {
    throw new Error("Billing returned an invalid record. Please refresh.");
  }
  return data as unknown as BillingOverview;
}
async function attemptStorageKey(companyId: string): Promise<string> {
  if (!uuid.test(companyId)) throw new BillingCheckoutError("Select a company to manage billing.", "COMPANY_REQUIRED");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) throw new BillingCheckoutError("Please sign in again.", "AUTHENTICATION_REQUIRED");
  return `projectmatrix:checkout:${data.session.user.id}:${companyId}`;
}
function readSavedCheckout(key: string): CheckoutAttempt | null {
  try { const value = JSON.parse(localStorage.getItem(key) ?? "null"); return isAttempt(value) ? value : null; }
  catch { return null; }
}
export async function getSavedCheckout(companyId: string): Promise<CheckoutAttempt | null> {
  return readSavedCheckout(await attemptStorageKey(companyId));
}
function clearMatchingAttempt(key: string, attempt: CheckoutAttempt): void {
  // A late response must not delete an attempt opened after this one completed.
  try {
    if (readSavedCheckout(key)?.idempotency_key === attempt.idempotency_key) localStorage.removeItem(key);
  } catch { /* A retained key is safe to reconcile again. */ }
}
async function functionError(error: unknown, data: unknown): Promise<BillingCheckoutError> {
  let body: unknown = data;
  const context = object(error) ? error.context : undefined;
  if (context instanceof Response) {
    try { body = await context.clone().json(); } catch { /* Keep ambiguous results recoverable. */ }
  }
  return new BillingCheckoutError(object(body) && typeof body.error === "string" ? body.error : "Payment could not be confirmed. Use Check payment before trying again.",
    object(body) && typeof body.error_code === "string" ? body.error_code : "PAYMENT_UNCONFIRMED");
}
export async function runPaystackCheckout(companyId: string, options: {
  action?: "checkout" | "status"; autoRenew?: boolean; expectedReference?: string;
} = {}): Promise<CheckoutResult> {
  const storageKey = await attemptStorageKey(companyId);
  const overview = await getBillingOverview(companyId);
  // Read and persist synchronously after the overview fetch so concurrent calls
  // in this page see the same saved key before either invokes the Edge Function.
  let attempt = overview.active_attempt ?? readSavedCheckout(storageKey);
  if (!attempt) {
    if (options.action === "status") throw new BillingCheckoutError("No payment attempt was found for your account and this company.", "PAYMENT_NOT_FOUND");
    attempt = { idempotency_key: crypto.randomUUID(), auto_renew: options.autoRenew === true };
  }
  if (options.expectedReference && attempt.provider_reference !== options.expectedReference) {
    throw new BillingCheckoutError("This payment return does not match your payment for this company.", "PAYMENT_REFERENCE_MISMATCH");
  }
  // Persist before sending any request. Never generate another key after a timeout or lookup miss.
  try { localStorage.setItem(storageKey, JSON.stringify(attempt)); }
  catch { throw new BillingCheckoutError("Allow browser storage to keep this payment recoverable.", "PAYMENT_STORAGE_UNAVAILABLE"); }
  const { data, error } = await supabase.functions.invoke("paystack-checkout", { body: {
    company_id: companyId, idempotency_key: attempt.idempotency_key,
    auto_renew: attempt.auto_renew, action: options.action ?? "checkout",
  } });
  if (error || !object(data) || data.ok !== true) {
    const failure = await functionError(error, data);
    if (failure.code === "PAYMENT_ATTEMPT_TERMINAL") clearMatchingAttempt(storageKey, attempt);
    throw failure;
  }
  const result = decodeCheckoutResult(data);
  if (attempt.provider_reference && attempt.provider_reference !== result.provider_reference) {
    throw new BillingCheckoutError("The returned payment reference does not match the original attempt.", "PAYMENT_REFERENCE_MISMATCH");
  }
  if (result.payment_status === "succeeded") {
    clearMatchingAttempt(storageKey, attempt);
    dispatchBillingRefreshEvent(companyId);
  } else if (readSavedCheckout(storageKey)?.idempotency_key === attempt.idempotency_key) {
    try { localStorage.setItem(storageKey, JSON.stringify({ ...attempt, provider_reference: result.provider_reference })); }
    catch { throw new BillingCheckoutError("The payment reference could not be saved. Check this payment again.", "PAYMENT_STORAGE_UNAVAILABLE"); }
  }
  return result;
}
export async function getPaystackManagementLink(companyId: string): Promise<string> {
  if (!uuid.test(companyId)) throw new BillingCheckoutError("Select a company to manage billing.", "COMPANY_REQUIRED");
  const { data, error } = await supabase.functions.invoke("paystack-manage-subscription", { body: { company_id: companyId } });
  if (error || !object(data) || data.ok !== true) throw await functionError(error, data);
  const url = object(data.data) ? data.data.url : null;
  if (typeof url !== "string" || url.length > 4096 || /[\s\x00-\x1f\x7f]/.test(url)) throw new Error("Invalid subscription management link.");
  const parsed = new URL(url);
  if (parsed.origin !== "https://paystack.com" || !parsed.pathname.startsWith("/manage/subscriptions/") || parsed.pathname.length <= "/manage/subscriptions/".length || parsed.username || parsed.password || parsed.hash) throw new Error("Invalid subscription management link.");
  return url;
}


export type CurrentSubscriptionCard = Omit<BillingMethodSummary, "created_at">;
export async function getPaystackSubscriptionCard(companyId: string): Promise<CurrentSubscriptionCard | null> {
  if (!uuid.test(companyId)) throw new Error("Select a company to view its renewal card.");
  const { data, error } = await supabase.functions.invoke("paystack-manage-subscription", {
    body: { company_id: companyId, action: "card" },
  });
  if (error || !object(data) || data.ok !== true) throw await functionError(error, data);
  if (!object(data.data) || data.data.company_id !== companyId) throw new Error("The renewal card response did not match this company.");
  const card = data.data.card;
  if (card === null) return null;
  if (!object(card) || typeof card.id !== "string" || !uuid.test(card.id) ||
      typeof card.brand !== "string" || !/^[a-zA-Z][a-zA-Z -]{0,39}$/.test(card.brand) ||
      typeof card.last4 !== "string" || !/^[0-9]{4}$/.test(card.last4) ||
      !Number.isInteger(card.expiry_month) || Number(card.expiry_month) < 1 || Number(card.expiry_month) > 12 ||
      !Number.isInteger(card.expiry_year) || Number(card.expiry_year) < 2000 || Number(card.expiry_year) > 2199 ||
      !["test", "live"].includes(String(card.environment))) throw new Error("Invalid renewal card details. Please refresh.");
  return { id: card.id, brand: card.brand, last4: card.last4, expiry_month: card.expiry_month as number,
    expiry_year: card.expiry_year as number, environment: card.environment as "test" | "live" };
}
