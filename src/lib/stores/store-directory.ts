import fs from "fs";
import path from "path";
import { canCalculateDistance, haversineMiles } from "@/lib/stores/distance";
import type { NearestStoreRef, StoreDirectoryEntry, StoreDirectoryFile } from "@/lib/stores/types";

export const STORE_DIRECTORY_PATH = path.join(
  process.cwd(),
  "data",
  "knowledge",
  "valliani",
  "store-directory.json"
);

export const GEOCODE_CACHE_PATH = path.join(process.cwd(), ".data", "stores", "geocode-cache.json");

export const STORE_SOURCE_URL =
  "https://vallianijewelers.com/pages/find-your-location";

let cachedDirectory: StoreDirectoryFile | null = null;

export function loadStoreDirectory(): StoreDirectoryFile {
  if (cachedDirectory) return cachedDirectory;

  if (!fs.existsSync(STORE_DIRECTORY_PATH)) {
    return {
      sourceUrl: STORE_SOURCE_URL,
      lastSyncedAt: "",
      storeCount: 0,
      stores: [],
    };
  }

  cachedDirectory = JSON.parse(
    fs.readFileSync(STORE_DIRECTORY_PATH, "utf-8")
  ) as StoreDirectoryFile;
  return cachedDirectory;
}

export function clearStoreDirectoryCache(): void {
  cachedDirectory = null;
}

export function isStoreDirectoryAvailable(): boolean {
  const dir = loadStoreDirectory();
  return dir.stores.length > 0;
}

export function getAllStores(): StoreDirectoryEntry[] {
  return loadStoreDirectory().stores;
}

export function getStoreById(id: string): StoreDirectoryEntry | undefined {
  return getAllStores().find((s) => s.id === id);
}

export function computeNearestStores(
  stores: StoreDirectoryEntry[],
  limit = 3
): StoreDirectoryEntry[] {
  return stores.map((store) => {
    if (!canCalculateDistance(store)) {
      return { ...store, nearestStores: [] };
    }

    const nearest: NearestStoreRef[] = [];
    for (const other of stores) {
      if (other.id === store.id) continue;
      if (!canCalculateDistance(other)) continue;
      const distance = haversineMiles(store, other);
      if (distance == null) continue;
      nearest.push({
        id: other.id,
        name: other.name,
        distanceMiles: Math.round(distance * 10) / 10,
      });
    }

    nearest.sort((a, b) => a.distanceMiles - b.distanceMiles);

    return {
      ...store,
      nearestStores: nearest.slice(0, limit),
    };
  });
}

export function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/valliani jewelers?/gi, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function storeMatchesQuery(store: StoreDirectoryEntry, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return false;

  const haystack = normalizeQuery(
    [
      store.id,
      store.name,
      store.mall,
      store.city ?? "",
      store.state,
      store.stateCode,
      store.phone ?? "",
      store.address ?? "",
      ...(store.aliases ?? []),
    ].join(" ")
  );

  if (haystack.includes(q)) return true;

  const tokens = q.split(" ").filter((t) => t.length > 2);
  if (tokens.length === 0) return false;
  return tokens.every((t) => haystack.includes(t));
}

export function searchStores(query: string): StoreDirectoryEntry[] {
  const stores = getAllStores();
  const matches = stores.filter((s) => storeMatchesQuery(s, query));
  if (matches.length > 0) return matches;

  const q = normalizeQuery(query);
  return stores.filter((s) => {
    const hay = normalizeQuery(`${s.mall} ${s.city ?? ""}`);
    return q.split(" ").every((t) => t.length < 3 || hay.includes(t));
  });
}
export const findStoresByQuery = searchStores;

export function getStoresByState(stateQuery: string): StoreDirectoryEntry[] {
  const q = normalizeQuery(stateQuery);
  const stateMap: Record<string, string> = {
    california: "CA",
    calif: "CA",
    ca: "CA",
    nevada: "NV",
    nv: "NV",
    arizona: "AZ",
    az: "AZ",
    texas: "TX",
    tx: "TX",
  };

  let code: string | null = null;
  for (const [alias, st] of Object.entries(stateMap)) {
    if (new RegExp(`\\b${alias}\\b`).test(q)) {
      code = st;
      break;
    }
  }

  if (!code) return [];

  return getAllStores().filter((s) => s.stateCode === code);
}
export const findStoresByState = getStoresByState;

export function getStoresByCity(cityQuery: string): StoreDirectoryEntry[] {
  const q = normalizeQuery(cityQuery);
  return getAllStores().filter((s) => {
    const city = normalizeQuery(s.city ?? "");
    return city.includes(q) || q.includes(city);
  });
}
export const findStoresByCity = getStoresByCity;

