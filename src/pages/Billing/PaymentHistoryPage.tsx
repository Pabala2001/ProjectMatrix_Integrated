import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { formatBillingCurrency } from "./subscriptionMapper";
import { useBillingOverview } from "./useBillingOverview";

const statusLabels: Record<string, string> = { initialized: "Awaiting checkout", pending: "Pending", succeeded: "Paid", failed: "Failed", cancelled: "Cancelled" };
export default function PaymentHistoryPage() {
  const { activeCompany } = useOutletContext<{ activeCompany?: { id: string; name: string } }>() ?? {};
  const { data, loading, error, refresh } = useBillingOverview(activeCompany?.id);
  const [query, setQuery] = useState("");
  const payments = useMemo(() => (data?.payments ?? []).filter(payment =>
    `${payment.provider_reference} ${statusLabels[payment.status]} ${payment.environment}`.toLowerCase().includes(query.toLowerCase())), [data, query]);
  return <div className="max-w-7xl mx-auto space-y-6">
    <div className="flex flex-wrap justify-between items-end gap-4">
      <div><nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">Billing <ChevronRight className="w-3 h-3" /><span className="text-amber-500">Payment History</span></nav>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Payment History</h1><p className="text-sm text-slate-500 mt-1">{activeCompany?.name ?? "Select a company to view payments."}</p></div>
      <button onClick={refresh} disabled={loading || !activeCompany?.id} className="flex gap-2 items-center text-sm font-bold disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
    </div>
    <div className="rounded-2xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#07182E] overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center gap-2"><Search className="w-4 h-4 text-slate-400" />
        <input aria-label="Search payment history" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by reference, status or environment" className="w-full bg-transparent text-sm outline-none focus:ring-2 focus:ring-amber-500 rounded px-2 py-1" /></div>
      {!activeCompany ? <p className="p-6 text-slate-500">Select a company to view payments.</p> : error ? <p role="alert" className="p-6 text-rose-600 dark:text-rose-400">{error}</p> : loading ? <p role="status" className="p-6 text-slate-500">Loading payment records…</p> : payments.length === 0 ? <p className="p-8 text-center text-slate-500">{query ? "No payments match your search." : "No recorded payments for this company yet."}</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-[#102846] text-slate-500 dark:text-slate-300"><tr>{["Date", "Reference", "Payment", "Amount", "Status", "Environment"].map(label => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{payments.map(payment => <tr key={payment.id} className="border-t border-slate-100 dark:border-[#1E3A5F]">
            <td className="px-5 py-4 whitespace-nowrap">{new Date(payment.paid_at ?? payment.created_at).toLocaleString("en-ZA")}</td>
            <td className="px-5 py-4 font-mono text-xs break-all select-all">{payment.provider_reference}</td>
            <td className="px-5 py-4 capitalize">{payment.purpose}</td>
            <td className="px-5 py-4 whitespace-nowrap font-semibold">{formatBillingCurrency(payment.amount_minor, payment.currency)}</td>
            <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${payment.status === "succeeded" ? "bg-emerald-100 text-emerald-800" : payment.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"}`}>{statusLabels[payment.status]}</span></td>
            <td className="px-5 py-4">{payment.environment === "test" ? "Test · no real money" : "Live"}</td>
          </tr>)}</tbody></table></div>}
    </div>
    <p className="text-xs text-slate-500">Showing up to the 100 most recent payment attempts. A payment is marked Paid only after server verification. Refunds and tax invoices are managed separately by your billing administrator.</p>
  </div>;
}
