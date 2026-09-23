/**
 * Pure core logic module for Project Advisor Edge Function and test suite.
 * Contains deterministic financial aggregation, safe numeric parsing,
 * context budget enforcement, and source validation.
 */

export interface AdvisorSource {
  key: string;
  table: string; // Clean module name, e.g. "Survey Control Points"
  id: string;    // Clean user-facing key, e.g. "SURVEYCP-1"
  label: string;
  summary: string;
}

export function buildProjectQueryFilter(
  scope: string,
  projectId: string | null,
  authorisedProjectIds: string[]
): { isAllowed: boolean; targetProjectIds: string[] } {
  if (!authorisedProjectIds || authorisedProjectIds.length === 0) {
    return { isAllowed: false, targetProjectIds: [] };
  }

  if (scope === "project") {
    if (!projectId || !authorisedProjectIds.includes(projectId)) {
      return { isAllowed: false, targetProjectIds: [] };
    }
    return { isAllowed: true, targetProjectIds: [projectId] };
  }

  return { isAllowed: true, targetProjectIds: authorisedProjectIds };
}

export function validateConversationContext(
  conv: { company_id: string; project_id?: string | null; scope?: string } | null | undefined,
  currentCompanyId: string,
  currentProjectId: string | null,
  currentScope: "project" | "company"
): boolean {
  if (!conv) return false;
  if (conv.company_id !== currentCompanyId) return false;

  if (conv.scope && conv.scope !== currentScope) return false;

  if (currentScope === "project") {
    if (!currentProjectId) return false;
    if (conv.project_id && conv.project_id !== currentProjectId) return false;
  } else if (currentScope === "company") {
    if (conv.project_id) return false;
  }

  return true;
}

export function validateSubmissionSnapshot(snapshot: {
  companyId: string;
  projectId: string | null;
  scope: "project" | "company";
  conversation: { company_id: string; project_id?: string | null; scope?: string } | null;
}): { isValid: boolean; reason?: string } {
  if (!snapshot.companyId) {
    return { isValid: false, reason: "Active company required." };
  }
  if (snapshot.scope === "project" && !snapshot.projectId) {
    return { isValid: false, reason: "Active project required for project scope." };
  }
  if (snapshot.conversation) {
    const isContextValid = validateConversationContext(
      snapshot.conversation,
      snapshot.companyId,
      snapshot.projectId,
      snapshot.scope
    );
    if (!isContextValid) {
      return { isValid: false, reason: "Conversation context mismatch." };
    }
  }
  return { isValid: true };
}

export function filterConversationsByContext(
  conversations: any[],
  companyId: string,
  projectId: string | null,
  scope: "project" | "company"
): any[] {
  if (!conversations || !Array.isArray(conversations)) return [];
  return conversations.filter((c) => validateConversationContext(c, companyId, projectId, scope));
}

export function buildSafeCompanyProjectDirectory(
  companyProjects: any[],
  activeProjectId: string | null
): { total_authorised_projects: number; projects: any[] } {
  const safeList = (companyProjects || []).map((p: any, idx: number) => {
    const sKey = `PROJDIR-${(idx + 1).toString().padStart(3, "0")}`;
    return {
      source_key: sKey,
      name: p.name,
      project_code: p.contract_code || p.code || null,
      status: p.status || null,
      is_active_project: p.id === activeProjectId,
    };
  });

  return {
    total_authorised_projects: safeList.length,
    projects: safeList,
  };
}

export function sanitiseDbError(err: any): string {
  if (!err) return "";
  return "Database query error occurred while retrieving project records.";
}

export function parseFiniteNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === "" || typeof val === "boolean") {
    return fallback;
  }
  const num = Number(val);
  if (typeof num === "number" && Number.isFinite(num)) {
    return num;
  }
  return fallback;
}

export interface AuthoritativeBudgetResult {
  authoritativeBudgets: any[];
  deficiencies: string[];
  hasAmbiguity: boolean;
}

export function selectAuthoritativeBudgets(rawBudgets: any[]): AuthoritativeBudgetResult {
  const deficiencies: string[] = [];
  let hasAmbiguity = false;

  const approvedBudgets = rawBudgets.filter((b) => {
    const status = String(b.status || "").trim();
    return status === "Approved" && !b.is_archived;
  });

  const byProject = new Map<string, any[]>();
  for (const b of approvedBudgets) {
    const pId = String(b.project_id || "unknown");
    if (!byProject.has(pId)) byProject.set(pId, []);
    byProject.get(pId)!.push(b);
  }

  const authoritativeBudgets: any[] = [];

  for (const [pId, items] of byProject.entries()) {
    items.sort((a, b) => {
      const vA = parseFiniteNumber(a.version_number, 0);
      const vB = parseFiniteNumber(b.version_number, 0);
      if (vB !== vA) return vB - vA;
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });

    const highestVer = parseFiniteNumber(items[0].version_number, 0);
    const duplicateHighest = items.filter(
      (b) => parseFiniteNumber(b.version_number, 0) === highestVer
    );

    if (duplicateHighest.length > 1) {
      deficiencies.push(
        `Duplicate approved budget version_number [${highestVer}] detected for project_id [${pId}]. Budget baseline is ambiguous.`
      );
      hasAmbiguity = true;
    } else {
      authoritativeBudgets.push(items[0]);
    }
  }

  return { authoritativeBudgets, deficiencies, hasAmbiguity };
}

