import React from "react";
import { AlertTriangle, ShieldCheck, AlertOctagon, Info } from "lucide-react";

export type RiskLevel = "HEALTHY" | "MONITORED" | "ELEVATED" | "AT_RISK" | "CRITICAL";

export interface RiskIndicatorProps {
  level: RiskLevel | string;
  score?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
  id?: string;
}

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({
  level,
  score,
  label,
  size = "md",
  showIcon = true,
  className = "",
  id
}) => {
  const normalized = (typeof level === "string" ? level.toUpperCase().replace(/\s+/g, "_") : "HEALTHY") as RiskLevel;

  const config: Record<RiskLevel, { text: string; bg: string; border: string; icon: any; display: string }> = {
    HEALTHY: {
      text: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
      icon: ShieldCheck,
      display: "ON TRACK"
    },
    MONITORED: {
      text: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-200 dark:border-blue-800",
      icon: Info,
      display: "MONITORED"
    },
    ELEVATED: {
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800",
      icon: AlertTriangle,
      display: "ELEVATED"
    },
    AT_RISK: {
      text: "text-orange-700 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      border: "border-orange-200 dark:border-orange-800",
      icon: AlertTriangle,
      display: "AT RISK"
    },
    CRITICAL: {
      text: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-300 dark:border-rose-800",
      icon: AlertOctagon,
      display: "CRITICAL ALERT"
    }
  };

  const item = config[normalized] || config.AT_RISK;
  const Icon = item.icon;
  const displayText = label || item.display;

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3.5 py-1.5 text-sm gap-2"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4"
  };

  return (
    <div
      id={id}
      className={`inline-flex items-center font-bold tracking-wide uppercase rounded-md border whitespace-nowrap shadow-2xs ${item.bg} ${item.text} ${item.border} ${sizeStyles[size]} ${className}`}
    >
      {showIcon && <Icon className={`${iconSizes[size]} shrink-0`} />}
      <span>{displayText}</span>
      {score !== undefined && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[10px] font-mono font-semibold">
          {score}%
        </span>
      )}
    </div>
  );
};

export default RiskIndicator;
