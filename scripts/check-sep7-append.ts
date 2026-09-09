/**
 * Post-append sanity: Sep 7 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep7-append.ts
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
const sep7 = rows.filter((r) => r.date === "2026-09-07");
assert.ok(sep7.length > 0, "Sep 7 rows must exist after append");

const netSales = sep7.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.ok(dates.includes("2026-09-07"), "Sep 7 must remain in the seed after later daily appends");
assert.ok(dates.includes("2026-09-06"), "Sep 6 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-07", endDate: "2026-09-07" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 279134.51) < 0.02,
    `Sep 7 CSV Total expected 279134.51 got ${netSales}`
  );
  assert.equal(sep7.length, 607, `Sep 7 rows ${sep7.length}`);
  assert.equal(new Set(sep7.map((r) => r.storeName)).size, 31);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-07",
    to: "2026-09-07",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    IDDEAL: 103149.89,
    CC: 97915.02,
    WELLS: 23438.98,
    KAFE: 23369.19,
    CASH: 20142.72,
    SYNC: 16089.84,
    FLEX: 5000,
    ACIMA: 2614.89,
    PROG: 1724.63,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 293445.16) < 1, `paycode sum ${paySum}`);

  console.log("check-sep7-append: ok", {
    sep7Rows: sep7.length,
    sep7NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep7Stores: new Set(sep7.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep7Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
