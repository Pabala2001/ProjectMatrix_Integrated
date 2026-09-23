import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FileSpreadsheet,
  Folder,
  ChevronRight,
  Plus,
  Search,
  ArrowLeft,
  Download,
  Edit,
  Trash2,
  Eye,
  Upload,
  Database,
  Copy,
  Check,
  Calendar,
  Layers,
  Leaf,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X
} from "lucide-react";
import { supabase, isApiKeyError } from "../../lib/supabase";
import {
  TechnicalReportRecord,
  ReportCategory,
  ReportFrequency,
  normalizeCategory,
  normalizeFrequency,
  categoryToSlug,
  frequencyToSlug
} from "./types";
import { generateTechnicalReportDocx } from "./docxGenerator";
import { getInitialReportFormData } from "./defaults";
import { TECHNICAL_REPORTS_SQL_SNIPPET } from "./sqlSnippet";
import ReportFormStepper from "./ReportFormStepper";
import ReportPreviewModal from "./ReportPreviewModal";
import ManualReportUploadModal from "./ManualReportUploadModal";
import ProjectShell from "../../components/layout/ProjectShell";
import { CrudAdapter } from "../../services/crudAdapter";

export default function ReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { category: urlCategorySlug, frequency: urlFrequencySlug } = useParams<{ category?: string; frequency?: string }>();

  const { activeCompany, activeProject } = useOutletContext<any>();

  // Derived current Category and Frequency from URL params if present
  const currentCategory: ReportCategory | null = urlCategorySlug ? normalizeCategory(urlCategorySlug) : null;
  const currentFrequency: ReportFrequency | null = urlFrequencySlug ? normalizeFrequency(urlFrequencySlug) : null;

  // States
  const [reports, setReports] = useState<TechnicalReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc">("date-desc");

  // Modal / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<any | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [previewingReport, setPreviewingReport] = useState<TechnicalReportRecord | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete State
  const [reportToDelete, setReportToDelete] = useState<TechnicalReportRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy SQL Snippet State
  const [showSqlAlert, setShowSqlAlert] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Load Reports from Supabase & LocalStorage via CrudAdapter
  const fetchReports = async () => {
    if (!activeProject?.id || !activeCompany?.id) {
      setReports([]);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setTableMissing(false);

    try {
      const data = await CrudAdapter.getRecords<TechnicalReportRecord>({
        tableName: "reports",
        companyId: activeCompany.id,
        projectId: activeProject.id,
        orderByField: "report_date",
        orderAscending: false
      });

      setReports(data || []);
    } catch (err: any) {
      if (!isApiKeyError(err)) {
        console.warn("Notice fetching reports:", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeCompany?.id, activeProject?.id]);

  // Handle Create New Report
  const handleCreateReport = async (cat?: ReportCategory, freq?: ReportFrequency) => {
    assertOperationalAction("create", "pages/Reports/ReportsPage.tsx");
    setErrorMsg(null);
    const selectedCategory = cat || currentCategory || "Progress";
    const selectedFrequency = freq || currentFrequency || "Daily";

    if (!activeProject || !activeCompany) {
      setErrorMsg("Please select an active company and project first.");
      return;
    }

    try {
      setIsLoading(true);
      let authUserId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) authUserId = user.id;
      } catch (e) {}

      const newReportId = (typeof crypto !== "undefined" && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : `rep_${Date.now()}`;

      const initialData = getInitialReportFormData(
        activeProject.name || "",
        activeCompany.name || "",
        activeProject.contract_number || "",
        selectedCategory,
        selectedFrequency
      );

      const dateStr = initialData.report_date;
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const dateParts = dateStr.split("-");
      const year = parseInt(dateParts[0], 10) || new Date().getFullYear();
      const monthIdx = parseInt(dateParts[1], 10) - 1;
      const monthStr = monthNames[monthIdx] || "July";

      const payload: TechnicalReportRecord = {
        id: newReportId,
        company_id: activeCompany.id,
        project_id: activeProject.id,
        category: selectedCategory,
        frequency: selectedFrequency,
        report_date: dateStr,
        report_month: monthStr,
        report_year: year,
        report_number: initialData.report_number,
        title: initialData.report_title,
        status: "Draft",
        form_data: initialData,
        source_type: "Generated",
        created_by: authUserId || "usr_engineer",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await CrudAdapter.saveRecord<TechnicalReportRecord>({
        tableName: "reports",
        companyId: activeCompany.id,
        projectId: activeProject.id
      }, payload);

      setFormData(initialData);
      setEditingReportId(newReportId);
      setIsFormOpen(true);
      await fetchReports();
    } catch (err: any) {
      console.error("Create report error:", err);
      setErrorMsg(err.message || "Failed to initialize new report.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Edit existing report
  const handleEditReport = (report: TechnicalReportRecord) => {
    setEditingReportId(report.id);
    setFormData(report.form_data);
    setIsFormOpen(true);
  };

  // Handle Save Stepper Form
  const handleSaveForm = async (targetStatus: "Draft" | "Final" = "Final") => {
    assertOperationalAction("write", "pages/Reports/ReportsPage.tsx");
    if (!editingReportId || !formData) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      let storagePath: string | null = null;
      try {
        // 1. Generate DOCX blob
        const docxBlob = await generateTechnicalReportDocx(formData);
        const fileName = `${Date.now()}_${formData.report_number || "report"}.docx`;
        storagePath = `${activeCompany.id}/${activeProject.id}/${editingReportId}/${fileName}`;

        // 2. Upload DOCX to reports bucket
        const { error: uploadErr } = await supabase.storage
          .from("reports")
          .upload(storagePath, docxBlob, {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true
          });

        if (uploadErr) {
          console.warn("Docx upload warning:", uploadErr);
          storagePath = null;
        }
      } catch (genErr) {
        console.warn("Docx generation warning:", genErr);
      }

      // 3. Update record via CrudAdapter
      const currentReport = reports.find(r => r.id === editingReportId);
      const updatePayload: any = {
        ...currentReport,
        id: editingReportId,
        company_id: activeCompany.id,
        project_id: activeProject.id,
        category: formData.category,
        frequency: formData.frequency,
        report_date: formData.report_date,
        title: formData.report_title,
        report_number: formData.report_number,
        status: targetStatus,
        form_data: formData,
        source_type: "Generated",
        updated_at: new Date().toISOString()
      };

      if (storagePath) {
        updatePayload.file_path = storagePath;
        updatePayload.docx_file_path = storagePath;
      }

      await CrudAdapter.saveRecord<TechnicalReportRecord>({
        tableName: "reports",
        companyId: activeCompany.id,
        projectId: activeProject.id
      }, updatePayload);

      setSuccessMsg(targetStatus === "Final" ? "Report signed and locked successfully!" : "Report draft saved successfully!");
      setIsFormOpen(false);
      setFormData(null);
      setEditingReportId(null);
      await fetchReports();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Save report error:", err);
      setErrorMsg(err.message || "Failed to save technical report.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Download file signed URL
  const handleDownloadReport = async (report: TechnicalReportRecord) => {
    assertOperationalAction("export", "pages/Reports/ReportsPage.tsx");
    const filePath = report.file_path || report.docx_file_path;
    if (filePath) {
      try {
        const { data, error } = await supabase.storage
          .from("reports")
          .createSignedUrl(filePath, 3600);
        if (error) throw error;
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
          return;
        }
      } catch (err) {
        console.error("Error creating signed URL:", err);
      }
    }
    setPreviewingReport(report);
  };

  // Handle Delete Report
  const handleDeleteReport = async () => {
    assertOperationalAction("delete", "pages/Reports/ReportsPage.tsx");
    if (!reportToDelete) return;
    setIsDeleting(true);

    try {
      const filePath = reportToDelete.file_path || reportToDelete.docx_file_path;
      if (filePath) {
        try {
          await supabase.storage.from("reports").remove([filePath]);
        } catch (e) {}
      }

      await CrudAdapter.deleteRecord({
        tableName: "reports",
        companyId: activeCompany.id,
        projectId: activeProject.id
      }, reportToDelete.id);

      setReportToDelete(null);
      await fetchReports();
    } catch (err: any) {
      console.error("Delete report error:", err);
      alert("Failed to delete report: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered reports list
  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      // Category filter
      if (currentCategory && rep.category !== currentCategory) return false;
      // Frequency filter
      if (currentFrequency && rep.frequency !== currentFrequency) return false;
      // Status filter
      if (statusFilter !== "all" && rep.status !== statusFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (rep.title || "").toLowerCase().includes(q);
        const numMatch = (rep.report_number || "").toLowerCase().includes(q);
        const catMatch = (rep.category || "").toLowerCase().includes(q);
        return titleMatch || numMatch || catMatch;
      }
      return true;
    }).sort((a, b) => {
      const dA = new Date(a.report_date).getTime();
      const dB = new Date(b.report_date).getTime();
      return sortBy === "date-desc" ? dB - dA : dA - dB;
    });
  }, [reports, currentCategory, currentFrequency, statusFilter, searchQuery, sortBy]);

  // Statistics counts
  const categoryStats = useMemo(() => {
    const stats = {
      progress: { daily: 0, weekly: 0, monthly: 0, total: 0 },
      environmental: { daily: 0, weekly: 0, monthly: 0, total: 0 },
      ohs: { daily: 0, weekly: 0, monthly: 0, total: 0 },
    };

    reports.forEach((r) => {
      const catKey = r.category === "Progress" ? "progress" : r.category === "Environmental" ? "environmental" : "ohs";
      const freqKey = r.frequency.toLowerCase() as "daily" | "weekly" | "monthly";
      if (stats[catKey] && stats[catKey][freqKey] !== undefined) {
        stats[catKey][freqKey]++;
        stats[catKey].total++;
      }
    });

    return stats;
  }, [reports]);

  const categoriesList: { name: ReportCategory; slug: string; icon: any; color: string; bg: string }[] = [
    { name: "Progress", slug: "progress", icon: Layers, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { name: "Environmental", slug: "environmental", icon: Leaf, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
    { name: "Occupational Health and Safety", slug: "ohs", icon: ShieldAlert, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
  ];

  const frequenciesList: { name: ReportFrequency; slug: string }[] = [
    { name: "Daily", slug: "daily" },
    { name: "Weekly", slug: "weekly" },
    { name: "Monthly", slug: "monthly" },
  ];

  return (
    <ProjectShell project={activeProject} section="field">
      <div className="space-y-6">
        {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span
              onClick={() => navigate("/reports")}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer font-medium"
            >
              Reports
            </span>
            {currentCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span
                  onClick={() => navigate(`/reports/${categoryToSlug(currentCategory)}`)}
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer font-medium"
                >
                  {currentCategory}
                </span>
              </>
            )}
            {currentFrequency && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {currentFrequency}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            <span>
              {currentCategory && currentFrequency
                ? `${currentCategory} (${currentFrequency} Reports)`
                : currentCategory
                ? `${currentCategory} Reports`
                : "Technical Reports Module"}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Project: <span className="font-semibold text-slate-700 dark:text-slate-300">{activeProject?.name || "No Active Project"}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl flex items-center space-x-1.5 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
          <button
            onClick={() => handleCreateReport()}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Report</span>
          </button>
        </div>
      </div>

      {/* SQL Missing Table Alert */}
      {showSqlAlert && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
              <Database className="w-5 h-5 text-amber-600" />
              <span>Database Setup Required: technical_reports Table</span>
            </div>
            <button onClick={() => setShowSqlAlert(false)} className="text-amber-500 hover:text-amber-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            The <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">technical_reports</code> table was not detected. Copy and execute the SQL snippet in Supabase SQL Editor:
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(TECHNICAL_REPORTS_SQL_SNIPPET);
                setSqlCopied(true);
                setTimeout(() => setSqlCopied(false), 3000);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center space-x-1.5"
            >
              {sqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{sqlCopied ? "Copied SQL!" : "Copy SQL Snippet"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Category Folders Grid (Root or Category level navigation) */}
      {!currentFrequency && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {currentCategory ? `${currentCategory} Frequency Folders` : "Report Categories & Folders"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {!currentCategory ? (
              // 3 Main Categories
              categoriesList.map((cat) => {
                const Icon = cat.icon;
                const statKey = cat.slug as "progress" | "environmental" | "ohs";
                const catStats = categoryStats[statKey];

                return (
                  <div
                    key={cat.slug}
                    onClick={() => navigate(`/reports/${cat.slug}`)}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-xl ${cat.bg}`}>
                        <Icon className={`w-6 h-6 ${cat.color}`} />
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {catStats.total} Files
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Daily, Weekly & Monthly records
                      </p>
                    </div>

                    {/* Sub-frequencies chips */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-xs">
                      <div
                        onClick={(e) => { e.stopPropagation(); navigate(`/reports/${cat.slug}/daily`); }}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
                      >
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Daily</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{catStats.daily}</span>
                      </div>
                      <div
                        onClick={(e) => { e.stopPropagation(); navigate(`/reports/${cat.slug}/weekly`); }}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
                      >
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Weekly</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{catStats.weekly}</span>
                      </div>
                      <div
                        onClick={(e) => { e.stopPropagation(); navigate(`/reports/${cat.slug}/monthly`); }}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
                      >
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Monthly</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{catStats.monthly}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              // 3 Frequencies for selected category
              frequenciesList.map((freq) => {
                const freqSlug = freq.slug;
                const catSlug = categoryToSlug(currentCategory);
                const statKey = catSlug as "progress" | "environmental" | "ohs";
                const count = categoryStats[statKey]?.[freqSlug as "daily" | "weekly" | "monthly"] || 0;

                return (
                  <div
                    key={freq.slug}
                    onClick={() => navigate(`/reports/${catSlug}/${freq.slug}`)}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-xl transition-all cursor-pointer group flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                        <Folder className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-emerald-600 transition-colors">
                          {freq.name} Reports
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {count} report files logged
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Reports Register / Table Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Report Register ({filteredReports.length})
            </h3>
          </div>

          {/* Search & Filters Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Final">Final</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
            </select>

            <button
              onClick={fetchReports}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Refresh Register"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="text-xs font-medium">Loading reports register...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <Folder className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <h4 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No reports found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No reports match your current category, frequency or search filters for this project.
            </p>
            <div className="pt-2 flex items-center justify-center space-x-3">
              <button
                onClick={() => handleCreateReport()}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
              >
                Create New Report
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Report Ref</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Frequency</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-semibold text-slate-900 dark:text-white">
                      {report.report_number || report.id.slice(0, 8)}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        {report.category}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {report.frequency}
                      </span>
                    </td>
                    <td className="p-3">{report.report_date}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                      {report.title || "Untitled Technical Report"}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        report.status === "Final" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => setPreviewingReport(report)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="View Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadReport(report)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Download Report"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditReport(report)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Report"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setReportToDelete(report)}
                          className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Report"
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
        )}
      </div>

      {/* Stepper Modal */}
      {isFormOpen && formData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <ReportFormStepper
              formData={formData}
              setFormData={setFormData}
              onSave={handleSaveForm}
              onCancel={() => {
                setIsFormOpen(false);
                setFormData(null);
                setEditingReportId(null);
              }}
              isSaving={isSaving}
              companyId={activeCompany?.id || ""}
              projectId={activeProject?.id || ""}
              reportId={editingReportId || ""}
            />
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewingReport && (
        <ReportPreviewModal
          report={previewingReport}
          onClose={() => setPreviewingReport(null)}
        />
      )}

      {/* Manual File Upload Modal */}
      {isUploadOpen && (
        <ManualReportUploadModal
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => fetchReports()}
          companyId={activeCompany?.id || ""}
          projectId={activeProject?.id || ""}
          companyName={activeCompany?.name || ""}
          projectName={activeProject?.name || ""}
          contractNumber={activeProject?.contract_number || ""}
          defaultCategory={currentCategory || "Progress"}
          defaultFrequency={currentFrequency || "Daily"}
        />
      )}

      {/* Delete Confirmation Modal */}
      {reportToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Delete Technical Report?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">{reportToDelete.title || reportToDelete.report_number}</span>? This will permanently remove the record and any associated storage files.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setReportToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteReport}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center space-x-1 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </ProjectShell>
  );
}
