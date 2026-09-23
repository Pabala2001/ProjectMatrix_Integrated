import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import {
  BookOpen,
  CloudSun,
  HardHat,
  Truck,
  CheckSquare,
  AlertTriangle,
  UserCheck,
  Camera,
  Package,
  FileCheck,
  Send,
  CheckCircle2,
  Check,
  Download,
  Printer,
  X,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Clock,
  Zap,
  ShieldCheck
} from "lucide-react";
import { SiteRecordEntry } from "./SingleEntryAutoSyncPanel";
import { WeatherData } from "../../services/weatherService";

interface DigitalSiteDiaryProps {
  projectName?: string;
  onNavigateToTab?: (tab: string) => void;
  record?: SiteRecordEntry;
  weatherText?: string;
  weatherData?: WeatherData | null;
}

export default function DigitalSiteDiary({
  projectName = "Tunduma Border Road",
  onNavigateToTab,
  record: propRecord,
  weatherText = "Clear · 27°C",
  weatherData
}: DigitalSiteDiaryProps) {
  const record: SiteRecordEntry = propRecord || {
    activity: "Concrete Pavement",
    location: "CH 2+400–2+472",
    quantity: 72,
    unit: "m",
    concreteVolume: 50.4,
    concreteUnit: "m³",
    crew: "Crew A",
    crewWorkers: 16,
    plant: "Paver + 2 Tippers",
    photosCount: 4
  };

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const handleSubmitReport = () => {
    assertOperationalAction("write", "pages/Site/DigitalSiteDiary.tsx");
    setIsGenerating(true);
    // Simulate instantaneous Project Matrix compilation
    setTimeout(() => {
      setIsGenerating(false);
      setIsSubmitted(true);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSubmittedAt(`Today at ${timeStr}`);
      setShowReportModal(true);
    }, 600);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Diary Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">
              DAILY SITE DIARY — 04 SEP 2026
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Self-Building Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Contemporary site log automatically compiled in real-time from active workfronts, plant telemetry, and field inspections.
          </p>
        </div>

        {/* Live Diary Status */}
        <div className="flex items-center gap-2">
          {isSubmitted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Report Generated · {submittedAt}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Building Live · Day Shift</span>
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Core Shift Indicators: Weather, Workforce, Plant, Inspections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Weather */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Weather
              </span>
              <CloudSun className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {weatherText}
            </div>
            <div className="text-[11px] text-slate-500">
              {weatherData?.description 
                ? `${weatherData.description} (Humidity ${weatherData.humidity}%, Wind ${weatherData.windSpeedKmH} km/h)` 
                : "Dry surface conditions, good compaction window"}
            </div>
          </div>

          {/* Workforce */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Workforce
              </span>
              <HardHat className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              87 persons
            </div>
            <div className="text-[11px] text-slate-500">
              12 site staff · 75 operative crews (Crews A–D)
            </div>
          </div>

          {/* Plant */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Plant
              </span>
              <Truck className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              17 available · 14 operating · 3 unavailable
            </div>
            <div className="text-[11px] text-slate-500">
              82% operational fleet utilization
            </div>
          </div>

          {/* Inspections */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Inspections
              </span>
              <CheckSquare className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              3 completed · 1 outstanding
            </div>
            <div className="text-[11px] text-slate-500">
              Concrete & G3 cleared; culvert joint pending
            </div>
          </div>
        </div>

        {/* Works Executed */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Works Executed
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">
              3 Active Sections Logged
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4 font-black">Activity</th>
                  <th className="py-2.5 px-4 font-black">Location</th>
                  <th className="py-2.5 px-4 font-black text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    <div>{record.activity}</div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{record.concreteVolume} {record.concreteUnit} conc</span>
                      <span>•</span>
                      <span>{record.crew} ({record.crewWorkers} wks)</span>
                      <span>•</span>
                      <span>{record.plant}</span>
                      <span>•</span>
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">{record.photosCount} photos</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-700 dark:text-blue-300 align-top">
                    {record.location}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-white align-top">
                    {record.quantity} {record.unit}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    Excavation
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-700 dark:text-blue-300">
                    CH 3+100–3+250
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-white">
                    430 m³
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    G3 placement
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-700 dark:text-blue-300">
                    CH 1+500–1+680
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-white">
                    1,260 m²
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Supplementary Contemporary Entries: Materials, Delays, Visitors, Photos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Materials Received */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Materials Received
              </span>
            </div>
            <div className="space-y-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <div className="flex items-center justify-between">
                <span>Cement</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">600 bags</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Aggregate</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">48 m³</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-emerald-700 dark:text-emerald-300">
                <span>Concrete Drawn</span>
                <span className="font-bold font-mono">{record.concreteVolume} {record.concreteUnit}</span>
              </div>
            </div>
          </div>

          {/* Delays */}
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Delays
              </span>
            </div>
            <div className="space-y-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <div className="text-slate-900 dark:text-white font-bold">
                Grader breakdown — 2.5 hours
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-300 font-normal">
                Hydraulic line burst at CH 4+100; repaired by plant fitters
              </div>
            </div>
          </div>

          {/* Visitors */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Visitors
              </span>
            </div>
            <div className="space-y-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <div className="text-slate-900 dark:text-white font-bold">
                TANROADS RE — 10:20
              </div>
              <div className="text-[11px] text-slate-500 font-normal">
                Joint inspection with Resident Engineer on concrete pavement test strip
              </div>
            </div>
          </div>

          {/* Photos */}
          <div
            onClick={() => onNavigateToTab?.("progress-evidence")}
            className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Photos
                </span>
              </div>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                View Register →
              </span>
            </div>
            <div className="space-y-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <div className="text-slate-900 dark:text-white font-bold flex items-center justify-between">
                <span>18 construction records</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">7 Stages</span>
              </div>
              <div className="text-[11px] text-slate-500 font-normal">
                Before · During · After · Inspection · Defect · Progress · Safety
              </div>
            </div>
          </div>
        </div>

        {/* SUBMIT DAILY REPORT CALLOUT (PROJECT MATRIX AUTO-GENERATION) */}
        <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-slate-50 to-indigo-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Shift Closure & Daily Report
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-mono text-[10px] font-bold">
                Project Matrix Engine
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Project Matrix compiles and generates the formal Daily Production Report automatically from these diary records.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isSubmitted && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>View Generated Report</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={isGenerating}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white text-xs font-black tracking-wide shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Project Matrix Generating...</span>
                </>
              ) : isSubmitted ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Re-Submit Daily Report</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Daily Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* GENERATED DAILY REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                  PM
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Daily Production Report (Auto-Generated)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Ref: DPR-TBR-2026-09-04 · Friday, 04 Sep 2026
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Compiled Document Preview */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold">
                    Project Matrix successfully generated and filed the official Daily Report.
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60">
                  Signed & Filed
                </span>
              </div>

              {/* Document Overview */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-850/50 space-y-3 font-mono">
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div>
                    <span className="text-slate-400">Project:</span> {projectName}
                  </div>
                  <div>
                    <span className="text-slate-400">Date:</span> 04 Sep 2026 (Day Shift)
                  </div>
                  <div>
                    <span className="text-slate-400">Weather:</span> {weatherText}
                  </div>
                  <div>
                    <span className="text-slate-400">Workforce:</span> 87 persons
                  </div>
                  <div>
                    <span className="text-slate-400">Plant Status:</span> 17 avail · 14 oper · 3 unavail
                  </div>
                  <div>
                    <span className="text-slate-400">Inspection Signoffs:</span> 3 Passed / 1 Pending
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 mb-1 font-sans font-bold text-[11px] uppercase">
                    Executed Production Summary
                  </div>
                  <ul className="space-y-1 text-slate-800 dark:text-slate-200">
                    <li>• Concrete pavement: {record.quantity} {record.unit} ({record.location}) · {record.concreteVolume} {record.concreteUnit} conc · {record.crew} ({record.crewWorkers} workers) · {record.plant} · {record.photosCount} photos</li>
                    <li>• Excavation: 430 m³ (CH 3+100–3+250) — 108% of target</li>
                    <li>• G3 placement: 1,260 m² (CH 1+500–1+680) — Complete</li>
                  </ul>
                </div>

                {/* Project Matrix Single Source of Truth Auto-Sync Confirmation */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-1.5">
                  <div className="text-blue-600 dark:text-blue-400 font-sans font-bold text-[11px] uppercase flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Project Matrix Automatic Propagation (0 Duplicate Forms)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-sans">
                    <div className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Site Operations → {record.quantity} m completed</div>
                    <div className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Programme → activity progress updated</div>
                    <div className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Resources → workforce utilisation ({record.crewWorkers} wks)</div>
                    <div className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Plant → operating hours/utilisation ({record.plant})</div>
                    <div className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Materials → {record.concreteVolume} m³ concrete consumed</div>
                    <div className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Commercial → quantity / earned value certified</div>
                    <div className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Project Overview → physical progress updated</div>
                    <div className="flex items-center gap-1.5"><span className="text-emerald-500 font-bold">✓</span> Command Centre → project progress synced</div>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-2 text-slate-600 dark:text-slate-400 text-[11px]">
                  <div>• Materials: Cement 600 bags | Aggregate 48 m³ | Concrete {record.concreteVolume} m³ debited</div>
                  <div>• Delay Incident: Grader breakdown (2.5 hrs, repaired)</div>
                  <div>• Official Visitor: TANROADS RE at 10:20</div>
                  <div>• Contemporary Evidence: 18 geo-referenced photographs attached</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Synced to Daily Reports register & cloud archive
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Close
                </button>
                {onNavigateToTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowReportModal(false);
                      onNavigateToTab("daily-reports");
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <span>Open in Daily Reports</span>
                    <ChevronRight className="w-3.5 h-3.5" />
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
