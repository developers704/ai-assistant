import fs from "node:fs";
import path from "node:path";
import { getStoreById } from "@/lib/stores/store-directory";
import type { StoreDirectoryEntry } from "@/lib/stores/types";

const CACHE_PATH = path.join(process.cwd(), ".data", "stores", "google-details-cache.json");
const CACHE_TTL_MS = 1000 * 60 * 60 * 18;

type CacheRow = {
  storeId: string;
  fetchedAt: string;
  data: Record<string, unknown>;
};

function loadCache(): Record<string, CacheRow> {
  if (!fs.existsSync(CACHE_PATH)) return {};
  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as Record<string, CacheRow>;
}

function saveCache(cache: Record<string, CacheRow>): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function serverKey(): string | null {
  return process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || null;
}

function normalizeGoogleResponse(store: StoreDirectoryEntry, raw: Record<string, unknown>) {
  const hours = (raw.currentOpeningHours ?? raw.regularOpeningHours) as
    | { openNow?: boolean; weekdayDescriptions?: string[] }
    | undefined;
  const reviews = Array.isArray(raw.reviews) ? raw.reviews : [];
  return {
    ok: true,
    storeId: store.id,
    googlePlaceId: raw.id ?? raw.placeId ?? null,
    displayName:
      typeof (raw.displayName as { text?: string } | undefined)?.text === "string"
        ? (raw.displayName as { text: string }).text
        : store.name,
    formattedAddress: (raw.formattedAddress as string | undefined) ?? store.fullAddress ?? store.address,
    latitude:
      typeof (raw.location as { latitude?: number } | undefined)?.latitude === "number"
        ? (raw.location as { latitude: number }).latitude
        : store.latitude,
    longitude:
      typeof (raw.location as { longitude?: number } | undefined)?.longitude === "number"
        ? (raw.location as { longitude: number }).longitude
        : store.longitude,
    businessStatus: (raw.businessStatus as string | undefined) ?? null,
    openNow: typeof hours?.openNow === "boolean" ? hours.openNow : null,
    currentOpeningHours: hours?.weekdayDescriptions ?? null,
    regularOpeningHours:
      ((raw.regularOpeningHours as { weekdayDescriptions?: string[] } | undefined)?.weekdayDescriptions as
        | string[]
        | undefined) ?? null,
    phone:
      (raw.nationalPhoneNumber as string | undefined) ??
      (raw.internationalPhoneNumber as string | undefined) ??
      store.phone,
    rating: (raw.rating as number | undefined) ?? null,
    userRatingCount: (raw.userRatingCount as number | undefined) ?? null,
    reviews,
    googleMapsUri: (raw.googleMapsUri as string | undefined) ?? store.googleMapsUrl,
    websiteUri: (raw.websiteUri as string | undefined) ?? null,
    lastFetchedAt: new Date().toISOString(),
  };
}

async function fetchPlaceByText(query: string, key: string): Promise<string | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { places?: Array<{ id?: string }> };
  return data.places?.[0]?.id ?? null;
}

export async function getStoreGoogleDetails(storeId: string, forceRefresh = false) {
  const store = getStoreById(storeId);
  if (!store) {
    return { ok: false, message: `Store ${storeId} not found in local directory.`, fallbackStore: null };
  }

  const cache = loadCache();
  const cached = cache[storeId];
  if (!forceRefresh && cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return cached.data;
  }

  const key = serverKey();
  if (!key) {
    return {
      ok: false,
      storeId,
      message: "Google live store data is not connected yet, but I can show official local store data.",
      fallbackStore: store,
    };
  }

  let placeId = (store as { googlePlaceId?: string }).googlePlaceId ?? null;
  if (!placeId) {
    placeId = await fetchPlaceByText(
      `Valliani Jewelers ${store.fullAddress ?? store.address ?? ""}`,
      key
    );
  }
  if (!placeId) {
    return {
      ok: false,
      storeId,
      message: "Google place ID was not found. Returning local store data.",
      fallbackStore: store,
    };
  }

  const detailRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,businessStatus,currentOpeningHours,regularOpeningHours,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,reviews,googleMapsUri,websiteUri,photos",
    },
  });

  if (!detailRes.ok) {
    return {
      ok: false,
      storeId,
      message: `Google Places API failed (${detailRes.status}). Returning local store data.`,
      fallbackStore: store,
    };
  }

  const raw = (await detailRes.json()) as Record<string, unknown>;
  const normalized = normalizeGoogleResponse(store, raw);
  cache[storeId] = { storeId, fetchedAt: new Date().toISOString(), data: normalized };
  saveCache(cache);
  return normalized;
}

