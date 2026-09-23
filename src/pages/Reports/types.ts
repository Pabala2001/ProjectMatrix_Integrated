export type ReportCategory = "Progress" | "Environmental" | "Occupational Health and Safety";
export type ReportFrequency = "Daily" | "Weekly" | "Monthly";

export interface DocumentControl {
  revision_number: string;
  revision_date: string;
  prepared_by: string;
  reviewed_by: string;
  approved_by: string;
  prepared_by_signature?: string;
  prepared_print_name: string;
  prepared_title: string;
  prepared_date: string;
  reviewed_by_signature?: string;
  reviewed_print_name: string;
  reviewed_title: string;
  reviewed_date: string;
}

export interface TeamMember {
  role: string;
  organization: string;
  designation: string;
  name: string;
}

export interface ScopeItem {
  id: string;
  text: string;
}

export interface ProgrammeProgress {
  overall_percentage: string;
  summary_notes: string;
  current_items: { id: string; text: string }[];
  completed_items: { id: string; text: string }[];
}

export interface TechnicalActivity {
  id: string;
  description: string;
  quantity: string;
  unit?: string;
  status?: string;
  challenges: string;
}

export interface WeeklyAchievement {
  id: string;
  task_description: string;
  location_section: string;
  planned_qty: string;
  actual_qty: string;
  unit: string;
  completion_pct: string;
  variance_notes: string;
}

export interface MilestoneItem {
  id: string;
  milestone_name: string;
  target_date: string;
  status: "Achieved" | "Ongoing" | "Delayed";
  completion_pct: string;
}

export interface PerformanceItem {
  id: string;
  key_deliverable: string;
  planned_target: string;
  actual_achieved: string;
  variance_explanation: string;
}

export interface RiskDelayItem {
  id: string;
  risk_description: string;
  impact_level: "High" | "Medium" | "Low";
  mitigation_action: string;
  owner: string;
}

export interface PlantItem {
  id: string;
  item: string;
  quantity: string;
  notes: string;
}

export interface FuelRecord {
  id: string;
  plant_no: string;
  plant_type: string;
  driver: string;
  fuel_used: string;
  start_hours: string;
  stop_hours: string;
  total_hours: string;
  owner: string;
}

export interface PersonnelPresent {
  id: string;
  personnel: string;
  quantity: string;
}

export interface SitePicture {
  id: string;
  image: string; // base64 or storage path
  caption: string;
  notes?: string;
}

export interface NextPlanItem {
  id: string;
  text: string;
}

export interface ChallengeItem {
  id: string;
  text: string;
}

// Category-Specific Sections
export interface EnvironmentalMetrics {
  waste_disposed_kg?: string;
  water_consumption_litres?: string;
  spill_incidents_count?: string;
  air_quality_status?: string;
  noise_level_status?: string;
  environmental_notes?: string;
}

export interface OHSMetrics {
  safe_man_hours?: string;
  near_misses_count?: string;
  first_aid_incidents?: string;
  lost_time_injuries?: string;
  toolbox_talk_topic?: string;
  ppe_compliance_pct?: string;
  ohs_notes?: string;
}

// Period-Specific Data Sections
export interface PlannedVsActualProgress {
  planned_pct: string;
  actual_pct: string;
  variance_pct: string;
  cumulative_planned_pct: string;
  cumulative_actual_pct: string;
  summary_notes: string;
}

export interface MonthlyProgressSummary {
  monthly_planned_pct: string;
  monthly_actual_pct: string;
  cumulative_planned_pct: string;
  cumulative_actual_pct: string;
  spi_index: string;
  progress_status: "On Track" | "Ahead of Schedule" | "Behind Schedule";
  summary_notes: string;
}

export interface MonthlyResourceSummary {
  total_man_hours: string;
  peak_personnel: string;
  key_plant_deployed: string;
  total_fuel_consumed: string;
  notes: string;
}

export interface ReportFormData {
  client_name: string;
  contractor_name: string;
  project_name: string;
  contract_number: string;
  report_title: string;
  report_number: string;
  report_date: string;
  period_start_date?: string;
  period_end_date?: string;
  report_month?: string;
  report_year?: number;
  category: ReportCategory;
  frequency: ReportFrequency;
  company_logo: string;
  client_logo: string;
  doc_control: DocumentControl;
  introduction: string;
  project_team: TeamMember[];
  scope_of_work: ScopeItem[];
  programme_progress: ProgrammeProgress;

  // Daily Specific
  technical_activities: TechnicalActivity[];

  // Weekly Specific
  weekly_achievements?: WeeklyAchievement[];
  planned_vs_actual?: PlannedVsActualProgress;

  // Monthly Specific
  monthly_progress_summary?: MonthlyProgressSummary;
  monthly_milestones?: MilestoneItem[];
  planned_vs_actual_performance?: PerformanceItem[];
  monthly_resource_summary?: MonthlyResourceSummary;
  major_risks_and_delays?: RiskDelayItem[];

  // Common Site Resources
  plant_on_site: PlantItem[];
  fuel_used: FuelRecord[];
  personnel_on_site: PersonnelPresent[];
  site_pictures: SitePicture[];
  next_work_plan: NextPlanItem[];
  challenges: ChallengeItem[];

  // Special Category Metrics
  environmental_metrics?: EnvironmentalMetrics;
  ohs_metrics?: OHSMetrics;

  // Manual upload properties
  uploadType?: string;
  notes?: string;
  originalFileName?: string;
  fileMimeType?: string;
  createdDate?: string;
  updatedDate?: string;
}

export interface TechnicalReportRecord {
  id: string;
  company_id: string;
  project_id: string;
  category: ReportCategory;
  frequency: ReportFrequency;
  report_date: string;
  report_month: string; // e.g. "July"
  report_year: number; // e.g. 2026
  report_number: string;
  title: string;
  status: "Draft" | "Final" | string;
  form_data: ReportFormData;
  file_path?: string | null;
  docx_file_path?: string | null;
  original_file_name?: string | null;
  file_mime_type?: string | null;
  file_size_bytes?: number | null;
  source_type?: "Uploaded" | "Generated" | string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Category key helpers
export function normalizeCategory(key?: string): ReportCategory {
  if (!key) return "Progress";
  const lower = key.toLowerCase();
  if (lower.includes("env")) return "Environmental";
  if (lower.includes("ohs") || lower.includes("health") || lower.includes("safety")) return "Occupational Health and Safety";
  return "Progress";
}

export function normalizeFrequency(key?: string): ReportFrequency {
  if (!key) return "Daily";
  const lower = key.toLowerCase();
  if (lower.includes("week")) return "Weekly";
  if (lower.includes("month")) return "Monthly";
  return "Daily";
}

export function categoryToSlug(cat: ReportCategory): string {
  switch (cat) {
    case "Progress": return "progress";
    case "Environmental": return "environmental";
    case "Occupational Health and Safety": return "ohs";
  }
}

export function frequencyToSlug(freq: ReportFrequency): string {
  return freq.toLowerCase();
}
