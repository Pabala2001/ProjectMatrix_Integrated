import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
import { BoQItem, BoQRateBuildUp, BoQExecution, BoQMargin, BoQSummary } from "../types/boq";

export const SAMPLE_BOQ_ITEMS: BoQItem[] = [];

export function calculateBoQItem(
  item: Omit<BoQItem, "tender_amount" | "margin" | "execution"> & {
    rate_build_up: BoQRateBuildUp;
    execution: Omit<BoQExecution, "actual_unit_cost" | "remaining_quantity">;
  }
): BoQItem {
  const { quantity, tender_rate, rate_build_up, execution } = item;
  const tender_amount = quantity * tender_rate;

  // Total Rate build-up cost & calculated profit
  const total_cost = 
    (rate_build_up.labour || 0) +
    (rate_build_up.plant || 0) +
    (rate_build_up.materials || 0) +
    (rate_build_up.transport || 0) +
    (rate_build_up.fuel || 0) +
    (rate_build_up.overheads || 0);

  const profit = rate_build_up.profit || (tender_rate - total_cost);
  const updatedRateBuildUp: BoQRateBuildUp = {
    ...rate_build_up,
    total_cost,
    profit,
    tender_rate,
  };

  // Execution
  const completed = execution.quantity_completed || 0;
  const remaining_quantity = Math.max(0, quantity - completed);
  const actual_unit_cost = completed > 0 ? (execution.actual_cost / completed) : 0;

  const updatedExecution: BoQExecution = {
    ...execution,
    actual_unit_cost,
    remaining_quantity,
  };

  // Margins
  const tender_profit_per_unit = profit;
  const tender_margin = tender_rate > 0 ? (tender_profit_per_unit / tender_rate) * 100 : 0;

  let current_unit_loss_or_gain = 0;
  let current_margin = tender_margin;
  let is_losing = false;
  let unit_loss = 0;
  let forecast_additional_loss = 0;

  if (completed > 0) {
    current_unit_loss_or_gain = tender_rate - actual_unit_cost;
    current_margin = (current_unit_loss_or_gain / tender_rate) * 100;
    if (current_unit_loss_or_gain < 0) {
      is_losing = true;
      unit_loss = Math.abs(current_unit_loss_or_gain);
      forecast_additional_loss = remaining_quantity * unit_loss;
    }
  }

  const forecast_cost = execution.forecast_cost || (execution.actual_cost + (remaining_quantity * (actual_unit_cost || tender_rate)));
  const forecast_final_margin = tender_amount > 0 ? ((tender_amount - forecast_cost) / tender_amount) * 100 : 0;

  const margin: BoQMargin = {
    tender_margin: parseFloat(tender_margin.toFixed(2)),
    tender_profit_per_unit,
    current_unit_loss_or_gain: parseFloat(current_unit_loss_or_gain.toFixed(2)),
    current_margin: parseFloat(current_margin.toFixed(2)),
    forecast_final_margin: parseFloat(forecast_final_margin.toFixed(2)),
    is_losing,
    unit_loss: parseFloat(unit_loss.toFixed(2)),
    forecast_additional_loss: parseFloat(forecast_additional_loss.toFixed(2)),
  };

  return {
    ...item,
    tender_amount,
    rate_build_up: updatedRateBuildUp,
    execution: {
      ...updatedExecution,
      forecast_cost,
    },
    margin,
  };
}

export function calculateBoQSummary(items: BoQItem[]): BoQSummary {
  let total_tender_amount = 0;
  let total_actual_cost = 0;
  let total_committed_cost = 0;
  let total_forecast_cost = 0;
  let total_certified_value = 0;
  let total_planned_qty = 0;
  let total_completed_qty = 0;
  let losing_items_count = 0;
  let total_forecast_loss_amount = 0;

  items.forEach((item) => {
    total_tender_amount += item.tender_amount;
    total_actual_cost += item.execution.actual_cost;
    total_committed_cost += item.execution.committed_cost;
    total_forecast_cost += item.execution.forecast_cost;
    total_certified_value += item.execution.quantity_certified * item.tender_rate;
    total_planned_qty += item.quantity;
    total_completed_qty += item.execution.quantity_completed;

    if (item.margin.is_losing) {
      losing_items_count++;
      total_forecast_loss_amount += item.margin.forecast_additional_loss;
    }
  });

  const overall_progress_qty_pct = total_planned_qty > 0 ? (total_completed_qty / total_planned_qty) * 100 : 0;
  const overall_tender_margin_pct = total_tender_amount > 0 ? ((total_tender_amount - (total_tender_amount * 0.92)) / total_tender_amount) * 100 : 8;
  const overall_current_margin_pct = total_actual_cost > 0 && total_certified_value > 0 ? ((total_certified_value - total_actual_cost) / total_certified_value) * 100 : 0;
  const overall_forecast_margin_pct = total_tender_amount > 0 ? ((total_tender_amount - total_forecast_cost) / total_tender_amount) * 100 : 0;

  return {
    total_items: items.length,
    total_tender_amount,
    total_actual_cost,
    total_committed_cost,
    total_forecast_cost,
    total_certified_value,
    overall_progress_qty_pct: parseFloat(overall_progress_qty_pct.toFixed(1)),
    overall_tender_margin_pct: parseFloat(overall_tender_margin_pct.toFixed(1)),
    overall_current_margin_pct: parseFloat(overall_current_margin_pct.toFixed(1)),
    overall_forecast_margin_pct: parseFloat(overall_forecast_margin_pct.toFixed(1)),
    losing_items_count,
    total_forecast_loss_amount,
  };
}

const BOQ_STORAGE_KEY_PREFIX = "projectmatrix_boq_items_";

export function loadBoQItems(projectId?: string | null): BoQItem[] {
  if (!projectId) {
    const defaultData = previewStorage.getItem("projectmatrix_boq_items_global");
    if (defaultData) {
      try {
        return JSON.parse(defaultData);
      } catch (e) {
        console.error("Error parsing stored BOQ data:", e);
      }
    }
    return [];
  }

  const key = `${BOQ_STORAGE_KEY_PREFIX}${projectId}`;
  const stored = previewStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Error parsing stored BOQ data for project:", e);
    }
  }

  return [];
}

export function saveBoQItems(items: BoQItem[], projectId?: string | null): void {
    assertOperationalAction("write", "services/boqService.ts");
  const key = projectId ? `${BOQ_STORAGE_KEY_PREFIX}${projectId}` : "projectmatrix_boq_items_global";
  previewStorage.setItem(key, JSON.stringify(items));
}
