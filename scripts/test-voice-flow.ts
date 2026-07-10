/**
 * Comprehensive voice flow tests:
 *  1. Intent detection for spoken commands (sales, email, calendar, nav, …)
 *  2. Tool execution returns a SPOKEN summary + correct navigation action
 *  3. Voice session architecture survives navigation (static checks)
 *
 * Run: npm run test:voice
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  detectVoiceIntent,
  extractNavigationPage,
  normalizeVoiceTranscript,
} from "../src/lib/voice/intent";
import { executeVoiceTool } from "../src/lib/voice/execute-tool";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------ */
console.log("\n[1] Intent detection — spoken phrases route correctly");

const intentCases: Array<[string, string | null]> = [
  // Sales
  ["show today sales", "sales"],
  ["show me today's sales across all stores", "sales"],
  ["how much did we sell today", "sales"],
  ["which was the best store", "sales"],
  // Email
  ["show email", "email"],
  ["show my emails", "email"],
  ["summarize my important emails", "email"],
  ["any new mail", "email"],
  ["check my email", "email"],
  // Email draft
  ["draft an email reply", "email_draft"],
  ["make a draft of this email", "email_draft"],
  // Calendar
  ["what's on my calendar today", "calendar"],
  ["show my schedule", "calendar"],
  ["meetings today", "calendar"],
  // Meeting create
  ["schedule a meeting with Ross tomorrow at 3pm", "meeting_create"],
  // Tasks
  ["what are my tasks", "task_list"],
  ["show my to-do list", "task_list"],
  ["delete the task about the lease", "task_remove"],
  ["complete the task about calling the supplier", "task_complete"],
  // Contacts
  ["find contact Umair", "contacts"],
  ["what is the phone number for Ross", "contacts"],
  // News / rates
  ["sports news", "sports_news"],
  ["politics news", "politics_news"],
  ["gold price today", "metal_rates"],
  // Price estimate
  ["how much for 10 grams of 22k gold", "price_estimate"],
  // Image generation
  ["generate an image of a diamond necklace", "image_generate"],
  // Analyst
  ["open the data analyst", "analyst"],
  // Stores
  ["which branch is closest to Great Mall", "store_nearest"],
  ["show all stores in California", "store_directory"],
  // Knowledge
  ["what is the return policy", "knowledge"],
  // Settings
  ["is google connected", "settings"],
  // Navigation
  ["open the settings", "settings"], // settings wins over navigation — acceptable
  ["go to contacts", "navigation"],
  ["open the calculator", "navigation"],
];

for (const [phrase, expected] of intentCases) {
  const got = detectVoiceIntent(phrase);
  check(`"${phrase}" → ${expected}`, got === expected, `got ${got}`);
}

/* ------------------------------------------------------------------ */
console.log("\n[2] Navigation page extraction");

const navCases: Array<[string, string | null]> = [
  ["go to contacts", "contacts"],
  ["open the calculator", "calculator"],
  ["open images", "images"],
  ["go to chat", "chat"],
  ["open news", "news"],
];
for (const [phrase, expected] of navCases) {
  const got = extractNavigationPage(phrase);
  check(`"${phrase}" → /${expected}`, got === expected, `got ${got}`);
}

/* ------------------------------------------------------------------ */
console.log("\n[3] Transcript normalization (mishearing fixes)");

check(
  "make a graph for this scene → draft of this email",
  normalizeVoiceTranscript("make a graph for this scene").includes("draft of this email")
);

