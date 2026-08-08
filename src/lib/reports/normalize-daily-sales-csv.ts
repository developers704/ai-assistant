import Papa from "papaparse";
import { normalizeSalesImageDir } from "@/lib/reports/product-image";

function parseZeroAwareTotal(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/[$,]/g, "").replace(/\((.*)\)/, "-$1").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/** $0 Total APP/FINANCE/ITEM siblings — keep for Discounting package join. */
function isDiscountingMemoRow(
  fields: string[],
  keepIdx: number[],
  row: string[]
): boolean {
  const itemIdx = fields.findIndex(
    (f) => /^item\s*#?$/i.test(f) || /^sku\s*#?$/i.test(f)
  );
  const descIdx = fields.findIndex((f) => /^description$/i.test(f));
  const item =
    itemIdx >= 0 ? String(row[keepIdx[itemIdx]] ?? "").trim().toUpperCase() : "";
  const desc = descIdx >= 0 ? String(row[keepIdx[descIdx]] ?? "").trim() : "";
  if (item === "ITEM") return true;
  return /\bAPP\b|\bFIN\b|\bFINANCE\b|^APP\/|^FIN\//i.test(desc);
}

/**
 * Daily Umair sales export often has spacer empty columns between every field
 * (double commas in the header). Collapse those so Papa + merge work reliably.
 * Drop zero-total product rows, but keep $0 ITEM / APP / FINANCE memo lines for
 * Discounting (same Transaction # package). Force Image Dir. → .webp.
 */
export function normalizeDailySalesCsv(csvText: string): string {
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: "greedy",
  });
  const table = (parsed.data ?? []).filter(
    (row) => Array.isArray(row) && row.some((c) => String(c ?? "").trim())
  ) as string[][];
  if (table.length === 0) return csvText;

  const header = table[0].map((h) => String(h ?? "").trim());
  const keepIdx = header
    .map((h, i) => (h.length > 0 ? i : -1))
    .filter((i) => i >= 0);
  if (keepIdx.length === 0) return csvText;

  const fields = keepIdx.map((i) => header[i]);
  const imageIdx = fields.findIndex((f) => /^image\s*dir\.?$/i.test(f));
  const totalIdx = fields.findIndex(
    (f) => /^total$/i.test(f) || /^net\s*sales?$/i.test(f) || /^net\s*amt$/i.test(f)
  );

  const data = table
    .slice(1)
    .filter((row) => {
      if (totalIdx < 0) return true;
      const total = parseZeroAwareTotal(row[keepIdx[totalIdx]]);
      if (total == null) return true;
      if (total !== 0) return true;
      // Total === 0: only keep discounting package memos (not empty junk)
      return isDiscountingMemoRow(fields, keepIdx, row);
    })
    .map((row) =>
      keepIdx.map((i, col) => {
        const v = String(row[i] ?? "");
        if (col === imageIdx && v.trim()) return normalizeSalesImageDir(v);
        return v;
      })
    );

  return Papa.unparse({ fields, data });
}
