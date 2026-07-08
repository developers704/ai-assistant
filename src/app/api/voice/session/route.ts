import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  isVoicePilotConfigured,
  VOICE_REALTIME_MODEL_FALLBACKS,
} from "@/lib/voice/config";
import { buildDynamicContext } from "@/lib/ai/dynamic-context";
import { getState } from "@/lib/store/server-store";
import { loadVoiceInstructions } from "@/lib/prompts/loader";
import { getVoiceOpenAITools } from "@/lib/tools/registry";

export const runtime = "nodejs";

async function buildSessionConfig(model: string) {
  const state = getState();
  const dynamic = await buildDynamicContext(state);
  const liveContext = dynamic.textBlock;
  const instructions = `CRITICAL LANGUAGE & NOISE RULE: You must ONLY understand, transcribe, and respond in English and Urdu. Ignore background noise, static, breathing, or silence completely. Never transcribe them as words (especially not as Chinese, Portuguese, or other languages). If there is no clear human speech in English or Urdu, ignore the sound and do not respond.\n\n${loadVoiceInstructions()}\n\n---\nLIVE CONTEXT (authoritative for this session):\n${liveContext}`;
  return {
    type: "realtime" as const,
    model,
    instructions,
    max_output_tokens: 350,
    tool_choice: "auto" as const,
    audio: {
      input: {
        turn_detection: {
          type: "server_vad" as const,
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 900,
          create_response: false,
        },
        transcription: { model: "gpt-4o-mini-transcribe" },
      },
      output: { voice: "marin" },
    },
    tools: [...getVoiceOpenAITools()],
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
