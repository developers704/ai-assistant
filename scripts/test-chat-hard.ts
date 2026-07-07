/**
 * Hard AI Chat test suite — 50+ cases across routing, follow-ups, compose, confirm.
 *
 * Run:  npm run test:chat
 *       npm run test:chat:quick
 *
 * Options (env):
 *   CHAT_TEST_VERBOSE=1   — print every response
 *   CHAT_TEST_SKIP_LLM=1  — skip LLM-only cases (default when no OPENAI_API_KEY)
 *
 * ─── Regression workflow (keep Alexa from breaking) ─────────────────────────
 * When a real user reports a bad answer:
 *   1. Fix the routing / handler bug
 *   2. Add the EXACT user prompt below in REGRESSION_CASES (with must/mustNot rules)
 *   3. Run: npm run test:chat
 *   4. Commit the fix + test together
 *
 * Template:
 *   {
 *     id: "reg-YYYYMMDD-short-desc",
 *     category: "regression",
 *     messages: ["exact user prompt"],           // multi-turn: add follow-ups in order
 *     assert: {
 *       mustInclude: ["expected phrase"],
 *       mustNotInclude: ["wrong behavior"],
 *       noPending: true,                         // for read-only / in-chat answers
 *       requiresPending: true,                   // for send/delete confirm flows
 *     },
 *   },
 */
import { processAlexaMessage } from "../src/lib/ai/process-message";
import {
  processMessage,
  shouldUseRuleEngine,
} from "../src/lib/ai/assistant-engine";
import { isImageGenerateRequest } from "../src/lib/images/generate-jewellery-image";
import { processImageGenerate } from "../src/lib/ai/image-generate";
import { isLLMChatConfigured } from "../src/lib/ai/llm-chat";
import { getState, setState } from "../src/lib/store/server-store";
import { updateUiContext } from "../src/lib/store/ui-context";
import { clearPendingActions } from "../src/lib/actions/confirmation";
import type { AIResponse, AppState } from "../src/types";

type Engine = "router" | "rules" | "llm" | "llm-fallback" | "none";

interface TurnResult {
  message: string;
  response: AIResponse | null;
  engine: Engine;
}

interface TestAssert {
  mustInclude?: (string | RegExp)[];
  mustNotInclude?: (string | RegExp)[];
  noPending?: boolean;
  requiresPending?: boolean;
  engineIn?: Engine[];
  custom?: (turn: TurnResult, state: AppState) => string | null;
}

interface ChatTestCase {
  id: string;
  category: string;
  /** One or more user turns; assertions apply to the last turn only. */
  messages: string[];
  assert: TestAssert;
  /** Reset chat + pending + path before this case (default true). */
  reset?: boolean;
  /** UI path context before running */
  path?: string;
  selectedEmailId?: string;
}

const VERBOSE = process.env.CHAT_TEST_VERBOSE === "1";
const SKIP_LLM = process.env.CHAT_TEST_SKIP_LLM === "1" || !isLLMChatConfigured();

async function resolveChatMessage(
  message: string,
  state: AppState
): Promise<{ response: AIResponse | null; engine: Engine }> {
  const routed = await processAlexaMessage(message, state);
  if (routed) return { response: routed, engine: "router" };

  if (isImageGenerateRequest(message)) {
    return { response: await processImageGenerate(message), engine: "rules" };
  }

  if (shouldUseRuleEngine(message, state)) {
    return { response: processMessage(message, state), engine: "rules" };
  }

  if (isLLMChatConfigured() && !SKIP_LLM) {
    try {
      const { processMessageWithLLM } = await import("../src/lib/ai/llm-chat");
      return {
        response: await processMessageWithLLM(message, state),
        engine: "llm",
      };
    } catch {
      return { response: processMessage(message, state), engine: "llm-fallback" };
    }
  }

  const rules = processMessage(message, state);
  return { response: rules, engine: rules ? "rules" : "none" };
}

function appendTurn(state: AppState, user: string, res: AIResponse | null): void {
  if (!res) return;
  setState((s) => ({
    ...s,
    chatHistory: [
      ...s.chatHistory,
      {
        id: `u-${Date.now()}`,
        role: "user",
        content: user,
        timestamp: new Date().toISOString(),
      },
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.message,
        timestamp: new Date().toISOString(),
        pendingAction: res.pendingAction,
      },
    ],
  }));
}

