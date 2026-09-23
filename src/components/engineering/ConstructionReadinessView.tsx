import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  HardHat,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ExternalLink,
  ShieldAlert,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  Calendar,
  Building,
  UserCheck,
  Check,
  X,
  Lock,
  Unlock,
  AlertCircle
} from "lucide-react";
import {
  ConstructabilityReview,
  EngineeringDisciplineId,
  ImpactLevel
} from "../../types/engineering";
import { MASTER_ENGINEERING_DISCIPLINES } from "../../data/engineeringData";

export interface DesignPackageIFC {
  id: string;
  packageNumber: string;
  title: string;
  discipline: EngineeringDisciplineId;
  revision: string;
  ifcStatus: "ISSUED_FOR_CONSTRUCTION" | "PRELIMINARY_REVIEW" | "HOLD_FOR_APPROVAL" | "SUPERSEDED";
  drawingsCount: number;
  sampleDrawings: string[];
  issuedDate: string;
  releasedBy: string;
  sitePermitRequired: boolean;
}

export interface MethodStatementItem {
  id: string;
  msNumber: string;
  title: string;
  discipline: EngineeringDisciplineId;
  contractor: string;
  submissionDate: string;
  approvalDate?: string;
  status: "APPROVED" | "APPROVED_WITH_CONDITIONS" | "UNDER_REVIEW" | "REJECTED";
  approvedBy: string;
  holdPointRef: string;
  associatedITP: string;
}

export interface EngineeringHoldItem {
  id: string;
  holdNumber: string;
  title: string;
  location: string;
  discipline: EngineeringDisciplineId;
  holdReason: string;
  dateImposed: string;
  imposedBy: string;
  releaseCriteria: string;
  status: "ACTIVE_HOLD" | "RELEASE_VERIFIED" | "CONDITIONAL_RELEASE";
  releasedDate?: string;
  releasedBy?: string;
}

interface ConstructionReadinessViewProps {
  constructabilityReviews: ConstructabilityReview[];
  onAddConstructabilityReview?: (cr: ConstructabilityReview) => void;
  activeDisciplineFilter: string;
  onSelectDisciplineFilter: (discipline: string) => void;
  availableDisciplines: { id: EngineeringDisciplineId; name: string; code: string }[];
}

