import type { SessionPayload } from "@/lib/auth/session-token";

function normStore(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ");
}

/**
 * Intersect client-requested stores with the signed-in user's allowed list.
 * Admin → passthrough (null allowed = no restriction).
 * DM with empty/invalid request → force their full store list.
 */
export function scopeStoresForUser(
  session: SessionPayload | null,
  requested: string[]
): { stores: string[] | undefined; forbidden: boolean } {
  if (!session) {
    return { stores: undefined, forbidden: true };
  }

  const allowed = session.storeCodes;
  if (allowed == null) {
    // admin
    return { stores: requested.length ? requested : undefined, forbidden: false };
  }

  const allowedNorm = new Map(allowed.map((c) => [normStore(c), c]));
  if (!requested.length) {
    return { stores: [...allowed], forbidden: false };
  }

  const scoped: string[] = [];
  for (const r of requested) {
    const hit = allowedNorm.get(normStore(r));
    if (hit) scoped.push(hit);
  }

  if (!scoped.length) {
    // Requested only foreign stores — force district list (don't leak empty = all)
    return { stores: [...allowed], forbidden: false };
  }

  return { stores: scoped, forbidden: false };
}

export function filterAvailableStores(
  session: SessionPayload | null,
  available: string[]
): string[] {
  if (!session || session.storeCodes == null) return available;
  const allowed = new Set(session.storeCodes.map(normStore));
  return available.filter((s) => allowed.has(normStore(s)));
}

export function storeAllowedForSession(
  session: SessionPayload | null,
  storeCode: string
): boolean {
  if (!session) return false;
  if (session.storeCodes == null) return true;
  const n = normStore(storeCode);
  return session.storeCodes.some((c) => normStore(c) === n);
}

/** Match a directory store to DM codes via storeCode, aliases, or exact name. */
export function directoryStoreAllowedForSession(
  session: SessionPayload | null,
  store: {
    storeCode?: string | null;
    name?: string | null;
    aliases?: string[] | null;
  }
): boolean {
  if (!session) return false;
  if (session.storeCodes == null) return true;

  const allowed = new Set(session.storeCodes.map(normStore));
  if (store.storeCode && allowed.has(normStore(store.storeCode))) return true;

  for (const alias of store.aliases ?? []) {
    if (allowed.has(normStore(alias))) return true;
  }

  const name = normStore(store.name ?? "");
  for (const code of allowed) {
    if (name === code || name.includes(code)) return true;
  }
  return false;
}

export function filterDirectoryStoresForSession<
  T extends {
    storeCode?: string | null;
    name?: string | null;
    aliases?: string[] | null;
  },
>(session: SessionPayload | null, stores: T[]): T[] {
  if (!session || session.storeCodes == null) return stores;
  return stores.filter((s) => directoryStoreAllowedForSession(session, s));
}
