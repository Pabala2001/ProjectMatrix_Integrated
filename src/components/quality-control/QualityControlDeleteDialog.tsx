import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface QualityControlDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  recordTitle?: string;
  isDeleting?: boolean;
}

export default function QualityControlDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Quality Control Record",
  message = "Are you sure you want to delete this quality control inspection sheet? This action is permanent and cannot be undone.",
  recordTitle,
  isDeleting = false,
}: QualityControlDeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl z-10 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex gap-4 items-start">
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-base font-extrabold text-[#07182E] tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {message}
            </p>

            {recordTitle && (
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Record Selected
                </span>
                <span className="text-xs font-bold text-slate-700 font-mono">
                  {recordTitle}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isDeleting ? "Deleting..." : "Delete Record"}
          </button>
        </div>

      </div>
    </div>
  );
}
