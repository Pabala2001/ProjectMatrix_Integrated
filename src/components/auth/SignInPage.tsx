import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Shield, 
  Play,
  X,
  Search,
  Bell,
  HardHat,
  Compass,
  Building2,
  Zap,
  Landmark,
  Briefcase,
  Layers,
  Users,
  BarChart3,
  ShieldCheck,
  Smartphone,
  Check,
  Calendar,
  Clock,
  FileText,
  DollarSign,
  AlertTriangle,
  FolderGit2,
  TrendingUp,
  Settings,
  Activity,
  QrCode,
  KeyRound,
  Menu
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { QrSignInCard } from "./QrSignInCard";
import ProjectMatrixLogo from "../ProjectMatrixLogo";
import {
  SolutionsSection,
  FeaturesSection,
  IndustriesSection,
  ResourcesSection,
  AboutUsSection,
  LandingFooter
} from "./LandingSections";

interface SignInPageProps {
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
  initialShowLogin?: boolean;
}

/**
 * Official Project Matrix Brand Logo & Wordmark (Matching App & Official Asset)
 */
export function ProjectMatrixBrandMark({ 
  size = "default",
  theme = "light"
}: { 
  size?: "small" | "default" | "large";
  theme?: "dark" | "light" | "auto";
}) {
  const isSmall = size === "small";
  const isLarge = size === "large";

  const widthClass = isSmall ? "w-28 sm:w-32" : isLarge ? "w-48 sm:w-56" : "w-36 sm:w-44";

  return (
    <div className={`flex items-center select-none ${widthClass}`} id="pm-brandmark-logo">
      <ProjectMatrixLogo theme={theme === "auto" ? "light" : theme} />
    </div>
  );
}

