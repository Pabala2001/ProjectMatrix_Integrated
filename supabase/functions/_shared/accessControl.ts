export const ROLE_OPTIONS = [
  { value: "ceo", label: "CEO" },
  { value: "coo", label: "COO" },
  { value: "cfo", label: "CFO" },
  { value: "director", label: "Director" },
  { value: "project_manager", label: "Project Manager" },
  { value: "site_agent_manager", label: "Site Agent/Manager" },
  { value: "quantity_surveyor", label: "Quantity Surveyor" },
  { value: "senior_engineer", label: "Senior Engineer" },
  { value: "junior_engineer", label: "Junior Engineer" },
  { value: "procurement_officer", label: "Procurement Officer" },
  { value: "safety_officer", label: "Safety Officer" },
  { value: "foreman", label: "Foreman" },
  { value: "general_worker", label: "General Worker" },
  { value: "intern", label: "Intern" },
] as const;

export type MasterRoleValue = (typeof ROLE_OPTIONS)[number]["value"];

export const DIRECTORY_ACCESS = {
  commandCentre: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
  ],

  projectAdvisor: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
  ],

  projectAdvisor2: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
  ],

  accounts: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
  ],

  dashboard: "all",

  programme: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "site_agent_manager",
    "quantity_surveyor",
    "senior_engineer",
    "junior_engineer",
    "safety_officer",
    "foreman",
    "intern",
  ],

  dailyReports: "all",

  siteDiaries: "all",

  documents: "all",

  communication: "all",

  qualityControl: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "site_agent_manager",
    "quantity_surveyor",
    "senior_engineer",
    "junior_engineer",
    "safety_officer",
    "foreman",
    "intern",
  ],

  procurement: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "site_agent_manager",
    "quantity_surveyor",
    "procurement_officer",
  ],

  administration: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "site_agent_manager",
  ],

  labourPayroll: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "site_agent_manager",
    "quantity_surveyor",
    "procurement_officer",
    "foreman",
  ],

  settings: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "site_agent_manager",
  ],
} as const;

export const CAPABILITY_ACCESS = {
  manageCompaniesAndPersonnel: [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "site_agent_manager",
  ],
} as const;

export const normalizeRole = (role: string | null | undefined): MasterRoleValue | "" => {
  if (!role) return "";
  
  const trimmed = role.trim().toLowerCase();
  
  // Direct matching based on label or value lowercase
  for (const option of ROLE_OPTIONS) {
    if (option.value.toLowerCase() === trimmed || option.label.toLowerCase() === trimmed) {
      return option.value;
    }
  }

  // Extra mappings for flexibility (whitespace, slashes, variations)
  if (
    trimmed === "site agent" || 
    trimmed === "site manager" || 
    trimmed === "site agent / manager" || 
    trimmed === "site agent/manager" ||
    trimmed.includes("site agent") || 
    trimmed.includes("site_agent") ||
    trimmed === "site_agent_manager"
  ) {
    return "site_agent_manager";
  }
  if (trimmed === "project manager" || trimmed === "projectmanager" || trimmed === "project_manager") {
    return "project_manager";
  }
  if (trimmed === "quantity surveyor" || trimmed === "quantitysurveyor" || trimmed === "quantity_surveyor") {
    return "quantity_surveyor";
  }
  if (trimmed === "procurement officer" || trimmed === "procurementofficer" || trimmed === "procurement_officer") {
    return "procurement_officer";
  }
  if (trimmed === "senior engineer" || trimmed === "seniorengineer" || trimmed === "senior_engineer") {
    return "senior_engineer";
  }
  if (trimmed === "junior engineer" || trimmed === "juniorengineer" || trimmed === "junior_engineer") {
    return "junior_engineer";
  }
  if (trimmed === "ohs officer" || trimmed === "ohsofficer" || trimmed === "ohs_officer" || trimmed === "safety officer" || trimmed === "safety_officer") {
    return "safety_officer";
  }
  if (trimmed === "foreman") {
    return "foreman";
  }
  if (trimmed === "general worker" || trimmed === "generalworker" || trimmed === "general_worker") {
    return "general_worker";
  }
  if (trimmed === "intern") {
    return "intern";
  }

  // Fallback to searching if we can map
  const found = ROLE_OPTIONS.find(opt => {
    const valUnder = opt.value.replace(/_/g, " ");
    const valLabel = opt.label.toLowerCase();
    return trimmed.includes(opt.value) || trimmed.includes(valUnder) || trimmed.includes(valLabel);
  });

  if (found) {
    return found.value;
  }

  return "";
};

export const BILLING_ALLOWED_ROLES = [
  "ceo",
  "coo",
  "cfo",
  "director",
  "project_manager",
  "company_administrator",
] as const;

export type BillingAllowedRole = (typeof BILLING_ALLOWED_ROLES)[number];

/**
 * Normalizes role and designation strings for Billing access:
 * - Trims leading and trailing spaces
 * - Converts to lowercase
 * - Treats spaces, hyphens, and underscores as equivalent separators
 * - Maps legacy alias 'company_admin' (and 'Company Admin') to 'company_administrator'
 * - Does NOT accept 'projectmanager' or 'companyadmin' without separators
 */
export function normalizeBillingRole(roleStr: string | null | undefined): BillingAllowedRole | string {
  if (!roleStr || typeof roleStr !== "string") return "";

  const trimmed = roleStr.trim().toLowerCase();
  if (!trimmed) return "";

  let normalized = trimmed.replace(/[\s\-_]+/g, "_");

  // Support 'company_admin' as a legacy alias for 'company_administrator'
  if (normalized === "company_admin") {
    normalized = "company_administrator";
  }

  return normalized;
}

/**
 * Checks if a given role or designation string maps to one of the authorized Billing roles.
 */
export function isBillingAllowedRole(roleStr: string | null | undefined): boolean {
  const normalized = normalizeBillingRole(roleStr);
  return (BILLING_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

export interface BillingAccessMember {
  profile_id?: string | null;
  company_id?: string | null;
  designation?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  is_company_admin?: boolean | null;
  [key: string]: any;
}

export interface BillingAccessParams {
  member?: BillingAccessMember | null;
  activeCompanyId?: string | null;
  profileId?: string | null;
}

/**
 * Evaluates whether a company member record is authorized for Billing access.
 * Strict rules:
 * 1. profile_id matches signed-in profile
 * 2. company_id matches active company
 * 3. is_active === true
 * 4. designation OR role matches allowed billing roles (case-insensitive & normalized)
 *
 * NOTE: is_company_admin is NOT used as a fallback or override.
 */
export function canAccessBilling({
  member,
  activeCompanyId,
  profileId,
}: BillingAccessParams): boolean {
  if (!member || !activeCompanyId || !profileId) {
    return false;
  }

  // 1. profile_id must match the signed-in profile
  if (!member.profile_id || member.profile_id !== profileId) {
    return false;
  }

  // 2. company_id must match the active company
  if (!member.company_id || member.company_id !== activeCompanyId) {
    return false;
  }

  // 3. is_active must strictly equal true
  if (member.is_active !== true) {
    return false;
  }

  // 4. Evaluate designation and legacy role independently. Access is granted if either is allowed.
  const designationAllowed = isBillingAllowedRole(member.designation);
  const roleAllowed = isBillingAllowedRole(member.role);

  return designationAllowed || roleAllowed;
}

