import type { AlexaIntent } from "@/lib/alexa/types";

const LIVE_DOMAINS = new Set([
  "sales",
  "email",
  "calendar",
  "tasks",
  "social",
  "calculator",
  "stores",
  "news",
]);

/** True when the question needs live tools — RAG must not answer. */
export function isLiveDataIntent(intent: AlexaIntent): boolean {
  if (LIVE_DOMAINS.has(intent.domain)) return true;
  if (intent.requiresTool && intent.domain !== "knowledge") return true;
  return false;
}

/** True when company knowledge / RAG is appropriate. */
export function isKnowledgeIntent(intent: AlexaIntent): boolean {
  return intent.domain === "knowledge" && !isLiveDataIntent({ ...intent, domain: "sales" });
}

export function assertRagAllowed(intent: AlexaIntent): {
  allowed: boolean;
  reason?: string;
} {
  if (isLiveDataIntent(intent) && intent.domain !== "knowledge") {
    return {
      allowed: false,
      reason: "Live data intents must use tools, not RAG",
    };
  }
  return { allowed: true };
}
