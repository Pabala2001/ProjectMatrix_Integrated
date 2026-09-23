import React from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import ProjectMatrixLogo from "../ProjectMatrixLogo";

export function AuthenticationLoadingScreen() {
  return (
    <div className="min-h-screen w-full bg-[#0B172A] flex flex-col items-center justify-center p-6 text-slate-100 select-none">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-fadeIn">
        {/* Brand Logo */}
        <div className="w-48 mb-2">
          <ProjectMatrixLogo />
        </div>

        {/* Loading Spinner & Status Indicator */}
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-amber-500/40 flex items-center justify-center">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
          </div>
        </div>

        {/* Informational Text */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">
            Resolving Identity & Permissions
          </h2>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Verifying your organisation profile and loading persisted workspace credentials...
          </p>
        </div>

        {/* Subtle Progress Bar */}
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-amber-500 to-amber-300 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default AuthenticationLoadingScreen;
