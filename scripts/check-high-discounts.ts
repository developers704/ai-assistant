/**
 * Self-check: high-discount pay codes, APP parse, overage logic.
 * Run: npx tsx scripts/check-high-discounts.ts
 */
import assert from "node:assert/strict";
import { normalizePayCode } from "../src/lib/discounting/pay-codes";
import { parseApprovalFromDescriptions } from "../src/lib/discounting/parse-approval";
import {
  loadApprovers,
  pickApproverForV1,
  resolveApprover,
} from "../src/lib/discounting/approvers";
import { getAllowedDiscountPercent } from "../src/lib/inventory/pricing";
import { calculatorCeilingAmount } from "../src/lib/discounting/detect-high-discounts";
import {
  isSingleTenderPayCode,
  loadTxnPayCodes,
  parseTxnPayCodesCsv,
} from "../src/lib/discounting/load-txn-paycodes";
import type { InventoryItem } from "../src/lib/inventory/types";

assert.equal(normalizePayCode("CASH"), "cash");
assert.equal(normalizePayCode("cc"), "credit_card");
assert.equal(normalizePayCode("PROG"), "lease");
assert.equal(normalizePayCode("ACIMA"), "lease");
assert.equal(normalizePayCode("UOWN"), "lease");
assert.equal(normalizePayCode("KAFE"), "lease");
assert.equal(normalizePayCode("AFFIRM"), "affirm");
assert.equal(normalizePayCode("AFF"), "affirm");
assert.equal(normalizePayCode("WELLS"), "financing");
assert.equal(normalizePayCode("IDDEAL"), "financing");
assert.equal(normalizePayCode("SYCHY"), "financing");
assert.equal(normalizePayCode("FLEX PAY"), "financing");
// Store-prefix / spaced hyphen (daily POS Pay Codes)
assert.equal(normalizePayCode("VJO-CASH"), "cash");
assert.equal(normalizePayCode("VJO-IDDEAL"), "financing");
assert.equal(normalizePayCode("BB - CC"), "credit_card");
assert.equal(normalizePayCode("BB - CC,"), "credit_card");
assert.equal(normalizePayCode("VJRE-KAFE,"), "lease");
assert.equal(normalizePayCode("VJSL-SYNCY,"), "financing");
assert.equal(normalizePayCode("VJM-FLEX"), "financing");
assert.equal(normalizePayCode("VJLV-SYNCHRONY"), "financing");
assert.equal(normalizePayCode("GE"), "financing");
assert.equal(normalizePayCode("GM-GE,"), "financing");
assert.equal(normalizePayCode("VJF-GE"), "financing");
assert.equal(normalizePayCode("VJF-GE,"), "financing");
// Multi-tender — ignore in v1
assert.equal(normalizePayCode("VJF-CASH,VJF-CC"), "unknown");
assert.equal(normalizePayCode("VJO-CASH,VJO-IDDEAL"), "unknown");
assert.equal(normalizePayCode("VJF-CASH,VJF-GE"), "unknown");

const app1 = parseApprovalFromDescriptions(["APP AJ IDDEAL 36/0"]);
assert.ok(app1.approverCodes.includes("AJ"));
assert.equal(app1.financingMonths, 36);

const app2 = parseApprovalFromDescriptions(["APP RM7/SM2"]);
assert.ok(app2.approverCodes.includes("SM2"));
assert.ok(app2.approverCodes.includes("RM7"));

const app3 = parseApprovalFromDescriptions(["APP/TL1", "FIN/WELLSFARGO/6/0"]);
assert.ok(app3.approverCodes.includes("TL1"));
assert.equal(app3.financingMonths, 6);

// Same Transaction # package: ITEM memos
const appPkg = parseApprovalFromDescriptions([
  "FINANCE SYNCHRONY 36/0",
  "APP/EG",
  "14KT NOVELLO BRIDAL SET",
]);
assert.ok(appPkg.approverCodes.includes("EG"));
assert.equal(appPkg.financingMonths, 36);

