import React, { useState, useMemo, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Search, 
  X, 
  CreditCard, 
  Building2, 
  Calendar, 
  ChevronRight, 
  Info,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { SubscriptionItem } from "./types";
import { StatusBadge } from "./StatusBadge";
import { AutoRenewalSwitch } from "./AutoRenewalSwitch";
import { SubscriptionDetailsDrawer } from "./SubscriptionDetailsDrawer";
import { TrialCountdown } from "./TrialCountdown";
import { getCurrentCompanySubscription, dispatchBillingRefreshEvent, subscribeToBillingRefresh } from "../../services/billingService";
import { BillingCheckoutError, getBillingOverview, getSavedCheckout, getPaystackManagementLink, referencePattern, runPaystackCheckout } from "../../services/paystackService";
import { mapDatabaseSubscriptionToUi } from "./subscriptionMapper";

export default function SubscriptionsPage() {
  const { activeCompany } = useOutletContext<any>() || {};
  const shouldReduceMotion = useReducedMotion();
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState(false);
  const [hasAttempt, setHasAttempt] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [billingLoading, setBillingLoading] = useState(true);
  const operationRef = useRef(0);
  const busyRef = useRef(false);
  const companyRef = useRef(activeCompany?.id);
  companyRef.current = activeCompany?.id;
  const handledReturn = useRef<string | null>(null);

  // Search & data state
  const [searchQuery, setSearchQuery] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);

  // Selected subscription for details drawer
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const lastClickedElementRef = useRef<HTMLElement | null>(null);

  // Notification toast for user actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  // Fetch real subscription data from Supabase
  useEffect(() => {
    let isCancelled = false;
    const companyId = activeCompany?.id;

    if (!companyId) {
      setSubscription(null);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    getCurrentCompanySubscription(companyId)
      .then((data) => {
        if (isCancelled) return;
        if (data) {
          const uiItem = mapDatabaseSubscriptionToUi(data, activeCompany?.name || "Company");
          setSubscription(uiItem);
        } else {
          setSubscription(null);
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to load company subscription:", msg);
        setSubscription(null);
        setErrorMessage(
          msg || "Failed to load subscription details from the database."
        );
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeCompany?.id, activeCompany?.name, reloadCounter]);

  const subscriptions = useMemo<SubscriptionItem[]>(() => {
    return subscription ? [subscription] : [];
  }, [subscription]);

  // Reactive filtering across approved search fields
  const filteredSubscriptions = useMemo(() => {
    if (!searchQuery.trim()) return subscriptions;

    const query = searchQuery.toLowerCase().trim();
    return subscriptions.filter((sub) => {
      return (
        sub.planName.toLowerCase().includes(query) ||
        sub.subscriptionCode.toLowerCase().includes(query) ||
        sub.associatedEntity.toLowerCase().includes(query) ||
        sub.status.toLowerCase().includes(query) ||
        sub.billingInterval.toLowerCase().includes(query)
      );
    });
  }, [subscriptions, searchQuery]);

  const handleOpenDetails = (sub: SubscriptionItem, event?: React.MouseEvent<HTMLElement>) => {
    if (event) {
      lastClickedElementRef.current = event.currentTarget;
    }
    setSelectedSubscription(sub);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  async function handlePayment(action: "checkout" | "status", expectedReference?: string) {
    const companyId = activeCompany?.id;
    if (!companyId || busyRef.current) return;
    busyRef.current = true;
    const operation = ++operationRef.current;
    const isCurrent = () => companyRef.current === companyId && operationRef.current === operation;
    setPaymentBusy(true);
    setPaymentMessage(action === "status" ? "Checking your payment with Paystack…" : "Opening secure Paystack checkout…");
    try {
      const result = await runPaystackCheckout(companyId, { action, autoRenew, expectedReference });
      if (!isCurrent()) return;
      if (result.payment_status === "succeeded") {
        setPaymentMessage("Payment confirmed. Your subscription has been updated.");
        setHasAttempt(false);
        try { sessionStorage.removeItem("projectmatrix:paystack-return"); } catch { /* Payment is already confirmed. */ }
        // Remove a completed return reference so remounting does not retry it.
        try {
        const url = new URL(window.location.href);
        const [route, query = ""] = url.hash.slice(1).split("?");
        const params = new URLSearchParams(query);
        if (params.get("reference") === result.provider_reference) {
          params.delete("reference");
          params.delete("trxref");
          url.hash = route + (params.size ? `?${params.toString()}` : "");
          window.history.replaceState(window.history.state, "", url);
        }
        } catch { /* URL cleanup must not undo a confirmed payment. */ }
        setReloadCounter(value => value + 1);
      } else if (action === "checkout" && result.checkout_url) {
        setHasAttempt(true);
        window.location.assign(result.checkout_url);
      }
    } catch (error) {
      if (!isCurrent()) return;
      setPaymentMessage(error instanceof Error ? error.message : "Payment could not be confirmed. Please check again.");
      if (error instanceof BillingCheckoutError && error.code === "PAYMENT_ATTEMPT_TERMINAL") setHasAttempt(false);
      else {
        const saved = await getSavedCheckout(companyId).catch(() => null);
        if (isCurrent()) setHasAttempt(!!saved);
      }
    } finally {
      if (isCurrent()) { busyRef.current = false; setPaymentBusy(false); }
    }
  }
  const handleActionTrigger = (_actionName: string, _sub: SubscriptionItem) => {
    handleCloseDrawer();
    void handlePayment("checkout");
  };
  async function handleManage() {
    const companyId = activeCompany?.id;
    if (!companyId || busyRef.current) return;
    busyRef.current = true; setPaymentBusy(true);
    const operation = ++operationRef.current;
    const isCurrent = () => companyRef.current === companyId && operationRef.current === operation;
    try {
      const url = await getPaystackManagementLink(companyId);
      if (isCurrent()) window.location.assign(url);
    } catch (error) { if (isCurrent()) setPaymentMessage(error instanceof Error ? error.message : "Please retry."); }
    finally { if (isCurrent()) { busyRef.current = false; setPaymentBusy(false); } }
  }

  useEffect(() => {
    setIsDrawerOpen(false); setSelectedSubscription(null); setPaymentMessage(null);
    setHasAttempt(false); setCanManage(false); setAutoRenew(false);
    busyRef.current = false; setPaymentBusy(false); setBillingLoading(true);
    return () => { operationRef.current += 1; };
  }, [activeCompany?.id]);
  useEffect(() => {
    setSelectedSubscription(previous => previous && subscription && previous.id === subscription.id ? subscription : null);
    if (!subscription || (selectedSubscription && selectedSubscription.id !== subscription.id)) setIsDrawerOpen(false);
  }, [subscription]);
  useEffect(() => subscribeToBillingRefresh(companyId => {
    if (!companyId || companyId === activeCompany?.id) setReloadCounter(value => value + 1);
  }), [activeCompany?.id]);
  useEffect(() => {
    const companyId = activeCompany?.id;
    if (!companyId) return;
    let cancelled = false;
    setBillingLoading(true);
    Promise.all([getBillingOverview(companyId), getSavedCheckout(companyId)]).then(([overview, saved]) => {
      if (cancelled) return;
      const attempt = overview.active_attempt ?? saved;
      setHasAttempt(!!attempt); setCanManage(overview.has_recurring_subscription);
      if (attempt) setAutoRenew(attempt.auto_renew);
      setBillingLoading(false);
      const query = window.location.hash.split("?")[1] ?? "";
      let reference = new URLSearchParams(query).get("reference");
      if (!reference) {
        try { reference = sessionStorage.getItem("projectmatrix:paystack-return"); } catch { /* The return URL still works without session storage. */ }
      }
      if (reference && referencePattern.test(reference) && attempt?.provider_reference === reference &&
          !busyRef.current && handledReturn.current !== `${companyId}:${reference}`) {
        handledReturn.current = `${companyId}:${reference}`;
        void handlePayment("status", reference);
      }
    }).catch(error => { if (!cancelled) setPaymentMessage(error instanceof Error ? error.message : "Billing records could not be loaded."); });
    return () => { cancelled = true; };
  }, [activeCompany?.id, reloadCounter]);
  useEffect(() => {
    const refresh = () => setReloadCounter(value => value + 1);
    const timer = window.setInterval(refresh, 90000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };
  }, []);

  const handleRetry = () => {
    setReloadCounter((prev) => prev + 1);
    if (activeCompany?.id) {
      dispatchBillingRefreshEvent(activeCompany.id);
    }
  };

  // State 1: No Active Company Selected
  if (!activeCompany) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Billing</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[#FF9F1C] font-bold">Subscriptions</span>
          </nav>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Subscriptions
          </h1>
        </div>

        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-[#07182E] rounded-3xl border border-slate-200 dark:border-[#1E3A5F] shadow-xs max-w-xl mx-auto my-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#102846] border border-[#1E3A5F] flex items-center justify-center mb-5 text-[#FF9F1C]">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            No Active Company Selected
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            Please select an active company from the workspace selector in the top bar to view and manage its software subscriptions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl bg-[#07182E] text-white border border-[#FF9F1C]/40 shadow-2xl flex items-start gap-3"
            role="status"
            aria-live="polite"
          >
            <Info className="w-5 h-5 text-[#FF9F1C] shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-slate-200">{toastMessage}</p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header & Breadcrumbs */}
      <div>
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          <span>Billing</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#FF9F1C] font-bold">Subscriptions</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Subscriptions
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          Manage software licenses and service subscriptions for <span className="font-bold text-slate-800 dark:text-slate-200">{activeCompany.name}</span>.
        </p>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] shadow-xs">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by plan name, subscription reference, entity or status..."
            aria-label="Search subscriptions"
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-[#0B2345] border border-slate-200 dark:border-[#1E3A5F] rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF9F1C]/50 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search input"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#07182E] p-5 space-y-3" aria-label="Subscription payment">
        {(subscription?.checkoutEligible || hasAttempt) && <>
          <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={autoRenew} disabled={paymentBusy || isLoading || billingLoading || hasAttempt} onChange={event => setAutoRenew(event.target.checked)} className="mt-1 accent-amber-500" />
            <span>Enable monthly auto-renewal at {subscription?.formattedAmount ?? "the subscription price"}. You can cancel through Paystack.
              {!autoRenew && <span className="block text-xs mt-1 text-slate-500">This payment covers one month. You will renew manually.</span>}
              {hasAttempt && <span className="block text-xs mt-1 text-slate-500">Your existing payment retains the renewal choice made when it started.</span>}
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button disabled={paymentBusy || isLoading || billingLoading} onClick={() => void handlePayment("checkout")} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm disabled:opacity-50">{hasAttempt ? "Resume payment" : "Pay now"}</button>
            {hasAttempt && <button disabled={paymentBusy || isLoading || billingLoading} onClick={() => void handlePayment("status")} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold disabled:opacity-50">Check payment</button>}
          </div>
        </>}
        {canManage && <button disabled={paymentBusy || isLoading || billingLoading} onClick={() => void handleManage()} className="text-sm font-bold text-amber-600 dark:text-amber-400 disabled:opacity-50">Manage recurring subscription on Paystack</button>}
        {paymentMessage && <p role="status" aria-live="polite" className="text-sm text-slate-700 dark:text-slate-200">{paymentMessage}</p>}
        {paymentMessage && billingLoading && <button type="button" disabled={paymentBusy} onClick={handleRetry} className="text-sm font-bold text-amber-600 dark:text-amber-400 disabled:opacity-50">Refresh billing</button>}
        <p className="text-xs text-slate-500">Paystack confirms your payment securely. Card details are entered on Paystack.</p>
      </section>

      {/* Subscription Results Container */}
      {isLoading ? (
        /* State: Loading */
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-[#07182E] rounded-3xl border border-slate-200 dark:border-[#1E3A5F] shadow-xs text-center">
          <RefreshCw className="w-8 h-8 text-[#FF9F1C] animate-spin mb-4" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Loading subscription data...
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Loading your subscription details.
          </p>
        </div>
      ) : errorMessage ? (
        /* State: Error */
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-[#07182E] rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-500">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            Unable to Load Subscription
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-5 px-4 py-2 bg-[#102846] text-white text-xs font-bold rounded-xl hover:bg-[#15345a] transition-all cursor-pointer shadow-xs flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Query</span>
          </button>
        </div>
      ) : subscriptions.length === 0 ? (
        /* State: No Subscriptions registered for this company */
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-[#07182E] rounded-3xl border border-slate-200 dark:border-[#1E3A5F] shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
            <CreditCard className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            No Subscriptions Found
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            This company currently has no active or past software subscriptions registered in the system.
          </p>
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        /* State: No matching search results */
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-[#07182E] rounded-3xl border border-slate-200 dark:border-[#1E3A5F] shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-[#FF9F1C]">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            No matching subscriptions
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            No subscriptions matched your query <span className="font-semibold text-slate-700 dark:text-slate-300">"{searchQuery}"</span>. Try checking for typos or searching by plan name or subscription reference.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-5 px-4 py-2 bg-[#102846] text-white text-xs font-bold rounded-xl hover:bg-[#15345a] transition-all cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
          >
            Clear Search
          </button>
        </div>
      ) : (
        /* Results List / Responsive Cards */
        <div className="space-y-3">
          {filteredSubscriptions.map((sub) => (
            <motion.div
              key={sub.id}
              layout={!shouldReduceMotion}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => handleOpenDetails(sub, e)}
              className="group p-5 rounded-2xl bg-white dark:bg-[#07182E] border border-slate-200 dark:border-[#1E3A5F] hover:border-[#FF9F1C]/40 hover:shadow-md transition-all cursor-pointer relative focus-within:ring-2 focus-within:ring-[#FF9F1C]"
            >
              {/* Responsive Layout */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Plan Info & Reference */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-[#102846] dark:bg-[#0B2345] border border-[#1E3A5F] flex items-center justify-center text-[#FF9F1C] shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <CreditCard className="w-5 h-5" />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                        {sub.planName}
                      </h3>
                      <StatusBadge 
                        status={sub.status} 
                        size="sm" 
                      />
                      {sub.isTrialing && sub.trialEndsAtIso && (
                        <TrialCountdown trialEndsAt={sub.trialEndsAtIso} />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-[11px] text-slate-700 dark:text-amber-400/90 font-bold">
                        {sub.subscriptionCode}
                      </span>
                      <span>&bull;</span>
                      <span className="truncate">{sub.associatedEntity}</span>
                    </div>
                  </div>
                </div>

                {/* Middle / Right: Financials, Dates & Auto-Renewal */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-x-6 gap-y-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                  {/* Amount */}
                  <div className="text-left lg:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Renewal Amount
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      {sub.formattedAmount}
                    </span>
                  </div>

                  {/* Expiration / Renewal Date */}
                  <div className="text-left lg:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      {sub.status === "expired" ? "Period ended" : sub.isTrialing ? "Trial ends" : "Next renewal / period end"}
                    </span>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#FF9F1C]" />
                      <span>{sub.nextRenewalDate}</span>
                    </div>
                  </div>

                  {/* Auto-Renewal Toggle Switch (Read-Only) */}
                  <div 
                    className="text-left lg:text-right"
                    onClick={(e) => e.stopPropagation()}
                    title={sub.autoRenewalIneligibleReason}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Auto-Renewal
                    </span>
                    <AutoRenewalSwitch
                      id={`card-switch-${sub.id}`}
                      subscriptionName={sub.planName}
                      autoRenewal={sub.autoRenewal}
                      available={false}
                      ineligibleReason={sub.autoRenewalIneligibleReason}
                      onToggle={() => {}}
                      size="sm"
                      describedBy={`card-ineligible-desc-${sub.id}`}
                    />
                    <p id={`card-ineligible-desc-${sub.id}`} className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-[160px] truncate" title={sub.autoRenewalIneligibleReason}>
                      {sub.autoRenewalIneligibleReason}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {sub.checkoutEligible && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionTrigger("Pay now", sub);
                        }}
                        disabled={paymentBusy || isLoading || billingLoading}
                        className="disabled:opacity-50 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider transition-all shadow-xs cursor-pointer flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Pay now</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetails(sub, e);
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#102846] hover:text-white hover:border-[#102846] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[#FF9F1C]"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Subscription Details Drawer */}
      <SubscriptionDetailsDrawer
        subscription={selectedSubscription}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onActionTrigger={handleActionTrigger}
        originatingElementRef={lastClickedElementRef}
        isActionPending={paymentBusy || isLoading || billingLoading}
      />
    </div>
  );
}
