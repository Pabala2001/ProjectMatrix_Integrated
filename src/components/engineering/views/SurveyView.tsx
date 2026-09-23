import React, { useState, useMemo } from "react";
import {
  Search,
  Check,
  AlertTriangle,
  ChevronRight,
  Compass,
  MapPin,
  Calendar,
  Clock,
  Layers,
  Wrench,
  CheckCircle2
} from "lucide-react";
import {
  SurveyControlPoint,
  SettingOutRecord,
  EarthworkVolumeComparison,
  SurveyEquipmentCalibration
} from "../../../types/engineering";
import { UnifiedRecord } from "../RecordDetailsDrawer";
import { EngineeringRowActions } from "../EngineeringActionModals";

interface SurveyViewProps {
  controlPoints: SurveyControlPoint[];
  settingOutRecords: SettingOutRecord[];
  earthworkSurveys: EarthworkVolumeComparison[];
  equipmentCalibrations: SurveyEquipmentCalibration[];
  onSelectRecord: (record: UnifiedRecord) => void;
  selectedDiscipline: string;
  onEditRecord?: (record: UnifiedRecord) => void;
  onDeleteRecord?: (record: UnifiedRecord) => void;
}

type SurveySubSection = "control" | "setting_out" | "earthworks" | "calibrations";

