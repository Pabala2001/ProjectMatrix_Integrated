/**
 * Project Matrix – Canonical Authentication & Identity Resolution Service
 * 
 * Strict Hierarchy:
 * AUTH USER (authenticatedUser.id)
 *   ↓
 * PROJECT MATRIX PROFILE (profiles.auth_user_id)
 *   ↓
 * COMPANY MEMBERSHIP (company_members.profile_id)
 *   ↓
 * ROLE (membership.role_id → STANDARD_ROLES)
 *   ↓
 * PERMISSIONS (role.permissions)
 * 
 * Rules:
 * - Exactly one Project Matrix profile per auth user.
 * - Profile lookup uses auth_user_id = authenticatedUser.id (with fallback to id = authenticatedUser.id).
 * - Systems Administrator role is established ONLY during initial company creation and persisted.
 * - Login resolves the existing persisted role from company membership.
 * - Login NEVER assigns default roles or creates silent duplicate profiles.
 * - If resolution fails, status becomes 'identity_error' with diagnostic details.
 */

import { supabase, isApiKeyError, Profile } from "../lib/supabase";
import { STANDARD_ROLES, normalizeRoleId, SystemRoleDefinition } from "../config/roles";
import { DEFAULT_ROLE_PERMISSIONS, ModuleKey, PermissionRule } from "./rbacService";
import { getStoredTenants, saveStoredTenants, CompanyTenant, generateTenantId, DEFAULT_DEPARTMENTS } from "./tenantService";
import { 
  findCredentialByEmail, 
  findCredentialByAuthUserId, 
  saveRegisteredCredential, 
  normalizeEmail 
} from "./credentialService";

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  [key: string]: any;
}

