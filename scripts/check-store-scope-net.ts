/**
 * Reconcile net sales: full CSV vs exclusions vs DM scopes.
 * Run: npx tsx scripts/check-store-scope-net.ts
 */
import fs from "fs";
import Papa from "papaparse";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { filterExcludedSalesRows } from "../src/lib/utils";
import { readNormalizedRows } from "../src/lib/sales/data/version-store";
import { filterRows, groupRows, summarizeRows } from "../src/lib/sales/sales-aggregate";
import { AJ_STORES, SHAUN_STORES, ADEEL_STORES, ROZINA_STORES } from "../src/lib/auth/users";

const from = "2025-01-01";
const to = "2026-08-18";
const targetNet = 84_585_390;

const cached = readNormalizedRows();
const csv = fs.readFileSync("data/reports/Sales-Report.csv", "utf8");
const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true });
const { rows: parsedRows } = parseVendorPosRows(parsed.data ?? []);

for (const [label, source] of [
  ["cached", cached],
  ["parsed", parsedRows],
] as const) {
  if (!source?.length) continue;
  const filtered = filterRows(source, { dateFrom: from, dateTo: to });
  const excluded = filterRows(filterExcludedSalesRows(source), {
    dateFrom: from,
    dateTo: to,
  });
  const full = summarizeRows(filtered);
  const ex = summarizeRows(excluded);
  console.log(label, {
    fullNet: +full.netSales.toFixed(0),
    excludedNet: +ex.netSales.toFixed(0),
    droppedNet: +(full.netSales - ex.netSales).toFixed(0),
    fullRows: filtered.length,
    excludedRows: excluded.length,
  });
}

const rows = cached ?? parsedRows;
const filtered = filterRows(rows, { dateFrom: from, dateTo: to });

for (const [label, stores] of [
  ["AJ", AJ_STORES],
  ["Shaun", SHAUN_STORES],
  ["Adeel", ADEEL_STORES],
  ["Rozina", ROZINA_STORES],
] as const) {
  const scoped = filterRows(filtered, { stores: [...stores] });
  const s = summarizeRows(scoped);
  console.log(label, { net: +s.netSales.toFixed(0), units: s.unitsSold });
}

// Match target?
const byStore = groupRows(filtered, "store", null);
const sorted = [...byStore].sort((a, b) => b.netSales - a.netSales);
let run = 0;
for (let n = 1; n <= sorted.length; n++) {
  run += sorted[n - 1]!.netSales;
  if (Math.abs(run - targetNet) < 1000) {
    console.log("Exact top-N match:", n, +run.toFixed(2));
  }
}
