import React, { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  Filter 
} from "lucide-react";
import { LeaveRequest } from "../../types/leave";

interface LeaveCalendarViewProps {
  requests: LeaveRequest[];
}

export default function LeaveCalendarView({ requests }: LeaveCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 7, 1)); // August 2026

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const numDays = daysInMonth(year, month);
  const startDayOffset = firstDayOfMonth(year, month); // 0 = Sunday

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const approvedRequests = requests.filter(r => r.status === "Approved");

  // Get leave events for a given day
  const getLeavesForDate = (dayNum: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return approvedRequests.filter(r => r.startDate <= dayStr && r.endDate >= dayStr);
  };

  const dayCells = [];
  for (let i = 0; i < startDayOffset; i++) {
    dayCells.push(null);
  }
  for (let i = 1; i <= numDays; i++) {
    dayCells.push(i);
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5 md:p-6 space-y-6">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-tight">
              {monthNames[month]} {year}
            </h3>
            <p className="text-xs text-slate-400">
              Site Staff Leave & Handover Rotation Schedule
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(2026, 7, 1))}
            className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Current Month
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">
        <div className="py-1 text-red-400">Sun</div>
        <div className="py-1">Mon</div>
        <div className="py-1">Tue</div>
        <div className="py-1">Wed</div>
        <div className="py-1">Thu</div>
        <div className="py-1">Fri</div>
        <div className="py-1 text-slate-500">Sat</div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {dayCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return (
              <div key={`empty-${idx}`} className="h-24 bg-slate-950/20 border border-slate-900 rounded-xl" />
            );
          }

          const leavesOnDay = getLeavesForDate(dayNum);
          const isWeekend = (idx % 7 === 0) || (idx % 7 === 6);

          return (
            <div
              key={`day-${dayNum}`}
              className={`h-24 p-2 rounded-xl border flex flex-col justify-between transition-colors overflow-hidden ${
                isWeekend ? "bg-slate-950/40 border-slate-850/60" : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isWeekend ? "text-slate-500" : "text-slate-300"}`}>
                  {dayNum}
                </span>
                {leavesOnDay.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                )}
              </div>

              <div className="space-y-1 overflow-y-auto max-h-14 scrollbar-none">
                {leavesOnDay.map((req) => (
                  <div
                    key={req.id}
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold truncate bg-amber-500/20 border border-amber-500/30 text-amber-300"
                    title={`${req.employeeName} (${req.leaveTypeName}) - Handover: ${req.handoverColleague || "None"}`}
                  >
                    {req.employeeName.split(" ")[0]} ({req.leaveType.toUpperCase()})
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
