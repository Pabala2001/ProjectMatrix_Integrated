import { saveCompanyDisplay, withCompanyDisplay } from "./integration/companyDisplay";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ROLE_OPTIONS, LEGACY_ROLE_LABELS, isActiveRole, getRoleLabel } from "./config/roles";
import { 
  Building2, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Phone, 
  Shield, 
  LogOut, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  LockKeyhole,
  Check,
  Play,
  TrendingUp,
  FileText,
  AlertTriangle,
  FileSpreadsheet,
  Coins,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  Briefcase,
  Users,
  Eye,
  EyeOff,
  Settings,
  X,
  Plus,
  Trash2,
  MapPin,
  CreditCard,
  Award,
  RefreshCw
} from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { supabase } from "./lib/supabase";
import ProjectMatrixLogo from "./components/ProjectMatrixLogo";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import { hasCapability, canAccessDirectory, DirectoryKey } from "./config/accessControl";
import { CONTRACT_FRAMEWORKS } from "./config/contracts.js";
import { ONBOARDING_BUSINESS_PLAN } from "./config/plans";

// Import Layout & Pages for the new premium Construction ERP application shell
import PageLayout from "./components/layout/PageLayout";
import CommandCentrePage from "./pages/Dashboard/CommandCentrePage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import ReportsPage from "./pages/Reports/ReportsPage";
import SiteDiariesPage from "./pages/SiteDiaries/SiteDiariesPage";
import ProgrammePage from "./pages/Programme/ProgrammePage";
import ProjectMapPage from "./pages/ProjectMap/ProjectMapPage";
import SurveyingPage from "./pages/Surveying/SurveyingPage";
import ProjectAdvisorPage from "./pages/ProjectAdvisor/ProjectAdvisorPage";
import ProjectAdvisorV2Page from "./pages/ProjectAdvisor/ProjectAdvisorV2Page";
import DocumentsPage from "./pages/Documents/DocumentsPage";
import CommunicationPage from "./pages/Communication/CommunicationPage";
import QualityPage from "./pages/Quality/QualityPage";
import ProcurementPage from "./pages/Procurement/ProcurementPage";
import AdministrationPage from "./pages/Administration/AdministrationPage";
import SettingsPage from "./pages/Settings/SettingsPage";
import LabourPayrollPage from "./pages/LabourPayroll/LabourPayrollPage";
import AccountsPage from "./pages/Accounts/AccountsPage";
import HumanResourcesPage from "./pages/HumanResources/HumanResourcesPage";
import LogisticsPage from "./pages/Logistics/LogisticsPage";
import InformationTechnologyPage from "./pages/InformationTechnology/InformationTechnologyPage";
import SecurityPage from "./pages/Security/SecurityPage";
import SubscriptionsPage from "./pages/Billing/SubscriptionsPage";
import PaymentHistoryPage from "./pages/Billing/PaymentHistoryPage";
import PaymentMethodsPage from "./pages/Billing/PaymentMethodsPage";
import { RegionalSettingsProvider } from "./context/RegionalSettingsContext";
import { 
  setPendingOnboardingSelection, 
  clearPendingOnboardingSelection 
} from "./config/plans";
import {
  getActiveBillingPlan,
  startBillingTrial,
  formatTrialDuration,
  getCompanyBillingEntitlement,
  createFallbackReadOnlyEntitlement,
  calculateNextEntitlementDeadlineMs,
  subscribeToBillingRefresh,
  dispatchBillingRefreshEvent,
} from "./services/billingService";
import { BillingPlan, CompanyBillingEntitlement } from "./types";
import { getErrorMessage, formatBillingIntervalDisplay } from "./utils/billingUiHelpers";

import { LanguageProvider } from "./contexts/LanguageContext";
import { SignInPage } from "./components/auth/SignInPage";
import { SignUpPage } from "./components/auth/SignUpPage";
import CompanyOnboardingWizard from "./components/auth/CompanyOnboardingWizard";
import CommandPage from "./pages/Command/CommandPage";
import MyActionsPage from "./pages/Actions/MyActionsPage";
import PortfolioPage from "./pages/Portfolio/PortfolioPage";
import EngineeringPage from "./pages/Engineering/EngineeringPage";
import SiteHubPage from "./pages/Site/SiteHubPage";
import { CommercialPage } from "./pages/Commercial/CommercialPage";
import ResourcesPage from "./pages/Resources/ResourcesPage";
import HSEQHubPage from "./pages/HSEQ/HSEQHubPage";
import ContractsGovernancePage from "./pages/Governance/ContractsGovernancePage";
import RiskIssuesPage from "./pages/Governance/RiskIssuesPage";
import IntelligenceReportsPage from "./pages/Intelligence/IntelligenceReportsPage";
import KnowledgePage from "./pages/Intelligence/KnowledgePage";
export { getErrorMessage, formatBillingIntervalDisplay };

