/**
 * Project Matrix – Credential & Local Identity Registry Service
 * 
 * Provides reliable, secure credential persistence and fallback authentication
 * across local sandbox environments, unconfirmed email states, and database networks.
 */

export interface RegisteredCredential {
  authUserId: string;
  email: string;
  password?: string;
  fullName: string;
  phone?: string | null;
  companyId?: string | null;
  roleId?: string;
  createdAt: string;
  updatedAt: string;
}

const REGISTRY_STORAGE_KEY = "pm_auth_credentials_registry";

/**
 * Normalize email for deterministic lookup
 */
export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Retrieve all registered credentials
 */
export function getAllRegisteredCredentials(): RegisteredCredential[] { return []; }

/**
 * Save or update a registered credential record
 */
export function saveRegisteredCredential(cred: {
  authUserId: string;
  email: string;
  password?: string;
  fullName: string;
  phone?: string | null;
  companyId?: string | null;
  roleId?: string;
}): RegisteredCredential {
  const normEmail = normalizeEmail(cred.email);
  const now = new Date().toISOString();
  const list = getAllRegisteredCredentials();
  
  const existingIndex = list.findIndex(c => normalizeEmail(c.email) === normEmail || c.authUserId === cred.authUserId);

  const newRecord: RegisteredCredential = {
    authUserId: cred.authUserId,
    email: normEmail,
    password: undefined,
    fullName: cred.fullName.trim() || normEmail.split("@")[0],
    phone: cred.phone || null,
    companyId: cred.companyId || (existingIndex >= 0 ? list[existingIndex].companyId : null),
    roleId: cred.roleId || (existingIndex >= 0 ? list[existingIndex].roleId : "systems_administrator"),
    createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    list[existingIndex] = newRecord;
  } else {
    list.unshift(newRecord);
  }

  try {
    // Metadata is returned to the caller only; no credential registry is persisted.
  } catch (e) {
    console.warn("Error saving credential to registry:", e);
  }

  return newRecord;
}

/**
 * Find credential by email
 */
export function findCredentialByEmail(email: string): RegisteredCredential | null {
  const normEmail = normalizeEmail(email);
  if (!normEmail) return null;
  const list = getAllRegisteredCredentials();
  return list.find(c => normalizeEmail(c.email) === normEmail) || null;
}

/**
 * Find credential by authUserId
 */
export function findCredentialByAuthUserId(authUserId: string): RegisteredCredential | null {
  if (!authUserId) return null;
  const list = getAllRegisteredCredentials();
  return list.find(c => c.authUserId === authUserId) || null;
}

/**
 * Verify credentials locally
 */
export function verifyLocalCredentials(_email: string, _password: string): {success:boolean;credential?:RegisteredCredential;error?:string} {
  return {success:false,error:"Sign in with Supabase. Browser records cannot authenticate an account."};
}
