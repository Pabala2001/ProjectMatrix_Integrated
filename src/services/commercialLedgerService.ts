import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
import {
  CommercialTransaction,
  ProjectFinancialMetrics,
  BoQItemCommercial,
  CommercialLossDiagnosticSummary,
  CommercialTransactionType,
  CommercialCostElement
} from "../types/commercial";

const STORAGE_KEY_PREFIX = "pm_commercial_transactions_";
const BOQ_COMMERCIAL_KEY_PREFIX = "pm_boq_commercial_items_";

// Empty Seed Transactions (No mock data)
export const SAMPLE_COMMERCIAL_TRANSACTIONS: CommercialTransaction[] = [];

// Baseline BOQ Items
export const INITIAL_BOQ_COMMERCIAL_ITEMS: BoQItemCommercial[] = [];

// Load Transactions from LocalStorage or Fallback
export function loadCommercialTransactions(projectId?: string | null): CommercialTransaction[] {
  const key = `${STORAGE_KEY_PREFIX}${projectId || "default"}`;
  try {
    const data = previewStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading commercial transactions from storage:", err);
  }
  return [];
}

// Save Transactions
export function saveCommercialTransactions(
  transactions: CommercialTransaction[],
  projectId?: string | null
): void {
    assertOperationalAction("write", "services/commercialLedgerService.ts");
  const key = `${STORAGE_KEY_PREFIX}${projectId || "default"}`;
  try {
    previewStorage.setItem(key, JSON.stringify(transactions));
  } catch (err) {
    console.error("Error saving commercial transactions to storage:", err);
  }
}

// Load BOQ Commercial Items
export function loadBoQCommercialItems(projectId?: string | null): BoQItemCommercial[] {
  const key = `${BOQ_COMMERCIAL_KEY_PREFIX}${projectId || "default"}`;
  try {
    const data = previewStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error loading BOQ commercial items from storage:", err);
  }
  return [];
}

// Save BOQ Commercial Items
export function saveBoQCommercialItems(
  items: BoQItemCommercial[],
  projectId?: string | null
): void {
    assertOperationalAction("write", "services/commercialLedgerService.ts");
  const key = `${BOQ_COMMERCIAL_KEY_PREFIX}${projectId || "default"}`;
  try {
    previewStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error("Error saving BOQ commercial items to storage:", err);
  }
}

// Compute Project Financial Metrics strictly following user specification
export function calculateProjectFinancials(
  items: BoQItemCommercial[],
  transactions: CommercialTransaction[]
): ProjectFinancialMetrics {
  // Aggregate from items & transaction ledger
  let original_budget = 0;
  let revised_budget = 0;
  let committed_cost = 0;
  let actual_cost = 0;
  let accrued_cost = 0;
  let forecast_cost = 0;
  let certified_revenue = 0;
  let paid_revenue = 0;
  let forecast_revenue = 0;

  // Aggregate BOQ item level values
  items.forEach(item => {
    original_budget += item.budget_cost;
    revised_budget += item.revised_quantity * item.budget_unit_cost;
    committed_cost += item.committed_cost;
    actual_cost += item.actual_cost;
    accrued_cost += item.accrued_cost;
    forecast_cost += item.forecast_cost;
    forecast_revenue += item.forecast_revenue;
    certified_revenue += item.certified_quantity * item.rate;
    paid_revenue += item.paid_quantity * item.rate;
  });

  // Calculate outstanding revenue
  const outstanding_revenue = Math.max(0, certified_revenue - paid_revenue);

  // Compute the 7 required derived metrics
  const cost_to_date = actual_cost + accrued_cost;
  const cost_to_complete = Math.max(0, forecast_cost - cost_to_date);
  const estimate_at_completion = cost_to_date + cost_to_complete; // EAC
  const variance_at_completion = revised_budget - estimate_at_completion; // VAC (+ under budget, - overrun)
  const gross_margin = forecast_revenue - estimate_at_completion;
  const gross_margin_percentage = forecast_revenue > 0 ? (gross_margin / forecast_revenue) * 100 : 0;
  const cash_exposure = actual_cost - paid_revenue;
  const working_capital_requirement = (committed_cost + cost_to_date) - paid_revenue;

  return {
    original_budget,
    revised_budget,
    committed_cost,
    actual_cost,
    accrued_cost,
    forecast_cost,
    certified_revenue,
    paid_revenue,
    outstanding_revenue,
    forecast_revenue,
    cost_to_date,
    cost_to_complete,
    estimate_at_completion,
    variance_at_completion,
    gross_margin,
    gross_margin_percentage,
    cash_exposure,
    working_capital_requirement
  };
}

