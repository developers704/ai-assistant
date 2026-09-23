/**
 * Post-append sanity: Sep 22 2026 rows land in the live sales seed.
 * Run: npx tsx scripts/check-sep22-append.ts
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

const DAY = "2026-09-22";
const rows = loadRankRows() ?? [];
const sep22 = rows.filter((r) => r.date === DAY);
assert.ok(sep22.length > 0, "Sep 22 rows must exist after append");

const netSales = sep22.reduce((s, r) => s + r.netRevenue, 0);
const dates = [...new Set(rows.map((r) => r.date))].sort();
assert.equal(dates.at(-1), DAY);
assert.ok(dates.includes("2026-09-21"), "Sep 21 must still be present");
assert.ok(dates.includes("2026-09-20"), "Sep 20 must still be present");

const splitCsv = sep22.filter(
  (r) => r.transactionId === "VI-10292916" && String(r.sku ?? r.itemNumber ?? "") === "228318"
);
assert.equal(
  splitCsv.length,
  2,
  `CSV must keep POS split rows for VI-10292916 / 228318, got ${splitCsv.length}`
);
const merged = collapseSplitTxnSkuRows(splitCsv);
assert.equal(merged.length, 1, "Top Models must merge same txn+SKU splits");
assert.ok(Math.abs((merged[0]?.quantity ?? 0) - 1) < 0.001, `merged qty ${merged[0]?.quantity}`);
assert.ok(
  Math.abs((merged[0]?.grossSales ?? 0) - 89) < 0.02,
  `merged Sales Amount ${merged[0]?.grossSales}`
);
assert.ok(
  Math.abs((merged[0]?.netRevenue ?? 0) - 89) < 0.02,
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
    Math.abs(netSales - 145317.51) < 0.02,
    `Sep 22 CSV Total expected 145317.51 got ${netSales}`
  );
  assert.equal(sep22.length, 322, `Sep 22 rows ${sep22.length}`);
  assert.equal(new Set(sep22.map((r) => r.storeName)).size, 30);

  const payFile = path.join(process.cwd(), "data/reports/Payment-Transactions.csv");
  const legs = parsePaycodeLegs(fs.readFileSync(payFile, "utf8"));
  const sep22Legs = legs.filter((leg) => leg.date === DAY);
  assert.equal(sep22Legs.length, 104, `Sep 22 payment legs ${sep22Legs.length}`);
  const otherDayLeak = legs.filter((leg) => leg.date !== DAY && leg.txnId === "VV-70016167");
  assert.ok(otherDayLeak.length <= 1, "May OL leftover must not be appended again");

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
    IDDEAL: 50326.22,
    CASH: 34100.7,
    CC: 31806.86,
    SYNC: 30447.99,
    KAFE: 5614.76,
    ACIMA: 2650,
    CHK: 80,
  };
  for (const [name, amt] of Object.entries(expected)) {
    assert.ok(
      Math.abs((byName[name] ?? 0) - amt) < 0.02,
      `paycode ${name}: got ${byName[name] ?? 0} vs ${amt}`
    );
  }
  assert.ok(Math.abs(paySum - 155026.53) < 1, `paycode sum ${paySum}`);
  assert.equal(byName["GE"], undefined);
  assert.equal(byName["SYNY"], undefined);
  assert.equal(byName["IDEAL"], undefined);
  assert.equal(byName["SYNCHY"], undefined);

  console.log("check-sep22-append: ok", {
    sep22Rows: sep22.length,
    sep22NetSales: +netSales.toFixed(2),
    querySalesNet: +(q.summary!.netSales).toFixed(2),
    sep22Stores: new Set(sep22.map((r) => r.storeName)).size,
    dataThrough: dates.at(-1),
    paycodeSep22Applied: +paySum.toFixed(2),
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
