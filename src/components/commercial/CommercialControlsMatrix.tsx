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
  Calculator, 
  Coins, 
  FileSpreadsheet, 
  Layers, 
  Sparkles, 
  ShieldAlert, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  RefreshCw,
  CheckCircle2,
  Wallet,
  Scale,
  Receipt,
  PiggyBank,
  Clock,
  ArrowRight,
  HelpCircle,
  FileCheck2,
  BarChart3
} from "lucide-react";
import { 
  CommercialTransaction, 
  ProjectFinancialMetrics, 
  BoQItemCommercial,
  CommercialLossDiagnosticSummary
} from "../../types/commercial";
import { 
  loadCommercialTransactions, 
  saveCommercialTransactions,
  loadBoQCommercialItems,
  saveBoQCommercialItems,
  calculateProjectFinancials,
  calculateLossDiagnostics,
  postCommercialTransaction
} from "../../services/commercialLedgerService";
import { NewTransactionModal } from "./NewTransactionModal";
import { BoQLossInvestigationModal } from "./BoQLossInvestigationModal";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";

interface CommercialControlsMatrixProps {
  projectId?: string | null;
  projectName?: string;
  onNavigateToActivity?: (activityId: string) => void;
}

export function CommercialControlsMatrix({
  projectId,
  projectName,
  onNavigateToActivity
}: CommercialControlsMatrixProps) {
  const { currencyCode, currencySymbol } = useRegionalSettings();
  const activeSymbol = currencyCode === "TZS" ? "TSh" : currencySymbol || "TSh";

  // State
  const [items, setItems] = useState<BoQItemCommercial[]>([]);
  const [transactions, setTransactions] = useState<CommercialTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<"matrix" | "losing_diagnostics" | "transactions" | "metrics_breakdown">("matrix");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterLossStatus, setFilterLossStatus] = useState<"all" | "losing" | "thin" | "profitable">("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [txFilterType, setTxFilterType] = useState<string>("all");

  // Modals
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState<boolean>(false);
  const [investigateItem, setInvestigateItem] = useState<BoQItemCommercial | null>(null);

  // Load data on mount or project change
  useEffect(() => {
    const loadedItems = loadBoQCommercialItems(projectId);
    const loadedTx = loadCommercialTransactions(projectId);
    setItems(loadedItems);
    setTransactions(loadedTx);
  }, [projectId]);

  // Compute Project Financial Metrics & Loss Diagnostics
  const financials: ProjectFinancialMetrics = useMemo(() => {
    return calculateProjectFinancials(items, transactions);
  }, [items, transactions]);

  const lossDiagnostics: CommercialLossDiagnosticSummary = useMemo(() => {
    return calculateLossDiagnostics(items);
  }, [items]);

  // Currency & formatting helpers
  const formatMoney = (amount: number) => `${activeSymbol} ${Math.round(amount).toLocaleString()}`;
  const formatCompactMoney = (amount: number) => {
    if (Math.abs(amount) >= 1_000_000_000) return `${activeSymbol} ${(amount / 1_000_000_000).toFixed(2)}bn`;
    if (Math.abs(amount) >= 1_000_000) return `${activeSymbol} ${(amount / 1_000_000).toFixed(1)}m`;
    if (Math.abs(amount) >= 1_000) return `${activeSymbol} ${(amount / 1_000).toFixed(0)}k`;
    return `${activeSymbol} ${Math.round(amount).toLocaleString()}`;
  };

  // Sections list for filtering
  const sections = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.section_title) set.add(i.section_title);
    });
    return Array.from(set);
  }, [items]);

  // Filtered BOQ items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.section_title.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSection = selectedSection === "all" || item.section_title === selectedSection;

      let matchesLoss = true;
      if (filterLossStatus === "losing") matchesLoss = item.is_losing;
      else if (filterLossStatus === "thin") matchesLoss = !item.is_losing && item.margin_percentage < 5;
      else if (filterLossStatus === "profitable") matchesLoss = !item.is_losing && item.margin_percentage >= 5;

      return matchesSearch && matchesSection && matchesLoss;
    });
  }, [items, searchTerm, selectedSection, filterLossStatus]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.boq_item_code && tx.boq_item_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.vendor_client && tx.vendor_client.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesType = true;
      if (txFilterType !== "all") {
        matchesType = tx.category === txFilterType || tx.type === txFilterType;
      }

      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, txFilterType]);

  // Post transaction handler
  const handlePostTransaction = (newTxData: any) => {
    assertOperationalAction("write", "components/commercial/CommercialControlsMatrix.tsx");
    const result = postCommercialTransaction(newTxData, items, projectId);
    setTransactions(result.transactions);
    setItems(result.items);
  };

  // Export to CSV
  const handleExportCSV = () => {
    assertOperationalAction("export", "components/commercial/CommercialControlsMatrix.tsx");
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Item Code,Description,Section,Unit,Tender Qty,Revised Qty,Executed Qty,Measured Qty,Certified Qty,Paid Qty,Tender Rate,Actual Unit Cost,Forecast Revenue,Actual Cost,Forecast Cost (EAC),Margin,Margin %,Status\n";
    items.forEach((i) => {
      const row = [
        `"${i.item_code}"`,
        `"${i.description.replace(/"/g, '""')}"`,
        `"${i.section_title.replace(/"/g, '""')}"`,
        `"${i.unit}"`,
        i.tender_quantity,
        i.revised_quantity,
        i.executed_quantity,
        i.measured_quantity,
        i.certified_quantity,
        i.paid_quantity,
        i.rate,
        i.actual_unit_cost,
        i.forecast_revenue,
        i.actual_cost,
        i.forecast_cost,
        i.margin,
        `${i.margin_percentage.toFixed(2)}%`,
        i.is_losing ? "LOSING MONEY" : "PROFITABLE"
      ].join(",");
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Commercial_Control_Matrix_${projectId || "Project"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="commercial-controls-matrix-root" className="controls-page-container overflow-hidden max-w-full space-y-6">
      
      {/* 1. EXECUTIVE FINANCIAL POSITION STRIP (10 Core Line Items) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Double-Entry Commercial Accounting Ledger
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-900 border border-amber-500/30">
                Transaction-Driven Architecture
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditable contract ledger synchronizing Budgets, Commitments, Actuals, Accruals, Valuations, IPCs, and Cash Receipts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export CSV
            </button>
            <button
              onClick={() => setIsNewTxModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Post Transaction
            </button>
          </div>
        </div>

        {/* 10 Core Financial Line Items */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          
          {/* 1. Original Budget */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Original Budget</div>
            <div className="text-sm font-black text-slate-900 mt-1">{formatCompactMoney(financials.original_budget)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Tender Cost Baseline</div>
          </div>

          {/* 2. Revised Budget */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revised Budget</div>
            <div className="text-sm font-black text-slate-900 mt-1">{formatCompactMoney(financials.revised_budget)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Approved VOs & CEs</div>
          </div>

          {/* 3. Committed Cost */}
          <div className="p-3.5 bg-blue-50/50 border border-blue-200/60 rounded-2xl">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Committed Cost</div>
            <div className="text-sm font-black text-blue-950 mt-1">{formatCompactMoney(financials.committed_cost)}</div>
            <div className="text-[10px] text-blue-600 mt-0.5">Open POs & Subcontracts</div>
          </div>

          {/* 4. Actual Cost */}
          <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-2xl">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Actual Cost</div>
            <div className="text-sm font-black text-amber-950 mt-1">{formatCompactMoney(financials.actual_cost)}</div>
            <div className="text-[10px] text-amber-700 mt-0.5">Posted Invoices & Labour</div>
          </div>

          {/* 5. Accrued Cost */}
          <div className="p-3.5 bg-purple-50/50 border border-purple-200/60 rounded-2xl">
            <div className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">Accrued Cost</div>
            <div className="text-sm font-black text-purple-950 mt-1">{formatCompactMoney(financials.accrued_cost)}</div>
            <div className="text-[10px] text-purple-700 mt-0.5">GRNI / Unbilled Works</div>
          </div>

          {/* 6. Forecast Cost */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Forecast Cost (EAC)</div>
            <div className="text-sm font-black text-slate-900 mt-1">{formatCompactMoney(financials.forecast_cost)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Estimate at Completion</div>
          </div>

          {/* 7. Certified Revenue */}
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Certified Revenue</div>
            <div className="text-sm font-black text-emerald-950 mt-1">{formatCompactMoney(financials.certified_revenue)}</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">Signed IPC Certificates</div>
          </div>

          {/* 8. Paid Revenue */}
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Paid Revenue</div>
            <div className="text-sm font-black text-emerald-950 mt-1">{formatCompactMoney(financials.paid_revenue)}</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">Bank Cash Inflow</div>
          </div>

          {/* 9. Outstanding Revenue */}
          <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-2xl">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Outstanding Revenue</div>
            <div className="text-sm font-black text-amber-950 mt-1">{formatCompactMoney(financials.outstanding_revenue)}</div>
            <div className="text-[10px] text-amber-700 mt-0.5">Certified Uncollected</div>
          </div>

          {/* 10. Forecast Revenue */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Forecast Revenue</div>
            <div className="text-sm font-black text-slate-900 mt-1">{formatCompactMoney(financials.forecast_revenue)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Total Final Contract Sum</div>
          </div>

        </div>

        {/* 7 COMPUTED DERIVED METRICS */}
        <div className="p-4 bg-slate-950 text-white rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 border-b border-slate-800 pb-2">
            <span className="text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              Computed Contract Health & Treasury Analytics
            </span>
            <span>Live CPM & Cost Synchronization</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center">
            
            {/* 1. Cost to Date */}
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Cost to Date</div>
              <div className="text-xs font-black text-white mt-0.5">{formatCompactMoney(financials.cost_to_date)}</div>
              <div className="text-[9px] text-slate-500">Actual + Accrued</div>
            </div>

            {/* 2. Cost to Complete */}
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Cost to Complete</div>
              <div className="text-xs font-black text-white mt-0.5">{formatCompactMoney(financials.cost_to_complete)}</div>
              <div className="text-[9px] text-slate-500">Remaining Spend</div>
            </div>

            {/* 3. Estimate at Completion */}
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-[9px] font-bold text-amber-400 uppercase">Est. at Completion (EAC)</div>
              <div className="text-xs font-black text-amber-400 mt-0.5">{formatCompactMoney(financials.estimate_at_completion)}</div>
              <div className="text-[9px] text-slate-500">Cost to Date + CTC</div>
            </div>

            {/* 4. Variance at Completion */}
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Var. at Completion (VAC)</div>
              <div className={`text-xs font-black mt-0.5 ${financials.variance_at_completion >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {financials.variance_at_completion >= 0 ? "+" : ""}{formatCompactMoney(financials.variance_at_completion)}
              </div>
              <div className="text-[9px] text-slate-500">Budget - EAC</div>
            </div>

            {/* 5. Gross Margin */}
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Gross Margin</div>
              <div className={`text-xs font-black mt-0.5 ${financials.gross_margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCompactMoney(financials.gross_margin)} ({financials.gross_margin_percentage.toFixed(1)}%)
              </div>
              <div className="text-[9px] text-slate-500">Forecast Rev - EAC</div>
            </div>

            {/* 6. Cash Exposure */}
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Cash Exposure</div>
              <div className={`text-xs font-black mt-0.5 ${financials.cash_exposure > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {formatCompactMoney(financials.cash_exposure)}
              </div>
              <div className="text-[9px] text-slate-500">Actual Spend - Cash In</div>
            </div>

            {/* 7. Working Capital Requirement */}
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Working Capital Req.</div>
              <div className="text-xs font-black text-amber-300 mt-0.5">
                {formatCompactMoney(financials.working_capital_requirement)}
              </div>
              <div className="text-[9px] text-slate-500">(Committed + CTD) - Paid</div>
            </div>

          </div>
        </div>

      </div>

      {/* 2. TABBED NAVIGATION (Matrix vs Losing Items Diagnostics vs Transaction Journal) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "matrix" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Bill of Quantities Ledger Matrix ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("losing_diagnostics")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "losing_diagnostics" ? "bg-rose-500 text-white shadow-xs" : "text-rose-600 hover:bg-rose-50"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Which Items Are Losing Money? ({lossDiagnostics.losing_items_count})
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "transactions" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            Transaction Audit Journal ({transactions.length})
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, narrative, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 w-48 sm:w-64"
            />
          </div>

          {activeTab === "matrix" && (
            <>
              <select
                value={filterLossStatus}
                onChange={(e) => setFilterLossStatus(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="all">All Profitability (All)</option>
                <option value="losing">🔴 Losing Money Only ({lossDiagnostics.losing_items_count})</option>
                <option value="thin">🟡 Thin Margin (&lt;5%) ({lossDiagnostics.thin_margin_count})</option>
                <option value="profitable">🟢 Profitable ({lossDiagnostics.profitable_items_count})</option>
              </select>

              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value="all">All BoQ Sections</option>
                {sections.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </>
          )}

          {activeTab === "transactions" && (
            <select
              value={txFilterType}
              onChange={(e) => setTxFilterType(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              <option value="all">All Transaction Types</option>
              <option value="ACTUAL_COST">Actual Cost Postings (Invoices/Payroll)</option>
              <option value="COMMITMENT">Commitments (POs & Subcontracts)</option>
              <option value="ACCRUAL">Accruals (GRNI & Unbilled)</option>
              <option value="REVENUE_CERTIFIED">Certified Revenue (IPCs)</option>
              <option value="REVENUE_PAID">Paid Revenue (Receipts)</option>
              <option value="BUDGET">Budgets & Variations</option>
            </select>
          )}
        </div>

      </div>

      {/* 3. TAB CONTENT 1: "WHICH BOQ ITEMS ARE LOSING MONEY?" DIAGNOSTIC STATION */}
      {activeTab === "losing_diagnostics" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Executive Red Alert Loss Banner */}
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                    Live Loss Detection Engine
                  </span>
                  <span className="text-xs font-extrabold text-rose-900">
                    {lossDiagnostics.losing_items_count} of {lossDiagnostics.total_boq_items} BoQ Items Bleeding Margin
                  </span>
                </div>
                <h3 className="text-base font-black text-rose-950">
                  Total Forecast Deficit Exposure: {formatMoney(lossDiagnostics.total_loss_exposure)}
                </h3>
                <p className="text-xs text-rose-800 max-w-3xl leading-relaxed">
                  ProjectMatrix identifies items where <strong>Actual Unit Cost &gt; Tender Unit Rate</strong> or where <strong>EAC Forecast Cost &gt; Forecast Revenue</strong>. Immediate commercial intervention required.
                </p>
              </div>

              <div className="p-4 bg-white border border-rose-200 rounded-2xl shrink-0 text-center space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Highest Risk Section</div>
                <div className="text-xs font-black text-rose-700">{lossDiagnostics.highest_risk_section}</div>
                <div className="text-[10px] text-slate-500">Primary: {lossDiagnostics.primary_loss_driver}</div>
              </div>
            </div>
          </div>

          {/* Cards for each Losing BOQ Item with Root Causes and Actions */}
          <div className="grid grid-cols-1 gap-4">
            {lossDiagnostics.items_with_negative_cash_margin.map((item) => {
              const unitVariance = item.rate - item.actual_unit_cost;
              return (
                <div key={item.id} className="bg-white border-2 border-rose-200 rounded-3xl p-6 shadow-xs space-y-4 hover:border-rose-300 transition-all">
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 text-amber-400">
                          Item {item.item_code}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{item.section_title}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-600 text-white">
                          {item.loss_severity} RISK
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900">{item.description}</h4>
                      <p className="text-xs text-slate-500">
                        Unit: {item.unit} | Tender Qty: {item.tender_quantity.toLocaleString()} | Revised: {item.revised_quantity.toLocaleString()} | Executed: {item.executed_quantity.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Projected Net Deficit</div>
                        <div className="text-base font-black text-rose-600">-{formatMoney(item.forecast_loss_amount)}</div>
                        <div className="text-[10px] font-bold text-rose-700">Margin: {item.margin_percentage.toFixed(1)}%</div>
                      </div>
                      <button
                        onClick={() => setInvestigateItem(item)}
                        className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Audit Ledger
                      </button>
                    </div>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Tender Unit Rate</span>
                      <strong className="text-slate-900">{formatMoney(item.rate)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-rose-500 uppercase block">Actual Unit Cost</span>
                      <strong className="text-rose-600">{formatMoney(item.actual_unit_cost)}</strong>
                      <span className="text-[10px] text-rose-600 font-semibold block">({unitVariance < 0 ? "-" : ""}{formatMoney(Math.abs(unitVariance))}/unit)</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Forecast Revenue</span>
                      <strong className="text-slate-900">{formatCompactMoney(item.forecast_revenue)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-rose-500 uppercase block">Forecast Cost (EAC)</span>
                      <strong className="text-rose-600">{formatCompactMoney(item.forecast_cost)}</strong>
                    </div>
                  </div>

                  {/* Active Loss Drivers & Mitigation Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-rose-50/50 border border-rose-200/70 rounded-xl space-y-1.5">
                      <div className="font-bold text-rose-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Primary Loss Drivers:
                      </div>
                      <ul className="space-y-1 text-rose-800 list-disc list-inside">
                        {item.loss_drivers?.slice(0, 2).map((d, i) => (
                          <li key={i} className="truncate">{d}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-xl space-y-1.5">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        Recommended Action Plan:
                      </div>
                      <ul className="space-y-1 text-amber-900 list-disc list-inside">
                        {item.recommended_actions?.slice(0, 2).map((a, i) => (
                          <li key={i} className="truncate">{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* 4. TAB CONTENT 2: COMPLETE BILL OF QUANTITIES ACCOUNTING MATRIX */}
      {activeTab === "matrix" && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden animate-in fade-in duration-200">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1400px]">
              
              <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 w-[240px] overflow-hidden text-ellipsis truncate">Item Code & Description</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap w-16 overflow-hidden text-ellipsis truncate">Unit</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Tender Qty</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Revised Qty</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Executed Qty</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Measured Qty</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Certified Qty</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Paid Qty</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Tender Rate</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Actual Unit Cost</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Forecast Revenue</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Budget Cost</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Actual Cost</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Forecast Cost (EAC)</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Margin</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-6 py-12 text-center text-slate-400 italic overflow-hidden text-ellipsis truncate">
                      No Bill of Quantities items match your search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLosing = item.is_losing;
                    return (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isLosing ? "bg-rose-50/30" : ""
                        }`}
                      >
                        {/* Item Code & Description */}
                        <td className="px-4 py-3.5 sticky left-0 bg-white group-hover:bg-slate-50 z-10 w-[240px] overflow-hidden text-ellipsis truncate">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-slate-900 shrink-0">{item.item_code}</span>
                            {isLosing && (
                              <span className="px-1.5 py-0.2 text-[8px] font-black bg-rose-500 text-white rounded shrink-0">
                                LOSS
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate max-w-[240px]" title={item.description}>
                            {item.description}
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="px-3 py-3.5 text-center font-mono text-[11px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis truncate">{item.unit}</td>

                        {/* Quantities (Tender, Revised, Executed, Measured, Certified, Paid) */}
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] whitespace-nowrap overflow-hidden text-ellipsis truncate">{item.tender_quantity.toLocaleString()}</td>
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] font-semibold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis truncate">{item.revised_quantity.toLocaleString()}</td>
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] font-bold text-blue-600 whitespace-nowrap overflow-hidden text-ellipsis truncate">{item.executed_quantity.toLocaleString()}</td>
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] text-purple-600 whitespace-nowrap overflow-hidden text-ellipsis truncate">{item.measured_quantity.toLocaleString()}</td>
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] font-bold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis truncate">{item.certified_quantity.toLocaleString()}</td>
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] font-bold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis truncate">{item.paid_quantity.toLocaleString()}</td>

                        {/* Rates (Tender Rate & Actual Unit Cost) */}
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis truncate">{formatMoney(item.rate)}</td>
                        <td className={`px-3 py-3.5 text-right font-mono text-[11px] font-black whitespace-nowrap overflow-hidden text-ellipsis truncate ${isLosing ? "text-rose-600" : "text-emerald-600"}`}>
                          {formatMoney(item.actual_unit_cost)}
                        </td>

                        {/* Revenue (Forecast Revenue) */}
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] font-bold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis truncate">{formatCompactMoney(item.forecast_revenue)}</td>

                        {/* Costs (Budget, Actual, Forecast Cost) */}
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis truncate">{formatCompactMoney(item.budget_cost)}</td>
                        <td className="px-3 py-3.5 text-right font-mono text-[11px] font-bold text-amber-800 whitespace-nowrap overflow-hidden text-ellipsis truncate">{formatCompactMoney(item.actual_cost)}</td>
                        <td className={`px-3 py-3.5 text-right font-mono text-[11px] font-black whitespace-nowrap overflow-hidden text-ellipsis truncate ${isLosing ? "text-rose-600" : "text-slate-900"}`}>
                          {formatCompactMoney(item.forecast_cost)}
                        </td>

                        {/* Margin */}
                        <td className={`px-3 py-3.5 text-right font-mono text-[11px] font-black whitespace-nowrap overflow-hidden text-ellipsis truncate ${isLosing ? "text-rose-600" : "text-emerald-600"}`}>
                          {item.margin >= 0 ? "+" : ""}{formatCompactMoney(item.margin)} ({item.margin_percentage.toFixed(1)}%)
                        </td>

                        {/* Action Audit */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap overflow-hidden text-ellipsis truncate">
                          <button
                            onClick={() => setInvestigateItem(item)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Audit Transaction Ledger"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

            </table>
          </div>

        </div>
      )}

      {/* 5. TAB CONTENT 3: TRANSACTION AUDIT JOURNAL */}
      {activeTab === "transactions" && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden animate-in fade-in duration-200 space-y-4 p-6">
          
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Full Double-Entry Transaction Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Displaying {filteredTransactions.length} auditable journal entries recorded for this project.
              </p>
            </div>
            <button
              onClick={() => setIsNewTxModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Entry
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1100px]">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Posting Date</th>
                  <th className="px-3 py-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Voucher #</th>
                  <th className="px-3 py-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">BoQ Item</th>
                  <th className="px-3 py-3 whitespace-nowrap w-24 overflow-hidden text-ellipsis truncate">Type</th>
                  <th className="px-3 py-3 whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Category</th>
                  <th className="px-3 py-3 whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Cost Element</th>
                  <th className="px-3 py-3 w-44 overflow-hidden text-ellipsis truncate">Reference / Party</th>
                  <th className="px-4 py-3 w-64 overflow-hidden text-ellipsis truncate">Narrative Description</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Amount ({activeSymbol})</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap w-20 overflow-hidden text-ellipsis truncate">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 italic overflow-hidden text-ellipsis truncate">
                      No commercial transactions found matching the filter.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap overflow-hidden text-ellipsis truncate">{tx.date}</td>
                      <td className="px-3 py-3 font-mono font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis truncate">{tx.transaction_number}</td>
                      <td className="px-3 py-3 font-mono font-bold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis truncate">{tx.boq_item_code || "--"}</td>
                      <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-100 text-slate-800">
                          {tx.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                          tx.category === "ACTUAL_COST" ? "bg-rose-100 text-rose-800" :
                          tx.category === "REVENUE_PAID" || tx.category === "REVENUE_CERTIFIED" ? "bg-emerald-100 text-emerald-800" :
                          tx.category === "COMMITMENT" ? "bg-blue-100 text-blue-800" :
                          "bg-amber-100 text-amber-800"
                        }`}>
                          {tx.category.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[11px] font-semibold text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis truncate">{tx.cost_element}</td>
                      <td className="px-3 py-3 text-[11px] text-slate-800 font-semibold truncate max-w-[200px] overflow-hidden text-ellipsis" title={`${tx.reference} ${tx.vendor_client ? `(${tx.vendor_client})` : ""}`}>
                        {tx.reference} {tx.vendor_client ? `(${tx.vendor_client})` : ""}
                      </td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[320px] overflow-hidden text-ellipsis" title={tx.description}>{tx.description}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        {formatMoney(tx.amount)}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap overflow-hidden text-ellipsis truncate">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>

        </div>
      )}

      {/* MODALS */}
      <NewTransactionModal
        isOpen={isNewTxModalOpen}
        onClose={() => setIsNewTxModalOpen(false)}
        boqItems={items}
        projectId={projectId}
        projectName={projectName}
        currencySymbol={activeSymbol}
        onPostTransaction={handlePostTransaction}
      />

      <BoQLossInvestigationModal
        isOpen={!!investigateItem}
        onClose={() => setInvestigateItem(null)}
        item={investigateItem}
        transactions={transactions}
        currencySymbol={activeSymbol}
        onNavigateToProgramme={onNavigateToActivity}
      />

    </div>
  );
}