export function selectAuthoritativeForecasts(
  rawForecasts: any[],
  authorisedProjectIds: string[]
): { authoritativeForecasts: any[]; coverageStatus: string; missingProjectIds: string[] } {
  const approvedForecasts = rawForecasts.filter((f) => {
    const status = String(f.status || "").trim();
    return status === "Approved" && !f.is_archived;
  });

  const byProject = new Map<string, any[]>();
  for (const f of approvedForecasts) {
    const pId = String(f.project_id || "unknown");
    if (!byProject.has(pId)) byProject.set(pId, []);
    byProject.get(pId)!.push(f);
  }

  const authoritativeForecasts: any[] = [];
  for (const [pId, items] of byProject.entries()) {
    items.sort((a, b) => {
      const vA = parseFiniteNumber(a.version_number, 0);
      const vB = parseFiniteNumber(b.version_number, 0);
      if (vB !== vA) return vB - vA;
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });
    authoritativeForecasts.push(items[0]);
  }

  const projectsWithForecast = new Set(authoritativeForecasts.map((f) => f.project_id));
  const missingProjectIds = authorisedProjectIds.filter((id) => !projectsWithForecast.has(id));

  const coverageStatus =
    missingProjectIds.length === 0
      ? "complete"
      : `incomplete (${missingProjectIds.length} projects missing approved forecast)`;

  return { authoritativeForecasts, coverageStatus, missingProjectIds };
}

export interface FinancialSummaryParams {
  rawBudgets: any[];
  rawCommitments: any[];
  rawCostPostings: any[];
  rawForecasts: any[];
  authorisedProjectIds: string[];
  budgetsStatus?: "ok" | "empty" | "error" | "unavailable";
  commitmentsStatus?: "ok" | "empty" | "error" | "unavailable";
  costPostingsStatus?: "ok" | "empty" | "error" | "unavailable";
  forecastsStatus?: "ok" | "empty" | "error" | "unavailable";
}

export interface FinancialSummaryResult {
  currency_code: string;
  has_mixed_currencies?: boolean;
  authoritative_approved_budget_versions_count: number | null;
  current_approved_budget_excl_vat: number | null;
  actual_cost_to_date_excl_vat: number | null;
  total_commitments_excl_vat: number | null;
  posted_committed_cost_excl_vat: number | null;
  outstanding_commitment_exposure_excl_vat: number | null;
  uncommitted_estimate_to_complete_excl_vat: number | null;
  forecast_final_cost_excl_vat: number | null;
  cost_to_complete_excl_vat: number | null;
  remaining_budget_against_actual_cost_excl_vat: number | null;
  forecast_variance_against_budget_excl_vat: number | null;
  forecast_contract_revenue_excl_vat: number | null;
  forecast_coverage_status: string;
  database_deficiencies: string[];
  budgets_retrieval_status: "ok" | "empty" | "error" | "unavailable";
  commitments_retrieval_status: "ok" | "empty" | "error" | "unavailable";
  cost_postings_retrieval_status: "ok" | "empty" | "error" | "unavailable";
  forecasts_retrieval_status: "ok" | "empty" | "error" | "unavailable";
}

