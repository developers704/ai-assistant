import { loadAllRagChunks, loadRagConfig } from "./loader";
import type { RetrievedChunk } from "./types";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "what", "who", "how", "when",
  "where", "does", "do", "can", "i", "we", "you", "my", "our", "about", "for",
  "and", "or", "to", "of", "in", "on", "at", "it", "this", "that", "any",
  "show", "tell", "me", "please", "only", "just", "specifically",
  "valliani", "jewelers", "jewelry",
]);

export type PolicyFocus =
  | "privacy"
  | "return"
  | "shipping"
  | "return_address"
  | null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s@.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function chunkBlob(chunk: {
  title: string;
  text: string;
  question?: string;
  metadata: { tags?: string[] };
}): string {
  return `${chunk.title} ${chunk.text} ${chunk.question ?? ""} ${(chunk.metadata.tags ?? []).join(" ")}`.toLowerCase();
}

/** Detect a specific policy/topic so we don't dump unrelated sections. */
export function detectPolicyFocus(query: string): PolicyFocus {
  const q = query.toLowerCase();
  if (/\bprivacy\b/.test(q)) return "privacy";
  if (
    /\breturn\s+address\b/.test(q) ||
    /\bwhere\s+(do\s+i|to)\s+return\b/.test(q) ||
    /\bmail(ing)?\s+(it\s+)?back\b/.test(q)
  ) {
    return "return_address";
  }
  if (/\b(return|refund|exchange)s?\b/.test(q) && !/\bship/.test(q)) return "return";
  if (/\bship(ping)?\b/.test(q) && !/\breturn|refund|exchange\b/.test(q)) return "shipping";
  return null;
}

export function isNarrowKnowledgeQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(only|just|specifically)\b/.test(q) ||
    detectPolicyFocus(query) !== null
  );
}

function isPrimarilyShippingChunk(chunk: {
  id: string;
  title: string;
  text: string;
}): boolean {
  if (chunk.id === "vj_shipping" || chunk.id === "vj_faq_05") return true;
  const title = chunk.title.toLowerCase();
  return /\bship/.test(title) && !/\breturn/.test(title);
}

function isPrimarilyReturnAddressChunk(chunk: { id: string; title: string }): boolean {
  if (chunk.id === "vj_return_address") return true;
  return /\breturn address\b/i.test(chunk.title);
}

function isMixedPromisesChunk(chunk: { id: string }): boolean {
  return chunk.id === "vj_promises";
}

function chunkMatchesFocus(
  chunk: {
    id: string;
    title: string;
    text: string;
    question?: string;
    metadata: { tags?: string[] };
  },
  focus: Exclude<PolicyFocus, null>,
  query: string
): boolean {
  const blob = chunkBlob(chunk);
  const narrow = /\b(only|just|specifically)\b/i.test(query);

  switch (focus) {
    case "privacy":
      return /\bprivacy\b/.test(blob);
    case "return_address":
      return (
        isPrimarilyReturnAddressChunk(chunk) ||
        /\bgreat mall|milpitas|95035\b/.test(blob)
      );
    case "return":
      if (!/\breturn|refund|exchange\b/.test(blob)) return false;
      if (isPrimarilyShippingChunk(chunk)) return false;
      if (narrow && (isPrimarilyReturnAddressChunk(chunk) || isMixedPromisesChunk(chunk))) {
        return false;
      }
      return true;
    case "shipping":
      return /\bship/.test(blob) && !isPrimarilyReturnAddressChunk(chunk);
    default:
      return true;
  }
}

