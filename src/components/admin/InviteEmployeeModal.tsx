import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { 
  X, 
  UserPlus, 
  Mail, 
  Phone, 
  Building2, 
  Shield, 
  FolderGit2, 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertCircle, 
  Loader2,
  Sparkles,
  Layers,
  ArrowRight
} from "lucide-react";
import { STANDARD_ROLES } from "../../config/roles";
import { createEmployeeInvitation, EmployeeInvitation, ProjectRoleAssignment } from "../../services/invitationService";

interface ProjectOption {
  id: string;
  name: string;
  code: string;
}

interface InviteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  companyId: string;
  companyName: string;
  adminUserId: string;
  adminUserName: string;
  availableProjects: ProjectOption[];
  onInvitationCreated: (invitation: EmployeeInvitation) => void;
}

const PROJECT_ROLES = [
  "Project Director",
  "Project Executive",
  "Project Manager",
  "Contracts Manager",
  "Construction Manager",
  "Commercial Manager",
  "Project Engineer",
  "Site Engineer",
  "Quantity Surveyor",
  "Lead Planner",
  "Engineering Surveyor",
  "HSEQ Officer",
  "Document Controller",
  "Project Member",
  "Project Viewer"
];

const DEPARTMENTS = [
  "Executive",
  "Governance",
  "Administration",
  "Engineering",
  "Projects",
  "Contracts",
  "Commercial",
  "Finance",
  "Procurement",
  "Human Resources",
  "Health & Safety",
  "Quality",
  "Plant & Equipment",
  "Logistics",
  "IT & Security",
  "Legal",
  "Business Development",
  "Document Control"
];

