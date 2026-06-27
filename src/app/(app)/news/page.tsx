"use client";



import { useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

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

  Trophy,

  Landmark,

} from "lucide-react";



type NewsTab = "industry" | "sports" | "politics";



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

  sportsNews?: NewsItem[];

  sportsLive?: boolean;

  sportsError?: string | null;

  politicsNews?: NewsItem[];

  politicsLive?: boolean;

  politicsError?: string | null;

}



const money = (n: number) =>

  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });



export default function NewsMarketsPage() {

  const searchParams = useSearchParams();

  const [data, setData] = useState<MarketData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [newsTab, setNewsTab] = useState<NewsTab>("industry");



  useEffect(() => {

    const tab = searchParams.get("tab");

    if (tab === "sports" || tab === "politics" || tab === "industry") {

      setNewsTab(tab);

    }

  }, [searchParams]);



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

            subtitle="Live metal prices, industry news, US & world politics, and sports headlines"

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

                  Headlines

                </h3>



                <div className="flex flex-wrap gap-2 mb-4">

                  {(
                    [

                      { id: "industry" as const, label: "Industry", icon: Newspaper },

                      { id: "politics" as const, label: "Politics", icon: Landmark },

                      { id: "sports" as const, label: "Sports", icon: Trophy },

                    ] as const

                  ).map(({ id, label, icon: Icon }) => (

                    <button

                      key={id}

                      type="button"

                      onClick={() => setNewsTab(id)}

                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ring-1 ${

                        newsTab === id

                          ? "bg-sky-500/25 text-sky-200 ring-sky-400/30"

                          : "bg-white/5 text-ink-muted ring-white/10 hover:bg-white/10 hover:text-ink"

                      }`}

                    >

                      <Icon size={14} />

                      {label}

                    </button>

                  ))}

                </div>



                {newsTab === "industry" && (

                  <>

                    <div className="flex items-center gap-2 mb-3">

                      <p className="text-xs text-ink-muted">

                        Jewellery, metals, diamonds & luxury watches

                      </p>

                      {data.newsLive && <Badge variant="success">Live</Badge>}

                    </div>

                    <NewsHeadlineList items={data.news} />

                    <p className="text-xs text-ink-muted mt-2">

                      {data.newsLive

                        ? "Headlines from NewsAPI — Gold, Silver, Diamond, Lab-Grown, Rolex, Gucci, Movado, Rado, Bulova, G-Shock."

                        : data.newsError?.includes("not configured")

                          ? "Showing curated industry headlines. Add NEWS_API_KEY in .env.local for live news."

                          : data.newsError

                            ? `Showing curated headlines — live news unavailable (${data.newsError}).`

                            : "Showing curated industry headlines."}

                    </p>

                  </>

                )}



                {newsTab === "politics" && (

                  <>

                    <div className="flex items-center gap-2 mb-3">

                      <p className="text-xs text-ink-muted">

                        US-heavy politics plus world news — NPR, AP, BBC

                      </p>

                      {data.politicsLive && <Badge variant="success">Live</Badge>}

                    </div>

                    <NewsHeadlineList items={data.politicsNews ?? []} />

                    <p className="text-xs text-ink-muted mt-2">

                      {data.politicsLive

                        ? "RSS feeds — no API key required. US Politics from NPR & AP; World from BBC."

                        : data.politicsError

                          ? `Showing briefing headlines — live RSS unavailable (${data.politicsError}).`

                          : "Showing curated politics briefing."}

                    </p>

                  </>

                )}



                {newsTab === "sports" && (

                  <>

                    <div className="flex items-center gap-2 mb-3">

                      <p className="text-xs text-ink-muted">

                        ESPN, BBC Sport & AP Sports

                      </p>

                      {data.sportsLive && <Badge variant="success">Live</Badge>}

                    </div>

                    <NewsHeadlineList items={data.sportsNews ?? []} />

                    <p className="text-xs text-ink-muted mt-2">

                      {data.sportsLive

                        ? "RSS feeds — NFL, NBA, MLB, soccer, and international sports."

                        : data.sportsError

                          ? `Showing briefing headlines — live RSS unavailable (${data.sportsError}).`

                          : "Showing curated sports briefing."}

                    </p>

                  </>

                )}

              </div>



              <p className="text-xs text-ink-muted pt-1 border-t border-white/10">

                Last updated {new Date(data.updatedAt).toLocaleTimeString("en-US")} ·{" "}

                {data.metalsLive ? "Live spot prices" : "Indicative metal prices"} ·{" "}

                {data.newsLive || data.sportsLive || data.politicsLive ? "Live headlines" : "Curated headlines"}

              </p>

            </>

          ) : null}

        </div>

      </div>

    </div>

  );

}



function NewsHeadlineList({ items }: { items: NewsItem[] }) {

  if (!items.length) {

    return (

      <p className="text-sm text-ink-muted glass-panel rounded-2xl p-4 ring-1 ring-white/10">

        No headlines available right now. Try Refresh.

      </p>

    );

  }



  return (

    <div className="space-y-2">

      {items.map((n, i) => (

        <div

          key={`${n.category}-${n.title}-${i}`}

          className="glass-panel rounded-2xl p-4 flex items-start gap-3 ring-1 ring-white/10"

        >

          <Badge variant={n.category === "World" ? "warning" : "info"}>{n.category}</Badge>

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

  );

}


