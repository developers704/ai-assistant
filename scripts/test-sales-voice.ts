/**
 * Sales voice / Roman Urdu routing tests.
 * Run: npx tsx scripts/test-sales-voice.ts
 */
import { routeIntent, intentToTool } from "../src/lib/ai/intent-router";
import { querySalesFromMessage } from "../src/lib/sales/query-sales";
import { clearSalesWorkingMemory } from "../src/lib/sales/sales-working-memory";
import { detectRelativeDate } from "../src/lib/sales/sales-date-resolver";

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
  console.log("  Sales Voice / Roman Urdu Tests");
  console.log("════════════════════════════════════════════════════════════\n");

  clearSalesWorkingMemory();

  assert(
    "Novello ki kal ki sales → sales.query",
    routeIntent({ message: "Novello ki kal ki sales batao" }) === "sales.query"
  );
  assert(
    "Ladies ring dikhao → sales.query",
    routeIntent({ message: "Ladies ring ki sales show karo" }) === "sales.query"
  );
  assert(
    "kal resolves to yesterday",
    detectRelativeDate("kal ki sales")?.type === "yesterday"
  );
  assert(
    "aaj resolves to today",
    detectRelativeDate("aaj ki sales")?.type === "today"
  );

  const result = await querySalesFromMessage("Novello ki sales batao");
  assert("Roman Urdu Novello ok or clarified", result.ok || Boolean(result.clarification));
  assert(
    "spoken answer non-empty",
    result.spokenAnswer.length > 10,
    result.spokenAnswer
  );
  assert(
    "spoken is short-ish",
    result.spokenAnswer.split(/[.!?]/).filter(Boolean).length <= 5,
    result.spokenAnswer
  );

  assert(
    "intent maps to query_sales",
    intentToTool("sales.query") === "query_sales"
  );

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("────────────────────────────────────────────────────────────\n");
  if (failed > 0) process.exit(1);
  console.log("✓ Sales voice tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
