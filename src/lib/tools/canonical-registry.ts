import type { z } from "zod";
import type { AlexaChannel, AlexaDomain, AlexaRiskLevel, AlexaToolExecutionContext, AlexaToolResult } from "@/lib/alexa/types";
import { TOOL_DEFINITIONS, TOOL_BY_NAME } from "@/lib/tools/metadata";
import type { ToolDefinition } from "@/lib/tools/types";
import { executeAppTool } from "@/lib/tools/execute-app-tool";

export interface AlexaToolDefinition {
  name: string;
  description: string;
  category: AlexaDomain;
  sectionId?: string;
  channels: AlexaChannel[];
  risk: AlexaRiskLevel;
  /** OpenAI JSON schema parameters (canonical for chat + voice). */
  parameters: Record<string, unknown>;
  /** Optional Zod schema when available — many tools still use JSON schema only. */
  inputSchema?: z.ZodTypeAny;
  timeoutMs: number;
  retryCount: number;
  retryable: boolean;
  confirmationRequired: boolean;
  whenToUse: string;
  whenNotToUse: string;
  examplePhrases: string[];
  execute: (
    args: unknown,
    context: AlexaToolExecutionContext
  ) => Promise<AlexaToolResult>;
}

function mapRisk(def: ToolDefinition): AlexaRiskLevel {
  if (def.riskLevel === "dangerous") return "destructive";
  if (def.requiresConfirmation || def.riskLevel === "confirmation_required") return "write";
  if (def.name.startsWith("draft_") || def.name.startsWith("propose_")) return "draft";
  return "read";
}

function mapCategory(cat: ToolDefinition["category"]): AlexaDomain {
  return cat as AlexaDomain;
}

function toAlexaTool(def: ToolDefinition): AlexaToolDefinition {
  const risk = mapRisk(def);
  const channels: AlexaChannel[] = [];
  if (def.allowedInChat) channels.push("chat");
  if (def.allowedInVoice) channels.push("voice");
  if (!channels.includes("analyst") && def.category === "sales") channels.push("analyst");

  return {
    name: def.name,
    description: def.description,
    category: mapCategory(def.category),
    sectionId: def.opensPage?.replace(/^\//, "") || undefined,
    channels,
    risk,
    parameters: def.parameters,
    timeoutMs: risk === "read" ? 10_000 : 15_000,
    retryCount: risk === "read" ? 1 : 0,
    retryable: risk === "read",
    confirmationRequired: def.requiresConfirmation,
    whenToUse: def.whenToUse,
    whenNotToUse: def.whenNotToUse,
    examplePhrases: def.examplePhrases,
    execute: (args, ctx) => executeAppTool(def.name, args, ctx),
  };
}

/** Canonical registry built from existing TOOL_DEFINITIONS (single source). */
export const TOOL_REGISTRY: Record<string, AlexaToolDefinition> = Object.fromEntries(
  TOOL_DEFINITIONS.map((d) => [d.name, toAlexaTool(d)])
);

export function getCanonicalTool(name: string): AlexaToolDefinition | undefined {
  return TOOL_REGISTRY[name] ?? (TOOL_BY_NAME.has(name) ? toAlexaTool(TOOL_BY_NAME.get(name)!) : undefined);
}

export function listCanonicalTools(channel?: AlexaChannel): AlexaToolDefinition[] {
  return Object.values(TOOL_REGISTRY).filter(
    (t) => !channel || t.channels.includes(channel)
  );
}

/** OpenAI Chat Completions function tools from canonical registry. */
export function getOpenAIChatToolsFromCanonical(channel: AlexaChannel = "chat") {
  return listCanonicalTools(channel).map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** OpenAI Realtime session tools from canonical registry. */
export function getRealtimeToolsFromCanonical() {
  return listCanonicalTools("voice").map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
