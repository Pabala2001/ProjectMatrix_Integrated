export type CommercialCategory =
  | "BOQ"
  | "CONTRACT_VALUE"
  | "BUDGET"
  | "FORECAST"
  | "PAYMENT_CERTIFICATE"
  | "PAYMENT_APPLICATION"
  | "CLIENT_INVOICE"
  | "SUPPLIER_INVOICE"
  | "PURCHASE_ORDER"
  | "SUBCONTRACT"
  | "COMMITMENT"
  | "ACTUAL_COST"
  | "CASH_FLOW"
  | "BANK_TRANSACTION"
  | "VARIATION"
  | "RETENTION"
  | "TAX"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_MADE"
  | "OUTSTANDING_BALANCE";

export type CommercialRecordType =
  | "BUDGET"
  | "ACTUAL_COST"
  | "COMMITMENT"
  | "CLIENT_CERTIFICATE"
  | "SUPPLIER_INVOICE"
  | "BANK_TRANSACTION";

export interface CommercialSupportingDocument {
  id: string;
  name: string;
  type:
    | "Quotation"
    | "Purchase Order"
    | "Subcontract"
    | "Payment Certificate"
    | "Supplier Invoice"
    | "Tax Invoice"
    | "Proof of Payment"
    | "Bank Confirmation"
    | "Receipt"
    | "Delivery Note"
    | "Expense Voucher"
    | "BOQ Worksheet"
    | "Contract Agreement"
    | "Change Order"
    | "Supplier Statement"
    | "Other";
  size?: number | string;
  uploadedBy: string;
  uploadedOn: string;
  fileData?: string;
  fileType?: string;
  version?: number;
  notes?: string;
  url?: string;
}

export interface SourceProvenance {
  sourceDocumentId?: string;
  originalFilename: string;
  uploadDate: string;
  uploadedBy: string;
  sheetOrPage?: string;
  originalField?: string;
  originalValue?: string | number | null;
  mappedField?: string;
  importStatus: "VERIFIED" | "MANUAL_ENTRY" | "LINKED_MODULE" | "FLAGGED_REVIEW" | "OVERRIDDEN";
  approvalStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "POSTED" | "SUPERSEDED";
  importBatchId?: string;
  overrideReason?: string;
  previousValue?: string | number | null;
}

export interface CommercialAuditEntry {
  id: string;
  timestamp: string;
  action: "IMPORT" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "POST" | "REVERSE" | "OVERRIDE" | "ARCHIVE";
  changedBy: string;
  fieldName?: string;
  previousValue?: any;
  newValue?: any;
  sourceDocument?: string;
  overrideReason?: string;
  notes?: string;
}

// 1. Commercial Overview Summary
export interface CommercialOverviewMetrics {
  originalContractValue: number | null;
  approvedVariations: number | null;
  revisedContractValue: number | null;
  certifiedToDate: number | null;
  paidToDate: number | null;
  outstandingReceivables: number | null;
  approvedBudget: number | null;
  actualCost: number | null;
  committedCost: number | null;
  forecastCostToComplete: number | null;
  forecastFinalCost: number | null;
  currentCashPosition: number | null;
  currency: string;
}

export interface BudgetSubItem {
  id: string;
  description: string;
  quantity: number | null;
  unit: string;
  rate: number | null;
  amount: number | null;
  quotationRef?: string;
  quotationDoc?: CommercialSupportingDocument;
}

// 2. Budget & Forecast
export interface BudgetLineItem {
  id: string;
  companyId: string;
  projectId: string;
  costCode: string;
  description: string;
  category?: string;
  quantity?: number | null;
  originalQuantity?: number | null;
  unit?: string;
  rate?: number | null;
  originalRate?: number | null;
  originalBudget: number | null;
  approvedChanges: number | null;
  revisedBudget: number | null;
  actualCost?: number | null;
  forecastFinalCost?: number | null;
  variance?: number | null;
  currency: string;
  source: SourceProvenance;
  documents?: CommercialSupportingDocument[];
  subItems?: BudgetSubItem[];
  auditTrail?: CommercialAuditEntry[];
  status?: string;
  wbs?: string;
  wbsCode?: string;
  section?: string;
  contract?: string;
  notes?: string;
}

