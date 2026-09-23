import { previewStorage } from "../integration/previewStorage";
import { CommandProject } from "../data/commandData";
import { ProjectRecord } from "./projectService";
import { CommercialWorkspaceService } from "./commercialWorkspaceService";
import { FinancialExposureRow } from "../pages/Command/executiveDecisionData";
import { getProjectRealContractValue } from "../utils/projectDataUtils";
import { supabase } from "../lib/supabase";

export interface CommercialRecordsBreakdown {
  clientCertificates: number;
  actualCosts: number;
  commitments: number;
  forecasts: number;
  budgets: number;
  supplierInvoices: number;
  bankTransactions: number;
  variationsAndClaims: number;
}

export interface RecalculationEngineResult {
  rows: FinancialExposureRow[];
  totalProjectsQueried: number;
  totalRecordsQueried: number;
  recordsBreakdown: CommercialRecordsBreakdown;
  recalculatedAt: Date;
  queryDurationMs: number;
  isDatabaseLive: boolean;
}

interface EngineProjectTarget {
  id: string;
  code: string;
  name: string;
  currencyCode: string;
  contractValueUSD: number | null;
  claimsUnderAssessmentUSD?: number | null;
  outstandingCertificationUSD?: number | null;
  costOverrunUSD?: number | null;
  cashRequirementUSD?: number | null;
  tenderMarginPercent?: number | null;
  forecastMarginPercent?: number | null;
  marginVariancePercent?: number | null;
  cpi?: number | null;
}

/**
 * Safely reads records stored by the application in localStorage as dual-layer cache
 */
