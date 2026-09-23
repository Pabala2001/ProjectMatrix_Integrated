import React, { useState } from "react";
import { LabourPayrollRow, PayrollSettings } from "../../types/payroll";
import { calculateRow, formatCurrency } from "../../utils/payrollCalculations";
import { validateLabourerRow, RowErrors } from "../../utils/payrollValidation";
import { 
  Plus, 
  Trash2, 
  Copy, 
  RotateCcw, 
  Search, 
  ArrowUpDown, 
  Calculator, 
  Sparkles, 
  HelpCircle,
  AlertTriangle,
  Info
} from "lucide-react";

interface LabourPayrollTableProps {
  rows: LabourPayrollRow[];
  settings: PayrollSettings;
  onUpdateRow: (id: string, updated: Partial<LabourPayrollRow>) => void;
  onAddRow: () => void;
  onDuplicateRow: (row: LabourPayrollRow) => void;
  onDeleteRow: (id: string) => void;
  onClearRow: (id: string) => void;
  onClearFullPayroll: () => void;
  readOnly?: boolean;
}

type SortField = "employeeNumber" | "name" | "grossWage" | "netPay";
type SortOrder = "asc" | "desc";

export default function LabourPayrollTable({
  rows,
  settings,
  onUpdateRow,
  onAddRow,
  onDuplicateRow,
  onDeleteRow,
  onClearRow,
  onClearFullPayroll,
  readOnly = false
}: LabourPayrollTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("employeeNumber");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Filter and Sort Rows
  const filteredRows = rows.filter(row => {
    const search = searchTerm.toLowerCase();
    const fullName = `${row.firstName} ${row.lastName}`.toLowerCase();
    return (
      row.employeeNumber.toLowerCase().includes(search) ||
      row.idNumber.toLowerCase().includes(search) ||
      fullName.includes(search) ||
      row.jobTitle.toLowerCase().includes(search)
    );
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    let valA: any = "";
    let valB: any = "";

    if (sortField === "employeeNumber") {
      valA = a.employeeNumber.toLowerCase();
      valB = b.employeeNumber.toLowerCase();
    } else if (sortField === "name") {
      valA = `${a.firstName} ${a.lastName}`.toLowerCase();
      valB = `${b.firstName} ${b.lastName}`.toLowerCase();
    } else if (sortField === "grossWage" || sortField === "netPay") {
      const calcA = calculateRow(a, settings);
      const calcB = calculateRow(b, settings);
      valA = sortField === "grossWage" ? calcA.grossWage : calcA.netPay;
      valB = sortField === "grossWage" ? calcB.grossWage : calcB.netPay;
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Quick tooltip formula explainers
  const formulaTooltips = {
    fullName: "Formula: First Name + Last Name",
    normalWages: "Hourly: Normal Hourly Rate × Normal Hours Worked\nSalaried: Base Salary",
    overtimeRate: "Formula: Normal Rate × Normal Multiplier (1.0) × Overtime Multiplier",
    overtimeWages: "Formula: Overtime Hourly Rate × Overtime Hours Worked",
    sundayRate: "Formula: Normal Rate × Normal Multiplier (1.0) × Sunday Multiplier",
    sundayWages: "Formula: Sunday Rate × Sunday Hours Worked",
    grossWage: "Formula: Normal Wages + Overtime Wages + Sunday Wages",
    uif: "Formula: Gross Wage × UIF Employee Contribution %",
    netPay: "Formula: Gross Wage - UIF - Other Deductions"
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-xl p-6 space-y-6">
      
      {/* Table Actions Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
        {/* Search Input */}
        <div className="relative w-full lg:w-80 lg:min-w-[320px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search staff by name, ID or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
          />
        </div>

        {/* Toolbar Button Controls */}
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* Add Staff */}
            <button
              type="button"
              onClick={onAddRow}
              className="h-11 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-amber-500/5"
            >
              <Plus className="w-4 h-4" />
              Add Staff Row
            </button>

            {/* Wipe Payroll Draft */}
            <button
              type="button"
              onClick={() => setShowClearAllConfirm(true)}
              className="h-11 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Clear Full Payroll
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-amber-500/80 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Locked / Read-Only Mode
            </span>
          </div>
        )}
      </div>

      {/* Excel Sheet Simulator Grid Container */}
      <div className="relative border border-slate-800/85 rounded-xl overflow-hidden bg-slate-950/40">
        
        {/* Horizontal scroll wrapper with 60vh vertical height constraint */}
        <div className="overflow-x-auto overflow-y-auto w-full max-h-[60vh]">
          <table className="table-fixed border-collapse text-left text-xs text-slate-300" style={{ minWidth: "4050px", width: "4050px" }}>
            {/* Sticky Table Header */}
            <thead className="sticky top-0 bg-[#07182E] text-slate-300 border-b border-slate-800 font-bold uppercase tracking-wider text-[10px] z-20">
              <tr>
                {/* Fixed columns sticky left */}
                <th 
                  className="sticky top-0 left-0 bg-[#07182E] px-4 py-3.5 border-r border-slate-800 text-center z-40 shadow-[4px_0_10px_rgba(0,0,0,0.3)] whitespace-normal break-words leading-tight"
                  style={{ minWidth: "60px", width: "60px", left: 0 }}
                >
                  No.
                </th>
                <th 
                  className="sticky top-0 left-[60px] bg-[#07182E] px-4 py-3.5 border-r border-slate-800 text-center cursor-pointer z-40 shadow-[4px_0_10px_rgba(0,0,0,0.3)] whitespace-normal break-words leading-tight" 
                  style={{ minWidth: "120px", width: "120px", left: "60px" }}
                  onClick={() => handleSort("employeeNumber")}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    Employee No.
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="sticky top-0 left-[180px] bg-[#07182E] px-4 py-3.5 border-r border-slate-800 cursor-pointer z-40 shadow-[4px_0_10px_rgba(0,0,0,0.3)] whitespace-normal break-words leading-tight" 
                  style={{ minWidth: "130px", width: "130px", left: "180px" }}
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1.5">
                    First Name
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  className="sticky top-0 left-[310px] bg-[#07182E] px-4 py-3.5 border-r border-slate-800 z-40 shadow-[4px_0_10px_rgba(0,0,0,0.3)] whitespace-normal break-words leading-tight"
                  style={{ minWidth: "130px", width: "130px", left: "310px" }}
                >
                  Last Name
                </th>
                
                {/* Scrollable columns */}
                <th className="px-4 py-3.5 border-r border-slate-800 bg-slate-900/60 text-slate-400 whitespace-normal break-words leading-tight" style={{ minWidth: "160px", width: "160px" }}>
                  <div className="flex items-center gap-1">
                    Full Name
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.fullName} />
                  </div>
                </th>
                <th className="px-4 py-3.5 border-r border-slate-800 whitespace-normal break-words leading-tight" style={{ minWidth: "150px", width: "150px" }}>ID Number</th>
                <th className="px-4 py-3.5 border-r border-slate-800 whitespace-normal break-words leading-tight" style={{ minWidth: "150px", width: "150px" }}>Staff Category</th>
                <th className="px-4 py-3.5 border-r border-slate-800 whitespace-normal break-words leading-tight" style={{ minWidth: "140px", width: "140px" }}>Contact No.</th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-center whitespace-normal break-words leading-tight" style={{ minWidth: "120px", width: "120px" }}>Pay Type</th>
                <th className="px-4 py-3.5 border-r border-slate-800 whitespace-normal break-words leading-tight" style={{ minWidth: "140px", width: "140px" }}>Bank Name</th>
                <th className="px-4 py-3.5 border-r border-slate-800 whitespace-normal break-words leading-tight" style={{ minWidth: "170px", width: "170px" }}>Account Holder</th>
                <th className="px-4 py-3.5 border-r border-slate-800 whitespace-normal break-words leading-tight" style={{ minWidth: "160px", width: "160px" }}>Account Number</th>
                <th className="px-4 py-3.5 border-r border-slate-800 whitespace-normal break-words leading-tight" style={{ minWidth: "120px", width: "120px" }}>Branch Code</th>
                <th className="px-4 py-3.5 border-r border-slate-800 whitespace-normal break-words leading-tight" style={{ minWidth: "130px", width: "130px" }}>Account Type</th>
                
                {/* Numeric Columns */}
                <th className="px-4 py-3.5 border-r border-slate-800 text-right whitespace-normal break-words leading-tight" style={{ minWidth: "150px", width: "150px" }}>Normal Hourly Rate</th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right whitespace-normal break-words leading-tight" style={{ minWidth: "150px", width: "150px" }}>Normal Hours Worked</th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right bg-slate-900/60 text-slate-400 whitespace-normal break-words leading-tight" style={{ minWidth: "150px", width: "150px" }}>
                  <div className="flex items-center justify-end gap-1">
                    <Calculator className="w-3.5 h-3.5 text-slate-500" />
                    Normal Wages
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.normalWages} />
                  </div>
                </th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right bg-slate-900/60 text-slate-400 whitespace-normal break-words leading-tight" style={{ minWidth: "160px", width: "160px" }}>
                  <div className="flex items-center justify-end gap-1">
                    <Calculator className="w-3.5 h-3.5 text-slate-500" />
                    Overtime Hourly Rate
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.overtimeRate} />
                  </div>
                </th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right whitespace-normal break-words leading-tight" style={{ minWidth: "160px", width: "160px" }}>Overtime Hours Worked</th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right bg-slate-900/60 text-slate-400 whitespace-normal break-words leading-tight" style={{ minWidth: "150px", width: "150px" }}>
                  <div className="flex items-center justify-end gap-1">
                    <Calculator className="w-3.5 h-3.5 text-slate-500" />
                    Overtime Wages
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.overtimeWages} />
                  </div>
                </th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right bg-slate-900/60 text-slate-400 whitespace-normal break-words leading-tight" style={{ minWidth: "170px", width: "170px" }}>
                  <div className="flex items-center justify-end gap-1">
                    <Calculator className="w-3.5 h-3.5 text-slate-500" />
                    Sunday/Holiday Rate
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.sundayRate} />
                  </div>
                </th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right whitespace-normal break-words leading-tight" style={{ minWidth: "180px", width: "180px" }}>Sunday/Holiday Hours</th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right bg-slate-900/60 text-slate-400 whitespace-normal break-words leading-tight" style={{ minWidth: "180px", width: "180px" }}>
                  <div className="flex items-center justify-end gap-1">
                    <Calculator className="w-3.5 h-3.5 text-slate-500" />
                    Sunday/Holiday Wages
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.sundayWages} />
                  </div>
                </th>
                <th 
                  className="px-4 py-3.5 border-r border-slate-800 text-right bg-slate-900/60 text-slate-400 cursor-pointer whitespace-normal break-words leading-tight" 
                  style={{ minWidth: "150px", width: "150px" }}
                  onClick={() => handleSort("grossWage")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    Gross Wage
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.grossWage} />
                  </div>
                </th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right bg-slate-900/60 text-slate-400 whitespace-normal break-words leading-tight" style={{ minWidth: "150px", width: "150px" }}>
                  <div className="flex items-center justify-end gap-1">
                    <Calculator className="w-3.5 h-3.5 text-slate-500" />
                    UIF Deduction
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.uif} />
                  </div>
                </th>
                <th className="px-4 py-3.5 border-r border-slate-800 text-right whitespace-normal break-words leading-tight" style={{ minWidth: "160px", width: "160px" }}>Other Deductions</th>
                <th 
                  className="px-4 py-3.5 border-r border-slate-800 text-right bg-emerald-950/20 text-emerald-400 cursor-pointer whitespace-normal break-words leading-tight" 
                  style={{ minWidth: "150px", width: "150px" }}
                  onClick={() => handleSort("netPay")}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                    Net Pay
                    <ArrowUpDown className="w-3 h-3 text-emerald-500" />
                    <HelpCircle className="w-3.5 h-3.5 cursor-help text-slate-500" title={formulaTooltips.netPay} />
                  </div>
                </th>
                {!readOnly && (
                  <th className="px-4 py-3.5 text-center whitespace-normal break-words leading-tight" style={{ minWidth: "130px", width: "130px" }}>Actions</th>
                )}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className={`divide-y divide-slate-850 ${readOnly ? "pointer-events-none opacity-85 select-none" : ""}`}>
              {sortedRows.length > 0 ? (
                sortedRows.map((row, index) => {
                  const calc = calculateRow(row, settings);
                  const errors = validateLabourerRow(row, rows);
                  const hasErrors = Object.keys(errors).length > 0;

                  return (
                    <tr 
                      key={row.id} 
                      className={`hover:bg-slate-900/40 transition-colors ${
                        hasErrors ? "bg-red-500/5" : ""
                      }`}
                    >
                      {/* Sticky column A: Row index */}
                      <td 
                        className="sticky left-0 bg-[#09111C] px-4 py-2 border-r border-slate-800 text-center font-mono text-slate-400 font-medium z-10 shadow-[4px_0_10px_rgba(0,0,0,0.3)]"
                        style={{ minWidth: "60px", width: "60px", left: 0 }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {hasErrors && (
                            <AlertTriangle 
                              className="w-3.5 h-3.5 text-red-500 cursor-help" 
                              title={`Validation Error: ${Object.values(errors).join(", ")}`} 
                            />
                          )}
                          <span>{index + 1}</span>
                        </div>
                      </td>

                      {/* Sticky column B: Employee Number */}
                      <td 
                        className="sticky left-[60px] bg-[#09111C] px-3 py-2 border-r border-slate-800 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.3)]"
                        style={{ minWidth: "120px", width: "120px", left: "60px" }}
                      >
                        <input
                          type="text"
                          placeholder="e.g. EMP-001"
                          value={row.employeeNumber ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { employeeNumber: e.target.value })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white font-mono font-bold text-center ${
                            errors.employeeNumber ? "border border-red-500/55 text-red-400" : ""
                          }`}
                          title={errors.employeeNumber}
                        />
                      </td>

                      {/* Sticky C: First Name */}
                      <td 
                        className="sticky left-[180px] bg-[#09111C] px-3 py-2 border-r border-slate-800 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.3)]"
                        style={{ minWidth: "130px", width: "130px", left: "180px" }}
                      >
                        <input
                          type="text"
                          placeholder="First Name"
                          value={row.firstName ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { firstName: e.target.value })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white font-medium ${
                            errors.firstName ? "border border-red-500/55" : ""
                          }`}
                          title={errors.firstName}
                        />
                      </td>

                      {/* Sticky D: Last Name */}
                      <td 
                        className="sticky left-[310px] bg-[#09111C] px-3 py-2 border-r border-slate-800 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.3)]"
                        style={{ minWidth: "130px", width: "130px", left: "310px" }}
                      >
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={row.lastName ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { lastName: e.target.value })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white font-medium ${
                            errors.lastName ? "border border-red-500/55" : ""
                          }`}
                          title={errors.lastName}
                        />
                      </td>

                      {/* E: Calculated Full Name */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-slate-900/35 font-semibold text-slate-400 italic" style={{ minWidth: "160px", width: "160px" }}>
                        <div className="truncate" title={calc.fullName}>
                          {calc.fullName || <span className="text-slate-600 font-normal">Auto-derived</span>}
                        </div>
                      </td>

                      {/* F: ID Number */}
                      <td className="px-3 py-2 border-r border-slate-800" style={{ minWidth: "150px", width: "150px" }}>
                        <input
                          type="text"
                          placeholder="ID Number"
                          value={row.idNumber ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { idNumber: e.target.value })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white font-mono ${
                            errors.idNumber ? "border border-red-500/55 text-red-400" : ""
                          }`}
                          title={errors.idNumber}
                        />
                      </td>

                      {/* G: Category */}
                      <td className="px-3 py-2 border-r border-slate-800" style={{ minWidth: "150px", width: "150px" }}>
                        <input
                          type="text"
                          placeholder="Category / Job Title"
                          value={row.jobTitle ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { jobTitle: e.target.value })}
                          className="bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white font-medium"
                        />
                      </td>

                      {/* H: Contact Number */}
                      <td className="px-3 py-2 border-r border-slate-800" style={{ minWidth: "140px", width: "140px" }}>
                        <input
                          type="text"
                          placeholder="Contact Number"
                          value={row.contactNumber ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { contactNumber: e.target.value })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white ${
                            errors.contactNumber ? "border border-red-500/55 text-red-400" : ""
                          }`}
                          title={errors.contactNumber}
                        />
                      </td>

                      {/* I: Pay Type selector ("hourly" | "salaried") */}
                      <td className="px-3 py-2 border-r border-slate-800 text-center" style={{ minWidth: "120px", width: "120px" }}>
                        <select
                          value={row.payType ?? "hourly"}
                          onChange={(e) => onUpdateRow(row.id, { payType: e.target.value as "hourly" | "salaried" })}
                          className="bg-slate-950 border border-slate-800 text-slate-300 rounded px-1.5 py-1 text-[11px] font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="hourly">Hourly</option>
                          <option value="salaried">Salaried</option>
                        </select>
                      </td>

                      {/* J: Bank Name */}
                      <td className="px-3 py-2 border-r border-slate-800" style={{ minWidth: "140px", width: "140px" }}>
                        <input
                          type="text"
                          placeholder="Bank Name"
                          value={row.bankName ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { bankName: e.target.value })}
                          className="bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white"
                        />
                      </td>

                      {/* K: Account Holder */}
                      <td className="px-3 py-2 border-r border-slate-800" style={{ minWidth: "170px", width: "170px" }}>
                        <input
                          type="text"
                          placeholder="Account Holder"
                          value={row.accountHolder ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { accountHolder: e.target.value })}
                          className="bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white"
                        />
                      </td>

                      {/* L: Account Number */}
                      <td className="px-3 py-2 border-r border-slate-800" style={{ minWidth: "160px", width: "160px" }}>
                        <input
                          type="text"
                          placeholder="Account Number"
                          value={row.accountNumber ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { accountNumber: e.target.value })}
                          className="bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white font-mono"
                        />
                      </td>

                      {/* M: Branch Code */}
                      <td className="px-3 py-2 border-r border-slate-800" style={{ minWidth: "120px", width: "120px" }}>
                        <input
                          type="text"
                          placeholder="Code"
                          value={row.branchCode ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { branchCode: e.target.value })}
                          className="bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white font-mono"
                        />
                      </td>

                      {/* N: Account Type */}
                      <td className="px-3 py-2 border-r border-slate-800" style={{ minWidth: "130px", width: "130px" }}>
                        <input
                          type="text"
                          placeholder="Type (Savings/Cheque)"
                          value={row.accountType ?? ""}
                          onChange={(e) => onUpdateRow(row.id, { accountType: e.target.value })}
                          className="bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-white"
                        />
                      </td>

                      {/* O: Normal Hourly Rate OR Base Salary */}
                      <td className="px-3 py-2 border-r border-slate-800 text-right" style={{ minWidth: "150px", width: "150px" }}>
                        {row.payType === "salaried" ? (
                          <div>
                            <input
                              type="number"
                              placeholder="Base Salary"
                              value={row.baseSalary || ""}
                              onChange={(e) => onUpdateRow(row.id, { baseSalary: parseFloat(e.target.value) || 0 })}
                              className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-right text-emerald-400 font-bold ${
                                errors.baseSalary ? "border border-red-500/55 text-red-400" : ""
                              }`}
                            />
                            <span className="text-[9px] font-bold text-slate-500 block">Monthly Base</span>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="number"
                              placeholder="Hourly Rate"
                              value={row.normalHourlyRate || ""}
                              onChange={(e) => onUpdateRow(row.id, { normalHourlyRate: parseFloat(e.target.value) || 0 })}
                              className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-right text-white font-medium ${
                                errors.normalHourlyRate ? "border border-red-500/55 text-red-400" : ""
                              }`}
                            />
                            <span className="text-[9px] font-semibold text-slate-500 block">Per Hour</span>
                          </div>
                        )}
                      </td>

                      {/* P: Normal Hours */}
                      <td className="px-3 py-2 border-r border-slate-800 text-right" style={{ minWidth: "150px", width: "150px" }}>
                        <input
                          type="number"
                          placeholder="Hours"
                          value={row.normalHours || ""}
                          onChange={(e) => onUpdateRow(row.id, { normalHours: parseFloat(e.target.value) || 0 })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-right text-white font-medium ${
                            errors.normalHours ? "border border-red-500/55 text-red-400" : ""
                          }`}
                        />
                      </td>

                      {/* Q: Calculated Normal Wages */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-slate-900/35 text-right font-mono font-bold text-slate-300" style={{ minWidth: "150px", width: "150px" }}>
                        {formatCurrency(calc.normalWages, settings)}
                      </td>

                      {/* R: Calculated Overtime Hourly Rate */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-slate-900/35 text-right font-mono text-slate-400 font-medium" style={{ minWidth: "160px", width: "160px" }}>
                        {formatCurrency(calc.overtimeHourlyRate, settings)}
                      </td>

                      {/* S: Overtime Hours */}
                      <td className="px-3 py-2 border-r border-slate-800 text-right" style={{ minWidth: "160px", width: "160px" }}>
                        <input
                          type="number"
                          placeholder="Overtime"
                          value={row.overtimeHours || ""}
                          onChange={(e) => onUpdateRow(row.id, { overtimeHours: parseFloat(e.target.value) || 0 })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-right text-white font-medium ${
                            errors.overtimeHours ? "border border-red-500/55 text-red-400" : ""
                          }`}
                        />
                      </td>

                      {/* T: Calculated Overtime Wages */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-slate-900/35 text-right font-mono font-bold text-blue-400" style={{ minWidth: "150px", width: "150px" }}>
                        {formatCurrency(calc.overtimeWages, settings)}
                      </td>

                      {/* U: Calculated Sunday/Holiday Rate */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-slate-900/35 text-right font-mono text-slate-400 font-medium" style={{ minWidth: "170px", width: "170px" }}>
                        {formatCurrency(calc.sundayHolidayHourlyRate, settings)}
                      </td>

                      {/* V: Sunday Hours */}
                      <td className="px-3 py-2 border-r border-slate-800 text-right" style={{ minWidth: "180px", width: "180px" }}>
                        <input
                          type="number"
                          placeholder="Sunday"
                          value={row.sundayHolidayHours || ""}
                          onChange={(e) => onUpdateRow(row.id, { sundayHolidayHours: parseFloat(e.target.value) || 0 })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-right text-white font-medium ${
                            errors.sundayHolidayHours ? "border border-red-500/55 text-red-400" : ""
                          }`}
                        />
                      </td>

                      {/* W: Calculated Sunday Wages */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-slate-900/35 text-right font-mono font-bold text-violet-400" style={{ minWidth: "180px", width: "180px" }}>
                        {formatCurrency(calc.sundayHolidayWages, settings)}
                      </td>

                      {/* X: Calculated Gross Wage */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-slate-900/50 text-right font-mono font-extrabold text-amber-400" style={{ minWidth: "150px", width: "150px" }}>
                        {formatCurrency(calc.grossWage, settings)}
                      </td>

                      {/* Y: Calculated UIF Deduction */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-slate-900/35 text-right font-mono font-bold text-red-400" style={{ minWidth: "150px", width: "150px" }}>
                        {formatCurrency(calc.uifDeduction, settings)}
                      </td>

                      {/* Z: Other Deductions */}
                      <td className="px-3 py-2 border-r border-slate-800 text-right" style={{ minWidth: "160px", width: "160px" }}>
                        <input
                          type="number"
                          placeholder="Other Ded."
                          value={row.otherDeductions || ""}
                          onChange={(e) => onUpdateRow(row.id, { otherDeductions: parseFloat(e.target.value) || 0 })}
                          className={`bg-transparent border-0 focus:bg-slate-950 focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-1 text-xs w-full text-right text-red-400 font-medium ${
                            errors.otherDeductions ? "border border-red-500/55 text-red-400" : ""
                          }`}
                        />
                      </td>

                      {/* AA: Calculated Net Pay */}
                      <td className="px-4 py-2 border-r border-slate-800 bg-emerald-950/20 text-right font-mono font-black text-emerald-300" style={{ minWidth: "150px", width: "150px" }}>
                        {formatCurrency(calc.netPay, settings)}
                      </td>

                      {/* Row actions */}
                      {!readOnly && (
                        <td className="px-4 py-2 text-center" style={{ minWidth: "130px", width: "130px" }}>
                          <div className="flex items-center justify-center gap-2">
                            {/* Duplicate button */}
                            <button
                              type="button"
                              onClick={() => onDuplicateRow(row)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Duplicate Row"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Clear row */}
                            <button
                              type="button"
                              onClick={() => onClearRow(row.id)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-500 rounded-lg transition-colors cursor-pointer"
                              title="Clear Row Numbers"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete row */}
                            <button
                              type="button"
                              onClick={() => setShowDeleteConfirm(row.id)}
                              className="p-1.5 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={28} className="p-12 text-center text-slate-500 text-xs italic">
                    {searchTerm ? "No staff records found matching your search." : "No staff records added yet. Click 'Add Staff Row' above to start."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Count Disclaimer */}
      <div className="text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Double-click or click inside any cell to edit details in-place. Calculations update instantly.</span>
        </div>
        <span className="font-mono text-slate-400">{sortedRows.length} shown of {rows.length} total staff</span>
      </div>

      {/* INDIVIDUAL ROW DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scaleIn">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Confirm Delete</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Are you sure you want to completely remove this staff member from the current active payroll? This action is permanent.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRow(showDeleteConfirm);
                  setShowDeleteConfirm(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Delete Row
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ALL CONFIRMATION MODAL */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scaleIn">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Clear Full Payroll?</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Are you sure you want to wipe all staff rows and metrics from this payroll session? This draft data will be lost.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearFullPayroll();
                  setShowClearAllConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Clear Payroll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
