import { NextResponse } from "next/server";
import { buildEmailVoiceScript, getVoiceEmails } from "@/lib/voice/email-data";

export const runtime = "nodejs";

export async function GET() {
  const { emails, googleConnected, source } = await getVoiceEmails();
  const script = buildEmailVoiceScript(emails);

  const urgent = emails.filter((e) => e.category === "urgent");
  const needsReply = emails.filter((e) => e.needsReply);

  return NextResponse.json({
    script,
    total: emails.length,
    unread: emails.filter((e) => !e.isRead).length,
    urgent: urgent.length,
    needsReply: needsReply.length,
    googleConnected,
    source,
    uiAction: { type: "navigate", path: "/email" },
  });
}
