import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { 
  X, 
  Copy, 
  Check, 
  Calendar, 
  CreditCard, 
  Building, 
  RefreshCw, 
  AlertCircle,
  Info,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { SubscriptionItem } from "./types";
import { StatusBadge } from "./StatusBadge";
import { AutoRenewalSwitch } from "./AutoRenewalSwitch";
import { SHARED_BUSINESS_PLAN } from "../../config/plans";

interface SubscriptionDetailsDrawerProps {
  subscription: SubscriptionItem | null;
  isOpen: boolean;
  isActionPending?: boolean;
  onClose: () => void;
  onActionTrigger: (actionName: string, subscription: SubscriptionItem) => void;
  onToggleAutoRenewal?: (subscription: SubscriptionItem, targetEnabled: boolean) => void;
  originatingElementRef?: React.RefObject<HTMLElement | null>;
}

export function SubscriptionDetailsDrawer({
  subscription,
  isOpen,
  isActionPending = false,
  onClose,
  onActionTrigger,
  onToggleAutoRenewal,
  originatingElementRef
}: SubscriptionDetailsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Focus trap & Escape key listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      // Focus drawer
      setTimeout(() => {
        drawerRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = "";
      // Return focus to originating element
      originatingElementRef?.current?.focus();
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, originatingElementRef]);

  const handleCopyCode = () => {
    if (!subscription) return;
    navigator.clipboard.writeText(subscription.subscriptionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!subscription) return null;

  const benefitsList = subscription.benefits || SHARED_BUSINESS_PLAN.benefits;
  const isPendingActivation = subscription.isPendingActivation || subscription.subscriptionCode === "Pending activation";

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-hidden flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-drawer-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <motion.div
            ref={drawerRef}
            tabIndex={-1}
            initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={shouldReduceMotion ? { duration: 0.1 } : { type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#07182E] text-slate-900 dark:text-slate-100 shadow-2xl border-l border-slate-200 dark:border-[#1E3A5F] flex flex-col h-full z-10 outline-hidden overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-[#07182E]/95 backdrop-blur-md px-6 py-5 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#102846] dark:bg-[#0B2345] border border-[#1E3A5F] flex items-center justify-center text-[#FF9F1C] shrink-0 shadow-xs">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="subscription-drawer-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                    Subscription Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {subscription.planName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close subscription details drawer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-6 space-y-6">
              {/* Plan & Status Header Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#0B2345]/50 border border-slate-200/80 dark:border-[#1E3A5F] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C]">
                      Service & Plan
                    </span>
                    <h4 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {subscription.planName}
                    </h4>
                  </div>
                  <StatusBadge 
                    status={subscription.status} 
                    size="md" 
                    labelOverride={isPendingActivation ? "Trial — Pending activation" : undefined}
                  />
                </div>

                {/* Subscription Code / ID with Copy */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 flex-wrap">
                    <span>Subscription Reference:</span>
                    <code className="px-2 py-0.5 bg-slate-200/70 dark:bg-[#07182E] rounded font-mono text-[11px] text-slate-800 dark:text-amber-400 font-semibold">
                      {subscription.subscriptionCode}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    aria-label="Copy subscription reference to clipboard"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF9F1C] hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C] rounded"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy Ref"}</span>
                  </button>
                </div>
              </div>

              {/* Notice Message if available */}
              {subscription.noticeMessage && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                  subscription.status === "past_due" || subscription.status === "expired"
                    ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
                    : subscription.status === "trial"
                    ? "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/60 text-sky-800 dark:text-sky-300"
                    : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300"
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Subscription Notice</span>
                    {subscription.noticeMessage}
                  </div>
                </div>
              )}

              {/* Interactive Auto-Renewal Section */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] shadow-xs space-y-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                      Auto-Renewal
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Provisional monthly renewal date: <span className="font-semibold text-slate-700 dark:text-slate-300">{subscription.nextRenewalDate}</span>
                    </p>
                  </div>

                  <AutoRenewalSwitch
                    id={`drawer-switch-${subscription.id}`}
                    subscriptionName={subscription.planName}
                    autoRenewal={subscription.autoRenewal}
                    available={subscription.autoRenewalAvailable}
                    ineligibleReason={subscription.autoRenewalIneligibleReason}
                    onToggle={(targetEnabled) => {
                      if (onToggleAutoRenewal) {
                        onToggleAutoRenewal(subscription, targetEnabled);
                      }
                    }}
                    size="md"
                    describedBy={`drawer-autorenew-desc-${subscription.id}`}
                  />
                </div>

                {/* Explanatory Context for Auto-Renewal */}
                <div 
                  id={`drawer-autorenew-desc-${subscription.id}`}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B2345]/60 border border-slate-200/70 dark:border-[#1E3A5F] text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5"
                >
                  <Info className="w-4 h-4 text-[#FF9F1C] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {!subscription.autoRenewalAvailable && subscription.autoRenewalIneligibleReason ? (
                      <p className="font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                        {subscription.autoRenewalIneligibleReason}
                      </p>
                    ) : (
                      <p className="leading-relaxed">
                        When enabled, this subscription renews automatically on the scheduled billing date each month unless auto-renewal is disabled. Billed monthly &bull; Cancel anytime.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Core Financial and Lifecycle Attributes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Billing Rate & Interval */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                    Renewal Amount
                  </span>
                  <div className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    {subscription.formattedAmount}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                    {subscription.billingInterval} billing interval
                  </span>
                </div>

                {/* Next Renewal / Provisional First Billing Date */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                    {isPendingActivation ? "Provisional First Billing Date" : subscription.isTrialing ? "Trial ends" : subscription.status === "expired" ? "Period ended" : subscription.autoRenewal === "enabled" ? "Next renewal" : "Paid period ends"}
                  </span>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" />
                    <span>{isPendingActivation ? subscription.provisionalFirstBillingDate || subscription.nextRenewalDate : subscription.nextRenewalDate}</span>
                  </div>
                </div>

                {/* Plan Selection Date */}
                {subscription.selectionDate && (
                  <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                      Plan Selection Date
                    </span>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{subscription.selectionDate}</span>
                    </div>
                  </div>
                )}

                {/* Provisional Trial-End Date */}
                {subscription.trialEndDate && (
                  <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                      Provisional Trial-End Date
                    </span>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{subscription.trialEndDate}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Associated Entity & Cancel Terms */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-2">
                <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-[#FF9F1C]" />
                  <span>Associated Entity</span>
                </h5>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {subscription.associatedEntity}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {subscription.cancelAnytimeInfo || "Billed monthly • Cancel anytime"}
                </p>
              </div>

              {/* Included Benefits (Shared source) */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#0B2345]/40 border border-slate-200/80 dark:border-[#1E3A5F] space-y-3.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    Included Plan Benefits ({benefitsList.length})
                  </h5>
                </div>

                <ul className="space-y-3 text-xs" aria-label="Included benefits">
                  {benefitsList.map((benefit) => (
                    <li key={benefit.title} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="leading-relaxed">
                        <strong className="font-bold text-slate-900 dark:text-slate-100">{benefit.title}:</strong>{" "}
                        <span className="text-slate-600 dark:text-slate-300">{benefit.description}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action Footer */}
            <div className="sticky bottom-0 bg-slate-50 dark:bg-[#07182E] px-6 py-4 border-t border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between gap-3 z-20">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                Close
              </button>

              {subscription.checkoutEligible && (
                <button
                  type="button"
                  disabled={isActionPending}
                  onClick={() => onActionTrigger("Renew Subscription", subscription)}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Pay now</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
