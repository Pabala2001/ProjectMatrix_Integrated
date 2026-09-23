import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  Folder,
  FolderOpen,
  ChevronRight,
  Search,
  FileText,
  Upload,
  X,
  Trash2,
  Calendar,
  User,
  Users,
  Eye,
  AlertTriangle,
  HelpCircle,
  ClipboardList,
  Mail,
  DollarSign,
  Briefcase,
  AlertOctagon,
  FileSpreadsheet,
  Info,
  CheckCircle,
  Download,
  File,
  Check,
  Edit2,
  Terminal,
  Smartphone
} from "lucide-react";

import { supabase, isApiKeyError } from "../../lib/supabase";
import { validateTenantContext } from "../../utils/tenantGuard";
import RfiSubmodule from "./RfiSubmodule";
import WhatsAppCommunicator from "./WhatsAppCommunicator";
import {
  CommDocument,
  mapDbToCommDocument,
  saveCommunicationDocumentFileLifecycle,
  deleteCommunicationDocumentFileLifecycle,
} from "./communicationDocumentFileLifecycle";

const FOLDERS = [
  {
    id: "whatsapp",
    name: "WhatsApp Communicator",
    description: "Broadcast project calendar updates, budget alerts, early warnings and payroll notifications.",
    icon: Smartphone,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200"
  },
  {
    id: "rfi",
    name: "Request For Information",
    description: "Clarifications, technical queries, and official RFI records.",
    icon: HelpCircle,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-100"
  },
  {
    id: "si",
    name: "Site Instruction",
    description: "Formal instructions issued by the engineer, PM, or architect.",
    icon: ClipboardList,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-100"
  },
  {
    id: "minutes",
    name: "Meeting Minutes",
    description: "Minutes of site progress, technical, and alignment sessions.",
    icon: Users,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-100"
  },
  {
    id: "emails",
    name: "Email Correspondence",
    description: "Important project emails, stakeholder notices, and memos.",
    icon: Mail,
    color: "text-violet-500",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-100"
  },
  {
    id: "warning",
    name: "Early Warning",
    description: "Risk mitigation alerts and contractual NEC/FIDIC early warnings.",
    icon: AlertTriangle,
    color: "text-rose-500",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-100"
  },
  {
    id: "compensation",
    name: "Compensation Event",
    description: "Variations, claims, adjustments, and compensation records.",
    icon: DollarSign,
    color: "text-teal-500",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-100"
  },
  {
    id: "variation",
    name: "Variation Orders",
    description: "Track proposed and approved changes to project scope, cost, time and contractual requirements.",
    icon: Briefcase,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-100"
  },
  {
    id: "other",
    name: "Other",
    description: "General records, miscellaneous reports, and unclassified notices.",
    icon: FolderOpen,
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-100"
  }
];



