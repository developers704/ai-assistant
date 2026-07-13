import type { AlexaChannel, AlexaIntent } from "@/lib/alexa/types";
import type { AlexaToolDefinition } from "@/lib/tools/canonical-registry";

export function evaluateActionPolicy(input: {
  intent: AlexaIntent;
  tool: AlexaToolDefinition;
  channel: AlexaChannel;
}): {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
} {
  const { tool, intent } = input;

  if (!tool.channels.includes(input.channel) && input.channel !== "automation") {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: `Tool ${tool.name} not allowed on channel ${input.channel}`,
    };
  }

  if (tool.risk === "read" || tool.risk === "draft") {
    return {
      allowed: true,
      requiresConfirmation: false,
    };
  }

  if (tool.risk === "write") {
    return {
      allowed: true,
      requiresConfirmation: true,
      reason: "Write actions require confirmation",
    };
  }

  if (tool.risk === "destructive") {
    return {
      allowed: true,
      requiresConfirmation: true,
      reason: "Destructive actions require explicit confirmation",
    };
  }

  return {
    allowed: true,
    requiresConfirmation: intent.requiresConfirmation || tool.confirmationRequired,
  };
}
