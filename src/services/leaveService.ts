import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
import { LeaveCategory, LeavePolicy, LeaveRequest, EmployeeLeaveBalance } from "../types/leave";

export const LEAVE_POLICIES: LeavePolicy[] = [
  {
    id: "annual",
    name: "Annual / Vacation Leave",
    shortCode: "AL",
    category: "Statutory Paid",
    description: "Paid annual rest and recreation entitlement accrued per completed month of employment. Minimum 21 consecutive days / 15-21 working days per annum.",
    entitlementDaysPerYear: 21,
    accrualRate: "1.75 working days per completed month",
    paidStatus: "Fully Paid",
    requiresMedicalCertificate: false,
    requiresHandoverRelief: true,
    maxConsecutiveDays: 21,
    noticePeriodDays: 14,
    eligibility: "All permanent, contract, and salaried site personnel after 3 months probationary service.",
    statutoryReference: "BCEA Section 20 / ISO 45001 Workforce Wellbeing",
    carryOverLimitDays: 6,
    color: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      badgeBg: "bg-emerald-500/20",
      badgeText: "text-emerald-300"
    }
  },
  {
    id: "sick",
    name: "Sick / Medical Leave",
    shortCode: "SL",
    category: "Medical & Incapacity",
    description: "Paid medical incapacitation leave for illness, medical surgery, or occupational rehabilitation. Covers up to 30 working days over a 36-month cycle.",
    entitlementDaysPerYear: 12,
    accrualRate: "1 day for every 26 days worked during first 6 months, then full 3-year cycle",
    paidStatus: "Fully Paid",
    requiresMedicalCertificate: true,
    requiresHandoverRelief: false,
    maxConsecutiveDays: 30,
    noticePeriodDays: 0,
    eligibility: "Immediate from day one of active site deployment.",
    statutoryReference: "BCEA Section 22 / OHS Site Health Standards",
    carryOverLimitDays: 0,
    color: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-400",
      badgeBg: "bg-blue-500/20",
      badgeText: "text-blue-300"
    }
  },
  {
    id: "maternity",
    name: "Maternity Leave",
    shortCode: "ML",
    category: "Parental Care",
    description: "Statutory maternity rest entitlement for expecting and post-natal mothers. Covers at least 4 consecutive months (120-126 calendar days) with job role protection.",
    entitlementDaysPerYear: 120,
    accrualRate: "Statutory block entitlement upon confirmation of pregnancy",
    paidStatus: "Statutory Paid",
    requiresMedicalCertificate: true,
    requiresHandoverRelief: true,
    maxConsecutiveDays: 126,
    noticePeriodDays: 28,
    eligibility: "Female personnel with minimum 4 months continuous service prior to confinement.",
    statutoryReference: "BCEA Section 25 / ILO Convention No. 183",
    carryOverLimitDays: 0,
    color: {
      bg: "bg-pink-500/10",
      border: "border-pink-500/30",
      text: "text-pink-400",
      badgeBg: "bg-pink-500/20",
      badgeText: "text-pink-300"
    }
  },
  {
    id: "paternity",
    name: "Paternity / Parental Leave",
    shortCode: "PL",
    category: "Parental Care",
    description: "Paid parental leave granted to biological fathers or adoptive parents upon the birth or adoption of a child to support family integration.",
    entitlementDaysPerYear: 10,
    accrualRate: "10 consecutive working days per annual cycle on qualifying event",
    paidStatus: "Fully Paid",
    requiresMedicalCertificate: true,
    requiresHandoverRelief: true,
    maxConsecutiveDays: 10,
    noticePeriodDays: 14,
    eligibility: "All active male & adoptive personnel from commencement date.",
    statutoryReference: "Labour Laws Amendment Act / BCEA Sec 25A",
    carryOverLimitDays: 0,
    color: {
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      text: "text-cyan-400",
      badgeBg: "bg-cyan-500/20",
      badgeText: "text-cyan-300"
    }
  },
  {
    id: "compassionate",
    name: "Compassionate / Bereavement Leave",
    shortCode: "CL",
    category: "Family Responsibility",
    description: "Paid leave granted in the event of the bereavement or critical hospitalization of an immediate spouse, child, parent, sibling, or direct dependent.",
    entitlementDaysPerYear: 5,
    accrualRate: "5 days credited at start of annual employment cycle",
    paidStatus: "Fully Paid",
    requiresMedicalCertificate: false,
    requiresHandoverRelief: false,
    maxConsecutiveDays: 5,
    noticePeriodDays: 1,
    eligibility: "Permanent and fixed-term site employees with >4 months tenure.",
    statutoryReference: "BCEA Section 27 (Family Responsibility)",
    carryOverLimitDays: 0,
    color: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
      badgeBg: "bg-amber-500/20",
      badgeText: "text-amber-300"
    }
  },
  {
    id: "study",
    name: "Study & Examination Leave",
    shortCode: "ST",
    category: "Professional Development",
    description: "Paid leave granted to staff undertaking accredited engineering, quantity surveying, project management, or construction trade exams.",
    entitlementDaysPerYear: 6,
    accrualRate: "2 working days per approved exam paper (1 prep day + 1 exam day)",
    paidStatus: "Fully Paid",
    requiresMedicalCertificate: false,
    requiresHandoverRelief: true,
    maxConsecutiveDays: 4,
    noticePeriodDays: 21,
    eligibility: "Employees enrolled in certified ECSA, SACPCMP, or SACQSP accredited programs.",
    statutoryReference: "Corporate Skills Development & ECSA CPD Charter",
    carryOverLimitDays: 0,
    color: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/30",
      text: "text-purple-400",
      badgeBg: "bg-purple-500/20",
      badgeText: "text-purple-300"
    }
  },
  {
    id: "site_rr",
    name: "Site R&R (Rest & Recuperation) Rotation",
    shortCode: "RR",
    category: "Site Camp & Fly-In-Fly-Out",
    description: "Mandatory rotational rest cycle for remote construction camp, cross-border corridor, and fly-in fly-out engineering staff (e.g. 6 weeks on site / 2 weeks R&R).",
    entitlementDaysPerYear: 28,
    accrualRate: "14 consecutive days off for every 6 continuous weeks of remote site service",
    paidStatus: "Fully Paid",
    requiresMedicalCertificate: false,
    requiresHandoverRelief: true,
    maxConsecutiveDays: 14,
    noticePeriodDays: 14,
    eligibility: "Remote camp residents, tunnel engineers, and cross-border rail/corridor project teams.",
    statutoryReference: "FIDIC Remote Camp Labour Guidelines & OHS Directive",
    carryOverLimitDays: 0,
    color: {
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      text: "text-orange-400",
      badgeBg: "bg-orange-500/20",
      badgeText: "text-orange-300"
    }
  },
  {
    id: "compensatory",
    name: "Compensatory Time Off (TOIL)",
    shortCode: "TOIL",
    category: "Overtime Balance",
    description: "Paid compensatory time off banked in lieu of cash overtime for emergency Sunday continuous concrete pours, critical bridge launches, or holiday tie-ins.",
    entitlementDaysPerYear: 10,
    accrualRate: "1 hour off for each 1.5 hours of approved weekend/emergency site overtime",
    paidStatus: "Compensatory",
    requiresMedicalCertificate: false,
    requiresHandoverRelief: true,
    maxConsecutiveDays: 5,
    noticePeriodDays: 3,
    eligibility: "Site engineers, foremen, survey technicians, and plant operators on emergency shifts.",
    statutoryReference: "BCEA Section 10 Overtime In-Lieu Accord",
    carryOverLimitDays: 3,
    color: {
      bg: "bg-teal-500/10",
      border: "border-teal-500/30",
      text: "text-teal-400",
      badgeBg: "bg-teal-500/20",
      badgeText: "text-teal-300"
    }
  },
  {
    id: "unpaid",
    name: "Unpaid / Personal Sabbatical Leave",
    shortCode: "UL",
    category: "Discretionary",
    description: "Authorized absence from employment for extended personal matters, travel, or personal obligations where salary is withheld without contractual breach.",
    entitlementDaysPerYear: 30,
    accrualRate: "Discretionary executive approval required per application",
    paidStatus: "Unpaid",
    requiresMedicalCertificate: false,
    requiresHandoverRelief: true,
    maxConsecutiveDays: 30,
    noticePeriodDays: 30,
    eligibility: "All employees with at least 12 months continuous service with executive approval.",
    statutoryReference: "Corporate HR Policy Clause 42.4",
    carryOverLimitDays: 0,
    color: {
      bg: "bg-slate-500/10",
      border: "border-slate-500/30",
      text: "text-slate-400",
      badgeBg: "bg-slate-500/20",
      badgeText: "text-slate-300"
    }
  },
  {
    id: "public_holiday",
    name: "Public Holiday In-Lieu Leave",
    shortCode: "PH",
    category: "Statutory Paid",
    description: "Paid compensatory leave credit granted when a gazetted public holiday coincides with an urgent site shutdown milestone or Sunday rostered shift.",
    entitlementDaysPerYear: 12,
    accrualRate: "1 day credit per worked gazetted national public holiday",
    paidStatus: "Fully Paid",
    requiresMedicalCertificate: false,
    requiresHandoverRelief: false,
    maxConsecutiveDays: 3,
    noticePeriodDays: 5,
    eligibility: "All site staff required to maintain active operations on national holidays.",
    statutoryReference: "Public Holidays Act / BCEA Section 18",
    carryOverLimitDays: 2,
    color: {
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/30",
      text: "text-indigo-400",
      badgeBg: "bg-indigo-500/20",
      badgeText: "text-indigo-300"
    }
  }
];

