import { describe, expect, it } from "vitest";
import { normalizeAlexaInput } from "@/lib/alexa/input-normalizer";
import { resolveEntitiesFromText, resolveSingleAlias } from "@/lib/alexa/entity-resolver";
import { resolveAlexaIntent } from "@/lib/alexa/intent-resolver";
import { selectRelevantTools, pickPrimaryTool } from "@/lib/alexa/tool-selector";
import { evaluateActionPolicy } from "@/lib/alexa/policy-engine";
import { resolveNavigation } from "@/lib/alexa/navigation-resolver";
import { isLiveDataIntent, assertRagAllowed } from "@/lib/alexa/rag-guard";
import { getCanonicalTool, TOOL_REGISTRY } from "@/lib/tools/canonical-registry";
import { claimIdempotencyKey, rememberIdempotencyResult } from "@/lib/tools/idempotency";
import { detectLimitedVoiceFastPath, detectVoiceIntent } from "@/lib/voice/intent";
import { applyIntentToMemory, getAlexaWorkingMemory } from "@/lib/alexa/structured-memory";
import type { AlexaIntent } from "@/lib/alexa/types";
import { unknownIntent } from "@/lib/alexa/types";

describe("input-normalizer", () => {
  it("normalizes roman urdu sales request", () => {
    const r = normalizeAlexaInput({
      channel: "voice",
      message: "Alexa umm kal wali novelo ki sales store wise dikha do please",
    });
    expect(r.normalized.toLowerCase()).toContain("novello");
    expect(r.normalized.toLowerCase()).toMatch(/yesterday|kal/);
    expect(r.normalized.toLowerCase()).toMatch(/show|by store/);
  });

  it("normalizes meeting request with ross alias", () => {
    const r = normalizeAlexaInput({
      channel: "chat",
      message: "ross ko kal do baje meeting laga do",
    });
    expect(r.normalized.toLowerCase()).toContain("ross");
    expect(r.normalized.toLowerCase()).toMatch(/schedule|meeting/);
  });
});

describe("entity-resolver", () => {
  it("resolves novelo and gray mall", () => {
    const ents = resolveEntitiesFromText("Show novelo sales at gray mall");
    const designs = ents.filter((e) => e.type === "design");
    const stores = ents.filter((e) => e.type === "store");
    expect(designs[0]?.resolvedValue).toBe("NOVELLO");
    expect(stores[0]?.resolvedValue).toBe("Great Mall");
  });

  it("resolves ovanny → OVANI", () => {
    expect(resolveSingleAlias("ovanny", "design")?.resolvedValue).toBe("OVANI");
  });
});

describe("intent-resolver", () => {
  it("detects sales query with design and yesterday", async () => {
    const intent = await resolveAlexaIntent({
      normalizedMessage: "Show NOVELLO sales for yesterday grouped by store",
      memory: { conversationId: "t1", updatedAt: new Date().toISOString() },
    });
    expect(intent.domain).toBe("sales");
    expect(intent.requiresTool).toBe(true);
    expect(intent.entities.designs).toContain("NOVELLO");
  });

  it("asks for time on calendar create without clock", async () => {
    const intent = await resolveAlexaIntent({
      normalizedMessage: "Schedule a meeting with Ross tomorrow",
      memory: { conversationId: "t2", updatedAt: new Date().toISOString() },
    });
    expect(intent.domain).toBe("calendar");
    expect(intent.requiresClarification).toBe(true);
    expect(intent.missingFields).toContain("time");
  });
});

describe("tool-selector", () => {
  it("selects sales tools for sales intent", () => {
    const intent = unknownIntent({
      domain: "sales",
      action: "query",
      requiresTool: true,
      confidence: 0.95,
    });
    const tools = selectRelevantTools({ intent });
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.length).toBeLessThanOrEqual(8);
    expect(tools.some((t) => t.name === "query_sales")).toBe(true);
    expect(pickPrimaryTool(intent)).toBe("query_sales");
  });

  it("selects knowledge tool for privacy", () => {
    const intent = unknownIntent({
      domain: "knowledge",
      action: "query",
      requiresTool: true,
      confidence: 0.95,
    });
    expect(pickPrimaryTool(intent)).toBe("search_company_knowledge");
  });
});

