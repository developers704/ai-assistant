/**
 * Self-check: sheet formula beats stale Whole Cost; sales fallback works.
 * Run: npx tsx scripts/check-top-models-wholesale-margin.ts
 */
import { getVisibleDmCostPrice } from "../src/lib/inventory/pricing";
import { wholeCostFromRules } from "../src/lib/inventory/whole-cost-rules";
import {
  collapseCancelledSkuLegs,
  wholesaleProfitForModelRows,
} from "../src/lib/sales/top-models-wholesale-margin";
import { salesUnitsSold } from "../src/lib/utils";
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

console.log("hard rules");
assert(
  "GOLD JEWL + Ultimate Value → ÷1.3",
  Math.abs(
    (wholeCostFromRules(
      {
        design: "GOLD JEWL",
        department: "GOLD CHAIN",
        class: "10KT",
        description: '10KT "ULTIMATE VALUE" YELLOW-GOLD D/C ROPE CHAIN',
      },
      2724
    ) ?? 0) - 2724 / 1.3
  ) < 0.01
);
assert(
  "Diamond + UV in description → ÷8.8",
  Math.abs(
    (wholeCostFromRules(
      {
        sku: "999001",
        department: "LADYS RING",
        design: "NOVELLO",
        description: "LAB-GROWN DIAMOND ULTIMATE VALUE HALO RING",
      },
      880
    ) ?? 0) - 880 / 8.8
  ) < 0.01
);
assert(
  "fixed SKU wins over diamond UV ÷8.8",
  (wholeCostFromRules(
    {
      sku: "231611",
      department: "LADYS RING",
      description: "DIAMOND ULTIMATE VALUE RING",
    },
    499
  ) ?? 0) === 350
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

const uvGold = wholesaleProfitForModelRows([
  row({
    sku: "SKU-UV-GOLD-CHAIN-XYZ",
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    productClass: "10KT",
    description: '10KT "ULTIMATE VALUE" YELLOW-GOLD D/C ROPE CHAIN (NO WARRANTY)',
    grossSales: 2724,
    netRevenue: 2724,
  }),
]);
const uvGoldCost = 2724 / 1.3;
assert(
  "GOLD JEWL+UV sales margin uses ÷1.3",
  uvGold.profit != null && Math.abs(uvGold.profit - (2724 - uvGoldCost)) < 0.01,
  `profit=${uvGold.profit} rate=${uvGold.marginRate}`
);

// Sales Amount base (not Tag): GOLD JEWL ÷4 on gross 1388 → 347
const fromSalesAmt = wholesaleProfitForModelRows([
  row({
    sku: "234687-8",
    department: "GOLD ID",
    design: "GOLD JEWL",
    productClass: "10KT",
    description: "10KT YELLOW-GOLD HLW MILANO ROPE BRACELET (NO WARRANTY)",
    quantity: 1,
    grossSales: 1388,
    netRevenue: 415.7,
  }),
]);
assert(
  "sales dashboard uses Sales Amount÷4 not Tag÷4",
  fromSalesAmt.profit != null &&
    Math.abs(fromSalesAmt.profit - (415.7 - 1388 / 4)) < 0.01,
  `profit=${fromSalesAmt.profit}`
);

console.log("cancel legs");
const qkvkStyle = [
  row({
    date: "2026-08-08",
    storeName: "VJ-VAL",
    transactionId: "FA-10291461",
    sku: "205357-20",
    vendorModel: "QKVK100001",
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    productClass: "18KT",
    quantity: 1,
    grossSales: 27510,
    netRevenue: 10909.09,
  }),
  row({
    date: "2026-08-08",
    storeName: "VJ-VAL",
    transactionId: "FA-10291462",
    sku: "205357-20",
    vendorModel: "QKVK100001",
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    productClass: "18KT",
    quantity: -1,
    grossSales: -27510,
    netRevenue: -10909.09,
  }),
  row({
    date: "2026-08-10",
    storeName: "VJ-SERRA",
    transactionId: "VS-KEEP",
    sku: "205351-8",
    vendorModel: "QKVK100001",
    department: "GOLD ID",
    design: "GOLD JEWL",
    productClass: "18KT",
    quantity: 1,
    grossSales: 12707,
    netRevenue: 5733.78,
  }),
];
const collapsed = collapseCancelledSkuLegs(qkvkStyle);
assert(
  "collapse drops cross-txn cancelled SKU pair",
  collapsed.length === 1 && collapsed[0].sku === "205351-8",
  `len=${collapsed.length}`
);
const units = collapsed.reduce((s, r) => s + salesUnitsSold(r.quantity), 0);
assert("collapse leaves 1 real unit", units === 1, `units=${units}`);
const wp = wholesaleProfitForModelRows(qkvkStyle);
assert(
  "QKVK-style margin uses only kept sale (not −30%)",
  wp.marginRate != null && wp.marginRate > 0,
  `rate=${wp.marginRate} profit=${wp.profit}`
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nOK");
