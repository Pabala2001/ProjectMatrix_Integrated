import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Filter,
  Check,
  AlertTriangle,
  Clock,
  ChevronRight,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  Layers,
  FileCheck,
  CheckCircle2,
  X,
  Send
} from "lucide-react";
import {
  DesignAssumption,
  EngineeringDeviation,
  DesignReviewPackage,
  TemporaryWorksItem
} from "../../../types/engineering";
import { UnifiedRecord } from "../RecordDetailsDrawer";
import { EngineeringRowActions } from "../EngineeringActionModals";

interface DesignViewProps {
  assumptions: DesignAssumption[];
  reviews: DesignReviewPackage[];
  deviations: EngineeringDeviation[];
  temporaryWorks: TemporaryWorksItem[];
  onSelectRecord: (record: UnifiedRecord) => void;
  selectedDiscipline: string;
  onAddAssumption?: (assump: DesignAssumption) => void;
  onAddDeviation?: (dev: EngineeringDeviation) => void;
  onEditRecord?: (record: UnifiedRecord) => void;
  onDeleteRecord?: (record: UnifiedRecord) => void;
}

type DesignSubSection = "assumptions" | "reviews" | "verification" | "deviations";

export default function DesignView({
  assumptions,
  reviews,
  deviations,
  temporaryWorks,
  onSelectRecord,
  selectedDiscipline,
  onAddAssumption,
  onAddDeviation,
  onEditRecord,
  onDeleteRecord
}: DesignViewProps) {
  const [subSection, setSubSection] = useState<DesignSubSection>("assumptions");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filtered assumptions
  const filteredAssumptions = useMemo(() => {
    return assumptions.filter((a) => {
      if (selectedDiscipline !== "all" && a.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && a.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = (a.assumptionCode || a.assumptionNumber || "").toLowerCase().includes(q);
        const matchTitle = (a.title || "").toLowerCase().includes(q);
        const matchBasis = (a.designBasis || a.statement || "").toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchBasis) return false;
      }
      return true;
    });
  }, [assumptions, selectedDiscipline, statusFilter, searchQuery]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (selectedDiscipline !== "all" && r.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && r.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPkg = (r.packageNumber || "").toLowerCase().includes(q);
        const matchTitle = (r.title || "").toLowerCase().includes(q);
        if (!matchPkg && !matchTitle) return false;
      }
      return true;
    });
  }, [reviews, selectedDiscipline, statusFilter, searchQuery]);

  // Filtered verification (temporary works / design verification checks)
  const filteredVerification = useMemo(() => {
    return temporaryWorks.filter((tw) => {
      if (selectedDiscipline !== "all" && tw.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && tw.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = (tw.designReference || tw.itemNumber || "").toLowerCase().includes(q);
        const matchDesc = (tw.description || "").toLowerCase().includes(q);
        if (!matchRef && !matchDesc) return false;
      }
      return true;
    });
  }, [temporaryWorks, selectedDiscipline, statusFilter, searchQuery]);

  // Filtered deviations
  const filteredDeviations = useMemo(() => {
    return deviations.filter((d) => {
      if (selectedDiscipline !== "all" && d.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && d.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = (d.deviationNumber || "").toLowerCase().includes(q);
        const matchTitle = (d.title || "").toLowerCase().includes(q);
        const matchProp = (d.proposedDeparture || d.proposedDeviation || "").toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchProp) return false;
      }
      return true;
    });
  }, [deviations, selectedDiscipline, statusFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("REJECT") || s.includes("HIGH") || s.includes("CRITICAL") || s.includes("UNVERIFIED")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
          {status}
        </span>
      );
    }
    if (s.includes("REVIEW") || s.includes("PENDING") || s.includes("OPEN")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1 stroke-[2.5] shrink-0" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Design Sub-Sections Selector & Search */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* 4 Required Design Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs overflow-x-auto">
          <button
            onClick={() => {
              setSubSection("assumptions");
              setStatusFilter("all");
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              subSection === "assumptions"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Design Assumptions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {assumptions.length}
            </span>
          </button>

          <button
            onClick={() => {
              setSubSection("reviews");
              setStatusFilter("all");
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              subSection === "reviews"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Design Reviews</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {reviews.length}
            </span>
          </button>

          <button
            onClick={() => {
              setSubSection("verification");
              setStatusFilter("all");
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              subSection === "verification"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Verification</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {temporaryWorks.length}
            </span>
          </button>

          <button
            onClick={() => {
              setSubSection("deviations");
              setStatusFilter("all");
            }}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              subSection === "deviations"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Deviations</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {deviations.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${subSection}...`}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 1. DESIGN ASSUMPTIONS TABLE */}
      {subSection === "assumptions" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Ref #</th>
                  <th className="py-3 px-4 min-w-[260px]">Assumption Statement / Basis</th>
                  <th className="py-3 px-4 w-28">Discipline</th>
                  <th className="py-3 px-4 w-32">Site Trigger</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-24">Criticality</th>
                  <th className="py-3 px-4 w-36">Action Owner</th>
                  <th className="py-3 px-4 w-28">Target Date</th>
                  <th className="py-3 px-4 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredAssumptions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      No design assumptions match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredAssumptions.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => onSelectRecord({ type: "ASSUMPTION", data: a })}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <span className="group-hover:text-blue-600 transition-colors">
                          {a.assumptionCode || a.assumptionNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {a.title}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {a.designBasis || a.statement}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                          {a.discipline}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {a.siteTriggerHoldPoint || "Hold Point"}
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(a.status)}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`font-bold text-[11px] ${
                          a.criticality === "Critical" ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"
                        }`}>
                          {a.criticality || "Normal"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 truncate">
                        {a.actionOwner}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {a.targetValidationDate || "Pre-Pour"}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <EngineeringRowActions
                          onView={() => onSelectRecord({ type: "ASSUMPTION", data: a })}
                          onEdit={() => onEditRecord ? onEditRecord({ type: "ASSUMPTION", data: a }) : onSelectRecord({ type: "ASSUMPTION", data: a })}
                          onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "ASSUMPTION", data: a }) : undefined}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. DESIGN REVIEWS TABLE */}
      {subSection === "reviews" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Package #</th>
                  <th className="py-3 px-4 min-w-[240px]">Design Package Title</th>
                  <th className="py-3 px-4 w-28">Discipline</th>
                  <th className="py-3 px-4 w-20 text-center">Rev</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 w-36">Reviewer Lead</th>
                  <th className="py-3 px-4 w-28">Target Date</th>
                  <th className="py-3 px-4 w-28 text-center">Open Comments</th>
                  <th className="py-3 px-4 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      No design review packages found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => onSelectRecord({ type: "REVIEW", data: r as any })}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <span className="group-hover:text-blue-600 transition-colors">
                          {r.packageNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {r.title}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                          {r.discipline}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                        {r.revision}
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(r.status)}
                      </td>

                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 truncate">
                        {r.reviewerLead}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {r.targetCompletionDate}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">
                        {r.commentsCount}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <EngineeringRowActions
                          onView={() => onSelectRecord({ type: "REVIEW", data: r as any })}
                          onEdit={() => onEditRecord ? onEditRecord({ type: "REVIEW", data: r as any }) : onSelectRecord({ type: "REVIEW", data: r as any })}
                          onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "REVIEW", data: r as any }) : undefined}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. VERIFICATION / TEMPORARY WORKS TABLE */}
      {subSection === "verification" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Item #</th>
                  <th className="py-3 px-4 min-w-[240px]">Verification / Temporary Works Element</th>
                  <th className="py-3 px-4 w-28">Discipline</th>
                  <th className="py-3 px-4 w-32">Category</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 w-36">Designer / Certifier</th>
                  <th className="py-3 px-4 w-28">Valid Until</th>
                  <th className="py-3 px-4 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredVerification.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      No verification or temporary works items found.
                    </td>
                  </tr>
                ) : (
                  filteredVerification.map((tw) => (
                    <tr
                      key={tw.id}
                      onClick={() => onSelectRecord({ type: "GENERIC", data: { reference: tw.itemNumber, description: tw.description, discipline: tw.discipline, status: tw.status, responsible: tw.designerName, dueDate: tw.inspectionDueDate } })}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <span className="group-hover:text-blue-600 transition-colors">
                          {tw.itemNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {tw.description}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                          {tw.discipline}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {tw.category}
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(tw.status)}
                      </td>

                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 truncate">
                        {tw.designerName}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {tw.inspectionDueDate || "Valid"}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <EngineeringRowActions
                          onView={() => onSelectRecord({ type: "GENERIC", data: { reference: tw.itemNumber, description: tw.description, discipline: tw.discipline, status: tw.status, responsible: tw.designerName, dueDate: tw.inspectionDueDate } })}
                          onEdit={() => onEditRecord ? onEditRecord({ type: "GENERIC", data: { reference: tw.itemNumber, description: tw.description, discipline: tw.discipline, status: tw.status, responsible: tw.designerName, dueDate: tw.inspectionDueDate } }) : onSelectRecord({ type: "GENERIC", data: { reference: tw.itemNumber, description: tw.description, discipline: tw.discipline, status: tw.status, responsible: tw.designerName, dueDate: tw.inspectionDueDate } })}
                          onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "GENERIC", data: { reference: tw.itemNumber, description: tw.description, discipline: tw.discipline, status: tw.status, responsible: tw.designerName, dueDate: tw.inspectionDueDate } }) : undefined}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. DEVIATIONS TABLE */}
      {subSection === "deviations" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Deviation #</th>
                  <th className="py-3 px-4 min-w-[260px]">Proposed Departure / Justification</th>
                  <th className="py-3 px-4 w-28">Discipline</th>
                  <th className="py-3 px-4 w-32">Spec Clause</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 w-24">Risk</th>
                  <th className="py-3 px-4 w-36">Approved By</th>
                  <th className="py-3 px-4 w-28">Target Date</th>
                  <th className="py-3 px-4 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredDeviations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      No engineering deviations found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredDeviations.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => onSelectRecord({ type: "DEVIATION", data: d })}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <span className="group-hover:text-blue-600 transition-colors">
                          {d.deviationNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {d.title}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {d.proposedDeparture || d.proposedDeviation}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                          {d.discipline}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {d.specificationClause}
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(d.status)}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`font-bold text-[11px] ${
                          d.riskLevel === "Critical" || d.riskLevel === "High" ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"
                        }`}>
                          {d.riskLevel || "Low"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 truncate">
                        {d.approvedBy}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {d.resolutionDate || "28 Feb 2025"}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <EngineeringRowActions
                          onView={() => onSelectRecord({ type: "DEVIATION", data: d })}
                          onEdit={() => onEditRecord ? onEditRecord({ type: "DEVIATION", data: d }) : onSelectRecord({ type: "DEVIATION", data: d })}
                          onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "DEVIATION", data: d }) : undefined}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