function matchPatterns(text: string, patterns: (string | RegExp)[]): string | null {
  for (const p of patterns) {
    if (typeof p === "string") {
      if (!text.includes(p)) return `missing "${p}"`;
    } else if (!p.test(text)) {
      return `missing pattern ${p}`;
    }
  }
  return null;
}

function runAssert(turn: TurnResult, state: AppState, assert: TestAssert): string | null {
  const text = turn.response?.message ?? "";
  if (!turn.response && (assert.mustInclude?.length || assert.requiresPending)) {
    return "expected response but got null";
  }

  if (assert.mustInclude) {
    const err = matchPatterns(text, assert.mustInclude);
    if (err) return err;
  }

  if (assert.mustNotInclude) {
    for (const p of assert.mustNotInclude) {
      const hit = typeof p === "string" ? text.includes(p) : p.test(text);
      if (hit) return `forbidden ${typeof p === "string" ? `"${p}"` : p} found`;
    }
  }

  if (assert.noPending && turn.response?.pendingAction) {
    return `unexpected pendingAction: ${turn.response.pendingAction.type}`;
  }

  if (assert.requiresPending && !turn.response?.pendingAction) {
    return "expected pendingAction but none returned";
  }

  if (assert.engineIn && !assert.engineIn.includes(turn.engine)) {
    return `engine ${turn.engine} not in [${assert.engineIn.join(", ")}]`;
  }

  if (assert.custom) {
    return assert.custom(turn, state);
  }

  return null;
}

function resetSession(path = "/chat"): void {
  clearPendingActions();
  setState((s) => ({ ...s, chatHistory: [], pendingActions: [] }));
  updateUiContext({ currentPath: path, selectedEmailId: undefined });
}

async function runCase(test: ChatTestCase): Promise<{ ok: boolean; detail?: string }> {
  if (test.reset !== false) {
    resetSession(test.path ?? "/chat");
  }
  if (test.path) updateUiContext({ currentPath: test.path });
  if (test.selectedEmailId) {
    updateUiContext({ selectedEmailId: test.selectedEmailId });
  }

  let lastTurn: TurnResult = { message: "", response: null, engine: "none" };

  for (const msg of test.messages) {
    const state = getState();
    const { response, engine } = await resolveChatMessage(msg, state);
    lastTurn = { message: msg, response, engine };
    appendTurn(state, msg, response);
    if (VERBOSE) {
      console.log(`  [${test.id}] Q: ${msg}`);
      console.log(`  [${test.id}] A: ${response?.message?.slice(0, 200) ?? "(null)"}`);
    }
  }

  const err = runAssert(lastTurn, getState(), test.assert);
  return err ? { ok: false, detail: err } : { ok: true };
}

// ─── Test cases ─────────────────────────────────────────────────────────────

// ─── Real-user regressions (add new bad prompts here) ────────────────────────
const REGRESSION_CASES: ChatTestCase[] = [
  {
    id: "reg-20260707-calendar-confirm",
    category: "regression",
    messages: ["What's on my calendar today?"],
    assert: {
      mustInclude: [/event|meeting|standup|clear/i],
      mustNotInclude: ["Confirmation required", "Say **yes**", "destructive actions need your **yes**"],
      noPending: true,
    },
  },
  {
    id: "reg-20260707-sales-yes-breakdown",
    category: "regression",
    messages: ["Which store is best?", "yes"],
    assert: {
      mustInclude: [/Sales Summary|Top stores|Total Revenue/i],
      mustNotInclude: ["What should I confirm"],
      noPending: true,
    },
  },
  {
    id: "reg-20260707-sales-no-confirm-card",
    category: "regression",
    messages: ["Which store is best?"],
    assert: {
      mustInclude: ["DBC-GM"],
      mustNotInclude: ["Open Sales Dashboard", "Confirmation required"],
      noPending: true,
    },
  },
  {
    id: "reg-20260707-email-ross-not-inbox",
    category: "regression",
    messages: ["Email Ross"],
    assert: {
      mustInclude: ["Ross"],
      mustNotInclude: ["unread out of"],
      noPending: true,
    },
  },
  {
    id: "reg-20260707-email-to-ros-not-To",
    category: "regression",
    messages: ["email to ros"],
    assert: {
      mustInclude: ["Ross"],
      mustNotInclude: ["**To**", "unread out of"],
      noPending: true,
    },
  },
  {
    id: "reg-20260707-email-ross-time",
    category: "regression",
    messages: ["email to ross Tomorrow 4pm"],
    assert: {
      mustInclude: ["Ross"],
      mustNotInclude: ["**To**"],
      noPending: true,
    },
  },
  {
    id: "reg-20260707-valliani-everything",
    category: "regression",
    messages: ["Tell me everything you know about Valliani Jewelers."],
    assert: {
      mustInclude: [
        "Valliani Jewelers — what I know",
        "Company identity",
        "Kash Valliani",
        "Brand background",
        "Business type and products",
        "House of brands",
        "Valliani store count and regions",
      ],
      mustNotInclude: [
        "Q: How can customers contact",
        "I also have 2 related notes",
        "Confirmation required",
      ],
      noPending: true,
    },
  },
];

