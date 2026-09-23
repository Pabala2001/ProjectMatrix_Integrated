import * as XLSX from "xlsx";
import { LabourPayrollRow, PayrollSettings, PayrollInfo } from "../types/payroll";
import { calculateRow, calculateTotals } from "./payrollCalculations";

/**
 * Generates and downloads a real Excel .xlsx file for the Labour Payroll.
 * Uses SheetJS to construct a professional, formatted worksheet with actual formulas.
 */
export function buildExcelWorkbook(
  payrollInfo: PayrollInfo,
  settings: PayrollSettings,
  rows: LabourPayrollRow[]
): { wb: XLSX.WorkBook; filename: string } {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // We will build a cell-by-cell sheet representation to have fine-grained control
  const ws: XLSX.WorkSheet = {};
  
  // Helper to safely write a cell
  function writeCell(
    r: number,
    c: number,
    val: any,
    type: "s" | "n" | "b" = "s",
    formula?: string,
    numFormat?: string
  ) {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    if (formula) {
      ws[cellRef] = { t: "n", f: formula, v: val };
    } else {
      ws[cellRef] = { t: type, v: val };
    }
    
    if (numFormat) {
      ws[cellRef].z = numFormat;
    }
  }

  // Row Indices (0-based)
  // Row 0: Title
  // Row 1: Project & Employer info
  // Row 2: Pay Period & Prepared info
  // Row 3: Notes
  // Row 4: Empty spacer
  // Row 5: Settings Title
  // Row 6: Settings - Normal Multiplier
  // Row 7: Settings - Overtime Multiplier
  // Row 8: Settings - Sunday/Holiday Multiplier
  // Row 9: Settings - UIF Contribution %
  // Row 10: Empty spacer
  // Row 11: Table Header (A12:Z12)
  // Row 12+: Data Rows
  // Last Row: Totals

  // 1. Title Block
  const titleText = `${payrollInfo.payrollTitle || "Labour Payroll"} (${payrollInfo.payrollMonth} ${payrollInfo.payrollYear})`;
  writeCell(0, 0, titleText.toUpperCase(), "s");
  
  // Merge Title cell A1:Z1
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 25 } }
  ];

  // 2. Metadata Block
  writeCell(1, 0, "PROJECT:", "s");
  writeCell(1, 1, payrollInfo.project || "N/A", "s");
  writeCell(1, 3, "EMPLOYER:", "s");
  writeCell(1, 4, payrollInfo.employerName || "N/A", "s");
  writeCell(1, 6, "MONTH / YEAR:", "s");
  writeCell(1, 7, `${payrollInfo.payrollMonth} ${payrollInfo.payrollYear}`, "s");

  writeCell(2, 0, "PAY PERIOD START:", "s");
  writeCell(2, 1, payrollInfo.startDate || "N/A", "s");
  writeCell(2, 3, "PAY PERIOD END:", "s");
  writeCell(2, 4, payrollInfo.endDate || "N/A", "s");
  writeCell(2, 6, "PREPARED BY:", "s");
  writeCell(2, 7, payrollInfo.preparedBy || "N/A", "s");
  writeCell(2, 9, "DATE PREPARED:", "s");
  writeCell(2, 10, payrollInfo.datePrepared || "N/A", "s");

  writeCell(3, 0, "NOTES:", "s");
  writeCell(3, 1, payrollInfo.notes || "N/A", "s");

  // 3. Settings Block (Rows 5 to 9)
  writeCell(5, 0, "PAYROLL CALCULATION SETTINGS:", "s");
  
  writeCell(6, 0, "Normal Time Multiplier", "s");
  writeCell(6, 1, Number(settings.normalMultiplier) || 1.0, "n", undefined, "0.0");
  
  writeCell(7, 0, "Overtime Multiplier", "s");
  writeCell(7, 1, Number(settings.overtimeMultiplier) || 1.5, "n", undefined, "0.0");
  
  writeCell(8, 0, "Sunday & Public Holiday Multiplier", "s");
  writeCell(8, 1, Number(settings.sundayHolidayMultiplier) || 2.0, "n", undefined, "0.0");
  
  writeCell(9, 0, "UIF Employee Contribution %", "s");
  // Represent percentage as a fraction for percentage formatting
  const uifFraction = (Number(settings.uifPercentage) || 1) / 100;
  writeCell(9, 1, uifFraction, "n", undefined, "0.0%");

  // Settings cells references for formulas
  const normalMultCell = "$B$7";
  const overtimeMultCell = "$B$8";
  const sundayMultCell = "$B$9";
  const uifPctCell = "$B$10";

  // 4. Table Headers
  const headers = [
    "No.",                  // A
    "Employee No.",          // B
    "First Name",           // C
    "Last Name",            // D
    "Full Name",            // E
    "ID Number",            // F
    "Category / Job Title",  // G
    "Contact Number",       // H
    "Bank Name",            // I
    "Account Holder",       // J
    "Account Number",       // K
    "Branch Code",          // L
    "Account Type",         // M
    "Normal Hourly Rate",   // N (or base salary if salaried)
    "Normal Hours Worked",  // O
    "Normal Wages",         // P
    "Overtime Hourly Rate",  // Q
    "Overtime Hours Worked", // R
    "Overtime Wages",       // S
    "Sunday/Holiday Rate",  // T
    "Sunday/Holiday Hours", // U
    "Sunday/Holiday Wages", // V
    "Gross Wage",           // W
    "UIF Deduction",        // X
    "Other Deductions",     // Y
    "Net Pay"               // Z
  ];

  const headerRowIdx = 11;
  headers.forEach((h, colIdx) => {
    writeCell(headerRowIdx, colIdx, h, "s");
  });

  // 5. Data Rows
  let currentRowIdx = 12;
  const currencyFmt = `"${settings.currencySymbol || "R"}" #,##0.00`;

  rows.forEach((row, index) => {
    const calc = calculateRow(row, settings);
    const xlRow = currentRowIdx + 1; // 1-based index for Excel formula string

    // Columns:
    // A: No.
    writeCell(currentRowIdx, 0, index + 1, "n");
    // B: Employee No.
    writeCell(currentRowIdx, 1, row.employeeNumber, "s");
    // C: First Name
    writeCell(currentRowIdx, 2, row.firstName, "s");
    // D: Last Name
    writeCell(currentRowIdx, 3, row.lastName, "s");
    
    // E: Full Name (Formula)
    writeCell(currentRowIdx, 4, calc.fullName, "s", `=C${xlRow}&" "&D${xlRow}`);
    
    // F: ID Number
    writeCell(currentRowIdx, 5, row.idNumber || "", "s");
    // G: Category
    writeCell(currentRowIdx, 6, row.jobTitle || "Labourer", "s");
    // H: Contact
    writeCell(currentRowIdx, 7, row.contactNumber || "", "s");
    // I: Bank Name
    writeCell(currentRowIdx, 8, row.bankName || "", "s");
    // J: Account Holder
    writeCell(currentRowIdx, 9, row.accountHolder || "", "s");
    // K: Account Number
    writeCell(currentRowIdx, 10, row.accountNumber || "", "s");
    // L: Branch Code
    writeCell(currentRowIdx, 11, row.branchCode || "", "s");
    // M: Account Type
    writeCell(currentRowIdx, 12, row.accountType || "", "s");

    // N: Normal Hourly Rate / Base Salary
    const normalRateOrSalary = row.payType === "salaried" ? Number(row.baseSalary) : Number(row.normalHourlyRate);
    writeCell(currentRowIdx, 13, normalRateOrSalary, "n", undefined, currencyFmt);
    
    // O: Normal Hours Worked
    writeCell(currentRowIdx, 14, Number(row.normalHours) || 0, "n", undefined, "0.0");

    // P: Normal Wages (Formula)
    const normalWagesFormula = row.payType === "salaried" ? `=N${xlRow}` : `=N${xlRow}*O${xlRow}`;
    writeCell(currentRowIdx, 15, calc.normalWages, "n", normalWagesFormula, currencyFmt);

    // Q: Overtime Hourly Rate (Formula)
    const overtimeRateFormula = row.payType === "salaried"
      ? `=IF(O${xlRow}>0,(N${xlRow}/O${xlRow})*${normalMultCell}*${overtimeMultCell},0)`
      : `=N${xlRow}*${normalMultCell}*${overtimeMultCell}`;
    writeCell(currentRowIdx, 16, calc.overtimeHourlyRate, "n", overtimeRateFormula, currencyFmt);

    // R: Overtime Hours Worked
    writeCell(currentRowIdx, 17, Number(row.overtimeHours) || 0, "n", undefined, "0.0");

    // S: Overtime Wages (Formula)
    writeCell(currentRowIdx, 18, calc.overtimeWages, "n", `=Q${xlRow}*R${xlRow}`, currencyFmt);

    // T: Sunday/Holiday Hourly Rate (Formula)
    const sundayRateFormula = row.payType === "salaried"
      ? `=IF(O${xlRow}>0,(N${xlRow}/O${xlRow})*${normalMultCell}*${sundayMultCell},0)`
      : `=N${xlRow}*${normalMultCell}*${sundayMultCell}`;
    writeCell(currentRowIdx, 19, calc.sundayHolidayHourlyRate, "n", sundayRateFormula, currencyFmt);

    // U: Sunday/Holiday Hours Worked
    writeCell(currentRowIdx, 20, Number(row.sundayHolidayHours) || 0, "n", undefined, "0.0");

    // V: Sunday/Holiday Wages (Formula)
    writeCell(currentRowIdx, 21, calc.sundayHolidayWages, "n", `=T${xlRow}*U${xlRow}`, currencyFmt);

    // W: Gross Wage (Formula)
    writeCell(currentRowIdx, 22, calc.grossWage, "n", `=P${xlRow}+S${xlRow}+V${xlRow}`, currencyFmt);

    // X: UIF Deduction (Formula)
    writeCell(currentRowIdx, 23, calc.uifDeduction, "n", `=W${xlRow}*${uifPctCell}`, currencyFmt);

    // Y: Other Deductions
    writeCell(currentRowIdx, 24, Number(row.otherDeductions) || 0, "n", undefined, currencyFmt);

    // Z: Net Pay (Formula)
    writeCell(currentRowIdx, 25, calc.netPay, "n", `=W${xlRow}-X${xlRow}-Y${xlRow}`, currencyFmt);

    currentRowIdx++;
  });

  // 6. Summary / Totals Row
  const totals = calculateTotals(rows, settings);
  const totalRowXl = currentRowIdx + 1;
  const startRowXl = 13; // first data row (Excel 13)
  const endRowXl = currentRowIdx; // last data row (Excel index)

  writeCell(currentRowIdx, 0, "TOTALS", "s");
  
  // Sum formulas for numeric columns
  // Normal Hours Worked (Col O)
  writeCell(currentRowIdx, 14, totals.totalNormalHours, "n", `=SUM(O${startRowXl}:O${endRowXl})`, "0.0");
  
  // Normal Wages (Col P)
  writeCell(currentRowIdx, 15, totals.totalNormalWages, "n", `=SUM(P${startRowXl}:P${endRowXl})`, currencyFmt);
  
  // Overtime Hours Worked (Col R)
  writeCell(currentRowIdx, 17, totals.totalOvertimeHours, "n", `=SUM(R${startRowXl}:R${endRowXl})`, "0.0");
  
  // Overtime Wages (Col S)
  writeCell(currentRowIdx, 18, totals.totalOvertimeWages, "n", `=SUM(S${startRowXl}:S${endRowXl})`, currencyFmt);
  
  // Sunday/Holiday Hours (Col U)
  writeCell(currentRowIdx, 20, totals.totalSundayHolidayHours, "n", `=SUM(U${startRowXl}:U${endRowXl})`, "0.0");
  
  // Sunday/Holiday Wages (Col V)
  writeCell(currentRowIdx, 21, totals.totalSundayHolidayWages, "n", `=SUM(V${startRowXl}:V${endRowXl})`, currencyFmt);
  
  // Gross Wage (Col W)
  writeCell(currentRowIdx, 22, totals.totalGrossPayroll, "n", `=SUM(W${startRowXl}:W${endRowXl})`, currencyFmt);
  
  // UIF Deduction (Col X)
  writeCell(currentRowIdx, 23, totals.totalUIFDeductions, "n", `=SUM(X${startRowXl}:X${endRowXl})`, currencyFmt);
  
  // Other Deductions (Col Y)
  writeCell(currentRowIdx, 24, totals.totalOtherDeductions, "n", `=SUM(Y${startRowXl}:Y${endRowXl})`, currencyFmt);
  
  // Net Pay (Col Z)
  writeCell(currentRowIdx, 25, totals.totalNetPayroll, "n", `=SUM(Z${startRowXl}:Z${endRowXl})`, currencyFmt);

  // Set worksheet range
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: currentRowIdx, c: 25 }
  });

  // Apply visual columns widths
  ws["!cols"] = [
    { wch: 6 },  // A: No.
    { wch: 14 }, // B: Employee No.
    { wch: 14 }, // C: First Name
    { wch: 14 }, // D: Last Name
    { wch: 22 }, // E: Full Name
    { wch: 15 }, // F: ID Number
    { wch: 22 }, // G: Category
    { wch: 15 }, // H: Contact Number
    { wch: 14 }, // I: Bank Name
    { wch: 20 }, // J: Account Holder
    { wch: 16 }, // K: Account Number
    { wch: 10 }, // L: Branch Code
    { wch: 12 }, // M: Account Type
    { wch: 18 }, // N: Normal Hourly Rate / Base Salary
    { wch: 12 }, // O: Normal Hours Worked
    { wch: 15 }, // P: Normal Wages
    { wch: 18 }, // Q: Overtime Hourly Rate
    { wch: 12 }, // R: Overtime Hours Worked
    { wch: 15 }, // S: Overtime Wages
    { wch: 18 }, // T: Sunday/Holiday Rate
    { wch: 12 }, // U: Sunday/Holiday Hours
    { wch: 15 }, // V: Sunday/Holiday Wages
    { wch: 15 }, // W: Gross Wage
    { wch: 14 }, // X: UIF Deduction
    { wch: 14 }, // Y: Other Deductions
    { wch: 15 }  // Z: Net Pay
  ];

  // Append worksheet
  XLSX.utils.book_append_sheet(wb, ws, "Labour Payroll");

  // Format safe filename
  const rawProjectName = payrollInfo.project || "Jabulani_Reservoir";
  const sanitizedProject = rawProjectName
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .trim();
  const sanitizedMonth = payrollInfo.payrollMonth.replace(/[^a-zA-Z0-9]/g, "");
  const sanitizedYear = payrollInfo.payrollYear.replace(/[^a-zA-Z0-9]/g, "");

  const filename = `Labour_Payroll_${sanitizedProject}_${sanitizedMonth}_${sanitizedYear}.xlsx`;

  return { wb, filename };
}

export function exportToExcel(
  payrollInfo: PayrollInfo,
  settings: PayrollSettings,
  rows: LabourPayrollRow[]
) {
  const { wb, filename } = buildExcelWorkbook(payrollInfo, settings, rows);
  XLSX.writeFile(wb, filename);
}

export function generateExcelBlob(
  payrollInfo: PayrollInfo,
  settings: PayrollSettings,
  rows: LabourPayrollRow[]
): { blob: Blob; filename: string } {
  const { wb, filename } = buildExcelWorkbook(payrollInfo, settings, rows);
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return { blob, filename };
}
