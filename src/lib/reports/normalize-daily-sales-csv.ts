import Papa from "papaparse";
import { normalizeSalesImageDir } from "@/lib/reports/product-image";

/**
 * Daily Umair sales export often has spacer empty columns between every field
 * (double commas in the header). Collapse those so Papa + merge work reliably.
 * Also force Image Dir. values to .webp.
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

  const data = table.slice(1).map((row) =>
    keepIdx.map((i, col) => {
      const v = String(row[i] ?? "");
      if (col === imageIdx && v.trim()) return normalizeSalesImageDir(v);
      return v;
    })
  );

  return Papa.unparse({ fields, data });
}
