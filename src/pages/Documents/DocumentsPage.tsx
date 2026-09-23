import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Upload,
  Trash2,
  Search,
  ArrowLeft,
  ChevronRight,
  Plus,
  Download,
  Eye,
  Edit,
  X,
  Calendar,
  Hash,
  ShieldCheck,
  AlertCircle,
  Clock,
  User,
  Compass,
  Zap,
  Filter,
  CheckCircle2
} from "lucide-react";
import { supabase, isApiKeyError } from "../../lib/supabase";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { CrudAdapter } from "../../services/crudAdapter";
import { DocumentDashboardKpis } from "../../components/documents/DocumentDashboardKpis";
import { DocumentCategoryGrid } from "../../components/documents/DocumentCategoryGrid";
import { DocumentRegisterTable } from "../../components/documents/DocumentRegisterTable";
import { DocumentSubtabsNav } from "../../components/documents/DocumentSubtabsNav";
import { DocumentUploadModal } from "../../components/documents/DocumentUploadModal";
import { DocumentViewerModal } from "../../components/documents/DocumentViewerModal";
import {
  MAIN_CATEGORY_DEFINITIONS,
  normalizeDocumentCategory,
  getExpiryStatus,
  isExpiringCategory
} from "../../components/documents/documentHierarchy";
import {
  DocumentMainCategory,
  ProjectDocument,
  DocumentStatus,
  ApprovalStatus,
  ConfidentialityLevel
} from "../../types/documentManagement";

// Formats file sizes safely
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const displayFileSize = (size: any) => {
  if (typeof size === "number") return formatBytes(size);
  if (!size) return "0 Bytes";
  if (!isNaN(Number(size))) return formatBytes(Number(size));
  return String(size);
};