const approvers = loadApprovers(true);
assert.ok(approvers.has("SM2"));
assert.ok(approvers.has("AJ"));
assert.ok(approvers.has("RM7"));
assert.ok(approvers.has("AS-GM"));
assert.ok(approvers.has("TL-ARDEN"));
assert.ok(approvers.has("EG"));
assert.equal(resolveApprover("AJ-MOD")?.role, "dm");
assert.equal(resolveApprover("AJ-MOD")?.name, "Akber Jivani");
assert.equal(resolveApprover("AS-GM")?.role, "cm");
assert.equal(resolveApprover("AS-GM")?.name, "Adnan / Adi");
assert.equal(resolveApprover("AS")?.role, "m"); // Aurellia — not Adnan
assert.equal(resolveApprover("SHAUN-NORTH")?.role, "dm");
assert.equal(pickApproverForV1(["RM7", "SM2"])?.code, "SM2"); // prefer dm
assert.equal(pickApproverForV1(["TL-ARDEN"])?.role, "cm");
assert.equal(pickApproverForV1(["EG"])?.role, "m");
assert.equal(pickApproverForV1(["XX99"]), null);
const diamondish: InventoryItem = {
  sku: "TEST1",
  description: "Lab diamond ring",
  vendorModel: "X",
  vendor: "V",
  tagPrice: 1000,
  costPrice: 200,
  wholesaleCost: 200,
  store: "VJ-FRE",
  onHand: 1,
  department: "LADYS RING",
  design: "NOVELLO",
  class: "14KT",
  subClass: "",
  avgWeight: 0,
  brand: "",
};
const dmPct = getAllowedDiscountPercent(diamondish, "dm");
assert.ok(dmPct > 0, "calculator must return allowed %");

// Owner case: pearl 162088Y — DM cash + IdDeal 12/0 → ceiling ~$924; sold $1011.49 flags
const pearlTag = 4799;
const dmCash = pearlTag * (1 - 0.82); // 863.82
assert.ok(Math.abs(dmCash - 863.82) < 0.01);
const ceil12 = calculatorCeilingAmount(dmCash, "financing", 12);
assert.ok(ceil12);
assert.ok(Math.abs(ceil12!.ceiling - 924.2874) < 0.02, `12/0 ceiling got ${ceil12!.ceiling}`);
assert.equal(ceil12!.surchargePercent, 7);
const sold = 1011.49;
assert.ok(sold > ceil12!.ceiling + 0.01, "sale over ceiling → flag");
assert.equal(calculatorCeilingAmount(dmCash, "financing", null), null); // no months → skip
assert.equal(calculatorCeilingAmount(dmCash, "unknown", 12), null); // no paycode → skip

// Paycode overlay V1: single tender only
assert.equal(isSingleTenderPayCode("VJON-IDEAL,"), true);
assert.equal(isSingleTenderPayCode("VJF-IDDEAL,"), true);
assert.equal(isSingleTenderPayCode("VJPB-CASH,"), true);
assert.equal(isSingleTenderPayCode("VJON-CC,"), true);
assert.equal(isSingleTenderPayCode("VJCL-CASH,VJCL-CC,"), false);
assert.equal(isSingleTenderPayCode("BB-IDDEAL,BB-SYNC,"), false);
const samplePayCsv = `Transaction  #,Pay Codes
ON-10292259,"VJON-IDEAL,"
CL-10290979,"VJCL-CASH,VJCL-CC,"
`;
const parsedPay = parseTxnPayCodesCsv(samplePayCsv);
assert.equal(parsedPay.get("ON-10292259"), "VJON-IDEAL");
assert.equal(parsedPay.has("CL-10290979"), false);
const overlay = loadTxnPayCodes(true);
assert.ok(overlay.has("ON-10292259"), "Aug 11 paycode file must include pearl txn");
assert.equal(normalizePayCode(overlay.get("ON-10292259")), "financing");

console.log("check-high-discounts: ok", {
  dmPct,
  ceiling12: ceil12!.ceiling.toFixed(2),
  overage: (sold - ceil12!.ceiling).toFixed(2),
  overlaySize: overlay.size,
  pearlPay: overlay.get("ON-10292259"),
});
