import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  History,
  Upload,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileCheck2,
  FileDiff,
  Download,
  ShieldCheck,
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Eye,
  Hash,
  Scale,
  Sparkles,
  Info
} from "lucide-react";
import { ContractEngine } from "../../services/ContractEngine";
import { ContractDocumentItem, ContractDocumentVersion, ContractDocumentCategory } from "../../types/contractDocuments";
import DocumentVersionUploadModal from "./DocumentVersionUploadModal";

interface Props {
  projectId: string;
  projectName: string;
  onEffectiveContractUpdated?: () => void;
  onInterrogateDocumentWithAI?: (docTitle: string, versionTag: string) => void;
}

export default function ContractDocumentsVersionControl({
  projectId,
  projectName,
  onEffectiveContractUpdated,
  onInterrogateDocumentWithAI
}: Props) {
  const [documents, setDocuments] = useState<ContractDocumentItem[]>(() =>
    ContractEngine.getContractDocuments(projectId)
  );

  const [selectedDocForUpload, setSelectedDocForUpload] = useState<ContractDocumentItem | null>(null);
  const [selectedDocForHistory, setSelectedDocForHistory] = useState<ContractDocumentItem | null>(null);
  const [selectedDocForDiff, setSelectedDocForDiff] = useState<{
    doc: ContractDocumentItem;
    currentVer: ContractDocumentVersion;
    compareVer: ContractDocumentVersion;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const refreshDocuments = () => {
    setDocuments(ContractEngine.getContractDocuments(projectId));
    if (onEffectiveContractUpdated) {
      onEffectiveContractUpdated();
    }
  };

  const handleRevertVersion = (docId: string, versionId: string, versionTag: string) => {
    if (window.confirm(`Are you sure you want to revert to ${versionTag}? This will update the Effective Contract and time-bar calculations immediately.`)) {
      ContractEngine.revertDocumentVersion(projectId, docId, versionId);
      refreshDocuments();
      setSelectedDocForHistory(null);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.referenceCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.currentVersion.versionTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (categoryFilter !== "ALL" && doc.category !== categoryFilter) return false;
    return true;
  });

  const getCategoryBadgeColor = (category: ContractDocumentCategory) => {
    switch (category) {
      case "FORM_OF_AGREEMENT":
      case "LETTER_OF_ACCEPTANCE":
        return "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800";
      case "PARTICULAR_CONDITIONS":
        return "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      case "GENERAL_CONDITIONS":
        return "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800";
      case "SPECIFICATIONS":
        return "bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800";
      case "DRAWINGS":
        return "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      case "BOQ":
        return "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800";
      case "ADDENDA":
        return "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Contract Documents & Version Control Register
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Sub-Clause 1.5 Governance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Maintain strict version control over all constituent contract documents (General Conditions, Particular Conditions, Contract Data, Specs, Drawings, BOQ, Addenda) with cryptographic hash tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Constituent Documents</span>
            <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{documents.length} Managed Artefacts</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search document title, reference code (e.g. DOC-PC-001), version tag, or tags..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-bold shrink-0">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">All Document Types ({documents.length})</option>
            <option value="FORM_OF_AGREEMENT">Form of Agreement</option>
            <option value="LETTER_OF_ACCEPTANCE">Letter of Acceptance</option>
            <option value="PARTICULAR_CONDITIONS">Particular Conditions</option>
            <option value="GENERAL_CONDITIONS">General Conditions</option>
            <option value="SPECIFICATIONS">Technical Specifications</option>
            <option value="DRAWINGS">Drawings (IFC)</option>
            <option value="BOQ">Bills of Quantities</option>
            <option value="ADDENDA">Addenda & Supplementary Agreements</option>
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredDocuments.map((doc) => {
          const hasHistory = doc.versionHistory && doc.versionHistory.length > 0;
          const current = doc.currentVersion;
          const overridesCount = current.clauseOverrides ? current.clauseOverrides.length : 0;

          return (
            <div
              key={doc.id}
              className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all space-y-4"
            >
              {/* Card Top Row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-mono text-sm font-black shrink-0">
                    #{doc.precedenceRank}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {doc.title}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${getCategoryBadgeColor(doc.category)}`}>
                        {doc.category.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {doc.referenceCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {doc.description}
                    </p>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {onInterrogateDocumentWithAI && (
                    <button
                      onClick={() => onInterrogateDocumentWithAI(doc.title, current.versionTag)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>✦ Interrogate</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedDocForUpload(doc)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload New Revision</span>
                  </button>

                  <button
                    onClick={() => setSelectedDocForHistory(doc)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Revisions ({doc.versionHistory.length + 1})</span>
                  </button>
                </div>
              </div>

              {/* Current Version Detail Strip */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-850/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
                
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-0.5">
                    Active Effective Version
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{current.versionTag}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Effective: {current.effectiveDate}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-0.5">
                    Signatory & Authority
                  </span>
                  <div className="text-slate-700 dark:text-slate-300 font-medium truncate">
                    {current.uploadedBy || "Procurement Committee"}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {current.signatoryEmployerRepresentative ? `Employer: ${current.signatoryEmployerRepresentative}` : "Standard Issue"}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-0.5">
                    Clause Modifications
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {overridesCount > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-black">
                        {overridesCount} Procedural Overrides
                      </span>
                    ) : (
                      <span className="text-slate-500 font-normal">
                        No overrides (Standard)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Priority Rank #{doc.precedenceRank} in precedence
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-0.5">
                    Digital Hash (SHA-256)
                  </span>
                  <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate flex items-center gap-1">
                    <Hash className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>{current.fileMetadata.hashChecksum.slice(0, 16)}...</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {current.fileMetadata.fileName} ({current.fileMetadata.fileSize})
                  </div>
                </div>

              </div>

              {/* Change summary of current version */}
              {current.changeSummary && (
                <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                  <strong className="text-slate-900 dark:text-white">Change Summary: </strong>
                  {current.changeSummary}
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Upload Revision Modal */}
      {selectedDocForUpload && (
        <DocumentVersionUploadModal
          isOpen={true}
          onClose={() => setSelectedDocForUpload(null)}
          document={selectedDocForUpload}
          projectId={projectId}
          onVersionUploaded={refreshDocuments}
        />
      )}

      {/* Version History Drawer / Modal */}
      <AnimatePresence>
        {selectedDocForHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Version History & Revision Audit Trail
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedDocForHistory.title} ({selectedDocForHistory.referenceCode})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDocForHistory(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Revision List */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                
                {/* Active current version */}
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border-2 border-emerald-500/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-600 text-white">
                        ACTIVE EFFECTIVE VERSION
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {selectedDocForHistory.currentVersion.versionTag}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Effective: {selectedDocForHistory.currentVersion.effectiveDate}
                    </span>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedDocForHistory.currentVersion.changeSummary}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-emerald-200 dark:border-emerald-900/60">
                    <span>Uploaded by: <strong>{selectedDocForHistory.currentVersion.uploadedBy}</strong></span>
                    <span className="font-mono">Checksum: {selectedDocForHistory.currentVersion.fileMetadata.hashChecksum.slice(0, 16)}...</span>
                  </div>
                </div>

                {/* Superseded Revisions */}
                {selectedDocForHistory.versionHistory.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">
                    No superseded previous revisions registered for this document yet.
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Superseded Historical Revisions
                    </h4>

                    {selectedDocForHistory.versionHistory.map((historyVer) => (
                      <div
                        key={historyVer.id}
                        className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              SUPERSEDED
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {historyVer.versionTag}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedDocForDiff({
                                doc: selectedDocForHistory,
                                currentVer: selectedDocForHistory.currentVersion,
                                compareVer: historyVer
                              })}
                              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <FileDiff className="w-3 h-3" />
                              <span>Diff</span>
                            </button>

                            <button
                              onClick={() => handleRevertVersion(selectedDocForHistory.id, historyVer.id, historyVer.versionTag)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Revert to this</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-slate-600 dark:text-slate-400">
                          {historyVer.changeSummary}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span>Effective: {historyVer.effectiveDate}</span>
                          <span className="font-mono">Uploaded: {new Date(historyVer.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Diff Side-by-Side Modal */}
      <AnimatePresence>
        {selectedDocForDiff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div>
                  <h3 className="text-base font-black text-white">
                    Side-by-Side Revision Diff & Clause Comparison
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comparing {selectedDocForDiff.compareVer.versionTag} ➔ {selectedDocForDiff.currentVer.versionTag}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDocForDiff(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close Diff
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Previous Version */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold rounded text-[10px]">
                      PREVIOUS: {selectedDocForDiff.compareVer.versionTag}
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {selectedDocForDiff.compareVer.changeSummary}
                    </p>
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <strong className="text-slate-700 dark:text-slate-300 block">Clause Overrides ({selectedDocForDiff.compareVer.clauseOverrides.length}):</strong>
                      {selectedDocForDiff.compareVer.clauseOverrides.map((c, i) => (
                        <div key={i} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          <span className="font-bold font-mono">Clause {c.targetClauseNumber}:</span> {c.amendedTextSummary}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Current Active Version */}
                  <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-300 dark:border-emerald-800 space-y-2">
                    <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono font-bold rounded text-[10px]">
                      CURRENT ACTIVE: {selectedDocForDiff.currentVer.versionTag}
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {selectedDocForDiff.currentVer.changeSummary}
                    </p>
                    <div className="space-y-1.5 pt-2 border-t border-emerald-200 dark:border-emerald-900/60">
                      <strong className="text-emerald-900 dark:text-emerald-300 block">Active Overrides ({selectedDocForDiff.currentVer.clauseOverrides.length}):</strong>
                      {selectedDocForDiff.currentVer.clauseOverrides.map((c, i) => (
                        <div key={i} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center justify-between">
                            <span className="font-black font-mono text-emerald-700 dark:text-emerald-400">Clause {c.targetClauseNumber} ({c.clauseTitle}):</span>
                            {c.parameterOverrides?.deadlineDays && (
                              <span className="font-mono font-bold text-[10px] bg-emerald-100 text-emerald-800 px-1.5 rounded">
                                {c.parameterOverrides.deadlineDays} Days
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 mt-1">{c.amendedTextSummary}</p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold mt-1">Impact: {c.operationalImpact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
