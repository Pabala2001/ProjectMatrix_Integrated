import { assertOperationalAction } from "../../../integration/operationalAccess";
import React, { useState, useMemo, useEffect } from "react";
import {
  Upload,
  Plus,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Info,
  Download,
  MoreHorizontal,
  Compass,
  ArrowLeftRight,
  ShoppingCart,
  Target,
  FileCheck,
  Paperclip,
  Eye,
  Trash2,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  X
} from "lucide-react";
import {
  BudgetLineItem,
  ForecastLineItem,
  SourceProvenance,
  BudgetVersionRecord,
  CommercialSupportingDocument
} from "../../../types/commercialWorkspace";
import { formatCurrency as formatCentralCurrency, formatCompactCurrency as formatCentralCompactCurrency } from "../../../utils/currency";
import { CommercialSupportingDocumentsDrawer } from "../CommercialSupportingDocumentsDrawer";
import { CommercialRecordModal } from "../CommercialRecordModal";
import { CommercialRowActions } from "../CommercialRowActions";
import { CommercialRecordDetailModal } from "../CommercialRecordDetailModal";
import { CommercialWorkspaceService } from "../../../services/commercialWorkspaceService";

interface CommercialBudgetForecastViewProps {
  budgets: BudgetLineItem[];
  forecasts: ForecastLineItem[];
  currency: string;
  projectId?: string;
  companyId?: string;
  onOpenUpload: (category?: "BUDGET" | "FORECAST") => void;
  onInspectSource: (title: string, value: any, source?: SourceProvenance, fieldName?: string) => void;
  onAddBudgetLine?: (line: Partial<BudgetLineItem>) => void;
  onRefreshData?: () => void;
}

