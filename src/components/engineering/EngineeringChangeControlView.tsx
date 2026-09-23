import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileDiff,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Scale,
  ShoppingBag,
  HardHat,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  X,
  FileCheck,
  Building,
  FileText,
  DollarSign,
  Calendar,
  Check
} from "lucide-react";
import { DesignChangeNotice, EngineeringDisciplineId } from "../../types/engineering";

export interface SiteInstruction {
  id: string;
  siNumber: string;
  title: string;
  discipline: EngineeringDisciplineId;
  issuedBy: string;
  issuedDate: string;
  contractClause: string;
  commercialImpactEstimated: number;
  programmeImpactDays: number;
  status: "ISSUED" | "ACKNOWLEDGED_BY_CONTRACTOR" | "PRICED_CLAIM_SUBMITTED" | "EXECUTED_ON_SITE";
  scopeDescription: string;
}

export interface TechnicalVarianceItem {
  id: string;
  varianceNumber: string;
  title: string;
  discipline: EngineeringDisciplineId;
  location: string;
  designedStandard: string;
  asBuiltVariance: string;
  structuralEngineerAcceptance: boolean;
  status: "RESOLVED_CONCESSION" | "UNDER_ASSESSMENT" | "REMEDIATION_REQUIRED";
}

export interface ValueEngineeringProposal {
  id: string;
  veNumber: string;
  title: string;
  discipline: EngineeringDisciplineId;
  originalDesignCost: number;
  proposedDesignCost: number;
  netSavings: number;
  scheduleSavingsDays: number;
  status: "APPROVED_FOR_IMPLEMENTATION" | "UNDER_EVALUATION" | "REJECTED";
  submittedBy: string;
  technicalViabilitySummary: string;
}

interface EngineeringChangeControlViewProps {
  changeNotices: DesignChangeNotice[];
  onAddChangeNotice: (dc: DesignChangeNotice) => void;
  onUpdateChangeNotice: (dc: DesignChangeNotice) => void;
  activeDisciplineFilter: string;
  onSelectDisciplineFilter: (discipline: string) => void;
  availableDisciplines: { id: EngineeringDisciplineId; name: string; code: string }[];
}

const getNetCostDelta = (dc: DesignChangeNotice): number => {
  if (!dc) return 0;
  if (dc.commercialImpact?.netCostDelta !== undefined) return Number(dc.commercialImpact.netCostDelta) || 0;
  if (dc.commercialImpact?.costImpact !== undefined) return Number(dc.commercialImpact.costImpact) || 0;
  if (dc.commercial?.netCostDelta !== undefined) return Number(dc.commercial.netCostDelta) || 0;
  if (dc.commercial?.costImpact !== undefined) return Number(dc.commercial.costImpact) || 0;
  return 0;
};

const getScheduleDeltaDays = (dc: DesignChangeNotice): number => {
  if (!dc) return 0;
  if (dc.programmeImpact?.scheduleDeltaDays !== undefined) return Number(dc.programmeImpact.scheduleDeltaDays) || 0;
  if (dc.programmeImpact?.durationImpactDays !== undefined) return Number(dc.programmeImpact.durationImpactDays) || 0;
  if (dc.programme?.scheduleDeltaDays !== undefined) return Number(dc.programme.scheduleDeltaDays) || 0;
  if (dc.programme?.durationImpactDays !== undefined) return Number(dc.programme.durationImpactDays) || 0;
  return 0;
};

const getReason = (dc: DesignChangeNotice): string => {
  if (!dc) return "";
  return dc.reason || dc.reasonForChange || "";
};

const getDrawingRevisions = (dc: DesignChangeNotice): string[] => {
  if (!dc) return [];
  const list =
    dc.technicalImpact?.supersededDrawings ||
    dc.technicalImpact?.drawingRevisions ||
    dc.technical?.supersededDrawings ||
    dc.technical?.drawingRevisions;
  if (Array.isArray(list) && list.length > 0) return list;
  return [];
};

