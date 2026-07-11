/**
 * Sales Intelligence regression tests — deterministic query engine.
 * Run: npx tsx scripts/test-sales-intelligence.ts
 */
import { querySales, querySalesFromMessage } from "../src/lib/sales/query-sales";
import { clearSalesWorkingMemory } from "../src/lib/sales/sales-working-memory";
import { matchEntity, buildEntityIndex } from "../src/lib/sales/sales-normalizer";
import { resolveDateRange } from "../src/lib/sales/sales-date-resolver";
import { routeIntent, intentToTool } from "../src/lib/ai/intent-router";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  Sales Intelligence Tests");
  console.log("════════════════════════════════════════════════════════════\n");

  clearSalesWorkingMemory();

  /* Intent routing */
  assert(
    "Show Novello sales → sales.query",
    routeIntent({ message: "Show Novello sales" }) === "sales.query"
  );
  assert(
    "sales.query → query_sales tool",
    intentToTool("sales.query") === "query_sales"
  );
  assert(
    "Compare Great Mall and Valley Fair → sales.compare",
    routeIntent({ message: "Compare Great Mall and Valley Fair" }) === "sales.compare"
  );
  assert(
    "correlation question → sales.analysis",
    routeIntent({
      message: "Is discount rate correlated with units sold by department?",
    }) === "sales.analysis"
  );

  /* Novello summary */
  clearSalesWorkingMemory();
  const novello = await querySalesFromMessage("Show Novello sales", {
    display: { navigateToSales: true, applyDashboardFilters: true },
  });
  assert("Novello query ok", novello.ok, novello.error ?? novello.warnings?.join("; "));
  assert(
    "Novello design filter applied",
    novello.query.filters.designs.some((d) => /novello/i.test(d)),
    JSON.stringify(novello.query.filters.designs)
  );
  assert(
    "Novello has net sales",
    (novello.summary?.netSales ?? 0) > 0,
    String(novello.summary?.netSales)
  );
  assert(
    "Novello dashboard design set",
    Boolean(novello.dashboardState?.designs?.length),
    JSON.stringify(novello.dashboardState?.designs)
  );
  assert(
    "Novello text mentions net",
    /net sales/i.test(novello.textAnswer),
    novello.textAnswer.slice(0, 120)
  );

  /* Follow-up: by department retains Novello */
  const byDept = await querySalesFromMessage("Now by department");
  assert(
    "Follow-up keeps Novello",
    byDept.query.filters.designs.some((d) => /novello/i.test(d)),
    JSON.stringify(byDept.query.filters.designs)
  );
  assert(
    "Follow-up groups by department",
    byDept.query.groupBy.includes("department"),
    JSON.stringify(byDept.query.groupBy)
  );

  /* LADYS RING by vendor */
  clearSalesWorkingMemory();
  const ladies = await querySalesFromMessage("Show LADYS RING sales by vendor");
  assert(
    "LADYS RING department matched",
    ladies.query.filters.departments.some((d) => /lady/i.test(d)),
    JSON.stringify(ladies.query.filters.departments)
  );
  assert(
    "LADYS RING groupBy vendor",
    ladies.query.groupBy.includes("vendor"),
    JSON.stringify(ladies.query.groupBy)
  );

  /* MHVR top models */
  clearSalesWorkingMemory();
  const mhvr = await querySales({
    userMessage: "Show top vendor models for MHVR",
    vendors: ["MHVR"],
    groupBy: ["vendor_model"],
  });
  assert("MHVR vendor filter", mhvr.query.filters.vendors.some((v) => /mhvr/i.test(v)));
  assert(
    "MHVR has vendor models",
    (mhvr.rankings?.topVendorModels?.length ?? mhvr.breakdowns?.byVendorModel?.length ?? 0) > 0
  );

  /* Comparison */
  clearSalesWorkingMemory();
  const cmp = await querySalesFromMessage("Compare Great Mall and Valley Fair for Novello");
  assert(
    "Comparison has left/right or Novello retained",
    Boolean(cmp.comparison) || cmp.query.filters.designs.some((d) => /novello/i.test(d)),
    cmp.textAnswer.slice(0, 160)
  );

  /* Fuzzy normalizer */
  const idx = buildEntityIndex(
    // minimal fake — use live report via a query instead
    []
  );
  void idx;
  const live = await querySales({ designs: ["novelo"], userMessage: "novelo sales" });
  assert(
    "Fuzzy novelo → NOVELLO",
    live.query.filters.designs.some((d) => /novello/i.test(d)) || Boolean(live.clarification),
    JSON.stringify(live.query.filters.designs)
  );

  /* Date unavailable handling */
  const far = resolveDateRange(
    { type: "custom", startDate: "1999-01-01", endDate: "1999-01-01" },
    ["2026-07-01", "2026-07-10"]
  );
  assert(
    "Unavailable date detected",
    far.dates.length === 0 && Boolean(far.unavailableReason),
    far.unavailableReason
  );

  /* matchEntity unit */
  const m = matchEntity("novelo", ["NOVELLO", "OVANI"], "design");
  assert(
    "matchEntity novelo",
    m.status === "exact" || m.status === "fuzzy",
    JSON.stringify(m)
  );

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("────────────────────────────────────────────────────────────\n");
  if (failed > 0) process.exit(1);
  console.log("✓ Sales intelligence tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
