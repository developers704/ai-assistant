/** Shared OpenAI model IDs — override via .env on the server. */

/** Main AI Chat / planner / email drafts */
export const OPENAI_CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL ?? "gpt-5.6-terra";

/** Data Analyst + report SQL planning — accuracy over cost */
export const OPENAI_ANALYST_MODEL =
  process.env.OPENAI_ANALYST_MODEL ?? "gpt-5.6-sol";

/** Lightweight / fast paths (routing, quick transforms) */
export const OPENAI_FAST_MODEL =
  process.env.OPENAI_FAST_MODEL ?? "gpt-5.6-luna";

/** Knowledge / RAG embeddings (when semantic retrieval is enabled) */
export const OPENAI_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large";

export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && !key.includes("REPLACE");
}
