import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { 
  Sparkles, 
  RefreshCw, 
  Globe, 
  Layers, 
  Compass, 
  Building2, 
  Clock, 
  ShieldAlert, 
  ChevronRight, 
  ArrowUpRight, 
  TrendingUp, 
  FileSpreadsheet, 
  CheckCircle2, 
  Calendar, 
  Languages, 
  Activity, 
  Milestone, 
  DollarSign, 
  LayoutGrid, 
  Briefcase,
  MapPin,
  ChevronDown,
  Download,
  StickyNote,
  Plus,
  Edit3,
  Trash2,
  X
} from "lucide-react";
import { ProjectService } from "../../services/projectService";
import PortfolioKpiStrip from "../../components/dashboard/PortfolioKpiStrip";
import PortfolioHealthCard from "../../components/dashboard/PortfolioHealthCard";
import RequiresAttentionTable from "../../components/dashboard/RequiresAttentionTable";
import ProjectsOperationalTable from "../../components/dashboard/ProjectsOperationalTable";
import ProjectRiskRadarCard from "../../components/dashboard/ProjectRiskRadarCard";
import UpcomingMilestonesCard from "../../components/dashboard/UpcomingMilestonesCard";
import ProjectLocationMapCard from "../../components/dashboard/ProjectLocationMapCard";
import CashFlowForecastCard from "../../components/dashboard/CashFlowForecastCard";
import MatrixMultilingualStudio from "../../components/multilingual/MatrixMultilingualStudio";
import { SupportedCurrency } from "../../config/currencies";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { formatCompactCurrency } from "../../utils/currency";
import { getProjectRealContractValue, getProjectRealProgress, resolveProjectCoordinates, getProjectRealAttentionItems } from "../../utils/projectDataUtils";
import { exportObjectsToCsv, exportRowsToCsv, CsvColumn } from "../../utils/csvExport";

type ExplorationTab = "OVERVIEW" | "HEALTH" | "EXCEPTIONS" | "PROJECTS" | "MAP" | "CASHFLOW";

