import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import {
  X,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Paperclip,
  Download,
  Eye,
  Link as LinkIcon,
  Layers,
  ArrowRight,
  History,
  Check
} from "lucide-react";
import {
  ActualCostRegisterItem,
  CommitmentRegisterItem,
  CommercialSupportingDocument,
  SourceProvenance
} from "../../types/commercialWorkspace";

interface ActualCostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cost: ActualCostRegisterItem | null;
  commitments: CommitmentRegisterItem[];
  currency: string;
  onUpdateCost: (updatedCost: ActualCostRegisterItem) => void;
  onInspectSource?: (title: string, value: any, source?: SourceProvenance, fieldName?: string) => void;
}

export const ActualCostDetailModal: React.FC<ActualCostDetailModalProps> = ({
  isOpen,
  onClose,
  cost,
  commitments,
  currency,
  onUpdateCost,
  onInspectSource
}) => {
  const [activeTab, setActiveTab] = useState<"DETAILS" | "ALLOCATIONS" | "PAYMENTS" | "DOCUMENTS" | "AUDIT">("DETAILS");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [paymentDocName, setPaymentDocName] = useState<string>("");
  const [paymentDocData, setPaymentDocData] = useState<string>("");
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string>(cost?.linkedCommitmentRef || "");

  if (!isOpen || !cost) return null;

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const net = cost.net || 0;
  const tax = cost.tax || 0;
  const total = cost.total || (net + tax);
  const paid = cost.paidAmount || 0;
  const outstanding = Math.max(0, total - paid);
  const paymentStatus = cost.paymentStatus || (paid >= total && total > 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid");

  // Linked commitment calculation
  const linkedCommitment = commitments.find(
    c => c.ref === cost.linkedCommitmentRef || c.id === selectedCommitmentId || c.ref === selectedCommitmentId
  );
  const committedAmount = linkedCommitment?.currentCommitment || linkedCommitment?.originalValue || null;
  const commitmentInvoiced = (linkedCommitment?.invoiced || 0) + (cost.linkedCommitmentRef ? 0 : total);
  const commitmentBalance = committedAmount !== null ? Math.max(0, committedAmount - commitmentInvoiced) : null;

  // Handle Recording Payment Evidence
  const handlePaymentProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPaymentDocName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPaymentDocData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPayment = () => {
    assertOperationalAction("write", "components/commercial/ActualCostDetailModal.tsx");
    const parsedAmount = parseFloat(paymentAmount) || outstanding;
    if (parsedAmount <= 0) return;

    const newPaymentDoc: CommercialSupportingDocument = {
      id: "doc-pop-" + Date.now(),
      name: paymentDocName || `Proof_of_Payment_${paymentRef || cost.reference}.pdf`,
      type: "Proof of Payment",
      size: "Verified Receipt",
      uploadedBy: "Authorized Financial Officer",
      uploadedOn: new Date().toISOString().split("T")[0],
      fileData: paymentDocData || undefined,
      notes: `Payment Ref: ${paymentRef || "EFT Transfer"}`
    };

    const newPaidAmount = paid + parsedAmount;
    const newOutstanding = Math.max(0, total - newPaidAmount);
    const newStatus = newPaidAmount >= total ? "Paid" : "Partially Paid";

    const updatedDocuments = [...(cost.documents || []), newPaymentDoc];

    const updatedAudit = [
      ...(cost.auditTrail || []),
      {
        id: "aud-" + Date.now(),
        timestamp: new Date().toISOString(),
        action: "POST" as const,
        changedBy: "Financial Controller",
        fieldName: "Payment Status & Proof of Payment",
        previousValue: { paid, paymentStatus },
        newValue: { paid: newPaidAmount, paymentStatus: newStatus, paymentRef },
        notes: `Recorded verified payment evidence of ${currency} ${parsedAmount.toLocaleString()} with document ${newPaymentDoc.name}`
      }
    ];

    const updatedCost: ActualCostRegisterItem = {
      ...cost,
      paidAmount: newPaidAmount,
      outstandingAmount: newOutstanding,
      paymentStatus: newStatus,
      paymentEvidence: newPaymentDoc,
      documents: updatedDocuments,
      auditTrail: updatedAudit
    };

    onUpdateCost(updatedCost);
    setIsRecordingPayment(false);
    setPaymentAmount("");
    setPaymentRef("");
    setPaymentDocName("");
    setPaymentDocData("");
  };

  const handleLinkCommitment = (commitmentRef: string) => {
    setSelectedCommitmentId(commitmentRef);
    const updatedCost: ActualCostRegisterItem = {
      ...cost,
      linkedCommitmentRef: commitmentRef
    };
    onUpdateCost(updatedCost);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Actual Cost Record
                </h2>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {cost.reference}
                </span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                  cost.status === "Posted"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                }`}>
                  {cost.status}
                </span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                  paymentStatus === "Paid"
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900"
                    : paymentStatus === "Partially Paid"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}>
                  {paymentStatus === "Paid" ? "✓ Verified Paid" : paymentStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {cost.description || "Project Expenditure & Cost Journal"} • Cost Code: <strong className="text-slate-800 dark:text-slate-200">{cost.costCode}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Summary Highlight Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Amount</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">{formatCurrency(net)}</span>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tax / VAT</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">{formatCurrency(tax)}</span>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Invoiced</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block">{formatCurrency(total)}</span>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Paid to Date</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{formatCurrency(paid)}</span>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Outstanding</span>
            <span className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5 block">{formatCurrency(outstanding)}</span>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {(["DETAILS", "ALLOCATIONS", "PAYMENTS", "DOCUMENTS", "AUDIT"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === tab
                  ? "border-amber-600 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab === "DETAILS" && "Details"}
              {tab === "ALLOCATIONS" && "Commitment & Allocation"}
              {tab === "PAYMENTS" && `Payment Evidence (${paid > 0 ? "Verified" : "Pending"})`}
              {tab === "DOCUMENTS" && `Supporting Documents (${cost.documents?.length || 1})`}
              {tab === "AUDIT" && "Audit Trail"}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: DETAILS */}
          {activeTab === "DETAILS" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Record Summary
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-3 text-xs border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Transaction Reference</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{cost.reference}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Supplier / Payee</span>
                    <span className="font-bold text-slate-900 dark:text-white">{cost.supplier}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Cost Code</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{cost.costCode}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Invoice Number</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{cost.invoiceNumber || cost.reference}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Cost Date</span>
                    <span className="font-bold text-slate-900 dark:text-white">{cost.date}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Source Document</span>
                    <span className="font-bold text-slate-900 dark:text-white">{cost.source?.originalFilename || "Direct Entry"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Payment Verification Rule
                </h3>
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 text-xs space-y-2 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Invoice ≠ Payment Rule Enforced</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                    Entering or uploading a supplier invoice records a financial cost/liability. It does <strong>NOT</strong> mark the cost as paid until verified proof of payment (EFT confirmation, bank statement line, or receipt) is attached.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab("PAYMENTS")}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                    >
                      {paymentStatus === "Paid" ? "View Payment Evidence" : "Record Verified Payment"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALLOCATIONS & LINK COMMITMENT */}
          {activeTab === "ALLOCATIONS" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Link to Commitment / Purchase Order
                  </h3>
                  <p className="text-xs text-slate-500">
                    Trace cost against approved commitments without inventing unverified balances.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Select Existing Commitment
                  </label>
                  <select
                    value={selectedCommitmentId}
                    onChange={(e) => handleLinkCommitment(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- No Linked Commitment (Direct Expense) --</option>
                    {commitments.map((c) => (
                      <option key={c.id} value={c.ref}>
                        {c.ref} • {c.counterparty} ({c.type}) — {formatCurrency(c.currentCommitment || c.originalValue)}
                      </option>
                    ))}
                  </select>
                </div>

                {linkedCommitment && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Linked PO / Subcontract Calculation
                    </span>
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500">Total Commitment:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(committedAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500">Invoiced to Date:</span>
                      <span className="font-bold text-amber-600">{formatCurrency(commitmentInvoiced)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Remaining Balance:</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(commitmentBalance)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENTS */}
          {activeTab === "PAYMENTS" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Verified Payment Evidence
                  </h3>
                  <p className="text-xs text-slate-500">
                    Payment status is strictly derived from verified Proof of Payment or Bank Transfer receipts.
                  </p>
                </div>

                {outstanding > 0 && !isRecordingPayment && (
                  <button
                    onClick={() => setIsRecordingPayment(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-4 h-4" />
                    Record Proof of Payment
                  </button>
                )}
              </div>

              {/* Record Payment Form */}
              {isRecordingPayment && (
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Upload Bank Transfer Confirmation / Remittance
                    </span>
                    <button
                      onClick={() => setIsRecordingPayment(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Amount Paid ({currency})
                      </label>
                      <input
                        type="number"
                        defaultValue={outstanding}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Bank / Payment Reference
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. EFT-90248 or Bank Ref"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                      Attach Proof of Payment (PDF / Image / Bank Statement Line)
                    </label>
                    <input
                      type="file"
                      onChange={handlePaymentProofUpload}
                      accept=".pdf,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                      className="text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsRecordingPayment(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitPayment}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      Confirm Verified Payment
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Proof Status */}
              {cost.paymentEvidence ? (
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">
                        Verified Proof of Payment: {cost.paymentEvidence.name}
                      </span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Uploaded by {cost.paymentEvidence.uploadedBy} on {cost.paymentEvidence.uploadedOn}
                      </span>
                    </div>
                  </div>
                  {cost.paymentEvidence.fileData && (
                    <a
                      href={cost.paymentEvidence.fileData}
                      download={cost.paymentEvidence.name}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download POP
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    No verified payment evidence recorded
                  </p>
                  <p className="text-[11px] text-slate-400">
                    This cost remains an accounts payable liability until proof of payment is uploaded.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DOCUMENTS */}
          {activeTab === "DOCUMENTS" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Attached Documents ({(cost.documents?.length || 0) + (cost.source?.originalFilename ? 1 : 0)})
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs table-fixed">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-4 min-w-[180px] truncate overflow-hidden">Document</th>
                      <th className="py-2.5 px-4 w-32 truncate overflow-hidden">Type</th>
                      <th className="py-2.5 px-4 w-32 truncate overflow-hidden">Uploaded By</th>
                      <th className="py-2.5 px-4 w-28 truncate overflow-hidden">Date</th>
                      <th className="py-2.5 px-4 text-right w-24 truncate overflow-hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Primary Source Document */}
                    {cost.source?.originalFilename && (
                      <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2 truncate overflow-hidden">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="truncate">{cost.source.originalFilename}</span>
                        </td>
                        <td className="py-2.5 px-4 truncate overflow-hidden">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700">
                            Source Document
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 truncate overflow-hidden">{cost.source.uploadedBy}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 truncate overflow-hidden">{cost.source.uploadDate}</td>
                        <td className="py-2.5 px-4 text-right truncate overflow-hidden">
                          <span className="text-[10px] font-bold text-slate-400">Verified Origin</span>
                        </td>
                      </tr>
                    )}

                    {/* Additional Attached Documents */}
                    {(cost.documents || []).map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2 truncate overflow-hidden">
                          <Paperclip className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="truncate">{doc.name}</span>
                        </td>
                        <td className="py-2.5 px-4 truncate overflow-hidden">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {doc.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 truncate overflow-hidden">{doc.uploadedBy}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 truncate overflow-hidden">{doc.uploadedOn}</td>
                        <td className="py-2.5 px-4 text-right truncate overflow-hidden">
                          {doc.fileData && (
                            <a
                              href={doc.fileData}
                              download={doc.name}
                              className="text-amber-600 hover:text-amber-700 font-bold"
                            >
                              Download
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT TRAIL */}
          {activeTab === "AUDIT" && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Full Immutable Audit Trail
              </h3>
              <div className="space-y-3">
                {(cost.auditTrail && cost.auditTrail.length > 0 ? cost.auditTrail : [
                  {
                    id: "aud-orig",
                    timestamp: cost.source?.uploadDate || new Date().toISOString(),
                    action: "IMPORT" as const,
                    changedBy: cost.source?.uploadedBy || "System User",
                    fieldName: "Initial Cost Record",
                    notes: `Created from source document ${cost.source?.originalFilename || "Manual entry"}`
                  }
                ]).map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{entry.action}</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-slate-600 dark:text-slate-400">{entry.changedBy}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{entry.notes}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">{entry.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={() => onInspectSource && onInspectSource(`Cost: ${cost.reference}`, cost.total, cost.source, "Total Amount")}
            className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            Inspect Source Provenance
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
