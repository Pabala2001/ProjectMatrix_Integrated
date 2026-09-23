import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Check, 
  Sliders, 
  Building2, 
  Layers, 
  CheckCircle2, 
  UserCheck, 
  Award, 
  Briefcase, 
  ShieldCheck, 
  RotateCcw,
  Sparkles,
  Info
} from "lucide-react";
import { 
  MASTER_ENGINEERING_DISCIPLINES 
} from "../../data/engineeringData";
import { 
  EngineeringDisciplineId, 
  ProjectDisciplineConfig 
} from "../../types/engineering";

interface DisciplinesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ProjectDisciplineConfig;
  onSaveConfig: (updatedConfig: ProjectDisciplineConfig) => void;
  projectName: string;
}

export default function DisciplinesConfigModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  projectName
}: DisciplinesConfigModalProps) {
  const [activeIds, setActiveIds] = useState<EngineeringDisciplineId[]>(config.activeDisciplineIds);
  const [leadEngineers, setLeadEngineers] = useState(config.leadEngineers);
  const [activeCategoryTab, setActiveCategoryTab] = useState<"all" | "heavy_civil" | "building" | "systems" | "specialist">("all");
  const [selectedDisciplineForLead, setSelectedDisciplineForLead] = useState<EngineeringDisciplineId | null>(null);

  const toggleDiscipline = (id: EngineeringDisciplineId) => {
    setActiveIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one discipline active
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleApplyPreset = (preset: "road" | "building" | "rail" | "industrial" | "all") => {
    if (preset === "road") {
      setActiveIds(["civil", "roads_pavements", "drainage", "structural", "geotechnical", "electrical", "utilities", "survey_geospatial"]);
    } else if (preset === "building") {
      setActiveIds(["civil", "structural", "geotechnical", "architecture", "mechanical", "electrical", "drainage", "water", "survey_geospatial"]);
    } else if (preset === "rail") {
      setActiveIds(["civil", "structural", "rail", "geotechnical", "electrical", "instrumentation", "drainage", "utilities", "survey_geospatial"]);
    } else if (preset === "industrial") {
      setActiveIds(["civil", "structural", "water", "mechanical", "electrical", "instrumentation", "utilities", "survey_geospatial"]);
    } else if (preset === "all") {
      setActiveIds(MASTER_ENGINEERING_DISCIPLINES.map(d => d.id));
    }
  };

  const handleSave = () => {
    assertOperationalAction("write", "components/engineering/DisciplinesConfigModal.tsx");
    onSaveConfig({
      ...config,
      activeDisciplineIds: activeIds,
      leadEngineers: leadEngineers
    });
    onClose();
  };

  const filteredDisciplines = activeCategoryTab === "all" 
    ? MASTER_ENGINEERING_DISCIPLINES 
    : MASTER_ENGINEERING_DISCIPLINES.filter(d => d.category === activeCategoryTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  Configure Project Engineering Disciplines
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
                  {activeIds.length} of {MASTER_ENGINEERING_DISCIPLINES.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Tailor visible engineering disciplines specifically for <span className="font-bold text-white">{projectName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Quick Template Presets:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => handleApplyPreset("road")}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Road & Highway
            </button>
            <button
              onClick={() => handleApplyPreset("building")}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Building & Facilities
            </button>
            <button
              onClick={() => handleApplyPreset("rail")}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Rail & Metro
            </button>
            <button
              onClick={() => handleApplyPreset("industrial")}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Water & Industrial
            </button>
            <button
              onClick={() => handleApplyPreset("all")}
              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              Select All (13)
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 bg-white dark:bg-slate-900">
          {(["all", "heavy_civil", "building", "systems", "specialist"] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategoryTab(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-colors cursor-pointer whitespace-nowrap ${
                activeCategoryTab === cat
                  ? "bg-slate-900 dark:bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat === "all" ? "All Disciplines" : cat.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Disciplines Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredDisciplines.map(discipline => {
              const isActive = activeIds.includes(discipline.id);
              const lead = leadEngineers[discipline.id];

              return (
                <div
                  key={discipline.id}
                  onClick={() => toggleDiscipline(discipline.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                    isActive
                      ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 shadow-xs"
                      : "bg-slate-50/50 dark:bg-slate-850/50 border-slate-200 dark:border-slate-800 opacity-65 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : "border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-transparent"
                        }`}>
                          {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                              {discipline.name}
                            </h4>
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                              {discipline.code}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 capitalize font-medium">
                            {discipline.category.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {discipline.description}
                    </p>

                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {discipline.typicalDeliverables.slice(0, 2).map((del, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300 rounded-md font-medium"
                        >
                          {del}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Appointed Lead Engineer Strip */}
                  {lead && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDisciplineForLead(discipline.id);
                      }}
                      className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-medium truncate">{lead.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {lead.registrationNumber}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Only activated disciplines will appear in the project's engineering register, RFIs, and submittals.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Discipline Configuration</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
