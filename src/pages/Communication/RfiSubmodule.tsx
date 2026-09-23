import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { validateTenantContext } from "../../utils/tenantGuard";
import {
  deleteCommunicationDocumentFileLifecycle,
} from "./communicationDocumentFileLifecycle";
import {
  saveSignedRfiFileLifecycle,
} from "./rfiSignedFileLifecycle";
import {
  GENERATED_RFI_DOCX_MIME_TYPE,
  saveGeneratedRfiDocxLifecycle,
} from "./rfiGeneratedDocxLifecycle";
import {
  FileText,
  Plus,
  Search,
  X,
  Edit2,
  Eye,
  Download,
  Upload,
  Check,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Briefcase,
  User,
  Mail,
  ChevronRight,
  Info,
  Terminal,
  Trash2
} from "lucide-react";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  BorderStyle,
  AlignmentType,
  TextRun,
  HeightRule
} from "docx";

export interface RfiDocument {
  id: string;
  companyId: string;
  projectId: string;
  contractorCompany: string;
  consultantCompany: string;
  logoName?: string;
  logoBase64?: string;
  
  fromCompany: string;
  fromOriginator: string;
  fromEmail: string;
  
  toCompany: string;
  toAttention: string;
  toEmail: string;
  
  rfiNumber: string;
  dateInitiated: string;
  contractNumber: string;
  drawingNumber: string;
  specification: string;
  pageNumber: string;
  
  originatorName: string;
  queryText: string;
  
  proposedAction: string;
  engineerResponse: string;
  
  decisionAccept: boolean;
  decisionAcceptWithComments: boolean;
  decisionReject: boolean;
  decisionComments: string;
  
  engineerName: string;
  signatureName?: string;
  signatureBase64?: string;
  signDate: string;
  
  status: "Draft" | "Under Review" | "Accepted" | "Rejected" | "Closed";
  signedStatus: "Not Signed" | "Signed" | "Awaiting Signature";
  signedFileName?: string;
  signedFileType?: string;
  signedFileSize?: number;
  createdAt: string;

  // Storage integration fields
  uploadedFilePath?: string;
  signedFilePath?: string;
  companyLogoPath?: string;
  engineerSignaturePath?: string;
  generatedDocxPath?: string;
}

const sqlString = `-- Create Table
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

  -- RFI-specific fields
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

  -- File fields
  generated_docx_path text,
  signed_file_path text,
  signed_file_name text,
  signed_file_type text,
  signed_file_size bigint,
  company_logo_path text,

  -- General Document fields
  sender text,
  recipient text,
  subject text,
  description text,
  uploaded_file_path text,
  uploaded_file_name text,
  uploaded_file_type text,
  uploaded_file_size bigint,

  -- Audit fields
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE public.communication_documents ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_documents TO authenticated;

-- Policies
CREATE POLICY "Select communication documents" ON public.communication_documents
  FOR SELECT TO authenticated
  USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY "Insert communication documents" ON public.communication_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.verify_membership_access(company_id, project_id));

CREATE POLICY "Update communication documents" ON public.communication_documents
  FOR UPDATE TO authenticated
  USING (public.verify_membership_access(company_id, project_id));

CREATE POLICY "Delete communication documents" ON public.communication_documents
  FOR DELETE TO authenticated
  USING (public.verify_membership_access(company_id, project_id));

-- Storage Bucket setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('communication-documents', 'communication-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Select communication-documents storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'communication-documents' AND
    public.verify_membership_access(
      public.parse_path_uuid(split_part(name, '/', 1)),
      public.parse_path_uuid(split_part(name, '/', 2))
    )
  );

CREATE POLICY "Insert communication-documents storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'communication-documents' AND
    public.verify_membership_access(
      public.parse_path_uuid(split_part(name, '/', 1)),
      public.parse_path_uuid(split_part(name, '/', 2))
    )
  );

-- Update and Delete policies for completeness
CREATE POLICY "Update communication-documents storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'communication-documents' AND
    public.verify_membership_access(
      public.parse_path_uuid(split_part(name, '/', 1)),
      public.parse_path_uuid(split_part(name, '/', 2))
    )
  );

CREATE POLICY "Delete communication-documents storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'communication-documents' AND
    public.verify_membership_access(
      public.parse_path_uuid(split_part(name, '/', 1)),
      public.parse_path_uuid(split_part(name, '/', 2))
    )
  );

-- BACKWARDS COMPATIBILITY - Add columns if table already exists
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS sender text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS recipient text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS uploaded_file_path text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS uploaded_file_name text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS uploaded_file_type text;
ALTER TABLE public.communication_documents ADD COLUMN IF NOT EXISTS uploaded_file_size bigint;`;

function mapDbToRfi(row: any): RfiDocument {
  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    contractorCompany: row.contractor_company || "",
    consultantCompany: row.recipient_company || "",
    logoName: row.company_logo_path ? "Logo Uploaded" : "",
    logoBase64: row.company_logo_path || "",
    fromCompany: row.from_company || "",
    fromOriginator: row.originator || "",
    fromEmail: row.originator_email || "",
    toCompany: row.to_company || "",
    toAttention: row.attention || "",
    toEmail: row.recipient_email || "",
    rfiNumber: row.rfi_number || "",
    dateInitiated: row.date_initiated || "",
    contractNumber: row.contract_number || "",
    drawingNumber: row.drawing_number || "",
    specification: row.specification || "",
    pageNumber: row.page_number || "1 of 1",
    originatorName: row.originator || "",
    queryText: row.rfi_description || "",
    proposedAction: row.proposed_action || "",
    engineerResponse: row.engineer_response || "",
    decisionAccept: row.decision_accept || false,
    decisionAcceptWithComments: row.decision_accept_with_comments || false,
    decisionReject: row.decision_reject || false,
    decisionComments: row.decision_comments || "",
    engineerName: row.engineer_name || "",
    signatureName: row.engineer_signature_path ? "Signature Uploaded" : "",
    signatureBase64: row.engineer_signature_path || "",
    signDate: row.engineer_date || "",
    status: (row.status as any) || "Draft",
    signedStatus: (row.signed_status as any) || "Not Signed",
    signedFileName: row.signed_file_name || "",
    signedFileType: row.signed_file_type || "",
    signedFileSize:
      row.signed_file_size != null
        ? Number(row.signed_file_size)
        : undefined,
    createdAt: row.created_at || new Date().toISOString(),
    uploadedFilePath: row.uploaded_file_path || "",
    signedFilePath: row.signed_file_path || "",
    companyLogoPath: row.company_logo_path || "",
    engineerSignaturePath: row.engineer_signature_path || "",
    generatedDocxPath: row.generated_docx_path || ""
  };
}

function mapRfiToDb(rfi: RfiDocument, companyId: string, projectId: string) {
  return {
    company_id: companyId,
    project_id: projectId,
    folder_name: "rfi",
    document_type: "RFI",
    document_title: `RFI ${rfi.rfiNumber} - ${rfi.contractorCompany}`,
    document_number: rfi.rfiNumber,
    revision: "0",
    document_date: rfi.dateInitiated || new Date().toISOString().split("T")[0],
    status: rfi.status,
    signed_status: rfi.signedStatus,
    contractor_company: rfi.contractorCompany,
    recipient_company: rfi.consultantCompany,
    from_company: rfi.fromCompany,
    originator: rfi.originatorName || rfi.fromOriginator,
    originator_email: rfi.fromEmail,
    to_company: rfi.toCompany,
    attention: rfi.toAttention,
    recipient_email: rfi.toEmail,
    rfi_number: rfi.rfiNumber,
    date_initiated: rfi.dateInitiated || null,
    contract_number: rfi.contractNumber,
    drawing_number: rfi.drawingNumber,
    specification: rfi.specification,
    page_number: rfi.pageNumber,
    rfi_description: rfi.queryText,
    proposed_action: rfi.proposedAction,
    engineer_response: rfi.engineerResponse,
    decision_accept: rfi.decisionAccept,
    decision_accept_with_comments: rfi.decisionAcceptWithComments,
    decision_reject: rfi.decisionReject,
    decision_comments: rfi.decisionComments,
    engineer_name: rfi.engineerName,
    engineer_signature_path: rfi.signatureBase64 || null,
    engineer_date: rfi.signDate || null,
    company_logo_path: rfi.logoBase64 || null,
    signed_file_name: rfi.signedFileName || null
  };
}