describe("policy-engine", () => {
  it("requires confirmation for destructive tools", () => {
    const tool = getCanonicalTool("delete_all_meetings");
    expect(tool).toBeTruthy();
    const policy = evaluateActionPolicy({
      intent: unknownIntent({ domain: "calendar", action: "delete" }),
      tool: tool!,
      channel: "chat",
    });
    expect(policy.requiresConfirmation).toBe(true);
  });

  it("allows read tools without confirmation", () => {
    const tool = getCanonicalTool("query_sales");
    const policy = evaluateActionPolicy({
      intent: unknownIntent({ domain: "sales", action: "query" }),
      tool: tool!,
      channel: "voice",
    });
    expect(policy.requiresConfirmation).toBe(false);
    expect(policy.allowed).toBe(true);
  });
});

describe("navigation-resolver", () => {
  it("does not navigate for tell-only sales", () => {
    const intent: AlexaIntent = unknownIntent({
      domain: "sales",
      action: "query",
      displayIntent: "tell",
      requestedNavigation: false,
      entities: { designs: ["NOVELLO"] },
    });
    const nav = resolveNavigation({ intent, channel: "chat" });
    expect(nav.type).toBe("none");
  });

  it("navigates for open sales", () => {
    const intent: AlexaIntent = unknownIntent({
      domain: "sales",
      action: "navigate",
      displayIntent: "open",
      requestedNavigation: true,
      entities: { section: "sales" },
    });
    const nav = resolveNavigation({ intent, channel: "chat" });
    expect(nav.type).not.toBe("none");
    expect(nav.route).toBe("/sales");
  });
});

describe("rag-guard", () => {
  it("blocks RAG for live sales", () => {
    const intent = unknownIntent({ domain: "sales", action: "query", requiresTool: true });
    expect(isLiveDataIntent(intent)).toBe(true);
    expect(assertRagAllowed(intent).allowed).toBe(false);
  });

  it("allows RAG for knowledge", () => {
    const intent = unknownIntent({ domain: "knowledge", action: "query", requiresTool: true });
    expect(assertRagAllowed(intent).allowed).toBe(true);
  });
});

describe("canonical-registry", () => {
  it("exposes registry tools from metadata", () => {
    expect(Object.keys(TOOL_REGISTRY).length).toBeGreaterThan(20);
    expect(TOOL_REGISTRY.query_sales?.risk).toBe("read");
  });
});

describe("idempotency", () => {
  it("returns existing result for duplicate key", () => {
    const key = `test-${Date.now()}`;
    expect(claimIdempotencyKey(key).ok).toBe(true);
    rememberIdempotencyResult(key, { ok: true, status: "success", tool: "x" });
    const second = claimIdempotencyKey(key);
    expect(second.ok).toBe(false);
    expect(second.existing).toMatchObject({ tool: "x" });
  });
});

describe("voice fast-path limited", () => {
  it("allows open sales", () => {
    expect(detectLimitedVoiceFastPath("open sales")).toBe("navigation");
  });

  it("blocks complex sales from limited path", () => {
    expect(detectLimitedVoiceFastPath("Show Novello sales yesterday by department")).toBeNull();
  });

  it("respects env limited flag", () => {
    const prev = process.env.ALEXA_LIMITED_VOICE_FASTPATH;
    process.env.ALEXA_LIMITED_VOICE_FASTPATH = "true";
    expect(detectVoiceIntent("Show Novello sales yesterday")).toBeNull();
    expect(detectVoiceIntent("open calendar")).toBe("navigation");
    process.env.ALEXA_LIMITED_VOICE_FASTPATH = prev;
  });
});

describe("follow-up memory", () => {
  it("retains design and date when grouping changes", async () => {
    process.env.ALEXA_STRUCTURED_MEMORY = "true";
    const conversationId = `mem-${Date.now()}`;
    const turn1 = await resolveAlexaIntent({
      normalizedMessage: "Show NOVELLO sales yesterday",
      memory: { conversationId, updatedAt: new Date().toISOString() },
    });
    applyIntentToMemory(conversationId, turn1, "query_sales");
    const mem = getAlexaWorkingMemory(conversationId);
    expect(mem.salesContext?.designs).toContain("NOVELLO");

    const turn2 = await resolveAlexaIntent({
      normalizedMessage: "Now by department",
      memory: mem,
    });
    expect(turn2.domain).toBe("sales");
    expect(turn2.groupBy).toContain("department");
    expect(turn2.entities.designs).toContain("NOVELLO");
  });
});