export function SignInPage({ onSwitchToSignUp, onForgotPassword, initialShowLogin = false }: SignInPageProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberEmail, setRememberEmail] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // State to control Sign In modal dialog overlay (can be opened via top-nav button or hero CTA)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState<boolean>(initialShowLogin);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<"password" | "qr">("password");
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (initialShowLogin) {
      setIsSignInModalOpen(true);
    }
  }, [initialShowLogin]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pm_remembered_email");
      if (saved) {
        setEmail(saved);
        setRememberEmail(true);
      }
    } catch (e) {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg("Please enter both work email and password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (rememberEmail) {
        localStorage.setItem("pm_remembered_email", email.trim());
      } else {
        localStorage.removeItem("pm_remembered_email");
      }

      const res = await signIn(email.trim(), password, rememberEmail);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to sign in. Please verify your credentials.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during authentication.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FFFFFF] relative overflow-x-hidden text-[#07182E] font-sans selection:bg-[#FF6B00] selection:text-white flex flex-col justify-between">
      
      {/* ========================================================================= */}
      {/* TOP RIGHT NAVY DIAGONAL BACKGROUND SLICE (Matches Screenshot)            */}
      {/* ========================================================================= */}
      <div 
        className="absolute top-0 right-0 w-[55vw] h-[480px] bg-[#07182E] pointer-events-none hidden md:block z-0"
        style={{
          clipPath: "polygon(28% 0%, 100% 0%, 100% 100%, 0% 100%)"
        }}
      ></div>

      {/* BOTTOM RIGHT ORANGE ACCENT SLICE (Matches Screenshot) */}
      <div 
        className="absolute bottom-0 right-0 w-[45vw] h-10 bg-[#FF6B00] pointer-events-none hidden md:block z-0"
        style={{
          clipPath: "polygon(18% 0%, 100% 0%, 100% 100%, 0% 100%)"
        }}
      ></div>

      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR                                                     */}
      {/* ========================================================================= */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <div className="cursor-pointer" onClick={() => setIsSignInModalOpen(false)}>
          <ProjectMatrixBrandMark />
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-700">
          <button 
            type="button" 
            onClick={() => scrollToSection("solutions")} 
            className="hover:text-[#FF6B00] transition-colors cursor-pointer"
          >
            Solutions
          </button>
          <button 
            type="button" 
            onClick={() => scrollToSection("features")} 
            className="hover:text-[#FF6B00] transition-colors cursor-pointer"
          >
            Features
          </button>
          <button 
            type="button" 
            onClick={() => scrollToSection("industries")} 
            className="hover:text-[#FF6B00] transition-colors cursor-pointer"
          >
            Industries
          </button>
          <button 
            type="button" 
            onClick={() => scrollToSection("resources")} 
            className="hover:text-[#FF6B00] transition-colors cursor-pointer"
          >
            Resources
          </button>
          <button 
            type="button" 
            onClick={() => scrollToSection("about")} 
            className="hover:text-[#FF6B00] transition-colors cursor-pointer"
          >
            About Us
          </button>
        </nav>

        {/* Right: Auth Action Buttons & Mobile Menu Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsSignInModalOpen(true)}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#07182E] hover:bg-[#0c2444] text-white font-bold text-xs sm:text-sm transition-all shadow-sm border border-slate-700/60 cursor-pointer active:scale-95"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="hidden sm:inline-block px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A00] text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-orange-500/20 cursor-pointer active:scale-95"
          >
            Get Started
          </button>
          
          {/* Mobile Menu Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Responsive Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[72px] z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xl px-6 py-5 space-y-4 animate-fadeIn">
          <nav className="flex flex-col space-y-3 text-sm font-bold text-slate-800">
            <button 
              type="button" 
              onClick={() => scrollToSection("solutions")}
              className="text-left py-1.5 hover:text-[#FF6B00] transition-colors cursor-pointer"
            >
              Solutions
            </button>
            <button 
              type="button" 
              onClick={() => scrollToSection("features")}
              className="text-left py-1.5 hover:text-[#FF6B00] transition-colors cursor-pointer"
            >
              Features
            </button>
            <button 
              type="button" 
              onClick={() => scrollToSection("industries")}
              className="text-left py-1.5 hover:text-[#FF6B00] transition-colors cursor-pointer"
            >
              Industries
            </button>
            <button 
              type="button" 
              onClick={() => scrollToSection("resources")}
              className="text-left py-1.5 hover:text-[#FF6B00] transition-colors cursor-pointer"
            >
              Resources &amp; Playbooks
            </button>
            <button 
              type="button" 
              onClick={() => scrollToSection("about")}
              className="text-left py-1.5 hover:text-[#FF6B00] transition-colors cursor-pointer"
            >
              About Project Matrix
            </button>
          </nav>
          <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSignInModalOpen(true);
              }}
              className="w-1/2 py-2.5 rounded-xl bg-[#07182E] text-white font-bold text-xs text-center cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onSwitchToSignUp();
              }}
              className="w-1/2 py-2.5 rounded-xl bg-[#FF6B00] text-white font-bold text-xs text-center cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN HERO SECTION                                                      */}
      {/* ========================================================================= */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
          
          {/* --------------------------------------------------------------------- */}
          {/* Left Column: Hero Headline, Description & CTAs                        */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-5 relative space-y-6">
            
            {/* Orange Tagline / Accent Line */}
            <div className="flex items-center gap-3">
              <span className="w-10 h-0.5 bg-[#FF6B00] rounded-full"></span>
              <span className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase text-[#FF6B00]">
                PROJECT MANAGEMENT REIMAGINED
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-[#07182E] tracking-tight leading-[1.08]">
              One Platform.<br />
              <span className="text-[#FF6B00]">Every Project.</span><br />
              Total Control.
            </h1>

            {/* Description Subtext */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg font-normal">
              Project Matrix is an intelligent project management platform that connects people, processes and data to deliver projects on time, on budget and to the highest standards.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              <button
                type="button"
                onClick={onSwitchToSignUp}
                className="px-7 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A00] text-white font-bold text-sm sm:text-base transition-all shadow-lg shadow-orange-500/25 active:scale-95 cursor-pointer"
              >
                Get Started
              </button>
              
              <button
                type="button"
                onClick={() => setIsVideoModalOpen(true)}
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-orange-50 border-2 border-[#FF6B00] text-[#FF6B00] font-bold text-sm sm:text-base flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <div className="w-5 h-5 rounded-full border-2 border-[#FF6B00] flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 fill-[#FF6B00] text-[#FF6B00] ml-0.5" />
                </div>
                <span>Watch Overview</span>
              </button>
            </div>

            {/* Quick Login Shortcut */}
            <div className="pt-2 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Already have an enterprise account?</span>
              <button
                type="button"
                onClick={() => {
                  setAuthTab("password");
                  setIsSignInModalOpen(true);
                }}
                className="font-bold text-[#FF6B00] hover:underline cursor-pointer"
              >
                Sign In
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => {
                  setAuthTab("qr");
                  setIsSignInModalOpen(true);
                }}
                className="font-bold text-[#07182E] hover:text-[#FF6B00] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>QR Code Sign In</span>
              </button>
            </div>

            {/* Orange Dot Matrix Grid Pattern (Bottom Left) */}
            <div 
              className="w-28 h-20 opacity-40 pointer-events-none mt-4"
              style={{
                backgroundImage: "radial-gradient(#FF6B00 2px, transparent 2px)",
                backgroundSize: "14px 14px"
              }}
            ></div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* Right Column: High-Fidelity Laptop Showcase of Command Centre          */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-7 relative flex justify-center">
            
            {/* Laptop Mockup Wrapper */}
            <div className="w-full max-w-3xl drop-shadow-[0_20px_40px_rgba(7,24,46,0.35)]">
              
              {/* Screen Bezel */}
              <div className="bg-[#0B1522] border-[4px] sm:border-[6px] border-[#1E293B] rounded-2xl sm:rounded-3xl p-1.5 sm:p-2.5 shadow-2xl">
                
                {/* Camera dot */}
                <div className="flex items-center justify-center pb-1 sm:pb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                </div>

                {/* Dashboard Screen Content */}
                <div className="bg-white rounded-xl overflow-hidden text-slate-800 font-sans shadow-inner select-none">
                  
                  {/* Top Header of App */}
                  <div className="bg-white border-b border-slate-100 px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ProjectMatrixBrandMark size="small" />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] text-slate-400 w-28">
                        <Search className="w-2.5 h-2.5 text-slate-400" />
                        <span>Search...</span>
                      </div>
                      <Bell className="w-3 h-3 text-slate-400" />
                      <Mail className="w-3 h-3 text-slate-400" />
                      <div className="w-5 h-5 rounded-full bg-[#07182E] text-white flex items-center justify-center text-[8.5px] font-bold">
                        TM
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Body */}
                  <div className="grid grid-cols-12 min-h-[300px] sm:min-h-[360px] text-[10px]">
                    
                    {/* Left Sidebar inside Laptop */}
                    <div className="hidden sm:block col-span-3 bg-[#FBFBFD] border-r border-slate-100 p-2 space-y-0.5">
                      <div className="px-2 py-1 rounded bg-[#FFF5EB] text-[#FF6B00] font-bold flex items-center gap-1.5 text-[9.5px]">
                        <Activity className="w-3 h-3 text-[#FF6B00]" />
                        <span>Command Centre</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <FolderGit2 className="w-3 h-3 text-slate-400" />
                        <span>Projects</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Programme</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span>Documents</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3 text-slate-400" />
                        <span>Commercial</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <Compass className="w-3 h-3 text-slate-400" />
                        <span>Engineering</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-slate-400" />
                        <span>Risk & Issues</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>Resources</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <BarChart3 className="w-3 h-3 text-slate-400" />
                        <span>Reports</span>
                      </div>
                      <div className="px-2 py-1 text-slate-600 font-medium flex items-center gap-1.5">
                        <Settings className="w-3 h-3 text-slate-400" />
                        <span>Administration</span>
                      </div>
                    </div>

                    {/* Main Content inside Laptop */}
                    <div className="col-span-12 sm:col-span-9 p-3 bg-white space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-[#07182E] text-xs">Command Centre</h4>
                        <span className="text-[8.5px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                          Live Active
                        </span>
                      </div>

                      {/* 4 Metric Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                        {/* 1. Total Projects */}
                        <div className="p-2 bg-slate-50/60 border border-slate-150 rounded-lg">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase">Total Projects</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-sm sm:text-base font-black text-[#07182E]">24</span>
                            <span className="text-[7.5px] font-bold text-emerald-600">Active</span>
                          </div>
                        </div>

                        {/* 2. Projects on Track */}
                        <div className="p-2 bg-slate-50/60 border border-slate-150 rounded-lg">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase">Projects on Track</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-sm sm:text-base font-black text-[#07182E]">16</span>
                            <span className="text-[7.5px] font-bold text-emerald-600">67%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1 rounded-full mt-1 overflow-hidden">
                            <div className="bg-emerald-500 h-full w-[67%] rounded-full"></div>
                          </div>
                        </div>

                        {/* 3. Overdue Tasks */}
                        <div className="p-2 bg-slate-50/60 border border-slate-150 rounded-lg">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase">Overdue Tasks</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-sm sm:text-base font-black text-red-600">8</span>
                          </div>
                        </div>

                        {/* 4. Budget Performance */}
                        <div className="p-2 bg-slate-50/60 border border-slate-150 rounded-lg">
                          <span className="text-[7.5px] font-bold text-slate-400 uppercase">Budget Performance</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-sm sm:text-base font-black text-[#07182E]">92%</span>
                            <span className="text-[7.5px] font-bold text-emerald-600">On Track</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle Graphs Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Donut Progress */}
                        <div className="p-2 bg-slate-50/40 border border-slate-150 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="text-[8.5px] font-bold text-slate-700 block">Project Performance</span>
                            <div className="mt-1 space-y-0.5 text-[7.5px] text-slate-500 font-medium">
                              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> On Track: 16</div>
                              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> At Risk: 6</div>
                              <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Off Track: 2</div>
                            </div>
                          </div>
                          {/* Circular Gauge */}
                          <div className="w-12 h-12 rounded-full border-[3px] border-emerald-500 border-r-amber-500 border-b-red-500 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-black text-[#07182E]">72%</span>
                            <span className="text-[5px] font-bold text-slate-400 uppercase leading-none">Progress</span>
                          </div>
                        </div>

                        {/* Stage Distribution Bars */}
                        <div className="p-2 bg-slate-50/40 border border-slate-150 rounded-lg">
                          <span className="text-[8.5px] font-bold text-slate-700 block mb-1">Projects by Stage</span>
                          <div className="flex items-end justify-between gap-1.5 h-9 px-1">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-bold text-slate-600">4</span>
                              <div className="w-3.5 bg-[#07182E] rounded-t" style={{ height: "12px" }}></div>
                              <span className="text-[6px] text-slate-400">Initiation</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-bold text-slate-600">6</span>
                              <div className="w-3.5 bg-[#07182E] rounded-t" style={{ height: "18px" }}></div>
                              <span className="text-[6px] text-slate-400">Planning</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-bold text-[#FF6B00]">10</span>
                              <div className="w-3.5 bg-[#FF6B00] rounded-t" style={{ height: "28px" }}></div>
                              <span className="text-[6px] font-bold text-[#FF6B00]">Execution</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-bold text-slate-600">4</span>
                              <div className="w-3.5 bg-[#07182E] rounded-t" style={{ height: "12px" }}></div>
                              <span className="text-[6px] text-slate-400">Closing</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Lists Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[8px]">
                        {/* My Actions */}
                        <div className="p-2 bg-slate-50/40 border border-slate-150 rounded-lg space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-700 text-[8.5px]">
                            <span>My Actions</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <div>
                              <p className="font-semibold text-slate-800 truncate max-w-[100px]">Review Variation Request</p>
                              <p className="text-[7px] text-slate-400">Riverside Bridge Project</p>
                            </div>
                            <span className="text-[#FF6B00] font-bold">Due Today</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600">
                            <div>
                              <p className="font-semibold text-slate-800 truncate max-w-[100px]">Approve Material Submittal</p>
                              <p className="text-[7px] text-slate-400">Water Treatment Plant</p>
                            </div>
                            <span className="text-[#FF6B00] font-bold">Due Tomorrow</span>
                          </div>
                          <div className="text-right pt-0.5">
                            <span className="text-[#FF6B00] font-bold cursor-pointer text-[7.5px]">View All</span>
                          </div>
                        </div>

                        {/* Recent Projects */}
                        <div className="p-2 bg-slate-50/40 border border-slate-150 rounded-lg space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-700 text-[8.5px]">
                            <span>Recent Projects</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 truncate">
                              <div className="w-3 h-3 rounded bg-orange-100 text-[#FF6B00] flex items-center justify-center text-[7px] font-bold">C</div>
                              <span className="font-semibold text-slate-800 truncate max-w-[90px]">Riverside Bridge</span>
                            </div>
                            <span className="font-bold text-slate-700">78%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 truncate">
                              <div className="w-3 h-3 rounded bg-blue-100 text-[#07182E] flex items-center justify-center text-[7px] font-bold">A</div>
                              <span className="font-semibold text-slate-800 truncate max-w-[90px]">Water Treatment Plant</span>
                            </div>
                            <span className="font-bold text-slate-700">55%</span>
                          </div>
                          <div className="text-right pt-0.5">
                            <span className="text-[#FF6B00] font-bold cursor-pointer text-[7.5px]">View All</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>

              {/* Laptop Metal Base Stand */}
              <div className="h-3 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600 rounded-b-xl max-w-[88%] mx-auto shadow-xl"></div>
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* 3. PLATFORM BENEFITS ROW (5 Pillars with Orange Icons)                     */}
        {/* ========================================================================= */}
        <div className="mt-12 sm:mt-16 pt-8 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            
            {/* 1. Integrated Platform */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#07182E] tracking-tight">Integrated Platform</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">All project data in one connected ecosystem.</p>
              </div>
            </div>

            {/* 2. Smarter Collaboration */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#07182E] tracking-tight">Smarter Collaboration</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">Empower teams to collaborate in real time.</p>
              </div>
            </div>

            {/* 3. Data-Driven Decisions */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#07182E] tracking-tight">Data-Driven Decisions</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">Real-time insights for better project outcomes.</p>
              </div>
            </div>

            {/* 4. Secure & Reliable */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#07182E] tracking-tight">Secure & Reliable</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">Enterprise-grade security you can trust.</p>
              </div>
            </div>

            {/* 5. Anywhere Access */}
            <div className="flex items-start gap-3.5 sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0 shadow-xs">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#07182E] tracking-tight">Anywhere Access</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">Work from anywhere, any device.</p>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. TRUSTED BY BANNER (Matching Reference Image)                          */}
        {/* ========================================================================= */}
        <div className="mt-8 mb-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            <span className="font-bold text-xs sm:text-sm text-[#07182E] shrink-0">
              Trusted by project-driven organizations
            </span>

            <div className="flex items-center flex-wrap gap-4 sm:gap-8 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-2">
                <HardHat className="w-4 h-4 text-[#FF6B00]" />
                <span>Construction</span>
              </div>
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#FF6B00]" />
                <span>Engineering</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#FF6B00]" />
                <span>Infrastructure</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#FF6B00]" />
                <span>Energy</span>
              </div>
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#FF6B00]" />
                <span>Government</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#FF6B00]" />
                <span>Consulting</span>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 5. SOLUTIONS, FEATURES, INDUSTRIES, RESOURCES & ABOUT US SECTIONS         */}
      {/* ========================================================================= */}
      <SolutionsSection 
        onOpenSignIn={() => setIsSignInModalOpen(true)} 
        onOpenSignUp={onSwitchToSignUp} 
      />

      <FeaturesSection 
        onOpenSignIn={() => setIsSignInModalOpen(true)} 
        onOpenSignUp={onSwitchToSignUp} 
      />

      <IndustriesSection 
        onOpenSignIn={() => setIsSignInModalOpen(true)} 
        onOpenSignUp={onSwitchToSignUp} 
      />

      <ResourcesSection 
        onOpenSignIn={() => setIsSignInModalOpen(true)} 
        onOpenSignUp={onSwitchToSignUp} 
      />

      <AboutUsSection 
        onOpenSignIn={() => setIsSignInModalOpen(true)} 
        onOpenSignUp={onSwitchToSignUp} 
      />

      <LandingFooter 
        onOpenSignIn={() => setIsSignInModalOpen(true)} 
        onOpenSignUp={onSwitchToSignUp} 
      />

      {/* ========================================================================= */}
      {/* 5. ENTERPRISE SIGN-IN MODAL DIALOG (Interactive Authentication Overlay)   */}
      {/* ========================================================================= */}
      {isSignInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07182E]/70 backdrop-blur-sm animate-fadeIn">
          
          <div 
            className="w-full max-w-md sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-150 relative animate-scaleUp scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsSignInModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close sign in dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="mb-5">
              <ProjectMatrixBrandMark />
              <h2 className="text-xl sm:text-2xl font-black text-[#07182E] mt-4 tracking-tight">
                Welcome back
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Authenticate with your company credentials or scan with the Project Matrix mobile app.
              </p>
            </div>

            {/* Authentication Method Selector Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 mb-5 border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setAuthTab("password");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  authTab === "password"
                    ? "bg-white text-[#07182E] shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Password</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthTab("qr");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  authTab === "qr"
                    ? "bg-white text-[#07182E] shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>QR Code</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" title="Live dynamic QR active" />
              </button>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMsg}</div>
              </div>
            )}

            {/* TAB CONTENT 1: WORK EMAIL & PASSWORD */}
            {authTab === "password" && (
              <div className="space-y-4 animate-fadeIn">
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Work Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Work Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        required
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-[#07182E] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignInModalOpen(false);
                          onForgotPassword();
                        }}
                        className="text-xs font-bold text-[#FF6B00] hover:text-[#e05e00] transition-colors cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-[#07182E] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberEmail}
                        onChange={(e) => setRememberEmail(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#FF6B00] focus:ring-[#FF6B00]/20 cursor-pointer accent-[#FF6B00]"
                      />
                      <span>Remember me</span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A00] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Project Matrix</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider to QR Code Sign-In Card */}
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    OR SIGN IN WITH QR CODE
                  </span>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>

                {/* QR Code Sign-In Card Below Login Form */}
                <QrSignInCard 
                  onSuccess={() => setIsSignInModalOpen(false)} 
                />
              </div>
            )}

            {/* TAB CONTENT 2: DEDICATED QR CODE SIGN-IN VIEW */}
            {authTab === "qr" && (
              <div className="animate-fadeIn">
                <QrSignInCard 
                  onSuccess={() => setIsSignInModalOpen(false)} 
                />
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Don't have an enterprise account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignInModalOpen(false);
                    onSwitchToSignUp();
                  }}
                  className="font-bold text-[#FF6B00] hover:underline cursor-pointer"
                >
                  Get Started
                </button>
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PLATFORM OVERVIEW MODAL                                                */}
      {/* ========================================================================= */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07182E]/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-150 relative animate-scaleUp">
            <button
              type="button"
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]"></span>
              <h3 className="text-lg font-black text-[#07182E]">Project Matrix Command Centre Overview</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
              Explore how Project Matrix unifies Commercial Management, Engineering Programme execution, Document Control, Subcontractor Management, and Executive Dashboards under one connected platform.
            </p>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-[#07182E]">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Automated NEC3 / FIDIC Variation and Compensation Event workflows</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-[#07182E]">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Real-time Earned Value Analysis (EVA) & Cost-Value Reconciliation (CVR)</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-[#07182E]">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Live Gantt critical path scheduling & daily progress diaries</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-[#07182E]">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Complete multi-tenant corporate hierarchy & project-level role permissions</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsVideoModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsVideoModalOpen(false);
                  setIsSignInModalOpen(true);
                }}
                className="px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A00] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Sign In Now
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SignInPage;
