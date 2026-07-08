import { NextRequest, NextResponse } from "next/server";
import { sendInstagramMessage } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { recipientId?: string; text?: string } = {};
  try {
    body = (await req.json()) as { recipientId?: string; text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const recipientId = String(body.recipientId ?? "").trim();
  const text = String(body.text ?? "").trim();
  if (!recipientId || !text) {
    return NextResponse.json(
      { error: "recipientId and text are required." },
      { status: 400 }
    );
  }

  const result = await sendInstagramMessage({ recipientId, text });
  if (!result.ok) {
    const status =
      result.code === "NO_TOKEN" || result.code === "TOKEN_EXPIRED"
        ? 401
        : result.code === "PERMISSION_DENIED"
          ? 403
          : result.code === "WINDOW_CLOSED"
            ? 409
            : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, ...result.data });
}
