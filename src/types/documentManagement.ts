/**
 * Project Matrix – Common Data Environment & Master Document Management System (DMS)
 * 
 * Production-grade data models, controlled entities, enums, relationship graph,
 * audit trails, and configuration schemas for enterprise construction engineering projects.
 */

// ============================================================================
// 1. PRIMARY CATEGORIES & SUB-CATEGORIES
// ============================================================================

export const DOCUMENT_MAIN_CATEGORIES = [
  "Statutory Documents",
  "Project Correspondence",
  "Specifications",
  "Permits & Licenses",
] as const;

export type DocumentMainCategory = typeof DOCUMENT_MAIN_CATEGORIES[number];

/**
 * Statutory Document Categories (16 standard construction governance subcategories)
 */
export const STATUTORY_DOCUMENT_CATEGORIES = [
  "Contractor's Appointment",
  "Signed Contract",
  "Performance Guarantee",
  "Insurance",
  "Advance Payment Guarantee",
  "Organogram",
  "Programme of Works",
  "Method Statements",
  "Cash Flow",
  "Labour Plan",
  "Plant Plan",
  "Site Layout",
  "OHS File",
  "Traffic Management Plan",
  "Environmental File",
  "Quality Control Plan",
] as const;

export type StatutoryDocumentCategory = typeof STATUTORY_DOCUMENT_CATEGORIES[number];

/**
 * Project Correspondence Subcategories
 */
export const CORRESPONDENCE_CATEGORIES = [
  "Email Correspondence",
  "Letters",
  "Meeting Minutes",
  "Site Instructions",
  "Variations",
  "Contractual Claims",
  "Non-Conformance",
  "Practical Completion Certificate",
  "Completion Certificate",
] as const;

export type CorrespondenceCategory = typeof CORRESPONDENCE_CATEGORIES[number];

/**
 * Specifications Subcategories
 */
export const SPECIFICATION_CATEGORIES = [
  "Scope of Work",
  "Bill of Quantities",
  "Drawings",
] as const;

export type SpecificationCategory = typeof SPECIFICATION_CATEGORIES[number];

/**
 * Engineering Drawing Disciplines (extensible via company config)
 */
export const DRAWING_DISCIPLINES = [
  "Civil Engineering",
  "Geotechnical Engineering",
  "Structural Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Survey",
] as const;

export type DrawingDiscipline = typeof DRAWING_DISCIPLINES[number] | string;

/**
 * Survey Subcategories
 */
export const SURVEY_CATEGORIES = [
  "Design Survey",
  "Revised Design Survey",
  "As-Built Survey",
] as const;

export type SurveyCategory = typeof SURVEY_CATEGORIES[number];

/**
 * Permits and Licenses Subcategories
 */
export const PERMIT_CATEGORIES = [
  "Environmental",
  "Occupational Health and Safety",
  "City Council",
  "Traditional Council",
  "Wayleaves",
] as const;

export type PermitCategory = typeof PERMIT_CATEGORIES[number];

/**
 * Wayleave Subcategories
 */
export const WAYLEAVE_CATEGORIES = [
  "Information Technology and Networking",
  "Oil and Gas",
  "Roads Agencies",
  "Water Agencies",
  "Power and Utilities",
  "Railway",
  "Mining Authorities",
  "Agriculture and Forestry",
  "Other",
] as const;

export type WayleaveCategory = typeof WAYLEAVE_CATEGORIES[number];


// ============================================================================
// 2. CORE STATUSES, APPROVALS & CONFIDENTIALITY ENUMS
// ============================================================================

export type DocumentType = 
  | "CONTRACT" 
  | "DRAWING" 
  | "CERTIFICATE" 
  | "REPORT" 
  | "SPECIFICATION" 
  | "TRANSMITTAL" 
  | "SUBMITTAL" 
  | "INSPECTION" 
  | "VARIATION" 
  | "CORRESPONDENCE" 
  | "OTHER";

export type DocumentStatus =
  | "Draft"
  | "Internal Review"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Issued"
  | "Current"
  | "Superseded"
  | "Archived"
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED"
  | "ISSUED_FOR_CONSTRUCTION";

