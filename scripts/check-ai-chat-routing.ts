/**
 * AI chat routing / memory self-check.
 * Run: npx tsx scripts/check-ai-chat-routing.ts
 */
import {
  getMessageIntent,
  isGeneralKnowledgeChatQuery,
  shouldUseRuleEngine,
} from "../src/lib/ai/assistant-engine";
import { routeIntent } from "../src/lib/ai/intent-router";
import {
  isPersonalAssistantChitchat,
  isSalesFollowUp,
} from "../src/lib/sales/sales-context";
import {
  clearSalesWorkingMemory,
  getSalesWorkingMemory,
} from "../src/lib/sales/sales-working-memory";
import { querySalesFromMessage } from "../src/lib/sales/query-sales";
import {
  answerStoreQuery,
  classifyStoreIntent,
} from "../src/lib/stores/store-intelligence";
import { looksLikeCompanyKnowledgeQuery } from "../src/lib/voice/company-knowledge-format";

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
  console.log("  AI Chat Routing Checks");
  console.log("════════════════════════════════════════════════════════════\n");

  const chitchat = "nothinfg what about yourself";
  assert("chitchat is personal", isPersonalAssistantChitchat(chitchat));
  assert("chitchat is NOT sales follow-up", !isSalesFollowUp(chitchat));
  assert("chitchat → greeting", getMessageIntent(chitchat) === "greeting");
  assert("chitchat uses rule engine", shouldUseRuleEngine(chitchat));

  assert(
    "What about by store? is sales follow-up",
    isSalesFollowUp("What about by store?")
  );
  assert(
    "What about by store? is NOT general knowledge (preferLlm off)",
    !isGeneralKnowledgeChatQuery("What about by store?")
  );
  assert(
    "What about Ovani? is NOT general knowledge",
    !isGeneralKnowledgeChatQuery("What about Ovani?")
  );

  // Intent router must not throw (SALES_FOLLOWUP fix)
  let routed: string | null = null;
  try {
    routed = routeIntent({ message: "Show Novello sales" });
    assert("routeIntent Show Novello sales", routed === "sales.query", String(routed));
  } catch (e) {
    assert("routeIntent Show Novello sales", false, String(e));
  }

  try {
    routed = routeIntent({ message: "sales by department now" });
    assert(
      "routeIntent sales follow-up path no throw",
      routed === "sales.query" || routed === "sales.read",
      String(routed)
    );
  } catch (e) {
    assert("routeIntent sales follow-up path no throw", false, String(e));
  }

  assert(
    "Show Novello sales is NOT rules-only sales_report",
    getMessageIntent("Show Novello sales") !== "sales_report"
  );
  assert(
    "today sales stays sales_report",
    getMessageIntent("what's today sales") === "sales_report" ||
      getMessageIntent("today sales") === "sales_report"
  );

  clearSalesWorkingMemory();
  await querySalesFromMessage("Show Novello sales");
  const mem1 = getSalesWorkingMemory();
  assert(
    "memory stores Novello",
    (mem1.lastDesigns ?? []).some((d) => /novello/i.test(d)),
    JSON.stringify(mem1.lastDesigns)
  );

  const byStore = await querySalesFromMessage("What about by store?");
  assert(
    "by store keeps Novello",
    byStore.query.filters.designs.some((d) => /novello/i.test(d)),
    JSON.stringify(byStore.query.filters.designs)
  );
  assert("by store groupBy", byStore.query.groupBy.includes("store"));

  const aboutOvani = await querySalesFromMessage("What about Ovani?");
  assert(
    "what about Ovani switches design",
    aboutOvani.query.filters.designs.some((d) => /ovani/i.test(d)),
    JSON.stringify(aboutOvani.query.filters.designs)
  );

  assert(
    "distance classify",
    classifyStoreIntent("How far is Great Mall from Valley Fair?") === "store.distance"
  );
  const dist = answerStoreQuery("How far is Great Mall from Valley Fair?");
  assert(
    "distance answer has miles/km",
    /km|mi|mile/i.test(dist.markdown) && !/Valliani Jewelers — \d+ locations/i.test(dist.markdown),
    dist.markdown.slice(0, 160)
  );

  const lookup = answerStoreQuery("Where is Great Mall?");
  assert(
    "Great Mall lookup not full directory dump",
    /great mall/i.test(lookup.markdown) && !/Valliani Jewelers — \d+ locations/i.test(lookup.markdown),
    lookup.markdown.slice(0, 160)
  );

  assert(
    "return policy is company knowledge",
    looksLikeCompanyKnowledgeQuery("What is Valliani return policy?")
  );
  assert(
    "Novello sales is NOT company RAG-only",
    !looksLikeCompanyKnowledgeQuery("Show Novello sales")
  );

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("────────────────────────────────────────────────────────────\n");
  if (failed > 0) process.exit(1);
  console.log("✓ AI chat routing checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
