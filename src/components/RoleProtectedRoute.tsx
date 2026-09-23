import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { canAccessDirectory, canAccessBilling, DirectoryKey } from "../config/accessControl";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";

export interface CompanyPersonnelMember {
  id?: string;
  company_id: string;
  profile_id?: string;
  is_company_admin?: boolean;
  designation?: string;
  role?: string;
  is_active?: boolean;
  full_name?: string;
  email?: string;
}

interface AppOutletContext {
  activeCompany?: { id: string; name: string } | null;
  companyPersonnel?: CompanyPersonnelMember[];
  isActionLoading?: boolean;
  billingEntitlement?: {
    can_read: boolean;
    can_write: boolean;
    can_access_billing: boolean;
    can_export: boolean;
    can_access_settings: boolean;
    access_mode: string;
  } | null;
  [key: string]: unknown;
}

// Access Denied view
export function AccessDenied({ 
  directoryName, 
  userDesignation,
  customMessage 
}: { 
  directoryName: string; 
  userDesignation?: string;
  customMessage?: string;
}) {
  const navigate = useNavigate();

  // Helper to format directory names nicely
  const getReadableName = (key: string) => {
    const maps: Record<string, string> = {
      commandCentre: "Command Centre",
      dashboard: "Dashboard",
      programme: "Programme",
      dailyReports: "Daily Reports",
      siteDiaries: "Site Diaries",
      documents: "Documents",
      communication: "Communication",
      qualityControl: "Quality Control",
      procurement: "Procurement",
      administration: "Administration",
      labourPayroll: "Labour Payroll",
      settings: "Settings",
      billing: "Billing",
    };
    return maps[key] || key;
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm max-w-2xl mx-auto my-12 animate-fadeIn">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20">
        <ShieldAlert className="w-8 h-8 text-[#FF9F1C]" />
      </div>
      
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight text-center">
        Access Restricted
      </h2>
      
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 text-center max-w-md leading-relaxed">
        {customMessage ? (
          customMessage
        ) : (
          <>
            Your company designation <span className="font-bold text-slate-700 dark:text-slate-200">"{userDesignation || 'None'}"</span> does not have permission to open the <span className="font-bold text-[#FF9F1C]">{getReadableName(directoryName)}</span> directory.
          </>
        )}
      </p>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#102846] text-white text-xs font-bold rounded-xl hover:bg-[#15345a] transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-5 py-2.5 bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

interface RoleProtectedRouteProps {
  directory: DirectoryKey;
  requireBillingAccess?: boolean;
  requireCompanyAdmin?: boolean;
  children: React.ReactNode;
}

export default function RoleProtectedRoute({ 
  directory, 
  requireBillingAccess = false,
  requireCompanyAdmin = false, 
  children 
}: RoleProtectedRouteProps) {
  const { profile, loading: authLoading } = useAuth();
  
  let context: AppOutletContext | null = null;
  try {
    context = useOutletContext<AppOutletContext>();
  } catch (e) {
    // Fail-safe if rendered outside nested outlet context
  }

  // 1. Loading state (Auth or company personnel in active company)
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          Verifying Permissions...
        </span>
      </div>
    );
  }

  const activeCompany = context?.activeCompany;

  // 2. If no active company is selected, allow child to render (e.g. Subscriptions "No Active Company Selected" state)
  if (!activeCompany) {
    return <>{children}</>;
  }

  // If active company exists but personnel array is still loading/null, show loading indicator to prevent access-denied flash
  if (context?.companyPersonnel === undefined || (context?.isActionLoading && (!context?.companyPersonnel || context.companyPersonnel.length === 0))) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          Loading Company Permissions...
        </span>
      </div>
    );
  }

  const companyPersonnel: CompanyPersonnelMember[] = context?.companyPersonnel || [];
  const activeMember = companyPersonnel.find(
    (member: CompanyPersonnelMember) => 
      member.profile_id === profile?.id && 
      (!member.company_id || member.company_id === activeCompany.id)
  );

  const userDesignation = activeMember?.designation || activeMember?.role || profile?.role;
  const billingEntitlement = context?.billingEntitlement;

  // 3. Check billing entitlement access capabilities
  if (billingEntitlement) {
    if (directory === "billing" && billingEntitlement.can_access_billing === false) {
      return (
        <AccessDenied
          directoryName={directory}
          userDesignation={userDesignation}
          customMessage="Billing and subscription access is disabled for this company account."
        />
      );
    }

    if (directory === "settings" && billingEntitlement.can_access_settings === false) {
      return (
        <AccessDenied
          directoryName={directory}
          userDesignation={userDesignation}
          customMessage="Settings access is disabled for this company account."
        />
      );
    }

    if (directory !== "billing" && directory !== "settings" && billingEntitlement.can_read === false) {
      return (
        <AccessDenied
          directoryName={directory}
          userDesignation={userDesignation}
          customMessage="Data access is disabled for this company account."
        />
      );
    }
  }

  // 4. If Billing access is explicitly required (RBAC)
  if (requireBillingAccess || requireCompanyAdmin || directory === "billing") {
    const hasBillingAccess = canAccessBilling({
      member: activeMember,
      activeCompanyId: activeCompany.id,
      profileId: profile?.id,
    });

    if (!hasBillingAccess) {
      return (
        <AccessDenied 
          directoryName={directory} 
          userDesignation={userDesignation}
          customMessage="Access to Billing & Subscription management is restricted. Access is limited to CEO, COO, CFO, Director, Project Manager and Company Administrator roles for the active company."
        />
      );
    }
    return <>{children}</>;
  }

  // 5. Standard directory access check (RBAC)
  const hasAccess = canAccessDirectory(userDesignation, directory);
  if (!hasAccess) {
    return <AccessDenied directoryName={directory} userDesignation={userDesignation} />;
  }

  return <>{children}</>;
}

