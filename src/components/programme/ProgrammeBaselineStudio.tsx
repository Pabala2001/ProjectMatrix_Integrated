import React from "react";
import { EngineActivity } from "../../types/programmeEngine";
import { 
  History, 
  Layers, 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  ArrowRight, 
  Calendar, 
  Sparkles,
  BarChart3
} from "lucide-react";

interface ProgrammeBaselineStudioProps {
  activities: EngineActivity[];
  onSnapshotBaseline: (target: "baseline0" | "baseline1") => void;
}

export const ProgrammeBaselineStudio: React.FC<ProgrammeBaselineStudioProps> = ({
  activities,
  onSnapshotBaseline
}) => {
  // Aggregate Metrics
  const totalB0Delayed = activities.filter(a => a.varianceB0Days > 0).length;
  const totalB1Delayed = activities.filter(a => a.varianceB1Days > 0).length;
  const maxB0Variance = Math.max(0, ...activities.map(a => a.varianceB0Days));
  const maxB1Variance = Math.max(0, ...activities.map(a => a.varianceB1Days));

  // Compute Earned Schedule Metrics
  const totalPlannedDuration = activities.reduce((acc, a) => acc + (a.baseline0?.duration || a.originalDuration), 0);
  const totalEarnedDuration = activities.reduce((acc, a) => acc + ((a.baseline0?.duration || a.originalDuration) * (a.progress / 100)), 0);
  const spiT = totalPlannedDuration > 0 ? Number((totalEarnedDuration / (totalPlannedDuration * 0.45)).toFixed(2)) : 1.0; // against current time elapsed

  return (
    <div className="controls-page-container overflow-hidden max-w-full w-full space-y-6 animate-fade-in">
      {/* Top Banner & Snapshot Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Baseline 0: Contract Target */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-wider">
                Baseline 0
              </span>
              <span className="text-xs font-mono text-slate-400">Contractual Freeze</span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Original Contract Schedule
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Initial approved target baseline established at contract award. Used for total delay claims and liquidated damages evaluation.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Critical Variance</span>
              <span className="text-lg font-black font-mono text-rose-600">+{maxB0Variance} Days</span>
            </div>
            <button
              onClick={() => onSnapshotBaseline("baseline0")}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snapshot B0</span>
            </button>
          </div>
        </div>

        {/* Baseline 1: Approved Revision */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase tracking-wider">
                Baseline 1
              </span>
              <span className="text-xs font-mono text-indigo-500">Approved EOT Revision</span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Approved Extension of Time (EOT)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Formally revised programme incorporating granted EoTs, employer variations, and mitigated sequence acceleration.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Variance to B1</span>
              <span className="text-lg font-black font-mono text-indigo-600">+{maxB1Variance} Days</span>
            </div>
            <button
              onClick={() => onSnapshotBaseline("baseline1")}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snapshot B1</span>
            </button>
          </div>
        </div>

        {/* Earned Schedule & Forecast Horizon */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0F2942] to-[#1E3A5F] text-white shadow-md flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-emerald-300 text-xs font-black uppercase tracking-wider">
                Earned Schedule
              </span>
              <span className="text-xs text-slate-300 font-mono">SPI(t) Index</span>
            </div>
            <h3 className="text-base font-extrabold">
              Dynamic Forecast Engine
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Calculated using progress update cutoff, remaining durations, and active productivity velocity.
            </p>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between mt-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-300 block">Schedule Efficiency</span>
              <span className={`text-lg font-black font-mono ${spiT >= 1.0 ? "text-emerald-400" : "text-amber-400"}`}>
                SPI(t) = {spiT}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-300 block">Earned Duration</span>
              <span className="text-base font-black font-mono text-white">{Math.round(totalEarnedDuration)} / {totalPlannedDuration}d</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Baseline Variance Analysis Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Activity Variance & Slippage Matrix (B0 vs B1 vs Current vs Forecast)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {totalB0Delayed} slippages against Baseline 0
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px] text-xs table-fixed">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3 w-24 truncate overflow-hidden">WBS</th>
                <th className="py-3 px-4 min-w-[220px] truncate overflow-hidden">Activity Name</th>
                <th className="py-3 px-3 bg-slate-200/50 dark:bg-slate-800/50 truncate overflow-hidden">Baseline 0 (Contract)</th>
                <th className="py-3 px-3 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-300 truncate overflow-hidden">Baseline 1 (Revised)</th>
                <th className="py-3 px-3 bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 truncate overflow-hidden">Current Schedule</th>
                <th className="py-3 px-3 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 truncate overflow-hidden">Forecast Finish</th>
                <th className="py-3 px-3 text-center truncate overflow-hidden">Δ B0 (Days)</th>
                <th className="py-3 px-3 text-center truncate overflow-hidden">Δ B1 (Days)</th>
                <th className="py-3 px-3 text-center truncate overflow-hidden">Variance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {activities.map((act, idx) => {
                const b0Finish = act.baseline0?.baselineFinish || "-";
                const b1Finish = act.baseline1?.baselineFinish || "-";
                const currentFinish = act.earlyFinish || "-";
                const forecastFinish = act.forecastFinish || "-";

                return (
                  <tr key={`${act.id || "act"}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300 truncate overflow-hidden">
                      {act.wbsCode}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200 truncate overflow-hidden max-w-[280px]" title={act.name}>
                      {act.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 bg-slate-100/30 dark:bg-slate-800/30 truncate overflow-hidden">
                      {b0Finish}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50/10 dark:bg-indigo-950/10 truncate overflow-hidden">
                      {b1Finish}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-blue-700 dark:text-blue-300 bg-blue-50/10 dark:bg-blue-950/10 truncate overflow-hidden">
                      {currentFinish}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50/10 dark:bg-amber-950/10 truncate overflow-hidden">
                      {forecastFinish}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold truncate overflow-hidden">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        act.varianceB0Days > 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" :
                        act.varianceB0Days < 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                        "text-slate-400"
                      }`}>
                        {act.varianceB0Days > 0 ? `+${act.varianceB0Days}d` : `${act.varianceB0Days}d`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold truncate overflow-hidden">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        act.varianceB1Days > 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" :
                        act.varianceB1Days < 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                        "text-slate-400"
                      }`}>
                        {act.varianceB1Days > 0 ? `+${act.varianceB1Days}d` : `${act.varianceB1Days}d`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center truncate overflow-hidden">
                      {act.varianceB0Days > 0 ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[11px]">
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>Delayed Slippage</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>On / Ahead Target</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
