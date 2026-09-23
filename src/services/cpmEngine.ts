import { assertOperationalAction } from "../integration/operationalAccess";
import {
  ProjectCalendar,
  EngineActivity,
  ScheduleCalculationOptions,
  CPMCalculationResult,
  CalculationDiagnostic,
  RelationshipType,
  ConstraintType,
  ActivityBaseline
} from "../types/programmeEngine";

// ==========================================
// DEFAULT SYSTEM CALENDARS
// ==========================================

export const DEFAULT_CALENDARS: Record<string, ProjectCalendar> = {
  "cal-5day": {
    id: "cal-5day",
    name: "5-Day Standard (Mon-Fri)",
    type: "5-day",
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    hoursPerDay: 8,
    holidays: ["2026-01-01", "2026-04-03", "2026-04-06", "2026-05-01", "2026-12-25"],
    description: "Standard corporate & engineering design calendar with weekend & holiday breaks"
  },
  "cal-6day": {
    id: "cal-6day",
    name: "6-Day Construction Site (Mon-Sat)",
    type: "6-day",
    workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    hoursPerDay: 9,
    holidays: ["2026-01-01", "2026-05-01", "2026-12-25"],
    description: "Civil & site operations schedule with Saturday full shifts and Sunday rest"
  },
  "cal-7day": {
    id: "cal-7day",
    name: "7-Day Continuous (Plant / Curing / Tunnel)",
    type: "7-day",
    workingDays: [0, 1, 2, 3, 4, 5, 6], // All 7 days
    hoursPerDay: 24,
    holidays: [],
    description: "Continuous plant processing, concrete curing, and 24/7 tunnel operations"
  }
};

// ==========================================
// DATE & CALENDAR MATHEMATICS
// ==========================================

export function parseDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 0, 0, 0, 0);
  }
  const str = String(val).trim();
  if (!str) return null;
  const clean = str.split("T")[0].replace(/\//g, "-");
  const parts = clean.split("-");
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  const fallback = new Date(str);
  if (isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 0, 0, 0, 0);
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isWorkingDay(date: Date, calendar: ProjectCalendar): boolean {
  const dayOfWeek = date.getDay();
  if (!calendar.workingDays.includes(dayOfWeek)) {
    return false;
  }
  const iso = formatDate(date);
  if (calendar.holidays && calendar.holidays.includes(iso)) {
    return false;
  }
  return true;
}

export function snapToNextWorkingDay(date: Date, calendar: ProjectCalendar): Date {
  const cur = new Date(date);
  let guard = 0;
  while (!isWorkingDay(cur, calendar) && guard < 60) {
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return cur;
}

export function snapToPrevWorkingDay(date: Date, calendar: ProjectCalendar): Date {
  const cur = new Date(date);
  let guard = 0;
  while (!isWorkingDay(cur, calendar) && guard < 60) {
    cur.setDate(cur.getDate() - 1);
    guard++;
  }
  return cur;
}

/**
 * Add working days according to project calendar.
 * If duration is 1 day, start date and finish date on the same working day!
 * P6 Convention: Start Date is the start of Day 1, Finish Date is the end of Day N.
 * If duration = 0 (milestone), start = finish.
 */
export function addWorkingDays(startDate: Date, durationDays: number, calendar: ProjectCalendar): Date {
    assertOperationalAction("create", "services/cpmEngine.ts");
  if (durationDays <= 0) {
    return new Date(startDate);
  }
  let current = snapToNextWorkingDay(startDate, calendar);
  let added = 1; // current day counts as 1st working day
  
  while (added < durationDays) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current, calendar)) {
      added++;
    }
  }
  return current;
}

/**
 * Subtract working days according to project calendar.
 * Calculates start date given finish date and duration.
 */
export function subtractWorkingDays(finishDate: Date, durationDays: number, calendar: ProjectCalendar): Date {
  if (durationDays <= 0) {
    return new Date(finishDate);
  }
  let current = snapToPrevWorkingDay(finishDate, calendar);
  let subtracted = 1;

  while (subtracted < durationDays) {
    current.setDate(current.getDate() - 1);
    if (isWorkingDay(current, calendar)) {
      subtracted++;
    }
  }
  return current;
}

