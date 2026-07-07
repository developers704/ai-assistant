/**
 * One-time geocoding helper for Valliani store directory.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=your_key npx tsx scripts/geocode-store-directory.ts
 *
 * Input:
 *   data/knowledge/valliani/store-directory.json
 *
 * Output:
 *   Updates latitude/longitude and nearestStores.
 */

import fs from "node:fs";
import path from "node:path";

const STORE_FILE = path.join(process.cwd(), "data/knowledge/valliani/store-directory.json");
const CACHE_FILE = path.join(process.cwd(), ".data/stores/geocode-cache.json");

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

type Store = {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number | null;
  longitude: number | null;
  needsGeocoding?: boolean;
  geocodingQuery?: string;
  nearestStores?: Array<{ id: string; name: string; distanceMiles: number }>;
};

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function haversineMiles(a: Store, b: Store): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const R = 3958.7613;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function geocode(query: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const json = await res.json();

  if (json.status !== "OK" || !json.results?.[0]?.geometry?.location) {
    return null;
  }

  const loc = json.results[0].geometry.location;
  return {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: json.results[0].formatted_address,
    placeId: json.results[0].place_id,
  };
}

async function main() {
  loadEnvLocal();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required.");
  }

  const directory = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  const stores: Store[] = directory.stores;

  ensureDir(CACHE_FILE);
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
    : {};

  for (const store of stores) {
    if (store.latitude != null && store.longitude != null) continue;

    const query = store.geocodingQuery || `Valliani Jewelers ${store.fullAddress}`;
    if (!cache[query]) {
      console.log(`Geocoding ${store.name}: ${query}`);
      cache[query] = await geocode(query, apiKey);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      await new Promise((r) => setTimeout(r, 150));
    }

    const result = cache[query];
    if (result?.lat != null && result?.lng != null) {
      store.latitude = result.lat;
      store.longitude = result.lng;
      store.needsGeocoding = false;
      (store as any).geocodedAddress = result.formattedAddress;
      (store as any).googlePlaceId = result.placeId;
    }
  }

  for (const store of stores) {
    const nearest = stores
      .filter((other) => other.id !== store.id)
      .map((other) => ({
        id: other.id,
        name: other.name,
        distanceMiles: haversineMiles(store, other),
      }))
      .filter((x) => x.distanceMiles != null)
      .sort((a, b) => (a.distanceMiles! - b.distanceMiles!))
      .slice(0, 5)
      .map((x) => ({
        id: x.id,
        name: x.name,
        distanceMiles: Math.round((x.distanceMiles as number) * 10) / 10,
      }));

    store.nearestStores = nearest;
  }

  directory.generatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_FILE, JSON.stringify(directory, null, 2));
  console.log(`Updated ${STORE_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
