import React from "react";
import { 
  PaymentStatus, 
  RefundStatus, 
  PAYMENT_STATUS_CONFIG, 
  REFUND_STATUS_CONFIG 
} from "./paymentHistoryTypes";

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function PaymentStatusBadge({ 
  status, 
  size = "sm", 
  showIcon = false 
}: PaymentStatusBadgeProps) {
  const config = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending;
  const IconComponent = config.icon;

  const sizeClasses = size === "sm" 
    ? "px-2.5 py-0.5 text-[11px] gap-1.5" 
    : "px-3 py-1 text-xs gap-2 font-bold";

  return (
    <span 
      className={`inline-flex items-center font-bold tracking-wide rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses} select-none transition-colors`}
      aria-label={`Payment Status: ${config.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} shrink-0 motion-safe:animate-pulse`} aria-hidden="true" />
      {showIcon && <IconComponent className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}

interface RefundStatusBadgeProps {
  status: RefundStatus;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function RefundStatusBadge({
  status,
  size = "sm",
  showIcon = false
}: RefundStatusBadgeProps) {
  const config = REFUND_STATUS_CONFIG[status] || REFUND_STATUS_CONFIG.pending;
  const IconComponent = config.icon;

  const sizeClasses = size === "sm"
    ? "px-2.5 py-0.5 text-[11px] gap-1.5"
    : "px-3 py-1 text-xs gap-2 font-bold";

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wide rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses} select-none transition-colors`}
      aria-label={`Refund Status: ${config.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} shrink-0 motion-safe:animate-pulse`} aria-hidden="true" />
      {showIcon && <IconComponent className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}
