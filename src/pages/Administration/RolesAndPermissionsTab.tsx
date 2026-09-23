import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Save, 
  UserCheck, 
  Sliders, 
  Layers, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  Lock, 
  Key, 
  ChevronRight, 
  ArrowRight,
  ShieldAlert,
  Info,
  Building2,
  FileCheck,
  User,
  Users,
  History
} from "lucide-react";
import { ROLE_OPTIONS, MasterRoleValue } from "../../config/roles";
import { 
  ModuleKey, 
  PermissionRule, 
  DEFAULT_ROLE_PERMISSIONS, 
  UserPermissionOverride, 
  MonetaryApprovalLimit, 
  SensitiveDataCategory,
  DEFAULT_ENGINEERING_REPORTING_HIERARCHY,
  ReportingNode
} from "../../services/rbacService";
import { 
  getAccessRequests, 
  reviewAccessRequest, 
  getAuditLogs, 
  exportAuditLogsToCsv, 
  logAuditEvent,
  AccessRequest,
  AuditLogEntry
} from "../../services/permissionService";
import { Download, FileSpreadsheet, Send } from "lucide-react";

const SYSTEM_MODULES: { key: ModuleKey; label: string; description: string }[] = [
  { key: "dashboard", label: "Executive Dashboard", description: "Portfolio KPIs, project health, and cross-site telemetry" },
  { key: "engineering", label: "Engineering & Technical", description: "Drawings, RFIs, technical submittals, method statements" },
  { key: "contracts", label: "Contracts & Governance", description: "NEC4/FIDIC notices, early warnings, compensation events, claims" },
  { key: "commercial", label: "Commercial & Cost Ledger", description: "Cost control, valuations, forecasts, variations, payments" },
  { key: "programme", label: "Programme & Schedule", description: "Critical path CPM, milestones, look-ahead schedules, delays" },
  { key: "boq", label: "Bill of Quantities (BoQ)", description: "Measurement, rates, item breakdowns, certified work" },
  { key: "procurement", label: "Procurement & Supply Chain", description: "Requisitions, RFQs, purchase orders, deliveries" },
  { key: "finance", label: "Finance & Accounts", description: "Budgets, cash flow, invoices, banking records" },
  { key: "quality", label: "Quality Assurance & ITPs", description: "Inspections, test plans, non-conformance reports (NCRs)" },
  { key: "hse", label: "Health, Safety & Environment", description: "Incident logs, risk assessments, safety audits, PPE" },
  { key: "documents", label: "Document Controller", description: "Transmittals, registers, revisions, document workflows" },
  { key: "site_diaries", label: "Site Operations & Diaries", description: "Daily site diaries, weather, plant, labour, progress" },
  { key: "administration", label: "System Administration", description: "Tenant profile, roles, security, user directory, audit" }
];

interface RolesAndPermissionsTabProps {
  companyPersonnel: any[];
  activeCompany: any;
  profile: any;
  hasManagerPermission: boolean;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
}

