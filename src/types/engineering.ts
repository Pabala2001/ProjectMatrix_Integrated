export type EngineeringDisciplineId =
  | "civil"
  | "structural"
  | "geotechnical"
  | "roads_pavements"
  | "drainage"
  | "water"
  | "electrical"
  | "mechanical"
  | "instrumentation"
  | "architecture"
  | "rail"
  | "utilities"
  | "survey_geospatial";

export interface DisciplineDefinition {
  id: EngineeringDisciplineId;
  name: string;
  code: string;
  category: "heavy_civil" | "building" | "systems" | "specialist";
  description: string;
  defaultForProjectTypes: string[]; // e.g. ["Highway", "Bridge", "Rail", "Building", "Water Treatment"]
  typicalDeliverables: string[];
}

export interface ProjectDisciplineConfig {
  projectId: string;
  projectName: string;
  projectType: string;
  activeDisciplineIds: EngineeringDisciplineId[];
  leadEngineers: Record<EngineeringDisciplineId, {
    name: string;
    organisation: string;
    registrationNumber: string; // e.g. PrEng 20140889, CEng MICE 649201
    role: string;
  }>;
}

// ----------------------------------------------------------------------
// 1. RFI (Request for Information) Types
// ----------------------------------------------------------------------
export type RFIStatus = 
  | "Draft"
  | "Submitted"
  | "Awaiting Consultant"
  | "Under Review"
  | "Responded"
  | "Closed"
  | "Overdue";

export type ImpactLevel = "Critical" | "High" | "Medium" | "Low" | "None";

export interface RFIAttachment {
  id?: string;
  type?: "Photo" | "Drawing Markup" | "Survey Data" | "Calculation" | "Official Letter" | "PDF" | "IMAGE" | "DWG" | string;
  name: string;
  fileSize?: string;
  size?: string;
  uploadedAt?: string;
  url?: string;
}

export interface EngineeringRFI {
  id: string;
  rfiNumber: string; // e.g. RFI-089
  title: string; // e.g. Foundation Level Discrepancy
  discipline: EngineeringDisciplineId;
  disciplineLabel: string;
  drawingRef: string; // e.g. STR-042 Rev C
  specRef: string; // e.g. 03 30 00
  location: string; // e.g. Pier P14
  chainage?: string; // e.g. Km 14+250
  raisedBy: string; // e.g. Site Engineer - Thabo Nkosi
  raisedByRole: string;
  raisedDate: string; // e.g. 18 Aug 2026
  responseDueDate: string; // e.g. 21 Aug 2026
  status: RFIStatus;
  priority: ImpactLevel;
  questionText: string;
  proposedSolution?: string;
  consultantResponse?: string;
  respondedBy?: string;
  respondedDate?: string;
  
  // Cross-Module Impact Assessment
  constructionImpact: ImpactLevel;
  constructionImpactDetails: string;
  
  programmeImpact: {
    hasImpact: boolean;
    activityId: string; // e.g. ST-140
    activityName: string; // e.g. Pier P14 Foundation Substructure
    durationImpactDays: number;
    isCriticalPath: boolean;
    details: string;
  };

  commercialImpact: {
    hasImpact: boolean;
    potentialVariation: boolean;
    estimatedCostImpact: number; // e.g. 45000
    boqItemRef?: string; // e.g. BOQ-CIV-04
    details: string;
  };

  contractClauseRef: {
    framework: string; // e.g. FIDIC_2017_RED
    clauseNumber: string; // e.g. Sub-Clause 1.9
    clauseTitle: string; // e.g. Delayed Drawings or Instructions
  };

  attachments: RFIAttachment[];
  projectId?: string;
  companyId?: string;
  createdBy?: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  history?: Array<{
    id?: string;
    date: string;
    action: string;
    user: string;
    details?: string;
  }>;
}

// ----------------------------------------------------------------------
// 2. Technical Submittal Register Types
// ----------------------------------------------------------------------
export type SubmittalStatus = 
  | "APPROVED"
  | "APPROVED_AS_NOTED"
  | "REVISE_RESUBMIT"
  | "REJECTED"
  | "UNDER_REVIEW"
  | "Approved"
  | "Approved as Noted"
  | "Approved with Comments"
  | "Under Review"
  | "Revise & Resubmit"
  | "Revise and Resubmit"
  | "Submitted"
  | "Rejected"
  | string;

