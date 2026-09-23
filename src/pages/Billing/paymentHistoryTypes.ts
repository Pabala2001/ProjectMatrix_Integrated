import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  RotateCcw,
  MinusCircle
} from "lucide-react";
import React from "react";

export type PaymentStatus = 
  | "paid" 
  | "pending" 
  | "failed" 
  | "refunded" 
  | "partially_refunded";

export type RefundStatus = 
  | "completed" 
  | "pending" 
  | "failed";

export interface PaymentRecord {
  id: string;
  paymentId: string;
  date: string;
  dateTime: string;
  description: string;
  associatedService: string;
  amount: number;
  currency: string;
  formattedAmount: string;
  status: PaymentStatus;
  paymentMethod: string;
  invoiceReference?: string;
  receiptReference?: string;
  hasInvoice: boolean;
  hasReceipt: boolean;
}

export interface RefundRecord {
  id: string;
  refundId: string;
  date: string;
  dateTime: string;
  service: string;
  originalPaymentId: string;
  amount: number;
  currency: string;
  formattedAmount: string;
  status: RefundStatus;
  reason?: string;
}

export interface StatusVisualConfig {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, StatusVisualConfig> = {
  paid: {
    label: "Paid",
    textColor: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    borderColor: "border-emerald-200 dark:border-emerald-800/60",
    dotColor: "bg-emerald-500",
    icon: CheckCircle2
  },
  pending: {
    label: "Pending",
    textColor: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800/60",
    dotColor: "bg-amber-500",
    icon: Clock
  },
  failed: {
    label: "Failed",
    textColor: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-50 dark:bg-rose-950/40",
    borderColor: "border-rose-200 dark:border-rose-800/60",
    dotColor: "bg-rose-500",
    icon: XCircle
  },
  refunded: {
    label: "Refunded",
    textColor: "text-slate-700 dark:text-slate-300",
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
    borderColor: "border-slate-300 dark:border-slate-700",
    dotColor: "bg-slate-500",
    icon: RotateCcw
  },
  partially_refunded: {
    label: "Partially Refunded",
    textColor: "text-sky-700 dark:text-sky-300",
    bgColor: "bg-sky-50 dark:bg-sky-950/40",
    borderColor: "border-sky-200 dark:border-sky-800/60",
    dotColor: "bg-sky-500",
    icon: MinusCircle
  }
};

export const REFUND_STATUS_CONFIG: Record<RefundStatus, StatusVisualConfig> = {
  completed: {
    label: "Completed",
    textColor: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    borderColor: "border-emerald-200 dark:border-emerald-800/60",
    dotColor: "bg-emerald-500",
    icon: CheckCircle2
  },
  pending: {
    label: "Pending",
    textColor: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800/60",
    dotColor: "bg-amber-500",
    icon: Clock
  },
  failed: {
    label: "Failed",
    textColor: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-50 dark:bg-rose-950/40",
    borderColor: "border-rose-200 dark:border-rose-800/60",
    dotColor: "bg-rose-500",
    icon: AlertCircle
  }
};
