import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/lib/inventory/types";
import type { VendorPosRow } from "@/lib/reports/types";
import { buildInventoryStockRows, buildInventoryTransfers, buildModelStoreBreakdown, buildModelStoreBreakdownFromStock, matchesInventorySearch, queryInventoryMgmtFromBase, transferPriority } from "@/lib/inventory/mgmt-engine";
import {
  isIgnoredInventoryDepartment,
  isInventoryMgmtStore,
  isInventoryOnhandStore,
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
    expect(isInventoryOnhandStore("MAIN")).toBe(true);
    expect(isInventoryOnhandStore("VJ-SERRA")).toBe(true);
    expect(isInventoryMgmtStore("VJ-VIS")).toBe(false);
    expect(isInventoryMgmtStore("DE-SOUTH")).toBe(false);
    expect(isInventoryMgmtStore("VJ-CON")).toBe(false);
    expect(keepReserveQty(2, "new")).toBe(10);
    expect(keepReserveQty(0, "core")).toBe(1);
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

  it("does not donate the last piece; 2 unsold copies can move one", () => {
    const serraNeed = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
      })
    );
    const oneLeft = buildInventoryTransfers(serraNeed, [
      item({ store: "VJ-SERRA", onHand: 3 }),
      item({ store: "VJ-OAK", onHand: 1 }),
    ]).filter((t) => t.fromStore === "VJ-OAK");
    expect(oneLeft).toHaveLength(0);

    const twoUnsold = buildInventoryTransfers(serraNeed, [
      item({ store: "VJ-SERRA", onHand: 3 }),
      item({ store: "VJ-OAK", onHand: 2 }),
    ]).filter((t) => t.fromStore === "VJ-OAK");
    expect(twoUnsold.length).toBeGreaterThan(0);

    const twoSelling = buildInventoryTransfers(
      serraNeed.concat(
        sale({ storeName: "VJ-OAK", vendorModel: "RR8179WS", quantity: 1, netRevenue: 100 })
      ),
      [item({ store: "VJ-SERRA", onHand: 3 }), item({ store: "VJ-OAK", onHand: 2 })]
    ).filter((t) => t.fromStore === "VJ-OAK");
    expect(twoSelling).toHaveLength(0);
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
    expect(rows[0]).toMatchObject({ store: "MAIN", onhand: 0, soldQty: 0, kind: "main" });
    expect(rows.map((r) => r.store).sort()).toEqual(["MAIN", "VJ-EAST", "VJ-OAK", "VJ-SERRA"]);
    expect(rows.find((r) => r.store === "VJ-OAK")).toMatchObject({ onhand: 12, soldQty: 1 });
    expect(rows.find((r) => r.store === "VJ-SERRA")).toMatchObject({ onhand: 2, soldQty: 3 });
  });

  it("never donates from MAIN even with spare warehouse qty", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
      })
    );
    const items = [
      item({ store: "VJ-SERRA", onHand: 3 }),
      item({ store: "MAIN", onHand: 40 }),
    ];
    const hits = buildInventoryTransfers(sales, items);
    expect(hits.every((t) => t.fromStore !== "MAIN")).toBe(true);
    const rows = buildModelStoreBreakdown(sales, items, "RR8179WS");
    expect(rows[0]).toMatchObject({ store: "MAIN", onhand: 40, soldQty: 0 });
  });

  it("collapses size-suffix SKUs so MAIN appears once per vendor model", () => {
    const rows = buildInventoryStockRows([], [
      item({ store: "MAIN", onHand: 11, sku: "121126", vendorModel: "KRI3067-10KW" }),
      item({ store: "MAIN", onHand: 1, sku: "121126Y", vendorModel: "KRI3067-10KW" }),
      item({ store: "VJ-HEND", onHand: 1, sku: "121126", vendorModel: "KRI3067-10KW" }),
    ]);
    const main = rows.filter((r) => r.store === "MAIN" && r.vendorModel === "KRI3067-10KW");
    expect(main).toHaveLength(1);
    expect(main[0]).toMatchObject({ onhand: 12, sku: "121126" });
  });
});

