export type CommercialTransactionType =
  | "BUDGET_ORIGINAL"
  | "BUDGET_VARIATION"
  | "COMMITMENT_PO"
  | "COMMITMENT_SUBCONTRACT"
  | "ACTUAL_INVOICE"
  | "ACTUAL_PAYROLL"
  | "ACTUAL_PLANT_DOCKET"
  | "ACTUAL_MATERIAL_DELIVERY"
  | "ACCRUAL_COST"
  | "FORECAST_ADJUSTMENT"
  | "REVENUE_VALUATION"
  | "REVENUE_IPC_CERTIFICATE"
  | "REVENUE_RECEIPT";

export type CommercialTransactionCategory =
  | "BUDGET"
  | "COMMITMENT"
  | "ACTUAL_COST"
  | "ACCRUAL"
  | "FORECAST"
  | "REVENUE_CERTIFIED"
  | "REVENUE_PAID";

export type CommercialCostElement =
  | "LABOUR"
  | "PLANT"
  | "MATERIALS"
  | "SUBCONTRACT"
  | "FUEL"
  | "TRANSPORT"
  | "OVERHEADS"
  | "REVENUE";

export type CommercialQuantityType =
  | "TENDER"
  | "REVISED"
  | "EXECUTED"
  | "MEASURED"
  | "CERTIFIED"
  | "PAID";

export type CommercialTransactionStatus =
  | "DRAFT"
  | "POSTED"
  | "APPROVED"
  | "REVERSED";

export interface CommercialTransaction {
  id: string;
  transaction_number: string; // e.g. CTX-2026-0045
  project_id: string;
  boq_item_id?: string;
  boq_item_code?: string;
  type: CommercialTransactionType;
  category: CommercialTransactionCategory;
  cost_element: CommercialCostElement;
  date: string; // YYYY-MM-DD
  reference: string; // e.g. PO-9082, IPC-05, INV-4392, VO-02
  description: string;
  vendor_client?: string;
  quantity_delta?: number;
  quantity_type?: CommercialQuantityType;
  unit_cost_rate?: number;
  amount: number;
  currency: string;
  status: CommercialTransactionStatus;
  created_by: string;
  created_at: string;
  reversal_of_id?: string;
  notes?: string;
}

export interface ProjectFinancialMetrics {
  // 10 Core Financial Attributes requested
  original_budget: number;
  revised_budget: number;
  committed_cost: number;
  actual_cost: number;
  accrued_cost: number;
  forecast_cost: number;
  certified_revenue: number;
  paid_revenue: number;
  outstanding_revenue: number; // certified_revenue - paid_revenue
  forecast_revenue: number;

  // 7 Computed Metrics requested
  cost_to_date: number; // actual_cost + accrued_cost
  cost_to_complete: number; // forecast_cost - cost_to_date
  estimate_at_completion: number; // EAC = cost_to_date + cost_to_complete (= forecast_cost)
  variance_at_completion: number; // VAC = revised_budget - estimate_at_completion (positive = under budget, negative = overrun)
  gross_margin: number; // forecast_revenue - estimate_at_completion
  gross_margin_percentage: number; // (gross_margin / forecast_revenue) * 100
  cash_exposure: number; // actual_cost - paid_revenue (or net cash out vs cash in)
  working_capital_requirement: number; // (committed_cost + cost_to_date) - paid_revenue
}

export interface BoQItemCommercial {
  id: string;
  item_code: string;
  section_code: string;
  section_title: string;
  description: string;
  unit: string;
  currency: string;

  // Quantities (Tender, Revised, Executed, Measured, Certified, Paid)
  tender_quantity: number;
  revised_quantity: number;
  executed_quantity: number;
  measured_quantity: number;
  certified_quantity: number;
  paid_quantity: number;

  // Rates & Financials
  rate: number; // Tender rate
  revised_rate: number; // Revised rate after approved claims
  budget_unit_cost: number; // Tender cost build-up per unit
  actual_unit_cost: number; // actual_cost / executed_quantity

  original_revenue: number; // tender_quantity * rate
  forecast_revenue: number; // revised_quantity * revised_rate
  budget_cost: number; // tender_quantity * budget_unit_cost
  committed_cost: number; // open POs & subcontracts
  actual_cost: number; // Posted actual costs
  accrued_cost: number; // Unbilled costs / GRNI
  cost_to_date: number; // actual_cost + accrued_cost
  cost_to_complete: number; // forecast_cost - cost_to_date
  forecast_cost: number; // EAC

  // Margins & Loss Analysis
  margin: number; // forecast_revenue - forecast_cost
  margin_percentage: number; // (margin / forecast_revenue) * 100
  tender_margin: number; // ((original_revenue - budget_cost) / original_revenue) * 100
  unit_profit_loss: number; // rate - actual_unit_cost (positive = profit, negative = loss)
  is_losing: boolean; // true if margin < 0 OR unit_profit_loss < 0
  loss_severity: "NONE" | "LOW" | "MODERATE" | "SEVERE" | "CRITICAL";
  forecast_loss_amount: number; // projected total deficit at completion

  // Diagnostics & Context
  cost_breakdown: {
    labour: number;
    plant: number;
    materials: number;
    subcontract: number;
    fuel: number;
    transport: number;
    overheads: number;
  };
  loss_drivers?: string[];
  recommended_actions?: string[];
  notes?: string;
  wbs_code?: string;
  linked_activity_id?: string;
  linked_activity_name?: string;
  transactions_count: number;
}

export interface CommercialLossDiagnosticSummary {
  total_boq_items: number;
  losing_items_count: number;
  thin_margin_count: number;
  profitable_items_count: number;
  total_loss_exposure: number;
  highest_risk_section: string;
  primary_loss_driver: string;
  items_with_negative_cash_margin: BoQItemCommercial[];
}
