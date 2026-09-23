import React from "react";
import { 
  X, 
  AlertTriangle, 
  ArrowDown, 
  Layers, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  FileSpreadsheet, 
  Activity, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Sparkles,
  ExternalLink
} from "lucide-react";
import { BoQItem } from "../../types/boq";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

interface BoQItemDetailModalProps {
  item: BoQItem | null;
  isOpen: boolean;
  onClose: () => void;
  currencySymbol?: string;
  onEdit?: (item: BoQItem) => void;
}

export function BoQItemDetailModal({
  item,
  isOpen,
  onClose,
  currencySymbol: customCurrencySymbol,
  onEdit,
}: BoQItemDetailModalProps) {
  const { currencySymbol: regionalCurrencySymbol } = useRegionalSettings();
  const currencySymbol = customCurrencySymbol || regionalCurrencySymbol || "R";

  if (!isOpen || !item) return null;

  const formatNumber = (num: number) => num.toLocaleString("en-US");
  const formatMoney = (amount: number) => `${currencySymbol} ${amount.toLocaleString("en-US")}`;
  const formatCompactMoney = (amount: number) => {
    if (Math.abs(amount) >= 1_000_000_000) {
      return `${currencySymbol} ${(amount / 1_000_000_000).toFixed(2)}bn`;
    }
    if (Math.abs(amount) >= 1_000_000) {
      return `${currencySymbol} ${(amount / 1_000_000).toFixed(1)}m`;
    }
    if (Math.abs(amount) >= 1_000) {
      return `${currencySymbol} ${(amount / 1_000).toFixed(0)}k`;
    }
    return `${currencySymbol} ${amount.toLocaleString("en-US")}`;
  };

  const isLosing = item.margin.is_losing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#0c1e33] w-full max-w-4xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-[#1E3A5F] shadow-2xl flex flex-col overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between bg-slate-50/70 dark:bg-[#102846]/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isLosing ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-500'}`}>
              {isLosing ? <AlertTriangle className="w-5 h-5" /> : <Coins className="w-5 h-5 text-[#FF9F1C]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md">
                  Item {item.item_code}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  {item.section_title}
                </span>
                {isLosing ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    Losing Money
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Profitable (+{item.margin.current_margin}%)
                  </span>
                )}
              </div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                {item.description}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(item)}
                className="px-3 py-1.5 text-xs font-bold bg-[#FF9F1C] hover:bg-[#ff8f00] text-slate-950 rounded-xl transition-colors cursor-pointer"
              >
                Edit Item & Rate
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY WITH 4-TIER ARCHITECTURE */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-900 dark:text-slate-100">

          {/* PROJECTMATRIX AI DETECTION BANNER (If Losing Money) */}
          {isLosing && (
            <div className="p-4.5 rounded-2xl bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/10 border-2 border-rose-500/40 shadow-sm space-y-3 animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500 text-white rounded-lg shadow-xs">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-rose-700 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span>🔴 ProjectMatrix Detection: BOQ Item {item.item_code} is losing money</span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Actual unit cost exceeds tender allowance by <strong className="text-rose-600 dark:text-rose-400">{formatMoney(item.margin.unit_loss)}/{item.unit}</strong> (+{Math.abs(item.margin.current_margin).toFixed(1)}% cost variance).
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Forecast Additional Loss</div>
                  <div className="text-base font-black text-rose-600 dark:text-rose-400">
                    {formatCompactMoney(item.margin.forecast_additional_loss)}
                  </div>
                </div>
              </div>

              {/* Exact Prompt Detection Spec Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-rose-200 dark:border-rose-900/50">
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Tender rate</div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200">{formatMoney(item.tender_rate)}/{item.unit}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-rose-200 dark:border-rose-900/50">
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Actual cost</div>
                  <div className="text-xs font-black text-rose-600 dark:text-rose-400">{formatMoney(item.execution.actual_unit_cost)}/{item.unit}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800">
                  <div className="text-[10px] font-semibold text-rose-700 dark:text-rose-400">Unit Loss</div>
                  <div className="text-xs font-black text-rose-700 dark:text-rose-300">{formatMoney(item.margin.unit_loss)}/{item.unit}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-rose-200 dark:border-rose-900/50">
                  <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Remaining quantity</div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200">{formatNumber(item.execution.remaining_quantity)} {item.unit}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-xs">
                  <div className="text-[10px] font-semibold text-rose-100">Forecast add. loss</div>
                  <div className="text-xs font-black">{formatCompactMoney(item.margin.forecast_additional_loss)}</div>
                </div>
              </div>

              {/* Loss Drivers & Recommended Actions */}
              {item.loss_drivers && item.loss_drivers.length > 0 && (
                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/50 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      Primary Cost Drivers:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 text-[11px]">
                      {item.loss_drivers.map((driver, idx) => (
                        <li key={idx}>{driver}</li>
                      ))}
                    </ul>
                  </div>

                  {item.recommended_actions && item.recommended_actions.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-bold text-[#FF9F1C] text-[11px] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF9F1C]" />
                        ProjectMatrix Recommended Mitigations:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 text-[11px]">
                        {item.recommended_actions.map((act, idx) => (
                          <li key={idx}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TIER 1: BOQ ITEM */}
          <div className="bg-slate-50 dark:bg-[#102846]/60 border border-slate-200 dark:border-[#1E3A5F] rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E3A5F] pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#FF9F1C]/20 text-amber-800 dark:text-amber-300 font-bold text-[10px] uppercase tracking-wider">
                  Tier 1
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  BOQ Item Specification
                </h3>
              </div>
              {item.linked_activity_name && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Activity className="w-3.5 h-3.5 text-[#FF9F1C]" />
                  <span>Linked Programme: <strong className="text-slate-700 dark:text-slate-200">{item.linked_activity_name}</strong></span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="col-span-2 p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Description</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{item.description}</div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Quantity</div>
                <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">{formatNumber(item.quantity)}</div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Unit</div>
                <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{item.unit}</div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Tender Rate</div>
                <div className="font-black text-[#FF9F1C] text-sm mt-0.5">{formatMoney(item.tender_rate)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Total Tender Amount (Contract Baseline):</span>
              <span className="font-black text-slate-900 dark:text-white text-base font-mono">
                {formatMoney(item.tender_amount)}
              </span>
            </div>
          </div>

          {/* DOWNWARD ARROW INDICATOR */}
          <div className="flex justify-center -my-2">
            <div className="p-1.5 rounded-full bg-slate-200 dark:bg-[#1E3A5F] text-slate-600 dark:text-slate-300 shadow-xs">
              <ArrowDown className="w-4 h-4" />
            </div>
          </div>

          {/* TIER 2: RATE BUILD-UP */}
          <div className="bg-slate-50 dark:bg-[#102846]/60 border border-slate-200 dark:border-[#1E3A5F] rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E3A5F] pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold text-[10px] uppercase tracking-wider">
                  Tier 2
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Rate Build-Up (Unit Breakdown per {item.unit})
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                Total Cost: {formatMoney(item.rate_build_up.total_cost)} + Profit: {formatMoney(item.rate_build_up.profit)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Labour</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatMoney(item.rate_build_up.labour)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{((item.rate_build_up.labour / item.tender_rate) * 100).toFixed(1)}%</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Plant</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatMoney(item.rate_build_up.plant)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{((item.rate_build_up.plant / item.tender_rate) * 100).toFixed(1)}%</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Materials</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatMoney(item.rate_build_up.materials)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{((item.rate_build_up.materials / item.tender_rate) * 100).toFixed(1)}%</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Transport</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatMoney(item.rate_build_up.transport)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{((item.rate_build_up.transport / item.tender_rate) * 100).toFixed(1)}%</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Fuel</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatMoney(item.rate_build_up.fuel)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{((item.rate_build_up.fuel / item.tender_rate) * 100).toFixed(1)}%</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Overheads</div>
                <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatMoney(item.rate_build_up.overheads)}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{((item.rate_build_up.overheads / item.tender_rate) * 100).toFixed(1)}%</div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center col-span-2 sm:col-span-1">
                <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Profit</div>
                <div className="font-black text-emerald-700 dark:text-emerald-300 text-xs mt-0.5">{formatMoney(item.rate_build_up.profit)}</div>
                <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">+{item.margin.tender_margin}%</div>
              </div>
            </div>

            {/* Horizontal Rate Build-Up Segmented Bar */}
            <div className="space-y-1 pt-1">
              <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div style={{ width: `${(item.rate_build_up.labour / item.tender_rate) * 100}%` }} className="bg-blue-500" title="Labour" />
                <div style={{ width: `${(item.rate_build_up.plant / item.tender_rate) * 100}%` }} className="bg-amber-500" title="Plant" />
                <div style={{ width: `${(item.rate_build_up.materials / item.tender_rate) * 100}%` }} className="bg-purple-500" title="Materials" />
                <div style={{ width: `${(item.rate_build_up.transport / item.tender_rate) * 100}%` }} className="bg-cyan-500" title="Transport" />
                <div style={{ width: `${(item.rate_build_up.fuel / item.tender_rate) * 100}%` }} className="bg-rose-500" title="Fuel" />
                <div style={{ width: `${(item.rate_build_up.overheads / item.tender_rate) * 100}%` }} className="bg-slate-500" title="Overheads" />
                <div style={{ width: `${(item.rate_build_up.profit / item.tender_rate) * 100}%` }} className="bg-emerald-500" title="Profit" />
              </div>
              <div className="flex flex-wrap items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Labour</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Plant</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Materials</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /> Transport</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Fuel</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" /> Overheads</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Profit</span>
              </div>
            </div>
          </div>

          {/* DOWNWARD ARROW INDICATOR */}
          <div className="flex justify-center -my-2">
            <div className="p-1.5 rounded-full bg-slate-200 dark:bg-[#1E3A5F] text-slate-600 dark:text-slate-300 shadow-xs">
              <ArrowDown className="w-4 h-4" />
            </div>
          </div>

          {/* TIER 3: EXECUTION */}
          <div className="bg-slate-50 dark:bg-[#102846]/60 border border-slate-200 dark:border-[#1E3A5F] rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E3A5F] pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-800 dark:text-purple-300 font-bold text-[10px] uppercase tracking-wider">
                  Tier 3
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Execution & Physical Site Quantities
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Progress: {((item.execution.quantity_completed / item.quantity) * 100).toFixed(1)}% Complete
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Qty Completed</div>
                <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                  {formatNumber(item.execution.quantity_completed)} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Qty Certified</div>
                <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                  {formatNumber(item.execution.quantity_certified)} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Qty Paid</div>
                <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                  {formatNumber(item.execution.quantity_paid)} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Actual Cost</div>
                <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                  {formatCompactMoney(item.execution.actual_cost)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Committed Cost</div>
                <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                  {formatCompactMoney(item.execution.committed_cost)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Forecast Cost</div>
                <div className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                  {formatCompactMoney(item.execution.forecast_cost)}
                </div>
              </div>
            </div>

            {/* Execution Unit Cost Rate Check */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#FF9F1C]" />
                <span>
                  Live Actual Unit Cost: <strong className={isLosing ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                    {formatMoney(item.execution.actual_unit_cost)} / {item.unit}
                  </strong>
                </span>
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Remaining Work: <strong>{formatNumber(item.execution.remaining_quantity)} {item.unit}</strong> to execute
              </div>
            </div>
          </div>

          {/* DOWNWARD ARROW INDICATOR */}
          <div className="flex justify-center -my-2">
            <div className="p-1.5 rounded-full bg-slate-200 dark:bg-[#1E3A5F] text-slate-600 dark:text-slate-300 shadow-xs">
              <ArrowDown className="w-4 h-4" />
            </div>
          </div>

          {/* TIER 4: MARGIN */}
          <div className="bg-slate-50 dark:bg-[#102846]/60 border border-slate-200 dark:border-[#1E3A5F] rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E3A5F] pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider">
                  Tier 4
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Margin Analysis & Final Variance
                </h3>
              </div>
              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${isLosing ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                {isLosing ? `Unit Variance: -${formatMoney(item.margin.unit_loss)}` : `Unit Variance: +${formatMoney(item.margin.current_unit_loss_or_gain)}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center space-y-1">
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Tender Margin</div>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  +{item.margin.tender_margin}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {formatMoney(item.margin.tender_profit_per_unit)} / {item.unit} profit
                </div>
              </div>

              <div className={`p-4 rounded-xl text-center space-y-1 border ${
                isLosing 
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800' 
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
              }`}>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Current Margin</div>
                <div className={`text-xl font-black ${isLosing ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {item.margin.current_margin > 0 ? `+${item.margin.current_margin}%` : `${item.margin.current_margin}%`}
                </div>
                <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {isLosing ? `Loss of ${formatMoney(item.margin.unit_loss)}/${item.unit}` : `Gain of ${formatMoney(item.margin.current_unit_loss_or_gain)}/${item.unit}`}
                </div>
              </div>

              <div className={`p-4 rounded-xl text-center space-y-1 border ${
                item.margin.forecast_final_margin < 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                  : 'bg-white dark:bg-[#07182E] border-slate-200 dark:border-[#1E3A5F]'
              }`}>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Forecast Final Margin</div>
                <div className={`text-xl font-black ${
                  item.margin.forecast_final_margin < 0 
                    ? 'text-rose-600 dark:text-rose-400' 
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {item.margin.forecast_final_margin > 0 ? `+${item.margin.forecast_final_margin}%` : `${item.margin.forecast_final_margin}%`}
                </div>
                <div className="text-[10px] text-slate-400">
                  EAC Cost: {formatCompactMoney(item.execution.forecast_cost)}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between bg-slate-50 dark:bg-[#102846]/60">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF9F1C]" />
            <span>ProjectMatrix BoQ Margin Engine</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
}
