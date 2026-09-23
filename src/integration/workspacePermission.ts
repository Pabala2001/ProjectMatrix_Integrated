import { canAccessBilling, type BillingAccessMember } from "../config/accessControl";
import { evaluateEnterpriseAccess, type AccessEvaluationResult, type PermissionEvaluationContext } from "../services/permissionService";
import type { CompanyBillingEntitlement } from "../types";

/** The verified primary workspace is authoritative; partner role labels only refine operational access. */
export function evaluateWorkspacePermission(input: {
  authenticated: boolean;
  userId?: string;
  member?: BillingAccessMember | null;
  entitlement?: CompanyBillingEntitlement | null;
  entitlementLoading?: boolean;
  context: PermissionEvaluationContext;
}): AccessEvaluationResult {
  const { authenticated, userId, member, entitlement, entitlementLoading, context } = input;
  const deny = (reason: string): AccessEvaluationResult => ({ granted: false, reason,
    evaluationPath: { authenticated, activeUser: false, projectScoped: false,
      segregationOfDutiesPassed: false, monetaryLimitPassed: false } });
  if (!authenticated || !userId || !context.companyId || member?.profile_id !== userId ||
      member?.company_id !== context.companyId || member?.is_active !== true || context.user.status !== "active") {
    return deny("An active membership in this company is required.");
  }
  const verified = entitlement?.company_id === context.companyId;
  const permission = context.requestedPermission;
  // Keep recovery accessible while entitlement is loading or expired. Never widen billing via partner admin roles.
  if (permission.startsWith("billing.")) {
    const granted = canAccessBilling({ member, activeCompanyId: context.companyId, profileId: userId }) &&
      (!verified || entitlement?.can_access_billing !== false);
    return { ...deny("Billing access is restricted to authorised company members."), granted };
  }
  if (permission === "settings.view") {
    return { ...deny("Settings access is unavailable."), granted: !verified || entitlement?.can_access_settings !== false };
  }
  if (!verified || entitlementLoading) return deny("Company subscription access is being verified.");
  const action = permission.split(".").pop();
  if (action === "view" && !entitlement.can_read) return deny("Company data access is unavailable.");
  if (action === "export" && !entitlement.can_export) return deny("Export is unavailable for this company.");
  if (["create", "edit", "delete", "approve", "admin"].includes(action || "") && entitlement.can_write !== true) {
    return deny("Your company is in read-only mode. Update billing to continue.");
  }
  return evaluateEnterpriseAccess({ ...context, userOverrides: [] });
}
