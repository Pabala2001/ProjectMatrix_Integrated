import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { 
  X, 
  Upload, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  Building, 
  Scale, 
  FileCheck,
  Paperclip,
  Eye
} from "lucide-react";
import { ProjectContractRecord, ContractAttachment, ContractStatus, ContractTypeOption } from "../../types/contractManagement";
import { SUPPORTED_CURRENCIES } from "../../config/currencies";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<ProjectContractRecord, "id" | "projectId" | "createdAt" | "updatedAt">) => Promise<void>;
  initialData?: ProjectContractRecord | null;
  projectId: string;
  projectName: string;
}

const CONTRACT_TYPES: ContractTypeOption[] = [
  "FIDIC 2017 Red Book (Conditions of Contract for Construction)",
  "FIDIC 2017 Yellow Book (Plant & Design-Build)",
  "FIDIC 2017 Silver Book (EPC/Turnkey)",
  "FIDIC 1999 Red Book (Construction 1st Ed)",
  "FIDIC 1999 Yellow Book (Plant & Design-Build)",
  "NEC4 ECC (Engineering and Construction Contract)",
  "NEC3 ECC (Option A / B / C / D / E)",
  "SAICE GCC 2015 (General Conditions of Contract 3rd Ed)",
  "JBCC PBA 6.2 (Principal Building Agreement)",
  "JCT Standard Building Contract",
  "Standard Subcontract Agreement",
  "Consultancy & Engineering Services Agreement",
  "Supply & Delivery Agreement",
  "Custom EPC / Turnkey Contract",
  "Other Bespoke Contract"
];

const STATUS_OPTIONS: ContractStatus[] = [
  "Draft",
  "Active",
  "Executing",
  "Substantially Complete",
  "Completed",
  "Under Dispute",
  "Suspended",
  "Terminated"
];

