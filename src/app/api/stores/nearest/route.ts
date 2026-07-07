import { NextRequest, NextResponse } from "next/server";
import { findNearestStore } from "@/lib/stores/store-intelligence";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const storeName = req.nextUrl.searchParams.get("storeName") ?? "";
  const city = req.nextUrl.searchParams.get("city") ?? undefined;
  const state = req.nextUrl.searchParams.get("state") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "3");
  const result = findNearestStore({
    storeName: storeName || undefined,
    city,
    state,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(5, limit)) : 3,
  });
  return NextResponse.json(result);
}

