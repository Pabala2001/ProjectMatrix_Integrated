import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, FileSpreadsheet, Save, Edit } from "lucide-react";
import { TestResultItem } from "../../types/hseq";

interface TestResultModalProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData?: TestResultItem | null;
  onSave: (item: TestResultItem) => void;
  onClose: () => void;
  onSwitchToEdit?: () => void;
}

export default function TestResultModal({
  isOpen,
  mode,
  initialData,
  onSave,
  onClose,
  onSwitchToEdit,
}: TestResultModalProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [formData, setFormData] = useState<Partial<TestResultItem>>({
    id: "",
    testType: "Concrete Cube Crushing (28d)",
    sampleRef: "",
    requiredSpec: "",
    achievedResult: "",
    lab: "",
    testDate: new Date().toISOString().split("T")[0],
    tester: "",
    resultStatus: "Compliant",
    remarks: "",
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      setFormData({
        id: `LAB-${Math.floor(1000 + Math.random() * 9000)}`,
        testType: "Concrete Cube Crushing (28d)",
        sampleRef: "",
        requiredSpec: "≥ 40.0 MPa @ 28 Days",
        achievedResult: "",
        lab: "SANAS Accredited Materials Lab",
        testDate: new Date().toISOString().split("T")[0],
        tester: "",
        resultStatus: "Compliant",
        remarks: "",
      });
    }
    setError(null);
  }, [initialData, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/hseq/TestResultModal.tsx");
    e.preventDefault();
    if (!formData.id?.trim()) {
      setError("Test Certificate Reference is required.");
      return;
    }
    if (!formData.testType?.trim()) {
      setError("Test Description is required.");
      return;
    }
    if (!formData.sampleRef?.trim()) {
      setError("Sampled Element / Location is required.");
      return;
    }
    if (!formData.requiredSpec?.trim()) {
      setError("Required Specification is required.");
      return;
    }
    if (!formData.achievedResult?.trim()) {
      setError("Achieved Result is required.");
      return;
    }

    onSave({
      id: formData.id.trim(),
      testType: formData.testType.trim(),
      sampleRef: formData.sampleRef.trim(),
      requiredSpec: formData.requiredSpec.trim(),
      achievedResult: formData.achievedResult.trim(),
      lab: formData.lab?.trim() || "Approved Commercial Testing Laboratory",
      testDate: formData.testDate || new Date().toISOString().split("T")[0],
      tester: formData.tester?.trim() || "",
      resultStatus: formData.resultStatus || "Compliant",
      remarks: formData.remarks?.trim() || "",
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
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isView ? "Material Test Certificate Details" : isEdit ? "Edit Test Result" : "Log Material Test Result"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isView ? "Laboratory & field verification results" : "Record cube crushing, compaction, tensile or aggregate laboratory results"}
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
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Certificate Reference</span>
                <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formData.id}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Compliance Status</span>
                <div className="mt-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                    formData.resultStatus === "Compliant"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : formData.resultStatus === "Non-Compliant"
                      ? "bg-rose-50 text-rose-800 border border-rose-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}>
                    {formData.resultStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Test Description</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formData.testType}</div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sampled Element / Location</span>
              <div className="text-xs text-slate-800 dark:text-slate-200 font-semibold mt-1">{formData.sampleRef || "-"}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Required Specification</span>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1">{formData.requiredSpec || "-"}</div>
              </div>
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Achieved Result</span>
                <div className="text-sm font-mono font-bold text-emerald-600 mt-1">{formData.achievedResult || "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Testing Authority / Lab</span>
                <div className="text-xs text-slate-700 dark:text-slate-300 mt-1">{formData.lab || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Test Date</span>
                <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">{formData.testDate || "-"}</div>
              </div>
            </div>

            {formData.remarks && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Remarks / Notes</span>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{formData.remarks}</div>
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
                  Edit Result
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
                  Certificate Ref *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LAB-CONC-089"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Test Type
                </label>
                <select
                  value={formData.testType}
                  onChange={(e) => setFormData({ ...formData, testType: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Concrete Cube Crushing (28d)">Concrete Cube Crushing (28d)</option>
                  <option value="Concrete Cube Crushing (7d)">Concrete Cube Crushing (7d)</option>
                  <option value="Nuclear Density Compaction (98% Mod AASHTO)">Nuclear Density Compaction (98% Mod AASHTO)</option>
                  <option value="Nuclear Density Compaction (95% Mod AASHTO)">Nuclear Density Compaction (95% Mod AASHTO)</option>
                  <option value="Rebar Tensile & Yield Strength">Rebar Tensile & Yield Strength</option>
                  <option value="Aggregate Crushing Value (ACV)">Aggregate Crushing Value (ACV)</option>
                  <option value="Slump & Air Content Verification">Slump & Air Content Verification</option>
                  <option value="Asphalt Binder & Core Density">Asphalt Binder & Core Density</option>
                  <option value="CBR & Soil Classification">CBR & Soil Classification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Compliance Status
                </label>
                <select
                  value={formData.resultStatus}
                  onChange={(e) => setFormData({ ...formData, resultStatus: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Compliant">Compliant</option>
                  <option value="Non-Compliant">Non-Compliant</option>
                  <option value="Retest Required">Retest Required</option>
                  <option value="Pending Lab Analysis">Pending Lab Analysis</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sampled Element / Location / Chainage *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Pier 3 Deck Slab Pour #4 (Batch #0812)"
                value={formData.sampleRef}
                onChange={(e) => setFormData({ ...formData, sampleRef: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Required Specification *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ≥ 40.0 MPa @ 28 Days (SANS 5863)"
                  value={formData.requiredSpec}
                  onChange={(e) => setFormData({ ...formData, requiredSpec: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Achieved Result *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 44.8 MPa (Mean of 3 cubes)"
                  value={formData.achievedResult}
                  onChange={(e) => setFormData({ ...formData, achievedResult: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Testing Authority / Accredited Lab
                </label>
                <input
                  type="text"
                  placeholder="e.g. Geolab SANAS T0142"
                  value={formData.lab}
                  onChange={(e) => setFormData({ ...formData, lab: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Test Date
                </label>
                <input
                  type="date"
                  value={formData.testDate}
                  onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Remarks / Additional Lab Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional notes or deviations observed during laboratory testing..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {isEdit ? "Save Changes" : "Log Test Result"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
