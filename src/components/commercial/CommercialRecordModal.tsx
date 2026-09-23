import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Upload,
  Paperclip,
  Trash2,
  Calendar,
  DollarSign,
  Building2,
  Tag,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  FileCheck,
  AlertCircle
} from "lucide-react";
import {
  CommercialRecordType,
  CommercialSupportingDocument,
  BudgetLineItem,
  ActualCostRegisterItem,
  CommitmentRegisterItem,
  ClientCertificateRecord,
  SupplierInvoiceRecord,
  BankTransactionRecord
} from "../../types/commercialWorkspace";

interface CommercialRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordType: CommercialRecordType;
  mode?: "CREATE" | "EDIT";
  initialData?: any;
  currency?: string;
  companyId: string;
  projectId?: string;
  onSave: (savedRecord: any) => void;
}

export const CommercialRecordModal: React.FC<CommercialRecordModalProps> = ({
  isOpen,
  onClose,
  recordType,
  mode = "CREATE",
  initialData,
  currency = "USD",
  companyId,
  projectId,
  onSave
}) => {
  // Form State
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [documents, setDocuments] = useState<CommercialSupportingDocument[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or populate form
  useEffect(() => {
    if (!isOpen) return;

    if (initialData && mode === "EDIT") {
      setFormData({ ...initialData });
      setDocuments(initialData.documents ? [...initialData.documents] : []);
    } else {
      const today = new Date().toISOString().split("T")[0];
      const defaultId = `${recordType.toLowerCase()}-${Date.now()}`;

      let defaults: Record<string, any> = {
        id: defaultId,
        companyId,
        projectId,
        currency,
        date: today,
        status: "Approved",
        source: {
          originalFilename: "Manual Entry",
          uploadDate: new Date().toISOString(),
          uploadedBy: "User",
          importStatus: "MANUAL_ENTRY",
          approvalStatus: "APPROVED"
        }
      };

      if (recordType === "ACTUAL_COST") {
        defaults = {
          ...defaults,
          reference: `COST-${Math.floor(1000 + Math.random() * 9000)}`,
          description: "",
          costCode: "",
          supplier: "",
          quantity: "",
          unit: "",
          net: "",
          tax: "",
          total: "",
          paidAmount: "",
          paymentStatus: "Paid",
          sourceType: "Supplier Invoice"
        };
      } else if (recordType === "BUDGET") {
        defaults = {
          ...defaults,
          costCode: "",
          description: "",
          category: "",
          quantity: "",
          unit: "",
          rate: "",
          originalBudget: "",
          approvedChanges: "0",
          revisedBudget: "",
          status: "Approved"
        };
      } else if (recordType === "COMMITMENT") {
        defaults = {
          ...defaults,
          ref: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
          type: "Purchase Order",
          counterparty: "",
          description: "",
          costCode: "",
          originalValue: "",
          changes: "0",
          currentCommitment: "",
          status: "Approved"
        };
      } else if (recordType === "CLIENT_CERTIFICATE") {
        defaults = {
          ...defaults,
          certificateNumber: `IPC-${Math.floor(100 + Math.random() * 900)}`,
          issueDate: today,
          period: `Month ${new Date().getMonth() + 1}`,
          clientName: "",
          appliedAmount: "",
          claimedAmount: "",
          certifiedAmount: "",
          retentionWithheld: "0",
          retentionDeducted: "0",
          invoicedAmount: "",
          paidAmount: "0",
          status: "Certified"
        };
      } else if (recordType === "SUPPLIER_INVOICE") {
        defaults = {
          ...defaults,
          invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
          date: today,
          dueDate: today,
          supplier: "",
          supplierName: "",
          costCode: "",
          description: "",
          net: "",
          tax: "0",
          total: "",
          amount: "",
          paid: "0",
          paidAmount: "0",
          status: "Approved"
        };
      } else if (recordType === "BANK_TRANSACTION") {
        defaults = {
          ...defaults,
          bankAccountId: "acc-main",
          accountName: "Operating Account",
          reference: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
          transactionRef: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
          date: today,
          transactionType: "Payment",
          type: "Outflow",
          payeeOrPayer: "",
          amount: "",
          inflow: "",
          outflow: "",
          reconciled: true,
          status: "Reconciled"
        };
      }

      setFormData(defaults);
      setDocuments([]);
    }
    setErrors({});
  }, [isOpen, recordType, mode, initialData, companyId, projectId, currency]);

  if (!isOpen) return null;

  const getTitle = () => {
    const action = mode === "EDIT" ? "Edit" : "Add";
    switch (recordType) {
      case "BUDGET":
        return `${action} Budget Item`;
      case "ACTUAL_COST":
        return `${action} Cost`;
      case "COMMITMENT":
        return `${action} Commitment (PO / Subcontract)`;
      case "CLIENT_CERTIFICATE":
        return `${action} Client Certificate (IPC)`;
      case "SUPPLIER_INVOICE":
        return `${action} Supplier Invoice`;
      case "BANK_TRANSACTION":
        return `${action} Bank Movement`;
      default:
        return `${action} Record`;
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // Auto-calculations for convenience
      if (recordType === "ACTUAL_COST") {
        if (field === "net" || field === "tax") {
          const net = parseFloat(field === "net" ? value : prev.net) || 0;
          const tax = parseFloat(field === "tax" ? value : prev.tax) || 0;
          next.total = (net + tax).toString();
          if (next.paymentStatus === "Paid") {
            next.paidAmount = next.total;
          }
        }
      } else if (recordType === "BUDGET") {
        if (field === "originalBudget" || field === "approvedChanges") {
          const orig = parseFloat(field === "originalBudget" ? value : prev.originalBudget) || 0;
          const changes = parseFloat(field === "approvedChanges" ? value : prev.approvedChanges) || 0;
          next.revisedBudget = (orig + changes).toString();
        }
      } else if (recordType === "COMMITMENT") {
        if (field === "originalValue" || field === "changes") {
          const orig = parseFloat(field === "originalValue" ? value : prev.originalValue) || 0;
          const changes = parseFloat(field === "changes" ? value : prev.changes) || 0;
          next.currentCommitment = (orig + changes).toString();
        }
      } else if (recordType === "SUPPLIER_INVOICE") {
        if (field === "net" || field === "tax") {
          const net = parseFloat(field === "net" ? value : prev.net) || 0;
          const tax = parseFloat(field === "tax" ? value : prev.tax) || 0;
          const tot = (net + tax).toString();
          next.total = tot;
          next.amount = tot;
        }
      }

      return next;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fileData = event.target?.result as string;
        const newDoc: CommercialSupportingDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type: recordType === "CLIENT_CERTIFICATE" ? "Payment Certificate" : recordType === "SUPPLIER_INVOICE" ? "Supplier Invoice" : recordType === "ACTUAL_COST" ? "Receipt" : "Quotation",
          size: `${(file.size / 1024).toFixed(1)} KB`,
          fileType: file.type || file.name.split(".").pop() || "unknown",
          fileData,
          uploadedBy: "Authorized User",
          uploadedOn: new Date().toISOString().split("T")[0],
          version: 1
        };
        setDocuments((prev) => [...prev, newDoc]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveDoc = (docId: string) => {
    assertOperationalAction("delete", "components/commercial/CommercialRecordModal.tsx");
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/commercial/CommercialRecordModal.tsx");
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (recordType === "ACTUAL_COST") {
      if (!formData.description?.trim()) newErrors.description = "Description is required";
      if (!formData.supplier?.trim()) newErrors.supplier = "Supplier is required";
      if (!formData.net && !formData.total) newErrors.net = "Amount is required";
    } else if (recordType === "BUDGET") {
      if (!formData.costCode?.trim()) newErrors.costCode = "Cost Code is required";
      if (!formData.description?.trim()) newErrors.description = "Description is required";
      if (!formData.originalBudget) newErrors.originalBudget = "Budget amount is required";
    } else if (recordType === "COMMITMENT") {
      if (!formData.ref?.trim()) newErrors.ref = "Reference / PO # is required";
      if (!formData.counterparty?.trim()) newErrors.counterparty = "Counterparty / Supplier is required";
      if (!formData.description?.trim()) newErrors.description = "Description is required";
      if (!formData.originalValue) newErrors.originalValue = "Original value is required";
    } else if (recordType === "CLIENT_CERTIFICATE") {
      if (!formData.certificateNumber?.trim()) newErrors.certificateNumber = "Certificate # is required";
      if (!formData.clientName?.trim()) newErrors.clientName = "Client Name is required";
      if (!formData.certifiedAmount && !formData.appliedAmount) newErrors.certifiedAmount = "Certified amount is required";
    } else if (recordType === "SUPPLIER_INVOICE") {
      if (!formData.invoiceNumber?.trim()) newErrors.invoiceNumber = "Invoice # is required";
      const sup = formData.supplier || formData.supplierName;
      if (!sup?.trim()) newErrors.supplier = "Supplier is required";
      if (!formData.total && !formData.net) newErrors.net = "Amount is required";
    } else if (recordType === "BANK_TRANSACTION") {
      if (!formData.reference?.trim() && !formData.transactionRef?.trim()) newErrors.reference = "Reference is required";
      if (!formData.amount && !formData.inflow && !formData.outflow) newErrors.amount = "Amount is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Format numbers
    const cleanRecord = { ...formData, documents };

    if (recordType === "ACTUAL_COST") {
      cleanRecord.net = formData.net !== "" && formData.net !== undefined ? parseFloat(formData.net) : null;
      cleanRecord.tax = formData.tax !== "" && formData.tax !== undefined ? parseFloat(formData.tax) : 0;
      cleanRecord.total = formData.total !== "" && formData.total !== undefined ? parseFloat(formData.total) : cleanRecord.net;
      cleanRecord.paidAmount = formData.paidAmount !== "" && formData.paidAmount !== undefined ? parseFloat(formData.paidAmount) : (cleanRecord.paymentStatus === "Paid" ? cleanRecord.total : 0);
      cleanRecord.outstandingAmount = Math.max(0, (cleanRecord.total || 0) - (cleanRecord.paidAmount || 0));
    } else if (recordType === "BUDGET") {
      cleanRecord.originalBudget = formData.originalBudget !== "" && formData.originalBudget !== undefined ? parseFloat(formData.originalBudget) : null;
      cleanRecord.approvedChanges = formData.approvedChanges !== "" && formData.approvedChanges !== undefined ? parseFloat(formData.approvedChanges) : 0;
      cleanRecord.revisedBudget = (cleanRecord.originalBudget || 0) + (cleanRecord.approvedChanges || 0);
      cleanRecord.quantity = formData.quantity ? parseFloat(formData.quantity) : null;
      cleanRecord.rate = formData.rate ? parseFloat(formData.rate) : null;
    } else if (recordType === "COMMITMENT") {
      cleanRecord.originalValue = formData.originalValue !== "" && formData.originalValue !== undefined ? parseFloat(formData.originalValue) : null;
      cleanRecord.changes = formData.changes !== "" && formData.changes !== undefined ? parseFloat(formData.changes) : 0;
      cleanRecord.currentCommitment = (cleanRecord.originalValue || 0) + (cleanRecord.changes || 0);
      cleanRecord.paid = formData.paid !== "" && formData.paid !== undefined ? parseFloat(formData.paid) : 0;
      cleanRecord.outstanding = Math.max(0, (cleanRecord.currentCommitment || 0) - (cleanRecord.paid || 0));
      cleanRecord.supplier = formData.counterparty;
      cleanRecord.supplierName = formData.counterparty;
    } else if (recordType === "CLIENT_CERTIFICATE") {
      cleanRecord.appliedAmount = formData.appliedAmount !== "" && formData.appliedAmount !== undefined ? parseFloat(formData.appliedAmount) : null;
      cleanRecord.claimedAmount = cleanRecord.appliedAmount;
      cleanRecord.certifiedAmount = formData.certifiedAmount !== "" && formData.certifiedAmount !== undefined ? parseFloat(formData.certifiedAmount) : cleanRecord.appliedAmount;
      cleanRecord.retentionWithheld = formData.retentionWithheld !== "" && formData.retentionWithheld !== undefined ? parseFloat(formData.retentionWithheld) : 0;
      cleanRecord.retentionDeducted = cleanRecord.retentionWithheld;
      cleanRecord.paidAmount = formData.paidAmount !== "" && formData.paidAmount !== undefined ? parseFloat(formData.paidAmount) : 0;
      const netPayable = (cleanRecord.certifiedAmount || 0) - (cleanRecord.retentionWithheld || 0);
      cleanRecord.invoicedAmount = netPayable;
      cleanRecord.outstandingAmount = Math.max(0, netPayable - (cleanRecord.paidAmount || 0));
    } else if (recordType === "SUPPLIER_INVOICE") {
      cleanRecord.net = formData.net !== "" && formData.net !== undefined ? parseFloat(formData.net) : null;
      cleanRecord.tax = formData.tax !== "" && formData.tax !== undefined ? parseFloat(formData.tax) : 0;
      cleanRecord.total = formData.total !== "" && formData.total !== undefined ? parseFloat(formData.total) : cleanRecord.net;
      cleanRecord.amount = cleanRecord.total;
      cleanRecord.supplier = formData.supplier || formData.supplierName;
      cleanRecord.supplierName = cleanRecord.supplier;
      cleanRecord.paid = formData.paid !== "" && formData.paid !== undefined ? parseFloat(formData.paid) : (formData.paidAmount ? parseFloat(formData.paidAmount) : 0);
      cleanRecord.paidAmount = cleanRecord.paid;
      cleanRecord.outstanding = Math.max(0, (cleanRecord.total || 0) - (cleanRecord.paid || 0));
    } else if (recordType === "BANK_TRANSACTION") {
      const amt = formData.amount !== "" && formData.amount !== undefined ? parseFloat(formData.amount) : 0;
      cleanRecord.amount = amt;
      cleanRecord.reference = formData.reference || formData.transactionRef;
      cleanRecord.transactionRef = cleanRecord.reference;
      if (formData.transactionType === "Receipt" || formData.type === "Inflow") {
        cleanRecord.inflow = amt;
        cleanRecord.outflow = null;
        cleanRecord.type = "Inflow";
      } else {
        cleanRecord.outflow = amt;
        cleanRecord.inflow = null;
        cleanRecord.type = "Outflow";
      }
      cleanRecord.reconciled = Boolean(formData.reconciled);
    }

    onSave(cleanRecord);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {getTitle()}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter details below. All fields marked with * are required.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto">
          
          {/* COST RECORD FORM */}
          {recordType === "ACTUAL_COST" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date || ""}
                    onChange={(e) => handleFieldChange("date", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Reference / Invoice Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9021 or TX-44"
                    value={formData.reference || ""}
                    onChange={(e) => handleFieldChange("reference", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Concrete pour section 3 or Plant rental"
                  value={formData.description || ""}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                    errors.description ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                  } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  required
                />
                {errors.description && (
                  <span className="text-[10px] font-bold text-rose-500 mt-0.5 block">{errors.description}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cost Code / Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 03-3000 Concrete or SUB-04"
                    value={formData.costCode || ""}
                    onChange={(e) => handleFieldChange("costCode", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Supplier / Vendor *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Materials Ltd"
                    value={formData.supplier || ""}
                    onChange={(e) => handleFieldChange("supplier", e.target.value)}
                    className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                      errors.supplier ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                    } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    required
                  />
                  {errors.supplier && (
                    <span className="text-[10px] font-bold text-rose-500 mt-0.5 block">{errors.supplier}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Net Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.net || ""}
                    onChange={(e) => handleFieldChange("net", e.target.value)}
                    className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                      errors.net ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                    } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold`}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    VAT / Tax ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.tax || ""}
                    onChange={(e) => handleFieldChange("tax", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Total Amount ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.total || ""}
                    onChange={(e) => handleFieldChange("total", e.target.value)}
                    className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Payment Status
                  </label>
                  <select
                    value={formData.paymentStatus || "Paid"}
                    onChange={(e) => handleFieldChange("paymentStatus", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cost Type
                  </label>
                  <select
                    value={formData.sourceType || "Supplier Invoice"}
                    onChange={(e) => handleFieldChange("sourceType", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Supplier Invoice">Supplier Invoice</option>
                    <option value="Tax Invoice">Tax Invoice</option>
                    <option value="Receipt">Receipt / Cash Voucher</option>
                    <option value="Labour Payroll">Labour / Payroll</option>
                    <option value="Direct Expense">Direct Expense</option>
                    <option value="Delivery Note">Delivery Note</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* BUDGET RECORD FORM */}
          {recordType === "BUDGET" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cost Code / Category Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 02-1000 or SUB-CIVIL"
                    value={formData.costCode || ""}
                    onChange={(e) => handleFieldChange("costCode", e.target.value)}
                    className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                      errors.costCode ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                    } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono`}
                    required
                  />
                  {errors.costCode && (
                    <span className="text-[10px] font-bold text-rose-500 mt-0.5 block">{errors.costCode}</span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    WBS / Trade Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Earthworks, Substructure"
                    value={formData.category || formData.wbs || ""}
                    onChange={(e) => handleFieldChange("category", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Budget Item Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Excavation and site preparation"
                  value={formData.description || ""}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                    errors.description ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                  } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  required
                />
                {errors.description && (
                  <span className="text-[10px] font-bold text-rose-500 mt-0.5 block">{errors.description}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Original Budget ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.originalBudget || ""}
                    onChange={(e) => handleFieldChange("originalBudget", e.target.value)}
                    className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                      errors.originalBudget ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                    } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold`}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Approved Changes ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.approvedChanges || "0"}
                    onChange={(e) => handleFieldChange("approvedChanges", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Revised Budget ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.revisedBudget || ""}
                    onChange={(e) => handleFieldChange("revisedBudget", e.target.value)}
                    className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* COMMITMENT RECORD FORM */}
          {recordType === "COMMITMENT" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Commitment Type *
                  </label>
                  <select
                    value={formData.type || "Purchase Order"}
                    onChange={(e) => handleFieldChange("type", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Purchase Order">Purchase Order (PO)</option>
                    <option value="Subcontract">Subcontract Agreement</option>
                    <option value="Supplier Order">Supplier Order</option>
                    <option value="Rental Agreement">Plant / Equipment Rental</option>
                    <option value="Service Agreement">Professional Service Agreement</option>
                    <option value="Approved Variation">Approved Variation</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Reference / PO Number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-4091 or SC-01"
                    value={formData.ref || ""}
                    onChange={(e) => handleFieldChange("ref", e.target.value)}
                    className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                      errors.ref ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                    } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold`}
                    required
                  />
                  {errors.ref && (
                    <span className="text-[10px] font-bold text-rose-500 mt-0.5 block">{errors.ref}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Counterparty / Supplier *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. StructurePro Engineering"
                    value={formData.counterparty || ""}
                    onChange={(e) => handleFieldChange("counterparty", e.target.value)}
                    className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                      errors.counterparty ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                    } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    required
                  />
                  {errors.counterparty && (
                    <span className="text-[10px] font-bold text-rose-500 mt-0.5 block">{errors.counterparty}</span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cost Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 05-1000 Structural Steel"
                    value={formData.costCode || ""}
                    onChange={(e) => handleFieldChange("costCode", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description / Scope of Work *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Steel beams supply, delivery and site erection"
                  value={formData.description || ""}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                    errors.description ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                  } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  required
                />
                {errors.description && (
                  <span className="text-[10px] font-bold text-rose-500 mt-0.5 block">{errors.description}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Original Value ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.originalValue || ""}
                    onChange={(e) => handleFieldChange("originalValue", e.target.value)}
                    className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                      errors.originalValue ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                    } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold`}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Variations ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.changes || "0"}
                    onChange={(e) => handleFieldChange("changes", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Current Commitment ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.currentCommitment || ""}
                    onChange={(e) => handleFieldChange("currentCommitment", e.target.value)}
                    className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CLIENT CERTIFICATE FORM */}
          {recordType === "CLIENT_CERTIFICATE" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Certificate / IPC # *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IPC-001 or VAL-04"
                    value={formData.certificateNumber || ""}
                    onChange={(e) => handleFieldChange("certificateNumber", e.target.value)}
                    className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                      errors.certificateNumber ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                    } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold`}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Issue Date *
                  </label>
                  <input
                    type="date"
                    value={formData.issueDate || formData.date || ""}
                    onChange={(e) => handleFieldChange("issueDate", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Valuation Period
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Month 4 (August 2026)"
                    value={formData.period || ""}
                    onChange={(e) => handleFieldChange("period", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Global Real Estate Developers Inc."
                  value={formData.clientName || ""}
                  onChange={(e) => handleFieldChange("clientName", e.target.value)}
                  className={`w-full text-xs bg-slate-50 dark:bg-slate-800 border ${
                    errors.clientName ? "border-rose-500" : "border-slate-300 dark:border-slate-700"
                  } rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500`}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Claimed / Applied ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.appliedAmount || formData.claimedAmount || ""}
                    onChange={(e) => {
                      handleFieldChange("appliedAmount", e.target.value);
                      handleFieldChange("claimedAmount", e.target.value);
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Certified Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.certifiedAmount || ""}
                    onChange={(e) => handleFieldChange("certifiedAmount", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Retention Withheld ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.retentionWithheld || formData.retentionDeducted || "0"}
                    onChange={(e) => {
                      handleFieldChange("retentionWithheld", e.target.value);
                      handleFieldChange("retentionDeducted", e.target.value);
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Amount Received / Paid ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.paidAmount || "0"}
                    onChange={(e) => handleFieldChange("paidAmount", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || "Certified"}
                    onChange={(e) => handleFieldChange("status", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Certified">Certified</option>
                    <option value="Invoiced">Invoiced</option>
                    <option value="Received">Received / Paid</option>
                    <option value="Fully Paid">Fully Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Submitted">Submitted (Pending)</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SUPPLIER INVOICE FORM */}
          {recordType === "SUPPLIER_INVOICE" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Invoice # *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SINV-8941"
                    value={formData.invoiceNumber || ""}
                    onChange={(e) => handleFieldChange("invoiceNumber", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date || ""}
                    onChange={(e) => handleFieldChange("date", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate || ""}
                    onChange={(e) => handleFieldChange("dueDate", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Supplier / Subcontractor *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Concrete Supplies"
                    value={formData.supplier || formData.supplierName || ""}
                    onChange={(e) => {
                      handleFieldChange("supplier", e.target.value);
                      handleFieldChange("supplierName", e.target.value);
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Linked PO / Subcontract Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-4091"
                    value={formData.poReference || formData.commitmentRef || ""}
                    onChange={(e) => {
                      handleFieldChange("poReference", e.target.value);
                      handleFieldChange("commitmentRef", e.target.value);
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Net Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.net || ""}
                    onChange={(e) => handleFieldChange("net", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    VAT / Tax ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.tax || "0"}
                    onChange={(e) => handleFieldChange("tax", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Total Amount ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.total || formData.amount || ""}
                    onChange={(e) => {
                      handleFieldChange("total", e.target.value);
                      handleFieldChange("amount", e.target.value);
                    }}
                    className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* BANK TRANSACTION FORM */}
          {recordType === "BANK_TRANSACTION" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Movement Type *
                  </label>
                  <select
                    value={formData.type || (formData.transactionType === "Receipt" ? "Inflow" : "Outflow")}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange("type", val);
                      handleFieldChange("transactionType", val === "Inflow" ? "Receipt" : "Payment");
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Outflow">Payment / Outflow</option>
                    <option value="Inflow">Receipt / Inflow</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date || ""}
                    onChange={(e) => handleFieldChange("date", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tx Reference *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TX-9901 or CHQ-0041"
                    value={formData.reference || formData.transactionRef || ""}
                    onChange={(e) => {
                      handleFieldChange("reference", e.target.value);
                      handleFieldChange("transactionRef", e.target.value);
                    }}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Payee / Payer *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Supplier Name or Client Name"
                    value={formData.payeeOrPayer || ""}
                    onChange={(e) => handleFieldChange("payeeOrPayer", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount || formData.inflow || formData.outflow || ""}
                    onChange={(e) => handleFieldChange("amount", e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-amber-600"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* NOTES FIELD (Common to all) */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Notes & Comments (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add any specific context or remarks for this record..."
              value={formData.notes || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* ATTACHMENTS (Drag & Drop / Upload directly inside the form) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                Supporting Documents ({documents.length})
              </label>
              <span className="text-[10px] text-slate-400">
                PDF, JPG, PNG, XLSX, DOCX
              </span>
            </div>

            {/* Hidden input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
              id="commercial-form-file-upload"
            />

            {/* Document list */}
            {documents.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                        {doc.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({doc.size || "file"})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(doc.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="Remove attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add attachment trigger button */}
            <label
              htmlFor="commercial-form-file-upload"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Attach File / Supporting Evidence</span>
            </label>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
