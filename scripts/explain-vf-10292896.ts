import { pickApproverForV1 } from "../src/lib/discounting/approvers";
import {
  calculatorCeilingAmount,
  ccToCashEquivalent,
  multiTenderMaxFinance,
} from "../src/lib/discounting/detect-high-discounts";
import {
  loadTxnPaySplits,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";
import { parseApprovalFromDescriptions } from "../src/lib/discounting/parse-approval";
import { resolveStoreDmOwner } from "../src/lib/discounting/store-dm-owners";
import { calculatePricing } from "../src/lib/inventory/pricing";
import { lookupInventory } from "../src/lib/inventory/store";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

const tid = "VF-10292896";
const rows = (loadRankRows() ?? []).filter((r) => r.transactionId === tid);
const app = parseApprovalFromDescriptions(
  rows.map((r) => r.description).filter(Boolean) as string[]
);
const store = rows[0]?.storeName || "";
const approver =
  pickApproverForV1(app.approverCodes) || resolveStoreDmOwner(store);
const split = loadTxnPaySplits(true).get(tid);
const pay = split ? summarizePaySplit(split) : null;

let packageCash = 0;
let mulberry = 0;
const lines: Record<string, unknown>[] = [];

for (const r of rows) {
  const sku = (r.sku || r.itemNumber || "").trim();
  if (!sku || sku.toUpperCase() === "ITEM") continue;
  if (sku.toUpperCase().startsWith("MLB") || /mulberry/i.test(r.description || "")) {
    mulberry += Math.max(0, r.netRevenue);
    lines.push({ sku, kind: "mulberry", net: r.netRevenue });
    continue;
  }
  if (!(r.grossSales > 0)) continue;
  const found = lookupInventory(sku, r.storeName);
  const item = found?.item
    ? { ...found.item }
    : {
        sku,
        description: r.description,
        vendorModel: r.vendorModel,
        vendor: r.vendor,
        tagPrice: r.grossSales,
        costPrice: r.inventoryCost,
        wholesaleCost: r.wholesaleCost,
        store: r.storeName,
        onHand: 0,
        department: r.department,
        design: r.design,
        class: r.productClass,
        subClass: r.subClass,
        avgWeight: 0,
        brand: "",
      };
  if (!(item.tagPrice > 0)) item.tagPrice = r.grossSales;
  if (!item.department) item.department = r.department;
  if (!item.design) item.design = r.design;
  if (!item.class) item.class = r.productClass;
  const tier = app.approverCodes.length ? approver?.role || "dm" : "dm";
  const priced = calculatePricing(item).tiers.find((t) => t.tier === tier);
  const cash = priced?.cashPrice || 0;
  packageCash += cash;
  lines.push({
    sku,
    kind: "jewelry",
    tag: r.grossSales,
    disc: r.discountAmount,
    sold: r.netRevenue,
    cash,
    tier,
  });
}
packageCash += mulberry;

const maxFin = multiTenderMaxFinance({
  packageCash,
  cashPaid: pay?.cashPaid || 0,
  ccPaid: pay?.ccPaid || 0,
  financeChannel: pay?.financeChannel || "financing",
  financingMonths: app.financingMonths,
});

const paymentCeiling = pay?.financePaid || 0;
const calculated = maxFin?.maxFinance || 0;

console.log(
  JSON.stringify(
    {
      store,
      lines,
      approval: app,
      approver,
      pay,
      packageCash,
      mulberry,
      ccCashEq: ccToCashEquivalent(pay?.ccPaid || 0),
      remaining:
        packageCash -
        (pay?.cashPaid || 0) -
        ccToCashEquivalent(pay?.ccPaid || 0),
      calculated,
      paymentCeiling,
      overage: calculated - paymentCeiling,
      surcharge: maxFin?.surchargePercent,
      singleCeilCheck: calculatorCeilingAmount(
        packageCash,
        "financing",
        app.financingMonths
      ),
    },
    null,
    2
  )
);
