import React, { useState, useRef, useEffect } from "react";
import { Bell, Settings, LogOut, ChevronDown, User, Shield, Briefcase, Building, Moon, Sun, Menu, Search, Sparkles } from "lucide-react";
import ProjectMatrixLogo from "../ProjectMatrixLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import CurrencySwitcher from "./CurrencySwitcher";

interface TopbarProps {
  profile: any;
  activeCompany: any;
  allCompanies?: any[];
  activeProject: any;
  allProjects: any[];
  onProjectChange: (proj: any) => void;
  onCompanyChange?: (comp: any) => void;
  onSignOut: () => void;
  onSettingsClick: () => void;
  onOpenCommandPalette?: () => void;
  onOpenAdvisor?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  companyPersonnel?: any[];
}

export default function Topbar({
  profile,
  activeCompany,
  allCompanies = [],
  activeProject,
  allProjects,
  onProjectChange,
  onCompanyChange,
  onSignOut,
  onSettingsClick,
  onOpenCommandPalette,
  onOpenAdvisor,
  isDarkMode = false,
  onToggleDarkMode,
  isMobileOpen,
  setIsMobileOpen,
  companyPersonnel = []
}: TopbarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Find active member in company_members using logged-in user's profile ID
  const activeMember = companyPersonnel.find((p: any) => p.profile_id === profile?.id);
  const userDesignation = activeMember?.designation || profile?.role || "Viewer";

  const userInitials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : "U";

  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[#1E293B] bg-[#0B172A] px-4 sm:px-6 text-[#F8FAFC] shadow-sm" id="projectmatrix-topbar">
      {/* Left side: Hamburger, Logo & Selectors */}
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Mobile Hamburger menu */}
        <button
          onClick={() => setIsMobileOpen?.(!isMobileOpen)}
          className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-[#1E293B] bg-[#0B172A] text-[#94A3B8] hover:bg-[#162238] hover:text-white transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-24 sm:w-36 flex items-center shrink-0">
          <ProjectMatrixLogo />
        </div>
        
        <div className="h-6 w-px bg-[#1E293B] hidden md:block" />

        {/* Project Selectors */}
        <div className="hidden sm:flex items-center gap-3 max-w-[200px] md:max-w-md lg:max-w-xl">
          <div className="relative flex items-center gap-1.5 text-xs text-[#94A3B8] font-medium min-w-0 shrink">
            <Building className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            <select
              value={activeCompany?.id || ""}
              onChange={(e) => {
                const selected = allCompanies.find((c) => c.id === e.target.value);
                if (selected && onCompanyChange) onCompanyChange(selected);
              }}
              className="bg-transparent border-0 text-xs font-semibold text-white focus:ring-0 focus:outline-none pr-6 pl-1 py-1 cursor-pointer hover:text-amber-400 transition-colors truncate max-w-[90px] md:max-w-[150px] lg:max-w-[180px]"
            >
              {allCompanies.length > 0 ? (
                allCompanies.map((comp) => (
                  <option key={comp.id} value={comp.id} className="text-slate-800 bg-white">
                    {comp.name}
                  </option>
                ))
              ) : (
                <option value="" className="text-slate-800 bg-white">
                  {activeCompany?.name || "No Company"}
                </option>
              )}
            </select>
          </div>

          <div className="h-4 w-px bg-[#1E293B] shrink-0" />

          <div className="relative flex items-center gap-1 min-w-0 shrink">
            <Briefcase className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            <select
              value={activeProject?.id || ""}
              onChange={(e) => {
                const selected = allProjects.find((p) => p.id === e.target.value);
                if (selected) onProjectChange(selected);
              }}
              className="bg-transparent border-0 text-xs font-semibold text-white focus:ring-0 focus:outline-none pr-6 pl-1 py-1 cursor-pointer hover:text-amber-400 transition-colors truncate max-w-[90px] md:max-w-[150px] lg:max-w-[240px]"
            >
              {allProjects.length > 0 ? (
                allProjects.map((proj) => (
                  <option key={proj.id} value={proj.id} className="text-slate-800 bg-white">
                    [{proj.code || proj.contract_code}] {proj.name}
                  </option>
                ))
              ) : (
                <option value="" className="text-slate-800 bg-white">No Projects Found</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Right side: Utilities & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Persistent ✦ Ask Matrix Operating Model AI Button */}
        <button
          onClick={onOpenAdvisor}
          className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 bg-gradient-to-r from-amber-500 via-amber-450 to-blue-600 hover:from-amber-400 hover:to-blue-500 text-slate-950 font-black rounded-xl transition-all text-xs cursor-pointer shadow-md hover:shadow-lg shadow-amber-500/20 active:scale-95 shrink-0 group border border-amber-300/40"
          title="Open Matrix Advisor (Operating Model AI)"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950 animate-pulse" />
          <span className="tracking-tight uppercase">✦ Ask Matrix</span>
          <span className="hidden xl:inline-block px-1.5 py-0.2 bg-slate-950/20 text-slate-950 rounded text-[9px] font-mono font-bold">
            AI
          </span>
        </button>

        {/* Universal Search Command Bar Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 bg-[#162238] hover:bg-[#1E293B] text-[#94A3B8] hover:text-white border border-[#1E293B] rounded-xl transition-all text-xs cursor-pointer shadow-xs"
          title="Search ProjectMatrix (⌘K or Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">Search...</span>
          <span className="ml-1 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#0B172A] text-slate-400 rounded border border-slate-700">
            ⌘K
          </span>
        </button>

        {/* Regional Currency Selector Dropdown */}
        <CurrencySwitcher />

        {/* Multilingual Selector Dropdown */}
        <LanguageSwitcher />

        {/* Notification Bell */}
        <div className="relative" ref={notificationsRef} id="header-notifications-dropdown">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-expanded={showNotifications}
            aria-label="View notifications"
            className="relative rounded-full p-2 text-[#94A3B8] hover:bg-[#162238] hover:text-white transition-colors cursor-pointer"
          >
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#F59E0B] ring-2 ring-[#0B172A]" />
          </button>

          {showNotifications && (
            <div 
              role="region"
              aria-label="Notifications Panel"
              className="header-dropdown absolute right-0 top-full mt-2 w-80 sm:w-96 min-w-[280px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#1E3A5F] bg-[#07182E] p-3.5 shadow-2xl ring-1 ring-black/50 animate-fadeIn z-50"
            >
              <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-2.5 mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Site Notifications</h4>
                <span className="text-[10px] text-[#F59E0B] font-semibold cursor-pointer hover:underline">Mark all read</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex gap-3 p-2 rounded-xl hover:bg-[#102846] transition-colors cursor-pointer border border-transparent hover:border-[#1E3A5F]">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">Contract Possession Approved</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Project matrix possession complete.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-2 rounded-xl hover:bg-[#102846] transition-colors cursor-pointer border border-transparent hover:border-[#1E3A5F]">
                  <div className="h-2 w-2 rounded-full bg-[#F59E0B] mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">New Site Diary Added</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Sipho Nkosi logged machinery status.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Night Mode Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="rounded-full p-2 text-[#94A3B8] hover:bg-[#162238] hover:text-white transition-colors cursor-pointer"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
        >
          {isDarkMode ? (
            <Sun className="h-4.5 w-4.5 text-[#F59E0B]" />
          ) : (
            <Moon className="h-4.5 w-4.5" />
          )}
        </button>

        {/* Quick Settings */}
        <button
          onClick={onSettingsClick}
          className="rounded-full p-2 text-[#94A3B8] hover:bg-[#162238] hover:text-white transition-colors hidden sm:block cursor-pointer"
          title="App Settings"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>

        <div className="h-5 w-px bg-[#1E293B]" />

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef} id="header-profile-menu">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
            aria-label="User Account Menu"
            className="flex items-center gap-1.5 rounded-full p-1 hover:bg-[#162238] transition-colors focus:outline-none cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#162238] border border-[#1E293B] text-xs font-bold text-white shadow-xs hover:border-[#F59E0B] transition-all duration-200">
              {userInitials}
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-[#94A3B8] transition-transform duration-200 ${showProfileMenu ? "rotate-180 text-amber-400" : ""}`} />
          </button>

          {showProfileMenu && (
            <div 
              role="menu"
              aria-label="User Profile Options"
              className="header-dropdown absolute right-0 top-full mt-2 w-64 sm:w-72 min-w-[260px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#1E3A5F] bg-[#07182E] p-2 shadow-2xl ring-1 ring-black/50 animate-fadeIn z-50 text-slate-200"
            >
              {/* User Identity Header */}
              <div className="px-3.5 py-3 border-b border-[#1E3A5F] mb-1.5">
                <p className="text-xs font-bold text-white truncate">
                  {profile?.full_name || profile?.name || "Authenticated User"}
                </p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                  {profile?.email || "user@projectmatrix.com"}
                </p>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#162238] px-2 py-0.5 text-[9px] font-bold text-amber-400 border border-slate-700 uppercase tracking-wider">
                    <Shield className="w-3 h-3 text-[#F59E0B]" />
                    {userDesignation}
                  </span>
                  {profile?.company && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                      {profile.company}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Menu Actions */}
              <div className="space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowProfileMenu(false); onSettingsClick(); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 rounded-xl text-left text-xs font-medium text-slate-200 hover:bg-[#102846] hover:text-white transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="whitespace-nowrap">Profile & Regional Settings</span>
                </button>
                
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowProfileMenu(false); onSettingsClick(); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 rounded-xl text-left text-xs font-medium text-slate-200 hover:bg-[#102846] hover:text-white transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="whitespace-nowrap">System Preferences</span>
                </button>
              </div>
              
              {/* Sign Out Action */}
              <div className="mt-1 pt-1 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowProfileMenu(false); onSignOut(); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 rounded-xl text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
