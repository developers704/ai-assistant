import fs from "fs";
import path from "path";
import type { RagChunk, RagFaqPair, RagIngestionConfig } from "./types";

const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "knowledge", "valliani");

let cachedChunks: RagChunk[] | null = null;
let cachedConfig: RagIngestionConfig | null = null;

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
  if (cachedConfig) return cachedConfig;
  const configPath = path.join(KNOWLEDGE_DIR, "rag_ingestion_config.json");
  if (!fs.existsSync(configPath)) {
    cachedConfig = { retrieval: { top_k: 5 } };
    return cachedConfig;
  }
  cachedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as RagIngestionConfig;
  return cachedConfig;
}

export function loadAllRagChunks(): RagChunk[] {
  if (cachedChunks) return cachedChunks;

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
