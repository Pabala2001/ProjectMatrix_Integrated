/**
 * Project Matrix – Document Hierarchy, Category Mappings & Legacy Migration Utilities
 */

import {
  DOCUMENT_MAIN_CATEGORIES,
  DocumentMainCategory,
  STATUTORY_DOCUMENT_CATEGORIES,
  StatutoryDocumentCategory,
  CORRESPONDENCE_CATEGORIES,
  CorrespondenceCategory,
  SPECIFICATION_CATEGORIES,
  SpecificationCategory,
  DRAWING_DISCIPLINES,
  DrawingDiscipline,
  SURVEY_CATEGORIES,
  SurveyCategory,
  PERMIT_CATEGORIES,
  PermitCategory,
  WAYLEAVE_CATEGORIES,
  WayleaveCategory,
} from "../../types/documentManagement";

export {
  DOCUMENT_MAIN_CATEGORIES,
  STATUTORY_DOCUMENT_CATEGORIES,
  CORRESPONDENCE_CATEGORIES,
  SPECIFICATION_CATEGORIES,
  DRAWING_DISCIPLINES,
  SURVEY_CATEGORIES,
  PERMIT_CATEGORIES,
  WAYLEAVE_CATEGORIES,
};

export interface CategoryStructure {
  id: DocumentMainCategory;
  title: string;
  description: string;
  subcategories: string[];
  color: string;
  accent: string;
  iconName: string;
  hasSpecialSubtiers?: boolean;
}

export const MAIN_CATEGORY_DEFINITIONS: CategoryStructure[] = [
  {
    id: "Statutory Documents",
    title: "Statutory Documents",
    description: "Appointments, signed contracts, guarantees, insurances, OHS and environmental compliance files.",
    subcategories: [...STATUTORY_DOCUMENT_CATEGORIES],
    color: "bg-blue-50 text-blue-700 border-blue-200",
    accent: "text-blue-600",
    iconName: "ShieldCheck"
  },
  {
    id: "Project Correspondence",
    title: "Project Correspondence",
    description: "Central communications register: letters, emails, site instructions, meeting minutes, and variations.",
    subcategories: [...CORRESPONDENCE_CATEGORIES],
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    accent: "text-indigo-600",
    iconName: "Mail"
  },
  {
    id: "Specifications",
    title: "Specifications",
    description: "Scope of work, Bill of Quantities, and multi-disciplinary engineering drawings and survey data.",
    subcategories: [...SPECIFICATION_CATEGORIES],
    color: "bg-teal-50 text-teal-700 border-teal-200",
    accent: "text-teal-600",
    iconName: "FileSpreadsheet",
    hasSpecialSubtiers: true
  },
  {
    id: "Permits & Licenses",
    title: "Permits & Licenses",
    description: "Municipal clearances, EIA certificates, traditional council approvals, and utility wayleaves.",
    subcategories: [...PERMIT_CATEGORIES],
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accent: "text-emerald-600",
    iconName: "FileCheck2",
    hasSpecialSubtiers: true
  }
];

/**
 * Mapping legacy folder names to new master DMS category & subcategory
 */
export function normalizeDocumentCategory(folderName: string, subfolderName?: string | null): {
  mainCategory: DocumentMainCategory;
  subcategory: string;
  discipline?: string;
} {
  const cleanFolder = (folderName || "").trim();
  const cleanSub = (subfolderName || "").trim();

  // 1. Statutory Documents
  if (cleanFolder === "Statutory Documents") {
    return {
      mainCategory: "Statutory Documents",
      subcategory: cleanSub || "Signed Contract"
    };
  }

  // Legacy "Contracts & Agreements" -> Map to Statutory Documents / Signed Contract
  if (cleanFolder === "Contracts & Agreements" || cleanFolder === "Contracts" || cleanFolder === "Legal & Contracts") {
    return {
      mainCategory: "Statutory Documents",
      subcategory: cleanSub || "Signed Contract"
    };
  }

  // 2. Project Correspondence
  if (cleanFolder === "Project Correspondence" || cleanFolder === "Correspondence" || cleanFolder === "Site Instructions & Variations") {
    return {
      mainCategory: "Project Correspondence",
      subcategory: cleanSub || "Letters"
    };
  }

  // 3. Specifications & Drawings
  if (cleanFolder === "Specifications" || cleanFolder === "Drawings" || cleanFolder === "Engineering Drawings" || cleanFolder === "Civil Drawings") {
    if (cleanFolder === "Drawings" || cleanFolder === "Civil Drawings" || cleanFolder === "Engineering Drawings" || cleanSub.toLowerCase().includes("drawing")) {
      return {
        mainCategory: "Specifications",
        subcategory: "Drawings",
        discipline: cleanSub || "Civil Engineering"
      };
    }
    return {
      mainCategory: "Specifications",
      subcategory: cleanSub || "Scope of Work"
    };
  }

  // 4. Permits & Licenses
  if (cleanFolder === "Permits & Licenses" || cleanFolder === "Permits" || cleanFolder === "Licenses") {
    return {
      mainCategory: "Permits & Licenses",
      subcategory: cleanSub || "Environmental"
    };
  }

  // Default fallback
  return {
    mainCategory: "Statutory Documents",
    subcategory: cleanSub || "Signed Contract"
  };
}

/**
 * Determines whether a subcategory supports expiry dates (guarantees, insurances, permits)
 */
export function isExpiringCategory(mainCat: string, subCat: string): boolean {
  if (mainCat === "Statutory Documents") {
    return [
      "Performance Guarantee",
      "Insurance",
      "Advance Payment Guarantee",
      "Contractor's Appointment",
      "OHS File",
      "Environmental File"
    ].includes(subCat);
  }
  if (mainCat === "Permits & Licenses") {
    return true; // All permits and wayleaves have expiration tracking
  }
  return false;
}

/**
 * Calculates days remaining until expiration and returns alert status
 */
export function getExpiryStatus(expiryDateStr?: string | null): {
  status: "expired" | "urgent" | "warning" | "normal" | "none";
  daysRemaining: number | null;
  label: string;
  badgeClass: string;
} {
  if (!expiryDateStr) {
    return { status: "none", daysRemaining: null, label: "No Expiry", badgeClass: "bg-slate-100 text-slate-600" };
  }

  const expiry = new Date(expiryDateStr).getTime();
  const now = new Date().getTime();
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "expired",
      daysRemaining: diffDays,
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      badgeClass: "bg-rose-100 text-rose-800 border border-rose-300 font-bold"
    };
  }
  if (diffDays <= 14) {
    return {
      status: "urgent",
      daysRemaining: diffDays,
      label: `Expires in ${diffDays}d`,
      badgeClass: "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
    };
  }
  if (diffDays <= 60) {
    return {
      status: "warning",
      daysRemaining: diffDays,
      label: `Expires in ${diffDays}d`,
      badgeClass: "bg-yellow-50 text-yellow-800 border border-yellow-200"
    };
  }
  return {
    status: "normal",
    daysRemaining: diffDays,
    label: `Valid (${diffDays}d left)`,
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200"
  };
}
