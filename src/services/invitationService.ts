import { assertOperationalAction } from "../integration/operationalAccess";
import { previewStorage } from "../integration/previewStorage";
/**
 * Project Matrix - Employee Invitation & Onboarding Architecture Service
 * 
 * Flow:
 * System Administrator creates invitation -> Token generated (72h expiry) -> 
 * Employee accepts invitation via secure token -> Account created with tenant_id,
 * personnel record, role assignment, and project assignments applied.
 */

import { supabase, isApiKeyError } from "../lib/supabase";
import { logAuditEvent } from "./rbacService";
import { getStoredTenants, addStoredCompanyMember, isBlockedOrMockUser } from "./tenantService";
import { createOrUpdateProfile } from "./profileService";

export type InvitationStatus = "Pending" | "Accepted" | "Expired" | "Revoked";

export interface ProjectRoleAssignment {
  projectId: string;
  projectName: string;
  projectCode: string;
  projectRole: string; // e.g., "Project Manager", "Site Engineer", "Quantity Surveyor"
}

export interface EmployeeInvitation {
  id: string;
  tenant_id: string;
  company_id: string;
  company_name: string;
  
  // Recipient details
  first_name: string;
  last_name: string;
  email: string;
  employee_number?: string;
  designation: string; // Job Title
  department: string;
  phone?: string;
  
  // Access & Role
  system_role_id: string;
  system_role_name: string;
  project_access_type: "all" | "selected";
  project_assignments: ProjectRoleAssignment[];
  
  // Security & Token
  secure_token: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  status: InvitationStatus;
}

const LOCAL_STORAGE_INVITATIONS_KEY = "pm_employee_invitations_store";

/**
 * Generate a cryptographically strong pseudo-random token for invitation links
 */
export function generateSecureInvitationToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Load all invitations stored locally
 */
export function getStoredInvitations(): EmployeeInvitation[] {
  try {
    const raw = previewStorage.getItem(LOCAL_STORAGE_INVITATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Automatically check expiry and filter blocked users
        const now = Date.now();
        const updated = parsed
          .filter(inv => !isBlockedOrMockUser({ full_name: `${inv.first_name || ""} ${inv.last_name || ""}`, email: inv.email }))
          .map(inv => {
            if (inv.status === "Pending" && new Date(inv.expires_at).getTime() < now) {
              return { ...inv, status: "Expired" as InvitationStatus };
            }
            return inv;
          });
        return updated;
      }
    }
  } catch (e) {
    console.warn("Could not read invitations from previewStorage:", e);
  }

  // Do not pre-seed fake invitations
  return [];
}

export function saveStoredInvitations(invitations: EmployeeInvitation[]): void {
  try {
    const cleaned = (invitations || []).filter(inv => 
      !isBlockedOrMockUser({ full_name: `${inv.first_name || ""} ${inv.last_name || ""}`, email: inv.email })
    );
    previewStorage.setItem(LOCAL_STORAGE_INVITATIONS_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.warn("Could not save invitations to previewStorage:", e);
  }
}

/**
 * List all invitations for a specific tenant
 */
export function getInvitationsByTenant(tenantIdOrCompanyId: string): EmployeeInvitation[] {
  const all = getStoredInvitations();
  return all.filter(
    inv => inv.tenant_id === tenantIdOrCompanyId || inv.company_id === tenantIdOrCompanyId
  );
}

/**
 * Find invitation by secure token
 */
export function getInvitationByToken(token: string): EmployeeInvitation | null {
  if (!token) return null;
  const clean = token.trim();
  const all = getStoredInvitations();
  const found = all.find(inv => inv.secure_token === clean || inv.id === clean);
  if (!found) return null;

  // Check expiration (72h)
  if (found.status === "Pending" && new Date(found.expires_at).getTime() < Date.now()) {
    found.status = "Expired";
    saveStoredInvitations(all);
  }
  return found;
}

/**
 * Create a new employee invitation
 */
export async function createEmployeeInvitation(payload: {
  tenant_id: string;
  company_id: string;
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_number?: string;
  designation: string;
  department: string;
  phone?: string;
  system_role_id: string;
  system_role_name: string;
  project_access_type: "all" | "selected";
  project_assignments: ProjectRoleAssignment[];
  created_by_id: string;
  created_by_name: string;
}): Promise<EmployeeInvitation> {
  assertOperationalAction("write", "administration/company");
  // CRITICAL RULE: System Administrator role must NEVER be sent as an ordinary invitation option
  if (
    payload.system_role_id === "system_administrator" || 
    payload.system_role_name.toLowerCase().includes("system administrator")
  ) {
    throw new Error(
      "Security Policy Violation: The System Administrator role cannot be assigned via employee invitation. Use the protected System Administrator succession workflow."
    );
  }

  const token = generateSecureInvitationToken();
  const now = new Date();
  // Recommended default: 72 hours
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();

  const newInvitation: EmployeeInvitation = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    tenant_id: payload.tenant_id,
    company_id: payload.company_id,
    company_name: payload.company_name,
    first_name: payload.first_name.trim(),
    last_name: payload.last_name.trim(),
    email: payload.email.trim().toLowerCase(),
    employee_number: payload.employee_number?.trim() || undefined,
    designation: payload.designation.trim(),
    department: payload.department.trim(),
    phone: payload.phone?.trim() || undefined,
    system_role_id: payload.system_role_id,
    system_role_name: payload.system_role_name,
    project_access_type: payload.project_access_type,
    project_assignments: payload.project_assignments,
    secure_token: token,
    created_by_id: payload.created_by_id,
    created_by_name: payload.created_by_name,
    created_at: now.toISOString(),
    expires_at: expiresAt,
    status: "Pending"
  };

  const all = getStoredInvitations();
  all.unshift(newInvitation);
  saveStoredInvitations(all);

  // Log Audit Event
  logAuditEvent({
    userId: payload.created_by_id,
    userName: payload.created_by_name,
    organisationId: payload.tenant_id,
    action: "sensitive_admin_action",
    entity: "EmployeeInvitation",
    details: `Generated secure invitation for ${newInvitation.first_name} ${newInvitation.last_name} (${newInvitation.email}) with role "${newInvitation.system_role_name}" in department "${newInvitation.department}". Expires in 72 hours.`,
    status: "SUCCESS"
  });

  return newInvitation;
}

