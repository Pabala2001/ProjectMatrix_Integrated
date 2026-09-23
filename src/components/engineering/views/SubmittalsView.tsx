import { assertOperationalAction } from "../../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Filter,
  Check,
  AlertTriangle,
  Clock,
  ChevronRight,
  FileCheck,
  Calendar,
  DollarSign,
  Package,
  X,
  Send
} from "lucide-react";
import { TechnicalSubmittal } from "../../../types/engineering";
import { UnifiedRecord } from "../RecordDetailsDrawer";
import { EngineeringRowActions } from "../EngineeringActionModals";

interface SubmittalsViewProps {
  submittals: TechnicalSubmittal[];
  onSelectRecord: (record: UnifiedRecord) => void;
  onAddSubmittal: (sub: TechnicalSubmittal) => void;
  selectedDiscipline: string;
  onEditRecord?: (record: UnifiedRecord) => void;
  onDeleteRecord?: (record: UnifiedRecord) => void;
}

export default function SubmittalsView({
  submittals,
  onSelectRecord,
  onAddSubmittal,
  selectedDiscipline,
  onEditRecord,
  onDeleteRecord
}: SubmittalsViewProps) {
    assertOperationalAction("write", "components/engineering/views/SubmittalsView.tsx");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New submittal state
  const [newSub, setNewSub] = useState({
    title: "",
    discipline: "Structural",
    specification: "",
    supplier: "",
    leadTimeWeeks: 4,
    revision: "Rev 0"
  });

  const filteredSubmittals = useMemo(() => {
    return submittals.filter((s) => {
      if (selectedDiscipline !== "all" && s.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && s.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = s.submittalNumber.toLowerCase().includes(q);
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchSpec = (s.specification || "").toLowerCase().includes(q);
        const matchSupp = (s.supplier || "").toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchSpec && !matchSupp) return false;
      }
      return true;
    });
  }, [submittals, selectedDiscipline, statusFilter, searchQuery]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    assertOperationalAction("create", "components/engineering/views/SubmittalsView.tsx");
    e.preventDefault();
    if (!newSub.title.trim()) return;

    const nextIdNum = submittals.length + 201;
    const submittalRecord: TechnicalSubmittal = {
      id: `sub-${Date.now()}`,
      submittalNumber: `SUB-${nextIdNum}`,
      title: newSub.title,
      discipline: newSub.discipline as any,
      specification: newSub.specification || "03 30 00 Clause 2.1",
      supplier: newSub.supplier || "Certified Vendor",
      submissionDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      targetApprovalDate: new Date(Date.now() + 10 * 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: "Submitted",
      revision: newSub.revision || "Rev 0",
      leadTimeWeeks: Number(newSub.leadTimeWeeks) || 3,
      criticalActivityRef: "ACT-092",
      linkedPurchaseOrder: "PO-2025-104",
      contractClauseRef: {
        framework: "FIDIC Red Book 2017",
        clauseNumber: "Sub-Clause 4.1",
        clauseTitle: "Contractor's General Obligations"
      }
    };

    onAddSubmittal(submittalRecord);
    setIsCreateModalOpen(false);
    setNewSub({
      title: "",
      discipline: "Structural",
      specification: "",
      supplier: "",
      leadTimeWeeks: 4,
      revision: "Rev 0"
    });
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("REVISE") || s.includes("REJECT")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
          {status}
        </span>
      );
    }
    if (s.includes("SUBMIT") || s.includes("REVIEW") || s.includes("PENDING")) {
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
      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by submittal number, title, specification, supplier..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="approved with comments">Approved with Comments</option>
            <option value="revise & resubmit">Revise & Resubmit</option>
          </select>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Submittal</span>
        </button>
      </div>

      {/* Submittals Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-28">Submittal #</th>
                <th className="py-3 px-4 min-w-[240px]">Item / Material Description</th>
                <th className="py-3 px-4 w-28">Discipline</th>
                <th className="py-3 px-4 w-32">Specification</th>
                <th className="py-3 px-4 w-36">Supplier / Mfg</th>
                <th className="py-3 px-4 w-20 text-center">Rev</th>
                <th className="py-3 px-4 w-36">Status</th>
                <th className="py-3 px-4 w-28">Target Date</th>
                <th className="py-3 px-4 w-24">Lead Time</th>
                <th className="py-3 px-4 w-44 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredSubmittals.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                    No technical submittals match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredSubmittals.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => onSelectRecord({ type: "SUBMITTAL", data: sub })}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="group-hover:text-blue-600 transition-colors">
                        {sub.submittalNumber}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {sub.title}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                        {sub.discipline}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {sub.specification || "—"}
                    </td>

                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 truncate">
                      {sub.supplier}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">
                      {sub.revision}
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(sub.status)}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {sub.targetApprovalDate}
                    </td>

                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                      {sub.leadTimeWeeks ? `${sub.leadTimeWeeks} wks` : "—"}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <EngineeringRowActions
                        onView={() => onSelectRecord({ type: "SUBMITTAL", data: sub })}
                        onEdit={() => onEditRecord ? onEditRecord({ type: "SUBMITTAL", data: sub }) : onSelectRecord({ type: "SUBMITTAL", data: sub })}
                        onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "SUBMITTAL", data: sub }) : undefined}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE SUBMITTAL MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-400" />
                <span>Register Technical Submittal</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Item / Submittal Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High-Yield Reinforcement Steel 500B Mill Certificates"
                  value={newSub.title}
                  onChange={(e) => setNewSub({ ...newSub, title: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Discipline
                  </label>
                  <select
                    value={newSub.discipline}
                    onChange={(e) => setNewSub({ ...newSub, discipline: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                  >
                    <option value="Structural">Structural</option>
                    <option value="Civil Works">Civil Works</option>
                    <option value="Geotechnical">Geotechnical</option>
                    <option value="Drainage & Hydrology">Drainage & Hydrology</option>
                    <option value="MEP / Utilities">MEP / Utilities</option>
                    <option value="Survey & Geospatial">Survey & Geospatial</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Revision
                  </label>
                  <input
                    type="text"
                    value={newSub.revision}
                    onChange={(e) => setNewSub({ ...newSub, revision: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Specification Clause
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 03 30 00 Section 2.1"
                    value={newSub.specification}
                    onChange={(e) => setNewSub({ ...newSub, specification: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Supplier / Manufacturer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ArcelorMittal Long Products"
                    value={newSub.supplier}
                    onChange={(e) => setNewSub({ ...newSub, supplier: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Procurement Lead Time (Weeks)
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={newSub.leadTimeWeeks}
                  onChange={(e) => setNewSub({ ...newSub, leadTimeWeeks: Number(e.target.value) })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Register Submittal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
