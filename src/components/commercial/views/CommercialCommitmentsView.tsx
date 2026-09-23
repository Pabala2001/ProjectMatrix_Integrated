import { assertOperationalAction } from "../../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import {
  Upload,
  Plus,
  Truck,
  ShieldCheck,
  Search,
  ChevronRight,
  Eye,
  Paperclip,
  Trash2,
  Edit2
} from "lucide-react";
import {
  CommitmentRegisterItem,
  SourceProvenance,
  CommercialSupportingDocument
} from "../../../types/commercialWorkspace";
import { formatCurrency as formatCentralCurrency } from "../../../utils/currency";
import { CommercialSupportingDocumentsDrawer } from "../CommercialSupportingDocumentsDrawer";
import { CommercialRecordModal } from "../CommercialRecordModal";
import { CommercialRowActions } from "../CommercialRowActions";
import { CommercialRecordDetailModal } from "../CommercialRecordDetailModal";
import { CommercialWorkspaceService } from "../../../services/commercialWorkspaceService";

interface CommercialCommitmentsViewProps {
  commitments: CommitmentRegisterItem[];
  currency: string;
  projectId?: string;
  companyId?: string;
  onOpenUpload: (category?: "COMMITMENT" | "PURCHASE_ORDER" | "SUBCONTRACT") => void;
  onInspectSource: (title: string, value: any, source?: SourceProvenance, fieldName?: string) => void;
  onRefreshData?: () => void;
}

