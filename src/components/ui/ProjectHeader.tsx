import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Building2, 
  Calendar, 
  Coins, 
  UserCheck, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText,
  ChevronRight,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { RiskIndicator } from "./RiskIndicator";

export type ProjectSection = 
  | "overview" 
  | "controls" 
  | "commercial" 
  | "engineering" 
  | "field" 
  | "hseq" 
  | "documents";

export interface ProjectHeaderProps {
  project?: any;
  activeSection?: ProjectSection;
  actions?: React.ReactNode;
  className?: string;
  id?: string;
}

// Helper to safely read from localStorage
function safeGetStoredJson<T>(key: string): T | null {
  try {
    const val = localStorage.getItem(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

// Format date helper: returns "-" if no date is provided
function formatCompletionDate(dateVal: any): string {
  if (!dateVal || typeof dateVal !== "string" || !dateVal.trim()) {
    return "-";
  }
  const clean = dateVal.trim();
  if (clean === "null" || clean === "undefined" || clean === "-" || clean === "—") {
    return "-";
  }
  return clean;
}

// Currency Symbol helper
function getCurrencySymbol(codeOrSymbol?: string): string {
  if (!codeOrSymbol) return "$";
  const upper = codeOrSymbol.toUpperCase().trim();
  if (upper === "TZS" || upper === "TSH") return "TSh";
  if (upper === "ZAR") return "R";
  if (upper === "USD") return "$";
  if (upper === "EUR") return "€";
  if (upper === "GBP") return "£";
  if (upper === "KES" || upper === "KSH") return "KSh";
  if (upper === "UGX" || upper === "USH") return "USh";
  if (upper === "SAR") return "SAR";
  if (upper === "AED") return "AED";
  return codeOrSymbol.length <= 4 ? codeOrSymbol : "$";
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  activeSection,
  actions,
  className = "",
  id = "universal-project-header"
}) => {
  const location = useLocation();

  // 1. Resolve project details strictly from actual entity, without fake fallbacks
  const projectName = project?.name || project?.title || (project ? "-" : "Select a Project");
  const projectCode = project?.code || project?.contract_code || project?.contract_number || "-";
  const clientName = project?.client || project?.client_organization || "-";

  // 2. Resolve Contract Value strictly from uploaded data including variations
  const projectId = project?.id || project?.project_id || "";
  const companyId = project?.company_id || project?.organisation_id || "";

  let uploadedContractVal: number | null = null;
  if (projectId) {
    const commDataV2 = 
      safeGetStoredJson<any>(`pm_commercial_v2_contract_values_${companyId}_${projectId}`) ||
      safeGetStoredJson<any>(`pm_commercial_v2_contract_values_all_${projectId}`) ||
      safeGetStoredJson<any>(`commercial_contract_values_${companyId}_${projectId}`);

    if (commDataV2) {
      if (typeof commDataV2.revisedContractValue === "number" && commDataV2.revisedContractValue > 0) {
        uploadedContractVal = commDataV2.revisedContractValue;
      } else if (
        typeof commDataV2.originalContractValue === "number" && 
        commDataV2.originalContractValue > 0
      ) {
        const variations = typeof commDataV2.approvedVariations === "number" ? commDataV2.approvedVariations : 0;
        uploadedContractVal = commDataV2.originalContractValue + variations;
      }
    }
  }

  // Fallback to project record attributes if commercial baseline not separately uploaded
  if (uploadedContractVal === null || uploadedContractVal <= 0) {
    if (typeof project?.revised_contract_value === "number" && project.revised_contract_value > 0) {
      uploadedContractVal = project.revised_contract_value;
    } else if (typeof project?.revised_contract_value === "string" && !isNaN(parseFloat(project.revised_contract_value)) && parseFloat(project.revised_contract_value) > 0) {
      uploadedContractVal = parseFloat(project.revised_contract_value);
    } else if (project?.agreed_contract_value_excl_vat || project?.original_contract_value) {
      const orig = Number(project.agreed_contract_value_excl_vat || project.original_contract_value) || 0;
      const vars = Number(project.approved_variations_excl_vat || project.approved_variations) || 0;
      if (orig + vars > 0) {
        uploadedContractVal = orig + vars;
      }
    } else if (typeof project?.award_value_zar === "number" && project.award_value_zar > 0) {
      uploadedContractVal = project.award_value_zar;
    } else if (typeof project?.value_rate === "number" && project.value_rate > 0) {
      uploadedContractVal = project.value_rate;
    } else if (typeof project?.contract_value_usd === "number" && project.contract_value_usd > 0) {
      uploadedContractVal = project.contract_value_usd;
    } else if (typeof project?.valueRate === "number" && project.valueRate > 0) {
      uploadedContractVal = project.valueRate;
    } else if (typeof project?.award_value === "number" && project.award_value > 0) {
      uploadedContractVal = project.award_value;
    } else if (typeof project?.budget === "number" && project.budget > 0) {
      uploadedContractVal = project.budget;
    } else if (typeof project?.contract_value === "number" && project.contract_value > 0) {
      uploadedContractVal = project.contract_value;
    } else if (typeof project?.contract_value === "string") {
      const parsed = parseFloat(project.contract_value.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        uploadedContractVal = parsed;
      }
    }
  }

  // Format currency
  const currencySymbol = project?.currency_symbol || getCurrencySymbol(project?.currency_code || project?.currency);

  let formattedValue = "-";
  if (uploadedContractVal !== null && uploadedContractVal !== undefined && !isNaN(uploadedContractVal) && uploadedContractVal > 0) {
    formattedValue = `${currencySymbol} ${Math.round(uploadedContractVal).toLocaleString()}`;
  }

  // 3. Resolve status & dates strictly from project data without fake placeholders
  const status = project?.status || (project ? "Active" : "-");

  const completionDateRaw = 
    project?.end_date || 
    project?.endDate || 
    project?.contract_completion_date || 
    project?.target_completion_date || 
    project?.completion_date || 
    project?.due_completion_date;

  const completionDate = formatCompletionDate(completionDateRaw);

  const forecastDateRaw = 
    project?.forecastDate || 
    project?.forecast_date || 
    project?.predicted_completion_date || 
    project?.forecast_completion_date;

  const forecastDate = formatCompletionDate(forecastDateRaw);

  // Calculate current active section if not explicitly passed
  const currentPath = location.pathname;
  const currentSection: ProjectSection = activeSection || (() => {
    if (currentPath.startsWith("/controls") || currentPath.includes("programme")) return "controls";
    if (currentPath.startsWith("/commercial") || currentPath.includes("boq") || currentPath.includes("accounts") || currentPath.includes("finance")) return "commercial";
    if (currentPath.startsWith("/engineering") || currentPath.includes("surveying") || currentPath.startsWith("/actions")) return "engineering";
    if (currentPath.startsWith("/field") || currentPath.startsWith("/site") || currentPath.includes("site-diaries") || currentPath.includes("reports")) return "field";
    if (currentPath.startsWith("/hseq") || currentPath.includes("quality")) return "hseq";
    if (currentPath.startsWith("/documents")) return "documents";
    return "overview";
  })();

  const navItems: Array<{ key: ProjectSection; label: string; href: string }> = [
    { key: "overview", label: "Overview", href: "/projects" },
    { key: "controls", label: "Controls", href: "/controls/programme" },
    { key: "commercial", label: "Commercial", href: "/commercial/boq" },
    { key: "engineering", label: "Engineering", href: "/engineering" },
    { key: "field", label: "Field", href: "/site" },
    { key: "hseq", label: "HSEQ", href: "/hseq" },
    { key: "documents", label: "Documents", href: "/documents" },
  ];

  return (
    <div
      id={id}
      className={`bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden mb-6 transition-all ${className}`}
    >
      {/* Top Banner Row */}
      <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          
          {/* Left: Project Title & Code */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <h1 className="text-xl sm:text-[22px] font-bold text-[#07182E] dark:text-white tracking-tight leading-tight">
                {projectName}
              </h1>
              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-xs font-semibold border border-slate-200 dark:border-slate-700">
                {projectCode}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Contract execution governed under unified FIDIC Red Book / NEC4 ECC framework.
            </p>
          </div>

          {/* Right: Quick actions if passed */}
          {actions && (
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {actions}
            </div>
          )}
        </div>

        {/* Project Metadata Stats Bar - Clean aligned information strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          
          {/* Client */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Client
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">
              {clientName}
            </div>
          </div>

          {/* Contract Value */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Contract Value
            </div>
            <div className="text-xs sm:text-sm font-bold font-mono text-[#07182E] dark:text-white">
              {formattedValue}
            </div>
          </div>

          {/* Status - Semantic pill reserved strictly for state */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Status
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                {status}
              </span>
            </div>
          </div>

          {/* Completion */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Completion Date
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{completionDate}</span>
            </div>
          </div>

          {/* Forecast */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Forecast Date
            </div>
            <div className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{forecastDate}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Universal Domain Tabs Row - Equal vertical alignment and navy/orange active styling */}
      <div className="bg-[#F8FAFC] dark:bg-slate-900/60 px-5 sm:px-6 py-2 border-t border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
          {navItems.map((item) => {
            const isActive = currentSection === item.key;
            return (
              <Link
                key={item.key}
                to={item.href}
                className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all duration-150 inline-flex items-center justify-center gap-1.5 cursor-pointer border-b-2 ${
                  isActive
                    ? "bg-[#07182E] text-white shadow-xs border-amber-500 dark:bg-slate-800 dark:text-white dark:border-amber-400"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 border-transparent"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProjectHeader;