export default function RolesAndPermissionsTab({
  companyPersonnel,
  activeCompany,
  profile,
  hasManagerPermission,
  setSuccessMsg,
  setErrorMsg
}: RolesAndPermissionsTabProps) {
  // Sub-navigation tabs
  const [subTab, setSubTab] = useState<
    "matrix" | "requests" | "head_of_engineering" | "overrides" | "approvals" | "sensitive_data" | "reporting" | "audit"
  >("matrix");

  // Access requests & audit state
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>(() => getAccessRequests(activeCompany?.id));
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => getAuditLogs({ companyId: activeCompany?.id }));
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>("all");
  const [auditSearch, setAuditSearch] = useState<string>("");

  const refreshRequestsAndAudit = () => {
    setAccessRequests(getAccessRequests(activeCompany?.id));
    setAuditLogs(getAuditLogs({ companyId: activeCompany?.id }));
  };

  const pendingRequestsCount = accessRequests.filter(r => r.status === "pending").length;

  const handleReviewRequest = (requestId: string, status: "approved" | "rejected") => {
    if (!hasManagerPermission) {
      setErrorMsg("Access Denied: Only Company Administrators can review access requests.");
      return;
    }
    const success = reviewAccessRequest(
      requestId, 
      status, 
      { id: profile?.id || "admin", name: profile?.full_name || "Company Administrator", role: "Company Administrator" },
      status === "approved" ? "Approved by Administrator" : "Rejected per security policy"
    );
    if (success) {
      refreshRequestsAndAudit();
      // Reload user overrides
      const raw = previewStorage.getItem("pm_enterprise_user_overrides_v1");
      if (raw) {
        try {
          setUserOverrides(JSON.parse(raw));
        } catch (e) {}
      }
      setSuccessMsg(`Access request ${status.toUpperCase()} successfully.`);
    }
  };

  const handleExportAuditCsv = () => {
    assertOperationalAction("export", "pages/Administration/RolesAndPermissionsTab.tsx");
    const csvData = exportAuditLogsToCsv(activeCompany?.id);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ProjectMatrix_AuditLedger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMsg("Audit ledger exported to CSV successfully.");
  };

  // Selected role for matrix view
  const [selectedRole, setSelectedRole] = useState<string>("project_manager");

  // Custom permissions state
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<ModuleKey, PermissionRule>>>(() => {
    try {
      const saved = previewStorage.getItem("pm_custom_role_permissions_v2");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading role permissions:", e);
    }
    return DEFAULT_ROLE_PERMISSIONS;
  });

  // User overrides state
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride[]>(() => {
    try {
      const saved = previewStorage.getItem("pm_user_permission_overrides");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading user overrides:", e);
    }
    return [];
  });

  // Monetary approval limits state
  const [approvalLimits, setApprovalLimits] = useState<MonetaryApprovalLimit[]>(() => {
    try {
      const saved = previewStorage.getItem("pm_monetary_approval_limits");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading approval limits:", e);
    }
    return [];
  });

  // Engineering reporting structure
  const [reportingHierarchy, setReportingHierarchy] = useState<ReportingNode[]>(() => {
    try {
      const saved = previewStorage.getItem("pm_engineering_hierarchy");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading hierarchy:", e);
    }
    return DEFAULT_ENGINEERING_REPORTING_HIERARCHY;
  });

  // State for adding a new user override
  const [newOverrideUserId, setNewOverrideUserId] = useState<string>("");
  const [newOverrideModule, setNewOverrideModule] = useState<ModuleKey>("contracts");
  const [newOverridePermission, setNewOverridePermission] = useState<keyof PermissionRule>("approve");
  const [newOverrideAllowed, setNewOverrideAllowed] = useState<boolean>(true);
  const [newOverrideReason, setNewOverrideReason] = useState<string>("");

  // State for adding/editing approval limits
  const [newLimitTarget, setNewLimitTarget] = useState<string>("project_manager");
  const [newLimitModule, setNewLimitModule] = useState<"contracts" | "commercial" | "finance" | "procurement">("contracts");
  const [newLimitTier, setNewLimitTier] = useState<"create" | "review" | "approve" | "final_approve">("approve");
  const [newLimitAmount, setNewLimitAmount] = useState<number>(1000000);
  const [newLimitCurrency, setNewLimitCurrency] = useState<string>("ZAR");

  // Save full matrix
  const handleSaveMatrix = () => {
    assertOperationalAction("write", "pages/Administration/RolesAndPermissionsTab.tsx");
    if (!hasManagerPermission) {
      setErrorMsg("Access Denied: Only Company Administrators can save role permissions.");
      return;
    }
    previewStorage.setItem("pm_custom_role_permissions_v2", JSON.stringify(rolePermissions));
    logAuditEvent({
      companyId: activeCompany?.id || "org_default",
      userId: profile?.id || "admin",
      userName: profile?.full_name || "Admin",
      userRole: profile?.designation || "Company Administrator",
      action: "permission_change",
      category: "security",
      details: `Updated permissions matrix for role: ${selectedRole}`
    });
    setSuccessMsg("Role-Based Access Control (RBAC) matrix saved successfully.");
  };

  const handleTogglePermission = (roleVal: string, modKey: ModuleKey, permKey: keyof PermissionRule) => {
    if (!hasManagerPermission) return;
    setRolePermissions(prev => {
      const currentRoleObj = prev[roleVal] || DEFAULT_ROLE_PERMISSIONS[roleVal] || ({} as any);
      const currentModObj = currentRoleObj[modKey] || { view: false, create: false, edit: false, review: false, approve: false, admin: false };
      return {
        ...prev,
        [roleVal]: {
          ...currentRoleObj,
          [modKey]: {
            ...currentModObj,
            [permKey]: !currentModObj[permKey]
          }
        }
      };
    });
  };

  const handleAddOverride = (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Administration/RolesAndPermissionsTab.tsx");
    e.preventDefault();
    if (!newOverrideUserId) {
      setErrorMsg("Please select a target user for the override.");
      return;
    }

    const targetUser = companyPersonnel.find((p: any) => p.id === newOverrideUserId || p.profile_id === newOverrideUserId);
    const newOverride: UserPermissionOverride = {
      userId: newOverrideUserId,
      module: newOverrideModule,
      permission: newOverridePermission,
      allowed: newOverrideAllowed,
      grantedBy: profile?.full_name || "Company Admin",
      grantedAt: new Date().toISOString(),
      reason: newOverrideReason || "Administrative delegation"
    };

    // Filter out previous override on same module & permission if exists
    const updated = [
      ...userOverrides.filter(o => !(o.userId === newOverrideUserId && o.module === newOverrideModule && o.permission === newOverridePermission)),
      newOverride
    ];

    setUserOverrides(updated);
    previewStorage.setItem("pm_user_permission_overrides", JSON.stringify(updated));

    logAuditEvent({
      companyId: activeCompany?.id || "org_default",
      userId: profile?.id || "admin",
      userName: profile?.full_name || "Admin",
      userRole: profile?.designation || "Company Administrator",
      action: "security_override",
      category: "security",
      details: `Set override on user ${targetUser?.full_name || newOverrideUserId}: ${newOverrideModule}.${newOverridePermission} = ${newOverrideAllowed ? "ALLOWED" : "EXPLICIT_DENIAL"}`
    });

    setSuccessMsg(`User override established for ${targetUser?.full_name || "user"}.`);
    setNewOverrideReason("");
  };

  const handleRemoveOverride = (userId: string, modKey: ModuleKey, permKey: keyof PermissionRule) => {
    assertOperationalAction("delete", "pages/Administration/RolesAndPermissionsTab.tsx");
    const updated = userOverrides.filter(o => !(o.userId === userId && o.module === modKey && o.permission === permKey));
    setUserOverrides(updated);
    previewStorage.setItem("pm_user_permission_overrides", JSON.stringify(updated));
    setSuccessMsg("User override removed.");
  };

  const handleAddApprovalLimit = (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Administration/RolesAndPermissionsTab.tsx");
    e.preventDefault();
    const newLimit: MonetaryApprovalLimit = {
      userIdOrRole: newLimitTarget,
      maxAmount: Number(newLimitAmount),
      currency: newLimitCurrency,
      module: newLimitModule,
      tier: newLimitTier
    };

    const updated = [
      ...approvalLimits.filter(l => !(l.userIdOrRole === newLimitTarget && l.module === newLimitModule && l.tier === newLimitTier)),
      newLimit
    ];

    setApprovalLimits(updated);
    previewStorage.setItem("pm_monetary_approval_limits", JSON.stringify(updated));
    logAuditEvent({
      companyId: activeCompany?.id || "org_default",
      userId: profile?.id || "admin",
      userName: profile?.full_name || "Admin",
      userRole: profile?.designation || "Company Administrator",
      action: "permission_change",
      category: "commercial",
      details: `Set approval limit for ${newLimitTarget}: ${newLimitAmount} ${newLimitCurrency} on ${newLimitModule}`
    });
    setSuccessMsg("Approval authority and monetary limit configured.");
  };

  const handleRemoveLimit = (target: string, mod: string, tier: string) => {
    assertOperationalAction("delete", "pages/Administration/RolesAndPermissionsTab.tsx");
    const updated = approvalLimits.filter(l => !(l.userIdOrRole === target && l.module === mod && l.tier === tier));
    setApprovalLimits(updated);
    previewStorage.setItem("pm_monetary_approval_limits", JSON.stringify(updated));
    setSuccessMsg("Approval limit rule removed.");
  };

  return (
    <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#FF9F1C]" />
            <h3 className="text-base font-extrabold text-[#07182E] tracking-tight">
              Enterprise Access Control & Authority Matrix
            </h3>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Centralized RBAC architecture: <code>Organisation → User → Role → Department → Project → Module → Override → Approval Authority</code>
          </p>
        </div>

        {subTab === "matrix" && (
          <button
            onClick={handleSaveMatrix}
            disabled={!hasManagerPermission}
            className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Save Permissions Matrix
          </button>
        )}
      </div>

      {/* Sub-Navigation Pills */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto no-scrollbar">
        {[
          { id: "matrix", label: "RBAC Matrix (47 Roles)", icon: ShieldCheck },
          { id: "requests", label: `Access Requests ${pendingRequestsCount > 0 ? `(${pendingRequestsCount})` : ""}`, icon: Send, badge: pendingRequestsCount > 0 },
          { id: "head_of_engineering", label: "Head of Engineering Rules", icon: Key },
          { id: "overrides", label: "User Overrides", icon: Sliders },
          { id: "approvals", label: "Approval Authority & Limits", icon: DollarSign },
          { id: "sensitive_data", label: "Sensitive Data Separation", icon: Lock },
          { id: "reporting", label: "Engineering Hierarchy", icon: Layers },
          { id: "audit", label: "Immutable Audit Ledger", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-[#102846] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 1. RBAC PERMISSIONS MATRIX (7 LEVELS)                     */}
      {/* ========================================================= */}
      {subTab === "matrix" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          {/* Roles Selector Sidebar */}
          <div className="space-y-1.5 border-r border-slate-100 pr-4 max-h-[560px] overflow-y-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              System & Corporate Roles ({ROLE_OPTIONS.length})
            </span>
            {ROLE_OPTIONS.map((r) => {
              const isSelected = selectedRole === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => setSelectedRole(r.value)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-[#FF9F1C] text-white shadow-sm"
                      : "text-[#07182E] hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate">{r.label}</span>
                  <span className={`text-[9px] uppercase shrink-0 ${isSelected ? "text-amber-100" : "text-slate-400"}`}>
                    {r.group.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Granular Module Matrix Table */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Selected Target Role</span>
                <h4 className="text-base font-extrabold text-[#07182E]">
                  {ROLE_OPTIONS.find((r) => r.value === selectedRole)?.label}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Category: <span className="font-semibold text-[#07182E]">{ROLE_OPTIONS.find((r) => r.value === selectedRole)?.group}</span>
                </p>
              </div>

              {selectedRole === "head_of_engineering" && (
                <span className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#FF9F1C]" /> Special Dual Governance Rule Active
                </span>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[#07182E] font-extrabold text-[10px] uppercase tracking-wider border-b border-slate-200">
                    <th className="p-3">ERP Module & Scope</th>
                    <th className="p-3 text-center">View</th>
                    <th className="p-3 text-center">Create</th>
                    <th className="p-3 text-center">Edit</th>
                    <th className="p-3 text-center">Review</th>
                    <th className="p-3 text-center">Approve</th>
                    <th className="p-3 text-center">Administer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {SYSTEM_MODULES.map((mod) => {
                    const currentPerms = rolePermissions[selectedRole]?.[mod.key] || 
                      DEFAULT_ROLE_PERMISSIONS[selectedRole]?.[mod.key] || {
                        view: false, create: false, edit: false, review: false, approve: false, admin: false
                      };

                    return (
                      <tr key={mod.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-[#07182E] text-xs">{mod.label}</div>
                          <div className="text-[10px] text-slate-400 font-medium line-clamp-1">{mod.description}</div>
                        </td>
                        {(["view", "create", "edit", "review", "approve", "admin"] as (keyof PermissionRule)[]).map((perm) => (
                          <td key={perm} className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={!!currentPerms[perm]}
                              disabled={!hasManagerPermission}
                              onChange={() => handleTogglePermission(selectedRole, mod.key, perm)}
                              className="w-4 h-4 rounded text-[#FF9F1C] accent-[#FF9F1C] cursor-pointer disabled:opacity-40"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. HEAD OF ENGINEERING SPECIAL INHERITANCE RULES          */}
      {/* ========================================================= */}
      {subTab === "head_of_engineering" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-5 bg-gradient-to-r from-[#102846] to-[#1e467a] text-white rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-[#FF9F1C]" />
              <h4 className="text-base font-extrabold tracking-tight">
                Special System Role Specification: Head of Engineering
              </h4>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed max-w-4xl">
              The <strong>Head of Engineering</strong> combines full engineering authority with contract management capabilities. 
              Under central governance, this role <strong>inherits Contracts Manager contractual access</strong> and extends it with 
              <strong>Company-Wide Engineering Authority</strong> across all active tenant projects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Extended & Inherited Permissions */}
            <div className="p-5 border border-emerald-200 bg-emerald-50/40 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Authorized Extended Engineering & Contracts Scope
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <strong>engineering.company_view</strong> — Company-wide technical visibility across all projects
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <strong>engineering.create / edit / review / approve / admin</strong> — Full technical execution authority
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <strong>contracts.view / create / edit / review</strong> — Contractual agreement and record oversight
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <strong>claims & variations</strong> — Technical review of variation instructions and EOT claims
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <strong>early_warnings & compensation_events</strong> — Notification and assessment workflows
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <strong>quality & ITP sign-off</strong> — Final technical approval of engineering test records
                </li>
              </ul>
            </div>

            {/* Explicitly Restricted Sensitive Actions */}
            <div className="p-5 border border-rose-200 bg-rose-50/40 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                <XCircle className="w-4 h-4 text-rose-600" />
                Explicit Sensitive Restrictions (Segregation of Duties)
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <strong>Banking Administration & Execution</strong> — Restricted to Owner & authorized Finance
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <strong>Payroll Records & Salary Data</strong> — Restricted to HR & Executive Finance
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <strong>Confidential Personnel HR Records</strong> — Restricted to HR Directorate
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <strong>Tax / VAT Statutory Administration</strong> — Restricted to Company Admin & CFO
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <strong>User Security & Tenant Administration</strong> — Restricted to Company Administrators
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. USER PERMISSION OVERRIDES                              */}
      {/* ========================================================= */}
      {subTab === "overrides" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Add Override Form */}
          <div className="bg-slate-50 p-5 border border-slate-200 rounded-2xl space-y-4 h-fit">
            <h4 className="text-xs font-black text-[#07182E] uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#FF9F1C]" /> Add User Override
            </h4>
            <p className="text-[11px] text-slate-500">
              User overrides take final precedence in the evaluation pipeline. Setting an override to <strong>Deny</strong> establishes an explicit refusal.
            </p>

            <form onSubmit={handleAddOverride} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Personnel</label>
                <select
                  value={newOverrideUserId}
                  onChange={(e) => setNewOverrideUserId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                >
                  <option value="">-- Select Personnel Member --</option>
                  {companyPersonnel?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Module</label>
                  <select
                    value={newOverrideModule}
                    onChange={(e) => setNewOverrideModule(e.target.value as ModuleKey)}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                  >
                    {SYSTEM_MODULES.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Permission</label>
                  <select
                    value={newOverridePermission}
                    onChange={(e) => setNewOverridePermission(e.target.value as any)}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                  >
                    <option value="view">View</option>
                    <option value="create">Create</option>
                    <option value="edit">Edit</option>
                    <option value="review">Review</option>
                    <option value="approve">Approve</option>
                    <option value="admin">Administer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Override Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewOverrideAllowed(true)}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      newOverrideAllowed
                        ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    Grant Access
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewOverrideAllowed(false)}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      !newOverrideAllowed
                        ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    Explicit Denial
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reason / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Lead structural signatory on Bridge package"
                  value={newOverrideReason}
                  onChange={(e) => setNewOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:border-[#FF9F1C] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!hasManagerPermission}
                className="w-full py-2.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                Apply User Override
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Active Overrides Table */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-black text-[#07182E] uppercase tracking-wider">
              Active User Permission Overrides ({userOverrides.length})
            </h4>

            {userOverrides.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[#07182E] font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                      <th className="p-3">User</th>
                      <th className="p-3">Module</th>
                      <th className="p-3">Permission</th>
                      <th className="p-3 text-center">Effect</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-medium">
                    {userOverrides.map((o, idx) => {
                      const user = companyPersonnel.find((p: any) => p.id === o.userId || p.profile_id === o.userId);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-bold text-[#07182E]">{user?.full_name || o.userId}</td>
                          <td className="p-3 text-slate-700 capitalize font-mono text-[11px]">{o.module}</td>
                          <td className="p-3 text-slate-700 capitalize font-bold text-[11px]">{o.permission}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                              o.allowed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {o.allowed ? "Granted" : "Denied"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px] truncate max-w-[140px]">{o.reason || "N/A"}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRemoveOverride(o.userId, o.module, o.permission)}
                              className="text-red-500 hover:text-red-600 font-semibold p-1 cursor-pointer"
                              title="Delete Override"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                No individual user overrides configured. Permissions strictly follow baseline role matrix.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. APPROVAL AUTHORITY & MONETARY LIMITS                   */}
      {/* ========================================================= */}
      {subTab === "approvals" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Form to configure Approval Limits */}
          <div className="bg-slate-50 p-5 border border-slate-200 rounded-2xl space-y-4 h-fit">
            <h4 className="text-xs font-black text-[#07182E] uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#FF9F1C]" /> Configure Delegated Limit
            </h4>
            <p className="text-[11px] text-slate-500">
              Access alone does not confer approval authority. Set currency expenditure caps per role or user across commercial and finance workflows.
            </p>

            <form onSubmit={handleAddApprovalLimit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Role / User</label>
                <select
                  value={newLimitTarget}
                  onChange={(e) => setNewLimitTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                >
                  <optgroup label="System Roles">
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Specific Personnel">
                    {companyPersonnel?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Module</label>
                  <select
                    value={newLimitModule}
                    onChange={(e) => setNewLimitModule(e.target.value as any)}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                  >
                    <option value="contracts">Contracts (Variations/Claims)</option>
                    <option value="commercial">Commercial (Valuations/Certificates)</option>
                    <option value="procurement">Procurement (POs/Requisitions)</option>
                    <option value="finance">Finance (Payment Authorizations)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Authority Tier</label>
                  <select
                    value={newLimitTier}
                    onChange={(e) => setNewLimitTier(e.target.value as any)}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                  >
                    <option value="create">1. Create</option>
                    <option value="review">2. Review</option>
                    <option value="approve">3. Approve</option>
                    <option value="final_approve">4. Final Approve</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max Amount</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newLimitAmount}
                    onChange={(e) => setNewLimitAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Currency</label>
                  <select
                    value={newLimitCurrency}
                    onChange={(e) => setNewLimitCurrency(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:border-[#FF9F1C] outline-none cursor-pointer"
                  >
                    <option value="ZAR">ZAR (R)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!hasManagerPermission}
                className="w-full py-2.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                Set Approval Authority Limit
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Active Monetary Limits Table */}
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <h4 className="text-xs font-black text-[#07182E] uppercase tracking-wider">
              Delegated Monetary Limits & Authority Tiers ({approvalLimits.length})
            </h4>

            {approvalLimits.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 bg-slate-50/50">
                <Sliders className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="font-bold text-slate-600">No delegated monetary limits configured.</div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Use the &quot;Add Approval Limit Rule&quot; form to set financial approval ceilings.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-100 text-[#07182E] font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                      <th className="p-3">Target Role / User</th>
                      <th className="p-3">Domain</th>
                      <th className="p-3 text-center">Tier</th>
                      <th className="p-3 text-right">Max Authorized Limit</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-medium">
                    {approvalLimits.map((l, idx) => {
                      const roleMatch = ROLE_OPTIONS.find((r) => r.value === l.userIdOrRole);
                      const userMatch = companyPersonnel.find((p: any) => p.id === l.userIdOrRole);
                      const displayName = roleMatch?.label || userMatch?.full_name || l.userIdOrRole;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-bold text-[#07182E] truncate max-w-[160px]">{displayName}</td>
                          <td className="p-3 text-slate-700 capitalize font-mono text-[11px]">{l.module}</td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[9px] uppercase">
                              {l.tier.replace("_", " ")}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-[#07182E] whitespace-nowrap">
                            {l.currency} {l.maxAmount.toLocaleString()}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleRemoveLimit(l.userIdOrRole, l.module, l.tier)}
                              className="text-red-500 hover:text-red-600 font-semibold p-1 cursor-pointer"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SENSITIVE DATA RESTRICTIONS MATRIX                     */}
      {/* ========================================================= */}
      {subTab === "sensitive_data" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3">
            <h4 className="text-sm font-extrabold text-[#07182E] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#FF9F1C]" /> Sensitive Data & Segregation of Duties Matrix
            </h4>
            <p className="text-xs text-slate-500">
              The following categories require explicit authorization and are strictly segregated from general operational access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: "1. Banking & Account Records",
                access: "Organisation Owner + Authorised Finance users only",
                notes: "Bank accounts, SWIFT/IBAN details, electronic payment batch execution, beneficiary modifications.",
                badge: "Strictly Restricted"
              },
              {
                title: "2. Payroll & Remuneration",
                access: "Authorised HR, Finance Directorate & Executives",
                notes: "Individual salary structures, wage rates, deductions, tax contributions, and personal pay-slips.",
                badge: "Strictly Restricted"
              },
              {
                title: "3. Statutory Tax & VAT Records",
                access: "Company Administrator + Finance + CFO",
                notes: "Company tax returns, VAT ledgers, withholding tax filings, SARS PIN clearance management.",
                badge: "High Security"
              },
              {
                title: "4. Confidential Personnel Data",
                access: "Authorised HR & Administration only",
                notes: "National identity records, disciplinary histories, medical fitness certificates, background checks.",
                badge: "Strictly Restricted"
              },
              {
                title: "5. Tender & Commercial Pricing",
                access: "Commercial + Contracts + Head of Eng + Directors",
                notes: "Tender build-up markups, confidential overhead allowances, subcontractor margin matrices.",
                badge: "Protected"
              },
              {
                title: "6. Security & Permission Admin",
                access: "Organisation Owner + Authorised Company Admins",
                notes: "Tenant isolation keys, RBAC override matrices, 2FA policies, user activation & suspensions.",
                badge: "Admin Enforced"
              }
            ].map((cat, idx) => (
              <div key={idx} className="p-4 border border-slate-200 rounded-xl space-y-2 bg-slate-50/50 hover:bg-white hover:border-[#FF9F1C]/40 transition-all">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-[#07182E] text-xs">{cat.title}</h5>
                  <span className="px-2 py-0.5 bg-amber-100 text-[#FF9F1C] rounded text-[9px] font-bold uppercase">
                    {cat.badge}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                  Authorized: {cat.access}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{cat.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. ENGINEERING REPORTING STRUCTURE                        */}
      {/* ========================================================= */}
      {subTab === "reporting" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="border border-slate-200 rounded-2xl p-5 bg-white flex items-center justify-between">
            <div>
              <h4 className="text-sm font-extrabold text-[#07182E] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#FF9F1C]" /> Configurable Engineering Technical Hierarchy
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard reporting flow: <code>Executive/COO → Head of Engineering → PM/Engineering Manager → Senior Engineer → Site Engineer → Technician/Surveyor</code>
              </p>
            </div>
            <button
              onClick={() => {
                previewStorage.setItem("pm_engineering_hierarchy", JSON.stringify(reportingHierarchy));
                setSuccessMsg("Engineering reporting structure synchronized.");
              }}
              className="px-3.5 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              Save Hierarchy Structure
            </button>
          </div>

          <div className="space-y-3 max-w-2xl mx-auto py-4">
            {reportingHierarchy.map((node, index) => (
              <div key={node.id} className="relative">
                {index > 0 && (
                  <div className="w-0.5 h-6 bg-slate-300 mx-auto my-0.5" />
                )}
                <div className="p-4 bg-white border-2 border-slate-200 hover:border-[#FF9F1C] rounded-2xl shadow-xs flex items-center justify-between gap-4 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#102846] text-white flex items-center justify-center font-bold text-xs">
                      {index + 1}
                    </div>
                    <div>
                      <h5 className="font-extrabold text-[#07182E] text-xs">{node.title}</h5>
                      <p className="text-[10px] text-slate-400">{node.description}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    Tier {index + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. ACCESS REQUESTS QUEUE                                 */}
      {/* ========================================================= */}
      {subTab === "requests" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="border border-slate-200 rounded-2xl p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-[#07182E] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#FF9F1C]" /> User Access Requests Queue
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and approve on-demand permission requests submitted by project team members.
              </p>
            </div>
            <button
              onClick={refreshRequestsAndAudit}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Refresh Queue
            </button>
          </div>

          {accessRequests.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h5 className="text-sm font-bold text-slate-700">No Access Requests Pending</h5>
              <p className="text-xs text-slate-400 mt-1">All user permission requests have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accessRequests.map((req) => {
                const isPending = req.status === "pending";
                const isApproved = req.status === "approved";

                return (
                  <div
                    key={req.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPending
                        ? "bg-amber-50/40 border-amber-200 shadow-xs"
                        : isApproved
                        ? "bg-emerald-50/30 border-emerald-200/80 opacity-80"
                        : "bg-rose-50/30 border-rose-200/80 opacity-70"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900">{req.userName}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 font-semibold rounded">
                            {req.userRole}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(req.requestedAt).toLocaleString()}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isPending
                                ? "bg-amber-500 text-slate-950 font-bold"
                                : isApproved
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-600 text-white"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>

                        <div className="text-xs font-mono bg-white/80 p-2 rounded-xl border border-slate-200 text-slate-800 flex items-center gap-2">
                          <span className="text-slate-400 font-sans font-bold">Target Permission:</span>
                          <span className="text-amber-600 font-bold">{req.requestedPermission}</span>
                          {req.projectId && (
                            <span className="text-slate-500 text-[11px] ml-auto">
                              Project: {req.projectId}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 bg-white/60 p-2.5 rounded-xl border border-slate-200/80 italic">
                          "{req.justification}"
                        </div>

                        {req.reviewedBy && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Reviewed by {req.reviewedBy} on {new Date(req.reviewedAt || "").toLocaleString()}
                          </div>
                        )}
                      </div>

                      {isPending && (
                        <div className="flex sm:flex-col items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleReviewRequest(req.id, "approved")}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer w-full justify-center"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewRequest(req.id, "rejected")}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer w-full justify-center"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. IMMUTABLE AUDIT LEDGER                                 */}
      {/* ========================================================= */}
      {subTab === "audit" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="border border-slate-200 rounded-2xl p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-extrabold text-[#07182E] flex items-center gap-2">
                <History className="w-4 h-4 text-[#FF9F1C]" /> Immutable Corporate Audit Ledger
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Tamper-evident system activity log recording authentication, role changes, overrides, approvals, and security events.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAuditCsv}
                className="px-4 py-2 bg-[#102846] hover:bg-[#15345a] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Export Audit Log (CSV)
              </button>
            </div>
          </div>

          {/* Search and Category Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              placeholder="Search user, action, role, details..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
            />
            <div className="flex items-center gap-1.5 overflow-x-auto w-full">
              {["all", "security", "commercial", "contracts", "hr", "auth", "system"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAuditCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${
                    auditCategoryFilter === cat
                      ? "bg-[#102846] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold text-[10px] border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User & Role</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {auditLogs
                    .filter((log) => {
                      if (auditCategoryFilter !== "all" && log.category !== auditCategoryFilter) return false;
                      if (auditSearch) {
                        const q = auditSearch.toLowerCase();
                        return (
                          log.userName.toLowerCase().includes(q) ||
                          log.userRole.toLowerCase().includes(q) ||
                          log.action.toLowerCase().includes(q) ||
                          (log.details || "").toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .slice(0, 100)
                    .map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{log.userName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{log.userRole}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono font-bold text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/60 rounded font-bold text-[9px] uppercase">
                            {log.category}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 leading-relaxed text-[11px]">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
