import {
  formatRetrievedContext,
  isRagAvailable,
  retrieveKnowledge,
} from "@/lib/rag";

function truncateForSpeech(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  const cut = normalized.slice(0, maxLen - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}...`;
}

/** Compact spoken answer from retrieved company knowledge (for voice tool). */
export function buildCompanyKnowledgeVoiceAnswer(query: string): {
  spokenAnswer: string;
  available: boolean;
  chunkCount: number;
  context: string;
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

  const chunks = retrieveKnowledge(trimmed, 3);
  if (chunks.length === 0) {
    return {
      spokenAnswer:
        "I couldn't find that in our company knowledge. For policies or store details, contact support or check the official site.",
      available: true,
      chunkCount: 0,
      context: "",
    };
  }

  const top = chunks[0];
  const excerpt = truncateForSpeech(top.text, 320);
  const spokenAnswer =
    chunks.length === 1
      ? `${top.title}: ${excerpt}`
      : `${top.title}: ${excerpt} I also have ${chunks.length - 1} related note${chunks.length > 2 ? "s" : ""} if you want more detail.`;

  return {
    spokenAnswer,
    available: true,
    chunkCount: chunks.length,
    context: formatRetrievedContext(chunks),
  };
}
