import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  FileText, 
  Scale, 
  Calendar, 
  DollarSign, 
  ExternalLink, 
  Eye, 
  CheckCircle2, 
  Filter, 
  Search,
  ArrowRight,
  Plus,
  Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getProjectRealAttentionItems } from "../../utils/projectDataUtils";
import { exportObjectsToCsv, CsvColumn } from "../../utils/csvExport";

export interface AttentionItem {
  id: string;
  type: "Schedule" | "Cost" | "Contract" | "Permit" | "HSEQ" | "Quality" | "Action";
  project: string;
  projectCode: string;
  issue: string;
  impact: string;
  dueDate: string;
  status: "Critical" | "Warning" | "Open" | "In Review" | "Pending Action";
  actionUrl?: string;
  actionLabel?: string;
}

export interface RequiresAttentionTableProps {
  activeProject?: any;
  allProjects?: any[];
  activeCompany?: any;
  items?: AttentionItem[];
  onOpenItem?: (item: AttentionItem) => void;
  className?: string;
}

export default function RequiresAttentionTable({
  activeProject,
  allProjects = [],
  activeCompany,
  items,
  onOpenItem,
  className = ""
}: RequiresAttentionTableProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Derive real items if not directly provided
  const attentionItems: AttentionItem[] = useMemo(() => {
    if (items && items.length > 0) return items;
    return getProjectRealAttentionItems(activeProject, activeCompany?.id);
  }, [items, activeProject, activeCompany?.id]);

  const filteredItems = useMemo(() => {
    return attentionItems.filter((item) => {
      const matchSearch =
        searchQuery === "" ||
        item.issue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.projectCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType = typeFilter === "ALL" || item.type === typeFilter;
      const matchStatus = statusFilter === "ALL" || item.status === statusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [attentionItems, searchQuery, typeFilter, statusFilter]);

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "Schedule":
        return "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      case "Cost":
        return "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      case "Contract":
        return "bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800";
      case "Quality":
        return "bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800";
      case "Permit":
      case "HSEQ":
        return "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Critical":
        return "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold";
      case "Warning":
        return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold";
      default:
        return "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-medium";
    }
  };

  return (
    <div
      id="requires-attention-exploration-card"
      className={`bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3 className="text-base font-semibold text-[#172033] dark:text-white tracking-tight whitespace-nowrap">
              Action Items & Requires Attention
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold font-mono whitespace-nowrap shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {filteredItems.length} {filteredItems.length === 1 ? "Item" : "Items"}
            </span>
          </div>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-1 line-clamp-2 max-w-2xl break-words">
            Active early warnings, contractual notice deadlines, and engineering interventions for {activeProject?.name || "the selected project"}.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={() => {
              const timestamp = new Date().toISOString().slice(0, 10);
              const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
              const columns: CsvColumn<AttentionItem>[] = [
                { key: "projectCode", label: "Project Code" },
                { key: "project", label: "Project Name" },
                { key: "type", label: "Type / Category" },
                { key: "issue", label: "Action Item / Notice" },
                { key: "impact", label: "Impact" },
                { key: "dueDate", label: "Target / Due Date" },
                { key: "status", label: "Status" },
              ];
              exportObjectsToCsv(`Project_Requires_Attention_${prjCode}_${timestamp}`, columns, filteredItems);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F8FA] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#172033] dark:text-white font-semibold text-xs rounded-xl border border-[#E6E9EF] dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Export attention items to CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/actions")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F8FA] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#172033] dark:text-white font-semibold text-xs rounded-xl border border-[#E6E9EF] dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Log New Action</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {attentionItems.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search issues or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#F7F8FA] dark:bg-slate-800/80 border border-[#E6E9EF] dark:border-slate-700 rounded-xl text-xs text-[#172033] dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#F7F8FA] dark:bg-slate-800 border border-[#E6E9EF] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#172033] dark:text-white cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="Schedule">Schedule</option>
              <option value="Cost">Cost</option>
              <option value="Contract">Contract</option>
              <option value="Quality">Quality</option>
              <option value="Permit">Permits & HSEQ</option>
            </select>
          </div>
        </div>
      )}

      {/* Items Table */}
      {filteredItems.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#E6E9EF] dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8FA] dark:bg-slate-900 text-[#667085] dark:text-slate-400 border-b border-[#E6E9EF] dark:border-slate-800 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Issue / Critical Path Root</th>
                <th className="py-2.5 px-3">Impact Description</th>
                <th className="py-2.5 px-3">Due / Expiry</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9EF] dark:divide-slate-800">
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors"
                >
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTypeBadgeColor(
                        item.type
                      )}`}
                    >
                      {item.type}
                    </span>
                  </td>

                  <td className="py-3 px-3 max-w-[240px]">
                    <p className="font-semibold text-[#172033] dark:text-white truncate" title={item.issue}>
                      {item.issue}
                    </p>
                    <p className="text-[10px] text-[#667085] dark:text-slate-400 font-mono truncate">
                      {item.projectCode} &bull; {item.project}
                    </p>
                  </td>

                  <td className="py-3 px-3 max-w-[200px]">
                    <p className="text-[#667085] dark:text-slate-300 text-xs truncate" title={item.impact}>
                      {item.impact}
                    </p>
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    {item.dueDate}
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] ${getStatusBadgeColor(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        if (item.actionUrl) {
                          navigate(item.actionUrl);
                        } else if (onOpenItem) {
                          onOpenItem(item);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-semibold border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                    >
                      <span>{item.actionLabel || "Inspect"}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 sm:p-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-[#F7F8FA]/60 dark:bg-slate-900/30 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-semibold text-[#172033] dark:text-white">
              All Project Controls In Order
            </h4>
            <p className="text-xs text-[#667085] dark:text-slate-400 leading-relaxed">
              No critical path delay notices, unresolved NCRs, or overdue contractual action items logged for <span className="font-medium text-slate-700 dark:text-slate-300">{activeProject?.name || "the selected project"}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/actions")}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs whitespace-nowrap transition-colors"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Record New Early Warning / Action</span>
          </button>
        </div>
      )}
    </div>
  );
}
