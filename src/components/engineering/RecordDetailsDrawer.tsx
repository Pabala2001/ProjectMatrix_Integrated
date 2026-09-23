import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  FileText,
  Compass,
  FileCheck,
  Calendar,
  DollarSign,
  Mail,
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  ExternalLink,
  Tag,
  Paperclip,
  Check,
  Building,
  HardHat,
  Send,
  Plus,
  Edit,
  Trash2
} from "lucide-react";
import {
  EngineeringRFI,
  TechnicalSubmittal,
  DesignAssumption,
  EngineeringDeviation,
  DesignReviewItem,
  EngineeringDesignChange,
  SettingOutRecord,
  SurveyControlPoint
} from "../../types/engineering";

export type UnifiedRecord =
  | { type: "RFI"; data: EngineeringRFI }
  | { type: "SUBMITTAL"; data: TechnicalSubmittal }
  | { type: "ASSUMPTION"; data: DesignAssumption }
  | { type: "DEVIATION"; data: EngineeringDeviation }
  | { type: "REVIEW"; data: DesignReviewItem }
  | { type: "CHANGE"; data: EngineeringDesignChange }
  | { type: "SETTING_OUT"; data: SettingOutRecord }
  | { type: "CONTROL_POINT"; data: SurveyControlPoint }
  | { type: "GENERIC"; data: any };

export type DrawerTab =
  | "technical"
  | "drawings"
  | "documents"
  | "programme"
  | "commercial"
  | "correspondence"
  | "audit";

interface RecordDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record: UnifiedRecord | null;
  onUpdateRecord?: (updatedRecord: UnifiedRecord) => void;
  onEditRecord?: (record: UnifiedRecord) => void;
  onDeleteRecord?: (record: UnifiedRecord) => void;
}

