import { assertOperationalAction } from "../../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import {
  Upload,
  Plus,
  Building2,
  ShieldCheck,
  Search,
  ChevronRight,
  Eye,
  Paperclip,
  Trash2,
  Edit2
} from "lucide-react";
import {
  SupplierInvoiceRecord,
  SourceProvenance,
  CommercialSupportingDocument
} from "../../../types/commercialWorkspace";
import { formatCurrency as formatCentralCurrency } from "../../../utils/currency";
import { CommercialSupportingDocumentsDrawer } from "../CommercialSupportingDocumentsDrawer";
import { CommercialRecordModal } from "../CommercialRecordModal";
import { CommercialRowActions } from "../CommercialRowActions";
import { CommercialRecordDetailModal } from "../CommercialRecordDetailModal";
import { CommercialWorkspaceService } from "../../../services/commercialWorkspaceService";

interface CommercialSupplierAccountsViewProps {
  invoices: SupplierInvoiceRecord[];
  currency: string;
  projectId?: string;
  companyId?: string;
  onOpenUpload: (category?: "SUPPLIER_INVOICE" | "SUBCONTRACT") => void;
  onInspectSource: (title: string, value: any, source?: SourceProvenance, fieldName?: string) => void;
  onUpdateInvoice?: (inv: SupplierInvoiceRecord) => void;
  onRefreshData?: () => void;
}

