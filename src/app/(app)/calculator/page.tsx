"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Coins, Gem, RefreshCw, Loader2, Receipt } from "lucide-react";

type Karat = "24K" | "22K" | "18K" | "14K";
const KARATS: Karat[] = ["24K", "22K", "18K", "14K"];

interface LiveRates {
  goldPerGram: Record<Karat, number>;
  silverPerGram: number;
  diamondNatural: number;
  diamondLab: number;
  live: boolean;
}

const FALLBACK: LiveRates = {
  goldPerGram: { "24K": 139.3, "22K": 127.7, "18K": 104.5, "14K": 81.2 },
  silverPerGram: 2.25,
  diamondNatural: 5800,
  diamondLab: 900,
  live: false,
};

const selectClass =
  "w-full px-4 py-2.5 rounded-2xl border border-white/25 bg-white/10 text-ink text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/40";

const money = (n: number) =>
  isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
    : "$0.00";

const num = (v: string) => {
  const n = parseFloat(v);
  return isFinite(n) && n >= 0 ? n : 0;
};

export default function CalculatorPage() {
  const [rates, setRates] = useState<LiveRates>(FALLBACK);
  const [loadingRates, setLoadingRates] = useState(true);

  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [karat, setKarat] = useState<Karat>("22K");
  const [ratePerGram, setRatePerGram] = useState("127.7");
  const [weight, setWeight] = useState("5");

  const [diamondType, setDiamondType] = useState<"natural" | "lab">("natural");
  const [carat, setCarat] = useState("0");
  const [pricePerCarat, setPricePerCarat] = useState("5800");

  const [makingPct, setMakingPct] = useState("12");
  const [makingFlat, setMakingFlat] = useState("0");
  const [otherCosts, setOtherCosts] = useState("0");
  const [taxPct, setTaxPct] = useState("8");

  const loadRates = async () => {
    setLoadingRates(true);
    try {
      const res = await fetch("/api/markets", { cache: "no-store" });
      const json = await res.json();
      const gold = json.metals?.find((m: { symbol: string }) => m.symbol === "XAU");
      const silver = json.metals?.find((m: { symbol: string }) => m.symbol === "XAG");
      const goldPerGram: Record<Karat, number> = { ...FALLBACK.goldPerGram };
      if (gold?.derived) {
        for (const d of gold.derived as { label: Karat; pricePerGram: number }[]) {
          if (KARATS.includes(d.label)) goldPerGram[d.label] = d.pricePerGram;
        }
      }
      const natural = json.gems?.find((g: { name: string }) => g.name === "Natural Diamond");
      const lab = json.gems?.find((g: { name: string }) => g.name === "Lab-Grown Diamond");
      setRates({
        goldPerGram,
        silverPerGram: silver?.pricePerGram ?? FALLBACK.silverPerGram,
        diamondNatural: natural?.pricePerCarat ?? FALLBACK.diamondNatural,
        diamondLab: lab?.pricePerCarat ?? FALLBACK.diamondLab,
        live: !!json.metalsLive,
      });
    } catch {
      setRates(FALLBACK);
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  useEffect(() => {
    setRatePerGram(String(metal === "gold" ? rates.goldPerGram[karat] : rates.silverPerGram));
  }, [metal, karat, rates]);

  useEffect(() => {
    setPricePerCarat(String(diamondType === "natural" ? rates.diamondNatural : rates.diamondLab));
  }, [diamondType, rates]);

  const breakdown = useMemo(() => {
    const metalValue = num(ratePerGram) * num(weight);
    const diamondValue = num(carat) * num(pricePerCarat);
    const making = metalValue * (num(makingPct) / 100) + num(makingFlat);
    const subtotal = metalValue + diamondValue + making + num(otherCosts);
    const tax = subtotal * (num(taxPct) / 100);
    const total = subtotal + tax;
    return { metalValue, diamondValue, making, subtotal, tax, total };
  }, [ratePerGram, weight, carat, pricePerCarat, makingPct, makingFlat, otherCosts, taxPct]);

  const pickGoldRate = (k: Karat) => {
    setMetal("gold");
    setKarat(k);
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="glass-panel-strong rounded-3xl ring-1 ring-white/10 overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/10">
          <PageHeader
            title="Price Calculator"
            subtitle="Estimate retail prices for gold and diamond jewellery using live metal rates"
            action={
              <div className="flex items-center gap-2">
                {rates.live && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full ring-1 ring-emerald-400/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live rates
                  </span>
                )}
                <Button size="sm" variant="outline" onClick={loadRates} disabled={loadingRates}>
                  {loadingRates ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Refresh rates
                </Button>
              </div>
            }
          />
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">
          {/* Live rates strip */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-500/20 ring-1 ring-yellow-400/20">
                  <Coins size={14} className="text-yellow-300" />
                </span>
                Today&apos;s rates (per gram)
              </h3>
              <Badge variant={rates.live ? "success" : "warning"}>{rates.live ? "Live" : "Fallback"}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {KARATS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pickGoldRate(k)}
                  className={cn(
                    "p-3 rounded-xl text-left transition-all ring-1",
                    metal === "gold" && karat === k
                      ? "bg-amber-500/20 ring-amber-400/40"
                      : "bg-white/5 ring-white/10 hover:bg-white/10 hover:ring-white/20"
                  )}
                >
                  <p className="text-xs text-ink-muted">Gold {k}</p>
                  <p className="text-sm font-bold text-ink">{money(rates.goldPerGram[k])}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMetal("silver")}
                className={cn(
                  "p-3 rounded-xl text-left transition-all ring-1",
                  metal === "silver"
                    ? "bg-slate-400/20 ring-slate-300/40"
                    : "bg-white/5 ring-white/10 hover:bg-white/10 hover:ring-white/20"
                )}
              >
                <p className="text-xs text-ink-muted">Silver</p>
                <p className="text-sm font-bold text-ink">{money(rates.silverPerGram)}</p>
              </button>
            </div>
            <p className="text-[11px] text-ink-muted mt-2">Tap a rate to use it in the calculator below.</p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-500/20">
                      <Coins size={16} className="text-yellow-300" />
                    </span>
                    Metal
                  </CardTitle>
                </CardHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-secondary mb-1.5">Metal type</label>
                    <select value={metal} onChange={(e) => setMetal(e.target.value as "gold" | "silver")} className={selectClass}>
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                    </select>
                  </div>
                  {metal === "gold" && (
                    <div>
                      <label className="block text-sm font-medium text-ink-secondary mb-1.5">Purity</label>
                      <select value={karat} onChange={(e) => setKarat(e.target.value as Karat)} className={selectClass}>
                        {KARATS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Input label="Rate per gram ($)" type="number" step="0.01" value={ratePerGram} onChange={(e) => setRatePerGram(e.target.value)} />
                  <Input label="Weight (grams)" type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-500/20">
                      <Gem size={16} className="text-fuchsia-300" />
                    </span>
                    Diamonds / Stones
                  </CardTitle>
                </CardHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-secondary mb-1.5">Type</label>
                    <select value={diamondType} onChange={(e) => setDiamondType(e.target.value as "natural" | "lab")} className={selectClass}>
                      <option value="natural">Natural</option>
                      <option value="lab">Lab-grown</option>
                    </select>
                  </div>
                  <Input label="Total carat (ct)" type="number" step="0.01" value={carat} onChange={(e) => setCarat(e.target.value)} />
                  <Input label="Price per carat ($)" type="number" step="1" value={pricePerCarat} onChange={(e) => setPricePerCarat(e.target.value)} />
                </div>
                <p className="text-xs text-ink-muted mt-3">
                  Diamond per-carat values are indicative — adjust to your actual cost or supplier quote.
                </p>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20">
                      <Receipt size={16} className="text-sky-300" />
                    </span>
                    Charges & Tax
                  </CardTitle>
                </CardHeader>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Input label="Making (% of metal)" type="number" value={makingPct} onChange={(e) => setMakingPct(e.target.value)} />
                  <Input label="Making flat ($)" type="number" value={makingFlat} onChange={(e) => setMakingFlat(e.target.value)} />
                  <Input label="Other costs ($)" type="number" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} />
                  <Input label="Tax / GST (%)" type="number" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
                </div>
              </Card>
            </div>

            <div>
              <Card className="lg:sticky lg:top-4 ring-1 ring-amber-400/15">
                <CardHeader>
                  <CardTitle>Price Breakdown</CardTitle>
                </CardHeader>
                <div className="space-y-2.5 text-sm">
                  <Row label={`Metal value (${num(weight)} g)`} value={money(breakdown.metalValue)} />
                  <Row label={`Diamond value (${num(carat)} ct)`} value={money(breakdown.diamondValue)} />
                  <Row label="Making charges" value={money(breakdown.making)} />
                  {num(otherCosts) > 0 && <Row label="Other costs" value={money(num(otherCosts))} />}
                  <div className="border-t border-white/10 pt-2.5">
                    <Row label="Subtotal" value={money(breakdown.subtotal)} bold />
                  </div>
                  <Row label={`Tax (${num(taxPct)}%)`} value={money(breakdown.tax)} />
                  <div className="border-t border-white/10 pt-3 mt-1 rounded-xl bg-amber-500/10 px-3 py-3 ring-1 ring-amber-400/20">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-ink">Grand Total</span>
                      <span className="text-2xl font-bold text-amber-300">{money(breakdown.total)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-ink-muted mt-4 leading-relaxed">
                  Estimate based on the rates above. Always verify against your supplier quote before final pricing.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={bold ? "font-semibold text-ink" : "text-ink-secondary"}>{label}</span>
      <span className={bold ? "font-semibold text-ink" : "font-medium text-ink tabular-nums"}>{value}</span>
    </div>
  );
}
