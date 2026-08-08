/**
 * Verify Transaction # package join for GM-10293171 (ITEM APP/FIN + product).
 * Run: npx tsx scripts/verify-txn-package.ts
 */
import assert from "node:assert/strict";
import { loadTxnPackageMemos } from "../src/lib/discounting/load-txn-memos";
import { parseApprovalFromDescriptions } from "../src/lib/discounting/parse-approval";
import { pickApproverForV1 } from "../src/lib/discounting/approvers";
import { detectHighDiscounts } from "../src/lib/discounting/detect-high-discounts";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";
import { normalizePayCode } from "../src/lib/discounting/pay-codes";

const TID = "GM-10293171";

const memos = loadTxnPackageMemos({ filterDate: "2026-08-07" });
const descs = memos.descByTxn.get(TID) ?? [];
assert.ok(descs.length >= 2, `expected ITEM memos for ${TID}, got ${descs.length}`);
assert.ok(
  descs.some((d) => /APP\/EG/i.test(d)),
  `APP/EG missing in ${JSON.stringify(descs)}`
);
assert.ok(
  descs.some((d) => /FINANCE|SYNCHRONY/i.test(d)),
  `FINANCE missing in ${JSON.stringify(descs)}`
);

const approval = parseApprovalFromDescriptions(descs);
assert.ok(approval.approverCodes.includes("EG"));
assert.equal(approval.financingMonths, 36);
assert.equal(pickApproverForV1(approval.approverCodes)?.code, "EG");
assert.equal(pickApproverForV1(approval.approverCodes)?.role, "m");

const products = (loadRankRows() ?? []).filter((r) => r.transactionId === TID);
assert.ok(products.length >= 1, "product line should remain in filtered sales");

const hit = detectHighDiscounts({ filterDate: "2026-08-07" }).hits.find(
  (h) => h.transactionId === TID
);

console.log(
  JSON.stringify(
    {
      tid: TID,
      memoDescs: descs,
      approval,
      product: products.map((r) => ({
        sku: r.sku || r.itemNumber,
        disc: r.discountAmount,
        sales: r.grossSales,
        pay: r.payCode,
        channel: normalizePayCode(r.payCode),
      })),
      flagged: hit
        ? {
            given: +hit.givenPct.toFixed(1),
            allowed: hit.allowedPct,
            approver: hit.approver,
            months: hit.financingMonths,
            pay: hit.payCode,
            channel: hit.payChannel,
          }
        : null,
      note: hit
        ? "product over manager limit → flagged"
        : "package joined; not flagged (within allowed % or no disc)",
    },
    null,
    2
  )
);

console.log("verify-txn-package: ok");
