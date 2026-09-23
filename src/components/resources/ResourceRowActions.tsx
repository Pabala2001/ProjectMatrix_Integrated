import React from "react";
import { Eye, Edit, Trash2 } from "lucide-react";

interface ResourceRowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ResourceRowActions: React.FC<ResourceRowActionsProps> = ({
  onView,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true
}) => {
  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="View Details"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}

      {canEdit && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
          title="Edit Record"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      )}

      {canDelete && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
          title="Delete Record"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
