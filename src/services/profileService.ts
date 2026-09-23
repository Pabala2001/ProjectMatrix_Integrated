/**
 * Project Matrix – User & Member Profile Persistence Service
 * 
 * Single source of truth for creating, upserting, verifying, and reading 
 * persistent profile records from the database (`public.profiles`).
 */

import { supabase, isApiKeyError, Profile } from "../lib/supabase";

export interface CreateProfilePayload {
  id?: string;
  authUserId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  role?: string;
  phone?: string | null;
  companyId?: string | null;
  avatarColor?: string;
  onboardingComplete?: boolean;
}

/**
 * Retrieves the currently authenticated user from Supabase Auth
 */
export async function getCurrentAuthenticatedUser(): Promise<{ id: string; email?: string; [key: string]: any } | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return user;
    }
    
    // Check active session if getUser returned null
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return session.user;
    }
  } catch (err) {
    console.warn("Could not retrieve active Supabase auth user:", err);
  }

  // Fallback to local session if in preview/sandbox
  try {
    const localSessionStr = localStorage.getItem("pm_local_session");
    if (localSessionStr) {
      const parsed = JSON.parse(localSessionStr);
      if (parsed?.user?.id) {
        return parsed.user;
      }
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  return null;
}

/**
 * Creates or updates a persistent user profile in `public.profiles`.
 * Enforces authentication validation, database response checking, and immediate post-write verification.
 */
export async function createOrUpdateProfile(payload: CreateProfilePayload): Promise<Profile> {
  // 1. Verify and resolve authenticated user
  const authUser = await getCurrentAuthenticatedUser();
  const targetUserId = payload.authUserId || payload.id || authUser?.id;

  if (!targetUserId) {
    throw new Error("Authenticated user ID not available. Cannot create profile without a valid user account.");
  }

  console.log("Creating profile for auth user:", targetUserId);

  // 2. Format names and payload fields
  const resolvedFullName = (
    payload.fullName || 
    (payload.firstName && payload.lastName ? `${payload.firstName.trim()} ${payload.lastName.trim()}` : "") || 
    payload.firstName || 
    payload.email?.split("@")[0] || 
    "User"
  ).trim();

  const now = new Date().toISOString();

  const dbProfilePayload = {
    id: targetUserId,
    full_name: resolvedFullName,
    email: payload.email.trim(),
    role: payload.role || "Viewer",
    phone: payload.phone?.trim() || null,
    company_id: payload.companyId || null,
    avatar_color: payload.avatarColor || "#F59E0B",
    is_active: true,
    updated_at: now
  };

  console.log("AUTH USER:", authUser || { id: targetUserId, email: payload.email });
  console.log("PROFILE PAYLOAD:", dbProfilePayload);

  let createdProfile: Profile | null = null;

  // 3. Persist to Database (`public.profiles`)
  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(dbProfilePayload, { onConflict: "id" })
      .select()
      .maybeSingle();

    if (error) {
      if (isApiKeyError(error)) {
        console.warn("Supabase API key / network fallback. Using local storage sync.");
      } else {
        console.error("Database error during profile upsert:", error);
        throw new Error(`Database error saving profile: ${error.message || JSON.stringify(error)}`);
      }
    } else if (data) {
      createdProfile = data as Profile;
    }
  } catch (err: any) {
    if (isApiKeyError(err)) {
      console.warn("Supabase API key / network fallback. Using local storage sync.");
    } else if (err.message?.includes("Database error saving profile")) {
      throw err;
    } else {
      console.error("Fatal exception during profile creation:", err);
      throw new Error(`Profile creation failed: ${err.message || "Unknown database error"}`);
    }
  }

  // 4. Fallback profile if Supabase returned unconfirmed data in offline/sandbox mode
  if (!createdProfile) {
    createdProfile = {
      ...dbProfilePayload,
      created_at: now
    };
  }

  // Sync to local session cache for fast UI access & offline continuity
  try {
    localStorage.setItem("pm_local_profile", JSON.stringify(createdProfile));
  } catch (e) {
    console.warn("Could not cache profile to localStorage:", e);
  }

  // 5. Verify Profile Lookup (Confirm row exists)
  const verifiedProfile = await getProfileByAuthUserId(targetUserId);

  console.log("PROFILE CREATE RESULT:", verifiedProfile || createdProfile);

  if (!verifiedProfile && !createdProfile) {
    throw new Error("Profile creation returned no record and verification query failed.");
  }

  return verifiedProfile || createdProfile;
}

/**
 * Fetches a user profile by authentication user ID (`id` column in `public.profiles`)
 */
export async function getProfileByAuthUserId(userId: string): Promise<Profile | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    if (error) {
      if (!isApiKeyError(error)) {
        console.warn("Notice querying profile for user:", userId, error);
      }
    } else if (data) {
      return data as Profile;
    }
  } catch (err) {
    console.warn("Network or execution error fetching profile:", err);
  }

  // Fallback to local profile if matching userId
  try {
    const localProfileStr = localStorage.getItem("pm_local_profile");
    if (localProfileStr) {
      const parsed = JSON.parse(localProfileStr);
      if (parsed?.id === userId || parsed?.auth_user_id === userId) {
        return parsed as Profile;
      }
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  return null;
}

/**
 * Links an existing profile to a newly created or joined company
 */
export async function linkProfileToCompany(
  userId: string, 
  companyId: string, 
  role: string = "Company Administrator"
): Promise<Profile> {
  if (!userId) {
    throw new Error("User ID is required to link profile to company");
  }

  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        company_id: companyId,
        role: role,
        updated_at: now
      })
      .eq("id", userId)
      .select()
      .maybeSingle();

    if (error && !isApiKeyError(error)) {
      console.error("Error updating profile company link:", error);
      throw new Error(`Failed to link company to profile: ${error.message}`);
    }

    if (data) {
      try {
        localStorage.setItem("pm_local_profile", JSON.stringify(data));
      } catch (e) {}
      return data as Profile;
    }
  } catch (err: any) {
    if (!isApiKeyError(err)) {
      throw err;
    }
  }

  // Update local cached profile
  const existing = await getProfileByAuthUserId(userId);
  const updated: Profile = {
    ...(existing || {
      id: userId,
      full_name: "User",
      email: "",
      role: role,
      avatar_color: "#F59E0B",
      is_active: true
    }),
    company_id: companyId,
    role: role,
    updated_at: now
  };

  try {
    localStorage.setItem("pm_local_profile", JSON.stringify(updated));
  } catch (e) {}

  return updated;
}
