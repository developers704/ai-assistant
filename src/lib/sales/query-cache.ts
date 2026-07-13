import { createHash } from "crypto";
import { readActivePointer } from "@/lib/sales/data/version-store";

type CacheEntry = {
  dataVersion: string;
  expiresAt: number;
  value: unknown;
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export function salesQueryCacheKey(dataVersion: string, resolvedQuery: unknown): string {
  const h = createHash("sha256")
    .update(JSON.stringify({ dataVersion, resolvedQuery }))
    .digest("hex")
    .slice(0, 24);
  return `${dataVersion}:${h}`;
}

export function getSalesQueryCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  const active = readActivePointer().activeVersion;
  if (active && hit.dataVersion !== active) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setSalesQueryCache(key: string, dataVersion: string, value: unknown): void {
  cache.set(key, {
    dataVersion,
    value,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function invalidateSalesQueryCache(dataVersion?: string): void {
  if (!dataVersion) {
    cache.clear();
    return;
  }
  for (const [k, v] of cache.entries()) {
    if (v.dataVersion === dataVersion || k.startsWith(`${dataVersion}:`)) {
      cache.delete(k);
    }
  }
}
