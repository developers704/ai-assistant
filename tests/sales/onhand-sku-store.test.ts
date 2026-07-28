import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  getOnhandStatus,
  invalidateOnhandCache,
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
    expect(lookupOnhandQty("224493-22", "VJ-VICTOR")).toBe(1);
    expect(lookupOnhandQty("194397", "NO-SUCH-STORE")).toBe(0);
  });

  it("attaches onhand onto vendor-model SKU store lines", () => {
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
      row({ storeName: "VJ-ARDN", quantity: 1, transactionId: "T1" }),
      row({ storeName: "NO-SUCH-STORE", quantity: 2, transactionId: "T2" }),
    ]);

    const stores = lines[0].stores ?? [];
    // Sold stores always present
    expect(stores.find((s) => s.name === "NO-SUCH-STORE")).toEqual({
      name: "NO-SUCH-STORE",
      units: 2,
      onhand: 0,
    });
    expect(stores.find((s) => s.name === "VJ-ARDN")).toMatchObject({
      name: "VJ-ARDN",
      units: 1,
      onhand: 1,
    });
  });

  it("lists onhand-only stores (0 sold) for a SKU", () => {
    const seed = path.join(process.cwd(), "data", "inventory", "Inventory-Onhand.csv");
    if (!fs.existsSync(seed)) return;

    invalidateOnhandCache();
    expect(getOnhandStatus().loaded).toBe(true);

    const row = (partial: Partial<VendorPosRow>): VendorPosRow =>
      ({
        date: "2026-07-10",
        storeName: "VJ-ROSE",
        department: "B",
        design: "X",
        vendor: "Y",
        productClass: "RING",
        sku: "236292Y",
        itemNumber: "236292Y",
        vendorModel: "D67",
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
      row({ storeName: "VJ-ROSE", quantity: 1, transactionId: "T1" }),
    ]);
    const stores = lines[0].stores ?? [];
    expect(stores.find((s) => s.name === "VJ-ROSE")?.units).toBe(1);
    expect(stores.some((s) => s.units === 0 && (s.onhand ?? 0) >= 0)).toBe(true);
    expect(stores.length).toBeGreaterThan(1);
  });
});
