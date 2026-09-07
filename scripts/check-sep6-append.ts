/**
 * Post-append sanity: Sep 6 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep6-append.ts
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
const sep6 = rows.filter((r) => r.date === "2026-09-06");
assert.ok(sep6.length > 0, "Sep 6 rows must exist after append");

const netSales = sep6.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-06");
assert.ok(dates.includes("2026-09-05"), "Sep 5 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-06", endDate: "2026-09-06" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 412704.8) < 0.02,
    `Sep 6 CSV Total expected 412704.8 got ${netSales}`
  );

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-06",
    to: "2026-09-06",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    IDDEAL: 199647.03,
    CC: 154549.43,
    WELLS: 29954.98,
    KAFE: 25345.15,
    SYNC: 22424.53,
    CASH: 12112.09,
    PROG: 4480,
    ACIMA: 3660,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 452173.21) < 1, `paycode sum ${paySum}`);

  console.log("check-sep6-append: ok", {
    sep6Rows: sep6.length,
    sep6NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep6Stores: new Set(sep6.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep6Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
