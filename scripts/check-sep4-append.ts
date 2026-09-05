/**
 * Post-append sanity: Sep 4 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep4-append.ts
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
const sep4 = rows.filter((r) => r.date === "2026-09-04");
assert.ok(sep4.length > 0, "Sep 4 rows must exist after append");

const netSales = sep4.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-04");
assert.ok(dates.includes("2026-09-03"), "Sep 3 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-04", endDate: "2026-09-04" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 232521.55) < 0.02,
    `Sep 4 CSV Total expected 232521.55 got ${netSales}`
  );

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-04",
    to: "2026-09-04",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    CC: 111883.29,
    IDDEAL: 76290.3,
    SYNC: 21412.31,
    CASH: 15072.31,
    FLEX: 10300,
    KAFE: 9465.85,
    WELLS: 6904.99,
    PROG: 3080,
    SNAP: 300,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 254709.05) < 1, `paycode sum ${paySum}`);

  console.log("check-sep4-append: ok", {
    sep4Rows: sep4.length,
    sep4NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep4Stores: new Set(sep4.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep4Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      ["CC", "IDDEAL", "SYNC", "CASH", "FLEX", "KAFE", "WELLS", "PROG", "SNAP"].map(
        (k) => [k, +(byName[k] ?? 0).toFixed(2)]
      )
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
