import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  Plus, 
  Calculator, 
  Layers, 
  Coins, 
  AlertCircle, 
  CheckCircle2,
  ArrowDown
} from "lucide-react";
import { BoQItem, BoQRateBuildUp, BoQExecution } from "../../types/boq";
import { calculateBoQItem } from "../../services/boqService";

interface BoQItemEditModalProps {
  item: BoQItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: BoQItem) => void;
  currencySymbol?: string;
  projectId?: string;
}

export function BoQItemEditModal({
  item,
  isOpen,
  onClose,
  onSave,
  currencySymbol = "TSh",
  projectId,
}: BoQItemEditModalProps) {
  const [itemCode, setItemCode] = useState<string>("");
  const [sectionCode, setSectionCode] = useState<string>("2400");
  const [sectionTitle, setSectionTitle] = useState<string>("Section 2400: Concrete & Culvert Structures");
  const [description, setDescription] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [unit, setUnit] = useState<string>("m³");
  const [tenderRate, setTenderRate] = useState<number>(150000);
  const [wbsCode, setWbsCode] = useState<string>("ACT-240");
  const [linkedActivityName, setLinkedActivityName] = useState<string>("");

  // Rate build up
  const [labour, setLabour] = useState<number>(30000);
  const [plant, setPlant] = useState<number>(35000);
  const [materials, setMaterials] = useState<number>(50000);
  const [transport, setTransport] = useState<number>(10000);
  const [fuel, setFuel] = useState<number>(8000);
  const [overheads, setOverheads] = useState<number>(7000);
  const [profit, setProfit] = useState<number>(10000);

  // Execution
  const [qtyCompleted, setQtyCompleted] = useState<number>(0);
  const [qtyCertified, setQtyCertified] = useState<number>(0);
  const [qtyPaid, setQtyPaid] = useState<number>(0);
  const [actualCost, setActualCost] = useState<number>(0);
  const [committedCost, setCommittedCost] = useState<number>(0);
  const [forecastCost, setForecastCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (item) {
      setItemCode(item.item_code);
      setSectionCode(item.section_code);
      setSectionTitle(item.section_title);
      setDescription(item.description);
      setQuantity(item.quantity);
      setUnit(item.unit);
      setTenderRate(item.tender_rate);
      setWbsCode(item.wbs_code || "");
      setLinkedActivityName(item.linked_activity_name || "");

      setLabour(item.rate_build_up.labour);
      setPlant(item.rate_build_up.plant);
      setMaterials(item.rate_build_up.materials);
      setTransport(item.rate_build_up.transport);
      setFuel(item.rate_build_up.fuel);
      setOverheads(item.rate_build_up.overheads);
      setProfit(item.rate_build_up.profit);

      setQtyCompleted(item.execution.quantity_completed);
      setQtyCertified(item.execution.quantity_certified);
      setQtyPaid(item.execution.quantity_paid);
      setActualCost(item.execution.actual_cost);
      setCommittedCost(item.execution.committed_cost);
      setForecastCost(item.execution.forecast_cost);
      setNotes(item.notes || "");
    } else {
      setItemCode("24.04");
      setSectionCode("2400");
      setSectionTitle("Section 2400: Concrete & Culvert Structures");
      setDescription("Class 25/20 Mass Concrete in Blinding & Bedding");
      setQuantity(2500);
      setUnit("m³");
      setTenderRate(135000);
      setWbsCode("ACT-241");
      setLinkedActivityName("Substructure Concrete Works");

      setLabour(25000);
      setPlant(28000);
      setMaterials(45000);
      setTransport(9000);
      setFuel(6000);
      setOverheads(7000);
      setProfit(15000);

      setQtyCompleted(600);
      setQtyCertified(500);
      setQtyPaid(450);
      setActualCost(81000000);
      setCommittedCost(40000000);
      setForecastCost(337500000);
      setNotes("");
    }
  }, [item, isOpen]);

  // Derived live rate build up total
  const calculatedTotalCost = labour + plant + materials + transport + fuel + overheads;
  const calculatedTenderRate = calculatedTotalCost + profit;
  const actualUnitCost = qtyCompleted > 0 ? (actualCost / qtyCompleted) : 0;
  const isLoss = actualUnitCost > tenderRate && qtyCompleted > 0;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/programme/BoQItemEditModal.tsx");
    e.preventDefault();

    const rateBuildUp: BoQRateBuildUp = {
      labour,
      plant,
      materials,
      transport,
      fuel,
      overheads,
      profit,
      total_cost: calculatedTotalCost,
      tender_rate: tenderRate || calculatedTenderRate,
    };

    const execution: Omit<BoQExecution, "actual_unit_cost" | "remaining_quantity"> = {
      quantity_completed: qtyCompleted,
      quantity_certified: qtyCertified,
      quantity_paid: qtyPaid,
      actual_cost: actualCost,
      committed_cost: committedCost,
      forecast_cost: forecastCost || (actualCost + Math.max(0, quantity - qtyCompleted) * (actualUnitCost || tenderRate)),
    };

    const calculated = calculateBoQItem({
      id: item ? item.id : `boq-${Date.now()}`,
      project_id: projectId,
      item_code: itemCode,
      section_code: sectionCode,
      section_title: sectionTitle,
      description,
      quantity,
      unit,
      tender_rate: tenderRate,
      currency: "TZS",
      wbs_code: wbsCode,
      linked_activity_name: linkedActivityName,
      rate_build_up: rateBuildUp,
      execution,
      notes,
    });

    onSave(calculated);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-[#0c1e33] w-full max-w-3xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-[#1E3A5F] shadow-2xl flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between bg-slate-50 dark:bg-[#102846]/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FF9F1C]/15 border border-[#FF9F1C]/30 text-[#FF9F1C] rounded-xl">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {item ? `Edit BoQ Item ${item.item_code}` : "Create New BoQ Item"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure tender specs, 7-part rate build-up, and live physical execution metrics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800 dark:text-slate-200">
          
          {/* TIER 1: ITEM GENERAL SPECS */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#102846]/50 border border-slate-200 dark:border-[#1E3A5F] space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#1E3A5F] pb-2">
              <span className="px-2 py-0.5 rounded bg-[#FF9F1C]/20 text-amber-800 dark:text-amber-300 font-bold text-[10px]">TIER 1</span>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">BOQ Item Identification</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Item Code (e.g. 24.03)</label>
                <input
                  type="text"
                  required
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-bold font-mono focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Section Title</label>
                <input
                  type="text"
                  required
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Linked Programme Activity</label>
                <input
                  type="text"
                  value={linkedActivityName}
                  onChange={(e) => setLinkedActivityName(e.target.value)}
                  placeholder="e.g. Activity 240 Concrete Works"
                  className="w-full px-3 py-2 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Item Description</label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl focus:border-[#FF9F1C] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-bold focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Unit (m³, m², t, etc.)</label>
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-bold focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tender Rate ({currencySymbol})</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={tenderRate}
                  onChange={(e) => setTenderRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-bold font-mono text-[#FF9F1C] focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* TIER 2: RATE BUILD-UP */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#102846]/50 border border-slate-200 dark:border-[#1E3A5F] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E3A5F] pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold text-[10px]">TIER 2</span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Rate Build-Up Breakdown (per {unit})</h3>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Build-Up Total: <strong className="text-slate-800 dark:text-slate-200">{currencySymbol} {calculatedTenderRate.toLocaleString()}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Labour ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={labour}
                  onChange={(e) => setLabour(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Plant ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={plant}
                  onChange={(e) => setPlant(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Materials ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={materials}
                  onChange={(e) => setMaterials(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Transport ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={transport}
                  onChange={(e) => setTransport(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Fuel ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={fuel}
                  onChange={(e) => setFuel(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Overheads ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={overheads}
                  onChange={(e) => setOverheads(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Target Profit Margin ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={profit}
                  onChange={(e) => setProfit(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl font-mono font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* TIER 3: EXECUTION */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#102846]/50 border border-slate-200 dark:border-[#1E3A5F] space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E3A5F] pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-800 dark:text-purple-300 font-bold text-[10px]">TIER 3</span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Site Execution & Cost Accounting</h3>
              </div>
              {isLoss && (
                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
                  🔴 Unit Cost Overrun Detected
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Qty Completed</label>
                <input
                  type="number"
                  min={0}
                  value={qtyCompleted}
                  onChange={(e) => setQtyCompleted(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-bold focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Qty Certified</label>
                <input
                  type="number"
                  min={0}
                  value={qtyCertified}
                  onChange={(e) => setQtyCertified(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-bold focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Qty Paid</label>
                <input
                  type="number"
                  min={0}
                  value={qtyPaid}
                  onChange={(e) => setQtyPaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-bold focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Actual Spend to Date ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={actualCost}
                  onChange={(e) => setActualCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono font-bold focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Committed Cost ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={committedCost}
                  onChange={(e) => setCommittedCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Forecast EAC Cost ({currencySymbol})</label>
                <input
                  type="number"
                  min={0}
                  value={forecastCost}
                  onChange={(e) => setForecastCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#07182E] border border-slate-300 dark:border-[#1E3A5F] rounded-xl font-mono font-bold focus:border-[#FF9F1C] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* FOOTER BUTTONS */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-extrabold bg-[#FF9F1C] hover:bg-[#ff8f00] text-slate-950 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save BoQ Item</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
