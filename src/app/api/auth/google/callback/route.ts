import { NextRequest, NextResponse } from "next/server";
import {
  getOAuth2Client,
  fetchGoogleAccountEmail,
} from "@/lib/google/client";
import { saveGoogleTokens } from "@/lib/google/token-store";
import { invalidateGoogleCache } from "@/lib/google/sync";
import { getAppOrigin, isGoogleConfigured } from "@/lib/google/config";

export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req.headers) ?? req.nextUrl.origin;

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}/settings?google=error&reason=not_configured`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?google=error&reason=auth_denied`);
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const email = await fetchGoogleAccountEmail(client);

    saveGoogleTokens({
      ...tokens,
      email,
    });

    invalidateGoogleCache();

    return NextResponse.redirect(`${origin}/settings?google=connected`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    return NextResponse.redirect(`${origin}/settings?google=error&reason=token_exchange`);
  }
}
