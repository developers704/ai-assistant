"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellHeader, PageShellBody } from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@/lib/inventory/types";
import { Loader2, Search, Tag } from "lucide-react";
import { ProductThumb, ProductLightbox } from "@/components/reports/ProductImagePreview";

const money = (n: number) =>
  isFinite(n)
    ? n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      })
    : "$0.00";

type LookupResponse = {
  item: InventoryItem;
  wholeCost?: number;
  stores?: { name: string; onhand: number }[];
  onHandTotal?: number;
  queriedSku?: string;
  resolvedSku?: string;
  imageUrl?: string | null;
  hideVendor?: boolean;
  status: { loaded: boolean; rowCount: number };
};

export default function SkuLookupPage() {
  const [sku, setSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [inventoryLoaded, setInventoryLoaded] = useState<boolean | null>(null);
  const [inventoryRows, setInventoryRows] = useState(0);
  const [preview, setPreview] = useState<{ src: string; alt: string; subtitle?: string } | null>(
    null
  );

  const checkInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" });
      const json = await res.json();
      if (json.status) {
        setInventoryLoaded(json.status.loaded);
        setInventoryRows(json.status.rowCount ?? 0);
      }
    } catch {
      setInventoryLoaded(false);
    }
  }, []);

  useEffect(() => {
    void checkInventory();
  }, [checkInventory]);

  const lookupSku = async () => {
    const trimmed = sku.trim();
    if (!trimmed) {
      setError("Enter a SKU number");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/inventory?sku=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "SKU not found");
        if (json.status) {
          setInventoryLoaded(json.status.loaded);
          setInventoryRows(json.status.rowCount ?? 0);
        }
        return;
      }
      setResult(json);
      if (json.status) {
        setInventoryLoaded(json.status.loaded);
        setInventoryRows(json.status.rowCount ?? 0);
      }
    } catch {
      setError("Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const cost = result?.wholeCost ?? result?.item.costPrice ?? 0;

  return (
    <PageShell accent="amber">
      <PageShellHeader>
        <PageHeader
          gradient
          eyebrow="Inventory"
          title="SKU Lookup"
          subtitle="Product details and wholesale cost — no customer offer or discounting"
          action={
            inventoryLoaded === true ? (
              <Badge variant="success">{inventoryRows.toLocaleString()} SKUs loaded</Badge>
            ) : inventoryLoaded === false ? (
              <Badge variant="warning">No inventory file</Badge>
            ) : null
          }
        />
      </PageShellHeader>
      <PageShellBody>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20">
                <Tag size={16} className="text-amber-300" />
              </span>
              Look up a SKU
            </CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <Input
              id="sku-lookup"
              label="SKU Number"
              placeholder="Item # or SKU (231611 or 231611Y)"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void lookupSku()}
            />
            <div className="flex items-end">
              <Button className="w-full md:w-auto" onClick={() => void lookupSku()} disabled={loading || !sku.trim()}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Look Up SKU
              </Button>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-accent-rose">{error}</p>}
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Product info</CardTitle>
            </CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <ProductThumb
                imageDir={result.item.imageDir}
                imageUrl={result.imageUrl}
                alt={result.item.description || result.item.sku}
                subtitle={result.item.vendorModel || result.item.sku}
                onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
              />
              <p className="text-sm text-ink-secondary leading-relaxed flex-1">
                {result.item.description || "—"}
              </p>
            </div>
            {result.queriedSku &&
              result.queriedSku.trim().toUpperCase() !==
                (result.resolvedSku || result.item.sku).trim().toUpperCase() && (
                <p className="text-xs text-amber-200/90 mb-4">
                  Inventory stores this item as{" "}
                  <span className="font-medium text-ink">{result.resolvedSku || result.item.sku}</span>{" "}
                  (matched from {result.queriedSku}).
                </p>
              )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <Detail label="Item #" value={result.item.sku} />
              <Detail label="Vendor model #" value={result.item.vendorModel || "—"} />
              {!result.hideVendor && <Detail label="Vendor" value={result.item.vendor || "—"} />}
              <Detail label="Department" value={result.item.department || "—"} />
              <Detail label="Design" value={result.item.design || "—"} />
              <Detail label="Class" value={result.item.class || "—"} />
              <Detail label="Sub-Class" value={result.item.subClass || "—"} />
              <Detail label="Tag Price" value={money(result.item.tagPrice)} highlight />
              <Detail label="Wholesale cost" value={money(cost)} highlight />
              <Detail
                label="Avg Weight (g)"
                value={Number.isFinite(result.item.avgWeight) ? String(result.item.avgWeight) : "—"}
              />
              <Detail label="Create Date" value={result.item.createDate || "—"} />
              <Detail label="On hand (all stores)" value={String(result.onHandTotal ?? 0)} />
            </div>
            {result.stores && result.stores.length > 0 && (
              <div className="mt-5">
                <p className="text-xs text-ink-muted mb-2">On hand by store</p>
                <div className="flex flex-wrap gap-2">
                  {result.stores.map((s) => (
                    <span
                      key={s.name}
                      className="text-xs rounded-full bg-white/5 ring-1 ring-white/10 px-2.5 py-1 text-ink-secondary"
                    >
                      {s.name}: {s.onhand}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </PageShellBody>
      {preview && (
        <ProductLightbox
          src={preview.src}
          alt={preview.alt}
          subtitle={preview.subtitle}
          onClose={() => setPreview(null)}
        />
      )}
    </PageShell>
  );
}

function Detail({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={cn("font-medium text-ink", highlight && "text-amber-300 font-semibold tabular-nums")}>
        {value}
      </p>
    </div>
  );
}
