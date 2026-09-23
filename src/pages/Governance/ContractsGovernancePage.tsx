import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  FileText, 
  ShieldCheck, 
  Scale, 
  AlertTriangle, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Download, 
  Eye, 
  Sparkles, 
  FileCheck, 
  Calendar, 
  Layers, 
  ArrowUpRight, 
  Search, 
  BookOpen, 
  Filter, 
  ExternalLink, 
  ChevronRight, 
  SlidersHorizontal, 
  FileSpreadsheet, 
  Check, 
  Building, 
  Briefcase,
  Sliders,
  Cpu,
  History,
  Trash2,
  Edit,
  Upload,
  Paperclip,
  DollarSign,
  AlertCircle,
  X
} from "lucide-react";
import ProjectShell from "../../components/layout/ProjectShell";
import { MetricCard } from "../../components/ui/MetricCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Tabs } from "../../components/ui/Tabs";
import { Panel } from "../../components/ui/Panel";
import { DataTable } from "../../components/ui/DataTable";
import { 
  CONTRACT_STANDARDS_DATABASE, 
  CROSS_FRAMEWORK_COMPARATIVE_MATRIX, 
  ContractStandardSuite, 
  ContractClauseReference 
} from "../../data/contractStandardsData";
import ContractLibraryExplorer from "../../components/contracts/ContractLibraryExplorer";
import ContractRulesEngineExplorer from "../../components/contracts/ContractRulesEngineExplorer";
import ContractConfigWizardModal from "../../components/contracts/ContractConfigWizardModal";
import EffectiveContractSynthesisExplorer from "../../components/contracts/EffectiveContractSynthesisExplorer";
import ContractDocumentsVersionControl from "../../components/contracts/ContractDocumentsVersionControl";
import ContractModal from "../../components/contracts/ContractModal";
import ContractDetailsModal from "../../components/contracts/ContractDetailsModal";
import ContractDeleteConfirmModal from "../../components/contracts/ContractDeleteConfirmModal";
import ContractAttachmentUploadModal from "../../components/contracts/ContractAttachmentUploadModal";
import { ContractEngine } from "../../services/ContractEngine";
import { ContractsService } from "../../services/contractsService";
import { ProjectContractProfile } from "../../types/contractRules";
import { ContractLibraryItem } from "../../types/contractLibrary";
import { ProjectContractRecord } from "../../types/contractManagement";

export interface ContractNoticeItem {
  id: string;
  ref: string;
  title: string;
  type: "Early Warning" | "Notice of Claim" | "Interim Claim" | "Final Claim" | "Dispute Notice";
  clauseBasis: string;
  dateIssued: string;
  recipient: string;
  delayClaimedDays: string;
  costClaimed: string;
  status: "Draft" | "Issued" | "Under Review" | "Approved" | "Disputed";
  description: string;
}

export interface ContractVariationItem {
  id: string;
  voNumber: string;
  title: string;
  clauseReference: string;
  dateIssued: string;
  issuedBy: string;
  costImpact: string;
  timeImpactDays: string;
  status: "Pending" | "Approved" | "Under Negotiation" | "Rejected";
  description: string;
}

export interface ContractSecurityItem {
  id: string;
  refNumber: string;
  type: "Performance Bond" | "Advance Payment Guarantee" | "Retention Money Guarantee" | "Parent Company Guarantee";
  issuerBank: string;
  beneficiary: string;
  amount: string;
  currency: string;
  effectiveDate: string;
  expiryDate: string;
  status: "Active" | "Expired" | "Amortizing" | "Released";
}

type ContractTab = 
  | "contracts"
  | "effective_contract"
  | "doc_version_control"
  | "engine_rules" 
  | "library" 
  | "agreements" 
  | "notices" 
  | "clause_standards" 
  | "comparative_matrix" 
  | "variations" 
  | "securities";

