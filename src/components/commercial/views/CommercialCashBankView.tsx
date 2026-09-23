import { assertOperationalAction } from "../../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import {
  Upload,
  Plus,
  Landmark,
  ShieldCheck,
  Search,
  ChevronRight,
  Eye,
  Paperclip,
  Trash2,
  Edit2,
  ArrowDownLeft,
  ArrowUpRight
} from "lucide-react";
import {
  BankTransactionRecord,
  SourceProvenance,
  CommercialSupportingDocument
} from "../../../types/commercialWorkspace";
import { formatCurrency as formatCentralCurrency } from "../../../utils/currency";
import { CommercialSupportingDocumentsDrawer } from "../CommercialSupportingDocumentsDrawer";
import { CommercialRecordModal } from "../CommercialRecordModal";
import { CommercialRowActions } from "../CommercialRowActions";
import { CommercialRecordDetailModal } from "../CommercialRecordDetailModal";
import { CommercialWorkspaceService } from "../../../services/commercialWorkspaceService";

interface CommercialCashBankViewProps {
  transactions: BankTransactionRecord[];
  currency: string;
  projectId?: string;
  companyId?: string;
  onOpenUpload: (category?: "BANK_TRANSACTION") => void;
  onInspectSource: (title: string, value: any, source?: SourceProvenance, fieldName?: string) => void;
  onReconcileTransaction?: (id: string, matchedRecordRef: string) => void;
  onRefreshData?: () => void;
}