export const CommercialBudgetForecastView: React.FC<CommercialBudgetForecastViewProps> = ({
  budgets,
  forecasts,
  currency = "USD",
  projectId,
  companyId = "default_company",
  onOpenUpload,
  onInspectSource,
  onAddBudgetLine,
  onRefreshData
}) => {
  // Navigation sub-tabs
  const [activeTab, setActiveTab] = useState<"Budget" | "Forecast" | "Budget Changes" | "Budget Versions">("Budget");
  
  // Real budget versions loaded from persistent store
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersionRecord[]>([]);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [newVersionForm, setNewVersionForm] = useState({
    version: "",
    description: "",
    status: "Current" as "Current" | "Superseded" | "Draft",
    effectiveDate: new Date().toISOString().split("T")[0],
    originalBudget: "",
    revisedBudget: ""
  });

  // Load Budget Versions strictly scoped to company and project
  useEffect(() => {
    let active = true;
    CommercialWorkspaceService.getBudgetVersions(companyId, projectId).then((versions) => {
      if (active) setBudgetVersions(versions);
    });
    return () => {
      active = false;
    };
  }, [companyId, projectId]);

  // Filter controls
  const [costStructureFilter, setCostStructureFilter] = useState("All Cost Codes");
  const [wbsFilter, setWbsFilter] = useState("All");
  const [contractFilter, setContractFilter] = useState("Main Contract");
  const [selectedVersion, setSelectedVersion] = useState("All Versions");
  const [viewMode, setViewMode] = useState<"Summary" | "Detailed">("Summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Selected for View / Detail
  const [selectedBudget, setSelectedBudget] = useState<BudgetLineItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal State for Add / Edit
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetLineItem | null>(null);

  // Document Drawer State
  const [activeDocRecord, setActiveDocRecord] = useState<{
    id?: string;
    title: string;
    ref?: string;
    docs: CommercialSupportingDocument[];
  } | null>(null);

  // Actions Handlers
  const handleAddNew = () => {
    assertOperationalAction("create", "components/commercial/views/CommercialBudgetForecastView.tsx");
    setEditingBudget(null);
    setIsRecordModalOpen(true);
  };

  const handleEdit = (item: BudgetLineItem) => {
    setEditingBudget(item);
    setIsRecordModalOpen(true);
  };

  const handleView = (item: BudgetLineItem) => {
    setSelectedBudget(item);
    setIsDetailOpen(true);
  };

  const handleSaveRecord = async (formData: any) => {
    assertOperationalAction("write", "components/commercial/views/CommercialBudgetForecastView.tsx");
    const origBudget = Number(formData.net ?? formData.total ?? formData.originalBudget ?? 0);
    const qty = formData.quantity ? Number(formData.quantity) : (editingBudget?.quantity ?? editingBudget?.originalQuantity ?? 1);
    const rt = formData.rate ? Number(formData.rate) : (editingBudget?.rate ?? editingBudget?.originalRate ?? origBudget);
    const itemToSave: BudgetLineItem = {
      id: editingBudget?.id || `bg-${Date.now()}`,
      companyId: companyId || "default_company",
      projectId: projectId || "all",
      currency: currency || "USD",
      costCode: formData.costCode || editingBudget?.costCode || "01.00",
      description: formData.description || editingBudget?.description || "General Line Item",
      wbsCode: formData.costCode || editingBudget?.wbsCode || "WBS-1",
      section: editingBudget?.section || "Preliminaries",
      quantity: qty,
      originalQuantity: qty,
      unit: formData.unit || editingBudget?.unit || "ls",
      rate: rt,
      originalRate: rt,
      originalBudget: origBudget,
      approvedChanges: formData.approvedChanges !== undefined && formData.approvedChanges !== "" ? Number(formData.approvedChanges) : (editingBudget?.approvedChanges ?? 0),
      revisedBudget: origBudget + (formData.approvedChanges !== undefined && formData.approvedChanges !== "" ? Number(formData.approvedChanges) : (editingBudget?.approvedChanges ?? 0)),
      notes: formData.notes ?? undefined,
      documents: formData.documents ?? editingBudget?.documents ?? [],
      source: {
        originalFilename: "Manual Entry",
        uploadDate: new Date().toISOString(),
        uploadedBy: "Authorized User",
        importStatus: "MANUAL_ENTRY",
        approvalStatus: "APPROVED"
      }
    };

    await CommercialWorkspaceService.saveBudgetLine(companyId, projectId, itemToSave);
    setIsRecordModalOpen(false);
    setEditingBudget(null);
    if (onRefreshData) onRefreshData();
  };

  const handleDelete = async (costCode: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialBudgetForecastView.tsx");
    await CommercialWorkspaceService.deleteBudgetLine(companyId, projectId, costCode);
    if (selectedBudget?.costCode === costCode) {
      setIsDetailOpen(false);
      setSelectedBudget(null);
    }
    if (onRefreshData) onRefreshData();
  };

  const handleManageAttachments = (item: BudgetLineItem) => {
    setActiveDocRecord({
      id: item.costCode,
      title: `${item.costCode} - ${item.description}`,
      ref: item.costCode,
      docs: item.documents || []
    });
  };

  const handleAddAttachment = async (newDoc: CommercialSupportingDocument) => {
    assertOperationalAction("create", "components/commercial/views/CommercialBudgetForecastView.tsx");
    if (!activeDocRecord || !activeDocRecord.ref) return;
    await CommercialWorkspaceService.addAttachmentToRecord(
      companyId,
      projectId,
      "BUDGET",
      activeDocRecord.ref,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: [...prev.docs, newDoc] } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteAttachment = async (docId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialBudgetForecastView.tsx");
    if (!activeDocRecord || !activeDocRecord.ref) return;
    await CommercialWorkspaceService.deleteAttachmentFromRecord(
      companyId,
      projectId,
      "BUDGET",
      activeDocRecord.ref,
      docId
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: prev.docs.filter((d) => d.id !== docId) } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleReplaceAttachment = async (docId: string, newDoc: CommercialSupportingDocument) => {
    if (!activeDocRecord || !activeDocRecord.ref) return;
    await CommercialWorkspaceService.replaceAttachmentInRecord(
      companyId,
      projectId,
      "BUDGET",
      activeDocRecord.ref,
      docId,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: prev.docs.map((d) => (d.id === docId ? newDoc : d)) } : null));
    if (onRefreshData) onRefreshData();
  };

  // Full Currency Formatter for detailed tables and tooltips
  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return formatCentralCurrency(val, currency);
  };

  // Compact Financial Currency Formatter for KPI summary cards
  const formatCompactCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return formatCentralCompactCurrency(val, currency);
  };

  const formatShortAmount = (val: number | null | undefined) => {
    return formatCompactCurrency(val);
  };

  // Toggle row expansion
  const toggleRow = (code: string) => {
    setExpandedRows((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  // Strict project-level filtering: budget.projectId === projectId
  const projectBudgets = useMemo(() => {
    if (!projectId || projectId === "ALL" || projectId === "all") return budgets;
    return budgets.filter((b) => b.projectId === projectId);
  }, [budgets, projectId]);

  const projectForecasts = useMemo(() => {
    if (!projectId || projectId === "ALL" || projectId === "all") return forecasts;
    return forecasts.filter((f) => f.projectId === projectId);
  }, [forecasts, projectId]);

  // Compute verified totals strictly from user-persisted records
  const totalOriginal = useMemo(() => {
    if (projectBudgets.length === 0) return null;
    const hasAny = projectBudgets.some((b) => b.originalBudget !== null && b.originalBudget !== undefined);
    if (!hasAny) return null;
    return projectBudgets.reduce((acc, b) => acc + (b.originalBudget ?? 0), 0);
  }, [projectBudgets]);

  const totalChanges = useMemo(() => {
    if (projectBudgets.length === 0) return null;
    const hasAny = projectBudgets.some((b) => b.approvedChanges !== null && b.approvedChanges !== undefined);
    if (!hasAny) return null;
    return projectBudgets.reduce((acc, b) => acc + (b.approvedChanges ?? 0), 0);
  }, [projectBudgets]);

  const totalRevised = useMemo(() => {
    if (projectBudgets.length === 0) return null;
    const hasAny = projectBudgets.some(
      (b) =>
        (b.revisedBudget !== null && b.revisedBudget !== undefined) ||
        (b.originalBudget !== null && b.originalBudget !== undefined)
    );
    if (!hasAny) return null;
    return projectBudgets.reduce(
      (acc, b) => acc + (b.revisedBudget ?? ((b.originalBudget ?? 0) + (b.approvedChanges ?? 0))),
      0
    );
  }, [projectBudgets]);

  const totalActual = useMemo(() => {
    if (projectForecasts.length === 0 && projectBudgets.length === 0) return null;
    const fcActuals = projectForecasts.filter((f) => f.actualCost !== null && f.actualCost !== undefined);
    if (fcActuals.length > 0) {
      return fcActuals.reduce((acc, f) => acc + (f.actualCost ?? 0), 0);
    }
    const bgActuals = projectBudgets.filter((b) => b.actualCost !== null && b.actualCost !== undefined);
    if (bgActuals.length > 0) {
      return bgActuals.reduce((acc, b) => acc + (b.actualCost ?? 0), 0);
    }
    return null;
  }, [projectForecasts, projectBudgets]);

  const totalCommitments = useMemo(() => {
    if (projectForecasts.length === 0) return null;
    const fcCommits = projectForecasts.filter((f) => f.commitments !== null && f.commitments !== undefined);
    if (fcCommits.length === 0) return null;
    return fcCommits.reduce((acc, f) => acc + (f.commitments ?? 0), 0);
  }, [projectForecasts]);

  const totalForecastFinal = useMemo(() => {
    if (projectForecasts.length === 0 && projectBudgets.length === 0) return null;
    const fcFinals = projectForecasts.filter((f) => f.forecastFinalCost !== null && f.forecastFinalCost !== undefined);
    if (fcFinals.length > 0) {
      return fcFinals.reduce((acc, f) => acc + (f.forecastFinalCost ?? 0), 0);
    }
    const bgFinals = projectBudgets.filter((b) => b.forecastFinalCost !== null && b.forecastFinalCost !== undefined);
    if (bgFinals.length > 0) {
      return bgFinals.reduce((acc, b) => acc + (b.forecastFinalCost ?? 0), 0);
    }
    return null;
  }, [projectForecasts, projectBudgets]);

  const overallVariance =
    totalRevised !== null && totalForecastFinal !== null ? totalRevised - totalForecastFinal : null;

  // Percentage Calculations for KPI Cards
  const changesPct = totalOriginal && totalChanges !== null ? (totalChanges / totalOriginal) * 100 : null;
  const revisedPct = totalOriginal && totalRevised !== null ? (totalRevised / totalOriginal) * 100 : null;
  const commitPct = totalRevised && totalCommitments !== null ? (totalCommitments / totalRevised) * 100 : null;
  const actualPct = totalRevised && totalActual !== null ? (totalActual / totalRevised) * 100 : null;
  const forecastPct = totalOriginal && totalForecastFinal !== null ? (totalForecastFinal / totalOriginal) * 100 : null;

  // Combine Budget & Forecast Lines for the Table
  const tableData = useMemo(() => {
    return projectBudgets.map((b) => {
      const fc = projectForecasts.find((f) => f.costCode === b.costCode);
      const act = fc?.actualCost ?? b.actualCost ?? null;
      const ffc = fc?.forecastFinalCost ?? b.forecastFinalCost ?? null;
      const rev =
        b.revisedBudget ??
        (b.originalBudget !== null && b.originalBudget !== undefined
          ? b.originalBudget + (b.approvedChanges ?? 0)
          : null);
      const vari = rev !== null && ffc !== null ? rev - ffc : null;

      return {
        ...b,
        actualCost: act,
        forecastFinalCost: ffc,
        variance: vari
      };
    });
  }, [projectBudgets, projectForecasts]);

  // Dynamic filter lists derived strictly from saved records
  const costCodeOptions = useMemo(() => {
    const set = new Set<string>();
    projectBudgets.forEach((b) => {
      if (b.costCode) {
        const prefix = b.costCode.split(".")[0] || b.costCode.slice(0, 2);
        if (prefix) set.add(prefix);
      }
    });
    return Array.from(set).sort();
  }, [projectBudgets]);

  const wbsOptions = useMemo(() => {
    const set = new Set<string>();
    projectBudgets.forEach((b) => {
      if (b.wbsCode) set.add(b.wbsCode);
      if (b.wbs) set.add(b.wbs);
    });
    return Array.from(set).sort();
  }, [projectBudgets]);

  const filteredData = useMemo(() => {
    return tableData.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = item.costCode.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (costStructureFilter !== "All Cost Codes") {
        if (!item.costCode.startsWith(costStructureFilter)) return false;
      }
      if (wbsFilter !== "All") {
        if (item.wbsCode !== wbsFilter && item.wbs !== wbsFilter) return false;
      }
      return true;
    });
  }, [tableData, searchQuery, costStructureFilter, wbsFilter]);

  // Color palette for charts
  const chartColors = [
    "#3b82f6", // Blue
    "#06b6d4", // Cyan
    "#10b981", // Emerald
    "#8b5cf6", // Purple
    "#f59e0b", // Amber
    "#f97316", // Orange
    "#ec4899", // Pink
    "#64748b", // Slate
    "#14b8a6", // Teal
    "#6366f1"  // Indigo
  ];

  // Chart 1 items and dynamic max value calculation
  const chart1Items = useMemo(() => {
    return filteredData.filter((item) => {
      const rev = item.revisedBudget ?? ((item.originalBudget ?? 0) + (item.approvedChanges ?? 0));
      const act = item.actualCost ?? 0;
      return (rev !== null && rev > 0) || (act !== null && act > 0);
    });
  }, [filteredData]);

  const maxValChart1 = useMemo(() => {
    if (chart1Items.length === 0) return 0;
    let max = 0;
    chart1Items.forEach((item) => {
      const rev = item.revisedBudget ?? ((item.originalBudget ?? 0) + (item.approvedChanges ?? 0));
      const act = item.actualCost ?? 0;
      if (rev > max) max = rev;
      if (act > max) max = act;
    });
    return max > 0 ? max * 1.15 : 0;
  }, [chart1Items]);

  // Chart 2 segments calculated from actual stored budget lines
  const breakdownSegments = useMemo(() => {
    if (!totalRevised || totalRevised <= 0) return [];
    const validItems = filteredData.filter((item) => {
      const rev = item.revisedBudget ?? ((item.originalBudget ?? 0) + (item.approvedChanges ?? 0));
      return rev !== null && rev > 0;
    });

    const circumference = 2 * Math.PI * 38; // ~238.761
    let cumulativeDash = 0;

    return validItems.slice(0, 8).map((item, idx) => {
      const rev = item.revisedBudget ?? ((item.originalBudget ?? 0) + (item.approvedChanges ?? 0));
      const fraction = rev / totalRevised;
      const dashLength = fraction * circumference;
      const gapLength = circumference - dashLength;
      const offset = -cumulativeDash;
      cumulativeDash += dashLength;

      return {
        item,
        color: chartColors[idx % chartColors.length],
        percentage: (fraction * 100).toFixed(1),
        dashArray: `${dashLength.toFixed(2)} ${gapLength.toFixed(2)}`,
        dashOffset: offset.toFixed(2)
      };
    });
  }, [filteredData, totalRevised]);

  // Save Budget Version handler
  const handleSaveBudgetVersion = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/commercial/views/CommercialBudgetForecastView.tsx");
    e.preventDefault();
    const orig = newVersionForm.originalBudget !== "" ? Number(newVersionForm.originalBudget) : totalOriginal;
    const rev = newVersionForm.revisedBudget !== "" ? Number(newVersionForm.revisedBudget) : totalRevised;
    const versionRecord: BudgetVersionRecord = {
      id: `bv-${Date.now()}`,
      companyId,
      projectId: projectId || "all",
      version: newVersionForm.version || `BV-${String(budgetVersions.length + 1).padStart(2, "0")}`,
      description: newVersionForm.description || "Project Budget Baseline",
      status: newVersionForm.status,
      effectiveDate: newVersionForm.effectiveDate || new Date().toISOString().split("T")[0],
      originalBudget: orig,
      revisedBudget: rev,
      createdBy: "Authorized User",
      createdOn: new Date().toISOString().split("T")[0],
      documentsCount: 0,
      documents: []
    };

    const updated = await CommercialWorkspaceService.saveBudgetVersion(companyId, projectId, versionRecord);
    setBudgetVersions(updated);
    setIsVersionModalOpen(false);
    setNewVersionForm({
      version: "",
      description: "",
      status: "Current",
      effectiveDate: new Date().toISOString().split("T")[0],
      originalBudget: "",
      revisedBudget: ""
    });
  };

  return (
    <div className="controls-page-container overflow-hidden max-w-full space-y-6">
      
      {/* 1. SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
            <span>Commercial</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 dark:text-white font-bold">Budget & Forecast</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Budget & Forecast
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage budgets, approved changes and forecast costs.
          </p>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenUpload("BUDGET")}
            className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            Upload Budget
          </button>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            Add New Budget Item
          </button>
          <button
            onClick={() => setIsVersionModalOpen(true)}
            className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Create Budget Version Snapshot"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            New Version
          </button>
        </div>
      </div>

      {/* 2. SUB-TABS STRIP */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {(["Budget", "Forecast", "Budget Changes", "Budget Versions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3.5 transition-all cursor-pointer relative ${
              activeTab === tab
                ? "text-amber-600 dark:text-amber-500 font-extrabold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 3. 6 RESTRICTED ENTERPRISE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* 1. Original Budget */}
        <div
          onClick={() => onInspectSource("Original Budget", totalOriginal, projectBudgets[0]?.source, "originalBudget")}
          title={totalOriginal !== null ? `Original Budget: ${formatCurrency(totalOriginal)}` : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 block truncate">Original Budget</span>
            <span
              title={totalOriginal !== null ? formatCurrency(totalOriginal) : undefined}
              className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5 tracking-tight whitespace-nowrap overflow-visible"
            >
              {formatCompactCurrency(totalOriginal)}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
              {totalOriginal !== null ? "100%" : "—"}
            </span>
          </div>
        </div>

        {/* 2. Approved Changes */}
        <div
          onClick={() => onInspectSource("Approved Changes", totalChanges, projectBudgets[0]?.source, "approvedChanges")}
          title={totalChanges !== null ? `Approved Changes: ${formatCurrency(totalChanges)}` : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-amber-400 transition-all cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 block truncate">Approved Changes</span>
            <span
              title={totalChanges !== null ? formatCurrency(totalChanges) : undefined}
              className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5 tracking-tight whitespace-nowrap overflow-visible"
            >
              {formatCompactCurrency(totalChanges)}
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
              {changesPct !== null ? `${changesPct.toFixed(2)}%` : "—"}
            </span>
          </div>
        </div>

        {/* 3. Revised Budget */}
        <div
          onClick={() => onInspectSource("Revised Budget", totalRevised, projectBudgets[0]?.source, "revisedBudget")}
          title={totalRevised !== null ? `Revised Budget: ${formatCurrency(totalRevised)}` : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 block truncate">Revised Budget</span>
            <span
              title={totalRevised !== null ? formatCurrency(totalRevised) : undefined}
              className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5 tracking-tight whitespace-nowrap overflow-visible"
            >
              {formatCompactCurrency(totalRevised)}
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
              {revisedPct !== null ? `${revisedPct.toFixed(2)}%` : "—"}
            </span>
          </div>
        </div>

        {/* 4. Commitments */}
        <div
          onClick={() => onInspectSource("Commitments", totalCommitments, projectForecasts[0]?.source, "commitments")}
          title={totalCommitments !== null ? `Commitments: ${formatCurrency(totalCommitments)}` : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 block truncate">Commitments</span>
            <span
              title={totalCommitments !== null ? formatCurrency(totalCommitments) : undefined}
              className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5 tracking-tight whitespace-nowrap overflow-visible"
            >
              {formatCompactCurrency(totalCommitments)}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {commitPct !== null ? `${commitPct.toFixed(2)}%` : "—"}
            </span>
          </div>
        </div>

        {/* 5. Actual Cost */}
        <div
          onClick={() => onInspectSource("Actual Cost", totalActual, projectForecasts[0]?.source, "actualCost")}
          title={totalActual !== null ? `Actual Cost: ${formatCurrency(totalActual)}` : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-orange-400 transition-all cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 block truncate">Actual Cost</span>
            <span
              title={totalActual !== null ? formatCurrency(totalActual) : undefined}
              className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5 tracking-tight whitespace-nowrap overflow-visible"
            >
              {formatCompactCurrency(totalActual)}
            </span>
            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 block mt-0.5">
              {actualPct !== null ? `${actualPct.toFixed(2)}%` : "—"}
            </span>
          </div>
        </div>

        {/* 6. Forecast Final Cost */}
        <div
          onClick={() => onInspectSource("Forecast Final Cost", totalForecastFinal, projectForecasts[0]?.source, "forecastFinalCost")}
          title={totalForecastFinal !== null ? `Forecast Final Cost: ${formatCurrency(totalForecastFinal)}` : undefined}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-indigo-400 transition-all cursor-pointer flex items-center gap-3.5"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 block truncate">Forecast Final Cost</span>
            <span
              title={totalForecastFinal !== null ? formatCurrency(totalForecastFinal) : undefined}
              className="text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5 tracking-tight whitespace-nowrap overflow-visible"
            >
              {formatCompactCurrency(totalForecastFinal)}
            </span>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5">
              {forecastPct !== null ? `${forecastPct.toFixed(2)}%` : "—"}
            </span>
          </div>
        </div>

      </div>

      {/* 4. FILTER / CONTROL BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Cost Structure Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="text-[11px] text-slate-400 font-medium">Cost Structure</span>
            <select
              value={costStructureFilter}
              onChange={(e) => setCostStructureFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="All Cost Codes">All Cost Codes</option>
              {costCodeOptions.map((code, idx) => (
                <option key={`${code}-${idx}`} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          {/* WBS Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="text-[11px] text-slate-400 font-medium">WBS</span>
            <select
              value={wbsFilter}
              onChange={(e) => setWbsFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="All">All</option>
              {wbsOptions.map((opt, idx) => (
                <option key={`${opt}-${idx}`} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Contract Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="text-[11px] text-slate-400 font-medium">Contract</span>
            <select
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="Main Contract">Main Contract</option>
              <option value="Variation 01">Variation 01 Package</option>
            </select>
          </div>

          {/* Budget Version Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="text-[11px] text-slate-400 font-medium">Budget Version</span>
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="All Versions">All Versions</option>
              {budgetVersions.map((bv) => (
                <option key={bv.id} value={bv.version}>
                  {bv.version} ({bv.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Toggle & Reset */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setViewMode("Summary")}
              className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                viewMode === "Summary"
                  ? "bg-slate-900 text-white shadow-2xs dark:bg-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode("Detailed")}
              className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                viewMode === "Detailed"
                  ? "bg-slate-900 text-white shadow-2xs dark:bg-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Detailed
            </button>
          </div>

          <button
            onClick={() => {
              setCostStructureFilter("All Cost Codes");
              setWbsFilter("All");
              setSelectedVersion("All Versions");
              setSearchQuery("");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Reset
          </button>
        </div>
      </div>

      {/* 5. MAIN 2-COLUMN LAYOUT: TABLE (65%) + CHARTS (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: BUDGET SUMMARY TABLE (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            {/* Table Header Controls */}
            <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Budget Summary by Cost Code
                </h3>
                <span title="Values verified from approved budget schedule">
                  <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 flex items-center gap-1 cursor-pointer">
                  <Layers className="w-3 h-3 text-slate-500" />
                  Columns
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 flex items-center gap-1 cursor-pointer">
                  <Download className="w-3 h-3 text-slate-500" />
                  Export
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    <th className="py-2.5 px-2 w-8 text-center"></th>
                    <th className="py-2.5 px-3 w-28">Cost Code</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Description</th>
                    <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Original Budget</th>
                    <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Approved Changes</th>
                    <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Revised Budget</th>
                    <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Actual Cost</th>
                    <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Forecast Final Cost</th>
                    <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Variance</th>
                    <th className="py-2.5 px-3 text-center w-20 whitespace-nowrap">Evidence</th>
                    <th className="py-2.5 px-3 text-right w-36 min-w-[140px] whitespace-nowrap overflow-visible">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
                        No verified budget records available for this project.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row) => {
                      const isExpanded = !!expandedRows[row.costCode];
                      const isNegativeVariance = row.variance !== null && row.variance < 0;

                      return (
                        <React.Fragment key={row.id || row.costCode}>
                          <tr
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                            onClick={() => handleView(row)}
                          >
                            <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => toggleRow(row.costCode)}
                                className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {row.costCode}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white truncate" title={row.description}>
                              {row.description}
                            </td>
                            <td
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectSource(
                                  `${row.costCode} Original Budget`,
                                  row.originalBudget,
                                  row.source,
                                  "originalBudget"
                                );
                              }}
                              title={row.originalBudget !== null && row.originalBudget !== undefined ? formatCurrency(row.originalBudget) : undefined}
                              className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300 hover:text-amber-600 cursor-pointer whitespace-nowrap"
                            >
                              {formatCurrency(row.originalBudget)}
                            </td>
                            <td
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectSource(
                                  `${row.costCode} Approved Changes`,
                                  row.approvedChanges,
                                  row.source,
                                  "approvedChanges"
                                );
                              }}
                              title={row.approvedChanges !== null && row.approvedChanges !== undefined ? formatCurrency(row.approvedChanges) : undefined}
                              className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300 hover:text-amber-600 cursor-pointer whitespace-nowrap"
                            >
                              {formatCurrency(row.approvedChanges)}
                            </td>
                            <td
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectSource(
                                  `${row.costCode} Revised Budget`,
                                  row.revisedBudget,
                                  row.source,
                                  "revisedBudget"
                                );
                              }}
                              title={row.revisedBudget !== null && row.revisedBudget !== undefined ? formatCurrency(row.revisedBudget) : undefined}
                              className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white hover:text-amber-600 cursor-pointer whitespace-nowrap"
                            >
                              {formatCurrency(row.revisedBudget)}
                            </td>
                            <td
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectSource(
                                  `${row.costCode} Actual Cost`,
                                  row.actualCost,
                                  row.source,
                                  "actualCost"
                                );
                              }}
                              title={row.actualCost !== null && row.actualCost !== undefined ? formatCurrency(row.actualCost) : undefined}
                              className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300 hover:text-amber-600 cursor-pointer whitespace-nowrap"
                            >
                              {formatCurrency(row.actualCost)}
                            </td>
                            <td
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectSource(
                                  `${row.costCode} Forecast Final Cost`,
                                  row.forecastFinalCost,
                                  row.source,
                                  "forecastFinalCost"
                                );
                              }}
                              title={row.forecastFinalCost !== null && row.forecastFinalCost !== undefined ? formatCurrency(row.forecastFinalCost) : undefined}
                              className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300 hover:text-amber-600 cursor-pointer whitespace-nowrap"
                            >
                              {formatCurrency(row.forecastFinalCost)}
                            </td>
                            <td
                              title={
                                row.variance !== null && row.variance !== undefined
                                  ? isNegativeVariance
                                    ? `Variance: (${formatCurrency(Math.abs(row.variance))})`
                                    : `Variance: ${formatCurrency(row.variance)}`
                                  : undefined
                              }
                              className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                                isNegativeVariance
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {row.variance !== null
                                ? isNegativeVariance
                                  ? `(${formatCurrency(Math.abs(row.variance))})`
                                  : formatCurrency(row.variance)
                                : "—"}
                            </td>
                            <td
                              className="py-2.5 px-3 text-center whitespace-nowrap"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleManageAttachments(row);
                              }}
                            >
                              <button className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                <Paperclip className="w-3 h-3 text-amber-600" />
                                <span>{row.documents?.length || 0}</span>
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap overflow-visible" onClick={(e) => e.stopPropagation()}>
                              <CommercialRowActions
                                onView={() => handleView(row)}
                                onEdit={() => handleEdit(row)}
                                onDelete={() => handleDelete(row.costCode)}
                                onManageAttachments={() => handleManageAttachments(row)}
                                recordTitle={`Budget Line ${row.costCode}`}
                              />
                            </td>
                          </tr>

                          {/* Expandable Line Detail Breakdown */}
                          {isExpanded && (
                            <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                              <td colSpan={11} className="p-4 pl-10">
                                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                        Line-Item Details
                                      </span>
                                    </div>
                                    <button
                                      onClick={() =>
                                        setActiveDocRecord({
                                          title: `${row.costCode} - ${row.description}`,
                                          ref: row.costCode,
                                          docs: row.documents || []
                                        })
                                      }
                                      className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Paperclip className="w-3.5 h-3.5" />
                                      Supporting Evidence ({row.documents?.length || 0})
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-4 gap-3 text-[11px] pt-1">
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                      <span className="text-slate-400 block text-[10px]">Source Reference</span>
                                      <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {row.source?.originalFilename || "Verified User Record"}
                                      </span>
                                    </div>
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                      <span className="text-slate-400 block text-[10px]">Unit / Rate Basis</span>
                                      <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {row.unit ? `${row.quantity ?? 1} ${row.unit} @ ${formatCurrency(row.rate)}` : "Verified User Entry"}
                                      </span>
                                    </div>
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                      <span className="text-slate-400 block text-[10px]">Commitment Coverage</span>
                                      <span className="font-bold text-emerald-600">
                                        {row.actualCost !== null && row.actualCost !== undefined && row.revisedBudget
                                          ? `${((row.actualCost / row.revisedBudget) * 100).toFixed(1)}% Posted`
                                          : row.actualCost !== null && row.actualCost !== undefined
                                          ? `${formatCurrency(row.actualCost)} Posted`
                                          : "No actuals"}
                                      </span>
                                    </div>
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                      <span className="text-slate-400 block text-[10px]">Approval Status</span>
                                      <span className="font-bold text-blue-600">
                                        {row.source?.approvalStatus || "APPROVED"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>

                {/* Total Summary Row */}
                {filteredData.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                      <td className="py-3 px-2"></td>
                      <td className="py-3 px-3">Total</td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap" title={totalOriginal !== null ? formatCurrency(totalOriginal) : undefined}>{formatCurrency(totalOriginal)}</td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap" title={totalChanges !== null ? formatCurrency(totalChanges) : undefined}>{formatCurrency(totalChanges)}</td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap" title={totalRevised !== null ? formatCurrency(totalRevised) : undefined}>{formatCurrency(totalRevised)}</td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap" title={totalActual !== null ? formatCurrency(totalActual) : undefined}>{formatCurrency(totalActual)}</td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap" title={totalForecastFinal !== null ? formatCurrency(totalForecastFinal) : undefined}>{formatCurrency(totalForecastFinal)}</td>
                      <td
                        title={overallVariance !== null ? (overallVariance < 0 ? `(${formatCurrency(Math.abs(overallVariance))})` : formatCurrency(overallVariance)) : undefined}
                        className={`py-3 px-3 text-right font-mono whitespace-nowrap ${
                          overallVariance !== null && overallVariance < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {overallVariance !== null
                          ? overallVariance < 0
                            ? `(${formatCurrency(Math.abs(overallVariance))})`
                            : formatCurrency(overallVariance)
                          : "—"}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing 1 to {filteredData.length} of {tableData.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-40">
                &lt;
              </button>
              <span className="px-2.5 py-1 bg-slate-900 text-white font-bold rounded-md">1</span>
              <button className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-40">
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ANALYTICAL CHARTS (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Chart 1: Budget vs Actual Horizontal Bar Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Budget vs Actual
                </h3>
                <Info className="w-3 h-3 text-slate-400" />
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#1e3a8a]" />
                  <span className="text-slate-600 dark:text-slate-400">Revised Budget</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#f59e0b]" />
                  <span className="text-slate-600 dark:text-slate-400">Actual Cost</span>
                </div>
              </div>
            </div>

            {/* Horizontal comparative bars strictly from real records */}
            {chart1Items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No budget vs actual records available for this project.
              </div>
            ) : (
              <div className="space-y-2.5 pt-2">
                {chart1Items.slice(0, 8).map((item) => {
                  const rev = item.revisedBudget ?? ((item.originalBudget ?? 0) + (item.approvedChanges ?? 0));
                  const revWidth = maxValChart1 > 0 && rev !== null ? Math.min(100, Math.max(0, (rev / maxValChart1) * 100)) : 0;
                  const act = item.actualCost;
                  const actWidth = maxValChart1 > 0 && act !== null ? Math.min(100, Math.max(0, (act / maxValChart1) * 100)) : 0;

                  return (
                    <div key={item.costCode} className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span className="truncate max-w-[180px]">{item.costCode} - {item.description}</span>
                      </div>
                      {/* Revised Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#1e3a8a] h-full rounded-full transition-all duration-300"
                          style={{ width: `${revWidth}%` }}
                        />
                      </div>
                      {/* Actual Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#f59e0b] h-full rounded-full transition-all duration-300"
                          style={{ width: `${actWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span>0</span>
                  <span>{formatShortAmount(maxValChart1 * 0.25)}</span>
                  <span>{formatShortAmount(maxValChart1 * 0.5)}</span>
                  <span>{formatShortAmount(maxValChart1 * 0.75)}</span>
                  <span>{formatShortAmount(maxValChart1)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Chart 2: Budget Breakdown Doughnut Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Budget Breakdown
            </h3>

            {breakdownSegments.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="currentColor"
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="14"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-sm font-extrabold text-slate-400 dark:text-slate-500">
                      -
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">No Budget Data</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                {/* Real Dynamic Doughnut SVG */}
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {breakdownSegments.map((seg, idx) => (
                      <circle
                        key={seg.item.costCode || idx}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {formatShortAmount(totalRevised)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">Revised Budget</span>
                  </div>
                </div>

                {/* Legend with real calculated percentages */}
                <div className="flex-1 space-y-1.5 text-[10px]">
                  {breakdownSegments.map((seg) => (
                    <div key={seg.item.costCode} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="text-slate-700 dark:text-slate-300 truncate">{seg.item.description || seg.item.costCode}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-500 shrink-0">{seg.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 6. BOTTOM CARD: BUDGET VERSIONS TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Budget Versions
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {budgetVersions.length} records
            </span>
          </div>
          <button
            onClick={() => setIsVersionModalOpen(true)}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Version
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-4 w-24 overflow-hidden text-ellipsis truncate">Version</th>
                <th className="py-2.5 px-4 min-w-[180px] overflow-hidden text-ellipsis truncate">Description</th>
                <th className="py-2.5 px-4 w-24 overflow-hidden text-ellipsis truncate">Status</th>
                <th className="py-2.5 px-4 w-28 overflow-hidden text-ellipsis truncate">Effective Date</th>
                <th className="py-2.5 px-4 text-right w-28 overflow-hidden text-ellipsis truncate">Original Budget</th>
                <th className="py-2.5 px-4 text-right w-28 overflow-hidden text-ellipsis truncate">Revised Budget</th>
                <th className="py-2.5 px-4 w-28 overflow-hidden text-ellipsis truncate">Created By</th>
                <th className="py-2.5 px-4 w-28 overflow-hidden text-ellipsis truncate">Created On</th>
                <th className="py-2.5 px-4 text-center w-24 overflow-hidden text-ellipsis truncate">Documents</th>
                <th className="py-2.5 px-4 text-center w-24 overflow-hidden text-ellipsis truncate">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {budgetVersions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs truncate overflow-hidden">
                    No budget versions recorded for this project.
                  </td>
                </tr>
              ) : (
                budgetVersions.map((bv) => (
                  <tr key={bv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white truncate overflow-hidden">{bv.version}</td>
                    <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300 truncate overflow-hidden" title={bv.description}>{bv.description}</td>
                    <td className="py-3 px-4 truncate overflow-hidden">
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                          bv.status === "Current"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {bv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px] truncate overflow-hidden">
                      {bv.effectiveDate || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300 truncate overflow-hidden">
                      {formatCurrency(bv.originalBudget)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white truncate overflow-hidden">
                      {formatCurrency(bv.revisedBudget)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium truncate overflow-hidden">{bv.createdBy || "—"}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] truncate overflow-hidden">{bv.createdOn || "—"}</td>
                    <td className="py-3 px-4 text-center truncate overflow-hidden">
                      <button
                        onClick={() =>
                          setActiveDocRecord({
                            title: `Budget Version ${bv.version} Package`,
                            ref: bv.version,
                            docs: bv.documents || []
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        {bv.documents?.length ?? bv.documentsCount ?? 0}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={async () => {
                          const updated = await CommercialWorkspaceService.deleteBudgetVersion(companyId, projectId, bv.id);
                          setBudgetVersions(updated);
                        }}
                        className="w-8 h-8 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                        title="Delete Version"
                        aria-label="Delete Version"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. STANDARD RECORD MODAL */}
      <CommercialRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingBudget(null);
        }}
        recordType="BUDGET"
        mode={editingBudget ? "EDIT" : "CREATE"}
        initialData={editingBudget ? {
          costCode: editingBudget.costCode,
          description: editingBudget.description,
          quantity: editingBudget.originalQuantity,
          unit: editingBudget.unit,
          rate: editingBudget.originalRate,
          net: editingBudget.originalBudget,
          total: editingBudget.originalBudget,
          notes: editingBudget.notes,
          documents: editingBudget.documents
        } : undefined}
        currency={currency}
        onSave={handleSaveRecord}
      />

      {/* 8. STANDARD RECORD DETAIL MODAL */}
      {selectedBudget && (
        <CommercialRecordDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedBudget(null);
          }}
          recordType="BUDGET"
          record={selectedBudget}
          currency={currency}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedBudget);
          }}
          onDelete={() => handleDelete(selectedBudget.costCode)}
          onManageAttachments={() => {
            setIsDetailOpen(false);
            handleManageAttachments(selectedBudget);
          }}
        />
      )}

      {/* 9. UNIVERSAL SUPPORTING DOCUMENTS DRAWER */}
      {activeDocRecord && (
        <CommercialSupportingDocumentsDrawer
          isOpen={!!activeDocRecord}
          onClose={() => setActiveDocRecord(null)}
          recordTitle={activeDocRecord.title}
          recordRef={activeDocRecord.ref}
          documents={activeDocRecord.docs}
          onAddDocument={handleAddAttachment}
          onDeleteDocument={handleDeleteAttachment}
          onReplaceDocument={handleReplaceAttachment}
        />
      )}

      {/* 10. CREATE BUDGET VERSION MODAL */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create Budget Version
              </h3>
              <button
                onClick={() => setIsVersionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBudgetVersion} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Version Identifier
                </label>
                <input
                  type="text"
                  placeholder={`BV-${String(budgetVersions.length + 1).padStart(2, "0")}`}
                  value={newVersionForm.version}
                  onChange={(e) => setNewVersionForm((prev) => ({ ...prev, version: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved Contract Baseline"
                  value={newVersionForm.description}
                  onChange={(e) => setNewVersionForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={newVersionForm.status}
                    onChange={(e) =>
                      setNewVersionForm((prev) => ({
                        ...prev,
                        status: e.target.value as "Current" | "Superseded" | "Draft"
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="Current">Current</option>
                    <option value="Draft">Draft</option>
                    <option value="Superseded">Superseded</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={newVersionForm.effectiveDate}
                    onChange={(e) => setNewVersionForm((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Original Budget ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={totalOriginal !== null ? String(totalOriginal) : "0.00"}
                    value={newVersionForm.originalBudget}
                    onChange={(e) => setNewVersionForm((prev) => ({ ...prev, originalBudget: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Revised Budget ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={totalRevised !== null ? String(totalRevised) : "0.00"}
                    value={newVersionForm.revisedBudget}
                    onChange={(e) => setNewVersionForm((prev) => ({ ...prev, revisedBudget: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVersionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Save Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
