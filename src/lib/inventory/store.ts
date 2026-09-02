import fs from "fs";
import path from "path";
import { parseInventoryCsv } from "./parse-csv";
import { calculatePricing } from "./pricing";
import { normalizeAndFillOnhandCsv } from "./normalize-onhand-csv";
import { resolveInventorySkuKey, isBareItemNumber } from "./sku-lookup-resolve";
import { skuCostKey } from "./whole-cost-rules";
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
  /** Leading Item # digits → full SKUs (231611 → 231611Y). */
  byCostKey: Map<string, string[]>;
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
  const byCostKey = new Map<string, string[]>();

  for (const item of items) {
    byStoreSku.set(storeSkuKey(item.store, item.sku), item);

    const skuKey = item.sku.trim().toUpperCase();
    const list = bySku.get(skuKey) ?? [];
    list.push(item);
    bySku.set(skuKey, list);

    const costKey = skuCostKey(skuKey);
    if (!costKey) continue;
    const variants = byCostKey.get(costKey) ?? [];
    if (!variants.includes(skuKey)) variants.push(skuKey);
    byCostKey.set(costKey, variants);
  }

  return {
    byStoreSku,
    bySku,
    byCostKey,
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
  wholeCostStats?: ReturnType<typeof normalizeAndFillOnhandCsv>["stats"];
} {
  ensureDir();
  const { csv: filled, stats: wholeCostStats } = normalizeAndFillOnhandCsv(csvText);
  const items = parseInventoryCsv(filled);
  if (items.length === 0) {
    throw new Error("No valid inventory rows found. Check CSV format and columns.");
  }

  if (!fs.existsSync(DATA_INVENTORY_DIR)) {
    fs.mkdirSync(DATA_INVENTORY_DIR, { recursive: true });
  }

  // Replace every live + seed copy so calculator + sales onhand stay in sync.
  for (const target of [
    INVENTORY_FILE,
    ONHAND_FILE,
    DATA_INVENTORY_SEED,
    DATA_INVENTORY_WHOLE_COST,
  ]) {
    fs.writeFileSync(target, filled, "utf-8");
  }

  if (fileName) {
    fs.writeFileSync(
      path.join(INVENTORY_DIR, "source-name.txt"),
      fileName,
      "utf-8"
    );
  }

  cache = null;
  const index = loadIndex();
  return { rowCount: index?.rowCount ?? items.length, wholeCostStats };
}

function skuVariantScore(items: InventoryItem[]): { onHand: number; tagPrice: number } {
  let onHand = 0;
  let tagPrice = 0;
  for (const row of items) {
    onHand += Number(row.onHand) || 0;
    if ((row.tagPrice || 0) > tagPrice) tagPrice = row.tagPrice || 0;
  }
  return { onHand, tagPrice };
}

export function lookupInventory(
  sku: string,
  store?: string | null
): {
  item: InventoryItem;
  pricing: ReturnType<typeof calculatePricing>;
  stores: { name: string; onhand: number }[];
  onHandTotal: number;
  queriedSku: string;
  resolvedSku: string;
} | null {
  const index = loadIndex();
  if (!index) return null;

  const queriedSku = sku.trim().toUpperCase();
  if (!queriedSku) return null;

  let resolvedSku = index.bySku.has(queriedSku) ? queriedSku : null;
  if (!resolvedSku && isBareItemNumber(queriedSku)) {
    const candidates = index.byCostKey.get(queriedSku) ?? [];
    resolvedSku = resolveInventorySkuKey(queriedSku, candidates, (key) =>
      skuVariantScore(index.bySku.get(key) ?? [])
    );
  }
  if (!resolvedSku) return null;

  const candidates = index.bySku.get(resolvedSku);
  if (!candidates?.length) return null;

  let item = candidates.find((c) => c.tagPrice > 0) ?? candidates[0];
  if (store?.trim()) {
    const atStore = index.byStoreSku.get(
      storeSkuKey(store.trim().toUpperCase(), resolvedSku)
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
    queriedSku,
    resolvedSku,
  };
}

export function invalidateInventoryCache() {
  cache = null;
}
