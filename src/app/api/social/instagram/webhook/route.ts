import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookToken } from "@/lib/social/meta-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta webhook verification (GET) and incoming event receiver (POST).
 *
 * GET: Meta verifies the webhook by echoing back the challenge token when
 *      hub.verify_token matches META_WEBHOOK_VERIFY_TOKEN.
 * POST: Incoming Instagram messaging events. We currently acknowledge only;
 *       persisting/relaying to the client is a future enhancement.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? undefined;
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyWebhookToken(token)) {
    return new NextResponse(challenge ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

export async function POST(req: NextRequest) {
  // Acknowledge receipt quickly so Meta doesn't retry.
  const raw = await req.text().catch(() => "");
  if (process.env.NODE_ENV !== "production") {
    // Lightweight log for local debugging; never log tokens.
    console.log("[instagram-webhook] received event:", raw.slice(0, 500));
  }
  return NextResponse.json({ received: true }, { status: 200 });
}
