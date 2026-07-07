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
  if (res) {
    setState((s) => ({
      ...s,
      chatHistory: [
        ...s.chatHistory,
        {
          id: `user-${label}`,
          role: "user" as const,
          content: message,
          timestamp: new Date().toISOString(),
        },
        {
          id: `assistant-${label}`,
          role: "assistant" as const,
          content: res.message,
          timestamp: new Date().toISOString(),
          pendingAction: res.pendingAction,
        },
      ],
    }));
  }
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

  const salesRes = await ask("0b top store", "Which store is best?");
  if (salesRes?.pendingAction) {
    console.error("FAIL: sales query should not require confirmation");
    process.exitCode = 1;
  }
  if (!salesRes?.message?.includes("DBC-GM")) {
    console.error("FAIL: sales query should return top store data in chat");
    process.exitCode = 1;
  }

  const yesBreakdown = await ask("0c yes breakdown", "yes");
  if (!yesBreakdown?.message?.includes("Top stores") && !yesBreakdown?.message?.includes("Sales Summary")) {
    console.error("FAIL: yes after top store should return full sales breakdown");
    process.exitCode = 1;
  }
  if (/What should I confirm/i.test(yesBreakdown?.message ?? "")) {
    console.error("FAIL: yes should not ask generic confirm after sales offer");
    process.exitCode = 1;
  }

  await ask("1 top store", "show me best store with sales");
  await ask("2 one top store", "i want to see one store with top sales");
  await ask("3 email ross", "send an email to Ross");
  await ask("4 meeting ross", "set meeting with Ross tomorrow");
  await ask("5 news market", "what's about news and market?");
  const newsRes = await ask("5b news market", "what's about news and market?");
  if (newsRes?.pendingAction) {
    console.error("FAIL: news query should not require confirmation");
    process.exitCode = 1;
  }

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