export function calculateFinancialSummary(params: FinancialSummaryParams): FinancialSummaryResult {
  const {
    rawBudgets,
    rawCommitments,
    rawCostPostings,
    rawForecasts,
    authorisedProjectIds,
    budgetsStatus = "ok",
    commitmentsStatus = "ok",
    costPostingsStatus = "ok",
    forecastsStatus = "ok",
  } = params;

  const databaseDeficiencies: string[] = [];

  // Query Error Checks
  const bErr = budgetsStatus === "error";
  const cErr = commitmentsStatus === "error";
  const pErr = costPostingsStatus === "error";
  const fErr = forecastsStatus === "error";

  if (bErr) {
    databaseDeficiencies.push("Budget retrieval query failed; budget-related metrics are unavailable.");
  }
  if (cErr) {
    databaseDeficiencies.push("Commitment retrieval query failed; commitment exposure and dependent metrics are unavailable.");
  }
  if (pErr) {
    databaseDeficiencies.push("Cost posting retrieval query failed; actual-cost and dependent metrics are unavailable.");
  }
  if (fErr) {
    databaseDeficiencies.push("Forecast retrieval query failed; forecast metrics and forecast coverage are unavailable.");
  }

  // 1. Authoritative Budgets
  const { authoritativeBudgets, deficiencies: budgetDeficiencies } = !bErr
    ? selectAuthoritativeBudgets(rawBudgets)
    : { authoritativeBudgets: [], deficiencies: [] };
  databaseDeficiencies.push(...budgetDeficiencies);

  // 2. Authoritative Forecasts
  let authoritativeForecasts: any[] = [];
  let coverageStatus = "unavailable (forecast query error)";
  if (!fErr) {
    const fcRes = selectAuthoritativeForecasts(rawForecasts, authorisedProjectIds);
    authoritativeForecasts = fcRes.authoritativeForecasts;
    coverageStatus = fcRes.coverageStatus;
  }

  // 3. Filter valid Commitments ('Approved' or 'Closed' and non-archived)
  const validCommitments = !cErr
    ? rawCommitments.filter((c) => {
        const status = String(c.status || "").trim();
        return (status === "Approved" || status === "Closed") && !c.is_archived;
      })
    : [];

  // 4. Filter valid Cost Postings ('Posted' and non-archived)
  const validPostings = !pErr
    ? rawCostPostings.filter((p) => {
        const status = String(p.status || "").trim();
        return status === "Posted" && !p.is_archived;
      })
    : [];

  // Currency validation across all non-archived qualifying records
  const rawCurrenciesSet = new Set<string>();
  for (const c of validCommitments) {
    if (c.currency_code) rawCurrenciesSet.add(String(c.currency_code).trim().toUpperCase());
  }
  for (const p of validPostings) {
    if (p.currency_code) rawCurrenciesSet.add(String(p.currency_code).trim().toUpperCase());
  }
  for (const b of authoritativeBudgets) {
    if (b.currency_code) rawCurrenciesSet.add(String(b.currency_code).trim().toUpperCase());
  }
  for (const f of authoritativeForecasts) {
    if (f.currency_code) rawCurrenciesSet.add(String(f.currency_code).trim().toUpperCase());
  }

  const distinctCurrencies = Array.from(rawCurrenciesSet);
  const hasMixedCurrencies = distinctCurrencies.length > 1;

  if (hasMixedCurrencies) {
    databaseDeficiencies.push(
      `Mixed currencies detected ([${distinctCurrencies.join(", ")}]). Multi-currency aggregated totals are marked unavailable to prevent inaccurate financial summation.`
    );
  } else if (distinctCurrencies.length === 1 && distinctCurrencies[0] !== "ZAR") {
    databaseDeficiencies.push(`Non-ZAR currency [${distinctCurrencies[0]}] detected across financial records. Summary presented in ${distinctCurrencies[0]}.`);
  }

  const summaryCurrency = hasMixedCurrencies ? "MIXED" : distinctCurrencies[0] || "ZAR";

  // Calculate actual cost to date
  let actualCostToDateExclVat: number | null = null;
  if (!pErr) {
    actualCostToDateExclVat = 0;
    for (const p of validPostings) {
      const amt = parseFiniteNumber(p.amount_excl_vat, 0);
      const entryType = String(p.entry_type || "Cost").trim();
      if (entryType === "Reversal") {
        actualCostToDateExclVat -= amt;
      } else {
        actualCostToDateExclVat += amt;
      }
    }
  }

  // Group posted costs by commitment_id with strict linkage validation
  const validCommitmentMap = new Map<string, any>();
  for (const c of validCommitments) {
    validCommitmentMap.set(String(c.id), c);
  }

  const postedByCommitment = new Map<string, number>();
  let postedCommittedCostExclVat: number | null = null;

  if (!pErr && !cErr) {
    postedCommittedCostExclVat = 0;
    for (const p of validPostings) {
      if (p.commitment_id) {
        const cId = String(p.commitment_id);
        const linkedCommitment = validCommitmentMap.get(cId);

        if (!linkedCommitment) {
          databaseDeficiencies.push(
            `Cost posting [${p.posting_reference || p.id}] references unknown or unapproved commitment [${cId}]. Link ignored for commitment exposure calculation (counts in actual cost).`
          );
          continue;
        }

        // Validate project_id match
        if (p.project_id && linkedCommitment.project_id && p.project_id !== linkedCommitment.project_id) {
          databaseDeficiencies.push(
            `Cost posting [${p.posting_reference || p.id}] project_id [${p.project_id}] does not match linked commitment project_id [${linkedCommitment.project_id}]. Link ignored for commitment exposure calculation.`
          );
          continue;
        }

        // Validate company_id match if present
        if (p.company_id && linkedCommitment.company_id && p.company_id !== linkedCommitment.company_id) {
          databaseDeficiencies.push(
            `Cost posting [${p.posting_reference || p.id}] company_id [${p.company_id}] does not match linked commitment company_id [${linkedCommitment.company_id}]. Link ignored for commitment exposure calculation.`
          );
          continue;
        }

        // Validate currency_code match if present
        const pCurr = p.currency_code ? String(p.currency_code).toUpperCase() : null;
        const cCurr = linkedCommitment.currency_code ? String(linkedCommitment.currency_code).toUpperCase() : null;
        if (pCurr && cCurr && pCurr !== cCurr) {
          databaseDeficiencies.push(
            `Cost posting [${p.posting_reference || p.id}] currency [${pCurr}] does not match linked commitment currency [${cCurr}]. Link ignored for commitment exposure calculation.`
          );
          continue;
        }

        const amt = parseFiniteNumber(p.amount_excl_vat, 0);
        const entryType = String(p.entry_type || "Cost").trim();
        const signedAmt = entryType === "Reversal" ? -amt : amt;

        postedByCommitment.set(cId, (postedByCommitment.get(cId) || 0) + signedAmt);
        postedCommittedCostExclVat += signedAmt;
      }
    }
  }

  // Calculate commitments exposure per commitment
  let totalCommitmentsExclVat: number | null = null;
  let outstandingCommitmentExposureExclVat: number | null = null;

  if (!cErr) {
    totalCommitmentsExclVat = 0;
    outstandingCommitmentExposureExclVat = 0;

    for (const c of validCommitments) {
      const revisedAmt = parseFiniteNumber(c.revised_commitment_excl_vat, 0);
      totalCommitmentsExclVat += revisedAmt;

      let postedAgainstC = postedByCommitment.get(String(c.id)) || 0;
      if (postedAgainstC < 0) {
        databaseDeficiencies.push(
          `Commitment [${c.commitment_reference || c.id}] has net negative posted cost (${postedAgainstC}) due to reversals. Capped at 0 for exposure calculation.`
        );
        postedAgainstC = 0;
      }

      // Exposure cannot be negative for over-posted commitments
      const exposureForC = Math.max(0, revisedAmt - postedAgainstC);
      outstandingCommitmentExposureExclVat += exposureForC;
    }
  }

  // Current Approved Budget
  let currentApprovedBudgetExclVat: number | null = null;
  if (!bErr) {
    currentApprovedBudgetExclVat = authoritativeBudgets.reduce(
      (sum: number, b: any) => sum + parseFiniteNumber(b.current_budget_excl_vat, 0),
      0
    );
  }

  // Uncommitted ETC & Forecast Revenue
  let uncommittedEstimateToCompleteExclVat: number | null = null;
  let forecastContractRevenueExclVat: number | null = null;
  if (!fErr) {
    uncommittedEstimateToCompleteExclVat = authoritativeForecasts.reduce(
      (sum: number, f: any) => sum + parseFiniteNumber(f.uncommitted_estimate_to_complete_excl_vat, 0),
      0
    );

    forecastContractRevenueExclVat = authoritativeForecasts.reduce(
      (sum: number, f: any) => sum + parseFiniteNumber(f.forecast_contract_revenue_excl_vat, 0),
      0
    );
  }

  // Compound Formulas (Null out if any component query failed or if mixed currencies)
  let costToCompleteExclVat: number | null = null;
  if (outstandingCommitmentExposureExclVat !== null && uncommittedEstimateToCompleteExclVat !== null) {
    costToCompleteExclVat = outstandingCommitmentExposureExclVat + uncommittedEstimateToCompleteExclVat;
  }

  let forecastFinalCostExclVat: number | null = null;
  if (actualCostToDateExclVat !== null && costToCompleteExclVat !== null) {
    forecastFinalCostExclVat = actualCostToDateExclVat + costToCompleteExclVat;
  }

  let remainingBudgetAgainstActualCostExclVat: number | null = null;
  if (currentApprovedBudgetExclVat !== null && actualCostToDateExclVat !== null) {
    remainingBudgetAgainstActualCostExclVat = currentApprovedBudgetExclVat - actualCostToDateExclVat;
  }

  let forecastVarianceAgainstBudgetExclVat: number | null = null;
  if (currentApprovedBudgetExclVat !== null && forecastFinalCostExclVat !== null) {
    forecastVarianceAgainstBudgetExclVat = currentApprovedBudgetExclVat - forecastFinalCostExclVat;
  }

  // Null out totals if mixed currencies occurred
  if (hasMixedCurrencies) {
    currentApprovedBudgetExclVat = null;
    actualCostToDateExclVat = null;
    totalCommitmentsExclVat = null;
    postedCommittedCostExclVat = null;
    outstandingCommitmentExposureExclVat = null;
    uncommittedEstimateToCompleteExclVat = null;
    forecastFinalCostExclVat = null;
    costToCompleteExclVat = null;
    remainingBudgetAgainstActualCostExclVat = null;
    forecastVarianceAgainstBudgetExclVat = null;
    forecastContractRevenueExclVat = null;
  }

  return {
    currency_code: summaryCurrency,
    has_mixed_currencies: hasMixedCurrencies,
    authoritative_approved_budget_versions_count: bErr ? null : authoritativeBudgets.length,
    current_approved_budget_excl_vat: currentApprovedBudgetExclVat,
    actual_cost_to_date_excl_vat: actualCostToDateExclVat,
    total_commitments_excl_vat: totalCommitmentsExclVat,
    posted_committed_cost_excl_vat: postedCommittedCostExclVat,
    outstanding_commitment_exposure_excl_vat: outstandingCommitmentExposureExclVat,
    uncommitted_estimate_to_complete_excl_vat: uncommittedEstimateToCompleteExclVat,
    forecast_final_cost_excl_vat: forecastFinalCostExclVat,
    cost_to_complete_excl_vat: costToCompleteExclVat,
    remaining_budget_against_actual_cost_excl_vat: remainingBudgetAgainstActualCostExclVat,
    forecast_variance_against_budget_excl_vat: forecastVarianceAgainstBudgetExclVat,
    forecast_contract_revenue_excl_vat: forecastContractRevenueExclVat,
    forecast_coverage_status: coverageStatus,
    database_deficiencies: databaseDeficiencies,
    budgets_retrieval_status: budgetsStatus,
    commitments_retrieval_status: commitmentsStatus,
    cost_postings_retrieval_status: costPostingsStatus,
    forecasts_retrieval_status: forecastsStatus,
  };
}