interface RfiSubmoduleProps {
  onBack: () => void;
}

export default function RfiSubmodule({ onBack }: RfiSubmoduleProps) {
  const { profile, activeCompany, activeProject } = useOutletContext<any>() || {};

  const [rfis, setRfis] = useState<RfiDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRfi, setEditingRfi] = useState<RfiDocument | null>(null);
  const [viewingRfi, setViewingRfi] = useState<RfiDocument | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");

  // Deletion confirmation states
  const [rfiToDelete, setRfiToDelete] = useState<RfiDocument | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteDialogError, setDeleteDialogError] =
    useState<string | null>(null);
  const [isDeletingRfi, setIsDeletingRfi] = useState(false);

  // Supabase states
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [projectAdvisorWarning, setProjectAdvisorWarning] =
    useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Form Fields State
  const [contractorCompany, setContractorCompany] = useState("");
  const [consultantCompany, setConsultantCompany] = useState("");
  const [logoName, setLogoName] = useState("");
  const [logoBase64, setLogoBase64] = useState("");

  const [fromCompany, setFromCompany] = useState("");
  const [fromOriginator, setFromOriginator] = useState("");
  const [fromEmail, setFromEmail] = useState("");

  const [toCompany, setToCompany] = useState("");
  const [toAttention, setToAttention] = useState("");
  const [toEmail, setToEmail] = useState("");

  const [rfiNumber, setRfiNumber] = useState("");
  const [dateInitiated, setDateInitiated] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [drawingNumber, setDrawingNumber] = useState("");
  const [specification, setSpecification] = useState("");
  const [pageNumber, setPageNumber] = useState("1 of 1");

  const [originatorName, setOriginatorName] = useState("");
  const [queryText, setQueryText] = useState("");

  const [proposedAction, setProposedAction] = useState("");
  const [engineerResponse, setEngineerResponse] = useState("");

  const [decisionAccept, setDecisionAccept] = useState(false);
  const [decisionAcceptWithComments, setDecisionAcceptWithComments] = useState(false);
  const [decisionReject, setDecisionReject] = useState(false);
  const [decisionComments, setDecisionComments] = useState("");

  const [engineerName, setEngineerName] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureBase64, setSignatureBase64] = useState("");
  const [signDate, setSignDate] = useState("");

  const [status, setStatus] = useState<RfiDocument["status"]>("Draft");
  const [signedStatus, setSignedStatus] = useState<RfiDocument["signedStatus"]>("Not Signed");
  const [signedFileName, setSignedFileName] = useState("");

  // Hidden file input references
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const signedVersionInputRef = useRef<HTMLInputElement>(null);
  
  // RFI selected for signed file upload
  const [uploadingSignedRfiId, setUploadingSignedRfiId] = useState<string | null>(null);
  const [isSignedFileSaving, setIsSignedFileSaving] = useState(false);
  const [generatingDocxRfiId, setGeneratingDocxRfiId] =
    useState<string | null>(null);
  const generatedDocxOperationRef = useRef<string | null>(null);

  // Form Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadRfis = async () => {
    if (!activeCompany?.id || !activeProject?.id || activeProject.company_id !== activeCompany.id) {
      setRfis([]);
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setTableMissing(false);
    try {
      const { data, error } = await supabase
        .from("communication_documents")
        .select("*")
        .eq("company_id", activeProject.company_id)
        .eq("project_id", activeProject.id)
        .eq("folder_name", "rfi")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "PGRST116" || error.message?.toLowerCase().includes("does not exist")) {
          setTableMissing(true);
        }
        throw error;
      }

      const mapped = (data || []).map(mapDbToRfi);
      setRfis(mapped);
    } catch (err: any) {
      console.error("Error loading RFIs:", err);
      if (err.message?.toLowerCase().includes("does not exist")) {
        setTableMissing(true);
      } else {
        setErrorMsg("Failed to load RFIs: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRfis();
  }, [activeCompany?.id, activeProject?.id]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlString);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  const handleDownloadSignedFile = async (rfi: RfiDocument) => {
    assertOperationalAction("export", "pages/Communication/RfiSubmodule.tsx");
    if (!rfi.signedFilePath) return;
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.storage
        .from("communication-documents")
        .createSignedUrl(rfi.signedFilePath, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.download = rfi.signedFileName || "signed-rfi.pdf";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      setErrorMsg(
        "The signed RFI file could not be downloaded. Please try again.",
      );
    }
  };

  // Convert File to Base64 helper
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoBase64(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSignatureName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSignatureBase64(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload or replace the signed PDF/DOCX for a saved RFI row.
  const handleSignedVersionFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    rfiId: string,
  ) => {
    const input = e.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      setUploadingSignedRfiId(null);
      return;
    }

    if (isSignedFileSaving || generatedDocxOperationRef.current) {
      input.value = "";
      return;
    }

    const targetRfi = rfis.find((rfi) => rfi.id === rfiId);
    if (!targetRfi) {
      setErrorMsg(
        "The selected RFI could not be found. Refresh the page and try again.",
      );
      input.value = "";
      setUploadingSignedRfiId(null);
      return;
    }

    try {
      validateTenantContext(activeCompany, activeProject, profile);
    } catch {
      setErrorMsg(
        "The signed RFI file could not be saved because the active company or project is invalid.",
      );
      input.value = "";
      setUploadingSignedRfiId(null);
      return;
    }

    const companyId = activeProject?.company_id;
    const projectId = activeProject?.id;
    if (
      !companyId ||
      !projectId ||
      targetRfi.companyId !== companyId ||
      targetRfi.projectId !== projectId
    ) {
      setErrorMsg(
        "The signed RFI file could not be saved because the active company or project does not match this record.",
      );
      input.value = "";
      setUploadingSignedRfiId(null);
      return;
    }

    setIsSignedFileSaving(true);
    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProjectAdvisorWarning(null);

    try {
      const result = await saveSignedRfiFileLifecycle({
        documentId: targetRfi.id,
        companyId: targetRfi.companyId,
        projectId: targetRfi.projectId,
        file,
        existingRfi: {
          id: targetRfi.id,
          companyId: targetRfi.companyId,
          projectId: targetRfi.projectId,
          signedFilePath: targetRfi.signedFilePath,
          uploadedFilePath: targetRfi.uploadedFilePath,
          generatedDocxPath: targetRfi.generatedDocxPath,
        },
      });

      if (!result.success || !result.storagePath) {
        setErrorMsg(
          result.error ||
            "The signed RFI file could not be uploaded safely. Please try again.",
        );
        return;
      }

      setRfis((current) =>
        current.map((rfi) =>
          rfi.id === targetRfi.id
            ? {
              ...rfi,
              signedStatus: "Signed",
              signedFilePath: result.storagePath,
              signedFileName: result.signedFileName,
              signedFileType: result.signedFileType,
              signedFileSize: result.signedFileSize,
              status: "Closed",
            }
            : rfi
        )
      );
      setSuccessMsg(
        result.message || "The signed RFI file was uploaded successfully.",
      );
      setProjectAdvisorWarning(result.warning || null);
      await loadRfis();
    } catch {
      setErrorMsg(
        "The signed RFI file could not be uploaded safely. Please try again.",
      );
    } finally {
      input.value = "";
      setUploadingSignedRfiId(null);
      setIsSignedFileSaving(false);
      setIsActionLoading(false);
    }
  };

  const openNewForm = () => {
    setEditingRfi(null);
    setErrors({});
    
    // Default values matching template standard
    setContractorCompany("");
    setConsultantCompany("");
    setLogoName("");
    setLogoBase64("");

    setFromCompany("");
    setFromOriginator("");
    setFromEmail("");

    setToCompany("");
    setToAttention("");
    setToEmail("");

    // Auto-generate a sequential RFI Number
    const nextNum = rfis.length + 1;
    setRfiNumber(`RFI-${String(nextNum).padStart(3, "0")}`);
    setDateInitiated(new Date().toISOString().split("T")[0]);
    setContractNumber("JW14404H");
    setDrawingNumber("");
    setSpecification("");
    setPageNumber("1 of 1");

    setOriginatorName("");
    setQueryText("");

    setProposedAction("");
    setEngineerResponse("");

    setDecisionAccept(false);
    setDecisionAcceptWithComments(false);
    setDecisionReject(false);
    setDecisionComments("");

    setEngineerName("");
    setSignatureName("");
    setSignatureBase64("");
    setSignDate("");

    setStatus("Draft");
    setSignedStatus("Not Signed");
    setSignedFileName("");

    setIsFormOpen(true);
  };

  const openEditForm = (rfi: RfiDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRfi(rfi);
    setErrors({});

    setContractorCompany(rfi.contractorCompany || "");
    setConsultantCompany(rfi.consultantCompany || "");
    setLogoName(rfi.logoName || "");
    setLogoBase64(rfi.logoBase64 || "");

    setFromCompany(rfi.fromCompany || "");
    setFromOriginator(rfi.fromOriginator || "");
    setFromEmail(rfi.fromEmail || "");

    setToCompany(rfi.toCompany || "");
    setToAttention(rfi.toAttention || "");
    setToEmail(rfi.toEmail || "");

    setRfiNumber(rfi.rfiNumber || "");
    setDateInitiated(rfi.dateInitiated || "");
    setContractNumber(rfi.contractNumber || "");
    setDrawingNumber(rfi.drawingNumber || "");
    setSpecification(rfi.specification || "");
    setPageNumber(rfi.pageNumber || "1 of 1");

    setOriginatorName(rfi.originatorName || "");
    setQueryText(rfi.queryText || "");

    setProposedAction(rfi.proposedAction || "");
    setEngineerResponse(rfi.engineerResponse || "");

    setDecisionAccept(rfi.decisionAccept || false);
    setDecisionAcceptWithComments(rfi.decisionAcceptWithComments || false);
    setDecisionReject(rfi.decisionReject || false);
    setDecisionComments(rfi.decisionComments || "");

    setEngineerName(rfi.engineerName || "");
    setSignatureName(rfi.signatureName || "");
    setSignatureBase64(rfi.signatureBase64 || "");
    setSignDate(rfi.signDate || "");

    setStatus(rfi.status || "Draft");
    setSignedStatus(rfi.signedStatus || "Not Signed");
    setSignedFileName(rfi.signedFileName || "");

    setIsFormOpen(true);
  };

  const handleSaveRfi = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Communication/RfiSubmodule.tsx");
    e.preventDefault();

    // Validation
    const formErrors: Record<string, string> = {};
    if (!contractorCompany.trim()) formErrors.contractorCompany = "Contractor company name is required";
    if (!consultantCompany.trim()) formErrors.consultantCompany = "Consultant company name is required";
    
    if (!fromCompany.trim()) formErrors.fromCompany = "From Company is required";
    if (!fromOriginator.trim()) formErrors.fromOriginator = "Originator is required";
    if (!fromEmail.trim()) formErrors.fromEmail = "Originator Email is required";

    if (!toCompany.trim()) formErrors.toCompany = "To Company is required";
    if (!toAttention.trim()) formErrors.toAttention = "Attention contact is required";
    if (!toEmail.trim()) formErrors.toEmail = "Recipient Email is required";

    if (!rfiNumber.trim()) formErrors.rfiNumber = "RFI Number is required";
    if (!dateInitiated.trim()) formErrors.dateInitiated = "Date Initiated is required";
    if (!contractNumber.trim()) formErrors.contractNumber = "Contract Number is required";
    if (!originatorName.trim()) formErrors.originatorName = "Originator Section name is required";
    if (!queryText.trim()) formErrors.queryText = "RFI Description / Query query text is required";

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      alert("Please fix the validation errors before saving the RFI.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      validateTenantContext(activeCompany, activeProject, profile);
    } catch (err: any) {
      alert(err.message);
      return;
    }

    setIsActionLoading(true);

    const isEditing = !!editingRfi;

    const rfiDocPayload: RfiDocument = {
      id: isEditing ? editingRfi.id : "",
      companyId: activeProject.company_id,
      projectId: activeProject.id,
      contractorCompany,
      consultantCompany,
      logoName,
      logoBase64,
      fromCompany,
      fromOriginator,
      fromEmail,
      toCompany,
      toAttention,
      toEmail,
      rfiNumber,
      dateInitiated,
      contractNumber,
      drawingNumber,
      specification,
      pageNumber,
      originatorName,
      queryText,
      proposedAction,
      engineerResponse,
      decisionAccept,
      decisionAcceptWithComments,
      decisionReject,
      decisionComments,
      engineerName,
      signatureName,
      signatureBase64,
      signDate,
      status,
      signedStatus,
      signedFileName,
      createdAt: isEditing ? editingRfi.createdAt : new Date().toISOString()
    };

    const dbPayload = mapRfiToDb(rfiDocPayload, activeProject.company_id, activeProject.id);

    try {
      if (isEditing) {
        const { error } = await supabase
          .from("communication_documents")
          .update(dbPayload)
          .eq("id", editingRfi.id);

        if (error) throw error;
        setSuccessMsg("RFI updated successfully.");
      } else {
        const { error } = await supabase
          .from("communication_documents")
          .insert([dbPayload]);

        if (error) throw error;
        setSuccessMsg("RFI created successfully.");
      }

      setIsFormOpen(false);
      setEditingRfi(null);
      await loadRfis();
    } catch (err: any) {
      console.error("Error saving RFI:", err);
      setErrorMsg("Failed to save RFI: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteClick = (item: RfiDocument, e: React.MouseEvent) => {
    assertOperationalAction("delete", "pages/Communication/RfiSubmodule.tsx");
    e.stopPropagation();

    if (!item || !item.id || typeof item.id !== "string" || item.id.trim() === "") {
      setErrorMsg(
        "The selected RFI could not be deleted because its record ID is invalid.",
      );
      return;
    }

    setDeleteDialogError(null);
    setRfiToDelete(item);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (isDeletingRfi) {
      return;
    }

    if (!rfiToDelete?.id) {
      setDeleteDialogError(
        "The RFI could not be deleted safely. No deletion steps were completed. Please try again.",
      );
      return;
    }

    try {
      validateTenantContext(activeCompany, activeProject, profile);
    } catch {
      setDeleteDialogError(
        "The RFI could not be deleted because the active company or project is invalid.",
      );
      return;
    }

    if (
      rfiToDelete.companyId !== activeProject?.company_id ||
      rfiToDelete.projectId !== activeProject?.id ||
      activeProject?.company_id !== activeCompany?.id
    ) {
      setDeleteDialogError(
        "The RFI could not be deleted because it does not belong to the active company and project.",
      );
      return;
    }

    setIsDeletingRfi(true);
    setIsActionLoading(true);
    setDeleteDialogError(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const documentId = rfiToDelete.id;
      const result = await deleteCommunicationDocumentFileLifecycle({
        documentId,
        companyId: rfiToDelete.companyId,
        projectId: rfiToDelete.projectId,
        uploadedFilePath: rfiToDelete.uploadedFilePath,
        signedFilePath: rfiToDelete.signedFilePath,
        generatedDocxPath: rfiToDelete.generatedDocxPath,
      });

      if (!result.success) {
        setDeleteDialogError(
          result.error ||
            "The RFI could not be deleted safely. No further deletion steps were completed. Please try again.",
        );
        return;
      }

      setRfis((current) =>
        current.filter((rfi) => rfi.id !== documentId)
      );
      setSuccessMsg(
        "The RFI record, linked files and Project Advisor indexes were deleted successfully.",
      );
      setProjectAdvisorWarning(null);
      setShowDeleteDialog(false);
      setRfiToDelete(null);
      setDeleteDialogError(null);
      await loadRfis();
    } catch {
      setDeleteDialogError(
        "The RFI could not be deleted safely. No further deletion steps were completed. Please try again.",
      );
    } finally {
      setIsDeletingRfi(false);
      setIsActionLoading(false);
    }
  };

  const handleDownloadDocx = async (rfi: RfiDocument, e: React.MouseEvent) => {
    assertOperationalAction("export", "pages/Communication/RfiSubmodule.tsx");
    e.stopPropagation();

    if (generatedDocxOperationRef.current) {
      return;
    }

    if (!rfi?.id || typeof rfi.id !== "string" || rfi.id.trim() === "") {
      setErrorMsg(
        "The selected RFI DOCX could not be generated because its record ID is invalid.",
      );
      return;
    }

    try {
      validateTenantContext(activeCompany, activeProject, profile);
    } catch {
      setErrorMsg(
        "The RFI DOCX could not be generated because the active company or project is invalid.",
      );
      return;
    }

    const companyId = activeProject?.company_id;
    const projectId = activeProject?.id;
    if (
      !companyId ||
      !projectId ||
      activeCompany?.id !== companyId ||
      rfi.companyId !== companyId ||
      rfi.projectId !== projectId
    ) {
      setErrorMsg(
        "The RFI DOCX could not be generated because this record does not belong to the active company and project.",
      );
      return;
    }

    generatedDocxOperationRef.current = rfi.id;
    setGeneratingDocxRfiId(rfi.id);
    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProjectAdvisorWarning(null);

    try {
      // Create custom cell borders
      const borderNone = { style: BorderStyle.NONE, size: 0, color: "auto" };
      const borderThin = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
      const borderThick = { style: BorderStyle.SINGLE, size: 8, color: "07182E" };

      // Set decision markers
      const acceptMark = rfi.decisionAccept ? "[ X ]" : "[   ]";
      const acceptCommentsMark = rfi.decisionAcceptWithComments ? "[ X ]" : "[   ]";
      const rejectMark = rfi.decisionReject ? "[ X ]" : "[   ]";

      // Initialize document
      const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Company Header Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: {
                        top: borderThick, bottom: borderThin, left: borderThick, right: borderThin
                      },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: rfi.contractorCompany.toUpperCase() || "CONTRACTOR", bold: true, size: 24, color: "07182E" })
                          ]
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: "REQUEST FOR INFORMATION", bold: true, size: 20, color: "FF9F1C" })
                          ]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: {
                        top: borderThick, bottom: borderThin, left: borderThin, right: borderThick
                      },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "CONSULTANT / RECIPIENT:", bold: true, size: 18, color: "64748B" })
                          ]
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: rfi.consultantCompany || "N/A", bold: true, size: 22, color: "07182E" })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }), // Spacing

            // RFI details table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThin, left: borderThick, right: borderThin },
                      children: [new Paragraph({ children: [new TextRun({ text: "RFI NUMBER", bold: true, size: 16 }), new TextRun({ text: `\n${rfi.rfiNumber}`, size: 18, bold: true, color: "FF9F1C" })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin },
                      children: [new Paragraph({ children: [new TextRun({ text: "DATE INITIATED", bold: true, size: 16 }), new TextRun({ text: `\n${rfi.dateInitiated}`, size: 18 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin },
                      children: [new Paragraph({ children: [new TextRun({ text: "CONTRACT NO", bold: true, size: 16 }), new TextRun({ text: `\n${rfi.contractNumber}`, size: 18 })] })]
                    }),
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThin, left: borderThin, right: borderThick },
                      children: [new Paragraph({ children: [new TextRun({ text: "PAGE NUMBER", bold: true, size: 16 }), new TextRun({ text: `\n${rfi.pageNumber}`, size: 18 })] })]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }), // Spacing

            // From / To Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThin, left: borderThick, right: borderThin },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "FROM (CONTRACTOR)", bold: true, size: 16, color: "07182E" })] }),
                        new Paragraph({ children: [new TextRun({ text: `Company: ${rfi.fromCompany}`, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: `Originator: ${rfi.fromOriginator}`, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: `Email: ${rfi.fromEmail}`, size: 18 })] })
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThin, left: borderThin, right: borderThick },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "TO (RECIPIENT)", bold: true, size: 16, color: "07182E" })] }),
                        new Paragraph({ children: [new TextRun({ text: `Company: ${rfi.toCompany}`, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: `Attention: ${rfi.toAttention}`, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: `Email: ${rfi.toEmail}`, size: 18 })] })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }), // Spacing

            // Reference Specs Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThin, left: borderThick, right: borderThin },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "DRAWING NUMBER", bold: true, size: 16 })] }),
                        new Paragraph({ children: [new TextRun({ text: rfi.drawingNumber || "N/A", size: 18 })] })
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThin, left: borderThin, right: borderThick },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "SPECIFICATION / BILL OF QUANTITY", bold: true, size: 16 })] }),
                        new Paragraph({ children: [new TextRun({ text: rfi.specification || "N/A", size: 18 })] })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }), // Spacing

            // Originator Query Text Box
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: { top: borderThick, bottom: borderThin, left: borderThick, right: borderThick },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "1.0 ORIGINATOR SECTION / DETAILED QUERY", bold: true, size: 18, color: "07182E" })] }),
                        new Paragraph({ children: [new TextRun({ text: `Originator Name: ${rfi.originatorName}`, bold: true, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: `\n${rfi.queryText}`, size: 18 })] })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }),

            // Proposed Action Section
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: { top: borderThin, bottom: borderThin, left: borderThick, right: borderThick },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "2.0 CONTRACTOR PROPOSED ACTION / ALIGNMENT SUGGESTION", bold: true, size: 18, color: "07182E" })] }),
                        new Paragraph({ children: [new TextRun({ text: rfi.proposedAction || "No action suggested by contractor.", size: 18 })] })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }),

            // Engineer Response Section
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: { top: borderThin, bottom: borderThin, left: borderThick, right: borderThick },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "3.0 ENGINEER / RECIPIENT OFFICIAL RESPONSE", bold: true, size: 18, color: "07182E" })] }),
                        new Paragraph({ children: [new TextRun({ text: rfi.engineerResponse || "Response pending evaluation.", size: 18 })] })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }),

            // Engineering Decision Box
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: { top: borderThin, bottom: borderThin, left: borderThick, right: borderThick },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "4.0 ENGINEERING DECISION & STATUS METRICS", bold: true, size: 18, color: "07182E" })] }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: `${acceptMark} ACCEPTED   `, bold: rfi.decisionAccept, size: 18 }),
                            new TextRun({ text: `${acceptCommentsMark} ACCEPTED WITH COMMENTS   `, bold: rfi.decisionAcceptWithComments, size: 18 }),
                            new TextRun({ text: `${rejectMark} REJECTED`, bold: rfi.decisionReject, size: 18 })
                          ]
                        }),
                        new Paragraph({ children: [new TextRun({ text: `\nDecision Comments: ${rfi.decisionComments || "None"}`, size: 18 })] })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }),

            // Signoff Section
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThick, left: borderThick, right: borderThin },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "5.0 OFFICIAL SIGN-OFF", bold: true, size: 18, color: "07182E" })] }),
                        new Paragraph({ children: [new TextRun({ text: `Engineer Name: ${rfi.engineerName || "Pending"}`, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: `Signature Status: ${rfi.signatureName ? "Signed electronically" : "Awaiting signature"}`, size: 18 })] })
                      ]
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: { top: borderThin, bottom: borderThick, left: borderThin, right: borderThick },
                      children: [
                        new Paragraph({ children: [new TextRun({ text: "SIGN DATE", bold: true, size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: rfi.signDate || "N/A", size: 18 })] }),
                        new Paragraph({ children: [new TextRun({ text: `\nStatus: ${rfi.status}`, bold: true, size: 18, color: "FF9F1C" })] })
                      ]
                    })
                  ]
                })
              ]
            }),

            new Paragraph({ text: "" }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Page 1 of 1  •  ProjectMatrix Automated Contract Management Register", size: 14, color: "94A3B8" })
              ]
            })
          ]
        }
      ]
    });

      const packedBlob = await Packer.toBlob(doc);
      const blob =
        packedBlob.type.trim().toLowerCase() ===
            GENERATED_RFI_DOCX_MIME_TYPE
          ? packedBlob
          : packedBlob.slice(
            0,
            packedBlob.size,
            GENERATED_RFI_DOCX_MIME_TYPE,
          );
      const requestedFileName =
        `RFI-${rfi.rfiNumber || "RFI"}-${rfi.contractNumber || "JW14404H"}.docx`;
      const result = await saveGeneratedRfiDocxLifecycle({
        documentId: rfi.id,
        companyId,
        projectId,
        docxBlob: blob,
        fileName: requestedFileName,
        existingRfi: {
          id: rfi.id,
          companyId: rfi.companyId,
          projectId: rfi.projectId,
          generatedDocxPath: rfi.generatedDocxPath,
          uploadedFilePath: rfi.uploadedFilePath,
          signedFilePath: rfi.signedFilePath,
        },
      });

      if (!result.success || !result.storagePath || !result.fileName) {
        setErrorMsg(
          result.error ||
            "The RFI DOCX could not be generated and saved safely. Please try again.",
        );
        return;
      }

      setRfis((current) =>
        current.map((item) =>
          item.id === rfi.id
            ? { ...item, generatedDocxPath: result.storagePath }
            : item
        )
      );
      setViewingRfi((current) =>
        current?.id === rfi.id
          ? { ...current, generatedDocxPath: result.storagePath }
          : current
      );
      setProjectAdvisorWarning(result.warning || null);

      let downloadUrl: string | null = null;
      let downloadAnchor: HTMLAnchorElement | null = null;
      try {
        downloadUrl = window.URL.createObjectURL(blob);
        downloadAnchor = document.createElement("a");
        downloadAnchor.href = downloadUrl;
        downloadAnchor.download = result.fileName;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        setSuccessMsg(
          "The RFI DOCX was generated, saved and downloaded successfully.",
        );
      } catch {
        setSuccessMsg(
          result.message || "The RFI DOCX was generated and saved successfully.",
        );
        setErrorMsg(
          "The RFI DOCX was saved, but the browser download could not start. Please try the download again.",
        );
      } finally {
        if (downloadAnchor?.parentNode) {
          downloadAnchor.parentNode.removeChild(downloadAnchor);
        }
        if (downloadUrl) {
          window.URL.revokeObjectURL(downloadUrl);
        }
      }
    } catch {
      setErrorMsg(
        "The RFI DOCX could not be generated safely. The existing generated document was preserved. Please try again.",
      );
    } finally {
      generatedDocxOperationRef.current = null;
      setGeneratingDocxRfiId(null);
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (s: RfiDocument["status"]) => {
    switch (s) {
      case "Accepted":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Rejected":
        return "bg-rose-50 text-rose-700 border-rose-100";
      case "Under Review":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "Closed":
        return "bg-[#07182E]/5 text-[#07182E] border-[#07182E]/10";
      case "Draft":
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const formatSubmissionTimestamp = (dateInitiated?: string, createdAt?: string) => {
    if (!dateInitiated && !createdAt) return { formatted: "N/A", pendingText: "", fullTimestamp: "N/A" };
    
    const dateObj = createdAt ? new Date(createdAt) : (dateInitiated ? new Date(dateInitiated) : new Date());
    const isValidDate = !isNaN(dateObj.getTime());
    
    const dateOnly = isValidDate
      ? dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : (dateInitiated || "N/A");
      
    const fullTimestamp = isValidDate
      ? `${dateOnly}${createdAt ? `, ${dateObj.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}`
      : (dateInitiated || "N/A");

    let pendingText = "";
    if (isValidDate) {
      const diffMs = Math.max(0, Date.now() - dateObj.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      
      if (days > 0) {
        pendingText = `${days}d ${remHours}h pending`;
      } else if (hours > 0) {
        pendingText = `${hours}h pending`;
      } else {
        pendingText = "< 1h pending";
      }
    }

    return { formatted: dateOnly, fullTimestamp, pendingText };
  };

  const getSignedBadge = (s: RfiDocument["signedStatus"]) => {
    switch (s) {
      case "Signed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Awaiting Signature":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Not Signed":
      default:
        return "bg-slate-100 text-slate-500 border-slate-200";
    }
  };

  const filteredRfis = rfis.filter((rfi) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      rfi.rfiNumber.toLowerCase().includes(q) ||
      rfi.specification.toLowerCase().includes(q) ||
      rfi.drawingNumber.toLowerCase().includes(q) ||
      rfi.originatorName.toLowerCase().includes(q) ||
      rfi.queryText.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Registry main view wrapper */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-[0px_8px_24px_rgba(7,24,46,0.03)] space-y-6">
        
        {/* Sub-Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-[#07182E] hover:bg-slate-50 transition-colors cursor-pointer"
              title="Back to Communication"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <div>
              <h2 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wide flex items-center gap-1.5">
                RFI Document Register
              </h2>
              <p className="text-[11px] text-slate-400 font-semibold">
                Contractual Request For Information (PDF Standard) correspondence records.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search RFIs..."
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

            <button
              onClick={openNewForm}
              className="w-full sm:w-auto px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#FF9F1C]/15 hover:shadow-[#FF9F1C]/35 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Upload RFI
            </button>
          </div>
        </div>

        {/* Alerts / Loading states */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-800">System Error</p>
              <p className="text-[11px] text-rose-600 font-semibold">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-800">Success</p>
              <p className="text-[11px] text-emerald-600 font-semibold">{successMsg}</p>
            </div>
          </div>
        )}

        {projectAdvisorWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900">
                Project Advisor Warning
              </p>
              <p className="text-[11px] text-amber-700 font-semibold">
                {projectAdvisorWarning}
              </p>
            </div>
          </div>
        )}

        {tableMissing && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                  Database Table Missing
                </h4>
                <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
                  The <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">communication_documents</code> table and its policy schemas are not initialized yet. Copy the SQL script below and execute it inside your Supabase SQL Editor.
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
                {sqlString}
              </pre>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-4 border-[#FF9F1C] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              Loading RFI documents...
            </p>
          </div>
        )}

        {isActionLoading && (
          <div className="py-4 flex flex-col items-center justify-center space-y-2 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="w-5 h-5 border-2 border-[#FF9F1C] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Executing database action...
            </p>
          </div>
        )}

        {/* Hidden Signed File Upload Trigger */}
        <input
          type="file"
          ref={signedVersionInputRef}
          accept=".pdf,.docx"
          disabled={isSignedFileSaving || generatingDocxRfiId !== null}
          className="hidden"
          onChange={(e) => {
            if (uploadingSignedRfiId) {
              void handleSignedVersionFile(e, uploadingSignedRfiId);
            }
          }}
        />

        {/* List / Table Area */}
        {!tableMissing && (rfis.length === 0 || filteredRfis.length === 0) ? (
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-12 text-center flex flex-col justify-center items-center space-y-4">
            <div className="p-4 bg-white rounded-full shadow-xs border border-slate-150">
              <FileText className="w-8 h-8 text-[#FF9F1C]" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h4 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wide">
                {rfis.length === 0 ? "No Documents Uploaded" : "No RFIs Found"}
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                {rfis.length === 0
                  ? "No communication documents uploaded in this folder yet."
                  : "No communication documents match your search query."}
              </p>
            </div>
            {rfis.length === 0 && (
              <button
                onClick={openNewForm}
                className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Upload RFI
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider bg-slate-50/70">
                  <th className="py-3 px-4">RFI Number</th>
                  <th className="py-3 px-4">Submission & Elapsed</th>
                  <th className="py-3 px-4">Drawing No</th>
                  <th className="py-3 px-4">Specification</th>
                  <th className="py-3 px-4">Originator</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Signed Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                {filteredRfis.map((item) => {
                  const stamp = formatSubmissionTimestamp(item.dateInitiated, item.createdAt);
                  return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => setViewingRfi(item)}
                  >
                    <td className="py-4 px-4 font-black font-mono text-[#07182E]">
                      {item.rfiNumber}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[#07182E] font-bold text-[11px]">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{stamp.fullTimestamp}</span>
                        </div>
                        {stamp.pendingText && item.status !== "Accepted" && item.status !== "Closed" && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 font-bold">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span>{stamp.pendingText}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 truncate max-w-[120px]" title={item.drawingNumber}>
                      {item.drawingNumber || "N/A"}
                    </td>
                    <td className="py-4 px-4 truncate max-w-[150px]" title={item.specification}>
                      {item.specification || "N/A"}
                    </td>
                    <td className="py-4 px-4 text-[#07182E] font-bold">
                      {item.originatorName}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded-lg ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-4" onClick={(e) => {
                      if (item.signedFilePath) {
                        e.stopPropagation();
                        handleDownloadSignedFile(item);
                      }
                    }}>
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex px-2 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded-lg ${item.signedFilePath ? "cursor-pointer hover:bg-slate-200" : ""} ${getSignedBadge(item.signedStatus)}`} title={item.signedFilePath ? "Click to download signed version" : undefined}>
                          {item.signedStatus}
                        </span>
                        {item.signedFileName && (
                          <span className="text-[9px] text-emerald-600 font-bold max-w-[110px] truncate hover:underline cursor-pointer" title="Click to download signed version">
                            {item.signedFileName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        {/* View */}
                        <button
                          onClick={() => setViewingRfi(item)}
                          className="p-1.5 text-slate-400 hover:text-[#07182E] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View PDF Template Layout"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {/* Edit */}
                        <button
                          onClick={(e) => openEditForm(item, e)}
                          className="p-1.5 text-slate-400 hover:text-[#FF9F1C] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit RFI Data"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete/Dustbin Button */}
                        <button
                          onClick={(e) => handleDeleteClick(item, e)}
                          disabled={
                            isDeletingRfi ||
                            isSignedFileSaving ||
                            generatingDocxRfiId !== null
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                          title="Delete RFI"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* DOCX */}
                        <button
                          onClick={(e) => handleDownloadDocx(item, e)}
                          disabled={
                            generatingDocxRfiId !== null ||
                            isDeletingRfi ||
                            isSignedFileSaving
                          }
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                          title={
                            item.generatedDocxPath
                              ? "Regenerate, save, index and download Word document"
                              : "Generate, save, index and download Word document"
                          }
                        >
                          {generatingDocxRfiId === item.id ? (
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {/* Upload signed placeholder */}
                        <button
                          onClick={() => {
                            if (
                              isSignedFileSaving ||
                              isDeletingRfi ||
                              generatingDocxRfiId !== null
                            ) {
                              return;
                            }
                            setUploadingSignedRfiId(item.id);
                            if (signedVersionInputRef.current) {
                              signedVersionInputRef.current.value = "";
                              signedVersionInputRef.current.click();
                            }
                          }}
                          disabled={
                            isSignedFileSaving ||
                            isDeletingRfi ||
                            generatingDocxRfiId !== null
                          }
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                          title="Upload Signed PDF/DOCX Version"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleSaveRfi}
            className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-[840px] max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
          >
            {/* Header */}
            <div className="bg-[#07182E] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <FileText className="w-5 h-5 text-[#FF9F1C]" />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF9F1C]">
                    {editingRfi ? "Modification Mode" : "Creation Mode"}
                  </span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">
                    {editingRfi ? `Edit RFI - ${editingRfi.rfiNumber}` : "Initiate Standard RFI Document"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sticky Tab Selectors */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-extrabold uppercase text-[#07182E] tracking-wider">RFI Document Template Fields</span>
              <span className="text-[9px] text-slate-400 font-bold">PDF Format Aligned</span>
            </div>

            {/* Scrollable Form Body */}
            <div
              className="p-6 space-y-6 overflow-y-auto pb-[120px]"
              style={{ maxHeight: "calc(90vh - 180px)" }}
            >
              {/* SECTION 1: HEADER & LOGO */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                  <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">1</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">Header &amp; Corporate Details</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Contractor Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BuildSmith Civil Contractors Ltd"
                      value={contractorCompany}
                      onChange={(e) => {
                        setContractorCompany(e.target.value);
                        if (errors.contractorCompany) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.contractorCompany;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold outline-none transition-all ${
                        errors.contractorCompany ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:border-[#FF9F1C] focus:ring-2"
                      }`}
                    />
                    {errors.contractorCompany && (
                      <span className="text-[10px] text-rose-500 font-bold mt-1 block">{errors.contractorCompany}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Consultant / Recipient Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Structural Consulting Engineers"
                      value={consultantCompany}
                      onChange={(e) => {
                        setConsultantCompany(e.target.value);
                        if (errors.consultantCompany) {
                          setErrors((prev) => {
                            const copy = { ...prev };
                            delete copy.consultantCompany;
                            return copy;
                          });
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold outline-none transition-all ${
                        errors.consultantCompany ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:border-[#FF9F1C] focus:ring-2"
                      }`}
                    />
                    {errors.consultantCompany && (
                      <span className="text-[10px] text-rose-500 font-bold mt-1 block">{errors.consultantCompany}</span>
                    )}
                  </div>

                  {/* Logo upload field */}
                  <div className="sm:col-span-2">
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Contractor Corporate Logo Upload
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-lg border border-slate-300 cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Image
                      </button>
                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      {logoName ? (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-lg">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[10px] text-emerald-800 font-black truncate max-w-[200px]" title={logoName}>
                            {logoName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">Optional logo image. (PNG / JPG)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: FROM & TO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* From Block */}
                <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                  <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                    <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">2</span>
                    <h4 className="text-[11px] font-black uppercase tracking-wider">From Details (Originating Team)</h4>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. BuildSmith Civil Contractors Ltd"
                        value={fromCompany}
                        onChange={(e) => setFromCompany(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1">
                        Originator Person *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Jack Williams (Lead Civil)"
                        value={fromOriginator}
                        onChange={(e) => setFromOriginator(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. j.williams@buildsmith.com"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                      />
                    </div>
                  </div>
                </div>

                {/* To Block */}
                <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                  <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                    <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">3</span>
                    <h4 className="text-[11px] font-black uppercase tracking-wider">To Details (Intended Recipient)</h4>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Apex Structural Consulting Engineers"
                        value={toCompany}
                        onChange={(e) => setToCompany(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1">
                        Attention To *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sarah Connor (Senior Consultant)"
                        value={toAttention}
                        onChange={(e) => setToAttention(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider block mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. s.connor@apexconsulting.com"
                        value={toEmail}
                        onChange={(e) => setToEmail(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: RFI DETAILS & METRICS */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                  <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">4</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">RFI Standard Reference details</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      RFI Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. RFI-001"
                      value={rfiNumber}
                      onChange={(e) => setRfiNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Date Initiated *
                    </label>
                    <input
                      type="date"
                      required
                      value={dateInitiated}
                      onChange={(e) => setDateInitiated(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Contract Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. JW14404H"
                      value={contractNumber}
                      onChange={(e) => setContractNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Drawing Number / Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DS-CIV-S01-A"
                      value={drawingNumber}
                      onChange={(e) => setDrawingNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Specification Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Section 12C Clause 4.2"
                      value={specification}
                      onChange={(e) => setSpecification(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Page Formatting (Template)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1 of 1"
                      value={pageNumber}
                      onChange={(e) => setPageNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: ORIGINATOR & QUERY */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                  <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">5</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">Originator Section &amp; Query Statement</h4>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Originator Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jack Williams"
                      value={originatorName}
                      onChange={(e) => setOriginatorName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      RFI Detailed Query text *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="e.g. Reinforcement detailing shown in drawing DS-CIV-S01-A clashes with existing precast sleeve anchors. Please clarify alignment requirement."
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: PROPOSED ACTION */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                  <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">6</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">Contractor Proposed Action</h4>
                </div>

                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Proposed Action / Suggestion Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. We propose shifting precast anchor bolts by 35mm eastwards to clear clash. This does not alter structural loads."
                    value={proposedAction}
                    onChange={(e) => setProposedAction(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                  />
                </div>
              </div>

              {/* SECTION 6: ENGINEER RESPONSE */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                  <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">7</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">Engineer Response (If received)</h4>
                </div>

                <div>
                  <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                    Consulting Engineer Official Response text
                  </label>
                  <textarea
                    rows={2.5}
                    placeholder="Enter formal engineer evaluation or response details..."
                    value={engineerResponse}
                    onChange={(e) => setEngineerResponse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                  />
                </div>
              </div>

              {/* SECTION 7: ENGINEERING DECISION */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                  <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">8</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">Engineering Decision Fields</h4>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 items-center bg-white p-3 border border-slate-200 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={decisionAccept}
                        onChange={(e) => {
                          setDecisionAccept(e.target.checked);
                          if (e.target.checked) {
                            setDecisionAcceptWithComments(false);
                            setDecisionReject(false);
                          }
                        }}
                        className="rounded border-slate-300 text-[#FF9F1C] focus:ring-[#FF9F1C]"
                      />
                      Accept
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={decisionAcceptWithComments}
                        onChange={(e) => {
                          setDecisionAcceptWithComments(e.target.checked);
                          if (e.target.checked) {
                            setDecisionAccept(false);
                            setDecisionReject(false);
                          }
                        }}
                        className="rounded border-slate-300 text-[#FF9F1C] focus:ring-[#FF9F1C]"
                      />
                      Accept with Comments
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={decisionReject}
                        onChange={(e) => {
                          setDecisionReject(e.target.checked);
                          if (e.target.checked) {
                            setDecisionAccept(false);
                            setDecisionAcceptWithComments(false);
                          }
                        }}
                        className="rounded border-slate-300 text-[#FF9F1C] focus:ring-[#FF9F1C]"
                      />
                      Reject
                    </label>
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Engineering Decision Comments / Conditions
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter formal notes or contractual implications of this decision..."
                      value={decisionComments}
                      onChange={(e) => setDecisionComments(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 8: SIGN-OFF */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                  <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">9</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">Official Sign-off &amp; Status</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Engineer Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Connor (PE)"
                      value={engineerName}
                      onChange={(e) => setEngineerName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Sign Date
                    </label>
                    <input
                      type="date"
                      value={signDate}
                      onChange={(e) => setSignDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  {/* Signature Upload */}
                  <div className="sm:col-span-2">
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Engineer Digital Signature Upload
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => signatureInputRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-lg border border-slate-300 cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Signature File
                      </button>
                      <input
                        type="file"
                        ref={signatureInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleSignatureUpload}
                      />
                      {signatureName ? (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-lg">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[10px] text-emerald-800 font-black truncate max-w-[200px]" title={signatureName}>
                            {signatureName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">Optional signature png.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RFI METADATA STATUS */}
              <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center gap-1.5 text-[#07182E]">
                  <span className="text-[10px] font-extrabold bg-[#07182E] text-white px-1.5 py-0.5 rounded">10</span>
                  <h4 className="text-[11px] font-black uppercase tracking-wider">Contractual Status Parameters</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      RFI Status *
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as RfiDocument["status"])}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold outline-none cursor-pointer focus:border-[#FF9F1C]"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-[#07182E] tracking-wider block mb-1">
                      Signed Status *
                    </label>
                    <select
                      value={signedStatus}
                      onChange={(e) => setSignedStatus(e.target.value as RfiDocument["signedStatus"])}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold outline-none cursor-pointer focus:border-[#FF9F1C]"
                    >
                      <option value="Not Signed">Not Signed</option>
                      <option value="Signed">Signed</option>
                      <option value="Awaiting Signature">Awaiting Signature</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-2 p-5 bg-white border-t border-slate-150 shrink-0 z-10">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-[#FF9F1C]/15 transition-all cursor-pointer"
              >
                Save RFI Document
              </button>
            </div>
          </form>
        </div>
      )}

      {/* READ-ONLY VIEW DOCUMENT (SIMULATED PDF TEMPLATE) */}
      {viewingRfi && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-[800px] max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="bg-[#07182E] p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FF9F1C]" />
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">
                    {viewingRfi.rfiNumber} Template Preview (PDF Standard Layout)
                  </h3>
                  <span className="text-[10px] text-slate-300 font-bold">Page 1 of 1 Format</span>
                </div>
              </div>
              <button
                onClick={() => setViewingRfi(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulated PDF Layout (scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
              <div className="bg-white border border-[#E2E8F0] shadow-md p-8 max-w-[720px] mx-auto text-xs font-semibold text-slate-700 leading-relaxed space-y-4">
                
                {/* PDF Header block */}
                <div className="border border-slate-300 flex">
                  {/* Left Column: Contractor Info */}
                  <div className="w-1/2 p-4 border-r border-slate-300 space-y-2">
                    {viewingRfi.logoBase64 && (
                      <img
                        src={viewingRfi.logoBase64}
                        alt="Contractor Logo"
                        className="max-h-12 max-w-[150px] object-contain mb-2"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <h1 className="text-sm font-black text-[#07182E] uppercase">
                      {viewingRfi.contractorCompany || "BuildSmith Civil Contractors"}
                    </h1>
                    <div className="text-[10px] font-black text-[#FF9F1C] tracking-wide uppercase">
                      REQUEST FOR INFORMATION
                    </div>
                  </div>

                  {/* Right Column: Consultant Info */}
                  <div className="w-1/2 p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wide">
                        Consultant / Recipient
                      </span>
                      <h2 className="text-xs font-black text-[#07182E] uppercase">
                        {viewingRfi.consultantCompany || "Apex Structural Consulting Engineers"}
                      </h2>
                    </div>
                  </div>
                </div>

                {/* PDF Details Panel */}
                {(() => {
                  const stamp = formatSubmissionTimestamp(viewingRfi.dateInitiated, viewingRfi.createdAt);
                  return (
                    <div className="border-x border-b border-slate-300 grid grid-cols-4 text-[10px]">
                      <div className="p-2.5 border-r border-slate-300 border-t bg-slate-50">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">RFI Number</span>
                        <span className="font-mono font-extrabold text-[#07182E]">{viewingRfi.rfiNumber}</span>
                      </div>
                      <div className="p-2.5 border-r border-slate-300 border-t">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Submission Timestamp</span>
                        <div className="space-y-0.5">
                          <span className="font-extrabold text-[#07182E] block">{stamp.fullTimestamp}</span>
                          {stamp.pendingText && (
                            <span className="text-[9px] font-mono text-amber-600 font-bold block">{stamp.pendingText}</span>
                          )}
                        </div>
                      </div>
                      <div className="p-2.5 border-r border-slate-300 border-t">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Contract Number</span>
                        <span className="font-extrabold text-[#07182E]">{viewingRfi.contractNumber || "N/A"}</span>
                      </div>
                      <div className="p-2.5 border-t">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Page Number</span>
                        <span className="font-extrabold text-[#07182E]">{viewingRfi.pageNumber || "1 of 1"}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* PDF From / To Details */}
                <div className="border border-slate-300 flex text-[10px]">
                  <div className="w-1/2 p-3 border-r border-slate-300 space-y-1">
                    <span className="text-[8px] text-[#FF9F1C] font-black uppercase tracking-wider block">From (Contractor)</span>
                    <div><span className="text-slate-400 font-bold">Company:</span> {viewingRfi.fromCompany}</div>
                    <div><span className="text-slate-400 font-bold">Originator:</span> {viewingRfi.fromOriginator}</div>
                    <div><span className="text-slate-400 font-bold">Email:</span> {viewingRfi.fromEmail}</div>
                  </div>
                  <div className="w-1/2 p-3 space-y-1">
                    <span className="text-[8px] text-[#FF9F1C] font-black uppercase tracking-wider block">To (Consultant)</span>
                    <div><span className="text-slate-400 font-bold">Company:</span> {viewingRfi.toCompany}</div>
                    <div><span className="text-slate-400 font-bold">Attention:</span> {viewingRfi.toAttention}</div>
                    <div><span className="text-slate-400 font-bold">Email:</span> {viewingRfi.toEmail}</div>
                  </div>
                </div>

                {/* Reference specifications */}
                <div className="border border-slate-300 flex text-[10px]">
                  <div className="w-1/2 p-3 border-r border-slate-300">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Drawing Number</span>
                    <span className="font-extrabold text-[#07182E]">{viewingRfi.drawingNumber || "N/A"}</span>
                  </div>
                  <div className="w-1/2 p-3">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Specification / Clause Ref</span>
                    <span className="font-extrabold text-[#07182E]">{viewingRfi.specification || "N/A"}</span>
                  </div>
                </div>

                {/* Originator Section */}
                <div className="border border-slate-300 p-4 space-y-2">
                  <span className="text-[8px] text-[#07182E] font-black uppercase tracking-wider block border-b border-slate-200 pb-1">
                    1.0 Originator Section
                  </span>
                  <div className="grid grid-cols-2 gap-4 text-[10px] mb-2">
                    <div>
                      <span className="text-slate-400 font-bold">Originator:</span> {viewingRfi.originatorName}
                    </div>
                  </div>
                  <div className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-medium">
                    {viewingRfi.queryText}
                  </div>
                </div>

                {/* Proposed Action Section */}
                <div className="border border-slate-300 p-4 space-y-2">
                  <span className="text-[8px] text-[#07182E] font-black uppercase tracking-wider block border-b border-slate-200 pb-1">
                    2.0 Contractor Proposed Action / Suggestions
                  </span>
                  <div className="text-slate-600 font-medium italic">
                    {viewingRfi.proposedAction || "No actions proposed."}
                  </div>
                </div>

                {/* Engineer Response Section */}
                <div className="border border-slate-300 p-4 space-y-2">
                  <span className="text-[8px] text-[#07182E] font-black uppercase tracking-wider block border-b border-slate-200 pb-1">
                    3.0 Engineer Official Response
                  </span>
                  <div className="text-slate-600 font-medium bg-amber-50/20 p-2.5 rounded-lg border border-amber-100">
                    {viewingRfi.engineerResponse || "Official evaluation pending."}
                  </div>
                </div>

                {/* Engineering Decision Box */}
                <div className="border border-slate-300 p-4 space-y-3">
                  <span className="text-[8px] text-[#07182E] font-black uppercase tracking-wider block border-b border-slate-200 pb-1">
                    4.0 Engineering Decision Status
                  </span>
                  
                  <div className="flex gap-4 text-[9px] font-black uppercase">
                    <span className={`inline-flex px-2 py-0.5 border rounded-md ${viewingRfi.decisionAccept ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                      {viewingRfi.decisionAccept ? "☒" : "☐"} Accepted
                    </span>
                    <span className={`inline-flex px-2 py-0.5 border rounded-md ${viewingRfi.decisionAcceptWithComments ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                      {viewingRfi.decisionAcceptWithComments ? "☒" : "☐"} Accepted with Comments
                    </span>
                    <span className={`inline-flex px-2 py-0.5 border rounded-md ${viewingRfi.decisionReject ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                      {viewingRfi.decisionReject ? "☒" : "☐"} Rejected
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 font-bold">
                    Comments: <span className="font-semibold text-slate-600">{viewingRfi.decisionComments || "None"}</span>
                  </div>
                </div>

                {/* PDF Sign-off block */}
                <div className="border border-slate-300 flex text-[10px]">
                  {/* Signature left */}
                  <div className="w-1/2 p-3 border-r border-slate-300 space-y-2">
                    <span className="text-[8px] text-[#07182E] font-black uppercase tracking-wider block">
                      5.0 Engineer Signature Authority
                    </span>
                    <div>
                      <span className="text-slate-400 font-bold">Engineer Name:</span> {viewingRfi.engineerName || "N/A"}
                    </div>
                    {viewingRfi.signatureBase64 ? (
                      <img
                        src={viewingRfi.signatureBase64}
                        alt="Engineer Signature"
                        className="max-h-10 max-w-[120px] object-contain border-b border-dashed border-slate-300 pb-1"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-[9px] text-slate-400 font-bold italic pt-2">Awaiting official physical signature</div>
                    )}
                  </div>

                  {/* Sign date right */}
                  <div className="w-1/2 p-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Sign Date</span>
                      <span className="font-extrabold text-[#07182E]">{viewingRfi.signDate || "N/A"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Document Status</span>
                      <span className="font-black text-[#FF9F1C] uppercase tracking-wider">{viewingRfi.status}</span>
                    </div>
                  </div>
                </div>

                {/* PDF footer notation */}
                <div className="text-center text-[9px] text-slate-400 font-bold border-t border-slate-200 pt-2 flex items-center justify-between">
                  <span>ProjectMatrix Contract Register</span>
                  <span>Page 1 of 1</span>
                </div>

              </div>
            </div>

            {/* Sticky footer for Preview Modal */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0 z-10">
              <span className="text-[10px] text-slate-400 font-bold">Simulated contract compliance view</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewingRfi(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  onClick={(e) => handleDownloadDocx(viewingRfi, e)}
                  disabled={
                    generatingDocxRfiId !== null ||
                    isDeletingRfi ||
                    isSignedFileSaving
                  }
                  className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#FFB020] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {generatingDocxRfiId === viewingRfi.id ? (
                    <Clock className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {generatingDocxRfiId === viewingRfi.id
                    ? "Generating..."
                    : "Download DOCX"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION DIALOG */}
      {showDeleteDialog && rfiToDelete && (
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
              <p className="text-slate-600 text-sm font-semibold mb-2">
                Are you sure you want to delete this RFI document?
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-xs space-y-1.5 text-slate-700 font-medium">
                <div>
                  <span className="text-slate-400 font-bold">RFI Reference:</span>{" "}
                  <span className="font-extrabold text-[#07182E]">{rfiToDelete.rfiNumber || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold">Query:</span>{" "}
                  <span className="font-extrabold text-[#07182E]">
                    {rfiToDelete.queryText || "N/A"}
                  </span>
                </div>
                <div className="text-[10px] text-rose-500 font-bold mt-2">
                  * This permanently removes the RFI record, all linked files
                  and its Project Advisor indexes.
                </div>
              </div>
              {deleteDialogError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-700 font-semibold">
                    {deleteDialogError}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteDialogError(null);
                    setShowDeleteDialog(false);
                    setRfiToDelete(null);
                  }}
                  disabled={isDeletingRfi}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeletingRfi}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-rose-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isDeletingRfi ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}