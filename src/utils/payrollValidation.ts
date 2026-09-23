import { LabourPayrollRow, PayrollSettings } from "../types/payroll";

export interface RowErrors {
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  idNumber?: string;
  contactNumber?: string;
  normalHourlyRate?: string;
  normalHours?: string;
  baseSalary?: string;
  overtimeHours?: string;
  sundayHolidayHours?: string;
  otherDeductions?: string;
}

export interface SettingsErrors {
  normalMultiplier?: string;
  overtimeMultiplier?: string;
  sundayHolidayMultiplier?: string;
  uifPercentage?: string;
}

/**
 * Validates a single labourer row.
 * Checks for required fields, numeric constraints, uniqueness of employeeNumber, etc.
 */
export function validateLabourerRow(
  row: LabourPayrollRow,
  allRows: LabourPayrollRow[]
): RowErrors {
  const errors: RowErrors = {};

  // 1. Required fields
  if (!row.firstName || !row.firstName.trim()) {
    errors.firstName = "First name is required";
  }
  if (!row.lastName || !row.lastName.trim()) {
    errors.lastName = "Last name is required";
  }

  // 2. Employee Number is required and unique
  if (!row.employeeNumber || !row.employeeNumber.trim()) {
    errors.employeeNumber = "Employee number is required";
  } else {
    const duplicate = allRows.find(
      (r) => r.id !== row.id && r.employeeNumber && r.employeeNumber.trim().toLowerCase() === row.employeeNumber.trim().toLowerCase()
    );
    if (duplicate) {
      errors.employeeNumber = "Employee number must be unique";
    }
  }

  // 3. ID Number: should not accept letters (only digits, spaces, hyphens)
  if (row.idNumber) {
    const cleanId = row.idNumber.replace(/[\s-]/g, "");
    if (/[a-zA-Z]/.test(cleanId)) {
      errors.idNumber = "ID number should not contain letters";
    }
  }

  // 4. Contact Number validation (digits, +, spaces, hyphens, parentheses)
  if (row.contactNumber) {
    const contactRegex = /^[+]?[0-9\s-()]+$/;
    if (!contactRegex.test(row.contactNumber)) {
      errors.contactNumber = "Contact number contains invalid characters";
    }
  }

  // 5. Numeric negative values constraints
  if (row.normalHourlyRate < 0) {
    errors.normalHourlyRate = "Hourly rate cannot be negative";
  }
  if (row.normalHours < 0) {
    errors.normalHours = "Hours cannot be negative";
  }
  if (row.baseSalary < 0) {
    errors.baseSalary = "Base salary cannot be negative";
  }
  if (row.overtimeHours < 0) {
    errors.overtimeHours = "Overtime hours cannot be negative";
  }
  if (row.sundayHolidayHours < 0) {
    errors.sundayHolidayHours = "Sunday/holiday hours cannot be negative";
  }
  if (row.otherDeductions < 0) {
    errors.otherDeductions = "Deductions cannot be negative";
  }

  return errors;
}

/**
 * Validates payroll calculation settings.
 */
export function validateSettings(settings: PayrollSettings): SettingsErrors {
  const errors: SettingsErrors = {};

  if (settings.normalMultiplier <= 0) {
    errors.normalMultiplier = "Normal multiplier must be greater than zero";
  }
  if (settings.overtimeMultiplier <= 0) {
    errors.overtimeMultiplier = "Overtime multiplier must be greater than zero";
  }
  if (settings.sundayHolidayMultiplier <= 0) {
    errors.sundayHolidayMultiplier = "Sunday/holiday multiplier must be greater than zero";
  }
  if (settings.uifPercentage < 0) {
    errors.uifPercentage = "UIF percentage cannot be negative";
  }

  return errors;
}
