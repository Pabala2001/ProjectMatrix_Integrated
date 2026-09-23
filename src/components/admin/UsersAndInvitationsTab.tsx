import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Building2, 
  FolderGit2, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2, 
  MoreVertical, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight,
  ExternalLink,
  Edit,
  Ban,
  Lock,
  Sparkles
} from "lucide-react";
import { 
  getInvitationsByTenant, 
  resendInvitation, 
  revokeInvitation, 
  EmployeeInvitation 
} from "../../services/invitationService";
import { CompanyTenant } from "../../services/tenantService";
import InviteEmployeeModal from "./InviteEmployeeModal";
import SystemAdminSuccessionModal from "./SystemAdminSuccessionModal";
import { logAuditEvent } from "../../services/rbacService";

interface PersonnelRecord {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  designation?: string;
  department?: string;
  employee_number?: string;
  role?: string;
  is_company_admin?: boolean;
  status?: string;
  created_at?: string;
  last_login?: string;
  project_count?: number;
}

interface ProjectRecord {
  id: string;
  name: string;
  code: string;
}

interface UsersAndInvitationsTabProps {
  tenant: CompanyTenant;
  currentUserId: string;
  currentUserName: string;
  isSystemAdmin: boolean;
  personnelList: PersonnelRecord[];
  projectList: ProjectRecord[];
  onRefreshPersonnel: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export default function UsersAndInvitationsTab({
  tenant,
  currentUserId,
  currentUserName,
  isSystemAdmin,
  personnelList,
  projectList,
  onRefreshPersonnel,
  onNavigateToTab
}: UsersAndInvitationsTabProps) {
  // Modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [isSuccessionModalOpen, setIsSuccessionModalOpen] = useState<boolean>(false);
  
  // Invitations State
  const [invitations, setInvitations] = useState<EmployeeInvitation[]>([]);
  const [invitationFilter, setInvitationFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  
  // Notification / Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Edit / Status Modal states for existing personnel
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelRecord | null>(null);
  const [editRoleModalOpen, setEditRoleModalOpen] = useState<boolean>(false);
  const [newRoleInput, setNewRoleInput] = useState<string>("");

  useEffect(() => {
    loadInvitations();
  }, [tenant.tenant_id, tenant.id]);

  const loadInvitations = () => {
    const list = getInvitationsByTenant(tenant.tenant_id || tenant.id);
    setInvitations(list);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Resend invitation handler
  const handleResend = async (invId: string) => {
    try {
      await resendInvitation(invId, currentUserId, currentUserName);
      loadInvitations();
      showToast("Invitation resent with refreshed 72-hour security token.");
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Revoke invitation handler
  const handleRevoke = async (invId: string) => {
    if (!window.confirm("Are you sure you want to revoke this pending employee invitation?")) return;
    try {
      await revokeInvitation(invId, currentUserId, currentUserName);
      loadInvitations();
      showToast("Invitation has been revoked.");
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Copy invitation link
  const handleCopyLink = (token: string, id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/join?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedTokenId(id);
    showToast("Invitation link copied to clipboard.");
    setTimeout(() => setCopiedTokenId(null), 3000);
  };

  // Calculate remaining hours
  const getRemainingHours = (expiresAt: string): string => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h left`;
    }
    return `${hours}h left`;
  };

  // Filtered personnel
  const filteredPersonnel = personnelList.filter(p => {
    const matchesSearch = 
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === "all" || p.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  // Filtered invitations
  const filteredInvitations = invitations.filter(inv => {
    if (invitationFilter === "pending") return inv.status === "Pending";
    if (invitationFilter === "accepted") return inv.status === "Accepted";
    if (invitationFilter === "expired") return inv.status === "Expired";
    if (invitationFilter === "revoked") return inv.status === "Revoked";
    return true;
  });

  const allDepts = Array.from(new Set(personnelList.map(p => p.department).filter(Boolean)));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 border border-amber-500/50 text-white rounded-2xl shadow-2xl flex items-center gap-3 text-xs animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-extrabold text-white tracking-tight uppercase">
              Users & Invitations Architecture
            </h2>
            <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold font-mono">
              Tenant: {tenant.tenant_id}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage company personnel, issue secure 72-hour token invitations, and administer role assignments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Employee</span>
          </button>
        </div>
      </div>

      {/* Security Distinction Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* System Administrator Card */}
        <div className="p-4 bg-slate-950/70 border border-amber-500/30 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>System Administrator</span>
            </div>
            <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider rounded">
              Tenant Root Owner
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Full platform-level administration across all company configuration, multi-tenant isolation, user provisioning, security policies, and audit trails. Currently assigned to <strong>{tenant.system_admin_name}</strong> ({tenant.system_admin_email}).
          </p>
          
          {isSystemAdmin && (
            <div className="pt-2 border-t border-slate-850/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Succession & Ownership Management:</span>
              <button
                type="button"
                onClick={() => setIsSuccessionModalOpen(true)}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                Transfer Authority →
              </button>
            </div>
          )}
        </div>

        {/* Company Administrator Card */}
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Company Administrator</span>
            </div>
            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-[9px] uppercase tracking-wider rounded">
              Operational Manager
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Administrative control within the company's daily operational domain: user profiles, project assignments, workflow authorizations, and department administration. Does not include root tenant succession.
          </p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: PENDING & HISTORIC EMPLOYEE INVITATIONS        */}
      {/* ========================================================= */}
      <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-500" />
              Employee Invitations ({invitations.length})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Secure token-based links with automatic 72-hour expiration window.
            </p>
          </div>

          {/* Invitation Status Filters */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-850 text-[11px]">
            {["all", "pending", "accepted", "expired", "revoked"].map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setInvitationFilter(f)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all ${
                  invitationFilter === f
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Invitations Table */}
        <div className="overflow-x-auto">
          {filteredInvitations.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-3 px-3">Recipient</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Proposed Role</th>
                  <th className="py-3 px-3">Project Access</th>
                  <th className="py-3 px-3">Invited By</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Expires In</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredInvitations.map(inv => {
                  const isPending = inv.status === "Pending";
                  const isAccepted = inv.status === "Accepted";
                  const isExpired = inv.status === "Expired";
                  const isRevoked = inv.status === "Revoked";

                  return (
                    <tr key={inv.id} className="hover:bg-slate-950/40 transition-colors">
                      {/* Recipient */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white leading-tight">
                          {inv.first_name} {inv.last_name}
                        </div>
                        <div className="text-[11px] text-slate-400">{inv.email}</div>
                        {inv.employee_number && (
                          <div className="text-[9px] font-mono text-slate-500">ID: {inv.employee_number}</div>
                        )}
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {inv.department}
                      </td>

                      {/* Proposed Role */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[10px] font-bold">
                          {inv.system_role_name}
                        </span>
                      </td>

                      {/* Projects */}
                      <td className="py-3 px-3 text-slate-400">
                        {inv.project_access_type === "all" ? (
                          <span className="text-amber-400 text-[10px] font-bold">All Projects</span>
                        ) : inv.project_assignments?.length > 0 ? (
                          <span className="text-slate-300 font-medium">
                            {inv.project_assignments.length} Projects
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">None assigned</span>
                        )}
                      </td>

                      {/* Invited By */}
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {inv.created_by_name}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isPending && (
                          <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        {isAccepted && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Accepted
                          </span>
                        )}
                        {isExpired && (
                          <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-[10px] font-bold w-fit block">
                            Expired
                          </span>
                        )}
                        {isRevoked && (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-500 rounded-full text-[10px] font-bold w-fit block">
                            Revoked
                          </span>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {isPending ? getRemainingHours(inv.expires_at) : "—"}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopyLink(inv.secure_token, inv.id)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition-all"
                                title="Copy Invitation Link"
                              >
                                {copiedTokenId === inv.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleResend(inv.id)}
                                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition-all"
                                title="Resend / Refresh 72h Token"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRevoke(inv.id)}
                                className="p-1.5 bg-slate-950 hover:bg-red-500/10 border border-slate-800 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                                title="Revoke Invitation"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {(isExpired || isRevoked) && (
                            <button
                              type="button"
                              onClick={() => handleResend(inv.id)}
                              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Re-invite</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-850/60 rounded-xl text-xs text-slate-500 space-y-2">
              <Mail className="w-6 h-6 mx-auto text-slate-600" />
              <p>No invitations found under the "{invitationFilter}" filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: ACTIVE COMPANY PERSONNEL DIRECTORY             */}
      {/* ========================================================= */}
      <div className="bg-slate-900/90 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              Active Company Personnel ({filteredPersonnel.length})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Enrolled members linked to tenant <code className="text-slate-300">{tenant.tenant_id}</code>.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search personnel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 w-44 sm:w-56"
              />
            </div>

            {allDepts.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Departments</option>
                {allDepts.map((d, idx) => (
                  <option key={`${d}-${idx}`} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          {filteredPersonnel.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Corporate Role</th>
                  <th className="py-3 px-3">Project Roles</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredPersonnel.map(p => {
                  const isSysAdmin = p.id === tenant.system_admin_user_id || p.email === tenant.system_admin_email;
                  const isCurrent = p.id === currentUserId;

                  return (
                    <tr key={p.id} className="hover:bg-slate-950/40 transition-colors">
                      {/* Employee Info */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isSysAdmin 
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                              : "bg-slate-950 text-slate-300 border border-slate-800"
                          }`}>
                            {p.full_name?.split(" ").map(n => n[0]).join("") || "U"}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{p.full_name}</span>
                              {isSysAdmin && (
                                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[9px] font-black rounded uppercase">
                                  System Admin
                                </span>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] text-slate-500 font-mono">(You)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{p.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {p.department || "General"}
                      </td>

                      {/* Corporate Role */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isSysAdmin
                            ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                            : p.is_company_admin
                            ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                            : "bg-slate-950 border border-slate-800 text-slate-300"
                        }`}>
                          {p.designation || p.role || "Member"}
                        </span>
                      </td>

                      {/* Project Roles */}
                      <td className="py-3 px-3 text-slate-400">
                        <span className="text-xs text-slate-300 font-semibold">
                          {p.project_count || 1} Project Assignment{(p.project_count || 1) > 1 ? "s" : ""}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPersonnel(p);
                              setNewRoleInput(p.designation || p.role || "Member");
                              setEditRoleModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition-all"
                            title="Edit Role / Department"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-850/60 rounded-xl text-xs text-slate-500">
              No active personnel found matching search criteria.
            </div>
          )}
        </div>
      </div>

      {/* Invite Employee Modal */}
      <InviteEmployeeModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        tenantId={tenant.tenant_id}
        companyId={tenant.id}
        companyName={tenant.legal_name}
        adminUserId={currentUserId}
        adminUserName={currentUserName}
        availableProjects={projectList}
        onInvitationCreated={(newInv) => {
          loadInvitations();
          showToast(`Invitation created for ${newInv.email}`);
        }}
      />

      {/* System Admin Succession Modal */}
      <SystemAdminSuccessionModal
        isOpen={isSuccessionModalOpen}
        onClose={() => setIsSuccessionModalOpen(false)}
        tenantId={tenant.tenant_id}
        currentAdminUserId={currentUserId}
        currentAdminName={currentUserName}
        personnelList={personnelList}
        onSuccessionCompleted={(newAdminName) => {
          showToast(`System Administrator authority successfully transferred to ${newAdminName}.`);
          onRefreshPersonnel();
        }}
      />

      {/* Quick Role Edit Modal */}
      {editRoleModalOpen && selectedPersonnel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase">
                Update Personnel Role
              </h3>
              <button onClick={() => setEditRoleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="text-xs text-slate-300 mb-1">
                Employee: <strong>{selectedPersonnel.full_name}</strong> ({selectedPersonnel.email})
              </div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider my-2">
                Job Title / Corporate Role
              </label>
              <input
                type="text"
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setEditRoleModalOpen(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(`Updated role for ${selectedPersonnel.full_name}`);
                  setEditRoleModalOpen(false);
                  onRefreshPersonnel();
                }}
                className="px-4 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xl"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
