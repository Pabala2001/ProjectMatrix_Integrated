import React, { useState } from "react";
import { AlertTriangle, ShieldAlert, ArrowRight, Check, X } from "lucide-react";
import { DataConflictRecord } from "../../types/commercialWorkspace";

interface DataConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: DataConflictRecord | null;
  onResolve: (decision: "KEEP_EXISTING" | "OVERWRITE", overrideReason?: string) => void;
}

export const DataConflictModal: React.FC<DataConflictModalProps> = ({
  isOpen,
  onClose,
  conflict,
  onResolve
}) => {
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedDecision, setSelectedDecision] = useState<"KEEP_EXISTING" | "OVERWRITE">("KEEP_EXISTING");

  if (!isOpen || !conflict) return null;

  const handleConfirm = () => {
    onResolve(selectedDecision, overrideReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Data Conflict Detected
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-400">
                Uploaded commercial value differs from existing active record for "{conflict.entityIdentifier}".
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Project Matrix does not automatically overwrite financial records. Review the conflicting values below and select which record should remain active in the Commercial register.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Existing Active Record */}
            <div
              onClick={() => setSelectedDecision("KEEP_EXISTING")}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedDecision === "KEEP_EXISTING"
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-slate-500">
                  Existing Active Value
                </span>
                {selectedDecision === "KEEP_EXISTING" && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-lg font-mono font-bold text-slate-900 dark:text-white mb-2">
                {String(conflict.existingValue)}
              </p>
              <div className="text-[11px] space-y-1 text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">
                <p><strong>Source:</strong> {conflict.existingSource.originalFilename}</p>
                <p><strong>Date:</strong> {conflict.existingSource.uploadDate ? new Date(conflict.existingSource.uploadDate).toLocaleDateString() : "—"}</p>
                <p><strong>Recorded By:</strong> {conflict.existingSource.uploadedBy}</p>
              </div>
            </div>

            {/* Uploaded Conflicting Record */}
            <div
              onClick={() => setSelectedDecision("OVERWRITE")}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedDecision === "OVERWRITE"
                  ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400">
                  Uploaded Conflicting Value
                </span>
                {selectedDecision === "OVERWRITE" && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-600 text-white rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-lg font-mono font-bold text-slate-900 dark:text-white mb-2">
                {String(conflict.uploadedValue)}
              </p>
              <div className="text-[11px] space-y-1 text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">
                <p><strong>Source:</strong> {conflict.uploadedSource.originalFilename}</p>
                <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                <p><strong>Uploaded By:</strong> {conflict.uploadedSource.uploadedBy || "Current User"}</p>
              </div>
            </div>
          </div>

          {/* Override Rationale Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Audit Justification / Override Reason:
            </label>
            <textarea
              rows={2}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="State reason for resolution (e.g. approved revised contract variation or formal vendor credit adjustments)..."
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Check className="w-4 h-4" />
            Apply Decision & Log Audit
          </button>
        </div>
      </div>
    </div>
  );
};