export type ProcurementSyncStatus = 
  | "Approved for Procurement"
  | "Blocked Pending Submittal Approval"
  | "PO Released"
  | "Delivered on Site"
  | "Procurement Pending"
  | "Quotation Under Review"
  | string;

export interface SubmittalDocumentChecklist {
  technicalDataSheet?: { attached: boolean; documentRef: string };
  testCertificate?: { attached: boolean; documentRef: string };
  complianceCertificate?: { attached: boolean; documentRef: string };
  sampleApproval?: { attached: boolean; documentRef: string };
  factoryAudit?: { attached: boolean; documentRef: string };
}

export interface TechnicalSubmittal {
  id: string;
  submittalNumber: string; // e.g. MAT-047
  title: string; // e.g. CEM I 42.5N Portland Cement
  discipline: EngineeringDisciplineId;
  specification: string; // e.g. 03 30 00 - Cast-in-Place Concrete
  supplier: string; // e.g. Mbeya Cement Ltd
  manufacturer?: string;
  submittedDate?: string; // e.g. 14 Aug 2026
  submissionDate?: string;
  status: SubmittalStatus;
  approvedBy?: string; // e.g. Resident Engineer / Dr. A. Mwamba
  approvalDate?: string;
  targetApprovalDate?: string;
  consultantRemarks?: string;
  revision: string; // e.g. Rev 0, Rev 1
  documents?: SubmittalDocumentChecklist;
  
  // Procurement Linkage
  procurementStatus?: ProcurementSyncStatus;
  linkedPurchaseOrder?: string; // e.g. PO-2026-088
  leadTimeWeeks?: number;
  criticalActivityRef?: string;
  contractClauseRef?: {
    framework: string;
    clauseNumber: string;
    clauseTitle: string;
  };
}

// ----------------------------------------------------------------------
// 3. Engineering Assurance & Governance Types
// ----------------------------------------------------------------------
export type CheckCategory = "Cat 1 (Internal)" | "Cat 2 (Peer Check)" | "Cat 3 (Independent Third Party)";

export interface SignOffSigner {
  name: string;
  organisation: string;
  registrationNumber: string;
  date: string;
  signedDate?: string;
  signed: boolean;
  title?: string;
}

export interface FormalSignOffChain {
  preparedBy: SignOffSigner;
  checkedBy: SignOffSigner;
  reviewedBy: SignOffSigner;
  approvedBy: SignOffSigner;
}

export interface DesignReviewItem {
  id: string;
  referenceNumber: string; // e.g. DR-STR-014
  package: string;
  packageNumber?: string;
  revision?: string;
  discipline: EngineeringDisciplineId;
  title: string;
  checkCategory: CheckCategory;
  independentCheckCategory?: string;
  independentCheckStatus?: string;
  independentCheckerOrg: string;
  submissionDate: string;
  approvalDate?: string;
  status: "Approved" | "Approved with Conditions" | "Under Review" | "Rejected" | string;
  signOffChain: FormalSignOffChain;
  findingsCount: { open: number; resolved: number };
  drawingNumbers?: string[];
}

export interface EngineeringDeviation {
  id: string;
  deviationNumber: string; // e.g. DEV-014
  title: string; // e.g. High early-strength additive adjustment
  discipline: EngineeringDisciplineId;
  specificationClause?: string;
  proposedDeparture?: string;
  engineeringJustification?: string;
  structuralImpactAssessment?: string;
  costScheduleImpact?: string;
  originalRequirement?: string;
  proposedDeviation?: string;
  approvedLimits?: string;
  status: "Approved by Engineer" | "Pending Review" | "Rejected" | "APPROVED" | "PENDING" | string;
  approvedBy: string;
  submittedBy?: string;
  dateApproved?: string;
  approvalDate?: string;
  resolutionDate?: string;
  riskLevel?: "Critical" | "High" | "Medium" | "Low" | string;
  signOffChain?: FormalSignOffChain;
}

