import { NextRequest, NextResponse } from "next/server";

import { v4 as uuidv4 } from "uuid";

import { getState, setState } from "@/lib/store/server-store";

import { getEnrichedState, applyGoogleCacheToState, getIntegrationsMeta } from "@/lib/google/sync";

import {

  processMessage,

  executeSideEffects,

  shouldUseRuleEngine,

} from "@/lib/ai/assistant-engine";

import { isLLMChatConfigured, processMessageWithLLM } from "@/lib/ai/llm-chat";

import type { AIResponse, ChatMessage } from "@/types";



export const runtime = "nodejs";



async function resolveResponse(message: string, state: Awaited<ReturnType<typeof getEnrichedState>>): Promise<AIResponse> {

  if (shouldUseRuleEngine(message)) {

    return processMessage(message, state);

  }



  if (isLLMChatConfigured()) {

    try {

      return await processMessageWithLLM(message, state);

    } catch (err) {

      console.error("LLM chat failed, falling back to rule engine:", err);

      return processMessage(message, state);

    }

  }



  return processMessage(message, state);

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



  const response = await resolveResponse(trimmed, state);

  const sideEffects = executeSideEffects(response, state);



  const assistantMessage: ChatMessage = {

    id: uuidv4(),

    role: "assistant",

    content: response.message,

    timestamp: new Date().toISOString(),

    pendingAction: response.pendingAction,

  };



  setState((s) => ({

    ...s,

    ...sideEffects,

    chatHistory: [...s.chatHistory, userMessage, assistantMessage],

  }));



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

    engine: isLLMChatConfigured() && !shouldUseRuleEngine(trimmed) ? "llm" : "rules",

  });

}



export async function GET() {

  const state = await getEnrichedState();

  return NextResponse.json({ history: state.chatHistory });

}

