import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useRef } from "react";
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Users, 
  ArrowRight, 
  Loader2, 
  Shield, 
  Building2, 
  HelpCircle,
  Trash2,
  RefreshCw
} from "lucide-react";
import { ROLE_OPTIONS, isActiveRole, getRoleLabel } from "../../config/roles";
import { supabase } from "../../lib/supabase";
import { CrudAdapter } from "../../services/crudAdapter";
import { addStoredCompanyMember } from "../../services/tenantService";

export interface ParsedCsvMember {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  isAdmin: boolean;
  projectCodes: string[];
  projectIds: string[];
  status: "valid" | "warning" | "error";
  validationMessage?: string;
  invited?: boolean;
  inviteError?: string;
}

interface BulkInviteCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompany: any;
  allProjects: any[];
  departmentsList: any[];
  onSuccess: () => Promise<void>;
  setIsActionLoading: (loading: boolean) => void;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
}

export function BulkInviteCsvModal({
  isOpen,
  onClose,
  activeCompany,
  allProjects,
  departmentsList,
  onSuccess,
  setIsActionLoading,
  setSuccessMsg,
  setErrorMsg
}: BulkInviteCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCsvMember[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Generate and download template CSV
  const handleDownloadTemplate = () => {
    assertOperationalAction("export", "components/administration/BulkInviteCsvModal.tsx");
    const defaultProjectCode = allProjects?.[0]?.contract_code || "PRJ-001";
    const csvContent = [
      "Full Name,Email,Phone,Role,Department,Is Admin,Project Codes",
      `Sipho Nkosi,sipho.nkosi@contractor.co.za,+27 82 111 2222,Project Manager,Engineering,No,${defaultProjectCode}`,
      `Nandi Dlamini,nandi.dlamini@contractor.co.za,+27 83 333 4444,Senior Engineer,Civil & Structural,No,${defaultProjectCode}`,
      `Johan van der Merwe,johan.vdm@contractor.co.za,+27 84 555 6666,Quantity Surveyor,Commercial & Finance,No,${defaultProjectCode}`,
      `Fatima Patel,fatima.patel@contractor.co.za,+27 82 777 8888,Safety Officer (HSEQ),HSEQ & Compliance,No,${defaultProjectCode}`,
      `Kagiso Molefe,kagiso.molefe@contractor.co.za,+27 81 999 0000,Contracts Manager,Executive,Yes,${defaultProjectCode}`
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ProjectMatrix_Employee_Invite_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Line Parser (handles quoted strings and commas)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setParseError("The uploaded CSV file is empty.");
          return;
        }

        const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          setParseError("The CSV file must contain a header row and at least one employee row.");
          return;
        }

        // Header mapping
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
        const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("fullname") || h.includes("employee"));
        const emailIdx = headers.findIndex(h => h.includes("email") || h.includes("mail"));
        const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("tel") || h.includes("mobile"));
        const roleIdx = headers.findIndex(h => h.includes("role") || h.includes("designation") || h.includes("title"));
        const deptIdx = headers.findIndex(h => h.includes("dept") || h.includes("department"));
        const adminIdx = headers.findIndex(h => h.includes("admin") || h.includes("isadmin"));
        const projIdx = headers.findIndex(h => h.includes("proj") || h.includes("project") || h.includes("contract"));

        if (nameIdx === -1 || emailIdx === -1) {
          setParseError("Could not detect 'Full Name' and 'Email' columns in the CSV header.");
          return;
        }

        const parsed: ParsedCsvMember[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length === 0 || cols.every(c => !c.trim())) continue;

          const fullName = cols[nameIdx] || "";
          const email = cols[emailIdx] || "";
          const phone = phoneIdx !== -1 ? cols[phoneIdx] : "";
          const rawRole = roleIdx !== -1 ? cols[roleIdx] : "Senior Engineer";
          const rawDept = deptIdx !== -1 ? cols[deptIdx] : "Engineering";
          const rawAdmin = adminIdx !== -1 ? cols[adminIdx] : "No";
          const rawProj = projIdx !== -1 ? cols[projIdx] : "";

          // Validate role against ROLE_OPTIONS
          let matchedRole = "Senior Engineer";
          const exactRole = ROLE_OPTIONS.find(
            r => r.label.toLowerCase() === rawRole.toLowerCase() || r.value.toLowerCase() === rawRole.toLowerCase()
          );
          if (exactRole) {
            matchedRole = exactRole.label;
          } else {
            const partialRole = ROLE_OPTIONS.find(
              r => r.label.toLowerCase().includes(rawRole.toLowerCase()) || rawRole.toLowerCase().includes(r.label.toLowerCase())
            );
            if (partialRole) matchedRole = partialRole.label;
          }

          // Validate Department
          let matchedDept = departmentsList[0]?.name || "Engineering";
          const foundDept = departmentsList.find(d => d.name.toLowerCase() === rawDept.toLowerCase());
          if (foundDept) {
            matchedDept = foundDept.name;
          } else {
            matchedDept = rawDept || "Engineering";
          }

          // Parse Admin flag
          const isAdmin = ["yes", "true", "1", "admin", "y"].includes(rawAdmin.toLowerCase());

          // Parse and match Projects
          const projectCodeList = rawProj
            ? rawProj.split(";").map(p => p.trim()).filter(Boolean)
            : [];
          
          const matchedProjectIds: string[] = [];
          for (const pCode of projectCodeList) {
            const match = allProjects.find(
              p => (p.contract_code && p.contract_code.toLowerCase() === pCode.toLowerCase()) ||
                   (p.name && p.name.toLowerCase() === pCode.toLowerCase()) ||
                   (p.id === pCode)
            );
            if (match) {
              matchedProjectIds.push(match.id);
            }
          }

          // If no specific project codes provided, assign first active project if available
          if (matchedProjectIds.length === 0 && allProjects.length > 0) {
            matchedProjectIds.push(allProjects[0].id);
          }

          // Validation state
          let status: "valid" | "warning" | "error" = "valid";
          let validationMessage = "Ready to invite";

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!fullName.trim()) {
            status = "error";
            validationMessage = "Missing Full Name";
          } else if (!email.trim() || !emailRegex.test(email.trim())) {
            status = "error";
            validationMessage = "Invalid Email Address";
          } else if (!exactRole && rawRole) {
            status = "warning";
            validationMessage = `Role auto-mapped to '${matchedRole}'`;
          }

          parsed.push({
            id: `csv_row_${i}_${Date.now()}`,
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            role: matchedRole,
            department: matchedDept,
            isAdmin,
            projectCodes: projectCodeList.length > 0 ? projectCodeList : [allProjects?.[0]?.contract_code || "Default Project"],
            projectIds: matchedProjectIds,
            status,
            validationMessage
          });
        }

        if (parsed.length === 0) {
          setParseError("No valid rows could be extracted from the CSV file.");
        } else {
          setParsedRows(parsed);
        }
      } catch (err: any) {
        console.error("CSV Parse Error:", err);
        setParseError("Failed to parse CSV file: " + (err.message || "Invalid formatting."));
      }
    };

    reader.readAsText(selectedFile);
  };

  const handleRemoveRow = (id: string) => {
    assertOperationalAction("delete", "components/administration/BulkInviteCsvModal.tsx");
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  // Bulk Invite Executor
  const handleExecuteInvites = async () => {
    const validRows = parsedRows.filter(r => r.status !== "error");
    if (validRows.length === 0) {
      setParseError("No valid rows available to invite.");
      return;
    }

    const companyId = activeCompany?.id;
    if (!companyId) {
      setParseError("Active company context missing.");
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: validRows.length });
    let successCount = 0;
    let failCount = 0;

    const updatedRows = [...parsedRows];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const targetIndex = updatedRows.findIndex(r => r.id === row.id);
      const tempPassword = `Matrix@${Math.floor(100000 + Math.random() * 900000)}`;

      try {
        // Attempt edge function invoke
        let invitedViaEdge = false;
        try {
          const { data, error: invokeError } = await supabase.functions.invoke("create-company-member", {
            body: {
              full_name: row.fullName,
              email: row.email,
              phone: row.phone || null,
              temporary_password: tempPassword,
              designation: row.role,
              department: row.department,
              is_company_admin: row.isAdmin,
              company_id: companyId,
              organisation_id: companyId,
              status: "invited",
              project_ids: row.projectIds
            }
          });

          if (!invokeError && !data?.error) {
            invitedViaEdge = true;
          }
        } catch (edgeErr) {
          console.warn("Edge function invoke skipped or failed, using local/database fallback:", edgeErr);
        }

        // Direct DB fallback if Edge Function wasn't available
        if (!invitedViaEdge) {
          const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const memberPayload = {
            id: memberId,
            company_id: companyId,
            full_name: row.fullName,
            email: row.email,
            phone: row.phone || null,
            designation: row.role,
            department: row.department,
            is_company_admin: row.isAdmin,
            is_active: true,
            status: "Invited",
            created_at: new Date().toISOString()
          };

          // Save member in local storage directory
          addStoredCompanyMember(companyId, memberPayload);

          // Save member via CrudAdapter
          await CrudAdapter.saveRecord(
            { tableName: "company_members", companyId },
            memberPayload
          );

          // Save project assignments
          for (const projId of row.projectIds) {
            await CrudAdapter.saveRecord(
              { tableName: "project_members", companyId, projectId: projId },
              {
                id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                project_id: projId,
                company_member_id: memberId,
                project_role: row.role,
                designation: row.role
              }
            );
          }
        }

        successCount++;
        if (targetIndex !== -1) {
          updatedRows[targetIndex] = {
            ...updatedRows[targetIndex],
            invited: true,
            validationMessage: "Successfully Invited"
          };
        }
      } catch (err: any) {
        console.error(`Failed to invite ${row.email}:`, err);
        failCount++;
        if (targetIndex !== -1) {
          updatedRows[targetIndex] = {
            ...updatedRows[targetIndex],
            invited: false,
            inviteError: err.message || "Failed to dispatch invitation"
          };
        }
      }

      setProgress({ current: i + 1, total: validRows.length });
    }

    setParsedRows(updatedRows);
    setIsProcessing(false);

    try {
      await onSuccess();
    } catch (e) {}

    if (failCount === 0) {
      setSuccessMsg(`Successfully dispatched bulk invitations to ${successCount} employee(s).`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setSuccessMsg(`Invited ${successCount} employee(s). ${failCount} failed.`);
    }
  };

  const validCount = parsedRows.filter(r => r.status === "valid").length;
  const warningCount = parsedRows.filter(r => r.status === "warning").length;
  const errorCount = parsedRows.filter(r => r.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FF9F1C]/10 text-[#FF9F1C] rounded-xl border border-[#FF9F1C]/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#07182E] uppercase tracking-tight flex items-center gap-2">
                Bulk Employee CSV Invitation
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a structured spreadsheet to invite and assign multiple team members simultaneously.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Instructions and Download Template */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
                CSV Format Requirements
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Include columns: <code>Full Name</code>, <code>Email</code>, <code>Phone</code>, <code>Role</code>, <code>Department</code>, <code>Is Admin</code>, and <code>Project Codes</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 font-bold text-xs rounded-lg shadow-sm flex items-center gap-2 shrink-0 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-600" />
              Download CSV Template
            </button>
          </div>

          {/* Upload Area */}
          {!file && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#FF9F1C] bg-slate-50/50 hover:bg-amber-50/30 rounded-2xl p-8 text-center transition-all cursor-pointer space-y-3"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv,text/csv" 
                className="hidden" 
              />
              <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl mx-auto flex items-center justify-center text-slate-500 shadow-sm">
                <Upload className="w-6 h-6 text-[#FF9F1C]" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#07182E]">Click to upload employee CSV file</span>
                <span className="text-xs text-slate-500 block mt-0.5">or drag and drop your spreadsheet here</span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Supports Standard Comma-Separated Values (.csv)
              </div>
            </div>
          )}

          {/* Error Banner */}
          {parseError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{parseError}</div>
              <button onClick={() => setParseError(null)} className="text-red-400 hover:text-red-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#07182E]">
                    Parsed {parsedRows.length} Employee Record(s)
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                      {validCount} Valid
                    </span>
                    {warningCount > 0 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                        {warningCount} Mapped
                      </span>
                    )}
                    {errorCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded">
                        {errorCount} Errors
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsedRows([]);
                    setParseError(null);
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Replace File
                </button>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[300px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Admin</th>
                      <th className="py-2.5 px-3">Projects</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-3">
                          {row.invited ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Invited
                            </span>
                          ) : row.status === "valid" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3 h-3" /> Valid
                            </span>
                          ) : row.status === "warning" ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]" title={row.validationMessage}>
                              <AlertTriangle className="w-3 h-3" /> Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]" title={row.validationMessage}>
                              <AlertTriangle className="w-3 h-3" /> Error
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-bold text-[#07182E]">{row.fullName}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">{row.email}</td>
                        <td className="py-2 px-3 text-slate-700 font-semibold">{row.role}</td>
                        <td className="py-2 px-3 text-slate-500">{row.department}</td>
                        <td className="py-2 px-3">
                          {row.isAdmin ? (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                              Admin
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded">
                            {row.projectIds.length} Project(s)
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-[#07182E]">
                <span>Sending Invitations & Configuring Roles...</span>
                <span>{progress.current} of {progress.total}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#FF9F1C] transition-all duration-300 rounded-full"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteInvites}
            disabled={isProcessing || parsedRows.filter(r => r.status !== "error").length === 0}
            className="px-6 py-2.5 bg-[#FF9F1C] hover:bg-[#FFB020] disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Dispatching Invitations...</span>
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                <span>Invite {parsedRows.filter(r => r.status !== "error").length} Employees</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
