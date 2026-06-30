"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  STORES,
  type CreditCardPlan,
  type InventoryItem,
  type ManagerTier,
  type PaymentMethod,
  type PricingResult,
} from "@/lib/inventory/types";
import {
  CREDIT_CARD_PLAN_LABELS,
  calculateFinancedPrice,
  calculateGrandTotal,
} from "@/lib/inventory/pricing";
import {
  Calculator,
  Loader2,
  Search,
  Upload,
  Store,
  Tag,
  CreditCard,
  DollarSign,
} from "lucide-react";

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

const num = (v: string) => {
  const n = parseFloat(v);
  return isFinite(n) && n >= 0 ? n : 0;
};

interface LookupResponse {
  item: InventoryItem;
  pricing: PricingResult;
  status: { loaded: boolean; rowCount: number };
}

export default function CalculatorPage() {
  const [store, setStore] = useState<string>(STORES[0]);
  const [sku, setSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [inventoryLoaded, setInventoryLoaded] = useState<boolean | null>(null);
  const [inventoryRows, setInventoryRows] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [selectedTier, setSelectedTier] = useState<ManagerTier>("m");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [creditCardPlan, setCreditCardPlan] = useState<CreditCardPlan>("no_interest");
  const [commission, setCommission] = useState("");
  const [commissionPlus, setCommissionPlus] = useState("");

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
        `/api/inventory?sku=${encodeURIComponent(trimmed)}&store=${encodeURIComponent(store)}`,
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
    () => calculateFinancedPrice(selectedCashPrice, paymentMethod, creditCardPlan),
    [selectedCashPrice, paymentMethod, creditCardPlan]
  );

  const grandTotal = useMemo(
    () =>
      calculateGrandTotal(
        financing.financedPrice,
        num(commission),
        num(commissionPlus)
      ),
    [financing.financedPrice, commission, commissionPlus]
  );

  return (
    <div className="flex flex-col min-h-0">
      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
          <PageHeader
            title="Price Calculator"
            subtitle="SKU lookup with manager discounts, financing, and commission"
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
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">
          {inventoryLoaded === false && (
            <Card className="p-4 ring-1 ring-amber-400/20">
              <p className="text-sm text-ink-secondary">
                Place your inventory CSV at{" "}
                <code className="text-amber-300">.data/inventory/inventory.csv</code> on the
                server, or use <strong>Upload CSV</strong> above. Expected columns include SKU
                #, Item Desc, Department, Design, Class, Sub-Class, Store, Cost Price, Tag
                Price, and AvgWeight.
              </p>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20">
                  <Store size={16} className="text-sky-300" />
                </span>
                Store & SKU
              </CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                  Select Store
                </label>
                <select
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  className={selectClass}
                >
                  {STORES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="SKU Number"
                placeholder="Enter SKU #"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupSku()}
              />
              <div className="flex items-end">
                <Button
                  className="w-full"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <Detail label="SKU" value={result.item.sku} />
                  <Detail label="Brand" value={result.item.brand} />
                  <Detail label="Department" value={result.item.department || "—"} />
                  <Detail label="Design" value={result.item.design || "—"} />
                  <Detail label="Sub-Class" value={result.item.subClass || "—"} />
                  <Detail label="Tag Price" value={money(result.item.tagPrice)} highlight />
                  <Detail label="Cost Price" value={money(result.item.costPrice)} />
                  {result.pricing.category === "gold" && (
                    <Detail
                      label="Avg Weight (g)"
                      value={
                        result.item.avgWeight > 0
                          ? String(result.item.avgWeight)
                          : "—"
                      }
                    />
                  )}
                  <Detail
                    label="Category"
                    value={result.pricing.categoryLabel}
                  />
                </div>
                <p className="mt-4 text-sm text-ink-secondary leading-relaxed">
                  {result.item.description}
                </p>
                <p className="mt-2 text-xs text-ink-muted">{result.pricing.rulesSummary}</p>
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
                        <option value="credit_card">Credit Card</option>
                        <option value="affirm">Affirm</option>
                        <option value="progressive">Progressive</option>
                        <option value="acima">Acima</option>
                        <option value="uown">UOwn</option>
                      </select>
                    </div>

                    {paymentMethod === "credit_card" && (
                      <div>
                        <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                          Credit card plan
                        </label>
                        <select
                          value={creditCardPlan}
                          onChange={(e) =>
                            setCreditCardPlan(e.target.value as CreditCardPlan)
                          }
                          className={selectClass}
                        >
                          {(Object.keys(CREDIT_CARD_PLAN_LABELS) as CreditCardPlan[]).map(
                            (plan) => (
                              <option key={plan} value={plan}>
                                {CREDIT_CARD_PLAN_LABELS[plan]}
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
                      Final Amount
                    </CardTitle>
                  </CardHeader>
                  <div className="space-y-4">
                    <Input
                      label="Commission ($)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      placeholder="0.00"
                    />
                    <Input
                      label="Commission+ ($)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={commissionPlus}
                      onChange={(e) => setCommissionPlus(e.target.value)}
                      placeholder="0.00"
                    />

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
                      {num(commission) > 0 && (
                        <Row label="Commission" value={money(num(commission))} />
                      )}
                      {num(commissionPlus) > 0 && (
                        <Row label="Commission+" value={money(num(commissionPlus))} />
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
        </div>
      </div>
    </div>
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
