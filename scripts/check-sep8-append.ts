/**
 * Post-append sanity: Sep 8 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep8-append.ts
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
const sep8 = rows.filter((r) => r.date === "2026-09-08");
assert.ok(sep8.length > 0, "Sep 8 rows must exist after append");

const netSales = sep8.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.ok(dates.includes("2026-09-08"), "Sep 8 must remain in the seed after later daily appends");
assert.ok(dates.includes("2026-09-07"), "Sep 7 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-08", endDate: "2026-09-08" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 124237.92) < 0.02,
    `Sep 8 CSV Total expected 124237.92 got ${netSales}`
  );
  assert.equal(sep8.length, 239, `Sep 8 rows ${sep8.length}`);
  assert.equal(new Set(sep8.map((r) => r.storeName)).size, 23);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-08",
    to: "2026-09-08",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    CC: 67452.88,
    IDDEAL: 34455.16,
    SYNC: 14390,
    KAFE: 10324.94,
    CASH: 6004.15,
    FLEX: 3070,
    ACIMA: 829.11,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 136526.24) < 1, `paycode sum ${paySum}`);

  console.log("check-sep8-append: ok", {
    sep8Rows: sep8.length,
    sep8NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep8Stores: new Set(sep8.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep8Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
