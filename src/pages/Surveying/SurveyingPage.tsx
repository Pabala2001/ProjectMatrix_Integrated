import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Compass, Wrench, Layers, AlertTriangle, CheckCircle2, Building2, MapPin, 
  Archive, RotateCcw, Loader2 
} from "lucide-react";
import { ControlPoint, Instrument, Campaign } from "../../types/surveying";
import { 
  getControlPoints, 
  getInstruments, 
  getCampaigns, 
  saveControlPoint, 
  archiveControlPoint, 
  restoreControlPoint, 
  deleteControlPoint, 
  saveInstrument, 
  archiveInstrument, 
  restoreInstrument, 
  deleteInstrument, 
  saveCampaign, 
  archiveCampaign, 
  restoreCampaign, 
  deleteCampaign 
} from "../../services/surveyingService";
import ControlPointsTab from "./ControlPointsTab";
import InstrumentsTab from "./InstrumentsTab";
import CampaignsTab from "./CampaignsTab";
import ControlPointModal from "./ControlPointModal";
import InstrumentModal from "./InstrumentModal";
import CampaignModal from "./CampaignModal";
import { isApiKeyError } from "../../lib/supabase";
import ViewDetailsModal from "./ViewDetailsModal";
import ProjectShell from "../../components/layout/ProjectShell";

type ActiveTab = "control-points" | "instruments" | "campaigns";

