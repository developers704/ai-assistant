import { NextResponse } from "next/server";
import { mockStores, getStoreStats } from "@/lib/mock-data";

export async function GET() {
  const stats = getStoreStats();
  return NextResponse.json({ stores: mockStores, stats });
}
