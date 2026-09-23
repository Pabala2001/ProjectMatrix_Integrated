import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { 
  X, 
  Coins, 
  Receipt, 
  FileText, 
  FileCheck2, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";
import { 
  CommercialTransactionType, 
  CommercialTransactionCategory, 
  CommercialCostElement,
  CommercialQuantityType,
  BoQItemCommercial
} from "../../types/commercial";

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  boqItems: BoQItemCommercial[];
  projectId?: string | null;
  projectName?: string;
  currencySymbol: string;
  onPostTransaction: (tx: {
    project_id: string;
    boq_item_id?: string;
    boq_item_code?: string;
    type: CommercialTransactionType;
    category: CommercialTransactionCategory;
    cost_element: CommercialCostElement;
    date: string;
    reference: string;
    description: string;
    vendor_client?: string;
    quantity_delta?: number;
    quantity_type?: CommercialQuantityType;
    unit_cost_rate?: number;
    amount: number;
    currency: string;
    status: "POSTED" | "APPROVED";
    created_by: string;
    notes?: string;
  }) => void;
}

export function NewTransactionModal({
  isOpen,
  onClose,
  boqItems,
  projectId,
  projectName,
  currencySymbol,
  onPostTransaction
}: NewTransactionModalProps) {
  const [selectedBoqId, setSelectedBoqId] = useState<string>(boqItems[0]?.id || "");
  const [txType, setTxType] = useState<CommercialTransactionType>("ACTUAL_INVOICE");
  const [costElement, setCostElement] = useState<CommercialCostElement>("MATERIALS");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState<string>("");
  const [vendorClient, setVendorClient] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [quantityDelta, setQuantityDelta] = useState<number>(0);
  const [quantityType, setQuantityType] = useState<CommercialQuantityType>("EXECUTED");
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [createdBy, setCreatedBy] = useState<string>("Commercial Manager / QS");

  if (!isOpen) return null;

  const selectedBoq = boqItems.find(i => i.id === selectedBoqId);

  // Derive transaction category from transaction type
  const getCategoryFromType = (type: CommercialTransactionType): CommercialTransactionCategory => {
    switch (type) {
      case "BUDGET_ORIGINAL":
      case "BUDGET_VARIATION":
        return "BUDGET";
      case "COMMITMENT_PO":
      case "COMMITMENT_SUBCONTRACT":
        return "COMMITMENT";
      case "ACTUAL_INVOICE":
      case "ACTUAL_PAYROLL":
      case "ACTUAL_PLANT_DOCKET":
      case "ACTUAL_MATERIAL_DELIVERY":
        return "ACTUAL_COST";
      case "ACCRUAL_COST":
        return "ACCRUAL";
      case "FORECAST_ADJUSTMENT":
        return "FORECAST";
      case "REVENUE_VALUATION":
      case "REVENUE_IPC_CERTIFICATE":
        return "REVENUE_CERTIFIED";
      case "REVENUE_RECEIPT":
        return "REVENUE_PAID";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/commercial/NewTransactionModal.tsx");
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      alert("Please enter a valid description and positive transaction amount.");
      return;
    }

    const category = getCategoryFromType(txType);

    onPostTransaction({
      project_id: projectId || "default_project",
      boq_item_id: selectedBoq?.id,
      boq_item_code: selectedBoq?.item_code,
      type: txType,
      category,
      cost_element: costElement,
      date,
      reference: reference.trim() || `REF-${Date.now().toString().slice(-4)}`,
      description: description.trim(),
      vendor_client: vendorClient.trim() || undefined,
      quantity_delta: quantityDelta > 0 ? quantityDelta : undefined,
      quantity_type: quantityDelta > 0 ? quantityType : undefined,
      unit_cost_rate: quantityDelta > 0 ? Math.round(amount / quantityDelta) : undefined,
      amount,
      currency: "TZS",
      status: "POSTED",
      created_by: createdBy,
      notes: notes.trim() || undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Post Commercial Transaction</h2>
              <p className="text-xs text-slate-500">
                Auditable construction ledger entry & double-entry cost/revenue posting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Target BOQ Item */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Allocated Bill of Quantities (BoQ) Item
            </label>
            <select
              value={selectedBoqId}
              onChange={(e) => setSelectedBoqId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            >
              <option value="">-- General Project Overhead / Unallocated --</option>
              {boqItems.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.item_code}] {item.description} ({item.unit}) - Tender Rate: {currencySymbol} {item.rate.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Type & Cost Element */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Transaction Type
              </label>
              <select
                value={txType}
                onChange={(e) => {
                  const val = e.target.value as CommercialTransactionType;
                  setTxType(val);
                  if (val.startsWith("REVENUE")) {
                    setCostElement("REVENUE");
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <optgroup label="Actual Costs (Invoiced / Spent)">
                  <option value="ACTUAL_INVOICE">Actual Supplier / Subcontractor Invoice</option>
                  <option value="ACTUAL_PAYROLL">Site Direct Payroll Allocation</option>
                  <option value="ACTUAL_PLANT_DOCKET">Plant & Machinery Hourly Docket</option>
                  <option value="ACTUAL_MATERIAL_DELIVERY">Material Direct Site Delivery</option>
                </optgroup>
                <optgroup label="Commitments (Open Orders)">
                  <option value="COMMITMENT_PO">Purchase Order (PO) Commitment</option>
                  <option value="COMMITMENT_SUBCONTRACT">Subcontract Agreement Commitment</option>
                </optgroup>
                <optgroup label="Accruals & Forecasts">
                  <option value="ACCRUAL_COST">Cost Accrual / GRNI (Unbilled Work)</option>
                  <option value="FORECAST_ADJUSTMENT">EAC Forecast Cost Adjustment</option>
                </optgroup>
                <optgroup label="Revenue & Valuations">
                  <option value="REVENUE_IPC_CERTIFICATE">Interim Payment Certificate (IPC)</option>
                  <option value="REVENUE_RECEIPT">Client Cash Payment Receipt (Paid)</option>
                  <option value="REVENUE_VALUATION">Monthly Valuation / Contractor Claim</option>
                </optgroup>
                <optgroup label="Budget Baselines & Variations">
                  <option value="BUDGET_VARIATION">Variation Order (VO) / Compensation Event</option>
                  <option value="BUDGET_ORIGINAL">Original Budget Allocation</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cost Element
              </label>
              <select
                value={costElement}
                onChange={(e) => setCostElement(e.target.value as CommercialCostElement)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="MATERIALS">Materials & Consumables</option>
                <option value="PLANT">Plant, Equipment & Machinery</option>
                <option value="LABOUR">Direct Site Labour & Staff</option>
                <option value="SUBCONTRACT">Subcontract Package</option>
                <option value="FUEL">Fuel & Lubricants</option>
                <option value="TRANSPORT">Haulage & Transport</option>
                <option value="OVERHEADS">Site Overheads & Supervision</option>
                <option value="REVENUE">Revenue / Client Payment</option>
              </select>
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Transaction Amount ({currencySymbol}) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 15000000"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Posting Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Reference & Vendor/Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Voucher / Reference #
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. INV-4920, PO-8840, IPC-06"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Vendor / Subcontractor / Client
              </label>
              <input
                type="text"
                value={vendorClient}
                onChange={(e) => setVendorClient(e.target.value)}
                placeholder="e.g. Kilimanjaro Cement, BuildCorp"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Physical Quantity Output (Optional) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              Physical Output Delta (Optional - Updates BoQ Quantity)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Quantity Delta {selectedBoq ? `(${selectedBoq.unit})` : ""}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantityDelta || ""}
                  onChange={(e) => setQuantityDelta(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 250"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Quantity Category
                </label>
                <select
                  value={quantityType}
                  onChange={(e) => setQuantityType(e.target.value as CommercialQuantityType)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  <option value="EXECUTED">Executed Quantity (Site Output)</option>
                  <option value="MEASURED">Measured Quantity (Claimed)</option>
                  <option value="CERTIFIED">Certified Quantity (IPC Approved)</option>
                  <option value="PAID">Paid Quantity (Client Remitted)</option>
                  <option value="REVISED">Revised Quantity (Variation Order)</option>
                </select>
              </div>
            </div>
            {quantityDelta > 0 && amount > 0 && (
              <div className="text-[11px] font-semibold text-slate-600">
                Calculated Unit Cost: <span className="font-bold text-slate-900">{currencySymbol} {Math.round(amount / quantityDelta).toLocaleString()}</span> per {selectedBoq?.unit || "unit"}
              </div>
            )}
          </div>

          {/* Description Narrative */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Transaction Narrative / Description *
            </label>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Batch 5 concrete pour for Culvert C2 headwall foundation (CH 0+620)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Post to Commercial Ledger
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
