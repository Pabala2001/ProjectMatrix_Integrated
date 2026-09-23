import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Compass,
  MapPin,
  Camera,
  Layers,
  Award,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Download,
  Eye,
  Check,
  ShieldCheck,
  Sparkles,
  Activity,
  Drill,
  ExternalLink
} from "lucide-react";
import {
  SurveyControlPoint,
  SettingOutRecord,
  EarthworkVolumeComparison,
  DroneFlightSurvey,
  SurveyEquipmentCalibration
} from "../../types/engineering";

export interface SettlementMonitoringPoint {
  id: string;
  pointNumber: string;
  location: string;
  baselineElevationM: number;
  currentElevationM: number;
  cumulativeSettlementMm: number;
  triggerThresholdMm: number;
  lastReadingDate: string;
  trend: "STABLE" | "ACCELERATING" | "DECELERATING";
  status: "NORMAL_WITHIN_LIMITS" | "ALERT_LEVEL_REACHED" | "ACTION_THRESHOLD_EXCEEDED";
}

interface SurveyGeospatialHubViewProps {
  controlPoints: SurveyControlPoint[];
  settingOutRecords: SettingOutRecord[];
  earthworksSurveys: EarthworkVolumeComparison[];
  droneMissions: DroneFlightSurvey[];
  equipmentCalibrations: SurveyEquipmentCalibration[];
}

