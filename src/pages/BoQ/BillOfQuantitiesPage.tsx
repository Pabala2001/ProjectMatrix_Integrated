import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { 
  Coins, 
  Layers, 
  Building2, 
  MapPin, 
  TrendingDown, 
  AlertTriangle,
  ArrowRight,
  Calculator,
  FileSpreadsheet,
  Receipt,
  Scale,
  Sparkles
} from "lucide-react";
import { BillOfQuantitiesTab } from "../../components/programme/BillOfQuantitiesTab";
import { CommercialControlsMatrix } from "../../components/commercial/CommercialControlsMatrix";
import ProjectShell from "../../components/layout/ProjectShell";

export default function BillOfQuantitiesPage() {
  const { activeCompany, activeProject } = useOutletContext<any>() || {};
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"commercial_matrix" | "rate_buildup">("commercial_matrix");

  return (
    <ProjectShell project={activeProject} section="commercial">
      <div id="boq-page-root" className="space-y-6 max-w-7xl mx-auto">
        {/* HEADER BANNER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF9F1C] animate-pulse shrink-0" />
              <h1 className="text-xl font-extrabold text-[#07182E] tracking-tight">
                Commercial Control & Bill of Quantities (BoQ)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FF9F1C]/10 text-amber-900 border border-[#FF9F1C]/30 flex items-center gap-1">
                <Receipt className="w-3 h-3 text-[#FF9F1C]" />
                Accounting Subsystem
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
                🔴 Live Loss Detection
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-medium max-w-2xl leading-relaxed">
              Double-entry transaction ledger tracking Budgets, Commitments, Actual Invoices, Accruals, IPC Revenue, and Cash Receipts with dynamic Estimate at Completion (EAC) & margin erosion diagnostics.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setViewMode("commercial_matrix")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "commercial_matrix"
                    ? "bg-white text-slate-950 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Scale className="w-3.5 h-3.5 text-amber-600" />
                Commercial Controls Matrix
              </button>
              <button
                onClick={() => setViewMode("rate_buildup")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "rate_buildup"
                    ? "bg-white text-slate-950 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calculator className="w-3.5 h-3.5 text-slate-500" />
                Rate Build-Up Studio
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT / IF NO PROJECT SELECTED */}
        {!activeProject?.id ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <Coins className="w-12 h-12 text-[#FF9F1C] mx-auto animate-bounce" />
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-[#07182E]">No Active Project Selected</h3>
              <p className="text-xs text-[#64748B]">Please select a project in the workspace header to view and manage its Commercial Control & Bill of Quantities ledger.</p>
            </div>
          </div>
        ) : viewMode === "commercial_matrix" ? (
          <CommercialControlsMatrix
            projectId={activeProject?.id}
            projectName={activeProject?.name}
            onNavigateToActivity={(activityId) => {
              navigate(`/programme?activity=${activityId}`);
            }}
          />
        ) : (
          <BillOfQuantitiesTab
            projectId={activeProject?.id}
            projectName={activeProject?.name}
            onNavigateToActivity={(activityId) => {
              navigate(`/programme?activity=${activityId}`);
            }}
          />
        )}
      </div>
    </ProjectShell>
  );
}

