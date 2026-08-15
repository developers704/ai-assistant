/**
 * Returns (Qty −1) must never appear in Discounting hits.
 * Run: npx tsx scripts/check-returns-ignored.ts [YYYY-MM-DD]
 */
import assert from "node:assert/strict";
import { detectHighDiscounts } from "../src/lib/discounting/detect-high-discounts";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

const date = process.argv[2] || "2026-08-14";
const rows = (loadRankRows() ?? []).filter((r) => r.date === date);

const returnRows = rows.filter((r) => r.quantity < 0 || r.netRevenue < 0);
const returnTxns = new Set(returnRows.map((r) => r.transactionId));
const returnSkus = new Set(
  returnRows.map((r) => (r.sku || r.itemNumber || "").trim().toUpperCase())
);

const result = detectHighDiscounts({ filterDate: date });

const hitsOnReturnSku = result.hits.filter((h) =>
  h.sku
    .split("+")
    .some((s) => returnSkus.has(s.trim().toUpperCase()))
);
const hitsOnReturnTxn = result.hits.filter((h) =>
  returnTxns.has(h.transactionId)
);

assert.ok(
  result.hits.every((h) => h.soldTotal >= 0),
  "no hit may carry negative sold"
);
assert.equal(
  hitsOnReturnTxn.length,
  0,
  `transactions with a Qty −1 leg must be skipped: ${hitsOnReturnTxn
    .map((h) => h.transactionId)
    .join(", ")}`
);

console.log("check-returns-ignored:", {
  date,
  rows: rows.length,
  returnLines: returnRows.length,
  returnTxns: returnTxns.size,
  hits: result.hits.length,
  hitsOnReturnTxn: hitsOnReturnTxn.map((h) => ({
    txn: h.transactionId,
    sku: h.sku,
    over: +h.overageDollars.toFixed(2),
  })),
  hitsOnReturnSku: hitsOnReturnSku.map((h) => ({
    txn: h.transactionId,
    sku: h.sku,
  })),
});
