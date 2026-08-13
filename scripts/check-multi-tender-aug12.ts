/**
 * Verify Aug 12 multi-tender flag for VS-10292075.
 * Run: npx tsx scripts/check-multi-tender-aug12.ts
 */
import assert from "node:assert/strict";
import { detectHighDiscounts } from "../src/lib/discounting/detect-high-discounts";
import {
  clearTxnPayCodesCache,
  loadTxnPaySplits,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";

clearTxnPayCodesCache();
const splits = loadTxnPaySplits(true);
const split = splits.get("VS-10292075");
assert.ok(split, "paycode file must include VS-10292075");
const sum = summarizePaySplit(split);
assert.equal(sum.isMultiTender, true);
assert.ok(Math.abs(sum.cashPaid - 140.27) < 0.01);
assert.ok(Math.abs(sum.financePaid - 3100) < 0.01);

const r = detectHighDiscounts({ filterDate: "2026-08-12" });
const hit = r.hits.find((h) => h.transactionId === "VS-10292075");
assert.ok(hit, "VS-10292075 must flag as multi-tender overage");
assert.equal(hit.approver.code, "AJ");
assert.equal(hit.approver.name, "Akber Jivani");
assert.equal(hit.financingMonths, 60);
assert.ok(hit.ceilingAmount > 0);
assert.ok(hit.overageDollars > 0);
assert.ok(
  sum.financePaid > hit.ceilingAmount,
  `finance ${sum.financePaid} should exceed ceiling ${hit.ceilingAmount}`
);

console.log("check-multi-tender-aug12: ok", {
  cashPrice: hit.cashPrice.toFixed(2),
  ceiling: hit.ceilingAmount.toFixed(2),
  financePaid: sum.financePaid.toFixed(2),
  overage: hit.overageDollars.toFixed(2),
  sku: hit.sku,
  multiFlags: r.hits.filter((h) => h.payChannelLabel.startsWith("Split")).length,
  totalFlags: r.hits.length,
});
