import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { X, Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { ProjectContractRecord } from "../../types/contractManagement";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contract: ProjectContractRecord | null;
  onUpload: (contractId: string, file: { name: string; size: number; type: string; dataUrl?: string; category?: string }) => Promise<void>;
}

export default function ContractAttachmentUploadModal({
  isOpen,
  onClose,
  contract,
  onUpload
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("Contract Agreement Instrument");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !contract) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onload = () => {
        setDataUrl(reader.result as string);
      };
      reader.readAsDataURL(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      const reader = new FileReader();
      reader.onload = () => {
        setDataUrl(reader.result as string);
      };
      reader.readAsDataURL(dropped);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/contracts/ContractAttachmentUploadModal.tsx");
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select a file to upload.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg(null);
      await onUpload(contract.id, {
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl: dataUrl || undefined,
        category
      });
      onClose();
      setFile(null);
      setDataUrl(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Upload Supporting Contract Document
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Contract: {contract.contractNumber} ({contract.contractTitle})
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Document Classification / Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Form of Agreement (Signed Deed)">Form of Agreement (Signed Deed)</option>
              <option value="Letter of Acceptance / Award">Letter of Acceptance / Award</option>
              <option value="Particular Conditions (Part A & B)">Particular Conditions (Part A & B)</option>
              <option value="General Conditions of Contract">General Conditions of Contract</option>
              <option value="Performance Bond / Demand Guarantee">Performance Bond / Demand Guarantee</option>
              <option value="Advance Payment Guarantee">Advance Payment Guarantee</option>
              <option value="Retention Money Escrow / Bond">Retention Money Escrow / Bond</option>
              <option value="Addendum & Scope Adjustment">Addendum & Scope Adjustment</option>
              <option value="Other Supporting Document">Other Supporting Document</option>
            </select>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-850/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative"
          >
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xlsx,.dwg,.zip"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            {file ? (
              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block">{file.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Click or drag signed document here
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  PDF, DOCX, XLSX, DWG, ZIP (up to 50MB)
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!file || isUploading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isUploading ? "Uploading..." : "Attach Document"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
