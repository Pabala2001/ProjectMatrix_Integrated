import { evaluateWorkspacePermission } from "../integration/workspacePermission";
import { useMemo, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useOutletContext } from "react-router-dom";
import { 
  PermissionEvaluationContext, 
  AccessEvaluationResult, 
  evaluateEnterpriseAccess, 
  submitAccessRequest, 
  getAccessRequests,
  getUserPermissionOverrides,
  logAuditEvent
} from "../services/permissionService";
import { normalizeRoleId, STANDARD_ROLES } from "../config/roles";
import { matchesPermission } from "../config/permissions";
import { directoryPermission } from "../integration/routePolicy";
import { canAccessBilling } from "../config/accessControl";
import { canAccessDirectory, DirectoryKey } from "../config/accessControl";

export interface UsePermissionsOptions {
  projectId?: string;
  projectRole?: string;
}

export interface UsePermissionsReturn {
  // Core user information
  userId: string | undefined;
  userName: string | undefined;
  userRole: string;
  designation: string;
  isCompanyAdmin: boolean;
  isSystemAdmin: boolean;
  department: string | undefined;
  activeCompanyId: string | undefined;
  activeProjectId: string | undefined;
  assignedProjectIds: string[];
  userRoles: string[];
  loading: boolean;
  isAuthenticated: boolean;

  // Primary Granular Permission Check Method
  can: (
    permission: string, 
    arg2OrOptions?: any,
    maybeOptions?: { amount?: number; currency?: string; projectId?: string; creatorId?: string }
  ) => boolean;

  checkPermission: (
    permission: string, 
    arg2OrOptions?: any,
    maybeOptions?: { amount?: number; currency?: string; projectId?: string; creatorId?: string }
  ) => AccessEvaluationResult;

  // Multi-permission helpers
  canAny: (permissions: string[], options?: { projectId?: string; amount?: number }) => boolean;
  canAll: (permissions: string[], options?: { projectId?: string; amount?: number }) => boolean;
  canSee: (permissionsOrSubmodules: string[]) => boolean;

  // Convenience module-level helpers
  canView: (moduleOrPerm: string, options?: { projectId?: string }) => boolean;
  canCreate: (moduleOrPerm: string, options?: { projectId?: string }) => boolean;
  canEdit: (moduleOrPerm: string, options?: { projectId?: string }) => boolean;
  canDelete: (moduleOrPerm: string, options?: { projectId?: string }) => boolean;
  canApprove: (
    moduleOrPerm: string, 
    options?: { amount?: number; currency?: string; projectId?: string; creatorId?: string }
  ) => boolean;
  canAdmin: (moduleOrPerm: string, options?: { projectId?: string }) => boolean;

  // Project & Directory checks
  canAccessProject: (projectId: string) => boolean;
  canAccessDirectory: (directory: DirectoryKey) => boolean;

  // Role helpers
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;

  // Access Request workflow
  requestAccess: (permission: string, justification: string, projectId?: string) => Promise<boolean>;
}

