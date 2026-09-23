export type ControlPointType = 
  | "Benchmark"
  | "Traverse Station"
  | "Monitoring Point"
  | "Boundary Peg"
  | "Control Pillar"
  | "GPS Station";

export type ControlPointStatus = 
  | "Active"
  | "Compromised"
  | "Destroyed"
  | "Pending Verification"
  | "Archived";

export interface ControlPoint {
  id: string;
  pointId: string;
  projectId: string;
  companyId: string;
  name: string;
  type: ControlPointType;
  easting: number;
  northing: number;
  elevation: number;
  status: ControlPointStatus;
  notes?: string;
  is_archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InstrumentType = 
  | "Total Station"
  | "GPS/GNSS Receiver"
  | "Digital Level"
  | "Drone / LiDAR"
  | "Optical Level"
  | "Laser Scanner";

export type InstrumentStatus = 
  | "In Service"
  | "In Calibration"
  | "Out of Service"
  | "Retired"
  | "Archived";

export type CalibrationState = "Valid" | "Approaching Expiry" | "Overdue" | "No Calibration Date";

export interface Instrument {
  id: string;
  instrumentId: string;
  projectId: string;
  companyId: string;
  name: string;
  type: InstrumentType;
  manufacturer: string;
  serialNumber: string;
  calibrationDate: string;
  calibrationExpiryDate: string;
  status: InstrumentStatus;
  notes?: string;
  is_archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CampaignDiscipline = 
  | "Civil"
  | "Topographic"
  | "As-Built"
  | "Structural Monitoring"
  | "Earthworks"
  | "Tunneling"
  | "Cadastral";

export type CampaignType = 
  | "Initial Survey"
  | "Monitoring Run"
  | "As-Built Verification"
  | "Setting Out"
  | "Control Verification"
  | "Volumetric Survey";

export type CampaignStatus = 
  | "Planned"
  | "In Progress"
  | "Completed"
  | "Under Review"
  | "Archived";

export interface Campaign {
  id: string;
  campaignCode: string;
  projectId: string;
  companyId: string;
  name: string;
  discipline: CampaignDiscipline;
  type: CampaignType;
  chainage: string;
  date: string;
  linkedPointIds: string[]; // ControlPoint IDs or Point IDs
  status: CampaignStatus;
  leadSurveyor?: string;
  notes?: string;
  is_archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getCalibrationState(expiryDateStr: string): CalibrationState {
  if (!expiryDateStr) return "No Calibration Date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) return "No Calibration Date";
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "Overdue";
  } else if (diffDays <= 30) {
    return "Approaching Expiry";
  } else {
    return "Valid";
  }
}
