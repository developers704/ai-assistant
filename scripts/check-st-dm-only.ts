import { calculatorCeilingAmount } from "../src/lib/discounting/detect-high-discounts";
import { calculatePricing } from "../src/lib/inventory/pricing";
import { lookupInventory } from "../src/lib/inventory/store";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

const rows = (loadRankRows() ?? []).filter(
  (r) => r.transactionId === "ST-10292493" && r.date === "2026-08-12"
);
let jewelry = 0;
let mulberry = 0;
const lines: Record<string, unknown>[] = [];
for (const r of rows) {
  const sku = (r.sku || r.itemNumber || "").trim();
  if (!sku || sku.toUpperCase() === "ITEM") continue;
  if (
    sku.toUpperCase().startsWith("MLB") ||
    /mulberry/i.test(r.description || "")
  ) {
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
  if (!(item.tagPrice > 0) && r.grossSales > 0) item.tagPrice = r.grossSales;
  if (!item.department && r.department) item.department = r.department;
  if (!item.design && r.design) item.design = r.design;
  if (!item.class && r.productClass) item.class = r.productClass;
  const dm = calculatePricing(item).tiers.find((t) => t.tier === "dm");
  const cash = dm?.cashPrice ?? 0;
  jewelry += cash;
  lines.push({ sku, kind: "jewelry", cash, sold: r.netRevenue });
}
const pkg = jewelry + mulberry;
const ceil = calculatorCeilingAmount(pkg, "financing", 48);
const syn = 10445.97;
console.log(
  JSON.stringify(
    {
      lines,
      jewelry: +jewelry.toFixed(2),
      mulberry: +mulberry.toFixed(2),
      packageCashDM: +pkg.toFixed(2),
      ceiling48: ceil ? +ceil.ceiling.toFixed(2) : null,
      synPaid: syn,
      overage: ceil ? +(syn - ceil.ceiling).toFixed(2) : null,
      isOverage: ceil ? syn > ceil.ceiling + 0.01 : null,
    },
    null,
    2
  )
);
