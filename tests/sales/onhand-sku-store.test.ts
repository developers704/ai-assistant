import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  getOnhandStatus,
  invalidateOnhandCache,
  isMainOnhandStore,
  listOnhandByStoreForVendorModel,
  lookupOnhandQty,
} from "@/lib/inventory/onhand";
import { skuLinesForModel } from "@/lib/sales/sales-aggregate";
import type { VendorPosRow } from "@/lib/reports/types";

describe("onhand SKU×store lookup", () => {
  it("loads seed and matches store + SKU", () => {
    const seed = path.join(process.cwd(), "data", "inventory", "Inventory-Onhand.csv");
    if (!fs.existsSync(seed)) return;

    invalidateOnhandCache();
    const status = getOnhandStatus();
    expect(status.loaded).toBe(true);
    expect(status.rowCount).toBeGreaterThan(1000);

    expect(lookupOnhandQty("194397", "VJ-ARDN")).toBe(1);
    expect(lookupOnhandQty("197742", "VJ-NORTH")).toBe(1);
    expect(lookupOnhandQty("194397", "NO-SUCH-STORE")).toBe(0);
  });

  it("attaches store, transaction, net sale, and date on SKU expand lines", () => {
    const seed = path.join(process.cwd(), "data", "inventory", "Inventory-Onhand.csv");
    if (!fs.existsSync(seed)) return;

    invalidateOnhandCache();
    expect(getOnhandStatus().loaded).toBe(true);

    const row = (partial: Partial<VendorPosRow>): VendorPosRow =>
      ({
        date: "2026-07-10",
        storeName: "VJ-ARDN",
        department: "B",
        design: "X",
        vendor: "Y",
        productClass: "RING",
        sku: "194397",
        itemNumber: "194397",
        vendorModel: "LGYELLOWCU1.50",
        description: "Test",
        quantity: 1,
        netRevenue: 100,
        grossSales: 100,
        discountAmount: 0,
        discountRate: 0,
        inventoryCost: 0,
        margin: 50,
        transactionId: "T1",
        ...partial,
      }) as VendorPosRow;

    const lines = skuLinesForModel([
      row({ storeName: "VJ-ARDN", quantity: 1, transactionId: "T1", date: "2026-07-10", netRevenue: 100 }),
      row({ storeName: "NO-SUCH-STORE", quantity: 2, transactionId: "T2", date: "2026-07-11", netRevenue: 200 }),
    ]);

    const stores = lines[0].stores ?? [];
    expect(stores).toHaveLength(2);
    expect(stores.find((s) => s.transactionId === "T2")).toMatchObject({
      name: "NO-SUCH-STORE",
      units: 2,
      revenue: 200,
      date: "2026-07-11",
    });
    expect(stores.find((s) => s.transactionId === "T1")).toMatchObject({
      name: "VJ-ARDN",
      units: 1,
      revenue: 100,
      date: "2026-07-10",
    });
    expect(stores.every((s) => s.onhand == null)).toBe(true);
  });

  it("rolls vendor-model onhand across all SKUs including MAIN", () => {
    const seed = path.join(process.cwd(), "data", "inventory", "Inventory-Onhand.csv");
    if (!fs.existsSync(seed)) return;

    invalidateOnhandCache();
    expect(getOnhandStatus().loaded).toBe(true);

    const rollup = listOnhandByStoreForVendorModel("SUBMARINER-SS");
    expect(rollup).toBeTruthy();
    expect(rollup!.skuCount).toBeGreaterThan(2);
    expect(rollup!.total).toBeGreaterThan(2);
    expect(rollup!.stores[0]?.store.toUpperCase()).toBe("MAIN");
    expect(rollup!.stores.find((s) => isMainOnhandStore(s.store))?.onhand).toBeGreaterThan(0);
    expect(lookupOnhandQty("197742", "VJ-NORTH")).toBe(1);
    expect(lookupOnhandQty("240659", "VJ-ONT")).toBe(1);

    const north = rollup!.stores.find((s) => s.store.toUpperCase() === "VJ-NORTH");
    expect(north?.skus.some((sku) => sku.sku === "197742" && sku.onhand === 1)).toBe(true);
    expect(north?.onhand).toBe(
      north!.skus.reduce((sum, sku) => sum + sku.onhand, 0)
    );
  });
});
