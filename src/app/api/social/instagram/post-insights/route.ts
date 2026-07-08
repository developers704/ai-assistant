import { NextRequest, NextResponse } from "next/server";
import { fetchPostInsights } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const mediaId = req.nextUrl.searchParams.get("mediaId")?.trim();
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required." }, { status: 400 });
  }

  const result = await fetchPostInsights(mediaId);
  if (!result.ok) {
    const status =
      result.code === "NO_TOKEN" || result.code === "TOKEN_EXPIRED"
        ? 401
        : result.code === "METRIC_UNAVAILABLE"
          ? 200
          : 502;
    // Metric-unavailable is a normal, non-fatal case: return empty insights + note.
    if (result.code === "METRIC_UNAVAILABLE") {
      return NextResponse.json({ insights: [], note: result.error }, { status });
    }
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ insights: result.data });
}
