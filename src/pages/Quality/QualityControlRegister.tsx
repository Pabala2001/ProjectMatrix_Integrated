import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { Search, FileText, Calendar, Edit, Eye, Trash2, Download, AlertCircle, RefreshCw, BarChart2 } from "lucide-react";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { QualityControlRecord } from "../../types/qualityControl";
import QualityControlStatusBadge from "../../components/quality-control/QualityControlStatusBadge";
import QualityControlDeleteDialog from "../../components/quality-control/QualityControlDeleteDialog";
import { generateQualityControlDocx } from "../../utils/generateQualityControlDocx";
import { QUALITY_CONTROL_TEMPLATES } from "../../data/qualityControlTemplates";
import { QualityControlStorageHelper } from "../../utils/qualityControlStorageHelper";
import { QualityControlStorage } from "../../utils/qualityControlStorage";
import { exportObjectsToCsv, CsvColumn } from "../../utils/csvExport";

interface QualityControlRegisterProps {
  records: QualityControlRecord[];
  onViewRecord: (record: QualityControlRecord) => void;
  onEditRecord: (record: QualityControlRecord) => void;
  onDeleteRecord: (id: string) => void;
  onCreateNewClick: () => void;
}

export default function QualityControlRegister({
  records,
  onViewRecord,
  onEditRecord,
  onDeleteRecord,
  onCreateNewClick,
}: QualityControlRegisterProps) {
  const { formatDateTime } = useRegionalSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  
  // Custom Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<QualityControlRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [generatingRecordId, setGeneratingRecordId] = useState<string | null>(null);
  const [listNotification, setListNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Statistics calculation
  const totalCount = records.length;
  const draftCount = records.filter((r) => r.status === "Draft").length;
  const completedCount = records.filter((r) => r.status === "Completed").length;
  const approvedCount = records.filter((r) => r.status === "Approved").length;
  const rejectedCount = records.filter((r) => r.status === "Rejected").length;

  // Filtering
  const filteredRecords = records.filter((r) => {
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      r.formTitle.toLowerCase().includes(searchLower) ||
      (r.projectName && r.projectName.toLowerCase().includes(searchLower)) ||
      (r.contractNumber && r.contractNumber.toLowerCase().includes(searchLower)) ||
      (r.contractor && r.contractor.toLowerCase().includes(searchLower)) ||
      (r.status && r.status.toLowerCase().includes(searchLower)) ||
      (r.location && r.location.toLowerCase().includes(searchLower)) ||
      (r.item && r.item.toLowerCase().includes(searchLower));

    return matchesStatus && matchesSearch;
  });

  const handleExportCsv = () => {
    assertOperationalAction("export", "pages/Quality/QualityControlRegister.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const columns: CsvColumn<QualityControlRecord>[] = [
      { key: "id", label: "Form ID" },
      { key: "formTitle", label: "Form Title" },
      { key: "projectName", label: "Project Name", formatter: (v) => v || "-" },
      { key: "contractNumber", label: "Contract Number", formatter: (v) => v || "-" },
      { key: "contractor", label: "Contractor", formatter: (v) => v || "-" },
      { key: "location", label: "Location / Chainage", formatter: (v) => v || "-" },
      { key: "item", label: "Work Item", formatter: (v) => v || "-" },
      { key: "inspector", label: "Lead Inspector", formatter: (v) => v || "-" },
      { key: "date", label: "Inspection Date", formatter: (v) => v || "-" },
      { key: "status", label: "Status" },
    ];
    exportObjectsToCsv(`Quality_Control_Inspections_${timestamp}`, columns, filteredRecords);
  };

  // Handle DOCX triggers
  const handleGenerateDocx = async (e: React.MouseEvent, record: QualityControlRecord) => {
    e.stopPropagation();
    const template = QUALITY_CONTROL_TEMPLATES.find((t) => t.id === record.templateId);
    if (!template) {
      alert("Error: Original template not found.");
      return;
    }
    try {
      setGeneratingRecordId(record.id);
      setListNotification(null);

      // 1. Generate DOCX (downloads automatically on frontend)
      const { blob, filename } = await generateQualityControlDocx(record, template);

      // 2. Upload generated document to secure private storage
      const docxMeta = await QualityControlStorageHelper.uploadDocx(
        record.projectName || "unassigned",
        record.id,
        filename,
        blob
      );

      // 3. Update database record with metadata
      await QualityControlStorage.updateDocxMetadata(record.id, docxMeta);

      // Update local record fields
      record.docxBucket = docxMeta.docxBucket;
      record.docxPath = docxMeta.docxPath;
      record.docxFileName = docxMeta.docxFileName;
      record.docxMimeType = docxMeta.docxMimeType;
      record.docxFileSize = docxMeta.docxFileSize;
      record.docxGeneratedAt = docxMeta.docxGeneratedAt;

      setListNotification({ message: `Successfully generated and archived Word document for "${record.formTitle}"!`, type: "success" });
      setTimeout(() => setListNotification(null), 5000);
    } catch (err: any) {
      console.error("DOCX generation/upload failed:", err);
      setListNotification({ message: `Generated document, but failed to archive: ${err.message || err}`, type: "error" });
    } finally {
      setGeneratingRecordId(null);
    }
  };

  const openDeleteDialog = (e: React.MouseEvent, record: QualityControlRecord) => {
    e.stopPropagation();
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    
    // Simulate slight timeout for UI polish
    setTimeout(() => {
      onDeleteRecord(recordToDelete.id);
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }, 400);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "-";
    return formatDateTime(isoStr);
  };

  return (
    <div className="space-y-6">
      {listNotification && (
        <div className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between shadow-sm ${
          listNotification.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <span>{listNotification.message}</span>
          <button type="button" onClick={() => setListNotification(null)} className="text-slate-400 hover:text-slate-600">
            <Search className="w-4 h-4 hidden" /> {/* dummy search icon to prevent import errors or just use a close indicator */}
            <span className="font-mono text-base px-1.5 cursor-pointer">×</span>
          </button>
        </div>
      )}

      {/* SUMMARY STATISTICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Forms */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Forms
            </span>
            <span className="text-xl font-extrabold text-[#07182E] font-mono leading-none">
              {totalCount}
            </span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Draft */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Draft
            </span>
            <span className="text-xl font-extrabold text-slate-600 font-mono leading-none">
              {draftCount}
            </span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
            <Edit className="w-5 h-5 text-slate-500" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Completed
            </span>
            <span className="text-xl font-extrabold text-blue-600 font-mono leading-none">
              {completedCount}
            </span>
          </div>
          <div className="p-2.5 bg-blue-50/50 border border-blue-50 rounded-xl text-blue-500">
            <BarChart2 className="w-5 h-5" />
          </div>
        </div>

        {/* Approved */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Approved
            </span>
            <span className="text-xl font-extrabold text-emerald-600 font-mono leading-none">
              {approvedCount}
            </span>
          </div>
          <div className="p-2.5 bg-emerald-50/50 border border-emerald-50 rounded-xl text-emerald-500">
            <Eye className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        {/* Rejected */}
        <div className="bg-[#FFFFFF] p-4 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] flex items-center justify-between gap-3 col-span-2 lg:col-span-1">
          <div className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Rejected
            </span>
            <span className="text-xl font-extrabold text-rose-600 font-mono leading-none">
              {rejectedCount}
            </span>
          </div>
          <div className="p-2.5 bg-rose-50/50 border border-rose-50 rounded-xl text-rose-500">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.02)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by project, contract, form title, area or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pb-1 md:pb-0">
            {["All", "Draft", "Completed", "Approved", "Rejected"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? "bg-[#FF9F1C] text-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {status}
              </button>
            ))}

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ml-auto"
              title="Export filtered inspection records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* REGISTER GRID / REGISTER TABLE */}
      {filteredRecords.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.02)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[220px] max-w-[320px] overflow-hidden text-ellipsis">
                    Form Title & Details
                  </th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[160px] max-w-[240px] overflow-hidden text-ellipsis">
                    Project & Contract
                  </th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[140px] max-w-[220px] overflow-hidden text-ellipsis">
                    Location & Item
                  </th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap w-44 overflow-hidden text-ellipsis">
                    Dates
                  </th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap w-36 overflow-hidden text-ellipsis">
                    Status
                  </th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right whitespace-nowrap w-32 overflow-hidden text-ellipsis">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Title */}
                    <td className="p-4 min-w-[220px] max-w-[320px] overflow-hidden text-ellipsis">
                      <div className="space-y-1 min-w-0">
                        <h5 className="font-extrabold text-[#07182E] hover:text-[#FF9F1C] cursor-pointer transition-colors truncate" title={rec.formTitle} onClick={() => onViewRecord(rec)}>
                          {rec.formTitle}
                        </h5>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold font-mono truncate">
                          <span className="truncate">Ref: {rec.formReference || "N/A"}</span>
                          <span>&bull;</span>
                          <span className="shrink-0">Rev: {rec.revision || "0"}</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1.5 mt-1">
                          {/* Logo indicator */}
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                            rec.companyLogoPath 
                              ? "bg-[#07182E]/5 text-[#07182E]/80 border border-[#07182E]/10" 
                              : "bg-slate-50 text-slate-300 border border-slate-100"
                          }`}>
                            Logo {rec.companyLogoPath ? "✓" : "✗"}
                          </span>

                          {/* Signatures indicator */}
                          {(() => {
                            const sigCount = [
                              rec.contractorSignaturePath,
                              rec.residentSignaturePath,
                              rec.inspectorSignaturePath
                            ].filter(Boolean).length;
                            return (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                sigCount > 0 
                                  ? "bg-amber-50 text-amber-700 border border-amber-200" 
                                  : "bg-slate-50 text-slate-300 border border-slate-100"
                              }`}>
                                Sigs: {sigCount}/3 {sigCount === 3 ? "✓" : ""}
                              </span>
                            );
                          })()}

                          {/* DOCX indicator */}
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                            rec.docxPath 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                              : "bg-slate-50 text-slate-300 border border-slate-100"
                          }`}>
                            DOCX {rec.docxPath ? "✓" : "✗"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Project */}
                    <td className="p-4 min-w-[160px] max-w-[240px] overflow-hidden text-ellipsis">
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-slate-700 truncate" title={rec.projectName || "Unknown Project"}>{rec.projectName || "Unknown Project"}</p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate" title={`Contract: ${rec.contractNumber || "N/A"}`}>
                          Contract: {rec.contractNumber || "N/A"}
                        </p>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="p-4 text-slate-600 min-w-[140px] max-w-[220px] overflow-hidden text-ellipsis">
                      <div className="space-y-0.5 font-medium min-w-0">
                        <p className="font-bold text-slate-700 truncate" title={rec.location || "General/Unspecified"}>{rec.location || "General/Unspecified"}</p>
                        {rec.item && <p className="text-[10px] text-[#FF9F1C] font-semibold truncate" title={rec.item}>{rec.item}</p>}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="p-4 text-slate-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Created: {formatDate(rec.createdAt)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Modified: {formatDate(rec.updatedAt)}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4 whitespace-nowrap overflow-hidden text-ellipsis">
                      <QualityControlStatusBadge status={rec.status} />
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right whitespace-nowrap overflow-hidden text-ellipsis">
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <button
                          onClick={() => onViewRecord(rec)}
                          title="View Form"
                          className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-all cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onEditRecord(rec)}
                          title="Edit Form"
                          className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* DOCX */}
                        <button
                          onClick={(e) => handleGenerateDocx(e, rec)}
                          disabled={generatingRecordId !== null}
                          title={generatingRecordId === rec.id ? "Generating Word Document..." : "Download Word File"}
                          className="p-1.5 text-[#FF9F1C] hover:bg-amber-50 hover:text-[#FFB020] rounded-lg transition-all cursor-pointer disabled:opacity-40"
                        >
                          {generatingRecordId === rec.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={(e) => openDeleteDialog(e, rec)}
                          title="Delete Record"
                          className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-100 text-slate-400 rounded-full w-fit mx-auto">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h4 className="text-sm font-extrabold text-[#07182E]">No Records Found</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {records.length === 0
                ? "No quality control records have been created yet. Get started by selecting a template and creating an inspection sheet."
                : "There are no quality control records matching your current filter choices. Adjust your search parameters."}
            </p>
          </div>
          {records.length === 0 && (
            <button
              onClick={onCreateNewClick}
              className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md shadow-[#FF9F1C]/20 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              Create New Quality Form
            </button>
          )}
        </div>
      )}

      {/* Delete Dialog */}
      <QualityControlDeleteDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        recordTitle={recordToDelete ? `${recordToDelete.formTitle} (${recordToDelete.projectName || "General"})` : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
