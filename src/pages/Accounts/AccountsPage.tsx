import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2,
  RefreshCw,
  Coins,
  CreditCard,
  FileText,
  Clock,
  PiggyBank,
  Scale,
  TrendingDown,
  BarChart3,
  Search,
  Plus,
  Download,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  Landmark,
  Calendar,
  ChevronRight,
  User,
  Users,
  FileCheck,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Settings,
  Shield,
  Activity,
  Archive,
  RotateCcw,
  Check,
  Ban,
  FileCheck2,
  FileX2,
  XCircle,
  Edit2,
  Layers
} from "lucide-react";
import { supabase, isApiKeyError } from "../../lib/supabase";
import { AccountDocumentUpload } from "../../components/accounts/AccountDocumentUpload";
import ProjectShell from "../../components/layout/ProjectShell";
import { exportObjectsToCsv, CsvColumn } from "../../utils/csvExport";
import {
  checkMigrationApplied,
  fetchBudgets,
  fetchBudgetLines,
  fetchCommitments,
  fetchCostPostings,
  fetchForecasts,
  fetchFinanceAuditLogs,
  createBudgetVersion,
  createCommitment,
  createCostPosting,
  createProjectForecast,
  submitBudgetVersion,
  approveBudgetVersion,
  rejectBudgetVersion,
  cancelBudgetVersion,
  submitFinancialCommitment,
  approveFinancialCommitment,
  rejectFinancialCommitment,
  closeFinancialCommitment,
  cancelFinancialCommitment,
  submitCostPosting,
  postCostPosting,
  rejectCostPosting,
  reverseCostPosting,
  submitProjectForecast,
  approveProjectForecast,
  rejectProjectForecast,
  archiveRecord,
  restoreRecord,
  BudgetVersion,
  BudgetLine,
  FinancialCommitment,
  FinancialCostPosting,
  ProjectFinancialForecast,
  FinanceAuditLog,
  fetchClientAccounts,
  fetchProjectClientContracts,
  fetchClientInvoices,
  fetchClientInvoiceLines,
  fetchClientCreditNotes,
  fetchClientCreditNoteLines,
  fetchClientReceipts,
  fetchClientReceiptAllocations,
  fetchClientAccountsAuditLogs,
  createClientAccount,
  createProjectClientContract,
  createClientInvoice,
  createClientInvoiceLine,
  createClientCreditNote,
  createClientCreditNoteLine,
  createClientReceipt,
  activateClientContract,
  closeClientContract,
  cancelClientContract,
  submitClientInvoice,
  approveClientInvoice,
  rejectClientInvoice,
  issueClientInvoice,
  cancelClientInvoice,
  submitClientCreditNote,
  approveClientCreditNote,
  rejectClientCreditNote,
  issueClientCreditNote,
  cancelClientCreditNote,
  postClientReceipt,
  reverseClientReceipt,
  cancelClientReceipt,
  allocateClientReceipt,
  reverseClientReceiptAllocation,
  ClientAccount,
  ProjectClientContract,
  ClientInvoice,
  ClientInvoiceLine,
  ClientCreditNote,
  ClientCreditNoteLine,
  ClientReceipt,
  ClientReceiptAllocation,
  ClientAccountsAuditLog
} from "../../services/accountsFinanceService";

import {
  cashbookService,
  BankAccount,
  CashbookTransaction,
  BankStatementImport,
  BankStatementLine,
  BankReconciliationSession,
  BankReconciliationMatch,
  CashbookAttachment,
  CashbookAuditLog
} from "../../services/cashbookService";

import {
  parseBankStatementFile,
  parseManualStatement,
  ParsedBankStatementLine
} from "../../utils/bankStatementParsers";

import {
  supplierAccountsService,
  SupplierAccount,
  SupplierInvoice,
  SupplierInvoiceLine,
  SupplierCreditNote,
  SupplierCreditNoteLine,
  SupplierPayment,
  SupplierPaymentAllocation,
  SupplierAccountsAuditLog,
  SupplierAttachment,
  SupplierPayablesAgeing
} from "../../services/supplierAccountsService";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

// Top Level Tabs Definition
type TopTab =
  | "overview"
  | "budgets"
  | "commitments"
  | "actuals"
  | "client"
  | "supplier"
  | "cash"
  | "reports"
  | "setup";

// Form Fields Configuration
interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "file";
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

