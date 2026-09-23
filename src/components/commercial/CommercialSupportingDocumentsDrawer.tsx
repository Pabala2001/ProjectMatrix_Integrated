import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useRef } from "react";
import {
  X,
  FileText,
  FileSpreadsheet,
  FileCheck,
  Eye,
  Download,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle
} from "lucide-react";
import { CommercialSupportingDocument } from "../../types/commercialWorkspace";

interface CommercialSupportingDocumentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recordTitle: string;
  recordRef?: string;
  documents: CommercialSupportingDocument[];
  onAddDocument: (doc: CommercialSupportingDocument) => void;
  onReplaceDocument?: (docId: string, newDoc: CommercialSupportingDocument) => void;
  onDeleteDocument?: (docId: string) => void;
  readOnly?: boolean;
}

export const CommercialSupportingDocumentsDrawer: React.FC<CommercialSupportingDocumentsDrawerProps> = ({
  isOpen,
  onClose,
  recordTitle,
  recordRef,
  documents = [],
  onAddDocument,
  onReplaceDocument,
  onDeleteDocument,
  readOnly = false
}) => {
  const [selectedDoc, setSelectedDoc] = useState<CommercialSupportingDocument | null>(null);
  const [newDocType, setNewDocType] = useState<CommercialSupportingDocument["type"]>("Supplier Invoice");
  const [newDocNotes, setNewDocNotes] = useState("");
  const [docToDelete, setDocToDelete] = useState<CommercialSupportingDocument | null>(null);
  const [replaceTargetDocId, setReplaceTargetDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target?.result as string;
      const newDoc: CommercialSupportingDocument = {
        id: "doc-" + Date.now(),
        name: file.name,
        type: newDocType,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        fileType: file.type || file.name.split(".").pop() || "unknown",
        fileData: fileData,
        uploadedBy: "Authorized User",
        uploadedOn: new Date().toISOString().split("T")[0],
        notes: newDocNotes || undefined,
        version: 1
      };
      onAddDocument(newDoc);
      setNewDocNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleReplaceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTargetDocId || !onReplaceDocument) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target?.result as string;
      const newDoc: CommercialSupportingDocument = {
        id: replaceTargetDocId,
        name: file.name,
        type: newDocType,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        fileType: file.type || file.name.split(".").pop() || "unknown",
        fileData: fileData,
        uploadedBy: "Authorized User",
        uploadedOn: new Date().toISOString().split("T")[0],
        version: 2
      };
      onReplaceDocument(replaceTargetDocId, newDoc);
      setReplaceTargetDocId(null);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const triggerReplace = (docId: string) => {
    setReplaceTargetDocId(docId);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.click();
    }
  };

  const handleDownload = (doc: CommercialSupportingDocument) => {
    assertOperationalAction("export", "components/commercial/CommercialSupportingDocumentsDrawer.tsx");
    if (doc.fileData) {
      const link = document.createElement("a");
      link.href = doc.fileData;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fallback text summary download if binary payload is not stored
      const blob = new Blob(
        [
          `Commercial Record Attachment\nDocument Name: ${doc.name}\nType: ${doc.type}\nUploaded By: ${doc.uploadedBy}\nUploaded On: ${doc.uploadedOn}\nRecord Reference: ${recordRef || "-"}\nRecord: ${recordTitle}`
        ],
        { type: "text/plain" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.name.replace(/\.[^/.]+$/, "")}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const confirmDelete = () => {
    if (docToDelete && onDeleteDocument) {
      onDeleteDocument(docToDelete.id);
      setDocToDelete(null);
      if (selectedDoc?.id === docToDelete.id) {
        setSelectedDoc(null);
      }
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800">
        
        {/* Hidden replace file input */}
        <input
          type="file"
          ref={replaceFileInputRef}
          onChange={handleReplaceFileUpload}
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
          className="hidden"
        />

        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900/60">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Manage Supporting Attachments
                {recordRef && (
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                    {recordRef}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {recordTitle} • Evidence-based commercial audit trail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Document Preview Modal if selected */}
          {selectedDoc && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate max-w-[80%]">
                  {getDocIcon(selectedDoc.type, selectedDoc.name)}
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {selectedDoc.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                    {selectedDoc.type}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Close Preview
                </button>
              </div>

              {/* Preview Box */}
              <div className="w-full h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col items-center justify-center p-4">
                {selectedDoc.fileData && selectedDoc.fileData.startsWith("data:image/") ? (
                  <img
                    src={selectedDoc.fileData}
                    alt={selectedDoc.name}
                    className="max-h-full object-contain"
                  />
                ) : selectedDoc.fileData && selectedDoc.fileData.startsWith("data:application/pdf") ? (
                  <iframe
                    src={selectedDoc.fileData}
                    title={selectedDoc.name}
                    className="w-full h-full border-none"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {selectedDoc.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Size: {selectedDoc.size || "Standard"} • Verified Source Evidence
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownload(selectedDoc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg hover:bg-amber-100 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Verified File
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload New Document Box */}
          {!readOnly && (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  Attach Supporting Evidence
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  PDF, DOCX, XLSX, XLS, CSV, Images
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Document Category
                  </label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Quotation">Supplier / Subcontractor Quotation</option>
                    <option value="Purchase Order">Approved Purchase Order</option>
                    <option value="Subcontract">Subcontract Agreement</option>
                    <option value="Payment Certificate">Payment Certificate (IPC)</option>
                    <option value="Supplier Invoice">Supplier Invoice</option>
                    <option value="Tax Invoice">Tax Invoice</option>
                    <option value="Proof of Payment">Proof of Payment / Bank Confirmation</option>
                    <option value="Receipt">Official Receipt / Cash Voucher</option>
                    <option value="Delivery Note">Signed Delivery Note</option>
                    <option value="Expense Voucher">Expense Voucher</option>
                    <option value="BOQ Worksheet">BOQ / Estimate Sheet</option>
                    <option value="Change Order">Change Order / Variation Approval</option>
                    <option value="Supplier Statement">Supplier Statement</option>
                    <option value="Other">Other Supporting Document</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Reference / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Quotation Q-9921 or POP Ref"
                    value={newDocNotes}
                    onChange={(e) => setNewDocNotes(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                  className="hidden"
                  id="drawer-file-upload"
                />
                <label
                  htmlFor="drawer-file-upload"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Upload className="w-4 h-4" />
                  Select & Upload File
                </label>
              </div>
            </div>
          )}

          {/* Attached Documents Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Attached Documents ({documents.length})
              </span>
              <span className="text-[10px] text-slate-400">
                Single Source of Truth
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  No supporting documents attached
                </p>
                <p className="text-[11px] text-slate-400">
                  Attach invoices, quotations, certificates, or payment evidence to support this commercial record.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3 min-w-[150px] truncate overflow-hidden">File Name</th>
                      <th className="py-2.5 px-3 w-28 truncate overflow-hidden">Type</th>
                      <th className="py-2.5 px-3 w-24 truncate overflow-hidden">Uploaded By</th>
                      <th className="py-2.5 px-3 w-20 truncate overflow-hidden">Date</th>
                      <th className="py-2.5 px-3 text-right w-36 truncate overflow-hidden">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2 truncate overflow-hidden">
                          {getDocIcon(doc.type, doc.name)}
                          <div className="truncate max-w-[160px]">
                            <span className="truncate block font-semibold">{doc.name}</span>
                            {doc.notes && (
                              <span className="block text-[10px] text-slate-400 font-normal truncate">
                                {doc.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 truncate overflow-hidden">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate inline-block max-w-full">
                            {doc.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate overflow-hidden">
                          {doc.uploadedBy || "User"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] truncate overflow-hidden">
                          {doc.uploadedOn}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1 truncate overflow-hidden">
                          {/* View Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedDoc(doc)}
                            title="View Document"
                            className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Download Button */}
                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            title="Download Document"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Replace Button */}
                          {!readOnly && onReplaceDocument && (
                            <button
                              type="button"
                              onClick={() => triggerReplace(doc.id)}
                              title="Replace Attachment"
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {!readOnly && onDeleteDocument && (
                            <button
                              type="button"
                              onClick={() => setDocToDelete(doc)}
                              title="Delete Attachment"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified Source Integrity Protected</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Delete Attachment Confirmation Modal */}
        {docToDelete && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100"
            onClick={() => setDocToDelete(null)}
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
                    Delete Attachment?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">{docToDelete.name}</span>? This will remove the document attachment, but the commercial record will remain intact.
                  </p>
                </div>
                <button
                  onClick={() => setDocToDelete(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDocToDelete(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Delete Attachment
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