export default function SurveyView({
  controlPoints,
  settingOutRecords,
  earthworkSurveys,
  equipmentCalibrations,
  onSelectRecord,
  selectedDiscipline,
  onEditRecord,
  onDeleteRecord
}: SurveyViewProps) {
  const [subSection, setSubSection] = useState<SurveySubSection>("setting_out");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filtered Setting Out
  const filteredSettingOut = useMemo(() => {
    return settingOutRecords.filter((s) => {
      if (selectedDiscipline !== "all" && s.discipline.toLowerCase() !== selectedDiscipline.toLowerCase()) {
        return false;
      }
      if (statusFilter !== "all" && s.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = (s.recordNumber || s.referenceNumber || "").toLowerCase().includes(q);
        const matchElem = (s.elementName || "").toLowerCase().includes(q);
        const matchSurv = (s.surveyor || "").toLowerCase().includes(q);
        if (!matchRef && !matchElem && !matchSurv) return false;
      }
      return true;
    });
  }, [settingOutRecords, selectedDiscipline, statusFilter, searchQuery]);

  // Filtered Control Points
  const filteredControlPoints = useMemo(() => {
    return controlPoints.filter((cp) => {
      if (statusFilter !== "all" && cp.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = cp.pointId.toLowerCase().includes(q);
        const matchDesc = cp.description.toLowerCase().includes(q);
        if (!matchId && !matchDesc) return false;
      }
      return true;
    });
  }, [controlPoints, statusFilter, searchQuery]);

  // Filtered Earthworks
  const filteredEarthworks = useMemo(() => {
    return earthworkSurveys.filter((ew) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchZone = ew.zoneChainage.toLowerCase().includes(q);
        const matchMethod = ew.surveyMethod.toLowerCase().includes(q);
        if (!matchZone && !matchMethod) return false;
      }
      return true;
    });
  }, [earthworkSurveys, searchQuery]);

  // Filtered Calibrations
  const filteredCalibrations = useMemo(() => {
    return equipmentCalibrations.filter((eq) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInst = eq.instrumentName.toLowerCase().includes(q);
        const matchSerial = eq.serialNumber.toLowerCase().includes(q);
        if (!matchInst && !matchSerial) return false;
      }
      return true;
    });
  }, [equipmentCalibrations, searchQuery]);

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("REJECT") || s.includes("EXPIRED") || s.includes("OUT OF TOLERANCE")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
          {status}
        </span>
      );
    }
    if (s.includes("PENDING") || s.includes("EXPIRING")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1 stroke-[2.5] shrink-0" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub-Sections selector & search */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs overflow-x-auto">
          <button
            onClick={() => setSubSection("setting_out")}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              subSection === "setting_out"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Setting Out Verification</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {settingOutRecords.length}
            </span>
          </button>

          <button
            onClick={() => setSubSection("control")}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              subSection === "control"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Control Network</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {controlPoints.length}
            </span>
          </button>

          <button
            onClick={() => setSubSection("earthworks")}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              subSection === "earthworks"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Earthworks & Volumes</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {earthworkSurveys.length}
            </span>
          </button>

          <button
            onClick={() => setSubSection("calibrations")}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              subSection === "calibrations"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Instrument Calibration</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {equipmentCalibrations.length}
            </span>
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search survey records...`}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 1. SETTING OUT VERIFICATION TABLE */}
      {subSection === "setting_out" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Record #</th>
                  <th className="py-3 px-4 min-w-[220px]">Element / Chainage</th>
                  <th className="py-3 px-4 w-28">Discipline</th>
                  <th className="py-3 px-4 w-24">ΔE (mm)</th>
                  <th className="py-3 px-4 w-24">ΔN (mm)</th>
                  <th className="py-3 px-4 w-24">ΔZ (mm)</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-32">Surveyor</th>
                  <th className="py-3 px-4 w-28">Date</th>
                  <th className="py-3 px-4 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredSettingOut.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                      No setting out records match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredSettingOut.map((so) => (
                    <tr
                      key={so.id}
                      onClick={() => onSelectRecord({ type: "SETTING_OUT", data: so })}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <span className="group-hover:text-blue-600 transition-colors">
                          {so.recordNumber || so.referenceNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {so.elementName}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap capitalize">
                          {so.discipline}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        {so.deltaEastingMm > 0 ? `+${so.deltaEastingMm}` : so.deltaEastingMm}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        {so.deltaNorthingMm > 0 ? `+${so.deltaNorthingMm}` : so.deltaNorthingMm}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        {so.deltaElevationMm > 0 ? `+${so.deltaElevationMm}` : so.deltaElevationMm}
                      </td>

                      <td className="py-3 px-4">
                        {getStatusBadge(so.status)}
                      </td>

                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 truncate">
                        {so.surveyor}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {so.date}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <EngineeringRowActions
                          onView={() => onSelectRecord({ type: "SETTING_OUT", data: so })}
                          onEdit={() => onEditRecord ? onEditRecord({ type: "SETTING_OUT", data: so }) : onSelectRecord({ type: "SETTING_OUT", data: so })}
                          onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "SETTING_OUT", data: so }) : undefined}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. CONTROL NETWORK TABLE */}
      {subSection === "control" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Point ID</th>
                  <th className="py-3 px-4 min-w-[240px]">Description / Monument Type</th>
                  <th className="py-3 px-4 w-32">Easting (m)</th>
                  <th className="py-3 px-4 w-32">Northing (m)</th>
                  <th className="py-3 px-4 w-28">Elevation (m)</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-28">Last Verified</th>
                  <th className="py-3 px-4 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                {filteredControlPoints.map((cp) => (
                  <tr
                    key={cp.id}
                    onClick={() => onSelectRecord({ type: "CONTROL_POINT", data: cp })}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group font-sans"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="group-hover:text-blue-600 transition-colors">
                        {cp.pointId}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {cp.description}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                      {cp.easting.toFixed(4)}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                      {cp.northing.toFixed(4)}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {cp.elevation.toFixed(4)}m
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(cp.status)}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {cp.lastVerifiedDate}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <EngineeringRowActions
                        onView={() => onSelectRecord({ type: "CONTROL_POINT", data: cp })}
                        onEdit={() => onEditRecord ? onEditRecord({ type: "CONTROL_POINT", data: cp }) : onSelectRecord({ type: "CONTROL_POINT", data: cp })}
                        onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "CONTROL_POINT", data: cp }) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. EARTHWORKS & VOLUMES TABLE */}
      {subSection === "earthworks" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-32">Zone / Chainage</th>
                  <th className="py-3 px-4 min-w-[200px]">Survey Method</th>
                  <th className="py-3 px-4 w-28">Cut Volume (m³)</th>
                  <th className="py-3 px-4 w-28">Fill Volume (m³)</th>
                  <th className="py-3 px-4 w-28">Net Balance</th>
                  <th className="py-3 px-4 w-32">Survey Date</th>
                  <th className="py-3 px-4 w-28">Approved By</th>
                  <th className="py-3 px-4 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredEarthworks.map((ew) => (
                  <tr
                    key={ew.id}
                    onClick={() => onSelectRecord({ type: "GENERIC", data: { reference: ew.zoneChainage, description: `Earthwork Volume Survey (${ew.surveyMethod})`, discipline: "Survey & Geospatial", status: "Certified", responsible: ew.approvedBy, dueDate: ew.surveyDate } })}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {ew.zoneChainage}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {ew.surveyMethod}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {ew.cutVolumeM3.toLocaleString()} m³
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {ew.fillVolumeM3.toLocaleString()} m³
                    </td>

                    <td className="py-3 px-4 font-mono font-bold">
                      {ew.netBalanceM3.toLocaleString()} m³
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {ew.surveyDate}
                    </td>

                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      {ew.approvedBy}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <EngineeringRowActions
                        onView={() => onSelectRecord({ type: "GENERIC", data: { reference: ew.zoneChainage, description: `Earthwork Volume Survey (${ew.surveyMethod})`, discipline: "Survey & Geospatial", status: "Certified", responsible: ew.approvedBy, dueDate: ew.surveyDate } })}
                        onEdit={() => onEditRecord ? onEditRecord({ type: "GENERIC", data: { reference: ew.zoneChainage, description: `Earthwork Volume Survey (${ew.surveyMethod})`, discipline: "Survey & Geospatial", status: "Certified", responsible: ew.approvedBy, dueDate: ew.surveyDate } }) : onSelectRecord({ type: "GENERIC", data: { reference: ew.zoneChainage, description: `Earthwork Volume Survey (${ew.surveyMethod})`, discipline: "Survey & Geospatial", status: "Certified", responsible: ew.approvedBy, dueDate: ew.surveyDate } })}
                        onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "GENERIC", data: { reference: ew.zoneChainage, description: `Earthwork Volume Survey (${ew.surveyMethod})`, discipline: "Survey & Geospatial", status: "Certified", responsible: ew.approvedBy, dueDate: ew.surveyDate } }) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CALIBRATIONS TABLE */}
      {subSection === "calibrations" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/75 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[220px]">Instrument Name</th>
                  <th className="py-3 px-4 w-32">Serial #</th>
                  <th className="py-3 px-4 w-36">Calibration Cert #</th>
                  <th className="py-3 px-4 w-32">Calibrated Date</th>
                  <th className="py-3 px-4 w-32">Expiry Date</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-36">Certifying Body</th>
                  <th className="py-3 px-4 w-44 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredCalibrations.map((eq) => (
                  <tr
                    key={eq.id}
                    onClick={() => onSelectRecord({ type: "GENERIC", data: { reference: eq.serialNumber, description: `${eq.instrumentName} Calibration Certificate`, discipline: "Survey & Geospatial", status: eq.status, responsible: eq.certifiedBy, dueDate: eq.expiryDate } })}
                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {eq.instrumentName}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {eq.serialNumber}
                    </td>

                    <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400">
                      {eq.certificateNumber}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {eq.calibrationDate}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      {eq.expiryDate}
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(eq.status)}
                    </td>

                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      {eq.certifiedBy}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <EngineeringRowActions
                        onView={() => onSelectRecord({ type: "GENERIC", data: { reference: eq.serialNumber, description: `${eq.instrumentName} Calibration Certificate`, discipline: "Survey & Geospatial", status: eq.status, responsible: eq.certifiedBy, dueDate: eq.expiryDate } })}
                        onEdit={() => onEditRecord ? onEditRecord({ type: "GENERIC", data: { reference: eq.serialNumber, description: `${eq.instrumentName} Calibration Certificate`, discipline: "Survey & Geospatial", status: eq.status, responsible: eq.certifiedBy, dueDate: eq.expiryDate } }) : onSelectRecord({ type: "GENERIC", data: { reference: eq.serialNumber, description: `${eq.instrumentName} Calibration Certificate`, discipline: "Survey & Geospatial", status: eq.status, responsible: eq.certifiedBy, dueDate: eq.expiryDate } })}
                        onDelete={() => onDeleteRecord ? onDeleteRecord({ type: "GENERIC", data: { reference: eq.serialNumber, description: `${eq.instrumentName} Calibration Certificate`, discipline: "Survey & Geospatial", status: eq.status, responsible: eq.certifiedBy, dueDate: eq.expiryDate } }) : undefined}
                      />
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
