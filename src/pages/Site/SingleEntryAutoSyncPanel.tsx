import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Layers,
  Calendar,
  Users,
  Truck,
  Package,
  TrendingUp,
  LayoutDashboard,
  Cpu,
  Edit3,
  Camera,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  X,
  FileCheck,
  Zap
} from "lucide-react";

export interface SiteRecordEntry {
  activity: string;
  location: string;
  quantity: number;
  unit: string;
  concreteVolume: number;
  concreteUnit: string;
  crew: string;
  crewWorkers: number;
  plant: string;
  photosCount: number;
}

interface SingleEntryAutoSyncPanelProps {
  onNavigateToTab?: (tab: string) => void;
  record?: SiteRecordEntry;
  onUpdateRecord?: (newRecord: SiteRecordEntry) => void;
}

export default function SingleEntryAutoSyncPanel({
  onNavigateToTab,
  record: propRecord,
  onUpdateRecord
}: SingleEntryAutoSyncPanelProps) {
  // Default single record as requested by engineer
  const [record, setRecord] = useState<SiteRecordEntry>(propRecord || {
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
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<SiteRecordEntry>(record);
  const [justSynced, setJustSynced] = useState(false);

  const handleSaveEdit = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Site/SingleEntryAutoSyncPanel.tsx");
    e.preventDefault();
    setRecord(editForm);
    if (onUpdateRecord) {
      onUpdateRecord(editForm);
    }
    setIsEditing(false);
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 2500);
  };

  // Calculations dynamically driven by the single entry
  const ratePerM = 260; // $260 per linear meter of concrete pavement
  const earnedValue = (record.quantity * ratePerM).toLocaleString();
  const manHours = record.crewWorkers * 8; // 8 hr shift
  const cementBagsConsumed = Math.round(record.concreteVolume * 6.8); // standard C35/20 mix factor

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Single Entry Auto-Sync Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Engineers enter data once. Project Matrix automatically propagates to all 8 operational domains.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>1 Entry Recorded · 8 Modules Auto-Updated</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setEditForm(record);
              setIsEditing(true);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Edit Entry</span>
          </button>
        </div>
      </div>

      {/* The Single Source of Truth Entry Summary Strip */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-950/20">
        <div className="text-[11px] font-black text-blue-950 dark:text-blue-200 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Single Source of Truth Record (Field Entry)
          </span>
          {justSynced && (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse text-xs">
              ✓ Synchronized across all 8 modules!
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Activity</span>
            <span className="font-bold text-slate-900 dark:text-white truncate block">{record.activity}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Location</span>
            <span className="font-mono font-bold text-blue-700 dark:text-blue-300 truncate block">{record.location}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Quantity</span>
            <span className="font-bold text-slate-900 dark:text-white block">
              {record.quantity} {record.unit}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Concrete</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300 block">
              {record.concreteVolume} {record.concreteUnit}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Crew</span>
            <span className="font-bold text-slate-900 dark:text-white truncate block">
              {record.crew} — {record.crewWorkers} workers
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Plant</span>
            <span className="font-bold text-slate-900 dark:text-white truncate block">
              {record.plant}
            </span>
          </div>

          <div
            onClick={() => onNavigateToTab?.("progress-evidence")}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 col-span-2 sm:col-span-1 hover:border-purple-400 dark:hover:border-purple-500 cursor-pointer group transition-all"
            title="Open Construction Photographic Register"
          >
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
              <span>Evidence</span>
              <span className="text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform text-[9px] font-bold">View →</span>
            </span>
            <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              {record.photosCount} Photos
            </span>
          </div>
        </div>
      </div>

      {/* The 8 Automatically Synchronized Modules */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Automated Cross-Module Propagation Matrix
          </h4>
          <span className="text-[11px] text-slate-500 font-semibold">
            0 duplicate forms required
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Site Operations */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  1. Site Operations
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Auto-Synced
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">
              → {record.quantity} m completed
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Live workfront log, shift target rate (90%) and digital site diary reconciled instantaneously.
            </p>
          </div>

          {/* 2. Programme */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  2. Programme
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Auto-Synced
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">
              → Activity progress updated
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Gantt activity #ACT-041 advance recorded; critical path float dynamically recalculated.
            </p>
          </div>

          {/* 3. Resources */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  3. Resources
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Auto-Synced
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">
              → Workforce utilisation
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {record.crewWorkers} operatives ({record.crew}) mapped; {manHours} man-hours debited to payroll timesheet.
            </p>
          </div>

          {/* 4. Plant */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  4. Plant
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Auto-Synced
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">
              → Operating hours/utilisation
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {record.plant} operating telemetry logged; diesel burn & maintenance cycle logged.
            </p>
          </div>

          {/* 5. Materials */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  5. Materials
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Auto-Synced
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">
              → Concrete consumption
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {record.concreteVolume} m³ concrete consumed (~{cementBagsConsumed} bags equivalent) deducted from batch plant silo.
            </p>
          </div>

          {/* 6. Commercial */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  6. Commercial
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Auto-Synced
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">
              → Quantity/earned value
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              BOQ item certified: {record.quantity} m @ ${ratePerM} = ${earnedValue} added to next payment certificate.
            </p>
          </div>

          {/* 7. Project Overview */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  7. Project Overview
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Auto-Synced
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">
              → Physical progress
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Overall corridor physical completion incremented (+0.18%); milestone curves updated.
            </p>
          </div>

          {/* 8. Command Centre */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  8. Command Centre
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Auto-Synced
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">
              → Project progress
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Multi-project executive KPI, contractor burn-rate and executive portfolio health live-synced.
            </p>
          </div>
        </div>
      </div>

      {/* EDIT SINGLE ENTRY MODAL */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Edit Shift Workfront Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <p className="text-slate-500">
                Update this single record once. Project Matrix will immediately recompute and propagate the changes to all 8 modules.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Activity
                  </label>
                  <input
                    type="text"
                    value={editForm.activity}
                    onChange={(e) => setEditForm({ ...editForm, activity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Location (Chainage)
                  </label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity (Linear Meters)
                  </label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Concrete Volume (m³)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.concreteVolume}
                    onChange={(e) => setEditForm({ ...editForm, concreteVolume: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Crew & Workers
                  </label>
                  <input
                    type="text"
                    value={`${editForm.crew} — ${editForm.crewWorkers} workers`}
                    onChange={(e) => {
                      const match = e.target.value.match(/(\d+)\s*workers?/i);
                      const workers = match ? parseInt(match[1]) : editForm.crewWorkers;
                      setEditForm({ ...editForm, crewWorkers: workers });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Plant Deployed
                  </label>
                  <input
                    type="text"
                    value={editForm.plant}
                    onChange={(e) => setEditForm({ ...editForm, plant: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Photographs Captured
                  </label>
                  <input
                    type="number"
                    value={editForm.photosCount}
                    onChange={(e) => setEditForm({ ...editForm, photosCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Saving will trigger auto-update across Site Operations, Programme, Resources, Plant, Materials, Commercial, Project Overview, and Command Centre.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition-all"
                >
                  Save & Auto-Propagate (8 Modules)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
