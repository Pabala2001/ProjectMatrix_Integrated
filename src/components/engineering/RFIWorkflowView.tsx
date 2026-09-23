import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  ArrowUpRight,
  TrendingUp,
  Download,
  Paperclip,
  ExternalLink,
  ChevronRight,
  Send,
  Eye,
  X,
  Scale,
  Sparkles,
  HelpCircle,
  Building,
  HardHat
} from "lucide-react";
import { EngineeringRFI, EngineeringDisciplineId, ImpactLevel, RFIStatus } from "../../types/engineering";
import { MASTER_ENGINEERING_DISCIPLINES } from "../../data/engineeringData";

interface RFIWorkflowViewProps {
  rfis: EngineeringRFI[];
  onAddRFI: (rfi: EngineeringRFI) => void;
  onUpdateRFI: (rfi: EngineeringRFI) => void;
  activeDisciplineFilter: string;
  onSelectDisciplineFilter: (discipline: string) => void;
  availableDisciplines: { id: EngineeringDisciplineId; name: string; code: string }[];
}

export default function RFIWorkflowView({
  rfis,
  onAddRFI,
  onUpdateRFI,
  activeDisciplineFilter,
  onSelectDisciplineFilter,
  availableDisciplines
}: RFIWorkflowViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRFI, setSelectedRFI] = useState<EngineeringRFI | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [consultantResponseText, setConsultantResponseText] = useState<string>("");

  // New RFI Form state
  const [newRfiNumber, setNewRfiNumber] = useState(`RFI-09${rfis.length + 1}`);
  const [newTitle, setNewTitle] = useState("");
  const [newDiscipline, setNewDiscipline] = useState<EngineeringDisciplineId>("structural");
  const [newDrawingRef, setNewDrawingRef] = useState("STR-042 Rev C");
  const [newSpecRef, setNewSpecRef] = useState("03 30 00");
  const [newLocation, setNewLocation] = useState("Pier P14");
  const [newPriority, setNewPriority] = useState<ImpactLevel>("High");
  const [newQuestion, setNewQuestion] = useState("");
  const [newProposedSolution, setNewProposedSolution] = useState("");
  const [newConstructionImpact, setNewConstructionImpact] = useState<ImpactLevel>("High");
  const [newActivityId, setNewActivityId] = useState("ST-140");
  const [newDurationImpactDays, setNewDurationImpactDays] = useState(3);
  const [newEstimatedCostImpact, setNewEstimatedCostImpact] = useState(45000);
  const [newPotentialVariation, setNewPotentialVariation] = useState(true);

  // Filtered RFIs
  const filteredRFIs = rfis.filter(rfi => {
    const matchesSearch = 
      rfi.rfiNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfi.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfi.drawingRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfi.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDiscipline = activeDisciplineFilter === "all" || rfi.discipline === activeDisciplineFilter;
    const matchesStatus = statusFilter === "all" || rfi.status === statusFilter;

    return matchesSearch && matchesDiscipline && matchesStatus;
  });

  // Calculate high-level summary KPIs
  const totalCount = rfis.length;
  const awaitingConsultantCount = rfis.filter(r => r.status === "Awaiting Consultant").length;
  const criticalImpactCount = rfis.filter(r => r.constructionImpact === "Critical" || r.constructionImpact === "High").length;
  const variationPotentialSum = rfis.filter(r => r.commercialImpact?.potentialVariation).reduce((acc, curr) => acc + (curr.commercialImpact?.estimatedCostImpact || 0), 0);

  const getStatusBadge = (status: RFIStatus) => {
    switch (status) {
      case "Awaiting Consultant":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">Awaiting Consultant</span>;
      case "Responded":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">Responded</span>;
      case "Closed":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">Closed</span>;
      case "Overdue":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 animate-pulse">Overdue</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{status}</span>;
    }
  };

  const getImpactBadge = (level: ImpactLevel) => {
    switch (level) {
      case "Critical":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Critical</span>;
      case "High":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">High</span>;
      case "Medium":
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400">Low</span>;
    }
  };

  const handleCreateRFI = (e: React.FormEvent) => {
    assertOperationalAction("create", "components/engineering/RFIWorkflowView.tsx");
    e.preventDefault();
    const disciplineMeta = MASTER_ENGINEERING_DISCIPLINES.find(d => d.id === newDiscipline);
    const newEntry: EngineeringRFI = {
      id: `rfi-${Date.now()}`,
      rfiNumber: newRfiNumber,
      title: newTitle || "Technical Clarification",
      discipline: newDiscipline,
      disciplineLabel: disciplineMeta ? disciplineMeta.name.split(" ")[0] : "Engineering",
      drawingRef: newDrawingRef,
      specRef: newSpecRef,
      location: newLocation,
      raisedBy: "Site Engineer",
      raisedByRole: "Site Engineer",
      raisedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      responseDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: "Awaiting Consultant",
      priority: newPriority,
      questionText: newQuestion,
      proposedSolution: newProposedSolution,
      constructionImpact: newConstructionImpact,
      constructionImpactDetails: "Critical construction sequence hold point pending consultant response.",
      programmeImpact: {
        hasImpact: true,
        activityId: newActivityId,
        activityName: `Activity ${newActivityId} Substructure`,
        durationImpactDays: newDurationImpactDays,
        isCriticalPath: true,
        details: `Activity ${newActivityId} potentially affected by ${newDurationImpactDays} days.`
      },
      commercialImpact: {
        hasImpact: newPotentialVariation,
        potentialVariation: newPotentialVariation,
        estimatedCostImpact: newEstimatedCostImpact,
        details: newPotentialVariation ? "Potential variation / extra-over rate adjustment" : "No commercial impact"
      },
      contractClauseRef: {
        framework: "FIDIC_2017_RED",
        clauseNumber: "Sub-Clause 1.9",
        clauseTitle: "Delayed Drawings or Instructions"
      },
      attachments: [
        { id: "att-new-1", type: "Photo", name: "Site_Photo_Markup.jpg", fileSize: "2.1 MB", uploadedAt: new Date().toISOString() },
        { id: "att-new-2", type: "Drawing Markup", name: `${newDrawingRef}_Markup.pdf`, fileSize: "4.8 MB", uploadedAt: new Date().toISOString() }
      ]
    };

    onAddRFI(newEntry);
    setIsCreateModalOpen(false);
    setSelectedRFI(newEntry);
  };

  const handleEndorseResponse = () => {
    if (!selectedRFI || !consultantResponseText.trim()) return;
    const updated: EngineeringRFI = {
      ...selectedRFI,
      status: "Responded",
      consultantResponse: consultantResponseText,
      respondedBy: "Resident Engineer - Dr. A. Mwamba",
      respondedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    };
    onUpdateRFI(updated);
    setSelectedRFI(updated);
    setConsultantResponseText("");
  };

  return (
    <div className="space-y-4">
      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total RFIs</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</span>
            <span className="text-xs text-slate-400 font-medium">Logged & Tracked</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Awaiting Consultant</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{awaitingConsultantCount}</span>
            <span className="text-xs text-slate-400 font-medium">Critical Hold Points</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">High / Critical Site Impact</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{criticalImpactCount}</span>
            <span className="text-xs text-slate-400 font-medium">Schedule Delay Risk</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Variation Exposure</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${(variationPotentialSum / 1000).toFixed(0)}k
            </span>
            <span className="text-xs text-slate-400 font-medium">Commercial Impact</span>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search RFI #, drawing, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Discipline Selector */}
          <select
            value={activeDisciplineFilter}
            onChange={(e) => onSelectDisciplineFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Configured Disciplines</option>
            {availableDisciplines.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
            ))}
          </select>

          {/* Status Selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Awaiting Consultant">Awaiting Consultant</option>
            <option value="Responded">Responded</option>
            <option value="Closed">Closed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>

        {/* Raise RFI Trigger */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Raise New RFI</span>
        </button>
      </div>

      {/* RFI Table Register */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">RFI Number & Title</th>
                <th className="px-4 py-3">Discipline</th>
                <th className="px-4 py-3">Drawing / Location</th>
                <th className="px-4 py-3">Raised By / Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Impact (Site / Prog / Cost)</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRFIs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No RFIs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredRFIs.map((rfi) => (
                  <tr
                    key={rfi.id}
                    onClick={() => setSelectedRFI(rfi)}
                    className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {rfi.rfiNumber}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5 truncate max-w-xs">
                        {rfi.title}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-semibold">
                        {rfi.disciplineLabel}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {rfi.drawingRef}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3" />
                        <span>{rfi.location}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-900 dark:text-slate-100 font-medium">{rfi.raisedBy}</div>
                      <div className="text-[11px] text-slate-400">{rfi.raisedDate}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-900 dark:text-slate-100 font-medium">{rfi.responseDueDate}</div>
                      <div className="text-[10px] text-amber-500 font-semibold">3-Day Window</div>
                    </td>

                    <td className="px-4 py-3.5">
                      {getStatusBadge(rfi.status)}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {getImpactBadge(rfi.constructionImpact)}
                        {rfi.programmeImpact?.hasImpact && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500" title={`Prog: ${rfi.programmeImpact?.activityId || ""}`}>
                            +{rfi.programmeImpact?.durationImpactDays || 0}d
                          </span>
                        )}
                        {rfi.commercialImpact?.potentialVariation && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500" title="Variation Potential">
                            ${((rfi.commercialImpact?.estimatedCostImpact || 0) / 1000).toFixed(0)}k
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRFI(rfi);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED RFI CROSS-MODULE DRAWER */}
      <AnimatePresence>
        {selectedRFI && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRFI(null)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full z-10 border-l border-slate-200 dark:border-slate-800"
            >
              {/* Drawer Top Bar */}
              <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {selectedRFI.rfiNumber}
                      </span>
                      {getStatusBadge(selectedRFI.status)}
                    </div>
                    <h3 className="font-bold text-sm text-white truncate max-w-md">
                      {selectedRFI.title}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRFI(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* 1. Header Details Grid (Directly matching user prompt structure) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Raised by</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedRFI.raisedBy}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Discipline</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedRFI.disciplineLabel}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Drawing Ref</span>
                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">{selectedRFI.drawingRef}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedRFI.location}</div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Raised Date</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{selectedRFI.raisedDate}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Response Due</span>
                    <div className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">{selectedRFI.responseDueDate}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Specification</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{selectedRFI.specRef}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Priority</span>
                    <div className="mt-0.5">{getImpactBadge(selectedRFI.priority)}</div>
                  </div>
                </div>

                {/* 2. Cross-Module Impact Matrix (Connecting Engineering → Programme → Commercial → Contracts) */}
                <div className="p-4 bg-blue-50/40 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                      Cross-Module Impact Telemetry
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {/* Construction Impact */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Construction Impact</span>
                      <div className="mt-1 flex items-center gap-1.5">
                        {getImpactBadge(selectedRFI.constructionImpact)}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                        {selectedRFI.constructionImpactDetails}
                      </p>
                    </div>

                    {/* Programme Impact */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Programme Impact</span>
                      <div className="mt-1 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {selectedRFI.programmeImpact?.activityId ? `Activity ${selectedRFI.programmeImpact.activityId}` : "No Schedule Impact"}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                        {selectedRFI.programmeImpact?.details || "No adverse impact logged on critical path schedule."}
                      </p>
                    </div>

                    {/* Commercial Impact */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Commercial Impact</span>
                      <div className="mt-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {selectedRFI.commercialImpact?.potentialVariation ? `Potential Variation ($${(selectedRFI.commercialImpact.estimatedCostImpact || 0).toLocaleString()})` : "Zero Variation"}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                        {selectedRFI.commercialImpact?.details || "No commercial variation logged for this request."}
                      </p>
                    </div>
                  </div>

                  {/* Contract Clause Alignment */}
                  <div className="px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Scale className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-slate-500 font-medium">Contract Grounding:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedRFI.contractClauseRef ? `${selectedRFI.contractClauseRef.framework} • ${selectedRFI.contractClauseRef.clauseNumber} (${selectedRFI.contractClauseRef.clauseTitle})` : "FIDIC Red Book 2017 Clause 1.9"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Technical Question & Proposed Contractor Solution */}
                <div className="space-y-3">
                  <div className="p-4 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                      <span>Technical Inquiry / Description</span>
                    </h5>
                    <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {selectedRFI.questionText}
                    </p>
                  </div>

                  {selectedRFI.proposedSolution && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        Contractor's Proposed Engineering Solution
                      </h5>
                      <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedRFI.proposedSolution}
                      </p>
                    </div>
                  )}
                </div>

                {/* 4. Attachments (Photos | Drawing Markup | Survey Data) */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                    <span>Evidence Attachments ({selectedRFI.attachments.length})</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {selectedRFI.attachments.map(att => (
                      <div
                        key={att.id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="truncate">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block">
                            {att.type}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate block text-[11px]">
                            {att.name}
                          </span>
                          <span className="text-[10px] text-slate-400">{att.fileSize}</span>
                        </div>
                        <Download className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500 cursor-pointer" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Consultant Response & Endorsement */}
                <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                  <h5 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Consultant Official Response & Instruction</span>
                  </h5>

                  {selectedRFI.consultantResponse ? (
                    <div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {selectedRFI.consultantResponse}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Endorsed by: <strong>{selectedRFI.respondedBy}</strong></span>
                        <span>Date: {selectedRFI.respondedDate}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                        Currently awaiting formal response from Resident Engineer / Supervising Consultant.
                      </p>
                      <textarea
                        rows={3}
                        value={consultantResponseText}
                        onChange={(e) => setConsultantResponseText(e.target.value)}
                        placeholder="Type formal engineering response or consultant instruction..."
                        className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleEndorseResponse}
                        disabled={!consultantResponseText.trim()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Issue Consultant Endorsement</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <button
                  onClick={() => setSelectedRFI(null)}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const detail = {
                        query: `Analyze impact of ${selectedRFI.rfiNumber}: ${selectedRFI.title} on Activity ${selectedRFI.programmeImpact?.activityId || "Schedule"} and commercial variation exposure.`,
                        contractFramework: selectedRFI.contractClauseRef?.framework || "FIDIC"
                      };
                      try {
                        const event = new CustomEvent("matrix-open-advisor", { detail });
                        window.dispatchEvent(event);
                      } catch {
                        try {
                          const evt = document.createEvent("CustomEvent");
                          evt.initCustomEvent("matrix-open-advisor", true, true, detail);
                          window.dispatchEvent(evt);
                        } catch (e) {
                          console.warn("Unable to dispatch matrix-open-advisor event", e);
                        }
                      }
                    }}
                    className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask Matrix Analysis</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE RFI MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm text-white">Raise New Request For Information (RFI)</h4>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRFI} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">RFI Number</label>
                  <input
                    type="text"
                    value={newRfiNumber}
                    onChange={(e) => setNewRfiNumber(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Discipline</label>
                  <select
                    value={newDiscipline}
                    onChange={(e) => setNewDiscipline(e.target.value as EngineeringDisciplineId)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  >
                    {availableDisciplines.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Title / Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Foundation Level Discrepancy"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Drawing Ref</label>
                  <input
                    type="text"
                    value={newDrawingRef}
                    onChange={(e) => setNewDrawingRef(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Specification Ref</label>
                  <input
                    type="text"
                    value={newSpecRef}
                    onChange={(e) => setNewSpecRef(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Location / Chainage</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Question / Detailed Problem Statement</label>
                <textarea
                  rows={3}
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  required
                  placeholder="Describe exact site condition, clash, or specification query..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Contractor Proposed Solution</label>
                <input
                  type="text"
                  value={newProposedSolution}
                  onChange={(e) => setNewProposedSolution(e.target.value)}
                  placeholder="e.g. Deepen mass concrete blinding pad to sound bedrock elevation..."
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              {/* Cross Module Impact Inputs */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="font-bold text-blue-600 dark:text-blue-400 block">Cross-Module Linkages</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Programme Activity ID</label>
                    <input
                      type="text"
                      value={newActivityId}
                      onChange={(e) => setNewActivityId(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Potential Delay (Days)</label>
                    <input
                      type="number"
                      value={newDurationImpactDays}
                      onChange={(e) => setNewDurationImpactDays(Number(e.target.value))}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">Potential Cost Variation ($)</label>
                    <input
                      type="number"
                      value={newEstimatedCostImpact}
                      onChange={(e) => setNewEstimatedCostImpact(Number(e.target.value))}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="potVar"
                      checked={newPotentialVariation}
                      onChange={(e) => setNewPotentialVariation(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="potVar" className="font-bold text-slate-700 dark:text-slate-300">Constitutes Potential Variation</label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Submit RFI
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
