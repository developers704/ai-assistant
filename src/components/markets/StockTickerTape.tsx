"use client";

import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";

const TICKER_SYMBOLS = [
  { proName: "AMEX:SPY", title: "S&P 500" },
  { proName: "NASDAQ:QQQ", title: "Nasdaq" },
  { proName: "AMEX:DIA", title: "Dow" },
  { proName: "NYSE:SIG", title: "Signet" },
  { proName: "NASDAQ:AAPL", title: "Apple" },
  { proName: "NASDAQ:MSFT", title: "Microsoft" },
  { proName: "NASDAQ:NVDA", title: "NVIDIA" },
  { proName: "NASDAQ:GOOGL", title: "Alphabet" },
  { proName: "NASDAQ:AMZN", title: "Amazon" },
  { proName: "NYSE:WMT", title: "Walmart" },
];

export function StockTickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: TICKER_SYMBOLS,
      showSymbolLogo: true,
      colorTheme: "dark",
      isTransparent: true,
      displayMode: "adaptive",
      locale: "en",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className="glass-panel rounded-2xl ring-1 ring-white/10 overflow-hidden">
      <div ref={containerRef} className="tradingview-widget-container h-[46px] w-full" />
    </div>
  );
}
