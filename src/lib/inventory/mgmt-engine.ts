import type { InventoryItem } from "@/lib/inventory/types";
import { normalizeSalesImageDir } from "@/lib/reports/product-image";
import type { VendorPosRow } from "@/lib/reports/types";
import { isHiddenFromTopVendorModelsRow, salesUnitsSold } from "@/lib/utils";
import {
  donorRank,
  inventoryDmForStore,
  inventoryKindForStore,
  inventoryTierForStore,
  isIgnoredInventoryDepartment,
  isInventoryMgmtStore,
  isInventoryOnhandStore,
  isMainStore,
  isSellingWell,
  keepReserveQty,
  listInventoryMgmtStores,
  type InventoryDm,
  type InventoryStoreKind,
  type InventoryTier,
} from "@/lib/inventory/mgmt-stores";

export type InventoryStockRow = {
  store: string;
  dm: InventoryDm;
  tier: InventoryTier;
  kind: InventoryStoreKind;
  vendorModel: string;
  sku: string;
  vendor: string;
  description: string;
  department: string;
  design: string;
  productClass: string;
  subClass: string;
  tagPrice: number;
  costPrice: number;
  wholesaleCost: number;
  onhand: number;
  soldQty: number;
  revenue: number;
  coverage: number | null;
  /** POS Image Dir. (webp) — same as Top Vendor Models. */
  imageDir: string;
};

export type InventoryModelStoreRow = {
  store: string;
  dm: InventoryDm;
  tier: InventoryTier;
  kind: InventoryStoreKind;
  onhand: number;
  soldQty: number;
};

/** Rush = move today. High = soon. Fill = restock after those. */
export type TransferPriority = "rush" | "high" | "fill";

export const TRANSFER_PRIORITY_RANK: Record<TransferPriority, number> = {
  rush: 0,
  high: 1,
  fill: 2,
};

/**
 * Rush — Need store is empty and already selling (lost sales now).
 * High — A / New still has a piece but sell-through is thin.
 * Fill — slower store restock; do after Rush / High.
 */
export function transferPriority(input: {
  onhand: number;
  soldQty: number;
  toTier: InventoryTier;
  toKind: InventoryStoreKind;
}): TransferPriority {
  const oh = Math.max(0, Number(input.onhand) || 0);
  const sold = Math.max(0, Number(input.soldQty) || 0);
  if (oh <= 0) return "rush";
  if ((input.toTier === "A" || input.toKind === "new") && oh <= 1 && sold >= 5) return "high";
  if (input.toTier === "A") return "high";
  return "fill";
}

export type InventoryTransfer = {
  vendorModel: string;
  sku: string;
  vendor: string;
  description: string;
  department: string;
  design: string;
  productClass: string;
  subClass: string;
  tagPrice: number;
  costPrice: number;
  wholesaleCost: number;
  toStore: string;
  toDm: InventoryDm;
  toTier: InventoryTier;
  toKind: InventoryStoreKind;
  soldQty: number;
  revenue: number;
  onhand: number;
  fromStore: string;
  fromDm: InventoryDm;
  fromTier: InventoryTier;
  fromKind: InventoryStoreKind;
  fromOnhand: number;
  fromSoldQty: number;
  fromRevenue: number;
  qty: number;
  reason: string;
  priority: TransferPriority;
  priorityRank: number;
  /** POS Image Dir. (webp) — same as Top Vendor Models. */
  imageDir: string;
};

export type InventoryMgmtQuery = {
  dateFrom: string;
  dateTo: string;
  stores?: string[];
  departments?: string[];
  designs?: string[];
  classes?: string[];
  subclasses?: string[];
  vendors?: string[];
  q?: string;
  view: "transfers" | "stock";
  sort: string;
  dir: "asc" | "desc";
  offset: number;
  limit: number;
};

type ModelStoreAgg = {
  soldQty: number;
  revenue: number;
  skuSold: Map<string, { qty: number; revenue: number }>;
};

type ModelSales = {
  imageDir: string;
  stores: Map<string, ModelStoreAgg>;
};

type ModelInv = {
  description: string;
  department: string;
  design: string;
  productClass: string;
  subClass: string;
  vendor: string;
  vendorModel: string;
  tagPrice: number;
  costPrice: number;
  wholesaleCost: number;
  sku: string;
  imageDir: string;
  stores: Map<
    string,
    { onhand: number; skus: Map<string, { onhand: number; tag: number; cost: number; wholesale: number }> }
  >;
};

