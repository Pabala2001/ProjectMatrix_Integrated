import { supabase } from "../lib/supabase";
import {
  BillingPlan,
  BillingSubscription,
  BillingSubscriptionStatus,
  BillingAccessMode,
  CompanyBillingEntitlement,
} from "../types";

/**
 * Format minutes into a user-friendly hyphenated UI label.
 *
 * Rules:
 *  5     -> "5-Minute"
 *  60    -> "1-Hour"
 *  120   -> "2-Hour"
 *  1440  -> "1-Day"
 *  10080 -> "7-Day"
 *
 * Rejects non-finite, negative, or non-integer numbers.
 */
export function formatTrialDuration(minutes: number): string {
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    !Number.isInteger(minutes) ||
    minutes < 0
  ) {
    throw new Error(`Invalid trial duration minutes: ${minutes}. Must be a non-negative integer.`);
  }

  if (minutes === 0) {
    return "0-Minute";
  }

  // 1 day = 1440 minutes
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1-Day" : `${days}-Day`;
  }

  // 1 hour = 60 minutes
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1-Hour" : `${hours}-Hour`;
  }

  return `${minutes}-Minute`;
}

/**
 * Columns explicitly selected for BillingPlan to prevent schema drift.
 */
const BILLING_PLAN_SELECT_COLUMNS = [
  "id",
  "code",
  "name",
  "amount_minor",
  "currency",
  "billing_interval",
  "trial_duration_minutes",
  "cancel_anytime",
  "is_active",
  "paystack_plan_code",
  "created_at",
  "updated_at",
].join(", ");

/**
 * Validates whether an unknown value matches the expected BillingPlan shape.
 */
export function isValidBillingPlan(value: unknown): value is BillingPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  return (
    typeof plan.id === "string" &&
    plan.id.trim().length > 0 &&
    typeof plan.code === "string" &&
    plan.code.trim().length > 0 &&
    typeof plan.name === "string" &&
    typeof plan.amount_minor === "number" &&
    Number.isInteger(plan.amount_minor) &&
    plan.amount_minor > 0 &&
    typeof plan.currency === "string" &&
    plan.currency.length === 3 &&
    plan.billing_interval === "monthly" &&
    typeof plan.trial_duration_minutes === "number" &&
    Number.isInteger(plan.trial_duration_minutes) &&
    plan.trial_duration_minutes >= 0 &&
    typeof plan.cancel_anytime === "boolean" &&
    typeof plan.is_active === "boolean"
  );
}

/**
 * Validates whether an unknown value matches the expected BillingSubscription shape.
 */
export function isValidSubscriptionRecord(value: unknown): value is BillingSubscription {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.company_id === "string" &&
    typeof item.plan_id === "string" &&
    typeof item.subscription_reference === "string" &&
    typeof item.status === "string" &&
    typeof item.amount_minor === "number" &&
    typeof item.currency === "string" &&
    typeof item.auto_renew_enabled === "boolean"
  );
}

/**
 * Validates whether an unknown value matches the expected CompanySubscriptionWithPlan shape.
 */
export function isValidCompanySubscriptionWithPlan(
  value: unknown
): value is CompanySubscriptionWithPlan {
  if (!isValidSubscriptionRecord(value)) return false;
  const item = value as unknown as Record<string, unknown>;
  if (item.plan !== undefined && item.plan !== null) {
    return isValidBillingPlan(item.plan);
  }
  return true;
}

/**
 * Fetches an active BillingPlan by code from public.billing_plans.
 * Defaults to 'business-monthly'.
 */
export async function getActiveBillingPlan(
  planCode: string = "business-monthly"
): Promise<BillingPlan | null> {
  const normalizedCode = (planCode || "").trim();
  if (!normalizedCode) {
    throw new Error("Plan code cannot be empty.");
  }

  const { data, error } = await supabase
    .from("billing_plans")
    .select(BILLING_PLAN_SELECT_COLUMNS)
    .eq("code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (!isValidBillingPlan(data)) {
    throw new Error("Malformed billing plan data returned by query.");
  }

  return data;
}

/**
 * Invokes the atomic public.start_billing_trial RPC.
 *
 * Requirements:
 * - Defaults planCode to 'business-monthly'.
 * - Rejects empty companyId before calling Supabase.
 * - Does not send client-controlled commercial values, dates, or profile IDs.
 * - Normalizes single object or 1-element array RPC return.
 * - Rejects null, empty array, or malformed data.
 * - Throws any Supabase error.
 */
