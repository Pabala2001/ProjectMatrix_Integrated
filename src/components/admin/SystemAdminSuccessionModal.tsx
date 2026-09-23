import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2, 
  ArrowRight 
} from "lucide-react";
import { transferSystemAdministrator } from "../../services/tenantService";

interface PersonnelOption {
  id: string;
  full_name: string;
  email: string;
  designation?: string;
  role?: string;
}

interface SystemAdminSuccessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  currentAdminUserId: string;
  currentAdminName: string;
  personnelList: PersonnelOption[];
  onSuccessionCompleted: (newAdminName: string) => void;
}

export default function SystemAdminSuccessionModal({
  isOpen,
  onClose,
  tenantId,
  currentAdminUserId,
  currentAdminName,
  personnelList,
  onSuccessionCompleted
}: SystemAdminSuccessionModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [reason, setReason] = useState<string>("Executive succession transition");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [confirmedRisk, setConfirmedRisk] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter out current admin from potential candidates
  const candidates = personnelList.filter(p => p.id !== currentAdminUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/admin/SystemAdminSuccessionModal.tsx");
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUserId) {
      setErrorMsg("Please select an active employee to receive System Administrator authority.");
      return;
    }
    if (!authPassword) {
      setErrorMsg("Please re-enter your password to authorize this sensitive executive transfer.");
      return;
    }
    if (!confirmedRisk) {
      setErrorMsg("You must acknowledge that you are transferring primary tenant ownership.");
      return;
    }

    const targetMember = candidates.find(c => c.id === selectedUserId);
    if (!targetMember) {
      setErrorMsg("Selected employee record not found.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await transferSystemAdministrator(
        tenantId,
        currentAdminUserId,
        {
          userId: targetMember.id,
          fullName: targetMember.full_name,
          email: targetMember.email,
          designation: targetMember.designation || targetMember.role || "Executive"
        },
        reason
      );

      setSuccessMsg(res.message);
      setTimeout(() => {
        onSuccessionCompleted(targetMember.full_name);
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to execute succession transfer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                System Administrator Succession
              </h3>
              <p className="text-[11px] text-slate-400">Primary Tenant Ownership Transfer</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg ? (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white uppercase">Transfer Executed</h4>
              <p className="text-slate-300 text-xs">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Sensitive Administrative Action
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Transferring the System Administrator role reassigns root management over company configuration, user provisioning, security policies, and tenant isolation. This action will be permanently recorded in the immutable audit log.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Select Successor (Active Employee) <span className="text-amber-500">*</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose active company employee --</option>
                  {candidates.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.email}) — {p.designation || p.role || "Personnel"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Reason for Transfer
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Executive promotion, management restructuring"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Re-enter Your Administrator Password <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <Lock className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={confirmedRisk}
                    onChange={(e) => setConfirmedRisk(e.target.checked)}
                    className="accent-amber-500 rounded mt-0.5"
                  />
                  <span className="text-[11px] leading-snug">
                    I confirm that I am willingly transferring primary System Administrator authority to the chosen employee.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-400 hover:text-white font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-600 hover:to-amber-700 disabled:opacity-50 text-white font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Executing Transfer...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Transfer Authority</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
