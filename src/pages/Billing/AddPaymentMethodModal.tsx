import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X, CreditCard, Info } from "lucide-react";

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName?: string;
  originatingElement?: HTMLElement | null;
}

export function AddPaymentMethodModal({
  isOpen,
  onClose,
  companyName = "Active Organization",
  originatingElement
}: AddPaymentMethodModalProps) {
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
          const firstFocusable = modalRef.current.querySelector<HTMLElement>("button, [tabindex='0']");
          firstFocusable?.focus();
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-payment-method-title"
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

          {/* Modal Card */}
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            transition={shouldReduceMotion ? { duration: 0.1 } : { type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#07182E] text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl border border-slate-200 dark:border-[#1E3A5F] overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between bg-slate-50/50 dark:bg-[#0B2345]/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#FF9F1C]">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="add-payment-method-title" className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Add Payment Method
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {companyName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close add payment method dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Secure Mount Area Placeholder */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Provider Mount Container Placeholder */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-[#1E3A5F] bg-slate-50/75 dark:bg-[#0B2345]/40 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#FF9F1C]">
                  <CreditCard className="w-6 h-6" />
                </div>
                
                <div className="space-y-1.5 max-w-sm mx-auto">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Stripe Elements Integration Area
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Stripe Elements will be mounted here during backend integration. Card details will be submitted directly to Stripe and will not pass through ProjectMatrix.
                  </p>
                </div>
              </div>

              {/* Informational Notice */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B2345] border border-slate-200 dark:border-[#1E3A5F] flex items-start gap-3">
                <Info className="w-5 h-5 text-[#FF9F1C] shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Integration Notice
                  </span>
                  <p className="leading-relaxed">
                    This placeholder does not collect or transmit payment information.
                  </p>
                </div>
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
                disabled
                title="Stripe Elements is not yet mounted"
                className="px-5 py-2.5 bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 text-xs font-bold rounded-xl cursor-not-allowed flex items-center gap-2 opacity-80"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Add payment method</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
