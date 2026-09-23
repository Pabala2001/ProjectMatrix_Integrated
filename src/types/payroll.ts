export interface PayrollSettings {
  normalMultiplier: number;
  overtimeMultiplier: number;
  sundayHolidayMultiplier: number;
  uifPercentage: number;
  currency: string;
  currencySymbol: string;
  decimalPlaces: number;
}

export interface LabourPayrollRow {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  jobTitle: string;
  contactNumber: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  payType: "hourly" | "salaried";
  normalHourlyRate: number;
  normalHours: number;
  baseSalary: number;
  overtimeHours: number;
  sundayHolidayHours: number;
  otherDeductions: number;
}

export interface PayrollInfo {
  project: string;
  employerName: string;
  payrollTitle: string;
  payrollMonth: string;
  payrollYear: string;
  startDate: string;
  endDate: string;
  preparedBy: string;
  datePrepared: string;
  notes: string;
}
