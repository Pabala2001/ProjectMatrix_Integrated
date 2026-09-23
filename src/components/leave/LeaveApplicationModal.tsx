import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { 
  X, 
  Calendar, 
  Clock, 
  FileText, 
  Upload, 
  Check, 
  AlertCircle, 
  User, 
  ShieldAlert,
  Info,
  CheckCircle2
} from "lucide-react";
import { LeaveCategory, LeaveRequest, EmployeeLeaveBalance } from "../../types/leave";
import { LEAVE_POLICIES, calculateWorkingDays } from "../../services/leaveService";

interface LeaveApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: Omit<LeaveRequest, "id" | "appliedAt">) => void;
  balances: EmployeeLeaveBalance[];
  companyPersonnel: any[];
  initialLeaveType?: LeaveCategory;
  activeCompany?: any;
  activeProject?: any;
  currentUserName?: string;
}

export default function LeaveApplicationModal({
  isOpen,
  onClose,
  onSubmit,
  balances,
  companyPersonnel = [],
  initialLeaveType = "annual",
  activeCompany,
  activeProject,
  currentUserName = "Site User"
}: LeaveApplicationModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [leaveType, setLeaveType] = useState<LeaveCategory>(initialLeaveType);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"morning" | "afternoon">("morning");
  const [reason, setReason] = useState<string>("");
  const [handoverColleague, setHandoverColleague] = useState<string>("");
  const [emergencyPhone, setEmergencyPhone] = useState<string>("");
  const [medicalCertAttached, setMedicalCertAttached] = useState<boolean>(false);
  const [medicalCertName, setMedicalCertName] = useState<string>("");

  // Select first employee as default on load
  useEffect(() => {
    if (balances.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(balances[0].employeeId);
    }
  }, [balances, selectedEmployeeId]);

  useEffect(() => {
    if (initialLeaveType) {
      setLeaveType(initialLeaveType);
    }
  }, [initialLeaveType]);

  if (!isOpen) return null;

  const currentPolicy = LEAVE_POLICIES.find(p => p.id === leaveType) || LEAVE_POLICIES[0];
  const selectedBalance = balances.find(b => b.employeeId === selectedEmployeeId) || balances[0];

  const calculatedDays = calculateWorkingDays(startDate, endDate, isHalfDay);

  // Balance Check
  let availableBalance = selectedBalance?.annualBalance ?? 0;
  if (leaveType === "sick") availableBalance = selectedBalance?.sickBalance ?? 30;
  if (leaveType === "compassionate") availableBalance = selectedBalance?.compassionateBalance ?? 5;
  if (leaveType === "study") availableBalance = (selectedBalance?.studyEntitlement ?? 6) - (selectedBalance?.studyUsed ?? 0);
  if (leaveType === "maternity") availableBalance = 120;
  if (leaveType === "paternity") availableBalance = 10;
  if (leaveType === "site_rr") availableBalance = 14;
  if (leaveType === "unpaid") availableBalance = 30;

  const isExceedingBalance = (leaveType === "annual" || leaveType === "sick") && calculatedDays > availableBalance;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/leave/LeaveApplicationModal.tsx");
    e.preventDefault();

    if (calculatedDays <= 0) {
      alert("Please select valid dates with at least 1 working day.");
      return;
    }

    const emp = selectedBalance || {
      employeeId: "emp-generic",
      employeeName: currentUserName,
      employeeNumber: "EMP-001",
      role: "Site Personnel",
      department: "Site Team"
    };

    onSubmit({
      companyId: activeCompany?.id || "comp-001",
      projectId: activeProject?.id || "proj-001",
      employeeId: emp.employeeId,
      employeeNumber: emp.employeeNumber,
      employeeName: emp.employeeName,
      employeeRole: emp.role,
      department: emp.department,
      contactNumber: emergencyPhone || "+27 82 000 0000",
      leaveType: leaveType,
      leaveTypeName: currentPolicy.name,
      startDate,
      endDate,
      totalWorkingDays: calculatedDays,
      isHalfDay,
      halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
      reason: reason || `Requested ${currentPolicy.name} period.`,
      handoverColleague: handoverColleague || "Shift Supervisor",
      emergencyPhone: emergencyPhone || "+27 82 000 0000",
      medicalCertName: medicalCertAttached ? (medicalCertName || "Medical_Cert_Signed.pdf") : undefined,
      medicalCertUploaded: medicalCertAttached,
      status: "Pending",
      appliedBy: currentUserName,
      payrollImpact: currentPolicy.paidStatus === "Unpaid" ? "Salary Deducted (Unpaid)" : "No Deduction (Paid)"
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 relative shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Human Resources • Employee Leave</span>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">New Leave Application</h2>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Select Employee & Leave Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Staff Member
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {balances.map((b) => (
                  <option key={b.employeeId} value={b.employeeId}>
                    {b.employeeName} ({b.employeeNumber} • {b.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Leave Type Category
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveCategory)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {LEAVE_POLICIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.paidStatus}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Policy Information Pill */}
          <div className={`p-4 rounded-2xl border ${currentPolicy.color.bg} ${currentPolicy.color.border} text-xs flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <span className={`font-black uppercase tracking-wider text-[11px] ${currentPolicy.color.text}`}>
                {currentPolicy.category} • {currentPolicy.paidStatus}
              </span>
              <span className="text-slate-300 font-semibold">
                Available Pool: <strong className="text-white">{availableBalance} Days</strong>
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {currentPolicy.description}
            </p>
            <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1">
              <span>Notice Window: <strong>{currentPolicy.noticePeriodDays}d</strong></span>
              <span>Med Cert: <strong>{currentPolicy.requiresMedicalCertificate ? "Required" : "No"}</strong></span>
              <span>Compliance: <strong>{currentPolicy.statutoryReference}</strong></span>
            </div>
          </div>

          {/* 2. Date Pickers & Calculations */}
          <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Half-Day Option */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-850">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <span>Half-Day Leave Option (0.5 working day)</span>
              </label>

              {isHalfDay && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod("morning")}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      halfDayPeriod === "morning" ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    Morning
                  </button>
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod("afternoon")}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      halfDayPeriod === "afternoon" ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400"
                    }`}
                  >
                    Afternoon
                  </button>
                </div>
              )}
            </div>

            {/* Working Day Summary */}
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-850 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Statutory Working Days (Excluding Weekends):</span>
              <span className="font-black text-sm text-amber-400">
                {calculatedDays} {calculatedDays === 1 ? "Working Day" : "Working Days"}
              </span>
            </div>

            {isExceedingBalance && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Notice: Requested duration ({calculatedDays} days) exceeds available entitlement ({availableBalance} days). Excess may convert to Unpaid Leave upon approval.
                </span>
              </div>
            )}
          </div>

          {/* 3. Site Handover & Emergency Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Designated Handover / Relief Person
              </label>
              <input
                type="text"
                value={handoverColleague}
                onChange={(e) => setHandoverColleague(e.target.value)}
                placeholder="e.g. Sipho Nkosi (Foreman)"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="+27 82 555 1234"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* 4. Reason Description */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Reason & Details
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
              placeholder="Provide context for this leave application..."
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 5. Medical Certificate Attachment Toggle */}
          {(currentPolicy.requiresMedicalCertificate || leaveType === "sick" || leaveType === "maternity" || leaveType === "paternity") && (
            <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Attach Medical Certificate / Proof</span>
                <span className="text-[11px] text-slate-400">Doctor's certificate or official statutory confirmation</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-800 hover:bg-slate-850 px-3 py-1.5 rounded-xl text-xs text-slate-300">
                <Upload className="w-3.5 h-3.5 text-amber-500" />
                <span>{medicalCertAttached ? "Medical_Note_Verified.pdf" : "Attach File"}</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setMedicalCertAttached(true);
                      setMedicalCertName(e.target.files[0].name);
                    }
                  }}
                />
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Leave Application</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
