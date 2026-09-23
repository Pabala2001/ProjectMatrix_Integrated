import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Sparkles,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Activity,
  Sliders,
  Scale,
  RefreshCw,
  Eye,
  Info
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend
} from "recharts";
import { SupportedCurrency } from "../../config/currencies";
import { formatCompactCurrency } from "../../utils/currency";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { 
  getProjectRealContractValue, 
  getProjectRealProgress, 
  getProjectRealAttentionItems 
} from "../../utils/projectDataUtils";

export interface ProjectRiskRadarCardProps {
  activeProject?: any;
  allProjects?: any[];
  activeCompany?: any;
  selectedCurrency?: SupportedCurrency;
  className?: string;
}

export default function ProjectRiskRadarCard({
  activeProject,
  allProjects = [],
  activeCompany,
  selectedCurrency,
  className = ""
}: ProjectRiskRadarCardProps) {
  const { currencyCode: regionalCurrencyCode } = useRegionalSettings();
  const projectCurrencyCode = activeProject?.currency_code || activeProject?.currency || regionalCurrencyCode || "ZAR";
  const activeCurrency: SupportedCurrency = selectedCurrency || (projectCurrencyCode as SupportedCurrency) || "ZAR";

  const realContractValue = useMemo(() => {
    return getProjectRealContractValue(activeProject, activeCompany?.id);
  }, [activeProject, activeCompany?.id]);

  const realProgress = useMemo(() => {
    return getProjectRealProgress(activeProject);
  }, [activeProject]);

  const attentionItems = useMemo(() => {
    return getProjectRealAttentionItems(activeProject, activeCompany?.id);
  }, [activeProject, activeCompany?.id]);

  const radarData = useMemo(() => {
    const qualityIssues = attentionItems.filter(a => a.type === "Quality").length;
    const scheduleIssues = attentionItems.filter(a => a.type === "Schedule").length;
    const costIssues = attentionItems.filter(a => a.type === "Cost").length;
    const contractIssues = attentionItems.filter(a => a.type === "Contract").length;

    const budgetScore = Math.max(50, 95 - (costIssues * 15));
    const scheduleScore = Math.max(45, 90 - (scheduleIssues * 18));
    const qualityScore = Math.max(55, 92 - (qualityIssues * 12));
    const resourceScore = 82;
    const contractScore = Math.max(50, 90 - (contractIssues * 15));
    const hseqScore = 96;

    return [
      { dimension: "Budget & Cashflow", score: budgetScore, benchmark: 90, summary: "Cost Performance" },
      { dimension: "Schedule & Float", score: scheduleScore, benchmark: 88, summary: "Time Baseline" },
      { dimension: "Quality & NCRs", score: qualityScore, benchmark: 85, summary: "Material Tests" },
      { dimension: "Resources & Plant", score: resourceScore, benchmark: 85, summary: "Site Logistics" },
      { dimension: "Contract & Claims", score: contractScore, benchmark: 90, summary: "Clause Compliance" },
      { dimension: "HSEQ & Safety", score: hseqScore, benchmark: 90, summary: "Zero Incident Audit" }
    ];
  }, [attentionItems]);

  const overallRisk = useMemo(() => {
    const lowest = Math.min(...radarData.map(d => d.score));
    if (lowest < 60) return { level: "HIGH", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 border-rose-200" };
    if (lowest < 75) return { level: "MEDIUM", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200" };
    return { level: "LOW", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200" };
  }, [radarData]);

  return (
    <div
      id="project-risk-radar-card"
      className={`bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="p-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-200 dark:border-purple-800 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <h3 className="text-base font-semibold text-[#172033] dark:text-white tracking-tight whitespace-nowrap">
              Risk & Controls Radar
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 whitespace-nowrap ${overallRisk.color}`}>
              {overallRisk.level} RISK PROFILE
            </span>
          </div>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-1 line-clamp-2 max-w-2xl break-words">
            {activeProject?.name || "Selected Project"} &bull; Multi-axis compliance & critical path stress analysis.
          </p>
        </div>
      </div>

      {/* Radar Chart with safe inner padding so wording never overflows */}
      <div className="h-[250px] w-full min-w-0 overflow-hidden flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="56%" data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="dimension" tick={{ fill: "#64748b", fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 9 }} />
            <Radar name="Project Score" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
            <Radar name="Target Benchmark" dataKey="benchmark" stroke="#cbd5e1" strokeDasharray="3 3" fill="transparent" />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Dimension Summary Badges Grid for Visual Balance with Health Card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {radarData.map((item) => (
          <div
            key={item.dimension}
            className="p-2 rounded-xl bg-[#F7F8FA] dark:bg-slate-900/50 border border-[#E6E9EF] dark:border-slate-800 flex items-center justify-between gap-1.5 min-w-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-[#172033] dark:text-white truncate" title={item.dimension}>
                {item.dimension}
              </p>
              <p className="text-[10px] text-[#667085] dark:text-slate-400 truncate">
                {item.summary}
              </p>
            </div>
            <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 ${
              item.score < 60
                ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                : item.score < 75
                ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
            }`}>
              {item.score}%
            </span>
          </div>
        ))}
      </div>

      {/* Bottom Summary Bar */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 min-w-0">
        <span className="truncate min-w-0">Contract: <strong>{activeProject?.contract_agreement_option || "NEC4 / FIDIC"}</strong></span>
        <span className="shrink-0 font-mono">Progress: <strong>{realProgress}%</strong></span>
      </div>
    </div>
  );
}
