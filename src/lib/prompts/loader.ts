import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

function readPrompt(name: string): string {
  const p = path.join(PROMPTS_DIR, name);
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf-8").trim();
}

export function loadMasterSystemPrompt(): string {
  return readPrompt("master-system.md");
}

export function loadVoiceInstructions(): string {
  const parts = [
    readPrompt("master-system.md"),
    readPrompt("voice-instructions.md"),
    readPrompt("tool-rules.md"),
    readPrompt("confirmation-rules.md"),
    readPrompt("cost-rules.md"),
    readPrompt("response-style.md"),
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function loadChatSystemPrompt(): string {
  const parts = [
    readPrompt("master-system.md"),
    readPrompt("chat-system.md"),
    readPrompt("tool-rules.md"),
    readPrompt("confirmation-rules.md"),
    readPrompt("response-style.md"),
  ].filter(Boolean);
  return parts.join("\n\n");
}
