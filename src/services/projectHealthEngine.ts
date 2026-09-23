import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
/**
 * Project Health Scoring Service
 * 
 * Implements transparent, multi-dimensional health scoring based on:
 * - Schedule Performance (SPI, milestone variance, critical path)
 * - Cost Performance (CPI, earned value variance)
 * - Cashflow & Certification Flow (outstanding IPCs, cash calls, payment velocity)
 * - Commercial & Margin Integrity (forecast margin vs tender, claim exposure)
 * - Risk & Environmental Exposure (geotechnical, weather, regulatory risks)
 * - HSE Performance (safety audits, LTIFR, incident-free days)
 * - Quality & QA/QC Compliance (NCRs, test pass rates, snagging)
 * 
 * Standard Default Formulation:
 * healthScore =
 *   scheduleScore * 0.25 +
 *   costScore * 0.20 +
 *   cashflowScore * 0.15 +
 *   commercialScore * 0.15 +
 *   riskScore * 0.10 +
 *   hseScore * 0.05 +
 *   qualityScore * 0.10;
 * 
 * Classification:
 * - 90–100: Healthy (Low fiduciary risk, executing within tolerance)
 * - 75–89:  Stable (Minor operational friction, monitor milestones)
 * - 60–74:  At Risk (Intervention required on schedule or commercial claims)
 * - <60:    Critical (Executive intervention, urgent capital or legal relief)
 */

export type HealthClassification = "Healthy" | "Stable" | "At Risk" | "Critical";

export interface HealthWeightsConfig {
  schedule: number;   // default 0.25
  cost: number;       // default 0.20
  cashflow: number;   // default 0.15
  commercial: number; // default 0.15
  risk: number;       // default 0.10
  hse: number;        // default 0.05
  quality: number;    // default 0.10
}

export const DEFAULT_HEALTH_WEIGHTS: HealthWeightsConfig = {
  schedule: 0.25,
  cost: 0.20,
  cashflow: 0.15,
  commercial: 0.15,
  risk: 0.10,
  hse: 0.05,
  quality: 0.10,
};

export interface HealthPreset {
  id: string;
  name: string;
  description: string;
  weights: HealthWeightsConfig;
}

export const HEALTH_WEIGHT_PRESETS: HealthPreset[] = [
  {
    id: "standard-epc",
    name: "Standard FIDIC/EPC Balanced",
    description: "Standard balanced weighting prioritizing schedule (25%), cost (20%), and commercial cashflow (30%).",
    weights: { ...DEFAULT_HEALTH_WEIGHTS }
  },
  {
    id: "cashflow-strict",
    name: "Cashflow & Liquidity First",
    description: "Emphasizes working capital, IPC certification velocity, and commercial margin preservation.",
    weights: {
      schedule: 0.15,
      cost: 0.20,
      cashflow: 0.30,
      commercial: 0.20,
      risk: 0.05,
      hse: 0.05,
      quality: 0.05
    }
  },
  {
    id: "schedule-critical",
    name: "Fast-Track / Schedule Driven",
    description: "Designed for milestone-critical infrastructure with hefty delay liquidated damages.",
    weights: {
      schedule: 0.40,
      cost: 0.15,
      cashflow: 0.10,
      commercial: 0.10,
      risk: 0.10,
      hse: 0.05,
      quality: 0.10
    }
  },
  {
    id: "hse-qa-stringent",
    name: "HSE & Quality High-Consequence",
    description: "Prioritizes safety audits, zero-harm LTIFR, and ISO/QA non-conformance remediation.",
    weights: {
      schedule: 0.15,
      cost: 0.15,
      cashflow: 0.10,
      commercial: 0.10,
      risk: 0.15,
      hse: 0.20,
      quality: 0.15
    }
  }
];

export interface PillarDiagnostic {
  key: keyof HealthWeightsConfig;
  label: string;
  rawScore: number;       // 0 to 100
  weight: number;         // 0 to 1.0
  weightedScore: number;  // rawScore * weight
  status: HealthClassification;
  benchmark: string;
  primaryDriver: string;
}

