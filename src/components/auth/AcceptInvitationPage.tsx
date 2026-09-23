import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Shield, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  User, 
  Phone, 
  Mail, 
  AlertCircle, 
  Loader2, 
  Layers, 
  Check, 
  Sparkles,
  KeyRound,
  Eye,
  EyeOff
} from "lucide-react";
import { 
  getInvitationByToken, 
  acceptEmployeeInvitation, 
  EmployeeInvitation 
} from "../../services/invitationService";

interface AcceptInvitationPageProps {
  initialToken?: string;
  onAccepted?: (result: { userId: string; tenantId: string; companyId: string; profile: any }) => void;
  onSuccess?: (invitation: any, createdUser: any) => void;
  onBackToLogin?: () => void;
  onSwitchToLogin?: () => void;
  onSwitchToRegister?: () => void;
}

export default function AcceptInvitationPage({
  initialToken = "",
  onAccepted,
  onSuccess,
  onBackToLogin,
  onSwitchToLogin,
  onSwitchToRegister
}: AcceptInvitationPageProps) {
  const [tokenInput, setTokenInput] = useState<string>(initialToken);
  const [invitation, setInvitation] = useState<EmployeeInvitation | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Acceptance Form State
  const [fullName, setFullName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>("");
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // If initial token is provided, look it up automatically
  useEffect(() => {
    if (initialToken) {
      lookupToken(initialToken);
    }
  }, [initialToken]);

  const lookupToken = (tokenToLookup: string) => {
    const clean = tokenToLookup.trim();
    if (!clean) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const inv = getInvitationByToken(clean);
      if (!inv) {
        setSearchError("No active invitation found matching this token. Please verify the code with your System Administrator.");
        setInvitation(null);
      } else if (inv.status === "Accepted") {
        setSearchError("This invitation has already been accepted and activated. Please sign in to your account.");
        setInvitation(null);
      } else if (inv.status === "Revoked") {
        setSearchError("This invitation has been revoked by your System Administrator.");
        setInvitation(null);
      } else if (inv.status === "Expired") {
        setSearchError("This invitation has expired (72h limit). Please request a refreshed invitation link from your System Administrator.");
        setInvitation(null);
      } else {
        setInvitation(inv);
        setFullName(`${inv.first_name} ${inv.last_name}`);
        setPhone(inv.phone || "");
      }
    } catch (err: any) {
      setSearchError(err.message || "Could not verify invitation token.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupToken(tokenInput);
  };

  const handleAcceptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    setFormError(null);

    if (!fullName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setFormError("You must accept the Project Matrix Terms of Service and Data Governance Policy.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await acceptEmployeeInvitation({
        token: invitation.secure_token,
        confirmedFullName: fullName.trim(),
        password,
        phone: phone.trim() || undefined,
        mfaEnabled
      });

      if (onSuccess) {
        onSuccess(invitation, result.profile || {
          id: result.userId,
          full_name: fullName.trim(),
          email: invitation.email,
          role: invitation.system_role,
          phone: phone.trim() || null
        });
      } else if (onAccepted) {
        onAccepted(result);
      }
    } catch (err: any) {
      console.error("Failed to accept invitation:", err);
      setFormError(err.message || "Failed to complete invitation acceptance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 animate-fadeIn">
      {/* If No Invitation Loaded Yet: Show the Token Entry / Policy Screen */}
      {!invitation ? (
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-500">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Join an Existing Company
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Project Matrix enforces strict multi-tenant enterprise isolation.
            </p>
          </div>

          {/* User Policy Notice */}
          <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Invitation Required</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              You can only join an existing company through an invitation sent by your organisation's <strong>System Administrator</strong>. Public joining or searching across organizations is disabled to preserve commercial confidentiality.
            </p>
          </div>

          {searchError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{searchError}</span>
            </div>
          )}

          <form onSubmit={handleLookupSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Paste Your Invitation Token or Secure Code <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. inv_token_thabo_contracts_8921 or 24-character token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                You can find this token in the invitation email received from your administrator.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSearching || !tokenInput.trim()}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Token...</span>
                </>
              ) : (
                <>
                  <span>Verify & Accept Invitation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-xs font-bold text-slate-400 hover:text-white"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      ) : (
        /* Invitation Found -> Accept & Setup Account Form */
        <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="px-3 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block mb-1">
              Valid Invitation Verified
            </span>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              You've Been Invited to Project Matrix
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Join <strong className="text-white">{invitation.company_name}</strong>
            </p>
          </div>

          {/* Locked / Read-only Invitation Parameters */}
          <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-xl space-y-3">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Assigned Organisation & Role (Read-Only)
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Company</span>
                <strong className="text-white truncate block">{invitation.company_name}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Department</span>
                <strong className="text-slate-200">{invitation.department}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">System Role</span>
                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold rounded text-[10px]">
                  {invitation.system_role_name}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Invited By</span>
                <span className="text-slate-300">{invitation.created_by_name}</span>
              </div>
            </div>

            {invitation.project_assignments.length > 0 && (
              <div className="pt-2.5 border-t border-slate-850">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">
                  Initial Project Assignments ({invitation.project_assignments.length}):
                </span>
                <div className="space-y-1">
                  {invitation.project_assignments.map((pa, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                      <span className="font-semibold text-slate-200">{pa.projectName}</span>
                      <span className="text-[10px] text-amber-400 font-mono">[{pa.projectRole}]</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {formError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Account Creation Form */}
          <form onSubmit={handleAcceptSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Full Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Work Email Address
              </label>
              <input
                type="email"
                disabled
                value={invitation.email}
                className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-400 text-xs font-semibold cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Create Password <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Confirm Password <span className="text-amber-500">*</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Telephone (Optional)
              </label>
              <input
                type="tel"
                placeholder="+27 82 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-semibold"
              />
            </div>

            <div className="pt-2 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="accent-amber-500 rounded mt-0.5"
                />
                <span>
                  I accept the <strong>Project Matrix Enterprise Terms</strong> and understand that access is isolated strictly under tenant <code className="text-amber-400">{invitation.tenant_id}</code>.
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={mfaEnabled}
                  onChange={(e) => setMfaEnabled(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>Enable Multi-Factor Authentication (MFA) on this account</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activating Account...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration & Enter Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={() => setInvitation(null)}
              className="text-slate-500 hover:text-slate-300"
            >
              Enter a different token
            </button>
            <button
              type="button"
              onClick={onBackToLogin}
              className="font-bold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