export async function startBillingTrial(
  companyId: string,
  planCode: string = "business-monthly"
): Promise<BillingSubscription> {
  const normalizedCompanyId = (companyId || "").trim();
  if (!normalizedCompanyId) {
    throw new Error("Company ID is required to start a billing trial.");
  }

  const normalizedPlanCode = (planCode || "business-monthly").trim() || "business-monthly";

  const { data, error } = await supabase.rpc("start_billing_trial", {
    p_company_id: normalizedCompanyId,
    p_plan_code: normalizedPlanCode,
  });

  if (error) {
    throw error;
  }

  // Normalize return value (handle single object or 1-element array from untyped client)
  let subscriptionData: unknown = data;
  if (Array.isArray(subscriptionData)) {
    if (subscriptionData.length === 0) {
      throw new Error("start_billing_trial returned an empty result.");
    }
    subscriptionData = subscriptionData[0];
  }

  if (!isValidSubscriptionRecord(subscriptionData)) {
    throw new Error("Malformed subscription data returned by start_billing_trial.");
  }

  return subscriptionData;
}

export interface CompanySubscriptionWithPlan extends BillingSubscription {
  plan?: BillingPlan | null;
}

const CURRENT_STATUSES: BillingSubscriptionStatus[] = [
  "pending_activation",
  "trialing",
  "active",
  "non_renewing",
  "past_due",
  "expired",
];

const BILLING_SUBSCRIPTION_JOIN_COLUMNS = `
  id,
  company_id,
  plan_id,
  subscription_reference,
  status,
  amount_minor,
  currency,
  billing_interval,
  trial_started_at,
  trial_ends_at,
  current_period_start,
  current_period_end,
  next_renewal_at,
  auto_renew_enabled,
  notice_message,
  cancelled_at,
  expired_at,
  created_by,
  created_at,
  updated_at,
  plan:billing_plans (
    id,
    code,
    name,
    amount_minor,
    currency,
    billing_interval,
    trial_duration_minutes,
    cancel_anytime,
    is_active,
    paystack_plan_code,
    created_at,
    updated_at
  )
`.replace(/\s+/g, " ").trim();

/**
 * Queries billing_subscriptions for the supplied company only.
 * Includes expired subscriptions so their billing recovery actions remain accessible.
 * Returns typed subscription-with-plan or null.
 */
export async function getCurrentCompanySubscription(
  companyId: string
): Promise<CompanySubscriptionWithPlan | null> {
  const normalizedCompanyId = (companyId || "").trim();
  if (!normalizedCompanyId) {
    throw new Error("Company ID is required to query current subscription.");
  }

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select(BILLING_SUBSCRIPTION_JOIN_COLUMNS)
    .eq("company_id", normalizedCompanyId)
    .in("status", CURRENT_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (!isValidCompanySubscriptionWithPlan(data)) {
    throw new Error("Malformed subscription data returned by query.");
  }

  return data;
}

/**
 * Validates whether an unknown value matches the expected CompanyBillingEntitlement shape.
 */
export function isValidBillingEntitlement(
  value: unknown
): value is CompanyBillingEntitlement {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.company_id === "string" &&
    item.company_id.trim().length > 0 &&
    (item.access_mode === "full" ||
      item.access_mode === "grace_period" ||
      item.access_mode === "read_only") &&
    typeof item.can_read === "boolean" &&
    typeof item.can_write === "boolean" &&
    typeof item.can_access_billing === "boolean" &&
    typeof item.can_export === "boolean" &&
    typeof item.can_access_settings === "boolean" &&
    typeof item.entitlement_state === "string" &&
    typeof item.reason_code === "string" &&
    typeof item.evaluated_at === "string"
  );
}

/**
 * In-flight promise cache for getCompanyBillingEntitlement to prevent duplicate concurrent RPC requests.
 */
const inFlightEntitlementRequests = new Map<string, Promise<CompanyBillingEntitlement>>();

/**
 * Event name for application-wide billing entitlement refresh synchronization.
 */
export const BILLING_REFRESH_EVENT = "projectmatrix:billing_refresh";

type BillingRefreshListener = (companyId?: string) => void;
const billingRefreshListeners = new Set<BillingRefreshListener>();

/**
 * Dispatches an application-wide event requesting billing entitlement refresh for a company or active workspace.
 */
export function dispatchBillingRefreshEvent(companyId?: string): void {
  const normalizedId = companyId ? companyId.trim() : undefined;

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(
        new CustomEvent(BILLING_REFRESH_EVENT, {
          detail: { companyId: normalizedId },
        })
      );
    } catch {
      // Ignore errors in environments where CustomEvent dispatch is not permitted
    }
  }

  billingRefreshListeners.forEach((listener) => {
    try {
      listener(normalizedId);
    } catch (e) {
      console.error("Error in billing refresh listener:", e);
    }
  });
}

