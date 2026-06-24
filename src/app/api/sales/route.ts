import { NextResponse } from "next/server";
import { computeSalesSummary, mockSalesData } from "@/lib/mock-data";

export async function GET() {
  const summary = computeSalesSummary(mockSalesData);
  return NextResponse.json({ summary, data: mockSalesData });
}
