/**
 * Apply CP Divisor Rules to inventory / sales CSVs.
 * Updates Whole Cost from Tag Price (onhand) or Sales Amount (sales export).
 *
 * By default OVERWRITES Whole Cost when a rule matches (sheet = source of truth).
 * Pass --blank-only to only fill empty Whole Cost cells.
 *
 * Usage:
 *   npx tsx scripts/fill-whole-cost.ts [input.csv] [output.csv] [--blank-only]
 *   npx tsx scripts/fill-whole-cost.ts --onhand
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { resolveWholeCostFromRules } from "../src/lib/inventory/whole-cost-rules";

const args = process.argv.slice(2).filter((a) => a !== "--blank-only");
const blankOnly = process.argv.includes("--blank-only");
const onhandMode = process.argv.includes("--onhand");

const ONHAND_TARGETS = [
  path.join("data", "inventory", "ON_HAND_REPORT_with_WholeCost.csv"),
  path.join("data", "inventory", "Inventory-Onhand.csv"),
  path.join(".data", "inventory", "onhand.csv"),
  path.join(".data", "inventory", "inventory.csv"),
];

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

/** Prefer Tag (onhand), else Sales Amount. */
function basePriceForRow(row: Record<string, string>): number | null {
  const tag =
    parseAmount(row["Individual Selling Value"]) ??
    parseAmount(row["Tag Price"]) ??
    parseAmount(row.Tag);
  if (tag != null && tag > 0) return tag;
  const sales = parseAmount(row["Sales Amount"]);
  if (sales != null && sales > 0) return sales;
  return null;
}

function fillFile(inputPath: string, outputPath: string) {
  if (!fs.existsSync(inputPath)) {
    console.error("Skip (missing):", inputPath);
    return null;
  }

  const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(inputPath, "utf8"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (!parsed.meta.fields?.includes("Whole Cost")) {
    console.error("Skip (no Whole Cost column):", inputPath);
    return null;
  }

  const stats = {
    inputPath,
    outputPath,
    total: parsed.data.length,
    matched: 0,
    written: 0,
    unchanged: 0,
    noRule: 0,
    byRule: {} as Record<string, number>,
    error: null as string | null,
  };

  const rows = parsed.data.map((row) => {
    const out = { ...row };
    const existingBlank = isBlankWholeCost(out["Whole Cost"]);
    if (blankOnly && !existingBlank) {
      stats.unchanged++;
      return out;
    }

    const base = basePriceForRow(out);
    const skuField = Object.keys(out).find((k) => /^item\s*#$/i.test(k) || /^sku\s*#?$/i.test(k));
    const sku = skuField ? out[skuField] : undefined;
    const descField = Object.keys(out).find((k) =>
      /^(item\s*desc|description)$/i.test(k)
    );
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
    fields: parsed.meta.fields!,
    data: rows.map((r) => parsed.meta.fields!.map((f) => r[f] ?? "")),
  });
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    // Write temp then rename — avoids some OneDrive locks on direct overwrite
    const tmp = `${outputPath}.${process.pid}.tmp.csv`;
    fs.writeFileSync(tmp, csv, "utf8");
    fs.renameSync(tmp, outputPath);
  } catch (e) {
    stats.error = e instanceof Error ? e.message : String(e);
    try {
      fs.unlinkSync(`${outputPath}.${process.pid}.tmp.csv`);
    } catch {
      /* ignore */
    }
  }
  return {
    ...stats,
    bytes: stats.error ? 0 : fs.statSync(outputPath).size,
  };
}

if (onhandMode || args[0] === "--onhand") {
  const results = [];
  for (const file of ONHAND_TARGETS) {
    const r = fillFile(file, file);
    if (r) results.push(r);
  }
  console.log(JSON.stringify({ mode: "onhand-overwrite", blankOnly, results }, null, 2));
} else {
  const inputPath =
    args[0] ??
    "C:\\Users\\ACCTON-PC-KM-MR-60\\Downloads\\ITEMS_SALES_WITH_WHOLE_COST_30_JULY_2026.csv";
  const outputPath =
    args[1] ??
    inputPath.replace(/\.csv$/i, "_FILLED.csv");
  const r = fillFile(inputPath, outputPath);
  console.log(JSON.stringify({ mode: "single", blankOnly, result: r }, null, 2));
}
