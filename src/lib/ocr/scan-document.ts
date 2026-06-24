import OpenAI from "openai";
import type { ScanDocKind, ScanResult } from "@/types/scan";

const SCAN_SCHEMA = {
  name: "document_scan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      documentType: {
        type: "string",
        enum: ["government_id", "receipt", "invoice", "business_card", "other"],
      },
      summary: {
        type: "string",
        description: "One or two sentence summary of the document.",
      },
      fields: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["label", "value", "confidence"],
        },
      },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string" },
            quantity: { type: "string" },
            unitPrice: { type: "string" },
            amount: { type: "string" },
          },
          required: ["description", "quantity", "unitPrice", "amount"],
        },
      },
      rawText: {
        type: "string",
        description: "Full verbatim text visible on the document, preserving line breaks.",
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["documentType", "summary", "fields", "lineItems", "rawText", "warnings"],
  },
} as const;

function kindHint(kind: ScanDocKind): string {
  switch (kind) {
    case "id":
      return "The user expects a government ID or identity document. Extract: document type, full name, document/ID number, date of birth, gender, nationality, issue date, expiry date, address, and any other visible fields.";
    case "receipt":
      return "The user expects a receipt or invoice. Extract: merchant/store name, address, date, time, receipt/invoice number, line items, subtotal, tax, discounts, total, payment method, and currency.";
    default:
      return "Auto-detect the document type (ID, receipt, invoice, etc.) and extract all relevant structured fields.";
  }
}

export async function scanDocumentImage(
  imageBase64: string,
  mimeType: string,
  kind: ScanDocKind = "auto"
): Promise<ScanResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    throw new Error("OpenAI API key is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 4096,
    response_format: { type: "json_schema", json_schema: SCAN_SCHEMA },
    messages: [
      {
        role: "system",
        content: `You are a precision OCR and document extraction engine for business operations.

Rules:
- Read every visible character carefully. Transcribe text exactly as printed — do not guess or invent values.
- If text is blurry, partially cut off, or unreadable, use confidence "low" and note it in warnings.
- For empty or inapplicable line-item fields use an empty string.
- rawText must contain the complete visible text from the image, line by line.
- fields should use clear human-readable labels (e.g. "Full Name", "Total Amount", "ID Number").
- ${kindHint(kind)}`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all structured information from this document image.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No extraction result returned from the model.");
  }

  let parsed: Omit<ScanResult, "processedAt">;
  try {
    parsed = JSON.parse(raw) as Omit<ScanResult, "processedAt">;
  } catch {
    throw new Error("Failed to parse extraction result.");
  }

  return {
    ...parsed,
    lineItems: parsed.lineItems ?? [],
    warnings: parsed.warnings ?? [],
    processedAt: new Date().toISOString(),
  };
}