function readStorageRecords<T = any>(key: string): T[] {
  try {
    const raw = previewStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Real-time Recalculation Engine for Commercial Exposure.
 * Triggers parallel database queries across commercial records for all active projects
 * and dynamically calculates Financial Exposure metrics adhering to MATRIX CONTROL standards.
 */
export async function queryRealtimeCommercialExposure(
  projects: (CommandProject | ProjectRecord)[],
  companyId: string,
  _options?: { signal?: AbortSignal }
): Promise<RecalculationEngineResult> {
  const startTime = performance.now();
  const effectiveCompanyId = companyId || "all";

  // Normalize project inputs into uniform interface
  const projectList: EngineProjectTarget[] = projects.map((p) => {
    const id = p.id;
    const code = p.code || "PRJ";
    const name = p.name || "Project";
    const currencyCode = (p as any).currencyCode || (p as any).currency || "USD";
    const realCv = getProjectRealContractValue(p as any);

    return {
      id,
      code,
      name,
      currencyCode,
      contractValueUSD: realCv ?? (p as any).contractValueUSD ?? null,
      claimsUnderAssessmentUSD: (p as any).claimsUnderAssessmentUSD ?? null,
      outstandingCertificationUSD: (p as any).outstandingCertificationUSD ?? null,
      costOverrunUSD: (p as any).costOverrunUSD ?? null,
      cashRequirementUSD: (p as any).cashRequirementUSD ?? null,
      tenderMarginPercent: (p as any).tenderMarginPercent ?? 15,
      forecastMarginPercent: (p as any).forecastMarginPercent ?? 12,
      marginVariancePercent: (p as any).marginVariancePercent ?? null,
      cpi: (p as any).cpi ?? null,
    };
  });

  let totalCertificatesCount = 0;
  let totalActualCostsCount = 0;
  let totalCommitmentsCount = 0;
  let totalForecastsCount = 0;
  let totalBudgetsCount = 0;
  let totalInvoicesCount = 0;
  let totalBankTxsCount = 0;
  let totalVariationsClaimsCount = 0;

  // Process all projects in parallel via asynchronous database queries
  const rows = await Promise.all(
    projectList.map(async (proj): Promise<FinancialExposureRow> => {
      const pId = proj.id;

      // 1. Parallel database queries for commercial records of this project
      const [
        contractData,
        certificates,
        actualCosts,
        commitments,
        forecastLines,
        budgetLines,
        supplierInvoices,
        bankTransactions,
      ] = await Promise.all([
        CommercialWorkspaceService.getContractValues(effectiveCompanyId, pId).catch(() => ({
          originalContractValue: null,
          approvedVariations: null,
          revisedContractValue: null,
        })),
        CommercialWorkspaceService.getClientCertificates(effectiveCompanyId, pId).catch(() => []),
        CommercialWorkspaceService.getActualCosts(effectiveCompanyId, pId).catch(() => []),
        CommercialWorkspaceService.getCommitments(effectiveCompanyId, pId).catch(() => []),
        CommercialWorkspaceService.getForecastLines(effectiveCompanyId, pId).catch(() => []),
        CommercialWorkspaceService.getBudgetLines(effectiveCompanyId, pId).catch(() => []),
        CommercialWorkspaceService.getSupplierInvoices(effectiveCompanyId, pId).catch(() => []),
        CommercialWorkspaceService.getBankTransactions(effectiveCompanyId, pId).catch(() => []),
      ]);

      // Read variations and claims registers
      const contractVariations = [
        ...readStorageRecords(`pm_contract_variations_${pId}`),
        ...readStorageRecords(`pm_contract_variations_${effectiveCompanyId}`),
      ];
      const contractClaims = [
        ...readStorageRecords(`pm_contract_claims_${pId}`),
        ...readStorageRecords(`pm_contract_claims_${effectiveCompanyId}`),
      ];

      // Tally record counts
      totalCertificatesCount += certificates.length;
      totalActualCostsCount += actualCosts.length;
      totalCommitmentsCount += commitments.length;
      totalForecastsCount += forecastLines.length;
      totalBudgetsCount += budgetLines.length;
      totalInvoicesCount += supplierInvoices.length;
      totalBankTxsCount += bankTransactions.length;
      totalVariationsClaimsCount += contractVariations.length + contractClaims.length;

      // --- 2. CALCULATE METRICS DYNAMICALLY ---

      // A. PROJECT VALUE (Current / Revised Contract Value)
      let dynamicContractVal: number | null = null;
      if (
        contractData.revisedContractValue !== null &&
        contractData.revisedContractValue !== undefined &&
        contractData.revisedContractValue > 0
      ) {
        dynamicContractVal = contractData.revisedContractValue;
      } else if (
        contractData.originalContractValue !== null &&
        contractData.originalContractValue !== undefined &&
        contractData.originalContractValue > 0
      ) {
        dynamicContractVal =
          (contractData.originalContractValue || 0) + (contractData.approvedVariations || 0);
      }
      const finalContractValue = dynamicContractVal || proj.contractValueUSD || null;

      // B. OUTSTANDING PAYMENTS
      // Sum of certified/invoiced amounts that remain unpaid: Outstanding = Certified - Retention - Paid
      const validCerts = certificates.filter(
        (c) => c.status !== "Draft" && c.status !== "Disputed"
      );

      let outstandingPaymentsUSD: number | null = null;
      if (validCerts.length > 0) {
        const sumUnpaid = validCerts.reduce((acc: number, cert) => {
          const gross =
            cert.certifiedAmount !== null && cert.certifiedAmount > 0
              ? cert.certifiedAmount
              : cert.appliedAmount || 0;
          const ret = cert.retentionWithheld || 0;
          const paid = cert.paidAmount || 0;
          const unpaidOnCert = Math.max(0, gross - ret - paid);
          return acc + unpaidOnCert;
        }, 0);
        outstandingPaymentsUSD = Math.round(sumUnpaid);
      } else if (proj.outstandingCertificationUSD !== undefined && proj.outstandingCertificationUSD !== null) {
        outstandingPaymentsUSD = proj.outstandingCertificationUSD;
      }

      // C. COST OVERRUNS
      // Forecast Final Cost = Actual Cost to Date + Outstanding Commitments + Forecast Cost to Complete
      // Cost Overruns = max(0, Forecast Final Cost - Approved Cost Budget)
      let costOverrunUSD: number | null = null;

      let sumActualCosts = 0;
      for (const item of actualCosts) {
        sumActualCosts += (item.net || item.total || 0);
      }

      let sumOutstandingCommitments = 0;
      for (const item of commitments) {
        const current = item.currentCommitment || item.originalValue || 0;
        const invoicedOrPaid = Math.max(item.invoiced || 0, item.paid || 0);
        sumOutstandingCommitments += Math.max(0, current - invoicedOrPaid);
      }

      let sumForecastToComplete = 0;
      for (const item of forecastLines) {
        sumForecastToComplete += (item.forecastToComplete || 0);
      }

      // Approved Cost Budget
      let sumApprovedBudget = 0;
      for (const line of budgetLines) {
        sumApprovedBudget += (line.revisedBudget || line.originalBudget || 0);
      }

      const hasCommercialCostRecords =
        actualCosts.length > 0 || commitments.length > 0 || forecastLines.length > 0 || budgetLines.length > 0;

      if (hasCommercialCostRecords && sumApprovedBudget > 0) {
        const calculatedFFC = sumActualCosts + sumOutstandingCommitments + sumForecastToComplete;
        if (calculatedFFC > sumApprovedBudget) {
          costOverrunUSD = Math.round(calculatedFFC - sumApprovedBudget);
        } else {
          costOverrunUSD = 0;
        }
      } else if (proj.costOverrunUSD !== undefined && proj.costOverrunUSD !== null) {
        costOverrunUSD = proj.costOverrunUSD;
      } else if (finalContractValue && proj.cpi && proj.cpi < 0.98) {
        const baseCost = finalContractValue * 0.85;
        const actualFromCpi = baseCost / proj.cpi;
        costOverrunUSD = Math.round(actualFromCpi - baseCost);
      }

      // D. VARIATIONS / CLAIMS
      let variationsUSD: number | null = null;
      let totalVariationClaimsSum = 0;

      contractVariations.forEach((v: any) => {
        if (v.status !== "Approved" && v.status !== "Rejected" && v.status !== "Cancelled") {
          totalVariationClaimsSum += v.claimedAmount || v.amount || v.estimatedCost || 0;
        }
      });
      contractClaims.forEach((c: any) => {
        if (c.status !== "Settled" && c.status !== "Rejected" && c.status !== "Withdrawn") {
          totalVariationClaimsSum += c.claimAmount || c.claimedValue || c.amount || 0;
        }
      });

      // Also incorporate commitment variations or changes
      commitments.forEach((cm) => {
        if (cm.changes && cm.changes > 0) {
          totalVariationClaimsSum += cm.changes;
        }
      });

      if (totalVariationClaimsSum > 0) {
        variationsUSD = Math.round(totalVariationClaimsSum);
      } else if (proj.claimsUnderAssessmentUSD !== undefined && proj.claimsUnderAssessmentUSD !== null) {
        variationsUSD = proj.claimsUnderAssessmentUSD;
      }

      // E. 30-DAY CASHFLOW RISK
      // Near term liabilities (unpaid supplier invoices due + near-term commitment payments)
      // vs near term inflows (bank balance + expected certified client payments)
      let cashflowRiskUSD: number | null = null;

      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const dueSupplierInvoices = supplierInvoices.filter((inv) => {
        if (inv.status === "Paid" || inv.status === "Overdue" || inv.status === "Rejected") return false;
        const due = new Date(inv.dueDate);
        return isNaN(due.getTime()) || due <= in30Days;
      });

      let supplierLiabilities = 0;
      for (const inv of dueSupplierInvoices) {
        supplierLiabilities += (inv.outstanding || inv.total || 0);
      }

      let bankBalance = 0;
      for (const tx of bankTransactions) {
        bankBalance += (tx.inflow || 0) - (tx.outflow || 0);
      }

      const expectedInflows = (outstandingPaymentsUSD || 0) * 0.75;
      const net30DayDeficit = supplierLiabilities - (Math.max(0, bankBalance) + expectedInflows);

      if (supplierInvoices.length > 0 || bankTransactions.length > 0) {
        if (net30DayDeficit > 0) {
          cashflowRiskUSD = Math.round(net30DayDeficit);
        } else {
          cashflowRiskUSD = 0;
        }
      } else if (proj.cashRequirementUSD !== undefined && proj.cashRequirementUSD !== null) {
        cashflowRiskUSD = proj.cashRequirementUSD;
      }

      // F. FORECAST MARGIN EXPOSURE & VARIANCE %
      let forecastMarginExposureUSD: number | null = null;
      let marginVariancePercent: number | null = null;

      const tenderMarginPct = proj.tenderMarginPercent ?? 15;
      let forecastMarginPct = proj.forecastMarginPercent ?? 15;

      if (finalContractValue && finalContractValue > 0 && costOverrunUSD && costOverrunUSD > 0) {
        const erosionPct = (costOverrunUSD / finalContractValue) * 100;
        forecastMarginPct = Math.max(-10, Math.round((tenderMarginPct - erosionPct) * 10) / 10);
      }

      const marginGap = tenderMarginPct - forecastMarginPct;
      if (marginGap > 0 && finalContractValue) {
        marginVariancePercent = Math.round(marginGap * 10) / 10;
        forecastMarginExposureUSD = Math.round((marginGap / 100) * finalContractValue);
      } else if (
        proj.marginVariancePercent !== undefined &&
        proj.marginVariancePercent !== null &&
        proj.marginVariancePercent > 0
      ) {
        marginVariancePercent = proj.marginVariancePercent;
        if (finalContractValue) {
          forecastMarginExposureUSD = Math.round(
            ((proj.marginVariancePercent || 0) / 100) * finalContractValue
          );
        }
      }

      // G. DETERMINE PRIMARY EXPOSURE DRIVER & TARGET NAVIGATION LINK
      let exposureExplanation = "All commercial metrics within tolerance.";
      let underlyingRecordPath = `/commercial/overview?project=${pId}`;

      const exposures = [
        {
          type: "outstanding",
          val: outstandingPaymentsUSD || 0,
          desc: `Outstanding client certificates of $${(outstandingPaymentsUSD || 0).toLocaleString()} awaiting collection`,
          path: `/commercial/client-accounts?project=${pId}`,
        },
        {
          type: "overrun",
          val: costOverrunUSD || 0,
          desc: `Forecast cost overrun of $${(costOverrunUSD || 0).toLocaleString()} against approved baseline budget`,
          path: `/commercial/actual-costs?project=${pId}`,
        },
        {
          type: "cashflow",
          val: cashflowRiskUSD || 0,
          desc: `30-day liquidity deficit risk of $${(cashflowRiskUSD || 0).toLocaleString()} against supplier liabilities`,
          path: `/commercial/cash-bank?project=${pId}`,
        },
        {
          type: "variations",
          val: variationsUSD || 0,
          desc: `Unapproved variations & disputed claims of $${(variationsUSD || 0).toLocaleString()}`,
          path: `/commercial/budget-forecast?project=${pId}`,
        },
        {
          type: "margin",
          val: forecastMarginExposureUSD || 0,
          desc: `Projected margin erosion of $${(forecastMarginExposureUSD || 0).toLocaleString()} (-${marginVariancePercent}% gap)`,
          path: `/commercial/budget-forecast?project=${pId}`,
        },
      ];

      exposures.sort((a, b) => b.val - a.val);
      const topDriver = exposures[0];

      if (topDriver && topDriver.val > 0) {
        exposureExplanation = topDriver.desc;
        underlyingRecordPath = topDriver.path;
      }

      return {
        id: `fin-exp-${pId}`,
        projectId: pId,
        projectCode: proj.code || "PRJ",
        projectName: proj.name || "Project",
        currencyCode: proj.currencyCode || "USD",
        contractValueUSD: finalContractValue,
        outstandingCertificationUSD: outstandingPaymentsUSD,
        costOverrunUSD,
        variationsUSD,
        cashflowRiskUSD,
        forecastMarginExposureUSD,
        marginVariancePercent,
        underlyingRecordPath,
        exposureExplanation,
      };
    })
  );

  const durationMs = Math.round(performance.now() - startTime);
  const totalRecords =
    totalCertificatesCount +
    totalActualCostsCount +
    totalCommitmentsCount +
    totalForecastsCount +
    totalBudgetsCount +
    totalInvoicesCount +
    totalBankTxsCount +
    totalVariationsClaimsCount;

  return {
    rows,
    totalProjectsQueried: projectList.length,
    totalRecordsQueried: totalRecords,
    recordsBreakdown: {
      clientCertificates: totalCertificatesCount,
      actualCosts: totalActualCostsCount,
      commitments: totalCommitmentsCount,
      forecasts: totalForecastsCount,
      budgets: totalBudgetsCount,
      supplierInvoices: totalInvoicesCount,
      bankTransactions: totalBankTxsCount,
      variationsAndClaims: totalVariationsClaimsCount,
    },
    recalculatedAt: new Date(),
    queryDurationMs: durationMs,
    isDatabaseLive: Boolean(supabase),
  };
}
