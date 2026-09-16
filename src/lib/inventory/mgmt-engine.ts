import type { InventoryItem } from "@/lib/inventory/types";
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
};

export type InventoryModelStoreRow = {
  store: string;
  dm: InventoryDm;
  tier: InventoryTier;
  kind: InventoryStoreKind;
  onhand: number;
  soldQty: number;
};

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
  stores: Map<
    string,
    { onhand: number; skus: Map<string, { onhand: number; tag: number; cost: number; wholesale: number }> }
  >;
};

function key(s: string): string {
  return s.trim().toUpperCase();
}

function blank(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function modelKeyOf(row: { vendorModel?: string; sku?: string; itemNumber?: string }): string {
  return key(row.vendorModel || row.sku || row.itemNumber || "");
}

function inList(value: string, selected?: string[]): boolean {
  if (!selected?.length) return true;
  const k = key(value);
  return selected.some((s) => key(s) === k);
}

function matchesQ(q: string | undefined, ...parts: string[]): boolean {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return true;
  return parts.some((p) => p.toLowerCase().includes(needle));
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

function aggregateSales(rows: VendorPosRow[]): Map<string, Map<string, ModelStoreAgg>> {
  const out = new Map<string, Map<string, ModelStoreAgg>>();
  for (const row of rows) {
    if (!isInventoryMgmtStore(row.storeName)) continue;
    if (isIgnoredInventoryDepartment(row.department)) continue;
    if (isHiddenFromTopVendorModelsRow(row)) continue;
    const model = modelKeyOf(row);
    if (!model) continue;
    const store = key(row.storeName);
    let byStore = out.get(model);
    if (!byStore) {
      byStore = new Map();
      out.set(model, byStore);
    }
    let agg = byStore.get(store);
    if (!agg) {
      agg = { soldQty: 0, revenue: 0, skuSold: new Map() };
      byStore.set(store, agg);
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
    sellingWell: boolean;
  }> = [];
  for (const meta of listInventoryMgmtStores()) {
    if (isMainStore(meta.store)) continue;
    if (key(meta.store) === key(needyStore)) continue;
    if (meta.tier === "A") continue;
    const onhand = onhandStores.get(key(meta.store))?.onhand ?? 0;
    const soldQty = byStoreSold.get(key(meta.store))?.soldQty ?? 0;
    const reserve = keepReserveQty(soldQty, meta.kind);
    const spare = onhand - reserve;
    if (spare < 1) continue;
    candidates.push({
      store: meta.store,
      spare,
      soldQty,
      onhand,
      rank: donorRank(meta, needyDm),
      sellingWell: isSellingWell(soldQty, onhand),
    });
  }
  const pool = candidates.filter((c) => !c.sellingWell);
  if (!pool.length) return null;
  pool.sort((a, b) => a.rank - b.rank || b.spare - a.spare || a.store.localeCompare(b.store));
  const hit = pool[0]!;
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
    const soldByStore = sales.get(model) ?? new Map();
    const onhandStores = inv?.stores ?? new Map();
    for (const meta of listInventoryMgmtStores()) {
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
      const fromMeta = listInventoryMgmtStores().find((s) => key(s.store) === key(donor.store));
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
      });
    }
  }

  out.sort((a, b) => {
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
  const rows: InventoryStockRow[] = [];
  for (const item of items) {
    if (!isInventoryOnhandStore(item.store)) continue;
    if (isIgnoredInventoryDepartment(item.department)) continue;
    const main = isMainStore(item.store);
    const dm = inventoryDmForStore(item.store);
    if (!dm && !main) continue;
    const model = key(item.vendorModel || item.sku);
    const storeKey = key(item.store);
    const sold = main ? undefined : sales.get(model)?.get(storeKey);
    const skuSold = sold?.skuSold?.get(item.sku);
    const soldQty = main ? 0 : (skuSold?.qty ?? 0);
    const revenue = main ? 0 : (skuSold?.revenue ?? 0);
    const onhand = Number(item.onHand) || 0;
    rows.push({
      store: main ? "MAIN" : item.store,
      dm: dm ?? "AJ",
      tier: main ? "C" : inventoryTierForStore(item.store),
      kind: main ? "main" : inventoryKindForStore(item.store),
      vendorModel: item.vendorModel || item.sku,
      sku: item.sku,
      vendor: item.vendor,
      description: item.description,
      department: item.department,
      design: item.design,
      productClass: item.class,
      subClass: item.subClass,
      tagPrice: item.tagPrice,
      costPrice: item.costPrice,
      wholesaleCost: item.wholesaleCost,
      onhand,
      soldQty,
      revenue,
      coverage: coverageOf(onhand, soldQty),
    });
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
  const soldByStore = aggregateSales(salesRows).get(model) ?? new Map();
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
  for (const meta of listInventoryMgmtStores()) {
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

function filterStock(rows: InventoryStockRow[], q: InventoryMgmtQuery): InventoryStockRow[] {
  return rows.filter(
    (r) =>
      inList(r.store, q.stores) &&
      inList(r.department, q.departments) &&
      inList(r.design, q.designs) &&
      inList(r.productClass, q.classes) &&
      inList(r.subClass, q.subclasses) &&
      inList(r.vendor, q.vendors) &&
      matchesQ(q.q, r.vendorModel, r.sku, r.vendor, r.description, r.department, r.store)
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
      matchesQ(q.q, r.vendorModel, r.sku, r.vendor, r.description, r.department, r.toStore, r.fromStore)
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

export function queryInventoryMgmt(
  salesRows: VendorPosRow[],
  items: InventoryItem[],
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
  const facets = new Map<string, Set<string>>();
  const stockAll = buildInventoryStockRows(salesRows, items);
  for (const r of stockAll) {
    addFacet(facets, "stores", r.store);
    addFacet(facets, "departments", r.department);
    addFacet(facets, "designs", r.design);
    addFacet(facets, "classes", r.productClass);
    addFacet(facets, "subclasses", r.subClass);
    addFacet(facets, "vendors", r.vendor);
  }
  const storeNames = uniqueSorted([...(facets.get("stores") ?? [])]);
  const available = {
    stores:
      q.view === "transfers"
        ? storeNames.filter((s) => !isMainStore(s))
        : [storeNames.find((s) => isMainStore(s))].filter(Boolean).concat(storeNames.filter((s) => !isMainStore(s))) as string[],
    departments: uniqueSorted([...(facets.get("departments") ?? [])]),
    designs: uniqueSorted([...(facets.get("designs") ?? [])]),
    classes: uniqueSorted([...(facets.get("classes") ?? [])]),
    subclasses: uniqueSorted([...(facets.get("subclasses") ?? [])]),
    vendors: uniqueSorted([...(facets.get("vendors") ?? [])]),
  };

  if (q.view === "transfers") {
    const filtered = filterTransfers(buildInventoryTransfers(salesRows, items), q) as unknown as Record<
      string,
      unknown
    >[];
    const sorted = sortRows(filtered, q.sort || "fromSoldQty", q.dir);
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

  const filtered = filterStock(stockAll, q) as unknown as Record<string, unknown>[];
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
