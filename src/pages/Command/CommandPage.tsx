import { previewStorage } from "../../integration/previewStorage";
import React, { useState, useMemo, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Check,
  ChevronRight,
  ExternalLink,
  Globe,
  X,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  Scale
} from "lucide-react";
import {
  getCalculatedCommandProjects,
  CommandProject
} from "../../data/commandData";
import { ProjectService, ProjectRecord } from "../../services/projectService";
import { ActionsService, ProjectAction } from "../../services/actionsService";
import {
  HealthWeightsConfig,
  HEALTH_WEIGHT_PRESETS,
  loadStoredHealthWeights,
  saveStoredHealthWeights,
  resetStoredHealthWeights
} from "../../services/projectHealthEngine";
import { getAllRegionConfigs } from "../../config/countries";
import { getRegionalPack, RegionalPack } from "../../config/regionalPacks";
import { SUPPORTED_CURRENCIES, SupportedCurrency, getCurrencyInfo } from "../../config/currencies";
import { formatCompactCurrency, formatCurrency, getCurrencyHoverTitle, exchangeRateService, convertCurrency } from "../../utils/currency";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  buildPortfolioHealth,
  buildCriticalActions,
  buildFinancialExposure,
  buildProgrammeExposure,
  buildForecasts,
  CriticalActionRow,
  FinancialExposureRow,
  ProgrammeExposureRow,
  ForecastRow
} from "./executiveDecisionData";
import { queryRealtimeCommercialExposure } from "../../services/financialExposureEngine";

interface DecisionModalData {
  companyName: string;
  projectName: string;
  projectCode: string;
  projectId: string;
  problem: string;
  rootCause: string;
  impact: string;
  impactAmountUSD?: number | null;
  delayDays?: number | null;
  contractValueUSD?: number | null;
  currencyCode?: string;
  owner: string;
  ownerRole?: string;
  decisionRequired: string;
  due?: string;
  discipline?: string;
  underlyingRecordType: string;
  underlyingRecordPath: string;
  rawActionId?: string;
  status?: string;
}

