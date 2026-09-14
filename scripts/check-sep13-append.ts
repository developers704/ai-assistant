/**
 * Post-append sanity: Sep 13 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep13-append.ts
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
const sep13 = rows.filter((r) => r.date === "2026-09-13");
assert.ok(sep13.length > 0, "Sep 13 rows must exist after append");

const netSales = sep13.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-13");
assert.ok(dates.includes("2026-09-12"), "Sep 12 must still be present");
assert.ok(dates.includes("2026-09-11"), "Sep 11 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-13", endDate: "2026-09-13" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 301671.86) < 0.02,
    `Sep 13 CSV Total expected 301671.86 got ${netSales}`
  );
  assert.equal(sep13.length, 561, `Sep 13 rows ${sep13.length}`);
  assert.equal(new Set(sep13.map((r) => r.storeName)).size, 30);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-13",
    to: "2026-09-13",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    IDDEAL: 115595.46,
    CC: 106526.25,
    WELLS: 39380.71,
    SYNC: 27646.8,
    KAFE: 15547.19,
    CASH: 11380.47,
    PROG: 4262,
    ACIMA: 4233,
    FLEX: 1400,
    AFFIRM: 1200,
    MULBRY: 30,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 327201.88) < 1, `paycode sum ${paySum}`);

  console.log("check-sep13-append: ok", {
    sep13Rows: sep13.length,
    sep13NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep13Stores: new Set(sep13.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep13Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
