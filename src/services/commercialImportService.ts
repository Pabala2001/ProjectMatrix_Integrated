import * as XLSX from "xlsx";
import {
  CommercialCategory,
  SourceProvenance,
  ImportFieldMapping
} from "../types/commercialWorkspace";

export interface ParsedDocumentResult {
  filename: string;
  fileType: "xlsx" | "csv" | "docx" | "pdf";
  sheetNames?: string[];
  rawText?: string;
  rawRows: Record<string, any>[];
  headers: string[];
  proposedMappings: ImportFieldMapping[];
  summaryInfo: {
    totalRows: number;
    detectedCategory: CommercialCategory;
    extractedTitle?: string;
    detectedDate?: string;
  };
}

// Canonical Project Matrix Fields per Category
export const CANONICAL_FIELDS_BY_CATEGORY: Record<CommercialCategory, { field: string; label: string; type: "string" | "number" | "date" }[]> = {
  BOQ: [
    { field: "itemCode", label: "Item / Pay Item Code", type: "string" },
    { field: "description", label: "Description of Work", type: "string" },
    { field: "unit", label: "Unit of Measurement", type: "string" },
    { field: "quantity", label: "Tender / Baseline Quantity", type: "number" },
    { field: "rate", label: "Contract Unit Rate", type: "number" },
    { field: "amount", label: "Total Amount", type: "number" }
  ],
  CONTRACT_VALUE: [
    { field: "contractReference", label: "Contract Reference", type: "string" },
    { field: "originalContractValue", label: "Original Contract Value (Excl VAT)", type: "number" },
    { field: "approvedVariations", label: "Approved Variations", type: "number" },
    { field: "revisedContractValue", label: "Revised Contract Value", type: "number" },
    { field: "currency", label: "Contract Currency", type: "string" }
  ],
  BUDGET: [
    { field: "costCode", label: "Cost Code", type: "string" },
    { field: "description", label: "Description", type: "string" },
    { field: "originalBudget", label: "Original Budget", type: "number" },
    { field: "approvedChanges", label: "Approved Changes / Variations", type: "number" },
    { field: "revisedBudget", label: "Revised Budget", type: "number" }
  ],
  FORECAST: [
    { field: "costCode", label: "Cost Code", type: "string" },
    { field: "description", label: "Description", type: "string" },
    { field: "revisedBudget", label: "Revised Budget", type: "number" },
    { field: "actualCost", label: "Actual Cost to Date", type: "number" },
    { field: "commitments", label: "Open Commitments", type: "number" },
    { field: "forecastToComplete", label: "Forecast Cost to Complete (ETC)", type: "number" },
    { field: "forecastFinalCost", label: "Forecast Final Cost (EAC)", type: "number" }
  ],
  PAYMENT_CERTIFICATE: [
    { field: "certificateNumber", label: "Certificate Number", type: "string" },
    { field: "period", label: "Valuation Period", type: "string" },
    { field: "appliedAmount", label: "Applied / Claimed Amount", type: "number" },
    { field: "certifiedAmount", label: "Certified Amount (Net)", type: "number" },
    { field: "invoicedAmount", label: "Invoiced Amount", type: "number" },
    { field: "paidAmount", label: "Verified Paid Amount", type: "number" },
    { field: "retentionWithheld", label: "Retention Withheld", type: "number" },
    { field: "outstandingAmount", label: "Outstanding Balance", type: "number" },
    { field: "status", label: "Certificate Status", type: "string" }
  ],
  PAYMENT_APPLICATION: [
    { field: "claimNumber", label: "Application / Claim Number", type: "string" },
    { field: "period", label: "Claim Period", type: "string" },
    { field: "grossAmount", label: "Gross Claimed Amount", type: "number" },
    { field: "netAmount", label: "Net Claimed Amount", type: "number" }
  ],
  CLIENT_INVOICE: [
    { field: "invoiceNumber", label: "Invoice Number", type: "string" },
    { field: "date", label: "Invoice Date", type: "date" },
    { field: "dueDate", label: "Payment Due Date", type: "date" },
    { field: "net", label: "Net Amount (Excl VAT)", type: "number" },
    { field: "tax", label: "VAT / Tax", type: "number" },
    { field: "total", label: "Total Amount (Incl VAT)", type: "number" },
    { field: "paid", label: "Amount Received", type: "number" }
  ],
  SUPPLIER_INVOICE: [
    { field: "invoiceNumber", label: "Supplier Invoice Number", type: "string" },
    { field: "supplier", label: "Supplier / Subcontractor Name", type: "string" },
    { field: "date", label: "Invoice Date", type: "date" },
    { field: "dueDate", label: "Due Date", type: "date" },
    { field: "commitmentRef", label: "PO / Subcontract Ref", type: "string" },
    { field: "net", label: "Net Amount (Excl VAT)", type: "number" },
    { field: "tax", label: "VAT / Tax Amount", type: "number" },
    { field: "total", label: "Total Amount (Incl VAT)", type: "number" },
    { field: "paid", label: "Verified Paid Amount", type: "number" },
    { field: "outstanding", label: "Outstanding Balance", type: "number" },
    { field: "status", label: "Approval Status", type: "string" }
  ],
  PURCHASE_ORDER: [
    { field: "ref", label: "PO Reference Number", type: "string" },
    { field: "counterparty", label: "Supplier", type: "string" },
    { field: "description", label: "Description", type: "string" },
    { field: "originalValue", label: "PO Value (Excl VAT)", type: "number" },
    { field: "changes", label: "Approved Variations", type: "number" },
    { field: "currentCommitment", label: "Total Commitment Value", type: "number" },
    { field: "status", label: "Status", type: "string" }
  ],
  SUBCONTRACT: [
    { field: "ref", label: "Subcontract Reference", type: "string" },
    { field: "counterparty", label: "Subcontractor Name", type: "string" },
    { field: "description", label: "Package / Scope of Work", type: "string" },
    { field: "originalValue", label: "Contract Sum", type: "number" },
    { field: "changes", label: "Approved Variations", type: "number" },
    { field: "currentCommitment", label: "Revised Contract Sum", type: "number" }
  ],
  COMMITMENT: [
    { field: "ref", label: "Reference Number", type: "string" },
    { field: "counterparty", label: "Supplier / Subcontractor", type: "string" },
    { field: "description", label: "Description", type: "string" },
    { field: "type", label: "Commitment Type", type: "string" },
    { field: "originalValue", label: "Original Value", type: "number" },
    { field: "changes", label: "Changes", type: "number" },
    { field: "currentCommitment", label: "Current Commitment", type: "number" },
    { field: "paid", label: "Paid to Date", type: "number" },
    { field: "outstanding", label: "Outstanding Commitment", type: "number" },
    { field: "status", label: "Status", type: "string" }
  ],
  ACTUAL_COST: [
    { field: "date", label: "Posting Date", type: "date" },
    { field: "costCode", label: "Cost Code", type: "string" },
    { field: "description", label: "Description", type: "string" },
    { field: "supplier", label: "Supplier / Resource", type: "string" },
    { field: "reference", label: "Source Reference", type: "string" },
    { field: "net", label: "Net Cost (Excl Tax)", type: "number" },
    { field: "tax", label: "Tax Amount", type: "number" },
    { field: "total", label: "Total Cost", type: "number" },
    { field: "sourceType", label: "Source Type", type: "string" }
  ],
  CASH_FLOW: [
    { field: "date", label: "Transaction Date", type: "date" },
    { field: "reference", label: "Reference", type: "string" },
    { field: "payeeOrPayer", label: "Payee / Payer", type: "string" },
    { field: "inflow", label: "Cash Inflow", type: "number" },
    { field: "outflow", label: "Cash Outflow", type: "number" },
    { field: "balanceAfter", label: "Balance", type: "number" }
  ],
  BANK_TRANSACTION: [
    { field: "date", label: "Date", type: "date" },
    { field: "reference", label: "Reference", type: "string" },
    { field: "payeeOrPayer", label: "Payee / Payer", type: "string" },
    { field: "inflow", label: "Deposit / Inflow", type: "number" },
    { field: "outflow", label: "Withdrawal / Outflow", type: "number" },
    { field: "status", label: "Status", type: "string" }
  ],
  VARIATION: [
    { field: "ref", label: "Variation Ref (VO / CE)", type: "string" },
    { field: "description", label: "Variation Description", type: "string" },
    { field: "amount", label: "Approved Amount", type: "number" },
    { field: "status", label: "Approval Status", type: "string" }
  ],
  RETENTION: [
    { field: "certificateNumber", label: "Certificate / Period", type: "string" },
    { field: "retentionWithheld", label: "Retention Amount", type: "number" }
  ],
  TAX: [
    { field: "reference", label: "Invoice / Certificate Ref", type: "string" },
    { field: "tax", label: "Tax / VAT Amount", type: "number" }
  ],
  PAYMENT_RECEIVED: [
    { field: "date", label: "Receipt Date", type: "date" },
    { field: "reference", label: "Receipt Number", type: "string" },
    { field: "payeeOrPayer", label: "Client Name", type: "string" },
    { field: "inflow", label: "Received Amount", type: "number" }
  ],
  PAYMENT_MADE: [
    { field: "date", label: "Payment Date", type: "date" },
    { field: "reference", label: "Payment Reference", type: "string" },
    { field: "payeeOrPayer", label: "Supplier / Subcontractor", type: "string" },
    { field: "outflow", label: "Paid Amount", type: "number" }
  ],
  OUTSTANDING_BALANCE: [
    { field: "reference", label: "Account / Entity", type: "string" },
    { field: "outstanding", label: "Outstanding Amount", type: "number" }
  ]
};