const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: "lr-001",
    companyId: "comp-001",
    projectId: "proj-001",
    employeeId: "emp-101",
    employeeNumber: "EMP-2041",
    employeeName: "John Mokoena",
    employeeRole: "Senior Site Agent",
    department: "Civil Engineering",
    contactNumber: "+27 82 555 1042",
    leaveType: "annual",
    leaveTypeName: "Annual / Vacation Leave",
    startDate: "2026-08-24",
    endDate: "2026-08-28",
    totalWorkingDays: 5,
    reason: "Mid-year family vacation and scheduled rest between bridge deck casting stages.",
    handoverColleague: "Sipho Nkosi (General Foreman)",
    emergencyPhone: "+27 82 555 1042",
    status: "Approved",
    appliedAt: "2026-08-10T09:30:00Z",
    appliedBy: "John Mokoena",
    reviewedBy: "Sarah Jenkins (Project Director)",
    reviewedAt: "2026-08-12T14:15:00Z",
    managerComments: "Approved. Handover protocol for Bridge Pier P3 verified with Sipho.",
    payrollImpact: "No Deduction (Paid)"
  },
  {
    id: "lr-002",
    companyId: "comp-001",
    projectId: "proj-001",
    employeeId: "emp-102",
    employeeNumber: "EMP-2088",
    employeeName: "David Ndlovu",
    employeeRole: "Survey Technician",
    department: "Geomatics & Survey",
    contactNumber: "+27 71 888 3491",
    leaveType: "sick",
    leaveTypeName: "Sick / Medical Leave",
    startDate: "2026-08-14",
    endDate: "2026-08-17",
    totalWorkingDays: 2,
    reason: "Severe acute bronchitis. Doctor issued 4-day medical certificate and rest order.",
    handoverColleague: "Tebogo Khumalo (Junior Surveyor)",
    emergencyPhone: "+27 71 888 3491",
    medicalCertName: "Medical_Certificate_Dr_Pretorius_Aug2026.pdf",
    medicalCertUploaded: true,
    status: "Approved",
    appliedAt: "2026-08-14T07:10:00Z",
    appliedBy: "David Ndlovu",
    reviewedBy: "John Mokoena (Senior Site Agent)",
    reviewedAt: "2026-08-14T08:45:00Z",
    managerComments: "Medical certificate verified and on file with site safety officer.",
    payrollImpact: "No Deduction (Paid)"
  },
  {
    id: "lr-003",
    companyId: "comp-001",
    projectId: "proj-001",
    employeeId: "emp-103",
    employeeNumber: "EMP-2105",
    employeeName: "Lerato Dlamini",
    employeeRole: "Junior Quantity Surveyor",
    department: "Commercial & Cost Control",
    contactNumber: "+27 83 444 9012",
    leaveType: "study",
    leaveTypeName: "Study & Examination Leave",
    startDate: "2026-09-02",
    endDate: "2026-09-04",
    totalWorkingDays: 3,
    reason: "SACQSP Council Professional Practice Examination (Part 2 Commercial Law & Measurement).",
    handoverColleague: "Commercial Operations Team",
    emergencyPhone: "+27 83 444 9012",
    medicalCertName: "SACQSP_Exam_Timetable_Verification.pdf",
    medicalCertUploaded: true,
    status: "Pending",
    appliedAt: "2026-08-15T11:20:00Z",
    appliedBy: "Lerato Dlamini",
    managerComments: "Awaiting Commercial Director final sign-off.",
    payrollImpact: "No Deduction (Paid)"
  },
  {
    id: "lr-004",
    companyId: "comp-001",
    projectId: "proj-001",
    employeeId: "emp-104",
    employeeNumber: "EMP-2144",
    employeeName: "Sipho Nkosi",
    employeeRole: "Earthworks Foreman",
    department: "Plant & Operations",
    contactNumber: "+27 79 123 4567",
    leaveType: "site_rr",
    leaveTypeName: "Site R&R (Rest & Recuperation) Rotation",
    startDate: "2026-08-31",
    endDate: "2026-09-11",
    totalWorkingDays: 10,
    reason: "Completed 7 continuous weeks of 24/7 cut-and-fill bulk earthworks shift supervision.",
    handoverColleague: "Kagiso Molefe (Assistant Foreman)",
    emergencyPhone: "+27 79 123 4567",
    status: "Approved",
    appliedAt: "2026-08-12T16:00:00Z",
    appliedBy: "Sipho Nkosi",
    reviewedBy: "Sarah Jenkins (Project Director)",
    reviewedAt: "2026-08-13T10:00:00Z",
    managerComments: "Approved per Remote Camp Rotational R&R agreement.",
    payrollImpact: "No Deduction (Paid)"
  },
  {
    id: "lr-005",
    companyId: "comp-001",
    projectId: "proj-001",
    employeeId: "emp-105",
    employeeNumber: "EMP-2190",
    employeeName: "Kagiso Molefe",
    employeeRole: "Safety Officer",
    department: "HSE & Compliance",
    contactNumber: "+27 84 999 1122",
    leaveType: "paternity",
    leaveTypeName: "Paternity / Parental Leave",
    startDate: "2026-09-14",
    endDate: "2026-09-25",
    totalWorkingDays: 10,
    reason: "Birth of second child (expected confinement date 13 Sept 2026).",
    handoverColleague: "Site HSE Team",
    emergencyPhone: "+27 84 999 1122",
    status: "Pending",
    appliedAt: "2026-08-16T06:40:00Z",
    appliedBy: "Kagiso Molefe",
    payrollImpact: "No Deduction (Paid)"
  }
];

