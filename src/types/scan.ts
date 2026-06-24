export type ScanDocKind = "auto" | "id" | "receipt";

export type ScanDocumentType =
  | "government_id"
  | "receipt"
  | "invoice"
  | "business_card"
  | "other";

export interface ScanField {
  label: string;
  value: string;
  confidence: "high" | "medium" | "low";
}

export interface ScanLineItem {
  description: string;
  quantity?: string;
  unitPrice?: string;
  amount?: string;
}

export interface ScanResult {
  documentType: ScanDocumentType;
  summary: string;
  fields: ScanField[];
  lineItems: ScanLineItem[];
  rawText: string;
  warnings: string[];
  processedAt: string;
}
