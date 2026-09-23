import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Check,
  X,
  Layers,
  Building2,
  Calendar,
  DollarSign,
  Search,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Loader2
} from "lucide-react";
import {
  CommercialCategory,
  SourceProvenance,
  ImportFieldMapping,
  BudgetLineItem,
  ForecastLineItem,
  CommitmentRegisterItem,
  ActualCostRegisterItem,
  ClientCertificateRecord,
  SupplierInvoiceRecord,
  BankTransactionRecord
} from "../../types/commercialWorkspace";
import {
  CommercialImportService,
  ParsedDocumentResult,
  CANONICAL_FIELDS_BY_CATEGORY
} from "../../services/commercialImportService";
import { CommercialWorkspaceService } from "../../services/commercialWorkspaceService";

interface CommercialDataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  projectId?: string;
  companyName?: string;
  projectName?: string;
  onImportComplete: () => void;
}

const CATEGORY_OPTIONS: { category: CommercialCategory; label: string; description: string }[] = [
  { category: "BUDGET", label: "Budget (Cost Codes & Baselines)", description: "Approved project budget allocations per work breakdown structure" },
  { category: "FORECAST", label: "Forecasts (ETC / EAC)", description: "Monthly or quarterly cost-to-complete & estimate at completion" },
  { category: "COMMITMENT", label: "Commitments (PO & Subcontracts)", description: "Issued purchase orders, executed subcontracts, and contractual commitments" },
  { category: "ACTUAL_COST", label: "Actual Costs & Expense Postings", description: "Direct expenditure, supplier bills, payroll runs, plant charges" },
  { category: "PAYMENT_CERTIFICATE", label: "Client Payment Certificates (IPCs)", description: "Client interim payment certificates, gross valuation, retention, net certified" },
  { category: "SUPPLIER_INVOICE", label: "Supplier & Subcontractor Invoices", description: "Invoices received, tax breakdown, due dates, approval registers" },
  { category: "BANK_TRANSACTION", label: "Cash & Bank Statements", description: "Verified bank statement lines, receipts, payments, reconciliations" },
  { category: "CONTRACT_VALUE", label: "Contract Value & Variations", description: "Principal contract sum, signed variation orders, compensation events" },
  { category: "BOQ", label: "Bill of Quantities (BOQ)", description: "Tender schedule of rates, baseline quantities, unit cost build-ups" }
];

