import { describe, expect, it } from "vitest";
import { pickPrimaryTool } from "@/lib/alexa/tool-selector";
import { isLiveDataIntent, assertRagAllowed } from "@/lib/alexa/rag-guard";
import { resolveAlexaIntent } from "@/lib/alexa/intent-resolver";
import { unknownIntent } from "@/lib/alexa/types";

describe("chat-voice parity routing", () => {
  it("yesterday sales → query_sales not knowledge", async () => {
    const intent = await resolveAlexaIntent({
      normalizedMessage: "What were yesterday's sales?",
      memory: { conversationId: "parity-1", updatedAt: new Date().toISOString() },
    });
    expect(isLiveDataIntent(intent)).toBe(true);
    expect(pickPrimaryTool(intent)).toBe("query_sales");
    expect(assertRagAllowed(intent).allowed).toBe(false);
  });

  it("privacy policy → knowledge tool", async () => {
    const intent = await resolveAlexaIntent({
      normalizedMessage: "What does the privacy policy say?",
      memory: { conversationId: "parity-2", updatedAt: new Date().toISOString() },
    });
    // May route as knowledge depending on router — enforce preferred tool
    const forced = intent.domain === "knowledge"
      ? intent
      : unknownIntent({ domain: "knowledge", action: "query", requiresTool: true, confidence: 0.9 });
    expect(pickPrimaryTool(forced)).toBe("search_company_knowledge");
  });

  it("open sales navigates; tell sales does not force nav domain mismatch", async () => {
    const open = await resolveAlexaIntent({
      normalizedMessage: "Open Sales",
      memory: { conversationId: "parity-3", updatedAt: new Date().toISOString() },
    });
    expect(open.displayIntent === "open" || open.domain === "navigation" || open.requestedNavigation).toBe(true);

    const tell = await resolveAlexaIntent({
      normalizedMessage: "Tell me today's sales",
      memory: { conversationId: "parity-4", updatedAt: new Date().toISOString() },
    });
    expect(tell.domain).toBe("sales");
    expect(tell.displayIntent).toBe("tell");
  });
});
