import { NextRequest, NextResponse } from "next/server";

import { v4 as uuidv4 } from "uuid";

import { getState, setState, clearChatHistory } from "@/lib/store/server-store";

import { getEnrichedState, applyGoogleCacheToState, getIntegrationsMeta } from "@/lib/google/sync";

import {

  processMessage,

  executeSideEffects,

  shouldUseRuleEngine,

} from "@/lib/ai/assistant-engine";

import { isLLMChatConfigured, processMessageWithLLM } from "@/lib/ai/llm-chat";
import { isImageGenerateRequest } from "@/lib/images/generate-jewellery-image";
import { processImageGenerate } from "@/lib/ai/image-generate";

import { tryRoutedResponse } from "@/lib/ai/routed-handler";
import { appendConversationSummary } from "@/lib/memory/store";
import type { AIResponse, ChatMessage } from "@/types";



export const runtime = "nodejs";
export const maxDuration = 120;



async function resolveResponse(
  message: string,
  state: Awaited<ReturnType<typeof getEnrichedState>>
): Promise<{ response: AIResponse; engine: "rules" | "llm" | "llm-fallback" | "router" }> {
  const routed = await tryRoutedResponse(message, state);
  if (routed) {
    return { response: routed, engine: "router" };
  }

  if (isImageGenerateRequest(message)) {
    return { response: await processImageGenerate(message), engine: "rules" };
  }

  if (shouldUseRuleEngine(message)) {
    return { response: processMessage(message, state), engine: "rules" };
  }

  if (isLLMChatConfigured()) {
    try {
      return {
        response: await processMessageWithLLM(message, state),
        engine: "llm",
      };
    } catch (err) {
      console.error("LLM chat failed, falling back to rule engine:", err);
      return {
        response: processMessage(message, state),
        engine: "llm-fallback",
      };
    }
  }

  return { response: processMessage(message, state), engine: "rules" };
}



export async function POST(req: NextRequest) {

  const { message } = await req.json();

  if (!message?.trim()) {

    return NextResponse.json({ error: "Message required" }, { status: 400 });

  }



  const trimmed = message.trim();

  const state = await getEnrichedState();



  const userMessage: ChatMessage = {

    id: uuidv4(),

    role: "user",

    content: trimmed,

    timestamp: new Date().toISOString(),

  };



  const { response, engine } = await resolveResponse(trimmed, state);

  const sideEffects = executeSideEffects(response, state);



  const assistantMessage: ChatMessage = {
    id: uuidv4(),
    role: "assistant",
    content: response.message,
    timestamp: new Date().toISOString(),
    pendingAction: response.pendingAction,
    imageUrl:
      typeof response.data?.generatedImage === "string"
        ? response.data.generatedImage
        : undefined,
  };



  setState((s) => ({
    ...s,
    ...sideEffects,
    chatHistory: [...s.chatHistory, userMessage, assistantMessage],
  }));

  const turnCount = getState().chatHistory.length;
  if (turnCount > 0 && turnCount % 15 === 0) {
    const recent = getState()
      .chatHistory.slice(-6)
      .map((m) => `${m.role}: ${m.content.slice(0, 120)}`)
      .join(" | ");
    appendConversationSummary(recent);
  }



  const cached = applyGoogleCacheToState(getState());
  const meta = getIntegrationsMeta();
  const finalState = {
    ...cached,
    integrations: {
      ...meta,
      google: cached.integrations?.google ?? meta!.google,
    },
  };



  return NextResponse.json({

    message: assistantMessage,

    state: finalState,

    speak: response.speak,

    engine,

  });

}



export async function GET() {

  const state = await getEnrichedState();

  return NextResponse.json({ history: state.chatHistory });

}



export async function DELETE() {

  clearChatHistory();

  return NextResponse.json({ ok: true });

}

