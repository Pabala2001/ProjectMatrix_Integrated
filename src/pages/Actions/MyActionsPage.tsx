import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck,
  Plus,
  Coins,
  FileText,
  AlertOctagon,
  CheckSquare,
  Layers
} from "lucide-react";
import ProjectShell from "../../components/layout/ProjectShell";
import { MyActionsHub } from "../../components/actions/MyActionsHub";
import { MetricCard } from "../../components/ui/MetricCard";
import { Panel } from "../../components/ui/Panel";
import { ActionsService } from "../../services/actionsService";
import { ProjectAction, ActionPriority, ActionSourceType } from "../../types";

export default function MyActionsPage() {
  const navigate = useNavigate();
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const activeCompany = context.activeCompany;

  const [actions, setActions] = useState<ProjectAction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<ActionPriority>("HIGH");
  const [newSourceType, setNewSourceType] = useState<ActionSourceType>("PO");
  const [newSourceId, setNewSourceId] = useState("");
  const [newDueDate, setNewDueDate] = useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    ActionsService.getActions(activeCompany?.id, activeProject?.id).then((data) => {
      if (isMounted) {
        setActions(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeCompany?.id, activeProject?.id, refreshKey]);

  const pendingDecisionsCount = actions.filter(
    (a) => a.status === "REQUIRES_APPROVAL" || a.status === "PENDING"
  ).length;

  const criticalHighCount = actions.filter(
    (a) =>
      (a.priority === "CRITICAL" || a.priority === "HIGH") &&
      a.status !== "COMPLETED" &&
      a.status !== "REJECTED"
  ).length;

  const aiRecommendedCount = actions.filter((a) => a.is_ai_recommended).length;

  const auditComplianceRate =
    actions.length > 0
      ? `${Math.round(
          (actions.filter((a) => a.status === "COMPLETED").length / actions.length) * 100
        )}%`
      : "-";

  const handleCreateAction = async (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Actions/MyActionsPage.tsx");
    e.preventDefault();
    if (!newTitle.trim()) return;

    await ActionsService.createAction({
      organisation_id: activeCompany?.id || "org-default",
      project_id: activeProject?.id || undefined,
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      source_type: newSourceType,
      source_id: newSourceId.trim() || undefined,
      due_date: newDueDate,
      owner_user_id: context.profile?.id || "usr_pm_01",
      owner_name: context.profile?.full_name || "Lead Engineer",
      status: "REQUIRES_APPROVAL",
      requires_human_approval: true
    });

    setNewTitle("");
    setNewDesc("");
    setNewSourceId("");
    setIsModalOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <ProjectShell
      project={activeProject}
      section="engineering"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/engineering")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0B172A] hover:bg-[#162238] dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer shadow-2xs"
            title="Open Engineering Tab"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Engineering Tab</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Action</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Pending Decisions"
            value={String(pendingDecisionsCount)}
            subValue="Consequential approvals waiting"
            icon={CheckSquare}
            accentColor="#2F7CFF"
            status="default"
          />

          <MetricCard
            label="Critical & High"
            value={String(criticalHighCount)}
            subValue="High consequence authorizations"
            icon={AlertTriangle}
            accentColor="#E5484D"
            status={criticalHighCount > 0 ? "critical" : "default"}
          />

          <MetricCard
            label="AI Recommended"
            value={String(aiRecommendedCount)}
            subValue="Formulated by Matrix Intelligence"
            icon={Sparkles}
            accentColor="#00B894"
            status="intelligence"
          />

          <MetricCard
            label="Audit Authorizations"
            value={auditComplianceRate}
            subValue="Human sign-off compliance"
            icon={ShieldCheck}
            accentColor="#10B981"
            status="success"
          />
        </div>

        {/* Primary Interactive My Actions Subsystem */}
        <MyActionsHub
          key={refreshKey}
          projectId={activeProject?.id || "proj-alpha"}
          organisationId={activeCompany?.id || "org-default"}
          onNavigateToSource={(sourceType, sourceId) => {
            if (sourceType === "RFI" || sourceType === "NCR" || sourceType === "NOTICE" || sourceType === "MANUAL") {
              navigate(`/engineering?project=${activeProject?.id || ""}&sourceType=${sourceType}&sourceId=${encodeURIComponent(sourceId || "")}`);
            } else if (sourceType === "PO") {
              navigate(`/commercial/procurement?search=${encodeURIComponent(sourceId || "")}`);
            } else if (sourceType === "CERTIFICATE") {
              navigate(`/commercial/certificates?search=${encodeURIComponent(sourceId || "")}`);
            } else {
              navigate(`/engineering`);
            }
          }}
        />

        {/* Modal for creating a new action */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Add New Consequential Action
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateAction} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Action Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Approve PO-021 or Review Certificate-06"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Description & Scope
                  </label>
                  <textarea
                    rows={3}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Provide commercial or engineering context for the approver..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Source Type
                    </label>
                    <select
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value as ActionSourceType)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    >
                      <option value="PO">Purchase Order (PO)</option>
                      <option value="NOTICE">Contract Notice</option>
                      <option value="RFI">RFI</option>
                      <option value="NCR">NCR / Quality</option>
                      <option value="CERTIFICATE">Payment Certificate</option>
                      <option value="MANUAL">Manual Task</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Source Reference ID
                    </label>
                    <input
                      type="text"
                      value={newSourceId}
                      onChange={(e) => setNewSourceId(e.target.value)}
                      placeholder="e.g. PO-018, NCR-07"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Priority Level
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as ActionPriority)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#2F7CFF] hover:bg-[#1C68EB] text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                  >
                    Create Action
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </ProjectShell>
  );
}
