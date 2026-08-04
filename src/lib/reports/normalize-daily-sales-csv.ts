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

/**
 * Daily Umair sales export often has spacer empty columns between every field
 * (double commas in the header). Collapse those so Papa + merge work reliably.
 * Remove zero-total rows, force Image Dir. values to .webp, and keep the
 * canonical daily-sales shape for upload + append operations.
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

  const data = table.slice(1)
    .filter((row) => {
      if (totalIdx < 0) return true;
      const total = parseZeroAwareTotal(row[keepIdx[totalIdx]]);
      return total == null || total !== 0;
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