export default function ContractModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  projectId,
  projectName
}: Props) {
  const isEditing = Boolean(initialData);

  const [contractNumber, setContractNumber] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [client, setClient] = useState("");
  const [contractor, setContractor] = useState("");
  const [contractType, setContractType] = useState<string>(CONTRACT_TYPES[0]);
  const [contractValue, setContractValue] = useState<number | "">("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [status, setStatus] = useState<ContractStatus>("Executing");
  
  const [description, setDescription] = useState("");
  const [scopeOfWorks, setScopeOfWorks] = useState("");
  const [governingLaw, setGoverningLaw] = useState("");
  const [disputeResolutionMethod, setDisputeResolutionMethod] = useState("");
  const [engineerOrPM, setEngineerOrPM] = useState("");
  const [advancePaymentPercent, setAdvancePaymentPercent] = useState<number | "">("");
  const [retentionPercent, setRetentionPercent] = useState<number | "">("");
  const [performanceSecurityPercent, setPerformanceSecurityPercent] = useState<number | "">("");
  const [delayDamagesPerDay, setDelayDamagesPerDay] = useState<number | "">("");

  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setContractNumber(initialData.contractNumber || "");
        setContractTitle(initialData.contractTitle || "");
        setClient(initialData.client || "");
        setContractor(initialData.contractor || "");
        setContractType(initialData.contractType || CONTRACT_TYPES[0]);
        setContractValue(initialData.contractValue || "");
        setCurrency(initialData.currency || "USD");
        setStartDate(initialData.startDate || "");
        setCompletionDate(initialData.completionDate || "");
        setStatus(initialData.status || "Executing");
        setDescription(initialData.description || "");
        setScopeOfWorks(initialData.scopeOfWorks || "");
        setGoverningLaw(initialData.governingLaw || "");
        setDisputeResolutionMethod(initialData.disputeResolutionMethod || "");
        setEngineerOrPM(initialData.engineerOrPM || "");
        setAdvancePaymentPercent(initialData.advancePaymentPercent ?? "");
        setRetentionPercent(initialData.retentionPercent ?? "");
        setPerformanceSecurityPercent(initialData.performanceSecurityPercent ?? "");
        setDelayDamagesPerDay(initialData.delayDamagesPerDay ?? "");
        setAttachments(initialData.attachments || []);
      } else {
        // Defaults for new contract
        setContractNumber(`CON-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
        setContractTitle("");
        setClient("");
        setContractor("");
        setContractType(CONTRACT_TYPES[0]);
        setContractValue("");
        setCurrency("USD");
        setStartDate(new Date().toISOString().split("T")[0]);
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 2);
        setCompletionDate(nextYear.toISOString().split("T")[0]);
        setStatus("Executing");
        setDescription("");
        setScopeOfWorks("");
        setGoverningLaw("");
        setDisputeResolutionMethod("DAAB / Arbitration");
        setEngineerOrPM("");
        setAdvancePaymentPercent(10);
        setRetentionPercent(10);
        setPerformanceSecurityPercent(10);
        setDelayDamagesPerDay("");
        setAttachments([]);
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newAttachment: ContractAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          dataUrl: reader.result as string,
          uploadedAt: new Date().toISOString(),
          category: "Contract Supporting Document"
        };
        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
    // Reset file input
    e.target.value = "";
  };

  const handleRemoveAttachment = (attId: string) => {
    assertOperationalAction("delete", "components/contracts/ContractModal.tsx");
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/contracts/ContractModal.tsx");
    e.preventDefault();
    setErrorMsg(null);

    if (!contractNumber.trim()) {
      setErrorMsg("Contract Number is required.");
      return;
    }
    if (!contractTitle.trim()) {
      setErrorMsg("Contract Title is required.");
      return;
    }
    if (!client.trim()) {
      setErrorMsg("Client / Employer is required.");
      return;
    }
    if (!contractor.trim()) {
      setErrorMsg("Contractor name is required.");
      return;
    }
    if (contractValue === "" || isNaN(Number(contractValue)) || Number(contractValue) < 0) {
      setErrorMsg("Please enter a valid positive Contract Value.");
      return;
    }
    if (!startDate) {
      setErrorMsg("Start Date is required.");
      return;
    }
    if (!completionDate) {
      setErrorMsg("Completion Date is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        contractNumber: contractNumber.trim(),
        contractTitle: contractTitle.trim(),
        client: client.trim(),
        contractor: contractor.trim(),
        contractType,
        contractValue: Number(contractValue),
        currency,
        startDate,
        completionDate,
        status,
        description: description.trim(),
        scopeOfWorks: scopeOfWorks.trim(),
        governingLaw: governingLaw.trim(),
        disputeResolutionMethod: disputeResolutionMethod.trim(),
        engineerOrPM: engineerOrPM.trim(),
        advancePaymentPercent: advancePaymentPercent === "" ? undefined : Number(advancePaymentPercent),
        retentionPercent: retentionPercent === "" ? undefined : Number(retentionPercent),
        performanceSecurityPercent: performanceSecurityPercent === "" ? undefined : Number(performanceSecurityPercent),
        delayDamagesPerDay: delayDamagesPerDay === "" ? undefined : Number(delayDamagesPerDay),
        attachments,
        projectName
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save contract record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                <Scale className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {isEditing ? "Edit Contract Agreement" : "Register New Contract Agreement"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Project: <strong className="text-slate-700 dark:text-slate-300">{projectName}</strong> (ID: {projectId})
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Core Identifiers */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
              <FileCheck className="w-4 h-4 text-blue-500" />
              <span>1. Contract Identification & Parties</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contract Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  placeholder="e.g. CON-2024-001"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contract Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contractTitle}
                  onChange={(e) => setContractTitle(e.target.value)}
                  placeholder="e.g. Main Civil & Structural Works Agreement"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Client / Employer <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="e.g. Ministry of Transport / Port Authority"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contractor / JV Entity <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contractor}
                  onChange={(e) => setContractor(e.target.value)}
                  placeholder="e.g. Project Matrix Construction JV"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contract Type / Suite <span className="text-rose-500">*</span>
                </label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {CONTRACT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ContractStatus)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Financial & Commercial Parameters */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>2. Commercial Value & Currency</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contract Value <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={contractValue}
                    onChange={(e) => setContractValue(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 50000000"
                    className="w-full pl-3.5 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Currency <span className="text-rose-500">*</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {SUPPORTED_CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} - {curr.name} ({curr.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Engineer / PM Representative
                </label>
                <input
                  type="text"
                  value={engineerOrPM}
                  onChange={(e) => setEngineerOrPM(e.target.value)}
                  placeholder="e.g. Lead Supervising Consultant"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Time for Completion & Dates */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>3. Start & Completion Timeline</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date (Commencement) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Completion Date (Time for Completion) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Supporting Contract Documents & Attachments */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
              <Paperclip className="w-4 h-4 text-purple-500" />
              <span>4. Supporting Contract Documents & Attachments ({attachments.length})</span>
            </h4>

            {/* Drag and Drop Zone */}
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-center bg-slate-50/50 dark:bg-slate-850/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xlsx,.dwg,.zip"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-7 h-7 text-blue-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Click to browse or drag & drop signed contract files
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports PDF, DOCX, XLSX, DWG, scans (Letter of Acceptance, Particular Conditions, Form of Agreement, Securities)
              </p>
            </div>

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{att.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(att.size)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Scope & Contract Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>5. Scope of Works & Contract Description (Optional)</span>
            </h4>

            <div>
              <textarea
                rows={3}
                value={scopeOfWorks}
                onChange={(e) => setScopeOfWorks(e.target.value)}
                placeholder="Describe key work packages, milestone handovers, and scope definitions..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

        </form>

        {/* Modal Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? "Saving..." : isEditing ? "Update Contract" : "Save Contract"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
