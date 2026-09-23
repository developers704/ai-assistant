import type { VendorPosRow } from "@/lib/reports/types";
import { resolveProductImageUrl } from "@/lib/reports/product-image";
import { isHiddenFromTopVendorModelsRow, salesUnitsSold } from "@/lib/utils";
import {
  collapseTopModelSaleRows,
  isPhantomZeroNetModel,
  vendorModelGroupKey,
} from "@/lib/sales/top-models-wholesale-margin";
import { loadPaycodeLegs, paycodeTotalsForPaymentWindow, type PaycodeLeg } from "@/lib/sales/paycode-overlay";
import { parseSalespersonSplits } from "@/lib/sales/salesperson-credit";
import {
  loadSalespersonDirectory,
  resolveSalespersonLabelWithCode,
  type SalespersonDirectoryEntry,
} from "@/lib/sales/salesperson-directory";
import { ensureActiveSalesVersion } from "@/lib/sales/refresh/service";
import { readActivePointer, readNormalizedRows } from "@/lib/sales/data/version-store";
import {
  briefHotStoreDay,
  briefSameDatesLastYear,
  isJewelryModel,
  isUnknownBriefName,
  shiftIsoDays,
  type BriefDay,
  type BriefExpertise,
  type BriefModel,
  type BriefPacket,
  type BriefPay,
  type BriefRank,
  type BriefSlice,
} from "@/lib/brief/edition";

const ISSUE_FROM = "2026-09-01";
const ISSUE_TO = "2026-09-21";

type RankAcc = { name: string; revenue: number; units: number };
type DayAcc = { net: number; units: number; returns: number };
type StoreDay = { store: string; date: string; net: number };
type ModelAcc = {
  rows: VendorPosRow[];
  stores: Map<string, number>;
  imageDir: string;
  clean: boolean;
};

type YearAcc = {
  net: number;
  units: number;
  dept: Map<string, RankAcc>;
  design: Map<string, RankAcc>;
  store: Map<string, RankAcc>;
  vendor: Map<string, RankAcc>;
  person: Map<string, RankAcc>;
  day: Map<string, DayAcc>;
  storeDay: Map<string, StoreDay>;
  watch: Map<string, RankAcc>;
  txnByDept: Map<string, Set<string>>;
  deptDesign: Map<string, Map<string, RankAcc>>;
  deptStore: Map<string, Map<string, RankAcc>>;
  deptVendor: Map<string, Map<string, RankAcc>>;
  deptPerson: Map<string, Map<string, RankAcc>>;
  deptDay: Map<string, Map<string, DayAcc>>;
  deptStoreDay: Map<string, Map<string, StoreDay>>;
  models: Map<string, ModelAcc>;
  expertise: Map<string, BriefExpertise>;
};

function emptyYear(): YearAcc {
  return {
    net: 0,
    units: 0,
    dept: new Map(),
    design: new Map(),
    store: new Map(),
    vendor: new Map(),
    person: new Map(),
    day: new Map(),
    storeDay: new Map(),
    watch: new Map(),
    txnByDept: new Map(),
    deptDesign: new Map(),
    deptStore: new Map(),
    deptVendor: new Map(),
    deptPerson: new Map(),
    deptDay: new Map(),
    deptStoreDay: new Map(),
    models: new Map(),
    expertise: new Map(),
  };
}

function addRank(map: Map<string, RankAcc>, name: string, revenue: number, units: number) {
  const trimmed = name.trim();
  if (!trimmed || isUnknownBriefName(trimmed)) return;
  const key = trimmed.toUpperCase();
  const cur = map.get(key);
  if (cur) {
    cur.revenue += revenue;
    cur.units += units;
  } else {
    map.set(key, { name: trimmed, revenue, units });
  }
}

function nested(parent: Map<string, Map<string, RankAcc>>, bucket: string): Map<string, RankAcc> {
  let map = parent.get(bucket);
  if (!map) {
    map = new Map();
    parent.set(bucket, map);
  }
  return map;
}

function addDay(map: Map<string, DayAcc>, date: string, net: number, units: number, returns: number) {
  const cur = map.get(date);
  if (cur) {
    cur.net += net;
    cur.units += units;
    cur.returns += returns;
  } else {
    map.set(date, { net, units, returns });
  }
}

function addStoreDay(map: Map<string, StoreDay>, store: string, date: string, net: number) {
  const key = `${store.toUpperCase()}\0${date}`;
  const cur = map.get(key);
  if (cur) cur.net += net;
  else map.set(key, { store, date, net });
}

