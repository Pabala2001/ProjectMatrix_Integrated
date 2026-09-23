import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, ShieldCheck, Save, Edit } from "lucide-react";
import { PermitToWorkItem } from "../../types/hseq";

interface PermitToWorkModalProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData?: PermitToWorkItem | null;
  onSave: (item: PermitToWorkItem) => void;
  onClose: () => void;
  onSwitchToEdit?: () => void;
}

export default function PermitToWorkModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onClose,
  onSwitchToEdit,
}: PermitToWorkModalProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [formData, setFormData] = useState<Partial<PermitToWorkItem>>({
    id: "",
    type: "Hot Work & Flame Cutting",
    location: "",
    issuedTo: "",
    validFrom: new Date().toISOString().split("T")[0],
    validTo: new Date().toISOString().split("T")[0],
    pic: "",
    precautions: "",
    status: "Active / Authorized",
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        id: `PTW-${Math.floor(100 + Math.random() * 900)}`,
        type: "Hot Work & Flame Cutting",
        location: "",
        issuedTo: "",
        validFrom: new Date().toISOString().split("T")[0],
        validTo: new Date().toISOString().split("T")[0],
        pic: "",
        precautions: "",
        status: "Active / Authorized",
      });
    }
    setError(null);
  }, [initialData, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/hseq/PermitToWorkModal.tsx");
    e.preventDefault();
    if (!formData.id?.trim()) {
      setError("Permit Reference is required.");
      return;
    }
    if (!formData.location?.trim()) {
      setError("Authorized Location is required.");
      return;
    }
    if (!formData.issuedTo?.trim()) {
      setError("Assigned Crew / Subcontractor is required.");
      return;
    }
    if (!formData.pic?.trim()) {
      setError("Person In Charge (PIC) is required.");
      return;
    }

    onSave({
      id: formData.id.trim(),
      type: formData.type || "Hot Work & Flame Cutting",
      location: formData.location.trim(),
      issuedTo: formData.issuedTo.trim(),
      validFrom: formData.validFrom || new Date().toISOString().split("T")[0],
      validTo: formData.validTo || new Date().toISOString().split("T")[0],
      pic: formData.pic.trim(),
      precautions: formData.precautions?.trim() || "",
      status: formData.status || "Active / Authorized",
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
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isView ? "Permit to Work (PTW) Details" : isEdit ? "Edit Permit to Work" : "Issue High-Risk Permit to Work"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isView ? "Authorized high risk work clearances and safety controls" : "Authorize hot works, confined spaces, heavy lifts, or high voltage isolations"}
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
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Permit Number</span>
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
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">High Risk Activity / Type</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formData.type}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Authorized Location</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.location || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Crew / Subcontractor</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.issuedTo || "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Validity Period</span>
                <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                  {formData.validFrom} to {formData.validTo}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Person In Charge (PIC)</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.pic || "-"}</div>
              </div>
            </div>

            {formData.precautions && (
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">Safety Precautions & Isolation Checks</span>
                <div className="text-xs text-amber-900 dark:text-amber-200 mt-1 leading-relaxed">{formData.precautions}</div>
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
                  Edit Permit
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
                  Permit Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PTW-HW-044"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Permit Classification
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Hot Work & Flame Cutting">Hot Work & Flame Cutting</option>
                  <option value="Confined Space Entry">Confined Space Entry</option>
                  <option value="Deep Trenching / Excavation (>1.5m)">Deep Trenching / Excavation (&gt;1.5m)</option>
                  <option value="Heavy Tandem Crane Lifting">Heavy Tandem Crane Lifting</option>
                  <option value="High Voltage Electrical Isolation">High Voltage Electrical Isolation</option>
                  <option value="Night Shift Operations">Night Shift Operations</option>
                  <option value="Demolition & Structural Works">Demolition & Structural Works</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Authorization Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Active / Authorized">Active / Authorized</option>
                  <option value="Pending Clearance">Pending Clearance</option>
                  <option value="Expired">Expired</option>
                  <option value="Closed Out">Closed Out</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Authorized Work Location *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Km 14 Bridge Deck - Under-deck Chamber"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Crew / Subcontractor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Specialist Welding & Rigging"
                  value={formData.issuedTo}
                  onChange={(e) => setFormData({ ...formData, issuedTo: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valid From
                </label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valid To
                </label>
                <input
                  type="date"
                  value={formData.validTo}
                  onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Person In Charge (PIC) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Certified Appointed PIC"
                  value={formData.pic}
                  onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Safety Controls & Isolations
              </label>
              <textarea
                rows={3}
                placeholder="Continuous multi-gas atmospheric testing, dedicated fire watcher with 9kg DCP extinguisher, lockout-tagout verified..."
                value={formData.precautions}
                onChange={(e) => setFormData({ ...formData, precautions: e.target.value })}
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
                {isEdit ? "Save Changes" : "Issue Permit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
