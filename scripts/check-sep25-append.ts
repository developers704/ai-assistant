/**
 * Post-append sanity: Sep 25 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep25-append.ts
 *
 * Excel Total footer is $196,661.99 (12 cents under the Total column).
 * Dashboard Net Sales uses the Total column sum, $196,662.11.
 * Excel qty footer is 374.87. $0 product rows (90 lines, 99 qty) are dropped,
 * so parsed qty is 275.87. Sales Amount and Disc Amt match the footer.
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

const DAY = "2026-09-25";
const rows = loadRankRows() ?? [];
const sep25 = rows.filter((r) => r.date === DAY);
assert.ok(sep25.length > 0, "Sep 25 rows must exist after append");

const netSales = sep25.reduce((s, r) => s + r.netRevenue, 0);
const gross = sep25.reduce((s, r) => s + (r.grossSales || 0), 0);
const disc = sep25.reduce((s, r) => s + (r.discountAmount || 0), 0);
const qty = sep25.reduce((s, r) => s + (r.quantity || 0), 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), DAY);
assert.ok(dates.includes("2026-09-24"), "Sep 24 must still be present");
assert.ok(dates.includes("2026-09-23"), "Sep 23 must still be present");

const sep24 = rows.filter((r) => r.date === "2026-09-24");
const sep24Net = sep24.reduce((s, r) => s + r.netRevenue, 0);

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
    Math.abs(netSales - 196662.11) < 0.02,
    `Sep 25 CSV Total expected 196662.11 got ${netSales}`
  );
  assert.ok(Math.abs(gross - 504150.02) < 0.02, `Sales Amount ${gross}`);
  assert.ok(Math.abs(disc - 307488.08) < 0.02, `Disc Amt ${disc}`);
  assert.ok(Math.abs(qty - 275.87) < 0.02, `parsed qty ${qty}`);
  assert.equal(sep25.length, 416, `Sep 25 rows ${sep25.length}`);
  assert.equal(new Set(sep25.map((r) => r.storeName)).size, 31);
  assert.equal(q.summary?.transactions, 166);
  assert.equal(sep24.length, 263, `Sep 24 rows changed: ${sep24.length}`);
  assert.ok(Math.abs(sep24Net - 143777.83) < 0.02, `Sep 24 net ${sep24Net}`);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const sep25Legs = legs.filter((leg) => leg.date === DAY);
  assert.equal(sep25Legs.length, 168, `Sep 25 payment legs ${sep25Legs.length}`);

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
    CC: 77678.09,
    IDDEAL: 55712.56,
    SYNC: 43218.37,
    KAFE: 9001.09,
    WELLS: 7863,
    AFFIRM: 6712,
    CASH: 6051.39,
    ACIMA: 2947,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 209183.5) < 0.02, `paycode sum ${paySum}`);
  assert.equal(byName["GE"], undefined);
  assert.equal(byName["ACIM"], undefined);
  assert.equal(byName["AFFR"], undefined);

  const stray: Array<[string, string, string, number, number]> = [
    ["2026-08-25", "VF-70016023", "CASH", 100, 50],
    ["2026-07-20", "GM-80162584", "IDDEAL", 850, 50],
    ["2026-09-19", "VF-70016025", "CC", 45, 50],
    ["2026-07-04", "LO-70000109", "CC", 500, 50],
    ["2026-08-24", "SL-70016084", "CASH", 100, 50],
    ["2026-07-03", "CL-80161274", "CC", 300, 50],
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

  console.log("check-sep25-append: ok", {
    sep25Rows: sep25.length,
    sep25NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    transactions: q.summary!.transactions,
    sep25Stores: new Set(sep25.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep25Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