export default function CommunicationPage() {
  const { profile, activeCompany, activeProject } = useOutletContext<any>() || {};

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<CommDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<CommDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<CommDocument | null>(null);

  // SQL Script display states
  const [tableMissing, setTableMissing] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Loading/saving states
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [projectAdvisorWarning, setProjectAdvisorWarning] = useState<string | null>(null);

  // Folder Counts state
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});

  // Deletion Dialog States
  const [docToDelete, setDocToDelete] = useState<CommDocument | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [revision, setRevision] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CommDocument["status"]>("Draft");
  const [signedStatus, setSignedStatus] = useState<CommDocument["signedStatus"]>("Not Signed");
  
  // Drag & Drop / File State
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch folder counts and load folder files
  useEffect(() => {
    fetchFolderCounts();
  }, [activeCompany?.id, activeProject?.id]);

  useEffect(() => {
    if (currentFolderId && currentFolderId !== "rfi") {
      loadDocuments();
    }
  }, [currentFolderId, activeCompany?.id, activeProject?.id]);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isUploadModalOpen || viewingDoc || showDeleteDialog) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isUploadModalOpen, viewingDoc, showDeleteDialog]);

  const activeFolder = FOLDERS.find((f) => f.id === currentFolderId);

  // Fetch count of items in each folder for this project/company
  const fetchFolderCounts = async () => {
    if (!activeCompany?.id || !activeProject?.id || activeProject.company_id !== activeCompany.id) {
      setFolderCounts({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from("communication_documents")
        .select("folder_name")
        .eq("company_id", activeProject.company_id)
        .eq("project_id", activeProject.id);

      if (error) {
        if (!isApiKeyError(error)) {
          console.error("Error fetching folder counts:", error);
        }
        return;
      }

      const counts: Record<string, number> = {};
      FOLDERS.forEach((f) => {
        counts[f.id] = 0;
      });

      data?.forEach((row: any) => {
        const folder = row.folder_name;
        if (counts[folder] !== undefined) {
          counts[folder]++;
        } else {
          counts[folder] = 1;
        }
      });

      setFolderCounts(counts);
    } catch (err) {
      if (!isApiKeyError(err)) {
        console.error("Unexpected error fetching folder counts:", err);
      }
    }
  };

  // Load documents for active folder
  const loadDocuments = async () => {
    if (!activeCompany?.id || !activeProject?.id || !currentFolderId || activeProject.company_id !== activeCompany.id) {
      setDocuments([]);
      return;
    }
    if (currentFolderId === "rfi") return;

    setIsLoading(true);
    setErrorMsg(null);
    setTableMissing(false);
    try {
      const { data, error } = await supabase
        .from("communication_documents")
        .select("*")
        .eq("company_id", activeProject.company_id)
        .eq("project_id", activeProject.id)
        .eq("folder_name", currentFolderId)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "P0001" || error.message?.includes("does not exist")) {
          setTableMissing(true);
        }
        throw error;
      }

      if (data) {
        const mapped = data.map(mapDbToCommDocument);
        setDocuments(mapped);
      }
    } catch (err: any) {
      if (!isApiKeyError(err)) {
        console.error("Error loading documents:", err);
        setErrorMsg(err.message || "Failed to load documents.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySql = () => {
    // Locate SQL in RfiSubmodule and copy
    const rfiSql = `-- Create Table
CREATE TABLE IF NOT EXISTS public.communication_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  folder_name text not null,
  document_type text not null default 'RFI',
  document_title text,
  document_number text,
  revision text,
  document_date date,
  status text default 'Draft',
  signed_status text default 'Not Signed',
  contractor_company text,
  recipient_company text,
  from_company text,
  originator text,
  originator_email text,
  to_company text,
  attention text,
  recipient_email text,
  rfi_number text,
  date_initiated date,
  contract_number text,
  drawing_number text,
  specification text,
  page_number text,
  rfi_description text,
  proposed_action text,
  engineer_response text,
  decision_accept boolean default false,
  decision_accept_with_comments boolean default false,
  decision_reject boolean default false,
  decision_comments text,
  engineer_name text,
  engineer_signature_path text,
  engineer_date date,
  generated_docx_path text,
  signed_file_path text,
  signed_file_name text,
  signed_file_type text,
  signed_file_size bigint,
  company_logo_path text,
  sender text,
  recipient text,
  subject text,
  description text,
  uploaded_file_path text,
  uploaded_file_name text,
  uploaded_file_type text,
  uploaded_file_size bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`;
    navigator.clipboard.writeText(rfiSql);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  // File change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg", "msg", "eml"];
    
    if (allowedExtensions.includes(extension)) {
      setUploadedFile(file);
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.file;
        return copy;
      });
    } else {
      setFormErrors((prev) => ({
        ...prev,
        file: "Invalid file type. Allowed formats: PDF, DOCX, XLSX, PNG, JPG, JPEG, MSG, EML"
      }));
    }
  };

  const handleOpenUploadModal = () => {
    setEditingDoc(null);
    setTitle("");
    setDocNumber("");
    setRevision("0");
    setDate(new Date().toISOString().split("T")[0]);
    setSender("");
    setRecipient("");
    setSubject("");
    setDescription("");
    setStatus("Draft");
    setSignedStatus("Not Signed");
    setUploadedFile(null);
    setFormErrors({});
    setIsUploadModalOpen(true);
  };

  const handleOpenEditModal = (doc: CommDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDoc(doc);
    setTitle(doc.title);
    setDocNumber(doc.docNumber);
    setRevision(doc.revision);
    setDate(doc.date);
    setSender(doc.sender);
    setRecipient(doc.recipient);
    setSubject(doc.subject);
    setDescription(doc.description);
    setStatus(doc.status);
    setSignedStatus(doc.signedStatus);
    setUploadedFile(null);
    setFormErrors({});
    setIsUploadModalOpen(true);
  };

  // SAVE (INSERT OR UPDATE)
  const handleSaveDocument = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Communication/CommunicationPage.tsx");
    e.preventDefault();
    if (isActionLoading) return;
    
    // Validation
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Document title is required";
    if (!docNumber.trim()) errors.docNumber = "Reference/Document number is required";
    if (!sender.trim()) errors.sender = "Sender / originator is required";
    if (!recipient.trim()) errors.recipient = "Recipient is required";
    if (!subject.trim()) errors.subject = "Subject is required";
    if (!editingDoc && !uploadedFile) errors.file = "A valid file upload is required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setProjectAdvisorWarning(null);

    try {
      validateTenantContext(activeCompany, activeProject, profile);
    } catch (err: any) {
      setErrorMsg("Failed to save document.");
      return;
    }

    if (editingDoc) {
      if (
        editingDoc.companyId !== activeProject?.company_id ||
        editingDoc.projectId !== activeProject?.id
      ) {
        setErrorMsg("Failed to update document record in database.");
        return;
      }
    }

    if (!editingDoc) {
      if (
        !globalThis.crypto ||
        typeof globalThis.crypto.randomUUID !== "function"
      ) {
        setErrorMsg("Failed to save document.");
        return;
      }
    }

    setIsActionLoading(true);

    try {
      const docId = editingDoc
        ? editingDoc.id
        : globalThis.crypto.randomUUID();

      const payload: Record<string, unknown> = {
        company_id: activeProject.company_id,
        project_id: activeProject.id,
        folder_name: currentFolderId,
        document_type: activeFolder?.name || "General",
        document_title: title,
        document_number: docNumber,
        revision: revision || "0",
        document_date: date,
        status: status,
        signed_status: signedStatus,
        sender: sender,
        recipient: recipient,
        subject: subject,
        description: description,
        
        // Backward compatibility
        originator: sender,
        attention: recipient,
        rfi_description: description
      };

      const saveResult = await saveCommunicationDocumentFileLifecycle({
        documentId: docId,
        companyId: activeProject.company_id,
        projectId: activeProject.id,
        folderName: currentFolderId || "other",
        payload,
        uploadedFile,
        existingDoc: editingDoc,
      });

      if (!saveResult.success) {
        setErrorMsg(saveResult.error || "Failed to save document.");
        return;
      }

      if (saveResult.warning) {
        setProjectAdvisorWarning(saveResult.warning);
        if (saveResult.message) {
          setSuccessMsg(saveResult.message);
        }
      } else if (saveResult.message) {
        setSuccessMsg(saveResult.message);
      }

      setIsUploadModalOpen(false);
      setEditingDoc(null);
      setUploadedFile(null);
      
      await loadDocuments();
      await fetchFolderCounts();
    } catch (err: any) {
      console.error("Error saving communication document:", err);
      setErrorMsg("Failed to save document.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // DELETE
  const handleDeleteClick = (doc: CommDocument, e: React.MouseEvent) => {
    assertOperationalAction("delete", "pages/Communication/CommunicationPage.tsx");
    e.stopPropagation();
    setDocToDelete(doc);
    setDeleteDialogError(null);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete || isActionLoading) return;
    setIsActionLoading(true);
    setDeleteDialogError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const deleteResult = await deleteCommunicationDocumentFileLifecycle({
        documentId: docToDelete.id,
        companyId: docToDelete.companyId || activeProject?.company_id,
        projectId: docToDelete.projectId || activeProject?.id,
        uploadedFilePath: docToDelete.uploadedFilePath,
        signedFilePath: docToDelete.signedFilePath,
        generatedDocxPath: docToDelete.generatedDocxPath,
      });

      if (!deleteResult.success) {
        setDeleteDialogError(
          deleteResult.error ||
            "The document could not be deleted safely. No further deletion steps were completed. Please try again."
        );
        return;
      }

      // Step 4: Remove document from local UI state
      const deletedId = docToDelete.id;
      setDocuments((current) => current.filter((document) => document.id !== deletedId));
      setSuccessMsg(deleteResult.message || "Document and all linked files completely deleted.");

      // Step 5: Close dialog
      setShowDeleteDialog(false);
      setDocToDelete(null);

      // Step 6: Refresh folder counts
      await fetchFolderCounts();
    } catch (err: any) {
      console.error("Error deleting document:", err);
      setDeleteDialogError(
        "The document could not be deleted safely. No further deletion steps were completed. Please try again."
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  // VIEW/OPEN FILE
  const handleViewFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!filePath) return;
    try {
      setIsActionLoading(true);
      const { data, error } = await supabase.storage
        .from("communication-documents")
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      console.error("Error generating signed url for viewing:", err);
      alert("Failed to view file: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // DOWNLOAD ORIGINAL FILE
  const handleDownloadFile = async (filePath: string, fileName: string, e: React.MouseEvent) => {
    assertOperationalAction("export", "pages/Communication/CommunicationPage.tsx");
    e.stopPropagation();
    if (!filePath) return;
    try {
      setIsActionLoading(true);
      const { data, error } = await supabase.storage
        .from("communication-documents")
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.download = fileName || "downloaded-file";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error("Error generating download link:", err);
      alert("Failed to download file: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const getFolderCount = (folderId: string) => {
    return folderCounts[folderId] || 0;
  };

  const getStatusBadgeStyle = (statusVal: CommDocument["status"]) => {
    switch (statusVal) {
      case "Approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Under Review":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "Submitted":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "Draft":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "Closed":
        return "bg-[#07182E]/5 text-[#07182E] border-[#07182E]/10";
      case "Superseded":
        return "bg-rose-50 text-rose-700 border-rose-100";
      default:
        return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const formatBytes = (bytes: number | undefined) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return "Unknown Size";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Save WhatsApp Alert Log to Supabase communication_documents table
  const handleSaveWhatsAppLogToDocs = async (docData: any) => {
    assertOperationalAction("write", "pages/Communication/CommunicationPage.tsx");
    if (!activeProject?.company_id || !activeProject?.id) return;
    try {
      const payload = {
        company_id: activeProject.company_id,
        project_id: activeProject.id,
        folder_name: docData.folder_name || "emails",
        title: docData.title,
        doc_number: "WA-" + Date.now().toString().slice(-6),
        revision: "0",
        date: new Date().toISOString().split("T")[0],
        sender: docData.sender || profile?.full_name || "System Manager",
        recipient: docData.recipient,
        subject: docData.subject,
        description: docData.description,
        status: "Approved",
        signed_status: "Not Signed"
      };

      await supabase.from("communication_documents").insert([payload]);
      await fetchFolderCounts();
    } catch (err) {
      console.error("Error logging WhatsApp alert to database:", err);
    }
  };

  // Filtered documents
  const filteredDocuments = documents.filter((d) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      d.title.toLowerCase().includes(query) ||
      d.docNumber.toLowerCase().includes(query) ||
      d.subject.toLowerCase().includes(query) ||
      d.sender.toLowerCase().includes(query) ||
      d.recipient.toLowerCase().includes(query) ||
      d.description.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* 1. Breadcrumbs / Header */}
      <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#64748B]">
            <button
              onClick={() => {
                setCurrentFolderId(null);
                setSearchQuery("");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="hover:text-[#FF9F1C] transition-all cursor-pointer"
            >
              Communication
            </button>
            {activeFolder && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <span className="text-[#07182E] font-extrabold">{activeFolder.name}</span>
              </>
            )}
          </div>
          
          <h1 className="text-xl font-extrabold text-[#07182E] tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#FF9F1C]" />
            {activeFolder ? activeFolder.name : "Communication"}
          </h1>
          
          <p className="text-xs text-[#64748B] font-semibold">
            {activeFolder
              ? activeFolder.description
              : "Manage project correspondence, notices, instructions, RFIs, minutes, warnings and compensation events."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              setCurrentFolderId(null);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              !currentFolderId
                ? "bg-[#07182E] text-white shadow-md shadow-[#07182E]/10"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Document Folders
          </button>

          <button
            onClick={() => {
              setCurrentFolderId("whatsapp");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              currentFolderId === "whatsapp"
                ? "bg-[#25D366] text-white shadow-md shadow-emerald-500/20"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
            WhatsApp Dispatcher
          </button>

          {activeFolder && currentFolderId !== "rfi" && currentFolderId !== "whatsapp" && (
            <button
              onClick={handleOpenUploadModal}
              className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#FF9F1C]/15 hover:shadow-[#FF9F1C]/35 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5 animate-fade-in"
            >
              <Plus className="w-4 h-4" />
              Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Notification Banners */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
          <AlertOctagon className="w-5 h-5 text-rose-500 shrink-0" />
          <p className="text-xs text-rose-800 font-semibold">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-xs text-emerald-800 font-semibold">{successMsg}</p>
        </div>
      )}
      {projectAdvisorWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-800 font-semibold">{projectAdvisorWarning}</p>
        </div>
      )}

      {/* 2. MAIN FOLDERS VIEW */}
      {!currentFolderId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {FOLDERS.map((folder) => {
            const IconComponent = folder.icon;
            const count = getFolderCount(folder.id);

            return (
              <div
                key={folder.id}
                className="bg-white border border-[#E2E8F0] hover:border-[#FF9F1C]/40 rounded-3xl p-6 shadow-[0px_8px_24px_rgba(7,24,46,0.02)] hover:shadow-[0px_12px_32px_rgba(7,24,46,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-5 group"
              >
                <div className="space-y-4">
                  {/* Icon & Count Badge */}
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl ${folder.bgColor} ${folder.color} border ${folder.borderColor}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-mono font-extrabold px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-slate-500">
                      {count === 1 ? "1 Document" : `${count} Documents`}
                    </span>
                  </div>

                  {/* Text Details */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-extrabold text-[#07182E] group-hover:text-[#FF9F1C] transition-colors uppercase tracking-wide">
                      {folder.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      {folder.description}
                    </p>
                  </div>
                </div>

                {/* Open Folder Button */}
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setCurrentFolderId(folder.id);
                  }}
                  className="w-full py-2.5 bg-slate-50 hover:bg-[#07182E] border border-slate-100 hover:border-[#07182E] text-[#07182E] hover:text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open Folder
                </button>
              </div>
            );
          })}
        </div>
      ) : currentFolderId === "whatsapp" ? (
        <WhatsAppCommunicator
          activeProject={activeProject}
          activeCompany={activeCompany}
          profile={profile}
          onSaveLogToDocs={handleSaveWhatsAppLogToDocs}
        />
      ) : currentFolderId === "rfi" ? (
        <RfiSubmodule onBack={() => {
          setCurrentFolderId(null);
          fetchFolderCounts();
        }} />
      ) : (
        /* 3. FOLDER WORKSPACE VIEW */
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-[0px_8px_24px_rgba(7,24,46,0.03)] space-y-6 animate-fade-in">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCurrentFolderId(null);
                  setSearchQuery("");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  fetchFolderCounts();
                }}
                className="p-2 border border-slate-150 rounded-xl text-slate-400 hover:text-[#07182E] hover:bg-slate-50 transition-colors cursor-pointer"
                title="Back to folders"
              >
                <Folder className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wide">
                  {activeFolder?.name} Registry
                </h2>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Viewing documents logged under {activeFolder?.name}.
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Database table warning if needed */}
          {tableMissing && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                    Database Table / Columns Missing
                  </h4>
                  <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
                    The <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">communication_documents</code> table lacks columns required for general document folders. Click below to copy and execute the database migration script.
                  </p>
                </div>
              </div>

              <div className="relative bg-slate-900 rounded-xl p-4 overflow-hidden">
                <div className="absolute right-3 top-3 flex items-center gap-2">
                  <button
                    onClick={handleCopySql}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {sqlCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Terminal className="w-3 h-3 text-slate-300" />
                        Copy SQL
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto max-h-48 whitespace-pre-wrap select-all pr-12 leading-relaxed">
                  {`ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS sender text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS recipient text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS uploaded_file_path text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS uploaded_file_name text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS uploaded_file_type text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS uploaded_file_size bigint;`}
                </pre>
              </div>
            </div>
          )}

          {/* Load indicator */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <div className="w-8 h-8 border-4 border-[#FF9F1C] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider animate-pulse">
                Loading Registry Documents...
              </p>
            </div>
          )}

          {/* List/Table of Documents */}
          {!isLoading && filteredDocuments.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-12 text-center flex flex-col justify-center items-center space-y-4 animate-fade-in">
              <div className="p-4 bg-white rounded-full shadow-xs border border-slate-150">
                <FileText className="w-8 h-8 text-[#FF9F1C]" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h4 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wide">
                  {searchQuery ? "No results found" : "Folder is Empty"}
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  {searchQuery
                    ? `No communication records matched "${searchQuery}". Try revising your search phrase.`
                    : `No documents have been uploaded into the ${activeFolder?.name} folder yet.`}
                </p>
              </div>
              {!searchQuery && (
                <button
                  onClick={handleOpenUploadModal}
                  className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload First Document
                </button>
              )}
            </div>
          ) : !isLoading && (
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-4">Ref Number</th>
                    <th className="py-3 px-4">Title / Subject</th>
                    <th className="py-3 px-4">Originator</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => setViewingDoc(doc)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      {/* Ref */}
                      <td className="py-4 px-4 font-mono font-black text-slate-400 bg-slate-50/20 group-hover:bg-slate-50 transition-colors">
                        {doc.docNumber}
                        <span className="ml-1 text-[9px] text-[#FF9F1C] font-bold">R{doc.revision}</span>
                      </td>

                      {/* Title */}
                      <td className="py-4 px-4 max-w-[240px]">
                        <div className="space-y-0.5">
                          <h4 className="font-extrabold text-[#07182E] truncate" title={doc.title}>
                            {doc.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate" title={doc.subject}>
                            {doc.subject}
                          </p>
                        </div>
                      </td>

                      {/* Originator */}
                      <td className="py-4 px-4 font-bold text-[#07182E]">
                        {doc.sender}
                      </td>

                      {/* Recipient */}
                      <td className="py-4 px-4 font-bold text-slate-600">
                        {doc.recipient}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-slate-500 font-semibold whitespace-nowrap">
                        {doc.date}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded-lg ${getStatusBadgeStyle(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setViewingDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-[#07182E] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={(e) => handleOpenEditModal(doc, e)}
                            className="p-1.5 text-slate-400 hover:text-[#FF9F1C] hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Document"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {doc.uploadedFilePath && (
                            <button
                              onClick={(e) => handleDownloadFile(doc.uploadedFilePath!, doc.uploadedFileName || "download", e)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={(e) => handleDeleteClick(doc, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. UPLOAD / EDIT DOCUMENT MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleSaveDocument}
            className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-[720px] max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
          >
            {/* Header */}
            <div className="bg-[#07182E] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Upload className="w-4 h-4 text-[#FF9F1C]" />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF9F1C]">
                    {activeFolder?.name}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">
                    {editingDoc ? "Edit Document Metadata" : "Upload Communication Document"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div
              className="p-6 space-y-5 overflow-y-auto"
              style={{ maxHeight: "calc(90vh - 140px)" }}
            >
              {/* Grid block for meta details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Concrete mix design instruction approval"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (formErrors.title) {
                        setFormErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.title;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold outline-none transition-all ${
                      formErrors.title ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10"
                    }`}
                  />
                  {formErrors.title && (
                    <span className="text-[10px] text-rose-500 font-bold mt-1 block">{formErrors.title}</span>
                  )}
                </div>

                {/* Doc Number & Revision */}
                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Document Number / Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={currentFolderId === "variation" ? "e.g. VO-001" : "e.g. PM-RFI-024"}
                    value={docNumber}
                    onChange={(e) => {
                      setDocNumber(e.target.value);
                      if (formErrors.docNumber) {
                        setFormErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.docNumber;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold outline-none transition-all ${
                      formErrors.docNumber ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10"
                    }`}
                  />
                  {formErrors.docNumber && (
                    <span className="text-[10px] text-rose-500 font-bold mt-1 block">{formErrors.docNumber}</span>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Revision
                  </label>
                  <input
                    type="text"
                    placeholder="0"
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 transition-all"
                  />
                </div>

                {/* Sender & Recipient */}
                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Sender / Originator *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sipho Nkosi (Site Agent)"
                    value={sender}
                    onChange={(e) => {
                      setSender(e.target.value);
                      if (formErrors.sender) {
                        setFormErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.sender;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold outline-none transition-all ${
                      formErrors.sender ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10"
                    }`}
                  />
                  {formErrors.sender && (
                    <span className="text-[10px] text-rose-500 font-bold mt-1 block">{formErrors.sender}</span>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Recipient *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jan Viljoen (PM)"
                    value={recipient}
                    onChange={(e) => {
                      setRecipient(e.target.value);
                      if (formErrors.recipient) {
                        setFormErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.recipient;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold outline-none transition-all ${
                      formErrors.recipient ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10"
                    }`}
                  />
                  {formErrors.recipient && (
                    <span className="text-[10px] text-rose-500 font-bold mt-1 block">{formErrors.recipient}</span>
                  )}
                </div>

                {/* Subject */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Specs for Concrete Grade 35Mpa Alignment"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      if (formErrors.subject) {
                        setFormErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.subject;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold outline-none transition-all ${
                      formErrors.subject ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10"
                    }`}
                  />
                  {formErrors.subject && (
                    <span className="text-[10px] text-rose-500 font-bold mt-1 block">{formErrors.subject}</span>
                  )}
                </div>

                {/* Doc Date, Status & Signed Status */}
                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Document Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CommDocument["status"])}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold outline-none cursor-pointer focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 transition-all"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Closed">Closed</option>
                    <option value="Superseded">Superseded</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Signed Status
                  </label>
                  <select
                    value={signedStatus}
                    onChange={(e) => setSignedStatus(e.target.value as CommDocument["signedStatus"])}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold outline-none cursor-pointer focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 transition-all"
                  >
                    <option value="Not Signed">Not Signed</option>
                    <option value="Signed">Signed</option>
                    <option value="Awaiting Signature">Awaiting Signature</option>
                  </select>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Description / Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter short description or remarks about this record..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C] focus:ring-2 focus:ring-[#FF9F1C]/10 transition-all"
                  />
                </div>

                {/* File Upload Usability Pattern */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Attach Correspondence File {editingDoc ? "(Optional, upload only to replace current file)" : "*"} (Allowed formats: PDF, DOCX, XLSX, PNG, JPG, JPEG, MSG, EML)
                  </label>
                  
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                      dragActive
                        ? "border-[#FF9F1C] bg-[#FF9F1C]/5"
                        : formErrors.file
                        ? "border-rose-300 bg-rose-50/50 hover:bg-rose-50"
                        : "border-slate-200 hover:border-[#FF9F1C]/50 hover:bg-slate-50/50"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.msg,.eml"
                      className="hidden"
                    />
                    
                    <Upload className={`w-8 h-8 ${dragActive ? "text-[#FF9F1C]" : "text-slate-400"}`} />
                    
                    {uploadedFile ? (
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-[#07182E]">
                          {uploadedFile.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {formatBytes(uploadedFile.size)} &bull; Click or Drag to replace
                        </p>
                      </div>
                    ) : editingDoc && editingDoc.uploadedFileName ? (
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-emerald-700">
                          Current: {editingDoc.uploadedFileName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {formatBytes(editingDoc.uploadedFileSize)} &bull; Click or Drag to replace this file
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-600">
                          Drag &amp; drop file here, or <span className="text-[#FF9F1C]">browse files</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold">
                          Supports PDF, DOCX, XLSX, images, outlook MSG and EML
                        </p>
                      </div>
                    )}
                  </div>
                  {formErrors.file && (
                    <span className="text-[10px] text-rose-500 font-bold mt-1.5 block">{formErrors.file}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-2 p-5 bg-white border-t border-slate-150 shrink-0 z-10">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isActionLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionLoading}
                className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#FF9F1C]/15 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isActionLoading ? "Saving..." : (editingDoc ? "Update Document" : "Save Document")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. VIEW DOCUMENT DETAILS MODAL */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="bg-[#07182E] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <FileText className="w-4 h-4 text-[#FF9F1C]" />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF9F1C]">
                    {activeFolder?.name} &bull; Document Details
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">
                    {viewingDoc.docNumber} (Rev {viewingDoc.revision})
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Main title Block */}
              <div className="space-y-1 bg-slate-50 p-4 border border-slate-150 rounded-2xl">
                <span className="text-[9px] font-extrabold text-[#FF9F1C] uppercase tracking-wider block">Document Title</span>
                <h2 className="text-sm font-extrabold text-[#07182E]">{viewingDoc.title}</h2>
              </div>

              {/* Grid detail metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Reference No</span>
                  <span className="font-bold text-[#07182E]">{viewingDoc.docNumber}</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Revision</span>
                  <span className="font-bold text-[#07182E]">Rev {viewingDoc.revision}</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Sender / Originator</span>
                  <span className="font-bold text-[#07182E]">{viewingDoc.sender}</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Recipient</span>
                  <span className="font-bold text-[#07182E]">{viewingDoc.recipient}</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Subject</span>
                  <span className="font-bold text-[#07182E]">{viewingDoc.subject}</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Document Date</span>
                  <span className="font-bold text-[#07182E]">{viewingDoc.date}</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Status</span>
                  <span className={`inline-flex px-2 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded-lg ${getStatusBadgeStyle(viewingDoc.status)}`}>
                    {viewingDoc.status}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Signed Status</span>
                  <span className="font-bold text-[#07182E]">{viewingDoc.signedStatus}</span>
                </div>
              </div>

              {/* Description */}
              {viewingDoc.description && (
                <div className="border-t border-slate-100 pt-4 space-y-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Description / Notes</span>
                  <p className="font-semibold text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    {viewingDoc.description}
                  </p>
                </div>
              )}

              {/* File details */}
              {(viewingDoc.uploadedFilePath || viewingDoc.signedFilePath || viewingDoc.generatedDocxPath) && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Available Files</span>
                  <div className="space-y-2">
                    {viewingDoc.uploadedFilePath && (
                      <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                            <File className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-[#07182E] truncate max-w-[280px]" title={viewingDoc.uploadedFileName}>
                              {viewingDoc.uploadedFileName || "Original Uploaded File"}
                            </h4>
                            <p className="text-[10px] text-emerald-600 font-bold">
                              {formatBytes(viewingDoc.uploadedFileSize)} &bull; Attached file validated
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={(e) => handleViewFile(viewingDoc.uploadedFilePath!, e)}
                            className="p-2 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1 text-[10px]"
                            title="View Original File in New Tab"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            onClick={(e) => handleDownloadFile(viewingDoc.uploadedFilePath!, viewingDoc.uploadedFileName || "download", e)}
                            className="p-2 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1 text-[10px]"
                            title="Download Original File"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      </div>
                    )}

                    {viewingDoc.signedFilePath && viewingDoc.signedFilePath !== viewingDoc.uploadedFilePath && (
                      <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                            <Check className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-[#07182E] truncate max-w-[280px]" title={viewingDoc.signedFileName}>
                              {viewingDoc.signedFileName || "Signed Version"}
                            </h4>
                            <p className="text-[10px] text-blue-600 font-bold">
                              Signed Document Instance
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={(e) => handleViewFile(viewingDoc.signedFilePath!, e)}
                            className="p-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1 text-[10px]"
                            title="View Signed File in New Tab"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            onClick={(e) => handleDownloadFile(viewingDoc.signedFilePath!, viewingDoc.signedFileName || "signed-doc", e)}
                            className="p-2 bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1 text-[10px]"
                            title="Download Signed File"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      </div>
                    )}

                    {viewingDoc.generatedDocxPath && (
                      <div className="bg-[#07182E]/5 p-3 rounded-2xl border border-[#07182E]/10 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-[#07182E]/10 text-[#07182E] rounded-xl">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-[#07182E] truncate max-w-[280px]">
                              Generated DOCX Template
                            </h4>
                            <p className="text-[10px] text-[#07182E]/70 font-bold">
                              RFI Output Document
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={(e) => handleDownloadFile(viewingDoc.generatedDocxPath!, "generated-rfi.docx", e)}
                            className="p-2 bg-white border border-slate-200 text-[#07182E] hover:bg-slate-100 rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1 text-[10px]"
                            title="Download DOCX"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 bg-[#07182E] text-white hover:bg-[#102846] font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CUSTOM DELETION CONFIRMATION DIALOG */}
      {showDeleteDialog && docToDelete && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-[440px] overflow-hidden animate-scale-up">
            <div className="p-6">
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                <div className="p-2 bg-rose-50 rounded-xl">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-wider text-[#07182E]">
                  Confirm Deletion
                </h3>
              </div>
              {deleteDialogError && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 mb-4 flex items-center gap-2 text-rose-800 text-xs font-semibold">
                  <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{deleteDialogError}</span>
                </div>
              )}
              <p className="text-slate-600 text-sm font-semibold mb-2">
                Are you sure you want to permanently delete this document and all linked files?
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-xs space-y-1.5 text-slate-700 font-medium">
                <div>
                  <span className="text-slate-400 font-bold">Title:</span>{" "}
                  <span className="font-extrabold text-[#07182E]">{docToDelete.title}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold">Reference:</span>{" "}
                  <span className="font-extrabold text-[#07182E]">{docToDelete.docNumber}</span>
                </div>
                {docToDelete.uploadedFileName && (
                  <div>
                    <span className="text-slate-400 font-bold">Attached File:</span>{" "}
                    <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {docToDelete.uploadedFileName}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-rose-500 font-bold mt-2">
                  * Note: This will delete the database record and permanently delete the uploaded file from the storage bucket. This action is irreversible.
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDocToDelete(null);
                    setDeleteDialogError(null);
                  }}
                  disabled={isActionLoading}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isActionLoading}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-rose-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isActionLoading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
