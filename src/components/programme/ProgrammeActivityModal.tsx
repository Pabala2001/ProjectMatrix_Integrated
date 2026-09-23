import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { 
  EngineActivity, 
  ProjectCalendar, 
  RelationshipType, 
  ConstraintType, 
  ActivityType 
} from "../../types/programmeEngine";
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Link, 
  Layers, 
  Users, 
  ShieldAlert, 
  Sparkles,
  Info,
  Edit2,
  Eye
} from "lucide-react";

interface ProgrammeActivityModalProps {
  activity: EngineActivity | null;
  allActivities: EngineActivity[];
  calendars: Record<string, ProjectCalendar>;
  isOpen: boolean;
  isViewOnly?: boolean;
  onClose: () => void;
  onSave: (updatedActivity: EngineActivity) => void;
  onDelete?: (id: string) => void;
  onSwitchToEdit?: () => void;
}

export const ProgrammeActivityModal: React.FC<ProgrammeActivityModalProps> = ({
  activity,
  allActivities,
  calendars,
  isOpen,
  isViewOnly = false,
  onClose,
  onSave,
  onDelete,
  onSwitchToEdit
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "logic" | "dates_progress" | "constraints" | "baselines" | "resources">("general");
  const [formData, setFormData] = useState<EngineActivity | null>(null);
  const [internalViewOnly, setInternalViewOnly] = useState(isViewOnly);

  useEffect(() => {
    if (activity) {
      setFormData(JSON.parse(JSON.stringify(activity)));
    }
  }, [activity]);

  useEffect(() => {
    setInternalViewOnly(isViewOnly);
  }, [isViewOnly, activity?.id]);

  if (!isOpen || !formData) return null;

  const handleUpdateField = (field: keyof EngineActivity, value: any) => {
    assertOperationalAction("edit", "components/programme/ProgrammeActivityModal.tsx");
    setFormData(prev => {
      if (!prev) return null;
      return { ...prev, [field]: value };
    });
  };

  // Predecessor Logic Management
  const handleAddPredecessor = () => {
    assertOperationalAction("create", "components/programme/ProgrammeActivityModal.tsx");
    const available = allActivities.find(a => a.id !== formData.id && !formData.predecessors.some(p => p.predecessorId === a.id));
    if (!available) return;

    setFormData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        predecessors: [
          ...prev.predecessors,
          {
            id: `pred-${crypto.randomUUID().slice(0, 8)}`,
            predecessorId: available.id,
            type: "FS",
            lag: 0
          }
        ]
      };
    });
  };

  const handleRemovePredecessor = (index: number) => {
    assertOperationalAction("delete", "components/programme/ProgrammeActivityModal.tsx");
    setFormData(prev => {
      if (!prev) return null;
      const next = [...prev.predecessors];
      next.splice(index, 1);
      return { ...prev, predecessors: next };
    });
  };

  const handleUpdatePredecessor = (index: number, field: string, val: any) => {
    assertOperationalAction("edit", "components/programme/ProgrammeActivityModal.tsx");
    setFormData(prev => {
      if (!prev) return null;
      const next = [...prev.predecessors];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, predecessors: next };
    });
  };

  // Resource Assignment Management
  const handleUpdateResource = (field: string, val: any) => {
    assertOperationalAction("edit", "components/programme/ProgrammeActivityModal.tsx");
    setFormData(prev => {
      if (!prev) return null;
      const cur = prev.resourceAssignment || {
        resourceId: `res-${crypto.randomUUID().slice(0, 6)}`,
        resourceName: "Civil Staff Team #1",
        totalScopeQty: 100,
        unit: "m³",
        targetDailyRate: 10,
        actualDailyRateAchieved: 10
      };
      return {
        ...prev,
        resourceAssignment: {
          ...cur,
          [field]: val
        }
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/programme/ProgrammeActivityModal.tsx");
    e.preventDefault();
    if (!formData) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 shrink-0">
              {formData.wbsCode}
            </span>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                {formData.name || "Activity Details"}
              </h2>
              {internalViewOnly ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                  View Mode
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                  Editing
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {internalViewOnly && (
              <button
                type="button"
                onClick={() => {
                  setInternalViewOnly(false);
                  onSwitchToEdit?.();
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Switch to Edit Mode"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Activity</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 px-4 text-xs font-bold gap-1 overflow-x-auto select-none">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "general" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            General & WBS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logic")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "logic" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Logic (FS/SS/FF/SF) ({formData.predecessors.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dates_progress")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "dates_progress" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Duration & Progress
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("constraints")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "constraints" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Constraints & Calendar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("baselines")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "baselines" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Baselines (B0 / B1)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("resources")}
            className={`py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === "resources" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Resource & Productivity
          </button>
        </div>

        {/* Tab Body */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: GENERAL & WBS */}
          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  WBS Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.wbsCode}
                  onChange={(e) => handleUpdateField("wbsCode", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Activity Type
                </label>
                <select
                  value={formData.activityType}
                  onChange={(e) => handleUpdateField("activityType", e.target.value as ActivityType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="Task">Standard Task</option>
                  <option value="StartMilestone">Start Milestone (0 Duration)</option>
                  <option value="FinishMilestone">Finish Milestone (0 Duration)</option>
                  <option value="Summary">Summary / WBS Container</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Activity Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleUpdateField("name", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description / Specification Reference
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ""}
                  onChange={(e) => handleUpdateField("description", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  placeholder="Detailed engineering scope, drawing refs, mix designs..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Responsible Lead / Contractor
                </label>
                <input
                  type="text"
                  value={formData.responsiblePerson || ""}
                  onChange={(e) => handleUpdateField("responsiblePerson", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => handleUpdateField("sortOrder", parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* TAB 2: LOGIC & PREDECESSORS (FS, SS, FF, SF + LAG) */}
          {activeTab === "logic" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Predecessor Dependencies
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Define mathematical relationships driving this activity's Early Start date.
                  </p>
                </div>
                {!internalViewOnly && (
                  <button
                    type="button"
                    onClick={handleAddPredecessor}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Predecessor</span>
                  </button>
                )}
              </div>

              {formData.predecessors.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                  No incoming predecessors. This activity floats from the project anchor or constraint date.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {formData.predecessors.map((pred, idx) => {
                    const targetAct = allActivities.find(a => a.id === pred.predecessorId);
                    return (
                      <div key={pred.id || idx} className="p-3 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Predecessor Activity</label>
                          {internalViewOnly ? (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white">
                              {targetAct ? `[${targetAct.wbsCode}] ${targetAct.name}` : pred.predecessorId}
                            </div>
                          ) : (
                            <select
                              value={pred.predecessorId}
                              onChange={(e) => handleUpdatePredecessor(idx, "predecessorId", e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                            >
                              {allActivities.filter(a => a.id !== formData.id).map(a => (
                                <option key={a.id} value={a.id}>
                                  [{a.wbsCode}] {a.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="w-36">
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Relationship Type</label>
                          {internalViewOnly ? (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white">
                              {pred.type === "FS" ? "Finish to Start (FS)" :
                               pred.type === "SS" ? "Start to Start (SS)" :
                               pred.type === "FF" ? "Finish to Finish (FF)" : "Start to Finish (SF)"}
                            </div>
                          ) : (
                            <select
                              value={pred.type}
                              onChange={(e) => handleUpdatePredecessor(idx, "type", e.target.value as RelationshipType)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                            >
                              <option value="FS">FS (Finish to Start)</option>
                              <option value="SS">SS (Start to Start)</option>
                              <option value="FF">FF (Finish to Finish)</option>
                              <option value="SF">SF (Start to Finish)</option>
                            </select>
                          )}
                        </div>

                        <div className="w-24">
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Lag (Days)</label>
                          {internalViewOnly ? (
                            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white">
                              {pred.lag > 0 ? `+${pred.lag}d` : `${pred.lag}d`}
                            </div>
                          ) : (
                            <input
                              type="number"
                              value={pred.lag}
                              onChange={(e) => handleUpdatePredecessor(idx, "lag", parseInt(e.target.value, 10) || 0)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                              placeholder="e.g. 0 or +2"
                            />
                          )}
                        </div>

                        {!internalViewOnly && (
                          <div className="pt-4">
                            <button
                              type="button"
                              onClick={() => handleRemovePredecessor(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DURATION & PROGRESS */}
          {activeTab === "dates_progress" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Original Duration (OD Days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.originalDuration}
                  onChange={(e) => handleUpdateField("originalDuration", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Remaining Duration (RD Days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.remainingDuration}
                  onChange={(e) => handleUpdateField("remainingDuration", Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Physical Progress % (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => handleUpdateField("progress", Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Activity Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleUpdateField("status", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                  <option value="Delayed">Delayed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Actual Start Date
                </label>
                <input
                  type="date"
                  value={formData.actualStart || ""}
                  onChange={(e) => handleUpdateField("actualStart", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Actual Finish Date
                </label>
                <input
                  type="date"
                  value={formData.actualFinish || ""}
                  onChange={(e) => handleUpdateField("actualFinish", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* TAB 4: CONSTRAINTS & CALENDAR */}
          {activeTab === "constraints" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Project Calendar Assignment
                </label>
                <select
                  value={formData.calendarId}
                  onChange={(e) => handleUpdateField("calendarId", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  {(Object.values(calendars) as ProjectCalendar[]).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Constraint Type
                </label>
                <select
                  value={formData.constraintType}
                  onChange={(e) => handleUpdateField("constraintType", e.target.value as ConstraintType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="ASAP">ASAP (As Soon As Possible - Default)</option>
                  <option value="ALAP">ALAP (As Late As Possible)</option>
                  <option value="SNET">SNET (Start No Earlier Than)</option>
                  <option value="SNLT">SNLT (Start No Later Than)</option>
                  <option value="FNET">FNET (Finish No Earlier Than)</option>
                  <option value="FNLT">FNLT (Finish No Later Than)</option>
                  <option value="MSO">MSO (Must Start On - Hard)</option>
                  <option value="MFO">MFO (Must Finish On - Hard)</option>
                </select>
              </div>

              {formData.constraintType !== "ASAP" && formData.constraintType !== "ALAP" && (
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Constraint Date
                  </label>
                  <input
                    type="date"
                    value={formData.constraintDate || ""}
                    onChange={(e) => handleUpdateField("constraintDate", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BASELINES (B0 / B1) */}
          {activeTab === "baselines" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Baseline 0 (Contract Initial Target)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">B0 Start Date</label>
                    <input
                      type="date"
                      value={formData.baseline0?.baselineStart || ""}
                      onChange={(e) => handleUpdateField("baseline0", {
                        ...(formData.baseline0 || { duration: formData.originalDuration }),
                        baselineStart: e.target.value
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">B0 Finish Date</label>
                    <input
                      type="date"
                      value={formData.baseline0?.baselineFinish || ""}
                      onChange={(e) => handleUpdateField("baseline0", {
                        ...(formData.baseline0 || { duration: formData.originalDuration }),
                        baselineFinish: e.target.value
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                  Baseline 1 (Approved EoT Revision)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">B1 Start Date</label>
                    <input
                      type="date"
                      value={formData.baseline1?.baselineStart || ""}
                      onChange={(e) => handleUpdateField("baseline1", {
                        ...(formData.baseline1 || { duration: formData.originalDuration }),
                        baselineStart: e.target.value
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">B1 Finish Date</label>
                    <input
                      type="date"
                      value={formData.baseline1?.baselineFinish || ""}
                      onChange={(e) => handleUpdateField("baseline1", {
                        ...(formData.baseline1 || { duration: formData.originalDuration }),
                        baselineFinish: e.target.value
                      })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: RESOURCES & PRODUCTIVITY */}
          {activeTab === "resources" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Resource Crew Name
                </label>
                <input
                  type="text"
                  value={formData.resourceAssignment?.resourceName || ""}
                  onChange={(e) => handleUpdateResource("resourceName", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  placeholder="e.g. Concrete Pour Crew #2"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Scope Measurement Unit
                </label>
                <input
                  type="text"
                  value={formData.resourceAssignment?.unit || "m³"}
                  onChange={(e) => handleUpdateResource("unit", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                  placeholder="e.g. m³, tons, lin.m, boreholes"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Total Scope Quantity
                </label>
                <input
                  type="number"
                  value={formData.resourceAssignment?.totalScopeQty || 0}
                  onChange={(e) => handleUpdateResource("totalScopeQty", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Target Daily Production Rate (Unit/Day)
                </label>
                <input
                  type="number"
                  value={formData.resourceAssignment?.targetDailyRate || 0}
                  onChange={(e) => handleUpdateResource("targetDailyRate", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Empirical Actual Daily Rate Achieved (Unit/Day)
                </label>
                <input
                  type="number"
                  value={formData.resourceAssignment?.actualDailyRateAchieved || 0}
                  onChange={(e) => handleUpdateResource("actualDailyRateAchieved", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-blue-600 dark:text-blue-400"
                />
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onDelete && !internalViewOnly && (
                <button
                  type="button"
                  onClick={() => onDelete(formData.id)}
                  className="px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Delete this activity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Activity</span>
                </button>
              )}
              <span className="text-[11px] text-slate-400">
                {internalViewOnly 
                  ? "Click 'Edit Activity' to modify logic, durations, and network relationships."
                  : "Saving triggers full CPM Forward & Backward network pass."
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {internalViewOnly ? "Close" : "Cancel"}
              </button>
              {internalViewOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    setInternalViewOnly(false);
                    onSwitchToEdit?.();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Activity</span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save & Calculate CPM</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
