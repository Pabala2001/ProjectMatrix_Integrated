import { canUserAccessBilling, BillingAccessMember } from "../config/accessControl";

/**
 * Checks whether an error is explicitly a billing read-only or SQLSTATE PM001 error.
 * Does NOT classify generic permission errors (e.g. 42501, Access Denied) as billing failures.
 */
export function isBillingReadOnlyError(err: unknown): boolean {
  if (!err) return false;

  const errObj = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;
  const code = errObj && typeof errObj.code === "string" ? errObj.code : "";
  const msg =
    err instanceof Error
      ? err.message
      : errObj && typeof errObj.message === "string"
      ? errObj.message
      : typeof err === "string"
      ? err
      : "";

  return (
    code === "PM001" ||
    code === "BILLING_READ_ONLY" ||
    msg.includes("PM001") ||
    msg.includes("BILLING_READ_ONLY") ||
    msg.includes("read-only mode") ||
    msg.includes("Operational writes are disabled")
  );
}

/**
 * Typed error helper replacing catch (...: any)
 * Maps SQLSTATE PM001 and BILLING_READ_ONLY codes to standard user message,
 * directing users without billing access to contact their administrator.
 */
export function getErrorMessage(err: unknown, userCanManageBilling?: boolean): string {
  if (!err) return "An unexpected error occurred.";

  if (isBillingReadOnlyError(err)) {
    if (userCanManageBilling === false) {
      return "Your company is in read-only mode. Please contact an authorized company administrator or financial controller to update billing.";
    }
    return "Your company is in read-only mode. Update billing to continue.";
  }

  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;

  const errObj = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;
  if (errObj && typeof errObj.message === "string") {
    return errObj.message;
  }

  return "An unexpected error occurred.";
}

/**
 * Normalizes database interval into display labels without 'monthlyly' duplication.
 */
export function formatBillingIntervalDisplay(interval: string) {
  const normalized = (interval || "").toLowerCase().trim();
  if (normalized === "monthly" || normalized === "month") {
    return {
      suffix: "/ month",
      billedText: "Billed monthly",
      renewalNotice: "Renews monthly on the scheduled billing date unless auto-renewal is disabled"
    };
  }
  if (normalized === "yearly" || normalized === "annual" || normalized === "year") {
    return {
      suffix: "/ year",
      billedText: "Billed annually",
      renewalNotice: "Renews annually on the scheduled billing date unless auto-renewal is disabled"
    };
  }
  return {
    suffix: `/ ${normalized}`,
    billedText: `Billed ${normalized}`,
    renewalNotice: `Renews ${normalized} on the scheduled billing date unless auto-renewal is disabled`
  };
}

export interface CanPerformOperationalWriteParams {
  canWrite?: boolean | null;
  isBillingLoading?: boolean | null;
  hasModulePermission?: boolean | null;
}

/**
 * Evaluates whether an operational write (create, edit, delete, upload, import)
 * is permitted in the frontend.
 * 
 * Rules:
 * 1. Billing entitlement MUST NOT grant permissions the user otherwise lacks.
 *    If hasModulePermission is false, operational write is strictly forbidden.
 * 2. If billing entitlement is loading / unresolved, operational write is forbidden (fail closed).
 * 3. If canWrite is false (read-only, expired, unconfigured, verification error), operational write is forbidden.
 * 4. Grace-period write allowance (where server supplies canWrite=true) is preserved.
 */
export function canPerformOperationalWrite({
  canWrite = false,
  isBillingLoading = false,
  hasModulePermission = true
}: CanPerformOperationalWriteParams): boolean {
  if (hasModulePermission === false) return false;
  if (isBillingLoading === true) return false;
  return Boolean(canWrite);
}

export interface OperationalWriteNoticeParams {
  canWrite?: boolean | null;
  isBillingLoading?: boolean | null;
  hasModulePermission?: boolean | null;
  companyPersonnel?: BillingAccessMember[] | null;
  activeCompanyId?: string | null;
  profileId?: string | null;
  actionLabel?: string;
  customPermissionDeniedMessage?: string;
}

export interface OperationalWriteNotice {
  isAllowed: boolean;
  reason: "permission" | "loading" | "billing_read_only" | null;
  message: string;
  tooltip: string;
  canManageBilling: boolean;
}

/**
 * Returns a user-facing explanation for disabled operational actions and tooltips.
 * Users without Billing access receive instructions to contact an authorized administrator.
 */
export function getOperationalWriteNotice({
  canWrite = false,
  isBillingLoading = false,
  hasModulePermission = true,
  companyPersonnel,
  activeCompanyId,
  profileId,
  actionLabel,
  customPermissionDeniedMessage
}: OperationalWriteNoticeParams): OperationalWriteNotice {
  // 1. Role-based permission check first
  if (hasModulePermission === false) {
    const msg = customPermissionDeniedMessage || "Access Denied: Your assigned role does not have permission to perform this action.";
    return {
      isAllowed: false,
      reason: "permission",
      message: msg,
      tooltip: msg,
      canManageBilling: false
    };
  }

  // 2. Billing loading / unresolved check
  if (isBillingLoading === true) {
    return {
      isAllowed: false,
      reason: "loading",
      message: "Verifying subscription entitlement. Please wait...",
      tooltip: "Verifying subscription entitlement. Please wait...",
      canManageBilling: false
    };
  }

  // 3. Billing write entitlement check (read-only mode)
  if (!canWrite) {
    const userCanManage = canUserAccessBilling(companyPersonnel, activeCompanyId, profileId);
    if (userCanManage) {
      return {
        isAllowed: false,
        reason: "billing_read_only",
        message: "Your company is in read-only mode. Update your subscription in Billing to enable modifications.",
        tooltip: "Operational writes are disabled in read-only mode. Update billing to continue.",
        canManageBilling: true
      };
    } else {
      return {
        isAllowed: false,
        reason: "billing_read_only",
        message: "Your company is in read-only mode. Please contact an authorized company administrator or financial controller to update billing.",
        tooltip: "Your company is in read-only mode. Contact an administrator to restore write access.",
        canManageBilling: false
      };
    }
  }

  // 4. Allowed
  return {
    isAllowed: true,
    reason: null,
    message: "",
    tooltip: actionLabel ? `${actionLabel}` : "",
    canManageBilling: true
  };
}

/**
 * Mutation handler guard that intercepts submissions BEFORE network requests are dispatched.
 * Handles keyboard shortcuts (e.g. Enter key) and pre-opened modal/drawer forms.
 */
export function guardOperationalWriteMutation(
  params: OperationalWriteNoticeParams & {
    setErrorMsg?: ((msg: string | null) => void) | null;
  }
): boolean {
  const notice = getOperationalWriteNotice(params);
  if (!notice.isAllowed) {
    if (params.setErrorMsg) {
      params.setErrorMsg(notice.message);
    }
    return false;
  }
  return true;
}

