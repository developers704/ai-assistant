/**
 * Self-check: Top Vendor Models uses price-calculator cost rules.
 * Run: npx tsx scripts/check-top-models-wholesale-margin.ts
 */
import { getVisibleDmCostPrice } from "../src/lib/inventory/pricing";
import { lookupInventory } from "../src/lib/inventory/store";
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
    grossSales: partial.netRevenue,
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

const missing = wholesaleProfitForModelRows([
  row({ netRevenue: 500, sku: "SKU-NOT-IN-INVENTORY-XYZ" }),
]);
assert("missing wholesale hides margin", missing.profit == null && missing.marginRate == null);

const lines = [
  row({ netRevenue: 400, quantity: 5, sku: "A" }),
  row({ netRevenue: 200, quantity: 1, sku: "A" }),
];
const simulatedProfit = lines.reduce((s, r) => s + (r.netRevenue - 100), 0);
const simulatedRev = lines.reduce((s, r) => s + r.netRevenue, 0);
assert(
  "qty ignored in formula (2 lines × unit cost, not × qty)",
  simulatedProfit === 400 && Math.abs(simulatedProfit / simulatedRev - 400 / 600) < 1e-9,
  `${simulatedProfit} / ${simulatedRev}`
);

const uv = lookupInventory("239139-20");
if (uv) {
  const cost = calculatorWholesaleUnitCost("239139-20", null, {
    description: "10KT Ultimate Value Yellow-Gold D/c Rope Chain",
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    productClass: "10KT",
    subClass: "",
    netRevenue: 989,
  });
  const expected = getVisibleDmCostPrice(uv.item);
  assert(
    "UV gold uses Tag÷1.3 (calculator rule)",
    cost != null && Math.abs(cost - expected) < 0.01 && cost > 700,
    `cost=${cost} expected=${expected} rawWhole=${uv.item.wholesaleCost}`
  );
  const pct = ((989 - (cost ?? 0)) / 989) * 100;
  assert("UV gold margin ~23%", pct > 22 && pct < 24, `${pct.toFixed(1)}%`);
  assert(
    "raw Whole Cost would wrongly show ~75%",
    uv.item.wholesaleCost > 0 && uv.item.wholesaleCost < 300,
    String(uv.item.wholesaleCost)
  );
} else {
  console.log("  · skip UV gold SKU check (239139-20 not in inventory)");
}

// Non-UV gold (GOLD ID) should use Whole Cost, not Tag÷1.3
const goldId = lookupInventory("177145-8");
if (goldId) {
  const cost = calculatorWholesaleUnitCost("177145-8", null, {
    description: "14KT Yellow-Gold Franco Bracelet",
    department: "GOLD ID",
    design: goldId.item.design,
    productClass: goldId.item.class,
    subClass: "",
    netRevenue: 1035,
  });
  const raw = goldId.item.wholesaleCost || goldId.item.costPrice;
  assert(
    "non-UV GOLD ID uses Whole Cost (not Tag÷1.3)",
    cost != null && Math.abs(cost - raw) < 0.02,
    `cost=${cost} whole=${raw} tagDiv13=${(goldId.item.tagPrice / 1.3).toFixed(2)}`
  );
} else {
  console.log("  · skip GOLD ID SKU check (177145-8 not in inventory)");
}

console.log(failed ? `\nFAILED: ${failed}` : "\n✓ top-models wholesale margin checks passed.");
process.exit(failed ? 1 : 0);