export default function ConstructionReadinessView({
  constructabilityReviews,
  onAddConstructabilityReview,
  activeDisciplineFilter,
  onSelectDisciplineFilter,
  availableDisciplines
}: ConstructionReadinessViewProps) {
  const [subTab, setSubTab] = useState<"constructability" | "ifc_packages" | "method_statements" | "engineering_holds">("constructability");
  const [searchQuery, setSearchQuery] = useState("");

  // Sample actual project data for IFC packages, method statements, and holds
  const [ifcPackages] = useState<DesignPackageIFC[]>([
    {
      id: "pkg-01",
      packageNumber: "PKG-STR-01",
      title: "Substructure & Pile Caps Reinforcement Details",
      discipline: "structural",
      revision: "Rev C",
      ifcStatus: "ISSUED_FOR_CONSTRUCTION",
      drawingsCount: 14,
      sampleDrawings: ["STR-042 Rev C", "STR-043 Rev C", "STR-044 Rev B"],
      issuedDate: "05 Aug 2026",
      releasedBy: "Dr. A. Mwamba (Resident Engineer)",
      sitePermitRequired: true
    },
    {
      id: "pkg-02",
      packageNumber: "PKG-GEO-02",
      title: "Deep Secant Retention Piling Alignment & Depths",
      discipline: "geotechnical",
      revision: "Rev B",
      ifcStatus: "ISSUED_FOR_CONSTRUCTION",
      drawingsCount: 8,
      sampleDrawings: ["GEO-101 Rev B", "GEO-102 Rev B"],
      issuedDate: "28 Jul 2026",
      releasedBy: "Dr. Elena Rostova",
      sitePermitRequired: true
    },
    {
      id: "pkg-03",
      packageNumber: "PKG-DRN-03",
      title: "Main Line Precast Box Culvert Drainage Package",
      discipline: "drainage",
      revision: "Rev D",
      ifcStatus: "HOLD_FOR_APPROVAL",
      drawingsCount: 6,
      sampleDrawings: ["DRN-104 Rev D", "DRN-105 Rev C"],
      issuedDate: "10 Aug 2026",
      releasedBy: "Supervising Consultant",
      sitePermitRequired: true
    }
  ]);

  const [methodStatements] = useState<MethodStatementItem[]>([
    {
      id: "ms-01",
      msNumber: "MS-STR-014",
      title: "Pier P14 Heavy Falsework Erection & Concrete Pour Sequence",
      discipline: "structural",
      contractor: "Matrix Construction JV",
      submissionDate: "12 Aug 2026",
      approvalDate: "16 Aug 2026",
      status: "APPROVED_WITH_CONDITIONS",
      approvedBy: "Resident Engineer - Dr. A. Mwamba",
      holdPointRef: "HP-STR-04 (Pre-Pour Rebar & Falsework Inspection)",
      associatedITP: "ITP-STR-04"
    },
    {
      id: "ms-02",
      msNumber: "MS-PAV-008",
      title: "Asphalt Base Course Placement & Compaction Methodology",
      discipline: "roads_pavements",
      contractor: "Highway Paving Division",
      submissionDate: "15 Aug 2026",
      status: "UNDER_REVIEW",
      approvedBy: "Senior Materials Engineer",
      holdPointRef: "HP-PAV-02 (Subgrade Density Verification)",
      associatedITP: "ITP-PAV-02"
    }
  ]);

  const [engineeringHolds, setEngineeringHolds] = useState<EngineeringHoldItem[]>([
    {
      id: "hold-01",
      holdNumber: "HOLD-ENG-08",
      title: "Foundation Blinding Pour Hold at Pier P14",
      location: "Chainage Km 14+250",
      discipline: "geotechnical",
      holdReason: "Borehole BH-08 rockhead variation requires consultant determination under RFI-089.",
      dateImposed: "18 Aug 2026",
      imposedBy: "Thabo Nkosi (Site Engineer)",
      releaseCriteria: "Receipt of consultant written approval on foundation depth under RFI-089.",
      status: "ACTIVE_HOLD"
    },
    {
      id: "hold-02",
      holdNumber: "HOLD-ENG-07",
      title: "Culvert C-08 Precast Box Placement Hold",
      location: "Chainage Km 14+200",
      discipline: "drainage",
      holdReason: "Upsizing change order from 900mm to 1200mm units in progress under DC-017.",
      dateImposed: "10 Aug 2026",
      imposedBy: "Khadija Belkacem (Lead Hydraulics)",
      releaseCriteria: "Delivery of 1200mm box units and updated setting out sign-off.",
      status: "ACTIVE_HOLD"
    }
  ]);

  // Navigate to central Documents drawing register without creating duplicated sections
  const handleOpenDrawingInDocuments = (drawingRef: string) => {
    if (!drawingRef || drawingRef === "—") return;
    const cleanRef = drawingRef.split(" ")[0].trim();
    window.location.hash = `#/documents?category=DRAWINGS&search=${encodeURIComponent(cleanRef)}`;
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("ACTIVE_HOLD") || s.includes("REJECT") || s.includes("CRITICAL")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0" title={status.replace(/_/g, " ")}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    if (s.includes("REVIEW") || s.includes("HOLD_FOR") || s.includes("PENDING") || s.includes("CONDITIONS")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0" title={status.replace(/_/g, " ")}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    if (s.includes("ISSUED") || s.includes("APPROVED") || s.includes("RELEASE_VERIFIED") || s.includes("INCORPORATED")) {
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

  const getSeverityBadge = (level: ImpactLevel | string) => {
    const l = (level || "").toUpperCase();
    if (l === "CRITICAL") {
      return <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">Critical Hazard</span>;
    }
    if (l === "HIGH") {
      return <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 shrink-0">High Hazard</span>;
    }
    return <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 shrink-0">Moderate</span>;
  };

  const filteredCRs = useMemo(() => {
    return constructabilityReviews.filter((cr) => {
      const matchSearch =
        !searchQuery ||
        (cr.reviewNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cr.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cr.identifiedHazard || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchDisc = activeDisciplineFilter === "all" || cr.discipline === activeDisciplineFilter;
      return matchSearch && matchDisc;
    });
  }, [constructabilityReviews, searchQuery, activeDisciplineFilter]);

  return (
    <div className="space-y-4">
      {/* Sub Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSubTab("constructability")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "constructability"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Constructability Reviews</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "constructability" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {constructabilityReviews.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("ifc_packages")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "ifc_packages"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Design Packages & IFC Status</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "ifc_packages" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {ifcPackages.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("method_statements")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "method_statements"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Method Statement Approvals</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "method_statements" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {methodStatements.length}
              </span>
            </button>

            <button
              onClick={() => setSubTab("engineering_holds")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                subTab === "engineering_holds"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Engineering Holds & Releases</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${subTab === "engineering_holds" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {engineeringHolds.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search readiness register..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 1. CONSTRUCTABILITY REVIEWS REGISTER */}
      {subTab === "constructability" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardHat className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Constructability & Safety Hazard Mitigation Register ({filteredCRs.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Site safety & crane clearances analysis
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[840px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[85px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Ref #</th>
                  <th className="py-2.5 px-3 min-w-[150px] border-b border-slate-200 dark:border-slate-700">Review Item Title</th>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Discipline</th>
                  <th className="py-2.5 px-3 min-w-[150px] border-b border-slate-200 dark:border-slate-700">Identified Hazard & Risk</th>
                  <th className="py-2.5 px-3 min-w-[150px] border-b border-slate-200 dark:border-slate-700">Proposed Engineering Mitigation</th>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Severity</th>
                  <th className="py-2.5 px-3 w-[150px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCRs.map((cr) => (
                  <tr key={cr.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {cr.reviewNumber}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white truncate overflow-hidden" title={cr.title}>
                      {cr.title}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap truncate overflow-hidden">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        {cr.discipline}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs truncate overflow-hidden" title={cr.identifiedHazard}>
                      {cr.identifiedHazard}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs truncate overflow-hidden" title={cr.proposedMitigation}>
                      {cr.proposedMitigation}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getSeverityBadge(cr.severity)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(cr.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. DESIGN PACKAGES & IFC STATUS */}
      {subTab === "ifc_packages" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Issued For Construction (IFC) Design Release Packages ({ifcPackages.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">
              Drawing files controlled strictly under Documents module
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[105px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Package #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Design Package Scope</th>
                  <th className="py-2.5 px-3 w-[95px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Discipline</th>
                  <th className="py-2.5 px-3 w-[200px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Referenced IFC Drawings</th>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Release Date</th>
                  <th className="py-2.5 px-3 w-[160px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ifcPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {pkg.packageNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={pkg.title}>{pkg.title}</div>
                      <span className="text-[10px] text-slate-400 font-mono truncate block">{pkg.revision} • Released by {pkg.releasedBy}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap truncate overflow-hidden">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        {pkg.discipline}
                      </span>
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="flex flex-wrap gap-1">
                        {pkg.sampleDrawings.map((dwg) => (
                          <button
                            key={dwg}
                            type="button"
                            onClick={() => handleOpenDrawingInDocuments(dwg)}
                            className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[10px] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                            title="Open controlled drawing in Documents"
                          >
                            <span className="whitespace-nowrap">{dwg}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap truncate overflow-hidden">
                      {pkg.issuedDate}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(pkg.ifcStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. METHOD STATEMENTS APPROVALS */}
      {subTab === "method_statements" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Method Statement Approvals & Hold Points ({methodStatements.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Formal contractor construction execution procedures</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">MS #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Method Statement Title</th>
                  <th className="py-2.5 px-3 w-[180px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Associated Hold Point</th>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Linked ITP</th>
                  <th className="py-2.5 px-3 w-[160px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {methodStatements.map((ms) => (
                  <tr key={ms.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {ms.msNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={ms.title}>{ms.title}</div>
                      <span className="text-[10px] text-slate-400 truncate block">{ms.contractor} • Submitted {ms.submissionDate}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate overflow-hidden" title={ms.holdPointRef}>
                      {ms.holdPointRef}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {ms.associatedITP}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(ms.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ENGINEERING HOLDS & RELEASES */}
      {subTab === "engineering_holds" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Engineering Site Holds & Release Management ({engineeringHolds.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Mandatory stops placed on physical works pending technical resolution</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Hold #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Hold Title & Location</th>
                  <th className="py-2.5 px-3 min-w-[150px] border-b border-slate-200 dark:border-slate-700">Reason for Technical Stop</th>
                  <th className="py-2.5 px-3 min-w-[150px] border-b border-slate-200 dark:border-slate-700">Release Criteria</th>
                  <th className="py-2.5 px-3 w-[150px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {engineeringHolds.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap truncate overflow-hidden">
                      {h.holdNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={h.title}>{h.title}</div>
                      <span className="text-[10px] text-slate-400 truncate block">{h.location} • Imposed {h.dateImposed} by {h.imposedBy}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs truncate overflow-hidden" title={h.holdReason}>
                      {h.holdReason}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs truncate overflow-hidden" title={h.releaseCriteria}>
                      {h.releaseCriteria}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(h.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
