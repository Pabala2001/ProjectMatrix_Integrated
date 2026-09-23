import React from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: any;
  badge?: string | number;
  badgeColor?: string;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: "pill" | "underline" | "enclosed";
  size?: "sm" | "md" | "lg";
  className?: string;
  id?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = "pill",
  size = "md",
  className = "",
  id
}: TabsProps<T>) {
  if (variant === "underline") {
    return (
      <div id={id} className={`border-b border-[#E6E9EF] dark:border-slate-800 flex items-center gap-6 overflow-x-auto scrollbar-none ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onChange(tab.id)}
              disabled={tab.disabled}
              className={`pb-3 text-xs sm:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? "border-[#0B172A] text-[#0B172A] dark:border-amber-400 dark:text-amber-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tab.badgeColor || (isActive ? "bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Pill variant
  return (
    <div id={id} className={`inline-flex items-center bg-[#F7F8FA] dark:bg-slate-800/80 p-1 rounded-2xl border border-[#E6E9EF] dark:border-slate-700/60 gap-1 overflow-x-auto scrollbar-none ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isActive
                ? "bg-white dark:bg-[#0B172A] text-[#172033] dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? "text-slate-900 dark:text-amber-400" : "text-slate-400"}`} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${tab.badgeColor || (isActive ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300")}`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
