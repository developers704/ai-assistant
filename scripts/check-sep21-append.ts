/**
 * Post-append sanity: Sep 21 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep21-append.ts
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

const DAY = "2026-09-21";
const rows = loadRankRows() ?? [];
const sep21 = rows.filter((r) => r.date === DAY);
assert.ok(sep21.length > 0, "Sep 21 rows must exist after append");

const netSales = sep21.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), DAY);
assert.ok(dates.includes("2026-09-20"), "Sep 20 must still be present");
assert.ok(dates.includes("2026-09-19"), "Sep 19 must still be present");

const splitCsv = sep21.filter(
  (r) => r.transactionId === "VO-10292556" && String(r.sku ?? r.itemNumber ?? "") === "224416-16"
);
assert.equal(
  splitCsv.length,
  2,
  `CSV must keep POS split rows for VO-10292556 / 224416-16, got ${splitCsv.length}`
);
const merged = collapseSplitTxnSkuRows(splitCsv);
assert.equal(merged.length, 1, "Top Models must merge same txn+SKU splits");
assert.ok(Math.abs((merged[0]?.quantity ?? 0) - 1) < 0.001, `merged qty ${merged[0]?.quantity}`);
assert.ok(
  Math.abs((merged[0]?.grossSales ?? 0) - 138) < 0.02,
  `merged Sales Amount ${merged[0]?.grossSales}`
);
assert.ok(
  Math.abs((merged[0]?.netRevenue ?? 0) - 138) < 0.02,
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
    Math.abs(netSales - 138843.53) < 0.02,
    `Sep 21 CSV Total expected 138843.53 got ${netSales}`
  );
  assert.equal(sep21.length, 276, `Sep 21 rows ${sep21.length}`);
  assert.equal(new Set(sep21.map((r) => r.storeName)).size, 27);

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
    CC: 39211.26,
    IDDEAL: 39145.63,
    CASH: 22513.27,
    SYNC: 20858,
    WELLS: 7000,
    KAFE: 3850,
    ACIMA: 1110,
    MULBRY: 60,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 133748.16) < 1, `paycode sum ${paySum}`);
  assert.equal(byName["GE"], undefined);
  assert.equal(byName["AFRM"], undefined);
  assert.equal(byName["IDEAL"], undefined);
  assert.equal(byName["WELS"], undefined);

  console.log("check-sep21-append: ok", {
    sep21Rows: sep21.length,
    sep21NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep21Stores: new Set(sep21.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep21Applied: +paySum.toFixed(2),
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