export const CommercialSupplierAccountsView: React.FC<CommercialSupplierAccountsViewProps> = ({
  invoices,
  currency = "USD",
  projectId,
  companyId = "default_company",
  onOpenUpload,
  onInspectSource,
  onUpdateInvoice,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"ALL" | "POSTED" | "PAID" | "PENDING_PAYMENT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected for View / Detail
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoiceRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal State for Add / Edit
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SupplierInvoiceRecord | null>(null);

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

  const totalGross = useMemo(
    () => (invoices.length > 0 ? invoices.reduce((acc, i) => acc + (i.amount || 0), 0) : null),
    [invoices]
  );
  const totalPaid = useMemo(
    () => (invoices.length > 0 ? invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0) : null),
    [invoices]
  );
  const totalOutstanding =
    totalGross !== null && totalPaid !== null ? Math.max(0, totalGross - totalPaid) : null;

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase();
      const matches =
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q) ||
        (inv.poReference && inv.poReference.toLowerCase().includes(q)) ||
        (inv.costCode && inv.costCode.toLowerCase().includes(q)) ||
        (inv.description && inv.description.toLowerCase().includes(q));

      if (!matches) return false;

      if (activeSubTab === "PAID") return (inv.paidAmount || 0) >= (inv.amount || 0);
      if (activeSubTab === "PENDING_PAYMENT") return (inv.paidAmount || 0) < (inv.amount || 0);
      if (activeSubTab === "POSTED") return inv.status === "Posted" || inv.status === "Approved";
      return true;
    });
  }, [invoices, searchQuery, activeSubTab]);

  // Actions Handlers
  const handleAddNew = () => {
    assertOperationalAction("create", "components/commercial/views/CommercialSupplierAccountsView.tsx");
    setEditingInvoice(null);
    setIsRecordModalOpen(true);
  };

  const handleEdit = (inv: SupplierInvoiceRecord) => {
    setEditingInvoice(inv);
    setIsRecordModalOpen(true);
  };

  const handleView = (inv: SupplierInvoiceRecord) => {
    setSelectedInvoice(inv);
    setIsDetailOpen(true);
  };

  const handleSaveRecord = async (formData: any) => {
    assertOperationalAction("write", "components/commercial/views/CommercialSupplierAccountsView.tsx");
    const totAmount = Number(formData.total || formData.amount || formData.net || 0);
    const paidAmt = formData.paidAmount !== undefined ? Number(formData.paidAmount) : (editingInvoice?.paid || editingInvoice?.paidAmount || 0);
    const itemToSave: SupplierInvoiceRecord = {
      id: editingInvoice?.id || `sinv-${Date.now()}`,
      companyId: companyId || "default_company",
      projectId: projectId || "all",
      invoiceNumber: formData.reference || editingInvoice?.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier: formData.supplier || editingInvoice?.supplier || editingInvoice?.supplierName || "Trade Supplier",
      supplierName: formData.supplier || editingInvoice?.supplierName || "Trade Supplier",
      date: formData.date || new Date().toISOString().split("T")[0],
      issueDate: formData.date || new Date().toISOString().split("T")[0],
      dueDate: formData.date || new Date().toISOString().split("T")[0],
      net: Number(formData.net || totAmount),
      tax: Number(formData.tax || 0),
      total: totAmount,
      amount: totAmount,
      paid: paidAmt,
      paidAmount: paidAmt,
      outstanding: Math.max(0, totAmount - paidAmt),
      currency: currency || "USD",
      status: formData.status || "Posted",
      poReference: formData.invoiceNumber || editingInvoice?.poReference || undefined,
      costCode: formData.costCode || editingInvoice?.costCode || undefined,
      description: formData.description || editingInvoice?.description || undefined,
      documents: formData.documents || editingInvoice?.documents || [],
      notes: formData.notes || undefined,
      source: {
        originalFilename: "Manual Entry",
        uploadDate: new Date().toISOString(),
        uploadedBy: "Authorized User",
        importStatus: "MANUAL_ENTRY",
        approvalStatus: "APPROVED"
      }
    };

    await CommercialWorkspaceService.saveSupplierInvoice(companyId, projectId, itemToSave);
    setIsRecordModalOpen(false);
    setEditingInvoice(null);
    if (onRefreshData) onRefreshData();
    if (onUpdateInvoice) onUpdateInvoice(itemToSave);
  };

  const handleDelete = async (invId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialSupplierAccountsView.tsx");
    await CommercialWorkspaceService.deleteSupplierInvoice(companyId, projectId, invId);
    if (selectedInvoice?.id === invId) {
      setIsDetailOpen(false);
      setSelectedInvoice(null);
    }
    if (onRefreshData) onRefreshData();
  };

  const handleManageAttachments = (inv: SupplierInvoiceRecord) => {
    setActiveDocRecord({
      id: inv.id,
      title: `Invoice ${inv.invoiceNumber} - ${inv.supplierName}`,
      ref: inv.invoiceNumber,
      docs: inv.documents || []
    });
  };

  const handleAddAttachment = async (newDoc: CommercialSupportingDocument) => {
    assertOperationalAction("create", "components/commercial/views/CommercialSupplierAccountsView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.addAttachmentToRecord(
      companyId,
      projectId,
      "SUPPLIER_INVOICE",
      activeDocRecord.id,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: [...prev.docs, newDoc] } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteAttachment = async (docId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialSupplierAccountsView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.deleteAttachmentFromRecord(
      companyId,
      projectId,
      "SUPPLIER_INVOICE",
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
      "SUPPLIER_INVOICE",
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
            <span className="text-slate-900 dark:text-white font-bold">Supplier Accounts</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Supplier & Subcontractor Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Accounts payable ledgers, approved trade invoices, payment certifications, and bank disbursement receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenUpload("SUPPLIER_INVOICE")}
            className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            Upload File
          </button>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            Add New Invoice / Bill
          </button>
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {(["ALL", "POSTED", "PENDING_PAYMENT", "PAID"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-3.5 transition-all cursor-pointer relative ${
              activeSubTab === tab
                ? "text-amber-600 dark:text-amber-500 font-extrabold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab === "ALL" && `All Supplier Invoices (${invoices.length})`}
            {tab === "POSTED" && "Approved & Posted"}
            {tab === "PENDING_PAYMENT" && "Due for Payment"}
            {tab === "PAID" && "Verified Disbursed"}
            {activeSubTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 3. Verified KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        <div
          onClick={() => onInspectSource("Total Billed", totalGross, invoices[0]?.source, "amount")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Total Invoiced</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalGross)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Approved Payables</span>
        </div>

        <div
          onClick={() => onInspectSource("Total Disbursed", totalPaid, invoices[0]?.source, "paidAmount")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-emerald-600 block truncate">Verified Disbursed</span>
          <span className="text-base font-extrabold text-emerald-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalPaid)}
          </span>
          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">Proof of Payment Attached</span>
        </div>

        <div
          onClick={() => onInspectSource("Pending Payables", totalOutstanding, invoices[0]?.source, "outstanding")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-rose-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-rose-600 block truncate">Outstanding Balance</span>
          <span className="text-base font-extrabold text-rose-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalOutstanding)}
          </span>
          <span className="text-[10px] font-bold text-rose-600 block mt-0.5">Due to Suppliers</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Total Invoices</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {invoices.length} Verified Bills
          </span>
          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">Audit Trail Active</span>
        </div>
      </div>

      {/* 4. Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search invoice #, supplier, PO ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Click any row or action menu to view, edit, or manage supporting invoices</span>
        </div>
      </div>

      {/* 5. Invoices Table Register */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Invoice #</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Issue Date</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Due Date</th>
                <th className="py-2.5 px-3 min-w-[150px] max-w-[220px] overflow-hidden text-ellipsis truncate">Supplier / Trade</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">PO / Subcontract Ref</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Gross Total</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Paid</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Balance</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Status</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Evidence</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-visible">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 text-xs truncate overflow-hidden">
                    No supplier invoices found. Click "Add New Invoice / Bill" to record one.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const gross = inv.amount || 0;
                  const paid = inv.paidAmount || 0;
                  const bal = Math.max(0, gross - paid);

                  return (
                    <tr
                      key={inv.id || inv.invoiceNumber}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => handleView(inv)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap truncate overflow-hidden">
                        {inv.issueDate}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap truncate overflow-hidden">
                        {inv.dueDate}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white truncate overflow-hidden max-w-[220px]" title={inv.supplierName}>
                        {inv.supplierName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap truncate overflow-hidden">
                        {inv.poReference || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">
                        {formatCurrency(gross)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold whitespace-nowrap truncate overflow-hidden">
                        {formatCurrency(paid)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-semibold whitespace-nowrap truncate overflow-hidden">
                        {formatCurrency(bal)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap truncate overflow-hidden">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                            inv.status === "Approved" || inv.status === "Paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-3 text-center whitespace-nowrap truncate overflow-hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageAttachments(inv);
                        }}
                      >
                        <button className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                          <Paperclip className="w-3 h-3 text-amber-600" />
                          <span>{inv.documents?.length || 0}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap overflow-visible" onClick={(e) => e.stopPropagation()}>
                        <CommercialRowActions
                          onView={() => handleView(inv)}
                          onEdit={() => handleEdit(inv)}
                          onDelete={() => handleDelete(inv.id)}
                          onManageAttachments={() => handleManageAttachments(inv)}
                          recordTitle={`Invoice ${inv.invoiceNumber}`}
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
          setEditingInvoice(null);
        }}
        recordType="SUPPLIER_INVOICE"
        mode={editingInvoice ? "EDIT" : "CREATE"}
        initialData={editingInvoice ? {
          reference: editingInvoice.invoiceNumber,
          date: editingInvoice.issueDate,
          supplier: editingInvoice.supplierName,
          invoiceNumber: editingInvoice.poReference,
          costCode: editingInvoice.costCode,
          description: editingInvoice.description,
          total: editingInvoice.amount,
          paidAmount: editingInvoice.paidAmount,
          status: editingInvoice.status,
          documents: editingInvoice.documents,
          notes: editingInvoice.notes
        } : undefined}
        currency={currency}
        onSave={handleSaveRecord}
      />

      {/* 7. Standardized Record Detail Modal */}
      {selectedInvoice && (
        <CommercialRecordDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedInvoice(null);
          }}
          recordType="SUPPLIER_INVOICE"
          record={selectedInvoice}
          currency={currency}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedInvoice);
          }}
          onDelete={() => handleDelete(selectedInvoice.id)}
          onManageAttachments={() => {
            setIsDetailOpen(false);
            handleManageAttachments(selectedInvoice);
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
