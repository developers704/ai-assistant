/**
 * Sync Valliani store directory from the official Find Your Location page.
 *
 * Run: npm run stores:sync
 *
 * Optional: GOOGLE_MAPS_API_KEY in .env.local for geocoding missing coordinates.
 */
import fs from "fs";
import path from "path";
import {
  buildAliases,
  buildStoreId,
  extractCoordsFromMapUrl,
  parseAddressParts,
  parseStoreLocatorPage,
  stateName,
  stateTimezone,
} from "../src/lib/stores/parse-store-page";
import {
  computeNearestStores,
  GEOCODE_CACHE_PATH,
  STORE_DIRECTORY_PATH,
  STORE_SOURCE_URL,
} from "../src/lib/stores/store-directory";
import type { StoreDirectoryEntry, StoreDirectoryFile } from "../src/lib/stores/types";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function loadGeocodeCache(): Record<string, { lat: number; lng: number } | null> {
  if (!fs.existsSync(GEOCODE_CACHE_PATH)) return {};
  return JSON.parse(fs.readFileSync(GEOCODE_CACHE_PATH, "utf-8")) as Record<
    string,
    { lat: number; lng: number } | null
  >;
}

function saveGeocodeCache(cache: Record<string, { lat: number; lng: number } | null>): void {
  fs.mkdirSync(path.dirname(GEOCODE_CACHE_PATH), { recursive: true });
  fs.writeFileSync(GEOCODE_CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

async function geocodeAddress(
  address: string,
  apiKey: string,
  cache: Record<string, { lat: number; lng: number } | null>
): Promise<{ lat: number; lng: number } | null> {
  const key = address.trim().toLowerCase();
  if (key in cache) return cache[key];

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };
    if (data.status === "OK" && data.results?.[0]) {
      const { lat, lng } = data.results[0].geometry.location;
      cache[key] = { lat, lng };
      return cache[key];
    }
    cache[key] = null;
    return null;
  } catch {
    cache[key] = null;
    return null;
  }
}

function buildAppleMapsUrl(lat: number, lng: number, label: string): string {
  return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(label)}`;
}

async function fetchStorePage(): Promise<string> {
  const res = await fetch(STORE_SOURCE_URL, {
    headers: {
      "User-Agent": "LindyStoreSync/1.0 (+https://vallianijewelers.com)",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch store page: HTTP ${res.status}`);
  }
  return res.text();
}

async function main(): Promise<void> {
  loadEnvLocal();
  const now = new Date().toISOString();
  console.log(`Fetching ${STORE_SOURCE_URL}...`);

  const html = await fetchStorePage();
  const cards = parseStoreLocatorPage(html);
  console.log(`Parsed ${cards.length} store cards.`);

  if (cards.length === 0) {
    throw new Error("No stores parsed — page structure may have changed.");
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const geocodeCache = loadGeocodeCache();

  const entries: StoreDirectoryEntry[] = [];

  for (const card of cards) {
    const parts = parseAddressParts(card.address);
    const coords = extractCoordsFromMapUrl(card.googleMapsUrl);
    let latitude = coords?.latitude ?? null;
    let longitude = coords?.longitude ?? null;
    let needsGeocoding = false;

    if (latitude == null || longitude == null) {
      needsGeocoding = true;
      if (apiKey && card.address) {
        const geocoded = await geocodeAddress(card.address, apiKey, geocodeCache);
        if (geocoded) {
          latitude = geocoded.lat;
          longitude = geocoded.lng;
          needsGeocoding = false;
          console.log(`  Geocoded: ${card.mall}`);
        }
      }
    }

    const stateCode = parts.stateCode || "CA";
    const entry: StoreDirectoryEntry = {
      id: buildStoreId(card.mall, parts.city || card.mall, stateCode, card.index),
      name: card.name,
      mall: card.mall,
      city: parts.city,
      state: stateName(stateCode),
      stateCode,
      country: "USA",
      status: card.status,
      address: card.address || null,
      zipCode: parts.zipCode,
      latitude,
      longitude,
      ...(needsGeocoding ? { needsGeocoding: true } : {}),
      phone: card.phone,
      email: card.email,
      manager: null,
      region: stateName(stateCode),
      timezone: stateTimezone(stateCode),
      openingHours: card.hours,
      services: null,
      aliases: buildAliases(card.name, card.mall, parts.city, card.searchText),
      googleMapsUrl: card.googleMapsUrl,
      appleMapsUrl:
        latitude != null && longitude != null
          ? buildAppleMapsUrl(latitude, longitude, card.name)
          : null,
      storeUrl: null,
      nearestStores: [],
      sourceUrl: STORE_SOURCE_URL,
      lastSyncedAt: now,
    };

    entries.push(entry);
  }

  if (apiKey) {
    saveGeocodeCache(geocodeCache);
    console.log(`Geocode cache updated (${Object.keys(geocodeCache).length} entries).`);
  }

  const withNearest = computeNearestStores(entries, 3);

  const output: StoreDirectoryFile = {
    sourceUrl: STORE_SOURCE_URL,
    lastSyncedAt: now,
    storeCount: withNearest.length,
    stores: withNearest,
  };

  fs.mkdirSync(path.dirname(STORE_DIRECTORY_PATH), { recursive: true });
  fs.writeFileSync(STORE_DIRECTORY_PATH, JSON.stringify(output, null, 2), "utf-8");

  const geocoded = withNearest.filter((s) => s.latitude != null).length;
  const needsGeo = withNearest.filter((s) => s.needsGeocoding).length;

  console.log(`\nWrote ${STORE_DIRECTORY_PATH}`);
  console.log(`  Stores: ${output.storeCount}`);
  console.log(`  With coordinates: ${geocoded}`);
  console.log(`  Needs geocoding: ${needsGeo}`);
  if (needsGeo > 0 && !apiKey) {
    console.log(`  Tip: set GOOGLE_MAPS_API_KEY to geocode ${needsGeo} missing locations.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
