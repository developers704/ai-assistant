/**
 * Post-append sanity: Sep 14 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep14-append.ts
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";
import { querySales } from "../src/lib/sales/query-sales";
import {
  listPaycodes,
  parsePaycodeLegs,
  paycodeTotalsForPaymentWindow,
} from "../src/lib/sales/paycode-overlay";
import { leakedPaycodeAliases } from "../src/lib/sales/paycode-normalize";
import { normalizeDailySalesCsv } from "../src/lib/reports/normalize-daily-sales-csv";
import { parseVendorPosRows } from "../src/lib/reports/vendor-pos";

function parseMoney(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const s = String(raw)
    .trim()
    .replace(/[$,]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const dailyPath =
  "c:\\Users\\ACCTON-PC-KM-MR-60\\OneDrive\\Attachments\\Desktop\\14 sept sale.CSV";
const cleaned = normalizeDailySalesCsv(fs.readFileSync(dailyPath, "utf8"));
const parsed = Papa.parse<Record<string, unknown>>(cleaned, { header: true, skipEmptyLines: true });
const dailyRows = parseVendorPosRows(parsed.data ?? []).rows;
const dailyNet = dailyRows.reduce((s, r) => s + (Number(r.netRevenue) || 0), 0);
const csvTotalCol = parsed.data.reduce((s, r) => s + parseMoney(r.Total ?? r.total), 0);

const rows = loadRankRows() ?? [];
const sep14 = rows.filter((r) => r.date === "2026-09-14");
const sep13 = rows.filter((r) => r.date === "2026-09-13");
const net14 = sep14.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();

assert.ok(sep14.length > 0, "Sep 14 rows must exist after append");
assert.ok((dates.at(-1) ?? "") >= "2026-09-14", `data must reach Sep 14, got ${dates.at(-1)}`);
assert.ok(sep13.length > 0, "Sep 13 must still be present");
assert.ok(Math.abs(net14 - dailyNet) < 0.05, `seed ${net14} vs daily parse ${dailyNet}`);
assert.ok(Math.abs(dailyNet - csvTotalCol) < 0.05, `parsed ${dailyNet} vs CSV Total ${csvTotalCol}`);

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-14", endDate: "2026-09-14" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - net14) < 0.02);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-14",
    to: "2026-09-14",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  assert.ok(paySum > 0, "Sep 14 paycodes must have Applied Amt");

  console.log("check-sep14-append: ok", {
    dailyFileRows: dailyRows.length,
    seedSep14Rows: sep14.length,
    seedSep14NetSales: +net14.toFixed(2),
    csvTotal: +csvTotalCol.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep14Stores: new Set(sep14.map((r) => r.storeName)).size,
    sep13Still: sep13.length,
    dataThrough: dates.at(-1),
    paycodeSep14Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      totals.map((t) => [t.name, +t.revenue.toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