export default function SurveyingPage() {
  const { activeCompany, activeProject } = useOutletContext<any>() || {};

  const [activeTab, setActiveTab] = useState<ActiveTab>("control-points");
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // State collections fetched from Supabase
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modal states
  const [isPointModalOpen, setIsPointModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<ControlPoint | null>(null);

  const [isInstrumentModalOpen, setIsInstrumentModalOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);

  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const [viewingItem, setViewingItem] = useState<{
    type: "point" | "instrument" | "campaign";
    data: any;
  } | null>(null);

  // Notification banners
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter state for current active company & project
  const currentProjectId = activeProject?.id;
  const currentCompanyId = activeCompany?.id;

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Requirement 2: Do not query until both values exist. Clear Surveying state when active company or project changes.
  useEffect(() => {
    if (!currentCompanyId || !currentProjectId) {
      setControlPoints([]);
      setInstruments([]);
      setCampaigns([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);

    async function loadSurveyingData() {
      try {
        const [cpData, instData, cmpData] = await Promise.all([
          getControlPoints(currentCompanyId, currentProjectId, showArchived),
          getInstruments(currentCompanyId, currentProjectId, showArchived),
          getCampaigns(currentCompanyId, currentProjectId, showArchived)
        ]);

        if (isMounted) {
          setControlPoints(cpData);
          setInstruments(instData);
          setCampaigns(cmpData);
        }
      } catch (err: any) {
        if (isMounted) {
          if (!isApiKeyError(err)) {
            console.error("Error fetching surveying data:", err);
            setErrorMsg(err.message || "Failed to fetch surveying data from Supabase.");
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSurveyingData();

    return () => {
      isMounted = false;
    };
  }, [currentCompanyId, currentProjectId, showArchived]);

  // Handlers for Control Points
  const handleSavePoint = async (point: ControlPoint) => {
    assertOperationalAction("write", "pages/Surveying/SurveyingPage.tsx");
    try {
      setErrorMsg(null);
      const saved = await saveControlPoint(point);
      setControlPoints(prev => {
        const idx = prev.findIndex(p => p.id === saved.id || p.id === point.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      showSuccess(`Control Point "${saved.pointId}" saved successfully.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save control point.");
    }
  };

  const handleArchivePoint = async (id: string) => {
    try {
      setErrorMsg(null);
      await archiveControlPoint(id);
      setControlPoints(prev => prev.filter(p => p.id !== id));
      showSuccess("Control point archived.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to archive control point.");
    }
  };

  const handleRestorePoint = async (id: string) => {
    try {
      setErrorMsg(null);
      await restoreControlPoint(id);
      setControlPoints(prev => prev.filter(p => p.id !== id));
      showSuccess("Control point restored to active register.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore control point.");
    }
  };

  const handleDeletePoint = async (id: string) => {
    assertOperationalAction("delete", "pages/Surveying/SurveyingPage.tsx");
    try {
      setErrorMsg(null);
      await deleteControlPoint(id);
      setControlPoints(prev => prev.filter(p => p.id !== id));
      showSuccess("Control point record removed.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete control point.");
    }
  };

  // Handlers for Instruments
  const handleSaveInstrument = async (inst: Instrument) => {
    assertOperationalAction("write", "pages/Surveying/SurveyingPage.tsx");
    try {
      setErrorMsg(null);
      const saved = await saveInstrument(inst);
      setInstruments(prev => {
        const idx = prev.findIndex(i => i.id === saved.id || i.id === inst.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      showSuccess(`Instrument "${saved.instrumentId}" saved successfully.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save survey instrument.");
    }
  };

  const handleArchiveInstrument = async (id: string) => {
    try {
      setErrorMsg(null);
      await archiveInstrument(id);
      setInstruments(prev => prev.filter(i => i.id !== id));
      showSuccess("Instrument archived.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to archive instrument.");
    }
  };

  const handleRestoreInstrument = async (id: string) => {
    try {
      setErrorMsg(null);
      await restoreInstrument(id);
      setInstruments(prev => prev.filter(i => i.id !== id));
      showSuccess("Instrument restored to active register.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore instrument.");
    }
  };

  const handleDeleteInstrument = async (id: string) => {
    assertOperationalAction("delete", "pages/Surveying/SurveyingPage.tsx");
    try {
      setErrorMsg(null);
      await deleteInstrument(id);
      setInstruments(prev => prev.filter(i => i.id !== id));
      showSuccess("Instrument record removed.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete instrument.");
    }
  };

  // Handlers for Campaigns
  const handleSaveCampaign = async (camp: Campaign) => {
    assertOperationalAction("write", "pages/Surveying/SurveyingPage.tsx");
    try {
      setErrorMsg(null);
      const saved = await saveCampaign(camp, controlPoints);
      setCampaigns(prev => {
        const idx = prev.findIndex(c => c.id === saved.id || c.id === camp.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      showSuccess(`Survey Campaign "${saved.campaignCode}" saved successfully.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save survey campaign.");
    }
  };

  const handleArchiveCampaign = async (id: string) => {
    try {
      setErrorMsg(null);
      await archiveCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      showSuccess("Survey campaign archived.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to archive campaign.");
    }
  };

  const handleRestoreCampaign = async (id: string) => {
    try {
      setErrorMsg(null);
      await restoreCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      showSuccess("Survey campaign restored to active register.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to restore campaign.");
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    assertOperationalAction("delete", "pages/Surveying/SurveyingPage.tsx");
    try {
      setErrorMsg(null);
      await deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      showSuccess("Survey campaign removed.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete campaign.");
    }
  };

  return (
    <ProjectShell project={activeProject} section="engineering">
      <div className="space-y-6">
        {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-1">
            <span>Departments</span>
            <span>•</span>
            <span>Technical</span>
            <span>•</span>
            <span>Surveying</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Compass className="w-8 h-8 text-amber-600 dark:text-amber-500" />
            <span>Surveying & Geodetic Control</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Manage site control points, geodetic benchmarks, total station instruments, calibration compliance, and field survey campaigns.
          </p>
        </div>

        {/* Project Context Pill */}
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shrink-0 shadow-xs">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-500">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Contract</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
              <span>{activeProject?.name || "No Project Selected"}</span>
              {activeProject?.code && (
                <span className="px-1.5 py-0.2 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded text-[9px] font-mono">
                  {activeProject.code}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-800 dark:text-red-300 text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button 
            onClick={() => setErrorMsg(null)}
            className="text-[10px] font-bold uppercase underline text-red-700 dark:text-red-300 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Primary Navigation Tabs + Archive Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("control-points")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "control-points"
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-sm"
                : "bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Control Points ({controlPoints.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("instruments")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "instruments"
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-sm"
                : "bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850"
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Instruments ({instruments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("campaigns")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "campaigns"
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-sm"
                : "bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Campaigns ({campaigns.length})</span>
          </button>
        </div>

        {/* View Mode Toggle: Active vs Archived Records */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !showArchived
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Active Register
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              showArchived
                ? "bg-amber-500 text-white font-black shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archived</span>
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-amber-600 dark:text-amber-400 font-bold text-xs">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Synchronising with Supabase database...</span>
        </div>
      )}

      {/* 3. Active Tab View Content */}
      {!isLoading && (
        <div className="animate-fadeIn">
          {activeTab === "control-points" && (
            <ControlPointsTab
              controlPoints={controlPoints}
              onNew={() => {
                setEditingPoint(null);
                setIsPointModalOpen(true);
              }}
              onEdit={(point) => {
                setEditingPoint(point);
                setIsPointModalOpen(true);
              }}
              onView={(point) => {
                setViewingItem({ type: "point", data: point });
              }}
              onArchive={handleArchivePoint}
              onRestore={handleRestorePoint}
              onDelete={handleDeletePoint}
            />
          )}

          {activeTab === "instruments" && (
            <InstrumentsTab
              instruments={instruments}
              onNew={() => {
                setEditingInstrument(null);
                setIsInstrumentModalOpen(true);
              }}
              onEdit={(inst) => {
                setEditingInstrument(inst);
                setIsInstrumentModalOpen(true);
              }}
              onView={(inst) => {
                setViewingItem({ type: "instrument", data: inst });
              }}
              onArchive={handleArchiveInstrument}
              onRestore={handleRestoreInstrument}
              onDelete={handleDeleteInstrument}
            />
          )}

          {activeTab === "campaigns" && (
            <CampaignsTab
              campaigns={campaigns}
              controlPoints={controlPoints}
              onNew={() => {
                setEditingCampaign(null);
                setIsCampaignModalOpen(true);
              }}
              onEdit={(camp) => {
                setEditingCampaign(camp);
                setIsCampaignModalOpen(true);
              }}
              onView={(camp) => {
                setViewingItem({ type: "campaign", data: camp });
              }}
              onArchive={handleArchiveCampaign}
              onRestore={handleRestoreCampaign}
              onDelete={handleDeleteCampaign}
            />
          )}
        </div>
      )}

      {/* Modals */}
      <ControlPointModal
        isOpen={isPointModalOpen}
        onClose={() => {
          setIsPointModalOpen(false);
          setEditingPoint(null);
        }}
        onSave={handleSavePoint}
        initialPoint={editingPoint}
        existingPoints={controlPoints}
        projectId={currentProjectId || ""}
        companyId={currentCompanyId || ""}
      />

      <InstrumentModal
        isOpen={isInstrumentModalOpen}
        onClose={() => {
          setIsInstrumentModalOpen(false);
          setEditingInstrument(null);
        }}
        onSave={handleSaveInstrument}
        initialInstrument={editingInstrument}
        existingInstruments={instruments}
        projectId={currentProjectId || ""}
        companyId={currentCompanyId || ""}
      />

      <CampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => {
          setIsCampaignModalOpen(false);
          setEditingCampaign(null);
        }}
        onSave={handleSaveCampaign}
        initialCampaign={editingCampaign}
        existingCampaigns={campaigns}
        controlPoints={controlPoints}
        projectId={currentProjectId || ""}
        companyId={currentCompanyId || ""}
      />

        <ViewDetailsModal
          isOpen={!!viewingItem}
          onClose={() => setViewingItem(null)}
          item={viewingItem}
          allControlPoints={controlPoints}
        />
      </div>
    </ProjectShell>
  );
}
