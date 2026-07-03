/**
 * Add Transaction Date to store sales CSV when missing (merge from lookup).
 * Usage: npx tsx scripts/enrich-sales-dates.ts [csvPath] [lookupCsvPath]
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

function colKey(row: Record<string, unknown>, pattern: RegExp): string | null {
  return Object.keys(row).find((k) => pattern.test(k.trim())) ?? null;
}

function buildTxnDateMap(csvText: string): Map<string, string> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const map = new Map<string, string>();
  const txnCol = parsed.meta.fields?.find((f) => /transaction\s*#/i.test(f));
  const dateCol = parsed.meta.fields?.find((f) => /transaction\s*date/i.test(f));
  if (!txnCol || !dateCol) return map;
  for (const row of parsed.data) {
    const txn = row[txnCol]?.trim();
    const date = row[dateCol]?.trim();
    if (txn && date && !map.has(txn)) map.set(txn, date);
  }
  return map;
}

function enrichCsv(csvText: string, lookup: Map<string, string>): string {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const fields = [...(parsed.meta.fields ?? [])];
  const txnCol = fields.find((f) => /transaction\s*#/i.test(f));
  if (!txnCol) throw new Error("No Transaction # column found");

  let dateCol = fields.find((f) => /transaction\s*date/i.test(f));
  if (!dateCol) {
    dateCol = "Transaction Date";
    const txnIdx = fields.indexOf(txnCol);
    fields.splice(txnIdx + 1, 0, dateCol);
  }

  const rows = parsed.data.map((row) => {
    const txn = String(row[txnCol] ?? "").trim();
    const existing = dateCol ? String(row[dateCol] ?? "").trim() : "";
    const date = existing || lookup.get(txn) || "";
    const out: Record<string, string> = {};
    for (const f of fields) {
      if (f === dateCol) {
        out[f] = date;
      } else {
        out[f] = row[f] ?? "";
      }
    }
    return out;
  });

  const fallbackDate = process.env.SALES_FALLBACK_DATE ?? "7/3/2026";
  for (const row of rows) {
    if (!String(row[dateCol] ?? "").trim()) {
      row[dateCol] = fallbackDate;
    }
  }

  const missing = new Set(
    rows.filter((r) => !String(r[dateCol] ?? "").trim()).map((r) => r[txnCol])
  );
  if (missing.size > 0) {
    console.warn(
      `Warning: ${missing.size} transactions still missing dates:`,
      [...missing].slice(0, 8)
    );
  }

  return Papa.unparse(
    { fields, data: rows.map((r) => fields.map((f) => r[f] ?? "")) },
    { quotes: true }
  );
}

const csvPath = process.argv[2] ?? path.join(process.cwd(), "data/reports/Sales-Report.csv");
const lookupPath =
  process.argv[3] ?? path.join(process.cwd(), ".tmp-old-sales.csv");

const csvText = fs.readFileSync(csvPath, "utf-8");
const lookupText = fs.existsSync(lookupPath) ? fs.readFileSync(lookupPath, "utf-8") : "";
const lookup = lookupText ? buildTxnDateMap(lookupText) : new Map();

console.log(`Lookup: ${lookup.size} transaction dates`);
const enriched = enrichCsv(csvText, lookup);
fs.writeFileSync(csvPath, enriched, "utf-8");
console.log(`Updated ${csvPath}`);
