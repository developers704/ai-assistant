import { resolveApprover, type ApproverEntry } from "@/lib/discounting/approvers";
import { loadApprovers } from "@/lib/discounting/approvers";

/**
 * When APP is missing on a sale, attribute DM (or Rozina) by store territory.
 * Serra / Serramonte → AJ (Akber Jivani).
 */

/** Explicit store token → approver code (checked before suffix inference). */
const EXPLICIT_STORE_OWNER: Record<string, string> = {
  SERRA: "AJ",
  SERRAMONTE: "AJ",
  VIS: "RK",
};

function storeTokens(store: string): string[] {
  const u = store.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ");
  const parts = u.split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    out.add(p);
    // VJSERRA glued → also try SERRA if prefix looks like store brand
    if (p.startsWith("VJ") && p.length > 2) out.add(p.slice(2));
    if (p.startsWith("DBC") && p.length > 3) out.add(p.slice(3));
  }
  return [...out];
}

/** Build BAKER → AJ from codes like AJ-BAKER / AV-RENO / SM-HEND. */
function suffixOwnerMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const code of loadApprovers().keys()) {
    const dash = code.indexOf("-");
    if (dash <= 0) continue;
    const prefix = code.slice(0, dash);
    const suffix = code.slice(dash + 1);
    if (!suffix || suffix.length < 2) continue;
    const owner =
      prefix === "AJ" || prefix === "AJ1"
        ? "AJ"
        : prefix === "AV" || prefix.startsWith("AV")
          ? "AV"
          : prefix === "SM" || prefix.startsWith("SM") || prefix === "SHAUN"
            ? "SM2"
            : prefix === "RK" || prefix === "RK1"
              ? "RK"
              : null;
    if (!owner) continue;
    if (!map.has(suffix)) map.set(suffix, owner);
  }
  return map;
}

let cachedSuffix: Map<string, string> | null = null;

/**
 * Resolve store → AJ / Adeel / Shaun / Rozina when APP memo is missing.
 * Unmapped stores → null (skip synthetic approver).
 */
export function resolveStoreDmOwner(store: string): ApproverEntry | null {
  if (!store?.trim()) return null;
  const tokens = storeTokens(store);
  for (const t of tokens) {
    const code = EXPLICIT_STORE_OWNER[t];
    if (code) return resolveApprover(code);
  }
  if (!cachedSuffix) cachedSuffix = suffixOwnerMap();
  for (const t of tokens) {
    const code = cachedSuffix.get(t);
    if (code) return resolveApprover(code);
  }
  return null;
}

/** Test helper — clear suffix cache after approver reload. */
export function clearStoreDmOwnerCache(): void {
  cachedSuffix = null;
}
