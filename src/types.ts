/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Company {
  id: string; // company_id placeholder for multi-tenancy RLS
  name: string;
  tradingName: string;
  trading_name?: string;
  registrationNumber: string;
  registration_number?: string;
  vatNumber: string;
  vat_number?: string;
  logoUrl?: string;
  address?: string;
  plan?: string;
  status?: string;
  vat_identification_number?: string;
  subscription_plan?: string;
  account_status?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  company_id?: string; // Compatibility
  phone?: string;
  avatarColor?: string; // Hex color or class
  discipline?: string; // E.g., Civil, Structural, Electrical, PM, QS
  nec4Certified?: boolean;
  professionalReg?: string; // E.g., ECSA Pr.Eng, SACPCM, etc.
  signatureText?: string; // Digital signing config
  preferredLanguage?: string;
  timezone?: string;
  password?: string;
}

export interface Project {
  id: string; // project_id
  company_id: string; // multi-tenancy key
  companyId?: string; // multi-tenancy camelCase
  code: string;
  name: string;
  contractNumber: string;
  contractType: string;
  location: string;
  client: string;
  valueRate: number; // in South African Rand (ZAR)
  progressPercentage: number;
  projectManager: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Completed" | "Suspended" | "Planning";
  quickNote?: string;
  quick_note?: string;
  temporaryStatusUpdate?: string;
  temporary_status_update?: string;
  quick_note_updated_at?: string;
  quickNoteUpdatedAt?: string;
}

export interface SiteDiary {
  id: string;
  project_id: string;
  projectId?: string; // camelCase
  company_id: string;
  companyId?: string; // camelCase
  diaryNumber: string;
  date: string;
  compiler: string;
  weatherCondition: string;
  temperatureCelcius: number;
  laborCount: number;
  plantCount: number;
  summaryOfActivities: string;
  progressUpdates: string[];
  delaysEncountered: string;
  delayHours: number;
  status: "Draft" | "Submitted" | "Approved";
}

export interface RFI {
  id: string;
  project_id: string;
  projectId?: string; // camelCase
  company_id: string;
  companyId?: string; // camelCase
  rfiNumber: string;
  title: string;
  description: string;
  discipline: "Structural" | "Civil" | "Electrical" | "Mechanical" | "Architectural" | "Surveying";
  raisedBy: string;
  assignedTo: string;
  dateRaised: string;
  dateRequired: string;
  status: "Open" | "Pending Review" | "Answered" | "Closed";
  priority: "High" | "Medium" | "Low";
  isOverdue: boolean;
}

export interface EarlyWarning {
  id: string;
  project_id: string;
  projectId?: string; // camelCase
  company_id: string;
  companyId?: string; // camelCase
  ewnNumber: string;
  title: string;
  description: string;
  notifiedBy: string;
  dateNotified: string;
  potentialImpact: "Cost" | "Time" | "Quality" | "Cost & Time" | "Cost, Time & Quality";
  riskRating: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "Discussed" | "Mitigated" | "Closed";
  registerDate: string;
}

export interface CompensationEvent {
  id: string;
  project_id: string;
  projectId?: string; // camelCase
  company_id: string;
  companyId?: string; // camelCase
  ceNumber: string;
  title: string;
  description: string;
  associatedEwn?: string; // EWN Number if referenced
  status: "Notified" | "Quotation Instructed" | "Quotation Submitted" | "Under Review" | "Implemented" | "Withdrawn";
  proposedCostInZar: number;
  proposedTimeExtensionDays: number;
  implementedCostInZar?: number;
  implementedTimeExtensionDays?: number;
  dateNotified: string;
}

export interface ProcurementItem {
  id: string;
  project_id: string;
  projectId?: string; // camelCase
  company_id: string;
  companyId?: string; // camelCase
  itemCode: string;
  description: string;
  category: "Materials" | "Plant Hire" | "Subcontractor" | "Services";
  requestedQuantity: string;
  leadTimeWeeks: number;
  requiredOnSiteDate: string;
  actualArrivalDate?: string;
  supplierName: string;
  status: "Requested" | "RFQs Issued" | "Ordered" | "In Transit" | "Delivered" | "Delayed";
  poValueZar: number;
}

export interface QualityChecklist {
  id: string;
  project_id: string;
  projectId?: string; // camelCase
  company_id: string;
  companyId?: string; // camelCase
  checklistNumber: string;
  title: string;
  locationDetails: string;
  inspectedBy: string;
  inspectionDate: string;
  status: "Approved" | "Passed with Comments" | "Failed, re-inspection required" | "Pending Inspection";
  nonConformanceRaised: boolean;
  ncrNumber?: string;
}

export interface DocumentItem {
  id: string;
  project_id: string;
  projectId?: string; // camelCase
  company_id: string;
  companyId?: string; // camelCase
  docNumber: string;
  title: string;
  revision: string;
  category: "Drawing" | "Specification" | "Method Statement" | "Safety Policy" | "Certificate";
  uploadedBy: string;
  uploadedDate: string;
  fileSize: string;
  fileType: string;
}

