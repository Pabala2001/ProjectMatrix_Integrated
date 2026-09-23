import React, { useState } from "react";
import {
  X,
  Edit2,
  Trash2,
  Paperclip,
  Calendar,
  Building2,
  Tag,
  DollarSign,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  FileCheck,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import {
  CommercialRecordType,
  CommercialSupportingDocument
} from "../../types/commercialWorkspace";

interface CommercialRecordDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordType: CommercialRecordType;
  record: any;
  currency?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onManageAttachments?: () => void;
  canEdit?: boolean;
}

export const CommercialRecordDetailModal: React.FC<CommercialRecordDetailModalProps> = ({
  isOpen,
  onClose,
  recordType,
  record,
  currency = "USD",
  onEdit,
  onDelete,
  onManageAttachments,
  canEdit = true
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<CommercialSupportingDocument | null>(null);

  if (!isOpen || !record) return null;

  const getDocIcon = (type: string, name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
    }
    if (type?.includes("Certificate") || type?.includes("Proof of Payment")) {
      return <FileCheck className="w-4 h-4 text-indigo-600" />;
    }
    return <FileText className="w-4 h-4 text-blue-600" />;
  };

  const getRecordTitle = () => {
    switch (recordType) {
      case "BUDGET":
        return `Budget Item: ${record.costCode || record.code || "-"}`;
      case "ACTUAL_COST":
        return `Cost: ${record.reference || record.id || "-"}`;
      case "COMMITMENT":
        return `Commitment: ${record.ref || record.poNumber || "-"}`;
      case "CLIENT_CERTIFICATE":
        return `Client Certificate: ${record.certificateNumber || record.ref || "-"}`;
      case "SUPPLIER_INVOICE":
        return `Supplier Invoice: ${record.invoiceNumber || record.ref || "-"}`;
      case "BANK_TRANSACTION":
        return `Bank Movement: ${record.reference || record.transactionRef || "-"}`;
      default:
        return "Commercial Record Details";
    }
  };

  const documents: CommercialSupportingDocument[] = record.documents || [];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900/60">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {getRecordTitle()}
                {record.status && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                    {record.status}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Commercial register entry details and supporting evidence
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[calc(85vh-130px)] overflow-y-auto">
          
          {/* Main Description */}
          {record.description && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Description / Scope
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {record.description}
              </p>
            </div>
          )}

          {/* Key Attributes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {record.date && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Date
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                  {record.date}
                </span>
              </div>
            )}

            {(record.supplier || record.counterparty || record.clientName || record.supplierName || record.payeeOrPayer) && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Counterparty / Vendor
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {record.supplier || record.counterparty || record.clientName || record.supplierName || record.payeeOrPayer || "-"}
                </span>
              </div>
            )}

            {(record.costCode || record.category) && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Cost Code / Trade
                </span>
                <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {record.costCode || record.category || "-"}
                </span>
              </div>
            )}

            {record.type && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Type
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {record.type}
                </span>
              </div>
            )}

            {record.quantity && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Quantity
                </span>
                <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {record.quantity} {record.unit || ""}
                </span>
              </div>
            )}

            {record.rate && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Rate
                </span>
                <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {currency} {typeof record.rate === "number" ? record.rate.toLocaleString(undefined, { minimumFractionDigits: 2 }) : record.rate}
                </span>
              </div>
            )}
          </div>

          {/* Financial Amounts Cards */}
          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3">
            {record.net !== undefined && record.net !== null && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                  Net Amount
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                  {currency} {typeof record.net === "number" ? record.net.toLocaleString(undefined, { minimumFractionDigits: 2 }) : record.net}
                </span>
              </div>
            )}

            {record.tax !== undefined && record.tax !== null && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                  VAT / Tax
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                  {currency} {typeof record.tax === "number" ? record.tax.toLocaleString(undefined, { minimumFractionDigits: 2 }) : record.tax}
                </span>
              </div>
            )}

            {(record.total !== undefined && record.total !== null) || (record.originalBudget !== undefined) || (record.originalValue !== undefined) || (record.certifiedAmount !== undefined) || (record.amount !== undefined) ? (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                  Total / Certified
                </span>
                <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {currency} {typeof (record.total ?? record.revisedBudget ?? record.currentCommitment ?? record.certifiedAmount ?? record.amount) === "number" ? (record.total ?? record.revisedBudget ?? record.currentCommitment ?? record.certifiedAmount ?? record.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : (record.total ?? record.revisedBudget ?? record.currentCommitment ?? record.certifiedAmount ?? record.amount)}
                </span>
              </div>
            ) : null}

            {record.paid !== undefined || record.paidAmount !== undefined ? (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                  Paid / Received
                </span>
                <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                  {currency} {typeof (record.paid ?? record.paidAmount) === "number" ? (record.paid ?? record.paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : (record.paid ?? record.paidAmount ?? 0)}
                </span>
              </div>
            ) : null}
          </div>

          {/* Notes */}
          {record.notes && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Notes & Comments
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {record.notes}
              </p>
            </div>
          )}

          {/* Supporting Evidence / Documents Section */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-amber-600" />
                Supporting Documents ({documents.length})
              </span>
              {onManageAttachments && (
                <button
                  type="button"
                  onClick={onManageAttachments}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 cursor-pointer"
                >
                  Manage Attachments →
                </button>
              )}
            </div>

            {documents.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No supporting documents attached to this record.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                      {getDocIcon(doc.type, doc.name)}
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 dark:text-white block truncate">
                          {doc.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {doc.type} • {doc.size || "Standard"} • {doc.uploadedOn || "Verified"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {doc.fileData && (
                        <a
                          href={doc.fileData}
                          download={doc.name}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Download document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit History Box */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Created by {record.source?.uploadedBy || "Authorized User"} • Status: {record.source?.approvalStatus || "Verified"}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <div>
            {canEdit && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Record
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Record
              </button>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(false);
            }}
          >
            <div
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/60">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Delete this record?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onClose();
                    if (onDelete) onDelete();
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
