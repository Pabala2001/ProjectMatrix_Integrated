import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Sparkles,
  Ban
} from "lucide-react";
import React from "react";

export type SubscriptionStatus = 
  | "pending_activation"
  | "trialing"
  | "active" 
  | "non_renewing" 
  | "past_due" 
  | "cancelled" 
  | "expired"
  | "trial" 
  | "payment_pending";

export type AutoRenewalStatus = 
  | "enabled" 
  | "disabled" 
  | "not_applicable";

export type BillingInterval = "monthly" | "annual" | "quarterly";

export interface SubscriptionItem {
  id: string;
  subscriptionCode: string;
  planName: string;
  associatedEntity: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  amount: number;
  currency: string;
  formattedAmount: string;
  nextRenewalDate: string;
  autoRenewal: AutoRenewalStatus;
  autoRenewalAvailable: boolean;
  autoRenewalIneligibleReason?: string;
  noticeMessage?: string;
  planCode?: string;
  selectionDate?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  trialEndsAtIso?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  provisionalFirstBillingDate?: string;
  cancelAnytimeInfo?: string;
  benefits?: Array<{ title: string; description: string }>;
  isPendingActivation?: boolean;
  isTrialing?: boolean;
  checkoutEligible?: boolean;
}

export interface StatusConfig {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const SUBSCRIPTION_STATUS_CONFIG: Record<SubscriptionStatus, StatusConfig> = {
  pending_activation: {
    label: "Pending Activation",
    textColor: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800/60",
    dotColor: "bg-amber-500",
    icon: Clock,
    description: "Subscription is queued for activation."
  },
  trialing: {
    label: "Trial",
    textColor: "text-sky-700 dark:text-sky-300",
    bgColor: "bg-sky-50 dark:bg-sky-950/40",
    borderColor: "border-sky-200 dark:border-sky-800/60",
    dotColor: "bg-sky-500",
    icon: Sparkles,
    description: "Complimentary trial evaluation period active."
  },
  trial: {
    label: "Trial",
    textColor: "text-sky-700 dark:text-sky-300",
    bgColor: "bg-sky-50 dark:bg-sky-950/40",
    borderColor: "border-sky-200 dark:border-sky-800/60",
    dotColor: "bg-sky-500",
    icon: Sparkles,
    description: "Complimentary trial evaluation period active."
  },
  active: {
    label: "Active",
    textColor: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    borderColor: "border-emerald-200 dark:border-emerald-800/60",
    dotColor: "bg-emerald-500",
    icon: CheckCircle2,
    description: "Subscription is in good standing with active access."
  },
  non_renewing: {
    label: "Non-Renewing",
    textColor: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    borderColor: "border-slate-300 dark:border-slate-700",
    dotColor: "bg-slate-400",
    icon: Ban,
    description: "Subscription will not renew at the end of the current period."
  },
  payment_pending: {
    label: "Payment Pending",
    textColor: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800/60",
    dotColor: "bg-amber-500",
    icon: Clock,
    description: "Scheduled payment is processing or awaiting bank clearance."
  },
  past_due: {
    label: "Past Due",
    textColor: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-50 dark:bg-rose-950/40",
    borderColor: "border-rose-200 dark:border-rose-800/60",
    dotColor: "bg-rose-500",
    icon: AlertTriangle,
    description: "Payment is overdue. Check billing for recovery options."
  },
  cancelled: {
    label: "Cancelled",
    textColor: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    borderColor: "border-slate-300 dark:border-slate-700",
    dotColor: "bg-slate-400",
    icon: Ban,
    description: "Subscription has been cancelled."
  },
  expired: {
    label: "Expired",
    textColor: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950/40",
    borderColor: "border-red-200 dark:border-red-800/60",
    dotColor: "bg-red-500",
    icon: XCircle,
    description: "Subscription period has ended. Operational changes require renewal."
  }
};

export interface AutoRenewalConfig {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const AUTO_RENEWAL_CONFIG: Record<AutoRenewalStatus, AutoRenewalConfig> = {
  enabled: {
    label: "Enabled",
    textColor: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200/80 dark:border-emerald-800/40",
    icon: RefreshCw
  },
  disabled: {
    label: "Disabled",
    textColor: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800/40",
    borderColor: "border-slate-200 dark:border-slate-700/50",
    icon: AlertCircle
  },
  not_applicable: {
    label: "N/A",
    textColor: "text-slate-500 dark:text-slate-400",
    bgColor: "bg-slate-100/60 dark:bg-slate-800/30",
    borderColor: "border-slate-200/60 dark:border-slate-800",
    icon: AlertCircle
  }
};