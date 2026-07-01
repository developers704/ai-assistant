import type { AppState, AppIntegrations, GoogleIntegration } from "@/types";
import { getState } from "@/lib/store/server-store";
import { isGoogleConnected, getGoogleTokens } from "./token-store";
import { getAuthenticatedClient } from "./client";
import { fetchGmailInbox } from "./gmail";
import { fetchGoogleCalendarEvents } from "./calendar";
import { fetchGoogleContacts } from "./contacts";
import { sortEmails } from "@/lib/email-utils";
import { filterCalendarEvents } from "@/lib/calendar-utils";
import {
  getGoogleCache,
  setGoogleCache,
  applyGoogleCacheToState,
  invalidateGoogleCache,
} from "./cache";
import { isLLMChatConfigured } from "@/lib/ai/llm-chat";
import { getRagStats } from "@/lib/rag";
import { isNewsApiConfigured } from "@/lib/news";
import { withTimeout } from "@/lib/async-utils";

const GOOGLE_SYNC_TIMEOUT_MS = 18000;

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

  if (options?.quick) {
    if (!integration.connected) {
      return { ...base, integrations };
    }

    const cached = getGoogleCache();
    if (cached) {
      return {
        ...base,
        emails: cached.emails,
        events: filterCalendarEvents(cached.events),
        contacts: cached.contacts,
        integrations: {
          ...integrations,
          google: cached.integration,
        },
      };
    }

    // Google connected but cache cold — do not leak demo mock data into live views
    return {
      ...base,
      events: [],
      emails: [],
      contacts: [],
      integrations: { ...integrations, google: integration },
    };
  }

  if (!integration.connected) {
    return { ...base, integrations };
  }

  if (!options?.force) {
    const cached = getGoogleCache();
    if (cached) {
      return {
        ...base,
        emails: cached.emails,
        events: filterCalendarEvents(cached.events),
        contacts: cached.contacts,
        integrations: {
          ...integrations,
          google: cached.integration,
        },
      };
    }
  }

  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return {
        ...base,
        integrations: {
          ...integrations,
          google: { ...integrations.google, syncError: "Session expired — reconnect Google" },
        },
      };
    }

    const syncGoogle = async () => {
      const [emails, events, contacts] = await Promise.all([
        fetchGmailInbox(client),
        fetchGoogleCalendarEvents(client, base.user?.timezone || "Asia/Karachi"),
        fetchGoogleContacts(client),
      ]);
      return { emails, events, contacts };
    };

    const googleResult = await withTimeout(syncGoogle(), GOOGLE_SYNC_TIMEOUT_MS, "Google sync");

    const sortedEmails = sortEmails(googleResult.emails);
    const filteredEvents = filterCalendarEvents(googleResult.events);
    const syncedIntegration: GoogleIntegration = {
      ...integration,
      contactsSynced: googleResult.contacts.length,
    };
    setGoogleCache({
      emails: sortedEmails,
      events: filteredEvents,
      contacts: googleResult.contacts,
      integration: syncedIntegration,
    });

    return {
      ...base,
      emails: sortedEmails,
      events: filteredEvents,
      contacts: googleResult.contacts,
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