export type ApprovalStatus =
  | "Not Submitted"
  | "Pending Review"
  | "Pending Approval"
  | "Approved"
  | "Rejected";

export type ConfidentialityLevel =
  | "Public"
  | "Internal"
  | "Confidential"
  | "Restricted";

export type CorrespondenceStatus =
  | "Draft"
  | "Internal Review"
  | "Approved"
  | "Issued"
  | "Responded"
  | "Closed";

export type PermitStatus =
  | "Not Applied"
  | "Application Prepared"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Expired"
  | "Renewal Required";

export type AuditAction =
  | "CREATE"
  | "UPLOAD"
  | "VIEW"
  | "DOWNLOAD"
  | "UPDATE_METADATA"
  | "SUBMIT"
  | "REVIEW"
  | "APPROVE"
  | "REJECT"
  | "ISSUE"
  | "NEW_REVISION"
  | "SUPERSEDE"
  | "ARCHIVE"
  | "RESTORE"
  | "DELETE";

export type DocumentPermission =
  | "documents.view"
  | "documents.upload"
  | "documents.edit_metadata"
  | "documents.submit"
  | "documents.review"
  | "documents.approve"
  | "documents.issue"
  | "documents.download"
  | "documents.archive"
  | "documents.restore"
  | "documents.delete"
  | "documents.view_confidential"
  | "documents.manage_revisions"
  | "documents.manage_registers"
  | "documents.manage_numbering";


// ============================================================================
// 3. MASTER DOCUMENT ENTITY (Single Source of Truth)
// ============================================================================

export interface MasterProjectDocument {
  id: string;

  companyId: string;
  projectId: string;
  contractId?: string;

  documentNumber: string;
  title: string;

  mainCategory: DocumentMainCategory;
  subcategory?: string;

  discipline?: string;

  revision: string; // e.g. "R00", "R01", "Rev A"

  documentDate?: string | Date; // ISO string or Date

  originator?: string; // e.g. "Knight Piésold", "SANRAL", "Main Contractor JV"

  uploadedBy: string; // User ID
  uploadedByName?: string;
  reviewedBy?: string;
  approvedBy?: string;

  status: DocumentStatus;
  approvalStatus?: ApprovalStatus;

  confidentiality: ConfidentialityLevel;

  effectiveDate?: string | Date;
  expiryDate?: string | Date;
  expiryWarningDays?: number; // default e.g. 30
  renewalStatus?: "Not Required" | "Active" | "Approaching Expiry" | "Expired" | "Renewal In Progress";

  responsibleUserId?: string;
  responsibleUserName?: string;

  // Cross-module relation link IDs
  relatedActivityIds: string[];
  relatedDocumentIds: string[];
  relatedContractClauses: string[];
  
  // Specific entity references for unified cross-module referencing
  contractIdRef?: string;
  activityIdRef?: string;
  claimIdRef?: string;
  variationIdRef?: string;
  drawingIdRef?: string;
  instructionIdRef?: string;
  paymentCertificateIdRef?: string;
  rfiIdRef?: string;

  // Physical file metadata
  fileName: string;
  fileType: string; // e.g. "PDF", "DWG", "XLSX", "DOCX", "PNG"
  fileSize: number; // in bytes
  fileUrl: string; // Storage URL or relative Supabase bucket path

  currentRevision: boolean;

  createdAt: string | Date;
  updatedAt: string | Date;

  archivedAt?: string | Date;
  deletedAt?: string | Date;
  deletedBy?: string;

  // Search & metadata enrichment
  description?: string;
  keywords?: string[];
  customFields?: Record<string, any>;
}


// ============================================================================
// 4. VERSION CONTROL & REVISION MODEL
// ============================================================================

export interface DocumentRevision {
  id: string;
  documentId: string;

  revision: string; // e.g. "R00", "R01", "R02"

  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;

  revisionDescription?: string;

  createdBy: string;
  createdByName?: string;
  createdAt: string | Date;

  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string | Date;

  status: DocumentStatus;
}


// ============================================================================
// 5. REGISTERS (Correspondence, Drawing, Permit)
// ============================================================================

