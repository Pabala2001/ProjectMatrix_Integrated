import { supabase } from "../lib/supabase";
import { getOperationalAccess } from "./operationalAccess";
/** Same-origin API calls carry the real session and selected company. */
export async function authenticatedFetch(input: string, init: RequestInit = {}) {
  if (!input.startsWith("/api/")) throw new Error("Only application API paths are supported.");
  const {data,error} = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Please sign in to use this feature.");
  const context = getOperationalAccess();
  if (!context?.companyId) throw new Error("Select a company workspace.");
  const headers = new Headers(init.headers);
  headers.set("Authorization",`Bearer ${data.session.access_token}`);
  headers.set("X-Company-Id",context.companyId);
  if (context.projectId) headers.set("X-Project-Id",context.projectId);
  return fetch(input,{...init,headers});
}
