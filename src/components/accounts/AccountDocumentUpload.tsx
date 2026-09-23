import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Download,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  X,
  ExternalLink,
  Folder,
  Plus,
  RefreshCw,
  RotateCcw,
  Archive,
} from "lucide-react";
import {
  uploadAccountAttachment,
  getAccountAttachments,
  getAccountAttachmentSignedUrl,
  downloadAccountAttachment,
  archiveAccountAttachment,
  restoreAccountAttachment,
  validateAttachmentFile,
  AccountAttachment,
  ALLOWED_EXTENSIONS,
} from "../../services/accountsAttachmentsService";

export interface AccountDocumentUploadProps {
  companyId: string;
  projectId?: string;
  recordType?: string;
  recordId?: string;
  documentType?: string;
  title?: string;
  description?: string;
  showDivisionsNav?: boolean;
  compact?: boolean;
  onAttachmentUploaded?: (attachment: AccountAttachment) => void;
  onAttachmentArchived?: (attachmentId: string) => void;
  onAttachmentRestored?: (attachmentId: string) => void;
}

// Module / Division tab definitions
const ACCOUNT_DIVISIONS = [
  { id: "all", label: "All Documents", types: [] },
  { id: "budgets", label: "Budgets & Forecasts", types: ["budget", "forecast"] },
  { id: "commitments", label: "Commitments", types: ["commitment"] },
  { id: "actual_costs", label: "Actual Costs", types: ["actual_cost"] },
  { id: "client_accounts", label: "Client Accounts", types: ["client_account", "client_invoice", "client_credit_note", "client_receipt"] },
  { id: "supplier_accounts", label: "Supplier Accounts", types: ["supplier_account", "supplier_invoice", "supplier_credit_note", "supplier_payment"] },
  { id: "cash_bank", label: "Cash & Bank", types: ["cashbook_transaction", "bank_statement"] },
  { id: "reports_audit", label: "Reports & Audit", types: ["reports", "audit_log", "other"] },
];

