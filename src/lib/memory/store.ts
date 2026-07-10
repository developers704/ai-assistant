import fs from "fs";
import path from "path";

const MEMORY_DIR = path.join(process.cwd(), ".data", "memory");

export interface ProfileMemory {
  name?: string;
  company?: string;
  role?: string;
  tone?: string;
  timezone?: string;
  communicationStyle?: string;
}

export interface WorkingMemory {
  lastPath?: string;
  selectedEmailId?: string;
  selectedEmailFrom?: string;
  selectedEmailSubject?: string;
  selectedMeetingId?: string;
  selectedMeetingTitle?: string;
  selectedReportId?: string;
  selectedContactId?: string;
  lastGeneratedImagePrompt?: string;
  lastPendingActionId?: string;
  updatedAt: string;
}

export interface MemoryFact {
  id: string;
  text: string;
  category: "preference" | "business" | "contact";
  createdAt: string;
}

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  const p = path.join(MEMORY_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(path.join(MEMORY_DIR, file), JSON.stringify(data, null, 2), "utf-8");
}

export function loadProfileMemory(): ProfileMemory {
  return readJson<ProfileMemory>("profile-memory.json", {});
}

export function saveProfileMemory(patch: Partial<ProfileMemory>): ProfileMemory {
  const next = { ...loadProfileMemory(), ...patch };
  writeJson("profile-memory.json", next);
  return next;
}

const WORKING_MEMORY_TTL_MS = 2 * 60 * 60 * 1000;

export function loadWorkingMemory(): WorkingMemory {
  const mem = readJson<WorkingMemory>("working-memory.json", {
    updatedAt: new Date().toISOString(),
  });
  const age = Date.now() - new Date(mem.updatedAt).getTime();
  if (age > WORKING_MEMORY_TTL_MS) {
    return { updatedAt: new Date().toISOString() };
  }
  return mem;
}

/** Working memory — short-lived UI context; survives server restart. */
export function updateWorkingMemory(patch: Partial<WorkingMemory>): WorkingMemory {
  const next: WorkingMemory = {
    ...loadWorkingMemory(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeJson("working-memory.json", next);
  return next;
}

export function appendConversationSummary(summary: string): void {
  ensureDir();
  const line = JSON.stringify({
    summary,
    at: new Date().toISOString(),
  });
  fs.appendFileSync(path.join(MEMORY_DIR, "conversation-summaries.jsonl"), `${line}\n`, "utf-8");
}

export function loadConversationSummaries(limit = 3): string[] {
  ensureDir();
  const p = path.join(MEMORY_DIR, "conversation-summaries.jsonl");
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf-8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try {
        return (JSON.parse(line) as { summary: string }).summary;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

export function appendFact(fact: MemoryFact): void {
  ensureDir();
  fs.appendFileSync(
    path.join(MEMORY_DIR, "facts.jsonl"),
    `${JSON.stringify(fact)}\n`,
    "utf-8"
  );
}

export function loadFacts(): MemoryFact[] {
  ensureDir();
  const p = path.join(MEMORY_DIR, "facts.jsonl");
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf-8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MemoryFact);
}
