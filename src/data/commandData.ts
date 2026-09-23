import { ContractFramework } from "../config/contractFrameworks";
import { convertCurrency } from "../utils/currency";
import { getProjectRealContractValue } from "../utils/projectDataUtils";
import {
  evaluateProjectHealth,
  HealthClassification,
  HealthScoreResult,
  HealthWeightsConfig,
  DEFAULT_HEALTH_WEIGHTS
} from "../services/projectHealthEngine";

export interface CommandProjectRaw {
  id: string;
  name: string;
  code: string;
  region: string;
  countryCode: string;
  countryName: string;
  currencyCode?: string;
  currencySymbol?: string;
  sector: "Transport & Rail" | "Civil Infrastructure" | "Utilities & Power" | "Ports & Marine" | "Water & Irrigation";
  client: string;
  contractFramework: ContractFramework;
  contractValueUSD: number | null;
  progressPercent: number | null;
  targetPercent: number | null;
  spi: number | null; // Schedule Performance Index
  cpi: number | null; // Cost Performance Index
  forecastMarginPercent: number | null;
  tenderMarginPercent: number | null;
  outstandingCertificationUSD: number | null;
  cashRequirementUSD: number | null;
  openCriticalRisksCount?: number | null;
  openNCRsCount?: number | null;
  qaTestPassRatePercent?: number | null;
  lostTimeInjuryCount?: number | null;
  safetyAuditScorePercent?: number | null;
  claimsUnderAssessmentUSD?: number | null;
  criticalActivity: string;
  primaryRisk: string;
  mitigationAction: string;
  projectManager: string;
  lastUpdated: string;
}

export interface CommandProject extends CommandProjectRaw {
  healthScore: number | null;
  healthStatus: HealthClassification | null;
  healthEvaluation: HealthScoreResult | null;
}

export interface CriticalActionItem {
  id: string;
  projectId: string;
  projectName: string;
  countryCode: string;
  title: string;
  type: "Contractual Notice" | "Financial Authorization" | "Engineering Resolution" | "Procurement Approval" | "Community Liaison";
  severity: "critical" | "high" | "medium";
  deadlineDays: number;
  financialImpactUSD: number;
  frameworkClause: string;
  recommendedResolution: string;
  status: "Pending Executive Action" | "In Review" | "Resolved";
}

// No fake mock projects; real projects are mapped strictly by project_id
export const RAW_COMMAND_PROJECTS: CommandProjectRaw[] = [];

/**
 * Safely parse JSON from localStorage
 */
function safeGetStoredJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Map a persisted ProjectRecord to CommandProjectRaw strictly by project_id.
 * If source data does not exist, fields return null (NO DATA -> "-").
 */