const CASES: ChatTestCase[] = [
  ...REGRESSION_CASES,
  // Calendar — read in chat, no confirm card
  { id: "cal-01", category: "calendar", messages: ["What's on my calendar today?"], assert: { mustInclude: [/event|meeting|standup|clear/i], noPending: true, mustNotInclude: ["Confirmation required", "Say **yes**"] } },
  { id: "cal-02", category: "calendar", messages: ["whats on my calender today"], assert: { mustInclude: [/event|meeting|clear/i], noPending: true } },
  { id: "cal-03", category: "calendar", messages: ["any meetings today"], assert: { mustInclude: [/event|meeting|AM|PM|clear/i], noPending: true } },
  { id: "cal-04", category: "calendar", messages: ["tomorrow's schedule"], assert: { noPending: true, mustInclude: [/tomorrow|schedule|event|meeting|clear/i] } },
  { id: "cal-05", category: "calendar", messages: ["show my schedule"], assert: { noPending: true } },
  { id: "cal-06", category: "calendar", messages: ["do i have meetings today"], assert: { noPending: true } },
  { id: "cal-07", category: "calendar", messages: ["check my calendar"], assert: { noPending: true } },
  { id: "cal-08", category: "calendar", messages: ["what meetings do i have"], assert: { noPending: true } },

  // Sales — data in chat
  { id: "sales-01", category: "sales", messages: ["Which store is best?"], assert: { mustInclude: ["DBC-GM", "Want full store breakdown"], noPending: true } },
  { id: "sales-02", category: "sales", messages: ["show me best store with sales"], assert: { mustInclude: ["DBC-GM"], noPending: true } },
  { id: "sales-03", category: "sales", messages: ["top store sales"], assert: { mustInclude: [/store|DBC/i], noPending: true } },
  { id: "sales-04", category: "sales", messages: ["today's sales"], assert: { mustInclude: [/sales|revenue|\$/i], noPending: true } },
  { id: "sales-05", category: "sales", messages: ["full sales report"], assert: { mustInclude: [/Sales|revenue|store/i], noPending: true } },
  { id: "sales-06", category: "sales", messages: ["i want to see one store with top sales"], assert: { mustInclude: ["DBC-GM"], noPending: true } },
  { id: "sales-07", category: "sales", messages: ["which store has the highest revenue"], assert: { mustInclude: [/DBC|store/i], noPending: true } },
  {
    id: "sales-08",
    category: "sales-followup",
    messages: ["Which store is best?", "yes"],
    assert: { mustInclude: [/Sales Summary|Top stores|Total Revenue/i], mustNotInclude: ["What should I confirm"], noPending: true },
  },
  {
    id: "sales-09",
    category: "sales-followup",
    messages: ["show me best store", "sure"],
    assert: { mustInclude: [/Sales|store|revenue/i], mustNotInclude: ["What should I confirm"] },
  },
  { id: "sales-10", category: "sales", messages: ["MHVR report"], assert: { mustInclude: [/sales|revenue|report/i], noPending: true } },

  // Email — compose vs inbox
  { id: "email-01", category: "email-compose", messages: ["Email Ross"], assert: { mustInclude: ["Ross"], mustNotInclude: ["unread out of", "**To**"], noPending: true } },
  { id: "email-02", category: "email-compose", messages: ["email to ros"], assert: { mustInclude: ["Ross"], mustNotInclude: ["**To**", "unread out of"], noPending: true } },
  { id: "email-03", category: "email-compose", messages: ["email to ross Tomorrow 4pm"], assert: { mustInclude: ["Ross"], mustNotInclude: ["**To**"], noPending: true } },
  { id: "email-04", category: "email-compose", messages: ["send an email to Ross"], assert: { mustInclude: ["Ross"], noPending: true } },
  { id: "email-05", category: "email-compose", messages: ["draft an email to Ross"], assert: { mustInclude: ["Ross"], noPending: true } },
  { id: "email-06", category: "email-compose", messages: ["compose email to Ross"], assert: { mustInclude: ["Ross"], noPending: true } },
  { id: "email-07", category: "email-compose", messages: ["write email to Ross"], assert: { mustInclude: ["Ross"], noPending: true } },
  { id: "email-08", category: "email-read", messages: ["summarize my important emails"], assert: { mustInclude: [/email|inbox|unread|urgent/i], noPending: true } },
  { id: "email-09", category: "email-read", messages: ["check my email"], assert: { mustInclude: [/email|inbox|unread/i], noPending: true } },
  { id: "email-10", category: "email-read", messages: ["email summary"], assert: { mustInclude: [/email|inbox|unread/i], noPending: true } },
  { id: "email-11", category: "email-compose", messages: ["Draft an email to Claudia"], assert: { mustInclude: ["Claudia"], mustNotInclude: ["unread out of"], noPending: true } },
  { id: "email-12", category: "email-compose", messages: ["mail to Ross"], assert: { mustInclude: ["Ross"], noPending: true } },

  // Meetings
  { id: "meet-01", category: "meeting", messages: ["set meeting with Ross tomorrow"], assert: { mustInclude: [/time|Ross|schedule/i], noPending: true } },
  { id: "meet-02", category: "meeting", messages: ["schedule a meeting with Ahmed"], assert: { mustInclude: [/meeting|time|Ahmed/i] } },
  { id: "meet-03", category: "meeting-danger", messages: ["delete all meetings"], assert: { requiresPending: true, mustInclude: [/delete|confirm|yes/i] } },

  // News
  { id: "news-01", category: "news", messages: ["what's about news and market?"], assert: { mustInclude: [/news|gold|jewelry|headline/i], noPending: true } },
  { id: "news-02", category: "news", messages: ["latest industry news"], assert: { mustInclude: [/news|market|gold/i], noPending: true } },
  { id: "news-03", category: "news", messages: ["gold price today"], assert: { mustInclude: [/gold|silver|price|rate/i], noPending: true } },
  {
    id: "news-04",
    category: "news-followup",
    messages: ["what's about news and market?", "yes pls open"],
    assert: { mustInclude: [/Opening|News/i] },
  },

  // Navigation
  { id: "nav-01", category: "navigation", messages: ["open sales dashboard"], assert: { mustInclude: [/sales|Opening/i], noPending: true } },
  { id: "nav-02", category: "navigation", messages: ["open calendar"], assert: { mustInclude: [/event|meeting|standup|Opening|Calendar/i], noPending: true } },
  { id: "nav-03", category: "navigation", messages: ["go to email"], assert: { mustInclude: [/email|Opening/i], noPending: true } },
  { id: "nav-04", category: "navigation", messages: ["show news page"], assert: { mustInclude: [/news|Opening/i], noPending: true } },

  // Tasks & reminders
  { id: "task-01", category: "tasks", messages: ["show my tasks"], assert: { mustInclude: [/task|pending|catch|caught/i], noPending: true } },
  { id: "task-02", category: "tasks", messages: ["list my reminders"], assert: { mustInclude: [/task|reminder|pending/i], noPending: true } },
  { id: "task-03", category: "tasks", messages: ["what are my pending tasks"], assert: { mustInclude: [/task|pending/i], noPending: true } },
  { id: "task-04", category: "reminder", messages: ["remind me to review lease tomorrow"], assert: { mustInclude: [/remind|lease|tomorrow/i] } },

  // Contacts
  { id: "contact-01", category: "contacts", messages: ["find Ross"], assert: { mustInclude: [/Ross|contact/i], noPending: true } },
  { id: "contact-02", category: "contacts", messages: ["Ross phone number"], assert: { mustInclude: [/Ross|contact|phone/i], noPending: true } },

  // Briefing / dashboard
  { id: "brief-01", category: "briefing", messages: ["daily briefing"], assert: { mustInclude: [/brief|today|calendar|email|sales/i] } },
  { id: "brief-02", category: "briefing", messages: ["what do I need to focus on today?"], assert: { custom: (t) => (t.response?.message ? null : "no response") } },

  // Reject / bare yes
  { id: "edge-01", category: "edge", messages: ["cancel"], assert: { mustInclude: [/cancel/i] } },
  { id: "edge-02", category: "edge", messages: ["yes"], assert: { mustNotInclude: ["What should I confirm"] } },
  { id: "edge-03", category: "edge", messages: ["What's on my calendar today?"], assert: { mustNotInclude: ["Calendar & Tasks shows meetings", "destructive actions need your **yes**"] } },
  { id: "edge-04", category: "edge", messages: ["Which store is best?"], assert: { mustNotInclude: ["Open Sales Dashboard", "Confirmation required"] } },

  // Page context — sales explain
  {
    id: "ctx-02",
    category: "page-context",
    path: "/sales",
    messages: ["explain this"],
    assert: { mustInclude: [/Sales|revenue|store/i], noPending: true },
  },

  // Help / section (no confirm card)
  { id: "help-01", category: "help", messages: ["what can you do"], assert: { mustNotInclude: ["Confirmation required"], noPending: true } },
  { id: "help-02", category: "help", messages: ["what can you do in sales"], assert: { mustNotInclude: ["Confirmation required"], noPending: true } },

  // Knowledge
  { id: "know-01", category: "knowledge", messages: ["how many stores does Valliani have"], assert: { mustInclude: [/store|Valliani|\d/i] } },

  // Stores
  { id: "store-01", category: "stores", messages: ["list texas stores"], assert: { mustInclude: [/store|Texas|location/i] } },
];

