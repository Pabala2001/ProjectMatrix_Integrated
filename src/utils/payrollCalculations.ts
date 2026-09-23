import { LabourPayrollRow, PayrollSettings } from "../types/payroll";

export interface CalculatedPayrollRow {
  row: LabourPayrollRow;
  fullName: string;
  effectiveHourlyRate: number;
  normalWages: number;
  overtimeHourlyRate: number;
  overtimeWages: number;
  sundayHolidayHourlyRate: number;
  sundayHolidayWages: number;
  grossWage: number;
  uifDeduction: number;
  netPay: number;
}

export interface PayrollSummary {
  totalLabourers: number;
  totalNormalHours: number;
  totalOvertimeHours: number;
  totalSundayHolidayHours: number;
  totalNormalWages: number;
  totalOvertimeWages: number;
  totalSundayHolidayWages: number;
  totalGrossPayroll: number;
  totalUIFDeductions: number;
  totalOtherDeductions: number;
  totalNetPayroll: number;
}

/**
 * Calculates all automatic fields for a single labour payroll row based on current settings.
 */
export function calculateRow(row: LabourPayrollRow, settings: PayrollSettings): CalculatedPayrollRow {
  const firstName = (row.firstName || "").trim();
  const lastName = (row.lastName || "").trim();
  const fullName = firstName || lastName ? `${firstName} ${lastName}`.trim() : "";

  // Convert empty/NaN values safely to 0
  const normalHourlyRate = Number(row.normalHourlyRate) || 0;
  const normalHours = Number(row.normalHours) || 0;
  const baseSalary = Number(row.baseSalary) || 0;
  const overtimeHours = Number(row.overtimeHours) || 0;
  const sundayHolidayHours = Number(row.sundayHolidayHours) || 0;
  const otherDeductions = Number(row.otherDeductions) || 0;

  let effectiveHourlyRate = 0;
  let normalWages = 0;

  if (row.payType === "salaried") {
    normalWages = baseSalary;
    effectiveHourlyRate = normalHours > 0 ? baseSalary / normalHours : 0;
  } else {
    effectiveHourlyRate = normalHourlyRate;
    normalWages = normalHourlyRate * normalHours;
  }

  const overtimeHourlyRate = effectiveHourlyRate * settings.normalMultiplier * settings.overtimeMultiplier;
  const overtimeWages = overtimeHourlyRate * overtimeHours;

  const sundayHolidayHourlyRate = effectiveHourlyRate * settings.normalMultiplier * settings.sundayHolidayMultiplier;
  const sundayHolidayWages = sundayHolidayHourlyRate * sundayHolidayHours;

  const grossWage = normalWages + overtimeWages + sundayHolidayWages;

  // UIF deduction uses uifPercentage (e.g. 1 means 1% -> 0.01)
  const uifDeduction = grossWage * (settings.uifPercentage / 100);

  const netPay = Math.max(0, grossWage - uifDeduction - otherDeductions);

  return {
    row,
    fullName,
    effectiveHourlyRate,
    normalWages,
    overtimeHourlyRate,
    overtimeWages,
    sundayHolidayHourlyRate,
    sundayHolidayWages,
    grossWage,
    uifDeduction,
    netPay
  };
}

/**
 * Calculates aggregate totals for the entire payroll.
 */
export function calculateTotals(rows: LabourPayrollRow[], settings: PayrollSettings): PayrollSummary {
  const calculatedRows = rows.map(r => calculateRow(r, settings));

  return calculatedRows.reduce<PayrollSummary>(
    (acc, cur) => {
      acc.totalLabourers += 1;
      acc.totalNormalHours += Number(cur.row.normalHours) || 0;
      acc.totalOvertimeHours += Number(cur.row.overtimeHours) || 0;
      acc.totalSundayHolidayHours += Number(cur.row.sundayHolidayHours) || 0;
      acc.totalNormalWages += cur.normalWages;
      acc.totalOvertimeWages += cur.overtimeWages;
      acc.totalSundayHolidayWages += cur.sundayHolidayWages;
      acc.totalGrossPayroll += cur.grossWage;
      acc.totalUIFDeductions += cur.uifDeduction;
      acc.totalOtherDeductions += Number(cur.row.otherDeductions) || 0;
      acc.totalNetPayroll += cur.netPay;
      return acc;
    },
    {
      totalLabourers: 0,
      totalNormalHours: 0,
      totalOvertimeHours: 0,
      totalSundayHolidayHours: 0,
      totalNormalWages: 0,
      totalOvertimeWages: 0,
      totalSundayHolidayWages: 0,
      totalGrossPayroll: 0,
      totalUIFDeductions: 0,
      totalOtherDeductions: 0,
      totalNetPayroll: 0
    }
  );
}

/**
 * Standard currency formatter for South African Rand (or configured currency)
 */
export function formatCurrency(amount: number, settings: PayrollSettings): string {
  const symbol = settings.currencySymbol || "R";
  const decimals = settings.decimalPlaces !== undefined ? settings.decimalPlaces : 2;
  
  // Format with space as thousand separator like South African style (e.g. R 12 345.67)
  const formattedAmount = amount.toFixed(decimals);
  const parts = formattedAmount.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  
  return `${symbol} ${parts.join(".")}`;
}
