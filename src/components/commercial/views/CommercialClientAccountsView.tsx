import { assertOperationalAction } from "../../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import {
  Upload,
  Plus,
  Building,
  ShieldCheck,
  Search,
  ChevronRight,
  Eye,
  Paperclip,
  Trash2,
  Edit2
} from "lucide-react";
import {
  ClientCertificateRecord,
  SourceProvenance,
  CommercialSupportingDocument
} from "../../../types/commercialWorkspace";
import { formatCurrency as formatCentralCurrency } from "../../../utils/currency";
import { CommercialSupportingDocumentsDrawer } from "../CommercialSupportingDocumentsDrawer";
import { CommercialRecordModal } from "../CommercialRecordModal";
import { CommercialRowActions } from "../CommercialRowActions";
import { CommercialRecordDetailModal } from "../CommercialRecordDetailModal";
import { CommercialWorkspaceService } from "../../../services/commercialWorkspaceService";

interface CommercialClientAccountsViewProps {
  certificates: ClientCertificateRecord[];
  currency: string;
  projectId?: string;
  companyId?: string;
  onOpenUpload: (category?: "CLIENT_CERTIFICATE" | "PROGRESS_CLAIM") => void;
  onInspectSource: (title: string, value: any, source?: SourceProvenance, fieldName?: string) => void;
  onUpdateCertificate?: (cert: ClientCertificateRecord) => void;
  onRefreshData?: () => void;
}

