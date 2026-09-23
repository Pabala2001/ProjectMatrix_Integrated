import React, { useState, useMemo } from "react";
import { 
  Milestone, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Layers, 
  Filter, 
  MapPin, 
  ArrowUpRight,
  ShieldCheck,
  Plus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getProjectRealMilestones } from "../../utils/projectDataUtils";

export interface UpcomingMilestonesCardProps {
  activeProject?: any;
  allProjects?: any[];
  activeCompany?: any;
  onMilestoneSelect?: (milestone: any) => void;
  className?: string;
}

export default function UpcomingMilestonesCard({
  activeProject,
  allProjects = [],
  activeCompany,
  onMilestoneSelect,
  className = ""
}: UpcomingMilestonesCardProps) {
  const navigate = useNavigate();
  const [timeFilter, setTimeFilter] = useState<"ALL" | "30" | "60" | "90" | "CRITICAL">("ALL");

  const milestones = useMemo(() => {
    return getProjectRealMilestones(activeProject);
  }, [activeProject]);

  const filteredMilestones = useMemo(() => {
    return milestones.filter((m) => {
      if (timeFilter === "30" && m.daysRemaining > 30) return false;
      if (timeFilter === "60" && m.daysRemaining > 60) return false;
      if (timeFilter === "90" && m.daysRemaining > 90) return false;
      if (timeFilter === "CRITICAL" && !m.criticalPath) return false;
      return true;
    });
  }, [milestones, timeFilter]);

  return (
    <div
      id="upcoming-milestones-exploration-card"
      className={`bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 space-y-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 shrink-0">
                <Milestone className="w-4 h-4" />
              </span>
              <h3 className="text-base font-semibold text-[#172033] dark:text-white tracking-tight whitespace-nowrap">
                Upcoming Milestones & Critical Path Gates
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold font-mono whitespace-nowrap shrink-0 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {filteredMilestones.length} {filteredMilestones.length === 1 ? "Deliverable" : "Deliverables"}
              </span>
            </div>
            <p className="text-xs text-[#667085] dark:text-slate-400 mt-1 line-clamp-2 max-w-2xl break-words">
              Contractual completion deadlines and Taking-Over Certificate (TOC) gates for {activeProject?.name || "the project"}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/programme")}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
            title="Open Programme of Works"
          >
            <span>Programme View</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Time Filter Controls Bar */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F7F8FA] dark:bg-slate-800/80 rounded-xl border border-[#E6E9EF] dark:border-slate-700 text-xs overflow-x-auto">
          {[
            { id: "ALL", label: "All Horizon" },
            { id: "30", label: "Next 30 Days" },
            { id: "60", label: "Next 60 Days" },
            { id: "CRITICAL", label: "Critical Path" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTimeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                timeFilter === tab.id
                  ? "bg-white dark:bg-slate-700 text-[#172033] dark:text-white shadow-2xs font-bold"
                  : "text-[#667085] hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Milestones List */}
      {filteredMilestones.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 gap-3">
          {filteredMilestones.map((m) => {
            const isCompleted = m.status === "Completed";
            return (
              <div
                key={m.id}
                onClick={() => onMilestoneSelect && onMilestoneSelect(m)}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer min-w-0 overflow-hidden ${
                  isCompleted
                    ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-300"
                    : m.criticalPath
                    ? "bg-amber-50/20 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-300"
                    : "bg-[#F7F8FA] dark:bg-slate-900/50 border-[#E6E9EF] dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-1 text-xs min-w-0">
                    <span className="font-mono text-[10px] font-bold text-slate-500 uppercase truncate min-w-0" title={m.category}>
                      {m.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 whitespace-nowrap ${
                        isCompleted
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>

                  <p className="font-semibold text-xs text-[#172033] dark:text-white line-clamp-2 min-h-[2rem] break-words min-w-0" title={m.name}>
                    {m.name}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 min-w-0">
                  <span className="flex items-center gap-1 text-[11px] font-mono truncate min-w-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate min-w-0">{m.targetDate}</span>
                  </span>
                  <span className="font-semibold text-[11px] text-blue-600 dark:text-blue-400 shrink-0 whitespace-nowrap">
                    {m.daysRemaining > 0 ? `${m.daysRemaining} days left` : isCompleted ? "Completed" : "Target reached"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 sm:p-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-[#F7F8FA]/60 dark:bg-slate-900/30 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
            <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-semibold text-[#172033] dark:text-white">
              No Specific Schedule Milestones Logged
            </h4>
            <p className="text-xs text-[#667085] dark:text-slate-400 leading-relaxed">
              Import or configure your programme schedule in the Programme tab to track critical path deliverable gates for <span className="font-medium text-slate-700 dark:text-slate-300">{activeProject?.name || "the selected project"}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/programme")}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs whitespace-nowrap transition-colors"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Open Programme of Works</span>
          </button>
        </div>
      )}
    </div>
  );
}
