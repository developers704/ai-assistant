import type { AppState } from "@/types";
import { readSessionFromCookies } from "@/lib/auth/session";
import { appStateForSession } from "@/lib/auth/app-state";
import { applyGoogleCacheToState, getIntegrationsMeta } from "@/lib/google/sync";

/** Attach session user + isAuthenticated before sending AppState to the browser. */
export async function clientAppState(base: AppState): Promise<AppState> {
  const cached = applyGoogleCacheToState(base);
  const meta = getIntegrationsMeta();
  const withMeta: AppState = {
    ...cached,
    integrations: {
      ...meta,
      google: cached.integrations?.google ?? meta.google,
    },
  };
  const session = await readSessionFromCookies();
  return appStateForSession(withMeta, session);
}
