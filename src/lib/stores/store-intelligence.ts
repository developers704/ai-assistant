import {
  findNearestStore as findNearestStoreCore,
  getStoreById,
  getStoresByCity,
  getStoresByState,
  searchStores,
  formatStoreEntry,
  formatStoreListMarkdown,
  getAllStores,
  isStoreDirectoryAvailable,
  normalizeQuery,
  STORE_SOURCE_URL,
} from "@/lib/stores/store-directory";
import type { StoreDirectoryEntry } from "@/lib/stores/types";

export type StoreIntent =
  | "store.nearest"
  | "store.list_state"
  | "store.list_city"
  | "store.lookup"
  | "store.call"
  | "store.list_all";

const NEAREST_PATTERNS = [
  /\b(?:closest|nearest)\b[\s\S]{0,60}\b(?:to|from)\b/i,
  /\bwhich\s+(?:branch|store|location)\b[\s\S]{0,40}\b(?:closest|nearest)\b/i,
  /\b(?:branch|store|location)\b[\s\S]{0,30}\b(?:closest|nearest)\b[\s\S]{0,30}\bto\b/i,
];

const STATE_LIST_PATTERNS = [
  /\b(?:show|list|which|all)\b[\s\S]{0,40}\bstores?\b[\s\S]{0,40}\b(?:in|across)\b[\s\S]{0,30}\b(california|nevada|arizona|texas|ca|nv|az|tx)\b/i,
  /\bstores?\s+in\s+(california|nevada|arizona|texas|ca|nv|az|tx)\b/i,
];

const CITY_LIST_PATTERNS = [
  /\bstores?\s+(?:in|near|around)\s+([a-z][a-z\s]{2,30})\b/i,
  /\bnear\s+([a-z][a-z\s]{2,30})\b/i,
];

