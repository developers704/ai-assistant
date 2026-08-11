import {
  formatRetrievedContext,
  isRagAvailable,
  retrieveKnowledge,
} from "@/lib/rag";
import { buildCompanyKnowledgeAnswer } from "@/lib/voice/company-knowledge-format";

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

  return {
    spokenAnswer: markdown,
    markdown,
    available: true,
    chunkCount: chunks.length,
    context: formatRetrievedContext(chunks),
    mode: "retrieved",
  };
}
