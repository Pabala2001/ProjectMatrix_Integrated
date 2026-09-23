import { previewStorage } from "../integration/previewStorage";
/**
 * Project Matrix – Audit Logging Service
 * 
 * Provides unified, tamper-evident audit trail storage and reporting
 * for security events, authentication methods, role changes, and system access.
 */

export interface AuditLogEntry {
  id: string;
  event: "QR_CODE_SIGN_IN" | "PASSWORD_SIGN_IN" | "SIGN_OUT" | "REGISTRATION" | "COMPANY_SWITCH" | "PERMISSION_CHECK";
  authUserId: string;
  userEmail: string;
  userName: string;
  companyId?: string | null;
  companyName?: string | null;
  role?: string | null;
  device: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  status: "SUCCESS" | "FAILED" | "DENIED";
  details?: Record<string, any>;
}

const AUDIT_STORAGE_KEY = "pm_security_audit_logs";

/**
 * Get all recorded security audit logs
 */
export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = previewStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not read audit logs:", e);
    return [];
  }
}

/**
 * Record a new security audit log entry
 */
export function recordAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
  const fullEntry: AuditLogEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date().toISOString()
  };

  try {
    const existing = getAuditLogs();
    const updated = [fullEntry, ...existing].slice(0, 500); // keep recent 500 logs
    previewStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not persist audit log:", e);
  }

  return fullEntry;
}
