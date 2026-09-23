import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Filter, 
  Search, 
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  Layers
} from "lucide-react";
import { ProjectAction } from "../../types";
import { ActionsService } from "../../services/actionsService";
import { ActionCard } from "../ui/ActionCard";
import { StatusBadge } from "../ui/StatusBadge";
import { Tabs } from "../ui/Tabs";
import { Panel } from "../ui/Panel";
import { tokens } from "../../tokens";

export interface MyActionsHubProps {
  projectId?: string;
  organisationId?: string;
  onNavigateToSource?: (sourceType: string, sourceId: string) => void;
  className?: string;
  id?: string;
}

export const MyActionsHub: React.FC<MyActionsHubProps> = ({
  projectId,
  organisationId,
  onNavigateToSource,
  className = "",
  id = "my-actions-hub"
}) => {
  const [actions, setActions] = useState<ProjectAction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterTab, setFilterTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Load actions
  const loadActions = async () => {
    setLoading(true);
    try {
      const data = await ActionsService.getActions(organisationId, projectId);
      setActions(data);
    } catch (e) {
      console.error("Error loading actions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, [projectId, organisationId]);

  const handleApprove = async (actionId: string) => {
    assertOperationalAction("approve", "components/actions/MyActionsHub.tsx");
    try {
      const updated = await ActionsService.approveAction(actionId);
      setActions(updated);
      setFeedback("Action approved and authorization recorded in audit ledger.");
      setTimeout(() => setFeedback(null), 3500);
    } catch (e) {
      console.error("Approval error:", e);
    }
  };

  const handleReject = async (actionId: string) => {
    assertOperationalAction("approve", "components/actions/MyActionsHub.tsx");
    try {
      const updated = await ActionsService.rejectAction(actionId);
      setActions(updated);
      setFeedback("Action rejected.");
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      console.error("Reject error:", e);
    }
  };

  const handleComplete = async (actionId: string) => {
    try {
      const updated = await ActionsService.completeAction(actionId);
      setActions(updated);
      setFeedback("Action marked complete.");
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      console.error("Complete error:", e);
    }
  };

  const handleGenerateAIRecommendations = async () => {
    setIsGeneratingAI(true);
    try {
      await ActionsService.generateIntelligenceRecommendations(projectId);
      await loadActions();
      setFeedback("Matrix Intelligence formulated 2 priority recommended actions based on project risks.");
      setTimeout(() => setFeedback(null), 4000);
    } catch (e) {
      console.error("AI recommendation error:", e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Filter actions
  const filteredActions = actions.filter((act) => {
    const matchesSearch = 
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.description && act.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (act.source_id && act.source_id.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTab === "pending") {
      return act.status === "PENDING" || act.status === "REQUIRES_APPROVAL";
    }
    if (filterTab === "ai") {
      return act.is_ai_recommended;
    }
    if (filterTab === "critical") {
      return act.priority === "CRITICAL" || act.priority === "HIGH";
    }
    if (filterTab === "completed") {
      return act.status === "COMPLETED";
    }
    return true;
  });

  const pendingCount = actions.filter(a => a.status === "PENDING" || a.status === "REQUIRES_APPROVAL").length;
  const aiCount = actions.filter(a => a.is_ai_recommended).length;
  const criticalCount = actions.filter(a => a.priority === "CRITICAL").length;

  const tabItems = [
    { id: "all", label: "All Actions", badge: actions.length },
    { id: "pending", label: "Pending Approval", badge: pendingCount, badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300" },
    { id: "ai", label: "Matrix Intelligence", badge: aiCount, badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300" },
    { id: "critical", label: "High & Critical", badge: criticalCount, badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <div id={id} className={`space-y-4 ${className}`}>
      
      {/* Module Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-[#101828] dark:text-white tracking-tight uppercase">
              MY ACTIONS
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2F7CFF] dark:text-[#60A5FA] font-mono text-xs font-bold border border-blue-200 dark:border-blue-800">
              {pendingCount} Required Decisions
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl font-medium">
            Consequential decision queue across procurement, notices, RFIs, quality inspections, and interim certificates.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              if (onNavigateToSource) {
                onNavigateToSource("MANUAL", "");
              } else {
                window.location.hash = `/engineering${projectId ? `?project=${projectId}` : ""}`;
              }
            }}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            title="Open Engineering Tab"
          >
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Engineering Tab</span>
          </button>

          <button
            onClick={handleGenerateAIRecommendations}
            disabled={isGeneratingAI}
            className="px-4 py-2.5 bg-[#00B894]/10 hover:bg-[#00B894]/20 text-[#00896F] dark:text-[#00D2A0] border border-[#00B894]/30 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-[#00B894] ${isGeneratingAI ? "animate-spin" : ""}`} />
            <span>{isGeneratingAI ? "Diagnosing Risks..." : "Matrix Intelligence Recommend"}</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={tabItems}
          activeTab={filterTab}
          onChange={(tab) => setFilterTab(tab)}
          variant="pill"
        />

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search actions..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Action Cards List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
          <p className="text-xs font-semibold">Loading action ledger...</p>
        </div>
      ) : filteredActions.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Clear</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are no pending actions in this view. All consequential milestones are currently up to date.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onApprove={handleApprove}
              onReject={handleReject}
              onComplete={handleComplete}
              onViewSource={onNavigateToSource ? (act) => onNavigateToSource(act.source_type, act.source_id || "") : undefined}
            />
          ))}
        </div>
      )}

      {/* Enterprise Consequential Authorization Disclaimer */}
      <div className="p-4 bg-slate-100/70 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Governance & Human Accountability Protocol
          </span>
          <p className="text-[11px] leading-relaxed">
            Matrix Intelligence generates automated recommendations and early risk diagnostics. However, contractual authorizations (POs, FIDIC notices, interim payment certificates, and NCR signoffs) require conscious human approval to enforce commercial compliance.
          </p>
        </div>
      </div>

    </div>
  );
};

export default MyActionsHub;
