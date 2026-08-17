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
import {
  calculatorCeilingAmount,
  ccToCashEquivalent,
  multiTenderMaxFinance,
} from "../src/lib/discounting/detect-high-discounts";
import {
  isSingleTenderPayCode,
  loadTxnPayCodes,
  loadTxnPaySplits,
  parseTxnPayCodesCsv,
  parseTxnPaySplitsCsv,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";
import { resolveStoreDmOwner } from "../src/lib/discounting/store-dm-owners";
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

// SYN 48/0 must win over Mulberry "36 Month" / "SIZE 6"
const appSyn48 = parseApprovalFromDescriptions([
  "Mulberry 36 Month Care Plan ($1,500-$1,999.99)",
  "SYN 48/0 APP TL",
  "CUSTOM RING SIZE 6",
]);
assert.equal(appSyn48.financingMonths, 48);
assert.ok(appSyn48.approverCodes.includes("TL"));
assert.equal(resolveApprover("TL")?.name, "Kevin / Thanh");
assert.equal(resolveApprover("TL")?.role, "cm");

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

// Store DM owners — Serra → AJ
assert.equal(resolveStoreDmOwner("VJ-SERRA")?.code, "AJ");
assert.equal(resolveStoreDmOwner("VJ-SERRA")?.name, "Akber Jivani");
assert.equal(resolveStoreDmOwner("VJ-BAKER")?.code, "AJ");

// Multi-tender formula: cash + IDDEAL 60/0 (owner example ~2130 package)
assert.equal(ccToCashEquivalent(140), 140);
const cashMix = multiTenderMaxFinance({
  packageCash: 2130,
  cashPaid: 140,
  ccPaid: 0,
  financeChannel: "financing",
  financingMonths: 60,
});
assert.ok(cashMix);
assert.ok(Math.abs(cashMix!.remainingCash - 1990) < 0.01);
assert.ok(Math.abs(cashMix!.maxFinance - 1990 * 1.32) < 0.05);
assert.equal(cashMix!.surchargePercent, 32);
// New rule: ceiling = Payment Amt; flag only if calculated > Payment Amt
assert.ok(
  cashMix!.maxFinance < 3100,
  "calc 2627 < Payment Amt 3100 → under, no flag"
);

const ccMix = multiTenderMaxFinance({
  packageCash: 2130,
  cashPaid: 0,
  ccPaid: 140,
  financeChannel: "financing",
  financingMonths: 60,
});
assert.ok(ccMix);
assert.ok(Math.abs(ccMix!.remainingCash - (2130 - 140)) < 0.05);
assert.ok(Math.abs(ccMix!.maxFinance - (2130 - 140) * 1.32) < 0.1);

// Payment-export shape (multi-row + Payment Amt)
const payExport = `Store,Transaction  #,Type,Pay Code,Payment Amt
VJ-SERRA,VS-10292075,"Sales,",VJS-CASH,140.27
VJ-SERRA,VS-10292075,"Sales,",VJS-IDDEAL,"3,100.00"
`;
const splits = parseTxnPaySplitsCsv(payExport);
const vs = splits.get("VS-10292075");
assert.ok(vs);
const vsSum = summarizePaySplit(vs!);
assert.equal(vsSum.isMultiTender, true);
assert.ok(Math.abs(vsSum.cashPaid - 140.27) < 0.001);
assert.ok(Math.abs(vsSum.financePaid - 3100) < 0.001);
assert.equal(vsSum.financeChannel, "financing");

const liveSplits = loadTxnPaySplits(true);
if (liveSplits.has("VS-10292075")) {
  const live = summarizePaySplit(liveSplits.get("VS-10292075")!);
  assert.equal(live.isMultiTender, true);
  assert.ok(live.financePaid >= 3100 - 0.01);
}

console.log("check-high-discounts: ok", {
  dmPct,
  ceiling12: ceil12!.ceiling.toFixed(2),
  overage: (sold - ceil12!.ceiling).toFixed(2),
  overlaySize: overlay.size,
  pearlPay: overlay.get("ON-10292259"),
  cashMaxFin: cashMix!.maxFinance.toFixed(2),
  ccMaxFin: ccMix!.maxFinance.toFixed(2),
});
