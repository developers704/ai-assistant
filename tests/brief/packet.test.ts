import { describe, expect, it } from "vitest";
import type { VendorPosRow } from "@/lib/reports/types";
import type { PaycodeLeg } from "@/lib/sales/paycode-overlay";
import { aggregateBriefRows } from "@/lib/brief/packet";

function sale(partial: Partial<VendorPosRow> & Pick<VendorPosRow, "date" | "netRevenue">): VendorPosRow {
  return {
    transactionId: "T1",
    storeName: "VJ-FRE",
    department: "LADYS RING",
    design: "NOVELLO",
    itemNumber: "100",
    sku: "100",
    style: "",
    description: "Ring",
    vendor: "Vendor A",
    vendorModel: "NOV-1",
    productClass: "",
    subClass: "",
    quantity: 1,
    inventoryCost: 100,
    wholesaleCost: 0,
    grossSales: partial.netRevenue,
    discountAmount: 0,
    margin: 0,
    discountRate: 0,
    imageDir: "",
    salespersons: "SN/100%",
    ...partial,
  };
}

describe("brief packet", () => {
  it("builds both years and a department slice in one pass", () => {
    const rows = [
      sale({ date: "2026-09-02", netRevenue: 400, transactionId: "T1", quantity: 1, inventoryCost: 500 }),
      sale({
        date: "2026-09-03",
        netRevenue: 700,
        transactionId: "T2",
        storeName: "VJ-ONT",
        department: "ROLEX",
        design: "WATCH",
        vendorModel: "DATEJUST",
        description: "Datejust",
        salespersons: "SP/100%",
        inventoryCost: 200,
        quantity: 1,
      }),
      sale({
        date: "2025-09-02",
        netRevenue: 250,
        transactionId: "OLD",
        department: "LADYS RING",
        vendorModel: "NOV-1",
      }),
      sale({ date: "2026-08-01", netRevenue: 9999, vendorModel: "OUTSIDE" }),
    ];
    const legs: PaycodeLeg[] = [
      { txnId: "T1", date: "2026-09-02", store: "VJ-FRE", code: "CC", amount: 400, type: "Sales" },
      { txnId: "T9", date: "2026-09-02", store: "VJ-FRE", code: "CASH", amount: 50, type: "Sales" },
    ];
    const packet = aggregateBriefRows({
      rows,
      legs,
      from: "2026-09-01",
      to: "2026-09-21",
      showKash: true,
      directory: new Map(),
    });

    expect(packet.now.net).toBe(1100);
    expect(packet.ly.net).toBe(250);
    expect(packet.now.daily).toHaveLength(21);
    expect(packet.byDepartment["LADYS RING"]?.now.net).toBe(400);
    expect(packet.byDepartment["LADYS RING"]?.ly.net).toBe(250);
    expect(packet.byDepartment["LADYS RING"]?.now.pay.map((row) => row.name)).toEqual(["CC"]);
    expect(packet.now.pay.map((row) => row.name).sort()).toEqual(["CASH", "CC"]);
    expect(packet.watches.map((row) => row.name)).toEqual(["VJ-ONT"]);
    expect(packet.models.map((model) => model.vendorModel).sort()).toEqual(["DATEJUST", "NOV-1"]);
    expect(packet.models.find((model) => model.vendorModel === "NOV-1")?.kashCost).toBe(500);
    expect(packet.expertise.some((row) => row.person === "SN" && row.design === "NOVELLO")).toBe(true);
    expect(packet.models.some((model) => model.vendorModel === "OUTSIDE")).toBe(false);

    const hidden = aggregateBriefRows({
      rows,
      legs,
      showKash: false,
      directory: new Map(),
    });
    expect(hidden.showKash).toBe(false);
    expect(hidden.models.every((model) => model.kashCost == null)).toBe(true);
  });
});
