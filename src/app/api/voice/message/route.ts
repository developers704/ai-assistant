import { NextResponse } from "next/server";
import { getEnrichedState } from "@/lib/google/sync";
import { processAlexaMessage } from "@/lib/ai/process-message";

export const runtime = "nodejs";

/** Voice text turn — same intelligence pipeline as AI Chat. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message = String((body as { message?: string }).message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const state = await getEnrichedState();
  const response = await processAlexaMessage(message, state, "voice");

  if (!response) {
    return NextResponse.json({
      script: "I didn't catch that. Try asking about sales, email, calendar, or news.",
      spokenAnswer: "I didn't catch that. Try asking about sales, email, calendar, or news.",
    });
  }

  const navigateTo =
    response.data && typeof response.data.navigate === "string"
      ? response.data.navigate
      : undefined;

  return NextResponse.json({
    script: response.message,
    spokenAnswer: response.message,
    intent: response.intent,
    navigateTo,
    pendingAction: response.pendingAction,
  });
}
