import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  FileCheck,
  HelpCircle,
  ShieldCheck,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ExternalLink,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Send,
  Building,
  UserCheck,
  Paperclip,
  Check,
  X,
  Sparkles,
  Link as LinkIcon,
  Tag,
  ArrowRight,
  SlidersHorizontal,
  Eye,
  Scale,
  Pencil,
  Trash2,
  Loader2,
  LayoutGrid,
  Columns2,
  Package
} from "lucide-react";
import {
  EngineeringRFI,
  TechnicalSubmittal,
  DesignAssumption,
  EngineeringDeviation,
  EngineeringDisciplineId,
  ImpactLevel,
  RFIStatus,
  SubmittalStatus,
  ProcurementSyncStatus
} from "../../types/engineering";
import { MASTER_ENGINEERING_DISCIPLINES } from "../../data/engineeringData";

interface TechnicalControlHubProps {
  rfis: EngineeringRFI[];
  submittals: TechnicalSubmittal[];
  assumptions: DesignAssumption[];
  deviations: EngineeringDeviation[];
  onAddRFI: (rfi: EngineeringRFI) => Promise<any> | void;
  onUpdateRFI: (rfi: EngineeringRFI) => Promise<any> | void;
  onDeleteRFI?: (id: string) => Promise<any> | void;
  isLoadingRFIs?: boolean;
  rfiError?: string | null;
  onAddSubmittal: (sub: TechnicalSubmittal) => void;
  onUpdateSubmittal: (sub: TechnicalSubmittal) => void;
  onDeleteSubmittal?: (id: string) => void;
  onAddAssumption?: (assump: DesignAssumption) => void;
  onUpdateAssumption?: (assump: DesignAssumption) => void;
  onDeleteAssumption?: (id: string) => void;
  onAddDeviation?: (dev: EngineeringDeviation) => void;
  onUpdateDeviation?: (dev: EngineeringDeviation) => void;
  onDeleteDeviation?: (id: string) => void;
  activeDisciplineFilter: string;
  onSelectDisciplineFilter: (discipline: string) => void;
  availableDisciplines: { id: EngineeringDisciplineId; name: string; code: string }[];
  currentUser?: any;
  activeProject?: any;
  activeCompany?: any;
}