export function projectRecordToCommandRaw(p: any): CommandProjectRaw {
  if (!p || !p.id) {
    return {
      id: "unknown",
      name: "-",
      code: "-",
      region: "-",
      countryCode: "TZ",
      countryName: "-",
      sector: "Civil Infrastructure",
      client: "-",
      contractFramework: "FIDIC Red Book",
      contractValueUSD: null,
      progressPercent: null,
      targetPercent: null,
      spi: null,
      cpi: null,
      forecastMarginPercent: null,
      tenderMarginPercent: null,
      outstandingCertificationUSD: null,
      cashRequirementUSD: null,
      criticalActivity: "-",
      primaryRisk: "-",
      mitigationAction: "-",
      projectManager: "-",
      lastUpdated: new Date().toISOString()
    };
  }

  const projectId = p.id;
  const companyId = p.company_id || "all";

  // 1. Contract Value: check commercial baseline first, then project creation record
  let contractVal: number | null = null;
  const storedContract = 
    safeGetStoredJson<any>(`pm_commercial_v2_contract_values_${companyId}_${projectId}`) ||
    safeGetStoredJson<any>(`pm_commercial_v2_contract_values_all_${projectId}`);
  
  if (storedContract) {
    if (storedContract.revisedContractValue !== null && storedContract.revisedContractValue !== undefined && storedContract.revisedContractValue !== "") {
      const rev = Number(storedContract.revisedContractValue);
      if (!isNaN(rev) && rev > 0) {
        contractVal = rev;
      }
    }
    if (contractVal === null && storedContract.originalContractValue !== null && storedContract.originalContractValue !== undefined && storedContract.originalContractValue !== "") {
      const orig = Number(storedContract.originalContractValue);
      const vars = Number(storedContract.approvedVariations) || 0;
      if (!isNaN(orig) && (orig + vars) > 0) {
        contractVal = orig + vars;
      }
    }
  }

  if (contractVal === null) {
    const rawAward = p.award_value_zar ?? p.value_rate ?? p.contract_value_usd ?? p.contract_value ?? p.agreed_contract_value_excl_vat ?? p.original_contract_value ?? p.budget;
    if (rawAward !== undefined && rawAward !== null && rawAward !== "") {
      const parsedAward = Number(rawAward);
      if (!isNaN(parsedAward) && parsedAward > 0) {
        contractVal = parsedAward;
      }
    }
  }

  if (contractVal === null) {
    const utilVal = getProjectRealContractValue(p, companyId);
    if (utilVal > 0) {
      contractVal = utilVal;
    }
  }

  // 2. Programme & Progress: check real programme activities stored for this project
  let progressPercent: number | null = null;
  let targetPercent: number | null = null;
  let spi: number | null = null;

  const storedActivities = safeGetStoredJson<any[]>(`pm_programme_activities_${projectId}`);
  if (Array.isArray(storedActivities) && storedActivities.length > 0) {
    const totalDur = storedActivities.reduce((sum, a) => sum + (Number(a.originalDuration) || Number(a.duration) || 1), 0);
    const actualSum = storedActivities.reduce((sum, a) => {
      const prog = a.progress !== undefined ? Number(a.progress) : (a.actualProgressPercent !== undefined ? Number(a.actualProgressPercent) : 0);
      const dur = Number(a.originalDuration) || Number(a.duration) || 1;
      return sum + (prog * dur);
    }, 0);
    const plannedSum = storedActivities.reduce((sum, a) => {
      const plan = a.plannedProgressPercent !== undefined ? Number(a.plannedProgressPercent) : (a.target_progress !== undefined ? Number(a.target_progress) : 0);
      const dur = Number(a.originalDuration) || Number(a.duration) || 1;
      return sum + (plan * dur);
    }, 0);
    
    if (totalDur > 0) {
      const calcAct = Number((actualSum / totalDur).toFixed(1));
      const calcPlan = Number((plannedSum / totalDur).toFixed(1));
      if (!isNaN(calcAct) && calcAct >= 0) progressPercent = calcAct;
      if (!isNaN(calcPlan) && calcPlan > 0) targetPercent = calcPlan;
      if (progressPercent !== null && targetPercent !== null && targetPercent > 0) {
        spi = Number((progressPercent / targetPercent).toFixed(2));
      }
    }
  }

  // Fallback to direct project progress attributes ONLY if explicitly provided and not empty
  if (progressPercent === null) {
    const rawProg = p.physical_progress ?? p.progress_percentage ?? p.progress_percent;
    if (rawProg !== undefined && rawProg !== null && rawProg !== "") {
      const parsedProg = Number(rawProg);
      if (!isNaN(parsedProg)) {
        progressPercent = parsedProg;
      }
    }
  }

  if (targetPercent === null) {
    const rawTarget = p.target_progress ?? p.planned_progress;
    if (rawTarget !== undefined && rawTarget !== null && rawTarget !== "") {
      const parsedTarget = Number(rawTarget);
      if (!isNaN(parsedTarget) && parsedTarget > 0) {
        targetPercent = parsedTarget;
      }
    }
  }

  if (spi === null) {
    if (p.spi !== undefined && p.spi !== null && p.spi !== "") {
      const parsedSpi = Number(p.spi);
      if (!isNaN(parsedSpi)) {
        spi = parsedSpi;
      }
    } else if (progressPercent !== null && targetPercent !== null && targetPercent > 0) {
      spi = Number((progressPercent / targetPercent).toFixed(2));
    }
  }

  // 3. Actual Costs & CPI
  let cpi: number | null = null;
  const storedCosts = 
    safeGetStoredJson<any[]>(`pm_commercial_v2_actual_costs_${companyId}_${projectId}`) ||
    safeGetStoredJson<any[]>(`pm_commercial_v2_actual_costs_all_${projectId}`);
  
  let actualCostTotal: number | null = null;
  if (Array.isArray(storedCosts) && storedCosts.length > 0) {
    actualCostTotal = storedCosts
      .filter(c => c.status === "Posted")
      .reduce((sum, c) => sum + (Number(c.net) || Number(c.total) || 0), 0);
    
    if (contractVal !== null && contractVal > 0 && progressPercent !== null && actualCostTotal > 0) {
      const earnedValue = contractVal * (progressPercent / 100);
      cpi = Number((earnedValue / actualCostTotal).toFixed(2));
    }
  }

  if (cpi === null && p.cpi !== undefined && p.cpi !== null && p.cpi !== "") {
    const parsedCpi = Number(p.cpi);
    if (!isNaN(parsedCpi)) {
      cpi = parsedCpi;
    }
  }

  // 4. Commercial Forecast & Tender Margins
  let forecastMarginPercent: number | null = null;
  let tenderMarginPercent: number | null = null;

  const storedForecasts = 
    safeGetStoredJson<any[]>(`pm_commercial_v2_forecasts_${companyId}_${projectId}`) ||
    safeGetStoredJson<any[]>(`pm_commercial_v2_forecasts_all_${projectId}`);
  
  const storedBudgets = 
    safeGetStoredJson<any[]>(`pm_commercial_v2_budgets_${companyId}_${projectId}`) ||
    safeGetStoredJson<any[]>(`pm_commercial_v2_budgets_all_${projectId}`);

  if (contractVal !== null && contractVal > 0) {
    if (Array.isArray(storedForecasts) && storedForecasts.length > 0) {
      const fcFinal = storedForecasts.reduce((sum, f) => sum + (Number(f.forecastFinalCost) || 0), 0);
      forecastMarginPercent = Number((((contractVal - fcFinal) / contractVal) * 100).toFixed(1));
    } else if (actualCostTotal !== null && actualCostTotal > 0) {
      forecastMarginPercent = Number((((contractVal - actualCostTotal) / contractVal) * 100).toFixed(1));
    }

    if (Array.isArray(storedBudgets) && storedBudgets.length > 0) {
      const budgetTotal = storedBudgets.reduce((sum, b) => sum + (Number(b.revisedBudget) || Number(b.originalBudget) || 0), 0);
      if (budgetTotal > 0) {
        tenderMarginPercent = Number((((contractVal - budgetTotal) / contractVal) * 100).toFixed(1));
      }
    }
  }

  if (forecastMarginPercent === null && p.forecast_margin !== undefined && p.forecast_margin !== null && p.forecast_margin !== "") {
    const parsedFm = Number(p.forecast_margin);
    if (!isNaN(parsedFm)) {
      forecastMarginPercent = parsedFm;
    }
  }

  if (tenderMarginPercent === null && p.tender_margin !== undefined && p.tender_margin !== null && p.tender_margin !== "") {
    const parsedTm = Number(p.tender_margin);
    if (!isNaN(parsedTm)) {
      tenderMarginPercent = parsedTm;
    }
  }

  // 5. Outstanding Certification
  let outstandingCertificationUSD: number | null = null;
  const storedCerts = 
    safeGetStoredJson<any[]>(`pm_commercial_v2_client_certificates_${companyId}_${projectId}`) ||
    safeGetStoredJson<any[]>(`pm_commercial_v2_client_certificates_all_${projectId}`);

  if (Array.isArray(storedCerts) && storedCerts.length > 0) {
    const certSum = storedCerts.reduce((sum, c) => sum + (Number(c.certifiedAmount) || Number(c.appliedAmount) || 0), 0);
    const paidSum = storedCerts.reduce((sum, c) => sum + (Number(c.paidAmount) || 0), 0);
    outstandingCertificationUSD = Math.max(0, certSum - paidSum);
  } else if (p.outstanding_certification !== undefined && p.outstanding_certification !== null && p.outstanding_certification !== "") {
    const parsedCert = Number(p.outstanding_certification);
    if (!isNaN(parsedCert)) {
      outstandingCertificationUSD = parsedCert;
    }
  }

  // 6. Cash Requirement
  let cashRequirementUSD: number | null = null;
  if (Array.isArray(storedForecasts) && storedForecasts.length > 0) {
    const toComplete = storedForecasts.reduce((sum, f) => sum + (Number(f.forecastToComplete) || 0), 0);
    const outstanding = outstandingCertificationUSD || 0;
    cashRequirementUSD = Math.max(0, toComplete - outstanding);
  } else if (p.cash_requirement !== undefined && p.cash_requirement !== null && p.cash_requirement !== "") {
    const parsedCash = Number(p.cash_requirement);
    if (!isNaN(parsedCash)) {
      cashRequirementUSD = parsedCash;
    }
  }

  // Location / Country / Currency resolution
  const explicitCurrency = p.currency_code || p.currency || p.currencyCode;
  const countryCode = p.countryCode || p.country_code || (
    explicitCurrency === "TZS" ? "TZ" :
    explicitCurrency === "ZAR" || p.award_value_zar ? "ZA" :
    explicitCurrency === "KES" ? "KE" :
    explicitCurrency === "UGX" ? "UG" :
    explicitCurrency === "RWF" ? "RW" :
    explicitCurrency === "BWP" ? "BW" :
    explicitCurrency === "NAD" ? "NA" :
    explicitCurrency === "SAR" ? "SA" :
    explicitCurrency === "AED" ? "AE" :
    explicitCurrency === "USD" ? "US" :
    explicitCurrency === "GBP" ? "GB" :
    explicitCurrency === "EUR" ? "EU" : "ZA"
  );
  const countryName = p.countryName || p.country_name || (
    countryCode === "ZA" ? "South Africa" :
    countryCode === "TZ" ? "Tanzania" :
    countryCode === "SA" ? "Saudi Arabia" :
    countryCode === "AE" ? "United Arab Emirates" :
    countryCode === "KE" ? "Kenya" :
    countryCode === "UG" ? "Uganda" : "Regional"
  );
  const currencyCode = explicitCurrency || (
    p.award_value_zar ? "ZAR" :
    p.contract_value_usd ? "USD" :
    countryCode === "ZA" ? "ZAR" :
    countryCode === "TZ" ? "TZS" :
    countryCode === "KE" ? "KES" :
    countryCode === "UG" ? "UGX" :
    countryCode === "SA" ? "SAR" :
    countryCode === "AED" ? "AED" : "USD"
  );
  const currencySymbol = p.currency_symbol || (
    currencyCode === "USD" ? "$" :
    currencyCode === "EUR" ? "€" :
    currencyCode === "GBP" ? "£" :
    currencyCode === "TZS" ? "TSh" :
    currencyCode === "KES" ? "KSh" :
    currencyCode === "ZAR" ? "R" :
    currencyCode === "SAR" ? "SAR" :
    currencyCode === "AED" ? "AED" : "$"
  );

  return {
    id: projectId,
    name: p.name || `Project ${p.code || projectId}`,
    code: p.contract_code || p.code || p.contract_number || "PRJ",
    region: p.region || p.execution_location || p.location || "East Africa",
    countryCode,
    countryName,
    currencyCode,
    currencySymbol,
    sector: p.sector || "Civil Infrastructure",
    client: p.client_organization || p.client || "-",
    contractFramework: p.contract_agreement_option || p.contract_type || "FIDIC Red Book",
    contractValueUSD: contractVal,
    progressPercent,
    targetPercent,
    spi,
    cpi,
    forecastMarginPercent,
    tenderMarginPercent,
    outstandingCertificationUSD,
    cashRequirementUSD,
    openCriticalRisksCount: p.openCriticalRisksCount ?? p.open_critical_risks ?? null,
    openNCRsCount: p.openNCRsCount ?? p.open_ncrs ?? null,
    qaTestPassRatePercent: p.qaTestPassRatePercent ?? p.qa_test_pass_rate ?? null,
    lostTimeInjuryCount: p.lostTimeInjuryCount ?? p.lti_count ?? null,
    safetyAuditScorePercent: p.safetyAuditScorePercent ?? p.safety_audit_score ?? null,
    claimsUnderAssessmentUSD: p.claimsUnderAssessmentUSD ?? p.claims_amount ?? null,
    criticalActivity: p.critical_activity || p.criticalActivity || "-",
    primaryRisk: p.primary_risk || p.primaryRisk || "-",
    mitigationAction: p.mitigation_action || p.mitigationAction || "-",
    projectManager: p.contract_manager || p.project_manager || p.projectManager || "-",
    lastUpdated: p.updated_at || p.created_at || new Date().toISOString()
  };
}

