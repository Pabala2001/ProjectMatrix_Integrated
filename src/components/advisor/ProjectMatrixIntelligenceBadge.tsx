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
  ChevronDown,
  X,
  Zap
} from "lucide-react";

interface BadgeProps {
  className?: string;
  variant?: "compact" | "full" | "header";
}

export function ProjectMatrixIntelligenceBadge({ className = "", variant = "header" }: BadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Interactive Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shadow-xs border ${
          variant === "compact"
            ? "bg-slate-900/90 text-amber-400 border-amber-500/30 hover:border-amber-400"
            : "bg-amber-500/10 dark:bg-amber-500/15 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/25 hover:border-amber-500/40"
        } ${className}`}
        title="ProjectMatrix Multi-Engine Intelligence"
      >
        <span className="text-[#FF9F1C] group-hover:rotate-12 transition-transform">✦</span>
        <span className="font-bold tracking-tight">ProjectMatrix Intelligence</span>
        <ChevronDown className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:translate-y-0.5 transition-transform" />
      </button>

      {/* Interactive Modal / Popover */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden z-10 text-slate-800 dark:text-slate-100"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-amber-500/15 via-slate-100 dark:via-[#102846] to-transparent border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#FF9F1C]/20 border border-[#FF9F1C]/40 text-[#FF9F1C]">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <span>✦ ProjectMatrix Intelligence</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Dual-Engine Active
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Gemini • OpenAI • ProjectMatrix Specialist Agents • Tool Layer
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#102846] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Orchestrator Architecture Concept */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] space-y-3">
                  <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#FF9F1C]" />
                    <span>Multi-Intelligence Orchestration Architecture</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Project Advisor operates as the single user-facing advisor. Underneath, ProjectMatrix directly controls both <strong>Gemini</strong> and <strong>OpenAI</strong> in a genuine second-opinion architecture — synthesizing primary factual findings, independent contractual cross-examination, and specialist agent telemetry into one reconciled executive answer.
                  </p>

                  {/* ASCII Architecture Flow Box */}
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] leading-snug overflow-x-auto border border-slate-800">
                    <pre className="text-amber-400 font-bold">                 PROJECT ADVISOR (User-Facing)</pre>
                    <pre className="text-slate-400">                             │</pre>
                    <pre className="text-slate-300">                  ┌──────────▼──────────┐</pre>
                    <pre className="text-slate-300">                  │   AI ORCHESTRATOR   │ Intent + Risk Router</pre>
                    <pre className="text-slate-300">                  └──────────┬──────────┘</pre>
                    <pre className="text-slate-400">                             │</pre>
                    <pre className="text-slate-300">       ┌─────────────────────┼─────────────────────┐</pre>
                    <pre className="text-emerald-400">       ▼                     ▼                     ▼</pre>
                    <pre className="text-emerald-300">    GEMINI 2.5            OPENAI GPT-4o        SPECIALIST AGENTS</pre>
                    <pre className="text-slate-400"> Primary Analysis       Second Opinion &      Planning • Cost • Contract</pre>
                    <pre className="text-slate-400"> Google Grounding       Cross-Examination     QA/QC • Procurement • Risk</pre>
                    <pre className="text-slate-400"> Multimodal Telemetry   Logic & Strategy</pre>
                    <pre className="text-slate-300">       └─────────────────────┬─────────────────────┘</pre>
                    <pre className="text-slate-400">                             ▼</pre>
                    <pre className="text-amber-400 font-bold">                 PROJECTMATRIX TOOL LAYER</pre>
                    <pre className="text-slate-400">  [DB & APIs]  [Docs & RAG]  [BOQ Data]  [Programme]  [Site Diaries]</pre>
                  </div>
                </div>

                {/* 3 Pillars Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Gemini Card */}
                  <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Gemini 2.5 Intelligence
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      <strong>Role</strong>: Primary Factual Interrogation & Grounding
                    </p>
                    <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
                      <li>Interrogate live project records & BOQs</li>
                      <li>Examine site diaries & labour attendance</li>
                      <li>Inspect site photographs & drawings</li>
                      <li>Google search & supplier grounding</li>
                    </ul>
                  </div>

                  {/* OpenAI Card */}
                  <div className="p-4 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        OpenAI Intelligence
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      <strong>Role</strong>: Second Opinion & Cross-Examination
                    </p>
                    <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
                      <li>Independently analyse CPM network logic</li>
                      <li>Evaluate NEC3 / FIDIC contractual risks</li>
                      <li>Challenge primary findings & concurrent delays</li>
                      <li>Formulate strategic management options</li>
                    </ul>
                  </div>
                </div>

                {/* 6 Specialist Agents & Tool Layer Badges */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Active Specialist Agents (6)</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Coordinated by Orchestrator</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] flex items-center gap-2 text-xs">
                      <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="font-semibold text-[11px]">Planning Agent</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] flex items-center gap-2 text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-semibold text-[11px]">Cost & BOQ Agent</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] flex items-center gap-2 text-xs">
                      <Shield className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-semibold text-[11px]">Contract Agent</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                      <span className="font-semibold text-[11px]">QA/QC Agent</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] flex items-center gap-2 text-xs">
                      <Layers className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="font-semibold text-[11px]">Procurement Agent</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] flex items-center gap-2 text-xs">
                      <Compass className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="font-semibold text-[11px]">Risk & Site Agent</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 dark:bg-[#07182E] border-t border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  ProjectMatrix Enterprise AI • v2.5
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 bg-[#FF9F1C] hover:bg-[#E0880B] text-slate-950 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
