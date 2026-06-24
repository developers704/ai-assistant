export interface RagChunkMetadata {
  company?: string;
  source_file?: string;
  source_type?: string;
  language?: string;
  freshness?: string;
  tags?: string[];
  answer_policy?: string;
}

export interface RagChunk {
  id: string;
  title: string;
  text: string;
  metadata: RagChunkMetadata;
  source: "chunk" | "faq";
  question?: string;
}

export interface RagFaqPair {
  id: string;
  question: string;
  answer: string;
  metadata: RagChunkMetadata;
}

export interface RagIngestionConfig {
  recommended_chunking?: Record<string, unknown>;
  retrieval?: {
    top_k?: number;
    rerank?: boolean;
    prefer_exact_match_for?: string[];
    metadata_filters?: string[];
  };
  accuracy_guardrails?: string[];
  suggested_answer_style?: string;
}

export interface RetrievedChunk extends RagChunk {
  score: number;
}
