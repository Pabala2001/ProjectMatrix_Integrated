/**
 * Contract Rules Database Schema
 * Defines the normalized contract hierarchy:
 * Contract Family / Form / Edition
 *   ↓
 * Clause Reference & Identifier
 *   ↓
 * Procedural Requirement
 *   ↓
 * Trigger Event / Condition
 *   ↓
 * Deadline & Computation Formula
 *   ↓
 * Required Action
 *   ↓
 * Responsible Role
 *   ↓
 * Consequence of Non-Compliance (Time-bars, Deemed Approval, Dispute, Default Interest)
 */

export type ContractFamilyId = 
  | "FIDIC" 
  | "NEC" 
  | "SOUTH_AFRICA" 
  | "UK_INTERNATIONAL" 
  | "CUSTOM";

export type WorkflowCategory = 
  | "claims" 
  | "early_warning" 
  | "variations" 
  | "payment" 
  | "programme_time" 
  | "quality_defects" 
  | "supervision" 
  | "securities" 
  | "suspension_termination" 
  | "disputes";

export type ContractRole = 
  | "Contractor" 
  | "Employer" 
  | "Engineer" 
  | "Project Manager" 
  | "Principal Agent" 
  | "Supervisor" 
  | "Adjudicator" 
  | "DAAB" 
  | "Subcontractor";

export type TimeBarStrictness = 
  | "STRICT_TIME_BAR"      // Absolute forfeiture of rights if missed (e.g. FIDIC 20.2.1, NEC 61.3)
  | "DEEMED_ACCEPTANCE"    // Silence equals approval (e.g. FIDIC 3.7.3, NEC 62.6)
  | "STATUTORY_INTEREST"   // Right to claim financing charges / interest (e.g. FIDIC 14.8)
  | "DISPUTE_REFERRAL"     // Right to refer matter to adjudication/DAAB
  | "CONDITIONAL_BAR"      // Prejudice-based or discretionary bar
  | "GUIDELINE_ONLY";

export interface DeadlineRule {
  durationValue: number; // e.g. 28, 84, 42, 14, 56
  durationUnit: "calendar_days" | "working_days" | "weeks" | "months";
  computedFrom: "trigger_date" | "submission_date" | "instruction_date" | "certificate_date" | "awareness_date";
  extendable: boolean;
  extensionMechanism?: string;
}

export interface ContractRuleItem {
  id: string;
  contractSuiteCode: string; // e.g. "FIDIC_2017_RED", "NEC4_ECC", "GCC_2015", "JBCC_6_2"
  clauseIdentifier: string; // e.g. "20.2.1", "61.3", "10.1.1", "23.4.2"
  clauseTitle: string; // e.g. "Notice of Claim"
  workflowCategory: WorkflowCategory;
  
  // 1. Requirement
  requirementSummary: string; // e.g. "Formal notification of intention to claim Extension of Time (EOT) or Additional Payment"
  legalBasisSummary: string; // General description without quoting copyrighted text
  
  // 2. Trigger
  triggerCondition: string; // e.g. "Contractor becomes aware, or should have become aware, of the event or circumstance giving rise to the claim"
  triggerEventKey: string; // Machine-readable key: e.g. "contractor_awareness", "engineer_instruction", "unforeseen_physical_conditions"
  
  // 3. Deadline
  deadline: DeadlineRule;
  
  // 4. Required Action
  requiredAction: string; // e.g. "Submit formal Notice of Claim stating the event and citing contractual clause"
  noticeTemplateId?: string;
  requiredDeliverables: string[];
  
  // 5. Responsible Role
  responsibleRole: ContractRole;
  recipientRole: ContractRole;
  
  // 6. Consequence of Failure
  strictness: TimeBarStrictness;
  consequenceOfFailure: string; // e.g. "The Contractor shall not be entitled to any EOT or additional payment, and the Employer is discharged from all liability."
  reciprocalConsequence?: string; // e.g. If Engineer fails to respond within 42 days, deemed rejected/accepted
  
  // Cross-System Integration
  governanceCategory: "Time" | "Cost" | "Quality" | "Legal" | "Operational";
  standardFormsAvailable: string[];
}

/**
 * Active Project Contract Configuration
 * Stored per project, capturing all administrative parameters from the Wizard.
 */
export interface ProjectContractProfile {
  id: string;
  projectId: string;
  projectName: string;
  