export interface ContextBudgetResult {
  liveContext: any;
  configured_cap: number;
  final_serialized_character_count: number;
  reduced_categories: string[];
  omitted_categories: string[];
  context_warning?: string;
  error?: string;
}

export function enforceContextBudget(liveContext: any, maxChars = 22000): ContextBudgetResult {
  const reduced_categories: string[] = [];
  const omitted_categories: string[] = [];

  let serialized = JSON.stringify(liveContext);

  if (serialized.length <= maxChars) {
    return {
      liveContext,
      configured_cap: maxChars,
      final_serialized_character_count: serialized.length,
      reduced_categories: [],
      omitted_categories: [],
    };
  }

  const nonFinancialKeys = [
    "survey_control_points",
    "survey_instruments",
    "fleet_assets",
    "quality_control_records",
    "technical_reports",
    "reports",
    "project_documents",
    "communication_documents",
    "site_diaries",
    "programme_activities",
    "programmes",
    "procurement_items",
    "labour_payrolls",
    "supplier_invoices",
    "supplier_accounts",
  ];

  const financialKeys = [
    "financial_forecasts",
    "cost_postings",
    "financial_commitments",
    "budget_versions",
  ];

  // Include any custom module keys in liveContext.modules
  const allModuleKeys = Object.keys(liveContext.modules || {});
  for (const k of allModuleKeys) {
    if (!nonFinancialKeys.includes(k) && !financialKeys.includes(k)) {
      nonFinancialKeys.push(k);
    }
  }

  // Pass 1: Reduce non-financial item lists to max 5
  for (const modKey of nonFinancialKeys) {
    if (serialized.length <= maxChars) break;
    const mod = liveContext.modules?.[modKey];
    if (mod && Array.isArray(mod.items) && mod.items.length > 5) {
      mod.items = mod.items.slice(0, 5);
      mod.count = mod.items.length;
      mod.truncated = true;
      if (!reduced_categories.includes(modKey)) reduced_categories.push(modKey);
      serialized = JSON.stringify(liveContext);
    }
  }

  // Pass 2: Reduce non-financial item lists to max 2
  if (serialized.length > maxChars) {
    for (const modKey of nonFinancialKeys) {
      if (serialized.length <= maxChars) break;
      const mod = liveContext.modules?.[modKey];
      if (mod && Array.isArray(mod.items) && mod.items.length > 2) {
        mod.items = mod.items.slice(0, 2);
        mod.count = mod.items.length;
        mod.truncated = true;
        if (!reduced_categories.includes(modKey)) reduced_categories.push(modKey);
        serialized = JSON.stringify(liveContext);
      }
    }
  }

  // Pass 3: Omit non-financial items completely
  if (serialized.length > maxChars) {
    for (const modKey of nonFinancialKeys) {
      if (serialized.length <= maxChars) break;
      const mod = liveContext.modules?.[modKey];
      if (mod && Array.isArray(mod.items) && mod.items.length > 0) {
        mod.items = [];
        mod.count = 0;
        mod.truncated = true;
        if (!omitted_categories.includes(modKey)) omitted_categories.push(modKey);
        serialized = JSON.stringify(liveContext);
      }
    }
  }

  // Pass 4: Reduce financial explanatory items to max 2
  if (serialized.length > maxChars) {
    for (const modKey of financialKeys) {
      if (serialized.length <= maxChars) break;
      const mod = liveContext.modules?.[modKey];
      if (mod && Array.isArray(mod.items) && mod.items.length > 2) {
        mod.items = mod.items.slice(0, 2);
        mod.count = mod.items.length;
        mod.truncated = true;
        if (!reduced_categories.includes(modKey)) reduced_categories.push(modKey);
        serialized = JSON.stringify(liveContext);
      }
    }
  }

  // Pass 5: Omit financial explanatory items (retaining financial_summary intact)
  if (serialized.length > maxChars) {
    for (const modKey of financialKeys) {
      if (serialized.length <= maxChars) break;
      const mod = liveContext.modules?.[modKey];
      if (mod && Array.isArray(mod.items) && mod.items.length > 0) {
        mod.items = [];
        mod.count = 0;
        mod.truncated = true;
        if (!omitted_categories.includes(modKey)) omitted_categories.push(modKey);
        serialized = JSON.stringify(liveContext);
      }
    }
  }

  // Final assertion
  serialized = JSON.stringify(liveContext);
  if (serialized.length > maxChars) {
    return {
      liveContext,
      configured_cap: maxChars,
      final_serialized_character_count: serialized.length,
      reduced_categories,
      omitted_categories,
      error: `Operational context exceeded maximum limit of ${maxChars} characters despite full reduction.`,
    };
  }

  const context_warning = `Context size approached hard limit (${maxChars} chars); lower-priority items were trimmed to fit.`;

  return {
    liveContext,
    configured_cap: maxChars,
    final_serialized_character_count: serialized.length,
    reduced_categories,
    omitted_categories,
    context_warning,
  };
}