export default function ContractsGovernancePage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const activeCompany = context.activeCompany;

  const projectId = activeProject?.id || "proj-001";
  const projectName = activeProject?.name || "Active Project";

  // Permissions (Admin/Executive/Manager default enabled)
  const canCreate = true;
  const canEdit = true;
  const canDelete = true;

  // Real Stored Contracts state for the active project
  const [contracts, setContracts] = useState<ProjectContractRecord[]>(() =>
    ContractsService.getContractsByProjectSync(projectId)
  );
  const [loadingContracts, setLoadingContracts] = useState<boolean>(false);
  const [contractSearch, setContractSearch] = useState<string>("");
  const [contractStatusFilter, setContractStatusFilter] = useState<string>("all");

  // Modals state for Contracts CRUD
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingContract, setEditingContract] = useState<ProjectContractRecord | null>(null);
  const [viewingContract, setViewingContract] = useState<ProjectContractRecord | null>(null);
  const [deletingContract, setDeletingContract] = useState<ProjectContractRecord | null>(null);
  const [uploadingForContract, setUploadingForContract] = useState<ProjectContractRecord | null>(null);

  // --- Subtab 1: Notices State ---
  const [notices, setNotices] = useState<ContractNoticeItem[]>(() => {
    try {
      const stored = previewStorage.getItem(`pm_contract_notices_${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<ContractNoticeItem | null>(null);
  const [viewingNotice, setViewingNotice] = useState<ContractNoticeItem | null>(null);

  const saveNotices = (updated: ContractNoticeItem[]) => {
    assertOperationalAction("write", "pages/Governance/ContractsGovernancePage.tsx");
    setNotices(updated);
    try {
      previewStorage.setItem(`pm_contract_notices_${projectId}`, JSON.stringify(updated));
    } catch {}
  };

  // Form state for Notice
  const [noticeRef, setNoticeRef] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeType, setNoticeType] = useState<ContractNoticeItem["type"]>("Notice of Claim");
  const [noticeClause, setNoticeClause] = useState("Clause 20.2 (Claims for Payment / EOT)");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticeRecipient, setNoticeRecipient] = useState("The Engineer / Employer's Representative");
  const [noticeDelayDays, setNoticeDelayDays] = useState("+0 Days");
  const [noticeCostClaimed, setNoticeCostClaimed] = useState("$0.00");
  const [noticeStatus, setNoticeStatus] = useState<ContractNoticeItem["status"]>("Issued");
  const [noticeDesc, setNoticeDesc] = useState("");

  const handleOpenAddNotice = (item?: ContractNoticeItem) => {
    if (item) {
      setEditingNotice(item);
      setNoticeRef(item.ref);
      setNoticeTitle(item.title);
      setNoticeType(item.type);
      setNoticeClause(item.clauseBasis);
      setNoticeDate(item.dateIssued);
      setNoticeRecipient(item.recipient);
      setNoticeDelayDays(item.delayClaimedDays);
      setNoticeCostClaimed(item.costClaimed);
      setNoticeStatus(item.status);
      setNoticeDesc(item.description);
    } else {
      setEditingNotice(null);
      setNoticeRef(`NTC-${(notices.length + 1).toString().padStart(3, "0")}`);
      setNoticeTitle("");
      setNoticeType("Notice of Claim");
      setNoticeClause("Clause 20.2 (Claims for Payment / EOT)");
      setNoticeDate(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
      setNoticeRecipient("The Engineer / Employer's Representative");
      setNoticeDelayDays("+0 Days");
      setNoticeCostClaimed("$0.00");
      setNoticeStatus("Issued");
      setNoticeDesc("");
    }
    setIsNoticeModalOpen(true);
  };

  const handleSaveNotice = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Governance/ContractsGovernancePage.tsx");
    e.preventDefault();
    if (editingNotice) {
      const updated = notices.map(n => n.id === editingNotice.id ? {
        ...n,
        ref: noticeRef,
        title: noticeTitle,
        type: noticeType,
        clauseBasis: noticeClause,
        dateIssued: noticeDate,
        recipient: noticeRecipient,
        delayClaimedDays: noticeDelayDays,
        costClaimed: noticeCostClaimed,
        status: noticeStatus,
        description: noticeDesc
      } : n);
      saveNotices(updated);
    } else {
      const newNotice: ContractNoticeItem = {
        id: `ntc_${Date.now()}`,
        ref: noticeRef,
        title: noticeTitle,
        type: noticeType,
        clauseBasis: noticeClause,
        dateIssued: noticeDate,
        recipient: noticeRecipient,
        delayClaimedDays: noticeDelayDays,
        costClaimed: noticeCostClaimed,
        status: noticeStatus,
        description: noticeDesc
      };
      saveNotices([newNotice, ...notices]);
    }
    setIsNoticeModalOpen(false);
  };

  const handleDeleteNotice = (id: string) => {
    assertOperationalAction("delete", "pages/Governance/ContractsGovernancePage.tsx");
    saveNotices(notices.filter(n => n.id !== id));
  };

  // --- Subtab 2: Variations State ---
  const [variations, setVariations] = useState<ContractVariationItem[]>(() => {
    try {
      const stored = previewStorage.getItem(`pm_contract_variations_${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [isVariationModalOpen, setIsVariationModalOpen] = useState(false);
  const [editingVariation, setEditingVariation] = useState<ContractVariationItem | null>(null);
  const [viewingVariation, setViewingVariation] = useState<ContractVariationItem | null>(null);

  const saveVariations = (updated: ContractVariationItem[]) => {
    assertOperationalAction("write", "pages/Governance/ContractsGovernancePage.tsx");
    setVariations(updated);
    try {
      previewStorage.setItem(`pm_contract_variations_${projectId}`, JSON.stringify(updated));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pm_commercial_data_updated", { detail: { projectId } }));
        window.dispatchEvent(new Event("storage"));
      }
    } catch {}
  };

  // Form state for Variation
  const [voNumber, setVoNumber] = useState("");
  const [voTitle, setVoTitle] = useState("");
  const [voClause, setVoClause] = useState("Clause 13.1 (Right to Vary)");
  const [voDate, setVoDate] = useState("");
  const [voIssuedBy, setVoIssuedBy] = useState("Resident Engineer");
  const [voCost, setVoCost] = useState("$0.00");
  const [voTimeDays, setVoTimeDays] = useState("+0 Days");
  const [voStatus, setVoStatus] = useState<ContractVariationItem["status"]>("Approved");
  const [voDesc, setVoDesc] = useState("");

  const handleOpenAddVariation = (item?: ContractVariationItem) => {
    if (item) {
      setEditingVariation(item);
      setVoNumber(item.voNumber);
      setVoTitle(item.title);
      setVoClause(item.clauseReference);
      setVoDate(item.dateIssued);
      setVoIssuedBy(item.issuedBy);
      setVoCost(item.costImpact);
      setVoTimeDays(item.timeImpactDays);
      setVoStatus(item.status);
      setVoDesc(item.description);
    } else {
      setEditingVariation(null);
      setVoNumber(`VO-${(variations.length + 1).toString().padStart(3, "0")}`);
      setVoTitle("");
      setVoClause("Clause 13.1 (Right to Vary)");
      setVoDate(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
      setVoIssuedBy("Resident Engineer");
      setVoCost("$0.00");
      setVoTimeDays("+0 Days");
      setVoStatus("Approved");
      setVoDesc("");
    }
    setIsVariationModalOpen(true);
  };

  const handleSaveVariation = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Governance/ContractsGovernancePage.tsx");
    e.preventDefault();
    if (editingVariation) {
      const updated = variations.map(v => v.id === editingVariation.id ? {
        ...v,
        voNumber,
        title: voTitle,
        clauseReference: voClause,
        dateIssued: voDate,
        issuedBy: voIssuedBy,
        costImpact: voCost,
        timeImpactDays: voTimeDays,
        status: voStatus,
        description: voDesc
      } : v);
      saveVariations(updated);
    } else {
      const newVar: ContractVariationItem = {
        id: `vo_${Date.now()}`,
        voNumber,
        title: voTitle,
        clauseReference: voClause,
        dateIssued: voDate,
        issuedBy: voIssuedBy,
        costImpact: voCost,
        timeImpactDays: voTimeDays,
        status: voStatus,
        description: voDesc
      };
      saveVariations([newVar, ...variations]);
    }
    setIsVariationModalOpen(false);
  };

  const handleDeleteVariation = (id: string) => {
    assertOperationalAction("delete", "pages/Governance/ContractsGovernancePage.tsx");
    saveVariations(variations.filter(v => v.id !== id));
  };

  // --- Subtab 3: Securities State ---
  const [securities, setSecurities] = useState<ContractSecurityItem[]>(() => {
    try {
      const stored = previewStorage.getItem(`pm_contract_securities_${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [editingSecurity, setEditingSecurity] = useState<ContractSecurityItem | null>(null);
  const [viewingSecurity, setViewingSecurity] = useState<ContractSecurityItem | null>(null);

  const saveSecurities = (updated: ContractSecurityItem[]) => {
    assertOperationalAction("write", "pages/Governance/ContractsGovernancePage.tsx");
    setSecurities(updated);
    try {
      previewStorage.setItem(`pm_contract_securities_${projectId}`, JSON.stringify(updated));
    } catch {}
  };

  // Form state for Security
  const [secRef, setSecRef] = useState("");
  const [secType, setSecType] = useState<ContractSecurityItem["type"]>("Performance Bond");
  const [secBank, setSecBank] = useState("First National Bank / Standard Bank");
  const [secBeneficiary, setSecBeneficiary] = useState("Project Employer");
  const [secAmount, setSecAmount] = useState("$0.00");
  const [secCurrency, setSecCurrency] = useState("USD");
  const [secEffectiveDate, setSecEffectiveDate] = useState("");
  const [secExpiryDate, setSecExpiryDate] = useState("");
  const [secStatus, setSecStatus] = useState<ContractSecurityItem["status"]>("Active");

  const handleOpenAddSecurity = (item?: ContractSecurityItem) => {
    if (item) {
      setEditingSecurity(item);
      setSecRef(item.refNumber);
      setSecType(item.type);
      setSecBank(item.issuerBank);
      setSecBeneficiary(item.beneficiary);
      setSecAmount(item.amount);
      setSecCurrency(item.currency);
      setSecEffectiveDate(item.effectiveDate);
      setSecExpiryDate(item.expiryDate);
      setSecStatus(item.status);
    } else {
      setEditingSecurity(null);
      setSecRef(`SEC-BG-${(securities.length + 1).toString().padStart(3, "0")}`);
      setSecType("Performance Bond");
      setSecBank("Standard Bank Corporate & Investment Banking");
      setSecBeneficiary("Project Employer");
      setSecAmount("$1,250,000.00");
      setSecCurrency("USD");
      setSecEffectiveDate(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
      setSecExpiryDate("31 Dec 2027");
      setSecStatus("Active");
    }
    setIsSecurityModalOpen(true);
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Governance/ContractsGovernancePage.tsx");
    e.preventDefault();
    if (editingSecurity) {
      const updated = securities.map(s => s.id === editingSecurity.id ? {
        ...s,
        refNumber: secRef,
        type: secType,
        issuerBank: secBank,
        beneficiary: secBeneficiary,
        amount: secAmount,
        currency: secCurrency,
        effectiveDate: secEffectiveDate,
        expiryDate: secExpiryDate,
        status: secStatus
      } : s);
      saveSecurities(updated);
    } else {
      const newSec: ContractSecurityItem = {
        id: `sec_${Date.now()}`,
        refNumber: secRef,
        type: secType,
        issuerBank: secBank,
        beneficiary: secBeneficiary,
        amount: secAmount,
        currency: secCurrency,
        effectiveDate: secEffectiveDate,
        expiryDate: secExpiryDate,
        status: secStatus
      };
      saveSecurities([newSec, ...securities]);
    }
    setIsSecurityModalOpen(false);
  };

  const handleDeleteSecurity = (id: string) => {
    assertOperationalAction("delete", "pages/Governance/ContractsGovernancePage.tsx");
    saveSecurities(securities.filter(s => s.id !== id));
  };

  // Active Tab
  const [activeTab, setActiveTab] = useState<ContractTab>("contracts");

  // Contract Profile & Wizard State
  const [contractProfile, setContractProfile] = useState<ProjectContractProfile>(() => 
    ContractEngine.getContractProfile(projectId)
  );
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  // Contract Framework Selection
  const [selectedSuiteCode, setSelectedSuiteCode] = useState<string>(contractProfile?.suiteCode || "FIDIC_2017_RED");
  const [clauseSearch, setClauseSearch] = useState<string>("");
  const [clauseTopicFilter, setClauseTopicFilter] = useState<string>("all");
  const [selectedClause, setSelectedClause] = useState<ContractClauseReference | null>(null);

  // Synchronize contracts when projectId changes
  const loadContractsForProject = useCallback(async (pId: string) => {
    setLoadingContracts(true);
    try {
      const list = await ContractsService.getContractsByProject(pId);
      setContracts(list);
      setContractProfile(ContractEngine.getContractProfile(pId));
    } catch (e) {
      console.warn("Failed to load project contracts", e);
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  useEffect(() => {
    loadContractsForProject(projectId);
  }, [projectId, loadContractsForProject]);

  // Derived KPIs from real stored contracts
  const kpis = useMemo(() => {
    return ContractsService.calculateKPIs(contracts);
  }, [contracts]);

  // Dynamic Notice Evaluation from ContractEngine
  const currentClaimNoticeRequirement = useMemo(() => {
    return ContractEngine.getNoticeRequirement(contractProfile, "contractor_awareness");
  }, [contractProfile]);

  const activeSuite: ContractStandardSuite = CONTRACT_STANDARDS_DATABASE[selectedSuiteCode] || CONTRACT_STANDARDS_DATABASE["FIDIC_2017_RED"];

  // Filtered Contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const matchStatus = contractStatusFilter === "all" || c.status === contractStatusFilter;
      const searchLower = contractSearch.toLowerCase();
      const matchSearch = !contractSearch || 
        c.contractNumber.toLowerCase().includes(searchLower) ||
        c.contractTitle.toLowerCase().includes(searchLower) ||
        c.client.toLowerCase().includes(searchLower) ||
        c.contractor.toLowerCase().includes(searchLower) ||
        c.contractType.toLowerCase().includes(searchLower);
      return matchStatus && matchSearch;
    });
  }, [contracts, contractSearch, contractStatusFilter]);

  // Filtered Clauses
  const filteredClauses = useMemo(() => {
    return activeSuite.clauses.filter(clause => {
      const matchTopic = clauseTopicFilter === "all" || clause.topic === clauseTopicFilter;
      const searchLower = clauseSearch.toLowerCase();
      const matchSearch = !clauseSearch || 
        clause.clauseNumber.toLowerCase().includes(searchLower) ||
        clause.title.toLowerCase().includes(searchLower) ||
        clause.summary.toLowerCase().includes(searchLower) ||
        clause.practicalGuidance.toLowerCase().includes(searchLower);
      return matchTopic && matchSearch;
    });
  }, [activeSuite, clauseSearch, clauseTopicFilter]);

  // CRUD Handlers for Contracts
  const handleSaveContract = async (contractData: Omit<ProjectContractRecord, "id" | "projectId" | "createdAt" | "updatedAt">) => {
    assertOperationalAction("write", "pages/Governance/ContractsGovernancePage.tsx");
    if (editingContract) {
      await ContractsService.updateContract(projectId, editingContract.id, contractData);
    } else {
      await ContractsService.createContract(projectId, contractData);
    }
    await loadContractsForProject(projectId);
    setEditingContract(null);
    setIsAddModalOpen(false);
  };

  const handleDeleteContract = async (contractId: string) => {
    assertOperationalAction("delete", "pages/Governance/ContractsGovernancePage.tsx");
    await ContractsService.deleteContract(projectId, contractId);
    await loadContractsForProject(projectId);
    setDeletingContract(null);
  };

  const handleUploadAttachment = async (
    contractId: string, 
    file: { name: string; size: number; type: string; dataUrl?: string; category?: string }
  ) => {
    assertOperationalAction("write", "pages/Governance/ContractsGovernancePage.tsx");
    await ContractsService.addAttachmentToContract(projectId, contractId, file);
    await loadContractsForProject(projectId);
    
    // Refresh viewing modal if open
    if (viewingContract && viewingContract.id === contractId) {
      const updated = await ContractsService.getContractById(projectId, contractId);
      setViewingContract(updated);
    }
  };

  const handleRemoveAttachment = async (contractId: string, attachmentId: string) => {
    assertOperationalAction("delete", "pages/Governance/ContractsGovernancePage.tsx");
    await ContractsService.removeAttachmentFromContract(projectId, contractId, attachmentId);
    await loadContractsForProject(projectId);
    
    // Refresh viewing modal if open
    if (viewingContract && viewingContract.id === contractId) {
      const updated = await ContractsService.getContractById(projectId, contractId);
      setViewingContract(updated);
    }
  };

  const tabsConfig = [
    { id: "contracts" as ContractTab, label: "Contract Register", icon: FileText, badge: contracts.length > 0 ? `${contracts.length}` : undefined },
    { id: "effective_contract" as ContractTab, label: "Effective Contract (Synthesis)", icon: Scale, badge: "Base + Amendments" },
    { id: "doc_version_control" as ContractTab, label: "Contract Documents & Version Control", icon: History, badge: "Precedence" },
    { id: "engine_rules" as ContractTab, label: "Contract Rules Engine & Simulator", icon: Cpu, badge: "Rules" },
    { id: "library" as ContractTab, label: "Contract Suite Library", icon: BookOpen, badge: "FIDIC/NEC/SA" },
    { id: "agreements" as ContractTab, label: "Agreements & Deeds", icon: FileCheck, badge: contracts.length > 0 ? `${contracts.length}` : undefined },
    { id: "notices" as ContractTab, label: "Notices & Claims Register", icon: AlertTriangle, badge: "Active" },
    { id: "clause_standards" as ContractTab, label: "Clause Standard Reference", icon: Scale, badge: `${activeSuite.clauses.length}` },
    { id: "comparative_matrix" as ContractTab, label: "Cross-Contract Matrix", icon: Layers, badge: "5 Suites" },
    { id: "variations" as ContractTab, label: "Variations & Instructions", icon: FileCheck, badge: "Approved" },
    { id: "securities" as ContractTab, label: "Bonds & Guarantees", icon: ShieldCheck, badge: "Verified" },
  ];

  const handleOpenAdvisorForClause = (clause: ContractClauseReference) => {
    const query = `Explain the contractor's entitlements, time-bar deadlines, and procedural notice requirements under ${activeSuite.name} ${clause.clauseNumber} (${clause.title}) for our project ${projectName}.`;
    try {
      const event = new CustomEvent("matrix-open-advisor", {
        detail: { query, contractFramework: activeSuite.code }
      });
      window.dispatchEvent(event);
    } catch {
      try {
        const evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("matrix-open-advisor", true, true, { query, contractFramework: activeSuite.code });
        window.dispatchEvent(evt);
      } catch (e) {
        console.warn("Unable to dispatch matrix-open-advisor event", e);
      }
    }
  };

  const handleOpenAdvisorNoticeDraft = (customPrompt?: string) => {
    const query = customPrompt || `Draft a formal contractual notice of claim under ${contractProfile.family} ${contractProfile.formName} for project ${projectName} regarding unforeseen ground conditions and engineering RFI response delays.`;
    try {
      const event = new CustomEvent("matrix-open-advisor", {
        detail: { query, contractFramework: contractProfile.suiteCode }
      });
      window.dispatchEvent(event);
    } catch {
      try {
        const evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("matrix-open-advisor", true, true, { query, contractFramework: contractProfile.suiteCode });
        window.dispatchEvent(evt);
      } catch (e) {
        console.warn("Unable to dispatch matrix-open-advisor event", e);
      }
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Active":
      case "Executing":
        return "success";
      case "Substantially Complete":
      case "Completed":
        return "info";
      case "Under Dispute":
      case "Suspended":
        return "warning";
      case "Terminated":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <ProjectShell project={activeProject} section="documents">
      <div className="space-y-6 w-full">
        
        {/* Module Header Bar - Clean horizontal header with Add Contract primary and subordinate secondary actions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#07182E] dark:text-white tracking-tight">
                Contracts & Legal Governance
              </h2>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-500" />
                  {contractProfile.family} {contractProfile.formName}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                  Project: {projectName}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl font-medium">
              Contract administration engine for legal agreements, procedural notices, condition precedents, time-bars, and financial parameters.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Primary Add Contract Action */}
            {canCreate && (
              <button 
                onClick={() => {
                  setEditingContract(null);
                  setIsAddModalOpen(true);
                }}
                className="h-9 px-4 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>+ Add Contract</span>
              </button>
            )}

            {/* Configure Contract Wizard Action - Subordinate */}
            <button 
              onClick={() => setIsWizardOpen(true)}
              className="h-9 px-3 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Framework Wizard</span>
            </button>

            {/* Ask Matrix Contract Assistant Action - Subordinate */}
            <button 
              onClick={() => handleOpenAdvisorNoticeDraft()}
              className="h-9 px-3 bg-white hover:bg-amber-50/60 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-amber-800 text-xs font-medium rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Ask Matrix</span>
            </button>
          </div>
        </div>

        {/* Real KPI Cards in one perfectly aligned row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            label="Total Stored Contracts"
            value={kpis.totalContractsCount > 0 ? `${kpis.totalContractsCount} Agreements` : "-"}
            trend={{ 
              direction: kpis.totalContractsCount > 0 ? "up" : "neutral", 
              value: kpis.totalContractsCount > 0 ? `${kpis.activeContractsCount} active` : "No records",
              label: "in execution"
            }}
            status="default"
          />
          <MetricCard
            label="Aggregate Contract Commitment"
            value={kpis.totalContractValue > 0 ? `${kpis.primaryCurrency} ${kpis.totalContractValue >= 1000000 ? (kpis.totalContractValue / 1000000).toFixed(1) + 'M' : kpis.totalContractValue.toLocaleString()}` : "-"}
            trend={{ 
              direction: "neutral", 
              value: kpis.primaryCurrency,
              label: "Primary"
            }}
            status="success"
          />
          <MetricCard
            label="Average Completion Duration"
            value={kpis.averageDurationDays > 0 ? `${kpis.averageDurationDays} Days` : "-"}
            trend={{ 
              direction: "neutral", 
              value: `~${Math.round(kpis.averageDurationDays / 30.4)} Mos`,
              label: "Timeline"
            }}
            status="intelligence"
          />
          <MetricCard
            label="Procedural Notice Strictness"
            value={currentClaimNoticeRequirement ? `${currentClaimNoticeRequirement.rule.deadline.durationValue} ${currentClaimNoticeRequirement.rule.deadline.durationUnit}` : "-"}
            trend={{ 
              direction: "neutral", 
              value: contractProfile.suiteCode || "Standard",
              label: "Rule"
            }}
            status="warning"
          />
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-xs">
          <Tabs
            tabs={tabsConfig}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as ContractTab)}
          />
        </div>

        {/* TAB 0: MASTER CONTRACT REGISTER (Full CRUD & Documents) */}
        {activeTab === "contracts" && (
          <div className="space-y-6">
            <Panel
              title={`Project Contract Register (${filteredContracts.length})`}
              subtitle={`Legally binding contracts, subcontracts, and consulting agreements registered for ${projectName}`}
              action={
                <div className="flex items-center gap-2">
                  {canCreate && (
                    <button
                      onClick={() => {
                        setEditingContract(null);
                        setIsAddModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Contract</span>
                    </button>
                  )}
                </div>
              }
            >
              {/* Search & Filters */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-850/50">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                    placeholder="Search by contract number, title, client, contractor, or contract type..."
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={contractStatusFilter}
                    onChange={(e) => setContractStatusFilter(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="all">All Statuses ({contracts.length})</option>
                    <option value="Executing">Executing / Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Substantially Complete">Substantially Complete</option>
                    <option value="Completed">Completed</option>
                    <option value="Under Dispute">Under Dispute</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Table or Compact Empty State */}
              {contracts.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 w-12 h-12 mx-auto flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    <FileText className="w-6 h-6 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      No contracts registered
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      There are no contracts linked to <strong>{projectName}</strong> yet. Register the first contract to establish commercial and legal governance.
                    </p>
                  </div>
                  {canCreate && (
                    <button
                      onClick={() => {
                        setEditingContract(null);
                        setIsAddModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>+ Add Contract</span>
                    </button>
                  )}
                </div>
              ) : filteredContracts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">No records matched your filter criteria.</p>
                  <p className="text-slate-500">Try clearing the search or status filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                        <th className="p-3.5 font-bold uppercase tracking-wider">Contract No & Title</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider">Contract Type</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider">Parties (Client ↔ Contractor)</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider">Contract Value</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider">Timeline</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider">Status</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider">Attachments</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredContracts.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/70 transition-colors">
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block">{c.contractNumber}</span>
                            <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{c.contractTitle}</span>
                          </td>
                          <td className="p-3.5 max-w-[200px]">
                            <span className="text-slate-700 dark:text-slate-300 font-medium line-clamp-2">{c.contractType}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="text-slate-900 dark:text-white font-bold block">{c.client}</span>
                            <span className="text-slate-500 block text-[11px]">↔ {c.contractor}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                              {c.currency} {c.contractValue ? c.contractValue.toLocaleString() : "-"}
                            </span>
                          </td>
                          <td className="p-3.5 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                            <div>Start: {c.startDate || "-"}</div>
                            <div>End: {c.completionDate || "-"}</div>
                          </td>
                          <td className="p-3.5">
                            <StatusBadge label={c.status} variant={getStatusVariant(c.status) as any} size="sm" />
                          </td>
                          <td className="p-3.5">
                            <button
                              onClick={() => setUploadingForContract(c)}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 text-xs font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                              title="Manage Attachments"
                            >
                              <Paperclip className="w-3 h-3 text-blue-500" />
                              <span>{c.attachments?.length || 0}</span>
                              <Plus className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                            </button>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setViewingContract(c)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                                title="View Contract Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    setEditingContract(c);
                                    setIsAddModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Contract"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setDeletingContract(c)}
                                  className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Contract"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* TAB 0A: EFFECTIVE CONTRACT SYNTHESIS */}
        {activeTab === "effective_contract" && (
          <EffectiveContractSynthesisExplorer
            projectId={projectId}
            projectName={projectName}
            onOpenAdvisorWithContext={(prompt) => handleOpenAdvisorNoticeDraft(prompt)}
            onDraftNoticeForClause={() => setActiveTab("notices")}
          />
        )}

        {/* TAB 0B: CONSTITUENT CONTRACT DOCUMENTS & VERSION CONTROL */}
        {activeTab === "doc_version_control" && (
          <ContractDocumentsVersionControl
            projectId={projectId}
            projectName={projectName}
            onEffectiveContractUpdated={() => {
              setContractProfile(ContractEngine.getContractProfile(projectId));
            }}
            onInterrogateDocumentWithAI={(docTitle, versionTag) => {
              handleOpenAdvisorNoticeDraft(`Analyze ${docTitle} [${versionTag}] for project ${projectName} regarding our compliance obligations and potential operational risks.`);
            }}
          />
        )}

        {/* TAB 0C: DYNAMIC CONTRACT RULES ENGINE & SIMULATOR */}
        {activeTab === "engine_rules" && (
          <ContractRulesEngineExplorer
            contractProfile={contractProfile}
            onOpenWizard={() => setIsWizardOpen(true)}
          />
        )}

        {/* TAB 1: COMPREHENSIVE CONTRACT LIBRARY HIERARCHY */}
        {activeTab === "library" && (
          <div className="space-y-6">
            <ContractLibraryExplorer
              activeContractId={
                contractProfile.suiteCode === "NEC4_ECC" ? "nec4-ecc" :
                contractProfile.suiteCode === "GCC_2015" ? "sa-gcc-2015" :
                contractProfile.suiteCode === "JBCC_6_2" ? "sa-jbcc-pba-6" :
                contractProfile.suiteCode === "FIDIC_1999_RED" ? "fidic-red-1999" : "fidic-red-2017"
              }
              onApplyToProject={(contract: ContractLibraryItem) => {
                const fam = contract.family;
                const newProfile: ProjectContractProfile = {
                  ...contractProfile,
                  family: fam,
                  formName: contract.groupName || contract.name,
                  edition: contract.edition,
                  suiteCode: contract.code,
                  lastConfiguredAt: new Date().toISOString().split("T")[0]
                };
                setContractProfile(newProfile);
                ContractEngine.saveContractProfile(newProfile);
                setSelectedSuiteCode(contract.code);
              }}
            />
          </div>
        )}

        {/* TAB 2: AGREEMENTS & MASTER DEEDS (Synced with real stored contracts) */}
        {activeTab === "agreements" && (
          <div className="space-y-6">
            <Panel
              title="Executing Contract Agreements & Master Deeds"
              subtitle={`Formal signed contract instruments between Employer, Engineer, Main Contractor, and Major Subcontractors for ${projectName}`}
              action={
                canCreate ? (
                  <button 
                    onClick={() => {
                      setEditingContract(null);
                      setIsAddModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Agreement</span>
                  </button>
                ) : undefined
              }
            >
              {contracts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No agreements registered yet. Click "+ Add Agreement" to register a contract deed.
                </div>
              ) : (
                <DataTable
                  data={contracts}
                  columns={[
                    { header: "Agreement Title", accessor: (row: any) => <span className="font-bold text-slate-900 dark:text-white">{row.contractTitle}</span> },
                    { header: "Contract Form / Type", accessor: (row: any) => <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">{row.contractType}</span> },
                    { header: "Reference No", accessor: (row: any) => <span className="text-xs font-mono text-slate-500">{row.contractNumber}</span> },
                    { header: "Parties (Client / Contractor)", accessor: (row: any) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.client} ↔ {row.contractor}</span> },
                    { header: "Contract Sum", accessor: (row: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{row.currency} {row.contractValue ? row.contractValue.toLocaleString() : "-"}</span> },
                    { header: "Status", accessor: (row: any) => <StatusBadge label={row.status} variant={getStatusVariant(row.status) as any} size="sm" /> },
                    {
                      header: "Actions",
                      accessor: (row: any) => (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingContract(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Agreement"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingContract(row);
                                setIsAddModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Agreement"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeletingContract(row)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Agreement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              )}
            </Panel>
          </div>
        )}

        {/* TAB 3: NOTICES OF CLAIM */}
        {activeTab === "notices" && (
          <div className="space-y-6">
            <Panel
              title={`Contractual Notices & Extension of Time (EOT) Register (${notices.length})`}
              subtitle={`Dynamic notice procedures evaluated under ${contractProfile.family} ${contractProfile.formName} with contemporary evidence linkages`}
              action={
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleOpenAddNotice()}
                    className="px-3.5 py-1.5 bg-[#2F7CFF] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Contractual Notice</span>
                  </button>
                </div>
              }
            >
              {notices.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                  <p>No notices registered yet. Use "+ Add Contractual Notice" to log formal claim notices and early warnings with statutory time-bar protections.</p>
                  <button
                    onClick={() => handleOpenAddNotice()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Log Notice of Claim</span>
                  </button>
                </div>
              ) : (
                <DataTable
                  data={notices}
                  columns={[
                    { header: "Notice Ref", accessor: (row: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{row.ref}</span> },
                    { header: "Notice Title", accessor: (row: any) => <span className="font-bold text-slate-900 dark:text-white">{row.title}</span> },
                    { header: "Notice Type", accessor: (row: any) => <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{row.type}</span> },
                    { header: "Clause Basis", accessor: (row: any) => <span className="text-xs font-mono text-slate-500">{row.clauseBasis}</span> },
                    { header: "Date Issued", accessor: (row: any) => <span className="text-xs font-mono text-slate-500">{row.dateIssued}</span> },
                    { header: "Impact (Time / Cost)", accessor: (row: any) => <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">{row.delayClaimedDays} • {row.costClaimed}</span> },
                    { header: "Status", accessor: (row: any) => <StatusBadge label={row.status} variant={row.status === "Approved" ? "success" : row.status === "Disputed" ? "danger" : "warning"} size="sm" /> },
                    {
                      header: "Actions",
                      accessor: (row: any) => (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingNotice(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Notice Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenAddNotice(row)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Notice"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteNotice(row.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Notice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              )}
            </Panel>
          </div>
        )}

        {/* TAB 4: CONTRACT STANDARD & CLAUSE REFERENCE TAXONOMY */}
        {activeTab === "clause_standards" && (
          <div className="space-y-6">
            {/* Search & Topic Filters */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clauseSearch}
                  onChange={(e) => setClauseSearch(e.target.value)}
                  placeholder={`Search ${activeSuite.shortName} clauses, keywords, time-bars (e.g., EOT, payment, ground conditions, suspension)...`}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={clauseTopicFilter}
                  onChange={(e) => setClauseTopicFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Topics ({activeSuite.clauses.length})</option>
                  <option value="delays_eot">Delays & Extension of Time</option>
                  <option value="claims_procedure">Claims & Time-Bars</option>
                  <option value="variations_pricing">Variations & Adjustments</option>
                  <option value="payment_certificates">Payment & Interest</option>
                  <option value="suspension_termination">Suspension & Termination</option>
                  <option value="dispute_resolution">Dispute Resolution</option>
                  <option value="programme_time">Programme & Time Risk</option>
                  <option value="supervision">Supervision & Neutrality</option>
                  <option value="notices">Notices & Communications</option>
                </select>
              </div>
            </div>

            {/* Clauses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClauses.map((clause, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-black border border-blue-200 dark:border-blue-800">
                        {clause.clauseNumber}
                      </span>
                      {clause.timeBarDays && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-bold border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {clause.timeBarDays} {clause.timeBarType?.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {clause.title}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                      {clause.summary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-300">Practical Guidance:</strong> {clause.practicalGuidance}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => setSelectedClause(clause)}
                        className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Full Details</span>
                      </button>

                      <button
                        onClick={() => handleOpenAdvisorForClause(clause)}
                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
                        title="Analyze with Matrix Advisor"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>✦ Ask Matrix</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredClauses.length === 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">No clauses matched your filter criteria.</p>
                <p className="text-xs mt-1">Try broadening your search term or switching topics.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CROSS-FRAMEWORK COMPARATIVE MATRIX */}
        {activeTab === "comparative_matrix" && (
          <div className="space-y-6">
            <Panel
              title="Cross-Framework Comparative Matrix"
              subtitle="Side-by-side comparative analysis of FIDIC 2017, FIDIC 1999, NEC4 ECC, SAICE GCC 2015, and JBCC PBA 6.2 for core contractual procedures"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3.5 font-bold uppercase tracking-wider min-w-[180px]">Contractual Domain / Procedure</th>
                      <th className="p-3.5 font-bold text-blue-700 dark:text-blue-400 min-w-[220px]">FIDIC 2017 Red Book</th>
                      <th className="p-3.5 font-bold text-indigo-700 dark:text-indigo-400 min-w-[200px]">FIDIC 1999 Red Book</th>
                      <th className="p-3.5 font-bold text-amber-700 dark:text-amber-400 min-w-[220px]">NEC4 ECC (June 2017)</th>
                      <th className="p-3.5 font-bold text-emerald-700 dark:text-emerald-400 min-w-[220px]">SAICE GCC 2015 (3rd Ed)</th>
                      <th className="p-3.5 font-bold text-purple-700 dark:text-purple-400 min-w-[220px]">JBCC PBA 6.2 (May 2018)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {CROSS_FRAMEWORK_COMPARATIVE_MATRIX.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/60 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-850/50">
                          {row.topicTitle}
                        </td>
                        
                        {/* FIDIC 2017 */}
                        <td className="p-3.5 align-top space-y-1">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block">{row.fidic2017.clause}</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold">{row.fidic2017.timeBar}</span>
                          <p className="text-slate-600 dark:text-slate-300 mt-1 leading-snug">{row.fidic2017.ruleSummary}</p>
                        </td>

                        {/* FIDIC 1999 */}
                        <td className="p-3.5 align-top space-y-1">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block">{row.fidic1999.clause}</span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">{row.fidic1999.timeBar}</span>
                          <p className="text-slate-600 dark:text-slate-300 mt-1 leading-snug">{row.fidic1999.ruleSummary}</p>
                        </td>

                        {/* NEC4 */}
                        <td className="p-3.5 align-top space-y-1">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 block">{row.nec4.clause}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-bold">{row.nec4.timeBar}</span>
                          <p className="text-slate-600 dark:text-slate-300 mt-1 leading-snug">{row.nec4.ruleSummary}</p>
                        </td>

                        {/* GCC 2015 */}
                        <td className="p-3.5 align-top space-y-1">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">{row.gcc2015.clause}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">{row.gcc2015.timeBar}</span>
                          <p className="text-slate-600 dark:text-slate-300 mt-1 leading-snug">{row.gcc2015.ruleSummary}</p>
                        </td>

                        {/* JBCC 6.2 */}
                        <td className="p-3.5 align-top space-y-1">
                          <span className="font-mono font-bold text-purple-600 dark:text-purple-400 block">{row.jbcc62.clause}</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold">{row.jbcc62.timeBar}</span>
                          <p className="text-slate-600 dark:text-slate-300 mt-1 leading-snug">{row.jbcc62.ruleSummary}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {/* TAB 6: VARIATIONS */}
        {activeTab === "variations" && (
          <div className="space-y-6">
            <Panel
              title={`Approved Variation Orders & Employer Instructions (${variations.length})`}
              subtitle={`Quantified scope adjustments, rate agreements, and contract baseline budget revisions for ${projectName}`}
              action={
                <button
                  onClick={() => handleOpenAddVariation()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Variation</span>
                </button>
              }
            >
              {variations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No variations registered yet. Click "+ Add Variation" to log a formal scope adjustment.
                </div>
              ) : (
                <DataTable
                  data={variations}
                  columns={[
                    { header: "Variation #", accessor: (row: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{row.voNumber}</span> },
                    { header: "Title & Scope Description", accessor: (row: any) => <span className="font-bold text-slate-900 dark:text-white">{row.title}</span> },
                    { header: "Clause Reference", accessor: (row: any) => <span className="text-xs font-mono text-slate-500">{row.clauseReference}</span> },
                    { header: "Issued By", accessor: (row: any) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.issuedBy}</span> },
                    { header: "Date Issued", accessor: (row: any) => <span className="text-xs font-mono text-slate-500">{row.dateIssued}</span> },
                    { header: "Cost Impact", accessor: (row: any) => <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{row.costImpact}</span> },
                    { header: "Time Impact", accessor: (row: any) => <span className="font-mono text-xs font-bold text-amber-600">{row.timeImpactDays}</span> },
                    { header: "Status", accessor: (row: any) => <StatusBadge label={row.status} variant={row.status === "Approved" ? "success" : row.status === "Rejected" ? "danger" : "warning"} size="sm" /> },
                    {
                      header: "Actions",
                      accessor: (row: any) => (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingVariation(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Variation"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenAddVariation(row)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Variation"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteVariation(row.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Variation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              )}
            </Panel>
          </div>
        )}

        {/* TAB 7: SECURITIES & BONDS */}
        {activeTab === "securities" && (
          <div className="space-y-6">
            <Panel
              title={`Banking Securities, Guarantees & Retention Escrows (${securities.length})`}
              subtitle={`Demand guarantees, advance payment amortization schedules, and retention bond custody records for ${projectName}`}
              action={
                <button
                  onClick={() => handleOpenAddSecurity()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Security / Bond</span>
                </button>
              }
            >
              {securities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No banking securities registered yet. Click "+ Add Security / Bond" to attach performance guarantees or demand bonds.
                </div>
              ) : (
                <DataTable
                  data={securities}
                  columns={[
                    { header: "Security Ref #", accessor: (row: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{row.refNumber}</span> },
                    { header: "Guarantee Type", accessor: (row: any) => <span className="font-bold text-slate-900 dark:text-white">{row.type}</span> },
                    { header: "Issuer Bank / Financial Institution", accessor: (row: any) => <span className="text-xs text-slate-700 dark:text-slate-300">{row.issuerBank}</span> },
                    { header: "Beneficiary", accessor: (row: any) => <span className="text-xs text-slate-600 dark:text-slate-300">{row.beneficiary}</span> },
                    { header: "Guaranteed Amount", accessor: (row: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{row.currency} {row.amount}</span> },
                    { header: "Effective - Expiry", accessor: (row: any) => <span className="text-xs font-mono text-slate-500">{row.effectiveDate} → {row.expiryDate}</span> },
                    { header: "Status", accessor: (row: any) => <StatusBadge label={row.status} variant={row.status === "Active" ? "success" : row.status === "Expired" ? "danger" : "warning"} size="sm" /> },
                    {
                      header: "Actions",
                      accessor: (row: any) => (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingSecurity(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Security Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenAddSecurity(row)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Security"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteSecurity(row.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Delete Security"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              )}
            </Panel>
          </div>
        )}

        {/* Modal: Add/Edit Notice */}
        {isNoticeModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingNotice ? "Edit Contractual Notice" : "Register Contractual Notice"}
                </h3>
                <button onClick={() => setIsNoticeModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNotice} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notice Ref #</label>
                    <input
                      type="text"
                      required
                      value={noticeRef}
                      onChange={e => setNoticeRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notice Type</label>
                    <select
                      value={noticeType}
                      onChange={e => setNoticeType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Notice of Claim">Notice of Claim</option>
                      <option value="Early Warning">Early Warning</option>
                      <option value="Interim Claim">Interim Detailed Claim</option>
                      <option value="Final Claim">Final Claim</option>
                      <option value="Dispute Notice">Dispute Notice (DAAB)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notice Title / Subject</label>
                  <input
                    type="text"
                    required
                    value={noticeTitle}
                    onChange={e => setNoticeTitle(e.target.value)}
                    placeholder="e.g. Notice of Unforeseen Physical Ground Conditions at Pier 4"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Clause Basis</label>
                    <input
                      type="text"
                      required
                      value={noticeClause}
                      onChange={e => setNoticeClause(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date Issued</label>
                    <input
                      type="text"
                      value={noticeDate}
                      onChange={e => setNoticeDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Delay Claimed</label>
                    <input
                      type="text"
                      value={noticeDelayDays}
                      onChange={e => setNoticeDelayDays(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cost Claimed</label>
                    <input
                      type="text"
                      value={noticeCostClaimed}
                      onChange={e => setNoticeCostClaimed(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select
                      value={noticeStatus}
                      onChange={e => setNoticeStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Issued">Issued</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Approved">Approved</option>
                      <option value="Disputed">Disputed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description & Circumstances</label>
                  <textarea
                    rows={2}
                    value={noticeDesc}
                    onChange={e => setNoticeDesc(e.target.value)}
                    placeholder="Event details and contemporary records reference..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNoticeModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs"
                  >
                    Save Notice
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Notice */}
        {viewingNotice && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-bold border border-blue-200 dark:border-blue-800">
                    {viewingNotice.ref}
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {viewingNotice.title}
                  </h3>
                </div>
                <button onClick={() => setViewingNotice(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div><strong className="text-slate-500">Notice Type:</strong> <div className="font-semibold text-slate-800 dark:text-slate-200">{viewingNotice.type}</div></div>
                  <div><strong className="text-slate-500">Status:</strong> <div><StatusBadge label={viewingNotice.status} variant={viewingNotice.status === "Approved" ? "success" : "warning"} size="sm" /></div></div>
                  <div><strong className="text-slate-500">Clause Basis:</strong> <div className="font-mono text-slate-700 dark:text-slate-300">{viewingNotice.clauseBasis}</div></div>
                  <div><strong className="text-slate-500">Date Issued:</strong> <div className="font-mono text-slate-700 dark:text-slate-300">{viewingNotice.dateIssued}</div></div>
                  <div><strong className="text-slate-500">Delay Claimed:</strong> <div className="font-mono font-bold text-amber-600">{viewingNotice.delayClaimedDays}</div></div>
                  <div><strong className="text-slate-500">Cost Claimed:</strong> <div className="font-mono font-bold text-slate-900 dark:text-white">{viewingNotice.costClaimed}</div></div>
                </div>

                {viewingNotice.description && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <strong className="text-slate-500">Event Description & Contemporary Evidence:</strong>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{viewingNotice.description}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setViewingNotice(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const n = viewingNotice;
                    setViewingNotice(null);
                    handleOpenAddNotice(n);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Notice</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add/Edit Variation */}
        {isVariationModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingVariation ? "Edit Variation Order" : "Log Variation Order"}
                </h3>
                <button onClick={() => setIsVariationModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveVariation} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">VO #</label>
                    <input
                      type="text"
                      required
                      value={voNumber}
                      onChange={e => setVoNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select
                      value={voStatus}
                      onChange={e => setVoStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending Evaluation</option>
                      <option value="Under Negotiation">Under Negotiation</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Variation Title / Scope Summary</label>
                  <input
                    type="text"
                    required
                    value={voTitle}
                    onChange={e => setVoTitle(e.target.value)}
                    placeholder="e.g. Additional Retaining Wall Reinforcement (Chainage 12+400)"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Clause Reference</label>
                    <input
                      type="text"
                      value={voClause}
                      onChange={e => setVoClause(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Issued By</label>
                    <input
                      type="text"
                      value={voIssuedBy}
                      onChange={e => setVoIssuedBy(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cost Impact</label>
                    <input
                      type="text"
                      value={voCost}
                      onChange={e => setVoCost(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Time Impact</label>
                    <input
                      type="text"
                      value={voTimeDays}
                      onChange={e => setVoTimeDays(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Scope Description & Agreed Rates</label>
                  <textarea
                    rows={2}
                    value={voDesc}
                    onChange={e => setVoDesc(e.target.value)}
                    placeholder="Details of rate analysis, bill item adjustments, and technical basis..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsVariationModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs"
                  >
                    Save Variation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Variation */}
        {viewingVariation && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-bold border border-blue-200 dark:border-blue-800">
                    {viewingVariation.voNumber}
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {viewingVariation.title}
                  </h3>
                </div>
                <button onClick={() => setViewingVariation(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div><strong className="text-slate-500">Status:</strong> <div><StatusBadge label={viewingVariation.status} variant={viewingVariation.status === "Approved" ? "success" : "warning"} size="sm" /></div></div>
                  <div><strong className="text-slate-500">Issued By:</strong> <div className="font-semibold text-slate-800 dark:text-slate-200">{viewingVariation.issuedBy}</div></div>
                  <div><strong className="text-slate-500">Clause Reference:</strong> <div className="font-mono text-slate-700 dark:text-slate-300">{viewingVariation.clauseReference}</div></div>
                  <div><strong className="text-slate-500">Date Issued:</strong> <div className="font-mono text-slate-700 dark:text-slate-300">{viewingVariation.dateIssued}</div></div>
                  <div><strong className="text-slate-500">Cost Adjustment:</strong> <div className="font-mono font-bold text-slate-900 dark:text-white">{viewingVariation.costImpact}</div></div>
                  <div><strong className="text-slate-500">Time Extension:</strong> <div className="font-mono font-bold text-amber-600">{viewingVariation.timeImpactDays}</div></div>
                </div>

                {viewingVariation.description && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <strong className="text-slate-500">Scope Description:</strong>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{viewingVariation.description}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setViewingVariation(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const v = viewingVariation;
                    setViewingVariation(null);
                    handleOpenAddVariation(v);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Variation</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add/Edit Security */}
        {isSecurityModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingSecurity ? "Edit Banking Guarantee / Bond" : "Register Banking Guarantee / Bond"}
                </h3>
                <button onClick={() => setIsSecurityModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSecurity} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Security Ref #</label>
                    <input
                      type="text"
                      required
                      value={secRef}
                      onChange={e => setSecRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Guarantee Type</label>
                    <select
                      value={secType}
                      onChange={e => setSecType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="Performance Bond">Performance Bond</option>
                      <option value="Advance Payment Guarantee">Advance Payment Guarantee</option>
                      <option value="Retention Money Guarantee">Retention Money Guarantee</option>
                      <option value="Parent Company Guarantee">Parent Company Guarantee</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Issuer Bank / Financial Institution</label>
                  <input
                    type="text"
                    required
                    value={secBank}
                    onChange={e => setSecBank(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Beneficiary</label>
                    <input
                      type="text"
                      value={secBeneficiary}
                      onChange={e => setSecBeneficiary(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Guaranteed Amount</label>
                    <input
                      type="text"
                      required
                      value={secAmount}
                      onChange={e => setSecAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Currency</label>
                    <input
                      type="text"
                      value={secCurrency}
                      onChange={e => setSecCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Effective Date</label>
                    <input
                      type="text"
                      value={secEffectiveDate}
                      onChange={e => setSecEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                    <input
                      type="text"
                      value={secExpiryDate}
                      onChange={e => setSecExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSecurityModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs"
                  >
                    Save Security
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Security */}
        {viewingSecurity && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-bold border border-blue-200 dark:border-blue-800">
                    {viewingSecurity.refNumber}
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {viewingSecurity.type}
                  </h3>
                </div>
                <button onClick={() => setViewingSecurity(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div><strong className="text-slate-500">Status:</strong> <div><StatusBadge label={viewingSecurity.status} variant={viewingSecurity.status === "Active" ? "success" : "warning"} size="sm" /></div></div>
                  <div><strong className="text-slate-500">Issuer Bank:</strong> <div className="font-semibold text-slate-800 dark:text-slate-200">{viewingSecurity.issuerBank}</div></div>
                  <div><strong className="text-slate-500">Beneficiary:</strong> <div className="text-slate-700 dark:text-slate-300">{viewingSecurity.beneficiary}</div></div>
                  <div><strong className="text-slate-500">Guaranteed Sum:</strong> <div className="font-mono font-bold text-slate-900 dark:text-white">{viewingSecurity.currency} {viewingSecurity.amount}</div></div>
                  <div><strong className="text-slate-500">Effective Date:</strong> <div className="font-mono text-slate-700 dark:text-slate-300">{viewingSecurity.effectiveDate}</div></div>
                  <div><strong className="text-slate-500">Expiry Date:</strong> <div className="font-mono text-slate-700 dark:text-slate-300">{viewingSecurity.expiryDate}</div></div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setViewingSecurity(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const s = viewingSecurity;
                    setViewingSecurity(null);
                    handleOpenAddSecurity(s);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Security</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clause Details Modal */}
        {selectedClause && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-mono text-xs font-black border border-blue-200 dark:border-blue-800">
                      {selectedClause.clauseNumber}
                    </span>
                    <span className="text-xs text-slate-400 font-bold uppercase">
                      {activeSuite.shortName}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {selectedClause.title}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedClause(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white block text-[11px] uppercase tracking-wider">Clause Summary</span>
                  <p className="leading-relaxed">{selectedClause.summary}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Contractor Rights / Duty</span>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{selectedClause.contractorRightOrDuty}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-slate-900 dark:text-white block text-[11px]">Employer Rights / Duty</span>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{selectedClause.employerRightOrDuty}</p>
                  </div>
                </div>

                <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block text-[11px]">Practical Management & Compliance Guidance</span>
                  <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">{selectedClause.practicalGuidance}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedClause(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    const cl = selectedClause;
                    setSelectedClause(null);
                    handleOpenAdvisorForClause(cl);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✦ Interrogate with Matrix Advisor</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contract Create / Edit Modal */}
        <ContractModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingContract(null);
          }}
          onSave={handleSaveContract}
          initialData={editingContract}
          projectId={projectId}
          projectName={projectName}
        />

        {/* Contract Details View Modal */}
        <ContractDetailsModal
          isOpen={Boolean(viewingContract)}
          onClose={() => setViewingContract(null)}
          contract={viewingContract}
          projectName={projectName}
          onEdit={(c) => {
            setViewingContract(null);
            setEditingContract(c);
            setIsAddModalOpen(true);
          }}
          onDelete={(c) => {
            setViewingContract(null);
            setDeletingContract(c);
          }}
          onAddAttachment={(c) => {
            setUploadingForContract(c);
          }}
          onRemoveAttachment={handleRemoveAttachment}
          canEdit={canEdit}
          canDelete={canDelete}
        />

        {/* Contract Attachment Upload Modal */}
        <ContractAttachmentUploadModal
          isOpen={Boolean(uploadingForContract)}
          onClose={() => setUploadingForContract(null)}
          contract={uploadingForContract}
          onUpload={handleUploadAttachment}
        />

        {/* Contract Delete Confirm Modal */}
        <ContractDeleteConfirmModal
          isOpen={Boolean(deletingContract)}
          onClose={() => setDeletingContract(null)}
          contract={deletingContract}
          onConfirm={handleDeleteContract}
        />

        {/* Contract Configuration Wizard Modal */}
        <ContractConfigWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          projectId={projectId}
          projectName={projectName}
          onProfileSaved={(newProfile) => {
            setContractProfile(newProfile);
            setSelectedSuiteCode(newProfile.suiteCode);
          }}
        />

      </div>
    </ProjectShell>
  );
}