// Sanitizes path segments for Supabase storage
function sanitizePathSegment(segment: string, isFileName = false): string {
  if (isFileName) {
    const dotIndex = segment.lastIndexOf(".");
    if (dotIndex !== -1) {
      const name = segment.substring(0, dotIndex);
      const ext = segment.substring(dotIndex);
      const sanitizedName = name
        .replace(/[^a-zA-Z0-9\s-_]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      return sanitizedName + ext;
    }
  }
  return segment
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function DocumentsPage() {
  const { profile, activeCompany, activeProject } = useOutletContext<any>();
  const { formatDateTime, formatDate } = useRegionalSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  // Master Documents State
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaderProfiles, setUploaderProfiles] = useState<Record<string, { full_name: string; email: string }>>({});

  // Navigation hierarchy
  const [viewMode, setViewMode] = useState<"REGISTER" | "EXPLORER">("REGISTER");
  const [selectedCategory, setSelectedCategory] = useState<DocumentMainCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [selectedSurveyTier, setSelectedSurveyTier] = useState<string | null>(null);
  const [selectedWayleaveType, setSelectedWayleaveType] = useState<string | null>(null);

  // Search & quick filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<ProjectDocument | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ProjectDocument | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<ProjectDocument | null>(null);

  // Edit metadata fields
  const [editTitle, setEditTitle] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editRevision, setEditRevision] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load all documents for the active project
  const fetchDocuments = async () => {
    if (!activeCompany?.id || !activeProject?.id || activeProject.company_id !== activeCompany.id) {
      setDocuments([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const allDocs = await CrudAdapter.getRecords<ProjectDocument>({
        tableName: "project_documents",
        companyId: activeProject.company_id,
        projectId: activeProject.id,
        orderByField: "created_at",
        orderAscending: false
      });
      setDocuments(allDocs || []);
    } catch (err) {
      if (!isApiKeyError(err)) {
        console.error("Failed to fetch project documents:", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [activeCompany?.id, activeProject?.id]);

  // Fetch profiles for uploaders
  useEffect(() => {
    const fetchProfiles = async () => {
      const uploaderIds = Array.from(
        new Set(documents.map((doc) => doc.uploaded_by).filter(Boolean))
      );
      if (uploaderIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", uploaderIds);

        if (!error && data) {
          const profileMap: Record<string, { full_name: string; email: string }> = {};
          data.forEach((p) => {
            profileMap[p.id] = { full_name: p.full_name, email: p.email };
          });
          setUploaderProfiles((prev) => ({ ...prev, ...profileMap }));
        }
      } catch (err) {
        // quiet fallback
      }
    };

    fetchProfiles();
  }, [documents]);

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Filtered documents strictly for this active project
  const projectDocs = useMemo(() => {
    return documents.filter(
      (doc) => doc.company_id === activeCompany?.id && doc.project_id === activeProject?.id
    );
  }, [documents, activeCompany?.id, activeProject?.id]);

  // Filter documents in current subtab view
  const currentSubtabDocs = useMemo(() => {
    if (!selectedCategory) return projectDocs;

    return projectDocs.filter(doc => {
      const norm = normalizeDocumentCategory(doc.folder_name, doc.subfolder_name);
      if (norm.mainCategory !== selectedCategory) return false;

      if (selectedSubcategory) {
        if (norm.subcategory !== selectedSubcategory && doc.subfolder_name !== selectedSubcategory && doc.folder_name !== selectedSubcategory) {
          return false;
        }

        // Check discipline filter if Drawings
        if (selectedCategory === "Specifications" && selectedSubcategory === "Drawings" && selectedDiscipline) {
          const docDisc = (doc as any).discipline;
          if (selectedDiscipline === "Civil Engineering") {
            if (docDisc && docDisc !== "Civil Engineering") return false;
          } else if (docDisc !== selectedDiscipline) {
            return false;
          }
        }
      }

      return true;
    });
  }, [projectDocs, selectedCategory, selectedSubcategory, selectedDiscipline]);

  // Apply Search & KPI Filters
  const filteredAndSearchedDocs = useMemo(() => {
    let result = currentSubtabDocs;

    if (activeKpiFilter) {
      if (activeKpiFilter === "awaiting_approval") {
        result = result.filter(d => 
          d.approval_status === "Pending Review" || 
          d.approval_status === "Pending Approval" ||
          d.status === "Internal Review" ||
          d.status === "Submitted" ||
          d.status === "PENDING_REVIEW"
        );
      } else if (activeKpiFilter === "expiring") {
        result = result.filter(d => {
          const exp = d.expiry_date || (d as any).expiryDate;
          if (!exp) return false;
          const { status } = getExpiryStatus(exp);
          return status === "expired" || status === "urgent" || status === "warning";
        });
      } else if (activeKpiFilter === "correspondence") {
        result = result.filter(d => {
          const isCorr = d.folder_name === "Project Correspondence" || (d as any).main_category === "Project Correspondence";
          const respDueDate = (d as any).response_due_date || (d as any).responseDueDate;
          return isCorr && respDueDate && new Date(respDueDate).getTime() < Date.now();
        });
      } else if (activeKpiFilter === "drawings") {
        result = result.filter(d => {
          const isDrawing = d.folder_name === "Specifications" || d.subfolder_name?.includes("Drawing") || (d as any).discipline;
          return isDrawing;
        });
      } else if (activeKpiFilter === "permits") {
        result = result.filter(d => {
          const isPermit = d.folder_name === "Permits & Licenses" || (d as any).main_category === "Permits & Licenses";
          return isPermit;
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.document_title.toLowerCase().includes(q) ||
        (d.document_number && d.document_number.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        (d.file_name && d.file_name.toLowerCase().includes(q)) ||
        (d.subfolder_name && d.subfolder_name.toLowerCase().includes(q)) ||
        ((d as any).discipline && (d as any).discipline.toLowerCase().includes(q))
      );
    }

    return result;
  }, [currentSubtabDocs, searchQuery, activeKpiFilter]);

  // Navigation handlers
  const handleSelectCategory = (category: DocumentMainCategory) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setSelectedDiscipline(null);
    setSelectedSurveyTier(null);
    setSelectedWayleaveType(null);
    setSearchQuery("");
    setActiveKpiFilter(null);
  };

  const handleSelectSubcategory = (subCat: string, discipline?: string, surveyTier?: string, wayleaveType?: string) => {
    setSelectedSubcategory(subCat);
    setSelectedDiscipline(discipline || (subCat === "Drawings" ? "Civil Engineering" : null));
    setSelectedSurveyTier(surveyTier || null);
    setSelectedWayleaveType(wayleaveType || null);
    setSearchQuery("");
  };

  const handleBackToLanding = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSelectedDiscipline(null);
    setSelectedSurveyTier(null);
    setSelectedWayleaveType(null);
    setSearchQuery("");
    setActiveKpiFilter(null);
  };

  const handleBackToSubcategories = () => {
    setSelectedSubcategory(null);
    setSelectedDiscipline(null);
    setSelectedSurveyTier(null);
    setSelectedWayleaveType(null);
    setSearchQuery("");
  };

  // Master Controlled Upload Handler
  const handleUploadSubmit = async (formData: any) => {
    assertOperationalAction("write", "pages/Documents/DocumentsPage.tsx");
    if (!activeCompany?.id || !activeProject?.id) {
      throw new Error("Active company and project required.");
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const authenticatedUser = user;
      const uploadedBy = authenticatedUser?.id || profile?.id || "authorized_user";

      const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const mainCat = formData.mainCategory;
      const subCat = formData.subcategory;
      const disc = formData.discipline;

      const payload: ProjectDocument = {
        id: docId,
        company_id: activeProject.company_id,
        project_id: activeProject.id,
        folder_name: mainCat,
        subfolder_name: subCat,
        document_title: formData.title,
        document_number: formData.documentNumber || "",
        revision: formData.revision || "R00",
        document_date: formData.documentDate || now.slice(0, 10),
        description: formData.description || "",
        file_path: "",
        file_name: formData.file.name,
        file_type: formData.file.type || "application/octet-stream",
        file_size: formData.file.size,
        uploaded_by: uploadedBy,
        created_at: now,
        updated_at: now,
        status: formData.status || "Draft",
        approval_status: formData.status === "Approved" ? "Approved" : "Pending Review",
        confidentiality: formData.confidentiality || "Internal",
        expiry_date: formData.expiryDate || null,
        discipline: disc || null
      } as any;

      // 1. Insert metadata in DB
      const savedDoc = await CrudAdapter.saveRecord<ProjectDocument>(
        {
          tableName: "project_documents",
          companyId: activeProject.company_id,
          projectId: activeProject.id
        },
        payload
      );

      // 2. Physical file storage upload
      const sanitizedFolder = sanitizePathSegment(mainCat);
      const sanitizedSubfolder = sanitizePathSegment(subCat);
      const sanitizedFileName = sanitizePathSegment(formData.file.name, true);
      const storagePath = `${activeProject.company_id}/${activeProject.id}/${sanitizedFolder}/${sanitizedSubfolder}/${docId}/${sanitizedFileName}`;

      try {
        const { error: storageError } = await supabase.storage
          .from("project-documents")
          .upload(storagePath, formData.file, {
            cacheControl: "3600",
            upsert: true
          });

        if (!storageError) {
          await CrudAdapter.saveRecord<ProjectDocument>(
            {
              tableName: "project_documents",
              companyId: activeProject.company_id,
              projectId: activeProject.id
            },
            { ...savedDoc, file_path: storagePath }
          );
        }
      } catch (storageErr) {
        console.warn("Storage upload warning (metadata committed):", storageErr);
      }

      await fetchDocuments();
      showToast(`Controlled document "${formData.title}" (${formData.revision}) successfully ingested.`);
    } finally {
      setIsUploading(false);
    }
  };

  // View File / Signed URL
  const handleViewFile = async (doc: ProjectDocument) => {
    setViewingDoc(doc);
    setIsViewerOpen(true);
  };

  // Download File / Signed URL
  const handleDownloadFile = async (doc: ProjectDocument) => {
    assertOperationalAction("export", "pages/Documents/DocumentsPage.tsx");
    if (!doc.file_path) {
      showToast("Document has no remote binary path.");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(doc.file_path, 60);

      if (error) {
        showToast("Error generating download URL: " + error.message);
        return;
      }

      if (data?.signedUrl) {
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.download = doc.file_name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      showToast("Download failed: " + (err.message || err));
    }
  };

  // Edit Metadata
  const handleOpenEdit = (doc: ProjectDocument) => {
    setEditingDoc(doc);
    setEditTitle(doc.document_title);
    setEditNumber(doc.document_number || "");
    setEditRevision(doc.revision || "");
    setEditDate(doc.document_date || "");
    setEditDescription(doc.description || "");
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;

    if (!editTitle.trim()) {
      setEditError("Document Title is required.");
      return;
    }

    try {
      await CrudAdapter.saveRecord<ProjectDocument>(
        {
          tableName: "project_documents",
          companyId: activeProject.company_id,
          projectId: activeProject.id
        },
        {
          ...editingDoc,
          document_title: editTitle,
          document_number: editNumber || null,
          revision: editRevision || null,
          document_date: editDate || null,
          description: editDescription || null,
          updated_at: new Date().toISOString()
        }
      );

      await fetchDocuments();
      setIsEditOpen(false);
      setEditingDoc(null);
      showToast(`Metadata for "${editTitle}" updated.`);
    } catch (err: any) {
      setEditError("Failed to update metadata: " + (err.message || err));
    }
  };

  // Delete Action
  const triggerDeleteConfirm = (doc: ProjectDocument) => {
    setDeletingDoc(doc);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteSubmit = async () => {
    assertOperationalAction("delete", "pages/Documents/DocumentsPage.tsx");
    if (!deletingDoc) return;

    try {
      if (deletingDoc.file_path) {
        try {
          await supabase.storage
            .from("project-documents")
            .remove([deletingDoc.file_path]);
        } catch (e) {
          // continue
        }
      }

      await CrudAdapter.deleteRecord(
        {
          tableName: "project_documents",
          companyId: activeProject.company_id,
          projectId: activeProject.id
        },
        deletingDoc.id
      );

      await fetchDocuments();
      setIsDeleteConfirmOpen(false);
      showToast(`"${deletingDoc.document_title}" removed from registry.`);
      setDeletingDoc(null);
    } catch (err: any) {
      showToast("Deletion failed: " + (err.message || err));
    }
  };

  // File type styling helper
  const getFileIconAndColors = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return {
          icon: <FileText className="w-5 h-5" />,
          badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
          iconContainer: "bg-rose-50 text-rose-600 border border-rose-100",
          label: "PDF"
        };
      case "docx":
      case "doc":
        return {
          icon: <FileText className="w-5 h-5" />,
          badgeClass: "bg-blue-50 text-blue-700 border border-blue-200",
          iconContainer: "bg-blue-50 text-blue-600 border border-blue-100",
          label: "DOCX"
        };
      case "xlsx":
      case "xls":
      case "csv":
        return {
          icon: <FileSpreadsheet className="w-5 h-5" />,
          badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
          iconContainer: "bg-emerald-50 text-emerald-600 border border-emerald-100",
          label: "SHEET"
        };
      case "dwg":
      case "dxf":
        return {
          icon: <Compass className="w-5 h-5" />,
          badgeClass: "bg-purple-50 text-purple-700 border border-purple-200",
          iconContainer: "bg-purple-50 text-purple-600 border border-purple-100",
          label: "CAD"
        };
      case "png":
      case "jpg":
      case "jpeg":
        return {
          icon: <ImageIcon className="w-5 h-5" />,
          badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",
          iconContainer: "bg-violet-50 text-violet-600 border border-violet-100",
          label: "IMAGE"
        };
      default:
        return {
          icon: <File className="w-5 h-5" />,
          badgeClass: "bg-slate-50 text-slate-700 border border-slate-200",
          iconContainer: "bg-slate-50 text-slate-600 border border-slate-100",
          label: "FILE"
        };
    }
  };

  // Guard against missing active company/project
  if (!activeCompany?.id || !activeProject?.id) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-[#E2E8F0] rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.03)] space-y-4">
        <Folder className="w-16 h-16 text-slate-300 stroke-1" />
        <div className="max-w-md space-y-2">
          <h3 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wider">No Project Selected</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Please select a company and a project from the top navigation bar to access the project Common Data Environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 relative min-h-[550px] pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-[#07182E] border-l-4 border-[#FF9F1C] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm">
          <ShieldCheck className="w-5 h-5 text-[#FF9F1C] shrink-0" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">CDE Ledger Updated</span>
            <p className="text-xs font-semibold text-slate-100">{successToast}</p>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-slate-400 hover:text-white ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white dark:bg-[#0B172A] p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#FF9F1C]/10 text-[#FF9F1C] rounded-lg shrink-0">
              <FolderOpen className="w-4 h-4" />
            </span>
            <h1 className="text-sm sm:text-base font-black text-[#07182E] dark:text-white tracking-tight truncate">
              Project Common Data Environment (CDE)
            </h1>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 min-w-0 truncate">
            <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">{activeCompany.name}</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
              {activeProject.code || activeProject.project_code || activeProject.project_number || "PRJ-01"}
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="truncate font-medium text-slate-600 dark:text-slate-400" title={activeProject.name}>
              {activeProject.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-3.5 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            id="btn-upload-controlled-doc"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Upload Controlled Document</span>
          </button>
        </div>
      </div>

      {/* KPI COMPACT EXECUTIVE INDICATORS */}
      <DocumentDashboardKpis
        documents={projectDocs}
        activeFilter={activeKpiFilter}
        onSelectFilter={(filterType) => {
          if (filterType === "all") {
            setActiveKpiFilter(null);
            handleBackToLanding();
          } else if (filterType === "awaiting_approval") {
            setActiveKpiFilter("awaiting_approval");
          } else if (filterType === "expiring") {
            setActiveKpiFilter("expiring");
          } else if (filterType === "correspondence") {
            setSelectedCategory("Project Correspondence");
            setSelectedSubcategory(null);
          } else if (filterType === "drawings") {
            setSelectedCategory("Specifications");
            setSelectedSubcategory("Drawings");
            setSelectedDiscipline("Civil Engineering");
          } else if (filterType === "permits") {
            setSelectedCategory("Permits & Licenses");
            setSelectedSubcategory(null);
          }
        }}
      />

      {/* SINGLE PRIMARY CATEGORY NAVIGATION & VIEW TOGGLE */}
      <div className="bg-white dark:bg-[#0B172A] p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 min-w-0 flex-1">
          <button
            onClick={handleBackToLanding}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              !selectedCategory
                ? "bg-[#07182E] dark:bg-blue-600 text-white shadow-xs"
                : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#07182E]"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>All Documents</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${!selectedCategory ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}`}>
              {projectDocs.length}
            </span>
          </button>
          {MAIN_CATEGORY_DEFINITIONS.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count = projectDocs.filter(d => normalizeDocumentCategory(d.folder_name, d.subfolder_name).mainCategory === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-[#07182E] dark:bg-blue-600 text-white shadow-xs"
                    : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#07182E]"
                }`}
              >
                <span>{cat.title}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg self-end sm:self-auto shrink-0">
          <button
            onClick={() => setViewMode("REGISTER")}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              viewMode === "REGISTER"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Register View
          </button>
          <button
            onClick={() => setViewMode("EXPLORER")}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              viewMode === "EXPLORER"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Folder Explorer
          </button>
        </div>
      </div>

      {/* BREADCRUMB HIERARCHY BAR */}
      {(selectedCategory || selectedSubcategory || viewMode === "EXPLORER") && (
        <div className="bg-slate-50 dark:bg-[#0B172A] px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap items-center gap-1.5 text-xs font-bold min-w-0">
          <button
            onClick={handleBackToLanding}
            className={`transition-colors flex items-center gap-1 cursor-pointer ${
              !selectedCategory ? "text-[#FF9F1C]" : "text-slate-500 hover:text-[#07182E] dark:hover:text-white"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Documents</span>
          </button>

          {selectedCategory && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                onClick={handleBackToSubcategories}
                className={`transition-colors cursor-pointer ${
                  !selectedSubcategory ? "text-[#FF9F1C]" : "text-slate-500 hover:text-[#07182E] dark:hover:text-white"
                }`}
              >
                {selectedCategory}
              </button>
            </>
          )}

          {selectedSubcategory && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                onClick={() => {
                  setSelectedDiscipline(null);
                  setSelectedWayleaveType(null);
                }}
                className={`transition-colors cursor-pointer ${
                  !selectedDiscipline && !selectedWayleaveType ? "text-[#FF9F1C]" : "text-slate-500 hover:text-[#07182E] dark:hover:text-white"
                }`}
              >
                {selectedSubcategory}
              </button>
            </>
          )}

          {selectedDiscipline && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                {selectedDiscipline}
              </span>
            </>
          )}

          {selectedWayleaveType && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                {selectedWayleaveType}
              </span>
            </>
          )}
        </div>
      )}

      {/* REGISTER VIEW (DEFAULT OPERATIONAL INTERFACE) */}
      {viewMode === "REGISTER" && (
        <div className="space-y-4 min-w-0 w-full">
          <DocumentRegisterTable
            documents={projectDocs}
            selectedCategory={selectedCategory}
            selectedSubcategory={selectedSubcategory}
            selectedDiscipline={selectedDiscipline}
            selectedWayleaveType={selectedWayleaveType}
            onSelectCategory={setSelectedCategory}
            onSelectSubcategory={(subCat) => {
              if (subCat) {
                handleSelectSubcategory(subCat);
              } else {
                setSelectedSubcategory(null);
              }
            }}
            onSelectDiscipline={setSelectedDiscipline}
            onSelectWayleaveType={setSelectedWayleaveType}
            onView={handleViewFile}
            onDownload={handleDownloadFile}
            onEdit={handleOpenEdit}
            onDelete={triggerDeleteConfirm}
            onUploadNew={() => setIsUploadOpen(true)}
            uploaderProfiles={uploaderProfiles}
          />
        </div>
      )}

      {/* FOLDER EXPLORER VIEW (ALTERNATIVE VIEW) */}
      {viewMode === "EXPLORER" && !selectedCategory && (
        <div className="min-w-0 w-full">
          {/* Primary 4 Category Folder Repositories */}
          <DocumentCategoryGrid
            documents={projectDocs}
            selectedCategory={null}
            selectedSubcategory={null}
            onSelectCategory={handleSelectCategory}
            onSelectSubcategory={handleSelectSubcategory}
            onBackToMainCategories={handleBackToLanding}
          />
        </div>
      )}

      {/* FOLDER EXPLORER VIEW - Inside a Category */}
      {viewMode === "EXPLORER" && selectedCategory && !selectedSubcategory && (
        <div className="space-y-4 min-w-0 w-full">
          <DocumentCategoryGrid
            documents={projectDocs}
            selectedCategory={selectedCategory}
            selectedSubcategory={null}
            onSelectCategory={handleSelectCategory}
            onSelectSubcategory={handleSelectSubcategory}
            onBackToMainCategories={handleBackToLanding}
          />
        </div>
      )}

      {/* FOLDER EXPLORER VIEW - Inside a Subcategory (Shows Register Table for that Subcategory) */}
      {viewMode === "EXPLORER" && selectedCategory && selectedSubcategory && (
        <div className="space-y-4 min-w-0 w-full">
          <DocumentRegisterTable
            documents={projectDocs}
            selectedCategory={selectedCategory}
            selectedSubcategory={selectedSubcategory}
            selectedDiscipline={selectedDiscipline}
            selectedWayleaveType={selectedWayleaveType}
            onSelectCategory={handleSelectCategory}
            onSelectSubcategory={(subCat) => {
              if (subCat) {
                handleSelectSubcategory(subCat);
              } else {
                setSelectedSubcategory(null);
              }
            }}
            onSelectDiscipline={setSelectedDiscipline}
            onSelectWayleaveType={setSelectedWayleaveType}
            onView={handleViewFile}
            onDownload={handleDownloadFile}
            onEdit={handleOpenEdit}
            onDelete={triggerDeleteConfirm}
            onUploadNew={() => setIsUploadOpen(true)}
            uploaderProfiles={uploaderProfiles}
          />
        </div>
      )}

      {/* ========================================================
          MODAL DIALOGS
         ======================================================== */}

      {/* A. MASTER UPLOAD MODAL */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSubmit={handleUploadSubmit}
        isUploading={isUploading}
        initialCategory={selectedCategory}
        initialSubcategory={selectedSubcategory}
        initialDiscipline={selectedDiscipline}
        activeProject={activeProject}
        activeCompany={activeCompany}
        existingDocuments={projectDocs}
      />

      {/* B. MASTER CDE VIEWER MODAL */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setViewingDoc(null);
        }}
        document={viewingDoc}
        onDownload={handleDownloadFile}
        onNewRevision={() => {
          setIsViewerOpen(false);
          setIsUploadOpen(true);
        }}
        uploaderName={viewingDoc ? (uploaderProfiles[viewingDoc.uploaded_by]?.full_name || uploaderProfiles[viewingDoc.uploaded_by]?.email || viewingDoc.uploaded_by) : undefined}
      />

      {/* C. EDIT METADATA MODAL */}
      {isEditOpen && editingDoc && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up"
          >
            <div className="bg-[#07182E] p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF9F1C]">Metadata Amendment</span>
                <h3 className="text-sm font-extrabold uppercase tracking-wide mt-0.5">Edit Controlled Metadata</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingDoc(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {editError}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Document Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#FF9F1C] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                    Document Number
                  </label>
                  <input
                    type="text"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:border-[#FF9F1C] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                    Revision
                  </label>
                  <input
                    type="text"
                    value={editRevision}
                    onChange={(e) => setEditRevision(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:border-[#FF9F1C] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Document Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#FF9F1C] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#07182E] uppercase block mb-1">
                  Description / Transmittal Notes
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#FF9F1C] outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingDoc(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-[#07182E] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-extrabold text-white bg-[#FF9F1C] hover:bg-[#FFB020] rounded-xl shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* D. DELETE CONFIRMATION DIALOG */}
      {isDeleteConfirmOpen && deletingDoc && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="bg-rose-950 p-5 text-rose-100 flex items-center gap-3">
              <span className="p-2 bg-rose-900 text-rose-300 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-400 block">Critical Command</span>
                <h3 className="text-sm font-extrabold uppercase">Confirm Document Deletion</h3>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-[#07182E] font-bold">
                Are you sure you want to remove this controlled document from the registry?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                <span className="text-xs font-bold text-slate-800 block truncate">{deletingDoc.document_title}</span>
                <span className="text-[9px] text-slate-400 font-bold block">{deletingDoc.file_name} • {displayFileSize(deletingDoc.file_size)}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setDeletingDoc(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="px-5 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