const LOOKUP_PATTERNS = [
  /\b(?:what is|what's|give me|show me)\b[\s\S]{0,30}\b(?:address|phone|hours|location)\b[\s\S]{0,40}\b(?:of|for|at)\b/i,
  /\b(?:address|phone|hours)\b[\s\S]{0,20}\b(?:of|for|at)\b/i,
];

const CALL_PATTERNS = [/\bcall\b[\s\S]{0,40}\b(?:mall|store|mills|center|centre|fair|plaza)\b/i];

const ALL_STORES_PATTERNS = [
  /\b(?:how many|list|show|all)\b[\s\S]{0,30}\bstores?\b/i,
  /\b(?:store|stores|location|locations|mall)\b[\s\S]{0,30}\b(?:how many|count|list)\b/i,
];

const MALL_HINT =
  /\b(mall|mills|center|centre|fair|plaza|outlets|galleria|fashion|valley|oakridge|eastridge|meadowood|baybrook|deerbrook|ontario|great)\b/i;

export function isStoreIntelligenceQuery(message: string): boolean {
  if (!isStoreDirectoryAvailable()) return false;
  const lower = message.toLowerCase();

  if (NEAREST_PATTERNS.some((p) => p.test(lower))) return true;
  if (STATE_LIST_PATTERNS.some((p) => p.test(lower))) return true;
  if (CITY_LIST_PATTERNS.some((p) => p.test(lower))) return true;
  if (LOOKUP_PATTERNS.some((p) => p.test(lower))) return true;
  if (CALL_PATTERNS.some((p) => p.test(lower))) return true;
  if (ALL_STORES_PATTERNS.some((p) => p.test(lower))) return true;

  if (/\b(store|stores|location|branch|mall)\b/i.test(lower) && MALL_HINT.test(lower)) {
    return true;
  }

  return false;
}

export function extractStoreQueryPhrase(message: string): string {
  const patterns = [
    /\bwhich\s+(?:branch|store|location)\s+is\s+(?:closest|nearest)\s+to\s+(.+?)(?:\?|$)/i,
    /\b(?:closest|nearest)\s+(?:to|from)\s+(.+?)(?:\?|$)/i,
    /\b(?:closest|nearest)\s+(.+?)(?:\?|$)/i,
    /\b(?:address|phone|hours|location)\s+(?:of|for|at)\s+(.+?)(?:\?|$)/i,
    /\bcall\s+(.+?)(?:\?|$)/i,
    /\b(?:in|near|around)\s+(.+?)(?:\?|$)/i,
  ];

  for (const p of patterns) {
    const m = message.match(p);
    if (m?.[1]) return m[1].replace(/\.$/, "").trim();
  }

  return message
    .replace(/\b(which|what|show|list|tell|me|the|is|are|all|stores?|store|branch|nearest|closest|to|from|in|near|around|address|phone|hours|of|for|at|call)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyStoreIntent(message: string): StoreIntent | null {
  if (!isStoreIntelligenceQuery(message)) return null;
  const lower = message.toLowerCase();

  if (NEAREST_PATTERNS.some((p) => p.test(lower))) return "store.nearest";
  if (CALL_PATTERNS.some((p) => p.test(lower))) return "store.call";
  if (LOOKUP_PATTERNS.some((p) => p.test(lower))) return "store.lookup";
  if (STATE_LIST_PATTERNS.some((p) => p.test(lower))) return "store.list_state";
  if (/\bstores?\s+(?:in|across)\s+(california|nevada|arizona|texas|ca|nv|az|tx)\b/i.test(lower)) {
    return "store.list_state";
  }
  if (/\b(?:show|all)\b[\s\S]{0,20}\b(california|nevada|arizona|texas|ca|nv|az|tx)\b[\s\S]{0,20}\bstores?\b/i.test(lower)) {
    return "store.list_state";
  }

  const cityMatch = CITY_LIST_PATTERNS.find((p) => p.test(lower));
  if (cityMatch) {
    const m = lower.match(cityMatch);
    const city = m?.[1]?.trim();
    if (city && !/\b(california|nevada|arizona|texas)\b/.test(city)) {
      return "store.list_city";
    }
  }

  if (ALL_STORES_PATTERNS.some((p) => p.test(lower))) return "store.list_all";

  if (MALL_HINT.test(lower)) return "store.lookup";

  return "store.list_all";
}

function extractStateFromMessage(message: string): string | null {
  const lower = message.toLowerCase();
  const states = ["california", "nevada", "arizona", "texas", "ca", "nv", "az", "tx"];
  for (const st of states) {
    if (new RegExp(`\\b${st}\\b`).test(lower)) return st;
  }
  return null;
}

export function answerStoreQuery(message: string): { markdown: string; intent: StoreIntent } {
  const intent = classifyStoreIntent(message) ?? "store.list_all";

  switch (intent) {
    case "store.nearest": {
      const phrase = extractStoreQueryPhrase(message);
      const result = findNearestStore({ storeName: phrase, limit: 3 });
      return { markdown: result.message, intent };
    }

    case "store.list_state": {
      const state = extractStateFromMessage(message) ?? "";
      const stores = getStoresByState(state);
      const label = state ? state.charAt(0).toUpperCase() + state.slice(1) : "state";
      return {
        markdown: formatStoreListMarkdown(stores, `Valliani stores in ${label}`),
        intent,
      };
    }

    case "store.list_city": {
      const phrase = extractStoreQueryPhrase(message);
      const stores = getStoresByCity(phrase);
      return {
        markdown: formatStoreListMarkdown(stores, `Valliani stores near ${phrase}`),
        intent,
      };
    }

    case "store.call": {
      const phrase = extractStoreQueryPhrase(message);
      const matches = searchStores(phrase);
      if (matches.length === 0) {
        return {
          markdown: `I couldn't find **${phrase}** in the synced store directory. Check spelling or run \`npm run stores:sync\`.`,
          intent,
        };
      }
      const store = matches[0];
      if (!store.phone) {
        return {
          markdown: `**${store.mall}** is listed, but **phone number is not available** in the synced directory.`,
          intent,
        };
      }
      return {
        markdown: `**${store.mall}** (${store.city}, ${store.stateCode})\n\n📞 **${store.phone}**${store.address ? `\n📍 ${store.address}` : ""}`,
        intent,
      };
    }

    case "store.lookup": {
      const phrase = extractStoreQueryPhrase(message);
      const matches = searchStores(phrase);
      if (matches.length === 0) {
        return {
          markdown: `No store matching **${phrase}** in the synced directory. Source: [Find Your Location](${STORE_SOURCE_URL}).`,
          intent,
        };
      }
      if (matches.length === 1) {
        return { markdown: formatStoreEntry(matches[0]), intent };
      }
      return {
        markdown: formatStoreListMarkdown(matches, `Stores matching "${phrase}"`),
        intent,
      };
    }

    case "store.list_all":
    default: {
      const stores = getAllStores();
      const open = stores.filter((s) => String(s.status).toLowerCase() === "open").length;
      const soon = stores.filter((s) => /opening[_\s]?soon/i.test(String(s.status))).length;
      return {
        markdown: formatStoreListMarkdown(
          stores,
          `Valliani Jewelers — ${stores.length} locations (${open} open${soon ? `, ${soon} opening soon` : ""})`
        ),
        intent: "store.list_all",
      };
    }
  }
}

export function buildFindNearestStoreToolResult(args: {
  storeName?: string;
  city?: string;
  state?: string;
  limit?: number;
}): Record<string, unknown> {
  const result = findNearestStore(args);
  return {
    ok: result.ok,
    message: result.message,
    needsGeocoding: result.needsGeocoding,
    missingFields: result.missingFields,
    sourceStore: result.sourceStore
      ? {
          id: result.sourceStore.id,
          name: result.sourceStore.name,
          mall: result.sourceStore.mall,
          city: result.sourceStore.city,
          stateCode: result.sourceStore.stateCode,
          latitude: result.sourceStore.latitude,
          longitude: result.sourceStore.longitude,
        }
      : null,
    nearestStores: (result.nearestStores ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      city: n.city,
      stateCode: n.stateCode,
      distanceMiles: n.distanceMiles,
      phone: n.phone,
      address: n.address,
    })),
  };
}

export { normalizeQuery };

export function findStore(query: string): StoreDirectoryEntry | null {
  return searchStores(query)[0] ?? null;
}

export function findNearestStore(input: {
  storeName?: string;
  city?: string;
  state?: string;
  limit?: number;
}): {
  ok: boolean;
  sourceStore?: StoreDirectoryEntry;
  nearestStores?: Array<{
    id: string;
    name: string;
    city: string | null;
    stateCode: string;
    address: string | null;
    phone: string | null;
    distanceMiles?: number;
  }>;
  message: string;
  needsGeocoding?: boolean;
  missingFields?: string[];
} {
  const result = findNearestStoreCore(input);
  if (result.ok && result.sourceStore) {
    return {
      ok: true,
      sourceStore: result.sourceStore,
      nearestStores: result.nearest.map((n) => ({
        id: n.store.id,
        name: n.store.name,
        city: n.store.city ?? null,
        stateCode: n.store.stateCode,
        address: n.store.address,
        phone: n.store.phone,
        distanceMiles: n.distanceMiles,
      })),
      message: result.message,
      needsGeocoding: false,
      missingFields: [],
    };
  }

  if (result.sourceStore && result.needsGeocoding) {
    const source = result.sourceStore;
    const peers = getAllStores()
      .filter((s) => s.id !== source.id)
      .filter((s) => (source.city && s.city === source.city) || s.region === source.region)
      .slice(0, 3);
    const fallback = peers.length
      ? ` Based on city/region, likely nearby branches include ${peers.map((p) => p.mall).join(", ")}. (Not distance-calculated.)`
      : "";
    return {
      ok: false,
      sourceStore: source,
      nearestStores: peers.map((p) => ({
        id: p.id,
        name: p.name,
        city: p.city ?? null,
        stateCode: p.stateCode,
        address: p.address,
        phone: p.phone,
      })),
      message:
        "I have the store addresses, but coordinates are not geocoded yet, so I can’t calculate exact distance." +
        fallback,
      needsGeocoding: true,
      missingFields: ["latitude/longitude"],
    };
  }

  return { ok: false, message: result.message, needsGeocoding: result.needsGeocoding, missingFields: [] };
}

export function findStoresNearCity(input: {
  city: string;
  state?: string;
  limit?: number;
}): {
  ok: boolean;
  city: string;
  stores: Array<{ id: string; name: string; city: string | null; stateCode: string; address: string | null; phone: string | null }>;
  message: string;
} {
  const candidates = getStoresByCity(input.city).filter((s) =>
    input.state ? normalizeQuery(`${s.state} ${s.stateCode}`) === normalizeQuery(input.state) : true
  );
  const limit = Math.max(1, input.limit ?? 5);
  if (!candidates.length) {
    return { ok: false, city: input.city, stores: [], message: `No Valliani stores found near ${input.city}.` };
  }
  return {
    ok: true,
    city: input.city,
    stores: candidates.slice(0, limit).map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city ?? null,
      stateCode: s.stateCode,
      address: s.address,
      phone: s.phone,
    })),
    message: formatStoreListMarkdown(candidates.slice(0, limit), `Valliani stores near ${input.city}`),
  };
}

