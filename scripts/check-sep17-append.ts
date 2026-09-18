/**
 * Post-append sanity: Sep 17 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep17-append.ts
 *
 * POS salesperson splits stay as CSV rows (Net Sales / rankings).
 * Top Models merge is collapseSplitTxnSkuRows — same txn+SKU → one line.
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
import { collapseSplitTxnSkuRows } from "../src/lib/sales/top-models-wholesale-margin";

const DAY = "2026-09-17";
const rows = loadRankRows() ?? [];
const sep17 = rows.filter((r) => r.date === DAY);
assert.ok(sep17.length > 0, "Sep 17 rows must exist after append");

const netSales = sep17.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), DAY);
assert.ok(dates.includes("2026-09-16"), "Sep 16 must still be present");
assert.ok(dates.includes("2026-09-15"), "Sep 15 must still be present");

const splitCsv = sep17.filter(
  (r) => r.transactionId === "SR-10291509" && String(r.sku ?? r.itemNumber ?? "") === "225630"
);
assert.equal(
  splitCsv.length,
  2,
  `CSV must keep POS split rows for SR-10291509 / 225630, got ${splitCsv.length}`
);
const merged = collapseSplitTxnSkuRows(splitCsv);
assert.equal(merged.length, 1, "Top Models must merge same txn+SKU splits");
assert.ok(Math.abs((merged[0]?.quantity ?? 0) - 1) < 0.001, `merged qty ${merged[0]?.quantity}`);
assert.ok(
  Math.abs((merged[0]?.grossSales ?? 0) - 412) < 0.02,
  `merged Sales Amount ${merged[0]?.grossSales}`
);
assert.ok(
  Math.abs((merged[0]?.netRevenue ?? 0) - 250) < 0.02,
  `merged Total ${merged[0]?.netRevenue}`
);

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
    Math.abs(netSales - 196511.41) < 0.02,
    `Sep 17 CSV Total expected 196511.41 got ${netSales}`
  );
  assert.equal(sep17.length, 284, `Sep 17 rows ${sep17.length}`);
  assert.equal(new Set(sep17.map((r) => r.storeName)).size, 27);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
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
    CASH: 84334.7,
    IDDEAL: 53338.15,
    CC: 38186.45,
    SYNC: 16136.29,
    KAFE: 15207.25,
    ACIMA: 3839,
    PROG: 2000,
    AFFIRM: 650,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 213691.84) < 1, `paycode sum ${paySum}`);
  assert.equal(byName["GE"], undefined);

  console.log("check-sep17-append: ok", {
    sep17Rows: sep17.length,
    sep17NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep17Stores: new Set(sep17.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep17Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
    splitCsvRows: splitCsv.length,
    mergedQty: merged[0]?.quantity,
    mergedGross: merged[0]?.grossSales,
    mergedNet: merged[0]?.netRevenue,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
