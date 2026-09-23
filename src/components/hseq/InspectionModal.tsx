import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, ClipboardCheck, Plus, Trash2, Save, Edit, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { QualityControlRecord, FormStatus } from "../../types/qualityControl";

interface InspectionModalProps {
  isOpen: boolean;
  mode: "create" | "edit" | "view";
  initialData?: QualityControlRecord | null;
  projectId: string;
  companyId: string;
  projectName?: string;
  onSave: (record: QualityControlRecord) => Promise<void> | void;
  onClose: () => void;
  onSwitchToEdit?: () => void;
}

interface ChecklistRow {
  id: string;
  item: string;
  acceptable: "Yes" | "No" | "N/A" | "";
  specified?: string;
  actual?: string;
  comments?: string;
}

const DEFAULT_CATEGORIES = [
  "Structural Concrete",
  "Earthworks & Compaction",
  "Structural Steelwork",
  "Roadworks & Paving",
  "Drainage & Pipelines",
  "MEP & Building Services",
  "Safety & Access Scaffolding",
  "General Civil & Architectural",
];

const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  "Structural Concrete": [
    "Formwork alignment, plumb, dimensions, and oiling verified",
    "Reinforcing steel bar size, spacing, lap lengths, and cover blocks verified",
    "Embedded items, cast-in bolts, conduits, and waterstops securely installed",
    "Cleanliness of pour area (free of debris, water, sawdust, and loose rust)",
    "Concrete mix design, slump test, and temperature verified before discharge",
    "Adequate vibrators and standby compaction equipment on site",
  ],
  "Earthworks & Compaction": [
    "Subgrade preparation and clearing of uncompacted material verified",
    "Layer thickness within maximum specified limit (e.g. 150-200mm loose)",
    "Optimum moisture content (OMC) verified prior to compaction rolling",
    "Nuclear gauge density testing executed and results meet spec (≥93% / ≥98% Mod AASHTO)",
    "Finished levels, crossfalls, and surface drainage grades checked against drawings",
  ],
  "Structural Steelwork": [
    "Plumb and alignment of columns and rafters checked with theodolite",
    "Bolt grade, size, washer placement, and torque values verified",
    "Welding visual inspection, fillet throat thickness, and NDT clearances",
    "Surface treatment, zinc primer touch-up, and fireproofing thickness",
  ],
  "Drainage & Pipelines": [
    "Trench bed width, bedding material type, and grading verified",
    "Pipe line, level, joint alignment, and gasket placement checked",
    "Hydrostatic / pneumatic pressure test or water tightness test passed",
    "Backfilling in layers with specified granular material around pipe haunches",
  ],
  "Safety & Access Scaffolding": [
    "Base plates, sole boards, and foundation ground stability verified",
    "Standards plumb, ledgers level, and bracing installed according to SANS/OSHA",
    "Full board decking with no gaps, toe boards, and double guardrails installed",
    "Safe ladder access or staircase secured and scaffold tag (Green/Red) displayed",
  ],
  "General Civil & Architectural": [
    "Setting out coordinates and bench mark datum levels verified",
    "Materials on site inspected against approved submittal and spec",
    "Workmanship conforms to relevant project technical specifications",
    "Surrounding area made safe and environmental controls maintained",
  ],
};