describe("vendor-model photos", () => {
  it("puts onhand Image Dir on transfers and all-on-hand, jpg → webp", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
      })
    ).concat(sale({ storeName: "VJ-OAK", vendorModel: "RR8179WS", quantity: 1, netRevenue: 100 }));
    const items = [
      item({ store: "VJ-SERRA", onHand: 0, imageDir: "\\191402.jpg" }),
      item({ store: "VJ-OAK", onHand: 12, imageDir: "\\191402.jpg" }),
    ];
    const transfers = buildInventoryTransfers(sales, items).filter((t) => t.vendorModel === "RR8179WS");
    expect(transfers.length).toBeGreaterThan(0);
    expect(transfers[0]!.imageDir).toBe("\\191402.webp");
    const stock = buildInventoryStockRows(sales, items).filter((r) => r.vendorModel === "RR8179WS");
    expect(stock.length).toBeGreaterThan(0);
    expect(stock.every((r) => r.imageDir === "\\191402.webp")).toBe(true);
  });

  it("falls back to sales Image Dir when onhand has none", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
        imageDir: "\\229149.jpg",
      })
    ).concat(
      sale({
        storeName: "VJ-OAK",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
        imageDir: "\\229149.jpg",
      })
    );
    const items = [item({ store: "VJ-SERRA", onHand: 0 }), item({ store: "VJ-OAK", onHand: 12 })];
    const transfers = buildInventoryTransfers(sales, items).filter((t) => t.vendorModel === "RR8179WS");
    expect(transfers[0]!.imageDir).toBe("\\229149.webp");
    const stock = buildInventoryStockRows(sales, items).filter((r) => r.vendorModel === "RR8179WS");
    expect(stock[0]!.imageDir).toBe("\\229149.webp");
  });

  it("prefers onhand Image Dir over sales", () => {
    const sales = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
        imageDir: "\\229149.jpg",
      })
    ).concat(
      sale({
        storeName: "VJ-OAK",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
        imageDir: "\\229149.jpg",
      })
    );
    const items = [
      item({ store: "VJ-SERRA", onHand: 0, imageDir: "\\191402.jpg" }),
      item({ store: "VJ-OAK", onHand: 12, imageDir: "\\191402.jpg" }),
    ];
    const transfers = buildInventoryTransfers(sales, items).filter((t) => t.vendorModel === "RR8179WS");
    expect(transfers[0]!.imageDir).toBe("\\191402.webp");
  });
});

