/**
 * Lightweight on-hand inventory lookup for Sales Top Vendor Models.
 * Indexes only STORE|SKU → qty (no pricing / full inventory parse).
 */
import fs from "fs";
import path from "path";

const ONHAND_DIR = path.join(process.cwd(), ".data", "inventory");
const ONHAND_FILE = path.join(ONHAND_DIR, "onhand.csv");
const SEED_ONHAND = path.join(process.cwd(), "data", "inventory", "Inventory-Onhand.csv");

type SkuCatalogMeta = {
  sku: string;
  department?: string;
  design?: string;
  productClass?: string;
  subClass?: string;
  vendor?: string;
  vendorModel?: string;
  description?: string;
};

type OnhandIndex = {
  byStoreSku: Map<string, number>;
  /** SKU (upper) → store → onhand qty */
  bySku: Map<string, Map<string, number>>;
  /** SKU (upper) → catalog fields from inventory export */
  bySkuMeta: Map<string, SkuCatalogMeta>;
  /** Vendor model (upper) → SKU keys */
  byVendorModel: Map<string, Set<string>>;
  loadedAt: number;
  fileMtime: number;
  rowCount: number;
};

let cache: OnhandIndex | null = null;

function ensureDir() {
  if (!fs.existsSync(ONHAND_DIR)) fs.mkdirSync(ONHAND_DIR, { recursive: true });
}

function storeSkuKey(store: string, sku: string): string {
  return `${store.trim().toUpperCase()}|${sku.trim().toUpperCase()}`;
}

/** Minimal CSV line split that respects quotes. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseOnhandCsv(csvText: string): {
  byStoreSku: Map<string, number>;
  bySku: Map<string, Map<string, number>>;
  bySkuMeta: Map<string, SkuCatalogMeta>;
  byVendorModel: Map<string, Set<string>>;
} {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) {
    return {
      byStoreSku: new Map(),
      bySku: new Map(),
      bySkuMeta: new Map(),
      byVendorModel: new Map(),
    };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const skuIdx = headers.findIndex((h) => h === "sku #" || h === "sku" || h === "item #");
  const storeIdx = headers.findIndex((h) => h === "store");
  const deptIdx = headers.findIndex((h) => h === "department");
  const designIdx = headers.findIndex((h) => h === "design");
  const classIdx = headers.findIndex((h) => h === "class");
  const subClassIdx = headers.findIndex(
    (h) => h === "sub-class" || h === "sub class" || h === "subclass"
  );
  const vendorIdx = headers.findIndex(
    (h) => h === "vendor" || h === "vendor name" || h === "vendor name"
  );
  const modelIdx = headers.findIndex(
    (h) => h === "vendor model #" || h === "vendor model" || h === "vendor model #"
  );
  const descIdx = headers.findIndex(
    (h) => h === "item desc" || h === "description" || h === "item description"
  );
  const qtyIdx = headers.findIndex(
    (h) =>
      h === "onhand qty" ||
      h === "on hand qty" ||
      h === "on-hand qty" ||
      h === "qty on hand" ||
      h === "on-hand" ||
      h === "onhand"
  );
  if (skuIdx < 0 || storeIdx < 0 || qtyIdx < 0) {
    throw new Error('Onhand CSV needs "SKU #", "Store", and "Onhand Qty" columns.');
  }

  const byStoreSku = new Map<string, number>();
  const bySku = new Map<string, Map<string, number>>();
  const bySkuMeta = new Map<string, SkuCatalogMeta>();
  const byVendorModel = new Map<string, Set<string>>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = splitCsvLine(line);
    const sku = (cols[skuIdx] ?? "").trim();
    const store = (cols[storeIdx] ?? "").trim();
    if (!sku || !store) continue;
    const raw = (cols[qtyIdx] ?? "").trim().replace(/,/g, "");
    const qty = Number.parseFloat(raw);
    const n = Number.isFinite(qty) ? qty : 0;
    const key = storeSkuKey(store, sku);
    // If duplicate store+SKU rows appear, keep the last (snapshot truth).
    byStoreSku.set(key, n);
    const skuKey = sku.toUpperCase();
    let storeMap = bySku.get(skuKey);
    if (!storeMap) {
      storeMap = new Map();
      bySku.set(skuKey, storeMap);
    }
    storeMap.set(store.trim(), n);

    if (!bySkuMeta.has(skuKey)) {
      bySkuMeta.set(skuKey, {
        sku,
        department: deptIdx >= 0 ? (cols[deptIdx] ?? "").trim() : undefined,
        design: designIdx >= 0 ? (cols[designIdx] ?? "").trim() : undefined,
        productClass: classIdx >= 0 ? (cols[classIdx] ?? "").trim() : undefined,
        subClass: subClassIdx >= 0 ? (cols[subClassIdx] ?? "").trim() : undefined,
        vendor: vendorIdx >= 0 ? (cols[vendorIdx] ?? "").trim() : undefined,
        vendorModel: modelIdx >= 0 ? (cols[modelIdx] ?? "").trim() : undefined,
        description: descIdx >= 0 ? (cols[descIdx] ?? "").trim() : undefined,
      });
    }
    const model = modelIdx >= 0 ? (cols[modelIdx] ?? "").trim() : "";
    if (model) {
      const modelKey = model.toUpperCase();
      let set = byVendorModel.get(modelKey);
      if (!set) {
        set = new Set();
        byVendorModel.set(modelKey, set);
      }
      set.add(skuKey);
    }
  }
  return { byStoreSku, bySku, bySkuMeta, byVendorModel };
}

function ensureSeedOnhand() {
  if (!fs.existsSync(SEED_ONHAND)) return;
  ensureDir();

  const copySeed = () => {
    fs.copyFileSync(SEED_ONHAND, ONHAND_FILE);
    cache = null;
  };

  if (!fs.existsSync(ONHAND_FILE) || fs.statSync(ONHAND_FILE).size === 0) {
    copySeed();
    return;
  }

  const seedStat = fs.statSync(SEED_ONHAND);
  const curStat = fs.statSync(ONHAND_FILE);
  // Prefer the bundled snapshot when it is newer or clearly larger (avoids a
  // tiny upload/test file permanently shadowing the full onhand export).
  if (seedStat.mtimeMs > curStat.mtimeMs || seedStat.size > curStat.size * 2) {
    copySeed();
  }
}

function loadIndex(): OnhandIndex | null {
  ensureSeedOnhand();
  ensureDir();
  if (!fs.existsSync(ONHAND_FILE)) return null;

  const stat = fs.statSync(ONHAND_FILE);
  if (cache && cache.fileMtime === stat.mtimeMs) return cache;

  const text = fs.readFileSync(ONHAND_FILE, "utf-8");
  const { byStoreSku, bySku, bySkuMeta, byVendorModel } = parseOnhandCsv(text);
  cache = {
    byStoreSku,
    bySku,
    bySkuMeta,
    byVendorModel,
    loadedAt: Date.now(),
    fileMtime: stat.mtimeMs,
    rowCount: byStoreSku.size,
  };
  return cache;
}

export function getOnhandStatus(): {
  loaded: boolean;
  rowCount: number;
  loadedAt: string | null;
} {
  const index = loadIndex();
  return {
    loaded: !!index && index.rowCount > 0,
    rowCount: index?.rowCount ?? 0,
    loadedAt: index ? new Date(index.loadedAt).toISOString() : null,
  };
}

/**
 * On-hand qty for SKU at store.
 * null = onhand file not loaded.
 * 0 = loaded but this store+SKU absent (or qty 0).
 */
