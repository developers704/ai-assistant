import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  calculatePricing,
  classifyProduct,
  getVisibleDmCostPrice,
} from "@/lib/inventory/pricing";
import { fixedWholeCostForSku, wholeCostFromRules } from "@/lib/inventory/whole-cost-rules";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    sku: "239132-18",
    description: '10KT "ULTIMATE VALUE" YELLOW-GOLD D/C ROPE CHAIN (NO WARRANTY)',
    vendorModel: "TD040",
    vendor: "MNT",
    tagPrice: 559,
    costPrice: 430,
    wholesaleCost: 559,
    store: "VJ-SOLANO",
    onHand: 1,
    department: "GOLD CHAIN",
    design: "GOLD JEWL",
    class: "10KT",
    subClass: "18",
    avgWeight: 5.5,
    brand: "Valliani",
    imageDir: "\\239132.webp",
    createDate: "5/13/2026",
    ...overrides,
  };
}

describe("Whole Cost rules (CP Divisor sheet = truth)", () => {
  it("Gold JEWL + Ultimate Value in description → Tag ÷ 1.3", () => {
    const item = makeItem({
      sku: "239132-18",
      department: "GOLD CHAIN",
      design: "GOLD JEWL",
      class: "10KT",
      description: '10KT "ULTIMATE VALUE" YELLOW-GOLD D/C ROPE CHAIN (NO WARRANTY)',
      tagPrice: 559,
      wholesaleCost: 139.75,
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(559 / 1.3, 5);
  });

  it("Diamond + Ultimate Value in description → Tag ÷ 8.8 (non-special SKU)", () => {
    expect(
      wholeCostFromRules(
        {
          sku: "999001",
          department: "LADYS RING",
          design: "NOVELLO",
          class: "14KT",
          description: '14KT LAB-GROWN DIAMOND ULTIMATE VALUE HALO RING',
        },
        880
      )
    ).toBeCloseTo(880 / 8.8, 5);
  });

  it("SKU 240304 only → Tag ÷ 8.8 (beats GOLD JEWL ÷4)", () => {
    expect(
      wholeCostFromRules(
        {
          sku: "240304",
          department: "GENTS RING",
          design: "GOLD JEWL",
          class: "10KT",
          description: "10KT Yellow-Gold Nugget Cross Mens Ring",
        },
        4125
      )
    ).toBeCloseTo(4125 / 8.8, 5);
    // Other nugget SKUs still GOLD JEWL ÷4
    expect(
      wholeCostFromRules(
        {
          sku: "240298",
          department: "GENTS RING",
          design: "GOLD JEWL",
          class: "10KT",
          description: "10KT Yellow-Gold Nugget Cross Mens Ring",
        },
        2888
      )
    ).toBeCloseTo(2888 / 4, 5);
  });

  it("fixed SKU cost overrides diamond UV ÷8.8", () => {
    expect(
      wholeCostFromRules(
        {
          sku: "231611",
          department: "LADYS RING",
          design: "NOVELLO",
          class: "UV",
          description: "LAB-GROWN DIAMOND ULTIMATE VALUE RBC HALO RING",
        },
        499
      )
    ).toBe(350);
  });

  it("fixed SKU cost overrides sheet formula (everyone)", () => {
    expect(fixedWholeCostForSku("231611")).toBe(350);
    expect(fixedWholeCostForSku("231618S-10")).toBe(275);
    expect(fixedWholeCostForSku("231611Y")).toBe(350);
    const item = makeItem({
      sku: "231611",
      department: "LADYS RING",
      design: "NOVELLO",
      class: "UV",
      tagPrice: 499,
      wholesaleCost: 56.7,
    });
    expect(getVisibleDmCostPrice(item)).toBe(350);
  });

  it("sheet formula beats filled Whole Cost (Rado Tag/1.82+20)", () => {
    const item = makeItem({
      department: "RADO",
      design: "WATCH",
      class: "MENS",
      tagPrice: 2900,
      wholesaleCost: 1450, // stale CSV — ignore
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(2900 / 1.82 + 20, 5);
  });

  it("Class UV + GOLD JEWL → Tag ÷ 1.3 even if Whole Cost filled", () => {
    const item = makeItem({
      class: "UV",
      design: "GOLD JEWL",
      wholesaleCost: 140,
      tagPrice: 559,
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(559 / 1.3, 5);
  });

  it("GOLD JEWL design without UV → Tag ÷ 4", () => {
    const item = makeItem({
      class: "10KT",
      design: "GOLD JEWL",
      department: "GOLD ID",
      description: "14KT YELLOW-GOLD D/C ROPE CHAIN (NO WARRANTY)",
      wholesaleCost: 0,
      tagPrice: 400,
    });
    expect(getVisibleDmCostPrice(item)).toBeCloseTo(100, 5);
  });

  it("uses filled Whole Cost only when no rule matches", () => {
    const item = makeItem({
      department: "SEIKO",
      design: "WATCH",
      class: "",
      tagPrice: 500,
      wholesaleCost: 220,
    });
    expect(getVisibleDmCostPrice(item)).toBe(220);
  });

  it("LADYS RING → Tag ÷ 8.8", () => {
    expect(
      wholeCostFromRules({ department: "LADYS RING", design: "OVANI", class: "14KT" }, 21995)
    ).toBeCloseTo(21995 / 8.8, 5);
  });

  it("ROLEX → Tag ÷ 4", () => {
    expect(wholeCostFromRules({ department: "ROLEX" }, 4000)).toBeCloseTo(1000, 5);
  });

  it("MICHAEL KO → Tag/2 + 10", () => {
    expect(wholeCostFromRules({ department: "MICHAEL KO" }, 200)).toBeCloseTo(110, 5);
  });
});

describe("Manager discount tiers (GOLD JEWL vs diamond dept)", () => {
  it("UV + diamond (non-special SKU) → DM 82 / CM 80 / M 77.5", () => {
    const pricing = calculatePricing(
      makeItem({
        sku: "999001",
        department: "EARRINGS",
        design: "NOVELLO",
        class: "10KT",
        description: '10KT"UV-NOVELLO" LABGROWN DIAMOND STUDS',
        tagPrice: 10000,
      })
    );
    expect(pricing.tiers.map((t) => t.discountPercent)).toEqual([82, 80, 77.5]);
    expect(pricing.tiers.find((t) => t.tier === "m")?.cashPrice).toBeCloseTo(10000 * 0.225, 2);
    expect(pricing.rulesSummary).toMatch(/UV \/ Ultimate Value \+ diamond/);
  });

  it("UV + diamond special SKU still 0% discount", () => {
    const pricing = calculatePricing(
      makeItem({
        sku: "231618S",
        department: "LADYS RING",
        design: "NOVELLO",
        class: "14KT",
        description: "UV diamond ring",
        tagPrice: 5000,
      })
    );
    expect(pricing.tiers.map((t) => t.discountPercent)).toEqual([0, 0, 0]);
  });

  it("GOLD JEWL in GENTS RING → gold 65/60/55, not diamond 82/80/77.5", () => {
    const item = makeItem({
      sku: "240298",
      department: "GENTS RING",
      design: "GOLD JEWL",
      class: "10K",
      subClass: "NUGGET",
      description: "10KT YELLOW-GOLD NUGGET CROSS MENS RING (NO WARRANTY)",
      vendorModel: "NUGGET.CROSS. RING",
      tagPrice: 2888,
      costPrice: 722,
    });
    const classified = classifyProduct(item);
    expect(classified.category).toBe("gold");
    const pricing = calculatePricing(item);
    expect(pricing.tiers.find((t) => t.tier === "dm")?.discountPercent).toBe(65);
    expect(pricing.tiers.find((t) => t.tier === "cm")?.discountPercent).toBe(60);
    expect(pricing.tiers.find((t) => t.tier === "m")?.discountPercent).toBe(55);
    expect(pricing.tiers.find((t) => t.tier === "dm")?.cashPrice).toBeCloseTo(
      2888 * 0.35,
      2
    );
  });

  it("GOLD JEWEL spelling + LADYS RING still gold 65%", () => {
    const item = makeItem({
      department: "LADYS RING",
      design: "GOLD JEWEL",
      class: "14KT",
      description: "14KT YELLOW-GOLD RING",
      tagPrice: 1000,
    });
    expect(classifyProduct(item).category).toBe("gold");
    expect(calculatePricing(item).tiers.find((t) => t.tier === "dm")?.discountPercent).toBe(65);
  });

  it("Class UV + GOLD JEWL still 0% discount", () => {
    const item = makeItem({
      department: "GOLD ID",
      design: "GOLD JEWL",
      class: "UV",
      tagPrice: 1000,
    });
    expect(calculatePricing(item).tiers.find((t) => t.tier === "dm")?.discountPercent).toBe(0);
  });

  it("watch discounts: Gucci/Longines/Rado updated % are DM-only", () => {
    const gucci = calculatePricing(
      makeItem({ department: "GUCCI", design: "WATCH", tagPrice: 1000 })
    ).tiers;
    expect(gucci.find((t) => t.tier === "dm")?.discountPercent).toBe(30);
    expect(gucci.find((t) => t.tier === "cm")?.discountPercent).toBe(15);
    expect(gucci.find((t) => t.tier === "m")?.discountPercent).toBe(15);

    const longines = calculatePricing(
      makeItem({ department: "LONGINES", design: "WATCH", tagPrice: 1000 })
    ).tiers;
    expect(longines.find((t) => t.tier === "dm")?.discountPercent).toBe(15);
    expect(longines.find((t) => t.tier === "cm")?.discountPercent).toBe(15);
    expect(longines.find((t) => t.tier === "m")?.discountPercent).toBe(15);

    const rado = calculatePricing(
      makeItem({ department: "RADO", design: "WATCH", tagPrice: 1000 })
    ).tiers;
    expect(rado.find((t) => t.tier === "dm")?.discountPercent).toBe(18);
    expect(rado.find((t) => t.tier === "cm")?.discountPercent).toBe(18);
    expect(rado.find((t) => t.tier === "m")?.discountPercent).toBe(18);
  });

  it("watch discounts: Cartier/Bright Link 62/60/60; Mont Blanc/Tissot 25/25/25", () => {
    const cartier = calculatePricing(makeItem({ department: "CARTIER", tagPrice: 1000 })).tiers;
    expect(cartier.map((t) => t.discountPercent)).toEqual([62, 60, 60]);

    const bright = calculatePricing(
      makeItem({ department: "BRIGHT LINK", tagPrice: 1000 })
    ).tiers;
    expect(bright.map((t) => t.discountPercent)).toEqual([62, 60, 60]);

    const mont = calculatePricing(makeItem({ department: "MONT WATCH", tagPrice: 1000 })).tiers;
    expect(mont.map((t) => t.discountPercent)).toEqual([25, 25, 25]);

    const montAcces = calculatePricing(
      makeItem({ department: "MONT ACCES", tagPrice: 1000 })
    ).tiers;
    expect(montAcces.map((t) => t.discountPercent)).toEqual([25, 25, 25]);

    const tissot = calculatePricing(makeItem({ department: "TISSOT", tagPrice: 1000 })).tiers;
    expect(tissot.map((t) => t.discountPercent)).toEqual([25, 25, 25]);
  });
});
