import { previewStorage } from "../integration/previewStorage";
/**
 * Project Matrix - Multi-Tenant Isolation & Company Management Service
 * 
 * Architecture:
 * Company -> Tenant -> Users -> Roles -> Projects -> Project Assignments -> Permissions
 * 
 * Every company-controlled record references a unique tenant_id.
 */

import { supabase, isApiKeyError } from "../lib/supabase";
import { logAuditEvent } from "./rbacService";
import { createOrUpdateProfile } from "./profileService";

export interface DepartmentConfig {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  headOfDepartment?: string;
}

export interface CompanyTenant {
  id: string;
  tenant_id: string;
  legal_name: string;
  trading_name: string;
  registration_number: string;
  country: string;
  organisation_type: string;
  industry: string;
  
  // Tax & Regulatory
  tax_number: string;
  vat_number: string;
  is_vat_registered: boolean;
  business_licence_number?: string;
  contractor_registration_number?: string;
  engineering_registration_number?: string;
  
  // Contact & Address
  email: string;
  phone: string;
  website: string;
  logo_url?: string;
  registered_address: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state_province_region: string;
    postal_code: string;
    country: string;
  };
  corporate_address: {
    same_as_registered: boolean;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state_province_region: string;
    postal_code: string;
    country: string;
  };
  
  // Operating Defaults
  default_currency: string;
  financial_year_start: string;
  timezone: string;
  date_format: string;
  measurement_system: "metric" | "imperial";
  primary_language: string;
  
  // Frameworks & Departments
  contract_frameworks: string[];
  departments: DepartmentConfig[];
  
  // Administration
  created_by: string;
  system_admin_user_id: string;
  system_admin_name: string;
  system_admin_email: string;
  status: "active" | "suspended" | "trial" | "deactivated";
  created_at: string;
  updated_at: string;
}

export const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [
  { id: "dept_exec", name: "Executive", code: "EXEC", enabled: true },
  { id: "dept_gov", name: "Governance", code: "GOV", enabled: true },
  { id: "dept_admin", name: "Administration", code: "ADM", enabled: true },
  { id: "dept_eng", name: "Engineering", code: "ENG", enabled: true },
  { id: "dept_proj", name: "Projects", code: "PRJ", enabled: true },
  { id: "dept_contracts", name: "Contracts", code: "CNT", enabled: true },
  { id: "dept_comm", name: "Commercial", code: "COMM", enabled: true },
  { id: "dept_fin", name: "Finance", code: "FIN", enabled: true },
  { id: "dept_proc", name: "Procurement", code: "PROC", enabled: true },
  { id: "dept_hr", name: "Human Resources", code: "HR", enabled: true },
  { id: "dept_hse", name: "Health & Safety", code: "HSE", enabled: true },
  { id: "dept_qa", name: "Quality", code: "QA", enabled: true },
  { id: "dept_plant", name: "Plant & Equipment", code: "PLT", enabled: true },
  { id: "dept_log", name: "Logistics", code: "LOG", enabled: true },
  { id: "dept_it", name: "IT & Security", code: "IT", enabled: true },
  { id: "dept_legal", name: "Legal", code: "LGL", enabled: true },
  { id: "dept_bd", name: "Business Development", code: "BD", enabled: true },
  { id: "dept_dc", name: "Document Control", code: "DOC", enabled: true }
];

export const CONTRACT_FRAMEWORK_OPTIONS = [
  "FIDIC Red Book",
  "FIDIC Yellow Book",
  "FIDIC Silver Book",
  "NEC3 Option A (Priced Contract with Activity Schedule)",
  "NEC3 Option B (Priced Contract with Bill of Quantities)",
  "NEC3 Option C (Target Contract with Activity Schedule)",
  "NEC3 Option E (Cost Reimbursable Contract)",
  "NEC4 Option A (Priced Contract with Activity Schedule)",
  "NEC4 Option B (Priced Contract with Bill of Quantities)",
  "NEC4 Option C (Target Contract with Activity Schedule)",
  "NEC4 Option E (Cost Reimbursable Contract)",
  "GCC 2015 (General Conditions of Contract for Construction Works)",
  "JBCC Principal Building Agreement (Edition 6.2)",
  "EPC / Turnkey",
  "Design & Build",
  "Bespoke / Custom Schedule",
  "Other Standard Form"
];

