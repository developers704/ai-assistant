import type { AppState, CalendarEvent, Contact, Email, GoogleIntegration } from "@/types";
import fs from "fs";
import path from "path";

interface GoogleCacheEntry {
  emails: Email[];
  events: CalendarEvent[];
  contacts: Contact[];
  integration: GoogleIntegration;
  gmailNextPageToken?: string;
  fetchedAt: number;
}

/** Fresh window — serve without hitting Google. */
const TTL_MS = 10 * 60_000;
/** Keep serving stale cache while a background refresh runs (survives brief outages). */
const STALE_MS = 60 * 60_000;
const DISK_PATH = path.join(process.cwd(), ".data", "google-cache.json");

let cache: GoogleCacheEntry | null = null;
let diskLoaded = false;

function ensureDiskLoaded() {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    if (!fs.existsSync(DISK_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(DISK_PATH, "utf-8")) as GoogleCacheEntry;
    if (raw?.fetchedAt && Array.isArray(raw.emails)) {
      cache = raw;
    }
  } catch {
    // ignore corrupt cache
  }
}

function persistDisk(entry: GoogleCacheEntry) {
  try {
    fs.mkdirSync(path.dirname(DISK_PATH), { recursive: true });
    // Strip huge HTML bodies for disk — list/preview still works; email page refetches full
    const slim: GoogleCacheEntry = {
      ...entry,
      emails: entry.emails.map((e) => ({
        ...e,
        bodyHtml: undefined,
        threadMessages: e.threadMessages?.map((m) => ({
          ...m,
          bodyHtml: undefined,
          threadMessages: undefined,
        })),
      })),
    };
    fs.writeFileSync(DISK_PATH, JSON.stringify(slim));
  } catch {
    // non-fatal
  }
}

export function getGoogleCache(opts?: {
  allowStale?: boolean;
}): GoogleCacheEntry | null {
  ensureDiskLoaded();
  if (!cache) return null;
  const age = Date.now() - cache.fetchedAt;
  if (age <= TTL_MS) return cache;
  if (opts?.allowStale && age <= STALE_MS) return cache;
  return null;
}

/** True when cache exists but is past fresh TTL (caller should refresh in background). */
export function isGoogleCacheStale(): boolean {
  ensureDiskLoaded();
  if (!cache) return true;
  return Date.now() - cache.fetchedAt > TTL_MS;
}

export function setGoogleCache(data: {
  emails: Email[];
  events: CalendarEvent[];
  contacts: Contact[];
  integration: GoogleIntegration;
  gmailNextPageToken?: string;
}) {
  cache = { ...data, fetchedAt: Date.now() };
  persistDisk(cache);
}

export function invalidateGoogleCache() {
  cache = null;
  try {
    if (fs.existsSync(DISK_PATH)) fs.unlinkSync(DISK_PATH);
  } catch {
    // ignore
  }
}

export function applyGoogleCacheToState(base: AppState): AppState {
  const cached = getGoogleCache({ allowStale: true });
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
