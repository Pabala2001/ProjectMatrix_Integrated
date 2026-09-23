import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import { 
  Briefcase, 
  Search, 
  Plus, 
  ArrowRight, 
  MapPin, 
  FileText, 
  DollarSign, 
  Edit, 
  Trash2, 
  Check, 
  ExternalLink,
  ChevronRight,
  User,
  Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SupportedCurrency, getCurrencyInfo } from "../../config/currencies";
import { formatCompactCurrency, formatCurrency, convertCurrency, getCurrencyHoverTitle } from "../../utils/currency";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { exportObjectsToCsv, CsvColumn } from "../../utils/csvExport";

export interface ProjectRecord {
  id: string;
  code: string;
  name: string;
  client: string;
  location?: string;
  status: "In Progress" | "Behind" | "On Track" | "On Hold" | "Delayed" | "Completed";
  progressPercent: number;
  budget: number;
  currency?: string;
  owner?: string;
  contractType?: string;
  spi?: number;
  cpi?: number;
}

const DEFAULT_PROJECT_RECORDS: ProjectRecord[] = [
  {
    id: "pjm-001",
    code: "PJM-001",
    name: "Tunduma Highway Expansion",
    client: "TANROADS",
    location: "Songwe Region, Tanzania",
    status: "Behind",
    progressPercent: 68.4,
    budget: 450_000_000_000,
    currency: "TZS",
    owner: "Eng. M. Makame",
    contractType: "FIDIC Red Book",
    spi: 0.88,
    cpi: 0.94
  },
  {
    id: "pjm-002",
    code: "PJM-002",
    name: "Mtwara Port Access Road & Container Terminal",
    client: "TPA (Tanzania Ports Authority)",
    location: "Mtwara, Tanzania",
    status: "On Track",
    progressPercent: 42.1,
    budget: 280_000_000_000,
    currency: "TZS",
    owner: "Eng. S. Temba",
    contractType: "NEC4 Option C",
    spi: 1.02,
    cpi: 0.99
  },
  {
    id: "pjm-003",
    code: "PJM-003",
    name: "Kigali Logistics Hub & Dry Port",
    client: "Rwanda Transport Development Agency",
    location: "Masaka, Kigali",
    status: "Behind",
    progressPercent: 55.0,
    budget: 195_000_000_000,
    currency: "TZS",
    owner: "Eng. J. Uwizeye",
    contractType: "FIDIC Yellow Book",
    spi: 0.89,
    cpi: 0.92
  },
  {
    id: "pjm-004",
    code: "PJM-004",
    name: "Dar es Salaam Bypass Package 2 (Interchanges)",
    client: "TANROADS",
    location: "Dar es Salaam",
    status: "In Progress",
    progressPercent: 81.3,
    budget: 620_000_000_000,
    currency: "TZS",
    owner: "Eng. D. Mwangi",
    contractType: "FIDIC Red Book",
    spi: 0.96,
    cpi: 0.91
  },
  {
    id: "pjm-005",
    code: "PJM-005",
    name: "Water Supply Phase II Bulk Pipeline",
    client: "DAWASA",
    location: "Ruvu to Dar es Salaam",
    status: "On Track",
    progressPercent: 34.8,
    budget: 310_000_000_000,
    currency: "TZS",
    owner: "Eng. F. Kimaro",
    contractType: "FIDIC Silver Book",
    spi: 1.01,
    cpi: 1.04
  },
  {
    id: "pjm-006",
    code: "PJM-006",
    name: "Dodoma Government City Link Roads",
    client: "TARURA",
    location: "Dodoma Capital",
    status: "On Hold",
    progressPercent: 18.2,
    budget: 145_000_000_000,
    currency: "TZS",
    owner: "Eng. K. Lyimo",
    contractType: "NEC4 Option B",
    spi: 0.72,
    cpi: 0.85
  }
];

export interface ProjectsOperationalTableProps {
  projects?: any[];
  activeProjectId?: string;
  onSelectProject?: (project: any) => void;
  onEditProject?: (project: any) => void;
  onDeleteProject?: (project: any) => void;
  onCreateNew?: () => void;
  showActions?: boolean;
  selectedCurrency?: SupportedCurrency;
  className?: string;
}

