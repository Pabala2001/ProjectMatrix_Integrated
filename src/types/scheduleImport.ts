// Normalised Project Matrix Schedule Schema & Source Traceability

export type ScheduleSourceFormat = 
  | "primavera_xer"
  | "primavera_xml"
  | "msproject_xml"
  | "msproject_mpp"
  | "excel"
  | "csv"
  | "pdf";

export interface NormalisedRelationship {
  relationship_id: string;
  programme_id?: string;
  predecessor_activity_id: string; // references external_activity_id or internal activity_id
  successor_activity_id: string;
  relationship_type: "FS" | "SS" | "FF" | "SF";
  lag: number; // in working days (or hours converted to days)
  source_file?: string;
}

export interface NormalisedWbsNode {
  wbs_id: string;
  wbs_code: string;
  wbs_name: string;
  parent_wbs_id?: string | null;
  outline_level: number;
}

export interface NormalisedResourceAssignment {
  resource_id?: string;
  resource_name: string;
  role?: string;
  units?: number;
  cost?: number;
}

export interface NormalisedActivity {
  // Database & Identifiers
  project_id?: string;
  programme_id?: string;
  source_file_id?: string;
  source_format: ScheduleSourceFormat;

  activity_id: string; // Internal unique deterministic ID
  external_activity_id: string; // Original Activity ID / Task Code / UID from source file
  
  // WBS & Hierarchy
  wbs_id?: string;
  wbs_code: string;
  wbs_name?: string;
  parent_wbs_id?: string | null;
  outline_level?: number;

  // Task Details
  activity_name: string;
  activity_type?: "Task" | "StartMilestone" | "FinishMilestone" | "Summary" | "LevelOfEffort" | "ResourceDependent" | string;
  description?: string;

  // Dates
  planned_start: string; // YYYY-MM-DD
  planned_finish: string; // YYYY-MM-DD
  actual_start?: string;
  actual_finish?: string;
  baseline_start?: string;
  baseline_finish?: string;
  remaining_start?: string;
  remaining_finish?: string;
  early_start?: string;
  early_finish?: string;
  late_start?: string;
  late_finish?: string;

  // Durations & Float
  original_duration: number; // in days
  remaining_duration?: number; // in days
  actual_duration?: number;
  total_float?: number; // in days
  free_float?: number; // in days

  // Progress & Execution
  percent_complete: number; // 0 to 100
  physical_percent_complete?: number;
  duration_percent_complete?: number;
  status: "Not Started" | "In Progress" | "Complete" | "Delayed" | "On Hold";
  
  // Calendar & Constraints
  calendar_id?: string;
  calendar_name?: string;
  constraint_type?: string; // ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO
  constraint_date?: string;

  // Logic flags
  is_milestone: boolean;
  is_summary?: boolean;
  is_critical?: boolean;

  // Cost & Resources
  responsible_person?: string;
  resources?: NormalisedResourceAssignment[];
  cost?: number;

  // Predecessors raw text if any
  raw_predecessors?: string;

  // Source Traceability
  source_file: string;
  source_sheet?: string;
  source_row?: number;
  import_timestamp: string;
  import_batch_id: string;
  sort_order: number;
}

export interface RejectedRowDetail {
  row_id?: string | number;
  raw_text?: string;
  reason: string;
}

export interface ImportValidationStats {
  activities_detected: number;
  valid_activities: number;
  rejected_rows: number;
  rejected_details?: RejectedRowDetail[];
  relationships_detected: number;
  sanity_check_passed: boolean;
  sanity_check_message?: string;
  project_name?: string;
  project_start?: string;
  project_finish?: string;
  project_duration_days?: number;

  total_activities: number;
  milestones_count: number;
  summary_tasks_count: number;
  cpm_logic_activities_count?: number;
  critical_activities_count: number;
  total_relationships: number;
  fs_count: number;
  ss_count: number;
  ff_count: number;
  sf_count: number;
  activities_with_predecessors: number;
  open_start_tasks: number; // No predecessor
  open_finish_tasks: number; // No successor
  min_start_date: string;
  max_finish_date: string;
  total_duration_days: number;
  warnings_count: number;
}

export interface NormalisedScheduleResult {
  programme_name: string;
  status: "Draft" | "Active";
  source_file: string;
  source_format: ScheduleSourceFormat;
  import_timestamp: string;
  import_batch_id: string;
  
  contract_completion?: string;
  forecast_completion?: string;
  variance_days?: number;

  activities: NormalisedActivity[];
  relationships: NormalisedRelationship[];
  wbs_hierarchy: NormalisedWbsNode[];
  
  summary_notes: string;
  warnings: string[];
  validation_stats: ImportValidationStats;
}
