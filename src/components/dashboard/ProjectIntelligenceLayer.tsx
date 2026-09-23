import React, { useState } from "react";
import { 
  Building2, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  FileText, 
  ShieldAlert, 
  Compass, 
  Layers, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Coins,
  Send
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { REGIONAL_HUBS, RegionalHub, InfrastructureProject } from "../../data/globalPortfolioData";
import { SupportedCurrency } from "../../config/currencies";

interface ProjectIntelligenceLayerProps {
  hubId: string;
  selectedCurrency?: SupportedCurrency | string;
  onSelectProject?: (proj: InfrastructureProject) => void;
}

export default function ProjectIntelligenceLayer({
  hubId,
  selectedCurrency,
  onSelectProject
}: ProjectIntelligenceLayerProps) {
  const navigate = useNavigate();
  const hub: RegionalHub = REGIONAL_HUBS.find(h => h.id === hubId) || REGIONAL_HUBS[0];
  const [selectedProjectId, setSelectedProjectId] = useState<string>(hub.projects[0]?.id || "");
  const [noticeDispatched, setNoticeDispatched] = useState<string | null>(null);

  const activeProject = hub.projects.find(p => p.id === selectedProjectId) || hub.projects[0];

  const handleDispatchNotice = (title: string) => {
    setNoticeDispatched(title);
    setTimeout(() => {
      setNoticeDispatched(null);
    }, 4000);
  };

  return (
    <div className="bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6 animate-fadeIn" id="project-intelligence-layer">
      
      {/* Hub Dossier Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#0B172A] dark:bg-white text-white dark:text-[#0B172A] text-[10px] font-semibold uppercase tracking-wider rounded-md">
              Project Intelligence Layer
            </span>
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold uppercase tracking-wider rounded-md border border-amber-500/20">
              {hub.region}
            </span>
            <span className="text-xs text-[#667085] dark:text-slate-400 font-mono">
              HUB CODE: {hub.countryCode}-{hub.city.toUpperCase().slice(0, 3)}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold text-[#172033] dark:text-white tracking-tight">
            {hub.city} Regional Infrastructure Portfolio
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 max-w-2xl leading-relaxed">
            Multinational programme telemetry, FIDIC contractual notice matrices, and real-time execution oversight.
          </p>
        </div>

        {/* Executive Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate(`/project-advisor?prompt=Provide%20comprehensive%20risk%20and%20delay%20audit%20for%20${hub.city}%20infrastructure%20packages`)}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-[#0B172A] font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-[#0B172A]" />
            <span>Consult Matrix Advisor</span>
          </button>
          
          <button
            onClick={() => navigate("/programme")}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F7F8FA] hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-[#E6E9EF] dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Programme of Works</span>
          </button>
        </div>
      </div>

      {/* Hub High-Level Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-[#F7F8FA] dark:bg-slate-900/60 border border-[#E6E9EF] dark:border-slate-800">
          <span className="text-xs text-[#667085] font-medium">Hub Capital Value</span>
          <p className="text-lg font-bold text-[#172033] dark:text-white font-mono mt-0.5">{hub.portfolioValueFormatted}</p>
          <span className="text-xs text-[#667085]">{hub.projects.length} Major Active Packages</span>
        </div>

        <div className="p-3 rounded-xl bg-[#F7F8FA] dark:bg-slate-900/60 border border-[#E6E9EF] dark:border-slate-800">
          <span className="text-xs text-[#667085] font-medium">Performance Index</span>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{hub.performanceScore}%</p>
          <span className="text-xs text-[#667085]">Composite SPI 0.98</span>
        </div>

        <div className="p-3 rounded-xl bg-[#F7F8FA] dark:bg-slate-900/60 border border-[#E6E9EF] dark:border-slate-800">
          <span className="text-xs text-[#667085] font-medium">Capital at Stake</span>
          <p className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">{hub.capitalAtRiskFormatted}</p>
          <span className="text-xs text-[#667085]">{hub.criticalInterventions} Critical Actions</span>
        </div>

        <div className="p-3 rounded-xl bg-[#F7F8FA] dark:bg-slate-900/60 border border-[#E6E9EF] dark:border-slate-800">
          <span className="text-xs text-[#667085] font-medium">Regional Directorate</span>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-1">{hub.leadDirector}</p>
          <span className="text-xs text-[#667085] truncate block">{hub.headquarters}</span>
        </div>
      </div>

      {/* Main Intelligence Grid: Package Selector on Left, Deep Telemetry on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column (5 cols): Active Infrastructure Packages in this Hub */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#667085] dark:text-slate-400">
              Active Packages in {hub.city} ({hub.projects.length})
            </h3>
            <span className="text-xs text-[#667085] font-mono">Select for Drilldown</span>
          </div>

          <div className="space-y-2.5">
            {hub.projects.map((proj) => {
              const isSelected = proj.id === activeProject?.id;
              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    setSelectedProjectId(proj.id);
                    onSelectProject?.(proj);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#F7F8FA] dark:bg-slate-800 border-[#0B172A] dark:border-white shadow-xs"
                      : "bg-[#F7F8FA]/70 dark:bg-slate-900/40 border-[#E6E9EF] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {proj.code}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          proj.status === "On Track"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                        }`}>
                          {proj.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-[#172033] dark:text-white leading-tight">
                        {proj.name}
                      </h4>
                      <p className="text-xs text-[#667085] dark:text-slate-400 truncate">
                        Client: {proj.client}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold font-mono text-[#172033] dark:text-white">
                        ${(proj.contractValue / 1000000).toFixed(0)}M
                      </span>
                      <span className="text-xs text-[#667085] block font-mono">
                        {proj.localValue}
                      </span>
                    </div>
                  </div>

                  {/* Progress Mini Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-[#667085]">Progress vs Target:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {proj.progressPercent}% / {proj.targetPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          proj.progressPercent >= proj.targetPercent ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, proj.progressPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (7 cols): Selected Package Telemetry & Predictive Risk Matrix */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Active Package Deep Dive Card */}
          {activeProject && (
            <div className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-900/60 border border-[#E6E9EF] dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6E9EF] dark:border-slate-800 pb-3">
                <div>
                  <span className="text-xs text-[#667085] font-medium">
                    Detailed Package Telemetry
                  </span>
                  <h3 className="text-sm font-semibold text-[#172033] dark:text-white mt-0.5">
                    {activeProject.name}
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono self-start sm:self-auto">
                  {activeProject.contractType}
                </span>
              </div>

              {/* 4-Stat Grid for this package */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800">
                  <span className="text-xs text-[#667085]">Schedule Index</span>
                  <p className="text-sm font-semibold font-mono text-[#172033] dark:text-white mt-0.5">SPI {activeProject.spi}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800">
                  <span className="text-xs text-[#667085]">Cost Index</span>
                  <p className="text-sm font-semibold font-mono text-[#172033] dark:text-white mt-0.5">CPI {activeProject.cpi}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800">
                  <span className="text-xs text-[#667085]">Capital at Stake</span>
                  <p className="text-sm font-semibold font-mono text-rose-600 dark:text-rose-400 mt-0.5">${(activeProject.capitalAtRisk / 1000000).toFixed(0)}M</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800">
                  <span className="text-xs text-[#667085]">Active Risks</span>
                  <p className="text-sm font-semibold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{activeProject.activeRisksCount} Items</p>
                </div>
              </div>

              {/* Critical Path Activity */}
              <div className="p-3 rounded-lg bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#667085]">Critical Path Activity:</span>
                  <span className="text-rose-600 dark:text-rose-400">Pivotal Focus</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {activeProject.criticalActivity}
                </p>
                <div className="pt-1.5 flex items-center justify-between text-xs text-[#667085] border-t border-slate-100 dark:border-slate-800">
                  <span>Latest Certified Milestone:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{activeProject.latestMilestone}</span>
                </div>
              </div>

              {/* Project Lead & One-Click Navigation */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#667085]">
                  Lead PM: <strong className="text-slate-700 dark:text-slate-300">{activeProject.projectManager}</strong>
                </span>
                <button
                  onClick={() => navigate("/boq")}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  <span>Inspect Bill of Quantities</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Regional Risk Factors & Sentinel Warnings */}
          <div className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-900/60 border border-[#E6E9EF] dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#667085] dark:text-slate-400">
                {hub.city} Geotechnical & Supply Chain Risk Sentinel
              </h4>
              <span className="text-xs text-[#667085] font-mono">FIDIC / NEC3 Baseline</span>
            </div>

            <div className="space-y-2">
              {hub.riskFactors.map((risk, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-lg bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#172033] dark:text-white flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        risk.severity === "high" ? "bg-rose-500" : "bg-amber-500"
                      }`} />
                      {risk.title}
                    </span>
                    <button
                      onClick={() => handleDispatchNotice(risk.title)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-0.5 rounded bg-[#F7F8FA] dark:bg-slate-800 border border-[#E6E9EF] dark:border-slate-700 cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-2.5 h-2.5" />
                      <span>Issue Notice</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#667085] dark:text-slate-400">
                    {risk.impact}
                  </p>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Mitigation: {risk.mitigation}
                  </div>
                </div>
              ))}
            </div>

            {noticeDispatched && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" />
                <span>Commercial Preservation Notice logged for: {noticeDispatched}</span>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
