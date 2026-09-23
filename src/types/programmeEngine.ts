// Project Controls CPM & Programme Engine Types

export type RelationshipType = "FS" | "SS" | "FF" | "SF";

export type ConstraintType = 
  | "ASAP"  // As Soon As Possible (default)
  | "ALAP"  // As Late As Possible
  | "MSO"   // Must Start On
  | "MFO"   // Must Finish On
  | "SNET"  // Start No Earlier Than
  | "SNLT"  // Start No Later Than
  | "FNET"  // Finish No Earlier Than
  | "FNLT"; // Finish No Later Than

export type ActivityType = "Task" | "StartMilestone" | "FinishMilestone" | "Summary";

export interface ProjectCalendar {
  id: string;
  name: string;
  type: "5-day" | "6-day" | "7-day" | "custom";
  workingDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday. e.g. 5-day is [1,2,3,4,5]
  hoursPerDay: number;
  holidays: string[]; // ISO date strings "YYYY-MM-DD"
  description?: string;
}

export interface ProgrammeResource {
  id: string;
  name: string;
  role: string;
  unit: string; // "m³", "tons", "m²", "lin.m", "crew-hrs", "units"
  standardDailyRate: number; // units per day
  costPerUnit?: number;
}

export interface ActivityResourceAssignment {
  resourceId: string;
  resourceName: string;
  totalScopeQty: number;
  unit: string;
  targetDailyRate: number;
  actualDailyRateAchieved?: number;
  plannedCost?: number;
  actualCostToDate?: number;
}

export interface ActivityBaseline {
  baselineStart: string; // "YYYY-MM-DD"
  baselineFinish: string; // "YYYY-MM-DD"
  duration: number; // in calendar or working days
  scopeQty?: number;
}

export interface ActivityPredecessor {
  id: string;
  predecessorId: string;
  type: RelationshipType;
  lag: number; // in working days (can be negative for lead)
  isDriving?: boolean;
}

export interface ActivitySuccessor {
  id: string;
  successorId: string;
  type: RelationshipType;
  lag: number;
  isDriving?: boolean;
}

export interface EngineActivity {
  id: string;
  wbsCode: string;
  name: string;
  description?: string;
  activityType: ActivityType;
  calendarId: string;
  sortOrder: number;
  parentId?: string | null;

  // Durations (in working days)
  originalDuration: number; // OD
  remainingDuration: number; // RD
  actualDuration: number; // AD

  // Progress & Execution Dates
  progress: number; // 0 to 100%
  status: "Not Started" | "In Progress" | "Complete" | "Delayed" | "On Hold";
  actualStart?: string; // "YYYY-MM-DD"
  actualFinish?: string; // "YYYY-MM-DD"

  // Constraints
  constraintType: ConstraintType;
  constraintDate?: string;

  // Dependencies
  predecessors: ActivityPredecessor[];
  successors: ActivitySuccessor[];

  // Baselines
  baseline0?: ActivityBaseline; // Contract Baseline 0
  baseline1?: ActivityBaseline; // Approved Revised Baseline 1

  // Resources & Productivity
  resourceAssignment?: ActivityResourceAssignment;

  // CPM Computed Fields
  earlyStart: string; // ES
  earlyFinish: string; // EF
  lateStart: string; // LS
  lateFinish: string; // LF
  totalFloat: number; // TF in working days
  freeFloat: number; // FF in working days
  isCritical: boolean;
  isLongestPath?: boolean;

  // Multi-Baseline & Forecast Computed Fields
  forecastStart: string;
  forecastFinish: string;
  varianceB0Days: number; // Variance against Baseline 0 (positive = delay, negative = ahead)
  varianceB1Days: number; // Variance against Baseline 1
  requiredDailyProductivity?: number; // Needed to hit planned/baseline finish
  productivityPerformanceIndex?: number; // Actual Rate / Target Rate
  earnedScheduleDays?: number;

  responsiblePerson?: string;
  notes?: string;
}

export interface ScheduleCalculationOptions {
  dataDate: string; // Current Progress Cutoff "YYYY-MM-DD"
  criticalFloatThreshold: number; // Float <= threshold is critical (default 0)
  calculateLongestPath: boolean;
  defaultCalendarId: string;
  calendars: Record<string, ProjectCalendar>;
}

export interface CalculationDiagnostic {
  totalActivities: number;
  milestonesCount: number;
  criticalActivitiesCount: number;
  nearCriticalCount: number; // 0 < TF <= 5
  totalFloatMin: number;
  totalFloatMax: number;
  projectEarlyFinish: string;
  projectLateFinish: string;
  projectForecastFinish: string;
  b0VarianceDays: number;
  b1VarianceDays: number;
  hasCycles: boolean;
  cycleNodes?: string[];
  calculationTimeMs: number;
  dcmaScore: number; // 0-100%
  dcmaIssues: {
    rule: string;
    description: string;
    affectedCount: number;
    severity: "High" | "Medium" | "Low";
  }[];
}

export interface CPMCalculationResult {
  activities: EngineActivity[];
  diagnostics: CalculationDiagnostic;
}