export interface DesignAssumption {
  id: string;
  assumptionNumber?: string; // e.g. ASSUMP-03
  assumptionCode?: string;
  title: string;
  statement?: string;
  discipline: EngineeringDisciplineId;
  designBasis?: string; // e.g. Allowable soil bearing capacity 250 kPa at -3.2m
  validationTrigger?: string; // e.g. Plate load test before base slab pour
  verificationMethod?: string;
  siteTriggerHoldPoint?: string;
  targetLocation?: string;
  verifiedEvidenceRef?: string;
  verifiedDate?: string;
  targetValidationDate?: string;
  status: "Validated on Site" | "Awaiting Site Verification" | "Invalidated - Action Required" | "VERIFIED_ON_SITE" | "PENDING_SITE_VERIFICATION" | "INVALIDATED_ACTION_REQUIRED" | string;
  siteVerificationRef?: string;
  actionOwner?: string;
  criticality?: string;
  impactLevel?: string;
}

export interface TemporaryWorksItem {
  id: string;
  twNumber?: string; // e.g. TW-012
  itemNumber?: string;
  description?: string;
  title?: string; // e.g. Pier P14 Heavy Falsework & Cofferdam Shoring
  discipline: EngineeringDisciplineId;
  category?: "Cat 0" | "Cat 1" | "Cat 2" | "Cat 3" | string;
  checkCategory?: string;
  location?: string;
  status?: string;
  twcAppointed?: boolean;
  twdAppointed?: boolean;
  temporaryWorksCoordinator?: string; // TWC
  temporaryWorksDesigner?: string; // TWD
  designerName?: string;
  inspectionDueDate?: string;
  independentChecker?: string;
  permitNumber?: string;
  permitToLoadIssued?: boolean;
  permitToLoadDate?: string;
  permitToStrikeIssued?: boolean;
  permitToStrikeDate?: string;
  inspectionStatus?: "Inspected & Certified" | "Erection in Progress" | "Pending Inspection" | string;
  signOffChain?: FormalSignOffChain;
  designReference?: string;
}

export interface ConstructabilityReview {
  id: string;
  reviewNumber: string; // e.g. CR-08
  title: string;
  discipline: EngineeringDisciplineId;
  identifiedHazard: string;
  proposedMitigation: string;
  severity: ImpactLevel;
  status: "Mitigation Incorporated" | "Under Investigation" | "Closed" | string;
}

// ----------------------------------------------------------------------
// 4. Engineering Change Control (Design Change - DC) Types
// ----------------------------------------------------------------------
export interface EngineeringDesignChange {
  id: string;
  changeNumber: string; // e.g. DC-017
  title: string; // e.g. 900mm → 1200mm Precast Box Culvert Upsizing
  discipline: EngineeringDisciplineId;
  status: "APPROVED" | "UNDER_REVIEW" | "UNDER_EVALUATION" | "REJECTED" | "IMPLEMENTED" | "SUPERSEDED" | string;
  dateRaised?: string; // e.g. 10 Aug 2026
  initiatedDate?: string;
  targetApprovalDate?: string;
  proposedBy?: string;
  leadEngineer?: string;
  priority?: "High" | "Medium" | "Low" | string;
  location?: string; // e.g. Chainage Km 14+200
  reasonForChange?: string;
  reason?: string;
  consultantApprovedBy?: string;
  consultantApprovalDate?: string;

  // 6-Dimensional Cross-Module Impact Assessment
  technical?: {
    whatChanged: string;
    drawingRevisions: string[]; // e.g. ["DR-104 Rev D", "DR-105 Rev C"]
    specAmendments?: string[];
    approvalStatus?: "APPROVED" | "UNDER REVIEW" | "PENDING" | string;
    technicalSignOff?: string;
    affectedDrawings?: string[];
    supersededDrawings?: string[];
  };
  technicalImpact?: {
    whatChanged?: string;
    drawingRevisions?: string[];
    specAmendments?: string[];
    approvalStatus?: string;
    technicalSignOff?: string;
    supersededDrawings?: string[];
  };

