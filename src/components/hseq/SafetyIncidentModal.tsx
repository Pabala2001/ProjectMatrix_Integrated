import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, HardHat, AlertTriangle, Save, Edit } from "lucide-react";
import { SafetyIncidentItem } from "../../types/hseq";

interface SafetyIncidentModalProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData?: SafetyIncidentItem | null;
  onSave: (item: SafetyIncidentItem) => void;
  onClose: () => void;
  onSwitchToEdit?: () => void;
}

export default function SafetyIncidentModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onClose,
  onSwitchToEdit,
}: SafetyIncidentModalProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [formData, setFormData] = useState<Partial<SafetyIncidentItem>>({
    id: "",
    date: new Date().toISOString().split("T")[0],
    type: "Near Miss",
    severity: "Low",
    location: "",
    description: "",
    action: "",
    rootCause: "",
    reportedBy: "",
    status: "Open",
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        id: `INC-${Math.floor(100 + Math.random() * 900)}`,
        date: new Date().toISOString().split("T")[0],
        type: "Near Miss",
        severity: "Low",
        location: "",
        description: "",
        action: "",
        rootCause: "",
        reportedBy: "",
        status: "Open",
      });
    }
    setError(null);
  }, [initialData, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/hseq/SafetyIncidentModal.tsx");
    e.preventDefault();
    if (!formData.id?.trim()) {
      setError("Incident Reference is required.");
      return;
    }
    if (!formData.description?.trim()) {
      setError("Incident Summary / Description is required.");
      return;
    }
    if (!formData.location?.trim()) {
      setError("Location / Workface is required.");
      return;
    }
    if (!formData.action?.trim()) {
      setError("Preventative / Corrective Action is required.");
      return;
    }

    onSave({
      id: formData.id.trim(),
      date: formData.date || new Date().toISOString().split("T")[0],
      type: formData.type || "Near Miss",
      severity: formData.severity || "Low",
      location: formData.location.trim(),
      description: formData.description.trim(),
      action: formData.action.trim(),
      rootCause: formData.rootCause?.trim() || "",
      reportedBy: formData.reportedBy?.trim() || "HSE Site Officer",
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
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isView ? "Safety Incident / Near Miss Details" : isEdit ? "Edit Safety Incident Record" : "Report Incident / Proactive Near Miss"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isView ? "Incident investigation and corrective actions" : "Record site safety event, root cause, and preventative action taken"}
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
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reference</span>
                <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formData.id}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Classification</span>
                <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">{formData.type}</div>
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
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Incident Summary</span>
              <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{formData.description}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Location / Workface</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.location || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date & Reported By</span>
                <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                  {formData.date} · {formData.reportedBy || "HSE Team"}
                </div>
              </div>
            </div>

            {formData.rootCause && (
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">Root Cause</span>
                <div className="text-xs text-amber-900 dark:text-amber-200 mt-1 leading-relaxed">{formData.rootCause}</div>
              </div>
            )}

            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Preventative Action Taken</span>
              <div className="text-xs text-emerald-900 dark:text-emerald-200 font-medium mt-1 leading-relaxed">{formData.action}</div>
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
                  Edit Incident
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
                  Incident Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INC-2026-001"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Classification
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Near Miss">Near Miss (Proactive)</option>
                  <option value="First Aid Case (FAC)">First Aid Case (FAC)</option>
                  <option value="Medical Treatment Case (MTC)">Medical Treatment Case (MTC)</option>
                  <option value="Lost Time Injury (LTI)">Lost Time Injury (LTI)</option>
                  <option value="Property Damage">Property / Plant Damage</option>
                  <option value="Environmental Spill">Environmental Spill</option>
                  <option value="Dangerous Occurrence">Dangerous Occurrence</option>
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
                  <option value="Under Investigation">Under Investigation</option>
                  <option value="Action Implemented">Action Implemented</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Incident Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Location / Workface *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Km 12+400 Earthworks Cut Face"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Incident Summary / Description *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Detailed description of what occurred, equipment involved, and immediate conditions..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reported By
                </label>
                <input
                  type="text"
                  placeholder="e.g. Site Safety Representative"
                  value={formData.reportedBy}
                  onChange={(e) => setFormData({ ...formData, reportedBy: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Severity Level
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Low">Low (No harm / Near miss)</option>
                  <option value="Medium">Medium (First aid / Minor damage)</option>
                  <option value="High">High (Medical treatment / Lost work)</option>
                  <option value="Critical">Critical (Severe / Statutory reportable)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Root Cause Findings
              </label>
              <textarea
                rows={2}
                placeholder="Root causes identified (human factors, equipment guarding, environmental factors)..."
                value={formData.rootCause}
                onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Preventative & Corrective Action Taken *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Immediate corrections and preventative controls implemented to eliminate hazard..."
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
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
                {isEdit ? "Save Changes" : "Save Incident Record"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
