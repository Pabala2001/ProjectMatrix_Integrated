import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, AlertTriangle, Save, Edit } from "lucide-react";
import { NCRItem } from "../../types/hseq";

interface NCRModalProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData?: NCRItem | null;
  onSave: (item: NCRItem) => void;
  onClose: () => void;
  onSwitchToEdit?: () => void;
}

export default function NCRModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onClose,
  onSwitchToEdit,
}: NCRModalProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [formData, setFormData] = useState<Partial<NCRItem>>({
    id: "",
    title: "",
    clause: "",
    dateRaised: new Date().toISOString().split("T")[0],
    raisedBy: "",
    severity: "Major",
    location: "",
    rootCause: "",
    correctiveAction: "",
    targetDate: "",
    status: "Open",
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        id: "",
        title: "",
        clause: "",
        dateRaised: new Date().toISOString().split("T")[0],
        raisedBy: "",
        severity: "Major",
        location: "",
        rootCause: "",
        correctiveAction: "",
        targetDate: "",
        status: "Open",
      });
    }
    setError(null);
  }, [initialData, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/hseq/NCRModal.tsx");
    e.preventDefault();
    if (!formData.id?.trim()) {
      setError("NCR Reference is required (e.g. NCR-STR-001).");
      return;
    }
    if (!formData.title?.trim()) {
      setError("Deficiency Summary / Title is required.");
      return;
    }
    if (!formData.clause?.trim()) {
      setError("Specification Clause is required.");
      return;
    }
    if (!formData.correctiveAction?.trim()) {
      setError("Approved Corrective Action (CAPA) is required.");
      return;
    }

    onSave({
      id: formData.id.trim(),
      title: formData.title.trim(),
      clause: formData.clause.trim(),
      dateRaised: formData.dateRaised || new Date().toISOString().split("T")[0],
      raisedBy: formData.raisedBy?.trim() || "-",
      severity: formData.severity || "Major",
      location: formData.location?.trim() || "",
      rootCause: formData.rootCause?.trim() || "",
      correctiveAction: formData.correctiveAction.trim(),
      targetDate: formData.targetDate || "",
      status: formData.status || "Open",
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
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isView ? "Non-Conformance Report (NCR) Details" : isEdit ? "Edit Non-Conformance Report" : "Add Non-Conformance Report (NCR & CAPA)"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isView ? "Deficiency summary and approved corrective actions" : "Record quality deficiency and establish corrective action plan"}
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
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">NCR Reference</span>
                <div className="text-sm font-mono font-bold text-rose-600 mt-0.5">{formData.id}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Severity</span>
                <div className="mt-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    formData.severity === "Critical" || formData.severity === "Major"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    {formData.severity}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</span>
                <div className="mt-1">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {formData.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Deficiency Summary</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formData.title}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Specification Clause</span>
                <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">{formData.clause || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date Raised / Raised By</span>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                  {formData.dateRaised} · {formData.raisedBy || "Site Inspector"}
                </div>
              </div>
            </div>

            {formData.location && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Location / Workface</span>
                <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">{formData.location}</div>
              </div>
            )}

            {formData.rootCause && (
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">Root Cause Analysis</span>
                <div className="text-xs text-amber-900 dark:text-amber-200 mt-1 leading-relaxed">{formData.rootCause}</div>
              </div>
            )}

            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Approved Corrective Action (CAPA)</span>
              <div className="text-xs text-emerald-900 dark:text-emerald-200 font-medium mt-1 leading-relaxed">{formData.correctiveAction}</div>
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
                  Edit NCR
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
                  NCR Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NCR-STR-014"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Observation">Observation</option>
                  <option value="Minor">Minor Non-Conformance</option>
                  <option value="Major">Major Non-Conformance</option>
                  <option value="Critical">Critical Deficiency</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Open">Open</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Rectification In Progress">Rectification In Progress</option>
                  <option value="Resolved & Closed">Resolved & Closed</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Deficiency Summary / Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Honeycombing on Pier 2 Stem Wall after stripping"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Specification Clause Violated *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SANS 2001:CC1 Clause 4.3"
                  value={formData.clause}
                  onChange={(e) => setFormData({ ...formData, clause: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Raised By
                </label>
                <input
                  type="text"
                  placeholder="e.g. Resident Engineer / QA Officer"
                  value={formData.raisedBy}
                  onChange={(e) => setFormData({ ...formData, raisedBy: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Date Raised
                </label>
                <input
                  type="date"
                  value={formData.dateRaised}
                  onChange={(e) => setFormData({ ...formData, dateRaised: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Location / Chainage
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pier 2, Km 14+300"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Root Cause Analysis
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Inadequate vibrator needle insertion depth during final lift"
                value={formData.rootCause}
                onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Approved Corrective Action (CAPA) *
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Chip to sound concrete, apply structural epoxy bonding agent, and patch with approved micro-concrete"
                value={formData.correctiveAction}
                onChange={(e) => setFormData({ ...formData, correctiveAction: e.target.value })}
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
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {isEdit ? "Save Changes" : "Create NCR"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
