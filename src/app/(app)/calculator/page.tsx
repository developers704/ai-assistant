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
  FINANCING_PLAN_LABELS,
  calculateCustomerOfferProfit,
  calculateFinancedPrice,
  CUSTOMER_OFFER_COMMISSION_PERCENT,
  CUSTOMER_OFFER_TAX_PERCENT,
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
  HandCoins,
  Loader2,
  Search,
  Upload,
  Tag,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { ProductThumb, ProductLightbox } from "@/components/reports/ProductImagePreview";

const money = (n: number) =>
  isFinite(n)
    ? n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      })
    : "$0.00";

const PAYMENT_METHOD_TABS: {
  id: PaymentMethod;
  label: string;
  hint?: string;
}[] = [
  { id: "cash", label: "Cash", hint: "No surcharge" },
  { id: "credit_card", label: "Credit Card", hint: "3.5%" },
  { id: "financing", label: "Financing", hint: "No-interest terms" },
  {
    id: "lease",
    label: "Progressive / Acima / UOwn / Kefene",
    hint: "5%",
  },
  { id: "affirm", label: "Affirm", hint: "12%" },
];

const FINANCING_PLAN_TABS = (
  Object.keys(FINANCING_PLAN_LABELS) as FinancingPlan[]
).map((plan) => ({
  id: plan,
  label: FINANCING_PLAN_LABELS[plan],
}));

type CalculatorMode = "pricing" | "customer_offer";

const CALCULATOR_MODE_TABS: { id: CalculatorMode; label: string; hint: string }[] = [
  { id: "customer_offer", label: "Customer Offer", hint: "Whole cost floor · profit / loss" },
  { id: "pricing", label: "Standard Pricing", hint: "Tiers · financing · final amount" },
];