export function lookupOnhandQty(sku: string, store: string): number | null {
  const index = loadIndex();
  if (!index) return null;
  const key = storeSkuKey(store, sku);
  if (!index.byStoreSku.has(key)) return 0;
  return index.byStoreSku.get(key) ?? 0;
}

/**
 * Every store that has an onhand row for this SKU (including qty 0).
 * null = onhand file not loaded.
 */
export function listOnhandStoresForSku(
  sku: string
): { store: string; onhand: number }[] | null {
  const index = loadIndex();
  if (!index) return null;
  const storeMap = index.bySku.get(sku.trim().toUpperCase());
  if (!storeMap?.size) return [];
  return [...storeMap.entries()]
    .map(([store, onhand]) => ({ store, onhand }))
    .sort((a, b) => a.store.localeCompare(b.store));
}

export function hasOnhandData(): boolean {
  return (loadIndex()?.rowCount ?? 0) > 0;
}

export function lookupSkuCatalogMeta(sku: string): SkuCatalogMeta | null {
  const index = loadIndex();
  if (!index) return null;
  return index.bySkuMeta.get(sku.trim().toUpperCase()) ?? null;
}

/** SKU keys (upper) tied to a vendor model in the on-hand export. */
export function listSkuKeysForVendorModel(vendorModel: string): string[] {
  const index = loadIndex();
  if (!index) return [];
  const set = index.byVendorModel.get(vendorModel.trim().toUpperCase());
  return set ? [...set] : [];
}

export function invalidateOnhandCache() {
  cache = null;
}

/** Replace onhand snapshot (e.g. upload / deploy refresh). */
export function saveOnhandCsv(csvText: string): { rowCount: number } {
  ensureDir();
  const { byStoreSku } = parseOnhandCsv(csvText);
  if (!byStoreSku.size) throw new Error("No onhand rows found.");
  fs.writeFileSync(ONHAND_FILE, csvText, "utf-8");
  cache = null;
  const index = loadIndex();
  return { rowCount: index?.rowCount ?? byStoreSku.size };
}
