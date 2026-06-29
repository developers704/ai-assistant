"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatPieceCount, sortTopProducts } from "@/lib/utils";
import type { SalesSummary, StoreLocation, Product, CustomerReview } from "@/types";
import type { ReportSummary } from "@/lib/reports/types";
import { ReportInsightsCards } from "@/components/reports/ReportInsightsCards";
import { BarChart3, TrendingUp, TrendingDown, Store, Package, MapPin, Gem, Star } from "lucide-react";

interface BrandInfo {
  name: string;
  tagline: string;
}

interface StoreStats {
  total: number;
  open: number;
  openingSoon: number;
  byRegion: Record<string, number>;
}

export default function SalesPage() {
  const { sendChat } = useApp();
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [dataSource, setDataSource] = useState<"mock" | "report">("mock");
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [showAllStores, setShowAllStores] = useState(false);
  const [trending, setTrending] = useState<Product[]>([]);
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [pillars, setPillars] = useState<string[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);

  useEffect(() => {
    fetch("/api/sales")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setDataSource(d.source === "report" ? "report" : "mock");
        if (d.source === "report") setReportSummary(d.summary as ReportSummary);
      });
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => {
        setStores(d.stores);
        setStats(d.stats);
      });
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        setTrending(d.trending?.slice(0, 8) || []);
        setBrands(d.brands || []);
        setPillars(d.pillars || []);
        setReviews(d.reviews?.slice(0, 4) || []);
      });
  }, []);

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-ink-muted">Loading sales data...</div>
      </div>
    );
  }

  const regions = ["California", "Nevada", "Arizona", "Texas"] as const;
  const topProducts = sortTopProducts(summary.topProducts).slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Sales Reports"
        subtitle={
          dataSource === "report" && reportSummary?.reportLabel
            ? `${reportSummary.vendorCode ? reportSummary.vendorCode + " · " : ""}${reportSummary.reportLabel}`
            : `Daily performance · ${stats?.total ?? 29} Valliani Jewelers locations (${stats?.open ?? 27} open, ${stats?.openingSoon ?? 2} opening soon)`
        }
        action={
          <Button size="sm" onClick={() => sendChat("Show me today's sales across all stores")}>
            Ask Assistant
          </Button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {regions.map((region) => (
            <Card key={region} className="p-4 text-center">
              <p className="text-2xl font-bold text-ink">{stats.byRegion[region]}</p>
              <p className="text-xs text-ink-muted mt-1">{region}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <Card className="p-5">
          <p className="text-sm text-ink-secondary">Total Revenue</p>
          <p className="text-3xl font-bold text-ink mt-1">{formatCurrency(summary.totalRevenue)}</p>
          <div className="flex items-center gap-1 mt-2 text-sm">
            {summary.comparisonPreviousDay >= 0 ? (
              <TrendingUp size={14} className="text-emerald-600" />
            ) : (
              <TrendingDown size={14} className="text-accent-rose" />
            )}
            <span className={summary.comparisonPreviousDay >= 0 ? "text-emerald-600" : "text-accent-rose"}>
              {summary.comparisonPreviousDay >= 0 ? "+" : ""}{summary.comparisonPreviousDay.toFixed(1)}% vs yesterday
            </span>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-secondary">Pieces Sold</p>
          <p className="text-3xl font-bold text-ink mt-1">{summary.totalTransactions}</p>
          <p className="text-sm text-ink-muted mt-2">Across reporting stores today</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-secondary">Avg. Sale Value</p>
          <p className="text-3xl font-bold text-ink mt-1">{formatCurrency(summary.averageOrderValue)}</p>
          <p className="text-sm text-ink-muted mt-2">+{summary.comparisonPreviousWeek.toFixed(1)}% vs last week</p>
        </Card>
      </div>

      {reportSummary && dataSource === "report" && (
        <div className="mb-6">
          <ReportInsightsCards summary={reportSummary} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store size={18} className="text-brand-600" /> Store Performance
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {summary.topStores.map((store, i) => (
              <div key={store.name} className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink-muted w-6">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-ink">{store.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(store.revenue)}</span>
                  </div>
                  <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${(store.revenue / summary.topStores[0].revenue) * 100}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs ${store.change >= 0 ? "text-emerald-600" : "text-accent-rose"}`}>
                  {store.change >= 0 ? "+" : ""}{store.change.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package size={18} className="text-brand-600" /> Top Products
            </CardTitle>
            <span className="text-xs text-ink-muted">Highest revenue first</span>
          </CardHeader>
          <div className="space-y-2.5">
            {topProducts.map((product, i) => (
              <div
                key={`${product.itemNumber ?? ""}-${product.name}-${i}`}
                className="flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="text-sm font-medium text-ink-muted w-5 shrink-0 pt-0.5 tabular-nums">
                    {i + 1}
                  </span>
                  <p className="text-sm text-ink leading-snug min-w-0">
                    {product.itemNumber && (
                      <span className="font-mono text-cyan-300/90 text-xs">#{product.itemNumber} · </span>
                    )}
                    <span className="font-medium break-words">{product.name}</span>
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums whitespace-nowrap pt-0.5">
                  <span className="font-semibold text-ink">{formatCurrency(product.revenue)}</span>
                  <span className="text-ink-muted text-xs font-normal ml-1.5">
                    · {formatPieceCount(product.units)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {pillars.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-sm text-ink-secondary mr-2 self-center">Pillars we stand on:</span>
          {pillars.map((p) => (
            <Badge key={p} variant="info" className="text-sm px-3 py-1">{p}</Badge>
          ))}
        </div>
      )}

      {brands.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gem size={18} className="text-brand-600" /> House of Brands
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {brands.map((brand) => (
              <div key={brand.name} className="p-3 rounded-xl bg-surface-secondary">
                <p className="font-semibold text-ink text-sm">{brand.name}</p>
                <p className="text-xs text-ink-muted mt-0.5">{brand.tagline}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {trending.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Trending Products</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trending.map((product) => (
              <div key={product.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-brand-200/60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default">{product.brand}</Badge>
                    {product.isNew && <Badge variant="success">New</Badge>}
                  </div>
                  <p className="text-sm font-medium text-ink leading-snug">{product.name}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{product.category}{product.caratWeight ? ` · ${product.caratWeight}` : ""}</p>
                </div>
                <p className="text-sm font-bold text-ink flex-shrink-0">{formatCurrency(product.price)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-600" /> Recommendations
          </CardTitle>
        </CardHeader>
        <ul className="space-y-2">
          {summary.recommendations.map((rec, i) => (
            <li key={i} className="text-sm text-ink-secondary flex items-start gap-2">
              <span className="text-brand-600 font-medium">{i + 1}.</span> {rec}
            </li>
          ))}
        </ul>
      </Card>

      {reviews.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star size={18} className="text-accent-gold" /> Customer Reviews
              <span className="text-sm font-normal text-ink-muted ml-2">4.9/5 · 1,250 reviews</span>
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 rounded-xl bg-surface-secondary">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={12} className="text-accent-gold fill-accent-gold" />
                  ))}
                </div>
                <p className="text-sm font-medium text-ink">{review.title}</p>
                <p className="text-sm text-ink-secondary mt-1 line-clamp-2">{review.body}</p>
                <p className="text-xs text-ink-muted mt-2">— {review.author}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin size={18} className="text-brand-600" /> Store Locations
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAllStores(!showAllStores)}>
            {showAllStores ? "Show Less" : `View All ${stores.length} Stores`}
          </Button>
        </CardHeader>
        <div className="space-y-6">
          {regions.map((region) => {
            const regionStores = stores.filter((s) => s.region === region);
            const visible = showAllStores ? regionStores : regionStores.slice(0, 3);
            return (
              <div key={region}>
                <h4 className="text-sm font-semibold text-ink-secondary mb-2">{region} ({regionStores.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {visible.map((store) => (
                    <div key={store.id} className="flex items-start gap-2 p-3 rounded-xl bg-surface-secondary text-sm">
                      <MapPin size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-ink">{store.city}, {store.state}</p>
                        <p className="text-xs text-ink-muted">{store.mall}</p>
                        {store.status === "opening_soon" && (
                          <Badge variant="warning" className="mt-1">Opening Soon</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!showAllStores && regionStores.length > 3 && (
                  <p className="text-xs text-ink-muted mt-1">+{regionStores.length - 3} more in {region}</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
