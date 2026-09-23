import { 
  DIRECTORY_ACCESS, 
  CAPABILITY_ACCESS, 
  normalizeRole, 
  MasterRoleValue 
} from "../../supabase/functions/_shared/accessControl";

export { DIRECTORY_ACCESS, CAPABILITY_ACCESS, normalizeRole };

export type DirectoryKey = keyof typeof DIRECTORY_ACCESS | "billing";
export type CapabilityKey = keyof typeof CAPABILITY_ACCESS;

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

/**
 * Evaluates Billing access for a user against an array of company personnel.
 */
export function canUserAccessBilling(
  companyPersonnel: BillingAccessMember[] | null | undefined,
  activeCompanyId: string | null | undefined,
  profileId: string | null | undefined
): boolean {
  if (!companyPersonnel || !activeCompanyId || !profileId) {
    return false;
  }

  const activeMember = companyPersonnel.find(
    (m) => m.profile_id === profileId && m.company_id === activeCompanyId
  );

  if (!activeMember) {
    return false;
  }

  return canAccessBilling({
    member: activeMember,
    activeCompanyId,
    profileId,
  });
}

export const canAccessDirectory = (
  role: string | null | undefined,
  directory: DirectoryKey
): boolean => {
  if (directory === "billing") {
    return isBillingAllowedRole(role);
  }

  const canonicalRole = normalizeRole(role);
  if (!canonicalRole) return false;

  const allowed = DIRECTORY_ACCESS[directory as keyof typeof DIRECTORY_ACCESS];

  if (allowed === "all") {
    return true;
  }

  return (allowed as readonly string[]).includes(canonicalRole);
};

export const hasCapability = (
  role: string | null | undefined,
  capability: CapabilityKey
): boolean => {
  const canonicalRole = normalizeRole(role);
  if (!canonicalRole) return false;

  return (CAPABILITY_ACCESS[capability] as readonly string[]).includes(canonicalRole);
};



export * from "../services/rbacService";