export const CommercialCashBankView: React.FC<CommercialCashBankViewProps> = ({
  transactions,
  currency = "USD",
  projectId,
  companyId = "default_company",
  onOpenUpload,
  onInspectSource,
  onReconcileTransaction,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"ALL" | "INFLOWS" | "OUTFLOWS" | "RECONCILED" | "UNRECONCILED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected for View / Detail
  const [selectedTx, setSelectedTx] = useState<BankTransactionRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal State for Add / Edit
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<BankTransactionRecord | null>(null);

  // Document Drawer State
  const [activeDocRecord, setActiveDocRecord] = useState<{
    id: string;
    title: string;
    ref?: string;
    docs: CommercialSupportingDocument[];
  } | null>(null);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return formatCentralCurrency(val, currency);
  };

  const totalInflows = useMemo(
    () =>
      transactions.length > 0
        ? transactions.filter((t) => t.type === "Inflow").reduce((acc, t) => acc + (t.amount || 0), 0)
        : null,
    [transactions]
  );
  const totalOutflows = useMemo(
    () =>
      transactions.length > 0
        ? transactions.filter((t) => t.type === "Outflow").reduce((acc, t) => acc + (t.amount || 0), 0)
        : null,
    [transactions]
  );
  const netCashflow = totalInflows !== null && totalOutflows !== null ? totalInflows - totalOutflows : null;
  const reconciledCount = transactions.filter((t) => t.reconciled).length;
  const unreconciledCount = transactions.length - reconciledCount;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matches =
        t.transactionRef.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.matchedRecordRef && t.matchedRecordRef.toLowerCase().includes(q)) ||
        (t.payeeOrPayer && t.payeeOrPayer.toLowerCase().includes(q)) ||
        (t.accountName && t.accountName.toLowerCase().includes(q));

      if (!matches) return false;

      if (activeSubTab === "INFLOWS") return t.type === "Inflow";
      if (activeSubTab === "OUTFLOWS") return t.type === "Outflow";
      if (activeSubTab === "RECONCILED") return t.reconciled;
      if (activeSubTab === "UNRECONCILED") return !t.reconciled;
      return true;
    });
  }, [transactions, searchQuery, activeSubTab]);

  // Actions Handlers
  const handleAddNew = () => {
    assertOperationalAction("create", "components/commercial/views/CommercialCashBankView.tsx");
    setEditingTx(null);
    setIsRecordModalOpen(true);
  };

  const handleEdit = (tx: BankTransactionRecord) => {
    setEditingTx(tx);
    setIsRecordModalOpen(true);
  };

  const handleView = (tx: BankTransactionRecord) => {
    setSelectedTx(tx);
    setIsDetailOpen(true);
  };

  const handleSaveRecord = async (formData: any) => {
    assertOperationalAction("write", "components/commercial/views/CommercialCashBankView.tsx");
    const totAmount = Number(formData.total || formData.amount || formData.net || 0);
    const isInflow = formData.type === "Inflow" || formData.category === "Inflow";
    const itemToSave: BankTransactionRecord = {
      id: editingTx?.id || `bank-${Date.now()}`,
      companyId: companyId || "default_company",
      projectId: projectId,
      bankAccountId: editingTx?.bankAccountId || "acc-main-01",
      accountName: editingTx?.accountName || "Main Operations Account",
      date: formData.date || new Date().toISOString().split("T")[0],
      transactionType: isInflow ? "Receipt" : "Payment",
      type: isInflow ? "Inflow" : "Outflow",
      reference: formData.reference || editingTx?.reference || editingTx?.transactionRef || `BNK-${Math.floor(1000 + Math.random() * 9000)}`,
      transactionRef: formData.reference || editingTx?.transactionRef || `BNK-${Math.floor(1000 + Math.random() * 9000)}`,
      payeeOrPayer: formData.supplier || editingTx?.payeeOrPayer || "Bank Operations",
      description: formData.description || "Bank Movement",
      inflow: isInflow ? totAmount : null,
      outflow: isInflow ? null : totAmount,
      amount: totAmount,
      balanceAfter: editingTx?.balanceAfter || null,
      status: formData.status === "Reconciled" ? "Reconciled" : "Unreconciled",
      reconciled: formData.status === "Reconciled" || editingTx?.reconciled || false,
      currency: currency || "USD",
      matchedRecordRef: formData.invoiceNumber || editingTx?.matchedRecordRef || undefined,
      documents: formData.documents || editingTx?.documents || [],
      notes: formData.notes || undefined,
      source: {
        originalFilename: "Manual Entry",
        uploadDate: new Date().toISOString(),
        uploadedBy: "Authorized User",
        importStatus: "MANUAL_ENTRY",
        approvalStatus: "APPROVED"
      }
    };

    await CommercialWorkspaceService.saveBankTransaction(companyId, projectId, itemToSave);
    setIsRecordModalOpen(false);
    setEditingTx(null);
    if (onRefreshData) onRefreshData();
  };

  const handleDelete = async (txId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialCashBankView.tsx");
    await CommercialWorkspaceService.deleteBankTransaction(companyId, projectId, txId);
    if (selectedTx?.id === txId) {
      setIsDetailOpen(false);
      setSelectedTx(null);
    }
    if (onRefreshData) onRefreshData();
  };

  const handleManageAttachments = (tx: BankTransactionRecord) => {
    setActiveDocRecord({
      id: tx.id,
      title: `Bank Movement ${tx.transactionRef} - ${tx.description}`,
      ref: tx.transactionRef,
      docs: tx.documents || []
    });
  };

  const handleAddAttachment = async (newDoc: CommercialSupportingDocument) => {
    assertOperationalAction("create", "components/commercial/views/CommercialCashBankView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.addAttachmentToRecord(
      companyId,
      projectId,
      "BANK_TRANSACTION",
      activeDocRecord.id,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: [...prev.docs, newDoc] } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteAttachment = async (docId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialCashBankView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.deleteAttachmentFromRecord(
      companyId,
      projectId,
      "BANK_TRANSACTION",
      activeDocRecord.id,
      docId
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: prev.docs.filter((d) => d.id !== docId) } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleReplaceAttachment = async (docId: string, newDoc: CommercialSupportingDocument) => {
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.replaceAttachmentInRecord(
      companyId,
      projectId,
      "BANK_TRANSACTION",
      activeDocRecord.id,
      docId,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: prev.docs.map((d) => (d.id === docId ? newDoc : d)) } : null));
    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="controls-page-container overflow-hidden max-w-full space-y-6">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
            <span>Commercial</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 dark:text-white font-bold">Cash & Bank</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Cash & Bank Reconciliation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified bank statement lines, customer deposits, subcontractor disbursements, and 2-way journal matching.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenUpload("BANK_TRANSACTION")}
            className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            Upload Bank Statement
          </button>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            Record Bank Movement
          </button>
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {(["ALL", "INFLOWS", "OUTFLOWS", "RECONCILED", "UNRECONCILED"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-3.5 transition-all cursor-pointer relative ${
              activeSubTab === tab
                ? "text-amber-600 dark:text-amber-500 font-extrabold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab === "ALL" && `All Bank Lines (${transactions.length})`}
            {tab === "INFLOWS" && "Cash Receipts"}
            {tab === "OUTFLOWS" && "Disbursements"}
            {tab === "RECONCILED" && `Reconciled (${reconciledCount})`}
            {tab === "UNRECONCILED" && `Unreconciled (${unreconciledCount})`}
            {activeSubTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 3. Verified KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        <div
          onClick={() => onInspectSource("Total Receipts", totalInflows, transactions[0]?.source, "amount")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-emerald-600 block truncate">Total Inflows</span>
          <span className="text-base font-extrabold text-emerald-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalInflows)}
          </span>
          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">Verified Deposits</span>
        </div>

        <div
          onClick={() => onInspectSource("Total Disbursements", totalOutflows, transactions[0]?.source, "amount")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-rose-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-rose-600 block truncate">Total Outflows</span>
          <span className="text-base font-extrabold text-rose-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalOutflows)}
          </span>
          <span className="text-[10px] font-bold text-rose-600 block mt-0.5">Verified Payments</span>
        </div>

        <div
          onClick={() => onInspectSource("Net Cash Position", netCashflow, transactions[0]?.source, "netCashflow")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Net Cashflow</span>
          <span
            className={`text-base font-extrabold block mt-1 tracking-tight truncate ${
              (netCashflow || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {formatCurrency(netCashflow)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Net Liquid Balance</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Reconciliation Status</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {reconciledCount} / {transactions.length} Matched
          </span>
          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">
            {unreconciledCount === 0 ? "All Reconciled" : `${unreconciledCount} Unmatched`}
          </span>
        </div>
      </div>

      {/* 4. Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search bank ref, description, counterparty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Click any row or action menu to view, edit, or manage supporting payment confirmations</span>
        </div>
      </div>

      {/* 5. Bank Transactions Table Register */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-3 whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Bank Ref</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Date</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Type</th>
                <th className="py-2.5 px-3 min-w-[160px] max-w-[240px] overflow-hidden text-ellipsis truncate">Description</th>
                <th className="py-2.5 px-3 min-w-[130px] max-w-[180px] overflow-hidden text-ellipsis truncate">Counterparty</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Amount</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Matched Reference</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Status</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Evidence</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-visible">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs truncate overflow-hidden">
                    No bank transactions found. Click "Record Bank Movement" to add one.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isInflow = tx.type === "Inflow";

                  return (
                    <tr
                      key={tx.id || tx.transactionRef}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => handleView(tx)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">
                        {tx.transactionRef}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap truncate overflow-hidden">
                        {tx.date}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap truncate overflow-hidden">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            isInflow
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                          }`}
                        >
                          {isInflow ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 truncate overflow-hidden max-w-[240px]" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 truncate overflow-hidden max-w-[180px]" title={tx.payeeOrPayer}>
                        {tx.payeeOrPayer || "—"}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap truncate overflow-hidden ${
                          isInflow ? "text-emerald-600" : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {isInflow ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap truncate overflow-hidden">
                        {tx.matchedRecordRef || "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap truncate overflow-hidden">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                            tx.reconciled
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {tx.reconciled ? "Reconciled" : "Pending"}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-3 text-center whitespace-nowrap truncate overflow-hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageAttachments(tx);
                        }}
                      >
                        <button className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                          <Paperclip className="w-3 h-3 text-amber-600" />
                          <span>{tx.documents?.length || 0}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap overflow-visible" onClick={(e) => e.stopPropagation()}>
                        <CommercialRowActions
                          onView={() => handleView(tx)}
                          onEdit={() => handleEdit(tx)}
                          onDelete={() => handleDelete(tx.id)}
                          onManageAttachments={() => handleManageAttachments(tx)}
                          recordTitle={`Transaction ${tx.transactionRef}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Standardized Add / Edit Record Modal */}
      <CommercialRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingTx(null);
        }}
        recordType="BANK_TRANSACTION"
        mode={editingTx ? "EDIT" : "CREATE"}
        initialData={editingTx ? {
          reference: editingTx.transactionRef,
          date: editingTx.date,
          type: editingTx.type,
          supplier: editingTx.payeeOrPayer,
          invoiceNumber: editingTx.matchedRecordRef,
          description: editingTx.description,
          total: editingTx.amount,
          status: editingTx.reconciled ? "Reconciled" : "Pending",
          documents: editingTx.documents,
          notes: editingTx.notes
        } : undefined}
        currency={currency}
        onSave={handleSaveRecord}
      />

      {/* 7. Standardized Record Detail Modal */}
      {selectedTx && (
        <CommercialRecordDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedTx(null);
          }}
          recordType="BANK_TRANSACTION"
          record={selectedTx}
          currency={currency}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedTx);
          }}
          onDelete={() => handleDelete(selectedTx.id)}
          onManageAttachments={() => {
            setIsDetailOpen(false);
            handleManageAttachments(selectedTx);
          }}
        />
      )}

      {/* 8. Supporting Documents Drawer */}
      {activeDocRecord && (
        <CommercialSupportingDocumentsDrawer
          isOpen={!!activeDocRecord}
          onClose={() => setActiveDocRecord(null)}
          recordTitle={activeDocRecord.title}
          recordRef={activeDocRecord.ref}
          documents={activeDocRecord.docs}
          onAddDocument={handleAddAttachment}
          onDeleteDocument={handleDeleteAttachment}
          onReplaceDocument={handleReplaceAttachment}
        />
      )}

    </div>
  );
};