export default function TechnicalControlHub({
  rfis,
  submittals,
  assumptions,
  deviations,
  onAddRFI,
  onUpdateRFI,
  onDeleteRFI,
  isLoadingRFIs = false,
  rfiError = null,
  onAddSubmittal,
  onUpdateSubmittal,
  onDeleteSubmittal,
  onAddAssumption,
  onUpdateAssumption,
  onDeleteAssumption,
  onAddDeviation,
  onUpdateDeviation,
  onDeleteDeviation,
  activeDisciplineFilter,
  onSelectDisciplineFilter,
  availableDisciplines,
  currentUser,
  activeProject,
  activeCompany
}: TechnicalControlHubProps) {
  // Sub-tab selection within Technical Control
  const [subSection, setSubSection] = useState<"rfis" | "submittals" | "assumptions" | "deviations">("rfis");

  // Selection states for split-screen detail views
  const [selectedRfiId, setSelectedRfiId] = useState<string>(rfis[0]?.id || "");
  const [selectedSubmittalId, setSelectedSubmittalId] = useState<string>(submittals[0]?.id || "");
  const [selectedAssumptionId, setSelectedAssumptionId] = useState<string>(assumptions[0]?.id || "");
  const [selectedDeviationId, setSelectedDeviationId] = useState<string>(deviations[0]?.id || "");

  // View mode toggle: cards (responsive information cards) vs split (register + dossier)
  const [viewMode, setViewMode] = useState<"cards" | "split">("cards");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Modals & form states - RFI
  const [isNewRfiModalOpen, setIsNewRfiModalOpen] = useState(false);
  const [editingRfi, setEditingRfi] = useState<EngineeringRFI | null>(null);
  const [deletingRfi, setDeletingRfi] = useState<EngineeringRFI | null>(null);
  const [viewingRfi, setViewingRfi] = useState<EngineeringRFI | null>(null);
  const [isSavingRfi, setIsSavingRfi] = useState(false);
  const [isDeletingRfi, setIsDeletingRfi] = useState(false);
  const [rfiActionError, setRfiActionError] = useState<string | null>(null);

  // Modals & form states - Submittals
  const [isNewSubmittalModalOpen, setIsNewSubmittalModalOpen] = useState(false);
  const [editingSubmittal, setEditingSubmittal] = useState<TechnicalSubmittal | null>(null);
  const [deletingSubmittal, setDeletingSubmittal] = useState<TechnicalSubmittal | null>(null);
  const [viewingSubmittal, setViewingSubmittal] = useState<TechnicalSubmittal | null>(null);

  // Modals & form states - Assumptions
  const [isNewAssumptionModalOpen, setIsNewAssumptionModalOpen] = useState(false);
  const [editingAssumption, setEditingAssumption] = useState<DesignAssumption | null>(null);
  const [deletingAssumption, setDeletingAssumption] = useState<DesignAssumption | null>(null);
  const [viewingAssumption, setViewingAssumption] = useState<DesignAssumption | null>(null);

  // Modals & form states - Deviations
  const [isNewDeviationModalOpen, setIsNewDeviationModalOpen] = useState(false);
  const [editingDeviation, setEditingDeviation] = useState<EngineeringDeviation | null>(null);
  const [deletingDeviation, setDeletingDeviation] = useState<EngineeringDeviation | null>(null);
  const [viewingDeviation, setViewingDeviation] = useState<EngineeringDeviation | null>(null);

  // Response quick-input state
  const [responseText, setResponseText] = useState("");
  const [responderName, setResponderName] = useState("Dr. A. Mwamba (Resident Engineer)");

  // Helper to open drawing in the central Documents module
  const handleOpenDrawingInDocuments = (drawingRef: string) => {
    if (!drawingRef || drawingRef === "—") return;
    const cleanRef = drawingRef.split(" ")[0].trim();
    window.location.hash = `#/documents?category=DRAWINGS&search=${encodeURIComponent(cleanRef)}`;
  };

  // Helper for status badge rendering according to specified color rules
  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("OVERDUE") || s.includes("REJECT") || s.includes("INVALID") || s.includes("CRITICAL")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shrink-0" title={status}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0 animate-pulse" />
          <span className="whitespace-nowrap">{status}</span>
        </span>
      );
    }
    if (s.includes("AWAIT") || s.includes("REVIEW") || s.includes("PENDING") || s.includes("EVALUATION") || s.includes("REVISE")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shrink-0" title={status}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status}</span>
        </span>
      );
    }
    if (s.includes("SUBMIT") || s.includes("OPEN") || s.includes("IN PROGRESS") || s.includes("RESPONDED") || s.includes("STANDARD")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 shrink-0" title={status}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status}</span>
        </span>
      );
    }
    if (s.includes("APPROV") || s.includes("CLOSED") || s.includes("VALID") || s.includes("RESOLVED") || s.includes("COMPLETE") || s.includes("VERIFIED")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shrink-0" title={status}>
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1 stroke-[2.5] shrink-0" />
          <span className="whitespace-nowrap">{status}</span>
        </span>
      );
    }
    // Grey default for draft/superseded/archived/withdrawn
    return (
      <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0" title={status || "—"}>
        <span className="whitespace-nowrap">{status || "—"}</span>
      </span>
    );
  };

  const getPriorityBadge = (priority: ImpactLevel | string) => {
    const p = (priority || "").toUpperCase();
    if (p === "CRITICAL") {
      return (
        <span className="whitespace-nowrap inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 shrink-0 tracking-wide" title="CRITICAL">
          CRITICAL
        </span>
      );
    }
    if (p === "HIGH") {
      return (
        <span className="whitespace-nowrap inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800 shrink-0 tracking-wide" title="HIGH">
          HIGH
        </span>
      );
    }
    if (p === "MEDIUM") {
      return (
        <span className="whitespace-nowrap inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shrink-0 tracking-wide" title="MEDIUM">
          MEDIUM
        </span>
      );
    }
    return (
      <span className="whitespace-nowrap inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 tracking-wide" title={priority || "LOW"}>
        {priority || "LOW"}
      </span>
    );
  };

  // Filtered RFIs
  const filteredRfis = useMemo(() => {
    return rfis.filter((r) => {
      const matchSearch =
        !searchQuery ||
        (r.rfiNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.drawingRef || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.location || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.questionText || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchDisc = activeDisciplineFilter === "all" || r.discipline === activeDisciplineFilter;
      const matchStatus = statusFilter === "ALL" || r.status.toUpperCase() === statusFilter.toUpperCase();
      const matchPriority = priorityFilter === "ALL" || r.priority.toUpperCase() === priorityFilter.toUpperCase();
      return matchSearch && matchDisc && matchStatus && matchPriority;
    });
  }, [rfis, searchQuery, activeDisciplineFilter, statusFilter, priorityFilter]);

  // Filtered Submittals
  const filteredSubmittals = useMemo(() => {
    return submittals.filter((s) => {
      const matchSearch =
        !searchQuery ||
        (s.submittalNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.supplier || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.specification || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchDisc = activeDisciplineFilter === "all" || s.discipline === activeDisciplineFilter;
      const matchStatus = statusFilter === "ALL" || s.status.toUpperCase() === statusFilter.toUpperCase();
      return matchSearch && matchDisc && matchStatus;
    });
  }, [submittals, searchQuery, activeDisciplineFilter, statusFilter]);

  // Filtered Assumptions
  const filteredAssumptions = useMemo(() => {
    return assumptions.filter((a) => {
      const matchSearch =
        !searchQuery ||
        (a.assumptionNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.designBasis || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchDisc = activeDisciplineFilter === "all" || a.discipline === activeDisciplineFilter;
      return matchSearch && matchDisc;
    });
  }, [assumptions, searchQuery, activeDisciplineFilter]);

  // Filtered Deviations
  const filteredDeviations = useMemo(() => {
    return deviations.filter((d) => {
      const matchSearch =
        !searchQuery ||
        (d.deviationNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.specificationClause || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchDisc = activeDisciplineFilter === "all" || d.discipline === activeDisciplineFilter;
      return matchSearch && matchDisc;
    });
  }, [deviations, searchQuery, activeDisciplineFilter]);

  // Currently selected item objects
  const currentRfi = useMemo(() => {
    return rfis.find((r) => r.id === selectedRfiId) || filteredRfis[0] || rfis[0] || null;
  }, [rfis, selectedRfiId, filteredRfis]);

  const currentSubmittal = useMemo(() => {
    return submittals.find((s) => s.id === selectedSubmittalId) || filteredSubmittals[0] || submittals[0] || null;
  }, [submittals, selectedSubmittalId, filteredSubmittals]);

  const currentAssumption = useMemo(() => {
    return assumptions.find((a) => a.id === selectedAssumptionId) || filteredAssumptions[0] || assumptions[0] || null;
  }, [assumptions, selectedAssumptionId, filteredAssumptions]);

  const currentDeviation = useMemo(() => {
    return deviations.find((d) => d.id === selectedDeviationId) || filteredDeviations[0] || deviations[0] || null;
  }, [deviations, selectedDeviationId, filteredDeviations]);

  // Keep selected item valid when RFIs change
  React.useEffect(() => {
    if (rfis.length > 0) {
      if (!selectedRfiId || !rfis.some((r) => r.id === selectedRfiId)) {
        setSelectedRfiId(rfis[0].id);
      }
    }
  }, [rfis, selectedRfiId]);

  // Quick action: Submit Consultant Response on current RFI
  const handleSaveConsultantResponse = async () => {
    assertOperationalAction("write", "components/engineering/TechnicalControlHub.tsx");
    if (!currentRfi || !responseText.trim()) return;
    const updated: EngineeringRFI = {
      ...currentRfi,
      consultantResponse: responseText,
      respondedBy: responderName || "Supervising Consultant",
      respondedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: "Responded"
    };
    try {
      setIsSavingRfi(true);
      await onUpdateRFI(updated);
      setResponseText("");
    } catch (err: any) {
      console.error("Failed to save consultant response:", err);
      alert(err?.message || "Failed to commit response");
    } finally {
      setIsSavingRfi(false);
    }
  };

  // Quick action: Mark RFI as Closed
  const handleCloseRfi = async (rfi: EngineeringRFI) => {
    const updated: EngineeringRFI = {
      ...rfi,
      status: "Closed"
    };
    try {
      setIsSavingRfi(true);
      await onUpdateRFI(updated);
    } catch (err: any) {
      console.error("Failed to close RFI:", err);
      alert(err?.message || "Failed to close Technical Query");
    } finally {
      setIsSavingRfi(false);
    }
  };

  // Quick action: Update Submittal Status
  const handleSetSubmittalStatus = (sub: TechnicalSubmittal, newStatus: SubmittalStatus) => {
    const updated: TechnicalSubmittal = {
      ...sub,
      status: newStatus,
      approvedBy: "Resident Engineer - Dr. A. Mwamba",
      approvalDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      procurementStatus: newStatus === "APPROVED" || newStatus === "APPROVED_AS_NOTED" ? "Approved for Procurement" : sub.procurementStatus
    };
    onUpdateSubmittal(updated);
  };

  return (
    <div className="space-y-4">
      {/* KPI Performance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {subSection === "rfis" && (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total RFIs</span>
                <FileText className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5">{rfis.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Logged across all disciplines</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Awaiting Consultant</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
                {rfis.filter(r => (r.status as string) === "Awaiting Consultant" || (r.status as string) === "Under Review" || (r.status as string) === "AWAITING_CONSULTANT").length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Pending formal determination</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">High / Critical Risk</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1.5">
                {rfis.filter(r => (r.priority || "").toUpperCase() === "CRITICAL" || (r.priority || "").toUpperCase() === "HIGH").length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Critical path schedule exposure</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Commercial Impact</span>
                <Scale className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1.5">
                ${((rfis.filter(r => r.commercialImpact?.hasImpact).reduce((acc, curr) => acc + (curr.commercialImpact?.estimatedCostImpact || 0), 0)) / 1000).toFixed(0)}k
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Potential contractor variation</div>
            </div>
          </>
        )}

        {subSection === "submittals" && (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Submittals</span>
                <FileCheck className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5">{submittals.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Materials & equipment submissions</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Materials</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
                {submittals.filter(s => s.status === "APPROVED" || s.status === "APPROVED_AS_NOTED").length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Cleared for site delivery</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Under Review</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
                {submittals.filter(s => s.status === "UNDER_REVIEW").length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">With Supervising Engineer</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Procurement Cleared</span>
                <Package className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1.5">
                {submittals.filter(s => s.procurementStatus?.includes("Approved")).length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">PO & manufacturing released</div>
            </div>
          </>
        )}

        {subSection === "assumptions" && (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Assumptions</span>
                <HelpCircle className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5">{assumptions.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Design basis assumptions</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Active Monitoring</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
                {assumptions.filter(a => (a.status as string) === "Active" || (a.status as string) === "Pending Verification" || (a.status as string) === "Awaiting Site Verification").length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Awaiting site ground truth</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Site Validated</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
                {assumptions.filter(a => (a.status as string) === "Validated" || (a.status as string) === "Validated on Site" || (a.status as string) === "VERIFIED_ON_SITE").length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Verified against ground reality</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Critical Exposure</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1.5">
                {assumptions.filter(a => String((a as any).impactLevel || (a as any).criticality || "").toUpperCase().includes("HIGH") || String((a as any).impactLevel || "").toUpperCase().includes("CRITICAL")).length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">High redesign/cost exposure</div>
            </div>
          </>
        )}

        {subSection === "deviations" && (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Deviations</span>
                <ShieldCheck className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5">{deviations.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Registered specification concessions</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Concessions</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
                {deviations.filter(d => d.status === "Approved" || d.status === "Approved with Conditions").length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Authorized technical departures</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Under Technical Review</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
                {deviations.filter(d => d.status === "Under Review" || d.status === "Pending").length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">With Lead Discipline Engineer</div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Clauses Impacted</span>
                <Tag className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1.5">
                {new Set(deviations.map(d => d.specificationClause)).size}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Contract specifications affected</div>
            </div>
          </>
        )}
      </div>

      {/* 1. Sub-sections Navigation & Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Sub-tabs pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                setSubSection("rfis");
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subSection === "rfis"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Technical Queries / RFIs</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subSection === "rfis" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {rfis.length}
              </span>
            </button>

            <button
              onClick={() => {
                setSubSection("submittals");
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subSection === "submittals"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Technical Submittals</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subSection === "submittals" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {submittals.length}
              </span>
            </button>

            <button
              onClick={() => {
                setSubSection("assumptions");
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subSection === "assumptions"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Design Assumptions</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subSection === "assumptions" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {assumptions.length}
              </span>
            </button>

            <button
              onClick={() => {
                setSubSection("deviations");
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subSection === "deviations"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Engineering Deviations</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subSection === "deviations" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                {deviations.length}
              </span>
            </button>
          </div>

          {/* Quick Action Buttons & View Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "split"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Split Register & Dossier View"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Split / Table</span>
              </button>
            </div>

            {subSection === "rfis" && (
              <button
                onClick={() => setIsNewRfiModalOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Technical Query</span>
              </button>
            )}

            {subSection === "submittals" && (
              <button
                onClick={() => setIsNewSubmittalModalOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Submittal</span>
              </button>
            )}

            {subSection === "assumptions" && (
              <button
                onClick={() => setIsNewAssumptionModalOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Assumption</span>
              </button>
            )}

            {subSection === "deviations" && (
              <button
                onClick={() => setIsNewDeviationModalOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Deviation</span>
              </button>
            )}
          </div>
        </div>

        {/* Search and Secondary Filter Row */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${subSection.toUpperCase()} by ref, title, drawing, location...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-[11px] font-semibold text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                {subSection === "rfis" && (
                  <>
                    <option value="AWAITING CONSULTANT">Awaiting Consultant</option>
                    <option value="RESPONDED">Responded</option>
                    <option value="CLOSED">Closed</option>
                    <option value="OVERDUE">Overdue</option>
                  </>
                )}
                {subSection === "submittals" && (
                  <>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="APPROVED_AS_NOTED">Approved as Noted</option>
                    <option value="REVISE_RESUBMIT">Revise & Resubmit</option>
                    <option value="REJECTED">Rejected</option>
                  </>
                )}
              </select>
            </div>

            {/* Priority Filter for RFIs */}
            {subSection === "rfis" && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="text-[11px] font-semibold text-slate-400">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 2. RFIs SECTION: CARDS VIEW OR SPLIT-SCREEN 60/40                         */}
      {/* ========================================================================= */}
      {subSection === "rfis" && (
        viewMode === "cards" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Technical Queries & RFIs ({filteredRfis.length})
              </span>
              <button
                type="button"
                onClick={() => setIsNewRfiModalOpen(true)}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Raise New Query</span>
              </button>
            </div>

            {filteredRfis.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">No Technical Queries match the current filters.</p>
                <button
                  type="button"
                  onClick={() => setIsNewRfiModalOpen(true)}
                  className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Raise New Query</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredRfis.map((rfi) => (
                  <div
                    key={rfi.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between min-h-[300px]"
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">
                            {rfi.rfiNumber}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {rfi.disciplineLabel || rfi.discipline}
                          </span>
                          {getPriorityBadge(rfi.priority)}
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(rfi.status)}
                        </div>
                      </div>

                      {/* Title & Location */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2" title={rfi.title}>
                          {rfi.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                          <span>Loc: <strong className="text-slate-700 dark:text-slate-300 font-medium">{rfi.location || "Site"}</strong></span>
                          {rfi.chainage && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{rfi.chainage}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Technical References */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Drawing Ref</span>
                          {rfi.drawingRef ? (
                            <button
                              type="button"
                              onClick={() => handleOpenDrawingInDocuments(rfi.drawingRef)}
                              className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline truncate block text-left cursor-pointer"
                              title={rfi.drawingRef}
                            >
                              {rfi.drawingRef}
                            </button>
                          ) : (
                            <span className="font-mono text-slate-400 truncate block">—</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Spec Ref</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300 truncate block" title={rfi.specRef}>
                            {rfi.specRef || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Question snippet */}
                      {rfi.questionText && (
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                          {rfi.questionText}
                        </div>
                      )}

                      {/* Consultant Response snippet */}
                      {rfi.consultantResponse && (
                        <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border-l-2 border-emerald-500 text-[11px] text-emerald-900 dark:text-emerald-300">
                          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">
                            <span>Consultant Determination</span>
                            <span>{rfi.respondedDate || "Responded"}</span>
                          </div>
                          <p className="line-clamp-2 leading-relaxed">{rfi.consultantResponse}</p>
                        </div>
                      )}

                      {/* Impacts */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {rfi.criticalPathImpact && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold">
                            Critical Path Delay (+{rfi.scheduleDelayDays || 3}d)
                          </span>
                        )}
                        {rfi.commercialImpact?.hasImpact && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">
                            Variation (${((rfi.commercialImpact?.estimatedCostImpact || 0) / 1000).toFixed(0)}k)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions footer with View, Edit, Delete */}
                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-medium truncate">
                        Due: {rfi.responseDueDate || "Pending"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingRfi(rfi)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="View Technical Query Dossier"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRfi(rfi);
                            setRfiActionError(null);
                          }}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit Technical Query"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingRfi(rfi);
                            setRfiActionError(null);
                          }}
                          className="px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete Technical Query"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch lg:h-[calc(100vh-310px)] lg:min-h-[600px]">
          {/* LEFT 60% REGISTER TABLE (7 of 12 cols on desktop) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col h-full">
            <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Technical Queries Register ({filteredRfis.length})
                </h3>
                {isLoadingRFIs && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Click row to inspect dossier
              </span>
            </div>

            {rfiError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{rfiError}</span>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white dark:bg-slate-900">
              <table className="w-full table-fixed text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-2.5 px-3 w-[75px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Ref #</th>
                    <th className="py-2.5 px-3 min-w-0 border-b border-slate-200 dark:border-slate-700">Query Title & Location</th>
                    <th className="py-2.5 px-3 w-[80px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Discipline</th>
                    <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Drawing Ref</th>
                    <th className="py-2.5 px-3 w-[78px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Priority</th>
                    <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 w-[85px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRfis.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-xs">No Technical Queries found matching criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRfis.map((rfi) => {
                      const isSelected = currentRfi?.id === rfi.id;
                      return (
                        <tr
                          key={rfi.id}
                          onClick={() => setSelectedRfiId(rfi.id)}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50/80 dark:bg-blue-950/40 font-medium"
                              : "hover:bg-slate-50 dark:hover:bg-slate-850/60"
                          }`}
                        >
                          {/* Ref # */}
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                            {rfi.rfiNumber || "—"}
                          </td>

                          {/* Title & Location */}
                          <td className="py-2.5 px-3 min-w-0 truncate overflow-hidden">
                            <div className="font-bold text-slate-900 dark:text-white truncate" title={rfi.title}>
                              {rfi.title || "—"}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {rfi.location || "Site Location"} {rfi.chainage ? `• ${rfi.chainage}` : ""}
                            </div>
                          </td>

                          {/* Discipline */}
                          <td className="py-2.5 px-3 whitespace-nowrap truncate overflow-hidden">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {rfi.disciplineLabel || rfi.discipline}
                            </span>
                          </td>

                          {/* Drawing Ref (Clickable to Documents) */}
                          <td className="py-2.5 px-3 whitespace-nowrap truncate overflow-hidden">
                            {rfi.drawingRef ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrawingInDocuments(rfi.drawingRef);
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-[11px] flex items-center gap-1 truncate text-left cursor-pointer"
                                title={`Open ${rfi.drawingRef} in Documents module`}
                              >
                                <span className="truncate">{rfi.drawingRef}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-75" />
                              </button>
                            ) : (
                              <span className="text-slate-400 font-mono">—</span>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {getPriorityBadge(rfi.priority)}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {getStatusBadge(rfi.status)}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingRfi(rfi);
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-blue-600 transition-colors"
                                title="View Dossier"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRfi(rfi);
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-amber-600 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingRfi(rfi);
                                }}
                                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded text-slate-500 hover:text-rose-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Strip */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <span>Showing {filteredRfis.length} of {rfis.length} Technical Queries</span>
              <div className="flex items-center gap-3">
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {rfis.filter(r => r.status === "Awaiting Consultant").length} Awaiting Consultant
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {rfis.filter(r => r.status === "Closed").length} Closed
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT 40% DETAIL PANEL (5 of 12 cols on desktop) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col h-full">
            {currentRfi ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
                {/* Dossier Header */}
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs rounded">
                        {currentRfi.rfiNumber}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] rounded">
                        {currentRfi.disciplineLabel || currentRfi.discipline}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(currentRfi.status)}
                      <button
                        type="button"
                        onClick={() => {
                          setRfiActionError(null);
                          setEditingRfi(currentRfi);
                        }}
                        className="px-2 py-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                        title="Edit Technical Query"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      {onDeleteRFI && (
                        <button
                          type="button"
                          onClick={() => {
                            setRfiActionError(null);
                            setDeletingRfi(currentRfi);
                          }}
                          className="px-2 py-1 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                          title="Delete Technical Query"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {currentRfi.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-2">
                    <span>Raised By: <strong className="text-slate-700 dark:text-slate-300">{currentRfi.raisedBy || "—"}</strong></span>
                    <span>•</span>
                    <span>Date: <strong>{currentRfi.raisedDate || "—"}</strong></span>
                    <span>•</span>
                    <span>Due: <strong className="text-amber-600 dark:text-amber-400">{currentRfi.responseDueDate || "—"}</strong></span>
                  </div>
                </div>

                {/* Controlled Drawing & Specification Reference Box */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Controlled Drawing & Spec Reference</span>
                    <span className="text-[9px] text-slate-400 font-mono">Source of Truth: Documents</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Drawing Reference:</span>
                      {currentRfi.drawingRef ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDrawingInDocuments(currentRfi.drawingRef)}
                          className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 mt-0.5 cursor-pointer text-left"
                          title="Open official drawing in Documents module"
                        >
                          <span className="truncate">{currentRfi.drawingRef}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </button>
                      ) : (
                        <span className="font-mono text-slate-400">—</span>
                      )}
                    </div>

                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Spec Clause Reference:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block mt-0.5 truncate">
                        {currentRfi.specRef || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Query Question Text */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Contractor Clarification / Technical Query:
                  </span>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {currentRfi.questionText || "No question text logged."}
                  </div>
                </div>

                {/* Proposed Contractor Solution */}
                {currentRfi.proposedSolution && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Proposed Contractor Solution:
                    </span>
                    <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                      {currentRfi.proposedSolution}
                    </div>
                  </div>
                )}

                {/* Cross-Module Linkages: Programme, Commercial, Contract */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Cross-Module Impact Assessment
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Programme Milestone Linkage */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>Programme Schedule</span>
                        <Calendar className="w-3 h-3 text-blue-500" />
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate">
                        {currentRfi.programmeImpact?.activityName || currentRfi.programmeImpact?.activityId || "—"}
                      </div>
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        {currentRfi.programmeImpact?.durationImpactDays ? `+${currentRfi.programmeImpact.durationImpactDays} Days Impact` : "0 Days (Float)"}
                      </div>
                    </div>

                    {/* Commercial / Variation Linkage */}
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>Commercial Potential</span>
                        <Scale className="w-3 h-3 text-emerald-500" />
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] truncate">
                        {currentRfi.commercialImpact?.potentialVariation ? "Potential Variation Order" : "No Cost Variance"}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {currentRfi.commercialImpact?.estimatedCostImpact ? `$${currentRfi.commercialImpact.estimatedCostImpact.toLocaleString()}` : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Contract Framework Clause */}
                  {currentRfi.contractClauseRef && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span>Contract: <strong>{currentRfi.contractClauseRef.framework || "FIDIC Red Book"}</strong></span>
                      <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                        {currentRfi.contractClauseRef.clauseNumber || "Sub-Clause 1.9"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Consultant Response Section */}
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Official Supervising Consultant Response</span>
                    {currentRfi.respondedDate && (
                      <span className="text-[9px] text-slate-400 font-mono">
                        Responded: {currentRfi.respondedDate} by {currentRfi.respondedBy}
                      </span>
                    )}
                  </span>

                  {currentRfi.consultantResponse ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-2 text-xs text-emerald-950 dark:text-emerald-200">
                      <p className="leading-relaxed whitespace-pre-wrap">{currentRfi.consultantResponse}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-emerald-200 dark:border-emerald-900/50 text-[10px]">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          Sign-off: {currentRfi.respondedBy || "Supervising Engineer"}
                        </span>
                        {currentRfi.status !== "Closed" && (
                          <button
                            onClick={() => handleCloseRfi(currentRfi)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer transition-colors"
                          >
                            Mark as Closed
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3">
                      <p className="text-[11px] text-slate-500 italic">
                        Pending official consultant determination. Use the input below to register the formal reply:
                      </p>
                      <textarea
                        rows={3}
                        placeholder="Type official Supervising Consultant response / instruction..."
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={responderName}
                          onChange={(e) => setResponderName(e.target.value)}
                          placeholder="Responding Engineer Name / Title"
                          className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-700 dark:text-slate-300 w-1/2"
                        />
                        <button
                          disabled={!responseText.trim()}
                          onClick={handleSaveConsultantResponse}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Send className="w-3 h-3" />
                          <span>Commit Response</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">Select a Technical Query from the register.</p>
              </div>
            )}
          </div>
        </div>
      )
    )}

      {/* ========================================================================= */}
      {/* 3. TECHNICAL SUBMITTALS: CARDS VIEW OR SPLIT-SCREEN 60/40                 */}
      {/* ========================================================================= */}
      {subSection === "submittals" && (
        viewMode === "cards" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Technical Submittals ({filteredSubmittals.length})
              </span>
              <button
                type="button"
                onClick={() => setIsNewSubmittalModalOpen(true)}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Submittal</span>
              </button>
            </div>

            {filteredSubmittals.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
                <FileCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">No Technical Submittals match the current filters.</p>
                <button
                  type="button"
                  onClick={() => setIsNewSubmittalModalOpen(true)}
                  className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Submittal</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSubmittals.map((sub) => (
                  <div
                    key={sub.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between min-h-[300px]"
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">
                            {sub.submittalNumber}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {sub.discipline}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {sub.revision || "Rev 0"}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(sub.status)}
                        </div>
                      </div>

                      {/* Title & Supplier */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2" title={sub.title}>
                          {sub.title}
                        </h4>
                        <div className="text-[11px] text-slate-500 mt-1 truncate">
                          Supplier: <strong className="text-slate-700 dark:text-slate-300 font-medium">{sub.supplier || "—"}</strong>
                        </div>
                      </div>

                      {/* Technical Specs & Submission Date */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Spec Ref</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300 truncate block" title={sub.specification}>
                            {sub.specification || "—"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Submitted</span>
                          <span className="text-slate-700 dark:text-slate-300 truncate block">
                            {sub.submittedDate || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Procurement Status */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold truncate max-w-full ${
                          sub.procurementStatus?.includes("Approved")
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        }`}>
                          {sub.procurementStatus || "Pending Review"}
                        </span>
                      </div>

                      {/* Document Compliance Pills */}
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded font-mono ${sub.documents?.technicalDataSheet?.attached ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-400 line-through"}`}>
                          TDS
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-mono ${sub.documents?.testCertificate?.attached ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-400 line-through"}`}>
                          Test Cert
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-mono ${sub.documents?.complianceCertificate?.attached ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-400 line-through"}`}>
                          Compliance
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-mono ${sub.documents?.sampleApproval?.attached ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                          Sample
                        </span>
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        {sub.approvedBy ? `By: ${sub.approvedBy}` : "Pending sign-off"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingSubmittal(sub)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="View submittal dossier"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSubmittal(sub)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit submittal"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingSubmittal(sub)}
                          className="px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete submittal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch lg:h-[calc(100vh-310px)] lg:min-h-[600px]">
          {/* LEFT 60% REGISTER TABLE */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col h-full">
            <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Technical Submittals Register ({filteredSubmittals.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Click row to inspect dossier
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white dark:bg-slate-900">
              <table className="w-full table-fixed text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-2.5 px-3 w-[85px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Submittal #</th>
                    <th className="py-2.5 px-3 min-w-0 border-b border-slate-200 dark:border-slate-700">Material / Item Title</th>
                    <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Supplier / Mfg</th>
                    <th className="py-2.5 px-3 w-[85px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Spec Ref</th>
                    <th className="py-2.5 px-3 w-[115px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 w-[85px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSubmittals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-xs">No Technical Submittals found matching criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSubmittals.map((sub) => {
                      const isSelected = currentSubmittal?.id === sub.id;
                      return (
                        <tr
                          key={sub.id}
                          onClick={() => setSelectedSubmittalId(sub.id)}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50/80 dark:bg-blue-950/40 font-medium"
                              : "hover:bg-slate-50 dark:hover:bg-slate-850/60"
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                            {sub.submittalNumber || "—"}
                          </td>
                          <td className="py-2.5 px-3 min-w-0 truncate overflow-hidden">
                            <div className="font-bold text-slate-900 dark:text-white truncate" title={sub.title}>
                              {sub.title || "—"}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {sub.discipline} • Rev {sub.revision || "0"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 truncate overflow-hidden text-slate-700 dark:text-slate-300" title={sub.supplier}>
                            {sub.supplier || "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap truncate overflow-hidden">
                            {sub.specification || "—"}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {getStatusBadge(sub.status)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingSubmittal(sub);
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-blue-600 transition-colors"
                                title="View Dossier"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSubmittal(sub);
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-amber-600 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingSubmittal(sub);
                                }}
                                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded text-slate-500 hover:text-rose-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary Strip */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <span>Showing {filteredSubmittals.length} of {submittals.length} Technical Submittals</span>
              <div className="flex items-center gap-3">
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {submittals.filter(s => s.status === "UNDER_REVIEW").length} Under Review
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {submittals.filter(s => s.status === "APPROVED" || s.status === "APPROVED_AS_NOTED").length} Approved
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT 40% DETAIL PANEL */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col h-full">
            {currentSubmittal ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs rounded">
                      {currentSubmittal.submittalNumber}
                    </span>
                    {getStatusBadge(currentSubmittal.status)}
                  </div>

                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {currentSubmittal.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-2">
                    <span>Supplier: <strong className="text-slate-700 dark:text-slate-300">{currentSubmittal.supplier}</strong></span>
                    <span>•</span>
                    <span>Submitted: <strong>{currentSubmittal.submittedDate || "—"}</strong></span>
                  </div>
                </div>

                {/* Submittal Document Compliance Checklist */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Mandatory Technical Document Checklist
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 text-xs">
                    {[
                      { key: "TDS", label: "Technical Data Sheet (TDS)", item: currentSubmittal.documents?.technicalDataSheet },
                      { key: "TC", label: "Independent Test Certificate", item: currentSubmittal.documents?.testCertificate },
                      { key: "CC", label: "Standard Compliance Certificate", item: currentSubmittal.documents?.complianceCertificate },
                      { key: "SA", label: "Physical Sample Approval", item: currentSubmittal.documents?.sampleApproval },
                      { key: "FA", label: "Factory Audit / ISO Accreditation", item: currentSubmittal.documents?.factoryAudit }
                    ].map((doc) => (
                      <div
                        key={doc.key}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{doc.label}</span>
                        {doc.item?.attached ? (
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 text-[11px] font-bold font-mono">
                            <Check className="w-3.5 h-3.5 mr-1" />
                            {doc.item.documentRef || "Attached"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Not Required / Pending</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Procurement Sync Linkage */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Procurement Sync Status</span>
                    <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                      PO: {currentSubmittal.linkedPurchaseOrder || "PO-PENDING"}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    {currentSubmittal.procurementStatus || "Blocked Pending Submittal Approval"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Lead Time: {currentSubmittal.leadTimeWeeks ? `${currentSubmittal.leadTimeWeeks} weeks to site` : "—"}
                  </div>
                </div>

                {/* Consultant Determination Action Bar */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Supervising Consultant Determination
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSetSubmittalStatus(currentSubmittal, "APPROVED")}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve (Code 1)</span>
                    </button>
                    <button
                      onClick={() => handleSetSubmittalStatus(currentSubmittal, "APPROVED_AS_NOTED")}
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Approve as Noted (Code 2)</span>
                    </button>
                    <button
                      onClick={() => handleSetSubmittalStatus(currentSubmittal, "REVISE_RESUBMIT")}
                      className="py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Revise & Resubmit (Code 3)</span>
                    </button>
                    <button
                      onClick={() => handleSetSubmittalStatus(currentSubmittal, "REJECTED")}
                      className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject (Code 4)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                <FileCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">Select a Technical Submittal from the register.</p>
              </div>
            )}
          </div>
        </div>
      )
    )}

      {/* ========================================================================= */}
      {/* 4. DESIGN ASSUMPTIONS: CARDS VIEW OR REGISTER TABLE                       */}
      {/* ========================================================================= */}
      {subSection === "assumptions" && (
        viewMode === "cards" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Design Assumptions & Site Verification ({filteredAssumptions.length})
              </span>
              <button
                type="button"
                onClick={() => setIsNewAssumptionModalOpen(true)}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Assumption</span>
              </button>
            </div>

            {filteredAssumptions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
                <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">No Design Assumptions match the current filters.</p>
                <button
                  type="button"
                  onClick={() => setIsNewAssumptionModalOpen(true)}
                  className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Assumption</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAssumptions.map((assump) => (
                  <div
                    key={assump.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between min-h-[280px]"
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">
                            {assump.assumptionNumber || assump.assumptionCode || "ASM-00"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                            {assump.discipline}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(assump.status)}
                        </div>
                      </div>

                      {/* Title */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2" title={assump.title}>
                          {assump.title}
                        </h4>
                      </div>

                      {/* Design Basis */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Design Basis</span>
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                          {assump.designBasis || assump.statement || "—"}
                        </div>
                      </div>

                      {/* Site Validation Trigger */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Site Validation Trigger</span>
                        <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-300 leading-relaxed line-clamp-2">
                          {assump.validationTrigger || assump.verificationMethod || "—"}
                        </div>
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        Owner: {assump.actionOwner || "Lead Engineer"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingAssumption(assump)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="View Assumption Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAssumption(assump)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit Assumption"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAssumption(assump)}
                          className="px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete Assumption"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Design Assumptions & Site Verification Register ({filteredAssumptions.length})
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 hidden sm:inline">Tracks critical engineer design premises vs actual ground truths</span>
              <button
                type="button"
                onClick={() => setIsNewAssumptionModalOpen(true)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[850px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Ref #</th>
                  <th className="py-2.5 px-3 w-[200px] border-b border-slate-200 dark:border-slate-700">Assumption Title & Discipline</th>
                  <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Design Basis Statement</th>
                  <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Site Validation Trigger</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Verification Status</th>
                  <th className="py-2.5 px-3 w-[85px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAssumptions.map((assump) => (
                  <tr key={assump.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {assump.assumptionNumber || assump.assumptionCode || "—"}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={assump.title}>{assump.title}</div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">{assump.discipline}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs">
                      {assump.designBasis || assump.statement || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs">
                      {assump.validationTrigger || assump.verificationMethod || "—"}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(assump.status)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingAssumption(assump)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAssumption(assump)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-amber-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAssumption(assump)}
                          className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded text-slate-500 hover:text-rose-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )
      )}

      {/* ========================================================================= */}
      {/* 5. ENGINEERING DEVIATIONS: CARDS VIEW OR REGISTER TABLE                   */}
      {/* ========================================================================= */}
      {subSection === "deviations" && (
        viewMode === "cards" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Engineering Deviations & Concessions ({filteredDeviations.length})
              </span>
              <button
                type="button"
                onClick={() => setIsNewDeviationModalOpen(true)}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Deviation</span>
              </button>
            </div>

            {filteredDeviations.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
                <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">No Engineering Deviations match the current filters.</p>
                <button
                  type="button"
                  onClick={() => setIsNewDeviationModalOpen(true)}
                  className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Deviation</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDeviations.map((dev) => (
                  <div
                    key={dev.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between min-h-[280px]"
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">
                            {dev.deviationNumber || "DEV-00"}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            Clause: {dev.specificationClause || "Spec"}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(dev.status)}
                        </div>
                      </div>

                      {/* Title */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2" title={dev.title}>
                          {dev.title}
                        </h4>
                      </div>

                      {/* Proposed Departure */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Proposed Departure</span>
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                          {dev.proposedDeparture || dev.proposedDeviation || "—"}
                        </div>
                      </div>

                      {/* Justification */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Engineering Justification</span>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                          {dev.engineeringJustification || "—"}
                        </div>
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        Discipline: {dev.discipline || "General"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingDeviation(dev)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="View Deviation Details"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-500" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDeviation(dev)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit Deviation"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingDeviation(dev)}
                          className="px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete Deviation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Engineering Deviations & Technical Concessions ({filteredDeviations.length})
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 hidden sm:inline">Formal technical departures from contract specifications</span>
              <button
                type="button"
                onClick={() => setIsNewDeviationModalOpen(true)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[850px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Deviation #</th>
                  <th className="py-2.5 px-3 w-[200px] border-b border-slate-200 dark:border-slate-700">Title & Specification Clause</th>
                  <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Proposed Departure</th>
                  <th className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-700">Engineering Justification</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Approval Status</th>
                  <th className="py-2.5 px-3 w-[85px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDeviations.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {dev.deviationNumber || "—"}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={dev.title}>{dev.title}</div>
                      <span className="text-[10px] font-mono text-slate-400">{dev.specificationClause || "—"}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs">
                      {dev.proposedDeparture || dev.proposedDeviation || "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs">
                      {dev.engineeringJustification || "—"}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(dev.status)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingDeviation(dev)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDeviation(dev)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-amber-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingDeviation(dev)}
                          className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded text-slate-500 hover:text-rose-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )
      )}

      {/* ========================================================================= */}
      {/* 6. CREATE NEW TECHNICAL QUERY / RFI MODAL                                  */}
      {/* ========================================================================= */}
      {isNewRfiModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Raise New Technical Query / RFI</h3>
              </div>
              <button onClick={() => setIsNewRfiModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {rfiActionError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{rfiActionError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const discId = (formData.get("discipline") as EngineeringDisciplineId) || "structural";
                const discMeta = MASTER_ENGINEERING_DISCIPLINES.find((d) => d.id === discId);

                const title = String(formData.get("title") || "").trim();
                if (!title) {
                  setRfiActionError("Please provide a query title.");
                  return;
                }

                const creatorName = currentUser?.full_name || currentUser?.name || "Site Engineer - Thabo Nkosi";
                const creatorRole = currentUser?.role || "Site Engineer";

                const newRfi: EngineeringRFI = {
                  id: `rfi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  rfiNumber: `RFI-${String(rfis.length + 101).padStart(3, "0")}`,
                  title: title,
                  discipline: discId,
                  disciplineLabel: discMeta ? discMeta.name.split(" ")[0] : "Engineering",
                  drawingRef: String(formData.get("drawingRef") || "—"),
                  specRef: String(formData.get("specRef") || "—"),
                  location: String(formData.get("location") || "Site"),
                  chainage: String(formData.get("chainage") || ""),
                  raisedBy: creatorName,
                  raisedByRole: creatorRole,
                  raisedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                  responseDueDate: new Date(Date.now() + 4 * 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                  status: "Awaiting Consultant",
                  priority: (formData.get("priority") as ImpactLevel) || "High",
                  questionText: String(formData.get("questionText") || ""),
                  proposedSolution: String(formData.get("proposedSolution") || ""),
                  constructionImpact: (formData.get("priority") as ImpactLevel) || "High",
                  constructionImpactDetails: "Work held at specified location pending engineer response.",
                  programmeImpact: {
                    hasImpact: true,
                    activityId: "ACT-092",
                    activityName: "Substructure Execution",
                    durationImpactDays: 3,
                    isCriticalPath: true,
                    details: "Potential schedule impact of 3 days."
                  },
                  commercialImpact: {
                    hasImpact: true,
                    potentialVariation: true,
                    estimatedCostImpact: 25000,
                    details: "Cost variation evaluation logged."
                  },
                  contractClauseRef: {
                    framework: "FIDIC Red Book 2017",
                    clauseNumber: "Sub-Clause 1.9",
                    clauseTitle: "Delayed Drawings or Instructions"
                  },
                  attachments: [],
                  projectId: activeProject?.id,
                  companyId: activeProject?.company_id || activeCompany?.id,
                  createdBy: creatorName
                };

                try {
                  setIsSavingRfi(true);
                  setRfiActionError(null);
                  await onAddRFI(newRfi);
                  setSelectedRfiId(newRfi.id);
                  setIsNewRfiModalOpen(false);
                } catch (err: any) {
                  console.error("Error creating RFI:", err);
                  setRfiActionError(err?.message || "Failed to persist Technical Query to database.");
                } finally {
                  setIsSavingRfi(false);
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Query Title <span className="text-rose-500">*</span>
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Discrepancy in Pier P14 Pile Cap Starter Bar Spacing"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Discipline</label>
                  <select
                    name="discipline"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {availableDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Controlled Drawing Ref</label>
                  <input
                    name="drawingRef"
                    type="text"
                    placeholder="e.g. STR-042 Rev C"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    name="priority"
                    defaultValue="High"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Critical">Critical (Immediate Stop)</option>
                    <option value="High">High Impact</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Location / Chainage</label>
                  <input
                    name="location"
                    type="text"
                    placeholder="e.g. Pier P14, Chainage Km 14+250"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Specification Clause Ref</label>
                  <input
                    name="specRef"
                    type="text"
                    placeholder="e.g. 03 30 00 Clause 4.2"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Question / Clarification Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="questionText"
                  required
                  rows={3}
                  placeholder="State the precise engineering conflict or ambiguity requiring consultant response..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contractor's Proposed Solution
                </label>
                <textarea
                  name="proposedSolution"
                  rows={2}
                  placeholder="Provide contractor proposed technical remedy for consultant approval..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSavingRfi}
                  onClick={() => setIsNewRfiModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRfi}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {isSavingRfi && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingRfi ? "Persisting to Database..." : "Create & Issue Query"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6B. EDIT TECHNICAL QUERY / RFI MODAL                                       */}
      {/* ========================================================================= */}
      {editingRfi && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Edit Technical Query — {editingRfi.rfiNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Updates will be committed directly to project persistent storage
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingRfi(null);
                  setRfiActionError(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rfiActionError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{rfiActionError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const discId = (formData.get("discipline") as EngineeringDisciplineId) || editingRfi.discipline;
                const discMeta = MASTER_ENGINEERING_DISCIPLINES.find((d) => d.id === discId);

                const title = String(formData.get("title") || "").trim();
                if (!title) {
                  setRfiActionError("Please provide a query title.");
                  return;
                }

                const updatedRfi: EngineeringRFI = {
                  ...editingRfi,
                  title,
                  discipline: discId,
                  disciplineLabel: discMeta ? discMeta.name.split(" ")[0] : editingRfi.disciplineLabel,
                  status: (formData.get("status") as RFIStatus) || editingRfi.status,
                  priority: (formData.get("priority") as ImpactLevel) || editingRfi.priority,
                  drawingRef: String(formData.get("drawingRef") || "—"),
                  specRef: String(formData.get("specRef") || "—"),
                  location: String(formData.get("location") || "Site"),
                  chainage: String(formData.get("chainage") || ""),
                  responseDueDate: String(formData.get("responseDueDate") || editingRfi.responseDueDate || ""),
                  questionText: String(formData.get("questionText") || ""),
                  proposedSolution: String(formData.get("proposedSolution") || ""),
                  consultantResponse: String(formData.get("consultantResponse") || editingRfi.consultantResponse || ""),
                  respondedBy: String(formData.get("respondedBy") || editingRfi.respondedBy || "")
                };

                try {
                  setIsSavingRfi(true);
                  setRfiActionError(null);
                  await onUpdateRFI(updatedRfi);
                  setEditingRfi(null);
                } catch (err: any) {
                  console.error("Error updating RFI:", err);
                  setRfiActionError(err?.message || "Failed to save updates to database.");
                } finally {
                  setIsSavingRfi(false);
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Query Title <span className="text-rose-500">*</span>
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingRfi.title}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Discipline</label>
                  <select
                    name="discipline"
                    defaultValue={editingRfi.discipline}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {availableDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingRfi.status}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Awaiting Consultant">Awaiting Consultant</option>
                    <option value="Responded">Responded</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Closed">Closed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    name="priority"
                    defaultValue={editingRfi.priority}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Critical">Critical (Immediate Stop)</option>
                    <option value="High">High Impact</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Controlled Drawing Ref</label>
                  <input
                    name="drawingRef"
                    type="text"
                    defaultValue={editingRfi.drawingRef}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Location / Chainage</label>
                  <input
                    name="location"
                    type="text"
                    defaultValue={editingRfi.location}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Response Due Date</label>
                  <input
                    name="responseDueDate"
                    type="text"
                    defaultValue={editingRfi.responseDueDate}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Question / Clarification Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="questionText"
                  required
                  rows={3}
                  defaultValue={editingRfi.questionText}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contractor's Proposed Solution
                </label>
                <textarea
                  name="proposedSolution"
                  rows={2}
                  defaultValue={editingRfi.proposedSolution}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Consultant Response / Determination
                </label>
                <textarea
                  name="consultantResponse"
                  rows={2}
                  defaultValue={editingRfi.consultantResponse || ""}
                  placeholder="Record formal supervising consultant instructions or clarification..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSavingRfi}
                  onClick={() => {
                    setEditingRfi(null);
                    setRfiActionError(null);
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRfi}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {isSavingRfi && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingRfi ? "Saving Updates..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6C. DELETE TECHNICAL QUERY / RFI CONFIRMATION MODAL                        */}
      {/* ========================================================================= */}
      {deletingRfi && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Delete Technical Query / RFI
                </h3>
                <p className="text-[11px] text-slate-500">
                  Permanent removal from project records
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900 dark:text-white font-mono">
                  {deletingRfi.rfiNumber}
                </strong>{" "}
                — <em>"{deletingRfi.title}"</em>?
              </p>
              <p className="text-[11px] text-slate-400">
                This record will be deleted from the database and will no longer be accessible after page refresh or session changes.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeletingRfi}
                onClick={() => setDeletingRfi(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingRfi}
                onClick={async () => {
                  if (!onDeleteRFI) return;
                  try {
                    setIsDeletingRfi(true);
                    await onDeleteRFI(deletingRfi.id);
                    setDeletingRfi(null);
                    if (selectedRfiId === deletingRfi.id) {
                      const remaining = rfis.filter((r) => r.id !== deletingRfi.id);
                      setSelectedRfiId(remaining[0]?.id || "");
                    }
                  } catch (err: any) {
                    console.error("Failed to delete RFI:", err);
                    alert(err?.message || "Failed to delete Technical Query");
                  } finally {
                    setIsDeletingRfi(false);
                  }
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {isDeletingRfi && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeletingRfi ? "Deleting..." : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. CREATE NEW TECHNICAL SUBMITTAL MODAL                                    */}
      {/* ========================================================================= */}
      {isNewSubmittalModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Register Technical Submittal</h3>
              </div>
              <button onClick={() => setIsNewSubmittalModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const discId = (formData.get("discipline") as EngineeringDisciplineId) || "structural";

                const newSub: TechnicalSubmittal = {
                  id: `sub-${Date.now()}`,
                  submittalNumber: `MAT-${String(submittals.length + 51).padStart(3, "0")}`,
                  title: String(formData.get("title") || "Material Technical Submittal"),
                  discipline: discId,
                  specification: String(formData.get("specification") || "03 30 00"),
                  supplier: String(formData.get("supplier") || "Approved Vendor"),
                  submittedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                  status: "UNDER_REVIEW",
                  approvedBy: "Resident Engineer",
                  revision: "Rev 0",
                  procurementStatus: "Blocked Pending Submittal Approval",
                  documents: {
                    technicalDataSheet: { attached: true, documentRef: "TDS-ATTACHED" },
                    testCertificate: { attached: true, documentRef: "TC-ATTACHED" },
                    complianceCertificate: { attached: true, documentRef: "ISO-CERT" },
                    sampleApproval: { attached: false, documentRef: "" },
                    factoryAudit: { attached: false, documentRef: "" }
                  }
                };

                onAddSubmittal(newSub);
                setSelectedSubmittalId(newSub.id);
                setIsNewSubmittalModalOpen(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Submittal Title / Material Description <span className="text-rose-500">*</span>
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. CEM I 42.5N Portland Cement for Structural Concrete"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Discipline</label>
                  <select
                    name="discipline"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {availableDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Specification Ref</label>
                  <input
                    name="specification"
                    type="text"
                    placeholder="e.g. 03 30 00 - Cast-in-Place Concrete"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier / Manufacturer</label>
                <input
                  name="supplier"
                  type="text"
                  placeholder="e.g. Mbeya Cement Co. Ltd / Holcim Group"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewSubmittalModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. VIEW TECHNICAL QUERY / RFI DOSSIER MODAL                               */}
      {/* ========================================================================= */}
      {viewingRfi && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                  {viewingRfi.rfiNumber}
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-md">
                  {viewingRfi.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(viewingRfi.status)}
                <button
                  type="button"
                  onClick={() => setViewingRfi(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Discipline</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingRfi.disciplineLabel || viewingRfi.discipline}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Priority</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingRfi.priority}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Location</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingRfi.location || "Site"} {viewingRfi.chainage ? `(${viewingRfi.chainage})` : ""}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Due Date</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingRfi.responseDueDate || "Pending"}</span>
              </div>
            </div>

            {/* Technical Refs */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Drawing Reference</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{viewingRfi.drawingRef || "—"}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Specification Clause</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{viewingRfi.specRef || "—"}</span>
              </div>
            </div>

            {/* Query Statement */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Query Statement</span>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {viewingRfi.questionText || "No query text recorded."}
              </div>
            </div>

            {/* Proposed Solution */}
            {viewingRfi.proposedSolution && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Contractor Proposed Solution</span>
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                  {viewingRfi.proposedSolution}
                </div>
              </div>
            )}

            {/* Consultant Determination */}
            {viewingRfi.consultantResponse && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Consultant Determination & Instruction</span>
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  {viewingRfi.consultantResponse}
                  <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400">
                    <span>Responded by: <strong>{viewingRfi.respondedBy || "Supervising Engineer"}</strong></span>
                    <span>{viewingRfi.respondedDate || ""}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Impacts */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Schedule / Critical Path</span>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {viewingRfi.criticalPathImpact ? `Critical Path Delay (+${viewingRfi.scheduleDelayDays || 3} days)` : "No schedule impact detected"}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Commercial / Financial Impact</span>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {viewingRfi.commercialImpact?.hasImpact ? `Variation Exposure: $${((viewingRfi.commercialImpact?.estimatedCostImpact || 0) / 1000).toFixed(0)}k` : "No cost variation flagged"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const target = viewingRfi;
                  setViewingRfi(null);
                  setEditingRfi(target);
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5 text-amber-500" />
                <span>Edit Query</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingRfi(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. VIEW TECHNICAL SUBMITTAL DOSSIER MODAL                                  */}
      {/* ========================================================================= */}
      {viewingSubmittal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                  {viewingSubmittal.submittalNumber}
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-md">
                  {viewingSubmittal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingSubmittal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Discipline</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingSubmittal.discipline}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Revision</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingSubmittal.revision || "Rev 0"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Supplier</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingSubmittal.supplier}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Spec Reference</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingSubmittal.specification}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Review Status</span>
                <div className="mt-1">{getStatusBadge(viewingSubmittal.status)}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Procurement Condition</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingSubmittal.procurementStatus}</span>
              </div>
            </div>

            {/* Document checklist */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Mandatory Document Attachments</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(viewingSubmittal.documents || {}).map(([key, doc]) => (
                  <div
                    key={key}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50"
                  >
                    <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    {(doc as { attached?: boolean })?.attached ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Attached
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                        Missing
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const target = viewingSubmittal;
                  setViewingSubmittal(null);
                  setEditingSubmittal(target);
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5 text-amber-500" />
                <span>Edit Submittal</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingSubmittal(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. EDIT TECHNICAL SUBMITTAL MODAL                                         */}
      {/* ========================================================================= */}
      {editingSubmittal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Edit Technical Submittal ({editingSubmittal.submittalNumber})
                </h3>
              </div>
              <button onClick={() => setEditingSubmittal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updated: TechnicalSubmittal = {
                  ...editingSubmittal,
                  title: String(formData.get("title") || editingSubmittal.title),
                  discipline: (formData.get("discipline") as EngineeringDisciplineId) || editingSubmittal.discipline,
                  specification: String(formData.get("specification") || editingSubmittal.specification),
                  supplier: String(formData.get("supplier") || editingSubmittal.supplier),
                  revision: String(formData.get("revision") || editingSubmittal.revision),
                  status: (formData.get("status") as any) || editingSubmittal.status,
                  procurementStatus: String(formData.get("procurementStatus") || editingSubmittal.procurementStatus)
                };

                onUpdateSubmittal?.(updated);
                setEditingSubmittal(null);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Submittal Title / Description
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingSubmittal.title}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Discipline</label>
                  <select
                    name="discipline"
                    defaultValue={editingSubmittal.discipline}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {availableDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Revision</label>
                  <input
                    name="revision"
                    type="text"
                    defaultValue={editingSubmittal.revision}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Specification Ref</label>
                  <input
                    name="specification"
                    type="text"
                    defaultValue={editingSubmittal.specification}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier / Mfg</label>
                  <input
                    name="supplier"
                    type="text"
                    defaultValue={editingSubmittal.supplier}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Approval Status</label>
                  <select
                    name="status"
                    defaultValue={editingSubmittal.status}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="UNDER_REVIEW">UNDER_REVIEW (Code 0)</option>
                    <option value="APPROVED">APPROVED (Code 1)</option>
                    <option value="APPROVED_AS_NOTED">APPROVED_AS_NOTED (Code 2)</option>
                    <option value="REVISE_RESUBMIT">REVISE_RESUBMIT (Code 3)</option>
                    <option value="REJECTED">REJECTED (Code 4)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Procurement Condition</label>
                  <input
                    name="procurementStatus"
                    type="text"
                    defaultValue={editingSubmittal.procurementStatus}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSubmittal(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. DELETE TECHNICAL SUBMITTAL CONFIRMATION MODAL                           */}
      {/* ========================================================================= */}
      {deletingSubmittal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Delete Technical Submittal
                </h3>
                <p className="text-[11px] text-slate-500">Permanent removal from register</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900 dark:text-white font-mono">
                {deletingSubmittal.submittalNumber}
              </strong>{" "}
              — <em>"{deletingSubmittal.title}"</em>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingSubmittal(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSubmittal?.(deletingSubmittal.id);
                  setDeletingSubmittal(null);
                  if (selectedSubmittalId === deletingSubmittal.id) {
                    const rem = submittals.filter((s) => s.id !== deletingSubmittal.id);
                    setSelectedSubmittalId(rem[0]?.id || "");
                  }
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. CREATE DESIGN ASSUMPTION MODAL                                         */}
      {/* ========================================================================= */}
      {isNewAssumptionModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Record Design Assumption</h3>
              </div>
              <button onClick={() => setIsNewAssumptionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const discId = (formData.get("discipline") as EngineeringDisciplineId) || "structural";
                const newAssump: DesignAssumption = {
                  id: `asm-${Date.now()}`,
                  assumptionNumber: `ASM-${String(assumptions.length + 1).padStart(3, "0")}`,
                  assumptionCode: `ASM-${String(assumptions.length + 1).padStart(3, "0")}`,
                  title: String(formData.get("title") || "New Design Assumption"),
                  discipline: discId,
                  designBasis: String(formData.get("designBasis") || ""),
                  statement: String(formData.get("designBasis") || ""),
                  validationTrigger: String(formData.get("validationTrigger") || ""),
                  verificationMethod: String(formData.get("validationTrigger") || ""),
                  status: "PENDING_VERIFICATION",
                  actionOwner: String(formData.get("actionOwner") || "Lead Geotechnical Engineer")
                };

                onAddAssumption?.(newAssump);
                setSelectedAssumptionId(newAssump.id);
                setIsNewAssumptionModalOpen(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assumption Title <span className="text-rose-500">*</span>
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Ground Bearing Capacity at Pier 3 >= 250 kPa"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Discipline</label>
                  <select
                    name="discipline"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {availableDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Action Owner</label>
                  <input
                    name="actionOwner"
                    type="text"
                    defaultValue="Lead Structural Engineer"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Design Basis Statement <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="designBasis"
                  rows={3}
                  required
                  placeholder="State the engineering assumption made during calculations or detailed design..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Site Validation Trigger / Verification Method
                </label>
                <input
                  name="validationTrigger"
                  type="text"
                  placeholder="e.g. Plate load test prior to blinding concrete pour"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewAssumptionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Log Assumption
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 13. VIEW DESIGN ASSUMPTION MODAL                                           */}
      {/* ========================================================================= */}
      {viewingAssumption && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                  {viewingAssumption.assumptionNumber || viewingAssumption.assumptionCode}
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-md">
                  {viewingAssumption.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingAssumption(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Discipline</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingAssumption.discipline}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Status</span>
                <div className="mt-0.5">{getStatusBadge(viewingAssumption.status)}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Owner</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingAssumption.actionOwner || "Lead Engineer"}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Design Basis Statement</span>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {viewingAssumption.designBasis || viewingAssumption.statement || "No statement recorded."}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Site Validation Trigger</span>
              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                {viewingAssumption.validationTrigger || viewingAssumption.verificationMethod || "No validation method specified."}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const target = viewingAssumption;
                  setViewingAssumption(null);
                  setEditingAssumption(target);
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5 text-amber-500" />
                <span>Edit Assumption</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingAssumption(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 14. EDIT DESIGN ASSUMPTION MODAL                                           */}
      {/* ========================================================================= */}
      {editingAssumption && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Edit Assumption ({editingAssumption.assumptionNumber || editingAssumption.assumptionCode})
                </h3>
              </div>
              <button onClick={() => setEditingAssumption(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updated: DesignAssumption = {
                  ...editingAssumption,
                  title: String(formData.get("title") || editingAssumption.title),
                  discipline: (formData.get("discipline") as EngineeringDisciplineId) || editingAssumption.discipline,
                  designBasis: String(formData.get("designBasis") || editingAssumption.designBasis),
                  statement: String(formData.get("designBasis") || editingAssumption.statement),
                  validationTrigger: String(formData.get("validationTrigger") || editingAssumption.validationTrigger),
                  verificationMethod: String(formData.get("validationTrigger") || editingAssumption.verificationMethod),
                  status: (formData.get("status") as any) || editingAssumption.status,
                  actionOwner: String(formData.get("actionOwner") || editingAssumption.actionOwner)
                };

                onUpdateAssumption?.(updated);
                setEditingAssumption(null);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assumption Title
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingAssumption.title}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Discipline</label>
                  <select
                    name="discipline"
                    defaultValue={editingAssumption.discipline}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {availableDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Verification Status</label>
                  <select
                    name="status"
                    defaultValue={editingAssumption.status}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                    <option value="VALIDATED">VALIDATED</option>
                    <option value="INVALIDATED">INVALIDATED</option>
                    <option value="MONITORED">MONITORED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Design Basis Statement
                </label>
                <textarea
                  name="designBasis"
                  rows={3}
                  defaultValue={editingAssumption.designBasis || editingAssumption.statement || ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Site Validation Trigger</label>
                  <input
                    name="validationTrigger"
                    type="text"
                    defaultValue={editingAssumption.validationTrigger || editingAssumption.verificationMethod || ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Action Owner</label>
                  <input
                    name="actionOwner"
                    type="text"
                    defaultValue={editingAssumption.actionOwner || ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAssumption(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 15. DELETE DESIGN ASSUMPTION CONFIRMATION MODAL                            */}
      {/* ========================================================================= */}
      {deletingAssumption && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Delete Design Assumption
                </h3>
                <p className="text-[11px] text-slate-500">Permanent removal from register</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900 dark:text-white font-mono">
                {deletingAssumption.assumptionNumber || deletingAssumption.assumptionCode}
              </strong>{" "}
              — <em>"{deletingAssumption.title}"</em>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingAssumption(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAssumption?.(deletingAssumption.id);
                  setDeletingAssumption(null);
                  if (selectedAssumptionId === deletingAssumption.id) {
                    const rem = assumptions.filter((a) => a.id !== deletingAssumption.id);
                    setSelectedAssumptionId(rem[0]?.id || "");
                  }
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 16. CREATE ENGINEERING DEVIATION MODAL                                     */}
      {/* ========================================================================= */}
      {isNewDeviationModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Log Engineering Deviation</h3>
              </div>
              <button onClick={() => setIsNewDeviationModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const discId = (formData.get("discipline") as EngineeringDisciplineId) || "structural";
                const newDev: EngineeringDeviation = {
                  id: `dev-${Date.now()}`,
                  deviationNumber: `DEV-${String(deviations.length + 1).padStart(3, "0")}`,
                  title: String(formData.get("title") || "Technical Concession / Deviation"),
                  discipline: discId,
                  specificationClause: String(formData.get("specificationClause") || "Spec Clause"),
                  proposedDeparture: String(formData.get("proposedDeparture") || ""),
                  proposedDeviation: String(formData.get("proposedDeparture") || ""),
                  engineeringJustification: String(formData.get("engineeringJustification") || ""),
                  status: "SUBMITTED",
                  approvedBy: "Resident Engineer",
                  signOffChain: {
                    preparedBy: { name: "Contractor QA Lead", organisation: "Contractor Joint Venture", registrationNumber: "ERB-2024", date: new Date().toLocaleDateString("en-GB"), signed: true },
                    checkedBy: { name: "QC Manager", organisation: "Contractor Joint Venture", registrationNumber: "ERB-1994", date: new Date().toLocaleDateString("en-GB"), signed: true },
                    reviewedBy: { name: "Lead Design Consultant", organisation: "Design Bureau", registrationNumber: "ERB-0883", date: "", signed: false },
                    approvedBy: { name: "Resident Engineer", organisation: "Supervising Firm", registrationNumber: "ERB-0042", date: "", signed: false }
                  }
                };

                onAddDeviation?.(newDev);
                setSelectedDeviationId(newDev.id);
                setIsNewDeviationModalOpen(false);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deviation Title <span className="text-rose-500">*</span>
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Substitution of Grade 60 Rebar with Grade 75 with equivalent area"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Discipline</label>
                  <select
                    name="discipline"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {availableDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Specification Clause Ref</label>
                  <input
                    name="specificationClause"
                    type="text"
                    placeholder="e.g. Clause 4.3.2 Reinforcement Steels"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Proposed Departure from Contract Specification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="proposedDeparture"
                  rows={3}
                  required
                  placeholder="Describe the exact departure or technical modification proposed..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Engineering Justification & Equivalence Statement <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="engineeringJustification"
                  rows={2}
                  required
                  placeholder="Demonstrate technical equivalence, safety factor compliance, and zero durability impairment..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewDeviationModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Submit Deviation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 17. VIEW ENGINEERING DEVIATION MODAL                                       */}
      {/* ========================================================================= */}
      {viewingDeviation && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                  {viewingDeviation.deviationNumber}
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-md">
                  {viewingDeviation.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingDeviation(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Discipline</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{viewingDeviation.discipline}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Clause</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingDeviation.specificationClause || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Status</span>
                <div className="mt-0.5">{getStatusBadge(viewingDeviation.status)}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Proposed Departure</span>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {viewingDeviation.proposedDeparture || viewingDeviation.proposedDeviation || "No departure specified."}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Engineering Justification</span>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {viewingDeviation.engineeringJustification || "No justification recorded."}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const target = viewingDeviation;
                  setViewingDeviation(null);
                  setEditingDeviation(target);
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5 text-amber-500" />
                <span>Edit Deviation</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingDeviation(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 18. EDIT ENGINEERING DEVIATION MODAL                                       */}
      {/* ========================================================================= */}
      {editingDeviation && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Edit Deviation ({editingDeviation.deviationNumber})
                </h3>
              </div>
              <button onClick={() => setEditingDeviation(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updated: EngineeringDeviation = {
                  ...editingDeviation,
                  title: String(formData.get("title") || editingDeviation.title),
                  discipline: (formData.get("discipline") as EngineeringDisciplineId) || editingDeviation.discipline,
                  specificationClause: String(formData.get("specificationClause") || editingDeviation.specificationClause),
                  proposedDeparture: String(formData.get("proposedDeparture") || editingDeviation.proposedDeparture),
                  proposedDeviation: String(formData.get("proposedDeparture") || editingDeviation.proposedDeviation),
                  engineeringJustification: String(formData.get("engineeringJustification") || editingDeviation.engineeringJustification),
                  status: (formData.get("status") as any) || editingDeviation.status
                };

                onUpdateDeviation?.(updated);
                setEditingDeviation(null);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deviation Title
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingDeviation.title}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Discipline</label>
                  <select
                    name="discipline"
                    defaultValue={editingDeviation.discipline}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {availableDisciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Approval Status</label>
                  <select
                    name="status"
                    defaultValue={editingDeviation.status}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="UNDER_EVALUATION">UNDER_EVALUATION</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Specification Clause Ref</label>
                <input
                  name="specificationClause"
                  type="text"
                  defaultValue={editingDeviation.specificationClause || ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Proposed Departure</label>
                <textarea
                  name="proposedDeparture"
                  rows={2}
                  defaultValue={editingDeviation.proposedDeparture || editingDeviation.proposedDeviation || ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Engineering Justification</label>
                <textarea
                  name="engineeringJustification"
                  rows={2}
                  defaultValue={editingDeviation.engineeringJustification || ""}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDeviation(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 19. DELETE ENGINEERING DEVIATION CONFIRMATION MODAL                        */}
      {/* ========================================================================= */}
      {deletingDeviation && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Delete Engineering Deviation
                </h3>
                <p className="text-[11px] text-slate-500">Permanent removal from register</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900 dark:text-white font-mono">
                {deletingDeviation.deviationNumber}
              </strong>{" "}
              — <em>"{deletingDeviation.title}"</em>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingDeviation(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDeviation?.(deletingDeviation.id);
                  setDeletingDeviation(null);
                  if (selectedDeviationId === deletingDeviation.id) {
                    const rem = deviations.filter((d) => d.id !== deletingDeviation.id);
                    setSelectedDeviationId(rem[0]?.id || "");
                  }
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
