/**
 * Live precious metal spot prices from MetalMetric (COMEX/LBMA-sourced, ~60s refresh).
 * @see https://metalmetric.com/developers
 * @see https://metalmetric.com/api/spot — public spot endpoint (no API key)
 */

export const TROY_OUNCE_GRAMS = 31.1035;

export const KARAT_PURITY: Record<string, number> = {
  "24K": 1,
  "22K": 0.9167,
  "18K": 0.75,
  "14K": 0.5833,
};

const METALMETRIC_SPOT_URL = "https://metalmetric.com/api/spot";
const FETCH_USER_AGENT = "LindyAI/1.0 (Valliani Executive Assistant)";

export interface MetalPrice {
  symbol: string;
  name: string;
  pricePerOunce: number;
  pricePerGram: number;
  live: boolean;
  changePct?: number;
  derived?: { label: string; pricePerGram: number }[];
}

export interface MetalMetricSpot {
  live: boolean;
  source: string;
  fetchedAt: string;
  goldPerOz: number | null;
  silverPerOz: number | null;
  platinumPerOz: number | null;
  goldChangePct?: number;
  silverChangePct?: number;
  platinumChangePct?: number;
}

interface MetalMetricSpotResponse {
  ok?: boolean;
  fetched_at_utc?: string;
  source?: string;
  gold_usd?: number;
  silver_usd?: number;
  platinum_usd?: number;
  gold?: { price?: number; change_pct?: number };
  silver?: { price?: number; change_pct?: number };
  platinum?: { price?: number; change_pct?: number };
}

export async function fetchMetalMetricSpot(): Promise<MetalMetricSpot | null> {
  try {
    const res = await fetch(METALMETRIC_SPOT_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": FETCH_USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as MetalMetricSpotResponse;
    if (!data.ok) return null;

    const goldPerOz = data.gold_usd ?? data.gold?.price ?? null;
    const silverPerOz = data.silver_usd ?? data.silver?.price ?? null;
    const platinumPerOz = data.platinum_usd ?? data.platinum?.price ?? null;

    if (goldPerOz == null && silverPerOz == null && platinumPerOz == null) return null;

    return {
      live: true,
      source: "MetalMetric",
      fetchedAt: data.fetched_at_utc ?? new Date().toISOString(),
      goldPerOz,
      silverPerOz,
      platinumPerOz,
      goldChangePct: data.gold?.change_pct,
      silverChangePct: data.silver?.change_pct,
      platinumChangePct: data.platinum?.change_pct,
    };
  } catch {
    return null;
  }
}

function buildMetal(
  symbol: string,
  name: string,
  liveOunce: number | null,
  fallbackOunce: number,
  changePct?: number,
  withKarats = false
): MetalPrice {
  const live = liveOunce != null;
  const pricePerOunce = liveOunce ?? fallbackOunce;
  const pricePerGram = pricePerOunce / TROY_OUNCE_GRAMS;

  const metal: MetalPrice = {
    symbol,
    name,
    pricePerOunce: Math.round(pricePerOunce * 100) / 100,
    pricePerGram: Math.round(pricePerGram * 100) / 100,
    live,
    ...(changePct != null ? { changePct } : {}),
  };

  if (withKarats) {
    metal.derived = Object.entries(KARAT_PURITY).map(([label, purity]) => ({
      label,
      pricePerGram: Math.round(pricePerGram * purity * 100) / 100,
    }));
  }

  return metal;
}

const FALLBACK_OZ: Record<string, number> = {
  XAU: 4332,
  XAG: 70,
  XPT: 1050,
};

export function buildMetalPricesFromSpot(spot: MetalMetricSpot | null): MetalPrice[] {
  return [
    buildMetal("XAU", "Gold", spot?.goldPerOz ?? null, FALLBACK_OZ.XAU, spot?.goldChangePct, true),
    buildMetal("XAG", "Silver", spot?.silverPerOz ?? null, FALLBACK_OZ.XAG, spot?.silverChangePct),
    buildMetal("XPT", "Platinum", spot?.platinumPerOz ?? null, FALLBACK_OZ.XPT, spot?.platinumChangePct),
  ];
}

export async function fetchMetalPrices(): Promise<{
  metals: MetalPrice[];
  spot: MetalMetricSpot | null;
  metalsLive: boolean;
  metalsSource: string;
  metalsFetchedAt: string | null;
}> {
  const spot = await fetchMetalMetricSpot();
  const metals = buildMetalPricesFromSpot(spot);

  return {
    metals,
    spot,
    metalsLive: metals.some((m) => m.live),
    metalsSource: spot?.source ?? "Indicative",
    metalsFetchedAt: spot?.fetchedAt ?? null,
  };
}
