/**
 * Fill blank Whole Cost from sales guidelines, write downloadable CSV.
 *
 * Rules (only when Whole Cost is blank):
 * - Design PLAT JEWL | SILVER JEW → Sales Amount / 4
 * - Sub-Class BIRTHSTONE → Sales Amount / 8.8
 * - Department GOLD BANDS | GOLD ID | GOLD HOOPS | GOLD PNDTS | GOLD RINGS → / 4
 *   (GOLF PNDTS treated as GOLD PNDTS)
 *
 * Usage:
 *   npx tsx scripts/fill-whole-cost.ts [input.csv] [output.csv]
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const DEFAULT_IN =
  "C:\\Users\\ACCTON-PC-KM-MR-60\\Downloads\\ITEMS_SALES_WITH_WHOLE_COST_30_JULY_2026.csv";
const DEFAULT_OUT =
  "C:\\Users\\ACCTON-PC-KM-MR-60\\Downloads\\ITEMS_SALES_WITH_WHOLE_COST_30_JULY_2026_FILLED.csv";

const inputPath = process.argv[2] ?? DEFAULT_IN;
const outputPath = process.argv[3] ?? DEFAULT_OUT;

const GOLD_DEPTS = new Set([
  "GOLD BANDS",
  "GOLD ID",
  "GOLD HOOPS",
  "GOLD PNDTS",
  "GOLD RINGS",
  "GOLF PNDTS", // typo → same as GOLD PNDTS
]);

function norm(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function parseAmount(value: unknown): number | null {
  const n = Number(String(value ?? "").replace(/[$,\s]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function formatWholeCost(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(2);
}

function wholeCostDivisor(row: Record<string, string>): number | null {
  const design = norm(row.Design);
  const sub = norm(row["Sub-Class"]);
  const dept = norm(row.Department);

  // More specific first
  if (sub === "BIRTHSTONE") return 8.8;
  if (design === "PLAT JEWL" || design === "SILVER JEW") return 4;
  if (GOLD_DEPTS.has(dept)) return 4;
  return null;
}

function isBlankWholeCost(value: unknown): boolean {
  return !String(value ?? "").trim();
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
  byRule: { birthstone: 0, platJewl: 0, silverJew: 0, goldDept: 0 },
};

const rows = parsed.data.map((row) => {
  const out = { ...row };
  if (!isBlankWholeCost(out["Whole Cost"])) return out;

  stats.wasBlank++;
  const sales = parseAmount(out["Sales Amount"]);
  const div = wholeCostDivisor(out);
  if (sales == null || !(sales > 0) || div == null) {
    stats.stillBlank++;
    return out;
  }

  const design = norm(out.Design);
  const sub = norm(out["Sub-Class"]);
  const dept = norm(out.Department);
  if (sub === "BIRTHSTONE") stats.byRule.birthstone++;
  else if (design === "PLAT JEWL") stats.byRule.platJewl++;
  else if (design === "SILVER JEW") stats.byRule.silverJew++;
  else if (GOLD_DEPTS.has(dept)) stats.byRule.goldDept++;

  out["Whole Cost"] = formatWholeCost(sales / div);
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
