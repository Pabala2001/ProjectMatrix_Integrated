export interface ITPItem {
  id: string; // e.g. "ITP-CIV-001"
  title: string; // Scope of Work / Element
  specClause: string; // Standard Spec Clause
  holdPoints: string; // Contract Hold Points (HP)
  witnessPoints: string; // Witness Points (WP)
  leadAuditor: string; // Lead QA Sign-Off
  status: string; // "Approved" | "Under Review" | "Pending Approval" | "Draft" | "Conditional"
  revision?: string;
  date?: string;
  notes?: string;
  company_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NCRItem {
  id: string; // e.g. "NCR-STR-014"
  title: string; // Deficiency Summary
  clause: string; // Specification Clause
  dateRaised: string;
  raisedBy: string;
  severity: "Minor" | "Major" | "Critical" | "Observation";
  location?: string;
  rootCause?: string;
  correctiveAction: string; // Approved Corrective Action (CAPA)
  targetDate?: string;
  status: "Open" | "Under Review" | "Rectification In Progress" | "Resolved & Closed" | "Closed";
  company_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TestResultItem {
  id: string; // e.g. "LAB-CONC-2026-089"
  testType: string; // Test Description / Type
  sampleRef: string; // Sampled Element / Chainage
  requiredSpec: string; // Required Specification
  achievedResult: string; // Achieved Result
  lab: string; // Testing Authority / Lab
  testDate?: string;
  tester?: string;
  resultStatus: "Compliant" | "Non-Compliant" | "Retest Required" | "Pending Lab Analysis";
  remarks?: string;
  company_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SafetyIncidentItem {
  id: string; // e.g. "INC-2026-001"
  date: string; // Date & Time
  type: "Near Miss" | "First Aid Case (FAC)" | "Medical Treatment Case (MTC)" | "Lost Time Injury (LTI)" | "Property Damage" | "Environmental Spill" | "Dangerous Occurrence";
  severity: "Low" | "Medium" | "High" | "Critical";
  location: string;
  description: string; // Incident Summary
  action: string; // Preventative Action / Immediate Action Taken
  rootCause?: string;
  reportedBy?: string;
  status: "Open" | "Under Investigation" | "Action Implemented" | "Closed";
  company_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ToolboxTalkItem {
  id: string; // e.g. "TBT-2026-012"
  topic: string; // Briefing Topic
  category: "Excavation & Shoring" | "Working at Heights" | "Plant & Pedestrian Interface" | "Hot Works & Fire" | "PPE & Ergonomics" | "Electrical Safety" | "Hazardous Substances" | "General Safety";
  date: string;
  presenter: string; // Supervisor / Presenter
  attendees: number; // Number of Attendees
  notes?: string;
  status: "Completed" | "Scheduled" | "Pending Sign-off";
  company_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PermitToWorkItem {
  id: string; // e.g. "PTW-HW-044"
  type: "Hot Work & Flame Cutting" | "Confined Space Entry" | "Deep Trenching / Excavation (>1.5m)" | "Heavy Tandem Crane Lifting" | "High Voltage Electrical Isolation" | "Night Shift Operations" | "Demolition & Structural Works";
  location: string; // Authorized Location
  issuedTo: string; // Assigned Crew / Subcontractor
  validFrom: string; // Validity Window From
  validTo: string; // Validity Window To
  pic: string; // Person In Charge (PIC) / Competent Person
  precautions?: string;
  status: "Active / Authorized" | "Pending Clearance" | "Expired" | "Closed Out" | "Suspended";
  company_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EnvironmentalItem {
  id: string; // e.g. "ENV-MON-001"
  parameter: string; // Parameter Monitored
  location: string; // Sampling Workface
  reading: string; // Measured Reading vs Limit
  frequency: string; // Mitigation Measure / Frequency
  lastChecked: string; // Last Verified
  inspector?: string;
  compliance: "Compliant" | "Action Required" | "Non-Compliant" | "Observation";
  notes?: string;
  company_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuditItem {
  id: string; // e.g. "AUD-ISO-2026-02"
  title: string; // Audit Title
  standard: "ISO 9001:2015 (Quality)" | "ISO 14001:2015 (Environmental)" | "ISO 45001:2018 (OH&S)" | "Client Contractual Audit" | "Statutory Inspection" | "Internal Corporate Audit";
  auditDate: string;
  auditor: string; // Lead Auditor
  findings: string; // Summary of Findings
  scope?: string;
  carCount?: number;
  outcome: "Passed (Zero NCRs)" | "Passed (Minor Observations)" | "Conditional Pass" | "Major Non-Conformance" | "Under Review";
  company_id?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}
