import React, { useState, useMemo } from "react";
import {
  HelpCircle,
  Clock,
  GitPullRequest,
  AlertOctagon,
  Search,
  Filter,
  ChevronRight,
  Check,
  AlertTriangle,
  ArrowUpDown
} from "lucide-react";
import { UnifiedRecord } from "./RecordDetailsDrawer";
import { EngineeringRowActions } from "./EngineeringActionModals";
import {
  EngineeringRFI,
  TechnicalSubmittal,
  EngineeringDesignChange,
  DesignAssumption,
  EngineeringDeviation
} from "../../types/engineering";

export interface AttentionItem {
  id: string;
  reference: string;
  description: string;
  discipline: string;
  status: string;
  responsible: string;
  dueDate: string;
  isCritical?: boolean;
  rawRecord: UnifiedRecord;
}

interface EngineeringOverviewProps {
  rfis: EngineeringRFI[];
  submittals: TechnicalSubmittal[];
  changes: EngineeringDesignChange[];
  assumptions: DesignAssumption[];
  deviations: EngineeringDeviation[];
  onSelectRecord: (record: UnifiedRecord) => void;
  onNavigateTab: (tab: "queries" | "submittals" | "design" | "changes" | "survey") => void;
  selectedDiscipline: string;
  onSelectDiscipline: (discipline: string) => void;
  onEditRecord?: (record: UnifiedRecord) => void;
  onDeleteRecord?: (record: UnifiedRecord) => void;
}

