import { previewStorage } from "../integration/previewStorage";
/**
 * Project Matrix - Central Role-Based Access Control (RBAC) & Authorization Service
 * 
 * Access Architecture Pipeline:
 * Organisation -> User -> Role -> Department -> Project Assignment -> Module Permission -> User Override -> Approval Authority
 * 
 * Explicit denial always takes precedence.
 */

export type AccessLevel = 
  | "no_access" 
  | "view" 
  | "create" 
  | "edit" 
  | "review" 
  | "approve" 
  | "administer";

export type ApprovalAuthorityTier = 
  | "create" 
  | "review" 
  | "approve" 
  | "final_approve";

export type SensitiveDataCategory = 
  | "banking" 
  | "payroll" 
  | "tax_vat" 
  | "confidential_personnel" 
  | "tender_commercial_pricing" 
  | "security_permissions";

export type ModuleKey = 
  | "dashboard"
  | "engineering"
  | "contracts"
  | "commercial"
  | "programme"
  | "boq"
  | "procurement"
  | "finance"
  | "quality"
  | "hse"
  | "documents"
  | "site_diaries"
  | "administration";

export interface PermissionRule {
  view: boolean;
  create: boolean;
  edit: boolean;
  review: boolean;
  approve: boolean;
  admin: boolean;
}

export interface UserPermissionOverride {
  userId: string;
  module: ModuleKey;
  permission: keyof PermissionRule;
  allowed: boolean; // false = explicit denial
  grantedBy: string;
  grantedAt: string;
  reason?: string;
}

export interface MonetaryApprovalLimit {
  userIdOrRole: string;
  maxAmount: number;
  currency: string;
  module: "contracts" | "commercial" | "finance" | "procurement";
  tier: ApprovalAuthorityTier;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  organisationId: string;
  projectId?: string;
  action: 
    | "login" 
    | "failed_login" 
    | "access_denied" 
    | "role_changed" 
    | "permission_changed" 
    | "user_status_changed" 
    | "project_access_modified" 
    | "user_override_applied" 
    | "sensitive_admin_action" 
    | "review_submitted" 
    | "approval_granted" 
    | "rejection_recorded";
  entity: string;
  details: string;
  ipAddress?: string;
  sessionInfo?: string;
  status: "SUCCESS" | "DENIED" | "FAILED";
}