export interface ProjectHealthMetricsInput {
  spi?: number | null;                          // Schedule Performance Index (e.g. 0.86)
  cpi?: number | null;                          // Cost Performance Index (e.g. 0.94)
  progressPercent?: number | null;              // Actual progress % (e.g. 46.2)
  targetPercent?: number | null;                // Planned progress % (e.g. 54.0)
  forecastMarginPercent?: number | null;        // Forecast margin at completion (e.g. 8.2)
  tenderMarginPercent?: number | null;          // Target tender margin (e.g. 14.5)
  outstandingCertificationUSD?: number | null;  // Uncertified IPCs
  contractValueUSD?: number | null;             // Total contract sum
  cashRequirementUSD?: number | null;           // 30-day net working capital
  openCriticalRisksCount?: number | null;       // Number of severe unmitigated risks
  openNCRsCount?: number | null;                // Open Non-Conformance Reports
  qaTestPassRatePercent?: number | null;        // Material QA/QC compaction/cube pass rate (0-100)
  lostTimeInjuryCount?: number | null;          // Lost Time Injuries
  safetyAuditScorePercent?: number | null;      // HSE site safety audit score (0-100)
  claimsUnderAssessmentUSD?: number | null;     // Value of pending EOT / cost claims
}

export interface HealthScoreResult {
  totalScore: number;                   // 0 - 100 (rounded)
  exactScore: number;                   // Float representation
  classification: HealthClassification; // "Healthy" | "Stable" | "At Risk" | "Critical"
  badgeColorClass: string;              // Tailwind colors
  textColorClass: string;
  bgLightClass: string;
  borderClass: string;
  pillars: PillarDiagnostic[];
  topRiskPillar: PillarDiagnostic;
  topPerformingPillar: PillarDiagnostic;
  recommendedAction: string;
  weightsUsed: HealthWeightsConfig;
}

/**
 * Calculate the Individual Pillar Raw Scores (0 - 100) from engineering telemetry.
 * Returns null for pillars where no valid source data exists.
 */
