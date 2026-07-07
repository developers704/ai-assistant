/**
 * Quick acceptance checks for Alexa intelligence (run: npx tsx scripts/test-alexa-intelligence.ts)
 */
import { processAlexaMessage } from "../src/lib/ai/process-message";
import { getState, setState } from "../src/lib/store/server-store";
import { updateUiContext } from "../src/lib/store/ui-context";
import { clearPendingActions } from "../src/lib/actions/confirmation";

async function ask(label: string, message: string) {
  const state = getState();
  const res = await processAlexaMessage(message, state);
  console.log(`\n--- ${label} ---`);
  console.log(`Q: ${message}`);
  console.log(`A: ${res?.message?.slice(0, 280) ?? "(null)"}`);
  if (res?.data?.navigate) console.log(`nav: ${res.data.navigate}`);
  if (res?.pendingAction) console.log(`pending: ${res.pendingAction.type} / ${res.pendingAction.toolName}`);
  return res;
}

async function main() {
  clearPendingActions();
  updateUiContext({ currentPath: "/chat" });

  const calendarRes = await ask(
    "0 calendar today",
    "What's on my calendar today?"
  );
  if (calendarRes?.pendingAction) {
    console.error("FAIL: calendar query should not require confirmation");
    process.exitCode = 1;
  }
  if (!calendarRes?.message || /Confirmation required|Say \*\*yes\*\*/i.test(calendarRes.message)) {
    console.error("FAIL: calendar query should return schedule in chat");
    process.exitCode = 1;
  }

  await ask("1 top store", "show me best store with sales");
  await ask("2 one top store", "i want to see one store with top sales");
  await ask("3 email ross", "send an email to Ross");
  await ask("4 meeting ross", "set meeting with Ross tomorrow");
  await ask("5 news market", "what's about news and market?");

  const newsRes = await ask("5b news market", "what's about news and market?");
  if (newsRes) {
    await ask("6 yes open", "yes pls open");
  }

  clearPendingActions();
  await ask("7 delete all", "delete all meetings");
  await ask("8 confirm delete", "yes please remove all");

  clearPendingActions();
  const emails = getState().emails;
  if (emails[0]) {
    updateUiContext({ currentPath: "/email", selectedEmailId: emails[0].id });
    await ask("9 reply politely", "reply politely");
  }

  clearPendingActions();
  updateUiContext({ currentPath: "/sales", selectedEmailId: undefined });
  await ask("10 explain sales", "explain this");
}

main().catch(console.error);
