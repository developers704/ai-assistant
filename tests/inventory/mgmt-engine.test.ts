import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/inventory/types";
import type { VendorPosRow } from "@/lib/reports/types";
import { buildInventoryTransfers } from "@/lib/inventory/mgmt-engine";
import { keepReserveQty, isInventoryMgmtStore } from "@/lib/inventory/mgmt-stores";

function sale(partial: Partial<VendorPosRow> & Pick<VendorPosRow, "storeName" | "vendorModel" | "quantity">): VendorPosRow {
  return {
    date: "2026-03-01",
    transactionId: "T1",
    department: "LADYS RING",
    design: "NOVELLO",
    itemNumber: "231443",
    sku: "231443",
    style: "",
    description: "ring",
    vendor: "RCN",
    productClass: "14KT",
    subClass: "BIRTHSTONE",
    inventoryCost: 761,
    wholesaleCost: 400,
    grossSales: 1719,
    discountAmount: 0,
    netRevenue: 1719,
    margin: 0,
    discountRate: 0,
    imageDir: "",
    ...partial,
  };
}

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, "store" | "onHand">): InventoryItem {
  return {
    sku: "231443",
    description: "ring",
    vendorModel: "RR8179WS",
    vendor: "RCN",
    tagPrice: 1719,
    costPrice: 761,
    wholesaleCost: 400,
    department: "LADYS RING",
    design: "NOVELLO",
    class: "14KT",
    subClass: "BIRTHSTONE",
    avgWeight: 0,
    brand: "",
    ...partial,
  };
}

describe("inventory mgmt stores", () => {
  it("keeps AJ/Shaun and drops MAIN, VIS, Adeel, closed", () => {
    expect(isInventoryMgmtStore("VJ-SERRA")).toBe(true);
    expect(isInventoryMgmtStore("VJ-ONT")).toBe(true);
    expect(isInventoryMgmtStore("MAIN")).toBe(false);
    expect(isInventoryMgmtStore("VJ-VIS")).toBe(false);
    expect(isInventoryMgmtStore("DE-SOUTH")).toBe(false);
    expect(isInventoryMgmtStore("VJ-CON")).toBe(false);
    expect(keepReserveQty(2, "new")).toBe(10);
  });
});

describe("inventory transfers", () => {
  it("moves spare B-store stock to an A store that sold more than it holds", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
      })
    ).concat(
      sale({ storeName: "VJ-OAK", vendorModel: "RR8179WS", quantity: 1, netRevenue: 100 })
    );
    const items = [
      item({ store: "VJ-SERRA", onHand: 3 }),
      item({ store: "VJ-OAK", onHand: 12 }),
      item({ store: "VJ-EAST", onHand: 20 }),
      item({ store: "VJ-DEER", onHand: 10 }),
    ];
    const eastSales = Array.from({ length: 15 }, (_, i) =>
      sale({
        transactionId: `E${i}`,
        storeName: "VJ-EAST",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
      })
    );
    const hits = buildInventoryTransfers([...sales, ...eastSales], items).filter(
      (t) => t.toStore === "VJ-SERRA" && t.vendorModel === "RR8179WS"
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.fromStore).toBe("VJ-OAK");
    expect(hits[0]!.qty).toBeGreaterThan(0);
    expect(hits[0]!.fromStore).not.toBe("VJ-DEER");
    expect(hits[0]!.fromStore).not.toBe("VJ-EAST");
  });
});
