import React, { useState } from "react";
import {
  X,
  Scale,
  Calendar,
  DollarSign,
  Building,
  FileText,
  Paperclip,
  Download,
  Trash2,
  Edit,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Plus,
  Upload
} from "lucide-react";
import { ProjectContractRecord, ContractAttachment } from "../../types/contractManagement";
import { StatusBadge } from "../ui/StatusBadge";
import { formatCurrency } from "../../utils/currency";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contract: ProjectContractRecord | null;
  projectName: string;
  onEdit: (contract: ProjectContractRecord) => void;
  onDelete: (contract: ProjectContractRecord) => void;
  onAddAttachment: (contract: ProjectContractRecord) => void;
  onRemoveAttachment: (contractId: string, attachmentId: string) => Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function ContractDetailsModal({
  isOpen,
  onClose,
  contract,
  projectName,
  onEdit,
  onDelete,
  onAddAttachment,
  onRemoveAttachment,
  canEdit = true,
  canDelete = true
}: Props) {
  if (!isOpen || !contract) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Active":
      case "Executing":
        return "success";
      case "Substantially Complete":
      case "Completed":
        return "info";
      case "Under Dispute":
      case "Suspended":
        return "warning";
      case "Terminated":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-black border border-blue-200 dark:border-blue-800">
                {contract.contractNumber}
              </span>
              <StatusBadge label={contract.status} variant={getStatusVariant(contract.status) as any} size="sm" />
              <span className="text-xs text-slate-500 font-mono">
                Project: {projectName} ({contract.projectId})
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {contract.contractTitle}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {contract.contractType}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(contract);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => {
                  onClose();
                  onDelete(contract);
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Contract Value
              </span>
              <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                {contract.currency} {contract.contractValue ? contract.contractValue.toLocaleString() : "-"}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Start Date
              </span>
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                {contract.startDate || "-"}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Intended Completion
              </span>
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                {contract.completionDate || "-"}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Attachments
              </span>
              <span className="text-sm font-bold font-mono text-slate-900 dark:text-white flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-purple-500" />
                {contract.attachments?.length || 0} Files
              </span>
            </div>
          </div>

          {/* Signatories & Parties */}
          <div className="p-5 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Contracting Parties & Representatives
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block">Client / Employer:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{contract.client || "-"}</span>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-bold block">Contractor / JV:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{contract.contractor || "-"}</span>
              </div>

              {contract.engineerOrPM && (
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block">Engineer / Project Manager:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{contract.engineerOrPM}</span>
                </div>
              )}

              {contract.disputeResolutionMethod && (
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block">Dispute Forum:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{contract.disputeResolutionMethod}</span>
                </div>
              )}
            </div>
          </div>

          {/* Scope of Works & Description */}
          {(contract.scopeOfWorks || contract.description) && (
            <div className="p-5 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Scope of Works & Baseline Details
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {contract.scopeOfWorks || contract.description}
              </p>
            </div>
          )}

          {/* Supporting Documents / Attachments */}
          <div className="p-5 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-blue-500" />
                <span>Supporting Contract Documents & Signed Instruments ({contract.attachments?.length || 0})</span>
              </h4>

              <button
                onClick={() => onAddAttachment(contract)}
                className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Document</span>
              </button>
            </div>

            {(!contract.attachments || contract.attachments.length === 0) ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                No supporting documents uploaded yet. Click "Upload Document" to attach signed deeds, guarantees, or addenda.
              </div>
            ) : (
              <div className="space-y-2">
                {contract.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{att.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>{formatFileSize(att.size)}</span>
                          <span>•</span>
                          <span>{att.category || "Supporting Doc"}</span>
                          <span>•</span>
                          <span>{new Date(att.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      )}
                      <button
                        onClick={() => onRemoveAttachment(contract.id, att.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            Created: {new Date(contract.createdAt).toLocaleString()} | Last Updated: {new Date(contract.updatedAt).toLocaleString()}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
