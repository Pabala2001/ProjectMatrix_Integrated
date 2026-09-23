import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { CheckSquare, Plus, ClipboardCheck, BookOpen, AlertCircle, Check, Terminal, RefreshCw, Zap } from "lucide-react";
import { QualityControlRecord, QualityControlTemplate } from "../../types/qualityControl";
import { QualityControlStorage } from "../../utils/qualityControlStorage";
import QualityControlRegister from "./QualityControlRegister";
import QualityControlTemplateLibrary from "./QualityControlTemplateLibrary";
import QualityControlForm from "./QualityControlForm";
import QualityControlView from "./QualityControlView";
import { QUALITY_CONTROL_TEMPLATES } from "../../data/qualityControlTemplates";
import { useOutletContext } from "react-router-dom";
import { validateTenantContext } from "../../utils/tenantGuard";
import { QUALITY_CONTROL_SQL_SNIPPET } from "./sqlSnippet";
import { isApiKeyError } from "../../lib/supabase";
import ProjectShell from "../../components/layout/ProjectShell";
import InspectionModal from "../../components/hseq/InspectionModal";

type ViewState = "register" | "templates" | "form" | "view";

interface QualityPageProps {
  embedded?: boolean;
}

export default function QualityPage({ embedded = false }: QualityPageProps) {
  const context = useOutletContext<any>() || {};
  const profile = context.profile;
  const activeCompany = context.activeCompany;
  const activeProject = context.activeProject;

  const [activeView, setActiveView] = useState<ViewState>("register");
  const [records, setRecords] = useState<QualityControlRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<QualityControlTemplate | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<QualityControlRecord | null>(null);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);

  // Load records from Supabase
  const loadRecords = async () => {
    if (!activeCompany?.id || !activeProject?.id || activeProject.company_id !== activeCompany.id) {
      setRecords([]);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setTableMissing(false);
    try {
      const loaded = await QualityControlStorage.getRecords(activeProject.id);
      setRecords(loaded);
    } catch (err: any) {
      if (!isApiKeyError(err)) {
        console.error("Error loading Quality Control records:", err);
      }
      if (err.code === "42P01" || err.code === "PGRST116" || err.message?.toLowerCase().includes("does not exist") || err.message?.toLowerCase().includes("not found")) {
        setTableMissing(true);
      } else if (!isApiKeyError(err)) {
        setErrorMsg("Failed to load records from Supabase: " + (err.message || err.details || JSON.stringify(err)));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [activeProject?.id, activeCompany?.id]);

  const refreshRecords = () => {
    loadRecords();
  };

  // Create Form trigger (from template selection)
  const handleSelectTemplate = (template: QualityControlTemplate) => {
    setSelectedTemplate(template);
    setSelectedRecord(null); // No edit, this is brand new
    setActiveView("form");
  };

  // Edit Form trigger
  const handleEditRecord = (record: QualityControlRecord) => {
    setSelectedRecord(record);
    setActiveView("form");
  };

  // View Record trigger
  const handleViewRecord = (record: QualityControlRecord) => {
    setSelectedRecord(record);
    setActiveView("view");
  };

  // Save handler (both create & edit)
  const handleSaveRecord = async (record: QualityControlRecord) => {
    assertOperationalAction("write", "pages/Quality/QualityPage.tsx");
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      validateTenantContext(activeCompany, activeProject, profile);
    } catch (err: any) {
      setErrorMsg(err.message);
      return;
    }

    setIsActionLoading(true);
    try {
      await QualityControlStorage.saveRecord(record, activeProject?.id, profile?.id);
      setSuccessMsg("Quality control form saved successfully!");
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMsg(null), 5000);

      await loadRecords();
      setActiveView("register");
      setSelectedRecord(null);
      setSelectedTemplate(null);
    } catch (err: any) {
      console.error("Error saving quality control record:", err);
      setErrorMsg("Failed to save record: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Delete handler
  const handleDeleteRecord = async (id: string) => {
    assertOperationalAction("delete", "pages/Quality/QualityPage.tsx");
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await QualityControlStorage.deleteRecord(id);
      
      // Immediately remove the record from the frontend state
      setRecords((prev) => prev.filter((r) => r.id !== id));
      
      setSuccessMsg("Quality control record deleted successfully.");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Error deleting quality control record:", err);
      setErrorMsg("Failed to delete record: " + err.message);
    }
  };

  const sqlString = QUALITY_CONTROL_SQL_SNIPPET;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlString);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  const content = (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. MASTER MODULE HEADER */}
      {activeView !== "form" && activeView !== "view" && (
        <div className="bg-white p-6 border border-[#E2E8F0] rounded-2xl shadow-[0px_8px_24px_rgba(7,24,46,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-[#07182E] tracking-tight flex items-center gap-2">
              <CheckSquare className="w-6 h-6 text-[#FF9F1C]" />
              Quality Control
            </h1>
            <p className="text-xs text-[#64748B] font-medium">
              Inspection forms, testing records and construction quality checklists.
            </p>
          </div>

          {/* Create Button & View Switcher tabs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl">
              <button
                onClick={() => {
                  setActiveView("register");
                  setErrorMsg(null);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === "register"
                    ? "bg-white text-[#07182E] shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                Forms Register
              </button>
              <button
                onClick={() => {
                  setActiveView("templates");
                  setErrorMsg(null);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === "templates"
                    ? "bg-white text-[#07182E] shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Template Library
              </button>
            </div>

            <button
              onClick={() => setIsInspectionModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all hover:-translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Quick Log Inspection (Modal)
            </button>

            <button
              onClick={() => setActiveView("templates")}
              className="px-4 py-2.5 bg-[#07182E] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md shadow-slate-900/20 transition-all hover:-translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              Template Library
            </button>
          </div>
        </div>
      )}

      {/* FEEDBACK BANNER MESSAGES */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 text-rose-800 max-w-7xl mx-auto">
          <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
          <div className="text-xs font-semibold leading-relaxed flex-1">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3 text-emerald-800 animate-fade-in max-w-7xl mx-auto">
          <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <div className="text-xs font-semibold leading-relaxed flex-1">{successMsg}</div>
        </div>
      )}

      {/* MISSING TABLE SQL ALERTS */}
      {tableMissing && (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#07182E]">Database Table Required</h3>
              <p className="text-xs text-slate-500">The quality_control_records database table is not configured in Supabase yet.</p>
            </div>
          </div>
          
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Please run the SQL script below in the SQL Editor of your Supabase console to create the table and establish policies.
          </p>

          <div className="bg-[#07182E] rounded-2xl p-4 font-mono text-[10px] text-slate-300 max-h-64 overflow-y-auto border border-slate-800 shadow-inner relative group">
            <button
              onClick={handleCopySql}
              className="absolute right-4 top-4 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              {sqlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Terminal className="w-3.5 h-3.5" />}
              <span>{sqlCopied ? "Copied" : "Copy SQL"}</span>
            </button>
            <pre className="whitespace-pre-wrap">{sqlString}</pre>
          </div>
        </div>
      )}

      {/* LOADING SPINNER */}
      {isLoading && (
        <div className="py-24 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#FF9F1C] animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-400">Loading quality control register from Supabase...</p>
        </div>
      )}

      {/* 2. DYNAMIC ROUTING INNER VIEWS */}
      {!isLoading && !tableMissing && activeView === "register" && (
        <QualityControlRegister
          records={records}
          onViewRecord={handleViewRecord}
          onEditRecord={handleEditRecord}
          onDeleteRecord={handleDeleteRecord}
          onCreateNewClick={() => setActiveView("templates")}
        />
      )}

      {!isLoading && !tableMissing && activeView === "templates" && (
        <QualityControlTemplateLibrary onSelectTemplate={handleSelectTemplate} />
      )}

      {!isLoading && !tableMissing && activeView === "form" && (
        <div className="relative">
          {isActionLoading && (
            <div className="absolute inset-0 bg-slate-50/70 z-50 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#FF9F1C] animate-spin" />
              <p className="text-xs font-bold text-[#07182E]">Saving Quality Control record to Supabase...</p>
            </div>
          )}
          <QualityControlForm
            template={
              selectedTemplate ||
              // Fallback for Edit Mode
              requireTemplateForRecord(selectedRecord!)
            }
            recordToEdit={selectedRecord || undefined}
            onSave={handleSaveRecord}
            onCancel={() => {
              setActiveView("register");
              setSelectedRecord(null);
              setSelectedTemplate(null);
            }}
          />
        </div>
      )}

      {!isLoading && !tableMissing && activeView === "view" && selectedRecord && (
        <QualityControlView
          record={selectedRecord}
          onEdit={() => handleEditRecord(selectedRecord)}
          onClose={() => {
            setActiveView("register");
            setSelectedRecord(null);
          }}
        />
      )}

      {/* Individual Inspection Modal Form */}
      <InspectionModal
        isOpen={isInspectionModalOpen}
        mode="create"
        projectId={activeProject?.id || ""}
        companyId={activeCompany?.id || ""}
        projectName={activeProject?.name || ""}
        onSave={handleSaveRecord}
        onClose={() => setIsInspectionModalOpen(false)}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <ProjectShell project={activeProject} section="hseq">
      {content}
    </ProjectShell>
  );
}

// Helper to resolve template for a record being edited
function requireTemplateForRecord(record: QualityControlRecord): QualityControlTemplate {
  const tpl = QUALITY_CONTROL_TEMPLATES.find((t: any) => t.id === record.templateId);
  if (!tpl) {
    throw new Error(`Template not found for id ${record.templateId}`);
  }
  return tpl;
}
