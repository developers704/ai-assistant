import { NextResponse } from "next/server";
import { getOAuth2Client, GOOGLE_SCOPES } from "@/lib/google/client";
import { isGoogleConfigured } from "@/lib/google/config";

export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured in environment variables." },
      { status: 500 }
    );
  }

  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });

  return NextResponse.redirect(url);
}
