/**
 * Post-append sanity: Sep 10 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep10-append.ts
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

const rows = loadRankRows() ?? [];
const sep10 = rows.filter((r) => r.date === "2026-09-10");
assert.ok(sep10.length > 0, "Sep 10 rows must exist after append");

const netSales = sep10.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-10");
assert.ok(dates.includes("2026-09-09"), "Sep 9 must still be present");

const splitCsv = sep10.filter(
  (r) => r.transactionId === "ON-10292435" && String(r.sku ?? r.itemNumber ?? "") === "203115-18"
);
assert.equal(
  splitCsv.length,
  2,
  `CSV must keep POS split rows for ON-10292435 / 203115-18, got ${splitCsv.length}`
);
const merged = collapseSplitTxnSkuRows(splitCsv);
assert.equal(merged.length, 1, "Top Models must merge same txn+SKU splits");
assert.ok(Math.abs((merged[0]?.quantity ?? 0) - 1) < 0.001, `merged qty ${merged[0]?.quantity}`);
assert.ok(
  Math.abs((merged[0]?.grossSales ?? 0) - 18944) < 0.02,
  `merged Sales Amount ${merged[0]?.grossSales}`
);
assert.ok(
  Math.abs((merged[0]?.netRevenue ?? 0) - 6896.56) < 0.02,
  `merged Total ${merged[0]?.netRevenue}`
);

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-10", endDate: "2026-09-10" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 139007.39) < 0.02,
    `Sep 10 CSV Total expected 139007.39 got ${netSales}`
  );
  assert.equal(sep10.length, 290, `Sep 10 rows ${sep10.length}`);
  assert.equal(new Set(sep10.map((r) => r.storeName)).size, 28);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-10",
    to: "2026-09-10",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    IDDEAL: 47702.46,
    CC: 35415.88,
    SYNC: 34507.07,
    KAFE: 11044.67,
    CASH: 10945.23,
    ACIMA: 4803,
    BREAD: 3100.26,
    PROG: 1103.45,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 148622.02) < 1, `paycode sum ${paySum}`);

  console.log("check-sep10-append: ok", {
    sep10Rows: sep10.length,
    sep10NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep10Stores: new Set(sep10.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep10Applied: +paySum.toFixed(2),
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
