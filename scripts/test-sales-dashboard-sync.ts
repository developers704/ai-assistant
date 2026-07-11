/**
 * Sales dashboard sync tests.
 * Run: npx tsx scripts/test-sales-dashboard-sync.ts
 */
import { querySalesFromMessage } from "../src/lib/sales/query-sales";
import {
  clearSalesWorkingMemory,
  clearSalesDashboardState,
  getSalesDashboardState,
  salesDashboardToQuery,
} from "../src/lib/sales/sales-working-memory";

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
  console.log("  Sales Dashboard Sync Tests");
  console.log("════════════════════════════════════════════════════════════\n");

  clearSalesWorkingMemory();
  clearSalesDashboardState();

  const result = await querySalesFromMessage("Show Novello sales", {
    display: { navigateToSales: true, applyDashboardFilters: true },
  });

  assert("result has dashboardState", Boolean(result.dashboardState));
  const path = result.dashboardState
    ? salesDashboardToQuery(result.dashboardState)
    : "";
  assert("path is /sales", path.startsWith("/sales"), path);
  assert("path includes design", /design=/i.test(path), path);

  const persisted = getSalesDashboardState();
  assert("dashboard state persisted", Boolean(persisted?.designs?.length));
  assert(
    "persisted design is Novello",
    (persisted?.designs ?? []).some((d) => /novello/i.test(d)),
    JSON.stringify(persisted?.designs)
  );

  const ladies = await querySalesFromMessage("Show LADYS RING sales by vendor", {
    display: { navigateToSales: true, applyDashboardFilters: true },
  });
  const ladiesPath = ladies.dashboardState
    ? salesDashboardToQuery(ladies.dashboardState)
    : "";
  assert(
    "LADYS RING path has department",
    /department=/i.test(ladiesPath),
    ladiesPath
  );

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("────────────────────────────────────────────────────────────\n");
  if (failed > 0) process.exit(1);
  console.log("✓ Sales dashboard sync tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