export class CommercialImportService {
  /**
   * Parse uploaded file into tabular rows and suggest mappings
   */
  static async parseFile(
    file: File,
    targetCategory: CommercialCategory
  ): Promise<ParsedDocumentResult> {
    const filename = file.name;
    const lower = filename.toLowerCase();

    let fileType: "xlsx" | "csv" | "docx" | "pdf" = "xlsx";
    if (lower.endsWith(".csv")) fileType = "csv";
    else if (lower.endsWith(".docx")) fileType = "docx";
    else if (lower.endsWith(".pdf")) fileType = "pdf";

    if (fileType === "xlsx" || fileType === "csv") {
      return this.parseSpreadsheet(file, targetCategory, fileType);
    } else if (fileType === "pdf") {
      return this.parsePDFOrDocxText(file, targetCategory, "pdf");
    } else {
      return this.parsePDFOrDocxText(file, targetCategory, "docx");
    }
  }

  /**
   * Parse Excel or CSV
   */
  private static async parseSpreadsheet(
    file: File,
    targetCategory: CommercialCategory,
    fileType: "xlsx" | "csv"
  ): Promise<ParsedDocumentResult> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0] || "Sheet1";
    const worksheet = workbook.Sheets[firstSheetName];

    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      raw: false
    });

    const headers: string[] = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    const canonicalFields = CANONICAL_FIELDS_BY_CATEGORY[targetCategory] || [];
    const candidateFieldNames = canonicalFields.map(f => f.field);

    const proposedMappings: ImportFieldMapping[] = headers.map((hdr, idx) => {
      const match = this.suggestMatchingField(hdr, canonicalFields);
      const sampleVal = rawRows.find(r => r[hdr] !== null && r[hdr] !== undefined)?.[hdr] ?? "—";
      return {
        id: `map-${idx}-${Date.now()}`,
        sourceField: hdr,
        sourceValue: sampleVal,
        projectMatrixField: match.field,
        status: match.field !== "ignore" ? "MAPPED" : "FLAGGED_REVIEW",
        confidenceScore: match.confidence,
        candidateFields: ["ignore", ...candidateFieldNames]
      };
    });

    return {
      filename: file.name,
      fileType,
      sheetNames: workbook.SheetNames,
      rawRows,
      headers,
      proposedMappings,
      summaryInfo: {
        totalRows: rawRows.length,
        detectedCategory: targetCategory
      }
    };
  }

  /**
   * Parse PDF or Word document lines
   */
  private static async parsePDFOrDocxText(
    file: File,
    targetCategory: CommercialCategory,
    fileType: "pdf" | "docx"
  ): Promise<ParsedDocumentResult> {
    // Read text buffer
    const text = await file.text().catch(() => "");
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const rawRows: Record<string, any>[] = [];
    const canonicalFields = CANONICAL_FIELDS_BY_CATEGORY[targetCategory] || [];

    // Extract structured key: value lines or comma/tab separated lines
    for (const line of lines) {
      if (line.includes(":") || line.includes("=") || line.includes(",") || line.includes("\t")) {
        const parts = line.includes(":")
          ? line.split(":")
          : line.includes("=")
          ? line.split("=")
          : line.includes(",")
          ? line.split(",")
          : line.split("\t");

        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join(" ").trim();
          rawRows.push({ Field: key, Value: val });
        }
      }
    }

    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : ["Field", "Value"];
    const candidateFieldNames = canonicalFields.map(f => f.field);

    const proposedMappings: ImportFieldMapping[] = headers.map((hdr, idx) => {
      const match = this.suggestMatchingField(hdr, canonicalFields);
      const sampleVal = rawRows[0]?.[hdr] ?? "—";
      return {
        id: `map-text-${idx}-${Date.now()}`,
        sourceField: hdr,
        sourceValue: sampleVal,
        projectMatrixField: match.field,
        status: match.field !== "ignore" ? "MAPPED" : "FLAGGED_REVIEW",
        confidenceScore: match.confidence,
        candidateFields: ["ignore", ...candidateFieldNames]
      };
    });

    return {
      filename: file.name,
      fileType,
      rawText: text.slice(0, 2000),
      rawRows,
      headers,
      proposedMappings,
      summaryInfo: {
        totalRows: rawRows.length,
        detectedCategory: targetCategory
      }
    };
  }

  /**
   * Suggest best matching canonical field using normalized token overlap
   */
  private static suggestMatchingField(
    sourceHeader: string,
    canonicalFields: { field: string; label: string; type: string }[]
  ): { field: string; confidence: number } {
    const normHdr = sourceHeader.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const cf of canonicalFields) {
      const normField = cf.field.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normLabel = cf.label.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (normHdr === normField || normHdr === normLabel) {
        return { field: cf.field, confidence: 1.0 };
      }
      if (normHdr.includes(normField) || normField.includes(normHdr)) {
        return { field: cf.field, confidence: 0.85 };
      }
    }

    // Heuristics
    if (normHdr.includes("code") || normHdr.includes("item") || normHdr.includes("wbs")) {
      const match = canonicalFields.find(c => c.field === "costCode" || c.field === "itemCode");
      if (match) return { field: match.field, confidence: 0.8 };
    }
    if (normHdr.includes("desc") || normHdr.includes("activity") || normHdr.includes("scope")) {
      const match = canonicalFields.find(c => c.field === "description");
      if (match) return { field: match.field, confidence: 0.8 };
    }
    if (normHdr.includes("amount") || normHdr.includes("total") || normHdr.includes("sum") || normHdr.includes("val")) {
      const match = canonicalFields.find(c => c.field === "revisedBudget" || c.field === "amount" || c.field === "total" || c.field === "originalBudget");
      if (match) return { field: match.field, confidence: 0.75 };
    }
    if (normHdr.includes("cert") || normHdr.includes("ipc")) {
      const match = canonicalFields.find(c => c.field === "certifiedAmount" || c.field === "certificateNumber");
      if (match) return { field: match.field, confidence: 0.85 };
    }
    if (normHdr.includes("inv") || normHdr.includes("bill")) {
      const match = canonicalFields.find(c => c.field === "invoiceNumber" || c.field === "invoicedAmount");
      if (match) return { field: match.field, confidence: 0.85 };
    }
    if (normHdr.includes("suppl") || normHdr.includes("vendor") || normHdr.includes("subcon")) {
      const match = canonicalFields.find(c => c.field === "supplier" || c.field === "counterparty");
      if (match) return { field: match.field, confidence: 0.85 };
    }
    if (normHdr.includes("po") || normHdr.includes("order") || normHdr.includes("ref")) {
      const match = canonicalFields.find(c => c.field === "ref" || c.field === "reference" || c.field === "commitmentRef");
      if (match) return { field: match.field, confidence: 0.8 };
    }

    return { field: "ignore", confidence: 0.0 };
  }

  /**
   * Helper to safely extract a number without guessing
   */
  static parseNumber(val: any): number | null {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number") return isNaN(val) ? null : val;
    if (typeof val === "string") {
      const clean = val.replace(/[^0-9.-]/g, "");
      if (clean === "" || clean === "-" || clean === ".") return null;
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }
}
