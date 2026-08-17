/**
 * Cash/CC-only packages use paycode Payment Amt as ceiling.
 * Run: npx tsx scripts/check-cash-cc-payment-amount.ts
 */
import assert from "node:assert/strict";
import {
  calculatorCeilingAmount,
  detectHighDiscounts,
} from "../src/lib/discounting/detect-high-discounts";
import {
  loadTxnPaySplits,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";

const cashCalc = calculatorCeilingAmount(1187.82, "cash", null);
assert.ok(cashCalc);
assert.ok(Math.abs(cashCalc.ceiling - 1187.82) < 0.01);
assert.ok(cashCalc.ceiling < 1609.19, "cash calculated < Payment Amt → no flag");

const ccCalc = calculatorCeilingAmount(3226.65, "credit_card", null);
assert.ok(ccCalc);
assert.ok(Math.abs(ccCalc.ceiling - 3226.65) < 0.02);
assert.ok(ccCalc.ceiling < 5000, "CC calculated < Payment Amt → no flag");

const splits = loadTxnPaySplits(true);
const cashPay = summarizePaySplit(splits.get("HE-10001519")!);
const ccPay = summarizePaySplit(splits.get("HE-10001518")!);
assert.equal(cashPay.singleChannel, "cash");
assert.ok(Math.abs(cashPay.cashPaid - 1609.19) < 0.01);
assert.equal(ccPay.singleChannel, "credit_card");
assert.ok(Math.abs(ccPay.ccPaid - 5000) < 0.01);

const result = detectHighDiscounts({ filterDate: "2026-08-14" });
assert.equal(
  result.hits.some((h) => h.transactionId === "HE-10001519"),
  false,
  "cash txn calculated under Payment Amt must not flag"
);
assert.equal(
  result.hits.some((h) => h.transactionId === "HE-10001518"),
  false,
  "CC txn calculated under Payment Amt must not flag"
);

console.log("check-cash-cc-payment-amount: ok", {
  cash: {
    calculated: cashCalc.ceiling.toFixed(2),
    paymentAmt: cashPay.cashPaid.toFixed(2),
    flagged: false,
  },
  creditCard: {
    calculated: ccCalc.ceiling.toFixed(2),
    paymentAmt: ccPay.ccPaid.toFixed(2),
    flagged: false,
  },
  aug14Flags: result.hits.length,
});
