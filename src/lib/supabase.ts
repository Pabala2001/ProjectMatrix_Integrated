import { createClient } from "@supabase/supabase-js";

// Every build must select its own Supabase project explicitly.
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL?.trim();
const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY?.trim();
export const SUPABASE_CONFIGURED = !!envUrl && !!envAnonKey;
export const SUPABASE_URL = envUrl || "https://supabase.invalid";
export const SUPABASE_ANON_KEY = envAnonKey || "unconfigured-public-key";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED ? {} : {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: async () => { throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild."); } },
});

/**
 * Interface representing the profile record in `public.profiles`
 */
export interface Profile {
  [key: string]: any;
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone?: string | null;
  company_id?: string | null;
  avatar_color?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Compatibility classifier; callers must never use errors to create authenticated sessions. */
export function isApiKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String((error as any)?.message || error || "");
  return /invalid api key|not configured|failed to fetch|networkerror/i.test(message);
}