export default function DashboardPage() {
  const { activeProject, activeCompany, allProjects = [], onProjectChange } = useOutletContext<any>() || {};
  const navigate = useNavigate();
  const { currencyCode: globalCurrencyCode, setCurrencyCode } = useRegionalSettings();

  const selectedCurrency = (globalCurrencyCode || activeProject?.currency_code || activeProject?.currency || "TZS") as SupportedCurrency;

  const [activeTab, setActiveTab] = useState<ExplorationTab>("OVERVIEW");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>("Live");
  const [showMultilingualStudio, setShowMultilingualStudio] = useState<boolean>(false);

  const realContractVal = getProjectRealContractValue(activeProject, activeCompany?.id);
  const realProgress = getProjectRealProgress(activeProject);
  const projectCoords = resolveProjectCoordinates(activeProject);

  // Quick Note / Temporary Status Update state
  const currentQuickNote = useMemo(() => {
    if (!activeProject) return "";
    const directNote = activeProject.quick_note || activeProject.quickNote || activeProject.temporary_status_update || activeProject.temporaryStatusUpdate;
    if (directNote && typeof directNote === "string") {
      return directNote.trim();
    }
    if (activeProject.id) {
      try {
        const raw = previewStorage.getItem(`pm_project_quicknote_${activeProject.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return (parsed.note || "").trim();
        }
      } catch (e) {}
    }
    return "";
  }, [activeProject]);

  const currentQuickNoteTime = useMemo(() => {
    if (!activeProject) return "";
    const directTime = activeProject.quick_note_updated_at || activeProject.quickNoteUpdatedAt;
    if (directTime && typeof directTime === "string") {
      return directTime;
    }
    if (activeProject.id) {
      try {
        const raw = previewStorage.getItem(`pm_project_quicknote_${activeProject.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.updatedAt || "";
        }
      } catch (e) {}
    }
    return "";
  }, [activeProject]);

  const [isEditingQuickNote, setIsEditingQuickNote] = useState<boolean>(false);
  const [quickNoteInput, setQuickNoteInput] = useState<string>("");
  const [isSavingQuickNote, setIsSavingQuickNote] = useState<boolean>(false);
  const [quickNoteNotice, setQuickNoteNotice] = useState<string | null>(null);

  useEffect(() => {
    setQuickNoteInput(currentQuickNote);
    setIsEditingQuickNote(false);
  }, [activeProject?.id, currentQuickNote]);

  const handleSaveQuickNote = async () => {
    assertOperationalAction("write", "pages/Dashboard/DashboardPage.tsx");
    if (!activeProject?.id) return;
    setIsSavingQuickNote(true);
    try {
      const trimmed = quickNoteInput.trim();
      const timestamp = new Date().toISOString();
      const companyId = activeCompany?.id || activeProject?.company_id || activeProject?.organisation_id || "default_company";

      const updates = {
        quick_note: trimmed,
        quickNote: trimmed,
        temporary_status_update: trimmed,
        temporaryStatusUpdate: trimmed,
        quick_note_updated_at: timestamp,
        quickNoteUpdatedAt: timestamp
      };

      // 1. Direct local storage key cache for this project
      try {
        if (trimmed) {
          previewStorage.setItem(`pm_project_quicknote_${activeProject.id}`, JSON.stringify({ note: trimmed, updatedAt: timestamp }));
        } else {
          previewStorage.removeItem(`pm_project_quicknote_${activeProject.id}`);
        }
      } catch (e) {}

      // 2. Persist in ProjectService cache
      try {
        await ProjectService.updateProject(activeProject.id, companyId, updates);
      } catch (e) {
        console.warn("ProjectService update warning:", e);
      }

      // 3. Update active project in parent context via onProjectChange
      const updatedProject = {
        ...activeProject,
        ...updates
      };
      if (onProjectChange) {
        onProjectChange(updatedProject);
      }

      setIsEditingQuickNote(false);
      setQuickNoteNotice(trimmed ? "Saved locally to project" : "Quick note removed");
      setTimeout(() => setQuickNoteNotice(null), 3000);
    } catch (err) {
      console.error("Error saving quick note:", err);
      setQuickNoteNotice("Failed to save note");
      setTimeout(() => setQuickNoteNotice(null), 3000);
    } finally {
      setIsSavingQuickNote(false);
    }
  };

  const handleClearQuickNote = async () => {
    if (!activeProject?.id) return;
    setIsSavingQuickNote(true);
    try {
      const companyId = activeCompany?.id || activeProject?.company_id || activeProject?.organisation_id || "default_company";
      const updates = {
        quick_note: "",
        quickNote: "",
        temporary_status_update: "",
        temporaryStatusUpdate: "",
        quick_note_updated_at: "",
        quickNoteUpdatedAt: ""
      };

      try {
        previewStorage.removeItem(`pm_project_quicknote_${activeProject.id}`);
      } catch (e) {}

      try {
        await ProjectService.updateProject(activeProject.id, companyId, updates);
      } catch (e) {}

      const updatedProject = {
        ...activeProject,
        ...updates
      };
      if (onProjectChange) {
        onProjectChange(updatedProject);
      }
      setQuickNoteInput("");
      setIsEditingQuickNote(false);
      setQuickNoteNotice("Note cleared");
      setTimeout(() => setQuickNoteNotice(null), 3000);
    } catch (err) {
      console.error("Error clearing quick note:", err);
    } finally {
      setIsSavingQuickNote(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      setLastRefreshedTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setIsRefreshing(false);
    }, 500);
  };

  const handleKpiFilterSelect = (filterId: string | null) => {
    if (!filterId) {
      setActiveTab("OVERVIEW");
      return;
    }
    switch (filterId) {
      case "value":
      case "progress":
      case "schedule_variance":
        setActiveTab("HEALTH");
        break;
      case "attention":
        setActiveTab("EXCEPTIONS");
        break;
      case "milestones":
        setActiveTab("OVERVIEW");
        break;
      default:
        setActiveTab("OVERVIEW");
    }
  };

  const getActiveViewLabel = (): string => {
    switch (activeTab) {
      case "OVERVIEW": return "Project Overview";
      case "HEALTH": return "Cost & EVM Trends";
      case "EXCEPTIONS": return "Requires Attention Items";
      case "PROJECTS": return "Projects Register";
      case "MAP": return "Project GIS Locations";
      case "CASHFLOW": return "Cash Flow Forecast";
      default: return "Projects View";
    }
  };

  const handleExportCsv = () => {
    assertOperationalAction("export", "pages/Dashboard/DashboardPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";

    switch (activeTab) {
      case "OVERVIEW": {
        const headers = ["Section", "Field", "Value", "Notes / Unit"];
        const rows: (string | number)[][] = [
          ["Project Identification", "Project Name", activeProject?.name || "Project Overview", "-"],
          ["Project Identification", "Project Code", prjCode, "-"],
          ["Project Identification", "Client Organization", activeProject?.client || activeProject?.client_organization || "-", "-"],
          ["Project Identification", "Contract Framework", activeProject?.contract_agreement_option || activeProject?.contract_type || "NEC4 / FIDIC", "-"],
          ["Project Identification", "Site Location", activeProject?.execution_location || activeProject?.location || "-", "-"],
          ["Project Identification", "Operational Status", activeProject?.status || "Active Execution", "-"],
          ["Financial & Commercial", "Currency", selectedCurrency, "-"],
          ["Financial & Commercial", "Contract Value", realContractVal || 0, selectedCurrency],
          ["Financial & Commercial", "Physical Measured Progress", `${realProgress}%`, "Percent Completed"],
          ["Telemetry & EVM", "SPI (Schedule Performance Index)", activeProject?.spi ?? 0.98, "Baseline 1.00"],
          ["Telemetry & EVM", "CPI (Cost Performance Index)", activeProject?.cpi ?? 0.96, "Baseline 1.00"],
          ["Telemetry & EVM", "Start Date", activeProject?.start_date || activeProject?.startDate || "-", "-"],
          ["Telemetry & EVM", "Contract Completion Date", activeProject?.end_date || activeProject?.endDate || "-", "-"]
        ];

        const attentionItems = getProjectRealAttentionItems(activeProject, activeCompany?.id);
        if (attentionItems.length > 0) {
          attentionItems.forEach((att, idx) => {
            rows.push(["Requires Attention Item", `Item #${idx + 1} (${att.type})`, att.issue, `Impact: ${att.impact} | Due: ${att.dueDate} | Status: ${att.status}`]);
          });
        }

        exportRowsToCsv(`Project_Overview_${prjCode}_${timestamp}`, headers, rows);
        break;
      }

      case "HEALTH": {
        const headers = ["Period / Milestone", "Planned Value (PV)", "Earned Value (EV)", "Actual Cost (AC)", "Cost Variance (CV)", "Schedule Variance (SV)", "CPI", "SPI", "Currency"];
        const rows = [
          ["Mobilization & Site Establishment", Math.round(realContractVal * 0.15), Math.round(realContractVal * 0.15), Math.round(realContractVal * 0.14), Math.round(realContractVal * 0.01), 0, 1.07, 1.00, selectedCurrency],
          ["Substructure & Earthworks", Math.round(realContractVal * 0.35), Math.round(realContractVal * 0.32), Math.round(realContractVal * 0.34), Math.round(-realContractVal * 0.02), Math.round(-realContractVal * 0.03), 0.94, 0.91, selectedCurrency],
          ["Structural Works & Pavement", Math.round(realContractVal * 0.60), Math.round(realContractVal * 0.55), Math.round(realContractVal * 0.57), Math.round(-realContractVal * 0.02), Math.round(-realContractVal * 0.05), 0.96, 0.92, selectedCurrency],
          ["Current Measured Baseline", Math.round(realContractVal * (realProgress / 100)), Math.round(realContractVal * (realProgress / 100)), Math.round(realContractVal * (realProgress / 100) * 1.04), Math.round(-realContractVal * (realProgress / 100) * 0.04), 0, 0.96, 0.98, selectedCurrency]
        ];
        exportRowsToCsv(`Project_EVM_Health_${prjCode}_${timestamp}`, headers, rows);
        break;
      }

      case "EXCEPTIONS": {
        const attentionItems = getProjectRealAttentionItems(activeProject, activeCompany?.id);
        const columns: CsvColumn[] = [
          { key: "projectCode", label: "Project Code" },
          { key: "project", label: "Project Name" },
          { key: "type", label: "Category" },
          { key: "issue", label: "Exception / Issue" },
          { key: "impact", label: "Potential Impact" },
          { key: "dueDate", label: "Due Date" },
          { key: "status", label: "Severity / Status" },
        ];
        exportObjectsToCsv(`Project_Attention_Exceptions_${prjCode}_${timestamp}`, columns, attentionItems);
        break;
      }

      case "PROJECTS": {
        const columns: CsvColumn[] = [
          { key: "code", label: "Project Code" },
          { key: "name", label: "Project Name" },
          { key: "client", label: "Client" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status" },
          { key: "progress_percent", label: "Progress %", formatter: (v: any, row: any) => row.progress_percent ?? row.physical_progress ?? row.progressPercent ?? 0 },
          { key: "value_rate", label: "Contract Value", formatter: (v: any, row: any) => row.value_rate || row.award_value_zar || row.budget || 0 },
          { key: "currency_code", label: "Currency", formatter: (v: any, row: any) => row.currency_code || row.currency || "TZS" },
          { key: "contract_type", label: "Framework", formatter: (v: any, row: any) => row.contract_agreement_option || row.contract_type || "FIDIC Red Book" },
          { key: "owner", label: "Project Lead", formatter: (v: any, row: any) => row.project_director || row.owner || "Project Lead" },
        ];
        exportObjectsToCsv(`Projects_Register_${timestamp}`, columns, allProjects.length > 0 ? allProjects : [activeProject].filter(Boolean));
        break;
      }

      case "MAP": {
        const columns: CsvColumn[] = [
          { key: "code", label: "Project Code" },
          { key: "name", label: "Project Name" },
          { key: "client", label: "Client" },
          { key: "execution_location", label: "Location", formatter: (v: any, r: any) => r.execution_location || r.location || "-" },
          { key: "latitude", label: "Latitude", formatter: (v: any, r: any) => resolveProjectCoordinates(r)?.lat ?? "-" },
          { key: "longitude", label: "Longitude", formatter: (v: any, r: any) => resolveProjectCoordinates(r)?.lng ?? "-" },
          { key: "status", label: "Status" },
          { key: "progress", label: "Progress %", formatter: (v: any, r: any) => getProjectRealProgress(r) }
        ];
        exportObjectsToCsv(`Projects_Spatial_Locations_${timestamp}`, columns, allProjects.length > 0 ? allProjects : [activeProject].filter(Boolean));
        break;
      }

      case "CASHFLOW": {
        const headers = ["Month / Period", "Planned Inflow", "Planned Outflow", "Net Cash Flow", "Cumulative Position", "Currency"];
        const monthlyVal = realContractVal > 0 ? realContractVal / 12 : 50_000_000;
        const rows = [
          ["Month 1", Math.round(monthlyVal * 0.8), Math.round(monthlyVal * 0.9), Math.round(monthlyVal * -0.1), Math.round(monthlyVal * -0.1), selectedCurrency],
          ["Month 2", Math.round(monthlyVal * 1.1), Math.round(monthlyVal * 0.95), Math.round(monthlyVal * 0.15), Math.round(monthlyVal * 0.05), selectedCurrency],
          ["Month 3", Math.round(monthlyVal * 1.2), Math.round(monthlyVal * 1.05), Math.round(monthlyVal * 0.15), Math.round(monthlyVal * 0.20), selectedCurrency],
          ["Month 4", Math.round(monthlyVal * 1.3), Math.round(monthlyVal * 1.1), Math.round(monthlyVal * 0.2), Math.round(monthlyVal * 0.40), selectedCurrency],
          ["Month 5", Math.round(monthlyVal * 1.25), Math.round(monthlyVal * 1.15), Math.round(monthlyVal * 0.1), Math.round(monthlyVal * 0.50), selectedCurrency],
          ["Month 6", Math.round(monthlyVal * 1.4), Math.round(monthlyVal * 1.2), Math.round(monthlyVal * 0.2), Math.round(monthlyVal * 0.70), selectedCurrency]
        ];
        exportRowsToCsv(`Project_CashFlow_Forecast_${prjCode}_${timestamp}`, headers, rows);
        break;
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16" id="project-overview-dashboard">
      
      {/* 1. PROJECT OVERVIEW EXECUTIVE HEADER */}
      <div className="bg-white dark:bg-[#0B172A] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            {/* Top metadata tags */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-[11px] font-mono">
                {activeProject?.code || activeProject?.contract_code || "PRJ"}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {activeProject?.status || "Active Execution"}
              </span>
              <span className="text-slate-400 dark:text-slate-600">&bull;</span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {activeProject?.client || activeProject?.client_organization || "Client Organisation"}
              </span>
              {activeProject?.execution_location && (
                <>
                  <span className="text-slate-400 dark:text-slate-600">&bull;</span>
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    {activeProject.execution_location}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {activeProject?.name || "Project Overview"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl">
              Contract Framework: <strong className="text-slate-700 dark:text-slate-200">{activeProject?.contract_agreement_option || activeProject?.contract_type || "NEC4 / FIDIC"}</strong> &bull; 
              Contract Value: <strong className="font-mono text-slate-800 dark:text-white">{realContractVal > 0 ? formatCompactCurrency(realContractVal, selectedCurrency) : "-"}</strong> &bull; 
              Measured Progress: <strong className="font-mono text-blue-600 dark:text-blue-400">{realProgress}%</strong>
            </p>
          </div>

          {/* Quick Controls & Project Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Project Switcher Dropdown */}
            {Array.isArray(allProjects) && allProjects.length > 1 && (
              <div className="relative">
                <select
                  value={activeProject?.id || ""}
                  onChange={(e) => {
                    const found = allProjects.find((p) => p.id === e.target.value);
                    if (found && onProjectChange) {
                      onProjectChange(found);
                    }
                  }}
                  className="pl-3 pr-8 py-1.5 bg-[#F7F8FA] dark:bg-slate-800 hover:bg-slate-100 text-[#172033] dark:text-white font-semibold text-xs rounded-xl border border-[#E6E9EF] dark:border-slate-700 appearance-none cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `[${p.code}] ` : ""}{p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}

            {/* Matrix Multilingual */}
            <button
              onClick={() => setShowMultilingualStudio(!showMultilingualStudio)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F8FA] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-semibold text-xs rounded-xl transition-all border border-[#E6E9EF] dark:border-slate-700 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-blue-500" />
              <span>{showMultilingualStudio ? "Close Multilingual" : "Multilingual"}</span>
            </button>

            {/* Ask Advisor */}
            <button
              onClick={() => navigate(`/project-advisor?prompt=Provide%20comprehensive%20status%20audit%20and%20delay%20mitigation%20for%20${encodeURIComponent(activeProject?.name || "current project")}`)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 fill-white" />
              <span>Ask Advisor</span>
            </button>

            {/* Export View CSV Button */}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F8FA] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-semibold text-xs rounded-xl transition-all border border-[#E6E9EF] dark:border-slate-700 cursor-pointer shadow-2xs"
              title={`Export current view (${getActiveViewLabel()}) data as CSV for reporting`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleRefresh}
              className="p-2 bg-[#F7F8FA] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-[#E6E9EF] dark:border-slate-700 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-500" : ""}`} />
            </button>
          </div>
        </div>

        {/* QUICK NOTE / TEMPORARY STATUS UPDATE SECTION */}
        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800">
          {isEditingQuickNote ? (
            <div className="p-3.5 bg-amber-50/50 dark:bg-slate-900/60 rounded-xl border border-amber-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#172033] dark:text-white">
                  <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Add Quick Note &bull; Temporary Status Update</span>
                </div>
                <span className="text-[11px] text-[#667085] dark:text-slate-400">
                  Saves locally to project object
                </span>
              </div>
              <textarea
                id="input-quick-note"
                value={quickNoteInput}
                onChange={(e) => setQuickNoteInput(e.target.value)}
                placeholder="Enter temporary status update, site restriction, weather impact, or quick note for this project..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSaveQuickNote();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-[#667085] dark:text-slate-400">
                  Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono">Ctrl+Enter</kbd> to save
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickNoteInput(currentQuickNote);
                      setIsEditingQuickNote(false);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="btn-save-quick-note"
                    onClick={handleSaveQuickNote}
                    disabled={isSavingQuickNote}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs whitespace-nowrap disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isSavingQuickNote ? "Saving..." : "Save Note"}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : currentQuickNote ? (
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span className="p-1.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg shrink-0 mt-0.5 border border-amber-200 dark:border-amber-800">
                  <StickyNote className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                      Temporary Status Update
                    </span>
                    {currentQuickNoteTime && (
                      <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                        &bull; {new Date(currentQuickNoteTime).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
                      Project Object
                    </span>
                    {quickNoteNotice && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-fadeIn">
                        {quickNoteNotice}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed break-words font-medium">
                    {currentQuickNote}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  id="btn-edit-quick-note"
                  onClick={() => {
                    setQuickNoteInput(currentQuickNote);
                    setIsEditingQuickNote(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold border border-amber-200 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                >
                  <Edit3 className="w-3 h-3 text-slate-500" />
                  <span>Edit Note</span>
                </button>
                <button
                  type="button"
                  id="btn-clear-quick-note"
                  onClick={handleClearQuickNote}
                  disabled={isSavingQuickNote}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-xs font-semibold border border-amber-200 dark:border-slate-700 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Clear temporary status update"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                <StickyNote className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Temporary Status Updates: No active temporary notes recorded on this project.</span>
                {quickNoteNotice && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                    {quickNoteNotice}
                  </span>
                )}
              </div>
              <button
                type="button"
                id="btn-add-quick-note"
                onClick={() => setIsEditingQuickNote(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shadow-2xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Add Quick Note</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. OPTIONAL MULTILINGUAL STUDIO DRAWER */}
      {showMultilingualStudio && (
        <div className="animate-fadeIn">
          <MatrixMultilingualStudio />
        </div>
      )}

      {/* 3. TAB NAVIGATION & VIEW SELECTOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-[#07182E] p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 px-0.5">
          {[
            { id: "OVERVIEW", label: "Project Overview", icon: LayoutGrid },
            { id: "HEALTH", label: "Cost & EVM Trends", icon: Activity },
            { id: "EXCEPTIONS", label: "Requires Attention", icon: ShieldAlert },
            { id: "PROJECTS", label: "Projects Register", icon: Briefcase },
            { id: "MAP", label: "Project Location Map", icon: Globe },
            { id: "CASHFLOW", label: "Cash-Flow Forecast", icon: DollarSign }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ExplorationTab)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-400 dark:text-blue-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap"
            title={`Export ${getActiveViewLabel()} to CSV`}
          >
            <Download className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Export View</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN TAB CONTENTS WITH BALANCED CARD ALIGNMENTS */}
      <div className="space-y-6">
        
        {/* OVERVIEW TAB */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6">
            {/* Real Project KPI Telemetry Strip */}
            <PortfolioKpiStrip
              activeProject={activeProject}
              allProjects={allProjects}
              activeCompany={activeCompany}
              selectedCurrency={selectedCurrency}
              onCurrencyChange={setCurrencyCode}
              onSelectFilter={handleKpiFilterSelect}
            />

            {/* Top Row: EVM Health (7 cols) + Risk Radar (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-w-0">
              <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-7 flex flex-col min-w-0">
                <PortfolioHealthCard
                  activeProject={activeProject}
                  allProjects={allProjects}
                  activeCompany={activeCompany}
                  selectedCurrency={selectedCurrency}
                  onOpenAdvisor={() => navigate(`/project-advisor?prompt=Analyze%20schedule%20and%20cost%20variance%20for%20${encodeURIComponent(activeProject?.name || "project")}`)}
                  className="h-full"
                />
              </div>
              <div className="lg:col-span-5 xl:col-span-5 2xl:col-span-5 flex flex-col min-w-0">
                <ProjectRiskRadarCard
                  activeProject={activeProject}
                  allProjects={allProjects}
                  activeCompany={activeCompany}
                  selectedCurrency={selectedCurrency}
                  className="h-full"
                />
              </div>
            </div>

            {/* Middle Row: Live Project Location & Satellite GIS Map */}
            <div className="min-w-0">
              <ProjectLocationMapCard
                activeProject={activeProject}
                allProjects={allProjects}
                activeCompany={activeCompany}
                onProjectChange={onProjectChange}
              />
            </div>

            {/* Bottom Row: Requires Attention (7 cols) + Upcoming Milestones (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-w-0">
              <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-7 flex flex-col min-w-0">
                <RequiresAttentionTable
                  activeProject={activeProject}
                  allProjects={allProjects}
                  activeCompany={activeCompany}
                  className="h-full"
                />
              </div>
              <div className="lg:col-span-5 xl:col-span-5 2xl:col-span-5 flex flex-col min-w-0">
                <UpcomingMilestonesCard
                  activeProject={activeProject}
                  allProjects={allProjects}
                  activeCompany={activeCompany}
                  onMilestoneSelect={() => navigate("/programme")}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* HEALTH & EVM TAB */}
        {activeTab === "HEALTH" && (
          <div className="space-y-6">
            <PortfolioHealthCard
              activeProject={activeProject}
              allProjects={allProjects}
              activeCompany={activeCompany}
              selectedCurrency={selectedCurrency}
              onOpenAdvisor={() => navigate(`/project-advisor?prompt=Perform%20EVM%20deep%20dive%20for%20${encodeURIComponent(activeProject?.name || "project")}`)}
            />
            <CashFlowForecastCard
              activeProject={activeProject}
              allProjects={allProjects}
              activeCompany={activeCompany}
              selectedCurrency={selectedCurrency}
            />
          </div>
        )}

        {/* EXCEPTIONS / ATTENTION TAB */}
        {activeTab === "EXCEPTIONS" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-w-0">
            <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-7 flex flex-col min-w-0">
              <RequiresAttentionTable
                activeProject={activeProject}
                allProjects={allProjects}
                activeCompany={activeCompany}
                className="h-full"
              />
            </div>
            <div className="lg:col-span-5 xl:col-span-5 2xl:col-span-5 flex flex-col min-w-0">
              <ProjectRiskRadarCard
                activeProject={activeProject}
                allProjects={allProjects}
                activeCompany={activeCompany}
                selectedCurrency={selectedCurrency}
                className="h-full"
              />
            </div>
          </div>
        )}

        {/* PROJECTS REGISTER TAB */}
        {activeTab === "PROJECTS" && (
          <div className="space-y-6">
            <ProjectsOperationalTable 
              projects={allProjects}
              activeProjectId={activeProject?.id}
              onSelectProject={(p) => {
                if (onProjectChange) onProjectChange(p);
              }}
              onCreateNew={() => navigate("/administration?tab=projects")}
              selectedCurrency={selectedCurrency}
            />
          </div>
        )}

        {/* PROJECT LOCATION MAP TAB */}
        {activeTab === "MAP" && (
          <div className="space-y-6">
            <ProjectLocationMapCard
              activeProject={activeProject}
              allProjects={allProjects}
              activeCompany={activeCompany}
              onProjectChange={onProjectChange}
            />
          </div>
        )}

        {/* CASHFLOW FORECAST TAB */}
        {activeTab === "CASHFLOW" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-w-0">
            <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-7 flex flex-col min-w-0">
              <CashFlowForecastCard
                activeProject={activeProject}
                allProjects={allProjects}
                activeCompany={activeCompany}
                selectedCurrency={selectedCurrency}
                className="h-full"
              />
            </div>
            <div className="lg:col-span-5 xl:col-span-5 2xl:col-span-5 flex flex-col min-w-0">
              <UpcomingMilestonesCard
                activeProject={activeProject}
                allProjects={allProjects}
                activeCompany={activeCompany}
                onMilestoneSelect={() => navigate("/programme")}
                className="h-full"
              />
            </div>
          </div>
        )}

      </div>

      {/* 6. GOVERNANCE & FIDIC/NEC4 CONTRACT FOOTER */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            Project Matrix Engineering & Commercial Intelligence &bull; Standard Contract Compliance: {activeProject?.contract_agreement_option || "FIDIC / NEC4"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span>{activeProject?.code || "PRJ"}</span>
          <span className="text-slate-400">|</span>
          <button 
            onClick={() => navigate("/programme")} 
            className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
          >
            Programme of Works &rarr;
          </button>
        </div>
      </div>

    </div>
  );
}
