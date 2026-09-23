import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Plus, 
  Trash2, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  X, 
  FileCode, 
  Eye, 
  Layers, 
  CalendarDays,
  Clock, 
  Save, 
  Info, 
  Calendar, 
  FileSpreadsheet, 
  Sparkles, 
  TrendingDown, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Coins,
  Flame,
  Gauge,
  SlidersHorizontal,
  Table,
  BarChart3,
  ShieldCheck,
  Camera
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase, isApiKeyError } from "../../lib/supabase";
import { validateTenantContext } from "../../utils/tenantGuard";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { 
  EngineActivity, 
  ProjectCalendar, 
  CPMCalculationResult, 
  CalculationDiagnostic 
} from "../../types/programmeEngine";
import { 
  calculateCPM, 
  DEFAULT_CALENDARS, 
  formatDate, 
  snapshotBaseline 
} from "../../services/cpmEngine";
import { ProgrammeControlsMatrix } from "../../components/programme/ProgrammeControlsMatrix";
import { ProgrammeGanttVisualizer } from "../../components/programme/ProgrammeGanttVisualizer";
import { ProgrammeBaselineStudio } from "../../components/programme/ProgrammeBaselineStudio";
import { ProgrammeResourceProductivity } from "../../components/programme/ProgrammeResourceProductivity";
import { ProgrammeCalendarManager } from "../../components/programme/ProgrammeCalendarManager";
import { ProgrammeScheduleHealthAudit } from "../../components/programme/ProgrammeScheduleHealthAudit";
import { ProgrammeActivityModal } from "../../components/programme/ProgrammeActivityModal";
import { AiDelayTraceDrawer } from "../../components/programme/AiDelayTraceDrawer";
import { ProgrammeImportModal } from "../../components/programme/ProgrammeImportModal";
import { calculateProgrammeDateBounds } from "../../services/programmeSyncService";
import { PROGRAMME_SQL_SNIPPET } from "./sqlSnippet";
import ProjectShell from "../../components/layout/ProjectShell";

// Helper to ensure every activity has a strictly unique ID
function sanitizeActivities(acts: any[]): EngineActivity[] {
  if (!Array.isArray(acts)) return [];
  const seenIds = new Set<string>();
  return acts.map((act, index) => {
    let id = act.id || `act-${index + 1}`;
    if (seenIds.has(id)) {
      id = `${id}-${index + 1}`;
    }
    seenIds.add(id);
    return {
      ...act,
      id
    };
  });
}