export default function InspectionModal({
  isOpen,
  mode,
  initialData,
  projectId,
  companyId,
  projectName = "",
  onSave,
  onClose,
  onSwitchToEdit,
}: InspectionModalProps) {
  const isView = mode === "view";
  const isEdit = mode === "edit";

  const [formId, setFormId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [category, setCategory] = useState("Structural Concrete");
  const [contractNumber, setContractNumber] = useState("");
  const [contractor, setContractor] = useState("");
  const [location, setLocation] = useState("");
  const [itemElement, setItemElement] = useState("");
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split("T")[0]);
  const [inspectorName, setInspectorName] = useState("");
  const [residentEngineer, setResidentEngineer] = useState("");
  const [status, setStatus] = useState<FormStatus>("Draft");
  const [remarks, setRemarks] = useState("");
  const [checklistRows, setChecklistRows] = useState<ChecklistRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormId(initialData.id || `INSP-${Math.floor(1000 + Math.random() * 9000)}`);
      setFormTitle(initialData.formTitle || "");
      setCategory(initialData.category || "Structural Concrete");
      setContractNumber(initialData.contractNumber || "");
      setContractor(initialData.contractor || "");
      setLocation(initialData.location || "");
      setItemElement(initialData.item || "");
      setInspectionDate(initialData.signoffDate || (initialData.fields?.inspectionDate as string) || new Date().toISOString().split("T")[0]);
      setInspectorName(initialData.inspectorSignatureName || (initialData.fields?.inspector as string) || "");
      setResidentEngineer(initialData.residentEngineerSignatureName || (initialData.fields?.residentEngineer as string) || "");
      setStatus(initialData.status || "Draft");
      setRemarks((initialData.fields?.remarks as string) || "");
      setChecklistRows(
        initialData.checklistRows && initialData.checklistRows.length > 0
          ? initialData.checklistRows
          : (DEFAULT_CHECKLISTS[initialData.category || "Structural Concrete"] || DEFAULT_CHECKLISTS["General Civil & Architectural"]).map((text, idx) => ({
              id: `chk-${idx + 1}`,
              item: text,
              acceptable: "Yes",
              comments: "",
            }))
      );
    } else {
      const generatedId = `INSP-${Math.floor(1000 + Math.random() * 9000)}`;
      setFormId(generatedId);
      setFormTitle("");
      setCategory("Structural Concrete");
      setContractNumber("");
      setContractor("");
      setLocation("");
      setItemElement("");
      setInspectionDate(new Date().toISOString().split("T")[0]);
      setInspectorName("");
      setResidentEngineer("");
      setStatus("Completed");
      setRemarks("");
      
      const defaultItems = DEFAULT_CHECKLISTS["Structural Concrete"].map((text, idx) => ({
        id: `chk-${idx + 1}`,
        item: text,
        acceptable: "Yes" as const,
        comments: "",
      }));
      setChecklistRows(defaultItems);
    }
    setError(null);
  }, [initialData, isOpen, mode]);

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    if (!initialData && DEFAULT_CHECKLISTS[newCategory]) {
      const newItems = DEFAULT_CHECKLISTS[newCategory].map((text, idx) => ({
        id: `chk-${idx + 1}`,
        item: text,
        acceptable: "Yes" as const,
        comments: "",
      }));
      setChecklistRows(newItems);
    }
  };

  const handleChecklistAcceptable = (index: number, val: "Yes" | "No" | "N/A") => {
    setChecklistRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], acceptable: val };
      return next;
    });
  };

  const handleChecklistComments = (index: number, val: string) => {
    setChecklistRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], comments: val };
      return next;
    });
  };

  const handleAddChecklistItem = () => {
    assertOperationalAction("create", "components/hseq/InspectionModal.tsx");
    setChecklistRows((prev) => [
      ...prev,
      {
        id: `chk-${Date.now()}`,
        item: "",
        acceptable: "Yes",
        comments: "",
      },
    ]);
  };

  const handleRemoveChecklistItem = (index: number) => {
    assertOperationalAction("delete", "components/hseq/InspectionModal.tsx");
    setChecklistRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemTextChange = (index: number, text: string) => {
    setChecklistRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], item: text };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/hseq/InspectionModal.tsx");
    e.preventDefault();
    if (!formId.trim()) {
      setError("Inspection Reference is required.");
      return;
    }
    if (!formTitle.trim()) {
      setError("Inspection Title / Scope is required.");
      return;
    }
    if (!location.trim()) {
      setError("Inspection Location / Chainage is required.");
      return;
    }
    if (!inspectorName.trim()) {
      setError("Lead Inspector / QC Engineer Name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const recordToSave: QualityControlRecord = {
        id: formId.trim(),
        templateId: `custom-insp-${category.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        formTitle: formTitle.trim(),
        category,
        formReference: formId.trim(),
        revision: "Rev 0",
        revisionDate: inspectionDate,
        projectName: projectName || "Project",
        contractNumber: contractNumber.trim() || undefined,
        contractor: contractor.trim() || undefined,
        location: location.trim(),
        item: itemElement.trim() || undefined,
        inspectorSignatureName: inspectorName.trim(),
        residentEngineerSignatureName: residentEngineer.trim() || undefined,
        signoffDate: inspectionDate,
        status,
        fields: {
          inspectionDate,
          inspector: inspectorName.trim(),
          residentEngineer: residentEngineer.trim(),
          remarks: remarks.trim(),
          category,
          location: location.trim(),
          contractor: contractor.trim(),
        },
        checklistRows,
        projectId,
        project_id: projectId,
        companyId,
        company_id: companyId,
        createdAt: initialData?.createdAt || now,
        updatedAt: now,
      };

      await onSave(recordToSave);
      onClose();
    } catch (err: any) {
      console.error("Error saving inspection record:", err);
      setError("Failed to save inspection: " + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        className="bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isView ? "Quality Inspection Record Details" : isEdit ? "Edit Quality Inspection Record" : "Log / Create Quality & Safety Inspection"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isView 
                  ? "View hold point verification, checklist compliance, and inspector sign-off" 
                  : "Input verified elements, checklist criteria, and sign-offs for this project"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode */}
        {isView ? (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Header badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Inspection Ref</span>
                <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">{formId}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Discipline / Category</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{category}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</span>
                <div className="mt-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    status === "Approved"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : status === "Completed"
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : status === "Rejected"
                      ? "bg-rose-50 text-rose-800 border border-rose-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}>
                    {status}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Inspection Title / Scope</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formTitle}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Location / Chainage</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{location || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contractor / Subcontractor</span>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{contractor || "-"}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Inspection Date</span>
                <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">{inspectionDate}</div>
              </div>
            </div>

            {/* Checklist items in view mode */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-amber-500" />
                Verified Checklist Items ({checklistRows.length})
              </span>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Verification Criteria</th>
                      <th className="p-2.5 w-24 text-center">Result</th>
                      <th className="p-2.5">Remarks / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {checklistRows.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                        <td className="p-2.5 text-slate-800 dark:text-slate-200 font-medium">{row.item}</td>
                        <td className="p-2.5 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            row.acceptable === "Yes"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : row.acceptable === "No"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {row.acceptable || "N/A"}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.comments || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remarks */}
            {remarks && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Inspector's Remarks & Notes</span>
                <div className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{remarks}</div>
              </div>
            )}

            {/* Footer Buttons */}
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
                  Edit Inspection
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Create / Edit Form Mode */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Primary identification row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Inspection Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INSP-2026-001"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Discipline / Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Inspection Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FormStatus)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="Completed">Completed (Passed)</option>
                  <option value="Approved">Approved / Cleared</option>
                  <option value="Draft">Draft (In Progress)</option>
                  <option value="Rejected">Rejected / Remedial Needed</option>
                </select>
              </div>
            </div>

            {/* Inspection Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Inspection Title / Scope *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Reinforced Concrete Foundation Pre-Pour Inspection"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            {/* Location, Contractor, and Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Location / Chainage *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pier 4 Footing (Chainage 12+450)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contractor / Subcontractor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Main Civils Contractor Ltd"
                  value={contractor}
                  onChange={(e) => setContractor(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Inspection Date
                </label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Sign-Off Personnel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Inspector / QC Engineer *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S. Mokoena (QC Inspector)"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Resident Engineer / Consultant
                </label>
                <input
                  type="text"
                  placeholder="e.g. J. Pretorius (Pr. Eng)"
                  value={residentEngineer}
                  onChange={(e) => setResidentEngineer(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Interactive Checklist Section */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-amber-500" />
                  Verification Criteria Checklist ({checklistRows.length} items)
                </label>
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Custom Item
                </button>
              </div>

              <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30">
                {checklistRows.map((row, index) => (
                  <div key={row.id || index} className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-slate-400 mt-1 shrink-0">#{index + 1}</span>
                      <input
                        type="text"
                        required
                        placeholder="Description of item / verification parameter..."
                        value={row.item}
                        onChange={(e) => handleItemTextChange(index, e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      
                      {/* Pass / Fail / NA Radio buttons */}
                      <div className="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                        {(["Yes", "No", "N/A"] as const).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleChecklistAcceptable(index, val)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                              row.acceptable === val
                                ? val === "Yes"
                                  ? "bg-emerald-600 text-white shadow-2xs"
                                  : val === "No"
                                  ? "bg-rose-600 text-white shadow-2xs"
                                  : "bg-slate-600 text-white shadow-2xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            }`}
                          >
                            {val === "Yes" ? "Pass (Yes)" : val === "No" ? "Fail (No)" : "N/A"}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(index)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete check item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Optional notes / measurements / spec observations..."
                      value={row.comments || ""}
                      onChange={(e) => handleChecklistComments(index, e.target.value)}
                      className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* General Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Inspector's Remarks & Hold-Point Clearance Summary
              </label>
              <textarea
                rows={2}
                placeholder="Summary observations, hold-point approvals, or notes on remedial action requirements..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Submit / Cancel Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Save Inspection Record"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
