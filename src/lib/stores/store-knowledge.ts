import { getStoreStats, mockStores } from "@/lib/mock-data";
import { getAllStores, isStoreDirectoryAvailable } from "@/lib/stores/store-directory";
import { buildStoreDistanceMatrixContext } from "@/lib/stores/store-distances";
import type { StoreLocation } from "@/types";

export type StoreRegion = "California" | "Nevada" | "Arizona" | "Texas";

const REGION_ORDER: StoreRegion[] = ["California", "Nevada", "Arizona", "Texas"];

const STATE_ALIASES: Record<string, StoreRegion> = {
  california: "California",
  calif: "California",
  ca: "California",
  nevada: "Nevada",
  nv: "Nevada",
  arizona: "Arizona",
  az: "Arizona",
  texas: "Texas",
  tx: "Texas",
};

export function isStoreLocationQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /(?:how many|count|total|number of|list|show|name|which|where).{0,40}(?:store|stores|location|locations|mall)/i.test(
      lower
    ) ||
    /(?:store|stores|location|locations|mall).{0,40}(?:how many|count|total|list|in\s+(?:california|nevada|arizona|texas|ca|nv|az|tx))/i.test(
      lower
    ) ||
    /(?:stores?\s+(?:in|across|does|do|kash|valliani|we|i)|our\s+stores?|my\s+stores?)/i.test(lower)
  );
}

export function detectStoreRegionQuery(message: string): StoreRegion | "all" | null {
  if (!isStoreLocationQuery(message)) return null;

  const lower = message.toLowerCase();
  for (const [alias, region] of Object.entries(STATE_ALIASES)) {
    if (new RegExp(`\\b${alias.replace(".", "\\.")}\\b`).test(lower)) {
      return region;
    }
  }

  return "all";
}

export function formatStoreLine(store: StoreLocation): string {
  const status = store.status === "opening_soon" ? " *(Opening soon)*" : "";
  return `• **${store.city}, ${store.state}** — ${store.mall}${status}`;
}

export function storesForRegion(region: StoreRegion): StoreLocation[] {
  return mockStores.filter((s) => s.region === region);
}

export function buildStoreListMarkdown(region: StoreRegion | "all" = "all"): string {
  const stats = getStoreStats();

  if (region !== "all") {
    const stores = storesForRegion(region);
    const open = stores.filter((s) => s.status === "open").length;
    const openingSoon = stores.filter((s) => s.status === "opening_soon").length;

    const lines = stores.map(formatStoreLine);
    const statusNote =
      openingSoon > 0
        ? ` (${open} open, ${openingSoon} opening soon)`
        : ` (${open} open)`;

    return `**${stores.length} Valliani Jewelers store${stores.length === 1 ? "" : "s"} in ${region}**${statusNote}

${lines.join("\n")}`;
  }

  const sections = REGION_ORDER.map((r) => {
    const stores = storesForRegion(r);
    if (stores.length === 0) return "";
    return `### ${r} (${stores.length})
${stores.map(formatStoreLine).join("\n")}`;
  }).filter(Boolean);

  return `**Valliani Jewelers has ${stats.total} store locations** (${stats.open} open, ${stats.openingSoon} opening soon)

**By state:** California ${stats.byRegion.California} · Nevada ${stats.byRegion.Nevada} · Arizona ${stats.byRegion.Arizona} · Texas ${stats.byRegion.Texas}

${sections.join("\n\n")}`;
}

/** Full store directory for LLM live context (compact) + pairwise distances. */
export function buildStoreDirectoryContext(): string {
  if (isStoreDirectoryAvailable()) {
    const stores = getAllStores();
    const open = stores.filter((s) => String(s.status).toLowerCase() === "open").length;
    const soon = stores.filter((s) => String(s.status).toLowerCase() === "opening soon").length;
    const byState = stores.reduce(
      (acc, s) => {
        acc[s.stateCode] = (acc[s.stateCode] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return `Store directory summary: ${stores.length} total locations from official store JSON.
States: CA=${byState.CA ?? 0}, NV=${byState.NV ?? 0}, AZ=${byState.AZ ?? 0}, TX=${byState.TX ?? 0}.
Status: ${open} open, ${soon} opening soon.
For address/phone/hours use get_valliani_store_details / list_valliani_stores / get_store_directory.
For nearest or any pair distance use find_nearest_store / get_store_distance — never invent km.

${buildStoreDistanceMatrixContext()}`;
  }

  const stats = getStoreStats();
  const lines = REGION_ORDER.flatMap((region) => {
    const stores = storesForRegion(region);
    return stores.map(
      (s) =>
        `- ${s.city}, ${s.state} | ${s.mall} | ${s.region} | ${s.status === "opening_soon" ? "opening_soon" : "open"}`
    );
  });

  return `Total: ${stats.total} locations (${stats.open} open, ${stats.openingSoon} opening soon)
Counts: CA=${stats.byRegion.California}, NV=${stats.byRegion.Nevada}, AZ=${stats.byRegion.Arizona}, TX=${stats.byRegion.Texas}
${lines.join("\n")}`;
}

export function buildStoreVoiceScript(region: StoreRegion | "all" = "all"): string {
  const stats = getStoreStats();

  if (region !== "all") {
    const stores = storesForRegion(region);
    const names = stores
      .slice(0, 8)
      .map((s) => `${s.city} at ${s.mall}`)
      .join("; ");
    const extra = stores.length > 8 ? ` and ${stores.length - 8} more` : "";
    return `${stores.length} stores in ${region}: ${names}${extra}.`;
  }

  return `Valliani has ${stats.total} stores total: ${stats.byRegion.California} in California, ${stats.byRegion.Nevada} in Nevada, ${stats.byRegion.Arizona} in Arizona, and ${stats.byRegion.Texas} in Texas. Open the Sales Dashboard for the full list.`;
}
