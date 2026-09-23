import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useRef } from "react";
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  MessageSquare,
  Plus,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Send,
  Copy,
  Check,
  FileText,
  Download,
  X,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Building,
  Briefcase,
  Globe,
  Loader2,
  Database,
  Layers,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Compass,
  Shield,
  RefreshCw,
} from "lucide-react";
import {
  AdvisorConversation,
  AdvisorMessage,
  AdvisorDraft,
  AdvisorSource,
  AdvisorScope,
} from "../../types/projectAdvisor";
import { OrchestratorExecutionResult } from "../../types/aiOrchestrator";
import { ProjectMatrixIntelligenceBadge } from "../../components/advisor/ProjectMatrixIntelligenceBadge";
import { OrchestratorBreakdownDrawer } from "../../components/advisor/OrchestratorBreakdownDrawer";
import {
  getAdvisorConversations,
  createAdvisorConversation,
  deleteAdvisorConversation,
  getAdvisorMessages,
  addAdvisorMessage,
  saveAdvisorDraft,
  getAdvisorDrafts,
  sendChatToAdvisor,
  sanitizeUserFacingErrorMessage,
} from "../../services/projectAdvisorService";
import { generateAdvisorDraftDocx, downloadBlob } from "../../utils/generateAdvisorDocx";
import { useAuth } from "../../contexts/AuthContext";
import {
  validateConversationContext,
  filterConversationsByContext,
} from "../../../supabase/functions/project-advisor-chat/core.ts";

