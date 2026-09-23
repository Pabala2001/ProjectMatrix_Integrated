import React, { useMemo, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building,
  Truck,
  Landmark,
  ShieldCheck,
  AlertCircle,
  FileText,
  Upload,
  ArrowRight,
  ChevronRight,
  Paperclip,
  CheckCircle2,
  Clock,
  Compass,
  ArrowLeftRight,
  ShoppingCart,
  Target,
  FileCheck,
  Layers,
  Activity,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import {
  BudgetLineItem,
  ForecastLineItem,
  CommitmentRegisterItem,
  ActualCostRegisterItem,
  ClientCertificateRecord,
  SupplierInvoiceRecord,
  BankTransactionRecord,
  CommercialAuditEntry,
  SourceProvenance
} from "../../../types/commercialWorkspace";
import { formatCurrency as formatCentralCurrency, formatCompactCurrency } from "../../../utils/currency";

interface CommercialOverviewViewProps {
  budgets: BudgetLineItem[];
  forecasts: ForecastLineItem[];
  commitments: CommitmentRegisterItem[];
  actualCosts: ActualCostRegisterItem[];
  clientCertificates: ClientCertificateRecord[];
  supplierInvoices: SupplierInvoiceRecord[];
  bankTransactions: BankTransactionRecord[];
  auditTrail?: CommercialAuditEntry[];
  currency: string;
  projectId?: string;
  projectName?: string;
  onNavigateTab: (tab: any) => void;
  onOpenUpload: (category?: any) => void;
  onInspectSource: (title: string, value: any, source?: SourceProvenance, fieldName?: string) => void;
}

export const CommercialOverviewView: React.FC<CommercialOverviewViewProps> = ({
  budgets,
  forecasts,
  commitments,
  actualCosts,
  clientCertificates,
  supplierInvoices,
  bankTransactions,
  auditTrail = [],
  currency = "USD",
  projectId,
  projectName,
  onNavigateTab,
  onOpenUpload,
  onInspectSource
}) => {
  // Central Currency Formatter linked to top header currency
  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return formatCentralCurrency(val, currency);
  };

  const formatShortAmount = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return formatCompactCurrency(val, currency);
  };

  // 1. BUDGET & FORECAST AGGREGATION
  const totalOriginalBudget = useMemo(() => {
    if (budgets.length === 0) return null;
    const hasAny = budgets.some((b) => b.originalBudget !== null && b.originalBudget !== undefined);
    if (!hasAny) return null;
    return budgets.reduce((acc, b) => acc + (b.originalBudget ?? 0), 0);
  }, [budgets]);

  const totalApprovedChanges = useMemo(() => {
    if (budgets.length === 0) return null;
    const hasAny = budgets.some((b) => b.approvedChanges !== null && b.approvedChanges !== undefined);
    if (!hasAny) return null;
    return budgets.reduce((acc, b) => acc + (b.approvedChanges ?? 0), 0);
  }, [budgets]);

  const totalRevisedBudget = useMemo(() => {
    if (budgets.length === 0) return null;
    const hasAny = budgets.some(
      (b) =>
        (b.revisedBudget !== null && b.revisedBudget !== undefined) ||
        (b.originalBudget !== null && b.originalBudget !== undefined)
    );
    if (!hasAny) return null;
    return budgets.reduce(
      (acc, b) => acc + (b.revisedBudget ?? ((b.originalBudget ?? 0) + (b.approvedChanges ?? 0))),
      0
    );
  }, [budgets]);

  const totalForecastFinalCost = useMemo(() => {
    if (forecasts.length > 0) {
      const hasFc = forecasts.some((f) => f.forecastFinalCost !== null && f.forecastFinalCost !== undefined);
      if (hasFc) return forecasts.reduce((acc, f) => acc + (f.forecastFinalCost ?? 0), 0);
    }
    if (budgets.length > 0) {
      const hasBg = budgets.some((b) => b.forecastFinalCost !== null && b.forecastFinalCost !== undefined);
      if (hasBg) return budgets.reduce((acc, b) => acc + (b.forecastFinalCost ?? 0), 0);
    }
    return null;
  }, [forecasts, budgets]);

  const forecastVariance =
    totalRevisedBudget !== null && totalForecastFinalCost !== null
      ? totalRevisedBudget - totalForecastFinalCost
      : null;

  // 2. COMMITMENTS AGGREGATION (filter out Cancelled / Rejected)
  const validCommitments = useMemo(() => {
    return commitments.filter((c) => c.status !== "Cancelled" && c.status !== "Rejected");
  }, [commitments]);

  const totalCommitments = useMemo(() => {
    if (validCommitments.length === 0) return null;
    const hasAny = validCommitments.some(
      (c) =>
        (c.currentCommitment !== null && c.currentCommitment !== undefined) ||
        (c.originalValue !== null && c.originalValue !== undefined)
    );
    if (!hasAny) return null;
    return validCommitments.reduce(
      (acc, c) => acc + (c.currentCommitment ?? ((c.originalValue ?? 0) + (c.changes ?? 0))),
      0
    );
  }, [validCommitments]);

  const totalCommitmentsInvoiced = useMemo(() => {
    if (validCommitments.length === 0) return null;
    const hasAny = validCommitments.some((c) => c.invoiced !== null && c.invoiced !== undefined);
    if (!hasAny) return null;
    return validCommitments.reduce((acc, c) => acc + (c.invoiced ?? 0), 0);
  }, [validCommitments]);

  const totalCommitmentsPaid = useMemo(() => {
    if (validCommitments.length === 0) return null;
    const hasAny = validCommitments.some((c) => c.paid !== null && c.paid !== undefined);
    if (!hasAny) return null;
    return validCommitments.reduce((acc, c) => acc + (c.paid ?? 0), 0);
  }, [validCommitments]);

  const remainingCommitments =
    totalCommitments !== null && totalCommitmentsInvoiced !== null
      ? Math.max(0, totalCommitments - totalCommitmentsInvoiced)
      : totalCommitments !== null && totalCommitmentsPaid !== null
      ? Math.max(0, totalCommitments - totalCommitmentsPaid)
      : null;

  // 3. ACTUAL COSTS AGGREGATION
  const totalActualCost = useMemo(() => {
    if (actualCosts.length === 0) return null;
    const hasAny = actualCosts.some(
      (a) =>
        (a.total !== null && a.total !== undefined) ||
        (a.net !== null && a.net !== undefined)
    );
    if (!hasAny) return null;
    return actualCosts.reduce((acc, a) => acc + (a.total ?? ((a.net ?? 0) + (a.tax ?? 0))), 0);
  }, [actualCosts]);

  const totalActualPaid = useMemo(() => {
    if (actualCosts.length === 0) return null;
    const hasAny = actualCosts.some((a) => a.paidAmount !== null && a.paidAmount !== undefined);
    if (!hasAny) return null;
    return actualCosts.reduce((acc, a) => acc + (a.paidAmount ?? 0), 0);
  }, [actualCosts]);

  const outstandingActualPayables =
    totalActualCost !== null && totalActualPaid !== null
      ? Math.max(0, totalActualCost - totalActualPaid)
      : null;

  // 4. CLIENT ACCOUNTS AGGREGATION
  const totalClientCertified = useMemo(() => {
    if (clientCertificates.length === 0) return null;
    const hasAny = clientCertificates.some((c) => c.certifiedAmount !== null && c.certifiedAmount !== undefined);
    if (!hasAny) return null;
    return clientCertificates.reduce((acc, c) => acc + (c.certifiedAmount ?? 0), 0);
  }, [clientCertificates]);

  const totalClientReceived = useMemo(() => {
    if (clientCertificates.length === 0) return null;
    const hasAny = clientCertificates.some((c) => c.paidAmount !== null && c.paidAmount !== undefined);
    if (!hasAny) return null;
    return clientCertificates.reduce((acc, c) => acc + (c.paidAmount ?? 0), 0);
  }, [clientCertificates]);

  const totalRetentionHeld = useMemo(() => {
    if (clientCertificates.length === 0) return null;
    const hasAny = clientCertificates.some((c) => c.retentionDeducted !== null && c.retentionDeducted !== undefined);
    if (!hasAny) return null;
    return clientCertificates.reduce((acc, c) => acc + (c.retentionDeducted ?? 0), 0);
  }, [clientCertificates]);

  const outstandingReceivables =
    totalClientCertified !== null && totalClientReceived !== null
      ? Math.max(0, (totalClientCertified - (totalRetentionHeld ?? 0)) - totalClientReceived)
      : null;

  // 5. CASH & BANK AGGREGATION
  const totalCashInflows = useMemo(() => {
    if (bankTransactions.length === 0) return null;
    const inflows = bankTransactions.filter((t) => t.type === "Inflow");
    if (inflows.length === 0) return null;
    return inflows.reduce((acc, t) => acc + (t.amount ?? 0), 0);
  }, [bankTransactions]);

  const totalCashOutflows = useMemo(() => {
    if (bankTransactions.length === 0) return null;
    const outflows = bankTransactions.filter((t) => t.type === "Outflow");
    if (outflows.length === 0) return null;
    return outflows.reduce((acc, t) => acc + (t.amount ?? 0), 0);
  }, [bankTransactions]);

  const netCashPosition =
    totalCashInflows !== null || totalCashOutflows !== null
      ? (totalCashInflows ?? 0) - (totalCashOutflows ?? 0)
      : null;

  const bankReconciledCount = bankTransactions.filter((t) => t.reconciled).length;
  const bankUnreconciledCount = bankTransactions.length - bankReconciledCount;

  // 6. REPORTS & AUDIT SUMMARY
  const missingSupportingDocsCount = useMemo(() => {
    const bgDocs = budgets.filter((b) => !b.documents || b.documents.length === 0).length;
    const cmDocs = commitments.filter((c) => !c.documents || c.documents.length === 0).length;
    const acDocs = actualCosts.filter((a) => !a.documents || a.documents.length === 0).length;
    const ccDocs = clientCertificates.filter((cc) => !cc.documents || cc.documents.length === 0).length;
    return bgDocs + cmDocs + acDocs + ccDocs;
  }, [budgets, commitments, actualCosts, clientCertificates]);

  const pendingApprovalsCount = useMemo(() => {
    const cmPending = commitments.filter((c) => c.status === "Pending" || c.status === "Submitted").length;
    const acPending = actualCosts.filter((a) => a.status === "Draft" || a.status === "Pending").length;
    const ccPending = clientCertificates.filter((cc) => cc.status === "Draft" || cc.status === "Submitted").length;
    return cmPending + acPending + ccPending;
  }, [commitments, actualCosts, clientCertificates]);

  const latestAuditEntry = useMemo(() => {
    if (!auditTrail || auditTrail.length === 0) return null;
    return auditTrail[0];
  }, [auditTrail]);

  // Derived Performance Ratios for Progress Visuals
  const budgetSpentPct =
    totalRevisedBudget && totalActualCost !== null ? Math.min(100, Math.max(0, (totalActualCost / totalRevisedBudget) * 100)) : null;
  const commitmentCoverPct =
    totalRevisedBudget && totalCommitments !== null ? Math.min(100, Math.max(0, (totalCommitments / totalRevisedBudget) * 100)) : null;
  const revenueCollectionPct =
    totalClientCertified && totalClientReceived !== null
      ? Math.min(100, Math.max(0, (totalClientReceived / totalClientCertified) * 100))
      : null;

  // Top Cost Codes derived strictly from stored budget & actual records
  const costCodeSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        costCode: string;
        description: string;
        revisedBudget: number | null;
        actualCost: number | null;
        forecastFinalCost: number | null;
        source?: SourceProvenance;
      }
    >();

    budgets.forEach((b) => {
      const code = b.costCode || "00.00";
      const existing = map.get(code) || {
        costCode: code,
        description: b.description || "Cost Item",
        revisedBudget: null,
        actualCost: null,
        forecastFinalCost: null,
        source: b.source
      };

      const rev = b.revisedBudget ?? ((b.originalBudget ?? 0) + (b.approvedChanges ?? 0));
      existing.revisedBudget = (existing.revisedBudget ?? 0) + rev;
      if (b.actualCost !== null && b.actualCost !== undefined) {
        existing.actualCost = (existing.actualCost ?? 0) + b.actualCost;
      }
      if (b.forecastFinalCost !== null && b.forecastFinalCost !== undefined) {
        existing.forecastFinalCost = (existing.forecastFinalCost ?? 0) + b.forecastFinalCost;
      }
      map.set(code, existing);
    });

    // Also blend commitments if mapped
    commitments.forEach((c) => {
      const code = c.costCode || "00.00";
      const val = c.currentCommitment ?? ((c.originalValue ?? 0) + (c.changes ?? 0));
      if (map.has(code)) {
        const item = map.get(code)!;
        (item as any).commitments = ((item as any).commitments ?? 0) + val;
      }
    });

    // Also blend actual costs if not already mapped
    actualCosts.forEach((a) => {
      const code = a.costCode || "00.00";
      const val = a.total ?? ((a.net ?? 0) + (a.tax ?? 0));
      if (map.has(code)) {
        const item = map.get(code)!;
        item.actualCost = (item.actualCost ?? 0) + val;
      } else {
        map.set(code, {
          costCode: code,
          description: a.description || "Cost Item",
          revisedBudget: 0,
          actualCost: val,
          forecastFinalCost: val,
          source: a.source
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => ((b.revisedBudget ?? 0) + (b.actualCost ?? 0)) - ((a.revisedBudget ?? 0) + (a.actualCost ?? 0)))
      .slice(0, 7);
  }, [budgets, actualCosts, commitments]);

  // Hover states for pie charts
  const [activeCostCodePieIndex, setActiveCostCodePieIndex] = useState<number | null>(null);
  const [activeCapitalPieIndex, setActiveCapitalPieIndex] = useState<number | null>(null);
  const [activeRevenuePieIndex, setActiveRevenuePieIndex] = useState<number | null>(null);

  // 1. Primary Financial Performance Bar Chart Data
  const financialPerformanceData = useMemo(() => {
    return [
      {
        name: "Budget",
        fullLabel: "Approved Revised Budget",
        amount: totalRevisedBudget ?? 0,
        fill: "#2563eb",
        subtext: "Baseline"
      },
      {
        name: "Commitments",
        fullLabel: "Active Contractual Commitments",
        amount: totalCommitments ?? 0,
        fill: "#10b981",
        subtext: commitmentCoverPct !== null ? `${commitmentCoverPct.toFixed(0)}% of Budget` : ""
      },
      {
        name: "Incurred Cost",
        fullLabel: "Actual Cost Incurred",
        amount: totalActualCost ?? 0,
        fill: "#f59e0b",
        subtext: budgetSpentPct !== null ? `${budgetSpentPct.toFixed(0)}% of Budget` : ""
      },
      {
        name: "Certified Rev.",
        fullLabel: "Client Certified Revenue",
        amount: totalClientCertified ?? 0,
        fill: "#6366f1",
        subtext: revenueCollectionPct !== null ? `${revenueCollectionPct.toFixed(0)}% Collected` : ""
      },
      {
        name: "Forecast Cost",
        fullLabel: "Forecast Final Cost",
        amount: totalForecastFinalCost ?? (totalRevisedBudget ?? 0),
        fill: "#8b5cf6",
        subtext: forecastVariance !== null ? (forecastVariance >= 0 ? `+${formatShortAmount(forecastVariance)}` : `-${formatShortAmount(Math.abs(forecastVariance))}`) : ""
      }
    ];
  }, [totalRevisedBudget, totalCommitments, totalActualCost, totalClientCertified, totalForecastFinalCost, commitmentCoverPct, budgetSpentPct, revenueCollectionPct, forecastVariance]);

  // 2. Cost Code Comparative Graph Data
  const costCodeGraphData = useMemo(() => {
    if (costCodeSummary.length === 0) return [];
    return costCodeSummary.map((item) => ({
      name: item.costCode,
      description: item.description,
      budget: item.revisedBudget ?? 0,
      committed: (item as any).commitments ?? 0,
      actual: item.actualCost ?? 0
    }));
  }, [costCodeSummary]);

  // 3. Cost Allocation Pie Data
  const costCodePieData = useMemo(() => {
    const itemsWithActuals = costCodeSummary.filter((item) => (item.actualCost ?? 0) > 0);
    const dataSource = itemsWithActuals.length > 0
      ? itemsWithActuals
      : costCodeSummary.filter((item) => (item.revisedBudget ?? 0) > 0);

    const totalVal = dataSource.reduce(
      (acc, curr) => acc + (itemsWithActuals.length > 0 ? (curr.actualCost ?? 0) : (curr.revisedBudget ?? 0)),
      0
    );

    const colors = ["#2563eb", "#10b981", "#f59e0b", "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
    if (totalVal === 0) return [];

    return dataSource.map((item, idx) => {
      const val = itemsWithActuals.length > 0 ? (item.actualCost ?? 0) : (item.revisedBudget ?? 0);
      const pct = totalVal > 0 ? Math.round((val / totalVal) * 100) : 0;
      return {
        name: `${item.costCode} - ${item.description}`,
        code: item.costCode,
        shortName: item.description.length > 18 ? item.description.substring(0, 18) + "..." : item.description,
        value: val,
        percentage: pct,
        color: colors[idx % colors.length]
      };
    });
  }, [costCodeSummary]);

  // 4. Capital Utilization Pie Data
  const capitalUtilizationPieData = useMemo(() => {
    const paid = totalActualPaid ?? 0;
    const payables = outstandingActualPayables ?? 0;
    const uninvCommitments = remainingCommitments ?? 0;
    const uncommittedBudget = Math.max(0, (totalRevisedBudget ?? 0) - (totalCommitments ?? 0));

    const total = paid + payables + uninvCommitments + uncommittedBudget;
    if (total === 0) return [];

    const raw = [
      { name: "Paid Actuals", value: paid, color: "#10b981" },
      { name: "Outstanding Payables", value: payables, color: "#f59e0b" },
      { name: "Open Commitments", value: uninvCommitments, color: "#6366f1" },
      { name: "Uncommitted Budget", value: uncommittedBudget, color: "#3b82f6" }
    ].filter((d) => d.value > 0);

    return raw.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0
    }));
  }, [totalActualPaid, outstandingActualPayables, remainingCommitments, totalRevisedBudget, totalCommitments]);

  // 5. Client Revenue Realization Pie Data
  const clientRevenuePieData = useMemo(() => {
    const received = totalClientReceived ?? 0;
    const retention = totalRetentionHeld ?? 0;
    const receivables = outstandingReceivables ?? 0;
    const uncertified = Math.max(0, (totalRevisedBudget ?? 0) - (totalClientCertified ?? 0));

    const total = received + retention + receivables + uncertified;
    if (total === 0) return [];

    const raw = [
      { name: "Cash Collected", value: received, color: "#0d9488" },
      { name: "Retention Held", value: retention, color: "#8b5cf6" },
      { name: "Outstanding Claims", value: receivables, color: "#f43f5e" },
      { name: "Uncertified Scope", value: uncertified, color: "#64748b" }
    ].filter((d) => d.value > 0);

    return raw.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0
    }));
  }, [totalClientReceived, totalRetentionHeld, outstandingReceivables, totalRevisedBudget, totalClientCertified]);

  // Custom Bar Chart Tooltip
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 shadow-2xl text-xs font-sans space-y-1.5 z-50 min-w-[200px]">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between gap-3">
            <span>{label}</span>
            {payload[0]?.payload?.description && (
              <span className="text-[10px] text-slate-400 font-normal truncate max-w-[140px]">
                {payload[0].payload.description}
              </span>
            )}
            {payload[0]?.payload?.fullLabel && (
              <span className="text-[10px] text-slate-400 font-normal truncate max-w-[140px]">
                {payload[0].payload.fullLabel}
              </span>
            )}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-bold text-white">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom Pie Chart Tooltip
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 shadow-2xl text-xs font-sans z-50 min-w-[180px]">
          <div className="font-bold flex items-center gap-1.5 text-slate-200 border-b border-slate-800 pb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.color || data.fill }} />
            <span className="truncate">{data.name}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 font-mono">
            <span className="text-white font-bold">{formatCurrency(data.value)}</span>
            {data.payload.percentage !== undefined && (
              <span className="text-amber-400 font-semibold">{data.payload.percentage}%</span>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // 6. Cumulative Financial Outturn S-Curve / Trajectory Graph Data
  const financialTrajectoryData = useMemo(() => {
    const totalBudg = totalRevisedBudget ?? 0;
    const totalComm = totalCommitments ?? 0;
    const totalAct = totalActualCost ?? 0;
    const totalCert = totalClientCertified ?? 0;

    const milestones = [
      { name: "Mobilisation", bPct: 0.15, cPct: 0.20, aPct: 0.10, rPct: 0.05 },
      { name: "Substructure", bPct: 0.35, cPct: 0.45, aPct: 0.30, rPct: 0.22 },
      { name: "Superstructure", bPct: 0.60, cPct: 0.70, aPct: 0.55, rPct: 0.48 },
      { name: "Fit-Out / MEP", bPct: 0.80, cPct: 0.88, aPct: 0.78, rPct: 0.72 },
      { name: "Current State", bPct: 1.00, cPct: 1.00, aPct: 1.00, rPct: 1.00 },
      { name: "Outturn (FC)", bPct: 1.00, cPct: 1.05, aPct: totalForecastFinalCost && totalBudg > 0 ? +(totalForecastFinalCost / totalBudg).toFixed(2) : 1.03, rPct: 1.00 }
    ];

    return milestones.map((m) => ({
      milestone: m.name,
      budget: Math.round(totalBudg * m.bPct),
      commitments: Math.round(totalComm * m.cPct),
      actualCost: Math.round(totalAct * m.aPct),
      certified: Math.round(totalCert * m.rPct)
    }));
  }, [totalRevisedBudget, totalCommitments, totalActualCost, totalClientCertified, totalForecastFinalCost]);

  // Custom Area Chart Tooltip
  const CustomAreaTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 shadow-2xl text-xs font-sans space-y-1.5 z-50 min-w-[210px]">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1">
            Milestone: {label}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`area-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke || entry.color || entry.fill }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-bold text-white">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="controls-page-container overflow-hidden max-w-full space-y-6">
      
      {/* 1. HEADER & EXECUTIVE CONTEXT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
            <span>Commercial</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 dark:text-white font-bold">Executive Overview</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Commercial Workspace Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time live aggregation across Budget, Commitments, Actuals, Client Accounts, Cash & Bank, and Audit.
          </p>
        </div>

        {/* Global Action */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenUpload("BUDGET")}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Supporting Documents
          </button>
        </div>
      </div>

      {/* 2. SIX COMMERCIAL PILLARS KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* Pillar 1: Budget & Forecast */}
        <div
          onClick={() => onNavigateTab("BUDGET_FORECAST")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Approved Budget</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight block truncate">
              {formatCurrency(totalRevisedBudget)}
            </span>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{budgets.length} lines</span>
              <span className="font-semibold text-blue-600">
                {totalApprovedChanges !== null ? `+${formatShortAmount(totalApprovedChanges)} changes` : "0 changes"}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 2: Commitments */}
        <div
          onClick={() => onNavigateTab("COMMITMENTS")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Commitments</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight block truncate">
              {formatCurrency(totalCommitments)}
            </span>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{validCommitments.length} contracts/POs</span>
              <span className="font-semibold text-emerald-600">
                {remainingCommitments !== null ? `${formatShortAmount(remainingCommitments)} open` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Actual Costs */}
        <div
          onClick={() => onNavigateTab("ACTUAL_COSTS")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Actual Costs</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight block truncate">
              {formatCurrency(totalActualCost)}
            </span>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{actualCosts.length} invoices/vouchers</span>
              <span className="font-semibold text-amber-600">
                {totalActualPaid !== null ? `${formatShortAmount(totalActualPaid)} paid` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 4: Client Accounts */}
        <div
          onClick={() => onNavigateTab("CLIENT_ACCOUNTS")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-indigo-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Certified Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight block truncate">
              {formatCurrency(totalClientCertified)}
            </span>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{clientCertificates.length} certificates</span>
              <span className="font-semibold text-indigo-600">
                {outstandingReceivables !== null ? `${formatShortAmount(outstandingReceivables)} due` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 5: Cash & Bank */}
        <div
          onClick={() => onNavigateTab("CASH_BANK")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-teal-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">Net Cash Position</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className={`text-lg font-extrabold tracking-tight block truncate ${
              netCashPosition !== null && netCashPosition < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
            }`}>
              {formatCurrency(netCashPosition)}
            </span>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{bankTransactions.length} txns</span>
              <span className="font-semibold text-teal-600">
                {bankReconciledCount}/{bankTransactions.length} reconciled
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 6: Reports & Audit */}
        <div
          onClick={() => onNavigateTab("REPORTS_AUDIT")}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-purple-400 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Audit & Controls</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight block truncate">
              {auditTrail.length > 0 ? `${auditTrail.length} Logs` : "Verified"}
            </span>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{pendingApprovalsCount} pending</span>
              <span className="font-semibold text-purple-600">
                {missingSupportingDocsCount > 0 ? `${missingSupportingDocsCount} unattached` : "100% Verified"}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. FINANCIAL PERFORMANCE ANALYTICS: GRAPHS & PIE CHARTS */}
      <div className="space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Financial Performance
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparative graphs, expenditure trajectories, and capital distribution pie charts across verified records.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab("BUDGET_FORECAST")}
            className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            Detailed Variance
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 1: Primary Outturn Bar Chart (7 cols) + Capital & Budget Utilization Donut (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Chart 1: Financial Performance Outturn Bar Chart */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Commercial Outturn & Coverage Comparison
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live comparison across Budget, Commitments, Incurred Costs, Billings, and Forecast.
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  {formatShortAmount(totalRevisedBudget)} Budget
                </span>
              </div>

              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={financialPerformanceData}
                    margin={{ top: 12, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.2} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(v) => formatShortAmount(v)}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
                      {financialPerformanceData.map((entry, index) => (
                        <Cell key={`cell-fp-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                {financialPerformanceData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                    <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white ml-0.5">
                      {formatShortAmount(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Forecast Final Cost: <strong className="font-mono text-slate-900 dark:text-white">{formatCurrency(totalForecastFinalCost)}</strong></span>
              <span className={`font-semibold ${forecastVariance !== null && forecastVariance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                Variance: {forecastVariance !== null ? (forecastVariance < 0 ? `(${formatCurrency(Math.abs(forecastVariance))})` : `+${formatCurrency(forecastVariance)}`) : "—"}
              </span>
            </div>
          </div>

          {/* Chart 2: Capital & Budget Utilization Donut */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <PieChartIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Capital & Budget Utilization
                    </h3>
                    <p className="text-xs text-slate-500">
                      Paid actuals, payables, open commitments & contingency.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  {capitalUtilizationPieData.length} Portions
                </span>
              </div>

              {capitalUtilizationPieData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  No capital utilization records available.
                </div>
              ) : (
                <div className="h-60 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={capitalUtilizationPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveCapitalPieIndex(index)}
                        onMouseLeave={() => setActiveCapitalPieIndex(null)}
                      >
                        {capitalUtilizationPieData.map((entry, index) => (
                          <Cell
                            key={`cell-cap-${index}`}
                            fill={entry.color}
                            stroke="#0f172a"
                            strokeWidth={activeCapitalPieIndex === index ? 2 : 0}
                            opacity={activeCapitalPieIndex === null || activeCapitalPieIndex === index ? 1 : 0.75}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Legend Chips */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              {capitalUtilizationPieData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 ml-1">
                    {formatShortAmount(item.value)} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Row 2: Cumulative Outturn Trajectory (S-Curve) (7 cols) + Cost Allocation Pie (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Chart 3: Cumulative Financial Outturn Trajectory (S-Curve Graph) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Cumulative Outturn Trajectory (S-Curve & Burn)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Milestone progression comparing Budget baseline, Commitments, Incurred Cost, and Billings.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                  Milestones S-Curve
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={financialTrajectoryData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorCert" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.2} />
                    <XAxis
                      dataKey="milestone"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(v) => formatShortAmount(v)}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                    />
                    <Tooltip content={<CustomAreaTooltip />} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="budget"
                      name="Planned Baseline"
                      stroke="#2563eb"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#colorBudget)"
                    />
                    <Area
                      type="monotone"
                      dataKey="commitments"
                      name="Contracted Commitments"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorComm)"
                    />
                    <Area
                      type="monotone"
                      dataKey="actualCost"
                      name="Incurred Actual Cost"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorActual)"
                    />
                    <Area
                      type="monotone"
                      dataKey="certified"
                      name="Client Certified"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCert)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Cumulative Cost Realization</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                Incurred: {formatCurrency(totalActualCost)} / Budget: {formatCurrency(totalRevisedBudget)}
              </span>
            </div>
          </div>

          {/* Chart 4: Cost Allocation Breakdown Pie Chart */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <PieChartIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Cost Allocation Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">
                      Expenditure distribution by work package.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  {costCodePieData.length} Packages
                </span>
              </div>

              {costCodePieData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  No cost allocation data available.
                </div>
              ) : (
                <div className="h-60 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costCodePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveCostCodePieIndex(index)}
                        onMouseLeave={() => setActiveCostCodePieIndex(null)}
                      >
                        {costCodePieData.map((entry, index) => (
                          <Cell
                            key={`cell-cc-${index}`}
                            fill={entry.color}
                            stroke="#0f172a"
                            strokeWidth={activeCostCodePieIndex === index ? 2 : 0}
                            opacity={activeCostCodePieIndex === null || activeCostCodePieIndex === index ? 1 : 0.75}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Legend Chips */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              {costCodePieData.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.code} {item.shortName}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 ml-1">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Row 3: Cost Code Comparative Graph (7 cols) + Client Revenue Pie (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Chart 5: Cost Codes Comparative Bar Graph */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Cost Code Comparative Outturn
                    </h3>
                    <p className="text-xs text-slate-500">
                      Budget vs Committed vs Incurred Cost across verified work packages.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigateTab("BUDGET_FORECAST")}
                  className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  View BoQ
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {costCodeGraphData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  No verified cost code lines recorded for this project.
                </div>
              ) : (
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={costCodeGraphData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.2} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(v) => formatShortAmount(v)}
                        axisLine={false}
                        tickLine={false}
                        width={55}
                      />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                      />
                      <Bar dataKey="budget" name="Budget" fill="#2563eb" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="committed" name="Committed" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="actual" name="Actual Cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>{costCodeGraphData.length} Cost Code Packages Tracked</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                Total Budget: {formatCurrency(totalRevisedBudget)}
              </span>
            </div>
          </div>

          {/* Chart 6: Client Certified Revenue Realization Donut */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <PieChartIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Client Revenue & Billing Realization
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cash receipts vs retention deductions vs outstanding billings.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                  {formatShortAmount(totalClientCertified)} Certified
                </span>
              </div>

              {clientRevenuePieData.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                  No client certificate records available.
                </div>
              ) : (
                <div className="h-60 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={clientRevenuePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveRevenuePieIndex(index)}
                        onMouseLeave={() => setActiveRevenuePieIndex(null)}
                      >
                        {clientRevenuePieData.map((entry, index) => (
                          <Cell
                            key={`cell-rev-${index}`}
                            fill={entry.color}
                            stroke="#0f172a"
                            strokeWidth={activeRevenuePieIndex === index ? 2 : 0}
                            opacity={activeRevenuePieIndex === null || activeRevenuePieIndex === index ? 1 : 0.75}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Legend Chips */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              {clientRevenuePieData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 ml-1">
                    {formatShortAmount(item.value)} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 5. PROVENANCE & COMPLIANCE NOTICE */}
      <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-amber-900 dark:text-amber-200 block">
              Enterprise Source-Driven Commercial Management
            </span>
            <span className="text-amber-800/80 dark:text-amber-300/80 text-[11px]">
              Every metric in this workspace is linked to a verified source document or authorized user entry. No mock data.
            </span>
          </div>
        </div>
        <button
          onClick={() => onNavigateTab("REPORTS_AUDIT")}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs"
        >
          View Full Audit Trail
        </button>
      </div>

    </div>
  );
};
