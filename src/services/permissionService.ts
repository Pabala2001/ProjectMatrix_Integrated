import { previewStorage } from "../integration/previewStorage";
/**
 * Project Matrix – Enterprise RBAC Permission Engine & Service
 */

import { Permission, matchesPermission, PERMISSION_MODULES } from "../config/permissions";
import { STANDARD_ROLES, normalizeRoleId, SystemRoleDefinition } from "../config/roles";

export interface UserContext {
  id: string;
  name: string;
  email?: string;
  roles: string[]; // Supports multiple roles for multi-role union
  primaryRole: string;
  isCompanyAdmin: boolean;
  isSystemAdmin?: boolean;
  department?: string;
  status: "active" | "suspended" | "pending";
  assignedProjectIds?: string[]; // Project scoping
  delegatedLimits?: Record<string, number>; // Monetary limits e.g. { purchaseOrder: 50000000, variation: 100000000 }
}

export interface PermissionEvaluationContext {
  user: UserContext;
  companyId: string;
  projectId?: string;
  requestedPermission: string;
  amount?: number;
  currency?: string;
  creatorId?: string; // For segregation of duties check
  customRoles?: Record<string, SystemRoleDefinition>;
  userOverrides?: UserPermissionOverrideRecord[];
}

export interface UserPermissionOverrideRecord {
  id: string;
  userId: string;
  permission: string;
  allowed: boolean; // true = explicit grant, false = explicit deny
  reason: string;
  grantedBy: string;
  grantedAt: string;
}

export interface AccessEvaluationResult {
  granted: boolean;
  reason: string;
  matchedPermission?: string;
  evaluationPath: {
    authenticated: boolean;
    activeUser: boolean;
    projectScoped: boolean;
    segregationOfDutiesPassed: boolean;
    monetaryLimitPassed: boolean;
    overrideApplied?: "grant" | "deny";
    matchedRole?: string;
  };
}

export interface AccessRequest {
  id: string;
  companyId: string;
  projectId?: string;
  projectName?: string;
  userId: string;
  userName: string;
  userRole: string;
  requestedPermission: string;
  justification: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  companyId: string;
  projectId?: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 
    | "login" 
    | "logout" 
    | "failed_login" 
    | "permission_change" 
    | "role_assignment" 
    | "user_creation" 
    | "user_suspension" 
    | "record_deletion" 
    | "approval_granted" 
    | "approval_rejected" 
    | "sensitive_export" 
    | "contract_modification" 
    | "budget_modification" 
    | "access_request_submitted"
    | "access_request_reviewed"
    | "security_override";
  category: "auth" | "security" | "commercial" | "contracts" | "hr" | "system";
  details: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

// -------------------------------------------------------------
// LOCALSTORAGE KEYS
// -------------------------------------------------------------
const STORAGE_CUSTOM_ROLES = "pm_enterprise_custom_roles_v1";
const STORAGE_USER_OVERRIDES = "pm_enterprise_user_overrides_v1";
const STORAGE_ACCESS_REQUESTS = "pm_enterprise_access_requests_v1";
const STORAGE_AUDIT_LOGS = "pm_enterprise_audit_ledger_v1";
const STORAGE_DELEGATED_LIMITS = "pm_enterprise_delegated_limits_v1";

// -------------------------------------------------------------
// AUDIT LOGGING SERVICE
// -------------------------------------------------------------

export function logAuditEvent(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    ...entry,
    id: "audit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString()
  };

