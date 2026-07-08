import { NextRequest, NextResponse } from "next/server";
import { fetchInstagramConversations } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 25, 1), 50);

  const result = await fetchInstagramConversations(limit);
  if (!result.ok) {
    const status =
      result.code === "NO_TOKEN" || result.code === "TOKEN_EXPIRED"
        ? 401
        : result.code === "PERMISSION_DENIED"
          ? 403
          : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ conversations: result.data });
}