// -------------------------------------------------------------
// DEFAULT MODULE PERMISSION DEFINITIONS FOR SYSTEM ROLES
// -------------------------------------------------------------

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<ModuleKey, PermissionRule>> = {
  organisation_owner: {
    dashboard: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    engineering: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    contracts: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    commercial: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    programme: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    boq: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    procurement: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    finance: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    quality: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    hse: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    documents: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    site_diaries: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    administration: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
  },
  company_administrator: {
    dashboard: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    engineering: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    contracts: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    commercial: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    programme: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    boq: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    procurement: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    finance: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    quality: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    hse: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    documents: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    site_diaries: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    administration: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
  },
  executive: {
    dashboard: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    engineering: { view: true, create: false, edit: false, review: true, approve: true, admin: false },
    contracts: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    commercial: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    programme: { view: true, create: false, edit: false, review: true, approve: true, admin: false },
    boq: { view: true, create: false, edit: false, review: true, approve: true, admin: false },
    procurement: { view: true, create: false, edit: false, review: true, approve: true, admin: false },
    finance: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    quality: { view: true, create: false, edit: false, review: true, approve: true, admin: false },
    hse: { view: true, create: false, edit: false, review: true, approve: true, admin: false },
    documents: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    site_diaries: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    administration: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
  },
  // HEAD OF ENGINEERING: Special inheritance rule!
  // Engineering Company-Wide Authority + Contracts Manager Contractual Access + Company-Wide Visibility
  head_of_engineering: {
    dashboard: { view: true, create: false, edit: false, review: true, approve: true, admin: false },
    engineering: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    contracts: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    commercial: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    programme: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    boq: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    procurement: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    finance: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    hse: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    documents: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    site_diaries: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  project_manager: {
    dashboard: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    engineering: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    contracts: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    commercial: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    programme: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    boq: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    procurement: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    finance: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    quality: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    hse: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    documents: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    site_diaries: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  contracts_manager: {
    dashboard: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    engineering: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    contracts: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    commercial: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    programme: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    boq: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    procurement: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    finance: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    site_diaries: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  commercial_manager: {
    dashboard: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    engineering: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    contracts: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    commercial: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    programme: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    boq: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    procurement: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    finance: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    quality: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    site_diaries: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  quantity_surveyor: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    contracts: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    commercial: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    programme: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    boq: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    procurement: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    finance: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    site_diaries: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  senior_engineer: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    contracts: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    commercial: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    programme: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    boq: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    procurement: { view: true, create: true, edit: false, review: false, approve: false, admin: false },
    finance: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    hse: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    site_diaries: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  junior_engineer: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    contracts: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    commercial: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    programme: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    boq: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    procurement: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    finance: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    hse: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    site_diaries: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  planner: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    contracts: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    commercial: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    programme: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    boq: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    procurement: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    finance: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    site_diaries: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  procurement: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    contracts: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    commercial: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    programme: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    boq: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    procurement: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    finance: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    site_diaries: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  finance: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    contracts: { view: true, create: false, edit: false, review: true, approve: false, admin: false },
    commercial: { view: true, create: true, edit: true, review: true, approve: true, admin: false },
    programme: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    boq: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    procurement: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    finance: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    quality: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    site_diaries: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  hse: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    contracts: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    commercial: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    programme: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    boq: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    procurement: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    finance: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    documents: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    site_diaries: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  quality: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: true, create: true, edit: true, review: true, approve: false, admin: false },
    contracts: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    commercial: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    programme: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    boq: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    procurement: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    finance: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    hse: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    site_diaries: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  document_controller: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    contracts: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    commercial: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    programme: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    boq: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    procurement: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    finance: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: true, edit: true, review: true, approve: true, admin: true },
    site_diaries: { view: true, create: true, edit: true, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  },
  viewer: {
    dashboard: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    engineering: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    contracts: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    commercial: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    programme: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    boq: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    procurement: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    finance: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
    quality: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    hse: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    documents: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    site_diaries: { view: true, create: false, edit: false, review: false, approve: false, admin: false },
    administration: { view: false, create: false, edit: false, review: false, approve: false, admin: false },
  }
};

// -------------------------------------------------------------
// ROLE NORMALIZATION & CANONICAL KEYS
// -------------------------------------------------------------

export function canonicalizeRoleKey(role: string | null | undefined): string {
  if (!role) return "viewer";
  const norm = role.toLowerCase().trim().replace(/[\s\/-]+/g, "_");
  
  const aliasMap: Record<string, string> = {
    ceo: "organisation_owner",
    coo: "executive",
    cfo: "executive",
    director: "executive",
    managing_director: "organisation_owner",
    organisation_owner: "organisation_owner",
    company_admin: "company_administrator",
    company_administrator: "company_administrator",
    super_admin: "company_administrator",
    admin: "company_administrator",
    executive: "executive",
    head_of_engineering: "head_of_engineering",
    project_manager: "project_manager",
    assistant_project_manager: "project_manager",
    site_agent_manager: "project_manager",
    site_agent: "senior_engineer",
    site_manager: "project_manager",
    contracts_manager: "contracts_manager",
    commercial_manager: "commercial_manager",
    quantity_surveyor: "quantity_surveyor",
    senior_engineer: "senior_engineer",
    junior_engineer: "junior_engineer",
    site_engineer: "junior_engineer",
    project_engineer: "junior_engineer",
    planner: "planner",
    procurement: "procurement",
    procurement_officer: "procurement",
    finance: "finance",
    accounts: "finance",
    hse: "hse",
    safety_officer: "hse",
    environmental_officer: "hse",
    quality: "quality",
    qa_qc_engineer: "quality",
    document_controller: "document_controller",
    human_resources: "administration",
    hr_manager: "administration",
    foreman: "senior_engineer",
    general_worker: "viewer",
    intern: "viewer",
    viewer: "viewer",
  };

  return aliasMap[norm] || norm;
}

// -------------------------------------------------------------
// SENSITIVE DATA RESTRICTION EVALUATION
// -------------------------------------------------------------

export function canAccessSensitiveData(
  category: SensitiveDataCategory,
  user: {
    id: string;
    role: string;
    isCompanyAdmin?: boolean;
    department?: string;
  }
): boolean {
  const normRole = canonicalizeRoleKey(user.role);
  const isOwnerOrAdmin = user.isCompanyAdmin || normRole === "company_administrator" || normRole === "organisation_owner" || normRole === "executive";

  switch (category) {
    case "banking":
      // Organisation Owner + authorised Finance users
      return normRole === "organisation_owner" || (normRole === "executive" && isOwnerOrAdmin) || (user.department === "Finance & Accounts" && normRole === "finance");
    case "payroll":
      // Authorised HR, Finance and Executives
      return isOwnerOrAdmin || normRole === "executive" || normRole === "human_resources" || (normRole === "finance" && user.department === "Finance & Accounts");
    case "tax_vat":
      // Company Administrator + Finance + authorised management
      return isOwnerOrAdmin || normRole === "finance" || normRole === "executive";
    case "confidential_personnel":
      // Authorised HR/Administration only
      return isOwnerOrAdmin || normRole === "human_resources" || normRole === "administration";
    case "tender_commercial_pricing":
      // Commercial + Contracts + Head of Engineering + authorised management
      return isOwnerOrAdmin || normRole === "commercial_manager" || normRole === "contracts_manager" || normRole === "head_of_engineering" || normRole === "quantity_surveyor" || normRole === "executive";
    case "security_permissions":
      // Organisation Owner + authorised Company Administrators only
      return isOwnerOrAdmin;
    default:
      return false;
  }
}

// -------------------------------------------------------------
// CENTRAL ACCESS EVALUATION PIPELINE
// -------------------------------------------------------------

export interface AccessEvaluationContext {
  user: {
    id: string;
    name?: string;
    role: string;
    isCompanyAdmin?: boolean;
    department?: string;
    status?: "active" | "invited" | "suspended" | "deactivated";
  };
  organisationId: string;
  projectId?: string;
  projectRole?: string;
  customRolePermissions?: Record<string, Record<ModuleKey, PermissionRule>>;
  userOverrides?: UserPermissionOverride[];
  approvalLimits?: MonetaryApprovalLimit[];
  requestedAction?: {
    module: ModuleKey;
    permission: keyof PermissionRule;
    amount?: number;
    currency?: string;
    tier?: ApprovalAuthorityTier;
  };
}

export interface AccessEvaluationResult {
  granted: boolean;
  reason: string;
  evaluationPath: {
    authenticated: boolean;
    activeUser: boolean;
    orgMember: boolean;
    projectAssigned: boolean;
    rolePermission: boolean;
    overrideApplied?: boolean;
    approvalLimitMet?: boolean;
  };
}

export function evaluateAccess(context: AccessEvaluationContext): AccessEvaluationResult {
  let { 
    user, 
    organisationId, 
    projectId, 
    projectRole, 
    customRolePermissions,
    userOverrides, 
    approvalLimits, 
    requestedAction 
  } = context;

  // Fallback to reading saved config from localStorage if not explicitly supplied
  if (!userOverrides) {
    try {
      const savedOverrides = previewStorage.getItem("pm_user_permission_overrides");
      if (savedOverrides) userOverrides = JSON.parse(savedOverrides);
    } catch (e) {}
  }
  if (!userOverrides) userOverrides = [];

  if (!approvalLimits) {
    try {
      const savedLimits = previewStorage.getItem("pm_monetary_approval_limits");
      if (savedLimits) approvalLimits = JSON.parse(savedLimits);
    } catch (e) {}
  }
  if (!approvalLimits) approvalLimits = [];

  if (!customRolePermissions) {
    try {
      const savedRolePerms = previewStorage.getItem("pm_custom_role_permissions_v2");
      if (savedRolePerms) customRolePermissions = JSON.parse(savedRolePerms);
    } catch (e) {}
  }

  // 1. Authentication & Active Status Check
  if (!user || !user.id) {
    return {
      granted: false,
      reason: "User is not authenticated.",
      evaluationPath: { authenticated: false, activeUser: false, orgMember: false, projectAssigned: false, rolePermission: false }
    };
  }

  if (user.status && user.status !== "active") {
    return {
      granted: false,
      reason: `User account is currently ${user.status}. Access Denied.`,
      evaluationPath: { authenticated: true, activeUser: false, orgMember: false, projectAssigned: false, rolePermission: false }
    };
  }

  // 2. Organisation Membership Check
  if (!organisationId) {
    return {
      granted: false,
      reason: "No active organisation membership established.",
      evaluationPath: { authenticated: true, activeUser: true, orgMember: false, projectAssigned: false, rolePermission: false }
    };
  }

  // If no specific module/permission requested, basic org access is granted
  if (!requestedAction) {
    return {
      granted: true,
      reason: "Organisation membership verified.",
      evaluationPath: { authenticated: true, activeUser: true, orgMember: true, projectAssigned: true, rolePermission: true }
    };
  }

  const { module, permission, amount, tier } = requestedAction;
  const userRoleKey = canonicalizeRoleKey(projectRole || user.role);

  // 3. Resolve role permissions matrix
  const permissionsMatrix = customRolePermissions || DEFAULT_ROLE_PERMISSIONS;
  let effectiveRolePerms = permissionsMatrix[userRoleKey]?.[module] || DEFAULT_ROLE_PERMISSIONS[userRoleKey]?.[module] || {
    view: false,
    create: false,
    edit: false,
    review: false,
    approve: false,
    admin: false
  };

  // Special Head of Engineering rule:
  // Head of Engineering has company-wide Engineering Authority + Contracts Manager contractual access
  if (userRoleKey === "head_of_engineering" && (module === "engineering" || module === "contracts" || module === "quality")) {
    effectiveRolePerms = permissionsMatrix["head_of_engineering"]?.[module] || DEFAULT_ROLE_PERMISSIONS["head_of_engineering"][module];
  }

  // 4. Check Explicit User Overrides (Explicit Denial takes precedence!)
  const override = userOverrides.find(o => o.userId === user.id && o.module === module && o.permission === permission);
  let hasPermission = effectiveRolePerms[permission] || false;

  if (user.isCompanyAdmin || userRoleKey === "company_administrator" || userRoleKey === "organisation_owner") {
    hasPermission = true;
  }

  // Explicit user override (if present) strictly overrides role permission and admin default
  if (override !== undefined) {
    hasPermission = override.allowed;
  }

  if (!hasPermission) {
    return {
      granted: false,
      reason: override && !override.allowed
        ? `Explicit permission override active: '${permission}' access on '${module}' has been denied.`
        : `Role '${user.role}' does not possess '${permission}' permission on '${module}' module.`,
      evaluationPath: {
        authenticated: true,
        activeUser: true,
        orgMember: true,
        projectAssigned: !!projectId,
        rolePermission: false,
        overrideApplied: !!override
      }
    };
  }

  // 5. Monetary Approval Limits Check (if amount & tier are specified)
  if (amount !== undefined && amount > 0) {
    const userLimit = approvalLimits.find(l => 
      (l.userIdOrRole === user.id || l.userIdOrRole === userRoleKey || canonicalizeRoleKey(l.userIdOrRole) === userRoleKey) && 
      (l.module === module || l.module === "commercial" || l.module === "finance" || l.module === "procurement" || l.module === "contracts")
    );
    if (userLimit && amount > userLimit.maxAmount) {
      return {
        granted: false,
        reason: `Monetary limit exceeded: Requested amount (${amount} ${userLimit.currency}) exceeds maximum delegated approval limit (${userLimit.maxAmount} ${userLimit.currency}).`,
        evaluationPath: {
          authenticated: true,
          activeUser: true,
          orgMember: true,
          projectAssigned: !!projectId,
          rolePermission: true,
          overrideApplied: !!override,
          approvalLimitMet: false
        }
      };
    }
  }

  return {
    granted: true,
    reason: "Access authorized through RBAC pipeline.",
    evaluationPath: {
      authenticated: true,
      activeUser: true,
      orgMember: true,
      projectAssigned: !!projectId,
      rolePermission: true,
      overrideApplied: !!override,
      approvalLimitMet: true
    }
  };
}

// -------------------------------------------------------------
// AUDIT LOGGING HELPER
// -------------------------------------------------------------

const AUDIT_STORAGE_KEY = "pm_enterprise_audit_log";

export function getAuditLogs(): AuditLogEntry[] {
  try {
    const stored = previewStorage.getItem(AUDIT_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Error reading audit logs:", e);
  }
  return [];
}

export function logAuditEvent(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
  const fullEntry: AuditLogEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString()
  };

  try {
    const logs = getAuditLogs();
    logs.unshift(fullEntry);
    // Keep last 1000 logs
    const trimmed = logs.slice(0, 1000);
    previewStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Error persisting audit event:", e);
  }

  return fullEntry;
}

// -------------------------------------------------------------
// CONFIGURABLE ENGINEERING REPORTING STRUCTURE
// -------------------------------------------------------------

export interface ReportingNode {
  id: string;
  role: string;
  title: string;
  reportsToRole?: string;
  description: string;
}

export const DEFAULT_ENGINEERING_REPORTING_HIERARCHY: ReportingNode[] = [
  { id: "1", role: "executive", title: "Executive / COO", description: "Corporate oversight and strategic capital allocation" },
  { id: "2", role: "head_of_engineering", title: "Head of Engineering", reportsToRole: "executive", description: "Company-wide engineering technical authority and contracts governance" },
  { id: "3", role: "project_manager", title: "Engineering Manager / Project Manager", reportsToRole: "head_of_engineering", description: "Multi-disciplinary site delivery and operational execution" },
  { id: "4", role: "senior_engineer", title: "Senior Engineer", reportsToRole: "project_manager", description: "Design reviews, technical submissions, method statements and RFI management" },
  { id: "5", role: "junior_engineer", title: "Project / Site Engineer", reportsToRole: "senior_engineer", description: "Site inspections, setting out, QA logs, and contractor coordination" },
  { id: "6", role: "foreman", title: "Technician / Inspector / Surveyor", reportsToRole: "junior_engineer", description: "Field testing, dimensional control, and daily activity supervision" },
];
