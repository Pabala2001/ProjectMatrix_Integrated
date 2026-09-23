/**
 * Project Matrix – Document Subtabs Horizontal Navigation Bar
 */

import React from "react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Compass,
  Zap,
  Layers,
  ArrowLeft
} from "lucide-react";
import {
  MAIN_CATEGORY_DEFINITIONS,
  DRAWING_DISCIPLINES,
  SURVEY_CATEGORIES,
  WAYLEAVE_CATEGORIES,
  normalizeDocumentCategory
} from "./documentHierarchy";
import { DocumentMainCategory, ProjectDocument } from "../../types/documentManagement";

interface DocumentSubtabsNavProps {
  documents: ProjectDocument[];
  selectedCategory: DocumentMainCategory;
  selectedSubcategory: string;
  selectedDiscipline?: string | null;
  selectedSurveyTier?: string | null;
  selectedWayleaveType?: string | null;
  onSelectSubcategory: (subCat: string, discipline?: string, surveyTier?: string, wayleaveType?: string) => void;
  onBackToSubcategories: () => void;
}

export const DocumentSubtabsNav: React.FC<DocumentSubtabsNavProps> = ({
  documents,
  selectedCategory,
  selectedSubcategory,
  selectedDiscipline,
  selectedSurveyTier,
  selectedWayleaveType,
  onSelectSubcategory,
  onBackToSubcategories
}) => {
  const currentCatDef = MAIN_CATEGORY_DEFINITIONS.find(c => c.id === selectedCategory);
  if (!currentCatDef) return null;

  const isDrawings = selectedCategory === "Specifications" && selectedSubcategory === "Drawings";
  const isSurvey = isDrawings && selectedDiscipline === "Survey";
  const isWayleaves = selectedCategory === "Permits & Licenses" && selectedSubcategory === "Wayleaves";

  // Helper to count documents for a subtab
  const getSubcategoryCount = (subCat: string, disc?: string) => {
    return documents.filter(doc => {
      const norm = normalizeDocumentCategory(doc.folder_name, doc.subfolder_name);
      if (norm.mainCategory !== selectedCategory) return false;
      if (norm.subcategory !== subCat) return false;
      if (disc && (doc as any).discipline && (doc as any).discipline !== disc) return false;
      return true;
    }).length;
  };

  return (
    <div className="space-y-2.5">
      {/* 1. Primary Subcategories Tab Strip */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onBackToSubcategories}
            className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-[#07182E] hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1 shrink-0"
            title="Back to subcategories grid"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>
          <div className="h-5 w-px bg-slate-200" />
        </div>

        {/* Scrollable Subtabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 px-1 scrollbar-none flex-1">
          {currentCatDef.subcategories.map((subCat, idx) => {
            const isSelected = selectedSubcategory === subCat;
            const count = getSubcategoryCount(subCat);

            return (
              <button
                key={`${subCat}-${idx}`}
                onClick={() => {
                  if (subCat === "Drawings") {
                    onSelectSubcategory(subCat, selectedDiscipline || "Civil Engineering");
                  } else if (subCat === "Wayleaves") {
                    onSelectSubcategory(subCat, undefined, undefined, selectedWayleaveType || "Roads Agencies");
                  } else {
                    onSelectSubcategory(subCat);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? "bg-[#07182E] text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-[#07182E] border border-slate-200/60"
                }`}
              >
                <span>{subCat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-200/60 text-slate-600"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Secondary Subtier: Drawing Disciplines */}
      {isDrawings && (
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-center gap-2 overflow-x-auto scrollbar-none animate-fade-in">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pl-2 shrink-0 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-blue-500" /> Discipline:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {DRAWING_DISCIPLINES.map((disc, idx) => {
              const isDiscSelected = selectedDiscipline === disc;
              const discCount = documents.filter(d => 
                (d.folder_name === "Specifications" || d.subfolder_name === "Drawings") &&
                ((d as any).discipline === disc || (disc === "Civil Engineering" && !(d as any).discipline))
              ).length;

              return (
                <button
                  key={`${disc}-${idx}`}
                  onClick={() => onSelectSubcategory("Drawings", disc, disc === "Survey" ? "Design Survey" : undefined)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${
                    isDiscSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                  }`}
                >
                  <span>{disc}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${isDiscSelected ? "bg-white/20 text-white" : "text-slate-400"}`}>
                    {discCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Tertiary Subtier: Survey Categories */}
      {isSurvey && (
        <div className="bg-blue-50/60 p-2 rounded-xl border border-blue-100 flex items-center gap-2 overflow-x-auto scrollbar-none animate-fade-in">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 pl-2 shrink-0">
            Survey Phase:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {SURVEY_CATEGORIES.map((surveyTier, idx) => {
              const isTierSelected = (selectedSurveyTier || "Design Survey") === surveyTier;
              return (
                <button
                  key={`${surveyTier}-${idx}`}
                  onClick={() => onSelectSubcategory("Drawings", "Survey", surveyTier)}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                    isTierSelected
                      ? "bg-blue-700 text-white"
                      : "bg-white text-blue-700 hover:bg-blue-100/50 border border-blue-200/70"
                  }`}
                >
                  {surveyTier}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Secondary Subtier: Wayleave Utility Categories */}
      {isWayleaves && (
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 flex items-center gap-2 overflow-x-auto scrollbar-none animate-fade-in">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pl-2 shrink-0 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Wayleave Authority:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {WAYLEAVE_CATEGORIES.map((wayType, idx) => {
              const isTypeSelected = (selectedWayleaveType || "Roads Agencies") === wayType;
              return (
                <button
                  key={`${wayType}-${idx}`}
                  onClick={() => onSelectSubcategory("Wayleaves", undefined, undefined, wayType)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    isTypeSelected
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                  }`}
                >
                  {wayType}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