export const CommercialCommitmentsView: React.FC<CommercialCommitmentsViewProps> = ({
  commitments,
  currency = "USD",
  projectId,
  companyId = "default_company",
  onOpenUpload,
  onInspectSource,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    "ALL" | "PO" | "SUBCONTRACT" | "ORDERS" | "VARIATIONS"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected for View / Detail
  const [selectedCommitment, setSelectedCommitment] = useState<CommitmentRegisterItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal State for Add / Edit
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<CommitmentRegisterItem | null>(null);

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

  const totalOriginal = useMemo(
    () => (commitments.length > 0 ? commitments.reduce((acc, c) => acc + (c.originalValue || 0), 0) : null),
    [commitments]
  );
  const totalChanges = useMemo(
    () => (commitments.length > 0 ? commitments.reduce((acc, c) => acc + (c.changes || 0), 0) : null),
    [commitments]
  );
  const totalCurrentCommitment = useMemo(
    () =>
      commitments.length > 0
        ? commitments.reduce((acc, c) => acc + (c.currentCommitment ?? ((c.originalValue || 0) + (c.changes || 0))), 0)
        : null,
    [commitments]
  );
  const totalInvoiced = useMemo(
    () => (commitments.length > 0 ? commitments.reduce((acc, c) => acc + (c.invoiced || 0), 0) : null),
    [commitments]
  );
  const totalPaid = useMemo(
    () => (commitments.length > 0 ? commitments.reduce((acc, c) => acc + (c.paid || 0), 0) : null),
    [commitments]
  );
  const totalBalance =
    totalCurrentCommitment !== null && totalInvoiced !== null
      ? Math.max(0, totalCurrentCommitment - totalInvoiced)
      : null;

  const filteredCommitments = useMemo(() => {
    return commitments.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.ref.toLowerCase().includes(q) ||
        item.counterparty.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.costCode && item.costCode.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeSubTab === "PO") return item.type === "Purchase Order";
      if (activeSubTab === "SUBCONTRACT") return item.type === "Subcontract";
      if (activeSubTab === "ORDERS") return item.type === "Supplier Order" || item.type === "Rental Agreement" || item.type === "Service Agreement";
      if (activeSubTab === "VARIATIONS") return item.type === "Approved Variation" || (item.changes && item.changes !== 0);

      return true;
    });
  }, [commitments, searchQuery, activeSubTab]);

  // Actions Handlers
  const handleAddNew = () => {
    assertOperationalAction("create", "components/commercial/views/CommercialCommitmentsView.tsx");
    setEditingCommitment(null);
    setIsRecordModalOpen(true);
  };

  const handleEdit = (item: CommitmentRegisterItem) => {
    setEditingCommitment(item);
    setIsRecordModalOpen(true);
  };

  const handleView = (item: CommitmentRegisterItem) => {
    setSelectedCommitment(item);
    setIsDetailOpen(true);
  };

  const handleSaveRecord = async (formData: any) => {
    assertOperationalAction("write", "components/commercial/views/CommercialCommitmentsView.tsx");
    const origVal = Number(formData.net || formData.total || formData.originalValue || 0);
    const changesVal = Number(formData.changes !== undefined && formData.changes !== "" ? formData.changes : (editingCommitment?.changes || 0));
    const paidAmt = formData.paidAmount !== undefined ? Number(formData.paidAmount) : (editingCommitment?.paid || 0);
    const currentComm = formData.currentCommitment ? Number(formData.currentCommitment) : (origVal + changesVal);
    const itemToSave: CommitmentRegisterItem = {
      id: editingCommitment?.id || `comm-${Date.now()}`,
      companyId: companyId || "default_company",
      projectId: projectId || "all",
      currency: currency || "USD",
      ref: formData.reference || editingCommitment?.ref || `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      date: formData.date || new Date().toISOString().split("T")[0],
      counterparty: formData.supplier || formData.counterparty || "Vendor",
      supplier: formData.supplier || formData.counterparty || "Vendor",
      type: formData.type || "Purchase Order",
      costCode: formData.costCode || "General",
      description: formData.description || "Commitment Contract",
      quantity: formData.quantity ? Number(formData.quantity) : undefined,
      unit: formData.unit || undefined,
      rate: formData.rate ? Number(formData.rate) : undefined,
      originalValue: origVal,
      changes: changesVal,
      currentCommitment: currentComm,
      invoiced: editingCommitment?.invoiced || 0,
      paid: paidAmt,
      outstanding: Math.max(0, currentComm - paidAmt),
      status: formData.status || "Approved",
      documents: formData.documents || editingCommitment?.documents || [],
      notes: formData.notes || undefined,
      source: {
        originalFilename: "Manual Entry",
        uploadDate: new Date().toISOString(),
        uploadedBy: "Authorized User",
        importStatus: "MANUAL_ENTRY",
        approvalStatus: "APPROVED"
      }
    };

    await CommercialWorkspaceService.saveCommitment(companyId, projectId, itemToSave);
    setIsRecordModalOpen(false);
    setEditingCommitment(null);
    if (onRefreshData) onRefreshData();
  };

  const handleDelete = async (itemId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialCommitmentsView.tsx");
    await CommercialWorkspaceService.deleteCommitment(companyId, projectId, itemId);
    if (selectedCommitment?.id === itemId) {
      setIsDetailOpen(false);
      setSelectedCommitment(null);
    }
    if (onRefreshData) onRefreshData();
  };

  const handleManageAttachments = (item: CommitmentRegisterItem) => {
    setActiveDocRecord({
      id: item.id,
      title: `Commitment ${item.ref} - ${item.counterparty}`,
      ref: item.ref,
      docs: item.documents || []
    });
  };

  const handleAddAttachment = async (newDoc: CommercialSupportingDocument) => {
    assertOperationalAction("create", "components/commercial/views/CommercialCommitmentsView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.addAttachmentToRecord(
      companyId,
      projectId,
      "COMMITMENT",
      activeDocRecord.id,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: [...prev.docs, newDoc] } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteAttachment = async (docId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialCommitmentsView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.deleteAttachmentFromRecord(
      companyId,
      projectId,
      "COMMITMENT",
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
      "COMMITMENT",
      activeDocRecord.id,
      docId,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: prev.docs.map((d) => (d.id === docId ? newDoc : d)) } : null));
    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="controls-page-container overflow-hidden max-w-full space-y-6">
      
      {/* 1. Header with Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
            <span>Commercial</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 dark:text-white font-bold">Commitments</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Commitments Register
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Purchase orders, subcontracts, supplier orders and variations backed by approved quotations and agreements.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenUpload("COMMITMENT")}
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
            Add New Commitment
          </button>
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {(["ALL", "PO", "SUBCONTRACT", "ORDERS", "VARIATIONS"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-3.5 transition-all cursor-pointer relative ${
              activeSubTab === tab
                ? "text-amber-600 dark:text-amber-500 font-extrabold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab === "ALL" && `All Commitments (${commitments.length})`}
            {tab === "PO" && "Purchase Orders"}
            {tab === "SUBCONTRACT" && "Subcontracts"}
            {tab === "ORDERS" && "Service / Rental Orders"}
            {tab === "VARIATIONS" && "Variations"}
            {activeSubTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 3. Verified KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
        <div
          onClick={() => onInspectSource("Total Original Commitments", totalOriginal, commitments[0]?.source, "originalValue")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Original Commitments</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalOriginal)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Base Executed Orders</span>
        </div>

        <div
          onClick={() => onInspectSource("Approved Variations", totalChanges, commitments[0]?.source, "changes")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-amber-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Approved Changes</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalChanges)}
          </span>
          <span className="text-[10px] font-bold text-amber-600 block mt-0.5">Scope Revisions</span>
        </div>

        <div
          onClick={() => onInspectSource("Current Committed Total", totalCurrentCommitment, commitments[0]?.source, "currentCommitment")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Current Commitment</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalCurrentCommitment)}
          </span>
          <span className="text-[10px] font-bold text-blue-600 block mt-0.5">Original + Variations</span>
        </div>

        <div
          onClick={() => onInspectSource("Total Invoiced Against Commitments", totalInvoiced, commitments[0]?.source, "invoiced")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Total Invoiced</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalInvoiced)}
          </span>
          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">Billed by Vendors</span>
        </div>

        <div
          onClick={() => onInspectSource("Uninvoiced Commitment Balance", totalBalance, commitments[0]?.source, "balance")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-purple-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-purple-600 block truncate">Uncommitted Balance</span>
          <span className="text-base font-extrabold text-purple-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalBalance)}
          </span>
          <span className="text-[10px] font-bold text-purple-600 block mt-0.5">Remaining PO Value</span>
        </div>
      </div>

      {/* 4. Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ref, vendor, cost code, scope..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Click any row or action menu to view, edit, or manage supporting agreements</span>
        </div>
      </div>

      {/* 5. Commitments Table Register */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1050px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Ref / PO #</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Date</th>
                <th className="py-2.5 px-3 min-w-[140px] max-w-[200px] overflow-hidden text-ellipsis truncate">Vendor / Subcontractor</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Type</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Cost Code</th>
                <th className="py-2.5 px-3 min-w-[160px] max-w-[240px] overflow-hidden text-ellipsis truncate">Description</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Original</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Changes</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Current Total</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Invoiced</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Status</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Evidence</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-visible">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCommitments.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 text-xs truncate overflow-hidden">
                    No commitments found. Click "Add New Commitment" to create an order or subcontract.
                  </td>
                </tr>
              ) : (
                filteredCommitments.map((comm) => {
                  const orig = comm.originalValue || 0;
                  const chg = comm.changes || 0;
                  const curr = comm.currentCommitment ?? (orig + chg);
                  const inv = comm.invoiced || 0;

                  return (
                    <tr
                      key={comm.id || comm.ref}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => handleView(comm)}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">
                        {comm.ref}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap truncate overflow-hidden">
                        {comm.date}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white truncate overflow-hidden max-w-[200px]" title={comm.counterparty}>
                        {comm.counterparty}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap truncate overflow-hidden">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {comm.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap truncate overflow-hidden">
                        {comm.costCode || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 truncate overflow-hidden max-w-[240px]" title={comm.description}>
                        {comm.description}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap truncate overflow-hidden">
                        {formatCurrency(orig)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap truncate overflow-hidden">
                        {formatCurrency(chg)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">
                        {formatCurrency(curr)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold whitespace-nowrap truncate overflow-hidden">
                        {formatCurrency(inv)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap truncate overflow-hidden">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                            comm.status === "Approved" || comm.status === "Issued"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {comm.status}
                        </span>
                      </td>
                      <td
                        className="py-2.5 px-3 text-center whitespace-nowrap truncate overflow-hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManageAttachments(comm);
                        }}
                      >
                        <button className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                          <Paperclip className="w-3 h-3 text-amber-600" />
                          <span>{comm.documents?.length || 0}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap overflow-visible" onClick={(e) => e.stopPropagation()}>
                        <CommercialRowActions
                          onView={() => handleView(comm)}
                          onEdit={() => handleEdit(comm)}
                          onDelete={() => handleDelete(comm.id)}
                          onManageAttachments={() => handleManageAttachments(comm)}
                          recordTitle={`Commitment ${comm.ref}`}
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
          setEditingCommitment(null);
        }}
        recordType="COMMITMENT"
        mode={editingCommitment ? "EDIT" : "CREATE"}
        initialData={editingCommitment || undefined}
        currency={currency}
        onSave={handleSaveRecord}
      />

      {/* 7. Standardized Record Detail Modal */}
      {selectedCommitment && (
        <CommercialRecordDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedCommitment(null);
          }}
          recordType="COMMITMENT"
          record={selectedCommitment}
          currency={currency}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedCommitment);
          }}
          onDelete={() => handleDelete(selectedCommitment.id)}
          onManageAttachments={() => {
            setIsDetailOpen(false);
            handleManageAttachments(selectedCommitment);
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