export default function RecordDetailsDrawer({
  isOpen,
  onClose,
  record,
  onUpdateRecord,
  onEditRecord,
  onDeleteRecord
}: RecordDetailsDrawerProps) {
    assertOperationalAction("write", "components/engineering/RecordDetailsDrawer.tsx");
  const [activeTab, setActiveTab] = useState<DrawerTab>("technical");
  const [newResponse, setNewResponse] = useState("");
  const [newCorrespondence, setNewCorrespondence] = useState({
    subject: "",
    reference: "",
    sender: "Matrix JV Site Team",
    recipient: "Resident Engineer - Dr. A. Mwamba",
    notes: ""
  });
  const [localCorrespondence, setLocalCorrespondence] = useState<Array<{
    id: string;
    date: string;
    ref: string;
    from: string;
    to: string;
    subject: string;
    type: string;
  }>>([
    {
      id: "corr-01",
      date: "22 Feb 2025",
      ref: "TRANS-ENG-094",
      from: "Contractor Matrix JV",
      to: "Resident Engineer",
      subject: "Formal Technical Submission & RFI Notification",
      type: "Transmittal"
    },
    {
      id: "corr-02",
      date: "24 Feb 2025",
      ref: "EI-2025-044",
      from: "Resident Engineer",
      to: "Contractor Project Manager",
      subject: "Engineer's Clarification & Site Instruction Reference",
      type: "Instruction"
    }
  ]);

  if (!record || !isOpen) return null;

  // Extract common metadata
  let refId = "REF-000";
  let title = "Record Details";
  let discipline = "engineering";
  let status = "Open";
  let priority = "Normal";

  if (record.type === "RFI") {
    refId = record.data.rfiNumber || "RFI";
    title = record.data.title;
    discipline = record.data.disciplineLabel || record.data.discipline;
    status = record.data.status;
    priority = record.data.priority;
  } else if (record.type === "SUBMITTAL") {
    refId = record.data.submittalNumber || "SUB";
    title = record.data.title;
    discipline = record.data.discipline;
    status = record.data.status;
  } else if (record.type === "ASSUMPTION") {
    refId = record.data.assumptionNumber || record.data.assumptionCode || "ASSUMP";
    title = record.data.title;
    discipline = record.data.discipline;
    status = record.data.status;
    priority = record.data.criticality || "Normal";
  } else if (record.type === "DEVIATION") {
    refId = record.data.deviationNumber || "DEV";
    title = record.data.title;
    discipline = record.data.discipline;
    status = record.data.status;
  } else if (record.type === "REVIEW") {
    refId = record.data.referenceNumber || record.data.packageNumber || "DR";
    title = record.data.title;
    discipline = record.data.discipline;
    status = record.data.status;
  } else if (record.type === "CHANGE") {
    refId = record.data.changeNumber || "DCN";
    title = record.data.title;
    discipline = record.data.discipline;
    status = record.data.status;
  } else if (record.type === "SETTING_OUT") {
    refId = record.data.referenceNumber || record.data.recordNumber || "SO";
    title = record.data.elementName;
    discipline = record.data.discipline;
    status = record.data.status;
  } else if (record.type === "CONTROL_POINT") {
    refId = record.data.pointId || "CP";
    title = record.data.description;
    discipline = "Survey & Geospatial";
    status = record.data.status;
  } else if (record.type === "GENERIC") {
    refId = record.data.reference || "REC";
    title = record.data.description || record.data.title || "Record";
    discipline = record.data.discipline || "General";
    status = record.data.status || "Active";
  }

  const handleOpenDrawing = (dwgRef: string) => {
    if (!dwgRef || dwgRef === "—") return;
    const cleanRef = dwgRef.split(" ")[0].trim();
    window.location.hash = `#/documents?category=DRAWINGS&search=${encodeURIComponent(cleanRef)}`;
  };

  const handleAddResponse = () => {
    assertOperationalAction("create", "components/engineering/RecordDetailsDrawer.tsx");
    if (!newResponse.trim()) return;
    if (record.type === "RFI") {
      const updated: EngineeringRFI = {
        ...record.data,
        consultantResponse: newResponse,
        status: "Responded",
        respondedBy: "Resident Engineer - Dr. A. Mwamba",
        respondedDate: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }),
        history: [
          ...(record.data.history || []),
          {
            date: new Date().toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric"
            }),
            action: "Consultant Response Recorded",
            user: "Resident Engineer - Dr. A. Mwamba",
            details: newResponse
          }
        ]
      };
      if (onUpdateRecord) {
        onUpdateRecord({ type: "RFI", data: updated });
      }
      setNewResponse("");
    }
  };

  const handleAddCorrespondence = (e: React.FormEvent) => {
    assertOperationalAction("create", "components/engineering/RecordDetailsDrawer.tsx");
    e.preventDefault();
    if (!newCorrespondence.subject.trim()) return;
    const item = {
      id: `corr-${Date.now()}`,
      date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }),
      ref: newCorrespondence.reference || `TRANS-${Date.now().toString().slice(-4)}`,
      from: newCorrespondence.sender,
      to: newCorrespondence.recipient,
      subject: newCorrespondence.subject,
      type: "Letter"
    };
    setLocalCorrespondence((prev) => [item, ...prev]);
    setNewCorrespondence({
      subject: "",
      reference: "",
      sender: "Matrix JV Site Team",
      recipient: "Resident Engineer - Dr. A. Mwamba",
      notes: ""
    });
  };

  const getStatusBadge = (s: string) => {
    const st = (s || "").toUpperCase();
    if (st.includes("OVERDUE") || st.includes("REJECT") || st.includes("INVALID") || st.includes("CRITICAL")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0 animate-pulse" />
          {s}
        </span>
      );
    }
    if (st.includes("AWAIT") || st.includes("REVIEW") || st.includes("PENDING") || st.includes("REVISE")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          {s}
        </span>
      );
    }
    if (st.includes("APPROV") || st.includes("CLOSED") || st.includes("VALID") || st.includes("PASSED") || st.includes("VERIFIED")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1 stroke-[2.5] shrink-0" />
          {s}
        </span>
      );
    }
    return (
      <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 shrink-0" />
        {s || "Active"}
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity cursor-pointer"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="w-screen max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="p-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 font-mono text-xs font-bold border border-blue-500/40">
                      {refId}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-semibold uppercase tracking-wider">
                      {discipline}
                    </span>
                    {getStatusBadge(status)}
                  </div>
                  <h2 className="text-base font-bold text-white truncate" title={title}>
                    {title}
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onEditRecord && record && (
                    <button
                      onClick={() => onEditRecord(record)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Edit this record"
                    >
                      <Edit className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit</span>
                    </button>
                  )}
                  {onDeleteRecord && record && (
                    <button
                      onClick={() => onDeleteRecord(record)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 border border-rose-800/80 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Delete this record"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete</span>
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    aria-label="Close details drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Navigation Tabs - 7 required tabs */}
              <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1 text-xs border-b border-slate-800/80">
                <button
                  onClick={() => setActiveTab("technical")}
                  className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "technical"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Technical Details</span>
                </button>

                <button
                  onClick={() => setActiveTab("drawings")}
                  className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "drawings"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Drawings</span>
                </button>

                <button
                  onClick={() => setActiveTab("documents")}
                  className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "documents"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Documents</span>
                </button>

                <button
                  onClick={() => setActiveTab("programme")}
                  className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "programme"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Programme</span>
                </button>

                <button
                  onClick={() => setActiveTab("commercial")}
                  className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "commercial"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Commercial Impact</span>
                </button>

                <button
                  onClick={() => setActiveTab("correspondence")}
                  className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "correspondence"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Correspondence</span>
                </button>

                <button
                  onClick={() => setActiveTab("audit")}
                  className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "audit"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit Trail</span>
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* TAB 1: TECHNICAL DETAILS */}
              {activeTab === "technical" && (
                <div className="space-y-5">
                  {record.type === "RFI" && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Technical Query / Question
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-mono">
                          {record.data.questionText}
                        </p>
                        {record.data.proposedSolution && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              Proposed Contractor Solution:{" "}
                            </span>
                            <span className="text-xs text-slate-700 dark:text-slate-300">
                              {record.data.proposedSolution}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Location & Parameters */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Location / Chainage</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{record.data.location || record.data.chainage || "—"}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Specification Reference</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{record.data.specRef || "—"}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Raised By</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{record.data.raisedBy} ({record.data.raisedDate})</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Response Due Date</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">{record.data.responseDueDate || "—"}</span>
                        </div>
                      </div>

                      {/* Consultant Response Section */}
                      <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            Consultant Instruction & Formal Response
                          </span>
                          {record.data.respondedDate && (
                            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
                              Responded on {record.data.respondedDate}
                            </span>
                          )}
                        </div>

                        {record.data.consultantResponse ? (
                          <div className="space-y-2">
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                              {record.data.consultantResponse}
                            </p>
                            <div className="text-xs text-slate-500">
                              Sign-off: <strong className="text-slate-700 dark:text-slate-300">{record.data.respondedBy || "Resident Engineer"}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                              Awaiting formal response from Supervising Consultant. You can record a technical direction below:
                            </p>
                            <textarea
                              value={newResponse}
                              onChange={(e) => setNewResponse(e.target.value)}
                              placeholder="Type formal engineering response / instruction..."
                              rows={3}
                              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <div className="flex justify-end">
                              <button
                                onClick={handleAddResponse}
                                disabled={!newResponse.trim()}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Record Response</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {record.type === "SUBMITTAL" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Material Specification & Compliance</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{record.data.title}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Spec Code: <span className="font-mono font-bold text-blue-600">{record.data.specification}</span></div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Supplier: <strong className="text-slate-800 dark:text-slate-200">{record.data.supplier}</strong> (Mfg: {record.data.manufacturer || "—"})</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Revision</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{record.data.revision}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Lead Time (Weeks)</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{record.data.leadTimeWeeks ?? 2} weeks</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Purchase Order Link</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{record.data.linkedPurchaseOrder || "—"}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Critical Activity Link</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{record.data.criticalActivityRef || "ACT-092"}</span>
                        </div>
                      </div>

                      {record.data.consultantRemarks && (
                        <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block mb-1">Consultant Remarks / Conditions</span>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{record.data.consultantRemarks}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {record.type === "ASSUMPTION" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Design Basis Statement</div>
                        <p className="text-sm text-slate-800 dark:text-slate-200">{record.data.designBasis || record.data.statement || record.data.title}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Validation Trigger</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{record.data.validationTrigger || "Plate load test before pour"}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Site Hold Point</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">{record.data.siteTriggerHoldPoint || "HP-01"}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Location</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{record.data.targetLocation || "Chainage Km 14+250"}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Action Owner</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{record.data.actionOwner || "Lead Engineer"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {record.type === "DEVIATION" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Proposed Departure & Justification</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{record.data.proposedDeparture || record.data.proposedDeviation || record.data.title}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{record.data.engineeringJustification || "Thermal and durability validation performed."}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Spec Clause</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{record.data.specificationClause || "03 30 00"}</span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Approved By</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{record.data.approvedBy}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {record.type === "CHANGE" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason For Change</div>
                        <p className="text-sm text-slate-800 dark:text-slate-200">{record.data.reason || record.data.reasonForChange}</p>
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                          <strong className="text-slate-700 dark:text-slate-300">Technical Scope Delta: </strong>
                          <span className="text-slate-600 dark:text-slate-400">{record.data.technical?.whatChanged || record.data.technicalImpact?.whatChanged || "Geometry and capacity modification"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {record.type === "SETTING_OUT" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Δ Easting</span>
                          <span className="text-sm font-bold text-blue-600">{record.data.deltaEastingMm > 0 ? `+${record.data.deltaEastingMm}` : record.data.deltaEastingMm} mm</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Δ Northing</span>
                          <span className="text-sm font-bold text-blue-600">{record.data.deltaNorthingMm > 0 ? `+${record.data.deltaNorthingMm}` : record.data.deltaNorthingMm} mm</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Δ Elevation</span>
                          <span className="text-sm font-bold text-blue-600">{record.data.deltaElevationMm > 0 ? `+${record.data.deltaElevationMm}` : record.data.deltaElevationMm} mm</span>
                        </div>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                        <div>Surveyor: <strong>{record.data.surveyor}</strong></div>
                        <div>Instrument: <span className="text-slate-600 dark:text-slate-400">{record.data.instrumentUsed}</span></div>
                        <div>Tolerance: <span className="font-mono">±{record.data.toleranceMm} mm</span></div>
                      </div>
                    </div>
                  )}

                  {record.type === "CONTROL_POINT" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Easting (m)</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{record.data.easting.toFixed(4)}</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Northing (m)</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{record.data.northing.toFixed(4)}</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Elevation (m)</span>
                          <span className="text-sm font-bold text-blue-600">{record.data.elevation.toFixed(4)}m</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {record.type === "GENERIC" && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{record.data.description}</div>
                      <div>Discipline: <strong>{record.data.discipline}</strong></div>
                      <div>Responsible: <strong>{record.data.responsible || "Assigned Engineer"}</strong></div>
                      <div>Due Date: <span className="font-mono text-rose-600 font-bold">{record.data.dueDate}</span></div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DRAWINGS */}
              {activeTab === "drawings" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Cross-Referenced Contract Drawings
                    </div>

                    {record.type === "RFI" && record.data.drawingRef && (
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2.5">
                          <Compass className="w-5 h-5 text-blue-600" />
                          <div>
                            <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              {record.data.drawingRef}
                            </div>
                            <span className="text-[11px] text-slate-500">Contract Structural / Civil Drawing</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenDrawing(record.data.drawingRef)}
                          className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open in Documents</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {record.type === "CHANGE" && (
                      <div className="space-y-2">
                        {(record.data.technical?.drawingRevisions || ["DR-104 Rev B", "DR-105 Rev A"]).map((dwg, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2.5">
                              <Compass className="w-5 h-5 text-blue-600" />
                              <div>
                                <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">{dwg}</div>
                                <span className="text-[11px] text-slate-500">Superseding Drawing Revision</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenDrawing(dwg)}
                              className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {record.type !== "RFI" && record.type !== "CHANGE" && (
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Compass className="w-5 h-5 text-blue-600" />
                          <div>
                            <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">STR-042 Rev C</div>
                            <span className="text-[11px] text-slate-500">General Structural Alignment Plan</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenDrawing("STR-042")}
                          className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open in Documents</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: DOCUMENTS */}
              {activeTab === "documents" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Technical Documents & Evidence
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs">
                            PDF
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {refId}_Technical_Submittal_Package.pdf
                            </div>
                            <span className="text-[11px] text-slate-400">2.4 MB • Certified Design Sheet</span>
                          </div>
                        </div>
                        <a
                          href={`#/documents?category=CALCULATIONS&search=${encodeURIComponent(refId)}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                            DWG
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              Site_Layout_Conflict_Detail.dwg
                            </div>
                            <span className="text-[11px] text-slate-400">5.1 MB • CAD As-Built Extract</span>
                          </div>
                        </div>
                        <a
                          href={`#/documents?category=DRAWINGS&search=${encodeURIComponent(refId)}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: PROGRAMME */}
              {activeTab === "programme" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Schedule & Critical Path Impact
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Schedule Delta</span>
                        <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                          {record.type === "RFI" && record.data.programmeImpact
                            ? `+${record.data.programmeImpact.durationImpactDays} Days`
                            : record.type === "CHANGE" && record.data.programmeImpact
                            ? `+${record.data.programmeImpact.durationImpactDays ?? 0} Days`
                            : "0 Days (Within Float)"}
                        </span>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Critical Path Status</span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-xs mt-0.5 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span>{record.type === "RFI" && record.data.programmeImpact?.isCriticalPath ? "Critical Path Driving" : "Off Critical Path / Float Absorbed"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Associated CPM Activity</span>
                      <div className="font-mono font-bold text-blue-600">
                        {record.type === "RFI" ? record.data.programmeImpact?.activityId || "ACT-092" : "ACT-092"} - Substructure Pier P14
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] pt-1">
                        Linked directly to Programme Baseline. Mitigation: Fast-track curing cycle using approved accelerator.
                      </p>
                    </div>

                    <div className="pt-2">
                      <a
                        href="#/programme"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <span>Inspect in Programme CPM Gantt</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: COMMERCIAL IMPACT */}
              {activeTab === "commercial" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Contract & Commercial Evaluation
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Estimated Cost Variance</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white">
                          {record.type === "RFI" && record.data.commercialImpact?.estimatedCostImpact
                            ? `$${record.data.commercialImpact.estimatedCostImpact.toLocaleString()}`
                            : record.type === "CHANGE" && record.data.commercialImpact?.costImpact
                            ? `$${record.data.commercialImpact.costImpact.toLocaleString()}`
                            : "$35,000"}
                        </span>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Variation Status</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">Potential Variation Notice</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Contract Clause Reference</span>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {record.type === "RFI" && record.data.contractClauseRef
                          ? `${record.data.contractClauseRef.framework} - ${record.data.contractClauseRef.clauseNumber} (${record.data.contractClauseRef.clauseTitle})`
                          : "FIDIC Red Book 2017 - Sub-Clause 1.9 (Delayed Drawings or Instructions)"}
                      </div>
                    </div>

                    <div className="pt-2">
                      <a
                        href="#/commercial"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <span>Inspect in Commercial / Contract Management</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: CORRESPONDENCE */}
              {activeTab === "correspondence" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Official Transmittals & Letters
                    </div>

                    <div className="space-y-2">
                      {localCorrespondence.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{c.ref}</span>
                            <span className="text-slate-400 text-[10px]">{c.date}</span>
                          </div>
                          <div className="font-semibold text-slate-900 dark:text-white">{c.subject}</div>
                          <div className="text-[11px] text-slate-500">
                            From: <span className="text-slate-700 dark:text-slate-300">{c.from}</span> → To: <span className="text-slate-700 dark:text-slate-300">{c.to}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Log New Transmittal Note */}
                    <form onSubmit={handleAddCorrespondence} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Log Formal Correspondence</span>
                      <input
                        type="text"
                        placeholder="Subject / Notice Title..."
                        value={newCorrespondence.subject}
                        onChange={(e) => setNewCorrespondence({ ...newCorrespondence, subject: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Ref / Letter # (e.g. LTR-2025-081)"
                          value={newCorrespondence.reference}
                          onChange={(e) => setNewCorrespondence({ ...newCorrespondence, reference: e.target.value })}
                          className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                        <button
                          type="submit"
                          disabled={!newCorrespondence.subject.trim()}
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Correspondence</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 7: AUDIT TRAIL */}
              {activeTab === "audit" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Lifecycle Audit History
                    </div>

                    <div className="relative pl-6 space-y-4 border-l border-slate-200 dark:border-slate-700 ml-2">
                      {record.type === "RFI" && record.data.history && record.data.history.length > 0 ? (
                        record.data.history.map((h, i) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900" />
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{h.action}</div>
                            <div className="text-[11px] text-slate-500">{h.user} • {h.date}</div>
                            {h.details && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{h.details}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="relative">
                            <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900" />
                            <div className="text-xs font-bold text-slate-900 dark:text-white">Record Created & Registered</div>
                            <div className="text-[11px] text-slate-500">Thabo Nkosi (Site Engineer) • 22 Feb 2025 08:30</div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Initial entry in Project Matrix engineering register.</p>
                          </div>
                          <div className="relative">
                            <span className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900" />
                            <div className="text-xs font-bold text-slate-900 dark:text-white">Transmitted to Supervising Consultant</div>
                            <div className="text-[11px] text-slate-500">Document Controller • 22 Feb 2025 10:15</div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Formally issued under Sub-Clause 1.9.</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="font-mono">Record: {refId}</span>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
