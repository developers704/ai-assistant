/**
 * Post-append sanity: Sep 2 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep2-append.ts
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
const sep2 = rows.filter((r) => r.date === "2026-09-02");
assert.ok(sep2.length > 0, "Sep 2 rows must exist after append");

const netSales = sep2.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-02");
assert.ok(dates.includes("2026-09-01"), "Sep 1 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-02", endDate: "2026-09-02" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(Math.abs(netSales - 133335.6) < 0.02, `Sep 2 CSV Total expected 133335.60 got ${netSales}`);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-02",
    to: "2026-09-02",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    CC: 52070.82,
    IDDEAL: 29469.99,
    WELLS: 20000,
    KAFE: 17389.4,
    SYNC: 15902,
    CASH: 6291.64,
    GE: 1300,
    ACIMA: 499,
    PROG: 400.56,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 143323.41) < 0.02, `paycode sum ${paySum}`);

  console.log("check-sep2-append: ok", {
    sep2Rows: sep2.length,
    sep2NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep2Stores: new Set(sep2.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep2Applied: +paySum.toFixed(2),
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
