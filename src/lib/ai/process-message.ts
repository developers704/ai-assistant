import type { AIResponse, AppState } from "@/types";
import { resolveFollowUp } from "@/lib/ai/follow-up-resolver";
import { tryAppIntelligence } from "@/lib/ai/app-intelligence";
import { tryRoutedResponse } from "@/lib/ai/routed-handler";
import { syncWorkingMemoryFromState } from "@/lib/memory/working-memory";
import {
  formatResponseForChannel,
  type AlexaChannel,
} from "@/lib/ai/response-synthesizer";

export type { AlexaChannel };

/**
 * Unified Alexa intelligence pipeline for Chat and Voice.
 * Order: working memory sync → follow-ups → section intelligence → tool routing.
 */
export async function processAlexaMessage(
  message: string,
  state: AppState,
  channel: AlexaChannel = "chat"
): Promise<AIResponse | null> {
  syncWorkingMemoryFromState(state);

  const followUp = await resolveFollowUp(message, state, channel);
  if (followUp) return followUp;

  const appIntel = await tryAppIntelligence(message, state);
  if (appIntel) return formatResponseForChannel(appIntel, channel);

  const routed = await tryRoutedResponse(message, state, channel);
  if (routed) return formatResponseForChannel(routed, channel);

  return null;
}
