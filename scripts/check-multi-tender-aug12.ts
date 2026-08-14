/**
 * Verify Aug 12 multi-tender: calculated vs Payment Amt (flag only if calc > pay).
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
// calc ~$2629 < Payment Amt $3100 → under, no flag
assert.equal(
  hit,
  undefined,
  "VS-10292075 must NOT flag (calculated under Payment Amt)"
);

console.log("check-multi-tender-aug12: ok", {
  financePaid: sum.financePaid,
  flagged: false,
  totalFlags: r.hits.length,
});
