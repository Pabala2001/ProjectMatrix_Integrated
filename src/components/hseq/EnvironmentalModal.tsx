import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, Trees, Save, Edit } from "lucide-react";
import { EnvironmentalItem } from "../../types/hseq";

interface EnvironmentalModalProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData?: EnvironmentalItem | null;
  onSave: (item: EnvironmentalItem) => void;
  onClose: () => void;
  onSwitchToEdit?: () => void;
}

export default function EnvironmentalModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onClose,
  onSwitchToEdit,
}: EnvironmentalModalProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [formData, setFormData] = useState<Partial<EnvironmentalItem>>({
    id: "",
    parameter: "Dust & PM10 Particulates",
    location: "",
    reading: "",
    frequency: "Daily Continuous / Water Bowsers",
    lastChecked: new Date().toISOString().split("T")[0],
    inspector: "",
    compliance: "Compliant",
    notes: "",
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        id: `ENV-${Math.floor(100 + Math.random() * 900)}`,
        parameter: "Dust & PM10 Particulates",
        location: "",
        reading: "< 600 mg/m²/day (Within limits)",
        frequency: "Continuous / Daily Bowsers",
        lastChecked: new Date().toISOString().split("T")[0],
        inspector: "Environmental Control Officer (ECO)",
        compliance: "Compliant",
        notes: "",
      });
    }
    setError(null);
  }, [initialData, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/hseq/EnvironmentalModal.tsx");
    e.preventDefault();
    if (!formData.id?.trim()) {
      setError("Monitoring Reference is required.");
      return;
    }
    if (!formData.parameter?.trim()) {
      setError("Environmental Parameter is required.");
      return;
    }
    if (!formData.location?.trim()) {
      setError("Monitoring Location / Workface is required.");
      return;
    }
    if (!formData.reading?.trim()) {
      setError("Measured Reading is required.");
      return;
    }

    onSave({
      id: formData.id.trim(),
      parameter: formData.parameter.trim(),
      location: formData.location.trim(),
      reading: formData.reading.trim(),
      frequency: formData.frequency?.trim() || "Daily",
      lastChecked: formData.lastChecked || new Date().toISOString().split("T")[0],
      inspector: formData.inspector?.trim() || "ECO Officer",
      compliance: formData.compliance || "Compliant",
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
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Trees className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isView ? "Environmental Monitoring Record" : isEdit ? "Edit Environmental Record" : "Log Environmental Monitoring"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isView ? "Review environmental compliance and mitigation logs" : "Log dust suppression, water quality, noise levels, waste management, or hydrocarbon bunding"}
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
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Compliance</span>
                <div className="mt-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                    formData.compliance === "Compliant"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}>
                    {formData.compliance}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Verified Date</span>
                <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">{formData.lastChecked}</div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monitored Parameter</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formData.parameter}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Monitoring Location</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.location || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Inspector / ECO</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.inspector || "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Measured Reading / Limit</span>
                <div className="text-sm font-mono font-bold text-emerald-800 dark:text-emerald-300 mt-1">{formData.reading}</div>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mitigation Frequency / Protocol</span>
                <div className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">{formData.frequency}</div>
              </div>
            </div>

            {formData.notes && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Field Observations & Corrective Actions</span>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{formData.notes}</div>
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
                  Edit Record
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
                  Monitoring Ref *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ENV-MON-001"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Parameter
                </label>
                <select
                  value={formData.parameter}
                  onChange={(e) => setFormData({ ...formData, parameter: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Dust & PM10 Particulates">Dust & PM10 Particulates</option>
                  <option value="Noise & Vibration Monitoring">Noise & Vibration Monitoring</option>
                  <option value="Stormwater Turbidity & Silt Traps">Stormwater Turbidity & Silt Traps</option>
                  <option value="Hydrocarbon Bunding & Drip Trays">Hydrocarbon Bunding & Drip Trays</option>
                  <option value="Hazardous Waste & Disposal Safe Disposal">Hazardous Waste Safe Disposal</option>
                  <option value="Alien Vegetation Clearing & Flora Protection">Alien Vegetation Clearing</option>
                  <option value="Topsoil Stripping & Stockpiling">Topsoil Stockpile Protection</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Compliance Status
                </label>
                <select
                  value={formData.compliance}
                  onChange={(e) => setFormData({ ...formData, compliance: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Compliant">Compliant</option>
                  <option value="Action Required">Action Required</option>
                  <option value="Non-Compliant">Non-Compliant</option>
                  <option value="Observation">Observation</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Workface / Sampling Location *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Haul Road 3 & Batch Plant Boundary"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Measured Reading vs Target Limit *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. < 600 mg/m²/day (Compliant with SANS 1929)"
                  value={formData.reading}
                  onChange={(e) => setFormData({ ...formData, reading: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mitigation Frequency
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily / 2x Bowsers"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Last Checked Date
                </label>
                <input
                  type="date"
                  value={formData.lastChecked}
                  onChange={(e) => setFormData({ ...formData, lastChecked: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Environmental Inspector / ECO
                </label>
                <input
                  type="text"
                  placeholder="e.g. Environmental Officer"
                  value={formData.inspector}
                  onChange={(e) => setFormData({ ...formData, inspector: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Field Observations & Corrective Actions
              </label>
              <textarea
                rows={3}
                placeholder="Specific mitigating measures undertaken, water spray logs, bund maintenance notes..."
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
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {isEdit ? "Save Changes" : "Log Monitoring Record"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