export function parseGeminiResponse(
  rawText: string,
  sourceCatalogue: Map<string, any>
): { answer: string; confidence: string; sources: AdvisorSource[]; draft?: any } {
  let parsed: any = null;
  let cleanText = rawText.trim();

  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  try {
    parsed = JSON.parse(cleanText);
  } catch {
    parsed = {
      answer: rawText,
      confidence: "Medium",
      sources: [],
    };
  }

  let rawAnswer = String(parsed.answer || rawText || "");
  const rawConfidence = String(parsed.confidence || "High");
  const rawSourcesList = Array.isArray(parsed.sources) ? parsed.sources : [];

  // Strip unknown citation tokens like [FABRICATED-999] embedded in answer text
  if (sourceCatalogue) {
    rawAnswer = rawAnswer.replace(/\[([A-Z0-9_-]+)\]/g, (match, key) => {
      if (sourceCatalogue.has(key)) {
        return match;
      }
      return "";
    });
  }

  rawAnswer = sanitiseAnswerInternalPaths(rawAnswer);

  const sources: AdvisorSource[] = [];
  for (const k of rawSourcesList) {
    const catalogItem = sourceCatalogue.get(String(k.source_key || k).trim());
    if (catalogItem) {
      sources.push({
        key: catalogItem.key,
        table: catalogItem.module,
        id: catalogItem.key,
        label: catalogItem.label,
        summary: k.summary || catalogItem.summary,
      });
    }
  }

  return {
    answer: rawAnswer,
    confidence: rawConfidence,
    sources,
    draft: parsed.draft || undefined,
  };
}