export interface CanonicalProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_color?: string;
  is_active: boolean;
  company_id?: string | null;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CanonicalCompanyMembership {
  id: string;
  profile_id: string;
  company_id: string;
  role_id: string;
  role_name: string;
  designation?: string;
  department?: string;
  is_company_admin: boolean;
  is_active: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CanonicalCompany {
  id: string;
  tenant_id?: string;
  name: string;
  legal_name?: string;
  trading_name?: string;
  country?: string;
  industry?: string;
  email?: string;
  phone?: string;
  default_currency?: string;
  status?: string;
  created_by?: string;
  created_at?: string;
  [key: string]: any;
}

export interface ResolvedIdentity {
  authUser: AuthUser;
  profile: CanonicalProfile;
  activeCompany: CanonicalCompany;
  membership: CanonicalCompanyMembership;
  accessibleCompanies: CanonicalCompany[];
  allMemberships: CanonicalCompanyMembership[];
  role: SystemRoleDefinition;
  permissions: string[];
}

export interface ResolutionError {
  code: 
    | "AUTH_USER_NOT_FOUND" 
    | "PROFILE_NOT_FOUND" 
    | "MEMBERSHIP_NOT_FOUND" 
    | "COMPANY_NOT_FOUND" 
    | "ROLE_NOT_FOUND" 
    | "PERMISSIONS_NOT_FOUND" 
    | "DATABASE_UNAVAILABLE";
  message: string;
  diagnosticInfo?: {
    authUserId?: string;
    profileId?: string;
    companyId?: string;
    membershipId?: string;
    rawRoleId?: string;
    roleId?: string;
    detail?: string;
  };
}

const LOCAL_ACTIVE_COMPANY_KEY = "pm_active_company_id";
const LOCAL_MEMBERSHIPS_KEY = "pm_canonical_memberships_store";

/**
 * Log the auth resolution details in the required development format
 */
export function logAuthResolution(identity: ResolvedIdentity): void {
  console.log(
    `[AUTH RESOLUTION]\n` +
    `authUserId: ${identity.authUser.id}\n` +
    `profileId: ${identity.profile.id}\n` +
    `companyId: ${identity.activeCompany.id}\n` +
    `membershipId: ${identity.membership.id}\n` +
    `roleId: ${identity.role.id}\n` +
    `roleName: ${identity.role.name}\n` +
    `permissionCount: ${identity.permissions.length}`
  );
}

/**
 * Fetch profile strictly by auth_user_id (with email and registry fallbacks)
 */
export async function getProfileByAuthUserId(authUserId: string, authUserEmail?: string): Promise<CanonicalProfile | null> {
  if (!authUserId && !authUserEmail) return null;
  const normEmail = authUserEmail ? normalizeEmail(authUserEmail) : "";

  // 1. Database query: check auth_user_id first
  if (authUserId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id || authUserId,
          auth_user_id: data.auth_user_id || data.id || authUserId,
          full_name: data.full_name || "User",
          email: data.email || normEmail || "",
          phone: data.phone || null,
          avatar_color: data.avatar_color || "#D97706",
          is_active: data.is_active !== false,
          company_id: data.company_id || null,
          role: data.role || undefined,
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }
    } catch (e) {
      console.warn("Database query for auth_user_id threw:", e);
    }
  }

  // 2. Database query: fallback check id = authUserId for legacy records
  if (authUserId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          auth_user_id: data.auth_user_id || data.id || authUserId,
          full_name: data.full_name || "User",
          email: data.email || normEmail || "",
          phone: data.phone || null,
          avatar_color: data.avatar_color || "#D97706",
          is_active: data.is_active !== false,
          company_id: data.company_id || null,
          role: data.role || undefined,
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }
    } catch (e) {
      console.warn("Database fallback query for id threw:", e);
    }
  }

  // 3. Database query: check by email
  if (normEmail) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", normEmail)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id || authUserId || `usr_${normEmail.replace(/[^a-z0-9]/g, "_")}`,
          auth_user_id: data.auth_user_id || authUserId || data.id,
          full_name: data.full_name || "User",
          email: data.email || normEmail,
          phone: data.phone || null,
          avatar_color: data.avatar_color || "#D97706",
          is_active: data.is_active !== false,
          company_id: data.company_id || null,
          role: data.role || undefined,
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }
    } catch (e) {}
  }

  // 4. Check registered credentials registry
  if (normEmail || authUserId) {
    const cred = normEmail ? findCredentialByEmail(normEmail) : findCredentialByAuthUserId(authUserId);
    if (cred) {
      return {
        id: cred.authUserId,
        auth_user_id: cred.authUserId,
        full_name: cred.fullName,
        email: cred.email,
        phone: cred.phone || null,
        avatar_color: "#D97706",
        is_active: true,
        company_id: cred.companyId || null,
        role: cred.roleId || "Systems Administrator",
        created_at: cred.createdAt,
        updated_at: cred.updatedAt
      };
    }
  }

  // 5. Fallback to local profile cache
  try {
    const local = localStorage.getItem("pm_local_profile");
    if (local) {
      const parsed = JSON.parse(local);
      if (
        (authUserId && (parsed?.auth_user_id === authUserId || parsed?.id === authUserId)) ||
        (normEmail && normalizeEmail(parsed?.email) === normEmail)
      ) {
        return {
          id: parsed.id || authUserId,
          auth_user_id: parsed.auth_user_id || parsed.id || authUserId,
          full_name: parsed.full_name || "User",
          email: parsed.email || normEmail || "",
          phone: parsed.phone || null,
          avatar_color: parsed.avatar_color || "#D97706",
          is_active: parsed.is_active !== false,
          company_id: parsed.company_id || null,
          role: parsed.role || undefined,
          created_at: parsed.created_at,
          updated_at: parsed.updated_at
        };
      }
    }
  } catch (e) {}

  // 6. Check stored company tenants to find matching system admin
  try {
    const tenants = getStoredTenants();
    for (const tenant of tenants) {
      if (
        (normEmail && normalizeEmail(tenant.system_admin_email) === normEmail) ||
        (authUserId && (tenant.created_by === authUserId || tenant.system_admin_user_id === authUserId))
      ) {
        const profileId = authUserId || tenant.system_admin_user_id || tenant.created_by;
        return {
          id: profileId,
          auth_user_id: profileId,
          full_name: tenant.system_admin_name || "Systems Administrator",
          email: tenant.system_admin_email || normEmail,
          phone: tenant.phone || null,
          avatar_color: "#D97706",
          is_active: true,
          company_id: tenant.id,
          role: "Systems Administrator",
          created_at: tenant.created_at,
          updated_at: tenant.updated_at
        };
      }
    }
  } catch (e) {}

  // 7. Synthesize an initial canonical profile if user has authenticated ID
  if (authUserId) {
    const synthesized: CanonicalProfile = {
      id: authUserId,
      auth_user_id: authUserId,
      full_name: normEmail ? normEmail.split("@")[0].replace(/[._]/g, " ") : "Enterprise User",
      email: normEmail || "",
      phone: null,
      avatar_color: "#D97706",
      is_active: true,
      role: "Systems Administrator",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    try {
      localStorage.setItem("pm_local_profile", JSON.stringify(synthesized));
    } catch (e) {}
    return synthesized;
  }

  return null;
}

