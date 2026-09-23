import { previewStorage } from "../../integration/previewStorage";
import { CommandProject, CommandProjectRaw, projectRecordToCommandRaw } from "../../data/commandData";
import { ProjectRecord } from "../../services/projectService";
import { ProjectAction } from "../../services/actionsService";
import { convertCurrency } from "../../utils/currency";
import { getProjectRealContractValue } from "../../utils/projectDataUtils";

export interface PortfolioHealthSummary {
  totalProjects: number;
  onTrackCount: number;
  atRiskCount: number;
  criticalCount: number;
  portfolioValue: number | null; // Exact sum of real project contract values converted to reportingCurrency
  portfolioValueUSD: number | null;
  reportingCurrency: string;
}

export interface CriticalActionRow {
  id: string;
  companyId: string;
  companyName: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  discipline: "Programme" | "Commercial" | "Engineering" | "Contracts" | "Procurement" | "Site Operations" | "HSEQ";
  problem: string; // What is wrong?
  rootCause: string; // Why?
  impact: string; // What is the impact?
  impactAmountUSD?: number | null;
  delayDays?: number | null;
  owner: string; // Who owns it?
  ownerRole: string;
  decisionRequired: string; // What decision is required?
  due: string; // Due date or countdown
  severity: "critical" | "high" | "medium";
  status: "Pending Decision" | "Authorized" | "In Review";
  underlyingRecordType: string;
  underlyingRecordPath: string;
  rawActionId?: string;
  frameworkClause?: string;
}

export interface FinancialExposureRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  currencyCode: string;
  contractValueUSD: number | null;
  outstandingCertificationUSD: number | null; // Major outstanding payments
  costOverrunUSD: number | null; // Budget overruns
  variationsUSD: number | null; // Variations / claims
  cashflowRiskUSD: number | null; // 30-day cashflow deficit / requirement
  forecastMarginExposureUSD: number | null; // Financial margin erosion
  marginVariancePercent: number | null;
  underlyingRecordPath: string;
  exposureExplanation: string;
}

export interface ProgrammeExposureRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  status: "On Track" | "Delayed" | "Critical Delay";
  criticalPathIssue: string;
  delayDays: number | null;
  spi: number | null;
  progressPercent: number | null;
  targetPercent: number | null;
  forecastCompletionDate: string | null;
  underlyingRecordPath: string;
  mitigationPlan: string;
}

export interface ForecastRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  currencyCode: string;
  trajectory: "Profitable & Ahead" | "Stable / On Target" | "Margin Pressure" | "Critical Cost & Schedule Drift";
  trajectoryColor: "emerald" | "blue" | "amber" | "red";
  progressPercent: number | null;
  targetPercent: number | null;
  cpi: number | null;
  cpiTrend: string;
  forecastMarginPercent: number | null;
  tenderMarginPercent: number | null;
  marginVariancePercent: number | null;
  contractValueUSD: number | null;
  forecastFinalCostUSD: number | null;
  projectedCompletionDate: string | null;
  executiveOutlook: string;
  underlyingRecordPath: string;
}

/**
 * Safely parse JSON from localStorage
 */
