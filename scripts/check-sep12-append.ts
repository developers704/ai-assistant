/**
 * Post-append sanity: Sep 12 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep12-append.ts
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
const sep12 = rows.filter((r) => r.date === "2026-09-12");
assert.ok(sep12.length > 0, "Sep 12 rows must exist after append");

const netSales = sep12.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), "2026-09-12");
assert.ok(dates.includes("2026-09-11"), "Sep 11 must still be present");
assert.ok(dates.includes("2026-09-10"), "Sep 10 must still be present");

const splitCsv = sep12.filter(
  (r) => r.transactionId === "VS-10292226" && String(r.sku ?? r.itemNumber ?? "") === "231884"
);
assert.equal(
  splitCsv.length,
  4,
  `CSV must keep POS split rows for VS-10292226 / 231884, got ${splitCsv.length}`
);
const merged = collapseSplitTxnSkuRows(splitCsv);
assert.equal(merged.length, 1, "Top Models must merge same txn+SKU splits");
assert.ok(Math.abs((merged[0]?.quantity ?? 0) - 1) < 0.001, `merged qty ${merged[0]?.quantity}`);
assert.ok(
  Math.abs((merged[0]?.grossSales ?? 0) - 42995) < 0.02,
  `merged Sales Amount ${merged[0]?.grossSales}`
);
assert.ok(
  Math.abs((merged[0]?.netRevenue ?? 0) - 12898) < 0.02,
  `merged Total ${merged[0]?.netRevenue}`
);

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-12", endDate: "2026-09-12" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 330973.5) < 0.02,
    `Sep 12 CSV Total expected 330973.5 got ${netSales}`
  );
  assert.equal(sep12.length, 632, `Sep 12 rows ${sep12.length}`);
  assert.equal(new Set(sep12.map((r) => r.storeName)).size, 31);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-12",
    to: "2026-09-12",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    CC: 181336.49,
    IDDEAL: 80674.14,
    SYNC: 44180.06,
    KAFE: 31775.89,
    WELLS: 7175.57,
    ACIMA: 6630.49,
    CASH: 5710.89,
    PROG: 2650,
    AFFIRM: 400,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 360533.53) < 1, `paycode sum ${paySum}`);

  console.log("check-sep12-append: ok", {
    sep12Rows: sep12.length,
    sep12NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep12Stores: new Set(sep12.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep12Applied: +paySum.toFixed(2),
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
