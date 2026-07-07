import type { StoreDirectoryEntry } from "@/lib/stores/types";

export function canCalculateDistance(store: StoreDirectoryEntry): boolean {
  return typeof store.latitude === "number" && typeof store.longitude === "number";
}

export function haversineMiles(
  a: Pick<StoreDirectoryEntry, "latitude" | "longitude">,
  b: Pick<StoreDirectoryEntry, "latitude" | "longitude">
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

export function sortStoresByDistance(
  source: StoreDirectoryEntry,
  stores: StoreDirectoryEntry[]
): Array<{ store: StoreDirectoryEntry; distanceMiles: number }> {
  const ranked = stores
    .filter((s) => s.id !== source.id)
    .map((s) => ({ store: s, distance: haversineMiles(source, s) }))
    .filter((x): x is { store: StoreDirectoryEntry; distance: number } => x.distance != null)
    .sort((a, b) => a.distance - b.distance);
  return ranked.map((x) => ({
    store: x.store,
    distanceMiles: Math.round(x.distance * 10) / 10,
  }));
}
