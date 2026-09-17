import { getInventorySourceStamp, listInventoryItems } from "@/lib/inventory/store";
import {
  buildInventoryMgmtBase,
  type InventoryMgmtBase,
} from "@/lib/inventory/mgmt-engine";
import {
  isIgnoredInventoryDepartment,
  isInventoryOnhandStore,
  listInventoryMgmtStores,
} from "@/lib/inventory/mgmt-stores";
import { loadRankRows } from "@/lib/reports/load-rank-rows";
import { getLatestReportMeta } from "@/lib/reports/store";
import { filterRows } from "@/lib/sales/sales-aggregate";
import { readActivePointer, readVersionMetadata } from "@/lib/sales/data/version-store";

/** Keep a couple of date-range datasets; drop older keys when sales or onhand changes. */
const MAX_ENTRIES = 2;

export type InventoryMgmtDataset = {
  key: string;
  base: InventoryMgmtBase;
  availableDates: string[];
};

const cache = new Map<string, InventoryMgmtDataset>();

function salesStamp(): string {
  const v = readActivePointer().activeVersion;
  if (v) return v;
  const meta = getLatestReportMeta();
  return meta ? `${meta.id}:${meta.contentHash ?? meta.uploadedAt}` : "none";
}

function livePrefix(): string {
  return `${salesStamp()}|${getInventorySourceStamp()}|`;
}

function pruneStale() {
  const prefix = livePrefix();
  for (const k of cache.keys()) {
    if (!k.startsWith(prefix)) cache.delete(k);
  }
}

export function invalidateInventoryMgmtCache() {
  cache.clear();
}

function remember(ds: InventoryMgmtDataset): InventoryMgmtDataset {
  cache.delete(ds.key);
  cache.set(ds.key, ds);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
  return ds;
}

/**
 * Built transfers + all-on-hand for one sold-date window.
 * Live onhand is a single snapshot (append replaces, does not stack history).
 * Filter / view / page reuse this instead of rescanning ~140k sales + ~123k items.
 */
export function getInventoryMgmtDataset(dateFrom: string, dateTo: string): InventoryMgmtDataset {
  pruneStale();
  const key = `${livePrefix()}${dateFrom}|${dateTo}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const allMgmtStores = listInventoryMgmtStores().map((s) => s.store);
  const items = listInventoryItems().filter(
    (item) => isInventoryOnhandStore(item.store) && !isIgnoredInventoryDepartment(item.department)
  );
  const sales = filterRows(loadRankRows() ?? [], {
    dateFrom,
    dateTo,
    stores: allMgmtStores,
  });

  const pointer = readActivePointer();
  const versionMeta = pointer.activeVersion ? readVersionMetadata(pointer.activeVersion) : null;
  const reportMeta = getLatestReportMeta();
  const availableDates =
    versionMeta?.availableDates?.length
      ? versionMeta.availableDates
      : reportMeta?.dateRange
        ? [reportMeta.dateRange.from, reportMeta.dateRange.to].filter(Boolean)
        : [];

  return remember({
    key,
    base: buildInventoryMgmtBase(sales, items),
    availableDates,
  });
}
