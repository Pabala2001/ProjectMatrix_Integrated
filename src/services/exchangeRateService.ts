/**
 * Live Foreign Exchange Rate Service
 * 
 * Fetches real-world foreign exchange rates against USD pivot from reliable live FX endpoints,
 * caches them with timestamps, provides fallback resilience, and notifies subscribers on update.
 */

import { SupportedCurrency, SUPPORTED_CURRENCIES } from "../config/currencies";

export interface ExchangeRates {
  [currencyCode: string]: number; // Amount of currency per 1 USD (e.g. ZAR: 16.12, TZS: 2641.87)
}

export interface ExchangeRateState {
  rates: ExchangeRates;
  lastUpdated: string; // Human readable timestamp
  timestampIso: string;
  isLive: boolean;
  isStale: boolean;
  source: string;
  error?: string | null;
}

// Fallback baseline market rates (USD base = 1.0)
const BASELINE_RATES: ExchangeRates = {
  USD: 1.0,
  // Southern Africa
  ZAR: 16.12,
  BWP: 13.72,
  NAD: 16.12,
  SZL: 16.12,
  LSL: 16.12,
  ZMW: 26.50,
  ZWG: 13.85,
  MZN: 63.80,
  MWK: 1730.0,
  AOA: 915.0,
  MGA: 4550.0,
  MUR: 46.20,
  SCR: 14.10,
  KMF: 423.0,

  // East Africa
  TZS: 2641.87,
  KES: 129.50,
  UGX: 3680.0,
  RWF: 1375.0,
  BIF: 2950.0,
  ETB: 125.0,
  ERN: 15.0,
  DJF: 178.0,
  SOS: 571.0,
  SSP: 130.0,
  SDG: 601.0,

  // West Africa
  NGN: 1520.0,
  GHS: 15.40,
  XOF: 565.0,
  GNF: 8650.0,
  SLE: 22.80,
  LRD: 195.0,
  GMD: 70.50,
  CVE: 95.0,
  MRU: 39.80,

  // Central Africa
  XAF: 565.0,
  CDF: 2850.0,
  STN: 21.10,

  // North Africa
  EGP: 48.60,
  MAD: 9.20,
  DZD: 132.50,
  TND: 3.05,
  LYD: 4.85,

  // Major Global
  EUR: 0.8614,
  GBP: 0.7490,
  CHF: 0.8020,
  JPY: 145.20,
  CNY: 7.1250,
  AUD: 1.4280,
  CAD: 1.3620,
  SGD: 1.2840,
  HKD: 7.7720,
  NZD: 1.5850,
  INR: 87.40,
  BRL: 5.450,
  SEK: 9.650,
  NOK: 9.950,
  DKK: 6.420,
  TRY: 34.20,

  // Middle East & Gulf (GCC)
  SAR: 3.750,
  AED: 3.6725,
  QAR: 3.640,
  KWD: 0.3060,
  OMR: 0.3850,
  BHD: 0.3760
};

const CACHE_KEY_RATES = "pm_fx_rates_cache_v2";
const CACHE_KEY_TIMESTAMP = "pm_fx_last_updated";
const CACHE_KEY_ISO = "pm_fx_timestamp_iso";
const CACHE_KEY_SOURCE = "pm_fx_source";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL for background refreshes

export class ExchangeRateService {
  private currentState: ExchangeRateState;
  private listeners: Set<(state: ExchangeRateState) => void> = new Set();
  private fetchPromise: Promise<ExchangeRateState> | null = null;
  private isInitialized = false;

  constructor() {
    this.currentState = this.loadCachedRates();
    // Auto-fetch fresh rates on creation in background
    if (typeof window !== "undefined") {
      setTimeout(() => {
        void this.fetchLiveRates().catch((error) => {
          console.warn("Background FX refresh failed; retaining cached rates:", error);
        });
      }, 100);
    }
  }

  private loadCachedRates(): ExchangeRateState {
    if (typeof window === "undefined") {
      return {
        rates: { ...BASELINE_RATES },
        lastUpdated: "Default Baseline Rates",
        timestampIso: new Date().toISOString(),
        isLive: false,
        isStale: false,
        source: "Baseline"
      };
    }

    try {
      const storedRates = localStorage.getItem(CACHE_KEY_RATES);
      const storedTimestamp = localStorage.getItem(CACHE_KEY_TIMESTAMP);
      const storedIso = localStorage.getItem(CACHE_KEY_ISO);
      const storedSource = localStorage.getItem(CACHE_KEY_SOURCE);

      if (storedRates && storedTimestamp) {
        const parsed = JSON.parse(storedRates);
        const iso = storedIso || new Date().toISOString();
        const age = Date.now() - new Date(iso).getTime();
        const isStale = age > CACHE_TTL_MS * 24; // >24h considered stale

        return {
          rates: { ...BASELINE_RATES, ...parsed },
          lastUpdated: storedTimestamp,
          timestampIso: iso,
          isLive: !isStale,
          isStale: isStale,
          source: storedSource || "Cache"
        };
      }
    } catch (e) {
      console.warn("Failed to load cached FX rates:", e);
    }

    return {
      rates: { ...BASELINE_RATES },
      lastUpdated: "Live Market Sync Pending",
      timestampIso: new Date().toISOString(),
      isLive: false,
      isStale: false,
      source: "Baseline"
    };
  }

