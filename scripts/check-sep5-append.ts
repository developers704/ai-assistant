/**
 * Post-append sanity: Sep 5 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep5-append.ts
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
const sep5 = rows.filter((r) => r.date === "2026-09-05");
assert.ok(sep5.length > 0, "Sep 5 rows must exist after append");

const netSales = sep5.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-05");
assert.ok(dates.includes("2026-09-04"), "Sep 4 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-05", endDate: "2026-09-05" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 351792.84) < 0.02,
    `Sep 5 CSV Total expected 351792.84 got ${netSales}`
  );

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-05",
    to: "2026-09-05",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    CC: 142748.74,
    IDDEAL: 120021.1,
    KAFE: 48895.27,
    CASH: 25334.27,
    SYNC: 25073.9,
    BREAD: 5116.64,
    PROG: 3467,
    WELLS: 2795,
    GAFCO: 2575,
    AFFIRM: 1897.39,
    ACIMA: 1875,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 379799.31) < 1, `paycode sum ${paySum}`);

  console.log("check-sep5-append: ok", {
    sep5Rows: sep5.length,
    sep5NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep5Stores: new Set(sep5.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep5Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
