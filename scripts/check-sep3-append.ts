/**
 * Post-append sanity: Sep 3 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep3-append.ts
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
const sep3 = rows.filter((r) => r.date === "2026-09-03");
assert.ok(sep3.length > 0, "Sep 3 rows must exist after append");

const netSales = sep3.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-03");
assert.ok(dates.includes("2026-09-02"), "Sep 2 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-03", endDate: "2026-09-03" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 219886.48) < 0.02,
    `Sep 3 CSV Total expected 219886.48 got ${netSales}`
  );

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-03",
    to: "2026-09-03",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    WELLS: 82929,
    IDDEAL: 64442.91,
    CC: 45774.64,
    KAFE: 16784.69,
    SYNC: 14102.95,
    CASH: 9293.05,
    ACIMA: 2807,
    AFFIRM: 2382,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 238516.24) < 1, `paycode sum ${paySum}`);

  console.log("check-sep3-append: ok", {
    sep3Rows: sep3.length,
    sep3NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep3Stores: new Set(sep3.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep3Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      ["ACIMA", "AFFIRM", "IDDEAL", "PROG", "SYNC", "WELLS", "KAFE", "CASH", "CC"].map(
        (k) => [k, +(byName[k] ?? 0).toFixed(2)]
      )
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
