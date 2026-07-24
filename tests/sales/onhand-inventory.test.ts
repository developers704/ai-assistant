import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { parseInventoryCsv } from "@/lib/inventory/parse-csv";
import { lookupOnhandQty, invalidateInventoryCache, getInventoryStatus } from "@/lib/inventory/store";

describe("onhand inventory CSV", () => {
  it("parses SKU + store + onhand qty from July onhand export", () => {
    const csvPath = path.join(process.cwd(), "data", "inventory", "Inventory-Onhand.csv");
    if (!fs.existsSync(csvPath)) return;

    const { items, hasOnhandColumn } = parseInventoryCsv(fs.readFileSync(csvPath, "utf-8"));
    expect(hasOnhandColumn).toBe(true);
    expect(items.length).toBeGreaterThan(1000);

    const sample = items.find(
      (i) => i.sku.toUpperCase() === "224493-22" && i.store.toUpperCase() === "VJ-VICTOR"
    );
    expect(sample).toBeTruthy();
    expect(sample!.vendorModel.toUpperCase()).toContain("CMM 070");
    expect(sample!.onhandQty).toBe(1);
  });

  it("looks up onhand by store + SKU after seed load", () => {
    invalidateInventoryCache();
    const status = getInventoryStatus();
    expect(status.loaded).toBe(true);
    expect(status.hasOnhandData).toBe(true);

    expect(lookupOnhandQty("224493-22", "VJ-VICTOR")).toBe(1);
    expect(lookupOnhandQty("224493-22", "VJ-ARDN")).toBeGreaterThanOrEqual(0);
    // Absent store+SKU → 0 when onhand file is loaded
    expect(lookupOnhandQty("224493-22", "NO-SUCH-STORE")).toBe(0);
  });
});