export function calculatePillarScores(metrics: ProjectHealthMetricsInput): Record<keyof HealthWeightsConfig, number | null> {
  // 1. Schedule Score (0 - 100)
  let scheduleScore: number | null = null;
  const hasSpi = metrics.spi !== undefined && metrics.spi !== null && !isNaN(metrics.spi);
  const hasProgress = metrics.progressPercent !== undefined && metrics.progressPercent !== null && !isNaN(metrics.progressPercent);
  
  if (hasSpi || hasProgress) {
    const spiVal = hasSpi ? metrics.spi! : 1.0;
    const spiRatio = Math.max(0, Math.min(spiVal, 1.25));
    const targetVal = metrics.targetPercent !== undefined && metrics.targetPercent !== null ? metrics.targetPercent : (metrics.progressPercent || 0);
    const progressGap = hasProgress ? (metrics.progressPercent! - targetVal) : 0;
    let sScore = (spiRatio / 1.0) * 80 + (progressGap >= 0 ? 20 : Math.max(-30, progressGap * 2.5));
    scheduleScore = Math.max(10, Math.min(100, Math.round(sScore)));
  }

  // 2. Cost Score (0 - 100)
  let costScore: number | null = null;
  if (metrics.cpi !== undefined && metrics.cpi !== null && !isNaN(metrics.cpi)) {
    const cpiRatio = Math.max(0, Math.min(metrics.cpi, 1.25));
    let cScore = (cpiRatio / 1.0) * 85;
    if (metrics.cpi >= 1.0) cScore += 15;
    else if (metrics.cpi < 0.9) cScore -= 15;
    costScore = Math.max(10, Math.min(100, Math.round(cScore)));
  }

  // 3. Cashflow & Certification Score (0 - 100)
  let cashflowScore: number | null = null;
  const hasCert = metrics.outstandingCertificationUSD !== undefined && metrics.outstandingCertificationUSD !== null;
  const hasCash = metrics.cashRequirementUSD !== undefined && metrics.cashRequirementUSD !== null;
  const contractVal = (metrics.contractValueUSD !== undefined && metrics.contractValueUSD !== null && metrics.contractValueUSD > 0) ? metrics.contractValueUSD : 0;

  if (hasCert || hasCash) {
    const outstandingRatio = contractVal > 0 && hasCert ? (metrics.outstandingCertificationUSD! / contractVal) : 0;
    let cfScore = 95 - (outstandingRatio * 400);
    const cashDemandRatio = contractVal > 0 && hasCash ? (metrics.cashRequirementUSD! / contractVal) : 0;
    if (cashDemandRatio > 0.05) cfScore -= 15;
    cashflowScore = Math.max(15, Math.min(100, Math.round(cfScore)));
  }

  // 4. Commercial & Margin Score (0 - 100)
  let commercialScore: number | null = null;
  if (metrics.forecastMarginPercent !== undefined && metrics.forecastMarginPercent !== null && !isNaN(metrics.forecastMarginPercent)) {
    const tenderMargin = (metrics.tenderMarginPercent !== undefined && metrics.tenderMarginPercent !== null) ? metrics.tenderMarginPercent : 15.0;
    const marginDelta = metrics.forecastMarginPercent - tenderMargin;
    let comScore = 80 + (marginDelta * 3.5);
    if (metrics.forecastMarginPercent <= 5) comScore -= 25;
    if (metrics.claimsUnderAssessmentUSD && metrics.claimsUnderAssessmentUSD > 2000000) {
      comScore -= 10;
    }
    commercialScore = Math.max(10, Math.min(100, Math.round(comScore)));
  }

  // 5. Risk & Ground Condition Score (0 - 100)
  let riskScore: number | null = null;
  if (metrics.openCriticalRisksCount !== undefined && metrics.openCriticalRisksCount !== null) {
    let rScore = 95 - (metrics.openCriticalRisksCount * 14);
    riskScore = Math.max(15, Math.min(100, Math.round(rScore)));
  }

  // 6. HSE Score (0 - 100)
  let hseScore: number | null = null;
  if (metrics.lostTimeInjuryCount !== undefined && metrics.lostTimeInjuryCount !== null) {
    const auditScore = (metrics.safetyAuditScorePercent !== undefined && metrics.safetyAuditScorePercent !== null) ? metrics.safetyAuditScorePercent : 94;
    let hScore = auditScore - (metrics.lostTimeInjuryCount * 35);
    hseScore = Math.max(10, Math.min(100, Math.round(hScore)));
  } else if (metrics.safetyAuditScorePercent !== undefined && metrics.safetyAuditScorePercent !== null) {
    hseScore = Math.max(10, Math.min(100, Math.round(metrics.safetyAuditScorePercent)));
  }

  // 7. Quality & QA/QC Score (0 - 100)
  let qualityScore: number | null = null;
  if (metrics.openNCRsCount !== undefined && metrics.openNCRsCount !== null) {
    const testPassRate = (metrics.qaTestPassRatePercent !== undefined && metrics.qaTestPassRatePercent !== null) ? metrics.qaTestPassRatePercent : 96;
    let qScore = (testPassRate * 0.8) - (metrics.openNCRsCount * 6) + 15;
    qualityScore = Math.max(15, Math.min(100, Math.round(qScore)));
  } else if (metrics.qaTestPassRatePercent !== undefined && metrics.qaTestPassRatePercent !== null) {
    qualityScore = Math.max(15, Math.min(100, Math.round(metrics.qaTestPassRatePercent)));
  }

  return {
    schedule: scheduleScore,
    cost: costScore,
    cashflow: cashflowScore,
    commercial: commercialScore,
    risk: riskScore,
    hse: hseScore,
    quality: qualityScore,
  };
}

/**
 * Classify a calculated health score into governance categories
 */
export function classifyHealthScore(score: number): {
  classification: HealthClassification;
  badgeColorClass: string;
  textColorClass: string;
  bgLightClass: string;
  borderClass: string;
} {
  if (score >= 90) {
    return {
      classification: "Healthy",
      badgeColorClass: "bg-emerald-600 text-white",
      textColorClass: "text-emerald-700",
      bgLightClass: "bg-emerald-50",
      borderClass: "border-emerald-200"
    };
  }
  if (score >= 75) {
    return {
      classification: "Stable",
      badgeColorClass: "bg-amber-500 text-slate-950 font-bold",
      textColorClass: "text-amber-800",
      bgLightClass: "bg-amber-50",
      borderClass: "border-amber-200"
    };
  }
  if (score >= 60) {
    return {
      classification: "At Risk",
      badgeColorClass: "bg-orange-600 text-white",
      textColorClass: "text-orange-700",
      bgLightClass: "bg-orange-50",
      borderClass: "border-orange-200"
    };
  }
  return {
    classification: "Critical",
    badgeColorClass: "bg-red-600 text-white animate-pulse",
    textColorClass: "text-red-700 font-bold",
    bgLightClass: "bg-red-50",
    borderClass: "border-red-300"
  };
}

