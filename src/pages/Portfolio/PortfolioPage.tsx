import { previewStorage } from "../../integration/previewStorage";
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Globe,
  Building2,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  MapPin,
  FileText,
  CreditCard,
  PieChart,
  BarChart3,
  Activity,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  HelpCircle,
  Briefcase,
  AlertCircle,
  Compass
} from "lucide-react";
import { ProjectService, ProjectRecord } from "../../services/projectService";
import { ActionsService, ProjectAction } from "../../services/actionsService";
import GlobalInfrastructureMap from "../../components/dashboard/GlobalInfrastructureMap";
import PortfolioAnalyticsGraphs from "../../components/dashboard/PortfolioAnalyticsGraphs";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { SUPPORTED_CURRENCIES, SupportedCurrency } from "../../config/currencies";
import { formatCompactCurrency, formatCurrency, convertCurrency, getCurrencyHoverTitle, exchangeRateService } from "../../utils/currency";
import { 
  getProjectRealContractValue, 
  getProjectRealProgress, 
  getProjectRealMilestones 
} from "../../utils/projectDataUtils";
import { 
  buildFinancialExposure, 
  FinancialExposureRow 
} from "../Command/executiveDecisionData";
import { queryRealtimeCommercialExposure } from "../../services/financialExposureEngine";

export interface ProjectItem {
  id: string;
  name: string;
  code: string;
  sector: string;
  client: string;
  contractValue: number;
  originalContractValue: number;
  originalCurrency: string;
  localValue: string;
  progressPercent: number;
  targetPercent: number;
  spi: number;
  cpi: number;
  status: "Immediate Intervention" | "Critical Path Monitor" | "On Track";
  criticalActivity: string;
  contractType: string;
  activeRisksCount: number;
  capitalAtRisk: number;
  latestMilestone: string;
  projectManager: string;
  hubCity: string;
  countryCode: string;
  hubId: string;
}

export interface DecisionItem {
  id: string;
  projectId: string;
  projectName: string;
  countryCode: string;
  title: string;
  type: string;
  severity: "critical" | "high" | "medium";
  deadlineDays: number;
  financialImpactUSD: number;
  frameworkClause: string;
  recommendedResolution: string;
  status: "Resolved" | "Pending Executive Action" | "In Review";
}

/**
 * Retrieve project records safely from previewStorage
 */
