/**
 * Self-check for price calculator discount rules.
 * Run: npx tsx scripts/check-pricing-rules.ts
 */
import { calculatePricing } from "../src/lib/inventory/pricing";
import type { InventoryItem } from "../src/lib/inventory/types";

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, "sku">): InventoryItem {
  return {
    description: "",
    vendorModel: "",
    vendor: "",
    tagPrice: 1000,
    costPrice: 400,
    wholesaleCost: 500,
    store: "MAIN",
    onHand: 1,
    department: "",
    design: "",
    class: "",
    subClass: "",
    avgWeight: 0,
    brand: "",
    ...partial,
  };
}

function tiers(i: InventoryItem) {
  const p = calculatePricing(i);
  return {
    label: p.categoryLabel,
    dm: p.tiers.find((t) => t.tier === "dm")!.discountPercent,
    cm: p.tiers.find((t) => t.tier === "cm")!.discountPercent,
    m: p.tiers.find((t) => t.tier === "m")!.discountPercent,
    summary: p.rulesSummary,
  };
}

function assert(
  name: string,
  got: { dm: number; cm: number; m: number },
  want: { dm: number; cm: number; m: number }
) {
  if (got.dm !== want.dm || got.cm !== want.cm || got.m !== want.m) {
    throw new Error(
      `${name}: expected DM/CM/M ${want.dm}/${want.cm}/${want.m}, got ${got.dm}/${got.cm}/${got.m}`
    );
  }
  console.log(`ok  ${name} → ${got.dm}/${got.cm}/${got.m}`);
}

assert(
  "whole gold (under 20g)",
  tiers(item({ sku: "G1", department: "GOLD CHAIN", avgWeight: 5 })),
  { dm: 65, cm: 60, m: 55 }
);
assert(
  "whole gold (over 20g)",
  tiers(item({ sku: "G2", department: "GOLD ID", avgWeight: 25 })),
  { dm: 65, cm: 60, m: 55 }
);
assert(
  "G-Shock",
  tiers(item({ sku: "W1", department: "WATCH", description: "Casio G-Shock GA-2100" })),
  { dm: 25, cm: 25, m: 25 }
);
assert(
  "UV + GOLD JEWL → 0%",
  tiers(item({ sku: "UV1", class: "UV", design: "GOLD JEWL", department: "GOLD ID" })),
  { dm: 0, cm: 0, m: 0 }
);
assert(
  "UV + diamond → 82%",
  tiers(
    item({
      sku: "D1",
      description: "14KT UV diamond pendant",
      department: "PENDANT",
    })
  ),
  { dm: 82, cm: 82, m: 82 }
);
assert(
  "Ultimate Value + diamond → 82%",
  tiers(
    item({
      sku: "D2",
      description: "Ultimate Value diamond studs",
      department: "EARRINGS",
    })
  ),
  { dm: 82, cm: 82, m: 82 }
);
assert(
  "UV diamond exception SKU → 0%",
  tiers(
    item({
      sku: "231611-1",
      description: "UV diamond ring",
      department: "LADYS RING",
    })
  ),
  { dm: 0, cm: 0, m: 0 }
);
assert(
  "Oroventi tiers",
  tiers(item({ sku: "O1", design: "OROVENTI", department: "GOLD ID" })),
  { dm: 20, cm: 15, m: 10 }
);
assert(
  "Link N Lock tiers",
  tiers(item({ sku: "L1", design: "LINKNLOCK", department: "GOLD CHAIN" })),
  { dm: 20, cm: 15, m: 10 }
);
assert(
  "Love tiers",
  tiers(item({ sku: "L2", design: "LOVE", department: "GOLD PNDTS" })),
  { dm: 20, cm: 15, m: 10 }
);
assert(
  "diamond by department (LADYS RING)",
  tiers(item({ sku: "DR1", department: "LADYS RING", description: "14KT ring" })),
  { dm: 82, cm: 80, m: 77.5 }
);
assert(
  "diamond by description",
  tiers(item({ sku: "DR2", department: "BE", description: "1ct diamond band" })),
  { dm: 82, cm: 80, m: 77.5 }
);
assert(
  "Benchmark",
  tiers(item({ sku: "B1", description: "Benchmark wedding band" })),
  { dm: 65, cm: 60, m: 55 }
);
assert(
  "Triton",
  tiers(item({ sku: "T1", description: "Triton tungsten band", vendorModel: "TRITON-1" })),
  { dm: 65, cm: 60, m: 55 }
);
assert(
  "Tungsten",
  tiers(item({ sku: "T2", description: "Tungsten comfort fit" })),
  { dm: 65, cm: 60, m: 55 }
);

console.log("\nAll pricing rule checks passed.");
