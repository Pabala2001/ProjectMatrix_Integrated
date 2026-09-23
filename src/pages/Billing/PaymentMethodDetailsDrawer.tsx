import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { 
  X, 
  CreditCard, 
  Building, 
  Calendar, 
  CheckCircle2, 
  Star, 
  Trash2,
  Info
} from "lucide-react";
import { PaymentMethodItem } from "./paymentMethodTypes";

interface PaymentMethodDetailsDrawerProps {
  method: PaymentMethodItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSetDefault: (method: PaymentMethodItem) => void;
  onRequestRemove: (method: PaymentMethodItem) => void;
  companyName?: string;
  originatingElement?: HTMLElement | null;
}

export function PaymentMethodDetailsDrawer({
  method,
  isOpen,
  onClose,
  onSetDefault,
  onRequestRemove,
  companyName = "Active Organization",
  originatingElement
}: PaymentMethodDetailsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Escape key & focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
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

  // Scroll lock & Focus restoration
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        if (drawerRef.current) {
          const firstFocusable = drawerRef.current.querySelector<HTMLElement>("button, [tabindex='0']");
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

  if (!method) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-method-drawer-title"
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

          {/* Slide-over Panel */}
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
            <div className="p-6 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between sticky top-0 bg-white/95 dark:bg-[#07182E]/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#FF9F1C]">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="payment-method-drawer-title" className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Payment Method Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {method.brandLabel} ending in {method.last4}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close payment method details"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Card Visual Representation */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#102846] via-[#0B2345] to-[#07182E] text-white border border-[#1E3A5F] shadow-lg relative overflow-hidden space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-[#FF9F1C]" />
                    <span className="text-sm font-black tracking-wider uppercase">
                      {method.brandLabel}
                    </span>
                  </div>
                  {method.isDefault ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FF9F1C] text-slate-950 text-xs font-black tracking-wide shadow-xs">
                      <Star className="w-3 h-3 fill-current" />
                      <span>Default</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">
                      Secondary Method
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="font-mono text-lg tracking-widest text-slate-200 font-bold">
                    {method.maskedNumber}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Expires
                    </span>
                    <span className="font-mono font-bold text-white">
                      {method.expiryFormatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* Company Context */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B2345] border border-slate-200 dark:border-[#1E3A5F] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Building className="w-4 h-4 text-[#FF9F1C]" />
                  <span>Associated Organization</span>
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {companyName}
                </div>
              </div>

              {/* Status Explanation */}
              <div className="space-y-3">
                {method.isDefault ? (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-emerald-900 dark:text-emerald-200">
                        Default Payment Method
                      </div>
                      <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed">
                        This default payment method will be used for recurring billing once backend Billing integration is enabled.
                      </p>
                      <p className="text-emerald-800 dark:text-emerald-300 font-semibold pt-1">
                        Set another payment method as default before removing this one.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B2345] border border-slate-200 dark:border-[#1E3A5F] flex items-start gap-3">
                    <Info className="w-5 h-5 text-[#FF9F1C] shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">
                        Secondary Payment Method
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        This saved payment method can be designated as the default payment method at any time.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0B2345] flex items-center justify-between gap-3 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {!method.isDefault && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onRequestRemove(method);
                      }}
                      className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSetDefault(method);
                        onClose();
                      }}
                      className="px-4 py-2.5 bg-[#FF9F1C] hover:bg-[#F39200] text-slate-950 text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>Set as Default</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