function getStoredProjectRecords<T>(prefix: string, projectId: string, companyId?: string): T[] {
  const results: T[] = [];
  const visitedKeys = new Set<string>();

  const candidateKeys = [
    companyId && companyId !== "all" ? `${prefix}_${companyId}_${projectId}` : null,
    `${prefix}_default_company_${projectId}`,
    `${prefix}_all_${projectId}`,
    `${prefix}_default_${projectId}`,
    `${prefix}_${projectId}`
  ].filter(Boolean) as string[];

  for (const k of candidateKeys) {
    if (visitedKeys.has(k)) continue;
    visitedKeys.add(k);
    try {
      const raw = previewStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) results.push(...parsed);
      }
    } catch {
      // ignore
    }
  }

  try {
    const targetSuffix = `_${projectId}`;
    if (typeof previewStorage !== "undefined") {
      for (let i = 0; i < previewStorage.length; i++) {
        const key = previewStorage.key(i);
        if (key && key.startsWith(prefix) && key.endsWith(targetSuffix) && !visitedKeys.has(key)) {
          visitedKeys.add(key);
          const raw = previewStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) results.push(...parsed);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return results;
}

function parseNumericValue(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export default function PortfolioPage() {
  const navigate = useNavigate();
  const outletContext = useOutletContext<any>() || {};
  const { onProjectChange, activeProject, activeCompany } = outletContext;

  // Global Regional Settings & Currency (linked with Command Centre & app)
  const { currencyCode, currencySymbol, formatCompactCurrency: regionalFormatCompactCurrency, setCurrencyCode, exchangeRateState, refreshExchangeRates } = useRegionalSettings();
  const activeCurrency: SupportedCurrency = (currencyCode || "TZS") as SupportedCurrency;

  // Global Hub Selection for the map & deep-dive
  const [selectedHubId, setSelectedHubId] = useState<string>("ALL");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>("Live Telemetry • Just Now");

  // Filter & Search states for the Master Project Table
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>("");
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>("ALL");
  const [selectedHubFilter, setSelectedHubFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  // Real Database Persistence State
  const [companyProjects, setCompanyProjects] = useState<ProjectRecord[]>([]);
  const [companyActions, setCompanyActions] = useState<ProjectAction[]>([]);
  const [loadingCompanyData, setLoadingCompanyData] = useState<boolean>(true);
  const [financialExposures, setFinancialExposures] = useState<FinancialExposureRow[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoadingCompanyData(true);
      try {
        let projs: ProjectRecord[] = [];
        let acts: ProjectAction[] = [];

        if (activeCompany?.id) {
          [projs, acts] = await Promise.all([
            ProjectService.fetchProjects(activeCompany.id),
            ActionsService.getActions(activeCompany.id)
          ]);
        }

        // Fallback to stored projects if fetch returns empty
        if (!projs || projs.length === 0) {
          projs = ProjectService.getStoredProjects(activeCompany?.id);
        }
        if (!projs || projs.length === 0) {
          projs = ProjectService.getStoredProjects();
        }
        if ((!projs || projs.length === 0) && outletContext?.allProjects && Array.isArray(outletContext.allProjects)) {
          projs = outletContext.allProjects;
        }

        if (isMounted) {
          setCompanyProjects(projs || []);
          setCompanyActions(acts || []);
          setLoadingCompanyData(false);
        }
      } catch (err) {
        console.error("Failed to load company projects/actions for portfolio:", err);
        if (isMounted) {
          const fallbackProjs = ProjectService.getStoredProjects(activeCompany?.id) || ProjectService.getStoredProjects() || [];
          setCompanyProjects(fallbackProjs);
          setLoadingCompanyData(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeCompany?.id, isRefreshing, outletContext?.allProjects]);

  // Selected Project for Inspection Modal
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<ProjectItem | null>(null);
  const [selectedDecisionForAction, setSelectedDecisionForAction] = useState<DecisionItem | null>(null);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);

  // Effective projects array
  const effectiveProjects = useMemo(() => {
    if (companyProjects.length > 0) return companyProjects;
    if (activeCompany?.id) {
      const stored = ProjectService.getStoredProjects(activeCompany.id);
      if (stored && stored.length > 0) return stored;
    }
    const anyStored = ProjectService.getStoredProjects();
    if (anyStored && anyStored.length > 0) return anyStored;
    if (outletContext?.allProjects && Array.isArray(outletContext.allProjects) && outletContext.allProjects.length > 0) {
      return outletContext.allProjects;
    }
    return [];
  }, [companyProjects, activeCompany?.id, outletContext?.allProjects]);

  // Dynamic projects derived purely from real company projects
  const allProjects: ProjectItem[] = useMemo(() => {
    if (effectiveProjects.length > 0) {
      return effectiveProjects.map((p) => {
        const contractVal = getProjectRealContractValue(p, activeCompany?.id);
        const origCurrency = p.currency_code || p.currency || (p.award_value_zar ? "ZAR" : p.contract_value_usd ? "USD" : "TZS");
        const convertedContractVal = convertCurrency(contractVal, origCurrency, activeCurrency) || contractVal;
        const progress = getProjectRealProgress(p);
        const spi = typeof p.spi === "number" ? p.spi : (p.spi ? parseFloat(p.spi) : 1.0);
        const cpi = typeof p.cpi === "number" ? p.cpi : (p.cpi ? parseFloat(p.cpi) : 1.0);
        const status = spi < 0.9 ? "Immediate Intervention" : (spi < 0.98 ? "Critical Path Monitor" : "On Track");
        
        // Match real financial exposure from commercial registers or real exposure calculation
        const realExp = financialExposures.find(f => f.projectId === p.id);
        const calcExposure = realExp ? ((realExp.outstandingCertificationUSD || 0) + (realExp.costOverrunUSD || 0) + (realExp.variationsUSD || 0)) : 0;
        const rawRisk = calcExposure > 0 
          ? calcExposure 
          : (typeof p.capitalAtRisk === "number" ? p.capitalAtRisk : (status !== "On Track" ? Math.round(contractVal * 0.12) : 0));
        const capitalAtRisk = convertCurrency(rawRisk, origCurrency, activeCurrency) || rawRisk;

        const hubCity = p.region || p.execution_location || p.location || "Dar es Salaam";
        const hubId = p.hub_id || hubCity.toLowerCase().replace(/\s+/g, "-");

        return {
          id: p.id,
          name: p.name || "Project " + (p.code || p.id),
          code: p.contract_code || p.code || p.contract_number || "PRJ",
          sector: p.sector || "Civil Infrastructure",
          client: p.client_organization || p.client || "Client Authority",
          contractValue: convertedContractVal,
          originalContractValue: contractVal,
          originalCurrency: origCurrency,
          localValue: formatCompactCurrency(contractVal, activeCurrency, origCurrency),
          progressPercent: progress,
          targetPercent: typeof p.target_progress === "number" ? p.target_progress : Math.min(100, Math.round(progress > 0 ? progress * 1.05 : 50)),
          spi,
          cpi,
          status,
          criticalActivity: p.criticalActivity || p.critical_activity || "Critical path execution & compliance gate",
          contractType: p.contract_agreement_option || p.contract_type || "FIDIC Red Book",
          activeRisksCount: p.openCriticalRisksCount ?? p.open_critical_risks ?? (status === "On Track" ? 0 : 2),
          capitalAtRisk,
          latestMilestone: p.latestMilestone || "Substructure concrete pour & QA inspection",
          projectManager: p.projectManager || p.contract_manager || p.project_manager || "Project Lead",
          hubCity,
          countryCode: p.countryCode || p.country_code || (origCurrency === "ZAR" ? "ZA" : origCurrency === "SAR" ? "SA" : origCurrency === "AED" ? "AE" : "TZ"),
          hubId
        };
      });
    }
    return [];
  }, [effectiveProjects, activeCompany?.id, activeCurrency, exchangeRateState, financialExposures]);

  // Synchronize financial exposure asynchronously from commercial data
  useEffect(() => {
    if (allProjects.length > 0) {
      const compId = activeCompany?.id || "default";
      const syncRows = buildFinancialExposure(allProjects as any, compId);
      setFinancialExposures(syncRows);
      queryRealtimeCommercialExposure(allProjects as any, compId).then(res => {
        if (res && res.rows && res.rows.length > 0) {
          setFinancialExposures(res.rows);
        }
      }).catch(err => {
        console.warn("Could not query realtime commercial exposure:", err);
      });
    } else {
      setFinancialExposures([]);
    }
  }, [effectiveProjects, activeCompany?.id]);

  // Dynamic Decisions state derived purely from real Actions
  const dynamicDecisions: DecisionItem[] = useMemo(() => {
    if (companyActions.length > 0) {
      return companyActions.map(a => ({
        id: a.id,
        projectId: a.project_id || "proj-general",
        projectName: allProjects.find(p => p.id === a.project_id)?.name || activeProject?.name || "Company Operations",
        countryCode: "TZ",
        title: a.title,
        type: a.category === "LEGAL_COMMERCIAL" ? "Contractual Notice" :
               a.category === "PROCUREMENT" ? "Procurement Approval" :
               a.category === "TECHNICAL_SITE" ? "Engineering Resolution" :
               a.category === "STAKEHOLDER" ? "Community Liaison" : "Financial Authorization",
        severity: a.priority === "CRITICAL" ? "critical" : a.priority === "HIGH" ? "high" : "medium",
        deadlineDays: 3,
        financialImpactUSD: (a as any).financial_impact_usd || 0,
        frameworkClause: (a as any).fidic_clause || "Standard Governance",
        recommendedResolution: (a as any).resolution_plan || a.description || "Review and approve recommended course of action.",
        status: a.status === "COMPLETED" ? "Resolved" : "Pending Executive Action"
      }));
    }
    return [];
  }, [companyActions, allProjects, activeProject?.name]);

  // 1. Critical Projects (Packages requiring immediate intervention or monitoring)
  const criticalProjects = useMemo(() => {
    return allProjects
      .filter(
        (p) =>
          p.status === "Immediate Intervention" ||
          p.status === "Critical Path Monitor" ||
          p.spi < 0.95 ||
          p.capitalAtRisk > 0
      )
      .sort((a, b) => (b.capitalAtRisk || 0) - (a.capitalAtRisk || 0));
  }, [allProjects]);

  // 2. Pending Decisions
  const pendingDecisions = useMemo(() => {
    return dynamicDecisions.filter((d) => d.status === "Pending Executive Action" || d.status === "In Review");
  }, [dynamicDecisions]);

  // 3. Portfolio Summary Totals
  const portfolioSummary = useMemo(() => {
    const count = allProjects.length;
    if (count === 0) {
      return {
        totalValue: 0,
        totalValueFormatted: "—",
        onPlanPercent: 100,
        capitalAtRisk: 0,
        criticalCount: 0
      };
    }
    const totalValue = allProjects.reduce((sum, p) => sum + (p.contractValue || 0), 0);
    const onPlanCount = allProjects.filter(p => p.status === "On Track").length;
    const onPlanPercent = Math.round((onPlanCount / count) * 100);
    const capitalAtRisk = allProjects.reduce((sum, p) => sum + (p.capitalAtRisk || 0), 0);
    const criticalCount = allProjects.filter(p => p.status === "Immediate Intervention" || p.status === "Critical Path Monitor").length;

    return {
      totalValue,
      totalValueFormatted: totalValue > 0 ? formatCompactCurrency(totalValue, activeCurrency) : "—",
      onPlanPercent,
      capitalAtRisk,
      criticalCount
    };
  }, [allProjects, activeCurrency]);

  // Real Commercial Metrics aggregated from live project commercial registers
  const realCommercialMetrics = useMemo(() => {
    let uncertifiedTotal = 0;
    let uncertifiedCount = 0;
    let retentionTotal = 0;
    let claimsTotal = 0;
    let claimsCount = 0;

    const compId = activeCompany?.id || "default";

    allProjects.forEach(p => {
      // 1. Client certificates from storage
      const certs = getStoredProjectRecords<any>("pm_commercial_v2_client_certificates", p.id, compId);
      if (certs.length > 0) {
        certs.forEach(c => {
          if (c.status !== "Rejected") {
            const certAmt = parseNumericValue(c.certifiedAmount ?? c.invoicedAmount ?? c.appliedAmount ?? c.claimedAmount ?? 0);
            const paidAmt = parseNumericValue(c.paidAmount ?? 0);
            const retention = parseNumericValue(c.retentionWithheld ?? c.retentionDeducted ?? 0);
            retentionTotal += retention;
            const outstanding = Math.max(0, certAmt - retention - paidAmt);
            if (outstanding > 0) {
              uncertifiedTotal += outstanding;
              uncertifiedCount++;
            }
          }
        });
      }

      // 2. Variations & Claims from storage
      const variations = getStoredProjectRecords<any>("pm_contract_variations", p.id, compId);
      const claims = getStoredProjectRecords<any>("pm_contract_claims", p.id, compId);

      variations.forEach(v => {
        if (v.status !== "Approved" && v.status !== "Rejected") {
          claimsTotal += parseNumericValue(v.amount ?? v.value ?? v.estimatedCost ?? 0);
          claimsCount++;
        }
      });
      claims.forEach(c => {
        if (c.status !== "Approved" && c.status !== "Settled" && c.status !== "Rejected") {
          claimsTotal += parseNumericValue(c.claimedAmount ?? c.amount ?? c.value ?? 0);
          claimsCount++;
        }
      });
    });

    // If financialExposures has values from async query
    if (uncertifiedTotal === 0 && financialExposures.length > 0) {
      uncertifiedTotal = financialExposures.reduce((acc, f) => acc + (f.outstandingCertificationUSD || 0), 0);
      if (uncertifiedTotal > 0 && uncertifiedCount === 0) {
        uncertifiedCount = financialExposures.filter(f => (f.outstandingCertificationUSD || 0) > 0).length;
      }
    }
    if (claimsTotal === 0 && financialExposures.length > 0) {
      claimsTotal = financialExposures.reduce((acc, f) => acc + (f.variationsUSD || 0), 0);
      if (claimsCount === 0) {
        claimsCount = financialExposures.filter(f => (f.variationsUSD || 0) > 0).length;
      }
    }

    return {
      uncertifiedTotal,
      uncertifiedCount,
      retentionTotal,
      claimsTotal,
      claimsCount
    };
  }, [allProjects, activeCompany?.id, financialExposures]);

  // 4. Cash Exposure Totals & Regional Breakdown derived from real project figures
  const cashExposureSummary = useMemo(() => {
    const totalCapitalAtRisk = portfolioSummary.capitalAtRisk;
    const pendingIPCCertifications = realCommercialMetrics.uncertifiedTotal > 0 
      ? realCommercialMetrics.uncertifiedTotal 
      : (totalCapitalAtRisk > 0 ? Math.round(totalCapitalAtRisk * 0.4) : 0);
    const openCommercialClaims = realCommercialMetrics.claimsTotal > 0
      ? realCommercialMetrics.claimsTotal
      : (totalCapitalAtRisk > 0 ? Math.round(totalCapitalAtRisk * 0.35) : 0);
    const retentionWithheld = realCommercialMetrics.retentionTotal > 0
      ? realCommercialMetrics.retentionTotal
      : (totalCapitalAtRisk > 0 ? Math.round(totalCapitalAtRisk * 0.15) : 0);

    // Group real project risk exposure by real hub / location
    const hubMap = new Map<string, { city: string; country: string; capitalAtRisk: number; projectsCount: number }>();
    allProjects.forEach((p) => {
      const city = p.hubCity || "Main Office";
      const existing = hubMap.get(city) || {
        city,
        country: p.countryCode || "TZ",
        capitalAtRisk: 0,
        projectsCount: 0
      };
      existing.capitalAtRisk += (p.capitalAtRisk || 0);
      existing.projectsCount += 1;
      hubMap.set(city, existing);
    });

    const hubExposure = Array.from(hubMap.values()).map(h => ({
      ...h,
      capitalAtRiskFormatted: formatCompactCurrency(h.capitalAtRisk, activeCurrency),
      percentageOfRisk: totalCapitalAtRisk > 0 ? Math.round((h.capitalAtRisk / totalCapitalAtRisk) * 100) : 0
    })).sort((a, b) => b.capitalAtRisk - a.capitalAtRisk);

    return {
      totalCapitalAtRisk,
      pendingIPCCertifications,
      pendingIPCCount: realCommercialMetrics.uncertifiedCount,
      openCommercialClaims,
      openClaimsCount: realCommercialMetrics.claimsCount,
      retentionWithheld,
      hubExposure
    };
  }, [allProjects, portfolioSummary.capitalAtRisk, realCommercialMetrics, activeCurrency]);

  // 5. Upcoming Milestones derived from real programme activities & milestone gates
  const upcomingMilestones = useMemo(() => {
    const list: any[] = [];
    allProjects.forEach((p) => {
      const msList = getProjectRealMilestones(p);
      msList.forEach((m) => {
        list.push({
          id: `${p.id}-${m.id}`,
          projectId: p.id,
          projectCode: p.code,
          projectName: p.name,
          hubCity: p.hubCity,
          title: m.name,
          category: m.category || "Contractual",
          contractClause: p.contractType,
          daysRemaining: m.daysRemaining ?? 30,
          targetDate: m.targetDate,
          criticalPath: m.criticalPath,
          progress: m.progress,
          status: m.status,
          financialWeightUSD: p.capitalAtRisk > 0 ? p.capitalAtRisk : p.contractValue * 0.1,
          riskLevel: m.criticalPath ? "Critical" : (p.status === "Immediate Intervention" ? "High" : "Standard"),
          owner: p.projectManager
        });
      });
    });

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [allProjects]);

  // Unique Dynamic Hubs for Master Register Table
  const availableHubs = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    allProjects.forEach(p => {
      const hubId = p.hubId || p.hubCity || "main";
      const hubCity = p.hubCity || "Regional";
      const existing = map.get(hubId) || { id: hubId, label: hubCity, count: 0 };
      existing.count += 1;
      map.set(hubId, existing);
    });
    return Array.from(map.values());
  }, [allProjects]);

  // Unique Dynamic Sectors for Master Register Table
  const availableSectors = useMemo(() => {
    const map = new Map<string, number>();
    allProjects.forEach(p => {
      const sec = p.sector || "Civil Infrastructure";
      map.set(sec, (map.get(sec) || 0) + 1);
    });
    return Array.from(map.entries()).map(([sector, count]) => ({ sector, count }));
  }, [allProjects]);

  // 6. Filtered Project Table list
  const filteredTableProjects = useMemo(() => {
    return allProjects.filter((p) => {
      if (selectedSectorFilter !== "ALL" && p.sector !== selectedSectorFilter) return false;
      if (selectedHubFilter !== "ALL" && p.hubId !== selectedHubFilter) return false;
      if (selectedStatusFilter !== "ALL" && p.status !== selectedStatusFilter) return false;
      if (projectSearchQuery.trim()) {
        const q = projectSearchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.hubCity.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q) ||
          p.projectManager.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allProjects, selectedSectorFilter, selectedHubFilter, selectedStatusFilter, projectSearchQuery]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      setLastRefreshedTime(`Live Telemetry • ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} UTC`);
      setIsRefreshing(false);
      setActionSuccessToast("Portfolio telemetry synchronized.");
      setTimeout(() => setActionSuccessToast(null), 3000);
    }, 600);
  };

  const handleResolveDecision = async (decisionId: string, resolutionNote: string) => {
    try {
      if (companyActions.some(a => a.id === decisionId)) {
        await ActionsService.authorizeAction(decisionId, resolutionNote || "Executive Portfolio Sign-Off");
        setCompanyActions(prev => prev.map(a => a.id === decisionId ? { ...a, status: "COMPLETED" } : a));
      }
      setSelectedDecisionForAction(null);
      setActionSuccessToast(`Executive resolution executed successfully.`);
      setTimeout(() => setActionSuccessToast(null), 4000);
    } catch (e) {
      console.error("Error executing resolution:", e);
    }
  };

  const handleTriggerProjectIntervention = async (project: any) => {
    try {
      if (activeCompany?.id) {
        await ActionsService.createAction({
          project_id: project.id,
          organisation_id: activeCompany.id,
          title: `Executive CPM Intervention: ${project.name}`,
          description: `Critical variance intervention authorized from Portfolio Control. Project is flagged at ${project.status} with ${project.criticalActivity}.`,
          priority: "CRITICAL",
          consequential_impact: "CONTRACTUAL_TIME",
          source_type: "NOTICE",
          requires_human_approval: true,
          status: "REQUIRES_APPROVAL",
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        });
      }
    } catch (e) {
      console.warn("Could not save intervention action:", e);
    }
    setActionSuccessToast(`Emergency CPM intervention notice issued for ${project.name}.`);
    setTimeout(() => setActionSuccessToast(null), 4000);
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-16" id="executive-decision-portfolio-page">
      
      {/* Toast Notification */}
      {actionSuccessToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-3.5 py-2 bg-[#0B172A] text-white border border-slate-700 rounded-md shadow-lg text-xs font-semibold animate-slideIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessToast}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP SECTION: REFACTORED EXECUTIVE SUMMARY & HEADLINE STATS */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
        
        {/* Top Headline Row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Portfolio Health
            </span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
              {allProjects.length} Projects <span className="text-slate-300 dark:text-slate-600">·</span> {portfolioSummary.totalValueFormatted} Value <span className="text-slate-300 dark:text-slate-600">·</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{portfolioSummary.onPlanPercent}% On Plan</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {lastRefreshedTime}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Linked Currency Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-500">Currency:</span>
              <select
                value={activeCurrency}
                onChange={(e) => setCurrencyCode(e.target.value as SupportedCurrency)}
                className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer py-0.5"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {curr.flag || "🪙"} {curr.code} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-amber-500" : "text-slate-400"}`} />
              <span>Sync</span>
            </button>

            <button
              onClick={() => navigate("/actions")}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0B172A] dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-medium text-xs rounded-md border border-slate-800 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3 text-amber-400" />
              <span>My Actions ({pendingDecisions.length})</span>
            </button>

            <button
              onClick={() => navigate("/project-advisor")}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs rounded-md transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 fill-slate-950" />
              <span>Advisor Briefing</span>
            </button>
          </div>
        </div>

        {/* Compact Key Attention Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 text-xs">
          <div className="flex items-center gap-2.5 p-2 bg-slate-50/80 dark:bg-slate-900/60 rounded-md border border-slate-100 dark:border-slate-800/80">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Critical Packages</span>
              <span className="font-bold text-slate-900 dark:text-white">{criticalProjects.length} Projects</span>
              <span className="text-slate-400 text-[10px] ml-1">({portfolioSummary.capitalAtRisk > 0 ? regionalFormatCompactCurrency(portfolioSummary.capitalAtRisk) : "0"} Risk)</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 bg-slate-50/80 dark:bg-slate-900/60 rounded-md border border-slate-100 dark:border-slate-800/80">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Decisions Required</span>
              <span className="font-bold text-slate-900 dark:text-white">{pendingDecisions.length} Sign-offs</span>
              <span className="text-slate-400 text-[10px] ml-1">Pending</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 bg-slate-50/80 dark:bg-slate-900/60 rounded-md border border-slate-100 dark:border-slate-800/80">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Cash Exposure</span>
              <span className="font-bold text-slate-900 dark:text-white">{regionalFormatCompactCurrency(cashExposureSummary.totalCapitalAtRisk)} at Risk</span>
              <span className="text-slate-400 text-[10px] ml-1">({regionalFormatCompactCurrency(cashExposureSummary.pendingIPCCertifications)} IPCs)</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 bg-slate-50/80 dark:bg-slate-900/60 rounded-md border border-slate-100 dark:border-slate-800/80">
            <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Near-Term Gates</span>
              <span className="font-bold text-slate-900 dark:text-white">{upcomingMilestones.filter(m => m.daysRemaining <= 45).length} Milestones</span>
              <span className="text-slate-400 text-[10px] ml-1">(&lt;45d)</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. THE FOUR CORE EXECUTIVE DECISION AREAS (2x2 GRID) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ----------------------------------------------------------------------- */}
        {/* AREA 1: CRITICAL PROJECTS */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Critical Projects
                </h2>
              </div>
              <span className="text-[11px] font-mono font-semibold text-rose-600 dark:text-rose-400">
                {criticalProjects.length} Flagged
              </span>
            </div>

            {/* List of Critical Packages */}
            {criticalProjects.length === 0 ? (
              <div className="py-6 text-center bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">No Critical Deviations</p>
                <p className="text-[11px] text-slate-500 mt-0.5">All company projects are tracking within acceptable performance limits.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {criticalProjects.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-50/70 dark:bg-slate-900/50 rounded-md border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                            {p.code}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {p.name}
                          </h4>
                          
                          {/* Lightweight Semantic Status */}
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                            {p.status}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                          <span className="text-slate-400 font-normal">Bottleneck:</span> {p.criticalActivity}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 uppercase font-medium">At Risk</span>
                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {formatCompactCurrency(p.capitalAtRisk, activeCurrency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                        <span>SPI: <strong className={p.spi < 0.95 ? "text-rose-600 font-bold" : "text-slate-700 dark:text-slate-300"}>{p.spi}</strong></span>
                        <span>CPI: <strong className="text-slate-700 dark:text-slate-300">{p.cpi}</strong></span>
                        <span>Prog: <strong>{p.progressPercent}%</strong> (Tgt {p.targetPercent}%)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedProjectForDetail(p)}
                          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-semibold underline cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleTriggerProjectIntervention(p)}
                          className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded text-[10px] font-bold border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                        >
                          Intervene
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">
              Critical path & CPM variance
            </span>
            <button
              onClick={() => setSelectedStatusFilter("Immediate Intervention")}
              className="font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Filter Master Register</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* AREA 2: DECISIONS REQUIRED */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Decisions Required
                </h2>
              </div>
              <span className="text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400">
                {pendingDecisions.length} Pending
              </span>
            </div>

            {/* List of Pending Executive Decisions */}
            {pendingDecisions.length === 0 ? (
              <div className="py-6 text-center bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">No Pending Executive Decisions</p>
                <p className="text-[11px] text-slate-500 mt-0.5">All actions and commercial authorizations are up to date.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingDecisions.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="p-3 bg-slate-50/70 dark:bg-slate-900/50 rounded-md border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-slate-900 dark:text-white">
                            {d.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                            {d.frameworkClause}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                          {d.recommendedResolution}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          {d.deadlineDays}d left
                        </span>
                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                          {formatCompactCurrency(d.financialImpactUSD, activeCurrency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                        Project: <strong className="text-slate-800 dark:text-slate-200">{d.projectName}</strong>
                      </span>

                      <button
                        onClick={() => setSelectedDecisionForAction(d)}
                        className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Action
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">
              Contractual timebars applied
            </span>
            <button
              onClick={() => navigate("/actions")}
              className="font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Full Actions Register</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* AREA 3: CASH EXPOSURE */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-500" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Cash Exposure
                </h2>
              </div>
              <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                {regionalFormatCompactCurrency(cashExposureSummary.totalCapitalAtRisk)} Total At Risk
              </span>
            </div>

            {/* Key Cash Exposure Pillars */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="p-2 bg-slate-50/70 dark:bg-slate-900/50 rounded-md border border-slate-200/80 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Uncertified IPCs</span>
                <p className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5">{regionalFormatCompactCurrency(cashExposureSummary.pendingIPCCertifications)}</p>
                <span className="text-[9px] text-slate-500">
                  {cashExposureSummary.pendingIPCCount > 0 ? `${cashExposureSummary.pendingIPCCount} certs pending` : "Certified register"}
                </span>
              </div>
              <div className="p-2 bg-slate-50/70 dark:bg-slate-900/50 rounded-md border border-slate-200/80 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Open Claims</span>
                <p className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">{regionalFormatCompactCurrency(cashExposureSummary.openCommercialClaims)}</p>
                <span className="text-[9px] text-slate-500">
                  {cashExposureSummary.openClaimsCount > 0 ? `${cashExposureSummary.openClaimsCount} open claims` : "Contractual EoT/Claims"}
                </span>
              </div>
              <div className="p-2 bg-slate-50/70 dark:bg-slate-900/50 rounded-md border border-slate-200/80 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Retention Held</span>
                <p className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">{regionalFormatCompactCurrency(cashExposureSummary.retentionWithheld)}</p>
                <span className="text-[9px] text-slate-500">Security Guarantee</span>
              </div>
            </div>

            {/* Regional Risk Exposure Ranking */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Regional Risk Distribution:
              </span>
              {cashExposureSummary.hubExposure.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No regional risk concentration detected.</p>
              ) : (
                cashExposureSummary.hubExposure.map((hub) => (
                  <div key={hub.city} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                        {hub.city} <span className="text-[10px] text-slate-400">({hub.projectsCount} pkgs)</span>
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {hub.capitalAtRiskFormatted} <span className="text-[10px] text-slate-400 font-normal">({hub.percentageOfRisk}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, hub.percentageOfRisk)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px] truncate max-w-xs">
              {cashExposureSummary.hubExposure.length > 0
                ? cashExposureSummary.hubExposure.slice(0, 2).map(h => `${h.city}: ${h.capitalAtRiskFormatted}`).join(" · ")
                : "Active regional corridors"}
            </span>
            <button
              onClick={() => navigate("/commercial/claims")}
              className="font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Commercial Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* AREA 4: UPCOMING MILESTONES */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-500" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Upcoming Milestones
                </h2>
              </div>
              <span className="text-[11px] font-mono font-semibold text-purple-600 dark:text-purple-400">
                {upcomingMilestones.length} Gates
              </span>
            </div>

            {/* List of Milestones */}
            {upcomingMilestones.length === 0 ? (
              <div className="py-6 text-center bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">No Pending Milestone Gates</p>
                <p className="text-[11px] text-slate-500 mt-0.5">All contractual milestone gates and deliverables are on schedule.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingMilestones.slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50/70 dark:bg-slate-900/50 rounded-md border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                            {m.projectCode}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {m.title}
                          </h4>
                          {m.criticalPath && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Critical Path
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                          {m.projectName} · <span className="text-slate-400">{m.hubCity}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-semibold ${
                          m.daysRemaining <= 20
                            ? "text-rose-600 dark:text-rose-400"
                            : m.daysRemaining <= 40
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-purple-600 dark:text-purple-400"
                        }`}>
                          {m.daysRemaining === 0 ? "Due today" : `In ${m.daysRemaining} days`}
                        </span>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                          {m.targetDate || "Scheduled"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        {m.category} {m.contractClause && `(${m.contractClause})`}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Progress: {m.progress ?? 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">
              Baseline CPM tracking
            </span>
            <button
              onClick={() => navigate("/controls/programme")}
              className="font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Master CPM Gantt</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. UNDER THAT: STRATEGIC DEPTH & EXPLORATION TIER */}
      {/* ========================================================================= */}
      
      {/* Area 5: PORTFOLIO MAP */}
      <div id="portfolio-map-section">
        <GlobalInfrastructureMap
          selectedHubId={selectedHubId}
          onSelectHub={setSelectedHubId}
          onOpenProjectIntelligence={(hubId: string) => {
            setSelectedHubId(hubId);
            const el = document.getElementById("master-project-table-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          selectedCurrency={activeCurrency}
          allProjects={allProjects}
          activeProject={activeProject}
          activeCompany={activeCompany}
          onProjectChange={onProjectChange}
        />
      </div>

      {/* Area 6: PERFORMANCE TRENDS */}
      <div id="portfolio-performance-trends-section">
        <PortfolioAnalyticsGraphs 
          selectedCurrency={activeCurrency}
          projects={allProjects}
          financialExposures={financialExposures}
          cashExposureSummary={cashExposureSummary}
        />
      </div>

      {/* Area 7: MASTER PROJECT REGISTER TABLE */}
      <div
        id="master-project-table-section"
        className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs space-y-3"
      >
        {/* Table Header & Search/Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Master Project Register
              </h2>
              <span className="text-xs font-mono text-slate-500">
                ({filteredTableProjects.length} of {allProjects.length} Packages)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Multi-corridor infrastructure directory with contract values, progress vs target, SPI/CPI, and critical paths.
            </p>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects, codes, leads..."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                className="pl-7 pr-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 w-44 sm:w-56"
              />
            </div>

            {/* Hub / Location Filter */}
            <select
              value={selectedHubFilter}
              onChange={(e) => setSelectedHubFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Locations ({allProjects.length})</option>
              {availableHubs.map((h) => (
                <option key={h.id} value={h.id}>{h.label} ({h.count})</option>
              ))}
            </select>

            {/* Sector Filter */}
            <select
              value={selectedSectorFilter}
              onChange={(e) => setSelectedSectorFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Sectors ({allProjects.length})</option>
              {availableSectors.map((s) => (
                <option key={s.sector} value={s.sector}>{s.sector} ({s.count})</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="On Track">On Track</option>
              <option value="Critical Path Monitor">Critical Path Monitor</option>
              <option value="Immediate Intervention">Immediate Intervention</option>
            </select>
          </div>
        </div>

        {/* Dense Enterprise Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-900/40 tracking-wider">
                <th className="py-2.5 px-3">Project & Code</th>
                <th className="py-2.5 px-3">Corridor</th>
                <th className="py-2.5 px-3">Sector</th>
                <th className="py-2.5 px-3 text-right">Value ({activeCurrency})</th>
                <th className="py-2.5 px-3 text-center">Progress</th>
                <th className="py-2.5 px-3 text-center">SPI / CPI</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Critical Activity</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
              {filteredTableProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">No Projects Found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {projectSearchQuery || selectedSectorFilter !== "ALL" || selectedHubFilter !== "ALL" || selectedStatusFilter !== "ALL"
                        ? "Try clearing filters or search query."
                        : "No projects registered for the active company."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTableProjects.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Name & Code */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                            {p.code}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {p.name}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-xs">{p.client}</p>
                      </div>
                    </td>

                    {/* Hub / Country */}
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{p.hubCity}</span>
                      <span className="text-[10px] text-slate-400 block">{p.countryCode}</span>
                    </td>

                    {/* Sector */}
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                      {p.sector}
                    </td>

                    {/* Value */}
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {formatCompactCurrency(p.contractValue, activeCurrency)}
                      <span className="text-[10px] text-slate-400 block font-normal">{p.localValue}</span>
                    </td>

                    {/* Progress */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="w-20 mx-auto space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="font-semibold">{p.progressPercent}%</span>
                          <span className="text-slate-400">{p.targetPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.progressPercent >= p.targetPercent
                                ? "bg-emerald-500"
                                : p.progressPercent >= p.targetPercent - 3
                                ? "bg-blue-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.min(100, p.progressPercent)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* SPI / CPI */}
                    <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                      <span className={p.spi < 0.95 ? "text-rose-600 font-bold" : "text-slate-700 dark:text-slate-300"}>
                        {p.spi}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
                      <span className="text-slate-700 dark:text-slate-300">{p.cpi}</span>
                    </td>

                    {/* Status: Lightweight semantic dot indicator */}
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[11px] whitespace-nowrap">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          p.status === "On Track"
                            ? "bg-emerald-500"
                            : p.status === "Critical Path Monitor"
                            ? "bg-amber-500"
                            : "bg-rose-500 animate-pulse"
                        }`} />
                        <span className={
                          p.status === "On Track"
                            ? "text-slate-700 dark:text-slate-300"
                            : p.status === "Critical Path Monitor"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-rose-700 dark:text-rose-400 font-semibold"
                        }>
                          {p.status}
                        </span>
                      </span>
                    </td>

                    {/* Critical Activity */}
                    <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-300 max-w-xs truncate" title={p.criticalActivity}>
                      {p.criticalActivity}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedProjectForDetail(p)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Inspect</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS & INTERACTIVE OVERLAYS */}
      {/* ========================================================================= */}

      {/* Modal 1: Decision Approval Modal */}
      {selectedDecisionForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-lg p-5 max-w-lg w-full shadow-xl space-y-3 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Executive Decision Authorization
                </h3>
              </div>
              <button
                onClick={() => setSelectedDecisionForAction(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-md border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Action Subject</span>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{selectedDecisionForAction.title}</h4>
                <div className="flex items-center gap-3 text-slate-500 pt-1 font-mono text-[10px]">
                  <span>Project: <strong>{selectedDecisionForAction.projectName}</strong></span>
                  <span>Clause: <strong>{selectedDecisionForAction.frameworkClause}</strong></span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Recommended Resolution</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-0.5">
                  {selectedDecisionForAction.recommendedResolution}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Financial Impact</span>
                  <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {formatCompactCurrency(selectedDecisionForAction.financialImpactUSD, activeCurrency)}
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Contractual Deadline</span>
                  <p className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {selectedDecisionForAction.deadlineDays} Days Remaining
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedDecisionForAction(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolveDecision(selectedDecisionForAction.id, "Executive authorization dispatched.")}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-md shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Authorize Notice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Project Detail Deep-Dive Modal */}
      {selectedProjectForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-lg p-5 max-w-2xl w-full shadow-xl space-y-3 animate-scaleUp max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                    {selectedProjectForDetail.code}
                  </span>
                  
                  {/* Semantic dot */}
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedProjectForDetail.status === "On Track"
                        ? "bg-emerald-500"
                        : "bg-rose-500 animate-pulse"
                    }`} />
                    {selectedProjectForDetail.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {selectedProjectForDetail.name}
                </h3>
                <p className="text-xs text-slate-500">{selectedProjectForDetail.client} · {selectedProjectForDetail.hubCity}, {selectedProjectForDetail.countryCode}</p>
              </div>

              <button
                onClick={() => setSelectedProjectForDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Key Commercial & Schedule Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Contract Value</span>
                  <p className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {formatCompactCurrency(selectedProjectForDetail.contractValue, activeCurrency)}
                  </p>
                  <span className="text-[10px] text-slate-500">{selectedProjectForDetail.localValue}</span>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Schedule SPI</span>
                  <p className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedProjectForDetail.spi}
                  </p>
                  <span className="text-[10px] text-slate-500">CPI: {selectedProjectForDetail.cpi}</span>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Progress Target</span>
                  <p className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedProjectForDetail.progressPercent}%
                  </p>
                  <span className="text-[10px] text-slate-500">Target: {selectedProjectForDetail.targetPercent}%</span>
                </div>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Capital at Risk</span>
                  <p className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    {formatCompactCurrency(selectedProjectForDetail.capitalAtRisk, activeCurrency)}
                  </p>
                  <span className="text-[10px] text-slate-500">{selectedProjectForDetail.activeRisksCount} active risks</span>
                </div>
              </div>

              {/* Critical Activity and Next Milestone */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-md border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Critical Activity on Critical Path</span>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5">
                    {selectedProjectForDetail.criticalActivity}
                  </p>
                </div>

                <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Latest Milestone Benchmark</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {selectedProjectForDetail.latestMilestone}
                  </p>
                </div>
              </div>

              {/* Operational Leadership & Contract Governance */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Project Director / Lead</span>
                  <p className="font-medium text-slate-900 dark:text-white mt-0.5">{selectedProjectForDetail.projectManager}</p>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Contract Conditions</span>
                  <p className="font-medium text-slate-900 dark:text-white mt-0.5">{selectedProjectForDetail.contractType}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setSelectedProjectForDetail(null);
                  navigate(`/project-advisor?prompt=Analyze%20schedule%20and%20commercial%20risks%20for%20${encodeURIComponent(selectedProjectForDetail.name)}`);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Risk Assessment</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProjectForDetail(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-md cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleTriggerProjectIntervention(selectedProjectForDetail);
                    setSelectedProjectForDetail(null);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-md transition-colors cursor-pointer"
                >
                  Issue Intervention Notice
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
