import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileCheck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Download,
  Paperclip,
  Check,
  X,
  Building,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  ShoppingBag
} from "lucide-react";
import { 
  TechnicalSubmittal, 
  EngineeringDisciplineId, 
  SubmittalStatus, 
  ProcurementSyncStatus 
} from "../../types/engineering";

interface TechnicalSubmittalsViewProps {
  submittals: TechnicalSubmittal[];
  onAddSubmittal: (sub: TechnicalSubmittal) => void;
  onUpdateSubmittal: (sub: TechnicalSubmittal) => void;
  activeDisciplineFilter: string;
  onSelectDisciplineFilter: (discipline: string) => void;
  availableDisciplines: { id: EngineeringDisciplineId; name: string; code: string }[];
}

export default function TechnicalSubmittalsView({
  submittals,
  onAddSubmittal,
  onUpdateSubmittal,
  activeDisciplineFilter,
  onSelectDisciplineFilter,
  availableDisciplines
}: TechnicalSubmittalsViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [procurementFilter, setProcurementFilter] = useState<string>("all");
  const [selectedSubmittal, setSelectedSubmittal] = useState<TechnicalSubmittal | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Form State
  const [newSubNumber, setNewSubNumber] = useState(`MAT-05${submittals.length + 1}`);
  const [newTitle, setNewTitle] = useState("");
  const [newDiscipline, setNewDiscipline] = useState<EngineeringDisciplineId>("structural");
  const [newSpecification, setNewSpecification] = useState("03 30 00 - Structural Cast-in-Place Concrete");
  const [newSupplier, setNewSupplier] = useState("Mbeya Cement Ltd");
  const [newStatus, setNewStatus] = useState<SubmittalStatus>("UNDER_REVIEW");
  const [hasTDS, setHasTDS] = useState(true);
  const [hasTestCert, setHasTestCert] = useState(true);
  const [hasCompCert, setHasCompCert] = useState(true);
  const [hasSample, setHasSample] = useState(true);
  const [hasFactoryAudit, setHasFactoryAudit] = useState(false);

  const filteredSubmittals = submittals.filter(item => {
    const matchesSearch =
      item.submittalNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.specification.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDiscipline = activeDisciplineFilter === "all" || item.discipline === activeDisciplineFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesProcurement = procurementFilter === "all" || item.procurementStatus === procurementFilter;

    return matchesSearch && matchesDiscipline && matchesStatus && matchesProcurement;
  });

  const approvedCount = submittals.filter(s => s.status === "APPROVED" || s.status === "APPROVED_AS_NOTED").length;
  const underReviewCount = submittals.filter(s => s.status === "UNDER_REVIEW").length;
  const approvedForProcurementCount = submittals.filter(s => s.procurementStatus === "Approved for Procurement" || s.procurementStatus === "PO Released").length;

  const getStatusBadge = (status: SubmittalStatus) => {
    switch (status) {
      case "APPROVED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">APPROVED</span>;
      case "APPROVED_AS_NOTED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">APPROVED AS NOTED</span>;
      case "UNDER_REVIEW":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">UNDER REVIEW</span>;
      case "REVISE_RESUBMIT":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">REVISE & RESUBMIT</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">REJECTED</span>;
    }
  };

  const getProcurementBadge = (pStatus: ProcurementSyncStatus) => {
    switch (pStatus) {
      case "Approved for Procurement":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <Check className="w-3 h-3" /> Approved for Procurement
          </span>
        );
      case "PO Released":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
            <Truck className="w-3 h-3" /> PO Released
          </span>
        );
      case "Blocked Pending Submittal Approval":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Blocked Pending Approval
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-400">{pStatus}</span>;
    }
  };

  const handleApproveSubmittal = (sub: TechnicalSubmittal) => {
    assertOperationalAction("approve", "components/engineering/TechnicalSubmittalsView.tsx");
    const updated: TechnicalSubmittal = {
      ...sub,
      status: "APPROVED",
      approvedBy: "Resident Engineer - Dr. A. Mwamba",
      approvalDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      procurementStatus: "Approved for Procurement",
      consultantRemarks: "Verified compliant with specifications and project standards. Released for procurement."
    };
    onUpdateSubmittal(updated);
    setSelectedSubmittal(updated);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    assertOperationalAction("create", "components/engineering/TechnicalSubmittalsView.tsx");
    e.preventDefault();
    const newEntry: TechnicalSubmittal = {
      id: `sub-${Date.now()}`,
      submittalNumber: newSubNumber,
      title: newTitle,
      discipline: newDiscipline,
      specification: newSpecification,
      supplier: newSupplier,
      submittedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: newStatus,
      approvedBy: newStatus === "APPROVED" ? "Resident Engineer - Dr. A. Mwamba" : "Under Review",
      approvalDate: newStatus === "APPROVED" ? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
      revision: "Rev 0",
      documents: {
        technicalDataSheet: { attached: hasTDS, documentRef: hasTDS ? `TDS-${newSubNumber}.pdf` : "" },
        testCertificate: { attached: hasTestCert, documentRef: hasTestCert ? `TC-${newSubNumber}.pdf` : "" },
        complianceCertificate: { attached: hasCompCert, documentRef: hasCompCert ? `ISO-${newSubNumber}.pdf` : "" },
        sampleApproval: { attached: hasSample, documentRef: hasSample ? `Sample-${newSubNumber}.pdf` : "" },
        factoryAudit: { attached: hasFactoryAudit, documentRef: hasFactoryAudit ? `Audit-${newSubNumber}.pdf` : "" }
      },
      procurementStatus: newStatus === "APPROVED" ? "Approved for Procurement" : "Blocked Pending Submittal Approval",
      leadTimeWeeks: 2
    };

    onAddSubmittal(newEntry);
    setIsAddModalOpen(false);
    setSelectedSubmittal(newEntry);
  };

  return (
    <div className="space-y-4">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Submittals</span>
            <FileCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{submittals.length}</span>
            <span className="text-xs text-slate-400 font-medium">Logged in Register</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Approved Materials</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{approvedCount}</span>
            <span className="text-xs text-slate-400 font-medium">Consultant Endorsed</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Under Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{underReviewCount}</span>
            <span className="text-xs text-slate-400 font-medium">Engineer Action</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Procurement Cleared</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{approvedForProcurementCount}</span>
            <span className="text-xs text-slate-400 font-medium">Supply Chain Active</span>
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search material, spec, supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="APPROVED_AS_NOTED">Approved as Noted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>New Technical Submittal</span>
        </button>
      </div>

      {/* Submittals Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Submittal # & Material</th>
                <th className="px-4 py-3">Specification</th>
                <th className="px-4 py-3">Supplier / Manufacturer</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3 text-center">Compliance Checklist</th>
                <th className="px-4 py-3">Procurement Sync</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSubmittals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No technical submittals found.
                  </td>
                </tr>
              ) : (
                filteredSubmittals.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelectedSubmittal(sub)}
                    className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {sub.submittalNumber}
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5 truncate max-w-xs">
                        {sub.title}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{sub.specification}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{sub.supplier}</div>
                      <div className="text-[10px] text-slate-400">{sub.manufacturer || sub.supplier}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-800 dark:text-slate-200">{sub.submittedDate}</div>
                      <span className="text-[10px] font-mono text-slate-400">{sub.revision}</span>
                    </td>

                    <td className="px-4 py-3.5">
                      {getStatusBadge(sub.status)}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span title="Technical Data Sheet" className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${sub.documents.technicalDataSheet.attached ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300" : "bg-slate-100 text-slate-400"}`}>
                          TDS
                        </span>
                        <span title="Test Certificate" className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${sub.documents.testCertificate.attached ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300" : "bg-slate-100 text-slate-400"}`}>
                          TC
                        </span>
                        <span title="Compliance Certificate" className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${sub.documents.complianceCertificate.attached ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300" : "bg-slate-100 text-slate-400"}`}>
                          CC
                        </span>
                        <span title="Sample Approval" className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${sub.documents.sampleApproval.attached ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300" : "bg-slate-100 text-slate-400"}`}>
                          SA
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {getProcurementBadge(sub.procurementStatus)}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubmittal(sub);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

      {/* DETAIL DRAWER */}
      <AnimatePresence>
        {selectedSubmittal && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubmittal(null)}
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
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {selectedSubmittal.submittalNumber}
                      </span>
                      {getStatusBadge(selectedSubmittal.status)}
                    </div>
                    <h3 className="font-bold text-sm text-white truncate max-w-md">
                      {selectedSubmittal.title}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSubmittal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* 1. Header Information Box (Directly matches user prompt format) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Specification</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedSubmittal.specification}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Supplier</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedSubmittal.supplier}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Submitted</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{selectedSubmittal.submittedDate}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                    <div className="mt-0.5">{getStatusBadge(selectedSubmittal.status)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Approved by</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedSubmittal.approvedBy}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Approval Date</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{selectedSubmittal.approvalDate || "Pending Review"}</div>
                  </div>
                </div>

                {/* 2. Documents Compliance Checklist (Prompt requirements) */}
                <div className="p-4 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <span>Technical Compliance Documents</span>
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedSubmittal.documents.technicalDataSheet.attached ? (
                          <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                        ) : (
                          <X className="w-4 h-4 text-rose-500 stroke-[3]" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Technical Data Sheet (TDS)</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {selectedSubmittal.documents.technicalDataSheet.documentRef || "Not Provided"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedSubmittal.documents.testCertificate.attached ? (
                          <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                        ) : (
                          <X className="w-4 h-4 text-rose-500 stroke-[3]" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Laboratory Test Certificate</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {selectedSubmittal.documents.testCertificate.documentRef || "Not Provided"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedSubmittal.documents.complianceCertificate.attached ? (
                          <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                        ) : (
                          <X className="w-4 h-4 text-rose-500 stroke-[3]" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Compliance & ISO Certificate</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {selectedSubmittal.documents.complianceCertificate.documentRef || "Not Provided"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedSubmittal.documents.sampleApproval.attached ? (
                          <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                        ) : (
                          <X className="w-4 h-4 text-rose-500 stroke-[3]" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Physical Sample Inspection & Sign-off</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {selectedSubmittal.documents.sampleApproval.documentRef || "Not Provided"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Procurement Synchronization Strip */}
                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                        Procurement & Supply Chain State
                      </h4>
                    </div>
                    {getProcurementBadge(selectedSubmittal.procurementStatus)}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {selectedSubmittal.procurementStatus === "Approved for Procurement"
                      ? "Engineering has officially certified this material. Supply chain is authorized to issue purchase orders and receive site deliveries."
                      : "Procurement lock active. No purchase orders may be issued until the Resident Engineer certifies submittal compliance."}
                  </p>

                  {selectedSubmittal.linkedPurchaseOrder && (
                    <div className="pt-2 border-t border-blue-200 dark:border-blue-800/50 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Linked Purchase Order:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {selectedSubmittal.linkedPurchaseOrder}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Consultant Review Remarks */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Consultant Remarks & Endorsements</span>
                  <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedSubmittal.consultantRemarks || "Pending formal review comments."}
                  </p>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <button
                  onClick={() => setSelectedSubmittal(null)}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>

                {selectedSubmittal.status !== "APPROVED" && (
                  <button
                    onClick={() => handleApproveSubmittal(selectedSubmittal)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve for Procurement</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE SUBMITTAL MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm text-white">New Technical Submittal</h4>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Submittal #</label>
                  <input
                    type="text"
                    value={newSubNumber}
                    onChange={(e) => setNewSubNumber(e.target.value)}
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
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Material / Item Title</label>
                <input
                  type="text"
                  placeholder="e.g. CEM I 42.5N Portland Cement"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Specification Section</label>
                  <input
                    type="text"
                    value={newSpecification}
                    onChange={(e) => setNewSpecification(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Supplier / Manufacturer</label>
                  <input
                    type="text"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Compliance Checklist Checkboxes */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Enclosed Compliance Attachments</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hasTDS} onChange={(e) => setHasTDS(e.target.checked)} className="rounded" />
                    <span>Technical Data Sheet</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hasTestCert} onChange={(e) => setHasTestCert(e.target.checked)} className="rounded" />
                    <span>Test Certificate</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hasCompCert} onChange={(e) => setHasCompCert(e.target.checked)} className="rounded" />
                    <span>Compliance Certificate</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hasSample} onChange={(e) => setHasSample(e.target.checked)} className="rounded" />
                    <span>Sample Approval</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Create Submittal
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
