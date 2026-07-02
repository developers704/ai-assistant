/** Shared OpenAI model IDs — override via .env on the server. */

export const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";

/** Data Analyst + report SQL planning — accuracy over cost. */
export const OPENAI_ANALYST_MODEL = process.env.OPENAI_ANALYST_MODEL ?? "gpt-4.1";

export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && !key.includes("REPLACE");
}
