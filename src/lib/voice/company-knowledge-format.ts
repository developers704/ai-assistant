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
    /\babout (?:valliani|villiani|valiani) jewelers?\b/i.test(lower) ||
    /\bwho is (?:valliani|villiani)\b/i.test(lower)
  );
}

/** True when the utterance is about Valliani company knowledge (not world trivia). */
export function looksLikeCompanyKnowledgeQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (isBroadCompanyOverviewQuery(query)) return true;
  if (detectPolicyFocus(query) !== null) return true;
  return /\b(valliani|villiani|valiani|vallani|jewelers?|polic(?:y|ies)|privacy|return|shipping|founder|brand|ovani|novello|warranty|layaway|financing|affirm|acima|progressive)\b/i.test(
    q
  );
}

function missingTopicMessage(query: string): string | null {
  const focus = detectPolicyFocus(query);
  if (focus === "privacy") {
    return (
      "I couldn't load the privacy policy from company knowledge right now. " +
      "Please check https://www.vallianijewelers.com or email orders@vallianijewelers.com."
    );
  }
  return null;
}

const PRIVACY_POLICY_CHUNK_ID = "vj_privacy_policy";

/** General “show privacy policy” asks → full summary; niche terms use retrieval. */
function isFullPrivacyPolicyQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (detectPolicyFocus(query) !== "privacy") return false;
  return !/\b(ccpa|cpra|cookie|children|retention|california|opt[- ]?out|delete|deletion)\b/i.test(
    q
  );
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

const POLICY_OVERVIEW_IDS = [
  "vj_promises",
  "vj_returns",
  "vj_shipping",
  "vj_return_address",
  "vj_privacy_policy",
  "vj_payment_methods",
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

export function buildPoliciesOverviewMarkdown(): string {
  const byId = new Map(loadAllRagChunks().map((c) => [c.id, c]));
  const sections: string[] = [];

  for (const id of POLICY_OVERVIEW_IDS) {
    const chunk = byId.get(id);
    if (!chunk) continue;
    const body = cleanChunkText(chunk);
    const trimmed =
      id === "vj_privacy_policy" && body.length > 900
        ? `${body.slice(0, 850).trim()}…\n\n_Ask “privacy policy” for the full summary._`
        : body;
    sections.push(`**${chunk.title}**\n${trimmed}`);
  }

  return `**Valliani Jewelers — policies**

${sections.join("\n\n")}

_Ask about a specific one (return, shipping, privacy, financing) for more detail._`;
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

  if (detectPolicyFocus(query) === "policies_overview") {
    return {
      markdown: buildPoliciesOverviewMarkdown(),
      chunkCount: POLICY_OVERVIEW_IDS.length,
      mode: "overview",
    };
  }

  if (isFullPrivacyPolicyQuery(query)) {
    const main = loadAllRagChunks().find((c) => c.id === PRIVACY_POLICY_CHUNK_ID);
    if (main) {
      return {
        markdown: `**${main.title}**\n\n${cleanChunkText(main)}`,
        chunkCount: 1,
        mode: "retrieved",
      };
    }
  }

  const chunks = retrieveKnowledge(query);
  return {
    markdown: formatKnowledgeChunksForChat(chunks, query),
    chunkCount: chunks.length,
    mode: "retrieved",
  };
}
