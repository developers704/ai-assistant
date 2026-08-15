/**
 * Discounting keeps the newest month only, and repeat scans stay fast
 * (memo parse cached instead of re-reading the ~28MB seed).
 * Run: npx tsx scripts/check-discounting-window.ts
 */
import assert from "node:assert/strict";
import { detectHighDiscounts } from "../src/lib/discounting/detect-high-discounts";

const t0 = Date.now();
const first = detectHighDiscounts();
const firstMs = Date.now() - t0;

const month = first.filterDate?.slice(0, 7) ?? "";
assert.ok(month, "must resolve an active date");
assert.ok(
  first.availableDates.every((d) => d.slice(0, 7) === month),
  `availableDates must stay inside ${month}: ${first.availableDates.join(", ")}`
);

const t1 = Date.now();
const second = detectHighDiscounts();
const secondMs = Date.now() - t1;

assert.equal(second.hits.length, first.hits.length, "repeat scan must match");
assert.ok(secondMs <= firstMs, "cached scan must not be slower");

console.log("check-discounting-window: ok", {
  activeMonth: month,
  days: first.availableDates.length,
  latest: first.filterDate,
  hits: first.hits.length,
  firstMs,
  secondMs,
});