const STORE_NAME_PATTERN = /^fileSearchStores\/[a-z0-9-]{1,40}$/;

export function isValidStoreName(storeName: unknown): storeName is string {
  return typeof storeName === "string" && STORE_NAME_PATTERN.test(storeName);
}

export function validateAndDeduplicateStoreNames(storeRows: any[]): string[] {
  if (!Array.isArray(storeRows)) return [];
  const validSet = new Set<string>();
  for (const row of storeRows) {
    if (row && (row.status === "ready" || !row.status)) {
      const storeName = row.provider_store_name;
      if (isValidStoreName(storeName)) {
        validSet.add(storeName);
      }
    }
  }
  return Array.from(validSet);
}

export function filterStoresByScopeAndAuthorization(
  stores: any[],
  scope: string,
  companyId: string,
  targetProjectIds: string[]
): any[] {
  if (!Array.isArray(stores) || !companyId || !Array.isArray(targetProjectIds) || targetProjectIds.length === 0) {
    return [];
  }
  const allowedSet = new Set(targetProjectIds);
  return stores.filter((s) => {
    if (!s || s.company_id !== companyId) return false;
    if (!allowedSet.has(s.project_id)) return false;
    if (s.status && s.status !== "ready") return false;
    return isValidStoreName(s.provider_store_name);
  });
}

export function buildFileSearchToolConfig(
  storeNames: string[]
): { fileSearch: { fileSearchStoreNames: string[] } } | null {
  if (!Array.isArray(storeNames) || storeNames.length === 0) {
    return null;
  }

  const validStores = storeNames.filter(isValidStoreName);
  if (validStores.length === 0) return null;

  return {
    fileSearch: {
      fileSearchStoreNames: Array.from(new Set(validStores)),
    },
  };
}