export default function CommandPage() {
  const navigate = useNavigate();
  const outletContext = useOutletContext<any>() || {};
  const { onProjectChange, activeProject, activeCompany } = outletContext;
  const { t } = useLanguage();
  const { 
    countryCode: adminCountryCode, 
    currencyCode: adminCurrencyCode, 
    setCountryCode: setGlobalCountryCode, 
    setCurrencyCode: setGlobalCurrencyCode,
    exchangeRateState,
    refreshExchangeRates
  } = useRegionalSettings();

  // Regional Pack & Currency selection for global multi-currency executive view
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(() => {
    return adminCountryCode || activeCompany?.countryCode || "TZ";
  });

  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(() => {
    const pack = getRegionalPack(adminCountryCode || activeCompany?.countryCode || "TZ");
    return (adminCurrencyCode || pack.currencyCode || "TZS") as SupportedCurrency;
  });

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>("Live Telemetry • Just Now");

  // Keep CommandPage in sync when global administration settings change
  useEffect(() => {
    if (adminCountryCode) {
      setSelectedCountryCode(adminCountryCode);
      const pack = getRegionalPack(adminCountryCode);
      setSelectedCurrency(pack.currencyCode || adminCurrencyCode || "TZS");
    } else if (adminCurrencyCode) {
      setSelectedCurrency(adminCurrencyCode);
    }
  }, [adminCountryCode, adminCurrencyCode]);

  // Real Database Persistence State
  const [companyProjects, setCompanyProjects] = useState<ProjectRecord[]>(() => {
    if (activeCompany?.id) {
      const stored = ProjectService.getStoredProjects(activeCompany.id);
      if (stored && stored.length > 0) return stored;
    }
    if (outletContext?.allProjects && Array.isArray(outletContext.allProjects) && outletContext.allProjects.length > 0) {
      return outletContext.allProjects;
    }
    return ProjectService.getStoredProjects();
  });
  const [companyActions, setCompanyActions] = useState<ProjectAction[]>([]);
  const [loadingCompanyData, setLoadingCompanyData] = useState<boolean>(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [commercialDataVersion, setCommercialDataVersion] = useState<number>(0);

  // Live listener for commercial updates across tabs and modules
  useEffect(() => {
    const handleDataUpdate = () => {
      setCommercialDataVersion((v) => v + 1);
    };
    window.addEventListener("pm_commercial_data_updated", handleDataUpdate);
    window.addEventListener("storage", handleDataUpdate);
    return () => {
      window.removeEventListener("pm_commercial_data_updated", handleDataUpdate);
      window.removeEventListener("storage", handleDataUpdate);
    };
  }, []);

  // Modals & Interactivity State
  const [activeDecisionModal, setActiveDecisionModal] = useState<DecisionModalData | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [resolvedActionIds, setResolvedActionIds] = useState<string[]>([]);
  const [isExecutingAction, setIsExecutingAction] = useState<string | null>(null);

  // Health Scoring Engine Config Modal (kept accessible for governance adjustments)
  const [healthWeights, setHealthWeights] = useState<HealthWeightsConfig>(() => loadStoredHealthWeights());
  const [isHealthEngineModalOpen, setIsHealthEngineModalOpen] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string>("standard-epc");

  // Load live data
  useEffect(() => {
    let isMounted = true;
    if (activeCompany?.id) {
      setLoadingCompanyData(true);
      Promise.all([
        ProjectService.fetchProjects(activeCompany.id),
        ActionsService.getActions(activeCompany.id)
      ]).then(([projs, acts]) => {
        if (isMounted) {
          if (projs && projs.length > 0) {
            setCompanyProjects(projs);
          }
          setCompanyActions(acts || []);
          setLoadingCompanyData(false);
        }
      }).catch(err => {
        console.error("Failed to load company projects/actions for executive decision centre:", err);
        if (isMounted) setLoadingCompanyData(false);
      });
    } else {
      if (outletContext?.allProjects && Array.isArray(outletContext.allProjects) && outletContext.allProjects.length > 0) {
        setCompanyProjects(outletContext.allProjects);
      }
      setCompanyActions([]);
      setLoadingCompanyData(false);
    }
    return () => {
      isMounted = false;
    };
  }, [activeCompany?.id, isRefreshing]);

  // Robust fallback to ensure live projects are always available
  const effectiveCompanyProjects: ProjectRecord[] = useMemo(() => {
    if (companyProjects.length > 0) return companyProjects;
    if (activeCompany?.id) {
      const stored = ProjectService.getStoredProjects(activeCompany.id);
      if (stored && stored.length > 0) return stored;
    }
    if (outletContext?.allProjects && Array.isArray(outletContext.allProjects) && outletContext.allProjects.length > 0) {
      const matching = outletContext.allProjects.filter((p: any) => 
        !activeCompany?.id || p.company_id === activeCompany.id || p.organisation_id === activeCompany.id
      );
      if (matching.length > 0) return matching;
      return outletContext.allProjects;
    }
    const anyStored = ProjectService.getStoredProjects();
    if (anyStored && anyStored.length > 0) return anyStored;
    return [];
  }, [companyProjects, activeCompany?.id, outletContext?.allProjects]);

  // Dynamically calculate projects telemetry
  const calculatedProjects: CommandProject[] = useMemo(() => {
    return getCalculatedCommandProjects(healthWeights, effectiveCompanyProjects);
  }, [healthWeights, effectiveCompanyProjects]);

  // Filter projects by search query
  const filteredCalculatedProjects = useMemo(() => {
    if (!searchQuery.trim()) return calculatedProjects;
    const q = searchQuery.toLowerCase();
    return calculatedProjects.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q)
    );
  }, [calculatedProjects, searchQuery]);

  // 1. PORTFOLIO HEALTH (Compact 5 Metrics)
  const portfolioHealth = useMemo(() => {
    return buildPortfolioHealth(calculatedProjects, selectedCurrency);
  }, [calculatedProjects, selectedCurrency]);

  // 2. CRITICAL ACTIONS (Main Section)
  const criticalActions = useMemo(() => {
    const list = buildCriticalActions(
      calculatedProjects,
      companyActions,
      activeCompany?.name || "Enterprise Portfolio",
      activeCompany?.id || "default"
    );
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(a => 
      a.projectName.toLowerCase().includes(q) ||
      a.projectCode.toLowerCase().includes(q) ||
      a.problem.toLowerCase().includes(q) ||
      a.owner.toLowerCase().includes(q) ||
      a.discipline.toLowerCase().includes(q)
    );
  }, [calculatedProjects, companyActions, activeCompany?.name, activeCompany?.id, searchQuery]);

  // 3. FINANCIAL EXPOSURE - Real-time Recalculation Engine
  const [rawFinancialExposures, setRawFinancialExposures] = useState<FinancialExposureRow[]>(() => {
    return buildFinancialExposure(calculatedProjects, activeCompany?.id || "all");
  });
  const [isRecalculatingFinancials, setIsRecalculatingFinancials] = useState<boolean>(false);
  const [lastFinancialRecalculatedAt, setLastFinancialRecalculatedAt] = useState<Date | null>(null);
  const [financialRecalculationStats, setFinancialRecalculationStats] = useState<{
    totalProjects: number;
    totalRecordsQueried: number;
    durationMs: number;
    isDatabaseLive: boolean;
  } | null>(null);

  const isRecalculatingRef = React.useRef(false);

  const triggerFinancialRecalculation = React.useCallback(async (force = false) => {
    if (isRecalculatingRef.current && !force) return;
    isRecalculatingRef.current = true;
    setIsRecalculatingFinancials(true);

    try {
      const activeProjectsToQuery = effectiveCompanyProjects.length > 0 
        ? effectiveCompanyProjects 
        : calculatedProjects;
      
      if (activeProjectsToQuery.length > 0) {
        const result = await queryRealtimeCommercialExposure(
          activeProjectsToQuery,
          activeCompany?.id || "all"
        );
        setRawFinancialExposures(result.rows);
        setLastFinancialRecalculatedAt(result.recalculatedAt);
        setFinancialRecalculationStats({
          totalProjects: result.totalProjectsQueried,
          totalRecordsQueried: result.totalRecordsQueried,
          durationMs: result.queryDurationMs,
          isDatabaseLive: result.isDatabaseLive,
        });
      } else {
        const fallback = buildFinancialExposure(calculatedProjects, activeCompany?.id || "all");
        setRawFinancialExposures(fallback);
      }
    } catch (err) {
      console.error("Financial Exposure real-time recalculation error:", err);
    } finally {
      setIsRecalculatingFinancials(false);
      isRecalculatingRef.current = false;
    }
  }, [effectiveCompanyProjects, calculatedProjects, activeCompany?.id]);

  // Trigger recalculation on mount and when project dependencies or commercial data version updates
  useEffect(() => {
    triggerFinancialRecalculation();
  }, [triggerFinancialRecalculation, commercialDataVersion]);

  // Real-time event listener for commercial database records and project updates
  useEffect(() => {
    const handleCommercialDataEvent = () => {
      triggerFinancialRecalculation(true);
    };
    const handleProjectEvent = () => {
      triggerFinancialRecalculation(true);
    };

    window.addEventListener("pm_commercial_data_updated", handleCommercialDataEvent);
    window.addEventListener("pm_project_updated", handleProjectEvent);
    window.addEventListener("storage", handleCommercialDataEvent);

    return () => {
      window.removeEventListener("pm_commercial_data_updated", handleCommercialDataEvent);
      window.removeEventListener("pm_project_updated", handleProjectEvent);
      window.removeEventListener("storage", handleCommercialDataEvent);
    };
  }, [triggerFinancialRecalculation]);

  // Filtered Financial Exposures matching search query
  const financialExposures = useMemo(() => {
    if (!searchQuery.trim()) return rawFinancialExposures;
    const q = searchQuery.toLowerCase();
    return rawFinancialExposures.filter((fin) =>
      fin.projectName.toLowerCase().includes(q) ||
      fin.projectCode.toLowerCase().includes(q) ||
      (fin.exposureExplanation && fin.exposureExplanation.toLowerCase().includes(q))
    );
  }, [rawFinancialExposures, searchQuery]);

  // 4. PROGRAMME EXPOSURE
  const programmeExposures = useMemo(() => {
    const list = buildProgrammeExposure(filteredCalculatedProjects);
    return list;
  }, [filteredCalculatedProjects]);

  // 5. FORECAST
  const forecastList = useMemo(() => {
    const list = buildForecasts(filteredCalculatedProjects);
    return list;
  }, [filteredCalculatedProjects]);

  // Format currency helper applying selectedCurrency
  const formatMoney = (
    valueUSD: number | null | undefined,
    compact: boolean = false,
    fromCurrency: string = "USD"
  ): string => {
    if (valueUSD === null || valueUSD === undefined || isNaN(valueUSD) || valueUSD === 0) {
      return "—";
    }
    const valInSelected = fromCurrency === selectedCurrency
      ? valueUSD
      : convertCurrency(valueUSD, fromCurrency, selectedCurrency);
    if (valInSelected === null || isNaN(valInSelected) || valInSelected === 0) {
      return "—";
    }
    return compact
      ? formatCompactCurrency(valInSelected, selectedCurrency)
      : formatCurrency(valInSelected, selectedCurrency);
  };

  const handleRegionChange = (newCountryCode: string) => {
    setSelectedCountryCode(newCountryCode);
    const pack = getRegionalPack(newCountryCode);
    setSelectedCurrency(pack.currencyCode);
    setGlobalCountryCode(newCountryCode, true);
    setGlobalCurrencyCode(pack.currencyCode);
    setActionSuccessMsg(`Region: ${pack.countryName} • Currency: ${pack.currencyCode} (${pack.currencySymbol})`);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleCurrencyChange = (newCurrency: SupportedCurrency) => {
    setSelectedCurrency(newCurrency);
    setGlobalCurrencyCode(newCurrency);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    triggerFinancialRecalculation(true);
    setTimeout(() => {
      const now = new Date();
      setLastRefreshedTime(`Live Telemetry • ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
      setIsRefreshing(false);
    }, 450);
  };

  // Set active project in ERP and navigate
  const handleNavigateToRecord = (projectId: string, path: string) => {
    const proj = companyProjects.find(p => p.id === projectId) ||
                 calculatedProjects.find(p => p.id === projectId);
    if (proj && onProjectChange) {
      onProjectChange({
        id: proj.id,
        name: proj.name,
        code: proj.code,
        country: (proj as any).country || (proj as any).countryCode || "ZA",
        status: (proj as any).status || "active"
      });
    }
    previewStorage.setItem("pm_active_project_id", projectId);
    setActiveDecisionModal(null);
    navigate(path);
  };

  // Handle Action Resolution
  const handleAuthorizeAction = async (action: CriticalActionRow) => {
    setIsExecutingAction(action.id);
    try {
      if (action.rawActionId && companyActions.some(a => a.id === action.rawActionId)) {
        await ActionsService.authorizeAction(action.rawActionId, "Executive Decision Centre Sign-Off");
        setCompanyActions(prev => prev.map(a => a.id === action.rawActionId ? { ...a, status: "COMPLETED" } : a));
      }
      setResolvedActionIds(prev => [...prev, action.id]);
      setActionSuccessMsg(`Authorized: Decision logged and dispatched for "${action.projectName}".`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
      if (activeDecisionModal?.rawActionId === action.rawActionId) {
        setActiveDecisionModal(prev => prev ? { ...prev, status: "Authorized" } : null);
      }
    } catch (e) {
      console.error("Failed to authorize action:", e);
    } finally {
      setIsExecutingAction(null);
    }
  };

  // Open Decision Modal from Critical Action
  const openActionModal = (action: CriticalActionRow) => {
    const isResolved = resolvedActionIds.includes(action.id);
    setActiveDecisionModal({
      companyName: action.companyName,
      projectName: action.projectName,
      projectCode: action.projectCode,
      projectId: action.projectId,
      problem: action.problem,
      rootCause: action.rootCause,
      impact: action.impact,
      impactAmountUSD: action.impactAmountUSD,
      delayDays: action.delayDays,
      owner: action.owner,
      ownerRole: action.ownerRole,
      decisionRequired: action.decisionRequired,
      due: action.due,
      discipline: action.discipline,
      underlyingRecordType: action.underlyingRecordType,
      underlyingRecordPath: action.underlyingRecordPath,
      rawActionId: action.rawActionId,
      status: isResolved ? "Authorized" : action.status
    });
  };

  // Open Decision Modal from Financial Exposure
  const openFinancialModal = (fin: FinancialExposureRow) => {
    const proj = calculatedProjects.find(p => p.id === fin.projectId);
    setActiveDecisionModal({
      companyName: activeCompany?.name || "Enterprise Portfolio",
      projectName: fin.projectName,
      projectCode: fin.projectCode,
      projectId: fin.projectId,
      problem: `Financial Exposure on ${fin.projectName}: ${fin.exposureExplanation}`,
      rootCause: fin.costOverrunUSD 
        ? "Cost ledger commitments and posted actual expenditures exceed approved baseline allocation."
        : fin.outstandingCertificationUSD
        ? "Client interim payment certificate submission pending formal valuation and payment release."
        : "Contract variation and margin variance monitoring.",
      impact: fin.forecastMarginExposureUSD
        ? `Margin erosion of ${fin.marginVariancePercent}% (Est. Value: ${formatMoney(fin.forecastMarginExposureUSD)})`
        : fin.outstandingCertificationUSD
        ? `Outstanding cashflow exposure: ${formatMoney(fin.outstandingCertificationUSD)}`
        : "Commercial exposure within active contract boundary",
      impactAmountUSD: fin.forecastMarginExposureUSD || fin.outstandingCertificationUSD || fin.costOverrunUSD,
      contractValueUSD: fin.contractValueUSD,
      currencyCode: fin.currencyCode,
      owner: proj?.projectManager || "Commercial Director",
      ownerRole: "Senior Quantity Surveyor / Commercial Lead",
      decisionRequired: fin.outstandingCertificationUSD 
        ? "Issue formal demand notice to Employer / drawdown bridging facility."
        : fin.costOverrunUSD
        ? "Initiate commercial audit and review revised cost-to-complete forecast."
        : "Review commercial change register and approve variation submissions.",
      due: "Immediate",
      discipline: "Commercial",
      underlyingRecordType: "Commercial & Financial Ledger",
      underlyingRecordPath: fin.underlyingRecordPath || `/commercial/overview?project=${fin.projectId}`
    });
  };

  // Open Decision Modal from Programme Exposure
  const openProgrammeModal = (prog: ProgrammeExposureRow) => {
    const proj = calculatedProjects.find(p => p.id === prog.projectId);
    setActiveDecisionModal({
      companyName: activeCompany?.name || "Enterprise Portfolio",
      projectName: prog.projectName,
      projectCode: prog.projectCode,
      projectId: prog.projectId,
      problem: `Critical Path Delay: ${prog.criticalPathIssue}`,
      rootCause: `Schedule performance velocity SPI of ${prog.spi ?? "—"} with progress at ${prog.progressPercent ?? 0}% vs planned target ${prog.targetPercent ?? 0}%.`,
      impact: prog.delayDays ? `${prog.delayDays} calendar days schedule slippage past contractual milestone` : "Schedule slippage threat",
      delayDays: prog.delayDays,
      owner: proj?.projectManager || "Programme Manager",
      ownerRole: "Lead Planning Engineer",
      decisionRequired: `Review and approve mitigation plan: ${prog.mitigationPlan}`,
      due: "Due in 2d",
      discipline: "Programme",
      underlyingRecordType: "Programme Schedule & S-Curve",
      underlyingRecordPath: prog.underlyingRecordPath
    });
  };

  // Open Decision Modal from Forecast
  const openForecastModal = (fc: ForecastRow) => {
    const proj = calculatedProjects.find(p => p.id === fc.projectId);
    setActiveDecisionModal({
      companyName: activeCompany?.name || "Enterprise Portfolio",
      projectName: fc.projectName,
      projectCode: fc.projectCode,
      projectId: fc.projectId,
      problem: `Project Trajectory: ${fc.trajectory}`,
      rootCause: fc.executiveOutlook,
      impact: fc.forecastFinalCostUSD 
        ? `Forecast final cost of ${formatMoney(fc.forecastFinalCostUSD)} vs contract backlog ${formatMoney(fc.contractValueUSD)}`
        : "Cost & progress trajectory within monitoring limits",
      impactAmountUSD: fc.forecastFinalCostUSD,
      owner: proj?.projectManager || "Project Director",
      ownerRole: "Contract Manager",
      decisionRequired: "Review quarterly cost-to-complete forecast and executive margin guidance.",
      due: "Monthly Executive Review",
      discipline: "Forecast",
      underlyingRecordType: "Forecast & Cost-to-Complete",
      underlyingRecordPath: fc.underlyingRecordPath
    });
  };

  // Preset handler for health weights
  const handleApplyPreset = (presetId: string) => {
    const p = HEALTH_WEIGHT_PRESETS.find((item) => item.id === presetId);
    if (p) {
      setHealthWeights(p.weights);
      setActivePresetId(p.id);
      saveStoredHealthWeights(p.weights);
    }
  };

  return (
    <div id="executive-decision-centre" className="space-y-8 pb-24 max-w-7xl mx-auto animate-fadeIn text-[#0B172A]">
      {/* TOP EXECUTIVE HEADER */}
      <div className="bg-white border border-[#E6E9EF] rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#0B172A] text-white text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F1C]" />
                Executive Decision Centre
              </span>
              <span className="text-xs text-[#667085] font-mono flex items-center gap-1 bg-[#F7F8FA] px-2.5 py-0.5 rounded-md border border-[#E6E9EF]">
                <Clock className="w-3 h-3 text-slate-400" />
                {lastRefreshedTime}
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-[26px] font-bold text-[#0B172A] tracking-tight">
                {activeCompany?.name || "Enterprise"} Decision Control
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Real-time exception governance, financial exposure tracking and management interventions across all active contracts.
              </p>
            </div>
          </div>

          {/* Right Controls: Region, Currency, Health Engine & Refresh */}
          <div className="flex flex-wrap items-center gap-2.5 bg-[#F7F8FA] p-2 rounded-xl border border-[#E6E9EF]">
            {/* Search Bar */}
            <div className="relative w-48 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF9F1C]"
              />
            </div>

            {/* Region Switcher */}
            <div className="flex items-center gap-1">
              <select
                value={selectedCountryCode}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#FF9F1C] cursor-pointer shadow-2xs max-w-[140px] sm:max-w-[180px] truncate"
                title="Select Regional Pack"
              >
                {getAllRegionConfigs().map((rc) => (
                  <option key={rc.countryCode} value={rc.countryCode}>
                    {rc.flagEmoji || "🌐"} {rc.countryName}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Switcher */}
            <div className="flex items-center gap-1">
              <select
                value={selectedCurrency}
                onChange={(e) => handleCurrencyChange(e.target.value as SupportedCurrency)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#FF9F1C] cursor-pointer shadow-2xs max-w-[130px] sm:max-w-[150px] truncate"
                title="Select Reporting Currency"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Health Engine Weights Config Trigger */}
            <button
              onClick={() => setIsHealthEngineModalOpen(true)}
              className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Health Scoring Weights"
            >
              <Scale className="w-4 h-4 text-slate-600" />
            </button>

            {/* Refresh */}
            <button
              onClick={() => {
                refreshExchangeRates();
                handleRefresh();
              }}
              disabled={isRefreshing}
              className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#FF9F1C]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Action toast feedback */}
        {actionSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 1. PORTFOLIO HEALTH (Compact KPI Cards Only) */}
      <section aria-labelledby="portfolio-health-heading">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 id="portfolio-health-heading" className="text-xs font-bold text-[#667085] uppercase tracking-wider">
            Portfolio Health
          </h2>
          <span className="text-xs text-[#667085]">
            Reporting Currency: <strong className="text-[#0B172A]">{selectedCurrency}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Total Projects */}
          <div className="bg-white border border-[#E6E9EF] rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Projects</span>
            <div className="text-2xl sm:text-3xl font-bold text-[#0B172A] tabular-nums my-1">
              {portfolioHealth.totalProjects}
            </div>
            <span className="text-[11px] text-slate-500 truncate">
              {activeCompany?.name || "Active Enterprise"}
            </span>
          </div>

          {/* Card 2: On Track */}
          <div className="bg-white border border-[#E6E9EF] rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-emerald-700">On Track</span>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-600 tabular-nums my-1">
              {portfolioHealth.onTrackCount}
            </div>
            <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Within Tolerance
            </span>
          </div>

          {/* Card 3: At Risk */}
          <div className="bg-white border border-[#E6E9EF] rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-amber-700">At Risk</span>
            <div className="text-2xl sm:text-3xl font-bold text-amber-600 tabular-nums my-1">
              {portfolioHealth.atRiskCount}
            </div>
            <span className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Monitoring
            </span>
          </div>

          {/* Card 4: Critical */}
          <div className="bg-white border border-[#E6E9EF] rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-red-600">Critical</span>
            <div className="text-2xl sm:text-3xl font-bold text-red-600 tabular-nums my-1">
              {portfolioHealth.criticalCount}
            </div>
            <span className="text-[11px] text-red-600 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
              Requires Decision
            </span>
          </div>

          {/* Card 5: Portfolio Value */}
          <div className="bg-white border border-[#E6E9EF] rounded-xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-slate-500">Portfolio Value</span>
            <div 
              className="text-xl sm:text-2xl font-bold text-[#0B172A] tabular-nums my-1 truncate" 
              title={portfolioHealth.portfolioValue !== null && portfolioHealth.portfolioValue !== undefined 
                ? formatCurrency(portfolioHealth.portfolioValue, selectedCurrency) 
                : undefined}
            >
              {portfolioHealth.portfolioValue !== null && portfolioHealth.portfolioValue !== undefined 
                ? formatCompactCurrency(portfolioHealth.portfolioValue, selectedCurrency) 
                : "—"}
            </div>
            <span className="text-[11px] text-slate-500 truncate">
              Contract Backlog ({selectedCurrency})
            </span>
          </div>
        </div>
      </section>

      {/* 2. CRITICAL ACTIONS (MAIN SECTION) */}
      <section aria-labelledby="critical-actions-heading" className="bg-white border border-[#E6E9EF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="critical-actions-heading" className="text-base sm:text-lg font-bold text-[#0B172A] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                Critical Actions
              </h2>
              <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs font-bold rounded-md border border-red-200">
                {criticalActions.filter(a => !resolvedActionIds.includes(a.id)).length} Requiring Decision
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Management exceptions aggregated from Programme, Commercial, Engineering, Contracts, Procurement, Site Operations, and HSEQ.
            </p>
          </div>
        </div>

        {/* Clean Table: Project | Problem | Impact | Owner | Decision Required | Due */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F7F8FA] text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 min-w-[180px]">Project</th>
                <th className="py-3.5 px-4 min-w-[240px]">Problem</th>
                <th className="py-3.5 px-3 min-w-[160px]">Impact</th>
                <th className="py-3.5 px-3 min-w-[140px]">Owner</th>
                <th className="py-3.5 px-4 min-w-[220px]">Decision Required</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Due</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {criticalActions.map((action) => {
                const isResolved = resolvedActionIds.includes(action.id);
                const isProcessing = isExecutingAction === action.id;

                return (
                  <tr
                    key={action.id}
                    onClick={() => openActionModal(action)}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      isResolved ? "bg-slate-50/40 opacity-60" : ""
                    }`}
                  >
                    {/* Project */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="truncate max-w-[180px]" title={action.projectName}>
                          {action.projectName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {action.projectCode}
                      </div>
                    </td>

                    {/* Problem */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 mt-0.5 ${
                          action.discipline === "Contracts" ? "bg-purple-100 text-purple-800" :
                          action.discipline === "Commercial" ? "bg-blue-100 text-blue-800" :
                          action.discipline === "Programme" ? "bg-amber-100 text-amber-800" :
                          action.discipline === "Procurement" ? "bg-emerald-100 text-emerald-800" :
                          action.discipline === "Engineering" ? "bg-cyan-100 text-cyan-800" :
                          action.discipline === "Site Operations" ? "bg-orange-100 text-orange-800" :
                          "bg-rose-100 text-rose-800"
                        }`}>
                          {action.discipline}
                        </span>
                        <span className="font-medium text-slate-900 leading-snug line-clamp-2" title={action.problem}>
                          {action.problem}
                        </span>
                      </div>
                    </td>

                    {/* Impact */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-900 leading-snug">
                        {action.impactAmountUSD ? (
                          <span className="text-red-600 block">
                            {formatMoney(action.impactAmountUSD)} exposure
                          </span>
                        ) : null}
                        <span className="text-slate-700 text-[11px] block">
                          {action.impact}
                        </span>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{action.owner}</div>
                      <div className="text-[11px] text-slate-500">{action.ownerRole}</div>
                    </td>

                    {/* Decision Required */}
                    <td className="py-3.5 px-4">
                      <p className="text-xs text-slate-800 leading-relaxed font-medium line-clamp-2" title={action.decisionRequired}>
                        {action.decisionRequired}
                      </p>
                    </td>

                    {/* Due */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {isResolved ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                          Authorized
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          action.severity === "critical"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {action.due}
                        </span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isResolved ? (
                        <span className="text-emerald-700 text-xs font-semibold inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Signed
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAuthorizeAction(action)}
                            disabled={isProcessing}
                            className="px-2.5 py-1 bg-[#0B172A] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Authorize this executive decision"
                          >
                            {isProcessing ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-[#FF9F1C]" />
                            ) : (
                              <Check className="w-3 h-3 text-[#FF9F1C]" />
                            )}
                            <span>Sign Off</span>
                          </button>
                          <button
                            onClick={() => openActionModal(action)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                            title="Drill down into Company → Project → Problem → Underlying Record"
                          >
                            Review
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {criticalActions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                    <span className="font-semibold text-slate-800 block">All Management Intervention Gates Clear</span>
                    <span className="text-xs text-slate-500">
                      No active critical issues requiring executive authorization across Programme, Commercial, Engineering, Contracts, Procurement, Site, or HSEQ.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. FINANCIAL EXPOSURE */}
      <section id="financial-exposure-table" aria-labelledby="financial-exposure-heading" className="bg-white border border-[#E6E9EF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 id="financial-exposure-heading" className="text-base sm:text-lg font-bold text-[#0B172A]">
                Financial Exposure
              </h2>

              {/* Real-time Recalculation Engine Telemetry Badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  isRecalculatingFinancials
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
                title={
                  financialRecalculationStats
                    ? `Queried ${financialRecalculationStats.totalRecordsQueried} commercial records across ${financialRecalculationStats.totalProjects} active projects in ${financialRecalculationStats.durationMs}ms`
                    : "Real-time recalculation engine actively syncing commercial database"
                }
              >
                {isRecalculatingFinancials ? (
                  <>
                    <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
                    <span>Recalculating Database...</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span>Real-time Engine Active</span>
                    {financialRecalculationStats && (
                      <span className="text-[10px] text-emerald-700/80 font-mono">
                        ({financialRecalculationStats.totalRecordsQueried} records • {financialRecalculationStats.totalProjects} projects)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Dynamically aggregated from project Commercial records: Client Accounts, Budget & Forecast, Actual Costs, Commitments, and Cashflow.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            {lastFinancialRecalculatedAt && (
              <span className="text-[11px] text-slate-500 hidden sm:inline-block">
                Recalculated {lastFinancialRecalculatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}

            <button
              type="button"
              onClick={() => triggerFinancialRecalculation(true)}
              disabled={isRecalculatingFinancials}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs cursor-pointer ${
                isRecalculatingFinancials
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900 active:scale-95"
              }`}
              title="Trigger real-time recalculation query across commercial database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculatingFinancials ? "animate-spin text-amber-600" : "text-slate-600"}`} />
              <span>{isRecalculatingFinancials ? "Querying Database..." : "Recalculate"}</span>
            </button>

            <span className="text-xs text-slate-500 pl-1 border-l border-slate-200">
              All values in <strong className="text-slate-900">{selectedCurrency}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F7F8FA] text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 min-w-[180px]">Project</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Project Value</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Outstanding Payments</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Cost Overruns</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Variations / Claims</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">30d Cashflow Risk</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Forecast Margin Exposure</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {financialExposures.map((fin) => (
                <tr
                  key={fin.id}
                  onClick={() => openFinancialModal(fin)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  {/* Project */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 truncate max-w-[180px]" title={fin.projectName}>
                      {fin.projectName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {fin.projectCode}
                    </div>
                  </td>

                  {/* Project Value */}
                  <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {fin.contractValueUSD ? (
                      <button
                        type="button"
                        onClick={() => handleNavigateToRecord(fin.projectId, `/commercial/overview?project=${fin.projectId}`)}
                        className="inline-flex items-center gap-1.5 font-bold text-slate-900 hover:text-amber-600 hover:underline cursor-pointer group"
                        title={`View Commercial Overview & Contract Value for ${fin.projectName} (${formatMoney(fin.contractValueUSD, false, fin.currencyCode)})`}
                      >
                        <span>{formatMoney(fin.contractValueUSD, false, fin.currencyCode)}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-amber-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Outstanding Payments */}
                  <td className="py-3.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {fin.outstandingCertificationUSD ? (
                      <button
                        type="button"
                        onClick={() => handleNavigateToRecord(fin.projectId, `/commercial/client-accounts?project=${fin.projectId}`)}
                        className="inline-flex items-center gap-1.5 font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer group"
                        title={`View Client Accounts & Certificates for ${fin.projectName} (${formatMoney(fin.outstandingCertificationUSD, false, fin.currencyCode)})`}
                      >
                        <span>{formatMoney(fin.outstandingCertificationUSD, false, fin.currencyCode)}</span>
                        <ExternalLink className="w-3 h-3 text-amber-600/60 group-hover:text-amber-800 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Cost Overruns */}
                  <td className="py-3.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {fin.costOverrunUSD ? (
                      <button
                        type="button"
                        onClick={() => handleNavigateToRecord(fin.projectId, `/commercial/actual-costs?project=${fin.projectId}`)}
                        className="inline-flex items-center gap-1.5 font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer group"
                        title={`View Actual Costs & Cost Overrun Ledger for ${fin.projectName} (${formatMoney(fin.costOverrunUSD, false, fin.currencyCode)})`}
                      >
                        <span>{formatMoney(fin.costOverrunUSD, false, fin.currencyCode)}</span>
                        <ExternalLink className="w-3 h-3 text-red-500/60 group-hover:text-red-800 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Variations / Claims */}
                  <td className="py-3.5 px-3 text-right font-medium tabular-nums whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {fin.variationsUSD ? (
                      <button
                        type="button"
                        onClick={() => handleNavigateToRecord(fin.projectId, `/commercial/budget-forecast?project=${fin.projectId}`)}
                        className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-amber-600 hover:underline cursor-pointer group"
                        title={`View Variations, Claims & Budget Revisions for ${fin.projectName} (${formatMoney(fin.variationsUSD, false, fin.currencyCode)})`}
                      >
                        <span>{formatMoney(fin.variationsUSD, false, fin.currencyCode)}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-amber-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* 30d Cashflow Risk */}
                  <td className="py-3.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {fin.cashflowRiskUSD ? (
                      <button
                        type="button"
                        onClick={() => handleNavigateToRecord(fin.projectId, `/commercial/cash-bank?project=${fin.projectId}`)}
                        className="inline-flex items-center gap-1.5 font-bold text-slate-900 hover:text-amber-600 hover:underline cursor-pointer group"
                        title={`View Cash & Bank 30-Day Liquidity Forecast for ${fin.projectName} (${formatMoney(fin.cashflowRiskUSD, false, fin.currencyCode)})`}
                      >
                        <span>{formatMoney(fin.cashflowRiskUSD, false, fin.currencyCode)}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-amber-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Forecast Margin Exposure */}
                  <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {fin.forecastMarginExposureUSD ? (
                      <button
                        type="button"
                        onClick={() => handleNavigateToRecord(fin.projectId, `/commercial/budget-forecast?project=${fin.projectId}`)}
                        className="inline-flex flex-col items-end group cursor-pointer text-right hover:underline"
                        title={`View Margin Forecast & Cost to Complete for ${fin.projectName} (${formatMoney(fin.forecastMarginExposureUSD, false, fin.currencyCode)})`}
                      >
                        <span className="inline-flex items-center gap-1.5 text-red-600 font-bold group-hover:text-red-800">
                          <span>{formatMoney(fin.forecastMarginExposureUSD, false, fin.currencyCode)}</span>
                          <ExternalLink className="w-3 h-3 text-red-500/60 group-hover:text-red-800 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-600 block font-mono">
                          -{fin.marginVariancePercent}% gap
                        </span>
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Record Link */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleNavigateToRecord(fin.projectId, fin.underlyingRecordPath)}
                      className="text-xs font-semibold text-[#0B172A] hover:text-[#FF9F1C] flex items-center justify-end gap-1 ml-auto cursor-pointer"
                    >
                      <span>Ledger</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {financialExposures.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No active financial exposure records found for this company portfolio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. PROGRAMME EXPOSURE */}
      <section aria-labelledby="programme-exposure-heading" className="bg-white border border-[#E6E9EF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 id="programme-exposure-heading" className="text-base sm:text-lg font-bold text-[#0B172A]">
              Programme Exposure
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Delayed projects, critical-path activities, schedule slippage days and projected milestone completion dates.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F7F8FA] text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 min-w-[180px]">Project</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Schedule Status</th>
                <th className="py-3.5 px-4 min-w-[220px]">Critical-Path Issue</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Delay Days</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">SPI Velocity</th>
                <th className="py-3.5 px-3 text-center min-w-[140px]">Planned vs Actual</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Forecast Completion</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {programmeExposures.map((prog) => (
                <tr
                  key={prog.id}
                  onClick={() => openProgrammeModal(prog)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  {/* Project */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 truncate max-w-[180px]" title={prog.projectName}>
                      {prog.projectName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {prog.projectCode}
                    </div>
                  </td>

                  {/* Schedule Status */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      prog.status === "Critical Delay"
                        ? "bg-red-100 text-red-800"
                        : prog.status === "Delayed"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {prog.status}
                    </span>
                  </td>

                  {/* Critical-Path Issue */}
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-slate-900 line-clamp-2" title={prog.criticalPathIssue}>
                      {prog.criticalPathIssue}
                    </p>
                  </td>

                  {/* Delay Days */}
                  <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono">
                    {prog.delayDays ? (
                      <span className="font-bold text-red-600">
                        +{prog.delayDays}d
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* SPI Velocity */}
                  <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono">
                    {prog.spi !== null ? (
                      <span className={`font-bold ${prog.spi < 0.95 ? "text-red-600" : "text-emerald-700"}`}>
                        {prog.spi.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Planned vs Actual */}
                  <td className="py-3.5 px-3 text-center min-w-[140px]">
                    {prog.progressPercent !== null ? (
                      <div className="w-28 mx-auto space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-bold text-slate-800">{prog.progressPercent}%</span>
                          {prog.targetPercent !== null && <span>Tar: {prog.targetPercent}%</span>}
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (prog.targetPercent === null || prog.progressPercent >= prog.targetPercent)
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.min(Math.max(prog.progressPercent, 0), 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Forecast Completion */}
                  <td className="py-3.5 px-3 whitespace-nowrap font-mono text-slate-800">
                    {prog.forecastCompletionDate || "—"}
                  </td>

                  {/* Record Link */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleNavigateToRecord(prog.projectId, prog.underlyingRecordPath)}
                      className="text-xs font-semibold text-[#0B172A] hover:text-[#FF9F1C] flex items-center justify-end gap-1 ml-auto cursor-pointer"
                    >
                      <span>Programme</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {programmeExposures.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No active programme schedules found for this company portfolio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. FORECAST */}
      <section aria-labelledby="forecast-heading" className="bg-white border border-[#E6E9EF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 id="forecast-heading" className="text-base sm:text-lg font-bold text-[#0B172A]">
              Forecast & Project Trajectory
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Forward projection of project outcomes based on physical progress, cost performance and earned value trajectory.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F7F8FA] text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 min-w-[180px]">Project</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Current Trajectory</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Progress vs Target</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Cost Velocity (CPI)</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Forecast Margin</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Tender vs Forecast</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Forecast Final Cost</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Projected Completion</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {forecastList.map((fc) => (
                <tr
                  key={fc.id}
                  onClick={() => openForecastModal(fc)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  {/* Project */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 truncate max-w-[180px]" title={fc.projectName}>
                      {fc.projectName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {fc.projectCode}
                    </div>
                  </td>

                  {/* Current Trajectory */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                      fc.trajectoryColor === "red"
                        ? "bg-red-100 text-red-800"
                        : fc.trajectoryColor === "amber"
                        ? "bg-amber-100 text-amber-800"
                        : fc.trajectoryColor === "emerald"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {fc.trajectory}
                    </span>
                  </td>

                  {/* Progress vs Target */}
                  <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono">
                    {fc.progressPercent !== null ? (
                      <span className="font-semibold text-slate-900">
                        {fc.progressPercent}% <span className="text-slate-400 font-normal">/ {fc.targetPercent ?? "—"}%</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Cost Velocity (CPI) */}
                  <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono">
                    {fc.cpi !== null ? (
                      <div>
                        <span className={`font-bold ${fc.cpi < 0.95 ? "text-red-600" : "text-emerald-700"}`}>
                          {fc.cpi.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{fc.cpiTrend}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Forecast Margin */}
                  <td className="py-3.5 px-3 text-right whitespace-nowrap font-bold tabular-nums text-slate-900">
                    {fc.forecastMarginPercent !== null ? `${fc.forecastMarginPercent}%` : "—"}
                  </td>

                  {/* Tender vs Forecast */}
                  <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums">
                    {fc.marginVariancePercent !== null ? (
                      <span className={fc.marginVariancePercent < 0 ? "text-red-600 font-bold" : "text-emerald-700 font-bold"}>
                        {fc.marginVariancePercent > 0 ? `+${fc.marginVariancePercent}%` : `${fc.marginVariancePercent}%`}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Forecast Final Cost */}
                  <td className="py-3.5 px-3 text-right whitespace-nowrap font-semibold tabular-nums text-slate-900">
                    {fc.forecastFinalCostUSD ? formatMoney(fc.forecastFinalCostUSD, true, fc.currencyCode) : "—"}
                  </td>

                  {/* Projected Completion */}
                  <td className="py-3.5 px-3 whitespace-nowrap font-mono text-slate-800">
                    {fc.projectedCompletionDate || "—"}
                  </td>

                  {/* Record Link */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleNavigateToRecord(fc.projectId, fc.underlyingRecordPath)}
                      className="text-xs font-semibold text-[#0B172A] hover:text-[#FF9F1C] flex items-center justify-end gap-1 ml-auto cursor-pointer"
                    >
                      <span>Forecast</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {forecastList.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No active forecast records found for this company portfolio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. INTERACTIVE EXECUTIVE DECISION DRAWER / MODAL */}
      {activeDecisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Hierarchy Breadcrumb: Company → Project → Problem → Underlying Record */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1 pr-2">
                <div className="text-[11px] font-semibold text-slate-500 flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-900 font-bold">{activeDecisionModal.companyName}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-900 font-bold">{activeDecisionModal.projectName}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] uppercase font-bold">
                    {activeDecisionModal.discipline || "Governance"}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#0B172A] leading-snug">
                  Executive Decision Brief
                </h3>
              </div>
              <button
                onClick={() => setActiveDecisionModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* The 5 Golden Executive Questions */}
            <div className="space-y-4 text-xs">
              {/* 1. What is wrong? */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  1. What is wrong?
                </span>
                <p className="text-sm font-semibold text-[#0B172A] leading-relaxed">
                  {activeDecisionModal.problem}
                </p>
              </div>

              {/* 2. Why? (Root Cause) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  2. Why? (Root Cause Analysis)
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {activeDecisionModal.rootCause}
                </p>
              </div>

              {/* 3. What is the impact? */}
              <div className="p-3.5 bg-red-50/50 rounded-xl border border-red-200 space-y-1">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">
                  3. What is the impact?
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {activeDecisionModal.contractValueUSD ? (
                    <button
                      type="button"
                      onClick={() => handleNavigateToRecord(activeDecisionModal.projectId, `/commercial/overview?project=${activeDecisionModal.projectId}`)}
                      className="text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                      title="Open Project Commercial Record"
                    >
                      <span>Project Value: {formatMoney(activeDecisionModal.contractValueUSD, false, activeDecisionModal.currencyCode)}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500" />
                    </button>
                  ) : null}
                  {activeDecisionModal.impactAmountUSD ? (
                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      Commercial Exposure: {formatMoney(activeDecisionModal.impactAmountUSD)}
                    </span>
                  ) : null}
                  {activeDecisionModal.delayDays ? (
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Critical Delay: +{activeDecisionModal.delayDays} days
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-red-900 font-medium leading-relaxed mt-1">
                  {activeDecisionModal.impact}
                </p>
              </div>

              {/* 4. Who owns it? */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  4. Who owns it?
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{activeDecisionModal.owner}</span>
                  {activeDecisionModal.ownerRole && (
                    <span className="text-slate-500 font-medium">({activeDecisionModal.ownerRole})</span>
                  )}
                  {activeDecisionModal.due && (
                    <span className="ml-auto px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-mono font-bold">
                      {activeDecisionModal.due}
                    </span>
                  )}
                </div>
              </div>

              {/* 5. What decision is required? */}
              <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-300 space-y-1">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  5. What decision is required?
                </span>
                <p className="text-xs text-amber-950 font-semibold leading-relaxed">
                  {activeDecisionModal.decisionRequired}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono">
                Target Record: {activeDecisionModal.underlyingRecordType}
              </span>

              <div className="flex items-center gap-2">
                {/* Advisor Analysis */}
                <button
                  onClick={() => {
                    navigate(`/intelligence/advisor?prompt=${encodeURIComponent(`Provide executive decision guidance for ${activeDecisionModal.projectName}: ${activeDecisionModal.problem}`)}`);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FF9F1C]" />
                  <span>Advisor AI</span>
                </button>

                {/* Direct Link to Underlying Record */}
                <button
                  onClick={() => handleNavigateToRecord(activeDecisionModal.projectId, activeDecisionModal.underlyingRecordPath)}
                  className="px-3.5 py-1.5 bg-[#0B172A] hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>Open {activeDecisionModal.underlyingRecordType}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEALTH SCORING WEIGHTS CONFIGURATION MODAL */}
      {isHealthEngineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Project Health Scoring Weights</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  FIDIC and corporate multi-pillar health engine presets.
                </p>
              </div>
              <button
                onClick={() => setIsHealthEngineModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {HEALTH_WEIGHT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset.id)}
                  className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    activePresetId === preset.id
                      ? "bg-amber-50/80 border-[#FF9F1C] ring-2 ring-[#FF9F1C]/20"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                    {activePresetId === preset.id && <Check className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500">{preset.description}</p>
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsHealthEngineModalOpen(false)}
                className="px-4 py-1.5 bg-[#0B172A] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
