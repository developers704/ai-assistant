/**
 * Sultan Ansari (SA4) Aug 2026: Datejust VS-10292155 amended to SA4/100%.
 * Run: npx tsx scripts/check-sultan-datejust-amend.ts
 */
import assert from "node:assert/strict";
import { querySales } from "../src/lib/sales/query-sales";
import { salespersonShare } from "../src/lib/sales/salesperson-credit";
import { filterRows } from "../src/lib/sales/sales-aggregate";
import { readActivePointer, readNormalizedRows } from "../src/lib/sales/data/version-store";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";

const EXPECT_NET = 148219.41;
const EXPECT_WATCH = 46401.63;

async function main() {
  const rows = loadRankRows() ?? [];
  const ticket = rows.filter(
    (r) =>
      r.transactionId === "VS-10292155" &&
      (r.sku === "239885" || r.itemNumber === "239885")
  );
  assert.ok(ticket.length >= 1, "Datejust VS-10292155 / 239885 must exist");
  for (const r of ticket) {
    assert.equal(
      salespersonShare(r, "SA4"),
      1,
      `expected SA4/100% on ${r.sku} qty=${r.quantity} got ${r.salespersons}`
    );
    assert.equal(salespersonShare(r, "BT"), 0);
    assert.equal(salespersonShare(r, "JG1"), 0);
  }
  const ticketNet = ticket.reduce((s, r) => s + r.netRevenue, 0);
  assert.ok(Math.abs(ticketNet - 22753.13) < 0.02, `ticket Total ${ticketNet}`);

  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-08-01", endDate: "2026-08-31" },
    salespeople: ["SA4"],
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topDesigns: true, topSalesPeople: true },
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  const net = q.summary?.netSales ?? 0;
  assert.ok(
    Math.abs(net - EXPECT_NET) < 0.05,
    `SA4 Aug net expected ${EXPECT_NET} got ${net}`
  );
  const watch = (q.rankings?.topDesigns ?? []).find(
    (d) => d.name.toUpperCase() === "WATCH"
  );
  assert.ok(watch, "WATCH design missing");
  assert.ok(
    Math.abs((watch?.netSales ?? 0) - EXPECT_WATCH) < 0.05,
    `WATCH expected ${EXPECT_WATCH} got ${watch?.netSales}`
  );

  const pointer = readActivePointer();
  const all = pointer ? readNormalizedRows(pointer.version) ?? [] : [];
  const aug = filterRows(all, { dateFrom: "2026-08-01", dateTo: "2026-08-31" });
  const sa4Watch = aug
    .filter((r) => (r.design || "").toUpperCase() === "WATCH")
    .reduce((s, r) => s + r.netRevenue * salespersonShare(r, "SA4"), 0);
  assert.ok(Math.abs(sa4Watch - EXPECT_WATCH) < 0.05, `credited WATCH ${sa4Watch}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        sa4AugNet: +net.toFixed(2),
        watchNet: +(watch?.netSales ?? 0).toFixed(2),
        datejustLegs: ticket.length,
        datejustTotal: +ticketNet.toFixed(2),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