function safeGet<T>(key: string): T | null {
  try {
    const raw = previewStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Build Portfolio Health Summary (5 compact metrics only)
 */
export function buildPortfolioHealth(
  projects: CommandProject[],
  targetCurrency: string = "USD"
): PortfolioHealthSummary {
  const totalProjects = projects.length;
  if (totalProjects === 0) {
    return {
      totalProjects: 0,
      onTrackCount: 0,
      atRiskCount: 0,
      criticalCount: 0,
      portfolioValue: null,
      portfolioValueUSD: null,
      reportingCurrency: targetCurrency
    };
  }

  let onTrack = 0;
  let atRisk = 0;
  let critical = 0;

  projects.forEach((p) => {
    if (p.healthStatus === "Critical" || (p.spi !== null && p.spi < 0.85) || (p.cpi !== null && p.cpi < 0.85)) {
      critical++;
    } else if (p.healthStatus === "At Risk" || (p.spi !== null && p.spi < 0.95) || (p.cpi !== null && p.cpi < 0.95)) {
      atRisk++;
    } else {
      onTrack++;
    }
  });

  const validValues = projects.filter((p) => p.contractValueUSD !== null && p.contractValueUSD > 0);
  const totalValue = validValues.length > 0
    ? validValues.reduce((sum, p) => {
        const inTarget = convertCurrency(p.contractValueUSD, p.currencyCode || "USD", targetCurrency) || 0;
        return sum + inTarget;
      }, 0)
    : null;

  return {
    totalProjects,
    onTrackCount: onTrack,
    atRiskCount: atRisk,
    criticalCount: critical,
    portfolioValue: totalValue,
    portfolioValueUSD: totalValue,
    reportingCurrency: targetCurrency
  };
}

/**
 * Build Critical Actions from live Programme, Commercial, Engineering, Contracts,
 * Procurement, Site Operations, and HSEQ data.
 * Only issues requiring executive management attention.
 */
export function buildCriticalActions(
  companyProjects: CommandProject[],
  companyActions: ProjectAction[],
  companyName: string = "Enterprise",
  companyId: string = "default"
): CriticalActionRow[] {
  const actionsList: CriticalActionRow[] = [];
  const seenKeys = new Set<string>();

  // 1. Process explicit Company Actions from ActionsService (already filtered to pending/requires_approval)
  if (Array.isArray(companyActions)) {
    companyActions
      .filter((a) => a.status === "REQUIRES_APPROVAL" || a.status === "PENDING" || a.status === "IN_PROGRESS")
      .forEach((a) => {
        const proj = companyProjects.find((p) => p.id === a.project_id);
        const projectName = proj?.name || (a as any).project_name || "Company Operations";
        const projectCode = proj?.code || "CORP";

        // Map discipline
        let discipline: CriticalActionRow["discipline"] = "Commercial";
        let recPath = "/commercial/overview";
        let recType = "Action Record";

        const category = (a as any).category;
        if (a.source_type === "PO" || category === "PROCUREMENT") {
          discipline = "Procurement";
          recPath = `/procurement?project=${a.project_id || ""}`;
          recType = "Purchase Order";
        } else if (a.source_type === "NOTICE" || category === "LEGAL_COMMERCIAL") {
          discipline = "Contracts";
          recPath = `/governance/contracts?project=${a.project_id || ""}`;
          recType = "Contract Notice";
        } else if (a.source_type === "RFI" || category === "TECHNICAL_SITE") {
          discipline = "Engineering";
          recPath = `/engineering?project=${a.project_id || ""}`;
          recType = "Engineering RFI";
        } else if (a.source_type === "NCR") {
          discipline = "HSEQ";
          recPath = `/hseq?project=${a.project_id || ""}&tab=quality`;
          recType = "Non-Conformance Report";
        } else if (a.source_type === "CERTIFICATE") {
          discipline = "Commercial";
          recPath = `/commercial/client-accounts?project=${a.project_id || ""}`;
          recType = "Payment Valuation";
        }

        const actionKey = `${a.project_id}_${a.title}`;
        if (!seenKeys.has(actionKey)) {
          seenKeys.add(actionKey);
          actionsList.push({
            id: a.id,
            companyId,
            companyName,
            projectId: a.project_id || "corp",
            projectCode,
            projectName,
            discipline,
            problem: a.title + (a.description ? `: ${a.description}` : ""),
            rootCause: a.ai_rationale || a.description || "Exception requiring corporate management authorization under project governance framework.",
            impact: a.consequential_impact 
              ? a.consequential_impact.replace(/_/g, " ")
              : (a.priority === "CRITICAL" ? "High Risk: Commercial / Schedule Bottleneck" : "Operational Gate Dependency"),
            impactAmountUSD: (a as any).financial_impact_usd || null,
            owner: a.owner_name || a.owner_role || "Project Director",
            ownerRole: a.owner_role || "Designated Lead",
            decisionRequired: a.requires_human_approval 
              ? ((a as any).resolution_plan || `Executive sign-off required for ${a.title}`)
              : "Review and approve recommended course of action.",
            due: a.due_date ? `Due ${a.due_date}` : "Due in 3d",
            severity: a.priority === "CRITICAL" ? "critical" : a.priority === "HIGH" ? "high" : "medium",
            status: "Pending Decision",
            underlyingRecordType: recType,
            underlyingRecordPath: recPath,
            rawActionId: a.id,
            frameworkClause: (a as any).fidic_clause || undefined
          });
        }
      });
  }

  // 2. Scan Live Project Telemetry for Management Exceptions across remaining disciplines
  companyProjects.forEach((proj) => {
    const pId = proj.id;

    // Commercial Exception: Overdue Client Certification / Unpaid IPCs
    if (proj.outstandingCertificationUSD !== null && proj.outstandingCertificationUSD > 0) {
      const key = `${pId}_cert_overdue`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        actionsList.push({
          id: `act-cert-${pId}`,
          companyId,
          companyName,
          projectId: pId,
          projectCode: proj.code,
          projectName: proj.name,
          discipline: "Commercial",
          problem: `Outstanding IPC Payment Certification exceeding credit term`,
          rootCause: `Client certificate submitted and awaiting payment release from ${proj.client || "Employer"}.`,
          impact: `Liquidity exposure of $${(proj.outstandingCertificationUSD / 1000).toFixed(0)}K on working capital facility`,
          impactAmountUSD: proj.outstandingCertificationUSD,
          owner: proj.projectManager !== "-" ? proj.projectManager : "Senior Quantity Surveyor",
          ownerRole: "Commercial Manager",
          decisionRequired: `Issue formal contractual interest demand or authorize bridge facility drawdown`,
          due: "Immediate",
          severity: proj.outstandingCertificationUSD > 500000 ? "critical" : "high",
          status: "Pending Decision",
          underlyingRecordType: "Client Certificate",
          underlyingRecordPath: `/commercial/client-accounts?project=${pId}`
        });
      }
    }

    // Programme Exception: Significant Critical Path Delay
    if (proj.spi !== null && proj.spi < 0.92) {
      const key = `${pId}_prog_delay`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const delayEstimate = Math.round((1 / proj.spi - 1) * 90);
        actionsList.push({
          id: `act-prog-${pId}`,
          companyId,
          companyName,
          projectId: pId,
          projectCode: proj.code,
          projectName: proj.name,
          discipline: "Programme",
          problem: `Schedule slippage on critical path: ${proj.criticalActivity !== "-" ? proj.criticalActivity : "Site Works Baseline"}`,
          rootCause: `Physical progress (${proj.progressPercent ?? 0}%) lagging target (${proj.targetPercent ?? 0}%) with velocity SPI of ${proj.spi}.`,
          impact: `Estimated ${delayEstimate} days critical-path delay; liquidated damages exposure`,
          delayDays: delayEstimate,
          owner: proj.projectManager !== "-" ? proj.projectManager : "Planning & Controls Lead",
          ownerRole: "Programme Director",
          decisionRequired: `Approve contractor recovery schedule and acceleration resource reallocation`,
          due: "Due in 2d",
          severity: proj.spi < 0.85 ? "critical" : "high",
          status: "Pending Decision",
          underlyingRecordType: "Programme Schedule",
          underlyingRecordPath: `/controls/programme?project=${pId}`
        });
      }
    }

    // Site Operations Exception: Open High/Critical Site Issue
    const siteIssues = safeGet<any[]>(`pm_site_issues_${pId}`);
    if (Array.isArray(siteIssues)) {
      const openCriticalIssue = siteIssues.find(
        (i) => (i.status === "Open" || i.status === "In Progress") && (i.priority === "Critical" || i.priority === "High")
      );
      if (openCriticalIssue) {
        const key = `${pId}_site_${openCriticalIssue.id || openCriticalIssue.title}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          actionsList.push({
            id: `act-site-${openCriticalIssue.id || pId}`,
            companyId,
            companyName,
            projectId: pId,
            projectCode: proj.code,
            projectName: proj.name,
            discipline: "Site Operations",
            problem: `Site Operational Issue: ${openCriticalIssue.title}`,
            rootCause: openCriticalIssue.description || "Ground conditions or plant availability constraint hindering physical execution.",
            impact: "Standing time and production output stoppage",
            owner: openCriticalIssue.assignedTo || proj.projectManager,
            ownerRole: "Site Operations Lead",
            decisionRequired: `Authorize plant replacement or temporary works revision`,
            due: "Immediate",
            severity: openCriticalIssue.priority === "Critical" ? "critical" : "high",
            status: "Pending Decision",
            underlyingRecordType: "Site Issue",
            underlyingRecordPath: `/site?project=${pId}`
          });
        }
      }
    }

    // Quality / HSEQ Exception: Unresolved NCRs
    if (proj.openNCRsCount && proj.openNCRsCount > 0) {
      const key = `${pId}_ncrs`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        actionsList.push({
          id: `act-ncr-${pId}`,
          companyId,
          companyName,
          projectId: pId,
          projectCode: proj.code,
          projectName: proj.name,
          discipline: "HSEQ",
          problem: `${proj.openNCRsCount} open Non-Conformance Report(s) awaiting sign-off`,
          rootCause: `Material or workmanship inspection failure recorded during quality assurance audit.`,
          impact: `Quality hold preventing structural sign-off and subsequent milestone handoff`,
          owner: "QA/QC Lead",
          ownerRole: "Quality Assurance Lead",
          decisionRequired: `Review laboratory test verification reports and sign off disposition closure`,
          due: "Due in 4d",
          severity: proj.openNCRsCount > 2 ? "critical" : "medium",
          status: "Pending Decision",
          underlyingRecordType: "Quality Control Register",
          underlyingRecordPath: `/hseq?project=${pId}&tab=quality`
        });
      }
    }
  });

  // Sort critical actions by severity (critical first, then high, then medium)
  return actionsList.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 };
    return order[a.severity] - order[b.severity];
  });
}

/**
 * Extract clean numeric value from string or number
 */
function parseNumericValue(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Retrieve all stored project array records across company, default, all and project-specific keys
 */
function getStoredProjectRecords<T>(prefix: string, projectId: string, companyId?: string): T[] {
  const results: T[] = [];
  const visitedKeys = new Set<string>();

  const candidateKeys = [
    companyId && companyId !== "all" ? `${prefix}_${companyId}_${projectId}` : null,
    `${prefix}_default_company_${projectId}`,
    `${prefix}_all_${projectId}`,
    `${prefix}_default_${projectId}`,
    `${prefix}_${projectId}`
  ].filter(Boolean) as string[];

  for (const k of candidateKeys) {
    if (visitedKeys.has(k)) continue;
    visitedKeys.add(k);
    const raw = safeGet<any>(k);
    if (Array.isArray(raw)) {
      results.push(...raw);
    }
  }

  try {
    const targetSuffix = `_${projectId}`;
    if (typeof localStorage !== "undefined") {
      for (let i = 0; i < previewStorage.length; i++) {
        const key = previewStorage.key(i);
        if (key && key.startsWith(prefix) && key.endsWith(targetSuffix) && !visitedKeys.has(key)) {
          visitedKeys.add(key);
          const raw = safeGet<any>(key);
          if (Array.isArray(raw)) {
            results.push(...raw);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Deduplicate items if they have an id or reference
  const deduped: T[] = [];
  const seenKeys = new Set<string>();
  for (const item of results) {
    if (item && typeof item === "object") {
      const identifier = (item as any).id || (item as any).reference || (item as any).ref || (item as any).certificateNumber || (item as any).voNumber;
      if (identifier) {
        if (seenKeys.has(identifier)) continue;
        seenKeys.add(identifier);
      }
    }
    deduped.push(item);
  }
  return deduped;
}

/**
 * Retrieve single stored project object across standard key variations
 */
function getStoredProjectObject<T>(prefix: string, projectId: string, companyId?: string): T | null {
  const candidateKeys = [
    companyId && companyId !== "all" ? `${prefix}_${companyId}_${projectId}` : null,
    `${prefix}_default_company_${projectId}`,
    `${prefix}_all_${projectId}`,
    `${prefix}_default_${projectId}`,
    `${prefix}_${projectId}`
  ].filter(Boolean) as string[];

  for (const k of candidateKeys) {
    const raw = safeGet<T>(k);
    if (raw && typeof raw === "object") return raw;
  }
  return null;
}

/**
 * Build Financial Exposure table data across all projects dynamically aggregated from source Commercial records
 */
export function buildFinancialExposure(
  projects: CommandProject[],
  companyId: string = "all"
): FinancialExposureRow[] {
  return projects.map((proj) => {
    const pId = proj.id;

    // --- Retrieve Source Commercial Records for this Project ---
    const clientCerts = getStoredProjectRecords<any>("pm_commercial_v2_client_certificates", pId, companyId);
    const actualCosts = getStoredProjectRecords<any>("pm_commercial_v2_actual_costs", pId, companyId);
    const commitments = getStoredProjectRecords<any>("pm_commercial_v2_commitments", pId, companyId);
    const forecasts = getStoredProjectRecords<any>("pm_commercial_v2_forecasts", pId, companyId);
    const budgets = getStoredProjectRecords<any>("pm_commercial_v2_budgets", pId, companyId);
    const supplierInvoices = getStoredProjectRecords<any>("pm_commercial_v2_supplier_invoices", pId, companyId);
    const bankTransactions = getStoredProjectRecords<any>("pm_commercial_v2_bank_transactions", pId, companyId);
    const storedContract = getStoredProjectObject<any>("pm_commercial_v2_contract_values", pId, companyId);
    const contractVariations = getStoredProjectRecords<any>("pm_contract_variations", pId);
    const contractClaims = getStoredProjectRecords<any>("pm_contract_claims", pId);

    // 1. Project Value: Commercial → Contract / Budget → Current Contract Value
    let projectValue: number | null = null;
    if (storedContract?.revisedContractValue && parseNumericValue(storedContract.revisedContractValue) > 0) {
      projectValue = parseNumericValue(storedContract.revisedContractValue);
    } else if (storedContract?.originalContractValue && parseNumericValue(storedContract.originalContractValue) > 0) {
      projectValue = parseNumericValue(storedContract.originalContractValue) + parseNumericValue(storedContract.approvedVariations || 0);
    } else if (typeof proj.contractValueUSD === "number" && proj.contractValueUSD > 0) {
      projectValue = proj.contractValueUSD;
    } else {
      const realVal = getProjectRealContractValue(proj, companyId);
      if (realVal > 0) projectValue = realVal;
    }

    // 2. Outstanding Payments: Commercial → Client Accounts
    // Outstanding Payments = Certified/Invoiced Amount - Payments Received
    let outstanding: number | null = null;
    if (clientCerts.length > 0) {
      const validCerts = clientCerts.filter(c => c.status !== "Draft" && c.status !== "Rejected");
      if (validCerts.length > 0) {
        const sumUnpaid = validCerts.reduce((sum, c) => {
          const certAmt = parseNumericValue(c.certifiedAmount ?? c.invoicedAmount ?? c.appliedAmount ?? c.claimedAmount ?? 0);
          const paidAmt = parseNumericValue(c.paidAmount ?? 0);
          const retention = parseNumericValue(c.retentionWithheld ?? c.retentionDeducted ?? 0);
          return sum + Math.max(0, certAmt - retention - paidAmt);
        }, 0);
        outstanding = sumUnpaid > 0 ? sumUnpaid : null;
      }
    }
    if (outstanding === null && proj.outstandingCertificationUSD && proj.outstandingCertificationUSD > 0) {
      outstanding = proj.outstandingCertificationUSD;
    }

    // 3. Cost Overruns: Commercial → Budget & Forecast + Actual Costs + Commitments
    // Calculate:
    // Forecast Final Cost = Actual Cost to Date + Outstanding Commitments + Forecast Cost to Complete
    // Cost Overrun = MAX(0, Forecast Final Cost - Approved Cost Budget)

    // Actual Cost to Date
    const validActuals = actualCosts.filter(a => a.status !== "Rejected" && a.status !== "Draft");
    const actualCostToDate = validActuals.reduce((sum, a) => sum + (parseNumericValue(a.net) || parseNumericValue(a.total) || 0), 0);

    // Outstanding Commitments
    const validCommitments = commitments.filter(c => c.status !== "Cancelled" && c.status !== "Rejected");
    const outstandingCommitments = validCommitments.reduce((sum, c) => {
      const commVal = parseNumericValue(c.currentCommitment ?? c.originalValue ?? 0);
      const paidOrInvoiced = parseNumericValue(c.paid ?? c.invoiced ?? 0);
      return sum + Math.max(0, commVal - paidOrInvoiced);
    }, 0);

    // Forecast Cost to Complete
    const forecastCostToComplete = forecasts.reduce((sum, f) => sum + parseNumericValue(f.forecastToComplete || 0), 0);

    // Approved Cost Budget
    let approvedCostBudget = 0;
    if (budgets.length > 0) {
      approvedCostBudget = budgets.reduce((sum, b) => {
        const rev = parseNumericValue(b.revisedBudget);
        const orig = parseNumericValue(b.originalBudget);
        const chg = parseNumericValue(b.approvedChanges);
        return sum + (rev > 0 ? rev : (orig + chg));
      }, 0);
    } else if (projectValue && projectValue > 0) {
      approvedCostBudget = Math.round(projectValue * 0.85);
    }

    // Forecast Final Cost
    let forecastFinalCost = 0;
    const directFFC = forecasts.reduce((sum, f) => sum + parseNumericValue(f.forecastFinalCost || 0), 0);
    if (directFFC > 0) {
      forecastFinalCost = directFFC;
    } else if (forecasts.length > 0) {
      forecastFinalCost = actualCostToDate + outstandingCommitments + forecastCostToComplete;
    } else if (budgets.length > 0 || actualCosts.length > 0 || commitments.length > 0) {
      const remainingBudget = Math.max(0, approvedCostBudget - actualCostToDate - outstandingCommitments);
      forecastFinalCost = actualCostToDate + outstandingCommitments + remainingBudget;
    }

    // Cost Overrun
    let overrun: number | null = null;
    const hasCommercialCostData = actualCosts.length > 0 || commitments.length > 0 || forecasts.length > 0 || budgets.length > 0;

    if (hasCommercialCostData && approvedCostBudget > 0 && forecastFinalCost > approvedCostBudget) {
      overrun = Math.round(forecastFinalCost - approvedCostBudget);
    } else if (actualCostToDate > approvedCostBudget && approvedCostBudget > 0) {
      overrun = Math.round(actualCostToDate - approvedCostBudget);
    } else if (proj.cpi !== null && proj.cpi !== undefined && proj.cpi < 0.95 && (projectValue || proj.contractValueUSD)) {
      const cv = projectValue || proj.contractValueUSD!;
      const earned = cv * ((proj.progressPercent ?? 50) / 100);
      const actualEst = earned / proj.cpi;
      if (actualEst > earned) {
        overrun = Math.round(actualEst - earned);
      }
    }

    // 4. Variations / Claims: Commercial → Variations & Claims
    // Show total current financial exposure from submitted/pending/approved variations and claims
    let variations: number | null = null;

    // Contracts Governance Variations
    const voExposure = contractVariations
      .filter(v => v.status !== "Rejected")
      .reduce((sum, v) => sum + parseNumericValue(v.costImpact || v.cost || v.amount || 0), 0);

    // Contracts Claims
    const claimExposure = contractClaims
      .filter(c => c.status !== "Rejected")
      .reduce((sum, c) => sum + parseNumericValue(c.costImpact || c.claimedAmount || c.amount || 0), 0);

    // Commitments with variations
    const commitmentVoExposure = validCommitments
      .filter(c => c.type === "Approved Variation" || c.type === "Pending Variation" || (c.changes && parseNumericValue(c.changes) > 0))
      .reduce((sum, c) => sum + (parseNumericValue(c.changes) || parseNumericValue(c.currentCommitment) || parseNumericValue(c.originalValue) || 0), 0);

    // Budgets approved changes
    const budgetVoExposure = budgets.reduce((sum, b) => sum + parseNumericValue(b.approvedChanges || 0), 0);

    // Contract values variations
    const contractApprovedVo = parseNumericValue(storedContract?.approvedVariations || 0);

    const totalVoAndClaims = Math.max(
      voExposure + claimExposure,
      commitmentVoExposure + budgetVoExposure,
      contractApprovedVo
    );

    if (totalVoAndClaims > 0) {
      variations = totalVoAndClaims;
    } else if (voExposure + claimExposure + commitmentVoExposure + budgetVoExposure + contractApprovedVo > 0) {
      variations = voExposure + claimExposure + commitmentVoExposure + budgetVoExposure + contractApprovedVo;
    } else if (proj.claimsUnderAssessmentUSD && proj.claimsUnderAssessmentUSD > 0) {
      variations = proj.claimsUnderAssessmentUSD;
    }

    // 5. 30-Day Cashflow Risk: Commercial → Cash & Bank + Client Accounts + Commitments + Forecast
    // Expected 30-day Outflows - Expected 30-day Inflows (only show if adverse / positive exposure)
    let cashflowRisk: number | null = null;
    const hasCashRecords = supplierInvoices.length > 0 || bankTransactions.length > 0 || clientCerts.length > 0;

    if (hasCashRecords) {
      const unpaidInvoices = supplierInvoices
        .filter(i => i.paymentStatus !== "Paid" && i.status !== "Draft" && i.status !== "Rejected")
        .reduce((sum, i) => sum + Math.max(0, parseNumericValue(i.total || 0) - parseNumericValue(i.paidAmount || 0)), 0);

      const nearTermCommitmentOutflow = validCommitments
        .filter(c => c.status === "Approved" || c.status === "Submitted")
        .reduce((sum, c) => {
          const comm = parseNumericValue(c.currentCommitment ?? c.originalValue ?? 0);
          const paid = parseNumericValue(c.paid ?? c.invoiced ?? 0);
          return sum + Math.max(0, comm - paid);
        }, 0);

      const expectedOutflows = unpaidInvoices > 0 ? unpaidInvoices : (nearTermCommitmentOutflow * 0.3);
      const bankBalance = bankTransactions.reduce((sum, t) => sum + parseNumericValue(t.inflow || 0) - parseNumericValue(t.outflow || 0), 0);
      const expectedInflows = (outstanding || 0) + Math.max(0, bankBalance);

      if (expectedOutflows > expectedInflows) {
        cashflowRisk = Math.round(expectedOutflows - expectedInflows);
      }
    } else if (proj.cashRequirementUSD && proj.cashRequirementUSD > 0) {
      cashflowRisk = proj.cashRequirementUSD;
    }

    // 6. Forecast Margin: Commercial → Forecast
    // Forecast Margin = Forecast Revenue - Forecast Final Cost
    // Forecast Margin % = Forecast Margin / Forecast Revenue × 100
    let marginExposure: number | null = null;
    let marginVar: number | null = null;

    const forecastRevenue = projectValue || (approvedCostBudget > 0 ? approvedCostBudget * 1.15 : 0);

    if (forecastRevenue > 0 && (forecastFinalCost > 0 || actualCostToDate > 0)) {
      const effectiveFFC = forecastFinalCost > 0 ? forecastFinalCost : (actualCostToDate + outstandingCommitments);
      const forecastMargin = forecastRevenue - effectiveFFC;
      const forecastMarginPercent = Number(((forecastMargin / forecastRevenue) * 100).toFixed(1));

      let targetMarginPercent = proj.tenderMarginPercent;
      if (targetMarginPercent === null || targetMarginPercent === undefined) {
        if (approvedCostBudget > 0 && forecastRevenue > approvedCostBudget) {
          targetMarginPercent = Number((((forecastRevenue - approvedCostBudget) / forecastRevenue) * 100).toFixed(1));
        } else {
          targetMarginPercent = 15;
        }
      }

      if (targetMarginPercent > forecastMarginPercent) {
        marginVar = Number((targetMarginPercent - forecastMarginPercent).toFixed(1));
        marginExposure = Math.round(forecastRevenue * (marginVar / 100));
      }
    } else if (
      proj.forecastMarginPercent !== null &&
      proj.tenderMarginPercent !== null &&
      proj.tenderMarginPercent > proj.forecastMarginPercent &&
      (projectValue || proj.contractValueUSD)
    ) {
      const cv = projectValue || proj.contractValueUSD!;
      marginVar = Number((proj.tenderMarginPercent - proj.forecastMarginPercent).toFixed(1));
      marginExposure = Math.round(cv * (marginVar / 100));
    }

    // Dynamic explanation
    let explanation = "Financial controls within target parameters.";
    if (marginExposure && marginExposure > 0) {
      explanation = `Margin eroded by ${marginVar}% from tender target.`;
    } else if (overrun && overrun > 0) {
      explanation = `Forecast final cost exceeds approved baseline budget by ${overrun.toLocaleString()}.`;
    } else if (outstanding && outstanding > 0) {
      explanation = `Uncertified/unpaid client accounts valuation pending collection.`;
    } else if (variations && variations > 0) {
      explanation = `Active variations and contractual claims under negotiation.`;
    }

    // Dynamic underlying record path
    let dynamicRecordPath = `/commercial/overview?project=${pId}`;
    if (outstanding && outstanding > 0) {
      dynamicRecordPath = `/commercial/client-accounts?project=${pId}`;
    } else if (overrun && overrun > 0) {
      dynamicRecordPath = `/commercial/actual-costs?project=${pId}`;
    } else if (variations && variations > 0) {
      dynamicRecordPath = voExposure > 0 ? `/governance/contracts?project=${pId}&tab=variations` : `/commercial/budget-forecast?project=${pId}`;
    } else if (cashflowRisk && cashflowRisk > 0) {
      dynamicRecordPath = `/commercial/cash-bank?project=${pId}`;
    } else if (marginExposure && marginExposure > 0) {
      dynamicRecordPath = `/commercial/budget-forecast?project=${pId}`;
    }

    return {
      id: `fin-${pId}`,
      projectId: pId,
      projectCode: proj.code,
      projectName: proj.name,
      currencyCode: proj.currencyCode || "USD",
      contractValueUSD: projectValue && projectValue > 0 ? projectValue : null,
      outstandingCertificationUSD: outstanding,
      costOverrunUSD: overrun,
      variationsUSD: variations,
      cashflowRiskUSD: cashflowRisk,
      forecastMarginExposureUSD: marginExposure,
      marginVariancePercent: marginVar,
      underlyingRecordPath: dynamicRecordPath,
      exposureExplanation: explanation
    };
  });
}

/**
 * Build Programme Exposure table data
 */
export function buildProgrammeExposure(projects: CommandProject[]): ProgrammeExposureRow[] {
  return projects.map((proj) => {
    const pId = proj.id;
    let delayDays: number | null = null;
    let status: ProgrammeExposureRow["status"] = "On Track";

    if (proj.spi !== null) {
      if (proj.spi < 0.85) {
        status = "Critical Delay";
        delayDays = Math.round(((1 / proj.spi) - 1) * 90);
      } else if (proj.spi < 0.95) {
        status = "Delayed";
        delayDays = Math.round(((1 / proj.spi) - 1) * 60);
      }
    } else if (proj.targetPercent !== null && proj.progressPercent !== null && proj.targetPercent > proj.progressPercent) {
      const gap = proj.targetPercent - proj.progressPercent;
      if (gap > 10) {
        status = "Critical Delay";
        delayDays = Math.round(gap * 3);
      } else if (gap > 3) {
        status = "Delayed";
        delayDays = Math.round(gap * 2);
      }
    }

    let forecastDate: string | null = null;
    if (delayDays && delayDays > 0) {
      const target = new Date();
      target.setDate(target.getDate() + 90 + delayDays);
      forecastDate = target.toISOString().split("T")[0];
    } else if (proj.progressPercent !== null) {
      const target = new Date();
      target.setDate(target.getDate() + 90);
      forecastDate = target.toISOString().split("T")[0];
    }

    return {
      id: `prog-${pId}`,
      projectId: pId,
      projectCode: proj.code,
      projectName: proj.name,
      status,
      criticalPathIssue: proj.criticalActivity !== "-" ? proj.criticalActivity : "Site Works & Substructure",
      delayDays,
      spi: proj.spi,
      progressPercent: proj.progressPercent,
      targetPercent: proj.targetPercent,
      forecastCompletionDate: forecastDate,
      underlyingRecordPath: `/controls/programme?project=${pId}`,
      mitigationPlan: proj.mitigationAction !== "-" ? proj.mitigationAction : "Accelerate site plant hours and crew shifts."
    };
  });
}

/**
 * Build Forecast table data
 */
export function buildForecasts(projects: CommandProject[]): ForecastRow[] {
  return projects.map((proj) => {
    const pId = proj.id;

    // Trajectory calculation
    let trajectory: ForecastRow["trajectory"] = "Stable / On Target";
    let trajectoryColor: ForecastRow["trajectoryColor"] = "blue";

    const spi = proj.spi;
    const cpi = proj.cpi;

    if (spi !== null && cpi !== null) {
      if (spi < 0.88 || cpi < 0.88) {
        trajectory = "Critical Cost & Schedule Drift";
        trajectoryColor = "red";
      } else if (spi < 0.95 || cpi < 0.95) {
        trajectory = "Margin Pressure";
        trajectoryColor = "amber";
      } else if (spi >= 1.02 && cpi >= 1.02) {
        trajectory = "Profitable & Ahead";
        trajectoryColor = "emerald";
      } else {
        trajectory = "Stable / On Target";
        trajectoryColor = "blue";
      }
    } else if (proj.healthStatus === "Critical") {
      trajectory = "Critical Cost & Schedule Drift";
      trajectoryColor = "red";
    } else if (proj.healthStatus === "At Risk") {
      trajectory = "Margin Pressure";
      trajectoryColor = "amber";
    } else if (proj.healthStatus === "Healthy") {
      trajectory = "Profitable & Ahead";
      trajectoryColor = "emerald";
    }

    // CPI Trend
    let cpiTrend = "—";
    if (cpi !== null) {
      if (cpi > 1.02) cpiTrend = "Under Budget";
      else if (cpi >= 0.98) cpiTrend = "On Budget";
      else cpiTrend = "Over Budget";
    }

    // Margins
    const fm = proj.forecastMarginPercent;
    const tm = proj.tenderMarginPercent;
    const marginVar = (fm !== null && tm !== null) ? Number((fm - tm).toFixed(1)) : null;

    // Forecast Final Cost
    let forecastFinalCost: number | null = null;
    if (proj.contractValueUSD && fm !== null) {
      forecastFinalCost = Math.round(proj.contractValueUSD * (1 - fm / 100));
    }

    // Projected completion
    let projectedDate: string | null = null;
    if (proj.progressPercent !== null) {
      const now = new Date();
      const remainingDays = Math.max(30, Math.round((100 - proj.progressPercent) * 2.5));
      now.setDate(now.getDate() + remainingDays);
      projectedDate = now.toISOString().split("T")[0];
    }

    // Executive outlook
    let outlook = "Project maintaining expected commercial and operational delivery thresholds.";
    if (trajectory === "Critical Cost & Schedule Drift") {
      outlook = "Severe dual divergence in schedule and cost; contractual intervention mandatory.";
    } else if (trajectory === "Margin Pressure") {
      outlook = "Margin compression observed; strict change order and commitment controls required.";
    } else if (trajectory === "Profitable & Ahead") {
      outlook = "Optimal velocity with favorable cost performance ratio across critical milestones.";
    }

    return {
      id: `fc-${pId}`,
      projectId: pId,
      projectCode: proj.code,
      projectName: proj.name,
      currencyCode: proj.currencyCode || "USD",
      trajectory,
      trajectoryColor,
      progressPercent: proj.progressPercent,
      targetPercent: proj.targetPercent,
      cpi,
      cpiTrend,
      forecastMarginPercent: fm,
      tenderMarginPercent: tm,
      marginVariancePercent: marginVar,
      contractValueUSD: proj.contractValueUSD,
      forecastFinalCostUSD: forecastFinalCost,
      projectedCompletionDate: projectedDate,
      executiveOutlook: outlook,
      underlyingRecordPath: `/controls/forecast?project=${pId}`
    };
  });
}
