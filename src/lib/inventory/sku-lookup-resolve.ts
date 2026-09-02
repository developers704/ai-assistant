/**
 * Price calculator / inventory lookup: POS Item #s often carry a letter suffix
 * (231611Y, 228777V, 231618S) while staff type the numeric core (231611).
 *
 * Whole-cost rules already match leading digits via skuCostKey(). Lookup must
 * do the same — exact SKU first, then a single letter-suffix variant.
 * Never treat a longer numeric SKU (2316110) as a match for 231611.
 */

export function normalizeLookupSku(sku: string): string {
  return sku.trim().toUpperCase();
}

/** True when the query is only the leading Item # digits (no S/Y/V suffix). */
export function isBareItemNumber(sku: string): boolean {
  return /^\d+$/.test(normalizeLookupSku(sku));
}

/**
 * A letter-suffix variant is the numeric core plus one or more letters
 * (optional extra alphanumerics / hyphens), e.g. 231611Y, 231611S, 231611Y-1.
 */
export function isLetterSuffixVariant(fullSku: string, bareItemNumber: string): boolean {
  const sku = normalizeLookupSku(fullSku);
  const core = normalizeLookupSku(bareItemNumber);
  if (!core || !sku.startsWith(core) || sku === core) return false;
  const rest = sku.slice(core.length);
  return /^[A-Z][A-Z0-9-]*$/.test(rest);
}

export type SkuVariantScore = {
  sku: string;
  onHand: number;
  tagPrice: number;
};

/** Prefer the variant with the most on-hand, then a tagged price, then SKU order. */
export function pickPreferredSkuVariant(variants: SkuVariantScore[]): string | null {
  if (!variants.length) return null;
  const ranked = [...variants].sort((a, b) => {
    if (b.onHand !== a.onHand) return b.onHand - a.onHand;
    const aHasTag = a.tagPrice > 0 ? 1 : 0;
    const bHasTag = b.tagPrice > 0 ? 1 : 0;
    if (bHasTag !== aHasTag) return bHasTag - aHasTag;
    if (b.tagPrice !== a.tagPrice) return b.tagPrice - a.tagPrice;
    return a.sku.localeCompare(b.sku);
  });
  return ranked[0]!.sku;
}

/**
 * Resolve a typed SKU against known inventory keys.
 * Exact match wins. Bare Item # falls back to one letter-suffix variant.
 */
export function resolveInventorySkuKey(
  query: string,
  knownSkus: Iterable<string>,
  scoreForSku: (sku: string) => Omit<SkuVariantScore, "sku">
): string | null {
  const key = normalizeLookupSku(query);
  if (!key) return null;

  const bySku = new Set<string>();
  for (const sku of knownSkus) {
    const normalized = normalizeLookupSku(sku);
    if (normalized) bySku.add(normalized);
  }

  if (bySku.has(key)) return key;
  if (!isBareItemNumber(key)) return null;

  const variants: SkuVariantScore[] = [];
  for (const sku of bySku) {
    if (!isLetterSuffixVariant(sku, key)) continue;
    const score = scoreForSku(sku);
    variants.push({ sku, onHand: score.onHand, tagPrice: score.tagPrice });
  }
  return pickPreferredSkuVariant(variants);
}