export interface BudgetVersionRecord {
  id: string;
  companyId?: string;
  projectId?: string;
  version: string;
  description: string;
  status: "Current" | "Superseded" | "Draft";
  effectiveDate: string;
  originalBudget: number | null;
  revisedBudget: number | null;
  createdBy: string;
  createdOn: string;
  documentsCount: number;
  documents?: CommercialSupportingDocument[];
}

export interface ForecastLineItem {
  id: string;
  companyId: string;
  projectId: string;
  costCode: string;
  description: string;
  revisedBudget: number | null;
  actualCost: number | null;
  commitments: number | null;
  forecastToComplete: number | null;
  forecastFinalCost: number | null;
  variance: number | null; // Revised Budget - Forecast Final Cost
  currency: string;
  source: SourceProvenance;
  documents?: CommercialSupportingDocument[];
  auditTrail?: CommercialAuditEntry[];
}

// 3. Commitments Register
export interface CommitmentRegisterItem {
  id: string;
  companyId: string;
  projectId: string;
  ref: string;
  counterparty: string;
  supplier?: string;
  supplierName?: string;
  description: string;
  costCode?: string;
  type: "Purchase Order" | "Subcontract" | "Supplier Order" | "Rental Agreement" | "Service Agreement" | "Approved Variation";
  quantity?: number | null;
  unit?: string;
  rate?: number | null;
  originalValue: number | null;
  changes: number | null;
  currentCommitment: number | null;
  invoiced?: number | null;
  paid: number | null;
  outstanding: number | null;
  status: "Draft" | "Submitted" | "Approved" | "Closed" | "Cancelled" | "Pending";
  currency: string;
  source: SourceProvenance;
  documents?: CommercialSupportingDocument[];
  linkedQuotationRef?: string;
  linkedInvoices?: string[];
  date?: string;
  issueDate?: string;
  startDate?: string;
  completionDate?: string;
  auditTrail?: CommercialAuditEntry[];
  notes?: string;
}

// 4. Actual Costs Register
export interface ActualCostRegisterItem {
  id: string;
  companyId: string;
  projectId: string;
  date: string;
  costCode: string;
  description: string;
  supplier: string;
  reference: string;
  invoiceNumber?: string;
  quantity?: number | null;
  unit?: string;
  rate?: number | null;
  net: number | null;
  tax: number | null;
  total: number | null;
  paidAmount?: number | null;
  outstandingAmount?: number | null;
  paymentStatus?: "Unpaid" | "Partially Paid" | "Paid";
  paymentEvidence?: CommercialSupportingDocument;
  linkedCommitmentRef?: string;
  source: SourceProvenance;
  status: "Draft" | "Submitted" | "Posted" | "Reversed" | "Rejected";
  sourceType: "Supplier Invoice" | "Tax Invoice" | "Receipt" | "Delivery Note" | "Expense Voucher" | "Labour Payroll" | "Direct Expense" | "Adjustment";
  currency: string;
  documents?: CommercialSupportingDocument[];
  auditTrail?: CommercialAuditEntry[];
  notes?: string;
}

