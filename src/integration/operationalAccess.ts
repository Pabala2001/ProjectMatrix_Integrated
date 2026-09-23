import { sourcePermission } from "./routePolicy";
export type OperationalAction = "create" | "edit" | "delete" | "approve" | "export" | "write";
export interface OperationalAccessState {
  companyId: string; projectId?: string; userId: string;
  canWrite: boolean; canExport: boolean; routePermission: string;
  permits: (permission: string) => boolean;
}
let access: OperationalAccessState | null = null;
export function setOperationalAccess(value: OperationalAccessState | null) { access = value; }
export function getOperationalAccess() { return access; }
export class OperationalAccessError extends Error {
  code = "BILLING_READ_ONLY";
  constructor(message: string) { super(message); this.name = "OperationalAccessError"; }
}
/** Called before service mutations and user actions, including browser-preview writes. */
export function assertOperationalAction(action: OperationalAction = "write", source = "") {
  if (!access?.companyId || !access.userId) throw new OperationalAccessError("Select an authenticated company workspace before changing records.");
  if (action === "export" ? !access.canExport : !access.canWrite) {
    throw new OperationalAccessError("Your company is in read-only mode or its billing status is being verified. Update billing before changing records.");
  }
  const module = sourcePermission(source, access.routePermission);
  const allowed = action === "write"
    ? ["create", "edit"].some(a => access!.permits(`${module}.${a}`))
    : access.permits(`${module}.${action}`);
  if (!allowed) throw new OperationalAccessError("Your company role does not permit this action.");
}
