import React from "react";
import { 
  SubscriptionStatus, 
  AutoRenewalStatus, 
  SUBSCRIPTION_STATUS_CONFIG, 
  AUTO_RENEWAL_CONFIG 
} from "./types";

interface StatusBadgeProps {
  status: SubscriptionStatus;
  size?: "sm" | "md";
  showIcon?: boolean;
  labelOverride?: string;
}

export function StatusBadge({ status, size = "md", showIcon = true, labelOverride }: StatusBadgeProps) {
  const config = SUBSCRIPTION_STATUS_CONFIG[status] || SUBSCRIPTION_STATUS_CONFIG.active;
  const IconComponent = config.icon;
  const displayLabel = labelOverride || config.label;

  const sizeClasses = size === "sm" 
    ? "px-2 py-0.5 text-[10px] gap-1" 
    : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span 
      className={`inline-flex items-center font-bold tracking-wide rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses} select-none transition-colors`}
      aria-label={`Status: ${displayLabel}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} shrink-0 motion-safe:animate-pulse`} aria-hidden="true" />
      {showIcon && <IconComponent className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} aria-hidden="true" />}
      <span>{displayLabel}</span>
    </span>
  );
}

interface AutoRenewalBadgeProps {
  status: AutoRenewalStatus;
  size?: "sm" | "md";
}

export function AutoRenewalBadge({ status, size = "md" }: AutoRenewalBadgeProps) {
  const config = AUTO_RENEWAL_CONFIG[status] || AUTO_RENEWAL_CONFIG.disabled;
  const IconComponent = config.icon;

  const sizeClasses = size === "sm" 
    ? "px-2 py-0.5 text-[10px] gap-1" 
    : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span 
      className={`inline-flex items-center font-semibold rounded-lg border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses} select-none`}
      aria-label={`Auto-renewal: ${config.label}`}
    >
      <IconComponent className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
