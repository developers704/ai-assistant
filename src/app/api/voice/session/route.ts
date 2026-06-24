import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  isVoicePilotConfigured,
  VOICE_PILOT_INSTRUCTIONS,
  VOICE_PILOT_TOOLS,
  VOICE_REALTIME_MODEL_FALLBACKS,
} from "@/lib/voice/config";

import { buildVoiceLiveContext } from "@/lib/voice/context";

export const runtime = "nodejs";

async function buildSessionConfig(model: string) {
  const liveContext = await buildVoiceLiveContext();
  return {
    type: "realtime" as const,
    model,
    instructions: `${VOICE_PILOT_INSTRUCTIONS}\n\n---\nLIVE CONTEXT (authoritative for this session):\n${liveContext}`,
    max_output_tokens: 350,
    tool_choice: "auto" as const,
    audio: {
      input: {
        turn_detection: null,
        transcription: { model: "gpt-4o-mini-transcribe" },
      },
      output: { voice: "marin" },
    },
    tools: [...VOICE_PILOT_TOOLS],
  };
}

export async function POST() {
  if (!isVoicePilotConfigured()) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured." },
      { status: 503 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const errors: string[] = [];

  for (const model of VOICE_REALTIME_MODEL_FALLBACKS) {
    try {
      const secret = await openai.realtime.clientSecrets.create({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: await buildSessionConfig(model),
      });

      return NextResponse.json({
        clientSecret: secret.value,
        expiresAt: secret.expires_at,
        model,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Voice session failed for model ${model}:`, message);
      errors.push(`${model}: ${message}`);
    }
  }

  return NextResponse.json(
    {
      error:
        "No Realtime voice model is available on your OpenAI account. Add credits at platform.openai.com and ensure Realtime API access. " +
        `Tried: ${VOICE_REALTIME_MODEL_FALLBACKS.join(", ")}`,
      details: errors,
    },
    { status: 502 }
  );
}