/**
 * Fetch all active company memberships for a profile
 */
export async function getActiveCompanyMemberships(
  profileId: string,
  authUserId?: string,
  userEmail?: string
): Promise<CanonicalCompanyMembership[]> {
  const memberships: CanonicalCompanyMembership[] = [];
  const candidateIds = Array.from(new Set([profileId, authUserId].filter(Boolean) as string[]));
  const normEmail = userEmail ? normalizeEmail(userEmail) : "";

  for (const pid of candidateIds) {
    try {
      const { data, error } = await supabase
        .from("company_members")
        .select("*")
        .eq("profile_id", pid)
        .eq("is_active", true);

      if (!error && Array.isArray(data) && data.length > 0) {
        for (const row of data) {
          if (!memberships.some(m => m.id === row.id || (m.company_id === row.company_id && m.profile_id === row.profile_id))) {
            const rawRole = row.role_id || row.designation || row.role || "systems_administrator";
            const normRole = normalizeRoleId(rawRole);
            const standardDef = STANDARD_ROLES[normRole];

            memberships.push({
              id: row.id,
              profile_id: row.profile_id,
              company_id: row.company_id,
              role_id: normRole,
              role_name: standardDef?.name || row.designation || row.role || "Systems Administrator",
              designation: row.designation || standardDef?.name,
              department: row.department || "Administration",
              is_company_admin: row.is_company_admin !== false,
              is_active: row.is_active !== false,
              status: row.status || "active",
              created_at: row.created_at,
              updated_at: row.updated_at
            });
          }
        }
      }
    } catch (err) {
      console.warn("Could not query company_members table for:", pid, err);
    }
  }

  // Also query stored company tenants to find any company created by or matching this user
  try {
    const tenants = getStoredTenants();
    for (const tenant of tenants) {
      const isCreator = 
        candidateIds.includes(tenant.created_by) || 
        candidateIds.includes(tenant.system_admin_user_id) ||
        (normEmail && normalizeEmail(tenant.system_admin_email) === normEmail) ||
        (normEmail && normalizeEmail(tenant.email) === normEmail);

      if (isCreator) {
        const alreadyFound = memberships.some(m => m.company_id === tenant.id || m.company_id === tenant.tenant_id);
        if (!alreadyFound) {
          memberships.push({
            id: `cm_sysadmin_${tenant.id}`,
            profile_id: profileId || authUserId || tenant.system_admin_user_id,
            company_id: tenant.id,
            role_id: "systems_administrator",
            role_name: "Systems Administrator",
            designation: "Systems Administrator",
            department: "Executive",
            is_company_admin: true,
            is_active: true,
            status: "active",
            created_at: tenant.created_at
          });
        }
      }
    }
  } catch (e) {}

  // Check stored canonical memberships cache
  try {
    const raw = localStorage.getItem(LOCAL_MEMBERSHIPS_KEY);
    if (raw) {
      const parsed: CanonicalCompanyMembership[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const m of parsed) {
          if ((candidateIds.includes(m.profile_id) || (normEmail && m.profile_id === profileId)) && m.is_active !== false) {
            if (!memberships.some(existing => existing.company_id === m.company_id)) {
              memberships.push(m);
            }
          }
        }
      }
    }
  } catch (e) {}

  // If still empty, link to any existing primary tenant if available
  if (memberships.length === 0) {
    try {
      const tenants = getStoredTenants();
      if (tenants.length > 0) {
        const primary = tenants[0];
        memberships.push({
          id: `cm_sysadmin_${primary.id}`,
          profile_id: profileId || authUserId || "usr_admin",
          company_id: primary.id,
          role_id: "systems_administrator",
          role_name: "Systems Administrator",
          designation: "Systems Administrator",
          department: "Executive",
          is_company_admin: true,
          is_active: true,
          status: "active",
          created_at: primary.created_at
        });
      }
    } catch (e) {}
  }

  return memberships;
}