const LOCAL_STORAGE_TENANTS_KEY = "pm_company_tenants_store";
const LOCAL_STORAGE_ACTIVE_TENANT = "pm_active_tenant_id";

/**
 * Generate a clean, unique tenant_id in standard enterprise format:
 * e.g. nar-7f92bd or mat-3b8a1c
 */
export function generateTenantId(companyName: string): string {
  const cleanPrefix = (companyName || "pm")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 3) || "pm";
  
  const randomHex = Math.random().toString(16).substring(2, 8);
  return `${cleanPrefix}-${randomHex}`;
}

/**
 * Load all stored company tenants from storage / cloud
 */
export function getStoredTenants(): CompanyTenant[] {
  try {
    const raw = previewStorage.getItem(LOCAL_STORAGE_TENANTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read stored tenants from localStorage:", e);
  }
  
  // Default fallback seed tenant for demo preview
  const defaultTenant: CompanyTenant = {
    id: "comp_demo_matrix_01",
    tenant_id: "nar-7f92bd",
    legal_name: "ProjectMatrix Construction (Pty) Ltd",
    trading_name: "ProjectMatrix Infrastructure",
    registration_number: "2026/012984/07",
    country: "South Africa",
    organisation_type: "Private Company",
    industry: "Civil Engineering",
    tax_number: "ZA4051268493",
    vat_number: "4920192834",
    is_vat_registered: true,
    business_licence_number: "BL-JHB-2026-8941",
    contractor_registration_number: "CIDB-9CE-GB-8921",
    engineering_registration_number: "ECSA-CORP-4402",
    email: "info@projectmatrix.co.za",
    phone: "+27 11 888 0199",
    website: "https://projectmatrix.co.za",
    registered_address: {
      address_line_1: "100 Sandton Drive",
      address_line_2: "Tower B, Level 4",
      city: "Sandton, Johannesburg",
      state_province_region: "Gauteng",
      postal_code: "2196",
      country: "South Africa"
    },
    corporate_address: {
      same_as_registered: true,
      address_line_1: "100 Sandton Drive",
      city: "Sandton, Johannesburg",
      state_province_region: "Gauteng",
      postal_code: "2196",
      country: "South Africa"
    },
    default_currency: "ZAR",
    financial_year_start: "March",
    timezone: "Africa/Johannesburg",
    date_format: "DD/MM/YYYY",
    measurement_system: "metric",
    primary_language: "English",
    contract_frameworks: ["NEC4 Option A", "FIDIC Red Book", "GCC 2015"],
    departments: DEFAULT_DEPARTMENTS,
    created_by: "usr_thuto_meng",
    system_admin_user_id: "usr_thuto_meng",
    system_admin_name: "Thuto Meng",
    system_admin_email: "thuto.meng@gmail.com",
    status: "active",
    created_at: "2026-01-15T08:00:00.000Z",
    updated_at: new Date().toISOString()
  };

  saveStoredTenants([defaultTenant]);
  return [defaultTenant];
}

export function saveStoredTenants(tenants: CompanyTenant[]): void {
  try {
    previewStorage.setItem(LOCAL_STORAGE_TENANTS_KEY, JSON.stringify(tenants));
  } catch (e) {
    console.warn("Could not save tenants to localStorage:", e);
  }
}

/**
 * Update an existing company tenant in storage
 */
export function updateStoredTenant(companyOrTenantId: string, updates: Partial<CompanyTenant>): CompanyTenant | null {
  try {
    const tenants = getStoredTenants();
    const index = tenants.findIndex(t => t.id === companyOrTenantId || t.tenant_id === companyOrTenantId);
    if (index >= 0) {
      tenants[index] = {
        ...tenants[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      saveStoredTenants(tenants);
      return tenants[index];
    } else if (companyOrTenantId) {
      // If not present, create and prepend
      const newTenant: CompanyTenant = {
        id: companyOrTenantId,
        tenant_id: updates.tenant_id || generateTenantId(updates.legal_name || updates.trading_name || "pm"),
        legal_name: updates.legal_name || "Company",
        trading_name: updates.trading_name || updates.legal_name || "Company",
        registration_number: updates.registration_number || "",
        country: updates.country || "South Africa",
        organisation_type: updates.organisation_type || "Private Company",
        industry: updates.industry || "Construction & Engineering",
        tax_number: updates.tax_number || "",
        vat_number: updates.vat_number || "",
        is_vat_registered: updates.is_vat_registered ?? true,
        email: updates.email || "",
        phone: updates.phone || "",
        website: updates.website || "",
        registered_address: updates.registered_address || {
          address_line_1: "Main Office",
          city: "Johannesburg",
          state_province_region: "Gauteng",
          postal_code: "2000",
          country: "South Africa"
        },
        corporate_address: updates.corporate_address || {
          same_as_registered: true,
          address_line_1: "Main Office",
          city: "Johannesburg",
          state_province_region: "Gauteng",
          postal_code: "2000",
          country: "South Africa"
        },
        default_currency: updates.default_currency || "ZAR",
        financial_year_start: updates.financial_year_start || "March",
        timezone: updates.timezone || "Africa/Johannesburg",
        date_format: updates.date_format || "DD/MM/YYYY",
        measurement_system: updates.measurement_system || "metric",
        primary_language: updates.primary_language || "English",
        contract_frameworks: updates.contract_frameworks || ["NEC4 Option A"],
        departments: updates.departments || DEFAULT_DEPARTMENTS,
        created_by: updates.created_by || "admin",
        system_admin_user_id: updates.system_admin_user_id || "admin",
        system_admin_name: updates.system_admin_name || "Administrator",
        system_admin_email: updates.system_admin_email || "admin@example.com",
        status: updates.status || "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      tenants.unshift(newTenant);
      saveStoredTenants(tenants);
      return newTenant;
    }
  } catch (e) {
    console.warn("Could not update stored tenant:", e);
  }
  return null;
}

/**
 * Retrieve a specific tenant or the default active tenant
 */
export function getCompanyTenant(tenantOrCompanyId?: string): CompanyTenant {
  const tenants = getStoredTenants();
  if (tenantOrCompanyId) {
    const found = tenants.find(t => t.tenant_id === tenantOrCompanyId || t.id === tenantOrCompanyId);
    if (found) return found;
  }
  const activeTenantId = previewStorage.getItem(LOCAL_STORAGE_ACTIVE_TENANT);
  if (activeTenantId) {
    const found = tenants.find(t => t.tenant_id === activeTenantId || t.id === activeTenantId);
    if (found) return found;
  }
  return tenants[0];
}

/**
 * Register a new company tenant with System Administrator
 */
export async function createCompanyTenant(payload: {
  adminUser: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    job_title?: string;
    department?: string;
  };
  company: {
    legal_name: string;
    trading_name?: string;
    registration_number: string;
    country: string;
    organisation_type: string;
    industry: string;
    tax_number: string;
    vat_number?: string;
    is_vat_registered: boolean;
    business_licence_number?: string;
    contractor_registration_number?: string;
    engineering_registration_number?: string;
    email: string;
    phone: string;
    website?: string;
    registered_address: {
      address_line_1: string;
      address_line_2?: string;
      city: string;
      state_province_region: string;
      postal_code: string;
      country: string;
    };
    corporate_address: {
      same_as_registered: boolean;
      address_line_1: string;
      address_line_2?: string;
      city: string;
      state_province_region: string;
      postal_code: string;
      country: string;
    };
    default_currency: string;
    financial_year_start: string;
    timezone: string;
    date_format: string;
    measurement_system: "metric" | "imperial";
    primary_language: string;
    contract_frameworks: string[];
    departments?: DepartmentConfig[];
  };
}): Promise<CompanyTenant> {
  throw new Error("Use the plan and company setup wizard to create a company and initialize its billing trial.");
}

/**
 * Transfer System Administrator authority (Protected Succession Workflow)
 */
export async function transferSystemAdministrator(
  tenantId: string,
  currentAdminUserId: string,
  newAdminMember: {
    userId: string;
    fullName: string;
    email: string;
    designation: string;
  },
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const tenants = getStoredTenants();
  const tenantIdx = tenants.findIndex(t => t.tenant_id === tenantId || t.id === tenantId);
  
  if (tenantIdx === -1) {
    throw new Error(`Tenant not found for ID: ${tenantId}`);
  }

  const tenant = tenants[tenantIdx];
  const prevAdminName = tenant.system_admin_name;
  const prevAdminEmail = tenant.system_admin_email;

  tenant.system_admin_user_id = newAdminMember.userId;
  tenant.system_admin_name = newAdminMember.fullName;
  tenant.system_admin_email = newAdminMember.email;
  tenant.updated_at = new Date().toISOString();

  tenants[tenantIdx] = tenant;
  saveStoredTenants(tenants);

  // Record audit log
  logAuditEvent({
    userId: currentAdminUserId,
    userName: prevAdminName,
    organisationId: tenant.tenant_id,
    action: "role_changed",
    entity: "SystemAdministratorSuccession",
    details: `System Administrator transferred from ${prevAdminName} (${prevAdminEmail}) to ${newAdminMember.fullName} (${newAdminMember.email}). Reason: ${reason || "Succession transfer"}.`,
    status: "SUCCESS"
  });

  return {
    success: true,
    message: `System Administrator authority successfully transferred to ${newAdminMember.fullName}.`
  };
}

/**
 * Company Personnel & Members Local/Cached Persistence Layer
 */
const LOCAL_STORAGE_MEMBERS_PREFIX = "pm_company_members_";

export function isBlockedOrMockUser(user: any): boolean {
  if (!user) return true;
  const fullName = (user.full_name || user.fullName || user.name || `${user.first_name || ""} ${user.last_name || ""}`).toLowerCase().trim();
  const email = (user.email || "").toLowerCase().trim();
  const id = (user.id || user.profile_id || user.company_member_id || "").toLowerCase().trim();

  if (fullName === "unknown" || (fullName === "" && !email)) return true;
  if (id.startsWith("local-pm-") || id.startsWith("mock-") || id.startsWith("demo-") || id.startsWith("fake-")) return true;

  // Explicitly remove access for requested users and mock fixtures
  const forbiddenKeywords = [
    "kabelo dlamini",
    "kabelo",
    "sarah van der merwe",
    "van der merwe",
    "nomsa sithole",
    "nomsa",
    "sithole",
    "sarah jenkins",
    "juma mkapa",
    "david kimani",
    "kassim majaliwa",
    "amina mwangi",
    "kagiso rabada"
  ];

  for (const kw of forbiddenKeywords) {
    if (fullName.includes(kw)) return true;
  }

  // Remove matching email identifiers
  if (
    email.includes("kabelo") ||
    email.includes("sithole") ||
    email.includes("nomsa") ||
    email.includes("vdm") ||
    (email.includes("sarah") && !email.includes("thuto")) ||
    (email.includes("matrix-civil.co.za") && !email.includes("thuto"))
  ) {
    return true;
  }

  return false;
}

export function getStoredCompanyMembers(companyId: string): any[] {
  if (!companyId) return [];
  try {
    const raw = previewStorage.getItem(`${LOCAL_STORAGE_MEMBERS_PREFIX}${companyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed.filter(m => !isBlockedOrMockUser(m));
        if (cleaned.length !== parsed.length) {
          previewStorage.setItem(`${LOCAL_STORAGE_MEMBERS_PREFIX}${companyId}`, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.warn("Could not read company members from localStorage:", e);
  }

  // Return empty list if no personnel have been registered or uploaded
  return [];
}

export function saveStoredCompanyMembers(companyId: string, members: any[]): void {
  if (!companyId) return;
  try {
    const cleaned = (members || []).filter(m => !isBlockedOrMockUser(m));
    previewStorage.setItem(`${LOCAL_STORAGE_MEMBERS_PREFIX}${companyId}`, JSON.stringify(cleaned));
  } catch (e) {
    console.warn("Could not save company members to localStorage:", e);
  }
}

export function addStoredCompanyMember(companyId: string, member: any): any[] {
  const current = getStoredCompanyMembers(companyId);
  const updated = [member, ...current.filter(m => m.id !== member.id && m.email !== member.email)];
  saveStoredCompanyMembers(companyId, updated);
  return updated;
}

export function updateStoredCompanyMember(companyId: string, memberId: string, updates: any): any[] {
  const current = getStoredCompanyMembers(companyId);
  const updated = current.map(m => (m.id === memberId || m.profile_id === memberId) ? { ...m, ...updates, updated_at: new Date().toISOString() } : m);
  saveStoredCompanyMembers(companyId, updated);
  return updated;
}

export function deleteStoredCompanyMember(companyId: string, memberId: string): any[] {
  const current = getStoredCompanyMembers(companyId);
  const updated = current.filter(m => m.id !== memberId && m.profile_id !== memberId);
  saveStoredCompanyMembers(companyId, updated);
  return updated;
}

