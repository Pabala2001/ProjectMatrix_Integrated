export type LeaveCategory = 
  | "annual"
  | "sick"
  | "maternity"
  | "paternity"
  | "compassionate"
  | "study"
  | "unpaid"
  | "compensatory"
  | "site_rr"
  | "public_holiday";

export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export type PaidStatus = "Fully Paid" | "Statutory Paid" | "Unpaid" | "Compensatory";

export interface LeavePolicy {
  id: LeaveCategory;
  name: string;
  shortCode: string;
  category: string;
  description: string;
  entitlementDaysPerYear: number;
  accrualRate: string; // e.g. "1.75 days per month worked"
  paidStatus: PaidStatus;
  requiresMedicalCertificate: boolean;
  requiresHandoverRelief: boolean;
  maxConsecutiveDays: number;
  noticePeriodDays: number;
  eligibility: string;
  statutoryReference: string; // e.g. "BCEA Section 20 / Labour Act 2026"
  carryOverLimitDays: number;
  color: {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
  };
}

export interface LeaveRequest {
  id: string;
  companyId: string;
  projectId?: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  employeeRole: string;
  department: string;
  contactNumber?: string;
  leaveType: LeaveCategory;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalWorkingDays: number;
  isHalfDay?: boolean;
  halfDayPeriod?: "morning" | "afternoon";
  reason: string;
  handoverColleague?: string;
  emergencyPhone?: string;
  medicalCertName?: string;
  medicalCertUploaded?: boolean;
  status: LeaveStatus;
  appliedAt: string;
  appliedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  managerComments?: string;
  payrollImpact?: "No Deduction (Paid)" | "Salary Deducted (Unpaid)" | "TOIL Balanced";
}

export interface EmployeeLeaveBalance {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  department: string;
  role: string;
  joinDate: string;
  annualEntitlement: number;
  annualAccruedToDate: number;
  annualUsed: number;
  annualPending: number;
  annualBalance: number;
  sickEntitlementCycle: number; // e.g., 30 or 36 days in 3-yr cycle
  sickUsedCycle: number;
  sickBalance: number;
  compassionateEntitlement: number;
  compassionateUsed: number;
  compassionateBalance: number;
  studyEntitlement: number;
  studyUsed: number;
  unpaidDaysTaken: number;
  siteRrRotationsTaken: number;
  totalLeaveTakenThisYear: number;
}
