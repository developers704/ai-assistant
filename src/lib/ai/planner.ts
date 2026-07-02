import OpenAI from "openai";
import { OPENAI_CHAT_MODEL } from "@/lib/openai/config";
import type { CompactDynamicContext } from "./dynamic-context";

export interface PlannerStep {
  tool: string;
  args: Record<string, unknown>;
  reason: string;
  requiresConfirmation: boolean;
}

export interface PlannerOutput {
  goal: string;
  steps: PlannerStep[];
  finalResponseStyle: string;
}

/**
 * Planner — gated to complex_planner only (cost control).
 * Uses gpt-4.1-mini, NOT analyst model, unless sales.analysis step.
 */
export async function runPlanner(
  userRequest: string,
  context: CompactDynamicContext
): Promise<PlannerOutput | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) return null;

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    temperature: 0.2,
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You plan executive assistant tasks for Valliani Jewelers.
Return JSON: { "goal": string, "steps": [{ "tool", "args", "reason", "requiresConfirmation" }], "finalResponseStyle": string }
Rules: max 5 steps, prefer existing tools, never skip confirmation on delete/send, ask clarification in goal if info missing.`,
      },
      {
        role: "user",
        content: `Request: ${userRequest}\n\nContext:\n${context.textBlock}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PlannerOutput;
    if (!parsed.steps?.length || parsed.steps.length > 5) return null;
    return parsed;
  } catch {
    return null;
  }
}
