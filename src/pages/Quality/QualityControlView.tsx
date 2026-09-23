import React, { useState } from "react";
import { FileText, ChevronLeft, Edit, Download, Calendar, ArrowLeft, ShieldCheck, CheckSquare, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { QualityControlRecord, QualityControlTemplate } from "../../types/qualityControl";
import { QUALITY_CONTROL_TEMPLATES } from "../../data/qualityControlTemplates";
import QualityControlStatusBadge from "../../components/quality-control/QualityControlStatusBadge";
import { generateQualityControlDocx } from "../../utils/generateQualityControlDocx";
import { QualityControlStorageHelper } from "../../utils/qualityControlStorageHelper";
import { QualityControlStorage } from "../../utils/qualityControlStorage";

interface QualityControlViewProps {
  record: QualityControlRecord;
  onEdit: () => void;
  onClose: () => void;
}

export default function QualityControlView({
  record,
  onEdit,
  onClose,
}: QualityControlViewProps) {
  const { formatDateTime } = useRegionalSettings();
  const template = QUALITY_CONTROL_TEMPLATES.find((t) => t.id === record.templateId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleGenerateDocx = async () => {
    if (!template) return;
    try {
      setIsGenerating(false);
      setNotification(null);
      setIsGenerating(true);
      
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
      
      // Update local record copy so UI updates
      record.docxBucket = docxMeta.docxBucket;
      record.docxPath = docxMeta.docxPath;
      record.docxFileName = docxMeta.docxFileName;
      record.docxMimeType = docxMeta.docxMimeType;
      record.docxFileSize = docxMeta.docxFileSize;
      record.docxGeneratedAt = docxMeta.docxGeneratedAt;

      setNotification({ message: "Document generated and securely archived in Supabase Storage!", type: "success" });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      console.error("DOCX generation/upload failed:", err);
      setNotification({ message: "Generated successfully, but failed to archive: " + (err.message || err), type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "-";
    return formatDateTime(isoStr);
  };

  if (!template) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-sm font-bold text-red-600">Original template not found for this record.</p>
        <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-white rounded-xl">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        
        {notification && (
          <div className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between ${
            notification.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <span>{notification.message}</span>
            <button type="button" onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Back & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 hover:bg-slate-150 rounded-lg text-slate-500 transition-colors border border-slate-200 bg-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Viewing QA Record &bull; {record.category}
              </span>
              <h2 className="text-base font-extrabold text-[#07182E] tracking-tight flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-[#FF9F1C]" />
                {record.formTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <QualityControlStatusBadge status={record.status} />
            <span className="text-[10px] text-slate-400 font-mono font-bold px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-full">
              ID: {record.id.slice(0, 12)}...
            </span>
          </div>
        </div>

        {/* 1. BRAND IDENTITY & CUSTOM CONTRACTOR LOGO */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-24 h-16 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {record.companyLogoBase64 ? (
                  <img
                    src={record.companyLogoBase64}
                    alt="Company Logo"
                    className="w-full h-full object-contain p-1"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">NO LOGO</span>
                )}
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Contractor Company Name
                </label>
                <p className="text-sm font-extrabold text-[#07182E]">
                  {record.companyName || "NOT SPECIFIED"}
                </p>
              </div>
            </div>

            <div className="text-left md:text-right border-t md:border-t-0 border-slate-200 pt-3 md:pt-0">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                Form References
              </span>
              <p className="font-mono text-xs font-bold text-[#07182E]">
                Doc Ref: <span className="text-[#FF9F1C]">{record.formReference || "N/A"}</span>
              </p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                Rev: {record.revision || "0"} &bull; Date: {record.revisionDate || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* 2. CONTRACTUAL PROJECT METADATA */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
          <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2">
            Project & Contract Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Project Name
              </span>
              <p className="font-bold text-[#07182E]">{record.projectName || "N/A"}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Project Number
              </span>
              <p className="font-bold text-[#07182E] font-mono">{record.projectNumber || "N/A"}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Contract Number
              </span>
              <p className="font-bold text-[#07182E] font-mono">{record.contractNumber || "N/A"}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Main Contractor / JV
              </span>
              <p className="font-bold text-[#07182E]">{record.contractor || "N/A"}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Location Reference / Chainage
              </span>
              <p className="font-bold text-[#07182E]">{record.location || "N/A"}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Item / Element Reference
              </span>
              <p className="font-bold text-[#07182E]">{record.item || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* 3. DYNAMIC TECHNICAL SPECIFICATIONS / CUSTOM FIELDS */}
        {template.customFields.length > 0 && (
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
            <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2">
              Technical Specifications & Measurements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {template.customFields.map((f) => {
                const value = record.fields[f.name];
                return (
                  <div key={f.name} className="flex items-center justify-between p-3 border-b border-slate-100">
                    <span className="font-bold text-slate-500">{f.label}</span>
                    <span className="font-mono font-bold text-slate-800">
                      {value !== undefined && value !== null && value !== "" ? String(value) : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. QUALITY ASSURANCE INSPECTION CHECKLIST (TABLE) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] overflow-hidden">
          <div className="p-5 border-b border-slate-150 bg-slate-50/50">
            <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider">
              Quality Assurance Checklist Results
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 w-1/3 min-w-[220px] overflow-hidden text-ellipsis">Operation / Inspection Item</th>
                  {template.hasMeasurementColumns && (
                    <>
                      <th className="p-4 w-28 text-center overflow-hidden text-ellipsis">Specified</th>
                      <th className="p-4 w-28 text-center overflow-hidden text-ellipsis">Actual</th>
                    </>
                  )}
                  <th className="p-4 text-center w-36 overflow-hidden text-ellipsis">Status</th>
                  <th className="p-4 min-w-[200px] overflow-hidden text-ellipsis">Comments & Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs">
                {record.checklistRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/10">
                    <td className="p-4 font-bold text-slate-700 leading-relaxed overflow-hidden text-ellipsis">
                      <div className="truncate" title={row.item}>
                        {row.item}
                      </div>
                    </td>

                    {template.hasMeasurementColumns && (
                      <>
                        <td className="p-4 text-center font-mono font-semibold text-slate-500 overflow-hidden text-ellipsis">
                          <span className="truncate block">{row.specified || "-"}</span>
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-slate-800 overflow-hidden text-ellipsis">
                          <span className="truncate block">{row.actual || "-"}</span>
                        </td>
                      </>
                    )}

                    <td className="p-4 text-center overflow-hidden text-ellipsis">
                      {row.acceptable ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border shadow-xs ${
                            row.acceptable === "Yes"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : row.acceptable === "No"
                              ? "bg-rose-50 text-rose-700 border-rose-100"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {row.acceptable === "Yes" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : row.acceptable === "No" ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          ) : null}
                          {row.acceptable}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic text-[11px]">Unchecked</span>
                      )}
                    </td>

                    <td className="p-4 text-slate-600 font-medium overflow-hidden text-ellipsis">
                      <div className="truncate" title={row.comments}>
                        {row.comments || <span className="text-slate-300 italic">No remarks</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. SIGNATURES & SIGNOFFS */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
          <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            Signatures & Authorization Verification
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 border border-slate-150 rounded-xl space-y-3 bg-slate-50/30">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                Contractor Signature Status
              </span>
              <div className="space-y-1">
                <p className="font-bold text-[#07182E]">
                  Representative Name: <span className="text-slate-600 font-medium">{record.contractorSignatureName || "Not Signed"}</span>
                </p>
                <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Digital Attestation: {record.contractorSignatureName ? "VALID CLIENT-SIGNATURE ATTACHED" : "PENDING AUTHORIZATION"}
                </p>
              </div>
            </div>

            <div className="p-4 border border-slate-150 rounded-xl space-y-3 bg-slate-50/30">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                Resident Engineer (RE) Approval Status
              </span>
              <div className="space-y-1">
                <p className="font-bold text-[#07182E]">
                  Assigned Inspector Name: <span className="text-slate-600 font-medium">{record.residentEngineerSignatureName || "Not Audited"}</span>
                </p>
                <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${record.status === "Approved" ? "bg-emerald-500" : record.status === "Rejected" ? "bg-rose-500" : "bg-amber-400"}`} />
                  Auditing Status: {record.status === "Approved" ? "FORM OFFICIALLY RE-APPROVED" : record.status === "Rejected" ? "RECORD REJECTED / DISAPPROVED" : "PENDING AUDIT"}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-400 font-semibold font-mono">
            Attestation Signoff Date: {formatDate(record.signoffDate || "")}
          </div>
        </div>
      </div>

      {/* STICKY FOOTER VIEW OPTIONS */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-4 px-6 flex items-center justify-between shadow-[0px_-4px_16px_rgba(7,24,46,0.04)] z-10">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Register
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateDocx}
            disabled={isGenerating}
            className="px-4 py-2 border border-[#FF9F1C] text-[#FF9F1C] hover:bg-amber-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isGenerating ? "Generating..." : "Generate DOCX"}
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="px-5 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-[#FF9F1C]/25 cursor-pointer"
          >
            <Edit className="w-4 h-4" />
            Edit Form
          </button>
        </div>
      </div>
    </div>
  );
}
