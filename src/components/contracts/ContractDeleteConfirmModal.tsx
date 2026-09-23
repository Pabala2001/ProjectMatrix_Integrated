import { assertOperationalAction } from "../../integration/operationalAccess";
import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { ProjectContractRecord } from "../../types/contractManagement";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contract: ProjectContractRecord | null;
  onConfirm: (contractId: string) => Promise<void>;
}

export default function ContractDeleteConfirmModal({
  isOpen,
  onClose,
  contract,
  onConfirm
}: Props) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!isOpen || !contract) return null;

  const handleDelete = async () => {
    assertOperationalAction("delete", "components/contracts/ContractDeleteConfirmModal.tsx");
    try {
      setIsDeleting(true);
      await onConfirm(contract.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        <div className="flex items-start gap-3">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Delete Contract Record
            </h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to permanently delete this contract agreement and its attached documents?
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
          <div>
            <span className="text-slate-400 font-bold">Contract No:</span>{" "}
            <span className="font-mono font-bold text-slate-900 dark:text-white">{contract.contractNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold">Title:</span>{" "}
            <span className="font-bold text-slate-900 dark:text-white">{contract.contractTitle}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold">Value:</span>{" "}
            <span className="font-mono font-bold text-emerald-600">{contract.currency} {contract.contractValue ? contract.contractValue.toLocaleString() : "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold">Attachments:</span>{" "}
            <span className="font-mono text-slate-700 dark:text-slate-300">{contract.attachments?.length || 0} file(s)</span>
          </div>
        </div>

        <p className="text-[11px] text-rose-500 font-medium">
          This action cannot be undone. This record will be permanently purged from the project register.
        </p>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? "Deleting..." : "Confirm Delete"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
