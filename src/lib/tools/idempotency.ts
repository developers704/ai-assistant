const pending = new Map<string, { at: number; result?: unknown }>();
const TTL_MS = 10 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [k, v] of pending) {
    if (now - v.at > TTL_MS) pending.delete(k);
  }
}

/** Claim an idempotency key. Returns existing result if already completed. */
export function claimIdempotencyKey(key: string): {
  ok: boolean;
  existing?: unknown;
} {
  prune();
  const hit = pending.get(key);
  if (hit?.result !== undefined) {
    return { ok: false, existing: hit.result };
  }
  if (hit) {
    // In-flight — treat as duplicate
    return { ok: false, existing: hit.result ?? { ok: true, status: "success", tool: "duplicate", spokenAnswer: "Already handling that." } };
  }
  pending.set(key, { at: Date.now() });
  return { ok: true };
}

export function rememberIdempotencyResult(key: string, result: unknown): void {
  pending.set(key, { at: Date.now(), result });
}

export function clearIdempotencyKey(key: string): void {
  pending.delete(key);
}
