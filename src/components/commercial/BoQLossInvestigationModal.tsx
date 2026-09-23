import React from "react";
import { 
  X, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  ShieldAlert, 
  Sparkles, 
  CheckCircle2, 
  Receipt, 
  FileSpreadsheet, 
  Coins, 
  ArrowRight,
  Calculator,
  Layers,
  Wrench,
  Clock
} from "lucide-react";
import { BoQItemCommercial, CommercialTransaction } from "../../types/commercial";

interface BoQLossInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BoQItemCommercial | null;
  transactions: CommercialTransaction[];
  currencySymbol: string;
  onNavigateToProgramme?: (activityId: string) => void;
  onPostMitigationAction?: (item: BoQItemCommercial, actionText: string) => void;
}

export function BoQLossInvestigationModal({
  isOpen,
  onClose,
  item,
  transactions,
  currencySymbol,
  onNavigateToProgramme,
  onPostMitigationAction
}: BoQLossInvestigationModalProps) {
  if (!isOpen || !item) return null;

  const itemTransactions = transactions.filter(t => t.boq_item_id === item.id || t.boq_item_code === item.item_code);

  const formatMoney = (amount: number) => `${currencySymbol} ${Math.round(amount).toLocaleString()}`;
  const formatCompact = (amount: number) => {
    if (Math.abs(amount) >= 1_000_000_000) return `${currencySymbol} ${(amount / 1_000_000_000).toFixed(2)}bn`;
    if (Math.abs(amount) >= 1_000_000) return `${currencySymbol} ${(amount / 1_000_000).toFixed(1)}m`;
    if (Math.abs(amount) >= 1_000) return `${currencySymbol} ${(amount / 1_000).toFixed(0)}k`;
    return `${currencySymbol} ${Math.round(amount).toLocaleString()}`;
  };

  const isLosing = item.is_losing;
  const unitVariance = item.rate - item.actual_unit_cost; // positive = profit, negative = loss
  const lossRatePct = item.rate > 0 ? (unitVariance / item.rate) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 text-amber-400">
                Item {item.item_code}
              </span>
              <span className="text-xs font-bold text-slate-500">{item.section_title}</span>
              {isLosing ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                  <TrendingDown className="w-3 h-3" />
                  Margin Leakage Detected ({item.loss_severity})
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Profitable Item
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-slate-900">{item.description}</h2>
            <p className="text-xs text-slate-500">Unit: {item.unit} | Tender Baseline Qty: {item.tender_quantity.toLocaleString()} | Revised: {item.revised_quantity.toLocaleString()}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Core Financial Comparison Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tender Unit Rate</div>
            <div className="text-base font-black text-slate-900 mt-1">{formatMoney(item.rate)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Budget Cost: {formatMoney(item.budget_unit_cost)}</div>
          </div>

          <div className={`p-4 border rounded-2xl ${isLosing ? "bg-rose-50/60 border-rose-200" : "bg-emerald-50/60 border-emerald-200"}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Actual Unit Cost</div>
            <div className={`text-base font-black mt-1 ${isLosing ? "text-rose-600" : "text-emerald-600"}`}>
              {formatMoney(item.actual_unit_cost)}
            </div>
            <div className={`text-[10px] font-bold mt-0.5 ${isLosing ? "text-rose-600" : "text-emerald-600"}`}>
              Variance: {unitVariance >= 0 ? "+" : ""}{formatMoney(unitVariance)}/unit ({lossRatePct.toFixed(1)}%)
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Forecast Revenue</div>
            <div className="text-base font-black text-slate-900 mt-1">{formatCompact(item.forecast_revenue)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Original: {formatCompact(item.original_revenue)}</div>
          </div>

          <div className={`p-4 border rounded-2xl ${isLosing ? "bg-rose-50/60 border-rose-200" : "bg-emerald-50/60 border-emerald-200"}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Estimate at Completion (EAC)</div>
            <div className={`text-base font-black mt-1 ${isLosing ? "text-rose-600" : "text-emerald-600"}`}>
              {formatCompact(item.forecast_cost)}
            </div>
            <div className={`text-[10px] font-bold mt-0.5 ${isLosing ? "text-rose-600" : "text-emerald-600"}`}>
              Net Margin: {item.margin >= 0 ? "+" : ""}{formatCompact(item.margin)} ({item.margin_percentage.toFixed(1)}%)
            </div>
          </div>
        </div>

        {/* 2. Quantities Progress Bar & Lifecycle */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Physical & Commercial Quantity Flow ({item.unit})</span>
            <span className="text-slate-500">
              Executed: {item.executed_quantity.toLocaleString()} / {item.revised_quantity.toLocaleString()} ({((item.executed_quantity / item.revised_quantity) * 100).toFixed(0)}%)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-[11px]">
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Tender Qty</div>
              <div className="font-bold text-slate-800 mt-0.5">{item.tender_quantity.toLocaleString()}</div>
            </div>
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Revised Qty</div>
              <div className="font-bold text-slate-800 mt-0.5">{item.revised_quantity.toLocaleString()}</div>
            </div>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="text-[9px] font-bold text-blue-600 uppercase">Executed Qty</div>
              <div className="font-bold text-blue-900 mt-0.5">{item.executed_quantity.toLocaleString()}</div>
            </div>
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="text-[9px] font-bold text-purple-600 uppercase">Measured Qty</div>
              <div className="font-bold text-purple-900 mt-0.5">{item.measured_quantity.toLocaleString()}</div>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="text-[9px] font-bold text-amber-600 uppercase">Certified Qty</div>
              <div className="font-bold text-amber-900 mt-0.5">{item.certified_quantity.toLocaleString()}</div>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[9px] font-bold text-emerald-600 uppercase">Paid Qty</div>
              <div className="font-bold text-emerald-900 mt-0.5">{item.paid_quantity.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 3. Root Cause Loss Drivers & Mitigation Actions */}
        {isLosing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Loss Drivers */}
            <div className="p-4 bg-rose-50/40 border border-rose-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-rose-900 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Active Loss Drivers & Rate Erosion Factors
              </div>
              <ul className="space-y-2 text-xs text-rose-800">
                {item.loss_drivers && item.loss_drivers.length > 0 ? (
                  item.loss_drivers.map((driver, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-white/70 p-2.5 rounded-xl border border-rose-200/50">
                      <span className="font-bold text-rose-600 shrink-0">#{idx + 1}</span>
                      <span>{driver}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 italic">Actual unit cost exceeds tender allowance due to plant standing time & rework.</li>
                )}
              </ul>
            </div>

            {/* Recommended Actions */}
            <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Commercial Recovery Plan & Action Steps
              </div>
              <ul className="space-y-2 text-xs text-amber-900">
                {item.recommended_actions && item.recommended_actions.length > 0 ? (
                  item.recommended_actions.map((act, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-white/70 p-2.5 rounded-xl border border-amber-200/50">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 italic">Review site timesheets and submit Variation Claim for Engineer redesign.</li>
                )}
              </ul>
            </div>

          </div>
        )}

        {/* 4. Transaction Audit Ledger for this specific BOQ Item */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-600" />
              Posted Transaction Audit Trail ({itemTransactions.length} records)
            </h3>
            <span className="text-[11px] text-slate-500">
              Total Actual Cost Posted: <strong className="text-slate-800">{formatCompact(item.actual_cost)}</strong>
            </span>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 w-24 overflow-hidden text-ellipsis truncate">Date</th>
                    <th className="px-3 py-2.5 w-24 overflow-hidden text-ellipsis truncate">Tx #</th>
                    <th className="px-3 py-2.5 w-24 overflow-hidden text-ellipsis truncate">Type</th>
                    <th className="px-3 py-2.5 w-24 overflow-hidden text-ellipsis truncate">Element</th>
                    <th className="px-3 py-2.5 w-40 overflow-hidden text-ellipsis truncate">Ref / Party</th>
                    <th className="px-3 py-2.5 w-60 overflow-hidden text-ellipsis truncate">Narrative</th>
                    <th className="px-3 py-2.5 text-right w-24 overflow-hidden text-ellipsis truncate">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {itemTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400 italic truncate overflow-hidden">
                        No transactions posted against this BoQ item yet.
                      </td>
                    </tr>
                  ) : (
                    itemTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px] whitespace-nowrap truncate overflow-hidden">{tx.date}</td>
                        <td className="px-3 py-2 font-mono text-[10px] font-bold text-slate-600 whitespace-nowrap truncate overflow-hidden">{tx.transaction_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap truncate overflow-hidden">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            tx.category === "ACTUAL_COST" ? "bg-rose-100 text-rose-800" :
                            tx.category === "REVENUE_PAID" || tx.category === "REVENUE_CERTIFIED" ? "bg-emerald-100 text-emerald-800" :
                            tx.category === "COMMITMENT" ? "bg-blue-100 text-blue-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {tx.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap truncate overflow-hidden">{tx.cost_element}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-800 font-semibold truncate overflow-hidden max-w-[160px]" title={`${tx.reference} ${tx.vendor_client ? `(${tx.vendor_client})` : ""}`}>{tx.reference} {tx.vendor_client ? `(${tx.vendor_client})` : ""}</td>
                        <td className="px-3 py-2 text-slate-600 truncate overflow-hidden max-w-xs" title={tx.description}>{tx.description}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap truncate overflow-hidden">{formatCompact(tx.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {item.linked_activity_id && (
              <span className="flex items-center gap-1 font-semibold text-amber-700">
                <Layers className="w-3.5 h-3.5" />
                Linked to Activity: {item.linked_activity_name || item.linked_activity_id}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {item.linked_activity_id && onNavigateToProgramme && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToProgramme(item.linked_activity_id!);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                Inspect in Programme of Works
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
