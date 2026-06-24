import { loadAllRagChunks, loadRagConfig } from "./loader";
import type { RetrievedChunk } from "./types";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "what", "who", "how", "when",
  "where", "does", "do", "can", "i", "we", "you", "my", "our", "about", "for",
  "and", "or", "to", "of", "in", "on", "at", "it", "this", "that", "any",
  "valliani", "jewelers", "jewelry",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s@.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
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
    if (field === "policy" && /return|shipping|policy|exchange/.test(t)) boost += 2;
  }

  if (q.includes("return") && /return/.test(t)) boost += 3;
  if (q.includes("ship") && /ship/.test(t)) boost += 3;
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

  return boost;
}

function scoreChunk(query: string, chunk: ReturnType<typeof loadAllRagChunks>[0], preferExact: string[]): number {
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

  score += exactMatchBoost(query, chunk.text, preferExact);

  if (chunk.metadata.answer_policy?.includes("guardrail") || chunk.metadata.tags?.includes("guardrail")) {
    if (/how many|store count|locations/.test(query.toLowerCase())) score += 5;
  }

  return score;
}

export function retrieveKnowledge(query: string, topK?: number): RetrievedChunk[] {
  const config = loadRagConfig();
  const k = topK ?? config.retrieval?.top_k ?? 5;
  const preferExact = config.retrieval?.prefer_exact_match_for ?? [];

  const chunks = loadAllRagChunks();
  const scored = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(query, chunk, preferExact),
    }))
    .filter((c) => c.score > 0)
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
