import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import ProjectShell from "../../components/layout/ProjectShell";
import {
  Layers,
  FileText,
  FileCheck,
  ShieldCheck,
  GitPullRequest,
  Compass,
  Sliders,
  ChevronDown,
  Building,
  Filter,
  Search,
  LayoutDashboard,
  HardHat
} from "lucide-react";
import {
  MASTER_ENGINEERING_DISCIPLINES,
  INITIAL_PROJECT_DISCIPLINE_CONFIGS,
  SAMPLE_ENGINEERING_RFIS,
  SAMPLE_TECHNICAL_SUBMITTALS,
  SAMPLE_DESIGN_ASSUMPTIONS,
  SAMPLE_ENGINEERING_DEVIATIONS,
  SAMPLE_DESIGN_REVIEWS,
  SAMPLE_TEMPORARY_WORKS,
  SAMPLE_CHANGE_NOTICES,
  SAMPLE_CONTROL_POINTS,
  SAMPLE_SETTING_OUT_RECORDS,
  SAMPLE_EARTHWORK_VOLUMES,
  SAMPLE_EQUIPMENT_CALIBRATIONS
} from "../../data/engineeringData";
import {
  EngineeringDisciplineId,
  ProjectDisciplineConfig,
  EngineeringRFI,
  TechnicalSubmittal,
  DesignAssumption,
  EngineeringDeviation,
  DesignReviewPackage,
  TemporaryWorksItem,
  DesignChangeNotice
} from "../../types/engineering";

import DisciplinesConfigModal from "../../components/engineering/DisciplinesConfigModal";
import EngineeringOverview from "../../components/engineering/EngineeringOverview";
import QueriesRfisView from "../../components/engineering/views/QueriesRfisView";
import SubmittalsView from "../../components/engineering/views/SubmittalsView";
import DesignView from "../../components/engineering/views/DesignView";
import ChangesView from "../../components/engineering/views/ChangesView";
import SurveyView from "../../components/engineering/views/SurveyView";
import RecordDetailsDrawer, { UnifiedRecord } from "../../components/engineering/RecordDetailsDrawer";
import { EditRecordModal, DeleteConfirmModal } from "../../components/engineering/EngineeringActionModals";
import { EngineeringRfiService } from "../../services/engineeringRfiService";

export type EngineeringNavTab =
  | "overview"
  | "queries"
  | "submittals"
  | "design"
  | "changes"
  | "survey";

