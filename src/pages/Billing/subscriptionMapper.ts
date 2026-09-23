import { CompanySubscriptionWithPlan } from "../../services/billingService";
import { SHARED_BUSINESS_PLAN, formatDateDisplay } from "../../config/plans";
import { SubscriptionItem, SubscriptionStatus, AutoRenewalStatus } from "./types";

/**
 * Formats minor currency units into localized currency string.
 */
export function formatBillingCurrency(amountMinor: number, currency = "ZAR"): string {
  const amount = (amountMinor || 0) / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency || "ZAR",
  }).format(amount);
}

/**
 * Formats interval string into normalized suffix and billed text.
 */
export function formatBillingInterval(rawInterval?: string | null) {
  const normalized = (rawInterval || "monthly").toLowerCase().trim();
  const suffix = normalized === "monthly" || normalized === "month" ? "month" : normalized;
  const billed = normalized === "monthly" || normalized === "month" ? "monthly" : normalized;
  return { suffix, billed };
}

/**
 * Pure mapper converting database CompanySubscriptionWithPlan into UI SubscriptionItem.
 */
export function mapDatabaseSubscriptionToUi(
  sub: CompanySubscriptionWithPlan,
  companyName: string,
  nowMs: number = Date.now()
): SubscriptionItem {
  const plan = sub.plan;
  const planName = plan?.name || SHARED_BUSINESS_PLAN.name;
  const planCode = plan?.code || "business-monthly";
  const benefits = SHARED_BUSINESS_PLAN.benefits;

  const rawAmountMinor = typeof sub.amount_minor === "number" 
    ? sub.amount_minor 
    : (plan?.amount_minor ?? 0);
  const amount = rawAmountMinor / 100;
  const currency = sub.currency || plan?.currency || "ZAR";
  const formattedPrice = formatBillingCurrency(rawAmountMinor, currency);

  const { suffix: intervalSuffix, billed: intervalBilled } = formatBillingInterval(sub.billing_interval || plan?.billing_interval);
  const formattedAmount = `${formattedPrice} / ${intervalSuffix}`;

  const paidPeriodExpired = !sub.current_period_end || Date.parse(sub.current_period_end) <= nowMs;
  const trialExpired = !!sub.trial_ends_at && Date.parse(sub.trial_ends_at) <= nowMs;
  const renewalDateObj = sub.status === "trialing"
    ? sub.trial_ends_at
    : ((sub.status === "active" || sub.status === "non_renewing") && paidPeriodExpired || sub.status === "expired")
    ? sub.current_period_end || sub.trial_ends_at
    : sub.auto_renew_enabled
    ? sub.next_renewal_at || sub.current_period_end || sub.trial_ends_at
    : sub.current_period_end || sub.trial_ends_at || sub.next_renewal_at;
  const formattedNextRenewal = renewalDateObj ? formatDateDisplay(renewalDateObj) : "—";
  const formattedSelectionDate = sub.created_at ? formatDateDisplay(sub.created_at) : undefined;
  const formattedTrialStart = sub.trial_started_at ? formatDateDisplay(sub.trial_started_at) : undefined;
  const formattedTrialEnd = sub.trial_ends_at ? formatDateDisplay(sub.trial_ends_at) : undefined;
  const formattedPeriodStart = sub.current_period_start ? formatDateDisplay(sub.current_period_start) : undefined;
  const formattedPeriodEnd = sub.current_period_end ? formatDateDisplay(sub.current_period_end) : undefined;

  const autoRenewal: AutoRenewalStatus = sub.auto_renew_enabled ? "enabled" : "disabled";

  const status: SubscriptionStatus =
    ((sub.status === "active" || sub.status === "non_renewing") && paidPeriodExpired || sub.status === "trialing" && trialExpired)
      ? "expired" : sub.status;
  const checkoutEligible = ["pending_activation", "trialing", "past_due", "expired"].includes(status);
  const isPendingActivation = status === "pending_activation";
  const isTrialing = status === "trialing";

  let noticeMessage = sub.notice_message || undefined;
  if (!noticeMessage && isTrialing && formattedTrialEnd) {
    noticeMessage = `Trial active until ${formattedTrialEnd}. Choose Pay now to activate your paid subscription.`;
  }

  return {
    id: sub.id,
    subscriptionCode: sub.subscription_reference,
    planName,
    associatedEntity: companyName,
    status,
    billingInterval: (intervalBilled as any) || "monthly",
    amount,
    currency,
    formattedAmount,
    nextRenewalDate: formattedNextRenewal,
    autoRenewal,
    autoRenewalAvailable: false,
    autoRenewalIneligibleReason: "Choose auto-renewal at checkout. Manage an existing recurring subscription through Paystack.",
    noticeMessage,
    planCode,
    selectionDate: formattedSelectionDate,
    trialStartDate: formattedTrialStart,
    trialEndDate: formattedTrialEnd,
    trialEndsAtIso: sub.trial_ends_at || undefined,
    currentPeriodStart: formattedPeriodStart,
    currentPeriodEnd: formattedPeriodEnd,
    provisionalFirstBillingDate: formattedTrialEnd || formattedNextRenewal,
    cancelAnytimeInfo: `Billed ${intervalBilled} • Cancel anytime`,
    benefits,
    isPendingActivation,
    isTrialing,
    checkoutEligible
  };
}