function ranksFrom(map: Map<string, RankAcc>): BriefRank[] {
  const out: BriefRank[] = [];
  for (const row of map.values()) {
    if (row.revenue === 0 && row.units === 0) continue;
    out.push({ name: row.name, revenue: row.revenue, units: row.units });
  }
  out.sort((a, b) => b.revenue - a.revenue || (b.units ?? 0) - (a.units ?? 0));
  return out;
}

function fillDays(from: string, to: string, map: Map<string, DayAcc>): BriefDay[] {
  const out: BriefDay[] = [];
  let date = from;
  while (date <= to) {
    const cur = map.get(date);
    out.push({
      date,
      net: cur?.net ?? 0,
      units: cur?.units ?? 0,
      returns: cur?.returns ?? 0,
    });
    date = shiftIsoDays(date, 1);
  }
  return out;
}

function pays(from: string, to: string, legs: PaycodeLeg[], txns?: Set<string>): BriefPay[] {
  if (txns && txns.size === 0) return [];
  return paycodeTotalsForPaymentWindow({
    from,
    to,
    legs,
    txnIds: txns,
  }).map((row) => ({ name: row.name, revenue: row.revenue }));
}

function emptySlice(): BriefSlice {
  return {
    net: 0,
    units: 0,
    departments: [],
    designs: [],
    stores: [],
    vendors: [],
    people: [],
    pay: [],
    daily: [],
    hotDay: null,
  };
}

function isWatchRow(row: VendorPosRow): boolean {
  const dept = row.department.trim().toUpperCase();
  const design = row.design.trim().toUpperCase();
  return dept === "ROLEX" || dept.includes("WATCH") || design === "WATCH" || design.includes("WATCH");
}

function toSlice(
  acc: YearAcc,
  from: string,
  to: string,
  legs: PaycodeLeg[],
  department?: string
): BriefSlice {
  const deptKey = department?.trim().toUpperCase() || "";
  const dept = deptKey ? acc.dept.get(deptKey) : undefined;
  const days = deptKey ? acc.deptDay.get(deptKey) ?? new Map() : acc.day;
  const storeDays = deptKey ? acc.deptStoreDay.get(deptKey) : acc.storeDay;
  const oneDept = dept ? [{ name: dept.name, revenue: dept.revenue, units: dept.units }] : [];
  return {
    net: deptKey ? dept?.revenue ?? 0 : acc.net,
    units: deptKey ? dept?.units ?? 0 : acc.units,
    departments: deptKey ? oneDept : ranksFrom(acc.dept),
    designs: ranksFrom(deptKey ? acc.deptDesign.get(deptKey) ?? new Map() : acc.design),
    stores: ranksFrom(deptKey ? acc.deptStore.get(deptKey) ?? new Map() : acc.store),
    vendors: ranksFrom(deptKey ? acc.deptVendor.get(deptKey) ?? new Map() : acc.vendor),
    people: ranksFrom(deptKey ? acc.deptPerson.get(deptKey) ?? new Map() : acc.person),
    pay: pays(from, to, legs, deptKey ? acc.txnByDept.get(deptKey) ?? new Set() : undefined),
    daily: fillDays(from, to, days),
    hotDay: briefHotStoreDay([...(storeDays?.values() ?? [])]),
  };
}

function emitModels(acc: YearAcc, showKash: boolean): BriefModel[] {
  const models: Array<BriefModel & { imageDir: string }> = [];
  for (const [key, group] of acc.models) {
    const metric = group.clean ? group.rows : collapseTopModelSaleRows(group.rows);
    let revenue = 0;
    let units = 0;
    let kash = 0;
    const deptRev = new Map<string, number>();
    for (const row of metric) {
      revenue += row.netRevenue;
      units += salesUnitsSold(row.quantity);
      if (!(kash > 0)) {
        const unit = Math.abs(Number(row.inventoryCost) || 0);
        if (unit > 0) kash = unit;
      }
      const dept = row.department?.trim();
      if (dept && !isUnknownBriefName(dept)) {
        const canon = acc.dept.get(dept.toUpperCase())?.name ?? dept;
        deptRev.set(canon, (deptRev.get(canon) ?? 0) + row.netRevenue);
      }
    }
    let department = "";
    let bestDept = -Infinity;
    for (const [name, rev] of deptRev) {
      if (rev > bestDept) {
        bestDept = rev;
        department = name;
      }
    }
    if (isPhantomZeroNetModel(units, revenue)) continue;
    if (revenue === 0 && units === 0) continue;
    let leadStore: string | null = null;
    let leadRev = 0;
    let storeCount = 0;
    for (const [store, rev] of group.stores) {
      if (!(rev > 0) || isUnknownBriefName(store)) continue;
      storeCount += 1;
      if (rev > leadRev) {
        leadRev = rev;
        leadStore = store;
      }
    }
    const vendorModel = (group.rows[0]?.vendorModel || key).trim() || key;
    const model: BriefModel & { imageDir: string } = {
      vendorModel,
      name: vendorModel,
      revenue,
      units,
      department,
      kashCost: showKash && kash > 0 ? kash : null,
      storeCount,
      leadStore,
      imageUrl: null,
      imageDir: group.imageDir,
    };
    if (!isJewelryModel(model)) continue;
    models.push(model);
  }
  models.sort((a, b) => b.revenue - a.revenue || b.units - a.units);
  for (const model of models.slice(0, 12)) {
    model.imageUrl = resolveProductImageUrl(model.imageDir);
  }
  return models.map(({ imageDir: _imageDir, ...model }) => model);
}

