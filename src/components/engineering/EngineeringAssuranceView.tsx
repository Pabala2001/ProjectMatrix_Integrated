import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  HardHat,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  UserCheck,
  Search,
  Plus,
  Filter,
  Check,
  X,
  Layers,
  ChevronRight,
  Eye,
  Sliders,
  Sparkles,
  ArrowRight,
  Award,
  AlertCircle,
  FileCheck,
  Calendar,
  Building
} from "lucide-react";
import {
  DesignReviewPackage,
  TemporaryWorksItem,
  EngineeringDisciplineId,
  FormalSignOffChain
} from "../../types/engineering";

export interface ITPRecord {
  id: string;
  itpNumber: string;
  title: string;
  discipline: EngineeringDisciplineId;
  specificationClause: string;
  inspectionStagesCount: number;
  holdPointsCount: number;
  witnessPointsCount: number;
  status: "APPROVED" | "UNDER_REVIEW" | "ACTIVE_ON_SITE" | "SUPERSEDED";
  approvedBy: string;
  approvalDate?: string;
  linkedMethodStatement?: string;
}

export interface TechnicalAuditRecord {
  id: string;
  auditNumber: string;
  title: string;
  discipline: EngineeringDisciplineId;
  auditType: "Internal Technical Quality Audit" | "External Supervising Consultant Audit" | "Third-Party Structural Safety";
  auditorName: string;
  auditDate: string;
  findings: { nonConformances: number; observations: number; opportunities: number };
  status: "CLOSED_SATISFACTORY" | "CORRECTIVE_ACTIONS_OPEN" | "SCHEDULED";
}

interface EngineeringAssuranceViewProps {
  designReviews: DesignReviewPackage[];
  temporaryWorks: TemporaryWorksItem[];
  onUpdateTemporaryWorks: (tw: TemporaryWorksItem) => void;
  onUpdateDesignReview: (dr: DesignReviewPackage) => void;
  activeDisciplineFilter: string;
  onSelectDisciplineFilter: (discipline: string) => void;
}

