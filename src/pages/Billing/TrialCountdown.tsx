import React, { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { dispatchBillingRefreshEvent } from "../../services/billingService";

export interface TrialCountdownCalculation {
  isElapsed: boolean;
  display: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Pure calculation helper for trial remaining duration.
 */
export function calculateTrialCountdown(
  trialEndsAt: string,
  nowMs: number = Date.now()
): TrialCountdownCalculation {
  const endMs = new Date(trialEndsAt).getTime();
  if (isNaN(endMs)) {
    return { isElapsed: true, display: "Trial period elapsed", days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const diffMs = endMs - nowMs;
  if (diffMs <= 0) {
    return { isElapsed: true, display: "Trial period elapsed", days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  let display = "";
  if (days > 0) {
    display = `${days}d ${hours}h ${minutes}m remaining`;
  } else if (hours > 0) {
    display = `${hours}h ${minutes}m ${seconds}s remaining`;
  } else {
    display = `${minutes}m ${seconds}s remaining`;
  }

  return { isElapsed: false, display, days, hours, minutes, seconds };
}

interface TrialCountdownProps {
  trialEndsAt: string;
}

export function TrialCountdown({ trialEndsAt }: TrialCountdownProps) {
  const [now, setNow] = useState<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const countdown = calculateTrialCountdown(trialEndsAt, now);

  useEffect(() => {
    // If already elapsed, do not start interval
    const initialCalc = calculateTrialCountdown(trialEndsAt, Date.now());
    if (initialCalc.isElapsed) {
      return;
    }

    timerRef.current = setInterval(() => {
      const currentNow = Date.now();
      const calc = calculateTrialCountdown(trialEndsAt, currentNow);
      setNow(currentNow);

      if (calc.isElapsed && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        dispatchBillingRefreshEvent();
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [trialEndsAt]);

  if (countdown.isElapsed) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] font-bold">
        <Clock className="w-3.5 h-3.5" />
        <span>Trial period elapsed</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[11px] font-mono font-bold">
      <Clock className="w-3.5 h-3.5 animate-pulse" />
      <span>{countdown.display}</span>
    </div>
  );
}
