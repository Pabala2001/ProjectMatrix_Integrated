import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  FileText, 
  Users, 
  Clock, 
  Plus, 
  CalendarRange, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Briefcase,
  Layers,
  Sparkles,
  Search,
  Filter
} from "lucide-react";
import { LeaveCategory, LeaveRequest, EmployeeLeaveBalance, LeaveStatus } from "../../types/leave";
import { 
  getLeaveRequests, 
  saveLeaveRequests, 
  getLeaveBalances, 
  saveLeaveBalances,
  LEAVE_POLICIES 
} from "../../services/leaveService";
import LeaveSummaryStats from "../../components/leave/LeaveSummaryStats";
import LeaveTypesDirectory from "../../components/leave/LeaveTypesDirectory";
import LeaveRequestsTable from "../../components/leave/LeaveRequestsTable";
import EmployeeLeaveBalancesTable from "../../components/leave/EmployeeLeaveBalancesTable";
import LeaveCalendarView from "../../components/leave/LeaveCalendarView";
import LeaveApplicationModal from "../../components/leave/LeaveApplicationModal";

interface EmployeeLeavePageProps {
  activeCompany?: any;
  activeProject?: any;
  userRole?: string;
  isManager?: boolean;
  currentUser?: any;
}

export default function EmployeeLeavePage({
  activeCompany = { id: "comp-001", name: "Mbhonya Construction" },
  activeProject = { id: "proj-001", name: "Mbhonya Jabulani Res" },
  userRole = "Admin",
  isManager = true,
  currentUser = { name: "Project Manager" }
}: EmployeeLeavePageProps) {
  const [activeTab, setActiveTab] = useState<"directory" | "requests" | "balances" | "calendar">("requests");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<EmployeeLeaveBalance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalInitialLeaveType, setModalInitialLeaveType] = useState<LeaveCategory>("annual");
  const [requestFilterStatus, setRequestFilterStatus] = useState<string>("All");
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Load from local storage / service
  useEffect(() => {
    const loadedRequests = getLeaveRequests();
    const loadedBalances = getLeaveBalances();
    setRequests(loadedRequests);
    setBalances(loadedBalances);
  }, []);

  const handleCreateRequest = (newReqData: Omit<LeaveRequest, "id" | "appliedAt">) => {
    assertOperationalAction("create", "pages/HumanResources/EmployeeLeavePage.tsx");
    const newReq: LeaveRequest = {
      ...newReqData,
      id: `req-${Date.now()}`,
      appliedAt: new Date().toISOString()
    };

    const updatedRequests = [newReq, ...requests];
    setRequests(updatedRequests);
    saveLeaveRequests(updatedRequests);

    setBannerNotice(`Leave application for ${newReq.employeeName} (${newReq.totalWorkingDays} days) submitted successfully.`);
    setTimeout(() => setBannerNotice(null), 5000);
  };

  const handleUpdateStatus = (id: string, newStatus: LeaveStatus, comment?: string) => {
    assertOperationalAction("edit", "pages/HumanResources/EmployeeLeavePage.tsx");
    const updated = requests.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: newStatus,
          approvedBy: newStatus === "Approved" ? (currentUser?.name || "Manager") : r.approvedBy,
          approvedAt: newStatus === "Approved" ? new Date().toISOString() : r.approvedAt,
          managerComments: comment || r.managerComments
        };
      }
      return r;
    });

    setRequests(updated);
    saveLeaveRequests(updated);

    // If approved and type is annual/sick, optionally deduct from balances
    if (newStatus === "Approved") {
      const targetReq = requests.find(r => r.id === id);
      if (targetReq) {
        const updatedBalances = balances.map(b => {
          if (b.employeeId === targetReq.employeeId) {
            if (targetReq.leaveType === "annual") {
              const newUsed = b.annualUsed + targetReq.totalWorkingDays;
              return {
                ...b,
                annualUsed: newUsed,
                annualBalance: Math.max(0, b.annualEntitlement - newUsed),
                totalLeaveTakenThisYear: b.totalLeaveTakenThisYear + targetReq.totalWorkingDays
              };
            } else if (targetReq.leaveType === "sick") {
              const newSickUsed = b.sickUsedCycle + targetReq.totalWorkingDays;
              return {
                ...b,
                sickUsedCycle: newSickUsed,
                sickBalance: Math.max(0, b.sickEntitlementCycle - newSickUsed),
                totalLeaveTakenThisYear: b.totalLeaveTakenThisYear + targetReq.totalWorkingDays
              };
            }
          }
          return b;
        });

        setBalances(updatedBalances);
        saveLeaveBalances(updatedBalances);
      }
    }

    setBannerNotice(`Leave request status updated to ${newStatus}.`);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  const handleApplyForType = (type: LeaveCategory) => {
    setModalInitialLeaveType(type);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Banner Notice */}
      {bannerNotice && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{bannerNotice}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-xs text-emerald-400/80 hover:text-emerald-300 font-black uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md p-6 rounded-2xl shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-500 shrink-0">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
              Human Resources Management
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              Employee Leave & Statutory Absence
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Manage statutory leave entitlements, site camp R&R rosters, employee accruals, and supervisory approvals for {activeProject?.name || "Active Project"}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setModalInitialLeaveType("annual");
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto px-5 h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>Apply For Leave</span>
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <LeaveSummaryStats
        requests={requests}
        balances={balances}
        onOpenNewModal={() => {
          setModalInitialLeaveType("annual");
          setIsModalOpen(true);
        }}
        onFilterStatus={(status) => {
          setActiveTab("requests");
          setRequestFilterStatus(status);
        }}
      />

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "requests"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
              : "bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Leave Applications Ledger</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
            activeTab === "requests" ? "bg-slate-950 text-amber-400" : "bg-slate-800 text-slate-400"
          }`}>
            {requests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "directory"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
              : "bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Leave Types & Statutory Policies</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
            activeTab === "directory" ? "bg-slate-950 text-amber-400" : "bg-slate-800 text-slate-400"
          }`}>
            {LEAVE_POLICIES.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("balances")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "balances"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
              : "bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Employee Balances & Accruals</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
            activeTab === "balances" ? "bg-slate-950 text-amber-400" : "bg-slate-800 text-slate-400"
          }`}>
            {balances.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("calendar")}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "calendar"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
              : "bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800"
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          <span>Site Attendance Roster & Calendar</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">
        {activeTab === "directory" && (
          <LeaveTypesDirectory onApplyForType={handleApplyForType} />
        )}

        {activeTab === "requests" && (
          <LeaveRequestsTable
            requests={requests}
            onOpenNewModal={() => {
              setModalInitialLeaveType("annual");
              setIsModalOpen(true);
            }}
            onUpdateStatus={handleUpdateStatus}
            isManager={isManager}
            filterStatus={requestFilterStatus}
          />
        )}

        {activeTab === "balances" && (
          <EmployeeLeaveBalancesTable balances={balances} />
        )}

        {activeTab === "calendar" && (
          <LeaveCalendarView requests={requests} />
        )}
      </div>

      {/* Application Modal */}
      <LeaveApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateRequest}
        balances={balances}
        companyPersonnel={balances}
        initialLeaveType={modalInitialLeaveType}
        activeCompany={activeCompany}
        activeProject={activeProject}
        currentUserName={currentUser?.name || "Site Supervisor"}
      />
    </div>
  );
}
