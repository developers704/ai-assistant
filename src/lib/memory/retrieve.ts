import { loadFacts, loadConversationSummaries, loadProfileMemory, loadWorkingMemory } from "./store";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Keyword-scored memory retrieval — no embeddings in this phase (cost control). */
export function retrieveRelevantMemories(query: string, limit = 4): string[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const facts = loadFacts();
  const scored = facts
    .map((f) => {
      const ft = tokenize(f.text);
      const overlap = tokens.filter((t) => ft.includes(t)).length;
      return { text: f.text, score: overlap };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.text);

  const profile = loadProfileMemory();
  const profileBits = [
    profile.tone ? `Tone: ${profile.tone}` : "",
  ].filter(Boolean);

  const summaries = loadConversationSummaries(2);
  const working = loadWorkingMemory();
  const workingBits: string[] = [];
  if (working.selectedEmailFrom) {
    workingBits.push(`Last email context: ${working.selectedEmailFrom} — ${working.selectedEmailSubject ?? ""}`);
  }
  if (working.selectedMeetingTitle) {
    workingBits.push(`Last meeting context: ${working.selectedMeetingTitle}`);
  }

  return [...scored, ...profileBits, ...summaries, ...workingBits].slice(0, limit + 2);
}
