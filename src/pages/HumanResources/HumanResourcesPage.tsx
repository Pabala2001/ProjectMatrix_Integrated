import React, { useState, useEffect } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import { 
  Users, 
  FileSpreadsheet, 
  Calendar, 
  Briefcase, 
  Layers, 
  ShieldCheck,
  Building2,
  Clock,
  Sparkles
} from "lucide-react";
import LabourPayrollPage from "../LabourPayroll/LabourPayrollPage";
import EmployeeLeavePage from "./EmployeeLeavePage";

interface HumanResourcesPageProps {
  activeCompany?: any;
  activeProject?: any;
  userRole?: string;
  isManager?: boolean;
  currentUser?: any;
  initialTab?: "payroll" | "leave";
}

export default function HumanResourcesPage({
  activeCompany: propActiveCompany,
  activeProject: propActiveProject,
  userRole: propUserRole,
  isManager: propIsManager,
  currentUser: propCurrentUser,
  initialTab = "payroll"
}: HumanResourcesPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const outletContext = useOutletContext<any>() || {};

  // Resolve context or props
  const activeCompany = propActiveCompany || outletContext.activeCompany;
  const activeProject = propActiveProject || outletContext.activeProject;
  const userRole = propUserRole || outletContext.profile?.role || "Member";
  const isManager = propIsManager !== undefined ? propIsManager : (userRole === "Director" || userRole === "Company Admin" || userRole === "Contracts Director" || userRole === "Commercial Manager");
  const currentUser = propCurrentUser || outletContext.profile;

  // Determine initial tab from query string or prop
  const tabParam = searchParams.get("tab");
  const [currentSubTab, setCurrentSubTab] = useState<"payroll" | "leave">(
    tabParam === "leave" ? "leave" : tabParam === "payroll" ? "payroll" : initialTab
  );

  // Sync tab with search params when query param changes
  useEffect(() => {
    const qTab = searchParams.get("tab");
    if (qTab === "leave" || qTab === "payroll") {
      setCurrentSubTab(qTab);
    }
  }, [searchParams]);

  const handleSubTabChange = (tab: "payroll" | "leave") => {
    setCurrentSubTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Top Level Human Resources Master Header & Tab Switcher */}
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-2xl border border-amber-500/20 text-amber-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
              Enterprise Workforce & Talent Management
            </span>
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              Human Resources
            </h1>
          </div>
        </div>

        {/* Subtab Navigation Pills */}
        <div className="flex items-center bg-slate-950/90 border border-slate-800 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => handleSubTabChange("payroll")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              currentSubTab === "payroll"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Employee Payroll</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("leave")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              currentSubTab === "leave"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Employee Leave</span>
          </button>
        </div>
      </div>

      {/* Subtab Content */}
      <div className="transition-all">
        {currentSubTab === "payroll" ? (
          <LabourPayrollPage
            activeCompany={activeCompany}
            activeProject={activeProject}
            userRole={userRole}
            isManager={isManager}
          />
        ) : (
          <EmployeeLeavePage
            activeCompany={activeCompany}
            activeProject={activeProject}
            userRole={userRole}
            isManager={isManager}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}
