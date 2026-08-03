import fs from "fs";
import path from "path";
import { parseInventoryCsv } from "./parse-csv";
import { calculatePricing } from "./pricing";
import type { InventoryItem } from "./types";

const INVENTORY_DIR = path.join(process.cwd(), ".data", "inventory");
const INVENTORY_FILE = path.join(INVENTORY_DIR, "inventory.csv");
const ONHAND_FILE = path.join(INVENTORY_DIR, "onhand.csv");
const DATA_INVENTORY_DIR = path.join(process.cwd(), "data", "inventory");
const DATA_INVENTORY_SEED = path.join(DATA_INVENTORY_DIR, "Inventory-Onhand.csv");
const DATA_INVENTORY_WHOLE_COST = path.join(DATA_INVENTORY_DIR, "ON_HAND_REPORT_with_WholeCost.csv");

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

/** Prefer the newest, role-aware inventory export that still contains pricing + on-hand data. */
function resolveInventoryCsvPath(): string {
  ensureDir();

  const candidates = [
    DATA_INVENTORY_WHOLE_COST,
    DATA_INVENTORY_SEED,
    INVENTORY_FILE,
    ONHAND_FILE,
  ].filter((p) => fs.existsSync(p));

  const ranked = [...candidates].sort((a, b) => {
    const sa = fs.statSync(a).mtimeMs;
    const sb = fs.statSync(b).mtimeMs;
    return sb - sa;
  });

  for (const filePath of ranked) {
    const head = fs.readFileSync(filePath, "utf-8").slice(0, 800).split(/\r?\n/)[0] ?? "";
    if (/(?:item|sku)\s*#/i.test(head) && /(?:individual|whole)\s*cost/i.test(head)) {
      return filePath;
    }
    if (/on-?hand/i.test(head) && /vendor\s*#/i.test(head)) return filePath;
    if (/item\s*#/i.test(head) && /vendor\s*model/i.test(head)) return filePath;
  }

  return ranked[0] ?? INVENTORY_FILE;
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

function inventorySourceStamp(): number {
  let stamp = 0;
  for (const p of [
    DATA_INVENTORY_WHOLE_COST,
    DATA_INVENTORY_SEED,
    INVENTORY_FILE,
    ONHAND_FILE,
  ]) {
    if (fs.existsSync(p)) stamp = Math.max(stamp, fs.statSync(p).mtimeMs);
  }
  return stamp;
}

function loadIndex(): InventoryIndex | null {
  ensureDir();
  const stamp = inventorySourceStamp();
  if (!stamp) return null;
  if (cache && cache.fileMtime === stamp) return cache;

  const filePath = resolveInventoryCsvPath();
  if (!fs.existsSync(filePath)) return null;

  const csvText = fs.readFileSync(filePath, "utf-8");
  const items = parseInventoryCsv(csvText);
  cache = buildIndex(items, stamp);
  return cache;
}

export function getInventoryStatus(): {
  loaded: boolean;
  rowCount: number;
  filePath: string;
  loadedAt: string | null;
} {
  const index = loadIndex();
  const actualPath = resolveInventoryCsvPath();
  return {
    loaded: !!index && index.rowCount > 0,
    rowCount: index?.rowCount ?? 0,
    filePath: path.relative(process.cwd(), actualPath) || actualPath,
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
  if (!fs.existsSync(DATA_INVENTORY_DIR)) {
    fs.mkdirSync(DATA_INVENTORY_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_INVENTORY_SEED, csvText, "utf-8");
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
  store?: string | null
): {
  item: InventoryItem;
  pricing: ReturnType<typeof calculatePricing>;
  stores: { name: string; onhand: number }[];
  onHandTotal: number;
} | null {
  const index = loadIndex();
  if (!index) return null;

  const normalizedSku = sku.trim().toUpperCase();
  if (!normalizedSku) return null;

  const candidates = index.bySku.get(normalizedSku);
  if (!candidates?.length) return null;

  let item = candidates.find((c) => c.tagPrice > 0) ?? candidates[0];
  if (store?.trim()) {
    const atStore = index.byStoreSku.get(
      storeSkuKey(store.trim().toUpperCase(), normalizedSku)
    );
    if (atStore) {
      item = {
        ...item,
        ...atStore,
        tagPrice: atStore.tagPrice || item.tagPrice,
        costPrice: atStore.costPrice || item.costPrice,
        wholesaleCost: atStore.wholesaleCost || item.wholesaleCost,
      };
    }
  }

  const byStore = new Map<string, number>();
  for (const c of candidates) {
    const name = c.store?.trim();
    if (!name) continue;
    byStore.set(name, (byStore.get(name) ?? 0) + (Number(c.onHand) || 0));
  }
  const stores = [...byStore.entries()]
    .map(([name, onhand]) => ({ name, onhand }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const onHandTotal = stores.reduce((s, x) => s + x.onhand, 0);

  return {
    item,
    pricing: calculatePricing(item),
    stores,
    onHandTotal,
  };
}

export function invalidateInventoryCache() {
  cache = null;
}
