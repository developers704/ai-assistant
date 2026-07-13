import fs from "fs";
import path from "path";
import type { RagChunk, RagFaqPair, RagIngestionConfig } from "./types";

const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "knowledge", "valliani");

let cachedChunks: RagChunk[] | null = null;
let cachedConfig: RagIngestionConfig | null = null;
let cachedChunksMtime = 0;

function knowledgeMtime(): number {
  const files = ["chunks.jsonl", "faq_pairs.jsonl", "rag_ingestion_config.json"];
  let latest = 0;
  for (const name of files) {
    const filePath = path.join(KNOWLEDGE_DIR, name);
    if (!fs.existsSync(filePath)) continue;
    latest = Math.max(latest, fs.statSync(filePath).mtimeMs);
  }
  return latest;
}

function readJsonl<T>(filename: string): T[] {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function loadRagConfig(): RagIngestionConfig {
  const mtime = knowledgeMtime();
  if (cachedConfig && mtime === cachedChunksMtime) return cachedConfig;
  const configPath = path.join(KNOWLEDGE_DIR, "rag_ingestion_config.json");
  if (!fs.existsSync(configPath)) {
    cachedConfig = { retrieval: { top_k: 5 } };
    return cachedConfig;
  }
  cachedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as RagIngestionConfig;
  return cachedConfig;
}

export function loadAllRagChunks(): RagChunk[] {
  const mtime = knowledgeMtime();
  if (cachedChunks && mtime === cachedChunksMtime) return cachedChunks;

  const rawChunks = readJsonl<Omit<RagChunk, "source">>("chunks.jsonl");
  const faqs = readJsonl<RagFaqPair>("faq_pairs.jsonl");

  const fromChunks: RagChunk[] = rawChunks.map((c) => ({
    ...c,
    source: "chunk" as const,
  }));

  const fromFaqs: RagChunk[] = faqs.map((f) => ({
    id: f.id,
    title: f.question,
    text: `Q: ${f.question}\nA: ${f.answer}`,
    metadata: f.metadata,
    source: "faq" as const,
    question: f.question,
  }));

  cachedChunks = [...fromChunks, ...fromFaqs];
  cachedChunksMtime = mtime;
  // Config may have changed with the same knowledge refresh.
  cachedConfig = null;
  return cachedChunks;
}

export function isRagAvailable(): boolean {
  return fs.existsSync(path.join(KNOWLEDGE_DIR, "chunks.jsonl"));
}

export function getRagStats() {
  const chunks = loadAllRagChunks();
  return {
    available: isRagAvailable(),
    totalChunks: chunks.filter((c) => c.source === "chunk").length,
    totalFaqs: chunks.filter((c) => c.source === "faq").length,
    sourceDir: KNOWLEDGE_DIR,
  };
}
