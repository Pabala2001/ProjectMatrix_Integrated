import React, { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ChevronRight, CreditCard, RefreshCw } from "lucide-react";
import { getPaystackManagementLink, getPaystackSubscriptionCard, type CurrentSubscriptionCard } from "../../services/paystackService";
import { useBillingOverview } from "./useBillingOverview";

export default function PaymentMethodsPage() {
  const { activeCompany } = useOutletContext<{ activeCompany?: { id: string; name: string } }>() ?? {};
  const { data, loading, error, refresh } = useBillingOverview(activeCompany?.id);
  const [cardVersion, setCardVersion] = useState(0);
  const [currentCard, setCurrentCard] = useState<{ companyId: string; card: CurrentSubscriptionCard | null; error: string | null } | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const recurring = data?.has_recurring_subscription === true;
  useEffect(() => {
    const companyId = activeCompany?.id;
    let cancelled = false, inFlight = false;
    setCurrentCard(null);
    if (!companyId || !recurring) { setCardLoading(false); return; }
    const load = async () => {
      if (inFlight || cancelled) return;
      inFlight = true; setCardLoading(true);
      try {
        const card = await getPaystackSubscriptionCard(companyId);
        if (!cancelled) setCurrentCard({ companyId, card, error: null });
      } catch (err) {
        if (!cancelled) setCurrentCard({ companyId, card: null,
          error: err instanceof Error ? err.message : "The current renewal card could not be verified. Please refresh." });
      } finally { inFlight = false; if (!cancelled) setCardLoading(false); }
    };
    void load();
    const onFocus = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(onFocus, 60_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true; window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [activeCompany?.id, recurring, cardVersion]);
  const scopedCard = currentCard?.companyId === activeCompany?.id ? currentCard : null;
  const methods = recurring ? (scopedCard?.card ? [scopedCard.card] : []) : (data?.methods ?? []);
  const displayedError = error || (recurring ? scopedCard?.error : null);
  const waiting = loading || (recurring && !scopedCard);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const companyRef = useRef(activeCompany?.id); companyRef.current = activeCompany?.id;
  const operationRef = useRef(0);
  const inFlightRef = useRef(false);
  useEffect(() => {
    setMessage(null); setBusy(false); inFlightRef.current = false;
    return () => { operationRef.current += 1; inFlightRef.current = false; };
  }, [activeCompany?.id]);
  async function manage() {
    const companyId = activeCompany?.id;
    if (!companyId || inFlightRef.current || loading || error || !data?.has_recurring_subscription) return;
    const operation = ++operationRef.current;
    const isCurrent = () => companyRef.current === companyId && operationRef.current === operation;
    inFlightRef.current = true;
    setBusy(true); setMessage(null);
    try { const url = await getPaystackManagementLink(companyId); if (isCurrent()) window.location.assign(url); }
    catch (error) { if (isCurrent()) setMessage(error instanceof Error ? error.message : "Please retry."); }
    finally { if (isCurrent()) { inFlightRef.current = false; setBusy(false); } }
  }
  return <div className="max-w-7xl mx-auto space-y-6">
    <div className="flex justify-between items-end gap-4"><div>
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">Billing <ChevronRight className="w-3 h-3" /><span className="text-amber-500">Payment Methods</span></nav>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Payment Methods</h1>
      <p className="text-sm text-slate-500 mt-1">{activeCompany?.name ?? "Select a company to view payment methods."}</p></div>
      <button onClick={() => { refresh(); setCardVersion(value => value + 1); }} disabled={loading || cardLoading || !activeCompany?.id} className="flex gap-2 items-center text-sm font-bold disabled:opacity-50"><RefreshCw className="w-4 h-4" />Refresh</button>
    </div>
    {displayedError && <p role="alert" className="text-rose-600 dark:text-rose-400">{displayedError}</p>}
    {!activeCompany ? <p>Select a company to view payment methods.</p> : waiting ? <p role="status">Loading payment methods…</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {methods.map(method => <article key={method.id} className="rounded-2xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#07182E] p-6 space-y-4">
        <div className="flex items-center justify-between"><CreditCard className="w-7 h-7 text-amber-500" /><span className="text-xs font-semibold text-slate-500">{method.environment === "test" ? "Test card" : "Live card"}</span></div>
        <p className="text-xs font-semibold text-slate-500">{recurring ? "Current subscription card on Paystack" : "Card from a verified payment"}</p>
        <p className="font-bold capitalize">{method.brand}</p><p className="font-mono text-lg tracking-wider">•••• •••• •••• {method.last4}</p>
        <p className="text-sm text-slate-500">Expires {String(method.expiry_month).padStart(2, "0")}/{method.expiry_year}</p>
      </article>)}
      {!displayedError && !methods.length && <p className="p-6 rounded-2xl border border-slate-200 dark:border-[#1E3A5F] text-slate-500 md:col-span-2">{recurring ? "Paystack has not returned a current card for this subscription. Check your payment method using Manage on Paystack." : "No payment methods have been recorded. A reusable card is added after a successful Paystack payment."}</p>}
    </div>}
    <div className="rounded-2xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#07182E] p-5 space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">Enter card details securely on Paystack. For recurring subscriptions, use Paystack to update the billing card or cancel auto-renewal. {recurring ? "The card shown is checked directly with Paystack for this subscription." : "These card summaries reflect verified payments."}</p>
      {data?.has_recurring_subscription ? <button disabled={busy || loading || !!error} onClick={() => void manage()} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm disabled:opacity-50">{busy ? "Opening Paystack…" : "Manage on Paystack"}</button> : <Link to="/billing/subscriptions" className="text-sm font-bold text-amber-600 dark:text-amber-400">Go to subscription payments</Link>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  </div>;
}