export function usePermissions(options?: UsePermissionsOptions): UsePermissionsReturn {
  const { 
    workspace,
    profile, 
    user, 
    loading, 
    isAuthenticated,
    role: canonicalRoleDef,
    membership: canonicalMembership,
    activeCompany: canonicalCompany,
    permissions: canonicalAuthPermissions
  } = useAuth();

  // Try to safely get outlet context if rendered inside an App outlet
  let outletContext: any = null;
  try {
    outletContext = useOutletContext() || workspace;
  } catch (e) {
    // Graceful fallback if called outside router outlet
  }

  // Active Company ID
  const activeCompanyId = useMemo(() => {
    return (
      outletContext?.activeCompany?.id || canonicalCompany?.id || ""
    );
  }, [canonicalCompany?.id, outletContext?.activeCompany?.id, profile?.company_id]);

  // Active Project ID
  const activeProjectId = useMemo(() => {
    return (
      options?.projectId ||
      outletContext?.activeProject?.id ||
      undefined
    );
  }, [options?.projectId, outletContext?.activeProject?.id]);

  // Company personnel list & assigned member
  const companyPersonnel = outletContext?.companyPersonnel || [];
  const activeMember = companyPersonnel.find((p: any) => p.profile_id === user?.id && p.company_id === activeCompanyId && p.is_active === true) || canonicalMembership;

  // Determine user primary designation & raw role
  const rawRole = activeMember?.designation || activeMember?.role || activeMember?.role_name || "general_employee";
  const designation = activeMember?.designation || activeMember?.role || activeMember?.role_name || "general_employee";
  const canonicalRole = normalizeRoleId(rawRole);

  // Support multiple roles if configured
  const userRoles = useMemo(() => {
    const roles: string[] = [rawRole];
    if (activeMember?.roles && Array.isArray(activeMember.roles)) {
      activeMember.roles.forEach((r: string) => {
        if (!roles.includes(r)) roles.push(r);
      });
    }
    return roles;
  }, [rawRole, activeMember?.roles]);

  // Assigned Project IDs for project-scoping
  const assignedProjectIds = useMemo(() => {
    const ids: string[] = [];
    if (outletContext?.projectAssignments && Array.isArray(outletContext.projectAssignments)) {
      outletContext.projectAssignments.forEach((a: any) => {
        if ((a.profile_id === profile?.id || a.company_member_id === activeMember?.id) && a.project_id) {
          ids.push(a.project_id);
        }
      });
    }
    if (activeMember?.assigned_projects && Array.isArray(activeMember.assigned_projects)) {
      activeMember.assigned_projects.forEach((pId: string) => {
        if (!ids.includes(pId)) ids.push(pId);
      });
    }
    return ids;
  }, [outletContext?.projectAssignments, profile?.id, activeMember?.id, activeMember?.assigned_projects]);

  // Delegated Monetary Approval Limits
  const delegatedLimits = useMemo(() => {
    // Default fallback limits by role
    if (canonicalRole === "managing_director" || canonicalRole === "company_administrator") {
      return { general: 500000000, purchaseOrder: 250000000, variation: 500000000, paymentCertificate: 500000000 };
    }
    if (canonicalRole === "chief_operating_officer" || canonicalRole === "project_director") {
      return { general: 100000000, purchaseOrder: 50000000, variation: 100000000, paymentCertificate: 250000000 };
    }
    if (canonicalRole === "project_manager") {
      return { general: 25000000, purchaseOrder: 10000000, variation: 25000000, paymentCertificate: 50000000 };
    }
    if (canonicalRole === "commercial_manager" || canonicalRole === "contracts_manager") {
      return { general: 50000000, purchaseOrder: 25000000, variation: 50000000, paymentCertificate: 100000000 };
    }
    return {};
  }, [profile?.id, canonicalRole]);

  // Admin status check
  const isCompanyAdmin = useMemo(() => {
    if (canonicalMembership?.is_company_admin === true || activeMember?.is_company_admin === true) return true;
    const r = rawRole.toLowerCase();
    const c = canonicalRole.toLowerCase();
    return (
      c === "systems_administrator" ||
      c === "system_administrator" ||
      c === "company_administrator" ||
      r === "systems administrator" ||
      r === "system administrator" ||
      r === "company administrator" || 
      r === "company admin" || 
      r === "organisation owner" || 
      r === "super admin"
    );
  }, [canonicalMembership?.is_company_admin, activeMember?.is_company_admin, rawRole, canonicalRole]);

  const isSystemAdmin = useMemo(() => {
    const c = canonicalRole.toLowerCase();
    const r = rawRole.toLowerCase();
    return (
      c === "systems_administrator" || 
      c === "system_administrator" || 
      r === "systems administrator" ||
      r === "system administrator" || 
      r === "super admin"
    );
  }, [canonicalRole, rawRole]);

  // Department
  const department = activeMember?.department || profile?.department || undefined;

  // Normalized permission parser supporting both signatures:
  // Signature 1: can("resources.workforce.view", { amount, projectId })
  // Signature 2 (Legacy): can("resources", "view", { amount, projectId })
  const parsePermissionArgs = useCallback((permOrModule: string, arg2?: any, arg3?: any) => {
    let targetPerm = permOrModule;
    let options: { amount?: number; currency?: string; projectId?: string; creatorId?: string } = {};

    if (typeof arg2 === "string") {
      // Legacy signature: can(module, action, opts)
      targetPerm = `${permOrModule}.${arg2}`;
      if (typeof arg3 === "object") options = arg3;
    } else if (typeof arg2 === "object" && arg2 !== null) {
      options = arg2;
    }

    return { targetPerm, options };
  }, []);

  // Main evaluation logic
  const checkPermission = useCallback((
    permOrModule: string, 
    arg2?: any, 
    arg3?: any
  ): AccessEvaluationResult => {
    const { targetPerm, options } = parsePermissionArgs(permOrModule, arg2, arg3);
    const targetProjId = options.projectId || activeProjectId;

    const evalContext: PermissionEvaluationContext = {
      user: {
        id: profile?.id || user?.id || "anonymous",
        name: profile?.full_name || user?.email || "User",
        email: user?.email,
        roles: userRoles,
        primaryRole: rawRole,
        isCompanyAdmin,
        isSystemAdmin,
        department,
        status: (profile?.is_active === false) ? "suspended" : "active",
        assignedProjectIds,
        delegatedLimits
      },
      companyId: activeCompanyId,
      projectId: targetProjId,
      userOverrides: [],
      requestedPermission: targetPerm,
      amount: options.amount,
      currency: options.currency,
      creatorId: options.creatorId
    };

    return evaluateWorkspacePermission({
      authenticated: isAuthenticated, userId: user?.id, member: activeMember,
      entitlement: outletContext?.billingEntitlement,
      entitlementLoading: outletContext?.isBillingEntitlementLoading,
      context: evalContext
    });
  }, [
    parsePermissionArgs,
    isAuthenticated, activeMember, outletContext?.billingEntitlement, outletContext?.isBillingEntitlementLoading,
    activeProjectId, 
    profile?.id, 
    profile?.full_name, 
    profile?.is_active, 
    user?.id, 
    user?.email, 
    userRoles, 
    rawRole, 
    isCompanyAdmin, 
    isSystemAdmin, 
    department, 
    assignedProjectIds, 
    delegatedLimits, 
    activeCompanyId
  ]);

  // Fast boolean check
  const can = useCallback((permOrModule: string, arg2?: any, arg3?: any): boolean => {
    return checkPermission(permOrModule, arg2, arg3).granted;
  }, [checkPermission]);

  // Multi-permission checks
  const canAny = useCallback((permissions: string[], opts?: { projectId?: string; amount?: number }): boolean => {
    return permissions.some(p => can(p, opts));
  }, [can]);

  const canAll = useCallback((permissions: string[], opts?: { projectId?: string; amount?: number }): boolean => {
    return permissions.every(p => can(p, opts));
  }, [can]);

  // Parent heading visibility helper
  const canSee = useCallback((permissionsOrSubmodules: string[]): boolean => {
    return permissionsOrSubmodules.some(p => {
      if (p.includes(".")) return can(p);
      return can(`${p}.view`) || can(`${p}.*`);
    });
  }, [can]);

  // Convenience action helpers
  const canView = useCallback((moduleOrPerm: string, opts?: { projectId?: string }) => {
    if (moduleOrPerm.includes(".")) return can(moduleOrPerm, opts);
    return can(`${moduleOrPerm}.view`, opts);
  }, [can]);

  const canCreate = useCallback((moduleOrPerm: string, opts?: { projectId?: string }) => {
    if (moduleOrPerm.includes(".")) return can(moduleOrPerm, opts);
    return can(`${moduleOrPerm}.create`, opts);
  }, [can]);

  const canEdit = useCallback((moduleOrPerm: string, opts?: { projectId?: string }) => {
    if (moduleOrPerm.includes(".")) return can(moduleOrPerm, opts);
    return can(`${moduleOrPerm}.edit`, opts);
  }, [can]);

  const canDelete = useCallback((moduleOrPerm: string, opts?: { projectId?: string }) => {
    if (moduleOrPerm.includes(".")) return can(moduleOrPerm, opts);
    return can(`${moduleOrPerm}.delete`, opts);
  }, [can]);

  const canApprove = useCallback((
    moduleOrPerm: string, 
    opts?: { amount?: number; currency?: string; projectId?: string; creatorId?: string }
  ) => {
    if (moduleOrPerm.includes(".")) return can(moduleOrPerm, opts);
    return can(`${moduleOrPerm}.approve`, opts);
  }, [can]);

  const canAdmin = useCallback((moduleOrPerm: string, opts?: { projectId?: string }) => {
    if (moduleOrPerm.includes(".")) return can(moduleOrPerm, opts);
    return can(`${moduleOrPerm}.admin`, opts);
  }, [can]);

  const canAccessProject = useCallback((projectId: string): boolean => {
    if (isCompanyAdmin || isSystemAdmin) return true;
    if (!assignedProjectIds || assignedProjectIds.length === 0) return false;
    return assignedProjectIds.includes(projectId);
  }, [isCompanyAdmin, isSystemAdmin, assignedProjectIds]);

  const checkDirectoryLegacy = useCallback((directory: DirectoryKey): boolean => {
    return can(directoryPermission(directory));
  }, [can]);

  const hasRole = useCallback((targetRole: string): boolean => {
    const targetCanon = normalizeRoleId(targetRole);
    return userRoles.some(r => normalizeRoleId(r) === targetCanon || r.toLowerCase() === targetRole.toLowerCase());
  }, [userRoles]);

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    return roles.some(r => hasRole(r));
  }, [hasRole]);

  // Request Access Handler
  const requestAccess = useCallback(async (permission: string, justification: string, projectId?: string): Promise<boolean> => {
    try {
      submitAccessRequest({
        companyId: activeCompanyId,
        projectId: projectId || activeProjectId,
        userId: profile?.id || user?.id || "unknown",
        userName: profile?.full_name || user?.email || "User",
        userRole: rawRole,
        requestedPermission: permission,
        justification
      });
      return true;
    } catch (e) {
      console.error("Failed to submit access request:", e);
      return false;
    }
  }, [activeCompanyId, activeProjectId, profile?.id, profile?.full_name, user?.id, user?.email, rawRole]);

  return {
    userId: profile?.id || user?.id,
    userName: profile?.full_name || user?.email,
    userRole: rawRole,
    designation,
    isCompanyAdmin,
    isSystemAdmin,
    department,
    activeCompanyId,
    activeProjectId,
    assignedProjectIds,
    userRoles,
    loading,
    isAuthenticated,
    can,
    checkPermission,
    canAny,
    canAll,
    canSee,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canApprove,
    canAdmin,
    canAccessProject,
    canAccessDirectory: checkDirectoryLegacy,
    hasRole,
    hasAnyRole,
    requestAccess
  };
}
