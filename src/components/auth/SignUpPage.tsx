import React, { useState } from "react";
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Globe, 
  MapPin, 
  DollarSign, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Shield, 
  FileText, 
  Layers, 
  Sparkles, 
  AlertCircle,
  Loader2,
  Users,
  Briefcase
} from "lucide-react";
import ProjectMatrixLogo from "../ProjectMatrixLogo";
import { useAuth } from "../../contexts/AuthContext";

import { REGION_CONFIGS } from "../../config/countries";

interface SignUpPageProps {
  onSwitchToSignIn: () => void;
}

export function SignUpPage({ onSwitchToSignIn }: SignUpPageProps) {
  const { signUp } = useAuth();
  
  // Account creation hands off to the primary plan and billed company setup.
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: User Account State
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [workEmail, setWorkEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  // Step 1 Submission: Register Account & Create Canonical Profile
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg("Please enter your First Name and Last Name.");
      return;
    }
    if (!workEmail.trim() || !workEmail.includes("@")) {
      setErrorMsg("Please provide a valid work email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters in length.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await signUp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: workEmail.trim(),
        password: password,
        phone: phone.trim() || undefined
      });

      if (!res.success || !res.user) {
        setErrorMsg(res.error || "Failed to create account. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!res.session) {
        setConfirmationRequired(true);
        setPassword(""); setConfirmPassword("");
        setErrorMsg("Account created. Check your email to confirm your address, then sign in to choose your plan and complete company setup.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Account creation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Partner account UI; all company creation is owned by App onboarding.
  return (
    <div className="min-h-screen w-full bg-[#0B172A] flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl animate-fadeIn">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          <div className="w-44 mb-1">
            <ProjectMatrixLogo />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {step === 1 ? "Create Your Project Matrix Account" : "Establish Organisation Workspace"}
          </h1>
          <p className="text-xs text-slate-400">
            {step === 1 
              ? "Create your account, then select your plan and set up your company" 
              : "Step 2 of 2: Appoint initial Systems Administrator & configure workspace"}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full ${
            step === 1 ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-emerald-400"
          }`}>
            <span>1. Account</span>
            {step > 1 && <CheckCircle2 className="w-3.5 h-3.5" />}
          </div>
          <div className="w-8 h-0.5 bg-slate-800" />
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full ${
            step === 2 ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
          }`}>
            <span>2. Plan & Company Setup</span>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className={`mb-5 p-3.5 rounded-2xl border text-xs flex items-start gap-3 animate-fadeIn ${confirmationRequired ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* STEP 1: Account Creation Form */}
        {step === 1 && (
          <form onSubmit={handleAccountSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  First Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Tendai"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Last Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Mokoena"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Direct Contact Phone (Optional)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+27 82 000 0000"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || confirmationRequired}
              className="w-full mt-3 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Continue to Plan Selection</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Company Establishment Form */}
        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Already registered?{" "}
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;
