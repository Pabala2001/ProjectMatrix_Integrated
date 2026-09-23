import { previewStorage } from "../../integration/previewStorage";
import React, { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  FileCheck, 
  CreditCard, 
  Calendar, 
  AlertCircle, 
  Plus, 
  FileText,
  DollarSign,
  ArrowUpRight,
  PieChart
} from "lucide-react";
import ProjectShell from "../../components/layout/ProjectShell";
import { MetricCard } from "../../components/ui/MetricCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Tabs } from "../../components/ui/Tabs";
import { Panel } from "../../components/ui/Panel";
import { DataTable } from "../../components/ui/DataTable";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { getCurrencyInfo } from "../../config/currencies";
import { formatCompactCurrency, formatCurrency } from "../../utils/currency";

type FinanceTab = "budget" | "actual" | "commitments" | "accruals" | "certificates" | "payments" | "cashflow" | "forecast";

export default function ProjectFinancePage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const activeCompany = context.activeCompany;

  const { currencyCode, currencySymbol } = useRegionalSettings();
  const currencyInfo = getCurrencyInfo(currencyCode);
  const rateToUSD = currencyInfo.rateToUSD || 1.0;

  const [activeTab, setActiveTab] = useState<FinanceTab>("budget");

  // Budget Data loaded from project storage (defaulting to empty)
  const rawBudgetData = useMemo(() => {
    if (!activeProject?.id) return [];
    try {
      const stored = previewStorage.getItem(`pm_finance_budget_${activeProject.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Error loading budget data:", e);
    }
    return [];
  }, [activeProject?.id]);

  const budgetData = useMemo(() => {
    return rawBudgetData.map((item: any) => {
      const orig = Number(item.originalBudget) || 0;
      const variations = Number(item.approvedVariations) || 0;
      const committedVal = Number(item.committed) || 0;
      const spentVal = Number(item.spent) || 0;
      const revised = orig + variations;
      const remaining = revised - spentVal;
      return {
        id: item.id,
        code: item.code || "-",
        section: item.section || "-",
        originalBudget: orig > 0 ? formatCompactCurrency(orig * rateToUSD, currencyCode) : "-",
        approvedVariations: variations > 0 ? `+${formatCompactCurrency(variations * rateToUSD, currencyCode)}` : "-",
        revisedBudget: revised > 0 ? formatCompactCurrency(revised * rateToUSD, currencyCode) : "-",
        committed: committedVal > 0 ? formatCompactCurrency(committedVal * rateToUSD, currencyCode) : "-",
        spent: spentVal > 0 ? formatCompactCurrency(spentVal * rateToUSD, currencyCode) : "-",
        remaining: formatCompactCurrency(remaining * rateToUSD, currencyCode),
        variancePct: item.variancePct || "-"
      };
    });
  }, [rawBudgetData, rateToUSD, currencyCode]);

  // Commitments Data from storage
  const rawCommitmentsData = useMemo(() => {
    if (!activeProject?.id) return [];
    try {
      const stored = previewStorage.getItem(`pm_finance_commitments_${activeProject.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Error loading commitments data:", e);
    }
    return [];
  }, [activeProject?.id]);

  const commitmentsData = useMemo(() => {
    return rawCommitmentsData.map((c: any) => ({
      ...c,
      amount: c.amount ? formatCurrency(Number(c.amount) * rateToUSD, currencyCode) : "-"
    }));
  }, [rawCommitmentsData, rateToUSD, currencyCode]);

  // Certificates Data from storage
  const rawCertificatesData = useMemo(() => {
    if (!activeProject?.id) return [];
    try {
      const stored = previewStorage.getItem(`pm_finance_certificates_${activeProject.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Error loading certificates data:", e);
    }
    return [];
  }, [activeProject?.id]);

  const certificatesData = useMemo(() => {
    return rawCertificatesData.map((cert: any) => ({
      id: cert.id,
      certNumber: cert.certNumber || "-",
      period: cert.period || "-",
      claimedAmount: cert.claimedAmount ? formatCompactCurrency(Number(cert.claimedAmount) * rateToUSD, currencyCode) : "-",
      certifiedAmount: cert.certifiedAmount ? formatCompactCurrency(Number(cert.certifiedAmount) * rateToUSD, currencyCode) : "-",
      retentionHeld: cert.retentionHeld ? formatCompactCurrency(Number(cert.retentionHeld) * rateToUSD, currencyCode) : "-",
      netPayable: cert.netPayable ? formatCompactCurrency(Number(cert.netPayable) * rateToUSD, currencyCode) : "-",
      status: cert.status || "-",
      dueDate: cert.dueDate || "-"
    }));
  }, [rawCertificatesData, rateToUSD, currencyCode]);

  const totalBudgetVal = useMemo(() => {
    if (rawBudgetData.length === 0) return 0;
    return rawBudgetData.reduce((sum: number, b: any) => sum + (Number(b.originalBudget) || 0) + (Number(b.approvedVariations) || 0), 0);
  }, [rawBudgetData]);

  const totalSpentVal = useMemo(() => {
    if (rawBudgetData.length === 0) return 0;
    return rawBudgetData.reduce((sum: number, b: any) => sum + (Number(b.spent) || 0), 0);
  }, [rawBudgetData]);

  const totalCommittedVal = useMemo(() => {
    if (rawBudgetData.length === 0) return 0;
    return rawBudgetData.reduce((sum: number, b: any) => sum + (Number(b.committed) || 0), 0);
  }, [rawBudgetData]);

  const tabsConfig = [
    { id: "budget" as FinanceTab, label: "Budget", icon: Coins, badge: totalBudgetVal > 0 ? `${formatCompactCurrency(totalBudgetVal * rateToUSD, currencyCode)} Total` : undefined },
    { id: "actual" as FinanceTab, label: "Actual", icon: DollarSign, badge: totalSpentVal > 0 ? `${formatCompactCurrency(totalSpentVal * rateToUSD, currencyCode)} Spent` : undefined },
    { id: "commitments" as FinanceTab, label: "Commitments", icon: CreditCard, badge: totalCommittedVal > 0 ? formatCompactCurrency(totalCommittedVal * rateToUSD, currencyCode) : undefined },
    { id: "accruals" as FinanceTab, label: "Accruals", icon: Calendar },
    { id: "certificates" as FinanceTab, label: "Certificates", icon: FileCheck, badge: rawCertificatesData.length > 0 ? `${rawCertificatesData.length} Logged` : undefined },
    { id: "payments" as FinanceTab, label: "Payments", icon: DollarSign },
    { id: "cashflow" as FinanceTab, label: "Cashflow", icon: TrendingUp },
    { id: "forecast" as FinanceTab, label: "Forecast", icon: PieChart },
  ];

  return (
    <ProjectShell project={activeProject} section="commercial">
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Module Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-[#101828] dark:text-white tracking-tight uppercase">
                PROJECT FINANCE
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                {rawBudgetData.length > 0 ? "Budget Active" : "No Active Budget"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl font-medium">
              Commercial ledgers, committed purchase orders, interim valuation certificates, and contract cashflow curves. Denominated in {currencyCode} ({currencySymbol}).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-[#2F7CFF] hover:bg-[#1C68EB] text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              <span>Raise PO / Commitment</span>
            </button>
          </div>
        </div>

        {/* 4 Commercial Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Approved Budget"
            value={totalBudgetVal > 0 ? formatCompactCurrency(totalBudgetVal * rateToUSD, currencyCode) : "-"}
            subValue={totalBudgetVal > 0 ? "Approved contract budget" : "-"}
            icon={Coins}
            accentColor="#2F7CFF"
          />
          <MetricCard
            label="Committed to Date"
            value={totalCommittedVal > 0 ? formatCompactCurrency(totalCommittedVal * rateToUSD, currencyCode) : "-"}
            subValue={totalBudgetVal > 0 ? `${Math.round((totalCommittedVal / totalBudgetVal) * 100)}% of total contract budget` : "-"}
            icon={CreditCard}
            accentColor="#F5A623"
          />
          <MetricCard
            label="Actual Spent"
            value={totalSpentVal > 0 ? formatCompactCurrency(totalSpentVal * rateToUSD, currencyCode) : "-"}
            subValue={totalSpentVal > 0 ? "Reconciled site expenditure" : "-"}
            icon={FileCheck}
            accentColor="#00B894"
          />
          <MetricCard
            label="Final Margin Forecast"
            value="-"
            subValue="-"
            icon={TrendingUp}
            accentColor="#10B981"
          />
        </div>

        {/* Navigation Tabs */}
        <Tabs
          tabs={tabsConfig}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as FinanceTab)}
          variant="pill"
        />

        {/* TAB 1: BUDGET */}
        {activeTab === "budget" && (
          <Panel
            title="Contract Work Breakdown Structure (WBS) Budget"
            subtitle="Master budget breakdown across contract engineering divisions with variation tracking"
          >
            <DataTable
              columns={[
                { key: "code", header: "WBS Code", render: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.code}</span>, sortable: true },
                { key: "section", header: "Contract Work Division", render: (r: any) => <strong className="text-slate-900 dark:text-white">{r.section}</strong> },
                { key: "originalBudget", header: "Original", align: "right" },
                { key: "approvedVariations", header: "Approved VOs", align: "right", render: (r: any) => <span className="font-mono text-emerald-600 font-bold">{r.approvedVariations}</span> },
                { key: "revisedBudget", header: "Revised Budget", align: "right", render: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.revisedBudget}</span> },
                { key: "spent", header: "Actual Spent", align: "right", render: (r: any) => <span className="font-mono">{r.spent}</span> },
                { key: "remaining", header: "Remaining Balance", align: "right", render: (r: any) => <span className="font-mono text-slate-500">{r.remaining}</span> },
                { key: "variancePct", header: "Cost Growth", align: "center", render: (r: any) => <StatusBadge label={r.variancePct} variant={r.variancePct === "0.0%" ? "neutral" : "warning"} size="sm" /> }
              ]}
              data={budgetData}
              keyExtractor={(r: any) => r.id}
            />
          </Panel>
        )}

        {/* TAB 2: ACTUAL */}
        {activeTab === "actual" && (
          <Panel
            title="Actual Cost Ledger"
            subtitle="Detailed actual expenditure reconciled from site labor, equipment fuel logs, and materials delivered"
          >
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <DollarSign className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {totalSpentVal > 0 ? `Total Incurred Cost: ${formatCurrency(totalSpentVal * rateToUSD, currencyCode)}` : "-"}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {totalSpentVal > 0 ? "Reconciliation against verified site diaries and vendor invoices." : "No incurred cost records logged."}
              </p>
            </div>
          </Panel>
        )}

        {/* TAB 3: COMMITMENTS */}
        {activeTab === "commitments" && (
          <Panel
            title="Active Purchase Orders & Subcontract Commitments"
            subtitle="Commercial obligations raised and pending delivery / invoice matching"
          >
            <DataTable
              columns={[
                { key: "poNumber", header: "PO Reference", render: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.poNumber}</span>, sortable: true },
                { key: "vendor", header: "Vendor / Supplier", render: (r: any) => <strong className="text-slate-900 dark:text-white">{r.vendor}</strong> },
                { key: "description", header: "Scope Description" },
                { key: "amount", header: "Committed Amount", align: "right", render: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.amount}</span> },
                { key: "date", header: "Order Date" },
                { key: "status", header: "Status", render: (r: any) => <StatusBadge label={r.status} variant={r.status.includes("Pending") ? "warning" : "success"} size="sm" /> }
              ]}
              data={commitmentsData}
              keyExtractor={(r: any) => r.id}
            />
          </Panel>
        )}

        {/* TAB 4: ACCRUALS */}
        {activeTab === "accruals" && (
          <Panel
            title="Monthly Cost Accruals & Work-in-Progress"
            subtitle="Recognized unbilled liabilities and delivered site inventory"
          >
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <Calendar className="w-8 h-8 text-blue-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                -
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No active month-end accruals recorded for this project period.
              </p>
            </div>
          </Panel>
        )}

        {/* TAB 5: CERTIFICATES */}
        {activeTab === "certificates" && (
          <Panel
            title="Interim Payment Certificates (IPC)"
            subtitle="Formal monthly valuation certificates certified by the Engineer and submitted to the Client"
          >
            <DataTable
              columns={[
                { key: "certNumber", header: "IPC Number", render: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.certNumber}</span>, sortable: true },
                { key: "period", header: "Valuation Period" },
                { key: "claimedAmount", header: "Contractor Claim", align: "right" },
                { key: "certifiedAmount", header: "Engineer Certified", align: "right", render: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.certifiedAmount}</span> },
                { key: "retentionHeld", header: "5% Retention", align: "right", render: (r: any) => <span className="font-mono text-slate-500">{r.retentionHeld}</span> },
                { key: "netPayable", header: "Net Payable", align: "right", render: (r: any) => <span className="font-mono font-black text-emerald-600">{r.netPayable}</span> },
                { key: "dueDate", header: "Payment Due Date" },
                { key: "status", header: "Status", render: (r: any) => <StatusBadge label={r.status} variant={r.status === "Paid in Full" ? "success" : "warning"} size="sm" /> }
              ]}
              data={certificatesData}
              keyExtractor={(r: any) => r.id}
            />
          </Panel>
        )}

        {/* TAB 6: PAYMENTS */}
        {activeTab === "payments" && (
          <Panel
            title="Received & Disbursed Payments"
            subtitle="Reconciled bank remittance confirmations and supplier settlement records"
          >
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <CreditCard className="w-8 h-8 text-blue-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                -
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No payment disbursements or remittance receipts logged.
              </p>
            </div>
          </Panel>
        )}

        {/* TAB 7: CASHFLOW */}
        {activeTab === "cashflow" && (
          <Panel
            title="Project S-Curve & Cumulative Cashflow"
            subtitle="Comparison of planned vs actual cumulative expenditure and revenue curve"
          >
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <TrendingUp className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                -
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cumulative cashflow curve will generate once valuation certificates and actual expenditure are logged.
              </p>
            </div>
          </Panel>
        )}

        {/* TAB 8: FORECAST */}
        {activeTab === "forecast" && (
          <Panel
            title="Estimate at Completion (EAC) & Commercial Forecast"
            subtitle="Matrix Intelligence cost model predicting final contract revenue and outturn costs"
          >
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <PieChart className="w-8 h-8 text-blue-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                -
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Commercial forecast will calculate based on earned value analysis once cost baselines are established.
              </p>
            </div>
          </Panel>
        )}

      </div>
    </ProjectShell>
  );
}
