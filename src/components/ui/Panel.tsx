import React from "react";

export interface PanelProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  noPadding?: boolean;
  id?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  badge,
  actions,
  children,
  className = "",
  bodyClassName = "",
  headerClassName = "",
  noPadding = false,
  id
}) => {
  const hasHeader = title || subtitle || badge || actions;

  return (
    <div
      id={id}
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden transition-all w-full ${className}`}
    >
      {hasHeader && (
        <div className={`p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${headerClassName}`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              {title && (
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {subtitle}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className={noPadding ? bodyClassName : `p-5 sm:p-6 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default Panel;