// Fix meet-04: needs delete staged first — run as chained case in main

async function main() {
  console.log("═".repeat(60));
  console.log("  AI Chat — Hard Test Suite");
  console.log(`  Cases: ${CASES.length}  |  LLM: ${SKIP_LLM ? "skipped" : "enabled"}`);
  console.log("═".repeat(60));

  const failures: { id: string; category: string; detail: string; lastQ: string }[] = [];
  const skipped: string[] = [];
  let passed = 0;

  const runIds = new Set<string>();

  for (const test of CASES) {
    const result = await runCase(test);
    if (result.ok) {
      passed++;
    } else if (result.detail === "no demo emails — skip") {
      skipped.push(test.id);
    } else {
      failures.push({
        id: test.id,
        category: test.category,
        detail: result.detail ?? "unknown",
        lastQ: test.messages[test.messages.length - 1] ?? "",
      });
    }
  }

  // Chained delete flow (runs after meet-03 in CASES, before events are wiped)
  resetSession();
  const delStage = await runCase({
    id: "meet-04a",
    category: "meeting-danger",
    messages: ["delete all meetings"],
    assert: { requiresPending: true },
  });
  if (!delStage.ok) {
    failures.push({ id: "meet-04a", category: "meeting-danger", detail: delStage.detail ?? "?", lastQ: "delete all meetings" });
  } else {
    const delConfirm = await runCase({
      id: "meet-04b",
      category: "meeting-danger",
      reset: false,
      messages: ["yes please remove all"],
      assert: { mustInclude: [/removed|deleted|meeting/i] },
    });
    if (delConfirm.ok) passed += 1;
    else failures.push({ id: "meet-04b", category: "meeting-danger", detail: delConfirm.detail ?? "?", lastQ: "yes please remove all" });
  }
  runIds.add("meet-04a").add("meet-04b");

  // Email reply context — needs selected email
  const emails = getState().emails;
  if (emails[0]) {
    resetSession("/email");
    updateUiContext({ currentPath: "/email", selectedEmailId: emails[0].id });
    const reply = await runCase({
      id: "ctx-01",
      category: "page-context",
      reset: false,
      path: "/email",
      selectedEmailId: emails[0].id,
      messages: ["reply politely"],
      assert: { mustInclude: [/draft|reply|email/i], requiresPending: true },
    });
    if (reply.ok) passed++;
    else failures.push({ id: "ctx-01", category: "page-context", detail: reply.detail ?? "?", lastQ: "reply politely" });
  } else {
    skipped.push("ctx-01 (no emails)");
  }

  console.log("\n" + "─".repeat(60));
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failures.length}`);
  if (skipped.length) console.log(`SKIPPED: ${skipped.length} (${skipped.join(", ")})`);

  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  ✗ [${f.id}] (${f.category}) Q: "${f.lastQ}"`);
      console.log(`      ${f.detail}`);
    }
    process.exitCode = 1;
  } else {
    console.log("\n✓ All hard chat tests passed.");
  }

  console.log("─".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