  // 1. Standard Form Metadata
  family: ContractFamilyId;
  formName: string; // e.g. "Red Book (Construction)", "NEC4 ECC", "General Conditions of Contract (GCC)"
  edition: string; // e.g. "2017", "1999", "2022 reprint", "June 2017", "3rd Edition 2015", "Edition 6.2"
  suiteCode: string; // e.g. "FIDIC_2017_RED", "NEC4_ECC", "GCC_2015", "JBCC_6_2"
  amendments: string; // e.g. "2022 Reprint Amendments", "Secondary Options X1, X2, X7, Y(ZA)1, Z Clauses"
  governingLaw: string; // e.g. "Tanzania", "South Africa", "Kenya", "United Kingdom", "United Arab Emirates"
  contractLanguage: string; // e.g. "English"
  disputeForum: "DAAB" | "DAB" | "Adjudication" | "ICC Arbitration" | "AFSA Arbitration" | "TIArb" | "High Court";
  
  // 2. Key Contract Parties
  employer: {
    name: string;
    representative: string;
    organisation: string;
    address?: string;
    email?: string;
  };
  engineerOrPM: {
    roleTitle: "Engineer" | "Project Manager" | "Principal Agent" | "Employer's Agent" | "Architect";
    name: string;
    organisation: string;
    registrationNumber?: string; // e.g. PrEng, CEng MICE
    address?: string;
    email?: string;
  };
  contractor: {
    name: string;
    representative: string;
    organisation: string;
    registrationNumber?: string;
    email?: string;
  };
  
  // 3. Commercial & Financial Parameters
  commercial: {
    contractCurrency: string; // e.g. "TZS", "ZAR", "USD", "EUR"
    contractValue: number;
    contractValueFormatted: string;
    advancePaymentPercent: number; // e.g. 15%
    advancePaymentAmount: number;
    advancePaymentAmortisationRate: number; // e.g. 25% from interim certificates
    retentionPercent: number; // e.g. 10%
    retentionLimitPercent: number; // e.g. 5% cap
    performanceSecurityPercent: number; // e.g. 10%
    performanceSecurityExpiryDate?: string;
    delayDamagesPerDay: number;
    delayDamagesCapPercent: number; // e.g. 10% of Contract Value
    interestRateOnLatePayment: string; // e.g. "Central Bank Discount Rate + 3%"
  };
  
  // 4. Time, Milestones & Defect Periods
  timelines: {
    commencementDate: string; // e.g. "2024-02-01"
    timeForCompletionDays: number; // e.g. 730 days (24 months)
    completionTargetDate: string; // e.g. "2026-01-31"
    revisedCompletionDate?: string;
    defectsNotificationPeriodDays: number; // e.g. 365 days
    latentDefectsYears: number; // e.g. 5 years / 10 years
  };
  
  // 5. Procedural Rules & Period Overrides (Particular Conditions)
  proceduralRules: {
    claimNoticePeriodDays: number; // default 28
    detailedClaimSubmissionPeriodDays: number; // default 84
    engineerDeterminationPeriodDays: number; // default 42
    interimPaymentCertificationPeriodDays: number; // default 28
    paymentDuePeriodDays: number; // default 56 from IPC submission
    rfiResponseTurnaroundDays: number; // default 7
    submittalReviewPeriodDays: number; // default 21
  };
  
  // 6. Particular Conditions & Licensed Document Storage
  particularConditions: {
    hasCustomZClauses: boolean;
    zClausesSummary?: string;
    uploadedDocumentName?: string;
    uploadedDocumentSize?: string;
    uploadedDate?: string;
    licensedDocumentUrl?: string;
    customRulesOverrides?: Record<string, Partial<ContractRuleItem>>;
  };
  
  status: "Active & Administered" | "Draft Configuration" | "Archived";
  lastConfiguredAt: string;
}

/**
 * Notice Requirement Evaluation Result
 * Returned when screens query: ContractEngine.getNoticeRequirement(...)
 */
export interface NoticeRequirementEvaluation {
  isNoticeRequired: boolean;
  rule: ContractRuleItem;
  deadlineDate: string;
  daysRemaining: number;
  timeBarStatus: "COMPLIANT_WINDOW" | "URGENT_ACTION_REQUIRED" | "IMMINENT_TIME_BAR" | "TIME_BARRED";
  requiredActionSummary: string;
  responsibleRole: ContractRole;
  recipientRole: ContractRole;
  legalConsequence: string;
  draftingChecklist: string[];
  recommendedNoticeTemplate: string;
  governingLawNote: string;
}