  try {
    const raw = previewStorage.getItem(STORAGE_AUDIT_LOGS);
    const logs: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    logs.unshift(newEntry); // newest first
    // Cap at 2000 log entries in localStorage
    if (logs.length > 2000) logs.pop();
    previewStorage.setItem(STORAGE_AUDIT_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to persist audit log:", e);
  }

  return newEntry;
}

export function getAuditLogs(filters?: { companyId?: string; projectId?: string; category?: string }): AuditLogEntry[] {
  try {
    const raw = previewStorage.getItem(STORAGE_AUDIT_LOGS);
    let logs: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    if (filters?.companyId) logs = logs.filter(l => l.companyId === filters.companyId);
    if (filters?.projectId) logs = logs.filter(l => !l.projectId || l.projectId === filters.projectId);
    if (filters?.category) logs = logs.filter(l => l.category === filters.category);
    return logs;
  } catch (e) {
    return [];
  }
}

export function exportAuditLogsToCsv(companyId?: string): string {
  const logs = getAuditLogs({ companyId });
  const headers = ["Timestamp", "Action", "Category", "User", "Role", "Project", "Details"];
  const rows = logs.map(l => [
    `"${l.timestamp}"`,
    `"${l.action}"`,
    `"${l.category}"`,
    `"${l.userName} (${l.userId})"`,
    `"${l.userRole}"`,
    `"${l.projectId || 'Global'}"`,
    `"${(l.details || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

// -------------------------------------------------------------
// ACCESS REQUESTS WORKFLOW
// -------------------------------------------------------------

export function submitAccessRequest(request: Omit<AccessRequest, "id" | "status" | "requestedAt">): AccessRequest {
  const newReq: AccessRequest = {
    ...request,
    id: "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    status: "pending",
    requestedAt: new Date().toISOString()
  };

  try {
    const raw = previewStorage.getItem(STORAGE_ACCESS_REQUESTS);
    const list: AccessRequest[] = raw ? JSON.parse(raw) : [];
    list.unshift(newReq);
    previewStorage.setItem(STORAGE_ACCESS_REQUESTS, JSON.stringify(list));

    // Audit log
    logAuditEvent({
      companyId: request.companyId,
      projectId: request.projectId,
      userId: request.userId,
      userName: request.userName,
      userRole: request.userRole,
      action: "access_request_submitted",
      category: "security",
      details: `User submitted access request for permission '${request.requestedPermission}': "${request.justification}"`
    });
  } catch (e) {
    console.error("Failed to save access request:", e);
  }

  return newReq;
}

export function getAccessRequests(companyId?: string): AccessRequest[] {
  try {
    const raw = previewStorage.getItem(STORAGE_ACCESS_REQUESTS);
    const list: AccessRequest[] = raw ? JSON.parse(raw) : [];
    if (companyId) return list.filter(r => r.companyId === companyId);
    return list;
  } catch (e) {
    return [];
  }
}

export function reviewAccessRequest(
  requestId: string, 
  status: "approved" | "rejected", 
  reviewer: { id: string; name: string; role: string },
  reviewNotes?: string
): boolean {
  try {
    const raw = previewStorage.getItem(STORAGE_ACCESS_REQUESTS);
    const list: AccessRequest[] = raw ? JSON.parse(raw) : [];
    const itemIndex = list.findIndex(r => r.id === requestId);
    if (itemIndex === -1) return false;

    const item = list[itemIndex];
    item.status = status;
    item.reviewedBy = reviewer.name;
    item.reviewedAt = new Date().toISOString();
    item.reviewNotes = reviewNotes;

    list[itemIndex] = item;
    previewStorage.setItem(STORAGE_ACCESS_REQUESTS, JSON.stringify(list));

    // If approved, automatically add an explicit user permission override!
    if (status === "approved") {
      addUserPermissionOverride({
        userId: item.userId,
        permission: item.requestedPermission,
        allowed: true,
        reason: `Approved Access Request (${item.id}): ${item.justification}`,
        grantedBy: reviewer.name
      });
    }

    // Audit log
    logAuditEvent({
      companyId: item.companyId,
      projectId: item.projectId,
      userId: reviewer.id,
      userName: reviewer.name,
      userRole: reviewer.role,
      action: "access_request_reviewed",
      category: "security",
      details: `Access request from ${item.userName} for '${item.requestedPermission}' was ${status.toUpperCase()} by ${reviewer.name}. Notes: ${reviewNotes || 'None'}`
    });

    return true;
  } catch (e) {
    console.error("Failed to review access request:", e);
    return false;
  }
}

// -------------------------------------------------------------
// USER PERMISSION OVERRIDES
// -------------------------------------------------------------

export function getUserPermissionOverrides(userId?: string): UserPermissionOverrideRecord[] {
  try {
    const raw = previewStorage.getItem(STORAGE_USER_OVERRIDES);
    const list: UserPermissionOverrideRecord[] = raw ? JSON.parse(raw) : [];
    if (userId) return list.filter(o => o.userId === userId);
    return list;
  } catch (e) {
    return [];
  }
}

export function addUserPermissionOverride(override: Omit<UserPermissionOverrideRecord, "id" | "grantedAt">): UserPermissionOverrideRecord {
  const newOverride: UserPermissionOverrideRecord = {
    ...override,
    id: "ovr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    grantedAt: new Date().toISOString()
  };

  try {
    const list = getUserPermissionOverrides();
    // Replace existing override for same user + permission if any
    const filtered = list.filter(o => !(o.userId === override.userId && o.permission === override.permission));
    filtered.push(newOverride);
    previewStorage.setItem(STORAGE_USER_OVERRIDES, JSON.stringify(filtered));
  } catch (e) {}

  return newOverride;
}

export function removeUserPermissionOverride(overrideId: string): boolean {
  try {
    const list = getUserPermissionOverrides();
    const filtered = list.filter(o => o.id !== overrideId);
    previewStorage.setItem(STORAGE_USER_OVERRIDES, JSON.stringify(filtered));
    return true;
  } catch (e) {
    return false;
  }
}

// -------------------------------------------------------------
// CORE PERMISSION EVALUATION PIPELINE
// -------------------------------------------------------------

/**
 * Evaluates whether a user can perform an action based on:
 * 1. Authentication & Status check
 * 2. System Admin / Company Admin bypass
 * 3. Project Scoping
 * 4. Explicit User Overrides (Explicit DENY always takes precedence)
 * 5. Multi-Role Union Permissions calculation
 * 6. Segregation of Duties checks
 * 7. Monetary Approval Thresholds
 */
export function evaluateEnterpriseAccess(context: PermissionEvaluationContext): AccessEvaluationResult {
  const {
    user,
    companyId,
    projectId,
    requestedPermission,
    amount,
    currency = "USD",
    creatorId,
    customRoles = {},
    userOverrides = []
  } = context;

  // 1. Authentication & User Status Check
  if (!user || !user.id) {
    return {
      granted: false,
      reason: "User is unauthenticated. Please sign in.",
      evaluationPath: {
        authenticated: false,
        activeUser: false,
        projectScoped: false,
        segregationOfDutiesPassed: false,
        monetaryLimitPassed: false
      }
    };
  }

  if (user.status === "suspended") {
    return {
      granted: false,
      reason: "Account is suspended. Contact Company Administrator.",
      evaluationPath: {
        authenticated: true,
        activeUser: false,
        projectScoped: false,
        segregationOfDutiesPassed: false,
        monetaryLimitPassed: false
      }
    };
  }

  // 2. Project Scoping Check
  // System administrators and Company Administrators have company-wide project access.
  // Other roles must be assigned to the requested project if a project scope is specified.
  let isProjectAuthorized = true;
  const isExecutiveOrAdmin = user.isCompanyAdmin || user.isSystemAdmin || user.roles.some(r => {
    const c = normalizeRoleId(r);
    return c === "company_administrator" || c === "system_administrator" || c === "managing_director" || c === "chief_operating_officer" || c === "head_of_engineering";
  });

  if (projectId && !isExecutiveOrAdmin && user.assignedProjectIds !== undefined) {
    if (!user.assignedProjectIds.includes(projectId)) {
      return {
        granted: false,
        reason: `Access restricted: User is not assigned to project '${projectId}'.`,
        evaluationPath: {
          authenticated: true,
          activeUser: true,
          projectScoped: false,
          segregationOfDutiesPassed: true,
          monetaryLimitPassed: true
        }
      };
    }
  }

  // 3. Explicit User Overrides Check (Denials take highest precedence!)
  const explicitOverride = userOverrides.find(o => o.userId === user.id && matchesPermission(o.permission, requestedPermission));
  if (explicitOverride && !explicitOverride.allowed) {
    return {
      granted: false,
      reason: `Access explicitly denied by security policy override: "${explicitOverride.reason}"`,
      evaluationPath: {
        authenticated: true,
        activeUser: true,
        projectScoped: isProjectAuthorized,
        segregationOfDutiesPassed: true,
        monetaryLimitPassed: true,
        overrideApplied: "deny"
      }
    };
  }

  // 4. System Administrator / Company Administrator Grant Check
  if (user.isSystemAdmin) {
    return {
      granted: true,
      reason: "Granted via System Administrator platform role.",
      matchedPermission: "*",
      evaluationPath: {
        authenticated: true,
        activeUser: true,
        projectScoped: true,
        segregationOfDutiesPassed: true,
        monetaryLimitPassed: true,
        matchedRole: "system_administrator"
      }
    };
  }

  if (user.isCompanyAdmin) {
    return {
      granted: true,
      reason: "Granted via Company Administrator role.",
      matchedPermission: "*",
      evaluationPath: {
        authenticated: true,
        activeUser: true,
        projectScoped: true,
        segregationOfDutiesPassed: true,
        monetaryLimitPassed: true,
        matchedRole: "company_administrator"
      }
    };
  }

  // 5. Explicit Grant Override
  if (explicitOverride && explicitOverride.allowed) {
    return {
      granted: true,
      reason: `Granted via explicit permission override: "${explicitOverride.reason}"`,
      matchedPermission: explicitOverride.permission,
      evaluationPath: {
        authenticated: true,
        activeUser: true,
        projectScoped: isProjectAuthorized,
        segregationOfDutiesPassed: true,
        monetaryLimitPassed: true,
        overrideApplied: "grant"
      }
    };
  }

  // 6. Multi-Role Union Permissions Calculation
  // Consolidate permissions across all assigned roles
  const assignedRoleKeys = (user.roles && user.roles.length > 0) ? user.roles : [user.primaryRole];
  let matchedGrant: { role: string; permission: string } | null = null;

  for (const rawRole of assignedRoleKeys) {
    const canonicalKey = normalizeRoleId(rawRole);
    const roleDef = customRoles[canonicalKey] || STANDARD_ROLES[canonicalKey];

    if (roleDef && roleDef.permissions) {
      for (const grantedPerm of roleDef.permissions) {
        if (matchesPermission(grantedPerm, requestedPermission)) {
          matchedGrant = { role: roleDef.name, permission: grantedPerm };
          break;
        }
      }
    }
    if (matchedGrant) break;
  }

  if (!matchedGrant) {
    return {
      granted: false,
      reason: `Assigned role '${user.primaryRole}' does not possess '${requestedPermission}' permission.`,
      evaluationPath: {
        authenticated: true,
        activeUser: true,
        projectScoped: isProjectAuthorized,
        segregationOfDutiesPassed: true,
        monetaryLimitPassed: true
      }
    };
  }

  // 7. Segregation of Duties Check (Prevent self-approval on high-risk workflows)
  if (creatorId && creatorId === user.id && requestedPermission.endsWith(".approve")) {
    return {
      granted: false,
      reason: "Segregation of Duties policy violation: The creator of a record cannot independently approve it.",
      evaluationPath: {
        authenticated: true,
        activeUser: true,
        projectScoped: isProjectAuthorized,
        segregationOfDutiesPassed: false,
        monetaryLimitPassed: true,
        matchedRole: matchedGrant.role
      }
    };
  }

  // 8. Monetary Approval Threshold Check
  if (amount !== undefined && amount > 0 && requestedPermission.endsWith(".approve")) {
    const limits = user.delegatedLimits || {};
    let limitKey = "general";
    if (requestedPermission.includes("commercial.variations")) limitKey = "variation";
    else if (requestedPermission.includes("commercial.certificates")) limitKey = "paymentCertificate";
    else if (requestedPermission.includes("procurement") || requestedPermission.includes("purchaseOrder")) limitKey = "purchaseOrder";
    else if (requestedPermission.includes("contracts.claims")) limitKey = "claim";

    const userThreshold = limits[limitKey] || limits["general"];
    if (userThreshold !== undefined && amount > userThreshold) {
      return {
        granted: false,
        reason: `Delegated authority limit exceeded: Amount (${amount.toLocaleString()} ${currency}) exceeds authorized threshold (${userThreshold.toLocaleString()} ${currency}).`,
        evaluationPath: {
          authenticated: true,
          activeUser: true,
          projectScoped: isProjectAuthorized,
          segregationOfDutiesPassed: true,
          monetaryLimitPassed: false,
          matchedRole: matchedGrant.role
        }
      };
    }
  }

  // All checks passed!
  return {
    granted: true,
    reason: `Permission granted via ${matchedGrant.role} (${matchedGrant.permission}).`,
    matchedPermission: matchedGrant.permission,
    evaluationPath: {
      authenticated: true,
      activeUser: true,
      projectScoped: isProjectAuthorized,
      segregationOfDutiesPassed: true,
      monetaryLimitPassed: true,
      matchedRole: matchedGrant.role
    }
  };
}
