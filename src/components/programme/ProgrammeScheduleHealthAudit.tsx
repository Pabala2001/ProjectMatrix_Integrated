import React from "react";
import { CalculationDiagnostic, EngineActivity } from "../../types/programmeEngine";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Flame, 
  ArrowRight, 
  Award,
  Zap,
  Info
} from "lucide-react";

interface ProgrammeScheduleHealthAuditProps {
  diagnostics: CalculationDiagnostic;
  activities: EngineActivity[];
  onSelectActivity?: (id: string) => void;
}

export const ProgrammeScheduleHealthAudit: React.FC<ProgrammeScheduleHealthAuditProps> = ({
  diagnostics,
  activities,
  onSelectActivity
}) => {
  const score = diagnostics.dcmaScore;
  const isHealthy = score >= 80;
  const isModerate = score >= 60 && score < 80;

  return (
    <div className="controls-page-container overflow-hidden max-w-full w-full space-y-6 animate-fade-in">
      {/* Top Score Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner shrink-0 ${
            isHealthy 
              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-300" 
              : isModerate 
                ? "bg-amber-50 dark:bg-amber-950 text-amber-600 border border-amber-300" 
                : "bg-rose-50 dark:bg-rose-950 text-rose-600 border border-rose-300"
          }`}>
            {score}%
          </div>

          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                DCMA 14-Point Schedule Integrity Audit
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Industry standard quality audit analyzing logic completeness, relationship types distribution, negative float breaches, and artificial constraint rigidity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Calculation Latency</span>
            <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-200">{diagnostics.calculationTimeMs} ms</span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Critical Density</span>
            <span className="text-sm font-black font-mono text-rose-600">
              {Math.round((diagnostics.criticalActivitiesCount / (diagnostics.totalActivities || 1)) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Audit Checklist Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Audit Checklist Findings & Diagnostic Breakdown
          </h3>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {diagnostics.dcmaIssues.length === 0 ? (
            <div className="p-8 text-center text-xs text-emerald-600 font-bold flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <span>Perfect Schedule Health! Zero DCMA logic breaches detected.</span>
            </div>
          ) : (
            diagnostics.dcmaIssues.map((issue, idx) => (
              <div key={idx} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    issue.severity === "High" 
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60" 
                      : "bg-amber-50 text-amber-600 dark:bg-amber-950/60"
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      {issue.rule}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {issue.description}
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 border ${
                  issue.severity === "High"
                    ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  {issue.affectedCount} Affected
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
