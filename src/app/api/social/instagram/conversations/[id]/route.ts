import { NextRequest, NextResponse } from "next/server";
import { fetchConversationMessages } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
  }

  const result = await fetchConversationMessages(id);
  if (!result.ok) {
    const status =
      result.code === "NO_TOKEN" || result.code === "TOKEN_EXPIRED"
        ? 401
        : result.code === "PERMISSION_DENIED"
          ? 403
          : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ messages: result.data });
}