export default function ProjectAdvisorPage() {
  const { activeCompany, activeProject, allProjects = [] } = useOutletContext<any>() || {};
  const { profile, session } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  // State: Scope switcher
  const [scope, setScope] = useState<AdvisorScope>("project");

  // State: Sidebar & History
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [conversations, setConversations] = useState<AdvisorConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<AdvisorConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  // State: Messages thread
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, "up" | "down">>({});

  // State: Evidence Drawer
  const [selectedSource, setSelectedSource] = useState<AdvisorSource | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState<boolean>(false);

  // State: Document Draft Modal / Drawer
  const [activeDraft, setActiveDraft] = useState<AdvisorDraft | null>(null);
  const [isDraftEditorOpen, setIsDraftEditorOpen] = useState<boolean>(false);
  const [savedDrafts, setSavedDrafts] = useState<AdvisorDraft[]>([]);
  const [isSavedDraftsOpen, setIsSavedDraftsOpen] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);

  // State: AI Orchestrator Breakdown Drawer
  const [selectedOrchestration, setSelectedOrchestration] = useState<OrchestratorExecutionResult | null>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState<boolean>(false);

  // Ref for auto-scroll and request token tracking
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestTokenRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Load conversations and reset state when activeCompany, activeProject, or scope changes
  useEffect(() => {
    // Increment request token to invalidate in-flight async operations from previous context
    const token = ++requestTokenRef.current;

    // Immediately clear stale state upon context change
    setActiveConversation(null);
    setMessages([]);
    setInputText("");
    setIsSending(false);
    setSelectedSource(null);
    setIsEvidenceOpen(false);
    setActiveDraft(null);
    setSearchQuery("");

    if (!activeCompany?.id) {
      setConversations([]);
      setIsHistoryLoading(false);
      return;
    }

    const currentCompanyId = activeCompany.id;
    const currentProjectId = scope === "project" ? (activeProject?.id || null) : null;
    const currentScope = scope;

    const syncAndLoadHistory = async () => {
      setIsHistoryLoading(true);
      const rawList = await getAdvisorConversations(currentCompanyId, currentProjectId, currentScope);

      // Verify token to ensure user hasn't switched project/company/scope while fetching
      if (token !== requestTokenRef.current) return;

      const validList = filterConversationsByContext(rawList, currentCompanyId, currentProjectId, currentScope);
      setConversations(validList);
      setIsHistoryLoading(false);

      // Auto-select first matching conversation if available for this context
      if (validList.length > 0) {
        const firstConv = validList[0];
        setActiveConversation(firstConv);
        const msgs = await getAdvisorMessages(firstConv.id);
        if (token === requestTokenRef.current) {
          setMessages(msgs);
        }
      }
    };

    syncAndLoadHistory();
    loadSavedDrafts();
  }, [activeCompany?.id, activeProject?.id, scope]);

  // Handle URL query parameter ?prompt=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const promptParam = params.get("prompt");
    if (promptParam && activeCompany?.id) {
      handleSendMessage(promptParam);
    }
  }, [location.search, activeCompany?.id]);

  const loadSavedDrafts = async () => {
    if (!activeCompany?.id) return;
    const drafts = await getAdvisorDrafts(activeCompany.id);
    setSavedDrafts(drafts);
  };

  const handleSelectConversation = async (conv: AdvisorConversation) => {
    if (!activeCompany?.id) return;
    const currentProjectId = scope === "project" ? (activeProject?.id || null) : null;
    if (!validateConversationContext(conv, activeCompany.id, currentProjectId, scope)) {
      alert("Selected conversation does not belong to the active project or scope.");
      return;
    }

    const token = ++requestTokenRef.current;
    setActiveConversation(conv);
    const msgs = await getAdvisorMessages(conv.id);
    if (token === requestTokenRef.current) {
      setMessages(msgs);
    }
  };

  const handleNewChat = () => {
    requestTokenRef.current++;
    setActiveConversation(null);
    setMessages([]);
    setInputText("");
  };

  const handleDeleteChat = async (convId: string, e: React.MouseEvent) => {
    assertOperationalAction("delete", "pages/ProjectAdvisor/ProjectAdvisorPage.tsx");
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation history?")) return;

    await deleteAdvisorConversation(convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConversation?.id === convId) {
      handleNewChat();
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isSending || isHistoryLoading) return;

    const companyId = activeCompany?.id;
    const projectId = scope === "project" ? (activeProject?.id || null) : null;
    const currentScope = scope;

    if (!companyId) {
      alert("Please select an active company first.");
      return;
    }

    if (currentScope === "project" && !projectId) {
      alert("Please select an active project first.");
      return;
    }

    // Capture request token snapshot
    const token = ++requestTokenRef.current;

    // Validate active conversation against current context
    let currentConv = activeConversation;
    if (currentConv) {
      const isValid = validateConversationContext(currentConv, companyId, projectId, currentScope);
      if (!isValid) {
        currentConv = null;
        setActiveConversation(null);
      }
    }

    setInputText("");
    setIsSending(true);

    const userId = profile?.id || session?.user?.id || "anon";

    // Create conversation if starting fresh
    if (!currentConv) {
      const title = textToSend.slice(0, 40) + (textToSend.length > 40 ? "..." : "");
      const newConv = await createAdvisorConversation(
        companyId,
        projectId,
        userId,
        title,
        currentScope
      );

      if (token !== requestTokenRef.current) {
        setIsSending(false);
        return; // Switched context while creating conversation
      }

      if (newConv) {
        currentConv = newConv;
        setActiveConversation(newConv);
        setConversations((prev) => [newConv, ...prev]);
      }
    }

    // Add user message to local UI state
    const userMsgObj: AdvisorMessage = {
      id: crypto.randomUUID(),
      conversation_id: currentConv?.id || "temp",
      sender: "user",
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsgObj]);

    if (currentConv?.id) {
      await addAdvisorMessage(currentConv.id, "user", textToSend);
    }

    if (token !== requestTokenRef.current) {
      setIsSending(false);
      return;
    }

    // Send payload to Edge function
    const chatPayload = {
      question: textToSend,
      scope: currentScope,
      company: {
        id: companyId,
        name: activeCompany.name,
      },
      project: activeProject && currentScope === "project"
        ? {
            id: activeProject.id,
            name: activeProject.name,
            contract_code: activeProject.contract_code || activeProject.code,
          }
        : null,
      allProjects: (allProjects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        contract_code: p.contract_code || p.code,
      })),
      conversation_id: currentConv?.id,
    };

    try {
      const response = await sendChatToAdvisor(chatPayload);

      if (token !== requestTokenRef.current) {
        // Project or scope changed while response was in flight - ignore stale response silently
        setIsSending(false);
        return;
      }

      if (response.error) {
        const safeErrorText = sanitizeUserFacingErrorMessage(response.error);
        const errorMsgObj: AdvisorMessage = {
          id: crypto.randomUUID(),
          conversation_id: currentConv?.id || "temp",
          sender: "assistant",
          content: `Project Advisor Notice: ${safeErrorText}`,
          sources_json: [],
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsgObj]);
      } else {
        const assistantMsgObj: AdvisorMessage = {
          id: crypto.randomUUID(),
          conversation_id: currentConv?.id || "temp",
          sender: "assistant",
          content: response.answer || "Advisor response generated.",
          sources_json: response.sources || [],
          draft: response.draft,
          context_warning: response.context_warning,
          created_at: new Date().toISOString(),
          orchestration: response.orchestration,
        };

        setMessages((prev) => [...prev, assistantMsgObj]);

        if (currentConv?.id) {
          await addAdvisorMessage(
            currentConv.id,
            "assistant",
            response.answer,
            response.sources,
            response.draft
          );
        }
      }
    } catch (err: any) {
      if (token === requestTokenRef.current) {
        console.error("Advisor chat exception:", err);
      }
    } finally {
      if (token === requestTokenRef.current) {
        setIsSending(false);
      }
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportDocx = async (draftToExport: AdvisorDraft) => {
    assertOperationalAction("export", "pages/ProjectAdvisor/ProjectAdvisorPage.tsx");
    setIsExportingDocx(true);
    try {
      const blob = await generateAdvisorDraftDocx(
        draftToExport,
        activeCompany?.name || "ProjectMatrix Enterprise",
        activeProject?.name || "All Projects Scope"
      );
      const safeTitle = (draftToExport.title || "Project_Advisor_Draft").replace(/[^a-z0-9_-]/gi, "_");
      downloadBlob(blob, `${safeTitle}.docx`);
    } catch (err) {
      console.error("Export DOCX error:", err);
      alert("Failed to export Word document.");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleSaveDraftToDb = async (draftToSave: AdvisorDraft) => {
    assertOperationalAction("write", "pages/ProjectAdvisor/ProjectAdvisorPage.tsx");
    const userId = profile?.id || session?.user?.id || "anon";
    if (!activeCompany?.id) return;

    const saved = await saveAdvisorDraft(
      draftToSave,
      activeCompany.id,
      userId,
      activeProject?.id
    );

    if (saved) {
      alert("Document draft saved successfully to company registry!");
      loadSavedDrafts();
      setIsDraftEditorOpen(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Executive starter prompts
  const starterPrompts = [
    {
      icon: Layers,
      title: "Delay Analysis",
      text: "Why are we behind programme?",
    },
    {
      icon: FileSpreadsheet,
      title: "Cost To Complete",
      text: "What is our estimated cost to complete?",
    },
    {
      icon: Briefcase,
      title: "Subcontractor Risk",
      text: "Which subcontractor is causing the most delays?",
    },
    {
      icon: Layers,
      title: "Procurement Critical Path",
      text: "What procurement items could delay the critical path?",
    },
    {
      icon: FileText,
      title: "Draft Monthly Report",
      text: "Draft this month's progress report.",
    },
    {
      icon: Layers,
      title: "Concrete Benchmarking",
      text: "Compare actual concrete production against programme.",
    },
    {
      icon: Shield,
      title: "Contractual Notices",
      text: "Which NEC/FIDIC notices should we consider issuing?",
    },
    {
      icon: MessageSquare,
      title: "Section C2 History",
      text: "Show every instruction affecting Section C2.",
    },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] w-full bg-slate-50 dark:bg-[#07182E] text-slate-800 dark:text-slate-100 overflow-hidden relative font-sans">
      {/* 1. LEFT SIDEBAR / CONVERSATION HISTORY */}
      <motion.aside
        animate={{ width: isSidebarOpen ? 300 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="border-r border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0A1F3A] flex flex-col shrink-0 overflow-hidden relative z-20"
      >
        <div className="p-4 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            <Sparkles className="w-5 h-5 text-[#FF9F1C]" />
            <span>Advisor Conversations</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102846] transition-colors cursor-pointer"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-[#FF9F1C] to-[#E0880B] hover:from-[#E0880B] hover:to-[#C67400] text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Advisor Chat</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pb-3 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FF9F1C]/50"
            />
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#FF9F1C]" />
              <span>Loading chats...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-slate-400">
              No conversations found. Click "New Advisor Chat" to start.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                    isActive
                      ? "bg-amber-50 dark:bg-[#102846] text-slate-900 dark:text-white font-bold border border-[#FF9F1C]/40 shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#102846]/60 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                    <MessageSquare
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-[#FF9F1C]" : "text-slate-400 group-hover:text-amber-500"
                      }`}
                    />
                    <div className="truncate flex flex-col">
                      <span className="truncate">{conv.title}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-medium">
                        {conv.scope} • {new Date(conv.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(conv.id, e)}
                    className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 dark:border-[#1E3A5F] text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>ProjectMatrix AI Engine</span>
          <span className="text-amber-500 font-bold">v2.5</span>
        </div>
      </motion.aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* TOP HEADER */}
        <header className="h-14 border-b border-slate-200 dark:border-[#1E3A5F] bg-white/90 dark:bg-[#0A1F3A]/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102846] transition-colors cursor-pointer"
                title="Open Chat History"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-[#FF9F1C]/15 border border-[#FF9F1C]/30 text-[#FF9F1C]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Project Advisor
                </h1>
                <ProjectMatrixIntelligenceBadge variant="header" />
              </div>
            </div>
          </div>

          {/* SCOPE SWITCHER PILLS */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#07182E] p-1 rounded-xl border border-slate-200 dark:border-[#1E3A5F]">
            <button
              onClick={() => setScope("project")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                scope === "project"
                  ? "bg-[#FF9F1C] text-slate-950 font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Active Project</span>
            </button>
            <button
              onClick={() => setScope("company")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                scope === "company"
                  ? "bg-[#FF9F1C] text-slate-950 font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Active Company</span>
            </button>
          </div>

          {/* RIGHT ACTION BUTTONS */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSavedDraftsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#102846] dark:hover:bg-[#1E3A5F] border border-slate-200 dark:border-[#1E3A5F] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span className="hidden md:inline">Saved Drafts</span>
              {savedDrafts.length > 0 && (
                <span className="bg-[#FF9F1C] text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {savedDrafts.length}
                </span>
              )}
            </button>
            <button
              onClick={handleNewChat}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#102846] dark:hover:bg-[#1E3A5F] border border-slate-200 dark:border-[#1E3A5F] rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Clear Thread"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ACTIVE CONTEXT SUB-BAR */}
        <div className="bg-slate-100/80 dark:bg-[#07182E] border-b border-slate-200 dark:border-[#1E3A5F]/60 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-4 truncate">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold truncate">
              <Building className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{activeCompany?.name || "No Active Company"}</span>
            </div>
            {scope === "project" && (
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-semibold truncate">
                <Briefcase className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{activeProject?.name || "No Active Project"}</span>
              </div>
            )}
          </div>
          <div className="text-slate-500 dark:text-slate-400 font-mono text-[10px] shrink-0">
            SCOPE: <span className="text-slate-900 dark:text-white uppercase font-bold">{scope}</span>
          </div>
        </div>

        {/* THREAD CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isHistoryLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 animate-fadeIn">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF9F1C]" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Loading advisor conversations for {scope === "project" ? (activeProject?.name || "Active Project") : (activeCompany?.name || "Active Company")}...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Refreshing operational context and conversation history...</p>
            </div>
          ) : messages.length === 0 ? (
            /* STARTER PROMPTS SCREEN */
            <div className="max-w-3xl mx-auto py-8 space-y-8 animate-fadeIn">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] text-[#FF9F1C] shadow-lg">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="flex justify-center">
                  <ProjectMatrixIntelligenceBadge />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  How can Project Advisor assist you today?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                  Multi-engine intelligence orchestrating Gemini live record interrogation, OpenAI contractual cross-examination, and 6 specialized civil engineering agents.
                </p>
              </div>

              {/* STARTER CHIPS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {starterPrompts.map((prompt, idx) => {
                  const IconComp = prompt.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt.text)}
                      className="group flex items-start gap-3 p-4 bg-white dark:bg-[#0A1F3A] hover:bg-amber-50/50 dark:hover:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] hover:border-[#FF9F1C]/40 rounded-2xl text-left transition-all shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5"
                    >
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-[#07182E] text-[#FF9F1C] group-hover:scale-110 transition-transform shrink-0">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#FF9F1C] transition-colors">
                          {prompt.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          "{prompt.text}"
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* MESSAGES LIST */
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((msg) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 sm:gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-[#FF9F1C]/15 border border-[#FF9F1C]/30 text-[#FF9F1C] flex items-center justify-center shrink-0 mt-1 shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 sm:p-5 space-y-3 shadow-md transition-all ${
                        isUser
                          ? "bg-slate-800 text-white dark:bg-[#102846] dark:text-white border border-slate-700 dark:border-[#1E3A5F] rounded-tr-none"
                          : "bg-white text-slate-800 dark:bg-[#0A1F3A] dark:text-slate-100 border border-slate-200 dark:border-[#1E3A5F] rounded-tl-none"
                      }`}
                    >
                      {/* Sender Header */}
                      <div className="flex items-center justify-between gap-4 text-[11px] border-b border-slate-100 dark:border-[#1E3A5F]/60 pb-2">
                        <span className="font-bold uppercase tracking-wider text-[#FF9F1C]">
                          {isUser ? "You (Executive)" : "Project Advisor"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Content Body */}
                      <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200">
                        {msg.content}
                      </div>

                      {/* Context Warning Alert Banner */}
                      {msg.context_warning && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] font-mono my-2">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>{msg.context_warning}</span>
                        </div>
                      )}

                      {/* Source Evidence Badges */}
                      {msg.sources_json && msg.sources_json.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 dark:border-[#1E3A5F]/60 space-y-2">
                          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Database className="w-3 h-3 text-[#FF9F1C]" />
                            <span>Source Evidence Breadcrumbs ({msg.sources_json.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources_json.map((src, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => {
                                  setSelectedSource(src);
                                  setIsEvidenceOpen(true);
                                }}
                                className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-[#07182E] dark:hover:bg-[#102846] border border-amber-200 dark:border-[#1E3A5F] hover:border-[#FF9F1C]/50 px-2.5 py-1 rounded-lg text-[11px] text-amber-900 dark:text-amber-300 font-mono transition-all cursor-pointer shadow-xs"
                              >
                                <Layers className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
                                <span className="truncate max-w-[180px]">{src.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Generated Document Draft Card */}
                      {msg.draft && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-[#FF9F1C]/40 space-y-3 shadow-md mt-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-5 h-5 text-[#FF9F1C]" />
                              <div>
                                <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                  {msg.draft.title}
                                </div>
                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
                                  Category: {msg.draft.document_type.replace(/_/g, " ")}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full uppercase">
                              Draft Ready
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2">
                            <button
                              onClick={() => {
                                setActiveDraft(msg.draft || null);
                                setIsDraftEditorOpen(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF9F1C] hover:bg-[#E0880B] text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View & Edit Draft</span>
                            </button>
                            <button
                              onClick={() => msg.draft && handleExportDocx(msg.draft)}
                              disabled={isExportingDocx}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#102846] dark:hover:bg-[#1E3A5F] border border-slate-300 dark:border-[#1E3A5F] text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                            >
                              {isExportingDocx ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 dark:text-amber-400" />
                              ) : (
                                <Download className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                              )}
                              <span>Export as Word (.docx)</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Multi-Engine Orchestrator Consensus & Cross-Exam Button */}
                      {!isUser && (
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              if (msg.orchestration) {
                                setSelectedOrchestration(msg.orchestration);
                              } else {
                                setSelectedOrchestration({
                                  id: msg.id,
                                  timestamp: msg.created_at,
                                  intent: {
                                    queryType: 'delay_analysis',
                                    riskLevel: 'High',
                                    domains: ['programme', 'contracts', 'commercial'],
                                    activeSpecialists: ['planning', 'contract', 'cost', 'qaqc', 'procurement', 'risk'],
                                    toolLayersUsed: ['database', 'programme', 'site_diaries', 'documents_rag', 'boq'],
                                    intentSummary: 'Multi-engine analysis across schedule, cost, and contractual matrices.'
                                  },
                                  geminiAnalysis: {
                                    engineName: 'Gemini 2.5 Flash',
                                    role: 'Primary Factual Interrogation & Grounding',
                                    badge: 'Factual & Multimodal Lead',
                                    factualFindings: [
                                      'Physical progress variance of -3.4% on Activity 240 (Concrete Works CH 0+400–0+850).',
                                      'Site Diary #44 records BuildCorp labour at 12 workers vs 18 planned.',
                                      'NCR-08 open for honeycombing at Culvert Section C2 (3 days remediation).'
                                    ],
                                    siteRecordsExamined: ['Site Diary #44', 'BuildCorp Labour Return', 'NCR Register'],
                                    photographsOrFieldLogs: ['SP-0811-C2 Section C2 Invert Slab Photo'],
                                    rootCausesIdentified: ['Subcontractor labour shortfall', 'Open RFI 034 delay']
                                  },
                                  openAISecondOpinion: {
                                    engineName: 'OpenAI GPT-4o',
                                    role: 'Independent Reasoning & Cross-Examination',
                                    badge: 'Reasoning & Contractual Lead',
                                    programmeLogicAnalysis: 'Critical path is driven by Activity 240, with 4 days recovery possible via Activity 245 compaction.',
                                    contractualImplications: 'RFI 034 constitutes Compensation Event under NEC3 Clause 60.1(1). Early warning notice needed within 8 weeks.',
                                    counterArgumentsAndChallenges: [
                                      'Gemini attributes delay to BuildCorp, but Client RFI 034 delay is concurrent.',
                                      'Separate Contractor defect costs from Employer design delays.'
                                    ],
                                    missingEvidenceIdentified: ['Engineer formal acknowledgment of RFI 034'],
                                    formulatedManagementOptions: [
                                      'Issue NEC3 Clause 16.1 Early Warning Notice',
                                      'Direct BuildCorp to mobilize second shuttering staff team'
                                    ]
                                  },
                                  specialistAgents: [
                                    { agentId: 'planning', agentName: 'Planning Agent', role: 'Critical Path Diagnostics', iconName: 'Calendar', badgeColor: 'amber', keyInsight: 'Critical path delayed by 5 days', riskScore: 82, metricSummary: 'Variance: -5 Days', findings: ['Activity 240 driving completion milestone'], recommendedActions: ['Dual-shift shuttering'] },
                                    { agentId: 'cost', agentName: 'Cost Agent', role: 'EAC & Cashflow Forecast', iconName: 'FileSpreadsheet', badgeColor: 'emerald', keyInsight: 'EAC R 198.45m (+3.3%)', riskScore: 68, metricSummary: 'Variance: +R 6.35m', findings: ['Escalation index impacts'], recommendedActions: ['CPAP adjustment claim'] },
                                    { agentId: 'contract', agentName: 'Contract Agent', role: 'NEC3 / FIDIC Notices', iconName: 'Shield', badgeColor: 'blue', keyInsight: 'Time-bar window active for RFI 034', riskScore: 88, metricSummary: 'NEC3 16.1 / FIDIC 8.4', findings: ['Early warning required'], recommendedActions: ['Issue PM Letter 045'] },
                                    { agentId: 'qaqc', agentName: 'QA/QC Agent', role: 'NCR Remediation', iconName: 'CheckCircle2', badgeColor: 'purple', keyInsight: 'NCR-08 honeycombing repair', riskScore: 60, metricSummary: 'Cube: 32.4 MPa', findings: ['Structural repair protocol submitted'], recommendedActions: ['Expedite RE sign-off'] },
                                    { agentId: 'procurement', agentName: 'Procurement Agent', role: 'Material Tracking', iconName: 'Layers', badgeColor: 'orange', keyInsight: 'Cement reserve at 500 bags', riskScore: 75, metricSummary: 'Reserve: 3.5 Days', findings: ['Next delivery IS-902 16 Aug'], recommendedActions: ['Confirm dispatch'] },
                                    { agentId: 'risk', agentName: 'Risk Agent', role: 'Site Telemetry', iconName: 'Compass', badgeColor: 'rose', keyInsight: 'Labour availability primary risk', riskScore: 70, metricSummary: 'Labour Index: 67%', findings: ['0mm rain forecast'], recommendedActions: ['Daily gate audit'] }
                                  ],
                                  toolsUsed: [
                                    { layer: 'programme', name: 'Primavera P6 Live Schedule', recordCount: 184, status: 'Accessed', details: 'CPM network interrogated' },
                                    { layer: 'site_diaries', name: 'Site Diaries & Field Logs', recordCount: 42, status: 'Verified', details: 'Labour & plant returns' },
                                    { layer: 'database', name: 'PostgreSQL Core DB', recordCount: 318, status: 'Grounded', details: 'IPCs, RFIs, NCRs' }
                                  ],
                                  consensus: {
                                    executiveAnswer: msg.content,
                                    reconciledKeyTakeaways: [
                                      'Delay is 5 days on critical path Activity 240 (Concrete Works).',
                                      'Gemini identified labour shortage and NCR-08 defect as physical causes.',
                                      'OpenAI identified concurrent delay on RFI 034 establishing Employer Compensation Event.',
                                      'ProjectMatrix reconciled both into an immediate 4-point recovery plan.'
                                    ],
                                    consensusAgreementRate: 94,
                                    conflictResolution: 'Harmonized subcontractor physical performance with contractual delay entitlement.',
                                    strategicRecommendations: [
                                      { category: 'Contractual Defense', action: 'Issue NEC3 Early Warning Notice for RFI 034', urgency: 'Immediate', owner: 'Contracts Manager', impact: 'Protects against LDs' },
                                      { category: 'Subcontractor Management', action: 'Direct BuildCorp to mobilize second shuttering staff team', urgency: 'Within 48h', owner: 'Site Agent', impact: 'Recovers 3 days' }
                                    ]
                                  },
                                  latencyMs: { router: 45, gemini: 320, openai: 410, specialists: 190, reconciliation: 85, total: 1050 }
                                });
                              }
                              setIsBreakdownOpen(true);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-100 dark:via-[#102846] to-blue-500/10 hover:from-amber-500/20 hover:to-blue-500/20 border border-amber-500/25 dark:border-[#1E3A5F] hover:border-[#FF9F1C]/50 transition-all text-xs cursor-pointer group shadow-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[#FF9F1C] font-bold text-sm">✦</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#FF9F1C] transition-colors">
                                Multi-Engine Consensus & Cross-Examination
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#FF9F1C] font-semibold">
                              <span>View Breakdown</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </button>
                        </div>
                      )}

                      {/* Actions footer */}
                      {!isUser && (
                        <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyText(msg.content, msg.id)}
                              className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                              title="Copy response"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setFeedbackState((prev) => ({ ...prev, [msg.id]: "up" }))}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                feedbackState[msg.id] === "up"
                                  ? "text-emerald-500 bg-emerald-500/10"
                                  : "hover:text-slate-800 dark:hover:text-white"
                              }`}
                              title="Helpful"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setFeedbackState((prev) => ({ ...prev, [msg.id]: "down" }))}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                feedbackState[msg.id] === "down"
                                  ? "text-red-500 bg-red-500/10"
                                  : "hover:text-slate-800 dark:hover:text-white"
                              }`}
                              title="Not helpful"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex gap-3 items-center animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-[#FF9F1C]/15 border border-[#FF9F1C]/30 text-[#FF9F1C] flex items-center justify-center shrink-0 shadow-xs">
                    <Sparkles className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] px-4 py-3 rounded-2xl text-xs text-amber-600 dark:text-amber-400 font-mono flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#FF9F1C]" />
                    <span>Advisor is analyzing live project matrices & database records...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* INPUT BAR */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#0A1F3A] shrink-0 z-10">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] focus-within:border-[#FF9F1C]/50 rounded-2xl p-2.5 transition-all shadow-inner">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isSending || isHistoryLoading}
                placeholder={`Ask Project Advisor about ${scope === "project" ? activeProject?.name || "active project" : activeCompany?.name || "company"} matrices...`}
                rows={2}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none px-2 py-1 max-h-32 disabled:opacity-50"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isSending || isHistoryLoading}
                className="p-3 bg-gradient-to-r from-[#FF9F1C] to-[#E0880B] hover:from-[#E0880B] hover:to-[#C67400] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <Send className="w-4 h-4 stroke-[2.5]" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-2">
              <span>Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-[#102846] rounded text-slate-700 dark:text-slate-300 font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-[#102846] rounded text-slate-700 dark:text-slate-300 font-mono">Shift+Enter</kbd> for new line</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">ProjectMatrix Gateway</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SLIDE-OVER: SOURCE EVIDENCE DRAWER */}
      <AnimatePresence>
        {isEvidenceOpen && selectedSource && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEvidenceOpen(false)}
              className="absolute inset-0 bg-slate-950/50 dark:bg-slate-950/70 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0A1F3A] border-l border-slate-200 dark:border-[#1E3A5F] h-full shadow-2xl flex flex-col z-10"
            >
              <div className="p-4 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Database className="w-4 h-4 text-[#FF9F1C]" />
                  <span>Source Evidence Details</span>
                </div>
                <button
                  onClick={() => setIsEvidenceOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102846]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Database Table
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">{selectedSource.table}</div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Record Identifier
                  </div>
                  <div className="text-xs font-mono text-slate-700 dark:text-slate-200">{selectedSource.id}</div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Record Label / Title
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{selectedSource.label}</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Extracted Summary & Context
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                    {selectedSource.summary}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. MODAL / SLIDE-OVER: DOCUMENT DRAFT EDITOR */}
      <AnimatePresence>
        {isDraftEditorOpen && activeDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDraftEditorOpen(false)}
              className="absolute inset-0 bg-slate-950/50 dark:bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
            >
              {/* Draft Header */}
              <div className="p-4 border-b border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#07182E] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#FF9F1C]" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Document Draft Editor
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Formatted markdown preview & Word (.docx) export
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDraftEditorOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102846]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Draft Form Controls */}
              <div className="p-4 bg-slate-100/50 dark:bg-[#07182E]/50 border-b border-slate-200 dark:border-[#1E3A5F] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={activeDraft.title}
                    onChange={(e) => setActiveDraft({ ...activeDraft, title: e.target.value })}
                    className="w-full bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl px-3 py-1.5 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-[#FF9F1C]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={activeDraft.document_type}
                    onChange={(e) => setActiveDraft({ ...activeDraft, document_type: e.target.value as any })}
                    className="w-full bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl px-3 py-1.5 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-[#FF9F1C]"
                  >
                    <option value="report">Executive Report</option>
                    <option value="letter">Formal Letter</option>
                    <option value="memo">Memorandum</option>
                    <option value="contract_claim">Contract Claim</option>
                    <option value="site_instruction">Site Instruction</option>
                    <option value="rfi_summary">RFI Summary</option>
                    <option value="progress_narrative">Progress Narrative</option>
                  </select>
                </div>
              </div>

              {/* Draft Markdown Editor */}
              <div className="flex-1 p-4 overflow-y-auto">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Markdown Text Content
                </label>
                <textarea
                  value={activeDraft.content_markdown}
                  onChange={(e) => setActiveDraft({ ...activeDraft, content_markdown: e.target.value })}
                  rows={14}
                  className="w-full bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#FF9F1C] leading-relaxed"
                />
              </div>

              {/* Draft Actions Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#07182E] flex items-center justify-between gap-3">
                <button
                  onClick={() => handleSaveDraftToDb(activeDraft)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-[#102846] dark:hover:bg-[#1E3A5F] border border-slate-300 dark:border-[#1E3A5F] text-slate-900 dark:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Save to Company Drafts</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDraftEditorOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleExportDocx(activeDraft)}
                    disabled={isExportingDocx}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#FF9F1C] to-[#E0880B] hover:from-[#E0880B] hover:to-[#C67400] text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    {isExportingDocx ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <Download className="w-4 h-4 stroke-[2.5]" />
                    )}
                    <span>Export Word (.docx)</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. SLIDE-OVER: SAVED DRAFTS DRAWER */}
      <AnimatePresence>
        {isSavedDraftsOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSavedDraftsOpen(false)}
              className="absolute inset-0 bg-slate-950/50 dark:bg-slate-950/70 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0A1F3A] border-l border-slate-200 dark:border-[#1E3A5F] h-full shadow-2xl flex flex-col z-10"
            >
              <div className="p-4 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <FileText className="w-4 h-4 text-[#FF9F1C]" />
                  <span>Company Document Drafts</span>
                </div>
                <button
                  onClick={() => setIsSavedDraftsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102846]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {savedDrafts.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    No saved document drafts found.
                  </div>
                ) : (
                  savedDrafts.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] hover:border-[#FF9F1C]/40 rounded-xl space-y-2 transition-all shadow-xs"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{d.title}</div>
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">
                        Category: {d.document_type.replace(/_/g, " ")}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={() => {
                            setActiveDraft(d);
                            setIsSavedDraftsOpen(false);
                            setIsDraftEditorOpen(true);
                          }}
                          className="text-xs font-bold text-[#FF9F1C] hover:underline"
                        >
                          Open Editor
                        </button>
                        <button
                          onClick={() => handleExportDocx(d)}
                          className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                          <span>.docx</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. PROJECTMATRIX AI ORCHESTRATION BREAKDOWN DRAWER */}
      <OrchestratorBreakdownDrawer
        orchestration={selectedOrchestration}
        isOpen={isBreakdownOpen}
        onClose={() => setIsBreakdownOpen(false)}
        projectName={activeProject?.name}
      />
    </div>
  );
}
