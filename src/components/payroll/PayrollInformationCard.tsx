import React from "react";
import { PayrollInfo } from "../../types/payroll";
import { FileSpreadsheet, Calendar, User, Briefcase } from "lucide-react";

interface PayrollInformationCardProps {
  info: PayrollInfo;
  onChange: (key: keyof PayrollInfo, value: string) => void;
  readOnly?: boolean;
}

export default function PayrollInformationCard({ info, onChange, readOnly = false }: PayrollInformationCardProps) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className={`bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-6 ${readOnly ? "pointer-events-none opacity-85 select-none" : ""}`}>
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <FileSpreadsheet className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Payroll Identification & Information</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Project Name */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Project Name
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="e.g. Mbhonya Jabulani Res"
              value={info.project ?? ""}
              onChange={(e) => onChange("project", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
            />
          </div>
        </div>

        {/* Employer/Company Name */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Employer / Company Name
          </label>
          <input
            type="text"
            placeholder="e.g. Mbhonya Construction"
            value={info.employerName ?? ""}
            onChange={(e) => onChange("employerName", e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
          />
        </div>

        {/* Payroll Title */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Payroll Title
          </label>
          <input
            type="text"
            placeholder="e.g. Staff Payroll – March 2026"
            value={info.payrollTitle ?? ""}
            onChange={(e) => onChange("payrollTitle", e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
          />
        </div>

        {/* Payroll Month */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Payroll Month
          </label>
          <select
            value={info.payrollMonth ?? ""}
            onChange={(e) => onChange("payrollMonth", e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-semibold cursor-pointer"
          >
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Payroll Year */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Payroll Year
          </label>
          <input
            type="number"
            min="2000"
            max="2100"
            value={info.payrollYear ?? ""}
            onChange={(e) => onChange("payrollYear", e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs font-medium"
          />
        </div>

        {/* Pay Period Start Date */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Pay Period Start Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={info.startDate ?? ""}
              onChange={(e) => onChange("startDate", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>
        </div>

        {/* Pay Period End Date */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Pay Period End Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={info.endDate ?? ""}
              onChange={(e) => onChange("endDate", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>
        </div>

        {/* Prepared By */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Prepared By
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="e.g. J. Smith"
              value={info.preparedBy ?? ""}
              onChange={(e) => onChange("preparedBy", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium"
            />
          </div>
        </div>

        {/* Date Prepared */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Date Prepared
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={info.datePrepared ?? ""}
              onChange={(e) => onChange("datePrepared", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Notes Row */}
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          General Notes / Remarks
        </label>
        <textarea
          placeholder="Enter comments, audit notes, or specific instructions for the payroll period..."
          value={info.notes ?? ""}
          onChange={(e) => onChange("notes", e.target.value)}
          rows={2}
          className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs font-medium resize-none"
        />
      </div>
    </div>
  );
}
