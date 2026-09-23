import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from "../lib/supabase";

// ====================================================================
// Type Definitions for Phase 2C.1 Database Models
// ====================================================================

export interface BudgetVersion {
  id: string;
  company_id: string;
  project_id: string;
  version_number: number;
  version_label: string;
  effective_date: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Superseded' | 'Cancelled';
  original_budget_excl_vat: number;
  approved_variations_excl_vat: number;
  current_budget_excl_vat: number;
  notes?: string;
  currency_code: string;
  created_at: string;
  created_by?: string;
  rejection_reason?: string;
  is_archived: boolean;
}

export interface BudgetLine {
  id: string;
  company_id: string;
  project_id: string;
  budget_version_id: string;
  line_code?: string;
  cost_category: string;
  description: string;
  line_type: 'Original Budget' | 'Approved Variation';
  amount_excl_vat: number;
  sort_order?: number;
}

export interface FinancialCommitment {
  id: string;
  company_id: string;
  project_id: string;
  commitment_reference: string;
  commitment_type: 'Purchase Order' | 'Subcontract' | 'Approved Variation' | 'Other Contractual Commitment';
  counterparty_name: string;
  description: string;
  original_amount_excl_vat: number;
  approved_variations_excl_vat: number;
  revised_commitment_excl_vat: number;
  start_date?: string;
  completion_date?: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Closed' | 'Cancelled';
  notes?: string;
  currency_code: string;
  rejection_reason?: string;
  cancellation_reason?: string;
  is_archived: boolean;
}

export interface FinancialCostPosting {
  id: string;
  company_id: string;
  project_id: string;
  posting_reference: string;
  posting_date: string;
  source_type: 'Supplier Invoice' | 'Labour Payroll' | 'Direct Expense' | 'Overhead Allocation' | 'Adjustment';
  source_record_id?: string;
  source_reference?: string;
  commitment_id?: string;
  cost_category: string;
  description: string;
  entry_type: 'Cost' | 'Reversal';
  amount_excl_vat: number;
  status: 'Draft' | 'Submitted' | 'Posted' | 'Reversed' | 'Rejected';
  reversal_of_id?: string;
  notes?: string;
  currency_code: string;
  reversal_reason?: string;
  is_archived: boolean;
}

export interface ProjectFinancialForecast {
  id: string;
  company_id: string;
  project_id: string;
  version_number: number;
  version_label: string;
  as_of_date: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Superseded';
  forecast_contract_revenue_excl_vat: number;
  uncommitted_estimate_to_complete_excl_vat: number;
  notes?: string;
  currency_code: string;
  rejection_reason?: string;
  is_archived: boolean;
}

export interface FinanceAuditLog {
  id: string;
  company_id: string;
  project_id?: string;
  source_table: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'POST' | 'REVERSE' | 'ARCHIVE' | 'RESTORE' | 'SUPERSEDE';
  old_record?: any;
  new_record?: any;
  changed_by?: string;
  changed_at: string;
  transaction_identifier?: string;
}