/**
 * Evaluate Project Health using Configurable Weightings.
 * Returns null if insufficient telemetry exists to evaluate health.
 */
export function evaluateProjectHealth(
  metrics: ProjectHealthMetricsInput,
  customWeights?: Partial<HealthWeightsConfig>
): HealthScoreResult | null {
  const raw = calculatePillarScores(metrics);

  // Check if at least one valid pillar score exists
  const activeKeys = (Object.keys(raw) as (keyof HealthWeightsConfig)[]).filter(k => raw[k] !== null);
  if (activeKeys.length === 0) {
    return null;
  }

  const weights: HealthWeightsConfig = {
    ...DEFAULT_HEALTH_WEIGHTS,
    ...customWeights
  };

  // Normalize only active weights so sum is 1.0
  const activeWeightSum = activeKeys.reduce((acc, k) => acc + (weights[k] || 0), 0);
  const norm = activeWeightSum > 0 ? activeWeightSum : 1.0;

  const normalizedWeights: Record<keyof HealthWeightsConfig, number> = {
    schedule: (raw.schedule !== null ? (weights.schedule / norm) : 0),
    cost: (raw.cost !== null ? (weights.cost / norm) : 0),
    cashflow: (raw.cashflow !== null ? (weights.cashflow / norm) : 0),
    commercial: (raw.commercial !== null ? (weights.commercial / norm) : 0),
    risk: (raw.risk !== null ? (weights.risk / norm) : 0),
    hse: (raw.hse !== null ? (weights.hse / norm) : 0),
    quality: (raw.quality !== null ? (weights.quality / norm) : 0),
  };

  let exactScore = 0;
  for (const k of activeKeys) {
    exactScore += (raw[k] as number) * normalizedWeights[k];
  }

  const totalScore = Math.round(exactScore);
  const classMeta = classifyHealthScore(totalScore);

  const pillarDefinitions: { key: keyof HealthWeightsConfig; label: string; getBenchmark: () => string; getDriver: () => string }[] = [
    {
      key: "schedule",
      label: "Schedule & Milestone Velocity",
      getBenchmark: () => metrics.spi !== null && metrics.spi !== undefined ? `SPI ${metrics.spi.toFixed(2)}` : (metrics.progressPercent !== null && metrics.progressPercent !== undefined ? `${metrics.progressPercent}% Complete` : "—"),
      getDriver: () => (metrics.spi ?? 1.0) >= 1.0 ? "Critical path on or ahead of baseline" : "Progress behind scheduled milestone"
    },
    {
      key: "cost",
      label: "Cost & Earned Value (CPI)",
      getBenchmark: () => metrics.cpi !== null && metrics.cpi !== undefined ? `CPI ${metrics.cpi.toFixed(2)}` : "—",
      getDriver: () => (metrics.cpi ?? 1.0) >= 1.0 ? "Unit cost rates beating budget allowance" : "Cost incurred exceeding earned value"
    },
    {
      key: "cashflow",
      label: "Cashflow & IPC Velocity",
      getBenchmark: () => metrics.outstandingCertificationUSD !== null && metrics.outstandingCertificationUSD !== undefined ? `$${(metrics.outstandingCertificationUSD / 1_000_000).toFixed(1)}M Outstanding` : "—",
      getDriver: () => (metrics.outstandingCertificationUSD ?? 0) > 4000000 ? "Pending Employer interim payment certification lag" : "Healthy payment turnaround"
    },
    {
      key: "commercial",
      label: "Commercial & Margin Integrity",
      getBenchmark: () => metrics.forecastMarginPercent !== null && metrics.forecastMarginPercent !== undefined ? `${metrics.forecastMarginPercent.toFixed(1)}% Margin` : "—",
      getDriver: () => (metrics.forecastMarginPercent ?? 15) >= (metrics.tenderMarginPercent ?? 15) ? "Margin preserved above tender hurdle" : "Cost growth eroding projected margins"
    },
    {
      key: "risk",
      label: "Risk & Geotechnical Exposure",
      getBenchmark: () => metrics.openCriticalRisksCount !== null && metrics.openCriticalRisksCount !== undefined ? `${metrics.openCriticalRisksCount} Critical Risk(s)` : "—",
      getDriver: () => (metrics.openCriticalRisksCount ?? 0) > 1 ? "Active high-consequence project risks" : "Risks mitigated under active controls"
    },
    {
      key: "hse",
      label: "HSE & Safety Governance",
      getBenchmark: () => metrics.lostTimeInjuryCount !== null && metrics.lostTimeInjuryCount !== undefined ? `${metrics.lostTimeInjuryCount} LTI` : (metrics.safetyAuditScorePercent ? `${metrics.safetyAuditScorePercent}% Audit` : "—"),
      getDriver: () => (metrics.lostTimeInjuryCount ?? 0) === 0 ? "Zero lost-time incidents recorded" : "Safety incident under investigation"
    },
    {
      key: "quality",
      label: "Quality & QA/QC Compliance",
      getBenchmark: () => metrics.openNCRsCount !== null && metrics.openNCRsCount !== undefined ? `${metrics.openNCRsCount} Open NCRs` : (metrics.qaTestPassRatePercent ? `${metrics.qaTestPassRatePercent}% Pass` : "—"),
      getDriver: () => (metrics.openNCRsCount ?? 0) <= 1 ? "QA specifications compliant" : "Structural NCR rectification pending"
    }
  ];

  const pillars: PillarDiagnostic[] = activeKeys.map((k) => {
    const def = pillarDefinitions.find(d => d.key === k)!;
    const rawScore = raw[k] as number;
    return {
      key: k,
      label: def.label,
      rawScore,
      weight: normalizedWeights[k],
      weightedScore: Number((rawScore * normalizedWeights[k]).toFixed(1)),
      status: classifyHealthScore(rawScore).classification,
      benchmark: def.getBenchmark(),
      primaryDriver: def.getDriver()
    };
  });

  // Identify top risk and top performing pillars
  const sortedByRaw = [...pillars].sort((a, b) => a.rawScore - b.rawScore);
  const topRiskPillar = sortedByRaw[0] || pillars[0];
  const topPerformingPillar = sortedByRaw[sortedByRaw.length - 1] || pillars[0];

  let recommendedAction = "Maintain active executive oversight across operational gates.";
  if (totalScore < 60) {
    recommendedAction = `Immediate executive intervention required on ${topRiskPillar?.label || "project critical path"}. Authorize contractual relief and cash acceleration.`;
  } else if (totalScore < 75) {
    recommendedAction = `Review mitigation strategy on ${topRiskPillar?.label || "underperforming pillar"} to recover baseline trajectory.`;
  } else {
    recommendedAction = `Project performing within acceptable governance envelope. Protect ${topPerformingPillar?.label || "key competencies"}.`;
  }

  return {
    totalScore,
    exactScore,
    classification: classMeta.classification,
    badgeColorClass: classMeta.badgeColorClass,
    textColorClass: classMeta.textColorClass,
    bgLightClass: classMeta.bgLightClass,
    borderClass: classMeta.borderClass,
    pillars,
    topRiskPillar,
    topPerformingPillar,
    recommendedAction,
    weightsUsed: weights
  };
}

/**
 * Storage helpers for Company Custom Weights
 */
const STORAGE_KEY = "conbuild_health_weights_config";

export function loadStoredHealthWeights(): HealthWeightsConfig {
  try {
    const raw = previewStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.schedule === "number" && typeof parsed.cost === "number") {
        return { ...DEFAULT_HEALTH_WEIGHTS, ...parsed };
      }
    }
  } catch (e) {
    console.error("Failed to load custom health weights from localStorage:", e);
  }
  return { ...DEFAULT_HEALTH_WEIGHTS };
}

export function saveStoredHealthWeights(weights: HealthWeightsConfig): void {
    assertOperationalAction("write", "services/projectHealthEngine.ts");
  try {
    previewStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  } catch (e) {
    console.error("Failed to save health weights to localStorage:", e);
  }
}

export function resetStoredHealthWeights(): HealthWeightsConfig {
  try {
    previewStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
  return { ...DEFAULT_HEALTH_WEIGHTS };
}
