import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Edit,
  Trash2,
  AlertTriangle,
  Check,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  Save,
  Tag
} from "lucide-react";
import { UnifiedRecord } from "./RecordDetailsDrawer";

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: UnifiedRecord | null;
  onSave: (updatedRecord: UnifiedRecord) => void;
}

export function EditRecordModal({
  isOpen,
  onClose,
  record,
  onSave
}: EditRecordModalProps) {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (record) {
      setFormData({ ...record.data });
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const getRecordTitle = () => {
    switch (record.type) {
      case "RFI":
        return { ref: record.data.rfiNumber || "RFI", title: record.data.title, typeName: "Technical Query / RFI" };
      case "SUBMITTAL":
        return { ref: record.data.submittalNumber || "SUB", title: record.data.title, typeName: "Technical Submittal" };
      case "ASSUMPTION":
        return { ref: record.data.assumptionCode || record.data.assumptionNumber || "ASSUMP", title: record.data.title, typeName: "Design Assumption" };
      case "DEVIATION":
        return { ref: record.data.deviationNumber || "DEV", title: record.data.title, typeName: "Engineering Deviation" };
      case "REVIEW":
        return { ref: record.data.packageNumber || "DR", title: record.data.title, typeName: "Design Review Package" };
      case "CHANGE":
        return { ref: record.data.changeNumber || "DCN", title: record.data.title, typeName: "Design Change Notice" };
      case "SETTING_OUT":
        return { ref: record.data.recordNumber || record.data.referenceNumber || "SO", title: record.data.elementName, typeName: "Setting Out Record" };
      case "CONTROL_POINT":
        return { ref: record.data.pointId || "CP", title: record.data.description, typeName: "Survey Control Point" };
      default:
        return { ref: "REC", title: record.data.title || "Record", typeName: "Engineering Record" };
    }
  };

  const { ref, title, typeName } = getRecordTitle();

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/engineering/EngineeringActionModals.tsx");
    e.preventDefault();
    const updatedRecord: UnifiedRecord = {
      type: record.type as any,
      data: {
        ...record.data,
        ...formData
      }
    };
    onSave(updatedRecord);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="px-5 py-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Edit className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {ref}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {typeName}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white truncate max-w-md">
                  Edit {title}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Title / Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {record.type === "SETTING_OUT" ? "Element Name" : "Title / Subject"}
              </label>
              <input
                type="text"
                value={record.type === "SETTING_OUT" ? (formData.elementName || "") : (formData.title || "")}
                onChange={(e) =>
                  handleChange(record.type === "SETTING_OUT" ? "elementName" : "title", e.target.value)
                }
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Discipline */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Discipline
                </label>
                <input
                  type="text"
                  value={formData.disciplineLabel || formData.discipline || ""}
                  onChange={(e) => handleChange("discipline", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || ""}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Open">Open</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Awaiting Consultant">Awaiting Consultant</option>
                  <option value="Responded">Responded</option>
                  <option value="Approved">Approved</option>
                  <option value="Approved as Noted">Approved as Noted</option>
                  <option value="Revise & Resubmit">Revise & Resubmit</option>
                  <option value="Verified">Verified</option>
                  <option value="Within Tolerance">Within Tolerance</option>
                  <option value="Closed">Closed</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              {/* Priority / Criticality if applicable */}
              {(formData.priority || formData.criticality) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority / Criticality
                  </label>
                  <select
                    value={formData.priority || formData.criticality || "Normal"}
                    onChange={(e) => {
                      if (formData.priority !== undefined) handleChange("priority", e.target.value);
                      if (formData.criticality !== undefined) handleChange("criticality", e.target.value);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                  </select>
                </div>
              )}

              {/* Target / Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target / Due Date
                </label>
                <input
                  type="text"
                  value={
                    formData.responseDueDate ||
                    formData.targetApprovalDate ||
                    formData.targetValidationDate ||
                    formData.date ||
                    formData.targetDate ||
                    ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (formData.responseDueDate !== undefined) handleChange("responseDueDate", val);
                    else if (formData.targetApprovalDate !== undefined) handleChange("targetApprovalDate", val);
                    else if (formData.targetValidationDate !== undefined) handleChange("targetValidationDate", val);
                    else handleChange("date", val);
                  }}
                  placeholder="e.g. 28 Aug 2026"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Drawing Reference */}
              {formData.drawingRef !== undefined && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Drawing Reference
                  </label>
                  <input
                    type="text"
                    value={formData.drawingRef || ""}
                    onChange={(e) => handleChange("drawingRef", e.target.value)}
                    placeholder="e.g. STR-042 Rev C"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Responsible / Raised By */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Responsible / Raised By
                </label>
                <input
                  type="text"
                  value={
                    formData.raisedBy ||
                    formData.actionOwner ||
                    formData.proposedBy ||
                    formData.leadReviewer ||
                    formData.surveyor ||
                    ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (formData.raisedBy !== undefined) handleChange("raisedBy", val);
                    else if (formData.actionOwner !== undefined) handleChange("actionOwner", val);
                    else if (formData.proposedBy !== undefined) handleChange("proposedBy", val);
                    else if (formData.leadReviewer !== undefined) handleChange("leadReviewer", val);
                    else handleChange("surveyor", val);
                  }}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Type-Specific Content: Question / Statement / Description */}
            {formData.questionText !== undefined && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Query / Question Details
                </label>
                <textarea
                  rows={3}
                  value={formData.questionText || ""}
                  onChange={(e) => handleChange("questionText", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {formData.proposedSolution !== undefined && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Proposed Contractor Solution
                </label>
                <textarea
                  rows={2}
                  value={formData.proposedSolution || ""}
                  onChange={(e) => handleChange("proposedSolution", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {formData.designBasis !== undefined && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Design Basis & Assumptions
                </label>
                <textarea
                  rows={3}
                  value={formData.designBasis || formData.statement || ""}
                  onChange={(e) => handleChange("designBasis", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {formData.reason !== undefined && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Change Reason / Scope Impact
                </label>
                <textarea
                  rows={3}
                  value={formData.reason || ""}
                  onChange={(e) => handleChange("reason", e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: UnifiedRecord | null;
  onConfirm: (record: UnifiedRecord) => void;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  record,
  onConfirm
}: DeleteConfirmModalProps) {
  if (!isOpen || !record) return null;

  const getRefAndTitle = () => {
    switch (record.type) {
      case "RFI":
        return { ref: record.data.rfiNumber || "RFI", title: record.data.title, typeName: "Technical Query / RFI" };
      case "SUBMITTAL":
        return { ref: record.data.submittalNumber || "SUB", title: record.data.title, typeName: "Technical Submittal" };
      case "ASSUMPTION":
        return { ref: record.data.assumptionCode || record.data.assumptionNumber || "ASSUMP", title: record.data.title, typeName: "Design Assumption" };
      case "DEVIATION":
        return { ref: record.data.deviationNumber || "DEV", title: record.data.title, typeName: "Engineering Deviation" };
      case "REVIEW":
        return { ref: record.data.packageNumber || "DR", title: record.data.title, typeName: "Design Review" };
      case "CHANGE":
        return { ref: record.data.changeNumber || "DCN", title: record.data.title, typeName: "Design Change Notice" };
      case "SETTING_OUT":
        return { ref: record.data.recordNumber || record.data.referenceNumber || "SO", title: record.data.elementName, typeName: "Setting Out Record" };
      case "CONTROL_POINT":
        return { ref: record.data.pointId || "CP", title: record.data.description, typeName: "Survey Point" };
      default:
        return { ref: "REC", title: record.data.title || "Record", typeName: "Record" };
    }
  };

  const { ref, title, typeName } = getRefAndTitle();

  const handleConfirm = () => {
    onConfirm(record);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 overflow-hidden"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete {typeName}?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900 dark:text-white">{ref}</strong> &ndash; &ldquo;{title}&rdquo;?
              </p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium pt-1">
                This action will remove the record from all registers and project logs.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Record</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/**
 * Reusable Row Action Button Group for Engineering Tables:
 * Provides Edit, View, and Delete buttons
 */
interface EngineeringRowActionsProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}

export function EngineeringRowActions({
  onView,
  onEdit,
  onDelete,
  compact = false
}: EngineeringRowActionsProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      {/* View Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onView();
        }}
        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 font-semibold text-[11px] flex items-center gap-1 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
        title="View Record Details"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        <span>View</span>
      </button>

      {/* Edit Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-amber-950/60 text-slate-700 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-400 font-semibold text-[11px] flex items-center gap-1 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
        title="Edit Record"
      >
        <Edit className="w-3 h-3 text-amber-500" />
        <span>Edit</span>
      </button>

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 font-semibold text-[11px] flex items-center gap-1 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
        title="Delete Record"
      >
        <Trash2 className="w-3 h-3 text-rose-500" />
        <span>Delete</span>
      </button>
    </div>
  );
}