export default function App() {
  const { 
    session, 
    profile, 
    loading: authLoading, 
    signOut,
    refreshProfile,
    isPasswordRecovery,
    recoverySessionReady,
    recoveryError,
    clearRecoveryState
  } = useAuth();

  // Theme state for Night Mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("theme") === "dark" || 
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Navigation / Auth mode views: "landing" | "login" | "register" | "forgot-password" | "reset-password"
  const [currentView, setCurrentView] = useState<"landing" | "login" | "register" | "forgot-password" | "reset-password">("landing");

  // Detect reset password fragment / hash on load or when isPasswordRecovery becomes true
  useEffect(() => {
    const hash = window.location.hash;
    if (
      hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      hash.startsWith("#/reset-password") ||
      hash.includes("reset-password")
    ) {
      setCurrentView("reset-password");
    }
  }, []);

  useEffect(() => {
    if (isPasswordRecovery) {
      setCurrentView("reset-password");
      // Clean token fragment from visible address bar after Supabase established recovery session
      if (
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=recovery") ||
        window.location.hash.includes("error")
      ) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, [isPasswordRecovery]);

  // Local actions loading state
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Form states
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [systemRole, setSystemRole] = useState<string>("Project Manager");
  const [phone, setPhone] = useState<string>("");

  // Forgot password form states
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState<boolean>(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState<boolean>(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);

  // Recovery reset password form states
  const [recoveryNewPassword, setRecoveryNewPassword] = useState<string>("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState<string>("");
  const [recoveryPasswordLoading, setRecoveryPasswordLoading] = useState<boolean>(false);
  const [recoveryPasswordError, setRecoveryPasswordError] = useState<string | null>(null);
  const [recoveryPasswordSuccess, setRecoveryPasswordSuccess] = useState<boolean>(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState<boolean>(false);
  const [showRecoveryConfirmPassword, setShowRecoveryConfirmPassword] = useState<boolean>(false);

  // Feedback notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Landing Page Interactive States
  const [selectedModule, setSelectedModule] = useState<string>("notices");
  const [chartProgressMonth, setChartProgressMonth] = useState<number>(6);
  const [costVarianceRange, setCostVarianceRange] = useState<number>(15); // percentage deviation
  const [selectedDemoVideo, setSelectedDemoVideo] = useState<boolean>(false);

  // --- Tenant Setup & Active Workspace States ---
  const [wizardStep, setWizardStep] = useState<"plan" | "company" | "personnel" | "project" | "members">("plan");
  const [accessibleCompanies, setAccessibleCompanies] = useState<any[]>([]);
  const [activeCompany, setActiveCompany] = useState<any | null>(null);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any | null>(null);
  const [companyPersonnel, setCompanyPersonnel] = useState<any[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<any[]>([]);
  const [isWizardLoading, setIsWizardLoading] = useState<boolean>(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [isOnboardingInProgress, setIsOnboardingInProgress] = useState(false);
  useEffect(() => {
    if (!session?.user.id) { setIsOnboardingInProgress(false); return; }
    try {
      const saved = JSON.parse(localStorage.getItem(`pm_onboarding:${session.user.id}`) || "null");
      if (saved) {
        setIsOnboardingInProgress(true);
        setWizardStep(["plan","company","personnel","project","members"].includes(saved.step) ? saved.step : "company");
        if (saved.companyId && saved.trialReady === true && saved.step === "company") setCreatedCompanyForTrial({id:saved.companyId,name:saved.name || "Your company"});
      }
    } catch { /* No valid resumable draft. */ }
  }, [session?.user.id]);


  // Runtime Billing Plan state for Step 1 Onboarding
  const [activePlan, setActivePlan] = useState<BillingPlan | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState<boolean>(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planReloadKey, setPlanReloadKey] = useState<number>(0);
  const [isStartingTrial, setIsStartingTrial] = useState<boolean>(false);
  const isCreatingCompanyRef = useRef<boolean>(false);
  const isStartingTrialRef = useRef<boolean>(false);
  const [createdCompanyForTrial, setCreatedCompanyForTrial] = useState<{ id: string; name: string } | null>(null);
  const [trialStartError, setTrialStartError] = useState<string | null>(null);

  // Load authenticated active billing plan from public.billing_plans
  useEffect(() => {
    let isCancelled = false;
    setIsPlanLoading(true);
    setPlanError(null);

    getActiveBillingPlan("business-monthly")
      .then((plan) => {
        if (isCancelled) return;
        if (!plan) {
          throw new Error("No active subscription plan configuration found in database.");
        }
        setActivePlan(plan);
        setIsPlanLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        const msg = getErrorMessage(err);
        console.error("Failed to load active billing plan:", msg);
        setActivePlan(null);
        setPlanError(msg || "Failed to load subscription plan configuration.");
        setIsPlanLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [planReloadKey]);

  // Authoritative Billing Entitlement state & synchronized refresh orchestration
  const [billingEntitlement, setBillingEntitlement] = useState<CompanyBillingEntitlement | null>(null);
  const [isBillingEntitlementLoading, setIsBillingEntitlementLoading] = useState<boolean>(false);
  const activeCompanyIdRef = useRef<string | null>(null);
  const entitlementRequestSeqRef = useRef<number>(0);
  const deadlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const periodicRevalidationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep activeCompanyIdRef synchronized immediately
  useEffect(() => {
    activeCompanyIdRef.current = activeCompany?.id ? activeCompany.id.trim() : null;
  }, [activeCompany?.id]);

  const fetchBillingEntitlement = useCallback(
    async (companyId: string, options?: { force?: boolean }) => {
      const trimmedId = (companyId || "").trim();
      if (!trimmedId) {
        setBillingEntitlement(null);
        setIsBillingEntitlementLoading(false);
        return;
      }

      // Generate sequence token to prevent stale responses from overwriting newer company state
      const requestSeq = ++entitlementRequestSeqRef.current;
      setIsBillingEntitlementLoading(true);

      try {
        const entitlement = await getCompanyBillingEntitlement(trimmedId, options);

        // Discard if company switched or another request started
        if (
          activeCompanyIdRef.current === trimmedId &&
          entitlementRequestSeqRef.current === requestSeq
        ) {
          setBillingEntitlement(entitlement);
        }
      } catch (err: unknown) {
        console.error("Failed to load company billing entitlement:", err);
        // Fail closed for operational writes
        if (
          activeCompanyIdRef.current === trimmedId &&
          entitlementRequestSeqRef.current === requestSeq
        ) {
          setBillingEntitlement(
            createFallbackReadOnlyEntitlement(trimmedId, "RPC_FETCH_ERROR")
          );
        }
      } finally {
        if (entitlementRequestSeqRef.current === requestSeq) {
          setIsBillingEntitlementLoading(false);
        }
      }
    },
    []
  );

  // 1. Fetch billing entitlement on active company change, session change, or logout
  useEffect(() => {
    const currentCompanyId = activeCompany?.id ? activeCompany.id.trim() : null;
    activeCompanyIdRef.current = currentCompanyId;

    // Immediately clear stale entitlement when switching companies or signing out
    setBillingEntitlement(null);

    // Clear existing deadline timer
    if (deadlineTimerRef.current) {
      clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }

    if (currentCompanyId && session?.user?.id) {
      void fetchBillingEntitlement(currentCompanyId, { force: true });
    } else {
      setIsBillingEntitlementLoading(false);
    }
  }, [activeCompany?.id, session?.user?.id, fetchBillingEntitlement]);

  // 2. Schedule revalidation when known trial, paid-period or grace deadline is reached
  useEffect(() => {
    if (deadlineTimerRef.current) {
      clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }

    if (!activeCompany?.id || !billingEntitlement) {
      return;
    }

    const companyId = activeCompany.id.trim();
    const deadlineDelayMs = calculateNextEntitlementDeadlineMs(billingEntitlement);

    // Schedule revalidation if deadline exists within next 24 hours
    if (deadlineDelayMs !== null && deadlineDelayMs > 0 && deadlineDelayMs <= 86400000) {
      deadlineTimerRef.current = setTimeout(() => {
        if (activeCompanyIdRef.current === companyId) {
          void fetchBillingEntitlement(companyId, { force: true });
        }
      }, deadlineDelayMs);
    }

    return () => {
      if (deadlineTimerRef.current) {
        clearTimeout(deadlineTimerRef.current);
        deadlineTimerRef.current = null;
      }
    };
  }, [billingEntitlement, activeCompany?.id, fetchBillingEntitlement]);

  // 3. Bounded periodic background revalidation while active in foreground (every 90 seconds)
  useEffect(() => {
    if (periodicRevalidationTimerRef.current) {
      clearInterval(periodicRevalidationTimerRef.current);
      periodicRevalidationTimerRef.current = null;
    }

    if (!activeCompany?.id || !session?.user?.id) {
      return;
    }

    const companyId = activeCompany.id.trim();

    periodicRevalidationTimerRef.current = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        activeCompanyIdRef.current === companyId
      ) {
        void fetchBillingEntitlement(companyId, { force: false });
      }
    }, 90000);

    return () => {
      if (periodicRevalidationTimerRef.current) {
        clearInterval(periodicRevalidationTimerRef.current);
        periodicRevalidationTimerRef.current = null;
      }
    };
  }, [activeCompany?.id, session?.user?.id, fetchBillingEntitlement]);

  // 4. Tab return: Revalidate entitlement on visibilitychange or window focus
  useEffect(() => {
    const handleTabReturn = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        activeCompanyIdRef.current
      ) {
        void fetchBillingEntitlement(activeCompanyIdRef.current, { force: true });
      }
    };

    const handleWindowFocus = () => {
      if (activeCompanyIdRef.current) {
        void fetchBillingEntitlement(activeCompanyIdRef.current, { force: true });
      }
    };

    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", handleTabReturn);
      window.addEventListener("focus", handleWindowFocus);
    }

    return () => {
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", handleTabReturn);
        window.removeEventListener("focus", handleWindowFocus);
      }
    };
  }, [fetchBillingEntitlement]);

  // 5. Payment return or completion listener & URL callback detection
  useEffect(() => {
    // Listen to custom billing refresh events (e.g. from checkout modals, subscription page)
    const unsubscribe = subscribeToBillingRefresh((eventCompanyId) => {
      const targetCompanyId = eventCompanyId || activeCompanyIdRef.current;
      if (targetCompanyId && targetCompanyId === activeCompanyIdRef.current) {
        void fetchBillingEntitlement(targetCompanyId, { force: true });
      }
    });

    // Check URL search or hash for payment return parameters
    const checkUrlPaymentReturn = () => {
      if (typeof window === "undefined") return;
      const href = window.location.href;
      const hasPaymentIndicator =
        href.includes("reference=") ||
        href.includes("trxref=") ||
        href.includes("payment=success") ||
        href.includes("payment=recovered") ||
        href.includes("checkout=completed") ||
        href.includes("paystack_status=");

      if (hasPaymentIndicator && activeCompanyIdRef.current) {
        void fetchBillingEntitlement(activeCompanyIdRef.current, { force: true });
      }
    };

    checkUrlPaymentReturn();
    window.addEventListener("hashchange", checkUrlPaymentReturn);
    window.addEventListener("popstate", checkUrlPaymentReturn);

    return () => {
      unsubscribe();
      window.removeEventListener("hashchange", checkUrlPaymentReturn);
      window.removeEventListener("popstate", checkUrlPaymentReturn);
    };
  }, [fetchBillingEntitlement]);

  // Custom onboarding and company members state for persistent alignment
  const [onboardingCompany, setOnboardingCompany] = useState<any | null>(null);
  const [companyMembers, setCompanyMembers] = useState<any[]>([]);

  const loadCompanyMembers = async (companyId: string) => {
    try {
      console.log("Querying Supabase company members for company:", companyId);
      const { data, error } = await supabase
        .from("company_members")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      setCompanyMembers(data || []);

      // Keep companyPersonnel in sync
      const mapped = (data || []).map((m: any) => {
        if (m.profile_id === profile?.id) {
          return {
            ...m,
            full_name: profile?.full_name || m.full_name || "User",
            email: profile?.email || m.email || "",
            phone: profile?.phone || m.phone || null,
            role: m.role || m.designation || "General Worker",
            designation: m.designation || m.role || "General Worker"
          };
        }
        return m;
      });
      setCompanyPersonnel(mapped);
      return data || [];
    } catch (err) {
      console.error("Error loading company members:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (activeCompany) {
      setOnboardingCompany(activeCompany);
    }
  }, [activeCompany]);

  useEffect(() => {
    const initPersonnelStep = async () => {
      if (wizardStep === "personnel" && onboardingCompany?.id) {
        await loadCompanyMembers(onboardingCompany.id);
        
        // Fetch any existing projects belonging to onboardingCompany.id (Requirement 1 & 2)
        const { data: projsData } = await supabase
          .from("projects")
          .select("*")
          .eq("company_id", onboardingCompany.id);

        if (projsData) {
          const mapped = projsData.map((p: any) => ({
            ...p,
            code: p.contract_code,
            contract_type: p.contract_agreement_option,
            client: p.client_organization,
            location: p.execution_location,
            value_rate: p.award_value_zar,
            progress_percentage: p.physical_progress,
            project_manager: p.contract_manager
          }));
          setAllProjects(mapped);
        }
      }
    };
    initPersonnelStep();
  }, [wizardStep, onboardingCompany?.id]);
  
  // Create Company Form States
  const [compName, setCompName] = useState<string>("");
  const [compReg, setCompReg] = useState<string>("");
  const [compVat, setCompVat] = useState<string>("");
  const [compAddr, setCompAddr] = useState<string>("");
  const [compEmail, setCompEmail] = useState<string>("");
  const [compPhone, setCompPhone] = useState<string>("");

  // Add Personnel Form States
  const [persName, setPersName] = useState<string>("");
  const [persEmail, setPersEmail] = useState<string>("");
  const [persPhone, setPersPhone] = useState<string>("");
  const [persPassword, setPersPassword] = useState<string>("");
  const [persDesignation, setPersDesignation] = useState<string>("Senior Engineer");
  const [persDepartment, setPersDepartment] = useState<string>("Engineering");
  const [persRole, setPersRole] = useState<string>("Member");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // First-login password change states
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");

  // Create Project Form States
  const [projName, setProjName] = useState<string>("");
  const [projCode, setProjCode] = useState<string>("");
  const [projNum, setProjNum] = useState<string>("");
  const [projType, setProjType] = useState<string>("NEC4");
  const [projManager, setProjManager] = useState<string>("");
  const [projClient, setProjClient] = useState<string>("");
  const [projLocation, setProjLocation] = useState<string>("");
  const [projValue, setProjValue] = useState<string>("");
  const [projProgress, setProjProgress] = useState<string>("0");
  const [projStart, setProjStart] = useState<string>(new Date().toISOString().split("T")[0]);
  const [projEnd, setProjEnd] = useState<string>(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

  // Project Assignment state (assigned profile ids)
  const [assignedPersIDs, setAssignedPersIDs] = useState<string[]>([]);
  const [assignedPersRoles, setAssignedPersRoles] = useState<Record<string, string>>({});

  // Secure multi-tenant workspace initialization
  const initializeWorkspace = async (userId: string, profileCompanyId: string | null | undefined) => {
    setIsWizardLoading(true);
    setErrorMsg(null);
    try {
      console.log("Initializing secure workspace for user:", userId);
      
      // 1. Fetch user's accessible companies through company_members.profile_id = auth.uid()
      const { data: memberRecords, error: memberErr } = await supabase
        .from("company_members")
        .select(`
          company_id,
          is_active,
          companies (
            id,
            name,
            registration_number,
            vat_number,
            address,
            email,
            phone,
            subscription_plan_id,
            billing_status,
            trial_started_at,
            trial_ends_at,
            account_status,
            created_by,
            updated_at
          )
        `)
        .eq("profile_id", userId);

      if (memberErr) {
        console.error("Error loading accessible companies:", memberErr);
      }

      // Any authenticated user with at least one active company_members row is already onboarded
      const activeMembers = (memberRecords || []).filter((rec: any) => rec.is_active === true);
      const isUserOnboarded = activeMembers.length > 0;
      setIsOnboarded(isUserOnboarded);

      const companiesList: any[] = [];
      const seenIds = new Set<string>();

      if (activeMembers && activeMembers.length > 0) {
        activeMembers.forEach((rec: any) => {
          const comp = rec.companies ? withCompanyDisplay(rec.companies,userId) : null;
          if (comp && !seenIds.has(comp.id)) {
            seenIds.add(comp.id);
            companiesList.push(comp);
          }
        });
      }

      // Fallback/Include profile's main company_id if not present
      if (profileCompanyId && !seenIds.has(profileCompanyId)) {
        const { data: compData, error: compErr } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profileCompanyId)
          .maybeSingle();
        if (!compErr && compData) {
          companiesList.push(withCompanyDisplay(compData,userId));
          seenIds.add(compData.id);
        }
      }

      setAccessibleCompanies(companiesList);

      if (companiesList.length === 0) {
        console.warn("No accessible companies found for user.");
        setActiveCompany(null);
        setAllProjects([]);
        setActiveProject(null);
        setCompanyPersonnel([]);
        setProjectAssignments([]);
        setIsWizardLoading(false);
        setIsOnboarded(false);
        return;
      }

      // 2. Validate persisted company ID
      const persistedCompanyId = localStorage.getItem("pm_active_company_id");
      let selectedComp = companiesList.find(c => c.id === persistedCompanyId);

      // If persisted company is invalid or does not match any accessible company, fallback to profile company or first accessible
      if (!selectedComp) {
        if (profileCompanyId && seenIds.has(profileCompanyId)) {
          selectedComp = companiesList.find(c => c.id === profileCompanyId);
        } else {
          selectedComp = companiesList[0];
        }
      }

      // Save validated active company ID to localStorage
      localStorage.setItem("pm_active_company_id", selectedComp.id);
      setActiveCompany(selectedComp);

      // 3. Fetch Projects for the validated company
      const { data: projsData, error: projsErr } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", selectedComp.id);

      let list: any[] = [];
      if (projsErr) {
        console.error("Error fetching projects for company:", projsErr);
      } else {
        list = (projsData || []).map((p: any) => ({
          ...p,
          code: p.contract_code,
          contract_type: p.contract_agreement_option,
          client: p.client_organization,
          location: p.execution_location,
          value_rate: p.award_value_zar,
          progress_percentage: p.physical_progress,
          project_manager: p.contract_manager
        }));
      }

      setAllProjects(list);

      // 4. Validate persisted project ID
      const persistedProjectId = localStorage.getItem("pm_active_project_id");
      let selectedProj = list.find(p => p.id === persistedProjectId);

      // If persisted project is invalid, or belongs to another company, clear it and pick the first project
      if (!selectedProj) {
        if (list.length > 0) {
          selectedProj = list[0];
          localStorage.setItem("pm_active_project_id", selectedProj.id);
        } else {
          selectedProj = null;
          localStorage.removeItem("pm_active_project_id");
        }
      } else {
        localStorage.setItem("pm_active_project_id", selectedProj.id);
      }

      setActiveProject(selectedProj);

      // 5. Fetch Company Members
      const { data: persData, error: persErr } = await supabase
        .from("company_members")
        .select("*")
        .eq("company_id", selectedComp.id);

      if (persErr) {
        console.error("Error fetching company members:", persErr);
        setCompanyPersonnel([]);
      } else {
        const mapped = (persData || []).map((m: any) => {
          if (m.profile_id === userId) {
            return {
              ...m,
              full_name: profile?.full_name || m.full_name || "User",
              email: profile?.email || m.email || "",
              phone: profile?.phone || m.phone || null,
              role: m.role || m.designation || "General Worker",
              designation: m.designation || m.role || "General Worker"
            };
          }
          return m;
        });
        setCompanyPersonnel(mapped);
      }

    } catch (err) {
      console.error("Exception in initializeWorkspace:", err);
    } finally {
      setIsWizardLoading(false);
    }
  };

  const handleCompanyChange = async (company: any) => {
    if (!company) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsWizardLoading(true);
    try {
      console.log("Switching active company to:", company.name);
      localStorage.setItem("pm_active_company_id", company.id);
      setBillingEntitlement(null);
      setActiveCompany(company);

      // 1. Fetch Projects list
      const { data: projsData, error: projsErr } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", company.id);

      let list: any[] = [];
      if (projsErr) {
        console.error("Error fetching projects on company change:", projsErr);
      } else {
        list = (projsData || []).map((p: any) => ({
          ...p,
          code: p.contract_code,
          contract_type: p.contract_agreement_option,
          client: p.client_organization,
          location: p.execution_location,
          value_rate: p.award_value_zar,
          progress_percentage: p.physical_progress,
          project_manager: p.contract_manager
        }));
      }

      setAllProjects(list);

      // Verify that selectedProject.company_id equals selectedCompany.id; if not, immediately clear and remove stale localStorage values
      let selectedProj = null;
      if (list.length > 0) {
        selectedProj = list[0];
        localStorage.setItem("pm_active_project_id", selectedProj.id);
      } else {
        localStorage.removeItem("pm_active_project_id");
      }
      setActiveProject(selectedProj);

      // 2. Fetch Company Members / Personnel (company_members table)
      const { data: persData, error: persErr } = await supabase
        .from("company_members")
        .select("*")
        .eq("company_id", company.id);

      if (persErr) {
        console.error("Error fetching company members on company change:", persErr);
        setCompanyPersonnel([]);
      } else {
        const mapped = (persData || []).map((m: any) => {
          if (m.profile_id === profile?.id) {
            return {
              ...m,
              full_name: profile?.full_name || m.full_name || "User",
              email: profile?.email || m.email || "",
              phone: profile?.phone || m.phone || null,
              role: m.role || m.designation || "General Worker",
              designation: m.designation || m.role || "General Worker"
            };
          }
          return m;
        });
        setCompanyPersonnel(mapped);
      }

    } catch (err) {
      console.error("Exception changing company:", err);
    } finally {
      setIsWizardLoading(false);
    }
  };

  // Legacy fallback for refetching
  const fetchTenantData = async (companyId: string) => {
    if (profile?.id) {
      await initializeWorkspace(profile.id, companyId);
    }
  };

  // Fetch project members for active project
  const fetchProjectMembers = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId);

      if (error) {
        console.error("Project assignments could not be loaded:", error.message);
        setProjectAssignments([]);
      } else {
        setProjectAssignments((data || []).map((member: any) => ({...member, role:member.project_role || member.role})));
      }
    } catch (err) {
      console.error("Exception in fetchProjectMembers:", err);
      setProjectAssignments([]);
    }
  };

  useEffect(() => {
    if (session && profile?.id && !isPasswordRecovery) {
      initializeWorkspace(profile.id, profile.company_id);
    } else if (!session) {
      localStorage.removeItem("pm_active_company_id");
      localStorage.removeItem("pm_active_project_id");
      setActiveCompany(null);
      setAccessibleCompanies([]);
      setAllProjects([]);
      setActiveProject(null);
      setCompanyPersonnel([]);
      setProjectAssignments([]);
    }
  }, [session, profile?.id, profile?.company_id, isPasswordRecovery]);

  useEffect(() => {
    if (activeProject?.id) {
      fetchProjectMembers(activeProject.id);
    } else {
      setProjectAssignments([]);
    }
  }, [activeProject?.id]);

  // System roles for contract administration
  const roles = ROLE_OPTIONS.map(opt => opt.label);

  // Helper function to scroll to pricing
  const scrollToPricing = () => {
    setCurrentView("landing");
    setTimeout(() => {
      const element = document.getElementById("pricing-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  // --- Handlers for Core Tenant Setup Wizard ---

  const executeTrialStart = async (companyId: string): Promise<boolean> => {
    if (isStartingTrialRef.current) {
      return false;
    }
    isStartingTrialRef.current = true;
    setIsStartingTrial(true);
    setTrialStartError(null);
    setErrorMsg(null);

    try {
      const subscription = await startBillingTrial(companyId, "business-monthly");
      console.log("Subscription trial successfully initialized via start_billing_trial RPC:", subscription.id);

      // Only after RPC succeeds: clear pending selection & retry state, advance to personnel
      clearPendingOnboardingSelection();
      setCreatedCompanyForTrial(null);
      setTrialStartError(null);
      setSuccessMsg("Subscription trial successfully started!");
      setWizardStep("personnel");
      localStorage.setItem(`pm_onboarding:${session!.user.id}`, JSON.stringify({companyId, step:"personnel"}));
      return true;
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      console.error("startBillingTrial RPC encountered an error during onboarding:", msg);
      setTrialStartError(`Trial Initialization Error: ${msg}`);
      setErrorMsg(`Failed to start subscription trial: ${msg}`);
      return false;
    } finally {
      isStartingTrialRef.current = false;
      setIsStartingTrial(false);
    }
  };

  const handleRetryTrialStart = async () => {
    if (!createdCompanyForTrial?.id) {
      setErrorMsg("No company profile found to initialize trial.");
      return;
    }
    await executeTrialStart(createdCompanyForTrial.id);
  };

  const handleStartTrial = () => {
    if (isStartingTrial || isPlanLoading || !activePlan) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setTrialStartError(null);
    setPendingOnboardingSelection("business-monthly");
    setIsOnboardingInProgress(true);
    localStorage.setItem(`pm_onboarding:${session!.user.id}`, JSON.stringify({ step: "company" }));
    setWizardStep("company");
  };

  const handleCreateCompany = async (e: React.FormEvent, details?: any): Promise<boolean> => {
    const companyName = details?.legal_name || compName;
    const companyRegistration = details?.registration_number || compReg;
    const companyVat = details?.vat_number || compVat;
    const companyAddress = details ? [details.registered_address?.address_line_1,details.registered_address?.address_line_2,details.registered_address?.city,details.registered_address?.state_province_region,details.registered_address?.postal_code,details.registered_address?.country].filter(Boolean).join(", ") : compAddr;
    const companyEmail = details?.email || compEmail;
    const companyPhone = details?.phone || compPhone;
    e.preventDefault();
    if (isCreatingCompanyRef.current || isStartingTrialRef.current) {
      return false;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setTrialStartError(null);

    if (!profile?.id) {
      setErrorMsg("You must be authenticated with a valid user profile to establish a company.");
      return false;
    }

    if (!companyName.trim()) {
      setErrorMsg("Company name is required.");
      return false;
    }

    isCreatingCompanyRef.current = true;
    setIsActionLoading(true);

    setIsOnboardingInProgress(true);
    const checkpointKey = `pm_onboarding:${profile.id}`;
    let checkpoint: any = {};
    try { checkpoint = JSON.parse(localStorage.getItem(checkpointKey) || "{}") || {}; } catch { /* Start a clean checkpoint. */ }
    const generatedCompanyID = checkpoint.companyId || crypto.randomUUID();
    const creatorMemberID = checkpoint.memberId || crypto.randomUUID();
    localStorage.setItem(checkpointKey, JSON.stringify({companyId:generatedCompanyID, memberId:creatorMemberID, name:companyName.trim(), step:"company"}));
    if (details) saveCompanyDisplay(profile.id,generatedCompanyID,details);

    try {
      // Retrieve the first available subscription plan if the subscription_plans table exists
      let subscriptionPlanId = null;
      try {
        const { data: plans, error: planErr } = await supabase
          .from("subscription_plans")
          .select("id")
          .limit(1);
        if (!planErr && plans && plans.length > 0) {
          subscriptionPlanId = plans[0].id;
        }
      } catch (planException: unknown) {
        console.warn("Could not retrieve subscription plan id from database:", planException);
      }

      const companyPayload = {
        id: generatedCompanyID,
        name: companyName.trim(),
        registration_number: companyRegistration.trim(),
        vat_number: companyVat.trim(),
        address: companyAddress.trim(),
        email: companyEmail.trim(),
        phone: companyPhone.trim(),
        subscription_plan_id: subscriptionPlanId,
        billing_status: "trial",
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        account_status: "active",
        created_by: profile.id,
        updated_at: new Date().toISOString()
      };

      console.log('Companies table payload:', companyPayload);

      const { data: existingCompany, error: existingError } = await supabase.from("companies").select("id").eq("id", generatedCompanyID).maybeSingle();
      if (existingError) throw existingError;
      const { error: compError } = existingCompany ? { error: null } : await supabase.from("companies").insert(companyPayload);

      if (compError) {
        console.error("Supabase Error establishing company:", compError);
        // If Supabase returns a schema cache or other insertion error, show the exact missing column and stop
        setErrorMsg(`Supabase Error: ${compError.message || JSON.stringify(compError)}`);
        return false;
      }

      // Update creator profile's company ID
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ company_id: generatedCompanyID })
        .eq("id", profile.id);

      if (profileError) {
        setErrorMsg(`Failed to align profile's company association: ${profileError.message}`);
        return false;
      }

      // Add creator inside company members using their registered role
      const creatorMemberPayload = {
        id: creatorMemberID,
        company_id: generatedCompanyID,
        profile_id: profile.id,
        role: profile.role || "Company Admin",
        full_name: profile.full_name || "Company Admin",
        email: profile.email || "admin@company.com",
        phone: profile.phone || null,
        designation: "ceo",
        is_company_admin: true,
        is_active: true,
        department: "Administration",
        login_enabled: true,
        invite_status: "accepted",
        status: "active",
        created_by: profile.id,
        updated_at: new Date().toISOString()
      };

      console.log("Inserting creator as company_member payload:", creatorMemberPayload);

      const { data: existingMember, error: memberLookupError } = await supabase.from("company_members").select("id").eq("company_id", generatedCompanyID).eq("profile_id", profile.id).maybeSingle();
      if (memberLookupError) throw memberLookupError;
      const { error: memberError } = existingMember ? {error:null} : await supabase.from("company_members").insert(creatorMemberPayload);

      if (memberError) {
        console.error("company_members insertion error:", memberError);
        setErrorMsg(`Failed to align creator's company membership record: ${memberError.message}`);
        return false;
      }

      localStorage.setItem(checkpointKey, JSON.stringify({companyId:generatedCompanyID,memberId:creatorMemberID,name:companyName.trim(),step:"company",trialReady:true}));
      // Preserve the created company ID for potential retry
      setCreatedCompanyForTrial({ id: generatedCompanyID, name: companyName.trim() });
      setOnboardingCompany(companyPayload);
      await refreshProfile();

      // Start billing trial atomically via Supabase RPC (Phase 2)
      return await executeTrialStart(generatedCompanyID);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      console.error("Company setup error:", msg);
      setErrorMsg(msg || "An unexpected error occurred during company creation.");
      return false;
    } finally {
      isCreatingCompanyRef.current = false;
      setIsActionLoading(false);
    }
  };

  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    if (!persName.trim() || !persEmail.trim()) {
      setErrorMsg("Full name and email are required.");
      setIsActionLoading(false);
      return;
    }

    if (!persPassword || persPassword.length < 6) {
      setErrorMsg("A temporary password of at least 6 characters is required.");
      setIsActionLoading(false);
      return;
    }

    const companyId = onboardingCompany?.id || profile?.company_id || activeCompany?.id;

    if (!companyId) {
      setErrorMsg("Active company context is required to register personnel.");
      setIsActionLoading(false);
      return;
    }

    if (LEGACY_ROLE_LABELS.includes(persDesignation as any)) {
      setErrorMsg(`The selected role "${persDesignation}" has been retired/legacy and cannot be selected for new personnel.`);
      setIsActionLoading(false);
      return;
    }
    if (!isActiveRole(persDesignation)) {
      setErrorMsg(`The selected role "${persDesignation}" is not a valid active role.`);
      setIsActionLoading(false);
      return;
    }

    // Validate project IDs selection (Requirement 3 & 5)
    if (!selectedProjectIds || !Array.isArray(selectedProjectIds) || selectedProjectIds.length === 0) {
      setErrorMsg("Please assign the member to at least one project.");
      setIsActionLoading(false);
      return;
    }

    // UUID validation (Requirement 5)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const allValidUUIDs = selectedProjectIds.every((id: string) => uuidRegex.test(id));
    if (!allValidUUIDs) {
      setErrorMsg("Validation failed: One or more selected projects have invalid identifiers.");
      setIsActionLoading(false);
      return;
    }

    // Load selected projects company IDs for validation & logging
    const selectedProjects = (allProjects || []).filter((p: any) => selectedProjectIds.includes(p.id));
    const hasExternalProject = selectedProjects.some((p: any) => p.company_id !== companyId);
    if (hasExternalProject || selectedProjects.length !== selectedProjectIds.length) {
      setErrorMsg("Validation failed: One or more selected projects do not belong to the active company.");
      setIsActionLoading(false);
      return;
    }

    // Logging immediately before invocation (Requirement 6)
    console.log("MEMBER CREATION PAYLOAD", {
      company_id: companyId,
      selectedProjectIds: selectedProjectIds,
      project_ids: selectedProjectIds
    });

    try {
      console.log("Invoking create-company-member Edge Function...");
      const { data, error: invokeError } = await supabase.functions.invoke("create-company-member", {
        body: {
          full_name: persName.trim(),
          email: persEmail.trim(),
          phone: persPhone.trim() || null,
          temporary_password: persPassword,
          designation: persDesignation,
          department: persDepartment,
          is_company_admin: persRole === "Company Admin",
          company_id: companyId,
          project_ids: selectedProjectIds
        }
      });

      // Display real error response body from Edge Function (Requirement 12)
      if (invokeError) {
        let errorMessage = "";
        try {
          const errBody = await invokeError.context.json();
          errorMessage = errBody.error || errBody.message || invokeError.message;
        } catch (_) {
          try {
            const textBody = await invokeError.context.text();
            errorMessage = textBody || invokeError.message;
          } catch (__) {
            errorMessage = invokeError.message;
          }
        }
        throw new Error(errorMessage);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      // Refresh using the required loadCompanyMembers(companyId) function first
      try {
        const targetCoId = onboardingCompany?.id || companyId;
        await loadCompanyMembers(targetCoId);

        // Clear the form fields
        setPersName("");
        setPersEmail("");
        setPersPhone("");
        setPersPassword("");
        setSelectedProjectIds([]); // Reset selected projects on success (Requirement 13)

        // Show the success message
        setSuccessMsg(`Personnel "${persName}" successfully registered. They can now login with their email and temporary password.`);
      } catch (refreshErr) {
        console.error("Refresh failed:", refreshErr);
        setErrorMsg("Member was created successfully, but the directory could not be refreshed. Please reload the page.");
      }

      // Still trigger the legacy fallback fetch to keep other global state updated
      await fetchTenantData(companyId);
    } catch (err: any) {
      console.error("Personnel alignment error:", err);
      setErrorMsg(err.message || "Failed to register personnel using the secure gateway.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    if (!projName.trim() || !projCode.trim() || !projNum.trim()) {
      setErrorMsg("Project name, Contract Code, and Contract Number are required.");
      setIsActionLoading(false);
      return;
    }

    const generatedProjectID = crypto.randomUUID();
    const companyId = profile?.company_id || activeCompany?.id;

    if (!companyId) {
      setErrorMsg("Active company context is required to establish a project.");
      setIsActionLoading(false);
      return;
    }

    try {
      const projectPayload = {
        id: generatedProjectID,
        company_id: companyId,
        name: projName.trim(),
        contract_code: projCode.trim(),
        contract_number: projNum.trim(),
        contract_agreement_option: projType,
        contract_manager: projManager.trim() || profile?.full_name || "Manager",
        client_organization: projClient.trim(),
        execution_location: projLocation.trim(),
        award_value_zar: Number(projValue) || 0,
        physical_progress: Number(projProgress) || 0,
        start_date: projStart || null,
        end_date: projEnd || null,
        status: "Active",
        created_by: profile?.id || null,
        updated_at: new Date().toISOString()
      };

      console.log("Creating project with payload:", projectPayload);

      const { error: projErr } = await supabase
        .from("projects")
        .insert(projectPayload);

      if (projErr) {
        console.error("projects insertion error:", projErr);
        setErrorMsg(`Failed to establish project: ${projErr.message || JSON.stringify(projErr)}`);
        setIsActionLoading(false);
        return;
      }

      setSuccessMsg("Project established successfully! Configuring team matrices.");
      
      // Update data state
      await fetchTenantData(companyId);

      const mappedNewProj = {
        ...projectPayload,
        code: projectPayload.contract_code,
        contract_type: projectPayload.contract_agreement_option,
        client: projectPayload.client_organization,
        location: projectPayload.execution_location,
        value_rate: projectPayload.award_value_zar,
        progress_percentage: projectPayload.physical_progress,
        project_manager: projectPayload.contract_manager
      };
      setActiveProject(mappedNewProj);

      // Reset form
      setProjName("");
      setProjCode("");
      setProjNum("");
      setProjValue("");
      setProjProgress("0");

      // Auto-assign the creator
      const creatorMember = companyPersonnel.find(x => x.profile_id === profile?.id || x.id === profile?.id);
      if (creatorMember) {
        setAssignedPersIDs([creatorMember.id]);
        setAssignedPersRoles(prev => ({ ...prev, [creatorMember.id]: creatorMember.role || "Project Manager" }));
      } else if (profile?.id) {
        setAssignedPersIDs([profile.id]);
        setAssignedPersRoles(prev => ({ ...prev, [profile.id]: "Project Manager" }));
      }

      setWizardStep("members");
      if (session?.user.id) { const key = `pm_onboarding:${session.user.id}`; const previous = JSON.parse(localStorage.getItem(key) || "{}"); localStorage.setItem(key,JSON.stringify({...previous,step:"members"})); }
    } catch (err: any) {
      console.error("Project setup error:", err);
      setErrorMsg(err.message || "Failed to setup project in Supabase.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAssignProjectMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    if (!activeProject?.id) {
      setErrorMsg("Project focus is missing.");
      setIsActionLoading(false);
      return;
    }

    const companyId = onboardingCompany?.id || profile?.company_id || activeCompany?.id;

    if (!companyId) {
      setErrorMsg("Active company context is required to finalize onboarding.");
      setIsActionLoading(false);
      return;
    }

    try {
      // Assemble new list with exact database schema columns
      const assignments = assignedPersIDs.map(pid => {
        const p = companyPersonnel.find(x => x.id === pid) || companyMembers.find(x => x.id === pid);
        return {
          project_id: activeProject.id,
          company_member_id: pid,
          project_role: assignedPersRoles[pid] || p?.role || p?.designation || "Member",
          designation: p?.designation || p?.role || null
        };
      });

      console.log("Invoking finalize-onboarding Edge Function with payload:", { company_id: companyId, assignments });

      const { data, error: invokeError } = await supabase.functions.invoke("finalize-onboarding", {
        body: {
          company_id: companyId,
          assignments: assignments
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Failed to invoke finalize-onboarding Edge Function.");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSuccessMsg("Onboarding finalized successfully! Proceeding to the dashboard...");

      clearPendingOnboardingSelection();
      setIsOnboardingInProgress(false);
      localStorage.removeItem(`pm_onboarding:${session!.user.id}`);

      // Set active company to localStorage
      localStorage.setItem("pm_active_company_id", companyId);

      // Re-initialize workspace to refresh memberships and fetch everything
      await initializeWorkspace(profile?.id || session?.user?.id, companyId);

      // Let's retrieve all projects we just loaded (and are set in allProjects)
      const { data: projsData } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", companyId);

      let mappedProjs: any[] = [];
      if (projsData && projsData.length > 0) {
        mappedProjs = projsData.map((p: any) => ({
          ...p,
          code: p.contract_code,
          contract_type: p.contract_agreement_option,
          client: p.client_organization,
          location: p.execution_location,
          value_rate: p.award_value_zar,
          progress_percentage: p.physical_progress,
          project_manager: p.contract_manager
        }));
        setAllProjects(mappedProjs);
        
        // set the first valid project as active
        const firstProj = mappedProjs[0];
        localStorage.setItem("pm_active_project_id", firstProj.id);
        setActiveProject(firstProj);
      }

      // Mark onboarding complete
      setIsOnboarded(true);

      // Navigate to Dashboard or first permitted route using hash
      const activeMember = (companyPersonnel || []).find((p: any) => p.profile_id === (profile?.id || session?.user?.id));
      const userRole = activeMember?.designation || profile?.role;
      
      const getFirstPermittedRoute = (role: string | null | undefined): string => {
        const directories: DirectoryKey[] = [
          "dashboard",
          "programme",
          "dailyReports",
          "siteDiaries",
          "documents",
          "communication",
          "qualityControl",
          "procurement",
          "administration",
          "labourPayroll",
          "settings"
        ];
        for (const dir of directories) {
          if (canAccessDirectory(role, dir)) {
            const pathMap: Record<string, string> = {
              dashboard: "/dashboard",
              programme: "/programme",
              dailyReports: "/reports",
              siteDiaries: "/site-diaries",
              documents: "/documents",
              communication: "/communication",
              qualityControl: "/quality-control",
              procurement: "/procurement",
              administration: "/administration",
              labourPayroll: "/labour-payroll",
              settings: "/settings"
            };
            return pathMap[dir] || `/${dir}`;
          }
        }
        return "/dashboard";
      };

      const destination = getFirstPermittedRoute(userRole);
      window.location.hash = destination;

    } catch (err: any) {
      console.error("Assignment setup error:", err);
      setErrorMsg(err.message || "Failed to commit project personnel assignment.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Dashboard Real-Time Management Controls ---

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project? This will permanently wipe all site diaries, contract events, and assignments associated with this project.")) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    try {
      // 1. Delete associations
      await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId);

      // 2. Delete project row
      const { error: deleteErr } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (deleteErr) throw deleteErr;

      setSuccessMsg("Project deleted successfully.");
      
      // Update lists
      const companyId = profile?.company_id || activeCompany?.id;
      await fetchTenantData(companyId);
    } catch (err: any) {
      console.error("Project deletion error:", err);
      setErrorMsg(err.message || "Failed to delete project.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeletePersonnel = async (personnelId: string) => {
    const activeMember = (companyPersonnel || []).find((p: any) => p.profile_id === profile?.id);
    const isCompanyAdmin = activeMember?.is_company_admin === true;
    if (!isCompanyAdmin) {
      setErrorMsg("Access Denied: Your assigned role does not have permission to remove company personnel.");
      return;
    }
    const member = companyPersonnel.find(p => p.id === personnelId);
    if (member && (member.profile_id === profile?.id || member.id === profile?.id)) {
      alert("Invalid Operation: You cannot delete your own logged-in profile.");
      return;
    }

    if (!confirm("Are you sure you want to remove this personnel profile? Their credentials will be deactivated and project assignments wiped.")) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    try {
      // 1. Wipe assignments (project assignments use company_member_id to link back to company_members)
      await supabase
        .from("project_members")
        .delete()
        .eq("company_member_id", personnelId);

      // 2. Wipe from company_members
      const { error: memberErr } = await supabase
        .from("company_members")
        .delete()
        .eq("id", personnelId);

      if (memberErr) throw memberErr;

      setSuccessMsg("Personnel successfully detached/deleted from company.");
      
      // Update list
      const companyId = onboardingCompany?.id || profile?.company_id || activeCompany?.id;
      await fetchTenantData(companyId);
      if (companyId) {
        try {
          await loadCompanyMembers(companyId);
        } catch (refreshErr) {
          console.warn("Soft refresh failed during delete:", refreshErr);
        }
      }
    } catch (err: any) {
      console.error("Personnel deletion error:", err);
      setErrorMsg(err.message || "Failed to remove personnel profile.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    if (LEGACY_ROLE_LABELS.includes(systemRole as any)) {
      setErrorMsg(`The selected role "${systemRole}" has been retired and cannot be used for registration.`);
      return;
    }
    if (!isActiveRole(systemRole)) {
      setErrorMsg(`The selected role "${systemRole}" is not a valid active role.`);
      return;
    }

    setIsActionLoading(true);

    try {
      // Create user in Supabase auth and pass user metadata so DB trigger can also access it
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: systemRole,
            phone: phone.trim() || null,
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data?.user) {
        // Explicitly create or upsert the profile row in public.profiles.
        // This is the single source of truth for profile creation.
        const profilePayload = {
          id: data.user.id,
          full_name: fullName,
          email: email,
          role: systemRole,
          phone: phone.trim() || null,
          avatar_color: '#F59E0B',
          is_active: true,
          updated_at: new Date().toISOString()
        };

        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" });

        if (profileError) {
          console.error("Profile table upsert failed:", profileError);
          throw profileError;
        }

        if (data.session) {
          setSuccessMsg("Account successfully registered and verified!");
          setCurrentView("landing");
        } else {
          setSuccessMsg("Account created! You can now sign in using your credentials.");
          setCurrentView("login");
          setPassword("");
          setConfirmPassword("");
        }
      }
    } catch (err: any) {
      console.error("Sign up error:", err);
      setErrorMsg(err.message || "An unexpected error occurred during profile registration.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setIsActionLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      if (data.session) {
        localStorage.removeItem("pm_active_company_id");
        localStorage.removeItem("pm_active_project_id");
        setActiveCompany(null);
        setActiveProject(null);
        setSuccessMsg("Successfully authenticated.");
        setCurrentView("landing"); // Return to landing as authorized
      }
    } catch (err: any) {
      console.error("Login exception:", err);
      setErrorMsg(err.message || "Invalid credentials. Please check your email and password.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Forgot Password Request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = forgotPasswordEmail.trim();
    if (!trimmedEmail) {
      setForgotPasswordError("Please enter your email address.");
      return;
    }

    setForgotPasswordError(null);
    setForgotPasswordLoading(true);

    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        if (
          error.status === 429 ||
          error.message?.toLowerCase().includes("rate limit") ||
          error.message?.toLowerCase().includes("too many requests")
        ) {
          setForgotPasswordError("Too many reset requests were made. Please wait a moment and try again.");
        } else {
          setForgotPasswordError("We could not send the reset email right now. Please try again.");
        }
      } else {
        setForgotPasswordSent(true);
      }
    } catch (err: any) {
      setForgotPasswordError("We could not send the reset email right now. Please try again.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Handle Recovery Password Update
  const handleRecoveryPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverySessionReady || !session) {
      setRecoveryPasswordError("Your reset session is invalid or has expired. Please request a new reset link.");
      return;
    }

    setRecoveryPasswordError(null);

    if (!recoveryNewPassword) {
      setRecoveryPasswordError("Please enter a new password.");
      return;
    }

    if (
      recoveryNewPassword.length < 8 ||
      !/[A-Z]/.test(recoveryNewPassword) ||
      !/[a-z]/.test(recoveryNewPassword) ||
      !/[0-9]/.test(recoveryNewPassword)
    ) {
      setRecoveryPasswordError(
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number."
      );
      return;
    }

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setRecoveryPasswordError("Passwords do not match.");
      return;
    }

    setRecoveryPasswordLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: recoveryNewPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // Clear must_change_password requirement if present
      try {
        const { error: rpcError } = await supabase.rpc("clear_must_change_password");
        if (rpcError) {
          await supabase.auth.updateUser({
            data: { must_change_password: false },
          });
        }
      } catch (rpcErr) {
        await supabase.auth.updateUser({
          data: { must_change_password: false },
        });
      }

      setRecoveryNewPassword("");
      setRecoveryConfirmPassword("");
      setRecoveryPasswordSuccess(true);
    } catch (err: any) {
      console.error("Password update error:", err);
      setRecoveryPasswordError("We could not update your password. Please request a new reset link and try again.");
    } finally {
      setRecoveryPasswordLoading(false);
    }
  };

  const handleGoToSignInAfterReset = async () => {
    setRecoveryNewPassword("");
    setRecoveryConfirmPassword("");
    setRecoveryPasswordSuccess(false);
    setRecoveryPasswordError(null);
    clearRecoveryState();
    setErrorMsg(null);
    setSuccessMsg(null);
    setForgotPasswordError(null);
    setForgotPasswordSent(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out after recovery:", err);
    }
    if (window.location.hash.includes("reset-password")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      window.location.hash = "#/";
    }
    setCurrentView("login");
  };

  // First-login password change logic
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      setIsActionLoading(false);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg("Passwords do not match.");
      setIsActionLoading(false);
      return;
    }

    try {
      console.log("Updating Auth user password...");
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      console.log("Calling secure server-side RPC to clear must_change_password flag...");
      try {
        const { error: rpcError } = await supabase.rpc("clear_must_change_password");
        if (rpcError) {
          console.warn("RPC clear_must_change_password failed, trying user metadata fallback:", rpcError);
          // Fallback: clear it via user metadata update
          await supabase.auth.updateUser({
            data: { must_change_password: false },
          });
        }
      } catch (rpcErr) {
        console.warn("RPC clear_must_change_password exception, trying user metadata fallback:", rpcErr);
        await supabase.auth.updateUser({
          data: { must_change_password: false },
        });
      }

      setSuccessMsg("Password successfully changed! Loading application...");
      setNewPassword("");
      setConfirmNewPassword("");
      
      // Refresh the auth profile and session to reflect the updated metadata
      await supabase.auth.refreshSession();
      // Reload page to force full re-evaluation of auth state
      window.location.reload();
    } catch (err: any) {
      console.error("Change password error:", err);
      setErrorMsg(err.message || "Failed to update password. Please try again.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Logout
  const handleSignOut = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsActionLoading(true);

    try {
      localStorage.removeItem("pm_active_company_id");
      localStorage.removeItem("pm_active_project_id");
      setBillingEntitlement(null);
      setActiveCompany(null);
      setActiveProject(null);
      await signOut();
      setCurrentView("landing");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setFullName("");
      setPhone("");
    } catch (err: any) {
      console.error("Logout exception:", err);
      setErrorMsg(err.message || "Failed to terminate session.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Auth/Session establishing spinner
  if (authLoading) {
    return (
      <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-[#060a12] text-slate-100 font-sans">
        <div className="flex flex-col items-center space-y-4 animate-pulse">
          <div className="p-2 bg-amber-500/10 rounded-2xl border border-amber-500/20">
            <div className="w-16 h-16 flex items-center justify-center">
              <Building2 className="w-10 h-10 text-amber-500 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold tracking-wider text-white">ProjectMatrix</h2>
            <p className="text-xs text-slate-400 mt-1">Establishing secure gateway connection...</p>
          </div>
        </div>
      </div>
    );
  }

  const mustChangePassword = !!(session?.user?.user_metadata?.must_change_password);

  if (session && mustChangePassword && !isPasswordRecovery) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-[#060a12] text-slate-100 font-sans p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Change Password</h2>
            <p className="text-xs text-slate-400 mt-2">
              You are logging in with a temporary password and must change it before proceeding.
            </p>
          </div>
          
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-semibold animate-pulse">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs text-center font-semibold">
              {successMsg}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-[#060a12] border border-slate-850 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isActionLoading}
              className="w-full mt-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!session && (currentView === "landing" || currentView === "login" || currentView === "register")) {
    return <LanguageProvider>{currentView === "register"
      ? <SignUpPage onSwitchToSignIn={() => setCurrentView("login")} />
      : <SignInPage initialShowLogin={currentView === "login"} onSwitchToSignUp={() => setCurrentView("register")} onForgotPassword={() => setCurrentView("forgot-password")} />
    }</LanguageProvider>;
  }

  // Render main ERP layout with React Router when session is active and tenant data exists
  if (session && !isPasswordRecovery && activeCompany && !isOnboardingInProgress && !createdCompanyForTrial && !isCreatingCompanyRef.current && !isStartingTrial && (isOnboarded || allProjects.length > 0)) {
    return (
      <LanguageProvider><RegionalSettingsProvider companyId={activeCompany?.id} projectId={activeProject?.id}>
        <HashRouter>
          <Routes>
            <Route 
              element={
                <PageLayout
                  profile={profile}
                  activeCompany={activeCompany}
                  activeProject={activeProject}
                  allProjects={allProjects}
                  allCompanies={accessibleCompanies}
                  onCompanyChange={handleCompanyChange}
                  onProjectChange={(proj) => {
                    if (proj) {
                      localStorage.setItem("pm_active_project_id", proj.id);
                    } else {
                      localStorage.removeItem("pm_active_project_id");
                    }
                    setActiveProject(proj);
                    if (proj) fetchProjectMembers(proj.id);
                  }}
                  onSignOut={handleSignOut}
                  onSettingsClick={() => { window.location.hash = "/settings"; }}
                  companyPersonnel={companyPersonnel}
                  projectAssignments={projectAssignments}
                  allProjectsRaw={allProjects}
                  onRefetchTenant={async () => {
                    const companyId = profile?.company_id || activeCompany?.id;
                    if (companyId) {
                      await fetchTenantData(companyId);
                    }
                  }}
                  loadCompanyMembers={loadCompanyMembers}
                  isActionLoading={isActionLoading}
                  setIsActionLoading={setIsActionLoading}
                  setErrorMsg={setErrorMsg}
                  setSuccessMsg={setSuccessMsg}
                  isDarkMode={isDarkMode}
                  onToggleDarkMode={handleToggleDarkMode}
                  billingEntitlement={billingEntitlement}
                  isBillingEntitlementLoading={isBillingEntitlementLoading}
                  refetchBillingEntitlement={async () => {
                    if (activeCompany?.id) {
                      await fetchBillingEntitlement(activeCompany.id, { force: true });
                    }
                  }}
                />
              }
            >
                <Route path="/" element={<Navigate to="/command" replace />} />
                
                {/* 1. Executive Domain */}
                <Route path="/command" element={<CommandPage />} />
                <Route path="/command-centre" element={<Navigate to="/command" replace />} />
                <Route path="/actions" element={<MyActionsPage />} />
                <Route path="/my-actions" element={<Navigate to="/actions" replace />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/portfolio/map" element={<ProjectMapPage />} />
                <Route path="/project-map" element={<Navigate to="/portfolio" replace />} />

                {/* 2. Projects Domain */}
                <Route path="/projects" element={<DashboardPage />} />
                <Route path="/dashboard" element={<Navigate to="/projects" replace />} />
                <Route path="/controls/programme" element={<ProgrammePage />} />
                <Route path="/controls/progress" element={<ProgrammePage />} />
                <Route path="/controls/forecast" element={<ProgrammePage />} />
                <Route path="/programme" element={<Navigate to="/controls/programme" replace />} />
                
                {/* Engineering Module Hub & Sub-routes */}
                <Route path="/engineering" element={<EngineeringPage />} />
                <Route path="/engineering/rfis" element={<Navigate to="/engineering?tab=queries" replace />} />
                <Route path="/rfis" element={<Navigate to="/engineering?tab=queries" replace />} />
                <Route path="/engineering/submittals" element={<Navigate to="/engineering?tab=submittals" replace />} />
                <Route path="/submittals" element={<Navigate to="/engineering?tab=submittals" replace />} />
                <Route path="/engineering/assurance" element={<Navigate to="/engineering?tab=design" replace />} />
                <Route path="/engineering/change-control" element={<Navigate to="/engineering?tab=changes" replace />} />
                <Route path="/engineering/traceability" element={<Navigate to="/engineering?tab=changes" replace />} />
                <Route path="/engineering/surveying" element={<SurveyingPage />} />
                <Route path="/engineering/drawings" element={<DocumentsPage />} />
                <Route path="/surveying" element={<Navigate to="/engineering/surveying" replace />} />
                <Route path="/site" element={<SiteHubPage />} />
                <Route path="/field/reports" element={<Navigate to="/site?tab=reports" replace />} />
                <Route path="/field/site-diaries" element={<Navigate to="/site?tab=diaries" replace />} />
                <Route path="/field/inspections" element={<Navigate to="/site?tab=inspections" replace />} />
                <Route path="/field/surveying" element={<Navigate to="/engineering/surveying" replace />} />
                <Route path="/reports" element={<ReportsPage />} /><Route path="/reports/:category" element={<ReportsPage />} /><Route path="/reports/:category/:frequency" element={<ReportsPage />} />
                <Route path="/site-diaries" element={<SiteDiariesPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/repository" element={<DocumentsPage />} />
                <Route path="/documents/transmittals" element={<CommunicationPage />} />

                {/* 3. Commercial Domain */}
                <Route path="/commercial" element={<CommercialPage />} />
                <Route path="/commercial/overview" element={<CommercialPage />} />
                <Route path="/commercial/budget-forecast" element={<CommercialPage />} />
                <Route path="/commercial/commitments" element={<CommercialPage />} />
                <Route path="/commercial/actual-costs" element={<CommercialPage />} />
                <Route path="/commercial/client-accounts" element={<CommercialPage />} />
                <Route path="/commercial/supplier-accounts" element={<CommercialPage />} />
                <Route path="/commercial/cash-bank" element={<CommercialPage />} />
                <Route path="/commercial/reports-audit" element={<CommercialPage />} />

                {/* Legacy Commercial aliases mapped to source-driven Commercial workspaces */}
                <Route path="/finance" element={<Navigate to="/commercial/overview" replace />} />
                <Route path="/project-finance" element={<Navigate to="/commercial/overview" replace />} />
                <Route path="/commercial/finance" element={<Navigate to="/commercial/overview" replace />} />
                <Route path="/commercial/boq" element={<Navigate to="/commercial/budget-forecast" replace />} />
                <Route path="/boq" element={<Navigate to="/commercial/budget-forecast" replace />} />
                <Route path="/bill-of-quantities" element={<Navigate to="/commercial/budget-forecast" replace />} />
                <Route path="/commercial/costs" element={<Navigate to="/commercial/actual-costs" replace />} />
                <Route path="/accounts" element={<Navigate to="/commercial/accounts-register" replace />} /><Route path="/commercial/accounts-register" element={<AccountsPage />} />
                <Route path="/commercial/certificates" element={<Navigate to="/commercial/client-accounts" replace />} />
                <Route path="/commercial/cashflow" element={<Navigate to="/commercial/cash-bank" replace />} />
                <Route path="/commercial/procurement" element={<Navigate to="/commercial/commitments" replace />} />
                <Route path="/procurement" element={<Navigate to="/commercial/procurement-register" replace />} /><Route path="/commercial/procurement-register" element={<ProcurementPage />} />
                <Route path="/commercial/logistics" element={<LogisticsPage />} />
                <Route path="/logistics" element={<Navigate to="/commercial/logistics" replace />} />

                {/* 4. Resources Domain */}
                <Route path="/resources" element={<ResourcesPage />} />

                {/* 5. Governance Domain */}
                <Route path="/hseq" element={<HSEQHubPage />} />
                <Route path="/hseq/quality" element={<Navigate to="/hseq?tab=quality" replace />} />
                <Route path="/hseq/quality-control" element={<Navigate to="/hseq?tab=quality" replace />} />
                <Route path="/hseq/safety" element={<Navigate to="/hseq?tab=safety" replace />} />
                <Route path="/hseq/environmental" element={<Navigate to="/hseq?tab=environmental" replace />} />
                <Route path="/hseq/audits" element={<Navigate to="/hseq?tab=audits" replace />} />
                <Route path="/quality-control" element={<Navigate to="/hseq?tab=quality" replace />} />
                <Route path="/governance/contracts" element={<ContractsGovernancePage />} />
                <Route path="/governance/risks" element={<RiskIssuesPage />} />
                <Route path="/governance/administration" element={<Navigate to="/administration" replace />} />

                {/* 6. Intelligence Domain */}
                <Route path="/intelligence/advisor" element={<ProjectAdvisorPage />} />
                <Route path="/intelligence/reports" element={<IntelligenceReportsPage />} />
                <Route path="/intelligence/knowledge" element={<KnowledgePage />} />
                <Route path="/intelligence/analytics" element={<DashboardPage />} />
                <Route path="/intelligence/risks" element={<Navigate to="/governance/risks" replace />} />
                <Route path="/project-advisor" element={<Navigate to="/intelligence/advisor" replace />} />

                {/* Administration Domain */}
                <Route path="/administration" element={<AdministrationPage />} />
                <Route path="/administration/company" element={<AdministrationPage />} />
                <Route 
                  path="/administration/hr" 
                  element={
                    
                      <HumanResourcesPage 
                        activeCompany={activeCompany}
                        activeProject={activeProject}
                        userRole={companyPersonnel.find(m => m.profile_id === profile?.id)?.designation || companyPersonnel.find(m => m.profile_id === profile?.id)?.role}
                        currentUser={profile}
                      />
                    
                  } 
                />
                <Route 
                  path="/human-resources" 
                  element={<Navigate to="/administration/hr" replace />} 
                />
                <Route path="/labour-payroll" element={<Navigate to="/administration/hr?tab=payroll" replace />} />
                <Route path="/employee-payroll" element={<Navigate to="/administration/hr?tab=payroll" replace />} />
                <Route path="/employee-leave" element={<Navigate to="/administration/hr?tab=leave" replace />} />
                <Route path="/administration/communication" element={<CommunicationPage />} />
                <Route path="/communication" element={<Navigate to="/administration/communication" replace />} />
                <Route path="/administration/security" element={<SecurityPage />} />
                <Route path="/security" element={<Navigate to="/administration/security" replace />} />
                <Route path="/information-technology" element={<InformationTechnologyPage />} />

                {/* Settings */}
                <Route path="/settings" element={<SettingsPage />} />
                
                <Route path="*" element={<Navigate to="/command" replace />} />
              <Route path="/project-advisor-2" element={<ProjectAdvisorV2Page />} />
              <Route path="/billing" element={<Navigate to="/billing/subscriptions" replace />} />
              <Route path="/billing/subscriptions" element={<RoleProtectedRoute directory="billing" requireBillingAccess><SubscriptionsPage /></RoleProtectedRoute>} />
              <Route path="/billing/payment-history" element={<RoleProtectedRoute directory="billing" requireBillingAccess><PaymentHistoryPage /></RoleProtectedRoute>} />
              <Route path="/billing/payment-methods" element={<RoleProtectedRoute directory="billing" requireBillingAccess><PaymentMethodsPage /></RoleProtectedRoute>} />
            </Route>
          </Routes>
        </HashRouter>
      </RegionalSettingsProvider></LanguageProvider>
    );
  }


  return (
    <HashRouter>
      <div className="min-h-screen w-screen bg-[#060a12] text-slate-100 font-sans overflow-x-hidden relative">
      
      {/* Dynamic Keyframe animations embedded cleanly */}
      <style>{`
        @keyframes subtleFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes subtleFloatReverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(10px) rotate(-1deg); }
        }
        @keyframes radialSpotlight {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.22; }
        }
        .animate-subtle-float {
          animation: subtleFloat 6s ease-in-out infinite;
        }
        .animate-subtle-float-slow {
          animation: subtleFloat 8s ease-in-out infinite;
        }
        .animate-subtle-float-reverse {
          animation: subtleFloatReverse 7s ease-in-out infinite;
        }
        .animate-spotlight {
          animation: radialSpotlight 15s ease-in-out infinite;
        }
      `}</style>

      {/* Global animated gradient spotlights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-amber-500/10 to-blue-600/5 rounded-full blur-[140px] pointer-events-none animate-spotlight" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-500/5 to-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* ========================================== */}
      {/* HEADER NAVBAR                              */}
      {/* ========================================== */}
      <header className="sticky top-0 z-50 bg-[#060a12]/80 backdrop-blur-xl border-b border-slate-800/60 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Top-left ProjectMatrix premium logo implementation */}
          <div 
            onClick={() => setCurrentView("landing")} 
            className="w-48 sm:w-56 h-10 cursor-pointer hover:opacity-95 transition-opacity"
            id="logo-container"
          >
            <ProjectMatrixLogo />
          </div>

          {/* Navigation links for Landing page */}
          <nav className="hidden lg:flex items-center space-x-8 text-sm font-medium text-slate-300">
            <a 
              href="#features" 
              onClick={(e) => { e.preventDefault(); setCurrentView("landing"); setTimeout(() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }), 100); }}
              className="hover:text-amber-400 transition-colors"
            >
              Features
            </a>
            <a 
              href="#command-centre" 
              onClick={(e) => { e.preventDefault(); setCurrentView("landing"); setTimeout(() => document.getElementById("command-centre")?.scrollIntoView({ behavior: "smooth" }), 100); }}
              className="hover:text-amber-400 transition-colors"
            >
              Command Centre
            </a>
            <a 
              href="#workflow" 
              onClick={(e) => { e.preventDefault(); setCurrentView("landing"); setTimeout(() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" }), 100); }}
              className="hover:text-amber-400 transition-colors"
            >
              Workflow
            </a>
            <a 
              href="#pricing" 
              onClick={(e) => { e.preventDefault(); scrollToPricing(); }}
              className="hover:text-amber-400 transition-colors"
            >
              Pricing
            </a>
            <button 
              onClick={() => setSelectedDemoVideo(true)}
              className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors font-semibold"
            >
              <Play className="w-3.5 h-3.5 fill-amber-400" />
              Watch Demo
            </button>
          </nav>

          {/* Action buttons based on active session */}
          <div className="flex items-center space-x-4">
            {session ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-400">
                  <Shield className="w-3 h-3" />
                  {profile?.role || "Viewer"}
                </span>
                <button
                  onClick={() => setCurrentView("login")} // Go to existing console / profile details
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
                >
                  My Portal
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    setCurrentView("login");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setCurrentView("register");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm rounded-xl transition-all duration-250 shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 cursor-pointer"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ========================================== */}
      {/* NOTIFICATION LAYER                         */}
      {/* ========================================== */}
      <div className="max-w-md mx-auto mt-4 px-4">
        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm flex items-start gap-3 relative animate-fadeIn">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 pr-6">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="absolute top-3 right-3 text-red-400 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-200 text-sm flex items-start gap-3 relative animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 pr-6">{successMsg}</div>
            <button onClick={() => setSuccessMsg(null)} className="absolute top-3 right-3 text-emerald-400 hover:text-emerald-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* VIEW: REGISTER PAGE                        */}
      {/* ========================================== */}
      {currentView === "register" && !session && (
        <main className="max-w-md mx-auto px-4 py-12 relative z-10 animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">Create Account</h2>
              <p className="text-xs text-slate-400 mt-1">Register your profile for ProjectMatrix Ledger</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sipho Nkosi"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="sipho.nkosi@contractor.co.za"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                  System Role
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select
                    value={systemRole}
                    onChange={(e) => setSystemRole(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all appearance-none cursor-pointer"
                  >
                    {Array.from(new Set(ROLE_OPTIONS.map(o => o.group))).map(group => (
                      <optgroup key={group} label={group} className="text-xs uppercase font-bold text-slate-500 bg-slate-950">
                        {ROLE_OPTIONS.filter(o => o.group === group).map(opt => (
                          <option key={opt.value} value={opt.label} className="bg-slate-900 text-slate-100">
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                  Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="tel"
                    placeholder="e.g. +27 82 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                  Password (Min 6 chars)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full mt-6 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isActionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Register Profile
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400">
                Already have an account?{" "}
                <button 
                  onClick={() => setCurrentView("login")}
                  className="text-amber-400 hover:text-amber-300 font-semibold focus:outline-none"
                >
                  Sign In instead
                </button>
              </p>
            </div>
          </div>
        </main>
      )}

      {/* ========================================== */}
      {/* VIEW: LOGIN PAGE                           */}
      {/* ========================================== */}
      {currentView === "login" && !session && (
        <main className="max-w-md mx-auto px-4 py-12 relative z-10 animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">Sign In</h2>
              <p className="text-xs text-slate-400 mt-1">Unlock ProjectMatrix Administration Ledger</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 tracking-wider uppercase mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all"
                  />
                </div>
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setForgotPasswordEmail(email || "");
                      setForgotPasswordError(null);
                      setForgotPasswordSent(false);
                      setCurrentView("forgot-password");
                    }}
                    className="text-xs text-slate-400 hover:text-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-1 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full mt-6 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isActionLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In to Matrix
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400">
                Don't have an account?{" "}
                <button 
                  onClick={() => setCurrentView("register")}
                  className="text-amber-400 hover:text-amber-300 font-semibold focus:outline-none"
                >
                  Create one now
                </button>
              </p>
            </div>
          </div>
        </main>
      )}

      {/* ========================================== */}
      {/* VIEW: FORGOT PASSWORD PAGE                 */}
      {/* ========================================== */}
      {currentView === "forgot-password" && !session && (
        <main className="max-w-md mx-auto px-4 py-12 relative z-10 animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8">
            {forgotPasswordSent ? (
              <div>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white uppercase">Check Your Email</h2>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed" role="status" aria-live="polite">
                    If an account exists for this email address, a password reset link has been sent. Please check your inbox and spam folder.
                  </p>
                </div>

                <div className="mb-6 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
                  <p className="text-xs text-slate-400 font-medium">Sent to:</p>
                  <p className="text-xs text-amber-400 font-semibold break-all mt-0.5">{forgotPasswordEmail}</p>
                </div>

                {forgotPasswordError && (
                  <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{forgotPasswordError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={forgotPasswordLoading}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    {forgotPasswordLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Again</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordError(null);
                      setForgotPasswordSent(false);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setCurrentView("login");
                    }}
                    className="w-full text-center text-xs text-slate-400 hover:text-amber-400 font-semibold py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-black tracking-tight text-white uppercase">Forgot Password?</h2>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Enter the email address associated with your ProjectMatrix account and we’ll send you a secure password reset link.
                  </p>
                </div>

                {forgotPasswordError && (
                  <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{forgotPasswordError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="forgot-password-email" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      id="forgot-password-email"
                      type="email"
                      required
                      autoComplete="email"
                      disabled={forgotPasswordLoading}
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotPasswordLoading || !forgotPasswordEmail.trim()}
                  className="w-full mt-6 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {forgotPasswordLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordError(null);
                      setForgotPasswordSent(false);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setCurrentView("login");
                    }}
                    className="text-xs text-slate-400 hover:text-amber-400 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-1 transition-colors cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>
      )}

      {/* ========================================== */}
      {/* VIEW: RESET PASSWORD STATUS PAGE           */}
      {/* ========================================== */}
      {currentView === "reset-password" && (
        <main className="max-w-md mx-auto px-4 py-12 relative z-10 animate-fadeIn">
          <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8">
            {authLoading ||
            ((window.location.hash.includes("type=recovery") || window.location.hash.includes("access_token")) &&
              !isPasswordRecovery) ||
            (isPasswordRecovery && !recoverySessionReady) ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase">Verifying Reset Link</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed" role="status" aria-live="polite">
                  Please wait while ProjectMatrix verifies your password reset link.
                </p>
              </div>
            ) : isPasswordRecovery && recoverySessionReady && session ? (
              recoveryPasswordSuccess ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white uppercase">Password Updated</h2>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed" role="status" aria-live="polite">
                    Your password has been updated successfully. You can now sign in using your new password.
                  </p>

                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={handleGoToSignInAfterReset}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10"
                    >
                      <span>Go to Sign In</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-400">
                      <LockKeyhole className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-white uppercase">Create New Password</h2>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Choose a strong new password for your ProjectMatrix account.
                    </p>
                  </div>

                  {recoveryPasswordError && (
                    <div
                      role="alert"
                      className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-400 animate-fadeIn"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{recoveryPasswordError}</span>
                    </div>
                  )}

                  <form onSubmit={handleRecoveryPasswordUpdate} className="space-y-4">
                    <div>
                      <label htmlFor="recovery-new-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                        New Password <span className="text-amber-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="recovery-new-password"
                          type={showRecoveryPassword ? "text" : "password"}
                          value={recoveryNewPassword}
                          onChange={(e) => setRecoveryNewPassword(e.target.value)}
                          disabled={recoveryPasswordLoading}
                          required
                          autoComplete="new-password"
                          placeholder="••••••••"
                          aria-describedby="recovery-password-requirements"
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                          disabled={recoveryPasswordLoading}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded cursor-pointer"
                          aria-label={showRecoveryPassword ? "Hide password" : "Show password"}
                        >
                          {showRecoveryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p id="recovery-password-requirements" className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                        Password must be at least 8 characters and include uppercase, lowercase, and a number.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="recovery-confirm-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Confirm New Password <span className="text-amber-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="recovery-confirm-password"
                          type={showRecoveryConfirmPassword ? "text" : "password"}
                          value={recoveryConfirmPassword}
                          onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                          disabled={recoveryPasswordLoading}
                          required
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRecoveryConfirmPassword(!showRecoveryConfirmPassword)}
                          disabled={recoveryPasswordLoading}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded cursor-pointer"
                          aria-label={showRecoveryConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showRecoveryConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={recoveryPasswordLoading || !recoveryNewPassword || !recoveryConfirmPassword}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10"
                    >
                      {recoveryPasswordLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span aria-live="polite">Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <span>Update Password</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase mt-2">Reset Link Invalid</h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed" role="alert">
                  This password reset link is invalid or has expired.
                </p>

                <div className="space-y-3 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      clearRecoveryState();
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setForgotPasswordError(null);
                      setForgotPasswordSent(false);
                      if (window.location.hash.includes("reset-password")) {
                        window.history.replaceState(null, "", window.location.pathname + window.location.search);
                      } else {
                        window.location.hash = "#/";
                      }
                      setCurrentView("forgot-password");
                    }}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10"
                  >
                    <span>Request a New Reset Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      clearRecoveryState();
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setForgotPasswordError(null);
                      setForgotPasswordSent(false);
                      if (window.location.hash.includes("reset-password")) {
                        window.history.replaceState(null, "", window.location.pathname + window.location.search);
                      } else {
                        window.location.hash = "#/";
                      }
                      setCurrentView("login");
                    }}
                    className="w-full text-center text-xs text-slate-400 hover:text-amber-400 font-semibold py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================== */}
      {/* VIEW: LOGGED-IN CONSOLE PORTAL             */}
      {/* ========================================== */}
      {session && !isPasswordRecovery && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 animate-fadeIn">
          {isWizardLoading ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
              <p className="text-sm text-slate-400 mt-4">Syncing secure database...</p>
            </div>
          ) : (activeCompany && !isOnboardingInProgress && (isOnboarded || allProjects.length > 0)) ? (
            /* ========================================== */
            /* WORKSPACE DASHBOARD                        */
            /* ========================================== */
            <div className="space-y-8">
              {/* Header and Context Controls */}
              <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-500" />
                    <h2 className="text-xl font-extrabold text-white tracking-tight uppercase">
                      {activeCompany.name}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      Business Trial (7 Days Left)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Registered ID: <span className="font-mono text-slate-500 select-all">{activeCompany.id}</span>
                  </p>
                </div>

                {/* Project Focus Selector */}
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Project Focus
                    </label>
                    <select
                      value={activeProject?.id || ""}
                      onChange={(e) => {
                        const proj = allProjects.find(p => p.id === e.target.value);
                        if (proj) setActiveProject(proj);
                      }}
                      className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {allProjects.map(p => (
                        <option key={p.id} value={p.id}>
                          [{p.code}] {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Profile mini-card */}
                  <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-850 rounded-xl p-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400">
                      {profile?.full_name?.split(" ").map((n: string) => n[0]).join("") || "U"}
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-white leading-tight">{profile?.full_name}</div>
                      <div className="text-[10px] text-slate-400">{profile?.role}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Setup Operability Notification */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center justify-between gap-3 shadow-lg shadow-emerald-500/5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    <strong>System Operational:</strong> Core company profile setup has been fully established. All server matrices and profile authentications are online.
                  </span>
                </div>
                <span className="font-mono text-[9px] text-emerald-500/60 hidden md:inline">
                   SECURE_GATEWAY_ACTIVE
                </span>
              </div>

              {/* Main content grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Active Project details */}
                <div className="lg:col-span-2 space-y-6">
                  {activeProject ? (
                    <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden">
                      <div className="flex items-start justify-between border-b border-slate-850 pb-5 mb-5">
                        <div>
                          <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md text-[10px] font-mono tracking-wider uppercase">
                            Active Contract
                          </span>
                          <h3 className="text-2xl font-black text-white mt-2 tracking-tight">
                            {activeProject.name}
                          </h3>
                          <div className="flex flex-wrap items-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1 font-medium">
                            <span>Code: <strong className="text-slate-200">{activeProject.code}</strong></span>
                            <span>•</span>
                            <span>Contract #: <strong className="text-slate-200">{activeProject.contract_number || activeProject.contractNumber}</strong></span>
                            <span>•</span>
                            <span>Framework: <strong className="text-amber-400">{activeProject.contract_type || activeProject.contractType}</strong></span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteProject(activeProject.id)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          title="Wipe Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Project
                        </button>
                      </div>

                      {/* Project stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client Organization</div>
                          <div className="text-sm font-bold text-slate-200 mt-1 truncate">{activeProject.client}</div>
                        </div>
                        <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Execution Location</div>
                          <div className="text-sm font-bold text-slate-200 mt-1 truncate flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-blue-400" />
                            {activeProject.location}
                          </div>
                        </div>
                        <div className="p-4 bg-slate-950/60 border border-slate-850 rounded-xl">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Award Value (ZAR)</div>
                          <div className="text-sm font-bold text-emerald-400 mt-1 font-mono">
                            R {(activeProject.value_rate || activeProject.valueRate || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Timeline and progress bar */}
                      <div className="space-y-4 bg-slate-950/40 border border-slate-850 rounded-xl p-5 mb-6">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-semibold uppercase tracking-wider">Physical Progress Metrics</span>
                          <span className="text-amber-400 font-bold font-mono">{activeProject.progress_percentage || activeProject.progressPercentage || 0}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500 rounded-full"
                            style={{ width: `${activeProject.progress_percentage || activeProject.progressPercentage || 0}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-850 text-xs text-slate-400">
                          <div>
                            <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Site Possession Date</span>
                            <span className="font-semibold text-slate-200 mt-0.5 block">{activeProject.start_date || activeProject.startDate}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Contract Completion Date</span>
                            <span className="font-semibold text-slate-200 mt-0.5 block">{activeProject.end_date || activeProject.endDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Team Matrix Assignment List */}
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-850 mb-4">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Project Assignment Matrix</h4>
                          <span className="text-[10px] font-mono text-slate-500">
                            {projectAssignments.length} personnel active on project
                          </span>
                        </div>

                        {projectAssignments.length > 0 ? (
                          <div className="space-y-2.5">
                            {projectAssignments.map(m => {
                              const p = companyPersonnel.find(x => x.id === m.profile_id);
                              return (
                                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-850/80 rounded-xl text-xs">
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                      {p?.full_name?.split(" ").map((n: string) => n[0]).join("") || "P"}
                                    </div>
                                    <div>
                                      <div className="font-bold text-white">{p?.full_name || "Unknown"}</div>
                                      <div className="text-[10px] text-slate-400">{p?.email}</div>
                                    </div>
                                  </div>

                                  <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md text-[10px] font-semibold">
                                    {m.role || "Project Member"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-6 text-center bg-slate-950/40 border border-slate-850/60 border-dashed rounded-xl text-xs text-slate-500">
                            No active assignments on this project yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
                      <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                      <p className="text-sm text-slate-400 mt-4">Restructuring projects...</p>
                    </div>
                  )}

                  {/* Multi-Project Directory */}
                  <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">All Active Projects</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allProjects.map(proj => (
                        <div 
                          key={proj.id} 
                          onClick={() => setActiveProject(proj)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                            activeProject?.id === proj.id 
                              ? "bg-slate-950 border-amber-500/50 shadow-md shadow-amber-500/5" 
                              : "bg-slate-950/40 border-slate-850 hover:border-slate-800"
                          }`}
                        >
                          <div className="text-xs font-mono text-slate-500">[{proj.code}]</div>
                          <div className="font-bold text-white text-sm mt-1">{proj.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{proj.client}</div>
                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-850 text-[10px]">
                            <span className="font-mono text-emerald-400 font-semibold">
                              R {(proj.value_rate || proj.valueRate || 0).toLocaleString()}
                            </span>
                            <span className="text-slate-400">{proj.progress_percentage || proj.progressPercentage || 0}% Progress</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Operations Directory Sidebar */}
                <div className="space-y-6">
                  {/* System Administration Control */}
                  <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 shadow-xl">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Action Centre</h4>
                    
                    {/* Add Personnel Form Inline */}
                    <div className="space-y-4 pb-5 border-b border-slate-850 mb-5">
                      <h5 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-amber-500" />
                        Create Personnel
                      </h5>
                      <form onSubmit={handleAddPersonnel} className="space-y-3">
                        <input
                          type="text"
                          required
                          placeholder="Full Name (e.g. John Doe)"
                          value={persName}
                          onChange={(e) => setPersName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email (e.g. john@matrix.com)"
                          value={persEmail}
                          onChange={(e) => setPersEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={persDesignation}
                            onChange={(e) => setPersDesignation(e.target.value)}
                            className="w-full px-2.5 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 focus:outline-none"
                          >
                            {Array.from(new Set(ROLE_OPTIONS.map(o => o.group))).map(group => (
                              <optgroup key={group} label={group} className="text-xs uppercase font-bold text-slate-500 bg-slate-950">
                                {ROLE_OPTIONS.filter(o => o.group === group).map(opt => (
                                  <option key={opt.value} value={opt.label} className="bg-slate-900 text-slate-100">
                                    {opt.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <select
                            value={persRole}
                            onChange={(e) => setPersRole(e.target.value)}
                            className="w-full px-2.5 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 focus:outline-none"
                          >
                            <option value="Member">Member Role</option>
                            <option value="Company Admin">Admin Role</option>
                            <option value="Viewer">Viewer Role</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={isActionLoading}
                          className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Align Personnel <ArrowRight className="w-3 h-3" /></>}
                        </button>
                      </form>
                    </div>

                    {/* Create New Project Inline */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-blue-400" />
                        Create Project
                      </h5>
                      <form onSubmit={handleCreateProject} className="space-y-3">
                        <input
                          type="text"
                          required
                          placeholder="Project Name"
                          value={projName}
                          onChange={(e) => setProjName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Contract Code"
                            value={projCode}
                            onChange={(e) => setProjCode(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Contract #"
                            value={projNum}
                            onChange={(e) => setProjNum(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Client Organization"
                            value={projClient}
                            onChange={(e) => setProjClient(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                          />
                          <input
                            type="text"
                            required
                            placeholder="Location Location"
                            value={projLocation}
                            onChange={(e) => setProjLocation(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            required
                            placeholder="Award Value (ZAR)"
                            value={projValue}
                            onChange={(e) => setProjValue(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                          />
                          <select
                            value={projType}
                            onChange={(e) => setProjType(e.target.value)}
                            className="w-full px-2 py-2 bg-slate-950/80 border border-slate-850 rounded-lg text-xs text-slate-200 focus:outline-none"
                          >
                            {CONTRACT_FRAMEWORKS.map((framework) => (
                              <option key={framework} value={framework} className="bg-slate-900 text-slate-200">
                                {framework}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={isActionLoading}
                          className="w-full py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Establish Project <ArrowRight className="w-3 h-3" /></>}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Company Directory & Active Members */}
                  <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 shadow-xl">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Company Personnel Directory</h4>
                    <div className="space-y-3">
                      {companyPersonnel.map(p => (
                        <div key={p.id} className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-slate-400">
                              {p.full_name?.split(" ").map((n: string) => n[0]).join("")}
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-slate-200">{p.full_name}</div>
                              <div className="text-[10px] text-slate-500">{p.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-slate-900 text-slate-400 border border-slate-850 rounded text-[9px] font-mono">
                              {getRoleLabel(p.designation || p.role)}
                            </span>
                            {p.id !== profile?.id && (
                              <button
                                onClick={() => handleDeletePersonnel(p.id)}
                                className="p-1 hover:bg-red-500/10 hover:text-red-400 text-slate-600 rounded-lg transition-all"
                                title="Deactivate Profile"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================== */
            /* TENANT SETUP WIZARD (MULTI-STEP)           */
            /* ========================================== */
            <div className="max-w-4xl mx-auto py-6">
              
              {/* Wizard Progress Line */}
              <div className="relative flex items-center justify-between mb-8 max-w-sm mx-auto">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2 -z-10" />
                
                {[
                  { key: "plan", label: "Plan" },
                  { key: "company", label: "Company" },
                  { key: "personnel", label: "Personnel" },
                  { key: "project", label: "Project" },
                  { key: "members", label: "Assign" }
                ].map((st, i, arr) => {
                  const steps = ["plan", "company", "personnel", "project", "members"];
                  const curIdx = steps.indexOf(wizardStep);
                  const stepIdx = steps.indexOf(st.key);
                  const isCompleted = stepIdx < curIdx;
                  const isActive = stepIdx === curIdx;

                  return (
                    <div key={st.key} className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all relative z-10 ${
                        isCompleted 
                          ? "bg-amber-500 border-amber-500 text-slate-950" 
                          : isActive 
                            ? "bg-slate-900 border-amber-500 text-white shadow-md shadow-amber-500/15 scale-105" 
                            : "bg-slate-950 border-slate-800 text-slate-500"
                      }`}>
                        {isCompleted ? <Check className="w-4 h-4 text-slate-950 stroke-[3]" /> : i + 1}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 ${
                        isActive ? "text-amber-400" : "text-slate-500"
                      }`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Wizard Step 1: Business Subscription Plan */}
              {wizardStep === "plan" && (
                <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 animate-fadeIn text-center relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 mb-4">
                    <Award className="w-8 h-8" aria-hidden="true" />
                  </div>

                  <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">{ONBOARDING_BUSINESS_PLAN.badge}</h3>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-2 uppercase tracking-tight">
                    {activePlan?.name || ONBOARDING_BUSINESS_PLAN.name}
                  </h2>
                  
                  {isPlanLoading ? (
                    <div className="my-6 py-10 px-6 bg-slate-950/60 border border-slate-850 rounded-xl max-w-lg mx-auto flex flex-col items-center justify-center">
                      <RefreshCw className="w-7 h-7 text-amber-500 animate-spin mb-3" />
                      <p className="text-xs text-slate-400 font-medium">Loading subscription plan details...</p>
                    </div>
                  ) : planError || !activePlan ? (
                    <div className="my-6 py-8 px-6 bg-rose-950/20 border border-rose-900/50 rounded-xl max-w-lg mx-auto">
                      <AlertCircle className="w-7 h-7 text-rose-500 mx-auto mb-2" />
                      <p className="text-xs text-rose-300 font-semibold mb-3">{planError || "Subscription plan is currently unavailable."}</p>
                      <button
                        type="button"
                        onClick={() => setPlanReloadKey(prev => prev + 1)}
                        className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Loading Plan</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const trialDurationFormatted = formatTrialDuration(activePlan.trial_duration_minutes);
                        const formattedPrice = new Intl.NumberFormat("en-ZA", {
                          style: "currency",
                          currency: activePlan.currency,
                        }).format(activePlan.amount_minor / 100);
                        const intervalInfo = formatBillingIntervalDisplay(activePlan.billing_interval);
                        const cancelAnytimeText = activePlan.cancel_anytime 
                          ? `${intervalInfo.billedText} • Cancel anytime`
                          : intervalInfo.billedText;
                        const trialOfferText = `${trialDurationFormatted} Free Trial — No card details required`;
                        const ctaText = `START ${trialDurationFormatted.toUpperCase()} FREE TRIAL →`;

                        return (
                          <>
                            <div className="my-6 py-5 px-6 bg-slate-950/60 border border-slate-850 rounded-xl max-w-lg mx-auto">
                              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                                {ONBOARDING_BUSINESS_PLAN.rateLabel}
                              </div>
                              <div 
                                className="text-3xl sm:text-4xl font-black text-white mt-1.5 tracking-tight"
                                aria-label={`${formattedPrice} ${intervalInfo.suffix}`}
                              >
                                {formattedPrice}{" "}
                                <span className="text-base sm:text-lg font-bold text-slate-400">{intervalInfo.suffix}</span>
                              </div>
                              <div className="text-xs text-slate-300 font-medium mt-1">
                                {cancelAnytimeText}
                              </div>
                              <div className="text-[11px] text-slate-400 font-normal mt-1 leading-snug">
                                {intervalInfo.renewalNotice}
                              </div>
                              <div className="mt-4 pt-3.5 border-t border-slate-850/80 flex items-center justify-center gap-1.5 text-xs text-amber-400 font-bold">
                                <Sparkles className="w-4 h-4 shrink-0 animate-pulse text-amber-400" aria-hidden="true" />
                                <span>{trialOfferText}</span>
                              </div>
                            </div>

                            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto mb-6">
                              {ONBOARDING_BUSINESS_PLAN.description}
                            </p>

                            <ul 
                              className="space-y-3.5 max-w-lg mx-auto text-left text-xs sm:text-[13px] text-slate-300 border-b border-slate-850/80 pb-6 mb-6"
                              aria-label="Business Subscription Plan benefits"
                            >
                              {ONBOARDING_BUSINESS_PLAN.benefits.map((benefit) => (
                                <li key={benefit.title} className="flex items-start gap-2.5">
                                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                                  <div className="leading-relaxed">
                                    <strong className="text-white font-bold">{benefit.title}:</strong>{" "}
                                    <span className="text-slate-300">{benefit.description}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>

                            <button
                              id="onboarding-start-trial-btn"
                              type="button"
                              onClick={handleStartTrial}
                              disabled={isStartingTrial || isPlanLoading || !activePlan}
                              aria-label={`${ctaText} for Business Subscription Plan`}
                              className="w-full max-w-lg py-3.5 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl transition-all duration-200 shadow-xl shadow-amber-500/10 hover:shadow-amber-500/20 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2 mx-auto focus:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span>{ctaText}</span>
                              <ArrowRight className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* Wizard Step 2: Create Company */}
              {wizardStep === "company" && (
                <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 animate-fadeIn">
                  <div className="text-center mb-6">
                    <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Step 2 of 5</h3>
                    <h2 className="text-2xl font-black text-white mt-1 uppercase tracking-tight">Create Company Profile</h2>
                  </div>

                  {createdCompanyForTrial ? (
                    <div className="text-center space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white tracking-tight">Company Profile Registered</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Company <strong className="text-slate-200">{createdCompanyForTrial.name}</strong> was created successfully, but initializing the trial encountered an issue.
                        </p>
                      </div>
                      <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs text-rose-300 text-left">
                        {trialStartError}
                      </div>
                      <button
                        type="button"
                        onClick={handleRetryTrialStart}
                        disabled={isStartingTrial}
                        className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
                      >
                        {isStartingTrial ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <span>Retry Starting Trial</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <CompanyOnboardingWizard
                      initialUser={profile ? {id:profile.id,email:profile.email,fullName:profile.full_name} : null}
                      onCancel={() => setWizardStep("plan")}
                      onSubmitCompany={async (details) => {
                        const ok = await handleCreateCompany({preventDefault: () => {}} as React.FormEvent, details);
                        if (!ok) throw new Error("Company setup is incomplete. Review the message above and retry the same setup.");
                      }}
                    />
                  )}
                </div>
              )}

              {/* Wizard Step 3: Company Members / Personnel */}
              {wizardStep === "personnel" && (
                <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 animate-fadeIn">
                  <div className="text-center mb-6">
                    <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Step 3 of 5</h3>
                    <h2 className="text-2xl font-black text-white mt-1 uppercase tracking-tight">Enterprise Personnel Directory</h2>
                    <p className="text-xs text-slate-400 mt-1">Add initial team members to align with project schedules</p>
                  </div>

                  {/* Inline Form to add Personnel */}
                  <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-4 mb-6">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-amber-500" /> Add Corporate Personnel
                    </h4>
                    
                    <form onSubmit={handleAddPersonnel} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Full Name (e.g. Thabo Mokoena)"
                          value={persName}
                          onChange={(e) => setPersName(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email (e.g. thabo@apexcivil.co.za)"
                          value={persEmail}
                          onChange={(e) => setPersEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Phone Number (e.g. +27721234567)"
                          value={persPhone}
                          onChange={(e) => setPersPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                        />
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="Temporary Password (min. 6 chars)"
                          value={persPassword}
                          onChange={(e) => setPersPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={persDesignation}
                          onChange={(e) => setPersDesignation(e.target.value)}
                          className="px-2 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200"
                        >
                          {Array.from(new Set(ROLE_OPTIONS.map(o => o.group))).map(group => (
                            <optgroup key={group} label={group} className="text-xs uppercase font-bold text-slate-500 bg-slate-950">
                              {ROLE_OPTIONS.filter(o => o.group === group).map(opt => (
                                <option key={opt.value} value={opt.label} className="bg-slate-900 text-slate-100">
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <select
                          value={persDepartment}
                          onChange={(e) => setPersDepartment(e.target.value)}
                          className="px-2 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200"
                        >
                          <option value="Engineering">Engineering</option>
                          <option value="Commercial">Commercial</option>
                          <option value="Operations">Operations</option>
                          <option value="HSE">HSE</option>
                          <option value="Administration">Administration</option>
                        </select>
                        <select
                          value={persRole}
                          onChange={(e) => setPersRole(e.target.value)}
                          className="px-2 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-200"
                        >
                          <option value="Member">Member Access</option>
                          <option value="Company Admin">Admin Access</option>
                          <option value="Viewer">Viewer Access</option>
                        </select>
                      </div>

                      {/* Project selection for new member (Requirement 1 & 2) */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Assignments (At least one required)</label>
                        <div className="border border-slate-800 rounded-lg p-3 space-y-2 max-h-[140px] overflow-y-auto bg-slate-950/40">
                          {(allProjects || []).filter((p: any) => p.company_id === (onboardingCompany?.id || activeCompany?.id)).map((proj: any) => {
                            const isSelected = selectedProjectIds.includes(proj.id);
                            return (
                              <div key={proj.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`wizard-create-proj-${proj.id}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedProjectIds(prev => [...prev, proj.id]);
                                    } else {
                                      setSelectedProjectIds(prev => prev.filter(id => id !== proj.id));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-amber-500 border-slate-800 rounded focus:ring-amber-500 cursor-pointer bg-slate-900"
                                />
                                <label htmlFor={`wizard-create-proj-${proj.id}`} className="text-xs font-medium text-slate-300 cursor-pointer select-none line-clamp-1">
                                  {proj.name} <span className="text-[10px] text-slate-500 font-mono">({proj.contract_code || proj.code})</span>
                                </label>
                              </div>
                            );
                          })}
                          {(allProjects || []).filter((p: any) => p.company_id === (onboardingCompany?.id || activeCompany?.id)).length === 0 && (
                            <p className="text-[10px] text-slate-500 italic">No active projects available. Please continue to create a project first or configure your projects.</p>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isActionLoading}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-white rounded-lg transition-all"
                      >
                        {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Align Member Profile"}
                      </button>
                    </form>
                  </div>

                  {/* Registered Personnel List */}
                  <div className="space-y-3 mb-6">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Directory List ({companyMembers.length})</h4>
                    
                    <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                      {companyMembers.map(p => (
                        <div key={p.id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-400">
                              {p.full_name?.split(" ").map((n: string) => n[0]).join("")}
                            </div>
                            <div>
                              <div className="font-bold text-slate-200">{p.full_name}</div>
                              <div className="text-[10px] text-slate-500">{p.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-slate-900 text-slate-400 border border-slate-850 rounded text-[9px]">
                              {getRoleLabel(p.designation || p.role)}
                            </span>
                            {p.id !== profile?.id && (
                              <button
                                onClick={() => handleDeletePersonnel(p.id)}
                                className="p-1 hover:bg-red-500/10 text-slate-600 hover:text-red-400 rounded transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button
                    onClick={() => {
                      setWizardStep("project");
                      const key = `pm_onboarding:${session!.user.id}`;
                      const previous = JSON.parse(localStorage.getItem(key) || "{}");
                      localStorage.setItem(key,JSON.stringify({...previous,step:"project"}));
                    }}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Continue to Project Setup
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Wizard Step 4: Create Project */}
              {wizardStep === "project" && (
                <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 animate-fadeIn">
                  <div className="text-center mb-6">
                    <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Step 4 of 5</h3>
                    <h2 className="text-2xl font-black text-white mt-1 uppercase tracking-tight">Create First Project</h2>
                    <p className="text-xs text-slate-400 mt-1">Configure active site parameters and contract frameworks</p>
                  </div>

                  <form onSubmit={handleCreateProject} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Project/Site Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. N2 Highway Rehabilitation, Section 13"
                        value={projName}
                        onChange={(e) => setProjName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Contract Baseline Code
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. N2-SEC13"
                          value={projCode}
                          onChange={(e) => setProjCode(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Contract Agreement Number
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SANRAL-C.084.22"
                          value={projNum}
                          onChange={(e) => setProjNum(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Contract Type / Framework
                        </label>
                        <select
                          value={projType}
                          onChange={(e) => setProjType(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-medium"
                        >
                          {CONTRACT_FRAMEWORKS.map((framework) => (
                            <option key={framework} value={framework} className="bg-slate-900 text-slate-100">
                              {framework}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Contract/Project Manager Focus
                        </label>
                        <select
                          value={projManager}
                          onChange={(e) => setProjManager(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-medium"
                        >
                          <option value="">Select Aligned Manager...</option>
                          {companyPersonnel.map(p => (
                            <option key={p.id} value={p.full_name} className="bg-slate-900 text-slate-100">
                              {p.full_name} ({getRoleLabel(p.designation || p.role)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Client Organization
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SANRAL SOC Ltd"
                          value={projClient}
                          onChange={(e) => setProjClient(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Execution Location Address
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Gqeberha, Eastern Cape"
                          value={projLocation}
                          onChange={(e) => setProjLocation(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Award Value Rate (ZAR)
                        </label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 15000000"
                          value={projValue}
                          onChange={(e) => setProjValue(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Initial Physical Progress (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={projProgress}
                          onChange={(e) => setProjProgress(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Site Possession / Start Date
                        </label>
                        <input
                          type="date"
                          value={projStart}
                          onChange={(e) => setProjStart(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 focus:outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Contract Completion Date
                        </label>
                        <input
                          type="date"
                          value={projEnd}
                          onChange={(e) => setProjEnd(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 focus:outline-none text-xs"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isActionLoading}
                      className="w-full mt-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Add Project <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                </div>
              )}

              {/* Wizard Step 5: Assign Project Members */}
              {wizardStep === "members" && (
                <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 animate-fadeIn">
                  <div className="text-center mb-6">
                    <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Step 5 of 5</h3>
                    <h2 className="text-2xl font-black text-white mt-1 uppercase tracking-tight">Assign Project Members</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Link registered corporate personnel to <strong>[{activeProject?.code}] {activeProject?.name}</strong>
                    </p>
                  </div>

                  <form onSubmit={handleAssignProjectMembers} className="space-y-4">
                    <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                      {companyPersonnel.map(p => {
                        const isAssigned = assignedPersIDs.includes(p.id);
                        return (
                          <div key={p.id} className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAssignedPersIDs(prev => [...prev, p.id]);
                                    setAssignedPersRoles(prev => ({ ...prev, [p.id]: p.role }));
                                  } else {
                                    setAssignedPersIDs(prev => prev.filter(id => id !== p.id));
                                  }
                                }}
                                className="w-4 h-4 rounded border-slate-800 text-amber-500 focus:ring-amber-500/20 bg-slate-950 cursor-pointer"
                              />
                              <div className="text-left">
                                <div className="text-xs font-bold text-slate-200">{p.full_name}</div>
                                <div className="text-[10px] text-slate-500">{p.email}</div>
                              </div>
                            </div>

                            {isAssigned && (
                              <div className="flex items-center gap-1.5">
                                <label className="text-[9px] text-slate-500 font-bold uppercase">Role:</label>
                                <select
                                  value={assignedPersRoles[p.id] || p.role || "Member"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAssignedPersRoles(prev => ({ ...prev, [p.id]: val }));
                                  }}
                                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-200 max-w-[150px] focus:outline-none focus:border-amber-500 cursor-pointer"
                                >
                                  <option value="Member">Member</option>
                                  {Array.from(new Set(ROLE_OPTIONS.map(o => o.group))).map(group => (
                                    <optgroup key={group} label={group} className="text-[9px] uppercase font-bold text-slate-500 bg-slate-950">
                                      {ROLE_OPTIONS.filter(o => o.group === group).map(opt => (
                                        <option key={opt.value} value={opt.label} className="bg-slate-900 text-slate-100 text-xs">
                                          {opt.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="submit"
                      disabled={isActionLoading}
                      className="w-full mt-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                    >
                      {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Commit Assignments & Operationalize <ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                </div>
              )}

            </div>
          )}
        </main>
      )}

      {/* ========================================== */}
      {/* VIEW: MAIN PUBLIC LANDING PAGE             */}
      {/* ========================================== */}
      {false && (
        <div className="animate-fadeIn">
          
          {/* 1. HERO SECTION */}
          <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              
              {/* Premium Announcement pill */}
              <div className="flex justify-center mb-6">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-full text-xs font-semibold tracking-wide text-amber-400 uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  Now live: Construction Engineering Ledger v2.4
                </span>
              </div>

              {/* High-impact Typography */}
              <div className="text-center max-w-4xl mx-auto mb-10">
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight text-white leading-tight">
                  Build with <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">control</span>.<br />
                  Deliver with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-500">confidence</span>.
                </h1>
                <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
                  ProjectMatrix is the unified enterprise ERP ledger for major contractors. 
                  Synchronize diaries, contract notices, and budget forecasts into a single, real-time command station.
                </p>

                {/* Main Action Buttons */}
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  {session ? (
                    <button
                      onClick={() => setCurrentView("login")}
                      className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl transition-all duration-200 shadow-xl shadow-amber-500/20 flex items-center gap-2 cursor-pointer text-base"
                    >
                      Enter Control Console
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setCurrentView("register")}
                        className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl transition-all duration-200 shadow-xl shadow-amber-500/20 flex items-center gap-2 cursor-pointer text-base"
                      >
                        Get Started
                        <ArrowRight className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setSelectedDemoVideo(true)}
                        className="px-8 py-4 bg-slate-900/80 hover:bg-slate-800 border border-slate-850 rounded-xl text-slate-200 hover:text-white font-semibold flex items-center gap-2 transition-all cursor-pointer text-base"
                      >
                        <Play className="w-4 h-4 fill-slate-200" />
                        Watch Demo
                      </button>
                    </>
                  )}
                  <button
                    onClick={scrollToPricing}
                    className="px-8 py-4 text-sm font-semibold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
                  >
                    View Pricing
                  </button>
                </div>
              </div>

              {/* HERO VISUAL & FLOATING ELEMENTS CONTAINER */}
              <div className="relative mt-16 max-w-5xl mx-auto">
                
                {/* Visual Glassmorphic Dashboard Mockup */}
                <div className="relative z-20 bg-slate-950/90 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 overflow-hidden">
                  
                  {/* Top bar control */}
                  <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-850">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500/80" />
                        <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <span className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <span className="text-xs text-slate-500 font-mono select-all">projectmatrix-console.za</span>
                    </div>
                    <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono uppercase tracking-wider">
                      ● Active Control Mode
                    </span>
                  </div>

                  {/* Mockup GRID content */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* Active Projects card */}
                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl hover:border-slate-800 hover:scale-102 transition-all group cursor-pointer">
                      <div className="flex items-center justify-between text-slate-500 mb-2">
                        <Briefcase className="w-4 h-4 text-blue-400 group-hover:animate-pulse" />
                        <span className="text-[10px] font-mono">01</span>
                      </div>
                      <div className="text-2xl font-black text-white">14</div>
                      <div className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">Active Projects</div>
                    </div>

                    {/* Pending RFIs card */}
                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl hover:border-slate-800 hover:scale-102 transition-all group cursor-pointer">
                      <div className="flex items-center justify-between text-slate-500 mb-2">
                        <FileText className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-mono">02</span>
                      </div>
                      <div className="text-2xl font-black text-amber-500">28</div>
                      <div className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">Pending RFIs</div>
                    </div>

                    {/* Early Warnings card */}
                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl hover:border-slate-800 hover:scale-102 transition-all group cursor-pointer">
                      <div className="flex items-center justify-between text-slate-500 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-mono">03</span>
                      </div>
                      <div className="text-2xl font-black text-red-500">08</div>
                      <div className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">Early Warnings</div>
                    </div>

                    {/* Compensation Events card */}
                    <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl hover:border-slate-800 hover:scale-102 transition-all group cursor-pointer">
                      <div className="flex items-center justify-between text-slate-500 mb-2">
                        <Coins className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-mono">04</span>
                      </div>
                      <div className="text-2xl font-black text-emerald-400">R2.4M</div>
                      <div className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">Comp. Events</div>
                    </div>
                  </div>

                  {/* Large visual section representing charts */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Progress tracking representation */}
                    <div className="col-span-1 md:col-span-2 p-5 bg-slate-900/40 border border-slate-850 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Actual vs Planned Progress</h4>
                        <span className="text-[10px] text-amber-400 font-mono">Month {chartProgressMonth} / 12</span>
                      </div>
                      {/* Simple high-fidelity SVG chart */}
                      <div className="h-44 w-full bg-slate-950/80 rounded-lg p-2 flex flex-col justify-end relative">
                        <svg className="w-full h-full" viewBox="0 0 400 150">
                          {/* Grid lines */}
                          <line x1="0" y1="110" x2="400" y2="110" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                          <line x1="0" y1="75" x2="400" y2="75" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                          <line x1="0" y1="40" x2="400" y2="40" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                          
                          {/* Planned path: smooth line */}
                          <path
                            d="M 10 140 Q 100 110, 200 60 T 390 15"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3"
                            strokeOpacity="0.8"
                          />
                          {/* Actual progress path: Orange */}
                          <path
                            d={`M 10 140 Q 100 115, 200 ${80 - (chartProgressMonth * 4)} T 390 40`}
                            fill="none"
                            stroke="#ffa300"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />

                          {/* Data markers on Month 6 */}
                          <circle cx="200" cy="60" r="4" fill="#3b82f6" />
                          <circle cx="200" cy={80 - (chartProgressMonth * 4)} r="5" fill="#ffa300" />
                        </svg>
                        
                        {/* Interactive Slider to control progress */}
                        <div className="absolute top-2 right-2 flex items-center gap-2">
                          <label className="text-[9px] font-mono text-slate-500">Month Sim:</label>
                          <input
                            type="range"
                            min="1"
                            max="12"
                            value={chartProgressMonth}
                            onChange={(e) => setChartProgressMonth(Number(e.target.value))}
                            className="w-16 accent-amber-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Site Diaries & Documents list visual */}
                    <div className="p-5 bg-slate-900/40 border border-slate-850 rounded-xl space-y-4">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Operations Log</h4>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2.5 p-2 bg-slate-950/60 rounded border border-slate-850">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <div className="flex-1">
                            <p className="font-semibold text-white">Daily Site Diary Signed</p>
                            <p className="text-[10px] text-slate-500 font-mono">By Agent S. Nkosi • 08:30</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2 bg-slate-950/60 rounded border border-slate-850">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                          <div className="flex-1">
                            <p className="font-semibold text-white">Procurement Schedule</p>
                            <p className="text-[10px] text-slate-500 font-mono">3 Steel orders authorized</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2 bg-slate-950/60 rounded border border-slate-850">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                          <div className="flex-1">
                            <p className="font-semibold text-white">Notice of Early Warning</p>
                            <p className="text-[10px] text-slate-500 font-mono">EWN-004: Concrete delays</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ANIMATED 3D-STYLE FLOATING ELEMENTS */}
                {/* Crane Icon Float */}
                <div className="absolute -top-12 -left-12 z-30 w-16 h-16 bg-[#0E1D34] border border-slate-800 rounded-2xl flex items-center justify-center text-amber-500 shadow-xl animate-subtle-float">
                  <Building2 className="w-8 h-8 stroke-[1.5]" />
                </div>

                {/* Gantt Bar Card Float */}
                <div className="absolute top-1/3 -right-16 z-30 hidden md:flex items-center gap-2 p-3 bg-slate-900/90 border border-slate-850 rounded-lg shadow-xl animate-subtle-float-slow">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-mono text-slate-300 font-bold uppercase tracking-wider">Foundation Gantt</span>
                  <div className="w-12 h-2 bg-slate-950 rounded overflow-hidden">
                    <div className="w-2/3 h-full bg-blue-500" />
                  </div>
                </div>

                {/* RFI Notification Card Float */}
                <div className="absolute -bottom-8 -left-8 z-40 p-4 bg-[#0E1D34] border border-slate-800 rounded-xl shadow-2xl flex items-center gap-3 animate-subtle-float-reverse">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-wider">RFI-028 Received</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 font-mono">Status: Awaiting PM Response</p>
                  </div>
                </div>

                {/* Cost graph floating trend */}
                <div className="absolute bottom-1/4 -right-12 z-30 hidden md:flex flex-col p-3 bg-slate-900/95 border border-slate-850 rounded-lg shadow-xl animate-subtle-float">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="text-[9px] font-semibold uppercase text-slate-400">Actual Cost</span>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  </div>
                  <span className="text-sm font-black text-white">R12,840,900</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. TRUSTED CONSTRUCTION CONTROL SECTION (4 stats) */}
          <section className="py-20 border-t border-b border-slate-800/60 bg-[#070c14]/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Trusted Ledger</h3>
                <h2 className="text-3xl md:text-5xl font-black text-white mt-2">Engineered for absolute control</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Stat 1 */}
                <div className="text-center p-6 bg-slate-900/40 border border-slate-850 rounded-2xl">
                  <div className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3">360°</div>
                  <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">Project Visibility</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Unify site diaries, drawings, and notices into a centralized digital index.
                  </p>
                </div>

                {/* Stat 2 */}
                <div className="text-center p-6 bg-slate-900/40 border border-slate-850 rounded-2xl">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-amber-500 tracking-tight mb-3">REALTIME</div>
                  <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">Live Cost Tracking</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Compare forecast margins against active compensation events and orders instantly.
                  </p>
                </div>

                {/* Stat 3 */}
                <div className="text-center p-6 bg-slate-900/40 border border-slate-850 rounded-2xl">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mb-3">COMPLIANCE</div>
                  <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">Contract Notices</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Enforce compliance by locking early warning response times in one location.
                  </p>
                </div>

                {/* Stat 4 */}
                <div className="text-center p-6 bg-slate-900/40 border border-slate-850 rounded-2xl">
                  <div className="text-4xl md:text-5xl font-black text-blue-400 tracking-tight mb-3">1-N</div>
                  <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">ERP Workspace</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Support multiple companies, subcontractors, and authorities on a single database.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. FEATURES SECTION (10 Feature cards with Glassmorphism) */}
          <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Modular Architecture</h3>
              <h2 className="text-3xl md:text-6xl font-black text-white mt-2">Every tool. Done right.</h2>
              <p className="text-slate-400 mt-4">
                Enterprise infrastructure built from the ground up for commercial contractors, civil engineers, and developers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Project Dashboard */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <Building2 className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Project Dashboard</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Consolidate project progress, outstanding queries, critical milestones and site registers at a glance.
                </p>
              </div>

              {/* Card 2: Site Diaries */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <Calendar className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Site Diaries</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Log labor, machinery, climate, and daily milestones from mobile or desktop with instant sign-off workflows.
                </p>
              </div>

              {/* Card 3: RFI Register */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">RFI Register</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Submit queries, attach drawings, select respondents and track contractual response timers effortlessly.
                </p>
              </div>

              {/* Card 4: Early Warnings */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Early Warnings</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Formally notify project participants of risks to price, quality or progress using compliant early warning protocols.
                </p>
              </div>

              {/* Card 5: Compensation Events */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <Coins className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Compensation Events</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Assess variations, submit impact analyses, and lock certified financial variations into the project cost database.
                </p>
              </div>

              {/* Card 6: Procurement Tracking */}
              <div className="p-6 bg-[#0E1D34]/50 border border-slate-800 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <Layers className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Procurement Tracking</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Manage supply chain timelines, material lead-times, ordering approvals and site delivery matching.
                </p>
              </div>

              {/* Card 7: Document Control */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Document Control</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Store construction drawings, structural parameters, test certificates, and design specifications securely.
                </p>
              </div>

              {/* Card 8: Cost & Budget Monitoring */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Cost & Budget Monitoring</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Live comparison of estimated tender quantities versus actual billable values on physical progress.
                </p>
              </div>

              {/* Card 9: Progress Tracking */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <Layers className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Progress Tracking</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Log completed construction milestones, concrete volumes and civil excavation yards directly to progress records.
                </p>
              </div>

              {/* Card 10: User & Company Administration */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl hover:border-amber-500/30 hover:scale-102 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">User & Company Administration</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Manage subcontractor parameters, site access authorization, roles, and client compliance matrices.
                </p>
              </div>

            </div>
          </section>

          {/* 4. ERP COMMAND CENTRE SECTION (Split Layout & Interactive module stack) */}
          <section id="command-centre" className="py-24 bg-[#070c14]/40 border-t border-b border-slate-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              
              {/* Left Column: Text explaining the ERP */}
              <div>
                <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Enterprise Command</h3>
                <h2 className="text-3xl md:text-5xl font-black text-white mt-2 leading-tight">
                  One stack for absolute engineering certainty
                </h2>
                <p className="text-slate-400 mt-6 leading-relaxed">
                  Construction relies on thousands of moving targets. Traditional tools create siloed document caches. 
                  ProjectMatrix coordinates all parameters into an active relational ledger—ensuring site agents, directors, 
                  and clients operate with verified transparency.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-amber-500/15 rounded-lg text-amber-400 mt-1">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm uppercase tracking-wide">Standardized Contract Ledger</p>
                      <p className="text-xs text-slate-400 mt-0.5">Automate and store all JBCC, FIDIC, or standardized early warning timelines securely.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-amber-500/15 rounded-lg text-amber-400 mt-1">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm uppercase tracking-wide">Site to Finance Synchronization</p>
                      <p className="text-xs text-slate-400 mt-0.5">Authorize cost items and diesel purchase bills immediately from verified site logs.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive module stack */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-3">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Module Control Stack</span>
                  <span className="text-[10px] text-amber-500 font-mono">Select to preview</span>
                </div>

                {/* Vertical interactive tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                  {[
                    { id: "notices", label: "Contract Notices" },
                    { id: "procurement", label: "Procurement Schedule" },
                    { id: "diaries", label: "Site Diary Logs" },
                    { id: "documents", label: "Document Register" },
                    { id: "progress", label: "Progress Reports" },
                    { id: "financial", label: "Financial Control" },
                  ].map((mod) => (
                    <button
                      key={mod.id}
                      onClick={() => setSelectedModule(mod.id)}
                      className={`py-2 px-3 text-[10px] font-bold uppercase rounded-lg border text-center transition-all cursor-pointer ${
                        selectedModule === mod.id
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow"
                          : "bg-slate-900/50 border-slate-850 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {mod.label}
                    </button>
                  ))}
                </div>

                {/* Dynamic Preview Container */}
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-850/80 min-h-48 flex flex-col justify-between">
                  {selectedModule === "notices" && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span>LEDGER ID: EWN-024</span>
                        <span>STATUS: AWAITING_PM</span>
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wide">Notice of Early Warning (Excavation Delay)</h4>
                      <p className="text-xs text-slate-400">
                        Soil quality assessment identified dense rock at Section B coordinate. Civil team estimates additional 5 workdays for specialized excavator equipment.
                      </p>
                      <div className="pt-2 border-t border-slate-850 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">PM instruction required within 48 hours</span>
                      </div>
                    </div>
                  )}

                  {selectedModule === "procurement" && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span>BILL OF QUANTITIES REQ: #PQ-928</span>
                        <span>PROGRESS: 80%</span>
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wide">Structural Rebar Reinforcement Steel</h4>
                      <p className="text-xs text-slate-400">
                        Subcontractor steel order authorized. Expected dispatch: 24h. Tracking reference ST-9411 for Section C reinforced slabs.
                      </p>
                      <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Authorized by Agent</span>
                        <span className="text-emerald-400 font-mono font-bold">R1,240,000.00 Approved</span>
                      </div>
                    </div>
                  )}

                  {selectedModule === "diaries" && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span>DIARY: SD-0629</span>
                        <span>WEATHER: 21°C OVERCAST</span>
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wide">Civil Team A Shift Ledger</h4>
                      <p className="text-xs text-slate-400">
                        Concrete pour of foundation column 12 completed. Labor headcount verified (22 on-site). Diesel fuel delivery received (500L logged).
                      </p>
                      <div className="pt-2 border-t border-slate-850 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Signed-off by Client Representative</span>
                      </div>
                    </div>
                  )}

                  {selectedModule === "documents" && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span>INDEX: DWG-STR-C-014</span>
                        <span>VERSION: Rev_3.4</span>
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wide">Section C Reinforced Concrete Columns Blueprint</h4>
                      <p className="text-xs text-slate-400">
                        Updated layout showing increased steel mesh diameters for structural column load transfer points. Approved by Chief Engineer.
                      </p>
                      <div className="pt-2 border-t border-slate-850 text-right">
                        <span className="inline-block px-2 py-0.5 bg-blue-500/15 border border-blue-500/20 text-[10px] text-blue-400 rounded">PDF Viewable in Console</span>
                      </div>
                    </div>
                  )}

                  {selectedModule === "progress" && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span>METRIC: PHYSICAL_COMPLETION</span>
                        <span>TARGET: 42%</span>
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wide">General Bulk Excavation Milestone</h4>
                      <p className="text-xs text-slate-400">
                        Total yards moved: 12,400 out of 25,000. Site excavation is on track. Haul trucks cycle log at 92% efficiency index.
                      </p>
                      <div className="pt-2 border-t border-slate-850 flex justify-between text-[10px] font-bold text-white uppercase">
                        <span>Current: 44.5%</span>
                        <span className="text-emerald-400"> Ahead of Schedule (+2.5%)</span>
                      </div>
                    </div>
                  )}

                  {selectedModule === "financial" && (
                    <div className="space-y-3 animate-fadeIn">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span>FINANCIAL LEDGER: FL-014</span>
                        <span>VARIANCE: -1.2%</span>
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wide">Project Capital Account Overview</h4>
                      <p className="text-xs text-slate-400">
                        Approved contract value: R48.5M. Actual expenditure to date: R18.2M. Cost forecast to completion maintains -1.2% healthy margin.
                      </p>
                      <div className="pt-2 border-t border-slate-850 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Risk Margin Index</span>
                        <span className="text-xs font-bold text-emerald-400">Low Risk Alert</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </section>

          {/* 5. DYNAMIC CHARTS SECTION */}
          <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Interactive Dashboards</h3>
              <h2 className="text-3xl md:text-5xl font-black text-white mt-2">Analytical precision</h2>
              <p className="text-slate-400 mt-4">
                Simulate engineering cost variance or project timelines interactively.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Chart 1: Planned vs Actual Site Progress */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Planned vs Actual Progress</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Drag simulator slider below to advance project timeline</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-amber-500 bg-amber-500/5 border border-amber-500/10 px-2 py-1 rounded">
                      Month {chartProgressMonth} Simulator
                    </span>
                  </div>
                </div>

                {/* SVG Progress chart visual */}
                <div className="h-64 bg-slate-950/80 rounded-xl p-4 relative flex flex-col justify-between">
                  <div className="flex-1 w-full">
                    <svg className="w-full h-full" viewBox="0 0 500 180">
                      {/* Grid Lines */}
                      <line x1="0" y1="135" x2="500" y2="135" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                      <line x1="0" y1="90" x2="500" y2="90" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                      <line x1="0" y1="45" x2="500" y2="45" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                      
                      {/* Labels */}
                      <text x="5" y="40" fill="#475569" fontSize="8" fontFamily="monospace">80%</text>
                      <text x="5" y="85" fill="#475569" fontSize="8" fontFamily="monospace">50%</text>
                      <text x="5" y="130" fill="#475569" fontSize="8" fontFamily="monospace">20%</text>

                      {/* Planned line path */}
                      <path
                        d="M 20 160 Q 150 140, 250 80 T 480 20"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3.5"
                        strokeOpacity="0.8"
                      />

                      {/* Actual line path (dynamic depending on month) */}
                      <path
                        d={`M 20 160 Q 150 ${170 - (chartProgressMonth * 4)}, 250 ${120 - (chartProgressMonth * 6)} T 480 ${100 - (chartProgressMonth * 7)}`}
                        fill="none"
                        stroke="#ffa300"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />

                      {/* Current month indicator vertical line */}
                      <line
                        x1={20 + (chartProgressMonth * 38)}
                        y1="10"
                        x2={20 + (chartProgressMonth * 38)}
                        y2="170"
                        stroke="#e2e8f0"
                        strokeWidth="1.5"
                        strokeDasharray="2,2"
                        opacity="0.6"
                      />
                      <text
                        x={10 + (chartProgressMonth * 38)}
                        y="15"
                        fill="#ffa300"
                        fontSize="9"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        M{chartProgressMonth}
                      </text>
                    </svg>
                  </div>

                  {/* Range Slider */}
                  <div className="pt-4 border-t border-slate-900 flex items-center gap-4">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider shrink-0">Month Progress</span>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={chartProgressMonth}
                      onChange={(e) => setChartProgressMonth(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Chart 2: Forecast Cost vs Actual Cost */}
              <div className="p-6 bg-slate-900/60 border border-slate-850 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Forecast vs Actual Cost</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Drag slider below to simulate budget deviations</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-red-400 bg-red-500/5 border border-red-500/10 px-2 py-1 rounded">
                      Variance Sim: {costVarianceRange}%
                    </span>
                  </div>
                </div>

                {/* SVG Cost chart visual */}
                <div className="h-64 bg-slate-950/80 rounded-xl p-4 relative flex flex-col justify-between">
                  <div className="flex-1 w-full">
                    <svg className="w-full h-full" viewBox="0 0 500 180">
                      {/* Bar 1 (Month 1): Base steel foundation */}
                      <rect x="50" y="110" width="30" height="50" fill="#3b82f6" opacity="0.8" rx="2" />
                      <rect x="85" y="110" width="30" height="50" fill="#ffa300" rx="2" />

                      {/* Bar 2 (Month 2): Infrastructure earthworks */}
                      <rect x="170" y="80" width="30" height="80" fill="#3b82f6" opacity="0.8" rx="2" />
                      <rect x="205" y="80" width="30" height="80" fill="#ffa300" rx="2" />

                      {/* Bar 3 (Month 3): Structural concrete works (DYNAMICAL HEIGHT BY VARIANCE) */}
                      <rect x="290" y="60" width="30" height="100" fill="#3b82f6" opacity="0.8" rx="2" />
                      <rect 
                        x="325" 
                        y={60 - (costVarianceRange * 1.5)} 
                        width="30" 
                        height={100 + (costVarianceRange * 1.5)} 
                        fill={costVarianceRange > 10 ? "#ef4444" : "#ffa300"} 
                        rx="2" 
                      />

                      <text x="67" y="175" fill="#64748b" fontSize="8" fontWeight="bold" fontFamily="monospace">STEEL</text>
                      <text x="187" y="175" fill="#64748b" fontSize="8" fontWeight="bold" fontFamily="monospace">EARTH</text>
                      <text x="307" y="175" fill="#64748b" fontSize="8" fontWeight="bold" fontFamily="monospace">CONCRETE</text>
                    </svg>
                  </div>

                  {/* Range Slider */}
                  <div className="pt-4 border-t border-slate-900 flex items-center gap-4">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider shrink-0">Cost Deviation</span>
                    <input
                      type="range"
                      min="-10"
                      max="35"
                      value={costVarianceRange}
                      onChange={(e) => setCostVarianceRange(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* 6. WORKFLOW SECTION (Connected Timeline) */}
          <section id="workflow" className="py-24 bg-[#070c14]/40 border-t border-b border-slate-800/60 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-20">
                <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Contract Lifecycle</h3>
                <h2 className="text-3xl md:text-5xl font-black text-white mt-2">Pristine project journey</h2>
                <p className="text-slate-400 mt-4">
                  From commercial bidding down to certified project handovers, automate progress with compliant logic steps.
                </p>
              </div>

              {/* Connected (Linear-style) timeline */}
              <div className="relative max-w-4xl mx-auto">
                {/* Horizontal connector line on desktop */}
                <div className="absolute top-12 left-12 right-12 h-0.5 bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500 hidden md:block opacity-40" />

                <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative z-10">
                  
                  {/* Step 1 */}
                  <div className="flex flex-col items-center text-center group">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-amber-500/80 hover:border-amber-400 flex items-center justify-center font-bold text-white text-lg relative z-20 shadow-lg shadow-amber-500/10 hover:scale-105 transition-all">
                      01
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-4">Tender</h4>
                    <p className="text-[11px] text-slate-400 mt-2">Lock estimated bill of quantities and baseline forecasts.</p>
                  </div>

                  {/* Step 2 */}
                  <div className="flex flex-col items-center text-center group">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-700 group-hover:border-slate-500 flex items-center justify-center font-bold text-slate-300 text-lg relative z-20 shadow-lg hover:scale-105 transition-all">
                      02
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-4">Project Setup</h4>
                    <p className="text-[11px] text-slate-400 mt-2">Initialize company profiles, drawings index, and user access levels.</p>
                  </div>

                  {/* Step 3 */}
                  <div className="flex flex-col items-center text-center group">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-blue-500/80 hover:border-blue-400 flex items-center justify-center font-bold text-slate-300 text-lg relative z-20 shadow-lg shadow-blue-500/10 hover:scale-105 transition-all">
                      03
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-4">Site Execution</h4>
                    <p className="text-[11px] text-slate-400 mt-2">Log daily site diaries, material logs, and verify labor records.</p>
                  </div>

                  {/* Step 4 */}
                  <div className="flex flex-col items-center text-center group">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-700 group-hover:border-slate-500 flex items-center justify-center font-bold text-slate-300 text-lg relative z-20 shadow-lg hover:scale-105 transition-all">
                      04
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-4">Contract Control</h4>
                    <p className="text-[11px] text-slate-400 mt-2">Enforce early warning compliance and compensation events.</p>
                  </div>

                  {/* Step 5 */}
                  <div className="flex flex-col items-center text-center group">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-emerald-500/80 hover:border-emerald-400 flex items-center justify-center font-bold text-slate-300 text-lg relative z-20 shadow-lg shadow-emerald-500/10 hover:scale-105 transition-all">
                      05
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mt-4">Final Account</h4>
                    <p className="text-[11px] text-slate-400 mt-2">Audit historical site diary logs to authorize final client payment certs.</p>
                  </div>

                </div>
              </div>
            </div>
          </section>

          {/* 7. PRICING TEASER SECTION */}
          <section id="pricing-section" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h3 className="text-xs font-black tracking-[0.2em] text-amber-500 uppercase">Enterprise Value</h3>
              <h2 className="text-3xl md:text-5xl font-black text-white mt-2">Commercial-grade packages</h2>
              <p className="text-slate-400 mt-4">
                Flexible structures designed for growing subcontractors, regional general contractors and tier-1 operators.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              
              {/* Card 1: Starter */}
              <div className="p-8 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
                <div>
                  <h3 className="text-xs font-bold tracking-[0.1em] text-slate-400 uppercase">Starter Package</h3>
                  <div className="text-2xl font-black text-white mt-4">Contact for pricing</div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Essential ledger functions for independent civil teams and specific site contractors.
                  </p>
                  <ul className="mt-6 space-y-3.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Up to 3 active projects</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Standard site diaries</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> RFI indexing register</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Basic PDF exports</li>
                  </ul>
                </div>
                <button
                  onClick={() => setCurrentView("register")}
                  className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-white rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Get Started
                </button>
              </div>

              {/* Card 2: Professional */}
              <div className="p-8 bg-slate-900/80 border-2 border-amber-500 rounded-2xl flex flex-col justify-between relative shadow-2xl shadow-amber-500/5">
                <span className="absolute -top-3 right-6 px-3 py-1 bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider rounded-full">
                  Recommended
                </span>
                <div>
                  <h3 className="text-xs font-bold tracking-[0.1em] text-amber-400 uppercase">Professional</h3>
                  <div className="text-2xl font-black text-white mt-4">Contact for pricing</div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Robust multi-company project alignment with early warning ledger features.
                  </p>
                  <ul className="mt-6 space-y-3.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Unlimited active projects</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Complete compliance notices ledger</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Full procurement tracking</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Site diary mobile workflows</li>
                  </ul>
                </div>
                <button
                  onClick={() => setCurrentView("register")}
                  className="w-full mt-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Sign Up Professional
                </button>
              </div>

              {/* Card 3: Enterprise */}
              <div className="p-8 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors">
                <div>
                  <h3 className="text-xs font-bold tracking-[0.1em] text-slate-400 uppercase">Enterprise Suite</h3>
                  <div className="text-2xl font-black text-white mt-4">Contact for pricing</div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Custom deployment packages featuring multi-tenant isolation and API connectivity.
                  </p>
                  <ul className="mt-6 space-y-3.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Dedicated database isolation</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Custom JBCC or FIDIC profiles</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> API access integrations</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-500" /> Dedicated account engineering</li>
                  </ul>
                </div>
                <button
                  onClick={() => setCurrentView("register")}
                  className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-white rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Contact Sales
                </button>
              </div>

            </div>
          </section>

          {/* 8. CALL-TO-ACTION SECTION */}
          <section className="py-24 relative overflow-hidden bg-gradient-to-b from-[#060a12] via-[#081224] to-[#060a12] border-t border-slate-800/60">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
              <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight uppercase">
                Build with control.<br />Deliver with confidence.
              </h2>
              <p className="mt-6 text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
                Connect your engineering and contract operations today. Ensure absolute compliance across all active project profiles.
              </p>

              <div className="mt-10 flex flex-wrap justify-center gap-4">
                {session ? (
                  <button
                    onClick={() => setCurrentView("login")}
                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl transition-all duration-200 shadow-xl shadow-amber-500/20 cursor-pointer"
                  >
                    Enter Control Console
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setCurrentView("register")}
                      className="px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl transition-all duration-200 shadow-xl shadow-amber-500/20 cursor-pointer"
                    >
                      Get Started Now
                    </button>
                    <button
                      onClick={() => setCurrentView("login")}
                      className="px-8 py-4 bg-slate-900/80 hover:bg-slate-800 border border-slate-850 rounded-xl text-slate-200 hover:text-white font-semibold transition-all cursor-pointer"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* 9. FOOTER */}
          <footer className="bg-[#04070c] border-t border-slate-900 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
              
              {/* Logo section */}
              <div className="col-span-2">
                <div className="w-48 h-10 mb-4">
                  <ProjectMatrixLogo />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                  The primary digital ledger for modern civil contractors. 
                  Synchronizing site operations and contract frameworks with military precision.
                </p>
              </div>

              {/* Product links */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">Product</h4>
                <ul className="space-y-2.5 text-xs text-slate-400">
                  <li><a href="#features" className="hover:text-amber-400 transition-colors">Features Index</a></li>
                  <li><a href="#command-centre" className="hover:text-amber-400 transition-colors">Compliance Engine</a></li>
                  <li><a href="#pricing" onClick={(e) => { e.preventDefault(); scrollToPricing(); }} className="hover:text-amber-400 transition-colors">SaaS Pricing</a></li>
                  <li><button onClick={() => setSelectedDemoVideo(true)} className="hover:text-amber-400 transition-colors">Visual Demo</button></li>
                </ul>
              </div>

              {/* Company links */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">Company</h4>
                <ul className="space-y-2.5 text-xs text-slate-400">
                  <li><span className="text-slate-500 select-all">About Matrix</span></li>
                  <li><span className="text-slate-500 select-all">Engineering Careers</span></li>
                  <li><span className="text-slate-500 select-all">Contract Compliance</span></li>
                  <li><span className="text-slate-500 select-all">Customer Stories</span></li>
                </ul>
              </div>

              {/* Legal links */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">Regulatory</h4>
                <ul className="space-y-2.5 text-xs text-slate-400">
                  <li><span className="text-slate-500">Security Architecture</span></li>
                  <li><span className="text-slate-500">Terms of Service</span></li>
                  <li><span className="text-slate-500">Privacy Protocols</span></li>
                  <li><span className="text-slate-500">Service Level Agreement</span></li>
                </ul>
              </div>

            </div>

            {/* Bottom Credit lines */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
              <p>© 2026 ProjectMatrix. All rights reserved.</p>
              <p className="font-semibold text-slate-400 uppercase tracking-wider">
                Construction ERP for modern contractors.
              </p>
            </div>
          </footer>

        </div>
      )}

      {/* ========================================== */}
      {/* WATCH DEMO MODAL POPUP                     */}
      {/* ========================================== */}
      {selectedDemoVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#04070c]/90 backdrop-blur-md p-4 transition-all animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-4 md:p-5 relative shadow-2xl max-h-[95vh] overflow-y-auto flex flex-col justify-between">
            
            {/* Close trigger */}
            <button 
              onClick={() => setSelectedDemoVideo(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-3">
              <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest">Interactive Video Walkthrough</span>
              <h3 className="text-lg md:text-xl font-bold text-white mt-0.5">ProjectMatrix Command Station</h3>
            </div>

            {/* Simulated premium media player */}
            <div className="aspect-video bg-slate-950 rounded-xl border border-slate-850 flex flex-col justify-center items-center p-4 md:p-6 relative overflow-hidden group">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-48 md:h-48 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/15 transition-all" />
              
              <div className="p-4 md:p-5 bg-amber-500/10 border-2 border-amber-500 text-amber-400 rounded-full shadow-lg cursor-pointer group-hover:scale-110 transition-transform relative z-10">
                <Play className="w-6 h-6 md:w-8 md:h-8 fill-amber-500" />
              </div>
              
              <div className="mt-3 md:mt-4 text-center relative z-10 max-w-md px-2">
                <p className="text-xs md:text-sm font-semibold text-slate-200">Watch the Contract Ledger Compliance demonstration</p>
                <p className="text-[10px] md:text-xs text-slate-500 mt-1">Learn how site agents log diaries to automatically forecast project completion dates in 5 minutes.</p>
              </div>

              {/* Player UI bottom control bar */}
              <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 bg-slate-900/80 border-t border-slate-850 flex items-center justify-between text-[9px] md:text-[10px] text-slate-400">
                <div className="flex items-center gap-3">
                  <Play className="w-2.5 h-2.5 md:w-3 md:h-3 fill-slate-400 cursor-pointer" />
                  <span>00:00 / 04:52</span>
                </div>
                <span>HQ 1080p Stream</span>
              </div>
            </div>

            <div className="mt-3 md:mt-4 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedDemoVideo(false)}
                className="px-4 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Close Window
              </button>
              <button 
                onClick={() => {
                  setSelectedDemoVideo(false);
                  setCurrentView("register");
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </HashRouter>
  );
}