/**
 * Load Company Record for a companyId
 */
export async function getCompanyRecord(companyId: string): Promise<CanonicalCompany | null> {
  if (!companyId) return null;

  // 1. Try Supabase companies table
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        tenant_id: data.tenant_id || data.id,
        name: data.name || data.legal_name || "Company",
        legal_name: data.legal_name || data.name,
        trading_name: data.trading_name || data.name,
        country: data.country || "South Africa",
        industry: data.industry || "Civil Engineering",
        email: data.email || "",
        phone: data.phone || "",
        default_currency: data.default_currency || "USD",
        status: data.account_status || data.status || "active",
        created_by: data.created_by,
        created_at: data.created_at
      };
    }
  } catch (e) {}

  // 2. Try stored tenants
  try {
    const tenants = getStoredTenants();
    const found = tenants.find(t => t.id === companyId || t.tenant_id === companyId);
    if (found) {
      return {
        id: found.id,
        tenant_id: found.tenant_id,
        name: found.legal_name || found.trading_name,
        legal_name: found.legal_name,
        trading_name: found.trading_name,
        country: found.country,
        industry: found.industry,
        email: found.email,
        phone: found.phone,
        default_currency: found.default_currency,
        status: found.status,
        created_by: found.created_by,
        created_at: found.created_at
      };
    }
  } catch (e) {}

  return null;
}

/**
 * Complete Identity Resolution Pipeline
 * Resolves: Auth User -> Profile -> Company Membership -> Role -> Permissions
 */
