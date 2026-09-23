import React from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { tokens } from "../../tokens";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  accentColor?: string;
  status?: "default" | "warning" | "critical" | "success" | "intelligence";
  className?: string;
  id?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  accentColor,
  status = "default",
  className = "",
  id
}) => {
  const statusBorder: Record<string, string> = {
    default: "border-slate-200 dark:border-slate-800",
    warning: "border-amber-500/30 bg-amber-500/5",
    critical: "border-red-500/30 bg-red-500/5",
    success: "border-emerald-500/30 bg-emerald-500/5",
    intelligence: "border-blue-500/30 bg-blue-500/5"
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.direction === "up") return <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />;
    if (trend.direction === "down") return <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />;
    return <Minus className="w-3 h-3 text-slate-400" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend.direction === "up") return "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800";
    if (trend.direction === "down") return "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800";
    return "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700";
  };

  return (
    <div
      id={id}
      className={`bg-white dark:bg-slate-900 border rounded-xl p-4 sm:p-5 shadow-xs transition-all h-full flex flex-col justify-between ${statusBorder[status] || statusBorder.default} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            {label}
          </span>
          <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
            {value}
          </div>
        </div>

        {Icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: accentColor ? `${accentColor}15` : "#F8FAFC",
              borderColor: accentColor ? `${accentColor}30` : "#E2E8F0",
              color: accentColor || tokens.color.primary
            }}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(subValue || trend) && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          {trend ? (
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-semibold ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trend.value}</span>
              {trend.label && <span className="font-normal opacity-80">{trend.label}</span>}
            </div>
          ) : <span />}

          {subValue && (
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium truncate">
              {subValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