const INITIAL_EMPLOYEE_BALANCES: EmployeeLeaveBalance[] = [
  {
    employeeId: "emp-101",
    employeeNumber: "EMP-2041",
    employeeName: "John Mokoena",
    department: "Civil Engineering",
    role: "Senior Site Agent",
    joinDate: "2023-03-01",
    annualEntitlement: 21,
    annualAccruedToDate: 14.5,
    annualUsed: 5,
    annualPending: 0,
    annualBalance: 9.5,
    sickEntitlementCycle: 30,
    sickUsedCycle: 3,
    sickBalance: 27,
    compassionateEntitlement: 5,
    compassionateUsed: 0,
    compassionateBalance: 5,
    studyEntitlement: 6,
    studyUsed: 0,
    unpaidDaysTaken: 0,
    siteRrRotationsTaken: 2,
    totalLeaveTakenThisYear: 5
  },
  {
    employeeId: "emp-102",
    employeeNumber: "EMP-2088",
    employeeName: "David Ndlovu",
    department: "Geomatics & Survey",
    role: "Survey Technician",
    joinDate: "2024-01-15",
    annualEntitlement: 21,
    annualAccruedToDate: 13.0,
    annualUsed: 4,
    annualPending: 0,
    annualBalance: 9.0,
    sickEntitlementCycle: 30,
    sickUsedCycle: 2,
    sickBalance: 28,
    compassionateEntitlement: 5,
    compassionateUsed: 1,
    compassionateBalance: 4,
    studyEntitlement: 6,
    studyUsed: 2,
    unpaidDaysTaken: 0,
    siteRrRotationsTaken: 1,
    totalLeaveTakenThisYear: 7
  },
  {
    employeeId: "emp-103",
    employeeNumber: "EMP-2105",
    employeeName: "Lerato Dlamini",
    department: "Commercial & Cost Control",
    role: "Junior Quantity Surveyor",
    joinDate: "2024-06-01",
    annualEntitlement: 21,
    annualAccruedToDate: 12.0,
    annualUsed: 2,
    annualPending: 0,
    annualBalance: 10.0,
    sickEntitlementCycle: 30,
    sickUsedCycle: 0,
    sickBalance: 30,
    compassionateEntitlement: 5,
    compassionateUsed: 0,
    compassionateBalance: 5,
    studyEntitlement: 6,
    studyUsed: 0,
    unpaidDaysTaken: 0,
    siteRrRotationsTaken: 0,
    totalLeaveTakenThisYear: 2
  },
  {
    employeeId: "emp-104",
    employeeNumber: "EMP-2144",
    employeeName: "Sipho Nkosi",
    department: "Plant & Operations",
    role: "Earthworks Foreman",
    joinDate: "2022-08-10",
    annualEntitlement: 21,
    annualAccruedToDate: 16.0,
    annualUsed: 6,
    annualPending: 0,
    annualBalance: 10.0,
    sickEntitlementCycle: 30,
    sickUsedCycle: 4,
    sickBalance: 26,
    compassionateEntitlement: 5,
    compassionateUsed: 2,
    compassionateBalance: 3,
    studyEntitlement: 6,
    studyUsed: 0,
    unpaidDaysTaken: 0,
    siteRrRotationsTaken: 3,
    totalLeaveTakenThisYear: 8
  },
  {
    employeeId: "emp-105",
    employeeNumber: "EMP-2190",
    employeeName: "Kagiso Molefe",
    department: "HSE & Compliance",
    role: "Safety Officer",
    joinDate: "2023-11-01",
    annualEntitlement: 21,
    annualAccruedToDate: 14.0,
    annualUsed: 3,
    annualPending: 0,
    annualBalance: 11.0,
    sickEntitlementCycle: 30,
    sickUsedCycle: 1,
    sickBalance: 29,
    compassionateEntitlement: 5,
    compassionateUsed: 0,
    compassionateBalance: 5,
    studyEntitlement: 6,
    studyUsed: 0,
    unpaidDaysTaken: 0,
    siteRrRotationsTaken: 1,
    totalLeaveTakenThisYear: 4
  }
];

