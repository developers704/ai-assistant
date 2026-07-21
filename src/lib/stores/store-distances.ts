import {
  formatKm,
  haversineMiles,
  milesToKm,
  sortStoresByDistance,
} from "@/lib/stores/distance";
import { findStore } from "@/lib/stores/store-intelligence";
import { getAllStores, isStoreDirectoryAvailable } from "@/lib/stores/store-directory";
import type { StoreDirectoryEntry } from "@/lib/stores/types";

function storeLabel(store: StoreDirectoryEntry): string {
  const city = store.city ? ` (${store.city})` : "";
  return `${store.mall || store.name}${city}`;
}

/** Straight-line distance between two stores (miles + km). */
export function getStoreToStoreDistance(
  fromQuery: string,
  toQuery: string
): {
  ok: boolean;
  message: string;
  from?: string;
  to?: string;
  miles?: number;
  km?: number;
} {
  if (!isStoreDirectoryAvailable()) {
    return { ok: false, message: "Store directory is not loaded." };
  }
  const from = findStore(fromQuery);
  const to = findStore(toQuery);
  if (!from) {
    return { ok: false, message: `I couldn't find a store matching "${fromQuery}".` };
  }
  if (!to) {
    return { ok: false, message: `I couldn't find a store matching "${toQuery}".` };
  }
  if (from.id === to.id) {
    return {
      ok: true,
      message: `${storeLabel(from)} — that's the same store (0 km).`,
      from: storeLabel(from),
      to: storeLabel(to),
      miles: 0,
      km: 0,
    };
  }
  const miles = haversineMiles(from, to);
  if (miles == null) {
    return {
      ok: false,
      message: `Coordinates missing for ${storeLabel(from)} or ${storeLabel(to)} — cannot compute distance.`,
    };
  }
  const km = milesToKm(miles)!;
  return {
    ok: true,
    from: storeLabel(from),
    to: storeLabel(to),
    miles: Math.round(miles * 10) / 10,
    km,
    message: `Straight-line distance from ${storeLabel(from)} to ${storeLabel(to)}: **${formatKm(miles)} km** (${Math.round(miles * 10) / 10} mi).`,
  };
}

/** Distances from one store to every other store (nearest first). */
export function getDistancesFromStore(fromQuery: string): {
  ok: boolean;
  message: string;
  from?: string;
  distances?: Array<{ store: string; km: number; miles: number }>;
} {
  if (!isStoreDirectoryAvailable()) {
    return { ok: false, message: "Store directory is not loaded." };
  }
  const from = findStore(fromQuery);
  if (!from) {
    return { ok: false, message: `I couldn't find a store matching "${fromQuery}".` };
  }
  const ranked = sortStoresByDistance(from, getAllStores());
  if (!ranked.length) {
    return {
      ok: false,
      message: `No other geocoded stores to compare with ${storeLabel(from)}.`,
    };
  }
  const distances = ranked.map((r) => ({
    store: storeLabel(r.store),
    miles: r.distanceMiles,
    km: milesToKm(r.distanceMiles)!,
  }));
  const lines = distances
    .map((d) => `- ${d.store}: **${d.km} km** (${d.miles} mi)`)
    .join("\n");
  return {
    ok: true,
    from: storeLabel(from),
    distances,
    message: `**Distances from ${storeLabel(from)}** (straight-line, nearest first)\n\n${lines}`,
  };
}

/**
 * Compact pairwise distance reference for Alexa LIVE CONTEXT.
 * One line per store: mall → all other malls with km.
 */
export function buildStoreDistanceMatrixContext(): string {
  if (!isStoreDirectoryAvailable()) {
    return "STORE DISTANCES: directory not loaded — use get_store_distance / find_nearest_store.";
  }
  const stores = getAllStores().filter(
    (s) => typeof s.latitude === "number" && typeof s.longitude === "number"
  );
  if (stores.length < 2) {
    return "STORE DISTANCES: not enough geocoded stores.";
  }

  const lines: string[] = [
    "STORE DISTANCES (straight-line km, all pairs — authoritative; never invent):",
  ];

  for (const from of stores) {
    const ranked = sortStoresByDistance(from, stores);
    const parts = ranked.map((r) => {
      const short = r.store.mall || r.store.name;
      return `${short} ${formatKm(r.distanceMiles)}km`;
    });
    const fromName = from.mall || from.name;
    lines.push(`From ${fromName}${from.city ? ` (${from.city})` : ""}: ${parts.join(" · ")}`);
  }

  lines.push(
    "For a specific pair ask get_store_distance (from_store + to_store). Driving time may differ from straight-line."
  );
  return lines.join("\n");
}

export function buildStoreDistanceToolResult(input: {
  fromStore?: string;
  toStore?: string;
  userMessage?: string;
}): { ok: boolean; message: string; spokenAnswer: string } {
  const msg = input.userMessage?.trim() ?? "";
  let from = input.fromStore?.trim();
  let to = input.toStore?.trim();

  if ((!from || !to) && msg) {
    const between =
      msg.match(
        /\b(?:distance|how far|miles?|km)\b[\s\S]{0,20}\b(?:between|from)\s+(.+?)\s+(?:and|to|→|->)\s+(.+?)(?:\s*[.?!]|$)/i
      ) ||
      msg.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s*[.?!]|$)/i);
    if (between) {
      from = from || between[1].replace(/\b(store|mall|the|our)\b/gi, "").trim();
      to = to || between[2].replace(/\b(store|mall|the|our)\b/gi, "").trim();
    }
  }

  if (from && to) {
    const pair = getStoreToStoreDistance(from, to);
    const spoken = pair.ok
      ? `${pair.from} to ${pair.to} is about ${pair.km} kilometers straight-line.`
      : pair.message;
    return { ok: pair.ok, message: pair.message, spokenAnswer: spoken };
  }

  if (from || msg) {
    const query = from || msg;
    const all = getDistancesFromStore(query);
    if (!all.ok) {
      return { ok: false, message: all.message, spokenAnswer: all.message };
    }
    const top = (all.distances ?? []).slice(0, 5);
    const spoken = `From ${all.from}, nearest are ${top
      .map((d) => `${d.store} at ${d.km} kilometers`)
      .join("; ")}.`;
    return { ok: true, message: all.message, spokenAnswer: spoken };
  }

  return {
    ok: false,
    message:
      "Tell me two stores (e.g. Great Mall to Valley Fair) or one store to list distances to all others.",
    spokenAnswer: "Which two stores should I measure between?",
  };
}
