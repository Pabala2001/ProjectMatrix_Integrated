import React, { useState, useMemo } from "react";
import {
  FileText,
  FileSpreadsheet,
  Compass,
  Image as ImageIcon,
  File,
  Search,
  Plus,
  Eye,
  Download,
  Edit,
  Trash2,
  Clock,
  ArrowUpDown,
  Zap,
  Building,
  Filter,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { ProjectDocument, DocumentMainCategory } from "../../types/documentManagement";
import {
  MAIN_CATEGORY_DEFINITIONS,
  DRAWING_DISCIPLINES,
  WAYLEAVE_CATEGORIES,
  getExpiryStatus,
  normalizeDocumentCategory
} from "./documentHierarchy";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

interface DocumentRegisterTableProps {
  documents: ProjectDocument[];
  selectedCategory: DocumentMainCategory | null;
  selectedSubcategory?: string | null;
  selectedDiscipline?: string | null;
  selectedWayleaveType?: string | null;
  onSelectCategory: (category: DocumentMainCategory | null) => void;
  onSelectSubcategory?: (subcategory: string | null) => void;
  onSelectDiscipline?: (discipline: string | null) => void;
  onSelectWayleaveType?: (type: string | null) => void;
  onView: (doc: ProjectDocument) => void;
  onDownload: (doc: ProjectDocument) => void;
  onEdit: (doc: ProjectDocument) => void;
  onDelete: (doc: ProjectDocument) => void;
  onUploadNew: () => void;
  uploaderProfiles?: Record<string, { full_name: string; email: string }>;
}

export const DocumentRegisterTable: React.FC<DocumentRegisterTableProps> = ({
  documents,
  selectedCategory,
  selectedSubcategory: propSubcategory,
  selectedDiscipline: propDiscipline,
  selectedWayleaveType: propWayleaveType,
  onSelectCategory,
  onSelectSubcategory,
  onSelectDiscipline,
  onSelectWayleaveType,
  onView,
  onDownload,
  onEdit,
  onDelete,
  onUploadNew,
  uploaderProfiles = {}
}) => {
  const { formatDate } = useRegionalSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<"number" | "title" | "date" | "status" | "category">("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Local state fallbacks if not controlled by parent
  const [internalSubcategory, setInternalSubcategory] = useState<string | null>(propSubcategory || null);
  const [internalDiscipline, setInternalDiscipline] = useState<string | null>(propDiscipline || null);
  const [internalWayleaveType, setInternalWayleaveType] = useState<string | null>(propWayleaveType || null);

  const activeSubcategory = propSubcategory !== undefined ? propSubcategory : internalSubcategory;
  const activeDiscipline = propDiscipline !== undefined ? propDiscipline : internalDiscipline;
  const activeWayleaveType = propWayleaveType !== undefined ? propWayleaveType : internalWayleaveType;

  const handleSubcategoryClick = (subCat: string | null) => {
    if (onSelectSubcategory) {
      onSelectSubcategory(subCat);
    } else {
      setInternalSubcategory(subCat);
    }
  };

  const handleDisciplineClick = (disc: string | null) => {
    if (onSelectDiscipline) {
      onSelectDiscipline(disc);
    } else {
      setInternalDiscipline(disc);
    }
  };

  const handleWayleaveTypeClick = (type: string | null) => {
    if (onSelectWayleaveType) {
      onSelectWayleaveType(type);
    } else {
      setInternalWayleaveType(type);
    }
  };

  // Find definition for current category
  const currentCatDef = useMemo(() => {
    return MAIN_CATEGORY_DEFINITIONS.find((c) => c.id === selectedCategory);
  }, [selectedCategory]);

  const isDrawings = selectedCategory === "Specifications" && activeSubcategory === "Drawings";
  const isWayleaves = selectedCategory === "Permits & Licenses" && activeSubcategory === "Wayleaves";

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const norm = normalizeDocumentCategory(doc.folder_name, doc.subfolder_name);

      // 1. Category filter
      if (selectedCategory) {
        if (norm.mainCategory !== selectedCategory && doc.folder_name !== selectedCategory) {
          return false;
        }
      }

      // 2. Subcategory filter
      if (activeSubcategory) {
        const matchesSub =
          doc.subfolder_name === activeSubcategory ||
          doc.folder_name === activeSubcategory ||
          norm.subcategory === activeSubcategory;
        if (!matchesSub) return false;
      }

      // 3. Discipline filter (for drawings)
      if (isDrawings && activeDiscipline) {
        const disc = (doc as any).discipline;
        if (disc && disc !== activeDiscipline) {
          return false;
        }
        if (!disc && activeDiscipline !== "Civil Engineering") {
          return false;
        }
      }

      // 4. Wayleave Utility filter
      if (isWayleaves && activeWayleaveType) {
        const wayType = (doc as any).wayleave_type || (doc as any).utility_authority;
        if (wayType && wayType !== activeWayleaveType) {
          return false;
        }
      }

      // 5. Status filter
      if (statusFilter !== "ALL") {
        const isExpiring = doc.expiry_date || (doc as any).expiryDate;
        const expiryInfo = isExpiring ? getExpiryStatus(isExpiring) : { status: "none" };

        if (statusFilter === "APPROVED") {
          if (doc.status !== "Approved" && doc.approval_status !== "Approved" && doc.status !== "FINAL") {
            return false;
          }
        } else if (statusFilter === "PENDING") {
          if (
            doc.status !== "Internal Review" &&
            doc.status !== "Submitted" &&
            doc.approval_status !== "Pending Review" &&
            doc.approval_status !== "Pending Approval"
          ) {
            return false;
          }
        } else if (statusFilter === "EXPIRING_SOON") {
          if (expiryInfo.status !== "urgent" && expiryInfo.status !== "warning") return false;
        } else if (statusFilter === "EXPIRED") {
          if (expiryInfo.status !== "expired") return false;
        }
      }

      // 6. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const docNum = (doc.document_number || (doc as any).documentNumber || (doc as any).reference || "").toLowerCase();
        const title = (doc.document_title || (doc as any).title || "").toLowerCase();
        const folder = (doc.folder_name || "").toLowerCase();
        const subfolder = (doc.subfolder_name || "").toLowerCase();
        const discipline = ((doc as any).discipline || "").toLowerCase();
        const originator = ((doc as any).originator || (doc as any).authority || (doc as any).issuing_authority || "").toLowerCase();
        const fileName = (doc.file_name || (doc as any).fileName || "").toLowerCase();

        return (
          docNum.includes(q) ||
          title.includes(q) ||
          folder.includes(q) ||
          subfolder.includes(q) ||
          discipline.includes(q) ||
          originator.includes(q) ||
          fileName.includes(q)
        );
      }

      return true;
    });
  }, [
    documents,
    selectedCategory,
    activeSubcategory,
    activeDiscipline,
    activeWayleaveType,
    isDrawings,
    isWayleaves,
    statusFilter,
    searchQuery
  ]);

  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        const dateA = a.document_date ? new Date(a.document_date).getTime() : new Date(a.created_at || (a as any).createdAt).getTime();
        const dateB = b.document_date ? new Date(b.document_date).getTime() : new Date(b.created_at || (b as any).createdAt).getTime();
        comparison = dateA - dateB;
      } else if (sortField === "number") {
        const numA = a.document_number || (a as any).documentNumber || (a as any).reference || "";
        const numB = b.document_number || (b as any).documentNumber || (b as any).reference || "";
        comparison = numA.localeCompare(numB);
      } else if (sortField === "title") {
        const titleA = a.document_title || (a as any).title || "";
        const titleB = b.document_title || (b as any).title || "";
        comparison = titleA.localeCompare(titleB);
      } else if (sortField === "status") {
        const statA = a.status || a.approval_status || "";
        const statB = b.status || b.approval_status || "";
        comparison = statA.localeCompare(statB);
      } else if (sortField === "category") {
        const catA = a.folder_name || "";
        const catB = b.folder_name || "";
        comparison = catA.localeCompare(catB);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [filteredDocuments, sortField, sortAsc]);

  const handleSort = (field: "number" | "title" | "date" | "status" | "category") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getDocIcon = (fileName: string) => {
    const ext = fileName?.split(".").pop()?.toLowerCase() || "";
    switch (ext) {
      case "pdf":
        return <FileText className="w-3.5 h-3.5 text-rose-500" />;
      case "docx":
      case "doc":
        return <FileText className="w-3.5 h-3.5 text-blue-500" />;
      case "xlsx":
      case "xls":
      case "csv":
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />;
      case "dwg":
      case "dxf":
        return <Compass className="w-3.5 h-3.5 text-purple-500" />;
      case "png":
      case "jpg":
      case "jpeg":
        return <ImageIcon className="w-3.5 h-3.5 text-violet-500" />;
      default:
        return <File className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-3 w-full min-w-0" id="documents-register-table-container">
      {/* 1. SUBCATEGORY & DISCIPLINE SUBTABS (Filtered within selected category) */}
      {currentCatDef && (
        <div className="bg-white dark:bg-[#0B172A] p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <button
              onClick={() => handleSubcategoryClick(null)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                !activeSubcategory
                  ? "bg-[#07182E] dark:bg-blue-600 text-white shadow-xs"
                  : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              }`}
            >
              <span>All {currentCatDef.title}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  !activeSubcategory ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {
                  documents.filter(
                    (d) => normalizeDocumentCategory(d.folder_name, d.subfolder_name).mainCategory === selectedCategory
                  ).length
                }
              </span>
            </button>

            {currentCatDef.subcategories.map((subCat, idx) => {
              const isSelected = activeSubcategory === subCat;
              const count = documents.filter((d) => {
                const norm = normalizeDocumentCategory(d.folder_name, d.subfolder_name);
                return norm.mainCategory === selectedCategory && (norm.subcategory === subCat || d.subfolder_name === subCat);
              }).length;

              return (
                <button
                  key={`${subCat}-${idx}`}
                  onClick={() => {
                    handleSubcategoryClick(subCat);
                    if (subCat === "Drawings" && !activeDiscipline) {
                      handleDisciplineClick("Civil Engineering");
                    }
                    if (subCat === "Wayleaves" && !activeWayleaveType) {
                      handleWayleaveTypeClick("Roads Agencies");
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-[#07182E] dark:bg-blue-600 text-white shadow-xs"
                      : "bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <span>{subCat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secondary Subtier: Drawings Disciplines */}
          {isDrawings && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 pl-1 shrink-0 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-blue-500" /> Discipline:
              </span>
              <button
                onClick={() => handleDisciplineClick(null)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-all ${
                  !activeDiscipline
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                All Disciplines
              </button>
              {DRAWING_DISCIPLINES.map((disc, idx) => {
                const isDiscSelected = activeDiscipline === disc;
                return (
                  <button
                    key={`${disc}-${idx}`}
                    onClick={() => handleDisciplineClick(disc)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                      isDiscSelected
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>{disc}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Secondary Subtier: Wayleaves Authorities */}
          {isWayleaves && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 pl-1 shrink-0 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Utility:
              </span>
              <button
                onClick={() => handleWayleaveTypeClick(null)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-all ${
                  !activeWayleaveType
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                All Utilities
              </button>
              {WAYLEAVE_CATEGORIES.map((wayType, idx) => {
                const isTypeSelected = activeWayleaveType === wayType;
                return (
                  <button
                    key={`${wayType}-${idx}`}
                    onClick={() => handleWayleaveTypeClick(wayType)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                      isTypeSelected
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>{wayType}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. FILTER & ACTION TOOLBAR */}
      <div className="bg-white dark:bg-[#0B172A] p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Left: Search & Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative min-w-[200px] sm:min-w-[260px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search document no, title, originator, file..."
              className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="APPROVED">Approved / Active</option>
              <option value="PENDING">In Review</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {/* Right: Quick Records Counter & New Register Action */}
        <div className="flex items-center gap-2 shrink-0 justify-between md:justify-end">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono">
            {sortedDocuments.length} of {documents.length} records
          </span>
          <button
            onClick={onUploadNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* 3. REGISTER LIST TABLE - 11 COLUMNS */}
      <div className="bg-white dark:bg-[#0B172A] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200 min-w-[1000px]">
            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                {/* 1. Document Number */}
                <th
                  onClick={() => handleSort("number")}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Document Number</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* 2. Title */}
                <th
                  onClick={() => handleSort("title")}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Title</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* 3. Category */}
                <th
                  onClick={() => handleSort("category")}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Category</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* 4. Discipline */}
                <th className="py-2.5 px-3 whitespace-nowrap">Discipline</th>

                {/* 5. Revision */}
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Revision</th>

                {/* 6. Status */}
                <th
                  onClick={() => handleSort("status")}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* 7. Originator */}
                <th className="py-2.5 px-3 whitespace-nowrap">Originator</th>

                {/* 8. Date */}
                <th
                  onClick={() => handleSort("date")}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* 9. Owner */}
                <th className="py-2.5 px-3 whitespace-nowrap">Owner</th>

                {/* 10. Expiry / Due Date */}
                <th className="py-2.5 px-3 whitespace-nowrap">Expiry / Due Date</th>

                {/* 11. Actions */}
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {sortedDocuments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      No documents found matching filters
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Adjust search terms or click "Upload Document" to register a file.
                    </p>
                  </td>
                </tr>
              ) : (
                sortedDocuments.map((doc) => {
                  const norm = normalizeDocumentCategory(doc.folder_name, doc.subfolder_name);
                  const isExpiring = doc.expiry_date || (doc as any).expiryDate;
                  const expiryInfo = isExpiring ? getExpiryStatus(isExpiring) : { status: "none", label: "None" };
                  const uploaderName = uploaderProfiles[doc.uploaded_by]?.full_name || (doc as any).uploadedByName || doc.uploaded_by || "Admin";
                  const originatorName = (doc as any).originator || (doc as any).issuing_authority || (doc as any).authority || "Client / Engineer";
                  const disciplineName = (doc as any).discipline || (doc as any).wayleave_type || "—";
                  const docDate = doc.document_date ? formatDate(doc.document_date) : doc.created_at ? formatDate(doc.created_at) : "—";
                  const docNum = doc.document_number || (doc as any).documentNumber || (doc as any).reference || "PRJ-" + doc.id?.slice(0, 5);

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors"
                    >
                      {/* 1. Document Number */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                        {docNum}
                      </td>

                      {/* 2. Title & File */}
                      <td className="py-2.5 px-3 min-w-[220px] max-w-[320px]">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                            {getDocIcon(doc.file_name || (doc as any).fileName)}
                          </span>
                          <div className="min-w-0">
                            <span
                              className="font-bold text-slate-900 dark:text-white line-clamp-1 block hover:text-blue-600 cursor-pointer"
                              onClick={() => onView(doc)}
                              title={doc.document_title || (doc as any).title}
                            >
                              {doc.document_title || (doc as any).title}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block font-mono">
                              {doc.file_name || (doc as any).fileName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Category */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                          {doc.subfolder_name || norm.subcategory || norm.mainCategory}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {norm.mainCategory}
                        </span>
                      </td>

                      {/* 4. Discipline */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {disciplineName !== "—" ? (
                          <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded font-semibold border border-blue-100 dark:border-blue-900">
                            {disciplineName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* 5. Revision */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center">
                        <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {doc.revision || "R00"}
                        </span>
                      </td>

                      {/* 6. Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {expiryInfo.status === "expired" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                            Expired
                          </span>
                        ) : doc.status === "Approved" || doc.approval_status === "Approved" || doc.status === "FINAL" || !doc.status ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Approved
                          </span>
                        ) : doc.status === "Internal Review" || doc.status === "Submitted" || doc.approval_status === "Pending Review" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            In Review
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {doc.status || "Draft"}
                          </span>
                        )}
                      </td>

                      {/* 7. Originator */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                        <span className="truncate max-w-[130px] block" title={originatorName}>
                          {originatorName}
                        </span>
                      </td>

                      {/* 8. Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400 font-mono">
                        {docDate}
                      </td>

                      {/* 9. Owner */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                        <span className="truncate max-w-[110px] block" title={uploaderName}>
                          {uploaderName}
                        </span>
                      </td>

                      {/* 10. Expiry / Due Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isExpiring ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                              {formatDate(isExpiring)}
                            </span>
                            {expiryInfo.status === "expired" && (
                              <span className="text-[9px] text-red-600 font-bold uppercase">Exp</span>
                            )}
                            {(expiryInfo.status === "urgent" || expiryInfo.status === "warning") && (
                              <span className="text-[9px] text-amber-600 font-bold uppercase">{expiryInfo.label}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Perpetual</span>
                        )}
                      </td>

                      {/* 11. Actions */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onView(doc)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="View Document in CDE Viewer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDownload(doc)}
                            className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Download File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEdit(doc)}
                            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Edit Metadata"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(doc)}
                            className="p-1 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
