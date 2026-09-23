import React from "react";
import { EngineActivity } from "../../types/programmeEngine";
import { 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Users, 
  Gauge, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  HardHat
} from "lucide-react";

interface ProgrammeResourceProductivityProps {
  activities: EngineActivity[];
  onEditActivity?: (activity: EngineActivity) => void;
}

export const ProgrammeResourceProductivity: React.FC<ProgrammeResourceProductivityProps> = ({
  activities,
  onEditActivity
}) => {
  // Filter activities with resource assignments
  const resourceActivities = activities.filter(a => !!a.resourceAssignment);

  // Aggregates
  const totalAssignedScope = resourceActivities.reduce((acc, a) => acc + (a.resourceAssignment?.totalScopeQty || 0), 0);
  const totalEarnedScope = resourceActivities.reduce((acc, a) => {
    const scope = a.resourceAssignment?.totalScopeQty || 0;
    return acc + (scope * (a.progress / 100));
  }, 0);

  const underperformingStaffTeams = resourceActivities.filter(a => {
    const ra = a.resourceAssignment;
    return ra && ra.actualDailyRateAchieved !== undefined && ra.actualDailyRateAchieved < ra.targetDailyRate;
  });

  return (
    <div className="controls-page-container overflow-hidden max-w-full w-full space-y-6 animate-fade-in">
      {/* Top Resource Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 shrink-0">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Monitored Crews</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">{resourceActivities.length} Operations</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Physical Scope Earned</span>
            <span className="text-xl font-black text-emerald-600">
              {Math.round((totalEarnedScope / (totalAssignedScope || 1)) * 100)}%
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Underperforming Crews</span>
            <span className="text-xl font-black text-rose-600">{underperformingStaffTeams.length} Bottlenecks</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Acceleration Calc</span>
            <span className="text-xl font-black text-indigo-600">Dynamic Velocity</span>
          </div>
        </div>
      </div>

      {/* Production Rate Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Daily Productivity & Acceleration Recovery Engine
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical burn rates against target planned production and calculated acceleration velocity needed to recover baseline finish.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px] text-xs table-fixed">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3 w-24 truncate overflow-hidden">WBS</th>
                <th className="py-3 px-4 min-w-[200px] truncate overflow-hidden">Activity & Resource Crew</th>
                <th className="py-3 px-3 text-right truncate overflow-hidden">Scope Total</th>
                <th className="py-3 px-3 text-right truncate overflow-hidden">Scope Earned</th>
                <th className="py-3 px-3 text-right truncate overflow-hidden">Target Rate</th>
                <th className="py-3 px-3 text-right truncate overflow-hidden">Actual Rate</th>
                <th className="py-3 px-3 text-center truncate overflow-hidden">Productivity Index (PI)</th>
                <th className="py-3 px-3 text-right bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 truncate overflow-hidden">
                  Required Rate (EoT Recovery)
                </th>
                <th className="py-3 px-3 text-center truncate overflow-hidden">Productivity Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {resourceActivities.map((act, idx) => {
                const ra = act.resourceAssignment!;
                const earned = Math.round(ra.totalScopeQty * (act.progress / 100));
                const pi = act.productivityPerformanceIndex;
                const isUnderperforming = pi !== undefined && pi < 0.9;
                const isOptimal = pi !== undefined && pi >= 1.0;

                return (
                  <tr key={`${act.id || "act"}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300 truncate overflow-hidden">
                      {act.wbsCode}
                    </td>
                    <td className="py-3 px-4 min-w-[200px] max-w-[280px] truncate overflow-hidden">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate" title={act.name}>{act.name}</div>
                      <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1 truncate" title={ra.resourceName}>
                        <Users className="w-3 h-3 shrink-0" />
                        <span className="truncate">{ra.resourceName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300 truncate overflow-hidden">
                      {ra.totalScopeQty.toLocaleString()} {ra.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white truncate overflow-hidden">
                      {earned.toLocaleString()} {ra.unit} ({act.progress}%)
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400 truncate overflow-hidden">
                      {ra.targetDailyRate} {ra.unit}/day
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-800 dark:text-slate-200 truncate overflow-hidden">
                      {ra.actualDailyRateAchieved ? `${ra.actualDailyRateAchieved} ${ra.unit}/day` : "-"}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-extrabold truncate overflow-hidden">
                      {pi !== undefined ? (
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          isUnderperforming 
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" 
                            : isOptimal 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" 
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {pi}x
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10 truncate overflow-hidden">
                      {act.requiredDailyProductivity ? `${act.requiredDailyProductivity} ${ra.unit}/day` : "-"}
                    </td>
                    <td className="py-3 px-3 text-center truncate overflow-hidden">
                      {isUnderperforming ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Crew Slipping (-{Math.round((1 - pi!) * 100)}%)</span>
                        </span>
                      ) : isOptimal ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Target Exceeded (+{Math.round((pi! - 1) * 100)}%)</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Standard Flow</span>
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
