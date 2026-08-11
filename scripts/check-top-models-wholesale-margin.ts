/**
 * Self-check: sheet formula beats stale Whole Cost; sales fallback works.
 * Run: npx tsx scripts/check-top-models-wholesale-margin.ts
 */
import { getVisibleDmCostPrice } from "../src/lib/inventory/pricing";
import { wholeCostFromRules } from "../src/lib/inventory/whole-cost-rules";
import { wholesaleProfitForModelRows } from "../src/lib/sales/top-models-wholesale-margin";
import type { VendorPosRow } from "../src/lib/reports/types";

function row(partial: Partial<VendorPosRow> & { netRevenue: number }): VendorPosRow {
  return {
    date: "2026-01-01",
    storeName: "VJ-TEST",
    department: "LADYS RING",
    design: "NOVELLO",
    vendor: "JLX",
    productClass: "AB",
    subClass: "",
    description: "Test",
    sku: "TEST-SKU-1",
    itemNumber: "TEST-SKU-1",
    vendorModel: "VM-1",
    style: "",
    quantity: 3,
    grossSales: partial.grossSales ?? partial.netRevenue,
    discountAmount: 0,
    netRevenue: partial.netRevenue,
    inventoryCost: 50,
    wholesaleCost: 0,
    margin: 999,
    discountRate: 0,
    transactionId: "T1",
    imageDir: "",
    ...partial,
  } as VendorPosRow;
}

let failed = 0;
function assert(name: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("sheet truth");
const radoCost = 2900 / 1.82 + 20;
assert(
  "Rado formula Tag/1.82+20",
  Math.abs((wholeCostFromRules({ department: "RADO" }, 2900) ?? 0) - radoCost) < 0.01
);
assert(
  "Rado DM cost ignores stale Whole Cost 1450",
  Math.abs(
    getVisibleDmCostPrice({
      sku: "207611",
      description: "RADO WATCH",
      vendorModel: "R30008302",
      vendor: "RADO",
      tagPrice: 2900,
      costPrice: 1595,
      wholesaleCost: 1450,
      store: "VJ-FRE",
      onHand: 1,
      department: "RADO",
      design: "WATCH",
      class: "MENS",
      subClass: "AUTOMATIC",
      avgWeight: 0,
      brand: "",
    }) - radoCost
  ) < 0.01
);

const radoMargin = (2204 - radoCost) / 2204;
assert(
  "Rado example margin ~27% not 34%",
  radoMargin > 0.26 && radoMargin < 0.28,
  `${(radoMargin * 100).toFixed(1)}%`
);

console.log("sales fallback");
const bridal = wholesaleProfitForModelRows([
  row({
    sku: "SKU-NOT-IN-INVENTORY-XYZ",
    department: "LADYS RING",
    design: "OVANI",
    productClass: "14KT",
    grossSales: 880,
    netRevenue: 800,
  }),
]);
assert(
  "missing inventory uses Sales Amount / 8.8",
  bridal.profit != null && Math.abs(bridal.profit - (800 - 880 / 8.8)) < 0.01,
  `profit=${bridal.profit}`
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nOK");