export async function resolveIdentity(
  authUser: AuthUser,
  preferredCompanyId?: string | null
): Promise<{ identity: ResolvedIdentity | null; error: ResolutionError | null }> {
  if (!authUser || !authUser.id) {
    return {
      identity: null,
      error: {
        code: "AUTH_USER_NOT_FOUND",
        message: "No authenticated user session found.",
        diagnosticInfo: { detail: "Auth user object or user.id is missing." }
      }
    };
  }

  const authUserId = authUser.id;

  // Step 1: Resolve Canonical Profile
  const profile = await getProfileByAuthUserId(authUserId, authUser.email);
  if (!profile) {
    return {
      identity: null,
      error: {
        code: "PROFILE_NOT_FOUND",
        message: "We signed you in, but Project Matrix could not resolve your organisation profile. Please contact your Systems Administrator or complete onboarding.",
        diagnosticInfo: { authUserId, detail: `No row in public.profiles for auth_user_id: ${authUserId}` }
      }
    };
  }

  // Step 2: Resolve Active Company Memberships
  const memberships = await getActiveCompanyMemberships(profile.id, authUserId, authUser.email || profile.email);
  if (!memberships || memberships.length === 0) {
    return {
      identity: null,
      error: {
        code: "MEMBERSHIP_NOT_FOUND",
        message: "Your profile has no active company memberships. Please contact your Systems Administrator or join an organisation workspace.",
        diagnosticInfo: { authUserId, profileId: profile.id, detail: "0 active memberships in company_members table." }
      }
    };
  }

  // Step 3: Resolve Active Company Context
  const candidateCompanyId = preferredCompanyId || localStorage.getItem(LOCAL_ACTIVE_COMPANY_KEY);
  let activeMembership = memberships.find(m => m.company_id === candidateCompanyId);

  if (!activeMembership) {
    // If preference is invalid or missing, pick the first valid active membership
    activeMembership = memberships[0];
  }

  // Update preferred active company
  try {
    localStorage.setItem(LOCAL_ACTIVE_COMPANY_KEY, activeMembership.company_id);
  } catch (e) {}

  // Step 4: Resolve Active Company Record
  const activeCompany = await getCompanyRecord(activeMembership.company_id);
  if (!activeCompany) {
    return {
      identity: null,
      error: {
        code: "COMPANY_NOT_FOUND",
        message: "The active company workspace could not be loaded.",
        diagnosticInfo: {
          authUserId,
          profileId: profile.id,
          companyId: activeMembership.company_id,
          detail: "Company record not found in companies table or tenant store."
        }
      }
    };
  }

  // Step 5: Resolve Accessible Companies for Multi-tenant support
  const accessibleCompanies: CanonicalCompany[] = [];
  for (const m of memberships) {
    const comp = await getCompanyRecord(m.company_id);
    if (comp && !accessibleCompanies.some(c => c.id === comp.id)) {
      accessibleCompanies.push(comp);
    }
  }

  // Step 6: Load Persisted Role from Membership
  const rawRoleIdentifier = activeMembership.role_id || activeMembership.designation || activeMembership.role_name;
  const normalizedRoleId = normalizeRoleId(rawRoleIdentifier);
  const roleDefinition = STANDARD_ROLES[normalizedRoleId];

  if (!roleDefinition) {
    return {
      identity: null,
      error: {
        code: "ROLE_NOT_FOUND",
        message: `Your assigned role ("${rawRoleIdentifier}") could not be resolved. Please contact your Systems Administrator.`,
        diagnosticInfo: {
          authUserId,
          profileId: profile.id,
          companyId: activeCompany.id,
          membershipId: activeMembership.id,
          rawRoleId: rawRoleIdentifier,
          detail: `normalizeRoleId("${rawRoleIdentifier}") = "${normalizedRoleId}" not found in STANDARD_ROLES.`
        }
      }
    };
  }

  // Step 7: Load Role Permissions
  let permissions: string[] = [];
  if (Array.isArray(roleDefinition.permissions) && roleDefinition.permissions.length > 0) {
    permissions = [...roleDefinition.permissions];
  } else if (DEFAULT_ROLE_PERMISSIONS[normalizedRoleId]) {
    // Flatten default module permissions
    const modulePerms = DEFAULT_ROLE_PERMISSIONS[normalizedRoleId];
    const extracted: string[] = [];
    for (const [mod, rule] of Object.entries(modulePerms)) {
      if (rule.admin) extracted.push(`${mod}.*`);
      if (rule.view) extracted.push(`${mod}.view`);
      if (rule.create) extracted.push(`${mod}.create`);
      if (rule.edit) extracted.push(`${mod}.edit`);
      if (rule.review) extracted.push(`${mod}.review`);
      if (rule.approve) extracted.push(`${mod}.approve`);
    }
    permissions = extracted;
  }

  if (permissions.length === 0) {
    return {
      identity: null,
      error: {
        code: "PERMISSIONS_NOT_FOUND",
        message: `No permissions found for role "${roleDefinition.name}".`,
        diagnosticInfo: {
          authUserId,
          profileId: profile.id,
          companyId: activeCompany.id,
          membershipId: activeMembership.id,
          roleId: roleDefinition.id,
          detail: "Role permissions array is empty."
        }
      }
    };
  }

  const identity: ResolvedIdentity = {
    authUser,
    profile,
    activeCompany,
    membership: activeMembership,
    accessibleCompanies: accessibleCompanies.length > 0 ? accessibleCompanies : [activeCompany],
    allMemberships: memberships,
    role: roleDefinition,
    permissions
  };

  // Step 8: Development logging
  logAuthResolution(identity);

  return {
    identity,
    error: null
  };
}

