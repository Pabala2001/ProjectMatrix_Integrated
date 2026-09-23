import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Upload,
  FileText,
  FileCheck2,
  AlertCircle,
  Plus,
  Trash2,
  Scale,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { ContractDocumentItem, ContractDocumentVersion, ClauseOverrideItem } from "../../types/contractDocuments";
import { ContractEngine } from "../../services/ContractEngine";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  document: ContractDocumentItem;
  projectId: string;
  onVersionUploaded: () => void;
}

export default function DocumentVersionUploadModal({
  isOpen,
  onClose,
  document,
  projectId,
  onVersionUploaded
}: Props) {
  const [versionTag, setVersionTag] = useState(`Rev ${document.currentVersion.revisionNumber + 1}.0`);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [changeSummary, setChangeSummary] = useState("");
  const [uploadedBy, setUploadedBy] = useState("Lead Contracts Manager");
  const [signatoryEmployer, setSignatoryEmployer] = useState(document.currentVersion.signatoryEmployerRepresentative || "");
  const [signatoryContractor, setSignatoryContractor] = useState(document.currentVersion.signatoryContractorRepresentative || "");
  const [fileName, setFileName] = useState(`${document.referenceCode}_Rev_${document.currentVersion.revisionNumber + 1}.0.pdf`);
  const [fileSize, setFileSize] = useState("5.2 MB");

  // Clause overrides list
  const [clauseOverrides, setClauseOverrides] = useState<ClauseOverrideItem[]>([
    ...document.currentVersion.clauseOverrides.map(cov => ({ ...cov, id: `cov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }))
  ]);

  if (!isOpen) return null;

  const handleAddClauseOverride = () => {
    assertOperationalAction("create", "components/contracts/DocumentVersionUploadModal.tsx");
    const newCov: ClauseOverrideItem = {
      id: `cov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetClauseNumber: "20.2.1",
      clauseTitle: "Notice of Claim - Time Bar",
      modificationType: "MODIFIED",
      originalBaseSummary: "Contractor notice within 28 days of event awareness",
      amendedTextSummary: "Contractor notice within 14 calendar days with mandatory copy to Employer",
      operationalImpact: "Halves notice window from 28 to 14 days; strict time-bar forfeiture applies",
      timeBarStrictness: "STRICT_TIME_BAR",
      parameterOverrides: {
        deadlineDays: 14,
        deadlineUnit: "calendar_days"
      }
    };
    setClauseOverrides([...clauseOverrides, newCov]);
  };

  const handleRemoveClauseOverride = (id: string) => {
    assertOperationalAction("delete", "components/contracts/DocumentVersionUploadModal.tsx");
    setClauseOverrides(clauseOverrides.filter(c => c.id !== id));
  };

  const handleUpdateClauseOverride = (id: string, updates: Partial<ClauseOverrideItem>) => {
    assertOperationalAction("edit", "components/contracts/DocumentVersionUploadModal.tsx");
    setClauseOverrides(clauseOverrides.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/contracts/DocumentVersionUploadModal.tsx");
    e.preventDefault();
    if (!versionTag || !changeSummary) return;

    // Generate SHA-256 hash simulation
    const hash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    const newVersion: ContractDocumentVersion = {
      id: `ver-${Date.now()}`,
      documentId: document.id,
      versionTag,
      revisionNumber: document.currentVersion.revisionNumber + 1,
      effectiveDate,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      status: "Active (Effective)",
      supersedesVersionId: document.currentVersion.id,
      changeSummary,
      signatoryEmployerRepresentative: signatoryEmployer,
      signatoryContractorRepresentative: signatoryContractor,
      fileMetadata: {
        fileName,
        fileSize,
        fileType: "PDF",
        hashChecksum: hash,
        pagesCount: Math.floor(Math.random() * 50) + 20
      },
      clauseOverrides
    };

    ContractEngine.saveDocumentVersion(projectId, document.id, newVersion);
    onVersionUploaded();
    onClose();
  };

  return (
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
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Upload New Document Revision
              </h3>
              <p className="text-xs text-slate-400">
                {document.title} ({document.referenceCode})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Revision Tag / Version Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={versionTag}
                onChange={(e) => setVersionTag(e.target.value)}
                placeholder="e.g. Rev 2.1 (Addendum #3 Issue)"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Effective Legal Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Executive Revision Summary & Legal Reason for Change <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Detail why this document revision was issued, which addendum/negotiation triggered it, and its legal impact on project governance..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">Employer Representative Signatory</label>
              <input
                type="text"
                value={signatoryEmployer}
                onChange={(e) => setSignatoryEmployer(e.target.value)}
                placeholder="e.g. Eng. R. Mativila (CEO, TANROADS)"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">Contractor Representative Signatory</label>
              <input
                type="text"
                value={signatoryContractor}
                onChange={(e) => setSignatoryContractor(e.target.value)}
                placeholder="e.g. Dr. A. Mwamba (Managing Director)"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Clause Overrides & Procedural Modifiers Section */}
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Contract Clause Modifications & Procedural Overrides
                </h4>
              </div>
              <button
                type="button"
                onClick={handleAddClauseOverride}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Clause Override</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              When this document takes precedence (e.g. Particular Conditions or Addenda), these clause modifications will update the Effective Contract engine and AI Advisor reasoning in real-time.
            </p>

            {clauseOverrides.length === 0 ? (
              <div className="text-center py-4 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                No custom clause overrides defined for this document version.
              </div>
            ) : (
              <div className="space-y-3">
                {clauseOverrides.map((cov, idx) => (
                  <div
                    key={cov.id}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          Clause #{idx + 1}:
                        </span>
                        <input
                          type="text"
                          value={cov.targetClauseNumber}
                          onChange={(e) => handleUpdateClauseOverride(cov.id, { targetClauseNumber: e.target.value })}
                          placeholder="e.g. 20.2.1"
                          className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={cov.clauseTitle}
                          onChange={(e) => handleUpdateClauseOverride(cov.id, { clauseTitle: e.target.value })}
                          placeholder="Clause Title"
                          className="w-48 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveClauseOverride(cov.id)}
                        className="p-1 text-rose-500 hover:text-rose-700 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Amended Requirement Summary</label>
                        <textarea
                          rows={2}
                          value={cov.amendedTextSummary}
                          onChange={(e) => handleUpdateClauseOverride(cov.id, { amendedTextSummary: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Operational Impact</label>
                        <textarea
                          rows={2}
                          value={cov.operationalImpact}
                          onChange={(e) => handleUpdateClauseOverride(cov.id, { operationalImpact: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold">Deadline (Days):</span>
                        <input
                          type="number"
                          value={cov.parameterOverrides?.deadlineDays || ""}
                          onChange={(e) => handleUpdateClauseOverride(cov.id, {
                            parameterOverrides: {
                              ...cov.parameterOverrides,
                              deadlineDays: parseInt(e.target.value) || undefined
                            }
                          })}
                          placeholder="e.g. 14"
                          className="w-16 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold">Strictness:</span>
                        <select
                          value={cov.timeBarStrictness || "STRICT_TIME_BAR"}
                          onChange={(e) => handleUpdateClauseOverride(cov.id, { timeBarStrictness: e.target.value as any })}
                          className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-[10px]"
                        >
                          <option value="STRICT_TIME_BAR">STRICT TIME BAR (Absolute Forfeiture)</option>
                          <option value="CONDITIONAL_BAR">CONDITIONAL BAR</option>
                          <option value="PROCEDURAL_GUIDELINE">PROCEDURAL GUIDELINE</option>
                        </select>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Commit & Synthesize Revision</span>
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
}
