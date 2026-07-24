import fs from "fs";
import path from "path";
import { parseInventoryCsv } from "./parse-csv";
import { calculatePricing } from "./pricing";
import type { InventoryItem } from "./types";

const INVENTORY_DIR = path.join(process.cwd(), ".data", "inventory");
const INVENTORY_FILE = path.join(INVENTORY_DIR, "inventory.csv");

interface InventoryIndex {
  byStoreSku: Map<string, InventoryItem>;
  bySku: Map<string, InventoryItem[]>;
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

function buildIndex(items: InventoryItem[], fileMtime: number): InventoryIndex {
  const byStoreSku = new Map<string, InventoryItem>();
  const bySku = new Map<string, InventoryItem[]>();

  for (const item of items) {
    byStoreSku.set(storeSkuKey(item.store, item.sku), item);

    const skuKey = item.sku.trim().toUpperCase();
    const list = bySku.get(skuKey) ?? [];
    list.push(item);
    bySku.set(skuKey, list);
  }

  return {
    byStoreSku,
    bySku,
    loadedAt: Date.now(),
    rowCount: items.length,
    fileMtime,
  };
}

function loadIndex(): InventoryIndex | null {
  ensureDir();
  if (!fs.existsSync(INVENTORY_FILE)) return null;

  const stat = fs.statSync(INVENTORY_FILE);
  if (cache && cache.fileMtime === stat.mtimeMs) return cache;

  const csvText = fs.readFileSync(INVENTORY_FILE, "utf-8");
  const items = parseInventoryCsv(csvText);
  cache = buildIndex(items, stat.mtimeMs);
  return cache;
}

export function getInventoryStatus(): {
  loaded: boolean;
  rowCount: number;
  filePath: string;
  loadedAt: string | null;
} {
  const index = loadIndex();
  return {
    loaded: !!index && index.rowCount > 0,
    rowCount: index?.rowCount ?? 0,
    filePath: ".data/inventory/inventory.csv",
    loadedAt: index ? new Date(index.loadedAt).toISOString() : null,
  };
}

export function saveInventoryCsv(csvText: string, fileName?: string): {
  rowCount: number;
} {
  ensureDir();
  const items = parseInventoryCsv(csvText);
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

export function invalidateInventoryCache() {
  cache = null;
}
