/**
 * HR Management → Sales design labels and UV bucket.
 * Sales Dashboard keeps POS Design names unchanged.
 */
import type { VendorPosRow } from "@/lib/reports/types";

export const HR_UV_DESIGN = "UV";
export const HR_ETERNAL_VOW_DESIGN = "Eternal-vow";
export const HR_LOVE_DESIGN = "Lovespell";
export const HR_BELLA_DESIGN = "BELLA OVANI";

/** POS Vendor Name codes that count as UV vendors in HR Sales. */
const HR_UV_VENDORS = new Set(["OX", "VSU", "TRCO", "TORCO"]);

export function isHrUvVendor(vendor: string | null | undefined): boolean {
  return HR_UV_VENDORS.has(String(vendor ?? "").trim().toUpperCase());
}

/** Item description has UV or ultimate (covers "ultimate value"). */
export function descriptionLooksUvOrUltimate(description: string | null | undefined): boolean {
  const desc = String(description ?? "");
  return /\buv\b/i.test(desc) || /ultimate/i.test(desc);
}

/**
 * HR-only UV sale: description UV / ultimate AND vendor OX, VSU, or TORCO/TRCO.
 */
export function isHrUvSalesRow(row: {
  description?: string | null;
  vendor?: string | null;
}): boolean {
  return isHrUvVendor(row.vendor) && descriptionLooksUvOrUltimate(row.description);
}

/** POS Class filter value ETERNAL-VOW (not ETERNITY). */
export function isHrEternalVowClass(productClass: string | null | undefined): boolean {
  const compact = String(productClass ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "-");
  return compact === "ETERNAL-VOW";
}

/** POS Design → HR display name (Love → Lovespell, BELLA OVAN → BELLA OVANI). */
export function displayHrPosDesign(design: string | null | undefined): string {
  const raw = String(design ?? "").trim();
  if (!raw) return "Unknown design";
  const compact = raw.toUpperCase().replace(/\s+/g, " ");
  if (compact === "LOVE") return HR_LOVE_DESIGN;
  if (compact === "BELLA OVAN") return HR_BELLA_DESIGN;
  return raw;
}

/** Design bucket for HR Sales grouping / filter. UV, then Eternal-vow class, else POS Design. */
export function hrSalesDesignName(row: {
  design?: string | null;
  description?: string | null;
  vendor?: string | null;
  productClass?: string | null;
  class?: string | null;
}): string {
  if (isHrUvSalesRow(row)) return HR_UV_DESIGN;
  if (isHrEternalVowClass(row.productClass ?? row.class)) return HR_ETERNAL_VOW_DESIGN;
  return displayHrPosDesign(row.design);
}

/** Copy-on-write remap so cached POS rows stay unchanged. */
export function applyHrSalesDesigns(rows: VendorPosRow[]): VendorPosRow[] {
  return rows.map((r) => {
    const next = hrSalesDesignName(r);
    const cur = (r.design || "").trim() || "Unknown design";
    if (next === cur || (next === "Unknown design" && !r.design?.trim())) return r;
    return { ...r, design: next };
  });
}

/** Design filter dropdown: rename Love / BELLA OVAN and add UV + Eternal-vow. */
export function remapHrAvailableDesigns(designs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const d of designs) {
    const name = displayHrPosDesign(d);
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  if (!seen.has("uv")) out.push(HR_UV_DESIGN);
  if (!seen.has("eternal-vow")) out.push(HR_ETERNAL_VOW_DESIGN);
  return out;
}