describe("inventory mgmt query from cached base", () => {
  const sales = [
    sale({ storeName: "VJ-SERRA", vendorModel: "RR8179WS", quantity: 25, netRevenue: 2500 }),
    sale({ storeName: "VJ-OAK", vendorModel: "RR8179WS", quantity: 1, netRevenue: 100 }),
  ];
  const items = [
    item({ store: "VJ-SERRA", onHand: 0, department: "LADYS RING" }),
    item({ store: "VJ-OAK", onHand: 12, department: "LADYS RING" }),
    item({
      store: "VJ-SERRA",
      onHand: 4,
      sku: "W1",
      vendorModel: "WATCH1",
      department: "WATCH",
      description: "watch",
    }),
  ];

  it("filters transfers after the full rebuild so store/dept changes do not rescan sales", () => {
    const base = {
      stock: buildInventoryStockRows(sales, items),
      transfers: buildInventoryTransfers(sales, items),
    };
    const all = queryInventoryMgmtFromBase(base, {
      dateFrom: "2026-03-01",
      dateTo: "2026-03-01",
      view: "transfers",
      sort: "priorityRank",
      dir: "asc",
      offset: 0,
      limit: 50,
    });
    expect(all.total).toBeGreaterThan(0);

    const rings = queryInventoryMgmtFromBase(base, {
      dateFrom: "2026-03-01",
      dateTo: "2026-03-01",
      departments: ["LADYS RING"],
      view: "transfers",
      sort: "priorityRank",
      dir: "asc",
      offset: 0,
      limit: 50,
    });
    expect(rings.rows.every((r) => r.department === "LADYS RING")).toBe(true);

    const serra = queryInventoryMgmtFromBase(base, {
      dateFrom: "2026-03-01",
      dateTo: "2026-03-01",
      stores: ["VJ-SERRA"],
      view: "transfers",
      sort: "priorityRank",
      dir: "asc",
      offset: 0,
      limit: 50,
    });
    expect(
      serra.rows.every((r) => {
        if (!("toStore" in r) || !("fromStore" in r)) return false;
        return r.toStore === "VJ-SERRA" || r.fromStore === "VJ-SERRA";
      })
    ).toBe(true);
  });

  it("builds the model store grid from stock rows (same MAIN-first shape)", () => {
    const stock = buildInventoryStockRows(sales, items);
    const fromSales = buildModelStoreBreakdown(sales, items, "RR8179WS");
    const fromStock = buildModelStoreBreakdownFromStock(stock, "RR8179WS");
    expect(fromStock[0]).toMatchObject({ store: "MAIN", soldQty: 0, kind: "main" });
    expect(fromStock.map((r) => r.store)).toEqual(fromSales.map((r) => r.store));
    expect(fromStock.find((r) => r.store === "VJ-SERRA")).toMatchObject({
      onhand: fromSales.find((r) => r.store === "VJ-SERRA")?.onhand,
      soldQty: fromSales.find((r) => r.store === "VJ-SERRA")?.soldQty,
    });
  });
});

describe("transfer priority", () => {
  it("marks empty Need stores Rush, A-store thin High, slower restock Fill", () => {
    expect(transferPriority({ onhand: 0, soldQty: 5, toTier: "A", toKind: "core" })).toBe("rush");
    expect(transferPriority({ onhand: 0, soldQty: 8, toTier: "B", toKind: "core" })).toBe("rush");
    expect(transferPriority({ onhand: 1, soldQty: 10, toTier: "A", toKind: "core" })).toBe("high");
    expect(transferPriority({ onhand: 2, soldQty: 8, toTier: "B", toKind: "core" })).toBe("fill");
  });

  it("puts Rush transfers ahead of High", () => {
    const serraNeed = Array.from({ length: 25 }, (_, i) =>
      sale({
        transactionId: `S${i}`,
        storeName: "VJ-SERRA",
        vendorModel: "RR8179WS",
        quantity: 1,
        netRevenue: 100,
      })
    );
    const rows = buildInventoryTransfers(serraNeed, [
      item({ store: "VJ-SERRA", onHand: 0 }),
      item({ store: "VJ-OAK", onHand: 12 }),
    ]);
    const hit = rows.find((t) => t.toStore === "VJ-SERRA" && t.vendorModel === "RR8179WS");
    expect(hit?.priority).toBe("rush");
    expect(hit?.priorityRank).toBe(0);
  });
});

describe("inventory search (model / SKU / description)", () => {
  it("matches description phrases like cuban chain / curb chain", () => {
    const desc = '10KT "ULTIMATE VALUE" YELLOW-GOLD D/C CUBAN CHAIN (NO WARRANTY)';
    expect(matchesInventorySearch("cuban", "TD040", "239132", desc)).toBe(true);
    expect(matchesInventorySearch("cuban chain", "TD040", "239132", desc)).toBe(true);
    expect(matchesInventorySearch("curb chain", "TD040", "239132", desc)).toBe(false);
    expect(
      matchesInventorySearch(
        "curb chain",
        "CPA100",
        "237359",
        '10KT "ULTIMATE VALUE" YELLOW-GOLD D/C CURB CHAIN'
      )
    ).toBe(true);
  });

  it("matches vendor model and SKU the same way", () => {
    expect(matchesInventorySearch("lge+rbc", "LGE+RBC5.00", "228746", "solitaire ring")).toBe(true);
    expect(matchesInventorySearch("228746", "LGE+RBC5.00", "228746", "solitaire ring")).toBe(true);
  });
});
