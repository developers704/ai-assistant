/**
 * Append a daily ITEM SALES LISTING CSV onto data/reports/Sales-Report.csv
 * by matching columns by header name (order can differ).
 *
 * Usage:
 *   npx tsx scripts/append-sales-listing.ts "C:\path\to\ITEM SALES LISTING 24 JULY 2026.CSV"
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
const appendPath = process.argv[2];

if (!appendPath || !fs.existsSync(appendPath)) {
  console.error("Usage: npx tsx scripts/append-sales-listing.ts <listing.csv>");
  process.exit(1);
}

function parse(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse error");
  }
  return {
    fields: (parsed.meta.fields ?? []).map((f) => f.trim()),
    rows: parsed.data,
  };
}

const seed = parse(fs.readFileSync(seedPath, "utf-8"));
const daily = parse(fs.readFileSync(appendPath, "utf-8"));

function field(row: Record<string, string>, name: string): string {
  if (row[name] != null) return String(row[name]);
  const hit = Object.keys(row).find((k) => k.trim() === name.trim());
  return hit != null ? String(row[hit]) : "";
}

function dateOf(row: Record<string, string>): string {
  return (
    field(row, "Transaction Date") ||
    field(row, "Transaction  Date") ||
    ""
  ).trim();
}

const existingDates = new Set(seed.rows.map(dateOf).filter(Boolean));
const newDates = [...new Set(daily.rows.map(dateOf).filter(Boolean))];
const overlap = newDates.filter((d) => existingDates.has(d));
if (overlap.length) {
  console.warn("Warning: seed already has dates:", overlap.join(", "));
  console.warn("Appending anyway (duplicates possible). Prefer replace if unintended.");
}

const mapped = daily.rows.map((r) => {
  const out: Record<string, string> = {};
  for (const col of seed.fields) {
    // Prefer exact header; also try trimmed variants from daily
    let v = field(r, col);
    if (!v) {
      const alt = daily.fields.find(
        (f) => f.replace(/\s+/g, " ").trim() === col.replace(/\s+/g, " ").trim()
      );
      if (alt) v = field(r, alt);
    }
    out[col] = v;
  }
  return out;
});

const combined = [...seed.rows, ...mapped];
const csvOut = Papa.unparse({
  fields: seed.fields,
  data: combined.map((r) => seed.fields.map((c) => r[c] ?? "")),
});

fs.writeFileSync(seedPath, csvOut, "utf-8");

console.log(
  JSON.stringify(
    {
      seedPath,
      appendPath,
      seedRows: seed.rows.length,
      appendedRows: mapped.length,
      totalRows: combined.length,
      newDates,
      bytes: fs.statSync(seedPath).size,
    },
    null,
    2
  )
);