export default function InviteEmployeeModal({
  isOpen,
  onClose,
  tenantId,
  companyId,
  companyName,
  adminUserId,
  adminUserName,
  availableProjects,
  onInvitationCreated
}: InviteEmployeeModalProps) {
  // Form State
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [employeeNumber, setEmployeeNumber] = useState<string>("");
  const [designation, setDesignation] = useState<string>("");
  const [department, setDepartment] = useState<string>("Projects");
  const [phone, setPhone] = useState<string>("");

  // Role (System Administrator is strictly filtered out)
  const allowedRoles = Object.values(STANDARD_ROLES).filter(
    r => r.id !== "system_administrator" && !r.name.toLowerCase().includes("system administrator")
  );
  const [selectedRoleId, setSelectedRoleId] = useState<string>("project_manager");

  // Project Access
  const [projectAccessType, setProjectAccessType] = useState<"all" | "selected">("selected");
  const [selectedProjectMap, setSelectedProjectMap] = useState<Record<string, string>>({}); // projectId -> projectRole

  // Outcome / Success state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<EmployeeInvitation | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleProject = (projectId: string) => {
    setSelectedProjectMap(prev => {
      const updated = { ...prev };
      if (updated[projectId]) {
        delete updated[projectId];
      } else {
        updated[projectId] = "Project Member";
      }
      return updated;
    });
  };

  const setProjectRole = (projectId: string, role: string) => {
    setSelectedProjectMap(prev => ({
      ...prev,
      [projectId]: role
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/admin/InviteEmployeeModal.tsx");
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg("Please enter both First Name and Last Name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid work email.");
      return;
    }
    if (!designation.trim()) {
      setErrorMsg("Job Title / Designation is required.");
      return;
    }

    const selectedRole = allowedRoles.find(r => r.id === selectedRoleId) || allowedRoles[0];

    // Build project assignments
    const projectAssignments: ProjectRoleAssignment[] = [];
    if (projectAccessType === "selected") {
      Object.entries(selectedProjectMap).forEach(([projId, role]) => {
        const proj = availableProjects.find(p => p.id === projId);
        if (proj) {
          projectAssignments.push({
            projectId: proj.id,
            projectName: proj.name,
            projectCode: proj.code,
            projectRole: String(role)
          });
        }
      });
    }

    setIsSubmitting(true);
    try {
      const invite = await createEmployeeInvitation({
        tenant_id: tenantId,
        company_id: companyId,
        company_name: companyName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        employee_number: employeeNumber.trim() || undefined,
        designation: designation.trim(),
        department: department.trim(),
        phone: phone.trim() || undefined,
        system_role_id: selectedRole.id,
        system_role_name: selectedRole.name,
        project_access_type: projectAccessType,
        project_assignments: projectAssignments,
        created_by_id: adminUserId,
        created_by_name: adminUserName
      });

      setCreatedInvite(invite);
      onInvitationCreated(invite);
    } catch (err: any) {
      console.error("Failed to generate invitation:", err);
      setErrorMsg(err.message || "Failed to issue invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInvitationToken = () => {
    if (!createdInvite) return;
    const inviteUrl = `${window.location.origin}${window.location.pathname}#/join?token=${createdInvite.secure_token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleResetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setEmployeeNumber("");
    setDesignation("");
    setPhone("");
    setCreatedInvite(null);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Invite Employee</h3>
              <p className="text-[11px] text-slate-400">Issue secure token-based access to {companyName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!createdInvite ? (
            <form id="invite-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Section 1: Employee Information */}
              <div>
                <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> 1. Employee Profile
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      First Name <span className="text-amber-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nomvula"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Last Name <span className="text-amber-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Khumalo"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Work Email <span className="text-amber-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="nomvula.khumalo@matrix-civil.co.za"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Employee Number (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. EMP-2026-094"
                      value={employeeNumber}
                      onChange={(e) => setEmployeeNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Job Title / Designation <span className="text-amber-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Quantity Surveyor"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Department
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      {DEPARTMENTS.map((dept, idx) => (
                        <option key={`${dept}-${idx}`} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Telephone (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="+27 83 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: System Role */}
              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> 2. Corporate System Role
                </h4>
                <p className="text-[11px] text-slate-400 mb-2">
                  System Administrator is strictly protected and cannot be assigned via invitation.
                </p>

                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {allowedRoles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — ({r.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 3: Project Access */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderGit2 className="w-3.5 h-3.5" /> 3. Project Assignment & Project Role
                  </h4>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px]">
                      <input
                        type="radio"
                        name="projectAccess"
                        checked={projectAccessType === "selected"}
                        onChange={() => setProjectAccessType("selected")}
                        className="accent-amber-500"
                      />
                      Selected Projects
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 text-[11px]">
                      <input
                        type="radio"
                        name="projectAccess"
                        checked={projectAccessType === "all"}
                        onChange={() => setProjectAccessType("all")}
                        className="accent-amber-500"
                      />
                      All Company Projects
                    </label>
                  </div>
                </div>

                {projectAccessType === "selected" ? (
                  availableProjects.length > 0 ? (
                    <div className="space-y-2 max-h-44 overflow-y-auto p-2 bg-slate-950/60 border border-slate-850 rounded-xl">
                      {availableProjects.map(p => {
                        const isAssigned = !!selectedProjectMap[p.id];
                        return (
                          <div
                            key={p.id}
                            className={`p-2 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                              isAssigned
                                ? "bg-slate-900 border-amber-500/40 text-white"
                                : "bg-slate-950 border-slate-800 text-slate-400"
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer flex-1 truncate">
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => toggleProject(p.id)}
                                className="accent-amber-500 rounded"
                              />
                              <span className="font-mono text-[10px] text-slate-500">[{p.code}]</span>
                              <span className="font-semibold text-xs truncate">{p.name}</span>
                            </label>

                            {isAssigned && (
                              <select
                                value={selectedProjectMap[p.id] || "Project Member"}
                                onChange={(e) => setProjectRole(p.id, e.target.value)}
                                className="bg-slate-950 border border-slate-700 text-[11px] px-2 py-1 rounded text-amber-400 focus:outline-none"
                              >
                                {PROJECT_ROLES.map(pr => (
                                  <option key={pr} value={pr}>{pr}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center bg-slate-950 border border-slate-850 rounded-xl text-slate-500 text-[11px]">
                      No active projects provisioned yet.
                    </div>
                  )
                ) : (
                  <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-slate-400 text-[11px]">
                    Employee will have access to all projects in accordance with their corporate role permissions.
                  </div>
                )}
              </div>
            </form>
          ) : (
            /* INVITATION GENERATED SUMMARY */
            <div className="text-center py-4 space-y-4 animate-fadeIn">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Invitation Draft Saved
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Secure 72-hour invitation token created for <strong>{createdInvite.first_name} {createdInvite.last_name}</strong> ({createdInvite.email}).
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-left space-y-2">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Draft Token — Backend Connection Required
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${window.location.pathname}#/join?token=${createdInvite.secure_token}`}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyInvitationToken}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Token: <code className="text-slate-300 font-mono">{createdInvite.secure_token}</code>
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl"
                >
                  Invite Another Employee
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-bold rounded-xl"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (When in form mode) */}
        {!createdInvite && (
          <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white font-bold text-xs"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="invite-form"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Secure Link...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Save Invitation Draft</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
