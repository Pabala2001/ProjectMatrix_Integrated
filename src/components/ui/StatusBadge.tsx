import React from "react";
import { tokens } from "../../tokens";

export type BadgeVariant = 
  | "primary" 
  | "intelligence" 
  | "warning" 
  | "critical" 
  | "neutral" 
  | "success"
  | "info";

export interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  id?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = "neutral",
  size = "md",
  dot = true,
  pulse = false,
  className = "",
  id
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
    primary: {
      bg: "bg-slate-900/10 dark:bg-white/10",
      text: "text-slate-900 dark:text-white font-black",
      border: "border-slate-300 dark:border-slate-700",
      dotColor: "bg-slate-900 dark:bg-white"
    },
    intelligence: {
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-500/30",
      dotColor: "bg-amber-500"
    },
    warning: {
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-500/30",
      dotColor: "bg-amber-500"
    },
    critical: {
      bg: "bg-red-500/10 dark:bg-red-500/20",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-500/30",
      dotColor: "bg-red-500"
    },
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-300 dark:border-emerald-800",
      dotColor: "bg-emerald-500"
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/40",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-300 dark:border-blue-800",
      dotColor: "bg-blue-500"
    },
    neutral: {
      bg: "bg-slate-100 dark:bg-[#162238]",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-200 dark:border-slate-800",
      dotColor: "bg-slate-400"
    }
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] gap-1.5",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2"
  };

  const currentVariant = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      id={id}
      className={`inline-flex items-center font-bold tracking-tight rounded-full border transition-colors select-none ${currentVariant.bg} ${currentVariant.text} ${currentVariant.border} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentVariant.dotColor} ${
            pulse ? "animate-pulse" : ""
          }`}
        />
      )}
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

export default StatusBadge;
