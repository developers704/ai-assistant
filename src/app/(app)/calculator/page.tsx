"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { PageShell, PageShellHeader, PageShellBody } from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  COMMISSION_MODE_LABELS,
  COMMISSION_RATES,
  FINANCING_PLAN_LABELS,
  calculateFinancedPrice,
  calculateGrandTotal,
  commissionDollars,
  type CommissionMode,
} from "@/lib/inventory/pricing";
import {
  type FinancingPlan,
  type InventoryItem,
  type ManagerTier,
  type PaymentMethod,
  type PricingResult,
} from "@/lib/inventory/types";
import {
  Calculator,
  Loader2,
  Search,
  Upload,
  Tag,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { ProductThumb, ProductLightbox } from "@/components/reports/ProductImagePreview";

const selectClass =
  "select-dark w-full px-4 py-2.5 rounded-2xl backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/40";

const money = (n: number) =>
  isFinite(n)
    ? n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      })
    : "$0.00";

interface LookupResponse {
  item: InventoryItem;
  pricing: PricingResult;
  stores?: { name: string; onhand: number }[];
  onHandTotal?: number;
  imageUrl?: string | null;
  hideVendor?: boolean;
  status: { loaded: boolean; rowCount: number };
}

export default function CalculatorPage() {
  const [sku, setSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [inventoryLoaded, setInventoryLoaded] = useState<boolean | null>(null);
  const [inventoryRows, setInventoryRows] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [selectedTier, setSelectedTier] = useState<ManagerTier>("m");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [financingPlan, setFinancingPlan] = useState<FinancingPlan>("6_months");
  const [commissionMode, setCommissionMode] = useState<CommissionMode>("regular");
  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
    subtitle?: string;
  } | null>(null);

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
    checkInventory();
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
      const res = await fetch(
        `/api/inventory?sku=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "SKU not found");
        if (json.status) {
          setInventoryLoaded(json.status.loaded);
          setInventoryRows(json.status.rowCount ?? 0);
        }
        return;
      }

      setResult(json as LookupResponse);
      setInventoryLoaded(true);
      setInventoryRows(json.status?.rowCount ?? 0);
    } catch {
      setError("Failed to look up SKU");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/inventory", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }
      setInventoryLoaded(true);
      setInventoryRows(json.rowCount ?? 0);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const selectedCashPrice = useMemo(() => {
    if (!result) return 0;
    const tier = result.pricing.tiers.find((t) => t.tier === selectedTier);
    return tier?.cashPrice ?? 0;
  }, [result, selectedTier]);

  const financing = useMemo(
    () => calculateFinancedPrice(selectedCashPrice, paymentMethod, financingPlan),
    [selectedCashPrice, paymentMethod, financingPlan]
  );

  const commissionPercent = COMMISSION_RATES[commissionMode];
  const commissionAmt = useMemo(
    () => commissionDollars(financing.financedPrice, commissionPercent),
    [financing.financedPrice, commissionPercent]
  );

  const grandTotal = useMemo(
    () => calculateGrandTotal(financing.financedPrice, commissionPercent),
    [financing.financedPrice, commissionPercent]
  );

  return (
    <PageShell accent="amber">
        <PageShellHeader>
          <PageHeader
            gradient
            eyebrow="Pricing"
            title="Price Calculator"
            subtitle="SKU lookup · manager tiers · financing · commission"
            action={
              <div className="flex items-center gap-2">
                {inventoryLoaded === true && (
                  <Badge variant="success">{inventoryRows.toLocaleString()} SKUs loaded</Badge>
                )}
                {inventoryLoaded === false && (
                  <Badge variant="warning">No inventory file</Badge>
                )}
                <label className="inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                  <span
                    className={cn(
                      "inline-flex items-center justify-center gap-2 font-medium transition-all duration-300",
                      "px-3 py-1.5 text-sm rounded-full border border-white/30 text-ink-secondary btn-glass",
                      "hover:border-white/45 hover:text-ink",
                      uploading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {uploading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    Upload CSV
                  </span>
                </label>
              </div>
            }
          />
        </PageShellHeader>

        <PageShellBody>
          {inventoryLoaded === false && (
            <Card className="p-4 ring-1 ring-amber-400/20">
              <p className="text-sm text-ink-secondary">
                Place your on-hand CSV at{" "}
                <code className="text-amber-300">.data/inventory/inventory.csv</code> on the
                server, or use <strong>Upload CSV</strong> above. Expected columns: Item #,
                Vendor Model #, Individual Selling Value (tag), Individual Cost Value, Whole
                Cost, Store, On-hand, Image Dir., AvgWeight, Create Date.
              </p>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20">
                  <Search size={16} className="text-sky-300" />
                </span>
                SKU Lookup
              </CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              <Input
                label="SKU Number"
                placeholder="Enter SKU #"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupSku()}
              />
              <div className="flex items-end">
                <Button
                  className="w-full md:w-auto"
                  onClick={lookupSku}
                  disabled={loading || !sku.trim()}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                  Look Up SKU
                </Button>
              </div>
            </div>
            {error && (
              <p className="mt-3 text-sm text-accent-rose">{error}</p>
            )}
          </Card>

          {result && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20">
                      <Tag size={16} className="text-violet-300" />
                    </span>
                    SKU Details
                  </CardTitle>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <Detail label="Item #" value={result.item.sku} />
                  <Detail
                    label="Vendor model #"
                    value={result.item.vendorModel || "—"}
                  />
                  {!result.hideVendor && (
                    <Detail label="Vendor" value={result.item.vendor || "—"} />
                  )}
                  <Detail label="Department" value={result.item.department || "—"} />
                  <Detail label="Design" value={result.item.design || "—"} />
                  <Detail label="Class" value={result.item.class || "—"} />
                  <Detail label="Sub-Class" value={result.item.subClass || "—"} />
                  <Detail label="Tag Price" value={money(result.item.tagPrice)} highlight />
                  <Detail label="Cost Price" value={money(result.item.costPrice)} />
                  <Detail
                    label="Avg Weight (g)"
                    value={
                      Number.isFinite(result.item.avgWeight)
                        ? String(result.item.avgWeight)
                        : "—"
                    }
                  />
                  <Detail
                    label="Create Date"
                    value={result.item.createDate || "—"}
                  />
                  <Detail
                    label="On hand (all stores)"
                    value={String(result.onHandTotal ?? 0)}
                  />
                  <Detail label="Category" value={result.pricing.categoryLabel} />
                </div>
                <p className="mt-3 text-xs text-ink-muted">{result.pricing.rulesSummary}</p>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20">
                      <DollarSign size={16} className="text-emerald-300" />
                    </span>
                    Cash Price (after discount on tag price)
                  </CardTitle>
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {result.pricing.tiers.map((tier) => (
                    <button
                      key={tier.tier}
                      type="button"
                      onClick={() => setSelectedTier(tier.tier)}
                      className={cn(
                        "p-4 rounded-2xl text-left ring-1 transition-all",
                        selectedTier === tier.tier
                          ? "bg-emerald-500/20 ring-emerald-400/40"
                          : "bg-white/5 ring-white/10 hover:bg-white/10"
                      )}
                    >
                      <p className="text-xs text-ink-muted">{tier.label}</p>
                      <p className="text-lg font-bold text-ink tabular-nums">
                        {money(tier.cashPrice)}
                      </p>
                      <p className="text-[11px] text-ink-muted mt-1">
                        {tier.discountPercent}% off tag
                      </p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ink-muted mt-3">
                  Tap a tier to use it for financing and final total below.
                </p>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20">
                        <CreditCard size={16} className="text-indigo-300" />
                      </span>
                      Payment Method
                    </CardTitle>
                  </CardHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                        Payment type
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(e.target.value as PaymentMethod)
                        }
                        className={selectClass}
                      >
                        <option value="cash">Cash</option>
                        <option value="credit_card">Credit Card — 3.5%</option>
                        <option value="financing">Financing</option>
                        <option value="lease">
                          Progressive / Acima / UOwn / Kefene — 5%
                        </option>
                        <option value="affirm">Affirm — 12%</option>
                      </select>
                    </div>

                    {paymentMethod === "financing" && (
                      <div>
                        <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                          Financing term
                        </label>
                        <select
                          value={financingPlan}
                          onChange={(e) =>
                            setFinancingPlan(e.target.value as FinancingPlan)
                          }
                          className={selectClass}
                        >
                          {(Object.keys(FINANCING_PLAN_LABELS) as FinancingPlan[]).map(
                            (plan) => (
                              <option key={plan} value={plan}>
                                {FINANCING_PLAN_LABELS[plan]}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}

                    {paymentMethod !== "cash" && (
                      <div className="rounded-xl bg-white/5 px-3 py-2.5 text-sm ring-1 ring-white/10">
                        <Row
                          label="Cash price (selected tier)"
                          value={money(selectedCashPrice)}
                        />
                        <Row
                          label={`Financing surcharge (${financing.surchargePercent}%)`}
                          value={money(financing.financedPrice - selectedCashPrice)}
                        />
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="ring-1 ring-amber-400/15">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20">
                        <Calculator size={16} className="text-amber-300" />
                      </span>
                      Final Amount · Commission
                    </CardTitle>
                  </CardHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                        Commission
                      </label>
                      <select
                        id="commission-mode"
                        value={commissionMode}
                        onChange={(e) =>
                          setCommissionMode(e.target.value as CommissionMode)
                        }
                        className={selectClass}
                      >
                        <option value="regular">{COMMISSION_MODE_LABELS.regular}</option>
                        <option value="goal">{COMMISSION_MODE_LABELS.goal}</option>
                      </select>
                    </div>

                    <div className="space-y-2 text-sm border-t border-white/10 pt-3">
                      <Row label="Tag price" value={money(result.item.tagPrice)} />
                      <Row
                        label={`After discount (${selectedTier.toUpperCase()})`}
                        value={money(selectedCashPrice)}
                      />
                      {paymentMethod !== "cash" && (
                        <Row
                          label="After financing"
                          value={money(financing.financedPrice)}
                        />
                      )}
                      <Row
                        label={`${commissionMode === "goal" ? "Goal" : "Regular"} (${commissionPercent}%)`}
                        value={money(commissionAmt)}
                      />
                    </div>

                    <div className="rounded-xl bg-amber-500/10 px-4 py-4 ring-1 ring-amber-400/20">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-ink">
                          Full Final Amount
                        </span>
                        <span className="text-2xl font-bold text-amber-300 tabular-nums">
                          {money(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </>
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
      <p
        className={cn(
          "font-medium text-ink",
          highlight && "text-amber-300 font-semibold tabular-nums"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}
