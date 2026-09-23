import React, { useMemo } from "react";
import { 
  Building2, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  Layers, 
  Clock, 
  ArrowUpRight, 
  Activity, 
  CheckCircle2, 
  DollarSign 
} from "lucide-react";
import { SupportedCurrency, getCurrencyInfo, SUPPORTED_CURRENCIES } from "../../config/currencies";
import { formatCompactCurrency, formatCurrency } from "../../utils/currency";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { 
  getProjectRealContractValue, 
  getProjectRealProgress, 
  getProjectRealAttentionItems,
  getProjectRealMilestones 
} from "../../utils/projectDataUtils";

export interface PortfolioKpiStripProps {
  activeProject?: any;
  allProjects?: any[];
  activeCompany?: any;
  selectedCurrency?: SupportedCurrency;
  onCurrencyChange?: (curr: SupportedCurrency) => void;
  activeFilter?: string | null;
  onSelectFilter?: (filter: string | null) => void;
  className?: string;
}

export default function PortfolioKpiStrip({
  activeProject,
  allProjects = [],
  activeCompany,
  selectedCurrency,
  onCurrencyChange,
  activeFilter,
  onSelectFilter,
  className = ""
}: PortfolioKpiStripProps) {
  const { currencyCode: regionalCurrencyCode, setCurrencyCode } = useRegionalSettings();
  
  // Header currency is the single source of truth
  const activeCurrency: SupportedCurrency = (selectedCurrency || regionalCurrencyCode || activeProject?.currency_code || activeProject?.currency || "TZS") as SupportedCurrency;

  const realContractValue = useMemo(() => {
    return getProjectRealContractValue(activeProject, activeCompany?.id);
  }, [activeProject, activeCompany?.id]);

  const realProgress = useMemo(() => {
    return getProjectRealProgress(activeProject);
  }, [activeProject]);

  const attentionItems = useMemo(() => {
    return getProjectRealAttentionItems(activeProject, activeCompany?.id);
  }, [activeProject, activeCompany?.id]);

  const milestones = useMemo(() => {
    return getProjectRealMilestones(activeProject);
  }, [activeProject]);

  // Derive SPI from planned duration vs actual progress
  const spiData = useMemo(() => {
    const rawStart = activeProject?.start_date || activeProject?.startDate || activeProject?.planned_start_date || activeProject?.commencement_date;
    const rawEnd = activeProject?.end_date || activeProject?.endDate || activeProject?.completion_date || activeProject?.target_completion_date || activeProject?.planned_end_date;

    if (!rawStart || !rawEnd) {
      return { spi: null, label: "Baseline Not Set", badge: "Pending Dates" };
    }
    const start = new Date(rawStart).getTime();
    const end = new Date(rawEnd).getTime();
    const now = Date.now();
    if (isNaN(start) || isNaN(end) || end <= start) {
      return { spi: null, label: "Invalid Dates", badge: "-" };
    }
    const totalDuration = end - start;
    const elapsed = Math.max(0, Math.min(totalDuration, now - start));
    const plannedProgressPercent = (elapsed / totalDuration) * 100;
    
    if (plannedProgressPercent <= 0) {
      return { spi: 1.0, label: "Work Not Started", badge: "SPI 1.00" };
    }

    const spiVal = realProgress / plannedProgressPercent;
    const isLag = spiVal < 0.95;
    return {
      spi: spiVal.toFixed(2),
      label: isLag ? `${((1 - spiVal) * 100).toFixed(1)}% Behind Target` : `${((spiVal - 1) * 100).toFixed(1)}% Ahead of Target`,
      badge: `SPI ${spiVal.toFixed(2)}`
    };
  }, [activeProject, realProgress]);

  const handleSelectCurrency = (curr: SupportedCurrency) => {
    if (onCurrencyChange) {
      onCurrencyChange(curr);
    }
    setCurrencyCode(curr);
  };

  const projectOriginalCurrency = activeProject?.currency_code || activeProject?.currency || "TZS";

  const kpis = [
    {
      id: "value",
      value: realContractValue > 0 ? formatCompactCurrency(realContractValue, activeCurrency, projectOriginalCurrency) : "-",
      label: "Contract Value",
      meta: realContractValue > 0 ? `${activeProject?.contract_agreement_option || "Approved Contract"}` : "No Contract Value Uploaded",
      metaColor: realContractValue > 0 ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-slate-500",
      badge: activeProject?.code || activeProject?.contract_code || "PRJ",
      highlight: false
    },
    {
      id: "progress",
      value: `${realProgress}%`,
      label: "Physical Progress",
      meta: activeProject?.status || "In Execution",
      metaColor: realProgress > 0 ? "text-blue-700 dark:text-blue-400 font-semibold" : "text-slate-500",
      badge: "Measured S-Curve",
      highlight: false
    },
    {
      id: "schedule_variance",
      value: spiData.spi ? spiData.badge : "-",
      label: "Schedule Index (SPI)",
      meta: spiData.label,
      metaColor: spiData.spi && parseFloat(spiData.spi) < 0.95 ? "text-rose-700 dark:text-rose-400 font-medium" : "text-emerald-700 dark:text-emerald-400 font-medium",
      badge: spiData.spi && parseFloat(spiData.spi) < 0.95 ? "Variance" : "On Track",
      highlight: spiData.spi !== null && parseFloat(spiData.spi) < 0.95,
      highlightType: "warning"
    },
    {
      id: "attention",
      value: attentionItems.length.toString(),
      label: "Requires Attention",
      meta: attentionItems.length > 0 ? "Urgent Action Required" : "Controls in Order",
      metaColor: attentionItems.length > 0 ? "text-rose-700 dark:text-rose-400 font-semibold" : "text-emerald-700 dark:text-emerald-400 font-medium",
      badge: attentionItems.length > 0 ? `${attentionItems.length} Open` : "Clear",
      highlight: attentionItems.length > 0,
      highlightType: "danger"
    },
    {
      id: "milestones",
      value: milestones.length.toString(),
      label: "Programme Milestones",
      meta: milestones.length > 0 ? `${milestones.filter(m => m.status === "Completed").length} Completed` : "No Milestones Logged",
      metaColor: "text-slate-600 dark:text-slate-400",
      badge: "Critical Path",
      highlight: false
    }
  ];

  return (
    <div className={`space-y-3 ${className}`} id="portfolio-kpi-strip">
      {/* Top Bar with Currency & Quick Status Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#667085] dark:text-slate-400 uppercase tracking-wider">
            Project Matrix Telemetry
          </span>
          <span className="text-xs font-mono text-[#172033] dark:text-white font-bold">
            [{activeProject?.code || activeProject?.contract_code || "ACTIVE"}]
          </span>
          {activeFilter && (
            <button
              onClick={() => onSelectFilter && onSelectFilter(null)}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Clear filter: <strong>{activeFilter}</strong></span>
              <span>&times;</span>
            </button>
          )}
        </div>

        {/* Global / Project Currency Selector */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <span className="text-xs text-[#667085] dark:text-slate-400 font-medium">Currency:</span>
          <div className="flex items-center bg-[#F7F8FA] dark:bg-slate-800 p-0.5 rounded-xl border border-[#E6E9EF] dark:border-slate-700">
            {SUPPORTED_CURRENCIES.slice(0, 5).map((c) => (
              <button
                key={c.code}
                onClick={() => handleSelectCurrency(c.code)}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                  activeCurrency === c.code
                    ? "bg-white dark:bg-slate-700 text-[#172033] dark:text-white shadow-2xs"
                    : "text-[#667085] hover:text-[#172033] dark:hover:text-white"
                }`}
                title={c.name}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid with Perfect Alignment and Contained Wording */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 items-stretch">
        {kpis.map((kpi, idx) => {
          const isSelected = activeFilter === kpi.id;
          const isLastOnTwoCols = idx === kpis.length - 1;
          return (
            <div
              key={kpi.id}
              onClick={() => onSelectFilter && onSelectFilter(isSelected ? null : kpi.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden min-w-0 h-full ${
                isLastOnTwoCols ? "col-span-2 sm:col-span-1 lg:col-span-1" : ""
              } ${
                isSelected
                  ? "bg-blue-50/50 dark:bg-blue-950/40 border-blue-500 dark:border-blue-600 ring-2 ring-blue-500/20"
                  : kpi.highlight && kpi.highlightType === "danger"
                  ? "bg-rose-50/20 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 hover:border-rose-300"
                  : kpi.highlight && kpi.highlightType === "warning"
                  ? "bg-amber-50/20 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 hover:border-amber-300"
                  : "bg-white dark:bg-[#0B172A] border-[#E6E9EF] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-1.5 mb-2 min-w-0">
                <span className="text-xs font-medium text-[#667085] dark:text-slate-400 truncate min-w-0" title={kpi.label}>
                  {kpi.label}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 whitespace-nowrap max-w-[90px] truncate ${
                    kpi.highlight && kpi.highlightType === "danger"
                      ? "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300"
                      : kpi.highlight && kpi.highlightType === "warning"
                      ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
                      : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085] dark:text-slate-300 border border-[#E6E9EF] dark:border-slate-700"
                  }`}
                  title={kpi.badge}
                >
                  {kpi.badge}
                </span>
              </div>

              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-[#172033] dark:text-white font-mono tracking-tight truncate min-w-0">
                  {kpi.value}
                </p>
                <p className={`text-[11px] mt-1 truncate min-h-[1.125rem] min-w-0 ${kpi.metaColor}`} title={kpi.meta}>
                  {kpi.meta}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
