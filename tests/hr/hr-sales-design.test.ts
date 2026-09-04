import { describe, expect, it } from "vitest";
import {
  applyHrSalesDesigns,
  displayHrPosDesign,
  hrSalesDesignName,
  isHrEternalVowClass,
  isHrUvSalesRow,
  remapHrAvailableDesigns,
} from "@/lib/hr/hr-sales-design";
import { groupRows } from "@/lib/sales/sales-aggregate";
import type { VendorPosRow } from "@/lib/reports/types";

function row(partial: Partial<VendorPosRow>): VendorPosRow {
  return {
    date: "2026-08-01",
    transactionId: "T1",
    storeName: "VJ-OAK",
    department: "LADYS RING",
    design: "GOLD JEWL",
    itemNumber: "231000",
    sku: "231000",
    style: "",
    description: "14KT UV HALO RING",
    vendor: "VSU",
    vendorModel: "X",
    productClass: "",
    subClass: "",
    quantity: 1,
    inventoryCost: 0,
    wholesaleCost: 0,
    grossSales: 100,
    discountAmount: 0,
    netRevenue: 100,
    margin: 0,
    discountRate: 0,
    imageDir: "",
    ...partial,
  };
}

describe("HR Sales designs", () => {
  it("renames Love → Lovespell and BELLA OVAN → BELLA OVANI", () => {
    expect(displayHrPosDesign("LOVE")).toBe("Lovespell");
    expect(displayHrPosDesign("Love")).toBe("Lovespell");
    expect(displayHrPosDesign("BELLA OVAN")).toBe("BELLA OVANI");
    expect(displayHrPosDesign("NOVELLO")).toBe("NOVELLO");
  });

  it("counts UV when description has UV/ultimate and vendor is OX, VSU, or TRCO/TORCO", () => {
    expect(isHrUvSalesRow({ description: "10KT UV PENDANT", vendor: "OX" })).toBe(true);
    expect(isHrUvSalesRow({ description: "Ultimate Value Cuban", vendor: "vsu" })).toBe(true);
    expect(isHrUvSalesRow({ description: "UV hoop", vendor: "TRCO" })).toBe(true);
    expect(isHrUvSalesRow({ description: "ultimate diamond", vendor: "TORCO" })).toBe(true);
  });

  it("does not count UV without the vendor list or without UV/ultimate in description", () => {
    expect(isHrUvSalesRow({ description: "10KT UV PENDANT", vendor: "AGI" })).toBe(false);
    expect(isHrUvSalesRow({ description: "14KT GOLD RING", vendor: "VSU" })).toBe(false);
  });

  it("groups matching rows as UV instead of the POS design", () => {
    expect(hrSalesDesignName(row({ design: "GOLD JEWL", vendor: "VSU" }))).toBe("UV");
    expect(hrSalesDesignName(row({ design: "LOVE", vendor: "AGI", description: "LOCKET" }))).toBe(
      "Lovespell"
    );
    expect(
      hrSalesDesignName(row({ design: "BELLA OVAN", vendor: "AGI", description: "INITIAL" }))
    ).toBe("BELLA OVANI");
  });

  it("copies only remapped rows so POS cache stays intact", () => {
    const love = row({ design: "LOVE", vendor: "AGI", description: "HEART" });
    const uv = row({ design: "NOVELLO", vendor: "OX" });
    const keep = row({ design: "WATCH", vendor: "ROLEX", description: "DATEJUST" });
    const out = applyHrSalesDesigns([love, uv, keep]);
    expect(out[0]).not.toBe(love);
    expect(out[0]!.design).toBe("Lovespell");
    expect(out[1]!.design).toBe("UV");
    expect(out[2]).toBe(keep);
  });

  it("adds UV to the HR design filter list", () => {
    const names = remapHrAvailableDesigns(["LOVE", "BELLA OVAN", "NOVELLO"]);
    expect(names).toContain("Lovespell");
    expect(names).toContain("BELLA OVANI");
    expect(names).toContain("UV");
    expect(names).toContain("Eternal-vow");
    expect(names).toContain("NOVELLO");
    expect(names).not.toContain("LOVE");
    expect(names).not.toContain("BELLA OVAN");
  });

  it("groupRows design totals move UV vendor lines out of GOLD JEWL", () => {
    const rows = applyHrSalesDesigns([
      row({ design: "GOLD JEWL", vendor: "VSU", description: "UV RING", netRevenue: 80 }),
      row({ design: "GOLD JEWL", vendor: "AGI", description: "PLAIN GOLD", netRevenue: 20 }),
      row({ design: "LOVE", vendor: "AGI", description: "HEART", netRevenue: 50 }),
    ]);
    const designs = groupRows(rows, "design", null);
    const byName = Object.fromEntries(designs.map((d) => [d.name, d.netSales]));
    expect(byName.UV).toBe(80);
    expect(byName["GOLD JEWL"]).toBe(20);
    expect(byName.Lovespell).toBe(50);
  });

  it("moves Class ETERNAL-VOW off Novello into Eternal-vow", () => {
    expect(isHrEternalVowClass("ETERNAL-VOW")).toBe(true);
    expect(isHrEternalVowClass("Eternal-vow")).toBe(true);
    expect(isHrEternalVowClass("ETERNITY")).toBe(false);
    expect(
      hrSalesDesignName(
        row({
          design: "NOVELLO",
          productClass: "ETERNAL-VOW",
          vendor: "AGI",
          description: "BRIDAL SET",
        })
      )
    ).toBe("Eternal-vow");

    const rows = applyHrSalesDesigns([
      row({
        design: "NOVELLO",
        productClass: "ETERNAL-VOW",
        vendor: "AGI",
        description: "BRIDAL",
        netRevenue: 400,
      }),
      row({
        design: "NOVELLO",
        productClass: "14KT",
        vendor: "AGI",
        description: "HALO",
        netRevenue: 100,
      }),
    ]);
    const designs = groupRows(rows, "design", null);
    const byName = Object.fromEntries(designs.map((d) => [d.name, d.netSales]));
    expect(byName["Eternal-vow"]).toBe(400);
    expect(byName.NOVELLO).toBe(100);
  });
});
