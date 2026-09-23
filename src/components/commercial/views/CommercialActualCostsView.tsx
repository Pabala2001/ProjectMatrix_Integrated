import { assertOperationalAction } from "../../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import {
  Upload,
  Plus,
  Download,
  FileText,
  ShieldCheck,
  Search,
  DollarSign,
  ChevronRight,
  Eye,
  Paperclip,
  Trash2,
  Edit2
} from "lucide-react";
import {
  ActualCostRegisterItem,
  CommitmentRegisterItem,
  SourceProvenance,
  CommercialSupportingDocument
} from "../../../types/commercialWorkspace";
import { formatCurrency as formatCentralCurrency } from "../../../utils/currency";
import { exportObjectsToCsv, CsvColumn } from "../../../utils/csvExport";
import { CommercialSupportingDocumentsDrawer } from "../CommercialSupportingDocumentsDrawer";
import { CommercialRecordModal } from "../CommercialRecordModal";
import { CommercialRowActions } from "../CommercialRowActions";
import { CommercialRecordDetailModal } from "../CommercialRecordDetailModal";
import { CommercialWorkspaceService } from "../../../services/commercialWorkspaceService";

interface CommercialActualCostsViewProps {
  actualCosts: ActualCostRegisterItem[];
  commitments?: CommitmentRegisterItem[];
  currency: string;
  projectId?: string;
  companyId?: string;
  onOpenUpload: (category?: "ACTUAL_COST" | "SUPPLIER_INVOICE") => void;
  onInspectSource: (title: string, value: any, source?: SourceProvenance, fieldName?: string) => void;
  onUpdateCost?: (cost: ActualCostRegisterItem) => void;
  onRefreshData?: () => void;
}

