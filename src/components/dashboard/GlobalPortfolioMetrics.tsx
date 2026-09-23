import React from "react";
import PortfolioKpiStrip, { PortfolioKpiStripProps } from "./PortfolioKpiStrip";
import { SupportedCurrency } from "../../config/currencies";

export interface GlobalPortfolioMetricsProps {
  selectedCurrency?: SupportedCurrency;
  onCurrencyChange?: (curr: SupportedCurrency) => void;
  onNavigateToHub?: (hubId: string) => void;
}

export default function GlobalPortfolioMetrics({
  selectedCurrency,
  onCurrencyChange,
  onNavigateToHub
}: GlobalPortfolioMetricsProps) {
  return (
    <PortfolioKpiStrip
      selectedCurrency={selectedCurrency}
      onCurrencyChange={onCurrencyChange}
    />
  );
}
