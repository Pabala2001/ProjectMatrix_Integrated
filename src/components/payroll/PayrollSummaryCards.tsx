import React from "react";
import { PayrollSettings, LabourPayrollRow } from "../../types/payroll";
import { calculateTotals, formatCurrency } from "../../utils/payrollCalculations";
import { Users, Wallet } from "lucide-react";

interface PayrollSummaryCardsProps {
  rows: LabourPayrollRow[];
  settings: PayrollSettings;
}

export default function PayrollSummaryCards({ rows, settings }: PayrollSummaryCardsProps) {
  const totals = calculateTotals(rows, settings);

  return (
    <div className="space-y-4">
      {/* Group Title */}
      <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">
        Live Payroll Aggregate Summary
      </h3>

      {/* Grid of 2 Large Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Total Staff */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl flex items-center justify-between min-w-0">
          <div className="text-left min-w-0 flex-1">
            <span className="block text-xs font-black text-slate-400 uppercase tracking-widest">
              Total Staff
            </span>
            <span className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-white mt-2 block tracking-tight break-words">
              {totals.totalLabourers} <span className="text-sm text-slate-500 font-normal">active staff</span>
            </span>
          </div>
          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 shrink-0 ml-4">
            <Users className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        {/* Net Payroll */}
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6 shadow-xl flex items-center justify-between min-w-0">
          <div className="text-left min-w-0 flex-1">
            <span className="block text-xs font-black text-emerald-400 uppercase tracking-widest">
              Net Payroll
            </span>
            <span className="text-xl sm:text-2xl xl:text-3xl font-black text-emerald-300 mt-2 block tracking-tight break-words">
              {formatCurrency(totals.totalNetPayroll, settings)}
            </span>
          </div>
          <div className="p-4 bg-emerald-500/15 rounded-2xl border border-emerald-500/30 shrink-0 ml-4">
            <Wallet className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