/**
 * Counts working days between two dates inclusive.
 */
export function countWorkingDaysBetween(startDate: Date, finishDate: Date, calendar: ProjectCalendar): number {
  const start = new Date(startDate);
  const finish = new Date(finishDate);
  if (start > finish) {
    return -countWorkingDaysBetween(finish, start, calendar);
  }
  let count = 0;
  const cur = new Date(start);
  let guard = 0;
  while (cur <= finish && guard < 2000) {
    if (isWorkingDay(cur, calendar)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return count;
}

/**
 * Calendar days diff
 */
export function calendarDaysDiff(d1: Date, d2: Date): number {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return Math.round((t1 - t2) / (24 * 60 * 60 * 1000));
}

// ==========================================
// CPM ENGINE: TOPOLOGICAL SORT & CYCLE DETECTION
// ==========================================

export function detectCyclesAndToposort(activities: EngineActivity[]): {
  sortedIds: string[];
  hasCycle: boolean;
  cycleNodes: string[];
} {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  const actMap = new Map<string, EngineActivity>();

  activities.forEach(a => {
    actMap.set(a.id, a);
    inDegree[a.id] = 0;
    adj[a.id] = [];
  });

  // Populate graph based on predecessors & successors
  activities.forEach(a => {
    (a.predecessors || []).forEach(p => {
      if (actMap.has(p.predecessorId)) {
        if (!adj[p.predecessorId]) adj[p.predecessorId] = [];
        adj[p.predecessorId].push(a.id);
        inDegree[a.id] = (inDegree[a.id] || 0) + 1;
      }
    });
  });

  // Kahn's Algorithm
  const queue: string[] = [];
  Object.keys(inDegree).forEach(id => {
    if (inDegree[id] === 0) {
      queue.push(id);
    }
  });

  const sortedIds: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    sortedIds.push(u);

    const neighbors = adj[u] || [];
    for (const v of neighbors) {
      inDegree[v]--;
      if (inDegree[v] === 0) {
        queue.push(v);
      }
    }
  }

  const hasCycle = sortedIds.length < activities.length;
  const cycleNodes = hasCycle 
    ? activities.filter(a => !sortedIds.includes(a.id)).map(a => a.id)
    : [];

  return { sortedIds: hasCycle ? activities.map(a => a.id) : sortedIds, hasCycle, cycleNodes };
}

// ==========================================
// CORE CPM FORWARD & BACKWARD PASS ENGINE
// ==========================================

export function calculateCPM(
  rawActivities: EngineActivity[],
  options: Partial<ScheduleCalculationOptions> = {}
): CPMCalculationResult {
  const startTime = performance.now();
  const calendars = options.calendars || DEFAULT_CALENDARS;
  const defaultCalId = options.defaultCalendarId || "cal-6day";
  const dataDateStr = options.dataDate || formatDate(new Date());
  const dataDate = parseDate(dataDateStr) || new Date();
  const criticalThreshold = options.criticalFloatThreshold ?? 0;

  // Deep clone to avoid mutating external references
  const activities: EngineActivity[] = JSON.parse(JSON.stringify(rawActivities));
  const actMap = new Map<string, EngineActivity>();
  activities.forEach(a => {
    // Ensure all duration and progress fields exist
    a.originalDuration = Number(a.originalDuration) >= 0 ? Number(a.originalDuration) : 1;
    a.progress = Math.min(100, Math.max(0, Number(a.progress) || 0));
    
    // Auto calculate remaining duration if not set
    if (a.status === "Complete" || a.progress === 100) {
      a.remainingDuration = 0;
    } else if (a.remainingDuration === undefined || a.remainingDuration === null) {
      a.remainingDuration = Math.ceil(a.originalDuration * (1 - a.progress / 100));
    }
    
    a.calendarId = a.calendarId && calendars[a.calendarId] ? a.calendarId : defaultCalId;
    a.predecessors = a.predecessors || [];
    a.successors = a.successors || [];
    actMap.set(a.id, a);
  });

  // Re-link successors if predecessors exist
  activities.forEach(a => {
    a.successors = [];
  });
  activities.forEach(a => {
    a.predecessors.forEach(p => {
      const pred = actMap.get(p.predecessorId);
      if (pred) {
        pred.successors.push({
          id: p.id || `succ-${p.predecessorId}-${a.id}`,
          successorId: a.id,
          type: p.type || "FS",
          lag: Number(p.lag) || 0
        });
      }
    });
  });

  // Topological sorting
  const { sortedIds, hasCycle, cycleNodes } = detectCyclesAndToposort(activities);

  // -------------------------------------------------------------
  // 1. FORWARD PASS: Calculate Early Start (ES) and Early Finish (EF)
  // -------------------------------------------------------------
  
  // Find baseline anchor or first available date if none provided
  const earliestAnchor = activities.reduce((earliest: Date, a) => {
    const parsed = parseDate(a.actualStart || a.earlyStart || a.baseline0?.baselineStart || dataDateStr);
    if (parsed && parsed < earliest) return parsed;
    return earliest;
  }, dataDate);

  sortedIds.forEach(id => {
    const act = actMap.get(id);
    if (!act) return;
    const cal = calendars[act.calendarId] || calendars[defaultCalId];
    const duration = act.status === "In Progress" ? act.remainingDuration : act.originalDuration;
    const isMilestone = act.activityType === "StartMilestone" || act.activityType === "FinishMilestone" || duration === 0;

    let calculatedES = new Date(earliestAnchor);

    // If activity is in progress and has actual start, anchor ES to actual start
    if (act.status === "In Progress" && act.actualStart) {
      const parsedAS = parseDate(act.actualStart);
      if (parsedAS) calculatedES = parsedAS;
    } else if (act.status === "Complete" && act.actualStart) {
      const parsedAS = parseDate(act.actualStart);
      if (parsedAS) calculatedES = parsedAS;
    } else if (act.predecessors && act.predecessors.length > 0) {
      // Evaluate all predecessor constraints
      let maxPredecessorDate: Date | null = null;

      act.predecessors.forEach(predRel => {
        const pred = actMap.get(predRel.predecessorId);
        if (!pred) return;
        const predCal = calendars[pred.calendarId] || cal;
        const predES = parseDate(pred.earlyStart) || earliestAnchor;
        const predEF = parseDate(pred.earlyFinish) || earliestAnchor;
        const lag = Number(predRel.lag) || 0;

        let candidateES: Date;

        switch (predRel.type) {
          case "FS": // Finish-to-Start: ES = pred.EF + lag + 1 working day (or lag)
            if (lag >= 0) {
              const base = addWorkingDays(predEF, 1, predCal);
              candidateES = lag > 0 ? addWorkingDays(base, lag, cal) : base;
            } else {
              // Negative lag (Lead): starts before predecessor finishes
              candidateES = subtractWorkingDays(predEF, Math.abs(lag), cal);
            }
            break;

          case "SS": // Start-to-Start: ES = pred.ES + lag
            if (lag >= 0) {
              candidateES = lag > 0 ? addWorkingDays(predES, lag, cal) : new Date(predES);
            } else {
              candidateES = subtractWorkingDays(predES, Math.abs(lag), cal);
            }
            break;

          case "FF": { // Finish-to-Finish: EF = pred.EF + lag -> ES = EF - duration
            let candidateEF: Date;
            if (lag >= 0) {
              candidateEF = lag > 0 ? addWorkingDays(predEF, lag, predCal) : new Date(predEF);
            } else {
              candidateEF = subtractWorkingDays(predEF, Math.abs(lag), predCal);
            }
            candidateES = subtractWorkingDays(candidateEF, isMilestone ? 0 : duration, cal);
            break;
          }

          case "SF": { // Start-to-Finish: EF = pred.ES + lag -> ES = EF - duration
            let candidateEF: Date;
            if (lag >= 0) {
              candidateEF = lag > 0 ? addWorkingDays(predES, lag, predCal) : new Date(predES);
            } else {
              candidateEF = subtractWorkingDays(predES, Math.abs(lag), predCal);
            }
            candidateES = subtractWorkingDays(candidateEF, isMilestone ? 0 : duration, cal);
            break;
          }

          default:
            candidateES = addWorkingDays(predEF, 1, cal);
        }

        candidateES = snapToNextWorkingDay(candidateES, cal);

        if (!maxPredecessorDate || candidateES > maxPredecessorDate) {
          maxPredecessorDate = candidateES;
          predRel.isDriving = true;
        } else {
          predRel.isDriving = false;
        }
      });

      if (maxPredecessorDate) {
        calculatedES = maxPredecessorDate;
      }
    }

    // Apply Constraints (SNET, MSO, FNET, MFO)
    if (act.constraintType && act.constraintDate) {
      const cDate = parseDate(act.constraintDate);
      if (cDate) {
        const snappedCDate = snapToNextWorkingDay(cDate, cal);
        if (act.constraintType === "MSO") { // Must Start On
          calculatedES = snappedCDate;
        } else if (act.constraintType === "SNET") { // Start No Earlier Than
          if (snappedCDate > calculatedES) calculatedES = snappedCDate;
        } else if (act.constraintType === "FNET") { // Finish No Earlier Than
          const minES = subtractWorkingDays(snappedCDate, isMilestone ? 0 : duration, cal);
          if (minES > calculatedES) calculatedES = minES;
        } else if (act.constraintType === "MFO") { // Must Finish On
          calculatedES = subtractWorkingDays(snappedCDate, isMilestone ? 0 : duration, cal);
        }
      }
    }

    calculatedES = snapToNextWorkingDay(calculatedES, cal);

    // Calculate Early Finish
    let calculatedEF: Date;
    if (act.status === "Complete" && act.actualFinish) {
      const parsedAF = parseDate(act.actualFinish);
      calculatedEF = parsedAF || calculatedES;
    } else if (isMilestone || duration <= 0) {
      calculatedEF = new Date(calculatedES);
    } else {
      calculatedEF = addWorkingDays(calculatedES, duration, cal);
    }

    act.earlyStart = formatDate(calculatedES);
    act.earlyFinish = formatDate(calculatedEF);
  });

  // Find Project Early Finish (Maximum EF among all activities)
  let projectEarlyFinish = earliestAnchor;
  activities.forEach(a => {
    const ef = parseDate(a.earlyFinish);
    if (ef && ef > projectEarlyFinish) {
      projectEarlyFinish = ef;
    }
  });

  // -------------------------------------------------------------
  // 2. BACKWARD PASS: Calculate Late Finish (LF) and Late Start (LS)
  // -------------------------------------------------------------
  const reverseSortedIds = [...sortedIds].reverse();

  reverseSortedIds.forEach(id => {
    const act = actMap.get(id);
    if (!act) return;
    const cal = calendars[act.calendarId] || calendars[defaultCalId];
    const duration = act.status === "In Progress" ? act.remainingDuration : act.originalDuration;
    const isMilestone = act.activityType === "StartMilestone" || act.activityType === "FinishMilestone" || duration === 0;

    let calculatedLF = new Date(projectEarlyFinish);

    // If activity has successors, LF is minimum constraint from successors
    if (act.successors && act.successors.length > 0) {
      let minSuccessorDate: Date | null = null;

      act.successors.forEach(succRel => {
        const succ = actMap.get(succRel.successorId);
        if (!succ) return;
        const succCal = calendars[succ.calendarId] || cal;
        const succLS = parseDate(succ.lateStart) || projectEarlyFinish;
        const succLF = parseDate(succ.lateFinish) || projectEarlyFinish;
        const lag = Number(succRel.lag) || 0;

        let candidateLF: Date;

        switch (succRel.type) {
          case "FS": { // Finish-to-Start: pred.LF = succ.LS - lag - 1 working day (or lag)
            const base = subtractWorkingDays(succLS, 1, succCal);
            candidateLF = lag > 0 ? subtractWorkingDays(base, lag, cal) : (lag < 0 ? addWorkingDays(base, Math.abs(lag), cal) : base);
            break;
          }

          case "SS": { // Start-to-Start: pred.LS = succ.LS - lag -> pred.LF = pred.LS + duration
            let candidateLS: Date;
            if (lag >= 0) {
              candidateLS = lag > 0 ? subtractWorkingDays(succLS, lag, succCal) : new Date(succLS);
            } else {
              candidateLS = addWorkingDays(succLS, Math.abs(lag), succCal);
            }
            candidateLF = addWorkingDays(candidateLS, isMilestone ? 0 : duration, cal);
            break;
          }

          case "FF": // Finish-to-Finish: pred.LF = succ.LF - lag
            if (lag >= 0) {
              candidateLF = lag > 0 ? subtractWorkingDays(succLF, lag, cal) : new Date(succLF);
            } else {
              candidateLF = addWorkingDays(succLF, Math.abs(lag), cal);
            }
            break;

          case "SF": { // Start-to-Finish: pred.LS = succ.LF - lag -> pred.LF = pred.LS + duration
            let candidateLS: Date;
            if (lag >= 0) {
              candidateLS = lag > 0 ? subtractWorkingDays(succLF, lag, cal) : new Date(succLF);
            } else {
              candidateLS = addWorkingDays(succLF, Math.abs(lag), cal);
            }
            candidateLF = addWorkingDays(candidateLS, isMilestone ? 0 : duration, cal);
            break;
          }

          default:
            candidateLF = subtractWorkingDays(succLS, 1, cal);
        }

        candidateLF = snapToPrevWorkingDay(candidateLF, cal);

        if (!minSuccessorDate || candidateLF < minSuccessorDate) {
          minSuccessorDate = candidateLF;
        }
      });

      if (minSuccessorDate) {
        calculatedLF = minSuccessorDate;
      }
    }

    // Apply Late Constraints (SNLT, FNLT, MSO, MFO, ALAP)
    if (act.constraintType && act.constraintDate) {
      const cDate = parseDate(act.constraintDate);
      if (cDate) {
        const snappedCDate = snapToPrevWorkingDay(cDate, cal);
        if (act.constraintType === "MFO") {
          calculatedLF = snappedCDate;
        } else if (act.constraintType === "FNLT") { // Finish No Later Than
          if (snappedCDate < calculatedLF) calculatedLF = snappedCDate;
        } else if (act.constraintType === "SNLT") { // Start No Later Than
          const maxLF = addWorkingDays(snappedCDate, isMilestone ? 0 : duration, cal);
          if (maxLF < calculatedLF) calculatedLF = maxLF;
        } else if (act.constraintType === "MSO") {
          calculatedLF = addWorkingDays(snappedCDate, isMilestone ? 0 : duration, cal);
        }
      }
    }

    calculatedLF = snapToPrevWorkingDay(calculatedLF, cal);

    // Calculate Late Start (LS = LF - Duration)
    let calculatedLS: Date;
    if (isMilestone || duration <= 0) {
      calculatedLS = new Date(calculatedLF);
    } else {
      calculatedLS = subtractWorkingDays(calculatedLF, duration, cal);
    }

    act.lateStart = formatDate(calculatedLS);
    act.lateFinish = formatDate(calculatedLF);
  });

  // -------------------------------------------------------------
  // 3. FLOAT, CRITICALITY, FREE FLOAT & FORECAST CALCULATIONS
  // -------------------------------------------------------------
  let minFloat = Infinity;
  let maxFloat = -Infinity;
  let criticalCount = 0;
  let nearCriticalCount = 0;

  activities.forEach(act => {
    const cal = calendars[act.calendarId] || calendars[defaultCalId];
    const es = parseDate(act.earlyStart) || earliestAnchor;
    const ef = parseDate(act.earlyFinish) || earliestAnchor;
    const ls = parseDate(act.lateStart) || earliestAnchor;
    const lf = parseDate(act.lateFinish) || earliestAnchor;

    // Total Float = Late Start - Early Start (in working days)
    const tf = countWorkingDaysBetween(es, ls, cal);
    act.totalFloat = tf;

    if (tf < minFloat) minFloat = tf;
    if (tf > maxFloat) maxFloat = tf;

    // Free Float = min(succ.ES - lag) - EF
    let freeFloatVal = tf;
    if (act.successors && act.successors.length > 0) {
      let minEarlySuccessorImpact: number | null = null;
      act.successors.forEach(succRel => {
        const succ = actMap.get(succRel.successorId);
        if (!succ) return;
        const succES = parseDate(succ.earlyStart);
        if (succES) {
          const lag = Number(succRel.lag) || 0;
          let netGap: number;
          if (succRel.type === "FS") {
            const startExpected = addWorkingDays(ef, 1 + lag, cal);
            netGap = countWorkingDaysBetween(startExpected, succES, cal);
          } else {
            netGap = countWorkingDaysBetween(ef, succES, cal);
          }
          if (minEarlySuccessorImpact === null || netGap < minEarlySuccessorImpact) {
            minEarlySuccessorImpact = netGap;
          }
        }
      });
      if (minEarlySuccessorImpact !== null) {
        freeFloatVal = Math.max(0, minEarlySuccessorImpact);
      }
    }
    act.freeFloat = freeFloatVal;

    // Criticality Check
    act.isCritical = tf <= criticalThreshold;
    if (act.isCritical) {
      criticalCount++;
    } else if (tf > 0 && tf <= 5) {
      nearCriticalCount++;
    }

    // -------------------------------------------------------------
    // 4. FORECAST PROGRAMME & PROGRESS DYNAMICS
    // -------------------------------------------------------------
    // Forecast Start: Actual Start if started, else Early Start (or Data Date if delayed)
    let fStart = act.actualStart ? parseDate(act.actualStart)! : es;
    if (!act.actualStart && es < dataDate && act.status !== "Complete") {
      // Unstarted activity with planned date behind data date must forecast from data date
      fStart = snapToNextWorkingDay(dataDate, cal);
    }
    
    // Remaining duration estimation with productivity
    let forecastDuration = act.remainingDuration;
    if (act.resourceAssignment && act.resourceAssignment.actualDailyRateAchieved && act.resourceAssignment.actualDailyRateAchieved > 0) {
      const earnedScope = (act.resourceAssignment.totalScopeQty * (act.progress / 100));
      const remainingScope = Math.max(0, act.resourceAssignment.totalScopeQty - earnedScope);
      const daysAtCurrentBurn = Math.ceil(remainingScope / act.resourceAssignment.actualDailyRateAchieved);
      if (daysAtCurrentBurn > 0 && act.status === "In Progress") {
        forecastDuration = daysAtCurrentBurn;
      }
    }

    let fFinish: Date;
    if (act.status === "Complete" && act.actualFinish) {
      fFinish = parseDate(act.actualFinish)!;
    } else if (act.activityType === "StartMilestone" || act.activityType === "FinishMilestone" || forecastDuration <= 0) {
      fFinish = new Date(fStart);
    } else {
      // If in progress, forecast from data date forward using remaining duration
      const forecastOrigin = (act.status === "In Progress" && dataDate > fStart) ? snapToNextWorkingDay(dataDate, cal) : fStart;
      fFinish = addWorkingDays(forecastOrigin, forecastDuration, cal);
    }

    act.forecastStart = formatDate(fStart);
    act.forecastFinish = formatDate(fFinish);

    // -------------------------------------------------------------
    // 5. BASELINE 0 & BASELINE 1 VARIANCE ANALYSIS
    // -------------------------------------------------------------
    // Baseline 0 Variance
    if (act.baseline0 && act.baseline0.baselineFinish) {
      const b0Finish = parseDate(act.baseline0.baselineFinish);
      if (b0Finish) {
        act.varianceB0Days = calendarDaysDiff(fFinish, b0Finish);
      } else {
        act.varianceB0Days = 0;
      }
    } else {
      act.varianceB0Days = 0;
    }

    // Baseline 1 Variance
    if (act.baseline1 && act.baseline1.baselineFinish) {
      const b1Finish = parseDate(act.baseline1.baselineFinish);
      if (b1Finish) {
        act.varianceB1Days = calendarDaysDiff(fFinish, b1Finish);
      } else {
        act.varianceB1Days = 0;
      }
    } else {
      act.varianceB1Days = 0;
    }

    // -------------------------------------------------------------
    // 6. PRODUCTIVITY & ACCELERATION CALCULATION
    // -------------------------------------------------------------
    if (act.resourceAssignment) {
      const ra = act.resourceAssignment;
      const earnedScope = (ra.totalScopeQty * (act.progress / 100));
      const remainingScope = Math.max(0, ra.totalScopeQty - earnedScope);
      
      // Target vs Actual burn rate
      if (ra.actualDailyRateAchieved && ra.targetDailyRate > 0) {
        act.productivityPerformanceIndex = Number((ra.actualDailyRateAchieved / ra.targetDailyRate).toFixed(2));
      }

      // Required Daily Productivity to finish by Target Baseline 0 / Baseline 1 Finish
      const targetFinishDate = parseDate(act.baseline1?.baselineFinish || act.baseline0?.baselineFinish || act.earlyFinish);
      if (targetFinishDate && targetFinishDate > dataDate && remainingScope > 0) {
        const remainingWorkingDays = countWorkingDaysBetween(dataDate, targetFinishDate, cal);
        if (remainingWorkingDays > 0) {
          act.requiredDailyProductivity = Number((remainingScope / remainingWorkingDays).toFixed(1));
        }
      }
    }
  });

  // Project Level Forecast Finish
  let projectForecastFinish = earliestAnchor;
  activities.forEach(a => {
    const ff = parseDate(a.forecastFinish);
    if (ff && ff > projectForecastFinish) {
      projectForecastFinish = ff;
    }
  });

  // Calculate DCMA 14-Point Health Checks
  const dcmaIssues: CalculationDiagnostic["dcmaIssues"] = [];
  let dcmaDeductions = 0;

  // 1. Missing Predecessors / Successors (except start/finish milestones)
  const missingPredecessors = activities.filter(a => a.activityType !== "StartMilestone" && (!a.predecessors || a.predecessors.length === 0));
  if (missingPredecessors.length > 1) {
    dcmaIssues.push({
      rule: "DCMA 01: Missing Logic Predecessors",
      description: `${missingPredecessors.length} activities do not have incoming dependency logic links.`,
      affectedCount: missingPredecessors.length,
      severity: "High"
    });
    dcmaDeductions += 15;
  }

  const missingSuccessors = activities.filter(a => a.activityType !== "FinishMilestone" && (!a.successors || a.successors.length === 0));
  if (missingSuccessors.length > 1) {
    dcmaIssues.push({
      rule: "DCMA 02: Missing Logic Successors",
      description: `${missingSuccessors.length} open-ended activities do not drive any successor tasks.`,
      affectedCount: missingSuccessors.length,
      severity: "High"
    });
    dcmaDeductions += 15;
  }

  // 2. Negative Float
  const negativeFloatActs = activities.filter(a => a.totalFloat < 0);
  if (negativeFloatActs.length > 0) {
    dcmaIssues.push({
      rule: "DCMA 05: Negative Float Violation",
      description: `${negativeFloatActs.length} activities have negative total float (schedule is in breach of hard contractual finish dates).`,
      affectedCount: negativeFloatActs.length,
      severity: "High"
    });
    dcmaDeductions += 20;
  }

  // 3. High Float (> 44 working days)
  const highFloatActs = activities.filter(a => a.totalFloat > 44);
  if (highFloatActs.length > 0) {
    dcmaIssues.push({
      rule: "DCMA 06: High Total Float",
      description: `${highFloatActs.length} activities have excessive float (>44 days), suggesting missing successor network integration.`,
      affectedCount: highFloatActs.length,
      severity: "Medium"
    });
    dcmaDeductions += 10;
  }

  // 4. Hard Constraints
  const hardConstraints = activities.filter(a => a.constraintType === "MSO" || a.constraintType === "MFO");
  if (hardConstraints.length > 0) {
    dcmaIssues.push({
      rule: "DCMA 04: Hard Constraints",
      description: `${hardConstraints.length} activities utilize hard constraints (MSO/MFO) overriding dynamic logic flow.`,
      affectedCount: hardConstraints.length,
      severity: "Medium"
    });
    dcmaDeductions += 10;
  }

  const dcmaScore = Math.max(0, Math.min(100, 100 - dcmaDeductions));
  const calcTime = Number((performance.now() - startTime).toFixed(2));

  // Project overall B0/B1 variance
  const projectB0Finish = activities.reduce((latest: Date | null, a) => {
    if (a.baseline0?.baselineFinish) {
      const d = parseDate(a.baseline0.baselineFinish);
      if (d && (!latest || d > latest)) return d;
    }
    return latest;
  }, null);

  const b0Variance = projectB0Finish ? calendarDaysDiff(projectForecastFinish, projectB0Finish) : 0;

  const projectB1Finish = activities.reduce((latest: Date | null, a) => {
    if (a.baseline1?.baselineFinish) {
      const d = parseDate(a.baseline1.baselineFinish);
      if (d && (!latest || d > latest)) return d;
    }
    return latest;
  }, null);

  const b1Variance = projectB1Finish ? calendarDaysDiff(projectForecastFinish, projectB1Finish) : 0;

  const diagnostics: CalculationDiagnostic = {
    totalActivities: activities.length,
    milestonesCount: activities.filter(a => a.activityType === "StartMilestone" || a.activityType === "FinishMilestone").length,
    criticalActivitiesCount: criticalCount,
    nearCriticalCount,
    totalFloatMin: activities.length === 0 || minFloat === Infinity ? 0 : minFloat,
    totalFloatMax: activities.length === 0 || maxFloat === -Infinity ? 0 : maxFloat,
    projectEarlyFinish: activities.length > 0 ? formatDate(projectEarlyFinish) : "-",
    projectLateFinish: activities.length > 0 ? formatDate(projectEarlyFinish) : "-",
    projectForecastFinish: activities.length > 0 ? formatDate(projectForecastFinish) : "-",
    b0VarianceDays: b0Variance,
    b1VarianceDays: b1Variance,
    hasCycles: hasCycle,
    cycleNodes,
    calculationTimeMs: calcTime,
    dcmaScore: activities.length > 0 ? dcmaScore : 100,
    dcmaIssues: activities.length > 0 ? dcmaIssues : []
  };

  return {
    activities,
    diagnostics
  };
}

// ==========================================
// BASELINE MANAGEMENT UTILITIES
// ==========================================

export function snapshotBaseline(
  activities: EngineActivity[],
  targetBaseline: "baseline0" | "baseline1"
): EngineActivity[] {
  return activities.map(act => {
    const start = act.earlyStart || act.actualStart || formatDate(new Date());
    const finish = act.earlyFinish || act.actualFinish || formatDate(new Date());
    const duration = act.originalDuration || 1;
    const scopeQty = act.resourceAssignment?.totalScopeQty;

    const baselineData: ActivityBaseline = {
      baselineStart: start,
      baselineFinish: finish,
      duration,
      scopeQty
    };

    return {
      ...act,
      [targetBaseline]: baselineData
    };
  });
}
