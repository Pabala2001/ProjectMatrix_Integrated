import { useCallback, useEffect, useState } from "react";
import { getBillingOverview, type BillingOverview } from "../../services/paystackService";
import { subscribeToBillingRefresh } from "../../services/billingService";

interface OverviewState {
  companyId?: string;
  version: number;
  data: BillingOverview | null;
  error: string | null;
  loading: boolean;
}

export function useBillingOverview(companyId?: string) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<OverviewState>({ version: -1, data: null, error: null, loading: false });
  const refresh = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => subscribeToBillingRefresh(id => {
    if (!id || id === companyId) refresh();
  }), [companyId, refresh]);

  useEffect(() => {
    let cancelled = false;
    const empty = { companyId, version, data: null, error: null };
    setState({ ...empty, loading: !!companyId });
    if (!companyId) return;
    getBillingOverview(companyId).then(data => {
      if (!cancelled) setState({ ...empty, data, loading: false });
    }).catch(error => {
      if (!cancelled) setState({ ...empty, loading: false,
        error: error instanceof Error ? error.message : "Billing records could not be loaded." });
    });
    return () => { cancelled = true; };
  }, [companyId, version]);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  // Hide previous-company records immediately, before effect cleanup runs.
  const current = !!companyId && state.companyId === companyId && state.version === version;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !!companyId && (!current || state.loading),
    refresh,
  };
}
