import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, 
  ShieldAlert, 
  ArrowRight, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Filter, 
  Search,
  DollarSign,
  Layers,
  Sparkles,
  MapPin,
  TrendingDown,
  Building2
} from "lucide-react";
import { REGIONAL_HUBS, InfrastructureProject } from "../../data/globalPortfolioData";
import { useNavigate } from "react-router-dom";

export interface CriticalProjectsCardProps {
  onSelectProject?: (projectId: string) => void;
  onOpenProjectIntelligence?: (hubId: string) => void;
}

export default function CriticalProjectsCard({
  onSelectProject,
  onOpenProjectIntelligence
}: CriticalProjectsCardProps) {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<"ALL" | "INTERVENTION" | "MONITOR">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Flatten all projects from hubs and filter for distressed/monitored
  const allCriticalProjects = useMemo(() => {
    const list: (InfrastructureProject & { hubCity: string; countryCode: string; hubId: string })[] = [];
    REGIONAL_HUBS.forEach((hub) => {
      hub.projects.forEach((p) => {
        if (p.status === "Immediate Intervention" || p.status === "Critical Path Monitor" || p.spi < 0.98 || p.capitalAtRisk > 20000000) {
          list.push({
            ...p,
            hubCity: hub.city,
            countryCode: hub.countryCode,
            hubId: hub.id
          });
        }
      });
    });
    return list.sort((a, b) => (b.capitalAtRisk || 0) - (a.capitalAtRisk || 0));
  }, []);

  const filteredProjects = useMemo(() => {
    return allCriticalProjects.filter((p) => {
      if (filterStatus === "INTERVENTION" && p.status !== "Immediate Intervention") return false;
      if (filterStatus === "MONITOR" && p.status !== "Critical Path Monitor") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.hubCity.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allCriticalProjects, filterStatus, searchQuery]);

  const handleQuickAction = (projName: string, actionType: string) => {
    setActionSuccessMsg(`Intervention triggered for ${projName}: "${actionType}" notice dispatched.`);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  return (
    <div id="critical-projects-exploration-card" className="bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <h3 className="text-base font-semibold text-[#172033] dark:text-white tracking-tight">
              Critical Projects Watchlist & Intervention Queue
            </h3>
            <span className="text-xs font-semibold text-[#667085] dark:text-slate-400 font-mono">
              ({filteredProjects.length} Active Packages)
            </span>
          </div>
          <p className="text-xs text-[#667085] dark:text-slate-400 mt-1 max-w-2xl">
            Distressed and high-exposure packages requiring contractual notices, acceleration orders, or client liaison.
          </p>
        </div>

        {/* Filter Controls (Segmented Control) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#F7F8FA] dark:bg-slate-800 p-1 rounded-xl border border-[#E6E9EF] dark:border-slate-700 text-xs">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === "ALL"
                  ? "bg-white dark:bg-slate-700 text-[#172033] dark:text-white shadow-2xs"
                  : "text-[#667085] hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              All ({allCriticalProjects.length})
            </button>
            <button
              onClick={() => setFilterStatus("INTERVENTION")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === "INTERVENTION"
                  ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs font-bold"
                  : "text-[#667085] hover:text-rose-600"
              }`}
            >
              Immediate (2)
            </button>
            <button
              onClick={() => setFilterStatus("MONITOR")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === "MONITOR"
                  ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs font-bold"
                  : "text-[#667085] hover:text-amber-600"
              }`}
            >
              Monitored (3)
            </button>
          </div>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">×</button>
        </div>
      )}

      {/* Projects List Grid */}
      <div className="space-y-3">
        {filteredProjects.map((p) => {
          const isImmediate = p.status === "Immediate Intervention";
          const progressGap = (p.targetPercent - p.progressPercent).toFixed(1);
          return (
            <div
              key={p.id}
              className={`p-4 rounded-xl border transition-all ${
                isImmediate
                  ? "bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/60 hover:border-rose-300"
                  : "bg-slate-50/50 dark:bg-slate-850/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Code, Name, Client */}
                <div className="space-y-1 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#667085] dark:text-slate-400">
                      {p.code}
                    </span>
                    <span className="text-[#667085] dark:text-slate-600">•</span>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                      isImmediate
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        : "bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                    }`}>
                      {p.status}
                    </span>
                    <span className="text-[#667085] dark:text-slate-600">•</span>
                    <span className="text-xs text-[#667085] dark:text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {p.hubCity} ({p.countryCode})
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {p.name}
                  </h4>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Client: <strong className="text-slate-700 dark:text-slate-300">{p.client}</strong> • Contract: {p.contractType}
                  </p>

                  <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 mt-2 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span><strong>Critical Path Bottleneck:</strong> {p.criticalActivity}</span>
                  </div>
                </div>

                {/* Right: Metrics & Actions */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 self-start lg:self-center">
                  <div className="grid grid-cols-3 gap-2.5 text-center min-w-[240px]">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Progress</span>
                      <div className="font-mono text-xs font-black text-slate-900 dark:text-white">{p.progressPercent}%</div>
                      <span className="text-[9px] text-rose-500 font-semibold">-{progressGap}% lag</span>
                    </div>

                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">SPI / CPI</span>
                      <div className="font-mono text-xs font-black text-slate-900 dark:text-white">{p.spi} / {p.cpi}</div>
                      <span className="text-[9px] text-slate-500 font-semibold">{p.spi < 1 ? "Behind" : "On Plan"}</span>
                    </div>

                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Risk Exposure</span>
                      <div className="font-mono text-xs font-black text-rose-600 dark:text-rose-400">${(p.capitalAtRisk / 1000000).toFixed(0)}M</div>
                      <span className="text-[9px] text-slate-400">{p.activeRisksCount} Active</span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col gap-1.5 min-w-[140px]">
                    <button
                      onClick={() => handleQuickAction(p.name, "FIDIC Cl. 1.9 Acceleration Order")}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Take Action</span>
                    </button>
                    {onOpenProjectIntelligence && (
                      <button
                        onClick={() => onOpenProjectIntelligence(p.hubId)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Drill Down</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