export const CommercialDataUploadModal: React.FC<CommercialDataUploadModalProps> = ({
  isOpen,
  onClose,
  companyId,
  projectId,
  companyName = "Active Enterprise",
  projectName = "Active Project",
  onImportComplete
}) => {
  // Wizard steps: 1: Setup & Scope -> 2: Upload File -> 3: Extract & Preview Mapping -> 4: User Confirm & Import -> 5: Complete
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Pre-Import Configuration
  const [selectedCategory, setSelectedCategory] = useState<CommercialCategory>("BUDGET");
  const [contractRef, setContractRef] = useState<string>("CTR-2026-MAIN");
  const [reportingPeriod, setReportingPeriod] = useState<string>(
    new Date().toISOString().slice(0, 7) // e.g. 2026-08
  );

  // Step 2: File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParsedDocumentResult | null>(null);
  const [mappings, setMappings] = useState<ImportFieldMapping[]>([]);
  const [duplicateFlags, setDuplicateFlags] = useState<{ isDuplicate: boolean; reason?: string }[]>([]);

  // Drag & drop state
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4: Import execution
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<{ totalImported: number; skipped: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle file selection and parsing
  const handleFileChosen = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await CommercialImportService.parseFile(file, selectedCategory);
      setParseResult(result);
      setMappings(result.proposedMappings);

      // Perform duplicate check
      const duplicateChecks = await CommercialWorkspaceService.detectDuplicates(
        companyId,
        projectId,
        selectedCategory,
        result.rawRows
      );
      setDuplicateFlags(duplicateChecks);

      setStep(3); // Proceed to Preview & Mapping step
    } catch (err: any) {
      console.error("Failed to parse file:", err);
      setErrorMessage(err.message || "Failed to read file contents. Please verify format.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChosen(e.dataTransfer.files[0]);
    }
  };

  // Mapping adjustments
  const updateMappingStatus = (
    index: number,
    newStatus: "MAPPED" | "FLAGGED_REVIEW" | "IGNORED",
    newField?: string
  ) => {
    assertOperationalAction("edit", "components/commercial/CommercialDataUploadModal.tsx");
    setMappings(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          status: newStatus,
          projectMatrixField: newField !== undefined ? newField : next[index].projectMatrixField
        };
      }
      return next;
    });
  };

  // Execute Final User-Confirmed Import
  const handleExecuteImport = async () => {
    if (!parseResult || !selectedFile) return;

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const provenance: SourceProvenance = {
        originalFilename: selectedFile.name,
        uploadDate: new Date().toISOString(),
        uploadedBy: "Authorized User",
        importStatus: "VERIFIED",
        approvalStatus: "APPROVED",
        sheetOrPage: parseResult.sheetNames?.[0] || "1",
        importBatchId: `BATCH-${Date.now()}`
      };

      let importedCount = 0;
      let skippedCount = 0;

      // Extract row data according to confirmed mappings
      const fieldMap: Record<string, string> = {};
      mappings.forEach(m => {
        if (m.status === "MAPPED" && m.projectMatrixField !== "ignore") {
          fieldMap[m.sourceField] = m.projectMatrixField;
        }
      });

      if (selectedCategory === "BUDGET") {
        const existing = await CommercialWorkspaceService.getBudgetLines(companyId, projectId);
        const newLines: BudgetLineItem[] = [];

        parseResult.rawRows.forEach((row, idx) => {
          let costCode = "CODE-" + (idx + 1);
          let description = "Imported Line";
          let origBudget: number | null = null;
          let approvedVar: number | null = null;
          let revisedBudget: number | null = null;

          Object.entries(fieldMap).forEach(([srcKey, targetField]) => {
            const val = row[srcKey];
            if (targetField === "costCode" && val) costCode = String(val).trim();
            if (targetField === "description" && val) description = String(val).trim();
            if (targetField === "originalBudget") origBudget = CommercialImportService.parseNumber(val);
            if (targetField === "approvedChanges") approvedVar = CommercialImportService.parseNumber(val);
            if (targetField === "revisedBudget") revisedBudget = CommercialImportService.parseNumber(val);
          });

          if (origBudget === null && revisedBudget !== null) origBudget = revisedBudget;
          if (revisedBudget === null && origBudget !== null) revisedBudget = (origBudget || 0) + (approvedVar || 0);

          if (origBudget !== null || revisedBudget !== null) {
            newLines.push({
              id: `bdg-${Date.now()}-${idx}`,
              companyId,
              projectId: projectId || "all",
              costCode,
              description,
              originalBudget: origBudget,
              approvedChanges: approvedVar || 0,
              revisedBudget: revisedBudget ?? origBudget,
              currency: "USD",
              source: {
                ...provenance,
                originalField: "Budget Baseline",
                originalValue: revisedBudget
              },
              auditTrail: [
                {
                  id: `aud-${Date.now()}-${idx}`,
                  timestamp: new Date().toISOString(),
                  action: "IMPORT",
                  changedBy: "Authorized User",
                  sourceDocument: selectedFile.name,
                  notes: `Imported via batch ${provenance.importBatchId}`
                }
              ]
            });
            importedCount++;
          } else {
            skippedCount++;
          }
        });

        await CommercialWorkspaceService.saveBudgetLines(companyId, projectId, [...existing, ...newLines]);
      } else if (selectedCategory === "FORECAST") {
        const existing = await CommercialWorkspaceService.getForecastLines(companyId, projectId);
        const newForecasts: ForecastLineItem[] = [];

        parseResult.rawRows.forEach((row, idx) => {
          let costCode = "CODE-" + (idx + 1);
          let description = "Forecast Line";
          let revisedBudget: number | null = null;
          let actualCost: number | null = null;
          let commitments: number | null = null;
          let forecastToComplete: number | null = null;
          let forecastFinalCost: number | null = null;

          Object.entries(fieldMap).forEach(([srcKey, targetField]) => {
            const val = row[srcKey];
            if (targetField === "costCode" && val) costCode = String(val).trim();
            if (targetField === "description" && val) description = String(val).trim();
            if (targetField === "revisedBudget") revisedBudget = CommercialImportService.parseNumber(val);
            if (targetField === "actualCost") actualCost = CommercialImportService.parseNumber(val);
            if (targetField === "commitments") commitments = CommercialImportService.parseNumber(val);
            if (targetField === "forecastToComplete") forecastToComplete = CommercialImportService.parseNumber(val);
            if (targetField === "forecastFinalCost") forecastFinalCost = CommercialImportService.parseNumber(val);
          });

          // Formula enforcement: EAC = Actual + Commitments + ETC
          if (forecastFinalCost === null && (actualCost !== null || commitments !== null || forecastToComplete !== null)) {
            forecastFinalCost = (actualCost || 0) + (commitments || 0) + (forecastToComplete || 0);
          }

          const variance = (revisedBudget !== null && forecastFinalCost !== null)
            ? (revisedBudget - forecastFinalCost)
            : null;

          newForecasts.push({
            id: `fc-${Date.now()}-${idx}`,
            companyId,
            projectId: projectId || "all",
            costCode,
            description,
            revisedBudget,
            actualCost,
            commitments,
            forecastToComplete,
            forecastFinalCost,
            variance,
            currency: "USD",
            source: provenance
          });
          importedCount++;
        });

        await CommercialWorkspaceService.saveForecastLines(companyId, projectId, [...existing, ...newForecasts]);
      } else if (selectedCategory === "COMMITMENT" || selectedCategory === "PURCHASE_ORDER" || selectedCategory === "SUBCONTRACT") {
        const existing = await CommercialWorkspaceService.getCommitments(companyId, projectId);
        const newCommitments: CommitmentRegisterItem[] = [];

        parseResult.rawRows.forEach((row, idx) => {
          let ref = "PO-" + (idx + 1);
          let counterparty = "Supplier / Subcontractor";
          let description = "Procurement Package";
          let origVal: number | null = null;
          let changes: number | null = null;
          let curCommitment: number | null = null;

          Object.entries(fieldMap).forEach(([srcKey, targetField]) => {
            const val = row[srcKey];
            if (targetField === "ref" && val) ref = String(val).trim();
            if (targetField === "counterparty" && val) counterparty = String(val).trim();
            if (targetField === "description" && val) description = String(val).trim();
            if (targetField === "originalValue") origVal = CommercialImportService.parseNumber(val);
            if (targetField === "changes") changes = CommercialImportService.parseNumber(val);
            if (targetField === "currentCommitment") curCommitment = CommercialImportService.parseNumber(val);
          });

          if (curCommitment === null && origVal !== null) {
            curCommitment = (origVal || 0) + (changes || 0);
          }

          newCommitments.push({
            id: `com-${Date.now()}-${idx}`,
            companyId,
            projectId: projectId || "all",
            ref,
            counterparty,
            description,
            type: selectedCategory === "SUBCONTRACT" ? "Subcontract" : "Purchase Order",
            originalValue: origVal,
            changes: changes || 0,
            currentCommitment: curCommitment ?? origVal,
            paid: 0,
            outstanding: curCommitment ?? origVal,
            status: "Approved",
            currency: "USD",
            source: provenance
          });
          importedCount++;
        });

        await CommercialWorkspaceService.saveCommitments(companyId, projectId, [...existing, ...newCommitments]);
      } else if (selectedCategory === "ACTUAL_COST") {
        const existing = await CommercialWorkspaceService.getActualCosts(companyId, projectId);
        const newActuals: ActualCostRegisterItem[] = [];

        parseResult.rawRows.forEach((row, idx) => {
          let date = new Date().toISOString().split("T")[0];
          let costCode = "COST-00";
          let description = "Actual Expense";
          let supplier = "Vendor";
          let reference = "TX-" + (idx + 1);
          let net: number | null = null;
          let tax: number | null = null;
          let total: number | null = null;

          Object.entries(fieldMap).forEach(([srcKey, targetField]) => {
            const val = row[srcKey];
            if (targetField === "date" && val) date = String(val).trim();
            if (targetField === "costCode" && val) costCode = String(val).trim();
            if (targetField === "description" && val) description = String(val).trim();
            if (targetField === "supplier" && val) supplier = String(val).trim();
            if (targetField === "reference" && val) reference = String(val).trim();
            if (targetField === "net") net = CommercialImportService.parseNumber(val);
            if (targetField === "tax") tax = CommercialImportService.parseNumber(val);
            if (targetField === "total") total = CommercialImportService.parseNumber(val);
          });

          if (total === null && net !== null) total = (net || 0) + (tax || 0);

          newActuals.push({
            id: `act-${Date.now()}-${idx}`,
            companyId,
            projectId: projectId || "all",
            date,
            costCode,
            description,
            supplier,
            reference,
            net,
            tax: tax || 0,
            total: total ?? net,
            source: provenance,
            status: "Posted",
            sourceType: "Supplier Invoice",
            currency: "USD"
          });
          importedCount++;
        });

        await CommercialWorkspaceService.saveActualCosts(companyId, projectId, [...existing, ...newActuals]);
      } else if (selectedCategory === "PAYMENT_CERTIFICATE") {
        const existing = await CommercialWorkspaceService.getClientCertificates(companyId, projectId);
        const newCerts: ClientCertificateRecord[] = [];

        parseResult.rawRows.forEach((row, idx) => {
          let certNum = "CERT-" + (idx + 1);
          let period = reportingPeriod;
          let applied: number | null = null;
          let certified: number | null = null;
          let invoiced: number | null = null;
          let paid: number | null = null;
          let retention: number | null = null;
          let outstanding: number | null = null;

          Object.entries(fieldMap).forEach(([srcKey, targetField]) => {
            const val = row[srcKey];
            if (targetField === "certificateNumber" && val) certNum = String(val).trim();
            if (targetField === "period" && val) period = String(val).trim();
            if (targetField === "appliedAmount") applied = CommercialImportService.parseNumber(val);
            if (targetField === "certifiedAmount") certified = CommercialImportService.parseNumber(val);
            if (targetField === "invoicedAmount") invoiced = CommercialImportService.parseNumber(val);
            if (targetField === "paidAmount") paid = CommercialImportService.parseNumber(val);
            if (targetField === "retentionWithheld") retention = CommercialImportService.parseNumber(val);
            if (targetField === "outstandingAmount") outstanding = CommercialImportService.parseNumber(val);
          });

          if (outstanding === null && certified !== null) {
            outstanding = Math.max(0, (certified || 0) - (paid || 0));
          }

          newCerts.push({
            id: `cert-${Date.now()}-${idx}`,
            companyId,
            projectId: projectId || "all",
            certificateNumber: certNum,
            period,
            appliedAmount: applied,
            certifiedAmount: certified,
            invoicedAmount: invoiced ?? certified,
            paidAmount: paid,
            retentionWithheld: retention || 0,
            outstandingAmount: outstanding,
            status: paid && paid >= (certified || 0) ? "Fully Paid" : certified ? "Certified" : "Submitted",
            currency: "USD",
            source: provenance
          });
          importedCount++;
        });

        await CommercialWorkspaceService.saveClientCertificates(companyId, projectId, [...existing, ...newCerts]);
      } else if (selectedCategory === "SUPPLIER_INVOICE") {
        const existing = await CommercialWorkspaceService.getSupplierInvoices(companyId, projectId);
        const newInvoices: SupplierInvoiceRecord[] = [];

        parseResult.rawRows.forEach((row, idx) => {
          let invNum = "INV-" + (idx + 1);
          let supplier = "Supplier";
          let date = new Date().toISOString().split("T")[0];
          let dueDate = new Date().toISOString().split("T")[0];
          let net: number | null = null;
          let tax: number | null = null;
          let total: number | null = null;
          let paid: number | null = null;

          Object.entries(fieldMap).forEach(([srcKey, targetField]) => {
            const val = row[srcKey];
            if (targetField === "invoiceNumber" && val) invNum = String(val).trim();
            if (targetField === "supplier" && val) supplier = String(val).trim();
            if (targetField === "date" && val) date = String(val).trim();
            if (targetField === "dueDate" && val) dueDate = String(val).trim();
            if (targetField === "net") net = CommercialImportService.parseNumber(val);
            if (targetField === "tax") tax = CommercialImportService.parseNumber(val);
            if (targetField === "total") total = CommercialImportService.parseNumber(val);
            if (targetField === "paid") paid = CommercialImportService.parseNumber(val);
          });

          if (total === null && net !== null) total = (net || 0) + (tax || 0);

          newInvoices.push({
            id: `sinv-${Date.now()}-${idx}`,
            companyId,
            projectId: projectId || "all",
            invoiceNumber: invNum,
            supplier,
            date,
            dueDate,
            net,
            tax: tax || 0,
            total: total ?? net,
            paid: paid || 0,
            outstanding: (total ?? net ?? 0) - (paid || 0),
            status: paid && paid >= (total || 0) ? "Paid" : "Approved",
            currency: "USD",
            source: provenance
          });
          importedCount++;
        });

        await CommercialWorkspaceService.saveSupplierInvoices(companyId, projectId, [...existing, ...newInvoices]);
      } else if (selectedCategory === "BANK_TRANSACTION") {
        const existing = await CommercialWorkspaceService.getBankTransactions(companyId, projectId);
        const newBank: BankTransactionRecord[] = [];

        parseResult.rawRows.forEach((row, idx) => {
          let date = new Date().toISOString().split("T")[0];
          let ref = "TXN-" + (idx + 1);
          let payee = "Counterparty";
          let inflow: number | null = null;
          let outflow: number | null = null;

          Object.entries(fieldMap).forEach(([srcKey, targetField]) => {
            const val = row[srcKey];
            if (targetField === "date" && val) date = String(val).trim();
            if (targetField === "reference" && val) ref = String(val).trim();
            if (targetField === "payeeOrPayer" && val) payee = String(val).trim();
            if (targetField === "inflow") inflow = CommercialImportService.parseNumber(val);
            if (targetField === "outflow") outflow = CommercialImportService.parseNumber(val);
          });

          newBank.push({
            id: `bnk-${Date.now()}-${idx}`,
            companyId,
            projectId,
            bankAccountId: "main-account",
            accountName: "Operations Account",
            date,
            transactionType: inflow ? "Receipt" : "Payment",
            reference: ref,
            payeeOrPayer: payee,
            inflow: inflow || 0,
            outflow: outflow || 0,
            balanceAfter: null,
            status: "Reconciled",
            currency: "USD",
            source: provenance
          });
          importedCount++;
        });

        await CommercialWorkspaceService.saveBankTransactions(companyId, projectId, [...existing, ...newBank]);
      } else if (selectedCategory === "CONTRACT_VALUE") {
        let origVal: number | null = null;
        let variations: number | null = null;

        parseResult.rawRows.forEach(row => {
          Object.entries(fieldMap).forEach(([srcKey, targetField]) => {
            const val = row[srcKey];
            if (targetField === "originalContractValue") origVal = CommercialImportService.parseNumber(val);
            if (targetField === "approvedVariations") variations = CommercialImportService.parseNumber(val);
          });
        });

        await CommercialWorkspaceService.saveContractValues(companyId, projectId, {
          originalContractValue: origVal,
          approvedVariations: variations,
          source: provenance
        });
        importedCount = 1;
      }

      setImportSummary({ totalImported: importedCount, skipped: skippedCount });
      setStep(4);
      onImportComplete();
    } catch (err: any) {
      console.error("Import execution failed:", err);
      setErrorMessage(err.message || "Failed to persist records to database.");
    } finally {
      setIsImporting(false);
    }
  };

  const canonicalOptions = CANONICAL_FIELDS_BY_CATEGORY[selectedCategory] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Upload Commercial Data
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Source-driven financial extraction: Excel (.xlsx, .xls), CSV, Word (.docx), PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP PROGRESS INDICATOR */}
        <div className="px-6 py-2.5 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>1</span>
            <span className={step === 1 ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"}>Scope & Context</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>2</span>
            <span className={step === 2 ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"}>File Select</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>3</span>
            <span className={step === 3 ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"}>Extract & Map</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>4</span>
            <span className={step === 4 ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"}>Confirm & Import</span>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: CONTEXT & CATEGORY CONFIRMATION */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold uppercase text-indigo-900 dark:text-indigo-200 tracking-wider">
                  Mandatory Scope & Project Context
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1">Company</label>
                    <div className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      {companyName}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1">Project</label>
                    <div className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      {projectName}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1">Contract Reference</label>
                    <input
                      type="text"
                      value={contractRef}
                      onChange={(e) => setContractRef(e.target.value)}
                      placeholder="e.g. CTR-2026-MAIN"
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1">Reporting Period</label>
                    <input
                      type="month"
                      value={reportingPeriod}
                      onChange={(e) => setReportingPeriod(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Category Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select Commercial Category to Import
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {CATEGORY_OPTIONS.map((cat) => {
                    const isSelected = selectedCategory === cat.category;
                    return (
                      <div
                        key={cat.category}
                        onClick={() => setSelectedCategory(cat.category)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                            {cat.label}
                          </h5>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {cat.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FILE UPLOAD DRAG & DROP */}
          {step === 2 && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.docx,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChosen(e.target.files[0]);
                    }
                  }}
                />

                {isProcessing ? (
                  <div className="py-6 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Reading structured document rows & headers...
                    </p>
                    <p className="text-[11px] text-slate-500">
                      AI is extracting raw values without interpreting or assuming.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Drop your commercial file here, or browse
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Supports Excel (.xlsx, .xls), CSV (.csv), Word (.docx), PDF (.pdf)
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Target Category: {CATEGORY_OPTIONS.find(c => c.category === selectedCategory)?.label}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: EXTRACT, PREVIEW & MAPPING */}
          {step === 3 && parseResult && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400">Source File:</span>{" "}
                  <strong className="text-slate-900 dark:text-white">{parseResult.filename}</strong>{" "}
                  ({parseResult.summaryInfo.totalRows} raw rows detected)
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Deterministic Extraction Ready
                </div>
              </div>

              {/* Review Guidance */}
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl text-xs text-indigo-900 dark:text-indigo-200">
                <p className="font-semibold mb-0.5">Review Field Mappings:</p>
                <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                  Project Matrix extracted the source headers and sample values below. You can Accept, Change Mapping, Ignore, or Flag for Review. Only confirmed mappings are written to live commercial registers.
                </p>
              </div>

              {/* PREVIEW & MAPPING TABLE */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Source Field</th>
                      <th className="py-2.5 px-4">Sample Source Value</th>
                      <th className="py-2.5 px-4">Project Matrix Field</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {mappings.map((m, idx) => {
                      const dupFlag = duplicateFlags[idx];
                      return (
                        <tr key={m.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                            {m.sourceField}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {String(m.sourceValue ?? "—")}
                          </td>
                          <td className="py-2.5 px-4">
                            <select
                              value={m.projectMatrixField}
                              onChange={(e) => updateMappingStatus(idx, e.target.value === "ignore" ? "IGNORED" : "MAPPED", e.target.value)}
                              className="text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="ignore">— Ignore this Column —</option>
                              {canonicalOptions.map((opt) => (
                                <option key={opt.field} value={opt.field}>
                                  {opt.label} ({opt.type})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-4">
                            {m.status === "MAPPED" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Mapped
                              </span>
                            )}
                            {m.status === "FLAGGED_REVIEW" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Review Needed
                              </span>
                            )}
                            {m.status === "IGNORED" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Ignored
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => updateMappingStatus(idx, "MAPPED")}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded text-[10px] font-bold"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => updateMappingStatus(idx, "IGNORED", "ignore")}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded text-[10px] font-bold"
                              >
                                Ignore
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT COMPLETED */}
          {step === 4 && importSummary && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Commercial Data Successfully Imported
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {importSummary.totalImported} verified record(s) persisted to {CATEGORY_OPTIONS.find(c => c.category === selectedCategory)?.label}.
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl max-w-md mx-auto text-xs text-slate-600 dark:text-slate-300 text-left space-y-1">
                <p><strong>Source Document:</strong> {selectedFile?.name}</p>
                <p><strong>Category:</strong> {selectedCategory}</p>
                <p><strong>Project Context:</strong> {projectName}</p>
                <p><strong>Reporting Period:</strong> {reportingPeriod}</p>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            {step > 1 && step < 4 && (
              <button
                onClick={() => setStep((step - 1) as any)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                Continue to File Selection
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Writing Verified Records...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm & Write Active Commercial Data
                  </>
                )}
              </button>
            )}

            {step === 4 && (
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Done & View Register
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