export function getStoresByRegion(region: string): StoreDirectoryEntry[] {
  const q = normalizeQuery(region);
  return getAllStores().filter((s) => normalizeQuery(s.region ?? "").includes(q));
}

export interface FindNearestStoreInput {
  storeName?: string;
  city?: string;
  state?: string;
  limit?: number;
}

export interface FindNearestStoreResult {
  ok: boolean;
  sourceStore: StoreDirectoryEntry | null;
  nearest: Array<{
    store: StoreDirectoryEntry;
    distanceMiles: number;
  }>;
  message: string;
  needsGeocoding: boolean;
  missingFields: string[];
}

export function findNearestStore(input: FindNearestStoreInput): FindNearestStoreResult {
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 3);
  const query = [input.storeName, input.city, input.state].filter(Boolean).join(" ").trim();

  if (!query) {
    return {
      ok: false,
      sourceStore: null,
      nearest: [],
      message: "Please name a store, mall, or city so I can find the nearest locations.",
      needsGeocoding: false,
      missingFields: ["storeName or city"],
    };
  }

  const matches = searchStores(query);
  const sourceStore = matches[0] ?? null;

  if (!sourceStore) {
    return {
      ok: false,
      sourceStore: null,
      nearest: [],
      message: `I couldn't find "${query}" in the synced store directory. Run **stores:sync** or check the spelling against the official location page.`,
      needsGeocoding: false,
      missingFields: ["matching store"],
    };
  }

  const missingFields: string[] = [];
  if (!canCalculateDistance(sourceStore)) {
    missingFields.push("latitude/longitude for source store");
  }

  if (!canCalculateDistance(sourceStore)) {
    return {
      ok: false,
      sourceStore,
      nearest: [],
      message: `**${sourceStore.name}** is in the directory, but distance can't be calculated — **latitude/longitude are missing** (needsGeocoding: true). Address on file: ${sourceStore.address ?? "not available"}. Sync with geocoding enabled or check Google Maps link.`,
      needsGeocoding: true,
      missingFields,
    };
  }

  const ranked: FindNearestStoreResult["nearest"] = [];
  for (const other of getAllStores()) {
    if (other.id === sourceStore.id) continue;
    if (!canCalculateDistance(other)) continue;
    const distance = haversineMiles(sourceStore, other);
    if (distance == null) continue;
    ranked.push({
      store: other,
      distanceMiles: Math.round(distance * 10) / 10,
    });
  }

  ranked.sort((a, b) => a.distanceMiles - b.distanceMiles);

  const nearest = ranked.slice(0, limit);
  if (nearest.length === 0) {
    return {
      ok: false,
      sourceStore,
      nearest: [],
      message: `No other stores have coordinates to calculate distance from **${sourceStore.name}**. Other locations may need geocoding.`,
      needsGeocoding: false,
      missingFields: ["coordinates for peer stores"],
    };
  }

  return {
    ok: true,
    sourceStore,
    nearest,
    message: formatNearestStoreMessage(sourceStore, nearest),
    needsGeocoding: false,
    missingFields: [],
  };
}

export function formatNearestStoreMessage(
  source: StoreDirectoryEntry,
  nearest: Array<{ store: StoreDirectoryEntry; distanceMiles: number }>
): string {
  const lines = nearest.map(
    (n) =>
      `- **${n.store.mall}** (${n.store.city}, ${n.store.stateCode}) — **${n.distanceMiles} mi**${n.store.phone ? ` · ${n.store.phone}` : ""}`
  );
  return `**Nearest to ${source.mall}** (${source.city}, ${source.stateCode})\n\n${lines.join("\n")}`;
}

export function formatStoreEntry(store: StoreDirectoryEntry): string {
  const isOpeningSoon = /opening[_\s]?soon/i.test(String(store.status));
  const status = isOpeningSoon ? " *(Opening soon)*" : "";
  const hours =
    typeof store.openingHours === "string"
      ? store.openingHours
      : store.openingHours && typeof store.openingHours === "object"
        ? Object.entries(store.openingHours as Record<string, string | null>)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : null;
  const lines = [
    `**${store.mall}**${status}`,
    store.address ? `📍 ${store.address}` : null,
    store.phone ? `📞 ${store.phone}` : null,
    hours ? `🕐 ${hours}` : null,
    store.email ? `✉️ ${store.email}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function formatStoreListMarkdown(stores: StoreDirectoryEntry[], title: string): string {
  if (stores.length === 0) {
    return `No stores found in the synced directory for that query. Data comes from the [official location page](${STORE_SOURCE_URL}).`;
  }
  return `**${title}** (${stores.length})\n\n${stores.map(formatStoreEntry).join("\n\n")}`;
}
