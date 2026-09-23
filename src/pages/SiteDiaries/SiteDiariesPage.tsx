import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  BookOpen, 
  Plus, 
  Clock, 
  MessageSquare, 
  AlertCircle, 
  X, 
  Calendar, 
  FileText, 
  Trash2, 
  Edit, 
  Eye, 
  Upload, 
  Paperclip, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Terminal,
  ChevronRight,
  Folder,
  ArrowLeft
} from "lucide-react";
import { supabase, isApiKeyError } from "../../lib/supabase";
import { validateTenantContext } from "../../utils/tenantGuard";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import ProjectShell from "../../components/layout/ProjectShell";
import { CrudAdapter } from "../../services/crudAdapter";

interface SiteDiary {
  id: string;
  company_id: string;
  project_id: string;
  diary_date: string;
  diary_time: string;
  log_category: string;
  details: string;
  logged_by: string;
  has_delay: boolean;
  delay_reason: string;
  attachment_path: string | null;
  attachment_file_name?: string | null;
  attachment_file_type?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Helpers for folders and South African date formatting
function getFolderKeyFromDate(dateStr: string): string {
  if (!dateStr) return "Unknown Month";
  const parts = dateStr.split("-");
  if (parts.length < 2) return "Unknown Month";
  const year = parseInt(parts[0]);
  const monthIdx = parseInt(parts[1]) - 1; // 0-indexed month
  if (isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return "Unknown Month";
  }
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${monthNames[monthIdx]} ${year}`;
}

function formatSouthAfricanDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const monthName = monthNames[monthIdx] || parts[1];
  const dayStr = day < 10 ? `0${day}` : `${day}`;
  return `${dayStr} ${monthName} ${year}`;
}

export default function SiteDiariesPage() {
  const { profile, activeCompany, activeProject } = useOutletContext<any>();
  const { formatDate: globalFormatDate, formatDateTime: globalFormatDateTime, getTodayInTimezone } = useRegionalSettings();

  // Page States
  const [diaries, setDiaries] = useState<SiteDiary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Date search/filter states
  const [selectedSearchDate, setSelectedSearchDate] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  
  // SQL Helper drawer state if tables are missing
  const [tableMissing, setTableMissing] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Modals visibility
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingDiary, setViewingDiary] = useState<SiteDiary | null>(null);
  const [diaryToDeleteId, setDiaryToDeleteId] = useState<string | null>(null);

  // Attachment Viewer State
  const [viewingFileUrl, setViewingFileUrl] = useState<string | null>(null);
  const [viewingFileName, setViewingFileName] = useState("");
  const [viewingFileType, setViewingFileType] = useState("");
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isViewerLoading, setIsViewerLoading] = useState(false);

  // Form Fields State
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [diaryDate, setDiaryDate] = useState("");
  const [diaryTime, setDiaryTime] = useState("");
  const [logCategory, setLogCategory] = useState("Equipment Delivery");
  const [details, setDetails] = useState("");
  const [loggedBy, setLoggedBy] = useState("");
  const [hasDelay, setHasDelay] = useState(false);
  const [delayReason, setDelayReason] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentDragActive, setAttachmentDragActive] = useState(false);

  // Group diaries by Month/Year Folder and calculate folder metadata
  const folderData = useMemo(() => {
    const folders: Record<string, { count: number; latestDate: string; diaries: SiteDiary[] }> = {};
    
    diaries.forEach(d => {
      const folderKey = getFolderKeyFromDate(d.diary_date);
      if (folderKey === "Unknown Month") return;
      
      if (!folders[folderKey]) {
        folders[folderKey] = {
          count: 0,
          latestDate: d.diary_date,
          diaries: []
        };
      }
      folders[folderKey].diaries.push(d);
      folders[folderKey].count += 1;
      
      // Update latest diary date in this folder
      if (new Date(d.diary_date) > new Date(folders[folderKey].latestDate)) {
        folders[folderKey].latestDate = d.diary_date;
      }
    });

    // Sort folders descending by their latest diary date
    return Object.entries(folders)
      .map(([key, data]) => ({
        key,
        ...data
      }))
      .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());
  }, [diaries]);

  // Helpers for formatting
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return globalFormatDate(dateStr);
  };

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // '0' becomes '12'
    const hoursStr = hours < 10 ? `0${hours}` : hours;
    return `${hoursStr}:${minutes} ${ampm}`;
  };

  const formatUploadedAt = (isoStr: string) => {
    if (!isoStr) return "";
    return globalFormatDateTime(isoStr, true);
  };

  const generateUUID = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Load diaries from CrudAdapter (Supabase + LocalStorage sync)
  const loadDiaries = async (searchDate?: string) => {
    if (!activeCompany?.id || !activeProject?.id) {
      setDiaries([]);
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setTableMissing(false);
    try {
      const records = await CrudAdapter.getRecords<SiteDiary>({
        tableName: "site_diaries",
        companyId: activeProject.company_id || activeCompany.id,
        projectId: activeProject.id,
        orderByField: "diary_date",
        orderAscending: false
      });

      if (searchDate) {
        setDiaries(records.filter(r => r.diary_date === searchDate));
      } else {
        setDiaries(records);
      }
    } catch (err: any) {
      console.warn("Notice loading diaries:", err);
      setErrorMsg("Failed to load site diaries: " + (err.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiaries(selectedSearchDate);
  }, [activeCompany?.id, activeProject?.id, selectedSearchDate]);

  // Open modal for new entry
  const handleOpenNewForm = () => {
    setEditingDiaryId(null);
    setDiaryDate(new Date().toISOString().split("T")[0]);
    
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setDiaryTime(`${hours}:${minutes}`);

    setLogCategory("Equipment Delivery");
    setDetails("");
    setLoggedBy(profile?.full_name || "Site Agent");
    setHasDelay(false);
    setDelayReason("");
    setAttachmentFile(null);
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  // Open modal for editing
  const handleOpenEditForm = (diary: SiteDiary) => {
    setEditingDiaryId(diary.id);
    setDiaryDate(diary.diary_date);
    setDiaryTime(diary.diary_time ? diary.diary_time.substring(0, 5) : "");
    setLogCategory(diary.log_category);
    setDetails(diary.details);
    setLoggedBy(diary.logged_by || "");
    setHasDelay(diary.has_delay);
    setDelayReason(diary.delay_reason || "");
    setAttachmentFile(null); // Keep existing file unless a new one is selected
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  // Save Site Diary Entry
  const handleSaveDiary = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/SiteDiaries/SiteDiariesPage.tsx");
    e.preventDefault();
    if (!activeCompany?.id || !activeProject?.id) {
      setErrorMsg("Please ensure a company and project are selected.");
      return;
    }
    if (!details.trim()) {
      setErrorMsg("Please enter the details / log message.");
      return;
    }

    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let authUserId = profile?.id;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) authUserId = user.id;
      } catch (e) {}

      if (!activeProject?.id) {
        throw new Error("No active project is selected. Please select a valid project.");
      }

      const companyId = activeProject.company_id || activeCompany?.id || "comp_demo_matrix_01";
      const projectId = activeProject.id;
      const createdBy = authUserId || "usr_site_agent";

      const isEditing = !!editingDiaryId;
      const diaryId = editingDiaryId || generateUUID();
      const existingDiary = isEditing ? diaries.find(d => d.id === editingDiaryId) : null;
      let attachmentPath = existingDiary?.attachment_path || null;
      let attachmentFileName = existingDiary?.attachment_file_name || null;
      let attachmentFileType = existingDiary?.attachment_file_type || null;

      // Handle Attachment Upload safely
      if (attachmentFile) {
        const path = `${companyId}/${projectId}/${diaryId}/${attachmentFile.name}`;
        try {
          const { error: uploadErr } = await supabase.storage
            .from("site-diary-attachments")
            .upload(path, attachmentFile, {
              upsert: true
            });

          if (!uploadErr) {
            attachmentPath = path;
          }
        } catch (uploadErr) {
          console.warn("Storage upload notice:", uploadErr);
        }
        attachmentFileName = attachmentFile.name;
        attachmentFileType = attachmentFile.type || "application/octet-stream";
      }

      const payload = {
        id: diaryId,
        company_id: companyId,
        project_id: projectId,
        diary_date: diaryDate,
        diary_time: diaryTime || null,
        log_category: logCategory,
        details: details,
        logged_by: loggedBy || profile?.full_name || "Site Agent",
        has_delay: hasDelay,
        delay_reason: hasDelay ? delayReason : null,
        attachment_path: attachmentPath,
        attachment_file_name: attachmentFileName,
        attachment_file_type: attachmentFileType,
        created_by: createdBy,
        created_at: existingDiary?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await CrudAdapter.saveRecord<SiteDiary>({
        tableName: "site_diaries",
        companyId,
        projectId
      }, payload);

      setSuccessMsg(isEditing ? "Site diary entry updated successfully." : "New site diary entry created successfully.");
      setIsFormOpen(false);
      await loadDiaries(selectedSearchDate);
    } catch (err: any) {
      console.error("Error saving diary entry:", err);
      setErrorMsg(err.message || "Failed to save site diary entry.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Delete Site Diary Entry
  const handleDeleteDiary = async () => {
    assertOperationalAction("delete", "pages/SiteDiaries/SiteDiariesPage.tsx");
    if (!diaryToDeleteId) return;
    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const companyId = activeProject?.company_id || activeCompany?.id || "comp_demo_matrix_01";
      const projectId = activeProject?.id || "";

      await CrudAdapter.deleteRecord({
        tableName: "site_diaries",
        companyId,
        projectId
      }, diaryToDeleteId);

      setSuccessMsg("Site diary entry has been deleted successfully.");
      setDiaries(prev => prev.filter(d => d.id !== diaryToDeleteId));
      setDiaryToDeleteId(null);
    } catch (err: any) {
      console.error("Error deleting diary entry:", err);
      setErrorMsg("Failed to delete diary entry: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Download attachment helper
  const handleDownloadAttachment = async (path: string, fileName?: string) => {
    assertOperationalAction("export", "pages/SiteDiaries/SiteDiariesPage.tsx");
    try {
      const { data, error } = await supabase.storage
        .from("site-diary-attachments")
        .download(path);

      if (error) throw error;
      if (!data) throw new Error("No file content received.");

      const downloadUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName || path.split("/").pop() || "attachment";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error("Error downloading attachment:", err);
      alert("Failed to download attachment: " + err.message);
    }
  };

  // View attachment helper
  const handleViewAttachment = async (path: string, fileName: string, fileType: string) => {
    setIsViewerLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.storage
        .from("site-diary-attachments")
        .download(path);

      if (error) throw error;
      if (!data) throw new Error("No file content received.");

      const mimeType = fileType || data.type || "application/octet-stream";
      const blob = new Blob([data], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);

      setViewingFileUrl(objectUrl);
      setViewingFileName(fileName);
      setViewingFileType(mimeType);
      setIsViewerOpen(true);
    } catch (err: any) {
      console.error("Error fetching attachment for viewing:", err);
      setErrorMsg("Failed to view attachment: " + err.message);
    } finally {
      setIsViewerLoading(false);
    }
  };

  const handleCloseViewer = () => {
    if (viewingFileUrl) {
      URL.revokeObjectURL(viewingFileUrl);
    }
    setViewingFileUrl(null);
    setViewingFileName("");
    setViewingFileType("");
    setIsViewerOpen(false);
  };

  const handleOpenInNewTab = () => {
    if (viewingFileUrl) {
      const newTab = window.open(viewingFileUrl, "_blank");
      if (!newTab) {
        alert("The popup was blocked by your browser. Please allow popups to open the document.");
      }
    }
  };

  const handleCopySql = () => {
    const sqlText = sqlString;
    navigator.clipboard.writeText(sqlText);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  // Drag and drop attachment file helpers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setAttachmentDragActive(true);
    } else if (e.type === "dragleave") {
      setAttachmentDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAttachmentDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setAttachmentFile(e.dataTransfer.files[0]);
    }
  };

  // SQL Strings to set up required databases and policies
  const sqlString = `-- 1. SITE DIARIES TABLE
CREATE TABLE IF NOT EXISTS public.site_diaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  diary_date date NOT NULL,
  diary_time time,
  log_category text NOT NULL,
  details text NOT NULL,
  logged_by text,
  has_delay boolean DEFAULT false,
  delay_reason text,
  attachment_path text,
  attachment_file_name text,
  attachment_file_type text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.site_diaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS site_diaries_select_policy ON public.site_diaries;
DROP POLICY IF EXISTS site_diaries_insert_policy ON public.site_diaries;
DROP POLICY IF EXISTS site_diaries_update_policy ON public.site_diaries;
DROP POLICY IF EXISTS site_diaries_delete_policy ON public.site_diaries;

-- Create Policies based on company/project memberships
CREATE POLICY site_diaries_select_policy ON public.site_diaries
  FOR SELECT
  USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY site_diaries_insert_policy ON public.site_diaries
  FOR INSERT
  WITH CHECK (public.verify_membership_access(company_id, project_id));

CREATE POLICY site_diaries_update_policy ON public.site_diaries
  FOR UPDATE
  USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY site_diaries_delete_policy ON public.site_diaries
  FOR DELETE
  USING (public.verify_membership_access(company_id, project_id));


-- 2. PRIVATE ATTACHMENT STORAGE BUCKET "site-diary-attachments"
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-diary-attachments', 'site-diary-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DROP POLICY IF EXISTS "site_diaries_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "site_diaries_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "site_diaries_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "site_diaries_storage_delete" ON storage.objects;

-- Create Storage Policies using existing verification and path uuid parsing
CREATE POLICY "site_diaries_storage_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'site-diary-attachments' AND
    public.verify_membership_access(
      public.parse_path_uuid(split_part(storage.objects.name, '/', 1)),
      public.parse_path_uuid(split_part(storage.objects.name, '/', 2))
    )
  );

CREATE POLICY "site_diaries_storage_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'site-diary-attachments' AND
    public.verify_membership_access(
      public.parse_path_uuid(split_part(storage.objects.name, '/', 1)),
      public.parse_path_uuid(split_part(storage.objects.name, '/', 2))
    )
  );

