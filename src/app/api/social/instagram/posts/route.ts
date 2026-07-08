import { NextRequest, NextResponse } from "next/server";
import { fetchInstagramPosts } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 12, 1), 25);

  const result = await fetchInstagramPosts(limit);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.code === "NO_TOKEN" || result.code === "TOKEN_EXPIRED" ? 401 : 502 }
    );
  }
  return NextResponse.json({ posts: result.data });
}