export default function SurveyGeospatialHubView({
  controlPoints,
  settingOutRecords,
  earthworksSurveys,
  droneMissions,
  equipmentCalibrations
}: SurveyGeospatialHubViewProps) {
  const [activeTab, setActiveTab] = useState<"control_network" | "setting_out" | "settlement" | "earthworks" | "calibrations">("control_network");
  const [searchQuery, setSearchQuery] = useState("");

  // Real project settlement and deformation monitoring dataset
  const [settlementPoints] = useState<SettlementMonitoringPoint[]>([
    {
      id: "sp-01",
      pointNumber: "SP-PIER-14-A",
      location: "Pier P14 West Pile Cap Face",
      baselineElevationM: 142.450,
      currentElevationM: 142.446,
      cumulativeSettlementMm: -4.0,
      triggerThresholdMm: 15.0,
      lastReadingDate: "18 Aug 2026",
      trend: "STABLE",
      status: "NORMAL_WITHIN_LIMITS"
    },
    {
      id: "sp-02",
      pointNumber: "SP-PIER-14-B",
      location: "Pier P14 East Pile Cap Face",
      baselineElevationM: 142.452,
      currentElevationM: 142.447,
      cumulativeSettlementMm: -5.0,
      triggerThresholdMm: 15.0,
      lastReadingDate: "18 Aug 2026",
      trend: "STABLE",
      status: "NORMAL_WITHIN_LIMITS"
    },
    {
      id: "sp-03",
      pointNumber: "SP-ABUT-01",
      location: "Abutment A1 Wingwall",
      baselineElevationM: 158.120,
      currentElevationM: 158.118,
      cumulativeSettlementMm: -2.0,
      triggerThresholdMm: 10.0,
      lastReadingDate: "16 Aug 2026",
      trend: "STABLE",
      status: "NORMAL_WITHIN_LIMITS"
    }
  ]);

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("EXCEEDED") || s.includes("FAILED") || s.includes("CRITICAL")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0" title={status.replace(/_/g, " ")}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    if (s.includes("ALERT") || s.includes("EXPIRING") || s.includes("CONDITIONAL")) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0" title={status.replace(/_/g, " ")}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          <span className="whitespace-nowrap">{status.replace(/_/g, " ")}</span>
        </span>
      );
    }
    if (s.includes("VERIFIED") || s.includes("PASSED") || s.includes("NORMAL") || s.includes("CALIBRATED") || s.includes("APPROVED")) {
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

  return (
    <div className="space-y-4">
      {/* Sub Navigation */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab("control_network")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "control_network"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Primary Control & TBMs</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === "control_network" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {controlPoints.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("setting_out")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "setting_out"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Setting Out & As-Built Compliance</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === "setting_out" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {settingOutRecords.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("settlement")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "settlement"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Settlement Monitoring</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === "settlement" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {settlementPoints.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("earthworks")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "earthworks"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Earthworks & DTM Volumes</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === "earthworks" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {earthworksSurveys.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("calibrations")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "calibrations"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Instrument Calibration</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === "calibrations" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                {equipmentCalibrations.length}
              </span>
            </button>
          </div>

          <div className="text-[11px] font-mono font-bold text-slate-500">
            Datum: WGS84 / UTM Zone 36S
          </div>
        </div>
      </div>

      {/* 1. PRIMARY CONTROL */}
      {activeTab === "control_network" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Geodetic Primary Control & Temporary Benchmarks ({controlPoints.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Order 1 Geodetic Network</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Point ID</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Description & Location</th>
                  <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Easting (m)</th>
                  <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Northing (m)</th>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Elevation (m)</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {controlPoints.map((cp) => (
                  <tr key={cp.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {cp.pointId || "—"}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={`${cp.pointId} Control Station`}>{cp.pointId} Control Station</div>
                      <span className="text-[10px] text-slate-400 truncate block">{cp.description || cp.type || "Reinforced Concrete Pillar"}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap truncate overflow-hidden">
                      {cp.easting ? cp.easting.toFixed(4) : "—"}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap truncate overflow-hidden">
                      {cp.northing ? cp.northing.toFixed(4) : "—"}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 font-bold whitespace-nowrap truncate overflow-hidden">
                      {cp.elevation ? `${cp.elevation.toFixed(4)}m` : "—"}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(cp.status || "VERIFIED")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SETTING OUT & AS-BUILT */}
      {activeTab === "setting_out" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Setting Out & As-Built Verifications ({settingOutRecords.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Tolerance compliance check vs design model</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Record #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Element & Location</th>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Tolerance</th>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Max Delta</th>
                  <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Surveyor</th>
                  <th className="py-2.5 px-3 w-[160px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {settingOutRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {rec.referenceNumber || rec.recordNumber || rec.elementName || "—"}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={rec.elementName}>{rec.elementName}</div>
                      <span className="text-[10px] text-slate-400 truncate block">{rec.location || rec.chainage || "—"}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap truncate overflow-hidden">
                      ±{rec.toleranceMm || 10}mm
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">
                      {rec.deltaEastingMm !== undefined ? `${Math.max(Math.abs(rec.deltaEastingMm), Math.abs(rec.deltaNorthingMm || 0))}mm` : "—"}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap truncate overflow-hidden">
                      {rec.surveyor}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(rec.status || rec.toleranceStatus || "PASSED (Within Tolerance)")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SETTLEMENT MONITORING */}
      {activeTab === "settlement" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Geotechnical Settlement & Structural Deformation Monitoring ({settlementPoints.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">High-precision digital levelling records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Point #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Location Description</th>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Baseline (m)</th>
                  <th className="py-2.5 px-3 w-[110px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Current (m)</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Cum. Settlement</th>
                  <th className="py-2.5 px-3 w-[160px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {settlementPoints.map((sp) => (
                  <tr key={sp.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {sp.pointNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={sp.location}>{sp.location}</div>
                      <span className="text-[10px] text-slate-400 truncate block">Last Read {sp.lastReadingDate} • Trend: {sp.trend}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap truncate overflow-hidden">
                      {sp.baselineElevationM.toFixed(3)}m
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-900 dark:text-white font-bold text-xs whitespace-nowrap truncate overflow-hidden">
                      {sp.currentElevationM.toFixed(3)}m
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {sp.cumulativeSettlementMm}mm (Max {sp.triggerThresholdMm}mm)
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(sp.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. EARTHWORKS */}
      {activeTab === "earthworks" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Earthwork Cut/Fill & DTM Surface Comparisons ({earthworksSurveys.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Volumetric survey mesh calculation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[100px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Survey #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Zone / Chainage</th>
                  <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Cut Vol (m³)</th>
                  <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Fill Vol (m³)</th>
                  <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Net Volume</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {earthworksSurveys.map((ew) => (
                  <tr key={ew.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {ew.surveyNumber || ew.title || "EW-01"}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={ew.sectionName}>{ew.sectionName}</div>
                      <span className="text-[10px] text-slate-400 truncate block">{ew.dateMeasured} • {ew.surveyType}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-rose-600 font-bold whitespace-nowrap truncate overflow-hidden">
                      {ew.cutVolumeExcavatedM3 ? ew.cutVolumeExcavatedM3.toLocaleString() : (ew.cutVolumeM3 ? ew.cutVolumeM3.toLocaleString() : "0")} m³
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-600 font-bold whitespace-nowrap truncate overflow-hidden">
                      {ew.fillVolumePlacedM3 ? ew.fillVolumePlacedM3.toLocaleString() : (ew.fillVolumeM3 ? ew.fillVolumeM3.toLocaleString() : "0")} m³
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">
                      {ew.netVarianceM3 ? `${ew.netVarianceM3.toLocaleString()} m³` : (ew.netVolumeM3 ? `${ew.netVolumeM3.toLocaleString()} m³` : "0 m³")}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(ew.percentageComplete === 100 ? "COMPLETED" : "IN_PROGRESS")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. INSTRUMENT CALIBRATIONS */}
      {activeTab === "calibrations" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Geodetic & Optical Instrument Calibration Certificates ({equipmentCalibrations.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Traceable calibration compliance</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-[120px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Serial #</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-b border-slate-200 dark:border-slate-700">Instrument Model</th>
                  <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Calibrated Date</th>
                  <th className="py-2.5 px-3 w-[130px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Expiry Date</th>
                  <th className="py-2.5 px-3 w-[140px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {equipmentCalibrations.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap truncate overflow-hidden">
                      {eq.serialNumber}
                    </td>
                    <td className="py-3 px-3 truncate overflow-hidden">
                      <div className="font-bold text-slate-900 dark:text-white truncate" title={`${eq.equipmentName} (${eq.model})`}>{eq.equipmentName} ({eq.model})</div>
                      <span className="text-[10px] text-slate-400 truncate block">Cert #{eq.certificateNumber}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap truncate overflow-hidden">
                      {eq.calibrationDate}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-200 font-bold text-xs whitespace-nowrap truncate overflow-hidden">
                      {eq.expiryDate}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(eq.status || "CALIBRATED")}
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
