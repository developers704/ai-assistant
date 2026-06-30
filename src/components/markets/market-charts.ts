export interface MarketChartConfig {
  symbol: string;
  label: string;
  sublabel?: string;
  accentColor: string;
  underLineColor: string;
}

/** TradingView symbols for live stock market charts (free embed, no API key). */
export const STOCK_LIVE_CHARTS: MarketChartConfig[] = [
  {
    symbol: "AMEX:SPY",
    label: "S&P 500",
    sublabel: "SPY ETF",
    accentColor: "rgba(34, 197, 94, 1)",
    underLineColor: "rgba(34, 197, 94, 0.25)",
  },
  {
    symbol: "NASDAQ:QQQ",
    label: "Nasdaq 100",
    sublabel: "QQQ ETF",
    accentColor: "rgba(56, 189, 248, 1)",
    underLineColor: "rgba(56, 189, 248, 0.25)",
  },
  {
    symbol: "AMEX:DIA",
    label: "Dow Jones",
    sublabel: "DIA ETF",
    accentColor: "rgba(167, 139, 250, 1)",
    underLineColor: "rgba(167, 139, 250, 0.25)",
  },
  {
    symbol: "NYSE:SIG",
    label: "Signet Jewelers",
    sublabel: "SIG · jewelry retail",
    accentColor: "rgba(251, 191, 36, 1)",
    underLineColor: "rgba(251, 191, 36, 0.25)",
  },
  {
    symbol: "NASDAQ:AAPL",
    label: "Apple",
    sublabel: "AAPL",
    accentColor: "rgba(148, 163, 184, 1)",
    underLineColor: "rgba(148, 163, 184, 0.25)",
  },
  {
    symbol: "NASDAQ:NVDA",
    label: "NVIDIA",
    sublabel: "NVDA",
    accentColor: "rgba(74, 222, 128, 1)",
    underLineColor: "rgba(74, 222, 128, 0.25)",
  },
];
