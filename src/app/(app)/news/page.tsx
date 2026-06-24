"use client";



import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/Sidebar";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

import { Badge } from "@/components/ui/Badge";

import { Button } from "@/components/ui/Button";

import { MarketLiveChart } from "@/components/markets/MarketLiveChart";

import { METAL_LIVE_CHARTS } from "@/components/markets/market-charts";

import {

  Coins,

  Gem,

  Newspaper,

  RefreshCw,

  Loader2,

  AlertTriangle,

  TrendingUp,

  LineChart,

} from "lucide-react";



interface MetalPrice {

  symbol: string;

  name: string;

  pricePerOunce: number;

  pricePerGram: number;

  live: boolean;

  derived?: { label: string; pricePerGram: number }[];

}

interface Gem {

  name: string;

  detail: string;

  pricePerCarat: number;

  live: boolean;

}

interface NewsItem {

  category: string;

  title: string;

  source: string;

  time: string;

  url?: string;

  live?: boolean;

}

interface MarketData {

  updatedAt: string;

  metalsLive: boolean;

  newsLive?: boolean;

  newsError?: string | null;

  metals: MetalPrice[];

  gems: Gem[];

  news: NewsItem[];

}



const money = (n: number) =>

  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });



export default function NewsMarketsPage() {

  const [data, setData] = useState<MarketData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  const load = async (forceRefresh = false) => {

    setLoading(true);

    setError(null);

    try {

      const url = forceRefresh ? "/api/markets?refresh=1" : "/api/markets";
      const res = await fetch(url, { cache: "no-store" });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to load market data");

      setData(json);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Something went wrong.");

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    load();

  }, []);



  return (

    <div className="flex flex-col min-h-0">

      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">

        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">

          <PageHeader

            title="News & Markets"

            subtitle="Live metal prices, charts, and industry news for gold, diamonds, silver and luxury watches"

            action={

              <Button size="sm" variant="outline" onClick={() => load(true)} disabled={loading}>

                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}

                Refresh

              </Button>

            }

          />

        </div>



        <div className="px-5 sm:px-6 py-5 space-y-6">

          {error && (

            <div className="rounded-xl bg-red-500/10 border border-red-400/25 px-4 py-3 ring-1 ring-red-400/15">

              <p className="text-sm text-accent-rose flex items-center gap-1.5">

                <AlertTriangle size={14} /> {error}

              </p>

            </div>

          )}



          {loading && !data ? (

            <div className="h-48 flex items-center justify-center glass-panel rounded-2xl ring-1 ring-white/10">

              <Loader2 size={28} className="text-sky-300 animate-spin" />

            </div>

          ) : data ? (

            <>

              {/* Spot prices */}

              <div>

                <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">

                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-400/20">

                    <Coins size={14} className="text-sky-300" />

                  </span>

                  Precious Metals (spot, USD)

                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                  {data.metals.map((m) => (

                    <Card key={m.symbol}>

                      <CardHeader>

                        <CardTitle className="flex items-center gap-2 text-sm">

                          <TrendingUp size={16} className="text-sky-300" /> {m.name}

                        </CardTitle>

                        <Badge variant={m.live ? "success" : "warning"}>

                          {m.live ? "Live" : "Indicative"}

                        </Badge>

                      </CardHeader>

                      <p className="text-2xl font-bold text-ink">

                        {money(m.pricePerGram)}

                        <span className="text-sm font-normal text-ink-muted">/g</span>

                      </p>

                      <p className="text-sm text-ink-muted mt-1">{money(m.pricePerOunce)} / troy oz</p>

                      {m.derived && (

                        <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-x-4 gap-y-1.5">

                          {m.derived.map((d) => (

                            <div key={d.label} className="flex justify-between text-sm">

                              <span className="text-ink-secondary">{d.label}</span>

                              <span className="font-medium text-ink">{money(d.pricePerGram)}/g</span>

                            </div>

                          ))}

                        </div>

                      )}

                    </Card>

                  ))}

                </div>

              </div>



              {/* Live charts — sits between spot cards and diamonds */}

              <div>

                <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">

                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-400/20">

                    <LineChart size={14} className="text-sky-300" />

                  </span>

                  Live Charts

                  <Badge variant="success" className="ml-1">

                    Real-time

                  </Badge>

                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                  {METAL_LIVE_CHARTS.map((chart) => (

                    <MarketLiveChart key={chart.symbol} config={chart} dateRange="1M" />

                  ))}

                </div>

                <p className="text-xs text-ink-muted mt-2">

                  Streaming charts via TradingView — gold, silver, and platinum spot. Tap a chart to open the full

                  view on TradingView.

                </p>

              </div>



              {/* Diamonds */}

              <div>

                <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">

                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-400/20">

                    <Gem size={14} className="text-sky-300" />

                  </span>

                  Diamonds (per carat, indicative reference)

                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {data.gems.map((g) => (

                    <Card key={g.name}>

                      <CardHeader>

                        <CardTitle className="text-sm">{g.name}</CardTitle>

                        <Badge variant="warning">Indicative</Badge>

                      </CardHeader>

                      <p className="text-2xl font-bold text-ink">

                        {money(g.pricePerCarat)}

                        <span className="text-sm font-normal text-ink-muted">/ct</span>

                      </p>

                      <p className="text-sm text-ink-muted mt-1">{g.detail}</p>

                    </Card>

                  ))}

                </div>

                <p className="text-xs text-ink-muted mt-2">

                  No public live diamond index exists — values above are indicative reference points for retail

                  pricing, not exchange charts.

                </p>

              </div>



              {/* News */}

              <div>

                <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">

                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-400/20">

                    <Newspaper size={14} className="text-sky-300" />

                  </span>

                  Industry News — metals, diamonds & luxury watches

                  {data.newsLive && <Badge variant="success" className="ml-1">Live</Badge>}

                </h3>

                <div className="space-y-2">

                  {data.news.map((n, i) => (

                    <div

                      key={`${n.category}-${i}`}

                      className="glass-panel rounded-2xl p-4 flex items-start gap-3 ring-1 ring-white/10"

                    >

                      <Badge variant="info">{n.category}</Badge>

                      <div className="flex-1 min-w-0">

                        {n.url ? (

                          <a

                            href={n.url}

                            target="_blank"

                            rel="noopener noreferrer"

                            className="text-sm font-medium text-ink hover:text-sky-300 transition-colors"

                          >

                            {n.title}

                          </a>

                        ) : (

                          <p className="text-sm font-medium text-ink">{n.title}</p>

                        )}

                        <p className="text-xs text-ink-muted mt-0.5">

                          {n.source} · {n.time}

                        </p>

                      </div>

                    </div>

                  ))}

                </div>

                <p className="text-xs text-ink-muted mt-2">

                  {data.newsLive

                    ? "Headlines from NewsAPI — Gold, Silver, Diamond, Lab-Grown, Rolex, Gucci, Movado, Rado, Bulova, G-Shock."

                    : data.newsError?.includes("not configured")

                      ? "Showing curated industry headlines. Add NEWS_API_KEY in .env.local for live news."

                      : data.newsError

                        ? `Showing curated headlines — live news unavailable (${data.newsError}).`

                        : "Showing curated industry headlines."}

                </p>

              </div>



              <p className="text-xs text-ink-muted pt-1 border-t border-white/10">

                Last updated {new Date(data.updatedAt).toLocaleTimeString("en-US")} ·{" "}

                {data.metalsLive ? "Live spot prices" : "Indicative metal prices"} ·{" "}

                {data.newsLive ? "Live news" : "Curated headlines"}

              </p>

            </>

          ) : null}

        </div>

      </div>

    </div>

  );

}


