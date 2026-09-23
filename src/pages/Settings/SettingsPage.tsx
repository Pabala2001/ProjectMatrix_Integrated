import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Settings, Globe, Bell, User, Mail, AlertTriangle, CheckCircle2, Search, X, Database, Copy, Check, Coins } from "lucide-react";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import {
  SUPPORTED_CURRENCIES,
  SupportedCurrency,
  CURRENCY_REGIONS,
  CurrencyRegion,
  getCurrencyInfo,
  searchCurrencies
} from "../../config/currencies";
import { getAllTimezones } from "../../config/timezones";
import { CONTRACT_FRAMEWORKS, ContractFramework } from "../../config/contracts";

interface Toast {
  title: string;
  message: string;
  type: "success" | "error";
}

export default function SettingsPage() {
  const { profile, activeCompany, companyPersonnel } = useOutletContext<any>();
  
  const activeMember = (companyPersonnel || []).find((p: any) => p.profile_id === profile?.id);
  const userDesignation = activeMember?.designation || profile?.role || "Viewer";

  const {
    currencyCode,
    timezone,
    setCurrencyCode,
    setTimezone,
    complianceFramework,
    setComplianceFramework
  } = useRegionalSettings();

  const [emailAlerts, setEmailAlerts] = useState(true);

  // Search and region filter for currency
  const [currencySearch, setCurrencySearch] = useState("");
  const [currencyRegionFilter, setCurrencyRegionFilter] = useState<CurrencyRegion | "ALL">("ALL");

  // Filtered currencies
  const filteredCurrencies = searchCurrencies(currencySearch).filter((c) => {
    if (currencyRegionFilter === "ALL") return true;
    return c.region === currencyRegionFilter;
  });

  const activeCurrencyInfo = getCurrencyInfo(currencyCode);

  // Search filter for timezone
  const [tzSearch, setTzSearch] = useState("");
  const allTimezones = getAllTimezones();
  
  // Custom Confirmation Dialog state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<SupportedCurrency | null>(null);

  // Inline Notification toast state
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (title: string, message: string, type: "success" | "error") => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCurrencySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value as SupportedCurrency;
    if (selectedVal === currencyCode) return;
    setPendingCurrency(selectedVal);
    setIsConfirmOpen(true);
  };

  const confirmCurrencyChange = async () => {
    if (!pendingCurrency) return;
    const previous = currencyCode;
    setIsConfirmOpen(false);
    
    const success = await setCurrencyCode(pendingCurrency);
    if (success) {
      showToast(
        "Currency Updated",
        `Application-wide currency has been configured to ${pendingCurrency}.`,
        "success"
      );
    } else {
      showToast(
        "Sync Failure",
        `Failed to save currency to the database. The previous currency (${previous}) has been restored.`,
        "error"
      );
    }
    setPendingCurrency(null);
  };

  const cancelCurrencyChange = () => {
    setIsConfirmOpen(false);
    setPendingCurrency(null);
  };

  const handleTimezoneChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
    const previous = timezone;
    const success = await setTimezone(selectedVal);
    if (success) {
      showToast(
        "Timezone Synced",
        `Regional operational clock set to ${selectedVal}.`,
        "success"
      );
    } else {
      showToast(
        "Sync Failure",
        `Failed to save timezone to the database. The previous timezone (${previous}) has been restored.`,
        "error"
      );
    }
  };

  // Filter timezones
  const filteredTimezones = allTimezones.filter(tz =>
    tz.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
    tz.value.toLowerCase().includes(tzSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn relative">
      {/* Toast Notification */}
      {toast && (
        <div
          id="settings-toast"
          className={`fixed top-4 right-4 z-50 flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-md animate-slideIn ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <CheckCircle2 className={`w-5 h-5 shrink-0 ${toast.type === "success" ? "text-emerald-500" : "text-rose-500"}`} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">{toast.title}</p>
            <p className="text-xs mt-0.5 opacity-90">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 transition-colors ml-auto shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.03)]">
        <h1 className="text-xl font-extrabold text-[#07182E] tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#FF9F1C]" />
          Settings & Preferences
        </h1>
        <p className="text-xs text-[#64748B] mt-1">Configure your ProjectMatrix preferences, currency formats, timezone compliance, and contract parameters.</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Configurations content */}
        <div className="space-y-6">
          {/* User Details */}
          <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest border-b border-slate-100 pb-2">Logged-In Profile</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FF9F1C] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-[#FF9F1C]/20 shrink-0">
                {profile?.full_name ? profile.full_name.split(" ").map((n: string) => n[0]).join("") : "U"}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#07182E] flex items-center gap-1.5">
                  {profile?.full_name}
                  <span className="px-2 py-0.5 bg-[#102846]/10 text-[#102846] border border-[#102846]/20 rounded-full text-[9px] font-bold uppercase tracking-wider">
                    {userDesignation}
                  </span>
                </p>
                <p className="text-xs text-[#64748B] font-semibold flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {profile?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Company Profile */}
          {activeCompany && (
            <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest border-b border-slate-100 pb-2">Company Profile</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Name</span>
                    <span className="text-xs font-semibold text-slate-700">{activeCompany.name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Identification Number</span>
                    <span className="text-xs font-semibold text-slate-700">{activeCompany.vat_number || "N/A"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-2">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registration Number</span>
                    <span className="text-xs font-semibold text-slate-700">{activeCompany.registration_number || "N/A"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract Compliance Framework</span>
                    <span className="px-2 py-0.5 mt-0.5 inline-block bg-[#FF9F1C]/10 text-[#FF9F1C] border border-[#FF9F1C]/20 rounded-full text-[10px] font-bold">
                      {complianceFramework}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ERP Settings */}
          <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest border-b border-slate-100 pb-2">ERP Regional Configuration</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Currency Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Standard Currency Format
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {SUPPORTED_CURRENCIES.length} Supported Currencies
                  </span>
                </div>

                {/* Active Currency Badge / Info Card */}
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl leading-none select-none">{activeCurrencyInfo.flag}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800">{activeCurrencyInfo.code}</span>
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-1.5 py-0.2 rounded font-mono">
                          {activeCurrencyInfo.symbol}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold">
                          {activeCurrencyInfo.region}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">{activeCurrencyInfo.name}</p>
                      <p className="text-[10px] text-slate-400">{activeCurrencyInfo.country}</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Benchmark Rate</span>
                    <span className="text-xs font-mono font-bold text-slate-700">1 {activeCurrencyInfo.code} ≈ ${activeCurrencyInfo.rateToUSD} USD</span>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search currencies by country, name, or code (e.g. Rand, Naira, TZS, Egypt)..."
                    value={currencySearch}
                    onChange={(e) => setCurrencySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 bg-slate-50 text-xs rounded-lg focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Region Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin text-[10px] font-semibold text-slate-500">
                  <button
                    type="button"
                    onClick={() => setCurrencyRegionFilter("ALL")}
                    className={`px-2 py-0.8 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                      currencyRegionFilter === "ALL"
                        ? "bg-[#FF9F1C] text-slate-950 font-bold"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    All ({SUPPORTED_CURRENCIES.length})
                  </button>
                  {CURRENCY_REGIONS.map((reg) => {
                    const count = SUPPORTED_CURRENCIES.filter((c) => c.region === reg).length;
                    return (
                      <button
                        key={reg}
                        type="button"
                        onClick={() => setCurrencyRegionFilter(reg)}
                        className={`px-2 py-0.8 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                          currencyRegionFilter === reg
                            ? "bg-[#FF9F1C] text-slate-950 font-bold"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        {reg} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Currency Dropdown Selection */}
                <select
                  value={currencyCode}
                  onChange={handleCurrencySelect}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none cursor-pointer"
                >
                  {filteredCurrencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.flag} {curr.code} ({curr.symbol}) — {curr.name} [{curr.region}]
                    </option>
                  ))}
                  {filteredCurrencies.length === 0 && (
                    <option disabled value="">
                      No matching currencies found
                    </option>
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Updates all financial displays, cost trackers, reports, BOQs, and exports automatically.</p>
              </div>

              {/* Timezone Selector (with search box) */}
              <div className="space-y-1 pt-2 border-t border-slate-50">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Timezone Location</label>
                
                {/* Search Box */}
                <div className="relative mb-2">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Filter timezones (e.g. Nairobi, Maseru, London)..."
                    value={tzSearch}
                    onChange={(e) => setTzSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 bg-slate-50 text-xs rounded-lg focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <select
                  value={timezone}
                  onChange={handleTimezoneChange}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none cursor-pointer"
                >
                  {filteredTimezones.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                  {filteredTimezones.length === 0 && (
                    <option disabled value="">No matching timezones found</option>
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Controls "Today" indicators and aligns creation timestamps in generated reports.</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-50">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contract Compliance Framework</label>
              <select
                value={complianceFramework}
                onChange={(e) => setComplianceFramework(e.target.value as ContractFramework)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none cursor-pointer"
              >
                {CONTRACT_FRAMEWORKS.map((framework) => (
                  <option key={framework} value={framework}>
                    {framework}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notification System Preferences */}
          <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-widest border-b border-slate-100 pb-2">Notice Alarm Preferences</h3>
            <div className="space-y-3.5 text-xs font-semibold text-slate-600">
              <div className="flex items-center justify-between p-1">
                <div>
                  <p className="text-slate-800">Email notice delivery</p>
                  <p className="text-[10px] text-[#64748B] font-medium">Deliver daily summaries of RFI escalations and site events to your email.</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-slate-300 text-[#FF9F1C] focus:ring-[#FF9F1C] accent-[#FF9F1C] cursor-pointer font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Custom Confirmation Modal */}
      {isConfirmOpen && (
        <div id="currency-confirm-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-center text-amber-500">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wider">Confirm Currency Shift</h3>
                <p className="text-xs text-[#64748B]">
                  Changing the project currency will update how all monetary values are labelled and displayed. Existing amounts will not be converted using an exchange rate.
                </p>
              </div>

              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-[10px] font-bold text-amber-800 leading-relaxed">
                Warning: Display labels will update to reflect {pendingCurrency}, but absolute values inside the project database remain unchanged.
              </div>
            </div>
            
            <div className="flex justify-end gap-2.5 p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={cancelCurrencyChange}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmCurrencyChange}
                className="px-3.5 py-1.5 text-xs font-extrabold text-white bg-[#FF9F1C] hover:bg-[#F3910E] rounded-xl transition-all shadow-md shadow-[#FF9F1C]/10 cursor-pointer"
              >
                Change Currency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