export function filterIndexedDocsByScopeAndAuthorization(
  docs: any[],
  companyId: string,
  targetProjectIds: string[]
): any[] {
  if (!Array.isArray(docs) || !companyId || !Array.isArray(targetProjectIds) || targetProjectIds.length === 0) {
    return [];
  }
  const allowedSet = new Set(targetProjectIds);
  return docs.filter((d) => {
    if (!d || d.company_id !== companyId) return false;
    if (!allowedSet.has(d.project_id)) return false;
    if (d.status && d.status !== "ready") return false;
    return true;
  });
}

export interface SafeFilePresenceItem {
  source_key: string;
  communication_document_id: string;
  source_kind: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  indexed_status: string;
}

export function buildFilePresenceContext(
  authorisedIndexedDocs: any[],
  serverSourceCatalogue?: Map<string, any>
): { status: string; count: number; items: SafeFilePresenceItem[] } {
  if (!Array.isArray(authorisedIndexedDocs) || authorisedIndexedDocs.length === 0) {
    return { status: "empty", count: 0, items: [] };
  }

  const items: SafeFilePresenceItem[] = [];
  authorisedIndexedDocs.forEach((doc, idx) => {
    const sKey = `FILEINDEX-${(idx + 1).toString().padStart(3, "0")}`;
    const fileName = doc.source_file_name || doc.file_name || "Document";
    const rec: SafeFilePresenceItem = {
      source_key: sKey,
      communication_document_id: doc.communication_document_id || doc.id,
      source_kind: doc.source_kind || "uploaded",
      file_name: fileName,
      mime_type: doc.source_mime_type || null,
      file_size_bytes: parseFiniteNumber(doc.source_file_size, 0) || null,
      indexed_status: doc.status || "ready",
    };
    items.push(rec);

    if (serverSourceCatalogue) {
      serverSourceCatalogue.set(sKey, {
        key: sKey,
        module: "communication_documents",
        id: doc.communication_document_id || doc.id,
        label: fileName,
        summary: `Indexed File (${doc.source_kind || "file"}): ${fileName}`,
      });
    }
  });

  return {
    status: "ok",
    count: items.length,
    items,
  };
}

export function validateAndMapGroundingCitations(
  groundingMetadata: any,
  authorisedIndexedDocs: any[],
  companyId: string,
  targetProjectIds: string[],
  serverSourceCatalogue: Map<string, any>
): AdvisorSource[] {
  if (!groundingMetadata) return [];
  const chunks = Array.isArray(groundingMetadata.groundingChunks)
    ? groundingMetadata.groundingChunks
    : Array.isArray(groundingMetadata.grounding_chunks)
    ? groundingMetadata.grounding_chunks
    : [];

  if (chunks.length === 0) return [];

  const allowedProjectSet = new Set(targetProjectIds);
  const validDocs = (authorisedIndexedDocs || []).filter(
    (d) => d && d.company_id === companyId && allowedProjectSet.has(d.project_id) && d.status === "ready"
  );

  const byProviderDocName = new Map<string, any>();
  const byFileName = new Map<string, any>();

  for (const doc of validDocs) {
    if (doc.provider_document_name) {
      byProviderDocName.set(String(doc.provider_document_name).trim(), doc);
    }
    if (doc.source_file_name) {
      byFileName.set(String(doc.source_file_name).trim().toLowerCase(), doc);
    }
  }

  const validatedSources: AdvisorSource[] = [];
  const seenKeys = new Set<string>();

  for (const chunk of chunks) {
    const ctx = chunk.retrievedContext || chunk.retrieved_context || chunk.fileSearchChunk || chunk.file_search_chunk || chunk;
    const uri = String(ctx.uri || ctx.providerDocumentName || ctx.provider_document_name || "").trim();
    const title = String(ctx.title || ctx.fileName || ctx.file_name || "").trim();

    let matchedDoc = byProviderDocName.get(uri);
    if (!matchedDoc && title) {
      matchedDoc = byProviderDocName.get(title) || byFileName.get(title.toLowerCase());
    }

    if (!matchedDoc) {
      // Rejection: Not in authorised indexed docs list or cross-tenant document
      continue;
    }

    if (matchedDoc.company_id !== companyId || !allowedProjectSet.has(matchedDoc.project_id)) {
      continue;
    }

    const docId = matchedDoc.communication_document_id || matchedDoc.id;
    const fileName = matchedDoc.source_file_name || "Document";
    const sKey = `FILESEARCH-${docId.substring(0, 8)}`;

    if (!seenKeys.has(sKey)) {
      seenKeys.add(sKey);

      if (serverSourceCatalogue && !serverSourceCatalogue.has(sKey)) {
        serverSourceCatalogue.set(sKey, {
          key: sKey,
          module: "communication_documents",
          id: docId,
          label: fileName,
          summary: `File Search retrieved context from ${fileName}`,
        });
      }

      validatedSources.push({
        key: sKey,
        table: "communication_documents",
        id: docId,
        label: fileName,
        summary: `File Search retrieved context from ${fileName}`,
      });
    }
  }

  return validatedSources;
}

