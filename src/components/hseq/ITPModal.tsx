import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, CheckSquare, Save, Eye, Edit } from "lucide-react";
import { ITPItem } from "../../types/hseq";

interface ITPModalProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData?: ITPItem | null;
  onSave: (item: ITPItem) => void;
  onClose: () => void;
  onSwitchToEdit?: () => void;
}

export default function ITPModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onClose,
  onSwitchToEdit,
}: ITPModalProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [formData, setFormData] = useState<Partial<ITPItem>>({
    id: "",
    title: "",
    specClause: "",
    holdPoints: "",
    witnessPoints: "",
    leadAuditor: "",
    status: "Approved",
    revision: "Rev 0",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        id: "",
        title: "",
        specClause: "",
        holdPoints: "",
        witnessPoints: "",
        leadAuditor: "",
        status: "Draft",
        revision: "Rev 0",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    }
    setError(null);
  }, [initialData, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/hseq/ITPModal.tsx");
    e.preventDefault();
    if (!formData.id?.trim()) {
      setError("ITP Reference is required (e.g. ITP-STR-001).");
      return;
    }
    if (!formData.title?.trim()) {
      setError("Scope of Work / Element description is required.");
      return;
    }
    if (!formData.specClause?.trim()) {
      setError("Standard Spec Clause is required.");
      return;
    }

    onSave({
      id: formData.id.trim(),
      title: formData.title.trim(),
      specClause: formData.specClause.trim(),
      holdPoints: formData.holdPoints?.trim() || "-",
      witnessPoints: formData.witnessPoints?.trim() || "-",
      leadAuditor: formData.leadAuditor?.trim() || "-",
      status: formData.status || "Draft",
      revision: formData.revision?.trim() || "Rev 0",
      date: formData.date || new Date().toISOString().split("T")[0],
      notes: formData.notes?.trim() || "",
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
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isView ? "Inspection & Test Plan (ITP) Details" : isEdit ? "Edit Inspection & Test Plan" : "Add New Inspection & Test Plan (ITP)"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isView ? "Review registered hold & witness points" : "Define quality surveillance stages and verification criteria"}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ITP Reference</span>
                <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formData.id}</div>
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
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scope of Work / Element</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formData.title}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Standard Specification</span>
                <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">{formData.specClause || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lead QA Sign-Off</span>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">{formData.leadAuditor || "-"}</div>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">Contract Hold Points (HP)</span>
              <div className="text-xs text-rose-900 dark:text-rose-200 font-medium mt-1 leading-relaxed">{formData.holdPoints || "-"}</div>
            </div>

            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Witness Points (WP)</span>
              <div className="text-xs text-amber-900 dark:text-amber-200 font-medium mt-1 leading-relaxed">{formData.witnessPoints || "-"}</div>
            </div>

            {formData.notes && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quality Notes / Inspection Frequency</span>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{formData.notes}</div>
              </div>
            )}

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
                  Edit Plan
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
                  ITP Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ITP-CIV-001"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Approved">Approved</option>
                  <option value="Approved by RE">Approved by RE</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Draft">Draft</option>
                  <option value="Conditional Approval">Conditional Approval</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Revision
                </label>
                <input
                  type="text"
                  placeholder="Rev 0"
                  value={formData.revision}
                  onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Scope of Work / Element Description *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Reinforced Concrete Deck Pours - Pier 1 to 4"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Standard Spec Clause *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COLTO 6400 / SANS 1200 GA Clause 5.2"
                  value={formData.specClause}
                  onChange={(e) => setFormData({ ...formData, specClause: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lead QA / QC Sign-Off
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief Quality Engineer"
                  value={formData.leadAuditor}
                  onChange={(e) => setFormData({ ...formData, leadAuditor: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contract Hold Points (HP)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Rebar pre-pour sign-off, Formwork release inspection by RE"
                value={formData.holdPoints}
                onChange={(e) => setFormData({ ...formData, holdPoints: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Witness Points (WP)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Concrete slump & cube sampling, Compaction testing"
                value={formData.witnessPoints}
                onChange={(e) => setFormData({ ...formData, witnessPoints: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Additional Inspection Criteria / Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional notes, testing frequencies, or standard lab references..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {isEdit ? "Save Changes" : "Create ITP"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