function getProjectConfig(proj: any): ProjectDisciplineConfig {
  const baseConfig = INITIAL_PROJECT_DISCIPLINE_CONFIGS["proj-02"] || INITIAL_PROJECT_DISCIPLINE_CONFIGS["proj-01"];

  if (!proj) {
    return baseConfig;
  }

  try {
    const saved = previewStorage.getItem(`pm_engineering_disciplines_${proj.id}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.activeDisciplineIds) && parsed.activeDisciplineIds.length > 0) {
        return {
          ...baseConfig,
          ...parsed,
          projectId: proj.id,
          projectName: proj.name || parsed.projectName || baseConfig.projectName,
          projectType: proj.contract_agreement_option || proj.contract_type || parsed.projectType || baseConfig.projectType,
          leadEngineers: {
            ...baseConfig.leadEngineers,
            ...(parsed.leadEngineers || {})
          }
        };
      }
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  if (INITIAL_PROJECT_DISCIPLINE_CONFIGS[proj.id]) {
    return {
      ...INITIAL_PROJECT_DISCIPLINE_CONFIGS[proj.id],
      projectName: proj.name || INITIAL_PROJECT_DISCIPLINE_CONFIGS[proj.id].projectName,
      projectType: proj.contract_agreement_option || proj.contract_type || INITIAL_PROJECT_DISCIPLINE_CONFIGS[proj.id].projectType
    };
  }

  const matchedPredefined = Object.values(INITIAL_PROJECT_DISCIPLINE_CONFIGS).find(
    (c) => c.projectName.toLowerCase() === (proj.name || "").toLowerCase()
  );
  if (matchedPredefined) {
    return {
      ...matchedPredefined,
      projectId: proj.id,
      projectName: proj.name,
      projectType: proj.contract_agreement_option || proj.contract_type || matchedPredefined.projectType
    };
  }

  return {
    ...baseConfig,
    projectId: proj.id,
    projectName: proj.name || "Engineering Project",
    projectType: proj.contract_agreement_option || proj.contract_type || "Engineering & Construction",
    activeDisciplineIds: baseConfig.activeDisciplineIds,
    leadEngineers: { ...baseConfig.leadEngineers }
  };
}

export default function EngineeringPage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const activeCompany = context.activeCompany;
  const currentUser = context.profile;
  const allProjects = context.allProjects || [];
  const onProjectChange = context.onProjectChange;

  // Current active project discipline configuration
  const [projectConfig, setProjectConfig] = useState<ProjectDisciplineConfig>(() =>
    getProjectConfig(activeProject)
  );
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Synchronize with active project whenever changed
  useEffect(() => {
    if (activeProject) {
      setProjectConfig(getProjectConfig(activeProject));
      setSelectedDiscipline("all");
    }
  }, [activeProject?.id, activeProject?.name]);

  const [searchParams, setSearchParams] = useSearchParams();

  // ONE navigation row only: Overview | Queries & RFIs | Submittals | Design | Changes | Survey
  const [activeTab, setActiveTab] = useState<EngineeringNavTab>(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam === "queries" || tabParam === "rfis" || tabParam === "technical_control") return "queries";
    if (tabParam === "submittals") return "submittals";
    if (tabParam === "design" || tabParam === "assurance") return "design";
    if (tabParam === "changes" || tabParam === "change_control") return "changes";
    if (tabParam === "survey" || tabParam === "survey_geospatial") return "survey";
    return "overview";
  });

  // Sync tab with URL query param if present
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "overview") setActiveTab("overview");
    else if (tabParam === "queries" || tabParam === "rfis" || tabParam === "technical_control") setActiveTab("queries");
    else if (tabParam === "submittals") setActiveTab("submittals");
    else if (tabParam === "design" || tabParam === "assurance") setActiveTab("design");
    else if (tabParam === "changes" || tabParam === "change_control") setActiveTab("changes");
    else if (tabParam === "survey" || tabParam === "survey_geospatial") setActiveTab("survey");
  }, [searchParams]);

  // One discipline filter: [All Disciplines ▾]
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");

  // Record Details Drawer State
  const [drawerRecord, setDrawerRecord] = useState<UnifiedRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Dynamic Engineering Records
  const [rfis, setRfis] = useState<EngineeringRFI[]>(SAMPLE_ENGINEERING_RFIS);
  const [submittals, setSubmittals] = useState<TechnicalSubmittal[]>(SAMPLE_TECHNICAL_SUBMITTALS);
  const [assumptions, setAssumptions] = useState<DesignAssumption[]>(SAMPLE_DESIGN_ASSUMPTIONS);
  const [deviations, setDeviations] = useState<EngineeringDeviation[]>(SAMPLE_ENGINEERING_DEVIATIONS);
  const [designReviews, setDesignReviews] = useState<DesignReviewPackage[]>(SAMPLE_DESIGN_REVIEWS);
  const [temporaryWorks, setTemporaryWorks] = useState<TemporaryWorksItem[]>(SAMPLE_TEMPORARY_WORKS);
  const [changeNotices, setChangeNotices] = useState<DesignChangeNotice[]>(SAMPLE_CHANGE_NOTICES);
  const [controlPoints, setControlPoints] = useState<any[]>(SAMPLE_CONTROL_POINTS);
  const [settingOutRecords, setSettingOutRecords] = useState<any[]>(SAMPLE_SETTING_OUT_RECORDS);
  const [earthworkSurveys, setEarthworkSurveys] = useState<any[]>(SAMPLE_EARTHWORK_VOLUMES);
  const [equipmentCalibrations, setEquipmentCalibrations] = useState<any[]>(SAMPLE_EQUIPMENT_CALIBRATIONS);

  // Edit and Delete Modals State
  const [editingRecord, setEditingRecord] = useState<UnifiedRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<UnifiedRecord | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Load RFIs from real backend storage
  useEffect(() => {
    let isMounted = true;
    const fetchStoredRFIs = async () => {
      try {
        const stored = await EngineeringRfiService.getRFIs(
          activeProject?.id,
          activeCompany?.id
        );
        if (isMounted && stored && stored.length > 0) {
          setRfis(stored);
        }
      } catch (err: any) {
        console.error("Failed to load RFIs from backend storage:", err);
      }
    };

    fetchStoredRFIs();

    return () => {
      isMounted = false;
    };
  }, [activeProject?.id, activeCompany?.id]);

  // List of active disciplines for current project
  const projectActiveDisciplines = useMemo(() => {
    return MASTER_ENGINEERING_DISCIPLINES.filter((d) =>
      projectConfig.activeDisciplineIds.includes(d.id)
    );
  }, [projectConfig.activeDisciplineIds]);

  const handleTabChange = (tab: EngineeringNavTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleOpenRecord = (rec: UnifiedRecord) => {
    setDrawerRecord(rec);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleOpenEdit = (rec: UnifiedRecord) => {
    setEditingRecord(rec);
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (rec: UnifiedRecord) => {
    setDeletingRecord(rec);
    setIsDeleteModalOpen(true);
  };

  const handleSaveEditedRecord = async (updatedRecord: UnifiedRecord) => {
    assertOperationalAction("write", "pages/Engineering/EngineeringPage.tsx");
    const updatedData = updatedRecord.data;
    if (updatedRecord.type === "RFI") {
      try {
        const saved = await EngineeringRfiService.updateRFI(updatedData, activeProject?.id);
        setRfis((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      } catch (err) {
        setRfis((prev) => prev.map((r) => (r.id === updatedData.id ? updatedData : r)));
      }
    } else if (updatedRecord.type === "SUBMITTAL") {
      setSubmittals((prev) => prev.map((s) => (s.id === updatedData.id ? { ...s, ...updatedData } : s)));
    } else if (updatedRecord.type === "CHANGE") {
      setChangeNotices((prev) => prev.map((c) => (c.id === updatedData.id ? { ...c, ...updatedData } : c)));
    } else if (updatedRecord.type === "ASSUMPTION") {
      setAssumptions((prev) => prev.map((a) => (a.id === updatedData.id ? { ...a, ...updatedData } : a)));
    } else if (updatedRecord.type === "DEVIATION") {
      setDeviations((prev) => prev.map((d) => (d.id === updatedData.id ? { ...d, ...updatedData } : d)));
    } else if (updatedRecord.type === "REVIEW") {
      setDesignReviews((prev) => prev.map((rv) => (rv.id === updatedData.id ? { ...rv, ...updatedData } : rv)));
    } else if (updatedRecord.type === "SETTING_OUT") {
      setSettingOutRecords((prev) => prev.map((so) => (so.id === updatedData.id ? { ...so, ...updatedData } : so)));
    } else if (updatedRecord.type === "CONTROL_POINT") {
      setControlPoints((prev) => prev.map((cp) => (cp.id === updatedData.id ? { ...cp, ...updatedData } : cp)));
    }

    if (drawerRecord && (drawerRecord.data?.id === updatedData.id || drawerRecord.data?.rfiNumber === updatedData.rfiNumber)) {
      setDrawerRecord({ ...updatedRecord });
    }
  };

  const handleConfirmDelete = async (rec: UnifiedRecord) => {
    const targetId = rec.data?.id;
    if (rec.type === "RFI") {
      try {
        await EngineeringRfiService.deleteRFI(targetId, activeProject?.id);
      } catch (e) {}
      setRfis((prev) => prev.filter((r) => r.id !== targetId));
    } else if (rec.type === "SUBMITTAL") {
      setSubmittals((prev) => prev.filter((s) => s.id !== targetId));
    } else if (rec.type === "CHANGE") {
      setChangeNotices((prev) => prev.filter((c) => c.id !== targetId));
    } else if (rec.type === "ASSUMPTION") {
      setAssumptions((prev) => prev.filter((a) => a.id !== targetId));
    } else if (rec.type === "DEVIATION") {
      setDeviations((prev) => prev.filter((d) => d.id !== targetId));
    } else if (rec.type === "REVIEW") {
      setDesignReviews((prev) => prev.filter((rv) => rv.id !== targetId));
    } else if (rec.type === "SETTING_OUT") {
      setSettingOutRecords((prev) => prev.filter((so) => so.id !== targetId));
    } else if (rec.type === "CONTROL_POINT") {
      setControlPoints((prev) => prev.filter((cp) => cp.id !== targetId));
    }

    if (drawerRecord?.data?.id === targetId) {
      setIsDrawerOpen(false);
      setDrawerRecord(null);
    }
  };

  const handleUpdateDrawerRecord = async (updatedRecord: UnifiedRecord) => {
    assertOperationalAction("edit", "pages/Engineering/EngineeringPage.tsx");
    handleSaveEditedRecord(updatedRecord);
  };

  const handleAddRFI = async (newRFI: EngineeringRFI): Promise<EngineeringRFI> => {
    assertOperationalAction("create", "pages/Engineering/EngineeringPage.tsx");
    try {
      const saved = await EngineeringRfiService.createRFI(
        newRFI,
        activeProject?.id,
        activeCompany?.id
      );
      setRfis((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
      return saved;
    } catch (err: any) {
      setRfis((prev) => [newRFI, ...prev]);
      return newRFI;
    }
  };

  const handleAddSubmittal = (newSub: TechnicalSubmittal) => {
    assertOperationalAction("create", "pages/Engineering/EngineeringPage.tsx");
    setSubmittals((prev) => [newSub, ...prev]);
  };

  const handleAddChangeNotice = (newDC: DesignChangeNotice) => {
    assertOperationalAction("create", "pages/Engineering/EngineeringPage.tsx");
    setChangeNotices((prev) => [newDC, ...prev]);
  };

  const handleProjectSwitch = (pId: string) => {
    const selected = allProjects.find((p: any) => p.id === pId);
    if (selected && onProjectChange) {
      onProjectChange(selected);
    } else if (INITIAL_PROJECT_DISCIPLINE_CONFIGS[pId]) {
      setProjectConfig(INITIAL_PROJECT_DISCIPLINE_CONFIGS[pId]);
      setSelectedDiscipline("all");
    }
  };

  const handleSaveProjectConfig = (updatedConfig: ProjectDisciplineConfig) => {
    assertOperationalAction("write", "pages/Engineering/EngineeringPage.tsx");
    setProjectConfig(updatedConfig);
    if (activeProject?.id) {
      try {
        previewStorage.setItem(`pm_engineering_disciplines_${activeProject.id}`, JSON.stringify(updatedConfig));
      } catch (e) {}
    }
  };

  return (
    <ProjectShell project={activeProject} section="engineering">
      <div className="max-w-7xl mx-auto space-y-4 pb-12">
        {/* TOP BAR: Clean Project & Governance Context */}
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Engineering Workspace
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {projectActiveDisciplines.length} Disciplines
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Technical queries, submittals, design governance, and geospatial records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Project Switcher */}
            <select
              id="engineering-project-select"
              value={activeProject?.id || ""}
              onChange={(e) => handleProjectSwitch(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[220px] truncate"
            >
              {allProjects && allProjects.length > 0 ? (
                allProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.code ? `[${p.code}] ` : ""}{p.name}
                  </option>
                ))
              ) : (
                <option value={activeProject?.id || "default"}>
                  {activeProject?.name || "Selected Project"}
                </option>
              )}
            </select>

            {/* Discipline Settings */}
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Configure Active Disciplines"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SINGLE NAVIGATION ROW:
            Overview | Queries & RFIs | Submittals | Design | Changes | Survey
            + ONE [All Disciplines ▾] filter on the right
        */}
        <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Main Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 md:pb-0">
            {/* Overview */}
            <button
              onClick={() => handleTabChange("overview")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "overview"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            {/* Queries & RFIs */}
            <button
              onClick={() => handleTabChange("queries")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "queries"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Queries & RFIs</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "queries"
                  ? "bg-blue-500/30 text-white"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}>
                {rfis.length}
              </span>
            </button>

            {/* Submittals */}
            <button
              onClick={() => handleTabChange("submittals")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "submittals"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Submittals</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "submittals"
                  ? "bg-blue-500/30 text-white"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}>
                {submittals.length}
              </span>
            </button>

            {/* Design */}
            <button
              onClick={() => handleTabChange("design")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "design"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Design</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "design"
                  ? "bg-blue-500/30 text-white"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}>
                {assumptions.length + designReviews.length + deviations.length}
              </span>
            </button>

            {/* Changes */}
            <button
              onClick={() => handleTabChange("changes")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "changes"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>Changes</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "changes"
                  ? "bg-blue-500/30 text-white"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}>
                {changeNotices.length}
              </span>
            </button>

            {/* Survey */}
            <button
              onClick={() => handleTabChange("survey")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "survey"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Survey</span>
            </button>
          </div>

          {/* ONE [All Disciplines ▾] filter dropdown */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden lg:inline">
              Filter:
            </span>
            <div className="relative">
              <select
                id="all-disciplines-filter"
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                className="text-xs font-bold py-1.5 pl-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none shadow-2xs"
              >
                <option value="all">All Disciplines</option>
                {projectActiveDisciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* WORKSPACE CONTENT VIEWS */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
            >
              <EngineeringOverview
                rfis={rfis}
                submittals={submittals}
                changes={changeNotices}
                assumptions={assumptions}
                deviations={deviations}
                onSelectRecord={handleOpenRecord}
                onNavigateTab={handleTabChange}
                selectedDiscipline={selectedDiscipline}
                onSelectDiscipline={setSelectedDiscipline}
                onEditRecord={handleOpenEdit}
                onDeleteRecord={handleOpenDelete}
              />
            </motion.div>
          )}

          {activeTab === "queries" && (
            <motion.div
              key="queries"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
            >
              <QueriesRfisView
                rfis={rfis}
                onSelectRecord={handleOpenRecord}
                onAddRFI={handleAddRFI}
                selectedDiscipline={selectedDiscipline}
                onEditRecord={handleOpenEdit}
                onDeleteRecord={handleOpenDelete}
              />
            </motion.div>
          )}

          {activeTab === "submittals" && (
            <motion.div
              key="submittals"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
            >
              <SubmittalsView
                submittals={submittals}
                onSelectRecord={handleOpenRecord}
                onAddSubmittal={handleAddSubmittal}
                selectedDiscipline={selectedDiscipline}
                onEditRecord={handleOpenEdit}
                onDeleteRecord={handleOpenDelete}
              />
            </motion.div>
          )}

          {activeTab === "design" && (
            <motion.div
              key="design"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
            >
              <DesignView
                assumptions={assumptions}
                reviews={designReviews}
                deviations={deviations}
                temporaryWorks={temporaryWorks}
                onSelectRecord={handleOpenRecord}
                selectedDiscipline={selectedDiscipline}
                onEditRecord={handleOpenEdit}
                onDeleteRecord={handleOpenDelete}
              />
            </motion.div>
          )}

          {activeTab === "changes" && (
            <motion.div
              key="changes"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
            >
              <ChangesView
                changes={changeNotices}
                onSelectRecord={handleOpenRecord}
                onAddChange={handleAddChangeNotice}
                selectedDiscipline={selectedDiscipline}
                onEditRecord={handleOpenEdit}
                onDeleteRecord={handleOpenDelete}
              />
            </motion.div>
          )}

          {activeTab === "survey" && (
            <motion.div
              key="survey"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
            >
              <SurveyView
                controlPoints={controlPoints}
                settingOutRecords={settingOutRecords}
                earthworkSurveys={earthworkSurveys}
                equipmentCalibrations={equipmentCalibrations}
                onSelectRecord={handleOpenRecord}
                selectedDiscipline={selectedDiscipline}
                onEditRecord={handleOpenEdit}
                onDeleteRecord={handleOpenDelete}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 7-Tab Right-Side Record Details Drawer */}
        <RecordDetailsDrawer
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          record={drawerRecord}
          onUpdateRecord={handleUpdateDrawerRecord}
          onEditRecord={handleOpenEdit}
          onDeleteRecord={handleOpenDelete}
        />

        {/* Edit Record Modal */}
        <EditRecordModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingRecord(null);
          }}
          record={editingRecord}
          onSave={handleSaveEditedRecord}
        />

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeletingRecord(null);
          }}
          record={deletingRecord}
          onConfirm={handleConfirmDelete}
        />

        {/* Discipline Configuration Modal */}
        <DisciplinesConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          config={projectConfig}
          onSaveConfig={handleSaveProjectConfig}
          projectName={projectConfig.projectName || "Project"}
        />
      </div>
    </ProjectShell>
  );
}
