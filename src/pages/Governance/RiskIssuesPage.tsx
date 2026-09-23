import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  AlertTriangle, 
  ShieldAlert, 
  TrendingDown, 
  Clock, 
  Coins, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Layers,
  Sparkles,
  Edit,
  Trash2,
  X,
  FileText
} from "lucide-react";
import ProjectShell from "../../components/layout/ProjectShell";
import { MetricCard } from "../../components/ui/MetricCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Tabs } from "../../components/ui/Tabs";
import { Panel } from "../../components/ui/Panel";
import { DataTable } from "../../components/ui/DataTable";
import { RiskIndicator } from "../../components/ui/RiskIndicator";

type RiskTab = "radar" | "early-warnings" | "cost-exposure" | "issues";

interface RiskItem {
  id: string;
  code: string;
  title: string;
  category: string;
  probability: string;
  impact: string;
  score: number;
  level: "high" | "medium" | "low";
  mitigation: string;
  owner: string;
}

interface EarlyWarningItem {
  id: string;
  ref: string;
  activity: string;
  noticeDate: string;
  criticalPath: string;
  projectedDelay: string;
  cause: string;
  actionPlan: string;
  status: "Open" | "Mitigating" | "Closed";
}

interface CostExposureItem {
  id: string;
  ref: string;
  eventDescription: string;
  category: string;
  drawdownAmount: string;
  currency: string;
  riskAllocationRef: string;
  status: "Approved" | "Under Review" | "Forecast";
  authorizedBy: string;
  date: string;
}

interface IssueItem {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved";
  owner: string;
  actionRequired: string;
}

const DEFAULT_RISKS: RiskItem[] = [
  { id: "rsk-01", code: "RSK-GEO-004", title: "Unforeseen Geological Fracture Zone at Abutment", category: "Geotechnical", probability: "High (80%)", impact: "High ($345k / +18d)", score: 20, level: "high", mitigation: "Borehole core logging & micropiling grouting revision underway", owner: "Chief Geotechnical Engineer" },
  { id: "rsk-02", code: "RSK-PROC-012", title: "Imported Pre-stressing High Tensile Strand Port Congestion", category: "Supply Chain", probability: "Medium (45%)", impact: "Medium ($120k / +8d)", score: 12, level: "medium", mitigation: "Secondary freight forwarder engaged for direct bonded overland transit", owner: "Procurement Director" },
  { id: "rsk-03", code: "RSK-COMM-003", title: "Client Interim Valuation Payment Delay Exceeding 45 Days", category: "Commercial Cashflow", probability: "Medium (40%)", impact: "High (Subcontractor suspension)", score: 15, level: "high", mitigation: "Executive escalation letter issued; overdraft financing facility primed", owner: "Finance Director" },
  { id: "rsk-04", code: "RSK-ENV-001", title: "River Siltation Exceedance during Cofferdam Dewatering", category: "Environmental", probability: "Low (15%)", impact: "Medium (Stop-work order)", score: 6, level: "low", mitigation: "Triple geotextile silt curtain barrier installed across tailrace", owner: "HSE Compliance Lead" },
];

const DEFAULT_EWN: EarlyWarningItem[] = [
  { id: "ew-05", ref: "EWN-05", activity: "Act 1040: Pier 3 Concrete Pour", noticeDate: "15 Aug 2026", criticalPath: "Yes (Path 1)", projectedDelay: "+6 Days", cause: "Cement fly-ash delivery batch delay", actionPlan: "Switch to 24-hr dual shift upon batch arrival on Monday", status: "Open" },
  { id: "ew-04", ref: "EWN-04", activity: "Act 1015: Abutment Ground Anchors", noticeDate: "08 Aug 2026", criticalPath: "Yes (Path 1)", projectedDelay: "+18 Days", cause: "Fracture zone drilling refusal", actionPlan: "Rotary diamond core rig deployed", status: "Mitigating" },
  { id: "ew-03", ref: "EWN-03", activity: "Act 1080: Precast Deck Beams", noticeDate: "20 Jul 2026", criticalPath: "No (Float: 14d)", projectedDelay: "+4 Days", cause: "Curing temperature control in cold weather", actionPlan: "Thermal steam blankets installed; float absorbed", status: "Closed" },
];

const DEFAULT_COST_EXPOSURES: CostExposureItem[] = [
  { id: "ce-01", ref: "CDD-01", eventDescription: "Abutment Geotechnical Ground Treatment Grouting", category: "Geotechnical", drawdownAmount: "475,000", currency: "$", riskAllocationRef: "RSK-GEO-004", status: "Approved", authorizedBy: "Commercial Director", date: "12 Aug 2026" },
  { id: "ce-02", ref: "CDD-02", eventDescription: "Culvert Realignment & Silt Protection Barrier", category: "Environmental", drawdownAmount: "345,000", currency: "$", riskAllocationRef: "RSK-ENV-001", status: "Approved", authorizedBy: "Senior Project Manager", date: "28 Jul 2026" },
  { id: "ce-03", ref: "CDD-03", eventDescription: "Imported Strand Direct Overland Freight Routing", category: "Supply Chain", drawdownAmount: "120,000", currency: "$", riskAllocationRef: "RSK-PROC-012", status: "Under Review", authorizedBy: "Procurement Lead", date: "18 Aug 2026" },
];

const DEFAULT_ISSUES: IssueItem[] = [
  { id: "iss-01", code: "ISS-01", title: "Municipal Power Line Relocation Delay at Km 11+200", description: "Wayleave approved but utility contractor has not scheduled outage. Executive liaison meeting with Municipal Director requested.", severity: "High", status: "Open", owner: "Senior Project Manager", actionRequired: "Executive liaison meeting with Municipal Director requested." }
];