const LEAVE_STORAGE_KEY = "projectmatrix_employee_leave_requests";
const BALANCES_STORAGE_KEY = "projectmatrix_employee_leave_balances";

export const getLeavePolicies = (): LeavePolicy[] => {
  return LEAVE_POLICIES;
};

export const getLeaveRequests = (companyId?: string, projectId?: string): LeaveRequest[] => {
  try {
    const raw = previewStorage.getItem(LEAVE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error loading leave requests from storage:", e);
  }
  // Initialize default
  previewStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(INITIAL_LEAVE_REQUESTS));
  return INITIAL_LEAVE_REQUESTS;
};

export const saveLeaveRequests = (requests: LeaveRequest[]): void => {
    assertOperationalAction("write", "services/leaveService.ts");
  try {
    previewStorage.setItem(LEAVE_STORAGE_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error("Error saving leave requests:", e);
  }
};

export const getEmployeeLeaveBalances = (): EmployeeLeaveBalance[] => {
  try {
    const raw = previewStorage.getItem(BALANCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error loading leave balances:", e);
  }
  previewStorage.setItem(BALANCES_STORAGE_KEY, JSON.stringify(INITIAL_EMPLOYEE_BALANCES));
  return INITIAL_EMPLOYEE_BALANCES;
};

export const getLeaveBalances = getEmployeeLeaveBalances;

export const saveEmployeeLeaveBalances = (balances: EmployeeLeaveBalance[]): void => {
    assertOperationalAction("write", "services/leaveService.ts");
  try {
    previewStorage.setItem(BALANCES_STORAGE_KEY, JSON.stringify(balances));
  } catch (e) {
    console.error("Error saving leave balances:", e);
  }
};

export const saveLeaveBalances = saveEmployeeLeaveBalances;

/**
 * Calculates working days between two dates, skipping Saturdays and Sundays
 */
export const calculateWorkingDays = (startDateStr: string, endDateStr: string, isHalfDay?: boolean): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  if (isHalfDay) return 0.5;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count > 0 ? count : 1;
};
