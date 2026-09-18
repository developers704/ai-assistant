/**
 * Post-append sanity: Sep 16 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep16-append.ts
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
const sep16 = rows.filter((r) => r.date === "2026-09-16");
assert.ok(sep16.length > 0, "Sep 16 rows must exist after append");

const netSales = sep16.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.ok(dates.includes("2026-09-16"), "Sep 16 must remain in the seed after later daily appends");
assert.ok(dates.includes("2026-09-15"), "Sep 15 must still be present");
assert.ok(dates.includes("2026-09-14"), "Sep 14 must still be present");

const splitCsv = sep16.filter(
  (r) => r.transactionId === "SR-10291504" && String(r.sku ?? r.itemNumber ?? "") === "205702"
);
assert.equal(
  splitCsv.length,
  2,
  `CSV must keep POS split rows for SR-10291504 / 205702, got ${splitCsv.length}`
);
const merged = collapseSplitTxnSkuRows(splitCsv);
assert.equal(merged.length, 1, "Top Models must merge same txn+SKU splits");
assert.ok(Math.abs((merged[0]?.quantity ?? 0) - 1) < 0.001, `merged qty ${merged[0]?.quantity}`);
assert.ok(
  Math.abs((merged[0]?.grossSales ?? 0) - 80995) < 0.02,
  `merged Sales Amount ${merged[0]?.grossSales}`
);
assert.ok(
  Math.abs((merged[0]?.netRevenue ?? 0) - 22000) < 0.02,
  `merged Total ${merged[0]?.netRevenue}`
);

const gentsSplit = sep16.filter(
  (r) => r.transactionId === "NO-10001385" && String(r.sku ?? r.itemNumber ?? "") === "151621"
);
assert.equal(
  gentsSplit.length,
  2,
  `CSV must keep POS split rows for NO-10001385 / 151621, got ${gentsSplit.length}`
);
const gentsMerged = collapseSplitTxnSkuRows(gentsSplit);
assert.equal(gentsMerged.length, 1, "Gents ring split must merge to one Top Models line");
assert.ok(Math.abs((gentsMerged[0]?.quantity ?? 0) - 1) < 0.001);

async function main() {
  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-09-16", endDate: "2026-09-16" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true },
    limit: 50,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(Math.abs((q.summary?.netSales ?? 0) - netSales) < 0.02);
  assert.ok(
    Math.abs(netSales - 163227.88) < 0.02,
    `Sep 16 CSV Total expected 163227.88 got ${netSales}`
  );
  assert.equal(sep16.length, 326, `Sep 16 rows ${sep16.length}`);
  assert.equal(new Set(sep16.map((r) => r.storeName)).size, 31);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const totals = paycodeTotalsForPaymentWindow({
    from: "2026-09-16",
    to: "2026-09-16",
    legs,
  });
  const leaked = leakedPaycodeAliases(listPaycodes());
  assert.equal(leaked.length, 0, `leaked aliases: ${leaked.join(",")}`);

  const byName = Object.fromEntries(totals.map((t) => [t.name, t.revenue]));
  const paySum = totals.reduce((s, t) => s + t.revenue, 0);
  const expected: Record<string, number> = {
    CC: 101645.77,
    IDDEAL: 53348.94,
    SYNC: 12095.26,
    KAFE: 6152.99,
    CASH: 2050.68,
    ACIMA: 890,
    MULBRY: 48,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 176231.64) < 1, `paycode sum ${paySum}`);

  console.log("check-sep16-append: ok", {
    sep16Rows: sep16.length,
    sep16NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep16Stores: new Set(sep16.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep16Applied: +paySum.toFixed(2),
    paycodeGroups: Object.fromEntries(
      Object.keys(expected).map((k) => [k, +(byName[k] ?? 0).toFixed(2)])
    ),
    splitCsvRows: splitCsv.length,
    mergedQty: merged[0]?.quantity,
    mergedGross: merged[0]?.grossSales,
    mergedNet: merged[0]?.netRevenue,
    gentsSplitCsvRows: gentsSplit.length,
    gentsMergedQty: gentsMerged[0]?.quantity,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
