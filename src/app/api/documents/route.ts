import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { setState } from "@/lib/store/server-store";
import { getFileType } from "@/lib/utils";
import type { Document } from "@/types";

const mockSummaries: Record<string, { summary: string; keyPoints: string[]; actionItems?: string[] }> = {
  pdf: {
    summary: "This document appears to be a business contract or report. Key terms and obligations have been identified.",
    keyPoints: ["Contract duration and renewal terms identified", "Payment and delivery clauses extracted", "Penalty and liability sections noted"],
    actionItems: ["Review clause 4.2 regarding delivery penalties", "Confirm payment terms with finance team"],
  },
  excel: {
    summary: "Spreadsheet contains structured business data with sales figures, trends, and store-level breakdowns.",
    keyPoints: ["Revenue data across multiple stores", "Product category performance metrics", "Month-over-month comparison available"],
    actionItems: ["Review underperforming store metrics", "Validate data against POS system"],
  },
  csv: {
    summary: "CSV file contains tabular business data suitable for analysis and reporting.",
    keyPoints: ["Structured data with headers detected", "Numeric columns identified for analysis", "Date range spans recent business period"],
  },
  word: {
    summary: "Document contains meeting notes, business correspondence, or formal documentation.",
    keyPoints: ["Action items and decisions identified", "Key stakeholders mentioned", "Follow-up dates noted"],
    actionItems: ["Distribute action items to team", "Schedule follow-up review"],
  },
  default: {
    summary: "Document uploaded and processed. Content has been analyzed for key business information.",
    keyPoints: ["Document structure analyzed", "Key sections identified", "Ready for Q&A"],
  },
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileType = getFileType(file.name);
  const mock = mockSummaries[fileType] || mockSummaries.default;

  const document: Document = {
    id: uuidv4(),
    name: file.name,
    type: fileType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    summary: mock.summary,
    keyPoints: mock.keyPoints,
    actionItems: mock.actionItems,
  };

  const newState = setState((s) => ({
    ...s,
    documents: [document, ...s.documents],
  }));

  return NextResponse.json({ document, state: newState });
}
