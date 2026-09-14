import { AJ_STORES, SHAUN_STORES } from "@/lib/auth/users";

export type InventoryDm = "AJ" | "Shaun";
export type InventoryTier = "A" | "B" | "C";
export type InventoryStoreKind = "core" | "new" | "yearling";

export type InventoryStoreMeta = {
  store: string;
  dm: InventoryDm;
  tier: InventoryTier;
  kind: InventoryStoreKind;
};

const A_STORES = new Set(["DBC-GM", "VJ-FRE", "VJ-ONT", "VJ-SERRA", "VJ-MOD"]);
const B_STORES = new Set(["DBC-STOCK", "VJ-OAK", "VJ-VAL", "VJ-LIV", "VJ-ARDN", "VJ-BAKER"]);
const NEW_STORES = new Set(["VJ-DEER", "VJ-BAY", "VJ-HEND"]);
const YEARLING_STORES = new Set(["VJ-PALM", "VJ-NORTH", "VJ-INLND"]);
const CLOSED = new Set(["MAIN", "VJ-CON", "VJ-WEB", "CON", "WEB"]);

const AJ_SET = new Set<string>(AJ_STORES);
const SHAUN_SET = new Set<string>(SHAUN_STORES);

export function normalizeInventoryStore(store: string): string {
  return store.trim().toUpperCase();
}

export function isClosedOrWarehouseStore(store: string): boolean {
  const s = normalizeInventoryStore(store);
  return CLOSED.has(s) || s === "MAIN";
}

export function inventoryDmForStore(store: string): InventoryDm | null {
  const s = normalizeInventoryStore(store);
  if (AJ_SET.has(s)) return "AJ";
  if (SHAUN_SET.has(s)) return "Shaun";
  return null;
}

export function inventoryTierForStore(store: string): InventoryTier {
  const s = normalizeInventoryStore(store);
  if (A_STORES.has(s)) return "A";
  if (B_STORES.has(s)) return "B";
  return "C";
}

export function inventoryKindForStore(store: string): InventoryStoreKind {
  const s = normalizeInventoryStore(store);
  if (NEW_STORES.has(s)) return "new";
  if (YEARLING_STORES.has(s)) return "yearling";
  return "core";
}

/** AJ + Shaun only. Drops MAIN, closed, Adeel, Rozina/VIS. */
export function isInventoryMgmtStore(store: string): boolean {
  if (isClosedOrWarehouseStore(store)) return false;
  return inventoryDmForStore(store) != null;
}

export function listInventoryMgmtStores(): InventoryStoreMeta[] {
  const stores = [...AJ_STORES, ...SHAUN_STORES].filter((s) => isInventoryMgmtStore(s));
  return stores
    .map((store) => ({
      store,
      dm: inventoryDmForStore(store)!,
      tier: inventoryTierForStore(store),
      kind: inventoryKindForStore(store),
    }))
    .sort((a, b) => a.store.localeCompare(b.store));
}

export function keepReserveQty(soldQty: number, kind: InventoryStoreKind): number {
  const sold = Math.max(0, soldQty);
  if (kind === "new") return sold + 8;
  if (kind === "yearling") return sold + 3;
  return sold;
}

export function isSellingWell(soldQty: number, onhand: number): boolean {
  return soldQty >= 6 && onhand <= soldQty;
}

export function donorRank(meta: InventoryStoreMeta, needyDm: InventoryDm): number {
  const same = meta.dm === needyDm ? 0 : 20;
  const tier = meta.tier === "B" ? 0 : 5;
  const kind = meta.kind === "core" ? 0 : meta.kind === "yearling" ? 2 : 8;
  return same + tier + kind;
}
