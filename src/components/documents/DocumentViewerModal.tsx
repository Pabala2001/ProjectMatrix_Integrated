import { assertOperationalAction } from "../../integration/operationalAccess";
/**
 * Project Matrix – Master Document Internal Viewer & Governance Modal
 */

import React, { useState } from "react";
import {
  X,
  Eye,
  Download,
  FileText,
  Clock,
  User,
  Calendar,
  Hash,
  Layers,
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  GitBranch,
  Link as LinkIcon,
  Tag,
  Share2,
  ExternalLink,
  Plus
} from "lucide-react";
import { ProjectDocument } from "../../types/documentManagement";
import { getExpiryStatus } from "./documentHierarchy";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ProjectDocument | null;
  onDownload: (doc: ProjectDocument) => void;
  onNewRevision?: (doc: ProjectDocument) => void;
  uploaderName?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  onDownload,
  onNewRevision,
  uploaderName
}) => {
  const { formatDateTime, formatDate } = useRegionalSettings();
  const [activeTab, setActiveTab] = useState<"metadata" | "revisions" | "comments" | "relationships">("metadata");
  const [newComment, setNewComment] = useState("");
  const [commentsList, setCommentsList] = useState<Array<{ id: string; user: string; text: string; date: string }>>([
    {
      id: "c1",
      user: uploaderName || "Originator",
      text: "Controlled baseline document ingested into Project Common Data Environment.",
      date: doc?.created_at || new Date().toISOString()
    }
  ]);

  if (!isOpen || !doc) return null;

  const isExpiring = doc.expiry_date || (doc as any).expiryDate;
  const expiryInfo = getExpiryStatus(isExpiring);
  const isCorrespondence = doc.folder_name === "Project Correspondence" || (doc as any).main_category === "Project Correspondence";
  const responseDueDate = (doc as any).response_due_date || (doc as any).responseDueDate;

  const handleAddComment = (e: React.FormEvent) => {
    assertOperationalAction("create", "components/documents/DocumentViewerModal.tsx");
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentsList(prev => [
      ...prev,
      {
        id: `c_${Date.now()}`,
        user: "Current User",
        text: newComment.trim(),
        date: new Date().toISOString()
      }
    ]);
    setNewComment("");
  };

  return (
    <div className="fixed inset-0 bg-[#07182E]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-[#07182E] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-white/10 rounded-xl text-[#FF9F1C]">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#FF9F1C] uppercase tracking-wider">
                  {doc.folder_name} • {doc.subfolder_name || "General"}
                </span>
                <span className="px-2 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-white/20 text-white">
                  Rev {doc.revision || "R00"}
                </span>
                <span className="px-2 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  CURRENT REVISION
                </span>
              </div>
              <h3 className="text-base font-extrabold tracking-tight mt-0.5 max-w-xl truncate">
                {doc.document_title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(doc)}
              className="px-3 py-1.5 bg-[#FF9F1C] hover:bg-[#FFB020] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Expiry / Alert Banner */}
        {isExpiring && expiryInfo.status !== "none" && (
          <div className={`px-5 py-2.5 flex items-center justify-between text-xs font-bold ${
            expiryInfo.status === "expired"
              ? "bg-rose-50 text-rose-800 border-b border-rose-200"
              : expiryInfo.status === "urgent" || expiryInfo.status === "warning"
              ? "bg-amber-50 text-amber-900 border-b border-amber-200"
              : "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
          }`}>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Compliance Expiry Tracking:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${expiryInfo.badgeClass}`}>
                {expiryInfo.label}
              </span>
            </span>
            <span>Expiry Date: {formatDate(isExpiring)}</span>
          </div>
        )}

        {/* Subtabs Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-center gap-2 pt-2">
          <button
            onClick={() => setActiveTab("metadata")}
            className={`px-3 py-2 text-xs font-extrabold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "metadata"
                ? "border-[#FF9F1C] text-[#07182E] bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-[#07182E]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Document Details</span>
          </button>
          <button
            onClick={() => setActiveTab("revisions")}
            className={`px-3 py-2 text-xs font-extrabold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "revisions"
                ? "border-[#FF9F1C] text-[#07182E] bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-[#07182E]"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Revision History</span>
          </button>
          <button
            onClick={() => setActiveTab("relationships")}
            className={`px-3 py-2 text-xs font-extrabold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "relationships"
                ? "border-[#FF9F1C] text-[#07182E] bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-[#07182E]"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Related Records</span>
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`px-3 py-2 text-xs font-extrabold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "comments"
                ? "border-[#FF9F1C] text-[#07182E] bg-white rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-[#07182E]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Comments & Review ({commentsList.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(92vh-220px)] space-y-5">
          {/* TAB 1: METADATA */}
          {activeTab === "metadata" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Core Metadata */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Controlled Attributes
                  </span>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">Document Number</span>
                      <span className="font-mono font-bold text-[#07182E]">{doc.document_number || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">Main Category</span>
                      <span className="font-bold text-[#07182E]">{doc.folder_name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">Subtab Category</span>
                      <span className="font-bold text-[#07182E]">{doc.subfolder_name || "General"}</span>
                    </div>
                    {(doc as any).discipline && (
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-bold">Engineering Discipline</span>
                        <span className="font-bold text-blue-600">{(doc as any).discipline}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">Current Revision</span>
                      <span className="font-mono font-bold text-emerald-600">Rev {doc.revision || "R00"}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-bold">Document Date</span>
                      <span className="font-bold text-[#07182E]">{doc.document_date ? formatDate(doc.document_date) : "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Storage & Custody */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    CDE Storage & Audit Trail
                  </span>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">Physical Filename</span>
                      <span className="font-semibold text-[#07182E] truncate max-w-[200px]" title={doc.file_name}>
                        {doc.file_name}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">MIME Type</span>
                      <span className="font-mono text-slate-600 text-[11px]">{doc.file_type || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">Uploaded By</span>
                      <span className="font-bold text-[#07182E]">{uploaderName || "Authorized User"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-bold">Timestamp Ingested</span>
                      <span className="text-slate-600 font-medium">{formatDateTime(doc.created_at)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-bold">CDE Storage ID</span>
                      <span className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">{doc.id}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {doc.description && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Scope Description / Transmittal Notes
                  </span>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {doc.description}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REVISION HISTORY */}
          {activeTab === "revisions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  Tracked Revision Hierarchy (Controlled Documents are Never Overwritten)
                </span>
                {onNewRevision && (
                  <button
                    onClick={() => onNewRevision(doc)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload New Revision</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {/* Current Revision */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-mono font-extrabold">
                      {doc.revision || "R00"}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-[#07182E] block">
                        {doc.document_title} (Current Active Master)
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Ingested on {formatDateTime(doc.created_at)} by {uploaderName || "Authorized User"}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Active Master
                  </span>
                </div>

                {/* Legacy/Historical revisions indicator */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[11px] text-slate-400 font-semibold">
                    No superseded previous revisions registered for this baseline document.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RELATIONSHIPS */}
          {activeTab === "relationships" && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-500 block">
                Single Source of Truth Graph (Linked Modules & Entities)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Engineering Module</span>
                  <span className="text-xs font-extrabold text-[#07182E] block">Synchronized</span>
                  <span className="text-[9px] text-emerald-600 font-bold">Single Master Ref</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Contracts & Claims</span>
                  <span className="text-xs font-extrabold text-[#07182E] block">Linked</span>
                  <span className="text-[9px] text-blue-600 font-bold">Clause Referenceable</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Commercial & BOQ</span>
                  <span className="text-xs font-extrabold text-[#07182E] block">Direct Ref</span>
                  <span className="text-[9px] text-slate-500 font-bold">Zero File Duplication</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COMMENTS */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              <div className="space-y-3">
                {commentsList.map(comment => (
                  <div key={comment.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span className="text-[#07182E]">{comment.user}</span>
                      <span>{formatDateTime(comment.date)}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">{comment.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a review note or transmittal remark..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#FF9F1C] outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#07182E] hover:bg-[#102846] text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Post Note
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
