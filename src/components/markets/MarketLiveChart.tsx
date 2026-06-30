"use client";

import { useEffect, useRef } from "react";
import type { MarketChartConfig } from "./market-charts";

const SCRIPT_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";

interface MarketLiveChartProps {
  config: MarketChartConfig;
  dateRange?: "1D" | "5D" | "1M" | "3M" | "12M" | "60M" | "ALL";
}

export function MarketLiveChart({ config, dateRange = "1M" }: MarketLiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: config.symbol,
      width: "100%",
      height: "100%",
      locale: "en",
      dateRange,
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: "",
      chartOnly: false,
      noTimeScale: false,
      trendLineColor: config.accentColor,
      underLineColor: config.underLineColor,
      underLineBottomColor: "rgba(0, 0, 0, 0)",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [config, dateRange]);

  return (
    <div className="glass-panel rounded-2xl ring-1 ring-white/10 overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 border-b border-white/10 shrink-0">
        <p className="text-sm font-semibold text-ink">{config.label}</p>
        <p className="text-[11px] text-ink-muted">
          {config.sublabel ?? config.symbol.replace(/^[^:]+:/, "")} · live chart
        </p>
      </div>
      <div ref={containerRef} className="tradingview-widget-container h-[220px] w-full min-h-[220px]" />
    </div>
  );
}
