import React from "react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ShieldCheck,
  Mail,
  FileSpreadsheet,
  FileCheck2,
  Award,
  Clock,
  CheckCircle2,
  HardHat,
  Trees,
  Scale,
  Compass,
  Building,
  Zap,
  FileText
} from "lucide-react";
import { ProjectDocument, DocumentMainCategory } from "../../types/documentManagement";
import {
  MAIN_CATEGORY_DEFINITIONS,
  DRAWING_DISCIPLINES,
  WAYLEAVE_CATEGORIES,
  normalizeDocumentCategory
} from "./documentHierarchy";

interface DocumentCategoryGridProps {
  documents: ProjectDocument[];
  selectedCategory: DocumentMainCategory | null;
  selectedSubcategory: string | null;
  selectedDiscipline?: string | null;
  selectedWayleaveType?: string | null;
  onSelectCategory: (category: DocumentMainCategory) => void;
  onSelectSubcategory: (subcategory: string) => void;
  onSelectDiscipline?: (discipline: string) => void;
  onSelectWayleaveType?: (type: string) => void;
  onBackToMainCategories: () => void;
}

export const DocumentCategoryGrid: React.FC<DocumentCategoryGridProps> = ({
  documents,
  selectedCategory,
  selectedSubcategory,
  selectedDiscipline,
  selectedWayleaveType,
  onSelectCategory,
  onSelectSubcategory,
  onSelectDiscipline,
  onSelectWayleaveType,
  onBackToMainCategories
}) => {
  // Count documents per main category
  const mainCategoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      "Statutory Documents": 0,
      "Project Correspondence": 0,
      "Specifications": 0,
      "Permits & Licenses": 0
    };

    documents.forEach((doc) => {
      const norm = normalizeDocumentCategory(doc.folder_name, doc.subfolder_name);
      if (counts[norm.mainCategory] !== undefined) {
        counts[norm.mainCategory]++;
      }
    });

    return counts;
  }, [documents]);

  // Helper for subcategory counts
  const getSubcategoryCount = (mainCat: DocumentMainCategory, subCat: string) => {
    return documents.filter((doc) => {
      const norm = normalizeDocumentCategory(doc.folder_name, doc.subfolder_name);
      if (norm.mainCategory === mainCat) {
        return norm.subcategory === subCat || doc.subfolder_name === subCat;
      }
      return false;
    }).length;
  };

  // Helper for subcategory icons
  const getSubcategoryIcon = (subCat: string) => {
    switch (subCat) {
      case "Contractor's Appointment":
      case "Signed Contract":
        return <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "Performance Guarantee":
      case "Advance Payment Guarantee":
        return <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "Insurance":
        return <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "Programme of Works":
      case "Cash Flow":
        return <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case "Method Statements":
      case "Quality Control Plan":
        return <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case "OHS File":
      case "Traffic Management Plan":
        return <HardHat className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case "Environmental File":
      case "Environmental":
        return <Trees className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "Email Correspondence":
      case "Letters":
        return <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case "Site Instructions":
      case "Variations":
      case "Contractual Claims":
        return <Scale className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "Scope of Work":
      case "Bill of Quantities":
        return <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case "Drawings":
        return <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "City Council":
      case "Traditional Council":
        return <Building className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
      case "Wayleaves":
        return <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  // 1. PRIMARY VIEW: 4 MAIN CATEGORIES IN COMPACT REPOSITORY LIST
  if (!selectedCategory) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#07182E] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-blue-600" />
            Controlled Repositories
          </h2>
          <span className="text-[11px] font-bold text-slate-400 font-mono">
            {documents.length} Files
          </span>
        </div>

        {/* Compact List View of Main Repositories */}
        <div className="bg-white dark:bg-[#0B172A] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {MAIN_CATEGORY_DEFINITIONS.map((cat) => {
            const count = mainCategoryCounts[cat.id] || 0;
            return (
              <div
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="p-3 sm:p-3.5 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                id={`cat-list-${cat.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`p-2 rounded-lg ${cat.color} shrink-0`}>
                    {cat.id === "Statutory Documents" && <ShieldCheck className="w-4 h-4 stroke-2" />}
                    {cat.id === "Project Correspondence" && <Mail className="w-4 h-4 stroke-2" />}
                    {cat.id === "Specifications" && <FileSpreadsheet className="w-4 h-4 stroke-2" />}
                    {cat.id === "Permits & Licenses" && <FileCheck2 className="w-4 h-4 stroke-2" />}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-[#07182E] dark:text-white group-hover:text-blue-600 transition-colors truncate">
                        {cat.title}
                      </h3>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                        {cat.subcategories.length} subtabs
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                    {count} {count === 1 ? "doc" : "docs"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. SUBCATEGORY VIEW (When a Main Category is open in Explorer mode)
  const currentCatDef = MAIN_CATEGORY_DEFINITIONS.find((c) => c.id === selectedCategory);
  if (!currentCatDef) return null;

  return (
    <div className="space-y-3">
      {/* Subcategories Compact List */}
      <div className="bg-white dark:bg-[#0B172A] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {currentCatDef.subcategories.map((subCat) => {
          const count = getSubcategoryCount(selectedCategory, subCat);
          const icon = getSubcategoryIcon(subCat);

          return (
            <div
              key={subCat}
              onClick={() => onSelectSubcategory(subCat)}
              className="p-3 sm:p-3.5 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shrink-0">
                  {icon}
                </span>

                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[#07182E] dark:text-white group-hover:text-blue-600 transition-colors truncate">
                    {subCat}
                  </h4>
                  {subCat === "Drawings" && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                      Civil, Structural, Electrical, Mechanical, Survey, Geotechnical
                    </span>
                  )}
                  {subCat === "Wayleaves" && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                      Roads, Water, Power, Telecoms, Railway
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">
                  {count} {count === 1 ? "doc" : "docs"}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
