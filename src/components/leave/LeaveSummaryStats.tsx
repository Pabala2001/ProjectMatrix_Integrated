import React from "react";
import { 
  Users, 
  CalendarCheck, 
  Clock, 
  AlertCircle, 
  HeartHandshake, 
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet
} from "lucide-react";
import { LeaveRequest, EmployeeLeaveBalance } from "../../types/leave";

interface LeaveSummaryStatsProps {
  requests: LeaveRequest[];
  balances: EmployeeLeaveBalance[];
  onOpenNewModal: () => void;
  onFilterStatus: (status: string) => void;
}

export default function LeaveSummaryStats({
  requests,
  balances,
  onOpenNewModal,
  onFilterStatus
}: LeaveSummaryStatsProps) {
  const pendingCount = requests.filter(r => r.status === "Pending").length;
  const approvedCount = requests.filter(r => r.status === "Approved").length;

  const todayStr = new Date().toISOString().split("T")[0];
  const activeOnLeaveToday = requests.filter(r => {
    return r.status === "Approved" && r.startDate <= todayStr && r.endDate >= todayStr;
  }).length;

  const totalLeaveDaysTaken = balances.reduce((acc, b) => acc + (b.annualUsed || 0) + (b.sickUsedCycle || 0), 0);
  const totalAccruedPool = balances.reduce((acc, b) => acc + (b.annualBalance || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Active on Leave */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            On Leave Today
          </span>
          <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-black text-white">{activeOnLeaveToday}</span>
          <span className="text-xs text-slate-400 font-medium">Site Personnel</span>
        </div>
        <div className="mt-2 text-[11px] text-amber-400/90 flex items-center gap-1 font-semibold">
          <span>{activeOnLeaveToday > 0 ? "Shift handovers active" : "Full site presence"}</span>
        </div>
      </div>

      {/* 2. Pending Approvals */}
      <div 
        onClick={() => onFilterStatus("Pending")}
        className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between cursor-pointer transition-all group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Pending Applications
          </span>
          <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl group-hover:scale-110 transition-transform">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-black text-white">{pendingCount}</span>
          <span className="text-xs text-slate-400 font-medium">Awaiting Manager Review</span>
        </div>
        <div className="mt-2 text-[11px] text-blue-400 font-semibold flex items-center gap-1">
          <span>Click to review requests</span>
        </div>
      </div>

      {/* 3. Accrued Leave Balance Pool */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Total Accrued Balance
          </span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            <CalendarCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-black text-white">{totalAccruedPool.toFixed(1)}</span>
          <span className="text-xs text-slate-400 font-medium">Days Available Pool</span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400 font-semibold">
          <span>Statutory compliance maintained</span>
        </div>
      </div>

      {/* 4. Total Days Utilized */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Leave Days Utilized
          </span>
          <div className="p-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-black text-white">{totalLeaveDaysTaken}</span>
          <span className="text-xs text-slate-400 font-medium">Days Taken (YTD)</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 font-medium">
          <span>Across {balances.length} active employees</span>
        </div>
      </div>
    </div>
  );
}
