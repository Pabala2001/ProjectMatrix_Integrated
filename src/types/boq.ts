export interface BoQRateBuildUp {
  labour: number;       // e.g. TSh/unit
  plant: number;        // e.g. TSh/unit
  materials: number;    // e.g. TSh/unit
  transport: number;    // e.g. TSh/unit
  fuel: number;         // e.g. TSh/unit
  overheads: number;    // e.g. TSh/unit
  profit: number;       // e.g. TSh/unit
  total_cost: number;   // labour + plant + materials + transport + fuel + overheads
  tender_rate: number;  // total_cost + profit
}

export interface BoQExecution {
  quantity_completed: number;
  quantity_certified: number;
  quantity_paid: number;
  actual_cost: number;        // Total actual spend to date
  committed_cost: number;     // Open purchase orders / committed subcontracts
  forecast_cost: number;      // Projected EAC (Estimate at Completion)
  actual_unit_cost: number;   // actual_cost / quantity_completed (when completed > 0)
  remaining_quantity: number; // quantity - quantity_completed
}

export interface BoQMargin {
  tender_margin: number;              // ((tender_rate - build_up.total_cost) / tender_rate) * 100
  tender_profit_per_unit: number;     // tender_rate - build_up.total_cost
  current_unit_loss_or_gain: number;  // tender_rate - actual_unit_cost (positive = profit, negative = loss)
  current_margin: number;             // ((tender_rate - actual_unit_cost) / tender_rate) * 100
  forecast_final_margin: number;      // ((tender_amount - forecast_cost) / tender_amount) * 100
  is_losing: boolean;                 // true if current_unit_loss_or_gain < 0
  unit_loss: number;                  // actual_unit_cost - tender_rate (when losing)
  forecast_additional_loss: number;   // remaining_quantity * unit_loss
}

export interface BoQItem {
  id: string;
  company_id?: string;
  project_id?: string;
  item_code: string;                  // e.g. "24.03"
  section_code: string;               // e.g. "2400"
  section_title: string;              // e.g. "Section 2400: Concrete & Culvert Structures"
  description: string;                // e.g. "Class 30/20 Reinforced Concrete in Culverts & Headwalls"
  quantity: number;                   // e.g. 4500
  unit: string;                       // e.g. "m³"
  tender_rate: number;                // e.g. 182000
  tender_amount: number;              // quantity * tender_rate
  currency: string;                   // e.g. "TZS", "ZAR", "USD"
  wbs_code?: string;                  // e.g. "ACT-240"
  linked_activity_id?: string;
  linked_activity_name?: string;
  
  rate_build_up: BoQRateBuildUp;
  execution: BoQExecution;
  margin: BoQMargin;
  
  loss_drivers?: string[];
  recommended_actions?: string[];
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BoQSummary {
  total_items: number;
  total_tender_amount: number;
  total_actual_cost: number;
  total_committed_cost: number;
  total_forecast_cost: number;
  total_certified_value: number;
  overall_progress_qty_pct: number;
  overall_tender_margin_pct: number;
  overall_current_margin_pct: number;
  overall_forecast_margin_pct: number;
  losing_items_count: number;
  total_forecast_loss_amount: number;
}