/**
 * Subscribes to application-wide billing refresh events.
 * Returns an unsubscription callback.
 */
export function subscribeToBillingRefresh(
  callback: BillingRefreshListener
): () => void {
  billingRefreshListeners.add(callback);

  return () => {
    billingRefreshListeners.delete(callback);
  };
}

/**
 * Computes the next earliest future deadline (in milliseconds until expiration) for an entitlement.
 * Inspects authoritative grace_ends_at, trial_ends_at, and current_period_end if present.
 * Returns null if no future deadline exists or if the timestamp is invalid.
 */
export function calculateNextEntitlementDeadlineMs(
  entitlement: CompanyBillingEntitlement | null | undefined,
  nowMs: number = Date.now(),
  bufferMs: number = 1500
): number | null {
  if (!entitlement) return null;

  const candidateTimestamps: string[] = [];
  if (entitlement.grace_ends_at) {
    candidateTimestamps.push(entitlement.grace_ends_at);
  }

  const anyEntitlement = entitlement as unknown as Record<string, unknown>;
  if (typeof anyEntitlement.trial_ends_at === "string") {
    candidateTimestamps.push(anyEntitlement.trial_ends_at);
  }
  if (typeof anyEntitlement.current_period_end === "string") {
    candidateTimestamps.push(anyEntitlement.current_period_end);
  }

  let minDelayMs: number | null = null;

  for (const timestamp of candidateTimestamps) {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed) && parsed > nowMs) {
      const delay = parsed - nowMs + bufferMs;
      if (minDelayMs === null || delay < minDelayMs) {
        minDelayMs = delay;
      }
    }
  }

  return minDelayMs;
}

/**
 * Helper to determine if an entitlement represents a verification/network error rather than confirmed expiry.
 */
export function isBillingVerificationError(
  entitlement: CompanyBillingEntitlement | null | undefined
): boolean {
  if (!entitlement) return false;
  return (
    entitlement.reason_code === "RPC_FETCH_ERROR" ||
    entitlement.reason_code === "NETWORK_ERROR" ||
    entitlement.reason_code === "FETCH_TIMEOUT" ||
    entitlement.entitlement_state === "fallback" ||
    entitlement.reason_code === "FALLBACK_READ_ONLY"
  );
}

/**
 * Fetches the authoritative commercial entitlement for a company from public.get_company_billing_entitlement.
 * Strictly decodes the single-row result and validates structure.
 * Automatically deduplicates concurrent in-flight requests for the same companyId unless force = true.
 */
export async function getCompanyBillingEntitlement(
  companyId: string,
  options?: { force?: boolean }
): Promise<CompanyBillingEntitlement> {
  const normalizedCompanyId = (companyId || "").trim();
  if (!normalizedCompanyId) {
    throw new Error("Company ID is required to fetch billing entitlement.");
  }

  if (!options?.force) {
    const inFlight = inFlightEntitlementRequests.get(normalizedCompanyId);
    if (inFlight) {
      return inFlight;
    }
  }

  const fetchPromise = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_company_billing_entitlement", {
        p_company_id: normalizedCompanyId,
      });

      if (error) {
        throw error;
      }

      let entitlementData: unknown = data;
      if (Array.isArray(entitlementData)) {
        if (entitlementData.length === 0) {
          throw new Error("get_company_billing_entitlement returned an empty result.");
        }
        entitlementData = entitlementData[0];
      }

      if (!isValidBillingEntitlement(entitlementData)) {
        throw new Error("Malformed billing entitlement data returned by RPC.");
      }

      return entitlementData;
    } finally {
      inFlightEntitlementRequests.delete(normalizedCompanyId);
    }
  })();

  inFlightEntitlementRequests.set(normalizedCompanyId, fetchPromise);
  return fetchPromise;
}

/**
 * Returns a fail-closed read-only fallback entitlement representation.
 */
export function createFallbackReadOnlyEntitlement(
  companyId: string,
  reasonCode: string = "FALLBACK_READ_ONLY"
): CompanyBillingEntitlement {
  const now = new Date().toISOString();
  return {
    company_id: companyId || "",
    subscription_id: null,
    subscription_status: null,
    entitlement_state: "fallback",
    access_mode: "read_only",
    can_read: true,
    can_write: false,
    can_access_billing: true,
    can_export: true,
    can_access_settings: true,
    grace_started_at: null,
    grace_ends_at: null,
    read_only_since: now,
    reason_code: reasonCode,
    evaluated_at: now,
  };
}