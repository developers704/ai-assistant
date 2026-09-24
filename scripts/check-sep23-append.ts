/**
 * Post-append sanity: Sep 23 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep23-append.ts
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

const DAY = "2026-09-23";
const rows = loadRankRows() ?? [];
const sep23 = rows.filter((r) => r.date === DAY);
assert.ok(sep23.length > 0, "Sep 23 rows must exist after append");

const netSales = sep23.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), DAY);
assert.ok(dates.includes("2026-09-22"), "Sep 22 must still be present");
assert.ok(dates.includes("2026-09-21"), "Sep 21 must still be present");

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: DAY, endDate: DAY },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 145201.32) < 0.02,
    `Sep 23 CSV Total expected 145201.32 got ${netSales}`
  );
  assert.equal(sep23.length, 317, `Sep 23 rows ${sep23.length}`);
  assert.equal(new Set(sep23.map((r) => r.storeName)).size, 28);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const sep23Legs = legs.filter((leg) => leg.date === DAY);
  assert.equal(sep23Legs.length, 119, `Sep 23 payment legs ${sep23Legs.length}`);

  const totals = paycodeTotalsForPaymentWindow({
    from: DAY,
    to: DAY,
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    CC: 46202.17,
    IDDEAL: 42695.63,
    KAFE: 27078.99,
    SYNC: 24472.8,
    CASH: 8759.02,
    AFFIRM: 3137,
    ACIMA: 1957,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 154302.61) < 1, `paycode sum ${paySum}`);
  assert.equal(byName["GE"], undefined);
  assert.equal(byName["SYNY"], undefined);
  assert.equal(byName["AFF"], undefined);
  assert.equal(byName["PROGRES"], undefined);

  console.log("check-sep23-append: ok", {
    sep23Rows: sep23.length,
    sep23NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep23Stores: new Set(sep23.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep23Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