export const CommercialActualCostsView: React.FC<CommercialActualCostsViewProps> = ({
  actualCosts,
  commitments = [],
  currency = "USD",
  projectId,
  companyId = "default_company",
  onOpenUpload,
  onInspectSource,
  onUpdateCost,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"ALL" | "INVOICES" | "PAID" | "UNPAID">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected record for details/actions
  const [selectedCost, setSelectedCost] = useState<ActualCostRegisterItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal State for Add / Edit
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<ActualCostRegisterItem | null>(null);

  // Document Drawer State
  const [activeDocRecord, setActiveDocRecord] = useState<{
    id: string;
    title: string;
    ref?: string;
    docs: CommercialSupportingDocument[];
  } | null>(null);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    const normalizedCurrency = currency === "TSh" ? "TZS" : currency;
    return formatCentralCurrency(val, normalizedCurrency);
  };

  const totalNet = useMemo(
    () => (actualCosts.length > 0 ? actualCosts.reduce((acc, a) => acc + (a.net || 0), 0) : null),
    [actualCosts]
  );
  const totalTax = useMemo(
    () => (actualCosts.length > 0 ? actualCosts.reduce((acc, a) => acc + (a.tax || 0), 0) : null),
    [actualCosts]
  );
  const totalGross = useMemo(
    () => (actualCosts.length > 0 ? actualCosts.reduce((acc, a) => acc + (a.total ?? ((a.net || 0) + (a.tax || 0))), 0) : null),
    [actualCosts]
  );
  const totalPaid = useMemo(
    () => (actualCosts.length > 0 ? actualCosts.reduce((acc, a) => acc + (a.paidAmount || 0), 0) : null),
    [actualCosts]
  );
  const totalOutstanding = totalGross !== null && totalPaid !== null ? Math.max(0, totalGross - totalPaid) : null;

  const filteredCosts = useMemo(() => {
    return actualCosts.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.reference.toLowerCase().includes(q) ||
        c.supplier.toLowerCase().includes(q) ||
        c.costCode.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.invoiceNumber && c.invoiceNumber.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeSubTab === "INVOICES") {
        return c.sourceType.includes("Invoice") || !!c.invoiceNumber;
      }
      if (activeSubTab === "PAID") {
        return (c.paidAmount || 0) >= (c.total || 0) && (c.total || 0) > 0;
      }
      if (activeSubTab === "UNPAID") {
        return (c.paidAmount || 0) < (c.total || 0);
      }
      return true;
    });
  }, [actualCosts, searchQuery, activeSubTab]);

  const filteredNet = useMemo(() => filteredCosts.reduce((acc, c) => acc + (c.net || 0), 0), [filteredCosts]);
  const filteredTax = useMemo(() => filteredCosts.reduce((acc, c) => acc + (c.tax || 0), 0), [filteredCosts]);
  const filteredTotal = useMemo(() => filteredCosts.reduce((acc, c) => acc + (c.total ?? ((c.net || 0) + (c.tax || 0))), 0), [filteredCosts]);
  const filteredPaid = useMemo(() => filteredCosts.reduce((acc, c) => acc + (c.paidAmount || 0), 0), [filteredCosts]);
  const filteredOutstanding = Math.max(0, filteredTotal - filteredPaid);

  // Open "Add New"
  const handleAddNew = () => {
    assertOperationalAction("create", "components/commercial/views/CommercialActualCostsView.tsx");
    setEditingCost(null);
    setIsRecordModalOpen(true);
  };

  // Open "Edit"
  const handleEdit = (cost: ActualCostRegisterItem) => {
    setEditingCost(cost);
    setIsRecordModalOpen(true);
  };

  // Open "View"
  const handleView = (cost: ActualCostRegisterItem) => {
    setSelectedCost(cost);
    setIsDetailOpen(true);
  };

  // Save Record
  const handleSaveRecord = async (formData: any) => {
    assertOperationalAction("write", "components/commercial/views/CommercialActualCostsView.tsx");
    const costToSave: ActualCostRegisterItem = {
      id: editingCost?.id || `cost-${Date.now()}`,
      companyId: companyId || "default_company",
      projectId: projectId || "all",
      currency: currency || "USD",
      reference: formData.reference || editingCost?.reference || `CST-${Math.floor(1000 + Math.random() * 9000)}`,
      date: formData.date || new Date().toISOString().split("T")[0],
      supplier: formData.supplier || "Supplier",
      costCode: formData.costCode || "General",
      description: formData.description || "Actual Cost Item",
      invoiceNumber: formData.invoiceNumber || undefined,
      quantity: formData.quantity ? Number(formData.quantity) : undefined,
      unit: formData.unit || undefined,
      rate: formData.rate ? Number(formData.rate) : undefined,
      net: Number(formData.net || 0),
      tax: Number(formData.tax || 0),
      total: Number(formData.total || (Number(formData.net || 0) + Number(formData.tax || 0))),
      paidAmount: formData.paidAmount !== undefined ? Number(formData.paidAmount) : editingCost?.paidAmount || 0,
      status: formData.status || "Posted",
      sourceType: "Direct Expense",
      documents: formData.documents || editingCost?.documents || [],
      notes: formData.notes || undefined,
      source: {
        originalFilename: "Manual Entry",
        uploadDate: new Date().toISOString(),
        uploadedBy: "Authorized User",
        importStatus: "MANUAL_ENTRY",
        approvalStatus: "APPROVED"
      }
    };

    await CommercialWorkspaceService.saveActualCost(companyId, projectId, costToSave);
    setIsRecordModalOpen(false);
    setEditingCost(null);
    if (onRefreshData) onRefreshData();
    if (onUpdateCost) onUpdateCost(costToSave);
  };

  // Delete Record
  const handleDelete = async (costId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialActualCostsView.tsx");
    await CommercialWorkspaceService.deleteActualCost(companyId, projectId, costId);
    if (selectedCost?.id === costId) {
      setIsDetailOpen(false);
      setSelectedCost(null);
    }
    if (onRefreshData) onRefreshData();
  };

  // Open Manage Attachments
  const handleManageAttachments = (cost: ActualCostRegisterItem) => {
    setActiveDocRecord({
      id: cost.id,
      title: `Cost ${cost.reference} - ${cost.supplier}`,
      ref: cost.reference,
      docs: cost.documents || []
    });
  };

  // Attachment Handlers
  const handleAddAttachment = async (newDoc: CommercialSupportingDocument) => {
    assertOperationalAction("create", "components/commercial/views/CommercialActualCostsView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.addAttachmentToRecord(
      companyId,
      projectId,
      "ACTUAL_COST",
      activeDocRecord.id,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: [...prev.docs, newDoc] } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteAttachment = async (docId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialActualCostsView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.deleteAttachmentFromRecord(
      companyId,
      projectId,
      "ACTUAL_COST",
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
      "ACTUAL_COST",
      activeDocRecord.id,
      docId,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: prev.docs.map((d) => (d.id === docId ? newDoc : d)) } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleExportCsv = () => {
    assertOperationalAction("export", "components/commercial/views/CommercialActualCostsView.tsx");
    const timestamp = new Date().toISOString().split("T")[0];
    const columns: CsvColumn<ActualCostRegisterItem>[] = [
      { key: "reference", label: "Reference" },
      { key: "date", label: "Posting Date" },
      { key: "supplier", label: "Supplier / Payee" },
      { key: "costCode", label: "Cost Code" },
      { key: "description", label: "Description" },
      { key: "invoiceNumber", label: "Invoice Number", formatter: (v) => v || "—" },
      { key: "sourceType", label: "Source Type" },
      { key: "quantity", label: "Quantity", formatter: (v) => (v !== null && v !== undefined ? v : "") },
      { key: "unit", label: "Unit", formatter: (v) => v || "" },
      { key: "rate", label: "Rate", formatter: (v) => (v !== null && v !== undefined ? v : "") },
      { key: "net", label: `Net Amount (${currency})`, formatter: (v) => (v !== null && v !== undefined ? v : "") },
      { key: "tax", label: `Tax / VAT (${currency})`, formatter: (v) => (v !== null && v !== undefined ? v : "") },
      {
        key: "total",
        label: `Total Gross (${currency})`,
        formatter: (v, r) => {
          const gross = v ?? ((r.net || 0) + (r.tax || 0));
          return gross !== null && gross !== undefined ? gross : "";
        }
      },
      { key: "paidAmount", label: `Paid Amount (${currency})`, formatter: (v) => (v !== null && v !== undefined ? v : "") },
      {
        key: "outstandingAmount",
        label: `Outstanding (${currency})`,
        formatter: (v, r) => {
          if (v !== null && v !== undefined) return v;
          const gross = r.total ?? ((r.net || 0) + (r.tax || 0));
          return Math.max(0, gross - (r.paidAmount || 0));
        }
      },
      { key: "paymentStatus", label: "Payment Status", formatter: (v) => v || "Unpaid" },
      { key: "status", label: "Posting Status" },
      { key: "linkedCommitmentRef", label: "Linked PO Ref", formatter: (v) => v || "—" },
      { key: "currency", label: "Currency", formatter: (v) => v || currency },
      { key: "notes", label: "Notes", formatter: (v) => v || "" }
    ];

    const dataToExport = filteredCosts.length > 0 ? filteredCosts : actualCosts;
    const filename = `Commercial_Actual_Costs_${projectId || "All"}_${timestamp}`;
    exportObjectsToCsv(filename, columns, dataToExport);
  };

  return (
    <div className="controls-page-container overflow-hidden max-w-full space-y-6">
      
      {/* 1. Header with Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
            <span>Commercial</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 dark:text-white font-bold">Actual Costs</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Actual Costs Register
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Posted project expenditure, invoices, receipts, and expense vouchers with verified proof of payment.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={actualCosts.length === 0}
            className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export actual costs register to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            Export CSV
          </button>
          <button
            onClick={() => onOpenUpload("ACTUAL_COST")}
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
            Add New Cost
          </button>
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {(["ALL", "INVOICES", "PAID", "UNPAID"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-3.5 transition-all cursor-pointer relative ${
              activeSubTab === tab
                ? "text-amber-600 dark:text-amber-500 font-extrabold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab === "ALL" && `All Actual Costs (${actualCosts.length})`}
            {tab === "INVOICES" && "Supplier Invoices"}
            {tab === "PAID" && "Verified Paid"}
            {tab === "UNPAID" && "Outstanding Payables"}
            {activeSubTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 3. Verified KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
        <div
          onClick={() => onInspectSource("Total Net Expenditure", totalNet, actualCosts[0]?.source, "net")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Total Net Costs</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalNet)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Verified Postings</span>
        </div>

        <div
          onClick={() => onInspectSource("Tax / VAT", totalTax, actualCosts[0]?.source, "tax")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-amber-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Tax / VAT Incurred</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalTax)}
          </span>
          <span className="text-[10px] font-bold text-amber-600 block mt-0.5">Tax Incurred</span>
        </div>

        <div
          onClick={() => onInspectSource("Total Gross Actuals", totalGross, actualCosts[0]?.source, "total")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Total Gross Costs</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalGross)}
          </span>
          <span className="text-[10px] font-bold text-blue-600 block mt-0.5">Net + Tax Total</span>
        </div>

        <div
          onClick={() => onInspectSource("Paid to Date", totalPaid, actualCosts[0]?.source, "paidAmount")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-emerald-600 block truncate">Verified Paid</span>
          <span className="text-base font-extrabold text-emerald-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalPaid)}
          </span>
          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">Proof of Payment Attached</span>
        </div>

        <div
          onClick={() => onInspectSource("Outstanding Payables", totalOutstanding, actualCosts[0]?.source, "outstanding")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-rose-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-rose-600 block truncate">Outstanding Balance</span>
          <span className="text-base font-extrabold text-rose-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalOutstanding)}
          </span>
          <span className="text-[10px] font-bold text-rose-600 block mt-0.5">Pending Payment</span>
        </div>
      </div>

      {/* 4. Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ref, supplier, cost code, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredCosts.length === 0}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Export ${filteredCosts.length} actual cost record(s) to CSV`}
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Export CSV ({filteredCosts.length})</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Click any row or action menu to view, edit, or manage supporting evidence</span>
          </div>
        </div>
      </div>

      {/* 5. Actual Costs Table Register */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1280px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <th scope="col" className="py-3 px-3.5 whitespace-nowrap text-left min-w-[100px]">Ref</th>
                <th scope="col" className="py-3 px-3.5 whitespace-nowrap text-left min-w-[95px]">Date</th>
                <th scope="col" className="py-3 px-3.5 whitespace-nowrap text-left min-w-[140px] max-w-[220px]">Cost Code</th>
                <th scope="col" className="py-3 px-3.5 whitespace-nowrap text-left min-w-[120px] max-w-[180px]">Invoice No.</th>
                <th scope="col" className="py-3 px-3.5 text-right whitespace-nowrap min-w-[130px]">Net</th>
                <th scope="col" className="py-3 px-3.5 text-right whitespace-nowrap min-w-[100px]">Tax</th>
                <th scope="col" className="py-3 px-3.5 text-right whitespace-nowrap min-w-[140px] text-slate-900 dark:text-slate-200">Total</th>
                <th scope="col" className="py-3 px-3.5 text-right whitespace-nowrap min-w-[140px] text-emerald-700 dark:text-emerald-400">Paid</th>
                <th scope="col" className="py-3 px-3.5 text-right whitespace-nowrap min-w-[140px] text-rose-700 dark:text-rose-400">Outstanding</th>
                <th scope="col" className="py-3 px-3 text-center whitespace-nowrap min-w-[100px]">Status</th>
                <th scope="col" className="py-3 px-3 text-center whitespace-nowrap min-w-[85px]">Evidence</th>
                <th scope="col" className="py-3 px-3.5 text-right whitespace-nowrap min-w-[70px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCosts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 text-xs">
                    No actual costs found. Click "Add New Cost" to create a cost record.
                  </td>
                </tr>
              ) : (
                filteredCosts.map((cost) => {
                  const net = cost.net || 0;
                  const tax = cost.tax || 0;
                  const total = cost.total ?? (net + tax);
                  const paid = cost.paidAmount || 0;
                  const outstanding = Math.max(0, total - paid);

                  return (
                    <tr
                      key={cost.id || cost.reference}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => handleView(cost)}
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {cost.reference}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {cost.date}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap min-w-[140px] max-w-[220px]">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs truncate" title={cost.costCode}>
                          {cost.costCode || "—"}
                        </div>
                        {cost.supplier && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[210px]" title={cost.supplier}>
                            {cost.supplier}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap min-w-[120px] max-w-[180px]">
                        <div className="font-mono text-slate-700 dark:text-slate-300 text-[11px] font-medium truncate" title={cost.invoiceNumber}>
                          {cost.invoiceNumber || "—"}
                        </div>
                        {cost.description && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[170px]" title={cost.description}>
                            {cost.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-[130px] font-medium">
                        {formatCurrency(net)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap min-w-[100px]">
                        {formatCurrency(tax)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap min-w-[140px]">
                        {formatCurrency(total)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap min-w-[140px]">
                        {formatCurrency(paid)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap min-w-[140px]">
                        {formatCurrency(outstanding)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap min-w-[100px]">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                            cost.status === "Posted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                          }`}
                        >
                          {cost.status}
                        </span>
                      </td>
                      <td
                        className="py-3 px-3 text-center whitespace-nowrap min-w-[85px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageAttachments(cost);
                        }}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                          title="Manage attachments"
                        >
                          <Paperclip className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{cost.documents?.length || 0}</span>
                        </button>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap min-w-[70px]" onClick={(e) => e.stopPropagation()}>
                        <CommercialRowActions
                          onView={() => handleView(cost)}
                          onEdit={() => handleEdit(cost)}
                          onDelete={() => handleDelete(cost.id)}
                          onManageAttachments={() => handleManageAttachments(cost)}
                          recordTitle={`Cost ${cost.reference}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredCosts.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 text-xs font-bold">
                <tr>
                  <td colSpan={4} className="py-3 px-3.5 text-right font-semibold text-slate-600 dark:text-slate-400">
                    Total ({filteredCosts.length} records):
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap min-w-[130px]">
                    {formatCurrency(filteredNet)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap min-w-[100px]">
                    {formatCurrency(filteredTax)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap min-w-[140px]">
                    {formatCurrency(filteredTotal)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap min-w-[140px]">
                    {formatCurrency(filteredPaid)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap min-w-[140px]">
                    {formatCurrency(filteredOutstanding)}
                  </td>
                  <td colSpan={3} className="py-3 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 6. Standardized Add / Edit Record Modal */}
      <CommercialRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingCost(null);
        }}
        recordType="ACTUAL_COST"
        mode={editingCost ? "EDIT" : "CREATE"}
        initialData={editingCost || undefined}
        currency={currency}
        onSave={handleSaveRecord}
      />

      {/* 7. Standardized Record Detail Modal */}
      {selectedCost && (
        <CommercialRecordDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedCost(null);
          }}
          recordType="ACTUAL_COST"
          record={selectedCost}
          currency={currency}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedCost);
          }}
          onDelete={() => handleDelete(selectedCost.id)}
          onManageAttachments={() => {
            setIsDetailOpen(false);
            handleManageAttachments(selectedCost);
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
