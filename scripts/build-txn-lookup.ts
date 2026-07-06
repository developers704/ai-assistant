import fs from "fs";
import path from "path";
import Papa from "papaparse";

const csvPath =
  process.argv[2] ?? path.join(process.cwd(), "data/reports/Sales-Report.csv");
const outPath =
  process.argv[3] ?? path.join(process.cwd(), "data/reports/txn-date-lookup.csv");

const csvText = fs.readFileSync(csvPath, "utf-8");
const parsed = Papa.parse<Record<string, string>>(csvText, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
});

const txnCol = parsed.meta.fields?.find((f) => /transaction\s*#/i.test(f));
const dateCol = parsed.meta.fields?.find((f) => /transaction\s*date/i.test(f));
if (!txnCol || !dateCol) {
  console.error("Missing Transaction # or Transaction Date columns");
  process.exit(1);
}

const map = new Map<string, string>();
for (const row of parsed.data) {
  const txn = row[txnCol]?.trim();
  const date = row[dateCol]?.trim();
  if (txn && date && !map.has(txn)) map.set(txn, date);
}

const fields = [
  "Transaction  #",
  "Transaction Date",
  "SKU #",
  "Description",
  "Vendor Model",
  "Vendor Name",
  "Qty",
  "Inventory Cost",
  "Sales Amount",
  "Disc Amt",
  "Total",
  "Store",
  "Department",
  "Design",
  "Class",
  "Sub-Class",
  "",
];

const data = [...map.entries()].map(([txn, date]) => {
  const row: Record<string, string> = {};
  for (const f of fields) row[f] = "";
  row["Transaction  #"] = txn;
  row["Transaction Date"] = date;
  return fields.map((f) => row[f] ?? "");
});

fs.writeFileSync(
  outPath,
  Papa.unparse({ fields, data }, { quotes: true }),
  "utf-8"
);
console.log(`Wrote ${map.size} transaction dates to ${outPath}`);
