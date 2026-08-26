import type { AppState, AppIntegrations, GoogleIntegration } from "@/types";
import { getState } from "@/lib/store/server-store";
import { isGoogleConnected, getGoogleTokens } from "./token-store";
import { getAuthenticatedClient } from "./client";
import { fetchGmailInbox } from "./gmail";
import { fetchGoogleCalendarEvents } from "./calendar";
import { fetchGoogleContacts, mergeContactLists } from "./contacts";
import { sortEmails } from "@/lib/email-utils";
import { filterCalendarEvents } from "@/lib/calendar-utils";
import {
  getGoogleCache,
  setGoogleCache,
  applyGoogleCacheToState,
  invalidateGoogleCache,
  isGoogleCacheStale,
} from "./cache";
import { isLLMChatConfigured } from "@/lib/ai/llm-chat";
import { getRagStats } from "@/lib/rag";
import { isNewsApiConfigured } from "@/lib/news";
import { withTimeout } from "@/lib/async-utils";

const GOOGLE_SYNC_TIMEOUT_MS = 12000;
/** Keep state sync light — Email page loads its own fuller inbox. */
const STATE_GMAIL_MAX = 12;

let backgroundRefresh: Promise<void> | null = null;

export { applyGoogleCacheToState, invalidateGoogleCache, getIntegrationsMeta };

function getIntegrationsMeta(): AppIntegrations {
  const rag = getRagStats();
  return {
    google: {
      connected: isGoogleConnected(),
      email: getGoogleTokens()?.email,
    },
    llm: {
      configured: isLLMChatConfigured(),
      mode: isLLMChatConfigured() ? "hybrid" : "rules",
    },
    rag: {
      available: rag.available,
      chunks: rag.totalChunks,
      faqs: rag.totalFaqs,
    },
    news: {
      configured: isNewsApiConfigured(),
    },
  };
}

async function refreshGoogleInBackground(timezone: string) {
  if (backgroundRefresh) return backgroundRefresh;
  backgroundRefresh = (async () => {
    try {
      const client = await getAuthenticatedClient();
      if (!client) return;
      const [inbox, events, contacts] = await Promise.all([
        fetchGmailInbox(client, { maxResults: STATE_GMAIL_MAX }),
        fetchGoogleCalendarEvents(client, timezone),
        fetchGoogleContacts(client),
      ]);
      const sortedEmails = sortEmails(inbox.emails);
      const filteredEvents = filterCalendarEvents(events);
      setGoogleCache({
        emails: sortedEmails,
        events: filteredEvents,
        contacts,
        integration: {
          connected: true,
          email: getGoogleTokens()?.email,
          contactsSynced: contacts.length,
          gmailNextPageToken: inbox.nextPageToken,
          gmailHasMore: !!inbox.nextPageToken,
        },
        gmailNextPageToken: inbox.nextPageToken,
      });
    } catch (err) {
      console.warn("[google-sync] background refresh failed:", err);
    } finally {
      backgroundRefresh = null;
    }
  })();
  return backgroundRefresh;
}

export async function getEnrichedState(options?: {
  force?: boolean;
  quick?: boolean;
}): Promise<AppState> {
  const base = getState();
  const integrations = getIntegrationsMeta();

  const integration: GoogleIntegration = {
    connected: isGoogleConnected(),
    email: getGoogleTokens()?.email,
  };

  if (!integration.connected) {
    return { ...base, integrations };
  }

  // Prefer cache (fresh or stale) so login / open never waits on Gmail
  const cached = getGoogleCache({ allowStale: true });
  if (cached && !options?.force) {
    if (isGoogleCacheStale()) {
      void refreshGoogleInBackground(base.user?.timezone || "Asia/Karachi");
    }
    return {
      ...base,
      emails: cached.emails,
      events: filterCalendarEvents(cached.events),
      contacts: mergeContactLists(base.contacts, cached.contacts),
      integrations: {
        ...integrations,
        google: cached.integration,
      },
    };
  }

  if (options?.quick) {
    // Cold cache — return empty shell immediately; kick off refresh
    void refreshGoogleInBackground(base.user?.timezone || "Asia/Karachi");
    return {
      ...base,
      events: [],
      emails: [],
      contacts: base.contacts,
      integrations: { ...integrations, google: integration },
    };
  }

  // Full request with no cache — bounded sync (smaller inbox than before)
  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return {
        ...base,
        integrations: {
          ...integrations,
          google: {
            ...integrations.google,
            syncError: "Session expired — reconnect Google",
          },
        },
      };
    }

    const syncGoogle = async () => {
      const [inbox, events, contacts] = await Promise.all([
        fetchGmailInbox(client, { maxResults: STATE_GMAIL_MAX }),
        fetchGoogleCalendarEvents(client, base.user?.timezone || "Asia/Karachi"),
        fetchGoogleContacts(client),
      ]);
      return { inbox, events, contacts };
    };

    const googleResult = await withTimeout(
      syncGoogle(),
      GOOGLE_SYNC_TIMEOUT_MS,
      "Google sync"
    );

    const sortedEmails = sortEmails(googleResult.inbox.emails);
    const filteredEvents = filterCalendarEvents(googleResult.events);
    const syncedIntegration: GoogleIntegration = {
      ...integration,
      contactsSynced: googleResult.contacts.length,
      gmailNextPageToken: googleResult.inbox.nextPageToken,
      gmailHasMore: !!googleResult.inbox.nextPageToken,
    };
    setGoogleCache({
      emails: sortedEmails,
      events: filteredEvents,
      contacts: googleResult.contacts,
      integration: syncedIntegration,
      gmailNextPageToken: googleResult.inbox.nextPageToken,
    });

    return {
      ...base,
      emails: sortedEmails,
      events: filteredEvents,
      contacts: mergeContactLists(base.contacts, googleResult.contacts),
      integrations: {
        ...integrations,
        google: syncedIntegration,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync Google data";
    return {
      ...base,
      integrations: {
        ...integrations,
        google: { ...integration, syncError: message },
      },
    };
  }
}
