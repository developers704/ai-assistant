/**
 * Fill blank Whole Cost from CP Divisor Rules (Tag/Sales Amount formulas).
 * Never overwrites a Whole Cost that is already filled in the CSV.
 *
 * Rules: src/lib/inventory/whole-cost-rules.ts
 * Downloadable: public/CP_Divisor_Rules.csv | .xls
 *
 * Usage:
 *   npx tsx scripts/fill-whole-cost.ts [input.csv] [output.csv]
 */
import fs from "fs";
import Papa from "papaparse";
import { resolveWholeCostFromRules } from "../src/lib/inventory/whole-cost-rules";

const DEFAULT_IN =
  "C:\\Users\\ACCTON-PC-KM-MR-60\\Downloads\\ITEMS_SALES_WITH_WHOLE_COST_30_JULY_2026.csv";
const DEFAULT_OUT =
  "C:\\Users\\ACCTON-PC-KM-MR-60\\Downloads\\ITEMS_SALES_WITH_WHOLE_COST_30_JULY_2026_FILLED.csv";

const inputPath = process.argv[2] ?? DEFAULT_IN;
const outputPath = process.argv[3] ?? DEFAULT_OUT;

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

/** Prefer Sales Amount, else Tag / Individual Selling Value (onhand shape). */
function basePriceForRow(row: Record<string, string>): number | null {
  const sales = parseAmount(row["Sales Amount"]);
  if (sales != null && sales > 0) return sales;
  const tag =
    parseAmount(row["Individual Selling Value"]) ??
    parseAmount(row["Tag Price"]) ??
    parseAmount(row.Tag);
  if (tag != null && tag > 0) return tag;
  return null;
}

if (!fs.existsSync(inputPath)) {
  console.error("Input not found:", inputPath);
  process.exit(1);
}

const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(inputPath, "utf8"), {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
});

if (!parsed.meta.fields?.includes("Whole Cost")) {
  console.error('CSV missing "Whole Cost" column');
  process.exit(1);
}

const stats = {
  total: parsed.data.length,
  wasBlank: 0,
  filled: 0,
  stillBlank: 0,
  byRule: {} as Record<string, number>,
};

const rows = parsed.data.map((row) => {
  const out = { ...row };
  if (!isBlankWholeCost(out["Whole Cost"])) return out;

  stats.wasBlank++;
  const base = basePriceForRow(out);
  if (base == null) {
    stats.stillBlank++;
    return out;
  }

  const hit = resolveWholeCostFromRules(
    {
      department: out.Department,
      design: out.Design,
      class: out.Class,
      subClass: out["Sub-Class"],
    },
    base
  );
  if (!hit) {
    stats.stillBlank++;
    return out;
  }

  stats.byRule[hit.ruleName] = (stats.byRule[hit.ruleName] ?? 0) + 1;
  out["Whole Cost"] = formatWholeCost(hit.cost);
  stats.filled++;
  return out;
});

const csv = Papa.unparse({
  fields: parsed.meta.fields!,
  data: rows.map((r) => parsed.meta.fields!.map((f) => r[f] ?? "")),
});

fs.writeFileSync(outputPath, csv, "utf8");

console.log(
  JSON.stringify(
    {
      inputPath,
      outputPath,
      bytes: fs.statSync(outputPath).size,
      ...stats,
    },
    null,
    2
  )
);
