import React from "react";
import { LucideIcon } from "lucide-react";
import { tokens } from "../../tokens";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  badge?: {
    label: string;
    variant?: "primary" | "intelligence" | "warning" | "critical" | "success" | "neutral";
  };
  icon?: LucideIcon;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
  id?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  badge,
  icon: Icon,
  actions,
  breadcrumbs,
  className = "",
  id
}) => {
  return (
    <div
      id={id}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all ${className}`}
    >
      <div className="space-y-1.5 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                {b.href ? (
                  <a href={b.href} className="hover:text-blue-600 dark:hover:text-blue-400 font-medium">
                    {b.label}
                  </a>
                ) : (
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {eyebrow && (
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#2F7CFF] dark:text-[#60A5FA] block">
            {eyebrow}
          </span>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[#2F7CFF] shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>

          {badge && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {badge.label}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
