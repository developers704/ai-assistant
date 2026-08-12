/**
 * Collapse empty spacer columns in onhand exports, ensure Whole Cost column,
 * and fill Whole Cost from Tag (Individual Selling Value) × CP Divisor rules.
 */
import Papa from "papaparse";
import { resolveWholeCostFromRules } from "@/lib/inventory/whole-cost-rules";

export type OnhandNormalizeStats = {
  total: number;
  matched: number;
  written: number;
  unchanged: number;
  noRule: number;
  byRule: Record<string, number>;
};

function parseAmount(value: unknown): number | null {
  const n = Number(String(value ?? "").replace(/[$,\s]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function formatWholeCost(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(2);
}

function isBlankWholeCost(value: unknown): boolean {
  return !String(value ?? "").trim();
}

function baseTagPrice(row: Record<string, string>): number | null {
  const tag =
    parseAmount(row["Individual Selling Value"]) ??
    parseAmount(row["Tag Price"]) ??
    parseAmount(row.Tag);
  if (tag != null && tag > 0) return tag;
  return null;
}

/** Collapse blank header columns (Umair onhand often has ,, spacers). */
export function collapseEmptyOnhandColumns(csvText: string): string {
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: "greedy",
  });
  const table = (parsed.data ?? []).filter(
    (row) => Array.isArray(row) && row.some((c) => String(c ?? "").trim())
  ) as string[][];
  if (table.length === 0) return csvText;

  const header = table[0].map((h) => String(h ?? "").trim());
  const keepIdx = header.map((h, i) => (h.length > 0 ? i : -1)).filter((i) => i >= 0);
  if (keepIdx.length === 0) return csvText;

  const fields = keepIdx.map((i) => header[i]);
  const data = table.slice(1).map((row) => keepIdx.map((i) => String(row[i] ?? "")));
  return Papa.unparse({ fields, data });
}

/**
 * Normalize onhand CSV + fill / overwrite Whole Cost from Tag × rules.
 * Pass blankOnly=true to only fill empty Whole Cost cells.
 */
export function normalizeAndFillOnhandCsv(
  csvText: string,
  opts?: { blankOnly?: boolean }
): { csv: string; stats: OnhandNormalizeStats } {
  const blankOnly = opts?.blankOnly === true;
  const collapsed = collapseEmptyOnhandColumns(csvText);
  const parsed = Papa.parse<Record<string, string>>(collapsed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const fields = [...(parsed.meta.fields ?? [])];
  if (!fields.length) {
    return {
      csv: csvText,
      stats: { total: 0, matched: 0, written: 0, unchanged: 0, noRule: 0, byRule: {} },
    };
  }

  if (!fields.includes("Whole Cost")) fields.push("Whole Cost");

  const stats: OnhandNormalizeStats = {
    total: parsed.data.length,
    matched: 0,
    written: 0,
    unchanged: 0,
    noRule: 0,
    byRule: {},
  };

  const rows = parsed.data.map((row) => {
    const out: Record<string, string> = { ...row };
    for (const f of fields) {
      if (out[f] === undefined) out[f] = "";
    }

    const existingBlank = isBlankWholeCost(out["Whole Cost"]);
    if (blankOnly && !existingBlank) {
      stats.unchanged++;
      return out;
    }

    const base = baseTagPrice(out);
    const skuField = Object.keys(out).find((k) => /^item\s*#$/i.test(k) || /^sku\s*#?$/i.test(k));
    const sku = skuField ? out[skuField] : undefined;
    const descField = Object.keys(out).find((k) => /^(item\s*desc|description)$/i.test(k));
    const hit = resolveWholeCostFromRules(
      {
        department: out.Department,
        design: out.Design,
        class: out.Class,
        subClass: out["Sub-Class"],
        description: descField ? out[descField] : out.Description,
        sku,
      },
      base ?? 0
    );

    if (!hit) {
      stats.noRule++;
      return out;
    }

    stats.matched++;
    stats.byRule[hit.ruleName] = (stats.byRule[hit.ruleName] ?? 0) + 1;
    const next = formatWholeCost(hit.cost);
    if (String(out["Whole Cost"] ?? "").trim() === next) {
      stats.unchanged++;
      return out;
    }
    out["Whole Cost"] = next;
    stats.written++;
    return out;
  });

  const csv = Papa.unparse({
    fields,
    data: rows.map((r) => fields.map((f) => r[f] ?? "")),
  });

  return { csv, stats };
}
