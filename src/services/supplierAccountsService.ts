import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from "../lib/supabase";
import { getAccountAttachments } from "./accountsAttachmentsService";

// ============================================================================
// Type Definitions for Supplier Accounts Database Models (Phase 2C.2)
// ============================================================================

export interface SupplierAccount {
  id: string;
  company_id: string;
  supplier_code: string;
  legal_name: string;
  trading_name?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  contact_person?: string | null;
  email?: string | null;
  telephone?: string | null;
  physical_address?: string | null;
  payment_terms_days: number;
  default_currency: string;
  bank_details?: {
    bank_name?: string;
    branch_code?: string;
    account_number?: string;
    account_type?: string;
  } | null;
  notes?: string | null;
  version: number;
  is_active: boolean;
  activated_by?: string | null;
  activated_at?: string | null;
  deactivated_by?: string | null;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface SupplierInvoice {
  id: string;
  company_id: string;
  project_id: string;
  supplier_account_id: string;
  financial_commitment_id: string;
  supplier_invoice_number: string;
  external_reference?: string | null;
  invoice_date: string;
  due_date: string;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  notes?: string | null;
  currency: string;
  subtotal_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled';
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  posted_by?: string | null;
  posted_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  version: number;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  // Joined/calculated optional fields
  supplier_account?: SupplierAccount;
  project_name?: string;
  commitment_reference?: string;
  paid_amount?: number;
  outstanding_amount?: number;
}

export interface SupplierInvoiceLine {
  id: string;
  company_id: string;
  project_id: string;
  supplier_invoice_id: string;
  supplier_account_id: string;
  financial_commitment_id: string;
  currency: string;
  line_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_rate_excl_vat: number;
  vat_rate: number;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  cost_category: string;
  sort_order: number;
  version: number;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface SupplierCreditNote {
  id: string;
  company_id: string;
  project_id: string;
  supplier_account_id: string;
  invoice_id: string;
  financial_commitment_id: string;
  credit_note_number: string;
  external_reference?: string | null;
  credit_note_date: string;
  reason: string;
  notes?: string | null;
  currency: string;
  subtotal_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled';
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  posted_by?: string | null;
  posted_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  version: number;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  // Joined fields
  supplier_account?: SupplierAccount;
  invoice_number?: string;
}

export interface SupplierCreditNoteLine {
  id: string;
  company_id: string;
  project_id: string;
  credit_note_id: string;
  invoice_line_id?: string | null;
  supplier_account_id: string;
  financial_commitment_id: string;
  currency: string;
  line_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_rate_excl_vat: number;
  vat_rate: number;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  cost_category: string;
  sort_order: number;
  version: number;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface SupplierPayment {
  id: string;
  company_id: string;
  project_id: string;
  supplier_account_id: string;
  payment_reference: string;
  external_reference?: string | null;
  payment_date: string;
  payment_method: 'EFT' | 'Cheque' | 'Credit Card' | 'Cash' | 'Other';
  amount_paid: number;
  currency: string;
  notes?: string | null;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled' | 'Reversed';
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  posted_by?: string | null;
  posted_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  reversed_by?: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  bank_account_id: string;
  cashbook_transaction_id?: string | null;
  cashbook_reversal_transaction_id?: string | null;
  version: number;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  // Joined fields
  supplier_account?: SupplierAccount;
  bank_account_name?: string;
  allocated_amount?: number;
  unallocated_amount?: number;
}

export interface SupplierPaymentAllocation {
  id: string;
  company_id: string;
  project_id: string;
  supplier_account_id: string;
  supplier_payment_id: string;
  supplier_invoice_id: string;
  currency: string;
  amount_allocated: number;
  allocated_at: string;
  allocated_by?: string | null;
  status: 'Active' | 'Reversed';
  reversed_by?: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  version: number;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  // Joined
  invoice_number?: string;
  payment_reference?: string;
}

export interface SupplierAccountsAuditLog {
  id: string;
  company_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  reason?: string | null;
  old_data?: any;
  new_data?: any;
  actor_id?: string | null;
  created_at: string;
}

export interface SupplierAttachment {
  id: string;
  company_id: string;
  entity_type: 'supplier_account' | 'supplier_invoice' | 'supplier_credit_note' | 'supplier_payment';
  entity_id: string;
  document_category: 'Supplier Invoice' | 'Credit Note' | 'Proof of Payment' | 'Supplier Statement' | 'Bank Confirmation' | 'Tax Document' | 'Contract' | 'Other';
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  version: number;
  uploaded_by?: string | null;
  uploaded_at: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayablesAgeing {
  supplier_account_id: string;
  supplier_code: string;
  legal_name: string;
  current_amount: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total_outstanding: number;
}

// ============================================================================
// Service API Implementation
// ============================================================================

export const supplierAccountsService = {
  // --------------------------------------------------------------------------
  // 1. SUPPLIER ACCOUNTS DIRECTORY
  // --------------------------------------------------------------------------

  async getSupplierAccounts(companyId: string, includeArchived = false): Promise<SupplierAccount[]> {
    if (!companyId) return [];

    let query = supabase
      .from('supplier_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('supplier_code', { ascending: true });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching supplier accounts:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async createSupplierAccount(account: Partial<SupplierAccount>): Promise<SupplierAccount> {
    assertOperationalAction("create", "services/supplierAccountsService.ts");
    if (!account.company_id) throw new Error("company_id is required");
    if (!account.supplier_code) throw new Error("supplier_code is required");
    if (!account.legal_name) throw new Error("legal_name is required");

    const payload = {
      company_id: account.company_id,
      supplier_code: account.supplier_code.trim().toUpperCase(),
      legal_name: account.legal_name.trim(),
      trading_name: account.trading_name?.trim() || null,
      registration_number: account.registration_number?.trim() || null,
      vat_number: account.vat_number?.trim() || null,
      contact_person: account.contact_person?.trim() || null,
      email: account.email?.trim() || null,
      telephone: account.telephone?.trim() || null,
      physical_address: account.physical_address?.trim() || null,
      payment_terms_days: account.payment_terms_days ?? 30,
      default_currency: 'ZAR',
      bank_details: account.bank_details || null,
      notes: account.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from('supplier_accounts')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier account:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async updateSupplierAccount(id: string, updates: Partial<SupplierAccount>): Promise<SupplierAccount> {
    assertOperationalAction("edit", "services/supplierAccountsService.ts");
    if (!id) throw new Error("Supplier Account ID is required");

    const payload: any = {};
    if (updates.supplier_code !== undefined) payload.supplier_code = updates.supplier_code.trim().toUpperCase();
    if (updates.legal_name !== undefined) payload.legal_name = updates.legal_name.trim();
    if (updates.trading_name !== undefined) payload.trading_name = updates.trading_name?.trim() || null;
    if (updates.registration_number !== undefined) payload.registration_number = updates.registration_number?.trim() || null;
    if (updates.vat_number !== undefined) payload.vat_number = updates.vat_number?.trim() || null;
    if (updates.contact_person !== undefined) payload.contact_person = updates.contact_person?.trim() || null;
    if (updates.email !== undefined) payload.email = updates.email?.trim() || null;
    if (updates.telephone !== undefined) payload.telephone = updates.telephone?.trim() || null;
    if (updates.physical_address !== undefined) payload.physical_address = updates.physical_address?.trim() || null;
    if (updates.payment_terms_days !== undefined) payload.payment_terms_days = updates.payment_terms_days;
    if (updates.bank_details !== undefined) payload.bank_details = updates.bank_details;
    if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;

    const { data, error } = await supabase
      .from('supplier_accounts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating supplier account:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async activateSupplierAccount(id: string, expectedVersion: number): Promise<void> {
    const { error } = await supabase.rpc('activate_supplier_account', {
      p_supplier_account_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error activating supplier account:', error);
      throw new Error(error.message);
    }
  },

  async deactivateSupplierAccount(id: string, reason: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("delete", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('deactivate_supplier_account', {
      p_supplier_account_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error deactivating supplier account:', error);
      throw new Error(error.message);
    }
  },

  async archiveSupplierAccount(id: string): Promise<void> {
    const { error } = await supabase.rpc('archive_finance_record', {
      p_table: 'supplier_accounts',
      p_id: id
    });
    if (error) {
      console.error('Error archiving supplier account:', error);
      throw new Error(error.message);
    }
  },

  async restoreSupplierAccount(id: string): Promise<void> {
    const { error } = await supabase.rpc('restore_finance_record', {
      p_table: 'supplier_accounts',
      p_id: id
    });
    if (error) {
      console.error('Error restoring supplier account:', error);
      throw new Error(error.message);
    }
  },

  // --------------------------------------------------------------------------
  // 2. SUPPLIER INVOICES & LINES
  // --------------------------------------------------------------------------

  async getSupplierInvoices(
    companyId: string,
    filters?: { supplierAccountId?: string; projectId?: string; includeArchived?: boolean }
  ): Promise<SupplierInvoice[]> {
    if (!companyId) return [];

    let query = supabase
      .from('supplier_invoices')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!filters?.includeArchived) {
      query = query.eq('is_archived', false);
    }
    if (filters?.supplierAccountId) {
      query = query.eq('supplier_account_id', filters.supplierAccountId);
    }
    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching supplier invoices:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async getSupplierInvoiceWithLines(invoiceId: string): Promise<{ invoice: SupplierInvoice; lines: SupplierInvoiceLine[] }> {
    const [invRes, linesRes] = await Promise.all([
      supabase.from('supplier_invoices').select('*').eq('id', invoiceId).single(),
      supabase.from('supplier_invoice_lines').select('*').eq('supplier_invoice_id', invoiceId).order('sort_order', { ascending: true })
    ]);

    if (invRes.error) throw new Error(invRes.error.message);
    if (linesRes.error) throw new Error(linesRes.error.message);

    return {
      invoice: invRes.data,
      lines: linesRes.data || []
    };
  },

  async createSupplierInvoiceWithLines(
    invoiceHeader: {
      company_id: string;
      project_id: string;
      supplier_account_id: string;
      financial_commitment_id: string;
      supplier_invoice_number: string;
      external_reference?: string;
      invoice_date: string;
      due_date: string;
      billing_period_start?: string;
      billing_period_end?: string;
      notes?: string;
    },
    lines: Array<{
      line_code: string;
      description: string;
      quantity: number;
      unit?: string;
      unit_rate_excl_vat: number;
      vat_rate?: number;
      cost_category?: string;
      sort_order?: number;
    }>
  ): Promise<SupplierInvoice> {
    assertOperationalAction("create", "services/supplierAccountsService.ts");
    if (lines.length === 0) {
      throw new Error("At least one invoice line is required.");
    }

    // 1. Insert header in Draft
    const headerPayload = {
      company_id: invoiceHeader.company_id,
      project_id: invoiceHeader.project_id,
      supplier_account_id: invoiceHeader.supplier_account_id,
      financial_commitment_id: invoiceHeader.financial_commitment_id,
      supplier_invoice_number: invoiceHeader.supplier_invoice_number.trim(),
      external_reference: invoiceHeader.external_reference?.trim() || null,
      invoice_date: invoiceHeader.invoice_date,
      due_date: invoiceHeader.due_date,
      billing_period_start: invoiceHeader.billing_period_start || null,
      billing_period_end: invoiceHeader.billing_period_end || null,
      notes: invoiceHeader.notes?.trim() || null,
      currency: 'ZAR',
      status: 'Draft'
    };

    const { data: invData, error: invError } = await supabase
      .from('supplier_invoices')
      .insert([headerPayload])
      .select()
      .single();

    if (invError) {
      console.error('Error creating supplier invoice header:', invError);
      throw new Error(invError.message);
    }

    // 2. Insert lines
    const linePayloads = lines.map((l, idx) => ({
      company_id: invoiceHeader.company_id,
      project_id: invoiceHeader.project_id,
      supplier_invoice_id: invData.id,
      supplier_account_id: invoiceHeader.supplier_account_id,
      financial_commitment_id: invoiceHeader.financial_commitment_id,
      currency: 'ZAR',
      line_code: l.line_code || `LN-${idx + 1}`,
      description: l.description.trim(),
      quantity: l.quantity,
      unit: l.unit || 'SUM',
      unit_rate_excl_vat: l.unit_rate_excl_vat,
      vat_rate: l.vat_rate ?? 15.00,
      cost_category: l.cost_category || 'Supplier Cost',
      sort_order: l.sort_order ?? (idx + 1)
    }));

    const { error: lineError } = await supabase
      .from('supplier_invoice_lines')
      .insert(linePayloads);

    if (lineError) {
      console.error('Error creating supplier invoice lines:', lineError);
      // Clean up invoice header on line failure
      await supabase.from('supplier_invoices').delete().eq('id', invData.id);
      throw new Error(lineError.message);
    }

    // Re-fetch updated header to get calculated total_incl_vat updated by DB triggers
    const { data: freshInv } = await supabase
      .from('supplier_invoices')
      .select('*')
      .eq('id', invData.id)
      .single();

    return freshInv || invData;
  },

  async submitSupplierInvoice(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("write", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('submit_supplier_invoice', {
      p_invoice_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error submitting supplier invoice:', error);
      throw new Error(error.message);
    }
  },

  async approveSupplierInvoice(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("approve", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('approve_supplier_invoice', {
      p_invoice_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error approving supplier invoice:', error);
      throw new Error(error.message);
    }
  },

  async postSupplierInvoice(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("write", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('post_supplier_invoice', {
      p_invoice_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error posting supplier invoice:', error);
      throw new Error(error.message);
    }
  },

  async rejectSupplierInvoice(id: string, reason: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("approve", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('reject_supplier_invoice', {
      p_invoice_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error rejecting supplier invoice:', error);
      throw new Error(error.message);
    }
  },

  async cancelSupplierInvoice(id: string, reason: string, expectedVersion: number): Promise<void> {
    const { error } = await supabase.rpc('cancel_supplier_invoice', {
      p_invoice_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error cancelling supplier invoice:', error);
      throw new Error(error.message);
    }
  },

  async archiveSupplierInvoice(id: string): Promise<void> {
    const { error } = await supabase.rpc('archive_finance_record', {
      p_table: 'supplier_invoices',
      p_id: id
    });
    if (error) {
      console.error('Error archiving supplier invoice:', error);
      throw new Error(error.message);
    }
  },

  async restoreSupplierInvoice(id: string): Promise<void> {
    const { error } = await supabase.rpc('restore_finance_record', {
      p_table: 'supplier_invoices',
      p_id: id
    });
    if (error) {
      console.error('Error restoring supplier invoice:', error);
      throw new Error(error.message);
    }
  },

  // --------------------------------------------------------------------------
  // 3. SUPPLIER CREDIT NOTES & LINES
  // --------------------------------------------------------------------------

  async getSupplierCreditNotes(
    companyId: string,
    filters?: { supplierAccountId?: string; projectId?: string; includeArchived?: boolean }
  ): Promise<SupplierCreditNote[]> {
    if (!companyId) return [];

    let query = supabase
      .from('supplier_credit_notes')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!filters?.includeArchived) {
      query = query.eq('is_archived', false);
    }
    if (filters?.supplierAccountId) {
      query = query.eq('supplier_account_id', filters.supplierAccountId);
    }
    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching supplier credit notes:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async getSupplierCreditNoteWithLines(creditNoteId: string): Promise<{ creditNote: SupplierCreditNote; lines: SupplierCreditNoteLine[] }> {
    const [cnRes, linesRes] = await Promise.all([
      supabase.from('supplier_credit_notes').select('*').eq('id', creditNoteId).single(),
      supabase.from('supplier_credit_note_lines').select('*').eq('credit_note_id', creditNoteId).order('sort_order', { ascending: true })
    ]);

    if (cnRes.error) throw new Error(cnRes.error.message);
    if (linesRes.error) throw new Error(linesRes.error.message);

    return {
      creditNote: cnRes.data,
      lines: linesRes.data || []
    };
  },

  async createSupplierCreditNoteWithLines(
    cnHeader: {
      company_id: string;
      project_id: string;
      supplier_account_id: string;
      invoice_id: string;
      financial_commitment_id: string;
      credit_note_number: string;
      external_reference?: string;
      credit_note_date: string;
      reason: string;
      notes?: string;
    },
    lines: Array<{
      invoice_line_id?: string;
      line_code: string;
      description: string;
      quantity: number;
      unit?: string;
      unit_rate_excl_vat: number;
      vat_rate?: number;
      cost_category?: string;
      sort_order?: number;
    }>
  ): Promise<SupplierCreditNote> {
    assertOperationalAction("create", "services/supplierAccountsService.ts");
    if (lines.length === 0) {
      throw new Error("At least one credit note line is required.");
    }

    const headerPayload = {
      company_id: cnHeader.company_id,
      project_id: cnHeader.project_id,
      supplier_account_id: cnHeader.supplier_account_id,
      invoice_id: cnHeader.invoice_id,
      financial_commitment_id: cnHeader.financial_commitment_id,
      credit_note_number: cnHeader.credit_note_number.trim(),
      external_reference: cnHeader.external_reference?.trim() || null,
      credit_note_date: cnHeader.credit_note_date,
      reason: cnHeader.reason.trim(),
      notes: cnHeader.notes?.trim() || null,
      currency: 'ZAR',
      status: 'Draft'
    };

    const { data: cnData, error: cnError } = await supabase
      .from('supplier_credit_notes')
      .insert([headerPayload])
      .select()
      .single();

    if (cnError) {
      console.error('Error creating supplier credit note header:', cnError);
      throw new Error(cnError.message);
    }

    const linePayloads = lines.map((l, idx) => ({
      company_id: cnHeader.company_id,
      project_id: cnHeader.project_id,
      credit_note_id: cnData.id,
      invoice_line_id: l.invoice_line_id || null,
      supplier_account_id: cnHeader.supplier_account_id,
      financial_commitment_id: cnHeader.financial_commitment_id,
      currency: 'ZAR',
      line_code: l.line_code || `CNL-${idx + 1}`,
      description: l.description.trim(),
      quantity: l.quantity,
      unit: l.unit || 'SUM',
      unit_rate_excl_vat: l.unit_rate_excl_vat,
      vat_rate: l.vat_rate ?? 15.00,
      cost_category: l.cost_category || 'Supplier Cost',
      sort_order: l.sort_order ?? (idx + 1)
    }));

    const { error: lineError } = await supabase
      .from('supplier_credit_note_lines')
      .insert(linePayloads);

    if (lineError) {
      console.error('Error creating supplier credit note lines:', lineError);
      await supabase.from('supplier_credit_notes').delete().eq('id', cnData.id);
      throw new Error(lineError.message);
    }

    const { data: freshCn } = await supabase
      .from('supplier_credit_notes')
      .select('*')
      .eq('id', cnData.id)
      .single();

    return freshCn || cnData;
  },

  async submitSupplierCreditNote(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("write", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('submit_supplier_credit_note', {
      p_credit_note_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error submitting supplier credit note:', error);
      throw new Error(error.message);
    }
  },

  async approveSupplierCreditNote(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("approve", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('approve_supplier_credit_note', {
      p_credit_note_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error approving supplier credit note:', error);
      throw new Error(error.message);
    }
  },

  async postSupplierCreditNote(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("write", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('post_supplier_credit_note', {
      p_credit_note_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error posting supplier credit note:', error);
      throw new Error(error.message);
    }
  },

  async rejectSupplierCreditNote(id: string, reason: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("approve", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('reject_supplier_credit_note', {
      p_credit_note_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error rejecting supplier credit note:', error);
      throw new Error(error.message);
    }
  },

  async cancelSupplierCreditNote(id: string, reason: string, expectedVersion: number): Promise<void> {
    const { error } = await supabase.rpc('cancel_supplier_credit_note', {
      p_credit_note_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error cancelling supplier credit note:', error);
      throw new Error(error.message);
    }
  },

  async archiveSupplierCreditNote(id: string): Promise<void> {
    const { error } = await supabase.rpc('archive_finance_record', {
      p_table: 'supplier_credit_notes',
      p_id: id
    });
    if (error) {
      console.error('Error archiving supplier credit note:', error);
      throw new Error(error.message);
    }
  },

  async restoreSupplierCreditNote(id: string): Promise<void> {
    const { error } = await supabase.rpc('restore_finance_record', {
      p_table: 'supplier_credit_notes',
      p_id: id
    });
    if (error) {
      console.error('Error restoring supplier credit note:', error);
      throw new Error(error.message);
    }
  },

  // --------------------------------------------------------------------------
  // 4. SUPPLIER PAYMENTS & ALLOCATIONS
  // --------------------------------------------------------------------------

  async getSupplierPayments(
    companyId: string,
    filters?: { supplierAccountId?: string; projectId?: string; includeArchived?: boolean }
  ): Promise<SupplierPayment[]> {
    if (!companyId) return [];

    let query = supabase
      .from('supplier_payments')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!filters?.includeArchived) {
      query = query.eq('is_archived', false);
    }
    if (filters?.supplierAccountId) {
      query = query.eq('supplier_account_id', filters.supplierAccountId);
    }
    if (filters?.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching supplier payments:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async getSupplierPaymentAllocations(
    companyId: string,
    filters?: { supplierPaymentId?: string; supplierAccountId?: string; supplierInvoiceId?: string }
  ): Promise<SupplierPaymentAllocation[]> {
    if (!companyId) return [];

    let query = supabase
      .from('supplier_payment_allocations')
      .select('*')
      .eq('company_id', companyId)
      .order('allocated_at', { ascending: false });

    if (filters?.supplierPaymentId) {
      query = query.eq('supplier_payment_id', filters.supplierPaymentId);
    }
    if (filters?.supplierAccountId) {
      query = query.eq('supplier_account_id', filters.supplierAccountId);
    }
    if (filters?.supplierInvoiceId) {
      query = query.eq('supplier_invoice_id', filters.supplierInvoiceId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching supplier payment allocations:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async createSupplierPayment(payment: {
    company_id: string;
    project_id: string;
    supplier_account_id: string;
    bank_account_id: string;
    payment_reference: string;
    external_reference?: string;
    payment_date: string;
    payment_method: 'EFT' | 'Cheque' | 'Credit Card' | 'Cash' | 'Other';
    amount_paid: number;
    notes?: string;
  }): Promise<SupplierPayment> {
    assertOperationalAction("create", "services/supplierAccountsService.ts");
    const payload = {
      company_id: payment.company_id,
      project_id: payment.project_id,
      supplier_account_id: payment.supplier_account_id,
      bank_account_id: payment.bank_account_id,
      payment_reference: payment.payment_reference.trim(),
      external_reference: payment.external_reference?.trim() || null,
      payment_date: payment.payment_date,
      payment_method: payment.payment_method || 'EFT',
      amount_paid: payment.amount_paid,
      currency: 'ZAR',
      notes: payment.notes?.trim() || null,
      status: 'Draft'
    };

    const { data, error } = await supabase
      .from('supplier_payments')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier payment:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async submitSupplierPayment(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("write", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('submit_supplier_payment', {
      p_payment_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error submitting supplier payment:', error);
      throw new Error(error.message);
    }
  },

  async approveSupplierPayment(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("approve", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('approve_supplier_payment', {
      p_payment_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error approving supplier payment:', error);
      throw new Error(error.message);
    }
  },

  async postSupplierPayment(id: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("write", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('post_supplier_payment', {
      p_payment_id: id,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error posting supplier payment:', error);
      throw new Error(error.message);
    }
  },

  async rejectSupplierPayment(id: string, reason: string, expectedVersion: number): Promise<void> {
    assertOperationalAction("approve", "services/supplierAccountsService.ts");
    const { error } = await supabase.rpc('reject_supplier_payment', {
      p_payment_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error rejecting supplier payment:', error);
      throw new Error(error.message);
    }
  },

  async cancelSupplierPayment(id: string, reason: string, expectedVersion: number): Promise<void> {
    const { error } = await supabase.rpc('cancel_supplier_payment', {
      p_payment_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error cancelling supplier payment:', error);
      throw new Error(error.message);
    }
  },

  async reverseSupplierPayment(id: string, reason: string, expectedVersion: number): Promise<void> {
    const { error } = await supabase.rpc('reverse_supplier_payment', {
      p_payment_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error reversing supplier payment:', error);
      throw new Error(error.message);
    }
  },

  async allocateSupplierPayment(paymentId: string, invoiceId: string, amount: number): Promise<void> {
    const { error } = await supabase.rpc('allocate_supplier_payment', {
      p_payment_id: paymentId,
      p_invoice_id: invoiceId,
      p_amount: amount
    });
    if (error) {
      console.error('Error allocating supplier payment:', error);
      throw new Error(error.message);
    }
  },

  async reverseSupplierPaymentAllocation(allocationId: string, reason: string, expectedVersion: number): Promise<void> {
    const { error } = await supabase.rpc('reverse_supplier_payment_allocation', {
      p_allocation_id: allocationId,
      p_reversal_reason: reason,
      p_expected_version: expectedVersion
    });
    if (error) {
      console.error('Error reversing supplier payment allocation:', error);
      throw new Error(error.message);
    }
  },

  async archiveSupplierPayment(id: string): Promise<void> {
    const { error } = await supabase.rpc('archive_finance_record', {
      p_table: 'supplier_payments',
      p_id: id
    });
    if (error) {
      console.error('Error archiving supplier payment:', error);
      throw new Error(error.message);
    }
  },

  async restoreSupplierPayment(id: string): Promise<void> {
    const { error } = await supabase.rpc('restore_finance_record', {
      p_table: 'supplier_payments',
      p_id: id
    });
    if (error) {
      console.error('Error restoring supplier payment:', error);
      throw new Error(error.message);
    }
  },

  // --------------------------------------------------------------------------
  // 5. AUDIT LOGS & ATTACHMENTS
  // --------------------------------------------------------------------------

  async getSupplierAuditLogs(companyId: string, entityType?: string, entityId?: string): Promise<SupplierAccountsAuditLog[]> {
    if (!companyId) return [];

    let query = supabase
      .from('supplier_accounts_audit_log')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching supplier audit logs:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async getSupplierAttachments(companyId: string, entityType?: string, entityId?: string): Promise<any[]> {
    if (!companyId) return [];
    try {
      const attachments = await getAccountAttachments(companyId, {
        recordType: entityType,
        recordId: entityId,
      });
      return attachments.map((att) => ({
        id: att.id,
        company_id: att.company_id,
        entity_type: att.record_type,
        entity_id: att.record_id,
        document_category: att.document_type,
        file_name: att.original_filename,
        file_path: att.storage_path,
        file_size: att.file_size_bytes,
        mime_type: att.mime_type,
        uploaded_at: att.uploaded_at,
        is_archived: att.is_archived,
        created_at: att.created_at,
      }));
    } catch (err) {
      console.error('Error fetching supplier attachments via shared account attachments:', err);
      return [];
    }
  },

  async createSupplierAttachment(attachment: {
    company_id: string;
    entity_type: 'supplier_account' | 'supplier_invoice' | 'supplier_credit_note' | 'supplier_payment';
    entity_id: string;
    document_category?: 'Supplier Invoice' | 'Credit Note' | 'Proof of Payment' | 'Supplier Statement' | 'Bank Confirmation' | 'Tax Document' | 'Contract' | 'Other';
    file_name: string;
    file_path: string;
    file_size?: number;
    mime_type?: string;
  }): Promise<SupplierAttachment> {
    assertOperationalAction("create", "services/supplierAccountsService.ts");
    const payload = {
      company_id: attachment.company_id,
      entity_type: attachment.entity_type,
      entity_id: attachment.entity_id,
      document_category: attachment.document_category || 'Other',
      file_name: attachment.file_name.trim(),
      file_path: attachment.file_path.trim(),
      file_size: attachment.file_size || null,
      mime_type: attachment.mime_type || null
    };

    const { data, error } = await supabase
      .from('supplier_attachments')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier attachment:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async archiveSupplierAttachment(id: string): Promise<void> {
    const { error } = await supabase
      .from('supplier_attachments')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) {
      console.error('Error archiving supplier attachment:', error);
      throw new Error(error.message);
    }
  },

  // --------------------------------------------------------------------------
  // 6. AGEING & STATEMENT CALCULATIONS
  // --------------------------------------------------------------------------

  async getSupplierPayablesAgeing(companyId: string, asOfDate?: string): Promise<SupplierPayablesAgeing[]> {
    if (!companyId) return [];

    const { data, error } = await supabase.rpc('get_supplier_payables_ageing', {
      p_company_id: companyId,
      p_as_of_date: asOfDate || new Date().toISOString().slice(0, 10)
    });

    if (error) {
      console.error('Error fetching supplier payables ageing:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async associateCommitmentSupplier(commitmentId: string, supplierAccountId: string): Promise<void> {
    const { error } = await supabase.rpc('associate_commitment_supplier', {
      p_commitment_id: commitmentId,
      p_supplier_account_id: supplierAccountId
    });

    if (error) {
      console.error('Error associating commitment with supplier account:', error);
      throw new Error(error.message);
    }
  }
};
