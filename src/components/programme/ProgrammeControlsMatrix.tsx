import React, { useState, useMemo } from "react";
import { 
  EngineActivity, 
  ProjectCalendar, 
  RelationshipType, 
  ConstraintType 
} from "../../types/programmeEngine";
import { 
  Zap, 
  AlertCircle, 
  Clock, 
  Layers, 
  TrendingUp, 
  CheckCircle2, 
  Calendar, 
  Filter, 
  SlidersHorizontal, 
  ArrowUpDown, 
  Eye, 
  ChevronRight, 
  ChevronDown,
  Edit2,
  Trash2,
  Plus,
  Compass,
  FileSpreadsheet,
  Flame,
  ShieldAlert,
  ArrowRight
} from "lucide-react";

interface ProgrammeControlsMatrixProps {
  activities: EngineActivity[];
  calendars: Record<string, ProjectCalendar>;
  onViewActivity?: (activity: EngineActivity) => void;
  onEditActivity: (activity: EngineActivity) => void;
  onDeleteActivity: (id: string) => void;
  onAddActivity: () => void;
  onRecalculateCPM: () => void;
  onSelectActivity?: (id: string) => void;
  selectedActivityId?: string | null;
}

export const ProgrammeControlsMatrix: React.FC<ProgrammeControlsMatrixProps> = ({
  activities,
  calendars,
  onViewActivity,
  onEditActivity,
  onDeleteActivity,
  onAddActivity,
  onRecalculateCPM,
  onSelectActivity,
  selectedActivityId
}) => {
  // Preset column view mode
  const [columnViewMode, setColumnViewMode] = useState<"standard" | "cpm_dates" | "float_critical" | "baselines" | "productivity" | "all">("standard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(false);
  const [filterDelayedOnly, setFilterDelayedOnly] = useState(false);
  const [filterNearCritical, setFilterNearCritical] = useState(false);
  const [filterMilestonesOnly, setFilterMilestonesOnly] = useState(false);
  const [sortField, setSortField] = useState<keyof EngineActivity>("sortOrder");
  const [sortAsc, setSortAsc] = useState(true);

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterCriticalOnly(false);
    setFilterDelayedOnly(false);
    setFilterNearCritical(false);
    setFilterMilestonesOnly(false);
  };

  // Filtered & Sorted Activities
  const processedActivities = useMemo(() => {
    return activities
      .filter(act => {
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          const matchName = act.name.toLowerCase().includes(s);
          const matchWbs = act.wbsCode.toLowerCase().includes(s);
          const matchResp = (act.responsiblePerson || "").toLowerCase().includes(s);
          if (!matchName && !matchWbs && !matchResp) return false;
        }
        if (filterCriticalOnly && !act.isCritical) return false;
        if (filterDelayedOnly && act.varianceB0Days <= 0 && act.varianceB1Days <= 0 && act.status !== "Delayed") return false;
        if (filterNearCritical && (act.isCritical || act.totalFloat <= 0 || act.totalFloat > 5)) return false;
        if (filterMilestonesOnly && act.activityType !== "StartMilestone" && act.activityType !== "FinishMilestone") return false;
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (valA === undefined || valA === null) valA = "";
        if (valB === undefined || valB === null) valB = "";
        if (typeof valA === "string") {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? (valA - valB) : (valB - valA);
      });
  }, [activities, searchTerm, filterCriticalOnly, filterDelayedOnly, filterNearCritical, filterMilestonesOnly, sortField, sortAsc]);

  const handleSort = (field: keyof EngineActivity) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Helper to render predecessors string
  const formatLogic = (predecessors: EngineActivity["predecessors"]) => {
    if (!predecessors || predecessors.length === 0) return <span className="text-slate-500 italic text-[11px]">None</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {predecessors.map((p, pIdx) => {
          const predAct = activities.find(a => a.id === p.predecessorId);
          const label = predAct ? predAct.wbsCode : p.predecessorId;
          const lagStr = p.lag !== 0 ? (p.lag > 0 ? `+${p.lag}d` : `${p.lag}d`) : "";
          return (
            <span
              key={`${p.id || p.predecessorId}-${p.type}-${pIdx}`}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                p.isDriving 
                  ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
              }`}
              title={`${predAct?.name || ''} (${p.type} ${lagStr}) ${p.isDriving ? '[DRIVING]' : ''}`}
            >
              <span>{label}</span>
              <span className="text-[9px] opacity-75 font-sans">{p.type}</span>
              {lagStr && <span className="text-[9px] text-amber-800 dark:text-amber-300">{lagStr}</span>}
            </span>
          );
        })}
      </div>
    );
  };

  // Helper to format dates cleanly without truncation (DD/MM/YYYY)
  const formatProgrammeDate = (dateStr?: string) => {
    if (!dateStr || dateStr === "NA" || dateStr === "-") return "-";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    try {
      const parts = dateStr.split(/[-/T ]/);
      if (parts.length >= 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
      }
    } catch {}
    return dateStr;
  };

  return (
    <div className="controls-page-container overflow-hidden max-w-full w-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in">
      {/* Matrix Controls & View Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-between gap-3">
        {/* Left: View Filter Presets */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
            <span>Matrix Preset:</span>
          </span>

          <div className="inline-flex bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300/60 dark:border-slate-700 text-xs">
            <button
              onClick={() => setColumnViewMode("standard")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                columnViewMode === "standard" 
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Standard Controls
            </button>
            <button
              onClick={() => setColumnViewMode("cpm_dates")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                columnViewMode === "cpm_dates" 
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              CPM Pass (ES / EF / LS / LF)
            </button>
            <button
              onClick={() => setColumnViewMode("float_critical")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                columnViewMode === "float_critical" 
                  ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Float & Critical Path
            </button>
            <button
              onClick={() => setColumnViewMode("baselines")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                columnViewMode === "baselines" 
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Baselines (B0 / B1 / Forecast)
            </button>
            <button
              onClick={() => setColumnViewMode("productivity")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                columnViewMode === "productivity" 
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Resource & Productivity
            </button>
            <button
              onClick={() => setColumnViewMode("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                columnViewMode === "all" 
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              All Columns
            </button>
          </div>
        </div>

        {/* Right: Search & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search WBS, activity, contractor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 shadow-2xs"
          />

          {/* Quick Filters */}
          <button
            onClick={() => setFilterCriticalOnly(!filterCriticalOnly)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterCriticalOnly 
                ? "bg-rose-500 text-white border-rose-600 shadow-xs" 
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Critical Path ({activities.filter(a => a.isCritical).length})</span>
          </button>

          <button
            onClick={() => setFilterDelayedOnly(!filterDelayedOnly)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterDelayedOnly 
                ? "bg-amber-500 text-white border-amber-600 shadow-xs" 
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-300"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Delayed ({activities.filter(a => a.varianceB0Days > 0 || a.varianceB1Days > 0).length})</span>
          </button>

          <button
            onClick={onRecalculateCPM}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
            title="Recalculate Early/Late Dates, Float, and Critical Path across the network"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Re-Run CPM Engine</span>
          </button>

          <button
            onClick={onAddActivity}
            className="px-3 py-1.5 bg-[#0F2942] hover:bg-[#1E3A5F] text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Activity</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-[1550px]">
          <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-xs border-b border-slate-200 dark:border-slate-700">
            <tr className="text-slate-700 dark:text-slate-300 text-[11px] font-extrabold uppercase tracking-wider select-none">
              {/* Common Columns */}
              <th onClick={() => handleSort("sortOrder")} className="py-3 px-3 cursor-pointer hover:text-blue-600 w-14 text-center whitespace-nowrap">
                #
              </th>
              <th onClick={() => handleSort("wbsCode")} className="py-3 px-3 cursor-pointer hover:text-blue-600 w-28 min-w-[100px] whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <span>WBS</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th onClick={() => handleSort("name")} className="py-3 px-4 cursor-pointer hover:text-blue-600 min-w-[300px] max-w-[460px]">
                <div className="flex items-center gap-1">
                  <span>Activity Name</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60 shrink-0" />
                </div>
              </th>
              <th onClick={() => handleSort("calendarId")} className="py-3 px-2 cursor-pointer hover:text-blue-600 w-24 min-w-[80px] text-center whitespace-nowrap">
                Calendar
              </th>
              <th onClick={() => handleSort("originalDuration")} className="py-3 px-2 cursor-pointer hover:text-blue-600 w-24 min-w-[80px] text-right whitespace-nowrap">
                Duration (OD)
              </th>
              <th onClick={() => handleSort("remainingDuration")} className="py-3 px-2 cursor-pointer hover:text-blue-600 w-24 min-w-[80px] text-right whitespace-nowrap">
                Remaining (RD)
              </th>
              <th onClick={() => handleSort("progress")} className="py-3 px-3 cursor-pointer hover:text-blue-600 w-28 min-w-[95px] text-center whitespace-nowrap">
                % Done
              </th>
              <th onClick={() => handleSort("status")} className="py-3 px-3 cursor-pointer hover:text-blue-600 w-28 min-w-[105px] text-center whitespace-nowrap">
                Status
              </th>

              {/* CPM Early & Late Dates */}
              {(columnViewMode === "standard" || columnViewMode === "cpm_dates" || columnViewMode === "all") && (
                <>
                  <th onClick={() => handleSort("earlyStart")} className="py-3 px-3 cursor-pointer hover:text-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 min-w-[125px] whitespace-nowrap">
                    Early Start (ES)
                  </th>
                  <th onClick={() => handleSort("earlyFinish")} className="py-3 px-3 cursor-pointer hover:text-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 min-w-[125px] whitespace-nowrap">
                    Early Finish (EF)
                  </th>
                </>
              )}

              {(columnViewMode === "cpm_dates" || columnViewMode === "all") && (
                <>
                  <th onClick={() => handleSort("lateStart")} className="py-3 px-3 cursor-pointer hover:text-purple-600 bg-purple-50/60 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 min-w-[125px] whitespace-nowrap">
                    Late Start (LS)
                  </th>
                  <th onClick={() => handleSort("lateFinish")} className="py-3 px-3 cursor-pointer hover:text-purple-600 bg-purple-50/60 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 min-w-[125px] whitespace-nowrap">
                    Late Finish (LF)
                  </th>
                </>
              )}

              {/* Float & Criticality */}
              {(columnViewMode === "standard" || columnViewMode === "float_critical" || columnViewMode === "all") && (
                <>
                  <th onClick={() => handleSort("totalFloat")} className="py-3 px-2 cursor-pointer hover:text-rose-600 text-center w-28 min-w-[95px] whitespace-nowrap">
                    Total Float
                  </th>
                  <th onClick={() => handleSort("freeFloat")} className="py-3 px-2 cursor-pointer hover:text-slate-600 text-center w-24 min-w-[85px] whitespace-nowrap">
                    Free Float
                  </th>
                  <th onClick={() => handleSort("isCritical")} className="py-3 px-3 cursor-pointer hover:text-rose-600 text-center w-28 min-w-[105px] whitespace-nowrap">
                    Criticality
                  </th>
                </>
              )}

              {/* Logic Relationships */}
              {(columnViewMode === "standard" || columnViewMode === "cpm_dates" || columnViewMode === "all") && (
                <th className="py-3 px-3 min-w-[200px] max-w-[340px]">
                  Predecessors (Logic)
                </th>
              )}

              {/* Baselines & Forecast */}
              {(columnViewMode === "baselines" || columnViewMode === "all") && (
                <>
                  <th className="py-3 px-3 bg-slate-200/60 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Baseline 0 (Contract)
                  </th>
                  <th className="py-3 px-3 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Baseline 1 (Revised)
                  </th>
                  <th className="py-3 px-3 bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Forecast Finish
                  </th>
                  <th onClick={() => handleSort("varianceB0Days")} className="py-3 px-2 text-center w-20 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Δ B0 (d)
                  </th>
                  <th onClick={() => handleSort("varianceB1Days")} className="py-3 px-2 text-center w-20 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Δ B1 (d)
                  </th>
                </>
              )}

              {/* Productivity */}
              {(columnViewMode === "productivity" || columnViewMode === "all") && (
                <>
                  <th className="py-3 px-3 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Scope Volume
                  </th>
                  <th className="py-3 px-2 text-right bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Target Rate
                  </th>
                  <th className="py-3 px-2 text-right bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Actual Rate
                  </th>
                  <th className="py-3 px-2 text-right bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    Req. Rate
                  </th>
                </>
              )}

              <th className="py-3 px-3 text-right w-24 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-medium">
            {processedActivities.map((act, index) => {
              const isSelected = selectedActivityId === act.id;
              const isMilestone = act.activityType === "StartMilestone" || act.activityType === "FinishMilestone";
              const cal = calendars[act.calendarId] || calendars["cal-6day"];

              return (
                <tr 
                  key={act.id ? `${act.id}-${index}` : `act-row-${index}`}
                  onClick={() => onSelectActivity?.(act.id)}
                  onDoubleClick={() => onViewActivity ? onViewActivity(act) : onEditActivity(act)}
                  className={`transition-colors cursor-pointer select-none ${
                    isSelected 
                      ? "bg-blue-50/80 dark:bg-blue-950/40" 
                      : act.isCritical 
                        ? "bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/60" 
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {/* # Sort order */}
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {act.sortOrder || index + 1}
                  </td>

                  {/* WBS Code */}
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewActivity ? onViewActivity(act) : onEditActivity(act);
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-slate-200 dark:border-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      title="Click to view details"
                    >
                      {act.wbsCode}
                    </span>
                  </td>

                  {/* Activity Name - Up to 2 lines, no aggressive truncation */}
                  <td className="py-2.5 px-4 min-w-[300px] max-w-[460px]">
                    <div className="flex items-start gap-2 min-w-0">
                      {isMilestone ? (
                        <div className="w-3.5 h-3.5 mt-0.5 rotate-45 bg-purple-600 dark:bg-purple-400 shrink-0 shadow-xs" title="Milestone" />
                      ) : act.isCritical ? (
                        <div className="w-2.5 h-2.5 mt-1 rounded-full bg-rose-500 animate-pulse shrink-0" title="Critical Path Activity" />
                      ) : (
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                      )}

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewActivity ? onViewActivity(act) : onEditActivity(act);
                          }}
                          className={`font-bold text-left line-clamp-2 break-words w-full hover:underline transition-colors ${
                            act.isCritical 
                              ? "text-rose-900 dark:text-rose-200 hover:text-rose-600" 
                              : "text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                          }`}
                          title={`Click to view details for ${act.name}`}
                        >
                          {act.name}
                        </button>
                        {act.description && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 break-words mt-0.5" title={act.description}>
                            {act.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Calendar */}
                  <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" title={cal?.name}>
                      {cal?.type === "5-day" ? "5D" : cal?.type === "6-day" ? "6D" : "7D"}
                    </span>
                  </td>

                  {/* Original Duration (OD) */}
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {act.originalDuration}d
                  </td>

                  {/* Remaining Duration (RD) */}
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {act.remainingDuration}d
                  </td>

                  {/* Progress % */}
                  <td className="py-2.5 px-3 text-center min-w-[95px] whitespace-nowrap">
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden flex">
                      <div 
                        className={`h-full transition-all ${
                          act.progress === 100 
                            ? "bg-emerald-500" 
                            : act.isCritical 
                              ? "bg-rose-500" 
                              : "bg-blue-500"
                        }`}
                        style={{ width: `${act.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 mt-0.5 block">{act.progress}%</span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      act.status === "Complete" 
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800" 
                        : act.status === "In Progress"
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                          : act.status === "Delayed"
                            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                    }`}>
                      {act.status}
                    </span>
                  </td>

                  {/* Early Start & Finish (Full formatted dates) */}
                  {(columnViewMode === "standard" || columnViewMode === "cpm_dates" || columnViewMode === "all") && (
                    <>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-blue-900 dark:text-blue-300 bg-blue-50/20 dark:bg-blue-950/10 min-w-[125px] whitespace-nowrap">
                        {formatProgrammeDate(act.earlyStart)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-blue-900 dark:text-blue-300 bg-blue-50/20 dark:bg-blue-950/10 min-w-[125px] whitespace-nowrap">
                        {formatProgrammeDate(act.earlyFinish)}
                      </td>
                    </>
                  )}

                  {/* Late Start & Finish (Full formatted dates) */}
                  {(columnViewMode === "cpm_dates" || columnViewMode === "all") && (
                    <>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-purple-900 dark:text-purple-300 bg-purple-50/20 dark:bg-purple-950/10 min-w-[125px] whitespace-nowrap">
                        {formatProgrammeDate(act.lateStart)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-purple-900 dark:text-purple-300 bg-purple-50/20 dark:bg-purple-950/10 min-w-[125px] whitespace-nowrap">
                        {formatProgrammeDate(act.lateFinish)}
                      </td>
                    </>
                  )}

                  {/* Float & Criticality */}
                  {(columnViewMode === "standard" || columnViewMode === "float_critical" || columnViewMode === "all") && (
                    <>
                      <td className="py-2.5 px-2 text-center font-mono font-bold min-w-[95px] whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          act.totalFloat < 0 
                            ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300" 
                            : act.totalFloat === 0 
                              ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-black" 
                              : act.totalFloat <= 5
                                ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                : "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                        }`}>
                          {act.totalFloat}d
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-500 min-w-[85px] whitespace-nowrap">
                        {act.freeFloat !== undefined ? `${act.freeFloat}d` : "-"}
                      </td>

                      <td className="py-2.5 px-3 text-center min-w-[105px] whitespace-nowrap">
                        {act.isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white font-extrabold text-[10px] tracking-wide shadow-2xs">
                            <Flame className="w-3 h-3" />
                            <span>CRITICAL</span>
                          </span>
                        ) : act.totalFloat <= 5 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-[10px] border border-amber-300">
                            NEAR CRIT
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-bold">
                            NON-CRIT
                          </span>
                        )}
                      </td>
                    </>
                  )}

                  {/* Predecessors Logic */}
                  {(columnViewMode === "standard" || columnViewMode === "cpm_dates" || columnViewMode === "all") && (
                    <td className="py-2.5 px-3 min-w-[200px] max-w-[340px]">
                      {formatLogic(act.predecessors)}
                    </td>
                  )}

                  {/* Baseline & Forecast Comparisons */}
                  {(columnViewMode === "baselines" || columnViewMode === "all") && (
                    <>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100/40 dark:bg-slate-800/40 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        {act.baseline0 ? `${act.baseline0.baselineStart} → ${act.baseline0.baselineFinish}` : "Not Set"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/20 dark:bg-indigo-950/10 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        {act.baseline1 ? `${act.baseline1.baselineStart} → ${act.baseline1.baselineFinish}` : "Not Set"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50/20 dark:bg-amber-950/10 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        {act.forecastFinish || "-"}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                          act.varianceB0Days > 0 
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" 
                            : act.varianceB0Days < 0 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" 
                              : "text-slate-400"
                        }`}>
                          {act.varianceB0Days > 0 ? `+${act.varianceB0Days}d` : `${act.varianceB0Days}d`}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                          act.varianceB1Days > 0 
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" 
                            : act.varianceB1Days < 0 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" 
                              : "text-slate-400"
                        }`}>
                          {act.varianceB1Days > 0 ? `+${act.varianceB1Days}d` : `${act.varianceB1Days}d`}
                        </span>
                      </td>
                    </>
                  )}

                  {/* Resource & Productivity */}
                  {(columnViewMode === "productivity" || columnViewMode === "all") && (
                    <>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        {act.resourceAssignment ? `${act.resourceAssignment.totalScopeQty} ${act.resourceAssignment.unit}` : "-"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        {act.resourceAssignment ? `${act.resourceAssignment.targetDailyRate}/d` : "-"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        {act.resourceAssignment?.actualDailyRateAchieved ? `${act.resourceAssignment.actualDailyRateAchieved}/d` : "-"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        {act.requiredDailyProductivity ? `${act.requiredDailyProductivity}/d` : "-"}
                      </td>
                    </>
                  )}

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap overflow-hidden text-ellipsis truncate">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewActivity ? onViewActivity(act) : onEditActivity(act);
                        }}
                        className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="View Activity Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditActivity(act);
                        }}
                        className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Activity & Relationships"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteActivity(act.id);
                        }}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete Activity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Empty State: Filtered Out */}
            {activities.length > 0 && processedActivities.length === 0 && (
              <tr>
                <td colSpan={18} className="py-12 px-4 text-center">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto text-amber-600">
                      <Filter className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No activities match the current filters
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        There are {activities.length} total activities in the programme, but none match your active filters or search terms.
                      </p>
                    </div>
                    <button
                      onClick={handleResetFilters}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Reset All Filters & Search
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty State: No activities at all */}
            {activities.length === 0 && (
              <tr>
                <td colSpan={18} className="py-16 px-4 text-center">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center mx-auto text-blue-600">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        No Schedule Activities Yet
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Add tasks to build out your critical path network, or import a contractual schedule via PDF, Primavera P6, or MS Project XML.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={onAddActivity}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add First Activity</span>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary Stats */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>Showing <strong className="text-slate-800 dark:text-slate-200">{processedActivities.length}</strong> of {activities.length} activities</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <strong className="text-rose-600 font-bold">{activities.filter(a => a.isCritical).length} Critical</strong>
          </span>
          <span>•</span>
          <span>
            Total Float Span:{" "}
            <strong className="font-mono text-slate-700 dark:text-slate-300">
              {activities.length > 0 
                ? `${Math.min(...activities.map(a => a.totalFloat))}d to ${Math.max(...activities.map(a => a.totalFloat))}d`
                : "0d"
              }
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">P6-Standard Critical Path Calculation active</span>
        </div>
      </div>
    </div>
  );
};
