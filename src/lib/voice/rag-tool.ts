import {
  formatRetrievedContext,
  isRagAvailable,
  retrieveKnowledge,
} from "@/lib/rag";
import {
  buildCompanyKnowledgeAnswer,
  cleanChunkText,
  isBroadCompanyOverviewQuery,
} from "@/lib/voice/company-knowledge-format";

function truncateForSpeech(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  const cut = normalized.slice(0, maxLen - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}...`;
}

/** Company knowledge answer for voice + chat tools. */
export function buildCompanyKnowledgeVoiceAnswer(query: string): {
  spokenAnswer: string;
  markdown?: string;
  available: boolean;
  chunkCount: number;
  context: string;
  mode?: "overview" | "retrieved";
} {
  if (!isRagAvailable()) {
    return {
      spokenAnswer:
        "Company knowledge isn't loaded right now. Try the AI Chat page or check Settings.",
      available: false,
      chunkCount: 0,
      context: "",
    };
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return {
      spokenAnswer: "What would you like to know about Valliani — stores, policies, or brands?",
      available: true,
      chunkCount: 0,
      context: "",
    };
  }

  const answer = buildCompanyKnowledgeAnswer(trimmed);

  if (answer.mode === "overview") {
    return {
      spokenAnswer: answer.markdown,
      markdown: answer.markdown,
      available: true,
      chunkCount: answer.chunkCount,
      context: "",
      mode: "overview",
    };
  }

  const chunks = retrieveKnowledge(trimmed);
  if (chunks.length === 0) {
    return {
      spokenAnswer:
        answer.markdown ||
        "I couldn't find that in our company knowledge. For policies or store details, contact support or check the official site.",
      markdown: answer.markdown,
      available: true,
      chunkCount: 0,
      context: "",
      mode: "retrieved",
    };
  }

  const markdown = answer.markdown;
  const top = chunks[0];
  const voiceShort = truncateForSpeech(cleanChunkText(top), 400);

  return {
    spokenAnswer: markdown,
    markdown,
    available: true,
    chunkCount: chunks.length,
    context: formatRetrievedContext(chunks),
    mode: "retrieved",
  };
}