CREATE POLICY "site_diaries_storage_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'site-diary-attachments' AND
    public.verify_membership_access(
      public.parse_path_uuid(split_part(storage.objects.name, '/', 1)),
      public.parse_path_uuid(split_part(storage.objects.name, '/', 2))
    )
  );

CREATE POLICY "site_diaries_storage_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'site-diary-attachments' AND
    public.verify_membership_access(
      public.parse_path_uuid(split_part(storage.objects.name, '/', 1)),
      public.parse_path_uuid(split_part(storage.objects.name, '/', 2))
    )
  );`;


  return (
    <ProjectShell project={activeProject} section="field">
      <div className="space-y-6">
        {/* HEADER SECTION */}
      <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#07182E] tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#FF9F1C]" />
            Site Diaries
          </h1>
          <p className="text-xs text-[#64748B] mt-1">Record daily site activities.</p>
        </div>
        
        {activeProject && !tableMissing && (
          <button
            onClick={handleOpenNewForm}
            className="px-4.5 py-2.5 bg-[#FF9F1C] hover:bg-[#ff8f00] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-[#FF9F1C]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Upload Diary Entry</span>
          </button>
        )}
      </div>

      {/* FEEDBACK MESSAGES */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
          <div className="text-xs font-semibold leading-relaxed">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3 text-emerald-800 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <div className="text-xs font-semibold leading-relaxed">{successMsg}</div>
        </div>
      )}

      {/* MISSING TABLE SQL ALERTS */}
      {tableMissing && (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#07182E]">Database Setup Required</h3>
              <p className="text-xs text-slate-500">The site_diaries database table or its storage bucket is not configured yet.</p>
            </div>
          </div>
          
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Please run the SQL script below in the SQL Editor of your Supabase console to create the table, attach row-level security (RLS) policies, and construct the storage configuration.
          </p>

          <div className="bg-[#07182E] rounded-2xl p-4 font-mono text-[10px] text-slate-300 max-h-64 overflow-y-auto border border-slate-800 shadow-inner relative group">
            <button
              onClick={handleCopySql}
              className="absolute right-4 top-4 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              {sqlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Terminal className="w-3.5 h-3.5" />}
              <span>{sqlCopied ? "Copied" : "Copy SQL"}</span>
            </button>
            <pre className="whitespace-pre-wrap">{sqlString}</pre>
          </div>
        </div>
      )}

      {/* CORE WORKSPACE CHECK */}
      {!activeProject ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <Calendar className="w-12 h-12 text-[#FF9F1C] mx-auto animate-bounce" />
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#07182E]">No Project Selected</h3>
            <p className="text-xs text-[#64748B]">Please select an active project in the workspace header to view and record site diaries.</p>
          </div>
        </div>
      ) : !tableMissing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: ACTIVITY & DELAY SUMMARY */}
          <div className="space-y-6">
            {/* Quick Summary Card */}
            <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.03)] space-y-4">
              <h3 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wider border-b border-slate-100 pb-2">
                Project Matrix Overview
              </h3>
              
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Active Project</span>
                  <span className="text-xs font-bold text-[#07182E] max-w-[150px] truncate">{activeProject.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Logged Entries</span>
                  <span className="text-xs font-extrabold text-[#07182E] font-mono">{diaries.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Total Delay Logged</span>
                  <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded text-[10px] font-bold font-mono">
                    {diaries.filter(d => d.has_delay).length} entries
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <button
                  onClick={handleOpenNewForm}
                  className="w-full py-2.5 bg-[#07182E] hover:bg-[#1E3A5F] text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FF9F1C]" />
                  <span>Log Activity Entry</span>
                </button>
              </div>
            </div>

            {/* Delay Alert Helper */}
            {diaries.some(d => d.has_delay) && (
              <div className="bg-red-50/50 p-5 border border-red-100 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <h4 className="text-xs font-extrabold text-red-900">Current Site Delays</h4>
                </div>
                <p className="text-[11px] text-red-700 leading-relaxed font-medium">
                  The delays highlighted below require urgent attention and contractual compensation claim scheduling.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {diaries.filter(d => d.has_delay).slice(0, 3).map(d => (
                    <div key={d.id} className="bg-white p-2.5 rounded-lg border border-red-100 text-[10px] text-slate-700 font-semibold space-y-1">
                      <div className="flex justify-between items-center text-red-800 font-bold">
                        <span>{d.log_category}</span>
                        <span>{formatDate(d.diary_date)}</span>
                      </div>
                      <p className="text-slate-500 line-clamp-2 leading-relaxed font-medium">{d.delay_reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: TIMELINE FEED */}
          <div className="lg:col-span-2 bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.03)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <h3 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wider flex items-center gap-1.5">
                <span>Site Diaries Log Feed</span>
                {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
              </h3>

              {/* DATE SEARCH & FILTER SECTION */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedSearchDate}
                  onChange={(e) => {
                    setSelectedSearchDate(e.target.value);
                    setSelectedFolder(null); // Clear active month folder when date search changes
                  }}
                  className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none"
                />
                {selectedSearchDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSearchDate("");
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer border border-slate-200 transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            {selectedSearchDate && (
              <div className="text-[11px] text-[#07182E] font-medium bg-[#FF9F1C]/10 px-3 py-2 border border-[#FF9F1C]/20 rounded-lg flex items-center justify-between">
                <span>Filtering site diary entries for: <strong className="text-[#FF9F1C]">{formatSouthAfricanDate(selectedSearchDate)}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedSearchDate("")}
                  className="text-slate-500 hover:text-slate-800 text-[10px] font-bold underline"
                >
                  Show All
                </button>
              </div>
            )}

            {selectedSearchDate ? (
              /* SPECIFIC DATE FILTER RESULTS */
              diaries.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">
                    No site diary entries found for {formatSouthAfricanDate(selectedSearchDate)}.
                  </p>
                </div>
              ) : (
                <div className="relative border-l border-slate-100 pl-6 ml-2.5 space-y-6">
                  {diaries.map((log) => (
                    <div key={log.id} className="relative">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[32.5px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white border-2 border-[#FF9F1C] shadow-xs">
                        <span className="h-2 w-2 rounded-full bg-[#FF9F1C]" />
                      </span>

                      <div className="space-y-2 bg-slate-50/45 p-4.5 rounded-2xl border border-slate-100 hover:bg-slate-50/80 transition-all duration-150">
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100/50 pb-2">
                          <div className="space-y-0.5">
                            <span className="text-xs font-extrabold text-[#07182E] block">{log.log_category}</span>
                            <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 font-medium">
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-3 h-3" /> {formatDate(log.diary_date)}
                              </span>
                              {log.diary_time && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> {formatTime12h(log.diary_time)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {log.has_delay && (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-150 rounded-md text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                                <AlertCircle className="w-3 h-3" />
                                Site Delay
                              </span>
                            )}
                            
                            <button
                              onClick={() => setViewingDiary(log)}
                              className="p-1.5 hover:bg-white text-slate-400 hover:text-[#07182E] rounded-lg transition-colors border border-transparent hover:border-slate-150 cursor-pointer"
                              title="View Entry"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleOpenEditForm(log)}
                              className="p-1.5 hover:bg-white text-slate-400 hover:text-blue-600 rounded-lg transition-colors border border-transparent hover:border-slate-150 cursor-pointer"
                              title="Edit Entry"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setDiaryToDeleteId(log.id)}
                              className="p-1.5 hover:bg-white text-slate-400 hover:text-rose-600 rounded-lg transition-colors border border-transparent hover:border-slate-150 cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-[#334155] leading-relaxed font-medium whitespace-pre-wrap">{log.details}</p>

                        {log.has_delay && log.delay_reason && (
                          <div className="bg-rose-50/30 border border-rose-100/50 p-2.5 rounded-xl text-[11px] text-rose-800 space-y-0.5 font-medium">
                            <span className="font-extrabold uppercase text-[9px] tracking-wider text-rose-600 block">Delay Reason:</span>
                            <p>{log.delay_reason}</p>
                          </div>
                        )}

                        {/* Attachments Section */}
                        {log.attachment_path && (
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => handleViewAttachment(log.attachment_path!, log.attachment_file_name || log.attachment_path!.split("/").pop() || "file", log.attachment_file_type || "")}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FF9F1C]/10 hover:bg-[#FF9F1C]/20 text-[10px] font-extrabold text-[#07182E] rounded-lg transition-all shadow-2xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#FF9F1C]" />
                              <span>View Attachment</span>
                            </button>
                            
                            <button
                              onClick={() => handleDownloadAttachment(log.attachment_path!, log.attachment_file_name || log.attachment_path!.split("/").pop() || "file")}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-600 hover:text-[#07182E] border border-slate-200 rounded-lg transition-all shadow-2xs cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-400" />
                              <span>Download Attachment</span>
                            </button>
                          </div>
                        )}

                        {/* Footer Log Information */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100/30 text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                          <span>Logged by: <strong className="text-slate-500">{log.logged_by || "Unknown"}</strong></span>
                          <span>Uploaded: <strong className="text-slate-500">{formatUploadedAt(log.created_at)}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* FOLDER OR GROUPED FEED */
              diaries.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400">No site diary entries have been recorded yet.</p>
                    <p className="text-[11px] text-slate-400/80">Click "Log Activity Entry" to add the very first record for this project.</p>
                  </div>
                </div>
              ) : !selectedFolder ? (
                /* MONTH FOLDERS GRID */
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Indexed Month Folders
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {diaries.length} entries total
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {folderData.map((folder) => (
                      <button
                        key={folder.key}
                        type="button"
                        onClick={() => setSelectedFolder(folder.key)}
                        className="group bg-slate-50 hover:bg-white border border-slate-200/60 p-4.5 rounded-xl shadow-2xs hover:shadow-xs hover:border-[#FF9F1C]/40 transition-all cursor-pointer text-left flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="p-2.5 bg-[#FF9F1C]/10 group-hover:bg-[#FF9F1C]/20 rounded-xl text-[#FF9F1C] transition-colors">
                            <Folder className="w-5 h-5 stroke-2" />
                          </span>
                          <div>
                            <span className="text-xs font-extrabold text-[#07182E] block group-hover:text-[#FF9F1C] transition-colors">
                              {folder.key}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                              {folder.count} {folder.count === 1 ? "entry" : "entries"}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* IN-FOLDER FEED LIST */
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between bg-slate-50 p-3.5 border border-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSelectedFolder(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#07182E] cursor-pointer transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-[#FF9F1C]" />
                      Back to Month Folders
                    </button>
                    <h4 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wider flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-[#FF9F1C]" />
                      {selectedFolder}
                    </h4>
                  </div>

                  <div className="relative border-l border-slate-100 pl-6 ml-2.5 space-y-6">
                    {diaries
                      .filter((d) => getFolderKeyFromDate(d.diary_date) === selectedFolder)
                      .map((log) => (
                        <div key={log.id} className="relative">
                          {/* Timeline Dot */}
                          <span className="absolute -left-[32.5px] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white border-2 border-[#FF9F1C] shadow-xs">
                            <span className="h-2 w-2 rounded-full bg-[#FF9F1C]" />
                          </span>

                          <div className="space-y-2 bg-slate-50/45 p-4.5 rounded-2xl border border-slate-100 hover:bg-slate-50/80 transition-all duration-150">
                            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100/50 pb-2">
                              <div className="space-y-0.5">
                                <span className="text-xs font-extrabold text-[#07182E] block">{log.log_category}</span>
                                <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 font-medium">
                                  <span className="flex items-center gap-0.5">
                                    <Calendar className="w-3 h-3" /> {formatDate(log.diary_date)}
                                  </span>
                                  {log.diary_time && (
                                    <span className="flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" /> {formatTime12h(log.diary_time)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {log.has_delay && (
                                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-150 rounded-md text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                                    <AlertCircle className="w-3 h-3" />
                                    Site Delay
                                  </span>
                                )}
                                
                                <button
                                  onClick={() => setViewingDiary(log)}
                                  className="p-1.5 hover:bg-white text-slate-400 hover:text-[#07182E] rounded-lg transition-colors border border-transparent hover:border-slate-150 cursor-pointer"
                                  title="View Entry"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                
                                <button
                                  onClick={() => handleOpenEditForm(log)}
                                  className="p-1.5 hover:bg-white text-slate-400 hover:text-blue-600 rounded-lg transition-colors border border-transparent hover:border-slate-150 cursor-pointer"
                                  title="Edit Entry"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => setDiaryToDeleteId(log.id)}
                                  className="p-1.5 hover:bg-white text-slate-400 hover:text-rose-600 rounded-lg transition-colors border border-transparent hover:border-slate-150 cursor-pointer"
                                  title="Delete Entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-[#334155] leading-relaxed font-medium whitespace-pre-wrap">{log.details}</p>

                            {log.has_delay && log.delay_reason && (
                              <div className="bg-rose-50/30 border border-rose-100/50 p-2.5 rounded-xl text-[11px] text-rose-800 space-y-0.5 font-medium">
                                <span className="font-extrabold uppercase text-[9px] tracking-wider text-rose-600 block">Delay Reason:</span>
                                <p>{log.delay_reason}</p>
                              </div>
                            )}

                            {/* Attachments Section */}
                            {log.attachment_path && (
                              <div className="pt-2 flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => handleViewAttachment(log.attachment_path!, log.attachment_file_name || log.attachment_path!.split("/").pop() || "file", log.attachment_file_type || "")}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FF9F1C]/10 hover:bg-[#FF9F1C]/20 text-[10px] font-extrabold text-[#07182E] rounded-lg transition-all shadow-2xs cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#FF9F1C]" />
                                  <span>View Attachment</span>
                                </button>
                                
                                <button
                                  onClick={() => handleDownloadAttachment(log.attachment_path!, log.attachment_file_name || log.attachment_path!.split("/").pop() || "file")}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-600 hover:text-[#07182E] border border-slate-200 rounded-lg transition-all shadow-2xs cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Download Attachment</span>
                                </button>
                              </div>
                            )}

                            {/* Footer Log Information */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100/30 text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                              <span>Logged by: <strong className="text-slate-500">{log.logged_by || "Unknown"}</strong></span>
                              <span>Uploaded: <strong className="text-slate-500">{formatUploadedAt(log.created_at)}</strong></span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* UPLOAD / EDIT DIARY MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#07182E]/55 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-lg w-full shadow-2xl overflow-hidden text-left flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#FF9F1C]/10 rounded-xl">
                  <BookOpen className="w-5 h-5 text-[#FF9F1C]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#07182E] text-sm">
                    {editingDiaryId ? "Edit Site Diary Entry" : "Upload Diary Entry"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Record precise activity logs in real-time.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <form onSubmit={handleSaveDiary} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Diary Date</label>
                  <input
                    type="date"
                    required
                    value={diaryDate}
                    onChange={(e) => setDiaryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Diary Time</label>
                  <input
                    type="time"
                    required
                    value={diaryTime}
                    onChange={(e) => setDiaryTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Log Category</label>
                <select
                  value={logCategory}
                  onChange={(e) => setLogCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-[#FF9F1C]/20 outline-none cursor-pointer"
                >
                  <option value="Equipment Delivery">Equipment Delivery</option>
                  <option value="Concrete Structural">Concrete Structural</option>
                  <option value="Site Inspection">Site Inspection</option>
                  <option value="Weather Delay">Weather Delay</option>
                  <option value="Safety Incident">Safety Incident</option>
                  <option value="Labour & Subcontractors">Labour & Subcontractors</option>
                  <option value="Progress Update">Progress Update</option>
                  <option value="Material Delivery">Material Delivery</option>
                  <option value="Health & Safety Audit">Health & Safety Audit</option>
                  <option value="General Site Log">General Site Log</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Logged By</label>
                <input
                  type="text"
                  required
                  value={loggedBy}
                  onChange={(e) => setLoggedBy(e.target.value)}
                  placeholder="Your Name / Title"
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Details / Logs</label>
                <textarea
                  required
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Record materials delivered, personnel milestones, structural steel reinforcements, concrete slump quality tests, safety briefings, or weather logs..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none leading-relaxed"
                />
              </div>

              {/* Delay Section */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal-delay"
                    checked={hasDelay}
                    onChange={(e) => setHasDelay(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#FF9F1C] focus:ring-[#FF9F1C] cursor-pointer"
                  />
                  <label htmlFor="modal-delay" className="text-xs font-bold text-[#07182E] cursor-pointer selection:bg-transparent select-none">
                    Incurred site or schedule delay?
                  </label>
                </div>

                {hasDelay && (
                  <div className="animate-fade-in space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Delay Reason & Critical Impacts</label>
                    <textarea
                      required={hasDelay}
                      rows={2}
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                      placeholder="Specify critical path delay details, weather severity, or delivery timeline adjustments..."
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Optional Attachment Upload */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Attachment File (Optional)</label>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    attachmentDragActive ? "border-[#FF9F1C] bg-[#FF9F1C]/5" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                  onClick={() => document.getElementById("diary-file-input")?.click()}
                >
                  <input
                    id="diary-file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files && setAttachmentFile(e.target.files[0])}
                  />
                  
                  <div className="space-y-1">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">
                      {attachmentFile ? attachmentFile.name : "Select or drag file here"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {attachmentFile ? `${(attachmentFile.size / 1024).toFixed(1)} KB` : "Excel, PDF, Images up to 20MB"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-5 py-2.5 bg-[#07182E] hover:bg-[#1E3A5F] text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isActionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-[#FF9F1C]" />
                  )}
                  <span>{isActionLoading ? "Saving Entry..." : "Save Entry"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {viewingDiary && (
        <div className="fixed inset-0 bg-[#07182E]/55 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-lg w-full shadow-2xl overflow-hidden text-left flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-200/40 rounded-xl">
                  <FileText className="w-5 h-5 text-[#07182E]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#07182E] text-sm">Site Diary Details</h3>
                  <p className="text-[10px] text-slate-400 font-medium">{viewingDiary.log_category}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingDiary(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged Date</span>
                  <p className="text-xs font-bold text-[#07182E]">{formatDate(viewingDiary.diary_date)}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged Time</span>
                  <p className="text-xs font-bold text-[#07182E]">{formatTime12h(viewingDiary.diary_time)}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Log Category</span>
                  <p className="text-xs font-bold text-[#07182E]">{viewingDiary.log_category}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged By</span>
                  <p className="text-xs font-bold text-[#07182E]">{viewingDiary.logged_by || "Site Agent"}</p>
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Details / Work logs</span>
                <p className="text-xs text-[#334155] leading-relaxed font-medium whitespace-pre-wrap bg-slate-50/20 p-3 rounded-2xl border border-slate-100/50">{viewingDiary.details}</p>
              </div>

              {viewingDiary.has_delay && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl space-y-1.5 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">Incurred Delay & Impact Analysis</span>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed font-semibold">{viewingDiary.delay_reason}</p>
                </div>
              )}

              {viewingDiary.attachment_path && (
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attachment Info</span>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <Paperclip className="w-4 h-4 text-[#FF9F1C] mt-0.5" />
                      <div className="space-y-0.5 overflow-hidden">
                        <p className="text-xs font-extrabold text-[#07182E] truncate">
                          {viewingDiary.attachment_file_name || viewingDiary.attachment_path.split("/").pop()}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          MIME: {viewingDiary.attachment_file_type || "Unknown"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => handleViewAttachment(viewingDiary.attachment_path!, viewingDiary.attachment_file_name || viewingDiary.attachment_path!.split("/").pop() || "file", viewingDiary.attachment_file_type || "")}
                        className="flex-1 py-2 px-3 bg-[#FF9F1C]/10 hover:bg-[#FF9F1C]/20 text-[#07182E] font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-4 h-4 text-[#FF9F1C]" />
                        <span>View Attachment</span>
                      </button>
                      
                      <button
                        onClick={() => handleDownloadAttachment(viewingDiary.attachment_path!, viewingDiary.attachment_file_name || viewingDiary.attachment_path!.split("/").pop() || "file")}
                        className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-600 font-extrabold text-xs border border-slate-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-4 h-4 text-slate-400" />
                        <span>Download Attachment</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                <span>Upload Author: {viewingDiary.logged_by || "System user"}</span>
                <span>Created At: {formatUploadedAt(viewingDiary.created_at)}</span>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 shrink-0 bg-slate-50/50">
              <button
                onClick={() => setViewingDiary(null)}
                className="px-5 py-2.5 bg-[#07182E] hover:bg-[#1E3A5F] text-white font-extrabold text-xs rounded-xl cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {diaryToDeleteId && (
        <div className="fixed inset-0 bg-[#07182E]/55 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 max-w-md w-full shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-[#07182E] text-sm">Delete Diary Entry</h3>
              </div>
              <button 
                onClick={() => setDiaryToDeleteId(null)}
                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Are you sure you want to delete this site diary entry? This action is permanent and any associated files will also be removed from the project storage.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDiaryToDeleteId(null)}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleDeleteDiary}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT VIEWER MODAL */}
      {isViewerOpen && (
        <div className="fixed inset-0 bg-[#07182E]/75 backdrop-blur-md flex items-center justify-center z-[60] animate-fade-in p-4">
          <div className="bg-white rounded-3xl border border-slate-150 max-w-4xl w-full shadow-2xl overflow-hidden text-left flex flex-col h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#FF9F1C]/10 rounded-xl">
                  <FileText className="w-5 h-5 text-[#FF9F1C]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#07182E] text-sm truncate max-w-[250px] md:max-w-[450px]">
                    {viewingFileName || "Document Viewer"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Type: {viewingFileType || "Unknown"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenInNewTab}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#07182E] font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span>Open in New Tab</span>
                </button>
                
                <button
                  onClick={() => handleDownloadAttachment(viewingDiary?.attachment_path || "", viewingFileName)}
                  className="px-3 py-1.5 bg-[#FF9F1C] hover:bg-[#ff8f00] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                
                <button 
                  onClick={handleCloseViewer}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Content View */}
            <div className="flex-1 bg-slate-100 p-4 overflow-auto flex items-center justify-center">
              {viewingFileType.startsWith("image/") ? (
                <img
                  src={viewingFileUrl || ""}
                  alt={viewingFileName}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
                />
              ) : viewingFileType === "application/pdf" ? (
                <iframe
                  src={viewingFileUrl || ""}
                  title={viewingFileName}
                  className="w-full h-full rounded-lg shadow-inner bg-white border border-slate-200"
                />
              ) : (
                <div className="bg-white p-8 rounded-2xl max-w-md w-full border border-slate-200 text-center space-y-4 shadow-sm my-auto">
                  <FileText className="w-12 h-12 text-[#07182E] mx-auto animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-[#07182E]">{viewingFileName}</h4>
                    <p className="text-xs text-slate-500">
                      This file type (<strong>{viewingFileType}</strong>) is not natively previewable in the browser window.
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2 justify-center">
                    <button
                      onClick={handleOpenInNewTab}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#07182E] font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Try Open in New Tab
                    </button>
                    <button
                      onClick={() => handleDownloadAttachment(viewingDiary?.attachment_path || "", viewingFileName)}
                      className="px-4 py-2 bg-[#07182E] hover:bg-[#1E3A5F] text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Download File
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* ATTACHMENT LOADING STATE OVERLAY */}
        {isViewerLoading && (
          <div className="fixed inset-0 bg-[#07182E]/40 backdrop-blur-xs flex items-center justify-center z-[70] animate-fade-in">
            <div className="bg-white px-6 py-5 rounded-2xl shadow-xl flex items-center gap-3.5 border border-slate-100 animate-pulse">
              <RefreshCw className="w-5 h-5 animate-spin text-[#FF9F1C]" />
              <span className="text-xs font-extrabold text-[#07182E]">Retrieving document from Supabase...</span>
            </div>
          </div>
        )}
      </div>
    </ProjectShell>
  );
}
