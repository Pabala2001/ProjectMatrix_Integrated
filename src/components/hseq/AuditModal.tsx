import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, ClipboardCheck, Save, Edit } from "lucide-react";
import { AuditItem } from "../../types/hseq";

interface AuditModalProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData?: AuditItem | null;
  onSave: (item: AuditItem) => void;
  onClose: () => void;
  onSwitchToEdit?: () => void;
}

export default function AuditModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onClose,
  onSwitchToEdit,
}: AuditModalProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [formData, setFormData] = useState<Partial<AuditItem>>({
    id: "",
    title: "",
    standard: "ISO 9001:2015 (Quality)",
    auditDate: new Date().toISOString().split("T")[0],
    auditor: "",
    findings: "",
    scope: "",
    carCount: 0,
    outcome: "Passed (Zero NCRs)",
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        id: `AUD-${Math.floor(100 + Math.random() * 900)}`,
        title: "",
        standard: "ISO 9001:2015 (Quality)",
        auditDate: new Date().toISOString().split("T")[0],
        auditor: "",
        findings: "",
        scope: "",
        carCount: 0,
        outcome: "Passed (Zero NCRs)",
      });
    }
    setError(null);
  }, [initialData, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/hseq/AuditModal.tsx");
    e.preventDefault();
    if (!formData.id?.trim()) {
      setError("Audit Reference is required.");
      return;
    }
    if (!formData.title?.trim()) {
      setError("Audit Title / Scope is required.");
      return;
    }
    if (!formData.auditor?.trim()) {
      setError("Lead Auditor name is required.");
      return;
    }
    if (!formData.findings?.trim()) {
      setError("Findings summary is required.");
      return;
    }

    onSave({
      id: formData.id.trim(),
      title: formData.title.trim(),
      standard: formData.standard || "ISO 9001:2015 (Quality)",
      auditDate: formData.auditDate || new Date().toISOString().split("T")[0],
      auditor: formData.auditor.trim(),
      findings: formData.findings.trim(),
      scope: formData.scope?.trim() || "",
      carCount: Number(formData.carCount) || 0,
      outcome: formData.outcome || "Passed (Zero NCRs)",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isView ? "Audit & Compliance Review Details" : isEdit ? "Edit Audit Record" : "Schedule / Log Quality & Safety Audit"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isView ? "Review compliance standards, CAR actions, and audit outcome" : "Log ISO 9001, ISO 14001, ISO 45001 or Client Contractual Audits"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {isView ? (
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Audit Ref</span>
                <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formData.id}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Governing Standard</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.standard}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Outcome</span>
                <div className="mt-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    formData.outcome?.includes("Passed")
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}>
                    {formData.outcome}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Audit Title</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formData.title}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lead Auditor</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.auditor || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Audit Date</span>
                <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">{formData.auditDate || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Corrective Action (CARs)</span>
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-1">{formData.carCount || 0} CARs</div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Audit Findings & Observations</span>
              <div className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{formData.findings}</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              {onSwitchToEdit && (
                <button
                  type="button"
                  onClick={onSwitchToEdit}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0B172A] hover:bg-slate-800 dark:bg-white dark:text-[#0B172A] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Audit
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Audit Ref *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AUD-ISO-2026-02"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Standard
                </label>
                <select
                  value={formData.standard}
                  onChange={(e) => setFormData({ ...formData, standard: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ISO 9001:2015 (Quality)">ISO 9001:2015 (Quality)</option>
                  <option value="ISO 14001:2015 (Environmental)">ISO 14001:2015 (Environmental)</option>
                  <option value="ISO 45001:2018 (OH&S)">ISO 45001:2018 (OH&amp;S)</option>
                  <option value="Client Contractual Audit">Client Contractual Audit</option>
                  <option value="Statutory Inspection">Statutory / Dept of Labour</option>
                  <option value="Internal Corporate Audit">Internal Corporate Audit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Outcome
                </label>
                <select
                  value={formData.outcome}
                  onChange={(e) => setFormData({ ...formData, outcome: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Passed (Zero NCRs)">Passed (Zero NCRs)</option>
                  <option value="Passed (Minor Observations)">Passed (Minor Observations)</option>
                  <option value="Conditional Pass">Conditional Pass</option>
                  <option value="Major Non-Conformance">Major Non-Conformance</option>
                  <option value="Under Review">Under Review</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Audit Title / Objective *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Q1 Client Quality & Safety Compliance Verification"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Audit Date
                </label>
                <input
                  type="date"
                  value={formData.auditDate}
                  onChange={(e) => setFormData({ ...formData, auditDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Auditor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. External Lead Auditor (BSI/SABS)"
                  value={formData.auditor}
                  onChange={(e) => setFormData({ ...formData, auditor: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  CAR Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.carCount}
                  onChange={(e) => setFormData({ ...formData, carCount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Audit Findings & Corrective Action Recommendations *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Summary of audit findings, strengths, areas for improvement, and corrective actions required..."
                value={formData.findings}
                onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {isEdit ? "Save Changes" : "Save Audit Record"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