function exactMatchBoost(query: string, chunkText: string, preferExact: string[]): number {
  const q = query.toLowerCase();
  const t = chunkText.toLowerCase();
  let boost = 0;

  for (const field of preferExact) {
    if (!q.includes(field)) continue;
    if (field === "phone" && /1-844|ovani-104|\d{3}[-.]?\d{3}/.test(t)) boost += 4;
    if (field === "email" && /@vallianijewelers\.com/.test(t)) boost += 4;
    if (field === "return address" && /great mall|milpitas|95035/.test(t)) boost += 4;
    if (field === "store name" && /mall|california|texas|arizona|nevada/.test(t)) boost += 2;
    if (field === "policy") {
      // Only boost the policy type the user asked for — never substitute privacy→returns.
      if (/\bprivacy\b/.test(q)) {
        if (/\bprivacy\b/.test(t)) boost += 5;
      } else if (/\breturn|refund|exchange\b/.test(q)) {
        if (/\breturn|refund|exchange\b/.test(t)) boost += 4;
      } else if (/\bship/.test(q)) {
        if (/\bship/.test(t)) boost += 4;
      }
    }
  }

  if (q.includes("return") && /return/.test(t)) boost += 3;
  if (q.includes("ship") && /ship/.test(t)) boost += 3;
  if (q.includes("privacy") && /privacy/.test(t)) boost += 5;
  if (q.includes("brand") && /ovani|novello|diani|aanika|link n lock/.test(t)) boost += 3;
  if (q.includes("founder") || q.includes("founded")) {
    if (/kash|1999|founded/.test(t)) boost += 4;
  }
  if (q.includes("contact") || q.includes("phone") || q.includes("email")) {
    if (/orders@|1-844|support/.test(t)) boost += 3;
  }
  if (q.includes("store") || q.includes("location")) {
    if (/location|mall|find a store|california|texas/.test(t)) boost += 2;
  }

  // Penalize off-topic policy sections when the ask is specific.
  const focus = detectPolicyFocus(query);
  if (focus === "return" && /\bship/.test(t) && !/\breturn/.test(t)) boost -= 4;
  if (focus === "shipping" && /\breturn/.test(t) && !/\bship/.test(t)) boost -= 4;
  if (focus === "privacy" && !/\bprivacy\b/.test(t)) boost -= 10;

  return boost;
}

function scoreChunk(
  query: string,
  chunk: ReturnType<typeof loadAllRagChunks>[0],
  preferExact: string[]
): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const titleTokens = tokenize(chunk.title);
  const bodyTokens = tokenize(chunk.text);
  const tagTokens = (chunk.metadata.tags ?? []).flatMap((tag) => tokenize(tag));

  let score = 0;
  for (const qt of queryTokens) {
    if (titleTokens.includes(qt)) score += 3;
    if (bodyTokens.includes(qt)) score += 1;
    if (tagTokens.includes(qt)) score += 2;
    if (chunk.title.toLowerCase().includes(qt)) score += 1;
    if (chunk.text.toLowerCase().includes(qt)) score += 0.5;
  }

  if (chunk.source === "faq" && chunk.question) {
    const qTokens = tokenize(chunk.question);
    const overlap = queryTokens.filter((t) => qTokens.includes(t)).length;
    score += overlap * 2.5;
  }

  score += exactMatchBoost(query, `${chunk.title} ${chunk.text}`, preferExact);

  if (chunk.metadata.answer_policy?.includes("guardrail") || chunk.metadata.tags?.includes("guardrail")) {
    if (/how many|store count|locations/.test(query.toLowerCase())) score += 2;
  }

  return score;
}

function resolveTopK(query: string, topK?: number): number {
  if (topK != null) return topK;
  const config = loadRagConfig();
  const defaultK = config.retrieval?.top_k ?? 5;
  const focus = detectPolicyFocus(query);
  const q = query.toLowerCase();
  if (/\b(only|just|specifically)\b/.test(q)) return 1;
  if (focus === "privacy" || focus === "return" || focus === "shipping" || focus === "return_address") {
    return 2;
  }
  return defaultK;
}

export function retrieveKnowledge(query: string, topK?: number): RetrievedChunk[] {
  const config = loadRagConfig();
  const k = resolveTopK(query, topK);
  const preferExact = config.retrieval?.prefer_exact_match_for ?? [];
  const focus = detectPolicyFocus(query);

  const chunks = loadAllRagChunks();
  const scored = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(query, chunk, preferExact),
    }))
    .filter((c) => c.score > 0)
    .filter((c) => (focus ? chunkMatchesFocus(c, focus, query) : true))
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const results: RetrievedChunk[] = [];
  for (const item of scored) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    results.push(item);
    if (results.length >= k) break;
  }

  return results;
}

export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No matching company knowledge chunks retrieved for this question.";
  }

  return chunks
    .map(
      (c, i) =>
        `### Source ${i + 1}: ${c.title} (${c.id})
${c.text}
Policy: ${c.metadata.answer_policy ?? "Use source as stated."}
Tags: ${(c.metadata.tags ?? []).join(", ") || "none"}
Freshness: ${c.metadata.freshness ?? "verify if time-sensitive"}`
    )
    .join("\n\n");
}

export function getRagGuardrails(): string[] {
  return loadRagConfig().accuracy_guardrails ?? [];
}

export function getRagAnswerStyle(): string {
  return (
    loadRagConfig().suggested_answer_style ??
    "Direct answer first, then concise supporting detail."
  );
}
