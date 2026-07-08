import { NextRequest, NextResponse } from "next/server";
import { fetchPostComments } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const mediaId = req.nextUrl.searchParams.get("mediaId")?.trim();
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required." }, { status: 400 });
  }

  const result = await fetchPostComments(mediaId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.code === "NO_TOKEN" || result.code === "TOKEN_EXPIRED" ? 401 : 502 }
    );
  }
  return NextResponse.json({ comments: result.data });
}
