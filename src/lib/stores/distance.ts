import type { StoreDirectoryEntry } from "@/lib/stores/types";

export type LatLng = { latitude: number; longitude: number };

export function canCalculateDistance(store: StoreDirectoryEntry): boolean {
  return typeof store.latitude === "number" && typeof store.longitude === "number";
}

export function haversineMiles(
  a: Pick<StoreDirectoryEntry, "latitude" | "longitude"> | LatLng,
  b: Pick<StoreDirectoryEntry, "latitude" | "longitude"> | LatLng
): number | null {
  if (
    typeof a.latitude !== "number" ||
    typeof a.longitude !== "number" ||
    typeof b.latitude !== "number" ||
    typeof b.longitude !== "number"
  ) {
    return null;
  }
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

export function roundMiles(miles: number | null): number | null {
  if (miles == null || Number.isNaN(miles)) return null;
  return Math.round(miles * 10) / 10;
}

export function sortStoresByDistance(
  source: StoreDirectoryEntry | LatLng,
  stores: StoreDirectoryEntry[]
): Array<{ store: StoreDirectoryEntry; distanceMiles: number }> {
  const sourceId = "id" in source ? source.id : null;
  const ranked = stores
    .filter((s) => (sourceId ? s.id !== sourceId : true))
    .map((s) => ({ store: s, distance: haversineMiles(source, s) }))
    .filter((x): x is { store: StoreDirectoryEntry; distance: number } => x.distance != null)
    .sort((a, b) => a.distance - b.distance);
  return ranked.map((x) => ({
    store: x.store,
    distanceMiles: Math.round(x.distance * 10) / 10,
  }));
}
