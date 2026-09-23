import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Layers,
  Scale,
  Sparkles,
  ShieldAlert,
  Clock,
  FileCheck2,
  FileDiff,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Filter,
  Search,
  ExternalLink,
  ChevronRight,
  FileText,
  Building,
  Info
} from "lucide-react";
import { ContractEngine } from "../../services/ContractEngine";
import { EffectiveContractSynthesis, EffectiveContractClause, EffectiveClauseStatus } from "../../types/contractDocuments";
import { ProjectContractProfile } from "../../types/contractRules";

interface Props {
  projectId: string;
  projectName: string;
  onOpenAdvisorWithContext?: (prompt: string) => void;
  onDraftNoticeForClause?: (clauseNumber: string) => void;
}

export default function EffectiveContractSynthesisExplorer({
  projectId,
  projectName,
  onOpenAdvisorWithContext,
  onDraftNoticeForClause
}: Props) {
  const [synthesis, setSynthesis] = useState<EffectiveContractSynthesis>(() => 
    ContractEngine.synthesizeEffectiveContract(projectId)
  );
  const [profile, setProfile] = useState<ProjectContractProfile>(() =>
    ContractEngine.getContractProfile(projectId)
  );

  const [activeFilter, setActiveFilter] = useState<"all" | "amended" | "time_bars" | "unmodified">("amended");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClause, setSelectedClause] = useState<EffectiveContractClause | null>(null);
  const [showPrecedenceHierarchy, setShowPrecedenceHierarchy] = useState(false);

  // Refresh synthesis
  const handleRefresh = () => {
    setSynthesis(ContractEngine.synthesizeEffectiveContract(projectId));
    setProfile(ContractEngine.getContractProfile(projectId));
  };

  // Filter clauses
  const filteredClauses = synthesis.effectiveClauses.filter(clause => {
    const matchesSearch = 
      clause.clauseIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clause.clauseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clause.operationalDeltaSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clause.effectiveRule.requirementSummary.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "amended") {
      return clause.status !== "BASE_STANDARD_UNMODIFIED";
    }
    if (activeFilter === "time_bars") {
      return clause.effectiveRule.strictness === "STRICT_TIME_BAR" || clause.effectiveRule.deadline.durationValue <= 28;
    }
    if (activeFilter === "unmodified") {
      return clause.status === "BASE_STANDARD_UNMODIFIED";
    }
    return true;
  });

  const handleAskAdvisor = (clause: EffectiveContractClause) => {
    const isAmended = clause.status !== "BASE_STANDARD_UNMODIFIED";
    const prompt = `Analyze our contractual exposure and legal standing under EFFECTIVE CLAUSE ${clause.clauseIdentifier} [${clause.clauseTitle}].
${isAmended ? `Note: Base ${synthesis.baseStandard.family} has been amended by ${clause.amendmentReference}. Effective deadline is ${clause.effectiveRule.deadline.durationValue} ${clause.effectiveRule.deadline.durationUnit}.` : `Governed by standard unamended ${synthesis.baseStandard.family} clause.`}
What are our mandatory compliance obligations, required contemporary records, and potential time-bar risks?`;
    
    if (onOpenAdvisorWithContext) {
      onOpenAdvisorWithContext(prompt);
    }
  };

  return (
    <div className="space-y-6">

      {/* 1. Core Architectural Equation Banner */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl border border-indigo-800/40 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Effective Contract Rule Synthesis
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    AI Grounded Engine
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80 mt-0.5">
                  An actual project contract is not merely the base book—it is the synthesized result of General Conditions, Particular Conditions, Contract Data, Specs, and Addenda governed by strict legal precedence.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPrecedenceHierarchy(!showPrecedenceHierarchy)}
              className="px-3 py-1.5 bg-indigo-800/60 hover:bg-indigo-700/80 border border-indigo-500/30 text-xs font-bold text-indigo-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showPrecedenceHierarchy ? "Hide Precedence Hierarchy" : "View Order of Precedence (1–10)"}</span>
            </button>
          </div>

          {/* Visual Formula Display */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center bg-black/30 backdrop-blur-xs p-4 rounded-2xl border border-white/10 text-xs">
            
            {/* Step 1: Base Standard */}
            <div className="md:col-span-2 p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                1. Base Standard Form
              </span>
              <div className="font-bold text-white text-sm">
                {synthesis.baseStandard.family} {synthesis.baseStandard.form}
              </div>
              <div className="text-[11px] text-slate-300 font-mono">
                {synthesis.baseStandard.edition} • {synthesis.synthesisMetrics.unmodifiedClausesCount} Unmodified Clauses
              </div>
            </div>

            {/* Operator + */}
            <div className="flex justify-center text-xl font-black text-indigo-400">
              ➕
            </div>

            {/* Step 2: Project Amendments */}
            <div className="md:col-span-2 p-3 bg-indigo-900/60 rounded-xl border border-indigo-500/40 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 font-bold block">
                2. Project Amendments & Data
              </span>
              <div className="font-bold text-indigo-100 text-sm">
                Particular Conditions (Part A & B)
              </div>
              <div className="text-[11px] text-indigo-200 font-mono">
                {synthesis.synthesisMetrics.amendedClausesCount} Active Overrides • {synthesis.documentsHierarchy.length} Constituent Docs
              </div>
            </div>

            {/* Operator = */}
            <div className="flex justify-center text-xl font-black text-emerald-400">
              🟰
            </div>

            {/* Step 3: Effective Contract */}
            <div className="md:col-span-1 p-3 bg-emerald-950/60 rounded-xl border border-emerald-500/50 space-y-1 shadow-inner">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                3. Effective Contract
              </span>
              <div className="font-bold text-emerald-100 text-xs">
                Synthetic Rule Matrix
              </div>
              <div className="text-[10px] text-emerald-300 font-mono">
                {synthesis.versionFingerprint}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. Order of Precedence Hierarchy Drawer (Expandable) */}
      <AnimatePresence>
        {showPrecedenceHierarchy && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Contract Document Priority & Order of Precedence (Sub-Clause 1.5)
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  In case of ambiguity, documents take legal precedence in this exact numerical sequence.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {synthesis.orderOfPrecedenceList.map((item) => (
                  <div
                    key={item.rank}
                    className={`p-3 rounded-2xl border text-xs space-y-1.5 transition-all ${
                      item.rank <= 4
                        ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black ${
                        item.rank <= 4
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}>
                        PRIORITY #{item.rank}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">{item.clauseRef}</span>
                    </div>

                    <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                      {item.title}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="font-mono">{item.activeDocumentRef}</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.activeVersion}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Effective Clauses</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {synthesis.synthesisMetrics.totalEffectiveClauses}
          </div>
          <div className="text-[11px] text-slate-500">
            {synthesis.baseStandard.family} {synthesis.baseStandard.form} base taxonomy
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Active Project Amendments</span>
            <FileDiff className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {synthesis.synthesisMetrics.amendedClausesCount} Overrides
          </div>
          <div className="text-[11px] text-slate-500">
            Overriding General Conditions via Particular Conditions
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Shortened Time-Bars</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {synthesis.synthesisMetrics.shortenedTimeBarsCount} Strict Bars
          </div>
          <div className="text-[11px] text-slate-500">
            E.g. Notice of claim reduced from 28d to 14d
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">AI Reasoning Sync</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            100% Grounded
          </div>
          <div className="text-[11px] text-slate-500">
            Matrix AI reasons against Effective Contract rules
          </div>
        </div>
      </div>

      {/* 4. Search and Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search effective clauses by number, title, operational impact, or amendment reference..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveFilter("amended")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === "amended"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <FileDiff className="w-3.5 h-3.5" />
            <span>Amended Only ({synthesis.synthesisMetrics.amendedClausesCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter("time_bars")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === "time_bars"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Strict Time-Bars</span>
          </button>

          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === "all"
                ? "bg-slate-900 dark:bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <span>All Effective Clauses ({synthesis.effectiveClauses.length})</span>
          </button>

          <button
            onClick={() => setActiveFilter("unmodified")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeFilter === "unmodified"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            <span>Unmodified Base Standard</span>
          </button>
        </div>
      </div>

      {/* 5. 3-Way Comparative Clause Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Synthesized Clause Register: Base Standard ➜ Project Amendment ➜ Effective Rule
            </h3>
            <p className="text-xs text-slate-500">
              Showing {filteredClauses.length} clauses. The Effective Rule is what triggers notice timers, time-bar calculations, and AI legal opinions.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filteredClauses.map((clause, idx) => {
            const isAmended = clause.status !== "BASE_STANDARD_UNMODIFIED";

            return (
              <div
                key={idx}
                className={`p-5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-850/50 ${
                  isAmended ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-mono text-xs font-black border border-blue-200 dark:border-blue-800">
                      Sub-Clause {clause.clauseIdentifier}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {clause.clauseTitle}
                    </h4>
                    {isAmended ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        AMENDED BY PARTICULAR CONDITIONS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        BASE STANDARD (UNMODIFIED)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAskAdvisor(clause)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>✦ Interrogate Clause</span>
                    </button>

                    {onDraftNoticeForClause && (
                      <button
                        onClick={() => onDraftNoticeForClause(clause.clauseIdentifier)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Draft Notice</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3-Column Comparative Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-2 text-xs">
                  
                  {/* Column 1: Base Standard Rule */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-500">
                        1. Base Standard ({synthesis.baseStandard.family} {synthesis.baseStandard.form})
                      </span>
                      <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {clause.baseStandardRule.deadline.durationValue} {clause.baseStandardRule.deadline.durationUnit}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {clause.baseStandardRule.requirementSummary}
                    </p>
                    <div className="text-[11px] text-slate-400">
                      Standard Default Strictness: <strong>{clause.baseStandardRule.strictness.replace(/_/g, ' ')}</strong>
                    </div>
                  </div>

                  {/* Column 2: Project Amendment / Particular Condition */}
                  <div className={`p-3.5 rounded-2xl border space-y-2 ${
                    isAmended
                      ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60"
                      : "bg-slate-50/50 dark:bg-slate-850/40 border-slate-200 dark:border-slate-800 opacity-60"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-bold text-amber-700 dark:text-amber-400">
                        2. Project Amendment (Particular Conditions)
                      </span>
                      {isAmended && (
                        <span className="font-mono text-[10px] font-black text-amber-800 dark:text-amber-300">
                          {clause.effectiveRule.deadline.durationValue} {clause.effectiveRule.deadline.durationUnit}
                        </span>
                      )}
                    </div>
                    
                    {isAmended ? (
                      <>
                        <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                          {clause.effectiveRule.requirementSummary}
                        </p>
                        <div className="text-[11px] text-amber-800 dark:text-amber-300 font-mono font-semibold">
                          Source: {clause.amendmentReference}
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-400 italic">
                        No particular condition amendment registered for this clause. Base standard remains unaltered.
                      </p>
                    )}
                  </div>

                  {/* Column 3: Effective Contract Synthesis */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 dark:text-emerald-400">
                        3. Effective Contract (Live Engine Rule)
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black bg-emerald-600 text-white">
                        {clause.effectiveRule.deadline.durationValue} {clause.effectiveRule.deadline.durationUnit}
                      </span>
                    </div>

                    <div className="text-slate-800 dark:text-slate-100 font-semibold leading-relaxed">
                      {clause.operationalDeltaSummary}
                    </div>

                    <div className="pt-1.5 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px] text-emerald-900 dark:text-emerald-300">
                      <strong>Legal Precedence:</strong> {clause.precedenceReasoning}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
