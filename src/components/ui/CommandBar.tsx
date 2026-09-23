import React from "react";
import { Search, Sparkles, Command, Plus, Filter } from "lucide-react";

export interface CommandBarProps {
  onSearch?: (query: string) => void;
  onNewAction?: () => void;
  onAskAI?: () => void;
  filterComponent?: React.ReactNode;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  onSearch,
  onNewAction,
  onAskAI,
  filterComponent,
  placeholder = "Search actions, contracts, drawings, or press ⌘K...",
  className = "",
  id
}) => {
  return (
    <div
      id={id}
      className={`bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      {/* Search Field */}
      <div className="relative flex-1 min-w-[240px]">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          onChange={(e) => onSearch && onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-14 py-2 bg-[#F7F8FA] dark:bg-slate-800/80 border border-[#E6E9EF] dark:border-slate-700/60 rounded-xl text-xs font-medium text-[#172033] dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-mono text-slate-500 dark:text-slate-400">
          <Command className="w-2.5 h-2.5" />
          <span>K</span>
        </div>
      </div>

      {/* Filter Slot */}
      {filterComponent && (
        <div className="flex items-center gap-2">
          {filterComponent}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {onAskAI && (
          <button
            onClick={onAskAI}
            className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Matrix Advisor</span>
          </button>
        )}

        {onNewAction && (
          <button
            onClick={onNewAction}
            className="px-3.5 py-2 bg-[#0B172A] hover:bg-[#162238] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Action</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default CommandBar;
