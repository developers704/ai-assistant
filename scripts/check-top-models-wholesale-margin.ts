/**
 * Self-check: Whole Cost rules + Top Vendor Models sales fallback.
 * Run: npx tsx scripts/check-top-models-wholesale-margin.ts
 */
import { getVisibleDmCostPrice } from "../src/lib/inventory/pricing";
import { wholeCostFromRules } from "../src/lib/inventory/whole-cost-rules";
import {
  calculatorWholesaleUnitCost,
  wholesaleProfitForModelRows,
} from "../src/lib/sales/top-models-wholesale-margin";
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

console.log("whole-cost-rules");
assert(
  "diamond LADYS RING = base/8.8",
  Math.abs((wholeCostFromRules({ department: "LADYS RING" }, 880) ?? 0) - 100) < 1e-9
);
assert(
  "MICHAEL KO = base/2+10",
  Math.abs((wholeCostFromRules({ department: "MICHAEL KO" }, 200) ?? 0) - 110) < 1e-9
);
assert(
  "filled Whole Cost wins over formula",
  getVisibleDmCostPrice({
    sku: "x",
    description: "",
    vendorModel: "",
    vendor: "",
    tagPrice: 1300,
    costPrice: 0,
    wholesaleCost: 99,
    store: "",
    onHand: 0,
    department: "LADYS RING",
    design: "",
    class: "UV",
    subClass: "",
    avgWeight: 0,
    brand: "",
  }) === 99
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
  "missing inventory LADYS RING uses Sales Amount / 8.8",
  bridal.profit != null &&
    bridal.marginRate != null &&
    Math.abs(bridal.profit - (800 - 880 / 8.8)) < 0.01,
  `profit=${bridal.profit}`
);

const lines = [
  row({ netRevenue: 400, quantity: 5, sku: "A", department: "EARRINGS", grossSales: 400 }),
  row({ netRevenue: 200, quantity: 1, sku: "A", department: "EARRINGS", grossSales: 200 }),
];
// Both EARRINGS → /8.8 on sales amount when no inventory
const p = wholesaleProfitForModelRows(lines);
assert(
  "qty ignored (unit cost per line, not × qty)",
  p.profit != null &&
    Math.abs(p.profit - (400 - 400 / 8.8 + 200 - 200 / 8.8)) < 0.01,
  `profit=${p.profit}`
);

void calculatorWholesaleUnitCost;

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nOK");
