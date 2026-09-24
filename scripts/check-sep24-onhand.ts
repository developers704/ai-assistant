/**
 * Sep 24 2026 onhand snapshot vs the POS export totals.
 * Run: npx tsx scripts/check-sep24-onhand.ts
 *
 * Excel footer On-hand is 196,752.08 across 122,499 item rows (39 stores).
 */
import { listInventoryItems, lookupInventory } from "../src/lib/inventory/store";
import { hasOnhandData, listOnhandByStoreForVendorModel } from "../src/lib/inventory/onhand";
import { getInventoryMgmtDataset } from "../src/lib/inventory/mgmt-cache";
import {
  isIgnoredInventoryDepartment,
  isInventoryOnhandStore,
  isMainStore,
  isSellingWell,
  keepReserveQty,
} from "../src/lib/inventory/mgmt-stores";
import { transferPriority } from "../src/lib/inventory/mgmt-engine";

const EXPECTED_ONHAND = 196752.08;
const EXPECTED_ROWS = 122499;
const EXPECTED_STORES: Record<string, number> = {
  MAIN: 68300.08,
  "VJ-FRE": 5166,
  "VJ-LIV": 5070,
  "VJ-ONT": 4952,
  "VJ-VIS": 4917,
  "VJ-VICTOR": 4777,
  "DBC-STOCK": 4754,
  "DBC-GM": 4660,
  "VJ-PB": 4517,
  "DE-SOUTH": 4502,
  "VJ-OAK": 4363,
  "VJ-HEND": 4215,
  "VJ-SOLANO": 4210,
  "VJ-BAKER": 4199,
  "VJ-INLND": 4032,
  "VJ-S.ROSA": 3955,
  "VJ-SERRA": 3828,
  "VJ-EAST": 3816,
  "VJ-ARDN": 3809,
  "VJ-SAL": 3752,
  "VJ-MOD": 3742,
  "VJ-CHAND": 3713,
  "VJ-CULVER": 3707,
  "VJ-VAL": 3576,
  "VJ-LONG": 3575,
  "VJ-PALM": 3561,
  "VJ-DEER": 3553,
  "VJ-RENO": 3510,
  "VJ-ROSE": 3434,
  "VJ-S.ANITA": 3296,
  "VJ-BAY": 3232,
  "VJ-NORTH": 2935,
  "REPAIR & RA": 1967,
  "VJ-CON": 525,
  "VJ-NEW": 337,
  "DG-GM": 244,
  "VJ-TRACY": 34,
  "VJ-WEB": 14,
  "DG-TAN": 3,
};

