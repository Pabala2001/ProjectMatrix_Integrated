import React, { useState } from "react";
import { 
  Calendar, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  Check, 
  FileText, 
  Heart, 
  GraduationCap, 
  Baby, 
  Umbrella, 
  Compass, 
  Coffee,
  Plus,
  ArrowRight,
  HelpCircle,
  Briefcase
} from "lucide-react";
import { LeaveCategory, LeavePolicy } from "../../types/leave";
import { LEAVE_POLICIES } from "../../services/leaveService";

interface LeaveTypesDirectoryProps {
  onApplyForType: (leaveType: LeaveCategory) => void;
}

export default function LeaveTypesDirectory({ onApplyForType }: LeaveTypesDirectoryProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = ["All", "Statutory Paid", "Medical & Incapacity", "Parental Care", "Family Responsibility", "Professional Development", "Site Camp & Fly-In-Fly-Out", "Overtime Balance", "Discretionary"];

  const filteredPolicies = LEAVE_POLICIES.filter(policy => {
    const matchesCategory = selectedFilter === "All" || policy.category === selectedFilter;
    const matchesSearch = policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          policy.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          policy.statutoryReference.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getIconForPolicy = (id: LeaveCategory) => {
    switch (id) {
      case "annual":
        return Umbrella;
      case "sick":
        return Heart;
      case "maternity":
      case "paternity":
        return Baby;
      case "compassionate":
        return ShieldCheck;
      case "study":
        return GraduationCap;
      case "site_rr":
        return Compass;
      case "compensatory":
        return Clock;
      case "public_holiday":
        return Coffee;
      case "unpaid":
      default:
        return Calendar;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Statutory & Construction Leave Matrix
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            10 institutional leave categories with statutory accrual formulas, notice windows, and handover requirements.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search leave types or clauses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedFilter(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedFilter === cat
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Leave Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredPolicies.map((policy) => {
          const IconComponent = getIconForPolicy(policy.id);

          return (
            <div
              key={policy.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group relative overflow-hidden"
            >
              {/* Top Row: Icon + Badge + Code */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl border ${policy.color.bg} ${policy.color.border} ${policy.color.text}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                        {policy.shortCode} • {policy.category}
                      </span>
                      <h4 className="text-sm font-black text-white tracking-tight mt-0.5">
                        {policy.name}
                      </h4>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${policy.color.badgeBg} ${policy.color.badgeText}`}>
                    {policy.paidStatus}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 mt-4 leading-relaxed line-clamp-3">
                  {policy.description}
                </p>

                {/* Key Specs Breakdown */}
                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Standard Entitlement:</span>
                    <span className="font-bold text-white">
                      {policy.entitlementDaysPerYear} {policy.id === "maternity" ? "Consecutive Days" : "Working Days / Yr"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Accrual Formula:</span>
                    <span className="font-semibold text-slate-300 text-right max-w-[200px] truncate" title={policy.accrualRate}>
                      {policy.accrualRate}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Notice Required:</span>
                    <span className="font-semibold text-slate-300">
                      {policy.noticePeriodDays > 0 ? `${policy.noticePeriodDays} Days Advance Notice` : "Immediate / Same Day"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Medical Certificate:</span>
                    <span className={`font-semibold ${policy.requiresMedicalCertificate ? "text-amber-400" : "text-slate-400"}`}>
                      {policy.requiresMedicalCertificate ? "Mandatory (>2 Days)" : "Not Required"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Site Handover:</span>
                    <span className={`font-semibold ${policy.requiresHandoverRelief ? "text-blue-400" : "text-slate-400"}`}>
                      {policy.requiresHandoverRelief ? "Required for Site Staff" : "Optional"}
                    </span>
                  </div>
                </div>

                {/* Statutory Reference */}
                <div className="mt-3.5 bg-slate-950/60 border border-slate-850 p-2.5 rounded-xl text-[10px] text-slate-400 flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Compliance:</span>
                  <span className="font-semibold text-slate-300">{policy.statutoryReference}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  Max consecutive: <strong className="text-slate-300">{policy.maxConsecutiveDays}d</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onApplyForType(policy.id)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Apply Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
