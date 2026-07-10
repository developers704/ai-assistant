/**
 * Server-only Meta Graph API client for Instagram Business.
 *
 * SECURITY:
 * - This module must only ever run on the server (API routes / server tools).
 * - The access token is read from env and never returned to the browser.
 * - Do not import this file into any "use client" component.
 */

import {
  isMetaDisconnected,
  disconnectMeta,
  reconnectMeta,
} from "@/lib/social/meta-connection-store";

const DEFAULT_TIMEOUT_MS = 12000;

export interface MetaConfig {
  graphVersion: string;
  pageId: string | null;
  igBusinessId: string | null;
  token: string | null;
}

export interface MetaStatus {
  connected: boolean;
  pageId: string | null;
  instagramBusinessId: string | null;
  graphVersion: string;
  hasToken: boolean;
  /** User turned Instagram off in the app (env keys may still exist). */
  disconnected: boolean;
  /** Env still has token + business id — Reconnect will work. */
  canReconnect: boolean;
}

export type MetaResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; status?: number };

function readEnvMeta(): MetaConfig {
  return {
    graphVersion: process.env.META_GRAPH_VERSION || "v25.0",
    pageId: process.env.META_PAGE_ID || null,
    igBusinessId: process.env.META_IG_BUSINESS_ID || null,
    token: process.env.META_TEST_ACCESS_TOKEN || null,
  };
}

/** Read Meta env config. Never expose the token beyond this module. */
export function getMetaConfig(): MetaConfig {
  const env = readEnvMeta();
  if (isMetaDisconnected()) {
    return { ...env, token: null };
  }
  return env;
}

/** Connection status — safe to send to the client (no token value). */
export function getMetaStatus(): MetaStatus {
  const env = readEnvMeta();
  const disconnected = isMetaDisconnected();
  const cfg = disconnected ? { ...env, token: null } : env;
  const canReconnect = Boolean(env.token && env.igBusinessId);
  return {
    connected: Boolean(cfg.token && cfg.igBusinessId),
    pageId: cfg.pageId,
    instagramBusinessId: disconnected ? null : cfg.igBusinessId,
    graphVersion: cfg.graphVersion,
    hasToken: Boolean(cfg.token),
    disconnected,
    canReconnect,
  };
}

export function disconnectInstagram(): void {
  disconnectMeta();
}

export function reconnectInstagram(): { ok: true } | { ok: false; error: string } {
  const env = readEnvMeta();
  if (!env.token || !env.igBusinessId) {
    return {
      ok: false,
      error: "Cannot reconnect — Meta env keys are missing on the server.",
    };
  }
  reconnectMeta();
  return { ok: true };
}

