import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useMemo, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  ChevronDown, 
  ChevronRight, 
  ArrowDown, 
  Calculator, 
  Coins, 
  FileSpreadsheet, 
  Layers, 
  Activity, 
  Sparkles, 
  ShieldAlert, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import { BoQItem, BoQSummary } from "../../types/boq";
import { 
  SAMPLE_BOQ_ITEMS, 
  loadBoQItems, 
  saveBoQItems, 
  calculateBoQSummary, 
  calculateBoQItem 
} from "../../services/boqService";
import { BoQItemDetailModal } from "./BoQItemDetailModal";
import { BoQItemEditModal } from "./BoQItemEditModal";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

interface BillOfQuantitiesTabProps {
  projectId?: string | null;
  projectName?: string;
  onNavigateToActivity?: (activityId: string) => void;
}

export function BillOfQuantitiesTab({
  projectId,
  projectName,
  onNavigateToActivity,
}: BillOfQuantitiesTabProps) {
  const { currencyCode, currencySymbol, formatCompactCurrency } = useRegionalSettings();

  const [items, setItems] = useState<BoQItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"all" | "losing" | "thin" | "profitable">("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [expandedItemId, setExpandedItemId] = useState<string | null>("boq-item-24-03"); // Expanded by default to show 24.03

  // Modals
  const [detailModalItem, setDetailModalItem] = useState<BoQItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [editModalItem, setEditModalItem] = useState<BoQItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);

  // Scan state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Load items
  useEffect(() => {
    const loaded = loadBoQItems(projectId);
    setItems(loaded);
  }, [projectId]);

  // Save changes
  const updateItems = (newItems: BoQItem[]) => {
    assertOperationalAction("edit", "components/programme/BillOfQuantitiesTab.tsx");
    setItems(newItems);
    saveBoQItems(newItems, projectId);
  };

  const handleSaveItem = (savedItem: BoQItem) => {
    assertOperationalAction("write", "components/programme/BillOfQuantitiesTab.tsx");
    const exists = items.some((i) => i.id === savedItem.id);
    let updated: BoQItem[];
    if (exists) {
      updated = items.map((i) => (i.id === savedItem.id ? savedItem : i));
    } else {
      updated = [savedItem, ...items];
    }
    updateItems(updated);
  };

  const handleDeleteItem = (id: string) => {
    assertOperationalAction("delete", "components/programme/BillOfQuantitiesTab.tsx");
    const updated = items.filter((i) => i.id !== id);
    updateItems(updated);
  };

  const handleTriggerAiScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const losingCount = items.filter((i) => i.margin.is_losing).length;
      setScanMessage(
        `ProjectMatrix Scan Complete: Evaluated ${items.length} items. Detected ${losingCount} item(s) experiencing margin leakage & rate erosion.`
      );
      setTimeout(() => setScanMessage(null), 8000);
    }, 800);
  };

  // Currency & number formatting helpers
  const activeSymbol = currencyCode === "TZS" ? "TSh" : currencySymbol || "TSh";
  const formatMoney = (amount: number) => `${activeSymbol} ${Math.round(amount).toLocaleString("en-US")}`;
  const formatCompactMoney = (amount: number) => {
    if (Math.abs(amount) >= 1_000_000_000) {
      return `${activeSymbol} ${(amount / 1_000_000_000).toFixed(2)}bn`;
    }
    if (Math.abs(amount) >= 1_000_000) {
      return `${activeSymbol} ${(amount / 1_000_000).toFixed(1)}m`;
    }
    if (Math.abs(amount) >= 1_000) {
      return `${activeSymbol} ${(amount / 1_000).toFixed(0)}k`;
    }
    return `${activeSymbol} ${Math.round(amount).toLocaleString("en-US")}`;
  };

  // Summary Metrics
  const summary: BoQSummary = useMemo(() => calculateBoQSummary(items), [items]);

  // Section choices
  const sections = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.section_title) set.add(i.section_title);
    });
    return Array.from(set);
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = 
        item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.section_title.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSection = selectedSection === "all" || item.section_title === selectedSection;

      let matchesStatus = true;
      if (filterStatus === "losing") {
        matchesStatus = item.margin.is_losing;
      } else if (filterStatus === "thin") {
        matchesStatus = !item.margin.is_losing && item.margin.current_margin < 5;
      } else if (filterStatus === "profitable") {
        matchesStatus = !item.margin.is_losing && item.margin.current_margin >= 5;
      }

      return matchesSearch && matchesSection && matchesStatus;
    });
  }, [items, searchTerm, selectedSection, filterStatus]);

  // Find the prominent losing item (e.g. 24.03) for the headline alert banner
  const primaryLosingItem = useMemo(() => {
    return items.find((i) => i.item_code === "24.03" && i.margin.is_losing) || items.find((i) => i.margin.is_losing);
  }, [items]);

  return (
    <div className="space-y-6 animate-fadeIn text-slate-900 dark:text-slate-100">
      
      {/* 1. TOP SUMMARY METRICS DECK */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total BoQ Items</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {summary.total_items}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across {sections.length} divisions</div>
        </div>

        <div className="bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Tender Baseline</span>
            <Coins className="w-4 h-4 text-[#FF9F1C]" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatCompactMoney(summary.total_tender_amount)}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">
            +{summary.overall_tender_margin_pct}% Target Margin
          </div>
        </div>

        <div className="bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Actual Spend</span>
            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatCompactMoney(summary.total_actual_cost)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Certified: {formatCompactMoney(summary.total_certified_value)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Forecast EAC</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatCompactMoney(summary.total_forecast_cost)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Estimate At Completion</div>
        </div>

        <div className="bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Execution Qty</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {summary.overall_progress_qty_pct}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Physical completion</div>
        </div>

        <div className={`p-4 rounded-2xl shadow-xs border ${
          summary.losing_items_count > 0 
            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400" 
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold">Losing Items</span>
            {summary.losing_items_count > 0 ? (
              <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className="text-xl font-black mt-1">
            {summary.losing_items_count} {summary.losing_items_count === 1 ? "Item" : "Items"}
          </div>
          <div className="text-[10px] font-bold mt-0.5">
            {summary.losing_items_count > 0 
              ? `-${formatCompactMoney(summary.total_forecast_loss_amount)} loss risk` 
              : "0 Margin Leakage"}
          </div>
        </div>

      </div>

      {/* 2. PROJECTMATRIX AI DETECTION CALLOUT (Exact User Prompt Specification) */}
      {primaryLosingItem && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/10 border-2 border-rose-500/40 shadow-sm space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs animate-pulse">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300">
                    🔴 ProjectMatrix Anomaly Detection
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Real-time Rate Erosion & Margin Variance
                  </span>
                </div>
                <h3 className="text-base font-black text-rose-700 dark:text-rose-400 mt-0.5">
                  🔴 BOQ Item {primaryLosingItem.item_code} is losing money.
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={() => {
                  setDetailModalItem(primaryLosingItem);
                  setIsDetailOpen(true);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Examine 4-Tier Breakdown</span>
              </button>
            </div>
          </div>

          {/* Prompt Exact Visual Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-white/70 dark:bg-[#07182E]/80 backdrop-blur-xs p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 text-xs">
            <div className="space-y-0.5">
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Tender rate</div>
              <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                {formatMoney(primaryLosingItem.tender_rate)}/{primaryLosingItem.unit}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Actual cost</div>
              <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                {formatMoney(primaryLosingItem.execution.actual_unit_cost)}/{primaryLosingItem.unit}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase">Loss</div>
              <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                {formatMoney(primaryLosingItem.margin.unit_loss)}/{primaryLosingItem.unit}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Remaining quantity</div>
              <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                {primaryLosingItem.execution.remaining_quantity.toLocaleString()} {primaryLosingItem.unit}
              </div>
            </div>

            <div className="space-y-0.5 p-2 rounded-xl bg-rose-600 text-white shadow-xs">
              <div className="text-[10px] font-semibold text-rose-100 uppercase">Forecast add. loss</div>
              <div className="text-sm font-black">
                {formatCompactMoney(primaryLosingItem.margin.forecast_additional_loss)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TOOLBAR: SEARCH, FILTERS & ACTION BUTTONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#102846] p-4 rounded-2xl border border-slate-200 dark:border-[#1E3A5F] shadow-xs">
        
        {/* Search & Section filter */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search BoQ by item code (e.g. 24.03), description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl text-xs focus:border-[#FF9F1C] focus:outline-none"
            />
          </div>

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Sections & Trades</option>
            {sections.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === "all"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            All ({items.length})
          </button>

          <button
            onClick={() => setFilterStatus("losing")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === "losing"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Losing Money ({summary.losing_items_count})</span>
          </button>

          <button
            onClick={() => setFilterStatus("thin")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === "thin"
                ? "bg-amber-500 text-slate-950 shadow-xs"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
            }`}
          >
            Thin Margin (&lt;5%)
          </button>

          <button
            onClick={() => setFilterStatus("profitable")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === "profitable"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            Profitable (&gt;5%)
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTriggerAiScan}
            disabled={isScanning}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-blue-500/10 hover:from-amber-500/25 hover:to-blue-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Scan BoQ against live site diaries & cost commitments"
          >
            <Sparkles className={`w-3.5 h-3.5 text-[#FF9F1C] ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? "Scanning..." : "✦ AI Rate Scan"}</span>
          </button>

          <button
            onClick={() => {
              setEditModalItem(null);
              setIsEditOpen(true);
            }}
            className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#ff8f00] text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add BoQ Item</span>
          </button>
        </div>

      </div>

      {/* Scan confirmation toast */}
      {scanMessage && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-[#FF9F1C] shrink-0" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* 4. MAIN BOQ ITEM LIST WITH 4-TIER ACCORDION FLOW */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] rounded-3xl p-12 text-center space-y-3">
            <Coins className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No BoQ items match your filters</h3>
            <p className="text-xs text-slate-400">Try adjusting your search criteria or create a new item.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedItemId === item.id;
            const isLosing = item.margin.is_losing;

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-[#102846] rounded-3xl border transition-all shadow-xs overflow-hidden ${
                  isLosing 
                    ? 'border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/20' 
                    : 'border-slate-200 dark:border-[#1E3A5F]'
                }`}
              >
                {/* ITEM COLLAPSIBLE HEADER BAR */}
                <div 
                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-[#15345a]/60 transition-colors"
                >
                  <div className="flex items-start md:items-center gap-3.5 flex-1">
                    <button className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 mt-0.5 md:mt-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-[#07182E] text-slate-900 dark:text-white border border-slate-200 dark:border-[#1E3A5F]">
                          Item {item.item_code}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {item.section_title}
                        </span>
                        {isLosing ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            🔴 Losing Money (-{formatMoney(item.margin.unit_loss)}/{item.unit})
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            +{item.margin.current_margin}% Margin
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {item.description}
                      </h3>
                    </div>
                  </div>

                  {/* Summary Columns */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs md:text-right shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-[#1E3A5F]">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Tender Rate</div>
                      <div className="font-extrabold text-slate-900 dark:text-white">{formatMoney(item.tender_rate)}/{item.unit}</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Actual Cost</div>
                      <div className={`font-extrabold ${isLosing ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                        {item.execution.actual_unit_cost > 0 ? `${formatMoney(item.execution.actual_unit_cost)}/${item.unit}` : "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Progress</div>
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {((item.execution.quantity_completed / item.quantity) * 100).toFixed(0)}% ({item.execution.quantity_completed.toLocaleString()} {item.unit})
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Forecast Margin</div>
                      <div className={`font-black ${item.margin.forecast_final_margin < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {item.margin.forecast_final_margin > 0 ? `+${item.margin.forecast_final_margin}%` : `${item.margin.forecast_final_margin}%`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXPANDED 4-TIER ARCHITECTURE ACCORDION (User Prompt Exact Flow) */}
                {isExpanded && (
                  <div className="p-6 border-t border-slate-200 dark:border-[#1E3A5F] bg-slate-50/50 dark:bg-[#0c1e33]/50 space-y-5 animate-fadeIn">
                    
                    {/* TIER 1: BOQ ITEM */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-150 dark:border-[#1E3A5F] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#FF9F1C]/20 text-amber-800 dark:text-amber-300 font-bold text-[10px]">TIER 1</span>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">BOQ ITEM</h4>
                        </div>
                        {item.linked_activity_name && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Linked Schedule: <strong className="text-slate-700 dark:text-slate-200">{item.linked_activity_name}</strong>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <div className="col-span-2">
                          <div className="text-[10px] uppercase font-semibold text-slate-400">Description</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{item.description}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400">Quantity</div>
                          <div className="font-black text-slate-900 dark:text-white mt-0.5">{item.quantity.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400">Unit</div>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">{item.unit}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400">Tender Rate</div>
                          <div className="font-black text-[#FF9F1C] mt-0.5">{formatMoney(item.tender_rate)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Tender Amount (Baseline Total):</span>
                        <span className="font-black text-slate-900 dark:text-white font-mono">{formatMoney(item.tender_amount)}</span>
                      </div>
                    </div>

                    {/* DOWNWARD ARROW */}
                    <div className="flex justify-center -my-2">
                      <div className="p-1.5 rounded-full bg-slate-200 dark:bg-[#1E3A5F] text-slate-600 dark:text-slate-300 shadow-xs">
                        <ArrowDown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* TIER 2: RATE BUILD-UP */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-150 dark:border-[#1E3A5F] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold text-[10px]">TIER 2</span>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">RATE BUILD-UP (per {item.unit})</h4>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          Base Cost: {formatMoney(item.rate_build_up.total_cost)} + Target Profit: {formatMoney(item.rate_build_up.profit)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                          <div className="text-[10px] text-slate-400 font-semibold">Labour</div>
                          <div className="font-bold mt-0.5">{formatMoney(item.rate_build_up.labour)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                          <div className="text-[10px] text-slate-400 font-semibold">Plant</div>
                          <div className="font-bold mt-0.5">{formatMoney(item.rate_build_up.plant)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                          <div className="text-[10px] text-slate-400 font-semibold">Materials</div>
                          <div className="font-bold mt-0.5">{formatMoney(item.rate_build_up.materials)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                          <div className="text-[10px] text-slate-400 font-semibold">Transport</div>
                          <div className="font-bold mt-0.5">{formatMoney(item.rate_build_up.transport)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                          <div className="text-[10px] text-slate-400 font-semibold">Fuel</div>
                          <div className="font-bold mt-0.5">{formatMoney(item.rate_build_up.fuel)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                          <div className="text-[10px] text-slate-400 font-semibold">Overheads</div>
                          <div className="font-bold mt-0.5">{formatMoney(item.rate_build_up.overheads)}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-center col-span-2 sm:col-span-1">
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">Profit</div>
                          <div className="font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{formatMoney(item.rate_build_up.profit)}</div>
                        </div>
                      </div>
                    </div>

                    {/* DOWNWARD ARROW */}
                    <div className="flex justify-center -my-2">
                      <div className="p-1.5 rounded-full bg-slate-200 dark:bg-[#1E3A5F] text-slate-600 dark:text-slate-300 shadow-xs">
                        <ArrowDown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* TIER 3: EXECUTION */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-150 dark:border-[#1E3A5F] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-800 dark:text-purple-300 font-bold text-[10px]">TIER 3</span>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">EXECUTION</h4>
                        </div>
                        <span className="text-xs text-slate-400">
                          Remaining: <strong>{item.execution.remaining_quantity.toLocaleString()} {item.unit}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Qty completed</div>
                          <div className="font-black text-slate-900 dark:text-white text-xs mt-0.5">
                            {item.execution.quantity_completed.toLocaleString()} {item.unit}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Qty certified</div>
                          <div className="font-black text-slate-900 dark:text-white text-xs mt-0.5">
                            {item.execution.quantity_certified.toLocaleString()} {item.unit}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Qty paid</div>
                          <div className="font-black text-slate-900 dark:text-white text-xs mt-0.5">
                            {item.execution.quantity_paid.toLocaleString()} {item.unit}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Actual cost</div>
                          <div className="font-black text-slate-900 dark:text-white text-xs mt-0.5">
                            {formatCompactMoney(item.execution.actual_cost)}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Committed cost</div>
                          <div className="font-black text-slate-900 dark:text-white text-xs mt-0.5">
                            {formatCompactMoney(item.execution.committed_cost)}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F]">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Forecast cost</div>
                          <div className="font-black text-slate-900 dark:text-white text-xs mt-0.5">
                            {formatCompactMoney(item.execution.forecast_cost)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DOWNWARD ARROW */}
                    <div className="flex justify-center -my-2">
                      <div className="p-1.5 rounded-full bg-slate-200 dark:bg-[#1E3A5F] text-slate-600 dark:text-slate-300 shadow-xs">
                        <ArrowDown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* TIER 4: MARGIN */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#102846] border border-slate-200 dark:border-[#1E3A5F] space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-150 dark:border-[#1E3A5F] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">TIER 4</span>
                          <h4 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">MARGIN</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setDetailModalItem(item);
                              setIsDetailOpen(true);
                            }}
                            className="px-3 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Detailed Analysis
                          </button>
                          <button
                            onClick={() => {
                              setEditModalItem(item);
                              setIsEditOpen(true);
                            }}
                            className="px-3 py-1 text-[11px] font-bold bg-[#FF9F1C] hover:bg-[#ff8f00] text-slate-950 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit Rate</span>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] text-center">
                          <div className="text-[10px] uppercase font-semibold text-slate-400">Tender margin</div>
                          <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                            +{item.margin.tender_margin}%
                          </div>
                          <div className="text-[10px] text-slate-400">{formatMoney(item.margin.tender_profit_per_unit)}/{item.unit} profit</div>
                        </div>

                        <div className={`p-3 rounded-xl border text-center ${
                          isLosing 
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800' 
                            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                        }`}>
                          <div className="text-[10px] uppercase font-semibold text-slate-500">Current margin</div>
                          <div className={`text-base font-black mt-0.5 ${isLosing ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {item.margin.current_margin > 0 ? `+${item.margin.current_margin}%` : `${item.margin.current_margin}%`}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            {isLosing ? `Loss: -${formatMoney(item.margin.unit_loss)}/${item.unit}` : `Gain: +${formatMoney(item.margin.current_unit_loss_or_gain)}/${item.unit}`}
                          </div>
                        </div>

                        <div className={`p-3 rounded-xl border text-center ${
                          item.margin.forecast_final_margin < 0
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                            : 'bg-slate-50 dark:bg-[#07182E] border-slate-200 dark:border-[#1E3A5F]'
                        }`}>
                          <div className="text-[10px] uppercase font-semibold text-slate-400">Forecast final margin</div>
                          <div className={`text-base font-black mt-0.5 ${item.margin.forecast_final_margin < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {item.margin.forecast_final_margin > 0 ? `+${item.margin.forecast_final_margin}%` : `${item.margin.forecast_final_margin}%`}
                          </div>
                          <div className="text-[10px] text-slate-400">EAC: {formatCompactMoney(item.execution.forecast_cost)}</div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. MODALS */}
      <BoQItemDetailModal
        item={detailModalItem}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailModalItem(null);
        }}
        currencySymbol={activeSymbol}
        onEdit={(item) => {
          setIsDetailOpen(false);
          setEditModalItem(item);
          setIsEditOpen(true);
        }}
      />

      <BoQItemEditModal
        item={editModalItem}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditModalItem(null);
        }}
        onSave={handleSaveItem}
        currencySymbol={activeSymbol}
        projectId={projectId || undefined}
      />

    </div>
  );
}
