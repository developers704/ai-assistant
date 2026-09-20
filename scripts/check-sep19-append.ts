/**
 * Post-append sanity: Sep 19 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep19-append.ts
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

const DAY = "2026-09-19";
const rows = loadRankRows() ?? [];
const sep19 = rows.filter((r) => r.date === DAY);
assert.ok(sep19.length > 0, "Sep 19 rows must exist after append");

const netSales = sep19.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), DAY);
assert.ok(dates.includes("2026-09-18"), "Sep 18 must still be present");
assert.ok(dates.includes("2026-09-17"), "Sep 17 must still be present");

const splitCsv = sep19.filter(
  (r) => r.transactionId === "PB-10291742" && String(r.sku ?? r.itemNumber ?? "") === "042429610644"
);
assert.equal(
  splitCsv.length,
  2,
  `CSV must keep POS split rows for PB-10291742 / 042429610644, got ${splitCsv.length}`
);
const merged = collapseSplitTxnSkuRows(splitCsv);
assert.equal(merged.length, 1, "Top Models must merge same txn+SKU splits");
assert.ok(Math.abs((merged[0]?.quantity ?? 0) - 1) < 0.001, `merged qty ${merged[0]?.quantity}`);
assert.ok(
  Math.abs((merged[0]?.grossSales ?? 0) - 450.5) < 0.02,
  `merged Sales Amount ${merged[0]?.grossSales}`
);
assert.ok(
  Math.abs((merged[0]?.netRevenue ?? 0) - 450.46) < 0.02,
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
    Math.abs(netSales - 317913.54) < 0.02,
    `Sep 19 CSV Total expected 317913.54 got ${netSales}`
  );
  assert.equal(sep19.length, 645, `Sep 19 rows ${sep19.length}`);
  assert.equal(new Set(sep19.map((r) => r.storeName)).size, 30);

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
    IDDEAL: 122537.98,
    CC: 105334.84,
    KAFE: 39665.56,
    WELLS: 26949.77,
    CASH: 19324.43,
    SYNC: 14065.27,
    PROG: 4100,
    ACIMA: 3677,
    AFFIRM: 2092.85,
    MULBRY: 12,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 337759.7) < 1, `paycode sum ${paySum}`);
  assert.equal(byName["GE"], undefined);
  assert.equal(byName["AFRM"], undefined);

  console.log("check-sep19-append: ok", {
    sep19Rows: sep19.length,
    sep19NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep19Stores: new Set(sep19.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep19Applied: +paySum.toFixed(2),
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
