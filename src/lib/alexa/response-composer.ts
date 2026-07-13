import type { AlexaChannel, AlexaIntent, AlexaToolResult } from "@/lib/alexa/types";

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .trim();
}

function shortenSpoken(text: string, maxSentences = 3): string {
  const plain = stripMarkdown(text).replace(/\s+/g, " ").trim();
  const parts = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, maxSentences).join(" ");
}

export function composeAlexaResponse(input: {
  channel: AlexaChannel;
  intent: AlexaIntent;
  toolResult?: AlexaToolResult;
  clarification?: string;
}): {
  textAnswer: string;
  spokenAnswer: string;
} {
  if (input.clarification) {
    return {
      textAnswer: input.clarification,
      spokenAnswer: shortenSpoken(input.clarification, 2),
    };
  }

  const tr = input.toolResult;
  if (!tr) {
    return {
      textAnswer: "How can I help?",
      spokenAnswer: "How can I help?",
    };
  }

  const text =
    tr.textAnswer ??
    tr.spokenAnswer ??
    (tr.ok ? "Done." : tr.error?.message ?? "Something went wrong.");

  let spoken = tr.spokenAnswer ?? shortenSpoken(text);

  if (input.channel === "voice") {
    spoken = shortenSpoken(spoken, 3);
  }

  if (tr.freshness?.asOf && input.channel === "chat" && !/as of|source:/i.test(text)) {
    return {
      textAnswer: `${text}\n\n_Source: ${tr.freshness.source ?? "live data"} · as of ${tr.freshness.asOf}_`,
      spokenAnswer: spoken,
    };
  }

  return { textAnswer: text, spokenAnswer: spoken };
}