export default function ProjectsOperationalTable({
  projects,
  activeProjectId,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onCreateNew,
  showActions = true,
  selectedCurrency,
  className = ""
}: ProjectsOperationalTableProps) {
  const navigate = useNavigate();
  const { currencyCode: regionalCurrencyCode, formatCurrency } = useRegionalSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");

  // Normalize project data from database
  const normalizedProjects: ProjectRecord[] = useMemo(() => {
    if (Array.isArray(projects)) {
      return projects.map((p) => ({
        id: p.id,
        code: p.code || p.contract_code || "PRJ",
        name: p.name || p.project_name || "Untitled Project",
        client: p.client || p.client_organization || "Client Organisation",
        location: p.location || p.execution_location || "Site Location",
        status: (p.status === "active" || p.status === "In Progress") ? "In Progress" :
                (p.status === "Behind" || p.status === "Immediate Intervention") ? "Behind" :
                (p.status === "On Hold" || p.status === "suspended") ? "On Hold" : "On Track",
        progressPercent: p.progress_percent ?? p.physical_progress ?? 0,
        budget: p.value_rate || p.award_value_zar || p.award_value || 0,
        currency: p.currency_code || p.currency || "TZS",
        owner: p.project_director || p.owner || p.created_by_name || "Project Manager",
        contractType: p.contract_agreement_option || p.contract_type || "FIDIC Red Book"
      }));
    }
    return [];
  }, [projects]);

  // Unique owners
  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    normalizedProjects.forEach((p) => {
      if (p.owner) set.add(p.owner);
    });
    return Array.from(set);
  }, [normalizedProjects]);

  const filteredProjects = useMemo(() => {
    return normalizedProjects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (ownerFilter !== "ALL" && p.owner !== ownerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q) ||
          (p.location && p.location.toLowerCase().includes(q)) ||
          (p.owner && p.owner.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [normalizedProjects, statusFilter, ownerFilter, searchQuery]);

  const getStatusBadge = (status: ProjectRecord["status"]) => {
    switch (status) {
      case "On Track":
      case "Completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      case "In Progress":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
      case "Behind":
      case "Delayed":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
      case "On Hold":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const targetCurrency = selectedCurrency || (regionalCurrencyCode as SupportedCurrency) || "TZS";

  const formatBudgetDisplay = (val: number, curr?: string) => {
    const fromCurr = curr || "TZS";
    return formatCompactCurrency(val, targetCurrency, fromCurr);
  };

  const handleExportProjectsCsv = () => {
    assertOperationalAction("export", "components/dashboard/ProjectsOperationalTable.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const columns: CsvColumn<ProjectRecord>[] = [
      { key: "code", label: "Project Code" },
      { key: "name", label: "Project Name" },
      { key: "client", label: "Client Organization" },
      { key: "location", label: "Execution Location" },
      { key: "status", label: "Operational Status" },
      { key: "progressPercent", label: "Physical Progress %" },
      { key: "budget", label: "Contract Budget / Value" },
      { key: "currency", label: "Currency" },
      { key: "contractType", label: "Contract Framework" },
      { key: "owner", label: "Project Lead" },
      { key: "spi", label: "SPI" },
      { key: "cpi", label: "CPI" },
    ];
    exportObjectsToCsv(`Projects_Register_${timestamp}`, columns, filteredProjects);
  };

  return (
    <div className={`bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden ${className}`}>
      {/* Header & Filter Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800">
            <Briefcase className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#172033] dark:text-white tracking-tight flex items-center gap-2">
              Projects Register
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {filteredProjects.length} Total
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Operational projects, client mandates, progress metrics, and budget allocations.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40 sm:w-44"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="In Progress">In Progress</option>
            <option value="On Track">On Track</option>
            <option value="Behind">Behind</option>
            <option value="On Hold">On Hold</option>
          </select>

          {uniqueOwners.length > 0 && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer hidden sm:inline-block"
            >
              <option value="ALL">All Owners</option>
              {uniqueOwners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleExportProjectsCsv}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Export filtered projects register to CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {onCreateNew && (
            <button
              type="button"
              onClick={onCreateNew}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Operational Records Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-4">Project Code</th>
              <th className="py-2.5 px-4">Project Name</th>
              <th className="py-2.5 px-4">Client</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">% Complete</th>
              <th className="py-2.5 px-4">Budget</th>
              <th className="py-2.5 px-4">Owner</th>
              {showActions && <th className="py-2.5 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={showActions ? 8 : 7} className="py-8 text-center text-slate-400 text-xs">
                  No projects found matching the criteria.
                </td>
              </tr>
            ) : (
              filteredProjects.map((p) => {
                const isActive = activeProjectId === p.id;
                return (
                  <tr 
                    key={p.id}
                    className={`transition-colors ${
                      isActive 
                        ? "bg-blue-50/50 dark:bg-blue-950/20" 
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {p.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#172033] dark:text-white">
                      <div className="truncate max-w-[220px]" title={p.name}>
                        {p.name}
                      </div>
                      {p.location && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-normal truncate">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          <span>{p.location}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      <div className="truncate max-w-[160px]" title={p.client}>
                        {p.client}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                          <div 
                            className={`h-full rounded-full ${
                              p.status === "Behind" ? "bg-rose-500" :
                              p.status === "On Hold" ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, p.progressPercent)}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                          {p.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-[11px]">
                      {formatBudgetDisplay(p.budget, p.currency)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{p.owner}</span>
                      </div>
                    </td>
                    {showActions && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {onSelectProject && (
                            <button
                              type="button"
                              onClick={() => onSelectProject(p)}
                              className={`px-2 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                                isActive 
                                  ? "bg-blue-600 text-white" 
                                  : "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                              }`}
                            >
                              {isActive ? "Active" : "Select"}
                            </button>
                          )}
                          {onEditProject && (
                            <button
                              type="button"
                              onClick={() => onEditProject(p)}
                              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title="Edit Project"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteProject && (
                            <button
                              type="button"
                              onClick={() => onDeleteProject(p)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                              title="Delete Project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