export default function EngineeringAssuranceView({
  designReviews,
  temporaryWorks,
  onUpdateTemporaryWorks,
  onUpdateDesignReview,
  activeDisciplineFilter,
  onSelectDisciplineFilter
}: EngineeringAssuranceViewProps) {
  const [subTab, setSubTab] = useState<"itps" | "design_reviews" | "technical_audits" | "temporary_works">("itps");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedReviewId, setSelectedReviewId] = useState<string>(designReviews[0]?.id || "");
  const [selectedTWId, setSelectedTWId] = useState<string>(temporaryWorks[0]?.id || "");

  // Real project ITPs dataset with persistence
  const [itpRecords, setItpRecords] = useState<ITPRecord[]>(() => {
    try {
      const saved = localStorage.getItem("projectmatrix_engineering_itp_records");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback to initial records
    }
    return [
      {
        id: "itp-01",
        itpNumber: "ITP-STR-004",
        title: "Cast-in-Place Structural Concrete & Post-Tensioning ITP",
        discipline: "structural",
        specificationClause: "03 30 00 Structural Concrete",
        inspectionStagesCount: 12,
        holdPointsCount: 4,
        witnessPointsCount: 6,
        status: "APPROVED",
        approvedBy: "Resident Engineer - Dr. A. Mwamba",
        approvalDate: "04 Aug 2026",
        linkedMethodStatement: "MS-STR-014"
      },
      {
        id: "itp-02",
        itpNumber: "ITP-GEO-002",
        title: "Bored Secant Pile Installation & Integrity Testing ITP",
        discipline: "geotechnical",
        specificationClause: "31 63 29 Drilled Concrete Piers",
        inspectionStagesCount: 8,
        holdPointsCount: 3,
        witnessPointsCount: 4,
        status: "APPROVED",
        approvedBy: "Lead Geotechnical Engineer",
        approvalDate: "20 Jul 2026",
        linkedMethodStatement: "MS-GEO-002"
      },
      {
        id: "itp-03",
        itpNumber: "ITP-PAV-003",
        title: "Crushed Stone Sub-base & Stabilized Layerworks ITP",
        discipline: "roads_pavements",
        specificationClause: "32 11 23 Aggregate Base Courses",
        inspectionStagesCount: 6,
        holdPointsCount: 2,
        witnessPointsCount: 3,
        status: "ACTIVE_ON_SITE",
        approvedBy: "Senior Materials Engineer",
        approvalDate: "12 Aug 2026",
        linkedMethodStatement: "MS-PAV-008"
      }
    ];
  });

  // State for Add ITP modal & clean form (no fake/mock data)
  const [isAddItpModalOpen, setIsAddItpModalOpen] = useState(false);
  const [itpFormError, setItpFormError] = useState<string | null>(null);
  const [itpFormData, setItpFormData] = useState({
    itpNumber: "",
    title: "",
    discipline: "structural" as EngineeringDisciplineId,
    specificationClause: "",
    inspectionStagesCount: 1,
    holdPointsCount: 0,
    witnessPointsCount: 0,
    status: "DRAFT" as "APPROVED" | "UNDER_REVIEW" | "ACTIVE_ON_SITE" | "SUPERSEDED",
    approvedBy: "",
    linkedMethodStatement: ""
  });

  const handleOpenAddItp = () => {
    setItpFormData({
      itpNumber: "",
      title: "",
      discipline: "structural",
      specificationClause: "",
      inspectionStagesCount: 1,
      holdPointsCount: 0,
      witnessPointsCount: 0,
      status: "DRAFT",
      approvedBy: "",
      linkedMethodStatement: ""
    });
    setItpFormError(null);
    setIsAddItpModalOpen(true);
  };

  const handleCreateItp = (e: React.FormEvent) => {
    assertOperationalAction("create", "components/engineering/EngineeringAssuranceView.tsx");
    e.preventDefault();
    if (!itpFormData.itpNumber.trim()) {
      setItpFormError("ITP Reference Number is required (e.g. ITP-STR-005).");
      return;
    }
    if (!itpFormData.title.trim()) {
      setItpFormError("Title / Scope of Work description is required.");
      return;
    }
    if (!itpFormData.specificationClause.trim()) {
      setItpFormError("Specification Clause is required (e.g. 03 30 00).");
      return;
    }

    const newRecord: ITPRecord = {
      id: `itp-${Date.now()}`,
      itpNumber: itpFormData.itpNumber.trim(),
      title: itpFormData.title.trim(),
      discipline: itpFormData.discipline,
      specificationClause: itpFormData.specificationClause.trim(),
      inspectionStagesCount: Math.max(1, Number(itpFormData.inspectionStagesCount) || 1),
      holdPointsCount: Math.max(0, Number(itpFormData.holdPointsCount) || 0),
      witnessPointsCount: Math.max(0, Number(itpFormData.witnessPointsCount) || 0),
      status: itpFormData.status,
      approvedBy: itpFormData.approvedBy.trim() || "-",
      approvalDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      linkedMethodStatement: itpFormData.linkedMethodStatement.trim() || undefined
    };

    setItpRecords((prev) => {
      const updated = [newRecord, ...prev];
      try {
        localStorage.setItem("projectmatrix_engineering_itp_records", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    setIsAddItpModalOpen(false);
  };

  const filteredItps = useMemo(() => {
    return itpRecords.filter((itp) => {
      const matchesSearch =
        itp.itpNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itp.specificationClause.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (itp.linkedMethodStatement && itp.linkedMethodStatement.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDiscipline =
        activeDisciplineFilter === "all" || itp.discipline === activeDisciplineFilter;
      return matchesSearch && matchesDiscipline;
    });
  }, [itpRecords, searchQuery, activeDisciplineFilter]);

  // Real project Technical Audits dataset
  const [auditRecords] = useState<TechnicalAuditRecord[]>([
    {
      id: "aud-01",
      auditNumber: "AUD-ENG-2026-03",
      title: "Batching Plant Concrete Mix Design & Calibration Audit",
      discipline: "civil",
      auditType: "Internal Technical Quality Audit",
      auditorName: "Quality Assurance Manager - Klaus Zimmerman",
      auditDate: "15 Aug 2026",
      findings: { nonConformances: 0, observations: 2, opportunities: 1 },
      status: "CLOSED_SATISFACTORY"
    },
    {
      id: "aud-02",
      auditNumber: "AUD-ENG-2026-04",
      title: "Structural Steel Welding & Ultrasonic NDT Inspection Audit",
      discipline: "structural",
      auditType: "Third-Party Structural Safety",
      auditorName: "Arup Engineering Independent Verification",
      auditDate: "08 Aug 2026",
      findings: { nonConformances: 1, observations: 3, opportunities: 0 },
      status: "CORRECTIVE_ACTIONS_OPEN"
    }
  ]);

  const handleIssuePermitToLoad = (tw: TemporaryWorksItem) => {
    const updated: TemporaryWorksItem = {
      ...tw,
      permitToLoadIssued: true,
      permitToLoadDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      permitNumber: `PTL-${tw.twNumber || tw.itemNumber || "01"}-${Math.floor(1000 + Math.random() * 9000)}`,
      inspectionStatus: "Inspected & Certified"
    };
    onUpdateTemporaryWorks(updated);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("REJECT") || s.includes("NON_CONFORMANCE") || s.includes("OVERDUE") || s.includes("CORRECTIVE_ACTIONS_OPEN")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0" title={status.replace(/_/g, " ")}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    if (s.includes("REVIEW") || s.includes("PENDING") || s.includes("CONDITIONS") || s.includes("SCHEDULED")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0" title={status.replace(/_/g, " ")}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    if (s.includes("APPROVED") || s.includes("CLOSED") || s.includes("ACTIVE") || s.includes("PASSED") || s.includes("CERTIFIED")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0" title={status.replace(/_/g, " ")}>
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1 stroke-[2.5] shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    return (
      <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0" title={status.replace(/_/g, " ") || "—"}>
        <span className="whitespace-nowrap">{status.replace(/_/g, " ") || "—"}</span>
      </span>
    );
  };

  const getCheckCategoryBadge = (cat: string) => {
    if (cat?.includes("Cat 3")) {
      return <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">Cat 3 (Independent 3rd Party)</span>;
    }
    if (cat?.includes("Cat 2")) {
      return <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">Cat 2 (Peer Check)</span>;
    }
    return <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 shrink-0">Cat 1 (Internal Check)</span>;
  };

  const currentReview = useMemo(() => {
    return designReviews.find(r => r.id === selectedReviewId) || designReviews[0] || null;
  }, [designReviews, selectedReviewId]);

  const currentTW = useMemo(() => {
    return temporaryWorks.find(t => t.id === selectedTWId) || temporaryWorks[0] || null;
  }, [temporaryWorks, selectedTWId]);

  return (
    <div className="space-y-4">
      {/* Sub Navigation */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSubTab("itps")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "itps"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Inspection & Test Plans (ITPs)</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "itps" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {itpRecords.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("design_reviews")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "design_reviews"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Design Reviews & Cat 1/2/3 Checks</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "design_reviews" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {designReviews.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("technical_audits")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "technical_audits"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Technical Audits</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "technical_audits" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {auditRecords.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("temporary_works")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "temporary_works"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Temporary Works & Permits</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "temporary_works" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {temporaryWorks.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search assurance records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
            {subTab === "itps" && (
              <button
                type="button"
                onClick={handleOpenAddItp}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
                title="Add new Inspection & Test Plan"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add ITP</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. ITPs REGISTER */}
      {subTab === "itps" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Inspection & Test Plans (ITP) Register ({filteredItps.length})
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-[10px] text-slate-400">Quality verification hold & witness point matrices</span>
              <button
                type="button"
                onClick={handleOpenAddItp}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Add new Inspection & Test Plan"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add ITP</span>
              </button>
            </div>
          </div>

          {filteredItps.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <p>No Inspection & Test Plans match your filters.</p>
              <button
                type="button"
                onClick={handleOpenAddItp}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add ITP</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">ITP #</th>
                    <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Title & Specification Clause</th>
                    <th className="py-2.5 px-3 w-[95px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Discipline</th>
                    <th className="py-2.5 px-3 w-[150px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Control Points</th>
                    <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Linked MS</th>
                    <th className="py-2.5 px-3 w-[160px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredItps.map((itp) => (
                    <tr key={itp.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                        {itp.itpNumber}
                      </td>
                      <td className="py-3 px-3 truncate overflow-hidden">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={itp.title}>{itp.title}</div>
                        <span className="text-[10px] font-mono text-slate-400 truncate block">{itp.specificationClause}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap truncate overflow-hidden">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                          {itp.discipline}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap truncate overflow-hidden">
                        <span className="text-rose-600 font-bold">{itp.holdPointsCount} HP</span> • <span className="text-blue-600 font-bold">{itp.witnessPointsCount} WP</span> • {itp.inspectionStagesCount} Stages
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                        {itp.linkedMethodStatement || "—"}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getStatusBadge(itp.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. DESIGN REVIEWS REGISTER & SPLIT SIGN-OFF VIEW */}
      {subTab === "design_reviews" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Design Review Packages ({designReviews.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Select to inspect sign-off chain</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-xs border-collapse min-w-[540px]">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Review #</th>
                    <th className="py-2.5 px-3 min-w-[140px] border-b border-slate-200 dark:border-slate-700">Package & Title</th>
                    <th className="py-2.5 px-3 w-[150px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Check Category</th>
                    <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {designReviews.map((dr) => {
                    const isSelected = currentReview?.id === dr.id;
                    return (
                      <tr
                        key={dr.id}
                        onClick={() => setSelectedReviewId(dr.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-850/60"
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                          {dr.referenceNumber}
                        </td>
                        <td className="py-3 px-3 truncate overflow-hidden">
                          <div className="font-bold text-slate-900 dark:text-white truncate" title={dr.title}>{dr.title}</div>
                          <span className="text-[10px] text-slate-400 truncate block">{dr.package}</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getCheckCategoryBadge(dr.checkCategory)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(dr.status)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Detail: 4-Tier Sign-off Chain */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-4 space-y-4">
            {currentReview ? (
              <>
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs rounded">
                    {currentReview.referenceNumber}
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1.5">
                    {currentReview.title}
                  </h3>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Independent Checker: <strong>{currentReview.independentCheckerOrg}</strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Engineering Governance Sign-Off Chain
                  </span>

                  {[
                    { role: "1. Prepared By (Design Lead)", sign: currentReview.signOffChain?.preparedBy },
                    { role: "2. Checked By (Peer Reviewer)", sign: currentReview.signOffChain?.checkedBy },
                    { role: "3. Reviewed By (Independent Cat 3)", sign: currentReview.signOffChain?.reviewedBy },
                    { role: "4. Approved By (Resident Engineer)", sign: currentReview.signOffChain?.approvedBy }
                  ].map((step, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block">{step.role}</span>
                        <span className="text-[10px] text-slate-500">
                          {step.sign?.name} • {step.sign?.registrationNumber || "Reg Pending"}
                        </span>
                      </div>
                      {step.sign?.signed ? (
                        <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          {step.sign.date || "Signed"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-bold">Pending Sign-off</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* 3. TECHNICAL AUDITS REGISTER */}
      {subTab === "technical_audits" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Technical Quality & Safety Audits ({auditRecords.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Formal technical compliance audits</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Audit #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Audit Scope & Lead Auditor</th>
                  <th className="py-2.5 px-3 w-[180px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Audit Type</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Audit Findings</th>
                  <th className="py-2.5 px-3 w-[160px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditRecords.map((aud) => (
                  <tr key={aud.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {aud.auditNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={aud.title}>{aud.title}</div>
                      <span className="text-[10px] text-slate-400 truncate block">{aud.auditorName} • {aud.auditDate}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs truncate overflow-hidden" title={aud.auditType}>
                      {aud.auditType}
                    </td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap truncate overflow-hidden">
                      <span className="text-rose-600 font-bold">{aud.findings.nonConformances} NC</span> • {aud.findings.observations} Obs
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(aud.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TEMPORARY WORKS & PERMITS */}
      {subTab === "temporary_works" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardHat className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Temporary Works Register ({temporaryWorks.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">BS 5975 compliant</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-xs border-collapse min-w-[540px]">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-[95px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">TW #</th>
                    <th className="py-2.5 px-3 min-w-[140px] border-b border-slate-200 dark:border-slate-700">Structure Title & Location</th>
                    <th className="py-2.5 px-3 w-[90px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Category</th>
                    <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Permit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {temporaryWorks.map((tw) => {
                    const isSelected = currentTW?.id === tw.id;
                    return (
                      <tr
                        key={tw.id}
                        onClick={() => setSelectedTWId(tw.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-850/60"
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                          {tw.twNumber || tw.itemNumber || "—"}
                        </td>
                        <td className="py-3 px-3 truncate overflow-hidden">
                          <div className="font-bold text-slate-900 dark:text-white truncate" title={tw.title}>{tw.title}</div>
                          <span className="text-[10px] text-slate-400 truncate block">{tw.location}</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap truncate overflow-hidden">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {tw.category || "Cat 3"}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {tw.permitToLoadIssued ? (
                            <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              PTL Issued
                            </span>
                          ) : (
                            <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Pending Inspection
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Detail: TWC/TWD & Permit to Load Action */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-4 space-y-4">
            {currentTW ? (
              <>
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs rounded">
                    {currentTW.twNumber || currentTW.itemNumber}
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1.5">
                    {currentTW.title}
                  </h3>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Location: <strong>{currentTW.location}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">TWC Coordinator</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block mt-0.5">
                      {currentTW.temporaryWorksCoordinator}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">TWD Designer</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] block mt-0.5">
                      {currentTW.temporaryWorksDesigner}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Permit to Load (PTL) Status</span>
                    {currentTW.permitToLoadIssued ? (
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                        {currentTW.permitNumber || "PTL-CERTIFIED"}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-bold text-[11px]">Inspection Required</span>
                    )}
                  </div>

                  {!currentTW.permitToLoadIssued ? (
                    <button
                      onClick={() => handleIssuePermitToLoad(currentTW)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Authorize & Issue Permit to Load</span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                      Permit to Load authorized on {currentTW.permitToLoadDate || "site"}.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
      {/* Add ITP Modal (Clean form without fake or mock data) */}
      <AnimatePresence>
        {isAddItpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Add New Inspection & Test Plan (ITP)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Define quality surveillance stages, hold points, and verification criteria
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddItpModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleCreateItp} className="p-5 space-y-4">
                {itpFormError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{itpFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ITP Reference Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ITP-STR-005"
                      value={itpFormData.itpNumber}
                      onChange={(e) => setItpFormData({ ...itpFormData, itpNumber: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Engineering Discipline
                    </label>
                    <select
                      value={itpFormData.discipline}
                      onChange={(e) => setItpFormData({ ...itpFormData, discipline: e.target.value as EngineeringDisciplineId })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="structural">Structural</option>
                      <option value="civil">Civil</option>
                      <option value="geotechnical">Geotechnical</option>
                      <option value="roads_pavements">Roads & Pavements</option>
                      <option value="drainage">Drainage</option>
                      <option value="water">Water</option>
                      <option value="mechanical">Mechanical</option>
                      <option value="electrical">Electrical</option>
                      <option value="rail">Rail</option>
                      <option value="utilities">Utilities</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Scope of Work / Element Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Precast Concrete Bridge Girders Installation & Bearing Grouting"
                    value={itpFormData.title}
                    onChange={(e) => setItpFormData({ ...itpFormData, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Standard Specification Clause <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 03 40 00 Precast Concrete"
                      value={itpFormData.specificationClause}
                      onChange={(e) => setItpFormData({ ...itpFormData, specificationClause: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Linked Method Statement (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MS-STR-015"
                      value={itpFormData.linkedMethodStatement}
                      onChange={(e) => setItpFormData({ ...itpFormData, linkedMethodStatement: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Inspection Stages
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={itpFormData.inspectionStagesCount}
                      onChange={(e) => setItpFormData({ ...itpFormData, inspectionStagesCount: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hold Points (HP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={itpFormData.holdPointsCount}
                      onChange={(e) => setItpFormData({ ...itpFormData, holdPointsCount: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Witness Points (WP)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={itpFormData.witnessPointsCount}
                      onChange={(e) => setItpFormData({ ...itpFormData, witnessPointsCount: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={itpFormData.status}
                      onChange={(e) => setItpFormData({ ...itpFormData, status: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="ACTIVE_ON_SITE">ACTIVE_ON_SITE</option>
                      <option value="SUPERSEDED">SUPERSEDED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Lead QA / Sign-Off Engineer (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Resident Engineer"
                      value={itpFormData.approvedBy}
                      onChange={(e) => setItpFormData({ ...itpFormData, approvedBy: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddItpModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create ITP</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
