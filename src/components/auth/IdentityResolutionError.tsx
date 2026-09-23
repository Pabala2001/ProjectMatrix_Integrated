import React, { useState } from "react";
import { AlertTriangle, RefreshCw, LogOut, ShieldAlert, ChevronDown, ChevronUp, UserPlus, Building } from "lucide-react";
import ProjectMatrixLogo from "../ProjectMatrixLogo";
import { ResolutionError } from "../../services/authResolutionService";

interface IdentityResolutionErrorProps {
  errorDetails: ResolutionError | null;
  onRetry: () => void;
  onSignOut: () => void;
  onStartOnboarding?: () => void;
}

export function IdentityResolutionError({
  errorDetails,
  onRetry,
  onSignOut,
  onStartOnboarding
}: IdentityResolutionErrorProps) {
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry();
    setIsRetrying(false);
  };

  const getFriendlyMessage = (code?: string) => {
    switch (code) {
      case "PROFILE_NOT_FOUND":
        return "We signed you in, but Project Matrix could not resolve your organisation profile. Please contact your Systems Administrator or set up your company workspace.";
      case "MEMBERSHIP_NOT_FOUND":
        return "Your user account is authenticated, but does not belong to any active company workspace. Please contact your Systems Administrator or establish a workspace.";
      case "COMPANY_NOT_FOUND":
        return "Your assigned company workspace could not be loaded. Please contact your organisation administrator.";
      case "ROLE_NOT_FOUND":
        return "Your assigned role could not be matched to an enterprise permission model. Please contact your Systems Administrator.";
      default:
        return errorDetails?.message || "Project Matrix encountered an error while resolving your identity and access privileges.";
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B172A] flex flex-col items-center justify-center p-6 text-slate-100">
      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6 animate-fadeIn">
        {/* Logo */}
        <div className="w-44">
          <ProjectMatrixLogo />
        </div>

        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Header and Message */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-black tracking-tight text-white">
            Identity Resolution Issue
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            {getFriendlyMessage(errorDetails?.code)}
          </p>
        </div>

        {/* Diagnostics Accordion */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Diagnostic Code: <span className="font-mono text-amber-400">{errorDetails?.code || "RESOLUTION_FAILED"}</span>
            </span>
            {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDiagnostics && (
            <div className="px-4 pb-4 text-xs font-mono text-slate-400 border-t border-slate-800/80 pt-3 space-y-1.5 bg-slate-950">
              <div><strong className="text-slate-300">Message:</strong> {errorDetails?.message}</div>
              {errorDetails?.diagnosticInfo?.authUserId && (
                <div><strong className="text-slate-300">Auth User ID:</strong> {errorDetails.diagnosticInfo.authUserId}</div>
              )}
              {errorDetails?.diagnosticInfo?.profileId && (
                <div><strong className="text-slate-300">Profile ID:</strong> {errorDetails.diagnosticInfo.profileId}</div>
              )}
              {errorDetails?.diagnosticInfo?.companyId && (
                <div><strong className="text-slate-300">Company ID:</strong> {errorDetails.diagnosticInfo.companyId}</div>
              )}
              {errorDetails?.diagnosticInfo?.detail && (
                <div><strong className="text-slate-300">Details:</strong> {errorDetails.diagnosticInfo.detail}</div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-3 pt-2">
          {onStartOnboarding && (errorDetails?.code === "PROFILE_NOT_FOUND" || errorDetails?.code === "MEMBERSHIP_NOT_FOUND") && (
            <button
              type="button"
              onClick={onStartOnboarding}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer"
            >
              <Building className="w-4 h-4" />
              Set Up Company Workspace
            </button>
          )}

          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Retrying..." : "Retry Resolution"}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs border border-rose-500/30 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default IdentityResolutionError;