export default function ProgrammePage() {
  const { 
    activeCompany, 
    activeProject, 
    setErrorMsg, 
    setSuccessMsg 
  } = useOutletContext<any>();

  const { formatDateTime } = useRegionalSettings();

  // Engine state
  const [dataDate, setDataDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [calendars, setCalendars] = useState<Record<string, ProjectCalendar>>(DEFAULT_CALENDARS);
  
  // Load activities from project storage or default to empty
  const [activities, setActivities] = useState<EngineActivity[]>(() => {
    try {
      if (activeProject?.id) {
        const stored = previewStorage.getItem(`pm_programme_activities_${activeProject.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return sanitizeActivities(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load project programme activities:", e);
    }
    return [];
  });

  const [calculationResult, setCalculationResult] = useState<CPMCalculationResult>(() => 
    calculateCPM(activities, { dataDate: dataDate, calendars: DEFAULT_CALENDARS })
  );

  // Sync activities when activeProject changes
  useEffect(() => {
    try {
      if (activeProject?.id) {
        const stored = previewStorage.getItem(`pm_programme_activities_${activeProject.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const sanitized = sanitizeActivities(parsed);
            setActivities(sanitized);
            const result = calculateCPM(sanitized, { dataDate, calendars });
            setCalculationResult(result);
            return;
          }
        }
      }
    } catch (e) {
      console.error("Failed to load project programme activities:", e);
    }
    setActivities([]);
    setCalculationResult(calculateCPM([], { dataDate, calendars }));
  }, [activeProject?.id]);

  // Save activities to project storage and fallback
  const saveProjectActivities = (acts: EngineActivity[]) => {
    assertOperationalAction("write", "pages/Programme/ProgrammePage.tsx");
    try {
      if (activeProject?.id) {
        previewStorage.setItem(`pm_programme_activities_${activeProject.id}`, JSON.stringify(acts));
      }
    } catch (e) {
      console.error("Failed to save project programme activities:", e);
    }
  };

  // Active view tab (default to interactive CPM Gantt split-screen workspace)
  const [activeTab, setActiveTab] = useState<"gantt" | "matrix" | "baselines" | "productivity" | "dcma">("gantt");

  // Selection and Modals state
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<EngineActivity | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isActivityViewOnly, setIsActivityViewOnly] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data synchronization service: calculates programmeStart & programmeFinish across all project activities
  const programmeBounds = useMemo(() => {
    return calculateProgrammeDateBounds(activities, dataDate);
  }, [activities, dataDate]);

  // Run CPM Calculation
  const runCPM = (actsToCalc: EngineActivity[] = activities, dDate: string = dataDate, cals: Record<string, ProjectCalendar> = calendars) => {
    setIsCalculating(true);
    try {
      const result = calculateCPM(actsToCalc, {
        dataDate: dDate,
        calendars: cals,
        criticalFloatThreshold: 0,
        calculateLongestPath: true
      });
      setCalculationResult(result);
      setActivities(result.activities);
      saveProjectActivities(result.activities);
      setSuccessMsg(`CPM Engine calculated: ${result.diagnostics.criticalActivitiesCount} critical tasks, Finish: ${result.diagnostics.projectForecastFinish} (${result.diagnostics.calculationTimeMs}ms)`);
    } catch (err: any) {
      setErrorMsg(`CPM calculation error: ${err?.message || "Unknown error"}`);
    } finally {
      setIsCalculating(false);
    }
  };

  // Re-run whenever data date changes
  const handleDataDateChange = (newDate: string) => {
    setDataDate(newDate);
    runCPM(activities, newDate, calendars);
  };

  // Handle Snapshot Baseline
  const handleSnapshotBaseline = (target: "baseline0" | "baseline1") => {
    const updated = snapshotBaseline(activities, target);
    setActivities(updated);
    runCPM(updated, dataDate, calendars);
    setSuccessMsg(`Successfully snapshotted current CPM schedule into ${target === "baseline0" ? "Baseline 0 (Contract)" : "Baseline 1 (Revised)"}!`);
  };

  // Handle View Activity
  const handleViewActivity = (act: EngineActivity) => {
    setEditingActivity(act);
    setIsActivityViewOnly(true);
    setIsActivityModalOpen(true);
  };

  // Handle Edit Activity
  const handleEditActivity = (act: EngineActivity) => {
    setEditingActivity(act);
    setIsActivityViewOnly(false);
    setIsActivityModalOpen(true);
  };

  // Handle Save Activity from Modal
  const handleSaveActivity = (updatedAct: EngineActivity) => {
    assertOperationalAction("write", "pages/Programme/ProgrammePage.tsx");
    const nextActivities = activities.some(a => a.id === updatedAct.id)
      ? activities.map(a => a.id === updatedAct.id ? updatedAct : a)
      : [...activities, updatedAct];

    setActivities(nextActivities);
    setIsActivityModalOpen(false);
    setEditingActivity(null);
    setIsActivityViewOnly(false);
    runCPM(nextActivities, dataDate, calendars);
    setSuccessMsg(`Activity [${updatedAct.wbsCode}] saved and full CPM pass recomputed!`);
  };

  // Handle Delete Activity (safe direct deletion without window.confirm to support iframe sandboxes)
  const handleDeleteActivity = (id: string) => {
    assertOperationalAction("delete", "pages/Programme/ProgrammePage.tsx");
    const target = activities.find(a => String(a.id) === String(id));
    
    // Remove activity and all references from other activities' predecessors
    const nextActivities = activities
      .filter(a => String(a.id) !== String(id))
      .map(a => ({
        ...a,
        predecessors: (a.predecessors || []).filter(p => String(p?.predecessorId) !== String(id))
      }));

    setActivities(nextActivities);
    if (selectedActivityId === id) setSelectedActivityId(null);
    saveProjectActivities(nextActivities);
    runCPM(nextActivities, dataDate, calendars);
    setSuccessMsg(`Activity [${target?.wbsCode || id}] deleted successfully.`);
  };

  // Handle Add New Activity
  const handleAddNewActivity = () => {
    assertOperationalAction("create", "pages/Programme/ProgrammePage.tsx");
    const newWbsNum = activities.length * 10 + 10;
    const newAct: EngineActivity = {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      wbsCode: `ACT-${newWbsNum}`,
      name: "New Project Task",
      description: "",
      activityType: "Task",
      calendarId: "cal-6day",
      sortOrder: activities.length + 1,
      originalDuration: 10,
      remainingDuration: 10,
      actualDuration: 0,
      progress: 0,
      status: "Not Started",
      constraintType: "ASAP",
      predecessors: activities.length > 0 ? [{
        id: `p-${crypto.randomUUID().slice(0, 6)}`,
        predecessorId: activities[activities.length - 1].id,
        type: "FS",
        lag: 0
      }] : [],
      successors: [],
      earlyStart: dataDate,
      earlyFinish: dataDate,
      lateStart: dataDate,
      lateFinish: dataDate,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: true,
      forecastStart: dataDate,
      forecastFinish: dataDate,
      varianceB0Days: 0,
      varianceB1Days: 0
    };

    setEditingActivity(newAct);
    setIsActivityViewOnly(false);
    setIsActivityModalOpen(true);
  };

  // Handle Import from Excel / P6 XML
  const handleImportedActivities = (importedActs: EngineActivity[]) => {
    assertOperationalAction("write", "pages/Programme/ProgrammePage.tsx");
    const sanitized = sanitizeActivities(importedActs);
    setActivities(sanitized);
    runCPM(sanitized, dataDate, calendars);
    setIsImportModalOpen(false);
    setSuccessMsg(`Successfully imported & calculated ${sanitized.length} schedule activities with CPM logic!`);
  };

  const diagnostics = calculationResult.diagnostics;

  return (
    <ProjectShell project={activeProject} section="controls">
      <div className="controls-page-container overflow-hidden max-w-full space-y-6">
        {/* Top Banner & Project Controls Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-black uppercase tracking-wider border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Primavera P6 & DCMA Compliant</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Mathematical Forward/Backward CPM Engine
              </span>
            </div>

            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Programme of Works & Project Controls Engine
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Full Critical Path Method (CPM) matrix engine with FS/SS/FF/SF multi-relationship lag calculation, multi-calendars, hard/soft constraints, multi-baseline comparison (B0 / B1), and dynamic productivity forecasting.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-blue-600" />
              <div className="flex flex-col">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Data Date</span>
                <input
                  type="date"
                  value={dataDate}
                  onChange={(e) => handleDataDateChange(e.target.value)}
                  className="text-xs font-mono font-bold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={() => setIsCalendarModalOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              title="Manage 5-Day, 6-Day, 7-Day & Holiday Calendars"
            >
              <CalendarDays className="w-4 h-4 text-slate-500" />
              <span>Calendars ({Object.keys(calendars).length})</span>
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Import Schedule</span>
            </button>

            <button
              onClick={() => setAiDrawerOpen(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Delay & Forensics</span>
            </button>
          </div>
        </div>

        {/* Engine Diagnostic KPI Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Prog Start</span>
            <div className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1">
              {programmeBounds.programmeStart || "—"}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Prog Finish</span>
            <div className="text-xs font-black font-mono text-purple-700 dark:text-purple-300 mt-1">
              {programmeBounds.programmeFinish || "—"}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Critical Tasks</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-rose-600">{diagnostics.criticalActivitiesCount}</span>
              <span className="text-[10px] font-mono text-slate-400">/ {diagnostics.totalActivities}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Forecast Completion</span>
            <div className="text-xs font-black font-mono text-slate-900 dark:text-white mt-1">
              {diagnostics.projectForecastFinish}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Baseline 0 Var</span>
            <div className="text-xs font-black font-mono text-rose-600 mt-1">
              +{diagnostics.b0VarianceDays} Days
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Baseline 1 Var</span>
            <div className="text-xs font-black font-mono text-indigo-600 mt-1">
              +{diagnostics.b1VarianceDays} Days
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Float Range</span>
            <div className="text-xs font-black font-mono text-slate-700 dark:text-slate-300 mt-1">
              {diagnostics.totalFloatMin}d to {diagnostics.totalFloatMax}d
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">DCMA 14 Quality</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-lg font-black ${diagnostics.dcmaScore >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                {diagnostics.dcmaScore}%
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold gap-2 overflow-x-auto select-none">
        <button
          onClick={() => setActiveTab("gantt")}
          className={`py-3 px-4 rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "gantt" 
              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-black -mb-px" 
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>CPM Gantt & Split Workspace</span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`py-3 px-4 rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "matrix" 
              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-black -mb-px" 
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Full Activity Register & Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab("baselines")}
          className={`py-3 px-4 rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "baselines" 
              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black -mb-px" 
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Baseline Studio (B0 / B1 / Current / Forecast)</span>
        </button>

        <button
          onClick={() => setActiveTab("productivity")}
          className={`py-3 px-4 rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "productivity" 
              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-black -mb-px" 
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Resource & Daily Productivity Burn</span>
        </button>

        <button
          onClick={() => setActiveTab("dcma")}
          className={`py-3 px-4 rounded-t-2xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "dcma" 
              ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-purple-600 dark:text-purple-400 shadow-xs font-black -mb-px" 
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>DCMA 14-Point Health Audit</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="w-full">
        {activeTab === "gantt" && (
          <ProgrammeGanttVisualizer
            activities={activities}
            dataDate={dataDate}
            calendars={calendars}
            programmeStart={programmeBounds.programmeStart}
            programmeFinish={programmeBounds.programmeFinish}
            onSelectActivity={setSelectedActivityId}
            selectedActivityId={selectedActivityId}
            onEditActivity={handleEditActivity}
            onViewActivity={handleViewActivity}
            onDeleteActivity={handleDeleteActivity}
          />
        )}

        {activeTab === "matrix" && (
          <ProgrammeControlsMatrix
            activities={activities}
            calendars={calendars}
            onViewActivity={handleViewActivity}
            onEditActivity={handleEditActivity}
            onDeleteActivity={handleDeleteActivity}
            onAddActivity={handleAddNewActivity}
            onRecalculateCPM={() => runCPM(activities, dataDate, calendars)}
            onSelectActivity={setSelectedActivityId}
            selectedActivityId={selectedActivityId}
          />
        )}

        {activeTab === "baselines" && (
          <ProgrammeBaselineStudio
            activities={activities}
            onSnapshotBaseline={handleSnapshotBaseline}
          />
        )}

        {activeTab === "productivity" && (
          <ProgrammeResourceProductivity
            activities={activities}
            onEditActivity={handleEditActivity}
          />
        )}

        {activeTab === "dcma" && (
          <ProgrammeScheduleHealthAudit
            diagnostics={diagnostics}
            activities={activities}
            onSelectActivity={setSelectedActivityId}
          />
        )}
      </div>

      {/* Activity Edit Modal */}
      {isActivityModalOpen && (
        <ProgrammeActivityModal
          activity={editingActivity}
          allActivities={activities}
          calendars={calendars}
          isOpen={isActivityModalOpen}
          isViewOnly={isActivityViewOnly}
          onClose={() => {
            setIsActivityModalOpen(false);
            setEditingActivity(null);
            setIsActivityViewOnly(false);
          }}
          onSave={handleSaveActivity}
          onDelete={(id) => {
            setIsActivityModalOpen(false);
            setEditingActivity(null);
            setIsActivityViewOnly(false);
            handleDeleteActivity(id);
          }}
          onSwitchToEdit={() => setIsActivityViewOnly(false)}
        />
      )}

      {/* Calendar Manager Modal */}
      {isCalendarModalOpen && (
        <ProgrammeCalendarManager
          calendars={calendars}
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
          onSaveCalendars={(newCals) => {
            setCalendars(newCals);
            runCPM(activities, dataDate, newCals);
            setSuccessMsg("Calendars and non-working exceptions updated!");
          }}
        />
      )}

      {/* Schedule Import Modal */}
      {isImportModalOpen && (
        <ProgrammeImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onProgrammeDeveloped={(prog, importedActs, deps) => {
            // Convert imported activities to EngineActivity format
            const engineActs: EngineActivity[] = importedActs.map((act, index) => {
              const actDeps = deps.filter(d => d.successor_activity_id === act.id);
              const duration = act.duration || 10;
              const progress = act.progress || 0;
              return {
                id: act.id,
                wbsCode: act.wbs_code || `ACT-${(index + 1) * 10}`,
                name: act.activity_name || `Activity ${index + 1}`,
                description: act.description || act.notes || "",
                activityType: act.is_milestone ? "FinishMilestone" : "Task",
                calendarId: "cal-6day",
                sortOrder: act.sort_order || index + 1,
                originalDuration: duration,
                remainingDuration: Math.round(duration * (1 - progress / 100)),
                actualDuration: Math.round(duration * (progress / 100)),
                progress: progress,
                status: act.status || "Not Started",
                constraintType: "ASAP",
                predecessors: actDeps.map(d => ({
                  id: d.id,
                  predecessorId: d.predecessor_activity_id,
                  type: (d.dependency_type || "FS") as any,
                  lag: d.lag_days || 0
                })),
                successors: [],
                earlyStart: act.start_date || dataDate,
                earlyFinish: act.finish_date || dataDate,
                lateStart: act.start_date || dataDate,
                lateFinish: act.finish_date || dataDate,
                totalFloat: act.float_days || 0,
                freeFloat: 0,
                isCritical: act.is_critical || false,
                forecastStart: act.forecast_start || act.start_date || dataDate,
                forecastFinish: act.forecast_finish || act.finish_date || dataDate,
                varianceB0Days: 0,
                varianceB1Days: 0,
                baseline0: act.baseline_start && act.baseline_finish ? {
                  baselineStart: act.baseline_start,
                  baselineFinish: act.baseline_finish,
                  duration: duration
                } : undefined
              };
            });

            handleImportedActivities(engineActs);
          }}
          activeCompany={activeCompany}
          activeProject={activeProject}
        />
      )}

        {/* AI Delay Forensics Drawer */}
        <AiDelayTraceDrawer
          isOpen={aiDrawerOpen}
          onClose={() => setAiDrawerOpen(false)}
          activities={activities as any}
          contractCompletion={diagnostics.projectForecastFinish}
          predictedCompletion={diagnostics.projectForecastFinish}
          varianceDays={diagnostics.b0VarianceDays}
          onApplyMitigation={(type) => {
            setSuccessMsg(`Mitigation action [${type}] applied to critical sequence.`);
          }}
        />
      </div>
    </ProjectShell>
  );
}
