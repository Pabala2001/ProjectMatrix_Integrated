import React, { useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Calendar, 
  User, 
  Search, 
  Filter, 
  ArrowUpDown,
  Download,
  Eye,
  AlertCircle,
  Paperclip,
  Check,
  X,
  Plus
} from "lucide-react";
import { LeaveRequest, LeaveStatus, LeaveCategory } from "../../types/leave";
import { LEAVE_POLICIES } from "../../services/leaveService";

interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  onOpenNewModal: () => void;
  onUpdateStatus: (id: string, newStatus: LeaveStatus, comment?: string) => void;
  isManager: boolean;
  filterStatus?: string;
}

export default function LeaveRequestsTable({
  requests,
  onOpenNewModal,
  onUpdateStatus,
  isManager,
  filterStatus: initialFilter = "All"
}: LeaveRequestsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [actionComment, setActionComment] = useState<string>("");
  const [actionModal, setActionModal] = useState<{ id: string; type: "Approve" | "Reject" } | null>(null);

  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === "All" || req.status === statusFilter;
    const matchesType = typeFilter === "All" || req.leaveType === typeFilter;
    const matchesSearch = 
      req.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      req.employeeNumber.toLowerCase().includes(search.toLowerCase()) ||
      req.reason.toLowerCase().includes(search.toLowerCase()) ||
      req.leaveTypeName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Clock className="w-3 h-3 animate-pulse" />
            Pending Review
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 border border-red-500/30 text-red-400">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-500/10 border border-slate-500/30 text-slate-400">
            Cancelled
          </span>
        );
    }
  };

  const handleConfirmAction = () => {
    if (!actionModal) return;
    onUpdateStatus(actionModal.id, actionModal.type === "Approve" ? "Approved" : "Rejected", actionComment);
    setActionModal(null);
    setActionComment("");
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee, ID, reason, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Leave Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500 cursor-pointer max-w-[180px]"
          >
            <option value="All">All Leave Types</option>
            {LEAVE_POLICIES.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* New Application CTA */}
          <button
            type="button"
            onClick={onOpenNewModal}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Apply For Leave</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Leave Type</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">Working Days</th>
                <th className="py-3.5 px-4">Handover / Reliever</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold">No leave applications found matching current criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-850/50 transition-colors">
                    {/* Employee */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                          {req.employeeName.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-white block">{req.employeeName}</span>
                          <span className="text-[10px] text-slate-400">{req.employeeNumber} • {req.employeeRole}</span>
                        </div>
                      </div>
                    </td>

                    {/* Leave Type */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-200 block">{req.leaveTypeName}</span>
                      <span className="text-[10px] text-slate-400">{req.department}</span>
                    </td>

                    {/* Duration */}
                    <td className="py-3.5 px-4">
                      <div className="text-slate-300 font-medium">
                        <span>{req.startDate}</span>
                        <span className="text-slate-500 mx-1.5">→</span>
                        <span>{req.endDate}</span>
                      </div>
                      {req.isHalfDay && (
                        <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                          Half-day ({req.halfDayPeriod})
                        </span>
                      )}
                    </td>

                    {/* Total Days */}
                    <td className="py-3.5 px-4">
                      <span className="font-black text-white px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                        {req.totalWorkingDays} {req.totalWorkingDays === 1 ? "Day" : "Days"}
                      </span>
                    </td>

                    {/* Handover / Reliever */}
                    <td className="py-3.5 px-4">
                      <span className="text-slate-300 block font-medium">
                        {req.handoverColleague || "Not assigned"}
                      </span>
                      {req.medicalCertUploaded && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold mt-0.5">
                          <Paperclip className="w-2.5 h-2.5" /> Med Cert Attached
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(req.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {isManager && req.status === "Pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setActionModal({ id: req.id, type: "Approve" })}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                              title="Approve Request"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setActionModal({ id: req.id, type: "Reject" })}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors cursor-pointer"
                              title="Reject Request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 relative shadow-2xl space-y-4">
            <button
              onClick={() => setSelectedRequest(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Leave Application Details</span>
                <h3 className="text-base font-bold text-white">{selectedRequest.employeeName} ({selectedRequest.employeeNumber})</h3>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Leave Type:</span>
                <span className="font-bold text-white">{selectedRequest.leaveTypeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dates:</span>
                <span className="font-semibold text-slate-300">{selectedRequest.startDate} to {selectedRequest.endDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Working Days:</span>
                <span className="font-bold text-amber-400">{selectedRequest.totalWorkingDays} Days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Handover Colleague:</span>
                <span className="font-semibold text-slate-300">{selectedRequest.handoverColleague || "None"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Emergency Phone:</span>
                <span className="font-semibold text-slate-300">{selectedRequest.emergencyPhone || "On File"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payroll Integration:</span>
                <span className="font-semibold text-emerald-400">{selectedRequest.payrollImpact || "No Deduction (Paid)"}</span>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-500 block mb-1">Reason / Statement:</span>
                <p className="text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 italic">
                  "{selectedRequest.reason}"
                </p>
              </div>
              {selectedRequest.managerComments && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 block mb-1">Reviewer Feedback:</span>
                  <p className="text-amber-300/90 font-medium">
                    {selectedRequest.managerComments}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve / Reject Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 relative shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {actionModal.type === "Approve" ? "Approve Leave Application" : "Reject Leave Application"}
            </h3>
            <p className="text-xs text-slate-400">
              Add optional supervisory notes or conditions for this decision.
            </p>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Manager Remarks / Handover Confirmation
              </label>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder="e.g., Verified shift coverage with assistant foreman..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActionModal(null);
                  setActionComment("");
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 cursor-pointer ${
                  actionModal.type === "Approve" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                Confirm {actionModal.type}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
