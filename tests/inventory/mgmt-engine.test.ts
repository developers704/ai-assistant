import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/inventory/types";
import type { VendorPosRow } from "@/lib/reports/types";
import { buildInventoryTransfers, buildModelStoreBreakdown } from "@/lib/inventory/mgmt-engine";
import {
  isIgnoredInventoryDepartment,
  isInventoryMgmtStore,
  isSellingWell,
  keepReserveQty,
} from "@/lib/inventory/mgmt-stores";

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
    description: "14KT BIRTHSTONE RING",
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
    expect(keepReserveQty(0, "core")).toBe(2);
  });

  it("ignores battery / tray / gift box / misc / Rolex box departments", () => {
    expect(isIgnoredInventoryDepartment("BATTERY")).toBe(true);
    expect(isIgnoredInventoryDepartment("TRAY")).toBe(true);
    expect(isIgnoredInventoryDepartment("GIFT BOX")).toBe(true);
    expect(isIgnoredInventoryDepartment("BULOV GIFT")).toBe(true);
    expect(isIgnoredInventoryDepartment("MISC")).toBe(true);
    expect(isIgnoredInventoryDepartment("ROLEX BOX")).toBe(true);
    expect(isIgnoredInventoryDepartment("LADYS RING")).toBe(false);
    expect(isIgnoredInventoryDepartment("GIFT CARD")).toBe(false);
  });

  it("treats sold/onhand >= 50% as selling well", () => {
    expect(isSellingWell(3, 5)).toBe(true);
    expect(isSellingWell(2, 5)).toBe(false);
    expect(isSellingWell(1, 5)).toBe(false);
    expect(isSellingWell(15, 20)).toBe(true);
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
    expect(hits[0]!.description).toBe("14KT BIRTHSTONE RING");
    expect(hits[0]!.costPrice).toBe(761);
    expect(hits[0]!.qty).toBeGreaterThan(0);
    expect(hits[0]!.fromStore).not.toBe("VJ-DEER");
    expect(hits[0]!.fromStore).not.toBe("VJ-EAST");
  });

  it("does not donate from a store selling well (5 on hand / 3 sold)", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
      })
    ).concat(
      sale({ storeName: "VJ-OAK", vendorModel: "RR8179WS", quantity: 1, netRevenue: 100 }),
      sale({ transactionId: "O2", storeName: "VJ-OAK", vendorModel: "RR8179WS", quantity: 1, netRevenue: 100 }),
      sale({ transactionId: "O3", storeName: "VJ-OAK", vendorModel: "RR8179WS", quantity: 1, netRevenue: 100 })
    );
    const items = [item({ store: "VJ-SERRA", onHand: 3 }), item({ store: "VJ-OAK", onHand: 5 })];
    const hits = buildInventoryTransfers(sales, items).filter((t) => t.fromStore === "VJ-OAK");
    expect(hits).toHaveLength(0);
  });

  it("does not donate when a B/C store only has 1–2 on hand", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
      })
    );
    const items = [item({ store: "VJ-SERRA", onHand: 3 }), item({ store: "VJ-OAK", onHand: 2 })];
    const hits = buildInventoryTransfers(sales, items).filter((t) => t.fromStore === "VJ-OAK");
    expect(hits).toHaveLength(0);
  });

  it("skips tray / battery / gift-box inventory from transfers", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "TRAY1",
        quantity: 1,
        department: "TRAY",
        netRevenue: 10,
      })
    );
    const items = [
      item({ store: "VJ-SERRA", onHand: 0, vendorModel: "TRAY1", department: "TRAY", sku: "T1" }),
      item({ store: "VJ-OAK", onHand: 12, vendorModel: "TRAY1", department: "TRAY", sku: "T1" }),
    ];
    const hits = buildInventoryTransfers(sales, items);
    expect(hits.filter((t) => t.vendorModel === "TRAY1")).toHaveLength(0);
  });

  it("lists every store onhand/sold for a vendor model", () => {
    const sales = [
      sale({ storeName: "VJ-SERRA", vendorModel: "RR8179WS", quantity: 3, netRevenue: 300 }),
      sale({ storeName: "VJ-OAK", vendorModel: "RR8179WS", quantity: 1, netRevenue: 100 }),
    ];
    const items = [
      item({ store: "VJ-SERRA", onHand: 2 }),
      item({ store: "VJ-OAK", onHand: 12 }),
      item({ store: "VJ-EAST", onHand: 4 }),
    ];
    const rows = buildModelStoreBreakdown(sales, items, "RR8179WS");
    expect(rows.map((r) => r.store).sort()).toEqual(["VJ-EAST", "VJ-OAK", "VJ-SERRA"]);
    expect(rows.find((r) => r.store === "VJ-OAK")).toMatchObject({ onhand: 12, soldQty: 1 });
    expect(rows.find((r) => r.store === "VJ-SERRA")).toMatchObject({ onhand: 2, soldQty: 3 });
  });
});
