import { getOperationalAccess } from "./operationalAccess";
/** Browser-only partner records are isolated by verified user and company. No authentication claims are read here. */
function scopedKey(key: string) {
  const context = getOperationalAccess();
  if (!context?.companyId || !context.userId) return null;
  return `pm_preview:${context.userId}:${context.companyId}:${key}`;
}
function storedKeys() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}
export const previewStorage = {
  getItem(key: string) { const scoped = scopedKey(key); return scoped ? localStorage.getItem(scoped) : null; },
  setItem(key: string, value: string) { const scoped = scopedKey(key); if (!scoped) throw new Error("Select a company before saving preview data."); localStorage.setItem(scoped, value); },
  removeItem(key: string) { const scoped = scopedKey(key); if (scoped) localStorage.removeItem(scoped); },
  key(index: number) { const prefix = scopedKey(""); if (!prefix) return null; return storedKeys().filter(k => k.startsWith(prefix))[index]?.slice(prefix.length) || null; },
  get length() { const prefix = scopedKey(""); return prefix ? storedKeys().filter(k => k.startsWith(prefix)).length : 0; }
};
