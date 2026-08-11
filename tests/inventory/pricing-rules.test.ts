import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/inventory/types";
import { getVisibleDmCostPrice } from "@/lib/inventory/pricing";
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
