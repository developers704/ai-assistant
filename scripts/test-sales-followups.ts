/**
 * Sales follow-up / memory tests.
 * Run: npx tsx scripts/test-sales-followups.ts
 */
import { querySalesFromMessage } from "../src/lib/sales/query-sales";
import {
  clearSalesWorkingMemory,
  getSalesWorkingMemory,
} from "../src/lib/sales/sales-working-memory";
import { detectGroupByFromMessage } from "../src/lib/sales/sales-context";

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
  console.log("  Sales Follow-up Tests");
  console.log("════════════════════════════════════════════════════════════\n");

  clearSalesWorkingMemory();

  assert(
    "detect by department",
    detectGroupByFromMessage("now by department").includes("department")
  );
  assert(
    "detect store ke hisaab",
    detectGroupByFromMessage("Ab store ke hisaab se").includes("store")
  );

  await querySalesFromMessage("Show Novello sales");
  const mem1 = getSalesWorkingMemory();
  assert(
    "memory stores Novello design",
    (mem1.lastDesigns ?? []).some((d) => /novello/i.test(d)),
    JSON.stringify(mem1.lastDesigns)
  );

  const byStore = await querySalesFromMessage("What about by store?");
  assert(
    "by store keeps design",
    byStore.query.filters.designs.some((d) => /novello/i.test(d))
  );
  assert("by store groupBy", byStore.query.groupBy.includes("store"));

  const aboutOvani = await querySalesFromMessage("What about Ovani?");
  assert(
    "what about Ovani switches design",
    aboutOvani.query.filters.designs.some((d) => /ovani/i.test(d)),
    JSON.stringify(aboutOvani.query.filters.designs)
  );

  await querySalesFromMessage("reset sales filters");
  const mem2 = getSalesWorkingMemory();
  assert(
    "reset clears designs",
    !(mem2.lastDesigns && mem2.lastDesigns.length),
    JSON.stringify(mem2.lastDesigns)
  );

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("────────────────────────────────────────────────────────────\n");
  if (failed > 0) process.exit(1);
  console.log("✓ Sales follow-up tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
