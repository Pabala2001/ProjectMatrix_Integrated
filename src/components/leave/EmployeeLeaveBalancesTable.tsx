import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { 
  Users, 
  Search, 
  Download, 
  Edit3, 
  Plus, 
  Check, 
  AlertCircle,
  TrendingUp,
  FileSpreadsheet
} from "lucide-react";
import { EmployeeLeaveBalance } from "../../types/leave";

interface EmployeeLeaveBalancesTableProps {
  balances: EmployeeLeaveBalance[];
  onAdjustBalance?: (employeeId: string) => void;
}

export default function EmployeeLeaveBalancesTable({
  balances,
  onAdjustBalance
}: EmployeeLeaveBalancesTableProps) {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  const departments = ["All", ...Array.from(new Set(balances.map(b => b.department).filter(Boolean).filter(d => d !== "All")))];

  const filteredBalances = balances.filter(b => {
    const matchesDept = departmentFilter === "All" || b.department === departmentFilter;
    const matchesSearch = 
      b.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      b.employeeNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.role.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const handleExportCsv = () => {
    assertOperationalAction("export", "components/leave/EmployeeLeaveBalancesTable.tsx");
    const headers = [
      "Employee Number",
      "Employee Name",
      "Department",
      "Role",
      "Annual Entitlement",
      "Accrued to Date",
      "Annual Used",
      "Annual Balance",
      "Sick Balance",
      "Compassionate Balance",
      "Total Taken YTD"
    ];

    const rows = filteredBalances.map(b => [
      b.employeeNumber,
      `"${b.employeeName}"`,
      `"${b.department}"`,
      `"${b.role}"`,
      b.annualEntitlement,
      b.annualAccruedToDate,
      b.annualUsed,
      b.annualBalance,
      b.sickBalance,
      b.compassionateBalance,
      b.totalLeaveTakenThisYear
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Employee_Leave_Balances_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee name, ID, or job role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Department Filter & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {departments.map((d, idx) => (
              <option key={`${d}-${idx}`} value={d}>{d === "All" ? "All Departments" : d}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Balances CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Department & Role</th>
                <th className="py-3.5 px-4">Annual Entitlement</th>
                <th className="py-3.5 px-4">Accrued to Date</th>
                <th className="py-3.5 px-4">Annual Used</th>
                <th className="py-3.5 px-4">Remaining Balance</th>
                <th className="py-3.5 px-4">Sick Leave Pool</th>
                <th className="py-3.5 px-4 text-right">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredBalances.map((emp) => {
                const utilizationPct = emp.annualEntitlement > 0 
                  ? Math.min(100, Math.round((emp.annualUsed / emp.annualEntitlement) * 100))
                  : 0;

                return (
                  <tr key={emp.employeeId} className="hover:bg-slate-850/50 transition-colors">
                    {/* Employee */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                          {emp.employeeName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-white block">{emp.employeeName}</span>
                          <span className="text-[10px] text-slate-400">{emp.employeeNumber}</span>
                        </div>
                      </div>
                    </td>

                    {/* Department & Role */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-200 block">{emp.role}</span>
                      <span className="text-[10px] text-slate-400">{emp.department}</span>
                    </td>

                    {/* Annual Entitlement */}
                    <td className="py-3.5 px-4 font-semibold text-slate-300">
                      {emp.annualEntitlement} Days / Yr
                    </td>

                    {/* Accrued to Date */}
                    <td className="py-3.5 px-4 font-bold text-emerald-400">
                      {emp.annualAccruedToDate.toFixed(1)} Days
                    </td>

                    {/* Annual Used */}
                    <td className="py-3.5 px-4 font-semibold text-slate-300">
                      {emp.annualUsed} Days
                    </td>

                    {/* Remaining Balance */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-xs">
                        {emp.annualBalance.toFixed(1)} Days
                      </span>
                    </td>

                    {/* Sick Leave Pool */}
                    <td className="py-3.5 px-4">
                      <span className="text-slate-300 font-medium block">
                        {emp.sickBalance} / {emp.sickEntitlementCycle} Days
                      </span>
                      <span className="text-[10px] text-slate-500">3-Year Cycle</span>
                    </td>

                    {/* Utilization Progress Bar */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] font-bold text-slate-300">
                          {utilizationPct}%
                        </span>
                        <div className="w-20 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              utilizationPct > 80 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${utilizationPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
