import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { Upload, X, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ReportCategory, ReportFrequency } from "./types";
import { getInitialReportFormData } from "./defaults";

interface ManualReportUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  projectId: string;
  companyName: string;
  projectName: string;
  contractNumber: string;
  defaultCategory?: ReportCategory;
  defaultFrequency?: ReportFrequency;
}

export default function ManualReportUploadModal({
  onClose,
  onSuccess,
  companyId,
  projectId,
  companyName,
  projectName,
  contractNumber,
  defaultCategory = "Progress",
  defaultFrequency = "Daily"
}: ManualReportUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<ReportCategory>(defaultCategory);
  const [frequency, setFrequency] = useState<ReportFrequency>(defaultFrequency);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [reportTitle, setReportTitle] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Reports/ManualReportUploadModal.tsx");
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized user session.");

      const newReportId = self.crypto.randomUUID();

      // Calculate month and year
      const dateParts = reportDate.split("-");
      let reportYear = new Date().getFullYear();
      let reportMonth = "July";
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      if (dateParts.length >= 2) {
        reportYear = parseInt(dateParts[0], 10) || reportYear;
        const monthIdx = parseInt(dateParts[1], 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12) reportMonth = monthNames[monthIdx];
      }

      const initialFormData = getInitialReportFormData(projectName, companyName, contractNumber, category, frequency);
      initialFormData.report_title = reportTitle || `${category} ${frequency} Report`;
      initialFormData.report_date = reportDate;
      initialFormData.uploadType = "Manual";
      initialFormData.originalFileName = file.name;
      initialFormData.fileMimeType = file.type;

      // 1. Insert the reports row first and retrieve its id
      const insertPayload = {
        id: newReportId,
        company_id: companyId,
        project_id: projectId,
        category,
        frequency,
        report_date: reportDate,
        report_month: reportMonth,
        report_year: reportYear,
        report_number: `${category.slice(0, 3).toUpperCase()}-${frequency.slice(0, 1)}-${reportDate.replace(/-/g, "")}`,
        title: reportTitle || `${category} ${frequency} Report`,
        status: "Final",
        form_data: initialFormData,
        source_type: "Uploaded",
        created_by: user.id
      };

      const { data: insertedData, error: insertError } = await supabase
        .from("reports")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError) throw insertError;

      const reportId = insertedData?.id || newReportId;

      // 2. Upload the file to the reports bucket
      const sanitizedFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const storagePath = `${companyId}/${projectId}/${reportId}/${sanitizedFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("reports")
        .upload(storagePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      // 3. Update file_path, docx_file_path, original_file_name, file_mime_type, file_size_bytes
      const { error: updateError } = await supabase
        .from("reports")
        .update({
          file_path: storagePath,
          docx_file_path: storagePath,
          original_file_name: file.name,
          file_mime_type: file.type,
          file_size_bytes: file.size,
          source_type: "Uploaded"
        })
        .eq("id", reportId);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Manual report upload error:", err);
      setErrorMsg(err.message || "Failed to upload report file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Upload Report File</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select File</label>
            <input
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Progress">Progress</option>
                <option value="Environmental">Environmental</option>
                <option value="Occupational Health and Safety">Occupational Health and Safety</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ReportFrequency)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Report Title</label>
              <input
                type="text"
                placeholder="e.g. Environmental Site Audit"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Reporting Date</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Upload & Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
