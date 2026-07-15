"use client";

import { useEffect, useState } from "react";
import { Search, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProductThumb, ProductLightbox } from "@/components/reports/ProductImagePreview";
import { formatCurrency, cn } from "@/lib/utils";
import type { SalesDateRangeValue } from "@/components/sales/SalesDateRangePicker";

type SkuLookupResult = {
  sku: string;
  itemNumber: string;
  vendorModel: string | null;
  description: string | null;
  design: string | null;
  department: string | null;
  vendor: string | null;
  productClass: string | null;
  units: number;
  netRevenue: number;
  grossSales: number;
  inventoryCost: number;
  discountAmount: number;
  profit: number;
  marginRate: number;
  avgSale: number;
  transactions: number;
  lineCount: number;
  imageDir: string | null;
  imageUrl: string | null;
  stores: { store: string; units: number; revenue: number; cost: number }[];
  dates: string[];
};

function appendDateParams(params: URLSearchParams, range: SalesDateRangeValue | null) {
  if (!range) return;
  if (range.from === range.to) params.set("date", range.from);
  else {
    params.set("from", range.from);
    params.set("to", range.to);
  }
}

export function SalesSkuLookup({ dateRange }: { dateRange: SalesDateRangeValue | null }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SkuLookupResult | null>(null);
  const [lightbox, setLightbox] = useState<{
    src: string;
    alt: string;
    subtitle?: string;
  } | null>(null);

  const runLookup = async (skuOverride?: string) => {
    const sku = (skuOverride ?? query).trim();
    if (!sku) {
      setError("Enter a SKU, item #, or vendor model");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sku });
      appendDateParams(params, dateRange);
      const res = await fetch(`/api/sales/sku-lookup?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(json.error ?? "Not found");
        return;
      }
      setResult(json as SkuLookupResult);
    } catch {
      setResult(null);
      setError("Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!result) return;
    void runLookup(result.sku);
    // Re-run when date range changes for the same SKU
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.from, dateRange?.to]);

  const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-sm text-ink truncate mt-0.5">{value ?? "—"}</p>
    </div>
  );

  return (
    <div className="rounded-2xl ring-1 ring-slate-700 bg-slate-950 text-ink overflow-visible">
      <div className="px-4 pt-4 pb-3 border-b border-slate-700">
        <h3 className="text-base font-semibold text-ink flex items-center gap-2">
          <Package size={17} className="text-cyan-300" />
          SKU Lookup
        </h3>
        <p className="text-xs text-ink-muted mt-1">
          Pull item sales detail from the current report
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1 min-w-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runLookup()}
              placeholder="SKU, item #, or vendor model…"
              className="h-10 w-full pl-9 pr-3 rounded-lg text-sm border border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
              aria-label="SKU lookup"
            />
          </div>
          <Button
            size="sm"
            className="h-10 px-4 shrink-0"
            onClick={() => void runLookup()}
            disabled={loading}
          >
            {loading ? "Searching…" : "Look up"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-rose-300/90 bg-rose-500/10 border border-rose-400/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <ProductThumb
                imageDir={result.imageDir ?? undefined}
                imageUrl={result.imageUrl}
                alt={result.description || result.sku}
                subtitle={result.sku}
                size="md"
                className="!h-16 !w-16 rounded-xl"
                onOpen={(src, alt, subtitle) => setLightbox({ src, alt, subtitle })}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink leading-snug line-clamp-2">
                  {result.description || "No description"}
                </p>
                <p className="text-xs font-mono text-cyan-300/90 mt-1">{result.sku}</p>
                {result.vendorModel && result.vendorModel !== result.sku && (
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    Model {result.vendorModel}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Fact label="Item #" value={result.itemNumber} />
              <Fact label="Vendor model" value={result.vendorModel} />
              <Fact label="Design" value={result.design} />
              <Fact label="Department" value={result.department} />
              <Fact label="Vendor" value={result.vendor} />
              <Fact label="Class" value={result.productClass} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Revenue", value: formatCurrency(result.netRevenue) },
                { label: "Cost", value: formatCurrency(result.inventoryCost) },
                {
                  label: "Margin",
                  value: `${(result.marginRate * 100).toFixed(1)}%`,
                },
                { label: "Units", value: String(result.units) },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                >
                  <p className="text-[10px] text-ink-muted uppercase tracking-wide">
                    {m.label}
                  </p>
                  <p className="text-base font-metric-num text-ink mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-ink-muted mb-2">
                Stores that sold this item
              </p>
              {result.stores.length === 0 ? (
                <p className="text-sm text-ink-muted">No store sales in range</p>
              ) : (
                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                  {result.stores.map((s) => (
                    <li
                      key={s.store}
                      className="flex items-center justify-between gap-2 text-sm rounded-lg px-2.5 py-1.5 bg-white/[0.03] border border-white/8"
                    >
                      <span className="truncate text-ink">{s.store}</span>
                      <span className={cn("shrink-0 font-metric-num text-ink-secondary")}>
                        {formatCurrency(s.revenue)}
                        <span className="text-ink-muted text-xs ml-1.5">
                          · {s.units}pc
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <ProductLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          subtitle={lightbox.subtitle}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
