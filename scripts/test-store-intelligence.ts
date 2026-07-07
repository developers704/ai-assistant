import { clearStoreDirectoryCache, getStoresByState, isStoreDirectoryAvailable } from "../src/lib/stores/store-directory";
import { findNearestStore, findStore, getStoreDetails, listStores } from "../src/lib/stores/store-intelligence";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function assertIncludes(text: string, needle: string | RegExp, name: string): void {
  const ok = typeof needle === "string" ? text.includes(needle) : needle.test(text);
  assert(name, ok, `expected "${needle}" in: ${text.slice(0, 120)}...`);
}

function assertNotIncludes(text: string, needle: string, name: string): void {
  assert(name, !text.includes(needle), `should not include "${needle}"`);
}

console.log("════════════════════════════════════════════════════════════");
console.log("  Store Intelligence Tests");
console.log("════════════════════════════════════════════════════════════\n");

clearStoreDirectoryCache();

assert("store directory file exists", isStoreDirectoryAvailable(), "run npm run stores:sync first");

const greatMall = findStore("Great Mall");
assert("Find Great Mall by name", !!greatMall && /great mall/i.test(greatMall.mall));

const milpitasBranch = findStore("Milpitas branch");
assert("Find Great Mall by Milpitas branch", !!milpitasBranch && /great mall/i.test(milpitasBranch.mall));

const valleyFair = findStore("Valley Fair");
assert("Find Valley Fair by alias", !!valleyFair && /valley fair/i.test(valleyFair.mall));

const txStores = getStoresByState("TX");
assert("List Texas stores returns 3 stores", txStores.length === 3, `got ${txStores.length}`);

const caStores = getStoresByState("California");
assert("List California stores returns California stores", caStores.every((s) => s.stateCode === "CA"));

const greatMallDetails = getStoreDetails({ storeName: "Great Mall" });
assert("Get Great Mall phone returns (408) 262-9786", (greatMallDetails.store?.phone ?? "") === "(408) 262-9786");
assertIncludes(greatMallDetails.store?.fullAddress ?? greatMallDetails.store?.address ?? "", "302 Great Mall Dr", "Great Mall address contains street");
assertIncludes(greatMallDetails.store?.fullAddress ?? greatMallDetails.store?.address ?? "", "Milpitas", "Great Mall address contains city");

const nearestWithoutCoords = findNearestStore({ storeName: "Great Mall", limit: 3 });
if (nearestWithoutCoords.needsGeocoding) {
  assertIncludes(nearestWithoutCoords.message, "coordinates are not geocoded yet", "No distance when no coordinates");
  assertNotIncludes(nearestWithoutCoords.message, " miles away", "No hallucinated exact miles");
}

const unknown = findStore("Unknown Mall XYZ");
assert("Unknown store is not found", unknown == null);

const openingSoon = listStores({ status: "Opening Soon" });
assert("Opening soon query includes Baybrook", openingSoon.stores.some((s) => /baybrook/i.test(s.mall)));

console.log("\n────────────────────────────────────────────────────────────");
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log("────────────────────────────────────────────────────────────\n");

if (failed > 0) process.exit(1);
console.log("✓ All store intelligence tests passed.");
