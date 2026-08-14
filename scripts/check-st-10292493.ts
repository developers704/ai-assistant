/**
 * Verify ST-10292493: SYN Payment Amt is ceiling; calc under → no flag.
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
// calc ~$6.7–7.5k < Payment Amt $10,445.97 → under, no flag
assert.equal(
  hits.length,
  0,
  "ST-10292493 must NOT flag (calculated under Syn Payment Amt)"
);

console.log("check-st-10292493: ok", {
  synPaid: 10445.97,
  flagged: false,
  totalFlags: r.hits.length,
});