  commercial?: {
    doesChangeCost: boolean;
    costImpact: number; // e.g. 84000
    costImpactFormatted: string; // e.g. "+$84,000"
    boqItemAffected: string; // e.g. Item 05.02 Precast Culvert Units
    commercialStatus: "COST ESTIMATED" | "VARIATION LODGED" | "CLAIM APPROVED" | string;
    netCostDelta?: number;
  };
  commercialImpact?: {
    hasImpact?: boolean;
    doesChangeCost?: boolean;
    costImpact?: number;
    costImpactFormatted?: string;
    estimatedCostImpact?: number;
    potentialVariation?: boolean;
    variationClause?: string;
    currency?: string;
    details?: string;
    boqItemAffected?: string;
    commercialStatus?: string;
    netCostDelta?: number;
  };

  programme?: {
    doesChangeDuration: boolean;
    durationImpactDays: number; // e.g. +4
    durationImpactFormatted: string; // e.g. "+4 days"
    affectedActivities: string[]; // e.g. ["DRN-040", "EARTH-088"]
    criticalPathImpact: boolean;
    programmeStatus: string;
    scheduleDeltaDays?: number;
  };
  programmeImpact?: {
    hasImpact?: boolean;
    doesChangeDuration?: boolean;
    activityId?: string;
    activityName?: string;
    durationImpactDays?: number;
    durationImpactFormatted?: string;
    affectedActivities?: string[];
    criticalPathImpact?: boolean;
    isCriticalPath?: boolean;
    details?: string;
    programmeStatus?: string;
    scheduleDeltaDays?: number;
  };

  procurement?: {
    actionRequired: string; // e.g. "Cancel PO-771 (900mm), Issue PO-782 for 1200mm units"
    procurementStatus: "ACTION REQUIRED" | "PO AMENDED" | "MATERIAL ON ORDER" | "DELIVERED" | string;
    affectedPOs: string[];
  };

  contract?: {
    isVariation: boolean;
    contractFramework: string; // e.g. FIDIC 2017 Red Book
    clauseRef: string; // e.g. Sub-Clause 13.3.1 (Variation Procedure)
    variationNoticeIssued: boolean;
    contractStatus: "VARIATION POTENTIAL" | "VO ISSUED" | "COMPENSATION EVENT" | string;
  };

  site?: {
    constructionStarted: boolean;
    siteStatus: "NOT STARTED" | "IN PROGRESS" | "REWORK REQUIRED" | "COMPLETED" | string;
    siteInstructions: string;
  };
}

// ----------------------------------------------------------------------
// 5. Digital Traceability Chain Item
// ----------------------------------------------------------------------
export interface DigitalTraceabilityItem {
  id: string;
  elementRef?: string;
  elementName?: string;
  location?: string;
  status?: string;
  drawingRef: string; // STR-042 Rev C
  drawingRevision?: string;
  drawingTitle: string; // Pier P14 Reinforced Concrete Details
  discipline: EngineeringDisciplineId;
  specificationRef: string; // Spec 03 30 00
  specificationTitle: string; // Cast-in-Place Structural Concrete
  methodStatementRef: string; // MS-014
  methodStatementTitle: string; // Substructure Concrete Pouring & Curing Method
  
  // Links to HSEQ Quality
  itpRef: string; // ITP-STR-04
  inspectionRequestRef: string; // IR-284
  cubeTestRef?: string; // CT-488 (7-day & 28-day 45MPa)
  densityTestRef?: string;
  ncrRef?: string; // NCR-012 (Closed)
  
  // Link to Survey & As-Built
  asBuiltSurveyRef: string; // AB-STR-042
  settingOutRef: string; // SO-2026-092
  
  overallTraceabilityStatus: "Fully Compliant & Closed" | "Inspection Pending" | "Open NCR Blocking" | "In Progress" | string;
}