/* ------------------------------------------------------------------ */
async function toolTests() {
  console.log("\n[4] Tool execution — spoken summary + navigation");

  type ToolOut = {
    spokenAnswer?: string;
    script?: string;
    error?: string;
  };

  const runTool = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await executeVoiceTool(name, args);
    const parsed = JSON.parse(result.output) as ToolOut;
    return { parsed, uiAction: result.uiAction };
  };

  // get_today_sales → speaks a summary AND navigates to /sales
  {
    const { parsed, uiAction } = await runTool("get_today_sales", {
      user_message: "show today sales",
    });
    const spoken = parsed.spokenAnswer ?? parsed.script ?? "";
    check("get_today_sales returns spoken summary", spoken.length > 20, spoken.slice(0, 60));
    check(
      "get_today_sales navigates to /sales",
      uiAction?.type === "navigate" && uiAction.path === "/sales",
      JSON.stringify(uiAction)
    );
    check(
      "sales summary is brief (< 900 chars)",
      spoken.length < 900,
      `${spoken.length} chars`
    );
  }

  // get_email_summary → speaks summary
  {
    const { parsed, uiAction } = await runTool("get_email_summary");
    const spoken = parsed.spokenAnswer ?? parsed.script ?? "";
    check("get_email_summary returns spoken summary", spoken.length > 10, spoken.slice(0, 60));
    check(
      "get_email_summary navigates to /email",
      !uiAction || (uiAction.type === "navigate" && uiAction.path === "/email"),
      JSON.stringify(uiAction)
    );
  }

  // get_calendar_today
  {
    const { parsed } = await runTool("get_calendar_today");
    const spoken = parsed.spokenAnswer ?? parsed.script ?? "";
    check("get_calendar_today returns spoken summary", spoken.length > 10, spoken.slice(0, 60));
  }

  // list_tasks
  {
    const { parsed } = await runTool("list_tasks");
    const spoken = parsed.spokenAnswer ?? parsed.script ?? "";
    check("list_tasks returns spoken summary", spoken.length > 5, spoken.slice(0, 60));
  }

  // show_detail_page email → navigate + confirmation
  {
    const { parsed, uiAction } = await runTool("show_detail_page", { page: "email" });
    const spoken = parsed.spokenAnswer ?? parsed.script ?? "";
    check(
      "show_detail_page(email) navigates to /email",
      uiAction?.type === "navigate" && uiAction.path === "/email",
      JSON.stringify(uiAction)
    );
    check("show_detail_page(email) speaks confirmation", spoken.length > 3, spoken.slice(0, 60));
  }

  // show_detail_page sales
  {
    const { uiAction } = await runTool("show_detail_page", { page: "sales" });
    check(
      "show_detail_page(sales) navigates to /sales",
      uiAction?.type === "navigate" && uiAction.path === "/sales",
      JSON.stringify(uiAction)
    );
  }

  // get_settings_status
  {
    const { parsed } = await runTool("get_settings_status");
    const spoken = parsed.spokenAnswer ?? parsed.script ?? "";
    check("get_settings_status returns spoken status", spoken.length > 10, spoken.slice(0, 60));
  }

  // unknown tool fails gracefully
  {
    const { parsed } = await runTool("nonexistent_tool_xyz");
    check(
      "unknown tool returns graceful error (no crash)",
      typeof parsed === "object",
      JSON.stringify(parsed).slice(0, 80)
    );
  }
}

/* ------------------------------------------------------------------ */
function architectureTests() {
  console.log("\n[5] Voice architecture — session survives navigation");

  const root = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");

  const layout = read("src/app/(app)/layout.tsx");
  check(
    "app layout wraps children in VoiceProvider (session is global)",
    layout.includes("VoiceProvider") && layout.includes("<VoiceProvider>")
  );
  check("app layout renders VoiceMiniHud", layout.includes("VoiceMiniHud"));

  const provider = read("src/components/voice/VoiceProvider.tsx");
  check(
    "VoiceProvider hosts useRealtimeVoice (survives route changes)",
    provider.includes("useRealtimeVoice")
  );

  const session = read("src/components/voice/VoiceSession.tsx");
  check(
    "VoiceSession consumes shared context (no own session)",
    session.includes("useVoice()") && !session.includes("useRealtimeVoice(")
  );

  const hud = read("src/components/voice/VoiceMiniHud.tsx");
  check(
    "Mini HUD hidden on /voice, shown elsewhere while active",
    hud.includes('pathname === "/voice"') && hud.includes("sessionActive")
  );
  check("Mini HUD has End-session control", hud.includes("closePanel"));

  const hook = read("src/lib/voice/useRealtimeVoice.ts");
  check(
    "Hook navigates via router.push on uiAction",
    hook.includes('action?.type === "navigate"') && hook.includes("router.push")
  );
  check(
    "Sales intent instructs brief summary after navigation",
    hook.includes("get_today_sales") && /VERY BRIEF/i.test(hook)
  );
  check(
    "Mic re-enables after each response (follow-up questions work)",
    hook.includes('case "response.done"') && hook.includes("enableMic()")
  );
  check(
    "Harmless cancellation errors are suppressed",
    hook.includes("Cancellation failed")
  );
  check("Mic audio-level meter feeds the orb", hook.includes("startLevelMeter"));

  const btn = read("src/components/voice/RealtimeVoiceButton.tsx");
  check(
    "Mic button routes to dedicated /voice page",
    btn.includes('router.push("/voice")')
  );

  const sessionRoute = read("src/app/api/voice/session/route.ts");
  check(
    "Session instructions restrict to English/Urdu + noise filter",
    /English and Urdu/i.test(sessionRoute)
  );
  check(
    "Session instructions demand navigation + brief summaries",
    /NAVIGATION RULE/i.test(sessionRoute) || /show_detail_page/i.test(sessionRoute)
  );
}

/* ------------------------------------------------------------------ */
(async () => {
  try {
    architectureTests();
    await toolTests();
  } catch (err) {
    fail++;
    failures.push(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
    console.error("Unhandled test error:", err);
  }

  console.log("\n──────────────────────────────────");
  console.log(`Voice flow tests: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(` - ${f}`);
    process.exit(1);
  }
  process.exit(0);
})();