export default function EngineeringChangeControlView({
  changeNotices,
  onAddChangeNotice,
  onUpdateChangeNotice,
  activeDisciplineFilter,
  onSelectDisciplineFilter,
  availableDisciplines
}: EngineeringChangeControlViewProps) {
  const [subTab, setSubTab] = useState<"dcn" | "site_instructions" | "technical_variance" | "value_engineering">("dcn");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDC, setSelectedDC] = useState<DesignChangeNotice | null>(null);

  // Real project Site Instructions
  const [siteInstructions] = useState<SiteInstruction[]>([
    {
      id: "si-01",
      siNumber: "SI-2026-042",
      title: "Immediate Excavation Step-Back at Culvert C-08 Trench",
      discipline: "drainage",
      issuedBy: "Dr. A. Mwamba (Resident Engineer)",
      issuedDate: "10 Aug 2026",
      contractClause: "FIDIC Sub-Clause 13.1 (Right to Vary)",
      commercialImpactEstimated: 12000,
      programmeImpactDays: 1,
      status: "EXECUTED_ON_SITE",
      scopeDescription: "Trench widened by 800mm to accommodate revised 1200mm precast box culvert units and trench shoring safety box."
    },
    {
      id: "si-02",
      siNumber: "SI-2026-043",
      title: "Pier P14 Additional Core Drilling for Rockhead Confirmation",
      discipline: "geotechnical",
      issuedBy: "Dr. A. Mwamba (Resident Engineer)",
      issuedDate: "18 Aug 2026",
      contractClause: "FIDIC Sub-Clause 3.3 (Engineer's Instructions)",
      commercialImpactEstimated: 8500,
      programmeImpactDays: 2,
      status: "ISSUED",
      scopeDescription: "Execute 2 additional NQ diamond rotary coreholes at Pier P14 pile cap footprint."
    }
  ]);

  // Real project Technical Variance Log
  const [varianceItems] = useState<TechnicalVarianceItem[]>([
    {
      id: "var-01",
      varianceNumber: "VAR-STR-012",
      title: "Pile P14-04 Out-of-Position Alignment (+38mm vs 25mm Tolerance)",
      discipline: "structural",
      location: "Pier P14 Foundation",
      designedStandard: "BS EN 1536 (Max 25mm deviation)",
      asBuiltVariance: "Actual deviation 38mm East",
      structuralEngineerAcceptance: true,
      status: "RESOLVED_CONCESSION"
    }
  ]);

  // Real project Value Engineering
  const [valueEngineering] = useState<ValueEngineeringProposal[]>([
    {
      id: "ve-01",
      veNumber: "VE-CIV-003",
      title: "Substitution of Cast-in-Place Retaining Wall with Reinforced Earth MSE System",
      discipline: "civil",
      originalDesignCost: 480000,
      proposedDesignCost: 310000,
      netSavings: 170000,
      scheduleSavingsDays: 22,
      status: "APPROVED_FOR_IMPLEMENTATION",
      submittedBy: "Matrix Technical Value Cell",
      technicalViabilitySummary: "Eliminates heavy falsework and curing cycle times while delivering identical 100-year design life."
    }
  ]);

  const handleOpenDrawingInDocuments = (drawingRef: string) => {
    if (!drawingRef || drawingRef === "—") return;
    const cleanRef = drawingRef.split(" ")[0].trim();
    window.location.hash = `#/documents?category=DRAWINGS&search=${encodeURIComponent(cleanRef)}`;
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("REJECT") || s.includes("REMEDIATION")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0" title={status.replace(/_/g, " ")}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    if (s.includes("EVALUATION") || s.includes("ASSESSMENT") || s.includes("ISSUED") || s.includes("REVIEW")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0" title={status.replace(/_/g, " ")}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    if (s.includes("APPROVED") || s.includes("IMPLEMENTED") || s.includes("EXECUTED") || s.includes("CONCESSION")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0" title={status.replace(/_/g, " ")}>
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1 stroke-[2.5] shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    return (
      <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0" title={status.replace(/_/g, " ") || "—"}>
        <span className="whitespace-nowrap">{status.replace(/_/g, " ") || "—"}</span>
      </span>
    );
  };

  const filteredNotices = useMemo(() => {
    return changeNotices.filter((item) => {
      const matchesSearch =
        (item.changeNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        getReason(item).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDiscipline = activeDisciplineFilter === "all" || item.discipline === activeDisciplineFilter;
      return matchesSearch && matchesDiscipline;
    });
  }, [changeNotices, searchQuery, activeDisciplineFilter]);

  const handleApproveDC = (dc: DesignChangeNotice) => {
    assertOperationalAction("approve", "components/engineering/EngineeringChangeControlView.tsx");
    const updated: DesignChangeNotice = {
      ...dc,
      status: "APPROVED",
      consultantApprovedBy: "Resident Engineer - Dr. A. Mwamba",
      consultantApprovalDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    };
    onUpdateChangeNotice(updated);
    setSelectedDC(updated);
  };

  return (
    <div className="space-y-4">
      {/* Sub Navigation */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSubTab("dcn")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "dcn"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <FileDiff className="w-3.5 h-3.5" />
              <span>Design Change Notices (DCN)</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "dcn" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {changeNotices.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("site_instructions")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "site_instructions"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Site Instructions (SI/EI)</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "site_instructions" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {siteInstructions.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("technical_variance")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "technical_variance"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Technical Variance Log</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "technical_variance" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {varianceItems.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("value_engineering")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "value_engineering"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Value Engineering Proposals</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "value_engineering" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {valueEngineering.length}
              </span>
            </button>
          </div>

          <div className="relative min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search change control..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 1. DCN REGISTER */}
      {subTab === "dcn" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileDiff className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Design Change Notices (6D Assessment) ({filteredNotices.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Integrated Technical, Cost, Schedule, PO, Contract, Site Evaluation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[860px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Notice #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Title & Location</th>
                  <th className="py-2.5 px-3 w-[180px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Superseded Drawings</th>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Cost Impact</th>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Schedule Impact</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 w-[90px] text-right border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredNotices.map((dc) => {
                  const drawings = getDrawingRevisions(dc);
                  const cost = getNetCostDelta(dc);
                  const days = getScheduleDeltaDays(dc);
                  return (
                    <tr key={dc.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                        {dc.changeNumber}
                      </td>
                      <td className="py-3 px-3 truncate overflow-hidden">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={dc.title}>{dc.title}</div>
                        <span className="text-[10px] text-slate-400 truncate block">{dc.location || "Site"} • {dc.discipline}</span>
                      </td>
                      <td className="py-3 px-3 truncate overflow-hidden">
                        <div className="flex flex-wrap gap-1">
                          {drawings.map((dwg, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleOpenDrawingInDocuments(dwg)}
                              className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[9px] hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
                              title="Open in Documents"
                            >
                              <span className="whitespace-nowrap">{dwg}</span>
                              <ExternalLink className="w-2 h-2 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap truncate overflow-hidden">
                        {cost ? `+$${cost.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap truncate overflow-hidden">
                        {days ? `+${days} Days` : "0 Days"}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getStatusBadge(dc.status)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedDC(dc)}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-blue-600 dark:text-blue-400 text-[11px] font-bold rounded cursor-pointer transition-colors whitespace-nowrap"
                        >
                          6D Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SITE INSTRUCTIONS REGISTER */}
      {subTab === "site_instructions" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Site Instructions & Engineer's Instructions (SI/EI) ({siteInstructions.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Formal instructions issued under contract</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">SI #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Instruction Scope & Title</th>
                  <th className="py-2.5 px-3 w-[180px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Contract Clause</th>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Est. Cost</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {siteInstructions.map((si) => (
                  <tr key={si.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {si.siNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={si.title}>{si.title}</div>
                      <span className="text-[10px] text-slate-400 truncate block">Issued {si.issuedDate} by {si.issuedBy}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-[11px] truncate overflow-hidden" title={si.contractClause}>
                      {si.contractClause}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap truncate overflow-hidden">
                      +${si.commercialImpactEstimated.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(si.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TECHNICAL VARIANCE REGISTER */}
      {subTab === "technical_variance" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Technical Variance Log & Tolerance Deviations ({varianceItems.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">As-built field variances from approved design</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Variance #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Element & Location</th>
                  <th className="py-2.5 px-3 min-w-[150px] border-b border-slate-200 dark:border-slate-700">Designed Standard</th>
                  <th className="py-2.5 px-3 min-w-[150px] border-b border-slate-200 dark:border-slate-700">As-Built Variance</th>
                  <th className="py-2.5 px-3 w-[160px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {varianceItems.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {v.varianceNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={v.title}>{v.title}</div>
                      <span className="text-[10px] text-slate-400 truncate block">{v.location}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs truncate overflow-hidden" title={v.designedStandard}>
                      {v.designedStandard}
                    </td>
                    <td className="py-3 px-3 text-slate-800 dark:text-slate-200 text-xs font-semibold truncate overflow-hidden" title={v.asBuiltVariance}>
                      {v.asBuiltVariance}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(v.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. VALUE ENGINEERING REGISTER */}
      {subTab === "value_engineering" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Value Engineering Proposals (VE) ({valueEngineering.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Design optimizations yielding verified cost & schedule savings</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">VE #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Proposal Title & Discipline</th>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Net Cost Saving</th>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Schedule Saving</th>
                  <th className="py-2.5 px-3 w-[180px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {valueEngineering.map((ve) => (
                  <tr key={ve.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap truncate overflow-hidden">
                      {ve.veNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={ve.title}>{ve.title}</div>
                      <span className="text-[10px] text-slate-400 truncate block">{ve.discipline} • Submitted by {ve.submittedBy}</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap truncate overflow-hidden">
                      -${ve.netSavings.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      -{ve.scheduleSavingsDays} Days
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(ve.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6D ASSESSMENT DETAIL MODAL FOR DCN */}
      {selectedDC && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 bg-blue-600/10 text-blue-600 font-mono font-bold text-xs rounded">
                  {selectedDC.changeNumber}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {selectedDC.title}
                </h2>
              </div>
              <button onClick={() => setSelectedDC(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">1. Technical Impact</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{selectedDC.technical?.whatChanged || "—"}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">2. Commercial Impact</span>
                <p className="font-bold text-emerald-600 text-sm">+{selectedDC.commercial?.costImpactFormatted || "—"}</p>
                <p className="text-[11px] text-slate-500 mt-1">{selectedDC.commercial?.boqItemAffected || "—"}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">3. Programme Impact</span>
                <p className="font-bold text-amber-600 text-sm">{selectedDC.programme?.durationImpactFormatted || "—"}</p>
                <p className="text-[11px] text-slate-500 mt-1">Critical Path: {selectedDC.programme?.criticalPathImpact ? "YES" : "NO"}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">4. Procurement / POs</span>
                <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">{selectedDC.procurement?.actionRequired || "—"}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">5. Contractual Framework</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedDC.contract?.contractFramework || "FIDIC Red Book"}</p>
                <p className="text-[11px] text-blue-600 font-mono mt-1">{selectedDC.contract?.clauseRef || "—"}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">6. Site Execution</span>
                <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">{selectedDC.site?.siteInstructions || "—"}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">
                Current Status: <strong>{selectedDC.status}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDC(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
                {selectedDC.status !== "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => handleApproveDC(selectedDC)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Design Change</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
