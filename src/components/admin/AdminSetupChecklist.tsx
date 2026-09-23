import React, { useState } from "react";
import { 
  CheckCircle2, 
  Circle, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  ArrowRight,
  Shield,
  Building2,
  Users,
  FolderGit2,
  DollarSign,
  Layers,
  Sliders,
  FileCheck
} from "lucide-react";

interface AdminSetupChecklistProps {
  tenantId?: string;
  hasLogo?: boolean;
  hasProjects?: boolean;
  hasInvitedEmployees?: boolean;
  onNavigateToTab?: (tabId: string) => void;
}

export interface SetupChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  actionTab?: string;
  actionText?: string;
}

export default function AdminSetupChecklist({
  tenantId,
  hasLogo = false,
  hasProjects = true,
  hasInvitedEmployees = true,
  onNavigateToTab
}: AdminSetupChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [customCompletedMap, setCustomCompletedMap] = useState<Record<string, boolean>>({
    company_profile: true,
    departments_configured: true,
    contract_frameworks: true,
    currency_configured: true,
    approval_workflows: true,
    security_settings: true
  });

  const checklist: SetupChecklistItem[] = [
    {
      id: "company_profile",
      label: "Company profile completed",
      description: "Legal entity, registration numbers, tax data and registered physical addresses recorded.",
      completed: true,
      actionTab: "overview",
      actionText: "View Profile"
    },
    {
      id: "company_logo",
      label: "Company logo uploaded",
      description: "Upload your corporate emblem for project headers and formal contract notices.",
      completed: hasLogo || !!customCompletedMap["company_logo"],
      actionTab: "branding",
      actionText: "Upload Logo"
    },
    {
      id: "departments_configured",
      label: "Departments configured",
      description: "Organisational structure and operational divisions provisioned.",
      completed: customCompletedMap["departments_configured"],
      actionTab: "departments",
      actionText: "Manage Depts"
    },
    {
      id: "contract_frameworks",
      label: "Contract frameworks selected",
      description: "Standard forms (FIDIC, NEC4, GCC, JBCC) enabled for contract creation.",
      completed: customCompletedMap["contract_frameworks"],
      actionTab: "contracts",
      actionText: "View Contracts"
    },
    {
      id: "currency_configured",
      label: "Default currency configured",
      description: "Central baseline currency, timezone, and fiscal calendar year locked.",
      completed: customCompletedMap["currency_configured"],
      actionTab: "settings",
      actionText: "View Defaults"
    },
    {
      id: "first_project",
      label: "First project created",
      description: "Provision the initial civil engineering contract or infrastructure worksite.",
      completed: hasProjects || !!customCompletedMap["first_project"],
      actionTab: "projects",
      actionText: "Create Project"
    },
    {
      id: "employees_invited",
      label: "Employees invited",
      description: "Issue 72-hour secure token invitations to project and commercial personnel.",
      completed: hasInvitedEmployees || !!customCompletedMap["employees_invited"],
      actionTab: "users",
      actionText: "Invite Team"
    },
    {
      id: "project_roles_assigned",
      label: "Project roles assigned",
      description: "Assign key site agents, contract managers, and quantity surveyors to project matrices.",
      completed: hasProjects && hasInvitedEmployees,
      actionTab: "users",
      actionText: "Assign Roles"
    },
    {
      id: "approval_workflows",
      label: "Approval workflows configured",
      description: "Monetary limits and multi-tier sign-off thresholds established.",
      completed: customCompletedMap["approval_workflows"],
      actionTab: "governance",
      actionText: "Configure Limits"
    },
    {
      id: "security_settings",
      label: "Security settings reviewed",
      description: "Audit logging, tenant isolation verification, and session timeout policies confirmed.",
      completed: customCompletedMap["security_settings"],
      actionTab: "security",
      actionText: "Review Security"
    }
  ];

  const completedCount = checklist.filter(c => c.completed).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  const toggleCustomItem = (id: string) => {
    setCustomCompletedMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-tight">
                First-Run Administration Checklist
              </h3>
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-mono font-bold">
                {completedCount} / {checklist.length} Completed ({progressPercent}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Recommended operational setup sequence for your new Project Matrix tenant.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title={isCollapsed ? "Expand Checklist" : "Collapse Checklist"}
        >
          {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
        <div 
          className="bg-gradient-to-r from-amber-500 to-amber-600 h-full transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist Items */}
      {!isCollapsed && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 border-t border-slate-850 text-xs">
          {checklist.map(item => (
            <div
              key={item.id}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                item.completed
                  ? "bg-slate-950/40 border-slate-850/80 text-slate-300"
                  : "bg-slate-950/80 border-amber-500/30 text-white shadow-sm"
              }`}
            >
              <div 
                className="flex items-start gap-2.5 cursor-pointer flex-1"
                onClick={() => toggleCustomItem(item.id)}
              >
                {item.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-amber-500/80 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className={`font-bold leading-tight ${item.completed ? "line-through text-slate-400" : "text-white"}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    {item.description}
                  </div>
                </div>
              </div>

              {item.actionTab && onNavigateToTab && !item.completed && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab(item.actionTab!)}
                  className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all shrink-0 flex items-center gap-1"
                >
                  <span>{item.actionText}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