export default function RiskIssuesPage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const projectId = activeProject?.id || "proj-001";
  const projectName = activeProject?.name || "Active Project";

  const canCreate = true;
  const canEdit = true;
  const canDelete = true;

  const [activeTab, setActiveTab] = useState<RiskTab>("radar");

  // Persistent state per project
  const [risks, setRisks] = useState<RiskItem[]>(() => {
    try {
      const raw = previewStorage.getItem(`pm_risks_${projectId}`);
      return raw ? JSON.parse(raw) : DEFAULT_RISKS;
    } catch {
      return DEFAULT_RISKS;
    }
  });

  const [earlyWarnings, setEarlyWarnings] = useState<EarlyWarningItem[]>(() => {
    try {
      const raw = previewStorage.getItem(`pm_ewn_${projectId}`);
      return raw ? JSON.parse(raw) : DEFAULT_EWN;
    } catch {
      return DEFAULT_EWN;
    }
  });

  const [costExposures, setCostExposures] = useState<CostExposureItem[]>(() => {
    try {
      const raw = previewStorage.getItem(`pm_cost_exposures_${projectId}`);
      return raw ? JSON.parse(raw) : DEFAULT_COST_EXPOSURES;
    } catch {
      return DEFAULT_COST_EXPOSURES;
    }
  });

  const [issues, setIssues] = useState<IssueItem[]>(() => {
    try {
      const raw = previewStorage.getItem(`pm_issues_${projectId}`);
      return raw ? JSON.parse(raw) : DEFAULT_ISSUES;
    } catch {
      return DEFAULT_ISSUES;
    }
  });

  useEffect(() => {
    try {
      const rawRisks = previewStorage.getItem(`pm_risks_${projectId}`);
      setRisks(rawRisks ? JSON.parse(rawRisks) : DEFAULT_RISKS);
      const rawEwn = previewStorage.getItem(`pm_ewn_${projectId}`);
      setEarlyWarnings(rawEwn ? JSON.parse(rawEwn) : DEFAULT_EWN);
      const rawCe = previewStorage.getItem(`pm_cost_exposures_${projectId}`);
      setCostExposures(rawCe ? JSON.parse(rawCe) : DEFAULT_COST_EXPOSURES);
      const rawIss = previewStorage.getItem(`pm_issues_${projectId}`);
      setIssues(rawIss ? JSON.parse(rawIss) : DEFAULT_ISSUES);
    } catch {
      // Fallback
    }
  }, [projectId]);

  const saveRisks = (updated: RiskItem[]) => {
    assertOperationalAction("write", "pages/Governance/RiskIssuesPage.tsx");
    setRisks(updated);
    try {
      previewStorage.setItem(`pm_risks_${projectId}`, JSON.stringify(updated));
    } catch {}
  };

  const saveEarlyWarnings = (updated: EarlyWarningItem[]) => {
    assertOperationalAction("write", "pages/Governance/RiskIssuesPage.tsx");
    setEarlyWarnings(updated);
    try {
      previewStorage.setItem(`pm_ewn_${projectId}`, JSON.stringify(updated));
    } catch {}
  };

  const saveCostExposures = (updated: CostExposureItem[]) => {
    assertOperationalAction("write", "pages/Governance/RiskIssuesPage.tsx");
    setCostExposures(updated);
    try {
      previewStorage.setItem(`pm_cost_exposures_${projectId}`, JSON.stringify(updated));
    } catch {}
  };

  const saveIssues = (updated: IssueItem[]) => {
    assertOperationalAction("write", "pages/Governance/RiskIssuesPage.tsx");
    setIssues(updated);
    try {
      previewStorage.setItem(`pm_issues_${projectId}`, JSON.stringify(updated));
    } catch {}
  };

  // Modals state
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);
  const [viewingRisk, setViewingRisk] = useState<RiskItem | null>(null);

  const [isEwnModalOpen, setIsEwnModalOpen] = useState(false);
  const [editingEwn, setEditingEwn] = useState<EarlyWarningItem | null>(null);
  const [viewingEwn, setViewingEwn] = useState<EarlyWarningItem | null>(null);

  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<CostExposureItem | null>(null);
  const [viewingCost, setViewingCost] = useState<CostExposureItem | null>(null);

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueItem | null>(null);
  const [viewingIssue, setViewingIssue] = useState<IssueItem | null>(null);

  // Form states for Risk
  const [riskCode, setRiskCode] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [riskCategory, setRiskCategory] = useState("Technical");
  const [riskProbability, setRiskProbability] = useState("Medium (50%)");
  const [riskImpact, setRiskImpact] = useState("Medium");
  const [riskScore, setRiskScore] = useState(12);
  const [riskLevel, setRiskLevel] = useState<"high" | "medium" | "low">("medium");
  const [riskMitigation, setRiskMitigation] = useState("");
  const [riskOwner, setRiskOwner] = useState("");

  // Form states for EWN
  const [ewnRef, setEwnRef] = useState("");
  const [ewnActivity, setEwnActivity] = useState("");
  const [ewnDate, setEwnDate] = useState("");
  const [ewnCriticalPath, setEwnCriticalPath] = useState("Yes (Critical Path 1)");
  const [ewnDelay, setEwnDelay] = useState("+5 Days");
  const [ewnCause, setEwnCause] = useState("");
  const [ewnActionPlan, setEwnActionPlan] = useState("");
  const [ewnStatus, setEwnStatus] = useState<"Open" | "Mitigating" | "Closed">("Open");

  // Form states for Cost Exposure
  const [costRef, setCostRef] = useState("");
  const [costDescription, setCostDescription] = useState("");
  const [costCategory, setCostCategory] = useState("Geotechnical");
  const [costAmount, setCostAmount] = useState("");
  const [costCurrency, setCostCurrency] = useState("$");
  const [costRiskRef, setCostRiskRef] = useState("");
  const [costStatus, setCostStatus] = useState<"Approved" | "Under Review" | "Forecast">("Approved");
  const [costAuthorizedBy, setCostAuthorizedBy] = useState("");
  const [costDate, setCostDate] = useState("");

  // Form states for Issue
  const [issueCode, setIssueCode] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDesc, setIssueDesc] = useState("");
  const [issueSeverity, setIssueSeverity] = useState<"Critical" | "High" | "Medium" | "Low">("High");
  const [issueStatus, setIssueStatus] = useState<"Open" | "In Progress" | "Resolved">("Open");
  const [issueOwner, setIssueOwner] = useState("");
  const [issueAction, setIssueAction] = useState("");

  const handleOpenAddRisk = (item?: RiskItem) => {
    if (item) {
      setEditingRisk(item);
      setRiskCode(item.code);
      setRiskTitle(item.title);
      setRiskCategory(item.category);
      setRiskProbability(item.probability);
      setRiskImpact(item.impact);
      setRiskScore(item.score);
      setRiskLevel(item.level);
      setRiskMitigation(item.mitigation);
      setRiskOwner(item.owner);
    } else {
      setEditingRisk(null);
      setRiskCode(`RSK-${Date.now().toString().slice(-4)}`);
      setRiskTitle("");
      setRiskCategory("Technical");
      setRiskProbability("Medium (50%)");
      setRiskImpact("Medium ($100k / +5d)");
      setRiskScore(12);
      setRiskLevel("medium");
      setRiskMitigation("");
      setRiskOwner("Project Manager");
    }
    setIsRiskModalOpen(true);
  };

  const handleSaveRisk = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Governance/RiskIssuesPage.tsx");
    e.preventDefault();
    if (editingRisk) {
      const updated = risks.map(r => r.id === editingRisk.id ? {
        ...r,
        code: riskCode,
        title: riskTitle,
        category: riskCategory,
        probability: riskProbability,
        impact: riskImpact,
        score: Number(riskScore),
        level: riskLevel,
        mitigation: riskMitigation,
        owner: riskOwner
      } : r);
      saveRisks(updated);
    } else {
      const newRisk: RiskItem = {
        id: `rsk_${Date.now()}`,
        code: riskCode,
        title: riskTitle,
        category: riskCategory,
        probability: riskProbability,
        impact: riskImpact,
        score: Number(riskScore),
        level: riskLevel,
        mitigation: riskMitigation,
        owner: riskOwner
      };
      saveRisks([newRisk, ...risks]);
    }
    setIsRiskModalOpen(false);
  };

  const handleDeleteRisk = (id: string) => {
    assertOperationalAction("delete", "pages/Governance/RiskIssuesPage.tsx");
    saveRisks(risks.filter(r => r.id !== id));
    if (viewingRisk?.id === id) setViewingRisk(null);
  };

  const handleOpenAddEwn = (item?: EarlyWarningItem) => {
    if (item) {
      setEditingEwn(item);
      setEwnRef(item.ref);
      setEwnActivity(item.activity);
      setEwnDate(item.noticeDate);
      setEwnCriticalPath(item.criticalPath);
      setEwnDelay(item.projectedDelay);
      setEwnCause(item.cause);
      setEwnActionPlan(item.actionPlan);
      setEwnStatus(item.status);
    } else {
      setEditingEwn(null);
      setEwnRef(`EWN-${(earlyWarnings.length + 1).toString().padStart(2, "0")}`);
      setEwnActivity("");
      setEwnDate(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
      setEwnCriticalPath("Yes (Path 1)");
      setEwnDelay("+7 Days");
      setEwnCause("");
      setEwnActionPlan("");
      setEwnStatus("Open");
    }
    setIsEwnModalOpen(true);
  };

  const handleSaveEwn = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Governance/RiskIssuesPage.tsx");
    e.preventDefault();
    if (editingEwn) {
      const updated = earlyWarnings.map(e => e.id === editingEwn.id ? {
        ...e,
        ref: ewnRef,
        activity: ewnActivity,
        noticeDate: ewnDate,
        criticalPath: ewnCriticalPath,
        projectedDelay: ewnDelay,
        cause: ewnCause,
        actionPlan: ewnActionPlan,
        status: ewnStatus
      } : e);
      saveEarlyWarnings(updated);
    } else {
      const newEwn: EarlyWarningItem = {
        id: `ew_${Date.now()}`,
        ref: ewnRef,
        activity: ewnActivity,
        noticeDate: ewnDate,
        criticalPath: ewnCriticalPath,
        projectedDelay: ewnDelay,
        cause: ewnCause,
        actionPlan: ewnActionPlan,
        status: ewnStatus
      };
      saveEarlyWarnings([newEwn, ...earlyWarnings]);
    }
    setIsEwnModalOpen(false);
  };

  const handleDeleteEwn = (id: string) => {
    assertOperationalAction("delete", "pages/Governance/RiskIssuesPage.tsx");
    saveEarlyWarnings(earlyWarnings.filter(e => e.id !== id));
    if (viewingEwn?.id === id) setViewingEwn(null);
  };

  const handleOpenAddCost = (item?: CostExposureItem) => {
    if (item) {
      setEditingCost(item);
      setCostRef(item.ref);
      setCostDescription(item.eventDescription);
      setCostCategory(item.category);
      setCostAmount(item.drawdownAmount);
      setCostCurrency(item.currency || "$");
      setCostRiskRef(item.riskAllocationRef);
      setCostStatus(item.status);
      setCostAuthorizedBy(item.authorizedBy);
      setCostDate(item.date);
    } else {
      setEditingCost(null);
      setCostRef(`CDD-${(costExposures.length + 1).toString().padStart(2, "0")}`);
      setCostDescription("");
      setCostCategory("Geotechnical");
      setCostAmount("");
      setCostCurrency("$");
      setCostRiskRef(risks.length > 0 ? risks[0].code : "RSK-001");
      setCostStatus("Approved");
      setCostAuthorizedBy("Commercial Manager");
      setCostDate(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
    }
    setIsCostModalOpen(true);
  };

  const handleSaveCost = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Governance/RiskIssuesPage.tsx");
    e.preventDefault();
    if (editingCost) {
      const updated = costExposures.map(c => c.id === editingCost.id ? {
        ...c,
        ref: costRef,
        eventDescription: costDescription,
        category: costCategory,
        drawdownAmount: costAmount,
        currency: costCurrency,
        riskAllocationRef: costRiskRef,
        status: costStatus,
        authorizedBy: costAuthorizedBy,
        date: costDate
      } : c);
      saveCostExposures(updated);
    } else {
      const newCost: CostExposureItem = {
        id: `ce_${Date.now()}`,
        ref: costRef,
        eventDescription: costDescription,
        category: costCategory,
        drawdownAmount: costAmount,
        currency: costCurrency,
        riskAllocationRef: costRiskRef,
        status: costStatus,
        authorizedBy: costAuthorizedBy,
        date: costDate
      };
      saveCostExposures([newCost, ...costExposures]);
    }
    setIsCostModalOpen(false);
  };

  const handleDeleteCost = (id: string) => {
    assertOperationalAction("delete", "pages/Governance/RiskIssuesPage.tsx");
    saveCostExposures(costExposures.filter(c => c.id !== id));
    if (viewingCost?.id === id) setViewingCost(null);
  };

  const handleOpenAddIssue = (item?: IssueItem) => {
    if (item) {
      setEditingIssue(item);
      setIssueCode(item.code);
      setIssueTitle(item.title);
      setIssueDesc(item.description);
      setIssueSeverity(item.severity);
      setIssueStatus(item.status);
      setIssueOwner(item.owner);
      setIssueAction(item.actionRequired);
    } else {
      setEditingIssue(null);
      setIssueCode(`ISS-${(issues.length + 1).toString().padStart(2, "0")}`);
      setIssueTitle("");
      setIssueDesc("");
      setIssueSeverity("High");
      setIssueStatus("Open");
      setIssueOwner("Project Director");
      setIssueAction("");
    }
    setIsIssueModalOpen(true);
  };

  const handleSaveIssue = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Governance/RiskIssuesPage.tsx");
    e.preventDefault();
    if (editingIssue) {
      const updated = issues.map(i => i.id === editingIssue.id ? {
        ...i,
        code: issueCode,
        title: issueTitle,
        description: issueDesc,
        severity: issueSeverity,
        status: issueStatus,
        owner: issueOwner,
        actionRequired: issueAction
      } : i);
      saveIssues(updated);
    } else {
      const newIssue: IssueItem = {
        id: `iss_${Date.now()}`,
        code: issueCode,
        title: issueTitle,
        description: issueDesc,
        severity: issueSeverity,
        status: issueStatus,
        owner: issueOwner,
        actionRequired: issueAction
      };
      saveIssues([newIssue, ...issues]);
    }
    setIsIssueModalOpen(false);
  };

  const handleDeleteIssue = (id: string) => {
    assertOperationalAction("delete", "pages/Governance/RiskIssuesPage.tsx");
    saveIssues(issues.filter(i => i.id !== id));
    if (viewingIssue?.id === id) setViewingIssue(null);
  };

  const criticalPathCount = useMemo(() => {
    return earlyWarnings.filter(e => e.status === "Open" && e.criticalPath.toLowerCase().includes("yes")).length;
  }, [earlyWarnings]);

  const totalCommittedDrawdowns = useMemo(() => {
    return costExposures
      .filter(c => c.status === "Approved")
      .reduce((acc, curr) => {
        const num = parseFloat(curr.drawdownAmount.replace(/[^0-9.-]+/g, "")) || 0;
        return acc + num;
      }, 0);
  }, [costExposures]);

  const tabsConfig = [
    { id: "radar" as RiskTab, label: "Risk Radar Matrix", icon: AlertTriangle, badge: `${risks.length} Monitored` },
    { id: "early-warnings" as RiskTab, label: "Delay Early Warnings", icon: Clock, badge: `${earlyWarnings.filter(e => e.status !== "Closed").length} Open` },
    { id: "cost-exposure" as RiskTab, label: "Cost Contingency Exposure", icon: Coins, badge: `${costExposures.length} Items` },
    { id: "issues" as RiskTab, label: "Active Escalations", icon: ShieldAlert, badge: `${issues.filter(i => i.status !== "Resolved").length} Active` },
  ];

  return (
    <ProjectShell project={activeProject} section="programme">
      <div className="space-y-6 w-full">
        
        {/* Module Header Bar - Clean horizontal alignment with warning indicator and actions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#07182E] dark:text-white tracking-tight">
                Risk & Issues Radar
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono text-xs font-semibold border border-amber-200 dark:border-amber-800">
                {criticalPathCount} Critical Path Warnings
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl font-medium">
              Early warning radar, schedule critical path exposure, quantified cost contingency drawdowns, and proactive mitigation registers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {canCreate && (
              <>
                <button 
                  onClick={() => handleOpenAddRisk()}
                  className="h-9 px-3.5 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>+ Add Risk</span>
                </button>

                <button 
                  onClick={() => handleOpenAddEwn()}
                  className="h-9 px-3.5 bg-white hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>+ Log Early Warning (EWN)</span>
                </button>

                <button 
                  onClick={() => handleOpenAddIssue()}
                  className="h-9 px-3.5 bg-white hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span>+ Log Issue</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 4 Metric Cards - Directly underneath in one equal-width row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            label="Total Monitored Risks"
            value={risks.length > 0 ? `${risks.length} Registered` : "-"}
            trend={{ direction: "neutral", value: `${risks.filter(r => r.level === 'high').length} High Level`, label: "Critical" }}
            status={risks.length > 0 ? "warning" : "default"}
          />
          <MetricCard
            label="Active Early Warnings"
            value={earlyWarnings.length > 0 ? `${earlyWarnings.filter(e => e.status !== 'Closed').length} Open` : "-"}
            trend={{ direction: "neutral", value: `${criticalPathCount} on Critical Path`, label: "Exposure" }}
            status={criticalPathCount > 0 ? "critical" : "warning"}
          />
          <MetricCard
            label="Contingency Drawdown"
            value="24.5%"
            trend={{ direction: "neutral", value: "$820k / $3.35M", label: "Contingency" }}
            status="success"
          />
          <MetricCard
            label="Active Escalations"
            value={issues.length > 0 ? `${issues.filter(i => i.status !== 'Resolved').length} Active` : "-"}
            trend={{ direction: "neutral", value: `${issues.filter(i => i.severity === 'Critical').length} Critical`, label: "Escalation" }}
            status={issues.length > 0 ? "critical" : "default"}
          />
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-xs">
          <Tabs
            tabs={tabsConfig}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as RiskTab)}
          />
        </div>

        {/* TAB 1: RADAR */}
        {activeTab === "radar" && (
          <div className="space-y-6">
            <Panel
              title={`Project Risk Assessment Register (${risks.length})`}
              subtitle="Quantitative risk scoring (Probability × Impact) with assigned owners and active mitigation strategies"
              actions={
                canCreate ? (
                  <button 
                    onClick={() => handleOpenAddRisk()}
                    className="h-8 px-3 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Add Risk</span>
                  </button>
                ) : undefined
              }
            >
              {risks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No risks registered yet. Click "+ Add Risk" to create a new risk entry.
                </div>
              ) : (
                <DataTable
                  data={risks}
                  columns={[
                    { 
                      header: "Risk Code", 
                      width: "120px",
                      accessor: (row: any) => <span className="font-mono font-semibold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">{row.code}</span> 
                    },
                    { 
                      header: "Risk Title & Description", 
                      accessor: (row: any) => <span className="font-semibold text-slate-900 dark:text-white text-sm">{row.title}</span> 
                    },
                    { 
                      header: "Category", 
                      width: "130px",
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 font-medium">{row.category}</span> 
                    },
                    { 
                      header: "Probability & Impact", 
                      accessor: (row: any) => <span className="text-xs font-mono text-slate-700 dark:text-slate-300 font-medium">{row.probability} • {row.impact}</span> 
                    },
                    { 
                      header: "Risk Level", 
                      width: "130px",
                      accessor: (row: any) => <RiskIndicator level={row.level} score={row.score} /> 
                    },
                    { 
                      header: "Mitigation Strategy", 
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 max-w-xs block truncate">{row.mitigation}</span> 
                    },
                    { 
                      header: "Owner", 
                      width: "140px",
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] font-medium text-slate-800 dark:text-slate-200">{row.owner}</span> 
                    },
                    { 
                      header: "Actions", 
                      width: "110px",
                      align: "center",
                      accessor: (row: any) => (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRisk(row)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Risk"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenAddRisk(row)}
                              className="p-2 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Risk"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteRisk(row.id)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Risk"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) 
                    }
                  ]}
                />
              )}
            </Panel>
          </div>
        )}

        {/* TAB 2: EARLY WARNINGS */}
        {activeTab === "early-warnings" && (
          <div className="space-y-6">
            <Panel
              title={`Delay Early Warning Notices (EWN Register - ${earlyWarnings.length})`}
              subtitle="Schedule critical path notifications triggering collaborative risk reduction meetings before contractual delay crystallizes"
              actions={
                canCreate ? (
                  <button 
                    onClick={() => handleOpenAddEwn()}
                    className="h-8 px-3 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Raise EWN</span>
                  </button>
                ) : undefined
              }
            >
              {earlyWarnings.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No early warning notices logged yet. Click "+ Raise EWN" to log a notice.
                </div>
              ) : (
                <DataTable
                  data={earlyWarnings}
                  columns={[
                    { 
                      header: "Notice Ref", 
                      width: "120px",
                      accessor: (row: any) => <span className="font-mono font-semibold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">{row.ref}</span> 
                    },
                    { 
                      header: "Affected Critical Activity", 
                      accessor: (row: any) => <span className="font-semibold text-slate-900 dark:text-white text-sm">{row.activity}</span> 
                    },
                    { 
                      header: "Notice Date", 
                      width: "120px",
                      accessor: (row: any) => <span className="text-xs font-mono text-slate-500">{row.noticeDate}</span> 
                    },
                    { 
                      header: "Critical Path?", 
                      width: "130px",
                      accessor: (row: any) => <span className={`text-xs font-bold font-mono ${row.criticalPath?.toLowerCase().includes('yes') ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>{row.criticalPath}</span> 
                    },
                    { 
                      header: "Projected Delay", 
                      width: "130px",
                      accessor: (row: any) => <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{row.projectedDelay}</span> 
                    },
                    { 
                      header: "Action Plan", 
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 max-w-xs block truncate">{row.actionPlan}</span> 
                    },
                    { 
                      header: "Status", 
                      width: "120px",
                      accessor: (row: any) => <StatusBadge label={row.status} variant={row.status === "Open" ? "warning" : row.status === "Mitigating" ? "intelligence" : "success"} size="sm" /> 
                    },
                    {
                      header: "Actions",
                      width: "110px",
                      align: "center",
                      accessor: (row: any) => (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingEwn(row)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Early Warning"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenAddEwn(row)}
                              className="p-2 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Early Warning"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteEwn(row.id)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Early Warning"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              )}
            </Panel>
          </div>
        )}

        {/* TAB 3: COST CONTINGENCY */}
        {activeTab === "cost-exposure" && (
          <div className="space-y-6">
            <Panel
              title={`Cost Contingency Allocation & Drawdown Tracker (${costExposures.length})`}
              subtitle={`Contractually committed contingency reserves vs probable risk realizations for ${projectName}`}
              actions={
                canCreate ? (
                  <button 
                    onClick={() => handleOpenAddCost()}
                    className="h-8 px-3 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Add Cost Drawdown</span>
                  </button>
                ) : undefined
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wide">Total Contingency Cap</span>
                  <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block font-mono">$3,350,000</span>
                </div>
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[11px] font-semibold text-amber-600 block uppercase tracking-wide">Committed Drawdowns</span>
                  <span className="text-xl font-bold text-amber-600 mt-1 block font-mono">
                    ${totalCommittedDrawdowns.toLocaleString()}
                  </span>
                </div>
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[11px] font-semibold text-emerald-600 block uppercase tracking-wide">Remaining Reserve</span>
                  <span className="text-xl font-bold text-emerald-600 mt-1 block font-mono">
                    ${Math.max(0, 3350000 - totalCommittedDrawdowns).toLocaleString()}
                  </span>
                </div>
              </div>

              {costExposures.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No cost contingency drawdowns registered. Click "+ Add Cost Drawdown" to record a drawdown.
                </div>
              ) : (
                <DataTable
                  data={costExposures}
                  columns={[
                    { 
                      header: "Drawdown Ref", 
                      width: "130px",
                      accessor: (row: any) => <span className="font-mono font-semibold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">{row.ref}</span> 
                    },
                    { 
                      header: "Event Description", 
                      accessor: (row: any) => <span className="font-semibold text-slate-900 dark:text-white text-sm">{row.eventDescription}</span> 
                    },
                    { 
                      header: "Category", 
                      width: "130px",
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 font-medium">{row.category}</span> 
                    },
                    { 
                      header: "Drawdown Amount", 
                      width: "150px",
                      accessor: (row: any) => <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{row.currency} {row.drawdownAmount}</span> 
                    },
                    { 
                      header: "Risk Allocation Ref", 
                      width: "140px",
                      accessor: (row: any) => <span className="font-mono text-xs text-slate-500">{row.riskAllocationRef || "-"}</span> 
                    },
                    { 
                      header: "Authorized By", 
                      width: "130px",
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-medium">{row.authorizedBy}</span> 
                    },
                    { 
                      header: "Date", 
                      width: "110px",
                      accessor: (row: any) => <span className="font-mono text-xs text-slate-500">{row.date}</span> 
                    },
                    { 
                      header: "Status", 
                      width: "120px",
                      accessor: (row: any) => <StatusBadge label={row.status} variant={row.status === "Approved" ? "success" : row.status === "Under Review" ? "warning" : "neutral"} size="sm" /> 
                    },
                    {
                      header: "Actions",
                      width: "110px",
                      align: "center",
                      accessor: (row: any) => (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingCost(row)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Cost Drawdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenAddCost(row)}
                              className="p-2 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Cost Drawdown"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteCost(row.id)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Cost Drawdown"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              )}
            </Panel>
          </div>
        )}

        {/* TAB 4: ISSUES */}
        {activeTab === "issues" && (
          <div className="space-y-6">
            <Panel
              title={`Active Issue Escalation Ledger (${issues.length})`}
              subtitle="Critical operational roadblocks requiring senior executive intervention"
              actions={
                canCreate ? (
                  <button
                    onClick={() => handleOpenAddIssue()}
                    className="h-8 px-3 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Log Issue</span>
                  </button>
                ) : undefined
              }
            >
              {issues.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No active escalation issues logged. Click "+ Log Issue" to register a new issue.
                </div>
              ) : (
                <DataTable
                  data={issues}
                  columns={[
                    { 
                      header: "Issue Code", 
                      width: "120px",
                      accessor: (row: any) => <span className="font-mono font-semibold text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">{row.code}</span> 
                    },
                    { 
                      header: "Issue Headline", 
                      accessor: (row: any) => <span className="font-semibold text-slate-900 dark:text-white text-sm">{row.title}</span> 
                    },
                    { 
                      header: "Description & Impact", 
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 max-w-sm block truncate">{row.description}</span> 
                    },
                    { 
                      header: "Severity", 
                      width: "110px",
                      accessor: (row: any) => <StatusBadge label={row.severity} variant={row.severity === "Critical" ? "danger" : row.severity === "High" ? "warning" : "intelligence"} size="sm" /> 
                    },
                    { 
                      header: "Action Required", 
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 max-w-xs block truncate">{row.actionRequired}</span> 
                    },
                    { 
                      header: "Owner", 
                      width: "130px",
                      accessor: (row: any) => <span className="text-xs sm:text-[13px] font-medium text-slate-800 dark:text-slate-200">{row.owner}</span> 
                    },
                    { 
                      header: "Status", 
                      width: "120px",
                      accessor: (row: any) => <StatusBadge label={row.status} variant={row.status === "Resolved" ? "success" : row.status === "In Progress" ? "intelligence" : "warning"} size="sm" /> 
                    },
                    {
                      header: "Actions",
                      width: "110px",
                      align: "center",
                      accessor: (row: any) => (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingIssue(row)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Issue"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenAddIssue(row)}
                              className="p-2 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Issue"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteIssue(row.id)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Issue"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              )}
            </Panel>
          </div>
        )}

        {/* View Modal: Risk Details */}
        {viewingRisk && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Risk Details: {viewingRisk.code}
                  </h3>
                </div>
                <button onClick={() => setViewingRisk(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-500 block">Risk Title & Event</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{viewingRisk.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                  <div>
                    <span className="font-bold text-slate-500 block">Category</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{viewingRisk.category}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Risk Level / Score</span>
                    <div className="mt-1">
                      <RiskIndicator level={viewingRisk.level} score={viewingRisk.score} />
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Probability</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{viewingRisk.probability}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Impact</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{viewingRisk.impact}</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                  <span className="font-bold text-slate-500 block">Mitigation Strategy</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{viewingRisk.mitigation || "None specified"}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Assigned Owner</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{viewingRisk.owner}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewingRisk(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const item = viewingRisk;
                        setViewingRisk(null);
                        handleOpenAddRisk(item);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Risk</span>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteRisk(viewingRisk.id);
                        setViewingRisk(null);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Modal: EWN Details */}
        {viewingEwn && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Early Warning: {viewingEwn.ref}
                  </h3>
                </div>
                <button onClick={() => setViewingEwn(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-500 block">Affected Critical Activity</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{viewingEwn.activity}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                  <div>
                    <span className="font-bold text-slate-500 block">Notice Date</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{viewingEwn.noticeDate}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Status</span>
                    <div className="mt-1">
                      <StatusBadge label={viewingEwn.status} variant={viewingEwn.status === "Open" ? "warning" : viewingEwn.status === "Mitigating" ? "intelligence" : "success"} size="sm" />
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Critical Path?</span>
                    <span className={`font-bold font-mono ${viewingEwn.criticalPath?.toLowerCase().includes('yes') ? 'text-rose-600' : 'text-slate-600'}`}>{viewingEwn.criticalPath}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Projected Delay</span>
                    <span className="font-mono font-bold text-amber-600">{viewingEwn.projectedDelay}</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                  <span className="font-bold text-slate-500 block">Cause of Event / Delay</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-1">{viewingEwn.cause || "Not documented"}</p>
                </div>

                <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block">Action Plan / Risk Reduction</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{viewingEwn.actionPlan || "None specified"}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewingEwn(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const item = viewingEwn;
                        setViewingEwn(null);
                        handleOpenAddEwn(item);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Notice</span>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteEwn(viewingEwn.id);
                        setViewingEwn(null);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Modal: Cost Exposure Details */}
        {viewingCost && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-blue-500" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Cost Drawdown: {viewingCost.ref}
                  </h3>
                </div>
                <button onClick={() => setViewingCost(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-500 block">Event Description</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{viewingCost.eventDescription}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                  <div>
                    <span className="font-bold text-slate-500 block">Drawdown Amount</span>
                    <span className="font-mono font-bold text-base text-slate-900 dark:text-white">{viewingCost.currency} {viewingCost.drawdownAmount}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Status</span>
                    <div className="mt-1">
                      <StatusBadge label={viewingCost.status} variant={viewingCost.status === "Approved" ? "success" : viewingCost.status === "Under Review" ? "warning" : "neutral"} size="sm" />
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Category</span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">{viewingCost.category}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Risk Allocation Ref</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{viewingCost.riskAllocationRef || "-"}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Authorized By</span>
                    <span className="text-slate-800 dark:text-slate-200">{viewingCost.authorizedBy}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Date</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{viewingCost.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewingCost(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const item = viewingCost;
                        setViewingCost(null);
                        handleOpenAddCost(item);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Drawdown</span>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteCost(viewingCost.id);
                        setViewingCost(null);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Modal: Issue Details */}
        {viewingIssue && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Issue Escalation: {viewingIssue.code}
                  </h3>
                </div>
                <button onClick={() => setViewingIssue(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-500 block">Issue Headline</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{viewingIssue.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                  <div>
                    <span className="font-bold text-slate-500 block">Severity</span>
                    <div className="mt-1">
                      <StatusBadge label={viewingIssue.severity} variant={viewingIssue.severity === "Critical" ? "danger" : viewingIssue.severity === "High" ? "warning" : "intelligence"} size="sm" />
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">Status</span>
                    <div className="mt-1">
                      <StatusBadge label={viewingIssue.status} variant={viewingIssue.status === "Resolved" ? "success" : viewingIssue.status === "In Progress" ? "intelligence" : "warning"} size="sm" />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold text-slate-500 block">Assigned Owner</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{viewingIssue.owner}</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                  <span className="font-bold text-slate-500 block">Description & Impact</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{viewingIssue.description || "None specified"}</p>
                </div>

                <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block">Action Required</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{viewingIssue.actionRequired || "None specified"}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewingIssue(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const item = viewingIssue;
                        setViewingIssue(null);
                        handleOpenAddIssue(item);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Issue</span>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteIssue(viewingIssue.id);
                        setViewingIssue(null);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add/Edit Cost Exposure */}
        {isCostModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingCost ? "Edit Cost Drawdown Record" : "Record Cost Contingency Drawdown"}
                </h3>
                <button onClick={() => setIsCostModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCost} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Drawdown Ref #</label>
                    <input
                      type="text"
                      required
                      value={costRef}
                      onChange={e => setCostRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                    <select
                      value={costCategory}
                      onChange={e => setCostCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Geotechnical">Geotechnical</option>
                      <option value="Environmental">Environmental</option>
                      <option value="Supply Chain">Supply Chain</option>
                      <option value="Engineering & Design">Engineering & Design</option>
                      <option value="Contractual Compensation">Contractual Compensation</option>
                      <option value="General Contingency">General Contingency</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Event Description</label>
                  <input
                    type="text"
                    required
                    value={costDescription}
                    onChange={e => setCostDescription(e.target.value)}
                    placeholder="e.g. Abutment Ground Treatment Grouting"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Drawdown Amount</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs">
                        {costCurrency}
                      </span>
                      <input
                        type="text"
                        required
                        value={costAmount}
                        onChange={e => setCostAmount(e.target.value)}
                        placeholder="475,000"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select
                      value={costStatus}
                      onChange={e => setCostStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Approved">Approved</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Forecast">Forecast</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Risk Allocation Ref</label>
                    <input
                      type="text"
                      value={costRiskRef}
                      onChange={e => setCostRiskRef(e.target.value)}
                      placeholder="e.g. RSK-GEO-004"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Effective Date</label>
                    <input
                      type="text"
                      value={costDate}
                      onChange={e => setCostDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Authorized By</label>
                  <input
                    type="text"
                    value={costAuthorizedBy}
                    onChange={e => setCostAuthorizedBy(e.target.value)}
                    placeholder="e.g. Commercial Director"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCostModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl"
                  >
                    Save Drawdown
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add/Edit Risk */}
        {isRiskModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingRisk ? "Edit Risk Record" : "Register New Risk Record"}
                </h3>
                <button onClick={() => setIsRiskModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRisk} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Risk Code</label>
                    <input
                      type="text"
                      required
                      value={riskCode}
                      onChange={e => setRiskCode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                    <select
                      value={riskCategory}
                      onChange={e => setRiskCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Geotechnical">Geotechnical</option>
                      <option value="Supply Chain">Supply Chain</option>
                      <option value="Commercial Cashflow">Commercial Cashflow</option>
                      <option value="Environmental">Environmental</option>
                      <option value="Engineering & Design">Engineering & Design</option>
                      <option value="Labour & Industrial">Labour & Industrial</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Risk Title & Event Description</label>
                  <input
                    type="text"
                    required
                    value={riskTitle}
                    onChange={e => setRiskTitle(e.target.value)}
                    placeholder="e.g. Unforeseen rock hardness during foundation drilling"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Probability</label>
                    <input
                      type="text"
                      value={riskProbability}
                      onChange={e => setRiskProbability(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Impact</label>
                    <input
                      type="text"
                      value={riskImpact}
                      onChange={e => setRiskImpact(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Level</label>
                    <select
                      value={riskLevel}
                      onChange={e => setRiskLevel(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mitigation Strategy</label>
                  <textarea
                    rows={2}
                    value={riskMitigation}
                    onChange={e => setRiskMitigation(e.target.value)}
                    placeholder="Specific engineering, contractual, or commercial actions taken..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Owner</label>
                  <input
                    type="text"
                    value={riskOwner}
                    onChange={e => setRiskOwner(e.target.value)}
                    placeholder="e.g. Chief Geotechnical Engineer"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRiskModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl"
                  >
                    Save Risk
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add/Edit EWN */}
        {isEwnModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingEwn ? "Edit Early Warning Notice" : "Raise Delay Early Warning (EWN)"}
                </h3>
                <button onClick={() => setIsEwnModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEwn} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notice Ref</label>
                    <input
                      type="text"
                      required
                      value={ewnRef}
                      onChange={e => setEwnRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notice Date</label>
                    <input
                      type="text"
                      value={ewnDate}
                      onChange={e => setEwnDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Affected Activity</label>
                  <input
                    type="text"
                    required
                    value={ewnActivity}
                    onChange={e => setEwnActivity(e.target.value)}
                    placeholder="e.g. Act 1040: Pier 3 Concrete Pour"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Critical Path?</label>
                    <input
                      type="text"
                      value={ewnCriticalPath}
                      onChange={e => setEwnCriticalPath(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Projected Delay</label>
                    <input
                      type="text"
                      value={ewnDelay}
                      onChange={e => setEwnDelay(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select
                      value={ewnStatus}
                      onChange={e => setEwnStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Open">Open</option>
                      <option value="Mitigating">Mitigating</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cause of Delay / Event</label>
                  <input
                    type="text"
                    value={ewnCause}
                    onChange={e => setEwnCause(e.target.value)}
                    placeholder="e.g. Cement delivery delay due to border customs backlog"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mitigation / Action Plan</label>
                  <textarea
                    rows={2}
                    value={ewnActionPlan}
                    onChange={e => setEwnActionPlan(e.target.value)}
                    placeholder="Agreed risk reduction action plan..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEwnModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-xl"
                  >
                    Save Notice
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add/Edit Issue */}
        {isIssueModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingIssue ? "Edit Escalation Issue" : "Log Active Escalation Issue"}
                </h3>
                <button onClick={() => setIsIssueModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveIssue} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Code</label>
                    <input
                      type="text"
                      required
                      value={issueCode}
                      onChange={e => setIssueCode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Severity</label>
                    <select
                      value={issueSeverity}
                      onChange={e => setIssueSeverity(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Headline</label>
                  <input
                    type="text"
                    required
                    value={issueTitle}
                    onChange={e => setIssueTitle(e.target.value)}
                    placeholder="e.g. Municipal Power Line Relocation Delay"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description & Impact</label>
                  <textarea
                    rows={2}
                    value={issueDesc}
                    onChange={e => setIssueDesc(e.target.value)}
                    placeholder="Detailed explanation of the roadblock..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Action Required</label>
                    <input
                      type="text"
                      value={issueAction}
                      onChange={e => setIssueAction(e.target.value)}
                      placeholder="e.g. Executive ministerial letter"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Owner</label>
                    <input
                      type="text"
                      value={issueOwner}
                      onChange={e => setIssueOwner(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsIssueModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl"
                  >
                    Save Issue
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </ProjectShell>
  );
}
