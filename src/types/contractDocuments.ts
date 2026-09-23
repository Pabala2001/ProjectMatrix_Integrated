import { ContractRole, WorkflowCategory, ContractRuleItem, TimeBarStrictness, DeadlineRule } from "./contractRules";

/**
 * Constituent Contract Document Categories
 * In construction law, the Contract is a multi-document bundle governed by strict precedence.
 */
export type ContractDocumentCategory = 
  | "FORM_OF_AGREEMENT"        // Priority 1: Formal signed Contract Agreement
  | "LETTER_OF_ACCEPTANCE"     // Priority 2: Letter of Acceptance / Award
  | "TENDER_OFFER"             // Priority 3: Form of Offer & Tender Returnables
  | "PARTICULAR_CONDITIONS"    // Priority 4: Part A (Contract Data) & Part B (Special Provisions / Z Clauses)
  | "GENERAL_CONDITIONS"       // Priority 5: Standard Unamended Base (e.g. FIDIC Red 2017, NEC4 ECC)
  | "EMPLOYER_REQUIREMENTS"    // Priority 6: Scope of Works, Employer's Brief
  | "SPECIFICATIONS"           // Priority 7: General & Particular Technical Specifications
  | "DRAWINGS"                 // Priority 8: Issued for Construction (IFC) Drawings & BIM Models
  | "BOQ"                      // Priority 9: Priced Bill of Quantities / Activity Schedule
  | "ADDENDA"                  // Priority 10: Tender Addenda & Post-Award Supplementary Agreements
  | "SITE_INSTRUCTION_RECORD"; // Auxiliary: Signed Site Instructions affecting scope

export type DocumentVersionStatus = 
  | "Active (Effective)" 
  | "Superseded" 
  | "Draft Revision" 
  | "Pending Approval"
  | "Archived";

export interface ClauseOverrideItem {
  id: string;
  targetClauseNumber: string; // e.g. "20.2.1", "14.7", "4.12", "8.4", "61.3"
  clauseTitle: string;
  modificationType: "MODIFIED" | "SUBSTITUTED" | "DELETED" | "ADDED" | "PRECEDENCE_OVERRIDE";
  originalBaseSummary: string; // Summary of base standard requirement
  amendedTextSummary: string; // Summary of the project-specific amended requirement
  operationalImpact: string; // Practical explanation of what changes for field teams
  responsibleRole?: ContractRole;
  timeBarStrictness?: TimeBarStrictness;
  
  // Parameter overrides for automated engine calculations
  parameterOverrides?: {
    deadlineDays?: number;
    deadlineUnit?: "calendar_days" | "working_days" | "weeks" | "months";
    detailedClaimDays?: number;
    engineerDeterminationDays?: number;
    paymentCertificationDays?: number;
    paymentDueDays?: number;
    retentionPercent?: number;
    delayDamagesPerDay?: number;
    advancePaymentAmortisationRate?: number;
  };
}

export interface ContractDocumentVersion {
  id: string;
  documentId: string;
  versionTag: string; // e.g. "Rev 1.0 (Baseline)", "Rev 1.1 (Addendum #2)", "Rev 2.0 (Particular Conditions Revision)"
  revisionNumber: number;
  effectiveDate: string; // ISO date string (e.g. "2024-02-01")
  uploadedAt: string;
  uploadedBy: string;
  status: DocumentVersionStatus;
  supersedesVersionId?: string;
  changeSummary: string;
  signatoryEmployerRepresentative?: string;
  signatoryContractorRepresentative?: string;
  
  fileMetadata: {
    fileName: string;
    fileSize: string;
    fileType: "PDF" | "DOCX" | "DWG" | "XLSX" | "IFC";
    hashChecksum: string; // SHA-256 simulation
    pagesCount?: number;
    storageUrl?: string;
  };
  
  clauseOverrides: ClauseOverrideItem[];
}

export interface ContractDocumentItem {
  id: string;
  projectId: string;
  category: ContractDocumentCategory;
  title: string;
  referenceCode: string; // e.g. "DOC-AGR-001", "DOC-PC-002", "DOC-SPEC-CIV-01"
  description: string;
  precedenceRank: number; // 1 (Highest) to 10 (Lowest)
  
  currentVersion: ContractDocumentVersion;
  versionHistory: ContractDocumentVersion[];
  
  isMandatory: boolean;
  governingLawRef?: string;
  tags: string[];
  lastModified: string;
}

export type EffectiveClauseStatus = 
  | "BASE_STANDARD_UNMODIFIED"          // Uses standard unamended base clause
  | "AMENDED_BY_PARTICULAR_CONDITIONS"  // Amended by Special Provisions / Z-Clauses
  | "OVERRIDDEN_BY_CONTRACT_DATA"       // Parameter set by Contract Data / Appendix to Tender
  | "CUSTOM_PROJECT_CLAUSE"             // Completely new clause introduced in project conditions
  | "DELETED_BY_AMENDMENT";             // Clause expressly deleted by particular conditions

export interface EffectiveContractClause {
  clauseIdentifier: string; // e.g. "20.2.1"
  clauseTitle: string;
  workflowCategory: WorkflowCategory;
  status: EffectiveClauseStatus;
  
  // Baseline vs Amended
  baseStandardRule: ContractRuleItem;
  effectiveRule: ContractRuleItem;
  
  // Traceability & Precedence Hierarchy
  sourceDocumentHierarchy: Array<{
    documentTitle: string;
    documentCategory: ContractDocumentCategory;
    referenceCode: string;
    versionTag: string;
    precedenceRank: number;
    isOverriding: boolean;
    modificationSummary?: string;
  }>;
  
  amendmentReference?: string; // e.g. "Particular Conditions Part B, Sub-Clause 20.2.1 [Rev 2.0]"
  operationalDeltaSummary: string; // e.g. "Time-bar window reduced from 28 days to 14 calendar days; mandatory notice to Engineer and Employer"
  precedenceReasoning: string; // Legal explanation of why this version takes precedence
  governingLawImpact: string;
}

export interface EffectiveContractSynthesis {
  projectId: string;
  projectName: string;
  baseStandard: {
    family: string;
    form: string;
    edition: string;
    suiteCode: string;
    unmodifiedClausesCount: number;
  };
  
  documentsHierarchy: ContractDocumentItem[];
  orderOfPrecedenceList: Array<{
    rank: number;
    category: ContractDocumentCategory;
    title: string;
    clauseRef: string;
    activeDocumentRef: string;
    activeVersion: string;
  }>;
  
  effectiveClauses: EffectiveContractClause[];
  
  synthesisMetrics: {
    totalEffectiveClauses: number;
    unmodifiedClausesCount: number;
    amendedClausesCount: number;
    shortenedTimeBarsCount: number;
    strictnessElevatedCount: number;
    customZClausesCount: number;
  };
  
  versionFingerprint: string;
  lastSynthesizedAt: string;
}
