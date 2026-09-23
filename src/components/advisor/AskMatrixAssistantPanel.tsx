import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Copy,
  Check,
  Download,
  Scale,
  Shield,
  FileSpreadsheet,
  CheckCircle2,
  Compass,
  Layers,
  ArrowUpRight,
  ExternalLink,
  ChevronDown,
  Info,
  Clock,
  Briefcase,
  Building,
  RefreshCw,
  Sliders
} from "lucide-react";
import {
  AdvisorMessage,
  AdvisorDraft,
  AdvisorSource
} from "../../types/projectAdvisor";
import { OrchestratorExecutionResult } from "../../types/aiOrchestrator";
import { sendChatToAdvisor, sanitizeUserFacingErrorMessage } from "../../services/projectAdvisorService";
import { generateAdvisorDraftDocx, downloadBlob } from "../../utils/generateAdvisorDocx";
import { OrchestratorBreakdownDrawer } from "./OrchestratorBreakdownDrawer";
import { 
  CONTRACT_STANDARDS_DATABASE, 
  getContractStandardByFrameworkName,
  ContractStandardSuite 
} from "../../data/contractStandardsData";

interface AskMatrixAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject?: any;
  activeCompany?: any;
  initialQuery?: string;
}

export default function AskMatrixAssistantPanel({
  isOpen,
  onClose,
  activeProject,
  activeCompany,
  initialQuery = ""
}: AskMatrixAssistantPanelProps) {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedOrchestration, setSelectedOrchestration] = useState<OrchestratorExecutionResult | null>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  
  // Active contract framework selection (defaults to project's contract or FIDIC 2017)
  const defaultFrameworkKey = activeProject?.contractType ? 
    (activeProject.contractType.includes("NEC") ? "NEC4_ECC" : 
     activeProject.contractType.includes("GCC") ? "GCC_2015" :
     activeProject.contractType.includes("JBCC") ? "JBCC_6_2" :
     activeProject.contractType.includes("1999") ? "FIDIC_1999_RED" : "FIDIC_2017_RED") : "FIDIC_2017_RED";
  
  const [selectedFrameworkKey, setSelectedFrameworkKey] = useState<string>(defaultFrameworkKey);
  const activeContractSuite: ContractStandardSuite = CONTRACT_STANDARDS_DATABASE[selectedFrameworkKey] || CONTRACT_STANDARDS_DATABASE["FIDIC_2017_RED"];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeProject?.contractType) {
      const suite = getContractStandardByFrameworkName(activeProject.contractType);
      if (suite && suite.code) {
        setSelectedFrameworkKey(suite.code);
      }
    }
  }, [activeProject]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialQuery && isOpen) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Global listener for "matrix-open-advisor"
  useEffect(() => {
    const handleGlobalTrigger = (e: any) => {
      const query = e.detail?.query;
      const contract = e.detail?.contractFramework;
      if (contract && CONTRACT_STANDARDS_DATABASE[contract]) {
        setSelectedFrameworkKey(contract);
      }
      if (query) {
        handleSendMessage(query);
      }
    };
    window.addEventListener("matrix-open-advisor" as any, handleGlobalTrigger);
    return () => window.removeEventListener("matrix-open-advisor" as any, handleGlobalTrigger);
  }, []);

  const samplePrompts = [
    { label: "Why is Central Station forecast late?", query: "Why is Central Station forecast late?" },
    { label: "Show projects with payment risk above $5m.", query: "Show projects with payment risk above $5m." },
    { label: "What requires my approval today?", query: "What requires my approval today?" },
    { label: "Compare actual vs planned progress.", query: "Compare actual vs planned progress." },
    { label: "Draft an early warning for Project 53.", query: "Draft an early warning for Project 53." },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || isSending) return;

    setInputText("");

    const userMessage: AdvisorMessage = {
      id: `user-${Date.now()}`,
      conversation_id: "matrix-panel-session",
      sender: "user",
      content: content,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsSending(true);

    try {
      const response = await sendChatToAdvisor({
        question: content,
        scope: "project",
        company: {
          id: activeCompany?.id || "matrix-corp",
          name: activeCompany?.name || "Project Matrix JV"
        },
        project: activeProject ? {
          id: activeProject.id,
          name: activeProject.name
        } : null,
        conversation_id: "matrix-panel-session"
      });

      const assistantMessage: AdvisorMessage = {
        id: `asst-${Date.now()}`,
        conversation_id: "matrix-panel-session",
        sender: "assistant",
        content: response.answer,
        sources_json: response.sources || [],
        orchestration: response.orchestration,
        draft: response.draft,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMsg = sanitizeUserFacingErrorMessage(err);
      const errorMessage: AdvisorMessage = {
        id: `asst-err-${Date.now()}`,
        conversation_id: "matrix-panel-session",
        sender: "assistant",
        content: `**Assistant Error:** ${errorMsg}`,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadDocx = async (messageText: string) => {
    assertOperationalAction("export", "components/advisor/AskMatrixAssistantPanel.tsx");
    setIsExportingDocx(true);
    try {
      const draft: AdvisorDraft = {
        title: `Matrix Advisor Analysis - ${activeProject?.name || "Infrastructure"}`,
        document_type: "contract_claim",
        content_markdown: messageText,
        metadata_json: {
          contractFramework: activeContractSuite.name,
          dateGenerated: new Date().toISOString()
        }
      };
      const blob = await generateAdvisorDraftDocx(
        draft,
        activeCompany?.name || "ProjectMatrix Infrastructure JV",
        activeProject?.name || "Central Station Transfer Interchange"
      );
      downloadBlob(blob, `Matrix_Advisor_${activeContractSuite.shortName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.docx`);
    } catch (err) {
      console.error("Failed to export DOCX:", err);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            />

            {/* Right-side Assistant Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full z-10 border-l border-slate-200 dark:border-slate-800"
            >
              {/* Top Header */}
              <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-blue-500 flex items-center justify-center shadow-md">
                    <Sparkles className="w-5 h-5 text-slate-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm uppercase tracking-wider text-white">
                        ASK MATRIX
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full">
                        6-Agent Consensus
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium">
                      Operating Model AI • Contract Clauses Grounded
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMessages([])}
                    title="Clear Conversation"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-semibold hidden sm:inline">Reset</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Active Project & Contract Context Strip */}
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Project:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                    {activeProject?.name || "Global Portfolio"}
                  </span>
                </div>

                {/* Contract Framework Selector */}
                <div className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Contract:</span>
                  <select
                    value={selectedFrameworkKey}
                    onChange={(e) => setSelectedFrameworkKey(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-blue-600 dark:text-blue-400 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="FIDIC_2017_RED">FIDIC Red Book 2017 (2nd Ed)</option>
                    <option value="FIDIC_1999_RED">FIDIC Red Book 1999 (1st Ed)</option>
                    <option value="NEC4_ECC">NEC4 ECC (June 2017)</option>
                    <option value="GCC_2015">SAICE GCC 2015 (3rd Ed)</option>
                    <option value="JBCC_6_2">JBCC PBA 6.2 (May 2018)</option>
                  </select>
                </div>
              </div>

              {/* Active Contract Quick Rules Indicator */}
              <div className="px-4 py-2 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between text-[11px] text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Claim Time-Bar: <strong>{activeContractSuite.keyTimelines.claimNoticeWindow}</strong>
                  </span>
                </div>
                <div className="text-[10px] text-blue-700 dark:text-blue-300 font-mono">
                  Interest: {activeContractSuite.keyTimelines.latePaymentInterestFormula.slice(0, 32)}...
                </div>
              </div>

              {/* Chat Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-6">
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                      <Sparkles className="w-7 h-7" />
                    </div>

                    <div className="max-w-md space-y-1.5">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        AI as Part of the Operating Model
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ask any commercial, schedule, contractual, or technical question. Matrix Advisor interrogates field diaries, accounts, and references exact clauses from <strong>{activeContractSuite.shortName}</strong>.
                      </p>
                    </div>

                    {/* Quick Example Prompts */}
                    <div className="w-full space-y-2 text-left">
                      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Suggested Inquiries:
                      </p>
                      <div className="flex flex-col gap-2">
                        {samplePrompts.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(item.query)}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-300 dark:hover:border-blue-800 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all flex items-center justify-between group cursor-pointer text-left shadow-2xs"
                          >
                            <span>{item.label}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      {/* Message Bubble */}
                      <div
                        className={`max-w-[92%] rounded-2xl p-4 text-xs leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-[#2F7CFF] text-white rounded-br-none shadow-sm"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-xs"
                        }`}
                      >
                        {/* Markdown / Text content */}
                        <div className="prose prose-xs dark:prose-invert max-w-none space-y-2 whitespace-pre-wrap">
                          {msg.content}
                        </div>

                        {/* Assistant Extras: Sources, Multi-Agent Breakdown, Actions */}
                        {msg.sender === "assistant" && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/80 space-y-2.5">
                            {/* Orchestration Multi-Agent Trigger */}
                            {msg.orchestration && (
                              <button
                                onClick={() => {
                                  setSelectedOrchestration(msg.orchestration || null);
                                  setIsBreakdownOpen(true);
                                }}
                                className="w-full p-2 bg-slate-50 dark:bg-slate-900/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>View 6-Agent Consensus Breakdown</span>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 font-mono">
                                  {msg.orchestration.consensus.consensusAgreementRate}% Agreement
                                </span>
                              </button>
                            )}

                            {/* Source Citations */}
                            {msg.sources_json && msg.sources_json.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  Cited Evidence:
                                </span>
                                {msg.sources_json.map((src, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 rounded text-[10px] font-medium"
                                  >
                                    {src.label}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Bottom utility bar */}
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                              <span className="font-mono text-[10px]">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleCopyText(msg.id, msg.content)}
                                  className="p-1 hover:text-slate-800 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Copy response"
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  onClick={() => handleDownloadDocx(msg.content)}
                                  disabled={isExportingDocx}
                                  className="p-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Download formal Word document (.docx)"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-semibold">.docx</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {isSending && (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-[80%] animate-pulse">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      Interrogating site records & verifying {activeContractSuite.shortName} clauses...
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input Area */}
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Ask Matrix (grounded in ${activeContractSuite.shortName})...`}
                    disabled={isSending}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    className="p-2.5 bg-[#2F7CFF] hover:bg-[#1C68EB] disabled:opacity-40 text-white rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>Press Enter to send • 6-Agent Consensus Engine</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {activeContractSuite.code}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Multi-Agent Breakdown Drawer */}
      <OrchestratorBreakdownDrawer
        isOpen={isBreakdownOpen}
        onClose={() => setIsBreakdownOpen(false)}
        orchestration={selectedOrchestration}
      />
    </>
  );
}
