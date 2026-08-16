import { pickApproverForV1 } from "../src/lib/discounting/approvers";
import { calculatorCeilingAmount } from "../src/lib/discounting/detect-high-discounts";
import {
  loadTxnPaySplits,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";
import { parseApprovalFromDescriptions } from "../src/lib/discounting/parse-approval";
import { calculatePricing } from "../src/lib/inventory/pricing";
import { lookupInventory } from "../src/lib/inventory/store";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

const tid = "HE-10001518";
const rows = (loadRankRows() ?? []).filter((r) => r.transactionId === tid);
console.log(
  JSON.stringify(
    {
      lines: rows.map((r) => ({
        date: r.date,
        sku: r.sku || r.itemNumber,
        qty: r.quantity,
        tag: r.grossSales,
        disc: r.discountAmount,
        sold: r.netRevenue,
        design: r.design,
        dept: r.department,
        desc: (r.description || "").slice(0, 90),
        pay: r.payCode,
      })),
      approval: parseApprovalFromDescriptions(
        rows.map((r) => r.description).filter(Boolean) as string[]
      ),
      approver: pickApproverForV1(
        parseApprovalFromDescriptions(
          rows.map((r) => r.description).filter(Boolean) as string[]
        ).approverCodes
      ),
      pay: (() => {
        const s = loadTxnPaySplits(true).get(tid);
        return s ? summarizePaySplit(s) : null;
      })(),
    },
    null,
    2
  )
);

const jewelry = rows.find((r) =>
  (r.sku || r.itemNumber || "").includes("197903")
);
if (jewelry) {
  const found = lookupInventory(
    jewelry.sku || jewelry.itemNumber,
    jewelry.storeName
  );
  const item = found?.item ? { ...found.item } : null;
  if (item) {
    if (!(item.tagPrice > 0)) item.tagPrice = jewelry.grossSales;
    if (!item.department) item.department = jewelry.department;
    if (!item.design) item.design = jewelry.design;
    const dm = calculatePricing(item).tiers.find((t) => t.tier === "dm");
    const ceil = calculatorCeilingAmount(dm?.cashPrice || 0, "credit_card", null);
    console.log(
      JSON.stringify(
        {
          tag: item.tagPrice,
          dmCash: dm?.cashPrice,
          dmPct: dm?.discountPercent,
          ccCeiling: ceil,
          sold: jewelry.netRevenue,
          overage: jewelry.netRevenue - (ceil?.ceiling || 0),
        },
        null,
        2
      )
    );
  }
}
