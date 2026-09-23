import { assertOperationalAction } from "../../../integration/operationalAccess";
import React, { useState } from "react";
import {
  FileText,
  Download,
  History,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Building2,
  Layers
} from "lucide-react";
import {
  CommercialAuditEntry,
  CommercialOverviewMetrics,
  BudgetLineItem,
  ForecastLineItem,
  CommitmentRegisterItem,
  ActualCostRegisterItem,
  ClientCertificateRecord,
  SupplierInvoiceRecord,
  BankTransactionRecord
} from "../../../types/commercialWorkspace";
import { formatCurrency as formatCentralCurrency } from "../../../utils/currency";

interface CommercialReportsAuditViewProps {
  auditTrail: CommercialAuditEntry[];
  metrics: CommercialOverviewMetrics;
  budgets: BudgetLineItem[];
  forecasts: ForecastLineItem[];
  commitments: CommitmentRegisterItem[];
  actualCosts: ActualCostRegisterItem[];
  clientCertificates: ClientCertificateRecord[];
  supplierInvoices: SupplierInvoiceRecord[];
  bankTransactions: BankTransactionRecord[];
  currency: string;
}

export const CommercialReportsAuditView: React.FC<CommercialReportsAuditViewProps> = ({
  auditTrail,
  metrics,
  budgets,
  forecasts,
  commitments,
  actualCosts,
  clientCertificates,
  supplierInvoices,
  bankTransactions,
  currency = "USD"
}) => {
  const [selectedReport, setSelectedReport] = useState<string>("AUDIT_TRAIL");
  const [searchQuery, setSearchQuery] = useState("");

  const formatValue = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return formatCentralCurrency(val, currency);
  };

  const handleExportCSV = (filename: string, rows: any[]) => {
    assertOperationalAction("export", "components/commercial/views/CommercialReportsAuditView.tsx");
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(","),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const REPORTS = [
    { id: "AUDIT_TRAIL", name: "1. Commercial Provenance & Audit Trail", description: "Complete immutable log of all imports, value modifications, and authorized override justifications." },
    { id: "BUDGET_VARIANCE", name: "2. Budget vs Actual Variance Statement", description: "Variance analysis comparing approved budget baselines against actual posted costs." },
    { id: "COST_SUMMARY_EAC", name: "3. Cost Summary & EAC Outturn Report", description: "Comprehensive estimate-at-completion reconciliation across all cost codes." },
    { id: "COMMITMENT_STATUS", name: "4. Commitments & Procurement Status", description: "Open purchase orders and subcontract commitments vs certified billings." },
    { id: "CLIENT_RECEIVABLES", name: "5. Client Receivables & IPC Realization", description: "Certified payment claims, client invoices, and payment receipt aging." },
    { id: "SUPPLIER_PAYABLES", name: "6. Supplier Payables Aging Report", description: "Approved supplier invoices, credit adjustments, due dates, and outstanding liabilities." }
  ];

  return (
    <div className="controls-page-container overflow-hidden max-w-full space-y-6">
      
      {/* Report Selector Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {REPORTS.slice(0, 3).map(r => (
          <div
            key={r.id}
            onClick={() => setSelectedReport(r.id)}
            className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
              selectedReport === r.id
                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
            }`}
          >
            <h5 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
              {r.name}
            </h5>
            <p className="text-[11px] text-slate-500 line-clamp-2">
              {r.description}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {REPORTS.slice(3, 6).map(r => (
          <div
            key={r.id}
            onClick={() => setSelectedReport(r.id)}
            className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
              selectedReport === r.id
                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
            }`}
          >
            <h5 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
              {r.name}
            </h5>
            <p className="text-[11px] text-slate-500 line-clamp-2">
              {r.description}
            </p>
          </div>
        ))}
      </div>

      {/* REPORT CONTENT VIEW */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {REPORTS.find(r => r.id === selectedReport)?.name}
            </h3>
            <p className="text-xs text-slate-500">
              {REPORTS.find(r => r.id === selectedReport)?.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedReport === "AUDIT_TRAIL") handleExportCSV("Commercial_Audit_Trail", auditTrail);
                else if (selectedReport === "BUDGET_VARIANCE") handleExportCSV("Budget_Variance_Report", budgets);
                else if (selectedReport === "COST_SUMMARY_EAC") handleExportCSV("Cost_Summary_EAC", forecasts);
                else if (selectedReport === "COMMITMENT_STATUS") handleExportCSV("Commitments_Report", commitments);
                else if (selectedReport === "CLIENT_RECEIVABLES") handleExportCSV("Client_Receivables_Report", clientCertificates);
                else if (selectedReport === "SUPPLIER_PAYABLES") handleExportCSV("Supplier_Payables_Report", supplierInvoices);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export to CSV
            </button>
          </div>
        </div>

        {/* 1. AUDIT TRAIL */}
        {selectedReport === "AUDIT_TRAIL" && (
          <div>
            {auditTrail.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                <History className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <p>No audit trail logs recorded yet.</p>
                <p className="text-[11px] text-slate-500">All data imports and manual adjustments are tracked here automatically.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[900px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 w-36 overflow-hidden text-ellipsis truncate">Timestamp</th>
                      <th className="py-2.5 px-3 w-28 overflow-hidden text-ellipsis truncate">Action</th>
                      <th className="py-2.5 px-3 w-28 overflow-hidden text-ellipsis truncate">User</th>
                      <th className="py-2.5 px-3 w-36 overflow-hidden text-ellipsis truncate">Target Field</th>
                      <th className="py-2.5 px-3 w-40 overflow-hidden text-ellipsis truncate">Source Document</th>
                      <th className="py-2.5 px-3 min-w-[160px] overflow-hidden text-ellipsis truncate">Override / Change Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditTrail.map((a, idx) => (
                      <tr key={a.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-mono text-slate-500 truncate overflow-hidden">
                          {new Date(a.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white truncate overflow-hidden">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 truncate inline-block max-w-full">
                            {a.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium truncate overflow-hidden">
                          {a.changedBy}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate overflow-hidden">
                          {a.fieldName || "Commercial Record"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 truncate overflow-hidden">
                          {a.sourceDocument || "Direct Workspace Action"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 italic truncate overflow-hidden" title={a.overrideReason || a.notes || ""}>
                          {a.overrideReason || a.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. BUDGET VARIANCE */}
        {selectedReport === "BUDGET_VARIANCE" && (
          <div className="space-y-3">
            {budgets.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No verified budget data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[700px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Cost Code</th>
                      <th className="py-2.5 px-3 min-w-[160px] overflow-hidden text-ellipsis truncate">Description</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">Original Budget</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">Approved Changes</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">Revised Budget</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {budgets.map(b => (
                      <tr key={b.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">{b.costCode}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300 truncate overflow-hidden" title={b.description}>{b.description}</td>
                        <td className="py-2 px-3 text-right font-mono whitespace-nowrap truncate overflow-hidden">{formatValue(b.originalBudget)}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-600 whitespace-nowrap truncate overflow-hidden">{formatValue(b.approvedChanges)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap truncate overflow-hidden">{formatValue(b.revisedBudget ?? b.originalBudget)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. COST SUMMARY & EAC */}
        {selectedReport === "COST_SUMMARY_EAC" && (
          <div className="space-y-3">
            {forecasts.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No verified forecast data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Cost Code</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Revised Budget</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Actual Cost</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Commitments</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">ETC</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">EAC (Final Cost)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {forecasts.map(f => (
                      <tr key={f.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">{f.costCode}</td>
                        <td className="py-2 px-3 text-right font-mono whitespace-nowrap truncate overflow-hidden">{formatValue(f.revisedBudget)}</td>
                        <td className="py-2 px-3 text-right font-mono whitespace-nowrap truncate overflow-hidden">{formatValue(f.actualCost)}</td>
                        <td className="py-2 px-3 text-right font-mono whitespace-nowrap truncate overflow-hidden">{formatValue(f.commitments)}</td>
                        <td className="py-2 px-3 text-right font-mono whitespace-nowrap truncate overflow-hidden">{formatValue(f.forecastToComplete)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-950 dark:text-white whitespace-nowrap truncate overflow-hidden">{formatValue(f.forecastFinalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. COMMITMENTS */}
        {selectedReport === "COMMITMENT_STATUS" && (
          <div className="space-y-3">
            {commitments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No verified commitment data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[750px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Ref</th>
                      <th className="py-2.5 px-3 min-w-[140px] overflow-hidden text-ellipsis truncate">Supplier / Subcontractor</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">Current Value</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Paid</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {commitments.map(c => (
                      <tr key={c.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">{c.ref}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 truncate overflow-hidden" title={c.counterparty}>{c.counterparty}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap truncate overflow-hidden">{formatValue(c.currentCommitment)}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-600 whitespace-nowrap truncate overflow-hidden">{formatValue(c.paid)}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-900 dark:text-amber-200 whitespace-nowrap truncate overflow-hidden">{formatValue(c.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 5. CLIENT RECEIVABLES */}
        {selectedReport === "CLIENT_RECEIVABLES" && (
          <div className="space-y-3">
            {clientCertificates.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No verified client certificate data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[750px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">Certificate #</th>
                      <th className="py-2.5 px-3 whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Period</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">Certified Net</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Paid</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {clientCertificates.map(c => (
                      <tr key={c.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">{c.certificateNumber}</td>
                        <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap truncate overflow-hidden">{c.period}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap truncate overflow-hidden">{formatValue(c.certifiedAmount)}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-600 whitespace-nowrap truncate overflow-hidden">{formatValue(c.paidAmount)}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-900 dark:text-amber-200 font-bold whitespace-nowrap truncate overflow-hidden">{formatValue(c.outstandingAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 6. SUPPLIER PAYABLES */}
        {selectedReport === "SUPPLIER_PAYABLES" && (
          <div className="space-y-3">
            {supplierInvoices.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No verified supplier invoice data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[750px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">Invoice #</th>
                      <th className="py-2.5 px-3 min-w-[140px] overflow-hidden text-ellipsis truncate">Supplier</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-32 overflow-hidden text-ellipsis truncate">Total Payable</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Paid</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap w-28 overflow-hidden text-ellipsis truncate">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {supplierInvoices.map(inv => {
                      const total = inv.amount || 0;
                      const paid = inv.paidAmount || 0;
                      const outstanding = Math.max(0, total - paid);
                      return (
                        <tr key={inv.id}>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap truncate overflow-hidden">{inv.invoiceNumber}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 truncate overflow-hidden" title={inv.supplierName}>{inv.supplierName}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap truncate overflow-hidden">{formatValue(total)}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600 whitespace-nowrap truncate overflow-hidden">{formatValue(paid)}</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-900 dark:text-amber-200 font-bold whitespace-nowrap truncate overflow-hidden">{formatValue(outstanding)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