function getFormFieldConfigs(currencyCode: string): Record<string, FieldConfig[]> {
  return {
    budget: [
      { name: "project", label: "Project", type: "select", options: ["All Company Projects"], required: true },
      { name: "version", label: "Version Label", type: "text", placeholder: "e.g., v1.0 Original Approved", required: true },
      { name: "effectiveDate", label: "Effective Date", type: "date", required: true },
      { name: "originalBudget", label: `Original Budget Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "approvedVariations", label: `Approved Variations Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00" },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Enter budget/revision notes..." },
      { name: "doc", label: "Supporting Document", type: "file" }
    ],
    forecast: [
      { name: "project", label: "Project", type: "select", options: ["All Company Projects"], required: true },
      { name: "version", label: "Version Label", type: "text", placeholder: "e.g., Q3 2026 Forecast", required: true },
      { name: "asOfDate", label: "As Of Date", type: "date", required: true },
      { name: "revenue", label: `Forecast Contract Revenue Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "etc", label: `Estimate to Complete Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Enter forecasting notes..." }
    ],
    commitment: [
      { name: "project", label: "Project", type: "select", options: ["All Company Projects"], required: true },
      { name: "type", label: "Commitment Type", type: "select", options: ["Purchase Order", "Subcontract", "Approved Variation", "Other Contractual Commitment"], required: true },
      { name: "ref", label: "Reference Number", type: "text", placeholder: "e.g., PO-2026-001", required: true },
      { name: "supplier", label: "Supplier or Subcontractor", type: "text", placeholder: "Enter supplier name...", required: true },
      { name: "description", label: "Description", type: "text", placeholder: "What is being procured...", required: true },
      { name: "amount", label: `Original Amount Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "variation", label: `Approved Variation Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00" },
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "Completion Date", type: "date" },
      { name: "procRef", label: "Procurement Reference", type: "text", placeholder: "e.g., PR-4501" },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Enter commitment terms or details..." },
      { name: "doc", label: "Supporting Document", type: "file" }
    ],
    actual: [
      { name: "project", label: "Project", type: "select", options: ["All Company Projects"], required: true },
      { name: "date", label: "Posting Date", type: "date", required: true },
      { name: "source", label: "Source", type: "select", options: ["Supplier Invoice", "Labour Payroll", "Direct Expense", "Overhead Allocation", "Adjustment"], required: true },
      { name: "ref", label: "Source Reference", type: "text", placeholder: "Invoice/Payroll run reference...", required: true },
      { name: "category", label: "Cost Category", type: "text", placeholder: "e.g., Concrete Supply, Site Supervision", required: true },
      { name: "description", label: "Description", type: "text", placeholder: "Detail of the posted cost...", required: true },
      { name: "amount", label: `Amount Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Internal tracking details..." },
      { name: "doc", label: "Supporting Document", type: "file" }
    ],
    client_claim: [
      { name: "project", label: "Project", type: "select", options: ["All Company Projects"], required: true },
      { name: "claimNum", label: "Claim Number", type: "text", placeholder: "e.g., CLM-005", required: true },
      { name: "date", label: "Submission Date", type: "date", required: true },
      { name: "amount", label: `Claimed Amount Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Include physical completion milestone references..." }
    ],
    client_cert: [
      { name: "project", label: "Project", type: "select", options: ["All Company Projects"], required: true },
      { name: "certNum", label: "Certificate Number", type: "text", placeholder: "e.g., CERT-005", required: true },
      { name: "date", label: "Certificate Date", type: "date", required: true },
      { name: "amount", label: `Certified Amount Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "variations", label: `Approved Variations Included Excluding VAT (${currencyCode})`, type: "number", placeholder: "0.00" },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Certifier comments..." }
    ],
    client_invoice: [
      { name: "project", label: "Project", type: "select", options: ["All Company Projects"], required: true },
      { name: "invNum", label: "Invoice Number", type: "text", placeholder: "e.g., INV-CLM-005", required: true },
      { name: "date", label: "Invoice Date", type: "date", required: true },
      { name: "dueDate", label: "Due Date", type: "date", required: true },
      { name: "amount", label: `Invoice Amount Including VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "vat", label: `VAT Included (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Client billing remarks..." }
    ],
    client_receipt: [
      { name: "client", label: "Client Name", type: "text", placeholder: "Client / Employer name...", required: true },
      { name: "ref", label: "Receipt Reference", type: "text", placeholder: "e.g., REC-10254", required: true },
      { name: "date", label: "Receipt Date", type: "date", required: true },
      { name: "amount", label: `Amount Including VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Bank reference details..." }
    ],
    supplier_account: [
      { name: "supplier_code", label: "Supplier Code", type: "text", placeholder: "e.g., SUP-1001", required: true },
      { name: "legal_name", label: "Legal Name", type: "text", placeholder: "e.g., BuildMax Civils Ltd", required: true },
      { name: "trading_name", label: "Trading Name", type: "text", placeholder: "e.g., BuildMax" },
      { name: "registration_number", label: "Company Reg Number", type: "text", placeholder: "e.g., 2020/123456/07" },
      { name: "vat_number", label: "VAT Reg Number", type: "text", placeholder: "e.g., 4910293847" },
      { name: "contact_person", label: "Primary Contact Person", type: "text", placeholder: "Full Name" },
      { name: "email", label: "Email Address", type: "text", placeholder: "supplier@example.com" },
      { name: "telephone", label: "Telephone Number", type: "text", placeholder: "+27 11 000 0000" },
      { name: "payment_terms_days", label: "Payment Terms (Days)", type: "number", placeholder: "30" },
      { name: "bank_name", label: "Bank Name", type: "text", placeholder: "e.g. Standard Bank" },
      { name: "branch_code", label: "Branch Code", type: "text", placeholder: "e.g. 051001" },
      { name: "account_number", label: "Account Number", type: "text", placeholder: "e.g. 10123456789" },
      { name: "physical_address", label: "Physical Address", type: "textarea", placeholder: "Business street address..." },
      { name: "notes", label: "Notes", type: "textarea" }
    ],
    supplier_invoice: [
      { name: "supplier_account_id", label: "Supplier / Vendor", type: "select", required: true },
      { name: "project_id", label: "Project", type: "select", required: true },
      { name: "financial_commitment_id", label: "Financial Commitment / PO", type: "select", required: true },
      { name: "supplier_invoice_number", label: "Invoice Number", type: "text", placeholder: "Supplier's invoice reference", required: true },
      { name: "external_reference", label: "External Reference", type: "text", placeholder: "e.g., Delivery Note #" },
      { name: "invoice_date", label: "Invoice Date", type: "date", required: true },
      { name: "due_date", label: "Due Date", type: "date", required: true },
      { name: "billing_period_start", label: "Billing Period Start", type: "date" },
      { name: "billing_period_end", label: "Billing Period End", type: "date" },
      { name: "quantity", label: "Quantity", type: "number", placeholder: "1.00", required: true },
      { name: "unit", label: "Unit of Measure", type: "text", placeholder: "SUM / HRS / M2 / EA", required: true },
      { name: "unit_rate_excl_vat", label: `Unit Rate Excl. VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "vat_rate", label: "VAT Rate (%)", type: "number", placeholder: "15.00", required: true },
      { name: "cost_category", label: "Cost Category", type: "text", placeholder: "Subcontractor / Materials / Equipment" },
      { name: "description", label: "Description", type: "text", placeholder: "Valuation sheet or goods rendered...", required: true },
      { name: "notes", label: "Notes", type: "textarea" }
    ],
    supplier_credit: [
      { name: "supplier_account_id", label: "Supplier / Vendor", type: "select", required: true },
      { name: "project_id", label: "Project", type: "select", required: true },
      { name: "invoice_id", label: "Related Supplier Invoice", type: "select", required: true },
      { name: "credit_note_number", label: "Credit Note Number", type: "text", placeholder: "e.g., SCN-9001", required: true },
      { name: "external_reference", label: "External Ref", type: "text", placeholder: "Vendor credit ref..." },
      { name: "credit_note_date", label: "Credit Note Date", type: "date", required: true },
      { name: "reason", label: "Reason for Credit Note", type: "text", placeholder: "e.g. Returned damaged items", required: true },
      { name: "quantity", label: "Quantity", type: "number", placeholder: "1.00", required: true },
      { name: "unit_rate_excl_vat", label: `Amount Excl. VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "vat_rate", label: "VAT Rate (%)", type: "number", placeholder: "15.00", required: true },
      { name: "description", label: "Description", type: "text", placeholder: "Credit adjustment description..." },
      { name: "notes", label: "Notes", type: "textarea" }
    ],
    supplier_payment: [
      { name: "supplier_account_id", label: "Supplier / Vendor", type: "select", required: true },
      { name: "project_id", label: "Project", type: "select", required: true },
      { name: "bank_account_id", label: "Source Bank Account", type: "select", required: true },
      { name: "payment_reference", label: "Payment Reference", type: "text", placeholder: "e.g., SPAY-2026-101", required: true },
      { name: "external_reference", label: "External / Bank Ref", type: "text", placeholder: "e.g. Bank EFT #" },
      { name: "payment_date", label: "Payment Date", type: "date", required: true },
      { name: "payment_method", label: "Payment Method", type: "select", options: ["EFT", "Direct Debit", "Cheque", "Credit Card", "Cash", "Other"], required: true },
      { name: "amount_paid", label: `Amount Paid (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "notes", label: "Notes", type: "textarea" }
    ],
    supplier_allocation: [
      { name: "supplier_payment_id", label: "Unallocated Payment", type: "select", required: true },
      { name: "supplier_invoice_id", label: "Target Invoice", type: "select", required: true },
      { name: "amount_allocated", label: `Amount to Allocate (${currencyCode})`, type: "number", placeholder: "0.00", required: true }
    ],
    supplier_attachment: [
      { name: "entity_type", label: "Attach To", type: "select", options: ["supplier_account", "supplier_invoice", "supplier_credit_note", "supplier_payment"], required: true },
      { name: "entity_id", label: "Target Record ID", type: "text", placeholder: "Paste UUID or reference ID", required: true },
      { name: "document_category", label: "Document Category", type: "select", options: ["Invoice", "Tax Certificate", "Delivery Note", "Proof of Payment", "Contract", "Other"], required: true },
      { name: "file_name", label: "File Name", type: "text", placeholder: "e.g., Tax_Cert_2026.pdf", required: true },
      { name: "file_path", label: "File Path / URL", type: "text", placeholder: "e.g., /docs/suppliers/Tax_Cert_2026.pdf", required: true }
    ],
    bank_account: [
      { name: "account_name", label: "Account Name", type: "text", placeholder: `e.g., ${currencyCode} Primary Operational Acc`, required: true },
      { name: "bank_name", label: "Financial Institution", type: "text", placeholder: "e.g., Standard Bank, FNB", required: true },
      { name: "account_type", label: "Account Type", type: "select", options: ["Bank", "Petty Cash", "Credit Card", "Investment", "Other"], required: true },
      { name: "account_number", label: "Account Number", type: "text", placeholder: "e.g., 6281920381", required: true },
      { name: "branch_code", label: "Branch Code", type: "text", placeholder: "e.g., 250655" },
      { name: "opening_balance", label: `Opening Balance (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "opening_balance_date", label: "Opening Balance Date", type: "date", required: true }
    ],
    cash_movement: [
      { name: "bank_account_id", label: "Bank Account", type: "select", options: [], required: true },
      { name: "transaction_type", label: "Transaction Type", type: "select", options: ["Receipt", "Payment", "Transfer In", "Transfer Out"], required: true },
      { name: "transaction_date", label: "Transaction Date", type: "date", required: true },
      { name: "payee_payer_name", label: "Payee / Payer", type: "text", placeholder: "e.g., BuildMax Suppliers Ltd", required: true },
      { name: "description", label: "Description", type: "text", placeholder: "e.g., Site materials delivery batch #4", required: true },
      { name: "project_id", label: "Project Allocation", type: "select", options: [] },
      { name: "reference_number", label: "Reference Number", type: "text", placeholder: "Auto-generated if left blank" },
      { name: "external_reference", label: "External Reference", type: "text", placeholder: "e.g., Cheque / EFT #" },
      { name: "amount", label: `Amount Incl. VAT (${currencyCode})`, type: "number", placeholder: "0.00", required: true },
      { name: "vat_amount", label: `VAT Amount (${currencyCode})`, type: "number", placeholder: "0.00" },
      { name: "payment_method", label: "Payment Method", type: "select", options: ["EFT", "Cheque", "Credit Card", "Cash", "Direct Debit", "Other"], required: true }
    ],
    bank_statement_import: [
      { name: "bank_account_id", label: "Bank Account", type: "select", options: [], required: true },
      { name: "filename", label: "Statement Reference / Filename", type: "text", placeholder: "e.g., FNB_Stmt_202607.csv", required: true },
      { name: "file_format", label: "File Format", type: "select", options: ["CSV", "OFX", "QBO", "MT940", "Manual"], required: true },
      { name: "statement_file", label: "Upload Statement File (.csv, .ofx, .qbo, .txt)", type: "file" },
      { name: "file_content", label: "Or Paste Statement Raw Content", type: "textarea", placeholder: "Paste raw CSV, OFX, QBO, or MT940 content here..." },
      { name: "amount", label: `Closing Balance / Amount (${currencyCode})`, type: "number", placeholder: "0.00" },
      { name: "transaction_date", label: "Transaction Date (Manual Entry)", type: "date" },
      { name: "description", label: "Description (Manual Entry)", type: "text", placeholder: "e.g., Manual statement line adjustment" }
    ],
    reconciliation_session: [
      { name: "bank_account_id", label: "Bank Account", type: "select", options: [], required: true },
      { name: "statement_end_date", label: "Statement End Date", type: "date", required: true },
      { name: "statement_ending_balance", label: `Statement Ending Balance (${currencyCode})`, type: "number", placeholder: "0.00", required: true }
    ]
  };
}

const modalTitles: Record<string, { title: string; desc: string }> = {
  budget: { title: "Create Budget Version", desc: "Define a brand-new project budget baselining structure." },
  forecast: { title: "Create Financial Forecast", desc: "Define project revenue and estimate to complete projections." },
  commitment: { title: "Add Commitment", desc: "Commit project funds to a subcontractor or vendor contract." },
  actual: { title: "Record Actual Cost", desc: "Post a financial transaction ledger line of incurred expenditure." },
  client_claim: { title: "Create Client Claim", desc: "Log a formal work-valuation claim to the client/employer." },
  client_cert: { title: "Create Payment Certificate", desc: "Log a certified valuation certificate issued by the engineer." },
  client_invoice: { title: "Create Client Invoice", desc: "Generate the formal tax invoice based on approved certificates." },
  client_receipt: { title: "Record Client Receipt", desc: "Log a clearance receipt of cash paid into bank by the client." },
  supplier_account: { title: "Add Supplier Account", desc: "Register a vendor or subcontractor in the company supplier directory." },
  supplier_invoice: { title: "Add Supplier Invoice", desc: "Capture subcontract pay-valuation sheets or vendor material delivery invoices." },
  supplier_credit: { title: "Add Supplier Credit Note", desc: "Record credit notes to balance or correct vendor liabilities." },
  supplier_payment: { title: "Record Supplier Payment", desc: "Log a bank-processed cash payout reconciling a supplier invoice." },
  supplier_allocation: { title: "Allocate Supplier Payment", desc: "Allocate an unallocated supplier payment to an outstanding invoice." },
  supplier_attachment: { title: "Upload Supporting Document", desc: "Attach tax certificates, delivery notes, or proof of payments to supplier records." },
  bank_account: { title: "Add Bank Account", desc: "Initialize a primary company ledger bank or cashbook account." },
  cash_movement: { title: "Record Cash Movement", desc: "Log immediate cashbook bank entries directly matching statements." },
  bank_statement_import: { title: "Import Bank Statement", desc: "Upload CSV or OFX bank statement lines for automated reconciliation." },
  reconciliation_session: { title: "Start Bank Reconciliation", desc: "Initialize a bank reconciliation session for a statement period." }
};

export default function AccountsPage() {
  const { currencyCode, currencySymbol, formatCurrency, formatCompactCurrency } = useRegionalSettings();
  const formFieldConfigs = getFormFieldConfigs(currencyCode);
  const context = useOutletContext<any>() || {};
  const { 
    profile, 
    activeCompany, 
    activeProject,
    allProjects = [],
    setSuccessMsg,
    setErrorMsg,
    companyPersonnel = []
  } = context;

  // Active role / designation
  const activeMember = companyPersonnel.find((p: any) => p.profile_id === profile?.id);
  const userRole = activeMember?.designation || profile?.role;

  const [activeTab, setActiveTab] = useState<TopTab>("overview");

  // Secondary/Nested Tabs State
  const [clientSubTab, setClientSubTab] = useState<"contracts" | "invoices" | "receipts">("contracts");
  const [supplierSubTab, setSupplierSubTab] = useState<"directory" | "invoices" | "credit_notes" | "payments" | "ageing" | "audit">("directory");
  const [cashSubTab, setCashSubTab] = useState<"accounts" | "cashbook" | "reconciliation">("accounts");
  const [reportSubTab, setReportSubTab] = useState<"reports" | "audit" | "documents">("reports");

  // Supplier Accounts persistence state
  const [supplierAccounts, setSupplierAccounts] = useState<SupplierAccount[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [supplierCreditNotes, setSupplierCreditNotes] = useState<SupplierCreditNote[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [supplierPaymentAllocations, setSupplierPaymentAllocations] = useState<SupplierPaymentAllocation[]>([]);
  const [supplierAuditLogs, setSupplierAuditLogs] = useState<SupplierAccountsAuditLog[]>([]);
  const [supplierAttachments, setSupplierAttachments] = useState<SupplierAttachment[]>([]);
  const [supplierAgeing, setSupplierAgeing] = useState<SupplierPayablesAgeing[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [editingSupplierAccount, setEditingSupplierAccount] = useState<SupplierAccount | null>(null);
  const [supplierActionPrompt, setSupplierActionPrompt] = useState<{
    type: 'deactivate_supplier' | 'reject_invoice' | 'cancel_invoice' | 'reject_credit' | 'cancel_credit' | 'reject_payment' | 'cancel_payment' | 'reverse_payment';
    id: string;
    version: number;
    title: string;
  } | null>(null);
  const [actionReasonInput, setActionReasonInput] = useState<string>("");
  
  // Budgets sub-tab toggle (to view either budget versions or financial forecasts!)
  const [budgetSubTab, setBudgetSubTab] = useState<"budgets" | "forecasts">("budgets");

  // Filtering / Registry Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [selectedStatementFile, setSelectedStatementFile] = useState<File | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  // General Notification Area
  const [pageNotifications, setPageNotifications] = useState<string[]>([]);

  // Database persistence state
  const [isMigrationMissing, setIsMigrationMissing] = useState(false);
  const [isCheckingMigration, setIsCheckingMigration] = useState(true);
  const [budgets, setBudgets] = useState<BudgetVersion[]>([]);
  const [commitments, setCommitments] = useState<FinancialCommitment[]>([]);
  const [actualCosts, setActualCosts] = useState<FinancialCostPosting[]>([]);
  const [forecasts, setForecasts] = useState<ProjectFinancialForecast[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinanceAuditLog[]>([]);
  
  // Client Accounts persistence state
  const [clientAccounts, setClientAccounts] = useState<ClientAccount[]>([]);
  const [contracts, setContracts] = useState<ProjectClientContract[]>([]);
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([]);
  const [clientCreditNotes, setClientCreditNotes] = useState<ClientCreditNote[]>([]);
  const [clientReceipts, setClientReceipts] = useState<ClientReceipt[]>([]);
  const [clientReceiptAllocations, setClientReceiptAllocations] = useState<ClientReceiptAllocation[]>([]);
  const [clientAccountsAuditLogs, setClientAccountsAuditLogs] = useState<ClientAccountsAuditLog[]>([]);

  // Cashbook persistence state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashbookTransactions, setCashbookTransactions] = useState<CashbookTransaction[]>([]);
  const [statementImports, setStatementImports] = useState<BankStatementImport[]>([]);
  const [statementLines, setStatementLines] = useState<BankStatementLine[]>([]);
  const [reconciliationSessions, setReconciliationSessions] = useState<BankReconciliationSession[]>([]);
  const [reconciliationMatches, setReconciliationMatches] = useState<BankReconciliationMatch[]>([]);
  const [cashbookAuditLogs, setCashbookAuditLogs] = useState<CashbookAuditLog[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [selectedReconciliationSessionId, setSelectedReconciliationSessionId] = useState<string>("");
  const [selectedMatchTxId, setSelectedMatchTxId] = useState<string>("");
  const [selectedMatchLineId, setSelectedMatchLineId] = useState<string>("");

  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load all finance database data
  const loadAllFinanceData = async () => {
    if (!activeCompany?.id) return;
    setIsLoadingData(true);
    try {
      const applied = await checkMigrationApplied(activeCompany.id);
      if (!applied) {
        setIsMigrationMissing(true);
        setIsCheckingMigration(false);
        setIsLoadingData(false);
        return;
      }
      setIsMigrationMissing(false);
      setIsCheckingMigration(false);

      const [
        b, c, a, f, l,
        ca, pcc, ci, ccn, cr, cra, cal,
        ba, cbt, bsi, bsl, brs, brm, cbal,
        sa, si, scn, sp, spa, sal, sat, saga
      ] = await Promise.all([
        fetchBudgets(activeCompany.id),
        fetchCommitments(activeCompany.id),
        fetchCostPostings(activeCompany.id),
        fetchForecasts(activeCompany.id),
        fetchFinanceAuditLogs(activeCompany.id),
        fetchClientAccounts(activeCompany.id),
        fetchProjectClientContracts(activeCompany.id),
        fetchClientInvoices(activeCompany.id),
        fetchClientCreditNotes(activeCompany.id),
        fetchClientReceipts(activeCompany.id),
        fetchClientReceiptAllocations(activeCompany.id),
        fetchClientAccountsAuditLogs(activeCompany.id),
        cashbookService.getBankAccounts(activeCompany.id, true),
        cashbookService.getTransactions(activeCompany.id, { includeArchived: true }),
        cashbookService.getStatementImports(activeCompany.id),
        cashbookService.getStatementLines(activeCompany.id),
        cashbookService.getReconciliationSessions(activeCompany.id),
        cashbookService.getReconciliationMatches(activeCompany.id),
        cashbookService.getAuditLogs(activeCompany.id),
        supplierAccountsService.getSupplierAccounts(activeCompany.id, true),
        supplierAccountsService.getSupplierInvoices(activeCompany.id, { includeArchived: true }),
        supplierAccountsService.getSupplierCreditNotes(activeCompany.id, { includeArchived: true }),
        supplierAccountsService.getSupplierPayments(activeCompany.id, { includeArchived: true }),
        supplierAccountsService.getSupplierPaymentAllocations(activeCompany.id),
        supplierAccountsService.getSupplierAuditLogs(activeCompany.id),
        supplierAccountsService.getSupplierAttachments(activeCompany.id),
        supplierAccountsService.getSupplierPayablesAgeing(activeCompany.id)
      ]);

      setBudgets(b);
      setCommitments(c);
      setActualCosts(a);
      setForecasts(f);
      setAuditLogs(l);
      setClientAccounts(ca);
      setContracts(pcc);
      setClientInvoices(ci);
      setClientCreditNotes(ccn);
      setClientReceipts(cr);
      setClientReceiptAllocations(cra);
      setClientAccountsAuditLogs(cal);
      setBankAccounts(ba);
      setCashbookTransactions(cbt);
      setStatementImports(bsi);
      setStatementLines(bsl);
      setReconciliationSessions(brs);
      setReconciliationMatches(brm);
      setCashbookAuditLogs(cbal);
      setSupplierAccounts(sa);
      setSupplierInvoices(si);
      setSupplierCreditNotes(scn);
      setSupplierPayments(sp);
      setSupplierPaymentAllocations(spa);
      setSupplierAuditLogs(sal);
      setSupplierAttachments(sat);
      setSupplierAgeing(saga);

      if (ba.length > 0 && !selectedBankAccountId) {
        const activeAcc = ba.find((acc) => !acc.is_archived && acc.is_active) || ba[0];
        setSelectedBankAccountId(activeAcc.id);
      }
      if (brs.length > 0 && !selectedReconciliationSessionId) {
        const inProgressSession = brs.find((s) => s.status === 'In Progress') || brs[0];
        setSelectedReconciliationSessionId(inProgressSession.id);
      }
    } catch (err: any) {
      if (!isApiKeyError(err)) {
        console.error("Error loading financial data:", err);
        setErrorMsg?.("Failed to retrieve operational accounts: " + err.message);
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllFinanceData();
  }, [activeCompany?.id]);

  // ESC key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModal]);

  const handleCloseModal = () => {
    setActiveModal(null);
    setSubmitNotice(null);
  };

  const handleOpenModal = (modalType: string) => {
    setFormValues({});
    setSubmitNotice(null);
    setActiveModal(modalType);
  };

  const handleFormChange = (fieldName: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany?.id) return;

    setIsLoadingData(true);
    setSubmitNotice(null);
    try {
      if (activeModal === "budget") {
        if (!formValues.project) throw new Error("Project selection is required.");
        await createBudgetVersion({
          company_id: activeCompany.id,
          project_id: formValues.project,
          version_label: formValues.version,
          effective_date: formValues.effectiveDate,
          original_budget_excl_vat: parseFloat(formValues.originalBudget || "0"),
          approved_variations_excl_vat: parseFloat(formValues.approvedVariations || "0"),
          notes: formValues.notes,
        });
        setSuccessMsg?.("Budget version created as Draft.");
      } else if (activeModal === "forecast") {
        if (!formValues.project) throw new Error("Project selection is required.");
        await createProjectForecast({
          company_id: activeCompany.id,
          project_id: formValues.project,
          version_label: formValues.version,
          as_of_date: formValues.asOfDate,
          forecast_contract_revenue_excl_vat: parseFloat(formValues.revenue || "0"),
          uncommitted_estimate_to_complete_excl_vat: parseFloat(formValues.etc || "0"),
          notes: formValues.notes,
        });
        setSuccessMsg?.("Financial forecast created as Draft.");
      } else if (activeModal === "commitment") {
        if (!formValues.project) throw new Error("Project selection is required.");
        await createCommitment({
          company_id: activeCompany.id,
          project_id: formValues.project,
          commitment_reference: formValues.ref,
          commitment_type: formValues.type,
          counterparty_name: formValues.supplier,
          description: formValues.description,
          original_amount_excl_vat: parseFloat(formValues.amount || "0"),
          approved_variations_excl_vat: parseFloat(formValues.variation || "0"),
          start_date: formValues.startDate,
          completion_date: formValues.endDate,
          notes: formValues.notes,
        });
        setSuccessMsg?.("Financial commitment created as Draft.");
      } else if (activeModal === "actual") {
        if (!formValues.project) throw new Error("Project selection is required.");
        await createCostPosting({
          company_id: activeCompany.id,
          project_id: formValues.project,
          posting_reference: formValues.ref,
          posting_date: formValues.date,
          source_type: formValues.source,
          cost_category: formValues.category,
          description: formValues.description,
          entry_type: "Cost",
          amount_excl_vat: parseFloat(formValues.amount || "0"),
          notes: formValues.notes,
        });
        setSuccessMsg?.("Cost posting recorded as Draft.");
      } else if (activeModal === "client_account") {
        if (!formValues.account_name || !formValues.account_code) throw new Error("Client Name and Account Code are required.");
        await createClientAccount({
          company_id: activeCompany.id,
          account_name: formValues.account_name,
          account_code: formValues.account_code,
          contact_person: formValues.contact_person || null,
          email: formValues.email || null,
          phone: formValues.phone || null,
          vat_registration_number: formValues.tax_number || null,
          payment_terms_days: formValues.payment_terms_days ? parseInt(formValues.payment_terms_days) : 30,
          notes: formValues.notes || null
        });
        setSuccessMsg?.("Client account created successfully.");
      } else if (activeModal === "client_contract") {
        if (!formValues.client_account_id || !formValues.project_id || !formValues.contract_reference) {
          throw new Error("Client Account, Project, and Contract Reference are required.");
        }
        await createProjectClientContract({
          company_id: activeCompany.id,
          project_id: formValues.project_id,
          client_account_id: formValues.client_account_id,
          contract_reference: formValues.contract_reference,
          agreed_contract_value_excl_vat: parseFloat(formValues.contract_value_excl_vat || "0"),
          commencement_date: formValues.start_date || null,
          target_completion_date: formValues.completion_date || null,
          scope_description: formValues.description || null,
          notes: formValues.notes || null
        });
        setSuccessMsg?.("Project client contract created as Draft.");
      } else if (activeModal === "client_invoice") {
        if (!formValues.client_account_id || !formValues.project_id || !formValues.invoice_reference || !formValues.invoice_date || !formValues.due_date) {
          throw new Error("Client Account, Project, Invoice Reference, Invoice Date and Due Date are required.");
        }
        const qty = parseFloat(formValues.quantity || "1");
        const rate = parseFloat(formValues.unit_rate_excl_vat || "0");
        const vatPct = parseFloat(formValues.vat_rate || "15");
        const amtExcl = qty * rate;
        const vatAmt = amtExcl * (vatPct / 100);
        const amtIncl = amtExcl + vatAmt;

        const inv = await createClientInvoice({
          company_id: activeCompany.id,
          project_id: formValues.project_id,
          client_account_id: formValues.client_account_id,
          contract_id: formValues.contract_id || undefined,
          invoice_reference: formValues.invoice_reference,
          invoice_date: formValues.invoice_date,
          due_date: formValues.due_date,
          tax_point_date: formValues.tax_point_date || formValues.invoice_date,
          notes: formValues.notes || undefined
        });

        await createClientInvoiceLine({
          company_id: activeCompany.id,
          project_id: formValues.project_id,
          invoice_id: inv.id,
          description: formValues.description || "Services Rendered",
          quantity: qty,
          unit: formValues.unit || "SUM",
          unit_rate_excl_vat: rate,
          vat_rate: vatPct,
          amount_excl_vat: amtExcl,
          vat_amount: vatAmt,
          amount_incl_vat: amtIncl,
          sort_order: 1
        });
        setSuccessMsg?.("Client invoice created as Draft.");
      } else if (activeModal === "client_credit_note") {
        if (!formValues.invoice_id || !formValues.credit_note_reference || !formValues.credit_note_date || !formValues.reason) {
          throw new Error("Target Invoice, Credit Note Reference, Credit Note Date, and Reason are required.");
        }
        const targetInv = clientInvoices.find(i => i.id === formValues.invoice_id);
        if (!targetInv) throw new Error("Please select a valid target invoice.");

        const qty = parseFloat(formValues.quantity || "1");
        const rate = parseFloat(formValues.unit_rate_excl_vat || "0");
        const vatPct = parseFloat(formValues.vat_rate || "15");
        const amtExcl = qty * rate;
        const vatAmt = amtExcl * (vatPct / 100);
        const amtIncl = amtExcl + vatAmt;

        const cn = await createClientCreditNote({
          company_id: activeCompany.id,
          project_id: targetInv.project_id,
          client_account_id: targetInv.client_account_id,
          contract_id: targetInv.contract_id || undefined,
          invoice_id: targetInv.id,
          credit_note_reference: formValues.credit_note_reference,
          credit_note_date: formValues.credit_note_date,
          tax_point_date: formValues.tax_point_date || formValues.credit_note_date,
          reason_description: formValues.reason,
          notes: formValues.notes || undefined
        });

        await createClientCreditNoteLine({
          company_id: activeCompany.id,
          project_id: targetInv.project_id,
          credit_note_id: cn.id,
          description: formValues.description || "Credit Adjustment",
          quantity: qty,
          unit: "SUM",
          unit_rate_excl_vat: rate,
          vat_rate: vatPct,
          amount_excl_vat: amtExcl,
          vat_amount: vatAmt,
          amount_incl_vat: amtIncl,
          sort_order: 1
        });
        setSuccessMsg?.("Client credit note created as Draft.");
      } else if (activeModal === "client_receipt") {
        if (!formValues.client_account_id || !formValues.receipt_reference || !formValues.receipt_date || !formValues.amount_received) {
          throw new Error("Client Account, Receipt Reference, Receipt Date, and Amount Received are required.");
        }
        await createClientReceipt({
          company_id: activeCompany.id,
          client_account_id: formValues.client_account_id,
          project_id: formValues.project_id || undefined,
          receipt_reference: formValues.receipt_reference,
          receipt_date: formValues.receipt_date,
          payment_method: formValues.payment_method || "EFT",
          amount_received: parseFloat(formValues.amount_received || "0"),
          bank_reference: formValues.bank_reference || undefined,
          notes: formValues.notes || undefined
        });
        setSuccessMsg?.("Client receipt recorded as Draft.");
      } else if (activeModal === "receipt_allocation") {
        if (!formValues.receipt_id || !formValues.invoice_id || !formValues.amount_allocated) {
          throw new Error("Receipt, Invoice, and Amount Allocated are required.");
        }
        await allocateClientReceipt(
          formValues.receipt_id,
          formValues.invoice_id,
          parseFloat(formValues.amount_allocated || "0"),
          formValues.notes
        );
        setSuccessMsg?.("Receipt allocated to invoice successfully.");
      } else if (activeModal === "bank_account") {
        if (!formValues.account_name || !formValues.bank_name || !formValues.opening_balance) {
          throw new Error("Account Name, Financial Institution, and Opening Balance are required.");
        }
        await cashbookService.createBankAccount({
          company_id: activeCompany.id,
          account_name: formValues.account_name,
          bank_name: formValues.bank_name,
          account_type: formValues.account_type || "Bank",
          account_number: formValues.account_number || null,
          branch_code: formValues.branch_code || null,
          opening_balance: parseFloat(formValues.opening_balance || "0"),
          opening_balance_date: formValues.opening_balance_date || getSASTTodayString(),
          is_active: true
        });
        setSuccessMsg?.("Bank account created successfully.");
      } else if (activeModal === "cash_movement") {
        const bAccountId = formValues.bank_account_id || selectedBankAccountId;
        if (!bAccountId) throw new Error("Bank Account selection is required.");
        if (!formValues.amount) throw new Error("Amount is required.");

        await cashbookService.createTransaction({
          company_id: activeCompany.id,
          bank_account_id: bAccountId,
          project_id: formValues.project_id || null,
          transaction_type: formValues.transaction_type || "Payment",
          transaction_date: formValues.transaction_date || getSASTTodayString(),
          reference_number: formValues.reference_number || "",
          external_reference: formValues.external_reference || null,
          payee_payer_name: formValues.payee_payer_name || null,
          description: formValues.description || "Cash Movement",
          amount: parseFloat(formValues.amount || "0"),
          vat_amount: parseFloat(formValues.vat_amount || "0"),
          payment_method: formValues.payment_method || "EFT",
          status: "Draft"
        });
        setSuccessMsg?.("Cashbook transaction recorded as Draft.");
      } else if (activeModal === "bank_statement_import") {
        const bAccountId = formValues.bank_account_id || selectedBankAccountId;
        if (!bAccountId) throw new Error("Bank Account selection is required.");
        if (!formValues.filename) throw new Error("Statement Reference / Filename is required.");

        const format = (formValues.file_format || "CSV") as 'CSV' | 'OFX' | 'QBO' | 'MT940' | 'PDF' | 'Manual';

        if (format === "PDF" || formValues.filename.toLowerCase().endsWith(".pdf")) {
          throw new Error("PDF files cannot be automatically parsed into structured statement lines. Please upload CSV, OFX, QBO, or MT940 files, or enter transactions manually. PDF statements may be attached as supporting documents.");
        }

        let parsedLines: ParsedBankStatementLine[] = [];

        if (format === "Manual") {
          parsedLines = parseManualStatement({
            transaction_date: formValues.transaction_date || getSASTTodayString(),
            bank_reference: formValues.filename,
            description: formValues.description || formValues.filename || "Manual Statement Line",
            amount: parseFloat(formValues.amount || "0")
          });
        } else {
          if (!formValues.file_content && !selectedStatementFile) {
            throw new Error(`Statement file content or uploaded file is required for ${format} parsing. Please attach a file or paste raw statement text.`);
          }

          parsedLines = await parseBankStatementFile(
            selectedStatementFile || formValues.file_content,
            format
          );
        }

        if (parsedLines.length === 0) {
          throw new Error("No valid transaction lines found in statement file.");
        }

        const closingBal = parsedLines[parsedLines.length - 1]?.balance_after ?? parseFloat(formValues.amount || "0");

        const { insertedLines } = await cashbookService.createStatementImportWithLines(
          {
            company_id: activeCompany.id,
            bank_account_id: bAccountId,
            statement_identifier: `IMP-${Date.now().toString().slice(-6)}`,
            filename: formValues.filename,
            file_format: format as any,
            closing_balance: closingBal,
            total_lines_imported: parsedLines.length,
            status: 'Completed'
          },
          parsedLines
        );

        // Refresh live statement-import and statement-line state
        const [freshImports, freshLines] = await Promise.all([
          cashbookService.getStatementImports(activeCompany.id, bAccountId),
          cashbookService.getStatementLines(activeCompany.id, { bankAccountId: bAccountId })
        ]);
        setStatementImports(freshImports);
        setStatementLines(freshLines);

        setSelectedStatementFile(null);
        setSuccessMsg?.(`Bank statement imported successfully with ${insertedLines.length} line(s).`);
      } else if (activeModal === "supplier_account") {
        if (!formValues.supplier_code || !formValues.legal_name) {
          throw new Error("Supplier Code and Legal Name are required.");
        }
        if (editingSupplierAccount) {
          await supplierAccountsService.updateSupplierAccount(editingSupplierAccount.id, {
            supplier_code: formValues.supplier_code,
            legal_name: formValues.legal_name,
            trading_name: formValues.trading_name || null,
            registration_number: formValues.registration_number || null,
            vat_number: formValues.vat_number || null,
            contact_person: formValues.contact_person || null,
            email: formValues.email || null,
            telephone: formValues.telephone || null,
            physical_address: formValues.physical_address || null,
            payment_terms_days: formValues.payment_terms_days ? parseInt(formValues.payment_terms_days) : 30,
            bank_details: {
              bank_name: formValues.bank_name || undefined,
              branch_code: formValues.branch_code || undefined,
              account_number: formValues.account_number || undefined,
            },
            notes: formValues.notes || null
          });
          setEditingSupplierAccount(null);
          setSuccessMsg?.("Supplier account updated successfully.");
        } else {
          await supplierAccountsService.createSupplierAccount({
            company_id: activeCompany.id,
            supplier_code: formValues.supplier_code,
            legal_name: formValues.legal_name,
            trading_name: formValues.trading_name || null,
            registration_number: formValues.registration_number || null,
            vat_number: formValues.vat_number || null,
            contact_person: formValues.contact_person || null,
            email: formValues.email || null,
            telephone: formValues.telephone || null,
            physical_address: formValues.physical_address || null,
            payment_terms_days: formValues.payment_terms_days ? parseInt(formValues.payment_terms_days) : 30,
            bank_details: {
              bank_name: formValues.bank_name || undefined,
              branch_code: formValues.branch_code || undefined,
              account_number: formValues.account_number || undefined,
            },
            notes: formValues.notes || null
          });
          setSuccessMsg?.("Supplier account created successfully.");
        }
      } else if (activeModal === "supplier_invoice") {
        if (!formValues.supplier_account_id || !formValues.project_id || !formValues.financial_commitment_id || !formValues.supplier_invoice_number || !formValues.invoice_date || !formValues.due_date) {
          throw new Error("Supplier, Project, Commitment, Invoice Number, Invoice Date, and Due Date are required.");
        }
        const qty = parseFloat(formValues.quantity || "1");
        const rate = parseFloat(formValues.unit_rate_excl_vat || "0");
        const vatPct = parseFloat(formValues.vat_rate || "15");

        await supplierAccountsService.createSupplierInvoiceWithLines(
          {
            company_id: activeCompany.id,
            project_id: formValues.project_id,
            supplier_account_id: formValues.supplier_account_id,
            financial_commitment_id: formValues.financial_commitment_id,
            supplier_invoice_number: formValues.supplier_invoice_number,
            external_reference: formValues.external_reference || undefined,
            invoice_date: formValues.invoice_date,
            due_date: formValues.due_date,
            billing_period_start: formValues.billing_period_start || undefined,
            billing_period_end: formValues.billing_period_end || undefined,
            notes: formValues.notes || undefined
          },
          [
            {
              line_code: "LN-1",
              description: formValues.description || "Goods / Services Rendered",
              quantity: qty,
              unit: formValues.unit || "SUM",
              unit_rate_excl_vat: rate,
              vat_rate: vatPct,
              cost_category: formValues.cost_category || "Supplier Cost",
              sort_order: 1
            }
          ]
        );
        setSuccessMsg?.("Supplier invoice captured as Draft.");
      } else if (activeModal === "supplier_credit") {
        if (!formValues.supplier_account_id || !formValues.project_id || !formValues.invoice_id || !formValues.credit_note_number || !formValues.credit_note_date || !formValues.reason) {
          throw new Error("Supplier, Project, Invoice, Credit Note Number, Credit Note Date, and Reason are required.");
        }
        const targetInv = supplierInvoices.find(i => i.id === formValues.invoice_id);
        const commitmentId = targetInv?.financial_commitment_id || commitments[0]?.id;

        if (!commitmentId) throw new Error("A valid financial commitment is required.");

        const qty = parseFloat(formValues.quantity || "1");
        const rate = parseFloat(formValues.unit_rate_excl_vat || "0");
        const vatPct = parseFloat(formValues.vat_rate || "15");

        await supplierAccountsService.createSupplierCreditNoteWithLines(
          {
            company_id: activeCompany.id,
            project_id: formValues.project_id,
            supplier_account_id: formValues.supplier_account_id,
            invoice_id: formValues.invoice_id,
            financial_commitment_id: commitmentId,
            credit_note_number: formValues.credit_note_number,
            external_reference: formValues.external_reference || undefined,
            credit_note_date: formValues.credit_note_date,
            reason: formValues.reason,
            notes: formValues.notes || undefined
          },
          [
            {
              line_code: "CNL-1",
              description: formValues.description || "Credit adjustment",
              quantity: qty,
              unit: "SUM",
              unit_rate_excl_vat: rate,
              vat_rate: vatPct,
              sort_order: 1
            }
          ]
        );
        setSuccessMsg?.("Supplier credit note recorded as Draft.");
      } else if (activeModal === "supplier_payment") {
        if (!formValues.supplier_account_id || !formValues.project_id || !formValues.bank_account_id || !formValues.payment_reference || !formValues.payment_date || !formValues.amount_paid) {
          throw new Error("Supplier, Project, Bank Account, Payment Reference, Payment Date, and Amount Paid are required.");
        }
        await supplierAccountsService.createSupplierPayment({
          company_id: activeCompany.id,
          project_id: formValues.project_id,
          supplier_account_id: formValues.supplier_account_id,
          bank_account_id: formValues.bank_account_id,
          payment_reference: formValues.payment_reference,
          external_reference: formValues.external_reference || undefined,
          payment_date: formValues.payment_date,
          payment_method: formValues.payment_method || "EFT",
          amount_paid: parseFloat(formValues.amount_paid || "0"),
          notes: formValues.notes || undefined
        });
        setSuccessMsg?.("Supplier payment recorded as Draft.");
      } else if (activeModal === "supplier_allocation") {
        if (!formValues.supplier_payment_id || !formValues.supplier_invoice_id || !formValues.amount_allocated) {
          throw new Error("Supplier Payment, Supplier Invoice, and Amount to Allocate are required.");
        }
        await supplierAccountsService.allocateSupplierPayment(
          formValues.supplier_payment_id,
          formValues.supplier_invoice_id,
          parseFloat(formValues.amount_allocated || "0")
        );
        setSuccessMsg?.("Payment allocated to invoice successfully.");
      } else if (activeModal === "supplier_attachment") {
        if (!formValues.entity_type || !formValues.entity_id || !formValues.file_name || !formValues.file_path) {
          throw new Error("Attach To Entity, Target Entity ID, File Name, and File Path are required.");
        }
        await supplierAccountsService.createSupplierAttachment({
          company_id: activeCompany.id,
          entity_type: formValues.entity_type,
          entity_id: formValues.entity_id,
          document_category: formValues.document_category || "Other",
          file_name: formValues.file_name,
          file_path: formValues.file_path
        });
        setSuccessMsg?.("Document attachment uploaded successfully.");
      } else if (activeModal === "reconciliation_session") {
        const bAccountId = formValues.bank_account_id || selectedBankAccountId;
        if (!bAccountId) throw new Error("Bank Account selection is required.");
        if (!formValues.statement_end_date || formValues.statement_ending_balance === undefined) {
          throw new Error("Statement End Date and Statement Ending Balance are required.");
        }

        const session = await cashbookService.createReconciliationSession({
          company_id: activeCompany.id,
          bank_account_id: bAccountId,
          statement_end_date: formValues.statement_end_date,
          statement_ending_balance: parseFloat(formValues.statement_ending_balance || "0")
        });
        setSelectedReconciliationSessionId(session.id);
        setSuccessMsg?.("Bank reconciliation session initialized.");
      } else {
        // Fallback for disconnected modules
        setSubmitNotice(
          "This area is currently offline/empty as specified in Phase 2C.1."
        );
        setIsLoadingData(false);
        return;
      }

      handleCloseModal();
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Error creating financial record:", err);
      setSubmitNotice(err.message || "Failed to save financial record.");
      setErrorMsg?.("Failed to save financial record: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    setPageNotifications([]);
    setSearchQuery("");
    setProjectFilter("all");
    setStatusFilter("all");
    setFormValues({});
    setSubmitNotice(null);
    
    await loadAllFinanceData();

    const feedback = "Accounts page refreshed. Live data reloaded from database.";
    setPageNotifications([feedback]);
    setTimeout(() => {
      setPageNotifications([]);
    }, 4000);
  };

  // Helper for SAST Today date
  const getSASTTodayString = (): string => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const sast = new Date(utc + (3600000 * 2));
    return sast.toISOString().split("T")[0];
  };

  // Helper for SAST current month range
  const getSASTCurrentMonthRange = (): { start: string; end: string } => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const sast = new Date(utc + (3600000 * 2));
    const year = sast.getFullYear();
    const month = sast.getMonth();
    const endObj = new Date(year, month + 1, 0);
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;
    return { start: startStr, end: endStr };
  };

  // Shared helper for signed ledger cost posting values
  const getSignedCostAmount = (posting: any): number => {
    const isCost = posting.entry_type === "Cost";
    const isReversal = posting.entry_type === "Reversal";
    
    if (isCost) {
      if (posting.status === "Posted" || posting.status === "Reversed") {
        return posting.amount_excl_vat || 0;
      }
    } else if (isReversal) {
      if (posting.status === "Posted") {
        return -(posting.amount_excl_vat || 0);
      }
    }
    return 0;
  };

  // Supplier Accounts Workflow Handlers
  const handleSupplierInvoiceAction = async (id: string, action: string, version: number, reason?: string) => {
    setIsLoadingData(true);
    setSubmitNotice(null);
    try {
      if (action === "submit") await supplierAccountsService.submitSupplierInvoice(id, version);
      else if (action === "approve") await supplierAccountsService.approveSupplierInvoice(id, version);
      else if (action === "post") await supplierAccountsService.postSupplierInvoice(id, version);
      else if (action === "reject") await supplierAccountsService.rejectSupplierInvoice(id, reason || "Rejected by user", version);
      else if (action === "cancel") await supplierAccountsService.cancelSupplierInvoice(id, reason || "Cancelled by user", version);
      else if (action === "archive") await supplierAccountsService.archiveSupplierInvoice(id);
      else if (action === "restore") await supplierAccountsService.restoreSupplierInvoice(id);

      setSuccessMsg?.(`Supplier invoice updated: ${action.toUpperCase()}`);
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(`Action failed: ${err.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSupplierCreditAction = async (id: string, action: string, version: number, reason?: string) => {
    setIsLoadingData(true);
    setSubmitNotice(null);
    try {
      if (action === "submit") await supplierAccountsService.submitSupplierCreditNote(id, version);
      else if (action === "approve") await supplierAccountsService.approveSupplierCreditNote(id, version);
      else if (action === "post") await supplierAccountsService.postSupplierCreditNote(id, version);
      else if (action === "reject") await supplierAccountsService.rejectSupplierCreditNote(id, reason || "Rejected by user", version);
      else if (action === "cancel") await supplierAccountsService.cancelSupplierCreditNote(id, reason || "Cancelled by user", version);
      else if (action === "archive") await supplierAccountsService.archiveSupplierCreditNote(id);
      else if (action === "restore") await supplierAccountsService.restoreSupplierCreditNote(id);

      setSuccessMsg?.(`Supplier credit note updated: ${action.toUpperCase()}`);
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(`Action failed: ${err.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSupplierPaymentAction = async (id: string, action: string, version: number, reason?: string) => {
    setIsLoadingData(true);
    setSubmitNotice(null);
    try {
      if (action === "submit") await supplierAccountsService.submitSupplierPayment(id, version);
      else if (action === "approve") await supplierAccountsService.approveSupplierPayment(id, version);
      else if (action === "post") await supplierAccountsService.postSupplierPayment(id, version);
      else if (action === "reject") await supplierAccountsService.rejectSupplierPayment(id, reason || "Rejected by user", version);
      else if (action === "cancel") await supplierAccountsService.cancelSupplierPayment(id, reason || "Cancelled by user", version);
      else if (action === "reverse") await supplierAccountsService.reverseSupplierPayment(id, reason || "Reversed by user", version);
      else if (action === "archive") await supplierAccountsService.archiveSupplierPayment(id);
      else if (action === "restore") await supplierAccountsService.restoreSupplierPayment(id);

      setSuccessMsg?.(`Supplier payment updated: ${action.toUpperCase()}`);
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(`Action failed: ${err.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSupplierAccountAction = async (id: string, action: string, version?: number, reason?: string) => {
    setIsLoadingData(true);
    setSubmitNotice(null);
    try {
      if (action === "activate" && version !== undefined) await supplierAccountsService.activateSupplierAccount(id, version);
      else if (action === "deactivate" && version !== undefined) await supplierAccountsService.deactivateSupplierAccount(id, reason || "Deactivated by user", version);
      else if (action === "archive") await supplierAccountsService.archiveSupplierAccount(id);
      else if (action === "restore") await supplierAccountsService.restoreSupplierAccount(id);

      setSuccessMsg?.(`Supplier account updated: ${action.toUpperCase()}`);
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(`Action failed: ${err.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleConfirmActionPrompt = async () => {
    if (!supplierActionPrompt) return;
    const { type, id, version } = supplierActionPrompt;
    const reason = actionReasonInput || "User requested action";

    setSupplierActionPrompt(null);
    setActionReasonInput("");

    if (type === "deactivate_supplier") {
      await handleSupplierAccountAction(id, "deactivate", version, reason);
    } else if (type === "reject_invoice") {
      await handleSupplierInvoiceAction(id, "reject", version, reason);
    } else if (type === "cancel_invoice") {
      await handleSupplierInvoiceAction(id, "cancel", version, reason);
    } else if (type === "reject_credit") {
      await handleSupplierCreditAction(id, "reject", version, reason);
    } else if (type === "cancel_credit") {
      await handleSupplierCreditAction(id, "cancel", version, reason);
    } else if (type === "reject_payment") {
      await handleSupplierPaymentAction(id, "reject", version, reason);
    } else if (type === "cancel_payment") {
      await handleSupplierPaymentAction(id, "cancel", version, reason);
    } else if (type === "reverse_payment") {
      await handleSupplierPaymentAction(id, "reverse", version, reason);
    }
  };

  // ==================== CASHBOOK ACTION HANDLERS ====================
  const handleCashbookTxTransition = async (
    id: string,
    action: "submit" | "approve" | "post" | "cancel" | "archive" | "restore",
    reason?: string
  ) => {
    setIsLoadingData(true);
    try {
      const tx = cashbookTransactions.find(t => t.id === id);
      const version = tx?.version;
      if (action === "submit") {
        await cashbookService.submitTransaction(id, version);
        setSuccessMsg?.("Transaction submitted for approval.");
      } else if (action === "approve") {
        await cashbookService.approveTransaction(id, version);
        setSuccessMsg?.("Transaction approved successfully.");
      } else if (action === "post") {
        await cashbookService.postTransaction(id, version);
        setSuccessMsg?.("Transaction posted to cashbook.");
      } else if (action === "cancel") {
        await cashbookService.cancelTransaction(id, reason || "Cancelled by user", version);
        setSuccessMsg?.("Transaction cancelled.");
      } else if (action === "archive") {
        await cashbookService.archiveTransaction(id);
        setSuccessMsg?.("Transaction archived.");
      } else if (action === "restore") {
        await cashbookService.restoreTransaction(id);
        setSuccessMsg?.("Transaction restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Cashbook transaction transition error:", err);
      setErrorMsg?.("Cashbook transition failed: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleBankAccountToggle = async (account: BankAccount) => {
    setIsLoadingData(true);
    try {
      await cashbookService.updateBankAccount(account.id, {
        is_active: !account.is_active
      }, account.version);
      setSuccessMsg?.(`Bank account ${!account.is_active ? 'activated' : 'deactivated'}.`);
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Bank account update error:", err);
      setErrorMsg?.("Failed to update bank account: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleBankAccountArchive = async (id: string) => {
    setIsLoadingData(true);
    try {
      await cashbookService.archiveBankAccount(id);
      setSuccessMsg?.("Bank account archived.");
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Archive bank account error:", err);
      setErrorMsg?.("Failed to archive bank account: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleBankAccountRestore = async (id: string) => {
    setIsLoadingData(true);
    try {
      await cashbookService.restoreBankAccount(id);
      setSuccessMsg?.("Bank account restored.");
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Restore bank account error:", err);
      setErrorMsg?.("Failed to restore bank account: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleMatchStatementLine = async (lineId: string, txId: string) => {
    if (!selectedReconciliationSessionId) {
      setErrorMsg?.("No active reconciliation session selected.");
      return;
    }
    setIsLoadingData(true);
    try {
      const session = reconciliationSessions.find(s => s.id === selectedReconciliationSessionId);
      const line = statementLines.find(l => l.id === lineId);
      const tx = cashbookTransactions.find(t => t.id === txId);

      await cashbookService.matchStatementLine({
        sessionId: selectedReconciliationSessionId,
        statementLineId: lineId,
        cashbookTransactionId: txId,
        matchedAmount: line ? Math.abs(line.amount) : (tx ? tx.amount : 0),
        expectedSessionVersion: session?.version,
        expectedLineVersion: line?.version,
        expectedTxVersion: tx?.version
      });

      setSuccessMsg?.("Statement line matched successfully.");
      setSelectedMatchLineId("");
      setSelectedMatchTxId("");
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Match error:", err);
      setErrorMsg?.("Failed to match statement line: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleUnmatchStatementLine = async (matchId: string) => {
    setIsLoadingData(true);
    try {
      const match = reconciliationMatches.find(m => m.id === matchId);
      await cashbookService.unmatchStatementLine(matchId, match?.version);
      setSuccessMsg?.("Match unlinked successfully.");
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Unmatch error:", err);
      setErrorMsg?.("Failed to unmatch statement line: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleCompleteReconciliation = async (sessionId: string) => {
    setIsLoadingData(true);
    try {
      const session = reconciliationSessions.find(s => s.id === sessionId);
      await cashbookService.completeReconciliationSession(sessionId, session?.version);
      setSuccessMsg?.("Bank reconciliation completed and closed.");
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Complete reconciliation error:", err);
      setErrorMsg?.("Failed to complete reconciliation: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedReconciliationSessionId || !selectedBankAccountId) return;
    setIsLoadingData(true);
    try {
      const session = reconciliationSessions.find(s => s.id === selectedReconciliationSessionId);
      const unMatchedLines = statementLines.filter(
        l => l.bank_account_id === selectedBankAccountId && (l.match_status === "Unmatched" || l.match_status?.toLowerCase().includes("unmatched")) && !l.is_archived
      );
      const unReconciledTxs = cashbookTransactions.filter(
        t => t.bank_account_id === selectedBankAccountId &&
             t.status === "Posted" &&
             (t.reconciliation_status === "Unreconciled" || t.reconciliation_status?.toLowerCase().includes("unreconciled")) &&
             !t.is_archived
      );

      let matchedCount = 0;
      for (const line of unMatchedLines) {
        const lineAmt = Math.abs(line.amount);
        const candidate = unReconciledTxs.find(
          t => Math.abs(t.amount - lineAmt) < 0.01 &&
               !reconciliationMatches.some(m => m.cashbook_transaction_id === t.id)
        );
        if (candidate) {
          await cashbookService.matchStatementLine({
            sessionId: selectedReconciliationSessionId,
            statementLineId: line.id,
            cashbookTransactionId: candidate.id,
            matchedAmount: lineAmt,
            expectedSessionVersion: session?.version,
            expectedLineVersion: line.version,
            expectedTxVersion: candidate.version
          });
          matchedCount++;
        }
      }

      setSuccessMsg?.(`Auto-match complete: ${matchedCount} items matched.`);
      await loadAllFinanceData();
    } catch (err: any) {
      console.error("Auto match error:", err);
      setErrorMsg?.("Auto-match failed: " + err.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  const dashboardMetrics = React.useMemo(() => {
    if (isMigrationMissing) {
      return {
        pendingApprovalsCount: 0,
        unpostedCostsCount: 0,
        unpostedCostsSum: 0,
        unallocatedReceiptsCount: 0,
        unallocatedReceiptsSum: 0,
        overdueInvoicesCount: 0,
        overdueInvoicesSum: 0,
        unreconciledTxCount: 0,
        unreconciledTxSum: 0,
        overdueSupplierInvoicesCount: 0,
        overdueSupplierInvoicesSum: 0
      };
    }

    // 1. Pending Approvals
    const pendingBudgets = budgets.filter(b => b.status === "Submitted" && !b.is_archived).length;
    const pendingCommitments = commitments.filter(c => c.status === "Submitted" && !c.is_archived).length;
    const pendingCosts = actualCosts.filter(a => a.status === "Submitted" && !a.is_archived).length;
    const pendingForecasts = forecasts.filter(f => f.status === "Submitted" && !f.is_archived).length;
    const pendingInvoices = clientInvoices.filter(i => i.status === "Submitted" && !i.is_archived).length;
    const pendingCreditNotes = clientCreditNotes.filter(cn => cn.status === "Submitted" && !cn.is_archived).length;
    const pendingSupplierInvoices = supplierInvoices.filter(si => si.status === "Submitted" && !si.is_archived).length;
    const pendingSupplierCreditNotes = supplierCreditNotes.filter(scn => scn.status === "Submitted" && !scn.is_archived).length;
    const pendingSupplierPayments = supplierPayments.filter(sp => sp.status === "Submitted" && !sp.is_archived).length;
    const pendingCashbookTxs = cashbookTransactions.filter(cb => cb.status === "Submitted" && !cb.is_archived).length;
    const pendingApprovalsCount = pendingBudgets + pendingCommitments + pendingCosts + pendingForecasts + pendingInvoices + pendingCreditNotes + pendingSupplierInvoices + pendingSupplierCreditNotes + pendingSupplierPayments + pendingCashbookTxs;

    // 2. Unposted Costs
    const draftCosts = actualCosts.filter(a => a.status === "Draft" && !a.is_archived);
    const draftReceipts = clientReceipts.filter(r => r.status === "Draft" && !r.is_archived);
    const unpostedCostsCount = draftCosts.length + draftReceipts.length;
    const unpostedCostsSum = draftCosts.reduce((s, a) => s + (a.amount_excl_vat || 0), 0) +
                             draftReceipts.reduce((s, r) => s + (r.amount_received || 0), 0);

    // 3. Unallocated Receipts
    const postedReceipts = clientReceipts.filter(r => r.status === "Posted" && !r.is_archived);
    let unallocatedReceiptsCount = 0;
    let unallocatedReceiptsSum = 0;

    postedReceipts.forEach(r => {
      const activeAllocations = clientReceiptAllocations.filter(
        cra => cra.receipt_id === r.id && !cra.is_reversed && !cra.is_archived
      );
      const allocatedSum = activeAllocations.reduce((s, cra) => s + (cra.amount_allocated || 0), 0);
      const unallocatedAmt = Math.max(0, (r.amount_received || 0) - allocatedSum);
      if (unallocatedAmt > 0) {
        unallocatedReceiptsCount++;
        unallocatedReceiptsSum += unallocatedAmt;
      }
    });

    // 4. Overdue Client Invoices
    const todayStr = getSASTTodayString();
    const issuedInvoices = clientInvoices.filter(i => i.status === "Issued" && !i.is_archived);
    let overdueInvoicesCount = 0;
    let overdueInvoicesSum = 0;

    issuedInvoices.forEach(inv => {
      if (inv.due_date && inv.due_date < todayStr) {
        const issuedCNs = clientCreditNotes.filter(
          cn => cn.invoice_id === inv.id && cn.status === "Issued" && !cn.is_archived
        );
        const cnSum = issuedCNs.reduce((s, cn) => s + (cn.total_incl_vat || 0), 0);

        const activeAllocations = clientReceiptAllocations.filter(
          cra => cra.invoice_id === inv.id && !cra.is_reversed && !cra.is_archived
        );
        const allocSum = activeAllocations.reduce((s, cra) => s + (cra.amount_allocated || 0), 0);

        const netOutstanding = Math.max(0, (inv.total_incl_vat || 0) - cnSum - allocSum);
        if (netOutstanding > 0) {
          overdueInvoicesCount++;
          overdueInvoicesSum += netOutstanding;
        }
      }
    });

    // 5. Unreconciled Transactions (Cashbook)
    const unreconciledTxs = cashbookTransactions.filter(
      t => t.status === "Posted" &&
           (t.reconciliation_status === "Unreconciled" || t.reconciliation_status?.toLowerCase().includes("unreconciled")) &&
           !t.is_archived
    );
    const unreconciledTxCount = unreconciledTxs.length;
    const unreconciledTxSum = unreconciledTxs.reduce((s, t) => s + Math.abs(t.amount || 0), 0);

    // 6. Overdue Supplier Invoices (Supplier Accounts)
    const approvedOrPostedSupplierInvoices = supplierInvoices.filter(
      inv => (inv.status === "Approved" || inv.status === "Posted") && !inv.is_archived
    );
    let overdueSupplierInvoicesCount = 0;
    let overdueSupplierInvoicesSum = 0;

    approvedOrPostedSupplierInvoices.forEach(inv => {
      if (inv.due_date && inv.due_date < todayStr) {
        const linkedCNs = supplierCreditNotes.filter(
          cn => cn.invoice_id === inv.id &&
                (cn.status === "Approved" || cn.status === "Posted") &&
                !cn.is_archived
        );
        const cnSum = linkedCNs.reduce((s, cn) => s + (cn.total_incl_vat || 0), 0);

        const activeAllocations = supplierPaymentAllocations.filter(
          spa => spa.supplier_invoice_id === inv.id &&
                 spa.status === "Active" &&
                 !spa.is_archived
        );
        const allocSum = activeAllocations.reduce((s, spa) => s + (spa.amount_allocated || 0), 0);

        const netOutstanding = Math.max(0, (inv.total_incl_vat || 0) - cnSum - allocSum);
        if (netOutstanding > 0) {
          overdueSupplierInvoicesCount++;
          overdueSupplierInvoicesSum += netOutstanding;
        }
      }
    });

    return {
      pendingApprovalsCount,
      unpostedCostsCount,
      unpostedCostsSum,
      unallocatedReceiptsCount,
      unallocatedReceiptsSum,
      overdueInvoicesCount,
      overdueInvoicesSum,
      unreconciledTxCount,
      unreconciledTxSum,
      overdueSupplierInvoicesCount,
      overdueSupplierInvoicesSum
    };
  }, [
    budgets, commitments, actualCosts, forecasts, clientInvoices,
    clientCreditNotes, clientReceipts, clientReceiptAllocations,
    cashbookTransactions, supplierInvoices, supplierCreditNotes,
    supplierPayments, supplierPaymentAllocations, isMigrationMissing
  ]);

  const summaryMetrics = React.useMemo(() => {
    if (isMigrationMissing) {
      return {
        approvedBudget: null,
        actualCost: null,
        remainingCommitments: null,
        forecastFinalCost: null,
        projectedProfit: null,
        approvedCommitments: null,
        hasForecastCoverage: false
      };
    }

    // 1. Current Approved Budget (Latest approved budget per project)
    const approvedBudgetsList = budgets.filter((b) => b.status === "Approved" && !b.is_archived);
    let totalApprovedBudget = 0;
    if (projectFilter !== "all") {
      const pBudgets = approvedBudgetsList.filter((b) => b.project_id === projectFilter);
      const latestApproved = pBudgets.reduce((latest, current) => 
        !latest || current.version_number > latest.version_number ? current : latest
      , null as any);
      if (latestApproved) {
        totalApprovedBudget = (latestApproved.original_budget_excl_vat || 0) + (latestApproved.approved_variations_excl_vat || 0);
      }
    } else {
      const projectLatestApprovedBudgets = new Map<string, any>();
      approvedBudgetsList.forEach((b) => {
        const existing = projectLatestApprovedBudgets.get(b.project_id);
        if (!existing || b.version_number > existing.version_number) {
          projectLatestApprovedBudgets.set(b.project_id, b);
        }
      });
      projectLatestApprovedBudgets.forEach((b) => {
        totalApprovedBudget += (b.original_budget_excl_vat || 0) + (b.approved_variations_excl_vat || 0);
      });
    }

    // 2. Net Actual Costs (Posted actual costs)
    const activeCosts = actualCosts.filter((c) => {
      const matchesProj = projectFilter === "all" || c.project_id === projectFilter;
      return matchesProj && !c.is_archived;
    });
    const totalActualCost = activeCosts.reduce((sum, c) => sum + getSignedCostAmount(c), 0);

    // 3. Approved Commitments & Remaining Commitments
    const activeCommitments = commitments.filter((c) => {
      const matchesProj = projectFilter === "all" || c.project_id === projectFilter;
      return matchesProj && !c.is_archived;
    });

    let totalApprovedCommitments = 0;
    let totalRemainingCommitments = 0;

    activeCommitments.forEach((c) => {
      const revised = (c.original_amount_excl_vat || 0) + (c.approved_variations_excl_vat || 0);
      const linkedPostings = actualCosts.filter(p => p.commitment_id === c.id && !p.is_archived);
      const netRecognized = linkedPostings.reduce((sum, p) => sum + getSignedCostAmount(p), 0);
      const remaining = Math.max(revised - netRecognized, 0);

      if (c.status === "Approved") {
        totalApprovedCommitments += revised;
        totalRemainingCommitments += remaining;
      }
    });

    // 4. Approved Forecasts and ETC
    const approvedForecastsList = forecasts.filter((f) => f.status === "Approved" && !f.is_archived);
    
    let hasForecastCoverage = false;
    let totalRevenue = 0;
    let totalEtc = 0;

    if (projectFilter !== "all") {
      const pForecast = approvedForecastsList.find((f) => f.project_id === projectFilter);
      if (pForecast) {
        hasForecastCoverage = true;
        totalRevenue = pForecast.forecast_contract_revenue_excl_vat || 0;
        totalEtc = pForecast.uncommitted_estimate_to_complete_excl_vat || 0;
      }
    } else {
      if (allProjects.length > 0) {
        const projectsWithForecast = allProjects.filter((p: any) => 
          approvedForecastsList.some((f) => f.project_id === p.id)
        );
        if (projectsWithForecast.length === allProjects.length) {
          hasForecastCoverage = true;
          allProjects.forEach((p: any) => {
            const f = approvedForecastsList.find((f) => f.project_id === p.id);
            if (f) {
              totalRevenue += f.forecast_contract_revenue_excl_vat || 0;
              totalEtc += f.uncommitted_estimate_to_complete_excl_vat || 0;
            }
          });
        }
      }
    }

    // Forecast Final Cost
    const forecastFinalCost = hasForecastCoverage 
      ? (totalActualCost + totalRemainingCommitments + totalEtc)
      : null;

    // Projected Profit or Loss
    const projectedProfit = hasForecastCoverage
      ? (totalRevenue - forecastFinalCost!)
      : null;

    return {
      approvedBudget: totalApprovedBudget,
      actualCost: totalActualCost,
      remainingCommitments: totalRemainingCommitments,
      forecastFinalCost,
      projectedProfit,
      approvedCommitments: totalApprovedCommitments,
      hasForecastCoverage
    };
  }, [budgets, commitments, actualCosts, forecasts, allProjects, projectFilter, isMigrationMissing]);

  const commitmentMetrics = React.useMemo(() => {
    if (isMigrationMissing) {
      return { approved: 0, recognized: 0, remaining: 0, attentionCount: 0 };
    }

    const filteredCommitments = commitments.filter((c) => {
      const matchesProj = projectFilter === "all" || c.project_id === projectFilter;
      return matchesProj && !c.is_archived;
    });

    const todayStr = getSASTTodayString();

    let approved = 0;
    let recognized = 0;
    let remainingTotal = 0;
    let attentionCount = 0;

    filteredCommitments.forEach((c) => {
      const revised = (c.original_amount_excl_vat || 0) + (c.approved_variations_excl_vat || 0);
      const linkedPostings = actualCosts.filter(p => p.commitment_id === c.id && !p.is_archived);
      const netRecognized = linkedPostings.reduce((sum, p) => sum + getSignedCostAmount(p), 0);
      const remaining = Math.max(revised - netRecognized, 0);

      if (c.status === "Approved") {
        approved += revised;
        remainingTotal += remaining;
      }
      
      recognized += netRecognized;

      const isOverdue = c.completion_date && c.completion_date < todayStr;
      const isAttention = netRecognized > revised || (isOverdue && remaining > 0);
      if (isAttention) {
        attentionCount++;
      }
    });

    return {
      approved,
      recognized,
      remaining: remainingTotal,
      attentionCount
    };
  }, [commitments, actualCosts, projectFilter, isMigrationMissing]);

  const costMetrics = React.useMemo(() => {
    if (isMigrationMissing) {
      return { posted: 0, draft: 0, reversalCount: 0, currentPeriod: 0 };
    }

    const filteredCosts = actualCosts.filter((c) => {
      const matchesProj = projectFilter === "all" || c.project_id === projectFilter;
      return matchesProj && !c.is_archived;
    });

    const { start: curMonthStart, end: curMonthEnd } = getSASTCurrentMonthRange();

    let posted = 0;
    let draft = 0;
    let reversalCount = 0;
    let currentPeriod = 0;

    filteredCosts.forEach((c) => {
      const signedAmt = getSignedCostAmount(c);

      posted += signedAmt;

      if (c.status === "Draft") {
        draft += c.amount_excl_vat || 0;
      }

      if (c.entry_type === "Reversal") {
        reversalCount++;
      }

      if (c.posting_date >= curMonthStart && c.posting_date <= curMonthEnd) {
        currentPeriod += signedAmt;
      }
    });

    return {
      posted,
      draft,
      reversalCount,
      currentPeriod
    };
  }, [actualCosts, projectFilter, isMigrationMissing]);

  // Budget workflow transitions
  const handleBudgetTransition = async (id: string, action: "submit" | "approve" | "reject" | "cancel" | "archive" | "restore") => {
    setIsLoadingData(true);
    try {
      if (action === "submit") {
        await submitBudgetVersion(id);
        setSuccessMsg?.("Budget version submitted for review.");
      } else if (action === "approve") {
        await approveBudgetVersion(id);
        setSuccessMsg?.("Budget version approved and baselined.");
      } else if (action === "reject") {
        const reason = window.prompt("Enter rejection reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await rejectBudgetVersion(id, reason);
        setSuccessMsg?.("Budget version rejected.");
      } else if (action === "cancel") {
        const reason = window.prompt("Enter cancellation reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await cancelBudgetVersion(id, reason);
        setSuccessMsg?.("Budget version cancelled.");
      } else if (action === "archive") {
        await archiveRecord("project_budget_versions", id);
        setSuccessMsg?.("Budget version archived.");
      } else if (action === "restore") {
        await restoreRecord("project_budget_versions", id);
        setSuccessMsg?.("Budget version restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Forecast workflow transitions
  const handleForecastTransition = async (id: string, action: "submit" | "approve" | "reject" | "archive" | "restore") => {
    setIsLoadingData(true);
    try {
      if (action === "submit") {
        await submitProjectForecast(id);
        setSuccessMsg?.("Forecast submitted for review.");
      } else if (action === "approve") {
        await approveProjectForecast(id);
        setSuccessMsg?.("Forecast approved.");
      } else if (action === "reject") {
        const reason = window.prompt("Enter rejection reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await rejectProjectForecast(id, reason);
        setSuccessMsg?.("Forecast rejected.");
      } else if (action === "archive") {
        await archiveRecord("project_financial_forecasts", id);
        setSuccessMsg?.("Forecast archived.");
      } else if (action === "restore") {
        await restoreRecord("project_financial_forecasts", id);
        setSuccessMsg?.("Forecast restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Commitment workflow transitions
  const handleCommitmentTransition = async (id: string, action: "submit" | "approve" | "reject" | "close" | "cancel" | "archive" | "restore") => {
    assertOperationalAction("write", "pages/Accounts/AccountsPage.tsx");
    setIsLoadingData(true);
    try {
      if (action === "submit") {
        await submitFinancialCommitment(id);
        setSuccessMsg?.("Commitment submitted for approval.");
      } else if (action === "approve") {
        await approveFinancialCommitment(id);
        setSuccessMsg?.("Commitment approved.");
      } else if (action === "reject") {
        const reason = window.prompt("Enter rejection reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await rejectFinancialCommitment(id, reason);
        setSuccessMsg?.("Commitment rejected.");
      } else if (action === "close") {
        await closeFinancialCommitment(id);
        setSuccessMsg?.("Commitment closed.");
      } else if (action === "cancel") {
        const reason = window.prompt("Enter cancellation reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await cancelFinancialCommitment(id, reason);
        setSuccessMsg?.("Commitment cancelled.");
      } else if (action === "archive") {
        await archiveRecord("financial_commitments", id);
        setSuccessMsg?.("Commitment archived.");
      } else if (action === "restore") {
        await restoreRecord("financial_commitments", id);
        setSuccessMsg?.("Commitment restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Cost postings transitions
  const handleCostTransition = async (id: string, action: "submit" | "post" | "reject" | "reverse" | "archive" | "restore") => {
    setIsLoadingData(true);
    try {
      if (action === "submit") {
        await submitCostPosting(id);
        setSuccessMsg?.("Cost posting submitted for posting.");
      } else if (action === "post") {
        await postCostPosting(id);
        setSuccessMsg?.("Cost posting approved and posted to general ledger.");
      } else if (action === "reject") {
        const reason = window.prompt("Enter rejection reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await rejectCostPosting(id, reason);
        setSuccessMsg?.("Cost posting rejected.");
      } else if (action === "reverse") {
        const reason = window.prompt("Enter reversal reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await reverseCostPosting(id, reason);
        setSuccessMsg?.("Cost posting reversed.");
      } else if (action === "archive") {
        await archiveRecord("financial_cost_postings", id);
        setSuccessMsg?.("Cost posting archived.");
      } else if (action === "restore") {
        await restoreRecord("financial_cost_postings", id);
        setSuccessMsg?.("Cost posting restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Export Actual Costs to CSV
  const handleExportActualCostsCsv = () => {
    assertOperationalAction("export", "pages/Accounts/AccountsPage.tsx");
    const timestamp = new Date().toISOString().split("T")[0];
    const filtered = actualCosts.filter((c) => {
      const matchesSearch =
        c.posting_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProj = projectFilter === "all" || c.project_id === projectFilter;
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesProj && matchesStatus;
    });

    const columns: CsvColumn<FinancialCostPosting>[] = [
      { key: "posting_reference", label: "Posting Reference" },
      { key: "posting_date", label: "Posting Date" },
      {
        key: "project_id",
        label: "Project",
        formatter: (projId) => {
          const proj = allProjects.find((p: any) => p.id === projId);
          return proj ? proj.name : (projId || "All Projects");
        }
      },
      { key: "source_type", label: "Source Type" },
      { key: "source_reference", label: "Source Reference", formatter: (v) => v || "—" },
      { key: "cost_category", label: "Cost Category" },
      { key: "description", label: "Description", formatter: (v) => v || "—" },
      { key: "entry_type", label: "Entry Type" },
      { key: "amount_excl_vat", label: `Amount Excl. VAT (${currencyCode})` },
      { key: "status", label: "Status" },
      { key: "currency_code", label: "Currency", formatter: (v) => v || currencyCode },
      { key: "reversal_reason", label: "Reversal Reason", formatter: (v) => v || "" },
      { key: "notes", label: "Notes", formatter: (v) => v || "" },
      { key: "is_archived", label: "Archived", formatter: (v) => (v ? "Yes" : "No") }
    ];

    const dataToExport = filtered.length > 0 ? filtered : actualCosts;
    const filename = `Actual_Costs_Ledger_${projectFilter !== "all" ? `Proj_${projectFilter}_` : ""}${timestamp}`;
    exportObjectsToCsv(filename, columns, dataToExport);
  };

  // Client Contract workflow transitions
  const handleContractTransition = async (id: string, action: "activate" | "close" | "cancel" | "archive" | "restore") => {
    setIsLoadingData(true);
    try {
      if (action === "activate") {
        await activateClientContract(id);
        setSuccessMsg?.("Client contract activated successfully.");
      } else if (action === "close") {
        await closeClientContract(id);
        setSuccessMsg?.("Client contract closed successfully.");
      } else if (action === "cancel") {
        const reason = window.prompt("Enter cancellation reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await cancelClientContract(id, reason);
        setSuccessMsg?.("Client contract cancelled.");
      } else if (action === "archive") {
        await archiveRecord("project_client_contracts", id);
        setSuccessMsg?.("Client contract archived.");
      } else if (action === "restore") {
        await restoreRecord("project_client_contracts", id);
        setSuccessMsg?.("Client contract restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Client Invoice workflow transitions
  const handleClientInvoiceTransition = async (id: string, action: "submit" | "approve" | "reject" | "issue" | "cancel" | "archive" | "restore") => {
    setIsLoadingData(true);
    try {
      if (action === "submit") {
        await submitClientInvoice(id);
        setSuccessMsg?.("Client invoice submitted for approval.");
      } else if (action === "approve") {
        await approveClientInvoice(id);
        setSuccessMsg?.("Client invoice approved.");
      } else if (action === "reject") {
        const reason = window.prompt("Enter rejection reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await rejectClientInvoice(id, reason);
        setSuccessMsg?.("Client invoice rejected.");
      } else if (action === "issue") {
        await issueClientInvoice(id);
        setSuccessMsg?.("Client invoice issued.");
      } else if (action === "cancel") {
        const reason = window.prompt("Enter cancellation reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await cancelClientInvoice(id, reason);
        setSuccessMsg?.("Client invoice cancelled.");
      } else if (action === "archive") {
        await archiveRecord("client_invoices", id);
        setSuccessMsg?.("Client invoice archived.");
      } else if (action === "restore") {
        await restoreRecord("client_invoices", id);
        setSuccessMsg?.("Client invoice restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Client Credit Note workflow transitions
  const handleClientCreditNoteTransition = async (id: string, action: "submit" | "approve" | "reject" | "issue" | "cancel" | "archive" | "restore") => {
    setIsLoadingData(true);
    try {
      if (action === "submit") {
        await submitClientCreditNote(id);
        setSuccessMsg?.("Client credit note submitted for approval.");
      } else if (action === "approve") {
        await approveClientCreditNote(id);
        setSuccessMsg?.("Client credit note approved.");
      } else if (action === "reject") {
        const reason = window.prompt("Enter rejection reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await rejectClientCreditNote(id, reason);
        setSuccessMsg?.("Client credit note rejected.");
      } else if (action === "issue") {
        await issueClientCreditNote(id);
        setSuccessMsg?.("Client credit note issued.");
      } else if (action === "cancel") {
        const reason = window.prompt("Enter cancellation reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await cancelClientCreditNote(id, reason);
        setSuccessMsg?.("Client credit note cancelled.");
      } else if (action === "archive") {
        await archiveRecord("client_credit_notes", id);
        setSuccessMsg?.("Client credit note archived.");
      } else if (action === "restore") {
        await restoreRecord("client_credit_notes", id);
        setSuccessMsg?.("Client credit note restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Client Receipt workflow transitions
  const handleClientReceiptTransition = async (id: string, action: "post" | "reverse" | "cancel" | "archive" | "restore") => {
    setIsLoadingData(true);
    try {
      if (action === "post") {
        await postClientReceipt(id);
        setSuccessMsg?.("Client receipt posted to ledger.");
      } else if (action === "reverse") {
        const reason = window.prompt("Enter reversal reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await reverseClientReceipt(id, reason);
        setSuccessMsg?.("Client receipt reversed.");
      } else if (action === "cancel") {
        const reason = window.prompt("Enter cancellation reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await cancelClientReceipt(id, reason);
        setSuccessMsg?.("Client receipt cancelled.");
      } else if (action === "archive") {
        await archiveRecord("client_receipts", id);
        setSuccessMsg?.("Client receipt archived.");
      } else if (action === "restore") {
        await restoreRecord("client_receipts", id);
        setSuccessMsg?.("Client receipt restored.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Allocation reversal transition
  const handleAllocationTransition = async (id: string, action: "reverse") => {
    setIsLoadingData(true);
    try {
      if (action === "reverse") {
        const reason = window.prompt("Enter allocation reversal reason:") || "";
        if (!reason) {
          setIsLoadingData(false);
          return;
        }
        await reverseClientReceiptAllocation(id, reason);
        setSuccessMsg?.("Receipt allocation reversed.");
      }
      await loadAllFinanceData();
    } catch (err: any) {
      setErrorMsg?.(err.message || "Action failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Reusable card & visual element classes
  const cardClass = "bg-white p-6 rounded-3xl border border-[#E2E8F0] shadow-[0px_8px_24px_rgba(7,24,46,0.02)]";
  const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm text-[#07182E] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#07182E]/10 focus:border-[#07182E] transition-all";

  // Reusable empty state component
  const renderEmptyState = (props: {
    icon: React.ComponentType<any>;
    title: string;
    description: string;
    addButtonLabel: string;
    modalType: string;
  }) => {
    const Icon = props.icon;
    return (
      <div className="bg-white p-12 text-center rounded-3xl border border-[#E2E8F0] shadow-[0px_8px_24px_rgba(7,24,46,0.01)] flex flex-col items-center justify-center animate-fadeIn">
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-full w-16 h-16 flex items-center justify-center mb-4 text-[#07182E]/60 shadow-xs">
          <Icon className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-[#07182E] tracking-tight">{props.title}</h3>
        <p className="text-sm text-slate-500 max-w-md mt-1 mb-6 leading-relaxed">
          {props.description}
        </p>
        <button
          onClick={() => handleOpenModal(props.modalType)}
          className="inline-flex items-center gap-2 bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm active:scale-98"
        >
          <Plus className="w-4 h-4" />
          {props.addButtonLabel}
        </button>
      </div>
    );
  };

  return (
    <ProjectShell project={activeProject} section="commercial">
      <div className="space-y-6 max-w-7xl mx-auto py-2 animate-fadeIn relative">
        {/* 1. Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-[#E2E8F0]">
        <div>
          <span className="text-[11px] font-extrabold tracking-widest text-[#FF9F1C] uppercase block mb-1">
            FINANCIAL OPERATIONS
          </span>
          <h1 className="text-3xl font-extrabold text-[#07182E] tracking-tight">
            Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Capture, approve, post and reconcile project and company financial records.
          </p>
        </div>

        {/* Global Page Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Project scope selector */}
          <div className="relative">
            <select
              disabled
              className="bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-xl px-3.5 py-2.5 pr-8 appearance-none cursor-not-allowed"
            >
              <option>All Company Projects</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
              <ChevronRight className="w-3 h-3 rotate-90" />
            </div>
          </div>

          {/* Financial period selector */}
          <div className="relative">
            <select
              disabled
              className="bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-xl px-3.5 py-2.5 pr-8 appearance-none cursor-not-allowed"
            >
              <option>All Periods</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
              <ChevronRight className="w-3 h-3 rotate-90" />
            </div>
          </div>

          {/* Currency badge */}
          <span className="bg-[#07182E]/5 text-[#07182E] border border-[#07182E]/10 text-xs font-black px-3.5 py-2.5 rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
            <Coins className="w-3.5 h-3.5 text-[#FF9F1C]" />
            {currencyCode}
          </span>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all text-slate-600 active:scale-95 shadow-2xs"
            title="Refresh Financial Ledger State"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Quick Action button */}
          <div className="relative">
            <button
              onClick={() => handleOpenModal("budget")}
              className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Quick Action
            </button>
          </div>
        </div>
      </div>

      {/* Local Notification Alerts if any */}
      {pageNotifications.map((notif, idx) => (
        <div key={idx} className="bg-slate-900 border-l-4 border-[#FF9F1C] text-slate-200 text-xs font-bold p-4 rounded-xl shadow-lg flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#FF9F1C] shrink-0" />
          {notif}
        </div>
      ))}

      {isMigrationMissing && (
        <div className="bg-red-50 text-red-800 text-sm font-semibold p-4 rounded-2xl border border-red-100 flex items-start gap-3 shadow-xs mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Database Migration Pending</h4>
            <p className="text-xs text-red-700 font-normal mt-0.5">
              The financial database foundation has not been deployed to this Supabase environment.
            </p>
          </div>
        </div>
      )}

      {/* 2. Primary Navigation Tabs */}
      <div className="w-full border-b border-[#E2E8F0]">
        <div
          role="tablist"
          className="flex space-x-1 overflow-x-auto scrollbar-none pb-px"
        >
          {([
            { id: "overview", label: "Overview" },
            { id: "budgets", label: "Budgets & Forecasts" },
            { id: "commitments", label: "Commitments" },
            { id: "actuals", label: "Actual Costs" },
            { id: "client", label: "Client Accounts" },
            { id: "supplier", label: "Supplier Accounts" },
            { id: "cash", label: "Cash & Bank" },
            { id: "reports", label: "Reports & Audit" },
            { id: "setup", label: "Finance Setup" }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? "border-[#07182E] text-[#07182E]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Switch Content */}
      <div className="min-h-[400px]">
        {/* ==================== TAB 1: OVERVIEW ==================== */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Operational Control Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: "Pending Approvals",
                  value: dashboardMetrics.pendingApprovalsCount.toString(),
                  sub: `${dashboardMetrics.pendingApprovalsCount} pending item(s)`,
                  desc: "Invoice, claim, budget and cost approvals waiting for financial authority.",
                  icon: FileCheck,
                  active: true
                },
                {
                  title: "Unposted Costs",
                  value: formatCurrency(dashboardMetrics.unpostedCostsSum),
                  sub: `${dashboardMetrics.unpostedCostsCount} draft posting(s)`,
                  desc: "Costs and receipts entered in draft requiring ledger posting.",
                  icon: SlidersHorizontal,
                  active: true
                },
                {
                  title: "Unallocated Receipts",
                  value: formatCurrency(dashboardMetrics.unallocatedReceiptsSum),
                  sub: `${dashboardMetrics.unallocatedReceiptsCount} unallocated receipt(s)`,
                  desc: "Client receipts received but not matched to invoices.",
                  icon: Coins,
                  active: true
                },
                {
                  title: "Unreconciled Transactions",
                  value: formatCurrency(dashboardMetrics.unreconciledTxSum),
                  sub: `${dashboardMetrics.unreconciledTxCount} unreconciled item(s)`,
                  desc: "Bank transactions awaiting reconciliation.",
                  icon: RefreshCw,
                  active: true
                },
                {
                  title: "Overdue Client Invoices",
                  value: formatCurrency(dashboardMetrics.overdueInvoicesSum),
                  sub: `${dashboardMetrics.overdueInvoicesCount} overdue invoice(s)`,
                  desc: "Client invoices past their payment due date.",
                  icon: ArrowUpRight,
                  active: true
                },
                {
                  title: "Overdue Supplier Invoices",
                  value: formatCurrency(dashboardMetrics.overdueSupplierInvoicesSum),
                  sub: `${dashboardMetrics.overdueSupplierInvoicesCount} overdue invoice(s)`,
                  desc: "Approved supplier invoices past their due date.",
                  icon: ArrowDownLeft,
                  active: true
                }
              ].map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div key={idx} className={cardClass}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {card.title}
                        </h4>
                        <span className="text-2xl font-black text-slate-800 tracking-tight block mt-1">
                          {card.value}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${card.active ? "bg-emerald-500" : "bg-slate-400 animate-pulse"}`} />
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest ${card.active ? "text-emerald-600" : "text-slate-400"}`}>
                        {card.active ? card.sub : "Not connected"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal font-medium mt-1">
                      {card.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions Panel */}
            <div className={`${cardClass} bg-[#07182E] text-white border-none shadow-md overflow-hidden relative`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/2 rounded-full translate-x-20 -translate-y-20 pointer-events-none" />
              <h3 className="text-base font-bold tracking-tight mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#FF9F1C]" />
                Accounting Command Shortcuts
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Create Budget Version", modal: "budget" },
                  { label: "Add Commitment", modal: "commitment" },
                  { label: "Record Actual Cost", modal: "actual" },
                  { label: "Create Client Account", modal: "client_account" },
                  { label: "Create Client Contract", modal: "client_contract" },
                  { label: "Create Client Invoice", modal: "client_invoice" }
                ].map((act, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenModal(act.modal)}
                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-center transition-all cursor-pointer text-xs font-bold text-slate-200 hover:text-white flex flex-col justify-between h-20 items-center justify-center active:scale-95"
                  >
                    <Plus className="w-4.5 h-4.5 text-[#FF9F1C] mb-1" />
                    <span className="leading-tight">{act.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Financial Data Readiness Matrix */}
            <div className={cardClass}>
              <h3 className="text-sm font-bold text-[#07182E] mb-4 flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#FF9F1C]" />
                Financial Data Integration Readiness
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: "Approved Budgets", status: isMigrationMissing ? "Not configured" : "Operational / Active", active: !isMigrationMissing },
                  { name: "Commitments", status: isMigrationMissing ? "Not configured" : "Operational / Active", active: !isMigrationMissing },
                  { name: "Actual Costs", status: isMigrationMissing ? "Not configured" : "Operational / Active", active: !isMigrationMissing },
                  { name: "Client Accounts", status: isMigrationMissing ? "Not configured" : "Operational / Active", active: !isMigrationMissing },
                  { name: "Supplier Accounts", status: isMigrationMissing ? "Not configured" : "Operational / Active", active: !isMigrationMissing },
                  { name: "Cash & Bank", status: isMigrationMissing ? "Not configured" : "Operational / Active", active: !isMigrationMissing },
                  { name: "Forecasting", status: isMigrationMissing ? "Not configured" : "Operational / Active", active: !isMigrationMissing },
                  { name: "Audit History", status: isMigrationMissing ? "Not configured" : "Operational / Active", active: !isMigrationMissing }
                ].map((source, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#07182E] block">{source.name}</span>
                      <span className={`text-[10px] font-semibold block ${source.active ? "text-emerald-600" : "text-slate-400"}`}>{source.status}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${source.active ? "bg-emerald-500 shadow-xs" : "bg-slate-300"}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity Table (Honest Empty State) */}
            <div className={cardClass}>
              <h3 className="text-sm font-bold text-[#07182E] mb-6">Recent Financial Postings</h3>
              {actualCosts.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2.5 animate-pulse" />
                  <h4 className="text-sm font-bold text-[#07182E] mb-1">No financial activity yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Approved, posted and reconciled financial activity will appear here after the Accounts backend is connected.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                        <th className="px-5 py-3">Posting Reference</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Source Type</th>
                        <th className="px-5 py-3">Cost Category</th>
                        <th className="px-5 py-3">Amount Excl. VAT</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actualCosts.slice(0, 5).map((cost) => (
                        <tr key={cost.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                          <td className="px-5 py-3 font-mono font-bold text-slate-700">{cost.posting_reference}</td>
                          <td className="px-5 py-3 text-slate-500">{cost.posting_date}</td>
                          <td className="px-5 py-3 text-slate-500">{cost.source_type}</td>
                          <td className="px-5 py-3 text-slate-600 font-semibold">{cost.cost_category}</td>
                          <td className="px-5 py-3 font-mono font-extrabold text-slate-800">
                            {formatCurrency(cost.amount_excl_vat)}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              cost.status === "Posted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              cost.status === "Reversed" ? "bg-red-50 text-red-700 border border-red-200" :
                              cost.status === "Submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                              "bg-slate-100 text-slate-600"
                            }`}>
                              {cost.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: BUDGETS & FORECASTS ==================== */}
        {activeTab === "budgets" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { 
                  title: projectFilter === "all" ? "Current Approved Budget" : "Current Approved Budget (Project-scoped)", 
                  value: summaryMetrics.approvedBudget !== null 
                    ? formatCurrency(summaryMetrics.approvedBudget) 
                    : "—" 
                },
                { 
                  title: projectFilter === "all" ? "Actual Cost to Date" : "Actual Cost to Date (Project-scoped)", 
                  value: summaryMetrics.actualCost !== null 
                    ? formatCurrency(summaryMetrics.actualCost) 
                    : "—" 
                },
                { 
                  title: projectFilter === "all" ? "Remaining Commitments" : "Remaining Commitments (Project-scoped)", 
                  value: summaryMetrics.remainingCommitments !== null 
                    ? formatCurrency(summaryMetrics.remainingCommitments) 
                    : "—" 
                },
                { 
                  title: projectFilter === "all" ? "Forecast Final Cost" : "Forecast Final Cost (Project-scoped)", 
                  value: summaryMetrics.forecastFinalCost !== null 
                    ? formatCurrency(summaryMetrics.forecastFinalCost) 
                    : isMigrationMissing 
                      ? "—" 
                      : "— / Incomplete forecast coverage" 
                },
                { 
                  title: projectFilter === "all" ? "Projected Profit or Loss" : "Projected Profit or Loss (Project-scoped)", 
                  value: summaryMetrics.projectedProfit !== null 
                    ? formatCurrency(summaryMetrics.projectedProfit) 
                    : isMigrationMissing 
                      ? "—" 
                      : "— / Incomplete forecast coverage", 
                  highlight: summaryMetrics.projectedProfit !== null && summaryMetrics.projectedProfit < 0 
                }
              ].map((card, idx) => {
                return (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-150 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {card.title}
                    </span>
                    <span className={`text-lg font-black tracking-tight block ${card.highlight ? "text-red-600" : "text-slate-800"}`}>
                      {card.value}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Nested Sub-tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setBudgetSubTab("budgets")}
                className={`px-4 py-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all ${
                  budgetSubTab === "budgets" ? "border-[#FF9F1C] text-[#07182E]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Budget Baselines
              </button>
              <button
                onClick={() => setBudgetSubTab("forecasts")}
                className={`px-4 py-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all ${
                  budgetSubTab === "forecasts" ? "border-[#FF9F1C] text-[#07182E]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Project Financial Forecasts
              </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full max-w-xl">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder={budgetSubTab === "budgets" ? "Search budget versions..." : "Search forecasts..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#07182E]/20"
                  />
                </div>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 max-w-[150px] focus:outline-none"
                >
                  <option value="all">All Projects</option>
                  {allProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 max-w-[150px] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <button
                onClick={() => handleOpenModal(budgetSubTab === "budgets" ? "budget" : "forecast")}
                className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                {budgetSubTab === "budgets" ? "Create Budget Version" : "Create Financial Forecast"}
              </button>
            </div>

            {/* Table */}
            {budgetSubTab === "budgets" ? (
              <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        {["Version / ID", "Project", "Status", "Effective Date", "Budget Excl. VAT", "Approved Variations", "Total Budget", "Actions"].map((th) => (
                          <th key={th} className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                            {th}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {budgets
                        .filter((b) => {
                          const matchesSearch = b.version_label.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesProj = projectFilter === "all" || b.project_id === projectFilter;
                          const matchesStatus = statusFilter === "all" || b.status === statusFilter;
                          return matchesSearch && matchesProj && matchesStatus;
                        })
                        .map((b) => {
                          const proj = allProjects.find((p: any) => p.id === b.project_id);
                          const total = (b.original_budget_excl_vat || 0) + (b.approved_variations_excl_vat || 0);
                          return (
                            <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                              <td className="px-5 py-3">
                                <span className="font-extrabold text-[#07182E]">{b.version_label}</span>
                                {b.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                              </td>
                              <td className="px-5 py-3 text-slate-500">{proj ? proj.name : "Unknown Project"}</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  b.status === "Approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  b.status === "Submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                  b.status === "Rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                                  b.status === "Cancelled" ? "bg-gray-100 text-gray-700 border border-gray-200" :
                                  "bg-slate-50 text-slate-600 border border-slate-150"
                                }`}>
                                  {b.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-slate-500 font-mono">{b.effective_date}</td>
                              <td className="px-5 py-3 text-slate-700 font-mono">{formatCurrency(b.original_budget_excl_vat)}</td>
                              <td className="px-5 py-3 text-slate-700 font-mono">{formatCurrency(b.approved_variations_excl_vat)}</td>
                              <td className="px-5 py-3 font-extrabold text-[#07182E] font-mono">{formatCurrency(total)}</td>
                              <td className="px-5 py-3 flex items-center gap-1">
                                {b.status === "Draft" && (
                                  <button
                                    onClick={() => handleBudgetTransition(b.id, "submit")}
                                    className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] uppercase px-2"
                                  >
                                    Submit
                                  </button>
                                )}
                                {b.status === "Submitted" && (
                                  <>
                                    <button
                                      onClick={() => handleBudgetTransition(b.id, "approve")}
                                      className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleBudgetTransition(b.id, "reject")}
                                      className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] uppercase px-2"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {b.status === "Approved" && (
                                  <button
                                    onClick={() => handleBudgetTransition(b.id, "cancel")}
                                    className="p-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 font-bold text-[10px] uppercase px-2"
                                  >
                                    Cancel
                                  </button>
                                )}
                                {!b.is_archived ? (
                                  <button
                                    onClick={() => handleBudgetTransition(b.id, "archive")}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleBudgetTransition(b.id, "restore")}
                                    className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                  >
                                    Restore
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      {budgets.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-5 py-12 text-center text-xs text-slate-400">
                            {renderEmptyState({
                              icon: PiggyBank,
                              title: "No budget versions found",
                              description: "Approved project budgets, revisions and forecasts will appear here once financial persistence is enabled.",
                              addButtonLabel: "Create Budget Version",
                              modalType: "budget"
                            })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100">
                        {["Version Label", "Project", "Status", "As Of Date", "Forecast Revenue", "Estimate To Complete", "Actions"].map((th) => (
                          <th key={th} className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                            {th}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {forecasts
                        .filter((f) => {
                          const matchesSearch = f.version_label.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesProj = projectFilter === "all" || f.project_id === projectFilter;
                          const matchesStatus = statusFilter === "all" || f.status === statusFilter;
                          return matchesSearch && matchesProj && matchesStatus;
                        })
                        .map((f) => {
                          const proj = allProjects.find((p: any) => p.id === f.project_id);
                          return (
                            <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                              <td className="px-5 py-3">
                                <span className="font-extrabold text-[#07182E]">{f.version_label}</span>
                                {f.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                              </td>
                              <td className="px-5 py-3 text-slate-500">{proj ? proj.name : "Unknown Project"}</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  f.status === "Approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  f.status === "Submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                  f.status === "Rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                                  "bg-slate-50 text-slate-600 border border-slate-150"
                                }`}>
                                  {f.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-slate-500 font-mono">{f.as_of_date}</td>
                              <td className="px-5 py-3 text-slate-700 font-mono">{formatCurrency(f.forecast_contract_revenue_excl_vat)}</td>
                              <td className="px-5 py-3 text-slate-700 font-mono font-extrabold">{formatCurrency(f.uncommitted_estimate_to_complete_excl_vat)}</td>
                              <td className="px-5 py-3 flex items-center gap-1">
                                {f.status === "Draft" && (
                                  <button
                                    onClick={() => handleForecastTransition(f.id, "submit")}
                                    className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] uppercase px-2"
                                  >
                                    Submit
                                  </button>
                                )}
                                {f.status === "Submitted" && (
                                  <>
                                    <button
                                      onClick={() => handleForecastTransition(f.id, "approve")}
                                      className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleForecastTransition(f.id, "reject")}
                                      className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] uppercase px-2"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {!f.is_archived ? (
                                  <button
                                    onClick={() => handleForecastTransition(f.id, "archive")}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleForecastTransition(f.id, "restore")}
                                    className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                  >
                                    Restore
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      {forecasts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-xs text-slate-400">
                            {renderEmptyState({
                              icon: Clock,
                              title: "No forecasts found",
                              description: "Establish project financial forecasts to anticipate cost and estimate to complete projections.",
                              addButtonLabel: "Create Financial Forecast",
                              modalType: "forecast"
                            })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: COMMITMENTS ==================== */}
        {activeTab === "commitments" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: projectFilter === "all" ? "Approved Commitments" : "Approved Commitments (Project-scoped)", value: formatCurrency(commitmentMetrics.approved) },
                { title: projectFilter === "all" ? "Recognized Cost" : "Recognized Cost (Project-scoped)", value: formatCurrency(commitmentMetrics.recognized) },
                { title: projectFilter === "all" ? "Remaining Commitments" : "Remaining Commitments (Project-scoped)", value: formatCurrency(commitmentMetrics.remaining) },
                { title: projectFilter === "all" ? "Commitments Requiring Attention" : "Commitments Requiring Attention (Project-scoped)", value: commitmentMetrics.attentionCount.toString(), highlight: commitmentMetrics.attentionCount > 0 }
              ].map((card, idx) => (
                <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-150 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {card.title}
                  </span>
                  <span className={`text-lg font-black tracking-tight block ${card.highlight ? "text-red-600" : "text-slate-800"}`}>
                    {card.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full max-w-xl">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search commitments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#07182E]/20"
                  />
                </div>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="all">All Projects</option>
                  {allProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Closed">Closed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <button
                onClick={() => handleOpenModal("commitment")}
                className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Commitment
              </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      {["Reference", "Type", "Project", "Supplier / Subcontractor", "Revised Commitment", "Recognized Cost", "Remaining Commitment", "Status", "Actions"].map((th) => (
                        <th key={th} className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          {th}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commitments
                      .filter((c) => {
                        const matchesSearch = c.commitment_reference.toLowerCase().includes(searchQuery.toLowerCase()) || (c.counterparty_name || "").toLowerCase().includes(searchQuery.toLowerCase());
                        const matchesProj = projectFilter === "all" || c.project_id === projectFilter;
                        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
                        return matchesSearch && matchesProj && matchesStatus;
                      })
                      .map((c) => {
                        const proj = allProjects.find((p: any) => p.id === c.project_id);
                        const revised = (c.original_amount_excl_vat || 0) + (c.approved_variations_excl_vat || 0);
                        const remaining = revised - (c.recognized_cost_excl_vat || 0);
                        return (
                          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                            <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                              {c.commitment_reference}
                              {c.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                            </td>
                            <td className="px-5 py-3 text-slate-500">{c.commitment_type}</td>
                            <td className="px-5 py-3 text-slate-500">{proj ? proj.name : "Unknown Project"}</td>
                            <td className="px-5 py-3 text-slate-600 font-semibold">{c.counterparty_name}</td>
                            <td className="px-5 py-3 font-mono text-slate-700">{formatCurrency(revised)}</td>
                            <td className="px-5 py-3 font-mono text-slate-700">{formatCurrency(c.recognized_cost_excl_vat || 0)}</td>
                            <td className="px-5 py-3 font-mono font-extrabold text-slate-800">{formatCurrency(remaining)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === "Approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                c.status === "Submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                c.status === "Rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                                c.status === "Closed" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                                c.status === "Cancelled" ? "bg-gray-550 text-gray-700 border border-gray-200" :
                                "bg-slate-50 text-slate-600"
                              }`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 flex items-center gap-1">
                              {c.status === "Draft" && (
                                <button
                                  onClick={() => handleCommitmentTransition(c.id, "submit")}
                                  className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] uppercase px-2"
                                >
                                  Submit
                                </button>
                              )}
                              {c.status === "Submitted" && (
                                <>
                                  <button
                                    onClick={() => handleCommitmentTransition(c.id, "approve")}
                                    className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleCommitmentTransition(c.id, "reject")}
                                    className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] uppercase px-2"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {c.status === "Approved" && (
                                <>
                                  <button
                                    onClick={() => handleCommitmentTransition(c.id, "close")}
                                    className="p-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 font-bold text-[10px] uppercase px-2"
                                  >
                                    Close
                                  </button>
                                  <button
                                    onClick={() => handleCommitmentTransition(c.id, "cancel")}
                                    className="p-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 font-bold text-[10px] uppercase px-2"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              {!c.is_archived ? (
                                <button
                                  onClick={() => handleCommitmentTransition(c.id, "archive")}
                                  className="p-1 text-slate-400 hover:text-slate-600"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleCommitmentTransition(c.id, "restore")}
                                  className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                >
                                  Restore
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {commitments.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-5 py-12 text-center text-xs text-slate-400">
                          {renderEmptyState({
                            icon: SlidersHorizontal,
                            title: "No commitments found",
                            description: "Approved purchase orders, subcontracts and variations will appear here once financial persistence is enabled.",
                            addButtonLabel: "Add Commitment",
                            modalType: "commitment"
                          })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: ACTUAL COSTS ==================== */}
        {activeTab === "actuals" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: projectFilter === "all" ? "Posted Actual Costs" : "Posted Actual Costs (Project-scoped)", value: formatCurrency(costMetrics.posted) },
                { title: projectFilter === "all" ? "Draft Cost Entries" : "Draft Cost Entries (Project-scoped)", value: formatCurrency(costMetrics.draft) },
                { title: projectFilter === "all" ? "Reversals (Count)" : "Reversals (Count) (Project-scoped)", value: costMetrics.reversalCount.toString(), highlight: costMetrics.reversalCount > 0 },
                { title: projectFilter === "all" ? "Current Period Cost" : "Current Period Cost (Project-scoped)", value: formatCurrency(costMetrics.currentPeriod) }
              ].map((card, idx) => (
                <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-150 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {card.title}
                  </span>
                  <span className={`text-lg font-black tracking-tight block ${card.highlight ? "text-amber-600" : "text-slate-800"}`}>
                    {card.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Permanent Info Note */}
            <div className="p-4 bg-amber-50/60 border border-amber-100 text-amber-800 text-xs rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
              <span>
                <strong>Note:</strong> Posted financial records will use reversals rather than silent editing once backend posting controls are enabled.
              </span>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full max-w-xl">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search actual costs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#07182E]/20"
                  />
                </div>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="all">All Projects</option>
                  {allProjects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Posted">Posted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Reversed">Reversed</option>
                </select>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleExportActualCostsCsv}
                  disabled={actualCosts.length === 0}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title="Export actual costs ledger to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  Export CSV
                </button>
                <button
                  onClick={() => handleOpenModal("actual")}
                  className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Record Actual Cost
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      {["Posting Reference", "Posting Date", "Project", "Source", "Cost Category", "Description", "Amount Excl. VAT", "Status", "Actions"].map((th) => (
                        <th key={th} className="px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          {th}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {actualCosts
                      .filter((c) => {
                        const matchesSearch = c.posting_reference.toLowerCase().includes(searchQuery.toLowerCase()) || (c.description || "").toLowerCase().includes(searchQuery.toLowerCase());
                        const matchesProj = projectFilter === "all" || c.project_id === projectFilter;
                        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
                        return matchesSearch && matchesProj && matchesStatus;
                      })
                      .map((c) => {
                        const proj = allProjects.find((p: any) => p.id === c.project_id);
                        return (
                          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                            <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                              {c.posting_reference}
                              {c.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                            </td>
                            <td className="px-5 py-3 text-slate-500 font-mono">{c.posting_date}</td>
                            <td className="px-5 py-3 text-slate-500">{proj ? proj.name : "Unknown Project"}</td>
                            <td className="px-5 py-3 text-slate-600">{c.source_type}</td>
                            <td className="px-5 py-3 text-slate-600 font-semibold">{c.cost_category}</td>
                            <td className="px-5 py-3 text-slate-500 truncate max-w-[150px]">{c.description || "—"}</td>
                            <td className="px-5 py-3 font-mono font-extrabold text-slate-800">{formatCurrency(c.amount_excl_vat)}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.status === "Posted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                c.status === "Submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                c.status === "Rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                                c.status === "Reversed" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                "bg-slate-50 text-slate-600"
                              }`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 flex items-center gap-1">
                              {c.status === "Draft" && (
                                <button
                                  onClick={() => handleCostTransition(c.id, "submit")}
                                  className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] uppercase px-2"
                                >
                                  Submit
                                </button>
                              )}
                              {c.status === "Submitted" && (
                                <>
                                  <button
                                    onClick={() => handleCostTransition(c.id, "post")}
                                    className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                  >
                                    Post
                                  </button>
                                  <button
                                    onClick={() => handleCostTransition(c.id, "reject")}
                                    className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] uppercase px-2"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {c.status === "Posted" && (
                                <button
                                  onClick={() => handleCostTransition(c.id, "reverse")}
                                  className="p-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 font-bold text-[10px] uppercase px-2"
                                >
                                  Reverse
                                </button>
                              )}
                              {!c.is_archived ? (
                                <button
                                  onClick={() => handleCostTransition(c.id, "archive")}
                                  className="p-1 text-slate-400 hover:text-slate-600"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleCostTransition(c.id, "restore")}
                                  className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                >
                                  Restore
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {actualCosts.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-5 py-12 text-center text-xs text-slate-400">
                          {renderEmptyState({
                            icon: SlidersHorizontal,
                            title: "No actual costs recorded",
                            description: "Direct expenses, overheads, supplier invoices and payroll items will register here after setup.",
                            addButtonLabel: "Record Actual Cost",
                            modalType: "actual"
                          })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: CLIENT ACCOUNTS ==================== */}
        {activeTab === "client" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Nested Tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none">
              {([
                { id: "contracts", label: "Clients & Contracts" },
                { id: "invoices", label: "Invoices & Credit Notes" },
                { id: "receipts", label: "Receipts & Allocations" }
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setClientSubTab(tab.id as any)}
                  className={`px-4 py-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all ${
                    clientSubTab === tab.id
                      ? "border-[#FF9F1C] text-[#07182E]"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab 1: Clients & Contracts */}
            {clientSubTab === "contracts" && (
              <div className="space-y-8">
                {/* 1. Client Accounts */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-[#07182E]">Client Accounts Registry</h3>
                      <p className="text-xs text-slate-500">Employers and clients master database records.</p>
                    </div>
                    <button
                      onClick={() => handleOpenModal("client_account")}
                      className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Client Account
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                            <th className="px-5 py-3">Account Code</th>
                            <th className="px-5 py-3">Client Name</th>
                            <th className="px-5 py-3">Contact Person</th>
                            <th className="px-5 py-3">Email / Phone</th>
                            <th className="px-5 py-3">Tax Number</th>
                            <th className="px-5 py-3">Payment Terms</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientAccounts
                            .filter(ca => ca.account_name.toLowerCase().includes(searchQuery.toLowerCase()) || ca.account_code.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(ca => (
                              <tr key={ca.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                                <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                                  {ca.account_code}
                                  {ca.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                                </td>
                                <td className="px-5 py-3 font-semibold text-[#07182E]">{ca.account_name}</td>
                                <td className="px-5 py-3 text-slate-600">{ca.contact_person || "—"}</td>
                                <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">
                                  {ca.email || "—"} {ca.phone ? `(${ca.phone})` : ""}
                                </td>
                                <td className="px-5 py-3 font-mono text-slate-600">{ca.vat_registration_number || ca.tax_number || "—"}</td>
                                <td className="px-5 py-3 text-slate-600">{ca.payment_terms_days} days</td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ca.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                                    {ca.is_active ? "Active" : "Inactive"}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  {!ca.is_archived ? (
                                    <button
                                      onClick={() => archiveRecord("client_accounts", ca.id).then(loadAllFinanceData)}
                                      className="p-1 text-slate-400 hover:text-slate-600"
                                      title="Archive Client"
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => restoreRecord("client_accounts", ca.id).then(loadAllFinanceData)}
                                      className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                    >
                                      Restore
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          {clientAccounts.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-5 py-12 text-center">
                                {renderEmptyState({
                                  icon: Users,
                                  title: "No client accounts found",
                                  description: "Register employers, developers and client accounts to associate project contracts.",
                                  addButtonLabel: "Create Client Account",
                                  modalType: "client_account"
                                })}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 2. Project Client Contracts */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-[#07182E]">Project Client Contracts</h3>
                      <p className="text-xs text-slate-500">Formal revenue contracts agreed with clients.</p>
                    </div>
                    <button
                      onClick={() => handleOpenModal("client_contract")}
                      className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Client Contract
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                            <th className="px-5 py-3">Contract Ref</th>
                            <th className="px-5 py-3">Client</th>
                            <th className="px-5 py-3">Project</th>
                            <th className="px-5 py-3">Contract Value (Excl. VAT)</th>
                            <th className="px-5 py-3">Start Date</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contracts
                            .filter(c => {
                              const matchesSearch = c.contract_reference.toLowerCase().includes(searchQuery.toLowerCase());
                              const matchesProj = projectFilter === "all" || c.project_id === projectFilter;
                              return matchesSearch && matchesProj;
                            })
                            .map(c => {
                              const client = clientAccounts.find(ca => ca.id === c.client_account_id);
                              const proj = allProjects.find((p: any) => p.id === c.project_id);
                              return (
                                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                                  <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                                    {c.contract_reference}
                                    {c.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                                  </td>
                                  <td className="px-5 py-3 font-semibold text-[#07182E]">{client ? client.account_name : "Unknown Client"}</td>
                                  <td className="px-5 py-3 text-slate-600">{proj ? proj.name : "Unknown Project"}</td>
                                  <td className="px-5 py-3 font-mono font-extrabold text-slate-800">
                                    {formatCurrency(c.agreed_contract_value_excl_vat)}
                                  </td>
                                  <td className="px-5 py-3 font-mono text-slate-500">{c.commencement_date || "—"}</td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      c.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                      c.status === "Closed" ? "bg-slate-100 text-slate-600" :
                                      c.status === "Cancelled" ? "bg-red-50 text-red-700 border border-red-200" :
                                      "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}>
                                      {c.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 flex items-center gap-1">
                                    {c.status === "Draft" && (
                                      <button
                                        onClick={() => handleContractTransition(c.id, "activate")}
                                        className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                      >
                                        Activate
                                      </button>
                                    )}
                                    {c.status === "Active" && (
                                      <>
                                        <button
                                          onClick={() => handleContractTransition(c.id, "close")}
                                          className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 font-bold text-[10px] uppercase px-2"
                                        >
                                          Close
                                        </button>
                                        <button
                                          onClick={() => handleContractTransition(c.id, "cancel")}
                                          className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] uppercase px-2"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    {!c.is_archived ? (
                                      <button
                                        onClick={() => handleContractTransition(c.id, "archive")}
                                        className="p-1 text-slate-400 hover:text-slate-600"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleContractTransition(c.id, "restore")}
                                        className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                      >
                                        Restore
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          {contracts.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-5 py-12 text-center">
                                {renderEmptyState({
                                  icon: FileText,
                                  title: "No client contracts found",
                                  description: "Record active client contracts and values to establish project revenue baselines.",
                                  addButtonLabel: "Create Client Contract",
                                  modalType: "client_contract"
                                })}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Invoices & Credit Notes */}
            {clientSubTab === "invoices" && (
              <div className="space-y-8">
                {/* 1. Client Tax Invoices */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-[#07182E]">Client Tax Invoices</h3>
                      <p className="text-xs text-slate-500">Issued tax invoices and outstanding balance ledger.</p>
                    </div>
                    <button
                      onClick={() => handleOpenModal("client_invoice")}
                      className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Client Invoice
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                            <th className="px-5 py-3">Invoice Ref</th>
                            <th className="px-5 py-3">Client</th>
                            <th className="px-5 py-3">Project</th>
                            <th className="px-5 py-3">Invoice Date</th>
                            <th className="px-5 py-3">Due Date</th>
                            <th className="px-5 py-3">Total Incl. VAT</th>
                            <th className="px-5 py-3">Outstanding</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientInvoices
                            .filter(i => {
                              const matchesSearch = i.invoice_reference.toLowerCase().includes(searchQuery.toLowerCase());
                              const matchesProj = projectFilter === "all" || i.project_id === projectFilter;
                              return matchesSearch && matchesProj;
                            })
                            .map(i => {
                              const client = clientAccounts.find(ca => ca.id === i.client_account_id);
                              const proj = allProjects.find((p: any) => p.id === i.project_id);

                              const issuedCNs = clientCreditNotes.filter(
                                cn => cn.invoice_id === i.id && cn.status === "Issued" && !cn.is_archived
                              );
                              const cnSum = issuedCNs.reduce((s, cn) => s + (cn.total_incl_vat || 0), 0);

                              const activeAllocations = clientReceiptAllocations.filter(
                                cra => cra.invoice_id === i.id && !cra.is_reversed && !cra.is_archived
                              );
                              const allocSum = activeAllocations.reduce((s, cra) => s + (cra.amount_allocated || 0), 0);

                              const outstanding = Math.max(0, (i.total_incl_vat || 0) - cnSum - allocSum);

                              return (
                                <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                                  <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                                    {i.invoice_reference}
                                    {i.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                                  </td>
                                  <td className="px-5 py-3 font-semibold text-[#07182E]">{client ? client.account_name : "Unknown Client"}</td>
                                  <td className="px-5 py-3 text-slate-600">{proj ? proj.name : "Unknown Project"}</td>
                                  <td className="px-5 py-3 font-mono text-slate-500">{i.invoice_date}</td>
                                  <td className="px-5 py-3 font-mono text-slate-500">{i.due_date}</td>
                                  <td className="px-5 py-3 font-mono font-extrabold text-slate-800">
                                    {formatCurrency(i.total_incl_vat)}
                                  </td>
                                  <td className="px-5 py-3 font-mono font-black text-[#FF9F1C]">
                                    {formatCurrency(outstanding)}
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      i.status === "Issued" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                      i.status === "Submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                      i.status === "Approved" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                      i.status === "Rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                                      i.status === "Cancelled" ? "bg-slate-100 text-slate-500" :
                                      "bg-slate-50 text-slate-600"
                                    }`}>
                                      {i.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 flex items-center gap-1">
                                    {i.status === "Draft" && (
                                      <button
                                        onClick={() => handleClientInvoiceTransition(i.id, "submit")}
                                        className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] uppercase px-2"
                                      >
                                        Submit
                                      </button>
                                    )}
                                    {i.status === "Submitted" && (
                                      <>
                                        <button
                                          onClick={() => handleClientInvoiceTransition(i.id, "approve")}
                                          className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleClientInvoiceTransition(i.id, "reject")}
                                          className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] uppercase px-2"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    {i.status === "Approved" && (
                                      <>
                                        <button
                                          onClick={() => handleClientInvoiceTransition(i.id, "issue")}
                                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold text-[10px] uppercase px-2"
                                        >
                                          Issue
                                        </button>
                                        <button
                                          onClick={() => handleClientInvoiceTransition(i.id, "cancel")}
                                          className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 font-bold text-[10px] uppercase px-2"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    {!i.is_archived ? (
                                      <button
                                        onClick={() => handleClientInvoiceTransition(i.id, "archive")}
                                        className="p-1 text-slate-400 hover:text-slate-600"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleClientInvoiceTransition(i.id, "restore")}
                                        className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                      >
                                        Restore
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          {clientInvoices.length === 0 && (
                            <tr>
                              <td colSpan={9} className="px-5 py-12 text-center">
                                {renderEmptyState({
                                  icon: FileText,
                                  title: "No client invoices generated",
                                  description: "Generate formal tax invoices to bill clients for completed project works.",
                                  addButtonLabel: "Create Client Invoice",
                                  modalType: "client_invoice"
                                })}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 2. Client Credit Notes */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-[#07182E]">Client Credit Notes</h3>
                      <p className="text-xs text-slate-500">Credit notes issued to adjust client invoice amounts.</p>
                    </div>
                    <button
                      onClick={() => handleOpenModal("client_credit_note")}
                      className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Credit Note
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                            <th className="px-5 py-3">Credit Ref</th>
                            <th className="px-5 py-3">Target Invoice</th>
                            <th className="px-5 py-3">Client</th>
                            <th className="px-5 py-3">Credit Date</th>
                            <th className="px-5 py-3">Reason</th>
                            <th className="px-5 py-3">Total Incl. VAT</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientCreditNotes
                            .filter(cn => cn.credit_note_reference.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(cn => {
                              const inv = clientInvoices.find(i => i.id === cn.invoice_id);
                              const client = clientAccounts.find(ca => ca.id === cn.client_account_id);
                              return (
                                <tr key={cn.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                                  <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                                    {cn.credit_note_reference}
                                    {cn.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                                  </td>
                                  <td className="px-5 py-3 font-mono text-slate-600">{inv ? inv.invoice_reference : "Unknown Invoice"}</td>
                                  <td className="px-5 py-3 text-slate-600">{client ? client.account_name : "Unknown Client"}</td>
                                  <td className="px-5 py-3 font-mono text-slate-500">{cn.credit_note_date}</td>
                                  <td className="px-5 py-3 text-slate-500 truncate max-w-[150px]">{cn.reason_description || "—"}</td>
                                  <td className="px-5 py-3 font-mono font-extrabold text-slate-800">
                                    {formatCurrency(cn.total_incl_vat)}
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      cn.status === "Issued" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                      cn.status === "Submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                      cn.status === "Approved" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                      cn.status === "Rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                                      "bg-slate-50 text-slate-600"
                                    }`}>
                                      {cn.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 flex items-center gap-1">
                                    {cn.status === "Draft" && (
                                      <button
                                        onClick={() => handleClientCreditNoteTransition(cn.id, "submit")}
                                        className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] uppercase px-2"
                                      >
                                        Submit
                                      </button>
                                    )}
                                    {cn.status === "Submitted" && (
                                      <>
                                        <button
                                          onClick={() => handleClientCreditNoteTransition(cn.id, "approve")}
                                          className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => handleClientCreditNoteTransition(cn.id, "reject")}
                                          className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] uppercase px-2"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    {cn.status === "Approved" && (
                                      <>
                                        <button
                                          onClick={() => handleClientCreditNoteTransition(cn.id, "issue")}
                                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold text-[10px] uppercase px-2"
                                        >
                                          Issue
                                        </button>
                                        <button
                                          onClick={() => handleClientCreditNoteTransition(cn.id, "cancel")}
                                          className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 font-bold text-[10px] uppercase px-2"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    {!cn.is_archived ? (
                                      <button
                                        onClick={() => handleClientCreditNoteTransition(cn.id, "archive")}
                                        className="p-1 text-slate-400 hover:text-slate-600"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleClientCreditNoteTransition(cn.id, "restore")}
                                        className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                      >
                                        Restore
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          {clientCreditNotes.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-5 py-12 text-center">
                                {renderEmptyState({
                                  icon: FileText,
                                  title: "No credit notes recorded",
                                  description: "Issue credit notes against client invoices to adjust liabilities.",
                                  addButtonLabel: "Create Credit Note",
                                  modalType: "client_credit_note"
                                })}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Receipts & Allocations */}
            {clientSubTab === "receipts" && (
              <div className="space-y-8">
                {/* 1. Client Cash Receipts */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-[#07182E]">Client Receipts</h3>
                      <p className="text-xs text-slate-500">Received cash payments and allocation status.</p>
                    </div>
                    <button
                      onClick={() => handleOpenModal("client_receipt")}
                      className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Record Client Receipt
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                            <th className="px-5 py-3">Receipt Ref</th>
                            <th className="px-5 py-3">Client</th>
                            <th className="px-5 py-3">Project</th>
                            <th className="px-5 py-3">Receipt Date</th>
                            <th className="px-5 py-3">Method</th>
                            <th className="px-5 py-3">Amount Received</th>
                            <th className="px-5 py-3">Allocated</th>
                            <th className="px-5 py-3">Unallocated</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientReceipts
                            .filter(r => {
                              const matchesSearch = r.receipt_reference.toLowerCase().includes(searchQuery.toLowerCase());
                              const matchesProj = projectFilter === "all" || r.project_id === projectFilter;
                              return matchesSearch && matchesProj;
                            })
                            .map(r => {
                              const client = clientAccounts.find(ca => ca.id === r.client_account_id);
                              const proj = allProjects.find((p: any) => p.id === r.project_id);

                              const activeAllocations = clientReceiptAllocations.filter(
                                cra => cra.receipt_id === r.id && !cra.is_reversed && !cra.is_archived
                              );
                              const allocatedSum = activeAllocations.reduce((s, cra) => s + (cra.amount_allocated || 0), 0);
                              const unallocated = Math.max(0, (r.amount_received || 0) - allocatedSum);

                              return (
                                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                                  <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                                    {r.receipt_reference}
                                    {r.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                                  </td>
                                  <td className="px-5 py-3 font-semibold text-[#07182E]">{client ? client.account_name : "Unknown Client"}</td>
                                  <td className="px-5 py-3 text-slate-600">{proj ? proj.name : "Unknown Project"}</td>
                                  <td className="px-5 py-3 font-mono text-slate-500">{r.receipt_date}</td>
                                  <td className="px-5 py-3 text-slate-600 font-semibold">{r.payment_method}</td>
                                  <td className="px-5 py-3 font-mono font-extrabold text-slate-800">
                                    {formatCurrency(r.amount_received)}
                                  </td>
                                  <td className="px-5 py-3 font-mono text-emerald-700 font-bold">
                                    {formatCurrency(allocatedSum)}
                                  </td>
                                  <td className="px-5 py-3 font-mono text-amber-700 font-bold">
                                    {formatCurrency(unallocated)}
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      r.status === "Posted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                      r.status === "Reversed" ? "bg-red-50 text-red-700 border border-red-200" :
                                      r.status === "Cancelled" ? "bg-slate-100 text-slate-500" :
                                      "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}>
                                      {r.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 flex items-center gap-1">
                                    {r.status === "Draft" && (
                                      <>
                                        <button
                                          onClick={() => handleClientReceiptTransition(r.id, "post")}
                                          className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                        >
                                          Post
                                        </button>
                                        <button
                                          onClick={() => handleClientReceiptTransition(r.id, "cancel")}
                                          className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 font-bold text-[10px] uppercase px-2"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    )}
                                    {r.status === "Posted" && (
                                      <>
                                        {unallocated > 0 && (
                                          <button
                                            onClick={() => {
                                              setFormValues({ receipt_id: r.id });
                                              handleOpenModal("receipt_allocation");
                                            }}
                                            className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-[10px] uppercase px-2"
                                          >
                                            Allocate
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleClientReceiptTransition(r.id, "reverse")}
                                          className="p-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 font-bold text-[10px] uppercase px-2"
                                        >
                                          Reverse
                                        </button>
                                      </>
                                    )}
                                    {!r.is_archived ? (
                                      <button
                                        onClick={() => handleClientReceiptTransition(r.id, "archive")}
                                        className="p-1 text-slate-400 hover:text-slate-600"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleClientReceiptTransition(r.id, "restore")}
                                        className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                      >
                                        Restore
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          {clientReceipts.length === 0 && (
                            <tr>
                              <td colSpan={10} className="px-5 py-12 text-center">
                                {renderEmptyState({
                                  icon: Coins,
                                  title: "No client receipts found",
                                  description: "Record bank payments received from clients.",
                                  addButtonLabel: "Record Client Receipt",
                                  modalType: "client_receipt"
                                })}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 2. Receipt Allocations Ledger */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-[#07182E]">Receipt Allocations Ledger</h3>
                      <p className="text-xs text-slate-500">Allocations linking cash receipts to issued invoices.</p>
                    </div>
                    <button
                      onClick={() => handleOpenModal("receipt_allocation")}
                      className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Allocate Receipt
                    </button>
                  </div>

                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                            <th className="px-5 py-3">Receipt Ref</th>
                            <th className="px-5 py-3">Invoice Ref</th>
                            <th className="px-5 py-3">Amount Allocated</th>
                            <th className="px-5 py-3">Allocation Date</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientReceiptAllocations.map(cra => {
                            const r = clientReceipts.find(rec => rec.id === cra.receipt_id);
                            const i = clientInvoices.find(inv => inv.id === cra.invoice_id);
                            return (
                              <tr key={cra.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                                <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                                  {r ? r.receipt_reference : "Unknown Receipt"}
                                  {cra.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                                </td>
                                <td className="px-5 py-3 font-mono font-bold text-slate-700">{i ? i.invoice_reference : "Unknown Invoice"}</td>
                                <td className="px-5 py-3 font-mono font-extrabold text-emerald-700">
                                  {formatCurrency(cra.amount_allocated)}
                                </td>
                                <td className="px-5 py-3 font-mono text-slate-500">{cra.allocation_date}</td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    cra.is_reversed ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}>
                                    {cra.is_reversed ? "Reversed" : "Active"}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  {!cra.is_reversed && (
                                    <button
                                      onClick={() => handleAllocationTransition(cra.id, "reverse")}
                                      className="p-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 font-bold text-[10px] uppercase px-2"
                                    >
                                      Reverse
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {clientReceiptAllocations.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">
                                No receipt allocations recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 6: SUPPLIER ACCOUNTS ==================== */}
        {activeTab === "supplier" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Nested Subtabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none">
              {([
                { id: "directory", label: "Supplier Directory" },
                { id: "invoices", label: "Supplier Invoices" },
                { id: "credit_notes", label: "Credit Notes" },
                { id: "payments", label: "Payments & Allocations" },
                { id: "audit", label: "Audit & Documents" }
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSupplierSubTab(tab.id as any)}
                  className={`px-4 py-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all ${
                    supplierSubTab === tab.id
                      ? "border-[#FF9F1C] text-[#07182E]"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 1. SUPPLIER DIRECTORY */}
            {supplierSubTab === "directory" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Supplier & Subcontractor Directory</h3>
                    <p className="text-xs text-slate-500">Master register of active vendors, payment terms and live liability balances.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingSupplierAccount(null);
                      handleOpenModal("supplier_account");
                    }}
                    className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FF9F1C]" />
                    Add Supplier Account
                  </button>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                          <th className="px-5 py-3">Code</th>
                          <th className="px-5 py-3">Legal & Trading Name</th>
                          <th className="px-5 py-3">Reg & VAT #</th>
                          <th className="px-5 py-3">Contact Person</th>
                          <th className="px-5 py-3">Terms</th>
                          <th className="px-5 py-3 text-right">Current Balance</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierAccounts.map((sup) => (
                          <tr key={sup.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs transition-colors">
                            <td className="px-5 py-3.5 font-mono font-bold text-[#07182E]">
                              {sup.supplier_code}
                              {sup.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-[#07182E]">{sup.legal_name}</div>
                              {sup.trading_name && <div className="text-[11px] text-slate-400">t/a {sup.trading_name}</div>}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px]">
                              <div>Reg: {sup.registration_number || "N/A"}</div>
                              <div>VAT: {sup.vat_number || "N/A"}</div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              <div>{sup.contact_person || "N/A"}</div>
                              <div className="text-[11px] text-slate-400">{sup.email || sup.telephone || "No contact info"}</div>
                            </td>
                            <td className="px-5 py-3.5 font-bold text-slate-700">{sup.payment_terms_days} Days</td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-[#07182E]">
                              {formatCurrency(sup.current_balance || 0)}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                sup.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}>
                                {sup.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingSupplierAccount(sup);
                                    setFormValues({
                                      supplier_code: sup.supplier_code,
                                      legal_name: sup.legal_name,
                                      trading_name: sup.trading_name || "",
                                      registration_number: sup.registration_number || "",
                                      vat_number: sup.vat_number || "",
                                      contact_person: sup.contact_person || "",
                                      email: sup.email || "",
                                      telephone: sup.telephone || "",
                                      physical_address: sup.physical_address || "",
                                      payment_terms_days: sup.payment_terms_days.toString(),
                                      bank_name: sup.bank_details?.bank_name || "",
                                      branch_code: sup.bank_details?.branch_code || "",
                                      account_number: sup.bank_details?.account_number || "",
                                      notes: sup.notes || ""
                                    });
                                    handleOpenModal("supplier_account");
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                  title="Edit Supplier"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {sup.is_active ? (
                                  <button
                                    onClick={() => setSupplierActionPrompt({ type: "deactivate_supplier", id: sup.id, version: sup.version })}
                                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[10px] font-bold"
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSupplierAccountAction(sup.id, "activate", sup.version)}
                                    className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold"
                                  >
                                    Activate
                                  </button>
                                )}
                                {!sup.is_archived ? (
                                  <button
                                    onClick={() => handleSupplierAccountAction(sup.id, "archive")}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                    title="Archive"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSupplierAccountAction(sup.id, "restore")}
                                    className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded"
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {supplierAccounts.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-5 py-12 text-center">
                              {renderEmptyState({
                                icon: Layers,
                                title: "No supplier accounts registered",
                                description: "Add vendor and subcontractor master profiles to track claims and invoices.",
                                addButtonLabel: "Add Supplier Account",
                                modalType: "supplier_account"
                              })}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. SUPPLIER INVOICES */}
            {supplierSubTab === "invoices" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Accounts Payable Invoice Ledger</h3>
                    <p className="text-xs text-slate-500">Capture, approve and post vendor material invoices and subcontract pay-valuations.</p>
                  </div>
                  <button onClick={() => handleOpenModal("supplier_invoice")} className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all">
                    <Plus className="w-3.5 h-3.5 text-[#FF9F1C]" />
                    Add Supplier Invoice
                  </button>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                          <th className="px-5 py-3">Invoice #</th>
                          <th className="px-5 py-3">Supplier</th>
                          <th className="px-5 py-3">Project</th>
                          <th className="px-5 py-3">Dates</th>
                          <th className="px-5 py-3 text-right">Total Incl. VAT</th>
                          <th className="px-5 py-3 text-right">Outstanding</th>
                          <th className="px-5 py-3">Approval</th>
                          <th className="px-5 py-3">Payment</th>
                          <th className="px-5 py-3 text-right">Workflow Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierInvoices.map((inv) => {
                          const sup = supplierAccounts.find(s => s.id === inv.supplier_account_id);
                          const proj = allProjects.find((p: any) => p.id === inv.project_id);
                          return (
                            <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs transition-colors">
                              <td className="px-5 py-3.5 font-mono font-bold text-[#07182E]">
                                {inv.supplier_invoice_number}
                                {inv.external_reference && <div className="text-[10px] text-slate-400 font-sans">Ref: {inv.external_reference}</div>}
                                {inv.is_archived && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black block w-max mt-0.5">ARCHIVED</span>}
                              </td>
                              <td className="px-5 py-3.5 font-bold text-slate-800">{sup ? sup.legal_name : "Unknown Supplier"}</td>
                              <td className="px-5 py-3.5 text-slate-600">{proj ? proj.name : "N/A"}</td>
                              <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                                <div>Inv: {inv.invoice_date}</div>
                                <div>Due: {inv.due_date}</div>
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold text-[#07182E]">
                                {formatCurrency(inv.total_incl_vat || 0)}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono font-extrabold text-amber-700">
                                {formatCurrency(inv.outstanding_balance || 0)}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  inv.status === "Draft" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                                  inv.status === "Submitted" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  inv.status === "Approved" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                  inv.status === "Posted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  inv.status === "Rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                                  "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  inv.payment_status === "Paid" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  inv.payment_status === "Partially Paid" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  inv.payment_status === "Overpaid" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                  "bg-slate-100 text-slate-500 border border-slate-200"
                                }`}>
                                  {inv.payment_status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                  {inv.status === "Draft" && (
                                    <>
                                      <button onClick={() => handleSupplierInvoiceAction(inv.id, "submit", inv.version)} className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px]">Submit</button>
                                      <button onClick={() => setSupplierActionPrompt({ type: "cancel_invoice", id: inv.id, version: inv.version })} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-bold text-[10px]">Cancel</button>
                                    </>
                                  )}
                                  {inv.status === "Submitted" && (
                                    <>
                                      <button onClick={() => handleSupplierInvoiceAction(inv.id, "approve", inv.version)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px]">Approve</button>
                                      <button onClick={() => setSupplierActionPrompt({ type: "reject_invoice", id: inv.id, version: inv.version })} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded font-bold text-[10px]">Reject</button>
                                    </>
                                  )}
                                  {inv.status === "Approved" && (
                                    <>
                                      <button onClick={() => handleSupplierInvoiceAction(inv.id, "post", inv.version)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px]">Post</button>
                                      <button onClick={() => setSupplierActionPrompt({ type: "cancel_invoice", id: inv.id, version: inv.version })} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-bold text-[10px]">Cancel</button>
                                    </>
                                  )}
                                  {!inv.is_archived ? (
                                    <button onClick={() => handleSupplierInvoiceAction(inv.id, "archive", inv.version)} className="p-1 text-slate-400 hover:text-slate-600 rounded" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                                  ) : (
                                    <button onClick={() => handleSupplierInvoiceAction(inv.id, "restore", inv.version)} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded">Restore</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {supplierInvoices.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-5 py-12 text-center">
                              {renderEmptyState({
                                icon: FileText,
                                title: "No supplier invoices captured",
                                description: "Capture subcontract pay-valuation sheets and supplier material delivery invoices.",
                                addButtonLabel: "Add Supplier Invoice",
                                modalType: "supplier_invoice"
                              })}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. CREDIT NOTES */}
            {supplierSubTab === "credit_notes" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Vendor Credit Notes Register</h3>
                    <p className="text-xs text-slate-500">Record supplier credit adjustments to correct errors or return damaged materials.</p>
                  </div>
                  <button onClick={() => handleOpenModal("supplier_credit")} className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all">
                    <Plus className="w-3.5 h-3.5 text-[#FF9F1C]" />
                    Add Supplier Credit Note
                  </button>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                          <th className="px-5 py-3">Credit Note #</th>
                          <th className="px-5 py-3">Supplier</th>
                          <th className="px-5 py-3">Related Invoice</th>
                          <th className="px-5 py-3">Date & Reason</th>
                          <th className="px-5 py-3 text-right">Amount Incl. VAT</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Workflow Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierCreditNotes.map((cn) => {
                          const sup = supplierAccounts.find(s => s.id === cn.supplier_account_id);
                          const inv = supplierInvoices.find(i => i.id === cn.invoice_id);
                          return (
                            <tr key={cn.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs transition-colors">
                              <td className="px-5 py-3.5 font-mono font-bold text-[#07182E]">
                                {cn.credit_note_number}
                                {cn.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                              </td>
                              <td className="px-5 py-3.5 font-bold text-slate-800">{sup ? sup.legal_name : "Unknown Supplier"}</td>
                              <td className="px-5 py-3.5 font-mono text-slate-600">{inv ? inv.supplier_invoice_number : "N/A"}</td>
                              <td className="px-5 py-3.5 text-slate-600">
                                <div className="font-mono text-[11px]">{cn.credit_note_date}</div>
                                <div className="text-[11px] text-slate-400">{cn.reason}</div>
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-700">
                                {formatCurrency(cn.total_incl_vat || 0)}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  cn.status === "Draft" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                                  cn.status === "Submitted" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                  cn.status === "Approved" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                  cn.status === "Posted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  cn.status === "Rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                                  "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                  {cn.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                  {cn.status === "Draft" && (
                                    <button onClick={() => handleSupplierCreditAction(cn.id, "submit", cn.version)} className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px]">Submit</button>
                                  )}
                                  {cn.status === "Submitted" && (
                                    <>
                                      <button onClick={() => handleSupplierCreditAction(cn.id, "approve", cn.version)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px]">Approve</button>
                                      <button onClick={() => setSupplierActionPrompt({ type: "reject_credit", id: cn.id, version: cn.version })} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded font-bold text-[10px]">Reject</button>
                                    </>
                                  )}
                                  {cn.status === "Approved" && (
                                    <button onClick={() => handleSupplierCreditAction(cn.id, "post", cn.version)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px]">Post</button>
                                  )}
                                  {!cn.is_archived ? (
                                    <button onClick={() => handleSupplierCreditAction(cn.id, "archive", cn.version)} className="p-1 text-slate-400 hover:text-slate-600 rounded" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                                  ) : (
                                    <button onClick={() => handleSupplierCreditAction(cn.id, "restore", cn.version)} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded">Restore</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {supplierCreditNotes.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-5 py-12 text-center">
                              {renderEmptyState({
                                icon: SlidersHorizontal,
                                title: "No credit notes recorded",
                                description: "Adjust vendor liabilities due to return items or material delivery issues.",
                                addButtonLabel: "Add Supplier Credit Note",
                                modalType: "supplier_credit"
                              })}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 4. PAYMENTS & ALLOCATIONS */}
            {supplierSubTab === "payments" && (
              <div className="space-y-8">
                {/* Section A: Supplier Payments */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Accounts Payable Cash Outflows</h3>
                      <p className="text-xs text-slate-500">Log bank EFT payments and reconcile against outstanding supplier accounts.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleOpenModal("supplier_allocation")} className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all">
                        <Plus className="w-3.5 h-3.5 text-[#FF9F1C]" />
                        Allocate Payment
                      </button>
                      <button onClick={() => handleOpenModal("supplier_payment")} className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all">
                        <Plus className="w-3.5 h-3.5 text-[#FF9F1C]" />
                        Record Supplier Payment
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                            <th className="px-5 py-3">Payment Ref</th>
                            <th className="px-5 py-3">Supplier</th>
                            <th className="px-5 py-3">Date & Method</th>
                            <th className="px-5 py-3 text-right">Amount Paid</th>
                            <th className="px-5 py-3 text-right">Allocated</th>
                            <th className="px-5 py-3 text-right">Unallocated</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Workflow Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierPayments.map((pay) => {
                            const sup = supplierAccounts.find(s => s.id === pay.supplier_account_id);
                            return (
                              <tr key={pay.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs transition-colors">
                                <td className="px-5 py-3.5 font-mono font-bold text-[#07182E]">
                                  {pay.payment_reference}
                                  {pay.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black">ARCHIVED</span>}
                                </td>
                                <td className="px-5 py-3.5 font-bold text-slate-800">{sup ? sup.legal_name : "Unknown Supplier"}</td>
                                <td className="px-5 py-3.5 text-slate-600">
                                  <div className="font-mono text-[11px]">{pay.payment_date}</div>
                                  <div className="text-[11px] text-slate-400">{pay.payment_method}</div>
                                </td>
                                <td className="px-5 py-3.5 text-right font-mono font-bold text-[#07182E]">
                                  {formatCurrency(pay.amount_paid || 0)}
                                </td>
                                <td className="px-5 py-3.5 text-right font-mono text-emerald-700">
                                  {formatCurrency(pay.amount_allocated || 0)}
                                </td>
                                <td className="px-5 py-3.5 text-right font-mono font-bold text-amber-700">
                                  {formatCurrency(pay.unallocated_amount || 0)}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    pay.status === "Draft" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                                    pay.status === "Submitted" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                    pay.status === "Approved" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                    pay.status === "Posted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                    pay.status === "Reversed" ? "bg-red-50 text-red-700 border border-red-200" :
                                    "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}>
                                    {pay.status}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1 flex-wrap">
                                    {pay.status === "Draft" && (
                                      <button onClick={() => handleSupplierPaymentAction(pay.id, "submit", pay.version)} className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px]">Submit</button>
                                    )}
                                    {pay.status === "Submitted" && (
                                      <button onClick={() => handleSupplierPaymentAction(pay.id, "approve", pay.version)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px]">Approve</button>
                                    )}
                                    {pay.status === "Approved" && (
                                      <button onClick={() => handleSupplierPaymentAction(pay.id, "post", pay.version)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px]">Post</button>
                                    )}
                                    {pay.status === "Posted" && (
                                      <button onClick={() => setSupplierActionPrompt({ type: "reverse_payment", id: pay.id, version: pay.version })} className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-bold text-[10px]">Reverse</button>
                                    )}
                                    {!pay.is_archived ? (
                                      <button onClick={() => handleSupplierPaymentAction(pay.id, "archive", pay.version)} className="p-1 text-slate-400 hover:text-slate-600 rounded" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                                    ) : (
                                      <button onClick={() => handleSupplierPaymentAction(pay.id, "restore", pay.version)} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded">Restore</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {supplierPayments.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-5 py-12 text-center">
                                {renderEmptyState({
                                  icon: Coins,
                                  title: "No supplier payments recorded",
                                  description: "Track cleared payments matching bank statements to suppliers.",
                                  addButtonLabel: "Record Supplier Payment",
                                  modalType: "supplier_payment"
                                })}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Section B: Supplier Allocations */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800">Payment Allocations Ledger</h3>
                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                            <th className="px-5 py-3">Payment Ref</th>
                            <th className="px-5 py-3">Target Invoice #</th>
                            <th className="px-5 py-3 text-right">Amount Allocated</th>
                            <th className="px-5 py-3">Allocation Date</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierPaymentAllocations.map((alloc) => {
                            const pay = supplierPayments.find(p => p.id === alloc.supplier_payment_id);
                            const inv = supplierInvoices.find(i => i.id === alloc.supplier_invoice_id);
                            return (
                              <tr key={alloc.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                                <td className="px-5 py-3 font-mono font-bold text-[#07182E]">{pay ? pay.payment_reference : "Unknown Payment"}</td>
                                <td className="px-5 py-3 font-mono font-bold text-slate-700">{inv ? inv.supplier_invoice_number : "Unknown Invoice"}</td>
                                <td className="px-5 py-3 text-right font-mono font-bold text-emerald-700">
                                  {formatCurrency(alloc.amount_allocated || 0)}
                                </td>
                                <td className="px-5 py-3 font-mono text-slate-500">{alloc.allocation_date}</td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    alloc.is_reversed ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}>
                                    {alloc.is_reversed ? "Reversed" : "Active"}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  {!alloc.is_reversed && (
                                    <button
                                      onClick={async () => {
                                        setIsLoadingData(true);
                                        try {
                                          await supplierAccountsService.reverseSupplierPaymentAllocation(alloc.id, "User requested allocation reversal", alloc.version || 1);
                                          setPageNotifications(prev => ["Payment allocation unallocated / reversed successfully.", ...prev]);
                                          await loadAllFinanceData();
                                        } catch (err: any) {
                                          setPageNotifications(prev => [`Unallocate failed: ${err.message}`, ...prev]);
                                        } finally {
                                          setIsLoadingData(false);
                                        }
                                      }}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-bold text-[10px]"
                                    >
                                      Unallocate
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {supplierPaymentAllocations.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">
                                No payment allocations recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. AUDIT & DOCUMENTS */}
            {supplierSubTab === "audit" && (
              <div className="space-y-8">
                {/* Audit Trail */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800">Supplier Module Audit Log</h3>
                  <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                            <th className="px-5 py-3">Timestamp</th>
                            <th className="px-5 py-3">Table</th>
                            <th className="px-5 py-3">Action</th>
                            <th className="px-5 py-3">Entity ID</th>
                            <th className="px-5 py-3">Changed By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierAuditLogs.map((log) => (
                            <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                              <td className="px-5 py-3 font-mono text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                              <td className="px-5 py-3 font-mono font-bold text-slate-700">{log.table_name}</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.action_type === "INSERT" ? "bg-emerald-50 text-emerald-700" :
                                  log.action_type === "UPDATE" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                                }`}>
                                  {log.action_type}
                                </span>
                              </td>
                              <td className="px-5 py-3 font-mono text-slate-500 text-[11px]">{log.entity_id}</td>
                              <td className="px-5 py-3 text-slate-600">{log.changed_by || "System Trigger"}</td>
                            </tr>
                          ))}
                          {supplierAuditLogs.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-5 py-12 text-center text-xs text-slate-400">
                                No audit log events recorded yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Supporting Documents */}
                <div>
                  <AccountDocumentUpload
                    companyId={activeCompany.id}
                    projectId={activeProject?.id}
                    recordType="supplier_account"
                    showDivisionsNav={false}
                    title="Supplier Accounts Supporting Documents"
                    description="Tax clearance certificates, delivery notes, vendor agreements, and payment receipts."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 7: CASH & BANK ==================== */}
        {activeTab === "cash" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Nested Views */}
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none">
              {([
                { id: "accounts", label: "Bank Accounts" },
                { id: "cashbook", label: "Cashbook Ledger" },
                { id: "reconciliation", label: "Bank Reconciliation" }
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCashSubTab(tab.id)}
                  className={`px-4 py-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all ${
                    cashSubTab === tab.id
                      ? "border-[#FF9F1C] text-[#07182E]"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab 1: Financial Bank Accounts */}
            {cashSubTab === "accounts" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-[#07182E]">Financial Bank Accounts</h3>
                    <p className="text-xs text-slate-500">Configured company bank accounts, petty cash floats, and credit lines.</p>
                  </div>
                  <button onClick={() => handleOpenModal("bank_account")} className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Add Bank Account
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {bankAccounts
                    .filter(acc => acc.account_name.toLowerCase().includes(searchQuery.toLowerCase()) || (acc.bank_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(acc => {
                      const accountTxs = cashbookTransactions.filter(t => t.bank_account_id === acc.id && t.status === "Posted" && !t.is_archived);
                      const postedInflows = accountTxs.filter(t => t.transaction_type === "Receipt" || t.transaction_type === "Transfer In").reduce((sum, t) => sum + t.amount, 0);
                      const postedOutflows = accountTxs.filter(t => t.transaction_type === "Payment" || t.transaction_type === "Transfer Out").reduce((sum, t) => sum + t.amount, 0);
                      const computedBalance = acc.opening_balance + postedInflows - postedOutflows;

                      return (
                        <div key={acc.id} className="bg-white border border-[#E2E8F0] rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[#07182E]">
                                  <Landmark className="w-5 h-5 text-[#FF9F1C]" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-[#07182E]">{acc.account_name}</h4>
                                  <span className="text-[11px] text-slate-400 font-medium">{acc.bank_name || "Bank Account"} • {acc.account_type}</span>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                acc.is_archived ? "bg-amber-50 text-amber-800 border border-amber-200" :
                                acc.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {acc.is_archived ? "ARCHIVED" : acc.is_active ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </div>

                            <div className="mt-5 space-y-1.5 pt-4 border-t border-slate-100">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Account Number:</span>
                                <span className="font-mono font-bold text-slate-700">{acc.account_number || "—"}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Branch Code:</span>
                                <span className="font-mono text-slate-600">{acc.branch_code || "—"}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Opening Balance:</span>
                                <span className="font-mono text-slate-600">{formatCurrency(acc.opening_balance)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t border-slate-100 flex items-end justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Current Ledger Balance</span>
                              <span className={`text-base font-black font-mono mt-0.5 block ${computedBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                {formatCurrency(computedBalance)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleBankAccountToggle(acc)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase transition-all"
                              >
                                {acc.is_active ? "Deactivate" : "Activate"}
                              </button>
                              {!acc.is_archived ? (
                                <button
                                  onClick={() => handleBankAccountArchive(acc.id)}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                                  title="Archive Account"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleBankAccountRestore(acc.id)}
                                  className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold"
                                >
                                  Restore
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {bankAccounts.length === 0 && (
                    <div className="col-span-full bg-white border border-[#E2E8F0] rounded-3xl p-12 text-center">
                      {renderEmptyState({
                        icon: Landmark,
                        title: "No bank accounts configured",
                        description: "Add company operational bank accounts or cash floats to begin tracking cashflows.",
                        addButtonLabel: "Add Bank Account",
                        modalType: "bank_account"
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Cashbook Ledger */}
            {cashSubTab === "cashbook" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#07182E]">Double Entry Cashbook Ledger</h3>
                    <p className="text-xs text-slate-500">Live operational cash transactions, transfers, and clearance audit trail.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal("bank_statement_import")}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 border border-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Import Statement
                    </button>
                    <button onClick={() => handleOpenModal("cash_movement")} className="bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5" />
                      Record Cash Movement
                    </button>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 shadow-2xs">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bank Account</label>
                    <select
                      value={selectedBankAccountId}
                      onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                    >
                      <option value="">All Accounts</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.account_name} ({b.bank_name || 'Bank'})</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[150px]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Filter</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Approved">Approved</option>
                      <option value="Posted">Posted</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                          <th className="px-5 py-3">Tx Date</th>
                          <th className="px-5 py-3">Reference</th>
                          <th className="px-5 py-3">Bank Account</th>
                          <th className="px-5 py-3">Payee / Payer</th>
                          <th className="px-5 py-3">Description</th>
                          <th className="px-5 py-3">Type</th>
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Reconciled</th>
                          <th className="px-5 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashbookTransactions
                          .filter(t => {
                            const matchAcc = !selectedBankAccountId || t.bank_account_id === selectedBankAccountId;
                            const matchStatus = statusFilter === "all" || t.status === statusFilter;
                            const matchSearch = (t.reference_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (t.payee_payer_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
                            return matchAcc && matchStatus && matchSearch;
                          })
                          .map(t => {
                            const bAcc = bankAccounts.find(ba => ba.id === t.bank_account_id);
                            const isDeposit = t.transaction_type === "Receipt" || t.transaction_type === "Transfer In";

                            return (
                              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50 text-xs">
                                <td className="px-5 py-3 font-mono text-slate-500">{t.transaction_date}</td>
                                <td className="px-5 py-3 font-mono font-bold text-[#07182E]">
                                  {t.reference_number}
                                  {t.is_archived && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-black">ARCHIVED</span>}
                                </td>
                                <td className="px-5 py-3 text-slate-600 font-semibold">{bAcc ? bAcc.account_name : "Unknown Account"}</td>
                                <td className="px-5 py-3 text-slate-700 font-bold">{t.payee_payer_name || "—"}</td>
                                <td className="px-5 py-3 text-slate-500 truncate max-w-[180px]">{t.description}</td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isDeposit ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                                  }`}>
                                    {t.transaction_type}
                                  </span>
                                </td>
                                <td className={`px-5 py-3 font-mono font-extrabold ${isDeposit ? "text-emerald-700" : "text-slate-800"}`}>
                                  {isDeposit ? "+" : "-"} {formatCurrency(t.amount)}
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    t.status === "Posted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                    t.status === "Approved" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                    t.status === "Submitted" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                    t.status === "Cancelled" ? "bg-red-50 text-red-700 border border-red-200" :
                                    "bg-slate-100 text-slate-600"
                                  }`}>
                                    {t.status}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    t.reconciliation_status === "RECONCILED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                    t.reconciliation_status === "MATCHED" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                    "bg-slate-50 text-slate-400"
                                  }`}>
                                    {t.reconciliation_status}
                                  </span>
                                </td>
                                <td className="px-5 py-3 flex items-center gap-1">
                                  {t.status === "Draft" && (
                                    <button
                                      onClick={() => handleCashbookTxTransition(t.id, "submit")}
                                      className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-bold text-[10px] uppercase px-2"
                                    >
                                      Submit
                                    </button>
                                  )}
                                  {t.status === "Submitted" && (
                                    <button
                                      onClick={() => handleCashbookTxTransition(t.id, "approve")}
                                      className="p-1 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 font-bold text-[10px] uppercase px-2"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {t.status === "Approved" && (
                                    <button
                                      onClick={() => handleCashbookTxTransition(t.id, "post")}
                                      className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold text-[10px] uppercase px-2"
                                    >
                                      Post
                                    </button>
                                  )}
                                  {t.status !== "Cancelled" && t.reconciliation_status === "UNRECONCILED" && (
                                    <button
                                      onClick={() => handleCashbookTxTransition(t.id, "cancel")}
                                      className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 font-bold text-[10px] uppercase px-1.5"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                  {!t.is_archived ? (
                                    <button
                                      onClick={() => handleCashbookTxTransition(t.id, "archive")}
                                      className="p-1 text-slate-400 hover:text-slate-600"
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleCashbookTxTransition(t.id, "restore")}
                                      className="p-1 text-emerald-600 hover:text-emerald-800 rounded bg-emerald-50 text-[10px] font-bold px-1.5"
                                    >
                                      Restore
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        {cashbookTransactions.length === 0 && (
                          <tr>
                            <td colSpan={10} className="px-5 py-12 text-center">
                              {renderEmptyState({
                                icon: Wallet,
                                title: "No cashbook transactions recorded",
                                description: "Record cash deposits, transfers or vendor payouts in the cashbook.",
                                addButtonLabel: "Record Cash Movement",
                                modalType: "cash_movement"
                              })}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Bank Reconciliation */}
            {cashSubTab === "reconciliation" && (
              <div className="space-y-6">
                {/* Session controls */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-2xs">
                  <div>
                    <label className={labelClass}>Active Bank Account</label>
                    <select
                      value={selectedBankAccountId}
                      onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      className="w-full border rounded-xl p-2.5 text-xs bg-white text-slate-800 font-semibold focus:outline-none"
                    >
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.account_name} ({b.bank_name || 'Bank'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Active Session</label>
                    <select
                      value={selectedReconciliationSessionId}
                      onChange={(e) => setSelectedReconciliationSessionId(e.target.value)}
                      className="w-full border rounded-xl p-2.5 text-xs bg-white text-slate-800 font-semibold focus:outline-none"
                    >
                      <option value="">Choose session...</option>
                      {reconciliationSessions
                        .filter(s => s.bank_account_id === selectedBankAccountId)
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            Stmt Date: {s.statement_end_date} ({s.status})
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    onClick={() => handleOpenModal("reconciliation_session")}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#07182E] text-white hover:bg-[#07182E]/90 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    New Session
                  </button>
                  <button
                    onClick={() => handleOpenModal("bank_statement_import")}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Import Bank File
                  </button>
                </div>

                {/* Session Balance Bar */}
                {selectedReconciliationSessionId && (() => {
                  const activeSession = reconciliationSessions.find(s => s.id === selectedReconciliationSessionId);
                  if (!activeSession) return null;

                  const isDiffZero = Math.abs(activeSession.difference_amount) < 0.01;

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs text-center">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Statement Closing Balance</span>
                          <span className="text-base font-black text-slate-800 font-mono mt-1 block">
                            {formatCurrency(activeSession.statement_ending_balance)}
                          </span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs text-center">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Calculated Book Balance</span>
                          <span className="text-base font-black text-slate-800 font-mono mt-1 block">
                            {formatCurrency(activeSession.calculated_balance)}
                          </span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs text-center">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Reconciliation Difference</span>
                          <span className={`text-base font-black font-mono mt-1 block ${isDiffZero ? "text-emerald-600" : "text-amber-600"}`}>
                            {formatCurrency(activeSession.difference_amount)}
                          </span>
                        </div>
                      </div>

                      {/* Dual Matching Engine Workspace */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wider">Dual Reconciliation Matching Grid</h4>
                            <p className="text-[11px] text-slate-400">Select statement line on left and matching cashbook entry on right to reconcile.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleAutoMatch}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold border border-blue-200 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Auto Match Exacts
                            </button>
                            <button
                              disabled={!selectedMatchLineId || !selectedMatchTxId}
                              onClick={() => handleMatchStatementLine(selectedMatchLineId, selectedMatchTxId)}
                              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                selectedMatchLineId && selectedMatchTxId
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Match Selected Pair
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Left: Bank Statement Lines */}
                          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                            <div className="bg-slate-100/70 p-3 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
                              <span>Unmatched Bank Statement Lines</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {statementLines.filter(l => l.bank_account_id === selectedBankAccountId && (l.match_status === "Unmatched" || l.match_status?.toLowerCase().includes("unmatched"))).length} lines
                              </span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 bg-white">
                              {statementLines
                                .filter(l => l.bank_account_id === selectedBankAccountId && (l.match_status === "Unmatched" || l.match_status?.toLowerCase().includes("unmatched")) && !l.is_archived)
                                .map(line => (
                                  <div
                                    key={line.id}
                                    onClick={() => setSelectedMatchLineId(line.id)}
                                    className={`p-3 text-xs cursor-pointer transition-all flex items-center justify-between ${
                                      selectedMatchLineId === line.id ? "bg-blue-50/80 border-l-4 border-blue-600 font-semibold" : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <div>
                                      <span className="font-mono text-slate-400 block text-[10px]">{line.transaction_date}</span>
                                      <span className="font-bold text-[#07182E] block">{line.bank_reference || line.description || "Statement Line"}</span>
                                    </div>
                                    <span className={`font-mono font-bold ${line.amount >= 0 ? "text-emerald-700" : "text-slate-800"}`}>
                                      {formatCurrency(Math.abs(line.amount))}
                                    </span>
                                  </div>
                                ))}
                              {statementLines.filter(l => l.bank_account_id === selectedBankAccountId && (l.match_status === "Unmatched" || l.match_status?.toLowerCase().includes("unmatched"))).length === 0 && (
                                <div className="p-8 text-center text-xs text-slate-400">All imported statement lines are reconciled or none imported.</div>
                              )}
                            </div>
                          </div>

                          {/* Right: Cashbook Ledger Entries */}
                          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                            <div className="bg-slate-100/70 p-3 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
                              <span>Unreconciled Cashbook Entries</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {cashbookTransactions.filter(t => t.bank_account_id === selectedBankAccountId && t.status === "Posted" && (t.reconciliation_status === "Unreconciled" || t.reconciliation_status?.toLowerCase().includes("unreconciled"))).length} entries
                              </span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 bg-white">
                              {cashbookTransactions
                                .filter(t => t.bank_account_id === selectedBankAccountId && t.status === "Posted" && (t.reconciliation_status === "Unreconciled" || t.reconciliation_status?.toLowerCase().includes("unreconciled")) && !t.is_archived)
                                .map(tx => (
                                  <div
                                    key={tx.id}
                                    onClick={() => setSelectedMatchTxId(tx.id)}
                                    className={`p-3 text-xs cursor-pointer transition-all flex items-center justify-between ${
                                      selectedMatchTxId === tx.id ? "bg-emerald-50/80 border-l-4 border-emerald-600 font-semibold" : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <div>
                                      <span className="font-mono text-slate-400 block text-[10px]">{tx.transaction_date} • {tx.reference_number}</span>
                                      <span className="font-bold text-[#07182E] block">{tx.payee_payer_name || tx.description}</span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-800">
                                      {formatCurrency(tx.amount)}
                                    </span>
                                  </div>
                                ))}
                              {cashbookTransactions.filter(t => t.bank_account_id === selectedBankAccountId && t.status === "Posted" && (t.reconciliation_status === "Unreconciled" || t.reconciliation_status?.toLowerCase().includes("unreconciled"))).length === 0 && (
                                <div className="p-8 text-center text-xs text-slate-400">No unreconciled posted cashbook entries available.</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Active Session Matches List */}
                        <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                          <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wider">Session Matches Ledger</h4>
                          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                                  <th className="px-4 py-2.5">Match Ref</th>
                                  <th className="px-4 py-2.5">Statement Line</th>
                                  <th className="px-4 py-2.5">Cashbook Entry</th>
                                  <th className="px-4 py-2.5">Matched Amount</th>
                                  <th className="px-4 py-2.5">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {reconciliationMatches
                                  .filter(m => m.reconciliation_session_id === activeSession.id)
                                  .map(match => {
                                    const sLine = statementLines.find(l => l.id === match.statement_line_id);
                                    const cTx = cashbookTransactions.find(t => t.id === match.cashbook_transaction_id);

                                    return (
                                      <tr key={match.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400">{match.id.slice(0, 8)}</td>
                                        <td className="px-4 py-2.5 text-slate-700 font-medium">{sLine ? sLine.bank_reference || sLine.description : "Line"}</td>
                                        <td className="px-4 py-2.5 text-slate-700 font-medium">{cTx ? `${cTx.reference_number} (${cTx.payee_payer_name || 'Tx'})` : "Entry"}</td>
                                        <td className="px-4 py-2.5 font-mono font-extrabold text-emerald-700">{formatCurrency(match.matched_amount)}</td>
                                        <td className="px-4 py-2.5">
                                          {(activeSession.status === "In Progress" || activeSession.status === "IN_PROGRESS") && (
                                            <button
                                              onClick={() => handleUnmatchStatementLine(match.id)}
                                              className="p-1 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 font-bold text-[10px] uppercase px-2"
                                            >
                                              Unmatch
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                {reconciliationMatches.filter(m => m.reconciliation_session_id === activeSession.id).length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">No matches created in this session yet.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Complete Session Button */}
                        {(activeSession.status === "In Progress" || activeSession.status === "IN_PROGRESS") && (
                          <div className="pt-4 flex justify-end">
                            <button
                              disabled={!isDiffZero}
                              onClick={() => handleCompleteReconciliation(activeSession.id)}
                              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                isDiffZero
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
                              }`}
                              title={isDiffZero ? "Finalize bank reconciliation" : "Reconciliation difference must be zero"}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Finalize & Close Reconciliation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {!selectedReconciliationSessionId && (
                  <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-2xs">
                    <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-slate-700">No active reconciliation session selected</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                      Select an existing session above or start a new bank reconciliation period.
                    </p>
                    <button
                      onClick={() => handleOpenModal("reconciliation_session")}
                      className="bg-[#07182E] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                    >
                      Start Bank Reconciliation
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 8: REPORTS & AUDIT ==================== */}
        {activeTab === "reports" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Nested subtabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setReportSubTab("reports")}
                className={`px-4 py-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all ${
                  reportSubTab === "reports" ? "border-[#FF9F1C] text-[#07182E]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Financial Reports
              </button>
              <button
                onClick={() => setReportSubTab("audit")}
                className={`px-4 py-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all ${
                  reportSubTab === "audit" ? "border-[#FF9F1C] text-[#07182E]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Audit Trail
              </button>
              <button
                onClick={() => setReportSubTab("documents")}
                className={`px-4 py-2 text-xs font-bold tracking-wide border-b-2 whitespace-nowrap transition-all ${
                  reportSubTab === "documents" ? "border-[#FF9F1C] text-[#07182E]" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Documents & Storage
              </button>
            </div>

            {reportSubTab === "reports" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { title: "Budget vs Actual", desc: "Compare project baseline budgets against posted costs." },
                  { title: "Actual Cost and Commitments", desc: "Combined structural tracking of incurred liabilities." },
                  { title: "Forecast at Completion", desc: "Review estimate revisions and physical completion cost projections." },
                  { title: "Projected Profit or Loss", desc: "Company-wide project margin summaries without tax allocations." },
                  { title: "Project Cash Movement", desc: "Track receipts and cash payments specifically by work site." },
                  { title: "Aged Client Debtors", desc: "Review outstanding client invoices sorted by 30/60/90 days." },
                  { title: "Aged Supplier Liabilities", desc: "Track vendor claims overdue for electronic fund payouts." },
                  { title: "Certified vs Invoiced vs Received", desc: "Comprehensive client reconciliation ledger check." },
                  { title: "Commitment Register", desc: "Examine outstanding subcontract and purchase order obligations." }
                ].map((rep, idx) => (
                  <div key={idx} className={`${cardClass} flex flex-col justify-between h-48`}>
                    <div>
                      <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wider mb-1">{rep.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-normal">{rep.desc}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold italic">No data available</span>
                      <button
                        disabled
                        className="p-1.5 rounded-lg bg-slate-50 text-slate-300 border cursor-not-allowed"
                        title="Reports require live data sources"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reportSubTab === "audit" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                          {["Date & Time", "Module", "Action", "Record Reference", "Project", "Operator ID"].map((th) => (
                            <th key={th} className="px-5 py-3">{th}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => {
                          const proj = allProjects.find((p: any) => p.id === log.project_id);
                          return (
                            <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="px-5 py-3 font-mono text-slate-500">
                                {new Date(log.changed_at).toLocaleString('en-ZA')}
                              </td>
                              <td className="px-5 py-3 font-semibold text-slate-600">
                                {log.source_table.replace("project_", "").replace("financial_", "").toUpperCase()}
                              </td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.action === "APPROVE" || log.action === "POST" ? "bg-emerald-50 text-emerald-700" :
                                  log.action === "SUBMIT" ? "bg-blue-50 text-blue-700" :
                                  log.action === "REJECT" || log.action === "REVERSE" ? "bg-red-50 text-red-700" :
                                  "bg-slate-100 text-slate-700"
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-5 py-3 font-mono font-bold text-slate-700">
                                {log.transaction_identifier || log.record_id.slice(0, 8)}
                              </td>
                              <td className="px-5 py-3 text-slate-500">
                                {proj ? proj.name : "Company Level"}
                              </td>
                              <td className="px-5 py-3 font-mono text-[10px] text-slate-400">
                                {log.changed_by || "System Process"}
                              </td>
                            </tr>
                          );
                        })}
                        {auditLogs.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-16 text-center text-xs text-slate-400 italic">
                              No financial audit events are available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {reportSubTab === "documents" && (
              <div className="animate-fadeIn">
                <AccountDocumentUpload
                  companyId={activeCompany.id}
                  projectId={activeProject?.id}
                  showDivisionsNav={true}
                  title="Accounts Shared Document Management System"
                  description="Centralised storage across Budgets, Forecasts, Commitments, Actual Costs, Supplier Accounts, Client Accounts, Cash & Bank, and Audit Records."
                />
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 9: FINANCE SETUP ==================== */}
        {activeTab === "setup" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Setup Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration panel */}
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#07182E] flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#FF9F1C]" />
                    Reporting Configuration
                  </h3>
                  <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                    System Defaults
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Reporting Currency</label>
                    <input type="text" value="ZAR" disabled className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Default VAT Rate (%)</label>
                    <input type="number" value="15.00" disabled className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold cursor-not-allowed" />
                  </div>
                  <div>
                    <label className={labelClass}>Financial Year Start</label>
                    <select disabled className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold cursor-not-allowed">
                      <option>01 March (Standard SA FY)</option>
                      <option>01 January (Calendar Year)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Date Format</label>
                    <select disabled className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold cursor-not-allowed">
                      <option>YYYY-MM-DD</option>
                      <option>DD/MM/YYYY</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Amount Display Format</label>
                    <select disabled className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold cursor-not-allowed">
                      <option>2 Decimal points (R 1,000,000.00)</option>
                      <option>Compact thousands (R 1.00M)</option>
                    </select>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-600 font-medium">
                    <AlertCircle className="w-4 h-4 text-[#FF9F1C] shrink-0 mt-0.5" />
                    <span>Company finance setup persistence will be enabled in a later configuration phase.</span>
                  </div>
                </div>
              </div>

              {/* Prefixes Configuration */}
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#07182E] flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#FF9F1C]" />
                    Document Numbering Prefixes
                  </h3>
                  <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Configuration Preview
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Budget version prefix", value: "BGT" },
                    { label: "Commitment prefix", value: "PO" },
                    { label: "Client Claim prefix", value: "CLM" },
                    { label: "Payment Certificate prefix", value: "CERT" },
                    { label: "Client Invoice prefix", value: "INV" },
                    { label: "Supplier Invoice prefix", value: "PINV" },
                    { label: "Receipt prefix", value: "REC" },
                    { label: "Supplier Payment prefix", value: "PAY" },
                    { label: "Cost Posting prefix", value: "POST" }
                  ].map((p, idx) => (
                    <div key={idx}>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {p.label}
                      </label>
                      <input
                        type="text"
                        value={p.value}
                        disabled
                        className="w-full p-2 border border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-500 font-mono font-bold cursor-not-allowed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Financial Periods panel */}
            <div className={cardClass}>
              <h3 className="text-sm font-bold text-[#07182E] mb-4">Financial Periods Register</h3>
              <div className="bg-slate-50 p-6 text-center rounded-2xl border border-slate-200">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-pulse" />
                <h4 className="text-xs font-bold text-[#07182E]">No financial periods defined</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Financial month-end periods will render here once database registers are provisioned.
                </p>
              </div>
            </div>

            {/* Explanatory Cards / Control info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { title: "Approval Workflows", desc: "Transactions bypass draft state once the assigned CEO/CFO authorizes payment certificates or supplier claims." },
                { title: "Posted-record Locking", desc: "No direct edits are allowed on closed financial periods. Audits remain strictly traceable." },
                { title: "Reversal Controls", desc: "Corrections on finalized supplier accounts require a standard debit/credit ledger reversal posting." },
                { title: "Audit History", desc: "Who posted, certified or cleared and when is stamped with PostgreSQL triggers securely." },
                { title: "Project-level Visibility", desc: "Project Managers are fully isolated using Row Level Security to assigned records only." },
                { title: "ZAR Reporting Limitation", desc: "All multi-currency transactions must consolidate to South African Rand reporting metrics until dynamic rate exchanges are live." }
              ].map((c, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wider mb-1.5">{c.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. MODALS AND DRAWERS COMPONENT */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            />

            {/* Modal Body wrapper */}
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.15 }}
                className="relative transform overflow-hidden rounded-3xl bg-white p-6 text-left shadow-xl transition-all w-full max-w-xl border border-slate-100"
                role="dialog"
                aria-modal="true"
              >
                {/* Close Button */}
                <button
                  onClick={handleCloseModal}
                  className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 bg-slate-50 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Heading */}
                <div className="mb-5 pr-8">
                  <h3 className="text-lg font-bold text-[#07182E] tracking-tight">
                    {modalTitles[activeModal]?.title || "Capture Record"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {modalTitles[activeModal]?.desc || "Complete fields to validate bookkeeping logic."}
                  </p>
                </div>

                {/* Form Rendering */}
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {formFieldConfigs[activeModal]?.map((field) => {
                      if (field.type === "select") {
                        let options: any[] = [];
                        if (field.name === "project" || field.name === "project_id") {
                          options = allProjects.map((p: any) => ({ value: p.id, label: p.name }));
                        } else if (field.name === "supplier_account_id") {
                          options = supplierAccounts.map((s) => ({ value: s.id, label: `${s.supplier_code} - ${s.legal_name}` }));
                        } else if (field.name === "financial_commitment_id") {
                          options = commitments.map((c) => ({ value: c.id, label: `${c.commitment_reference} - ${c.counterparty_name}` }));
                        } else if (field.name === "invoice_id" || field.name === "supplier_invoice_id") {
                          options = supplierInvoices.map((i) => ({ value: i.id, label: `${i.supplier_invoice_number} (ZAR ${(i.total_incl_vat || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})` }));
                        } else if (field.name === "bank_account_id") {
                          options = bankAccounts.map((b) => ({ value: b.id, label: `${b.account_name} (${b.bank_name})` }));
                        } else if (field.name === "supplier_payment_id") {
                          options = supplierPayments.map((p) => ({ value: p.id, label: `${p.payment_reference} (ZAR ${(p.amount_paid || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})` }));
                        } else {
                          options = field.options?.map((opt) => ({ value: opt, label: opt })) || [];
                        }

                        return (
                          <div key={field.name} className="col-span-2 sm:col-span-1">
                            <label className={labelClass}>
                              {field.label} {field.required && <span className="text-[#FF9F1C]">*</span>}
                            </label>
                            <select
                              required={field.required}
                              value={formValues[field.name] || ""}
                              onChange={(e) => handleFormChange(field.name, e.target.value)}
                              className={inputClass}
                            >
                              <option value="">Choose option...</option>
                              {options.map((opt: any) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      if (field.type === "textarea") {
                        return (
                          <div key={field.name} className="col-span-2">
                            <label className={labelClass}>
                              {field.label} {field.required && <span className="text-[#FF9F1C]">*</span>}
                            </label>
                            <textarea
                              rows={3}
                              placeholder={field.placeholder}
                              required={field.required}
                              value={formValues[field.name] || ""}
                              onChange={(e) => handleFormChange(field.name, e.target.value)}
                              className={inputClass}
                            />
                          </div>
                        );
                      }

                      if (field.type === "file") {
                        const currentRecordId = formValues.id || formValues.entity_id || formValues.supplier_invoice_number || formValues.credit_note_number || formValues.payment_reference || formValues.ref || formValues.version;
                        if (!currentRecordId) {
                          return (
                            <div key={field.name} className="col-span-2">
                              <label className={labelClass}>{field.label}</label>
                              <div className="border border-dashed border-slate-200 bg-slate-50/70 rounded-2xl p-4 text-center">
                                <FileCheck className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                                <span className="text-xs font-bold text-[#07182E] block">Upload Supporting Document</span>
                                <span className="text-[11px] text-slate-500 mt-0.5 block">Please save the record first to enable file attachments.</span>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={field.name} className="col-span-2">
                            <label className={labelClass}>{field.label}</label>
                            <AccountDocumentUpload
                              companyId={activeCompany.id}
                              projectId={activeProject?.id}
                              recordType={activeModal || "general"}
                              recordId={currentRecordId}
                              documentType={field.name}
                              compact={true}
                              onAttachmentUploaded={(att) => {
                                handleFormChange(field.name, att.storage_path);
                              }}
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={field.name} className="col-span-2 sm:col-span-1">
                          <label className={labelClass}>
                            {field.label} {field.required && <span className="text-[#FF9F1C]">*</span>}
                          </label>
                          <input
                            type={field.type}
                            placeholder={field.placeholder}
                            required={field.required}
                            value={formValues[field.name] || ""}
                            onChange={(e) => handleFormChange(field.name, e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Invoice Allocation Section for Cash/Payments */}
                  {activeModal === "client_receipt" && (
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Invoice Allocation</label>
                      <div className="text-xs text-slate-400 italic">No issued invoices are available for allocation.</div>
                    </div>
                  )}

                  {activeModal === "supplier_payment" && (
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Invoice Allocation</label>
                      <div className="text-xs text-slate-400 italic">No approved supplier invoices are available for allocation.</div>
                    </div>
                  )}

                  {/* Submit notices */}
                  {submitNotice && (
                    <div className="bg-amber-50 text-amber-800 text-[11px] font-semibold p-3.5 rounded-2xl border border-amber-100 flex items-start gap-2.5 animate-fadeIn">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{submitNotice}</span>
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#07182E] hover:bg-[#07182E]/90 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      Submit Record
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
      {/* 5. SUPPLIER WORKFLOW REASON PROMPT MODAL */}
      <AnimatePresence>
        {supplierActionPrompt && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSupplierActionPrompt(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            />
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.15 }}
                className="relative transform overflow-hidden rounded-3xl bg-white p-6 text-left shadow-xl transition-all w-full max-w-md border border-slate-100"
              >
                <div className="mb-4">
                  <h3 className="text-base font-bold text-[#07182E]">
                    Provide Reason for Action
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    This action will update record workflow state and write an immutable entry to the audit log.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Reason / Justification <span className="text-[#FF9F1C]">*</span></label>
                    <textarea
                      rows={3}
                      required
                      value={actionReasonInput}
                      onChange={(e) => setActionReasonInput(e.target.value)}
                      placeholder="e.g. Returned damaged items / Duplicate billing claim..."
                      className={inputClass}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSupplierActionPrompt(null)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmActionPrompt}
                      className="px-4 py-2 bg-[#07182E] text-white font-bold text-xs rounded-xl hover:bg-[#07182E]/90"
                    >
                      Confirm Action
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </ProjectShell>
  );
}
