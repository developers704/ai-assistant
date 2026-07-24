import fs from "fs";
import path from "path";
import { parseInventoryCsv } from "./parse-csv";
import { calculatePricing } from "./pricing";
import type { InventoryItem } from "./types";

const INVENTORY_DIR = path.join(process.cwd(), ".data", "inventory");
const INVENTORY_FILE = path.join(INVENTORY_DIR, "inventory.csv");
const SEED_ONHAND = path.join(process.cwd(), "data", "inventory", "Inventory-Onhand.csv");

interface InventoryIndex {
  byStoreSku: Map<string, InventoryItem>;
  bySku: Map<string, InventoryItem[]>;
  /** Onhand qty keyed by STORE|SKU — present when file has Onhand Qty. */
  onhandByStoreSku: Map<string, number>;
  hasOnhandData: boolean;
  loadedAt: number;
  rowCount: number;
  fileMtime: number;
}

let cache: InventoryIndex | null = null;

function ensureDir() {
  if (!fs.existsSync(INVENTORY_DIR)) {
    fs.mkdirSync(INVENTORY_DIR, { recursive: true });
  }
}

function storeSkuKey(store: string, sku: string): string {
  return `${store.trim().toUpperCase()}|${sku.trim().toUpperCase()}`;
}

function buildIndex(
  items: InventoryItem[],
  fileMtime: number,
  hasOnhandColumn: boolean
): InventoryIndex {
  const byStoreSku = new Map<string, InventoryItem>();
  const bySku = new Map<string, InventoryItem[]>();
  const onhandByStoreSku = new Map<string, number>();

  for (const item of items) {
    const key = storeSkuKey(item.store, item.sku);
    byStoreSku.set(key, item);

    const skuKey = item.sku.trim().toUpperCase();
    const list = bySku.get(skuKey) ?? [];
    list.push(item);
    bySku.set(skuKey, list);

    if (hasOnhandColumn) {
      onhandByStoreSku.set(key, item.onhandQty ?? 0);
    }
  }

  return {
    byStoreSku,
    bySku,
    onhandByStoreSku,
    hasOnhandData: hasOnhandColumn,
    loadedAt: Date.now(),
    rowCount: items.length,
    fileMtime,
  };
}

/** Copy bundled on-hand inventory when .data inventory is missing, outdated, or lacks Onhand Qty. */
function ensureSeedInventory() {
  if (!fs.existsSync(SEED_ONHAND)) return;
  ensureDir();

  const copySeed = () => {
    fs.copyFileSync(SEED_ONHAND, INVENTORY_FILE);
    fs.writeFileSync(
      path.join(INVENTORY_DIR, "source-name.txt"),
      "Inventory-Onhand.csv",
      "utf-8"
    );
    cache = null;
  };

  if (!fs.existsSync(INVENTORY_FILE) || fs.statSync(INVENTORY_FILE).size === 0) {
    copySeed();
    return;
  }

  const head = fs.readFileSync(INVENTORY_FILE, "utf-8").slice(0, 800);
  if (!/on\s*-?\s*hand\s*qty/i.test(head)) {
    copySeed();
    return;
  }

  const seedStat = fs.statSync(SEED_ONHAND);
  const cur = fs.statSync(INVENTORY_FILE);
  if (seedStat.mtimeMs > cur.mtimeMs) copySeed();
}

function loadIndex(): InventoryIndex | null {
  ensureSeedInventory();
  ensureDir();
  if (!fs.existsSync(INVENTORY_FILE)) return null;

  const stat = fs.statSync(INVENTORY_FILE);
  if (cache && cache.fileMtime === stat.mtimeMs) return cache;

  const csvText = fs.readFileSync(INVENTORY_FILE, "utf-8");
  const { items, hasOnhandColumn } = parseInventoryCsv(csvText);
  cache = buildIndex(items, stat.mtimeMs, hasOnhandColumn);
  return cache;
}

export function getInventoryStatus(): {
  loaded: boolean;
  rowCount: number;
  filePath: string;
  loadedAt: string | null;
  hasOnhandData: boolean;
} {
  const index = loadIndex();
  return {
    loaded: !!index && index.rowCount > 0,
    rowCount: index?.rowCount ?? 0,
    filePath: ".data/inventory/inventory.csv",
    loadedAt: index ? new Date(index.loadedAt).toISOString() : null,
    hasOnhandData: index?.hasOnhandData ?? false,
  };
}

export function saveInventoryCsv(csvText: string, fileName?: string): {
  rowCount: number;
} {
  ensureDir();
  const { items } = parseInventoryCsv(csvText);
  if (items.length === 0) {
    throw new Error("No valid inventory rows found. Check CSV format and columns.");
  }

  fs.writeFileSync(INVENTORY_FILE, csvText, "utf-8");
  if (fileName) {
    fs.writeFileSync(
      path.join(INVENTORY_DIR, "source-name.txt"),
      fileName,
      "utf-8"
    );
  }

  cache = null;
  const index = loadIndex();
  return { rowCount: index?.rowCount ?? items.length };
}

export function lookupInventory(
  sku: string,
  store: string
): {
  item: InventoryItem;
  pricing: ReturnType<typeof calculatePricing>;
} | null {
  const index = loadIndex();
  if (!index) return null;

  const normalizedSku = sku.trim().toUpperCase();
  const normalizedStore = store.trim().toUpperCase();

  const atStore = index.byStoreSku.get(storeSkuKey(normalizedStore, normalizedSku));
  if (atStore) {
    return { item: atStore, pricing: calculatePricing(atStore) };
  }

  const candidates = index.bySku.get(normalizedSku);
  if (!candidates?.length) return null;

  const item = candidates[0];
  return { item, pricing: calculatePricing(item) };
}

/**
 * On-hand quantity for a SKU at a store.
 * Returns null when inventory is not loaded / has no on-hand column.
 * Returns 0 when inventory is loaded but this store+SKU is absent (sold out / not stocked).
 */
export function lookupOnhandQty(sku: string, store: string): number | null {
  const index = loadIndex();
  if (!index?.hasOnhandData) return null;
  const key = storeSkuKey(store, sku);
  if (!index.onhandByStoreSku.has(key)) return 0;
  return index.onhandByStoreSku.get(key) ?? 0;
}

export function inventoryHasOnhandData(): boolean {
  return loadIndex()?.hasOnhandData ?? false;
}

export function invalidateInventoryCache() {
  cache = null;
}