function key(s: string): string {
  return s.trim().toUpperCase();
}

const MGMT_STORES = listInventoryMgmtStores();
const MGMT_STORE_BY_KEY = new Map(MGMT_STORES.map((s) => [key(s.store), s]));

function blank(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function pickImageDir(raw?: string | null): string {
  return normalizeSalesImageDir(raw);
}

function modelKeyOf(row: { vendorModel?: string; sku?: string; itemNumber?: string }): string {
  return key(row.vendorModel || row.sku || row.itemNumber || "");
}

function inList(value: string, selected?: string[]): boolean {
  if (!selected?.length) return true;
  const k = key(value);
  return selected.some((s) => key(s) === k);
}

/** Model / SKU / description search — all space-separated tokens must appear somewhere. */
export function matchesInventorySearch(q: string | undefined, ...parts: string[]): boolean {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return true;
  const hay = parts.join("\n").toLowerCase();
  const tokens = needle.split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

function matchesQ(q: string | undefined, ...parts: string[]): boolean {
  return matchesInventorySearch(q, ...parts);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function coverageOf(onhand: number, soldQty: number): number | null {
  if (soldQty <= 0) return onhand > 0 ? Infinity : null;
  return onhand / soldQty;
}

function needQty(soldQty: number, onhand: number): number {
  const target = Math.max(1, Math.ceil(soldQty * 0.25));
  return Math.max(0, target - Math.max(0, onhand));
}

function isNeedy(soldQty: number, onhand: number, tier: InventoryTier, kind: InventoryStoreKind): boolean {
  if (kind === "new") return soldQty >= 4 && onhand <= 0;
  if (soldQty <= 0) return false;
  if (onhand <= 0 && soldQty >= 1) return tier === "A" || soldQty >= 3;
  if (tier === "A") return soldQty >= 3 && onhand < Math.max(2, soldQty * 0.2);
  if (tier === "B") return soldQty >= 6 && onhand < Math.max(1, soldQty * 0.15);
  return false;
}

function addFacet(map: Map<string, Set<string>>, field: string, value: string) {
  if (!value) return;
  let set = map.get(field);
  if (!set) {
    set = new Set();
    map.set(field, set);
  }
  set.add(value);
}

function aggregateSales(rows: VendorPosRow[]): Map<string, ModelSales> {
  const out = new Map<string, ModelSales>();
  for (const row of rows) {
    if (!isInventoryMgmtStore(row.storeName)) continue;
    if (isIgnoredInventoryDepartment(row.department)) continue;
    if (isHiddenFromTopVendorModelsRow(row)) continue;
    const model = modelKeyOf(row);
    if (!model) continue;
    const store = key(row.storeName);
    let modelAgg = out.get(model);
    if (!modelAgg) {
      modelAgg = { imageDir: "", stores: new Map() };
      out.set(model, modelAgg);
    }
    if (!modelAgg.imageDir) {
      const dir = pickImageDir(row.imageDir);
      if (dir) modelAgg.imageDir = dir;
    }
    let agg = modelAgg.stores.get(store);
    if (!agg) {
      agg = { soldQty: 0, revenue: 0, skuSold: new Map() };
      modelAgg.stores.set(store, agg);
    }
    const qty = salesUnitsSold(row.quantity);
    const rev = Number(row.netRevenue) || 0;
    agg.soldQty += qty;
    agg.revenue += rev;
    const sku = blank(row.sku || row.itemNumber) || model;
    const skuRow = agg.skuSold.get(sku) ?? { qty: 0, revenue: 0 };
    skuRow.qty += qty;
    skuRow.revenue += rev;
    agg.skuSold.set(sku, skuRow);
  }
  return out;
}

function aggregateOnhand(items: InventoryItem[]): Map<string, ModelInv> {
  const out = new Map<string, ModelInv>();
  for (const item of items) {
    if (!isInventoryOnhandStore(item.store)) continue;
    if (isIgnoredInventoryDepartment(item.department)) continue;
    const model = key(item.vendorModel || item.sku);
    if (!model) continue;
    let inv = out.get(model);
    if (!inv) {
      inv = {
        description: item.description,
        department: item.department,
        design: item.design,
        productClass: item.class,
        subClass: item.subClass,
        vendor: item.vendor,
        vendorModel: item.vendorModel || item.sku,
        tagPrice: item.tagPrice,
        costPrice: item.costPrice,
        wholesaleCost: item.wholesaleCost,
        sku: item.sku,
        imageDir: pickImageDir(item.imageDir),
        stores: new Map(),
      };
      out.set(model, inv);
    }
    if (!inv.description && item.description) inv.description = item.description;
    if (!inv.department && item.department) inv.department = item.department;
    if (!inv.design && item.design) inv.design = item.design;
    if (!inv.productClass && item.class) inv.productClass = item.class;
    if (!inv.subClass && item.subClass) inv.subClass = item.subClass;
    if (!inv.vendor && item.vendor) inv.vendor = item.vendor;
    if (!inv.imageDir) {
      const dir = pickImageDir(item.imageDir);
      if (dir) inv.imageDir = dir;
    }
    if ((item.tagPrice || 0) > (inv.tagPrice || 0)) inv.tagPrice = item.tagPrice;
    if ((item.costPrice || 0) > 0) inv.costPrice = item.costPrice;
    if ((item.wholesaleCost || 0) > 0) inv.wholesaleCost = item.wholesaleCost;
    if (item.sku) inv.sku = item.sku;
    const store = key(item.store);
    let storeRow = inv.stores.get(store);
    if (!storeRow) {
      storeRow = { onhand: 0, skus: new Map() };
      inv.stores.set(store, storeRow);
    }
    const qty = Number(item.onHand) || 0;
    storeRow.onhand += qty;
    const skuKey = item.sku || model;
    const skuRow = storeRow.skus.get(skuKey) ?? { onhand: 0, tag: 0, cost: 0, wholesale: 0 };
    skuRow.onhand += qty;
    skuRow.tag = item.tagPrice || skuRow.tag;
    skuRow.cost = item.costPrice || skuRow.cost;
    skuRow.wholesale = item.wholesaleCost || skuRow.wholesale;
    storeRow.skus.set(skuKey, skuRow);
  }
  return out;
}

function pickDonor(
  needyStore: string,
  needyDm: InventoryDm,
  byStoreSold: Map<string, ModelStoreAgg>,
  onhandStores: Map<string, { onhand: number }>
): { store: string; qty: number; spare: number; soldQty: number } | null {
  const candidates: Array<{
    store: string;
    spare: number;
    soldQty: number;
    onhand: number;
    rank: number;
  }> = [];
  for (const meta of MGMT_STORES) {
    if (isMainStore(meta.store)) continue;
    if (key(meta.store) === key(needyStore)) continue;
    if (meta.tier === "A") continue;
    const onhand = onhandStores.get(key(meta.store))?.onhand ?? 0;
    const soldQty = byStoreSold.get(key(meta.store))?.soldQty ?? 0;
    if (onhand < 2) continue;
    if (isSellingWell(soldQty, onhand)) continue;
    const reserve = keepReserveQty(soldQty, meta.kind);
    const spare = onhand - reserve;
    if (spare < 1) continue;
    candidates.push({
      store: meta.store,
      spare,
      soldQty,
      onhand,
      rank: donorRank(meta, needyDm),
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.rank - b.rank || b.spare - a.spare || a.store.localeCompare(b.store));
  const hit = candidates[0]!;
  return { store: hit.store, qty: hit.spare, spare: hit.spare, soldQty: hit.soldQty };
}

export function buildInventoryTransfers(
  salesRows: VendorPosRow[],
  items: InventoryItem[]
): InventoryTransfer[] {
  const sales = aggregateSales(salesRows);
  const onhand = aggregateOnhand(items);
  const models = new Set([...sales.keys(), ...onhand.keys()]);
  const out: InventoryTransfer[] = [];

  for (const model of models) {
    const inv = onhand.get(model);
    const soldByStore = sales.get(model)?.stores ?? new Map();
    const onhandStores = inv?.stores ?? new Map();
    for (const meta of MGMT_STORES) {
      const storeKey = key(meta.store);
      const sold = soldByStore.get(storeKey);
      const soldQty = sold?.soldQty ?? 0;
      const onh = onhandStores.get(storeKey)?.onhand ?? 0;
      if (!isNeedy(soldQty, onh, meta.tier, meta.kind)) continue;
      const want = needQty(soldQty, onh);
      if (want < 1) continue;
      const donor = pickDonor(meta.store, meta.dm, soldByStore, onhandStores);
      if (!donor) continue;
      const qty = Math.max(1, Math.min(want, Math.floor(donor.qty)));
      const sku =
        [...(onhandStores.get(storeKey)?.skus.keys() ?? [])][0] ||
        [...(sold?.skuSold.keys() ?? [])][0] ||
        inv?.sku ||
        model;
      const fromMeta = MGMT_STORE_BY_KEY.get(key(donor.store));
      const priority = transferPriority({
        onhand: onh,
        soldQty,
        toTier: meta.tier,
        toKind: meta.kind,
      });
      out.push({
        vendorModel: inv?.vendorModel || model,
        sku,
        vendor: inv?.vendor || "",
        description: inv?.description || "",
        department: inv?.department || "",
        design: inv?.design || "",
        productClass: inv?.productClass || "",
        subClass: inv?.subClass || "",
        tagPrice: inv?.tagPrice || 0,
        costPrice: inv?.costPrice || 0,
        wholesaleCost: inv?.wholesaleCost || 0,
        toStore: meta.store,
        toDm: meta.dm,
        toTier: meta.tier,
        toKind: meta.kind,
        soldQty,
        revenue: sold?.revenue ?? 0,
        onhand: onh,
        fromStore: donor.store,
        fromDm: fromMeta?.dm ?? "AJ",
        fromTier: fromMeta?.tier ?? "C",
        fromKind: fromMeta?.kind ?? "core",
        fromOnhand: onhandStores.get(key(donor.store))?.onhand ?? 0,
        fromSoldQty: donor.soldQty,
        fromRevenue: soldByStore.get(key(donor.store))?.revenue ?? 0,
        qty,
        reason:
          `${meta.store} sold ${Math.round(soldQty)} with ${Math.round(onh)} on hand. ` +
          `Take spare from ${donor.store} (${Math.round(donor.spare)} spare, sold ${Math.round(donor.soldQty)}).`,
        priority,
        priorityRank: TRANSFER_PRIORITY_RANK[priority],
        imageDir: inv?.imageDir || sales.get(model)?.imageDir || "",
      });
    }
  }

  out.sort((a, b) => {
    const rank = a.priorityRank - b.priorityRank;
    if (rank) return rank;
    const tier = a.toTier.localeCompare(b.toTier);
    if (tier) return tier;
    return b.soldQty - a.soldQty || a.toStore.localeCompare(b.toStore);
  });
  return out;
}

export function buildInventoryStockRows(
  salesRows: VendorPosRow[],
  items: InventoryItem[]
): InventoryStockRow[] {
  const sales = aggregateSales(salesRows);
  const onhand = aggregateOnhand(items);
  const rows: InventoryStockRow[] = [];
  for (const inv of onhand.values()) {
    const model = key(inv.vendorModel);
    const soldByStore = sales.get(model)?.stores ?? new Map();
    for (const [storeKey, storeRow] of inv.stores) {
      const main = isMainStore(storeKey);
      if (!isInventoryOnhandStore(storeKey)) continue;
      const dm = inventoryDmForStore(storeKey);
      if (!dm && !main) continue;
      const meta = MGMT_STORE_BY_KEY.get(storeKey);
      const sold = main ? undefined : soldByStore.get(storeKey);
      let sku = inv.sku;
      let tag = inv.tagPrice;
      let cost = inv.costPrice;
      let wholesale = inv.wholesaleCost;
      let bestOh = -1;
      for (const [skuKey, skuRow] of storeRow.skus) {
        if (skuRow.onhand > bestOh) {
          bestOh = skuRow.onhand;
          sku = skuKey;
          tag = skuRow.tag || tag;
          cost = skuRow.cost || cost;
          wholesale = skuRow.wholesale || wholesale;
        }
      }
      const oh = storeRow.onhand;
      const soldQty = main ? 0 : (sold?.soldQty ?? 0);
      rows.push({
        store: main ? "MAIN" : (meta?.store ?? storeKey),
        dm: dm ?? "AJ",
        tier: main ? "C" : inventoryTierForStore(storeKey),
        kind: main ? "main" : inventoryKindForStore(storeKey),
        vendorModel: inv.vendorModel,
        sku,
        vendor: inv.vendor,
        description: inv.description,
        department: inv.department,
        design: inv.design,
        productClass: inv.productClass,
        subClass: inv.subClass,
        tagPrice: tag,
        costPrice: cost,
        wholesaleCost: wholesale,
        onhand: oh,
        soldQty,
        revenue: main ? 0 : (sold?.revenue ?? 0),
        coverage: coverageOf(oh, soldQty),
        imageDir: inv.imageDir || sales.get(model)?.imageDir || "",
      });
    }
  }
  return rows;
}

export function buildModelStoreBreakdown(
  salesRows: VendorPosRow[],
  items: InventoryItem[],
  vendorModel: string
): InventoryModelStoreRow[] {
  const model = key(vendorModel);
  if (!model) return [];
  const soldByStore = aggregateSales(salesRows).get(model)?.stores ?? new Map();
  const onhandStores = aggregateOnhand(items).get(model)?.stores ?? new Map();
  const rows: InventoryModelStoreRow[] = [
    {
      store: "MAIN",
      dm: "AJ",
      tier: "C",
      kind: "main",
      onhand: onhandStores.get("MAIN")?.onhand ?? 0,
      soldQty: 0,
    },
  ];
  for (const meta of MGMT_STORES) {
    const storeKey = key(meta.store);
    const onhand = onhandStores.get(storeKey)?.onhand ?? 0;
    const soldQty = soldByStore.get(storeKey)?.soldQty ?? 0;
    if (onhand <= 0 && soldQty <= 0) continue;
    rows.push({
      store: meta.store,
      dm: meta.dm,
      tier: meta.tier,
      kind: meta.kind,
      onhand,
      soldQty,
    });
  }
  const main = rows[0]!;
  const rest = rows.slice(1).sort((a, b) => b.onhand - a.onhand || b.soldQty - a.soldQty || a.store.localeCompare(b.store));
  return [main, ...rest];
}

/** Same store grid as `buildModelStoreBreakdown`, from cached stock rows (no sales rescan). */
export function buildModelStoreBreakdownFromStock(
  stock: InventoryStockRow[],
  vendorModel: string
): InventoryModelStoreRow[] {
  const model = key(vendorModel);
  if (!model) return [];
  const byStore = new Map<string, InventoryStockRow>();
  for (const r of stock) {
    if (key(r.vendorModel) !== model) continue;
    byStore.set(key(r.store), r);
  }
  const rows: InventoryModelStoreRow[] = [
    {
      store: "MAIN",
      dm: "AJ",
      tier: "C",
      kind: "main",
      onhand: byStore.get("MAIN")?.onhand ?? 0,
      soldQty: 0,
    },
  ];
  for (const meta of MGMT_STORES) {
    const hit = byStore.get(key(meta.store));
    const onhand = hit?.onhand ?? 0;
    const soldQty = hit?.soldQty ?? 0;
    if (onhand <= 0 && soldQty <= 0) continue;
    rows.push({
      store: meta.store,
      dm: meta.dm,
      tier: meta.tier,
      kind: meta.kind,
      onhand,
      soldQty,
    });
  }
  const main = rows[0]!;
  const rest = rows
    .slice(1)
    .sort((a, b) => b.onhand - a.onhand || b.soldQty - a.soldQty || a.store.localeCompare(b.store));
  return [main, ...rest];
}

function filterStock(rows: InventoryStockRow[], q: InventoryMgmtQuery): InventoryStockRow[] {
  return rows.filter(
    (r) =>
      inList(r.store, q.stores) &&
      inList(r.department, q.departments) &&
      inList(r.design, q.designs) &&
      inList(r.productClass, q.classes) &&
      inList(r.subClass, q.subclasses) &&
      inList(r.vendor, q.vendors) &&
      matchesQ(
        q.q,
        r.vendorModel,
        r.sku,
        r.vendor,
        r.description,
        r.department,
        r.design,
        r.productClass,
        r.subClass,
        r.store
      )
  );
}

function filterTransfers(rows: InventoryTransfer[], q: InventoryMgmtQuery): InventoryTransfer[] {
  return rows.filter(
    (r) =>
      (inList(r.toStore, q.stores) || inList(r.fromStore, q.stores)) &&
      inList(r.department, q.departments) &&
      inList(r.design, q.designs) &&
      inList(r.productClass, q.classes) &&
      inList(r.subClass, q.subclasses) &&
      inList(r.vendor, q.vendors) &&
      matchesQ(
        q.q,
        r.vendorModel,
        r.sku,
        r.vendor,
        r.description,
        r.department,
        r.design,
        r.productClass,
        r.subClass,
        r.toStore,
        r.fromStore
      )
  );
}

function sortValue(row: Record<string, unknown>, sort: string): string | number {
  const v = row[sort];
  if (typeof v === "number") return Number.isFinite(v) ? v : -1;
  return String(v ?? "");
}

function sortRows<T extends Record<string, unknown>>(rows: T[], sort: string, dir: "asc" | "desc"): T[] {
  const mul = dir === "asc" ? 1 : -1;
  const keyName = sort || "soldQty";
  return [...rows].sort((a, b) => {
    const av = sortValue(a, keyName);
    const bv = sortValue(b, keyName);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  });
}

function availableFromStock(
  stockAll: InventoryStockRow[],
  view: "transfers" | "stock"
) {
  const facets = new Map<string, Set<string>>();
  for (const r of stockAll) {
    addFacet(facets, "stores", r.store);
    addFacet(facets, "departments", r.department);
    addFacet(facets, "designs", r.design);
    addFacet(facets, "classes", r.productClass);
    addFacet(facets, "subclasses", r.subClass);
    addFacet(facets, "vendors", r.vendor);
  }
  const storeNames = uniqueSorted([...(facets.get("stores") ?? [])]);
  return {
    stores:
      view === "transfers"
        ? storeNames.filter((s) => !isMainStore(s))
        : ([storeNames.find((s) => isMainStore(s))].filter(Boolean).concat(
            storeNames.filter((s) => !isMainStore(s))
          ) as string[]),
    departments: uniqueSorted([...(facets.get("departments") ?? [])]),
    designs: uniqueSorted([...(facets.get("designs") ?? [])]),
    classes: uniqueSorted([...(facets.get("classes") ?? [])]),
    subclasses: uniqueSorted([...(facets.get("subclasses") ?? [])]),
    vendors: uniqueSorted([...(facets.get("vendors") ?? [])]),
  };
}

export type InventoryMgmtBase = {
  stock: InventoryStockRow[];
  transfers: InventoryTransfer[];
};

export function buildInventoryMgmtBase(
  salesRows: VendorPosRow[],
  items: InventoryItem[]
): InventoryMgmtBase {
  return {
    stock: buildInventoryStockRows(salesRows, items),
    transfers: buildInventoryTransfers(salesRows, items),
  };
}

export function queryInventoryMgmtFromBase(
  base: InventoryMgmtBase,
  q: InventoryMgmtQuery
): {
  view: "transfers" | "stock";
  rows: InventoryStockRow[] | InventoryTransfer[];
  total: number;
  stores: ReturnType<typeof listInventoryMgmtStores>;
  available: {
    stores: string[];
    departments: string[];
    designs: string[];
    classes: string[];
    subclasses: string[];
    vendors: string[];
  };
} {
  const available = availableFromStock(base.stock, q.view);

  if (q.view === "transfers") {
    const filtered = filterTransfers(base.transfers, q) as unknown as Record<string, unknown>[];
    const sorted = sortRows(filtered, q.sort || "priorityRank", q.dir);
    const offset = Math.max(0, q.offset);
    const limit = Math.min(200, Math.max(1, q.limit));
    return {
      view: "transfers",
      rows: sorted.slice(offset, offset + limit) as unknown as InventoryTransfer[],
      total: sorted.length,
      stores: listInventoryMgmtStores(),
      available,
    };
  }

  const filtered = filterStock(base.stock, q) as unknown as Record<string, unknown>[];
  const sorted = sortRows(filtered, q.sort || "onhand", q.dir);
  const offset = Math.max(0, q.offset);
  const limit = Math.min(200, Math.max(1, q.limit));
  return {
    view: "stock",
    rows: sorted.slice(offset, offset + limit) as unknown as InventoryStockRow[],
    total: sorted.length,
    stores: listInventoryMgmtStores(),
    available,
  };
}

export function queryInventoryMgmt(
  salesRows: VendorPosRow[],
  items: InventoryItem[],
  q: InventoryMgmtQuery
): ReturnType<typeof queryInventoryMgmtFromBase> {
  return queryInventoryMgmtFromBase(buildInventoryMgmtBase(salesRows, items), q);
}
