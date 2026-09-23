import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, AlertTriangle, RefreshCw, Lock } from "lucide-react";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import UniversalCommandPalette from "./UniversalCommandPalette";
import { WorkspaceAuthBridge } from "../../contexts/AuthContext";
import { CompanyBillingEntitlement } from "../../types";
import { isBillingVerificationError } from "../../services/billingService";
import { ApplicationAccessBoundary } from "../../integration/ApplicationAccessBoundary";
import AskMatrixAssistantPanel from "../advisor/AskMatrixAssistantPanel";

interface PageLayoutProps {
  billingEntitlement?: CompanyBillingEntitlement | null;
  isBillingEntitlementLoading?: boolean;
  refetchBillingEntitlement?: () => Promise<void>;
  profile: any;
  activeCompany: any;
  activeProject: any;
  allProjects: any[];
  allCompanies?: any[];
  onCompanyChange?: (company: any) => void;
  onProjectChange: (proj: any) => void;
  onSignOut: () => void;
  onSettingsClick: () => void;
  companyPersonnel: any[];
  projectAssignments: any[];
  allProjectsRaw: any[];
  onRefetchTenant: () => Promise<void>;
  loadCompanyMembers?: (companyId: string) => Promise<any[]>;
  isActionLoading: boolean;
  setIsActionLoading: (loading: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function PageLayout(props: PageLayoutProps) {
  return <WorkspaceAuthBridge workspace={props}><WorkspaceLayout {...props}/></WorkspaceAuthBridge>;
}
function WorkspaceLayout({
  billingEntitlement, isBillingEntitlementLoading, refetchBillingEntitlement,
  profile,
  activeCompany,
  activeProject,
  allProjects,
  allCompanies = [],
  onCompanyChange,
  onProjectChange,
  onSignOut,
  onSettingsClick,
  companyPersonnel,
  projectAssignments,
  allProjectsRaw,
  onRefetchTenant,
  loadCompanyMembers,
  isActionLoading,
  setIsActionLoading,
  setErrorMsg,
  setSuccessMsg,
  isDarkMode,
  onToggleDarkMode
}: PageLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const location = useLocation();
  const isVerificationError = !isBillingEntitlementLoading && isBillingVerificationError(billingEntitlement);
  const isGracePeriod = !isVerificationError && billingEntitlement?.access_mode === "grace_period";
  const isReadOnly = !isBillingEntitlementLoading && !isVerificationError && (
    billingEntitlement?.access_mode === "read_only" ||
    (billingEntitlement && !billingEntitlement.can_write)
  );
  const canWrite = Boolean(
    billingEntitlement &&
    billingEntitlement.can_write === true &&
    !isBillingEntitlementLoading &&
    !isVerificationError
  );


  // Global key listener for ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for custom trigger to open advisor
  useEffect(() => {
    const handleTriggerAdvisor = () => {
      setIsAdvisorOpen(true);
    };
    window.addEventListener("matrix-open-advisor" as any, handleTriggerAdvisor);
    return () => window.removeEventListener("matrix-open-advisor" as any, handleTriggerAdvisor);
  }, []);

  // Check if there is a mismatch between activeProject and activeCompany
  const isTenantMismatched = Boolean(
    activeProject &&
    activeCompany &&
    activeProject.company_id &&
    activeCompany.id &&
    activeProject.company_id !== activeCompany.id &&
    activeProject.company_id !== activeCompany.tenant_id &&
    activeProject.organisation_id !== activeCompany.id &&
    activeProject.organisation_id !== activeCompany.tenant_id
  );

  // Auto-align activeProject if a mismatch is ever detected
  useEffect(() => {
    if (isTenantMismatched && allProjects && allProjects.length > 0) {
      const validProject = allProjects.find(
        (p: any) =>
          !activeCompany?.id ||
          p.company_id === activeCompany.id ||
          p.company_id === activeCompany.tenant_id ||
          p.organisation_id === activeCompany.id ||
          p.organisation_id === activeCompany.tenant_id
      ) || allProjects[0];

      if (validProject && validProject.id !== activeProject?.id) {
        onProjectChange(validProject);
      }
    }
  }, [isTenantMismatched, allProjects, activeCompany, activeProject?.id, onProjectChange]);

  return (
    <div id="projectmatrix-root" className="flex h-screen w-screen flex-col bg-[#F8FAFC] text-slate-800 antialiased overflow-hidden">
      {/* Universal Command Bar Palette Overlay */}
      <UniversalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeProject={activeProject}
        activeCompany={activeCompany}
      />

      {/* Right-Side Persistent Operating Model AI Assistant Panel */}
      <AskMatrixAssistantPanel
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        activeProject={activeProject}
        activeCompany={activeCompany}
      />

      {/* Top Bar */}
      <Topbar
        profile={profile}
        activeCompany={activeCompany}
        activeProject={activeProject}
        allProjects={allProjects}
        allCompanies={allCompanies}
        onCompanyChange={onCompanyChange}
        onProjectChange={onProjectChange}
        onSignOut={onSignOut}
        onSettingsClick={onSettingsClick}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenAdvisor={() => setIsAdvisorOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        companyPersonnel={companyPersonnel}
      />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
          activeCompany={activeCompany}
          activeProject={activeProject}
          allProjects={allProjects}
          onProjectChange={onProjectChange}
          companyPersonnel={companyPersonnel}
        />

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 relative bg-[#F8FAFC]">
          <div className="w-full max-w-[1680px] mx-auto min-w-0">
            {isTenantMismatched && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h4 className="font-semibold text-sm">Tenant Context Mismatch</h4>
                    <p className="text-xs mt-0.5">
                      The selected project <strong>{activeProject?.name || "Selected Project"}</strong> does not belong to your active company <strong>{activeCompany?.name || "Active Workspace"}</strong>.
                    </p>
                  </div>
                </div>
                {allProjects && allProjects.length > 0 && (
                  <button
                    onClick={() => {
                      const valid = allProjects.find(
                        (p: any) =>
                          p.company_id === activeCompany?.id ||
                          p.company_id === activeCompany?.tenant_id
                      ) || allProjects[0];
                      if (valid) onProjectChange(valid);
                    }}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-md transition-colors cursor-pointer"
                  >
                    Align Workspace Project
                  </button>
                )}
              </div>
            )}

          {isVerificationError && (
            <div
              id="billing-verification-error-banner"
              className="mb-4 p-4 bg-amber-50/90 border border-amber-300 rounded-xl text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-800">
                    Billing Verification Unavailable
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Unable to verify company billing status with the server. Operational write actions are temporarily disabled until connection is restored.
                  </p>
                </div>
              </div>
              {refetchBillingEntitlement && (
                <button
                  type="button"
                  onClick={() => { void refetchBillingEntitlement(); }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 shadow-sm cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Verification</span>
                </button>
              )}
            </div>
          )}

          {/* Grace Period Warning Banner */}
          {isGracePeriod && (
            <div
              id="billing-grace-period-banner"
              className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-800">
                    Past Due Notice • Grace Period Active
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Your subscription payment is past due. Your company is currently in a 7-day grace period. Operational write access will become read-only if payment is not resolved.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { window.location.hash = "/billing/payment-methods"; }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 shadow-sm cursor-pointer whitespace-nowrap"
              >
                Update Payment Method
              </button>
            </div>
          )}

          {/* Read-Only Warning Banner */}
          {isReadOnly && (
            <div
              id="billing-read-only-banner"
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fadeIn"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-red-800">
                    Read-Only Mode Active
                  </h4>
                  <p className="text-xs text-red-700 mt-0.5">
                    Your company is in read-only mode. Operational create, edit, delete, upload, and workflow actions are disabled. Update billing to continue.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { window.location.hash = "/billing/subscriptions"; }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0 shadow-sm cursor-pointer whitespace-nowrap"
              >
                Manage Subscription
              </button>
            </div>
          )}


            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="h-full w-full min-w-0"
              >
                <ApplicationAccessBoundary>
                <Outlet
                  context={{
                    billingEntitlement, isBillingEntitlementLoading, refetchBillingEntitlement,
                    canWrite, isReadOnly, isGracePeriod, isVerificationError,
                    accessMode: billingEntitlement?.access_mode || "read_only",
                    profile,
                    activeCompany,
                    activeProject,
                    allProjects,
                    allCompanies,
                    onCompanyChange,
                    companyPersonnel,
                    projectAssignments,
                    allProjectsRaw,
                    onRefetchTenant,
                    loadCompanyMembers,
                    isActionLoading,
                    setIsActionLoading,
                    setErrorMsg,
                    setSuccessMsg,
                    onProjectChange
                  }}
                />
                </ApplicationAccessBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