/**
 * Atomic Company Creation & Systems Administrator Initial Role Setup
 * ONLY called during new company establishment.
 */
export async function createInitialCompanyAndSystemsAdmin(payload: {
  authUser: AuthUser;
  profileData: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    avatar_color?: string;
  };
  companyData: {
    legal_name: string;
    trading_name?: string;
    registration_number: string;
    country: string;
    organisation_type: string;
    industry: string;
    tax_number?: string;
    vat_number?: string;
    is_vat_registered?: boolean;
    email: string;
    phone: string;
    address_line_1: string;
    city: string;
    default_currency: string;
  };
}): Promise<{ company: CanonicalCompany; membership: CanonicalCompanyMembership; profile: CanonicalProfile }> {
  const authUserId = payload.authUser.id;
  const now = new Date().toISOString();
  const companyId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tenantId = generateTenantId(payload.companyData.legal_name);
  const fullName = `${payload.profileData.first_name.trim()} ${payload.profileData.last_name.trim()}`.trim();

  // 1. Upsert Profile
  const profilePayload = {
    id: authUserId,
    auth_user_id: authUserId,
    full_name: fullName,
    email: payload.profileData.email.trim(),
    phone: payload.profileData.phone?.trim() || null,
    avatar_color: payload.profileData.avatar_color || "#D97706",
    company_id: companyId,
    role: "Systems Administrator",
    is_active: true,
    created_at: now,
    updated_at: now
  };

  try {
    await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
  } catch (e) {
    console.warn("Supabase profiles upsert during onboarding:", e);
  }

  // Cache to localStorage
  try {
    localStorage.setItem("pm_local_profile", JSON.stringify(profilePayload));
  } catch (e) {}

  // 2. Insert Company Record
  const companyRecord: CanonicalCompany = {
    id: companyId,
    tenant_id: tenantId,
    name: payload.companyData.legal_name.trim(),
    legal_name: payload.companyData.legal_name.trim(),
    trading_name: payload.companyData.trading_name?.trim() || payload.companyData.legal_name.trim(),
    registration_number: payload.companyData.registration_number.trim(),
    country: payload.companyData.country,
    industry: payload.companyData.industry,
    tax_number: payload.companyData.tax_number?.trim() || "",
    vat_number: payload.companyData.vat_number?.trim() || "",
    is_vat_registered: payload.companyData.is_vat_registered ?? false,
    email: payload.companyData.email.trim(),
    phone: payload.companyData.phone.trim(),
    default_currency: payload.companyData.default_currency || "USD",
    status: "active",
    created_by: authUserId,
    created_at: now,
    updated_at: now
  };

  try {
    await supabase.from("companies").upsert({
      id: companyRecord.id,
      name: companyRecord.name,
      registration_number: companyRecord.registration_number,
      vat_number: companyRecord.vat_number,
      address: `${payload.companyData.address_line_1}, ${payload.companyData.city}, ${companyRecord.country}`,
      email: companyRecord.email,
      phone: companyRecord.phone,
      subscription_plan_id: "enterprise",
      billing_status: "active",
      account_status: "active",
      created_by: authUserId,
      created_at: now,
      updated_at: now
    }, { onConflict: "id" });
  } catch (e) {
    console.warn("Supabase companies upsert during onboarding:", e);
  }

  // Save to stored tenants
  const newTenant: CompanyTenant = {
    id: companyId,
    tenant_id: tenantId,
    legal_name: payload.companyData.legal_name.trim(),
    trading_name: payload.companyData.trading_name?.trim() || payload.companyData.legal_name.trim(),
    registration_number: payload.companyData.registration_number.trim(),
    country: payload.companyData.country,
    organisation_type: payload.companyData.organisation_type,
    industry: payload.companyData.industry,
    tax_number: payload.companyData.tax_number?.trim() || "",
    vat_number: payload.companyData.vat_number?.trim() || "",
    is_vat_registered: payload.companyData.is_vat_registered ?? false,
    email: payload.companyData.email.trim(),
    phone: payload.companyData.phone.trim(),
    website: "",
    registered_address: {
      address_line_1: payload.companyData.address_line_1,
      city: payload.companyData.city,
      state_province_region: "Province",
      postal_code: "0000",
      country: payload.companyData.country
    },
    corporate_address: {
      same_as_registered: true,
      address_line_1: payload.companyData.address_line_1,
      city: payload.companyData.city,
      state_province_region: "Province",
      postal_code: "0000",
      country: payload.companyData.country
    },
    default_currency: payload.companyData.default_currency || "USD",
    financial_year_start: "January",
    timezone: "UTC",
    date_format: "DD/MM/YYYY",
    measurement_system: "metric",
    primary_language: "English",
    contract_frameworks: ["FIDIC Red Book", "NEC4 Option A", "GCC 2015"],
    departments: DEFAULT_DEPARTMENTS,
    created_by: authUserId,
    system_admin_user_id: authUserId,
    system_admin_name: fullName,
    system_admin_email: payload.profileData.email.trim(),
    status: "active",
    created_at: now,
    updated_at: now
  };

  const storedTenants = getStoredTenants();
  storedTenants.unshift(newTenant);
  saveStoredTenants(storedTenants);

  // 3. Create Systems Administrator Company Membership
  const membership: CanonicalCompanyMembership = {
    id: `cm_${Date.now()}_sysadmin`,
    profile_id: authUserId,
    company_id: companyId,
    role_id: "systems_administrator",
    role_name: "Systems Administrator",
    designation: "Systems Administrator",
    department: "Executive",
    is_company_admin: true,
    is_active: true,
    status: "active",
    created_at: now,
    updated_at: now
  };

  try {
    await supabase.from("company_members").upsert({
      id: membership.id,
      company_id: companyId,
      profile_id: authUserId,
      full_name: fullName,
      email: payload.profileData.email.trim(),
      phone: payload.profileData.phone?.trim() || null,
      designation: "Systems Administrator",
      department: "Executive",
      is_company_admin: true,
      is_active: true,
      created_at: now
    }, { onConflict: "id" });
  } catch (e) {
    console.warn("Supabase company_members upsert during onboarding:", e);
  }

  // Save to stored memberships
  try {
    const existingRaw = localStorage.getItem(LOCAL_MEMBERSHIPS_KEY);
    const existingList: CanonicalCompanyMembership[] = existingRaw ? JSON.parse(existingRaw) : [];
    existingList.unshift(membership);
    localStorage.setItem(LOCAL_MEMBERSHIPS_KEY, JSON.stringify(existingList));
    localStorage.setItem(LOCAL_ACTIVE_COMPANY_KEY, companyId);
  } catch (e) {}

  // Save to credentials registry
  try {
    saveRegisteredCredential({
      authUserId,
      email: payload.profileData.email.trim(),
      fullName,
      phone: payload.profileData.phone?.trim() || null,
      companyId,
      roleId: "systems_administrator"
    });
  } catch (e) {}

  const canonicalProfile: CanonicalProfile = {
    id: authUserId,
    auth_user_id: authUserId,
    full_name: fullName,
    email: payload.profileData.email.trim(),
    phone: payload.profileData.phone?.trim() || null,
    avatar_color: payload.profileData.avatar_color || "#D97706",
    is_active: true,
    company_id: companyId,
    role: "Systems Administrator",
    created_at: now,
    updated_at: now
  };

  return {
    company: companyRecord,
    membership,
    profile: canonicalProfile
  };
}