export interface ProgrammeProgressPoint {
  date: string;
  baselineProgress: number;
  forecastProgress: number;
  actualProgress: number;
}

export interface ProgrammeMilestone {
  id: string;
  name: string;
  plannedDate: string;
  forecastDate: string;
  actualDate?: string;
  status: "Not Started" | "On Track" | "Delayed" | "Complete";
  notes?: string;
}

export interface ProgrammeDelayRegion {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  severity: "Low" | "Medium" | "High";
}

export interface ProgrammeCriticalActivity {
  id: string;
  activityName: string;
  startDate: string;
  endDate: string;
  progress: number;
  isCritical: boolean;
}

export interface Programme {
  id: string;
  company_id: string;
  project_id: string;
  programme_name: string;
  status: "Draft" | "Approved" | "Active" | "Archived";
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProgrammeActivity {
  id: string;
  programme_id: string;
  company_id: string;
  project_id: string;
  parent_id?: string | null;
  wbs_code?: string;
  activity_name: string;
  description?: string;
  start_date?: string;
  finish_date?: string;
  duration?: number;
  baseline_start?: string;
  baseline_finish?: string;
  forecast_start?: string;
  forecast_finish?: string;
  actual_start?: string;
  actual_finish?: string;
  progress: number;
  status: "Not Started" | "In Progress" | "Complete" | "Delayed" | "On Hold";
  responsible_person?: string;
  float_days?: number;
  is_milestone: boolean;
  is_critical: boolean;
  sort_order: number;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProgrammeDependency {
  id: string;
  programme_id: string;
  company_id: string;
  project_id: string;
  predecessor_activity_id: string;
  successor_activity_id: string;
  dependency_type: "FS" | "SS" | "FF" | "SF";
  lag_days: number;
  created_at?: string;
}

// ==========================================
// MY ACTIONS SUBSYSTEM ENTITY
// ==========================================
export type ActionPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ActionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED" | "REQUIRES_APPROVAL";
export type ActionSourceType = "PO" | "NOTICE" | "RFI" | "NCR" | "CERTIFICATE" | "SUBMITTAL" | "INTELLIGENCE" | "SAFETY" | "MANUAL";

export interface ProjectAction {
  id: string;
  organisation_id: string;
  project_id: string;
  title: string;
  description?: string;
  owner_user_id: string;
  owner_name?: string;
  owner_role?: string;
  priority: ActionPriority;
  due_date: string;
  status: ActionStatus;
  source_type: ActionSourceType | string;
  source_id?: string;
  created_at?: string;
  updated_at?: string;
  
  // Matrix Intelligence Recommendations
  is_ai_recommended?: boolean;
  ai_confidence_score?: number;
  ai_rationale?: string;
  impact_summary?: string;
  requires_human_approval?: boolean;
  consequential_impact?: "HIGH_FINANCIAL" | "CONTRACTUAL_TIME" | "SAFETY_CRITICAL" | "ROUTINE";
  approved_by_user_id?: string;
  approved_at?: string;
}

// ==========================================
// MASTER DOCUMENT MANAGEMENT SYSTEM (DMS)
// ==========================================
export * from "./types/documentManagement";




export interface BillingPlan {
  id: string;
  code: string;
  name: string;
  amount_minor: number;
  currency: string;
  billing_interval: "monthly";
  trial_duration_minutes: number;
  cancel_anytime: boolean;
  is_active: boolean;
  paystack_plan_code?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type BillingSubscriptionStatus =
  | "pending_activation"
  | "trialing"
  | "active"
  | "non_renewing"
  | "past_due"
  | "expired"
  | "cancelled";

export interface BillingSubscription {
  id: string;
  company_id: string;
  plan_id: string;
  subscription_reference: string;
  status: BillingSubscriptionStatus;
  amount_minor: number;
  currency: string;
  billing_interval: "monthly";
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  next_renewal_at?: string | null;
  auto_renew_enabled: boolean;
  notice_message?: string | null;
  cancelled_at?: string | null;
  expired_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type BillingLedgerEventSource =
  | "user"
  | "system"
  | "paystack_webhook"
  | "reconciliation";

export interface BillingLedgerEvent {
  id: string;
  sequence_number: number;
  company_id: string;
  subscription_id: string;
  event_type: string;
  event_source: BillingLedgerEventSource;
  occurred_at: string;
  recorded_at: string;
  actor_profile_id?: string | null;
  deduplication_key?: string | null;
  event_data: Record<string, any>;
}

export interface StartBillingTrialParams {
  p_company_id: string;
  p_plan_code?: string;
}

export type BillingAccessMode = "full" | "grace_period" | "read_only";

export interface CompanyBillingEntitlement {
  company_id: string;
  subscription_id: string | null;
  subscription_status: string | null;
  entitlement_state: string;
  access_mode: BillingAccessMode;
  can_read: boolean;
  can_write: boolean;
  can_access_billing: boolean;
  can_export: boolean;
  can_access_settings: boolean;
  grace_started_at: string | null;
  grace_ends_at: string | null;
  read_only_since: string | null;
  reason_code: string;
  evaluated_at: string;
}




