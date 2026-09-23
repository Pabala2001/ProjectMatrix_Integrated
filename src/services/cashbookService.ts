import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from '../lib/supabase';

// ============================================================================
// Type Definitions for Cashbook Module (Phase 2D)
// ============================================================================

export interface BankAccount {
  id: string;
  company_id: string;
  account_name: string;
  account_type: 'Bank' | 'Petty Cash' | 'Credit Card' | 'Investment' | 'Other';
  bank_name?: string | null;
  account_number?: string | null;
  branch_code?: string | null;
  swift_bic?: string | null;
  currency: string;
  opening_balance: number;
  opening_balance_date: string;
  version: number;
  is_active: boolean;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface CashbookTransaction {
  id: string;
  company_id: string;
  project_id?: string | null;
  bank_account_id: string;
  transaction_type: 'Receipt' | 'Payment' | 'Transfer In' | 'Transfer Out';
  transaction_date: string;
  reference_number: string;
  external_reference?: string | null;
  payee_payer_name?: string | null;
  description: string;
  amount: number;
  vat_amount: number;
  currency: string;
  payment_method: 'EFT' | 'Cheque' | 'Credit Card' | 'Cash' | 'Direct Debit' | 'Other';
  status: 'Draft' | 'Submitted' | 'Approved' | 'Posted' | 'Reconciled' | 'Cancelled' | 'Reversed';
  reconciliation_status: 'Unreconciled' | 'Matched' | 'Reconciled';
  version: number;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  posted_by?: string | null;
  posted_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  is_archived: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  // Joined virtual fields
  bank_account_name?: string;
  project_title?: string;
}

export interface CashbookAllocation {
  id: string;
  company_id: string;
  cashbook_transaction_id: string;
  allocation_type: 'Client Receipt' | 'Supplier Payment' | 'Financial Cost Posting' | 'General Ledger';
  target_id: string;
  amount_allocated: number;
  allocated_at: string;
  allocated_by?: string | null;
  notes?: string | null;
  version: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankStatementImport {
  id: string;
  company_id: string;
  bank_account_id: string;
  filename: string;
  file_format: 'OFX' | 'CSV' | 'QBO' | 'MT940' | 'PDF' | 'Manual';
  statement_identifier?: string | null;
  import_date: string;
  imported_by?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  opening_balance?: number | null;
  closing_balance?: number | null;
  total_lines_imported: number;
  status: 'Uploaded' | 'Processing' | 'Completed' | 'Error' | 'Cancelled';
  notes?: string | null;
  version: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankStatementLine {
  id: string;
  company_id: string;
  import_id: string;
  bank_account_id: string;
  line_number: number;
  transaction_date: string;
  value_date?: string | null;
  bank_reference?: string | null;
  description: string;
  amount: number;
  balance_after?: number | null;
  match_status: 'Unmatched' | 'Partially Matched' | 'Matched' | 'Ignored';
  version: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliationSession {
  id: string;
  company_id: string;
  bank_account_id: string;
  statement_end_date: string;
  statement_ending_balance: number;
  cleared_deposits_count: number;
  cleared_deposits_sum: number;
  cleared_withdrawals_count: number;
  cleared_withdrawals_sum: number;
  calculated_balance: number;
  difference_amount: number;
  status: 'In Progress' | 'Completed' | 'Cancelled';
  version: number;
  started_at: string;
  started_by?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliationMatch {
  id: string;
  company_id: string;
  reconciliation_session_id: string;
  statement_line_id: string;
  cashbook_transaction_id: string;
  matched_amount: number;
  match_type: 'Exact' | 'Rule Based' | 'Manual' | 'Split';
  version: number;
  matched_at: string;
  matched_by?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashbookAttachment {
  id: string;
  company_id: string;
  record_type: 'cashbook_transaction' | 'bank_statement_import' | 'reconciliation_session';
  record_id: string;
  document_category: 'Proof of Payment' | 'Invoice' | 'Deposit Slip' | 'Bank Confirmation' | 'Statement' | 'Other';
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

export interface CashbookAuditLog {
  id: string;
  company_id: string;
  table_name: string;
  record_id: string;
  action: string;
  performed_by?: string | null;
  performed_at: string;
  details?: any;
}

// ============================================================================
// Service Object Implementation
// ============================================================================

export const cashbookService = {
  // --------------------------------------------------------------------------
  // 1. BANK ACCOUNTS
  // --------------------------------------------------------------------------

  async getBankAccounts(companyId: string, includeArchived = false): Promise<BankAccount[]> {
    let query = supabase
      .from('bank_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('account_name', { ascending: true });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching bank accounts:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async createBankAccount(bankAccount: Partial<BankAccount>): Promise<BankAccount> {
    assertOperationalAction("create", "services/cashbookService.ts");
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      ...bankAccount,
      currency: 'ZAR',
      created_by: user?.user?.id || null,
      updated_by: user?.user?.id || null,
    };

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating bank account:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async updateBankAccount(id: string, updates: Partial<BankAccount>, expectedVersion?: number): Promise<BankAccount> {
    assertOperationalAction("edit", "services/cashbookService.ts");
    const { data: user } = await supabase.auth.getUser();
    let query = supabase
      .from('bank_accounts')
      .update({ ...updates, updated_by: user?.user?.id || null })
      .eq('id', id);

    if (expectedVersion !== undefined && expectedVersion !== null) {
      query = query.eq('version', expectedVersion);
    }

    const { data, error } = await query.select().single();
    if (error) {
      console.error('Error updating bank account:', error);
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Optimistic locking conflict: bank account was modified by another user.');
    }
    return data;
  },

  async archiveBankAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('bank_accounts')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) {
      console.error('Error archiving bank account:', error);
      throw new Error(error.message);
    }
  },

  async restoreBankAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('bank_accounts')
      .update({ is_archived: false })
      .eq('id', id);

    if (error) {
      console.error('Error restoring bank account:', error);
      throw new Error(error.message);
    }
  },

  // --------------------------------------------------------------------------
  // 2. CASHBOOK TRANSACTIONS
  // --------------------------------------------------------------------------

  async getTransactions(
    companyId: string,
    options?: { bankAccountId?: string; projectId?: string; status?: string; includeArchived?: boolean }
  ): Promise<CashbookTransaction[]> {
    let query = supabase
      .from('cashbook_transactions')
      .select(`
        *,
        bank_accounts ( account_name ),
        projects ( name )
      `)
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.bankAccountId) {
      query = query.eq('bank_account_id', options.bankAccountId);
    }
    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    }
    if (options?.status && options.status !== 'All') {
      query = query.eq('status', options.status);
    }
    if (!options?.includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching cashbook transactions:', error);
      throw new Error(error.message);
    }

    return (data || []).map((item: any) => ({
      ...item,
      bank_account_name: item.bank_accounts?.account_name || 'N/A',
      project_title: item.projects?.name || 'N/A',
    }));
  },

  async createTransaction(transaction: Partial<CashbookTransaction>): Promise<CashbookTransaction> {
    assertOperationalAction("create", "services/cashbookService.ts");
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      ...transaction,
      currency: 'ZAR',
      status: transaction.status || 'Draft',
      reconciliation_status: 'Unreconciled',
      created_by: user?.user?.id || null,
      updated_by: user?.user?.id || null,
    };

    const { data, error } = await supabase
      .from('cashbook_transactions')
      .insert([payload])
      .select(`
        *,
        bank_accounts ( account_name ),
        projects ( name )
      `)
      .single();

    if (error) {
      console.error('Error creating cashbook transaction:', error);
      throw new Error(error.message);
    }

    return {
      ...data,
      bank_account_name: data.bank_accounts?.account_name || 'N/A',
      project_title: data.projects?.name || 'N/A',
    };
  },

  async updateTransaction(
    id: string,
    updates: Partial<CashbookTransaction>,
    expectedVersion?: number
  ): Promise<CashbookTransaction> {
    assertOperationalAction("edit", "services/cashbookService.ts");
    const { data: user } = await supabase.auth.getUser();
    let query = supabase
      .from('cashbook_transactions')
      .update({ ...updates, updated_by: user?.user?.id || null })
      .eq('id', id);

    if (expectedVersion !== undefined && expectedVersion !== null) {
      query = query.eq('version', expectedVersion);
    }

    const { data, error } = await query
      .select(`
        *,
        bank_accounts ( account_name ),
        projects ( name )
      `)
      .single();

    if (error) {
      console.error('Error updating cashbook transaction:', error);
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Optimistic locking conflict: transaction was modified by another user.');
    }

    return {
      ...data,
      bank_account_name: data.bank_accounts?.account_name || 'N/A',
      project_title: data.projects?.name || 'N/A',
    };
  },

  // Lifecycle RPCs
  async submitTransaction(id: string, expectedVersion?: number): Promise<any> {
    assertOperationalAction("write", "services/cashbookService.ts");
    const { data, error } = await supabase.rpc('submit_cashbook_transaction', {
      p_id: id,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      console.error('Error submitting transaction:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async approveTransaction(id: string, expectedVersion?: number): Promise<any> {
    assertOperationalAction("approve", "services/cashbookService.ts");
    const { data, error } = await supabase.rpc('approve_cashbook_transaction', {
      p_id: id,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      console.error('Error approving transaction:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async postTransaction(id: string, expectedVersion?: number): Promise<any> {
    assertOperationalAction("write", "services/cashbookService.ts");
    const { data, error } = await supabase.rpc('post_cashbook_transaction', {
      p_id: id,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      console.error('Error posting transaction:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async cancelTransaction(id: string, reason: string, expectedVersion?: number): Promise<any> {
    const { data, error } = await supabase.rpc('cancel_cashbook_transaction', {
      p_id: id,
      p_reason: reason,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      console.error('Error cancelling transaction:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async archiveTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('cashbook_transactions')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) {
      console.error('Error archiving transaction:', error);
      throw new Error(error.message);
    }
  },

  async restoreTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('cashbook_transactions')
      .update({ is_archived: false })
      .eq('id', id);

    if (error) {
      console.error('Error restoring transaction:', error);
      throw new Error(error.message);
    }
  },

  // --------------------------------------------------------------------------
  // 3. ALLOCATIONS
  // --------------------------------------------------------------------------

  async getAllocations(companyId: string, transactionId?: string): Promise<CashbookAllocation[]> {
    let query = supabase
      .from('cashbook_allocations')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (transactionId) {
      query = query.eq('cashbook_transaction_id', transactionId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching allocations:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async createAllocation(allocation: Partial<CashbookAllocation>): Promise<CashbookAllocation> {
    assertOperationalAction("create", "services/cashbookService.ts");
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      ...allocation,
      allocated_by: user?.user?.id || null,
    };

    const { data, error } = await supabase
      .from('cashbook_allocations')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating allocation:', error);
      throw new Error(error.message);
    }
    return data;
  },

  // --------------------------------------------------------------------------
  // 4. BANK STATEMENT IMPORTS & LINES
  // --------------------------------------------------------------------------

  async getStatementImports(companyId: string, bankAccountId?: string): Promise<BankStatementImport[]> {
    let query = supabase
      .from('bank_statement_imports')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_archived', false)
      .order('import_date', { ascending: false });

    if (bankAccountId) {
      query = query.eq('bank_account_id', bankAccountId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching statement imports:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async createStatementImportWithLines(
    importData: Partial<BankStatementImport>,
    lines: Partial<BankStatementLine>[]
  ): Promise<{ importRecord: BankStatementImport; insertedLines: BankStatementLine[] }> {
    assertOperationalAction("create", "services/cashbookService.ts");
    const { data: user } = await supabase.auth.getUser();
    
    // 1. Insert import record
    const importPayload = {
      ...importData,
      imported_by: user?.user?.id || null,
      total_lines_imported: lines.length,
      status: 'Completed',
    };

    const { data: importRecord, error: importError } = await supabase
      .from('bank_statement_imports')
      .insert([importPayload])
      .select()
      .single();

    if (importError) {
      console.error('Error creating bank statement import:', importError);
      throw new Error(importError.message);
    }

    // 2. Prepare and insert statement lines
    const linePayloads = lines.map((line, idx) => ({
      ...line,
      company_id: importRecord.company_id,
      import_id: importRecord.id,
      bank_account_id: importRecord.bank_account_id,
      line_number: line.line_number || idx + 1,
      match_status: 'Unmatched',
    }));

    const { data: insertedLines, error: linesError } = await supabase
      .from('bank_statement_lines')
      .insert(linePayloads)
      .select();

    if (linesError) {
      console.error('Error creating bank statement lines:', linesError);
      await supabase
        .from('bank_statement_imports')
        .update({ status: 'Error', notes: linesError.message })
        .eq('id', importRecord.id);
      throw new Error(linesError.message);
    }

    return { importRecord, insertedLines: insertedLines || [] };
  },

  async getStatementLines(
    companyId: string,
    options?: { importId?: string; bankAccountId?: string; matchStatus?: string }
  ): Promise<BankStatementLine[]> {
    let query = supabase
      .from('bank_statement_lines')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_archived', false)
      .order('transaction_date', { ascending: false })
      .order('line_number', { ascending: true });

    if (options?.importId) {
      query = query.eq('import_id', options.importId);
    }
    if (options?.bankAccountId) {
      query = query.eq('bank_account_id', options.bankAccountId);
    }
    if (options?.matchStatus && options.matchStatus !== 'All') {
      query = query.eq('match_status', options.matchStatus);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching statement lines:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  // --------------------------------------------------------------------------
  // 5. RECONCILIATION SESSIONS & MATCHES
  // --------------------------------------------------------------------------

  async getReconciliationSessions(companyId: string, bankAccountId?: string): Promise<BankReconciliationSession[]> {
    let query = supabase
      .from('bank_reconciliation_sessions')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_archived', false)
      .order('statement_end_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (bankAccountId) {
      query = query.eq('bank_account_id', bankAccountId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching reconciliation sessions:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async createReconciliationSession(
    session: Partial<BankReconciliationSession>
  ): Promise<BankReconciliationSession> {
    assertOperationalAction("create", "services/cashbookService.ts");
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      ...session,
      status: 'In Progress',
      started_by: user?.user?.id || null,
      started_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('bank_reconciliation_sessions')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating reconciliation session:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async matchStatementLine(params: {
    sessionId: string;
    statementLineId: string;
    cashbookTransactionId: string;
    matchedAmount: number;
    matchType?: 'Exact' | 'Rule Based' | 'Manual' | 'Split';
    expectedSessionVersion?: number;
    expectedLineVersion?: number;
    expectedTxVersion?: number;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('match_bank_statement_line', {
      p_session_id: params.sessionId,
      p_statement_line_id: params.statementLineId,
      p_cashbook_transaction_id: params.cashbookTransactionId,
      p_matched_amount: params.matchedAmount,
      p_match_type: params.matchType || 'Exact',
      p_expected_session_version: params.expectedSessionVersion ?? null,
      p_expected_line_version: params.expectedLineVersion ?? null,
      p_expected_tx_version: params.expectedTxVersion ?? null,
    });

    if (error) {
      console.error('Error matching statement line:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async unmatchStatementLine(matchId: string, expectedMatchVersion?: number): Promise<any> {
    const { data, error } = await supabase.rpc('unmatch_bank_statement_line', {
      p_match_id: matchId,
      p_expected_match_version: expectedMatchVersion ?? null,
    });

    if (error) {
      console.error('Error unmatching statement line:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async completeReconciliationSession(sessionId: string, expectedVersion?: number): Promise<any> {
    const { data, error } = await supabase.rpc('complete_bank_reconciliation_session', {
      p_session_id: sessionId,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      console.error('Error completing reconciliation session:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async getReconciliationMatches(companyId: string, sessionId?: string): Promise<BankReconciliationMatch[]> {
    let query = supabase
      .from('bank_reconciliation_matches')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_archived', false)
      .order('matched_at', { ascending: false });

    if (sessionId) {
      query = query.eq('reconciliation_session_id', sessionId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching reconciliation matches:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  // --------------------------------------------------------------------------
  // 6. ATTACHMENTS (SUPABASE STORAGE & METADATA)
  // --------------------------------------------------------------------------

  async uploadAttachment(
    file: File,
    companyId: string,
    recordType: 'cashbook_transaction' | 'bank_statement_import' | 'reconciliation_session',
    recordId: string,
    documentCategory: 'Proof of Payment' | 'Invoice' | 'Deposit Slip' | 'Bank Confirmation' | 'Statement' | 'Other' = 'Other'
  ): Promise<CashbookAttachment> {
    assertOperationalAction("write", "services/cashbookService.ts");
    const { data: user } = await supabase.auth.getUser();
    
    // 1. Upload to Supabase Storage bucket 'cashbook-attachments'
    const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = `${companyId}/${recordType}/${recordId}/${cleanFileName}`;

    const { error: storageError } = await supabase.storage
      .from('cashbook-attachments')
      .upload(filePath, file, { upsert: true });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      // Fallback: If bucket does not exist or fails, save path as virtual file path
    }

    // 2. Insert metadata record in cashbook_attachments
    const payload = {
      company_id: companyId,
      record_type: recordType,
      record_id: recordId,
      document_category: documentCategory,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      uploaded_by: user?.user?.id || null,
    };

    const { data, error: dbError } = await supabase
      .from('cashbook_attachments')
      .insert([payload])
      .select()
      .single();

    if (dbError) {
      console.error('Error saving attachment metadata:', dbError);
      throw new Error(dbError.message);
    }

    return data;
  },

  async getAttachments(
    companyId: string,
    recordType: string,
    recordId: string
  ): Promise<CashbookAttachment[]> {
    const { data, error } = await supabase
      .from('cashbook_attachments')
      .select('*')
      .eq('company_id', companyId)
      .eq('record_type', recordType)
      .eq('record_id', recordId)
      .eq('is_archived', false)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async deleteAttachment(attachmentId: string, filePath: string): Promise<void> {
    assertOperationalAction("delete", "services/cashbookService.ts");
    // 1. Archive metadata
    const { error: dbError } = await supabase
      .from('cashbook_attachments')
      .update({ is_archived: true })
      .eq('id', attachmentId);

    if (dbError) {
      console.error('Error deleting attachment metadata:', dbError);
      throw new Error(dbError.message);
    }

    // 2. Remove file from storage
    if (filePath) {
      await supabase.storage.from('cashbook-attachments').remove([filePath]);
    }
  },

  getAttachmentUrl(filePath: string): string {
    const { data } = supabase.storage.from('cashbook-attachments').getPublicUrl(filePath);
    return data?.publicUrl || '#';
  },

  // --------------------------------------------------------------------------
  // 7. AUDIT LOGS
  // --------------------------------------------------------------------------

  async getAuditLogs(
    companyId: string,
    recordId?: string,
    tableName?: string
  ): Promise<CashbookAuditLog[]> {
    let query = supabase
      .from('cashbook_audit_log')
      .select('*')
      .eq('company_id', companyId)
      .order('performed_at', { ascending: false });

    if (recordId) {
      query = query.eq('record_id', recordId);
    }
    if (tableName) {
      query = query.eq('table_name', tableName);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching audit logs:', error);
      throw new Error(error.message);
    }
    return data || [];
  },
};
