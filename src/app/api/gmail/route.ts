import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/google/client";
import { fetchGmailInbox } from "@/lib/google/gmail";
import { isGoogleConnected } from "@/lib/google/token-store";

export async function GET() {
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

  const emails = await fetchGmailInbox(client);
  return NextResponse.json({ connected: true, emails });
}
