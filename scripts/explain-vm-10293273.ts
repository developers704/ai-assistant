import {
  calculatorCeilingAmount,
  detectHighDiscounts,
} from "../src/lib/discounting/detect-high-discounts";
import { pickApproverForV1 } from "../src/lib/discounting/approvers";
import {
  loadTxnPaySplits,
  summarizePaySplit,
} from "../src/lib/discounting/load-txn-paycodes";
import { parseApprovalFromDescriptions } from "../src/lib/discounting/parse-approval";
import { resolveStoreDmOwner } from "../src/lib/discounting/store-dm-owners";
import { calculatePricing } from "../src/lib/inventory/pricing";
import { lookupInventory } from "../src/lib/inventory/store";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

const tid = "VM-10293273";
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
const lines: Record<string, unknown>[] = [];

for (const r of rows) {
  const sku = (r.sku || r.itemNumber || "").trim();
  if (!sku || sku.toUpperCase() === "ITEM") {
    lines.push({ sku, kind: "memo", desc: r.description });
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
  const cash =
    calculatePricing(item).tiers.find((t) => t.tier === "dm")?.cashPrice || 0;
  packageCash += cash;
  lines.push({
    sku,
    tag: r.grossSales,
    disc: r.discountAmount,
    sold: r.netRevenue,
    cash,
    design: r.design,
  });
}

const lineCash = 539.82;
const lineCeil = calculatorCeilingAmount(lineCash, "financing", 36);
const packageCeil = calculatorCeilingAmount(packageCash, "financing", 36);
const hits = detectHighDiscounts({ filterDate: "2026-08-13" }).hits.filter(
  (h) => h.transactionId === tid
);

console.log(
  JSON.stringify(
    {
      store,
      lines,
      approval: app,
      approver,
      pay,
      packageCash,
      packageCalc: packageCeil?.ceiling,
      packageWouldFlag:
        (packageCeil?.ceiling || 0) > (pay?.financePaid || 0) + 0.01,
      uiLineMath: {
        sold: 1100,
        cash: lineCash,
        ceiling: lineCeil?.ceiling,
        overage: 1100 - (lineCeil?.ceiling || 0),
      },
      liveHits: hits,
    },
    null,
    2
  )
);
