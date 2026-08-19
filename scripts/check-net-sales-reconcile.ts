/**
 * Reconcile Sales-Report net vs Excel Total sum.
 * Run: npx tsx scripts/check-net-sales-reconcile.ts
 */
import fs from "fs";
import Papa from "papaparse";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";
import { filterRows, summarizeRows } from "../src/lib/sales/sales-aggregate";
import { buildIntelligenceReport } from "../src/lib/intelligence/build-report";
import { loadIntelligenceRows } from "../src/lib/intelligence/load-rows";
import { shiftIsoToSameWeekdayLastYear } from "../src/lib/reports/date-utils";

const seed = "data/reports/Sales-Report.csv";
const from = "2025-01-01";
const to = "2026-08-18";

const csv = fs.readFileSync(seed, "utf8");
const parsed = Papa.parse<Record<string, unknown>>(csv, {
  header: true,
  skipEmptyLines: true,
});
const cols = parsed.meta.fields ?? [];
const totalCol = cols.find((c) => /^total$/i.test(c.trim()))!;
const dateCol = cols.find((c) => /transaction\s*date/i.test(c.trim()))!;

function parseUsDate(s: string): string | null {
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}

let csvSum = 0;
let csvCount = 0;
for (const r of parsed.data) {
  const d = parseUsDate(String(r[dateCol] ?? ""));
  if (!d || d < from || d > to) continue;
  const t = String(r[totalCol] ?? "").replace(/[$,]/g, "");
  const n = parseFloat(t);
  if (Number.isFinite(n)) {
    csvSum += n;
    csvCount++;
  }
}

const { rows } = parseVendorPosRows(parsed.data);
const filtered = filterRows(rows, { dateFrom: from, dateTo: to });
const summary = summarizeRows(filtered);

const lyFrom = shiftIsoToSameWeekdayLastYear(from);
const lyTo = shiftIsoToSameWeekdayLastYear(to);
const compareRows = rows.filter((r) => r.date >= lyFrom && r.date <= lyTo);
const compareNet = compareRows.reduce((s, r) => s + r.netRevenue, 0);

const intel = loadIntelligenceRows();
const intelReport = buildIntelligenceReport(intel, { dateFrom: from, dateTo: to });

console.log(
  JSON.stringify(
    {
      csvRaw: { count: csvCount, sum: +csvSum.toFixed(2) },
      parsed: {
        allRows: rows.length,
        filteredRows: filtered.length,
        netSales: +summary.netSales.toFixed(2),
        units: summary.unitsSold,
      },
      yoyCompare: {
        lyFrom,
        lyTo,
        compareRowCount: compareRows.length,
        compareNet: +compareNet.toFixed(2),
        pct:
          compareNet > 0
            ? +(((summary.netSales - compareNet) / compareNet) * 100).toFixed(1)
            : 0,
      },
      intelligenceCsv: intelReport?.summary.netSales,
      datesInSeed: {
        min: rows.reduce((m, r) => (r.date && r.date < m ? r.date : m), "9999"),
        max: rows.reduce((m, r) => (r.date && r.date > m ? r.date : m), ""),
      },
    },
    null,
    2
  )
);