let failed = 0;
function assert(name: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function close(a: number, b: number) {
  return Math.abs(a - b) < 0.02;
}

console.log("=== Sep 24 onhand vs Excel ===");
assert("onhand index loaded", hasOnhandData());
const items = listInventoryItems();
assert("row count", items.length === EXPECTED_ROWS, `rows=${items.length}`);

const byStore = new Map<string, number>();
let total = 0;
for (const item of items) {
  const q = Number(item.onHand) || 0;
  total += q;
  const store = item.store.trim().toUpperCase();
  byStore.set(store, (byStore.get(store) ?? 0) + q);
}
assert("excel on-hand total", close(total, EXPECTED_ONHAND), `got=${total}`);
assert("store count", byStore.size === Object.keys(EXPECTED_STORES).length, `stores=${byStore.size}`);
for (const [store, expected] of Object.entries(EXPECTED_STORES)) {
  const got = byStore.get(store) ?? 0;
  assert(`${store} on-hand ${expected}`, close(got, expected), `got=${got}`);
}

const gia = lookupInventory("130948", "MAIN");
assert("130948 MAIN qty 1", gia?.item.onHand === 1, `onhand=${gia?.item.onHand}`);
assert("130948 tag 26995", gia?.item.tagPrice === 26995, `tag=${gia?.item.tagPrice}`);
assert("130948 cost 2666", gia?.item.costPrice === 2666, `cost=${gia?.item.costPrice}`);
assert(
  "130948 description kept quotes",
  (gia?.item.description ?? "").includes("GIA-CERTIFIED"),
  gia?.item.description
);

const fixed = items.find((i) => i.sku.toUpperCase().startsWith("231611"));
assert("fixed SKU 231611 whole cost 350", fixed?.wholesaleCost === 350, `wholesale=${fixed?.wholesaleCost} sku=${fixed?.sku}`);

const model = listOnhandByStoreForVendorModel("SRBC0.75");
const modelMain = model?.stores.find((s) => s.store.toUpperCase() === "MAIN");
assert("top model SRBC0.75 MAIN qty", (modelMain?.onhand ?? 0) > 0, `onhand=${modelMain?.onhand}`);

const visible = items.filter(
  (item) => isInventoryOnhandStore(item.store) && !isIgnoredInventoryDepartment(item.department)
);
console.log(
  `  visible inventory rows ${visible.length} on-hand ${visible.reduce((s, i) => s + (Number(i.onHand) || 0), 0).toFixed(2)}`
);

console.log("=== Transfers ===");
const ds = getInventoryMgmtDataset("2025-01-01", "2026-09-23");
const transfers = ds.base.transfers;
const stock = ds.base.stock;
console.log(`  transfers ${transfers.length} stock rows ${stock.length}`);

const stockOnhand = stock.reduce((s, r) => s + (Number(r.onhand) || 0), 0);
const visibleOnhand = visible.reduce((s, i) => s + (Number(i.onHand) || 0), 0);
assert("all on-hand qty matches snapshot", close(stockOnhand, visibleOnhand), `stock=${stockOnhand} items=${visibleOnhand}`);

const aStores = new Set(["DBC-GM", "VJ-FRE", "VJ-ONT", "VJ-SERRA", "VJ-MOD"]);
let mainDonors = 0;
let aDonors = 0;
let thinDonors = 0;
let healthyDonors = 0;
let overAllocated = 0;
const taken = new Map<string, number>();
for (const t of transfers) {
  if (isMainStore(t.fromStore)) mainDonors++;
  if (aStores.has(t.fromStore.toUpperCase())) aDonors++;
  if (t.fromOnhand < 2) thinDonors++;
  if (isSellingWell(t.fromSoldQty, t.fromOnhand)) healthyDonors++;
  const expectedPriority = transferPriority({
    onhand: t.onhand,
    soldQty: t.soldQty,
    toTier: t.toTier,
    toKind: t.toKind,
  });
  if (t.priority !== expectedPriority) {
    failed++;
    console.error(`  ✗ priority ${t.vendorModel} ${t.toStore} got ${t.priority} expected ${expectedPriority}`);
  }
  const reserve = keepReserveQty(t.fromSoldQty, t.fromKind);
  const cap = t.fromOnhand - reserve;
  const k = `${t.vendorModel.toUpperCase()}|${t.fromStore.toUpperCase()}`;
  const next = (taken.get(k) ?? 0) + t.qty;
  taken.set(k, next);
  if (next - cap > 0.001) overAllocated++;
}
assert("no MAIN donor", mainDonors === 0, `count=${mainDonors}`);
assert("no A-store donor", aDonors === 0, `count=${aDonors}`);
assert("donor onhand at least 2", thinDonors === 0, `count=${thinDonors}`);
assert("no healthy-store donor", healthyDonors === 0, `count=${healthyDonors}`);
assert("spare promised once", overAllocated === 0, `count=${overAllocated}`);

const rush = transfers.filter((t) => t.priority === "rush").length;
const high = transfers.filter((t) => t.priority === "high").length;
const fill = transfers.filter((t) => t.priority === "fill").length;
console.log(`  priority rush ${rush} high ${high} fill ${fill}`);
assert("has rush transfers", rush > 0);
assert("sorted rush before fill", transfers.length === 0 || transfers[0]!.priority === "rush" || rush === 0);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nSep 24 onhand checks passed");
