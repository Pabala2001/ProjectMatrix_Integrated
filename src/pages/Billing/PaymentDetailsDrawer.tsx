import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { 
  X, 
  Copy, 
  Check, 
  Calendar, 
  CreditCard, 
  Building, 
  FileText, 
  Receipt, 
  Download,
  ShieldAlert
} from "lucide-react";
import { PaymentRecord } from "./paymentHistoryTypes";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

interface PaymentDetailsDrawerProps {
  payment: PaymentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onDocumentDownload: (docType: "invoice" | "receipt", payment: PaymentRecord) => void;
  originatingElement?: HTMLElement | null;
}

export function PaymentDetailsDrawer({
  payment,
  isOpen,
  onClose,
  onDocumentDownload,
  originatingElement
}: PaymentDetailsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Focus trap & Escape key listener
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

  // Focus management & scroll lock
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

  const handleCopy = (text: string, type: "id" | "invoice" | "receipt") => {
    navigator.clipboard.writeText(text);
    if (type === "id") {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else if (type === "invoice") {
      setCopiedInvoice(true);
      setTimeout(() => setCopiedInvoice(false), 2000);
    } else {
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 2000);
    }
  };

  if (!payment) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-details-title"
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

          {/* Slide-over Drawer Panel */}
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
                  <h3 id="payment-details-title" className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Payment Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {payment.paymentId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close payment details drawer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Primary Amount Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#0B2345] dark:to-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C]">
                      Total Amount
                    </span>
                    <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {payment.formattedAmount}
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Currency: {payment.currency}
                    </span>
                  </div>
                  <PaymentStatusBadge status={payment.status} size="md" showIcon />
                </div>

                {/* Copyable Payment ID */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    Payment Reference: <code className="ml-1 px-2 py-0.5 bg-slate-200/70 dark:bg-[#07182E] rounded font-mono text-[11px] text-slate-800 dark:text-amber-400 font-semibold">{payment.paymentId}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(payment.paymentId, "id")}
                    aria-label="Copy payment ID to clipboard"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF9F1C] hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C] rounded"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId ? "Copied" : "Copy ID"}</span>
                  </button>
                </div>
              </div>

              {/* Service & Description Details */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Associated Service & Description
                </span>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {payment.associatedService}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {payment.description}
                  </div>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date & Time */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                    Date & Time
                  </span>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" />
                    <span>{payment.dateTime}</span>
                  </div>
                </div>

                {/* Masked Payment Method */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                    Payment Method
                  </span>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" />
                    <span className="truncate">{payment.paymentMethod}</span>
                  </div>
                </div>
              </div>

              {/* Document References & Available Downloads */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Billing Documents
                </span>

                <div className="space-y-2">
                  {/* Invoice Row */}
                  {payment.invoiceReference ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B2345] border border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-[#FF9F1C] shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Invoice
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate block">
                            {payment.invoiceReference}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(payment.invoiceReference || "", "invoice")}
                          aria-label="Copy invoice reference"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                        >
                          {copiedInvoice ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDocumentDownload("invoice", payment)}
                          aria-label="Download Invoice"
                          className="px-2.5 py-1 bg-[#102846] hover:bg-[#15345a] text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                        >
                          <Download className="w-3 h-3" />
                          <span>Invoice</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
                      No invoice associated with this payment record.
                    </div>
                  )}

                  {/* Receipt Row */}
                  {payment.receiptReference && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B2345] border border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Receipt className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Payment Receipt
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate block">
                            {payment.receiptReference}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(payment.receiptReference || "", "receipt")}
                          aria-label="Copy receipt reference"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                        >
                          {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDocumentDownload("receipt", payment)}
                          aria-label="Download Payment Receipt"
                          className="px-2.5 py-1 bg-[#102846] hover:bg-[#15345a] text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                        >
                          <Download className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0B2345] flex items-center justify-between sticky bottom-0 z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {payment.hasInvoice && (
                  <button
                    type="button"
                    onClick={() => onDocumentDownload("invoice", payment)}
                    className="px-4 py-2.5 bg-[#102846] hover:bg-[#15345a] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                  >
                    <Download className="w-3.5 h-3.5 text-[#FF9F1C]" />
                    <span>Download Invoice</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
