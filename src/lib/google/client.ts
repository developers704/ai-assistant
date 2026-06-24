import { google } from "googleapis";
import { getGoogleConfig, GOOGLE_SCOPES } from "./config";
import {
  getGoogleTokens,
  saveGoogleTokens,
  type StoredGoogleTokens,
} from "./token-store";

export { GOOGLE_SCOPES };

export type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export function getOAuth2Client(): GoogleOAuth2Client {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Google OAuth is not configured. Add GOOGLE_CLIENT_ID and related env vars.");
  }

  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

export async function getAuthenticatedClient(): Promise<GoogleOAuth2Client | null> {
  const tokens = getGoogleTokens();
  if (!tokens) return null;

  const client = getOAuth2Client();
  client.setCredentials(tokens);

  client.on("tokens", (newTokens) => {
    const merged: StoredGoogleTokens = {
      ...tokens,
      ...newTokens,
      refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
    };
    saveGoogleTokens(merged);
  });

  if (tokens.expiry_date && tokens.expiry_date <= Date.now() + 60_000) {
    try {
      const { credentials } = await client.refreshAccessToken();
      const merged: StoredGoogleTokens = {
        ...tokens,
        ...credentials,
        refresh_token: credentials.refresh_token ?? tokens.refresh_token,
      };
      saveGoogleTokens(merged);
      client.setCredentials(merged);
    } catch {
      return null;
    }
  }

  return client;
}

export async function fetchGoogleAccountEmail(client: GoogleOAuth2Client): Promise<string | undefined> {
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email ?? undefined;
}
