import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  Paperclip,
  AlertTriangle,
  X
} from "lucide-react";

interface CommercialRowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onManageAttachments?: () => void;
  attachmentsCount?: number;
  recordIdentifier?: string;
  recordTitle?: string;
  canEdit?: boolean;
}

export const CommercialRowActions: React.FC<CommercialRowActionsProps> = ({
  onView,
  onEdit,
  onDelete,
  onManageAttachments,
  attachmentsCount = 0,
  recordIdentifier,
  recordTitle,
  canEdit = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayTitle = recordTitle || recordIdentifier || "this record";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    assertOperationalAction("delete", "components/commercial/CommercialRowActions.tsx");
    e.stopPropagation();
    setIsOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
    if (onDelete) {
      onDelete();
    }
  };

  return (
    <div className="relative inline-flex items-center justify-end gap-1.5 text-left" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      {/* Quick Direct Actions Toolbar */}
      {onView && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="View"
          aria-label="View Details"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}

      {canEdit && onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
          title="Edit"
          aria-label="Edit Record"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}

      {onManageAttachments && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onManageAttachments();
          }}
          className="relative w-8 h-8 flex items-center justify-center text-amber-600 hover:text-amber-700 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
          title="Attachments"
          aria-label="Manage Attachments"
        >
          <Paperclip className="w-4 h-4" />
          {attachmentsCount > 0 && (
            <span className="absolute -top-1 -right-1 text-[9px] font-bold px-1 rounded-full bg-amber-500 text-white min-w-[14px] text-center leading-tight">
              {attachmentsCount}
            </span>
          )}
        </button>
      )}

      {canEdit && onDelete && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="w-8 h-8 flex items-center justify-center text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
          title="Delete"
          aria-label="Delete Record"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* 3-dot dropdown menu trigger for extra flexibility */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="More options"
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isOpen && (
          <div
            className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[9999] py-1 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 dark:divide-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              {onView && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onView();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span>View Details</span>
                </button>
              )}

              {canEdit && onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onEdit();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4 text-blue-600" />
                  <span>Edit Record</span>
                </button>
              )}

              {onManageAttachments && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onManageAttachments();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Paperclip className="w-4 h-4 text-amber-600" />
                    <span>Attachments</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                    {attachmentsCount}
                  </span>
                </button>
              )}
            </div>

            {canEdit && onDelete && (
              <div className="py-1">
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Delete Record</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100"
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
                  Delete Commercial Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">{displayTitle}</span>? This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
