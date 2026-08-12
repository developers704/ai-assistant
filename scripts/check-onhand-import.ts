/**
 * Spot-check Aug 12 onhand import + cost visibility + sales Amount wholesale.
 * Run: npx tsx scripts/check-onhand-import.ts
 */
import { lookupInventory, getInventoryStatus } from "../src/lib/inventory/store";
import { getVisibleDmCostPrice } from "../src/lib/inventory/pricing";
import { canSeeRealInventoryCost } from "../src/lib/auth/user-permissions";
import { hasOnhandData, listOnhandStoresForSku } from "../src/lib/inventory/onhand";
import {
  calculatorWholesaleUnitCost,
  signedWholesaleUnitCost,
} from "../src/lib/sales/top-models-wholesale-margin";
import { wholeCostFromRules } from "../src/lib/inventory/whole-cost-rules";

let failed = 0;
function assert(name: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== Inventory status ===");
const status = getInventoryStatus();
console.log(JSON.stringify(status, null, 2));
assert("inventory loaded", status.loaded && status.rowCount > 100000, `rows=${status.rowCount}`);
assert("onhand loaded", hasOnhandData());

assert("Kash sees real cost", canSeeRealInventoryCost("kash"));
assert("Ross sees real cost", canSeeRealInventoryCost("ross"));
assert("AJ does not see real cost", !canSeeRealInventoryCost("aj"));
assert("Shaun does not see real cost", !canSeeRealInventoryCost("shaun"));

// Find any GOLD JEWL item with tag
const hit = lookupInventory("231620S") ?? lookupInventory("231620");
if (hit) {
  const item = hit.item;
  const wholesale = getVisibleDmCostPrice(item);
  console.log("  sample", {
    sku: item.sku,
    tag: item.tagPrice,
    realCost: item.costPrice,
    wholesale,
    stores: hit.stores.length,
    onHandTotal: hit.onHandTotal,
  });
  assert("sample has tag price", item.tagPrice > 0);
  assert("sample wholesale > 0", wholesale > 0);
  const stores = listOnhandStoresForSku(item.sku);
  assert("sample has onhand store lines", (stores?.length ?? 0) > 0, `stores=${stores?.length}`);
} else {
  // fallback any rado
  const rado = lookupInventory("199003");
  assert("fallback sku found", !!rado);
  if (rado) {
    console.log("  rado", {
      sku: rado.item.sku,
      tag: rado.item.tagPrice,
      real: rado.item.costPrice,
      wholesale: getVisibleDmCostPrice(rado.item),
      onHandTotal: rado.onHandTotal,
    });
  }
}

// Sales dashboard path: Sales Amount × rules (not inventory tag)
const salesAmt = 2750;
const radoCost = wholeCostFromRules({ department: "RADO" }, salesAmt);
assert(
  "sales Rado uses Sales Amount formula",
  radoCost != null && Math.abs(radoCost - (2750 / 1.82 + 20)) < 0.02,
  `got=${radoCost}`
);
const calc = calculatorWholesaleUnitCost("199003", "VJ-VAL", {
  department: "RADO",
  design: "",
  productClass: "",
  subClass: "",
  description: "Rado",
  grossSales: salesAmt,
  netRevenue: 2480,
});
assert(
  "calculatorWholesaleUnitCost sales path",
  calc != null && Math.abs(calc - (2750 / 1.82 + 20)) < 0.02,
  `got=${calc}`
);
const profit = 2480 - signedWholesaleUnitCost(calc!, { quantity: 1, netRevenue: 2480, grossSales: salesAmt });
assert("margin math Net−cost", Math.abs(profit - (2480 - (2750 / 1.82 + 20))) < 0.05);

console.log(failed ? `\n${failed} FAILED` : "\nALL ONHAND CHECKS PASSED");
process.exit(failed ? 1 : 0);