  private saveRates(rates: ExchangeRates, source: string, customTimestamp?: string): void {
    // This cache contains public market rates, not company or billing records.
    // It must be usable while the public screens are open before sign-in.
    if (typeof window === "undefined") return;
    try {
      const now = new Date();
      const timeStr = customTimestamp || now.toUTCString();
      const iso = now.toISOString();

      localStorage.setItem(CACHE_KEY_RATES, JSON.stringify(rates));
      localStorage.setItem(CACHE_KEY_TIMESTAMP, timeStr);
      localStorage.setItem(CACHE_KEY_ISO, iso);
      localStorage.setItem(CACHE_KEY_SOURCE, source);
    } catch (e) {
      console.warn("Failed to save FX rates to cache:", e);
    }
  }

  /**
   * Fetches real-world live market rates from primary/secondary providers
   */
  public async fetchLiveRates(force: boolean = false): Promise<ExchangeRateState> {
    if (this.fetchPromise && !force) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      // 1. Check if cache is still fresh and force wasn't requested
      if (!force && this.isInitialized && this.currentState.isLive && !this.currentState.isStale) {
        const age = Date.now() - new Date(this.currentState.timestampIso).getTime();
        if (age < CACHE_TTL_MS) {
          return this.currentState;
        }
      }

      let fetchedRates: ExchangeRates | null = null;
      let timestampText = "";
      let providerName = "";

      // Provider 1: open.er-api.com (Reliable, free, multi-currency live market)
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD", {
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.result === "success" && data.rates) {
            fetchedRates = data.rates;
            timestampText = data.time_last_update_utc || new Date().toUTCString();
            providerName = "Open Exchange Rates API (Live Market)";
          }
        }
      } catch (err) {
        console.warn("Primary FX API failed, trying backup:", err);
      }

      // Provider 2: api.exchangerate-api.com (Backup)
      if (!fetchedRates) {
        try {
          const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
            signal: AbortSignal.timeout(8000)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.rates) {
              fetchedRates = data.rates;
              timestampText = data.date ? `${data.date} (Market Close)` : new Date().toUTCString();
              providerName = "ExchangeRate-API V4 (Live Market)";
            }
          }
        } catch (err) {
          console.warn("Backup FX API 1 failed, trying CDN:", err);
        }
      }

      // Provider 3: Fawaz Ahmed Open Currency CDN (High reliability)
      if (!fetchedRates) {
        try {
          const res = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json", {
            signal: AbortSignal.timeout(8000)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.usd) {
              const uppercaseRates: ExchangeRates = {};
              Object.entries(data.usd).forEach(([k, v]) => {
                uppercaseRates[k.toUpperCase()] = Number(v);
              });
              fetchedRates = uppercaseRates;
              timestampText = data.date ? `${data.date} (Daily Market)` : new Date().toUTCString();
              providerName = "Global Currency CDN (Live)";
            }
          }
        } catch (err) {
          console.warn("CDN FX API failed:", err);
        }
      }

      if (fetchedRates) {
        // Merge with existing baseline to ensure no supported currency is missing
        const combinedRates: ExchangeRates = {
          ...BASELINE_RATES,
          ...fetchedRates
        };

        this.saveRates(combinedRates, providerName, timestampText);
        
        this.currentState = {
          rates: combinedRates,
          lastUpdated: timestampText,
          timestampIso: new Date().toISOString(),
          isLive: true,
          isStale: false,
          source: providerName,
          error: null
        };
      } else {
        // Use cached or baseline if all network fetches failed
        const isStale = Date.now() - new Date(this.currentState.timestampIso).getTime() > CACHE_TTL_MS * 24;
        this.currentState = {
          ...this.currentState,
          isStale,
          error: "Live rate service unavailable. Using cached market rates."
        };
      }

      this.isInitialized = true;
      this.notifyListeners();
      return this.currentState;
    })();

    try {
      const result = await this.fetchPromise;
      return result;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Returns the current exchange rate from source currency to target currency.
   * Rates are USD-pivot based.
   * Example: getExchangeRate("USD", "TZS") => 2641.87
   * Example: getExchangeRate("TZS", "USD") => 0.0003785
   * Example: getExchangeRate("TZS", "ZAR") => 16.12 / 2641.87 = 0.006101
   */
  public getExchangeRate(fromCurrency: string = "USD", toCurrency: string = "USD"): number {
    const fromCode = (fromCurrency || "USD").toUpperCase();
    const toCode = (toCurrency || "USD").toUpperCase();

    if (fromCode === toCode) return 1.0;

    const fromRateToUSD = this.currentState.rates[fromCode] || BASELINE_RATES[fromCode] || 1.0;
    const toRateToUSD = this.currentState.rates[toCode] || BASELINE_RATES[toCode] || 1.0;

    if (fromRateToUSD <= 0) return 1.0;

    // 1 unit of fromCurrency = (1 / fromRateToUSD) USD
    // (1 / fromRateToUSD) USD * toRateToUSD = units of toCurrency
    return toRateToUSD / fromRateToUSD;
  }

  /**
   * Converts a monetary amount from a base currency to a target currency.
   * Example: convertAmount(2641870, "TZS", "USD") => 1000.00
   */
  public convertAmount(
    amount: number | null | undefined,
    fromCurrency: string = "USD",
    toCurrency: string = "USD"
  ): number | null {
    if (amount === null || amount === undefined || isNaN(Number(amount))) {
      return null;
    }
    const num = Number(amount);
    const fromCode = (fromCurrency || "USD").toUpperCase();
    const toCode = (toCurrency || "USD").toUpperCase();

    if (fromCode === toCode) return num;

    const rate = this.getExchangeRate(fromCode, toCode);
    return num * rate;
  }

  public getState(): ExchangeRateState {
    return this.currentState;
  }

  public subscribe(listener: (state: ExchangeRateState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error("Error in FX rate listener:", err);
      }
    });
  }
}

export const exchangeRateService = new ExchangeRateService();
