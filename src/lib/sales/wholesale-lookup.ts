/**
 * Wholesale cost lookup from the live sales report (for DM Cost Price in calculator).
 * Cached by seed CSV mtime — not rebuilt every request.
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { parseVendorPosRows } from "@/lib/reports/vendor-pos";
import { filterExcludedSalesRows } from "@/lib/utils";
import { getLatestReportMeta, readReportCsv } from "@/lib/reports/store";

type WholesaleCache = {
  bySku: Map<string, number>;
  fingerprint: string;
};

let cache: WholesaleCache | null = null;

function seedFingerprint(): string {
  const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
  try {
    const st = fs.statSync(seedPath);
    return `seed:${st.mtimeMs}:${st.size}`;
  } catch {
    const meta = getLatestReportMeta();
    return meta ? `report:${meta.id}:${meta.contentHash ?? meta.rowCount}` : "none";
  }
}

function loadWholesaleBySku(): Map<string, number> {
  const fingerprint = seedFingerprint();
  if (cache && cache.fingerprint === fingerprint) return cache.bySku;

  const bySku = new Map<string, number>();

  const meta = getLatestReportMeta();
  let csv: string | null = null;
  if (meta) csv = readReportCsv(meta.id);
  if (!csv) {
    const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
    if (fs.existsSync(seedPath)) csv = fs.readFileSync(seedPath, "utf-8");
  }
  if (!csv) {
    cache = { bySku, fingerprint };
    return bySku;
  }

  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = filterExcludedSalesRows(parseVendorPosRows(parsed.data ?? []).rows);

  // Prefer newest sale with wholesale > 0 for each SKU / item / vendor model key.
  const dated = [...rows].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  for (const r of dated) {
    const ws = Number(r.wholesaleCost) || 0;
    if (!(ws > 0)) continue;
    for (const key of [r.sku, r.itemNumber, r.vendorModel]) {
      const k = (key || "").trim().toUpperCase();
      if (!k || bySku.has(k)) continue;
      bySku.set(k, ws);
    }
  }

  cache = { bySku, fingerprint };
  return bySku;
}

/** Latest known wholesale cost for a SKU / item / vendor model, or null. */
export function lookupWholesaleCost(sku: string): number | null {
  const key = sku.trim().toUpperCase();
  if (!key) return null;
  const map = loadWholesaleBySku();
  const hit = map.get(key);
  return hit != null && hit > 0 ? hit : null;
}
