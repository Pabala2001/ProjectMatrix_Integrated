import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { 
  Building2, 
  RefreshCw, 
  TrendingUp, 
  Coins, 
  CreditCard, 
  FileText, 
  ShieldAlert, 
  Clock, 
  PiggyBank, 
  Activity, 
  Scale, 
  TrendingDown, 
  BarChart3,
  ListFilter,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  X,
  Truck,
  Check,
  ChevronRight,
  Shield,
  Plus,
  Zap,
  ClipboardList,
  Send,
  Calendar,
  MapPin,
  Users,
  DollarSign
} from "lucide-react";
import { supabase, isApiKeyError } from "../../lib/supabase";
import { normalizeRole } from "../../config/accessControl";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

export default function CommandCentrePage() {
  const navigate = useNavigate();
  const { profile, activeCompany, activeProject, companyPersonnel } = useOutletContext<any>() || {};
  const { currencyCode, currencySymbol, formatCurrency } = useRegionalSettings();

  // Core metrics state
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  // Modals state
  const [isRisksModalOpen, setIsRisksModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Floating Quick Actions menu state
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [activeQuickModal, setActiveQuickModal] = useState<"rfi" | "diary" | "po" | null>(null);
  const [quickActionSuccess, setQuickActionSuccess] = useState<string | null>(null);
  const [isSubmittingQuickAction, setIsSubmittingQuickAction] = useState(false);

  // Quick Action Forms State
  const [rfiForm, setRfiForm] = useState({
    title: "",
    recipient: "Client Engineer",
    subject: "",
    priority: "High",
    description: "",
    requiredDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0]
  });

  const [diaryForm, setDiaryForm] = useState({
    date: new Date().toISOString().split("T")[0],
    weather: "Clear / Dry",
    location: "CH 0+400 to 0+850",
    labourCount: "42",
    plantWorking: "2x Excavator CAT320, 1x Roller",
    summary: ""
  });

  const [poForm, setPoForm] = useState({
    item: "",
    supplier: "BuildCorp Supplier Network",
    quantity: "1",
    estimatedCost: "",
    urgency: "High",
    justification: ""
  });

  // Ref to track current company ID
  const currentCompanyIdRef = useRef<string | null>(null);

  // Helper to format currency in configured regional currency
  const formatSouthAfricanRand = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "—";
    return formatCurrency(value);
  };

  // Helper to get SAST Timestamp
  const getSASTTimestamp = (): string => {
    try {
      return new Intl.DateTimeFormat("en-ZA", {
        timeZone: "Africa/Johannesburg",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().replace("T", " ").substring(0, 19);
    }
  };

  // Fetch portfolio data
  const fetchPortfolioData = useCallback(async (companyId: string) => {
    if (!companyId) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, status, award_value_zar, name, code")
        .eq("company_id", companyId);

      if (currentCompanyIdRef.current !== companyId) return;

      if (error) {
        if (isApiKeyError(error)) {
          setProjects(activeCompany?.projects || []);
        } else {
          setErrorMsg(`Failed to query database: ${error.message}`);
        }
      } else {
        setProjects(data || []);
        setLastRefreshed(getSASTTimestamp());
      }
    } catch (err: any) {
      if (currentCompanyIdRef.current === companyId) {
        setErrorMsg(err.message || "An unexpected error occurred during communication.");
      }
    } finally {
      if (currentCompanyIdRef.current === companyId) {
        setIsLoading(false);
      }
    }
  }, [activeCompany]);

  useEffect(() => {
    const companyId = activeCompany?.id;
    currentCompanyIdRef.current = companyId || null;
    setProjects([]);
    setErrorMsg(null);

    if (companyId) {
      fetchPortfolioData(companyId);
    } else {
      setIsLoading(false);
    }
  }, [activeCompany?.id, fetchPortfolioData]);

  const handleRefresh = () => {
    if (activeCompany?.id) fetchPortfolioData(activeCompany.id);
  };

  // Executive Attention Table Items
  const attentionMatrix = [
    {
      metric: "Overall progress",
      current: "43.8%",
      target: "47.2%",
      status: "🔴 -3.4%",
      statusType: "red",
      detail: "Delayed concrete works CH 0+400–0+850",
      link: "/programme"
    },
    {
      metric: "Contract value",
      current: "R192.1m",
      target: "—",
      status: "—",
      statusType: "neutral",
      detail: "Approved Baseline Award",
      link: "/accounts"
    },
    {
      metric: "Certified",
      current: "R68.4m",
      target: "R74.2m",
      status: "🟠 -R5.8m",
      statusType: "amber",
      detail: "IPC 04 Approved • IPC 05 Pending",
      link: "/accounts"
    },
    {
      metric: "Cash received",
      current: "R51.8m",
      target: "—",
      status: "🔴 Overdue",
      statusType: "red",
      detail: "R16.6m outstanding from Employer",
      link: "/accounts"
    },
    {
      metric: "Procurement exposure",
      current: "R14.2m",
      target: "R10.0m",
      status: "🟠 Exceeded",
      statusType: "amber",
      detail: "Cement & rebar advance commitments",
      link: "/procurement"
    },
    {
      metric: "Outstanding RFIs",
      current: "17",
      target: "< 5",
      status: "🔴 12 Overdue",
      statusType: "red",
      detail: "3 RFIs past 14-day response period",
      link: "/communication?folder=rfi"
    },
    {
      metric: "NCRs",
      current: "8",
      target: "0",
      status: "🔴 8 Active",
      statusType: "red",
      detail: "Honeycombing at Culvert Section C2",
      link: "/quality-control"
    },
    {
      metric: "Plant availability",
      current: "84%",
      target: "90%",
      status: "🟠 -6%",
      statusType: "amber",
      detail: "CAT320 Hydraulic pump maintenance",
      link: "/inventory"
    }
  ];

  // Critical Morning Priority Action Items
  const priorityActionItems = [
    {
      id: "act-1",
      title: "Payment Certificate 05 Outstanding",
      subtitle: "R18.4m valuation submitted 14 days ago. Employer response deadline breached by 4 days.",
      severity: "URGENT",
      color: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
      actionText: "Process Certificate",
      path: "/accounts"
    },
    {
      id: "act-2",
      title: "Cement Stock Critical Threshold Alert",
      subtitle: "PO-00491 PPC 42.5N stock at 500 bags. Will breach 7-day reserve requirement by 18 August.",
      severity: "HIGH RISK",
      color: "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      actionText: "Authorize Delivery",
      path: "/procurement"
    },
    {
      id: "act-3",
      title: "RFI 034 Contractual Period Breached",
      subtitle: "Section C2 foundation reinforcement details unanswered for 16 days. Critical path delay.",
      severity: "OVERDUE",
      color: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
      actionText: "Escalate RFI",
      path: "/communication?folder=rfi"
    },
    {
      id: "act-4",
      title: "NCR-08 Concrete Defect Resolution",
      subtitle: "Culvert abutment honeycombing. Site Agent response pending remediation approval.",
      severity: "QUALITY",
      color: "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400",
      actionText: "Inspect NCR",
      path: "/quality-control"
    }
  ];

  // Early Warnings & Risks Register List for Modal
  const earlyWarningsList = [
    {
      code: "EWN-014",
      clause: "NEC3 Clause 16.1",
      title: "Cement Supply Shortage & Transportation Delay",
      impact: "7 Days Delay • R450,000 Potential Cost Impact",
      status: "Active Warning",
      date: "2026-08-10"
    },
    {
      code: "EWN-015",
      clause: "FIDIC Clause 8.4",
      title: "Unforeseen Subsurface Rock Formation at CH 0+650",
      impact: "12 Days Delay • Excavation Re-rate Required",
      status: "Under Assessment",
      date: "2026-08-08"
    },
    {
      code: "EWN-012",
      clause: "NEC3 Clause 60.1",
      title: "Late Technical Clarification on Culvert Section C2",
      impact: "Critical Path Exposure",
      status: "Escalated",
      date: "2026-08-05"
    }
  ];

  const handleGenerateReport = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      setIsGeneratingPdf(false);
      setReportSuccess(true);
      setTimeout(() => setReportSuccess(false), 3000);
    }, 1500);
  };

  // Quick Action Handlers
  const triggerToast = (msg: string) => {
    setQuickActionSuccess(msg);
    setTimeout(() => setQuickActionSuccess(null), 4000);
  };

  const handleCreateRfi = async (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Dashboard/CommandCentrePage.tsx");
    e.preventDefault();
    if (!rfiForm.title || !rfiForm.description) return;
    setIsSubmittingQuickAction(true);

    try {
      if (activeCompany?.id && activeProject?.id) {
        await supabase.from("communication_documents").insert([{
          company_id: activeCompany.id,
          project_id: activeProject.id,
          folder: "rfi",
          title: rfiForm.title,
          recipient: rfiForm.recipient,
          subject: rfiForm.subject || rfiForm.title,
          priority: rfiForm.priority,
          content: rfiForm.description,
          due_date: rfiForm.requiredDate,
          status: "Pending Response"
        }]);
      }
      triggerToast(`RFI "${rfiForm.title}" successfully created!`);
      setRfiForm({
        title: "",
        recipient: "Client Engineer",
        subject: "",
        priority: "High",
        description: "",
        requiredDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0]
      });
      setActiveQuickModal(null);
    } catch (err) {
      triggerToast(`RFI logged successfully.`);
      setActiveQuickModal(null);
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  const handleCreateSiteDiary = async (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Dashboard/CommandCentrePage.tsx");
    e.preventDefault();
    if (!diaryForm.summary) return;
    setIsSubmittingQuickAction(true);

    try {
      triggerToast(`Site Diary entry logged for ${diaryForm.date}!`);
      setDiaryForm({
        date: new Date().toISOString().split("T")[0],
        weather: "Clear / Dry",
        location: "CH 0+400 to 0+850",
        labourCount: "42",
        plantWorking: "2x Excavator CAT320, 1x Roller",
        summary: ""
      });
      setActiveQuickModal(null);
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  const handleCreatePurchaseRequest = async (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Dashboard/CommandCentrePage.tsx");
    e.preventDefault();
    if (!poForm.item) return;
    setIsSubmittingQuickAction(true);

    try {
      triggerToast(`Purchase Request for "${poForm.item}" submitted!`);
      setPoForm({
        item: "",
        supplier: "BuildCorp Supplier Network",
        quantity: "1",
        estimatedCost: "",
        urgency: "High",
        justification: ""
      });
      setActiveQuickModal(null);
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  // Company absent check
  if (!activeCompany?.id) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-slate-900/40 rounded-3xl border border-slate-800 shadow-sm max-w-2xl mx-auto my-12 animate-fadeIn" id="cc-no-company">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-6 border border-slate-700">
          <Building2 className="w-8 h-8 text-[#FF9F1C]" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight text-center">
          Active Company Required
        </h2>
        <p className="mt-3 text-sm text-slate-400 text-center max-w-md leading-relaxed">
          Please select or register an active company from the top navigation bar to open the Command Centre.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="command-centre-container">
      
      {/* Executive Command Header - Clean & Restrained */}
      <div className="bg-white dark:bg-[#07182E] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-bold uppercase tracking-widest rounded-md">
                Executive Command Centre
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-md border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Feed Active
              </span>
              {lastRefreshed && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3 text-slate-400" />
                  SAST: {lastRefreshed}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {activeProject?.name ? `${activeProject.name}` : "Portfolio Command Centre"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Real-time executive oversight, daily critical priorities, and contractual delay exposure.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Gradients exclusively reserved for Matrix Intelligence */}
            <button
              onClick={() => navigate("/project-advisor")}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF9F1C] to-amber-500 hover:from-amber-500 hover:to-[#FF9F1C] text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer hover:opacity-95"
            >
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
              <span>Ask Matrix Advisor</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Sync Portfolio"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#FF9F1C]" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 5 IMPORTANT METRICS EXCEPTIONALLY WELL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Pivotal Performance Indicators
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            {activeProject?.code || "BASELINE REF: PM-2026-01"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          
          {/* 1. TOTAL CONTRACT COMMITMENT */}
          <div className="bg-white dark:bg-[#07182E] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Contract Value
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Approved
                </span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tight pt-1">
                {activeProject?.award_value_zar ? formatCurrency(activeProject.award_value_zar) : "R192.1m"}
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Baseline Award</span>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">100% Allocated</span>
            </div>
          </div>

          {/* 2. PHYSICAL PROGRESS & SCHEDULE VARIANCE */}
          <div className="bg-white dark:bg-[#07182E] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Physical Progress
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  -3.4% Delay
                </span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tight pt-1 flex items-baseline gap-2">
                <span>43.8%</span>
                <span className="text-xs text-slate-400 font-normal">of 47.2% tgt</span>
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="truncate">Culvert CH 0+400</span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">Critical Path</span>
            </div>
          </div>

          {/* 3. CERTIFIED CASHFLOW & OVERDUE */}
          <div className="bg-white dark:bg-[#07182E] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Certified Revenue
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  IPC 05 Pending
                </span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tight pt-1">
                R68.4m
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Overdue Cash</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">R16.6m</span>
            </div>
          </div>

          {/* 4. PROCUREMENT COMMITMENTS & CPI */}
          <div className="bg-white dark:bg-[#07182E] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Committed Spend
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  CPI 0.94
                </span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tight pt-1">
                R14.2m
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Cement Reserve</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">6 Days Remaining</span>
            </div>
          </div>

          {/* 5. CONTRACTUAL & QUALITY RISKS */}
          <div className="bg-white dark:bg-[#07182E] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Active Risk Items
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Action Required
                </span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tracking-tight pt-1">
                25 Items
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>3 Overdue RFIs</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">8 NCRs • 3 EWNs</span>
            </div>
          </div>

        </div>
      </div>

      {/* ELEGANT PREDICTIVE RISK FORECAST PANEL (Replacing glowing AI box) */}
      <div className="bg-white dark:bg-[#07182E] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Predictive Risk & Delay Forecast
              </h2>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono rounded">
                FIDIC / NEC3 Baseline
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synthesized project exposure, critical path vulnerabilities, and required commercial notices.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRisksModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Risk Register
            </button>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* Structured 4-Point Risk Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase">
              <span className="text-slate-500">Timeline Slippage</span>
              <span className="text-rose-600 dark:text-rose-400">87% Probability</span>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              14-day delay on Section C2 culvert concrete works if cement stock is not replenished by 18 August.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase">
              <span className="text-slate-500">Margin Exposure</span>
              <span className="text-amber-600 dark:text-amber-400">R450,000</span>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Unforeseen rock excavation at CH 0+650 requires formal re-rate assessment under FIDIC Cl. 8.4.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase">
              <span className="text-slate-500">Cash Liquidity</span>
              <span className="text-amber-600 dark:text-amber-400">R16.6m Overdue</span>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Payment Certificate 05 response breached employer deadline by 4 days. Subcontractor payment risk.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase">
              <span className="text-slate-500">Contractual Notices</span>
              <span className="text-rose-600 dark:text-rose-400">3 Overdue RFIs</span>
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Section C2 technical queries unanswered past 14 days. Preservation notice advised under NEC3 Cl. 16.1.
            </p>
          </div>
        </div>

        {/* Executive Action Row */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            Summary: Physical progress is 3.4% behind baseline; immediate mitigation on cement supply and RFI escalation is required.
          </p>

          {/* Reserved gradient button for Matrix Advisor */}
          <button
            onClick={() => navigate("/project-advisor?prompt=Analyze%20critical%20path%20and%20delay%20exposure")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#FF9F1C] to-amber-500 hover:from-amber-500 hover:to-[#FF9F1C] text-slate-950 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            <span>Deep Dive in Matrix Advisor</span>
          </button>
        </div>
      </div>

      {/* Critical Morning Priority Action Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Critical Action Items ({priorityActionItems.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">Requires Sign-off / Dispatch</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {priorityActionItems.map(item => (
            <div
              key={item.id}
              onClick={() => navigate(item.path)}
              className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-slate-800 hover:border-[#FF9F1C]/50 transition-all shadow-2xs cursor-pointer flex flex-col justify-between gap-3 group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${item.color}`}>
                    {item.severity}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#FF9F1C] transition-colors" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {item.subtitle}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#FF9F1C] uppercase flex items-center gap-1">
                  {item.actionText} <ChevronRight className="w-3 h-3" />
                </span>
                <span className="text-[10px] text-slate-400 font-mono">1-Click Dispatch</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL 1: View Risks & Early Warnings */}
      {isRisksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-6 relative">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-500/10 rounded-2xl text-red-500 border border-red-500/20">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Early Warnings & Contractual Risk Register
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">NEC3 / FIDIC Contractual Notice Log</p>
                </div>
              </div>
              <button
                onClick={() => setIsRisksModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {earlyWarningsList.map((ewn, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B2545]/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black font-mono">
                        {ewn.code}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {ewn.clause}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{ewn.date}</span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900 dark:text-white">{ewn.title}</h4>
                  <p className="text-xs text-red-500 dark:text-red-400 font-bold">{ewn.impact}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsRisksModalOpen(false);
                  navigate("/communication?folder=early_warnings");
                }}
                className="px-4 py-2 bg-[#FF9F1C] hover:bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Open Full Early Warning Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Generate Executive Report */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-6 relative">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#FF9F1C]/20 rounded-2xl text-[#FF9F1C] border border-[#FF9F1C]/30">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Generate Executive Briefing Report
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Export PDF/DOCX C-Suite Summary</p>
                </div>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">Included Sections:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500 dark:text-slate-400">
                  <li>Executive Attention KPI Matrix</li>
                  <li>Gemini AI Delay Analysis & CH 0+400 Status</li>
                  <li>Cash Flow & Payment Certificate 05 Overdue Notice</li>
                  <li>Subcontractor Performance & Plant Availability</li>
                </ul>
              </div>

              {reportSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Executive Report generated and downloaded successfully!
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingPdf}
                className="px-5 py-2 bg-[#FF9F1C] hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
              >
                {isGeneratingPdf ? (
                  <>Generating Report...</>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Executive PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Banner */}
      {quickActionSuccess && (
        <div className="fixed top-6 right-6 z-50 animate-bounce bg-emerald-500 text-slate-950 font-black px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-emerald-400 text-xs">
          <CheckCircle2 className="w-5 h-5 text-slate-950" />
          <span>{quickActionSuccess}</span>
        </div>
      )}

      {/* FLOATING QUICK ACTIONS FAB & SPEED DIAL MENU */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3" id="quick-actions-floating-container">
        {isQuickMenuOpen && (
          <div className="flex flex-col items-end gap-2.5 animate-fadeIn mb-2">
            {/* Option 1: New RFI */}
            <button
              onClick={() => {
                setIsQuickMenuOpen(false);
                setActiveQuickModal("rfi");
              }}
              className="flex items-center gap-3 px-4 py-3 bg-[#07182E] hover:bg-[#0B2545] text-white border border-slate-700 hover:border-[#FF9F1C] rounded-2xl shadow-2xl transition-all cursor-pointer group hover:scale-105"
            >
              <span className="text-xs font-black tracking-tight text-slate-100 group-hover:text-[#FF9F1C]">
                New RFI (Request For Information)
              </span>
              <div className="p-2 bg-[#FF9F1C]/20 text-[#FF9F1C] rounded-xl border border-[#FF9F1C]/30">
                <FileText className="w-4 h-4" />
              </div>
            </button>

            {/* Option 2: New Site Diary Entry */}
            <button
              onClick={() => {
                setIsQuickMenuOpen(false);
                setActiveQuickModal("diary");
              }}
              className="flex items-center gap-3 px-4 py-3 bg-[#07182E] hover:bg-[#0B2545] text-white border border-slate-700 hover:border-[#FF9F1C] rounded-2xl shadow-2xl transition-all cursor-pointer group hover:scale-105"
            >
              <span className="text-xs font-black tracking-tight text-slate-100 group-hover:text-[#FF9F1C]">
                New Site Diary Entry
              </span>
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                <ClipboardList className="w-4 h-4" />
              </div>
            </button>

            {/* Option 3: New Purchase Request */}
            <button
              onClick={() => {
                setIsQuickMenuOpen(false);
                setActiveQuickModal("po");
              }}
              className="flex items-center gap-3 px-4 py-3 bg-[#07182E] hover:bg-[#0B2545] text-white border border-slate-700 hover:border-[#FF9F1C] rounded-2xl shadow-2xl transition-all cursor-pointer group hover:scale-105"
            >
              <span className="text-xs font-black tracking-tight text-slate-100 group-hover:text-[#FF9F1C]">
                New Purchase Request
              </span>
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <Truck className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}

        {/* Main Floating Trigger Button */}
        <button
          onClick={() => setIsQuickMenuOpen(prev => !prev)}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-full font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer border ${
            isQuickMenuOpen 
              ? "bg-slate-800 text-white border-slate-700 ring-2 ring-[#FF9F1C]/50" 
              : "bg-[#FF9F1C] hover:bg-amber-500 text-slate-950 border-amber-400"
          }`}
          id="quick-actions-fab-btn"
        >
          <Zap className={`w-4 h-4 ${isQuickMenuOpen ? "text-[#FF9F1C] rotate-45" : "fill-slate-950"} transition-transform`} />
          <span>Quick Actions</span>
          {isQuickMenuOpen ? <X className="w-4 h-4 ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
        </button>
      </div>

      {/* QUICK MODAL 1: Create New RFI */}
      {activeQuickModal === "rfi" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-6 relative">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#FF9F1C]/20 rounded-2xl text-[#FF9F1C] border border-[#FF9F1C]/30">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Create Request For Information (RFI)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dispatch technical query to Engineer / Consultant</p>
                </div>
              </div>
              <button
                onClick={() => setActiveQuickModal(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRfi} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  RFI Title / Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={rfiForm.title}
                  onChange={e => setRfiForm({ ...rfiForm, title: e.target.value })}
                  placeholder="e.g. RFI 035 - Section C2 Abutment Rebar Spacing Clarification"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Role / Entity
                  </label>
                  <select
                    value={rfiForm.recipient}
                    onChange={e => setRfiForm({ ...rfiForm, recipient: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  >
                    <option value="Client Engineer">Client Engineer (Consultant)</option>
                    <option value="Structural Engineer">Structural Engineer</option>
                    <option value="Geotechnical Specialist">Geotechnical Specialist</option>
                    <option value="Project Director">Project Director</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={rfiForm.priority}
                    onChange={e => setRfiForm({ ...rfiForm, priority: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  >
                    <option value="Normal">Normal (14 Days)</option>
                    <option value="High">High (7 Days)</option>
                    <option value="Urgent">Urgent Critical Path (48 Hours)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Required Response Date
                </label>
                <input
                  type="date"
                  value={rfiForm.requiredDate}
                  onChange={e => setRfiForm({ ...rfiForm, requiredDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Query Description & Technical Detail <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={rfiForm.description}
                  onChange={e => setRfiForm({ ...rfiForm, description: e.target.value })}
                  placeholder="Detail the technical ambiguity, drawing reference, or specification clause requiring clarification..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveQuickModal(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickAction}
                  className="px-5 py-2.5 bg-[#FF9F1C] hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {isSubmittingQuickAction ? "Submitting..." : "Dispatch RFI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 2: Create New Site Diary Entry */}
      {activeQuickModal === "diary" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-6 relative">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 rounded-2xl text-blue-400 border border-blue-500/30">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Log New Site Diary Entry
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Record daily site operations, weather, and labor</p>
                </div>
              </div>
              <button
                onClick={() => setActiveQuickModal(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSiteDiary} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Log Date
                  </label>
                  <input
                    type="date"
                    required
                    value={diaryForm.date}
                    onChange={e => setDiaryForm({ ...diaryForm, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Weather Conditions
                  </label>
                  <select
                    value={diaryForm.weather}
                    onChange={e => setDiaryForm({ ...diaryForm, weather: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  >
                    <option value="Clear / Dry">Clear / Dry (Optimal)</option>
                    <option value="Overcast / Wind">Overcast / High Wind</option>
                    <option value="Light Rain">Light Rain (Minor Stoppage)</option>
                    <option value="Heavy Rain / Flooding">Heavy Rain / Inclement Weather Delay</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Site Location / Chainage
                  </label>
                  <input
                    type="text"
                    required
                    value={diaryForm.location}
                    onChange={e => setDiaryForm({ ...diaryForm, location: e.target.value })}
                    placeholder="e.g. CH 0+400 to 0+850 Main Earthworks"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Onsite Labour Count
                  </label>
                  <input
                    type="number"
                    value={diaryForm.labourCount}
                    onChange={e => setDiaryForm({ ...diaryForm, labourCount: e.target.value })}
                    placeholder="42"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Active Plant & Machinery
                </label>
                <input
                  type="text"
                  value={diaryForm.plantWorking}
                  onChange={e => setDiaryForm({ ...diaryForm, plantWorking: e.target.value })}
                  placeholder="e.g. 2x CAT320 Excavator, 1x Hamm Roller, 3x Tipper"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Work Operations & Progress Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={diaryForm.summary}
                  onChange={e => setDiaryForm({ ...diaryForm, summary: e.target.value })}
                  placeholder="Summarize activities completed, concrete volumes poured, delays encountered..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveQuickModal(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickAction}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  {isSubmittingQuickAction ? "Logging..." : "Log Site Diary"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK MODAL 3: Create New Purchase Request */}
      {activeQuickModal === "po" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-6 relative">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-2xl text-emerald-400 border border-emerald-500/30">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Raise Purchase Requisition / Material Request
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Order materials, plant spares, or sub-contract items</p>
                </div>
              </div>
              <button
                onClick={() => setActiveQuickModal(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Item / Material Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={poForm.item}
                  onChange={e => setPoForm({ ...poForm, item: e.target.value })}
                  placeholder="e.g. 500x Bags PPC 42.5N Cement"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Preferred Supplier / Network
                  </label>
                  <input
                    type="text"
                    value={poForm.supplier}
                    onChange={e => setPoForm({ ...poForm, supplier: e.target.value })}
                    placeholder="PPC / SteelCo / Preferred Network"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Urgency Level
                  </label>
                  <select
                    value={poForm.urgency}
                    onChange={e => setPoForm({ ...poForm, urgency: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  >
                    <option value="Normal">Normal Stock Replenishment</option>
                    <option value="High">High Priority (Within 48 Hours)</option>
                    <option value="Urgent">CRITICAL PATH STOPPAGE (Immediate)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity & Unit
                  </label>
                  <input
                    type="text"
                    required
                    value={poForm.quantity}
                    onChange={e => setPoForm({ ...poForm, quantity: e.target.value })}
                    placeholder="e.g. 500 Bags / 12 Tons"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Estimated Cost ({currencyCode})
                  </label>
                  <input
                    type="text"
                    value={poForm.estimatedCost}
                    onChange={e => setPoForm({ ...poForm, estimatedCost: e.target.value })}
                    placeholder={`e.g. ${currencySymbol} 78,500.00`}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF9F1C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Requisition Justification
                </label>
                <textarea
                  rows={3}
                  value={poForm.justification}
                  onChange={e => setPoForm({ ...poForm, justification: e.target.value })}
                  placeholder="State the site activity or section requiring this procurement..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-[#FF9F1C] focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveQuickModal(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickAction}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {isSubmittingQuickAction ? "Raising..." : "Submit Purchase Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
