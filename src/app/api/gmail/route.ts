import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/google/client";
import { fetchGmailInbox } from "@/lib/google/gmail";
import { isGoogleConnected } from "@/lib/google/token-store";
import { sortEmails } from "@/lib/email-utils";

export async function GET(req: NextRequest) {
  if (!isGoogleConnected()) {
    return NextResponse.json({ connected: false, emails: [] });
  }

  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json(
      { connected: true, error: "Session expired — reconnect Google", emails: [] },
      { status: 401 }
    );
  }

  const pageToken = req.nextUrl.searchParams.get("pageToken") ?? undefined;
  const maxResults = Math.min(
    50,
    Math.max(10, Number(req.nextUrl.searchParams.get("maxResults") ?? 25))
  );

  const page = await fetchGmailInbox(client, { maxResults, pageToken });
  const emails = sortEmails(page.emails);

  return NextResponse.json({
    connected: true,
    emails,
    nextPageToken: page.nextPageToken,
    hasMore: !!page.nextPageToken,
  });
}