export const CommercialClientAccountsView: React.FC<CommercialClientAccountsViewProps> = ({
  certificates,
  currency = "USD",
  projectId,
  companyId = "default_company",
  onOpenUpload,
  onInspectSource,
  onUpdateCertificate,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"ALL" | "CLAIMS" | "CERTIFICATES" | "PAID" | "RETENTION">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected for View / Detail
  const [selectedCert, setSelectedCert] = useState<ClientCertificateRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal State for Add / Edit
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<ClientCertificateRecord | null>(null);

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

  const totalClaimed = useMemo(
    () => (certificates.length > 0 ? certificates.reduce((acc, c) => acc + (c.claimedAmount || 0), 0) : null),
    [certificates]
  );
  const totalCertified = useMemo(
    () => (certificates.length > 0 ? certificates.reduce((acc, c) => acc + (c.certifiedAmount || 0), 0) : null),
    [certificates]
  );
  const totalRetention = useMemo(
    () => (certificates.length > 0 ? certificates.reduce((acc, c) => acc + (c.retentionDeducted || 0), 0) : null),
    [certificates]
  );
  const totalReceived = useMemo(
    () => (certificates.length > 0 ? certificates.reduce((acc, c) => acc + (c.paidAmount || 0), 0) : null),
    [certificates]
  );
  const totalOutstanding =
    totalCertified !== null && totalReceived !== null
      ? Math.max(0, (totalCertified - (totalRetention || 0)) - totalReceived)
      : null;

  const filteredCerts = useMemo(() => {
    return certificates.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matches =
        c.certificateNumber.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        (c.claimReference && c.claimReference.toLowerCase().includes(q));

      if (!matches) return false;

      if (activeSubTab === "PAID") return (c.paidAmount || 0) >= (c.certifiedAmount || 0);
      if (activeSubTab === "RETENTION") return (c.retentionDeducted || 0) > 0;
      return true;
    });
  }, [certificates, searchQuery, activeSubTab]);

  // Actions Handlers
  const handleAddNew = () => {
    assertOperationalAction("create", "components/commercial/views/CommercialClientAccountsView.tsx");
    setEditingCert(null);
    setIsRecordModalOpen(true);
  };

  const handleEdit = (cert: ClientCertificateRecord) => {
    setEditingCert(cert);
    setIsRecordModalOpen(true);
  };

  const handleView = (cert: ClientCertificateRecord) => {
    setSelectedCert(cert);
    setIsDetailOpen(true);
  };

  const handleSaveRecord = async (formData: any) => {
    assertOperationalAction("write", "components/commercial/views/CommercialClientAccountsView.tsx");
    const certAmount = Number(formData.total || formData.certifiedAmount || formData.net || 0);
    const paidAmt = formData.paidAmount !== undefined ? Number(formData.paidAmount) : (editingCert?.paidAmount || 0);
    const retention = formData.tax ? Number(formData.tax) : (editingCert?.retentionWithheld || editingCert?.retentionDeducted || 0);
    const itemToSave: ClientCertificateRecord = {
      id: editingCert?.id || `ipc-${Date.now()}`,
      companyId: companyId || "default_company",
      projectId: projectId || "all",
      certificateNumber: formData.reference || editingCert?.certificateNumber || `IPC-${Math.floor(1000 + Math.random() * 9000)}`,
      period: formData.date ? formData.date.substring(0, 7) : (editingCert?.period || new Date().toISOString().substring(0, 7)),
      periodEnding: formData.date || editingCert?.periodEnding || new Date().toISOString().split("T")[0],
      issueDate: formData.date || editingCert?.issueDate || new Date().toISOString().split("T")[0],
      date: formData.date || editingCert?.date || new Date().toISOString().split("T")[0],
      claimReference: formData.invoiceNumber || editingCert?.claimReference || `CLM-${Math.floor(100 + Math.random() * 900)}`,
      clientName: formData.supplier || formData.clientName || editingCert?.clientName || "Client Developer",
      appliedAmount: formData.rate ? Number(formData.rate) : (editingCert?.appliedAmount || certAmount),
      claimedAmount: formData.rate ? Number(formData.rate) : (editingCert?.claimedAmount || certAmount),
      certifiedAmount: certAmount,
      invoicedAmount: certAmount,
      paidAmount: paidAmt,
      retentionWithheld: retention,
      retentionDeducted: retention,
      netPayable: certAmount - retention,
      outstandingAmount: Math.max(0, certAmount - retention - paidAmt),
      status: formData.status || "Certified",
      currency: currency || "USD",
      documents: formData.documents || editingCert?.documents || [],
      notes: formData.notes || undefined,
      source: {
        originalFilename: "Manual Entry",
        uploadDate: new Date().toISOString(),
        uploadedBy: "Authorized User",
        importStatus: "MANUAL_ENTRY",
        approvalStatus: "APPROVED"
      }
    };

    await CommercialWorkspaceService.saveClientCertificate(companyId, projectId, itemToSave);
    setIsRecordModalOpen(false);
    setEditingCert(null);
    if (onRefreshData) onRefreshData();
    if (onUpdateCertificate) onUpdateCertificate(itemToSave);
  };

  const handleDelete = async (certId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialClientAccountsView.tsx");
    await CommercialWorkspaceService.deleteClientCertificate(companyId, projectId, certId);
    if (selectedCert?.id === certId) {
      setIsDetailOpen(false);
      setSelectedCert(null);
    }
    if (onRefreshData) onRefreshData();
  };

  const handleManageAttachments = (cert: ClientCertificateRecord) => {
    setActiveDocRecord({
      id: cert.id,
      title: `Certificate ${cert.certificateNumber} - ${cert.clientName}`,
      ref: cert.certificateNumber,
      docs: cert.documents || []
    });
  };

  const handleAddAttachment = async (newDoc: CommercialSupportingDocument) => {
    assertOperationalAction("create", "components/commercial/views/CommercialClientAccountsView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.addAttachmentToRecord(
      companyId,
      projectId,
      "CLIENT_CERTIFICATE",
      activeDocRecord.id,
      newDoc
    );
    setActiveDocRecord((prev) => (prev ? { ...prev, docs: [...prev.docs, newDoc] } : null));
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteAttachment = async (docId: string) => {
    assertOperationalAction("delete", "components/commercial/views/CommercialClientAccountsView.tsx");
    if (!activeDocRecord) return;
    await CommercialWorkspaceService.deleteAttachmentFromRecord(
      companyId,
      projectId,
      "CLIENT_CERTIFICATE",
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
      "CLIENT_CERTIFICATE",
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
            <span className="text-slate-900 dark:text-white font-bold">Client Accounts</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Client Accounts & Claims
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Progress claims, certified valuations, retention held, tax invoices and verified client remittances.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenUpload("CLIENT_CERTIFICATE")}
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
            Add New Certificate / Claim
          </button>
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {(["ALL", "CLAIMS", "CERTIFICATES", "PAID", "RETENTION"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-3.5 transition-all cursor-pointer relative ${
              activeSubTab === tab
                ? "text-amber-600 dark:text-amber-500 font-extrabold"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {tab === "ALL" && `All Applications (${certificates.length})`}
            {tab === "CLAIMS" && "Progress Claims"}
            {tab === "CERTIFICATES" && "Certified Valuations"}
            {tab === "PAID" && "Verified Received"}
            {tab === "RETENTION" && "Retention Tracking"}
            {activeSubTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 3. Verified KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
        <div
          onClick={() => onInspectSource("Total Claimed", totalClaimed, certificates[0]?.source, "claimedAmount")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-slate-500 block truncate">Total Claimed</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-1 tracking-tight truncate">
            {formatCurrency(totalClaimed)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Contractor Applications</span>
        </div>

        <div
          onClick={() => onInspectSource("Total Certified", totalCertified, certificates[0]?.source, "certifiedAmount")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-emerald-600 block truncate">Total Certified</span>
          <span className="text-base font-extrabold text-emerald-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalCertified)}
          </span>
          <span className="text-[10px] font-bold text-emerald-600 block mt-0.5">Approved Valuations</span>
        </div>

        <div
          onClick={() => onInspectSource("Retention Held", totalRetention, certificates[0]?.source, "retentionDeducted")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-amber-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-amber-600 block truncate">Retention Held</span>
          <span className="text-base font-extrabold text-amber-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalRetention)}
          </span>
          <span className="text-[10px] font-bold text-amber-600 block mt-0.5">Held by Employer</span>
        </div>

        <div
          onClick={() => onInspectSource("Remittance Received", totalReceived, certificates[0]?.source, "paidAmount")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-blue-600 block truncate">Total Received</span>
          <span className="text-base font-extrabold text-blue-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalReceived)}
          </span>
          <span className="text-[10px] font-bold text-blue-600 block mt-0.5">Bank Confirmed</span>
        </div>

        <div
          onClick={() => onInspectSource("Outstanding Receivables", totalOutstanding, certificates[0]?.source, "outstanding")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-purple-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-purple-600 block truncate">Outstanding Receivables</span>
          <span className="text-base font-extrabold text-purple-600 block mt-1 tracking-tight truncate">
            {formatCurrency(totalOutstanding)}
          </span>
          <span className="text-[10px] font-bold text-purple-600 block mt-0.5">Due from Client</span>
        </div>
      </div>

      {/* 4. Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search certificate #, client, claim ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Click any row or action menu to view, edit, or manage supporting certificates</span>
        </div>
      </div>

      {/* 5. Certificates Table Register */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1050px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Cert #</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Claim Ref</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Issue Date</th>
                <th className="py-2.5 px-3 min-w-[150px] max-w-[220px] overflow-hidden text-ellipsis truncate">Client / Employer</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Claimed</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Certified</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Retention</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Received</th>
                <th className="py-2.5 px-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Status</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Evidence</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-visible">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCerts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 text-xs truncate overflow-hidden">
                    No client certificates found. Click "Add New Certificate / Claim" to record one.
                  </td>
                </tr>
              ) : (
                filteredCerts.map((cert) => (
                  <tr
                    key={cert.id || cert.certificateNumber}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => handleView(cert)}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">
                      {cert.certificateNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap truncate overflow-hidden">
                      {cert.claimReference || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap truncate overflow-hidden">
                      {cert.issueDate}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white truncate overflow-hidden max-w-[220px]" title={cert.clientName}>
                      {cert.clientName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap truncate overflow-hidden">
                      {formatCurrency(cert.claimedAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap truncate overflow-hidden">
                      {formatCurrency(cert.certifiedAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-600 whitespace-nowrap truncate overflow-hidden">
                      {formatCurrency(cert.retentionDeducted)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-600 font-semibold whitespace-nowrap truncate overflow-hidden">
                      {formatCurrency(cert.paidAmount)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap truncate overflow-hidden">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                          cert.status === "Certified" || cert.status === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                        }`}
                      >
                        {cert.status}
                      </span>
                    </td>
                    <td
                      className="py-2.5 px-3 text-center whitespace-nowrap truncate overflow-hidden"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageAttachments(cert);
                      }}
                    >
                      <button className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <Paperclip className="w-3 h-3 text-amber-600" />
                        <span>{cert.documents?.length || 0}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap overflow-visible" onClick={(e) => e.stopPropagation()}>
                      <CommercialRowActions
                        onView={() => handleView(cert)}
                        onEdit={() => handleEdit(cert)}
                        onDelete={() => handleDelete(cert.id)}
                        onManageAttachments={() => handleManageAttachments(cert)}
                        recordTitle={`Certificate ${cert.certificateNumber}`}
                      />
                    </td>
                  </tr>
                ))
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
          setEditingCert(null);
        }}
        recordType="CLIENT_CERTIFICATE"
        mode={editingCert ? "EDIT" : "CREATE"}
        initialData={editingCert ? {
          reference: editingCert.certificateNumber,
          invoiceNumber: editingCert.claimReference,
          date: editingCert.issueDate,
          supplier: editingCert.clientName,
          rate: editingCert.claimedAmount,
          total: editingCert.certifiedAmount,
          tax: editingCert.retentionDeducted,
          paidAmount: editingCert.paidAmount,
          status: editingCert.status,
          documents: editingCert.documents,
          notes: editingCert.notes
        } : undefined}
        currency={currency}
        onSave={handleSaveRecord}
      />

      {/* 7. Standardized Record Detail Modal */}
      {selectedCert && (
        <CommercialRecordDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedCert(null);
          }}
          recordType="CLIENT_CERTIFICATE"
          record={selectedCert}
          currency={currency}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedCert);
          }}
          onDelete={() => handleDelete(selectedCert.id)}
          onManageAttachments={() => {
            setIsDetailOpen(false);
            handleManageAttachments(selectedCert);
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