export default function EngineeringOverview({
  rfis,
  submittals,
  changes,
  assumptions,
  deviations,
  onSelectRecord,
  onNavigateTab,
  selectedDiscipline,
  onSelectDiscipline,
  onEditRecord,
  onDeleteRecord
}: EngineeringOverviewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Metrics calculation
  const openQueriesCount = useMemo(() => {
    return rfis.filter(
      (r) =>
        r.status !== "Closed" &&
        r.status !== "Responded"
    ).length;
  }, [rfis]);

  const awaitingApprovalCount = useMemo(() => {
    const rfiAwaiting = rfis.filter(
      (r) => r.status === "Awaiting Consultant" || r.status === "Under Review"
    ).length;
    const submittalsAwaiting = submittals.filter(
      (s) =>
        s.status === "Submitted" ||
        s.status === "Under Review" ||
        s.status === "Resubmitted"
    ).length;
    const changesAwaiting = changes.filter(
      (c) =>
        c.status === "Submitted to Consultant" ||
        c.status === "Client Review" ||
        c.status === "Under Evaluation" ||
        c.status === "Pending"
    ).length;
    return rfiAwaiting + submittalsAwaiting + changesAwaiting;
  }, [rfis, submittals, changes]);

  const designChangesCount = useMemo(() => {
    return changes.length;
  }, [changes]);

  const criticalIssuesCount = useMemo(() => {
    const critRfis = rfis.filter(
      (r) =>
        (r.priority === "Critical" || r.programmeImpact?.isCriticalPath) &&
        r.status !== "Closed"
    ).length;
    const critAssumptions = assumptions.filter(
      (a) =>
        (a.criticality === "Critical" || a.criticality === "High") &&
        (a.status === "Open" || a.status === "Unverified")
    ).length;
    const critDeviations = deviations.filter(
      (d) =>
        (d.riskLevel === "Critical" || d.riskLevel === "High") &&
        d.status !== "Approved"
    ).length;
    return critRfis + critAssumptions + critDeviations;
  }, [rfis, assumptions, deviations]);

  // Aggregate unified "Engineering Attention" register items
  const attentionItems: AttentionItem[] = useMemo(() => {
    const list: AttentionItem[] = [];

    // From RFIs requiring attention
    rfis.forEach((r) => {
      if (r.status !== "Closed") {
        list.push({
          id: r.id,
          reference: r.rfiNumber,
          description: r.title,
          discipline: r.disciplineLabel || r.discipline,
          status: r.status,
          responsible: r.assignedTo || r.raisedBy || "Consultant",
          dueDate: r.responseDueDate || "Pending",
          isCritical: r.priority === "Critical" || r.programmeImpact?.isCriticalPath,
          rawRecord: { type: "RFI", data: r }
        });
      }
    });

    // From Submittals awaiting action/approval or rejected
    submittals.forEach((s) => {
      if (s.status !== "Approved" && s.status !== "Approved with Comments") {
        list.push({
          id: s.id,
          reference: s.submittalNumber,
          description: s.title,
          discipline: s.discipline,
          status: s.status,
          responsible: s.supplier || "Technical Lead",
          dueDate: s.targetApprovalDate || "Pending",
          isCritical: s.status === "Revise & Resubmit" || s.status === "Rejected",
          rawRecord: { type: "SUBMITTAL", data: s }
        });
      }
    });

    // From Design Changes pending evaluation
    changes.forEach((c) => {
      if (c.status !== "Approved" && c.status !== "Implemented") {
        list.push({
          id: c.id,
          reference: c.changeNumber,
          description: c.title,
          discipline: c.discipline,
          status: c.status,
          responsible: c.proposedBy || c.leadEngineer || "Resident Engineer",
          dueDate: c.targetApprovalDate || "Under Review",
          isCritical: c.commercialImpact?.hasImpact || c.programmeImpact?.hasImpact,
          rawRecord: { type: "CHANGE", data: c }
        });
      }
    });

    // From Unverified Design Assumptions on critical path
    assumptions.forEach((a) => {
      if (a.status !== "Verified" && a.status !== "Closed") {
        list.push({
          id: a.id,
          reference: a.assumptionNumber || a.assumptionCode || "ASSUMP",
          description: `Hold Point: ${a.title}`,
          discipline: a.discipline,
          status: a.status,
          responsible: a.actionOwner || "Lead Geotech",
          dueDate: a.targetValidationDate || "Prior to Pour",
          isCritical: a.criticality === "Critical",
          rawRecord: { type: "ASSUMPTION", data: a }
        });
      }
    });

    // From Deviations pending approval
    deviations.forEach((d) => {
      if (d.status !== "Approved") {
        list.push({
          id: d.id,
          reference: d.deviationNumber,
          description: d.title,
          discipline: d.discipline,
          status: d.status,
          responsible: d.submittedBy || "Design Consultant",
          dueDate: d.resolutionDate || "28 Feb 2025",
          isCritical: d.riskLevel === "Critical" || d.riskLevel === "High",
          rawRecord: { type: "DEVIATION", data: d }
        });
      }
    });

    return list;
  }, [rfis, submittals, changes, assumptions, deviations]);

  // Filter items
  const filteredAttention = useMemo(() => {
    return attentionItems.filter((item) => {
      // Discipline filter
      if (
        selectedDiscipline !== "all" &&
        item.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()
      ) {
        return false;
      }
      // Status filter
      if (statusFilter === "critical" && !item.isCritical) return false;
      if (statusFilter === "awaiting" && !item.status.toLowerCase().includes("await") && !item.status.toLowerCase().includes("review") && !item.status.toLowerCase().includes("submit")) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = item.reference.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchResp = item.responsible.toLowerCase().includes(q);
        const matchDisc = item.discipline.toLowerCase().includes(q);
        if (!matchRef && !matchDesc && !matchResp && !matchDisc) return false;
      }

      return true;
    });
  }, [attentionItems, selectedDiscipline, statusFilter, searchQuery]);

  const getStatusBadge = (status: string, isCritical?: boolean) => {
    const s = (status || "").toUpperCase();
    if (isCritical || s.includes("CRITICAL") || s.includes("REJECT") || s.includes("OVERDUE") || s.includes("REVISE")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0 animate-pulse" />
          {status}
        </span>
      );
    }
    if (s.includes("AWAIT") || s.includes("REVIEW") || s.includes("PENDING") || s.includes("SUBMITTED")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          {status}
        </span>
      );
    }
    if (s.includes("APPROV") || s.includes("CLOSED") || s.includes("VERIFIED")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1 stroke-[2.5] shrink-0" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 shrink-0" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 4 OVERVIEW KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Queries */}
        <div
          onClick={() => onNavigateTab("queries")}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Open Queries
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {openQueriesCount}
            </span>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
              View Queries & RFIs <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Active technical clarifications requiring answers
          </p>
        </div>

        {/* Awaiting Approval */}
        <div
          onClick={() => onNavigateTab("submittals")}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Awaiting Approval
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {awaitingApprovalCount}
            </span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 group-hover:underline flex items-center gap-0.5">
              View Submittals <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Submittals, DCNs and RFIs with Consultant/Client
          </p>
        </div>

        {/* Design Changes */}
        <div
          onClick={() => onNavigateTab("changes")}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Design Changes
            </span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <GitPullRequest className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {designChangesCount}
            </span>
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 group-hover:underline flex items-center gap-0.5">
              View Changes <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Formal DCNs, site instructions and scope variations
          </p>
        </div>

        {/* Critical Issues */}
        <div
          onClick={() => setStatusFilter(statusFilter === "critical" ? "all" : "critical")}
          className={`bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-xs hover:shadow-md transition-all cursor-pointer group ${
            statusFilter === "critical"
              ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20 dark:bg-rose-950/20"
              : "border-slate-200 dark:border-slate-800 hover:border-rose-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Critical Issues
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {criticalIssuesCount}
            </span>
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
              {statusFilter === "critical" ? "Showing Filtered" : "Filter Critical"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Critical path driving or high construction risks
          </p>
        </div>
      </div>

      {/* ENGINEERING ATTENTION REGISTER */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-850/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Engineering Attention</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold">
                {filteredAttention.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Action items requiring technical review, sign-off, or engineer response
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference, description..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none w-56"
              />
            </div>

            {/* Quick status filter pills */}
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("critical")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  statusFilter === "critical"
                    ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Critical
              </button>
              <button
                onClick={() => setStatusFilter("awaiting")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  statusFilter === "awaiting"
                    ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Awaiting Approval
              </button>
            </div>
          </div>
        </div>

        {/* Unified Table: Reference | Description | Discipline | Status | Responsible | Due Date */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-32">Reference</th>
                <th className="py-3 px-4 min-w-[280px]">Description</th>
                <th className="py-3 px-4 w-36">Discipline</th>
                <th className="py-3 px-4 w-36">Status</th>
                <th className="py-3 px-4 w-44">Responsible</th>
                <th className="py-3 px-4 w-32">Due Date</th>
                <th className="py-3 px-4 w-44 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredAttention.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No attention records found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredAttention.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onSelectRecord(item.rawRecord)}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                  >
                    {/* Reference */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="group-hover:text-blue-600 transition-colors">
                        {item.reference}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {item.isCritical && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {item.description}
                        </span>
                      </div>
                    </td>

                    {/* Discipline */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                        {item.discipline}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {getStatusBadge(item.status, item.isCritical)}
                    </td>

                    {/* Responsible */}
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium truncate">
                      {item.responsible}
                    </td>

                    {/* Due Date */}
                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                      <span className={item.isCritical ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}>
                        {item.dueDate}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <EngineeringRowActions
                        onView={() => onSelectRecord(item.rawRecord)}
                        onEdit={() => onEditRecord ? onEditRecord(item.rawRecord) : onSelectRecord(item.rawRecord)}
                        onDelete={() => onDeleteRecord ? onDeleteRecord(item.rawRecord) : undefined}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
