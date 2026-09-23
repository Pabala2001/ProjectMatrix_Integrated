import React, { useState, useMemo } from "react";
import {
  BookOpen,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Search,
  Scale,
  ShieldCheck,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Sparkles,
  Upload,
  Layers,
  ArrowUpRight,
  Building,
  UserCheck,
  Calendar,
  DollarSign,
  FileCheck,
  Filter,
  Plus,
  ExternalLink,
  Info
} from "lucide-react";
import {
  CONTRACT_LIBRARY_TREE,
  CONTRACT_LIBRARY_DATABASE,
  getAllContractLibraryItems,
  searchContractLibrary,
  getContractsByFamily
} from "../../data/contractLibraryData";
import {
  ContractLibraryItem,
  ContractTreeNode,
  ContractFamily,
  ContractClauseItem,
  ContractNoticeTemplate
} from "../../types/contractLibrary";
import { StatusBadge } from "../ui/StatusBadge";

interface ContractLibraryExplorerProps {
  activeContractId?: string;
  onSelectContract?: (contract: ContractLibraryItem) => void;
  onApplyToProject?: (contract: ContractLibraryItem) => void;
  readOnly?: boolean;
}

export default function ContractLibraryExplorer({
  activeContractId = "fidic-red-2017",
  onSelectContract,
  onApplyToProject,
  readOnly = false
}: ContractLibraryExplorerProps) {
  // Selected Contract State
  const [selectedId, setSelectedId] = useState<string>(activeContractId);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [familyFilter, setFamilyFilter] = useState<string>("ALL");
  const [designFilter, setDesignFilter] = useState<string>("ALL");

  // Expanded Tree Nodes
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "cat-fidic": true,
    "fidic-red-group": true,
    "cat-nec": true,
    "nec-nec4-group": true,
    "cat-south-africa": true,
    "sa-gcc-group": true,
    "sa-jbcc-group": true,
    "cat-uk-international": true,
    "jct-group": true,
    "cat-custom": true
  });

  // Active Dossier Tab
  const [activeDossierTab, setActiveDossierTab] = useState<"overview" | "clauses" | "templates" | "custom_editor">("overview");
  
  // Clause topic filter inside active contract
  const [clauseTopicFilter, setClauseTopicFilter] = useState<string>("all");
  const [clauseSearch, setClauseSearch] = useState<string>("all");
  const [expandedClauseNumber, setExpandedClauseNumber] = useState<string | null>(null);

  // Copied Template Feedback
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [appliedSuccessId, setAppliedSuccessId] = useState<string | null>(null);

  // Upload modal / state for Custom uploaded contracts
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsingDoc, setIsParsingDoc] = useState(false);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const selectedContract: ContractLibraryItem =
    CONTRACT_LIBRARY_DATABASE[selectedId] || CONTRACT_LIBRARY_DATABASE["fidic-red-2017"];

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchContractLibrary(searchQuery);
  }, [searchQuery]);

  // Filtered Clauses for active contract
  const filteredClauses = useMemo(() => {
    if (!selectedContract.keyClauses) return [];
    return selectedContract.keyClauses.filter((clause) => {
      const matchTopic = clauseTopicFilter === "all" || clause.topic === clauseTopicFilter;
      const searchLow = clauseSearch === "all" || !clauseSearch.trim() ? "" : clauseSearch.toLowerCase();
      const matchSearch =
        !searchLow ||
        clause.clauseNumber.toLowerCase().includes(searchLow) ||
        clause.title.toLowerCase().includes(searchLow) ||
        clause.summary.toLowerCase().includes(searchLow) ||
        clause.practicalGuidance.toLowerCase().includes(searchLow);
      return matchTopic && matchSearch;
    });
  }, [selectedContract, clauseTopicFilter, clauseSearch]);

  const handleSelectContract = (contractId: string) => {
    setSelectedId(contractId);
    const item = CONTRACT_LIBRARY_DATABASE[contractId];
    if (item && onSelectContract) {
      onSelectContract(item);
    }
  };

  const handleApply = () => {
    if (onApplyToProject) {
      onApplyToProject(selectedContract);
    }
    setAppliedSuccessId(selectedContract.id);
    setTimeout(() => setAppliedSuccessId(null), 3000);
  };

  const handleCopyNotice = (template: ContractNoticeTemplate) => {
    navigator.clipboard.writeText(template.sampleBody);
    setCopiedTemplateId(template.id);
    setTimeout(() => setCopiedTemplateId(null), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      setIsParsingDoc(true);
      setTimeout(() => {
        setIsParsingDoc(false);
      }, 1500);
    }
  };

  // Render tree node recursively
  const renderTreeNode = (node: ContractTreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes[node.id];
    const isSelected = node.contractId === selectedId;
    const hasChildren = node.children && node.children.length > 0;

    const paddingLeft = `${depth * 14 + 10}px`;

    if (hasChildren) {
      return (
        <div key={node.id} className="select-none">
          <button
            type="button"
            onClick={() => toggleNode(node.id)}
            style={{ paddingLeft }}
            className={`w-full flex items-center justify-between py-1.5 pr-2 text-left hover:bg-slate-100 rounded-md text-xs transition-colors group cursor-pointer ${
              node.type === "category"
                ? "font-bold text-slate-800 uppercase tracking-wider text-[11px] mt-1"
                : "font-semibold text-slate-700 text-xs"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
              )}
              {node.type === "category" && <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <span className="truncate">{node.title}</span>
            </div>
            {node.type === "category" && (
              <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-mono font-medium">
                {node.children?.length || 0}
              </span>
            )}
          </button>

          {isExpanded && (
            <div className="relative border-l border-slate-200 ml-3.5 my-0.5">
              {node.children?.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.id}
        type="button"
        onClick={() => node.contractId && handleSelectContract(node.contractId)}
        style={{ paddingLeft }}
        className={`w-full flex items-center justify-between py-1.5 pr-2 rounded-md text-xs text-left transition-all cursor-pointer ${
          isSelected
            ? "bg-amber-500/10 text-amber-900 font-bold border-r-2 border-amber-500 shadow-xs"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isSelected ? "bg-amber-500 ring-2 ring-amber-200" : "bg-slate-300"
            }`}
          />
          <span className="truncate">{node.title}</span>
        </div>
        {node.contractId?.startsWith("custom") && (
          <span className="text-[8px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-1 py-0.2 rounded shrink-0">
            Bespoke
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[720px]">
      {/* ========================================================================= */}
      {/* LEFT COLUMN: CONTRACT LIBRARY TREE & QUICK SEARCH */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
        {/* Search Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contracts or clauses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Family Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pt-2.5 pb-0.5 scrollbar-thin text-[10px] font-semibold text-slate-500">
            {["ALL", "FIDIC", "NEC", "SOUTH_AFRICA", "UK_INTERNATIONAL", "CUSTOM"].map((fam) => (
              <button
                key={fam}
                onClick={() => setFamilyFilter(fam)}
                className={`px-2 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  familyFilter === fam
                    ? "bg-slate-900 text-white font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {fam === "ALL"
                  ? "All"
                  : fam === "SOUTH_AFRICA"
                  ? "South Africa"
                  : fam === "UK_INTERNATIONAL"
                  ? "UK / JCT"
                  : fam}
              </button>
            ))}
          </div>
        </div>

        {/* Tree Explorer Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Contract Library Tree
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400">
              {Object.keys(CONTRACT_LIBRARY_DATABASE).length} Standards
            </span>
          </div>

          <div className="p-3 overflow-y-auto max-h-[640px] space-y-1 scrollbar-thin">
            {searchQuery.trim() && searchResults ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Search Results ({searchResults.length})
                </p>
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectContract(item.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      item.id === selectedId
                        ? "bg-amber-500/10 border-amber-500 text-slate-900 font-bold shadow-xs"
                        : "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{item.shortName}</span>
                      <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-semibold">
                        {item.categoryName}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{item.name}</p>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No matching standard contracts found.
                  </div>
                )}
              </div>
            ) : (
              CONTRACT_LIBRARY_TREE.filter((cat) => {
                if (familyFilter === "ALL") return true;
                if (familyFilter === "FIDIC") return cat.id === "cat-fidic";
                if (familyFilter === "NEC") return cat.id === "cat-nec";
                if (familyFilter === "SOUTH_AFRICA") return cat.id === "cat-south-africa";
                if (familyFilter === "UK_INTERNATIONAL") return cat.id === "cat-uk-international";
                if (familyFilter === "CUSTOM") return cat.id === "cat-custom";
                return true;
              }).map((catNode) => renderTreeNode(catNode, 0))
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-amber-500" />
              <span>International & Regional Forms</span>
            </span>
            <span className="font-semibold text-slate-700">Project Matrix v2.4</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: DETAILED CONTRACT DOSSIER & ADMINISTRATION */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col gap-4">
        {/* CONTRACT HEADER BANNER */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/5 via-transparent to-transparent pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-bold uppercase tracking-wider">
                  {selectedContract.categoryName}
                </span>
                <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-800 border border-amber-500/20 rounded-md text-[10px] font-bold">
                  {selectedContract.groupName}
                </span>
                {selectedContract.subEdition && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold">
                    {selectedContract.subEdition}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    selectedContract.riskProfile === "Balanced"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedContract.riskProfile === "Target Cost / Collaborative"
                      ? "bg-blue-100 text-blue-800"
                      : selectedContract.riskProfile === "Contractor Heavy"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-orange-100 text-orange-800"
                  }`}
                >
                  {selectedContract.riskProfile} Risk Model
                </span>
              </div>

              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {selectedContract.name}
              </h1>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedContract.publisher}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedContract.governingBody}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700">
                    {selectedContract.designResponsibility}
                  </span>
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {!readOnly && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleApply}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
                    appliedSuccessId === selectedContract.id
                      ? "bg-emerald-600 text-white"
                      : "bg-[#FF9F1C] hover:bg-amber-500 text-slate-950"
                  }`}
                >
                  {appliedSuccessId === selectedContract.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Active on Project</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Apply Standard to Project</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Regional coverage tags */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Primary Jurisdiction Coverage:
            </span>
            {selectedContract.recommendedRegions.map((region) => (
              <span
                key={region}
                className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200/80 rounded-md text-[10px] font-medium"
              >
                {region}
              </span>
            ))}
          </div>
        </div>

        {/* DOSSIER TABS NAVIGATION */}
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveDossierTab("overview")}
            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeDossierTab === "overview"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Governance & Timelines</span>
          </button>

          <button
            onClick={() => setActiveDossierTab("clauses")}
            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeDossierTab === "clauses"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Standard Clauses Matrix ({selectedContract.keyClauses.length})</span>
          </button>

          <button
            onClick={() => setActiveDossierTab("templates")}
            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeDossierTab === "templates"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Notice Templates ({selectedContract.noticeTemplates.length})</span>
          </button>

          {(selectedContract.isCustom || selectedContract.isUploaded) && (
            <button
              onClick={() => setActiveDossierTab("custom_editor")}
              className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeDossierTab === "custom_editor"
                  ? "bg-purple-900 text-white shadow-xs"
                  : "text-purple-700 bg-purple-50 hover:bg-purple-100"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Bespoke Parser & Particulars</span>
            </button>
          )}
        </div>

        {/* DOSSIER CONTENT TAB 1: OVERVIEW & GOVERNANCE TIMELINES */}
        {activeDossierTab === "overview" && (
          <div className="space-y-4">
            {/* Core Philosophy Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                Contract Philosophy & Risk Allocation
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {selectedContract.corePhilosophy}
              </p>
            </div>

            {/* Key Actors & Roles Grid */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                Key Actors & Administrative Roles
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    The Employer / Client
                  </span>
                  <p className="text-xs font-bold text-slate-800">{selectedContract.keyActors.employer}</p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    The Contractor
                  </span>
                  <p className="text-xs font-bold text-slate-800">{selectedContract.keyActors.contractor}</p>
                </div>

                <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                    Contract Administrator / Engineer
                  </span>
                  <p className="text-xs font-bold text-amber-950">{selectedContract.keyActors.administrator}</p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Dispute Adjudication Board
                  </span>
                  <p className="text-xs font-bold text-slate-800">{selectedContract.keyActors.adjudicatorBoard}</p>
                </div>
              </div>
            </div>

            {/* Essential Governance Timelines Matrix */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Statutory & Contractual Administration Timelines
                </h3>
                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Strict Condition Precedent Time-Bars Enforced
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                      Initial Claim Notice Window
                    </span>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <p className="text-sm font-black text-rose-950">
                    {selectedContract.keyTimelines.claimNoticeWindow}
                  </p>
                  <p className="text-[10px] text-rose-700">
                    Failure to serve notice within this window bars subsequent financial or time claims.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Claim Substantiation & Particulars
                    </span>
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {selectedContract.keyTimelines.claimSubstantiationWindow}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Contemporary daily diaries, plant logs, and critical path delay analysis submission.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Administrator Ruling / Determination
                    </span>
                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {selectedContract.keyTimelines.rulingWindow}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Consultation and formal written determination period.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Payment Certification & Disbursement
                    </span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    Cert: {selectedContract.keyTimelines.paymentCertificationPeriod} | Pay:{" "}
                    {selectedContract.keyTimelines.paymentPeriod}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Late payment formula: {selectedContract.keyTimelines.latePaymentInterestFormula}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Defects Notification & Latent Defects Liabilities
                    </span>
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    DNP / Patent Defects: {selectedContract.keyTimelines.defectsLiabilityPeriod} | Latent
                    Defects: {selectedContract.keyTimelines.latentDefectsPeriod}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOSSIER CONTENT TAB 2: STANDARD CLAUSES MATRIX */}
        {activeDossierTab === "clauses" && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {/* Clause Search & Topic Filter */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="relative w-full md:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter clauses by title or number..."
                  value={clauseSearch === "all" ? "" : clauseSearch}
                  onChange={(e) => setClauseSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto text-[10px] font-semibold text-slate-500">
                {[
                  { id: "all", label: "All Topics" },
                  { id: "delays_eot", label: "Delays & EOT" },
                  { id: "claims_procedure", label: "Claims & Notices" },
                  { id: "variations_pricing", label: "Variations" },
                  { id: "supervision", label: "Supervision" },
                  { id: "quality_defects", label: "Quality & Design" }
                ].map((top) => (
                  <button
                    key={top.id}
                    onClick={() => setClauseTopicFilter(top.id)}
                    className={`px-2 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                      clauseTopicFilter === top.id
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {top.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clause Expansion List */}
            <div className="space-y-3">
              {filteredClauses.map((clause) => {
                const isExpanded = expandedClauseNumber === clause.clauseNumber;
                return (
                  <div
                    key={clause.clauseNumber}
                    className="border border-slate-200/80 rounded-xl overflow-hidden transition-all shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedClauseNumber(isExpanded ? null : clause.clauseNumber)
                      }
                      className="w-full p-3.5 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-amber-500/10 text-amber-900 border border-amber-500/20 rounded font-mono font-bold text-xs">
                          {clause.clauseNumber}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{clause.title}</h4>
                          <p className="text-[10px] text-slate-500 line-clamp-1">{clause.summary}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {clause.timeBarDays && (
                          <span className="text-[9px] px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold">
                            {clause.timeBarDays} {clause.timeBarType || "days"} time-bar
                          </span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform ${
                            isExpanded ? "rotate-180 text-amber-600" : ""
                          }`}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-slate-100 space-y-3.5 text-xs">
                        <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/15">
                          <span className="text-[10px] font-bold uppercase text-amber-900 tracking-wider block mb-1">
                            Clause Summary & Intent
                          </span>
                          <p className="text-slate-700 leading-relaxed font-medium">{clause.summary}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
                              Contractor Rights & Duties
                            </span>
                            <p className="text-slate-700">{clause.contractorRightOrDuty}</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
                              Employer Obligations & Liabilities
                            </span>
                            <p className="text-slate-700">{clause.employerRightOrDuty}</p>
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200/60">
                          <span className="text-[10px] font-bold uppercase text-blue-800 tracking-wider block mb-1">
                            Practical Site Administration Guidance
                          </span>
                          <p className="text-slate-700 font-medium">{clause.practicalGuidance}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredClauses.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                  <FileText className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">No clauses match the selected filters.</p>
                  <p className="text-[10px] text-slate-400">
                    Switch the topic filter above to explore additional standard contract clauses.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DOSSIER CONTENT TAB 3: NOTICE & CLAIM TEMPLATES */}
        {activeDossierTab === "templates" && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Contractual Notice & Claim Templates
                </h3>
                <p className="text-[10px] text-slate-500">
                  Standardized notice language aligned with {selectedContract.shortName} clauses.
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                1-Click Copy Ready
              </span>
            </div>

            <div className="space-y-4">
              {selectedContract.noticeTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{template.title}</h4>
                      <p className="text-[10px] font-mono font-semibold text-amber-700">
                        {template.clauseReference}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyNotice(template)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        copiedTemplateId === template.id
                          ? "bg-emerald-600 text-white"
                          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {copiedTemplateId === template.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Template Text</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 font-medium">{template.description}</p>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {template.sampleBody}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Key Drafting Requirements:
                    </span>
                    {template.keyRequirements.map((req, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200/70 rounded text-[9px] font-medium"
                      >
                        ✓ {req}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {selectedContract.noticeTemplates.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                  <FileText className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">
                    Standard notices for {selectedContract.shortName} are derived from general suite templates.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    You can generate custom project notices directly in the Contract Governance & Notices tab.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DOSSIER CONTENT TAB 4: BESPOKE & UPLOADED CONTRACT PARSER */}
        {activeDossierTab === "custom_editor" && (
          <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-purple-100">
              <div>
                <h3 className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-600" />
                  Bespoke & Uploaded Contract Intelligence
                </h3>
                <p className="text-xs text-purple-700">
                  Upload project-specific contracts (PDF/DOCX) to automatically map custom notice time-bars and dispute ladders.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold">
                AI Clause Extractor
              </span>
            </div>

            {/* Document Upload Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setUploadDragOver(true);
              }}
              onDragLeave={() => setUploadDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setUploadDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setUploadedFileName(file.name);
                  setIsParsingDoc(true);
                  setTimeout(() => setIsParsingDoc(false), 1500);
                }
              }}
              className={`p-8 border-2 border-dashed rounded-2xl text-center transition-all ${
                uploadDragOver
                  ? "border-purple-600 bg-purple-50"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100/80"
              }`}
            >
              <input
                type="file"
                id="contract-upload-input"
                accept=".pdf,.docx,.doc"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="contract-upload-input" className="cursor-pointer block space-y-2">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {uploadedFileName ? (
                    <span className="text-emerald-700">Loaded: {uploadedFileName}</span>
                  ) : (
                    "Click to upload or drag & drop Particular Conditions / Signed Agreement"
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Supported formats: PDF, DOCX, DOC (Up to 50MB)</p>
              </label>

              {isParsingDoc && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-purple-800">
                  <Sparkles className="w-4 h-4 animate-spin text-purple-600" />
                  <span>Analyzing clauses, identifying time-bars, and configuring risk rules...</span>
                </div>
              )}
            </div>

            {/* Extracted Clause Matrix Preview */}
            <div className="p-4 bg-purple-500/5 rounded-xl border border-purple-200/80 space-y-3">
              <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                Configured Particular Conditions & Rules
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Custom Notice Time-Bar
                  </span>
                  <span className="font-black text-purple-950 text-sm">21 Calendar Days</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Liquidated Damages Cap
                  </span>
                  <span className="font-black text-purple-950 text-sm">10% of Contract Value</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Dispute Escalation Ladder
                  </span>
                  <span className="font-black text-purple-950 text-sm">Negotiation → Adjudication</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