export const AccountDocumentUpload: React.FC<AccountDocumentUploadProps> = ({
  companyId,
  projectId,
  recordType: propRecordType,
  recordId: propRecordId,
  documentType: propDocumentType = "general",
  title = "Supporting Documents Register",
  description = "Centralised file storage for budgets, commitments, invoices, bank statements, and audit records.",
  showDivisionsNav = !propRecordType,
  compact = false,
  onAttachmentUploaded,
  onAttachmentArchived,
  onAttachmentRestored,
}) => {
  const [attachments, setAttachments] = useState<AccountAttachment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeDivision, setActiveDivision] = useState<string>("all");
  const [showArchived, setShowArchived] = useState<boolean>(false);
  
  // Upload form state for standalone uploads
  const [targetRecordType, setTargetRecordType] = useState<string>(propRecordType || "budget");
  const [targetRecordId, setTargetRecordId] = useState<string>(propRecordId || "");
  const [docType, setDocType] = useState<string>(propDocumentType);
  const [docDescription, setDocDescription] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Preview Modal state
  const [previewAttachment, setPreviewAttachment] = useState<AccountAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchRequestIdRef = useRef<number>(0);

  // Sync prop changes
  useEffect(() => {
    if (propRecordType) setTargetRecordType(propRecordType);
    if (propRecordId) setTargetRecordId(propRecordId);
  }, [propRecordType, propRecordId]);

  // Load attachments on mount or when context changes
  const fetchAttachments = async () => {
    if (!companyId) {
      setAttachments([]);
      return;
    }

    const currentRequestId = ++fetchRequestIdRef.current;
    setLoading(true);
    setErrorMsg(null);

    try {
      const filters: any = {
        includeArchived: showArchived,
      };
      if (propRecordType) filters.recordType = propRecordType;
      if (propRecordId) filters.recordId = propRecordId;
      if (projectId) filters.projectId = projectId;

      const data = await getAccountAttachments(companyId, filters);

      // Race condition protection: ensure response matches current request
      if (currentRequestId === fetchRequestIdRef.current) {
        setAttachments(data);
      }
    } catch (err: any) {
      if (currentRequestId === fetchRequestIdRef.current) {
        console.error("Failed to load attachments:", err);
        setErrorMsg(err.message || "Failed to load documents.");
      }
    } finally {
      if (currentRequestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Reset previews and clear state when companyId or projectId changes
  useEffect(() => {
    setPreviewAttachment(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    fetchAttachments();
  }, [companyId, projectId, propRecordType, propRecordId, showArchived]);

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle File Selection
  const processSelectedFile = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validateAttachmentFile(file, file.name);
    if (!validation.valid) {
      setErrorMsg(validation.error || "Invalid file selection.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (uploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  // Execute Upload
  const handleStartUpload = async () => {
    if (!companyId) {
      setErrorMsg("No active company selected. Please select a company first.");
      return;
    }

    if (!selectedFile) {
      setErrorMsg("Please select a file to upload.");
      return;
    }

    const recType = propRecordType || targetRecordType;
    const recId = propRecordId || targetRecordId;

    if (!recType || !recId) {
      setErrorMsg("A valid Record Type and Reference ID are required before uploading.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const uploaded = await uploadAccountAttachment({
        companyId,
        projectId,
        recordType: recType,
        recordId: recId,
        documentType: docType,
        description: docDescription,
        file: selectedFile,
        onProgress: (p) => setUploadProgress(p),
      });

      setSuccessMsg(`File "${uploaded.original_filename}" uploaded successfully.`);
      setSelectedFile(null);
      setDocDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh table
      fetchAttachments();

      if (onAttachmentUploaded) {
        onAttachmentUploaded(uploaded);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorMsg(err.message || "File upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle Download
  const handleDownload = async (attachment: AccountAttachment) => {
    assertOperationalAction("export", "components/accounts/AccountDocumentUpload.tsx");
    try {
      await downloadAccountAttachment(attachment.storage_path, attachment.original_filename);
    } catch (err: any) {
      setErrorMsg(`Download failed: ${err.message}`);
    }
  };

  // Handle Preview
  const handlePreview = async (attachment: AccountAttachment) => {
    setPreviewAttachment(attachment);
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const signed = await getAccountAttachmentSignedUrl(attachment.storage_path, 1800);
      setPreviewUrl(signed);
    } catch (err: any) {
      setErrorMsg(`Failed to load document preview: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle Delete / Soft Archive
  const handleArchive = async (attachmentId: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to archive "${filename}"? It can be restored later.`)) {
      return;
    }

    try {
      await archiveAccountAttachment(attachmentId);
      setSuccessMsg(`Document "${filename}" archived successfully.`);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      if (onAttachmentArchived) onAttachmentArchived(attachmentId);
    } catch (err: any) {
      setErrorMsg(`Failed to archive document: ${err.message}`);
    }
  };

  // Handle Restore
  const handleRestore = async (attachmentId: string, filename: string) => {
    try {
      await restoreAccountAttachment(attachmentId);
      setSuccessMsg(`Document "${filename}" restored successfully.`);
      fetchAttachments();
      if (onAttachmentRestored) onAttachmentRestored(attachmentId);
    } catch (err: any) {
      setErrorMsg(`Failed to restore document: ${err.message}`);
    }
  };

  // File Icon Helper
  const getFileIcon = (mimeType?: string | null, filename?: string) => {
    const ext = filename ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
    if (ext === ".pdf" || mimeType?.includes("pdf")) {
      return <FileText className="w-5 h-5 text-rose-500 shrink-0" />;
    }
    if ([".xls", ".xlsx", ".csv"].includes(ext) || mimeType?.includes("excel") || mimeType?.includes("csv") || mimeType?.includes("spreadsheet")) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
    if ([".png", ".jpg", ".jpeg"].includes(ext) || mimeType?.includes("image")) {
      return <FileImage className="w-5 h-5 text-sky-500 shrink-0" />;
    }
    return <File className="w-5 h-5 text-slate-400 shrink-0" />;
  };

  // Format File Size
  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format Record Type for Display
  const formatRecordTypeLabel = (rt: string) => {
    const map: Record<string, string> = {
      budget: "Budget",
      forecast: "Forecast",
      commitment: "Commitment",
      actual_cost: "Actual Cost",
      client_account: "Client Account",
      client_invoice: "Client Invoice",
      client_credit_note: "Client Credit Note",
      client_receipt: "Client Receipt",
      supplier_account: "Supplier Account",
      supplier_invoice: "Supplier Invoice",
      supplier_credit_note: "Supplier Credit Note",
      supplier_payment: "Supplier Payment",
      cashbook_transaction: "Cashbook Tx",
      bank_statement: "Bank Statement",
      general: "General",
    };
    return map[rt] || rt.replace(/_/g, " ").toUpperCase();
  };

  // Filter attachments based on active division tab and search term
  const filteredAttachments = attachments.filter((att) => {
    // Division filter
    if (showDivisionsNav && activeDivision !== "all") {
      const activeTabObj = ACCOUNT_DIVISIONS.find((d) => d.id === activeDivision);
      if (activeTabObj && activeTabObj.types.length > 0) {
        if (!activeTabObj.types.includes(att.record_type)) return false;
      }
    }

    // Search term filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = att.original_filename.toLowerCase().includes(q);
      const matchType = att.record_type.toLowerCase().includes(q);
      const matchDocType = att.document_type.toLowerCase().includes(q);
      const matchRef = att.record_id.toLowerCase().includes(q);
      const matchDesc = (att.description || "").toLowerCase().includes(q);
      return matchName || matchType || matchDocType || matchRef || matchDesc;
    }

    return true;
  });

  return (
    <div className={`space-y-4 ${compact ? "" : "bg-slate-50/50 p-4 md:p-6 rounded-3xl border border-slate-200/80"}`}>
      {/* Header */}
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#07182E] flex items-center gap-2">
              <Folder className="w-5 h-5 text-[#FF9F1C]" />
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived((prev) => !prev)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                showArchived
                  ? "bg-amber-100 border-amber-300 text-amber-900 font-bold"
                  : "bg-white border-slate-200 text-slate-600 hover:text-[#07182E]"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? "Viewing Archived" : "Show Archived"}</span>
            </button>
            <button
              onClick={fetchAttachments}
              disabled={loading}
              className="text-xs font-semibold text-slate-600 hover:text-[#07182E] bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 hover:shadow-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-500" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Storage Error</span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1 font-medium">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Division Navigation Tabs */}
      {showDivisionsNav && (
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none gap-1 pb-1">
          {ACCOUNT_DIVISIONS.map((div) => {
            const isActive = activeDivision === div.id;
            return (
              <button
                key={div.id}
                onClick={() => setActiveDivision(div.id)}
                className={`px-3 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#07182E] text-white shadow-xs"
                    : "text-slate-500 hover:text-[#07182E] hover:bg-slate-100"
                }`}
              >
                <span>{div.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Upload Drop Zone & Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-2xs">
        <label className="block text-xs font-bold text-[#07182E] uppercase tracking-wider">
          Upload New Document
        </label>

        {/* Dynamic target selectors if not provided as props */}
        {!propRecordType && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Module / Division</label>
              <select
                value={targetRecordType}
                onChange={(e) => setTargetRecordType(e.target.value)}
                disabled={uploading}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[#07182E] font-medium focus:ring-2 focus:ring-[#07182E]/10 focus:outline-none disabled:opacity-50"
              >
                <option value="budget">Budgets & Forecasts - Budget</option>
                <option value="forecast">Budgets & Forecasts - Forecast</option>
                <option value="commitment">Commitments - Order / Subcontract</option>
                <option value="actual_cost">Actual Costs - Valuation / Expense</option>
                <option value="client_account">Client Accounts - Client Profile</option>
                <option value="client_invoice">Client Accounts - Client Invoice</option>
                <option value="client_credit_note">Client Accounts - Credit Note</option>
                <option value="client_receipt">Client Accounts - Receipt</option>
                <option value="supplier_account">Supplier Accounts - Vendor Profile</option>
                <option value="supplier_invoice">Supplier Accounts - Supplier Invoice</option>
                <option value="supplier_credit_note">Supplier Accounts - Credit Note</option>
                <option value="supplier_payment">Supplier Accounts - Vendor Payment</option>
                <option value="cashbook_transaction">Cash & Bank - Cashbook Tx</option>
                <option value="bank_statement">Cash & Bank - Bank Statement</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reference ID / Code</label>
              <input
                type="text"
                value={targetRecordId}
                onChange={(e) => setTargetRecordId(e.target.value)}
                disabled={uploading}
                placeholder="e.g., INV-2026-001 or REF-001"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[#07182E] focus:ring-2 focus:ring-[#07182E]/10 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {/* Drag and Drop Box */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            if (!uploading) fileInputRef.current?.click();
          }}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            uploading
              ? "opacity-60 cursor-not-allowed border-slate-200 bg-slate-50"
              : dragActive
              ? "border-[#FF9F1C] bg-amber-50/50 scale-[1.005]"
              : selectedFile
              ? "border-emerald-400 bg-emerald-50/30"
              : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            accept={ALLOWED_EXTENSIONS.join(",")}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                {getFileIcon(selectedFile.type, selectedFile.name)}
              </div>
              <div className="text-xs font-bold text-[#07182E] break-all">{selectedFile.name}</div>
              <div className="text-[11px] text-slate-500">
                Size: {formatFileSize(selectedFile.size)} | Format: {selectedFile.type || "Document"}
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline pt-1"
                >
                  Choose a different file
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1.5">
              <Upload className="w-8 h-8 text-slate-400 mb-1" />
              <div className="text-xs font-bold text-[#07182E]">
                Click or drag & drop file to upload
              </div>
              <div className="text-[11px] text-slate-400">
                Supported formats: PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPG, JPEG (Max 20MB)
              </div>
            </div>
          )}
        </div>

        {/* Category & Description input */}
        {selectedFile && (
          <div className="space-y-3 pt-2 border-t border-slate-100 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Document Category</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  disabled={uploading}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[#07182E] font-medium disabled:opacity-50"
                >
                  <option value="general">General Attachment</option>
                  <option value="tax_certificate">Tax Certificate / Clearance</option>
                  <option value="invoice">Invoice / Claim</option>
                  <option value="credit_note">Credit Note</option>
                  <option value="proof_of_payment">Proof of Payment</option>
                  <option value="delivery_note">Delivery Note / GRN</option>
                  <option value="contract">Contract / Agreement</option>
                  <option value="bank_statement">Bank Statement</option>
                  <option value="audit_report">Audit / Compliance Record</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Notes / Description (Optional)</label>
                <input
                  type="text"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  disabled={uploading}
                  placeholder="e.g., Signed valuation certificate #4"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[#07182E] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={uploading}
                className="bg-[#07182E] hover:bg-[#0c223f] text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FF9F1C]" />
                    <span>Uploading ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-[#FF9F1C]" />
                    <span>Upload File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Register Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold text-[#07182E] uppercase tracking-wider flex items-center gap-2">
            <span>{showArchived ? "Archived Documents Register" : "Documents Register"}</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-mono">
              {filteredAttachments.length}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-[#07182E] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#07182E]"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Division / Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Reference ID</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#07182E]" />
                      <span>Loading attachments...</span>
                    </td>
                  </tr>
                ) : filteredAttachments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">
                      {searchTerm
                        ? "No documents match your search query."
                        : showArchived
                        ? "No archived documents found."
                        : "No documents attached to this register yet."}
                    </td>
                  </tr>
                ) : (
                  filteredAttachments.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(att.mime_type, att.original_filename)}
                          <div>
                            <span className="font-bold text-[#07182E] block max-w-[200px] sm:max-w-[260px] break-all">
                              {att.original_filename}
                            </span>
                            {att.description && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[220px]">
                                {att.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600">
                        <span className="inline-block bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-medium">
                          {formatRecordTypeLabel(att.record_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">
                        {att.document_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {att.record_id}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {formatFileSize(att.file_size_bytes)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {new Date(att.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handlePreview(att)}
                            title="Preview document"
                            className="p-1.5 text-slate-500 hover:text-[#07182E] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(att)}
                            title="Download document"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {att.is_archived ? (
                            <button
                              onClick={() => handleRestore(att.id, att.original_filename)}
                              title="Restore document"
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchive(att.id, att.original_filename)}
                              title="Archive document"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="p-4 px-6 bg-[#07182E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getFileIcon(previewAttachment.mime_type, previewAttachment.original_filename)}
                <div>
                  <h4 className="text-sm font-bold break-all">{previewAttachment.original_filename}</h4>
                  <p className="text-[10px] text-slate-300">
                    {formatRecordTypeLabel(previewAttachment.record_type)} | {formatFileSize(previewAttachment.file_size_bytes)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-xs flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open New Tab
                  </a>
                )}
                <button
                  onClick={() => {
                    setPreviewAttachment(null);
                    setPreviewUrl(null);
                  }}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex items-center justify-center min-h-[400px]">
              {previewLoading ? (
                <div className="text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#07182E]" />
                  <span className="text-xs font-semibold">Generating secure preview URL...</span>
                </div>
              ) : previewUrl ? (
                previewAttachment.mime_type?.startsWith("image/") ||
                [".png", ".jpg", ".jpeg"].some((ext) => previewAttachment.original_filename.toLowerCase().endsWith(ext)) ? (
                  <img
                    src={previewUrl}
                    alt={previewAttachment.original_filename}
                    className="max-h-[70vh] object-contain rounded-xl shadow-md border border-slate-200"
                  />
                ) : previewAttachment.mime_type === "application/pdf" ||
                  previewAttachment.original_filename.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={previewUrl}
                    title={previewAttachment.original_filename}
                    className="w-full h-[70vh] rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="text-center bg-white p-8 rounded-2xl border border-slate-200 max-w-md shadow-xs">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h5 className="text-sm font-bold text-[#07182E] mb-1 break-all">{previewAttachment.original_filename}</h5>
                    <p className="text-xs text-slate-500 mb-4">
                      Direct inline preview is not supported for Office documents or spreadsheets. Please download the file to view it locally.
                    </p>
                    <button
                      onClick={() => handleDownload(previewAttachment)}
                      className="bg-[#07182E] text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 hover:bg-[#0c223f] transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-[#FF9F1C]" />
                      Download File
                    </button>
                  </div>
                )
              ) : (
                <div className="text-xs text-rose-600">Failed to render preview.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDocumentUpload;
