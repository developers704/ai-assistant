/**
 * Replace days in Sales-Report.csv with a daily ITEM SALES LISTING
 * (drops any seed rows whose Transaction Date matches the listing dates).
 *
 * Usage:
 *   npx tsx scripts/replace-sales-listing.ts "C:\path\to\ITEM SALES LISTING 28 JULY 2026.CSV"
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const seedPath = path.join(process.cwd(), "data", "reports", "Sales-Report.csv");
const listingPath = process.argv[2];

if (!listingPath || !fs.existsSync(listingPath)) {
  console.error("Usage: npx tsx scripts/replace-sales-listing.ts <listing.csv>");
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

const seed = parse(fs.readFileSync(seedPath, "utf-8"));
const daily = parse(fs.readFileSync(listingPath, "utf-8"));
const replaceDates = new Set(daily.rows.map(dateOf).filter(Boolean));

if (!replaceDates.size) {
  console.error("Listing has no Transaction Date values");
  process.exit(1);
}

const kept = seed.rows.filter((r) => !replaceDates.has(dateOf(r)));
const removed = seed.rows.length - kept.length;

const mapped = daily.rows.map((r) => {
  const out: Record<string, string> = {};
  for (const col of seed.fields) {
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

const combined = [...kept, ...mapped];
const csvOut = Papa.unparse({
  fields: seed.fields,
  data: combined.map((r) => seed.fields.map((c) => r[c] ?? "")),
});
fs.writeFileSync(seedPath, csvOut, "utf-8");

console.log(
  JSON.stringify(
    {
      seedPath,
      listingPath,
      replaceDates: [...replaceDates],
      removedRows: removed,
      keptRows: kept.length,
      addedRows: mapped.length,
      totalRows: combined.length,
      bytes: fs.statSync(seedPath).size,
    },
    null,
    2
  )
);
