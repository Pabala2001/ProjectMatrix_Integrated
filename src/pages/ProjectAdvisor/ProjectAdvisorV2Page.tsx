import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  Cpu,
  Search,
  BookOpen,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Paperclip,
  ArrowRight,
  Shield,
  HelpCircle,
  Database,
  Sparkles,
} from "lucide-react";
import { processV2Question } from "../../services/projectAdvisorV2/intentRouter";
import { V2QueryResult } from "../../services/projectAdvisorV2/types";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

const SAMPLE_QUESTIONS = [
  "How many site diaries are recorded?",
  "Show site diaries from this week",
  "What delays were recorded this week?",
  "Show the latest site diaries",
  "Were any delays recorded today?",
  "Count the site diaries",
];

export default function ProjectAdvisorV2Page() {
  const { profile, activeCompany, activeProject } = useOutletContext<any>();
  const navigate = useNavigate();
  const { formatDate, formatDateTime } = useRegionalSettings();

  const [question, setQuestion] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [result, setResult] = useState<V2QueryResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAsk = async (questionToAsk?: string) => {
    const queryText = questionToAsk || question;
    if (!queryText.trim()) return;

    if (!activeCompany?.id || !activeProject?.id || activeProject.company_id !== activeCompany.id) {
      setErrorMsg("Please select an active company and project workspace first.");
      return;
    }

    setIsQuerying(true);
    setErrorMsg(null);

    try {
      const res = await processV2Question(
        queryText,
        activeCompany.id,
        activeProject.id
      );
      setResult(res);
      if (!questionToAsk) {
        setQuestion("");
      }
    } catch (err: any) {
      console.error("Project Advisor 2.0 query error:", err);
      setErrorMsg(
        err.message || "An error occurred while executing the register query."
      );
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#102846] dark:from-[#0A1F3A] dark:via-[#102846] dark:to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 bg-[#FF9F1C]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#FF9F1C]/20 border border-[#FF9F1C]/40 rounded-xl text-[#FF9F1C]">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                  Project Advisor 2.0
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FF9F1C]/20 text-[#FF9F1C] border border-[#FF9F1C]/30 font-semibold uppercase tracking-wider">
                    Site Diaries Vertical Slice
                  </span>
                </h1>
                <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                  Deterministic Factual Engine — Direct Queries &amp; Calculations Against Live ProjectMatrix Registers
                </p>
              </div>
            </div>
          </div>

          {/* Active Scope Badge */}
          <div className="bg-slate-800/80 dark:bg-[#0A1F3A]/90 backdrop-blur-xs border border-slate-700/70 rounded-xl p-3 text-xs space-y-1 self-start md:self-auto min-w-[240px]">
            <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#FF9F1C]" /> Authorized Workspace Scope
            </div>
            <div className="text-white font-semibold truncate">
              {activeCompany?.name || "No Company Selected"}
            </div>
            <div className="text-slate-300 truncate">
              Project: <span className="font-medium text-[#FF9F1C]">{activeProject?.name || "No Project Selected"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Query Input Section */}
      <div className="bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] rounded-2xl p-6 shadow-xs space-y-4">
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          Ask Factual Question (Site Diaries Register)
        </label>
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. How many site diaries are recorded? What delays were recorded this week?"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#102846] border border-slate-300 dark:border-[#1E3A5F] rounded-xl text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-[#FF9F1C] focus:border-transparent outline-hidden transition-all placeholder:text-slate-400"
              disabled={isQuerying}
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
          </div>

          <button
            type="submit"
            disabled={isQuerying || !question.trim()}
            className="px-6 py-3 bg-[#FF9F1C] hover:bg-[#e88e13] disabled:opacity-50 text-slate-950 font-semibold rounded-xl text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isQuerying ? (
              <>
                <Clock className="w-4 h-4 animate-spin" /> Querying Register...
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" /> Query Register
              </>
            )}
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="space-y-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[#FF9F1C]" /> Sample Factual Questions:
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUESTIONS.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuestion(sq);
                  handleAsk(sq);
                }}
                disabled={isQuerying}
                className="text-xs bg-slate-100 dark:bg-[#102846] hover:bg-slate-200 dark:hover:bg-[#1E3A5F] text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1E3A5F] transition-all cursor-pointer text-left"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message Notice */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Query Failed</div>
            <div>{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="space-y-6">
          {/* Main Direct Answer Card */}
          <div className="bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] rounded-2xl p-6 shadow-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-[#1E3A5F] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FF9F1C]/10 border border-[#FF9F1C]/30 rounded-lg text-[#FF9F1C]">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {result.title}
                  </h2>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-[#FF9F1C]">
                      Source: Site Diaries Register
                    </span>
                    <span>•</span>
                    <span>As at: {formatDateTime(result.asAt)}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="self-start sm:self-auto">
                {result.status === "success" && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified Register Data
                  </span>
                )}
                {result.status === "empty" && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Empty Result Set
                  </span>
                )}
                {result.status === "unsupported" && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" /> Intent Not Supported
                  </span>
                )}
              </div>
            </div>

            {/* Direct Answer Box */}
            <div className="bg-slate-50 dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] rounded-xl p-5 space-y-2">
              <div className="text-xs font-bold text-[#FF9F1C] uppercase tracking-wider">
                Direct Answer
              </div>
              <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                {result.directAnswer}
              </p>
            </div>

            {/* Calculation / Filtering Basis */}
            <div className="text-xs bg-slate-100/70 dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] rounded-xl p-4 font-mono text-slate-700 dark:text-slate-300 space-y-1">
              <div className="font-sans font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                Calculation &amp; Filtering Basis:
              </div>
              <div className="break-all">{result.calculationBasis}</div>
            </div>

            {/* Summary Metrics */}
            {result.metrics && result.metrics.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {result.metrics.map((m, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] rounded-xl p-4 space-y-1"
                  >
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {m.label}
                    </div>
                    <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested Questions if Unsupported */}
            {result.status === "unsupported" && result.suggestedQuestions && (
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Try one of these supported site diary questions:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.suggestedQuestions.map((sq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuestion(sq);
                        handleAsk(sq);
                      }}
                      className="p-3 text-left text-xs bg-slate-50 dark:bg-[#102846] hover:bg-slate-100 dark:hover:bg-[#1E3A5F] text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-[#1E3A5F] font-medium transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <span>{sq}</span>
                      <ArrowRight className="w-4 h-4 text-[#FF9F1C] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Evidence Rows Table / Cards */}
          {result.evidenceRows && result.evidenceRows.length > 0 && (
            <div className="bg-white dark:bg-[#0A1F3A] border border-slate-200 dark:border-[#1E3A5F] rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#FF9F1C]" />
                  Supporting Register Records ({result.evidenceRows.length})
                </h3>

                <button
                  type="button"
                  onClick={() => navigate(result.sourceRoute)}
                  className="text-xs text-[#FF9F1C] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  View in Site Diaries Register <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-[#1E3A5F] rounded-xl">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
                  <thead className="bg-slate-100 dark:bg-[#102846] text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-[#1E3A5F]">
                    <tr>
                      <th className="p-3">Diary Date</th>
                      <th className="p-3">Time</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Details / Entry Log</th>
                      <th className="p-3">Logged By</th>
                      <th className="p-3">Delay Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1E3A5F]/60">
                    {result.evidenceRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50 dark:hover:bg-[#102846]/60 transition-colors"
                      >
                        <td className="p-3 font-medium whitespace-nowrap text-slate-900 dark:text-slate-100">
                          {formatDate(row.diary_date)}
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                          {row.diary_time || "-"}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] rounded-md font-medium text-slate-700 dark:text-slate-300">
                            {row.log_category}
                          </span>
                        </td>
                        <td className="p-3 max-w-md">
                          <p className="line-clamp-2 text-slate-800 dark:text-slate-200">
                            {row.details}
                          </p>
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {row.logged_by || "Site Agent"}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {row.has_delay ? (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" /> Delay: {row.delay_reason || "Yes"}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No Delay</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