/** Build a Graph API URL. Token is appended server-side only. */
export function buildGraphUrl(
  path: string,
  params: Record<string, string | undefined> = {},
  cfg: MetaConfig = getMetaConfig()
): string {
  const cleanPath = path.replace(/^\/+/, "");
  const url = new URL(`https://graph.facebook.com/${cfg.graphVersion}/${cleanPath}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, value);
  }
  if (cfg.token) url.searchParams.set("access_token", cfg.token);
  return url.toString();
}

/** Redact the token from any string (defensive, for logs/errors). */
function redactToken(text: string, token: string | null): string {
  if (!token) return text;
  return text.split(token).join("[REDACTED]");
}

interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Perform a server-side Graph GET call with timeout + normalized errors.
 * Never leaks the token in the response or error text.
 */
export async function graphGet<T = unknown>(
  path: string,
  params: Record<string, string | undefined> = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<MetaResult<T>> {
  const cfg = getMetaConfig();

  if (!cfg.token) {
    return {
      ok: false,
      error: "Instagram is not connected. Add META_TEST_ACCESS_TOKEN (or connect via OAuth).",
      code: "NO_TOKEN",
    };
  }

  const url = buildGraphUrl(path, params, cfg);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    const raw = await res.text();
    let body: (GraphErrorBody & Record<string, unknown>) | null = null;
    try {
      body = raw ? (JSON.parse(raw) as GraphErrorBody & Record<string, unknown>) : null;
    } catch {
      body = null;
    }

    if (!res.ok || body?.error) {
      const apiMessage = body?.error?.message
        ? redactToken(body.error.message, cfg.token)
        : `Graph API request failed (${res.status}).`;
      const subcode = body?.error?.error_subcode;
      const code = body?.error?.code;
      // 190 = invalid/expired token; 10x OAuth subcodes = expired session.
      const expired = code === 190 || subcode === 463 || subcode === 467;
      return {
        ok: false,
        error: expired
          ? "Instagram token expired. Generate a new test token or reconnect via OAuth."
          : apiMessage,
        code: expired ? "TOKEN_EXPIRED" : code != null ? String(code) : undefined,
        status: res.status,
      };
    }

    return { ok: true, data: (body ?? {}) as T };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? "Instagram request timed out. Try again."
        : "Could not reach the Instagram Graph API.",
      code: aborted ? "TIMEOUT" : "NETWORK",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* ── Normalized Instagram types ── */

export interface InstagramAccount {
  id: string;
  username: string;
  name?: string;
  followersCount: number | null;
  mediaCount: number | null;
  profilePictureUrl: string | null;
}

export interface InstagramPost {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  likeCount: number | null;
  commentsCount: number | null;
}

export interface InstagramComment {
  id: string;
  text: string | null;
  username: string | null;
  timestamp: string | null;
  likeCount: number | null;
  replyCount: number | null;
}

export interface InstagramInsight {
  name: string;
  title: string | null;
  value: number | null;
}

function requireIgId(): MetaResult<string> {
  const { igBusinessId, token } = getMetaConfig();
  if (!token) {
    return {
      ok: false,
      error: "Instagram is not connected. Add META_TEST_ACCESS_TOKEN (or connect via OAuth).",
      code: "NO_TOKEN",
    };
  }
  if (!igBusinessId) {
    return {
      ok: false,
      error: "META_IG_BUSINESS_ID is not set. Add it to connect the Instagram Business account.",
      code: "NO_IG_ID",
    };
  }
  return { ok: true, data: igBusinessId };
}

/**
 * Resolve the Meta Page ID. Required for the Instagram Messaging API
 * (conversations + send-message edges live on the Page node, not the IG user node).
 */
function requirePageId(): MetaResult<string> {
  const { pageId, token } = getMetaConfig();
  if (!token) {
    return {
      ok: false,
      error: "Instagram is not connected. Add META_TEST_ACCESS_TOKEN (or connect via OAuth).",
      code: "NO_TOKEN",
    };
  }
  if (!pageId) {
    return {
      ok: false,
      error: "META_PAGE_ID is not set. The Page ID is required for Instagram DMs.",
      code: "NO_PAGE_ID",
    };
  }
  return { ok: true, data: pageId };
}

export async function fetchInstagramAccount(): Promise<MetaResult<InstagramAccount>> {
  const ig = requireIgId();
  if (!ig.ok) return ig;

  const res = await graphGet<{
    id: string;
    username?: string;
    name?: string;
    followers_count?: number;
    media_count?: number;
    profile_picture_url?: string;
  }>(ig.data, {
    fields: "username,name,followers_count,media_count,profile_picture_url",
  });
  if (!res.ok) return res;

  const d = res.data;
  return {
    ok: true,
    data: {
      id: d.id,
      username: d.username ?? "",
      name: d.name,
      followersCount: d.followers_count ?? null,
      mediaCount: d.media_count ?? null,
      profilePictureUrl: d.profile_picture_url ?? null,
    },
  };
}

export async function fetchInstagramPosts(limit = 12): Promise<MetaResult<InstagramPost[]>> {
  const ig = requireIgId();
  if (!ig.ok) return ig;

  const res = await graphGet<{
    data?: Array<{
      id: string;
      caption?: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      timestamp?: string;
      like_count?: number;
      comments_count?: number;
    }>;
  }>(`${ig.data}/media`, {
    fields:
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
  if (!res.ok) return res;

  const posts = (res.data.data ?? []).map((m) => ({
    id: m.id,
    caption: m.caption ?? null,
    mediaType: m.media_type ?? null,
    mediaUrl: m.media_url ?? null,
    thumbnailUrl: m.thumbnail_url ?? null,
    permalink: m.permalink ?? null,
    timestamp: m.timestamp ?? null,
    likeCount: m.like_count ?? null,
    commentsCount: m.comments_count ?? null,
  }));
  return { ok: true, data: posts };
}

export async function fetchPostComments(
  mediaId: string
): Promise<MetaResult<InstagramComment[]>> {
  if (!mediaId) {
    return { ok: false, error: "mediaId is required.", code: "BAD_REQUEST" };
  }
  const res = await graphGet<{
    data?: Array<{
      id: string;
      text?: string;
      username?: string;
      timestamp?: string;
      like_count?: number;
      replies?: { data?: unknown[] };
    }>;
  }>(`${mediaId}/comments`, {
    fields: "id,text,username,timestamp,like_count,replies",
  });
  if (!res.ok) return res;

  const comments = (res.data.data ?? []).map((c) => ({
    id: c.id,
    text: c.text ?? null,
    username: c.username ?? null,
    timestamp: c.timestamp ?? null,
    likeCount: c.like_count ?? null,
    replyCount: Array.isArray(c.replies?.data) ? c.replies!.data!.length : null,
  }));
  return { ok: true, data: comments };
}

export async function fetchPostInsights(
  mediaId: string
): Promise<MetaResult<InstagramInsight[]>> {
  if (!mediaId) {
    return { ok: false, error: "mediaId is required.", code: "BAD_REQUEST" };
  }
  const res = await graphGet<{
    data?: Array<{
      name: string;
      title?: string;
      values?: Array<{ value?: number }>;
    }>;
  }>(`${mediaId}/insights`, {
    metric: "reach,impressions,engagement,saved,video_views",
  });

  if (!res.ok) {
    // Metric-not-available errors are common per media type — surface gracefully.
    if (/metric|not.*support|unsupported|invalid/i.test(res.error)) {
      return {
        ok: false,
        error: "Insight metric not available for this media type.",
        code: "METRIC_UNAVAILABLE",
      };
    }
    return res;
  }

  const insights = (res.data.data ?? []).map((i) => ({
    name: i.name,
    title: i.title ?? null,
    value: i.values?.[0]?.value ?? null,
  }));
  return { ok: true, data: insights };
}

/* ── Instagram Messaging (DM inbox) ── */

export interface InstagramParticipant {
  id: string;
  username: string | null;
  name?: string | null;
}

export interface InstagramConversation {
  id: string;
  participants: InstagramParticipant[];
  snippet: string | null;
  updatedTime: string | null;
  messageCount: number | null;
  unreadCount: number | null;
}

export interface InstagramMessage {
  id: string;
  from: InstagramParticipant | null;
  message: string | null;
  createdTime: string | null;
}

/**
 * List Instagram DM conversations (people who messaged the business account).
 * Requires instagram_manage_messages + pages_messaging permissions.
 */
export async function fetchInstagramConversations(
  limit = 25
): Promise<MetaResult<InstagramConversation[]>> {
  const page = requirePageId();
  if (!page.ok) return page;

  const res = await graphGet<{
    data?: Array<{
      id: string;
      snippet?: string;
      updated_time?: string;
      message_count?: number;
      unread_count?: number;
      participants?: {
        data?: Array<{ id: string; username?: string; name?: string }>;
      };
    }>;
  }>(`${page.data}/conversations`, {
    platform: "instagram",
    fields: "id,participants,snippet,updated_time,message_count,unread_count",
    limit: String(limit),
  });
  if (!res.ok) {
    // Common when messaging permissions are missing.
    if (/permission|access|scope|oauth|capability/i.test(res.error)) {
      return {
        ok: false,
        error:
          "Instagram DMs need the instagram_manage_messages + pages_messaging permissions and a Page access token with the MESSAGING task (plus App Review for production). Add them in your Meta app, then reconnect.",
        code: "PERMISSION_DENIED",
      };
    }
    return res;
  }

  const convs = (res.data.data ?? []).map((c) => ({
    id: c.id,
    participants: (c.participants?.data ?? []).map((p) => ({
      id: p.id,
      username: p.username ?? null,
      name: p.name ?? null,
    })),
    snippet: c.snippet ?? null,
    updatedTime: c.updated_time ?? null,
    messageCount: c.message_count ?? null,
    unreadCount: c.unread_count ?? null,
  }));
  return { ok: true, data: convs };
}

/** Fetch the most recent messages in a conversation (Meta caps at 20). */
export async function fetchConversationMessages(
  conversationId: string
): Promise<MetaResult<InstagramMessage[]>> {
  if (!conversationId) {
    return { ok: false, error: "conversationId is required.", code: "BAD_REQUEST" };
  }
  const res = await graphGet<{
    messages?: {
      data?: Array<{
        id: string;
        message?: string;
        created_time?: string;
        from?: { id: string; username?: string; name?: string };
      }>;
    };
  }>(conversationId, {
    fields: "messages{from,message,created_time,id}",
  });
  if (!res.ok) return res;

  const msgs = (res.data.messages?.data ?? []).map((m) => ({
    id: m.id,
    from: m.from
      ? { id: m.from.id, username: m.from.username ?? null, name: m.from.name ?? null }
      : null,
    message: m.message ?? null,
    createdTime: m.created_time ?? null,
  }));
  // Meta returns oldest-first; reverse for chat-style newest at bottom.
  return { ok: true, data: msgs.reverse() };
}

export interface SendInstagramMessageInput {
  recipientId: string;
  text: string;
}

export interface SendInstagramMessageResult {
  recipientId: string;
  messageId: string | null;
}

/**
 * Send an Instagram DM. Requires instagram_manage_messages permission.
 * Per Meta policy, you can only reply to a user who messaged the business
 * first, within the 24-hour standard window.
 */
export async function sendInstagramMessage(
  input: SendInstagramMessageInput
): Promise<MetaResult<SendInstagramMessageResult>> {
  const page = requirePageId();
  if (!page.ok) return page;
  const cfg = getMetaConfig();
  const recipientId = String(input.recipientId ?? "").trim();
  const text = String(input.text ?? "").trim();
  if (!recipientId) {
    return { ok: false, error: "recipientId is required.", code: "BAD_REQUEST" };
  }
  if (!text) {
    return { ok: false, error: "Message text is required.", code: "BAD_REQUEST" };
  }

  const url = `https://graph.facebook.com/${cfg.graphVersion}/${page.data}/messages`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE",
        access_token: cfg.token,
      }),
      cache: "no-store",
    });
    const raw = await res.text();
    let body: { error?: { message?: string; code?: number; error_subcode?: number }; recipient_id?: string; message_id?: string } | null = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }

    if (!res.ok || body?.error) {
      const apiMessage = body?.error?.message
        ? redactToken(body.error.message, cfg.token)
        : `Instagram send failed (${res.status}).`;
      const subcode = body?.error?.error_subcode;
      const code = body?.error?.code;
      const expired = code === 190 || subcode === 463 || subcode === 467;
      const permission = /permission|access|scope|oauth/i.test(apiMessage);
      const window24 = /24|window|messaging_type/i.test(apiMessage);
      return {
        ok: false,
        error: expired
          ? "Instagram token expired. Generate a new token or reconnect via OAuth."
          : permission
            ? "Sending DMs needs the instagram_manage_messages permission (and App Review for production). Add it in your Meta app."
            : window24
              ? "You can only reply within 24 hours of the customer's last message (Meta policy)."
              : apiMessage,
        code: expired
          ? "TOKEN_EXPIRED"
          : permission
            ? "PERMISSION_DENIED"
            : window24
              ? "WINDOW_CLOSED"
              : code != null
                ? String(code)
                : undefined,
        status: res.status,
      };
    }

    return {
      ok: true,
      data: {
        recipientId: body?.recipient_id ?? recipientId,
        messageId: body?.message_id ?? null,
      },
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "Instagram send timed out. Try again." : "Could not reach the Instagram Graph API.",
      code: aborted ? "TIMEOUT" : "NETWORK",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Webhook verification token helper (X-Hub-Signature-256 optional). */
export function verifyWebhookToken(token: string | undefined): boolean {
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  return Boolean(expected && token && token === expected);
}
