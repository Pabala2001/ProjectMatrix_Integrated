import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X, AlertTriangle, Trash2, CreditCard } from "lucide-react";
import { PaymentMethodItem } from "./paymentMethodTypes";

interface RemovePaymentMethodModalProps {
  method: PaymentMethodItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmRemove: (method: PaymentMethodItem) => void;
  originatingElement?: HTMLElement | null;
}

export function RemovePaymentMethodModal({
  method,
  isOpen,
  onClose,
  onConfirmRemove,
  originatingElement
}: RemovePaymentMethodModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Escape key & focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll lock & focus management
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const cancelBtn = modalRef.current.querySelector<HTMLElement>("button, [tabindex='0']");
          cancelBtn?.focus();
        }
      }, 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
      if (originatingElement) {
        originatingElement.focus();
      }
    }
  }, [isOpen, originatingElement]);

  if (!method) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-payment-method-title"
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

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            transition={shouldReduceMotion ? { duration: 0.1 } : { type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white dark:bg-[#07182E] text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl border border-slate-200 dark:border-[#1E3A5F] overflow-hidden z-10 flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between bg-slate-50/50 dark:bg-[#0B2345]/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="remove-payment-method-title" className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Remove Payment Method
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Confirm card deletion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close remove dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B2345] border border-slate-200 dark:border-[#1E3A5F] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] flex items-center justify-center text-[#FF9F1C] shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {method.brandLabel} ending in {method.last4}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Expires {method.expiryFormatted}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to remove this payment method? Removing this card will prevent it from being used for future billing charges or automated settlements.
              </p>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-bold block mb-0.5">Frontend Session Preview:</span>
                This card will be removed from your active component session. Permanent deletion will take effect once the backend integration is active.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0B2345] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  onConfirmRemove(method);
                  onClose();
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove payment method</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