// 5. Client Accounts
export interface ClientCertificateRecord {
  id: string;
  companyId: string;
  projectId: string;
  certificateNumber: string;
  period: string;
  periodEnding?: string;
  date?: string;
  contract?: string;
  clientName?: string;
  claimReference?: string;
  description?: string;
  appliedAmount: number | null;
  claimedAmount?: number | null;
  certifiedAmount: number | null;
  invoicedAmount: number | null;
  paidAmount: number | null;
  retentionWithheld: number | null;
  retentionDeducted?: number | null;
  vatAmount?: number | null;
  otherDeductions?: number | null;
  netPayable?: number | null;
  outstandingAmount: number | null;
  status: "Draft" | "Submitted" | "Certified" | "Invoiced" | "Partially Paid" | "Fully Paid" | "Received" | "Disputed";
  issueDate?: string;
  paymentDueDate?: string;
  currency: string;
  source: SourceProvenance;
  documents?: CommercialSupportingDocument[];
  paymentEvidence?: CommercialSupportingDocument;
  auditTrail?: CommercialAuditEntry[];
  notes?: string;
}

// 6. Supplier Accounts
export interface SupplierInvoiceRecord {
  id: string;
  companyId: string;
  projectId: string;
  invoiceNumber: string;
  supplier: string;
  supplierName?: string;
  supplierId?: string;
  date: string;
  issueDate?: string;
  dueDate: string;
  costCode?: string;
  description?: string;
  net: number | null;
  tax: number | null;
  total: number | null;
  amount?: number | null;
  paid: number | null;
  paidAmount?: number | null;
  outstanding: number | null;
  status: "Draft" | "Submitted" | "Approved" | "Posted" | "Partially Paid" | "Paid" | "Rejected" | "Overdue";
  currency: string;
  commitmentRef?: string;
  poReference?: string;
  documents?: CommercialSupportingDocument[];
  paymentEvidence?: CommercialSupportingDocument;
  source: SourceProvenance;
  auditTrail?: CommercialAuditEntry[];
  notes?: string;
}

export interface SupplierDirectoryItem {
  id: string;
  companyId: string;
  supplierCode: string;
  legalName: string;
  tradingName?: string;
  vatNumber?: string;
  contactPerson?: string;
  email?: string;
  telephone?: string;
  paymentTermsDays: number;
  currency: string;
  totalInvoiced: number | null;
  totalPaid: number | null;
  currentBalance: number | null;
  source: SourceProvenance;
}

// 7. Cash & Bank
export interface BankTransactionRecord {
  id: string;
  companyId: string;
  projectId?: string;
  bankAccountId: string;
  accountName: string;
  date: string;
  transactionType: "Receipt" | "Payment" | "Transfer" | "Bank Charge" | "Interest";
  type?: string;
  reference: string;
  transactionRef?: string;
  externalRef?: string;
  payeeOrPayer: string;
  description?: string;
  inflow: number | null;
  outflow: number | null;
  amount?: number | null;
  balanceAfter: number | null;
  status: "Unreconciled" | "Reconciled" | "Pending" | "Voided";
  reconciled?: boolean;
  currency: string;
  linkedRecordType?: "Supplier Payment" | "Client Receipt" | "Direct Cost" | "Payroll" | "Commitment";
  linkedRecordRef?: string;
  matchedRecordRef?: string;
  documents?: CommercialSupportingDocument[];
  source: SourceProvenance;
  auditTrail?: CommercialAuditEntry[];
  notes?: string;
}

// Data Conflict Detection
export interface DataConflictRecord {
  id: string;
  fieldName: string;
  entityType: string;
  entityId: string;
  entityIdentifier: string;
  existingValue: any;
  existingSource: SourceProvenance;
  uploadedValue: any;
  uploadedSource: SourceProvenance;
  status: "PENDING_DECISION" | "RESOLVED_KEEP_EXISTING" | "RESOLVED_OVERWRITE";
  resolvedBy?: string;
  resolvedAt?: string;
  overrideReason?: string;
}

// Field Mapping for Uploads
export interface ImportFieldMapping {
  id: string;
  sourceField: string;
  sourceValue: any;
  projectMatrixField: string;
  status: "MAPPED" | "FLAGGED_REVIEW" | "DUPLICATE" | "CONFLICT" | "IGNORED";
  confidenceScore?: number;
  candidateFields: string[];
  conflictDetails?: DataConflictRecord;
}