export function sanitiseAnswerInternalPaths(text: string): string {
  if (typeof text !== "string") return "";
  let clean = text;
  clean = clean.replace(/fileSearchStores\/[a-z0-9\-\/]+/gi, "");
  clean = clean.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/[^\s,\)\]]+/gi, "");
  clean = clean.replace(/  +/g, " ");
  return clean;
}

export function isDocumentAvailabilityQuestion(question: unknown): boolean {
  if (typeof question !== "string") return false;
  const q = question.trim().toLowerCase();
  if (!q) return false;

  const docKw = /(document|documents|file|files|pdf|pdfs|attachment|attachments|upload|uploads|index|indexed)/;
  if (!docKw.test(q)) return false;

  const patterns = [
    /what\s+.*(document|file|pdf|upload|attachment)s?.*(available|analyse|analyze|read|access|indexed)/i,
    /which\s+.*(document|file|pdf|upload|attachment)s?.*(available|analyse|analyze|read|access|indexed)/i,
    /(list|show|display|get)\s+.*(available|indexed)?\s*(document|file|pdf|upload|attachment)s?/i,
    /are\s+there\s+(any|some)\s+.*(document|file|pdf|upload|attachment)s?.*(available|indexed|ready)/i,
    /do\s+you\s+have\s+access\s+to\s+.*(document|file|pdf|upload|attachment)s?/i,
    /(document|file)s?\s+(available|indexed|status)/i,
  ];

  return patterns.some((p) => p.test(q));
}

export function isRetryableGeminiError(err: any): boolean {
  if (!err) return false;
  const status = Number(err.status || err.statusCode || err.code || 0);
  if ([429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  const msg = String(err.message || err.toString() || err);
  if (
    /429|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL|OVERLOADED|high demand|fetch failed|network error|timeout/i.test(msg)
  ) {
    return true;
  }
  return false;
}

export function extractRetryAfterDelayMs(err: any): number | null {
  if (!err) return null;
  const headers = err.response?.headers || err.headers;
  if (headers && typeof headers.get === "function") {
    const retryAfter = headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.min(seconds * 1000, 10000);
      }
    }
  }
  return null;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

export async function invokeGeminiWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const sleep = options.sleepFn || ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt >= maxRetries || !isRetryableGeminiError(err)) {
        throw err;
      }

      let delay = extractRetryAfterDelayMs(err);
      if (delay === null) {
        const expDelay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        const jitter = Math.random() * 0.3 * expDelay;
        delay = expDelay + jitter;
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

export interface SanitizedErrorResult {
  message: string;
  code: string;
}

export function sanitizeUserFacingError(rawError: unknown): SanitizedErrorResult {
  const defaultInternalMsg = "Project Advisor could not complete the request. Please try again.";
  const defaultBusyMsg = "Project Advisor is temporarily busy. Please try again shortly.";

  if (!rawError) {
    return { message: defaultInternalMsg, code: "INTERNAL_ERROR" };
  }

  let msg = "";
  if (typeof rawError === "string") {
    msg = rawError.trim();
  } else if (typeof rawError === "object" && rawError !== null) {
    const errObj = rawError as any;
    msg = String(errObj.error || errObj.message || errObj.details || "").trim();
  }

  if (!msg) {
    return { message: defaultInternalMsg, code: "INTERNAL_ERROR" };
  }

  if (msg.startsWith("{") || msg.startsWith("[")) {
    try {
      const parsed = JSON.parse(msg);
      if (typeof parsed === "object" && parsed !== null) {
        if (typeof parsed.error === "string") {
          msg = parsed.error;
        } else if (typeof parsed.error === "object" && parsed.error !== null) {
          msg = String(parsed.error.message || parsed.error.details || parsed.error.code || JSON.stringify(parsed.error));
        } else if (typeof parsed.message === "string") {
          msg = parsed.message;
        } else if (typeof parsed.details === "string") {
          msg = parsed.details;
        }
      }
    } catch {
      return { message: defaultInternalMsg, code: "INTERNAL_ERROR" };
    }
  }

  if (!msg) {
    return { message: defaultInternalMsg, code: "INTERNAL_ERROR" };
  }

  if (/503|502|504|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(msg)) {
    return { message: defaultBusyMsg, code: "PROVIDER_TEMPORARILY_UNAVAILABLE" };
  }

  if (
    /ReferenceError|TypeError|SyntaxError|RangeError|is not defined|targetProjectIds|fileSearchStores|\[object Object\]|FetchError|Internal AI error|Postgres|database|supabase|jwt|bearer|stack|at\s+/i.test(msg) ||
    msg.length > 200
  ) {
    return { message: defaultInternalMsg, code: "INTERNAL_ERROR" };
  }

  return { message: defaultInternalMsg, code: "INTERNAL_ERROR" };
}

export function sanitizeUserFacingErrorMessage(rawError: unknown): string {
  return sanitizeUserFacingError(rawError).message;
}

