import React from "react";
import { AutoRenewalStatus } from "./types";

interface AutoRenewalSwitchProps {
  subscriptionName: string;
  autoRenewal: AutoRenewalStatus;
  available: boolean;
  ineligibleReason?: string;
  onToggle: (targetEnabled: boolean) => void;
  size?: "sm" | "md";
  id?: string;
  describedBy?: string;
  className?: string;
}

export function AutoRenewalSwitch({
  subscriptionName,
  autoRenewal,
  available,
  ineligibleReason,
  onToggle,
  size = "sm",
  id,
  describedBy,
  className = ""
}: AutoRenewalSwitchProps) {
  const isEnabled = autoRenewal === "enabled";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (available) {
        onToggle(!isEnabled);
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (available) {
      onToggle(!isEnabled);
    }
  };

  // Determine status label text and styling based on database auto_renew_enabled
  const labelText = isEnabled ? "Enabled" : "Disabled";
  let labelClass = "text-slate-600 dark:text-slate-400 font-medium";

  if (!available) {
    labelClass = isEnabled
      ? "text-slate-400 dark:text-slate-500 font-bold"
      : "text-slate-400 dark:text-slate-500 font-medium";
  } else if (isEnabled) {
    labelClass = "text-amber-600 dark:text-amber-400 font-bold";
  }

  // Size configurations
  const isSmall = size === "sm";
  const switchWidth = isSmall ? "w-9" : "w-11";
  const switchHeight = isSmall ? "h-5" : "h-6";
  const knobSize = isSmall ? "w-3.5 h-3.5" : "w-4.5 h-4.5";
  const knobTranslate = isSmall 
    ? (isEnabled ? "translate-x-4" : "translate-x-0.5")
    : (isEnabled ? "translate-x-5.5" : "translate-x-0.5");

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Switch Control */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={isEnabled}
        aria-label={`Toggle auto-renewal for ${subscriptionName}`}
        aria-disabled={!available}
        aria-describedby={describedBy}
        disabled={!available}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        title={!available && ineligibleReason ? ineligibleReason : undefined}
        className={`relative inline-flex items-center shrink-0 ${switchWidth} ${switchHeight} rounded-full transition-colors duration-200 ease-in-out motion-reduce:transition-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#FF9F1C] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#07182E] ${
          !available
            ? "bg-slate-200 dark:bg-slate-800 opacity-60 cursor-not-allowed"
            : isEnabled
            ? "bg-[#FF9F1C] hover:bg-[#f39200] cursor-pointer shadow-xs"
            : "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 cursor-pointer"
        }`}
      >
        {/* Toggle Knob */}
        <span
          className={`pointer-events-none inline-block ${knobSize} transform rounded-full bg-white dark:bg-[#07182E] shadow-sm transition-transform duration-200 ease-in-out motion-reduce:transition-none ${knobTranslate}`}
          aria-hidden="true"
        />
      </button>

      {/* Adjacent Text Label */}
      <span className={`text-xs select-none ${labelClass}`}>
        {labelText}
      </span>
    </div>
  );
}
