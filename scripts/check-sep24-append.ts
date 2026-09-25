/**
 * Post-append sanity: Sep 24 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep24-append.ts
 *
 * Excel Total footer is $143,777.72 (11 cents under the Total column).
 * Dashboard Net Sales uses the Total column sum, $143,777.83.
 * Excel qty footer is 184. $0 product rows (15 qty) are dropped; three kept
 * memo lines have blank/zero qty and parse as 1, so parsed qty is 172.
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

const DAY = "2026-09-24";
const rows = loadRankRows() ?? [];
const sep24 = rows.filter((r) => r.date === DAY);
assert.ok(sep24.length > 0, "Sep 24 rows must exist after append");

const netSales = sep24.reduce((s, r) => s + r.netRevenue, 0);
const gross = sep24.reduce((s, r) => s + (r.grossSales || 0), 0);
const disc = sep24.reduce((s, r) => s + (r.discountAmount || 0), 0);
const qty = sep24.reduce((s, r) => s + (r.quantity || 0), 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), DAY);
assert.ok(dates.includes("2026-09-23"), "Sep 23 must still be present");
assert.ok(dates.includes("2026-09-22"), "Sep 22 must still be present");

const sep23 = rows.filter((r) => r.date === "2026-09-23");
const sep23Net = sep23.reduce((s, r) => s + r.netRevenue, 0);

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: DAY, endDate: DAY },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true },
    limit: 40,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 143777.83) < 0.02,
    `Sep 24 CSV Total expected 143777.83 got ${netSales}`
  );
  assert.ok(Math.abs(gross - 425707.18) < 0.02, `Sales Amount ${gross}`);
  assert.ok(Math.abs(disc - 281929.41) < 0.02, `Disc Amt ${disc}`);
  assert.ok(Math.abs(qty - 172) < 0.02, `parsed qty ${qty}`);
  assert.equal(sep24.length, 263, `Sep 24 rows ${sep24.length}`);
  assert.equal(new Set(sep24.map((r) => r.storeName)).size, 29);
  assert.equal(q.summary?.transactions, 89);
  assert.equal(sep23.length, 333, `Sep 23 rows changed: ${sep23.length}`);
  assert.ok(Math.abs(sep23Net - 152630.26) < 0.02, `Sep 23 net ${sep23Net}`);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const sep24Legs = legs.filter((leg) => leg.date === DAY);
  assert.equal(sep24Legs.length, 95, `Sep 24 payment legs ${sep24Legs.length}`);

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
    CC: 64078.9,
    SYNC: 27757.82,
    IDDEAL: 23222.01,
    KAFE: 12659.98,
    CASH: 7932.22,
    WELLS: 6699,
    ACIMA: 4542.5,
    AFFIRM: 2700,
    PROG: 2400,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 151992.43) < 0.02, `paycode sum ${paySum}`);
  assert.equal(byName["GE"], undefined);
  assert.equal(byName["ACIM"], undefined);
  assert.equal(byName["AFFR"], undefined);

  // Sparse leftover dates in the daily file upsert; they must not replace the day.
  const stray: Array<[string, string, string, number, number]> = [
    ["2026-06-11", "VS-70015948", "CASH", 100, 50],
    ["2026-08-20", "VV-70016182", "CC", 126.99, 50],
    ["2026-08-26", "VV-215", "CASH", 4500, 50],
    ["2026-09-04", "SL-63", "CC", 800, 50],
  ];
  for (const [date, txn, code, amount, minLegs] of stray) {
    const dayLegs = legs.filter((leg) => leg.date === date);
    assert.ok(dayLegs.length >= minLegs, `${date} was replaced: ${dayLegs.length} legs`);
    const hit = dayLegs.some(
      (leg) =>
        leg.txnId === txn &&
        leg.code === code &&
        Math.abs(leg.amount - amount) < 0.02
    );
    assert.ok(hit, `missing leftover ${date} ${txn} ${code} ${amount}`);
  }

  console.log("check-sep24-append: ok", {
    sep24Rows: sep24.length,
    sep24NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    transactions: q.summary!.transactions,
    sep24Stores: new Set(sep24.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep24Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
