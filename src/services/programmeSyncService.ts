import { EngineActivity } from "../types/programmeEngine";
import { parseDate, formatDate, calendarDaysDiff } from "./cpmEngine";

export interface ProgrammeScheduleBounds {
  /** Earliest start date across all project activities (YYYY-MM-DD) */
  programmeStart: string;
  /** Latest finish date across all project activities (YYYY-MM-DD) */
  programmeFinish: string;
  /** Total calendar span in days between programmeStart and programmeFinish */
  totalCalendarDays: number;
  /** Total count of evaluated project activities */
  activityCount: number;
  /** Earliest activity details */
  earliestActivity?: {
    id: string;
    wbsCode: string;
    name: string;
    date: string;
  };
  /** Latest activity details (final driving finish) */
  latestActivity?: {
    id: string;
    wbsCode: string;
    name: string;
    date: string;
  };
  /** Calculated scale min date for the Gantt X-axis with lead padding */
  scaleMinDate: string;
  /** Calculated scale max date for the Gantt X-axis with tail padding */
  scaleMaxDate: string;
  /** Total calendar days for the full padded scale */
  scaleTotalDays: number;
}

export interface TimelineScaleOptions {
  paddingDaysBefore?: number;
  paddingDaysAfter?: number;
  minDurationDays?: number;
  exactBounds?: boolean;
}

/**
 * Data Synchronization Service:
 * Scans all available project activities across start and finish date fields
 * (early, actual, planned, forecast, baseline) to determine the definitive
 * programmeStart and programmeFinish dates for the project schedule.
 */
export function calculateProgrammeDateBounds(
  activities: EngineActivity[],
  dataDate?: string,
  options?: TimelineScaleOptions
): ProgrammeScheduleBounds {
  const leadPadding = options?.exactBounds ? 0 : (options?.paddingDaysBefore ?? 10);
  const tailPadding = options?.exactBounds ? 0 : (options?.paddingDaysAfter ?? 20);
  const minSpanDays = options?.minDurationDays ?? 30;

  // Fallback defaults if no activities exist
  if (!activities || activities.length === 0) {
    const todayStr = dataDate || new Date().toISOString().split("T")[0];
    const today = parseDate(todayStr) || new Date();
    
    const fallbackFinish = new Date(today);
    fallbackFinish.setDate(fallbackFinish.getDate() + 90);
    const finishStr = formatDate(fallbackFinish);

    const minD = new Date(today);
    minD.setDate(minD.getDate() - leadPadding);
    const maxD = new Date(fallbackFinish);
    maxD.setDate(maxD.getDate() + tailPadding);

    return {
      programmeStart: todayStr,
      programmeFinish: finishStr,
      totalCalendarDays: 90,
      activityCount: 0,
      scaleMinDate: formatDate(minD),
      scaleMaxDate: formatDate(maxD),
      scaleTotalDays: Math.max(minSpanDays, calendarDaysDiff(maxD, minD))
    };
  }

  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;
  let earliestActivity: ProgrammeScheduleBounds["earliestActivity"];
  let latestActivity: ProgrammeScheduleBounds["latestActivity"];

  for (const act of activities) {
    // 1. Scan all candidate start dates
    const startCandidates = [
      act.earlyStart,
      act.actualStart,
      act.lateStart,
      act.forecastStart,
      act.baseline0?.baselineStart,
      act.baseline1?.baselineStart
    ];

    for (const dStr of startCandidates) {
      if (!dStr) continue;
      const d = parseDate(dStr);
      if (d && !isNaN(d.getTime())) {
        if (!earliestDate || d.getTime() < earliestDate.getTime()) {
          earliestDate = d;
          earliestActivity = {
            id: act.id,
            wbsCode: act.wbsCode,
            name: act.name,
            date: dStr
          };
        }
      }
    }

    // 2. Scan all candidate finish dates
    const finishCandidates = [
      act.earlyFinish,
      act.actualFinish,
      act.lateFinish,
      act.forecastFinish,
      act.baseline0?.baselineFinish,
      act.baseline1?.baselineFinish
    ];

    for (const dStr of finishCandidates) {
      if (!dStr) continue;
      const d = parseDate(dStr);
      if (d && !isNaN(d.getTime())) {
        if (!latestDate || d.getTime() > latestDate.getTime()) {
          latestDate = d;
          latestActivity = {
            id: act.id,
            wbsCode: act.wbsCode,
            name: act.name,
            date: dStr
          };
        }
      }
    }
  }

  // If start or finish could not be established from activities, fallback to dataDate or current date
  const fallback = parseDate(dataDate) || new Date();
  if (!earliestDate) {
    earliestDate = new Date(fallback);
  }
  if (!latestDate || latestDate.getTime() <= earliestDate.getTime()) {
    latestDate = new Date(earliestDate);
    latestDate.setDate(latestDate.getDate() + 60);
  }

  const programmeStart = formatDate(earliestDate);
  const programmeFinish = formatDate(latestDate);
  const totalCalendarDays = Math.max(1, calendarDaysDiff(latestDate, earliestDate));

  // Compute padded X-axis scale bounds
  const minD = new Date(earliestDate);
  minD.setDate(minD.getDate() - leadPadding);

  const maxD = new Date(latestDate);
  maxD.setDate(maxD.getDate() + tailPadding);

  const scaleTotalDays = Math.max(minSpanDays, calendarDaysDiff(maxD, minD));

  return {
    programmeStart,
    programmeFinish,
    totalCalendarDays,
    activityCount: activities.length,
    earliestActivity,
    latestActivity,
    scaleMinDate: formatDate(minD),
    scaleMaxDate: formatDate(maxD),
    scaleTotalDays
  };
}
