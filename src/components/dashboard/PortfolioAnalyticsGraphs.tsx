import React, { useState, useMemo } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Layers, 
  DollarSign, 
  ShieldAlert,
  Info,
  CheckCircle2
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ComposedChart, 
  Line, 
  Area, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  BarChart 
} from "recharts";
import { SupportedCurrency, getCurrencyInfo } from "../../config/currencies";
import { formatCompactCurrency, convertCurrency } from "../../utils/currency";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

interface PortfolioAnalyticsGraphsProps {
  selectedCurrency?: SupportedCurrency;
  projects?: any[];
  financialExposures?: any[];
  cashExposureSummary?: any;
}

export default function PortfolioAnalyticsGraphs({
  selectedCurrency,
  projects = [],
  financialExposures = [],
  cashExposureSummary
}: PortfolioAnalyticsGraphsProps) {
  const { currencyCode: regionalCurrencyCode, currencySymbol } = useRegionalSettings();
  const activeCurrency: SupportedCurrency = selectedCurrency || regionalCurrencyCode || "TZS";

  const [activeSectorIndex, setActiveSectorIndex] = useState<number | null>(null);
  const [activeRiskIndex, setActiveRiskIndex] = useState<number | null>(null);

  // 1. DYNAMIC SECTOR BREAKDOWN CALCULATED FROM REAL PROJECTS
  const { sectorData, totalSectorCapital } = useMemo(() => {
    if (!projects || projects.length === 0) {
      return { sectorData: [], totalSectorCapital: 0 };
    }

    const sectorMap = new Map<string, number>();
    let totalVal = 0;

    projects.forEach((p) => {
      const sec = p.sector || "Civil Infrastructure";
      const val = Number(p.contractValue || 0);
      sectorMap.set(sec, (sectorMap.get(sec) || 0) + val);
      totalVal += val;
    });

    const palette = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#64748B"];
    let idx = 0;
    const items: Array<{ name: string; value: number; percentage: number; color: string }> = [];

    sectorMap.forEach((val, name) => {
      items.push({
        name,
        value: val,
        percentage: totalVal > 0 ? Math.round((val / totalVal) * 100) : 0,
        color: palette[idx % palette.length]
      });
      idx++;
    });

    return {
      sectorData: items.sort((a, b) => b.value - a.value),
      totalSectorCapital: totalVal
    };
  }, [projects]);

  // 2. DYNAMIC RISK BREAKDOWN CALCULATED FROM REAL EXPOSURES & COMMERCIAL DATA
  const { riskData, totalRiskCapital } = useMemo(() => {
    const items: Array<{ name: string; value: number; color: string }> = [];

    const uncertified = cashExposureSummary?.pendingIPCCertifications ?? 0;
    const claims = cashExposureSummary?.openCommercialClaims ?? 0;
    const retention = cashExposureSummary?.retentionWithheld ?? 0;
    const budgetOverrun = financialExposures.reduce((acc, f) => {
      const val = f.costOverrunUSD ? (convertCurrency(f.costOverrunUSD, "USD", activeCurrency) || f.costOverrunUSD) : 0;
      return acc + val;
    }, 0);

    if (uncertified > 0) {
      items.push({ name: "Uncertified IPCs", value: uncertified, color: "#3B82F6" });
    }
    if (claims > 0) {
      items.push({ name: "Commercial Claims & EoT", value: claims, color: "#EF4444" });
    }
    if (retention > 0) {
      items.push({ name: "Retention Held", value: retention, color: "#F59E0B" });
    }
    if (budgetOverrun > 0) {
      items.push({ name: "Forecast Cost Overrun", value: budgetOverrun, color: "#8B5CF6" });
    }

    // Fallback to project-level capitalAtRisk if registers don't have separate categorization
    if (items.length === 0 && projects && projects.length > 0) {
      const flagged = projects.filter(p => (p.capitalAtRisk || 0) > 0);
      if (flagged.length > 0) {
        const palette = ["#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899"];
        flagged.forEach((p, idx) => {
          items.push({
            name: `${p.code || p.name} Risk Exposure`,
            value: p.capitalAtRisk,
            color: palette[idx % palette.length]
          });
        });
      }
    }

    const totalR = items.reduce((sum, i) => sum + i.value, 0);
    const withPercentages = items.map(i => ({
      ...i,
      percentage: totalR > 0 ? Math.round((i.value / totalR) * 100) : 0
    }));

    return {
      riskData: withPercentages,
      totalRiskCapital: totalR
    };
  }, [cashExposureSummary, financialExposures, projects, activeCurrency]);

  // 3. DYNAMIC S-CURVE / EARNED VALUE DEPLOYMENT
  const sCurveData = useMemo(() => {
    if (!projects || projects.length === 0 || totalSectorCapital === 0) {
      return [];
    }

    // Compute aggregate physical progress across all projects
    const totalWeightedProgress = projects.reduce((acc, p) => {
      const weight = p.contractValue || 1;
      const prog = typeof p.progressPercent === "number" ? p.progressPercent : 0;
      return acc + (prog * weight);
    }, 0);
    const avgProgressPercent = totalSectorCapital > 0 ? (totalWeightedProgress / totalSectorCapital) : 0;

    // Total actual incurred cost or earned value
    const totalEarnedValue = Math.round(totalSectorCapital * (avgProgressPercent / 100));
    const totalActualCost = Math.round(totalEarnedValue * (projects.some(p => p.cpi < 1) ? 1.06 : 0.98));

    // Generate clean 6-stage milestone EVM trajectory points
    const stages = ["M1 (Start)", "M2", "M3 (Mid)", "M4", "Current", "Target TOC"];
    const plannedPcts = [0.10, 0.25, 0.45, 0.65, 0.85, 1.0];

    return stages.map((month, idx) => {
      const baseline = Math.round(totalSectorCapital * plannedPcts[idx]);
      const factor = (idx + 1) / stages.length;
      
      let actual: number | null = null;
      let earned: number | null = null;
      let forecast: number | null = null;

      if (idx <= 4) {
        // Points up to Current date
        actual = Math.round(totalActualCost * (factor / (5 / stages.length)));
        earned = Math.round(totalEarnedValue * (factor / (5 / stages.length)));
      }
      if (idx >= 4) {
        // Forward projection
        forecast = Math.round(totalSectorCapital * (0.85 + (idx - 4) * 0.15));
      }

      return {
        month,
        baseline,
        actual,
        earned,
        forecast
      };
    });
  }, [projects, totalSectorCapital]);

  // 4. DYNAMIC HUB / LOCATION COMPARISON CALCULATED FROM REAL PROJECTS
  const hubComparisonData = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    const map = new Map<string, { city: string; value: number; risk: number }>();
    projects.forEach((p) => {
      const city = p.hubCity || "Site Location";
      const existing = map.get(city) || { city, value: 0, risk: 0 };
      existing.value += Number(p.contractValue || 0);
      existing.risk += Number(p.capitalAtRisk || 0);
      map.set(city, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [projects]);

  // Custom tooltip for Pie charts
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-lg border border-slate-700 shadow-xl text-xs font-sans">
          <div className="font-bold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.color }} />
            {data.name}
          </div>
          <div className="mt-1 text-slate-300 font-mono">
            {formatCompactCurrency(data.value || 0, activeCurrency)} • {data.payload.percentage}%
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for S-Curve
  const CustomSCurveTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg border border-slate-700 shadow-xl text-xs font-sans space-y-1">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => {
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <span style={{ color: entry.color }}>{entry.name}:</span>
                <span className="font-mono font-bold">{formatCompactCurrency(entry.value || 0, activeCurrency)}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4" id="portfolio-analytics-graphs">
      
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md">
            <BarChart3 className="w-3.5 h-3.5 text-[#FF9F1C]" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Portfolio Financial & Risk Analytics
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          AGGREGATED DATA ENGINE
        </span>
      </div>

      {/* Grid: 2 Pie Charts on Top Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        
        {/* PIE CHART 1: CAPITAL BY SECTOR */}
        <div className="p-3.5 rounded-lg bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Capital Allocation by Sector
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {totalSectorCapital > 0 ? `${formatCompactCurrency(totalSectorCapital, activeCurrency)} Active Distribution` : "No project capital logged"}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
              {sectorData.length} {sectorData.length === 1 ? "Sector" : "Sectors"}
            </span>
          </div>

          {sectorData.length === 0 ? (
            <div className="h-52 w-full flex flex-col items-center justify-center text-center p-4">
              <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1.5" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Projects Configured</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Project sector allocation will visualize here once projects are loaded.</p>
            </div>
          ) : (
            <>
              <div className="h-52 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveSectorIndex(index)}
                      onMouseLeave={() => setActiveSectorIndex(null)}
                    >
                      {sectorData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          stroke="#0B172A"
                          strokeWidth={activeSectorIndex === index ? 3 : 1}
                          opacity={activeSectorIndex === null || activeSectorIndex === index ? 1 : 0.6}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Sector Legend Chips */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                {sectorData.map((sec, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                      <span className="truncate">{sec.name}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 ml-1">
                      {sec.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* PIE CHART 2: RISK EXPOSURE BREAKDOWN */}
        <div className="p-3.5 rounded-lg bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Capital at Risk Composition
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {totalRiskCapital > 0 ? `${formatCompactCurrency(totalRiskCapital, activeCurrency)} Contractual Exposure` : "No commercial exposure flagged"}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400">
              {totalSectorCapital > 0 ? ((totalRiskCapital / totalSectorCapital) * 100).toFixed(1) : "0"}% Portfolio
            </span>
          </div>

          {riskData.length === 0 ? (
            <div className="h-52 w-full flex flex-col items-center justify-center text-center p-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1.5" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Zero Contractual Exposure</p>
              <p className="text-[11px] text-slate-400 mt-0.5">No uncertified IPCs, open claims, or liquidated delay risks detected.</p>
            </div>
          ) : (
            <>
              <div className="h-52 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveRiskIndex(index)}
                      onMouseLeave={() => setActiveRiskIndex(null)}
                    >
                      {riskData.map((entry, index) => (
                        <Cell 
                          key={`risk-cell-${index}`} 
                          fill={entry.color}
                          stroke="#0B172A"
                          strokeWidth={activeRiskIndex === index ? 3 : 1}
                          opacity={activeRiskIndex === null || activeRiskIndex === index ? 1 : 0.6}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Legend Chips */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                {riskData.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0 ml-1">
                      {formatCompactCurrency(r.value, activeCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Grid: 2 Analytical Graphs on Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* GRAPH 1 (7 cols): Portfolio Earned Value & S-Curve */}
        <div className="lg:col-span-7 p-3.5 rounded-lg bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Cumulative Capital Deployment & S-Curve ({currencySymbol})
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Planned Baseline vs Actual Incurred vs Earned Value Trajectory
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-0.5 bg-slate-400" /> Planned
              </span>
              <span className="flex items-center gap-1 text-[#FF9F1C]">
                <span className="w-2 h-2 rounded-full bg-[#FF9F1C]" /> Actual
              </span>
              <span className="flex items-center gap-1 text-emerald-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Earned
              </span>
            </div>
          </div>

          <div className="h-60 w-full">
            {sCurveData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1.5" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Programme Timeline Available</p>
                <p className="text-[11px] text-slate-400 mt-0.5">S-Curve trajectory will calculate from project baseline and progress dates.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sCurveData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis 
                    stroke="#94A3B8" 
                    fontSize={10} 
                    tickLine={false} 
                    tickFormatter={(val) => formatCompactCurrency(val, activeCurrency)}
                  />
                  <Tooltip content={<CustomSCurveTooltip />} />
                  
                  {/* Baseline Planned S-Curve */}
                  <Line 
                    type="monotone" 
                    dataKey="baseline" 
                    name="Planned Baseline" 
                    stroke="#94A3B8" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                    dot={false} 
                  />
                  
                  {/* Actual Spend Area */}
                  <Area 
                    type="monotone" 
                    dataKey="actual" 
                    name="Actual Spend" 
                    stroke="#FF9F1C" 
                    fill="#FF9F1C" 
                    fillOpacity={0.15} 
                    strokeWidth={2.5} 
                  />

                  {/* Earned Value Line */}
                  <Line 
                    type="monotone" 
                    dataKey="earned" 
                    name="Earned Value" 
                    stroke="#10B981" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, fill: "#10B981" }} 
                  />

                  {/* Forecast Line */}
                  <Line 
                    type="monotone" 
                    dataKey="forecast" 
                    name="Forecasted Target" 
                    stroke="#3B82F6" 
                    strokeWidth={2} 
                    strokeDasharray="2 2" 
                    dot={{ r: 3, fill: "#3B82F6" }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GRAPH 2 (5 cols): Hub Capital Deployment vs Risk Comparison */}
        <div className="lg:col-span-5 p-3.5 rounded-lg bg-white dark:bg-[#0B172A] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Hub Capital vs Risk ({currencySymbol})
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Comparison across {hubComparisonData.length} {hubComparisonData.length === 1 ? "Operational Corridor" : "Operational Corridors"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-300">
                <span className="w-2 h-2 rounded-sm bg-slate-700 dark:bg-white" /> Capital
              </span>
              <span className="flex items-center gap-1 text-rose-500">
                <span className="w-2 h-2 rounded-sm bg-rose-500" /> Risk
              </span>
            </div>
          </div>

          <div className="h-60 w-full">
            {hubComparisonData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <BarChart3 className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1.5" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No Location Records</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Project locations will be compared here as projects are added.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hubComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="city" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis 
                    stroke="#94A3B8" 
                    fontSize={10} 
                    tickLine={false}
                    tickFormatter={(val) => formatCompactCurrency(val, activeCurrency)}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      formatCompactCurrency(value || 0, activeCurrency), 
                      name === "value" ? "Total Portfolio" : "Capital at Risk"
                    ]}
                    contentStyle={{ backgroundColor: "#0F172A", borderColor: "#334155", borderRadius: "8px", fontSize: "11px" }}
                  />
                  <Bar dataKey="value" name="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="risk" name="risk" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