// ----------------------------------------------------------------------
// 6. Survey & Geospatial Extended Types
// ----------------------------------------------------------------------
export interface SettingOutRecord {
  id: string;
  referenceNumber?: string; // e.g. SO-STR-092
  recordNumber?: string;
  elementName: string; // Pier P14 Pile Cap
  location?: string;
  discipline: EngineeringDisciplineId;
  chainage: string;
  offset: string;
  designedEasting: number;
  designedNorthing: number;
  designedElevation: number;
  measuredEasting: number;
  measuredNorthing: number;
  measuredElevation: number;
  deltaEastingMm: number; // e.g. +3 mm
  deltaNorthingMm: number; // e.g. -2 mm
  deltaElevationMm: number; // e.g. +1 mm
  toleranceMm: number; // e.g. ±10 mm
  status: "PASSED (Within Tolerance)" | "FLAGGED (Exceeds Tolerance)" | "PENDING CHECK" | string;
  toleranceStatus?: string;
  surveyor: string;
  instrumentUsed: string;
  instrumentStationPoint?: string;
  backsightPoint?: string;
  pointsStaked?: number;
  consultantWitnessedBy?: string;
  date: string;
}

export interface EarthworkVolumeComparison {
  id: string;
  sectionName?: string; // e.g. Cut Section Km 12+000 to 14+500
  title?: string;
  surveyNumber?: string;
  discipline?: EngineeringDisciplineId;
  surveyType?: "Drone LiDAR Flight" | "Total Station Grid" | "GNSS RTK Mesh" | string;
  calculationMethod?: string;
  dateMeasured?: string;
  surveyDate?: string;
  cutVolumeDesignedM3?: number;
  cutVolumeExcavatedM3?: number;
  cutVolumeM3?: number;
  fillVolumeDesignedM3?: number;
  fillVolumePlacedM3?: number;
  fillVolumeM3?: number;
  netVarianceM3?: number;
  netVolumeM3?: number;
  netBalanceM3?: number;
  percentageComplete?: number;
  dtmModelFile?: string;
  baselineSurfaceName?: string;
  comparisonSurfaceName?: string;
  linkedIPC?: string;
  cutFillType?: string;
  zoneChainage?: string;
  surveyMethod?: string;
  approvedBy?: string;
  designVolumeM3?: number;
  surveyedVolumeM3?: number;
  varianceVolumeM3?: number;
  percentVariance?: number;
  status?: string;
}

export interface SurveyControlPoint {
  id: string;
  pointId: string;
  type?: "Primary Benchmark (PBM)" | "Temporary Benchmark (TBM)" | "GNSS Base Station" | "Traverse Station" | string;
  easting: number;
  northing: number;
  elevation: number;
  status: "Verified Active" | "Requires Recalibration" | "Disturbed" | string;
  lastVerified?: string;
  lastVerifiedDate?: string;
  surveyor?: string;
  verifiedBy?: string;
  description?: string;
  order?: string;
}

export interface SurveyEquipmentCalibration {
  id: string;
  equipmentName?: string;
  instrumentName?: string;
  model?: string;
  serialNumber: string;
  certificateNumber: string;
  calibrationDate: string;
  expiryDate?: string;
  nextDueDate?: string;
  status: "CALIBRATED & VALID" | "EXPIRED" | "DUE IN 30 DAYS" | string;
  angularAccuracy?: string;
  distanceAccuracy?: string;
  verticalAccuracy?: string;
  certifiedBy?: string;
  calibratedBy?: string;
}

export interface DroneFlightSurvey {
  id: string;
  flightId?: string; // e.g. UAV-2026-034
  missionNumber?: string;
  missionName?: string;
  title?: string;
  date?: string;
  flightDate?: string;
  pilotInCommand?: string;
  droneModel?: string;
  uavModel?: string;
  coverageAreaHa?: number;
  areaSurveyedHa?: number;
  flightAltitudeM?: number;
  gsdCmPerPixel?: number; // Ground Sampling Distance
  groundSampleDistanceCm?: number;
  gcpsUsed?: number;
  orthomosaicUrl?: string;
  pointCloudDensity?: string;
  pointCloudDensityPtsM2?: number;
  processedOutputs?: string[];
  status?: "Processed & Validated" | "Processing Orthomosaic" | "GCP Verification Required" | string;
}

// Convenient type aliases
export type DesignChangeNotice = EngineeringDesignChange;
export type DesignReviewPackage = DesignReviewItem;
export type EarthworksVolumeSurvey = EarthworkVolumeComparison;
export type DroneSurveyMission = DroneFlightSurvey;
