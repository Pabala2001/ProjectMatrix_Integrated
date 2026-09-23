import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { AlertTriangle, X, Calendar, CreditCard } from "lucide-react";
import { SubscriptionItem } from "./types";

interface DisableAutoRenewalModalProps {
  subscription: SubscriptionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDisable: (subscription: SubscriptionItem) => void;
  originatingElementRef?: React.RefObject<HTMLElement | null>;
}

export function DisableAutoRenewalModal({
  subscription,
  isOpen,
  onClose,
  onConfirmDisable,
  originatingElementRef
}: DisableAutoRenewalModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Escape key & focus management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = "";
      originatingElementRef?.current?.focus();
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, originatingElementRef]);

  if (!subscription) return null;

  const handleConfirm = () => {
    onConfirmDisable(subscription);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disable-autorenewal-title"
          aria-describedby="disable-autorenewal-desc"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Dialog Card */}
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#07182E] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#1E3A5F] overflow-hidden z-10 outline-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#FF9F1C] shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="disable-autorenewal-title"
                    className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight"
                  >
                    Turn Off Auto-Renewal?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {subscription.planName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cancel and close dialog"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-2 space-y-4 text-xs text-slate-600 dark:text-slate-300">
              {/* Subscription Summary Box */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B2345] border border-slate-200 dark:border-[#1E3A5F] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                    <CreditCard className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" />
                    <span className="truncate">{subscription.planName}</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-bold shrink-0">
                    {subscription.subscriptionCode}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span>Current Paid-Through / Renewal Date:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#FF9F1C]" />
                    {subscription.nextRenewalDate}
                  </span>
                </div>
              </div>

              {/* Description Statement */}
              <p id="disable-autorenewal-desc" className="text-slate-600 dark:text-slate-300 leading-relaxed">
                This subscription will remain active until <strong className="text-slate-900 dark:text-white">{subscription.nextRenewalDate}</strong>, but will not renew automatically afterward.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-5 mt-4 bg-slate-50 dark:bg-[#07182E] border-t border-slate-200 dark:border-[#1E3A5F] flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                Keep auto-renewal enabled
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Turn off auto-renewal
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