function absorb(
  acc: YearAcc,
  row: VendorPosRow,
  personName: (code: string) => string
) {
  const units = salesUnitsSold(row.quantity);
  const net = row.netRevenue;
  const returns = net < 0 ? -net : 0;
  acc.net += net;
  acc.units += units;
  const date = row.date.slice(0, 10);
  addDay(acc.day, date, net, units, returns);

  const deptRaw = row.department.trim();
  const deptKnown = Boolean(deptRaw) && !isUnknownBriefName(deptRaw);
  const deptKey = deptKnown ? deptRaw.toUpperCase() : "";
  if (deptKnown) addRank(acc.dept, deptRaw, net, units);
  const designRaw = row.design.trim();
  if (designRaw && !isUnknownBriefName(designRaw)) {
    addRank(acc.design, designRaw, net, units);
    if (deptKey) addRank(nested(acc.deptDesign, deptKey), designRaw, net, units);
  }
  const storeRaw = row.storeName.trim();
  if (storeRaw && !isUnknownBriefName(storeRaw)) {
    addRank(acc.store, storeRaw, net, units);
    addStoreDay(acc.storeDay, storeRaw, date, net);
    if (deptKey) {
      addRank(nested(acc.deptStore, deptKey), storeRaw, net, units);
      const days = acc.deptStoreDay.get(deptKey) ?? new Map<string, StoreDay>();
      if (!acc.deptStoreDay.has(deptKey)) acc.deptStoreDay.set(deptKey, days);
      addStoreDay(days, storeRaw, date, net);
    }
  }
  const vendorRaw = row.vendor.trim();
  if (vendorRaw && !isUnknownBriefName(vendorRaw)) {
    addRank(acc.vendor, vendorRaw, net, units);
    if (deptKey) addRank(nested(acc.deptVendor, deptKey), vendorRaw, net, units);
  }
  if (isWatchRow(row) && storeRaw && !isUnknownBriefName(storeRaw)) {
    addRank(acc.watch, storeRaw, net, units);
  }
  if (deptKey) {
    const days = acc.deptDay.get(deptKey) ?? new Map<string, DayAcc>();
    if (!acc.deptDay.has(deptKey)) acc.deptDay.set(deptKey, days);
    addDay(days, date, net, units, returns);
    const txn = row.transactionId.trim().toUpperCase();
    if (txn) {
      const set = acc.txnByDept.get(deptKey) ?? new Set<string>();
      set.add(txn);
      if (!acc.txnByDept.has(deptKey)) acc.txnByDept.set(deptKey, set);
    }
  }

  if (!isHiddenFromTopVendorModelsRow(row)) {
    const modelKey = vendorModelGroupKey(row);
    let model = acc.models.get(modelKey);
    if (!model) {
      model = { rows: [], stores: new Map(), imageDir: "", clean: true };
      acc.models.set(modelKey, model);
    }
    model.rows.push(row);
    if (!model.imageDir && row.imageDir) model.imageDir = row.imageDir;
    if (model.clean && (row.quantity < 0 || row.netRevenue < 0 || row.grossSales < 0)) model.clean = false;
    if (storeRaw && net > 0) {
      model.stores.set(storeRaw, (model.stores.get(storeRaw) ?? 0) + net);
    }
  }

  const splits = parseSalespersonSplits(row.salespersons);
  for (const split of splits) {
    const share = split.percent / 100;
    if (!(share > 0)) continue;
    const name = personName(split.code);
    const credited = net * share;
    const creditedUnits = units * share;
    addRank(acc.person, name, credited, creditedUnits);
    if (deptKey) addRank(nested(acc.deptPerson, deptKey), name, credited, creditedUnits);
    if (deptKey && designRaw && !isUnknownBriefName(designRaw)) {
      const person = name;
      const expKey = `${deptKey}\0${designRaw.toUpperCase()}\0${person}`;
      const prev = acc.expertise.get(expKey);
      const department = acc.dept.get(deptKey)?.name ?? deptRaw;
      if (prev) {
        prev.revenue += credited;
        prev.units += creditedUnits;
      } else {
        acc.expertise.set(expKey, {
          department,
          design: designRaw,
          person,
          revenue: credited,
          units: creditedUnits,
        });
      }
    }
  }
}

