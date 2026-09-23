import React from "react";
import { PayrollSettings } from "../../types/payroll";
import { Settings, RotateCcw, AlertCircle, Info } from "lucide-react";
import { SettingsErrors, validateSettings } from "../../utils/payrollValidation";
import { SUPPORTED_CURRENCIES, currencySymbols, SupportedCurrency } from "../../config/currencies";

interface PayrollSettingsCardProps {
  settings: PayrollSettings;
  onChange: (key: keyof PayrollSettings, value: any) => void;
  onRestoreDefaults: () => void;
  readOnly?: boolean;
}

export default function PayrollSettingsCard({
  settings,
  onChange,
  onRestoreDefaults,
  readOnly = false
}: PayrollSettingsCardProps) {
  const errors: SettingsErrors = validateSettings(settings);

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Payroll Calculation Settings</h3>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onRestoreDefaults}
            className="px-3.5 py-2 bg-slate-950 border border-slate-850 hover:border-slate-750 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Default Settings
          </button>
        )}
      </div>

      <div className={`space-y-6 ${readOnly ? "pointer-events-none opacity-85 select-none" : ""}`}>
        {/* Row 1: spacious four-column grid on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Normal Time Multiplier */}
          <div className="flex flex-col justify-between">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Normal Time Multiplier
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={settings.normalMultiplier}
              onChange={(e) => onChange("normalMultiplier", parseFloat(e.target.value) || 0)}
              className={`w-full h-12 px-4 bg-slate-950/60 border rounded-xl text-slate-100 focus:outline-none text-sm font-semibold transition-colors ${
                errors.normalMultiplier ? "border-red-500/50 focus:border-red-500" : "border-slate-800 focus:border-amber-500"
              }`}
            />
            {errors.normalMultiplier && (
              <div className="text-[10px] text-red-400 flex items-center gap-1 mt-1 font-semibold">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.normalMultiplier}</span>
              </div>
            )}
          </div>

          {/* Overtime Multiplier */}
          <div className="flex flex-col justify-between">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Overtime Multiplier
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={settings.overtimeMultiplier}
              onChange={(e) => onChange("overtimeMultiplier", parseFloat(e.target.value) || 0)}
              className={`w-full h-12 px-4 bg-slate-950/60 border rounded-xl text-slate-100 focus:outline-none text-sm font-semibold transition-colors ${
                errors.overtimeMultiplier ? "border-red-500/50 focus:border-red-500" : "border-slate-800 focus:border-amber-500"
              }`}
            />
            {errors.overtimeMultiplier && (
              <div className="text-[10px] text-red-400 flex items-center gap-1 mt-1 font-semibold">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.overtimeMultiplier}</span>
              </div>
            )}
          </div>

          {/* Sunday/Holiday Multiplier */}
          <div className="flex flex-col justify-between">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Sunday & Holiday Multiplier
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={settings.sundayHolidayMultiplier}
              onChange={(e) => onChange("sundayHolidayMultiplier", parseFloat(e.target.value) || 0)}
              className={`w-full h-12 px-4 bg-slate-950/60 border rounded-xl text-slate-100 focus:outline-none text-sm font-semibold transition-colors ${
                errors.sundayHolidayMultiplier ? "border-red-500/50 focus:border-red-500" : "border-slate-800 focus:border-amber-500"
              }`}
            />
            {errors.sundayHolidayMultiplier && (
              <div className="text-[10px] text-red-400 flex items-center gap-1 mt-1 font-semibold">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.sundayHolidayMultiplier}</span>
              </div>
            )}
          </div>

          {/* UIF Contribution % */}
          <div className="flex flex-col justify-between">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              UIF Employee Contribution %
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={settings.uifPercentage}
                onChange={(e) => onChange("uifPercentage", parseFloat(e.target.value) || 0)}
                className={`w-full h-12 pr-12 pl-4 bg-slate-950/60 border rounded-xl text-slate-100 focus:outline-none text-sm font-semibold transition-colors ${
                  errors.uifPercentage ? "border-red-500/50 focus:border-red-500" : "border-slate-800 focus:border-amber-500"
                }`}
              />
              <span className="absolute right-3.5 text-xs font-black text-amber-500 select-none bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                %
              </span>
            </div>
            {errors.uifPercentage && (
              <div className="text-[10px] text-red-400 flex items-center gap-1 mt-1 font-semibold">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.uifPercentage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: three-column grid on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Currency Select */}
          <div className="flex flex-col justify-between">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => {
                const code = e.target.value as SupportedCurrency;
                const sym = currencySymbols[code] || "R";
                onChange("currency", code);
                onChange("currencySymbol", sym);
              }}
              className="w-full h-12 px-4 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-bold transition-colors cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-slate-900 text-white font-medium">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Symbol */}
          <div className="flex flex-col justify-between">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Currency Symbol
            </label>
            <input
              type="text"
              readOnly
              value={settings.currencySymbol || currencySymbols[settings.currency as SupportedCurrency] || "R"}
              className="w-full h-12 px-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-300 focus:outline-none text-sm font-black select-none cursor-not-allowed"
            />
          </div>

          {/* Decimal Places */}
          <div className="flex flex-col justify-between">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Decimal Places
            </label>
            <input
              type="number"
              min="0"
              max="4"
              value={settings.decimalPlaces}
              onChange={(e) => onChange("decimalPlaces", parseInt(e.target.value) || 0)}
              className="w-full h-12 px-4 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-sm font-semibold transition-colors"
            />
          </div>
        </div>

        {/* Instant updates info message */}
        <div className="flex items-center gap-2 border-t border-slate-800/60 pt-4 mt-2">
          <Info className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-[11px] font-semibold text-slate-400 tracking-wide leading-relaxed">
            Changes made here are applied immediately to all payroll calculations.
          </p>
        </div>
      </div>
    </div>
  );
}
