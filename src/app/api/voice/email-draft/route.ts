import { NextRequest, NextResponse } from "next/server";
import { isComposeEmailToPerson } from "@/lib/ai/email-compose";
import {
  buildVoiceComposeEmail,
  buildVoiceEmailDraft,
} from "@/lib/voice/email-data";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let userMessage = "";
    try {
      const body = await req.json();
      userMessage = typeof body?.user_message === "string" ? body.user_message : "";
    } catch {
      // empty body = legacy reply draft
    }

    if (userMessage && isComposeEmailToPerson(userMessage)) {
      const composed = await buildVoiceComposeEmail({
        userMessage,
        source: "voice",
      });
      return NextResponse.json({
        script: composed.script,
        hasDraft: composed.success,
        compose: composed.compose,
        navigateTo: composed.success ? "/email" : undefined,
      });
    }

    const draft = await buildVoiceEmailDraft({
      userMessage: userMessage || undefined,
      source: "voice",
    });
    return NextResponse.json({
      script: draft.script,
      targetEmail: draft.targetEmail,
      hasDraft: Boolean(draft.targetEmail),
      navigateTo: draft.targetEmail ? "/chat" : undefined,
    });
  } catch (err) {
    console.error("Voice email draft error:", err);
    return NextResponse.json(
      {
        script:
          "I couldn't draft that email right now. Try opening AI Chat and asking again.",
      },
      { status: 500 }
    );
  }
}
