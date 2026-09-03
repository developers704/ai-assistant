/**
 * Post-append sanity: Sep 1 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep1-append.ts
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";
import { querySales } from "../src/lib/sales/query-sales";
import {
  listPaycodes,
  parsePaycodeLegs,
  paycodeTotalsForPaymentWindow,
} from "../src/lib/sales/paycode-overlay";
import { leakedPaycodeAliases } from "../src/lib/sales/paycode-normalize";

const rows = loadRankRows() ?? [];
const sep1 = rows.filter((r) => r.date === "2026-09-01");
assert.ok(sep1.length > 0, "Sep 1 rows must exist after append");

const netSales = sep1.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.ok(dates.includes("2026-09-01"), "Sep 1 must remain in the seed after later daily appends");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-01", endDate: "2026-09-01" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-01",
    to: "2026-09-01",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);

  console.log("check-sep1-append: ok", {
    sep1Rows: sep1.length,
    sep1NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep1Stores: new Set(sep1.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep1Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      ["ACIMA", "AFFIRM", "IDDEAL", "PROG", "SYNC", "WELLS", "KAFE", "CASH", "CC", "GE"].map(
        (k) => [k, +(byName[k] ?? 0).toFixed(2)]
      )
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});