/**
 * Build Command Projects with Dynamic Calculated Health Engine
 */
export function getCalculatedCommandProjects(
  customWeights?: Partial<HealthWeightsConfig>,
  customProjects?: (CommandProjectRaw | any)[]
): CommandProject[] {
  if (!customProjects || customProjects.length === 0) {
    return [];
  }

  return customProjects.map((p) => {
    const raw: CommandProjectRaw = ("sector" in p && "countryCode" in p && ("progressPercent" in p || "contractValueUSD" in p))
      ? p
      : projectRecordToCommandRaw(p);

    const evaluation = evaluateProjectHealth(
      {
        spi: raw.spi,
        cpi: raw.cpi,
        progressPercent: raw.progressPercent,
        targetPercent: raw.targetPercent,
        forecastMarginPercent: raw.forecastMarginPercent,
        tenderMarginPercent: raw.tenderMarginPercent,
        outstandingCertificationUSD: raw.outstandingCertificationUSD,
        contractValueUSD: raw.contractValueUSD,
        cashRequirementUSD: raw.cashRequirementUSD,
        openCriticalRisksCount: raw.openCriticalRisksCount,
        openNCRsCount: raw.openNCRsCount,
        qaTestPassRatePercent: raw.qaTestPassRatePercent,
        lostTimeInjuryCount: raw.lostTimeInjuryCount,
        safetyAuditScorePercent: raw.safetyAuditScorePercent,
        claimsUnderAssessmentUSD: raw.claimsUnderAssessmentUSD
      },
      customWeights
    );

    return {
      ...raw,
      healthScore: evaluation ? evaluation.totalScore : null,
      healthStatus: evaluation ? evaluation.classification : null,
      healthEvaluation: evaluation
    };
  });
}

