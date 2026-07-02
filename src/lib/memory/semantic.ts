/**
 * TODO: Semantic memory with embeddings — only add when keyword retrieval is insufficient.
 * Triggers: memory file > 500 facts, poor recall, cross-session deep recall needed.
 * Do NOT enable paid vector DB until justified by usage.
 */
export function semanticMemoryEnabled(): boolean {
  return false;
}
