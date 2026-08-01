import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/google/client";
import { fetchGmailAttachment } from "@/lib/google/gmail";
import { isGoogleConnected } from "@/lib/google/token-store";

function safeFilename(name: string): string {
  return name.replace(/[\r\n"/\\]/g, "_").slice(0, 180) || "attachment";
}

export async function GET(req: NextRequest) {
  if (!isGoogleConnected()) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  }
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const messageId = req.nextUrl.searchParams.get("messageId")?.trim() ?? "";
  const attachmentId = req.nextUrl.searchParams.get("attachmentId")?.trim() ?? "";
  const filename = safeFilename(
    req.nextUrl.searchParams.get("filename")?.trim() || "attachment"
  );
  const mimeType =
    req.nextUrl.searchParams.get("mimeType")?.trim() || "application/octet-stream";

  if (!messageId || !attachmentId) {
    return NextResponse.json(
      { error: "messageId and attachmentId are required" },
      { status: 400 }
    );
  }

  try {
    const file = await fetchGmailAttachment(client, messageId, attachmentId);
    if (!file) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("[gmail/attachment]", err);
    return NextResponse.json({ error: "Failed to download attachment" }, { status: 502 });
  }
}
