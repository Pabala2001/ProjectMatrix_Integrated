import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Cpu,
  Layers,
  Shield,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  Compass,
  Database,
  ExternalLink,
  X,
  Scale,
  AlertTriangle,
  FileText,
  Clock,
  Check,
  ChevronRight,
  TrendingUp,
  Search,
  Activity,
  ArrowRight
} from "lucide-react";
import { OrchestratorExecutionResult, SpecialistAgentReport } from "../../types/aiOrchestrator";

interface OrchestratorBreakdownDrawerProps {
  orchestration?: OrchestratorExecutionResult | null;
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

export function OrchestratorBreakdownDrawer({
  orchestration,
  isOpen,
  onClose,
  projectName = "Active Project"
}: OrchestratorBreakdownDrawerProps) {
  const [activeTab, setActiveTab] = useState<
    "consensus" | "gemini" | "openai" | "specialists" | "tools" | "architecture"
  >("consensus");

  if (!orchestration) return null;

  const {
    intent,
    geminiAnalysis,
    openAISecondOpinion,
    specialistAgents = [],
    toolsUsed = [],
    consensus,
    latencyMs
  } = orchestration;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-3xl bg-white dark:bg-[#0A1F3A] border-l border-slate-200 dark:border-[#1E3A5F] h-full shadow-2xl flex flex-col z-10 text-slate-800 dark:text-slate-100"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#07182E] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#FF9F1C] to-[#E0880B] text-slate-950 font-black shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      ✦ ProjectMatrix AI Orchestration
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      {consensus.consensusAgreementRate}% Consensus
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Multi-Model Synthesis • Gemini 2.5 • OpenAI GPT-4o • 6 Specialist Agents
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102846] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 p-2 bg-slate-100 dark:bg-[#07182E] border-b border-slate-200 dark:border-[#1E3A5F] overflow-x-auto text-xs shrink-0">
              <button
                onClick={() => setActiveTab("consensus")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "consensus"
                    ? "bg-[#FF9F1C] text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Consensus & Strategy</span>
              </button>
              <button
                onClick={() => setActiveTab("gemini")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "gemini"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gemini Analysis</span>
              </button>
              <button
                onClick={() => setActiveTab("openai")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "openai"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>OpenAI Cross-Exam</span>
              </button>
              <button
                onClick={() => setActiveTab("specialists")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "specialists"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Specialist Agents ({specialistAgents.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("tools")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "tools"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Tool Layer ({toolsUsed.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("architecture")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "architecture"
                    ? "bg-slate-800 text-amber-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Flow Architecture</span>
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* TAB 1: CONSENSUS & STRATEGY */}
              {activeTab === "consensus" && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Consensus Agreement Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <Scale className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                          Reconciled Multi-Model Consensus Score
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Gemini Primary + OpenAI Cross-Examination synthesized into a unified strategic plan
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      <span>{consensus.consensusAgreementRate}%</span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Agreement</span>
                    </div>
                  </div>

                  {/* Conflict Resolution Note */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#FF9F1C]" />
                      <span>Reconciliation & Perspective Alignment</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {consensus.conflictResolution}
                    </p>
                  </div>

                  {/* Reconciled Key Takeaways */}
                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Core Intelligence Takeaways
                    </div>
                    <div className="space-y-2">
                      {consensus.reconciledKeyTakeaways.map((takeaway, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-xs"
                        >
                          <div className="p-1 rounded-md bg-amber-500/20 text-[#FF9F1C] shrink-0 mt-0.5">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <span className="text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                            {takeaway}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strategic Decision Matrix */}
                  <div className="space-y-3">
                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
                      <span>Strategic Management & Recovery Actions ({consensus.strategicRecommendations.length})</span>
                      <span className="text-[10px] text-amber-500 font-mono">Assigned & Prioritized</span>
                    </div>
                    <div className="space-y-2.5">
                      {consensus.strategicRecommendations.map((rec, rIdx) => (
                        <div
                          key={rIdx}
                          className="p-3.5 rounded-xl bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] hover:border-[#FF9F1C]/50 space-y-2 transition-all shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 uppercase">
                              {rec.category}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                rec.urgency === "Immediate"
                                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {rec.urgency}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                            {rec.action}
                          </p>
                          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-[#1E3A5F]/50 gap-2">
                            <span className="font-mono">Owner: <strong className="text-slate-700 dark:text-slate-200">{rec.owner}</strong></span>
                            {rec.clauses && <span className="font-mono text-amber-600 dark:text-amber-400">Clause: {rec.clauses}</span>}
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Impact: {rec.impact}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: GEMINI PRIMARY ANALYSIS */}
              {activeTab === "gemini" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {geminiAnalysis.engineName} — {geminiAnalysis.role}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Gemini acts as the primary factual interrogation layer, directly parsing construction records, site diaries, labour sheets, and material inventories with Google Grounding.
                    </p>
                  </div>

                  {/* Factual Findings List */}
                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Factual Findings Interrogated
                    </div>
                    <div className="space-y-2">
                      {geminiAnalysis.factualFindings.map((finding, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-xs text-slate-700 dark:text-slate-200 leading-relaxed flex items-start gap-2.5"
                        >
                          <span className="text-amber-500 font-bold">#{idx + 1}</span>
                          <span>{finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Site Records Examined */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                      <span>Site Records & Registers Examined</span>
                    </div>
                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                      {geminiAnalysis.siteRecordsExamined.map((rec, rIdx) => (
                        <li key={rIdx}>{rec}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Photographs and Field Logs */}
                  {geminiAnalysis.photographsOrFieldLogs.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Field Photographs & Visual Telemetry</span>
                      </div>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                        {geminiAnalysis.photographsOrFieldLogs.map((photo, pIdx) => (
                          <li key={pIdx}>{photo}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Google Grounding Snippets */}
                  {geminiAnalysis.googleGroundingSnippets && geminiAnalysis.googleGroundingSnippets.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <div className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
                        <Search className="w-4 h-4 text-amber-500" />
                        <span>Google Search & Supplier Grounding</span>
                      </div>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                        {geminiAnalysis.googleGroundingSnippets.map((snippet, sIdx) => (
                          <li key={sIdx}>{snippet}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: OPENAI SECOND OPINION & CROSS-EXAMINATION */}
              {activeTab === "openai" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {openAISecondOpinion.engineName} — {openAISecondOpinion.role}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      OpenAI independently examines programme logic, challenges Gemini's conclusions, highlights contractual exposures under NEC3/FIDIC, and identifies missing evidentiary trails.
                    </p>
                  </div>

                  {/* Challenges to Gemini's Findings */}
                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Cross-Examination & Challenges to Primary Findings</span>
                    </div>
                    <div className="space-y-2">
                      {openAISecondOpinion.counterArgumentsAndChallenges.map((challenge, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-slate-800 dark:text-slate-200 leading-relaxed"
                        >
                          <span className="font-bold text-rose-600 dark:text-rose-400">Challenge #{idx + 1}: </span>
                          {challenge}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Programme Logic Analysis */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span>Independent Programme Logic & Float Analysis</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {openAISecondOpinion.programmeLogicAnalysis}
                    </p>
                  </div>

                  {/* Contractual Implications */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span>Contractual Assessment (NEC3 / FIDIC / JBCC)</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {openAISecondOpinion.contractualImplications}
                    </p>
                  </div>

                  {/* Formulated Management Options */}
                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Formulated Management Options
                    </div>
                    <div className="space-y-2">
                      {openAISecondOpinion.formulatedManagementOptions.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-xs text-slate-700 dark:text-slate-200 leading-relaxed"
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SPECIALIST AGENTS */}
              {activeTab === "specialists" && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    The AI Orchestrator deployed <strong>{specialistAgents.length} specialist agents</strong> to perform domain telemetry on schedule, cost, contracts, quality, supply chain, and field risks:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {specialistAgents.map((agent) => (
                      <div
                        key={agent.agentId}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {agent.agentName}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {agent.role}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              agent.riskScore > 75
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            Risk: {agent.riskScore}/100
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                          {agent.keyInsight}
                        </div>

                        <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                          {agent.metricSummary}
                        </div>

                        <div className="space-y-1 pt-1">
                          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                            Recommended Action:
                          </div>
                          <ul className="text-[11px] text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                            {agent.recommendedActions.map((act, aIdx) => (
                              <li key={aIdx}>{act}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: TOOL LAYER TELEMETRY */}
              {activeTab === "tools" && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Live project data interrogated by ProjectMatrix Tool Layer across schedules, diaries, documents, and databases:
                  </div>
                  <div className="space-y-3">
                    {toolsUsed.map((tool, tIdx) => (
                      <div
                        key={tIdx}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-[#FF9F1C]" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {tool.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            {tool.status} ({tool.recordCount} records)
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-mono">
                          {tool.details}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: ARCHITECTURE FLOW */}
              {activeTab === "architecture" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-slate-800 space-y-3">
                    <div className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[#FF9F1C]" />
                      <span>ProjectMatrix AI Orchestrator Execution Pipeline</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      How ProjectMatrix coordinates Gemini and OpenAI simultaneously rather than running a sequential chatbot:
                    </p>
                    <div className="p-3 bg-slate-950 rounded-xl font-mono text-[11px] leading-relaxed text-slate-300 border border-slate-800 space-y-2">
                      <div className="text-amber-400 font-bold">1. USER QUERY</div>
                      <div className="text-slate-400 pl-4">↳ PM asks: "{intent.intentSummary}"</div>
                      
                      <div className="text-amber-400 font-bold pt-2">2. AI ORCHESTRATOR ROUTER</div>
                      <div className="text-slate-400 pl-4">↳ Classifies intent as {intent.queryType} ({intent.riskLevel} Risk). Activates {intent.activeSpecialists.join(", ")} specialists.</div>

                      <div className="text-amber-400 font-bold pt-2">3. DUAL INTELLIGENCE EXECUTION</div>
                      <div className="text-slate-400 pl-4">
                        ↳ <strong className="text-amber-300">Gemini Engine</strong>: Interrogates site records, field photos, diaries & Google grounding.<br />
                        ↳ <strong className="text-blue-300">OpenAI Engine</strong>: Cross-examines critical path logic, challenges assumptions & contractual exposure.<br />
                        ↳ <strong className="text-purple-300">6 Specialist Agents</strong>: Runs deep telemetry on cost, schedule, quality, risk & procurement.
                      </div>

                      <div className="text-amber-400 font-bold pt-2">4. PROJECTMATRIX TOOL LAYER</div>
                      <div className="text-slate-400 pl-4">↳ Grounded against PostgreSQL, CPM Schedules, BOQs, Site Diaries, Weather & GIS.</div>

                      <div className="text-amber-400 font-bold pt-2">5. CONSENSUS RECONCILIATION</div>
                      <div className="text-slate-400 pl-4">↳ Reconciles both models into one authoritative executive briefing with a 4-point action matrix.</div>
                    </div>
                  </div>

                  {/* Latency Telemetry */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>Pipeline Latency Telemetry</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F]">
                        <span className="text-slate-400 block text-[10px]">Router</span>
                        <span className="font-bold">{latencyMs.router}ms</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F]">
                        <span className="text-slate-400 block text-[10px]">Gemini Lead</span>
                        <span className="font-bold">{latencyMs.gemini}ms</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F]">
                        <span className="text-slate-400 block text-[10px]">OpenAI Cross-Exam</span>
                        <span className="font-bold">{latencyMs.openai}ms</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F]">
                        <span className="text-slate-400 block text-[10px]">Total Synthesized</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{latencyMs.total}ms</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#07182E] flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                ✦ ProjectMatrix Multi-Engine Intelligence
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#E0880B] text-slate-950 font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Close Breakdown
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
