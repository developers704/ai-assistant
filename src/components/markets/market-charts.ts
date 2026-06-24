export interface MetalChartConfig {
  symbol: string;
  label: string;
  accentColor: string;
  underLineColor: string;
}

/** TradingView symbols for live spot charts (free embed, no API key). */
export const METAL_LIVE_CHARTS: MetalChartConfig[] = [
  {
    symbol: "OANDA:XAUUSD",
    label: "Gold",
    accentColor: "rgba(251, 191, 36, 1)",
    underLineColor: "rgba(251, 191, 36, 0.25)",
  },
  {
    symbol: "OANDA:XAGUSD",
    label: "Silver",
    accentColor: "rgba(203, 213, 225, 1)",
    underLineColor: "rgba(203, 213, 225, 0.25)",
  },
  {
    symbol: "OANDA:XPTUSD",
    label: "Platinum",
    accentColor: "rgba(56, 189, 248, 1)",
    underLineColor: "rgba(56, 189, 248, 0.25)",
  },
];
