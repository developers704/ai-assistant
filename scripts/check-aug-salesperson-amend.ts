/**
 * August 1–31 salesperson amendments: live seed / dashboard / HR must match
 * the POS split-salesperson export (Sales Person + Total + Design).
 *
 * Run after `npx tsx scripts/apply-aug-salesperson-amend.ts` and
 * `npx tsx scripts/refresh-sales-now.ts`:
 *   npx tsx scripts/check-aug-salesperson-amend.ts
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { loadRankRows } from "../src/lib/reports/load-rank-rows";
import { creditSalespersonRows } from "../src/lib/sales/salesperson-credit";
import { filterRows, groupRows } from "../src/lib/sales/sales-aggregate";
import { querySales } from "../src/lib/sales/query-sales";
import { applySalespersonFilter } from "../src/lib/sales/paycode-overlay";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "scripts/fixtures/aug-2026-split-salesperson-expected.json"
);

type Fixture = {
  posRows: number;
  posNet: number;
  byPerson: Record<string, number>;
  byDesign: Record<string, number>;
  byStore: Record<string, number>;
  byPersonDesign: Record<string, number>;
};

function close(a: number, b: number, tol = 0.05): boolean {
  return Math.abs(a - b) <= tol;
}

function moneyMap(rows: { name: string; netSales: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.name, r.netSales);
  return m;
}

async function main() {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
  const all = loadRankRows() ?? [];
  const aug = filterRows(all, { dateFrom: "2026-08-01", dateTo: "2026-08-31" });
  const liveNet = aug.reduce((s, r) => s + r.netRevenue, 0);
  assert.ok(
    close(liveNet, fixture.posNet, 0.05),
    `August net ${liveNet.toFixed(2)} != POS ${fixture.posNet.toFixed(2)}`
  );
  assert.equal(aug.length, fixture.posRows, "August row count must match POS");

  const credits = creditSalespersonRows(aug);
  const personDiffs: { code: string; pos: number; live: number; diff: number }[] = [];
  const codes = new Set([...Object.keys(fixture.byPerson), ...credits.map((c) => c.code)]);
  for (const code of codes) {
    const pos = fixture.byPerson[code] ?? 0;
    const live = credits.find((c) => c.code === code)?.netSales ?? 0;
    const diff = live - pos;
    if (!close(live, pos, 0.5)) {
      personDiffs.push({
        code,
        pos: +pos.toFixed(2),
        live: +live.toFixed(2),
        diff: +diff.toFixed(2),
      });
    }
  }
  assert.equal(
    personDiffs.length,
    0,
    `salesperson nets differ: ${JSON.stringify(personDiffs.slice(0, 15))}`
  );

  const liveDesigns = moneyMap(groupRows(aug, "design", null));
  const designDiffs: { name: string; pos: number; live: number; diff: number }[] = [];
  const designs = new Set([...Object.keys(fixture.byDesign), ...liveDesigns.keys()]);
  for (const name of designs) {
    const pos = fixture.byDesign[name] ?? 0;
    const live = liveDesigns.get(name) ?? 0;
    if (!close(live, pos, 0.5)) {
      designDiffs.push({
        name,
        pos: +pos.toFixed(2),
        live: +live.toFixed(2),
        diff: +(live - pos).toFixed(2),
      });
    }
  }
  assert.equal(
    designDiffs.length,
    0,
    `design nets differ: ${JSON.stringify(designDiffs.slice(0, 15))}`
  );

  const liveStores = moneyMap(groupRows(aug, "store", null));
  const storeDiffs: { name: string; pos: number; live: number; diff: number }[] = [];
  const stores = new Set([...Object.keys(fixture.byStore), ...liveStores.keys()]);
  for (const name of stores) {
    const pos = fixture.byStore[name] ?? 0;
    const live = liveStores.get(name) ?? 0;
    if (!close(live, pos, 0.5)) {
      storeDiffs.push({
        name,
        pos: +pos.toFixed(2),
        live: +live.toFixed(2),
        diff: +(live - pos).toFixed(2),
      });
    }
  }
  assert.equal(
    storeDiffs.length,
    0,
    `store nets differ: ${JSON.stringify(storeDiffs.slice(0, 10))}`
  );

  const q = await querySales({
    dateRange: { type: "custom", startDate: "2026-08-01", endDate: "2026-08-31" },
    resetContext: true,
    exactFilters: true,
    include: { summary: true, topStores: true, topSalesPeople: true, topDesigns: true },
    limit: 500,
  });
  assert.ok(q.ok && q.summary, q.error ?? "querySales failed");
  assert.ok(
    close(q.summary!.netSales, fixture.posNet, 0.05),
    `querySales August net ${q.summary!.netSales.toFixed(2)} != POS ${fixture.posNet}`
  );

  const sampleCodes = Object.entries(fixture.byPerson)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([code]) => code);
  // Include associates who moved the most vs a 100% rewrite still must match POS.
  for (const extra of ["SA4", "HS2", "MV", "LS1", "IN", "CM82", "ZF1", "GP1"]) {
    if (fixture.byPerson[extra] != null && !sampleCodes.includes(extra)) {
      sampleCodes.push(extra);
    }
  }

  const hrDesignMismatches: unknown[] = [];
  for (const code of sampleCodes) {
    const filtered = applySalespersonFilter(aug, [code]);
    const net = filtered.reduce((s, r) => s + r.netRevenue, 0);
    const posNet = fixture.byPerson[code] ?? 0;
    assert.ok(
      close(net, posNet, 0.5),
      `${code} HR/salesperson filter net ${net.toFixed(2)} != POS ${posNet.toFixed(2)}`
    );

    const designs = groupRows(filtered, "design", null);
    for (const d of designs) {
      const pos = fixture.byPersonDesign[`${code}||${d.name}`] ?? 0;
      if (!close(d.netSales, pos, 0.5)) {
        hrDesignMismatches.push({
          code,
          design: d.name,
          pos: +pos.toFixed(2),
          live: +d.netSales.toFixed(2),
          diff: +(d.netSales - pos).toFixed(2),
        });
      }
    }
    for (const [key, pos] of Object.entries(fixture.byPersonDesign)) {
      if (!key.startsWith(`${code}||`)) continue;
      const design = key.slice(code.length + 2);
      const live = designs.find((d) => d.name === design)?.netSales ?? 0;
      if (!close(live, pos, 0.5)) {
        hrDesignMismatches.push({
          code,
          design,
          pos,
          live: +live.toFixed(2),
          diff: +(live - pos).toFixed(2),
        });
      }
    }

    const qSp = await querySales({
      dateRange: { type: "custom", startDate: "2026-08-01", endDate: "2026-08-31" },
      salespeople: [code],
      resetContext: true,
      exactFilters: true,
      include: { summary: true, topDesigns: true },
      limit: 500,
    });
    assert.ok(qSp.ok && qSp.summary, qSp.error ?? `querySales ${code} failed`);
    assert.ok(
      close(qSp.summary!.netSales, posNet, 0.5),
      `querySales ${code} net ${qSp.summary!.netSales.toFixed(2)} != POS ${posNet.toFixed(2)}`
    );
  }

  const uniqueHr = [
    ...new Map(
      (hrDesignMismatches as { code: string; design: string }[]).map((x) => [
        `${x.code}|${x.design}`,
        x,
      ])
    ).values(),
  ];
  assert.equal(
    uniqueHr.length,
    0,
    `HR design-wise differs: ${JSON.stringify(uniqueHr.slice(0, 15))}`
  );

  console.log("check-aug-salesperson-amend: ok", {
    augRows: aug.length,
    augNet: +liveNet.toFixed(2),
    querySalesNet: +q.summary!.netSales.toFixed(2),
    salespeople: credits.length,
    designs: liveDesigns.size,
    stores: liveStores.size,
    sampledAssociates: sampleCodes.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
