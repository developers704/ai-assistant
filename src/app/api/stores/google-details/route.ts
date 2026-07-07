import { NextRequest, NextResponse } from "next/server";
import { getStoreGoogleDetails } from "@/lib/stores/google-details";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { storeId?: string; forceRefresh?: boolean };
  const storeId = String(body.storeId ?? "").trim();
  if (!storeId) {
    return NextResponse.json({ ok: false, message: "storeId is required" }, { status: 400 });
  }
  const details = await getStoreGoogleDetails(storeId, Boolean(body.forceRefresh));
  return NextResponse.json(details);
}