/**
 * Resend invitation (refreshes 72h expiry token)
 */
export async function resendInvitation(
  invitationId: string, 
  adminUserId: string, 
  adminUserName: string
): Promise<EmployeeInvitation> {
  assertOperationalAction("write", "administration/company");
  const all = getStoredInvitations();
  const idx = all.findIndex(i => i.id === invitationId);
  if (idx === -1) throw new Error("Invitation record not found");

  const inv = all[idx];
  const now = new Date();
  inv.expires_at = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  inv.secure_token = generateSecureInvitationToken();
  inv.status = "Pending";

  all[idx] = inv;
  saveStoredInvitations(all);

  logAuditEvent({
    userId: adminUserId,
    userName: adminUserName,
    organisationId: inv.tenant_id,
    action: "sensitive_admin_action",
    entity: "EmployeeInvitation",
    details: `Resent invitation to ${inv.email} with refreshed 72-hour token.`,
    status: "SUCCESS"
  });

  return inv;
}

/**
 * Revoke invitation
 */
export async function revokeInvitation(
  invitationId: string, 
  adminUserId: string, 
  adminUserName: string
): Promise<void> {
  const all = getStoredInvitations();
  const idx = all.findIndex(i => i.id === invitationId);
  if (idx === -1) throw new Error("Invitation record not found");

  const inv = all[idx];
  inv.status = "Revoked";
  all[idx] = inv;
  saveStoredInvitations(all);

  logAuditEvent({
    userId: adminUserId,
    userName: adminUserName,
    organisationId: inv.tenant_id,
    action: "sensitive_admin_action",
    entity: "EmployeeInvitation",
    details: `Revoked invitation for ${inv.email} (${inv.designation}).`,
    status: "SUCCESS"
  });
}

/**
 * Update invitation (change role or projects before acceptance)
 */
export async function updateInvitation(
  invitationId: string,
  updates: Partial<EmployeeInvitation>,
  adminUserId: string,
  adminUserName: string
): Promise<EmployeeInvitation> {
  assertOperationalAction("write", "administration/company");
  const all = getStoredInvitations();
  const idx = all.findIndex(i => i.id === invitationId);
  if (idx === -1) throw new Error("Invitation record not found");

  const inv = { ...all[idx], ...updates };
  all[idx] = inv;
  saveStoredInvitations(all);

  logAuditEvent({
    userId: adminUserId,
    userName: adminUserName,
    organisationId: inv.tenant_id,
    action: "permission_changed",
    entity: "EmployeeInvitation",
    details: `Updated invitation terms for ${inv.email}: Role=${inv.system_role_name}, Department=${inv.department}.`,
    status: "SUCCESS"
  });

  return inv;
}

/**
 * Complete Employee Invitation Acceptance
 * Creates user account, links to tenant_id, creates personnel record,
 * assigns corporate role and project assignments.
 */
export async function acceptEmployeeInvitation(params: {
  token: string;
  confirmedFullName: string;
  password: string;
  phone?: string;
  mfaEnabled?: boolean;
}): Promise<{
  success: boolean;
  userId: string;
  tenantId: string;
  companyId: string;
  profile: any;
}> {
  throw new Error("Invitation redemption requires backend integration. Use an account provisioned through the existing company personnel workflow.");
}
