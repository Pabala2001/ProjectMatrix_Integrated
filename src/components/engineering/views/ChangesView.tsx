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
  GitPullRequest,
  Calendar,
  DollarSign,
  User,
  X,
  Send
} from "lucide-react";
import { DesignChangeNotice } from "../../../types/engineering";
import { UnifiedRecord } from "../RecordDetailsDrawer";
import { EngineeringRowActions } from "../EngineeringActionModals";

interface ChangesViewProps {
  changes: DesignChangeNotice[];
  onSelectRecord: (record: UnifiedRecord) => void;
  onAddChange: (change: DesignChangeNotice) => void;
  selectedDiscipline: string;
  onEditRecord?: (record: UnifiedRecord) => void;
  onDeleteRecord?: (record: UnifiedRecord) => void;
}

export default function ChangesView({
  changes,
  onSelectRecord,
  onAddChange,
  selectedDiscipline,
  onEditRecord,
  onDeleteRecord
}: ChangesViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New change state
  const [newChange, setNewChange] = useState({
    title: "",
    discipline: "Structural",
    reason: "",
    costImpact: 25000,
    scheduleImpactDays: 2,
    priority: "High" as const
  });

  const filteredChanges = useMemo(() => {
    return changes.filter((c) => {
      if (selectedDiscipline !== "all" && c.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && c.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = c.changeNumber.toLowerCase().includes(q);
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchReason = (c.reason || "").toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchReason) return false;
      }
      return true;
    });
  }, [changes, selectedDiscipline, statusFilter, searchQuery]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    assertOperationalAction("create", "components/engineering/views/ChangesView.tsx");
    e.preventDefault();
    if (!newChange.title.trim()) return;

    const nextIdNum = changes.length + 301;
    const changeRecord: DesignChangeNotice = {
      id: `dcn-${Date.now()}`,
      changeNumber: `DCN-${nextIdNum}`,
      title: newChange.title,
      discipline: newChange.discipline as any,
      reason: newChange.reason || "Site condition optimization",
      status: "Submitted to Consultant",
      priority: newChange.priority,
      proposedBy: "Contractor Design Team",
      leadEngineer: "Dr. Elena Rostova",
      initiatedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      targetApprovalDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      commercialImpact: {
        hasImpact: Number(newChange.costImpact) > 0,
        costImpact: Number(newChange.costImpact) || 0,
        potentialVariation: true,
        details: "Under formal FIDIC evaluation."
      },
      programmeImpact: {
        hasImpact: Number(newChange.scheduleImpactDays) > 0,
        activityId: "ACT-092",
        activityName: "Affected Construction Package",
        durationImpactDays: Number(newChange.scheduleImpactDays) || 0,
        isCriticalPath: Number(newChange.scheduleImpactDays) > 0,
        details: "Schedule shift."
      },
      technical: {
        whatChanged: newChange.reason,
        affectedDrawings: ["STR-042 Rev C"],
        drawingRevisions: ["STR-042 Rev D"]
      }
    };

    onAddChange(changeRecord);
    setIsCreateModalOpen(false);
    setNewChange({
      title: "",
      discipline: "Structural",
      reason: "",
      costImpact: 25000,
      scheduleImpactDays: 2,
      priority: "High"
    });
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("REJECT")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
          {status}
        </span>
      );
    }
    if (s.includes("SUBMIT") || s.includes("REVIEW") || s.includes("EVALUATION") || s.includes("PENDING")) {
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
              placeholder="Search DCN number, title, reason, engineer..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="submitted to consultant">Submitted to Consultant</option>
            <option value="client review">Client Review</option>
            <option value="under evaluation">Under Evaluation</option>
            <option value="approved">Approved</option>
            <option value="implemented">Implemented</option>
          </select>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Design Change Notice</span>
        </button>
      </div>

      {/* Changes Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-28">DCN #</th>
                <th className="py-3 px-4 min-w-[260px]">Change Title / Scope Delta</th>
                <th className="py-3 px-4 w-28">Discipline</th>
                <th className="py-3 px-4 w-36">Status</th>
                <th className="py-3 px-4 w-28">Cost Impact</th>
                <th className="py-3 px-4 w-28">Time Delta</th>
                <th className="py-3 px-4 w-36">Initiated By</th>
                <th className="py-3 px-4 w-28">Target Date</th>
                <th className="py-3 px-4 w-44 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredChanges.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No design changes found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredChanges.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectRecord({ type: "CHANGE", data: c as any })}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="group-hover:text-blue-600 transition-colors">
                        {c.changeNumber}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {c.title}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {c.reason}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                        {c.discipline}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(c.status)}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {c.commercialImpact?.costImpact ? `$${c.commercialImpact.costImpact.toLocaleString()}` : "$0"}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {c.programmeImpact?.durationImpactDays ? `+${c.programmeImpact.durationImpactDays} Days` : "0 Days"}
                    </td>

                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 truncate">
                      {c.proposedBy}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {c.targetApprovalDate}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <EngineeringRowActions
                        onView={() => onSelectRecord({ type: "CHANGE", data: c as any })}
                        onEdit={() => onEditRecord ? onEditRecord({ type: "CHANGE", data: c as any }) : onSelectRecord({ type: "CHANGE", data: c as any })}
                        onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "CHANGE", data: c as any }) : undefined}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE DCN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-purple-400" />
                <span>Initiate Design Change Notice (DCN)</span>
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
                  Change Notice Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Realignment of Pier P14 Pile Cap & Reinforcement Upgrade"
                  value={newChange.title}
                  onChange={(e) => setNewChange({ ...newChange, title: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Discipline
                  </label>
                  <select
                    value={newChange.discipline}
                    onChange={(e) => setNewChange({ ...newChange, discipline: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                  >
                    <option value="Structural">Structural</option>
                    <option value="Civil Works">Civil Works</option>
                    <option value="Geotechnical">Geotechnical</option>
                    <option value="Drainage & Hydrology">Drainage & Hydrology</option>
                    <option value="MEP / Utilities">MEP / Utilities</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Priority
                  </label>
                  <select
                    value={newChange.priority}
                    onChange={(e) => setNewChange({ ...newChange, priority: e.target.value as any })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Engineering Reason & Scope Delta *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this change is necessary and summarize the scope delta..."
                  value={newChange.reason}
                  onChange={(e) => setNewChange({ ...newChange, reason: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Estimated Cost Impact ($)
                  </label>
                  <input
                    type="number"
                    value={newChange.costImpact}
                    onChange={(e) => setNewChange({ ...newChange, costImpact: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Schedule Impact (Days)
                  </label>
                  <input
                    type="number"
                    value={newChange.scheduleImpactDays}
                    onChange={(e) => setNewChange({ ...newChange, scheduleImpactDays: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono"
                  />
                </div>
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
                  <span>Submit Change Notice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
