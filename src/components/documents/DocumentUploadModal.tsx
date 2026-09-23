import { assertOperationalAction } from "../../integration/operationalAccess";
/**
 * Project Matrix – Master Document Controlled Upload & Ingestion Modal
 */

import React, { useState, useEffect } from "react";
import {
  Upload,
  X,
  FileText,
  Calendar,
  Hash,
  Layers,
  ShieldCheck,
  AlertCircle,
  Clock,
  Link as LinkIcon,
  CheckCircle,
  FileCheck2,
  Lock,
  Compass,
  Zap
} from "lucide-react";
import {
  DOCUMENT_MAIN_CATEGORIES,
  MAIN_CATEGORY_DEFINITIONS,
  DRAWING_DISCIPLINES,
  SURVEY_CATEGORIES,
  WAYLEAVE_CATEGORIES,
  isExpiringCategory
} from "./documentHierarchy";
import {
  DocumentMainCategory,
  ProjectDocument,
  DocumentStatus,
  ApprovalStatus,
  ConfidentialityLevel
} from "../../types/documentManagement";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
  isUploading: boolean;
  initialCategory?: DocumentMainCategory | null;
  initialSubcategory?: string | null;
  initialDiscipline?: string | null;
  activeProject: any;
  activeCompany: any;
  existingDocuments?: ProjectDocument[];
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isUploading,
  initialCategory,
  initialSubcategory,
  initialDiscipline,
  activeProject,
  activeCompany,
  existingDocuments = []
}) => {
  const [mainCategory, setMainCategory] = useState<DocumentMainCategory>(
    initialCategory || "Statutory Documents"
  );
  const [subcategory, setSubcategory] = useState<string>(
    initialSubcategory || "Signed Contract"
  );
  const [discipline, setDiscipline] = useState<string>(
    initialDiscipline || "Civil Engineering"
  );
  const [surveyTier, setSurveyTier] = useState<string>("Design Survey");
  const [wayleaveType, setWayleaveType] = useState<string>("Roads Agencies");

  // Form Fields
  const [title, setTitle] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [revision, setRevision] = useState("R00");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>("Internal");
  const [status, setStatus] = useState<DocumentStatus>("Draft");
  
  // Specific contextual fields
  const [expiryDate, setExpiryDate] = useState("");
  const [responseRequired, setResponseRequired] = useState(false);
  const [responseDueDate, setResponseDueDate] = useState("");
  const [contractClause, setContractClause] = useState("");
  const [relatedActivity, setRelatedActivity] = useState("");

  // File handling
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Sync initial props
  useEffect(() => {
    if (initialCategory) setMainCategory(initialCategory);
    if (initialSubcategory) setSubcategory(initialSubcategory);
    if (initialDiscipline) setDiscipline(initialDiscipline);
  }, [initialCategory, initialSubcategory, initialDiscipline, isOpen]);

  // Update subcategory when main category changes
  useEffect(() => {
    const def = MAIN_CATEGORY_DEFINITIONS.find(c => c.id === mainCategory);
    if (def && !def.subcategories.includes(subcategory as any)) {
      setSubcategory(def.subcategories[0]);
    }
  }, [mainCategory]);

  // Auto-generate document number suggestion if empty
  useEffect(() => {
    if (!documentNumber && activeProject?.code) {
      const projCode = (activeProject.code || "PMX").toUpperCase();
      let prefix = "DOC";
      if (mainCategory === "Statutory Documents") prefix = "STAT";
      else if (mainCategory === "Project Correspondence") prefix = "CORR";
      else if (mainCategory === "Specifications") prefix = subcategory === "Drawings" ? "DWG" : "SPEC";
      else if (mainCategory === "Permits & Licenses") prefix = "PMT";

      const randSeq = Math.floor(1000 + Math.random() * 9000);
      setDocumentNumber(`${projCode}-${prefix}-${randSeq}-${revision}`);
    }
  }, [mainCategory, subcategory, activeProject?.code, revision]);

  // Check for duplicates before submission
  useEffect(() => {
    if (documentNumber.trim() && revision.trim()) {
      const dup = existingDocuments.find(d => 
        d.document_number?.toLowerCase() === documentNumber.trim().toLowerCase() &&
        d.revision?.toLowerCase() === revision.trim().toLowerCase()
      );
      if (dup) {
        setDuplicateWarning(`Document number "${documentNumber}" at revision "${revision}" already exists (${dup.document_title}). Uploading will create a tracked revision update.`);
      } else {
        setDuplicateWarning(null);
      }
    }
  }, [documentNumber, revision, existingDocuments]);

  if (!isOpen) return null;

  const isExpiring = isExpiringCategory(mainCategory, subcategory);
  const isCorrespondence = mainCategory === "Project Correspondence";
  const isDrawings = mainCategory === "Specifications" && subcategory === "Drawings";
  const isSurvey = isDrawings && discipline === "Survey";
  const isWayleaves = mainCategory === "Permits & Licenses" && subcategory === "Wayleaves";

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/documents/DocumentUploadModal.tsx");
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("Document Title is mandatory.");
      return;
    }
    if (!file) {
      setErrorMsg("Please select or drop a physical file to upload.");
      return;
    }

    try {
      await onSubmit({
        mainCategory,
        subcategory,
        discipline: isDrawings ? discipline : undefined,
        surveyTier: isSurvey ? surveyTier : undefined,
        wayleaveType: isWayleaves ? wayleaveType : undefined,
        title: title.trim(),
        documentNumber: documentNumber.trim(),
        revision: revision.trim() || "R00",
        documentDate,
        description: description.trim(),
        confidentiality,
        status,
        expiryDate: isExpiring ? expiryDate : undefined,
        responseRequired: isCorrespondence ? responseRequired : false,
        responseDueDate: isCorrespondence && responseRequired ? responseDueDate : undefined,
        contractClause: contractClause.trim() || undefined,
        relatedActivity: relatedActivity.trim() || undefined,
        file
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload document.");
    }
  };

  const currentCategoryDef = MAIN_CATEGORY_DEFINITIONS.find(c => c.id === mainCategory);

  return (
    <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up"
      >
        {/* Header */}
        <div className="bg-[#07182E] p-5 text-white flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Controlled CDE Ingestion
            </span>
            <h3 className="text-base font-extrabold flex items-center gap-2 mt-0.5 tracking-tight">
              <Upload className="w-4 h-4 text-[#FF9F1C]" />
              Upload Controlled Project Document
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-140px)]">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* 1. Category & Subcategory Selection */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              1. Master Category & Subtab Alignment
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Primary Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={mainCategory}
                  onChange={(e) => setMainCategory(e.target.value as DocumentMainCategory)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                >
                  {DOCUMENT_MAIN_CATEGORIES.map((cat, idx) => (
                    <option key={`${cat}-${idx}`} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Subcategory Subtab <span className="text-rose-500">*</span>
                </label>
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                >
                  {currentCategoryDef?.subcategories.map((sub, idx) => (
                    <option key={`${sub}-${idx}`} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Disciplinary tier if Drawings */}
            {isDrawings && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 animate-fade-in">
                <div>
                  <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                    Drawing Discipline <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                  >
                    {DRAWING_DISCIPLINES.map((d, idx) => (
                      <option key={`${d}-${idx}`} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {isSurvey && (
                  <div>
                    <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                      Survey Phase <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={surveyTier}
                      onChange={(e) => setSurveyTier(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                    >
                      {SURVEY_CATEGORIES.map((s, idx) => (
                        <option key={`${s}-${idx}`} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Utility tier if Wayleaves */}
            {isWayleaves && (
              <div className="pt-2 border-t border-slate-200/60 animate-fade-in">
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Wayleave Authority Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={wayleaveType}
                  onChange={(e) => setWayleaveType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                >
                  {WAYLEAVE_CATEGORIES.map((w, idx) => (
                    <option key={`${w}-${idx}`} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Document Identification */}
          <div className="space-y-3.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              2. Document Metadata & Numbering
            </span>

            <div>
              <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                Document Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Subcontractor Performance Guarantee or General Civil Layout"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Document Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="e.g. PMX-CIV-DWG-0042"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Revision Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  placeholder="e.g. R00, R01, Rev A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Document Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                  required
                />
              </div>
            </div>

            {/* Contextual: Expiry Date for Guarantees, Insurances, Permits */}
            {isExpiring && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Expiration Tracking (Automated Alerts Triggered at 90, 60, 30 & 14 days)</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                    Expiration Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-[#07182E] focus:border-amber-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Contextual: Response Tracking for Correspondence */}
            {isCorrespondence && (
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-900 text-xs font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" /> Response Tracking Required
                  </span>
                  <input
                    type="checkbox"
                    checked={responseRequired}
                    onChange={(e) => setResponseRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                {responseRequired && (
                  <div>
                    <label className="text-[10px] font-bold text-indigo-900 uppercase block mb-1">
                      Response Due Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={responseDueDate}
                      onChange={(e) => setResponseDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-semibold text-[#07182E] focus:border-indigo-500 outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Confidentiality Level
                </label>
                <select
                  value={confidentiality}
                  onChange={(e) => setConfidentiality(e.target.value as ConfidentialityLevel)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                >
                  <option value="Internal">Internal (Project Team)</option>
                  <option value="Confidential">Confidential (Executive / Commercial)</option>
                  <option value="Restricted">Restricted (Design / Statutory Only)</option>
                  <option value="Public">Public</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DocumentStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-[#07182E] focus:border-[#FF9F1C] outline-none"
                >
                  <option value="Draft">Draft</option>
                  <option value="Internal Review">Submit for Technical Review</option>
                  <option value="Approved">Approved / Issued</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                Description / Engineering Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope description, clause references, or transmittal instructions..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-[#07182E] focus:border-[#FF9F1C] outline-none resize-none"
              />
            </div>
          </div>

          {/* 3. Physical File Dropzone */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              3. Physical Attachment
            </span>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`p-5 border-2 border-dashed rounded-2xl text-center transition-all ${
                dragActive
                  ? "border-[#FF9F1C] bg-[#FF9F1C]/5"
                  : file
                  ? "border-emerald-300 bg-emerald-50/40"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
              }`}
            >
              {file ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-left">
                    <span className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                      <FileCheck2 className="w-5 h-5" />
                    </span>
                    <div>
                      <span className="text-xs font-bold text-[#07182E] block truncate max-w-[280px]">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || "Document"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-7 h-7 text-slate-400 mx-auto stroke-1" />
                  <div>
                    <span className="text-xs font-bold text-[#07182E] block">
                      Drag and drop file here, or{" "}
                      <label className="text-[#FF9F1C] hover:underline cursor-pointer">
                        browse device
                        <input
                          type="file"
                          onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-1">
                      Supports PDF, DWG, DXF, XLSX, DOCX, CSV, PNG, JPG (up to 50MB)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-[#07182E] rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading}
            className="px-5 py-2.5 bg-[#FF9F1C] hover:bg-[#FFB020] disabled:bg-slate-300 text-white rounded-xl text-xs font-extrabold shadow-md shadow-[#FF9F1C]/20 transition-all flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Ingesting to CDE...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Ingest Controlled Document</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