interface LookupResponse {
  item: InventoryItem;
  wholeCost?: number;
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
  const [calculatorMode, setCalculatorMode] = useState<CalculatorMode>("customer_offer");
  const [customerOfferInput, setCustomerOfferInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [financingPlan, setFinancingPlan] = useState<FinancingPlan>("6_months");
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
    setCustomerOfferInput("");

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

  const grandTotal = financing.financedPrice;

  const wholeCost = result?.wholeCost ?? 0;

  const customerOfferAmount = useMemo(() => {
    const parsed = parseFloat(customerOfferInput.replace(/[,$]/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [customerOfferInput]);

  const customerOffer = useMemo(
    () => calculateCustomerOfferProfit(wholeCost, customerOfferAmount),
    [wholeCost, customerOfferAmount]
  );

  const hasCustomerOfferInput = customerOfferInput.trim().length > 0;

  return (
    <PageShell accent="amber">
        <PageShellHeader>
          <PageHeader
            gradient
            eyebrow="Pricing"
            title="Price Calculator"
            subtitle="SKU lookup · customer offer · manager tiers"
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
                  <CardTitle>Calculator mode</CardTitle>
                </CardHeader>
                <OptionTabs
                  options={CALCULATOR_MODE_TABS}
                  value={calculatorMode}
                  onChange={setCalculatorMode}
                  columns="grid-cols-1 sm:grid-cols-2"
                  activeClassName="bg-amber-500/20 ring-amber-400/40"
                />
              </Card>

              {calculatorMode === "customer_offer" ? (
                <Card className="ring-1 ring-amber-400/15">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20">
                        <HandCoins size={16} className="text-amber-300" />
                      </span>
                      Customer Offer
                    </CardTitle>
                  </CardHeader>
                  <div className="flex flex-col sm:flex-row gap-4 mb-5">
                    <ProductThumb
                      imageDir={result.item.imageDir}
                      imageUrl={result.imageUrl}
                      alt={result.item.description || result.item.sku}
                      subtitle={result.item.vendorModel || result.item.sku}
                      onOpen={(src, alt, subtitle) => setPreview({ src, alt, subtitle })}
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm text-ink-secondary leading-relaxed">
                        {result.item.description || "—"}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                        <span>SKU {result.item.sku}</span>
                        {result.item.vendorModel && <span>Model {result.item.vendorModel}</span>}
                        <span>{result.pricing.categoryLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Detail label="Tag Price" value={money(result.item.tagPrice)} highlight />
                        <Detail label="Whole Cost" value={money(wholeCost)} highlight />
                      </div>
                      <Input
                        label="Customer Offer"
                        placeholder="Enter offer amount"
                        inputMode="decimal"
                        value={customerOfferInput}
                        onChange={(e) => setCustomerOfferInput(e.target.value)}
                      />
                      <p className="text-xs text-ink-muted">
                        Floor = whole cost + {CUSTOMER_OFFER_TAX_PERCENT}% tax +{" "}
                        {CUSTOMER_OFFER_COMMISSION_PERCENT}% commission (each on whole cost).
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 space-y-1">
                        <Row label="Whole cost" value={money(customerOffer.wholeCost)} />
                        <Row
                          label={`Tax (${CUSTOMER_OFFER_TAX_PERCENT}%)`}
                          value={money(customerOffer.tax)}
                        />
                        <Row
                          label={`Commission (${CUSTOMER_OFFER_COMMISSION_PERCENT}%)`}
                          value={money(customerOffer.commission)}
                        />
                        <Row label="Floor (minimum)" value={money(customerOffer.floor)} bold />
                      </div>

                      {hasCustomerOfferInput && (
                        <div
                          className={cn(
                            "rounded-xl px-4 py-4 ring-1",
                            customerOffer.isLoss
                              ? "bg-accent-rose/10 ring-accent-rose/30"
                              : "bg-emerald-500/10 ring-emerald-400/20"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-base font-semibold text-ink">
                              {customerOffer.isLoss ? "Loss" : "Profit"}
                            </span>
                            <span
                              className={cn(
                                "text-2xl font-bold tabular-nums",
                                customerOffer.isLoss ? "text-accent-rose" : "text-emerald-300"
                              )}
                            >
                              {customerOffer.isLoss ? "−" : "+"}
                              {money(Math.abs(customerOffer.profit))}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-ink-muted">
                            Customer offer {money(customerOffer.customerOffer)} − floor{" "}
                            {money(customerOffer.floor)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ) : (
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
                      <p className="block text-sm font-medium text-ink-secondary mb-2">
                        Payment type
                      </p>
                      <OptionTabs
                        options={PAYMENT_METHOD_TABS}
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                        activeClassName="bg-indigo-500/20 ring-indigo-400/40"
                      />
                    </div>

                    {paymentMethod === "financing" && (
                      <div>
                        <p className="block text-sm font-medium text-ink-secondary mb-2">
                          Financing term
                        </p>
                        <OptionTabs
                          options={FINANCING_PLAN_TABS}
                          value={financingPlan}
                          onChange={setFinancingPlan}
                          columns="grid-cols-1 sm:grid-cols-2"
                          activeClassName="bg-violet-500/20 ring-violet-400/40"
                        />
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
                      Final Amount
                    </CardTitle>
                  </CardHeader>
                  <div className="space-y-4">
                    <div className="space-y-2 text-sm">
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

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={cn("text-ink-secondary", bold && "font-medium text-ink")}>{label}</span>
      <span className={cn("font-medium text-ink tabular-nums", bold && "font-semibold")}>
        {value}
      </span>
    </div>
  );
}

function OptionTabs<T extends string>({
  options,
  value,
  onChange,
  columns = "grid-cols-2",
  activeClassName = "bg-indigo-500/20 ring-indigo-400/40",
}: {
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
  columns?: string;
  activeClassName?: string;
}) {
  return (
    <div className={cn("grid gap-2", columns)}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-2xl px-3.5 py-3 text-left ring-1 transition-all",
              active
                ? activeClassName
                : "bg-white/5 ring-white/10 hover:bg-white/10"
            )}
          >
            <span
              className={cn(
                "block text-sm font-medium leading-snug",
                active ? "text-ink" : "text-ink-secondary"
              )}
            >
              {option.label}
            </span>
            {option.hint && (
              <span className="mt-1 block text-[11px] text-ink-muted">{option.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