export function aggregateBriefRows(args: {
  rows: VendorPosRow[];
  legs?: PaycodeLeg[];
  from?: string;
  to?: string;
  showKash?: boolean;
  directory?: Map<string, SalespersonDirectoryEntry>;
}): BriefPacket {
  const from = args.from ?? ISSUE_FROM;
  const to = args.to ?? ISSUE_TO;
  const lyWindow = briefSameDatesLastYear(from, to) ?? { from, to };
  const showKash = args.showKash !== false;
  const legs = args.legs ?? [];
  const directory = args.directory ?? loadSalespersonDirectory();
  const labels = new Map<string, string>();
  const personName = (code: string) => {
    const key = code.trim().toUpperCase();
    const hit = labels.get(key);
    if (hit) return hit;
    const name = resolveSalespersonLabelWithCode(key, directory);
    labels.set(key, name);
    return name;
  };

  const now = emptyYear();
  const ly = emptyYear();
  for (const row of args.rows) {
    const date = row.date?.slice(0, 10);
    if (!date) continue;
    if (date >= from && date <= to) absorb(now, row, personName);
    else if (date >= lyWindow.from && date <= lyWindow.to) absorb(ly, row, personName);
  }

  const byDepartment: BriefPacket["byDepartment"] = {};
  for (const dept of now.dept.values()) {
    if (dept.revenue === 0) continue;
    byDepartment[dept.name] = {
      now: toSlice(now, from, to, legs, dept.name),
      ly: toSlice(ly, lyWindow.from, lyWindow.to, legs, dept.name),
    };
  }

  return {
    from,
    to,
    lyFrom: lyWindow.from,
    lyTo: lyWindow.to,
    showKash,
    now: rowsWindowSlice(now, from, to, legs),
    ly: rowsWindowSlice(ly, lyWindow.from, lyWindow.to, legs),
    models: emitModels(now, showKash),
    lyModels: emitModels(ly, showKash),
    watches: ranksFrom(now.watch),
    lyWatches: ranksFrom(ly.watch),
    expertise: [...now.expertise.values()].filter((row) => row.revenue > 0),
    byDepartment,
  };
}

function rowsWindowSlice(acc: YearAcc, from: string, to: string, legs: PaycodeLeg[]): BriefSlice {
  if (acc.net === 0 && acc.dept.size === 0) {
    const slice = emptySlice();
    slice.daily = fillDays(from, to, acc.day);
    slice.pay = pays(from, to, legs);
    return slice;
  }
  return toSlice(acc, from, to, legs);
}

let packetCache: { key: string; packet: BriefPacket } | null = null;

/** One pass over both Septembers. Department taps read `byDepartment` and do not query again. */
export async function buildBriefPacket(opts?: {
  from?: string;
  to?: string;
  showKash?: boolean;
}): Promise<BriefPacket> {
  const from = opts?.from ?? ISSUE_FROM;
  const to = opts?.to ?? ISSUE_TO;
  const showKash = opts?.showKash !== false;
  await ensureActiveSalesVersion();
  const version = readActivePointer().activeVersion ?? "";
  const rows = readNormalizedRows(version || undefined) ?? [];
  const legs = loadPaycodeLegs();
  const key = `${version}|${from}|${to}|${showKash ? 1 : 0}|${rows.length}|${legs.length}`;
  if (packetCache?.key === key) return packetCache.packet;
  const started = Date.now();
  const packet = aggregateBriefRows({ rows, legs, from, to, showKash });
  packetCache = { key, packet };
  console.info(
    `[brief] ${Date.now() - started}ms · ${rows.length} rows · ${packet.models.length} models · ${Object.keys(packet.byDepartment).length} departments`
  );
  return packet;
}
