import { describe, expect, it } from "vitest";
import {
  buildEntityIndex,
  extractEntitiesFromMessage,
} from "@/lib/sales/sales-normalizer";
import type { VendorPosRow } from "@/lib/reports/types";

function row(
  partial: Partial<VendorPosRow> &
    Pick<VendorPosRow, "department" | "design" | "productClass" | "vendor" | "storeName">
): VendorPosRow {
  return {
    transactionId: "T1",
    date: "2026-07-19",
    itemNumber: "1",
    sku: "1",
    style: "",
    description: "Ring",
    vendorModel: "VM1",
    subClass: "",
    quantity: 1,
    inventoryCost: 50,
    netRevenue: 100,
    grossSales: 110,
    discountAmount: 10,
    margin: 50,
    discountRate: 0.1,
    imageDir: "",
    ...partial,
  };
}

const index = buildEntityIndex([
  row({
    storeName: "VJ-VAL",
    department: "LADYS RING",
    design: "NOVELLO",
    vendor: "KRA",
    productClass: "SOL RING",
  }),
  row({
    storeName: "VJ-SERRA",
    department: "LADYS RING",
    design: "NOVELLO",
    vendor: "VSU",
    productClass: "BAND",
  }),
  row({
    storeName: "Great Mall",
    department: "MENS RING",
    design: "OVANI",
    vendor: "MHVR",
    productClass: "GENTS RING",
  }),
  row({
    storeName: "Valley Fair",
    department: "WATCHES",
    design: "ROLEX",
    vendor: "RLX",
    productClass: "14KT",
  }),
]);

describe("extractEntitiesFromMessage — one named dimension only", () => {
  it("lady's ring → department only, not class SOL RING", () => {
    const got = extractEntitiesFromMessage(
      "show ladys ring sales on july 19",
      index
    );
    expect(got.departments).toEqual(["LADYS RING"]);
    expect(got.classes).toBeUndefined();
    expect(got.designs).toBeUndefined();
    expect(got.vendors).toBeUndefined();
    expect(got.stores).toBeUndefined();
  });

  it("lady's ring with apostrophe still department-only", () => {
    const got = extractEntitiesFromMessage("show lady's ring sales", index);
    expect(got.departments).toEqual(["LADYS RING"]);
    expect(got.classes).toBeUndefined();
  });

  it("explicit class keeps class only", () => {
    const got = extractEntitiesFromMessage("show SOL RING class sales", index);
    expect(got.classes).toEqual(["SOL RING"]);
    expect(got.departments).toBeUndefined();
  });

  it("named design stays design-only", () => {
    const got = extractEntitiesFromMessage("show Novello sales", index);
    expect(got.designs).toEqual(["NOVELLO"]);
    expect(got.departments).toBeUndefined();
    expect(got.classes).toBeUndefined();
    expect(got.vendors).toBeUndefined();
  });

  it("named vendor stays vendor-only", () => {
    const got = extractEntitiesFromMessage("show MHVR sales", index);
    expect(got.vendors).toEqual(["MHVR"]);
    expect(got.designs).toBeUndefined();
    expect(got.departments).toBeUndefined();
  });

  it("allows two strong phrases when both are named", () => {
    const got = extractEntitiesFromMessage(
      "show Novello lady's ring sales",
      index
    );
    expect(got.designs).toEqual(["NOVELLO"]);
    expect(got.departments).toEqual(["LADYS RING"]);
    expect(got.classes).toBeUndefined();
  });
});
