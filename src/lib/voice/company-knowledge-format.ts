import { loadAllRagChunks } from "@/lib/rag/loader";
import type { RetrievedChunk } from "@/lib/rag/types";
import {
  detectPolicyFocus,
  retrieveKnowledge,
} from "@/lib/rag/retrieve";

/** Broad “tell me everything” / company overview prompts. */
export function isBroadCompanyOverviewQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();
  return (
    /\b(tell me\s+)?(everything|all)\b[\s\S]{0,50}\b(you know|about|on)\b/i.test(lower) ||
    /\beverything you know\b/i.test(lower) ||
    /\b(company overview|full overview|overview of valliani)\b/i.test(lower) ||
    /\bwhat is valliani\b/i.test(lower) ||
    /\babout valliani jewelers?\b/i.test(lower) ||
    /\bwho is valliani\b/i.test(lower)
  );
}

function missingTopicMessage(query: string): string | null {
  const focus = detectPolicyFocus(query);
  if (focus === "privacy") {
    return (
      "I don't have Valliani Jewelers' **privacy policy** in the loaded company knowledge. " +
      "Please check [vallianijewelers.com](https://www.vallianijewelers.com) or email orders@vallianijewelers.com."
    );
  }
  return null;
}

const OVERVIEW_SECTION_IDS = [
  "vj_company_identity",
  "vj_brand_background",
  "vj_business_products",
  "vj_house_brands",
  "vj_locations_general",
  "vj_website_contact",
  "vj_promises",
  "vj_shipping",
  "vj_returns",
] as const;

export function cleanChunkText(chunk: Pick<RetrievedChunk, "text">): string {
  const faqMatch = chunk.text.match(/^Q:\s*.+\nA:\s*([\s\S]+)$/i);
  if (faqMatch) return faqMatch[1].trim();
  return chunk.text.trim();
}

export function buildFullCompanyOverviewMarkdown(): string {
  const byId = new Map(loadAllRagChunks().map((c) => [c.id, c]));
  const sections: string[] = [];

  for (const id of OVERVIEW_SECTION_IDS) {
    const chunk = byId.get(id);
    if (!chunk) continue;
    sections.push(`**${chunk.title}**\n${cleanChunkText(chunk)}`);
  }

  return `**Valliani Jewelers — what I know**

${sections.join("\n\n")}

_Ask about stores in a specific state, return policy, house brands, or contact details for more._`;
}

export function formatKnowledgeChunksForChat(
  chunks: RetrievedChunk[],
  query?: string
): string {
  if (chunks.length === 0) {
    return (
      (query && missingTopicMessage(query)) ||
      "I couldn't find that in our company knowledge. Try asking about stores, policies, brands, or contact info."
    );
  }

  if (chunks.length === 1) {
    const c = chunks[0];
    return `**${c.title}**\n\n${cleanChunkText(c)}`;
  }

  const lines = chunks.slice(0, 5).map((c) => `**${c.title}**\n${cleanChunkText(c)}`);
  return lines.join("\n\n");
}

export function buildCompanyKnowledgeAnswer(query: string): {
  markdown: string;
  chunkCount: number;
  mode: "overview" | "retrieved";
} {
  if (isBroadCompanyOverviewQuery(query)) {
    return {
      markdown: buildFullCompanyOverviewMarkdown(),
      chunkCount: OVERVIEW_SECTION_IDS.length,
      mode: "overview",
    };
  }

  // Let retrieveKnowledge pick a focused topK (1–2 for specific policies).
  const chunks = retrieveKnowledge(query);
  return {
    markdown: formatKnowledgeChunksForChat(chunks, query),
    chunkCount: chunks.length,
    mode: "retrieved",
  };
}
