export type ResourceDomainTab = "workforce" | "plant" | "materials" | "logistics";
export type WorkforceSubTab = "staff" | "labourers" | "artisans" | "foremen" | "drivers" | "timesheets" | "competency";
export type PlantSubTab = "fleet" | "allocation" | "hours" | "maintenance";
export type MaterialsSubTab = "inventory" | "consumption" | "deliveries";
export type LogisticsSubTab = "transport" | "dispatch" | "movement";

export type ResourceRecordType = 
  | "workforce_staff"
  | "workforce_labourer"
  | "workforce_competency"
  | "workforce_timesheet"
  | "plant_asset"
  | "plant_allocation"
  | "plant_hours"
  | "plant_maintenance"
  | "material_inventory"
  | "material_delivery"
  | "material_consumption"
  | "logistics_transport"
  | "logistics_dispatch"
  | "logistics_movement";

// 1. WORKFORCE INTERFACES
export interface StaffRecord {
  id: string;
  projectId: string;
  name: string;
  category: "Staff" | "Foremen" | "Artisans" | "Drivers" | "Labour" | "Management";
  role: string;
  trade: string;
  cert: string;
  location: string;
  contact: string;
  status?: "Active" | "On Leave" | "Standby" | "Demobilized";
  email?: string;
  nationalId?: string;
  dateJoined?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabourerRecord {
  id: string;
  projectId: string;
  name: string;
  role: string;
  squad: string;
  trade: string;
  lead: string;
  shift: string;
  dailyRate: string;
  location: string;
  status: string;
  emergencyContact?: string;
  dateAssigned?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompetencyRecord {
  id: string;
  projectId: string;
  person: string;
  role: string;
  accreditation: string;
  certNumber: string;
  issuingBody: string;
  validUntil: string;
  status: string;
  documentUrl?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimesheetRecord {
  id: string;
  projectId: string;
  worker: string;
  category: string;
  role: string;
  weekEnding: string;
  regularHours: number | string;
  overtimeHours: number | string;
  total: number | string;
  verifiedBy: string;
  status: "Approved" | "Pending" | "Rejected" | "Under Review";
  notes?: string;
  workface?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 2. PLANT INTERFACES
export interface PlantAssetRecord {
  id: string;
  projectId: string;
  tag: string;
  name: string;
  category: string;
  allocation: string;
  operator: string;
  hoursToday: string | number;
  fuelPct: string;
  nextService: string;
  condition: string;
  status: string;
  serialNumber?: string;
  telematicsId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlantAllocationRecord {
  id: string;
  projectId: string;
  tag: string;
  plantName: string;
  workface: string;
  operator: string;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlantHoursRecord {
  id: string;
  projectId: string;
  tag: string;
  plantName: string;
  date: string;
  shift: string;
  startHours: number | string;
  endHours: number | string;
  totalHours: number | string;
  fuelConsumedLiters: number | string;
  operator: string;
  supervisor: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlantMaintenanceRecord {
  id: string;
  projectId: string;
  tag: string;
  plantName: string;
  serviceType: string;
  serviceDate: string;
  technician: string;
  nextDueDate: string;
  partsReplaced: string;
  cost: string | number;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 3. MATERIALS INTERFACES
export interface MaterialInventoryRecord {
  id: string;
  projectId: string;
  code: string;
  name: string;
  category?: string;
  stockOnHand: string | number;
  unit: string;
  dailyConsumption: string | number;
  reorderLevel: string | number;
  batchCert: string;
  supplier: string;
  location?: string;
  receivedQty?: string | number;
  consumedQty?: string | number;
  status: string;
  unitCost?: string | number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaterialDeliveryRecord {
  id: string;
  projectId: string;
  deliveryRef: string;
  materialCode: string;
  materialName: string;
  quantityReceived: string | number;
  unit: string;
  supplier: string;
  deliveryDate: string;
  batchCert: string;
  receivedBy: string;
  vehicleReg: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MaterialConsumptionRecord {
  id: string;
  projectId: string;
  issueRef: string;
  materialCode: string;
  materialName: string;
  quantityIssued: string | number;
  unit: string;
  workface: string;
  issueDate: string;
  issuedTo: string;
  approvedBy: string;
  purpose: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 4. LOGISTICS INTERFACES
export interface LogisticsTransportRecord {
  id: string;
  projectId: string;
  consignment: string;
  origin: string;
  destination: string;
  driver: string;
  vehicle: string;
  loadWeight: string;
  departure: string;
  eta: string;
  status: string;
  haulierCompany?: string;
  waybillRef?: string;
  cargoDescription?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LogisticsDispatchRecord {
  id: string;
  projectId: string;
  dispatchRef: string;
  transporter: string;
  origin: string;
  destination: string;
  loadDescription: string;
  loadWeight: string;
  driver: string;
  departureDate: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LogisticsMovementRecord {
  id: string;
  projectId: string;
  trackingRef: string;
  waybillRef: string;
  currentLocation: string;
  checkpoint: string;
  timestamp: string;
  driver: string;
  vehicleReg: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
