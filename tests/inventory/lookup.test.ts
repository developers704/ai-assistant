import { describe, expect, it } from "vitest";
import {
  isBareItemNumber,
  isLetterSuffixVariant,
  pickPreferredSkuVariant,
  resolveInventorySkuKey,
} from "@/lib/inventory/sku-lookup-resolve";

describe("inventory SKU lookup resolve", () => {
  it("treats a numeric Item # as a bare query", () => {
    expect(isBareItemNumber("231611")).toBe(true);
    expect(isBareItemNumber(" 231611 ")).toBe(true);
    expect(isBareItemNumber("231611Y")).toBe(false);
    expect(isBareItemNumber("228777V")).toBe(false);
  });

  it("matches letter suffixes but not a longer numeric SKU", () => {
    expect(isLetterSuffixVariant("231611Y", "231611")).toBe(true);
    expect(isLetterSuffixVariant("231611S", "231611")).toBe(true);
    expect(isLetterSuffixVariant("231611Y-1", "231611")).toBe(true);
    expect(isLetterSuffixVariant("2316110", "231611")).toBe(false);
    expect(isLetterSuffixVariant("231611", "231611")).toBe(false);
    expect(isLetterSuffixVariant("228777V", "228777")).toBe(true);
  });

  it("prefers the variant with more on-hand (do not mix S and V)", () => {
    expect(
      pickPreferredSkuVariant([
        { sku: "228777S", onHand: 2, tagPrice: 199 },
        { sku: "228777V", onHand: 8, tagPrice: 249 },
      ])
    ).toBe("228777V");
  });

  it("resolves a bare Item # to the POS suffix SKU", () => {
    const known = ["199003", "231611Y", "228777S", "228777V"];
    const scores: Record<string, { onHand: number; tagPrice: number }> = {
      "231611Y": { onHand: 12, tagPrice: 499 },
      "228777S": { onHand: 2, tagPrice: 199 },
      "228777V": { onHand: 8, tagPrice: 249 },
      "199003": { onHand: 1, tagPrice: 1200 },
    };

    expect(
      resolveInventorySkuKey("231611", known, (sku) => scores[sku] ?? { onHand: 0, tagPrice: 0 })
    ).toBe("231611Y");

    expect(
      resolveInventorySkuKey("231611Y", known, (sku) => scores[sku] ?? { onHand: 0, tagPrice: 0 })
    ).toBe("231611Y");

    expect(
      resolveInventorySkuKey("228777V", known, (sku) => scores[sku] ?? { onHand: 0, tagPrice: 0 })
    ).toBe("228777V");

    expect(
      resolveInventorySkuKey("228777", known, (sku) => scores[sku] ?? { onHand: 0, tagPrice: 0 })
    ).toBe("228777V");

    expect(
      resolveInventorySkuKey("nope", known, () => ({ onHand: 0, tagPrice: 0 }))
    ).toBeNull();
  });

  it("does not remap a suffixed miss onto a sibling SKU", () => {
    const known = ["231611Y"];
    expect(
      resolveInventorySkuKey("231611S", known, () => ({ onHand: 1, tagPrice: 499 }))
    ).toBeNull();
  });
});

describe("lookupInventory suffix fallback (live on-hand file)", () => {
  it("finds 231611 via 231611Y when the live file has no bare Item #", async () => {
    const { lookupInventory, getInventoryStatus } = await import("@/lib/inventory/store");
    const status = getInventoryStatus();
    if (!status.loaded) return;

    const exactY = lookupInventory("231611Y");
    const bare = lookupInventory("231611");
    if (!exactY) return;

    expect(bare).not.toBeNull();
    expect(bare!.resolvedSku).toBe(exactY.resolvedSku);
    expect(bare!.queriedSku).toBe("231611");
    expect(bare!.item.sku.toUpperCase()).toBe(exactY.item.sku.toUpperCase());
    expect(bare!.item.tagPrice).toBe(exactY.item.tagPrice);
  });
});
