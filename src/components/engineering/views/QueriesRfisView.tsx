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
  FileText,
  Calendar,
  DollarSign,
  User,
  X,
  Send
} from "lucide-react";
import { EngineeringRFI, EngineeringDisciplineId } from "../../../types/engineering";
import { UnifiedRecord } from "../RecordDetailsDrawer";
import { EngineeringRowActions } from "../EngineeringActionModals";

interface QueriesRfisViewProps {
  rfis: EngineeringRFI[];
  onSelectRecord: (record: UnifiedRecord) => void;
  onAddRFI: (rfi: EngineeringRFI) => Promise<any> | void;
  selectedDiscipline: string;
  onEditRecord?: (record: UnifiedRecord) => void;
  onDeleteRecord?: (record: UnifiedRecord) => void;
}

export default function QueriesRfisView({
  rfis,
  onSelectRecord,
  onAddRFI,
  selectedDiscipline,
  onEditRecord,
  onDeleteRecord
}: QueriesRfisViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New RFI Form state
  const [newRfi, setNewRfi] = useState({
    title: "",
    discipline: "structural",
    disciplineLabel: "Structural",
    drawingRef: "",
    specRef: "",
    location: "",
    chainage: "",
    priority: "High" as const,
    questionText: "",
    proposedSolution: "",
    responseDueDate: ""
  });

  const filteredRfis = useMemo(() => {
    return rfis.filter((r) => {
      if (selectedDiscipline !== "all" && r.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && r.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (priorityFilter !== "all" && r.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = r.rfiNumber.toLowerCase().includes(q);
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchText = (r.questionText || "").toLowerCase().includes(q);
        const matchDwg = (r.drawingRef || "").toLowerCase().includes(q);
        if (!matchNum && !matchTitle && !matchText && !matchDwg) return false;
      }
      return true;
    });
  }, [rfis, selectedDiscipline, statusFilter, priorityFilter, searchQuery]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("create", "components/engineering/views/QueriesRfisView.tsx");
    e.preventDefault();
    if (!newRfi.title.trim() || !newRfi.questionText.trim()) return;

    const nextIdNum = rfis.length + 101;
    const rfiRecord: EngineeringRFI = {
      id: `rfi-${Date.now()}`,
      rfiNumber: `RFI-${nextIdNum}`,
      title: newRfi.title,
      discipline: newRfi.discipline as any,
      disciplineLabel: newRfi.disciplineLabel,
      drawingRef: newRfi.drawingRef || "—",
      specRef: newRfi.specRef || "—",
      location: newRfi.location || "Site Wide",
      chainage: newRfi.chainage || "—",
      raisedBy: "Thabo Nkosi (Site Engineer)",
      raisedByRole: "Site Engineer",
      raisedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      responseDueDate: newRfi.responseDueDate || new Date(Date.now() + 5 * 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: "Awaiting Consultant",
      priority: newRfi.priority,
      questionText: newRfi.questionText,
      proposedSolution: newRfi.proposedSolution,
      constructionImpact: newRfi.priority === "Critical" ? "Critical" : "Medium",
      constructionImpactDetails: "Work paused pending engineer resolution.",
      programmeImpact: {
        hasImpact: newRfi.priority === "Critical",
        activityId: "ACT-092",
        activityName: "Active Construction Works",
        durationImpactDays: newRfi.priority === "Critical" ? 3 : 0,
        isCriticalPath: newRfi.priority === "Critical",
        details: "Awaiting resolution."
      },
      commercialImpact: {
        hasImpact: false,
        potentialVariation: false,
        estimatedCostImpact: 0,
        details: "To be evaluated after response."
      },
      contractClauseRef: {
        framework: "FIDIC Red Book 2017",
        clauseNumber: "Sub-Clause 1.9",
        clauseTitle: "Delayed Drawings or Instructions"
      },
      attachments: [],
      createdBy: "Thabo Nkosi",
      assignedTo: "Resident Engineer",
      createdAt: new Date().toISOString(),
      history: [
        {
          date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          action: "Created & Submitted",
          user: "Thabo Nkosi",
          details: "Technical query registered via Matrix Engineering workspace."
        }
      ]
    };

    await onAddRFI(rfiRecord);
    setIsCreateModalOpen(false);
    setNewRfi({
      title: "",
      discipline: "structural",
      disciplineLabel: "Structural",
      drawingRef: "",
      specRef: "",
      location: "",
      chainage: "",
      priority: "High",
      questionText: "",
      proposedSolution: "",
      responseDueDate: ""
    });
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("AWAIT") || s.includes("REVIEW")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          {status}
        </span>
      );
    }
    if (s.includes("RESPOND") || s.includes("APPROV") || s.includes("CLOSED")) {
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
    <div className="space-y-4">
      {/* Control Bar: Search & Action */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by RFI number, title, question, drawing..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="awaiting consultant">Awaiting Consultant</option>
            <option value="under review">Under Review</option>
            <option value="responded">Responded</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Raise Query / RFI</span>
        </button>
      </div>

      {/* Table Register */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-28">RFI #</th>
                <th className="py-3 px-4 min-w-[260px]">Query / Subject</th>
                <th className="py-3 px-4 w-32">Discipline</th>
                <th className="py-3 px-4 w-28">Drawing Ref</th>
                <th className="py-3 px-4 w-36">Status</th>
                <th className="py-3 px-4 w-24">Priority</th>
                <th className="py-3 px-4 w-32">Raised By</th>
                <th className="py-3 px-4 w-28">Due Date</th>
                <th className="py-3 px-4 w-44 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredRfis.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No technical queries or RFIs match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRfis.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onSelectRecord({ type: "RFI", data: r })}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="group-hover:text-blue-600 transition-colors">
                        {r.rfiNumber}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {r.title}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {r.questionText}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                        {r.disciplineLabel || r.discipline}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.drawingRef || "—"}
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(r.status)}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`font-bold text-[11px] ${
                          r.priority === "Critical"
                            ? "text-rose-600 dark:text-rose-400"
                            : r.priority === "High"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {r.priority}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 truncate">
                      {r.raisedBy.split(" ")[0]}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                      <span className={r.priority === "Critical" ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}>
                        {r.responseDueDate}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <EngineeringRowActions
                        onView={() => onSelectRecord({ type: "RFI", data: r })}
                        onEdit={() => onEditRecord ? onEditRecord({ type: "RFI", data: r }) : onSelectRecord({ type: "RFI", data: r })}
                        onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "RFI", data: r }) : undefined}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE RFI MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Raise Technical Query / RFI</span>
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
                  Query Title / Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discrepancy in Pier P14 Starter Bar Spacing"
                  value={newRfi.title}
                  onChange={(e) => setNewRfi({ ...newRfi, title: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Discipline
                  </label>
                  <select
                    value={newRfi.discipline}
                    onChange={(e) => {
                      const discMap: Record<string, string> = {
                        structural: "Structural",
                        civil: "Civil Works",
                        geotechnical: "Geotechnical",
                        drainage: "Drainage",
                        mep: "MEP / Utilities",
                        survey: "Survey & Geospatial"
                      };
                      setNewRfi({
                        ...newRfi,
                        discipline: e.target.value,
                        disciplineLabel: discMap[e.target.value] || e.target.value
                      });
                    }}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                  >
                    <option value="structural">Structural</option>
                    <option value="civil">Civil Works</option>
                    <option value="geotechnical">Geotechnical</option>
                    <option value="drainage">Drainage & Hydrology</option>
                    <option value="mep">MEP / Utilities</option>
                    <option value="survey">Survey & Geospatial</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Priority
                  </label>
                  <select
                    value={newRfi.priority}
                    onChange={(e) => setNewRfi({ ...newRfi, priority: e.target.value as any })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white"
                  >
                    <option value="Critical">Critical (Immediate Halt)</option>
                    <option value="High">High (48 Hours)</option>
                    <option value="Medium">Medium (5 Days)</option>
                    <option value="Low">Low (Routine)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Drawing Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. STR-042 Rev C"
                    value={newRfi.drawingRef}
                    onChange={(e) => setNewRfi({ ...newRfi, drawingRef: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Chainage / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Km 14+250"
                    value={newRfi.chainage}
                    onChange={(e) => setNewRfi({ ...newRfi, chainage: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Technical Clarification Question *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the discrepancy, clash, or engineering question..."
                  value={newRfi.questionText}
                  onChange={(e) => setNewRfi({ ...newRfi, questionText: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Contractor Proposed Solution
                </label>
                <textarea
                  rows={2}
                  placeholder="Proposed solution or recommendation for consultant approval..."
                  value={newRfi.proposedSolution}
                  onChange={(e) => setNewRfi({ ...newRfi, proposedSolution: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono"
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
                  <span>Submit Technical Query</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
