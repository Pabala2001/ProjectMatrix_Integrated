import React, { useState, useRef, useEffect } from "react";
import { Coins, ChevronDown, Check, Search, Globe, Filter } from "lucide-react";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import {
  SUPPORTED_CURRENCIES,
  SupportedCurrency,
  CURRENCY_REGIONS,
  CurrencyRegion,
  getCurrencyInfo,
  searchCurrencies
} from "../../config/currencies";

interface CurrencySwitcherProps {
  variant?: "header" | "compact" | "pill" | "inline";
  className?: string;
  showLabel?: boolean;
}

export default function CurrencySwitcher({
  variant = "header",
  className = "",
  showLabel = true
}: CurrencySwitcherProps) {
  const { currencyCode, setCurrencyCode } = useRegionalSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<CurrencyRegion | "ALL">("ALL");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentInfo = getCurrencyInfo(currencyCode);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectCurrency = (code: SupportedCurrency) => {
    setCurrencyCode(code);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Filter currencies by search and region
  const filteredCurrencies = searchCurrencies(searchQuery).filter((c) => {
    if (selectedRegion === "ALL") return true;
    return c.region === selectedRegion;
  });

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} id="header-currency-switcher">
      {/* Header Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Change regional currency. Current: ${currentInfo.name}`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#1E3A5F] bg-[#07182E]/80 hover:bg-[#102846] text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]/40 ${
          isOpen ? "ring-2 ring-[#FF9F1C]/50 border-[#FF9F1C]/60 bg-[#102846]" : ""
        }`}
        title={`Active Currency: ${currentInfo.name} (${currentInfo.code} — ${currentInfo.symbol})`}
      >
        <span className="text-sm leading-none select-none">{currentInfo.flag}</span>
        <span className="font-mono text-[11px] uppercase font-bold text-amber-400 tracking-wider">
          {currentInfo.symbol}
        </span>
        {showLabel && (
          <span className="hidden md:inline-block font-mono text-[11px] font-bold text-slate-300">
            {currentInfo.code}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#FF9F1C]" : ""
          }`}
        />
      </button>

      {/* Currency Selector Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Supported African & Global Currencies"
          className="header-dropdown absolute top-full mt-2 w-80 sm:w-96 min-w-[320px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#1E3A5F] bg-[#07182E] p-3 shadow-2xl ring-1 ring-black/50 animate-fadeIn z-50 right-0 max-h-[85vh] flex flex-col"
        >
          {/* Dropdown Header */}
          <div className="px-1 py-1 border-b border-[#1E3A5F] pb-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 shrink-0">
              <Coins className="w-4 h-4 text-[#FF9F1C]" />
              <div>
                <span className="text-xs font-bold text-slate-100 uppercase tracking-wider block whitespace-nowrap">
                  Regional Currency
                </span>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                  {SUPPORTED_CURRENCIES.length} African & International Currencies
                </span>
              </div>
            </div>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 shrink-0">
              Active: {currentInfo.code}
            </span>
          </div>

          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search currency, country, or code (e.g. ZAR, Shilling, Nigeria)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0A1F38] border border-[#1E3A5F] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#FF9F1C] focus:ring-1 focus:ring-[#FF9F1C]/20"
              autoFocus
            />
          </div>

          {/* Region Tabs / Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 scrollbar-thin text-[10px] font-semibold text-slate-400">
            <button
              type="button"
              onClick={() => setSelectedRegion("ALL")}
              className={`px-2 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                selectedRegion === "ALL"
                  ? "bg-[#FF9F1C] text-slate-950 font-bold"
                  : "bg-[#0A1F38] hover:bg-[#102846] text-slate-300"
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
                  onClick={() => setSelectedRegion(reg)}
                  className={`px-2 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    selectedRegion === reg
                      ? "bg-[#FF9F1C] text-slate-950 font-bold"
                      : "bg-[#0A1F38] hover:bg-[#102846] text-slate-300"
                  }`}
                >
                  {reg} ({count})
                </button>
              );
            })}
          </div>

          {/* Currency List */}
          <div className="overflow-y-auto max-h-64 space-y-1 pr-1 scrollbar-thin">
            {filteredCurrencies.length > 0 ? (
              filteredCurrencies.map((curr) => {
                const isSelected = curr.code === currencyCode;
                return (
                  <button
                    key={curr.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectCurrency(curr.code)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#FF9F1C]/15 border border-[#FF9F1C]/40 text-white"
                        : "hover:bg-[#0A1F38] text-slate-300 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none select-none shrink-0">{curr.flag}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-white whitespace-nowrap">{curr.code}</span>
                          <span className="font-mono text-[11px] text-amber-400 font-semibold whitespace-nowrap">({curr.symbol})</span>
                          <span className="text-[9px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded whitespace-nowrap">
                            {curr.region}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 truncate">{curr.name}</p>
                        <p className="text-[9px] text-slate-400 truncate">{curr.country}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#FF9F1C] text-slate-950 flex items-center justify-center shrink-0 shadow-sm ml-2">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                No currencies match "{searchQuery}"
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-2 mt-2 border-t border-[#1E3A5F] text-[10px] text-slate-400 flex items-center justify-between">
            <span>Updates all bills, ledgers, & BOQs</span>
            <span className="font-mono text-amber-400 font-bold">{filteredCurrencies.length} found</span>
          </div>
        </div>
      )}
    </div>
  );
}
