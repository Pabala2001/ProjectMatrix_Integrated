import { authenticatedFetch } from "../../integration/authenticatedFetch";
import React, { useState } from "react";
import { 
  X, 
  Sparkles, 
  Send, 
  AlertTriangle, 
  Clock, 
  TrendingDown, 
  Zap, 
  Bot, 
  User, 
  ChevronRight, 
  CheckCircle2, 
  RefreshCw,
  GitCommit,
  ShieldAlert
} from "lucide-react";
import { ProgrammeActivity } from "../../types";

interface AiDelayTraceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ProgrammeActivity[];
  contractCompletion?: string;
  predictedCompletion?: string;
  varianceDays?: number;
  onApplyMitigation?: (mitigationType: string) => void;
}

export function AiDelayTraceDrawer({
  isOpen,
  onClose,
  activities,
  contractCompletion = "28 Sep 2026",
  predictedCompletion = "12 Oct 2026",
  varianceDays = -14,
  onApplyMitigation
}: AiDelayTraceDrawerProps) {
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string; time: string }>>([
    {
      sender: "ai",
      text: `### 🚨 Critical Path Delay Diagnostic Analysis

**Schedule Summary:**
- **Contract Completion Target:** ${contractCompletion}
- **Predicted Completion Date:** ${predictedCompletion}
- **Programme Variance:** ${varianceDays} days (Behind Schedule)

---

### 🔍 Primary Delay Driver:
**WBS 2.1 / ACT-201: Bulk Excavation & Hard Rock Removal**
- **Planned Finish:** 15 Apr 2026
- **Forecast Finish:** 29 Apr 2026
- **Delay:** +14 Days | **Total Float:** -14 Days | **Status:** Critical & Delayed
- **Root Cause:** Encountered unforeseen hard basalt rock strata during site excavation, dropping daily productivity and requiring heavy hydraulic rock breaker attachments.

---

### ⛓️ Critical Path Propagation Trace:
1. **ACT-201 (Bulk Excavation):** Delayed by **+14 days** (Finish pushed from 15 Apr 2026 ➔ 29 Apr 2026)
2. ↳ **ACT-202 (Foundation Piling):** [FS Predecessor] Start pushed from 16 Apr 2026 ➔ 30 Apr 2026 (**+14 days**)
3. ↳ **ACT-300 (Concrete Superstructure):** [FS Predecessor] Start pushed from 01 Jun 2026 ➔ 14 Jun 2026 (**+14 days**)
4. ↳ **ACT-500 (Final Handover & Commissioning):** Pushed from **28 Sep 2026** ➔ **12 Oct 2026** (Variance: **-14 days**).

---

### 🛠️ Recommended Recovery & Mitigation Actions:
1. **Crash Piling Sequence (ACT-202):** Mobilize a 2nd heavy piling rig on dual 10-hour shifts to recover **8 days**.
2. **Fast-Track MEP Rough-In (ACT-400):** Parallelize ground-floor MEP conduit layout with Level 1 slab casting to recover **6 days**.
3. **Total Targeted Delay Recovery:** **14 Days** (restoring handover to **28 Sep 2026**).`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const promptText = inputPrompt.trim();
    if (!promptText || loading) return;

    const userMsg = {
      sender: "user" as const,
      text: promptText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt("");
    setLoading(true);

    try {
      const res = await authenticatedFetch("/api/programme/analyze-delay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          activities,
          contractCompletion,
          predictedCompletion,
          varianceDays
        })
      });

      const data = await res.json();
      const aiText = data.response || "Failed to generate AI delay diagnostic response.";

      setMessages(prev => [
        ...prev,
        {
          sender: "ai",
          text: aiText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      console.error("AI delay analysis error:", err);
      setMessages(prev => [
        ...prev,
        {
          sender: "ai",
          text: `⚠️ Error analyzing delay: ${err instanceof Error ? err.message : "Network error"}. Please try again.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#07182E]/60 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
      <div className="w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col justify-between border-l border-slate-200">
        
        {/* HEADER */}
        <div className="p-5 bg-[#07182E] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FF9F1C]/15 border border-[#FF9F1C]/30 rounded-xl text-[#FF9F1C]">
              <Sparkles className="w-5 h-5 fill-[#FF9F1C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">AI Delay Diagnostics & Trace</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Critical Path
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Automated Critical Path Causality & Variance Analysis</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* METRICS SUMMARY BAR */}
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 grid grid-cols-3 gap-3 text-center">
          <div className="border-r border-slate-800 pr-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Variance</span>
            <span className="text-xs font-black font-mono text-rose-400">{varianceDays} Days</span>
          </div>
          <div className="border-r border-slate-800 pr-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Predicted</span>
            <span className="text-xs font-black font-mono text-amber-300">{predictedCompletion}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Contract</span>
            <span className="text-xs font-black font-mono text-emerald-400">{contractCompletion}</span>
          </div>
        </div>

        {/* MESSAGES CONVERSATION SCROLL */}
        <div className="p-5 overflow-y-auto space-y-4 grow bg-slate-50">
          
          {/* QUICK PROMPT CHIPS */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              "What is driving the delay?",
              "How can we recover 14 days?",
              "Which tasks have float?",
              "Show critical path dependencies"
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  setInputPrompt(chip);
                }}
                className="px-2.5 py-1 bg-white hover:bg-[#FF9F1C]/10 border border-slate-200 hover:border-[#FF9F1C]/40 rounded-lg text-[11px] font-bold text-slate-700 hover:text-[#07182E] transition-all cursor-pointer shadow-2xs"
              >
                {chip}
              </button>
            ))}
          </div>

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  msg.sender === "user"
                    ? "bg-[#07182E] text-white"
                    : "bg-[#FF9F1C] text-[#07182E]"
                }`}
              >
                {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-2xs text-xs leading-relaxed space-y-2 ${
                  msg.sender === "user"
                    ? "bg-[#07182E] text-white rounded-tr-none"
                    : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                }`}
              >
                <div className="font-sans whitespace-pre-wrap">
                  {msg.text}
                </div>
                <div className="text-[10px] text-slate-400 text-right font-mono pt-1">
                  {msg.time}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-[#FF9F1C] flex items-center justify-center text-[#07182E]">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#07182E]">Tracing Critical Path Delay Drivers...</span>
                <p className="text-[10px] text-slate-400">Analyzing float, dependencies, and forecast finish variance</p>
              </div>
            </div>
          )}
        </div>

        {/* INPUT FORM FOOTER */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-3">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input 
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask AI about delay drivers, float, or mitigation plans..."
              className="grow px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#FF9F1C] focus:bg-white text-xs text-slate-800 font-medium transition-all"
            />
            <button
              type="submit"
              disabled={loading || !inputPrompt.trim()}
              className="px-4 py-2.5 bg-[#07182E] hover:bg-[#0c2444] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
            <span>Powered by Gemini Project Controls Engine</span>
            <span>Target: -14d Recovery</span>
          </div>
        </div>

      </div>
    </div>
  );
}
