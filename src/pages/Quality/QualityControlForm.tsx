import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { FileText, ChevronLeft, Save, X, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { QualityControlTemplate, QualityControlRecord, FormStatus } from "../../types/qualityControl";
import CompanyLogoUploader from "../../components/quality-control/CompanyLogoUploader";
import SignatureUploader from "../../components/quality-control/SignatureUploader";
import { QualityControlStorageHelper } from "../../utils/qualityControlStorageHelper";
import { ensureUUID } from "../../utils/qualityControlStorage";

interface QualityControlFormProps {
  template: QualityControlTemplate;
  recordToEdit?: QualityControlRecord;
  onSave: (record: QualityControlRecord) => Promise<void>;
  onCancel: () => void;
}

export default function QualityControlForm({
  template,
  recordToEdit,
  onSave,
  onCancel,
}: QualityControlFormProps) {
  // --- GENERAL FORM HEADER STATE ---
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [contractor, setContractor] = useState("");
  const [location, setLocation] = useState("");
  const [item, setItem] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyLogoBase64, setCompanyLogoBase64] = useState<string | undefined>(undefined);

  const [formReference, setFormReference] = useState("");
  const [revision, setRevision] = useState("");
  const [revisionDate, setRevisionDate] = useState("");

  const [contractorSignatureName, setContractorSignatureName] = useState("");
  const [residentEngineerSignatureName, setResidentEngineerSignatureName] = useState("");
  const [inspectorSignatureName, setInspectorSignatureName] = useState("");
  const [signoffDate, setSignoffDate] = useState("");

  // --- LOCAL ASSET FILES & DELETION STATE ---
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDeleted, setLogoDeleted] = useState(false);

  const [contractorSigFile, setContractorSigFile] = useState<File | null>(null);
  const [contractorSigDeleted, setContractorSigDeleted] = useState(false);

  const [residentSigFile, setResidentSigFile] = useState<File | null>(null);
  const [residentSigDeleted, setResidentSigDeleted] = useState(false);

  const [inspectorSigFile, setInspectorSigFile] = useState<File | null>(null);
  const [inspectorSigDeleted, setInspectorSigDeleted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // --- DYNAMIC FIELDS STATE ---
  const [fields, setFields] = useState<Record<string, string | number | boolean | null>>({});

  // --- CHECKLIST ROWS STATE ---
  const [checklistRows, setChecklistRows] = useState<
    Array<{
      id: string;
      item: string;
      acceptable: "Yes" | "No" | "N/A" | "";
      specified?: string;
      actual?: string;
      comments?: string;
    }>
  >([]);

  // Initialize form state
  useEffect(() => {
    if (recordToEdit) {
      // Edit Mode: Populate existing values
      setProjectName(recordToEdit.projectName || "");
      setProjectNumber(recordToEdit.projectNumber || "");
      setContractNumber(recordToEdit.contractNumber || "");
      setContractor(recordToEdit.contractor || "");
      setLocation(recordToEdit.location || "");
      setItem(recordToEdit.item || "");

      setCompanyName(recordToEdit.companyName || "");
      setCompanyLogoBase64(recordToEdit.companyLogoBase64);

      setFormReference(recordToEdit.formReference || template.documentRef || "");
      setRevision(recordToEdit.revision || template.revision || "0");
      setRevisionDate(recordToEdit.revisionDate || template.revisionDate || "");

      setContractorSignatureName(recordToEdit.contractorSignatureName || "");
      setResidentEngineerSignatureName(recordToEdit.residentEngineerSignatureName || "");
      setInspectorSignatureName(recordToEdit.inspectorSignatureName || "");
      setSignoffDate(recordToEdit.signoffDate || new Date().toISOString().split("T")[0]);

      // Reset upload states
      setLogoFile(null);
      setLogoDeleted(false);
      setContractorSigFile(null);
      setContractorSigDeleted(false);
      setResidentSigFile(null);
      setResidentSigDeleted(false);
      setInspectorSigFile(null);
      setInspectorSigDeleted(false);

      setFields(recordToEdit.fields || {});
      setChecklistRows(recordToEdit.checklistRows || []);
    } else {
      // Create Mode: Initialize default values
      setProjectName("");
      setProjectNumber("");
      setContractNumber("");
      setContractor("");
      setLocation("");
      setItem("");

      setCompanyName("");
      setCompanyLogoBase64(undefined);

      setFormReference(template.documentRef || "");
      setRevision(template.revision || "0");
      setRevisionDate(template.revisionDate || new Date().toISOString().split("T")[0]);

      setContractorSignatureName("");
      setResidentEngineerSignatureName("");
      setInspectorSignatureName("");
      setSignoffDate(new Date().toISOString().split("T")[0]);

      // Reset upload states
      setLogoFile(null);
      setLogoDeleted(false);
      setContractorSigFile(null);
      setContractorSigDeleted(false);
      setResidentSigFile(null);
      setResidentSigDeleted(false);
      setInspectorSigFile(null);
      setInspectorSigDeleted(false);

      // Initialize dynamic custom fields with default values
      const initialFields: Record<string, any> = {};
      template.customFields.forEach((f) => {
        initialFields[f.name] = f.defaultValue !== undefined ? f.defaultValue : "";
      });
      setFields(initialFields);

      // Initialize default checklist items
      const initialChecklist = template.checklistItems.map((itemStr, index) => ({
        id: `row-${index}-${Date.now()}`,
        item: itemStr,
        acceptable: "" as const,
        specified: "",
        actual: "",
        comments: "",
      }));
      setChecklistRows(initialChecklist);
    }
  }, [template, recordToEdit]);

  // Handle Dynamic Custom Field Change
  const handleFieldChange = (fieldName: string, value: any) => {
    setFields((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  // Handle Checklist Row Value Change
  const handleChecklistRowChange = (
    rowId: string,
    key: "acceptable" | "specified" | "actual" | "comments",
    value: any
  ) => {
    setChecklistRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  };

  // Trigger Save with chosen status
  const handleSaveTrigger = async (status: FormStatus) => {
    assertOperationalAction("write", "pages/Quality/QualityControlForm.tsx");
    const recordId = recordToEdit ? recordToEdit.id : ensureUUID("");
    const newUploadedFiles: Array<{ bucket: string; path: string }> = [];

    try {
      setIsLoading(true);
      setToast(null);
      
      let updatedLogoMeta = {
        companyLogoBucket: recordToEdit?.companyLogoBucket || null,
        companyLogoPath: recordToEdit?.companyLogoPath || null,
        companyLogoFileName: recordToEdit?.companyLogoFileName || null,
        companyLogoMimeType: recordToEdit?.companyLogoMimeType || null,
        companyLogoFileSize: recordToEdit?.companyLogoFileSize || null,
        companyLogoUploadedAt: recordToEdit?.companyLogoUploadedAt || null
      };

      let updatedContractorMeta = {
        contractorSignatureBucket: recordToEdit?.contractorSignatureBucket || null,
        contractorSignaturePath: recordToEdit?.contractorSignaturePath || null,
        contractorSignatureFileName: recordToEdit?.contractorSignatureFileName || null,
        contractorSignatureMimeType: recordToEdit?.contractorSignatureMimeType || null,
        contractorSignatureFileSize: recordToEdit?.contractorSignatureFileSize || null,
        contractorSignatureUploadedAt: recordToEdit?.contractorSignatureUploadedAt || null
      };

      let updatedResidentMeta = {
        residentSignatureBucket: recordToEdit?.residentSignatureBucket || null,
        residentSignaturePath: recordToEdit?.residentSignaturePath || null,
        residentSignatureFileName: recordToEdit?.residentSignatureFileName || null,
        residentSignatureMimeType: recordToEdit?.residentSignatureMimeType || null,
        residentSignatureFileSize: recordToEdit?.residentSignatureFileSize || null,
        residentSignatureUploadedAt: recordToEdit?.residentSignatureUploadedAt || null
      };

      let updatedInspectorMeta = {
        inspectorSignatureBucket: recordToEdit?.inspectorSignatureBucket || null,
        inspectorSignaturePath: recordToEdit?.inspectorSignaturePath || null,
        inspectorSignatureFileName: recordToEdit?.inspectorSignatureFileName || null,
        inspectorSignatureMimeType: recordToEdit?.inspectorSignatureMimeType || null,
        inspectorSignatureFileSize: recordToEdit?.inspectorSignatureFileSize || null,
        inspectorSignatureUploadedAt: recordToEdit?.inspectorSignatureUploadedAt || null
      };

      // 1. Upload Logo if any
      if (logoFile) {
        const logoMeta = await QualityControlStorageHelper.uploadCompanyLogo(projectName || "unassigned", logoFile);
        newUploadedFiles.push({ bucket: logoMeta.companyLogoBucket, path: logoMeta.companyLogoPath });
        updatedLogoMeta = logoMeta;
      } else if (logoDeleted) {
        updatedLogoMeta = {
          companyLogoBucket: null,
          companyLogoPath: null,
          companyLogoFileName: null,
          companyLogoMimeType: null,
          companyLogoFileSize: null,
          companyLogoUploadedAt: null
        };
      }

      // 2. Upload Contractor Signature
      if (contractorSigFile) {
        const sigMeta = await QualityControlStorageHelper.uploadSignature("contractor", recordId, contractorSigFile);
        newUploadedFiles.push({ bucket: sigMeta.bucket, path: sigMeta.path });
        updatedContractorMeta = {
          contractorSignatureBucket: sigMeta.bucket,
          contractorSignaturePath: sigMeta.path,
          contractorSignatureFileName: sigMeta.fileName,
          contractorSignatureMimeType: sigMeta.mimeType,
          contractorSignatureFileSize: sigMeta.fileSize,
          contractorSignatureUploadedAt: sigMeta.uploadedAt
        };
      } else if (contractorSigDeleted) {
        updatedContractorMeta = {
          contractorSignatureBucket: null,
          contractorSignaturePath: null,
          contractorSignatureFileName: null,
          contractorSignatureMimeType: null,
          contractorSignatureFileSize: null,
          contractorSignatureUploadedAt: null
        };
      }

      // 3. Upload Resident Signature
      if (residentSigFile) {
        const sigMeta = await QualityControlStorageHelper.uploadSignature("resident", recordId, residentSigFile);
        newUploadedFiles.push({ bucket: sigMeta.bucket, path: sigMeta.path });
        updatedResidentMeta = {
          residentSignatureBucket: sigMeta.bucket,
          residentSignaturePath: sigMeta.path,
          residentSignatureFileName: sigMeta.fileName,
          residentSignatureMimeType: sigMeta.mimeType,
          residentSignatureFileSize: sigMeta.fileSize,
          residentSignatureUploadedAt: sigMeta.uploadedAt
        };
      } else if (residentSigDeleted) {
        updatedResidentMeta = {
          residentSignatureBucket: null,
          residentSignaturePath: null,
          residentSignatureFileName: null,
          residentSignatureMimeType: null,
          residentSignatureFileSize: null,
          residentSignatureUploadedAt: null
        };
      }

      // 4. Upload Inspector Signature
      if (inspectorSigFile) {
        const sigMeta = await QualityControlStorageHelper.uploadSignature("inspector", recordId, inspectorSigFile);
        newUploadedFiles.push({ bucket: sigMeta.bucket, path: sigMeta.path });
        updatedInspectorMeta = {
          inspectorSignatureBucket: sigMeta.bucket,
          inspectorSignaturePath: sigMeta.path,
          inspectorSignatureFileName: sigMeta.fileName,
          inspectorSignatureMimeType: sigMeta.mimeType,
          inspectorSignatureFileSize: sigMeta.fileSize,
          inspectorSignatureUploadedAt: sigMeta.uploadedAt
        };
      } else if (inspectorSigDeleted) {
        updatedInspectorMeta = {
          inspectorSignatureBucket: null,
          inspectorSignaturePath: null,
          inspectorSignatureFileName: null,
          inspectorSignatureMimeType: null,
          inspectorSignatureFileSize: null,
          inspectorSignatureUploadedAt: null
        };
      }

      const savedRecord: QualityControlRecord = {
        id: recordId,
        templateId: template.id,
        formTitle: template.title,
        category: template.category,
        formReference,
        revision,
        revisionDate,
        projectName,
        projectNumber,
        contractNumber,
        contractor,
        location,
        item,
        companyName,
        companyLogoBase64: "", // Clear old base64
        status,
        fields,
        checklistRows,
        contractorSignatureName,
        residentEngineerSignatureName,
        inspectorSignatureName,
        signoffDate,
        createdAt: recordToEdit ? recordToEdit.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),

        ...updatedLogoMeta,
        ...updatedContractorMeta,
        ...updatedResidentMeta,
        ...updatedInspectorMeta,

        // Carry forward existing DOCX values (if any)
        docxBucket: recordToEdit?.docxBucket || null,
        docxPath: recordToEdit?.docxPath || null,
        docxFileName: recordToEdit?.docxFileName || null,
        docxMimeType: recordToEdit?.docxMimeType || null,
        docxFileSize: recordToEdit?.docxFileSize || null,
        docxGeneratedAt: recordToEdit?.docxGeneratedAt || null,
      };

      await onSave(savedRecord);

      // After database update succeeds, delete previous storage objects if they were replaced or deleted
      if (logoFile && recordToEdit?.companyLogoPath) {
        await QualityControlStorageHelper.deleteFile(recordToEdit.companyLogoBucket!, recordToEdit.companyLogoPath!);
      } else if (logoDeleted && recordToEdit?.companyLogoPath) {
        await QualityControlStorageHelper.deleteFile(recordToEdit.companyLogoBucket!, recordToEdit.companyLogoPath!);
      }

      if (contractorSigFile && recordToEdit?.contractorSignaturePath) {
        await QualityControlStorageHelper.deleteFile(recordToEdit.contractorSignatureBucket!, recordToEdit.contractorSignaturePath!);
      } else if (contractorSigDeleted && recordToEdit?.contractorSignaturePath) {
        await QualityControlStorageHelper.deleteFile(recordToEdit.contractorSignatureBucket!, recordToEdit.contractorSignaturePath!);
      }

      if (residentSigFile && recordToEdit?.residentSignaturePath) {
        await QualityControlStorageHelper.deleteFile(recordToEdit.residentSignatureBucket!, recordToEdit.residentSignaturePath!);
      } else if (residentSigDeleted && recordToEdit?.residentSignaturePath) {
        await QualityControlStorageHelper.deleteFile(recordToEdit.residentSignatureBucket!, recordToEdit.residentSignaturePath!);
      }

      if (inspectorSigFile && recordToEdit?.inspectorSignaturePath) {
        await QualityControlStorageHelper.deleteFile(recordToEdit.inspectorSignatureBucket!, recordToEdit.inspectorSignaturePath!);
      } else if (inspectorSigDeleted && recordToEdit?.inspectorSignaturePath) {
        await QualityControlStorageHelper.deleteFile(recordToEdit.inspectorSignatureBucket!, recordToEdit.inspectorSignaturePath!);
      }

      setToast({ message: "Record saved successfully with all assets!", type: "success" });
    } catch (err: any) {
      console.error("Save error, performing rollback on uploaded files:", err);
      // Database update failed, remove uploaded Storage files
      for (const f of newUploadedFiles) {
        await QualityControlStorageHelper.deleteFile(f.bucket, f.path);
      }
      setToast({ message: "Failed to save record: " + (err.message || err.details || JSON.stringify(err)), type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-50/80 z-50 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-10 h-10 text-[#FF9F1C] animate-spin" />
          <div className="text-center">
            <h4 className="text-sm font-bold text-[#07182E]">Processing Assets...</h4>
            <p className="text-[11px] font-bold text-slate-400">Uploading binaries to secure Supabase Storage & updating record...</p>
          </div>
        </div>
      )}

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        {toast && (
          <div className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between ${
            toast.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Back Button and Title */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            type="button"
            className="p-1.5 hover:bg-slate-150 rounded-lg text-slate-500 transition-colors border border-slate-200 bg-white cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Quality Assurance Sheets &bull; {template.category}
            </span>
            <h2 className="text-base font-extrabold text-[#07182E] tracking-tight flex items-center gap-1.5">
              <FileText className="w-5 h-5 text-[#FF9F1C]" />
              {recordToEdit ? "Edit Quality Form" : "Create New Form"} &mdash; {template.title}
            </h2>
          </div>
        </div>

        {/* 1. BRAND IDENTITY & CUSTOM CONTRACTOR LOGO */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-3">
          <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Contractor Identity
          </h3>
          <CompanyLogoUploader
            logoFile={logoFile}
            onLogoFileChange={setLogoFile}
            onLogoDeleteExisting={() => setLogoDeleted(true)}
            existingBucket={logoDeleted ? null : recordToEdit?.companyLogoBucket}
            existingPath={logoDeleted ? null : recordToEdit?.companyLogoPath}
            logoBase64={companyLogoBase64}
            onLogoChange={setCompanyLogoBase64}
            companyName={companyName}
            onCompanyNameChange={setCompanyName}
          />
        </div>

        {/* 2. DOCUMENT CONTROL & REVISION METADATA */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
          <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Document Control Metadata
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Document Form Reference No.
              </label>
              <input
                type="text"
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Revision Number
              </label>
              <input
                type="text"
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Revision/Issue Date
              </label>
              <input
                type="date"
                value={revisionDate}
                onChange={(e) => setRevisionDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. CONTRACTUAL PROJECT METADATA */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
          <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2">
            3. Project & Contract Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Project Name
              </label>
              <input
                type="text"
                placeholder="e.g. Upgrade of National Route 1 Section 4"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Project Number
              </label>
              <input
                type="text"
                placeholder="e.g. PR-2026-N104"
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Contract Number
              </label>
              <input
                type="text"
                placeholder="e.g. NRA-1004-2025"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Main Contractor / Joint Venture
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Civil Engineering Joint Venture"
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Location Reference / Chainage / GPS Coordinates
              </label>
              <input
                type="text"
                placeholder="e.g. km 15+340 to km 15+600, Southbound Lane"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Specific Item / Element / Structure Reference
              </label>
              <input
                type="text"
                placeholder="e.g. Layer Sub-grade G7 Lift 2"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. DYNAMIC TECHNICAL SPECIFICATIONS / CUSTOM FIELDS */}
        {template.customFields.length > 0 && (
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
            <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2">
              4. Technical Specifications & Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {template.customFields.map((f) => (
                <div key={f.name}>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {f.label}
                  </label>
                  {f.type === "select" ? (
                    <select
                      value={String(fields[f.name] || "")}
                      onChange={(e) => handleFieldChange(f.name, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none bg-white text-slate-800"
                    >
                      <option value="">-- SELECT VALUE --</option>
                      {f.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      placeholder={f.placeholder}
                      value={String(fields[f.name] || "")}
                      onChange={(e) => handleFieldChange(f.name, e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
                    />
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : "text"}
                      placeholder={f.placeholder}
                      value={fields[f.name] !== undefined && fields[f.name] !== null ? String(fields[f.name]) : ""}
                      onChange={(e) => handleFieldChange(f.name, f.type === "number" ? parseFloat(e.target.value) || "" : e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. QUALITY ASSURANCE INSPECTION CHECKLIST (TABLE) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] overflow-hidden">
          <div className="p-5 border-b border-slate-150">
            <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider">
              5. Quality Assurance Checklist Table
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Verify compliance for each inspection criteria below. Enter measurements if specified.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 w-1/3 min-w-[220px] overflow-hidden text-ellipsis">Operation / Inspection Item</th>
                  {template.hasMeasurementColumns && (
                    <>
                      <th className="p-4 w-28 text-center overflow-hidden text-ellipsis">Specified</th>
                      <th className="p-4 w-28 text-center overflow-hidden text-ellipsis">Actual</th>
                    </>
                  )}
                  <th className="p-4 text-center w-40 overflow-hidden text-ellipsis">Status Check</th>
                  <th className="p-4 min-w-[200px] overflow-hidden text-ellipsis">Comments & Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {checklistRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                    {/* Item title */}
                    <td className="p-4 font-bold text-slate-700 leading-relaxed overflow-hidden text-ellipsis">
                      <div className="truncate" title={row.item}>
                        {row.item}
                      </div>
                    </td>

                    {/* Specified / Actual measurements */}
                    {template.hasMeasurementColumns && (
                      <>
                        <td className="p-4 text-center overflow-hidden text-ellipsis">
                          <input
                            type="text"
                            placeholder="e.g. 98%"
                            value={row.specified || ""}
                            onChange={(e) => handleChecklistRowChange(row.id, "specified", e.target.value)}
                            className="w-full px-2 py-1 text-center border border-slate-200 rounded-md text-xs font-semibold focus:border-[#FF9F1C] outline-none truncate"
                          />
                        </td>
                        <td className="p-4 text-center overflow-hidden text-ellipsis">
                          <input
                            type="text"
                            placeholder="e.g. 98.4%"
                            value={row.actual || ""}
                            onChange={(e) => handleChecklistRowChange(row.id, "actual", e.target.value)}
                            className="w-full px-2 py-1 text-center border border-slate-200 rounded-md text-xs font-semibold focus:border-[#FF9F1C] outline-none truncate"
                          />
                        </td>
                      </>
                    )}

                    {/* Check status Yes / No / N/A */}
                    <td className="p-4 text-center overflow-hidden text-ellipsis">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
                        {(["Yes", "No", "N/A"] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleChecklistRowChange(row.id, "acceptable", row.acceptable === opt ? "" : opt)}
                            className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                              row.acceptable === opt
                                ? opt === "Yes"
                                  ? "bg-emerald-500 text-white shadow-xs"
                                  : opt === "No"
                                  ? "bg-rose-500 text-white shadow-xs"
                                  : "bg-slate-500 text-white shadow-xs"
                                : "text-slate-400 hover:text-slate-600"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Comments */}
                    <td className="p-4 overflow-hidden text-ellipsis">
                      <input
                        type="text"
                        placeholder="Add remarks or corrective requirements..."
                        value={row.comments || ""}
                        onChange={(e) => handleChecklistRowChange(row.id, "comments", e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none truncate"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. SIGNATURES & SIGNOFFS */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.01)] space-y-4">
          <h3 className="text-xs font-bold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            6. Signatures & Digital Sign-off
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SignatureUploader
              label="Contractor Representative"
              name={contractorSignatureName}
              onNameChange={setContractorSignatureName}
              file={contractorSigFile}
              onFileChange={setContractorSigFile}
              onDeleteExisting={() => setContractorSigDeleted(true)}
              existingBucket={contractorSigDeleted ? null : recordToEdit?.contractorSignatureBucket}
              existingPath={contractorSigDeleted ? null : recordToEdit?.contractorSignaturePath}
              existingFileName={contractorSigDeleted ? null : recordToEdit?.contractorSignatureFileName}
            />

            <SignatureUploader
              label="Resident Engineer"
              name={residentEngineerSignatureName}
              onNameChange={setResidentEngineerSignatureName}
              file={residentSigFile}
              onFileChange={setResidentSigFile}
              onDeleteExisting={() => setResidentSigDeleted(true)}
              existingBucket={residentSigDeleted ? null : recordToEdit?.residentSignatureBucket}
              existingPath={residentSigDeleted ? null : recordToEdit?.residentSignaturePath}
              existingFileName={residentSigDeleted ? null : recordToEdit?.residentSignatureFileName}
            />

            <SignatureUploader
              label="Inspector / Assessor"
              name={inspectorSignatureName}
              onNameChange={setInspectorSignatureName}
              file={inspectorSigFile}
              onFileChange={setInspectorSigFile}
              onDeleteExisting={() => setInspectorSigDeleted(true)}
              existingBucket={inspectorSigDeleted ? null : recordToEdit?.inspectorSignatureBucket}
              existingPath={inspectorSigDeleted ? null : recordToEdit?.inspectorSignaturePath}
              existingFileName={inspectorSigDeleted ? null : recordToEdit?.inspectorSignatureFileName}
            />
          </div>

          <div className="pt-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Sign-off Date
            </label>
            <input
              type="date"
              value={signoffDate}
              onChange={(e) => setSignoffDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C] outline-none"
            />
          </div>
        </div>
      </div>

      {/* STICKY FOOTER ACTIONS */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-4 px-6 flex items-center justify-between shadow-[0px_-4px_16px_rgba(7,24,46,0.04)] z-10">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          {/* Save as Draft */}
          <button
            type="button"
            onClick={() => handleSaveTrigger("Draft")}
            className="px-4 py-2 border border-[#FF9F1C] text-[#FF9F1C] hover:bg-amber-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            Save Draft
          </button>

          {/* Complete / Final Sign-off options */}
          <div className="flex rounded-xl overflow-hidden shadow-xs border border-slate-200">
            <button
              type="button"
              onClick={() => handleSaveTrigger("Completed")}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs border-r border-slate-700 transition-all cursor-pointer"
            >
              Save Completed
            </button>
            <button
              type="button"
              onClick={() => handleSaveTrigger("Approved")}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              Approve Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