// Client Accounts Interfaces (Phase 2C.1)
export interface ClientAccount {
  id: string;
  company_id: string;
  account_code: string;
  account_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  vat_registration_number?: string | null;
  tax_number?: string | null;
  billing_address?: string | null;
  payment_terms_days: number;
  currency_code?: string;
  notes?: string | null;
  is_active: boolean;
  is_archived: boolean;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

export interface ProjectClientContract {
  id: string;
  company_id: string;
  project_id: string;
  client_account_id: string;
  contract_reference: string;
  agreed_contract_value_excl_vat: number;
  commencement_date?: string | null;
  target_completion_date?: string | null;
  scope_description?: string | null;
  notes?: string | null;
  currency_code?: string;
  status: 'Draft' | 'Active' | 'Closed' | 'Cancelled';
  is_archived: boolean;
  activated_by?: string;
  activated_at?: string;
  closed_by?: string;
  closed_at?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

export interface ClientInvoice {
  id: string;
  company_id: string;
  project_id: string;
  client_account_id: string;
  contract_id?: string;
  invoice_reference: string;
  invoice_date: string;
  due_date: string;
  tax_point_date?: string;
  subtotal_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  currency_code?: string;
  notes?: string | null;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Issued' | 'Rejected' | 'Cancelled';
  is_archived: boolean;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  issued_by?: string;
  issued_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

export interface ClientInvoiceLine {
  id: string;
  company_id: string;
  project_id: string;
  invoice_id: string;
  line_code?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_rate_excl_vat: number;
  vat_rate: number;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  sort_order?: number;
  is_archived: boolean;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

export interface ClientCreditNote {
  id: string;
  company_id: string;
  project_id: string;
  client_account_id: string;
  contract_id?: string;
  invoice_id: string;
  credit_note_reference: string;
  credit_note_date: string;
  tax_point_date?: string;
  reason_description?: string | null;
  subtotal_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  currency_code?: string;
  notes?: string | null;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Issued' | 'Rejected' | 'Cancelled';
  is_archived: boolean;
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  issued_by?: string;
  issued_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

export interface ClientCreditNoteLine {
  id: string;
  company_id: string;
  project_id: string;
  credit_note_id: string;
  line_code?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_rate_excl_vat: number;
  vat_rate: number;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  sort_order?: number;
  is_archived: boolean;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

export interface ClientReceipt {
  id: string;
  company_id: string;
  project_id?: string;
  client_account_id: string;
  receipt_reference: string;
  receipt_date: string;
  payment_method: 'EFT' | 'Direct Deposit' | 'Credit Card' | 'Cheque' | 'Other' | string;
  amount_received: number;
  bank_reference?: string | null;
  currency_code?: string;
  notes?: string | null;
  status: 'Draft' | 'Posted' | 'Reversed' | 'Cancelled';
  is_archived: boolean;
  posted_by?: string;
  posted_at?: string;
  reversed_by?: string;
  reversed_at?: string;
  reversal_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

export interface ClientReceiptAllocation {
  id: string;
  company_id: string;
  project_id: string;
  client_account_id: string;
  receipt_id: string;
  invoice_id: string;
  amount_allocated: number;
  status: 'Active' | 'Reversed';
  allocated_by?: string;
  allocated_at: string;
  reversed_by?: string;
  reversed_at?: string;
  reversal_reason?: string;
  transaction_identifier: string;
}

export interface ClientAccountsAuditLog {
  id: string;
  company_id: string;
  project_id?: string;
  source_table: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'ISSUE' | 'POST' | 'ALLOCATE' | 'REVERSE' | 'CANCEL' | 'ACTIVATE' | 'CLOSE' | 'ARCHIVE' | 'RESTORE';
  old_record?: any;
  new_record?: any;
  changed_by?: string;
  changed_at: string;
  transaction_identifier: string;
}

// ====================================================================
// Database Integrity / Migration Check Probers
// ====================================================================

/**
 * Checks if the Phase 2B.1 Financial migration is deployed to this Supabase environment
 */
export async function checkMigrationApplied(companyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("project_budget_versions")
      .select("id")
      .eq("company_id", companyId)
      .limit(1);

    if (error) {
      console.warn("Financial migration check probe result:", error);
      // relation does not exist is SQLSTATE 42P01. Postgrest error code is PGRST116 or 42P01
      if (
        error.code === "PGRST116" || 
        error.code === "42P01" || 
        error.message?.includes("does not exist") ||
        error.message?.includes("not found")
      ) {
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn("Exception probing database schema:", err);
    return false;
  }
}

// ====================================================================
// Data Fetching Handlers (Company-Scoped & Non-Archived)
// ====================================================================

export async function fetchBudgets(companyId: string): Promise<BudgetVersion[]> {
  const { data, error } = await supabase
    .from("project_budget_versions")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchBudgetLines(companyId: string, budgetVersionId: string): Promise<BudgetLine[]> {
  const { data, error } = await supabase
    .from("project_budget_lines")
    .select("*")
    .eq("company_id", companyId)
    .eq("budget_version_id", budgetVersionId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchCommitments(companyId: string): Promise<FinancialCommitment[]> {
  const { data, error } = await supabase
    .from("financial_commitments")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchCostPostings(companyId: string): Promise<FinancialCostPosting[]> {
  const { data, error } = await supabase
    .from("financial_cost_postings")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("posting_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchForecasts(companyId: string): Promise<ProjectFinancialForecast[]> {
  const { data, error } = await supabase
    .from("project_financial_forecasts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchFinanceAuditLogs(companyId: string): Promise<FinanceAuditLog[]> {
  const { data, error } = await supabase
    .from("finance_audit_log")
    .select("*")
    .eq("company_id", companyId)
    .order("changed_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// ====================================================================
// Payload-Safe Record Creation Handlers
// ====================================================================

export async function createBudgetVersion(payload: {
  company_id: string;
  project_id: string;
  version_label: string;
  effective_date: string;
  notes?: string;
  original_budget_excl_vat: number;
  approved_variations_excl_vat?: number;
  currency_code?: string;
}): Promise<BudgetVersion> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  // Fetch existing version count to generate sequential version number
  const { data: existing, error: countErr } = await supabase
    .from("project_budget_versions")
    .select("version_number")
    .eq("project_id", payload.project_id)
    .order("version_number", { ascending: false })
    .limit(1);

  if (countErr) throw countErr;
  const version_number = existing && existing.length > 0 ? (existing[0].version_number + 1) : 1;

  // Compile strictly-safe payload omitting any server-managed fields
  const insertPayload = {
    company_id: payload.company_id,
    project_id: payload.project_id,
    version_number,
    version_label: payload.version_label,
    effective_date: payload.effective_date,
    notes: payload.notes || null,
    original_budget_excl_vat: payload.original_budget_excl_vat,
    approved_variations_excl_vat: payload.approved_variations_excl_vat || 0.00,
    currency_code: payload.currency_code || "ZAR",
    is_archived: false
  };

  const { data, error } = await supabase
    .from("project_budget_versions")
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;

  // Insert corresponding baseline lines into project_budget_lines for approval total validation
  const linesToInsert = [];
  if (payload.original_budget_excl_vat > 0) {
    linesToInsert.push({
      company_id: payload.company_id,
      project_id: payload.project_id,
      budget_version_id: data.id,
      line_code: "BGT-001",
      cost_category: "Original Budget Line",
      description: "Initial Original Budget Allocation (Editable breakdown line)",
      line_type: "Original Budget",
      amount_excl_vat: payload.original_budget_excl_vat,
      sort_order: 1,
      is_archived: false
    });
  }
  if ((payload.approved_variations_excl_vat || 0) > 0) {
    linesToInsert.push({
      company_id: payload.company_id,
      project_id: payload.project_id,
      budget_version_id: data.id,
      line_code: "VAR-001",
      cost_category: "Approved Variation Line",
      description: "Initial Approved Variation Allocation (Editable breakdown line)",
      line_type: "Approved Variation",
      amount_excl_vat: payload.approved_variations_excl_vat,
      sort_order: 2,
      is_archived: false
    });
  }

  if (linesToInsert.length > 0) {
    const { error: lineErr } = await supabase
      .from("project_budget_lines")
      .insert(linesToInsert);
    if (lineErr) {
      console.warn("Notice inserting default budget lines:", lineErr);
    }
  }

  return data;
}

export async function createCommitment(payload: {
  company_id: string;
  project_id: string;
  commitment_reference: string;
  commitment_type: 'Purchase Order' | 'Subcontract' | 'Approved Variation' | 'Other Contractual Commitment';
  counterparty_name: string;
  description: string;
  original_amount_excl_vat: number;
  approved_variations_excl_vat?: number;
  start_date?: string;
  completion_date?: string;
  procurement_item_id?: string;
  notes?: string;
  currency_code?: string;
}): Promise<FinancialCommitment> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const insertPayload = {
    company_id: payload.company_id,
    project_id: payload.project_id,
    commitment_reference: payload.commitment_reference,
    commitment_type: payload.commitment_type,
    counterparty_name: payload.counterparty_name,
    description: payload.description,
    original_amount_excl_vat: payload.original_amount_excl_vat,
    approved_variations_excl_vat: payload.approved_variations_excl_vat || 0.00,
    start_date: payload.start_date || null,
    completion_date: payload.completion_date || null,
    procurement_item_id: payload.procurement_item_id || null,
    notes: payload.notes || null,
    currency_code: payload.currency_code || "ZAR",
    is_archived: false
  };

  const { data, error } = await supabase
    .from("financial_commitments")
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createCostPosting(payload: {
  company_id: string;
  project_id: string;
  posting_reference: string;
  posting_date: string;
  source_type: 'Supplier Invoice' | 'Labour Payroll' | 'Direct Expense' | 'Overhead Allocation' | 'Adjustment';
  source_record_id?: string;
  source_reference?: string;
  commitment_id?: string;
  cost_category: string;
  description: string;
  entry_type: 'Cost' | 'Reversal';
  amount_excl_vat: number;
  notes?: string;
  currency_code?: string;
}): Promise<FinancialCostPosting> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const insertPayload = {
    company_id: payload.company_id,
    project_id: payload.project_id,
    posting_reference: payload.posting_reference,
    posting_date: payload.posting_date,
    source_type: payload.source_type,
    source_record_id: payload.source_record_id || null,
    source_reference: payload.source_reference || null,
    commitment_id: payload.commitment_id || null,
    cost_category: payload.cost_category,
    description: payload.description,
    entry_type: payload.entry_type,
    amount_excl_vat: payload.amount_excl_vat,
    notes: payload.notes || null,
    currency_code: payload.currency_code || "ZAR",
    is_archived: false
  };

  const { data, error } = await supabase
    .from("financial_cost_postings")
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createProjectForecast(payload: {
  company_id: string;
  project_id: string;
  version_label: string;
  as_of_date: string;
  forecast_contract_revenue_excl_vat: number;
  uncommitted_estimate_to_complete_excl_vat: number;
  notes?: string;
  currency_code?: string;
}): Promise<ProjectFinancialForecast> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  // Fetch existing count of forecasts to generate sequential version number
  const { data: existing, error: countErr } = await supabase
    .from("project_financial_forecasts")
    .select("version_number")
    .eq("project_id", payload.project_id)
    .order("version_number", { ascending: false })
    .limit(1);

  if (countErr) throw countErr;
  const version_number = existing && existing.length > 0 ? (existing[0].version_number + 1) : 1;

  const insertPayload = {
    company_id: payload.company_id,
    project_id: payload.project_id,
    version_number,
    version_label: payload.version_label,
    as_of_date: payload.as_of_date,
    forecast_contract_revenue_excl_vat: payload.forecast_contract_revenue_excl_vat,
    uncommitted_estimate_to_complete_excl_vat: payload.uncommitted_estimate_to_complete_excl_vat,
    notes: payload.notes || null,
    currency_code: payload.currency_code || "ZAR",
    is_archived: false
  };

  const { data, error } = await supabase
    .from("project_financial_forecasts")
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ====================================================================
// Transaction-Safe Workflow RPC Handlers
// ====================================================================

// Budgets Workflows
export async function submitBudgetVersion(id: string): Promise<BudgetVersion> {
    assertOperationalAction("write", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("submit_budget_version", { p_id: id });
  if (error) throw error;
  return data;
}

export async function approveBudgetVersion(id: string): Promise<BudgetVersion> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("approve_budget_version", { p_id: id });
  if (error) throw error;
  return data;
}

export async function rejectBudgetVersion(id: string, reason: string): Promise<BudgetVersion> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("reject_budget_version", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function cancelBudgetVersion(id: string, reason: string): Promise<BudgetVersion> {
  const { data, error } = await supabase.rpc("cancel_budget_version", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

// Commitments Workflows
export async function submitFinancialCommitment(id: string): Promise<FinancialCommitment> {
    assertOperationalAction("write", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("submit_financial_commitment", { p_id: id });
  if (error) throw error;
  return data;
}

export async function approveFinancialCommitment(id: string): Promise<FinancialCommitment> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("approve_financial_commitment", { p_id: id });
  if (error) throw error;
  return data;
}

export async function rejectFinancialCommitment(id: string, reason: string): Promise<FinancialCommitment> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("reject_financial_commitment", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function closeFinancialCommitment(id: string): Promise<FinancialCommitment> {
  const { data, error } = await supabase.rpc("close_financial_commitment", { p_id: id });
  if (error) throw error;
  return data;
}

export async function cancelFinancialCommitment(id: string, reason: string): Promise<FinancialCommitment> {
  const { data, error } = await supabase.rpc("cancel_financial_commitment", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

// Cost Postings Workflows
export async function submitCostPosting(id: string): Promise<FinancialCostPosting> {
    assertOperationalAction("write", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("submit_financial_cost_posting", { p_id: id });
  if (error) throw error;
  return data;
}

export async function postCostPosting(id: string): Promise<FinancialCostPosting> {
    assertOperationalAction("write", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("post_financial_cost_posting", { p_id: id });
  if (error) throw error;
  return data;
}

export async function rejectCostPosting(id: string, reason: string): Promise<FinancialCostPosting> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("reject_financial_cost_posting", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function reverseCostPosting(id: string, reason: string): Promise<FinancialCostPosting> {
  const { data, error } = await supabase.rpc("reverse_financial_cost_posting", { 
    p_cost_posting_id: id, 
    p_reversal_reason: reason 
  });
  if (error) throw error;
  return data;
}

// Forecasts Workflows
export async function submitProjectForecast(id: string): Promise<ProjectFinancialForecast> {
    assertOperationalAction("write", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("submit_project_financial_forecast", { p_id: id });
  if (error) throw error;
  return data;
}

export async function approveProjectForecast(id: string): Promise<ProjectFinancialForecast> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("approve_project_financial_forecast", { p_id: id });
  if (error) throw error;
  return data;
}

export async function rejectProjectForecast(id: string, reason: string): Promise<ProjectFinancialForecast> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("reject_project_financial_forecast", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

// ====================================================================
// Client Accounts Fetch Handlers (Phase 2C.1)
// ====================================================================

export async function fetchClientAccounts(companyId: string): Promise<ClientAccount[]> {
  const { data, error } = await supabase
    .from("client_accounts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchProjectClientContracts(companyId: string): Promise<ProjectClientContract[]> {
  const { data, error } = await supabase
    .from("project_client_contracts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchClientInvoices(companyId: string): Promise<ClientInvoice[]> {
  const { data, error } = await supabase
    .from("client_invoices")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchClientInvoiceLines(companyId: string, invoiceId: string): Promise<ClientInvoiceLine[]> {
  const { data, error } = await supabase
    .from("client_invoice_lines")
    .select("*")
    .eq("company_id", companyId)
    .eq("invoice_id", invoiceId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchClientCreditNotes(companyId: string): Promise<ClientCreditNote[]> {
  const { data, error } = await supabase
    .from("client_credit_notes")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchClientCreditNoteLines(companyId: string, creditNoteId: string): Promise<ClientCreditNoteLine[]> {
  const { data, error } = await supabase
    .from("client_credit_note_lines")
    .select("*")
    .eq("company_id", companyId)
    .eq("credit_note_id", creditNoteId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchClientReceipts(companyId: string): Promise<ClientReceipt[]> {
  const { data, error } = await supabase
    .from("client_receipts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchClientReceiptAllocations(companyId: string): Promise<ClientReceiptAllocation[]> {
  const { data, error } = await supabase
    .from("client_receipt_allocations")
    .select("*")
    .eq("company_id", companyId)
    .order("allocated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchClientAccountsAuditLogs(companyId: string): Promise<ClientAccountsAuditLog[]> {
  const { data, error } = await supabase
    .from("client_accounts_audit_log")
    .select("*")
    .eq("company_id", companyId)
    .order("changed_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// ====================================================================
// Client Accounts Record Creation (Phase 2C.1)
// ====================================================================

export async function createClientAccount(payload: Partial<ClientAccount>): Promise<ClientAccount> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const { data, error } = await supabase
    .from("client_accounts")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createProjectClientContract(payload: Partial<ProjectClientContract>): Promise<ProjectClientContract> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const { data, error } = await supabase
    .from("project_client_contracts")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createClientInvoice(payload: Partial<ClientInvoice>): Promise<ClientInvoice> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const { data, error } = await supabase
    .from("client_invoices")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createClientInvoiceLine(payload: Partial<ClientInvoiceLine>): Promise<ClientInvoiceLine> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const { data, error } = await supabase
    .from("client_invoice_lines")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createClientCreditNote(payload: Partial<ClientCreditNote>): Promise<ClientCreditNote> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const { data, error } = await supabase
    .from("client_credit_notes")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createClientCreditNoteLine(payload: Partial<ClientCreditNoteLine>): Promise<ClientCreditNoteLine> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const { data, error } = await supabase
    .from("client_credit_note_lines")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createClientReceipt(payload: Partial<ClientReceipt>): Promise<ClientReceipt> {
    assertOperationalAction("create", "services/accountsFinanceService.ts");
  const { data, error } = await supabase
    .from("client_receipts")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ====================================================================
// Client Accounts Workflow RPC Handlers (Phase 2C.1)
// ====================================================================

// Contract Workflows
export async function activateClientContract(id: string): Promise<ProjectClientContract> {
  const { data, error } = await supabase.rpc("activate_client_contract", { p_id: id });
  if (error) throw error;
  return data;
}

export async function closeClientContract(id: string): Promise<ProjectClientContract> {
  const { data, error } = await supabase.rpc("close_client_contract", { p_id: id });
  if (error) throw error;
  return data;
}

export async function cancelClientContract(id: string, reason: string): Promise<ProjectClientContract> {
  const { data, error } = await supabase.rpc("cancel_client_contract", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

// Invoice Workflows
export async function submitClientInvoice(id: string): Promise<ClientInvoice> {
    assertOperationalAction("write", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("submit_client_invoice", { p_id: id });
  if (error) throw error;
  return data;
}

export async function approveClientInvoice(id: string): Promise<ClientInvoice> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("approve_client_invoice", { p_id: id });
  if (error) throw error;
  return data;
}

export async function rejectClientInvoice(id: string, reason: string): Promise<ClientInvoice> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("reject_client_invoice", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function issueClientInvoice(id: string): Promise<ClientInvoice> {
  const { data, error } = await supabase.rpc("issue_client_invoice", { p_id: id });
  if (error) throw error;
  return data;
}

export async function cancelClientInvoice(id: string, reason: string): Promise<ClientInvoice> {
  const { data, error } = await supabase.rpc("cancel_client_invoice", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

// Credit Note Workflows
export async function submitClientCreditNote(id: string): Promise<ClientCreditNote> {
    assertOperationalAction("write", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("submit_client_credit_note", { p_id: id });
  if (error) throw error;
  return data;
}

export async function approveClientCreditNote(id: string): Promise<ClientCreditNote> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("approve_client_credit_note", { p_id: id });
  if (error) throw error;
  return data;
}

export async function rejectClientCreditNote(id: string, reason: string): Promise<ClientCreditNote> {
    assertOperationalAction("approve", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("reject_client_credit_note", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function issueClientCreditNote(id: string): Promise<ClientCreditNote> {
  const { data, error } = await supabase.rpc("issue_client_credit_note", { p_id: id });
  if (error) throw error;
  return data;
}

export async function cancelClientCreditNote(id: string, reason: string): Promise<ClientCreditNote> {
  const { data, error } = await supabase.rpc("cancel_client_credit_note", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

// Receipt Workflows
export async function postClientReceipt(id: string): Promise<ClientReceipt> {
    assertOperationalAction("write", "services/accountsFinanceService.ts");
  const { data, error } = await supabase.rpc("post_client_receipt", { p_id: id });
  if (error) throw error;
  return data;
}

export async function reverseClientReceipt(id: string, reason: string): Promise<ClientReceipt> {
  const { data, error } = await supabase.rpc("reverse_client_receipt", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function cancelClientReceipt(id: string, reason: string): Promise<ClientReceipt> {
  const { data, error } = await supabase.rpc("cancel_client_receipt", { p_id: id, p_reason: reason });
  if (error) throw error;
  return data;
}

// Allocation Workflows
export async function allocateClientReceipt(receiptId: string, invoiceId: string, amount: number, notes?: string): Promise<ClientReceiptAllocation> {
  const { data, error } = await supabase.rpc("allocate_client_receipt", {
    p_receipt_id: receiptId,
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_notes: notes || null
  });
  if (error) throw error;
  return data;
}

export async function reverseClientReceiptAllocation(allocationId: string, reason: string): Promise<ClientReceiptAllocation> {
  const { data, error } = await supabase.rpc("reverse_client_receipt_allocation", {
    p_allocation_id: allocationId,
    p_reason: reason
  });
  if (error) throw error;
  return data;
}

// ====================================================================
// Pure Soft Archiving Helpers
// ====================================================================

export async function archiveRecord(table: string, id: string): Promise<any> {
  const { data, error } = await supabase.rpc("archive_finance_record", {
    p_table: table,
    p_id: id
  });

  if (error) throw error;
  return data;
}

export async function restoreRecord(table: string, id: string): Promise<any> {
  const { data, error } = await supabase.rpc("restore_finance_record", {
    p_table: table,
    p_id: id
  });

  if (error) throw error;
  return data;
}