export function getStoreDetails(input: {
  storeName?: string;
  city?: string;
  id?: string;
}): { ok: boolean; store?: StoreDirectoryEntry; message: string } {
  const store =
    (input.id ? getStoreById(input.id) : undefined) ??
    (input.storeName ? searchStores(input.storeName)[0] : undefined) ??
    (input.city ? getStoresByCity(input.city)[0] : undefined);
  if (!store) return { ok: false, message: "I couldn't find that store in the official directory." };
  return { ok: true, store, message: formatStoreEntry(store) };
}

export function listStores(input: {
  state?: string;
  city?: string;
  region?: string;
  status?: string;
}): { ok: boolean; stores: StoreDirectoryEntry[]; message: string } {
  let stores = getAllStores();
  if (input.state) stores = getStoresByState(input.state);
  if (input.city) stores = stores.filter((s) => normalizeQuery(s.city ?? "").includes(normalizeQuery(input.city ?? "")));
  if (input.region) stores = stores.filter((s) => normalizeQuery(s.region ?? "").includes(normalizeQuery(input.region ?? "")));
  if (input.status) stores = stores.filter((s) => normalizeQuery(s.status).includes(normalizeQuery(input.status ?? "")));
  const title = input.state
    ? `Valliani stores in ${input.state}`
    : input.city
      ? `Valliani stores near ${input.city}`
      : input.region
        ? `Valliani stores in ${input.region}`
        : "Valliani store directory";
  return { ok: stores.length > 0, stores, message: formatStoreListMarkdown(stores, title) };
}
