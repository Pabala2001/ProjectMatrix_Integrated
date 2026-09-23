import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase, Profile } from "../lib/supabase";
import { getRoleDefinition } from "../config/roles";
import { Session, User } from "@supabase/supabase-js";

export interface AuthContextType {
  workspace?: any;
  activeCompany: any;
  membership: any;
  role: any;
  permissions: string[];
  accessibleCompanies: any[];
  allMemberships: any[];
  authUser: any;
  status: "loading" | "authenticated" | "unauthenticated" | "identity_error";
  errorDetails: any;
  signIn: (email: string, password: string, rememberEmail?: boolean) => Promise<{success: boolean; error?: string}>;
  signUp: (params: {firstName: string; lastName: string; email: string; password: string; phone?: string}) => Promise<{success: boolean; user?: any; session?: any; error?: string}>;
  refreshIdentity: (preferredCompanyId?: string) => Promise<void>;
  switchActiveCompany: (companyId: string) => Promise<void>;
  clearError: () => void;
  completeOnboarding: (tenant: any, adminUser?: any) => Promise<void>;
  signInWithQrUser: (user: any) => Promise<{success: boolean; error?: string}>;
  setLocalSession: (session: any, profile: any) => void;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isPasswordRecovery: boolean;
  recoverySessionReady: boolean;
  recoveryError: string | null;
  clearRecoveryState: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Recovery state
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [recoverySessionReady, setRecoverySessionReady] = useState<boolean>(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const clearRecoveryState = () => {
    setIsPasswordRecovery(false);
    setRecoverySessionReady(false);
    setRecoveryError(null);
  };

  const fetchProfile = async (userId: string) => {
    try {
      let dbProfile = null;
      let dbError = null;

      // Retry fetching for up to approximately 3 seconds (6 attempts, 500ms delay) if profile is not found yet
      for (let i = 0; i < 6; i++) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (error) {
          dbError = error;
        }

        if (data) {
          dbProfile = data;
          break;
        }

        // Delay before retrying
        if (i < 5) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (!dbProfile) {
        console.warn("User profile not found in database or failed to fetch. Using local fallback state representation:", dbError?.message || dbError);
        
        // Attempt to build a local profile fallback from the Auth user's details without inserting/upserting to DB
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser) {
          const fallbackProfile: Profile = {
            id: userId,
            full_name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
            email: authUser.email || "",
            role: authUser.user_metadata?.role || "Viewer",
            phone: authUser.user_metadata?.phone || null,
            avatar_color: '#F59E0B',
            is_active: true,
            updated_at: new Date().toISOString()
          };
          setProfile(fallbackProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(dbProfile);
      }
    } catch (err: any) {
      console.error("Exception fetching user profile:", err);
      // Construct a generic client fallback in case of exceptions to prevent total white-screens
      if (userId) {
        setProfile({
          id: userId,
          full_name: "User",
          email: "",
          role: "Viewer",
          phone: null,
          avatar_color: '#F59E0B',
          is_active: true
        });
      } else {
        setProfile(null);
      }
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsPasswordRecovery(false);
      setRecoverySessionReady(false);
      setRecoveryError(null);
    } catch (err) {
      console.error("Error during sign out:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get active session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error("Error getting active session:", error);
      }
      if (mounted) {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          fetchProfile(initialSession.user.id).then(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setLoading(false);
        }
      }
    }).catch(() => { if (mounted) setLoading(false); });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        setRecoverySessionReady(!!currentSession);
        setRecoveryError(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
        setRecoverySessionReady(false);
        setRecoveryError(null);
      }
      
      if (currentSession?.user) {
        setLoading(true);
        setTimeout(() => { void fetchProfile(currentSession.user.id).finally(() => { if (mounted) setLoading(false); }); }, 0);
      } else {
        setProfile(null);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  const signIn: AuthContextType["signIn"] = async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      localStorage.removeItem("pm_active_company_id");
      localStorage.removeItem("pm_active_project_id");
      return { success: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Sign in failed." }; }
  };
  const signUp: AuthContextType["signUp"] = async (params) => {
    try {
      const fullName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim(), password: params.password,
        options: { data: { full_name: fullName, role: "Project Manager", phone: params.phone || null } }
      });
      if (error) throw error;
      // Without a session, the confirmation-email/DB trigger flow owns profile creation.
      // Never issue unauthenticated writes or fabricate a session.
      if (data.session && data.user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id, full_name: fullName, email: params.email.trim(), role: "Project Manager",
          phone: params.phone || null, avatar_color: "#F59E0B", is_active: true, updated_at: new Date().toISOString()
        }, { onConflict: "id" });
        if (profileError) throw profileError;
        await fetchProfile(data.user.id);
      }
      return { success: true, user: data.user, session: data.session };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Account creation failed." }; }
  };
  const value: AuthContextType = {
    activeCompany: null, membership: null, role: null, permissions: [], accessibleCompanies: [], allMemberships: [],
    authUser: user, status: loading ? "loading" : session ? "authenticated" : "unauthenticated", errorDetails: null,
    signIn, signUp, refreshIdentity: refreshProfile, clearError: () => {},
    switchActiveCompany: async () => { throw new Error("Select a company using the workspace company selector."); },
    completeOnboarding: async () => { throw new Error("Complete company setup and trial activation through the onboarding wizard."); },
    signInWithQrUser: async () => ({ success: false, error: "QR sign-in is not connected yet. Please sign in using your email and password." }),
    setLocalSession: () => { throw new Error("A verified Supabase session is required."); },
    session,
    user,
    profile,
    isAuthenticated: !!session,
    loading,
    signOut,
    refreshProfile,
    isPasswordRecovery,
    recoverySessionReady,
    recoveryError,
    clearRecoveryState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/** Adds the original App's verified tenant/billing context to partner components. */
export function WorkspaceAuthBridge({ workspace, children }: { workspace: any; children: ReactNode }) {
  const auth = useAuth();
  const membership = workspace.companyPersonnel?.find((member: any) =>
    member.profile_id === auth.user?.id && member.company_id === workspace.activeCompany?.id && member.is_active === true
  ) || null;
  const role = membership ? getRoleDefinition(membership.designation || membership.role) : null;
  return <AuthContext.Provider value={{ ...auth, workspace, membership, role,
    activeCompany: workspace.activeCompany, permissions: role?.permissions || [],
    accessibleCompanies: workspace.allCompanies || [], allMemberships: membership ? [membership] : [],
    switchActiveCompany: async (id) => {
      const company = workspace.allCompanies?.find((item: any) => item.id === id);
      if (!company) throw new Error("Company access is unavailable.");
      await workspace.onCompanyChange?.(company);
    }
  }}>{children}</AuthContext.Provider>;
}
