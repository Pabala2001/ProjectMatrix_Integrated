import React from "react";
import {
  FileText,
  Calendar,
  User,
  ShieldCheck,
  Hash,
  Clock,
  Layers,
  X,
  History,
  AlertCircle
} from "lucide-react";
import { SourceProvenance, CommercialAuditEntry } from "../../types/commercialWorkspace";

interface SourceTraceabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  source?: SourceProvenance;
  auditTrail?: CommercialAuditEntry[];
  currentValue?: any;
  fieldName?: string;
  currency?: string;
}

export const SourceTraceabilityModal: React.FC<SourceTraceabilityModalProps> = ({
  isOpen,
  onClose,
  title,
  source,
  auditTrail = [],
  currentValue,
  fieldName,
  currency = "USD"
}) => {
  if (!isOpen) return null;

  const formatDisplayValue = (val: any) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "number") return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Source Traceability & Audit Provenance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {title || "Commercial Record Provenance"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Active Value Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                {fieldName || "Current Commercial Value"}
              </span>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                {formatDisplayValue(currentValue)}
              </p>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {source?.importStatus || "VERIFIED SOURCE"}
              </span>
            </div>
          </div>

          {/* Primary Source Provenance */}
          {source ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                Original Source Metadata
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
                  <span className="text-[11px] text-slate-400 block">Source Document</span>
                  <p className="font-semibold text-slate-900 dark:text-white break-all flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {source.originalFilename || "Manual Direct Entry"}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
                  <span className="text-[11px] text-slate-400 block">Uploaded / Created By</span>
                  <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {source.uploadedBy || "Authorized User"}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
                  <span className="text-[11px] text-slate-400 block">Recorded Timestamp</span>
                  <p className="font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {source.uploadDate ? new Date(source.uploadDate).toLocaleString() : "—"}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
                  <span className="text-[11px] text-slate-400 block">Sheet / Page / Cell Location</span>
                  <p className="font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {source.sheetOrPage || "Primary Extract"}
                  </p>
                </div>

                {source.originalField && (
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
                    <span className="text-[11px] text-slate-400 block">Source Header / Raw Field</span>
                    <p className="font-mono text-slate-800 dark:text-slate-200">
                      {source.originalField}
                    </p>
                  </div>
                )}

                {source.originalValue !== undefined && source.originalValue !== null && (
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
                    <span className="text-[11px] text-slate-400 block">Original Raw Extracted Value</span>
                    <p className="font-mono text-slate-800 dark:text-slate-200">
                      {String(source.originalValue)}
                    </p>
                  </div>
                )}
              </div>

              {source.overrideReason && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs">
                  <span className="font-bold text-amber-900 dark:text-amber-200 block mb-0.5">
                    Authorized Override Rationale:
                  </span>
                  <p className="text-amber-800 dark:text-amber-300">
                    {source.overrideReason}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <AlertCircle className="w-6 h-6 mx-auto text-slate-400 mb-1" />
              <p className="text-xs">No explicit source document attached. Value originated from system record entry.</p>
            </div>
          )}

          {/* Audit Trail Section */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-500" />
              Modification History & Sign-Offs
            </h4>

            {auditTrail.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No previous modifications on this record.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {auditTrail.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {entry.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        By: <span className="font-medium">{entry.changedBy}</span>
                        {entry.overrideReason && ` — Reason: "${entry.overrideReason}"`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Provenance
          </button>
        </div>
      </div>
    </div>
  );
};
