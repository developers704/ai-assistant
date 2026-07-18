export type VendorModelTextFilterMode = "include" | "exclude";

export function buildVendorModelSearchText(parts: {
  name?: string;
  vendorModel?: string;
  itemNumber?: string;
  sku?: string;
  skus?: { sku: string }[];
}): string {
  return [
    parts.name,
    parts.vendorModel,
    parts.itemNumber,
    parts.sku,
    ...(parts.skus?.map((s) => s.sku) ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split "uv, novello, ultimate value" into terms. */
export function parseVendorModelFilterTerms(query: string): string[] {
  return query
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Case-insensitive match; short tokens (≤3) use word boundaries (e.g. "uv"). */
export function textMatchesVendorModelQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const h = haystack.toLowerCase();
  if (q.length <= 3) {
    const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(q)}(?:$|[^a-z0-9])`, "i");
    return re.test(h);
  }
  return h.includes(q);
}

function textMatchesAnyTerm(haystack: string, terms: string[]): boolean {
  return terms.some((term) => textMatchesVendorModelQuery(haystack, term));
}

/**
 * Filter by description / model / SKU text.
 * Comma-separated terms: Show only = match any term; Hide = remove if any term matches.
 * Example hide: "uv, novello" or "ultimate value, novello"
 */
export function applyVendorModelTextFilter<T>(
  items: T[],
  getText: (item: T) => string,
  query: string,
  mode: VendorModelTextFilterMode
): T[] {
  const terms = parseVendorModelFilterTerms(query);
  if (!terms.length) return items;
  return items.filter((item) => {
    const hit = textMatchesAnyTerm(getText(item), terms);
    return mode === "include" ? hit : !hit;
  });
}
