import fs from "fs";
import path from "path";
import Papa from "papaparse";

const LOOKUP_PATH = path.join(process.cwd(), "data", "reports", "txn-date-lookup.csv");

function buildTxnDateMap(csvText: string): Map<string, string> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const txnCol = parsed.meta.fields?.find((f) => /transaction\s*#/i.test(f));
  const dateCol = parsed.meta.fields?.find((f) => /transaction\s*date/i.test(f));
  const map = new Map<string, string>();
  if (!txnCol || !dateCol) return map;
  for (const row of parsed.data) {
    const txn = row[txnCol]?.trim();
    const date = row[dateCol]?.trim();
    if (txn && date && !map.has(txn)) map.set(txn, date);
  }
  return map;
}

function loadLookup(): Map<string, string> {
  if (!fs.existsSync(LOOKUP_PATH)) return new Map();
  return buildTxnDateMap(fs.readFileSync(LOOKUP_PATH, "utf-8"));
}

/** Add or fill Transaction Date on store sales CSV exports that omit the column. */
export function enrichStoreSalesCsvDates(
  csvText: string,
  options?: { fallbackDate?: string }
): string {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const fields = [...(parsed.meta.fields ?? [])];
  const txnCol = fields.find((f) => /transaction\s*#/i.test(f));
  if (!txnCol) return csvText;

  let dateCol = fields.find((f) => /transaction\s*date/i.test(f));
  if (!dateCol) {
    dateCol = "Transaction Date";
    const txnIdx = fields.indexOf(txnCol);
    fields.splice(txnIdx + 1, 0, dateCol);
  }

  const lookup = loadLookup();
  const fallbackDate = options?.fallbackDate ?? "7/3/2026";

  const rows = parsed.data.map((row) => {
    const txn = String(row[txnCol] ?? "").trim();
    const existing = String(row[dateCol] ?? "").trim();
    const date = existing || lookup.get(txn) || fallbackDate;
    const out: Record<string, string> = {};
    for (const f of fields) {
      out[f] = f === dateCol ? date : (row[f] ?? "");
    }
    return out;
  });

  return Papa.unparse(
    { fields, data: rows.map((r) => fields.map((f) => r[f] ?? "")) },
    { quotes: true }
  );
}