export interface CorrespondenceRecord {
  id: string;
  companyId: string;
  projectId: string;
  contractId?: string;

  correspondenceNumber: string;
  documentType: string;
  subject: string;

  sender?: string;
  recipient?: string;

  dateIssued?: string | Date;
  dateReceived?: string | Date;

  responseRequired: boolean;
  responseDueDate?: string | Date;
  responseStatus?: CorrespondenceStatus;

  contractClause?: string;

  responsibleUserId?: string;
  responsibleUserName?: string;

  revision: string;
  status: DocumentStatus;

  relatedDocumentIds: string[];
  documentId?: string; // Master document link

  createdBy: string;
  createdByName?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DrawingRecord {
  id: string;

  companyId: string;
  projectId: string;

  drawingNumber: string;
  drawingTitle: string;

  discipline: DrawingDiscipline;
  subcategory?: SurveyCategory | string;

  revision: string;
  revisionDate: string | Date;

  designer?: string;
  checkedBy?: string;
  approvedBy?: string;

  approvalStatus: ApprovalStatus;

  dateReceived?: string | Date;
  dateIssued?: string | Date;

  supersedesDrawingId?: string;

  relatedRfiIds: string[];
  relatedSiteInstructionIds: string[];

  documentId: string; // Master controlled document link

  isCurrentRevision: boolean;
  status?: DocumentStatus;

  scale?: string; // e.g. "1:100 @ A1"
  cadFormat?: string; // e.g. "DWG", "BIM/IFC", "PDF"

  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PermitRecord {
  id: string;

  companyId: string;
  projectId: string;

  permitType: string; // Environmental, OHS, City Council, Traditional Council, Wayleaves
  wayleaveCategory?: WayleaveCategory;
  authority: string; // e.g. "Department of Water and Sanitation", "Eskom", "SANRAL"
  permitNumber?: string;

  applicationDate?: string | Date;
  approvalDate?: string | Date;

  effectiveDate?: string | Date;
  expiryDate?: string | Date;

  status: PermitStatus;

  responsibleUserId?: string;
  responsibleUserName?: string;

  conditions?: string;

  geographicArea?: string;
  chainageFrom?: string; // e.g. "Km 12+400"
  chainageTo?: string;   // e.g. "Km 18+950"

  relatedActivityIds: string[];
  supportingDocumentIds: string[];
  documentId?: string; // Master document link

  createdAt: string | Date;
  updatedAt: string | Date;
}


// ============================================================================
// 6. RELATIONSHIPS, COMMENTS & AUDIT LOGS
// ============================================================================

export interface DocumentRelationship {
  id: string;

  sourceDocumentId: string;
  targetDocumentId?: string;

  targetEntityType:
    | "Document"
    | "SiteInstruction"
    | "Variation"
    | "Claim"
    | "ProgrammeActivity"
    | "PaymentCertificate"
    | "RFI"
    | "Drawing";

  targetEntityId: string;

  relationshipType: string; // e.g. "SUPPORTS", "SUPERSEDES", "EVIDENCE_FOR", "INSTRUCTS", "RESULT_OF"

  createdBy: string;
  createdAt: string | Date;
}

export interface DocumentComment {
  id: string;

  documentId: string;

  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;

  comment: string;

  createdAt: string | Date;
  editedAt?: string | Date;
}

export interface DocumentAuditLog {
  id: string;

  companyId: string;
  projectId: string;

  documentId: string;
  documentNumber?: string;

  userId: string;
  userName?: string;
  userRole?: string;

  action: AuditAction;

  previousValue?: unknown;
  newValue?: unknown;

  revision?: string;

  timestamp: string | Date;

  ipAddress?: string;
  details?: string;
}


// ============================================================================
// 7. NUMBERING ENGINE, WORKFLOWS & RETENTION POLICIES
// ============================================================================

export interface DocumentNumberingConfig {
  companyId: string;

  prefix: string; // e.g. "PMX" or "SANRAL" or "JV"

  pattern: string; // Default: "{PREFIX}-{PROJECT}-{DISCIPLINE}-{TYPE}-{SEQUENCE}-{REVISION}"

  sequenceLength: number; // e.g. 4 for 0001

  revisionPrefix: string; // e.g. "R" for R00, R01 or "Rev"

  disciplineCodes: Record<string, string>; // e.g. { "Civil Engineering": "CIV", "Structural": "STR" }
  typeCodes: Record<string, string>; // e.g. { "Drawings": "DWG", "Letters": "LTR", "Permits": "PER" }
}

export interface ApprovalWorkflowStep {
  sequence: number;

  requiredRole?: string;
  requiredPermission?: string;

  action: "Review" | "Approve" | "Issue";
}

export interface ApprovalWorkflow {
  id: string;

  companyId: string;

  documentType: string;

  steps: ApprovalWorkflowStep[];
}

export interface DocumentRetentionPolicy {
  companyId: string;
  documentCategory: string;
  retentionYears: number; // e.g. 10 years for statutory, 7 for financial
}


// ============================================================================
// 8. DASHBOARD METRICS & FILTER PARAMETERS
// ============================================================================

export interface DocumentDashboardKPIs {
  totalDocuments: number;
  awaitingApproval: number;
  overdueResponses: number;
  expiringDocuments: number;
  openClaims: number;
  openVariations: number;
  outstandingWayleaves: number;
  latestRevisions: number;
}

export interface DocumentFilterParams {
  searchQuery?: string;
  project?: string;
  mainCategory?: DocumentMainCategory | "ALL";
  subcategory?: string | "ALL";
  discipline?: string | "ALL";
  status?: DocumentStatus | "ALL";
  approvalStatus?: ApprovalStatus | "ALL";
  confidentiality?: ConfidentialityLevel | "ALL";
  revision?: string;
  responsibleUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  expiringWithinDays?: number;
}


// ============================================================================
// 9. HELPER UTILITIES & CALCULATIONS
// ============================================================================

/**
 * Standard Expiry Alert Tiers in Days
 */
export const EXPIRY_ALERT_TIERS = [90, 60, 30, 14, 7, 0] as const;

/**
 * Determines whether a correspondence item is overdue
 */
export function calculateIsCorrespondenceOverdue(item: {
  responseRequired: boolean;
  responseDueDate?: string | Date;
  responseStatus?: CorrespondenceStatus;
}): boolean {
  if (!item.responseRequired || !item.responseDueDate) return false;
  if (item.responseStatus === "Responded" || item.responseStatus === "Closed") return false;
  
  const dueDate = new Date(item.responseDueDate);
  const now = new Date();
  return dueDate.getTime() < now.getTime();
}

/**
 * Evaluates document expiry status & alert level
 */
export function getDocumentExpiryWarning(expiryDateStr?: string | Date): {
  isExpired: boolean;
  daysRemaining: number | null;
  warningLevel: "expired" | "critical" | "warning" | "notice" | "good" | "none";
  label: string;
} {
  if (!expiryDateStr) {
    return { isExpired: false, daysRemaining: null, warningLevel: "none", label: "No Expiry" };
  }

  const expiry = new Date(expiryDateStr);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return { isExpired: true, daysRemaining, warningLevel: "expired", label: `Expired (${Math.abs(daysRemaining)}d ago)` };
  }
  if (daysRemaining <= 7) {
    return { isExpired: false, daysRemaining, warningLevel: "critical", label: `Expires in ${daysRemaining} days (Critical)` };
  }
  if (daysRemaining <= 30) {
    return { isExpired: false, daysRemaining, warningLevel: "warning", label: `Expires in ${daysRemaining} days` };
  }
  if (daysRemaining <= 90) {
    return { isExpired: false, daysRemaining, warningLevel: "notice", label: `Expires in ${daysRemaining} days (Notice)` };
  }

  return { isExpired: false, daysRemaining, warningLevel: "good", label: `Active (${daysRemaining} days remaining)` };
}

/**
 * Default standard company document numbering configuration
 */
export const DEFAULT_DOCUMENT_NUMBERING_CONFIG: DocumentNumberingConfig = {
  companyId: "default",
  prefix: "PMX",
  pattern: "{PREFIX}-{PROJECT}-{DISCIPLINE}-{TYPE}-{SEQUENCE}-{REVISION}",
  sequenceLength: 4,
  revisionPrefix: "R",
  disciplineCodes: {
    "Civil Engineering": "CIV",
    "Geotechnical Engineering": "GEO",
    "Structural Engineering": "STR",
    "Electrical Engineering": "ELE",
    "Mechanical Engineering": "MEC",
    "Survey": "SUR",
    "Commercial": "COM",
    "Legal": "LEG",
    "General": "GEN",
  },
  typeCodes: {
    "Contractor's Appointment": "APT",
    "Signed Contract": "CTR",
    "Performance Guarantee": "PGR",
    "Insurance": "INS",
    "Advance Payment Guarantee": "APG",
    "Programme of Works": "PRG",
    "Method Statements": "MET",
    "Site Layout": "LAY",
    "OHS File": "OHS",
    "Environmental File": "ENV",
    "Quality Control Plan": "QCP",
    "Email Correspondence": "EML",
    "Letters": "LTR",
    "Meeting Minutes": "MOM",
    "Site Instructions": "SI",
    "Variations": "VO",
    "Contractual Claims": "CLM",
    "Non-Conformance": "NCR",
    "Drawings": "DWG",
    "Scope of Work": "SCW",
    "Bill of Quantities": "BOQ",
    "Wayleaves": "WLV",
    "Environmental": "EVP",
    "Occupational Health and Safety": "OHP",
  },
};

/**
 * Generates an enterprise controlled document number
 */
export function generateDocumentNumber(params: {
  config?: DocumentNumberingConfig;
  projectCode: string;
  discipline?: string;
  categoryOrType: string;
  sequenceNumber: number;
  revisionNumber?: number | string;
}): string {
  const cfg = params.config || DEFAULT_DOCUMENT_NUMBERING_CONFIG;
  const prefix = cfg.prefix || "PMX";
  const project = (params.projectCode || "PROJ").toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  const disciplineCode = (params.discipline && cfg.disciplineCodes[params.discipline])
    ? cfg.disciplineCodes[params.discipline]
    : "GEN";

  const typeCode = cfg.typeCodes[params.categoryOrType] || "DOC";

  const seqStr = String(params.sequenceNumber).padStart(cfg.sequenceLength || 4, "0");

  let revStr = "R00";
  if (typeof params.revisionNumber === "number") {
    revStr = `${cfg.revisionPrefix || "R"}${String(params.revisionNumber).padStart(2, "0")}`;
  } else if (typeof params.revisionNumber === "string") {
    revStr = params.revisionNumber.startsWith(cfg.revisionPrefix || "R") 
      ? params.revisionNumber 
      : `${cfg.revisionPrefix || "R"}${params.revisionNumber}`;
  }

  return `${prefix}-${project}-${disciplineCode}-${typeCode}-${seqStr}-${revStr}`;
}

/**
 * Unified ProjectDocument interface for backward compatibility
 */
export interface ProjectDocument extends Partial<MasterProjectDocument> {
  id: string;
  projectId: string;
  title: string;
  status: DocumentStatus;
  
  // Legacy fields
  organisationId?: string;
  type?: DocumentType;
  reference?: string;
  uploadedByName?: string;
  uploadedAt?: string;
  fileMimeType?: string;
  extractedText?: string;
  classifiedTags?: string[];
  extractedMetadata?: {
    contractClauses?: string[];
    drawingScale?: string;
    discipline?: string;
    contractValueImpact?: number;
    completionDateImpactDays?: number;
    partiesInvolved?: string[];
    riskScore?: number;
    [key: string]: any;
  };
  isIndexed?: boolean;
  pipelineStage?: "STORED" | "TEXT_EXTRACTED" | "CLASSIFIED" | "METADATA_EXTRACTED" | "INDEXED" | "LINKED";
  
  // Database table project_documents compatibility
  company_id?: string;
  project_id?: string;
  folder_name?: string;
  subfolder_name?: string | null;
  document_title?: string;
  document_number?: string;
  document_date?: string;
  file_path?: string;
  file_name?: string;
  file_type?: string;
  file_size?: any;
  uploaded_by?: string;
  created_at?: string;
  updated_at?: string;
  _localFile?: File;
}

