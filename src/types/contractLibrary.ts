/**
 * Contract Library Types
 * Represents the complete standard contract tree: FIDIC, NEC, South Africa (GCC, JBCC), UK/International (JCT), and Custom.
 */

export type ContractFamily = 
  | "FIDIC" 
  | "NEC" 
  | "SOUTH_AFRICA" 
  | "UK_INTERNATIONAL" 
  | "CUSTOM";

export type DesignResponsibility = 
  | "Employer Design" 
  | "Contractor Design / EPC" 
  | "Design & Build (Shared)" 
  | "Professional Services / Consultancy" 
  | "Term & Facility Maintenance" 
  | "Subcontracting / Supply" 
  | "Bespoke / Multi-Disciplinary";

export interface ContractNoticeTemplate {
  id: string;
  noticeType: "eot_claim" | "cost_claim" | "early_warning" | "variation_proposal" | "payment_claim" | "completion_notice" | "defect_notice" | "dispute_referral";
  title: string;
  clauseReference: string;
  defaultTimeBarDays?: number;
  description: string;
  sampleBody: string;
  keyRequirements: string[];
}

export interface ContractClauseItem {
  clauseNumber: string;
  title: string;
  topic: 
    | "general" 
    | "notices" 
    | "supervision" 
    | "programme_time" 
    | "delays_eot" 
    | "quality_defects" 
    | "variations_pricing" 
    | "payment_certificates" 
    | "securities_guarantees" 
    | "risk_insurance" 
    | "suspension_termination" 
    | "claims_procedure" 
    | "dispute_resolution";
  summary: string;
  timeBarDays?: number;
  timeBarType?: "calendar_days" | "working_days" | "weeks";
  contractorRightOrDuty: string;
  employerRightOrDuty: string;
  administratorRole: string; // Engineer / Project Manager / Principal Agent / Employer's Agent
  practicalGuidance: string;
  standardForms?: string[];
}

export interface ContractLibraryItem {
  id: string;
  family: ContractFamily;
  categoryName: string; // e.g. "FIDIC", "NEC", "SOUTH AFRICA", "UK / INTERNATIONAL", "CUSTOM"
  groupName: string; // e.g. "Red Book", "NEC4", "GCC", "JBCC", "JCT", "Employer bespoke"
  subEdition?: string; // e.g. "1999", "2017 / 2022 reprint", "ECC", "ECS", "Principal Building Agreement"
  code: string;
  name: string;
  shortName: string;
  edition: string;
  publisher: string;
  governingBody: string;
  designResponsibility: DesignResponsibility;
  recommendedRegions: string[];
  corePhilosophy: string;
  riskProfile: "Balanced" | "Contractor Heavy" | "Employer Heavy" | "Target Cost / Collaborative";
  keyActors: {
    employer: string;
    contractor: string;
    administrator: string; // Engineer / PM / Principal Agent / Architect
    supervisor?: string;
    adjudicatorBoard: string; // DAAB / DAB / Adjudicator / AFSA / RICS
  };
  keyTimelines: {
    claimNoticeWindow: string;
    claimSubstantiationWindow: string;
    rulingWindow: string;
    paymentCertificationPeriod: string;
    paymentPeriod: string;
    latePaymentInterestFormula: string;
    defectsLiabilityPeriod: string;
    latentDefectsPeriod: string;
  };
  keyClauses: ContractClauseItem[];
  noticeTemplates: ContractNoticeTemplate[];
  isCustom?: boolean;
  isUploaded?: boolean;
  fileAttachment?: {
    name: string;
    size: string;
    uploadedAt: string;
    parsedClausesCount?: number;
  };
}

export interface ContractTreeNode {
  id: string;
  title: string;
  type: "category" | "group" | "edition" | "contract";
  itemCount?: number;
  children?: ContractTreeNode[];
  contractId?: string;
}
