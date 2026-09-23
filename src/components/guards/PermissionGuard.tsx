import React, { useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { Lock, ShieldAlert, Send, CheckCircle2, X } from "lucide-react";

export interface PermissionGuardProps {
  permission: string;
  projectId?: string;
  amount?: number;
  currency?: string;
  creatorId?: string;
  fallback?: React.ReactNode;
  showFallbackScreen?: boolean;
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  projectId,
  amount,
  currency,
  creatorId,
  fallback,
  showFallbackScreen = false,
  children
}: PermissionGuardProps) {
  const { checkPermission, requestAccess, userRole } = usePermissions();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const evalResult = checkPermission(permission, { projectId, amount, currency, creatorId });

  if (evalResult.granted) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  if (!showFallbackScreen) {
    return null;
  }

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) return;
    setIsSubmitting(true);
    const success = await requestAccess(permission, justification, projectId);
    setIsSubmitting(false);
    if (success) {
      setRequestSubmitted(true);
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setRequestSubmitted(false);
        setJustification("");
      }, 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-center max-w-lg mx-auto my-6 shadow-xl backdrop-blur-xs">
      <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
        <Lock className="w-6 h-6" />
      </div>

      <h3 className="text-lg font-bold text-white tracking-tight">Permission Required</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">
        {evalResult.reason || `Your current role (${userRole}) requires the '${permission}' permission to perform this action.`}
      </p>

      <div className="mt-4 flex items-center gap-2 text-[11px] font-mono bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
        <span className="text-slate-500">Target Permission:</span>
        <span className="text-amber-400 font-semibold">{permission}</span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsRequestModalOpen(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          Request Access
        </button>
      </div>

      {/* Interactive Request Access Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-left shadow-2xl relative">
            <button
              onClick={() => setIsRequestModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Submit Access Request</h4>
                <p className="text-[11px] text-slate-400">Routes to Company Administrator for review</p>
              </div>
            </div>

            {requestSubmitted ? (
              <div className="p-4 bg-emerald-950/50 border border-emerald-500/30 rounded-xl text-center text-emerald-400 flex flex-col items-center gap-2 my-4">
                <CheckCircle2 className="w-8 h-8" />
                <div className="text-xs font-bold">Access Request Submitted!</div>
                <div className="text-[10px] text-emerald-300/80">You will be notified once reviewed.</div>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Requested Permission
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={permission}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-400 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Operational Justification <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Describe why your duties require access to this function..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !justification.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PermissionGuard;
