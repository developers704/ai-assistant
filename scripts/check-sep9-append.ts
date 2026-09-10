/**
 * Post-append sanity: Sep 9 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep9-append.ts
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
const sep9 = rows.filter((r) => r.date === "2026-09-09");
assert.ok(sep9.length > 0, "Sep 9 rows must exist after append");

const netSales = sep9.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-09");
assert.ok(dates.includes("2026-09-08"), "Sep 8 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-09", endDate: "2026-09-09" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 182724.28) < 0.02,
    `Sep 9 CSV Total expected 182724.28 got ${netSales}`
  );
  assert.equal(sep9.length, 351, `Sep 9 rows ${sep9.length}`);
  assert.equal(new Set(sep9.map((r) => r.storeName)).size, 29);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-09",
    to: "2026-09-09",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    IDDEAL: 72650.08,
    CC: 61656.02,
    WELLS: 40500,
    CASH: 7329.7,
    KAFE: 4918,
    SYNC: 4282.4,
    ACIMA: 2479.39,
    PROG: 2300,
    FLEX: 1210,
    MULBRY: 76,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 197401.59) < 1, `paycode sum ${paySum}`);

  console.log("check-sep9-append: ok", {
    sep9Rows: sep9.length,
    sep9NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep9Stores: new Set(sep9.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep9Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