// Compute "Which BOQ items are losing money?" diagnostics
export function calculateLossDiagnostics(items: BoQItemCommercial[]): CommercialLossDiagnosticSummary {
  const losingItems = items.filter(i => i.is_losing);
  const thinMarginItems = items.filter(i => !i.is_losing && i.margin_percentage < 5);
  const profitableItems = items.filter(i => !i.is_losing && i.margin_percentage >= 5);

  const total_loss_exposure = losingItems.reduce((sum, i) => sum + i.forecast_loss_amount, 0);

  // Identify highest risk section
  const sectionLossMap: Record<string, number> = {};
  losingItems.forEach(i => {
    sectionLossMap[i.section_title] = (sectionLossMap[i.section_title] || 0) + i.forecast_loss_amount;
  });

  let highest_risk_section = "-";
  let maxLoss = 0;
  Object.entries(sectionLossMap).forEach(([section, loss]) => {
    if (loss > maxLoss) {
      maxLoss = loss;
      highest_risk_section = section;
    }
  });

  // Extract primary loss drivers
  const allDrivers: string[] = [];
  losingItems.forEach(i => {
    if (i.loss_drivers) allDrivers.push(...i.loss_drivers);
  });

  const primary_loss_driver = allDrivers.length > 0
    ? allDrivers[0]
    : "-";

  return {
    total_boq_items: items.length,
    losing_items_count: losingItems.length,
    thin_margin_count: thinMarginItems.length,
    profitable_items_count: profitableItems.length,
    total_loss_exposure,
    highest_risk_section,
    primary_loss_driver,
    items_with_negative_cash_margin: losingItems
  };
}

// Post a new Commercial Transaction and automatically recompute affected BOQ item
export function postCommercialTransaction(
  tx: Omit<CommercialTransaction, "id" | "transaction_number" | "created_at">,
  items: BoQItemCommercial[],
  projectId?: string | null
): { transactions: CommercialTransaction[]; items: BoQItemCommercial[] } {
    assertOperationalAction("write", "services/commercialLedgerService.ts");
  const existingTx = loadCommercialTransactions(projectId);
  const txNumber = `CTX-${new Date().getFullYear()}-${String(existingTx.length + 1).padStart(4, "0")}`;
  const newTx: CommercialTransaction = {
    ...tx,
    id: `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    transaction_number: txNumber,
    created_at: new Date().toISOString()
  };

  const updatedTx = [newTx, ...existingTx];
  saveCommercialTransactions(updatedTx, projectId);

  // If transaction touches a BOQ item, update its commercial metrics
  let updatedItems = [...items];
  if (newTx.boq_item_id) {
    updatedItems = updatedItems.map(item => {
      if (item.id === newTx.boq_item_id) {
        const itemCopy = { ...item, transactions_count: (item.transactions_count || 0) + 1 };

        if (newTx.category === "ACTUAL_COST") {
          itemCopy.actual_cost += newTx.amount;
          if (newTx.quantity_delta && newTx.quantity_type === "EXECUTED") {
            itemCopy.executed_quantity += newTx.quantity_delta;
          }
          if (itemCopy.executed_quantity > 0) {
            itemCopy.actual_unit_cost = Math.round(itemCopy.actual_cost / itemCopy.executed_quantity);
          }
        } else if (newTx.category === "ACCRUAL") {
          itemCopy.accrued_cost += newTx.amount;
        } else if (newTx.category === "COMMITMENT") {
          itemCopy.committed_cost += newTx.amount;
        } else if (newTx.category === "BUDGET" && newTx.type === "BUDGET_VARIATION") {
          if (newTx.quantity_delta) {
            itemCopy.revised_quantity += newTx.quantity_delta;
          }
          itemCopy.forecast_revenue = itemCopy.revised_quantity * itemCopy.revised_rate;
        } else if (newTx.category === "REVENUE_CERTIFIED") {
          if (newTx.quantity_delta) {
            itemCopy.certified_quantity += newTx.quantity_delta;
          }
        } else if (newTx.category === "REVENUE_PAID") {
          if (newTx.quantity_delta) {
            itemCopy.paid_quantity += newTx.quantity_delta;
          }
        }

        // Recompute item EAC & Margin
        itemCopy.cost_to_date = itemCopy.actual_cost + itemCopy.accrued_cost;
        const remainingQty = Math.max(0, itemCopy.revised_quantity - itemCopy.executed_quantity);
        itemCopy.cost_to_complete = Math.round(remainingQty * itemCopy.actual_unit_cost);
        itemCopy.forecast_cost = itemCopy.actual_cost + itemCopy.cost_to_complete;
        itemCopy.margin = itemCopy.forecast_revenue - itemCopy.forecast_cost;
        itemCopy.margin_percentage = itemCopy.forecast_revenue > 0 ? (itemCopy.margin / itemCopy.forecast_revenue) * 100 : 0;
        itemCopy.unit_profit_loss = itemCopy.rate - itemCopy.actual_unit_cost;
        itemCopy.is_losing = itemCopy.margin < 0 || itemCopy.unit_profit_loss < 0;

        if (itemCopy.is_losing) {
          itemCopy.forecast_loss_amount = Math.abs(itemCopy.margin);
          itemCopy.loss_severity = itemCopy.margin_percentage < -15 ? "CRITICAL" : itemCopy.margin_percentage < -5 ? "SEVERE" : "MODERATE";
        } else {
          itemCopy.forecast_loss_amount = 0;
          itemCopy.loss_severity = "NONE";
        }

        return itemCopy;
      }
      return item;
    });

    saveBoQCommercialItems(updatedItems, projectId);
  }

  return { transactions: updatedTx, items: updatedItems };
}
