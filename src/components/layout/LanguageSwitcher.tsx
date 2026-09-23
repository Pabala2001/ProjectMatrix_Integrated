import React, { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check, Languages } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { LanguageCode } from "../../types/language";

interface LanguageSwitcherProps {
  variant?: "header" | "compact" | "pill" | "inline";
  className?: string;
  showLabel?: boolean;
}

export default function LanguageSwitcher({
  variant = "header",
  className = "",
  showLabel = true
}: LanguageSwitcherProps) {
  const { currentLanguage, setLanguage, languages, currentLanguageInfo, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSelectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} id="header-language-switcher">
      {/* Header Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Change language. Current: ${currentLanguageInfo.name}`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#1E3A5F] bg-[#07182E]/80 hover:bg-[#102846] text-xs font-semibold text-[#CBD5E1] hover:text-white transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]/40 ${
          isOpen ? "ring-2 ring-[#FF9F1C]/50 border-[#FF9F1C]/60 bg-[#102846]" : ""
        }`}
        title={`Language: ${currentLanguageInfo.name} (${currentLanguageInfo.nativeName})`}
      >
        <span className="text-sm leading-none select-none">{currentLanguageInfo.flag}</span>
        {showLabel && (
          <span className="hidden sm:inline-block font-mono text-[11px] uppercase font-bold text-slate-200 tracking-wider">
            {currentLanguageInfo.code}
          </span>
        )}
        <ChevronDown 
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#FF9F1C]" : ""
          }`} 
        />
      </button>

      {/* Language Selector Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Supported Languages"
          className={`header-dropdown absolute top-full mt-2 w-72 sm:w-80 min-w-[280px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#1E3A5F] bg-[#07182E] p-2.5 shadow-2xl ring-1 ring-black/50 animate-fadeIn z-50 ${
            isRTL ? "left-0" : "right-0"
          }`}
        >
          {/* Dropdown Header */}
          <div className="px-3 py-2 border-b border-[#1E3A5F] mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 shrink-0">
              <Languages className="w-3.5 h-3.5 text-[#FF9F1C]" />
              <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider whitespace-nowrap">
                Language / Corridor
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 shrink-0">
              {languages.length} Languages
            </span>
          </div>

          {/* Language Options List */}
          <div className="space-y-1">
            {languages.map((lang) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer group ${
                    isSelected
                      ? "bg-[#1E3A5F] text-[#FF9F1C] font-bold ring-1 ring-[#FF9F1C]/40"
                      : "text-slate-300 hover:bg-[#102846] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl leading-none shrink-0 group-hover:scale-110 transition-transform">
                      {lang.flag}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white group-hover:text-[#FF9F1C] transition-colors whitespace-nowrap">
                          {lang.nativeName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal whitespace-nowrap">
                          ({lang.name})
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight truncate max-w-[190px] mt-0.5">
                        {lang.region}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {lang.direction === "rtl" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-semibold">
                        RTL
                      </span>
                    )}
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-[#FF9F1C] text-slate-950 flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-700 opacity-0 group-hover:opacity-60 transition-opacity" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-2 pt-2 border-t border-[#1E3A5F]/60 px-2 py-1 text-center">
            <span className="text-[9px] text-slate-400 font-mono">
              Matrix AI Multi-Lingual Sync Active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
