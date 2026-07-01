import type { AppState, CalendarEvent, Contact, Email, GoogleIntegration } from "@/types";

interface GoogleCacheEntry {
  emails: Email[];
  events: CalendarEvent[];
  contacts: Contact[];
  integration: GoogleIntegration;
  fetchedAt: number;
}

const TTL_MS = 90_000;
let cache: GoogleCacheEntry | null = null;

export function getGoogleCache(): GoogleCacheEntry | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > TTL_MS) {
    cache = null;
    return null;
  }
  return cache;
}

export function setGoogleCache(data: {
  emails: Email[];
  events: CalendarEvent[];
  contacts: Contact[];
  integration: GoogleIntegration;
}) {
  cache = { ...data, fetchedAt: Date.now() };
}

export function invalidateGoogleCache() {
  cache = null;
}

export function applyGoogleCacheToState(base: AppState): AppState {
  const cached = getGoogleCache();
  if (!cached) return base;

  return {
    ...base,
    emails: cached.emails,
    events: cached.events,
    contacts: cached.contacts,
    integrations: {
      ...base.integrations,
      google: cached.integration,
    },
  };
}
