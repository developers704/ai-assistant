/**
 * Verify ST-10292493 Synchrony package math + parse fixes.
 * Run: npx tsx scripts/check-st-10292493.ts
 */
import assert from "node:assert/strict";
import {
  loadApprovers,
  pickApproverForV1,
  resolveApprover,
} from "../src/lib/discounting/approvers";
import { detectHighDiscounts } from "../src/lib/discounting/detect-high-discounts";
import { parseApprovalFromDescriptions } from "../src/lib/discounting/parse-approval";

loadApprovers(true);

const descs = [
  '14KT"NOVELLO-COLLECTION"  IGI CERT LABGROWN DIAMOND EMERALD BRIDAL RING',
  "14KT YELLOW-GOLD MIAMI CUBAN ID 3MM",
  "Mulberry 36 Month Care Plan ($1,500-$1,999.99)",
  "SYN 48/0 APP TL",
  "14KT YG LAB GROWN 3CT MARQUIS  CENTER 6 PRONG CUSTOM RING SIZE 6",
  "Mulberry 36 Month Care Plan ($6,000-$7,999.99)",
];
const a = parseApprovalFromDescriptions(descs);
assert.equal(a.financingMonths, 48, "must read SYN 48/0 not Mulberry 36");
assert.ok(a.approverCodes.includes("TL"));
assert.equal(pickApproverForV1(a.approverCodes)?.code, "TL");
assert.equal(resolveApprover("TL")?.role, "cm");

const r = detectHighDiscounts({ filterDate: "2026-08-12" });
const hits = r.hits.filter((h) => h.transactionId === "ST-10292493");
assert.equal(hits.length, 1, "one package flag, not per-SKU");
const hit = hits[0]!;
assert.equal(hit.financingMonths, 48);
assert.equal(hit.surchargePercent, 28);
assert.ok(hit.sku.includes("226859Y") && hit.sku.includes("197438-8"));
assert.ok(hit.ceilingAmount > 6000 && hit.ceilingAmount < 9000);
assert.ok(hit.overageDollars > 2000, `overage ${hit.overageDollars}`);
assert.equal(hit.approver.code, "TL");

console.log("check-st-10292493: ok", {
  cash: hit.cashPrice.toFixed(2),
  ceiling: hit.ceilingAmount.toFixed(2),
  synPaid: 10445.97,
  overage: hit.overageDollars.toFixed(2),
  months: hit.financingMonths,
  surcharge: hit.surchargePercent,
  approver: `${hit.approver.name} (${hit.approver.role})`,
  sku: hit.sku,
});
