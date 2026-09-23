import { SupportedCurrency, getCurrencyInfo, currencyLocales, currencySymbols } from "../config/currencies";
import { exchangeRateService, ExchangeRateService } from "../services/exchangeRateService";

export { exchangeRateService, ExchangeRateService };

/**
 * Converts a numeric value between supported currencies using live financial market exchange rates.
 * Stored transaction and contract values are never altered.
 */
export function convertCurrency(
  value: number | string | null | undefined,
  fromCurrency: SupportedCurrency | string = "USD",
  toCurrency: SupportedCurrency | string = "USD"
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return null;
  return exchangeRateService.convertAmount(num, fromCurrency, toCurrency);
}

/**
 * Returns current exchange rate between two currencies.
 */
export function getExchangeRate(fromCurrency: string = "USD", toCurrency: string = "USD"): number {
  return exchangeRateService.getExchangeRate(fromCurrency, toCurrency);
}

/**
 * Centrally formats numeric values into the selected regional currency.
 * If fromCurrency is provided and differs from currencyCode, performs live FX conversion first.
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currencyCode: SupportedCurrency | string,
  options?: Intl.NumberFormatOptions,
  fromCurrency?: SupportedCurrency | string
): string {
  if (value === null || value === undefined || value === "") return "";
  const rawNum = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(rawNum)) return "";

  // Perform live FX conversion if source currency is specified and differs
  let numValue = rawNum;
  if (fromCurrency && fromCurrency !== currencyCode) {
    const converted = convertCurrency(rawNum, fromCurrency, currencyCode);
    if (converted !== null) {
      numValue = converted;
    }
  }

  const info = getCurrencyInfo(currencyCode);
  const locale = currencyLocales[currencyCode as SupportedCurrency] || info.locale || "en-US";
  const decimals = info.decimalDigits !== undefined ? info.decimalDigits : 2;

  const defaultOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...options
  };

  try {
    let formatted = new Intl.NumberFormat(locale, defaultOptions).format(numValue);
    
    // Ensure consistent symbol spacing for African and custom symbol representations
    const symbol = currencySymbols[currencyCode as SupportedCurrency] || info.symbol;
    if (currencyCode === "ZAR") {
      if (!formatted.startsWith("R")) {
        formatted = `R ${formatted.replace(/[^0-9.,\s]/g, "").trim()}`;
      }
    }
    
    return formatted;
  } catch (err) {
    const symbol = currencySymbols[currencyCode as SupportedCurrency] || info.symbol || currencyCode;
    return `${symbol} ${numValue.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}`;
  }
}

/**
 * Compact currency formatter for high-level numbers on charts and KPI summary cards (e.g. $54.13M, TZS 1.459B, ZAR 10.2M, EUR 495.8K).
 * If fromCurrency is provided, performs live FX conversion into target currencyCode.
 */
export function formatCompactCurrency(
  value: number | string | null | undefined,
  currencyCode: SupportedCurrency | string,
  fromCurrency?: SupportedCurrency | string
): string {
  if (value === null || value === undefined || value === "") return "—";
  const rawNum = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(rawNum)) return "—";

  // Perform live FX conversion if source currency differs
  let numValue = rawNum;
  if (fromCurrency && fromCurrency !== currencyCode) {
    const converted = convertCurrency(rawNum, fromCurrency, currencyCode);
    if (converted !== null) {
      numValue = converted;
    }
  }

  const info = getCurrencyInfo(currencyCode as SupportedCurrency);
  const symbol = currencySymbols[currencyCode as SupportedCurrency] || info.symbol || currencyCode;
  const decimals = info.decimalDigits !== undefined ? info.decimalDigits : 2;
  const sign = numValue < 0 ? "-" : "";
  const absVal = Math.abs(numValue);

  let formattedNum = "";
  if (absVal >= 1_000_000_000_000) {
    const scaled = absVal / 1_000_000_000_000;
    formattedNum = `${parseFloat(scaled.toFixed(3))}T`;
  } else if (absVal >= 1_000_000_000) {
    const scaled = absVal / 1_000_000_000;
    formattedNum = `${parseFloat(scaled.toFixed(3))}B`;
  } else if (absVal >= 1_000_000) {
    const scaled = absVal / 1_000_000;
    formattedNum = `${parseFloat(scaled.toFixed(2))}M`;
  } else if (absVal >= 1_000) {
    const scaled = absVal / 1_000;
    formattedNum = `${parseFloat(scaled.toFixed(1))}K`;
  } else {
    formattedNum = absVal.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals > 0 ? Math.min(decimals, 2) : 0
    });
  }

  // Consistent rendering: e.g. "USD 575.4K", "TZS 1.459B", "ZAR 10.2M", "EUR 495.8K"
  const needsSpace = symbol.length > 1 || symbol === "R";
  return `${sign}${symbol}${needsSpace ? " " : ""}${formattedNum}`;
}

/**
 * Full amount formatting with hover tooltip support
 */
export function getCurrencyHoverTitle(
  value: number | string | null | undefined,
  fromCurrency: SupportedCurrency | string,
  toCurrency: SupportedCurrency | string
): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const rawNum = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(rawNum)) return undefined;

  const converted = convertCurrency(rawNum, fromCurrency, toCurrency) ?? rawNum;
  const formattedConverted = formatCurrency(converted, toCurrency);
  const formattedOriginal = formatCurrency(rawNum, fromCurrency);

  if (fromCurrency === toCurrency) {
    return `Full Amount: ${formattedConverted}`;
  }
  return `Converted: ${formattedConverted} (Original: ${formattedOriginal})`;
}


