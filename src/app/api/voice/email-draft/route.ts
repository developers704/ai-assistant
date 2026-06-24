import { NextResponse } from "next/server";
import {
  buildVoiceEmailDraft,
  saveVoiceEmailDraftPending,
} from "@/lib/voice/email-data";

export const runtime = "nodejs";

export async function POST() {
  try {
    const draft = await buildVoiceEmailDraft();
    if (draft.targetEmail) {
      saveVoiceEmailDraftPending(draft);
    }
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