// Default export of projects using default scoring engine
export const COMMAND_PROJECTS: CommandProject[] = [];

export const COMMAND_CRITICAL_ACTIONS: CriticalActionItem[] = [];

export function calculatePortfolioTotals(projects: CommandProject[], targetCurrency: string = "USD") {
  const count = projects.length;
  if (count === 0) {
    return {
      portfolioHealthScore: null as number | null,
      portfolioHealthStatus: null as HealthClassification | null,
      portfolioValueUSD: null as number | null,
      portfolioValueFormatted: "—",
      activeProjectsCount: 0,
      projectsAtRiskCount: 0,
      forecastMarginPercent: null as number | null,
      tenderMarginPercent: null as number | null,
      marginVariancePercent: null as number | null,
      forecastMarginValueUSD: null as number | null,
      outstandingCertificationUSD: null as number | null,
      outstandingCertificationIPCsCount: 0,
      cashRequirementUSD: null as number | null,
      criticalActionsCount: 0,
      overallSPI: null as number | null,
      overallCPI: null as number | null,
      capitalAtRiskUSD: null as number | null,
      reportingCurrency: targetCurrency
    };
  }

  // Contract Values (Backlog Value) converted from each project's base currency into reporting currency
  const validValues = projects.filter(p => p.contractValueUSD !== null && !isNaN(p.contractValueUSD!) && p.contractValueUSD! > 0);
  const totalValue = validValues.length > 0
    ? validValues.reduce((acc, p) => {
        const valInReporting = convertCurrency(p.contractValueUSD, p.currencyCode || "USD", targetCurrency) || 0;
        return acc + valInReporting;
      }, 0)
    : null;

  // Health Scores
  const validScores = projects.filter(p => p.healthScore !== null && !isNaN(p.healthScore!));
  const avgScore = validScores.length > 0
    ? Math.round(validScores.reduce((acc, p) => acc + p.healthScore!, 0) / validScores.length)
    : null;

  const atRiskProjects = projects.filter((p) => p.healthStatus === "At Risk" || p.healthStatus === "Critical");
  const atRiskCount = atRiskProjects.length;

  // SPI / CPI
  const validSPIs = projects.filter(p => p.spi !== null && !isNaN(p.spi!));
  const avgSPI = validSPIs.length > 0
    ? Number((validSPIs.reduce((acc, p) => acc + p.spi!, 0) / validSPIs.length).toFixed(2))
    : null;

  const validCPIs = projects.filter(p => p.cpi !== null && !isNaN(p.cpi!));
  const avgCPI = validCPIs.length > 0
    ? Number((validCPIs.reduce((acc, p) => acc + p.cpi!, 0) / validCPIs.length).toFixed(2))
    : null;

  // Margins
  const validFm = projects.filter(p => p.forecastMarginPercent !== null && !isNaN(p.forecastMarginPercent!));
  const avgForecastMargin = validFm.length > 0
    ? Number((validFm.reduce((acc, p) => acc + p.forecastMarginPercent!, 0) / validFm.length).toFixed(1))
    : null;

  const validTm = projects.filter(p => p.tenderMarginPercent !== null && !isNaN(p.tenderMarginPercent!));
  const avgTenderMargin = validTm.length > 0
    ? Number((validTm.reduce((acc, p) => acc + p.tenderMarginPercent!, 0) / validTm.length).toFixed(1))
    : null;

  const marginVariance = (avgForecastMargin !== null && avgTenderMargin !== null)
    ? Number((avgForecastMargin - avgTenderMargin).toFixed(1))
    : null;

  const forecastMarginValueUSD = (totalValue !== null && avgForecastMargin !== null)
    ? Math.round(totalValue * (avgForecastMargin / 100))
    : null;

  // Outstanding Certification converted to target currency
  const validOutstanding = projects.filter(p => p.outstandingCertificationUSD !== null && !isNaN(p.outstandingCertificationUSD!));
  const totalOutstanding = validOutstanding.length > 0
    ? validOutstanding.reduce((acc, p) => {
        const certInReporting = convertCurrency(p.outstandingCertificationUSD, p.currencyCode || "USD", targetCurrency) || 0;
        return acc + certInReporting;
      }, 0)
    : null;

  const outstandingIPCsCount = projects.filter(p => (p.outstandingCertificationUSD || 0) > 0).length;

  // Cash Requirement converted to target currency
  const validCash = projects.filter(p => p.cashRequirementUSD !== null && !isNaN(p.cashRequirementUSD!));
  const totalCashReq = validCash.length > 0
    ? validCash.reduce((acc, p) => {
        const cashInReporting = convertCurrency(p.cashRequirementUSD, p.currencyCode || "USD", targetCurrency) || 0;
        return acc + cashInReporting;
      }, 0)
    : null;

  const capitalAtRisk = atRiskProjects.reduce((acc, p) => {
    const riskInReporting = convertCurrency(p.contractValueUSD, p.currencyCode || "USD", targetCurrency) || 0;
    return acc + riskInReporting;
  }, 0);

  let status: HealthClassification | null = null;
  if (avgScore !== null) {
    if (avgScore < 60) status = "Critical";
    else if (avgScore < 75) status = "At Risk";
    else if (avgScore < 90) status = "Stable";
    else status = "Healthy";
  }

  return {
    portfolioHealthScore: avgScore,
    portfolioHealthStatus: status,
    portfolioValueUSD: totalValue,
    portfolioValueFormatted: totalValue !== null ? `${(totalValue / 1_000_000).toFixed(1)}M` : "—",
    activeProjectsCount: count,
    projectsAtRiskCount: atRiskCount,
    forecastMarginPercent: avgForecastMargin,
    tenderMarginPercent: avgTenderMargin,
    marginVariancePercent: marginVariance,
    forecastMarginValueUSD,
    outstandingCertificationUSD: totalOutstanding,
    outstandingCertificationIPCsCount: outstandingIPCsCount,
    cashRequirementUSD: totalCashReq,
    criticalActionsCount: 0,
    overallSPI: avgSPI,
    overallCPI: avgCPI,
    capitalAtRiskUSD: capitalAtRisk,
    reportingCurrency: targetCurrency
  };
}

export const COMMAND_PORTFOLIO_TOTALS = calculatePortfolioTotals(COMMAND_PROJECTS);


